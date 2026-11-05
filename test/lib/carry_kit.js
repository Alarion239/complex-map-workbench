// The carried-colour suites' shared readers: steps_carry_inregion_cmd.js and steps_carry_far_cmd.js (and the planes
// suite of #733, once it merges). The left pane's pixels come from the page's __cmwLPx; the rest is the pane's camera,
// the nearest of a point's 9 pixels to a reference, the bare-paper test and the example list of src/app/15-examples-guide.js.
// An expression for eval in a suite, which supplies ev, fs and DIR: `const K = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'carry_kit.js'), 'utf8'))`.
// - lpx(pts): __cmwLPx(pts) answers { view, dpr, pw, ph, px }: for each plane point [x, y], the 3 x 3 device pixels about
//   it as [r, g, b, a] each, row by row (the centre is index 4), or null off the pane;
// - paneOf(): the pane's camera (v: the view, with cx, cy, s) and its size in css px (w, h);
// - nearest(p, ref): the least, over the 9 pixels ref of a point, of the largest channel difference (0..255) from p;
// - bare(p): whether the centre pixel p (of a 3 x 3 read) is bare paper, its channels within 6 of each other;
// - exampleNames(): the example names of src/app/15-examples-guide.js, in the order the page lists them.
(() => {
  const lpx = (pts) => ev(`__cmwLPx(${JSON.stringify(pts)})`);
  const paneOf = async () => { const q = await lpx([]); return { v: q.view, w: q.pw / q.dpr, h: q.ph / q.dpr }; };
  const nearest = (p, ref) => {
    let best = 1e9;
    for (const q of ref) best = Math.min(best, Math.max(Math.abs(p[0] - q[0]), Math.abs(p[1] - q[1]), Math.abs(p[2] - q[2])));
    return best;
  };
  const bare = (p) => Math.max(p[0], p[1], p[2]) - Math.min(p[0], p[1], p[2]) < 6;
  const exampleNames = () => [...fs.readFileSync(DIR + '/../../src/app/15-examples-guide.js', 'utf8').matchAll(/\bname: \$t\('((?:[^'\\]|\\.)*)'\)/g)].map((m) => m[1].replace(/\\'/g, "'"));
  return { lpx, paneOf, nearest, bare, exampleNames };
})()
