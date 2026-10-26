// The critic's checks of the perpendicular circle (SPEC.md), on proto/constr.js (patch.js). Run after patch.js:
//   node notes/orthogonal-circle/proto/check.js
// Exactness is measured as in ../exp.js: cos of the angle between K and C from the float coefficients, in BigInt.
'use strict';
const path = require('path');
const K = require(path.join(__dirname, 'constr.js'));
const K161 = require(path.join(__dirname, '../../v16.1-candidate/src/constr.js'));
const INF = K.INF, isInf = K.isInf;
let pass = 0, fail = 0;
const ok = (c, msg, extra) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + msg + (extra !== undefined ? ' ' + JSON.stringify(extra) : '')); };
const f1 = (x) => (x === 0 ? '0' : Number(x).toExponential(1));

// ------------------------------------------------ exact measures (as exp.js)
const F64 = new Float64Array(1), U32 = new Uint32Array(F64.buffer);
function D(x) { if (x === 0) return { m: 0n, e: 0 }; F64[0] = x; const lo = U32[0], hi = U32[1], ex = (hi >>> 20) & 0x7ff; let m = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo), e; if (ex === 0) e = -1074; else { m |= 1n << 52n; e = ex - 1075; } return { m: hi >>> 31 ? -m : m, e }; }
const dmul = (a, b) => ({ m: a.m * b.m, e: a.e + b.e });
function dadd(a, b) { if (a.m === 0n) return b; if (b.m === 0n) return a; if (a.e < b.e) [a, b] = [b, a]; return { m: (a.m << BigInt(a.e - b.e)) + b.m, e: b.e }; }
const dsub = (a, b) => dadd(a, { m: -b.m, e: b.e });
function dnum(a) { if (a.m === 0n) return 0; const neg = a.m < 0n, M = neg ? -a.m : a.m, sh = Math.max(0, M.toString(2).length - 60); return (neg ? -1 : 1) * Number(M >> BigInt(sh)) * 2 ** (a.e + sh); }
function dForm(G, o2) {
  const A = D(G.A), Bx = D(G.B[0]), By = D(G.B[1]), C = D(G.C);
  const dx = dsub(D(o2[0]), D(G.o[0])), dy = dsub(D(o2[1]), D(G.o[1]));
  return { A, Bx: dadd(Bx, dmul(A, dx)), By: dadd(By, dmul(A, dy)), C: dadd(dadd(dmul(A, dadd(dmul(dx, dx), dmul(dy, dy))), dmul(D(2), dadd(dmul(Bx, dx), dmul(By, dy)))), C) };
}
function cosAngle(G1, G2) {
  const o = G2.o, a = dForm(G1, o), b = dForm(G2, o);
  const ip = dsub(dadd(dmul(a.Bx, b.Bx), dmul(a.By, b.By)), dmul(D(0.5), dadd(dmul(a.A, b.C), dmul(b.A, a.C))));
  const n1 = dsub(dadd(dmul(a.Bx, a.Bx), dmul(a.By, a.By)), dmul(a.A, a.C)), n2 = dsub(dadd(dmul(b.Bx, b.Bx), dmul(b.By, b.By)), dmul(b.A, b.C));
  return dnum(ip) / Math.sqrt(dnum(n1) * dnum(n2));
}
function distTo(G, z) { if (isInf(z)) return Math.abs(G.A); const a = dForm(G, z); return Math.abs(dnum(a.C)) / (2 * Math.hypot(dnum(a.Bx), dnum(a.By))); }
function inv(G, P) {
  if (isInf(P)) return G.A === 0 ? INF : K.geomOf(G).c;
  const u = [P[0] - G.o[0], P[1] - G.o[1]], f = K.fOf(G, P), g = [G.A * u[0] + G.B[0], G.A * u[1] + G.B[1]], g2 = g[0] * g[0] + g[1] * g[1];
  return g2 > 0 ? [P[0] - f * g[0] / g2, P[1] - f * g[1] / g2] : INF;
}
let seed = 11;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const R = (a, b) => a + (b - a) * rnd();
const circ = (c, r) => ({ A: 1 / r, B: [0, 0], C: -r, o: c.slice() });
const randG = () => (rnd() < 0.7 ? circ([R(-5, 5), R(-5, 5)], R(0.1, 5)) : K.line2([R(-5, 5), R(-5, 5)], [R(-5, 5), R(-5, 5)]));
const randP = () => [R(-6, 6), R(-6, 6)];
const lv = (G, zs) => zs.map((z) => K.fOf(G, z));

