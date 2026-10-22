'use strict';
// Prototype of the "incremental" design (notes/sphere-design/incremental.md):
//   1. the core: Region.buildMesh exactly as the app builds it (base resolution meshN / MESH_L = 60), GPU L = 4;
//   2. core classification on the CPU (float64): a base triangle is CERTIFIED (left to the GPU) when its image passes
//      the strict image-metric test; otherwise CLAIMED by the layer (skip flag);
//   3. collar mode (stretched meshes with open sides): base cells outside B1 (the grid box at |phi| <= 4 window
//      half-sizes) are skipped and replaced by a collar of 32 fan sectors in the chart u = 1/(z - c) around u = 0
//      (z = infinity: a vertex that is never evaluated);
//   4. the layer: image-driven bisection of claimed triangles and collar sectors in float64, with edges as shared
//      objects (chart-owned midpoints), frozen lattice edges towards certified core triangles (claim on demand),
//      centroid fans for hanging vertices, region clipping (marching triangles) in the collar, and the stopping
//      rules: accept, cull (flat bbox / chordal cap), cap (limit at an undefined vertex), saturation (boundary-image
//      winding fill against a coverage buffer of strictly nearer sheets), sub-pixel discontinuity drop, precision
//      floor, budgets.
// Everything is single-threaded and synchronous here (the app would time-slice the same loop).
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
global.CX = require(path.join(ROOT, 'src/cx.js'));
global.Expr = require(path.join(ROOT, 'src/parse.js'));
global.Funcs = require(path.join(ROOT, 'src/funcs.js'));
const Region = require(path.join(ROOT, 'src/region.js'));
const { C } = CX;

// ---------------- the axes of Region.buildMesh (replicated, to know grid corners and B1) ----------------
const STRETCH_A = 0.35 / 0.65, UMAX = 0.9975;
const phi = (u) => STRETCH_A * u / (1 - Math.abs(u));
const phiInv = (x) => x / (STRETCH_A + Math.abs(x));
function stretchedAxis(c, hw, lo, hi, n) {
  let u0 = -UMAX, u1 = UMAX;
  if (Number.isFinite(lo)) u0 = Math.max(u0, phiInv((lo - c) / hw));
  if (Number.isFinite(hi)) u1 = Math.min(u1, phiInv((hi - c) / hw));
  const X = new Float64Array(n + 1);
  for (let i = 0; i <= n; i++) X[i] = c + hw * phi(u0 + (u1 - u0) * i / n);
  return X;
}
function uniformAxis(a, b, n) { const X = new Float64Array(n + 1); for (let i = 0; i <= n; i++) X[i] = a + (b - a) * i / n; return X; }
function meshAxes(s, win, Q) {
  let box = Region.bboxOf(s);
  const ww = win.x1 - win.x0, wh = win.y1 - win.y0;
  const stretched = !box || (box.x1 - box.x0) > 3 * ww || (box.y1 - box.y0) > 3 * wh;
  if (stretched) {
    const cx = (win.x0 + win.x1) / 2, cy = (win.y0 + win.y1) / 2, hw = ww / 2, hh = wh / 2;
    const nx = Math.max(8, Math.round(Q * Math.max(1, ww / wh) ** 0.5)), ny = Math.max(8, Math.round(Q * Math.max(1, wh / ww) ** 0.5));
    return { X: stretchedAxis(cx, hw, box ? box.x0 : -Infinity, box ? box.x1 : Infinity, nx), Y: stretchedAxis(cy, hh, box ? box.y0 : -Infinity, box ? box.y1 : Infinity, ny), stretched, cx, cy, hw, hh };
  }
  const pad = 1e-3 * Math.max(box.x1 - box.x0, box.y1 - box.y0, 1e-9);
  box = { x0: box.x0 - pad, x1: box.x1 + pad, y0: box.y0 - pad, y1: box.y1 + pad };
  const W = box.x1 - box.x0, H = box.y1 - box.y0, h = Math.max(W, H) / Q;
  return { X: uniformAxis(box.x0, box.x1, Math.max(4, Math.ceil(W / h))), Y: uniformAxis(box.y0, box.y1, Math.max(4, Math.ceil(H / h))), stretched };
}

// ---------------- a binary heap ----------------
class Heap {
  constructor(less) { this.a = []; this.less = less; }
  get size() { return this.a.length; }
  push(x) { const a = this.a; a.push(x); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (!this.less(a[i], a[p])) break; [a[i], a[p]] = [a[p], a[i]]; i = p; } }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && this.less(a[l], a[m])) m = l; if (r < a.length && this.less(a[r], a[m])) m = r; if (m === i) break; [a[i], a[m]] = [a[m], a[i]]; i = m; } }
    return top;
  }
}

