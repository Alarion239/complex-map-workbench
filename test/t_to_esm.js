'use strict';
// tools/to_esm.js, the phase 4 codemod of issue #20, on a copy of src/: it finds nothing it cannot convert, every line
// above each file's module block is the file's own (the CommonJS line gone, the UMD headers rewritten line for line),
// every file parses as a module, and require() of each node-loadable file returns what it returned before.
//   node test/t_to_esm.js
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
// (the codemod's parser and scope analysis, and acorn here, are dev dependencies: npm ci first)
if (!fs.existsSync(path.join(ROOT, 'node_modules', 'eslint-scope'))) { console.log('FAIL node_modules is missing: run npm ci (the codemod needs espree and eslint-scope)'); process.exit(1); }
const acorn = require(path.join(ROOT, 'node_modules', 'acorn'));
let fails = 0, n = 0;
const ok = (name, pass, detail) => { n++; if (!pass) { fails++; console.log('FAIL ' + name, detail === undefined ? '' : JSON.stringify(detail).slice(0, 300)); } };
const run = (args, cwd = ROOT) => { try { return { out: execFileSync(process.execPath, args, { cwd, encoding: 'utf8', stdio: 'pipe' }), rc: 0 }; } catch (e) { return { out: String(e.stdout) + String(e.stderr), rc: e.status }; } };

// 1. the plan on the sources as they are: no problem
const plan = run([path.join(ROOT, 'tools', 'to_esm.js'), '--check']);
ok('the codemod finds nothing it cannot convert', plan.rc === 0 && !/PROBLEM/.test(plan.out), plan.out.split('\n').filter((l) => /PROBLEM/.test(l)));

// 2. a copy, converted
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'cmw-esm-'));
fs.cpSync(path.join(ROOT, 'src'), path.join(T, 'src'), { recursive: true });
fs.mkdirSync(path.join(T, 'test')); fs.mkdirSync(path.join(T, 'tools'));
for (const f of ['test/src_text.js', 'tools/to_esm.js', 'build.py']) fs.copyFileSync(path.join(ROOT, f), path.join(T, f));
fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(T, 'node_modules'), 'dir');
const conv = run([path.join(T, 'tools', 'to_esm.js'), '--root', T]);
ok('the codemod converts the copy', conv.rc === 0, conv.out.slice(-300));
ok('a second run refuses (the sources are modules already)', run([path.join(T, 'tools', 'to_esm.js'), '--root', T]).rc === 2, null);
const { buildOrder } = require(path.join(ROOT, 'tools', 'to_esm.js'));
const files = (dir) => { const out = []; for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) out.push(...files(p)); else if (e.name.endsWith('.js')) out.push(p); } return out; };
const BLOCK = /^(?:import \{ [^}]+ \} from '\.\/[^']+';|export \{ [^}]+ \};)\r?$/;
for (const p of files(path.join(ROOT, 'src'))) {
  const rel = path.relative(path.join(ROOT, 'src'), p), q = path.join(T, 'src', rel);
  const a = fs.readFileSync(p, 'utf8').split('\n'), b = fs.readFileSync(q, 'utf8').split('\n');
  if (a.join('\n') === b.join('\n')) continue;
  // the module block: the lines at the end that are imports and exports
  let k = b.length - (b[b.length - 1] === '' ? 1 : 0);
  while (k > 0 && BLOCK.test(b[k - 1])) k--;
  const body = b.slice(0, k), orig = a.filter((l) => !/^if \(typeof module !== 'undefined'/.test(l));
  const diff = body.map((l, i) => (l === orig[i] ? null : i + 1)).filter(Boolean);
  // (the UMD header's lines change in place, nothing else does)
  const umd = /(?:^|\n)\(function \(root, factory\) \{/.test(a.join('\n'));
  ok(`${rel}: the lines above the module block are the file's own (${diff.length} changed${umd ? ', its UMD header' : ''})`, body.length === orig.length - (orig[orig.length - 1] === '' && body[body.length - 1] !== '' ? 1 : 0) || body.length === orig.length, { body: body.length, orig: orig.length });
  ok(`${rel}: only the UMD header changes in place`, umd ? diff.length > 0 && diff.length <= 5 && diff[diff.length - 1] - diff[0] < 5 : diff.length === 0, diff.slice(0, 5));
}
// every module of the build parses as a module (the joined text of a split file)
const { source } = require(path.join(T, 'test', 'src_text.js'));
for (const f of [...buildOrder(), 'main.js', 'expose.js']) {
  let text = null;
  try { text = source(f, path.join(T, 'src')); acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module' }); ok(`${f} parses as a module`, true); } catch (e) { ok(`${f} parses as a module`, false, String(e.message)); }
}
// 3. require() of each file the node tests load: it loads by itself now (its imports bring what the tests used to set
// as globals first) and gives the same names as before wherever the old file loaded by itself
const NODE = ['cx.js', 'parse.js', 'funcs.js', 'region.js', 'recognize.js', 'inverse.js', 'glsl.js', 'curves.js', 'calc.js', 'sphere.js', 'homrange.js', 'view.js', 'seasong.js', 'params.js', 'palette.js', 'tour.js', 'constr.js', 'construct.js'];
const keys = (dir) => {
  const probe = path.join(dir, '..', 'test', 'probe_require.js');
  fs.writeFileSync(probe, `const out = {}; for (const f of ${JSON.stringify(NODE)}) { try { const m = require(${JSON.stringify(dir)} + '/' + f); out[f] = Object.keys(m).sort(); } catch (e) { out[f] = 'ERROR ' + e.message.split('\\n')[0]; } } console.log(JSON.stringify(out));`);
  try { return JSON.parse(run(['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', probe]).out.trim().split('\n').pop()); } finally { fs.rmSync(probe); }
};
fs.mkdirSync(path.join(T, 'orig', 'test'), { recursive: true });
fs.cpSync(path.join(ROOT, 'src'), path.join(T, 'orig', 'src'), { recursive: true });
const cjsKind = Object.fromEntries(NODE.map((f) => [f, (/module\.exports = (\{[^}]*\}|\w+)/.exec(fs.readFileSync(path.join(ROOT, 'src', f), 'utf8')) || [])[1] || '']));
const before = keys(path.join(T, 'orig', 'src')), after = keys(path.join(T, 'src'));
for (const f of NODE) {
  ok(`require('${f}') loads by itself`, Array.isArray(after[f]) && after[f].length > 0, after[f]);
  // (a file that gave node { X } now gives every name it exports: X still destructures, the rest is new)
  if (Array.isArray(before[f])) ok(`require('${f}') returns every name it returned before`, before[f].every((k) => after[f].includes(k)) && (after[f].length === before[f].length || /^\{/.test(cjsKind[f] || '')), { before: String(before[f]).slice(0, 80), after: String(after[f]).slice(0, 80) });
}
fs.rmSync(T, { recursive: true, force: true });
console.log(fails ? `${fails} of ${n} checks FAILED` : `all ${n} checks pass`);
process.exit(fails ? 1 : 0);
