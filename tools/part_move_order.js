'use strict';
// The order a source file's top-level statements run in, for tools/part_move.js: a part split that moves a `const`
// below the statement that reads it keeps every token and every code line, and throws a ReferenceError at load.
//   orderViolations(text)           the top-level statements that read, while they run, a const, let, class or var
//                                   that a later top-level statement declares
//   newOrderViolations(old, new)    those of `new` that `old` does not have: what a move introduced
// "Top level" is the module's statements and, where one calls a function at once (the closure of a split file: `(()
// => { ... })();` or `const GLR = (() => { ... })();`), that function's body, and so on inside it. A statement reads
// a name while it runs when the name is in its own code outside every function and method body (a called function's
// body is not followed), in the heritage, computed keys and static members of a class, and in the body of a function
// it calls at once. A name declared in a block, loop head, catch clause or called function around the read is that
// scope's, not the later one. A function declaration is hoisted, so a statement may read it anywhere. Each violation
// is { name, kind, use, decl } (the two statements as acorn nodes with `loc`, and `key`).
const crypto = require('crypto');
const acorn = require('acorn');

const OPTIONS = { ecmaVersion: 'latest', locations: true, allowHashBang: true };
// (a split file is a module when it imports, and a script otherwise)
function parse(text) {
  try { return acorn.parse(text, { ...OPTIONS, sourceType: 'module' }); } catch (e) { return acorn.parse(text, { ...OPTIONS, sourceType: 'script' }); }
}

