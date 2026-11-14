// The carried-colour suites' shared page script and pixel compare: steps_carry_inregion_cmd.js, steps_carry_far_cmd.js
// and steps_carry_planes_cmd.js. The left pane's pixels come from the page's __cmwLPx; the rest is the pane's camera,
// the nearest of a point's 9 pixels to a reference, the bare-paper test and the example list of src/app/15-examples-guide.js.
// An expression for eval in a suite, which supplies ev, fs and DIR: `const K = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'carry_kit.js'), 'utf8'))`.
// - lpx(pts): __cmwLPx(pts) answers { view, dpr, pw, ph, px }: for each plane point [x, y], the 3 x 3 device pixels about
//   it as [r, g, b, a] each, row by row (the centre is index 4), or null off the pane;
// - paneOf(): the pane's camera (v: the view, with cx, cy, s) and its size in css px (w, h);
// - nearest(p, ref): the least, over the 9 pixels ref of a point, of the largest channel difference (0..255) from p;
// - bare(p): whether the centre pixel p (of a 3 x 3 read) is bare paper, its channels within 6 of each other;
// - exampleNames(): the example names of src/app/15-examples-guide.js, in the order the page lists them;
// - tally(got, ref, o): over the points k with got[k] and ref[k] both read (and not o.skip(k)), the count n of those, how
//   many are wrong (nearest() over o.tol, default 14, from the 3 x 3 reference), how many sit on bare paper, the worst
//   nearest(), and up to 6 examples (o.note(k) adds its fields to each): { n, wrong, paper, worst, ex };
// - bareCount(px): { n, paper }, the points of a read that are on the page and the ones of them on bare paper;
// - grid(P, nx, ny, frac): an nx x ny grid of plane points over the middle frac (default 0.8) of the pane P;
// - shown(P, z): whether z is inside the middle 90 % of the pane P, where a reference of plane z shows it;
// - fronts(lists, b, sing): for each list of points z, the index of the front one under the steps view's sheet key of
//   plane b (Inverse.sheetKey and Inverse.front in the page; sing: the key's points in place of plane b's), -1 for none;
// - joukPath(outside, leave): the Joukowski airfoil's path H_t (tanh((1 + t) artanh z - i pi t / 2) on the disc,
//   coth((1 + t) arcoth z) outside it) for the region outside the circle that `outside` measures: candAt(t)(w) the points
//   z at w along H_t, each branch's inverse over k, kept where H_t gives w back (within 1e-7), each as { z, name, out }
//   with out set near the circle's outline (0.12) and where leave(z, w); poleAt(t) the key's points at t, plane w1's
//   (z = 0) and the path's pole on the disc, -i tan(pi (1 - t) / (2 (1 + t))), there from t = 1/3 on.
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
  const exampleNames = () => [...fs.readFileSync(DIR + '/../../src/app/15-examples-guide.js', 'utf8').matchAll(/\bname: \$t\('((?:[^'\\]|\\.)*)'\)/g)].map((m) => m[1].replace(/\\'/g, "'"));
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
  const fronts = async (lists, b, sing) => {
    const r = await ev(`(() => {
      const k = Object.assign(__cmwSvKey(${b}), ${sing ? `{ sing: ${JSON.stringify(sing)} }` : '{}'}), prep = { win: k.win, R: k.R, rs: k.rs, sing: k.sing.map((p) => CX.C(p[0], p[1])) };
      return ${JSON.stringify(lists)}.map((L) => {
        let bi = -1, bc = null;
        L.forEach((p, i) => { const z = CX.C(p[0], p[1]), c = { z, D: Inverse.sheetKey(prep, z, null), lam: null }; if (!bc || Inverse.front(c, bc)) { bc = c; bi = i; } });
        return bi;
      });
    })()`);
    if (r && r.__exc !== undefined) throw new Error('fronts failed: ' + r.__exc);
    return r;
  };
  const joukPath = (outside, leave) => {
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
  return { lpx, paneOf, nearest, bare, exampleNames, tally, bareCount, grid, shown, fronts, joukPath };
})()