console.log('== 1. the core: exactness, incidence, the undefined cases');
{
  let wc = 0, wi = 0, und = 0;
  for (let i = 0; i < 10000; i++) {
    const G = randG(), P = randP(), Q = randP(), r = K.perpForm(G, P, Q);
    if (!r.G) { und++; continue; }
    wc = Math.max(wc, Math.abs(cosAngle(r.G, G)));
    wi = Math.max(wi, distTo(r.G, P) / Math.hypot(P[0] - Q[0], P[1] - Q[1]), distTo(r.G, Q) / Math.hypot(P[0] - Q[0], P[1] - Q[1]));
  }
  ok(wc <= 1e-13 && wi <= 1e-15 && und === 0, `random 10^4: worst |cos| ${f1(wc)}, P and Q off K ${f1(wi)} |PQ|, undefined ${und}`);
  // near C, on C, the centre, near P*, huge and tiny C
  let w2 = 0;
  for (const k of [2, 6, 10, 14, 16]) for (let i = 0; i < 500; i++) {
    const G = randG(), g = K.geomOf(G), t = R(0, 6.28), z = g.line ? [g.p[0] + t * g.d[0], g.p[1] + t * g.d[1]] : [g.c[0] + g.r * Math.cos(t), g.c[1] + g.r * Math.sin(t)];
    const u = [z[0] - G.o[0], z[1] - G.o[1]], n = [G.A * u[0] + G.B[0], G.A * u[1] + G.B[1]], l = Math.hypot(n[0], n[1]), s = rnd() < 0.5 ? 1 : -1;
    const P = [z[0] + s * 10 ** -k * n[0] / l, z[1] + s * 10 ** -k * n[1] / l], r = K.perpForm(G, P, randP());
    w2 = Math.max(w2, r.G ? Math.abs(cosAngle(r.G, G)) : 1);
  }
  ok(w2 <= 1e-14, `P at 1e-2 .. 1e-16 from C, both sides: worst |cos| ${f1(w2)}`);
  let w3 = 0;
  for (const [r, a, b] of [[5, 3, 4], [13, 5, 12], [25, 7, 24]]) for (const P of [[a, b], [-a, b], [b, -a]]) { const G = circ([0, 0], r), g = K.perpForm(G, P, randP()).G; w3 = Math.max(w3, Math.abs(cosAngle(g, G))); }
  ok(w3 <= 1e-15, `P exactly on C (Pythagorean points): worst |cos| ${f1(w3)}`);
  const both = K.perpForm(circ([0, 0], 5), [3, 4], [-4, 3]).G;
  ok(both && Math.abs(cosAngle(both, circ([0, 0], 5))) < 1e-15 && distTo(both, [-4, 3]) < 1e-15, 'P and Q both on C: the geodesic between ideal points');
  let w4 = 0;
  for (const k of [3, 6, 9]) for (let i = 0; i < 300; i++) { const G = randG(), P = randP(), S = inv(G, P); if (isInf(S)) continue; const Q = [S[0] + 10 ** -k * R(-1, 1), S[1] + 10 ** -k * R(-1, 1)], g = K.perpForm(G, P, Q).G; w4 = Math.max(w4, g ? Math.abs(cosAngle(g, G)) : 1); }
  ok(w4 <= 1e-13, `Q at 1e-3 .. 1e-9 from P*: worst |cos| ${f1(w4)}`);
  const cen = K.perpForm(circ([0.7, -1.3], 2), [0.7, -1.3], [2, 3]).G;
  ok(cen && cen.A === 0, 'P exactly at the centre: a line, A = 0 exactly');
  ok(K.perpForm(circ([0, 0], 1), [0.5, 0], [2, 0]).undef === 'pencil' && K.perpForm(K.line2([0, 0], [1, 0]), [0, 1], [0, -1]).undef === 'pencil' && K.perpForm(circ([0, 0], 1), [0.25, 0.25], [2, 2]).undef === 'pencil', 'Q = P* exactly: pencil (unit circle 0.5 / 2, real line i / -i, 0.25(1 + i) / 2(1 + i))');
  ok(K.perpForm(circ([0, 0], 1), [0.3, 0.1], [0.3, 0.1]).undef === 'coincide' && K.perpForm(circ([0, 0], 1), INF, INF).undef === 'lineInf' && K.perpForm(circ([1, 1], 1), [1, 1], INF).undef === 'pencil', 'P = Q: coincide; both INF: lineInf; P at the centre and Q = INF: pencil');
  // huge and tiny C, far C; a C through nearly collinear points
  let w5 = 0;
  for (let i = 0; i < 300; i++) {
    for (const [G, P, Q] of [[circ([0, 1e9], 1e9), randP(), randP()], [circ([1, 1], 1e-6), [1 + R(-1e-5, 1e-5), 1 + R(-1e-5, 1e-5)], [1 + R(-1e-5, 1e-5), 1 + R(-1e-5, 1e-5)]], [circ([1e6, 1e6], 1), [1e6 + R(-2, 2), 1e6 + R(-2, 2)], [1e6 + R(-2, 2), 1e6 + R(-2, 2)]], [K.circle3([-3, 0.1], [3, 0.1 + R(-1, 1) * 1e-9], [R(-2, 2), 0.1]), randP(), randP()]]) {
      const g = K.perpForm(G, P, Q).G; w5 = Math.max(w5, g ? Math.abs(cosAngle(g, G)) : 1);
    }
  }
  ok(w5 <= 1e-14, `C of radius 1e9, 1e-6, far at 1e6(1 + i), a nearly collinear 3-point C: worst |cos| ${f1(w5)}`);
  // tiny and huge coordinates: the common power of two (no overflow / underflow)
  const tiny = K.perpForm(circ([0, 0], 1e-150), [3e-151, 1e-151], [-2e-151, 5e-151]).G, hugeG = K.perpForm(circ([0, 0], 1e150), [3e149, 1e149], [-2e149, 5e149]).G;
  ok(tiny && hugeG && Math.abs(cosAngle(tiny, circ([0, 0], 1e-150))) < 1e-14 && Math.abs(cosAngle(hugeG, circ([0, 0], 1e150))) < 1e-14, 'radius 1e-150 and 1e150: no overflow or underflow');
  // Q = INF
  let w6 = 0;
  for (let i = 0; i < 1000; i++) { const G = randG(), g = K.perpForm(G, randP(), INF).G; w6 = Math.max(w6, g ? Math.abs(cosAngle(g, G)) + (g.A === 0 ? 0 : 1) : 1); }
  ok(w6 <= 1e-14, `Q = INF: the line through P along C's normal: worst |cos| ${f1(w6)}`);
}

