// v16.5 rail (notes/ux-build/rail/SPEC.md 5.1): refKey, samePick's keys, gridStep, railPull, the turn-exact glide and
// its detents, the perpendicular circle through two gliders on one circle (orthogonal, through both; antipodes: the
// diameter), circle3 and touch with picks on C. Run: node test/t_ux165_rail.js
'use strict';
const path = require('path');
global.self = global;
const C = require(path.join(__dirname, '..', 'src', 'constr.js'));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const near = (a, b, e = 1e-12) => Math.abs(a - b) <= e;

// ---- refKey
const m1 = { meet: [{ s: 'a', part: 0 }, { s: 'b', part: 0 }], index: 0 };
const m2 = { meet: [{ s: 'a', part: 0 }, { s: 'b', part: 0 }], index: 1 };
const m1b = { meet: [{ s: 'b', part: 0 }, { s: 'a', part: 0 }], index: 0 };
ok(C.refKey(m1) !== C.refKey(m2), 'two crossings of one pair differ');
ok(C.refKey(m1) === C.refKey(m1b), 'the same crossing, either order, is one key');
ok(!/undefined/.test(C.refKey(m1)), 'a meet key is never s:undefined: ' + C.refKey(m1));
ok(C.refKey({ meet: [{ s: 'a', part: 0 }, { s: 'c', part: 1 }], seed: [0.1, 0.2] }) !== C.refKey({ meet: [{ s: 'a', part: 0 }, { s: 'c', part: 1 }], seed: [0.3, 0.2] }), 'seeded crossings differ by seed');
ok(C.refKey({ pend: 0 }) === 'pend:0' && C.refKey({ pend: 1 }) === 'pend:1', 'pending pick keys');
ok(C.refKey({ meet: [{ disp: 'unit' }, { s: 'a', part: 0 }], index: 0 }) === 'm:c:a:0|d:unit:0', 'a crossing with a display curve');
ok(C.refKey({ s: 'z0' }) === C.refKey({ s: 'z0' }), 'an existing point twice is one key');

// ---- gridStep: one of the drawn tiers, >= 14 px
for (const [s, want] of [[52, 0.5], [520, 0.05], [5.2, 5], [14, 1], [28, 0.5], [100, 0.5], [1000, 0.05], [2.6, 10]]) ok(C.gridStep(s) === want, `gridStep(${s}) = ${C.gridStep(s)}, want ${want}`);
for (let s = 0.5; s < 20000; s *= 1.37) {
  const st = C.gridStep(s), d0 = Math.pow(10, Math.ceil(Math.log10(8 / s)));
  ok(st * s >= 14 - 1e-9, `gridStep(${s}) at least 14 px`);
  ok(C.GRID_TIERS.some((m) => near(st, +(d0 * m).toPrecision(12), 1e-15 * st)), `gridStep(${s}) is a drawn tier`);
}

// ---- railPull
const P = C.railPull, R = C.RAIL;
ok(P(null, 15.9, 0, false).zone === 'glide' && P(null, 16, 0, false).zone === 'stretch', 'mouse glide/stretch at 16');
ok(P(null, 23.9, 0, true).zone === 'glide' && P(null, 24, 0, true).zone === 'stretch', 'touch glide/stretch at 24');
ok(P(null, 79.9, 0, false).zone === 'stretch' && P(null, 80, 0, false).zone === 'free', 'mouse yank at 80');
ok(P(null, 127, 0, true).zone === 'stretch' && P(null, 128, 0, true).zone === 'free', 'touch yank at 128');
{
  // 40 px for 100 ms, then back: no let-go
  let st = null, z;
  for (let t = 0; t <= 100; t += 16) { z = P(st, 40, t, false); st = z.state; ok(z.zone === 'stretch', '40 px held ' + t + ' ms still stretch'); }
  z = P(st, 30, 116, false); st = z.state; ok(z.zone === 'stretch' && st === null, 'back under 40: the dwell resets');
  z = P(st, 40, 140, false); st = z.state; ok(z.zone === 'stretch', 'a new run starts its own dwell');
  // 40 px for 130 ms: let go
  st = null; let freed = -1;
  for (let t = 0; t <= 130; t += 10) { z = P(st, 41, t, false); st = z.state; if (z.zone === 'free' && freed < 0) freed = t; }
  ok(freed === 120, '40 px held 130 ms frees (at ' + freed + ' ms)');
  // touch: 64 for 120 ms
  st = null; for (let t = 0; t < 120; t += 16) { z = P(st, 64, t, true); st = z.state; ok(z.zone === 'stretch', 'touch 64 px before the dwell'); }
  z = P(st, 64, 121, true); ok(z.zone === 'free', 'touch 64 px held 121 ms frees');
  ok(R.dwell === 120 && R.mouse.free === 40 && R.touch.free === 64, 'the RAIL table');
}

