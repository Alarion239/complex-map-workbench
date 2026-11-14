// The steps view's Opacity on the carried meshes (GLR.carryLayers): with the shapes forced forward (__cmwForceForward), the plane's rest frame
// is drawn by the carried meshes (svCarryRegions), the frame a glide draws. z² on a disc about 0.3+0.1i covers each w in the
// disc's image twice, a small disc about 1.4 once (two sheets: their keys differ by the tie order alone only near the
// real axis, where the depth's resolution cannot separate them).
// - at 100 % the meshes draw the front layer alone: no layered frame, and the pane's pixels after a visit to 50 % are the
//   ones before it (the opaque path leaves nothing behind);
// - below 100 % the layers show through: a point covered twice differs at 85 % and at 50 % from 100 %, and 85 % from
//   50 %, with layered frames drawn;
// - the meshes' colour at 85 % and 50 % is the exact pass's (the same page with the exact images on), at both points;
// - a point covered once is the same at every opacity, within 2/255 (the layers' programs shade it as the front layer's do).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const { lpx } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'carry_kit.js'), 'utf8'));
await view(1200, 800, false, false);
const openPage = async (meshes, alpha) => {
  const ns = 'svom' + Date.now();
  const st = { v3: true, v4: true, v5: true, v6: true, exactImages: true, alpha,
    shapes: [{ id: 's2', kind: 'disc', c: [0.3, 0.1], r: 1, ci: 0, visible: true }, { id: 's3', kind: 'disc', c: [1.4, 0], r: 0.3, ci: 1, visible: true }],
    steps: [{ type: 'pown', params: { n: 2 }, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 80 } };
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await settled({ panes: false });
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps` });
  await settled({ max: 30000, until: `typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip .sv-wholemap')` });
  await ev(`document.querySelector('.sv-cp').click(); 1`);
  await settled({});
  await ev(`document.querySelector('#svStrip .sv-plane[data-i="1"]').click(); 1`);
  await settled({ max: 15000, until: `__cmwSteps().stage === 1 && !__cmwSteps().moving && __cmwSvFixed()` });
  await ev(`[...document.querySelectorAll('.pane-head button')].find((b) => b.textContent.trim() === 'Inside regions').click(); 1`);
  await settled({ max: 15000, until: '__cmwSvFixed()' });
  if (meshes) await ev(`__cmwForceForward(['s2', 's3']); 1`);
  await settled({ max: 60000, until: `__cmwSvFixed() && (() => { const g = __cmwPaneStatus('L'); return !!g && !g.pending && !g.compiling; })()` });
};
const set = async (v) => {
  await ev(`(() => { const r = document.getElementById('alphaRange'); r.value = ${v}; r.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
  await settled({ max: 60000, until: `__cmwSvFixed() && (() => { const g = __cmwPaneStatus('L'); return !!g && !g.pending && !g.compiling; })()` });
};
// a grid of points of plane w (the exact page's front colour is the reference: the points where the meshes' front sheet is
// not the exact pass's, a tie of equal keys, are left out), and the point of the small disc's image (covered once)
const PTS = []; for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) PTS.push([0.25 * i + 0.013, 0.25 * j + 0.007]);
PTS.push([1.96, 0.05]);
const read = async () => (await lpx(PTS)).px.map((p) => p && p[4]);
const diff = (a, b) => Math.max(...a.map((x, i) => Math.abs(x - b[i])));
const frames = () => ev(`GLR.carryLayerFrames()`);
const canvasHash = async () => { await settled({ max: 30000, until: 'GLR.pendingLinks === 0' }); await sleep(600); return hashNow(); };
const hashNow = () => ev(`(() => { const c = document.getElementById('canvasL'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 0; i < d.length; i++) h = (h * 31 + d[i]) | 0; return h; })()`);
const MESH = {}, EXACT = {};
await openPage(true, 1);
const f0 = await frames();
MESH[1] = await read(); const h1 = await canvasHash();
await set(0.85); MESH[0.85] = await read(); const f85 = await frames();
await set(0.5); MESH[0.5] = await read();
await set(1); const h1b = await canvasHash(); const f1 = await frames();
let fExact = 0;
for (const a of [1, 0.85, 0.5]) { await openPage(false, a); EXACT[a] = await read(); fExact += await frames(); }
info.frames = { f0, f85, f1, fExact };
const last = PTS.length - 1;
ok('at 100 % no layered frame is drawn', f0 === 0, info.frames);
ok('below 100 % layered frames are drawn (the page is on the meshes)', f85 > 0, info.frames);
ok('without the hook the same scene draws no layered frame at any opacity (it is not on the meshes)', fExact === 0, info.frames);
ok('after a visit to 50 %, the opaque frame at 100 % is the pixels it was', h1 === h1b, { h1, h1b });
// the points on the pane where the meshes' front sheet is the exact pass's
const idx = [...PTS.keys()].filter((k) => k < last && MESH[1][k] && EXACT[1][k] && diff(MESH[1][k], EXACT[1][k]) <= 6);
info.points = { grid: PTS.length - 1, sameFront: idx.length };
ok('the page shows the grid, and most of its points have the exact pass\'s front sheet', idx.length >= 30, info.points);
for (const a of [0.85, 0.5]) {
  const shows = idx.filter((k) => diff(EXACT[1][k], EXACT[a][k]) >= 6), wrong = shows.filter((k) => diff(MESH[a][k], EXACT[a][k]) > 10);
  info['at' + a] = { shows: shows.length, wrong: wrong.map((k) => ({ p: PTS[k], mesh: MESH[a][k], exact: EXACT[a][k] })).slice(0, 4), n: wrong.length };
  ok(`at ${a * 100} % some points show the layers behind (exact differs from its 100 %)`, shows.length >= 5, info['at' + a]);
  ok(`and the meshes' colour at ${a * 100} % is the exact pass's there`, wrong.length <= Math.max(1, Math.floor(0.1 * shows.length)), info['at' + a]);
  ok(`a point covered once is the same at ${a * 100} % as at 100 %`, MESH[a][last] && diff(MESH[a][last], MESH[1][last]) <= 2, { one: MESH[a][last], full: MESH[1][last] });
}
console.log('INFO', JSON.stringify(info));
return { pass: fails.length === 0, fails, info };
