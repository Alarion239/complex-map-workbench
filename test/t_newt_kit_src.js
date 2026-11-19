// The NEWT kit's GLSL for chains with no ray, dual or single NEWT op is the integration branch's byte for byte (#1339):
// the external ray's stage, the dual derivative and the one-member exit change the program only for an op that carries
// them. For each chain of CHAINS at each t of TS, the inverse program of the glide's frame (the steps' homotopies at t,
// Inverse.homBuilt of Inverse.homOps, as the steps view builds it) is hashed: its library, its walker and its NEWT roots
// pass's main. The hashes were recorded from the integration branch at 273a9460 (test/fixtures/newt_kit_src.json, written by
// this file with --write). The chains cover every kind of NEWT op the kit builds: a polynomial one (Aberth), a seeded one
// (back ops: the inverse Joukowski map), one with a pole member (zeta) and a generic one; the run fails if a kind is missing.
// The Douady-Hubbard map and the Böttcher coordinate are left out: their NEWT ops are the ones that carry the ray.
// Run: node test/t_newt_kit_src.js [--write]
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.join(__dirname, '..');
global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
global.Funcs = require('../src/funcs.js');
global.Region = require('../src/region.js');
require('../src/recognize.js');
const Inverse = require('../src/inverse.js');
const GLChain = require('../src/glsl.js');
const FIXTURE = path.join(__dirname, 'fixtures', 'newt_kit_src.json');
const WRITE = process.argv.includes('--write');
let bad = 0, n = 0;
const check = (name, ok, info = '') => { n++; if (!ok) { bad++; console.log('FAIL', name, info); } };
const St = (type, params = {}) => ({ type, params: Object.assign(Funcs.defaults(type), params), on: true });
const custom = (expr) => St('custom', { expr, cut: 180 });
// [name, steps]
const CHAINS = [
  ['cubic', [custom('z^3-2z+1')]],
  ['quartic', [custom('z^4+z')]],
  ['gamma+1', [custom('gamma(z)+1')]],
  ['sinz/z', [custom('sin(z)/z')]],
  ['cos^2', [custom('cos(z)^2')]],
  ['2cos+1', [custom('2cos(z)+1')]],
  ['z+1/(z-0.5)', [custom('z+1/(z-0.5)')]],
  ['exp(sinz)', [custom('exp(sin(z))')]],
  ['cos', [St('cos')]],
  ['exp,cos', [St('exp'), St('cos')]],
  ['ijouk', [St('ijouk')]],
  ['zeta', [St('zeta')]],
];
const TS = [0.3, 0.7];
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const out = {}, kinds = new Set();
for (const [name, steps] of CHAINS) {
  const built = steps.map(Funcs.build);
  for (const t of TS) {
    const hb = built.map((b) => { const h = Inverse.homOps(b, t); return h.ok ? Inverse.homBuilt(b, h) : b; });
    const newt = hb.flatMap((b) => { const so = Inverse.stepOps(b); return so.ok ? so.ops : []; }).filter((o) => o.kind === 'NEWT');
    for (const o of newt) {
      const p = o.p || {};
      kinds.add(p.deg ? 'poly' : p.back ? 'seeded' : p.pole ? 'pole' : 'generic');
      check(`${name} at t = ${t}: no ray, dual or single op (the chains this file pins)`, !(p.back || []).some((q) => q.ray || q.dual || q.single));
    }
    const inv = GLChain.buildInverse(steps, hb);
    const key = `${name} @ ${t}`;
    out[key] = { newt: newt.length, src: inv.ok ? sha(inv.lib + '\n--walker--\n' + inv.walker + '\n--nr--\n' + (inv.nr ? inv.nr.main : '')) : 'not ok: ' + inv.reason };
  }
}
for (const k of ['poly', 'seeded', 'pole', 'generic']) check(`the chains include a ${k} NEWT op`, kinds.has(k), [...kinds].join());
if (WRITE) {
  fs.writeFileSync(FIXTURE, JSON.stringify(out, null, 1) + '\n');
  console.log(`wrote ${Object.keys(out).length} programs to ${path.relative(root, FIXTURE)}`);
} else {
  const want = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  for (const [k, v] of Object.entries(want)) check(`${k}: the inverse program's source is the integration branch's`, out[k] && out[k].src === v.src && out[k].newt === v.newt, JSON.stringify({ want: v, got: out[k] }));
  check('every recorded program was built', Object.keys(want).every((k) => k in out) && Object.keys(out).length === Object.keys(want).length);
}
console.log(`${n} checks, ${bad} failed`);
process.exit(bad ? 1 : 0);
