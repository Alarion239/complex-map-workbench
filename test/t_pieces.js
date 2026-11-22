// The piece counter (src/pieces.js; #1981, the Stack's P0c): the pieces and holes of the preimage of a target disc
// |w − c| < r, read from the roots followed once round the rim (a counter-clockwise loop is a piece, a clockwise one a
// hole), never from anything drawn: this test draws nothing. The plan's maps M1 z², M2 Joukowski, M3 z³ − 1.2z + 0.3
// and M4 z → z² → w₁² − 1, at radii on both sides of each join radius (Critical.joinRadii), M2's hole at r = 1.70 and
// M4's 2 pieces on w₁ and 4 on z; a rim through a critical value and a chain with infinitely many preimages are not
// counted, with the reason.
// Run: node test/t_pieces.js   (exit code 1 on any failure)
global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
global.Funcs = require('../src/funcs.js');
const C = CX.C, abs = CX.abs, sub = CX.sub;
let bad = 0, n = 0;
const check = (name, ok, info = '') => { n++; if (!ok) { bad++; console.log('FAIL', name, typeof info === 'string' ? info : JSON.stringify(info).slice(0, 400)); } };
let Pieces = null;
try { Pieces = require('../src/pieces.js'); } catch (e) { Pieces = null; }
check('src/pieces.js loads', !!Pieces && typeof Pieces.count === 'function');
const St = (type, params = {}) => ({ type, params: Object.assign(Funcs.defaults(type), params), on: true });
const M1 = [St('pown', { n: 2 })], M2 = [St('joukowski')], M3 = [St('custom', { expr: 'z^3-1.2z+0.3' })], M4 = [St('pown', { n: 2 }), St('custom', { expr: 'z^2-1' })];
const s4 = Math.sqrt(0.4);
// (a loop's points lie on the rim to RIM_TOL)
const RIM_TOL = 1e-8;
function count(steps, c, r, a = 0) {
  return Pieces ? Pieces.count(steps, steps.map((st) => Funcs.build(st)), a, steps.length, c, r) : { counted: false, reason: 'no Pieces' };
}
const covers = (p) => p.pieces.map((P) => P.covers).sort((x, y) => x - y);
// pieces: how many times each piece covers the disc (sorted), holes: in all
function expect(name, steps, c, r, want, a = 0) {
  const p = count(steps, c, r, a);
  check(`${name}, r = ${r}: counted`, p.counted, p.reason);
  if (!p.counted) return p;
  check(`${name}, r = ${r}: ${want.pieces.length} piece(s) covering [${want.pieces}] times, ${want.holes} hole(s)`,
    JSON.stringify(covers(p)) === JSON.stringify(want.pieces) && p.holes === want.holes, { covers: covers(p), holes: p.holes, loops: p.loops.map((L) => [L.k, L.ccw]) });
  check(`${name}, r = ${r}: ${want.roots} preimages of the centre, each in a piece`, p.roots.reduce((s, e) => s + e.mult, 0) === want.roots && p.roots.every((e) => e.piece >= 0), p.roots);
  // every loop lies on the rim: F(z) at distance r from c
  const bs = steps.map((st) => Funcs.build(st)), F = (z) => bs.slice(a).reduce((u, b) => b.f(u), z);
  const off = Math.max(...p.loops.flatMap((L) => L.path.map((z) => Math.abs(abs(sub(F(z), c)) - r))));
  check(`${name}, r = ${r}: every loop on the rim`, off <= RIM_TOL * (1 + r), off);
  check(`${name}, r = ${r}: the join radii below r`, p.joins.length === (want.joins || 0) && p.joins.every((e) => e.r < r), p.joins);
  return p;
}