console.log('== 2. the anchor swaps keep the oriented curve (P = INF; Q exactly 0)');
{
  // Q exactly 0: anchored there, the same oriented curve as anchored at P (levels agree in sign and size)
  let worst = 0;
  for (let i = 0; i < 2000; i++) {
    const G = randG(), P = randP(), a = K.perpForm(G, P, [0, 0]).G;
    // the same computation anchored at P, by moving 0 off by one ulp and back: compare with Q = [1e-300, 0]
    const b = K.perpForm(G, P, [1e-300, 0]).G;
    if (!a || !b) continue;
    for (const z of [randP(), randP()]) worst = Math.max(worst, Math.abs(K.fOf(a, z) - K.fOf(b, z)) / (1 + Math.abs(K.fOf(b, z))));
  }
  ok(worst < 1e-12, `Q = 0 (anchored at 0, thru0) agrees with Q = 1e-300 (anchored at P): worst level difference ${f1(worst)}`);
  // P = INF: the limit of P -> infinity along a direction, the same orientation
  let flips = 0;
  for (let i = 0; i < 500; i++) {
    const G = randG(), Q = randP(), a = K.perpForm(G, INF, Q).G, b = K.perpForm(G, [1e12 * R(-1, 1), 1e12 * R(-1, 1)], Q).G;
    if (!a || !b) continue;
    // both lines (nearly); compare the normals at Q
    const na = [a.B[0] + a.A * (Q[0] - a.o[0]), a.B[1] + a.A * (Q[1] - a.o[1])], nb = [b.B[0] + b.A * (Q[0] - b.o[0]), b.B[1] + b.A * (Q[1] - b.o[1])];
    if (na[0] * nb[0] + na[1] * nb[1] < 0) flips++;
  }
  ok(flips === 0, `P = INF agrees in orientation with P far away (500 cases; flips ${flips})`);
}

console.log('== 3. orientation against circle3(P, Q, P*)');
{
  let same = 0, opp = 0, sameO = 0, oppO = 0;
  for (let i = 0; i < 3000; i++) {
    const G = randG(), P = randP(), Q = randP(), S = inv(G, P), a = isInf(S) ? null : K.circle3(P, Q, S), b = K.perpForm(G, P, Q).G;
    if (!a || !b) continue;
    const z = randP(), sa = Math.sign(K.fOf(a, z)), sb = Math.sign(K.fOf(b, z));
    if (K.fOf(G, P) < 0) { if (sa === sb) same++; else opp++; } else if (sa === sb) sameO++; else oppO++;
  }
  ok(opp === 0 && sameO === 0, `as an oriented curve K = circle3(P, Q, P*) when P is inside C (${same} same, ${opp} opposite), the opposite outside (${oppO}, ${sameO})`);
}

