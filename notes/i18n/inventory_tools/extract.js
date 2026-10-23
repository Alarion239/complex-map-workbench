// AST walk: every string literal and template literal in the given JS files, with context.
// usage: node extract.js <srcDir> <out.json> file1.js file2.js ...
const acorn = require('~/.npm/_npx/515228b7c8d004a2/node_modules/acorn');
const fs = require('fs');
const path = require('path');
const [, , srcDir, out, ...files] = process.argv;
const rows = [];
function lineOf(src, pos) { let n = 1; for (let i = 0; i < pos; i++) if (src.charCodeAt(i) === 10) n++; return n; }
for (const f of files) {
  const src = fs.readFileSync(path.join(srcDir, f), 'utf8');
  const lineStarts = [0];
  for (let i = 0; i < src.length; i++) if (src.charCodeAt(i) === 10) lineStarts.push(i + 1);
  const L = (pos) => { let lo = 0, hi = lineStarts.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (lineStarts[m] <= pos) lo = m; else hi = m - 1; } return lo + 1; };
  let ast;
  try { ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script', allowReturnOutsideFunction: true }); }
  catch (e) { console.error('parse fail', f, e.message); continue; }
  const S = (n) => src.slice(n.start, n.end);
  function ctxOf(stack) {
    const c = { callee: null, argi: null, prop: null, assign: null, concat: false, fn: null, cond: false, arr: false, cmp: false, caseTest: false, objKeyPath: [] };
    let crossed = false;
    for (let i = stack.length - 1; i >= 0; i--) {
      const n = stack[i], child = stack[i + 1];
      if (n.type === 'ObjectExpression' && !c.owner) {
        for (const pr of n.properties) if (pr.type === 'Property' && !pr.computed && pr.value && pr.value.type === 'Literal' && typeof pr.value.value === 'string') {
          const kk = pr.key.name || pr.key.value; if (['id', 'type', 'key', 'name', 'kind', 'mode'].includes(kk)) { c.owner = kk + '=' + pr.value.value; break; }
        }
      }
      if (crossed) { if ((n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression') && !c.fn2) { let nm = n.id && n.id.name; const p = stack[i - 1]; if (!nm && p) nm = p.type === 'VariableDeclarator' ? S(p.id) : p.type === 'Property' ? S(p.key) : null; if (nm) c.fn2 = nm; } if (n.type === 'VariableDeclarator' && !c.outerVar) c.outerVar = S(n.id).slice(0, 30); if (n.type === 'Property' && !c.outerProp) c.outerProp = S(n.key).slice(0,30); continue; }
      if (n.type === 'BinaryExpression') {
        if (n.operator === '+') c.concat = true;
        else if (/^(===|!==|==|!=)$/.test(n.operator) && i === stack.length - 2) c.cmp = true;
      }
      if (n.type === 'SwitchCase' && child === n.test) c.caseTest = true;
      if (n.type === 'ConditionalExpression' || n.type === 'LogicalExpression') c.cond = true;
      if (n.type === 'ArrayExpression' && !c.prop && !c.callee) c.arr = true;
      if (n.type === 'Property' && child === n.value) {
        const k = n.key.type === 'Identifier' ? n.key.name : (n.key.type === 'Literal' ? String(n.key.value) : S(n.key));
        if (!c.prop && !c.callee && !c.assign) c.prop = k;
        if (c.objKeyPath.length < 4) c.objKeyPath.unshift(k);
      }
      if (n.type === 'Property' && child === n.key) { c.isKey = true; }
      if ((n.type === 'CallExpression' || n.type === 'NewExpression') && !c.callee && child !== n.callee) {
        c.callee = S(n.callee).slice(0, 60); c.argi = n.arguments.indexOf(child);
      }
      if (n.type === 'AssignmentExpression' && child === n.right && !c.assign && !c.callee) c.assign = S(n.left).slice(0, 60);
      if (n.type === 'VariableDeclarator' && child === n.init && !c.assign && !c.callee && !c.prop) c.assign = 'var ' + S(n.id).slice(0, 40);
      if (n.type === 'MemberExpression' && child === n.property && n.computed) c.index = true;
      if ((n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression') && !c.fn) {
        let nm = n.id && n.id.name;
        if (!nm) { const p = stack[i - 1]; if (p && p.type === 'VariableDeclarator') nm = S(p.id); else if (p && p.type === 'Property') nm = S(p.key); else if (p && p.type === 'MethodDefinition') nm = S(p.key); else if (p && p.type === 'AssignmentExpression') nm = S(p.left).slice(0, 40); }
        c.fn = nm || '(anon)'; crossed = true;
      }
    }
    return c;
  }
  function visit(node, stack) {
    if (!node || typeof node.type !== 'string') return;
    stack.push(node);
    if (node.type === 'Literal' && typeof node.value === 'string') {
      const parent = stack[stack.length - 2];
      if (!(parent && parent.type === 'Property' && parent.key === node && !parent.computed)) {
        rows.push({ file: f, line: L(node.start), kind: 'lit', value: node.value, raw: S(node).slice(0, 400), ctx: ctxOf(stack) });
      }
    } else if (node.type === 'TemplateLiteral') {
      const parent = stack[stack.length - 2];
      const tagged = parent && parent.type === 'TaggedTemplateExpression';
      let v = '';
      node.quasis.forEach((q, i) => { v += q.value.cooked ?? q.value.raw; if (i < node.expressions.length) v += '${' + S(node.expressions[i]) + '}'; });
      rows.push({ file: f, line: L(node.start), endLine: L(node.end), kind: tagged ? 'tagged' : 'tpl', value: v, ctx: ctxOf(stack) });
    }
    for (const k of Object.keys(node)) {
      if (k === 'type' || k === 'start' || k === 'end' || k === 'loc') continue;
      const v = node[k];
      if (Array.isArray(v)) v.forEach((x) => x && typeof x.type === 'string' && visit(x, stack));
      else if (v && typeof v.type === 'string') visit(v, stack);
    }
    stack.pop();
  }
  visit(ast, []);
}
fs.writeFileSync(out, JSON.stringify(rows, null, 0));
console.log('rows', rows.length);
