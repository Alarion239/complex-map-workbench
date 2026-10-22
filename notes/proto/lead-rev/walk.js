'use strict';
// Lead revision prototype (SPEC rev 2, sections 3.5, 3.6, 4.1): the CPU twin of the revised GPU walk.
//  - member ranges come from the SHAPE, not from the view: per-pixel line/ray clip when the prefix of the family op
//    is affine (exact for convex kinds; a "hole" interval for complements and annuli), a per-shape float64 range box
//    of the prefix image otherwise;
//  - every family op gets a per-shape scan budget N_j (product <= LEAF_CAP); only the innermost window family may be
//    truncated (D-window centred at clamp(m*, lo, hi)); any other family whose range does not fit -> shape forward;
//  - two cursors: a finished direction does not consume budget;
//  - exact early stop at stopOp: AFF prefix: first member with D > D_K; MOB in the prefix: lower bound LB > D_K
//    once the member moves away from the pole's projection (r_m decreasing);
//  - tail flag: a direction truncated by the budget whose last 3 members all covered.
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const INV = require(path.join(ROOT, 'notes/proto/lead-inv/inverse_proto.js'));
const Region = require(path.join(ROOT, 'src/region.js'));
const { C } = CX;
const PI = Math.PI, TAU = 2 * PI, DEG = PI / 180;
const LEAF_CAP = 64, MIN_WIN = 9, WIN_MAX = 17;
const ADD = new Set(['EXP', 'EXPC', 'SIN', 'COS', 'TAN', 'SINH', 'COSH', 'TANH']);

// ---------------- families ----------------
function famOf(o) {
  if (ADD.has(o.kind)) return { type: 'add', p: o.kind === 'EXP' || o.kind === 'EXPC' ? o.period : ({ SIN: C(TAU, 0), COS: C(TAU, 0), TAN: C(PI, 0), SINH: C(0, TAU), COSH: C(0, TAU), TANH: C(0, PI) })[o.kind] };
  if (o.kind === 'ROOTPOW') {
    const beta = CX.inv(o.s);
    if (o.count === 'one') return null;
    const S = C(-TAU * beta.im, TAU * beta.re);                         // L_m = bL + m S
    const lo = o.theta - TAU + TAU * o.k, hi = o.theta + TAU * o.k;
    return { type: 'log', beta, S, lo, hi, inf: o.count === 'inf', radial: Math.abs(beta.re) <= Math.abs(beta.im) / 8,
      finCount: o.count === 'inf' ? Infinity : Math.ceil(1 / Math.abs(beta.re)) + 3 };
  }
  if (typeof o.count === 'number') return { type: 'fin', count: o.count };
  return null;                                                           // single-valued
}
// ROOTPOW member (as inverse_proto.js opRootPow.member)
function rootMember(o, F, w, m) {
  const bL = CX.mul(F.beta, CX.log(w));
  const L = C(bL.re + m * F.S.re, bL.im + m * F.S.im);
  const a = L.im - F.lo, b = F.hi - L.im, u = CX.exp(L), sAbs = CX.abs(o.s);
  const g = CX.mul(C(0, 1), CX.conj(CX.div(F.beta, w))), gl = CX.abs(g) || 1, sg = a < b ? 1 : -1;
  return { u, d: CX.div(CX.mul(F.beta, u), w), lvl: Math.min(a, b) * sAbs * CX.abs(w), lg: C(sg * g.re / gl, sg * g.im / gl), lam: L, idx: m };
}
// bases of an additive family at w: [{base (u at m = 0), bi}]
function addBases(o, w) {
  if (o.kind === 'EXP' || o.kind === 'EXPC') return CX.isZero(w) ? [] : [{ bi: 0 }];
  const out = []; let bi = 0;
  const all = o.pre(w, null, () => [0, 0]);
  for (const mm of all) out.push({ bi: Math.round(mm.idx / 1000) });
  return out;
}
function addMember(o, w, bi, m) {
  const list = o.pre(w, null, () => [m, m]);
  if (o.kind === 'EXP' || o.kind === 'EXPC') return list[0] || null;
  return list.find((x) => Math.round((x.idx - m) / 1000) === bi) || null;
}

