'use strict';
// The order a source file's top-level statements run in, for tools/part_move.js: a part split that moves a `const`
// below the statement that reads it keeps every token and every code line, and throws a ReferenceError at load.
//   orderViolations(text)           the top-level statements that read, while they run, a const, let, class or var
//                                   that a later top-level statement declares
//   newOrderViolations(old, new)    those of `new` that `old` does not have: what a move introduced
// "Top level" is the module's statements and, where one is an immediately called function (the closure of a split file:
// `(() => { ... })();`), that function's body, and so on inside it. A statement reads a name while it runs when the
// name is in its own code outside every function and method body (a called function's body is not followed), in the
// heritage, computed keys and static members of a class, and in the body of a function it calls at once. A name a
// statement declares in a block of its own is left out. A function declaration is hoisted, so a statement may read it
// anywhere. Each violation is { name, kind, use, decl } (the two statements as acorn nodes with `loc`, and `key`).
const crypto = require('crypto');
const acorn = require('acorn');

const OPTIONS = { ecmaVersion: 'latest', locations: true, allowHashBang: true };
// (a split file is a module when it imports, and a script otherwise)
function parse(text) {
  try { return acorn.parse(text, { ...OPTIONS, sourceType: 'module' }); } catch (e) { return acorn.parse(text, { ...OPTIONS, sourceType: 'script' }); }
}

const isFunction = (n) => n && (n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression');
// the function an expression statement calls at once: (() => {...})(), (function () {...})(), !function () {...}()
function calledAtOnce(s) {
  let e = s.type === 'ExpressionStatement' ? s.expression : null;
  if (e && e.type === 'UnaryExpression') e = e.argument;
  return e && e.type === 'CallExpression' && isFunction(e.callee) && e.callee.body.type === 'BlockStatement' ? e.callee : null;
}

// the names a binding pattern declares, into `names`; what evaluating it reads (defaults, computed keys) through `read`
function bound(p, names, read) {
  if (!p) return;
  if (p.type === 'Identifier') names.push(p.name);
  else if (p.type === 'ObjectPattern') for (const q of p.properties) { if (q.type === 'RestElement') bound(q.argument, names, read); else { if (q.computed) read(q.key); bound(q.value, names, read); } }
  else if (p.type === 'ArrayPattern') for (const q of p.elements) bound(q, names, read);
  else if (p.type === 'RestElement') bound(p.argument, names, read);
  else if (p.type === 'AssignmentPattern') { read(p.right); bound(p.left, names, read); }
}

// the names node `n` reads while it runs, into `out`; the names it declares in blocks of its own, into `local`
function reads(n, out, local) {
  if (!n || typeof n.type !== 'string') return;
  const go = (x) => reads(x, out, local);
  switch (n.type) {
    case 'FunctionDeclaration': case 'FunctionExpression': case 'ArrowFunctionExpression': return;
    case 'Identifier': out.add(n.name); return;
    case 'ClassDeclaration': case 'ClassExpression':
      go(n.superClass);
      for (const m of n.body.body) {
        if (m.computed) go(m.key);
        if (m.type === 'StaticBlock') m.body.forEach(go); else if (m.type === 'PropertyDefinition' && m.static) go(m.value);
      }
      return;
    case 'CallExpression':
      // (a function called at once runs its body now, with its parameters its own)
      if (isFunction(n.callee)) {
        const names = [];
        for (const p of n.callee.params) bound(p, names, go);
        names.forEach((x) => local.add(x));
        go(n.callee.body);
      } else go(n.callee);
      n.arguments.forEach(go);
      return;
    case 'MemberExpression': go(n.object); if (n.computed) go(n.property); return;
    case 'Property': if (n.computed) go(n.key); go(n.value); return;
    case 'LabeledStatement': go(n.body); return;
    case 'BreakStatement': case 'ContinueStatement': case 'MetaProperty': return;
    case 'VariableDeclarator': { const names = []; bound(n.id, names, go); names.forEach((x) => local.add(x)); go(n.init); return; }
    case 'CatchClause': { const names = []; bound(n.param, names, go); names.forEach((x) => local.add(x)); go(n.body); return; }
    default:
      for (const k of Object.keys(n)) {
        if (k === 'type' || k === 'start' || k === 'end' || k === 'loc') continue;
        const v = n[k];
        if (Array.isArray(v)) v.forEach(go); else if (v && typeof v.type === 'string') go(v);
      }
  }
}

// [[name, kind]] a top-level statement declares by const, let, var or class (a function declaration is hoisted: not
// listed)
function declared(s) {
  if (s.type === 'ClassDeclaration') return [[s.id.name, 'class']];
  if (s.type !== 'VariableDeclaration') return [];
  const out = [];
  for (const d of s.declarations) { const names = []; bound(d.id, names, () => {}); for (const x of names) out.push([x, s.kind]); }
  return out;
}

// the lists of top-level statements: the module's, and inside each immediately called function that is one of them
function levels(program) {
  const out = [];
  const visit = (stmts) => { out.push(stmts); for (const s of stmts) { const f = calledAtOnce(s); if (f) visit(f.body.body); } };
  visit(program.body);
  return out;
}

function orderViolations(text) {
  const out = [];
  const hash = (s, a) => crypto.createHash('sha1').update(`${a}\0${text.slice(s.start, s.end)}`).digest('hex');
  for (const stmts of levels(parse(text))) {
    const decl = new Map();   // name -> { index, kind }
    stmts.forEach((s, i) => { for (const [name, kind] of declared(s)) if (!decl.has(name)) decl.set(name, { index: i, kind }); });
    stmts.forEach((s, i) => {
      if (s.type === 'ImportDeclaration' || calledAtOnce(s)) return;
      const names = new Set(), local = new Set();
      reads(s, names, local);
      for (const name of names) {
        const d = decl.get(name);
        if (d && d.index > i && !local.has(name)) out.push({ name, kind: d.kind, use: s, decl: stmts[d.index], key: hash(stmts[d.index], hash(s, name)) });
      }
    });
  }
  return out;
}

// the violations of `now` that `before` does not have
function newOrderViolations(before, now) {
  const had = new Set(orderViolations(before).map((v) => v.key));
  return orderViolations(now).filter((v) => !had.has(v.key));
}

module.exports = { orderViolations, newOrderViolations };
