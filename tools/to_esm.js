'use strict';
// The phase 4 codemod of issue #20: the app's source files (build.py's list) become ES modules, mechanically.
//   node tools/to_esm.js [--root DIR] [--check]      --check: the plan and its problems only, nothing written
// What it does to each file (nothing else changes; every line above the module block keeps its number, so the i18n
// tables' file:line references and the hand-written ones still point where they did):
//   - the CommonJS line `if (typeof module !== 'undefined') module.exports = X;` (or its `&& module.exports` form) goes;
//   - the three UMD headers (constr.js, homrange.js, palette.js: `(function (root, factory) { ... root.X = M ... })(…,
//     function () {`) become `const X = (function (factory) { … })(function () {`, the same number of lines;
//   - one module block goes at the end: `import { A, B } from './a.js';` for every name of another file the file uses
//     (scope analysis: a reference no declaration of the file resolves), then `export { … };` for the names other files
//     use, with `X as 'module.exports'` when the file exported X to node (so require() in the tests still returns X);
//     a file that exported { X } to node exports X by name (require() returns the namespace, { X } destructures it);
//   - app.js and gl.js (src/app/, src/gl/): the block goes at the end of wrap.js, its paths relative to src/ (the
//     joined file is src/app.js);
//   - src/main.js: the bundle's entry, `import './x.js';` in build.py's order, so the modules run in the order the
//     concatenation ran them.
// i18n.js and cyr.js stay classic scripts before the bundle (build.py prepends them; their I18N, $t, $tx, $tn and CYR
// stay globals). Problems (exit 1 with --check): a name declared at the top of two files, a top-level (load-time) use of
// a name a later file declares, a file with a CommonJS line of an unknown form. Text is read and written as is: CRLF
// files keep CRLF (the Windows runner checks out with CRLF).
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const ROOT = path.resolve(argv.includes('--root') ? argv[argv.indexOf('--root') + 1] : path.join(__dirname, '..'));
const CHECK = argv.includes('--check');
const NM = path.join(ROOT, 'node_modules');
const espree = require(path.join(NM, 'espree'));
const scope = require(path.join(NM, 'eslint-scope'));
const { source, parts } = require(path.join(ROOT, 'test', 'src_text.js'));
const SRC = path.join(ROOT, 'src');

// build.py's list, in its order
function buildOrder() {
  const py = fs.readFileSync(path.join(ROOT, 'build.py'), 'utf8');
  const m = /^js = '\\n'\.join\(source\(f\) for f in \[([^\]]*)\]\)/m.exec(py);
  if (!m) throw new Error('build.py: no source() list');
  return m[1].match(/'([^']+)'/g).map((s) => s.slice(1, -1));
}