// ---------------- shape line clip (z = z0 + t q) ----------------
// returns {lo, hi, hlo, hhi} (t units; hole: (hlo, hhi) is outside the shape), or null when the shape is not clippable
const EMPTY = { lo: 1, hi: 0 };
function clipConvexKind(s, z0, q) {
  const qq = q.re * q.re + q.im * q.im;
  const disc = (c, r) => {
    const dx = z0.re - c[0], dy = z0.im - c[1];
    const b = dx * q.re + dy * q.im, cc = dx * dx + dy * dy - r * r, D = b * b - qq * cc;
    if (D < 0) return EMPTY;
    const sq = Math.sqrt(D);
    return { lo: (-b - sq) / qq, hi: (-b + sq) / qq };
  };
  const half = (a, d) => {                                             // inside: cross(d, z - a) > 0
    const L0 = d.re * (z0.im - a.im) - d.im * (z0.re - a.re), cq = d.re * q.im - d.im * q.re;
    if (Math.abs(cq) < 1e-300) return L0 > 0 ? { lo: -Infinity, hi: Infinity } : EMPTY;
    const t = -L0 / cq;
    return cq > 0 ? { lo: t, hi: Infinity } : { lo: -Infinity, hi: t };
  };
  const and = (A, B) => ({ lo: Math.max(A.lo, B.lo), hi: Math.min(A.hi, B.hi) });
  const slab = (x0, x1, y0, y1) => {
    let r = { lo: -Infinity, hi: Infinity };
    if (Math.abs(q.re) < 1e-300) { if (!(z0.re >= x0 && z0.re <= x1)) return EMPTY; } else { const a = (x0 - z0.re) / q.re, b = (x1 - z0.re) / q.re; r = and(r, { lo: Math.min(a, b), hi: Math.max(a, b) }); }
    if (Math.abs(q.im) < 1e-300) { if (!(z0.im >= y0 && z0.im <= y1)) return EMPTY; } else { const a = (y0 - z0.im) / q.im, b = (y1 - z0.im) / q.im; r = and(r, { lo: Math.min(a, b), hi: Math.max(a, b) }); }
    return r;
  };
  switch (s.kind) {
    case 'disc': return disc(s.c, s.r);
    case 'rect': return slab(Math.min(s.a[0], s.b[0]), Math.max(s.a[0], s.b[0]), Math.min(s.a[1], s.b[1]), Math.max(s.a[1], s.b[1]));
    case 'polygon': { const b = Region.bboxOf(s); return slab(b.x0, b.x1, b.y0, b.y1); }   // hull (bounded)
    case 'halfplane': { const a = C(s.a[0], s.a[1]), d = CX.sub(C(s.b[0], s.b[1]), a); return half(a, d); }
    case 'annulus': { const r = disc(s.c, Math.max(s.r1, s.r2)), h = disc(s.c, Math.min(s.r1, s.r2)); return Object.assign(r, h.lo <= h.hi ? { hlo: h.lo, hhi: h.hi } : {}); }
    case 'sector': {
      const span = (((s.t2 - s.t1) % 360) + 360) % 360 || 360, c = C(s.c[0], s.c[1]);
      const u1 = C(Math.cos(s.t1 * DEG), Math.sin(s.t1 * DEG)), u2 = C(Math.cos((s.t1 + span) * DEG), Math.sin((s.t1 + span) * DEG));
      let r;
      if (span >= 360) r = { lo: -Infinity, hi: Infinity };
      else if (span <= 180) r = and(half(c, u1), half(c, CX.neg(u2)));
      else {                                                           // reflex: complement of the convex wedge (u2 .. u1)
        const h = and(half(c, u2), half(c, CX.neg(u1)));
        r = Object.assign({ lo: -Infinity, hi: Infinity }, h.lo <= h.hi ? { hlo: h.lo, hhi: h.hi } : {});
      }
      if (s.r > 0) { const d = disc(s.c, s.r); return { lo: Math.max(r.lo, d.lo), hi: Math.min(r.hi, d.hi) }; }   // hole dropped: hull
      return r;
    }
  }
  return null;
}
function clipLine(s, z0, q) {
  if (s.complement) {
    const base = Object.assign({}, s, { complement: false });
    const r = clipConvexKind(base, z0, q);
    if (!r) return null;
    if (r.hlo !== undefined) return { lo: -Infinity, hi: Infinity };     // complement of an annulus etc.: no hole
    return r.lo <= r.hi ? { lo: -Infinity, hi: Infinity, hlo: r.lo, hhi: r.hi } : { lo: -Infinity, hi: Infinity };
  }
  return clipConvexKind(s, z0, q);
}
const convexKind = (s) => !s.complement && (['disc', 'rect', 'halfplane'].includes(s.kind) || (s.kind === 'sector' && ((((s.t2 - s.t1) % 360) + 360) % 360 || 360) <= 180));

