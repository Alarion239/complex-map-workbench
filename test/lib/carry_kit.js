// The carried-colour suites' shared page script and pixel compare: steps_carry_inregion_cmd.js, steps_carry_far_cmd.js,
// steps_carry_chains_cmd.js and steps_carry_planes_cmd.js. The left pane's pixels come from the page's __cmwLPx; the
// rest is the pane's camera, the nearest of a point's 9 pixels to a reference and the bare-paper test (the example names are the
// CDP kit's exampleNames()).
// An expression for eval in a suite, which supplies ev, fs and DIR: `const K = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'carry_kit.js'), 'utf8'))`.
// - lpx(pts): __cmwLPx(pts) answers { view, dpr, pw, ph, px }: for each plane point [x, y], the 3 x 3 device pixels about
//   it as [r, g, b, a] each, row by row (the centre is index 4), or null off the pane;
// - paneOf(): the pane's camera (v: the view, with cx, cy, s) and its size in css px (w, h);
// - nearest(p, ref): the least, over the 9 pixels ref of a point, of the largest channel difference (0..255) from p;
// - bare(p): whether the centre pixel p (of a 3 x 3 read) is bare paper, its channels within 6 of each other;
// - tally(got, ref, o): over the points k with got[k] and ref[k] both read (and not o.skip(k)), the count n of those, how
//   many are wrong (nearest() over o.tol, default 14, from the 3 x 3 reference), how many sit on bare paper, the worst
//   nearest(), and up to 6 examples (o.note(k) adds its fields to each): { n, wrong, paper, worst, ex };
// - bareCount(px): { n, paper }, the points of a read that are on the page and the ones of them on bare paper;
// - grid(P, nx, ny, frac): an nx x ny grid of plane points over the middle frac (default 0.8) of the pane P;
// - shown(P, z): whether z is inside the middle 90 % of the pane P, where a reference of plane z shows it;
// - fronts(lists, b, sing, t): for each list of points z, the index of the front one under the steps view's sheet key of
//   plane b (Inverse.sheetKey and Inverse.front in the page, with the key's period; t: the glide's key at t, __cmwSvKey(b,
//   t); sing: the key's points in place of the key's own), -1 for none;
// - joukPath(outside, leave): the Joukowski airfoil's path H_t (tanh((1 + t) artanh z - i pi t / 2) on the disc,
//   coth((1 + t) arcoth z) outside it) for the region outside the circle that `outside` measures: candAt(t)(w) the points
//   z at w along H_t, each branch's inverse over k, kept where H_t gives w back (within 1e-7), each as { z, name, out }
//   with out set near the circle's outline (0.12) and where leave(z, w) (none by default); poleAt(t) the key's points at t, plane w1's
//   (z = 0) and the path's pole on the disc, -i tan(pi (1 - t) / (2 (1 + t))), there from t = 1/3 on;
// - chainPoints(steps, box): a chain's points by its steps' inverses (steps: the page's { type, params }, of exp, sin,
//   pown with n > 0 and mobius with real or imaginary parameters), as cand(w, b): the points z of box { x0, x1, y0, y1 } that the
//   steps before plane b take to w, each as { z } (every period of exp and sin within reach, kept where the forward map
//   gives w back within 1e-7);
// - carryRead(env): measure(), the front point's colour on a plane against plane z's (below, at its definition).
(() => {
  // (a page hook that throws answers { __exc }, which fails the suite here rather than reading as no pixels)
  const lpx = async (pts) => { const r = await ev(`__cmwLPx(${JSON.stringify(pts)})`); if (r && r.__exc !== undefined) throw new Error('lpx failed: ' + r.__exc); return r; };
  const paneOf = async () => { const q = await lpx([]); return { v: q.view, w: q.pw / q.dpr, h: q.ph / q.dpr }; };
  const nearest = (p, ref) => {
    let best = 1e9;
    for (const q of ref) best = Math.min(best, Math.max(Math.abs(p[0] - q[0]), Math.abs(p[1] - q[1]), Math.abs(p[2] - q[2])));
    return best;
  };
  const bare = (p) => Math.max(p[0], p[1], p[2]) - Math.min(p[0], p[1], p[2]) < 6;
  const tally = (got, ref, o = {}) => {
    const tol = o.tol == null ? 14 : o.tol, ex = [];
    let n = 0, wrong = 0, paper = 0, worst = 0;
    for (let k = 0; k < got.length; k++) {
      if ((o.skip && o.skip(k)) || !got[k] || !ref[k]) continue;
      n++;
      const p = got[k][4], best = nearest(p, ref[k]);
      if (bare(p)) { paper++; if (ex.length < 6) ex.push(Object.assign({ paper: true, got: p.slice(0, 3) }, o.note && o.note(k))); }
      worst = Math.max(worst, best);
      if (best > tol) { wrong++; if (ex.length < 6) ex.push(Object.assign({ got: p.slice(0, 3), want: ref[k][4].slice(0, 3) }, o.note && o.note(k))); }
    }
    return { n, wrong, paper, worst, ex };
  };
  const bareCount = (px) => ({ n: px.filter(Boolean).length, paper: px.filter((q) => q && bare(q[4])).length });
  const grid = (P, nx, ny, frac = 0.8) => {
    const out = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) out.push([P.v.cx + (i / (nx - 1) - 0.5) * frac * P.w / P.v.s, P.v.cy + (j / (ny - 1) - 0.5) * frac * P.h / P.v.s]);
    return out;
  };
  const shown = (P, z) => Math.abs(z[0] - P.v.cx) <= 0.45 * P.w / P.v.s && Math.abs(z[1] - P.v.cy) <= 0.45 * P.h / P.v.s;
  const fronts = async (lists, b, sing, t) => {
    const r = await ev(`(() => {
      const k = Object.assign(__cmwSvKey(${b}${t != null ? `, ${t}` : ''}), ${sing ? `{ sing: ${JSON.stringify(sing)} }` : '{}'});
      const prep = { win: k.win, R: k.R, rs: k.rs, sing: k.sing.map((p) => CX.C(p[0], p[1])), per: k.per && CX.C(k.per[0], k.per[1]) };
      return ${JSON.stringify(lists)}.map((L) => {
        let bi = -1, bc = null;
        L.forEach((p, i) => { const z = CX.C(p[0], p[1]), c = { z, D: Inverse.sheetKey(prep, z, null), lam: null }; if (!bc || Inverse.front(c, bc)) { bc = c; bi = i; } });
        return bi;
      });
    })()`);
    if (r && r.__exc !== undefined) throw new Error('fronts failed: ' + r.__exc);
    return r;
  };
  const joukPath = (outside, leave = () => false) => {
    const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
    const div = (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
    const lg = (a) => [Math.log(Math.hypot(a[0], a[1])), Math.atan2(a[1], a[0])];
    const ex = (a) => [Math.exp(a[0]) * Math.cos(a[1]), Math.exp(a[0]) * Math.sin(a[1])];
    const atanh = (z) => { const l = lg(div([1 + z[0], z[1]], [1 - z[0], -z[1]])); return [l[0] / 2, l[1] / 2]; };
    const tanh = (y) => { const e = ex([2 * y[0], 2 * y[1]]); return div([e[0] - 1, e[1]], [e[0] + 1, e[1]]); };
    const inv = (z) => div([1, 0], z);
    const Ht = (t) => (z) => (z[0] * z[0] + z[1] * z[1] < 1
      ? tanh([(1 + t) * atanh(z)[0], (1 + t) * atanh(z)[1] - Math.PI / 2 * t])
      : inv(tanh(mul([1 + t, 0], atanh(inv(z))))));
    // (HIT: the float error of the inverse and forward formulas; two candidates within SAME are one point)
    const HIT = 1e-7, SAME = 1e-9, OUTLINE = 0.12;
    const candAt = (t) => (w) => {
      const out = [], aw = atanh(w), ac = atanh(inv(w)), H = Ht(t);
      for (let k = -3; k <= 3; k++) {
        const disc = tanh([aw[0] / (1 + t), (aw[1] + Math.PI / 2 * t + Math.PI * k) / (1 + t)]);
        const ext = inv(tanh([ac[0] / (1 + t), (ac[1] + Math.PI * k) / (1 + t)]));
        for (const [name, z] of [['d' + k, disc], ['e' + k, ext]]) {
          if (!z.every(Number.isFinite)) continue;
          const h = H(z);
          if (Math.hypot(h[0] - w[0], h[1] - w[1]) > HIT || out.some((e) => Math.hypot(e.z[0] - z[0], e.z[1] - z[1]) < SAME)) continue;
          out.push({ z, name, out: Math.abs(outside(z)) < OUTLINE || leave(z, w) });
        }
      }
      return out;
    };
    const poleAt = (t) => (t > 1 / 3 ? [[0, 0], [0, -Math.tan(Math.PI * (1 - t) / (2 * (1 + t)))]] : [[0, 0]]);
    return { candAt, poleAt };
  };
  // a complex number of a Möbius parameter: a real number ('1', '-0.5') or an imaginary one ('i', '-i', '2i')
  const cnum = (s) => {
    const t = String(s).trim();
    if (!t.endsWith('i')) return [+t, 0];
    const m = t.slice(0, -1);
    return [0, m === '' || m === '+' ? 1 : m === '-' ? -1 : +m];
  };
  // complex arithmetic on [re, im] pairs, for chainPoints
  const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
  const cdiv = (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
  const clog = (a) => [Math.log(Math.hypot(a[0], a[1])), Math.atan2(a[1], a[0])];
  const csqrt = (a) => { const r = Math.hypot(a[0], a[1]), x = Math.sqrt(Math.max(0, (r + a[0]) / 2)), y = Math.sqrt(Math.max(0, (r - a[0]) / 2)); return [x, a[1] < 0 ? -y : y]; };
  // asin w = -i log(i w + sqrt(1 - w^2))
  const casin = (w) => { const w2 = cmul(w, w), r = csqrt([1 - w2[0], -w2[1]]), l = clog([r[0] - w[1], r[1] + w[0]]); return [l[1], -l[0]]; };
  // the steps of a chain as forward maps and inverses: fwd(u), inv(u, R) the points v with fwd(v) = u and |v| <= R (exp and
  // sin, periodic, over every period within R)
  const TAU = 2 * Math.PI;
  const stepOf = (s) => {
    if (s.type === 'exp') return {
      fwd: (u) => [Math.exp(u[0]) * Math.cos(u[1]), Math.exp(u[0]) * Math.sin(u[1])],
      inv: (u, R) => { const l = clog(u), K = Math.ceil((R + Math.abs(l[1])) / TAU), out = []; for (let k = -K; k <= K; k++) out.push([l[0], l[1] + TAU * k]); return out; },
    };
    if (s.type === 'sin') return {
      fwd: (u) => [Math.sin(u[0]) * Math.cosh(u[1]), Math.cos(u[0]) * Math.sinh(u[1])],
      inv: (u, R) => {
        const a = casin(u), K = Math.ceil((R + Math.PI + Math.abs(a[0])) / TAU), out = [];
        for (let k = -K; k <= K; k++) out.push([a[0] + TAU * k, a[1]], [Math.PI - a[0] + TAU * k, -a[1]]);
        return out;
      },
    };
    if (s.type === 'pown' && s.params.n > 0) {
      const n = s.params.n;
      return {
        fwd: (u) => { let p = [1, 0]; for (let k = 0; k < n; k++) p = cmul(p, u); return p; },
        inv: (u) => {
          const r = Math.hypot(u[0], u[1]) ** (1 / n), a = Math.atan2(u[1], u[0]), out = [];
          for (let k = 0; k < n; k++) out.push([r * Math.cos((a + TAU * k) / n), r * Math.sin((a + TAU * k) / n)]);
          return out;
        },
      };
    }
    if (s.type === 'mobius') {
      const [a, b, c, d] = ['a', 'b', 'c', 'd'].map((k) => cnum(s.params[k]));
      const lin = (p, q, u) => { const t = cmul(p, u); return [t[0] + q[0], t[1] + q[1]]; };
      return {
        fwd: (u) => cdiv(lin(a, b, u), lin(c, d, u)),
        inv: (u) => { const den = lin([-c[0], -c[1]], a, u); return den[0] === 0 && den[1] === 0 ? [] : [cdiv(lin(d, [-b[0], -b[1]], u), den)]; },
      };
    }
    throw new Error('chainPoints: no inverse for the step ' + s.type);
  };
  const chainPoints = (steps, box) => {
    const S = steps.map(stepOf);
    const run = (z, n) => { let u = z; for (let i = 0; i < n; i++) u = S[i].fwd(u); return u; };
    // (R[i]: a bound on |u| over plane i's image of the box, from a 101 x 101 grid of it with a quarter more, at most RMAX)
    const RMAX = 1e4, R = [Math.hypot(Math.max(Math.abs(box.x0), Math.abs(box.x1)), Math.max(Math.abs(box.y0), Math.abs(box.y1)))];
    for (let i = 1; i < S.length; i++) {
      let m = 0;
      for (let j = 0; j <= 100; j++) for (let k = 0; k <= 100; k++) {
        const u = run([box.x0 + (box.x1 - box.x0) * j / 100, box.y0 + (box.y1 - box.y0) * k / 100], i), h = Math.hypot(u[0], u[1]);
        if (Number.isFinite(h)) m = Math.max(m, h);
      }
      R.push(Math.min(RMAX, 1.25 * m));
    }
    const inBox = (z) => z[0] >= box.x0 && z[0] <= box.x1 && z[1] >= box.y0 && z[1] <= box.y1;
    const HIT = 1e-7, SAME = 1e-9;
    const cand = (w, b) => {
      let us = [w];
      for (let i = b - 1; i >= 0; i--) us = us.flatMap((u) => S[i].inv(u, R[i])).filter((v) => v.every(Number.isFinite) && Math.hypot(v[0], v[1]) <= R[i] && (i > 0 || inBox(v)));
      const out = [];
      for (const z of us) {
        const f = run(z, b);
        if (Math.hypot(f[0] - w[0], f[1] - w[1]) > HIT * (1 + Math.hypot(w[0], w[1])) || out.some((e) => Math.hypot(e.z[0] - z[0], e.z[1] - z[1]) < SAME)) continue;
        out.push({ z });
      }
      return out;
    };
    return cand;
  };
  // carryRead(env): the carried colour of a plane past the colour plane read against the exact one, as the carried-colour
  // suites grade it. env: the suite's steps(o) (__cmwSteps(o) at colour plane z, then its quiet wait), wait() (that wait
  // alone) and hold (held_frames.js's). Answers { measure }:
  // measure(at, b, P, pts, cand, pick): the front point's colour at the plane points pts of plane b in the state at
  // (__cmwSteps' go, now, scope, park; or at.hold, the thread held at x mid-glide, a scrub on the rail not let go, read
  // once its programs are linked and two frames are alike), P the pane (paneOf()). cand(w): the points landing at w,
  // [{ z, out }] (out: near an outline, a cut or a label, left out). pick(lists, b, sing, t): the index of the front point of
  // each list, fronts() by default. A point w is also left out where the front point jumps (a seam of that choice): its
  // front differs by more than SEAM from the front 1.5 px away in any direction; and where the front point is not shown
  // in P. Plane z's own colours (Everywhere, at rest on it) at the front points are the reference: answers tally()'s
  // { n, wrong, paper, worst, ex }, state { x, T, scope } and leftOut, the points left out
  const carryRead = (env) => {
    const SEAM = 0.06;
    // (the colours at the points W of the state at against plane z's at the points Z)
    const compare = async (at, W, Z) => {
      await env.steps({ scope: 'all', surf: 'plane', go: 0, now: true });
      const ref = (await lpx(Z)).px;
      if (at.hold != null) { await env.steps({ scope: at.scope, surf: 'plane', go: 0, now: true }); await env.hold(at.hold); } else { await env.steps(Object.assign({ surf: 'plane' }, at)); }
      const state = await ev('__cmwSteps()'), got = (await lpx(W)).px;
      if (at.hold != null) { await ev('window.__svScrubUp(); 1'); await env.wait(); }
      const fmt = (v) => v.map((q) => +q.toFixed(3));
      const { n, wrong, paper, worst, ex } = tally(got, ref, { note: (k) => ({ w: fmt(W[k]), z: fmt(Z[k]) }) });
      return { n, wrong, paper, worst, ex, state: { x: state.x, T: state.T, scope: state.scope } };
    };
    const measure = async (at, b, P, pts, cand, pick = fronts) => {
      const d = 1.5 / P.v.s, nb = [[0, 0], [d, 0], [-d, 0], [0, d], [0, -d]];
      const C = pts.flatMap((w) => nb.map(([a, e]) => cand([w[0] + a, w[1] + e])));
      // (mid-glide, the key of the glide's frame at t: its points are the glide map's poles at t, __cmwSvKey(b, t))
      const xt = at.hold != null ? at.hold : at.park, t = xt != null ? xt - Math.floor(xt) : 0;
      const F = await pick(C.map((c) => c.map((e) => e.z)), b, null, t > 0 ? t : null);
      const at5 = (k, j) => { const i = 5 * k + j; return F[i] < 0 ? null : C[i][F[i]]; };
      const W = [], Z = [];
      let left = 0;
      pts.forEach((w, k) => {
        const f = at5(k, 0);
        if (!f) return;
        const jump = [1, 2, 3, 4].some((j) => { const g = at5(k, j); return !g || Math.hypot(g.z[0] - f.z[0], g.z[1] - f.z[1]) > SEAM; });
        if (f.out || jump) { left++; return; }
        if (shown(P, f.z)) { W.push(w); Z.push(f.z); }
      });
      return Object.assign(await compare(at, W, Z), { leftOut: left });
    };
    return { measure };
  };
  return { lpx, paneOf, nearest, bare, tally, bareCount, grid, shown, fronts, joukPath, chainPoints, carryRead };
})()
