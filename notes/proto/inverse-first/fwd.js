'use strict';
// Forward fallback (design section 8): the region meshed on the Riemann sphere of the source, refined adaptively in
// the IMAGE metric, CPU float64, with
//   - undefined vertices (no limit: z^i at 0 and infinity, exp at infinity, e^{1/z} at 0) and vertices at infinity
//     (poles; flat views cannot draw them) refined toward geometrically (spherical midpoints = halving in the
//     z chart near 0, in the u = 1/z chart near infinity),
//   - window cull, sub-pixel chord deviation (0.25 px) and edge length (64 px) in screen pixels,
//   - SATURATION: triangles processed near-to-far by the sheet key D; accepted ones attenuate a 2x2-per-pixel
//     transmittance buffer; a candidate whose image lies where every subsample is already below 1/255 is dropped;
//     refinement toward a singular vertex stops after NQ levels without a visible contribution,
//   - precision floor (chordal size 1e-15 on the unit sphere), global budgets,
//   - watertightness by construction: split decisions are per EDGE (shared map), accepted triangles freeze their
//     edges, a triangle whose bad interior cannot split a frozen edge gets a centroid split (no T-junctions).
const K = require('./common.js');
const { PI, REG, CASES, viewOf, pix, keyFn, W, H, C } = K;

const EPS_CHORD = 0.25, E_MAX = 64, ALPHA = 0.85, T_STOP = 1 / 255, NQ = 14, FLOOR = 1e-13, MAX_DEPTH = 1100, STALL = 30000;
const OK = 0, INF = 1, UNDEF = 2;

class Heap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val);
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; }
    k[i] = key; v[i] = val;
  }
  pop() {
    const k = this.k, v = this.v, top = v[0], lk = k.pop(), lv = v.pop();
    if (k.length) {
      let i = 0; const n = k.length;
      for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && k[c + 1] < k[c]) c++; if (k[c] >= lk) break; k[i] = k[c]; v[i] = v[c]; i = c; }
      k[i] = lk; v[i] = lv;
    }
    return top;
  }
}