// support of a shape in direction e (as SPEC 3.8): [lo, hi]
function supportOf(s, e) {
  if (s.complement) return [-Infinity, Infinity];
  const dot = (x, y) => x * e.re + y * e.im;
  switch (s.kind) {
    case 'disc': { const c = dot(s.c[0], s.c[1]); return [c - s.r, c + s.r]; }
    case 'annulus': { const c = dot(s.c[0], s.c[1]), r = Math.max(s.r1, s.r2); return [c - r, c + r]; }
    case 'rect': case 'polygon': { const b = Region.bboxOf(s); const v = [dot(b.x0, b.y0), dot(b.x0, b.y1), dot(b.x1, b.y0), dot(b.x1, b.y1)]; return [Math.min(...v), Math.max(...v)]; }
    case 'sector': if (s.r > 0) { const c = dot(s.c[0], s.c[1]); return [c - s.r, c + s.r]; } return [-Infinity, Infinity];
    case 'halfplane': {
      const a = C(s.a[0], s.a[1]), d = CX.sub(C(s.b[0], s.b[1]), a), L = CX.abs(d), n = C(-d.im / L, d.re / L);
      const en = e.re * n.re + e.im * n.im;
      if (Math.abs(en) >= 1 - 1e-12) return en > 0 ? [dot(a.re, a.im), Infinity] : [-Infinity, dot(a.re, a.im)];
      return [-Infinity, Infinity];
    }
  }
  return [-Infinity, Infinity];
}

// ---------------- per-shape range box of a non-affine prefix (float64, adaptive) ----------------
// coord(u): the family's linear coordinate. Returns {lo, hi, farCover} (lo/hi may be infinite).
function rangeBox(G, s, coord, unit, poles) {
  const bb = Region.bboxOf(s);
  const L = Region.levelOf(s);
  // a prefix pole inside (or on) the shape: G(S) contains a neighbourhood of infinity -> far members cover
  for (const p of poles) if (L(p) > -1e-9) return { lo: -Infinity, hi: Infinity, farCover: true };
  if (!bb) return { lo: -Infinity, hi: Infinity, farCover: false };
  let lo = Infinity, hi = -Infinity, pad = 0, bad = false;
  const diag = Math.hypot(bb.x1 - bb.x0, bb.y1 - bb.y0);
  const cellRec = (x0, y0, x1, y1, depth) => {
    const xs = [x0, (x0 + x1) / 2, x1], ys = [y0, (y0 + y1) / 2, y1], h = Math.hypot(x1 - x0, y1 - y0);
    const vals = [];
    let near = false;
    for (const x of xs) for (const y of ys) { const z = C(x, y); if (L(z) > -h) near = true; vals.push(coord(G(z))); }
    if (!near) return;
    if (!vals.every(Number.isFinite)) { if (depth >= 8) { bad = true; return; } }
    else {
      const mn = Math.min(...vals), mx = Math.max(...vals);
      if (mx - mn <= unit / 4 || depth >= 8) {
        if (mx - mn > unit * 4) { bad = true; return; }
        lo = Math.min(lo, mn); hi = Math.max(hi, mx); pad = Math.max(pad, mx - mn); return;
      }
    }
    const xm = (x0 + x1) / 2, ym = (y0 + y1) / 2;
    cellRec(x0, y0, xm, ym, depth + 1); cellRec(xm, y0, x1, ym, depth + 1); cellRec(x0, ym, xm, y1, depth + 1); cellRec(xm, ym, x1, y1, depth + 1);
  };
  const n = 8, dx = (bb.x1 - bb.x0) / n, dy = (bb.y1 - bb.y0) / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) cellRec(bb.x0 + i * dx, bb.y0 + j * dy, bb.x0 + (i + 1) * dx, bb.y0 + (j + 1) * dy, 0);
  if (bad) return { lo: -Infinity, hi: Infinity, farCover: false, bad: true };
  return { lo: lo - pad, hi: hi + pad, farCover: false, diag };
}

