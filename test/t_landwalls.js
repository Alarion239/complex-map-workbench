// Landscape walls (notes/landscape-walls/AS-BUILT.md, r2/AS-BUILT.md): the principal surface's mesher rule, replayed on
// the CPU twin of the shaders (gl.js LAND_EDGE_VS, LAND_TF_VS's levels and refined vertices, LAND_VS, LAND_SHEET_VS),
// checked against an independent oracle. Round 2: the adaptive refinement (levels (Lx, Ly) per cell from the chord
// errors at a desktop pane's scale, sides snapped to the lower level) is part of the mesh: 1 to 3 hold for it, and
//   5. smooth walls: the facets' distance from the true height, in px at that scale, at the centroid and edge midpoints
//      of every drawn triangle (cells capped at 16 sub-cells, or kept over a tenth of a pixel, counted apart).
//   1. watertight: every edge of the drawn mesh is shared by two drawn triangles, or lies on the domain's rim, on a
//      cut (between two crossing points: the chord) or on a slit (a cut ending inside a triangle). Anything else is a hole.
//   2. no curtain: no drawn triangle has an edge with a real jump (the oracle: bisection toward the larger height
//      change, a jump > 0.02 H survives at 2^-40 of the edge, as test/wl_diag.js).
//   3. one-sided limits: at each crossing the two banks' heights equal the principal height just on each side.
//   4. exact box clipping (All sheets, linear heights): the clipped polygon stays in |h| <= 1.25 H, its new corners lie
//      on the planes exactly, and the two triangles of a shared edge find the same point.
// Run: node test/t_landwalls.js
global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
try { global.Recognize = require('../src/recognize.js'); } catch (e) { /* optional */ }
const FN = require('../src/funcs.js');
const { C } = CX;
let fails = 0;
const ok = (c, msg) => { if (!c) { fails++; console.log('FAIL', msg); } };
const H = 0.55;
const mk = (steps) => {
  const S = steps.map((s, i) => ({ type: s.type, params: Object.assign(FN.defaults(s.type), s.params || {}), on: true, uid: 'f' + i }));
  const built = S.map((st) => FN.build(st));
  return { S, built, F: FN.stageFunctions(S, built)[S.length] };
};
const cxs = (expr) => ({ type: 'custom', params: { expr, cut: 180 } });
// the GPU's height map (gl.js HEIGHT, modes log / abs / re / im)
function heightOf(mode, mu) {
  return (w) => {
    if (!w || Number.isNaN(w.re) || Number.isNaN(w.im)) return NaN;
    if (mode === 'log') return H * (2 / Math.PI) * Math.atan(Math.log(Math.min(Math.max(CX.abs(w), 1e-37), 3e38)) / 1.4);
    if (mode === 'abs') return H * ((4 / Math.PI) * Math.atan(Math.min(CX.abs(w) / mu, 1e30)) - 1);
    const x = mode === 're' ? w.re : w.im;
    return H * (2 / Math.PI) * Math.atan(Math.max(-1e30, Math.min(1e30, x / mu)));
  };
}
function muOf(F, mode, bx) {
  if (mode === 'log') return 1;
  const v = [];
  for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) {
    const w = F(C(bx.x0 + (i + 0.5) / 32 * (bx.x1 - bx.x0), bx.y0 + (j + 0.5) / 32 * (bx.y1 - bx.y0)));
    const x = mode === 're' ? Math.abs(w.re) : mode === 'im' ? Math.abs(w.im) : CX.abs(w);
    if (Number.isFinite(x)) v.push(x);
  }
  v.sort((a, b) => a - b);
  return v.length ? Math.max(1e-6, v[Math.floor(v.length / 2)]) : 1;
}
// the oracle (independent of the mesher): JUMP or CONT along a -> b
function oracle(h, a, b) {
  let p = a, q = b, hp = h(a), hq = h(b);
  if (!(Math.abs(hq - hp) > 0.02 * H)) return 'cont';
  for (let k = 0; k < 40; k++) {
    const m = C((p.re + q.re) / 2, (p.im + q.im) / 2), hm = h(m);
    if (!Number.isFinite(hm)) return 'nan';
    if (Math.abs(hm - hp) >= Math.abs(hq - hm)) { q = m; hq = hm; } else { p = m; hp = hm; }
  }
  return Math.abs(hq - hp) > 0.02 * H ? 'jump' : 'cont';
}
// the mesher's edge rule (LAND_EDGE_VS, uCutMode 1): the far end against the continuation of the near end's branch
// (every edge), then the midpoint (an edge with a rise over tol: a cut crossed twice), then bisection
const sameBranch = (c, p) => {
  const ac = CX.abs(c), ap = CX.abs(p);
  if (!(ac < 1e30) || !(ap < 1e30)) return true;
  return CX.abs(CX.sub(c, p)) <= 1e-3 * (ac + ap) + 1e-20;
};
let midJumps = 0;
function edgeRule(h, cont, z0, z1, h0, h1) {
  const tol = 2e-3 * H;
  const none = { t: 0.5, jump: false };
  if (!(Number.isFinite(h0) && Number.isFinite(h1))) return none;
  const at = (m) => C(z0.re + (z1.re - z0.re) * m, z0.im + (z1.im - z0.im) * m);
  let lo = 0, hi = 1, hLo = h0, hHi = h1, steps = 14, twice = false;
  if (sameBranch(cont.C(z0, z1), cont.P(z1))) {
    if (!(Math.abs(h1 - h0) > tol)) return none;
    const zm = at(0.5), wp = cont.P(zm), hp = h(zm);
    if (sameBranch(cont.C(z0, zm), wp)) return none;
    hi = 0.5; if (Number.isFinite(hp)) hHi = hp; steps = 13; midJumps++; twice = true;
  }
  for (let k = 0; k < steps; k++) {
    const m = 0.5 * (lo + hi), zm = at(m);
    const wp = cont.P(zm), hp = h(zm);
    if (sameBranch(cont.C(z0, zm), wp)) { lo = m; if (Number.isFinite(hp)) hLo = hp; } else { hi = m; if (Number.isFinite(hp)) hHi = hp; }
  }
  if (!(Math.abs(hHi - hLo) > tol)) return none;
  return { t: 0.5 * (lo + hi), lo, hi, hLo, hHi, jump: true, twice };
}
// the mesh (LAND_VS): triangles with vertex keys ('v:i,j' a grid corner, 'x:<edge>:<bank>' a crossing)
// the refinement's scale: px per world unit at the fitted camera of a desktop pane (gl.js drawLandscape: 181 at
// 868 x 652); the world spans [-1, 1] along the box's longer side
const PXW = +(process.env.LW_PXW || 181), MIN_PX = 0.1;
function levelOf(e, cellPx) {
  const ep = e * PXW;
  const L = ep > 0.25 ? Math.ceil(0.5 * Math.log2(ep / 0.25)) : 0;
  const Lp = cellPx > MIN_PX ? Math.ceil(Math.log2(cellPx / MIN_PX)) : 0;
  return Math.max(0, Math.min(L, Lp, 4));
}
// (gl.js REFINE levels2): along x the bottom and top sides and the centre's horizontal chord, along y the left and right
// sides and its vertical one; the drawn diagonal goes with the larger
function levels2(hh, m, cellPx) {
  const ex0 = Math.max(Math.abs(m[0] - 0.5 * (hh[0] + hh[1])), Math.abs(m[1] - 0.5 * (hh[2] + hh[3])), Math.abs(m[4] - 0.5 * (m[2] + m[3])));
  const ey0 = Math.max(Math.abs(m[2] - 0.5 * (hh[0] + hh[2])), Math.abs(m[3] - 0.5 * (hh[1] + hh[3])), Math.abs(m[4] - 0.5 * (m[0] + m[1])));
  const ed = Math.max(Math.abs(m[4] - 0.5 * (hh[0] + hh[3])), Math.abs(m[4] - 0.5 * (hh[1] + hh[2])));
  const ex = ex0 >= ey0 ? Math.max(ex0, ed) : ex0, ey = ex0 >= ey0 ? ey0 : Math.max(ey0, ed);
  return [levelOf(ex, cellPx), levelOf(ey, cellPx)];
}
// (gl.js REFINE levelsLat, at rest): the 5 x 5 lattice of quarter cells, the largest second differences along x, y and
// the drawn diagonal (that one with the larger), L = log4(8 D) in px
function levelsLat(lat, cellPx) {
  let dx = 0, dy = 0, dd = 0;
  for (let b = 0; b < 5; b++) for (let a = 1; a < 4; a++) {
    dx = Math.max(dx, Math.abs(lat[b * 5 + a - 1] - 2 * lat[b * 5 + a] + lat[b * 5 + a + 1]));
    dy = Math.max(dy, Math.abs(lat[(a - 1) * 5 + b] - 2 * lat[a * 5 + b] + lat[(a + 1) * 5 + b]));
  }
  for (let b = 1; b < 4; b++) for (let a = 1; a < 4; a++) dd = Math.max(dd, Math.abs(lat[(b - 1) * 5 + a - 1] - 2 * lat[b * 5 + a] + lat[(b + 1) * 5 + a + 1]));
  if (dx >= dy) dx = Math.max(dx, dd); else dy = Math.max(dy, dd);
  const Lp = cellPx > MIN_PX ? Math.ceil(Math.log2(cellPx / MIN_PX)) : 0;
  const SF = +(process.env.LW_SF || 4);   // (gl.js levelD: one level over the quadratic estimate)
  const lD = (D) => { const dp = D * PXW * SF; return dp > 0.125 ? Math.ceil(0.5 * Math.log2(8 * dp)) : 0; };
  return [Math.max(0, Math.min(lD(dx), Lp, 4)), Math.max(0, Math.min(lD(dy), Lp, 4))];
}
// (gl.js REFINE snapV): a sub-grid vertex's position in 16ths of a cell, a side's vertices on the lower level's grid
function snapV(lvAt, c, L, s) {
  const n = [1 << L[0], 1 << L[1]];
  const g = [s[0] * (16 >> L[0]), s[1] * (16 >> L[1])];
  const sx = s[0] === 0 || s[0] === n[0], sy = s[1] === 0 || s[1] === n[1];
  if (sx !== sy) {
    let nb = sx ? lvAt(c[0] + (s[0] === 0 ? -1 : 1), c[1]) : lvAt(c[0], c[1] + (s[1] === 0 ? -1 : 1));
    if (!nb) nb = L;
    const ln = [Math.min(L[0], nb[0]), Math.min(L[1], nb[1])];
    if (sx) { const st = 16 >> ln[1]; g[1] = Math.floor((2 * g[1] + st - 1) / (2 * st)) * st; } else { const st = 16 >> ln[0]; g[0] = Math.floor((2 * g[0] + st - 1) / (2 * st)) * st; }
  }
  return [c[0] * 16 + g[0], c[1] * 16 + g[1]];
}
function mesh(N, bx, h, hc, opts = {}) {
  const Z = (i, j) => C(bx.x0 + i / (N - 1) * (bx.x1 - bx.x0), bx.y0 + j / (N - 1) * (bx.y1 - bx.y0));
  const hv = new Float64Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) hv[j * N + i] = h(Z(i, j));
  const E = new Map();
  const ekey = (a, b) => (a[1] < b[1] || (a[1] === b[1] && a[0] < b[0]) ? `${a}|${b}` : `${b}|${a}`);
  const edgeOf = (a, b) => {
    const rev = b[0] - a[0] < 0 || b[1] - a[1] < 0;
    const o = rev ? b : a, q = rev ? a : b, k = ekey(o, q);
    let e = E.get(k);
    if (!e) { e = edgeRule(h, hc, Z(...o), Z(...q), hv[o[1] * N + o[0]], hv[q[1] * N + q[0]]); e.o = o; e.q = q; e.key = k; E.set(k, e); }
    return e;
  };
  const tris = [];
  let dropped = 0;
  const M = N - 1, BW = bx.x1 - bx.x0, BH = bx.y1 - bx.y0, cellPx = PXW * 2 / M;
  const V = (p) => ({ key: `g:${16 * p[0]},${16 * p[1]}`, p, G: [16 * p[0], 16 * p[1]], z: Z(...p), h: hv[p[1] * N + p[0]] });
  // the levels (LAND_TF_VS pass 1): a cell that touches a real jump, or has a corner not finite on a map with cuts,
  // stays at 0
  const cutsMap = opts.cutsMap ?? [...Array(1)].some(() => false);
  const LV = new Map();
  const lvAt = (i, j) => (i < 0 || j < 0 || i >= M || j >= M ? null : LV.get(j * M + i) || [0, 0]);
  if (!opts.noRefine) {
    for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
      const cs = [[i, j], [i + 1, j], [i, j + 1], [i + 1, j + 1]], hh = cs.map((q) => hv[q[1] * N + q[0]]);
      const fin = hh.every(Number.isFinite);
      const jumps = edgeOf([i, j], [i + 1, j]).jump || edgeOf([i, j + 1], [i + 1, j + 1]).jump || edgeOf([i, j], [i, j + 1]).jump || edgeOf([i + 1, j], [i + 1, j + 1]).jump || edgeOf([i, j], [i + 1, j + 1]).jump;
      if (jumps || (!fin && cutsMap)) continue;
      const lat = [];
      for (let b = 0; b < 5; b++) for (let a = 0; a < 5; a++) lat.push((a === 0 || a === 4) && (b === 0 || b === 4) ? hh[(b ? 2 : 0) + (a ? 1 : 0)] : h(Z(i + a / 4, j + b / 4)));
      const L = !fin || !lat.every(Number.isFinite) ? [levelOf(1e30, cellPx), levelOf(1e30, cellPx)] : opts.coarse ? levels2(hh, [lat[2], lat[22], lat[10], lat[14], lat[12]], cellPx) : levelsLat(lat, cellPx);
      if (L[0] || L[1]) LV.set(j * M + i, L);
    }
  }
  const Gz = (G) => C(bx.x0 + G[0] / (16 * M) * BW, bx.y0 + G[1] / (16 * M) * BH);
  const hG = new Map();
  const RV = (G) => {
    const key = `g:${G[0]},${G[1]}`;
    if ((G[0] & 15) === 0 && (G[1] & 15) === 0) return V([G[0] >> 4, G[1] >> 4]);
    let hh = hG.get(key);
    if (hh === undefined) { hh = h(Gz(G)); hG.set(key, hh); }
    return { key, G, z: Gz(G), h: hh };
  };
  let refinedCells = 0, refinedTris = 0;
  for (const [ci, L] of LV) {
    const c = [ci % M, Math.floor(ci / M)], n = [1 << L[0], 1 << L[1]];
    refinedCells++;
    for (let sy = 0; sy < n[1]; sy++) for (let sx = 0; sx < n[0]; sx++) for (const tri of [0, 1]) {
      const S = tri === 0 ? [[sx, sy], [sx + 1, sy], [sx + 1, sy + 1]] : [[sx, sy], [sx + 1, sy + 1], [sx, sy + 1]];
      const v = S.map((s) => RV(snapV(lvAt, c, L, s)));
      if (!v.every((q) => Number.isFinite(q.h))) { dropped++; continue; }
      if (v[0].key === v[1].key || v[1].key === v[2].key || v[0].key === v[2].key) continue;   // (a side snapped: degenerate)
      tris.push({ v, whole: true, refined: true, L, cell: c });
      refinedTris++;
    }
  }
  const X = (a, b, bank) => {
    const e = edgeOf(a, b), fromA = e.o[0] === a[0] && e.o[1] === a[1];
    const t = fromA ? e.t : 1 - e.t, za = Z(...a), zb = Z(...b);
    const onO = bank[0] === e.o[0] && bank[1] === e.o[1];
    return { key: `x:${e.key}:${onO ? 'o' : 'q'}`, z: C(za.re + (zb.re - za.re) * t, za.im + (zb.im - za.im) * t), h: onO ? e.hLo : e.hHi, cross: true, e };
  };
  for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) for (const tri of [0, 1]) {
    if (LV.has(j * M + i)) continue;   // (drawn refined)
    const P = tri === 0 ? [[i, j], [i + 1, j], [i + 1, j + 1]] : [[i, j], [i + 1, j + 1], [i, j + 1]];
    if (!P.every((p) => Number.isFinite(hv[p[1] * N + p[0]]))) { dropped++; continue; }
    const j01 = edgeOf(P[0], P[1]).jump, j12 = edgeOf(P[1], P[2]).jump, j20 = edgeOf(P[2], P[0]).jump;
    const J = j01 + j12 + j20;
    // (r2: an edge crossed twice leaves its triangles out, as three crossings do)
    if (J === 3 || edgeOf(P[0], P[1]).twice || edgeOf(P[1], P[2]).twice || edgeOf(P[2], P[0]).twice) { dropped++; continue; }
    const r = J === 1 ? (j01 ? 0 : j12 ? 1 : 2) : J === 2 ? (!j12 ? 0 : !j20 ? 1 : 2) : 0;
    const [A, B, Cc] = [P[r], P[(r + 1) % 3], P[(r + 2) % 3]];
    if (J === 0) tris.push({ v: [V(A), V(B), V(Cc)], whole: true });
    else if (J === 1) { tris.push({ v: [V(A), X(A, B, A), V(Cc)], slit: true }); tris.push({ v: [X(A, B, B), V(B), V(Cc)], slit: true }); }
    else { tris.push({ v: [V(A), X(A, B, A), X(A, Cc, A)] }); tris.push({ v: [X(A, B, B), V(B), V(Cc)] }); tris.push({ v: [X(A, B, B), V(Cc), X(A, Cc, Cc)] }); }
  }
  return { tris, dropped, E, Z, hv, refinedCells, refinedTris, LV, cellPx };
}
const segDist = (p, a, b) => {
  const dx = b.re - a.re, dy = b.im - a.im, L = dx * dx + dy * dy;
  const t = L > 0 ? Math.max(0, Math.min(1, ((p.re - a.re) * dx + (p.im - a.im) * dy) / L)) : 0;
  return Math.hypot(a.re + t * dx - p.re, a.im + t * dy - p.im);
};
function check(name, N, bx, h, hc, opts = {}) {
  const { tris, dropped, E, Z, refinedCells, refinedTris, cellPx } = mesh(N, bx, h, hc, opts);
  // 1. watertight
  const cnt = new Map();
  for (const t of tris) for (let k = 0; k < 3; k++) {
    const a = t.v[k], b = t.v[(k + 1) % 3];
    const key = a.key < b.key ? a.key + '#' + b.key : b.key + '#' + a.key;
    const c = cnt.get(key) || { n: 0, a, b, slit: !!t.slit };
    c.n++; cnt.set(key, c);
  }
  let holes = 0, rimE = 0, cutE = 0, holesAtSing = 0;
  const GM = 16 * (N - 1);
  const onRim = (v) => v.G && (v.G[0] === 0 || v.G[1] === 0 || v.G[0] === GM || v.G[1] === GM);
  const rimEdge = (a, b) => onRim(a) && onRim(b) && (a.G[0] === b.G[0] ? a.G[0] === 0 || a.G[0] === GM : a.G[1] === b.G[1] && (a.G[1] === 0 || a.G[1] === GM));
  for (const c of cnt.values()) {
    if (c.n === 2) continue;
    if (c.n === 1 && c.a.G && c.b.G && rimEdge(c.a, c.b)) { rimE++; continue; }
    if (c.n === 1 && (c.a.cross || c.b.cross)) {
      // a crossing's edge on one bank: the chord between two crossings, a slit, or the part of a cut grid edge on the
      // rim (the crossing lies on the rim)
      const rimX = (v) => v.cross && v.e.o[0] === v.e.q[0] ? (v.e.o[0] === 0 || v.e.o[0] === N - 1) : v.cross && v.e.o[1] === v.e.q[1] && (v.e.o[1] === 0 || v.e.o[1] === N - 1);
      if ((c.a.cross && c.b.cross) || c.slit || ((rimX(c.a) || rimX(c.b)) && (c.a.cross ? onRim(c.b) : onRim(c.a)))) { cutE++; continue; }
    }
    // (an edge at a pole or essential singularity, where a corner is not finite: counted apart)
    const cellW0 = (bx.x1 - bx.x0) / (N - 1);
    if ((opts.sing || []).some((q) => segDist(q, c.a.z, c.b.z) < Math.max(2, opts.singR || 0) * cellW0)) { holesAtSing++; continue; }
    holes++;
  }
  // 2. no curtain: the whole triangles' edges against the oracle (only edges with a height step are tested)
  let curtains = 0, tested = 0, atSing = 0;
  const seen = new Set();
  for (const t of tris) {
    if (!t.whole) continue;
    for (let k = 0; k < 3; k++) {
      const a = t.v[k], b = t.v[(k + 1) % 3], key = a.key < b.key ? a.key + b.key : b.key + a.key;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!(Math.abs(a.h - b.h) > 0.02 * H)) continue;
      tested++;
      if (oracle(h, a.z, b.z) !== 'jump') continue;
      // a pole, essential singularity or branch point lying on the edge itself: the one cell that holds it is drawn
      // (design 3.5, 3.6); counted apart
      // (an essential singularity: within singR cells of it the oscillation outruns any grid, design 3.6)
      const cell = (bx.x1 - bx.x0) / (N - 1);
      if ((opts.sing || []).some((p) => segDist(p, a.z, b.z) < Math.max(1e-9 * (bx.x1 - bx.x0), (opts.singR || 0) * cell))) { atSing++; continue; }
      curtains++; if (process.env.LW_DBG) console.log("curtain", name, a.key, b.key, a.z, b.z, a.h, b.h);
    }
  }
  // 5. smooth walls: the facets against the true height (px at the refinement's scale), at the centroid and the edge
  // midpoints of every drawn whole triangle; a cell at 16 sub-cells along a direction, or whose sub-cells are at the
  // pixel floor, is counted apart (its chord error can stay over the target: a wall narrower than a sixteenth of a cell)
  const errs = [];
  let overQ = 0, overAtCap = 0, worstPx = 0;
  const Lcap = Math.max(0, Math.min(4, Math.ceil(Math.log2(cellPx / 0.1))));
  for (const t of tris) {
    if (!t.whole) continue;
    const [a, b, c] = t.v;
    let e = 0;
    for (const [wa, wb, wc] of [[1 / 3, 1 / 3, 1 / 3], [0.5, 0.5, 0], [0, 0.5, 0.5], [0.5, 0, 0.5]]) {
      const z = C(wa * a.z.re + wb * b.z.re + wc * c.z.re, wa * a.z.im + wb * b.z.im + wc * c.z.im), ht = h(z);
      if (Number.isFinite(ht)) e = Math.max(e, Math.abs(ht - (wa * a.h + wb * b.h + wc * c.h)) * PXW);
    }
    const capped = t.refined ? (t.L[0] >= Lcap || t.L[1] >= Lcap) : false;
    const cell = (bx.x1 - bx.x0) / (N - 1);
    if ((opts.sing || []).some((p) => segDist(p, a.z, b.z) < Math.max(2, opts.singR || 0) * cell || segDist(p, b.z, c.z) < Math.max(2, opts.singR || 0) * cell)) continue;
    errs.push(e);
    if (e > 0.25) { if (capped) overAtCap++; else overQ++; }
    if (!capped) worstPx = Math.max(worstPx, e);
  }
  errs.sort((x, y) => x - y);
  const p99 = errs.length ? errs[Math.floor(0.99 * (errs.length - 1))] : 0;
  // 3. one-sided limits, and every crossing is a real jump at its place
  let limits = 0, notJump = 0, nCross = 0;
  const cellW = (bx.x1 - bx.x0) / (N - 1);
  const nearSing = (za, zb) => (opts.sing || []).some((p) => segDist(p, za, zb) < Math.max(1e-9 * (bx.x1 - bx.x0), (opts.singR || 0) * cellW));
  let crossAtSing = 0;
  for (const e of E.values()) {
    if (!e.jump) continue;
    const z0 = Z(...e.o), z1 = Z(...e.q), at = (s) => C(z0.re + (z1.re - z0.re) * s, z0.im + (z1.im - z0.im) * s);
    if (nearSing(z0, z1)) { crossAtSing++; continue; }
    nCross++;
    const d = Math.pow(2, -12);
    const hl = h(at(Math.max(0, e.lo - d))), hr = h(at(Math.min(1, e.hi + d)));
    // within what the height changes over a few 2^-13 of the edge on each bank
    const sl = Math.abs(h(at(Math.max(0, e.lo - 4 * d))) - hl), sr = Math.abs(h(at(Math.min(1, e.hi + 4 * d))) - hr);
    if (Math.abs(hl - e.hLo) > 2e-3 * H + sl || Math.abs(hr - e.hHi) > 2e-3 * H + sr) limits++;
    if (oracle(h, at(Math.max(0, e.lo - d)), at(Math.min(1, e.hi + d))) !== 'jump' && Math.abs(e.hHi - e.hLo) > 0.02 * H) notJump++;
  }
  const row = { name, N, tris: tris.length, refinedCells, refinedTris, dropped, rimE, cutE, holes, holesAtSing, tested, curtains, atSingularPoint: atSing, crossings: nCross, limits, notJump,
    chordPx: { p99: +p99.toFixed(3), worstBelowCap: +worstPx.toFixed(2), over025: overQ, over025AtCap: overAtCap } };
  console.log(JSON.stringify(row));
  ok(holes === 0, `${name}: ${holes} hole edges`);
  ok(curtains === 0, `${name}: ${curtains} curtains`);
  ok(limits === 0, `${name}: ${limits} crossings off the one-sided limits`);
  ok(notJump === 0, `${name}: ${notJump} crossings where the oracle sees no jump`);
  if (opts.wantCuts) ok(nCross > 0, `${name}: the cut was not found`);
  if (opts.noCuts) ok(nCross === 0, `${name}: ${nCross} crossings on a continuous surface`);
  row.crossAtSingularPoint = crossAtSing;
  ok(dropped <= (opts.maxDropped ?? 4) + 2 * holesAtSing, `${name}: ${dropped} triangles dropped`);
  // (below the cap: at most 0.5 % of the triangles over 0.25 px; those at the cap are reported)
  ok(overQ <= 0.005 * errs.length, `${name}: ${overQ} of ${errs.length} triangles over 0.25 px below the cap (worst ${worstPx.toFixed(2)} px)`);
  return row;
}
const PANE = [868, 624];
const box = (v) => { const b = { x0: v.cx - PANE[0] / 2 / v.s, x1: v.cx + PANE[0] / 2 / v.s, y0: v.cy - PANE[1] / 2 / v.s, y1: v.cy + PANE[1] / 2 / v.s }; const mx = (b.x0 + b.x1) / 2, my = (b.y0 + b.y1) / 2; let w = b.x1 - b.x0, hh = b.y1 - b.y0; if (w > 2 * hh) w = 2 * hh; else if (hh > 2 * w) hh = 2 * w; return { x0: mx - w / 2, x1: mx + w / 2, y0: my - hh / 2, y1: my + hh / 2 }; };
const N = +(process.env.LW_N || 96);
const CASES = [
  ['sqrt', [{ type: 'root', params: { n: 2 } }], { cx: 0, cy: 0, s: 80 }, [['im', { wantCuts: true, sing: [C(0, 0)], singR: 1 }], ['re', { noCuts: true, sing: [C(0, 0)], singR: 1 }], ['log', { noCuts: true, sing: [C(0, 0)], singR: 1 }]]],
  ['log', [{ type: 'log' }], { cx: 0, cy: 0, s: 80 }, [['im', { wantCuts: true, sing: [C(0, 0)], singR: 1 }], ['log', { noCuts: true, sing: [C(0, 0)], singR: 1 }]]],
  ['tan', [{ type: 'tan' }], { cx: 0, cy: 0, s: 60 }, [['re', { noCuts: true, sing: [-3, -1, 1, 3].map((k) => C(k * Math.PI / 2, 0)) }], ['im', { noCuts: true, sing: [-3, -1, 1, 3].map((k) => C(k * Math.PI / 2, 0)) }]]],
  ['recip', [{ type: 'recip' }], { cx: 0, cy: 0, s: 120 }, [['re', { noCuts: true, sing: [C(0, 0)] }], ['abs', { noCuts: true, sing: [C(0, 0)] }]]],
  ['inv-z2p1', [cxs('\\frac{1}{z^2+1}')], { cx: 0, cy: 0, s: 110 }, [['re', { noCuts: true, sing: [C(0, 1), C(0, -1)] }], ['im', { noCuts: true, sing: [C(0, 1), C(0, -1)] }]]],
  ['exp-inv', [cxs('e^{1/z}')], { cx: 0, cy: 0, s: 220 }, [['re', { noCuts: true, sing: [C(0, 0)], singR: 4 }]]],
  ['z-pow-i', [{ type: 'powa', params: { alpha: 'i' } }], { cx: 0, cy: 0, s: 80 }, [['im', { wantCuts: true, sing: [C(0, 0)], singR: 3 }]]],
  ['cbrt-z2m1', [cxs('(z^2-1)^{1/3}')], { cx: 0, cy: 0, s: 110 }, [['im', { wantCuts: true, sing: [C(1, 0), C(-1, 0)], singR: 1 }], ['re', { sing: [C(1, 0), C(-1, 0)], singR: 1 }]]],
  ['gamma-like', [{ type: 'zp', params: { a: '1', zeros: '', poles: '0, -1, -2, -3' } }], { cx: -1.5, cy: 0, s: 110 }, [['re', { noCuts: true, sing: [0, -1, -2, -3].map((k) => C(k, 0)) }]]],
];
const rows = [];
for (const [id, steps, v, modes] of CASES) {
  const { S, built, F } = mk(steps);
  const bx = box(v);
  for (const [m, o] of modes) {
    const mu = muOf(F, m, bx), hf = heightOf(m, mu);
    const h = (z) => hf(F(z));
    const cont = { P: F, C: (zc, z) => FN.sheetEval(S, built, S.length, zc, z, 0, 0, { a: 0 }) };
    rows.push(check(`${id} ${m}`, N, bx, h, cont, o));
  }
}
// the user's case: sin √z with √ bracketed, the deformation H_t (map mode 1 at t), principal branch
{
  const { S, built } = mk([{ type: 'root', params: { n: 2 } }, { type: 'sin' }]);
  const bx = box({ cx: 0, cy: 0, s: 60 });
  for (const t of [0.2, 0.5, 0.8]) {
    const map = { mode: 1, base: 0, hi: 1, a: 0, b: 1, post: 2, t };
    const ht = built[0].hom(t), F = (z) => CX.sin(ht(z));
    for (const m of ['im', 're']) {
      const mu = muOf(F, m, bx), hf = heightOf(m, mu);
      // the continuation agrees with the principal map at its own centre (the GPU's chainSheetHom, combo 0, W = 0)
      const zz = C(0.7, -1.3);
      ok(CX.abs(CX.sub(FN.sheetMapEval(S, built, map, zz, zz, 0, 0), F(zz))) < 1e-9 * (1 + CX.abs(F(zz))), `sinsqrt t=${t}: continuation at its centre is not P`);
      rows.push(check(`sinsqrt t=${t} ${m}`, N, bx, (z) => hf(F(z)), { P: F, C: (zc, z) => FN.sheetMapEval(S, built, map, zc, z, 0, 0) }, { maxDropped: 8 }));
    }
  }
}
// the power paths with a cut of their own (review math-1): z^n at 0 < t < 1 runs z^(1 + (n - 1)t), principal, and
// the natural path of a (z - c)^n the same about c; the continuation (sheetMapEval) runs them on the local cut
{
  const bx = box({ cx: 0.2, cy: 0.1, s: 80 });
  const PP = [
    ['z^2', [{ type: 'pown', params: { n: 2 } }], [0.25, 0.5]],
    ['z^-2', [{ type: 'pown', params: { n: -2 } }], [0.2]],
    ['z^3', [{ type: 'pown', params: { n: 3 } }], [0.3, 0.5]],
    ['(z-1)^3', [{ type: 'poly', params: { co: '1, -3, 3, -1' } }], [0.4]],
  ];
  for (const [id, steps, ts] of PP) {
    const { S, built } = mk(steps);
    for (const t of ts) {
      const map = { mode: 1, base: 0, hi: 1, a: 0, b: 1, post: 1, t };
      const ht = built[0].hom(t), F = (z) => ht(z);
      for (const m of ['im', 're']) {
        const mu = muOf(F, m, bx), hf = heightOf(m, mu);
        const c0 = built[0].natData ? built[0].natData.c : C(0, 0);
        const ex = 1 + ((built[0].natData ? built[0].natData.n : Math.abs(steps[0].params.n)) - 1) * (steps[0].params.n < 0 ? 2 * t : t);
        const wantCuts = m === 'im' && Math.abs(ex - Math.round(ex)) > 1e-9;
        rows.push(check(`${id} t=${t} ${m}`, N, bx, (z) => hf(F(z)), { P: F, C: (zc, z) => FN.sheetMapEval(S, built, map, zc, z, 0, 0) }, { wantCuts, sing: [c0], singR: 1, maxDropped: 8 }));
      }
    }
  }
}
// the cut mode the GPU chooses (gl.js cutModeOf, from GLChain's cutKinds; review math-3): 0 for a chain with no cut,
// 1 for sheet cuts, 2 for cuts the sheets cannot continue; a path counts only at 0 < t < 1
{
  let GL = null;
  try { global.Funcs = FN; GL = require('../src/glsl.js'); } catch (e) { GL = null; }
  if (GL && GL.build) {
    const kinds = (steps) => { const { S, built } = mk(steps); return GL.build(S, built).cutKinds; };
    const how = (m, k) => {
      const mode = m.mode || 0, base = m.base || 0, a = m.a || 0, b = m.b || 0, hi = m.hi || 0, post = m.post || 0;
      if (mode === 0) return k > a && k <= b ? 1 : 0;
      if (mode === 2) return k > base && k <= b ? 1 : 0;
      if (mode === 1) { if (k > base && k < hi) return 1; if (k === hi) return 2; } else if (mode === 3) { if (k > base && k <= a) return 1; if (k > a && k <= b) return 2; }
      return post > b && k > b && k <= post ? 1 : 0;
    };
    // (the same rule as gl.js cutModeOf)
    const modeOf = (ck, m) => {
      let other = false, cut = false; const t = m.t || 0;
      for (const c of ck) { const hw = how(m, c.k); if (!hw) continue; const kd = hw === 2 ? (t <= 0 ? 'none' : t >= 1 ? c.f : c.h) : c.f; if (kd === 'deriv') { if (cut) other = true; continue; } if (kd === 'other') other = true; if (kd !== 'none') cut = true; }
      return !cut ? 0 : other || m.mode === 2 ? 2 : 1;
    };
    const full = (n) => ({ mode: 0, a: 0, b: n });
    const T = [
      ['tan', [{ type: 'tan' }], full(1), 0],
      ['1/z', [{ type: 'recip' }], full(1), 0],
      ['z^2 at rest', [{ type: 'pown', params: { n: 2 } }], full(1), 0],
      ['z^2 at t = 0.5', [{ type: 'pown', params: { n: 2 } }], { mode: 1, hi: 1, b: 1, t: 0.5 }, 1],
      ['sqrt', [{ type: 'root', params: { n: 2 } }], full(1), 1],
      ['arcsin', [{ type: 'arcsin' }], full(1), 2],
      ['Joukowski at rest, then sqrt', [{ type: 'joukowski' }, { type: 'root', params: { n: 2 } }], full(2), 1],
      ['Joukowski at t = 0.5', [{ type: 'joukowski' }], { mode: 1, hi: 1, b: 1, t: 0.5 }, 2],
      ['sin sqrt at t = 0.2', [{ type: 'root', params: { n: 2 } }, { type: 'sin' }], { mode: 1, hi: 1, b: 1, post: 2, t: 0.2 }, 1],
      ['z^2/(cosh z + 3)', [cxs('z^2/(\\cosh z+3)')], full(1), 0],
      // (a root on branch 1, or with its cut at 90 degrees: sheet 0 at a centre is not F there, so bisection)
      ['sqrt, branch 1', [{ type: 'root', params: { n: 2, k: 1 } }], full(1), 2],
      ['sqrt, cut at 90', [{ type: 'root', params: { n: 2, cut: 90 } }], full(1), 2],
      ['log, branch -1', [{ type: 'log', params: { k: -1 } }], full(1), 2],
    ];
    for (const [name, steps, m, want] of T) {
      const got = modeOf(kinds(steps), m);
      console.log(JSON.stringify({ cutMode: name, got, want }));
      ok(got === want, `cut mode of ${name}: ${got}, want ${want}`);
    }
  } else console.log('cut mode: glsl.js not loadable in node, skipped');
}
console.log(JSON.stringify({ midpointJumps: midJumps }));
// 4. the box clip of LAND_SHEET_VS (linear heights): a triangle's polygon in |h| <= Hb
{
  const Hb = 1.25 * H;
  const clip = (Q) => {
    let P = Q.map((q) => ({ ...q, f: 0 }));
    for (const s of [1, -1]) {
      const R = [];
      for (let i = 0; i < P.length; i++) {
        const a0 = P[i], b0 = P[(i + 1) % P.length];
        const inI = s * a0.h <= Hb, inJ = s * b0.h <= Hb;
        if (inI) R.push(a0);
        if (inI !== inJ) {
          const fw = a0.x < b0.x || (a0.x === b0.x && a0.y < b0.y);
          const a = fw ? a0 : b0, b = fw ? b0 : a0;
          const t = Math.min(1, Math.max(0, s * a.h > 0 && s * b.h > 0 && Math.max(Math.abs(a.h), Math.abs(b.h)) > 2 * Hb
            ? (1 / (s * Hb) - 1 / a.h) / (1 / b.h - 1 / a.h) : (s * Hb - a.h) / (b.h - a.h)));
          R.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, h: s * Hb, f: s });
        }
      }
      P = R;
    }
    return P;
  };
  let bad = 0, shared = 0;
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let n = 0; n < 4000; n++) {
    const A = { x: 0, y: 0, h: (rnd() - 0.5) * 6 * H }, B = { x: 1, y: 0, h: (rnd() - 0.5) * 6 * H }, Cq = { x: 1, y: 1, h: (rnd() - 0.5) * 6 * H }, D = { x: 0, y: 1, h: (rnd() - 0.5) * 6 * H };
    const P1 = clip([A, B, Cq]), P2 = clip([A, Cq, D]);
    for (const P of [P1, P2]) {
      if (P.length > 5) bad++;
      for (const p of P) { if (Math.abs(p.h) > Hb + 1e-12) bad++; if (p.f && Math.abs(Math.abs(p.h) - Hb) > 0) bad++; }
    }
    // the diagonal A - C: the points both triangles put on it must be the same
    const onDiag = (P) => P.filter((p) => p.f && Math.abs(p.x - p.y) < 1e-12).map((p) => `${p.x},${p.y},${p.h}`).sort().join(';');
    if (onDiag(P1) !== onDiag(P2)) bad++; else if (onDiag(P1)) shared++;
  }
  console.log(JSON.stringify({ boxClip: { triangles: 8000, bad, sharedDiagonalPoints: shared } }));
  ok(bad === 0, `box clip: ${bad} violations`);
  // at a simple pole the crossing is exact in 1 / h (review math-4): h = c / (p - s) along the edge
  let worst = 0, worstLin = 0;
  for (let n = 0; n < 2000; n++) {
    const p = 1.0005 + rnd() * 2, hA = Hb * (0.05 + 0.9 * rnd()), c = hA * p, hB = c / (p - 1);
    const sTrue = p - c / Hb;
    const P = clip([{ x: 0, y: 0, h: hA }, { x: 1, y: 0, h: hB }, { x: 0, y: 1, h: hA }]);
    const q = P.find((v) => v.f === 1 && v.y === 0);
    if (q && hB > 2 * Hb) worst = Math.max(worst, Math.abs(q.x - sTrue));
    const tl = (Hb - hA) / (hB - hA);
    if (hB > 2 * Hb) worstLin = Math.max(worstLin, Math.abs(tl - sTrue));
  }
  console.log(JSON.stringify({ poleCrossing: { worstOff1h: +worst.toExponential(2), worstOffLinear: +worstLin.toFixed(3) } }));
  ok(worst < 1e-9, `box clip at a pole: off by ${worst} of an edge`);
}
require('fs').writeFileSync(process.env.LW_OUT || '/dev/null', JSON.stringify(rows, null, 1));
console.log(fails ? `t_landwalls: ${fails} FAILED` : 't_landwalls: all passed');
process.exit(fails ? 1 : 0);