function refine(cs, view, opts = {}) {
  const F = K.chainF(cs.steps), region = REG[cs.region], key = keyFn(cs);
  const budget = opts.budget || 600000;
  const t0 = process.hrtime.bigint();
  // ---- vertices ----
  const PX = [], PY = [], PZ = [], ZR = [], ZI = [], WR = [], WI = [], ST = [], LV = [], ONB = [];
  const toPx = (wr, wi) => [(wr - view.cx) * view.s + W / 2, (view.cy - wi) * view.s + H / 2];
  function zOf(x, y, zc) {
    if (zc <= 0) { const d = 1 - zc; return [x / d, y / d]; }
    const d = 1 + zc, ur = x / d, ui = -y / d, q = ur * ur + ui * ui;
    if (q === 0) return [Infinity, Infinity];
    return [ur / q, -ui / q];
  }
  function addVertex(x, y, zc, onb) {
    const l = Math.hypot(x, y, zc); x /= l; y /= l; zc /= l;
    const [zr, zi] = zOf(x, y, zc);
    const id = PX.length;
    PX.push(x); PY.push(y); PZ.push(zc); ZR.push(zr); ZI.push(zi);
    let st = OK, wr = NaN, wi = NaN, lv;
    const isZero = zr === 0 && zi === 0, isInf = !Number.isFinite(zr);
    if (isZero || isInf) {
      const sp = isZero ? cs.special.zero : cs.special.inf;
      if (sp === 'undef') st = UNDEF; else if (sp === 'inf') st = INF;
      else if (sp && typeof sp === 'object') { wr = sp.re; wi = sp.im; }
      else { const w = F(C(zr, zi)); wr = w.re; wi = w.im; }
      lv = isInf ? region.inf : region.level(C(zr, zi));
    } else {
      const w = F(C(zr, zi));
      wr = w.re; wi = w.im;
      if (Number.isNaN(wr) || Number.isNaN(wi)) st = UNDEF;
      else if (!(Math.abs(wr) < 1e300 && Math.abs(wi) < 1e300)) st = INF;
      lv = region.level(C(zr, zi));
    }
    WR.push(wr); WI.push(wi); ST.push(st); LV.push(lv); ONB.push(onb ? 1 : 0);
    return id;
  }
  const liftZ = (z) => { const q = z.re * z.re + z.im * z.im; if (!Number.isFinite(q)) return [0, 0, 1]; return [2 * z.re / (q + 1), 2 * z.im / (q + 1), (q - 1) / (q + 1)]; };
  // ---- edge map: midpoints shared by both neighbours; split flags; frozen edges ----
  const MID = new Map(), SPLIT = new Set(), FROZEN = new Set();
  const ek = (a, b) => (a < b ? a * 4194304 + b : b * 4194304 + a);
  function midOf(a, b) {
    const k = ek(a, b);
    let m = MID.get(k);
    if (m !== undefined) return m;
    let x = PX[a] + PX[b], y = PY[a] + PY[b], z = PZ[a] + PZ[b];
    let onb = false;
    if (ONB[a] && ONB[b]) {
      // a boundary edge (its midpoint lies near the boundary): project onto the zero level set (Newton, numerical gradient)
      const l = Math.hypot(x, y, z); let zz = zOf(x / l, y / l, z / l);
      const span = Math.hypot(ZR[a] - ZR[b], ZI[a] - ZI[b]);
      let p = C(zz[0], zz[1]);
      if (Number.isFinite(p.re) && Math.abs(region.level(p)) < 0.3 * (Number.isFinite(span) ? span : Infinity)) {
        for (let it = 0; it < 4; it++) {
          const h = 1e-7 * (1 + Math.hypot(p.re, p.im)), L0 = region.level(p);
          const gx = (region.level(C(p.re + h, p.im)) - region.level(C(p.re - h, p.im))) / (2 * h), gy = (region.level(C(p.re, p.im + h)) - region.level(C(p.re, p.im - h))) / (2 * h);
          const g2 = gx * gx + gy * gy; if (!(g2 > 0)) break;
          p = C(p.re - L0 * gx / g2, p.im - L0 * gy / g2);
        }
        const P = liftZ(p); x = P[0]; y = P[1]; z = P[2]; onb = true;
      }
    }
    m = addVertex(x, y, z, onb);
    MID.set(k, m);
    return m;
  }
  // ---- base mesh: octahedron (poles 0 and infinity, equator |z| = 1) subdivided 3 times, clipped to the region ----
  let tris = [];
  {
    const v0 = [[0, 0, -1], [1, 0, 0], [0, 1, 0], [-1, 0, 0], [0, -1, 0], [0, 0, 1]].map((p) => addVertex(p[0], p[1], p[2], false));
    for (const id of v0) ONB[id] = Math.abs(LV[id]) === 0 ? 1 : 0;
    let F0 = [[0, 2, 1], [0, 3, 2], [0, 4, 3], [0, 1, 4], [5, 1, 2], [5, 2, 3], [5, 3, 4], [5, 4, 1]].map((f) => f.map((i) => v0[i]));
    for (let s = 0; s < 3; s++) {
      const G = [];
      for (const [a, b, c] of F0) { const ab = midOf(a, b), bc = midOf(b, c), ca = midOf(c, a); G.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
      F0 = G;
    }
    MID.clear();
    // marching triangles: level > 0 inside, = 0 on the boundary (kept as a vertex), crossings by bisection on the sphere
    const cross = new Map();
    const crossing = (a, b) => {
      if (LV[a] === 0) return a; if (LV[b] === 0) return b;
      const k = ek(a, b); if (cross.has(k)) return cross.get(k);
      const [i, o] = LV[a] > 0 ? [a, b] : [b, a];
      let lo = 0, hi = 1, P = null;
      const at = (t) => { const x = PX[i] * (1 - t) + PX[o] * t, y = PY[i] * (1 - t) + PY[o] * t, z = PZ[i] * (1 - t) + PZ[o] * t, l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; };
      for (let it = 0; it < 40; it++) { const m = (lo + hi) / 2; P = at(m); const zz = zOf(P[0], P[1], P[2]); const lv = Number.isFinite(zz[0]) ? region.level(C(zz[0], zz[1])) : region.inf; if (lv > 0) lo = m; else hi = m; }
      P = at((lo + hi) / 2);
      const id = addVertex(P[0], P[1], P[2], true); LV[id] = 0;
      cross.set(k, id); return id;
    };
    for (const t of F0) {
      const ins = t.map((v) => LV[v] >= 0), pos = t.some((v) => LV[v] > 0);
      if (!pos) continue;
      if (ins.every(Boolean)) { tris.push([t[0], t[1], t[2], 0, null]); continue; }
      const poly = [];
      for (let q = 0; q < 3; q++) {
        const a = t[q], b = t[(q + 1) % 3];
        if (ins[q]) poly.push(a);
        if (ins[q] !== ins[(q + 1) % 3]) { const c = crossing(a, b); if (poly[poly.length - 1] !== c) poly.push(c); }
      }
      const uniq = poly.filter((v, i) => v !== poly[(i + 1) % poly.length]);
      for (let q = 1; q + 1 < uniq.length; q++) tris.push([uniq[0], uniq[q], uniq[q + 1], 0, null]);
    }
  }
  const baseTris = tris.length;
  // ---- the transmittance buffer (2x2 subsamples per pixel) ----
  const SW = 2 * W, SH = 2 * H, TB = new Float32Array(SW * SH).fill(1);
  function triSub(q0, q1, q2, margin, fn) {
    // subsamples (x+0.25, y+0.25 offsets) whose distance to the triangle q0 q1 q2 is <= margin px
    const x0 = Math.max(0, Math.floor(2 * (Math.min(q0[0], q1[0], q2[0]) - margin))), x1 = Math.min(SW - 1, Math.ceil(2 * (Math.max(q0[0], q1[0], q2[0]) + margin)));
    const y0 = Math.max(0, Math.floor(2 * (Math.min(q0[1], q1[1], q2[1]) - margin))), y1 = Math.min(SH - 1, Math.ceil(2 * (Math.max(q0[1], q1[1], q2[1]) + margin)));
    if (x0 > x1 || y0 > y1) return true;
    const ar = (q1[0] - q0[0]) * (q2[1] - q0[1]) - (q2[0] - q0[0]) * (q1[1] - q0[1]);
    const sg = ar >= 0 ? 1 : -1;
    const E = [[q0, q1], [q1, q2], [q2, q0]].map(([a, b]) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1e-30; return [a, dx / l, dy / l]; });
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = (x + 0.5) / 2, py = (y + 0.5) / 2;
      let inside = true;
      for (const [a, dx, dy] of E) { const d = sg * (dx * (py - a[1]) - dy * (px - a[0])); if (d < -margin) { inside = false; break; } }
      if (inside && fn(y * SW + x) === false) return false;
    }
    return true;
  }
  // ---- refinement ----
  const heap = new Heap();
  const centroidKey = (a, b, c) => {
    let x = PX[a] + PX[b] + PX[c], y = PY[a] + PY[b] + PY[c], z = PZ[a] + PZ[b] + PZ[c]; const l = Math.hypot(x, y, z);
    const zz = zOf(x / l, y / l, z / l);
    if (!Number.isFinite(zz[0])) return 1e9;
    return key(C(zz[0], zz[1]));
  };
  const push = (t) => heap.push(centroidKey(t[0], t[1], t[2]), t);
  for (const t of tris) push(t);
  const deepestVisible = new Map();   // singular vertex -> deepest ring depth with a visible contribution
  const accepted = [];
  const S = { processed: 0, culled: 0, saturated: 0, floor: 0, quiet: 0, centroidSplits: 0, budget: 0, evals: 0, stalled: 0, early: 0 };
  let lastVisible = 0;
  // only UNDEF vertices (no limit) force refinement toward them; INF ones (poles, overflow) are far samples
  const bad = (v) => ST[v] === UNDEF;
  const qOf = (v) => toPx(WR[v], WI[v]);
  const vb = { x0: -2, x1: W + 2, y0: -2, y1: H + 2 };
  while (heap.size) {
    if (S.processed >= budget) { S.budget = heap.size; break; }
    // global stall: STALL triangles in a row (in near-to-far order) without a visible contribution: what is left
    // is deeper sheets that can no longer change a pixel by 1/255, or parts that only cull
    if (S.processed - lastVisible > STALL) { S.stalled = heap.size; break; }
    const T = heap.pop();
    S.processed++;
    const [a, b, c, depth, anc, pdev] = T;
    const sing = [a, b, c].filter(bad);
    const size = Math.max(Math.hypot(PX[a] - PX[b], PY[a] - PY[b], PZ[a] - PZ[b]), Math.hypot(PX[b] - PX[c], PY[b] - PY[c], PZ[b] - PZ[c]), Math.hypot(PX[c] - PX[a], PY[c] - PY[a], PZ[c] - PZ[a]));
    // precision floor, RELATIVE: near the poles (0, infinity) the stereographic coordinates keep full relative
    // precision (x, y of the unit vector are ~2|z| or ~2/|z|), so refinement toward 0 / infinity can go to 1e-300
    const sxy = Math.max(Math.hypot(PX[a], PY[a]), Math.hypot(PX[b], PY[b]), Math.hypot(PX[c], PY[c]));
    const dxy = Math.max(Math.hypot(PX[a] - PX[b], PY[a] - PY[b]), Math.hypot(PX[b] - PX[c], PY[b] - PY[c]), Math.hypot(PX[c] - PX[a], PY[c] - PY[a]));
    if ((size < 1e-15 && dxy < FLOOR * sxy) || depth > MAX_DEPTH) { S.floor++; continue; }
    const E = [[a, b], [b, c], [c, a]];
    let want = [false, false, false], interiorBad = false, myDev = undefined;
    if (sing.length) {
      // refinement toward a singular vertex, while its rings still contribute
      const v = sing[0];
      if (depth > (deepestVisible.get(v) ?? 0) + NQ) { S.quiet++; continue; }
      E.forEach(([p, q], i) => { if (bad(p) || bad(q)) want[i] = true; });
    } else {
      const qa = qOf(a), qb = qOf(b), qc = qOf(c);
      // cheap tests on the vertex images first, with the deviation the parent had (a child's is ~1/4 of it)
      if (pdev !== undefined && pdev < 8 && [qa, qb, qc].every((q) => Math.abs(q[0]) < 1e15 && Math.abs(q[1]) < 1e15)) {
        const est = pdev / 2 + 0.25, mg = 2 + est;
        if ([qa, qb, qc].every((q) => q[0] < vb.x0 - mg) || [qa, qb, qc].every((q) => q[0] > vb.x1 + mg) || [qa, qb, qc].every((q) => q[1] < vb.y0 - mg) || [qa, qb, qc].every((q) => q[1] > vb.y1 + mg)) { S.culled++; S.early++; continue; }
        if (est <= 2 && triSub(qa, qb, qc, 1 + est, (i) => TB[i] < T_STOP)) { S.saturated++; S.early++; continue; }
      }
      const mids = E.map(([p, q]) => midOf(p, q));
      const mq = mids.map(qOf);
      // centroid sample (not a mesh vertex: evaluated directly)
      let x = PX[a] + PX[b] + PX[c], y = PY[a] + PY[b] + PY[c], zc = PZ[a] + PZ[b] + PZ[c]; const l = Math.hypot(x, y, zc);
      const zz = zOf(x / l, y / l, zc / l), wc = F(C(zz[0], zz[1])); S.evals++;
      const qcen = toPx(wc.re, wc.im);
      const samples = [qa, qb, qc, ...mq, qcen];
      // far: not representable in screen px (overflowed, or beyond 1e15 px): direction-free, never blocks a cull
      const far = (q) => !(Math.abs(q[0]) < 1e15 && Math.abs(q[1]) < 1e15);
      const finite = !samples.some(far);
      const ends = [[qa, qb], [qb, qc], [qc, qa]];
      const dev = finite ? ends.map(([p, q], i) => Math.hypot(mq[i][0] - (p[0] + q[0]) / 2, mq[i][1] - (p[1] + q[1]) / 2)) : [Infinity, Infinity, Infinity];
      const len = finite ? ends.map(([p, q]) => Math.hypot(p[0] - q[0], p[1] - q[1])) : [Infinity, Infinity, Infinity];
      const devC = finite ? Math.hypot(qcen[0] - (qa[0] + qb[0] + qc[0]) / 3, qcen[1] - (qa[1] + qb[1] + qc[1]) / 3) : Infinity;
      const maxDev = Math.max(...dev, devC);
      // window cull: every sample beyond one side of the view by more than the curvature allowance (far samples
      // count for every side; finite ones need the margin 2 px + their largest chord deviation)
      {
        const fin = samples.filter((q) => !far(q));
        let md = 0;
        if (fin.length === samples.length) md = maxDev;
        else for (let i = 0; i < 3; i++) if (!far(ends[i][0]) && !far(ends[i][1]) && !far(mq[i])) md = Math.max(md, Math.hypot(mq[i][0] - (ends[i][0][0] + ends[i][1][0]) / 2, mq[i][1] - (ends[i][0][1] + ends[i][1][1]) / 2));
        const mg = 2 + (Number.isFinite(md) ? md : 0);
        const allFar = fin.length === 0;
        if ((allFar && depth >= 2) || (!allFar && (fin.every((q) => q[0] < vb.x0 - mg) || fin.every((q) => q[0] > vb.x1 + mg) || fin.every((q) => q[1] < vb.y0 - mg) || fin.every((q) => q[1] > vb.y1 + mg)) && (fin.length === samples.length || fin.every((q) => Math.min(q[0] - vb.x0, vb.x1 - q[0], q[1] - vb.y0, vb.y1 - q[1]) < -(mg + 1e3))))) {
          S.culled++; continue;
        }
      }
      if (finite) {
        // saturation: already opaque (every subsample under the image, 1 px margin) to 1/255
        if (maxDev <= 2 && triSub(qa, qb, qc, 1 + maxDev, (i) => TB[i] < T_STOP)) { S.saturated++; continue; }
        const xs = samples.map((q) => q[0]), ys = samples.map((q) => q[1]);
        const sub = Math.max(...xs) - Math.min(...xs) < 0.5 && Math.max(...ys) - Math.min(...ys) < 0.5;
        const area = (qb[0] - qa[0]) * (qc[1] - qa[1]) - (qc[0] - qa[0]) * (qb[1] - qa[1]);
        // conformal maps keep orientation: source ccw on the sphere seen from outside... compare with a tiny source probe
        // an edge a neighbour already split must be split here too (else a T-junction): never accepted whole
        const okE = dev.map((d, i) => d <= EPS_CHORD && len[i] <= E_MAX && !SPLIT.has(ek(E[i][0], E[i][1])));
        if ((sub && okE.every((o, i) => o || !SPLIT.has(ek(E[i][0], E[i][1])))) || (okE.every(Boolean) && devC <= EPS_CHORD)) {
          // accept: emit, attenuate the transmittance buffer, freeze the edges
          let vis = false;
          triSub(qa, qb, qc, 0, (i) => { if (TB[i] >= T_STOP) vis = true; TB[i] *= 1 - ALPHA; });
          accepted.push([a, b, c, centroidKey(a, b, c)]);
          for (const [p, q] of E) FROZEN.add(ek(p, q));
          if (vis && anc) for (const [v, rd] of anc) if ((deepestVisible.get(v) ?? 0) < rd) deepestVisible.set(v, rd);
          if (vis) lastVisible = S.processed;
          continue;
        }
        want = okE.map((o) => !o);
        interiorBad = devC > EPS_CHORD || !Number.isFinite(area);
        myDev = maxDev;
      } else {
        // some sample is far / overflowed: split the edges whose ends or midpoint are far (all, if the centroid is)
        want = ends.map(([p, q], i) => far(p) || far(q) || far(mq[i]));
        if (far(qcen) || !want.some(Boolean)) want = [true, true, true];
      }
    }
    // edges already split by a neighbour must be split here too; frozen edges cannot be split
    for (let i = 0; i < 3; i++) { const k = ek(E[i][0], E[i][1]); if (SPLIT.has(k)) want[i] = true; if (FROZEN.has(k)) want[i] = false; }
    if (!want.some(Boolean) && (interiorBad || sing.length)) for (let i = 0; i < 3; i++) if (!FROZEN.has(ek(E[i][0], E[i][1]))) want[i] = true;
    // ancestry for the quiet rule: children that do not touch a singular vertex remember (vertex, ring depth)
    const ancOf = (kids) => {
      const out = anc ? anc.slice() : [];
      for (const v of sing) if (!kids.includes(v)) out.push([v, depth + 1]);
      return out.length ? out : null;
    };
    const emit = (p, q, r) => { push([p, q, r, depth + 1, ancOf([p, q, r]), myDev]); };
    const n = want.filter(Boolean).length;
    if (n === 0) {
      // every edge frozen: centroid split (no T-junction)
      S.centroidSplits++;
      let x = PX[a] + PX[b] + PX[c], y = PY[a] + PY[b] + PY[c], zc = PZ[a] + PZ[b] + PZ[c];
      const m = addVertex(x, y, zc, false);
      emit(a, b, m); emit(b, c, m); emit(c, a, m);
      continue;
    }
    for (let i = 0; i < 3; i++) if (want[i]) SPLIT.add(ek(E[i][0], E[i][1]));
    const M = E.map(([p, q], i) => (want[i] ? midOf(p, q) : -1));
    if (n === 3) { emit(a, M[0], M[2]); emit(M[0], b, M[1]); emit(M[2], M[1], c); emit(M[0], M[1], M[2]); }
    else if (n === 1) {
      const i = want.indexOf(true), [p, q] = E[i], r = [a, b, c].find((v) => v !== p && v !== q);
      emit(p, M[i], r); emit(M[i], q, r);
    } else {
      // two split edges: the corner between them is cut off, the rest split along the shorter diagonal
      const i = want.indexOf(false), [p, q] = E[i], r = [a, b, c].find((v) => v !== p && v !== q);
      const mp = M[(i + 2) % 3], mq = M[(i + 1) % 3];  // midpoints of (r, p) and (q, r)
      emit(mp, mq, r);
      const d1 = Math.hypot(PX[p] - PX[mq], PY[p] - PY[mq], PZ[p] - PZ[mq]), d2 = Math.hypot(PX[q] - PX[mp], PY[q] - PY[mp], PZ[q] - PZ[mp]);
      if (d1 <= d2) { emit(p, q, mq); emit(p, mq, mp); } else { emit(p, q, mp); emit(mp, q, mq); }
    }
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  return { ms, S, baseTris, accepted, verts: PX.length, V: { ZR, ZI, WR, WI, ST, PX, PY, PZ }, MID, F, toPx, TB };
}