const isFunction = (n) => n && (n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression');
// the function an expression calls at once, through a `!`, an `await` or an assignment: (() => {...})(),
// !function () {...}()
function calledAtOnce(e) {
  while (e && (e.type === 'UnaryExpression' || e.type === 'AwaitExpression' || e.type === 'AssignmentExpression')) e = e.type === 'AssignmentExpression' ? e.right : e.argument;
  return e && e.type === 'CallExpression' && isFunction(e.callee) && e.callee.body.type === 'BlockStatement' ? e.callee : null;
}
// the functions a top-level statement calls at once at its own level: `(() => {...})();`,
// `const GLR = (() => {...})();`, `x = (() => {...})();`
function closures(s) {
  const e = s.type === 'ExpressionStatement' ? [s.expression] : s.type === 'VariableDeclaration' ? s.declarations.map((d) => d.init) : [];
  return e.map(calledAtOnce).filter(Boolean);
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

// the names a list of statements declares in its own scope: let, const, class and function declarations
function lexical(stmts) {
  const names = [];
  for (const s of stmts) {
    if (s.type === 'VariableDeclaration' && s.kind !== 'var') for (const d of s.declarations) bound(d.id, names, () => {});
    else if ((s.type === 'ClassDeclaration' || s.type === 'FunctionDeclaration') && s.id) names.push(s.id.name);
  }
  return names;
}
// the names `var` declares anywhere in n, outside the functions in it (var is scoped to the function)
function varNames(n, names = []) {
  if (!n || typeof n.type !== 'string' || n.type === 'FunctionDeclaration' || isFunction(n)) return names;
  if (n.type === 'VariableDeclaration' && n.kind === 'var') for (const d of n.declarations) bound(d.id, names, () => {});
  for (const k of Object.keys(n)) {
    if (k === 'type' || k === 'start' || k === 'end' || k === 'loc') continue;
    const v = n[k];
    if (Array.isArray(v)) v.forEach((x) => varNames(x, names)); else if (v && typeof v.type === 'string') varNames(v, names);
  }
  return names;
}
// the shadowed names with `names` added
const within = (shadow, names) => (names.length ? new Set([...shadow, ...names]) : shadow);

// the names node `n` reads while it runs, into `out`, except those in `shadow` (declared in a scope around it, inside
// the statement)
function reads(n, out, shadow) {
  if (!n || typeof n.type !== 'string') return;
  const go = (x) => reads(x, out, shadow);
  switch (n.type) {
    case 'FunctionDeclaration': case 'FunctionExpression': case 'ArrowFunctionExpression': return;
    case 'Identifier': if (!shadow.has(n.name)) out.add(n.name); return;
    case 'ClassDeclaration': case 'ClassExpression':
      go(n.superClass);
      for (const m of n.body.body) {
        if (m.computed) go(m.key);
        if (m.type === 'StaticBlock') { const sh = within(shadow, [...lexical(m.body), ...varNames(m)]); m.body.forEach((x) => reads(x, out, sh)); } else if (m.type === 'PropertyDefinition' && m.static) go(m.value);
      }
      return;
    case 'CallExpression':
      // (a function called at once runs its body now, with its parameters and its own declarations)
      if (isFunction(n.callee)) {
        const names = [];
        for (const p of n.callee.params) bound(p, names, go);
        const sh = within(shadow, [...names, ...varNames(n.callee.body), ...(n.callee.body.type === 'BlockStatement' ? lexical(n.callee.body.body) : [])]);
        reads(n.callee.body, out, sh);
      } else go(n.callee);
      n.arguments.forEach(go);
      return;
    case 'BlockStatement': { const sh = within(shadow, lexical(n.body)); n.body.forEach((x) => reads(x, out, sh)); return; }
    case 'SwitchStatement': { go(n.discriminant); const sh = within(shadow, lexical(n.cases.flatMap((c) => c.consequent))); for (const c of n.cases) { reads(c.test, out, sh); c.consequent.forEach((x) => reads(x, out, sh)); } return; }
    case 'ForStatement': case 'ForInStatement': case 'ForOfStatement': {
      const head = n.type === 'ForStatement' ? n.init : n.left;
      const sh = within(shadow, head && head.type === 'VariableDeclaration' && head.kind !== 'var' ? lexical([head]) : []);
      for (const k of ['init', 'test', 'update', 'left', 'right', 'body']) reads(n[k], out, sh);
      return;
    }
    case 'CatchClause': { const names = []; bound(n.param, names, go); reads(n.body, out, within(shadow, names)); return; }
    case 'MemberExpression': go(n.object); if (n.computed) go(n.property); return;
    case 'Property': if (n.computed) go(n.key); go(n.value); return;
    case 'LabeledStatement': go(n.body); return;
    case 'BreakStatement': case 'ContinueStatement': case 'MetaProperty': return;
    case 'VariableDeclarator': bound(n.id, [], go); go(n.init); return;
    default:
      for (const k of Object.keys(n)) {
        if (k === 'type' || k === 'start' || k === 'end' || k === 'loc') continue;
        const v = n[k];
        if (Array.isArray(v)) v.forEach(go); else if (v && typeof v.type === 'string') go(v);
      }
  }
}

// [[name, kind]] a top-level statement declares by const, let, var or class (a function declaration is hoisted, so it
// is not listed)
function declared(s) {
  if (s.type === 'ClassDeclaration') return [[s.id.name, 'class']];
  if (s.type !== 'VariableDeclaration') return [];
  const out = [];
  for (const d of s.declarations) { const names = []; bound(d.id, names, () => {}); for (const x of names) out.push([x, s.kind]); }
  return out;
}

// the lists of top-level statements: the module's, and inside each function that is called at once by one of them
function levels(program) {
  const out = [];
  const visit = (stmts) => { out.push(stmts); for (const s of stmts) for (const f of closures(s)) visit(f.body.body); };
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
      if (s.type === 'ImportDeclaration') return;
      // (the names the statement declares itself, with a `var` in a block of it, are not another statement's)
      const names = new Set();
      reads(s, names, new Set([...declared(s).map((d) => d[0]), ...varNames(s)]));
      for (const name of names) {
        const d = decl.get(name);
        if (d && d.index > i) out.push({ name, kind: d.kind, use: s, decl: stmts[d.index], key: hash(stmts[d.index], hash(s, name)) });
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
