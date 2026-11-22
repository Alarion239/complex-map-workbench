// Figure export, the axes the figures label themselves: the video's axes (a frame drawn by the video's code, of the steps
// view's glide parked halfway) and the classic Landscape figure's floor. Each axis is read from XD.axes ({ name, ticks, step,
// d, labels }, recorded by XD.axisDec while the figure is made). Over a window zoomed in to a span of about 2.4·10⁻⁶ (a
// step below 10⁻⁶), on every axis the labels are pairwise different and each reads back to its tick, in en and ru (the
// decimal comma). Over windows of a span of about 14 and of about 0.01, every axis keeps its step's own decimals
// (XD.decimals), so the figures that were fine print the same labels. The video's y labels start inside its frame.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const base = `http://localhost:${PORT}`;
// (the classic view's main view, through its hook)
const mainView = async (m) => { await ev(`__cmwSetMain(${JSON.stringify(m)}); 1`); await settled(); };
// a label reads back to its tick: |value − tick| at most half a unit in its last printed place (a TeX or a plain decimal
// comma, a minus sign)
const readsBack = (lab, t) => { const s = lab.replace('{,}', '.').replace(',', '.').replace('−', '-'), d = (s.split('.')[1] || '').length; return Math.abs(parseFloat(s) - t) <= 0.5 * 10 ** -d + 1e-12; };
const axisOk = (a) => !!a && a.labels.length > 1 && new Set(a.labels).size === a.labels.length && a.labels.every((l, i) => readsBack(l, a.ticks[i]));
// the windows: zoomed in about a point off 0 (pane about 850 px wide: s px a unit), and the one the page opens on
const ZOOM = { cx: 1.83681819, cy: 1.25663493, s: 3.5e8 }, WIDE = { cx: 0, cy: 0, s: 60 }, NARROW = { cx: 1.837, cy: 1.257, s: 8.5e4 };
// the shape, a square RECT_PX px a side from the window's centre: the video fits its window to the shapes
const RECT_PX = 300;
// (the identity: every plane and the glide between them show the same window, the video's included)
const STEPS = [{ type: 'custom', params: { expr: 'z' }, on: true }];
// (classic: the classic view; else the steps view, its glide parked halfway from z to w₁, the video's frame)
const open = async (ns, lang, srcView, classic) => {
  await view(1440, 900, false);
  await seed(ns, { v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, steps: STEPS, srcView, rightView: srcView,
    shapes: [{ id: 's1', kind: 'rect', a: [srcView.cx - RECT_PX / srcView.s, srcView.cy - RECT_PX / srcView.s], b: [srcView.cx + RECT_PX / srcView.s, srcView.cy + RECT_PX / srcView.s], visible: true }] });
  await go(`${base}/test.html?ns=${ns}&lang=${lang}&view=${classic ? 'classic' : 'steps'}`);
  await settled({ until: `window.MathJax && typeof MathJax.tex2svg === "function" && !!window.__cmwFig && ${classic ? 'typeof __cmwSetMain === "function"' : 'typeof __cmwSteps === "function" && __cmwSteps().on'}`, max: 30000 });
  if (!classic) { await ev('__cmwSteps({ park: 0.5 }); 1'); await settled({ max: 15000 }); }
};
// the axes a figure records while it is made: kind 'video' (one frame by the video's code), 'land' (the Landscape figure)
const axesOf = (kind) => ev(`await (async () => { const XD = __cmwFig.XD; XD.axes = []; try {
  if (${JSON.stringify(kind)} === 'video') await __cmwFig.videoScreenCheck({ video: { size: '1280x720', look: 'print', win: 'screen', paths: false, tlabel: false } });
  else await __cmwFig.build({ for: 'article', cols: 1 });
  return { axes: XD.axes, decimals: XD.axes.map((a) => XD.decimals(a.step)) };
} catch (e) { return { err: String(e).slice(0, 300) }; } finally { XD.axes = null; } })()`, 180000);
for (const [win, srcView] of [['zoomed', ZOOM], ['wide', WIDE], ['0.01-wide', NARROW]]) {
  for (const lang of win === 'zoomed' ? ['en', 'ru'] : ['en']) {
    // the video: a frame of the steps view's glide on the plane; the Landscape figure: the classic Landscape
    // (standards-ok: the classic deformation's filmstrip rows went with the classic transport, #994; the video's rows run
    // on the steps view's glide)
    await open(`ftvs${win}${lang}${Date.now()}`, lang, srcView, false);
    const video = await axesOf('video');
    await open(`ftv${win}${lang}${Date.now()}`, lang, srcView, true);
    await mainView('land');
    const land = await axesOf('land');
    for (const [tag, r] of [['the video', video], ['the Landscape figure', land]]) {
      const n = `${tag}, ${win} window, ${lang}`;
      info[n] = r;
      ok(`${n}: its axes are recorded (control)`, !!r && !r.err && r.axes.length >= 2, r);
      if (!r || r.err) continue;
      if (win === 'zoomed') ok(`${n}: on each axis the labels differ and read back to their ticks`, r.axes.every(axisOk), r.axes.map((a) => ({ name: a.name, labels: a.labels })));
      else ok(`${n}: each axis keeps its step's decimals`, r.axes.every((a, i) => a.d === r.decimals[i]), r.axes.map((a, i) => ({ name: a.name, step: a.step, d: a.d, decimals: r.decimals[i] })));
      // (the video's y labels start inside the frame: at the zoomed window the y axis is pinned to the frame's left edge)
      if (tag === 'the video') { const y = r.axes.find((a) => a.name === 'y'); ok(`${n}: the y labels start inside the frame`, !!y && y.left >= 0, y && { left: y.left, labels: y.labels }); }
      if (lang === 'ru') ok(`${n}: the labels with decimals have a decimal comma`, r.axes.every((a) => a.labels.every((l) => !/\./.test(l))), r.axes.map((a) => a.labels));
    }
  }
}
return { pass: fails.length === 0, fails, info };