// ------------------------------------------------ the graph
const pt = (id, p, extra) => Object.assign({ id, kind: 'point', p, ci: 0, visible: true }, extra || {});
const state = (shapes) => ({ shapes, targets: [], steps: [], nextId: 100 });
const sh = (S, id) => S.shapes.find((s) => s.id === id);
const env = { F: (z) => z };
const rec = (S, ch) => K.recompute(S, ch || { all: true }, env);
const formOfC = (S) => { const c = sh(S, 'C'); return K.pieces(c, env)[0].G; };
const perpShape = (id, cid, part, a, b, fill) => ({ id, kind: fill === 'in' ? 'disc' : 'circle', c: [0, 0], r: 1, ci: 1, visible: true, def: { op: 'perp', args: [{ s: cid, part }, a, b], fill: fill || 'none' } });

console.log('== 4. the graph: creation, drags, the line case, the region family');
{
  const S = state([{ id: 'C', kind: 'disc', c: [0, 0], r: 1, ci: 0, visible: true }, pt('P', [0.3, 0.2]), pt('Q', [-0.5, 0.4]), perpShape('k', 'C', 0, { s: 'P' }, { s: 'Q' })]);
  rec(S);
  const k = sh(S, 'k');
  ok(!k.cundef && k.kind === 'circle' && k.def.flip === (k._g.A < 0 ? false : k.def.flip) && Math.abs(cosAngle(k._g, formOfC(S))) < 1e-15, 'created: a circle, perpendicular to C', { kind: k.kind, flip: k.def.flip, A: k._g.A });
  // creation makes the disc
  ok(k._g.A > 0, 'at creation K is oriented as the disc (A > 0)');
  // drag P across C and out to 3, with Q fixed: no undefined frame, |cos| <= 1e-14, continuous levels, no flip of A's sign
  // except where K passes through the line case (C's centre on PQ)
  let worst = 0, und = 0, jump = 0, prev = null;
  const probes = [[0.31, -0.4], [-0.7, 0.13], [2, 2]];
  for (let i = 0; i <= 4000; i++) {
    sh(S, 'P').p = [0.3 + i * 0.0007, 0.2 + i * 0.0001];
    rec(S, { shapes: ['P'] });
    if (k.cundef) { und++; continue; }
    worst = Math.max(worst, Math.abs(cosAngle(k._g, formOfC(S))));
    const L = lv(k._g, probes);
    if (prev) jump = Math.max(jump, ...L.map((x, j) => Math.abs(x - prev[j])));
    prev = L;
  }
  ok(und === 0 && worst < 1e-14 && jump < 2e-3, `P dragged from 0.3 + 0.2i to 3.1 + 0.6i across C: undefined frames ${und}, worst |cos| ${f1(worst)}, largest level step at 3 probes ${f1(jump)}`);
  // P exactly at the centre (snapped 0): a line through 0, thru0
  sh(S, 'P').p = [0, 0]; rec(S);
  ok(k.kind === 'line' && k._g.A === 0 && k._g.thru0 === true, 'P at C\'s centre (0): the line through 0 and Q, thru0', { kind: k.kind });
  // Q exactly 0, P elsewhere: anchored at 0
  sh(S, 'P').p = [0.4, -0.3]; sh(S, 'Q').p = [0, 0]; rec(S);
  ok(k.kind === 'line' && k._g.thru0 === true && k._g.o[0] === 0 && k._g.o[1] === 0, 'Q at 0: the line, anchored at 0 (thru0)');
}
{
  // the decimal rule: C centred at 0.1 + 0.2i, P, Q on a decimal line through the centre
  const c = [-0.9, -0.9], P = [-0.8, -0.7], Q = [-0.7, -0.5];
  const S = state([{ id: 'C', kind: 'circle', c, r: 0.7, ci: 0, visible: true }, pt('P', P), pt('Q', Q), perpShape('k', 'C', 0, { s: 'P' }, { s: 'Q' })]);
  rec(S);
  const k = sh(S, 'k');
  // without the rule (the same circle anchored off its centre, so B != 0): a circle of radius ~1e16
  const off = K.reanchor({ A: 1 / 0.7, B: [0, 0], C: -0.7, o: c }, [c[0] + 0.7, c[1]]), raw = K.perpForm(off, P, Q).G;
  ok(K.orient(c, P, Q) !== 0 && k.kind === 'line' && k._g.A === 0, 'decimal rule [math-3]: snapped points on a line through the centre give the line, though the doubles are not collinear', { orient: K.orient(c, P, Q), kind: k.kind, radiusWithoutRule: raw && raw.A ? 1 / Math.abs(raw.A) : 'line' });
  // the line case by C's centre crossing PQ: circle -> line -> circle, region disc -> half-plane -> outside
  const T = state([{ id: 'C', kind: 'disc', c: [0, -0.5], r: 1, ci: 0, visible: true }, pt('P', [-0.4, 0]), pt('Q', [0.4, 0]), perpShape('k', 'C', 0, { s: 'P' }, { s: 'Q' }, 'in')]);
  rec(T);
  const kk = sh(T, 'k'), fam = [];
  let lastA = null, und = 0, jumpA = 0, worst = 0;
  for (let i = 0; i <= 100; i++) {
    sh(T, 'C').c = [0, -0.5 + i * 0.01];
    rec(T, { shapes: ['C'] });
    if (kk.cundef) { und++; continue; }
    const f = kk.kind === 'disc' && kk.complement ? 'outside' : kk.kind;
    if (fam[fam.length - 1] !== f) fam.push(f);
    if (lastA != null) jumpA = Math.max(jumpA, Math.abs(kk._g.A - lastA));
    lastA = kk._g.A;
    worst = Math.max(worst, Math.abs(cosAngle(kk._g, formOfC(T))));
  }
  ok(und === 0 && fam.join() === 'disc,halfplane,disc,outside' || fam.join() === 'disc,halfplane,outside', `C's centre crosses PQ (grid steps): the family ${fam.join(' -> ')}, A continuous (largest step ${f1(jumpA)}), |cos| ${f1(worst)}`);
}