// ---------- quality of a refinement: chord deviation at unseen points, coverage vs truth, hole, T-junctions, parity ----------
function quality(cs, view, R) {
  const { ZR, ZI, WR, WI, PX, PY, PZ } = R.V, F = R.F;
  const toPx = R.toPx;
  let maxDev = 0, devN = 0;
  const cover = new Uint8Array(W * H), topD = new Float64Array(W * H).fill(Infinity), topPar = new Int8Array(W * H).fill(-1);
  const zAt = (ws) => { let x = 0, y = 0, z = 0; for (const [v, t] of ws) { x += t * PX[v]; y += t * PY[v]; z += t * PZ[v]; } const l = Math.hypot(x, y, z); x /= l; y /= l; z /= l; if (z <= 0) { const d = 1 - z; return C(x / d, y / d); } const d = 1 + z, ur = x / d, ui = -y / d, q = ur * ur + ui * ui; return C(ur / q, -ui / q); };
  for (const [a, b, c, D] of R.accepted) {
    const q = [a, b, c].map((v) => toPx(WR[v], WI[v]));
    const inView = q.some((p) => p[0] > -2 && p[0] < W + 2 && p[1] > -2 && p[1] < H + 2);
    const big = Math.max(Math.hypot(q[0][0] - q[1][0], q[0][1] - q[1][1]), Math.hypot(q[1][0] - q[2][0], q[1][1] - q[2][1])) > 1;
    if (inView && big) {
      // chord deviation at points the refinement never sampled: quarter points of edges, an off-centre interior point
      for (const bc of [[0.75, 0.25, 0], [0.25, 0.75, 0], [0, 0.75, 0.25], [0, 0.25, 0.75], [0.25, 0, 0.75], [0.6, 0.25, 0.15]]) {
        const z = zAt([[a, bc[0]], [b, bc[1]], [c, bc[2]]]), w = F(z), p = toPx(w.re, w.im);
        const lin = [bc[0] * q[0][0] + bc[1] * q[1][0] + bc[2] * q[2][0], bc[0] * q[0][1] + bc[1] * q[1][1] + bc[2] * q[2][1]];
        const d = Math.hypot(p[0] - lin[0], p[1] - lin[1]);
        if (d > maxDev) maxDev = d;
        devN++;
      }
    }
    // raster: pixel centres; the polar parity of the interpolated source point of the nearest sheet
    const x0 = Math.max(0, Math.floor(Math.min(q[0][0], q[1][0], q[2][0]))), x1 = Math.min(W - 1, Math.ceil(Math.max(q[0][0], q[1][0], q[2][0])));
    const y0 = Math.max(0, Math.floor(Math.min(q[0][1], q[1][1], q[2][1]))), y1 = Math.min(H - 1, Math.ceil(Math.max(q[0][1], q[1][1], q[2][1])));
    const det = (q[1][0] - q[0][0]) * (q[2][1] - q[0][1]) - (q[2][0] - q[0][0]) * (q[1][1] - q[0][1]);
    if (!(Math.abs(det) > 0)) continue;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5;
      const l1 = ((q[1][0] - px) * (q[2][1] - py) - (q[2][0] - px) * (q[1][1] - py)) / det, l2 = ((q[2][0] - px) * (q[0][1] - py) - (q[0][0] - px) * (q[2][1] - py)) / det, l3 = 1 - l1 - l2;
      if (l1 < 0 || l2 < 0 || l3 < 0) continue;
      const p = y * W + x;
      cover[p] = 1;
      if (cs.parity && D < topD[p]) {
        topD[p] = D;
        // the interpolated source point, as the GPU interpolates vSrc (linear in the chart of the triangle)
        const za = C(ZR[a], ZI[a]), zb = C(ZR[b], ZI[b]), zc = C(ZR[c], ZI[c]);
        const z = C(l1 * za.re + l2 * zb.re + l3 * zc.re, l1 * za.im + l2 * zb.im + l3 * zc.im);
        const g = [Math.log(Math.hypot(z.re, z.im)) * 16 / (2 * PI), Math.atan2(z.im, z.re) * 16 / (2 * PI)];
        topPar[p] = (((Math.floor(g[0]) + Math.floor(g[1])) % 2) + 2) % 2;
      }
    }
  }
  let inter = 0, uni = 0, holes = 0, spill = 0, leak = 0, parOk = 0, parN = 0;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const p = j * W + i, w = pix(view, i, j), t = cs.truth(w) ? 1 : 0, a = cover[p];
    if (a && t) inter++; if (a || t) uni++; if (t && !a) holes++; if (a && !t) spill++;
    if (cs.parity) {
      const rr = Math.hypot(w.re, w.im);
      if (rr < Math.exp(-PI) - 1 / view.s && a) leak++;
      if (t && topPar[p] >= 0 && cs.parityEdge(w, view.s) > 1.5) { parN++; if (topPar[p] === cs.parity(w)) parOk++; }
    }
  }
  // T-junctions: an accepted edge whose midpoint vertex is used by another accepted triangle
  const used = new Set();
  for (const [a, b, c] of R.accepted) { used.add(a); used.add(b); used.add(c); }
  let tj = 0;
  const ek = (a, b) => (a < b ? a * 4194304 + b : b * 4194304 + a);
  for (const [a, b, c] of R.accepted) for (const [p, q] of [[a, b], [b, c], [c, a]]) { const m = R.MID.get(ek(p, q)); if (m !== undefined && used.has(m)) tj++; }
  return { maxDev, devN, iou: uni ? inter / uni : 1, holes, spill, leak, parity: parN ? parOk / parN : null, tj, cover, topPar };
}

