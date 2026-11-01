// @ts-check
'use strict';
// Exact images through infinity: the CPU preimage enumerator (notes/sphere-design/SPEC.md, section 3).
//
// A pixel w of a mapped view is drawn by listing the preimages z of w through the chain that can lie in the shape:
// the steps are walked backwards, and each step is decomposed into primitive ops (AFF, MOB, IPOW, ROOTPOW, EXP, ...)
// whose closed-form inverse enumerates every branch. Each member carries a signed "range level" (distance to the
// forward step's own branch range, in the op's output units), so members of the wrong branch are dropped and the
// ones within a pixel of a cut anti-alias. Families of infinitely many members (exp, the trig functions, z^s with
// Re(1/s) = 0) are scanned over the member range that the SHAPE allows (3.6), with a window only for unbounded ranges.
//
// This file is the CPU twin of the generated GLSL walker (glsl.js / gl.js, SPEC 4.1-4.2): the op table, member order,
// cursors, early stop and admission rules here are the reference the GPU is tested against. It also holds the
// float64 reference renderer used by the node tests (renderCPU).
//
// Pure JS: needs CX, InvOps and InvPatterns (globals) at load; Region only at run time (in node it is required on demand).
const Inverse = (() => {
  const { C } = CX;
  const { add, sub, mul, div, neg, conj, abs, exp, log, scale, isFin, isZero } = CX;
  const PI = Math.PI, TAU = 2 * PI, DEG = PI / 180, LN2 = Math.LN2;
  const ONE = C(1, 0), ZERO = C(0, 0);
  // budgets (SPEC 3.1)
  const LEAF_CAP = 64, WIN_MAX = 17, MIN_WIN = 9, OPS_MAX = 16, POLY_MAX = 64, M_MAX = 2 ** 20, RAMP = 1;
  const LAM_CUT = 60;          // |Re Λ| beyond which shapes are tested by the Λ rule (4.3)
  const Z_MAX = 1e30;          // a candidate with |z| beyond this and no Λ is outside
  const BIG = 1e9;             // px: "certainly inside / outside"
  const B_DEFAULT = 8;         // compositing buffer (4.2)
  const CLIP_PAD = 1.5;        // px: anti-aliasing margin of the shape clips of member lines and rays (a candidate within
                               // 1 px of the shape can still cover: facing rule, 4.2)
  const RG = () => Region;
  const cx = (re, im) => ({ re, im });

  // (issue #20) the primitive ops and the catalog decomposition live in src/invops.js, the analytic patterns in
  // src/invpatterns.js
  const {
    IPOW_MAX, opAff, opMob, opIpow, opRootPow, opExp, opLog, asinS, acosS, asinhS, atanS, atanhS, opSin, opCos,
    opTan, opSinh, opCosh, opTanh, tanhAnc, tanAnc, P1, PI_, opAsin, opAcos, opAtan, opAsinh, opAcosh, opAtanh,
    opJouk, opIjouk, opConj, opQuad, opRat2, stepOps, rationalForm
  } = InvOps;
  const { PATTERNS, sqAA, hexRGB, patternColor } = InvPatterns;

  // =====================================================================================================
  // 3. Plans (SPEC 3.4) and the program key (4.4)
  // =====================================================================================================
  const isLive = (st, b) => !!st && st.on !== false && !!b && !b.error && !!b.def;
  // Inverse.inverseKey(steps, built): structure of every step (op kinds, or 'X' when it has no enumerator); parameter
  // values are uniforms, so a parameter change keeps the key unless it flips a step's decomposition or eligibility.
  function inverseKey(steps, built) {
    const sigs = steps.map((st, k) => {
      const b = built[k];
      if (!st || st.on === false) return 'off';
      if (!b || b.error || !b.def) return 'err';
      const r = stepOps(b);
      return r.ok ? r.ops.map((o) => o.kind) : 'X';
    });
    return JSON.stringify(['inv2', sigs]);
  }
  // Inverse.planChain(steps, built, a, b) -> Plan for the stages (a, b]; off and failed steps are the identity
  function planChain(steps, built, a = 0, b = steps.length) {
    const key = inverseKey(steps, built);
    const ops = [];
    for (let k = a + 1; k <= b; k++) {
      const st = steps[k - 1], bb = built[k - 1];
      if (!isLive(st, bb)) continue;
      const r = stepOps(bb);
      if (!r.ok) return { ok: false, reason: `step ${k}: ${r.reason}`, ops: [], key, a, b, fams: [], injective: false };
      r.ops.forEach((o, i) => { o.step = k; o.node = i; ops.push(o); });
    }
    if (ops.length > OPS_MAX) return { ok: false, reason: 'chain too long', ops: [], key, a, b, fams: [], injective: false };
    ops.forEach((o, j) => { o.j = j; });
    const fams = [];
    ops.forEach((o, j) => { if (o.fam) fams.push(j); });
    return { ok: true, reason: null, ops, key, a, b, fams, injective: fams.length === 0 };
  }

  // =====================================================================================================
  // 4. Shapes: level and gradient in pixels (4.3), with the Λ rule
  // =====================================================================================================
  // analytic level and gradient [L, gx, gy] of the built-in kinds (values identical to Region.levelOf)
  function kindLevel(s) {
    // a gcircle disc (or its complement): the form in float64 relative to its anchor (SPEC 2.2); shapePx applies
    // the complement sign afterwards, so the level here is the shape's without it
    if (s._g && s._g.A !== 0 && s.kind === 'disc') {
      const G = s._g, ox = G.o[0], oy = G.o[1], A = G.A, bx = G.B[0], by = G.B[1], c0 = G.C, cs = s.complement ? -1 : 1;
      return (z) => { const ux = z.re - ox, uy = z.im - oy; return [-0.5 * cs * (A * (ux * ux + uy * uy) + 2 * (bx * ux + by * uy) + c0), -cs * (A * ux + bx), -cs * (A * uy + by)]; };
    }
    switch (s.kind) {
      case 'disc': { const cx0 = s.c[0], cy0 = s.c[1], r = s.r; return (z) => { const dx = z.re - cx0, dy = z.im - cy0, d = Math.hypot(dx, dy); return d > 0 ? [r - d, -dx / d, -dy / d] : [r, 0, 0]; }; }
      case 'rect': {
        const x0 = Math.min(s.a[0], s.b[0]), x1 = Math.max(s.a[0], s.b[0]), y0 = Math.min(s.a[1], s.b[1]), y1 = Math.max(s.a[1], s.b[1]);
        return (z) => {
          let L = z.re - x0, gx = 1, gy = 0;
          if (x1 - z.re < L) { L = x1 - z.re; gx = -1; gy = 0; }
          if (z.im - y0 < L) { L = z.im - y0; gx = 0; gy = 1; }
          if (y1 - z.im < L) { L = y1 - z.im; gx = 0; gy = -1; }
          return [L, gx, gy];
        };
      }
      case 'polygon': {
        const pts = s.pts.map((p) => C(p[0], p[1]));
        return (z) => {
          let inside = false, dmin = Infinity, qx = 0, qy = 0;
          for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const a = pts[i], b = pts[j];
            if ((a.im > z.im) !== (b.im > z.im) && z.re < (b.re - a.re) * (z.im - a.im) / (b.im - a.im) + a.re) inside = !inside;
            const dx = b.re - a.re, dy = b.im - a.im, LL = dx * dx + dy * dy;
            let t = LL > 0 ? ((z.re - a.re) * dx + (z.im - a.im) * dy) / LL : 0;
            t = Math.max(0, Math.min(1, t));
            const px = a.re + t * dx, py = a.im + t * dy, d = Math.hypot(z.re - px, z.im - py);
            if (d < dmin) { dmin = d; qx = px; qy = py; }
          }
          const sg_ = inside ? 1 : -1, d = dmin;
          return d > 0 ? [sg_ * d, sg_ * (z.re - qx) / d, sg_ * (z.im - qy) / d] : [0, 0, 0];
        };
      }
      case 'halfplane': {
        const a = C(s.a[0], s.a[1]), d = sub(C(s.b[0], s.b[1]), a), L = abs(d) || 1;
        return (z) => [(d.re * (z.im - a.im) - d.im * (z.re - a.re)) / L, -d.im / L, d.re / L];
      }
      case 'annulus': {
        const cx0 = s.c[0], cy0 = s.c[1], r1 = Math.min(s.r1, s.r2), r2 = Math.max(s.r1, s.r2);
        return (z) => {
          const dx = z.re - cx0, dy = z.im - cy0, d = Math.hypot(dx, dy), ux = d > 0 ? dx / d : 0, uy = d > 0 ? dy / d : 0;
          return d - r1 < r2 - d ? [d - r1, ux, uy] : [r2 - d, -ux, -uy];
        };
      }
      case 'sector': {
        const span = (((s.t2 - s.t1) % 360) + 360) % 360 || 360;
        const u1 = C(Math.cos(s.t1 * DEG), Math.sin(s.t1 * DEG)), u2 = C(Math.cos((s.t1 + span) * DEG), Math.sin((s.t1 + span) * DEG));
        const cx0 = s.c[0], cy0 = s.c[1], r = s.r;
        return (z) => {
          const vx = z.re - cx0, vy = z.im - cy0, d = Math.hypot(vx, vy), ux = d > 0 ? vx / d : 0, uy = d > 0 ? vy / d : 0;
          const a = u1.re * vy - u1.im * vx, b = -(u2.re * vy - u2.im * vx);
          let res;
          if (span >= 360) res = [d, ux, uy];
          else if (span <= 180) res = a < b ? [a, -u1.im, u1.re] : [b, u2.im, -u2.re];
          else res = a > b ? [a, -u1.im, u1.re] : [b, u2.im, -u2.re];
          if (r > 0 && r - d < res[0]) res = [r - d, -ux, -uy];
          return res;
        };
      }
    }
    return null;
  }
  // Inverse.shapePx(shape) -> (z, dX, dY, lam, dLX, dLY) -> {s, nx, ny}: signed distance to the region boundary in
  // image pixels (positive inside) and the unit image-space normal (gradient direction); dX, dY: dz per pixel step,
  // lam = log z when the walk produced it, dLX, dLY: d(lam) per pixel step. Applies the Λ rule for |Re lam| > 60.
  function shapePx(s) {
    const R_ = RG();
    const Lfull = R_.levelOf(s);                                        // includes the complement
    const kl = s.kind === 'formula' ? null : kindLevel(s);
    const cs = s.complement ? -1 : 1;
    const bounded = ['disc', 'rect', 'polygon', 'annulus'].includes(s.kind) || (s.kind === 'sector' && s.r > 0);
    const OUT = { s: -Infinity, nx: 0, ny: 0 };
    const sure = (inside) => ({ s: inside ? BIG : -BIG, nx: 0, ny: 0 });
    const at0 = () => { const v = Lfull(ZERO); return v > 0; };
    const fromGrad = (L, gx, gy) => {
      const g = Math.hypot(gx, gy);
      if (!(g > 0) || !Number.isFinite(g)) return { s: L > 0 ? Infinity : -Infinity, nx: 0, ny: 0 };
      return { s: L / g, nx: gx / g, ny: gy / g };
    };
    // central differences of the full level along the footprints (formulas)
    const centralPx = (z, dX, dY) => {
      const L0 = Lfull(z);
      if (!(L0 > -Infinity)) return OUT;
      const lx = (Lfull(add(z, dX)) - Lfull(sub(z, dX))) / 2, ly = (Lfull(add(z, dY)) - Lfull(sub(z, dY))) / 2;
      if (!Number.isFinite(lx) || !Number.isFinite(ly)) return { s: L0 > 0 ? Infinity : -Infinity, nx: 0, ny: 0 };
      return fromGrad(L0, lx, ly);
    };
    // direction tests in log space: level e^{Re Λ} cross(d, e^{iθ}) normalised; gradient (ℓ, dot(d, e^{iθ})) in (Re Λ, θ)
    const dirHalf = (d, th, dLX, dLY, sgn_) => {
      const e = C(Math.cos(th), Math.sin(th));
      const l = sgn_ * (d.re * e.im - d.im * e.re), dt = sgn_ * (d.re * e.re + d.im * e.im);
      return fromGrad(l, l * dLX.re + dt * dLX.im, l * dLY.re + dt * dLY.im);
    };
    let lamRule = null;
    if (s.kind === 'halfplane') {
      const a = C(s.a[0], s.a[1]), d0 = sub(C(s.b[0], s.b[1]), a), dl = abs(d0) || 1, d = C(d0.re / dl, d0.im / dl);
      const thru0 = Math.abs(d.re * a.im - d.im * a.re) <= 1e-12 * abs(a);
      lamRule = (big, th, dLX, dLY) => (big || thru0 ? dirHalf(d, th, dLX, dLY, cs) : sure(at0()));
    } else if (s.kind === 'sector' && !(s.r > 0)) {
      const span = (((s.t2 - s.t1) % 360) + 360) % 360 || 360;
      const u1 = C(Math.cos(s.t1 * DEG), Math.sin(s.t1 * DEG)), u2 = C(Math.cos((s.t1 + span) * DEG), Math.sin((s.t1 + span) * DEG));
      const apex0 = Math.hypot(s.c[0], s.c[1]) <= 1e-12;
      lamRule = (big, th, dLX, dLY) => {
        if (!(big || apex0)) return sure(at0());
        if (span >= 360) return sure(cs > 0);
        const A = dirHalf(u1, th, dLX, dLY, 1), Bv = dirHalf(neg(u2), th, dLX, dLY, 1);
        let r = span <= 180 ? (A.s < Bv.s ? A : Bv) : (A.s > Bv.s ? A : Bv);
        if (cs < 0) r = { s: -r.s, nx: -r.nx, ny: -r.ny };
        return r;
      };
    } else if (s.kind === 'formula') {
      lamRule = (big, th, dLX, dLY) => {
        const z = exp(C(big ? LAM_CUT : -LAM_CUT, th));
        return centralPx(z, mul(z, dLX), mul(z, dLY));
      };
    } else if (s._g && s._g.A !== 0 && s.kind === 'disc') {
      // a gcircle disc; through 0 by incidence [C9]: near 0 it is its tangent half-plane there
      const G = s._g, gx = G.B[0] - G.A * G.o[0], gy = G.B[1] - G.A * G.o[1], gl = Math.hypot(gx, gy) || 1, d = C(-gy / gl, gx / gl);
      lamRule = (big, th, dLX, dLY) => (big ? sure(G.A < 0) : G.thru0 ? dirHalf(d, th, dLX, dLY, 1) : sure(at0()));
    } else if (bounded) {
      lamRule = (big) => (big ? sure(cs < 0) : sure(at0()));
    }
    return (z, dX, dY, lam, dLX, dLY) => {
      if (lam && Math.abs(lam.re) > LAM_CUT && lamRule && dLX) return lamRule(lam.re > 0, lam.im, dLX, dLY);
      if (!isFin(z) || Math.abs(z.re) > Z_MAX || Math.abs(z.im) > Z_MAX) return OUT;
      if (!kl) return centralPx(z, dX, dY);
      const r = kl(z);
      let L = r[0];
      if (Number.isNaN(L)) return OUT;
      L *= cs;
      const gx = cs * r[1], gy = cs * r[2];
      return fromGrad(L, gx * dX.re + gy * dX.im, gx * dY.re + gy * dY.im);
    };
  }
  // ---- the shape at a saturation point p (an anchor, P2 review): a local model exact within radius m of p ----
  // {type: 1 (sure), m, flag (+1 inside, -1 outside)} | {type: 2 (cone of two boundary rays from p: the interior sweeps
  // counterclockwise from u1 to u2), u1, u2, convex (sweep <= 180 degrees: the intersection of the two half-planes,
  // else their union), sgn (-1: complement), m} | {type: 3 (a circle through p: level sign (r - |v|), v = v0 + delta,
  // v0 = p - c, evaluated as (K - 2 v0.delta - |delta|^2) / (r + |v|) with K = r^2 - |v0|^2 from float64), v0, r, K,
  // sign, sgn, m} | {type: 0} (no model: the plain evaluation) | null (a formula boundary through p: not eligible).
  // m: the distance from p to the boundary pieces the model leaves out. Polygonal pieces through p are straight, so a
  // cone is exact within m; circles use K.
  const ANC_TOL = 1e-12;
  function anchorModel(sh, p) {
    const R_ = RG(), sgnC = sh.complement ? -1 : 1;
    const Lfull = R_.levelOf(sh);
    const sure = (m) => ({ type: 1, m: Math.max(0, m) * 0.999, flag: Lfull(p) > 0 ? 1 : -1 });
    const unit = (v) => { const l = abs(v) || 1; return C(v.re / l, v.im / l); };
    const cone = (u1, u2, m) => ({ type: 2, u1: unit(u1), u2: unit(u2), convex: u1.re * u2.im - u1.im * u2.re >= -1e-15, sgn: sgnC, m: m * 0.999 });
    const segDist = (a, b, q) => { const dx = b.re - a.re, dy = b.im - a.im, LL = dx * dx + dy * dy; let t = LL > 0 ? ((q.re - a.re) * dx + (q.im - a.im) * dy) / LL : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(q.re - a.re - t * dx, q.im - a.im - t * dy); };
    const scl = 1 + abs(p);
    switch (sh.kind) {
      case 'halfplane': {
        const a = C(sh.a[0], sh.a[1]), d = unit(sub(C(sh.b[0], sh.b[1]), a));
        const o = d.re * (p.im - a.im) - d.im * (p.re - a.re);
        if (Math.abs(o) > ANC_TOL * (scl + abs(a))) return sure(Math.abs(o));
        return cone(d, neg(d), Infinity);
      }
      case 'disc': case 'annulus': {
        const c = C(sh.c[0], sh.c[1]), v0 = sub(p, c), dv = abs(v0);
        const radii = sh.kind === 'disc' ? [[sh.r, 1]] : [[Math.min(sh.r1, sh.r2), -1], [Math.max(sh.r1, sh.r2), 1]];
        for (const [r, sign] of radii) {
          if (Math.abs(dv - r) <= ANC_TOL * (scl + abs(c) + r)) {
            const other = radii.filter((x) => x[0] !== r).map((x) => Math.abs(x[0] - r));
            return { type: 3, v0, r, K: 0, sign, sgn: sgnC, m: other.length ? Math.min(...other) * 0.999 : Infinity };
          }
        }
        return sure(Math.min(...radii.map((x) => Math.abs(dv - x[0]))));
      }
      case 'rect': case 'polygon': {
        let pts;
        if (sh.kind === 'rect') { const x0 = Math.min(sh.a[0], sh.b[0]), x1 = Math.max(sh.a[0], sh.b[0]), y0 = Math.min(sh.a[1], sh.b[1]), y1 = Math.max(sh.a[1], sh.b[1]); pts = [C(x0, y0), C(x1, y0), C(x1, y1), C(x0, y1)]; }
        else pts = (sh.pts || []).map((q) => C(q[0], q[1]));
        const n = pts.length;
        if (n < 3) return { type: 0 };
        const ext = Math.max(...pts.map((q) => abs(sub(q, p)))) + scl;
        const tol = ANC_TOL * ext;
        const dE = pts.map((a, i) => segDist(a, pts[(i + 1) % n], p));
        const near = dE.map((d) => d <= tol);
        if (!near.some(Boolean)) return sure(Math.min(...dE));
        const vi = pts.findIndex((q) => abs(sub(q, p)) <= tol);
        // the cone's rays and the distance to every edge not incident to p
        const inside = (q) => Lfull(q) * sgnC > 0;              // the shape itself (without the complement)
        const probe = (dir, len) => add(p, scale(unit(dir), Math.max(1e-9 * ext, 1e-6 * len)));
        let u1, u2, inc;
        if (vi >= 0) {
          const a = sub(pts[(vi + 1) % n], pts[vi]), b = sub(pts[(vi + n - 1) % n], pts[vi]);
          inc = new Set([vi, (vi + n - 1) % n]);
          // the counterclockwise sweep from a to b, and its bisector: the interior is that sweep or the other one
          let ang = Math.atan2(b.im, b.re) - Math.atan2(a.im, a.re);
          while (ang <= 0) ang += 2 * PI;
          while (ang > 2 * PI) ang -= 2 * PI;
          const bis = C(Math.cos(Math.atan2(a.im, a.re) + ang / 2), Math.sin(Math.atan2(a.im, a.re) + ang / 2));
          const len = Math.min(abs(a), abs(b));
          if (inside(probe(bis, len))) { u1 = a; u2 = b; } else { u1 = b; u2 = a; }
          const m = Math.min(Infinity, ...dE.filter((_, i) => !inc.has(i)));
          const mod = cone(u1, u2, m);
          // the sweep from u1 to u2 counterclockwise: convex when it is at most 180 degrees
          let sw = Math.atan2(u2.im, u2.re) - Math.atan2(u1.im, u1.re);
          while (sw <= 0) sw += 2 * PI;
          mod.convex = sw <= PI + 1e-12;
          return mod;
        }
        const ei = near.indexOf(true);
        const e = sub(pts[(ei + 1) % n], pts[ei]), nl = C(-e.im, e.re);
        inc = new Set([ei]);
        const m = Math.min(Infinity, ...dE.filter((_, i) => !inc.has(i)), abs(sub(pts[ei], p)), abs(sub(pts[(ei + 1) % n], p)));
        return inside(probe(nl, abs(e))) ? cone(e, neg(e), m) : cone(neg(e), e, m);
      }
      case 'sector': {
        const c = C(sh.c[0], sh.c[1]), v = sub(p, c), dv = abs(v);
        const span = (((sh.t2 - sh.t1) % 360) + 360) % 360 || 360;
        const u1 = C(Math.cos(sh.t1 * DEG), Math.sin(sh.t1 * DEG)), u2 = C(Math.cos((sh.t1 + span) * DEG), Math.sin((sh.t1 + span) * DEG));
        const r = sh.r > 0 ? sh.r : Infinity, tol = ANC_TOL * (scl + abs(c) + (Number.isFinite(r) ? r : 0));
        const rayD = (u) => { const t = v.re * u.re + v.im * u.im; return t <= 0 ? dv : Number.isFinite(r) && t > r ? Math.hypot(v.re - r * u.re, v.im - r * u.im) : Math.abs(u.re * v.im - u.im * v.re); };
        const d1 = span >= 360 ? Infinity : rayD(u1), d2 = span >= 360 ? Infinity : rayD(u2);
        const angIn = (q) => { if (span >= 360) return true; let a = Math.atan2(q.im, q.re) - sh.t1 * DEG; a = ((a % (2 * PI)) + 2 * PI) % (2 * PI); return a <= span * DEG; };
        const dArc = Number.isFinite(r) ? (angIn(v) ? Math.abs(dv - r) : Infinity) : Infinity;
        if (dv <= tol) {                                        // the apex
          if (span >= 360) return sure(Number.isFinite(r) ? r : Infinity);
          const mod = cone(u1, u2, Number.isFinite(r) ? r : Infinity);
          mod.convex = span <= 180;
          return mod;
        }
        const on1 = d1 <= tol, on2 = d2 <= tol, onA = dArc <= tol;
        if ((on1 || on2) && onA) return { type: 0 };            // a corner of a ray and the arc: the plain evaluation
        if (on1) return cone(u1, neg(u1), Math.min(dv, d2, Number.isFinite(r) ? Math.abs(r - dv) : Infinity));
        if (on2) return cone(neg(u2), u2, Math.min(dv, d1, Number.isFinite(r) ? Math.abs(r - dv) : Infinity));
        if (onA) return { type: 3, v0: v, r, K: 0, sign: 1, sgn: sgnC, m: Math.min(d1, d2) * 0.999 };
        return sure(Math.min(d1, d2, dArc, Number.isFinite(r) && !angIn(v) ? Infinity : Infinity));
      }
      case 'formula': {
        const L0 = Lfull(p);
        if (!Number.isFinite(L0)) return null;
        const h = 1e-6 * scl;
        const gx = (Lfull(add(p, C(h, 0))) - Lfull(sub(p, C(h, 0)))) / (2 * h), gy = (Lfull(add(p, C(0, h))) - Lfull(sub(p, C(0, h)))) / (2 * h);
        const g = Math.hypot(gx, gy);
        const dist = g > 0 ? Math.abs(L0) / g : Infinity;
        if (!(dist > 1e-6 * scl)) return null;                 // its boundary passes (nearly) through p
        return { type: 1, m: 0.5 * dist, flag: L0 > 0 ? 1 : -1 };
      }
    }
    return { type: 0 };
  }
  // the signed distance (px) and normal of a leaf near an anchor with model M: delta (z units) and its log lz, the
  // footprints dX, dY of z and dLX, dLY of log delta per pixel (the GPU's ixAnchorPx)
  function dirHalfL(d, th, dLX, dLY, sg) {
    const e = C(Math.cos(th), Math.sin(th));
    const l = sg * (d.re * e.im - d.im * e.re), dt = sg * (d.re * e.re + d.im * e.im);
    const gx = l * dLX.re + dt * dLX.im, gy = l * dLY.re + dt * dLY.im, g = Math.hypot(gx, gy);
    if (!(g > 0) || !Number.isFinite(g)) return { s: l > 0 ? Infinity : -Infinity, nx: 0, ny: 0 };
    return { s: l / g, nx: gx / g, ny: gy / g };
  }
  function anchorPx(M, dz, lz, dX, dY, dLX, dLY) {
    if (M.type === 1) return { s: M.flag * BIG, nx: 0, ny: 0 };
    if (M.type === 2) {
      const A_ = dirHalfL(M.u1, lz.im, dLX, dLY, 1), B_ = dirHalfL(neg(M.u2), lz.im, dLX, dLY, 1);
      const r = M.convex ? (A_.s < B_.s ? A_ : B_) : (A_.s > B_.s ? A_ : B_);
      return M.sgn < 0 ? { s: -r.s, nx: -r.nx, ny: -r.ny } : r;
    }
    const sg = M.sign * M.sgn, v0 = M.v0, l0 = abs(v0);
    if (lz.re < -LAM_CUT) return dirHalfL(C(-v0.im / l0, v0.re / l0), lz.im, dLX, dLY, sg);   // the tangent at p
    const v = add(v0, dz), vv = abs(v);
    const Lc = (M.K - 2 * (v0.re * dz.re + v0.im * dz.im) - (dz.re * dz.re + dz.im * dz.im)) / (M.r + vv);
    const gx = -v.re / vv, gy = -v.im / vv;
    const ax = sg * (gx * dX.re + gy * dX.im), ay = sg * (gx * dY.re + gy * dY.im), g = Math.hypot(ax, ay);
    if (!(g > 0) || !Number.isFinite(g)) return { s: sg * Lc > 0 ? Infinity : -Infinity, nx: 0, ny: 0 };
    return { s: sg * Lc / g, nx: ax / g, ny: ay / g };
  }
  // the shape's bounds: Region.bboxOf, or the recognizer box of a formula when bounded; null when unbounded
  function boundsOf(s) {
    const R_ = RG();
    const b = R_.bboxOf(s);
    if (b) return b;
    if (s.kind === 'formula' && !s.complement) {
      const fb = R_.formulaBox(s);
      if (Number.isFinite(fb.x0) && Number.isFinite(fb.x1) && Number.isFinite(fb.y0) && Number.isFinite(fb.y1)) return { x0: fb.x0, x1: fb.x1, y0: fb.y0, y1: fb.y1 };
    }
    return null;
  }
  // a lower bound of the distance from p to the shape (0 when p is in its closure or nothing better is known)
  function distLB(s, p) {
    const R_ = RG();
    if (s.kind === 'formula') {
      const b = boundsOf(s);
      if (!b) return 0;
      return Math.hypot(Math.max(b.x0 - p.re, 0, p.re - b.x1), Math.max(b.y0 - p.im, 0, p.im - b.y1));
    }
    const L = R_.levelOf(s)(p);
    return L < 0 ? -L : 0;
  }

  // =====================================================================================================
  // 5. The sheet key D (section 5) and the tie rule (5.2)
  // =====================================================================================================
  function keyParts(win) {
    const R = Math.hypot(win.x1 - win.x0, win.y1 - win.y0) / 2;
    return { R, rs: R / 8 };
  }
  // Inverse.sheetKey(prep, z, lam) -> D = log2(1 + |z - c|/R) + sum over P of max(0, log2(rs/|z - p|)), c the centre
  // of W (#584: the point nearest the window's centre in front, continuous across W's edges, where the distance to W
  // tied every point inside it and the tie rule flipped sheets along its sides; |z - c| >= dist(z, W), so every lower
  // bound the walk takes from dist(z, W) stays one). P: the accumulation set and the poles pulled back (keySing)
  function sheetKey(prep, z, lam) {
    const { win, R, rs, sing } = prep;
    if (lam && lam.re > LAM_CUT) return (lam.re - Math.log(R)) / LN2;
    if (!isFin(z)) return Infinity;
    let D = Math.log2(1 + Math.hypot(z.re - (win.x0 + win.x1) / 2, z.im - (win.y0 + win.y1) / 2) / R);
    if (sing) for (const p of sing) {
      if (lam && lam.re < -LAM_CUT && p.re === 0 && p.im === 0) D += Math.max(0, Math.log2(rs) - lam.re / LN2);
      else D += Math.max(0, Math.log2(rs / Math.hypot(z.re - p.re, z.im - p.im)));
    }
    return D;
  }
  // tie point of a candidate (its z, or a far point in its direction when z overflowed)
  const tieZ = (a) => (isFin(a.z) ? a.z : (a.lam ? C(Math.cos(a.lam.im) * 1e300, Math.sin(a.lam.im) * 1e300) : C(0, 0)));
  // Inverse.front(a, b): candidate a is in front of b (smaller D; ties: larger Im z, then larger Re z). Keys within
  // TIE_D octave are ties (#584, PRE_KEY's blend): a map symmetric about the window's centre (z^2 about 0) gives its points equal keys,
  // which rounding (float32, and a forward mesh's placement of its points, 1e-3 of |z|) would order pixel by pixel
  const TIE_D = 2 ** -8;
  const dTie = (a, b) => a === b || !(Math.abs(a - b) > TIE_D);
  function front(a, b) {
    if (!dTie(a.D, b.D)) return a.D < b.D;
    const za = tieZ(a), zb = tieZ(b);
    if (za.im !== zb.im) return za.im > zb.im;
    return za.re > zb.re;
  }
  function frontRev(a, b) {                                            // the tie rule reversed (sensitivity tests only)
    if (!dTie(a.D, b.D)) return a.D < b.D;
    const za = tieZ(a), zb = tieZ(b);
    if (za.im !== zb.im) return za.im < zb.im;
    return za.re < zb.re;
  }

  // =====================================================================================================
  // 6. Singular points and pull-backs (SPEC 3.7)
  // =====================================================================================================
  const expandBox = (b, f) => {
    const cx0 = (b.x0 + b.x1) / 2, cy0 = (b.y0 + b.y1) / 2, hw = (b.x1 - b.x0) / 2 * f, hh = (b.y1 - b.y0) / 2 * f;
    return { x0: cx0 - hw, x1: cx0 + hw, y0: cy0 - hh, y1: cy0 + hh };
  };
  const boxDist = (b, z) => Math.hypot(Math.max(b.x0 - z.re, 0, z.re - b.x1), Math.max(b.y0 - z.im, 0, z.im - b.y1));
  function refsOf(plan, win, ref) {
    let c = ref || C((win.x0 + win.x1) / 2, (win.y0 + win.y1) / 2);
    const run = (c0) => { const r = []; let z = c0; for (const o of plan.ops) { r.push(z); z = o.fwd(z); } return { refs: r, out: z }; };
    let f = run(c);
    if (!(f.refs.every(isFin) && isFin(f.out))) {
      const W4 = (win.x1 - win.x0) / 4;
      c = C(c.re + W4 * Math.cos(0.3), c.im + W4 * Math.sin(0.3));
      f = run(c);
    }
    return { cRef: c, refs: f.refs, out: f.out };
  }
  // the image box of the z-box zb in the input plane of op i (exact for affine prefixes, sampled otherwise), or null
  function boxThrough(ops, i, zb) {
    if (i === 0) return zb;
    const affine = ops.slice(0, i).every((o) => o.kind === 'AFF');
    const n = affine ? 1 : 12;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let a = 0; a <= n; a++) for (let b = 0; b <= n; b++) {
      let u = C(zb.x0 + (zb.x1 - zb.x0) * a / n, zb.y0 + (zb.y1 - zb.y0) * b / n);
      for (let k = 0; k < i; k++) u = ops[k].fwd(u);
      if (!isFin(u) || Math.abs(u.re) > 1e8 || Math.abs(u.im) > 1e8) return null;
      x0 = Math.min(x0, u.re); x1 = Math.max(x1, u.re); y0 = Math.min(y0, u.im); y1 = Math.max(y1, u.im);
    }
    if (affine) return { x0, x1, y0, y1 };
    const px = 0.25 * (x1 - x0) + 1e-9, py = 0.25 * (y1 - y0) + 1e-9;
    return { x0: x0 - px, x1: x1 + px, y0: y0 - py, y1: y1 + py };
  }
  // Member and lattice indices are counted with integers that must stay exact and must change when incremented: an
  // index beyond IDX_SAFE (where float64 positions base + n step no longer resolve neighbouring points anyway) makes
  // the lattice / family unusable here, and every index loop below is bounded by an iteration count, never by a float
  // comparison (n++ is a no-op above 2^53).
  const IDX_SAFE = 2 ** 50;
  const idxOk = (n) => Number.isFinite(n) && Math.abs(n) <= IDX_SAFE;
  // the integers of [n0, n1] nearest nc, at most 2 cap + 1 of them, in increasing order ([] when unusable)
  function indexRange(n0, n1, nc, cap) {
    if (!(n0 <= n1) || !idxOk(nc)) return [];
    if (!(n1 - n0 + 1 <= 2 * cap + 1)) { n0 = Math.max(n0, nc - cap); n1 = Math.min(n1, nc + cap); }
    if (!(n0 <= n1) || !idxOk(n0) || !idxOk(n1)) return [];
    const out = [];
    for (let k = 0; k <= n1 - n0 && k <= 2 * cap; k++) out.push(n0 + k);
    return out;
  }
  // lattice points base + n step inside the box ub (at most 2 cap + 1, nearest its centre), or those nearest ref
  function latticeIn(lat, ub, ref, cap) {
    const { base, step } = lat;
    let n0, n1, nc;
    if (ub) {
      const r = RG().shapeClip({ in: [{ t: 'box', x0: ub.x0, x1: ub.x1, y0: ub.y0, y1: ub.y1 }], hole: null }, base, step);
      if (!(r.lo <= r.hi)) return [];
      n0 = Math.ceil(r.lo); n1 = Math.floor(r.hi);
      const cz = C((ub.x0 + ub.x1) / 2, (ub.y0 + ub.y1) / 2);
      nc = Math.round(div(sub(cz, base), step).re);
    } else {
      nc = ref && isFin(ref) ? Math.round(div(sub(ref, base), step).re) : 0;
      n0 = nc - cap; n1 = nc + cap;
    }
    return indexRange(n0, n1, nc, cap).map((n) => add(base, scale(step, n)));
  }
  // preimages of a finite point p of op o's output plane (members nearest ref for infinite families, at most
  // 2 cap + 1 per base); null = infinity
  function pullFinite(o, p, ref, cap = 16) {
    const F = o.fam, out = [];
    if (o.kind === 'ROOTPOW' && isZero(p)) { const sr = o.p.s.re; return sr > 0 ? [ZERO] : sr < 0 ? [null] : []; }
    if (F && F.type === 'add') {
      F.bases(p).forEach((base, bi) => {
        if (!base || !isFin(base)) return;
        const ms = ref && isFin(ref) ? Math.round(div(sub(ref, base), F.p).re) : 0;
        for (const m of indexRange(ms - 1, ms + 1, ms, 1)) out.push(F.member(p, bi, m, base).u);
      });
      return out;
    }
    if (F && F.type === 'log') {
      const l0 = F.L0(p);
      if (!isFin(l0)) return out;
      let m0, m1, ms;
      if (!F.inf) {
        const xa = (F.lo - l0.im) / F.S.im, xb = (F.hi - l0.im) / F.S.im;
        m0 = Math.ceil(Math.min(xa, xb)) - 1; m1 = Math.floor(Math.max(xa, xb)) + 1;
        ms = Math.min(m1, Math.max(m0, logCentre(F, ref, l0)));
      } else {
        ms = logCentre(F, ref, l0);
        m0 = ms - 1; m1 = ms + 1;
      }
      for (const m of indexRange(m0, m1, ms, cap)) { const mem = F.member(p, m, l0); if (mem.lvl >= 0 && isFin(mem.u)) out.push(mem.u); }
      return out;
    }
    const hole = (u) => !!o.holes && o.holes.some((h) => abs(sub(u, h)) <= 1e-7 * (1 + abs(h)));
    for (const mem of o.pre(p)) if (!(mem.lvl < 0) && isFin(mem.u) && !hole(mem.u)) out.push(mem.u);
    if (o.infAt && o.infAt(p)) out.push(null);
    return out;
  }
  // the list without near-duplicates (within 1e-9 (1 + |z|)), first occurrences kept, in list order; null (infinity)
  // once. A sweep over the points sorted by Re z, so long lists (deep tan chains) cost n log n, not n^2.
  function dedupe(list) {
    const pts = [];
    let inf = false;
    for (const z of list) {
      if (z === null) inf = true;
      else if (isFin(z)) pts.push(z);
    }
    const n = pts.length, drop = new Uint8Array(n);
    const order = pts.map((_, i) => i).sort((a, b) => pts[a].re - pts[b].re || a - b);
    for (let s = 0; s < n; s++) {
      const i = order[s], z = pts[i], win = 2e-9 * (1 + abs(z));
      for (let t = s + 1; t < n && pts[order[t]].re - z.re <= win; t++) {
        const k = order[t], q = pts[k];
        if (Math.hypot(q.re - z.re, q.im - z.im) <= 1e-9 * (1 + Math.min(abs(z), abs(q)))) drop[Math.max(i, k)] = 1;
      }
    }
    const out = [];
    let k = 0, infDone = !inf;
    for (const z of list) {                                              // list order (pts holds the finite ones in order)
      if (z === null) { if (!infDone) { infDone = true; out.push(null); } continue; }
      if (!isFin(z)) continue;
      if (!drop[k]) out.push(z);
      k++;
    }
    return out;
  }
  // points of op j's input plane pulled back to the z-plane through ops j-1 .. 0; bt: a cache of boxThrough(ops, i, zb)
  // per op index, shared by the pull-backs of one singular() / prepare() call
  function pullBack(ops, refs, j, pts, zb, cap, bt = new Map()) {
    let cur = dedupe(pts);
    const lim = 4 * cap + 8;
    for (let i = j - 1; i >= 0 && cur.length; i--) {
      const o = ops[i], next = [];
      let ub;
      for (const p of cur) {
        if (p === null) {
          if (o.infPre) next.push(null);
          for (const q of o.poles) next.push(q);
          if (o.lattice) { if (ub === undefined) { if (!bt.has(i)) bt.set(i, boxThrough(ops, i, zb)); ub = bt.get(i); } next.push(...latticeIn(o.lattice, ub, refs[i], cap)); }
        } else next.push(...pullFinite(o, p, refs[i], cap));
      }
      cur = dedupe(next);
      if (cur.length > lim) {
        const r = refs[i] && isFin(refs[i]) ? refs[i] : ZERO;
        cur.sort((a, b) => (a === null ? 1 : b === null ? -1 : abs(sub(a, r)) - abs(sub(b, r))));
        cur = cur.slice(0, lim);
      }
    }
    return cur;
  }
  // Inverse.pointPre(plan, p, cap) -> {exact: true, zs, total} | {exact: false, reason}: every z with F(z) = p, by the
  // ops' exact branches composed (no search), for a plan whose ops each have finitely many (AFF, MOB, IPOW, QUAD, RAT2,
  // integer roots, recognized rational formulas; [#291] a parameter point's preimages). total: the product of the
  // branch counts, more than cap is not exact (the caller searches); zs leaves out the branches through infinity and
  // the removable holes. A critical value's coincident roots come once, with their multiplicity in mult (z² + z at
  // −1/4: −1/2 ×2; z⁸ at 0: 0 ×8); the mults sum to total less the branches left out
  function pointPre(plan, p, cap = LEAF_CAP) {
    if (!plan || !plan.ok) return { exact: false, reason: plan ? plan.reason : 'no plan' };
    let total = 1;
    for (const o of plan.ops) {
      if (typeof o.pre !== 'function' || o.lattice || (o.fam && o.fam.type !== 'fin')) return { exact: false, reason: 'a step with infinitely many branches' };
      total *= o.fam ? o.fam.count : 1;
      if (total > cap) return { exact: false, reason: `more than ${cap} preimages` };
    }
    let cur = isFin(p) ? [{ z: p, m: 1 }] : [];
    for (let i = plan.ops.length - 1; i >= 0 && cur.length; i--) {
      const o = plan.ops[i], next = [];
      const hole = (u) => !!o.holes && o.holes.some((h) => abs(sub(u, h)) <= 1e-7 * (1 + abs(h)));
      for (const { z: w, m } of cur) {
        // (a member listed once for several branches says so: IPOW at 0 is 0 ×n, RAT2's double root 0 is ×2)
        for (const mem of o.pre(w)) {
          if (mem.lvl < 0 || !isFin(mem.u) || hole(mem.u)) continue;
          const each = m * (mem.mult || 1);
          // (roots that meet at a critical value, QUAD, RAT2, JOUK's two branches there, merge into one; a double root
          // is only good to about √ε of its value after a step before it, so the merge is within 1e-7, as the holes)
          const q = next.find((r) => abs(sub(r.z, mem.u)) <= 1e-7 * (1 + abs(mem.u)));
          if (q) q.m += each; else next.push({ z: mem.u, m: each });
        }
      }
      cur = next;
    }
    return { exact: true, zs: cur.map((r) => r.z), mult: cur.map((r) => r.m), total };
  }
  // Inverse.singular(plan, win, kinds, cap) -> [{z, kind: 'undef' | 'branch' | 'pole'}]: the chain's singular points
  // pulled back to the z-plane, finite only, at most cap per kind, nearest win first. Lattices (tan, tanh poles) are
  // enumerated only inside expandBox(win, 3).
  // Inverse.keySing(plan, win) -> the sheet key's points P (at most 4): the accumulation set, then the poles pulled
  // back (#584: a point beside a pole, which takes far-away values, is not in front for being near the centre alone)
  function keySing(plan, win) {
    let acc = [], poles = [];
    try { acc = accumulation(plan, win); } catch (e) { acc = []; }
    try { poles = singular(plan, win, ['pole'], 4).map((e) => e.z); } catch (e) { poles = []; }
    return acc.concat(poles.filter((p) => !acc.some((q) => abs(sub(p, q)) < 1e-9 * (1 + abs(p))))).slice(0, 4);
  }
  function singular(plan, win, kinds = ['undef', 'branch', 'pole'], cap = 16) {
    if (!plan || !plan.ok || !plan.ops.length) return [];
    const ops = plan.ops, { refs } = refsOf(plan, win), zb = expandBox(win, 3);
    const cz = C((win.x0 + win.x1) / 2, (win.y0 + win.y1) / 2);
    const out = [], bt = new Map();
    for (const kind of kinds) {
      let pts = [];
      for (let i = 0; i < ops.length; i++) {
        const o = ops[i];
        let src;
        if (kind === 'undef') src = o.undef;
        else if (kind === 'branch') src = o.branch;
        else { src = o.poles.slice(); if (o.lattice) { if (!bt.has(i)) bt.set(i, boxThrough(ops, i, zb)); src.push(...latticeIn(o.lattice, bt.get(i), refs[i], cap)); } }
        if (!src.length) continue;
        for (const z of pullBack(ops, refs, i, src, zb, cap, bt)) if (z && isFin(z)) pts.push(z);
      }
      pts = dedupe(pts);
      pts.sort((a, b) => (boxDist(win, a) - boxDist(win, b)) || (abs(sub(a, cz)) - abs(sub(b, cz))));
      for (const z of pts.slice(0, cap)) out.push({ z, kind });
    }
    return out;
  }
  // [issue #276] Inverse.singularAfter(plan, win, sing, cap): the singular points of a chain whose last step has no plan
  // (ζ takes each value infinitely often) but names all of its own, finitely many, sing(ub, ref, cap) -> [{z, kind}] in
  // its input plane (ub: the box of expandBox(win, 3) there, null when unbounded; ref: the image of win's centre). plan
  // is that of the steps before it (ok; it may have no ops) and injective, so the points pulled back are finitely many
  // too and the set is complete along a line's whole reach, as the lines' jump scan would find it. Its points and the
  // step's, pulled back to the z-plane, as singular() gives them; null otherwise (the lines then scan)
  function singularAfter(plan, win, sing, cap = 16) {
    if (!plan || !plan.ok || !plan.injective) return null;
    const ops = plan.ops, zb = expandBox(win, 3), bt = new Map();
    const cz = C((win.x0 + win.x1) / 2, (win.y0 + win.y1) / 2);
    const { refs, out: ref } = ops.length ? refsOf(plan, win) : { refs: [], out: cz };
    const out = ops.length ? singular(plan, win, ['undef', 'branch', 'pole'], cap) : [];
    const own = sing(boxThrough(ops, ops.length, zb), ref, cap);
    if (!own) return null;
    const by = new Map();
    for (const e of own) { if (!by.has(e.kind)) by.set(e.kind, []); by.get(e.kind).push(e.z); }
    for (const [kind, src] of by) {
      const pts = (ops.length ? pullBack(ops, refs, ops.length, src, zb, cap, bt) : dedupe(src)).filter((z) => z && isFin(z));
      pts.sort((a, b) => (boxDist(win, a) - boxDist(win, b)) || (abs(sub(a, cz)) - abs(sub(b, cz))));
      for (const z of pts.slice(0, cap)) out.push({ z, kind });
    }
    return out;
  }
  // the accumulation set P (3.7): the finite pulled-back undef points, at most 4, nearest win first
  const accumulation = (plan, win) => singular(plan, win, ['undef'], 4).map((e) => e.z);

  // =====================================================================================================
  // 7. Range boxes of non-affine prefixes (SPEC 3.8)
  // =====================================================================================================
  // image of a generalised disc (disc, halfplane, complement of a disc, sector <= 180 deg via its bounding half-plane)
  // under u = M(z) with the pole p = -d/c outside its closure: a bounded disc {c, r}; null when not applicable
  function mobDiscImage(M, s) {
    const [a, b, c, d] = M;
    if (isZero(c)) return null;
    const p = neg(div(d, c)), kap = neg(div(sub(mul(a, d), mul(b, c)), mul(c, c))), A0 = div(a, c);
    const circ = (c0, r) => {                                           // |z - c0| = r under 1/(z - p)
      const q = sub(c0, p), den = q.re * q.re + q.im * q.im - r * r;
      if (!(Math.abs(den) > 0)) return null;
      return { c: scale(conj(q), 1 / den), r: r / Math.abs(den) };
    };
    const line = (a0, dir) => {                                         // the line a0 + t dir under 1/(z - p)
      const del = sub(a0, p), dd = dir.re * dir.re + dir.im * dir.im;
      const z0 = sub(del, scale(dir, (del.re * dir.re + del.im * dir.im) / dd));
      if (!(abs(z0) > 0)) return null;
      return { c: CX.inv(scale(z0, 2)), r: 1 / (2 * abs(z0)) };
    };
    let img = null;
    if (s.kind === 'disc') img = circ(C(s.c[0], s.c[1]), s.r);
    else if (s.kind === 'halfplane' && !s.complement) {
      // the pole must lie strictly outside (checked by the caller with the full level); the line image bounds it
      img = line(C(s.a[0], s.a[1]), sub(C(s.b[0], s.b[1]), C(s.a[0], s.a[1])));
    } else if (s.kind === 'sector' && !s.complement && !(s.r > 0)) {
      const span = (((s.t2 - s.t1) % 360) + 360) % 360 || 360;
      if (span > 180) return null;
      const hp = { kind: 'halfplane', a: s.c, b: [s.c[0] + Math.cos(s.t1 * DEG), s.c[1] + Math.sin(s.t1 * DEG)] };
      if (RG().levelOf(hp)(p) > -1e-9) return null;                     // the pole in the bounding half-plane
      img = line(C(s.c[0], s.c[1]), C(Math.cos(s.t1 * DEG), Math.sin(s.t1 * DEG)));
    } else return null;
    if (!img) return null;
    const cen = add(A0, mul(kap, img.c)), rad = abs(kap) * img.r;
    if (!isFin(cen) || !Number.isFinite(rad)) return null;
    return { c: cen, r: rad };
  }
  // ---- rigorous disc enclosures of the forward ops (review P1, findings 4 and 5) ----
  // opDisc(o, c, rho) -> {e, r, fe}: a disc D(e, r) that contains o.fwd(u) for every u with |u - c| <= rho (r =
  // Infinity: no finite enclosure, e.g. a pole or branch point in the disc); fe = o.fwd(c). For a holomorphic op the
  // radius bounds |f(u) - f(c)| in closed form (factorisations such as sin u - sin c = 2 cos((u+c)/2) sin((u-c)/2) with
  // |sin w| <= sinh|w|, |cos(x+iy)| <= cosh y, or the mean-value bound with sup|f'| over the disc), so no sample can
  // alias. Ops with a branch cut (LOG, ROOTPOW, the principal inverse trig functions, IJOUK) add, when the disc meets
  // the cut, the disc of the values on its other side (LOG: -+ 2 pi i; ROOTPOW: times e^{-+2 pi i s}; real-symmetric
  // functions: the conjugate, by f(conj u) = conj f(u), over the disc of radius 3 rho), and return the hull of both.
  const HULL = (e1, r1, e2, r2) => {
    const d = abs(sub(e2, e1));
    if (!(Number.isFinite(d) && Number.isFinite(r1) && Number.isFinite(r2))) return { e: e1, r: Infinity };
    if (d + r2 <= r1) return { e: e1, r: r1 };
    if (d + r1 <= r2) return { e: e2, r: r2 };
    const R = (d + r1 + r2) / 2, t = (R - r1) / d;
    return { e: C(e1.re + (e2.re - e1.re) * t, e1.im + (e2.im - e1.im) * t), r: R };
  };
  // min over [a, b] of cos^2 x (0 when a zero pi/2 + k pi lies in it) and of sinh^2 y
  const minCos2 = (a, b) => (b - a >= PI || Math.ceil((a - PI / 2) / PI) * PI + PI / 2 <= b ? 0 : Math.min(Math.cos(a) ** 2, Math.cos(b) ** 2));
  const minSinh2 = (a, b) => (a <= 0 && b >= 0 ? 0 : Math.sinh(Math.min(Math.abs(a), Math.abs(b))) ** 2);
  // the principal inverse trig ops and IJOUK: branch points, cut (real or imaginary axis set), |f'| over a disc
  const RANGE_OPS = {
    ASIN: { bp: P1, axis: 're', cut: (t) => Math.abs(t) >= 1, pw: 0.5 }, ACOS: { bp: P1, axis: 're', cut: (t) => Math.abs(t) >= 1, pw: 0.5 },
    ATANH: { bp: P1, axis: 're', cut: (t) => Math.abs(t) >= 1, pw: 1 }, ACOSH: { bp: P1, axis: 're', cut: (t) => t <= 1, pw: 0.5 },
    ATAN: { bp: PI_, axis: 'im', cut: (t) => Math.abs(t) >= 1, pw: 1 }, ASINH: { bp: PI_, axis: 'im', cut: (t) => Math.abs(t) >= 1, pw: 0.5 },
    IJOUK: { bp: P1, axis: 're', cut: (t) => Math.abs(t) <= 1, pw: 0.5, jouk: true },
  };
  // does [a, b] meet the cut set (a union of intervals with end points among -1, 1)?
  const meetsCut = (cut, a, b) => cut(a) || cut(b) || (a < -1 && b > -1) || (a < 1 && b > 1);
  function opDisc(o, c, rho) {
    const fe = o.fwd(c);
    if (!isFin(fe)) return { e: fe, r: Infinity, fe };
    if (!(rho > 0)) return { e: fe, r: 0, fe };
    const ac = abs(c);
    let r = Infinity, alt = null;                                        // alt: {e, r}, the other side of a cut
    switch (o.kind) {
      case 'AFF': r = abs(o.p.a) * rho; break;
      case 'CONJ': r = rho; break;
      case 'MOB': {
        const [a, b, cc, d] = o.p.m;
        if (isZero(cc)) { r = abs(div(a, d)) * rho; break; }
        // M(u) = a/c + kap/(u - q): |M(u) - M(c)| = |kap| |u - c| / (|u - q| |c - q|)
        const q = neg(div(d, cc)), dq = abs(sub(c, q)), kap = abs(div(sub(mul(a, d), mul(b, cc)), mul(cc, cc)));
        if (dq > rho) r = kap * rho / ((dq - rho) * dq);
        break;
      }
      case 'IPOW': {
        const n = o.p.n, k = Math.abs(n);
        if (n > 0) r = ac > 0 ? Math.pow(ac, n) * Math.expm1(n * Math.log1p(rho / ac)) : Math.pow(rho, n);
        else if (ac > rho) r = Math.expm1(k * Math.log1p(rho / ac)) / Math.pow(ac - rho, k);  // |c^k - u^k| / (|u|^k |c|^k)
        break;
      }
      case 'EXP': r = abs(fe) * Math.expm1(rho); break;
      case 'EXPC': r = abs(fe) * Math.expm1(rho * abs(o.p.L0)); break;
      case 'SIN': case 'COS': r = 2 * Math.cosh(Math.abs(c.im) + rho / 2) * Math.sinh(rho / 2); break;
      case 'SINH': case 'COSH': r = 2 * Math.cosh(Math.abs(c.re) + rho / 2) * Math.sinh(rho / 2); break;
      case 'TAN': case 'TANH': {
        // tan u - tan c = sin(u - c) / (cos u cos c); |cos(x+iy)|^2 = cos^2 x + sinh^2 y (tanh: the rotated twin)
        const t = o.kind === 'TAN';
        const x = t ? c.re : c.im, y = t ? c.im : c.re;
        const m2 = minCos2(x - rho, x + rho) + minSinh2(y - rho, y + rho);
        const cc = abs(t ? CX.cos(c) : CX.cosh(c));
        if (m2 > 0) r = Math.sinh(rho) / (Math.sqrt(m2) * cc) + 1e-15 * (1 + abs(fe));   // + CX's clamp at |Im| > 20
        break;
      }
      case 'LOG': case 'ROOTPOW': {
        const isLog = o.kind === 'LOG';
        if (!(ac > rho)) {
          // the branch point 0 in the disc: bounded only for u^s with Re s > 0 (|u^s| <= |u|^{Re s} e^{-Im s Im L})
          if (!isLog && o.p.s.re > 0) {
            const s = o.p.s, bound = Math.pow(ac + rho, s.re) * Math.exp(Math.max(-s.im * o.p.lo, -s.im * o.p.hi));
            r = abs(fe) + bound;
          }
          break;
        }
        // the continuation g(u) = f(c) + log(u / c) (LOG) or f(c) (u / c)^s (ROOTPOW); |log(u / c)| <= lam
        const lam = -Math.log1p(-rho / ac), s = isLog ? null : o.p.s;
        r = isLog ? lam : abs(fe) * Math.expm1(abs(s) * lam);
        const Lc = CX.log(c, o.p.theta, o.p.k), dl = Math.asin(Math.min(1, rho / ac)) + 1e-12;
        const sgn_ = Lc.im + dl > o.p.hi ? -1 : Lc.im - dl <= o.p.lo ? 1 : 0;   // past the cut: L -+ 2 pi i
        if (sgn_) {
          if (isLog) alt = { e: C(fe.re, fe.im + sgn_ * TAU), r };
          else { const f2 = CX.exp(mul(s, C(0, sgn_ * TAU))); alt = { e: mul(fe, f2), r: r * abs(f2) }; }
        }
        break;
      }
      case 'JOUK': if (ac > rho) r = rho * (1 + 1 / ((ac - rho) * ac)) / 2; break;   // (u - c)(1 - 1/(u c)) / 2
      case 'QUAD': { const { a, b } = o.p; r = rho * (abs(add(scale(mul(a, c), 2), b)) + abs(a) * rho); break; }
      case 'RAT2': {
        // f(u) - f(c) = N(u) / (q(u) q(c)), N(u) = p(u) q(c) - p(c) q(u) = (u - c)(N'(c) + N2 (u - c))
        const [p2, p1, p0] = o.p.P, [q2, q1, q0] = o.p.Q;
        const pc = add(mul(add(mul(p2, c), p1), c), p0), qc = add(mul(add(mul(q2, c), q1), c), q0);
        const dp = add(scale(mul(p2, c), 2), p1), dq = add(scale(mul(q2, c), 2), q1);
        const N1 = abs(sub(mul(dp, qc), mul(pc, dq))), N2 = abs(sub(mul(p2, qc), mul(pc, q2)));
        const aq = abs(qc), ql = aq - abs(dq) * rho - abs(q2) * rho * rho;
        if (ql > 0) r = rho * (N1 + N2 * rho) / (ql * aq);
        break;
      }
      default: {
        const g = RANGE_OPS[o.kind];
        if (!g) break;
        const msup = (R) => {                                            // sup |f'| over D(c, R)
          const d1 = abs(sub(c, g.bp[0])) - R, d2 = abs(sub(c, g.bp[1])) - R;
          if (!(d1 > 0 && d2 > 0)) return Infinity;
          const base = Math.pow(d1 * d2, -g.pw);
          return g.jouk ? 1 + (ac + R) * base : base;
        };
        r = rho * msup(rho);
        const along = g.axis === 're' ? c.re : c.im, across = g.axis === 're' ? c.im : c.re;
        if (Math.abs(across) <= rho && meetsCut(g.cut, along - rho, along + rho)) {
          // values across the cut: f(u') = s(f(s(u'))) with s = conj (real cuts) or -conj (imaginary cuts), and s(u')
          // on c's side within 3 rho of c
          const e2 = g.axis === 're' ? conj(fe) : C(-fe.re, fe.im);
          alt = { e: e2, r: 3 * rho * msup(3 * rho) };
        }
      }
    }
    if (!Number.isFinite(r)) return { e: fe, r: Infinity, fe };
    let out = { e: fe, r };
    if (alt) out = HULL(fe, r, alt.e, alt.r);
    // rounding: a relative pad
    return { e: out.e, r: out.r * (1 + 1e-12) + 1e-15 * abs(out.e), fe };
  }
  // the enclosure of G(D(z, rho)) through the ops, and G(z) itself: {e, r, x}
  function chainDisc(ops, z, rho) {
    let e = z, r = rho, x = z;
    for (const o of ops) {
      const d = opDisc(o, e, r);
      x = e === x ? d.fe : o.fwd(x);
      e = d.e; r = d.r;
      if (!(r < Infinity) || !isFin(e)) return { e, r: Infinity, x };
    }
    return { e, r, x };
  }
  const IMAGEBOX_CAP = 4096;                                            // evaluations of the chain per shape (3.8)
  // Inverse.imageBox(G, shape, coord, unit, {poles, mob, cap, maxWidth}) -> {lo, hi, farCover, evals}: a conservative
  // float64 range of coord(G(z)) over the shape. G: the prefix as an op list (or a function carrying .ops); coord:
  // u -> real, with coord.kind 'add' (coord.e: <u, e>) or 'log' (ln|u|).
  //  - a pulled-back prefix pole in the shape's INTERIOR: unbounded, farCover (G(S) contains a neighbourhood of
  //    infinity, so far members cover on both sides). A pole on the boundary is not enough: G(S) then holds only part of
  //    a neighbourhood of infinity, far members cover on one side only, and a window centred on the other side misses
  //    (measured: 2^{M(z)} of H with the pole of M on the real axis); such shapes take the rules below.
  //  - a pole on the boundary (in the closure, not the interior): unbounded, farCover false
  //  - unbounded shapes: the exact Möbius image of a generalised disc (opts.mob: u = M(z)); otherwise unbounded
  //  - bounded shapes (rev 2 replaced; review P1, findings 4 and 5): branch and bound over a quadtree of the shape's
  //    bounds (8 x 8 cells to start). Each cell is enclosed by chainDisc (a disc that provably contains the image of the
  //    cell's circumscribed disc), giving an interval of coord; a cell is skipped when it lies outside the shape
  //    (level < -radius), and split only while its interval reaches beyond the extremes attained so far (values at cell
  //    centres inside the shape) by more than unit/4. The result is the hull of the final cell intervals and the
  //    attained extremes, so it is never narrower than the true range (no sampling, so no aliasing with periodic
  //    prefixes). A zero of the prefix gives ln|u| = -infinity in its cells, a pole an infinite radius: unbounded,
  //    farCover false. At most opts.cap (4,096) chain evaluations; when they run out, the unrefined cells' intervals
  //    are kept (still conservative). Once the attained extremes alone are wider than opts.maxWidth, the result is
  //    {lo, hi: the attained extremes, tooWide: true} at once (prepare: the shape cannot fit its budget).
  function imageBox(G, shape, coord, unit, opts = {}) {
    const R_ = RG();
    const L = R_.levelOf(shape);
    const UNB = { lo: -Infinity, hi: Infinity, farCover: false };
    let onBoundary = false;
    for (const p of opts.poles || []) {
      if (!p || !isFin(p)) continue;
      const lp = L(p), tol_ = 1e-9 * (1 + abs(p));
      if (lp > tol_) return { lo: -Infinity, hi: Infinity, farCover: true, evals: 0 };
      if (lp >= -tol_) onBoundary = true;
    }
    // a prefix pole on the boundary: G is unbounded on the shape, without a full neighbourhood of infinity
    if (onBoundary) return Object.assign(UNB, { evals: 0 });
    const bb = boundsOf(shape);
    if (!bb) {
      if (!opts.mob) return UNB;
      const img = mobDiscImage(opts.mob, shape);
      if (!img) return UNB;
      if (coord.kind === 'add') {
        const c = img.c.re * coord.e.re + img.c.im * coord.e.im, pad = 1e-9 * (Math.abs(c) + img.r);
        return { lo: c - img.r - pad, hi: c + img.r + pad, farCover: false, exact: true };
      }
      if (coord.kind === 'log') {
        const m = abs(img.c);
        if (!(m > img.r)) return UNB;
        return { lo: Math.log(m - img.r) - 1e-9, hi: Math.log(m + img.r) + 1e-9, farCover: false, exact: true };
      }
      return UNB;
    }
    const ops = Array.isArray(G) ? G : G && G.ops;
    if (!ops) throw new Error('Inverse.imageBox: G must be the prefix op list (or carry it as G.ops)');
    const isLog = coord.kind === 'log', e = coord.e;
    const ivl = (d) => {                                                 // coord interval of the disc D(d.e, d.r)
      if (!(d.r < Infinity)) return [-Infinity, Infinity];
      if (!isLog) { const v = d.e.re * e.re + d.e.im * e.im; return [v - d.r, v + d.r]; }
      const m = abs(d.e);
      return [m > d.r ? Math.log(m - d.r) : -Infinity, Math.log(m + d.r)];
    };
    const formula = shape.kind === 'formula';
    const cap = opts.cap || IMAGEBOX_CAP, maxW = opts.maxWidth ?? Infinity, tol = unit / 4, MAXD = 48;
    let evals = 0, amin = Infinity, amax = -Infinity, lo = Infinity, hi = -Infinity, any = false;
    const cell = (x0, y0, x1, y1, depth) => {
      evals++;
      const zc = C((x0 + x1) / 2, (y0 + y1) / 2), rho = Math.hypot(x1 - x0, y1 - y0) / 2 * (1 + 1e-12);
      const lv = L(zc);
      if (!formula && lv < -rho) return null;                            // the whole cell is outside the shape
      const d = chainDisc(ops, zc, rho);
      if (lv > 0 && isFin(d.x)) {
        const v = isLog ? (isZero(d.x) ? -Infinity : Math.log(abs(d.x))) : d.x.re * e.re + d.x.im * e.im;
        if (Number.isFinite(v)) { if (v < amin) amin = v; if (v > amax) amax = v; }
      }
      const [a, b] = ivl(d);
      any = true;
      return { x0, y0, x1, y1, depth, a, b, small: rho <= 1e-13 * (1 + abs(zc)) };
    };
    // a max-heap on the excess of a cell over the attained extremes
    const heap = [], key = (c) => Math.max(c.b - amax, amin - c.a);
    const push = (c) => { c.k = key(c); heap.push(c); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (!(heap[p].k < heap[i].k)) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l].k > heap[m].k) m = l; if (r < heap.length && heap[r].k > heap[m].k) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; }
      }
      return top;
    };
    // about 64 starting cells of aspect ratio <= 2 (a cell is enclosed by its circumscribed disc, so long thin cells
    // would enclose far more than they hold); at most 64 along either side
    const bw = bb.x1 - bb.x0, bh = bb.y1 - bb.y0, side = Math.sqrt(Math.max(bw * bh, 1e-300) / 64) || 1;
    const nx = Math.min(64, Math.max(1, Math.round(bw / side))), ny = Math.min(64, Math.max(1, Math.round(bh / side)));
    const dx = bw / nx, dy = bh / ny;
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      const c = cell(bb.x0 + i * dx, bb.y0 + j * dy, bb.x0 + (i + 1) * dx, bb.y0 + (j + 1) * dy, 0);
      if (c) push(c);
    }
    const tooWide = () => amax - amin > maxW;
    while (heap.length) {
      if (tooWide()) return { lo: amin, hi: amax, farCover: false, tooWide: true, evals };
      const c = pop();
      const excess = Math.max(c.b - (amax + tol), (amin - tol) - c.a);
      if (!(excess > 0) || c.depth >= MAXD || c.small || evals + 4 > cap) { if (c.a < lo) lo = c.a; if (c.b > hi) hi = c.b; continue; }
      // split the longer side only when the cell is more than twice as long as wide, else into four
      const xm = (c.x0 + c.x1) / 2, ym = (c.y0 + c.y1) / 2, dd = c.depth + 1, w_ = c.x1 - c.x0, h_ = c.y1 - c.y0;
      const kids = w_ > 2 * h_ ? [cell(c.x0, c.y0, xm, c.y1, dd), cell(xm, c.y0, c.x1, c.y1, dd)]
        : h_ > 2 * w_ ? [cell(c.x0, c.y0, c.x1, ym, dd), cell(c.x0, ym, c.x1, c.y1, dd)]
          : [cell(c.x0, c.y0, xm, ym, dd), cell(xm, c.y0, c.x1, ym, dd), cell(c.x0, ym, xm, c.y1, dd), cell(xm, ym, c.x1, c.y1, dd)];
      for (const k of kids) if (k) push(k);
    }
    if (tooWide()) return { lo: amin, hi: amax, farCover: false, tooWide: true, evals };
    if (!any) return { lo: 0, hi: -1, farCover: false, empty: true, evals };
    lo = Math.min(lo, amin); hi = Math.max(hi, amax);
    if (!(Number.isFinite(lo) && Number.isFinite(hi))) return Object.assign(UNB, { evals });
    return { lo, hi, farCover: false, evals };
  }

  // =====================================================================================================
  // 8. prepare (SPEC 3.4 budgets, 3.6 references, ranges, stop data)
  // =====================================================================================================
  const mobOf = (o) => (o.kind === 'AFF' ? [o.p.a, o.p.b, ZERO, ONE] : o.p.m);
  // an affine op: AFF, or a MOB with c = 0 ((a u + b) / d: a Mobius step such as 2z + 1 is affine, and its families'
  // ranges are exact line clips, not range boxes: exp(2z + 1) of a half-plane is inverse-eligible, P2 review)
  const affOf = (o) => (o.kind === 'AFF' ? o.p : o.kind === 'MOB' && isZero(o.p.m[2]) && !isZero(o.p.m[3]) ? { a: div(o.p.m[0], o.p.m[3]), b: div(o.p.m[1], o.p.m[3]) } : null);
  const isAff = (o) => !!affOf(o);
  const mobMul = (A, B) => [add(mul(A[0], B[0]), mul(A[1], B[2])), add(mul(A[0], B[1]), mul(A[1], B[3])), add(mul(A[2], B[0]), mul(A[3], B[2])), add(mul(A[2], B[1]), mul(A[3], B[3]))];
  const mobInv = (M) => [M[3], neg(M[1]), neg(M[2]), M[0]];
  const isWindowFam = (F) => !!F && (F.type === 'add' || (F.type === 'log' && F.inf));
  // the member nearest the reference of a log family (3.2): round(Re((λ_ref - L0) conj S)/|S|^2)
  function logCentre(F, ref, l0) {
    let lr = ZERO;
    if (ref && isFin(ref) && !isZero(ref)) {
      lr = log(ref);
      // Arg ref shifted into (lo, hi] in closed form (a loop of 2 pi steps would run k times for sheet k, forever when
      // lo is beyond 2^53)
      let im = lr.im + TAU * (Math.floor((F.lo - lr.im) / TAU) + 1);
      if (im > F.hi) im -= TAU;
      if (im <= F.lo) im += TAU;
      if (Number.isFinite(im)) lr = C(lr.re, im);
    }
    const S2 = F.S.re * F.S.re + F.S.im * F.S.im, dd = sub(lr, l0);
    const ms = Math.round((dd.re * F.S.re + dd.im * F.S.im) / S2);
    return Number.isFinite(ms) ? ms : 0;
  }
  // Inverse.prepare(plan, {win, shape, sing, ref}) -> Prep. Always fills refs, key data and the shape evaluator, so a
  // Prep with ok = false can still be used by enumerate's truth mode (opts.full) in tests.
  function prepare(plan, o = {}) {
    const R_ = RG();
    const win = o.win, shape = o.shape;
    const { R, rs } = keyParts(win);
    const prep = { ok: false, reason: null, refs: [], rspec: [], need: [], N: [], inner: -1, stopOp: -1, stopMob: null, win, R, rs, sing: [], convex: false,
      shape, prim: null, fam: [], cRef: null, ev: null };
    if (!plan || !plan.ok) { prep.reason = plan ? plan.reason : 'no plan'; return prep; }
    const ops = plan.ops, N = ops.length;
    const rf = refsOf(plan, win, o.ref);
    prep.refs = rf.refs; prep.cRef = rf.cRef;
    prep.sing = o.sing ? o.sing.slice(0, 4) : keySing(plan, win);
    prep.fam = ops.map((x) => x.fam);
    if (!shape) { prep.reason = 'no shape'; return prep; }
    prep.ev = shapePx(shape);
    prep.prim = R_.clipPrimitive(shape);
    prep.convex = R_.convexOf(shape);
    const fail = (reason) => { prep.ok = false; prep.reason = reason; return prep; };
    if (shape.kind === 'polygon' && (shape.pts || []).length > POLY_MAX) return fail(`polygon with more than ${POLY_MAX} vertices`);
    if (shape.kind === 'formula' && ops.some((x) => isWindowFam(x.fam))) {
      const fb = R_.formulaBox(shape);
      const bounded = Number.isFinite(fb.x0) && Number.isFinite(fb.x1) && Number.isFinite(fb.y0) && Number.isFinite(fb.y1);
      if (!bounded && !fb.convex) return fail('unrecognised formula under a window family');
    }
    // saturation anchors (P2 review): an ATANH / ATAN op behind affine ops only (z = (u - B) / A): its members carry
    // their offset from +-1 (+-i), and each anchor p = (pu - B) / A gets the shape's local model there
    prep.anc = null;
    {
      let jA = 0;
      while (jA < N && isAff(ops[jA])) jA++;
      const oA = ops[jA];
      if (oA && (oA.kind === 'ATANH' || oA.kind === 'ATAN') && oA.anchors) {
        let A = ONE, B = ZERO;
        for (const x of ops.slice(0, jA)) { const f = affOf(x); A = mul(f.a, A); B = add(mul(f.a, B), f.b); }
        const models = oA.anchors.map((pu) => { const pz = div(sub(pu, B), A); const M = anchorModel(shape, pz); return M ? Object.assign({ pz }, M) : null; });
        if (models.some((M) => M === null)) return fail('a saturation point of the map lies on a formula boundary');
        prep.anc = { op: jA, kind: oA.kind, A, B, logA: log(A), models };
      }
    }
    const fam = prep.fam, rspec = prep.rspec, need = prep.need, idx = [];
    let inner = -1;
    for (let j = 0; j < N; j++) {
      const F = fam[j];
      idx.push(0);
      if (!F) { rspec.push(null); need.push(1); continue; }
      if (F.type === 'fin') { rspec.push(null); need.push(F.count); continue; }
      if (F.type === 'log' && !F.inf) {
        rspec.push({ kind: 'branch' }); need.push(F.count);
        if (F.radial && inner < 0) inner = j;
        continue;
      }
      if (inner < 0) inner = j;
      const pre = ops.slice(0, j);
      if (pre.every(isAff)) {
        let A = ONE, B = ZERO;
        for (const x of pre) { const f = affOf(x); A = mul(f.a, A); B = add(mul(f.a, B), f.b); }
        if (F.type === 'add') {
          const q = div(F.p, A), qa = abs(q), e = C(q.re / qa, q.im / qa);
          const [slo, shi] = R_.supportOf(shape, e);
          const nd = Number.isFinite(shi - slo) ? (shi >= slo ? Math.ceil((shi - slo) / qa) + 3 : 3) : Infinity;
          rspec.push({ kind: 'clip', A, B }); need.push(nd);
          const pa = abs(F.p), pB = Math.abs(B.re * F.p.re + B.im * F.p.im) / pa;
          idx[j] = Number.isFinite(nd) ? (Math.max(Math.abs(slo), Math.abs(shi)) + (pB + 2 * pa) / abs(A)) / qa + 3 : NaN;
        } else {
          const za = neg(div(B, A)), bb = boundsOf(shape);
          let nd = Infinity;
          const L = R_.levelOf(shape);
          if (bb && !(L(za) > -1e-12)) {
            const rmin = Math.max(1e-300, distLB(shape, za) * 0.999);
            const rmax = Math.max(...[[bb.x0, bb.y0], [bb.x0, bb.y1], [bb.x1, bb.y0], [bb.x1, bb.y1]].map(([x, y]) => Math.hypot(x - za.re, y - za.im)));
            if (rmin > 0 && rmax >= rmin) nd = Math.ceil(Math.log(rmax / rmin) / Math.abs(F.S.re)) + 3;
          }
          rspec.push({ kind: 'clip', A, B }); need.push(nd);
          idx[j] = NaN;
        }
      } else {
        let coord, unit;
        if (F.type === 'add') {
          const pa = abs(F.p), e = C(F.p.re / pa, F.p.im / pa);
          coord = (u) => (isFin(u) ? u.re * e.re + u.im * e.im : NaN); coord.kind = 'add'; coord.e = e; unit = pa;
        } else {
          coord = (u) => (isFin(u) && !isZero(u) ? Math.log(abs(u)) : NaN); coord.kind = 'log'; unit = Math.abs(F.S.re);
        }
        // prefix poles pulled back to z near the shape (or near the window when the shape is unbounded)
        const sb = boundsOf(shape);
        const zb = sb ? expandBox({ x0: sb.x0, x1: sb.x1, y0: sb.y0, y1: sb.y1 }, 1.25) : expandBox(win, 3);
        const poles = pullBack(ops, prep.refs, j, [null], zb, 16).filter((z) => z && isFin(z));
        let mob = null;
        if (pre.every((x) => x.kind === 'AFF' || x.kind === 'MOB')) { mob = [ONE, ZERO, ZERO, ONE]; for (const x of pre) mob = mobMul(mobOf(x), mob); }
        // maxWidth: a range wider than LEAF_CAP - 3 members can never fit the budget (need = width / unit + 3 <= 64), so
        // imageBox may stop as soon as its attained values are that far apart (the need below is then a lower bound)
        const bx = imageBox(pre, shape, coord, unit, { poles, mob, maxWidth: (LEAF_CAP - 3) * unit });
        rspec.push(Object.assign({ kind: 'box', e: F.type === 'add' ? coord.e : null }, bx));
        need.push(bx.empty ? 3 : Number.isFinite(bx.hi - bx.lo) ? Math.ceil((bx.hi - bx.lo) / unit) + 3 : Infinity);
        idx[j] = F.type === 'add' && Number.isFinite(bx.hi - bx.lo) ? (Math.max(Math.abs(bx.lo), Math.abs(bx.hi)) + 2 * unit) / unit + 3 : NaN;
      }
    }
    prep.inner = inner;
    // budgets
    const Nb = need.slice();
    let Pf = 1, reason = null;
    for (let j = 0; j < N; j++) {
      if (!fam[j] || j === inner) continue;
      if (!Number.isFinite(need[j])) { reason = 'unbounded range outside the innermost family'; break; }
      Pf *= need[j];
    }
    if (!reason && Pf > LEAF_CAP) {
      const tooMany = ops.some((x, j) => j !== inner && x.fam && x.fam.type === 'log' && !x.fam.inf && need[j] > LEAF_CAP);
      // a range box that stopped early (tooWide) gives only a lower bound of its member count
      const lower = rspec.some((sp, j) => j !== inner && sp && sp.tooWide);
      reason = tooMany ? 'too many branches' : lower ? `fixed families need more than ${LEAF_CAP} leaves` : `fixed families need ${Pf} leaves`;
    }
    if (!reason && inner >= 0) {
      const allow = Math.floor(LEAF_CAP / Pf);
      if (need[inner] <= allow) Nb[inner] = need[inner];
      else {
        Nb[inner] = Math.min(allow, WIN_MAX);
        const sp = rspec[inner];
        if (Nb[inner] < MIN_WIN) reason = 'innermost family budget';
        else if (Number.isFinite(need[inner]) && !(sp && sp.kind === 'clip' && prep.convex) && !(sp && sp.kind === 'branch')) reason = 'bounded range too long for a non-convex shape';
        else if (sp && sp.kind === 'box' && !Number.isFinite(need[inner]) && !sp.farCover) reason = 'unbounded shape through a non-affine prefix';
      }
    }
    prep.N = Nb;
    // member indices must stay exact in float32 positions on the GPU (7)
    if (!reason) {
      for (let j = 0; j < N; j++) {
        const F = fam[j];
        if (!isWindowFam(F) && !(F && F.type === 'log')) continue;
        let bound = idx[j];
        if (!Number.isFinite(bound)) {
          const ref = prep.refs[j], wr = j + 1 < N ? prep.refs[j + 1] : rf.out;
          let ms = 0;
          if (F.type === 'add') ms = isFin(ref) ? Math.abs(abs(ref) / abs(F.p)) + 2 : 0;
          else if (wr && isFin(wr) && !isZero(wr)) ms = Math.abs(logCentre(F, ref, F.L0(wr)));
          bound = ms + Nb[j];
        }
        if (bound > M_MAX) { reason = 'precision'; break; }
      }
    }
    // the early stop (3.6): the innermost window family with only AFF/MOB before it (log families: AFF only)
    if (!reason && inner >= 0 && isWindowFam(fam[inner])) {
      const pre = ops.slice(0, inner);
      const okA = pre.every(isAff), okM = pre.every((x) => x.kind === 'AFF' || x.kind === 'MOB');
      if (okA) prep.stopOp = inner;
      else if (okM && fam[inner].type === 'add') {
        let M = [ONE, ZERO, ZERO, ONE];
        for (const x of pre) M = mobMul(mobOf(x), M);                   // u = M(z)
        const T = mobInv(M);                                             // z = T(u)
        if (!isZero(T[2])) {
          const pAcc = div(T[0], T[2]);
          prep.stopOp = inner;
          prep.stopMob = { T, uPole: neg(div(T[3], T[2])), pAcc, pInP: prep.sing.some((p) => abs(sub(p, pAcc)) < 1e-9 * (1 + abs(p))) };
        }
      }
    }
    // the tail rule (gl.js ixDKTail; enumerate below): along every member line of the stop op the shape's coverage never
    // decreases toward an unbounded end, so a side whose last three members covered keeps covering. Holds for an
    // intersection of half-planes (a half-plane, a sector with r = 0, their complements whose clip is exact: the
    // level is the minimum of linear functions, each non-decreasing on an unbounded side of the clip) seen through
    //  - an additive family behind affine ops, every other op affine or Mobius (no range levels): members on a line,
    //    one footprint for all of them;
    //  - an infinitely-sheeted power family at op 0 (members on a ray from 0, footprint and range level proportional
    //    and constant along it), every boundary line through 0: the coverage is the same for every member.
    prep.tail = false;
    if (!reason && inner >= 0 && prep.stopOp === inner && !prep.stopMob && !prep.anc && rspec[inner] && rspec[inner].kind === 'clip') {
      const pr = prep.prim, F = fam[inner];
      const halves = !!(pr && pr.exact && !pr.hole && pr.in && pr.in.length && pr.in.every((pc) => pc.t === 'half'))
        && (shape.kind === 'halfplane' || (shape.kind === 'sector' && !(shape.r > 0)));
      const others = ops.every((x, j) => j === inner || x.kind === 'AFF' || x.kind === 'MOB');
      if (halves && others) {
        if (F.type === 'add') prep.tail = true;
        else if (F.type === 'log' && F.inf && inner === 0) {
          prep.tail = pr.in.every((pc) => { const dl = Math.hypot(pc.d[0], pc.d[1]); return dl > 0 && Math.abs(pc.d[0] * pc.a[1] - pc.d[1] * pc.a[0]) / dl <= 1e-12 * Math.max(1, Math.hypot(pc.a[0], pc.a[1])); });
        }
      }
    }
    prep.ok = !reason; prep.reason = reason;
    return prep;
  }

  // =====================================================================================================
  // 9. enumerate: the CPU twin of the GPU walk (SPEC 3.5, 3.6, 4.1) with the compositor's admission rules (4.2)
  // =====================================================================================================
  // Inverse.enumerate(plan, prep, w, pix, opts) -> {leaves, visited, truncated, tailInf, entries, nCov, U}
  //  pix: w units per image pixel; opts: K (front count for the early stop and admission; capped at B unless all), B
  //  (buffer size), all (the shape's own alpha: when K > B the early stop is off and every covering candidate counts,
  //  those the buffer does not keep through their transmittance restT, SPEC 13.12),
  //  full (truth mode: a window of +-full members around m* in every family, no ranges, budgets or stop),
  //  ramp (range ramp in px, default 1), dwdX / dwdY (dw per image pixel step, default (pix, 0) / (0, pix)),
  //  leaves: false to skip the leaf list, paths: true to record each leaf's path ('j:b:m' per window or finite op,
  //  outermost first), tieReverse (tests only).
  //  leaves: every visited leaf in walk order: {z, J (dz/dw, real 2x2 row-major), JL (dΛ/dw) | null, lvl (px),
  //  lg: [x, y] | null, lam, dX, dY (dz per pixel step), s (region distance, px), cv (coverage), cov, D}.
  //  entries: the admitted compositing buffer, front to back ({lf, D, z, cv, ...}); restT: the product of
  //  (1 - alpha cv / U) over the covering candidates the buffer did not keep (opts.alpha, default 1).
  function enumerate(plan, prep, w, pix, opts = {}) {
    const ops = plan.ops;
    const B = opts.B || B_DEFAULT, Kt = Math.max(1, opts.K || 1), K = Math.min(Kt, B), full = opts.full || 0, keep = opts.leaves !== false;
    const noStop = !!opts.all && Kt > B, alphaR = opts.alpha ?? 1;
    const ramp = opts.ramp ?? RAMP;
    const dwX = opts.dwdX || C(pix, 0), dwY = opts.dwdY || C(0, pix);
    const frontFn = opts.tieReverse ? frontRev : front, paths = !!opts.paths;
    const ev = prep.ev || (prep.ev = shapePx(prep.shape));
    const leaves = [], ent = [], loops = [];
    let visited = 0, nCov = 0, U = 0, truncated = false, tailInf = false, restT = 1;
    const admitLimit = Math.min(B, K + 2);
    const DK = () => (noStop ? Infinity : ent.length >= K ? ent[K - 1].D : Infinity);
    const rest = (cv) => { restT *= 1 - alphaR * Math.min(1, cv / Math.max(U, 1e-6)); };
    const twin = (a, b) => a.cv < 1 && b.cv < 1 && a.lvl < 1e30 && b.lvl < 1e30 && a.lg && b.lg && (a.lg[0] * b.lg[0] + a.lg[1] * b.lg[1]) < -0.5
      && isFin(a.z) && isFin(b.z) && Math.hypot(a.z.re - b.z.re, a.z.im - b.z.im) <= a.fp;
    const admit = (e) => {
      let pos = ent.length;
      for (let i = 0; i < ent.length; i++) if (frontFn(e, ent[i])) { pos = i; break; }
      for (const k of [pos - 1, pos]) {
        const t = ent[k];
        if (t && twin(e, t)) { t.cv = Math.min(1, t.cv + e.cv); if (t.cv > U) U = t.cv; t.merged = (t.merged || 0) + 1; return; }
      }
      if (pos >= admitLimit) { rest(e.cv); return; }
      ent.splice(pos, 0, e);
      if (ent.length > B) rest(ent.pop().cv);
    };
    const leaf = (Lf) => {
      visited++;
      const z = Lf.u, J = Lf.J, lam = Lf.lam;
      let dX = cx(J[0] * dwX.re + J[1] * dwX.im, J[2] * dwX.re + J[3] * dwX.im), dY = cx(J[0] * dwY.re + J[1] * dwY.im, J[2] * dwY.re + J[3] * dwY.im);
      let dLX = null, dLY = null;
      if (lam && Lf.JL) { const T = Lf.JL; dLX = cx(T[0] * dwX.re + T[1] * dwX.im, T[2] * dwX.re + T[3] * dwX.im); dLY = cx(T[0] * dwY.re + T[1] * dwY.im, T[2] * dwY.re + T[3] * dwY.im); }
      // a critical value exactly at the pixel centre (dz/dw infinite or NaN): the region's sign at z decides (zero
      // footprints), the pattern shows its moire average (huge footprints); the GPU's invLeaf does the same
      // (or a footprint past any meaning, 1e12 (1 + |z|): float64 rounds an exact hit to a huge finite dz/dw, cos(pi/2) =
      // 6e-17, where float32 gets an exact 0)
      const crit = !(isFin(dX) && isFin(dY)) || (isFin(z) && Math.hypot(dX.re, dX.im) + Math.hypot(dY.re, dY.im) > 1e12 * (1 + abs(z)));
      if (crit) { dX = C(0, 0); dY = C(0, 0); }
      // near a saturation anchor: its local model with the stable offset (z = p + delta), within its radius
      let an = null, sh;
      if (anc && Lf.anc && !crit) {
        const M = anc.models[Lf.anc.a];
        const dz = div(Lf.anc.d, anc.A), lz = sub(Lf.anc.l, anc.logA);
        an = { p: M.pz, d: dz, l: lz, dLX: mul(Lf.anc.dl, dwX), dLY: mul(Lf.anc.dl, dwY) };
        if (M.type && Math.exp(lz.re) < M.m) sh = anchorPx(M, dz, lz, dX, dY, an.dLX, an.dLY);
      }
      if (!sh) sh = ev(z, dX, dY, lam, dLX, dLY);
      if (crit) { dX = C(1e30, 1e30); dY = C(1e30, 1e30); }
      let lgi = null, facing = false;
      if (Lf.lvl < 1e30 && Lf.lg) {
        const gx = Lf.lg[0] * dwX.re + Lf.lg[1] * dwX.im, gy = Lf.lg[0] * dwY.re + Lf.lg[1] * dwY.im, gl = Math.hypot(gx, gy) || 1;
        lgi = [gx / gl, gy / gl];
        facing = sh.nx * lgi[0] + sh.ny * lgi[1] < -0.5;
      }
      const sv = sh.s, lv = Lf.lvl;
      let cv = facing ? Math.min(sv, 0.5) + Math.min(lv, 0.5) : Math.min(sv, lv) + 0.5;
      cv = cv > 1 ? 1 : cv > 0 ? cv : 0;
      const lf = { z, J, JL: Lf.JL || null, lvl: lv, lg: lgi, lam, dX, dY, dLX, dLY, s: sv, cv, cov: cv > 0, D: 0, fp: crit ? 0 : Math.hypot(dX.re, dX.im) + Math.hypot(dY.re, dY.im), crit, anc: an, path: Lf.path || '' };
      lf.D = sheetKey(prep, z, lam);
      if (keep) leaves.push(lf);
      if (lf.cov) {
        nCov++;
        if (cv > U) U = cv;
        admit({ lf, D: lf.D, z, lam, cv, lvl: lv, lg: lgi, fp: lf.fp });
      }
      for (const lp of loops) { if (lp.up) lp.cU = lf.cov ? lp.cU + 1 : 0; else lp.cD = lf.cov ? lp.cD + 1 : 0; }
      return lf;
    };
    const anc = prep.anc;
    const apply = (Lf, mem, tag, j) => {
      const J = Lf.J, sc = Math.sqrt(Math.abs(J[0] * J[3] - J[1] * J[2]));
      // past a critical value (J not finite) only the sign of the range level is known
      const jf = J.every(Number.isFinite);
      const lv = mem.lvl === Infinity ? Infinity : jf ? mem.lvl / (sc * pix) : (mem.lvl > 0 ? 1e30 : mem.lvl < 0 ? -1e30 : 0);
      if (!(lv >= -ramp)) return null;
      let lg = Lf.lg;
      if (lv < Lf.lvl && mem.lg) {
        const gx = J[0] * mem.lg.re + J[2] * mem.lg.im, gy = J[1] * mem.lg.re + J[3] * mem.lg.im, gl = Math.hypot(gx, gy) || 1;
        lg = [gx / gl, gy / gl];
      }
      let J2;
      if (mem.anti) J2 = [J[0], J[1], -J[2], -J[3]];
      else { const d = mem.d; J2 = [d.re * J[0] - d.im * J[2], d.re * J[1] - d.im * J[3], d.im * J[0] + d.re * J[2], d.im * J[1] + d.re * J[3]]; }
      let JL = null;
      if (mem.dlam) { const d = mem.dlam; JL = [d.re * J[0] - d.im * J[2], d.re * J[1] - d.im * J[3], d.im * J[0] + d.re * J[2], d.im * J[1] + d.re * J[3]]; }
      return { u: mem.u, J: J2, JL, lvl: Math.min(Lf.lvl, lv), lg, lam: mem.lam || null, anc: anc && j === anc.op && mem.anc ? mem.anc : (Lf.anc || null), path: paths && tag ? (Lf.path ? Lf.path + ' ' : '') + tag : Lf.path };
    };
    const rec = (j, Lf) => {
      if (j < 0) return leaf(Lf);
      const o = ops[j], F = o.fam, u = Lf.u;
      if (!isFin(u)) return null;
      if (!F || F.type === 'fin') {
        let last = null;
        for (const mem of o.pre(u)) { const n = apply(Lf, mem, F && paths ? `${j}:0:${mem.m}` : null, j); if (n) last = rec(j - 1, n); }
        return last;
      }
      const isAdd = F.type === 'add';
      if (!isAdd && isZero(u)) return null;
      const bases = isAdd ? F.bases(u) : [F.L0(u)];
      const ref = prep.refs[j];
      const sp = prep.rspec[j];
      for (let bi = 0; bi < bases.length; bi++) {
        const base = bases[bi];
        if (!base || !isFin(base)) continue;
        // centre m*: the member nearest the reference
        let ms;
        if (isAdd) {
          ms = ref && isFin(ref) ? Math.round(div(sub(ref, base), F.p).re) : 0;
          if (j === prep.stopOp && prep.stopMob && !full) ms = mobCentre(prep, F, ref, base, ms);
        } else ms = logCentre(F, ref, base);
        if (!Number.isFinite(ms)) ms = 0;
        // member range
        let lo = -Infinity, hi = Infinity, hlo = Infinity, hhi = -Infinity;
        // scan budget (a Prep with ok = false may carry N = Infinity: bounded here so the walk always terminates)
        const Nj = full ? 2 * full + 1 : Math.min(prep.N[j] || 0, LEAF_CAP);
        if (full) { lo = ms - full; hi = ms + full; }
        else {
          if (!isAdd && !F.inf) {                                        // ROOTPOW finite: the branch range
            const xa = (F.lo - base.im) / F.S.im, xb = (F.hi - base.im) / F.S.im;
            lo = Math.ceil(Math.min(xa, xb)) - 1; hi = Math.floor(Math.max(xa, xb)) + 1;
          }
          if (sp && sp.kind === 'clip') {
            const sc = Math.sqrt(Math.abs(Lf.J[0] * Lf.J[3] - Lf.J[1] * Lf.J[2]));
            if (isAdd) {
              // the member line z_m = z0 + m q, clipped to the shape grown by the anti-aliasing margin (CLIP_PAD image
              // pixels in z, at most half a member spacing)
              const z0 = div(sub(base, sp.B), sp.A), q = div(F.p, sp.A), qa = abs(q);
              const rho = abs(F.member(u, bi, 0, base).d) * sc * pix / abs(sp.A);
              let mt = Math.min(CLIP_PAD * rho / qa, 0.5);
              if (!(mt >= 0)) mt = 0.5;
              const r = RG().shapeClip(prep.prim, z0, q, mt * qa);
              if (!(r.lo <= r.hi)) continue;
              lo = Math.max(lo, Math.ceil(r.lo) - 1); hi = Math.min(hi, Math.floor(r.hi) + 1);
              if (r.hlo <= r.hhi) { hlo = Math.floor(r.hlo) + 2; hhi = Math.ceil(r.hhi) - 2; }
            } else {
              // the member ray z = za + t dz (t = |u_m|): the union of the clips of the rays turned by 0 and +-da, da the
              // anti-aliasing margin as an angle (CLIP_PAD times the angular pixel footprint, at most 0.3); the hole is
              // the intersection of their holes
              const za = neg(div(sp.B, sp.A));
              let da = Math.min(CLIP_PAD * abs(F.beta) * sc * pix / abs(u), 0.3);
              if (!(da >= 0)) da = 0.3;
              const r = { lo: Infinity, hi: -Infinity, hlo: -Infinity, hhi: Infinity };
              for (const a of da > 0 ? [0, -da, da] : [0]) {
                const ri = RG().shapeClip(prep.prim, za, div(C(Math.cos(base.im + a), Math.sin(base.im + a)), sp.A));
                if (Math.max(ri.lo, 0) < ri.hi) { r.lo = Math.min(r.lo, Math.max(ri.lo, 0)); r.hi = Math.max(r.hi, ri.hi); }
                r.hlo = Math.max(r.hlo, ri.hlo); r.hhi = Math.min(r.hhi, ri.hhi);
              }
              const tlo = Math.max(r.lo, 0), thi = r.hi;
              if (!(tlo < thi)) continue;
              const toM = (t) => (Math.log(t) - base.re) / F.S.re;
              const a = tlo > 0 ? toM(tlo) : (F.S.re > 0 ? -Infinity : Infinity), b = Number.isFinite(thi) ? toM(thi) : (F.S.re > 0 ? Infinity : -Infinity);
              lo = Math.max(lo, Math.ceil(Math.min(a, b)) - 1); hi = Math.min(hi, Math.floor(Math.max(a, b)) + 1);
              if (r.hlo <= r.hhi && r.hhi > 0) {
                const ha = r.hlo > 0 ? toM(r.hlo) : (F.S.re > 0 ? -Infinity : Infinity), hb = toM(r.hhi);
                hlo = Math.floor(Math.min(ha, hb)) + 2; hhi = Math.ceil(Math.max(ha, hb)) - 2;
              }
            }
          } else if (sp && sp.kind === 'box') {
            if (isAdd) {
              const pa = abs(F.p), t0 = (base.re * F.p.re + base.im * F.p.im) / pa;
              if (Number.isFinite(sp.lo)) lo = Math.max(lo, Math.ceil((sp.lo - t0) / pa) - 1);
              if (Number.isFinite(sp.hi)) hi = Math.min(hi, Math.floor((sp.hi - t0) / pa) + 1);
            } else {
              const a = (sp.lo - base.re) / F.S.re, b = (sp.hi - base.re) / F.S.re;
              const mn = Math.min(a, b), mx = Math.max(a, b);
              if (Number.isFinite(mn)) lo = Math.max(lo, Math.ceil(mn) - 1);
              if (Number.isFinite(mx)) hi = Math.min(hi, Math.floor(mx) + 1);
            }
          }
        }
        if (hlo <= hhi) {                                                // a hole reaching infinity: a one-sided range
          if (hlo === -Infinity) { lo = Math.max(lo, hhi + 1); hlo = Infinity; hhi = -Infinity; }
          else if (hhi === Infinity) { hi = Math.min(hi, hlo - 1); hlo = Infinity; hhi = -Infinity; }
        }
        if (lo > hi) continue;
        const inHole = (m) => m >= hlo && m <= hhi;
        ms = Math.min(hi, Math.max(lo, ms));
        if (inHole(ms)) ms = (ms - hlo <= hhi - ms) ? hlo - 1 : hhi + 1;
        let up = ms, dn = ms - 1;
        if (inHole(dn)) dn = hlo - 1;
        let aU = up >= lo && up <= hi, aD = dn >= lo && dn <= hi, n = 0, turn = 0;
        const lp = { up: true, cU: 0, cD: 0 };
        loops.push(lp);
        while (n < Nj && (aU || aD)) {
          const goUp = aU && aD ? (turn++ & 1) === 0 : aU;
          const m = goUp ? up : dn;
          if (goUp) { up++; if (inHole(up)) up = hhi + 1; if (up > hi) aU = false; } else { dn--; if (inHole(dn)) dn = hlo - 1; if (dn < lo) aD = false; }
          n++;
          lp.up = goUp;
          const mem = isAdd ? F.member(u, bi, m, base) : F.member(u, m, base);
          const nL = mem && isFin(mem.u) || (mem && mem.lam && j === 0) ? apply(Lf, mem, paths ? `${j}:${bi}:${m}` : null, j) : null;
          if (!nL) { if (goUp) lp.cU = 0; else lp.cD = 0; continue; }
          const lf = rec(j - 1, nL);
          if (!full && j === prep.stopOp && lf) {
            let stop = false;
            if (!prep.stopMob) {
              const dk = DK();
              stop = dk < Infinity && affStopLB(prep, F, sp, lf, goUp) > dk + 1e-12;
              // the tail rule (prepare's tail flag; gl.js ixDKTail): K > B for the own alpha, the buffer full, U final, the
              // side still in range up to infinity without a hole, its last three members covering, and every member to
              // come behind the buffer's last key: the full walk would close the tail there anyway
              if (!stop && noStop && prep.tail && dk === Infinity && !(hlo <= hhi) && (goUp ? lp.cU >= 3 && hi === Infinity : lp.cD >= 3 && lo === -Infinity)
                && ent.length >= B && U >= 1 && affStopLB(prep, F, sp, lf, goUp) > ent[B - 1].D + 1e-12) { stop = true; tailInf = true; }
            } else if (isFin(lf.z)) {
              const sm = prep.stopMob, du = sub(mem.u, sm.uPole), dir = goUp ? 1 : -1;
              if ((du.re * F.p.re + du.im * F.p.im) * dir >= 0) {
                const r = abs(sub(lf.z, sm.pAcc)), p = sm.pAcc, W = prep.win;
                const dxp = Math.max(W.x0 - p.re, 0, p.re - W.x1), dyp = Math.max(W.y0 - p.im, 0, p.im - W.y1);
                const LB = Math.log2(1 + Math.max(0, Math.hypot(dxp, dyp) - r) / prep.R) + (sm.pInP ? Math.max(0, Math.log2(prep.rs / r)) : 0);
                stop = LB > DK();
              }
            }
            if (stop) { if (goUp) aU = false; else aD = false; }
          }
        }
        loops.pop();
        if (!full && (aU || aD)) {
          truncated = true;
          if ((aU && lp.cU >= 3) || (aD && lp.cD >= 3)) tailInf = true;
        }
      }
      return null;
    };
    rec(ops.length - 1, { u: w, J: [1, 0, 0, 1], JL: null, lvl: Infinity, lg: null, lam: null, anc: null, path: '' });
    return { leaves, visited, truncated, tailInf, entries: ent, nCov, U, restT };
  }
  // distance from the set {a + s v : 0 <= s <= smax} (smax may be Infinity) to the box W; 0 when they meet. Exact for
  // a segment or ray and a box: when disjoint, the minimum is attained at an end point of the segment or at a box corner.
  function rayBoxDist(a, v, smax, W) {
    let lo = 0, hi = smax;
    const slab = (p0, d, b0, b1) => {
      if (!(Math.abs(d) > 1e-300)) { if (p0 < b0 || p0 > b1) lo = Infinity; return; }
      const t1 = (b0 - p0) / d, t2 = (b1 - p0) / d;
      lo = Math.max(lo, Math.min(t1, t2)); hi = Math.min(hi, Math.max(t1, t2));
    };
    slab(a.re, v.re, W.x0, W.x1); slab(a.im, v.im, W.y0, W.y1);
    if (lo <= hi) return 0;
    let d = boxDist(W, a);
    if (Number.isFinite(smax)) d = Math.min(d, boxDist(W, C(a.re + smax * v.re, a.im + smax * v.im)));
    const vv = v.re * v.re + v.im * v.im;
    if (vv > 0) {
      for (const x of [W.x0, W.x1]) for (const y of [W.y0, W.y1]) {
        const s = Math.min(smax, Math.max(0, ((x - a.re) * v.re + (y - a.im) * v.im) / vv));
        d = Math.min(d, Math.hypot(a.re + s * v.re - x, a.im + s * v.im - y));
      }
    }
    return d;
  }
  // The early stop with an AFF prefix (3.6; review P1, finding 3): a proven lower bound of the key D of every member
  // still to come in direction dir of the stop op, given the member just visited (leaf lf at z_m). The rev-2 rule
  // "stop when D(z_m) > D_K" assumed D unimodal along the member line and a scan starting on its minimum side; neither
  // holds (P points off the line add bumps; with a rotated prefix and a non-square window the centre member lies off
  // the minimum, and D_K may come from another base or outer member). The members still to come lie on
  //  - additive families: the ray z_m + s dir q, s >= 0 (q = p / A): LB = log2(1 + dist(ray, W) / R); the P terms
  //    contribute 0 (the ray reaches infinity);
  //  - ROOTPOW (members on the ray from the apex za = -B / A): outward, the ray z_m + s (z_m - za), s >= 0, as above;
  //    inward, the segment [z_m, za): LB = log2(1 + dist(segment, W) / R) + sum over P of
  //    max(0, log2(rs / max(|z_m - p|, |za - p|))) (|z - p| is convex along the segment, so its max is at an end).
  // Each term is minimised separately (the min of a sum is at least the sum of the mins). The GPU's ixStop implements
  // the same bound (gl.js, P2). (13.14) The members still to come start at the NEXT member, z_m + dir q (additive) or
  // za + (z_m - za) e^(dir Re S) (ROOTPOW), so the rays and the segment start there: a side stops as soon as the member
  // after the one just visited is provably behind the front, instead of after visiting it.
  function affStopLB(prep, F, sp, lf, goUp) {
    if (!sp || sp.kind !== 'clip') return -Infinity;
    const zm = lf.z, dir = goUp ? 1 : -1, W = prep.win;
    if (!isFin(zm)) return F.type === 'add' || dir * F.S.re > 0 ? lf.D : -Infinity;   // far out: only outward
    if (F.type === 'add') {
      const q = div(F.p, sp.A), qd = C(dir * q.re, dir * q.im);
      return Math.log2(1 + rayBoxDist(add(zm, qd), qd, Infinity, W) / prep.R);
    }
    const za = neg(div(sp.B, sp.A));
    let z = add(za, scale(sub(zm, za), Math.exp(dir * F.S.re)));
    if (!isFin(z)) z = zm;
    if (dir * F.S.re > 0) return Math.log2(1 + rayBoxDist(z, sub(z, za), Infinity, W) / prep.R);
    let lb = Math.log2(1 + rayBoxDist(z, sub(za, z), 1, W) / prep.R);
    for (const p of prep.sing || []) {
      const far = Math.max(abs(sub(z, p)), abs(sub(za, p)));
      if (far < prep.rs) lb += Math.log2(prep.rs / far);
    }
    return lb;
  }
  // the Möbius-prefix centre (3.6): the smallest key among the u-projection, the member nearest the reference in z
  // (exact: minimise |u_m - u_c| / |u_m - q| over the line) and the member farthest from the accumulation point
  function mobCentre(prep, F, ref, base, ms) {
    const sm = prep.stopMob, uc = ref, q = sm.uPole, p = F.p;
    if (!uc || !isFin(uc)) return ms;
    const A = sub(base, uc), Bq = sub(base, q);
    const a = p.re * p.re + p.im * p.im, b1 = 2 * (A.re * p.re + A.im * p.im), c1 = A.re * A.re + A.im * A.im;
    const b2 = 2 * (Bq.re * p.re + Bq.im * p.im), c2 = Bq.re * Bq.re + Bq.im * Bq.im;
    const qa = a * (b2 - b1), qb = 2 * a * (c2 - c1), qc = b1 * c2 - b2 * c1;
    const roots = [];
    if (Math.abs(qa) > 1e-300) { const D = qb * qb - 4 * qa * qc; if (D >= 0) { const sq = Math.sqrt(D); roots.push((-qb - sq) / (2 * qa), (-qb + sq) / (2 * qa)); } }
    else if (Math.abs(qb) > 1e-300) roots.push(-qc / qb);
    const cands = [ms, Math.round(-(Bq.re * p.re + Bq.im * p.im) / a)];
    for (const x of roots) cands.push(Math.floor(x), Math.ceil(x));
    let best = ms, bD = Infinity;
    for (const mm of cands) {
      if (!Number.isFinite(mm)) continue;
      for (const m2 of [mm - 1, mm, mm + 1]) {
        const zz = CX.mobApply(sm.T, add(base, scale(p, m2)));
        if (!isFin(zz)) continue;
        const D = sheetKey(prep, zz, null);
        if (D < bD) { bD = D; best = m2; }
      }
    }
    return best;
  }
  // K for an alpha (4.2): 1 when alpha >= 0.999, else ceil(ln(1/255)/ln(1 - alpha)), capped at B when B is given
  const Kraw = (alpha) => (alpha >= 0.999 ? 1 : Math.max(1, Math.ceil(Math.log(1 / 255) / Math.log(1 - Math.min(alpha, 0.999999)))));
  const Kof = (alpha, B) => (B ? Math.min(B, Kraw(alpha)) : Kraw(alpha));
  // B variant (4.2; the GPU's GLR.inverseB, SPEC 13.12): 3 (alpha >= 0.999), 5 (alpha >= 0.5), 8; past B the front B
  // are exact and the rest composite through their transmittance
  const Bof = (alpha) => (alpha >= 0.999 ? 3 : alpha >= 0.5 ? 5 : 8);

  // =====================================================================================================
  // 11. renderCPU: the float64 reference renderer (SPEC 3.9; tests only)
  // =====================================================================================================
  // Inverse.renderCPU(plan, shapes, view, look, preps, opts) -> {rgba, stats}
  //  view: {cx, cy, s (px per w unit), W, H, win (clipWin, when preps are not given)}; shapes: a shape or a list,
  //  composited in list order (each premultiplied, over the previous); look: one object or one per shape:
  //  {alpha (1), pattern ('solid'), cell (1), color ('#3B6FD4'), color2 ('#8CABE5'), ink ('#093B9B'), lines, origin,
  //  sphN (16), dpr, B (8, 16 when alpha < 0.5), plane ('#FCFDFD')}; preps: Inverse.prepare results per shape.
  //  opts: {tieReverse, sub: [i0, j0, i1, j1] (render only that pixel box)}.
  //  stats: {ms, px, visited, covering, maxEntries, tailPx, truncPx, skipped (ineligible shapes), alpha: Float32Array
  //  (composite coverage), par: Int8Array (checker parity of the front entry, -1 none / moiré), top: Int16Array (index of
  //  the front shape), disagree: Uint8Array (a deeper composited full-coverage entry of another parity, T > 0.5)}
  function renderCPU(plan, shapes, view, look, preps, opts = {}) {
    const list = Array.isArray(shapes) ? shapes : [shapes];
    const looks = list.map((_, i) => (Array.isArray(look) ? look[i] : look) || {});
    const W = view.W || 410, H = view.H || 516, s = view.s, pix = 1 / s;
    const t0 = Date.now();
    const pr = list.map((sh, i) => (preps && preps[i]) || prepare(plan, { win: view.win, shape: sh }));
    /** @type {any[]} */
    const lk = looks.map((l) => ({
      alpha: l.alpha ?? 1, pattern: l.pattern ?? 'solid', cell: l.cell || 1, lines: !!l.lines, origin: l.origin || [0, 0], sphN: l.sphN || 16, dpr: l.dpr || 1,
      c0: hexRGB(l.color, '#3B6FD4'), c1: hexRGB(l.color2, '#8CABE5'), k: hexRGB(l.ink || l.edge, '#093B9B'), stretch: l.stretch,
      B: l.B || Bof(l.alpha ?? 1),
    }));
    lk.forEach((l) => { l.K = Kraw(l.alpha); });
    const plane = hexRGB((looks[0] || {}).plane, '#FCFDFD');
    const rgba = new Uint8ClampedArray(W * H * 4);
    const alphaA = new Float32Array(W * H), parA = new Int8Array(W * H).fill(-1), topA = new Int16Array(W * H).fill(-1), dis = new Uint8Array(W * H);
    let visited = 0, covering = 0, maxEnt = 0, tailPx = 0, truncPx = 0, px = 0;
    const [i0, j0, i1, j1] = opts.sub || [0, 0, W, H];
    for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
      const w = C(view.cx + (i + 0.5 - W / 2) * pix, view.cy - (j + 0.5 - H / 2) * pix);
      let accR = 0, accG = 0, accB = 0, accA = 0;
      px++;
      const k = j * W + i;
      for (let si = 0; si < list.length; si++) {
        const P = pr[si], L = lk[si];
        if (!P.ok) continue;
        const r = enumerate(plan, P, w, pix, { K: L.K, B: L.B, all: true, alpha: L.alpha, leaves: false, tieReverse: opts.tieReverse });
        visited += r.visited; covering += r.nCov;
        if (r.tailInf) tailPx++;
        if (r.truncated) truncPx++;
        if (!r.U) continue;
        const ent = r.entries;
        maxEnt = Math.max(maxEnt, ent.length);
        const cols = ent.map((e) => patternColor(L, { z: e.z, dX: e.lf.dX, dY: e.lf.dY, lam: e.lam, dLX: e.lf.dLX, dLY: e.lf.dLY, J: e.lf.J, JL: e.lf.JL, anc: e.lf.anc }));
        let T = 1, cr = 0, cg = 0, cb = 0;
        const par0 = cols.length ? (cols[0].mo === 0 ? cols[0].par : -1) : -1;
        for (let q = 0; q < ent.length; q++) {
          if (T < 1 / 255) break;
          const a = L.alpha * ent[q].cv / r.U, c = cols[q].col;
          if (q > 0 && cols[q].mo === 0 && ent[q].cv >= 1 && par0 >= 0 && cols[q].par !== par0 && T > 0.5) dis[k] = 1;
          cr += T * a * c[0]; cg += T * a * c[1]; cb += T * a * c[2];
          T *= 1 - a;
        }
        // behind the buffer (the GPU's INV_MAIN): the covering candidates it did not keep, through their transmittance
        // restT and coloured with the buffer's mean, then the tail closure of infinitely many sheets
        if ((r.restT < 1 || r.tailInf) && T >= 1 / 255 && cols.length) {
          let mr = 0, mg = 0, mb = 0;
          for (const c of cols) { mr += c.col[0]; mg += c.col[1]; mb += c.col[2]; }
          mr /= cols.length; mg /= cols.length; mb /= cols.length;
          const f = T * (1 - r.restT);
          cr += f * mr; cg += f * mg; cb += f * mb; T *= r.restT;
          if (r.tailInf) { cr += T * mr; cg += T * mg; cb += T * mb; T = 0; }
        }
        const sa = r.U * (1 - T);
        // premultiplied (U C, U (1 - T)) over what is below
        accR = r.U * cr + (1 - sa) * accR; accG = r.U * cg + (1 - sa) * accG; accB = r.U * cb + (1 - sa) * accB; accA = sa + (1 - sa) * accA;
        if (sa > 0) { parA[k] = par0; topA[k] = si; }
      }
      alphaA[k] = accA;
      rgba[4 * k] = Math.round(255 * (accR + (1 - accA) * plane[0]));
      rgba[4 * k + 1] = Math.round(255 * (accG + (1 - accA) * plane[1]));
      rgba[4 * k + 2] = Math.round(255 * (accB + (1 - accA) * plane[2]));
      rgba[4 * k + 3] = 255;
    }
    const n = Math.max(1, px);
    return { rgba, stats: { ms: Date.now() - t0, px, visited: visited / n, covering: covering / n, maxEntries: maxEnt, tailPx, truncPx,
      skipped: pr.filter((p) => !p.ok).length, reasons: pr.map((p) => p.reason), alpha: alphaA, par: parA, top: topA, disagree: dis } };
  }

  // =====================================================================================================
  // 12. Homotopy end points for normalizeMap (SPEC 10.5; verified by test/t_inverse.js (k))
  // =====================================================================================================
  // catalog types whose homotopy satisfies H_0 = id and H_1 = f (to 1e-12 (1 + |f|)): a paused morph at t = 0 or 1
  // may be drawn as the mode-0 map of the stage it equals
  const HOM_EXACT = new Set(['mul', 'add', 'affine', 'recip', 'mobius', 'blaschke', 'pown', 'root', 'powa', 'exp', 'log',
    'sin', 'cos', 'tan', 'sinh', 'cosh', 'tanh', 'arcsin', 'arccos', 'arctan', 'arsinh', 'arcosh', 'artanh',
    'joukowski', 'ijouk', 'conj', 'poly', 'rational', 'zp', 'custom']);
  const homExact = (step) => !!step && HOM_EXACT.has(step.type);

  return {
    LEAF_CAP, WIN_MAX, MIN_WIN, IPOW_MAX, OPS_MAX, POLY_MAX, M_MAX, RAMP, LAM_CUT, PATTERNS, HOM_EXACT, IMAGEBOX_CAP,
    stepOps, planChain, pointPre, inverseKey, prepare, enumerate, sheetKey, front, keySing, singular, singularAfter, accumulation, imageBox, renderCPU, rationalForm,
    shapePx, patternColor, Kof, Kraw, Bof, homExact, refsOf,
    // internals for the node tests (and the GLSL parity tests of P2): the cancellation-free family bases, the disc
    // enclosures of imageBox
    _trig: { asin: asinS, acos: acosS, asinh: asinhS, atan: atanS, atanh: atanhS },
    // saturation anchors (SPEC 13.12): the shape's local model at p, its signed distance, the stable offsets
    _anchor: { model: anchorModel, px: anchorPx, tanh: tanhAnc, tan: tanAnc },
    // the checker filter of the analytic patterns (the GPU's ixSq)
    _sqAA: (p, w) => sqAA(p, w),
    _encl: { opDisc, chainDisc },
    _ops: { opAff, opMob, opIpow, opRootPow, opExp, opLog, opSin, opCos, opTan, opSinh, opCosh, opTanh, opAsin, opAcos, opAtan, opAsinh, opAcosh, opAtanh, opJouk, opIjouk, opConj, opQuad, opRat2 },
  };
})();
import { CX } from './cx.js';
import { Region } from './region.js';
import { InvOps } from './invops.js';
import { InvPatterns } from './invpatterns.js';
export { Inverse, Inverse as 'module.exports' };
