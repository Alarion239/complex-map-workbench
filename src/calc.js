// @ts-check
'use strict';
// Numerical complex calculus on a map F: z -> w ({re, im} in and out): line integrals along polygons, the argument
// principle, Cauchy integrals, residues, and the zeros and poles of F in a box.
// Polygons may be given as [{re, im}, ...], [[x, y], ...], a flat [x0, y0, x1, y1, ...] array (typed arrays too),
// or an object with such a .pts.
const Calc = (() => {
  const C = CX.C;
  const TAU = 2 * Math.PI;
  // 10-point Gauss–Legendre on [-1, 1]: roots of P_10 by Newton's method, w = 2 / ((1 − x²) P_10'(x)²)
  const GX = [], GW = [];
  for (let i = 1; i <= 10; i++) {
    let x = Math.cos(Math.PI * (i - 0.25) / 10.5), dp = 1;
    for (let it = 0; it < 100; it++) {
      let p0 = 1, p1 = x;
      for (let k = 2; k <= 10; k++) { const p2 = ((2 * k - 1) * x * p1 - (k - 1) * p0) / k; p0 = p1; p1 = p2; }
      dp = 10 * (x * p1 - p0) / (x * x - 1);
      const dx = p1 / dp;
      x -= dx;
      if (Math.abs(dx) < 1e-16) break;
    }
    GX.push(x); GW.push(2 / ((1 - x * x) * dp * dp));
  }
  const SING = $t('The curve passes through a singularity');
  const fin = (w) => !!w && Number.isFinite(w.re) && Number.isFinite(w.im);
  const absC = (w) => Math.hypot(w.re, w.im);

  function points(poly) {
    if (!poly) return [];
    if (poly.pts) poly = poly.pts;
    const out = [];
    const n = poly.length;
    if (n && typeof poly[0] === 'number') { for (let i = 0; i + 1 < n; i += 2) out.push(C(+poly[i], +poly[i + 1])); }
    else for (const p of poly) out.push(Array.isArray(p) ? C(+p[0], +p[1]) : C(+p.re, +p.im));
    return out.filter(fin);
  }
  // a closed polygon without a repeated closing vertex
  function loop(poly) {
    const pts = points(poly);
    while (pts.length > 1) {
      const a = pts[0], b = pts[pts.length - 1];
      if (a.re === b.re && a.im === b.im) pts.pop(); else break;
    }
    return pts;
  }
  const P = (p) => (p == null ? C(0, 0) : typeof p === 'number' ? C(p, 0) : C(p.re || 0, p.im || 0));
  const shifted = (F, p) => (p.re === 0 && p.im === 0 ? F : (z) => { const w = F(z); return C(w.re - p.re, w.im - p.im); });

  // ---------------- line integrals ----------------
  // ∫γ F dz along a polygon (closing it when closed). Gauss–Legendre (10 points) on every piece, bisected until the
  // two halves agree with the whole. A piece that cannot be resolved is a singularity on the curve, unless its error
  // keeps shrinking as it is bisected (an integrable singularity, or a jump where the curve crosses a branch cut).
  // Returns {value, path, length, fine, scale, errBound, error?}: path holds the running integral at every vertex,
  // starting at 0 (for a closed curve one more point, after the closing segment, which equals value); fine is the
  // running integral at every accepted piece, for drawing a smooth path; scale is ∫|F||dz|, and errBound an absolute
  // bound on the error of value (rounding at 1e-12·scale plus the accepted pieces' error estimates), so a value with
  // |value| <= errBound is 0 as far as the integrator can tell (∮ z² dz comes out as 10⁻¹⁷, not 0).
  function lineIntegral(F, poly, closed = false, opts = {}) {
    const pts = points(poly);
    const n = pts.length;
    const segs = n < 2 ? 0 : n - 1 + (closed && n > 2 ? 1 : 0);
    const path = new Float64Array(2 * (segs + 1));
    const res = { value: C(0, 0), path, length: 0, fine: new Float64Array(2), scale: 0, errBound: 0 };
    if (!segs) return res;
    const seg = (k) => [pts[k], pts[(k + 1) % n]];
    let evals = 0;
    const budget = opts.budget || 1e6;
    // ∫ over t in [t0, t1] of F(a + t d) d dt, or null at a non-finite value
    function gl(a, d, t0, t1) {
      const hm = 0.5 * (t1 - t0), cm = 0.5 * (t1 + t0);
      let sr = 0, si = 0, sm = 0;
      for (let i = 0; i < 10; i++) {
        const t = cm + hm * GX[i];
        const w = F(C(a.re + t * d.re, a.im + t * d.im));
        if (!fin(w)) return null;
        sr += GW[i] * w.re; si += GW[i] * w.im; sm += GW[i] * absC(w);
      }
      evals += 10;
      // m: ∫|F||dz| over the piece
      return { re: (sr * d.re - si * d.im) * hm, im: (sr * d.im + si * d.re) * hm, m: sm * hm * absC(d) };
    }
    // first pass: Gauss–Legendre on at least 64 pieces around the whole curve, for the scale ∫|F||dz| of the
    // tolerance; the piece values start the bisection
    let length = 0;
    for (let k = 0; k < segs; k++) { const [a, b] = seg(k); length += Math.hypot(b.re - a.re, b.im - a.im); }
    res.length = length;
    let scale = 0;
    const pieces = [];
    for (let k = 0; k < segs; k++) {
      const [a, b] = seg(k);
      const d = C(b.re - a.re, b.im - a.im), L = absC(d);
      const m = length > 0 ? Math.max(1, Math.min(4096, Math.ceil(64 * L / length))) : 1;
      const ws = [];
      for (let j = 0; j < m && L > 0; j++) {
        const g = gl(a, d, j / m, (j + 1) / m);
        if (!g) return fail(res, k, SING);
        scale += g.m;
        ws.push(g);
      }
      pieces.push(ws);
    }
    res.scale = scale;
    const tol = (opts.tol || 1e-10) * Math.max(scale, 1e-300);
    let errSum = 0;
    const fine = [0, 0];
    let tot = C(0, 0);
    let bad = null;
    // stall: the parent piece was already tiny and its error did not shrink
    function adapt(a, d, L, t0, t1, whole, depth, prevErr, stall, segTol, out) {
      const tm = 0.5 * (t0 + t1);
      const l = gl(a, d, t0, tm), r = l && gl(a, d, tm, t1);
      if (!l || !r) { bad = SING; return; }
      const sum = C(l.re + r.re, l.im + r.im);
      const err = Math.hypot(sum.re - whole.re, sum.im - whole.im);
      const w = t1 - t0;
      // the samples' own rounding: a point a + t d is off by about ε(|a| + |d|), which changes F, varying on the
      // scale of the piece, by that over the piece's length
      const noise = 100 * Number.EPSILON * (absC(a) + L) / (w * L) * (l.m + r.m);
      if (err <= segTol * w || err <= 1e-15 * Math.max(absC(sum), scale) || err <= noise) { errSum += err; out.push(sum); return; }
      if (evals > budget) { bad = $t('The integral did not converge'); return; }
      // Within 1e-7 (relative) of a point the samples carry rounding noise of the parametrisation. An error that
      // stops shrinking there for two levels is a non-integrable singularity (or a pole closer to the curve than
      // the noise can resolve). An integrable one (z^{-1/2}, log z, a jump across a cut) keeps shrinking.
      const tiny = w * L <= 1e-7 * (absC(a) + L);
      const shrinking = prevErr == null || err < 0.85 * prevErr;
      if (tiny && !shrinking && stall) { bad = SING; return; }
      if (depth >= 60 || w * L <= 1e-14 * (absC(a) + L)) {
        if (shrinking || err <= 1e-7 * scale) { errSum += err; out.push(sum); return; }
        bad = SING;
        return;
      }
      const st = tiny && !shrinking;
      adapt(a, d, L, t0, tm, l, depth + 1, err, st, segTol, out);
      if (bad) return;
      adapt(a, d, L, tm, t1, r, depth + 1, err, st, segTol, out);
    }
    for (let k = 0; k < segs; k++) {
      const [a, b] = seg(k);
      const d = C(b.re - a.re, b.im - a.im), L = absC(d);
      if (L > 0) {
        const ws = pieces[k], m = ws.length;
        const segTol = tol * (length > 0 ? L / length : 1);
        for (let j = 0; j < m; j++) {
          const t0 = j / m, t1 = (j + 1) / m;
          const whole = ws[j];
          const out = [];
          adapt(a, d, L, t0, t1, whole, 0, null, false, segTol, out);
          if (bad) return fail(res, k, bad);
          for (const s of out) { tot = C(tot.re + s.re, tot.im + s.im); fine.push(tot.re, tot.im); }
        }
      }
      path[2 * k + 2] = tot.re; path[2 * k + 3] = tot.im;
    }
    res.value = tot;
    res.errBound = 1e-12 * scale + errSum;
    res.fine = new Float64Array(fine);
    return res;
  }
  // the running integral up to vertex k stays in path; the rest is NaN
  function fail(res, k, msg) {
    res.value = C(NaN, NaN);
    res.errBound = NaN;
    res.error = msg;
    res.failSegment = k;
    for (let i = 2 * k + 2; i < res.path.length; i++) res.path[i] = NaN;
    return res;
  }

  // ---------------- argument tracking ----------------
  // arg(b / a), scaled first so that huge or tiny values do not overflow
  function argq(a, b) {
    const sa = Math.max(Math.abs(a.re), Math.abs(a.im)), sb = Math.max(Math.abs(b.re), Math.abs(b.im));
    const ar = a.re / sa, ai = a.im / sa, br = b.re / sb, bi = b.im / sb;
    return Math.atan2(ar * bi - ai * br, ar * br + ai * bi);
  }
  // Change of arg G along z0 -> z1 (values g0, g1 known): bisected until every piece turns by less than π/8 and G is
  // nearly linear on it (so no turn hides between samples). NaN when G vanishes, blows up or jumps on the segment.
  const nowMs = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
  function track(G, z0, g0, z1, g1, ctx, depth) {
    const zm = C(0.5 * (z0.re + z1.re), 0.5 * (z0.im + z1.im));
    const gm = G(zm);
    ctx.evals++;
    if (!fin(gm) || absC(gm) <= ctx.tiny) { ctx.failAt = zm; return NaN; }
    const d1 = argq(g0, gm), d2 = argq(gm, g1);
    const lin = Math.hypot(gm.re - 0.5 * (g0.re + g1.re), gm.im - 0.5 * (g0.im + g1.im)) <= 0.2 * Math.min(absC(g0), absC(g1));
    if (Math.abs(d1) < Math.PI / 8 && Math.abs(d2) < Math.PI / 8 && lin) return d1 + d2;
    // a wall-clock deadline (ctx.deadline, a performance.now() time), checked again after every 16 calls: past it, the
    // budget is spent
    if (ctx.deadline && ctx.evals >= (ctx.nextT || 0)) { ctx.nextT = ctx.evals + 16; if (nowMs() > ctx.deadline) ctx.budget = 0; }
    if (depth >= 44 || ctx.evals > ctx.budget) { ctx.failAt = zm; return NaN; }
    const a = track(G, z0, g0, zm, gm, ctx, depth + 1);
    if (Number.isNaN(a)) return NaN;
    return a + track(G, zm, gm, z1, g1, ctx, depth + 1);
  }
  // total change of arg G around a closed polygon, or NaN
  function turn(G, pts, ctx, minPieces = 64) {
    const n = pts.length;
    let per = 0;
    for (let k = 0; k < n; k++) { const a = pts[k], b = pts[(k + 1) % n]; per += Math.hypot(b.re - a.re, b.im - a.im); }
    const g = pts.map(G);
    ctx.evals += n;
    // only a value that is (nearly) exactly 0 counts as a zero on the curve: |F| may range over many orders of
    // magnitude along it (e^{z²} on |z| = 4: e^{−16} to e^{16}), and a real zero between samples is caught by
    // track()'s bisection and linearity test, which compare values locally
    if (!(ctx.tiny >= 0)) ctx.tiny = 1e-300;
    let total = 0;
    for (let k = 0; k < n; k++) {
      const a = pts[k], b = pts[(k + 1) % n];
      if (!fin(g[k]) || absC(g[k]) <= ctx.tiny) { ctx.failAt = a; return NaN; }
      const L = Math.hypot(b.re - a.re, b.im - a.im);
      const m = per > 0 ? Math.max(1, Math.ceil(minPieces * L / per)) : 1;
      let z0 = a, g0 = g[k];
      for (let j = 1; j <= m; j++) {
        const z1 = j === m ? b : C(a.re + (b.re - a.re) * j / m, a.im + (b.im - a.im) * j / m);
        let g1 = j === m ? g[(k + 1) % n] : G(z1);
        if (j < m) ctx.evals++;
        if (!fin(g1) || absC(g1) <= ctx.tiny) { ctx.failAt = z1; return NaN; }
        const d = track(G, z0, g0, z1, g1, ctx, 0);
        if (Number.isNaN(d)) return NaN;
        total += d;
        z0 = z1; g0 = g1;
      }
    }
    return total;
  }
  // ---- sound (notes/sound/DESIGN.md §2.4, §2.5): the probe's exact arg steps and the order at a point ----
  // The change of arg F along the segment z0 → z1, tracked exactly (track() above). g0, g1: F there, or null to
  // evaluate them. opts.budget: the most calls of F (default 6000). Returns { d, exact, why, evals }: d in radians;
  // when the tracker fails, d is the principal difference and why says why: 'end' (F is 0 or not finite at an end),
  // 'zero' or 'pole' (F vanishes or blows up on the segment), 'jump' (F stays finite and non-zero but does not
  // converge: a branch cut), 'budget' (the work budget ran out).
  // opts.deadline: a performance.now() time after which the work stops as if the budget had run out ('budget')
  function argStep(F, z0, g0, z1, g1, opts = {}) {
    if (!g0) g0 = F(z0);
    if (!g1) g1 = F(z1);
    const ok = (g) => fin(g) && absC(g) > 0;
    if (!ok(g0) || !ok(g1)) return { d: ok(g0) && ok(g1) ? argq(g0, g1) : 0, exact: false, why: 'end', evals: 0 };
    const ctx = { evals: 0, budget: opts.budget || 6000, tiny: opts.tiny != null ? opts.tiny : 1e-300, deadline: opts.deadline || 0 };
    // v15.2 (review math-1): track() cannot see whole turns hidden in a piece where |F| hardly changes (e^{30z} moved
    // up by 0.42 turns by 4π in each half and reads 0). So the segment is first cut into m equal pieces, each turning arg
    // F by at most π/4 at the rate of either end: the rate is d arg F / ds there, from one more call of F at a
    // thousandth of the step (2 calls in all). Pieces beyond the budget fail as 'budget'
    const dz = C(z1.re - z0.re, z1.im - z0.im), EPS = 1e-3;
    const rate = (z, g, s) => {
      const w = F(C(z.re + s * EPS * dz.re, z.im + s * EPS * dz.im));
      ctx.evals++;
      return ok(w) ? Math.abs(argq(g, w)) / EPS : 0;
    };
    const m = Math.min(4096, Math.max(1, Math.ceil(Math.max(rate(z0, g0, 1), rate(z1, g1, -1)) / (Math.PI / 4))));
    let d = 0, za = z0, ga = g0;
    for (let j = 1; j <= m; j++) {
      const zb = j === m ? z1 : C(z0.re + dz.re * j / m, z0.im + dz.im * j / m);
      let gb = g1;
      if (j < m) {
        if (ctx.deadline && ctx.evals >= (ctx.nextT || 0)) { ctx.nextT = ctx.evals + 16; if (nowMs() > ctx.deadline) ctx.budget = 0; }
        if (ctx.evals >= ctx.budget) { ctx.evals = ctx.budget + 1; d = NaN; break; }
        gb = F(zb); ctx.evals++;
        if (!ok(gb)) { ctx.failAt = zb; d = NaN; break; }
      }
      d += track(F, za, ga, zb, gb, ctx, 0);
      if (Number.isNaN(d)) break;
      za = zb; ga = gb;
    }
    if (!Number.isNaN(d)) return { d, exact: true, evals: ctx.evals };
    let why = 'jump';
    if (ctx.evals > ctx.budget) why = 'budget';
    else if (ctx.failAt) { const g = F(ctx.failAt); why = !fin(g) ? 'pole' : absC(g) <= ctx.tiny ? 'zero' : 'jump'; }
    return { d: argq(g0, g1), exact: false, why, at: ctx.failAt, evals: ctx.evals };
  }
  // N − P inside the circle |z − c| = r (zeros minus poles, with multiplicity) by the argument principle on a
  // 16-gon, tracked exactly: an integer, or null when F vanishes, blows up or jumps on the circle (a branch point
  // gives no order) or the budget (opts.budget calls of F, default 6000) runs out. Exact for any order m.
  function orderAt(F, c, r, opts = {}) {
    const n = opts.n || 16, budget = opts.budget || 6000;
    const p = (i) => C(c.re + r * Math.cos(TAU * i / n), c.im + r * Math.sin(TAU * i / n));
    let tot = 0, evals = 0, z0 = p(0), g0 = F(z0);
    const gs = g0;
    for (let i = 1; i <= n; i++) {
      const z1 = i === n ? p(0) : p(i), g1 = i === n ? gs : F(z1);
      if (evals >= budget || (opts.deadline && nowMs() > opts.deadline)) return null;
      const s = argStep(F, z0, g0, z1, g1, { budget: budget - evals, deadline: opts.deadline });
      evals += s.evals + 1;
      if (!s.exact) return null;
      tot += s.d; z0 = z1; g0 = g1;
    }
    const m = Math.round(tot / TAU);
    return Math.abs(tot / TAU - m) < 1e-6 ? m || 0 : null;
  }
  // winding number of F∘γ − p about 0 for the closed polygon γ: zeros minus poles of F − p inside, counted with
  // multiplicity, when F is meromorphic there. ok is false when F − p vanishes or is singular on γ, or jumps
  // (a branch cut crosses γ).
  // The limit of every count here (argStep, orderAt, argPrinciple; review math-2): a zero and a pole closer together than
  // about 1/50 of the spacing of the samples, with γ passing between them away from a sample, cancel in F's values at
  // the samples and their midpoints, so the piece is accepted and their 2π is missed (winding 0 for 1, still ok).
  // Below a pixel at the default zoom: a zero dragged onto a pole, or a deformation where the two meet.
  function argPrinciple(F, poly, p = 0, opts = {}) {
    const pts = loop(poly);
    if (pts.length < 3) return { winding: 0, ok: false, turn: NaN };
    const ctx = { evals: 0, budget: opts.budget || 400000, tiny: opts.tiny };
    const total = turn(shifted(F, P(p)), pts, ctx);
    if (!Number.isFinite(total)) return { winding: 0, ok: false, turn: NaN };
    const w = Math.round(total / TAU) || 0; // never −0
    return { winding: w, ok: Math.abs(total / TAU - w) < 1e-6, turn: total };
  }

  // ---------------- Cauchy integrals, residues ----------------
  // (1/2πi) ∮γ F(ζ)/(ζ − z0) dζ: F(z0) inside γ when F is holomorphic there, 0 outside
  function cauchy(F, poly, z0, opts = {}) {
    const p = P(z0);
    const r = lineIntegral((z) => CX.div(F(z), C(z.re - p.re, z.im - p.im)), loop(poly), true, opts);
    if (r.error) return { re: NaN, im: NaN, error: r.error };
    return Object.assign(C(r.value.im / TAU, -r.value.re / TAU), { errBound: r.errBound / TAU });
  }
  // (1/2πi) ∮ F dζ over the circle |ζ − z0| = r: the trapezoidal rule, which converges geometrically for F analytic
  // near the circle; the number of points doubles until two estimates agree
  function residue(F, z0, r, opts = {}) {
    const c = P(z0);
    if (!(r > 0)) r = 1e-3 * (1 + absC(c));
    let N = 32, sr = 0, si = 0, mx = 0, prev = null;
    const add = (j, n) => {
      const t = TAU * j / n, er = r * Math.cos(t), ei = r * Math.sin(t);
      const w = F(C(c.re + er, c.im + ei));
      if (!fin(w)) return false;
      sr += w.re * er - w.im * ei; si += w.re * ei + w.im * er;
      mx = Math.max(mx, absC(w) * r);
      return true;
    };
    for (let j = 0; j < N; j++) if (!add(j, N)) return { re: NaN, im: NaN, error: $t('The circle passes through a singularity') };
    for (;;) {
      const v = C(sr / N, si / N);
      if (prev && Math.hypot(v.re - prev.re, v.im - prev.im) <= (opts.tol || 1e-13) * Math.max(mx, 1e-300)) return v;
      if (N >= 65536) return Object.assign(v, { approx: true });
      prev = v;
      for (let j = 1; j < 2 * N; j += 2) if (!add(j, 2 * N)) return { re: NaN, im: NaN, error: $t('The circle passes through a singularity') };
      N *= 2;
    }
  }
  // GPU Cauchy style: N nodes ζ_j evenly spaced by arc length on the closed polygon, with weights
  // F(ζ_j) dζ_j / (2πi), dζ_j = (ζ_{j+1} − ζ_{j−1}) / 2, so Σ w_j / (ζ_j − z) approximates the Cauchy integral at z
  // (the weights already hold the 1/2πi). Layout [x, y, wre, wim] per node; a node where F is not finite gets weight 0.
  // composite 4-point Gauss–Legendre on the smooth pieces between corners: the arc-length trapezoid rule is
  // spectral on a smooth closed curve but only O(h²) at the corners of a rectangle or a sector, which left a
  // visible 1e-5 residue outside them in the Cauchy style
  const GL4 = [[-0.8611363115940526, 0.3478548451374538], [-0.3399810435848563, 0.6521451548625461], [0.3399810435848563, 0.6521451548625461], [0.8611363115940526, 0.3478548451374538]];
  function cauchyNodesCornered(F, pts, corners, N) {
    const n = pts.length, nodes = [];
    let L = 0;
    for (let k = 0; k < n; k++) { const a = pts[k], b = pts[(k + 1) % n]; L += Math.hypot(b.re - a.re, b.im - a.im); }
    if (!(L > 0)) return new Float32Array(0);
    const panelsTotal = Math.max(corners.length, Math.floor(N / 4));
    for (let c = 0; c < corners.length; c++) {
      const k0 = corners[c];
      let k1 = corners[(c + 1) % corners.length];
      if (k1 <= k0) k1 += n;
      const P = [];
      for (let k = k0; k <= k1; k++) P.push(pts[k % n]);
      const cum = [0];
      for (let k = 1; k < P.length; k++) cum.push(cum[k - 1] + Math.hypot(P[k].re - P[k - 1].re, P[k].im - P[k - 1].im));
      const len = cum[cum.length - 1];
      if (!(len > 0)) continue;
      const panels = Math.max(1, Math.round(panelsTotal * len / L));
      let seg = 0;
      for (let q = 0; q < panels; q++) {
        const s0 = len * q / panels, s1 = len * (q + 1) / panels, half = 0.5 * (s1 - s0);
        for (const [x, wgl] of GL4) {
          const sv = 0.5 * (s0 + s1) + half * x;
          while (seg < cum.length - 2 && cum[seg + 1] < sv) seg++;
          while (seg > 0 && cum[seg] > sv) seg--;
          const a = P[seg], b = P[seg + 1], sl = cum[seg + 1] - cum[seg];
          const t = sl > 0 ? (sv - cum[seg]) / sl : 0;
          const z = C(a.re + t * (b.re - a.re), a.im + t * (b.im - a.im));
          const ux = sl > 0 ? (b.re - a.re) / sl : 0, uy = sl > 0 ? (b.im - a.im) / sl : 0;
          const ds = half * wgl, dr = ux * ds, di = uy * ds;
          const w = F(z);
          if (fin(w)) {
            const xx = w.re * dr - w.im * di, yy = w.re * di + w.im * dr;
            nodes.push(z.re, z.im, yy / TAU, -xx / TAU);
          } else nodes.push(z.re, z.im, 0, 0);
        }
      }
    }
    return new Float32Array(nodes);
  }
  function cauchyNodes(F, poly, N = 256) {
    const pts = loop(poly);
    N = Math.max(3, Math.floor(N));
    const n = pts.length;
    if (n >= 3) {
      const ang = (k) => { const a = pts[k], b = pts[(k + 1) % n]; return Math.atan2(b.im - a.im, b.re - a.re); };
      const corners = [];
      for (let k = 0; k < n; k++) { let d = ang(k) - ang((k + n - 1) % n); d = Math.atan2(Math.sin(d), Math.cos(d)); if (Math.abs(d) > 0.35) corners.push(k); }
      if (corners.length) return cauchyNodesCornered(F, pts, corners, N);
    }
    const out = new Float32Array(4 * N);
    if (n < 2) return out;
    const cum = [0];
    for (let k = 0; k < n; k++) { const a = pts[k], b = pts[(k + 1) % n]; cum.push(cum[k] + Math.hypot(b.re - a.re, b.im - a.im)); }
    const L = cum[n];
    if (!(L > 0)) return out;
    const zs = [];
    let k = 0;
    for (let j = 0; j < N; j++) {
      const s = L * j / N;
      while (k < n - 1 && cum[k + 1] <= s) k++;
      const a = pts[k], b = pts[(k + 1) % n], seg = cum[k + 1] - cum[k];
      const t = seg > 0 ? (s - cum[k]) / seg : 0;
      zs.push(C(a.re + t * (b.re - a.re), a.im + t * (b.im - a.im)));
    }
    for (let j = 0; j < N; j++) {
      const z = zs[j], zp = zs[(j + 1) % N], zm = zs[(j + N - 1) % N];
      const dr = 0.5 * (zp.re - zm.re), di = 0.5 * (zp.im - zm.im);
      const w = F(z);
      out[4 * j] = z.re; out[4 * j + 1] = z.im;
      if (fin(w)) {
        // F dζ / (2πi) = (x + iy)(−i)/(2π) for x + iy = F dζ
        const x = w.re * dr - w.im * di, y = w.re * di + w.im * dr;
        out[4 * j + 2] = y / TAU; out[4 * j + 3] = -x / TAU;
      }
    }
    return out;
  }

  // ---------------- zeros and poles ----------------
  function normBox(b) {
    if (Array.isArray(b)) return { x0: Math.min(b[0], b[2]), x1: Math.max(b[0], b[2]), y0: Math.min(b[1], b[3]), y1: Math.max(b[1], b[3]) };
    const x0 = b.x0 ?? b.xmin ?? b.left, x1 = b.x1 ?? b.xmax ?? b.right, y0 = b.y0 ?? b.ymin ?? b.bottom, y1 = b.y1 ?? b.ymax ?? b.top;
    return { x0: Math.min(x0, x1), x1: Math.max(x0, x1), y0: Math.min(y0, y1), y1: Math.max(y0, y1) };
  }
  // Solutions of F(z) = target (zeros of F when target is null) and poles of F inside box, as
  // [{z, kind: 'zero' | 'pole', mult}]. A grid of cells (offset by irrational fractions, so roots at round numbers
  // do not sit on its lines) gets the winding number of F − target around each cell (the argument principle);
  // cells with a nonzero count are split until each holds one zero or pole (or a multiple one), which Newton's
  // method (modified by the multiplicity) refines. Cells whose boundary meets a root, a pole or a branch cut are
  // searched by Newton from their centre and kept only when the result is verified (by the count on a small circle
  // about it where that can be tracked). Cells are refined level by level (all cells of one size, nearest the centre
  // first, before any smaller one), so when the count runs out the roots kept are the well-separated ones, not a
  // cluster at an accumulation point (the preimages of e^{1/z} pile up at 0). Duplicates are merged; at most max
  // results (coarsest level first, then nearest the centre), sorted by Re z. The array has .truncated /
  // .incomplete when the count or the work budget ran out.
  function zerosPoles(F, box, opts = {}) {
    const B = normBox(box || {});
    /** @type {ZeroPoleList} */
    const out = [];
    const W = B.x1 - B.x0, H = B.y1 - B.y0;
    if (!(W > 0 && H > 0) || !Number.isFinite(W + H)) return out;
    const max = opts.max ?? 40;
    const G = shifted(F, P(opts.target));
    const ng = opts.grid || 32;
    const h = Math.sqrt(W * H) / ng;
    const ox = B.x0 - 0.3819660113 * h, oy = B.y0 - 0.2763932023 * h;
    const nx = Math.ceil((B.x1 - ox) / h), ny = Math.ceil((B.y1 - oy) / h);
    const ctx = { evals: 0, budget: opts.budget || 600000, tiny: 0 };
    const V = [];
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) V.push(G(C(ox + i * h, oy + j * h)));
    ctx.evals += V.length;
    const mags = V.filter(fin).map(absC).sort((a, b) => a - b);
    const typical = mags.length ? mags[mags.length >> 1] : 1;
    ctx.tiny = 1e-13 * typical;
    const vz = (i, j) => C(ox + i * h, oy + j * h);
    const vg = (i, j) => V[j * (nx + 1) + i];
    const edge = (i0, j0, i1, j1) => {
      const g0 = vg(i0, j0), g1 = vg(i1, j1);
      if (!fin(g0) || !fin(g1) || absC(g0) <= ctx.tiny || absC(g1) <= ctx.tiny) return NaN;
      return track(G, vz(i0, j0), g0, vz(i1, j1), g1, ctx, 0);
    };
    const hE = [], vE = [];
    for (let j = 0; j <= ny; j++) for (let i = 0; i < nx; i++) hE.push(edge(i, j, i + 1, j));
    for (let j = 0; j < ny; j++) for (let i = 0; i <= nx; i++) vE.push(edge(i, j, i, j + 1));
    const cells = [];
    const cx = 0.5 * (B.x0 + B.x1), cy = 0.5 * (B.y0 + B.y1);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const t = hE[j * nx + i] + vE[j * (nx + 1) + i + 1] - hE[(j + 1) * nx + i] - vE[j * (nx + 1) + i];
        const x0 = ox + i * h, y0 = oy + j * h;
        const d = Math.hypot(x0 + 0.5 * h - cx, y0 + 0.5 * h - cy);
        if (Number.isNaN(t)) cells.push({ x0, y0, w: null, d });
        else {
          const w = Math.round(t / TAU);
          if (w && Math.abs(t / TAU - w) < 1e-6) cells.push({ x0, y0, w, d });
        }
      }
    }
    cells.sort((a, b) => a.d - b.d);

    const found = [];
    const inBox = (z) => z.re >= B.x0 - 1e-12 * W && z.re <= B.x1 + 1e-12 * W && z.im >= B.y0 - 1e-12 * H && z.im <= B.y1 + 1e-12 * H;
    const merge = 1e-6 * h;
    const level = new Map();   // found record -> refinement depth of the cell it came from (for truncation)
    let depthNow = 0;
    function push(z, kind, mult, approx) {
      if (!fin(z)) return;
      for (const f of found) {
        if (Math.hypot(f.z.re - z.re, f.z.im - z.im) <= merge) {
          if (f.approx && !approx) { f.z = z; f.kind = kind; f.mult = mult; delete f.approx; }
          return;
        }
      }
      const r = { z, kind, mult };
      if (approx) r.approx = true;
      found.push(r);
      level.set(r, depthNow);
    }
    const Hz = (zero) => (zero ? G : (z) => { const g = G(z); return fin(g) ? CX.inv(g) : C(0, 0); });
    // Newton's method with multiplicity m on Hf (G for a zero, 1/G for a pole), central differences of step size·1e-4
    function newton(Hf, z, m, size) {
      const hh = Math.max(size * 1e-4, 1e-14 * (1 + absC(z)));
      for (let it = 0; it < 60; it++) {
        const f0 = Hf(z);
        ctx.evals += 3;
        if (!fin(f0)) return null;
        if (f0.re === 0 && f0.im === 0) return z;
        const fp = Hf(C(z.re + hh, z.im)), fm = Hf(C(z.re - hh, z.im));
        const dv = C((fp.re - fm.re) / (2 * hh), (fp.im - fm.im) / (2 * hh));
        // a difference that rounds to 0 after a step: converged as far as the step size can tell
        if (!fin(dv) || (dv.re === 0 && dv.im === 0)) return it ? z : null;
        const st = CX.scale(CX.div(f0, dv), m);
        if (!fin(st)) return null;
        z = C(z.re - st.re, z.im - st.im);
        if (absC(st) <= 1e-15 * (absC(z) + size)) return z;
      }
      return z;
    }
    function windingRect(x0, y0, x1, y1) {
      const pts = [C(x0, y0), C(x1, y0), C(x1, y1), C(x0, y1)];
      const t = turn(G, pts, ctx, 4);
      if (!Number.isFinite(t)) return NaN;
      const w = Math.round(t / TAU);
      return Math.abs(t / TAU - w) < 1e-6 ? w : NaN;
    }
    const inside = (z, x0, y0, x1, y1, e) => z && z.re >= x0 - e && z.re <= x1 + e && z.im >= y0 - e && z.im <= y1 + e;
    const minSize = 1e-9 * (W + H);
    // winding of G around a small circle about z (the multiplicity there), or 0 when it cannot be tracked
    function circleWinding(z, rho) {
      const circ = Array.from({ length: 24 }, (_, k) => C(z.re + rho * Math.cos(TAU * k / 24), z.im + rho * Math.sin(TAU * k / 24)));
      const sctx = { evals: 0, budget: 20000, tiny: ctx.tiny };
      const t = turn(G, circ, sctx, 24);
      ctx.evals += sctx.evals;
      const wn = Number.isFinite(t) ? Math.round(t / TAU) : 0;
      return wn && Math.abs(t / TAU - wn) < 1e-6 ? wn : 0;
    }
    // the same count with 0 as a clean answer: an integer, or NaN when G cannot be tracked on the circle (it is 0,
    // infinite or jumps there). Only an exact 0 stops the tracking: next to an essential singularity |G| is
    // legitimately far below the box's typical size (|e^{1/z}| ≈ 10⁻¹⁴ at z ≈ −0.008 + 0.014i).
    function circleCount(z, rho) {
      const circ = Array.from({ length: 24 }, (_, k) => C(z.re + rho * Math.cos(TAU * k / 24), z.im + rho * Math.sin(TAU * k / 24)));
      const sctx = { evals: 0, budget: 20000, tiny: 0 };
      const t = turn(G, circ, sctx, 24);
      ctx.evals += sctx.evals;
      if (!Number.isFinite(t)) return NaN;
      const wn = Math.round(t / TAU);
      return Math.abs(t / TAU - wn) < 1e-6 ? wn : NaN;
    }
    // Is the Newton result z a zero or pole of G, or does |G| merely underflow or overflow there (next to an
    // essential singularity, where Newton's verification against the cell corners is fooled)? Counts on circles
    // about z (radii decreasing), decided by the smallest ones that can be tracked: a nonzero count there is the
    // answer (its multiplicity, negative for a pole); 0 on the two smallest says there is nothing there; a lone 0,
    // or 0 after a nonzero count, is 'unsure'. No circle tracked: 'jump' when G is finite and nonzero all round the
    // smallest (a branch cut crosses it: √(z − 1) at 1), 'unsure' when it overflows or underflows there.
    function confirm(z, radii) {
      const T = [];
      for (const rho of radii) { const c = circleCount(z, rho); if (!Number.isNaN(c)) T.push(c); }
      if (!T.length) {
        const rho = radii[radii.length - 1];
        for (let k = 0; k < 24; k++) {
          const g = G(C(z.re + rho * Math.cos(TAU * k / 24), z.im + rho * Math.sin(TAU * k / 24)));
          ctx.evals++;
          if (!fin(g) || (g.re === 0 && g.im === 0)) return 'unsure';
        }
        return 'jump';
      }
      const last = T[T.length - 1];
      if (last) return last;
      return T.length >= 2 && T[T.length - 2] === 0 ? 0 : 'unsure';
    }
    // Newton from the centre of a cell, for the kind the cell's count says first (with multiplicity m), then the
    // other kind; a result counts only inside the cell and verified against the size of G at the corners:
    // |G| tiny for a zero, huge (or infinite) for a pole. squares: also Newton on G² and 1/G², which converges at
    // the branch points of square-root type (√(z − 1) at 1), where the cell boundary could not be tracked.
    function find(x0, y0, x1, y1, zeroFirst, m, e, squares) {
      const size = Math.max(x1 - x0, y1 - y0), c = C(0.5 * (x0 + x1), 0.5 * (y0 + y1));
      const sc = Math.max(1e-300, ...[C(x0, y0), C(x1, y0), C(x1, y1), C(x0, y1)].map((z) => { const g = G(z); return fin(g) ? absC(g) : 0; }));
      ctx.evals += 4;
      const tries = [[zeroFirst, m, 1], [!zeroFirst, 1, 1]];
      if (squares) tries.push([true, 1, 2], [false, 1, 2]);
      for (const [zero, mm, pw] of tries) {
        const H0 = Hz(zero);
        const Hf = pw === 1 ? H0 : (z) => { const v = H0(z); return CX.mul(v, v); };
        const r = newton(Hf, c, mm, size);
        if (!inside(r, x0, y0, x1, y1, e)) continue;
        const g = G(r);
        ctx.evals++;
        const lim = pw === 1 ? 1e-8 : 1e-6;
        if (zero ? fin(g) && absC(g) <= lim * sc : !fin(g) || absC(g) * lim >= sc) return { r, zero, approx: zero !== zeroFirst || pw !== 1 };
      }
      return null;
    }
    // one cell with count w: a verified simple root settles it; otherwise its sub-cells with nonzero counts go to
    // the next level (next), or it settles as a multiple root when tiny or when the sub-counts do not add up
    function resolve(x0, y0, x1, y1, w, depth, next) {
      if (ctx.evals > ctx.budget) { out.incomplete = true; return; }
      const size = Math.max(x1 - x0, y1 - y0), e = 0.05 * size;
      const kind = w > 0 ? 'zero' : 'pole', m = Math.abs(w);
      // the smallest cell: a multiple zero or pole (Newton may stop short of it, so the cell centre stands in),
      // confirmed by the count on a circle around it; an accumulation point (e^{1/z} at 0) fails that and is skipped
      const radii = [0.25 * size, 0.05 * size, 0.01 * size];
      const settle = () => {
        const f = find(x0, y0, x1, y1, w > 0, m, 2 * e, false);
        if (f && f.approx) {
          const c = confirm(f.r, radii);
          if (c === 'jump' || (typeof c === 'number' && c && (c > 0) === f.zero)) push(f.r, f.zero ? 'zero' : 'pole', 1, true);
          else if (c !== 0) out.incomplete = true;
          return;
        }
        if (!f && m === 1) { out.incomplete = true; return; }
        if (m === 1) {
          const c = confirm(f.r, radii);
          if (c === w || c === 'jump') push(f.r, kind, 1);
          else out.incomplete = true;
          return;
        }
        const z = f ? f.r : C(0.5 * (x0 + x1), 0.5 * (y0 + y1));
        if (circleWinding(z, 2 * size) !== w) { out.incomplete = true; return; }
        push(z, kind, m);
      };
      if (m === 1) {
        const f = find(x0, y0, x1, y1, w > 0, 1, e, false);
        // confirmed by small circles about it (else the cell is split further)
        if (f && !f.approx) { const c = confirm(f.r, radii); if (c === w || c === 'jump') { push(f.r, kind, 1); return; } }
      }
      if (size < minSize || depth >= 40) { settle(); return; }
      const sx = x0 + 0.4870337 * (x1 - x0), sy = y0 + 0.5129663 * (y1 - y0);
      const sub = [[x0, y0, sx, sy], [sx, y0, x1, sy], [x0, sy, sx, y1], [sx, sy, x1, y1]];
      const ws = sub.map((s) => windingRect(...s));
      if (ws.some(Number.isNaN) || ws.reduce((a, b) => a + b, 0) !== w) { settle(); return; }
      sub.forEach((s, k) => {
        if (ws[k]) next.push({ x0: s[0], y0: s[1], x1: s[2], y1: s[3], w: ws[k], d: Math.hypot(0.5 * (s[0] + s[2]) - cx, 0.5 * (s[1] + s[3]) - cy) });
      });
    }
    // a cell whose boundary could not be tracked (a root, pole or branch cut on it): Newton from its centre, kept
    // when verified and confirmed by the counts on small circles about it (confirm(), which also gives the
    // multiplicity). Counts of 0 mean there is no root there: |G| merely underflows, as e^{1/z} does next to its
    // essential singularity at 0. When a branch cut crosses every circle (√(z − 1) at 1) the verified Newton result
    // is kept as approx; when G overflows or underflows all round, or the counts disagree with Newton, the search
    // is incomplete.
    function probe(x0, y0) {
      const f = find(x0, y0, x0 + h, y0 + h, true, 1, 0.02 * h, true);
      if (!f) return;
      const kind = f.zero ? 'zero' : 'pole';
      const c = confirm(f.r, [0.25 * h, 0.05 * h, 0.01 * h, 0.002 * h]);
      if (c === 'jump') push(f.r, kind, 1, true);
      else if (typeof c === 'number' && c && (c > 0) === f.zero) push(f.r, kind, Math.abs(c));
      else if (c !== 0) out.incomplete = true;
    }
    // level by level: every cell of one size (nearest the centre first) before any smaller one
    let todo = cells.map((c) => ({ x0: c.x0, y0: c.y0, x1: c.x0 + h, y1: c.y0 + h, w: c.w, d: c.d }));
    search: for (depthNow = 0; todo.length; depthNow++) {
      const next = [];
      for (const cell of todo) {
        if (found.filter((f) => inBox(f.z)).length > max) { out.truncated = true; break search; }
        if (ctx.evals > ctx.budget) { out.incomplete = true; break search; }
        if (cell.w == null) probe(cell.x0, cell.y0);
        else resolve(cell.x0, cell.y0, cell.x1, cell.y1, cell.w, depthNow, next);
      }
      next.sort((a, b) => a.d - b.d);
      todo = next;
    }
    let res = found.filter((f) => inBox(f.z));
    if (res.length > max) {
      // the coarsest level first (well-separated roots), then nearest the centre
      res.sort((a, b) => level.get(a) - level.get(b) || Math.hypot(a.z.re - cx, a.z.im - cy) - Math.hypot(b.z.re - cx, b.z.im - cy));
      res = res.slice(0, max);
      out.truncated = true;
    }
    // Taylor coefficients c_0 … c_K of Hf about z from N samples on |ζ − z| = rho (the trapezoidal rule), or null
    function taylor(Hf, z, rho, K, N = 32) {
      const sr = new Float64Array(K + 1), si = new Float64Array(K + 1);
      for (let k = 0; k < N; k++) {
        const t = TAU * k / N;
        const g = Hf(C(z.re + rho * Math.cos(t), z.im + rho * Math.sin(t)));
        if (!fin(g)) return null;
        for (let j = 0; j <= K; j++) { const cr = Math.cos(j * t), ci = -Math.sin(j * t); sr[j] += g.re * cr - g.im * ci; si[j] += g.re * ci + g.im * cr; }
      }
      ctx.evals += N;
      const out = [];
      for (let j = 0; j <= K; j++) { const s = N * Math.pow(rho, j); out.push(C(sr[j] / s, si[j] / s)); }
      return out;
    }
    // A zero (or pole) of multiplicity m ≥ 2 is a simple zero of the (m−1)-th derivative of Hf: Newton on that, with
    // the derivatives from Taylor coefficients on two circles (radius rho and rho/2: they agree only when no
    // singularity is near). Accurate to about rounding/rho^(m−1), wherever the cell search left it (Newton on Hf
    // itself stalls at about √ε, at a point that depends on the view box). null when the circles disagree.
    function polishMultiple(Hf, z0, m, rho0) {
      for (let rho = rho0, tries = 0; tries < 10; tries++, rho *= 0.25) {
        let z = z0, ok = true;
        for (let it = 0; it < 8; it++) {
          const a = taylor(Hf, z, rho, m), b = a && taylor(Hf, z, 0.5 * rho, m);
          const s1 = a && CX.div(a[m - 1], CX.scale(a[m], m)), s2 = b && CX.div(b[m - 1], CX.scale(b[m], m));
          if (!fin(s1) || !fin(s2) || absC(CX.sub(s1, s2)) > 1e-6 * rho || absC(s1) > 0.25 * rho) { ok = false; break; }
          z = C(z.re - s1.re, z.im - s1.im);
          if (absC(s1) <= 1e-13 * rho) break;
        }
        if (ok) return z;
      }
      return null;
    }
    // polish: Newton with the found multiplicity and a fine difference step (a double root of z² came out
    // as −6×10⁻⁷ from the coarse cell search); a multiple one as a simple zero of a derivative (above)
    for (const r of res) {
      const m = Math.max(1, r.mult || 1), zero = r.kind !== 'pole';
      const Hf = Hz(zero), g0 = Hf(r.z);
      if (!fin(g0)) continue;
      if (m > 1 && !r.approx) {
        const z3 = polishMultiple(Hf, r.z, m, 1e-3 * (W + H));
        if (z3 && fin(z3) && absC(CX.sub(z3, r.z)) <= 1e-3 * (W + H)) { r.z = z3; continue; }
      }
      const z2 = newton(Hf, r.z, m, 1e-6 * (W + H));
      if (!z2 || !fin(z2) || absC(CX.sub(z2, r.z)) > 1e-3 * (W + H)) continue;
      const g2 = Hf(z2);
      if (fin(g2) && absC(g2) <= absC(g0)) r.z = z2;
    }
    const q = 1e-7 * W;
    res.sort((a, b) => Math.round(a.z.re / q) - Math.round(b.z.re / q) || b.z.im - a.z.im);
    out.push(...res);
    out.evals = ctx.evals;
    return out;
  }

  // ---------------- the Cauchy integral by the residue theorem (issue #235) ----------------
  // For F meromorphic on and inside the closed polygon γ, with poles p_k (none on γ), and z off γ and not a pole,
  //   (1/2πi) ∮γ F(ζ)/(ζ − z) dζ = n(γ, z) F(z) − Σ_k n(γ, p_k) PP_{p_k}(z),
  // PP_p the principal part of F at p, n the winding number (the residue of F(ζ)/(ζ − z) at p is −PP_p(z)). No integral
  // over γ is needed, and n counts exactly, for a hand-drawn or self-crossing curve too. cauchyPlan finds the data
  // (poles inside, their orders and principal parts), and checks it against the quadrature at a few points: where F
  // has a singularity that the pole count does not cover (e^(1/z)) or a branch cut, the check fails and the caller
  // keeps the quadrature (cauchyNodes).
  // the winding number of a closed polygon about z (an integer; z off the polygon): the signed crossings of the ray
  // from z towards +Re, counted by the half-open rule so a vertex on the ray is counted once
  function windingAt(pts, z) {
    let w = 0;
    const n = pts.length;
    for (let k = 0; k < n; k++) {
      const a = pts[k], b = pts[(k + 1) % n];
      const side = (b.re - a.re) * (z.im - a.im) - (z.re - a.re) * (b.im - a.im);
      if (a.im <= z.im) { if (b.im > z.im && side > 0) w++; }
      else if (b.im <= z.im && side < 0) w--;
    }
    return w;
  }
  // (over several closed polygons, a region's boundary and its holes: the winding numbers add)
  const windingSum = (loops, z) => loops.reduce((w, l) => w + windingAt(l, z), 0);
  const distToLoops = (loops, z) => Math.min(...loops.map((l) => distToLoop(l, z)));
  function distToLoop(pts, z) {
    let d = Infinity;
    const n = pts.length;
    for (let k = 0; k < n; k++) {
      const a = pts[k], b = pts[(k + 1) % n], dx = b.re - a.re, dy = b.im - a.im, L = dx * dx + dy * dy;
      const t = L > 0 ? Math.max(0, Math.min(1, ((z.re - a.re) * dx + (z.im - a.im) * dy) / L)) : 0;
      d = Math.min(d, Math.hypot(z.re - a.re - t * dx, z.im - a.im - t * dy));
    }
    return d;
  }
  // a closed polygon with no vertex farther than tol from the simplified one (Douglas–Peucker from the vertex nearest
  // the centre of mass's far side): the winding number of any point more than tol from the polygon is unchanged
  function simplifyLoop(poly, tol) {
    const pts = loop(poly), n = pts.length;
    if (n <= 4 || !(tol > 0)) return pts;
    let far = 0, fd = -1;
    for (let k = 1; k < n; k++) { const d = Math.hypot(pts[k].re - pts[0].re, pts[k].im - pts[0].im); if (d > fd) { fd = d; far = k; } }
    const keep = new Uint8Array(n);
    keep[0] = 1; keep[far] = 1;
    const run = (i0, i1) => {   // the open chain pts[i0..i1] (indices mod n), iteratively
      const stack = [[i0, i1]];
      while (stack.length) {
        const [lo, hi] = stack.pop();
        if (hi - lo < 2) continue;
        const A = pts[lo % n], B = pts[hi % n], dx = B.re - A.re, dy = B.im - A.im, L = Math.hypot(dx, dy);
        let m = -1, md = tol;
        for (let k = lo + 1; k < hi; k++) {
          const Q = pts[k % n];
          const d = L > 0 ? Math.abs((Q.re - A.re) * dy - (Q.im - A.im) * dx) / L : Math.hypot(Q.re - A.re, Q.im - A.im);
          if (d > md) { md = d; m = k; }
        }
        if (m >= 0) { keep[m % n] = 1; stack.push([lo, m], [m, hi]); }
      }
    };
    run(0, far); run(far, n);
    return pts.filter((_, k) => keep[k]);
  }
  // the principal part of F at p (order m): a_{-j} = (1/2πi) ∮ F(ζ)(ζ − p)^(j−1) dζ = mean of F(p + r e^(iθ)) r^j e^(ijθ),
  // by the trapezoid rule on a circle with no other singularity inside, which converges geometrically. coefs[j − 1]
  // = a_{-j}, for j = 1 … m + 1 (the last one should vanish: the check that the order is right)
  function laurentCoefs(F, p, r, m, N = 64) {
    const out = [];
    for (let j = 1; j <= m + 1; j++) out.push(C(0, 0));
    for (let t = 0; t < N; t++) {
      const th = TAU * t / N, c = Math.cos(th), s = Math.sin(th), w = F(C(p.re + r * c, p.im + r * s));
      if (!fin(w)) return null;
      for (let j = 1; j <= m + 1; j++) {
        const cj = Math.cos(j * th), sj = Math.sin(j * th), rj = Math.pow(r, j);
        out[j - 1].re += rj * (w.re * cj - w.im * sj) / N;
        out[j - 1].im += rj * (w.re * sj + w.im * cj) / N;
      }
    }
    return out;
  }
  function ppAt(coefs, p, z) {
    let re = 0, im = 0;
    const dx = z.re - p.re, dy = z.im - p.im, d2 = dx * dx + dy * dy;
    let ur = dx / d2, ui = -dy / d2, pr = 1, pi = 0;   // 1/(z − p), and its powers
    for (const a of coefs) {
      const tr = pr * ur - pi * ui, ti = pr * ui + pi * ur;
      pr = tr; pi = ti;
      re += a.re * pr - a.im * pi; im += a.re * pi + a.im * pr;
    }
    return C(re, im);
  }
  // -> {ok: true, pts, poles: [{z, order, n, a: [{re, im} × order]}], probes} | {ok: false, why}: why 'curve' (no
  // closed polygon), 'onCurve' (F is not finite on γ, or a pole lies on it: the integral is not defined),
  // 'unverified' (the formula disagrees with the quadrature: a singularity of a kind the pole count does not cover,
  // a branch cut, a missed pole). opts.max (poles, default 32), opts.tol (the check, default 1e-6)
  function cauchyPlan(F, poly, opts = {}) {
    // poly: one closed polygon, or {loops: [polygon, ...]} (a region's boundary and its holes: the winding numbers add)
    const loops = (poly && poly.loops ? poly.loops : [poly]).map(loop).filter((l) => l.length >= 3);
    if (!loops.length) return { ok: false, why: 'curve' };
    const bb = boxOf(loops);
    if (!(bb.scale > 0) || !Number.isFinite(bb.scale)) return { ok: false, why: 'curve' };
    // F finite on γ (the vertices and the midpoints of the edges)
    for (const pts of loops) for (let k = 0; k < pts.length; k++) {
      const a = pts[k], b = pts[(k + 1) % pts.length];
      if (!fin(F(a)) || !fin(F(C(0.5 * (a.re + b.re), 0.5 * (a.im + b.im))))) return { ok: false, why: 'onCurve' };
    }
    // zerosPoles can miss a pole that lies close to a zero (their turns cancel in a cell): a finer grid finds it, so the
    // check below, which notices the miss, is tried again on a finer one before the plan gives up
    /** @type {any} */
    let last = { ok: false, why: 'unverified' };
    for (const grid of opts.grids || [32, 64, 128, 256]) {
      last = planWith(F, loops, bb, grid, opts);
      if (last.ok || last.why !== 'unverified') return last;
    }
    // (what the fast path keeps: this F and curve do not verify, until the next full check)
    last.memo = { box: expandBox(bb), all: [], verdict: 'unverified' };
    return last;
  }
  function boxOf(loops) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const l of loops) for (const q of l) { x0 = Math.min(x0, q.re); x1 = Math.max(x1, q.re); y0 = Math.min(y0, q.im); y1 = Math.max(y1, q.im); }
    const W = x1 - x0, H = y1 - y0;
    return { x0, x1, y0, y1, W, H, scale: Math.hypot(W, H) };
  }
  // the box the poles are looked for in: the curve's, a quarter of its size wider on each side, so that a curve that is
  // dragged a little (or grows) finds the poles it newly takes in without another search
  const expandBox = (bb) => { const pad = 0.25 * Math.max(bb.W, bb.H) + 1e-3 * bb.scale; return { x0: bb.x0 - pad, x1: bb.x1 + pad, y0: bb.y0 - pad, y1: bb.y1 + pad }; };
  // the principal part at a pole of order m on a circle of radius r, or null when F is not finite there or its a_{-(m+1)}
  // does not vanish (the order is not m)
  function principalPart(F, z, r, order) {
    const a = laurentCoefs(F, z, r, order);
    if (!a) return null;
    const top = a.pop();   // a_{-(m+1)}: zero when the order is m; compared on the circle, where term j weighs |a_j| r^-j
    const termMax = Math.max(...a.map((c, j) => CX.abs(c) * Math.pow(r, -(j + 1))), 1e-300);
    return CX.abs(top) * Math.pow(r, -(order + 1)) > 1e-6 * termMax ? null : a;
  }
  // the radius of the circle for a pole's principal part: a third of the way to the nearest other pole, or to the edge
  // of the box the poles were looked for in (a singularity beyond it is no nearer than that)
  function ringOf(q, all, box) {
    let R = Infinity;
    for (const f of all) if (f !== q) R = Math.min(R, Math.hypot(f.z.re - q.z.re, f.z.im - q.z.im));
    const wide = Math.max(box.x1 - box.x0, box.y1 - box.y0), edge = Math.min(q.z.re - box.x0, box.x1 - q.z.re, q.z.im - box.y0, box.y1 - q.z.im);
    if (edge > 1e-6 * wide) R = Math.min(R, edge);
    return 0.3 * (Number.isFinite(R) ? R : wide);
  }
  function planWith(F, loops, bb, grid, opts) {
    const { x0, x1, y0, y1, W, H, scale } = bb;
    const max = opts.max || 32, tol = opts.tol || 1e-6;
    // the poles in the curve's box (and a margin), their principal parts, and those the curve winds round
    const box = expandBox(bb);
    let found = [];
    try { found = zerosPoles(F, box, { max: max + 8, grid }).filter((f) => f.kind === 'pole'); } catch (e) { found = []; }
    if (found.length > max) return { ok: false, why: 'unverified' };
    const all = found.map((f) => ({ z: f.z, order: Math.max(1, f.mult || 1), a: null, r: 0 }));
    // (a pole the curve does not wind round has no term: if its principal part cannot be found (a branch point close to
    // it) that does not spoil the plan; the fast path asks for the plan in full if the curve takes it in)
    for (const q of all) { q.r = ringOf(q, all, box); q.a = principalPart(F, q.z, q.r, q.order); }
    const inside = [];
    for (const q of all) {
      if (distToLoops(loops, q.z) <= 1e-7 * scale) return { ok: false, why: 'onCurve' };
      const wn = windingSum(loops, q.z);
      if (wn) { if (!q.a) return { ok: false, why: 'unverified' }; inside.push({ z: q.z, order: q.order, n: wn, a: q.a }); }
    }
    const ppSum = (z) => { let re = 0, im = 0; for (const q of inside) { const v = ppAt(q.a, q.z, z); re += q.n * v.re; im += q.n * v.im; } return C(re, im); };
    // the check against the quadrature: four points outside γ (Φ = −Σ n PP), two inside (Φ = n F − Σ n PP). A long thin
    // curve may get no inside point; the outside points alone check the principal parts, which is what matters
    const probes = [];
    const c0 = C(0.5 * (x0 + x1), 0.5 * (y0 + y1));
    for (let k = 0; k < 4; k++) {
      for (let f = 1.2; f < 40; f *= 1.6) {
        const z = C(c0.re + f * scale * Math.cos(0.4 + k * Math.PI / 2), c0.im + f * scale * Math.sin(0.4 + k * Math.PI / 2));
        if (windingSum(loops, z) === 0 && distToLoops(loops, z) > 0.05 * scale) { probes.push(z); break; }
      }
    }
    let nIn = 0;
    for (let i = 0; i < 12 && nIn < 2; i++) for (let j = 0; j < 12 && nIn < 2; j++) {
      const z = C(x0 + (i + 0.37) * W / 12, y0 + (j + 0.61) * H / 12);
      if (windingSum(loops, z) !== 0 && distToLoops(loops, z) > 0.03 * scale && inside.every((q) => Math.hypot(q.z.re - z.re, q.z.im - z.im) > 0.03 * scale)) { probes.push(z); nIn++; }
    }
    const worst = [];
    for (const z of probes) {
      let q = C(0, 0), qb = 0;
      for (const l of loops) { const v = cauchy(F, l, z); q = C(q.re + v.re, q.im + v.im); qb += v.errBound || 0; }
      if (!fin(q)) return { ok: false, why: 'unverified' };
      q.errBound = qb;
      const nz = windingSum(loops, z), pp = ppSum(z);
      let e = C(-pp.re, -pp.im);
      if (nz) { const fz = F(z); if (!fin(fz)) continue; e = C(nz * fz.re - pp.re, nz * fz.im - pp.im); }
      const err = Math.hypot(q.re - e.re, q.im - e.im);
      worst.push(err);
      if (!(err <= tol * (1 + Math.hypot(q.re, q.im)) + (q.errBound || 0) * 10)) return { ok: false, why: 'unverified' };
    }
    return { ok: true, loops, poles: inside, probes: worst, memo: { box, all, verdict: 'ok' } };
  }
  // The same plan for the same F and a curve that moved or changed (a drag, an edit), without the search or the check:
  // the poles and their principal parts are F's alone, so only the winding numbers are counted again. memo is what
  // cauchyPlan or the last call returned (its .memo); null when the curve has left the box the poles were looked for in
  // (the caller then plans in full). The plan is as good as the last full one until the curve takes in a pole the search
  // missed, which the check, run again at rest, finds. An F and curve that did not verify stay unverified.
  function cauchyPlanFast(F, poly, memo) {
    const loops = (poly && poly.loops ? poly.loops : [poly]).map(loop).filter((l) => l.length >= 3);
    if (!loops.length || !memo) return null;
    const bb = boxOf(loops), B = memo.box;
    if (!(bb.scale > 0) || bb.x0 < B.x0 || bb.x1 > B.x1 || bb.y0 < B.y0 || bb.y1 > B.y1) return null;
    if (memo.verdict !== 'ok') return { ok: false, why: 'unverified', fast: true, memo };
    const inside = [];
    for (const q of memo.all) {
      if (distToLoops(loops, q.z) <= 1e-7 * bb.scale) return { ok: false, why: 'onCurve', fast: true, memo };
      const wn = windingSum(loops, q.z);
      if (wn) { if (!q.a) return null; inside.push({ z: q.z, order: q.order, n: wn, a: q.a }); }
    }
    return { ok: true, loops, poles: inside, probes: [], fast: true, memo };
  }
  // The memo for an F that changed a little (a slider): each pole is followed by Newton's method on 1/F from where it was,
  // and its principal part is found again. null when a pole moved far, or a principal part no longer has its order:
  // the caller then plans in full.
  function cauchyTrack(F, memo) {
    if (!memo) return null;
    if (memo.verdict !== 'ok') return memo;
    const all = [];
    for (const q of memo.all) {
      let z = q.z;
      for (let it = 0; it < 12; it++) {
        const f0 = F(z);
        if (!fin(f0)) return null;
        const h = 1e-6 * (1 + CX.abs(z)), g = (w) => { const v = F(w); return CX.div(C(1, 0), v); };
        const g0 = g(z), gp = g(C(z.re + h, z.im)), gm = g(C(z.re - h, z.im));
        if (!fin(g0) || !fin(gp) || !fin(gm)) return null;
        const d = C((gp.re - gm.re) / (2 * h), (gp.im - gm.im) / (2 * h));
        if (CX.abs(d) < 1e-300) return null;
        // (1/F has a zero of the pole's order m there: Newton's step to it is 1/m of the way, so m times the step)
        const st = CX.scale(CX.div(g0, d), q.order);
        z = C(z.re - st.re, z.im - st.im);
        if (CX.abs(st) < 1e-9 * (1 + CX.abs(z))) break;   // (Newton converges quadratically: this step leaves an error far below rounding)
        if (it === 11) return null;
      }
      if (Math.hypot(z.re - q.z.re, z.im - q.z.im) > 0.3 * q.r) return null;
      all.push({ z, order: q.order, a: null, r: q.r });
    }
    for (const q of all) {
      q.r = ringOf(q, all, memo.box);
      q.a = principalPart(F, q.z, q.r, q.order);
      if (!q.a && memo.all.find((o) => o.z && Math.hypot(o.z.re - q.z.re, o.z.im - q.z.im) < 0.3 * o.r && o.a)) return null;   // (one that had a principal part and has none: the order changed)
    }
    return { box: memo.box, all, verdict: 'ok' };
  }
  // Φ(z) from a plan: n F(z) − Σ n PP (z off γ and not a pole), the CPU twin of the plot, for tests and the captions
  function cauchyValue(F, plan, z) {
    const nz = windingSum(plan.loops, z);
    let re = 0, im = 0;
    if (nz) { const f = F(z); re = nz * f.re; im = nz * f.im; }
    for (const q of plan.poles) { const v = ppAt(q.a, q.z, z); re -= q.n * v.re; im -= q.n * v.im; }
    return C(re, im);
  }

  return { lineIntegral, argPrinciple, cauchy, residue, zerosPoles, cauchyNodes, cauchyPlan, cauchyPlanFast, cauchyTrack, cauchyValue, windingAt, windingSum, simplifyLoop, laurentCoefs, points, argStep, orderAt };
})();
import { CX } from './cx.js';
export { Calc, Calc as 'module.exports' };