module.exports = { refine, quality };

if (require.main === module) {
  const which = process.argv.slice(2);
  const names = ['zi_H', 'logH', 'expH', 'e1z_disc', 'exp_strip', 'cayley_H'];
  console.log('case        view    base  processed  accepted  culled  saturated quiet floor centroid  verts stall  CPU ms | maxDev(px) IoU      holes spill z^i-leak parity  T-junctions');
  for (const name of names) {
    if (which.length && !which.some((x) => name.startsWith(x))) continue;
    const cs = CASES[name];
    for (const v of ['default', 'out16']) {
      const view = viewOf(cs, v);
      const R = refine(cs, view);
      const Q = quality(cs, view, R);
      {
        // render: polar-parity colours of the nearest sheet (z^i) or the solid coverage, over white
        const img = new Uint8Array(W * H * 4), c0 = [0.23, 0.44, 0.83], c1 = [0.86, 0.90, 0.97];
        for (let p = 0; p < W * H; p++) {
          const col = !Q.cover[p] ? [1, 1, 1] : Q.topPar[p] === 1 ? c1 : c0;
          for (let q = 0; q < 3; q++) img[4 * p + q] = Math.round(255 * col[q]);
          img[4 * p + 3] = 255;
        }
        K.writePNG(require('path').join(__dirname, 'out', `fwd_${name}_${v}.png`), W, H, img);
      }
      const S = R.S;
      console.log(`${name.padEnd(11)} ${v.padEnd(7)} ${String(R.baseTris).padStart(4)} ${String(S.processed).padStart(10)} ${String(R.accepted.length).padStart(9)} ${String(S.culled).padStart(7)} ${String(S.saturated).padStart(10)} ${String(S.quiet).padStart(5)} ${String(S.floor).padStart(5)} ${String(S.centroidSplits).padStart(8)} ${String(R.verts).padStart(7)} ${String(S.stalled).padStart(5)} ${R.ms.toFixed(0).padStart(7)} | ${Q.maxDev.toFixed(3).padStart(9)}  ${Q.iou.toFixed(5)} ${String(Q.holes).padStart(5)} ${String(Q.spill).padStart(5)} ${cs.parity ? String(Q.leak).padStart(8) : '       -'} ${Q.parity == null ? '   -   ' : Q.parity.toFixed(4)} ${String(Q.tj).padStart(6)}${S.budget ? '  BUDGET (' + S.budget + ' left)' : ''}`);
    }
  }
}