// M1 z², c = 1: the pieces about ±1 join at r = 1 (the critical value 0)
expect('M1', M1, C(1), 0.5, { pieces: [1, 1], holes: 0, roots: 2 });
expect('M1', M1, C(1), 0.99, { pieces: [1, 1], holes: 0, roots: 2 });
expect('M1', M1, C(1), 1.01, { pieces: [2], holes: 0, roots: 2, joins: 1 });
// M2 Joukowski, c = 0.6 + 0.5i: join at 0.64 (the critical value 1); past 1.676 (the critical value −1) a hole (about
// the pole 0)
expect('M2', M2, C(0.6, 0.5), 0.5, { pieces: [1, 1], holes: 0, roots: 2 });
expect('M2', M2, C(0.6, 0.5), 0.63, { pieces: [1, 1], holes: 0, roots: 2 });
expect('M2', M2, C(0.6, 0.5), 0.65, { pieces: [2], holes: 0, roots: 2, joins: 1 });
expect('M2', M2, C(0.6, 0.5), 1.6, { pieces: [2], holes: 0, roots: 2, joins: 1 });
{
  const p = expect('M2', M2, C(0.6, 0.5), 1.7, { pieces: [2], holes: 1, roots: 2, joins: 2 });
  // (the hole is about the pole 0: its loop goes round 0 clockwise)
  const hole = p.counted ? p.loops.find((L) => !L.ccw) : null;
  check('M2, r = 1.7: one piece with a hole, the hole about the pole 0', !!hole && p.pieces.length === 1 && p.pieces[0].holes === 1, p.counted && p.loops.map((L) => [L.k, L.ccw]));
}
// M3, c = 1.1: 3 pieces until 0.294 (the critical value 0.806 = f(−√0.4)), then 2, one covering twice about −√0.4;
// one from 1.306 (the critical value −0.206)
expect('M3', M3, C(1.1), 0.25, { pieces: [1, 1, 1], holes: 0, roots: 3 });
expect('M3', M3, C(1.1), 0.29, { pieces: [1, 1, 1], holes: 0, roots: 3 });
{
  const p = expect('M3', M3, C(1.1), 0.35, { pieces: [1, 2], holes: 0, roots: 3, joins: 1 });
  const two = p.counted ? p.pieces.findIndex((P) => P.covers === 2) : -1;
  const its = two >= 0 ? p.roots.filter((e) => e.piece === two) : [];
  check('M3, r = 0.35: the piece covering twice holds z₂ and z₃ (Re < 0), round −√0.4', its.length === 2 && its.every((e) => e.z.re < 0)
    && p.loops[p.pieces[two].loops[0]].path.some((z) => z.re < -s4) && p.loops[p.pieces[two].loops[0]].path.some((z) => z.re > -s4), its);
}
expect('M3', M3, C(1.1), 1.3, { pieces: [1, 2], holes: 0, roots: 3, joins: 1 });
expect('M3', M3, C(1.1), 1.31, { pieces: [3], holes: 0, roots: 3, joins: 2 });
// M4, c = 0.5 + 0.5i, r = 0.2: 2 pieces on w₁ (stages 1..2), 4 on z; they all join at 1.58 (the critical value −1)
expect('M4 on z', M4, C(0.5, 0.5), 0.2, { pieces: [1, 1, 1, 1], holes: 0, roots: 4 });
expect('M4 on w₁', M4, C(0.5, 0.5), 0.2, { pieces: [1, 1], holes: 0, roots: 2 }, 1);
expect('M4 on z', M4, C(0.5, 0.5), 1.5, { pieces: [1, 1, 1, 1], holes: 0, roots: 4 });
expect('M4 on z', M4, C(0.5, 0.5), 1.6, { pieces: [4], holes: 0, roots: 4, joins: 1 });

// 1/z about 0: the preimage is |z| > 1/r and infinity, one unbounded piece with a hole; the centre's preimage is ∞
{
  const p = count([St('recip')], C(0), 0.5);
  check('1/z, |w| < 0.5: one unbounded piece with one hole, the centre\'s preimage at infinity', p.counted && p.pieces.length === 1 && p.pieces[0].unbounded && p.holes === 1
    && p.roots.length === 1 && p.roots[0].z === null, p);
}
// not counted: a rim through a critical value, a chain with infinitely many preimages, a step with no inverse
for (const [name, steps, c, r] of [['M1 at r = 1 (through 0)', M1, C(1), 1], ['M3 at r = 1.1 − f(−√0.4)', M3, C(1.1), 1.1 - (0.3 + 0.8 * s4)], ['exp', [St('exp')], C(1), 0.5], ['Γ', [St('gamma')], C(1), 0.5]]) {
  const p = count(steps, c, r);
  check(`${name}: not counted, with the reason`, !!Pieces && !p.counted && typeof p.reason === 'string' && p.reason.length > 0, p);
}
console.log(bad ? `${bad} of ${n} checks fail` : `all ${n} checks pass`);
process.exit(bad ? 1 : 0);
