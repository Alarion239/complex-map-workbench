// The NEWT kit's evaluation sites of the homotopy H (#1365): a shader compiler inlines every call, so a program's size, its
// link time and its first draw follow the number of places that evaluate H once every call is inlined, not the number of
// H( in the text. For each kind of NEWT op the kit builds (a plain one, one with a pole member, a seeded one, the
// Douady-Hubbard map's and the Böttcher coordinate's: seeded, landed down the external ray, with the dual derivative,
// and a polynomial one), at t = 0.3 and 0.7, this counts the H evaluations reached from one invocation of the inverse
// program's member function (_one_b) and from the NEWT roots pass's main, every call site counted with its callee's
// count. H is the chain's homotopy (chainHom, chainHomD, a recognised sub-step's cxs<step>r<j>_h) or a polynomial op's
// own polynomial (_poly). The bounds are named below. The Newton step and the stepper each have one call site: _step in
// _run, _run in _roots and in the roots pass's main (a polynomial op's pass runs _roots). Controls: a second _run call
// site in either raises the count past its bound.
// Run: node test/t_newt_sites.js
global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
global.Funcs = require('../src/funcs.js');
global.Region = require('../src/region.js');
require('../src/recognize.js');
const Inverse = require('../src/inverse.js');
const GLChain = require('../src/glsl.js');
let bad = 0, n = 0;
const check = (name, ok, info = '') => { n++; if (!ok) { bad++; console.log('FAIL', name, info); } };