const CJS = [
  [/^if \(typeof module !== 'undefined'(?: && module\.exports)?\) module\.exports = ([A-Za-z_$][\w$]*);[ \t]*\r?\n?/m, 'value'],
  [/^if \(typeof module !== 'undefined'(?: && module\.exports)?\) module\.exports = \{ ([A-Za-z_$][\w$]*(?:, [A-Za-z_$][\w$]*)*) \};[ \t]*\r?\n?/m, 'names'],
];
// the UMD header: `(function (root, factory) {` … `root.X = M;` … `})(…, function () {`
const UMD = /^\(function \(root, factory\) \{(\r?\n)([\s\S]*?)\}\)\([^\n]*?, function \(\) \{(\r?\n)/m;

function analyze(order) {
  const info = {};
  for (const f of order) {
    const text = source(f, SRC);
    const ast = espree.parse(text, { ecmaVersion: 'latest', sourceType: 'script', range: true });
    const g = scope.analyze(ast, { ecmaVersion: 2022, sourceType: 'script' }).globalScope;
    const decl = new Set(g.variables.map((v) => v.name));
    const umd = UMD.exec(text);
    let umdName = null;
    if (umd) { const n = /root\)?\.([A-Za-z_$][\w$]*) = M;/.exec(umd[2]); if (!n) throw new Error(`${f}: a UMD header without root.X = M`); umdName = n[1]; decl.add(umdName); }
    const through = new Set(), top = new Set();
    for (const r of g.through) {
      through.add(r.identifier.name);
      let s = r.from;
      while (s && s.type !== 'function' && s !== g) s = s.upper;
      if (s === g) top.add(r.identifier.name);
    }
    info[f] = { text, decl, through, top, umdName };
  }
  return info;
}

function plan(order, info) {
  const def = new Map(), problems = [];
  for (const f of order) for (const n of info[f].decl) {
    if (def.has(n)) problems.push(`${n}: declared at the top of ${def.get(n)} and ${f}`);
    else def.set(n, f);
  }
  const out = {};
  for (const f of order) {
    const I = info[f];
    const imports = new Map();
    for (const n of [...I.through].sort()) {
      const from = def.get(n);
      if (!from || from === f) continue;
      if (I.top.has(n) && order.indexOf(from) > order.indexOf(f)) problems.push(`${f}: uses ${n} while it loads, but ${from} (later) declares it`);
      if (!imports.has(from)) imports.set(from, []);
      imports.get(from).push(n);
    }
    let cjs = null;
    for (const [re, kind] of CJS) { const m = re.exec(I.text); if (m) { cjs = { kind, names: m[1].split(', '), re }; break; } }
    if (!cjs && /module\.exports/.test(I.text.replace(UMD, '').replace(/^[ \t]*\/\/.*$/gm, ''))) problems.push(`${f}: module.exports in a form the codemod does not know`);
    const used = [...I.decl].filter((n) => order.some((o) => o !== f && info[o].through.has(n))).sort();
    // (every top-level name: a classic script made each one a global, and the test page keeps them, expose.js)
    const all = [...I.decl].sort();
    out[f] = { imports, cjs, used, all, umdName: I.umdName };
  }
  return { out, problems };
}

function moduleBlock(f, p, order, eol) {
  const lines = [];
  for (const from of order) if (p.imports.has(from)) lines.push(`import { ${p.imports.get(from).join(', ')} } from './${from}';`);
  const names = new Set(p.all);
  if (p.umdName) names.add(p.umdName);
  if (p.cjs) for (const n of p.cjs.names) names.add(n);
  const ex = [...names].sort();
  if (p.cjs && p.cjs.kind === 'value') ex.push(`${p.cjs.names[0]} as 'module.exports'`);
  else if (p.umdName) ex.push(`${p.umdName} as 'module.exports'`);
  if (ex.length) lines.push(`export { ${ex.join(', ')} };`);
  return lines.length ? lines.join(eol) + eol : '';
}

function rewrite(f, p, order) {
  const target = parts(f, SRC) ? path.join(SRC, f.replace(/\.js$/, ''), 'wrap.js') : path.join(SRC, f);
  let text = fs.readFileSync(target, 'utf8');
  const eol = /\r\n/.test(text) ? '\r\n' : '\n';
  if (p.cjs) text = text.replace(p.cjs.re, '');
  if (p.umdName) {
    text = text.replace(UMD, (all, e1, mid, e3) => {
      // the same number of lines: the header's middle lines become one return and comments
      const n = mid.split(/\r?\n/).length - 1;
      const body = [`  return factory();`, ...Array.from({ length: Math.max(0, n - 1) }, () => `  // (ES module: the factory's value is the module's export, ${p.umdName})`)];
      return `const ${p.umdName} = (function (factory) {${e1}${body.join(e1)}${e1}})(function () {${e3}`;
    });
  }
  if (!text.endsWith('\n')) text += eol;
  text += moduleBlock(f, p, order, eol);
  return { target, text };
}

function main() {
  if (fs.existsSync(path.join(SRC, 'main.js'))) { console.error('src/main.js exists: the sources are modules already'); process.exit(2); }
  const order = buildOrder();
  const info = analyze(order);
  const { out, problems } = plan(order, info);
  for (const f of order) {
    const p = out[f], imp = [...p.imports].map(([from, ns]) => `${from}: ${ns.join(', ')}`).join('; ');
    console.log(`${f.padEnd(14)} imports ${imp || '-'}\n${''.padEnd(14)} exports ${[...new Set([...p.used, ...(p.umdName ? [p.umdName] : []), ...(p.cjs ? p.cjs.names : [])])].join(', ') || '-'}${p.cjs ? ` (node: ${p.cjs.kind === 'value' ? 'module.exports = ' + p.cjs.names[0] : '{ ' + p.cjs.names.join(', ') + ' }'})` : p.umdName ? ` (UMD ${p.umdName})` : ''}`);
  }
  for (const q of problems) console.log('PROBLEM ' + q);
  if (CHECK) process.exit(problems.length ? 1 : 0);
  if (problems.length) { console.error(`${problems.length} problem(s): nothing written`); process.exit(1); }
  for (const f of order) { const { target, text } = rewrite(f, out[f], order); fs.writeFileSync(target, text); }
  const eol = /\r\n/.test(fs.readFileSync(path.join(SRC, 'cx.js'), 'utf8')) ? '\r\n' : '\n';
  // src/expose.js: the test page's globals. A classic script's top-level names were globals, and the browser suites
  // (CDP evaluate, test/cdp_kit) reach CX, GLR, Region, … by name; the test bundle puts every module's exports on
  // globalThis, before app.js runs. tools/bundle.mjs gives it no text in the published bundle.
  const exposed = order.flatMap((f) => out[f].all.concat(out[f].umdName ? [out[f].umdName] : []).map((n) => [f, n]));
  const byFile = new Map();
  for (const [f, n] of exposed) { if (!byFile.has(f)) byFile.set(f, []); if (!byFile.get(f).includes(n)) byFile.get(f).push(n); }
  const expose = [`// The test page's globals (issue #20, phase 4; written by tools/to_esm.js): the names a classic script made global, for`,
    `// the browser suites that reach them by name. Only in the test bundle: tools/bundle.mjs gives this file no text in the`,
    `// published one.`,
    ...[...byFile].map(([f, ns]) => `import { ${ns.join(', ')} } from './${f}';`),
    `Object.assign(globalThis, { ${[...byFile.values()].flat().join(', ')} });`].join(eol) + eol;
  fs.writeFileSync(path.join(SRC, 'expose.js'), expose);
  const last = order[order.length - 1];
  const main = [`// The bundle's entry (issue #20, phase 4; written by tools/to_esm.js): the app's modules in build.py's order, so`,
    `// they run in the order the concatenated script ran them; the test page's globals (expose.js) before ${last}. i18n.js and`,
    `// cyr.js come before the bundle, as classic scripts.`,
    ...order.slice(0, -1).map((f) => `import './${f}';`), `import './expose.js';`, `import './${last}';`].join(eol) + eol;
  fs.writeFileSync(path.join(SRC, 'main.js'), main);
  // a split file another module imports (gl.js: GLR) has no file of its own for node to load: a stand-in whose names
  // are undefined, which is what the node tests saw before (they never load the renderer; inverse.js asks typeof GLR).
  // The bundle never reads it: tools/bundle.mjs gives './gl.js' the joined src/gl/ text.
  for (const f of order) {
    if (!parts(f, SRC)) continue;
    const names = out[f].used;
    if (!names.length) continue;
    const stub = [`// A stand-in for node (issue #20, phase 4; written by tools/to_esm.js): src/${f} is src/${f.replace(/\.js$/, '')}/'s parts, joined by the`,
      `// bundle (tools/bundle.mjs gives './${f}' the joined text, never this file). Node, which has no renderer, sees its`,
      `// names undefined, as the tests always did.`,
      ...names.map((n) => `const ${n} = undefined;`), `export { ${names.join(', ')} };`].join(eol) + eol;
    fs.writeFileSync(path.join(SRC, f), stub);
  }
  console.log(`wrote ${order.length} modules and src/main.js`);
}

if (require.main === module) main();
module.exports = { buildOrder, analyze, plan, moduleBlock, rewrite, UMD, CJS };
