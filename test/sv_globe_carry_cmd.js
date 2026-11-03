// The steps view's carried colour on a later plane's globe, where the inverse pass doesn't draw (ci/suite_views.js:
// steps({ pin: true })): with exact images off, plane w1 of Cayley(H) on the Sphere surface, past the colour plane z,
// Everywhere. The globe has no carried forward draw, so the carry's shapes (here the whole plane) leave it bare: the
// globe's own grey, its net and its circles. The region look (shapeInk, the region pattern) must not cover it. A
// sample is a CSS pixel on the globe (the pick, __cmwSphereWL, has a point); it is coloured when its channels spread by
// 24/255 or more (the bare globe and its net are grey; the region look is the shape's colour). Fails when more than
// 5 % of at least 2000 samples are coloured.
// A command file for a CDP daemon (test/cdp_kit README):
//   python3 build.py && test/<you>_cdp/q.sh test/sv_globe_carry_cmd.js
// Prints {pass, fails, results}; pass is true when every check holds.
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const H = { id: 's1', kind: 'halfplane', a: [0, 0], b: [1, 0] };
const CAY = { type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true };
await view(1440, 900, false);
await load('svgc' + Date.now(), { dc: 'enhanced', shapes: [H], steps: [CAY], exactImages: false, lines: false,
  unit: false, sv: { at: 1, T: 0, scope: 'all' }, srcView: { cx: 0, cy: 1, s: 60 } });
if (!(await ev(`!!(window.__cmwSteps && __cmwSteps().on)`))) {
  const name = 'the page is not in the steps view (this suite is tagged steps({ pin: true }) in ci/suite_views.js)';
  return { pass: false, fails: [{ name }], results: R };
}
await ev(`__cmwSteps({ go: 1, now: true, surf: 'sphere' }); 1`);
await settled({ until: `(() => { const s = __cmwSteps(); return s.i === 1 && !s.moving && s.surf === 'sphere'; })()` });
// (the camera's pose, then the page quiet: the frame of that pose drawn)
const CAM = { pitch: 0.35, yaw: -0.4, dist: 3.4 };
await ev(`__cmwCam('L', ${JSON.stringify(CAM)}); 1`);
await settled({ until: `(() => { const c = __cmwCam('L'), o = ${JSON.stringify(CAM)};
  return ['pitch', 'yaw', 'dist'].every((k) => Math.abs(c[k] - o[k]) < 1e-6); })()` });
R.state = await ev(`(() => { const s = __cmwSteps(); return { at: s.i, T: s.T, scope: s.scope, surf: s.surf }; })()`);
ok('the scene: plane w1 on the Sphere surface, colour plane z, Everywhere', R.state.at === 1 && R.state.T === 0
  && R.state.scope === 'all' && R.state.surf === 'sphere', R.state);
R.globe = await ev(`(() => {
  const cv = document.getElementById('canvasL'), r = cv.getBoundingClientRect(), dpr = cv.width / r.width;
  const g = document.createElement('canvas'); g.width = cv.width; g.height = cv.height;
  const x = g.getContext('2d'); x.drawImage(cv, 0, 0); const D = x.getImageData(0, 0, g.width, g.height).data;
  let n = 0, col = 0; const ex = [];
  for (let y = 2; y < r.height - 2; y += 2) for (let xx = 2; xx < r.width - 2; xx += 2) {
    if (!__cmwSphereWL(xx + 0.5, y + 0.5)) continue;
    const i = 4 * (Math.floor((y + 0.5) * dpr) * cv.width + Math.floor((xx + 0.5) * dpr));
    n++;
    if (Math.max(D[i], D[i + 1], D[i + 2]) - Math.min(D[i], D[i + 1], D[i + 2]) < 24) continue;
    col++; if (ex.length < 4) ex.push([xx, y, D[i], D[i + 1], D[i + 2]]);
  }
  return { n, col, frac: n ? +(col / n).toFixed(4) : null, ex };
})()`, 60000);
await shot('sv_globe_carry_off');
ok('exact images off: the w-globe is not covered by the region look (<= 5 % of the globe coloured)',
  R.globe.n >= 2000 && R.globe.col <= 0.05 * R.globe.n, R.globe);
R.logs = logs().filter((l) => /error|exception/i.test(l.t) && !/404/.test(l.m)).slice(0, 6);
ok('no console errors', R.logs.length === 0, R.logs);
return { pass: fails.length === 0, fails, results: R };