// H evaluations per member function of a NEWT op with a forward-difference step: _run's _step 2 (H and the forward
// difference _fd) + _run's _hit 1 + the members' derivative _d 2 (a central difference); its roots pass: _step 2 + _hit 1
const NEWT_H_SITES = 5, NEWT_H_SITES_PASS = 3;
// a dual op (the step writes H' with H): _step 1 + _hit 1 + _d 1; its roots pass: _step 1 + _hit 1
const NEWT_H_SITES_DUAL = 3, NEWT_H_SITES_DUAL_PASS = 2;
// a polynomial op: _run 3 + _d 2 + the stored roots' _hit 1; its roots pass: _run 3 + the stored roots' _hit 1 (the count
// reads the text, which holds the stored roots' check under #if, compiled only in the inverse program)
const NEWT_H_SITES_POLY = 6, NEWT_H_SITES_POLY_PASS = 4;
const TS = [0.3, 0.7];
const St = (type, params = {}) => ({ type, params: Object.assign(Funcs.defaults(type), params), on: true });
// [name, step, kind of its NEWT op, bound, roots pass's bound]
// (the polynomial op of degree 5: degrees 3 and 4 are the closed forms' RAT3 and RAT4 ops, with no NEWT op)
const CASES = [
  ['plain', St('series'), 'plain', NEWT_H_SITES, NEWT_H_SITES_PASS],
  ['pole', St('zeta'), 'pole', NEWT_H_SITES, NEWT_H_SITES_PASS],
  ['seeded', St('ijouk'), 'seeded', NEWT_H_SITES, NEWT_H_SITES_PASS],
  ['dh', St('dh'), 'seeded ray dual', NEWT_H_SITES_DUAL, NEWT_H_SITES_DUAL_PASS],
  ['bottcher', St('bottcher'), 'seeded ray dual', NEWT_H_SITES_DUAL, NEWT_H_SITES_DUAL_PASS],
  ['polynomial', St('poly', { co: '1, 0, 0, 0, -2, 1' }), 'polynomial', NEWT_H_SITES_POLY, NEWT_H_SITES_POLY_PASS],
];
const H_CALL = /\b(?:chainHomD?|cxs\d+r\d+_h|ix\d+_poly)\(/g;

const sites = (s, re) => (s.match(re) || []).length;
// the bodies of the GLSL functions of prefix P (the NEWT op's, where every H evaluation is) and main defined in src, by
// name (from the brace after the signature to its match)
const bodies = (src, P) => {
  const out = {}, re = new RegExp(`^(?:bool|void|vec2|int|float) (${P}_\\w+|main)\\([^)]*\\)\\s*\\{`, 'gm');
  let m;
  while ((m = re.exec(src))) {
    let d = 1, j = re.lastIndex;
    while (d && j < src.length) { const c = src[j++]; if (c === '{') d++; else if (c === '}') d--; }
    out[m[1]] = src.slice(re.lastIndex, j);
  }
  return out;
};
// the H evaluations reached from function name of src: its own H calls plus, per call site, its callee's
const reach = (src, P, name) => {
  const fns = bodies(src, P), memo = {};
  const cnt = (f, stack) => {
    if (memo[f] != null) return memo[f];
    if (stack.includes(f)) throw new Error('recursion at ' + f);
    const b = fns[f] || '';
    let c = (b.match(H_CALL) || []).length;
    for (const k of Object.keys(fns)) {
      const calls = k === f ? 0 : sites(b, new RegExp(`\\b${k}\\(`, 'g'));
      if (calls) c += calls * cnt(k, stack.concat(f));
    }
    return (memo[f] = c);
  };
  return cnt(name, []);
};
// the inverse program of step at t: its library, its roots pass's main, its NEWT op's prefix and kind
function program(step, t) {
  const b = Funcs.build(step), h = Inverse.homOps(b, t), inv = GLChain.buildInverse([step], [Inverse.homBuilt(b, h)]);
  const op = h.ok && h.ops.find((q) => q.kind === 'NEWT'), p = (op && op.p) || {}, back = p.back || [];
  const kind = p.deg ? 'polynomial' : p.back ? ['seeded', back.some((q) => q.ray) && 'ray', back.some((q) => q.dual) && 'dual'].filter(Boolean).join(' ') : p.pole ? 'pole' : 'plain';
  const q = inv.ok && inv.ops.find((x) => x.kind === 'NEWT');
  return { ok: !!(inv.ok && inv.nr && q && h.ops.filter((x) => x.kind === 'NEWT').length === 1), lib: inv.lib, main: inv.nr && inv.nr.main, P: q ? `ix${q.j}` : '', kind };
}

const rows = [];
for (const [name, step, kind, bound, boundPass] of CASES) {
  for (const t of TS) {
    const tag = `${name} at t = ${t}`, L = program(step, t);
    check(`${tag}: one NEWT op, a ${kind} one, with a roots pass`, L.ok && L.kind === kind, { ok: L.ok, kind: L.kind });
    if (!L.ok) continue;
    const pass = L.lib + L.main, P = L.P;
    const prog = reach(L.lib, P, `${P}_one_b`), nr = reach(pass, P, 'main');
    rows.push(`${tag}: member function ${prog}, roots pass ${nr} H evaluations (bounds ${bound}, ${boundPass})`);
    check(`${tag}: the member function reaches at most ${bound} H evaluations (reaches ${prog})`, prog <= bound, prog);
    check(`${tag}: the roots pass reaches at most ${boundPass} H evaluations (reaches ${nr})`, nr <= boundPass, nr);
    const fns = bodies(pass, P), call = (f) => new RegExp(`\\b${P}_${f}\\(`, 'g');
    const where = (f) => Object.keys(fns).filter((k) => sites(fns[k], call(f))).map((k) => `${k} ${sites(fns[k], call(f))}`).join(', ');
    check(`${tag}: the Newton step has one call site, in _run`, where('step') === `${P}_run 1`, where('step'));
    // (a polynomial op's roots pass runs _roots, Aberth's, the others' their own main)
    const poly = kind === 'polynomial';
    check(`${tag}: the stepper has one call site in _roots${poly ? '' : ' and one in the roots pass\'s main'}`, where('run') === `${P}_roots 1${poly ? '' : ', main 1'}`, where('run'));
    // controls: a second _run call site shows in the count, past the bound
    const dup = (s) => s.replace(new RegExp(`^(?!bool )(.*\\b${P}_run\\(.*)$`, 'm'), '$1\n$1');
    const lib2 = dup(L.lib), more = reach(lib2, P, `${P}_one_b`);
    check(`${tag}: a second _run call site in _roots is counted (reaches ${more}, past ${bound})`, lib2 !== L.lib && more > bound, more);
    const pass2 = poly ? lib2 + L.main : L.lib + dup(L.main), moreNr = reach(pass2, P, 'main');
    check(`${tag}: a second _run call site in the roots pass is counted (reaches ${moreNr}, past ${boundPass})`, pass2 !== pass && moreNr > boundPass, moreNr);
  }
}
console.log(rows.join('\n'));
console.log(`${n} checks, ${bad} failed`);
process.exit(bad ? 1 : 0);