// ---- the turn-exact glide on a plain circle
const unit = { id: 'u', kind: 'circle', c: [0, 0], r: 1, ci: 0, visible: true };
const pu = C.pieces(unit, {})[0];
const eq2 = (a, b) => a[0] === b[0] && a[1] === b[1] && Object.is(a[0] + 0, b[0] + 0);
ok(eq2(C.glide(pu, 0.25), [0, 1]), 'unit circle t = 1/4 is i bitwise: ' + C.glide(pu, 0.25));
ok(eq2(C.glide(pu, 0.5), [-1, 0]) && eq2(C.glide(pu, 0.75), [0, -1]) && eq2(C.glide(pu, 0), [1, 0]) && eq2(C.glide(pu, 1), [1, 0]), 'the quarter turns exact');
for (let k = 0; k < 24; k++) {
  const a = C.glide(pu, k / 24);
  ok(near(Math.hypot(a[0], a[1]), 1, 3e-16), 'on the circle');
  ok(near(a[0], Math.cos(2 * Math.PI * k / 24), 2e-15) && near(a[1], Math.sin(2 * Math.PI * k / 24), 2e-15), 'within a few ulp of cos/sin');
}
// t and t + 1/2 whose difference is exact (dyadic t): bitwise antipodes
for (const t of [0.125, 0.0625, 0.3125, 0.1875, 0.375]) { const a = C.glide(pu, t), b = C.glide(pu, t + 0.5); ok(a[0] === -b[0] && a[1] === -b[1], 'bitwise antipodes at ' + t); }
// projectPiece: 89 degrees -> about 1/4 (the detent itself is the interface's; here the parameter and the glide agree)
{
  const pr = C.projectPiece(pu, [Math.cos(89 * Math.PI / 180) * 1.01, Math.sin(89 * Math.PI / 180) * 1.01]);
  ok(near(pr.t, 89 / 360, 1e-12), 'projection 89 deg -> t = 89/360');
}

