// The carried-colour suites' shared readers: steps_carry_inregion_cmd.js and steps_carry_far_cmd.js (and the planes
// suite of #733, once it merges). The left pane's pixels come from the page's __cmwLPx; the rest is the pane's camera,
// the nearest of a point's 9 pixels to a reference, the bare-paper test and the example list of src/app/15-examples-guide.js.
// An expression for eval in a suite, which supplies ev, fs and DIR: `const K = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'carry_kit.js'), 'utf8'))`.
// - lpx(pts): __cmwLPx(pts) answers { view, dpr, pw, ph, px }: for each plane point [x, y], the 3 x 3 device pixels about
//   it as [r, g, b, a] each, row by row (the centre is index 4), or null off the pane;
// - paneOf(): the pane's camera (v: the view, with cx, cy, s) and its size in css px (w, h);
// - nearest(p, ref): the least, over the 9 pixels ref of a point, of the largest channel difference (0..255) from p;
// - bare(p): whether the centre pixel p (of a 3 x 3 read) is bare paper, its channels within 6 of each other;
// - exampleNames(): the example names of src/app/15-examples-guide.js, in the order the page lists them;
// - fronts(lists, b, sing): for each list of points z, the index of the front one under the key of plane b as the pre-mapped
//   meshes order sheets (Inverse.sheetKey and Inverse.frontByStep in the page; sing: the key's points in place of plane b's), -1 for none.
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
  const fronts = async (lists, b, sing) => {
    const r = await ev(`(() => {
  const k = Object.assign(__cmwSvKey(${b}), ${sing ? `{ sing: ${JSON.stringify(sing)} }` : '{}'}), prep = { win: k.win, R: k.R, rs: k.rs, sing: k.sing.map((p) => CX.C(p[0], p[1])) };
  return ${JSON.stringify(lists)}.map((L) => {
    let bi = -1, bc = null;
    L.forEach((p, i) => { const z = CX.C(p[0], p[1]), c = { z, D: Inverse.sheetKey(prep, z, null), lam: null }; if (!bc || Inverse.frontByStep(c, bc)) { bc = c; bi = i; } });
    return bi;
  });
})()`);
    if (r && r.__exc !== undefined) throw new Error('fronts failed: ' + r.__exc);
    return r;
  };
  return { lpx, paneOf, nearest, bare, exampleNames, fronts };
})()
