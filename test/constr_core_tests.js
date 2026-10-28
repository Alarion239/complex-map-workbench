// Section C of test/t_constr.js (v16 CORE, notes/constructions-v16/SPEC.md 18): the integration and exactness tests.
// Not a test of its own (no t_ prefix): t_constr.js calls it with its helpers.
'use strict';
// the absolute speed limits are set on the development Mac; CMW_SPEED_SCALE (CI: ci/README.md) scales them for slower machines
const SPEED = +(process.env.CMW_SPEED_SCALE || 1) || 1;
module.exports = function ({ K, ok, near, nearP, Inverse }) {
  const C = CX.C;
  let seed = 20261024;
  const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const rf = (a, b) => a + rnd() * (b - a);
  // a state with f1 = zeros and poles; env: the zeros parsed as the app does, F the chain at t = 1
  const zpVal = (raw) => { try { const v = Expr.constValue(raw); return CX.isFin(v) ? [v.re, v.im] : null; } catch (e) { return null; } };
  const mkEnv = (F) => ({
    zp: (st, kind, i) => zpVal(Funcs.splitList(st.params[kind])[i] || ''),
    zpAll: (st, kind) => Funcs.splitList(st.params[kind]).map(zpVal),
    F: F || ((z) => (z === K.INF ? null : z)),
  });
  const env = mkEnv();
  const pt = (id, p, extra) => Object.assign({ id, kind: 'point', p, ci: 0, visible: true }, extra || {});
  const state = (shapes, steps, targets) => ({ shapes, targets: targets || [], steps: steps || [], nextId: 100 });
  const sh = (S, id) => S.shapes.concat(S.targets).find((s) => s.id === id);
  const rec = (S, ch) => K.recompute(S, ch || { all: true }, env);

  // ------------------------------------------------ refs: zeros and poles of f1 by id [C12, C29]
  {
    const S = state([pt('s1', [0, 0]), pt('s2', [2, 0])], [{ type: 'zp', params: { a: '1', zeros: '0.5+i, -1', poles: '2i' }, on: true }]);
    K.syncSteps(S, env);
    const st = S.steps[0];
    ok(/^f\d+$/.test(st.uid) && st.zpIds.zeros.length === 2 && st.zpIds.poles.length === 1, 'refs: a step gets a uid, its zeros and poles ids', [st.uid, st.zpIds]);
    const z1 = { zp: st.uid, kind: 'zeros', id: st.zpIds.zeros[0], i: 0 };
    S.shapes.push({ id: 'c', kind: 'circle', c: [0, 0], r: 1, ci: 1, visible: true, def: { op: 'circle3', args: [{ s: 's1' }, z1, { s: 's2' }], fill: 'none' } });
    rec(S);
    const c = sh(S, 'c');
    ok(c._g && Math.abs(K.level(c._g, [0.5, 1])[0]) < 1e-14, 'refs: circle(z0, ζ1, z1) passes through ζ1', K.level(c._g, [0.5, 1])[0]);
    st.params.zeros = '0.5+2i, -1';
    rec(S, { zp: [st.uid] });
    ok(Math.abs(K.level(c._g, [0.5, 2])[0]) < 1e-14, 'refs: dragging ζ1 (zpSet) moves the circle');
    // the step moves to f2: undefined, and back
    S.steps.unshift({ type: 'mul', params: Funcs.defaults('mul'), on: true });
    K.syncSteps(S, env); rec(S);
    ok(c.cundef && c.cundef.code === 'zpNotF1' && c.cundef.args.f === 2 && c.visible === false && c.cHid, 'refs: the zero of a step that is now f2 is undefined (zpNotF1), and hidden', c.cundef);
    S.steps.shift(); rec(S);
    ok(!c.cundef && c.visible === true && !c.cHid, 'refs: back at f1, the circle is defined and shown again');
    // remove: the id goes with the zero (zpRemoveId), nothing else changes id
    const id2 = st.zpIds.zeros[1];
    const plan = K.zeroRemovePlan(S, z1);
    ok(plan.undef.join() === 'c' && plan.freed.length === 0, 'plans: removing ζ1 makes its constructions undefined, deletes nothing', plan);
    K.zpRemoveId(st, 'zeros', 0); st.params.zeros = '-1'; K.syncSteps(S, env); rec(S);
    ok(st.zpIds.zeros.join() === id2 && c.cundef && c.cundef.code === 'zpRemoved', 'refs: ζ2 keeps its id after ζ1 is removed; the circle on ζ1 is undefined (zpRemoved)', [st.zpIds.zeros, c.cundef]);
    // a text edit deleting the first zero: nearest-value matching keeps the old ζ2's id
    st.params.zeros = '3, -1, 4i'; K.syncSteps(S, env);
    const ids3 = st.zpIds.zeros.slice();
    st.params.zeros = '-1, 4i'; K.syncSteps(S, env);
    ok(st.zpIds.zeros[0] === ids3[1] && st.zpIds.zeros[1] === ids3[2], 'refs: a text edit that deletes the first zero keeps the others\' ids (nearest value)', [ids3, st.zpIds.zeros]);
  }
  // ------------------------------------------------ [UX54] zeros and poles keep their numbers (zpNums)
  {
    const S = state([], [{ type: 'zp', params: { a: '1', zeros: '1, 2, 3', poles: '5i' }, on: true }]);
    K.syncSteps(S, env);
    const st = S.steps[0], nz = () => st.zpNums.zeros.join();
    ok(nz() === '1,2,3' && st.zpNums.poles.join() === '1' && K.zpNum(st, 'zeros', 2) === 3, 'zpNums: an earlier save (none) numbers by place', st.zpNums);
    K.zpRemoveId(st, 'zeros', 0); st.params.zeros = '2, 3'; K.syncSteps(S, env);
    ok(nz() === '2,3', 'zpNums: removing ζ1 leaves ζ2, ζ3', st.zpNums.zeros);
    st.params.zeros = '2, 3, 7'; K.syncSteps(S, env);
    ok(nz() === '2,3,4', 'zpNums: a new zero takes the next after the largest', st.zpNums.zeros);
    st.params.zeros = '3, 7'; K.syncSteps(S, env);
    ok(nz() === '3,4', 'zpNums: a text edit deleting the first zero keeps the others\' numbers (nearest value)', st.zpNums.zeros);
    // saved and loaded: zpIds dropped (nothing refers to the step), zpNums kept
    const L = JSON.parse(JSON.stringify({ shapes: [], targets: [], steps: [{ type: 'zp', params: st.params, on: true, zpNums: st.zpNums }], nextId: 1 }));
    K.syncSteps(L, env);
    ok(L.steps[0].zpNums.zeros.join() === '3,4' && L.steps[0].zpNums.poles.join() === '1', 'zpNums: a save keeps the numbers without the ids', L.steps[0].zpNums);
    // damaged numbers (not distinct): by place
    const D = state([], [{ type: 'zp', params: { a: '1', zeros: '1, 2', poles: '' }, on: true, zpNums: { zeros: [2, 2], poles: [] } }]);
    K.syncSteps(D, env);
    ok(D.steps[0].zpNums.zeros.join() === '1,2', 'zpNums: duplicates are dropped for numbers by place', D.steps[0].zpNums);
    ok(K.zpRenumber(st) && nz() === '1,2' && !K.zpRenumber(st), 'zpRenumber: by place again, once', st.zpNums.zeros);
  }
  {
    // a v15.1-stripped state (no uid, no zpIds) rebinds to f1 by the stored index [C29]
    const S = state([pt('s1', [0, 0]), pt('s2', [2, 0]),
      { id: 'c', kind: 'circle', c: [0, 0], r: 1, ci: 1, visible: true, def: { op: 'circle3', args: [{ s: 's1' }, { zp: 'f77', kind: 'zeros', id: 'q9', i: 1 }, { s: 's2' }], fill: 'none' } }],
    [{ type: 'zp', params: { a: '1', zeros: '5, 1+i', poles: '' }, on: true }]);
    K.syncSteps(S, env);
    const v = K.validate(S, env); rec(S);
    const c = sh(S, 'c');
    ok(v.freed === 0 && c.def.args[1].zp === S.steps[0].uid && !c.cundef && Math.abs(K.level(c._g, [1, 1])[0]) < 1e-14, 'refs: a stripped state rebinds the zero ref to f1 by its index', c.def.args[1]);
  }
  {
    // handle refs, piece refs, infinity, image refs [C23]
    const S = state([pt('s1', [0, 0]), { id: 'g', kind: 'segment', a: [1, 1], b: [3, 2], ci: 0, visible: true },
      { id: 'l', kind: 'line', a: [9, 9], b: [8, 8], ci: 0, visible: true, at: { a: { s: 's1' }, b: { s: 'g', h: 'b' } } },
      { id: 'c', kind: 'circle', c: [0, 0], r: 1, ci: 0, visible: true, def: { op: 'circle3', args: [{ s: 's1' }, { s: 'g', h: 'a' }, { inf: 1 }], fill: 'none' } }]);
    rec(S);
    const l = sh(S, 'l'), c = sh(S, 'c');
    ok(nearP(l.a, [0, 0]) && nearP(l.b, [3, 2]), 'refs: a line bound to z0 and the end of Segment 1 follows them', [l.a, l.b]);
    ok(c.kind === 'line' && c._g.A === 0 && Math.abs(K.level(c._g, [1, 1])[0]) < 1e-15, 'refs: circle(z0, start of Segment 1, ∞) is the line through them', c.kind);
    sh(S, 'g').b = [5, -1]; rec(S, { shapes: ['g'] });
    ok(nearP(l.b, [5, -1]), 'refs: moving the segment\'s end moves the bound line (downstream recompute)');
    // image refs: z0'' = F(z0) follows a chain change
    let F = (z) => (z === K.INF ? null : [2 * z[0], 2 * z[1]]);
    const T = state([pt('s1', [1, 1])], [], [pt('t1', [0, 0], { at: { p: { img: 's1' } } })]);
    K.recompute(T, { all: true }, mkEnv((z) => F(z)));
    ok(nearP(sh(T, 't1').p, [2, 2]), 'refs: a target bound to F(z0) sits there');
    F = (z) => (z === K.INF ? null : [z[0] * z[0] - z[1] * z[1], 2 * z[0] * z[1]]);
    K.recompute(T, { chain: true }, mkEnv((z) => F(z)));
    ok(nearP(sh(T, 't1').p, [0, 2]), 'refs: it follows a chain change (F = z²)', sh(T, 't1').p);
  }

  // ------------------------------------------------ collinear by incidence (2000 random cases each)
  {
    let bad = { meet: 0, glider: 0, mid: 0, handle: 0 };
    for (let i = 0; i < 2000; i++) {
      const P = [rf(-4, 4), rf(-4, 4)], Q = [rf(-4, 4), rf(-4, 4)], O = [rf(-1, 1), rf(-1, 1)];
      const S = state([pt('P', P), pt('Q', Q),
        { id: 'L', kind: 'segment', a: P, b: Q, ci: 0, visible: true, at: { a: { s: 'P' }, b: { s: 'Q' } } },
        { id: 'k', kind: 'circle', c: O, r: 5, ci: 0, visible: true },
        pt('X', [0, 0], { def: { op: 'meet', args: [{ s: 'L', part: 0 }, { s: 'k', part: 0 }], index: 'finite' } }),
        pt('T', [0, 0], { t: rf(0, 1), def: { op: 'glider', args: [{ s: 'L', part: 0 }] } }),
        pt('M', [0, 0], { def: { op: 'midpoint', args: [{ s: 'P' }, { s: 'Q' }] } }),
        { id: 'h', kind: 'segment', a: [0, 0], b: [1, 1], ci: 0, visible: true, at: { a: { s: 'T' } } },
        { id: 'c1', kind: 'disc', c: [0, 0], r: 1, ci: 0, visible: true, def: { op: 'circle3', args: [{ s: 'P' }, { s: 'Q' }, { s: 'T' }], fill: 'in' } },
        { id: 'c2', kind: 'disc', c: [0, 0], r: 1, ci: 0, visible: true, def: { op: 'circle3', args: [{ s: 'M' }, { s: 'Q' }, { s: 'P' }], fill: 'in' } },
        { id: 'c3', kind: 'disc', c: [0, 0], r: 1, ci: 0, visible: true, def: { op: 'circle3', args: [{ s: 'P' }, { s: 'h', h: 'a' }, { s: 'Q' }], fill: 'in' } },
      ]);
      // the meet: the segment is inside the circle of radius 5 around O only partly; use a line instead when off
      rec(S);
      if (sh(S, 'c1').kind !== 'halfplane' || sh(S, 'c1')._g.A !== 0) bad.glider++;
      if (sh(S, 'c2').kind !== 'halfplane' || sh(S, 'c2')._g.A !== 0) bad.mid++;
      if (sh(S, 'c3').kind !== 'halfplane' || sh(S, 'c3')._g.A !== 0) bad.handle++;
      const S2 = state([pt('P', P), pt('Q', Q), { id: 'L', kind: 'line', a: P, b: Q, ci: 0, visible: true, at: { a: { s: 'P' }, b: { s: 'Q' } } },
        { id: 'k', kind: 'circle', c: O, r: 9, ci: 0, visible: true },
        pt('X', [0, 0], { def: { op: 'meet', args: [{ s: 'L', part: 0 }, { s: 'k', part: 0 }], index: 0 } }),
        { id: 'c', kind: 'disc', c: [0, 0], r: 1, ci: 0, visible: true, def: { op: 'circle3', args: [{ s: 'P' }, { s: 'Q' }, { s: 'X' }], fill: 'in' } }]);
      rec(S2);
      if (sh(S2, 'X').cundef || sh(S2, 'c').kind !== 'halfplane' || sh(S2, 'c')._g.A !== 0) bad.meet++;
    }
    ok(!bad.meet && !bad.glider && !bad.mid && !bad.handle, 'incidence: circle3(P, Q, X) is a half-plane with A = 0 for X = a meet with line(P, Q), a glider on it, the midpoint, a handle bound to such a point (2000 random cases each)', bad);
  }
  // ------------------------------------------------ continuity: disc -> half-plane -> complement; sign(A) exact
  {
    const S = state([pt('P', [-1, 0]), pt('Q', [1, 0]), pt('R', [0.3, 2e-6]),
      { id: 'c', kind: 'disc', c: [0, 0], r: 1, ci: 0, visible: true, def: { op: 'circle3', args: [{ s: 'P' }, { s: 'Q' }, { s: 'R' }], fill: 'in' } }]);
    // (samples near the defining points: far from P and Q the curve moves |z - P||z - Q| / |R - P||R - Q| times as far as R)
    const zs = [[0.2, 0.7], [-0.5, 0.2], [0.9, -0.1], [0.4, -0.3]];
    let prev = null, maxStep = 0;
    const fam = [];
    for (let j = 0; j <= 40; j++) {
      sh(S, 'R').p = [0.3, 2e-6 - j * 1e-7];
      rec(S, { shapes: ['R'] });
      const c = sh(S, 'c'), L = Region.levelOf(c);
      const v = zs.map((z) => L(C(z[0], z[1])));
      if (prev) maxStep = Math.max(maxStep, ...v.map((x, i) => Math.abs(x - prev[i])));
      prev = v;
      const f = c.kind + (c.complement ? '~' : '');
      if (fam[fam.length - 1] !== f) fam.push(f);
    }
    ok(maxStep < 1e-6 && fam.join() === 'disc,halfplane,disc~', 'continuity: the level at fixed points changes < 1e-6 per 1e-7 step; disc -> half-plane -> complement', { maxStep, fam });
    let wrong = 0;
    for (let i = 0; i < 100000; i++) {
      const p = [0.5 + Math.floor(rnd() * 64) * 2 ** -53, 0.5 + Math.floor(rnd() * 64) * 2 ** -53];
      const g = K.circle3(p, [12, 12], [24, 24]);
      const o = K.orient(p, [12, 12], [24, 24]);
      if (!g) continue;
      if (Math.sign(g.A) !== Math.sign(o)) wrong++;
    }
    ok(wrong === 0, 'exact: sign(A) equals the exact predicate in 1e5 near-collinear cases [C10]', wrong);
  }
  // ------------------------------------------------ exact levels: Region's level sign = the exact incircle sign
  {
    // the exact incircle predicate (BigInt on the doubles), oriented: > 0 left of P -> Q -> R's circle (inside a ccw one)
    const F64 = new Float64Array(1), U32 = new Uint32Array(F64.buffer);
    const dec = (x) => { if (x === 0) return [0n, 0]; F64[0] = x; const lo = U32[0], hi = U32[1], ex = (hi >>> 20) & 0x7ff; let m = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo), e; if (ex === 0) e = -1074; else { m |= 1n << 52n; e = ex - 1075; } return [hi >>> 31 ? -m : m, e]; };
    const incircle = (a, b, c, d) => {
      const ds = [a, b, c, d].flat().map(dec), E = Math.min(...ds.filter((x) => x[0] !== 0n).map((x) => x[1]), 0);
      const v = ds.map(([m, e]) => m << BigInt(e - E));
      const [ax, ay, bx, by, cx, cy, dx, dy] = v;
      const adx = ax - dx, ady = ay - dy, bdx = bx - dx, bdy = by - dy, cdx = cx - dx, cdy = cy - dy;
      const det = (adx * adx + ady * ady) * (bdx * cdy - cdx * bdy) - (bdx * bdx + bdy * bdy) * (adx * cdy - cdx * ady) + (cdx * cdx + cdy * cdy) * (adx * bdy - bdx * ady);
      return det > 0n ? 1 : det < 0n ? -1 : 0;
    };
    const res = {};
    for (const R of [1, 1e3, 1e6, 1e9, Infinity]) {
      // three points on a circle of radius R through a neighbourhood of 0 (exact doubles, not exactly on it: the
      // circle through these doubles is the reference)
      const P = [-1, 0], Q = [1, 0], Rp = R === Infinity ? [0.25, 0] : [0.25, -(R - Math.sqrt(R * R - 0.0625)) || -0.0625 / (2 * R)];
      const g = K.circle3(P, Q, Rp);
      const s = Object.assign({ id: 'x', kind: g.A === 0 ? 'halfplane' : 'disc', ci: 0, visible: true }, g.A === 0 ? { a: P, b: Q } : { c: K.geomOf(g).c, r: K.geomOf(g).r, complement: g.A < 0 ? true : undefined });
      s._g = g;
      const L = Region.levelOf(s);
      let wrong = 0, n = 0;
      for (let i = 0; i < 20000; i++) {
        const z = [rf(-3, 3), rf(-3, 3)];
        const want = incircle(P, Q, Rp, z), lv = L(C(z[0], z[1]));
        if (want === 0 || Math.abs(lv) < 1e-13) continue;          // on the curve to within rounding of z's level
        n++;
        if ((lv > 0) !== (want > 0)) wrong++;            // (the left side of P -> Q -> R is where the incircle determinant is > 0)
      }
      res[R] = [wrong, n];
    }
    ok(Object.values(res).every(([w, n]) => w === 0 && n > 19000), 'exact: Region\'s level sign = the exact incircle sign on 20000 samples, r = 1, 1e3, 1e6, 1e9 and a line', res);
    // a view 1e4 away from o, after re-anchoring at the view: the re-anchored form agrees with the exact sign
    const P = [-1, 0], Q = [1, 0], Rp = [0.25, -0.0625 / 2e6];
    const g = K.circle3(P, Q, Rp);
    const vc = [1e4, -0.0625 * 1e8 / 2e6 * 0], H = K.reanchor(g, [1e4, -50]);
    let wrong = 0, n = 0;
    for (let i = 0; i < 20000; i++) {
      const z = [1e4 + rf(-3, 3), K.mR(Object.assign({}, H, { C: 0 }), 0)[1] + rf(-3, 3)];
      const want = incircle(P, Q, Rp, z), lv = -K.level(H, z)[0] / 2;
      if (want === 0 || Math.abs(lv) < 1e-10) continue;
      n++;
      if ((lv > 0) !== (want > 0)) wrong++;
    }
    ok(wrong === 0 && n > 19000 && vc, 'exact: a view 1e4 from o, re-anchored there: 20000 samples agree with the exact sign [C5]', { wrong, n });
    // through 0 by incidence: thru0, C = 0 exactly; the Lambda rule is the tangent half-plane, stable at |z| < e^-60 [C9]
    const S = state([pt('O', [0, 0]), pt('Q', [2, 0.5]), pt('R', [-1, 3]),
      { id: 'c', kind: 'disc', c: [0, 0], r: 1, ci: 0, visible: true, def: { op: 'circle3', args: [{ s: 'Q' }, { s: 'O' }, { s: 'R' }], fill: 'in' } }]);
    rec(S);
    const c = sh(S, 'c');
    const px = Inverse.shapePx(c);
    let flips = 0, last = null;
    const gx = c._g.B[0], gy = c._g.B[1];
    for (let k = 0; k < 720; k++) {
      const th = k * Math.PI / 360 + 1e-3;
      const r = px(null, null, null, C(-70, th), C(1, 0), C(0, 1));
      const want = -(gx * Math.cos(th) + gy * Math.sin(th)) > 0;
      if ((r.s > 0) !== want) flips++;
      last = r;
    }
    ok(c._g.thru0 === true && c._g.C === 0 && c._g.o[0] === 0 && c._g.o[1] === 0 && flips === 0 && last, 'exact: a circle through 0 by incidence: thru0, C = 0; the Λ rule is its tangent half-plane at |z| = e^-70', { flips });
  }
  // ------------------------------------------------ sampling: M(R) of a huge circle [C7]
  {
    const R = 1e9, g = K.circle3([-1, 0], [1, 0], [0, -(1 / (2 * R))]);
    const s = { id: 'x', kind: 'circle', c: K.geomOf(g).c, r: K.geomOf(g).r, _g: g, ci: 0, visible: true };
    const win = { x0: -5, x1: 5, y0: -3, y1: 3 };
    const cs = Region.curvesOf(s, win);
    const pts = Region.sampleCurve(cs[0], win);
    let gap = 0, far = Infinity, inWin = 0, sag = 0;
    for (let i = 2; i < pts.length; i += 2) {
      const a = [pts[i - 2], pts[i - 1]], b = [pts[i], pts[i + 1]];
      const inside = (p) => p[0] >= win.x0 && p[0] <= win.x1 && p[1] >= win.y0 && p[1] <= win.y1;
      if (inside(a) && inside(b)) { inWin++; gap = Math.max(gap, Math.hypot(b[0] - a[0], b[1] - a[1])); sag = Math.max(sag, Math.abs(K.level(g, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2])[0] / 2), Math.abs(K.level(g, a)[0] / 2)); }
      const m = Math.hypot(b[0], b[1]); if (m > 0) far = Math.min(far, 1 / m);
    }
    const px = 10 / 1000, step = Math.hypot(10, 6) / 700;
    ok(cs.length === 1 && cs[0].gsamp && gap <= step * 1.001 && sag < 1e-3 * px && inWin > 500 && far < 1e-6, 'sampling: a gcircle of r = 1e9: in the view the samples are a line\'s (diag / 700 apart), on the curve and their chords within 1e-3 px of it; its far arc is there (under 1/z within 1e-6 of 0)', { gap, sag, inWin, far, n: pts.length / 2 });
    const small = Region.curvesOf({ id: 'y', kind: 'circle', c: [0, 0], r: 2, ci: 0, visible: true }, win);
    ok(small.length === 1 && !small[0].gsamp, 'sampling: an ordinary circle keeps the 160-angle path (goldens unchanged)');
  }
  // ------------------------------------------------ formOf readers: capOf [C8]
  {
    const s0 = { id: 'a', kind: 'disc', c: [0.3, -0.2], r: 1, ci: 0, visible: true };
    const g = K.circleCP([0.3, -0.2], [1.3, -0.2]);
    const c0 = Region.Globe.capOf(s0), c1 = Region.Globe.capOf(Object.assign({}, s0, { _g: g }));
    ok(c0 && c1 && c0.C.every((x, i) => Math.abs(x - c1.C[i]) < 1e-12) && Math.abs(c0.h - c1.h) < 1e-12, 'formOf: capOf from the form equals today\'s cap (r = 1)', [c0, c1]);
    const gt = K.circle3([-1, 0], [1, 0], [0, -1e-15]);
    const cap = Region.Globe.capOf({ id: 'b', kind: 'disc', c: K.geomOf(gt).c, r: K.geomOf(gt).r, _g: gt, ci: 0, visible: true });
    // exact: the three points lie on the cap's rim (P.C = h on the sphere)
    const on = [[-1, 0], [1, 0], [0, -1e-15]].map((z) => { const P = Region.Globe.lift(z[0], z[1]); return Math.abs(P[0] * cap.C[0] + P[1] * cap.C[1] + P[2] * cap.C[2] - cap.h); });
    ok(on.every((e) => e < 1e-15), 'formOf: the cap of a circle with A = 1e-15 passes through its three points on the sphere', on);
  }
  // ------------------------------------------------ intersections [C6, C28]
  {
    // L2 turned through parallel in 41 steps: the 'finite' meet goes to infinity and comes back
    const S = state([pt('a', [0, 0]), pt('b', [1, 0]), pt('c', [0, 1]), pt('d', [1, 1]),
      { id: 'L1', kind: 'line', a: [0, 0], b: [1, 0], ci: 0, visible: true, at: { a: { s: 'a' }, b: { s: 'b' } } },
      { id: 'L2', kind: 'line', a: [0, 1], b: [1, 1], ci: 0, visible: true, at: { a: { s: 'c' }, b: { s: 'd' } } },
      pt('X', [0, 0], { def: { op: 'meet', args: [{ s: 'L1', part: 0 }, { s: 'L2', part: 0 }], index: 'finite' } })]);
    const seen = [];
    for (let j = 0; j <= 40; j++) {
      sh(S, 'd').p = [1, 1 + (j - 20) * 0.01];
      rec(S);
      const X = sh(S, 'X');
      seen.push(X._atInf ? 'I' : X.cundef ? 'U' : 'F');
    }
    const s = seen.join('');
    ok(s === 'F'.repeat(20) + 'I' + 'F'.repeat(20) && sh(S, 'X')._note == null, 'intersections: two lines turned through parallel: the finite crossing, ∞ once, finite again [C6]', s);
    sh(S, 'd').p = [1, 1]; rec(S);
    ok(sh(S, 'X')._atInf && sh(S, 'X')._note === 'parallel' && !sh(S, 'X').cundef, 'intersections: parallel lines meet at ∞ ("They meet only at ∞")');
    // off a segment: undefined
    const T = state([{ id: 'g', kind: 'segment', a: [0, 0], b: [1, 0], ci: 0, visible: true }, { id: 'k', kind: 'circle', c: [3, 0], r: 1, ci: 0, visible: true },
      pt('X', [0, 0], { def: { op: 'meet', args: [{ s: 'g', part: 0 }, { s: 'k', part: 0 }], index: 0 } })]);
    rec(T);
    ok(sh(T, 'X').cundef && sh(T, 'X').cundef.code === 'nomeet', 'intersections: a crossing off the segment is undefined ("The curves do not meet here")');
    sh(T, 'k').c = [0.5, 0.2]; sh(T, 'k').r = 0.3; rec(T);
    ok(!sh(T, 'X').cundef && Math.abs(Math.hypot(sh(T, 'X').p[0] - 0.5, sh(T, 'X').p[1] - 0.2) - 0.3) < 1e-14, 'intersections: and comes back when it is on it');
    // meetNear = the all-pairs solver; traced curves near a seed
    let same = 0, n = 0;
    for (let i = 0; i < 300; i++) {
      const A = { id: 'A', kind: 'circle', c: [rf(-1, 1), rf(-1, 1)], r: rf(0.5, 2) }, B = { id: 'B', kind: 'line', a: [rf(-2, 2), rf(-2, 2)], b: [rf(-2, 2), rf(-2, 2)] };
      const pa = K.pieces(A)[0], pb = K.pieces(B)[0], z = [rf(-2, 2), rf(-2, 2)];
      const all = K.meets(pa, pb).filter((m) => m.z && m.z !== K.INF);
      const nr = K.meetNear(pa, pb, z, null);
      if (!all.length) { if (!nr) same++; n++; continue; }
      all.sort((p, q) => Math.hypot(p.z[0] - z[0], p.z[1] - z[1]) - Math.hypot(q.z[0] - z[0], q.z[1] - z[1]));
      n++;
      if (nr && nearP(nr.z, all[0].z, 1e-14) && nr.index === all[0].index) same++;
    }
    ok(same === n, 'intersections: meetNear picks the crossing nearest the pointer, with its entering-rule index (300 cases) [C28]', [same, n]);
    const tr = { id: 'f', kind: 'curve', pts: Array.from({ length: 200 }, (_, i) => [-2 + i * 0.02, Math.sin(-2 + i * 0.02)]) };
    const ln = K.pieces({ id: 'l', kind: 'line', a: [0, 0.5], b: [1, 0.5] })[0];
    const m = K.meetNear(K.pieces(tr)[0], ln, [0.5, 0.5], null);
    ok(m && m.seed && Math.abs(m.z[1] - 0.5) < 1e-12 && Math.abs(m.z[0] - Math.asin(0.5)) < 1e-3, 'intersections: a freehand curve and a line: the polyline crossing nearest the seed', m);
  }
  // ------------------------------------------------ gliders [C14, C15]
  {
    const S = state([pt('P', [-1, 0]), pt('Q', [0, 1]), pt('R', [1, 0]),
      { id: 'c', kind: 'circle', c: [0, 0], r: 1, ci: 0, visible: true, def: { op: 'circle3', args: [{ s: 'P' }, { s: 'Q' }, { s: 'R' }], fill: 'none' } },
      pt('G', [0, 0], { t: 0.25, def: { op: 'glider', args: [{ s: 'c', part: 0 }] } }),
      { id: 'pg', kind: 'polygon', pts: [[0, 0], [2, 0], [2, 1], [0, 1]], ci: 0, visible: true },
      pt('H', [0, 0], { t: 4.5, def: { op: 'glider', args: [{ s: 'pg', part: 0 }] } }),
      { id: 'k', kind: 'circle', c: [5, 5], r: 2, ci: 0, visible: true },
      pt('J', [0, 0], { t: 1.25, def: { op: 'glider', args: [{ s: 'k', part: 0 }] } }),
      { id: 'sg', kind: 'segment', a: [0, 0], b: [1, 0], ci: 0, visible: true },
      pt('U', [0, 0], { t: 0.5, def: { op: 'glider', args: [{ s: 'sg', part: 0 }] } })]);
    rec(S);
    ok(nearP(sh(S, 'G').p, [0, 1], 1e-14), 'gliders: on circle(P, Q, R), t = 1/4 is Q (S(t) = M(tan πt))', sh(S, 'G').p);
    sh(S, 'G').t = 1.25; rec(S);
    ok(nearP(sh(S, 'G').p, [0, 1], 1e-14), 'gliders: t wraps on circle(P, Q, R) (t = 5/4)');
    ok(nearP(sh(S, 'H').p, [1, 0], 1e-14), 'gliders: t wraps round the corners of a closed polygon (t = 4.5 on 4 sides)', sh(S, 'H').p);
    ok(nearP(sh(S, 'J').p, [5, 7], 1e-14), 'gliders: t wraps on a circle (angle / 360°)', sh(S, 'J').p);
    sh(S, 'U').t = 1.5; rec(S);
    ok(sh(S, 'U').cundef && sh(S, 'U').cundef.code === 'tRange', 'gliders: t out of a segment\'s range is undefined (tRange); a bound t follows the number');
    sh(S, 'U').t = 0.25; rec(S);
    ok(!sh(S, 'U').cundef && nearP(sh(S, 'U').p, [0.25, 0]), 'gliders: back in range (bind.t = a writes s.t, as applyBinds does)');
    const pr = K.projectPiece(K.pieces({ id: 'f', kind: 'curve', pts: [[0, 0], [1, 1]] })[0], [1, 0]);
    ok(pr && pr.seed && pr.t === undefined, 'gliders: a freehand curve has no t (the seed\'s projection)');
    // a bound radius below 1e-3 passes through its point [C15]
    const T = state([pt('c0', [0, 0]), pt('q', [1e-6, 0]), { id: 'd', kind: 'disc', c: [0, 0], r: 1, ci: 0, visible: true, at: { c: { s: 'c0' }, r: { s: 'q' } } }]);
    rec(T);
    ok(sh(T, 'd').r === 1e-6, 'gliders: a radius bound to a point 1e-6 away passes through it (no 1e-3 clamp)', sh(T, 'd').r);
    sh(T, 'q').p = [0, 0]; rec(T);
    ok(sh(T, 'd').cundef && sh(T, 'd').cundef.code === 'coincide', 'gliders: undefined at r = 0 exactly (coincide)');
  }
  // ------------------------------------------------ the graph [C11]
  {
    const S = state([pt('a', [0, 0]), pt('b', [1, 0]), pt('c', [0, 1]),
      { id: 'k', kind: 'disc', c: [0, 0], r: 1, ci: 0, visible: true, def: { op: 'circle3', args: [{ s: 'a' }, { s: 'b' }, { s: 'c' }], fill: 'in' } },
      pt('m', [0, 0], { def: { op: 'midpoint', args: [{ s: 'b' }, { s: 'c' }] } }),
      { id: 'L', kind: 'line', a: [0, 0], b: [1, 1], ci: 0, visible: true, at: { a: { s: 'm' } } },
      pt('x', [0, 0], { def: { op: 'meet', args: [{ s: 'k', part: 0 }, { s: 'L', part: 0 }], index: 0 } })]);
    const G = K.graph(S);
    ok(G.order.join() === 'k,m,L,x', 'graph: Kahn order, ties by list order', G.order);
    K.recompute(S, { all: true }, env);
    const r = K.recompute(S, { shapes: ['b'] }, env);
    ok(K.lastRecompute.n === 4 && r.order.join() === 'k,m,L,x', 'graph: moving b recomputes its closure (k, m, L, x) only', K.lastRecompute);
    K.recompute(S, { shapes: ['L'] }, env);
    ok(K.lastRecompute.n === 2, 'graph: moving L recomputes L and x only', K.lastRecompute);
    const ex = G.excluded('a');
    ok(['a', 'k', 'x', 'b', 'c'].every((x) => ex.has(x)) && !ex.has('m'), 'graph: excluded(a) holds a, what is built on it, and its co-arguments b, c', [...ex]);
    ok(JSON.stringify(K.moveRoots(S, 'k')) === '["a","b","c"]' && K.moveRoots(S, 'x').sort().join() === 'a,b,c', 'graph: moveRoots gives the free root points [C18]', K.moveRoots(S, 'x'));
    // a cycle (only a damaged state has one): the sanitize check frees it
    const T = state([pt('p', [0, 0], { def: { op: 'midpoint', args: [{ s: 'q' }, { s: 'r' }] } }), pt('q', [0, 0], { def: { op: 'midpoint', args: [{ s: 'p' }, { s: 'r' }] } }), pt('r', [1, 1])]);
    const v = K.validate(T, env);
    ok(v.freed === 2 && !sh(T, 'p').def && !sh(T, 'q').def, 'graph: validate frees the shapes on a cycle', v);
    const W = state([pt('p', [0, 0], { def: { op: 'midpoint', args: [{ s: 'zz' }, { s: 'r' }] } }), pt('r', [1, 1]), { id: 'b', kind: 'line', a: [0, 0], b: [1, 1], ci: 0, visible: true, at: { a: { s: 'r', h: 'nope' } } }]);
    const w = K.validate(W, env);
    ok(w.freed === 2 && Array.isArray(sh(W, 'p').p), 'graph: unknown names and handle keys are refused: the shape keeps its fields, free', w);
  }
  // ------------------------------------------------ plans [C16, C17]
  {
    const S = state([pt('a', [0, 0]), pt('b', [2, 0]), pt('c', [0, 2]),
      { id: 'k', kind: 'disc', c: [0, 0], r: 1, ci: 0, visible: true, def: { op: 'circle3', args: [{ s: 'a' }, { s: 'b' }, { s: 'c' }], fill: 'in' } },
      { id: 'g', kind: 'segment', a: [0, 0], b: [3, 3], ci: 0, visible: true, at: { a: { s: 'a' } } },
      pt('h', [0, 0], { helper: true, owner: 'g', def: { op: 'meet', args: [{ s: 'k', part: 0 }, { s: 'g', part: 0 }], index: 0 } }),
      pt('m', [0, 0], { def: { op: 'midpoint', args: [{ s: 'a' }, { s: 'c' }] } })]);
    rec(S);
    const p1 = K.deletePlan(S, ['a']);
    ok(p1.del.sort().join() === 'a,h,k,m' && p1.freed.length === 1 && p1.freed[0].id === 'g' && p1.freed[0].key === 'a', 'plans: deleting z0 deletes what is defined on it (and the helper through k); the segment\'s binding is freed', p1);
    const p2 = K.deletePlan(S, ['g']);
    ok(p2.del.sort().join() === 'g,h', 'plans: a helper goes with its owner when nothing else uses it', p2);
    S.shapes.push(pt('u', [0, 0], { def: { op: 'midpoint', args: [{ s: 'h' }, { s: 'b' }] } }));
    const p3 = K.deletePlan(S, ['g']);
    ok(p3.del.sort().join() === 'g,h,u', 'plans: (a helper another construction uses is deleted with that construction, by definition)', p3);
  }
  // ------------------------------------------------ save and load
  {
    const S = state([pt('a', [0.1, 0]), pt('b', [2, 0.3]), pt('c', [0, 2]),
      { id: 'k', kind: 'disc', c: [0, 0], r: 1, ci: 0, visible: true, def: { op: 'circle3', args: [{ s: 'a' }, { s: 'b' }, { s: 'c' }], fill: 'in' } },
      { id: 'l', kind: 'line', a: [0, 0], b: [1, 1], ci: 0, visible: true, at: { a: { s: 'a' }, b: { s: 'c' } } },
      pt('x', [0, 0], { def: { op: 'meet', args: [{ s: 'k', part: 0 }, { s: 'l', part: 0 }], index: 1 } }),
      pt('y', [0, 0], { t: 0.3, def: { op: 'glider', args: [{ s: 'k', part: 0 }] } })], [{ type: 'zp', params: { a: '1', zeros: '1', poles: '' }, on: true }]);
    K.syncSteps(S, env); rec(S);
    const noRt = (k, v) => (typeof k === 'string' && k[0] === '_' ? undefined : v);
    const saved = JSON.stringify(S, noRt);
    const L = JSON.parse(saved);
    K.syncSteps(L, env); const v = K.validate(L, env); K.recompute(L, { all: true }, env);
    ok(v.freed === 0 && JSON.stringify(L, noRt) === saved, 'save: save -> load -> recompute is bitwise identical for every field (definitions are the truth)');
    const B = JSON.parse(saved);
    B.shapes[5].def.args[0].s = 'gone';
    K.syncSteps(B, env); const vb = K.validate(B, env);
    ok(vb.freed === 1 && !B.shapes[5].def && Array.isArray(B.shapes[5].p), 'save: a broken ref keeps the shape, free, with its fields; one count for one event', vb);
  }
  // ------------------------------------------------ two owners of visibility [C2]
  {
    const S = state([pt('a', [0, 0]), pt('b', [0, 0]), pt('m', [0, 0], { visible: false, undef: 'r = -1', undefHid: true, def: { op: 'bisector', args: [{ s: 'a' }, { s: 'b' }] } })]);
    const s = sh(S, 'm');
    s.kind = 'line'; s.a = [0, 0]; s.b = [1, 0];
    rec(S);
    ok(s.cundef && s.cHid && s.visible === false, 'owners: a construction hidden by a bound field, then undefined: both owners hide it');
    sh(S, 'b').p = [1, 0]; rec(S);
    ok(!s.cundef && !s.cHid && s.visible === false, 'owners: defined again, it stays hidden while the bound field hides it');
  }
  // ------------------------------------------------ speed: a drag with 50 dependents
  {
    const shapes = [pt('a', [0, 0]), pt('b', [1, 0])];
    for (let i = 0; i < 50; i++) shapes.push(pt('p' + i, [Math.cos(i), Math.sin(i) + 2]), { id: 'k' + i, kind: 'disc', c: [0, 0], r: 1, ci: 0, visible: true, def: { op: 'circle3', args: [{ s: 'a' }, { s: 'b' }, { s: 'p' + i }], fill: 'in' } });
    const S = state(shapes);
    rec(S);
    const c0 = process.cpuUsage();
    for (let f = 0; f < 600; f++) { sh(S, 'a').p = [Math.cos(f / 50) * 0.1, Math.sin(f / 50) * 0.1]; K.recompute(S, { shapes: ['a'] }, env); }
    const c = process.cpuUsage(c0), ms = (c.user + c.system) / 1000 / 600;
    ok(ms < 1 * SPEED, `speed: a drag with 50 dependent discs: ${ms.toFixed(3)} ms CPU per recompute`);
  }
};