console.log('== 5. Use complement on C, chains, curve kinds');
{
  const S = state([{ id: 'C', kind: 'disc', c: [0, 0], r: 1, ci: 0, visible: true }, pt('P', [0.3, 0.2]), pt('Q', [-0.5, 0.4]), perpShape('k', 'C', 0, { s: 'P' }, { s: 'Q' })]);
  rec(S);
  const k = sh(S, 'k'), before = JSON.stringify(k._g);
  sh(S, 'C').complement = true; rec(S);
  ok(JSON.stringify(k._g) === before, 'Use complement on a disc C does not turn K over');
  // C a 3-point circle with flip toggled
  const T = state([pt('a', [1, 0]), pt('b', [0, 1]), pt('c', [-1, 0]), { id: 'C', kind: 'circle', c: [0, 0], r: 1, ci: 0, visible: true, def: { op: 'circle3', args: [{ s: 'a' }, { s: 'b' }, { s: 'c' }], fill: 'in' } }, pt('P', [0.3, 0.2]), pt('Q', [-0.5, 0.4]), perpShape('k', 'C', 0, { s: 'P' }, { s: 'Q' })]);
  rec(T);
  const kt = sh(T, 'k'), b2 = JSON.stringify(kt._g);
  sh(T, 'C').def.flip = !sh(T, 'C').def.flip; rec(T);
  ok(JSON.stringify(kt._g) === b2 && Math.abs(cosAngle(kt._g, K.pieces(sh(T, 'C'), env)[0].G)) < 1e-15, 'Use complement on a 3-point C does not turn K over; K is perpendicular to it');
  // a chain: K2 perpendicular to K through two more points
  T.shapes.push(pt('R', [0.6, -0.1]), pt('W', [-0.2, -0.6]), perpShape('k2', 'k', 0, { s: 'R' }, { s: 'W' }));
  rec(T);
  const k2 = sh(T, 'k2');
  ok(!k2.cundef && Math.abs(cosAngle(k2._g, kt._g)) < 1e-14, 'a chain: perpendicular to a perpendicular circle', f1(Math.abs(cosAngle(k2._g, kt._g))));
  // curve kinds: polygon side, arc, half-plane edge, sector arc, annulus inner circle, segment; freehand refused
  const U = state([
    { id: 'pg', kind: 'polygon', pts: [[-1, -1], [2, -1], [0.5, 2]], ci: 0, visible: true },
    { id: 'ar', kind: 'arc', a: [-1, 0], m: [0, 1.2], b: [1, 0], ci: 0, visible: true },
    { id: 'hp', kind: 'halfplane', a: [0, -2], b: [1, -1.5], ci: 0, visible: true },
    { id: 'se', kind: 'sector', c: [0.2, 0.1], r: 1.5, t1: 10, t2: 200, ci: 0, visible: true },
    { id: 'an', kind: 'annulus', c: [0.1, 0], r1: 0.5, r2: 2, ci: 0, visible: true },
    { id: 'sg', kind: 'segment', a: [-2, 1], b: [2, 1.5], ci: 0, visible: true },
    { id: 'fh', kind: 'curve', pts: [[0, 0], [1, 0.5], [2, 0.1]], ci: 0, visible: true },
    pt('P', [0.3, 0.2]), pt('Q', [-0.5, 0.4]),
    perpShape('k1', 'pg', 1, { s: 'P' }, { s: 'Q' }), perpShape('k2', 'ar', 0, { s: 'P' }, { s: 'Q' }), perpShape('k3', 'hp', 0, { s: 'P' }, { s: 'Q' }),
    perpShape('k4', 'se', 1, { s: 'P' }, { s: 'Q' }), perpShape('k5', 'an', 0, { s: 'P' }, { s: 'Q' }), perpShape('k6', 'sg', 0, { s: 'P' }, { s: 'Q' }),
    perpShape('k7', 'fh', 0, { s: 'P' }, { s: 'Q' }), perpShape('k8', 'se', 0, { s: 'P' }, { s: 'Q' })]);
  rec(U);
  const res = {};
  for (const [kid, cid, part] of [['k1', 'pg', 1], ['k2', 'ar', 0], ['k3', 'hp', 0], ['k4', 'se', 1], ['k5', 'an', 0], ['k6', 'sg', 0], ['k8', 'se', 0]]) {
    const kk = sh(U, kid);
    res[kid] = kk.cundef ? kk.cundef.code : f1(Math.abs(cosAngle(kk._g, K.pieces(sh(U, cid), env)[part].G)));
  }
  ok(Object.values(res).every((x) => /e-1[5-9]|^0$/.test(x)), 'C a polygon side, an arc, a half-plane edge, a sector arc and edge, an annulus circle, a segment: perpendicular to the carrier', res);
  ok(sh(U, 'k7').cundef && sh(U, 'k7').cundef.code === 'notCircle', 'C a freehand curve: undefined, notCircle');
}