// ---------------- the layer ----------------
// opts: {F, shape, srcWin (left view box = the meshing window), view {cx, cy, s, W, H}, Q (base cells, 60),
//        tau (px, 0.25), emax (px, 64), K (saturation depth), margin (fraction of the view kept around it, 0.25),
//        maxEval, maxTris, collar (true: replace the outer stretched cells), S (sectors, 32), PHI1 (4)}
function build(opts) {
  const t0 = process.hrtime.bigint();
  const F0 = opts.F, shape = opts.shape, view = opts.view;
  const tau = opts.tau ?? 0.25, emax = opts.emax ?? 64, K = opts.K ?? 1, margin = opts.margin ?? 0.25;
  const maxEval = opts.maxEval ?? 4e6, maxTris = opts.maxTris ?? 600000, Msat = opts.Msat ?? 4;
  const s = view.s;
  // coverage space: the view enlarged by the cull margin (same scale), so what a pan of that size shows is accounted
  const mx = Math.round((opts.margin ?? 0.25) * view.W), my = Math.round((opts.margin ?? 0.25) * view.H);
  const Wpx = view.W + 2 * mx, Hpx = view.H + 2 * my;
  const st = { evals: 0, claimed: 0, certified: 0, outer: 0, propagated: 0, collarRoots: 0, popped: 0, accepted: 0, emitted: 0,
    culled: 0, capped: 0, saturated: 0, satTests: 0, satPolyPts: 0, dropSub: 0, dropFloor: 0, dropOut: 0, apexStop: 0, budget: 0, maxKey: 0 };
  const F = (z) => { st.evals++; return F0(z); };
  const trace = opts.trace || null;
  const tr = (why, T) => { if (trace) trace.push({ why, key: T.key, ch: T.ch, v: T.v.map((v) => ({ z: v.z, w: v.w, st: v.st })) }); };
  const L = Region.levelOf(shape);
  const lev = (z) => { if (!z) return NaN; const v = L(z); return Number.isNaN(v) ? -Infinity : v; };
  const px = (w) => [(w.re - view.cx) * s + Wpx / 2, Hpx / 2 - (w.im - view.cy) * s];   // coverage space
  // the view in w, enlarged by the margin (culling keeps what a pan of that size would show)
  const vb = { x0: view.cx - Wpx / 2 / s, x1: view.cx + Wpx / 2 / s, y0: view.cy - Hpx / 2 / s, y1: view.cy + Hpx / 2 / s };

  // ---- vertices ----
  let VID = 0;
  const mkV = (z, u) => ({ id: VID++, z, u, w: undefined, st: undefined, lv: undefined, onB: false });
  const APEX = mkV(null, C(0, 0));
  function evalV(v) {
    if (v.st !== undefined) return v;
    if (v.z === null) { v.st = 2; v.w = null; return v; }
    const w = F(v.z);
    if (Number.isFinite(w.re) && Number.isFinite(w.im)) { v.st = 0; v.w = w; }
    else if (Math.abs(w.re) === Infinity || Math.abs(w.im) === Infinity) { v.st = 1; v.w = null; }   // image infinity
    else { v.st = 2; v.w = null; }                                                                        // undefined
    return v;
  }
  const levV = (v) => { if (v.lv === undefined) v.lv = v.onB ? 0 : lev(v.z); return v.lv; };
  const inside = (v) => v.onB || levV(v) > 0;

  // ---- charts: 0 absolute z, 1 u = 1/(z - cc) (cc = the window centre) ----
  const cc = C((opts.srcWin.x0 + opts.srcWin.x1) / 2, (opts.srcWin.y0 + opts.srcWin.y1) / 2);
  const uOf = (v) => { if (!v.u) v.u = v.z === null ? C(0, 0) : CX.inv(CX.sub(v.z, cc)); return v.u; };
  const co = (v, ch) => (ch === 0 ? v.z : uOf(v));
  const fromCo = (p, ch) => (ch === 0 ? mkV(p) : (p.re === 0 && p.im === 0 ? APEX : mkV(CX.add(cc, CX.inv(p)), p)));
  const midCo = (a, b, ch) => { const pa = co(a, ch), pb = co(b, ch); return C((pa.re + pb.re) / 2, (pa.im + pb.im) / 2); };

  // ---- edges: atomic (shared, registry) and composite (per-triangle views of a chain of atomic edges) ----
  const reg = new Map();
  const ekey = (a, b) => (a.id < b.id ? a.id + ',' + b.id : b.id + ',' + a.id);
  function edge(a, b, ch) {
    const k = ekey(a, b);
    let e = reg.get(k);
    if (!e) { e = { a, b, ch, mid: null, kids: null, frozen: null, bnd: false, cut: undefined }; reg.set(k, e); }
    return e;
  }
  const comp = (a, b, parts) => (parts.length === 1 ? parts[0] : { comp: true, a, b, parts });
  const other = (e, v) => (e.a === v ? e.b : e.a);
  // snap a point onto the region boundary (inside side) by bisection along the direction n (chart coordinates)
  function snap(p, n, ch, span) {
    const at = (t) => fromCo(C(p.re + t * n.re, p.im + t * n.im), ch);
    const l0 = lev(at(0).z);
    let a = 0, b = l0 > 0 ? span : -span;
    let la = l0, lb = lev(at(b).z);
    if (!((la > 0) !== (lb > 0))) { b = -b; lb = lev(at(b).z); }
    if (!((la > 0) !== (lb > 0))) return at(0);
    for (let i = 0; i < 1100; i++) {
      const m = (a + b) / 2;
      if (m === a || m === b) break;
      const lm = lev(at(m).z);
      if ((lm > 0) === (la > 0)) { a = m; la = lm; } else { b = m; lb = lm; }
    }
    const v = at(la > 0 ? a : b);
    v.onB = true;
    return v;
  }
  function snapZ(p, n, ch, span) {
    const at = (t) => { const q = C(p.re + t * n.re, p.im + t * n.im); return ch === 0 ? q : CX.add(cc, CX.inv(q)); };
    let a = 0, b = span, la = lev(at(0));
    if (!(la > 0)) { b = -span; }
    let lb = lev(at(b));
    if ((la > 0) === (lb > 0)) { b = -b; lb = lev(at(b)); }
    if ((la > 0) === (lb > 0)) return at(0);
    for (let i = 0; i < 1100; i++) {
      const m = (a + b) / 2;
      if (m === a || m === b) break;
      const lm = lev(at(m));
      if ((lm > 0) === (la > 0)) { a = m; la = lm; } else { b = m; lb = lm; }
    }
    return at(la > 0 ? a : b);
  }
  function midOf(e) {
    if (e.mid) return e.mid;
    const p = midCo(e.a, e.b, e.ch);
    if (e.bnd) {
      const pa = co(e.a, e.ch), pb = co(e.b, e.ch);
      const d = C(pb.re - pa.re, pb.im - pa.im), l = Math.hypot(d.re, d.im) || 1;
      e.mid = snap(p, C(-d.im / l, d.re / l), e.ch, 0.5 * l);
    } else e.mid = fromCo(p, e.ch);
    return e.mid;
  }
  // split an atomic edge (claiming the certified core triangle across a frozen lattice edge first)
  function splitAtomic(e) {
    if (e.kids) return;
    if (e.frozen != null) claim(e.frozen, true);
    const m = midOf(e);
    const k0 = edge(e.a, m, e.ch), k1 = edge(m, e.b, e.ch);
    k0.bnd = k1.bnd = e.bnd;
    e.kids = [k0, k1];
    // emitted leaves using this edge now have a new hanging vertex: re-emit them (a fan including it), or a
    // T-junction would open against the side that split it
    if (e.users && opts.reemit !== false) {
      // the leaves keep using the halves; the image sliver (a, m, b) changes sides: their coverage follows exactly,
      // so no saturation decision is taken against coverage the re-emitted fan will not provide
      evalV(m); evalV(e.a); evalV(e.b);
      for (const u of e.users) {
        dirty.add(u);
        if (opts.sliverCov !== false && u.cv && u.cv.st === 0 && okv(m) && okv(e.a) && okv(e.b) && m.st === 0 && e.a.st === 0 && e.b.st === 0) {
          const a = e.a.w, b = e.b.w, c = u.cv.w, mw = m.w;
          const sc = (b.re - a.re) * (c.im - a.im) - (b.im - a.im) * (c.re - a.re);
          const sm = (b.re - a.re) * (mw.im - a.im) - (b.im - a.im) * (mw.re - a.re);
          const d = sc * sm < 0 ? +1 : -1;   // m beyond the chord (away from the leaf): the leaf gains the sliver
          const inSnap = u.key < level;   // the snapshot of strictly nearer sheets holds the leaf only below the level
          covRaster([e.a, m, e.b], (i) => { covCur[i] = Math.max(0, covCur[i] + d); if (inSnap) cov[i] = Math.max(0, cov[i] + d); if (d > 0 && covCur[i] === K) unsatCur--; if (d < 0 && covCur[i] === K - 1) unsatCur++; });
        }
      }
      k0.users = new Set(e.users); k1.users = new Set(e.users);
      e.users = null;
    }
  }
  // split point of an edge seen from its end 'from': {m, h0 (from..m), h1 (m..other end)}
  function splitEdge(e, from) {
    if (e.comp) {
      const parts = from === e.a ? e.parts : e.parts.slice().reverse();
      const n = parts.length, j = Math.ceil(n / 2);
      let cur = from;
      for (let i = 0; i < j; i++) cur = other(parts[i], cur);
      return { m: cur, h0: comp(from, cur, parts.slice(0, j)), h1: comp(cur, other(e, from), parts.slice(j)) };
    }
    splitAtomic(e);
    const [k0, k1] = from === e.a ? e.kids : [e.kids[1], e.kids[0]];
    return { m: e.mid, h0: k0, h1: k1 };
  }
  // the leaf chain of an edge from 'from': vertices after 'from' and the atomic leaf edges
  function expand(e, from, vs, es) {
    if (e.comp) { const parts = from === e.a ? e.parts : e.parts.slice().reverse(); let cur = from; for (const p of parts) { expand(p, cur, vs, es); cur = vs[vs.length - 1]; } return; }
    if (e.kids) { const [k0, k1] = from === e.a ? e.kids : [e.kids[1], e.kids[0]]; expand(k0, from, vs, es); expand(k1, e.mid, vs, es); return; }
    vs.push(other(e, from)); es.push(e);
  }
  // chart length of an edge (corner to corner)
  const clen = (e) => { const a = co(e.a, e.ch), b = co(e.b, e.ch); return Math.hypot(a.re - b.re, a.im - b.im); };
  const cmag = (e) => { const a = co(e.a, e.ch), b = co(e.b, e.ch); return Math.max(Math.hypot(a.re, a.im), Math.hypot(b.re, b.im)); };
  const splittable = (e) => {
    if (e.comp) return true;
    if (e.kids) return true;
    const l = clen(e);
    return l > 1e-15 * cmag(e) && l > 1e-300;
  };

  // ---- the core ----
  const Q = opts.Q ?? 60;
  const tm0 = process.hrtime.bigint();
  const mesh = Region.buildMesh(shape, opts.srcWin, Q);
  const tMesh = Number(process.hrtime.bigint() - tm0) / 1e6;
  const ax = meshAxes(shape, opts.srcWin, Q);
  const Xs = new Set(ax.X), Ys = new Set(ax.Y);
  const nv = mesh.src.length / 2, nt = mesh.tri.length / 3;
  const coreV = new Array(nv);
  const cv = (i) => {
    if (!coreV[i]) {
      const z = C(mesh.src[2 * i], mesh.src[2 * i + 1]);
      const v = mkV(z);
      v.corner = Xs.has(z.re) && Ys.has(z.im);
      if (!v.corner) v.onB = true;   // an edge point of the marching squares: on the region boundary
      v.core = i;
      coreV[i] = v;
    }
    return coreV[i];
  };
  // base edge adjacency
  const eTris = new Map();
  for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++) {
    const a = mesh.tri[3 * t + k], b = mesh.tri[3 * t + (k + 1) % 3];
    const key = a < b ? a + ',' + b : b + ',' + a;
    if (!eTris.has(key)) eTris.set(key, []);
    eTris.get(key).push(t);
  }
  // collar mode: B1 = the grid lines nearest |phi| = PHI1 on the open sides
  const open = mesh.open && (mesh.open.x0 || mesh.open.x1 || mesh.open.y0 || mesh.open.y1);
  const collar = opts.collar !== false && !!open;
  let B1 = null;
  if (collar) {
    const P1 = opts.PHI1 ?? 4, X = ax.X, Y = ax.Y;
    const pick = (A, c, h, lo) => {
      if (lo) { let i = 0; for (let k = 0; k < A.length; k++) if (A[k] <= c - P1 * h) i = k; return A[i]; }
      let i = A.length - 1; for (let k = A.length - 1; k >= 0; k--) if (A[k] >= c + P1 * h) i = k; return A[i];
    };
    B1 = { x0: pick(X, ax.cx, ax.hw, true), x1: pick(X, ax.cx, ax.hw, false), y0: pick(Y, ax.cy, ax.hh, true), y1: pick(Y, ax.cy, ax.hh, false) };
  }
  const inB1 = (t) => {
    if (!B1) return true;
    const a = mesh.tri[3 * t], b = mesh.tri[3 * t + 1], c = mesh.tri[3 * t + 2];
    const x = (mesh.src[2 * a] + mesh.src[2 * b] + mesh.src[2 * c]) / 3, y = (mesh.src[2 * a + 1] + mesh.src[2 * b + 1] + mesh.src[2 * c + 1]) / 3;
    return x > B1.x0 && x < B1.x1 && y > B1.y0 && y < B1.y1;
  };
  const tstate = new Int8Array(nt);   // 0 certified (GPU), 1 claimed (layer), 2 outer (skipped in collar mode)
  const lat = new Map();   // lattice point images of certified triangles, for the reference render
  // a base edge as an atomic edge whose two lattice levels (the GPU's L = 4 points) are already split
  const baseEdges = new Map();
  function baseEdge(ia, ib) {
    const key = ia < ib ? ia + ',' + ib : ib + ',' + ia;
    let e = baseEdges.get(key);
    if (e) return e;
    const a = cv(ia), b = cv(ib);
    e = edge(a, b, 0);
    const tris = eTris.get(key);
    e.bnd = a.onB && b.onB && tris.length === 1;
    splitAtomic(e); splitAtomic(e.kids[0]); splitAtomic(e.kids[1]);
    baseEdges.set(key, e);
    e.tris = tris;
    return e;
  }
  const leavesOf = (e) => { const vs = [], es = []; expand(e, e.a, vs, es); return es; };

  // ---- classification of the base triangles ----
  const heap = new Heap((x, y) => (x.key !== y.key ? x.key < y.key : x.ord !== y.ord ? x.ord < y.ord : x.bad > y.bad));
  let roots = [];
  const winSize = Math.max(opts.srcWin.x1 - opts.srcWin.x0, opts.srcWin.y1 - opts.srcWin.y0);
  const uSize = B1 ? 1 / (Math.min(B1.x1 - B1.x0, B1.y1 - B1.y0) / 2) : 1;
  const keyOf = (T) => {
    let d = 0;
    for (const e of T.e) d = Math.max(d, clen(e.comp ? { a: e.a, b: e.b, ch: T.ch } : e));
    const ref = T.ch === 0 ? winSize / 8 : uSize;
    return Math.max(0, Math.floor(2 * Math.log2(ref / Math.max(d, 1e-320))) / 2);
  };
  function mkTri(v, e, ch, extra) {
    const T = Object.assign({ v, e, ch, key: 0, ord: 0, bad: 0 }, extra || {});
    T.key = keyOf(T);
    return T;
  }
  function claim(t, propagated) {
    if (tstate[t] === 1) return;
    if (tstate[t] === 2) throw new Error('claim of an outer triangle');
    tstate[t] = 1;
    st.claimed++;
    if (propagated) st.propagated++;
    const ids = [mesh.tri[3 * t], mesh.tri[3 * t + 1], mesh.tri[3 * t + 2]];
    // CCW in z
    const p = ids.map((i) => C(mesh.src[2 * i], mesh.src[2 * i + 1]));
    if ((p[1].re - p[0].re) * (p[2].im - p[0].im) - (p[2].re - p[0].re) * (p[1].im - p[0].im) < 0) ids.reverse();
    const es = [baseEdge(ids[0], ids[1]), baseEdge(ids[1], ids[2]), baseEdge(ids[2], ids[0])];
    // the lattice edges towards this triangle are no longer frozen; its other base edges freeze towards certified
    // neighbours
    for (const e of es) {
      const nb = e.tris.find((u) => u !== t);
      const fr = nb !== undefined && tstate[nb] === 0 ? nb : null;
      for (const l of leavesOf(e)) l.frozen = fr;
    }
    const T = mkTri(ids.map(cv), es, 0, { root: 'core', t });
    heap.push(T);
    roots.push(T);
  }
  // CPU images of the core (float64), shared per vertex / base edge
  const Wv = (i) => evalV(cv(i));
  const tc0 = process.hrtime.bigint();
  const dpx = (w1, w2) => Math.hypot(w1.re - w2.re, w1.im - w2.im) * s;
  // ---- the image metric: flat views measure in screen px; the Sphere view in px of the globe (chordal x R) ----
  const SPH = !!opts.sphere, R = SPH ? opts.sphere.R : 0;
  const liftS = (w) => { if (!w) return [0, 0, 1]; const q = w.re * w.re + w.im * w.im; if (q > 1) { const iq = 1 / q; return [2 * w.re * iq / (1 + iq), 2 * w.im * iq / (1 + iq), (1 - iq) / (1 + iq)]; } return [2 * w.re / (q + 1), 2 * w.im / (q + 1), (q - 1) / (q + 1)]; };
  const L3 = (v) => v.L3 || (v.L3 = liftS(v.st === 0 ? v.w : null));
  // a value usable by the metric: finite (flat), or finite or infinity (sphere)
  const okv = (v) => (SPH ? v.st === 0 || v.st === 1 : v.st === 0);
  const distV = (a, b) => (SPH ? Math.hypot(L3(a)[0] - L3(b)[0], L3(a)[1] - L3(b)[1], L3(a)[2] - L3(b)[2]) * R : dpx(a.w, b.w));
  const devMidV = (m, a, b) => {
    if (!SPH) return dpx(m.w, C((a.w.re + b.w.re) / 2, (a.w.im + b.w.im) / 2));
    const p = L3(m), x = L3(a), y = L3(b);
    return Math.hypot(p[0] - (x[0] + y[0]) / 2, p[1] - (x[1] + y[1]) / 2, p[2] - (x[2] + y[2]) / 2) * R;
  };
  const devCenV = (c, P) => {
    if (!SPH) { let x = 0, y = 0; for (const v of P) { x += v.w.re; y += v.w.im; } return dpx(c.w, C(x / P.length, y / P.length)); }
    const q = [0, 0, 0]; for (const v of P) { const l = L3(v); q[0] += l[0]; q[1] += l[1]; q[2] += l[2]; }
    const p = L3(c);
    return Math.hypot(p[0] - q[0] / P.length, p[1] - q[1] / P.length, p[2] - q[2] / P.length) * R;
  };
  for (let t = 0; t < nt; t++) {
    if (!inB1(t)) { tstate[t] = 2; st.outer++; continue; }
    const ids = [mesh.tri[3 * t], mesh.tri[3 * t + 1], mesh.tri[3 * t + 2]];
    const vs = ids.map(Wv);
    let bad = vs.some((v) => v.st !== 0), longE = false;
    if (!bad) {
      // the base edge midpoints (= lattice t = 1/2, shared) and the centroid
      for (let k = 0; k < 3 && !bad; k++) {
        const e = baseEdge(ids[k], ids[(k + 1) % 3]);
        const m = evalV(e.mid);
        if (m.st !== 0) { bad = true; break; }
        if (devMidV(m, vs[k], vs[(k + 1) % 3]) > 16 * tau * 0.5) bad = true;
        if (distV(vs[k], vs[(k + 1) % 3]) > 4 * emax) longE = true;
      }
      if (!bad) {
        const z = C((vs[0].z.re + vs[1].z.re + vs[2].z.re) / 3, (vs[0].z.im + vs[1].z.im + vs[2].z.im) / 3);
        const wc = F(z);
        const cvx = { st: Number.isFinite(wc.re) && Number.isFinite(wc.im) ? 0 : 2, w: wc };
        if (cvx.st !== 0 || devCenV(cvx, vs) > 16 * tau * 0.5) bad = true;
        if (SPH && longE) bad = true;
        // long image edges matter only on the view (a near-linear image: its bbox is reliable)
        if (!bad && longE) {
          const ws = vs.map((v) => v.w).concat([wc]);
          const x0 = Math.min(...ws.map((w) => w.re)), x1 = Math.max(...ws.map((w) => w.re)), y0 = Math.min(...ws.map((w) => w.im)), y1 = Math.max(...ws.map((w) => w.im));
          if (!(x1 < vb.x0 || x0 > vb.x1 || y1 < vb.y0 || y0 > vb.y1)) bad = true;
        }
      }
    }
    tstate[t] = bad ? 1 : 0;
  }
  // marching-squares edge points used only by claimed triangles: re-snapped to the inside of the boundary at full
  // float64 precision (buildMesh's 12-step bisection midpoint may lie just outside, e.g. on the far side of a
  // branch cut that coincides with the boundary)
  {
    const vt = new Map();
    for (let t = 0; t < nt; t++) if (tstate[t] !== 2) for (let k = 0; k < 3; k++) { const i = mesh.tri[3 * t + k]; if (!vt.has(i)) vt.set(i, []); vt.get(i).push(t); }
    const bracket = (A, x) => { let lo = 0, hi = A.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (A[m] <= x) lo = m; else hi = m; } return [A[lo], A[hi]]; };
    for (const [i, ts] of vt) {
      const v = cv(i);
      if (v.corner || !ts.every((t) => tstate[t] === 1)) continue;
      const z = v.z;
      let a, b;
      if (Xs.has(z.re)) { const [y0, y1] = bracket(ax.Y, z.im); a = C(z.re, y0); b = C(z.re, y1); }
      else { const [x0, x1] = bracket(ax.X, z.re); a = C(x0, z.im); b = C(x1, z.im); }
      // bisection on the coordinate itself (not on a parameter), so the snap reaches full float precision, down to
      // the subnormals next to a singular boundary point such as z = 0
      const vert = Xs.has(z.re);
      const at = (c) => (vert ? C(z.re, c) : C(c, z.im));
      let lo = vert ? a.im : a.re, hi = vert ? b.im : b.re;
      const la = lev(at(lo)) > 0;
      if (la === (lev(at(hi)) > 0)) continue;
      for (let it = 0; it < 2200; it++) { const m = (lo + hi) / 2; if (m === lo || m === hi) break; if ((lev(at(m)) > 0) === la) lo = m; else hi = m; }
      v.z = at(la ? lo : hi);
      v.st = undefined; v.w = undefined; v.L3 = undefined; v.lv = undefined; v.resnapped = true;
      st.resnapped = (st.resnapped || 0) + 1;
    }
  }
  // claimed: build their roots (after all states are known, so frozen edges point at certified neighbours)
  const toClaim = [];
  for (let t = 0; t < nt; t++) if (tstate[t] === 1) { tstate[t] = 0; toClaim.push(t); }
  for (const t of toClaim) claim(t, false);
  for (let t = 0; t < nt; t++) if (tstate[t] === 0) st.certified++;
  const tClass = Number(process.hrtime.bigint() - tc0) / 1e6;

  // ---- the collar ----
  if (collar) {
    // perimeter of B1, counterclockwise in z: core edges on it (with their lattice) and gap edges
    const onSide = (z) => z.re === B1.x0 || z.re === B1.x1 || z.im === B1.y0 || z.im === B1.y1;
    const Wd = B1.x1 - B1.x0, Hd = B1.y1 - B1.y0;
    const par = (z) => {
      if (z.im === B1.y0 && z.re < B1.x1) return z.re - B1.x0;
      if (z.re === B1.x1 && z.im < B1.y1) return Wd + (z.im - B1.y0);
      if (z.im === B1.y1 && z.re > B1.x0) return Wd + Hd + (B1.x1 - z.re);
      return 2 * Wd + Hd + (B1.y1 - z.im);
    };
    const pts = new Map(); // param -> vertex
    const segs = new Map(); // 'pa,pb' -> base edge
    for (let t = 0; t < nt; t++) {
      if (tstate[t] === 2) continue;
      for (let k = 0; k < 3; k++) {
        const ia = mesh.tri[3 * t + k], ib = mesh.tri[3 * t + (k + 1) % 3];
        const za = cv(ia).z, zb = cv(ib).z;
        if (!onSide(za) || !onSide(zb)) continue;
        // both on the same side line
        const same = (za.re === zb.re && (za.re === B1.x0 || za.re === B1.x1)) || (za.im === zb.im && (za.im === B1.y0 || za.im === B1.y1));
        if (!same) continue;
        const key = ia < ib ? ia + ',' + ib : ib + ',' + ia;
        const ts = eTris.get(key);
        if (ts.some((u) => u !== t && tstate[u] !== 2)) continue;   // an interior edge
        const pa = par(za), pb = par(zb);
        pts.set(pa, cv(ia)); pts.set(pb, cv(ib));
        segs.set(Math.min(pa, pb) + ',' + Math.max(pa, pb), baseEdge(ia, ib));
      }
    }
    for (const z of [C(B1.x0, B1.y0), C(B1.x1, B1.y0), C(B1.x1, B1.y1), C(B1.x0, B1.y1)]) { const p = par(z); if (!pts.has(p)) pts.set(p, mkV(z)); }
    const order = [...pts.keys()].sort((a, b) => a - b);
    const P = order.map((p) => pts.get(p));
    const n = P.length;
    const parts = [];
    for (let i = 0; i < n; i++) {
      const pa = order[i], pb = order[(i + 1) % n];
      const e = segs.get(Math.min(pa, pb) + ',' + Math.max(pa, pb));
      parts.push(e || edge(P[i], P[(i + 1) % n], 0));
    }
    // sectors: break points nearest to S equal angles around cc
    const S = opts.S ?? 32;
    const ang = P.map((v) => Math.atan2(v.z.im - cc.im, v.z.re - cc.re));
    const brk = [];
    for (let k = 0; k < S; k++) {
      const a = -Math.PI + 2 * Math.PI * k / S;
      let best = -1, bd = Infinity;
      for (let i = 0; i < n; i++) { let d = Math.abs(ang[i] - a); d = Math.min(d, 2 * Math.PI - d); if (d < bd) { bd = d; best = i; } }
      if (!brk.includes(best)) brk.push(best);
    }
    brk.sort((a, b) => a - b);
    for (let k = 0; k < brk.length; k++) {
      const i0 = brk[k], i1 = brk[(k + 1) % brk.length];
      const ps = [];
      for (let i = i0; i !== i1; i = (i + 1) % n) ps.push(parts[i]);
      const A = P[i0], B = P[i1];
      const chain = comp(A, B, ps);
      // CCW in u: (APEX, B, A) (the perimeter runs clockwise around 0 in u)
      const T = mkTri([APEX, B, A], [edge(APEX, B, 1), chain, edge(A, APEX, 1)], 1, { root: 'collar' });
      const uB = uOf(B), uA = uOf(A);
      if (uB.re * uA.im - uB.im * uA.re < 0) throw new Error('collar orientation');
      heap.push(T);
      roots.push(T);
      st.collarRoots++;
    }
  }

  // ---- coverage (saturation): counts per pixel, from strictly nearer sheets ----
  // Charts of the coverage: a flat view has one (the view enlarged by the margin, in its px); the Sphere view has two
  // hemisphere charts of the image sphere, w (|w| <= 1) and 1/w (|w| > 1), each 2R x 2R, about one globe px per cell.
  const charts = [];
  if (!SPH) charts.push({ W: Wpx, H: Hpx, off: 0, map: (w) => (w ? px(w) : null), valid: null });
  else {
    const G = Math.ceil(2 * R);
    const disc = (strict) => { const m = new Uint8Array(G * G); for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) { const d = Math.hypot(x + 0.5 - R, y + 0.5 - R); m[y * G + x] = strict ? d < R : d <= R; } return m; };
    charts.push({ W: G, H: G, off: 0, map: (w) => (w ? [w.re * R + R, R - w.im * R] : null), valid: disc(false) });
    charts.push({ W: G, H: G, off: G * G, map: (w) => { if (!w) return [R, R]; const q = w.re * w.re + w.im * w.im; if (!(q > 0)) return null; return [w.re / q * R + R, R + w.im / q * R]; }, valid: disc(true) });
  }
  const NP = charts.reduce((a, ch) => a + ch.W * ch.H, 0);
  const covCur = new Uint16Array(NP);   // everything accepted so far
  let cov = new Uint16Array(NP);        // keys below the current level
  let level = 0;
  function rasterTri(p0, p1, p2, fn, ch) {
    const Wc = ch ? ch.W : Wpx, Hc = ch ? ch.H : Hpx, off = ch ? ch.off : 0, valid = ch ? ch.valid : null;
    const minx = Math.max(0, Math.floor(Math.min(p0[0], p1[0], p2[0]))), maxx = Math.min(Wc - 1, Math.ceil(Math.max(p0[0], p1[0], p2[0])));
    const miny = Math.max(0, Math.floor(Math.min(p0[1], p1[1], p2[1]))), maxy = Math.min(Hc - 1, Math.ceil(Math.max(p0[1], p1[1], p2[1])));
    if (minx > maxx || miny > maxy) return;
    const ar = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (p1[1] - p0[1]);
    if (!(Math.abs(ar) > 0)) return;
    const sg = ar > 0 ? 1 : -1;
    for (let y = miny; y <= maxy; y++) {
      const yc = y + 0.5;
      for (let x = minx; x <= maxx; x++) {
        const xc = x + 0.5;
        const e0 = sg * ((p1[0] - p0[0]) * (yc - p0[1]) - (p1[1] - p0[1]) * (xc - p0[0]));
        const e1 = sg * ((p2[0] - p1[0]) * (yc - p1[1]) - (p2[1] - p1[1]) * (xc - p1[0]));
        const e2 = sg * ((p0[0] - p2[0]) * (yc - p2[1]) - (p0[1] - p2[1]) * (xc - p2[0]));
        if (e0 >= 0 && e1 >= 0 && e2 >= 0 && (!valid || valid[y * Wc + x])) fn(off + y * Wc + x, e0 / (sg * ar), e1 / (sg * ar), e2 / (sg * ar));
      }
    }
  }
  // a triangle of values (vertex-likes {st, w}) into every chart where it lies (the sphere: chart w when all
  // |w| <= 2, chart 1/w when all |w| >= 1/2 or infinite)
  function covRaster(vv, fn) {
    if (!SPH) { if (vv.every((v) => v.st === 0)) rasterTri(px(vv[0].w), px(vv[1].w), px(vv[2].w), fn); return; }
    const ab = vv.map((v) => (v.st === 0 ? Math.hypot(v.w.re, v.w.im) : Infinity));
    if (ab.every((x) => x <= 2)) { const ch = charts[0]; rasterTri(ch.map(vv[0].w), ch.map(vv[1].w), ch.map(vv[2].w), fn, ch); }
    if (ab.every((x) => x >= 0.5)) { const ch = charts[1]; rasterTri(...vv.map((v) => ch.map(v.st === 0 ? v.w : null)), fn, ch); }
  }
  // the coverage index of a value (-1: outside every chart)
  function covIdx(w) {
    for (const ch of charts) {
      const q = ch.map(w);
      if (!q) continue;
      const x = Math.floor(q[0]), y = Math.floor(q[1]);
      if (x < 0 || y < 0 || x >= ch.W || y >= ch.H) continue;
      if (ch.valid && !ch.valid[y * ch.W + x]) continue;
      return ch.off + y * ch.W + x;
    }
    return -1;
  }
  // unsaturated pixels (count < K) of the coverage area, kept incrementally: when none is left at a level, nothing
  // deeper can change a pixel, whatever F does
  let unsatCur = 0, unsat = 0;
  for (const ch of charts) { if (!ch.valid) unsatCur += ch.W * ch.H; else for (const b of ch.valid) unsatCur += b; }
  unsat = unsatCur;
  const covInc = (i) => { if (covCur[i] < 65535) { covCur[i]++; if (covCur[i] === K) unsatCur--; } };
  const tcv0 = process.hrtime.bigint();
  // the certified core (GPU, L = 4) into the coverage, and kept for the reference render
  const coreTris = [];
  {
    const latV = (ia, ib, ic, i, j) => {
      // lattice point (i, j) of the triangle (a, b, c): a + (b - a) i/4 + (c - a) j/4, shared on edges by key
      const key = i === 0 && j === 0 ? 'v' + ia : i === 4 ? 'v' + ib : j === 4 ? 'v' + ic
        : j === 0 ? 'e' + Math.min(ia, ib) + ',' + Math.max(ia, ib) + ',' + (ia < ib ? i : 4 - i)
          : i === 0 ? 'e' + Math.min(ia, ic) + ',' + Math.max(ia, ic) + ',' + (ia < ic ? j : 4 - j)
            : i + j === 4 ? 'e' + Math.min(ib, ic) + ',' + Math.max(ib, ic) + ',' + (ib < ic ? j : 4 - j) : null;
      const za = cv(ia).z, zb = cv(ib).z, zc = cv(ic).z;
      const z = C(za.re + (zb.re - za.re) * i / 4 + (zc.re - za.re) * j / 4, za.im + (zb.im - za.im) * i / 4 + (zc.im - za.im) * j / 4);
      if (key && lat.has(key)) return lat.get(key);
      const r = { z, w: F0(z) };
      if (key) lat.set(key, r);
      return r;
    };
    for (let t = 0; t < nt; t++) {
      if (tstate[t] !== 0) continue;
      const [ia, ib, ic] = [mesh.tri[3 * t], mesh.tri[3 * t + 1], mesh.tri[3 * t + 2]];
      for (let i = 0; i < 4; i++) for (let j = 0; i + j < 4; j++) {
        const sub = [[i, j], [i + 1, j], [i, j + 1]];
        const sub2 = i + j < 3 ? [[i + 1, j], [i + 1, j + 1], [i, j + 1]] : null;
        for (const sb of sub2 ? [sub, sub2] : [sub]) {
          const q = sb.map(([a, b]) => latV(ia, ib, ic, a, b));
          if (!q.every((r) => Number.isFinite(r.w.re) && Number.isFinite(r.w.im))) continue;
          coreTris.push({ w: q.map((r) => r.w), z: q.map((r) => r.z), key: -1, core: true });
          covRaster(q.map((r) => ({ st: 0, w: r.w })), covInc);
        }
      }
    }
  }
  cov.set(covCur); unsat = unsatCur;
  const tCov = Number(process.hrtime.bigint() - tcv0) / 1e6;

  // ---- the refinement loop ----
  const out = [];   // emitted: {w: [3], z: [3] (source points, for patterns), key}
  const emitV = (vv, key, ch = 0, cap = false) => {
    out.push({ w: vv.map((v) => (v.st === 0 ? v.w : null)), z: vv.map((v) => v.z), key, ch, cap });
    st.emitted++;
    if (!reemitting) covRaster(vv, covInc);
  };
  // fan of a polygon around its centroid vertex
  function emitFan(loop, cvx, key, ch) {
    if (loop.length === 3) { emitV(loop, key, ch); return; }
    for (let i = 0; i < loop.length; i++) emitV([cvx, loop[i], loop[(i + 1) % loop.length]], key, ch);
  }
  const mean = (ws) => { let x = 0, y = 0; for (const w of ws) { x += w.re; y += w.im; } return C(x / ws.length, y / ws.length); };
  // stereographic lift
  const lift = (w) => { if (!w) return [0, 0, 1]; const q = w.re * w.re + w.im * w.im; if (q > 1) { const iq = 1 / q; return [2 * w.re * iq / (1 + iq), 2 * w.im * iq / (1 + iq), (1 - iq) / (1 + iq)]; } return [2 * w.re / (q + 1), 2 * w.im / (q + 1), (q - 1) / (q + 1)]; };
  const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  // does the chordal ball (centre p on the sphere, radius r) meet the view box? (its stereographic image is a disc,
  // a disc complement or a half-plane; tested against the box conservatively)
  function capMeetsView(p, r) {
    if (r >= 2) return true;
    // the cap {x : |x - p| <= r} = {x : x . p >= 1 - r^2/2}; the plane in w: |w|^2 (p3 - k) ... use a dense box test
    const kk = 1 - r * r / 2;
    // sample the box boundary and interior on a coarse grid in w; a cap is convex on the sphere, the box is small:
    // test the box corners/edges and the cap centre's projection (exact enough for the prototype)
    const inCap = (w) => { const x = lift(w); return x[0] * p[0] + x[1] * p[1] + x[2] * p[2] >= kk; };
    const N = 24;
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
      if (i > 0 && i < N && j > 0 && j < N && (i % 4 || j % 4)) continue;
      if (inCap(C(vb.x0 + (vb.x1 - vb.x0) * i / N, vb.y0 + (vb.y1 - vb.y0) * j / N))) return true;
    }
    // the cap's centre inside the box?
    if (p[2] < 1 - 1e-12) { const c = C(p[0] / (1 - p[2]), p[1] / (1 - p[2])); if (c.re > vb.x0 && c.re < vb.x1 && c.im > vb.y0 && c.im < vb.y1) return true; }
    return false;
  }

  // the loop of a triangle: vertices from v[0] counterclockwise, and its atomic leaf edges
  function loopOf(T) {
    const vs = [T.v[0]], es = [];
    for (let k = 0; k < 3; k++) { expand(T.e[k], T.v[k], vs, es); }
    vs.pop();   // back at v[0]
    return { vs, es };
  }
  const centroidV = (T) => {
    if (!T.cv) { const p = T.v.map((v) => co(v, T.ch)); T.cv = fromCo(C((p[0].re + p[1].re + p[2].re) / 3, (p[0].im + p[1].im + p[2].im) / 3), T.ch); }
    return T.cv;
  };
  const midV = (a, b, ch) => fromCo(midCo(a, b, ch), ch);

  // the boundary image of a loop (adaptive in the view), for the saturation test; null when it leaves the finite
  // values
  // a source curve between two evaluated vertices: at(t), t in [0, 1] -> z; rim: the image of the region's boundary
  const chartAt = (pa, pb, ch) => (t) => { const p = C(pa.re + t * (pb.re - pa.re), pa.im + t * (pb.im - pa.im)); return ch === 0 ? p : CX.add(cc, CX.inv(p)); };
  const loopSegs = (vs, es) => vs.map((a, i) => { const b = vs[(i + 1) % vs.length], e = es[i]; return { a, b, at: chartAt(co(a, e.ch), co(b, e.ch), e.ch), rim: !!e.bnd }; });
  // the boundary image of a closed chain of source curves (adaptive in the metric), for the saturation test: values
  // {st, w} (st 1 = infinity, sphere only) with a rim flag each; null when a value is missing or a jump is met
  function boundaryPoly(segs) {
    const pts = [], rims = [];
    let ok = true, budget = 60000, rim = false;
    const oc = (q) => (q[0] < -2 ? 1 : 0) | (q[0] > Wpx + 2 ? 2 : 0) | (q[1] < -2 ? 4 : 0) | (q[1] > Hpx + 2 ? 8 : 0);
    const push = (v) => { pts.push(v); rims.push(rim); };
    const val = (w) => (Number.isFinite(w.re) && Number.isFinite(w.im) ? { st: 0, w } : (SPH && (Math.abs(w.re) === Infinity || Math.abs(w.im) === Infinity) ? { st: 1, w: null } : null));
    function seg(at, ta, va, tb, vb, depth) {
      if (!ok) return;
      if (depth > 1200 || budget-- <= 0) { ok = false; st.polyFail = st.polyFail || {}; st.polyFail.budget = (st.polyFail.budget || 0) + 1; return; }
      if (!SPH && depth >= 3 && (oc(px(va.w)) & oc(px(vb.w)))) { push(vb); return; }
      const tm = (ta + tb) / 2;
      const gap = distV(va, vb);
      if (tm === ta || tm === tb) {
        // unresolved to the float limit: fine when the gap is sub-pixel, a jump (not holomorphic) otherwise
        if (gap > 2) { ok = false; st.polyFail = st.polyFail || {}; st.polyFail.floor = (st.polyFail.floor || 0) + 1; return; }
        push(vb); return;
      }
      const vm = val(F(at(tm)));
      if (!vm) { ok = false; st.polyFail = st.polyFail || {}; st.polyFail.noval = (st.polyFail.noval || 0) + 1; return; }
      // deep and still a big gap: a jump keeps it in one half (the other shrinks to nothing); a spiral into an
      // extreme endpoint (e.g. z^i towards |z| = 1e-323) shares it, and is followed down to the float limit
      if (depth > 60 && gap > 2) { const g1 = distV(va, vm), g2 = distV(vm, vb); if (Math.min(g1, g2) < 0.02 * gap) { ok = false; st.polyFail = st.polyFail || {}; st.polyFail.jump = (st.polyFail.jump || 0) + 1; if (opts.jumpDump && st.polyFail.jump % 400 === 1) console.log('JUMP depth', depth, 'ta', ta, 'tb', tb, 'za', at(ta), 'zb', at(tb), 'wa', va.w, 'wm', vm.w, 'wb', vb.w, 'g', gap.toFixed(1), g1.toFixed(2), g2.toFixed(2)); return; } }
      if (depth >= 1 && gap < 24 && devMidV(vm, va, vb) < 0.5) { push(vm); push(vb); return; }
      seg(at, ta, va, tm, vm, depth + 1);
      seg(at, tm, vm, tb, vb, depth + 1);
    }
    push(segs[0].a);
    for (const sg of segs) { if (!ok) break; rim = sg.rim; seg(sg.at, 0, sg.a, 1, sg.b, 0); }
    st.satPolyPts += pts.length;
    if (!ok) return null;
    pts.rims = rims;
    return pts;
  }
  // nonzero-winding fill of the closed polyline (in each chart) against the coverage: true when every pixel centre
  // inside (and more than 1 px from a rim segment) is covered at least K times by strictly nearer sheets
  function saturatedW(vals, probeW) {
    let nInside = 0, nBad = 0, offset = 0;
    satFrac = 0;
    // the polyline in chart 0 (needed for the inverted chart's winding offset: wind(g, w0) = wind(1/g, 1/w0) + wind(g, 0))
    const P0 = vals.map((v) => charts[0].map(v.st === 0 ? v.w : null));
    if (P0.some((q) => !q)) return false;
    const crossLeft = (P, x, y) => { let wd = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; if ((a[1] > y) !== (b[1] > y)) { const xx = a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]); if (xx < x) wd += b[1] > a[1] ? 1 : -1; } } return wd; };
    if (SPH) { const o = charts[0].map(C(0, 0)); offset = crossLeft(P0, o[0], o[1]); }
    // guard: the image of an interior point must have nonzero winding (else F is not holomorphic on the triangle)
    if (probeW) {
      let wd, PP, q;
      if (!SPH || Math.hypot(probeW.re, probeW.im) <= 1) { q = charts[0].map(probeW); PP = P0; wd = crossLeft(P0, q[0], q[1]); }
      else { PP = vals.map((v) => charts[1].map(v.st === 0 ? v.w : null)); if (PP.some((x) => !x)) return false; q = charts[1].map(probeW); wd = crossLeft(PP, q[0], q[1]) + offset; }
      // a probe within a pixel of the polyline (a thin image, sampled to half a pixel) is inconclusive, not a failure
      const onCurve = () => { for (let i = 0; i < PP.length; i++) { const a = PP[i], b = PP[(i + 1) % PP.length]; const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy; let t = L2 > 0 ? ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t)); if (Math.hypot(q[0] - a[0] - t * dx, q[1] - a[1] - t * dy) < 1) return true; } return false; };
      if (wd === 0 && !onCurve()) {
        satFrac = -1; st.guardFail = (st.guardFail || 0) + 1;
        if (opts.guardDump && st.guardFail === 50) {
          // winding in w coordinates (angle sum) around the probe
          let ang = 0;
          for (let i = 0; i < vals.length; i++) { const a = vals[i].w, b = vals[(i + 1) % vals.length].w; if (!a || !b) continue; const t1 = Math.atan2(a.im - probeW.im, a.re - probeW.re), t2 = Math.atan2(b.im - probeW.im, b.re - probeW.re); let d = t2 - t1; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; ang += d; }
          console.log('GUARD n', vals.length, 'probe', probeW, 'angle-sum winding', (ang / (2 * Math.PI)).toFixed(3), 'first pts', vals.slice(0, 6).map((v) => v.w && [v.w.re.toFixed(4), v.w.im.toFixed(4)]));
        }
        return false;
      }
    }
    for (let ci = 0; ci < charts.length; ci++) {
      const ch = charts[ci];
      const P = ci === 0 ? P0 : vals.map((v) => ch.map(v.st === 0 ? v.w : null));
      if (P.some((q) => !q)) return false;
      const off0 = ci === 0 ? 0 : offset;
      const rows = new Array(ch.H);
      const n = P.length;
      for (let i = 0; i < n; i++) {
        const a = P[i], b = P[(i + 1) % n];
        if (a[1] === b[1]) continue;
        const y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
        const j0 = Math.max(0, Math.ceil(y0 - 0.5)), j1 = Math.min(ch.H - 1, Math.ceil(y1 - 0.5) - 1);
        const dir = b[1] > a[1] ? 1 : -1;
        for (let j = j0; j <= j1; j++) {
          const yc = j + 0.5;
          (rows[j] || (rows[j] = [])).push(a[0] + (b[0] - a[0]) * (yc - a[1]) / (b[1] - a[1]), dir);
        }
      }
      let grid = null;
      const near = (xc, yc) => {
        if (!grid) {
          grid = new Map();
          for (let i = 0; i < n; i++) {
            if (!vals.rims[(i + 1) % n]) continue;
            const a = P[i], b = P[(i + 1) % n];
            const gx0 = Math.floor(Math.min(a[0], b[0]) / 8) - 1, gx1 = Math.floor(Math.max(a[0], b[0]) / 8) + 1;
            const gy0 = Math.floor(Math.min(a[1], b[1]) / 8) - 1, gy1 = Math.floor(Math.max(a[1], b[1]) / 8) + 1;
            if ((gx1 - gx0) * (gy1 - gy0) > 4000) continue;
            for (let gx = gx0; gx <= gx1; gx++) for (let gy = gy0; gy <= gy1; gy++) { const k = gx * 100003 + gy; let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(i); }
          }
        }
        const l = grid.get(Math.floor(xc / 8) * 100003 + Math.floor(yc / 8));
        if (!l) return false;
        for (const i of l) {
          const a = P[i], b = P[(i + 1) % n];
          const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
          let t = L2 > 0 ? ((xc - a[0]) * dx + (yc - a[1]) * dy) / L2 : 0;
          t = Math.max(0, Math.min(1, t));
          if (Math.hypot(xc - a[0] - t * dx, yc - a[1] - t * dy) < 1.0) return true;
        }
        return false;
      };
      for (let j = 0; j < ch.H; j++) {
        const r = rows[j];
        if (!r && !off0) continue;
        const idx = [];
        if (r) for (let k = 0; k < r.length; k += 2) idx.push(k);
        idx.sort((p, q) => r[p] - r[q]);
        // spans of constant winding (the offset applies from the far left)
        let wd = off0, xa = -Infinity;
        const span = (x0, x1) => {
          if (wd === 0) return true;
          const i0 = Math.max(0, Math.ceil(x0 - 0.5)), i1 = Math.min(ch.W - 1, Math.ceil(x1 - 0.5) - 1);
          for (let i = i0; i <= i1; i++) {
            const k = j * ch.W + i;
            if (ch.valid && !ch.valid[k]) continue;
            nInside++;
            if (cov[ch.off + k] < K && !near(i + 0.5, j + 0.5)) { nBad++; if (nBad > 0.2 * nInside + 400) return false; }
          }
          return true;
        };
        for (let m = 0; m < idx.length; m++) { if (!span(xa, r[idx[m]])) return false; xa = r[idx[m]]; wd += r[idx[m] + 1]; }
        if (!span(xa, Infinity)) return false;
      }
    }
    satFrac = nInside ? 1 - nBad / nInside : 0;
    return nInside > 0 && nBad === 0;
  }
  let satFrac = 0;

  // one triangle: accept / cull / cap / saturate / drop / refine
  const hist = opts.hist || null;
  // a boundary vertex where F has no finite limit (z^i or log at a boundary point 0, snapped to 1e-323): the image
  // steps of a geometric walk towards it do not shrink (smooth: halve per step; sqrt-like: ~0.7; spiral / log: ~1).
  // Such a vertex is treated like an undefined one (apex rules), so no boundary curve ever has to follow the spiral.
  function probeSing(v, q, ch) {
    const pv = co(v, ch), pq = co(q, ch);
    const d = C(pq.re - pv.re, pq.im - pv.im);
    let prev = null, first = 0, last = 0, n = 0;
    for (let k = 2; k <= 11; k++) {
      const t = Math.pow(2, -k);
      const z = ch === 0 ? C(pv.re + t * d.re, pv.im + t * d.im) : CX.add(cc, CX.inv(C(pv.re + t * d.re, pv.im + t * d.im)));
      const w = F(z);
      if (!(Number.isFinite(w.re) && Number.isFinite(w.im))) { v.sing = true; st.sing = (st.sing || 0) + 1; return; }
      const cur = { st: 0, w };
      if (prev) { const g = distV(prev, cur); if (n === 0) first = g; last = g; n++; }
      prev = cur;
    }
    v.sing = first > 0.5 && last > first / 8;
    if (v.sing) st.sing = (st.sing || 0) + 1;
  }
  function visit(T) {
    st.popped++;
    if (opts.degen && T.ch === 0) {
      const p = T.v.map((v) => v.z);
      const ar = Math.abs((p[1].re - p[0].re) * (p[2].im - p[0].im) - (p[2].re - p[0].re) * (p[1].im - p[0].im));
      const l2 = Math.max(...[0, 1, 2].map((k) => (p[k].re - p[(k + 1) % 3].re) ** 2 + (p[k].im - p[(k + 1) % 3].im) ** 2));
      if (ar < 1e-6 * l2 && !opts.degen.done) {
        opts.degen.done = true;
        let A = T, d = 0;
        while (A && d < 12) { console.log('ANC', d, A.root, 'split edge', A.how, A.v.map((v) => v.z.re.toPrecision(6) + ',' + v.z.im.toPrecision(6)).join(' | '), 'edges', A.e.map((e) => (e.comp ? 'comp' : e.kids ? 'kids' : 'leaf') + (e.frozen != null ? 'F' : '')).join(',')); A = A.par; d++; }
      }
    }
    if (hist) { const k = `${T.root}|ch${T.ch}|key${T.key}`; hist[k] = (hist[k] || 0) + 1; if (opts.sample && st.popped % opts.sample === 0) { const lp = loopOf(T); lp.vs.forEach(evalV); console.log('POP', k, 'n', lp.vs.length, lp.vs.map((v) => `z=${v.z ? v.z.re.toPrecision(4) + ',' + v.z.im.toPrecision(4) : 'inf'} w=${v.w ? v.w.re.toFixed(3) + ',' + v.w.im.toFixed(3) : v.st}`).join(' | ')); } }
    if (T.key > level) { level = T.key; cov.set(covCur); unsat = unsatCur; }
    if (T.key > 0 && unsat === 0 && !opts.injective) { st.saturated++; st.satAll = (st.satAll || 0) + 1; if (T.apexOf) T.apexOf.satRun = (T.apexOf.satRun || 0) + 1; return; }
    st.maxKey = Math.max(st.maxKey, T.key);
    if (st.evals > maxEval || st.emitted - (st.dead || 0) > maxTris) { st.budget++; return; }
    const { vs, es } = loopOf(T);
    for (const v of vs) evalV(v);
    // boundary vertices of a triangle already refined a few levels: probe whether F has a finite limit there
    if (T.key >= 2 && opts.probeSing !== false) for (let i = 0; i < 3; i++) { const v = T.v[i]; if (v.onB && v.sing === undefined && v.st === 0) probeSing(v, T.v[(i + 1) % 3], T.ch); }
    const undef = vs.filter((v) => v.st === 2 || v.sing);
    // region clipping (collar triangles; core roots are inside by construction)
    let clip = false;
    if (T.ch === 1 || T.root === 'collar') {
      const known = vs.filter((v) => v.z !== null);
      const nin = known.filter(inside).length;
      if (nin === 0 && known.length) {
        // all known corners outside: outside when the centroid is too (the region's features are larger than this)
        const c = centroidV(T);
        if (!inside(c) || undef.length === 0) { if (!inside(c)) { st.dropOut++; tr('out', T); return; } }
      }
      clip = nin < known.length;
    }
    // ---- an undefined vertex: cap, cull, stop, or bisect towards it ----
    if (undef.length) {
      const p = undef[0];
      const c = evalV(centroidV(T));
      const def = vs.filter((v) => v.st !== 2);
      const dpts = def.concat(c.st !== 2 ? [c] : []);
      const fin = dpts.filter(okv);
      if (fin.length === dpts.length && fin.length >= 2) {
        let diam = 0;
        for (let i = 0; i < fin.length; i++) for (let j = i + 1; j < fin.length; j++) diam = Math.max(diam, distV(fin[i], fin[j]));
        if (diam < 0.5) {
          // converged: F has a limit here; cap with the centroid image standing in for the undefined vertex
          const q = SPH ? null : (c.st === 0 ? px(c.w) : null);
          if (SPH || (q && !(q[0] < -8 || q[0] > Wpx + 8 || q[1] < -8 || q[1] > Hpx + 8))) {
            const loop = vs.map((v) => (v.st === 2 ? c : v));
            for (let i = 1; i + 1 < loop.length; i++) emitV([loop[0], loop[i], loop[i + 1]], T.key, T.ch, true);
          }
          st.capped++;
          return;
        }
      }
      // all defined images near one point of the sphere (e.g. infinity): cull when that cap misses the view
      const LL = dpts.map((v) => lift(v.st === 0 ? v.w : null));
      const m3 = [0, 1, 2].map((k) => LL.reduce((a, x) => a + x[k], 0) / LL.length);
      const ml = Math.hypot(...m3) || 1;
      const cen = m3.map((x) => x / ml);
      let rho = 0;
      for (const x of LL) rho = Math.max(rho, d3(x, cen));
      if (!SPH && rho < 0.3 && !capMeetsView(cen, 3 * rho + 1e-9)) { st.culled++; tr('cullApex', T); return; }
      // the apex chain stops after Msat consecutive saturated siblings
      if ((T.satRun || 0) >= Msat) { st.apexStop++; tr('apexStop', T); return; }
      // bisect the longest edge (chart) incident to p
      const k0 = T.v.indexOf(p);
      const cand = [];
      if (k0 >= 0) { cand.push(k0, (k0 + 2) % 3); }
      else { for (let k = 0; k < 3; k++) cand.push(k); }   // p is a hanging vertex: split any edge towards it
      let kk = cand[0], best = -1;
      for (const k of cand) { const l = clen(T.e[k].comp ? { a: T.e[k].a, b: T.e[k].b, ch: T.ch } : T.e[k]); if (l > best) { best = l; kk = k; } }
      if (!splittable(T.e[kk])) { st.dropFloor++; return; }
      const [A, B] = bisect(T, kk);
      // the child that keeps p continues the chain after its sibling's verdict
      const apexKid = (A.v.includes(p) || loopOf(A).vs.includes(p)) ? A : B, sib = apexKid === A ? B : A;
      sib.apexOf = apexKid; apexKid.satRun = T.satRun || 0; apexKid.ord = 1; apexKid.pending = true;
      heap.push(sib); heap.push(apexKid);
      return;
    }
    // ---- all vertices defined: assess the triangle, or its inside polygon when the region boundary crosses it ----
    if (clip) { clipVisit(T, vs, es); return; }
    const segs = vs.map((a, i) => {
      const b = vs[(i + 1) % vs.length], e = es[i];
      return { a, b, at: chartAt(co(a, e.ch), co(b, e.ch), e.ch), rim: !!e.bnd, mid: () => midOf(e), cl: dch(a, b, T.ch) };
    });
    assess(T, vs, segs, centroidV(T), false);
  }
  const vlike = (z) => { const v = mkV(z); return evalV(v); };
  function registerLeaf(T, i0, i1) {
    T.outRange = [i0, i1];
    const { es } = loopOf(T);
    for (const e of es) (e.users || (e.users = new Set())).add(T);
  }
  function reemit(T) {
    if (!T.outRange) return;
    for (let i = T.outRange[0]; i < T.outRange[1]; i++) { if (!out[i].dead) st.dead = (st.dead || 0) + 1; out[i].dead = true; }
    const { vs } = loopOf(T);
    for (const v of vs) evalV(v);
    const c = evalV(centroidV(T));
    const i0 = out.length;
    reemitting = true;
    if (vs.length === 3) emitV(vs, T.key, T.ch); else emitFan(vs, c, T.key, T.ch);
    reemitting = false;
    st.reemitted = (st.reemitted || 0) + 1;
    registerLeaf(T, i0, out.length);
  }
  let reemitting = false;
  // leaves whose edges were split after their emission: re-emitted once per upload (here: at the end), so a leaf next
  // to a long chain of splits costs its final fan only
  const dirty = new Set();
  const flushDirty = () => { for (const T of dirty) reemit(T); dirty.clear(); };
  const dch = (a, b, ch) => { const p = co(a, ch), q = co(b, ch); return Math.hypot(p.re - q.re, p.im - q.im); };
  // P: the polygon's vertices (counterclockwise), segs[i]: the source curve P[i] -> P[i+1] ({at, rim, mid, cl}),
  // cvx: an interior vertex (the fan centre)
  function assess(T, P, segs, cvx, isClip) {
    const c = evalV(cvx);
    let finite = okv(c) && P.every(okv);
    let dev = 0, len = 0;
    const tests = [];
    if (finite) {
      for (let i = 0; i < segs.length; i++) {
        const sg = segs[i];
        const m = evalV(sg.mid());
        if (!okv(m)) { finite = false; break; }
        dev = Math.max(dev, devMidV(m, P[i], P[(i + 1) % P.length]));
        len = Math.max(len, distV(P[i], P[(i + 1) % P.length]));
        tests.push(m);
      }
    }
    const fan = P.length > 3 || isClip;
    if (finite) {
      if (!fan) dev = Math.max(dev, devCenV(c, P));
      else {
        const pid = P.map((v) => v.id).join(',');
        if (!T.spk || T.spk.c !== c || T.spk.pid !== pid) { T.spk = P.map((v) => midV(c, v, T.ch)); T.spk.c = c; T.spk.pid = pid; }
        for (let i = 0; i < P.length; i++) {
          const m = evalV(T.spk[i]);
          if (!okv(m)) { finite = false; break; }
          dev = Math.max(dev, devMidV(m, c, P[i]));
          len = Math.max(len, distV(c, P[i]));
          tests.push(m);
        }
      }
    }
    const good = finite && dev <= tau && len <= emax;
    // cull: accurate -> its flat bbox; else a chordal cap around the lifted points when they look smooth (flat views;
    // the Sphere view keeps the whole globe, so orbiting never needs new work)
    if (!SPH) {
      const pts = P.concat(tests, [c]);
      if (good) {
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (const v of pts) { x0 = Math.min(x0, v.w.re); x1 = Math.max(x1, v.w.re); y0 = Math.min(y0, v.w.im); y1 = Math.max(y1, v.w.im); }
        if (x1 < vb.x0 || x0 > vb.x1 || y1 < vb.y0 || y0 > vb.y1) { st.culled++; tr('cullBox', T); return; }
      } else if (pts.every((v) => v.st !== 2)) {
        const L3 = pts.map((v) => lift(v.st === 0 ? v.w : null));
        const cen = lift(c.st === 0 ? c.w : null);
        let rho = 0;
        for (const x of L3) rho = Math.max(rho, d3(x, cen));
        // smoothness on the sphere: the centroid lift near the mean of the vertex lifts
        const cl = P.map((v) => lift(v.st === 0 ? v.w : null));
        const mc = [0, 1, 2].map((k) => cl.reduce((a, x) => a + x[k], 0) / cl.length);
        const sdev = d3(mc, cen);
        if (rho < 0.5 && sdev <= 0.35 * rho && !capMeetsView(cen, 2 * rho + 1e-12)) { st.culled++; tr('cullCap', T); return; }
      }
    }
    if (good) {
      // drop when completely hidden under nearer sheets (only keys > 0)
      if (T.key > 0) {
        let hidden = true, npx = 0;
        const ws = !fan ? [[P[0], P[1], P[2]]] : P.map((v, i) => [c, v, P[(i + 1) % P.length]]);
        for (const tri of ws) { covRaster(tri, (i) => { npx++; if (cov[i] < K) hidden = false; }); if (!hidden) break; }
        // (a triangle that covers no pixel centre is kept: a small pan would show it)
        if (hidden && npx > 0) { st.saturated++; tr('hidden', T); if (T.apexOf) T.apexOf.satRun = (T.apexOf.satRun || 0) + 1; return; }
      }
      if (T.apexOf) T.apexOf.satRun = 0;
      const i0 = out.length;
      if (!fan) emitV(P, T.key, T.ch);
      else emitFan(P, c, T.key, T.ch);
      if (!isClip) registerLeaf(T, i0, out.length);
      st.accepted++;
      return;
    }
    // ---- saturation of a failing triangle (keys > 0, holomorphic): boundary image fill vs nearer coverage ----
    if (T.key > 0 && finite && !opts.injective) {
      // cheap pre-check: interior test images on unsaturated pixels -> not saturated
      let maybe = true;
      for (const v of [c].concat(T.spk || [], tests, P)) {
        if (v.st !== 0 || v.onB) continue;   // (points on the region's boundary map to rims)
        const i = covIdx(v.w);
        if (i >= 0 && cov[i] < K) { maybe = false; break; }
      }
      if (maybe) {
        st.satTests++;
        const poly = boundaryPoly(segs);
        if (poly && saturatedW(poly, c.w)) {
          st.saturated++; tr('satPoly', T);
          if (T.apexOf) T.apexOf.satRun = (T.apexOf.satRun || 0) + 1;
          return;
        }
        if (opts.fracHist) { const b = poly ? Math.floor(satFrac * 10) : 'nopoly'; opts.fracHist[b] = (opts.fracHist[b] || 0) + 1; const kk = 'k' + T.key + (T.ch ? 'u' : 'z'); opts.fracHist[kk] = (opts.fracHist[kk] || 0) + 1; }
        // nearly saturated: the nearer sheets are not complete yet; wait for them (a deeper key) instead of refining
        if (poly && opts.defer !== false && satFrac >= (opts.deferFrac ?? 0.8) && (T.defer || 0) < (opts.deferMax ?? 2)) { T.defer = (T.defer || 0) + 1; T.key += 1; st.deferred = (st.deferred || 0) + 1; heap.push(T); return; }
      }
    }
    if (T.apexOf) T.apexOf.satRun = 0;
    // ---- sub-pixel discontinuity (a cut through the triangle): drop when its continuous pieces are sub-pixel ----
    if (finite) {
      // a segment whose image does not shrink on one half (a jump: a cut crosses it) ...
      let jump = false, lmin = Infinity, dmax = 0, ext = 2;
      for (let i = 0; i < segs.length; i++) {
        const a = P[i], b = P[(i + 1) % P.length], m = tests[i], l = segs[i].cl;
        const ab = distV(a, b), am = distV(a, m), mb = distV(m, b);
        const isJump = ab > 2 * tau && Math.max(am, mb) > 0.85 * ab && Math.min(am, mb) < 0.15 * ab;
        if (isJump) { jump = true; ext = Math.max(ext, 2 * Math.min(am, mb)); }
        else { if (l > 0) lmin = Math.min(lmin, ab / l); ext = Math.max(ext, ab); }
        dmax = Math.max(dmax, l);
      }
      // ... and continuous pieces below half a pixel: drop (its pieces would be sub-pixel slivers along the cut)
      if (jump && lmin * dmax < 0.5) { st.dropSub++; tr('dropSub', T); return; }
      // ... or every piece (within ext px of its own points' images) away from the view: cull
      if (jump && !SPH) {
        let dmin = Infinity;
        for (const v of P.concat(tests, [c])) {
          const q = px(v.w);
          const dx = Math.max(0, -q[0], q[0] - Wpx), dy = Math.max(0, -q[1], q[1] - Hpx);
          dmin = Math.min(dmin, Math.hypot(dx, dy));
        }
        if (dmin > 2 * ext) { st.culled++; tr('cullJump', T); return; }
      }
    }
    refineNext(T, isClip);
  }
  // a triangle crossed by the region boundary: its inside polygon (cut points on the leaf edges, shared per edge;
  // the boundary curve between them sampled on the level set)
  function clipVisit(T, vs, es) {
    const n = vs.length;
    const s0 = vs.findIndex(inside);
    if (s0 < 0) { st.dropOut++; tr('out', T); return; }
    const P = [], segs = [];
    let nchg = 0, exitCut = null;
    const edgeSeg = (a, b, e, whole) => ({ a, b, at: chartAt(co(a, e.ch), co(b, e.ch), e.ch), rim: !!e.bnd,
      mid: whole ? () => midOf(e) : () => midV(a, b, e.ch), cl: dch(a, b, T.ch) });
    for (let k = 0; k < n; k++) {
      const i = (s0 + k) % n, a = vs[i], b = vs[(i + 1) % n], e = es[i];
      const ia = inside(a), ib = inside(b);
      if (ia && ib) { P.push(a); segs.push(edgeSeg(a, b, e, true)); }
      else if (ia && !ib) { const cp = evalV(cutOf(e)); nchg++; P.push(a); segs.push(edgeSeg(a, cp, e, false)); P.push(cp); segs.push(null); exitCut = cp; }
      else if (!ia && ib) { const cp = evalV(cutOf(e)); nchg++; P.push(cp); segs.push(edgeSeg(cp, b, e, false)); }
    }
    if (nchg !== 2 || P.length < 3) { refineNext(T, true); return; }
    // the boundary curve from the exit cut point to the entry cut point (the next polygon vertex)
    const k = segs.indexOf(null), c1 = P[k], c2 = P[(k + 1) % P.length];
    const p1 = co(c1, T.ch), p2 = co(c2, T.ch);
    const d = C(p2.re - p1.re, p2.im - p1.im), l = Math.hypot(d.re, d.im) || 1e-300, nn = C(-d.im / l, d.re / l);
    const onCurve = (t) => snapZ(C(p1.re + t * d.re, p1.im + t * d.im), nn, T.ch, 0.5 * l + 1e-300);
    segs[k] = { a: c1, b: c2, at: onCurve, rim: true, mid: () => { if (!T.bmid) T.bmid = vlike(onCurve(0.5)); return T.bmid; }, cl: l };
    // the fan centre: the polygon's centroid (chart), inside
    if (!T.pc) {
      const q = P.map((v) => co(v, T.ch));
      T.pc = fromCo(C(q.reduce((a, x) => a + x.re, 0) / q.length, q.reduce((a, x) => a + x.im, 0) / q.length), T.ch);
    }
    if (!inside(T.pc)) { refineNext(T, true); return; }
    assess(T, P, segs, T.pc, true);
  }
  // split the worst edge: largest image length (or chart length when values are missing)
  function refineNext(T, isClip) {
    // the edge to split: the image arc-length estimate decides among the edges at least 0.3 of the longest (chart);
    // the longest chart edge is forced once it has survived two generations (bounded aspect, as longest-edge
    // bisection: a short edge next to a long one cannot be split forever, e.g. along a spiral edge)
    const cl3 = T.e.map((e) => clen(e.comp ? { a: e.a, b: e.b, ch: T.ch } : e));
    const clmax = Math.max(...cl3), kl = cl3.indexOf(clmax);
    let kk = -1, best = -1;
    if ((T.longAge || 0) >= 2 && splittable(T.e[kl])) kk = kl;
    else for (let k = 0; k < 3; k++) {
      const e = T.e[k];
      if (!splittable(e) || cl3[k] < 0.3 * clmax) continue;
      const a = T.v[k], b = T.v[(k + 1) % 3];
      let b2;
      if (isClip) b2 = cl3[k];
      else if (okv(a) && okv(b)) {
        if (e.comp || e.kids) {
          // the chain of images along the split edge (a lower bound of its image arc length)
          const v2 = [], e2 = []; expand(e, a, v2, e2);
          let pv = a; b2 = 0;
          for (const v of v2) { if (okv(v) && okv(pv)) b2 += distV(v, pv); pv = v; }
        } else if (e.mid && okv(e.mid)) b2 = distV(a, e.mid) + distV(e.mid, b);
        else b2 = distV(a, b);
      } else b2 = 1e300 * (cl3[k] || 0) + 1;
      if (b2 > best) { best = b2; kk = k; }
    }
    if (kk < 0) { st.dropFloor++; return; }
    const [A, B] = bisect(T, kk);
    // age of the longest edge in the child that keeps it
    const L = T.e[kl];
    for (const X of [A, B]) X.longAge = kk !== kl && X.e.includes(L) ? (T.longAge || 0) + 1 : 0;
    heap.push(A); heap.push(B);
  }
  // bisect T on its edge k (between v[k] and v[k+1]); children stay counterclockwise
  function bisect(T, k) {
    const A = T.v[k], B = T.v[(k + 1) % 3], Cc = T.v[(k + 2) % 3];
    const eAB = T.e[k], eBC = T.e[(k + 1) % 3], eCA = T.e[(k + 2) % 3];
    const { m, h0, h1 } = splitEdge(eAB, A);
    const eMC = edge(m, Cc, T.ch);
    const T1 = mkTri([A, m, Cc], [h0, eMC, eCA], T.ch, { root: T.root });
    const T2 = mkTri([m, B, Cc], [h1, eBC, eMC], T.ch, { root: T.root });
    T1.key = Math.max(T1.key, T.key); T2.key = Math.max(T2.key, T.key);
    T1.par = T2.par = T; T1.how = T2.how = k;
    return [T1, T2];
  }
  // a collar leaf crossing the region boundary: emit its inside polygon (cut points on the leaf edges, shared per
  // edge); false when the boundary is not resolved yet (refine)
  function cutOf(e) {
    if (e.cut !== undefined) return e.cut;
    const ia = inside(e.a);
    let a = 0, b = 1;
    const pa = co(e.a, e.ch), pb = co(e.b, e.ch);
    const at = (t) => fromCo(C(pa.re + t * (pb.re - pa.re), pa.im + t * (pb.im - pa.im)), e.ch);
    for (let i = 0; i < 80; i++) { const m = (a + b) / 2; if (m === a || m === b) break; if ((lev(at(m).z) > 0) === ia) a = m; else b = m; }
    const v = at(ia ? a : b);
    v.onB = true;
    e.cut = v;
    return v;
  }
  const tl0 = process.hrtime.bigint();
  while (heap.size) visit(heap.pop());
  flushDirty();
  const tLayer = Number(process.hrtime.bigint() - tl0) / 1e6;
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  return { out: out.filter((t) => !t.dead), coreTris, st, ms, tClass, tMesh, tCov, tLayer, mesh, tstate, B1, collar, cc };
}

module.exports = { build, Region, CX, C };
