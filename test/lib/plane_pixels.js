// What the steps view's plane-pixel suites share (steps_curves_cmd.js, steps_empty_cmd.js). An expression for eval in a suite:
// `const { ctl, quiet, planePixels } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'plane_pixels.js'), 'utf8'))`.
// - ctl(o): the steps view's test hook, __cmwSteps(o);
// - quiet(): waits until no glide or play is under way;
// - planePixels(prelude, test): counts the pixels of the shown plane (the biggest 2D canvas of #plotL, the rulers' margin on
//   each side left out) for which test(r, g, b) is true. prelude is JavaScript run in the page first, whose variables test
//   may use; test is the source of an arrow function. Returns { n, total } (or { __exc } when there is no 2D canvas).
(() => {
  const RULER_MARGIN = 0.14;   // (the share of the canvas the rulers take on each side)
  const ctl = (o) => ev(`__cmwSteps(${JSON.stringify(o)})`);
  const quiet = () => settled({ max: 20000, until: `(() => { const s = __cmwSteps(); return !s.anim && !s.play; })()` });
  const planePixels = (prelude, test) => ev(`(() => {
    const cs = [...document.querySelectorAll('#plotL canvas')].sort((p, q) => q.width * q.height - p.width * p.height), c = cs[0], x = c && c.getContext('2d');
    if (!x) return { __exc: 'no 2d canvas in #plotL' };
    ${prelude}
    const test = ${test};
    const m = Math.round(Math.min(c.width, c.height) * ${RULER_MARGIN}), w = c.width - 2 * m, h = c.height - 2 * m, d = x.getImageData(m, m, w, h).data;
    let n = 0; for (let i = 0; i < d.length; i += 4) if (test(d[i], d[i + 1], d[i + 2])) n++;
    return { n, total: d.length / 4 };
  })()`);
  return { ctl, quiet, planePixels };
})()
