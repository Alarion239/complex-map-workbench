// What the export suites share: the three-step chain they open, and the figure read back as data. In a suite:
//   const { STATE, fig, noMathJax } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'fig_kit.js'), 'utf8'))({ ev });
// STATE is the saved page state (affine, sin, exp over a disc); fig() builds the figure for an article and answers
// { svg, imgs, n, tex, cap } (svg without its pictures, imgs the hash of each picture, tex the formula, cap the caption),
// { none } when nothing is built, or { err }; noMathJax(f) is true where the page could not load MathJax, so that only the
// state is checked there.
({ ev }) => ({
  STATE: { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'k1', kind: 'disc', c: [0.3, 0], r: 0.6, ci: 0, visible: true }],
    steps: [{ type: 'affine', params: { a: '1', b: '0.5' }, on: true }, { type: 'sin', params: {}, on: true }, { type: 'exp', params: {}, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 80 } },
  // (the figure's pictures are the data: images embedded in the svg, hashed in the page; the svg's own ids differ from build to build)
  fig: () => ev(`await (async () => { try {
    const f = await __cmwFig.build({ for: 'article', cols: 1 }); if (!f) return { none: 1 };
    const hs = (t) => { let h = 5381; for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0; return h.toString(16); };
    const imgs = [...f.svg.matchAll(/xlink:href="(data:[^"]*)"/g)].map((m) => m[1].length + ':' + hs(m[1]));
    return { svg: f.svg.replace(/xlink:href="data:[^"]*"/g, ''), imgs: imgs.join(','), n: imgs.length, tex: __cmwFig.latex(f), cap: f.captionTex || '' };
  } catch (e) { return { err: String(e && e.stack || e).slice(0, 400) }; } })()`, 180000),
  noMathJax: (f) => !!(f.err && /MathJax/.test(f.err)),
});
