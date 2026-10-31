// tools/inspect.js's command file for a CDP daemon (test/cdp_kit README): one build walked over the matrix of
// test/lib/layout_matrix.js; at each point a PNG (for the diff) and a JPEG (for the gallery) of the page, and the
// layout checks of test/lib/layout.js (the focus rings after the shots: they move the focus). tools/inspect.js puts
// INSPECT on its first line: { url, lib, matrix, out, cfg }.
const LIB = fs.readFileSync(INSPECT.lib, 'utf8');
const M = eval(fs.readFileSync(INSPECT.matrix, 'utf8'));
fs.mkdirSync(INSPECT.out, { recursive: true });
const points = [];
const t0 = Date.now();
const skipped = await M.walk(INSPECT.cfg, INSPECT.url, async (p) => {
  const id = [p.lang, p.view, p.size.id, p.theme, p.state].join('_').replace(/[^\w.-]+/g, '-');
  const vs = await ev(`__layout.all({ touch: ${p.dev === 'phone'}, focus: false })`);
  for (const [fmt, ext] of [['png', 'png'], ['jpeg', 'jpg']]) {
    const r = await send('Page.captureScreenshot', fmt === 'jpeg' ? { format: fmt, quality: 82 } : { format: fmt });
    fs.writeFileSync(path.join(INSPECT.out, `${id}.${ext}`), Buffer.from(r.data, 'base64'));
  }
  const fr = p.last ? await ev(`__layout.focusRings()`) : [];
  points.push({ id, lang: p.lang, view: p.view, size: p.size.id, w: p.size.w, h: p.size.h, theme: p.theme, state: p.state,
    v: (Array.isArray(vs) ? vs : [{ check: 'threw', key: String(vs && vs.__exc), el: String(vs && vs.__exc) }]).concat(Array.isArray(fr) ? fr : []) });
});
return { points, skipped, ms: Date.now() - t0, renderer: await ev(`(() => { try { const g = document.createElement('canvas').getContext('webgl2'); const d = g.getExtension('WEBGL_debug_renderer_info'); return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER); } catch (e) { return String(e); } })()`) };
