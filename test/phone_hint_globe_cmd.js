// The phone's hint card over the globe (X's readout chip while the globe is shown: "Drag to turn, tap a shape to select it; …") stays
// clear of the globe: its rectangle does not meet the disk of the sphere (the top edge) and does not hide the sphere's `i` mark. Over the
// portrait and landscape phone sizes in English, Russian and Italian (the longest words). The globe's disk is the app's own: the
// pane's centre and the radius globeCam gives, from the camera. A command file for a CDP daemon (test/cdp_kit README); prints
// { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const POINTS = [[740, 360, 'en'], [915, 412, 'en'], [667, 375, 'en'], [320, 568, 'en'], [320, 568, 'ru'], [360, 640, 'en'], [360, 640, 'ru'], [360, 640, 'it'], [390, 844, 'ru'], [740, 360, 'ru'], [740, 360, 'it'], [915, 412, 'ru']];
for (const [w, h, lang] of POINTS) {
  const name = `${w}x${h} ${lang}`;
  await view(w, h, false, true);
  await go(`http://localhost:${PORT}/test.html?view=steps&lang=${lang}&ns=hg${w}${Date.now()}`);
  await settled({ max: 30000, until: `typeof __cmwSteps === "function" && !!window.GLR` });
  await ev(`__cmwSteps({ surf: 'sphere', go: 0, now: true }); 1`);
  await settled({ max: 30000, until: `!!document.querySelector('#leftReadout .rglobe') && !!__cmwGlobeXY('L', 0, 1)` });
  const m = info[name] = await ev(`(() => {
    const cv = document.getElementById('canvasL').getBoundingClientRect(), c = __cmwCam('L'), pc = GLR.camera(c, cv.width, cv.height), D = Math.hypot(...pc.eye);
    const R = D > 1 ? Math.tan(Math.asin(1 / D)) / Math.tan((c.fov || 28 * Math.PI / 180) / 2) * cv.height / 2 : cv.height / 2;
    const ch = document.getElementById('leftReadout').getBoundingClientRect(), cx = cv.left + cv.width / 2, cy = cv.top + cv.height / 2;
    const nx = Math.max(ch.left, Math.min(cx, ch.right)), ny = Math.max(ch.top, Math.min(cy, ch.bottom)), i = __cmwGlobeXY('L', 0, 1);
    return { R: Math.round(R), chip: [ch.left, ch.top, ch.right, ch.bottom].map(Math.round), gap: Math.round(Math.hypot(nx - cx, ny - cy) - R), i: i && i.map(Math.round),
      iHidden: !!i && i[0] >= ch.left && i[0] <= ch.right && i[1] >= ch.top && i[1] <= ch.bottom, shown: ch.width > 0 };
  })()`);
  ok(`${name}: the hint card is on the page`, m.shown, m);
  ok(`${name}: the hint card is clear of the globe's disk (gap ≥ 0 px)`, m.gap >= 0, m);
  ok(`${name}: the hint card does not hide the i mark`, m.i && !m.iHidden, m);
}
return { pass: fails.length === 0, fails, info };