console.log('== 6. gliders on K: continuous through the line case; Use complement on K does not move them');
{
  const T = state([{ id: 'C', kind: 'circle', c: [0, -0.5], r: 1, ci: 0, visible: true }, pt('P', [-0.4, 0]), pt('Q', [0.4, 0]), perpShape('k', 'C', 0, { s: 'P' }, { s: 'Q' }), pt('g', [0, 0], { t: 0.1, def: { op: 'glider', args: [{ s: 'k', part: 0 }] } }), pt('h', [0, 0], { t: 0.4, def: { op: 'glider', args: [{ s: 'k', part: 0 }] } })]);
  rec(T);
  let jump = 0, prev = null, und = 0, off = 0;
  for (let i = 0; i <= 2000; i++) {
    sh(T, 'C').c = [0, -0.5 + i * 0.0005];
    rec(T, { shapes: ['C'] });
    const g = sh(T, 'g'), h = sh(T, 'h');
    if (g.cundef || h.cundef || g._atInf) { und++; continue; }
    off = Math.max(off, distTo(sh(T, 'k')._g, g.p), distTo(sh(T, 'k')._g, h.p));
    if (prev) jump = Math.max(jump, Math.hypot(g.p[0] - prev[0][0], g.p[1] - prev[0][1]), Math.hypot(h.p[0] - prev[1][0], h.p[1] - prev[1][1]));
    prev = [g.p.slice(), h.p.slice()];
  }
  ok(und === 0 && jump < 5e-3 && off < 1e-14, `C's centre crosses PQ (0.0005 steps, through the line at step 1000): gliders at t = 0.1, 0.4 move at most ${f1(jump)} per step, off K ${f1(off)}, undefined ${und}`);
  // at the line step: t = 0.25 sits at distance |PQ| from P (M(R) anchored at P, scale |PQ|)
  sh(T, 'C').c = [0, 0]; sh(T, 'g').t = 0.25; rec(T);
  ok(sh(T, 'k').kind === 'line' && Math.abs(Math.hypot(sh(T, 'g').p[0] + 0.4, sh(T, 'g').p[1]) - 0.8) < 1e-15, 'K a line: t = 1/4 is at |PQ| from P', sh(T, 'g').p);
  const p0 = sh(T, 'h').p.slice();
  sh(T, 'k').def.flip = !sh(T, 'k').def.flip; rec(T);
  ok(sh(T, 'h').p[0] === p0[0] && sh(T, 'h').p[1] === p0[1], 'Use complement on K does not move a glider on it');
  // projectPiece round trip
  sh(T, 'C').c = [0.3, -0.7]; rec(T);
  const pc = K.pieces(sh(T, 'k'), env)[0], p3 = K.pts3(T, sh(T, 'k'), 0, env);
  let worstRt = 0;
  for (const t of [0, 0.05, 0.2, 0.33, 0.49, 0.51, 0.7, 0.95]) { const z = K.glide(pc, t, p3), pr = K.projectPiece(pc, z, p3); worstRt = Math.max(worstRt, Math.abs(((pr.t - t + 1.5) % 1) - 0.5)); }
  ok(worstRt < 1e-12 && Math.abs(K.projectPiece(pc, K.glide(pc, 0.5, p3), p3).t - 0.5) < 1e-9, `glide -> projectPiece round trip: worst t error ${f1(worstRt)}; the antipode reads 1/2`);
}

