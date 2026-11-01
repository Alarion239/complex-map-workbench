// (#547 follow-up) A command file runs in the CDP daemon as the body of an async function whose parameters are the kit's
// helpers (test/cdp_kit/cdpd.js: every H.<name>, passed as Object.keys(H)). A command file that declares one of those
// names itself (const go, const settled, ...) throws "Identifier ... has already been declared" before its first check.
// Each test/**/*_cmd.js is compiled here the way the daemon compiles it (not run), with the names read from cdpd.js, so a
// new helper in the kit or a new local in a suite that collide fail here and not on a CI shard.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const check = (name, ok, detail) => { if (ok) pass++; else { fail++; console.log('FAIL ' + name + (detail ? ': ' + detail : '')); } };
const src = fs.readFileSync(path.join(ROOT, 'test', 'cdp_kit', 'cdpd.js'), 'utf8');
const names = [...new Set([...src.matchAll(/\bH\.([A-Za-z_$][\w$]*)\s*=(?!=)/g)].map((m) => m[1]))];
check('the kit names read from cdpd.js (ev, go, settled among them)', ['ev', 'go', 'settled', 'sleep'].every((n) => names.includes(n)), names.join(', '));
check('cdpd.js still passes the kit as the parameters, Object.keys(H)', /constructor\)\(\.\.\.Object\.keys\(H\), body\)/.test(src));
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const files = [];
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.isDirectory()) { if (!['ci_cdp', 'node_modules'].includes(e.name)) walk(path.join(d, e.name)); } else if (/_cmd\.js$/.test(e.name)) files.push(path.join(d, e.name)); } };
walk(path.join(ROOT, 'test'));
check('command files found', files.length > 50, files.length);
for (const f of files) {
  let err = null;
  try { new AsyncFunction(...names, fs.readFileSync(f, 'utf8')); } catch (e) { err = e; }
  check(`${path.relative(ROOT, f)}: compiles with the kit's names as parameters`, !err, err && err.message);
}
// (the check itself: a body that declares a kit name is caught)
let caught = false;
try { new AsyncFunction(...names, 'const go = 1; return go;'); } catch (e) { caught = /already been declared/.test(e.message); }
check('a body declaring a kit name is caught', caught);
console.log(`t_kit_names: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
