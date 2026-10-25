// Section D of test/t_constr.js: the v16 review fixes (notes/constructions-v16/review-*.json, ledger.json).
// Not a test of its own (no t_ prefix): t_constr.js calls it with its helpers.
'use strict';
module.exports = function ({ K, ok }) {
  let seed = 7;
  const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const env = { zp: () => null, zpAll: () => [], F: (z) => z };
  const pt = (id, p, extra) => Object.assign({ id, kind: 'point', p, ci: 0, visible: true }, extra || {});
  const state = (shapes, steps) => ({ shapes, targets: [], steps: steps || [], nextId: 100 });
  const sh = (S, id) => S.shapes.find((s) => s.id === id);
  const rec = (S, e) => K.recompute(S, { all: true }, e || env);
  const dist = (G, z) => Math.abs(K.level(G, z)[0] / 2);
  // a slanted, nearly collinear triple with circumradius about r (the middle point lifted off the chord by h)
  const triple = (r) => {
    const ang = rnd() * Math.PI, u = [Math.cos(ang), Math.sin(ang)], n = [-u[1], u[0]], o = [rnd() * 4 - 2, rnd() * 4 - 2];
    const L = 0.5 + rnd(), h = L * L / (2 * r);
    return [[o[0] - L * u[0], o[1] - L * u[1]], [o[0] + h * n[0] + 0.3 * L * u[0], o[1] + h * n[1] + 0.3 * L * u[1]], [o[0] + L * u[0], o[1] + L * u[1]]];
  };

  // ------------------------------------------------ math-1: reanchor and M(R) samples never go through the centre
  {
    let worstC = 0, worstS = 0, n = 0;
    for (let k = 0; k < 60; k++) {
      const r = 10 ** (6 + (k % 11));
      const P = triple(r), G = K.circle3(...P);
      if (!G || G.A === 0) continue;
      n++;
      const win = { x0: -3, x1: 3, y0: -3, y1: 3 };
      const H = K.reanchor(G, [0.1, 0.2]);
      worstC = Math.max(worstC, Math.abs(H.C) / (1 + Math.hypot(H.o[0], H.o[1])));
      const pts = K.sampleMR(G, win, 0.01);
      for (let i = 0; i < pts.length; i += 2) {
        const z = [pts[i], pts[i + 1]];
        if (Math.abs(z[0]) > 3 || Math.abs(z[1]) > 3) continue;
        worstS = Math.max(worstS, dist(G, z) / (1 + Math.hypot(z[0], z[1])));
      }
    }
    ok(n > 40 && worstC < 1e-12, `math-1: reanchor at r = 1e6…1e16: |C'| / (1 + |o'|) ≤ ${worstC.toExponential(1)} (< 1e-12)`);
    ok(worstS < 1e-12, `math-1: every M(R) sample in the window is on the form: ≤ ${worstS.toExponential(1)} × (1 + |z|)`);
  }
  // ------------------------------------------------ math-2: two big circles meet on both forms (radical axis)
  {
    let worst = 0, n = 0;
    for (let k = 0; k < 60; k++) {
      const r = 10 ** (6 + (k % 11));
      const P = triple(r), Q = triple(r * (0.5 + rnd()));
      const G1 = K.circle3(...P), G2 = K.circle3(...Q);
      if (!G1 || !G2 || G1.A === 0 || G2.A === 0) continue;
      for (const z of K.meets0(G1, G2)) {
        if (!Array.isArray(z) || Math.hypot(z[0], z[1]) > 10) continue;
        n++;
        worst = Math.max(worst, dist(G1, z), dist(G2, z));
      }
    }
    ok(n > 10 && worst < 1e-12, `math-2: ${n} near crossings of two circles of radius 1e6…1e16 lie on both forms to ${worst.toExponential(1)}`);
    const A = [[0.3, 0.2], [0.6, 0.4], [0.9, 0.6]], B = [[-0.2, 0.3], [-0.4, 0.6], [-0.6, 0.9]];
    const S = state([pt('a', A[0]), pt('b', A[1]), pt('c', A[2]), pt('d', B[0]), pt('e', B[1]), pt('f', B[2]),
      { id: 'C1', kind: 'circle', visible: true, def: { op: 'circle3', args: [{ s: 'a' }, { s: 'b' }, { s: 'c' }], fill: 'none' } },
      { id: 'C2', kind: 'circle', visible: true, def: { op: 'circle3', args: [{ s: 'd' }, { s: 'e' }, { s: 'f' }], fill: 'none' } },
      { id: 'M', kind: 'point', visible: true, def: { op: 'meet', args: [{ s: 'C1', part: 0 }, { s: 'C2', part: 0 }], index: 'finite' } }]);
    rec(S);
    const m = sh(S, 'M');
    ok(Array.isArray(m.p) && Math.hypot(m.p[0], m.p[1]) < 1e-15, 'math-2 / math-3: the grid lines through (0.3,0.2)… and (-0.2,0.3)… meet at 0', m.p);
  }
  // ------------------------------------------------ math-3: collinear grid triples are lines
  {
    let bad = 0, n = 0;
    for (const step of [0.1, 0.05, 0.01]) {
      for (let k = 0; k < 400; k++) {
        const i = Math.floor(rnd() * 40) - 20, j = Math.floor(rnd() * 40) - 20, di = Math.floor(rnd() * 7) - 3, dj = Math.floor(rnd() * 7) - 3;
        if (!di && !dj) continue;
        const a = Math.floor(rnd() * 5) + 1, b = a + Math.floor(rnd() * 5) + 1;
        const g = (x) => +(x * step).toPrecision(12);
        const P = [g(i), g(j)], Q = [g(i + a * di), g(j + a * dj)], R = [g(i + b * di), g(j + b * dj)];
        n++;
        const G = K.circle3(P, Q, R);
        if (!G || G.A !== 0) bad++;
      }
    }
    ok(!bad, `math-3: ${n} collinear triples on the 0.1, 0.05 and 0.01 grids are lines (A = 0): ${bad} are not`);
    const G = K.circle3([0.1, 0.3], [0.4, 1.2], [0.7, 2.1]);
    ok(G && G.A === 0 && dist(G, [0.1, 0.3]) === 0 && dist(G, [0.4, 1.2]) < 1e-16, 'math-3: the line through (0.1,0.3), (0.4,1.2) passes through both exactly');
    const S = state([pt('a', [0.1, 0.3]), pt('b', [0.4, 1.2]), pt('c', [0.7, 2.1]),
      { id: 'D', kind: 'disc', visible: true, def: { op: 'circle3', args: [{ s: 'a' }, { s: 'b' }, { s: 'c' }], fill: 'in' } }]);
    rec(S);
    ok(sh(S, 'D').kind === 'halfplane', 'math-3: the region through three grid points on a line is a half-plane', sh(S, 'D').kind);
    const G2 = K.circle3([0, 0], [1, 0], [0.5, 1e-9]);
    ok(G2.A !== 0, 'math-3: a non-decimal-collinear triple keeps its circle');
  }
  // ------------------------------------------------ math-4: a glider on a polygon is on no side's line
  {
    const S = state([{ id: 'Q', kind: 'polygon', pts: [[0, 0], [4, 0], [4, 4], [0, 4]], visible: true },
      { id: 'X1', kind: 'line', a: [1, -1], b: [1, 5], visible: true }, { id: 'X2', kind: 'line', a: [2, -1], b: [2, 5], visible: true },
      { id: 'M1', kind: 'point', visible: true, def: { op: 'meet', args: [{ s: 'Q', part: 0 }, { s: 'X1', part: 0 }], index: 'finite' } },
      { id: 'M2', kind: 'point', visible: true, def: { op: 'meet', args: [{ s: 'Q', part: 0 }, { s: 'X2', part: 0 }], index: 'finite' } },
      { id: 'G', kind: 'point', t: 2.5, visible: true, def: { op: 'glider', args: [{ s: 'Q', part: 0 }] } },
      { id: 'C', kind: 'circle', visible: true, def: { op: 'circle3', args: [{ s: 'M1' }, { s: 'M2' }, { s: 'G' }], fill: 'none' } }]);
    rec(S);
    const C = sh(S, 'C');
    ok(C.kind === 'circle' && dist(C._g, sh(S, 'G').p) < 1e-12, 'math-4: the circle through two meets on side 0 and a glider now on side 2 passes through the glider', [C.kind, sh(S, 'G').p]);
    const S2 = state([pt('a', [0, 0]), pt('b', [4, 0]), { id: 'Sg', kind: 'segment', a: [0, 0], b: [4, 0], visible: true, at: { a: { s: 'a' }, b: { s: 'b' } } },
      { id: 'G', kind: 'point', t: 0.3, visible: true, def: { op: 'glider', args: [{ s: 'Sg', part: 0 }] } },
      { id: 'C', kind: 'circle', visible: true, def: { op: 'circle3', args: [{ s: 'a' }, { s: 'b' }, { s: 'G' }], fill: 'none' } }]);
    rec(S2);
    ok(sh(S2, 'C')._g.A === 0 && sh(S2, 'C')._g.byInc, 'math-4: a glider on one bound segment is still collinear by incidence');
  }
  // ------------------------------------------------ math-5: a stored 'finite' on a 3-point circle keeps the nearer crossing
  {
    const mk = (y, index) => state([pt('a', [-1, 0]), pt('b', [1, 0]), pt('c', [3, y]), { id: 'L', kind: 'line', a: [0.25, -1], b: [0.25, 1], visible: true },
      { id: 'C', kind: 'circle', visible: true, def: { op: 'circle3', args: [{ s: 'a' }, { s: 'b' }, { s: 'c' }], fill: 'none' } },
      { id: 'M', kind: 'point', visible: true, p: [0.25, 0], def: { op: 'meet', args: [{ s: 'C', part: 0 }, { s: 'L', part: 0 }], index } }]);
    const S = mk(0, 'finite');
    rec(S);
    const ys = [];
    for (const y of [1e-12, 1e-6, 0.01, 0.5]) { sh(S, 'c').p = [3, y]; rec(S); ys.push(sh(S, 'M').p[1]); }
    ok(ys.every((y) => Math.abs(y) < 0.1), 'math-5: a meet stored as finite while the circle was a line stays at the near crossing', ys);
    const pa = K.pieces(sh(S, 'C'), env)[0], pb = K.pieces(sh(S, 'L'), env)[0];
    sh(S, 'c').p = [3, 0]; rec(S);
    const pa0 = K.pieces(sh(S, 'C'), env)[0];
    ok(K.meets(pa0, pb).length === 2 && pa.kind === 'circle', 'math-5: a 3-point circle that is a line for the moment meets by the entering rule (two points)');
  }
  // ------------------------------------------------ math-6: a definition through its own users is refused
  {
    const S = state([pt('P', [0, 0]), pt('Q', [1, 0]), pt('R', [0, 1]), { id: 'C', kind: 'circle', visible: true, def: { op: 'circle3', args: [{ s: 'P' }, { s: 'Q' }, { s: 'R' }], fill: 'none' } }]);
    rec(S);
    ok(K.wouldCycle(S, 'P', [{ s: 'C', part: 0 }]) && !K.wouldCycle(S, 'P', [{ s: 'Q' }]) && K.wouldCycle(S, 'P', [{ s: 'P' }]), 'math-6: wouldCycle sees a ref to the shape itself or to anything built on it');
  }
  // ------------------------------------------------ math-7: the arc through 3 grid points meets and glides on its form
  {
    const S = state([{ id: 'A', kind: 'arc', a: [0.1, 0.3], m: [0.4, 1.2], b: [0.7, 2.1], visible: true },
      { id: 'L', kind: 'line', a: [-1, 1.5], b: [2, 1.5], visible: true }]);
    const pa = K.pieces(sh(S, 'A'), env)[0], pb = K.pieces(sh(S, 'L'), env)[0];
    const m = K.meetNear(pa, pb, [0.5, 1.5], null);
    ok(m && Math.hypot(m.z[0] - 0.5, m.z[1] - 1.5) < 1e-15, 'math-7: an arc through grid points on a line meets y = 1.5 at (0.5, 1.5)', m);
    const arc = { id: 'B', kind: 'arc', a: [-1, 0], m: [0, 1e-10], b: [1, 0], visible: true };
    const pc = K.pieces(arc, env)[0];
    ok(!K.onPiece(pc, [2, 0]) && !K.onPiece(pc, [-3, 0]) && K.onPiece(pc, [1, 0]), 'math-7: on an arc of radius 5e9, points beyond its ends are off it');
    const g = K.glide(pc, 0.5);
    ok(Math.hypot(g[0], g[1] - 1e-10) < 1e-15, 'math-7: an arc glider at t = 1/2 is its middle point', g);
  }
  // ------------------------------------------------ math-8: parts keep their numbers when a side degenerates
  {
    const S = state([pt('z', [0, 0]), { id: 'Q', kind: 'polygon', pts: [[0, 0], [4, 0], [4, 4], [0, 4]], visible: true, at: { v1: { s: 'z' } } },
      { id: 'L', kind: 'line', a: [-1, 2], b: [5, 2], visible: true },
      { id: 'M', kind: 'point', visible: true, def: { op: 'meet', args: [{ s: 'Q', part: 3 }, { s: 'L', part: 0 }], index: 'finite' } }]);
    rec(S);
    const n = K.pieces(sh(S, 'Q'), env).length;
    ok(n === 4 && !sh(S, 'M').cundef && sh(S, 'M').p[0] === 0, 'math-8: a polygon with a zero-length side keeps 4 parts, and the meet on side 4 stays', [n, sh(S, 'M').p]);
  }
  // ------------------------------------------------ math-9: the creation rule keeps the left of P -> Q when collinear
  {
    const S = state([pt('P', [0, 0]), pt('Q', [1, 0]), pt('R', [0.5, 0]), { id: 'H', kind: 'disc', visible: true, def: { op: 'circle3', args: [{ s: 'P' }, { s: 'Q' }, { s: 'R' }], fill: 'in' } }]);
    rec(S);
    ok(K.level(sh(S, 'H')._g, [0.5, 1])[0] < 0, 'math-9: collinear at creation with R between P and Q: the half-plane left of P -> Q');
  }
  // ------------------------------------------------ math-11: a formula curve's components stay apart
  {
    const comps = [{ pts: [[-3, 1 / -3], [-2, -0.5], [-1, -1], [-0.3, -1 / 0.3]], g: (x, y) => x * y - 1 * 0 + (x * y < 0 ? 0 : 0) - 1 },
      { pts: [[0.3, 1 / 0.3], [1, 1], [2, 0.5], [3, 1 / 3]], g: (x, y) => x * y - 1 }];
    const fc = { id: 'F', kind: 'fcurve', visible: true };
    const e2 = Object.assign({}, env, { trace: () => comps });
    const pf = K.pieces(fc, e2)[0];
    const pl = K.pieces({ id: 'L', kind: 'line', a: [0, 0], b: [1, -1] }, e2)[0];
    ok(!K.meetNear(pf, pl, [0, 0], null), 'math-11: xy = 1 (two branches) does not meet y = -x (no phantom crossing)');
    const pl2 = K.pieces({ id: 'L', kind: 'line', a: [0, 0], b: [1, 1] }, e2)[0];
    const m = K.meetNear(pf, pl2, [1.1, 1.1], null);
    ok(m && Math.abs(m.z[0] - 1) < 1e-14 && Math.abs(m.z[1] - 1) < 1e-14, 'math-11: its meet with y = x is refined to (1, 1) in float64', m && m.z);
  }
  // ------------------------------------------------ math-12: a 3-point circle glider with an argument at infinity
  {
    const P = [0, 0], Q = [1, 0.5], far = [1e12, 5e11];
    const a = K.glide({ kind: 'line' }, 0.1, [P, Q, far]), b = K.glide({ kind: 'line' }, 0.1, [P, Q, K.INF]);
    ok(Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-9, 'math-12: R -> infinity: the glider tends to its limit (no jump)', [a, b]);
  }
  // ------------------------------------------------ regress-1: no step ids are saved, and nextId stays, without refs
  {
    const st = { type: 'zp', params: { a: '1', zeros: '1, 2', poles: '' }, on: true };
    const S = state([pt('a', [0, 0])], [st]);
    const e2 = Object.assign({}, env, { zpAll: (x, kind) => (kind === 'zeros' ? [[1, 0], [2, 0]] : []) });
    K.syncSteps(S, e2);
    const json = JSON.stringify(S, K.idReplacer(S));
    ok(S.nextId === 100 && !/uid|zpIds/.test(json), 'regress-1: a scene without constructions keeps nextId and saves no uid or zpIds', json.length);
    S.shapes.push({ id: 'c', kind: 'circle', visible: true, def: { op: 'circle3', args: [{ s: 'a' }, { zp: st.uid, kind: 'zeros', id: st.zpIds.zeros[0], i: 0 }, { zp: st.uid, kind: 'zeros', id: st.zpIds.zeros[1], i: 1 }], fill: 'none' } });
    ok(/zpIds/.test(JSON.stringify(S, K.idReplacer(S))), 'regress-1: with a ref the step keeps its ids in the save');
  }
  // ------------------------------------------------ user-6: a removed zero is named by its value and rebinds when back
  {
    let zs = [[1, 0.5], [-1, 0]];
    const e2 = Object.assign({}, env, { zp: (x, kind, i) => (kind === 'zeros' ? zs[i] || null : null), zpAll: (x, kind) => (kind === 'zeros' ? zs : []) });
    const st = { type: 'zp', params: {}, on: true };
    const S = state([pt('a', [0, 0]), pt('b', [0, 2])], [st]);
    K.syncSteps(S, e2);
    S.shapes.push({ id: 'c', kind: 'circle', visible: true, def: { op: 'circle3', args: [{ s: 'a' }, { zp: st.uid, kind: 'zeros', id: st.zpIds.zeros[0], i: 0 }, { s: 'b' }], fill: 'none' } });
    rec(S, e2);
    K.zpRemoveId(st, 'zeros', 0); zs = [[-1, 0]]; K.syncSteps(S, e2); rec(S, e2);
    const u = sh(S, 'c').cundef;
    ok(u && u.code === 'zpRemoved' && u.args.v && u.args.v[0] === 1, 'user-6: the removed zero is named by its value', u);
    zs = [[-1, 0], [1, 0.5]]; K.syncSteps(S, e2); rec(S, e2);
    ok(!sh(S, 'c').cundef, 'user-6: a zero added back at the same value takes the construction again');
  }
  // ------------------------------------------------ user-13: the drag roots
  {
    const S = state([pt('a', [0, 0]), pt('b', [2, 0]), { id: 'Sg', kind: 'segment', a: [0, -1], b: [0, 1], visible: true },
      { id: 'M', kind: 'point', visible: true, def: { op: 'meet', args: [{ s: 'Sg', part: 0 }, { s: 'X', part: 0 }], index: 'finite' } },
      { id: 'X', kind: 'line', a: [-1, 0], b: [1, 0], visible: true, at: { a: { s: 'a' } } },
      { id: 'D', kind: 'disc', visible: true, def: { op: 'circle3', args: [{ s: 'b' }, { s: 'M' }, { s: 'Sg', h: 'b' }], fill: 'in' } }]);
    rec(S);
    const keys = K.dragRoots(S, 'D').map(K.refKey);
    ok(keys.includes('s:b') && keys.includes('c:Sg:0') && keys.includes('s:a') && !keys.includes('s:M'), 'user-13: the roots of a disc on a meet point are the free points and curves under it', keys);
  }
};