// ---------------- prepare (per shape, per view) ----------------
function mobOf(o) { return o.kind === 'AFF' ? [o.a, o.b, C(0, 0), C(1, 0)] : o.m; }
function mobMul(A, B) { const { add, mul } = CX; return [add(mul(A[0], B[0]), mul(A[1], B[2])), add(mul(A[0], B[1]), mul(A[1], B[3])), add(mul(A[2], B[0]), mul(A[3], B[2])), add(mul(A[2], B[1]), mul(A[3], B[3]))]; }
function mobInv(M) { return [M[3], CX.neg(M[1]), CX.neg(M[2]), M[0]]; }
function prepare(plan, shape, win, opts = {}) {
  const ops = plan.ops, N = ops.length;
  const fam = ops.map(famOf);
  let cRef = opts.ref || C((win.x0 + win.x1) / 2, (win.y0 + win.y1) / 2);
  let refs = INV.makeRefs(plan, cRef);
  const allFin = (rs) => rs.every(CX.isFin) && CX.isFin(plan.ops.reduce((z, o) => o.fwd(z), cRef));
  if (!allFin(refs)) { const Rw = (win.x1 - win.x0) / 4; cRef = C(cRef.re + Rw * Math.cos(0.3), cRef.im + Rw * Math.sin(0.3)); refs = INV.makeRefs(plan, cRef); }
  const R = Math.hypot(win.x1 - win.x0, win.y1 - win.y0) / 2, rs = R / 8;
  const sing = opts.sing || [];
  const rspec = [], need = [];
  let inner = -1;
  for (let j = 0; j < N; j++) {
    const F = fam[j];
    if (!F) { rspec.push(null); need.push(1); continue; }
    if (F.type === 'fin') { rspec.push(null); need.push(F.count); continue; }
    if (F.type === 'log' && !F.inf) {                                    // ROOTPOW finite: branch range only
      rspec.push({ kind: 'branch' }); need.push(F.finCount); if (F.radial && inner < 0) inner = j; continue;
    }
    if (inner < 0) inner = j;
    const pre = ops.slice(0, j);
    const aff = pre.every((o) => o.kind === 'AFF');
    if (aff) {
      let A = C(1, 0), B = C(0, 0);
      for (const o of pre) { A = CX.mul(o.a, A); B = CX.add(CX.mul(o.a, B), o.b); }
      if (F.type === 'add') {
        const q = CX.div(F.p, A), qa = CX.abs(q), e = C(q.re / qa, q.im / qa);
        const [lo, hi] = supportOf(shape, e);
        rspec.push({ kind: 'clip', A, B }); need.push(Number.isFinite(hi - lo) ? Math.ceil((hi - lo) / qa) + 3 : Infinity);
      } else {
        // ray from za = -B/A: log-radius extent of the shape around za
        const za = CX.neg(CX.div(B, A)), L = Region.levelOf(shape), bb = Region.bboxOf(shape);
        let nd = Infinity;
        if (bb && !(L(za) > -1e-12)) {
          const rmin = Math.max(1e-300, -L(za) * 0.999), cs = [[bb.x0, bb.y0], [bb.x0, bb.y1], [bb.x1, bb.y0], [bb.x1, bb.y1]];
          const rmax = Math.max(...cs.map(([x, y]) => Math.hypot(x - za.re, y - za.im)));
          nd = Math.ceil(Math.log(rmax / rmin) / Math.abs(F.S.re)) + 3;
        }
        rspec.push({ kind: 'clip', A, B }); need.push(nd);
      }
    } else {
      const G = (z) => pre.reduce((u, o) => o.fwd(u), z);
      // prefix poles pulled back to z (prototype: only the first MOB/recip pole through an AFF/identity start)
      const poles = [];
      let M = [C(1, 0), C(0, 0), C(0, 0), C(1, 0)], ok = true;
      for (const o of pre) { if (o.kind === 'AFF' || o.kind === 'MOB') M = mobMul(mobOf(o), M); else { ok = false; break; } }
      if (ok && !CX.isZero(M[2])) poles.push(CX.neg(CX.div(M[3], M[2])));
      for (const o of pre) if (o.kind === 'IPOW' && o.n < 0 && pre.indexOf(o) === 0) poles.push(C(0, 0));
      if (opts.poles) poles.push(...opts.poles[j] || []);
      let coord, unit;
      if (F.type === 'add') { const pa = CX.abs(F.p), e = C(F.p.re / pa, F.p.im / pa); coord = (u) => (CX.isFin(u) ? u.re * e.re + u.im * e.im : NaN); unit = pa; }
      else { coord = (u) => (CX.isFin(u) && !CX.isZero(u) ? Math.log(CX.abs(u)) : NaN); unit = Math.abs(F.S.re); }
      const bx = rangeBox(G, shape, coord, unit, poles);
      rspec.push(Object.assign({ kind: 'box' }, bx)); need.push(Number.isFinite(bx.hi - bx.lo) ? Math.ceil((bx.hi - bx.lo) / unit) + 3 : Infinity);
    }
  }
  // budgets
  const Nb = need.slice();
  let Pf = 1, reason = null;
  for (let j = 0; j < N; j++) {
    if (!fam[j] || j === inner) continue;
    if (!Number.isFinite(need[j])) { reason = `op ${j} (${ops[j].kind}): unbounded range outside the innermost family`; break; }
    Pf *= need[j];
  }
  if (!reason && Pf > LEAF_CAP) reason = `fixed families need ${Pf} > ${LEAF_CAP} leaves`;
  if (!reason && inner >= 0) {
    const allow = Math.floor(LEAF_CAP / Pf);
    if (need[inner] <= allow) Nb[inner] = need[inner];
    else {
      Nb[inner] = Math.min(allow, WIN_MAX);
      const sp = rspec[inner];
      const truncOk = !Number.isFinite(need[inner]) ? true : (sp && sp.kind === 'clip' && convexKind(shape)) || (sp && sp.kind === 'branch');
      if (Nb[inner] < MIN_WIN) reason = `innermost family budget ${Nb[inner]} < ${MIN_WIN}`;
      else if (!truncOk) reason = `bounded range of ${need[inner]} members does not fit (${allow}) for a non-convex shape`;
      else if (sp && sp.kind === 'box' && !sp.farCover && !Number.isFinite(need[inner]) && !opts.allowBoxTrunc) reason = 'unbounded prefix range without far cover (unbounded shape through a non-affine prefix)';
    }
  }
  // stop op: the innermost window family with only AFF/MOB before it (log families: AFF only)
  let stopOp = -1, stopMob = null;
  if (inner >= 0 && fam[inner].type !== 'fin' && !(fam[inner].type === 'log' && !fam[inner].inf)) {
    const pre = ops.slice(0, inner);
    const okA = pre.every((o) => o.kind === 'AFF'), okM = pre.every((o) => o.kind === 'AFF' || o.kind === 'MOB');
    if (okA || (okM && opts.naiveStop)) stopOp = inner;
    else if (okM && fam[inner].type === 'add' && !opts.noMobStop) {
      let M = [C(1, 0), C(0, 0), C(0, 0), C(1, 0)];
      for (const o of pre) M = mobMul(mobOf(o), M);                      // u = M(z)
      const T = mobInv(M);                                               // z = T(u)
      if (!CX.isZero(T[2])) { stopOp = inner; stopMob = { T, cRef: CX.mobApply(T, refs[inner]), pAcc: CX.div(T[0], T[2]), uPole: CX.neg(CX.div(T[3], T[2])), pInP: sing.some((p) => CX.abs(CX.sub(p, CX.div(T[0], T[2]))) < 1e-9 * (1 + CX.abs(p))) }; }
    }
  }
  return { ok: !reason, reason, fam, refs, rspec, need, N: Nb, inner, stopOp, stopMob, win, R, rs, sing, shape, L: Region.levelOf(shape) };
}