console.log('== 7. meets with K keep the entering rule');
{
  // K meets C: the indices never swap (the crossing is a right angle, never tangent) while P crosses C
  const S = state([{ id: 'C', kind: 'circle', c: [0, 0], r: 1, ci: 0, visible: true }, pt('P', [0.3, 0.2]), pt('Q', [-0.5, 0.4]), perpShape('k', 'C', 0, { s: 'P' }, { s: 'Q' }),
    pt('m0', [0, 0], { def: { op: 'meet', args: [{ s: 'k', part: 0 }, { s: 'C', part: 0 }], index: 0 } }), pt('m1', [0, 0], { def: { op: 'meet', args: [{ s: 'k', part: 0 }, { s: 'C', part: 0 }], index: 1 } })]);
  rec(S);
  let jump = 0, prev = null, und = 0, offC = 0;
  for (let i = 0; i <= 3000; i++) {
    sh(S, 'P').p = [0.3 + i * 0.0009, 0.2 - i * 0.0003];
    rec(S, { shapes: ['P'] });
    const a = sh(S, 'm0'), b = sh(S, 'm1');
    if (a.cundef || b.cundef) { und++; continue; }
    offC = Math.max(offC, Math.abs(Math.hypot(a.p[0], a.p[1]) - 1), Math.abs(Math.hypot(b.p[0], b.p[1]) - 1));
    if (prev) jump = Math.max(jump, Math.hypot(a.p[0] - prev[0][0], a.p[1] - prev[0][1]), Math.hypot(b.p[0] - prev[1][0], b.p[1] - prev[1][1]));
    prev = [a.p.slice(), b.p.slice()];
  }
  ok(und === 0 && jump < 5e-3 && offC < 1e-13, `K ∩ C while P crosses C: both meets defined, largest step ${f1(jump)}, on C to ${f1(offC)}`);
  // K meets a line L while K passes through the line case: continuous; its index never 'finite'
  const T = state([{ id: 'C', kind: 'circle', c: [0, -0.5], r: 1, ci: 0, visible: true }, pt('P', [-0.4, 0]), pt('Q', [0.4, 0]), perpShape('k', 'C', 0, { s: 'P' }, { s: 'Q' }),
    { id: 'L', kind: 'line', a: [0.1, -3], b: [0.2, 3], ci: 0, visible: true }]);
  rec(T);
  const pa = K.pieces(sh(T, 'k'), env)[0], pb = K.pieces(sh(T, 'L'), env)[0];
  const ms = K.meets(pa, pb).filter((m) => K.onPiece(pa, m.z));
  const idx = ms.map((m) => m.index);
  T.shapes.push(pt('x', ms[0].z.slice(), { def: { op: 'meet', args: [{ s: 'k', part: 0 }, { s: 'L', part: 0 }], index: ms[0].index } }));
  rec(T);
  let j2 = 0, pv = null, u2 = 0;
  for (let i = 0; i <= 2000; i++) {
    sh(T, 'C').c = [0, -0.5 + i * 0.0005];
    rec(T, { shapes: ['C'] });
    const x = sh(T, 'x');
    if (x.cundef || x._atInf) { u2++; continue; }
    if (pv) j2 = Math.max(j2, Math.hypot(x.p[0] - pv[0], x.p[1] - pv[1]));
    pv = x.p.slice();
  }
  ok(!idx.includes('finite') && u2 === 0 && j2 < 5e-3, `K ∩ a line through the line case: indices ${idx.join(',')} (no 'finite'), the meet moves at most ${f1(j2)} per step`);
  // shared points: K meets the line through P and Q exactly at P and Q
  const V = state([{ id: 'C', kind: 'circle', c: [0.2, -0.9], r: 0.8, ci: 0, visible: true }, pt('P', [-0.31, 0.17]), pt('Q', [0.43, 0.29]), perpShape('k', 'C', 0, { s: 'P' }, { s: 'Q' })]);
  rec(V);
  const mm = K.meets(K.pieces(sh(V, 'k'), env)[0], { G: K.line2([-0.31, 0.17], [0.43, 0.29]), kind: 'line', a: [-0.31, 0.17], b: [0.43, 0.29], lo: -Infinity, hi: Infinity });
  ok(mm.length === 2 && mm.every((m) => (m.z[0] === -0.31 && m.z[1] === 0.17) || (m.z[0] === 0.43 && m.z[1] === 0.29)), 'K ∩ line(P, Q) is exactly {P, Q} (withPts)');
}