// ---- the perpendicular circle through two gliders on one circle
function scene(circ, ts, extra) {
  const st = { shapes: [Object.assign({ id: 'u', ci: 0, visible: true }, circ),
    ...ts.map((t, i) => ({ id: 'g' + i, kind: 'point', p: [0, 0], t, def: { op: 'glider', args: [{ s: 'u', part: 0 }] } })),
    ...(extra || [])], targets: [], steps: [] };
  C.recompute(st, { all: true }, {});
  return st;
}
const perpK = (circ, ta, tb, flip) => {
  const st = scene(circ, [ta, tb], [{ id: 'K', kind: 'circle', c: [0, 0], r: 1, def: Object.assign({ op: 'perp', args: [{ s: 'u', part: 0 }, { s: 'g0' }, { s: 'g1' }], fill: 'none', nk: 'circle' }, flip != null ? { flip } : {}) }]);
  return { st, K: st.shapes.find((s) => s.id === 'K'), P: st.shapes[1].p, Q: st.shapes[2].p };
};
let seed = 12345;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
for (const circ of [{ kind: 'circle', c: [0, 0], r: 1 }, { kind: 'circle', c: [0.3, 0.2], r: 1.5 }]) {
  for (let i = 0; i < 20; i++) {
    const ta = rnd(), tb = ta + 0.05 + 0.4 * rnd();
    const { K, P, Q } = perpK(circ, ta, tb);
    ok(!K.cundef && (K.kind === 'circle' || K.kind === 'line'), 'K defined ' + JSON.stringify(K.cundef));
    if (K.kind === 'circle') {
      const dc = Math.hypot(K.c[0] - circ.c[0], K.c[1] - circ.c[1]);
      const cos = (dc * dc - K.r * K.r - circ.r * circ.r) / (2 * K.r * circ.r);
      ok(Math.abs(cos) <= 1e-12 * Math.max(1, dc * dc / (K.r * circ.r)), `orthogonal |cos| = ${cos}`);
      ok(near(Math.hypot(P[0] - K.c[0], P[1] - K.c[1]), K.r, 1e-12 * Math.max(1, K.r)) && near(Math.hypot(Q[0] - K.c[0], Q[1] - K.c[1]), K.r, 1e-12 * Math.max(1, K.r)), 'through P and Q');
    }
  }
  for (const k of [0, 1, 5, 7, 11, 13, 20]) {
    const { K, P } = perpK(circ, k / 24, (k + 12) / 24);
    ok(K.kind === 'line' && K._g && K._g.A === 0, `k/24 and (k+12)/24 -> a line (A = 0) on c = ${circ.c} (k = ${k}): ${K.kind} A=${K._g && K._g.A}`);
    if (K._g) {
      const f = (z) => 2 * (K._g.B[0] * (z[0] - K._g.o[0]) + K._g.B[1] * (z[1] - K._g.o[1])) + K._g.C;
      ok(Math.abs(f(circ.c)) <= 1e-12 && Math.abs(f(P)) <= 1e-12 * circ.r * 4, 'the line through the centre and P');
    }
  }
  // 1e-6 of a turn off the antipode: a circle (the rule is on the parameters, not a tolerance on geometry)
  const { K: K2 } = perpK(circ, 0.1, 0.6 + 1e-6);
  ok(K2.kind === 'circle' && K2.r > 1e4, 'a pair 1e-6 turn off antipodal is a (huge) circle: ' + K2.kind + ' r=' + K2.r);
}
// the line keeps its side across the switch: the half-plane to the left of P -> Q, as the circle it is the limit of
{
  // (a K made before, its flip fixed: a glider dragged onto the antipode turns the near circle into the line, same normal)
  for (const k of [1, 13, 7]) for (const fl of [false, true]) {
    const a = perpK({ kind: 'circle', c: [0.3, 0.2], r: 1.5 }, k / 24, (k + 12) / 24, fl).K, b = perpK({ kind: 'circle', c: [0.3, 0.2], r: 1.5 }, k / 24, (k + 12) / 24 - 1e-9, fl).K, c = perpK({ kind: 'circle', c: [0.3, 0.2], r: 1.5 }, k / 24, (k + 12) / 24 + 1e-9, fl).K;
    const n = a._g.B, nb = b._g.B, nc = c._g.B;
    ok(a._g.A === 0 && n[0] * nb[0] + n[1] * nb[1] > 0.999 && n[0] * nc[0] + n[1] * nc[1] > 0.999, 'the diameter continues the near-antipodal circles (k = ' + k + ', flip ' + fl + ')');
  }
}
// ---- circle3 of three gliders on one circle: that circle; touch with T and P on C: C (the model)
{
  const st = scene({ kind: 'circle', c: [0, 0], r: 1 }, [0.1, 0.35, 0.8], [{ id: 'K3', kind: 'circle', c: [0, 0], r: 1, def: { op: 'circle3', args: [{ s: 'g0' }, { s: 'g1' }, { s: 'g2' }], fill: 'none' } }]);
  const K3 = st.shapes.find((s) => s.id === 'K3');
  ok(!K3.cundef && near(K3.r, 1, 1e-14) && near(K3.c[0], 0, 1e-14) && near(K3.c[1], 0, 1e-14), 'circle3 of three gliders on the unit circle is the unit circle: ' + K3.c + ' ' + K3.r);
  const st2 = scene({ kind: 'circle', c: [0, 0], r: 1 }, [0.1, 0.35], [{ id: 'T', kind: 'circle', c: [0, 0], r: 1, def: { op: 'touch', args: [{ s: 'u', part: 0 }, { s: 'g0' }, { s: 'g1' }], fill: 'none', nk: 'circle' } }]);
  const T = st2.shapes.find((s) => s.id === 'T');
  ok(!T.cundef && near(T.r, 1, 1e-12), 'touch with T and P on C is C itself');
}
console.log(`t_ux165_rail: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