// ---------------- the sheet key ----------------
function keyOf(prep) {
  const { win, R, rs, sing } = prep;
  return (z) => {
    const dx = Math.max(win.x0 - z.re, 0, z.re - win.x1), dy = Math.max(win.y0 - z.im, 0, z.im - win.y1);
    let D = Math.log2(1 + Math.hypot(dx, dy) / R);
    for (const p of sing) D += Math.max(0, Math.log2(rs / Math.hypot(z.re - p.re, z.im - p.im)));
    return D;
  };
}
const cmpLeaf = (a, b) => (a.D !== b.D ? a.D - b.D : (a.z.im !== b.z.im ? b.z.im - a.z.im : b.z.re - a.z.re));

// ---------------- walk ----------------
// opts: K (front count for the early stop), full (truth: no ranges, no budgets, no stop, window +-full around m*)
function walk(plan, prep, w, pix, opts = {}) {
  const ops = plan.ops, K = opts.K || 1, full = opts.full || 0;
  const key = keyOf(prep), L = prep.L;
  const found = [];                                                      // covering leaves, sorted
  let visited = 0, tailInf = false, truncated = false;
  const DK = () => (found.length >= K ? found[K - 1].D : Infinity);
  const leafOf = (u, J, lvl, lam) => {
    const z = u;
    if (!CX.isFin(z)) return { cov: false, D: Infinity, z };
    const D = key(z), cov = L(z) > 0 && lvl > 0;
    const lf = { z, D, cov, lvl, lam };
    if (cov) { found.push(lf); found.sort(cmpLeaf); }
    return lf;
  };
  const apply = (Lf, mem) => {
    const sc = Math.sqrt(Math.abs(Lf.J[0] * Lf.J[3] - Lf.J[1] * Lf.J[2]));
    const lv = mem.lvl === Infinity ? Infinity : mem.lvl / (sc * pix);
    if (lv < -1) return null;
    const D = mem.anti ? [1, 0, 0, -1] : [mem.d.re, -mem.d.im, mem.d.im, mem.d.re];
    const J = [D[0] * Lf.J[0] + D[1] * Lf.J[2], D[0] * Lf.J[1] + D[1] * Lf.J[3], D[2] * Lf.J[0] + D[3] * Lf.J[2], D[2] * Lf.J[1] + D[3] * Lf.J[3]];
    return { u: mem.u, J, lvl: Math.min(Lf.lvl, lv), lam: mem.lam || null };
  };
  // returns the leaf record of the LAST leaf produced below (for the stop op: exactly one)
  const rec = (j, Lf) => {
    if (j < 0) { visited++; return leafOf(Lf.u, Lf.J, Lf.lvl, Lf.lam); }
    const o = ops[j], F = prep.fam[j];
    if (!CX.isFin(Lf.u)) return null;
    if (!F || F.type === 'fin') {
      let last = null;
      for (const mem of o.pre(Lf.u, prep.refs[j])) { const n = apply(Lf, mem); if (n) last = rec(j - 1, n); }
      return last;
    }
    const w = Lf.u;
    if (F.type === 'log' && CX.isZero(w)) return null;
    const bases = F.type === 'add' ? addBases(o, w) : [{ bi: 0 }];
    for (const { bi } of bases) {
      const memAt = (m) => (F.type === 'add' ? addMember(o, w, bi, m) : rootMember(o, F, w, m));
      // centre m* nearest the reference
      let ms;
      const ref = prep.refs[j];
      if (F.type === 'add') {
        const m0 = memAt(0); if (!m0) continue;
        const t = CX.div(CX.sub(ref, m0.u), F.p); ms = Math.round(t.re);
        if (j === prep.stopOp && prep.stopMob && !opts.projCentre) {
          // Mobius prefix: the member whose z is nearest the reference in z: minimise |u_m - u_c| / |u_m - q| (exact)
          const uc = ref, q = prep.stopMob.uPole, p = F.p, A = CX.sub(m0.u, uc), Bq = CX.sub(m0.u, q);
          const a = p.re * p.re + p.im * p.im, b1 = 2 * (A.re * p.re + A.im * p.im), c1 = A.re * A.re + A.im * A.im;
          const b2 = 2 * (Bq.re * p.re + Bq.im * p.im), c2 = Bq.re * Bq.re + Bq.im * Bq.im;
          const qa = a * (b2 - b1), qb = 2 * a * (c2 - c1), qc = b1 * c2 - b2 * c1;
          const Rt = (x) => (a * x * x + b1 * x + c1) / (a * x * x + b2 * x + c2);
          const roots = [];
          if (Math.abs(qa) > 1e-300) { const D = qb * qb - 4 * qa * qc; if (D >= 0) { const sq = Math.sqrt(D); roots.push((-qb - sq) / (2 * qa), (-qb + sq) / (2 * qa)); } }
          else if (Math.abs(qb) > 1e-300) roots.push(-qc / qb);
          // candidates: u-projection, nearest-in-z to the reference, farthest from the accumulation point; centre at
          // the candidate with the smallest key D (the scan then walks outward with the exact LB stop)
          const cands = [ms, Math.round(-(Bq.re * p.re + Bq.im * p.im) / a)];
          for (const x of roots) cands.push(Math.floor(x), Math.ceil(x));
          const T = prep.stopMob.T, keyD = keyOf(prep);
          let best = ms, bD = Infinity;
          for (const mm of cands) {
            if (!Number.isFinite(mm)) continue;
            for (const m2 of [mm - 1, mm, mm + 1]) { const zz = CX.mobApply(T, CX.add(m0.u, CX.scale(p, m2))); if (!CX.isFin(zz)) continue; const D = keyD(zz); if (D < bD) { bD = D; best = m2; } }
          }
          ms = best;
        }
      }
      else {
        const bL = CX.mul(F.beta, CX.log(w));
        let lr = C(0, 0);
        if (CX.isFin(ref) && !CX.isZero(ref)) { lr = CX.log(ref); let im = lr.im; while (im <= F.lo) im += TAU; while (im > F.hi) im -= TAU; lr = C(lr.re, im); }
        const S2 = F.S.re * F.S.re + F.S.im * F.S.im, dd = CX.sub(lr, bL);
        ms = Math.round((dd.re * F.S.re + dd.im * F.S.im) / S2);
      }
      // range
      let lo = -Infinity, hi = Infinity, hlo = Infinity, hhi = -Infinity, N = full ? 2 * full + 1 : prep.N[j];
      if (full) { lo = ms - full; hi = ms + full; }
      else {
        if (F.type === 'log' && !F.inf) {
          const bL = CX.mul(F.beta, CX.log(w));
          const xa = (F.lo - bL.im) / F.S.im, xb = (F.hi - bL.im) / F.S.im;   // Im L_m = bL.im + m S.im
          lo = Math.ceil(Math.min(xa, xb)) - 1; hi = Math.floor(Math.max(xa, xb)) + 1;
        }
        const sp = prep.rspec[j];
        if (sp && sp.kind === 'clip') {
          if (F.type === 'add') {
            const m0 = memAt(0); if (!m0) continue;
            const z0 = CX.div(CX.sub(m0.u, sp.B), sp.A), q = CX.div(F.p, sp.A);
            const r = clipLine(prep.shape, z0, q);
            if (r) {
              if (r.lo > r.hi) continue;
              lo = Math.max(lo, Math.ceil(r.lo) - 1); hi = Math.min(hi, Math.floor(r.hi) + 1);
              if (r.hlo !== undefined) { hlo = Math.floor(r.hlo) + 2; hhi = Math.ceil(r.hhi) - 2; }
            }
          } else {
            const bL = CX.mul(F.beta, CX.log(w));
            const za = CX.neg(CX.div(sp.B, sp.A)), dz = CX.div(C(Math.cos(bL.im), Math.sin(bL.im)), sp.A);
            const r = clipLine(prep.shape, za, dz);
            if (r) {
              const tlo = Math.max(r.lo, 0), thi = r.hi;
              if (!(tlo < thi)) continue;
              const toM = (t) => (Math.log(t) - bL.re) / F.S.re;
              const a = tlo > 0 ? toM(tlo) : (F.S.re > 0 ? -Infinity : Infinity), b = Number.isFinite(thi) ? toM(thi) : (F.S.re > 0 ? Infinity : -Infinity);
              lo = Math.max(lo, Math.ceil(Math.min(a, b)) - 1); hi = Math.min(hi, Math.floor(Math.max(a, b)) + 1);
              if (r.hlo !== undefined && r.hhi > 0) {
                const ha = r.hlo > 0 ? toM(r.hlo) : (F.S.re > 0 ? -Infinity : Infinity), hb = toM(r.hhi);
                hlo = Math.floor(Math.min(ha, hb)) + 2; hhi = Math.ceil(Math.max(ha, hb)) - 2;
              }
            }
          }
        } else if (sp && sp.kind === 'box') {
          if (F.type === 'add') {
            const m0 = memAt(0); if (!m0) continue;
            const pa = CX.abs(F.p), t0 = (m0.u.re * F.p.re + m0.u.im * F.p.im) / pa;
            if (Number.isFinite(sp.lo)) lo = Math.max(lo, Math.ceil((sp.lo - t0) / pa) - 1);
            if (Number.isFinite(sp.hi)) hi = Math.min(hi, Math.floor((sp.hi - t0) / pa) + 1);
          } else {
            const bL = CX.mul(F.beta, CX.log(w));
            const a = (sp.lo - bL.re) / F.S.re, b = (sp.hi - bL.re) / F.S.re;
            if (Number.isFinite(a) || Number.isFinite(b)) {
              const mn = Math.min(a, b), mx = Math.max(a, b);
              if (Number.isFinite(mn)) lo = Math.max(lo, Math.ceil(mn) - 1);
              if (Number.isFinite(mx)) hi = Math.min(hi, Math.floor(mx) + 1);
            }
          }
        }
      }
      if (hlo <= hhi) {                                                 // a hole reaching infinity is a one-sided range
        if (hlo === -Infinity) { lo = Math.max(lo, hhi + 1); hlo = Infinity; hhi = -Infinity; }
        else if (hhi === Infinity) { hi = Math.min(hi, hlo - 1); hlo = Infinity; hhi = -Infinity; }
      }
      if (lo > hi) continue;
      if (!Number.isFinite(ms)) ms = 0;
      const inHole = (m) => m >= hlo && m <= hhi;
      ms = Math.min(hi, Math.max(lo, ms));
      if (inHole(ms)) ms = (ms - hlo <= hhi - ms) ? hlo - 1 : hhi + 1;
      let up = ms, dn = ms - 1;
      if (inHole(dn)) dn = hlo - 1;
      let aU = up >= lo && up <= hi, aD = dn >= lo && dn <= hi, n = 0, turn = 0;
      const lastCov = { U: [], D: [] };
      while (n < N && (aU || aD)) {
        const goUp = aU && aD ? (turn++ & 1) === 0 : aU;
        const m = goUp ? up : dn;
        if (goUp) { up++; if (inHole(up)) up = hhi + 1; if (up > hi) aU = false; } else { dn--; if (inHole(dn)) dn = hlo - 1; if (dn < lo) aD = false; }
        n++;
        const mem = memAt(m);
        if (!mem) continue;
        const nL = apply(Lf, mem);
        if (!nL) { (goUp ? lastCov.U : lastCov.D).push(false); continue; }
        const lf = rec(j - 1, nL);
        (goUp ? lastCov.U : lastCov.D).push(!!(lf && lf.cov));
        if (!full && j === prep.stopOp && lf) {
          let stop = false;
          if (!prep.stopMob) stop = lf.D > DK();
          else if (CX.isFin(lf.z)) {
            const sm = prep.stopMob, du = CX.sub(mem.u, sm.uPole), dir = goUp ? 1 : -1;
            const away = (du.re * F.p.re + du.im * F.p.im) * dir >= 0;
            if (away) {
              const r = CX.abs(CX.sub(lf.z, sm.pAcc)), p = sm.pAcc, win = prep.win;
              const dxp = Math.max(win.x0 - p.re, 0, p.re - win.x1), dyp = Math.max(win.y0 - p.im, 0, p.im - win.y1);
              const LB = Math.log2(1 + Math.max(0, Math.hypot(dxp, dyp) - r) / prep.R) + (sm.pInP ? Math.max(0, Math.log2(prep.rs / r)) : 0);
              stop = LB > DK();
            }
          }
          if (stop) { if (goUp) aU = false; else aD = false; }
        }
      }
      if (!full && (aU || aD)) {
        truncated = true;
        for (const [alive, arr] of [[aU, lastCov.U], [aD, lastCov.D]]) if (alive && arr.length >= 3 && arr.slice(-3).every(Boolean)) tailInf = true;
      }
    }
    return null;
  };
  rec(ops.length - 1, { u: w, J: [1, 0, 0, 1], lvl: Infinity, lam: null });
  return { found, visited, tailInf, truncated };
}

function planOf(stepList) {
  const steps = stepList.map((s) => ({ type: s.type, params: Object.assign(Funcs.defaults(s.type), s.params || {}), on: true }));
  const built = steps.map((s) => Funcs.build(s));
  const plan = INV.planChain(steps, built);
  if (!plan.ok) throw new Error(plan.reason);
  return { plan, F: (z) => plan.ops.reduce((u, o) => o.fwd(u), z), built };
}
module.exports = { prepare, walk, planOf, keyOf, cmpLeaf, clipLine, supportOf, rangeBox, LEAF_CAP };
