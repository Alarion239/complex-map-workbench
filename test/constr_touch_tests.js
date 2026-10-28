// Section F of test/t_constr.js: the Touching circle, ops touch and tangent (notes/orthogonal-circle/TANGENT-SPEC.md 7;
// src/constr.js). tangent-scratch/tcheck.js's 35 checks in the house style: the overlap depth g / S of K and C measured
// exactly from the float coefficients (BigInt), incidence of T, P and the touching point, the meet rule (in the graph and
// on the pieces), the tangents from a point, the line cases, continuity sweeps, gliders, and the plumbing (validate,
// v16.2's validate, save and load, deletePlan, onCurveByRefs, speed).
// Not a test of its own (no t_ prefix): t_constr.js calls it with its helpers.
'use strict';
// the absolute speed limits are set on the development Mac; CMW_SPEED_SCALE (CI: ci/README.md) scales them for slower machines
const SPEED = +(process.env.CMW_SPEED_SCALE || 1) || 1;
const path = require('path');
module.exports = function ({ K, ok }) {
  // (v16.2's constr.js, frozen: an older build reading a saved touching circle)
  const K162 = require(path.join(__dirname, '../notes/v16.2-candidate/src/constr.js'));
  const note = (t) => { if (process.argv.includes('-v')) console.log('     ' + t); };
  const INF = K.INF, isInf = K.isInf;
  const f1 = (x) => (x === 0 ? '0' : Number(x).toExponential(1));

  // ------------------------------------------------ exact measures (as texp.js)
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
  // the overlap depth g / S: |1 - |cos|| / |A_K - sgn(cos) A_C| / S, exactly from the floats
  function gapS(Kf, G, S) {
    const o = G.o, a = dForm(Kf, o), b = dForm(G, o);
    const ip = dsub(dadd(dmul(a.Bx, b.Bx), dmul(a.By, b.By)), dmul(D(0.5), dadd(dmul(a.A, b.C), dmul(b.A, a.C))));
    const n1 = dsub(dadd(dmul(a.Bx, a.Bx), dmul(a.By, a.By)), dmul(a.A, a.C)), n2 = dsub(dadd(dmul(b.Bx, b.Bx), dmul(b.By, b.By)), dmul(b.A, b.C));
    const num = dsub(dmul(n1, n2), dmul(ip, ip)), N = dnum(n1) * dnum(n2), c = dnum(ip) / Math.sqrt(N);
    const delta = dnum(num) / N / (1 + Math.abs(c)), kap = Math.abs(Kf.A - Math.sign(c) * G.A);
    return { g: kap > 0 ? Math.abs(delta) / kap / S : 0, cos: c };
  }
  function distTo(G, z) { const a = dForm(G, z), g = Math.hypot(dnum(a.Bx), dnum(a.By)); return Math.abs(dnum(a.C)) / (2 * g); }

  // ------------------------------------------------ scenes
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const R = (a, b) => a + (b - a) * rnd();
  const rec = (st) => K.recompute(st, { all: true }, {});
  const byId = (st, id) => st.shapes.find((x) => x.id === id);
  const curveShape = (i) => {
    const r = rnd();
    if (r < 0.45) return { id: 'c', kind: 'circle', c: [R(-5, 5), R(-5, 5)], r: R(0.1, 5) };
    if (r < 0.6) return { id: 'c', kind: 'line', a: [R(-5, 5), R(-5, 5)], b: [R(-5, 5), R(-5, 5)] };
    if (r < 0.7) return { id: 'c', kind: 'segment', a: [R(-5, 5), R(-5, 5)], b: [R(-5, 5), R(-5, 5)] };
    if (r < 0.8) return { id: 'c', kind: 'arc', a: [R(-5, 5), R(-5, 5)], m: [R(-5, 5), R(-5, 5)], b: [R(-5, 5), R(-5, 5)] };
    return { id: 'c', kind: 'disc', c: [R(-5, 5), R(-5, 5)], r: R(0.1, 5), complement: rnd() < 0.5 ? true : undefined };
  };
  function touchScene(C, t, P, extra = []) {
    return { shapes: [C, { id: 't', kind: 'point', p: [0, 0], t, def: { op: 'glider', args: [{ s: 'c', part: 0 }] } }, { id: 'p', kind: 'point', p: P },
      { id: 'k', kind: 'circle', c: [0, 0], r: 1, def: { op: 'touch', args: [{ s: 'c', part: 0 }, { s: 't' }, { s: 'p' }], fill: 'none' } },
      { id: 'm0', kind: 'point', p: [0, 0], def: { op: 'meet', args: [{ s: 'k', part: 0 }, { s: 'c', part: 0 }], index: 0 } },
      { id: 'm1', kind: 'point', p: [0, 0], def: { op: 'meet', args: [{ s: 'c', part: 0 }, { s: 'k', part: 0 }], index: 1 } }].concat(extra), targets: [], steps: [] };
  }
  const Sz = (...zs) => Math.max(...zs.filter((z) => z && !isInf(z)).map((z) => Math.hypot(z[0], z[1])), 1e-300);
  const Cscale = (G) => (G.A ? Math.hypot(...K.geomOf(G).c) + 1 / Math.abs(G.A) : 0);

  // ================================================ 1. touch in the graph: tangency, the meet rule, the plain solver
  {
    let worst = 0, inc = 0, und = 0, meetBad = 0, n = 0, oldNone = 0, oldTwo = 0, pieceRule = 0;
    for (let i = 0; i < 4000; i++) {
      const C = curveShape(i), st = touchScene(C, R(0, 1), [R(-6, 6), R(-6, 6)]);
      if (C.kind === 'segment' || C.kind === 'arc') byId(st, 't').t = R(0.05, 0.95);
      rec(st);
      const k = byId(st, 'k'), T = byId(st, 't').p, P = byId(st, 'p').p;
      if (k.cundef) { und++; continue; }
      n++;
      const pc = K.pieces(byId(st, 'c'))[0], S = Math.max(Sz(T, P), Math.hypot(T[0] - P[0], T[1] - P[1]), Cscale(pc.G));
      const gp = gapS(k._g, pc.G, S);
      if (gp.g > worst) worst = gp.g;
      inc = Math.max(inc, distTo(k._g, T) / S, distTo(k._g, P) / S);
      const m0 = byId(st, 'm0'), m1 = byId(st, 'm1');
      if (m0.cundef || m1.cundef || m0.p[0] !== T[0] || m0.p[1] !== T[1] || m1.p[0] !== T[0] || m1.p[1] !== T[1]) meetBad++;
      // pieces level (snapping, Intersect): Constr.meets on the pieces gives T for both indices
      const ms = K.meets(K.pieces(k)[0], pc);
      if (ms.length === 2 && ms.every((x) => x.z[0] === T[0] && x.z[1] === T[1])) pieceRule++;
      // the v16.2 solver on the same forms
      const old = K162.meets2(k._g, pc.G);
      if (old[0] == null || old[1] == null) oldNone++; else oldTwo++;
    }
    ok(worst <= 1e-12, `touch, ${n} random graphs (circle, line, segment, arc, disc and its complement): overlap depth / S <= 1e-12`, f1(worst));
    ok(inc <= 1e-15, 'touch: T and P on K within 1e-15 S', f1(inc));
    ok(und === 0, 'touch: no undefined K', und);
    ok(meetBad === 0, 'the meet rule: meet(K, C) index 0 and index 1 are T exactly, in the graph', meetBad);
    ok(pieceRule === n, 'the meet rule on pieces (snapping, Intersect): both meets are T exactly', `${pieceRule}/${n}`);
    ok(oldNone >= 0.1 * n, 'without the rule the v16.2 solver finds no meet often (why the rule is needed)', `none ${oldNone}, two ${oldTwo}`);
  }

  // ================================================ 2. tangent from a point
  {
    let worst = 0, incK = 0, incC = 0, left = 0, n = 0, meetBad = 0;
    for (let i = 0; i < 4000; i++) {
      const C = { id: 'c', kind: 'circle', c: [R(-5, 5), R(-5, 5)], r: R(0.1, 5) };
      let P; do P = [R(-8, 8), R(-8, 8)]; while (Math.hypot(P[0] - C.c[0], P[1] - C.c[1]) <= C.r);
      for (const k of [0, 1]) {
        const st = { shapes: [C, { id: 'p', kind: 'point', p: P }, { id: 'k', kind: 'line', a: [0, 0], b: [1, 0], def: { op: 'tangent', args: [{ s: 'c', part: 0 }, { s: 'p' }], index: k, fill: 'none' } },
          { id: 'm', kind: 'point', p: [0, 0], def: { op: 'meet', args: [{ s: 'k', part: 0 }, { s: 'c', part: 0 }], index: 0 } }], targets: [], steps: [] };
        rec(st);
        const kk = byId(st, 'k');
        if (kk.cundef) continue;
        n++;
        const tp = kk._g.tch.tp, S = Math.max(Sz(P, tp), Cscale(K.pieces(C)[0].G));
        const gp = gapS(kk._g, K.pieces(C)[0].G, S);
        worst = Math.max(worst, gp.g);
        incK = Math.max(incK, distTo(kk._g, tp) / S, distTo(kk._g, P) / S);
        incC = Math.max(incC, Math.abs(Math.hypot(tp[0] - C.c[0], tp[1] - C.c[1]) - C.r) / S);
        if (k === 0 && K.orient(P, C.c, tp) > 0) left++;
        const m = byId(st, 'm');
        if (m.cundef || m.p[0] !== tp[0] || m.p[1] !== tp[1]) meetBad++;
      }
    }
    ok(worst <= 1e-12, `tangent, ${n} lines: overlap depth / S <= 1e-12`, f1(worst));
    ok(incK <= 1e-15 && incC <= 1e-15, 'tangent: the touching point on K and on C, and P on K, within 1e-15 S', [f1(incK), f1(incC)]);
    ok(left === n / 2, 'tangent: k = 0 touches left of the ray P -> centre, every time', `${left}/${n / 2}`);
    ok(meetBad === 0, 'tangent: its touching point (a meet) is tp exactly', meetBad);
    // inside, on, the line case
    const U = { A: 1, B: [0, 0], C: -1, o: [0, 0] };
    ok(K.tangentForm(U, [0.5, 0], 0).undef === 'inside', 'tangent from inside: undefined, inside');
    const on = [0, 1].map((k) => K.tangentForm({ A: 0.25, B: [0, 0], C: -4, o: [1, 1] }, [1, -3], k));
    ok(on.every((r) => r.G && r.tp[0] === 1 && r.tp[1] === -3 && r.G.B[1] === -1), 'tangent from a point exactly on C (f(P) = 0 in the floats): both are the tangent there, tp = P', on.map((r) => r.tp));
    const nr = [0, 1].map((k) => K.tangentForm(U, [0.6, 0.8], k));
    note('0.6 + 0.8i on the unit circle (1e-17 outside in floats): ' + (nr[0].undef || 'touching points ' + f1(Math.hypot(nr[0].tp[0] - nr[1].tp[0], nr[0].tp[1] - nr[1].tp[1])) + ' apart'));
    const ln = K.tangentForm(K.line2([0, 0], [1, 0.5]), [0.3, 1], 0);
    ok(ln.G && ln.G.A === 0 && isInf(ln.tp) && ln.G.B[0] === K.line2([0, 0], [1, 0.5]).B[0] && ln.G.B[1] === K.line2([0, 0], [1, 0.5]).B[1], 'tangent to a line: its parallel, touching at infinity');
  }

  // ================================================ 3. a 3-point C passing through a line: tangent from P
  {
    const P = [0.3, 2], out = [];
    for (const y of [-1e-3, -1e-6, -1e-9, 0, 1e-9, 1e-6, 1e-3]) {
      const st = { shapes: [{ id: 'a', kind: 'point', p: [-3, 0] }, { id: 'b', kind: 'point', p: [0, y] }, { id: 'q', kind: 'point', p: [3, 0] },
        { id: 'c', kind: 'circle', c: [0, 0], r: 1, def: { op: 'circle3', args: [{ s: 'a' }, { s: 'b' }, { s: 'q' }], fill: 'none' } },
        { id: 'p', kind: 'point', p: P }, { id: 'k', kind: 'line', a: [0, 0], b: [1, 0], def: { op: 'tangent', args: [{ s: 'c', part: 0 }, { s: 'p' }], index: 0 } }], targets: [], steps: [] };
      rec(st);
      const k = byId(st, 'k');
      out.push(k.cundef ? k.cundef.code : `B=(${f1(k._g.B[0])}, ${f1(k._g.B[1])}) tp=${isInf(k._g.tch.tp) ? 'inf' : f1(Math.hypot(...k._g.tch.tp))}`);
    }
    note('3-point C through y = 0 (P above): ' + out.join(' | '));
    ok(out[0] === 'inside' && out[2] === 'inside' && /tp=inf/.test(out[3]) && /tp=/.test(out[6]) && /tp=/.test(out[4]), 'tangent: as C flattens, the tangents tend to the parallel (tp to infinity), then P is inside: undefined');
  }

  // ================================================ 4. two tangents at T1, T2 (P = inf) and their meet, T2 past the antipode
  function poleSweep(c3) {
    const st = { shapes: [{ id: 'c', kind: 'circle', c: [0, 0], r: 1 },
      { id: 't1', kind: 'point', p: [0, 0], t: 0, def: { op: 'glider', args: [{ s: 'c', part: 0 }] } },
      { id: 't2', kind: 'point', p: [0, 0], t: 0.4, def: { op: 'glider', args: [{ s: 'c', part: 0 }] } },
      { id: 'k1', kind: 'line', a: [0, 0], b: [1, 0], def: { op: 'touch', args: [{ s: 'c', part: 0 }, { s: 't1' }, { inf: 1 }] } },
      { id: 'k2', kind: 'line', a: [0, 0], b: [1, 0], def: { op: 'touch', args: [{ s: 'c', part: 0 }, { s: 't2' }, { inf: 1 }] } }], targets: [], steps: [] };
    rec(st);
    const m = K.meets(Object.assign(K.pieces(byId(st, 'k1'))[0], c3 ? { c3: true } : {}), Object.assign(K.pieces(byId(st, 'k2'))[0], c3 ? { c3: true } : {}));
    const want = m.length === 1 ? 'finite' : 0;
    st.shapes.push({ id: 'm', kind: 'point', p: [0, 0], def: { op: 'meet', args: [{ s: 'k1', part: 0 }, { s: 'k2', part: 0 }], index: want } });
    const seen = [];
    for (const t of [0.4, 0.45, 0.49, 0.499, 0.501, 0.51, 0.55, 0.6]) {
      byId(st, 't2').t = t; rec(st);
      if (c3) for (const id of ['k1', 'k2']) { const pc = K.pieces(byId(st, id))[0]; pc.c3 = true; }
      const mm = byId(st, 'm');
      seen.push(mm.cundef ? 'undef' : mm._atInf ? 'inf' : f1(Math.hypot(...mm.p)));
    }
    return { want, seen };
  }
  {
    const a = poleSweep(false);
    note('the pole of T1 T2 as T2 passes the antipode (lines by kind): index ' + a.want + ': ' + a.seen.join(', '));
    ok(a.want === 'finite' && a.seen.every((x) => x !== 'inf' && x !== 'undef'), 'two tangents at T1, T2: a lines-by-kind meet, finite on both sides of the antipode (goes out and comes back)');
  }

  // ================================================ 5. continuity sweeps in the graph (no undefined step, no flip)
  function sweep(mk, n, h) {
    let und = 0, flips = 0, jump = 0, prev = null;
    const probes = [[0.3, -0.4], [-0.7, 0.1], [2, 2]];
    const st = mk(-n * h); rec(st);
    for (let i = -n; i <= n; i++) {
      const s1 = mk(i * h); byId(st, 't').t = byId(s1, 't').t; byId(st, 'p').p = byId(s1, 'p').p; rec(st);
      const k = byId(st, 'k');
      if (k.cundef) { und++; continue; }
      const lv = probes.map((z) => K.fOf(k._g, z));
      if (prev) { jump = Math.max(jump, ...lv.map((x, j) => Math.abs(x - prev[j]))); if (Math.sign(k._g.A) * Math.sign(prev.A) < 0) flips++; }
      prev = Object.assign(lv, { A: k._g.A });
    }
    return { und, flips, jump };
  }
  {
    const unit = { id: 'c', kind: 'circle', c: [0, 0], r: 1 };
    const a = sweep((s) => touchScene(unit, s, [1, 1]), 500, 1e-7);
    ok(a.und === 0 && a.flips === 0, 'T slides through the angle where P is on its tangent: no undefined step, no flip', a);
    const b = sweep((s) => touchScene(unit, 0, [1 + s, 0.4]), 500, 1e-7);
    ok(b.und === 0 && b.flips === 0, 'P crosses the tangent at T: no undefined step, no flip', b);
    const c = sweep((s) => touchScene(unit, 0.5, [0.6 + s, 0.8]), 500, 1e-7);
    ok(c.und === 0 && c.flips === 0, 'P crosses C: no undefined step, no flip', c);
  }

  // ================================================ 6. gliders on K: continuous through the line case; Use complement
  {
    const unit = { id: 'c', kind: 'circle', c: [0, 0], r: 1 };
    let worst = 0, prev = null, und = 0;
    const st = touchScene(unit, 0, [1 - 400e-4, 0.5], [{ id: 'g', kind: 'point', p: [0, 0], t: 0.3, def: { op: 'glider', args: [{ s: 'k', part: 0 }] } }]);
    for (let i = -400; i <= 400; i++) {
      byId(st, 'p').p = [1 + i * 1e-4, 0.5];
      rec(st);
      const g = byId(st, 'g');
      if (g.cundef || g._atInf) { und++; continue; }
      if (prev) worst = Math.max(worst, Math.hypot(g.p[0] - prev[0], g.p[1] - prev[1]));
      prev = g.p.slice();
    }
    ok(und === 0 && worst < 1e-2, 'a point on K moves continuously while K passes through its line case (steps of 1e-4)', { und, worst: f1(worst) });
    const sU = touchScene(unit, 0.1, [2, 1], [{ id: 'g', kind: 'point', p: [0, 0], t: 0.3, def: { op: 'glider', args: [{ s: 'k', part: 0 }] } }]);
    rec(sU); const g0 = byId(sU, 'g').p.slice(), fl = byId(sU, 'k').def.flip;
    byId(sU, 'k').def.flip = !fl; rec(sU); const g1 = byId(sU, 'g').p.slice();
    ok(fl === true && Math.hypot(g0[0] - g1[0], g0[1] - g1[1]) < 1e-14, 'P outside: K is made the disc (flip at creation); Use complement on K does not move a point on it', { fl, d: f1(Math.hypot(g0[0] - g1[0], g0[1] - g1[1])) });
    // the tangent at T (P = inf): a plain line glider from T
    const st2 = { shapes: [unit, { id: 't', kind: 'point', p: [0, 0], t: 0.1, def: { op: 'glider', args: [{ s: 'c', part: 0 }] } },
      { id: 'k', kind: 'line', a: [0, 0], b: [1, 0], def: { op: 'touch', args: [{ s: 'c', part: 0 }, { s: 't' }, { inf: 1 }] } },
      { id: 'g', kind: 'point', p: [0, 0], t: 0.5, def: { op: 'glider', args: [{ s: 'k', part: 0 }] } }], targets: [], steps: [] };
    rec(st2);
    const T = byId(st2, 't').p, gp = byId(st2, 'g').p;
    ok(Math.abs(Math.hypot(gp[0] - T[0], gp[1] - T[1]) - 0.5) < 1e-15 && !K.pieces(byId(st2, 'k'))[0].c3, 'the tangent at T: a line by kind; a point on it at t is at distance t from T');
  }

  // ================================================ 7. two touches at one point; the Lambda rule; undefined; plumbing
  {
    const unit = { id: 'c', kind: 'circle', c: [0, 0], r: 1 };
    const st = touchScene(unit, 0.2, [2, 0.3], [{ id: 'p2', kind: 'point', p: [-0.4, 0.1] },
      { id: 'k2', kind: 'circle', c: [0, 0], r: 1, def: { op: 'touch', args: [{ s: 'c', part: 0 }, { s: 't' }, { s: 'p2' }], fill: 'none' } },
      { id: 'm2', kind: 'point', p: [0, 0], def: { op: 'meet', args: [{ s: 'k', part: 0 }, { s: 'k2', part: 0 }], index: 1 } }]);
    rec(st);
    const T = byId(st, 't').p, m2 = byId(st, 'm2');
    ok(!m2.cundef && m2.p[0] === T[0] && m2.p[1] === T[1], 'two touches of C at the same T meet exactly at T');
    // P exactly 0: anchored at 0, thru0, f(0) = 0 exactly
    const st0 = touchScene({ id: 'c', kind: 'circle', c: [1.3, 0.4], r: 0.9 }, 0.37, [0, 0]); rec(st0);
    const k0 = byId(st0, 'k')._g;
    ok(k0.thru0 && k0.o[0] === 0 && k0.o[1] === 0 && k0.C === 0, 'P exactly 0: K anchored at 0 (the Lambda rule), C = 0 exactly');
    const g0 = gapS(k0, K.pieces(byId(st0, 'c'))[0].G, 2.2);
    ok(g0.g < 1e-15, 'P exactly 0: still tangent', f1(g0.g));
    // undefined codes
    const sc = touchScene(unit, 0.2, [0, 0]); byId(sc, 'p').def = { op: 'glider', args: [{ s: 'c', part: 0 }] }; byId(sc, 'p').t = 0.2; rec(sc);
    ok(byId(sc, 'k').cundef && byId(sc, 'k').cundef.code === 'coincide', 'P = T: coincide');
    const sf = touchScene({ id: 'c', kind: 'curve', pts: [[0, 0], [1, 1], [2, 0]] }, 0.2, [3, 3]); rec(sf);
    ok(!!byId(sf, 'k').cundef && (byId(sf, 'k').cundef.code === 'argUndef' || byId(sf, 'k').cundef.code === 'notCircle'), 'a freehand C: undefined', byId(sf, 'k').cundef);
    // validate: sigs and index; the v16.2 validate frees touch and tangent, keeping the fields
    const sv = touchScene(unit, 0.2, [2, 0.3], [{ id: 'kt', kind: 'line', a: [0, 0], b: [1, 0], def: { op: 'tangent', args: [{ s: 'c', part: 0 }, { s: 'p' }], index: 7 } },
      { id: 'kb', kind: 'line', a: [0, 0], b: [1, 0], def: { op: 'tangent', args: [{ s: 'p' }, { s: 'p' }], index: 0 } }]);
    const r1 = K.validate(sv, {});
    ok(r1.freed === 1 && byId(sv, 'kt').def.index === 0 && !byId(sv, 'kb').def, 'validate: a wrong signature is freed; a bad index becomes 0', r1);
    const sold = touchScene(unit, 0.2, [2, 0.3]); rec(sold); const cK = byId(sold, 'k').c.slice();
    const so = JSON.parse(JSON.stringify(sold, (k, v) => (k[0] === '_' ? undefined : v)));
    const r2 = K162.validate(so, {});
    ok(r2.freed >= 1 && !byId(so, 'k').def && byId(so, 'k').c[0] === cK[0], 'the v16.2 validate frees touch and keeps its circle', r2);
    // save, load, recompute: bitwise
    const s1 = JSON.stringify(sold, (k, v) => (k[0] === '_' ? undefined : v)), sl = JSON.parse(s1); K.validate(sl, {}); rec(sl);
    ok(JSON.stringify(sl, (k, v) => (k[0] === '_' ? undefined : v)) === s1, 'save, load, recompute: bitwise');
    const dp = K.deletePlan(sold, ['c']);
    ok(['t', 'k', 'm0', 'm1'].every((id) => dp.del.includes(id)), 'deletePlan: C takes T, K and the touching points', dp.del);
    // (TANGENT-SPEC 3.1 and 3.7, beyond tpatch.js: touchAt is exported; describe gives a touch's fill and a tangent's index)
    const sd = touchScene(unit, 0.2, [2, 0.3], [{ id: 'kt', kind: 'line', a: [0, 0], b: [1, 0], def: { op: 'tangent', args: [{ s: 'c', part: 0 }, { s: 'p' }], index: 1, fill: 'none' } }]);
    rec(sd);
    const dk = K.describe(sd, 'k'), dt = K.describe(sd, 'kt');
    ok(typeof K.touchAt === 'function' && K.touchAt(K.pieces(byId(sd, 'kt'))[0], K.pieces(unit)[0]) != null && dk.op === 'touch' && dk.fill === 'none' && dt.op === 'tangent' && dt.index === 1 && dt.fill === null, 'describe: a touch\'s fill, a tangent\'s index; touchAt exported', { dk, dt });
  }

  // ================================================ 8. onCurveByRefs
  {
    const st = { shapes: [{ id: 'c', kind: 'circle', c: [0, 0], r: 1 }, { id: 'l', kind: 'line', a: [-2, 0.5], b: [2, 0.5] },
      { id: 'g', kind: 'point', p: [0, 0], t: 0.1, def: { op: 'glider', args: [{ s: 'c', part: 0 }] } },
      { id: 'x', kind: 'point', p: [0, 0], def: { op: 'meet', args: [{ s: 'l', part: 0 }, { s: 'c', part: 0 }], index: 0 } },
      { id: 'f', kind: 'point', p: [0.6, 0.8] },
      { id: 'pg', kind: 'polygon', pts: [[0, 0], [2, 0], [2, 2], [0, 2]] },
      { id: 'q1', kind: 'point', p: [3, 0] }, { id: 'q2', kind: 'point', p: [3, 1] }, { id: 'q3', kind: 'point', p: [4, 0] },
      { id: 'c3', kind: 'circle', c: [0, 0], r: 1, def: { op: 'circle3', args: [{ s: 'q1' }, { s: 'q2' }, { s: 'q3' }], fill: 'none' } },
      { id: 'sg', kind: 'segment', a: [5, 5], b: [6, 6], at: { a: { s: 'f' } } }], targets: [], steps: [] };
    rec(st);
    const on = (p, c) => K.onCurveByRefs(st, p, c);
    ok(on({ s: 'g' }, { s: 'c', part: 0 }) && on({ s: 'x' }, { s: 'c', part: 0 }) && on({ s: 'x' }, { s: 'l', part: 0 }), 'onCurveByRefs: a glider on C and a meet with C are on C');
    ok(on({ s: 'l', h: 'a' }, { s: 'l', part: 0 }) && on({ s: 'pg', h: 'v1' }, { s: 'pg', part: 0 }) && on({ s: 'pg', h: 'v1' }, { s: 'pg', part: 1 }) && !on({ s: 'pg', h: 'v1' }, { s: 'pg', part: 2 }), 'onCurveByRefs: a line\'s ends; a polygon vertex on its two sides only');
    ok(on({ s: 'q2' }, { s: 'c3', part: 0 }) && on({ s: 'f' }, { s: 'sg', part: 0 }), 'onCurveByRefs: a circle3\'s points; a point bound to a segment\'s end');
    ok(!on({ s: 'f' }, { s: 'c', part: 0 }) && !on({ s: 'g' }, { s: 'l', part: 0 }), 'onCurveByRefs: a free point lying on C numerically is not on C; a glider on another curve is not');
  }

  // ================================================ 9. speed
  {
    const G = { A: 1 / 1.7, B: [0, 0], C: -1.7, o: [0.3, -0.2] }, T = [0.3 + 1.7 * Math.cos(0.4), -0.2 + 1.7 * Math.sin(0.4)];
    const n = 100000; let t0 = process.hrtime.bigint();
    for (let i = 0; i < n; i++) K.touchForm(G, T, [-1.1 + i * 1e-9, 0.6]);
    const a = Number(process.hrtime.bigint() - t0) / n / 1000; t0 = process.hrtime.bigint();
    for (let i = 0; i < n; i++) K.tangentForm(G, [3 + i * 1e-9, 1], i & 1);
    const b = Number(process.hrtime.bigint() - t0) / n / 1000;
    ok(a < 5 * SPEED && b < 5 * SPEED, 'speed: touchForm and tangentForm under 5 us', `${a.toFixed(2)} us, ${b.toFixed(2)} us`);
  }

  // ================================================ 10. the tangent at T as a click target (issue #12)
  // The touching circle's UI (src/construct.js): after T on a circle, a click within the point radius of the tangent at
  // T (Constr.tangentNear) is P = ∞, Snap on or off (Alt skips it); a P within TAN_EPS px of the tangent makes the
  // tangent too. The issue's table: C the unit circle, T = i, 52 px per unit, a click at Re z = 1.5
  {
    const fs = require('fs');
    const CON = fs.readFileSync(path.join(__dirname, '../src/construct.js'), 'utf8');
    const body = (name) => { const i = CON.indexOf(`function ${name}(`); return i < 0 ? '' : CON.slice(i, CON.indexOf('\n  }\n', i)); };
    const rm = /const radii = \(touch\) => \(touch \? \{ p: (\d+),[^}]*\} : \{ p: (\d+),/.exec(CON), em = /const TAN_EPS = ([\d.]+);/.exec(CON);
    ok(!!rm && !!em, 'tangent target: radii and TAN_EPS read from construct.js', [rm && rm[0], em && em[0]]);
    const band = (touch) => +(touch ? rm[1] : rm[2]), EPS = em ? +em[1] : 0.5;
    const G = { A: 1, B: [0, 0], C: -1, o: [0, 0] }, T = [0, 1], S = 52;
    // what a click makes, as hintAt and finishTouch decide it (Snap is not an input: the hint is a target)
    const click = (off, { touch = false, alt = false } = {}) => {
      const Z = [1.5, 1 + off / S], h = K.tangentNear(G, T, Z);
      const P = !alt && h && h.d * S <= band(touch) ? INF : h && h.d * S <= EPS ? INF : Z;
      const r = K.touchForm(G, T, P);
      return r.G ? K.geomOf(r.G) : null;
    };
    const line = (g) => !!g && g.line && Math.abs(g.p[1] - 1) < 1e-15 && g.d[1] === 0;
    ok(line(click(0)), 'tangent target: exactly on the line, Snap on: the tangent line', click(0));
    ok(line(click(4)), 'tangent target: 4 px off: the tangent line', click(4));
    ok(line(click(7)), 'tangent target: 7 px off (was a circle, r ≈ 5.7): the tangent line', click(7));
    const c12 = click(12);
    ok(c12 && !c12.line && c12.r > 1 && c12.r < 20, 'tangent target: 12 px off with a mouse: a touching circle (outside the 8 px band)', c12);
    ok(line(click(12, { touch: true })), 'tangent target: 12 px off on touch (22 px band): the tangent line', click(12, { touch: true }));
    ok(line(click(0)) && !/snapOn/.test(body('hintAt')), 'tangent target: exactly on the line, Snap off: the tangent line (hintAt does not ask Snap)', body('hintAt').slice(0, 200));
    ok(line(click(0, { alt: true })), 'tangent target: Alt, P exactly on the tangent: the line, not r ≈ 10¹⁶', click(0, { alt: true }));
    const a4 = click(4, { alt: true });
    ok(a4 && !a4.line && a4.r > 1, 'tangent target: Alt, 4 px off: the touching circle through P', a4);
    ok(K.tangentNear({ A: 0, B: [0, 1], C: 0, o: [0, 0] }, [0, 0], [1, 1]) === null && K.tangentNear(G, INF, [1, 1]) === null, 'tangentNear: none for a line C or T = ∞');
    // the code that uses it: the band, Alt, the guard, the chip's Tangent line and Enter
    ok(/Constr\.tangentNear\(pc\.G, Tp\.z, \[zc\.re, zc\.im\]\)/.test(body('hintAt')) && /h\.d \* pane\.view\.s <= radii\(touchNow\(\)\)\.p/.test(body('hintAt')) && /if \(altNow\(\)\) return null;/.test(body('hintAt')), 'tangent target: hintAt picks within the point radius; only Alt skips it');
    ok(/h\.d \* A\.setView\(side\)\.view\.s <= TAN_EPS\) Pp = \{ cls: 'hint', ref: \{ inf: 1 \}/.test(body('finishTouch')), 'tangent target: finishTouch makes a P on the tangent the tangent line');
    ok(/draftC\.picks\.push\(\{ cls: 'hint', ref: \{ inf: 1 \}, z: T\.z\.slice\(\), role: 'P' \}\);[\s\S]*finishTouch\(draftC\.side, null\)/.test(body('tangentNow')), 'tangent target: tangentNow makes the tangent at T');
    ok(/onclick: \(e\) => \{ e\.stopPropagation\(\); tangentNow\(\); \} \}, \$t\('Tangent line'\)\)/.test(body('syncChip')) && /const tan = tool === 'touch' && tangentReady\(side\);/.test(body('syncChip')), 'tangent target: the chip\'s Tangent line button after T');
    ok(/e\.key === 'Enter' && !\(t && t\.tagName === 'BUTTON'\) && tangentNow\(\)/.test(body('keydown')), 'tangent target: Enter after T makes the tangent');
  }

  // ================================================ v16.3 review fixes (notes/orthogonal-circle/ledger.json)
  {
    // [math-1] a rectangle's corner a as T on side 0; b dragged across a: a is on other sides now. K is undefined
    // ('offCurve'), the touching meet is undefined, and the corner is not on side 0 by construction
    const st = { shapes: [{ id: 'r', kind: 'rect', a: [0, 0], b: [2, 1] }, { id: 'p', kind: 'point', p: [1, 2] },
      { id: 'k', kind: 'circle', c: [0, 0], r: 1, def: { op: 'touch', args: [{ s: 'r', part: 0 }, { s: 'r', h: 'a' }, { s: 'p' }], fill: 'none' } },
      { id: 'm', kind: 'point', p: [0, 0], def: { op: 'meet', args: [{ s: 'k', part: 0 }, { s: 'r', part: 0 }], index: 0 } }], targets: [], steps: [] };
    rec(st);
    const k0 = !byId(st, 'k').cundef && byId(st, 'm').p[0] === 0 && byId(st, 'm').p[1] === 0;
    byId(st, 'r').b = [2, -1]; rec(st);
    const k = byId(st, 'k'), m = byId(st, 'm');
    ok(k0 && k.cundef && k.cundef.code === 'offCurve' && m.cundef && !K.onCurveByRefs(st, { s: 'r', h: 'a' }, { s: 'r', part: 0 }), 'review math-1: a rectangle corner as T, b dragged across a: K undefined (offCurve), no false touching meet; a corner is never on a side by construction', { k: k.cundef, m: m.cundef });
    // a crafted save: T a free point off C
    const sc = touchScene({ id: 'c', kind: 'circle', c: [0, 0], r: 1 }, 0.1, [2, 0.5]);
    byId(sc, 't').def = undefined; delete byId(sc, 't').def; byId(sc, 't').p = [0.5, 0.5];
    rec(sc);
    ok(byId(sc, 'k').cundef && byId(sc, 'k').cundef.code === 'offCurve' && byId(sc, 'm0').cundef, 'review math-1: a saved touching circle whose T is off C: undefined, and no meet');
    // T on C by construction stays defined at any scale (a glider on a circle of radius 1e6 far from 0, a meet)
    const big = touchScene({ id: 'c', kind: 'circle', c: [3e6, -2e6], r: 1e6 }, 0.37, [3e6, 1e5]);
    rec(big);
    ok(!byId(big, 'k').cundef && !byId(big, 'm0').cundef, 'review math-1: T a glider on a large far circle: K defined', byId(big, 'k').cundef);
  }
};