console.log('== 8. plumbing: validate, save and load, old builds, plans, speed');
{
  const mk = () => state([{ id: 'C', kind: 'disc', c: [0, 0], r: 1, ci: 0, visible: true }, pt('P', [0.3, 0.2]), pt('Q', [-0.5, 0.4]), perpShape('k', 'C', 0, { s: 'P' }, { s: 'Q' }, 'in'), pt('g', [0, 0], { t: 0.3, def: { op: 'glider', args: [{ s: 'k', part: 0 }] } })]);
  const S = mk(); rec(S);
  const noRt = (k, v) => (typeof k === 'string' && k[0] === '_' ? undefined : v);
  const saved = JSON.stringify(S, noRt), L = JSON.parse(saved);
  const v = K.validate(L, env); rec(L);
  ok(v.freed === 0 && JSON.stringify(L, noRt) === saved, 'save -> load -> recompute is bitwise identical');
  const B = JSON.parse(saved); B.shapes[3].def.args = [{ s: 'P' }, { s: 'Q' }, { s: 'C', part: 0 }];
  ok(K.validate(B, env).freed === 1 && !B.shapes[3].def && B.shapes[3].kind === 'disc', 'validate: a wrong signature frees the shape, its fields kept');
  const O = JSON.parse(saved), vo = K161.validate(O, env);
  ok(vo.freed === 1 && !O.shapes[3].def && O.shapes[3].kind === 'disc' && O.shapes[3].r > 0, 'v16.1 / v16.2 validate: perp is freed, its disc kept where it was (one loadFreed toast)', { freed: vo.freed });
  const p1 = K.deletePlan(S, ['C']), p2 = K.deletePlan(S, ['P']);
  ok(p1.del.sort().join() === 'C,g,k' && p2.del.sort().join() === 'P,g,k', 'deletePlan: deleting C or P deletes K and the glider on it', [p1.del, p2.del]);
  ok(K.moveRoots(S, 'k') === null, 'moveRoots: K on a free C: null (the press pans, with the chip)');
  const T = state([pt('a', [1, 0]), pt('b', [0, 1]), pt('c', [-1, 0]), { id: 'C', kind: 'circle', c: [0, 0], r: 1, ci: 0, visible: true, def: { op: 'circle3', args: [{ s: 'a' }, { s: 'b' }, { s: 'c' }], fill: 'none' } }, pt('P', [0.3, 0.2]), pt('Q', [-0.5, 0.4]), perpShape('k', 'C', 0, { s: 'P' }, { s: 'Q' })]);
  rec(T);
  ok((K.moveRoots(T, 'k') || []).join() === 'a,b,c,P,Q', 'moveRoots: K on a 3-point C of free points moves all five');
  ok(K.describe(S, 'k').fill === 'in' && K.describe(S, 'k').op === 'perp', 'describe: op perp, fill');
  // speed: perpForm alone, and a drag with 10 perpendicular circles (curves and regions) on one P
  const G = circ([0.3, -0.2], 1.7);
  const n = 100000, t0 = process.hrtime.bigint();
  for (let i = 0; i < n; i++) K.perpForm(G, [0.4 + i * 1e-9, 0.1], [-1.1, 0.6]);
  const per = Number(process.hrtime.bigint() - t0) / n;
  const W = state([{ id: 'C', kind: 'disc', c: [0, 0], r: 1, ci: 0, visible: true }, pt('P', [0.3, 0.2])]);
  for (let j = 0; j < 10; j++) W.shapes.push(pt('Q' + j, [Math.cos(j), Math.sin(j) * 0.5]), perpShape('k' + j, 'C', 0, { s: 'P' }, { s: 'Q' + j }, j % 2 ? 'in' : 'none'));
  rec(W);
  const c0 = process.cpuUsage();
  for (let f = 0; f < 600; f++) { sh(W, 'P').p = [0.3 + 0.1 * Math.cos(f / 50), 0.2 + 0.1 * Math.sin(f / 50)]; rec(W, { shapes: ['P'] }); }
  const cu = process.cpuUsage(c0), ms = (cu.user + cu.system) / 1000 / 600;
  ok(per < 5000 && ms < 1, `speed: perpForm ${per.toFixed(0)} ns; a drag with 10 dependents ${ms.toFixed(3)} ms CPU per recompute`);
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
