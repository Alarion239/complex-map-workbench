// The steps view's Landscape at an opacity below 1 (#1202): each surface of the relief lets the ones behind it show
// through by the set amount, the farthest stays opaque, and a point covered once is unchanged.
// - the Landscape is opaque by default (one layer); its Opacity slider sets its own opacity (the page state's
//   landAlpha, saved), leaving the plane's (alpha) as it is, and draws the relief's layers: one at 100 %, 3 at 85 %, 4 at
//   50 % (__cmwLandSheets().layers), each composited (GLR.landLayerFrames);
// - from the top, the relief of Im z² over plane z covers each pixel once: its frames at 85 % and 50 % are pixel-identical
//   to the one at 100 %;
// - from the top, All sheets of ∛z stacks three sheets over each point: at 85 % and at 50 % most of the relief's pixels
//   change, and the two differ;
// - a held All-sheets glide (Möbius then √, u = ½) at 85 % is the same frame drawn again after a frame at 50 %: nothing
//   is left from an earlier frame's layers;
// - no WebGL error in the console.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, got) => { if (!pass) fails.push({ name, got }); };
const rAF2 = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))';
await view(1200, 800, false, false);
const page = async (tag, st, x) => {
  const ns = 'landop' + tag + Date.now();
  await loadView('steps', ns, Object.assign({ shapes: [], srcView: { cx: 0, cy: 0, s: 90 }, rightMode: '3d' }, st));
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
  await ev(`__cmwSteps({ scope: 'all', surf: 'land', go: 0, now: true, clock: 0 }); 1`);
  await settled({ max: 90000 });
  if (x != null) { await ev(`__cmwSteps({ x: ${x} }); 1`); await settled({ max: 90000 }); }
};
// the Landscape's Opacity slider (in its Display options) set to v; the frame drawn at v
const setOpacity = async (v, x) => {
  if (!(await ev(`!!document.querySelector('#popHost #opacityRange')`))) {
    await ev(`document.querySelector('.pane-head .opts-btn[aria-label="Display options"]').click(); 1`);
    await settled({ max: 15000, until: `!!document.querySelector('#popHost #opacityRange')` });
  }
  await ev(`(() => { const r = document.querySelector('#popHost #opacityRange'); r.value = '${v}'; r.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
  await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); 1`);
  if (x != null) await ev(`__cmwSteps({ x: ${x} }); 1`);
  await settled({ max: 90000, floor: 300 }); await ev(rAF2); await settled({ max: 90000 }); await ev(rAF2);
  return ev('(() => { const s = __cmwLandSheets(); return { layers: s.layers, frames: s.layerFrames }; })()');
};
const keep = (tag) => ev(`window.__k = window.__k || {}; window.__k[${JSON.stringify(tag)}] = (() => { const cv = document.getElementById('canvasL'); return cv.getContext('2d').getImageData(0, 0, cv.width, cv.height); })(); 1`);
// pixels apart (by more than 2/255 in a channel) between two kept frames, and the pixels of the relief (saturated) in a
const apart = (a, b) => ev(`(() => { const A = window.__k[${JSON.stringify(a)}].data, B = window.__k[${JSON.stringify(b)}].data; let n = 0, s = 0; for (let i = 0; i < A.length; i += 4) { if (Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]), Math.abs(A[i + 3] - B[i + 3])) > 2) n++; if (Math.max(A[i], A[i + 1], A[i + 2]) - Math.min(A[i], A[i + 1], A[i + 2]) > 30) s++; } return { apart: n, relief: s }; })()`);
// the camera from the top (the View control's Top: pitch 88°)
const top = async () => {
  await ev(`__cmwCam('L', { yaw: -Math.PI / 2, pitch: 88 * Math.PI / 180 }); 1`);
  await settled({ max: 60000 }); await ev(rAF2);
  return ev(`__cmwCam('L').pitch`);
};

// the layers the slider draws: Im z² over plane z, from the top (each pixel covered once)
await page('one', { steps: [{ type: 'pown', params: { n: 2 }, on: true }], sheets: false, height: 'im' });
info.pitch = await top();
const dflt = await ev('(() => { const s = __cmwLandSheets(); return { layers: s.layers, frames: s.layerFrames }; })()');
ok('the Landscape is opaque by default: one layer, none composited', dflt.layers === 1 && dflt.frames === 0, dflt);
const at = {};
for (const v of [1, 0.85, 0.5]) { at[v] = await setOpacity(v); await keep('one' + v); }
info.layers = at;
ok('the relief draws one layer at 100 %, 3 at 85 % and 4 at 50 %', at[1].layers === 1 && at[0.85].layers === 3 && at[0.5].layers === 4, at);
ok('and composites the layers at 85 % and at 50 %', at[0.85].frames > at[1].frames && at[0.5].frames > at[0.85].frames, at);
const lsState = `JSON.parse(localStorage.getItem('complex-map-workbench-v1:' + new URLSearchParams(location.search).get('ns')) || '{}')`;
await settled({ max: 10000, until: `${lsState}.landAlpha === 0.5` });
const saved = await ev(`(() => { const s = ${lsState}; return { landAlpha: s.landAlpha, alpha: s.alpha }; })()`);
ok('the setting is the page state\'s landAlpha, saved, and the plane\'s opacity is left at its 85 %', saved.landAlpha === 0.5 && (saved.alpha === undefined || saved.alpha === 0.85), saved);
const one85 = await apart('one1', 'one0.85'), one50 = await apart('one1', 'one0.5');
info.once = { one85, one50 };
ok('from the top, a relief that covers each pixel once is pixel-identical at 85 % and at 50 % to 100 %', one85.relief > 10000 && one85.apart === 0 && one50.apart === 0, info.once);

// All sheets of ∛z from the top: three sheets over each point
await page('many', { steps: [{ type: 'root', params: { n: 3, cut: 180 }, on: true }], sheets: true, height: 'im' });
await top();
for (const v of [1, 0.85, 0.5]) { await setOpacity(v); await keep('many' + v); }
const t85 = await apart('many1', 'many0.85'), t50 = await apart('many1', 'many0.5'), t8550 = await apart('many0.85', 'many0.5');
info.stacked = { t85, t50, t8550, K: await ev('(__cmwLandSheets().drawn || {}).K') };
ok('from the top, where All sheets of ∛z stack three sheets, most of the relief changes at 85 %', info.stacked.K === 3 && t85.apart > 0.5 * t85.relief, info.stacked);
ok('and at 50 %, apart from 85 %', t50.apart > 0.5 * t50.relief && t8550.apart > 0.5 * t8550.relief, info.stacked);

// a held All-sheets glide: the same frame before and after a frame at 50 %
await page('glide', { steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, { type: 'root', params: { n: 2 }, on: true }], sheets: true, height: 'im' }, 1.5);
await setOpacity(1, 1.5); await keep('g1');
const g85 = await setOpacity(0.85, 1.5); await keep('g85');
await setOpacity(0.5, 1.5);
await setOpacity(0.85, 1.5); await keep('g85b');
const carried = await ev('(() => { const c = __cmwLandCarry(); return c && { u: c.u, sheets: c.sheets }; })()');
const gShow = await apart('g1', 'g85'), gAgain = await apart('g85', 'g85b');
info.glide = { carried, g85, gShow, gAgain };
ok('a held All-sheets glide at 85 % draws its layers', !!carried && carried.sheets && Math.abs(carried.u - 0.5) < 1e-6 && g85.layers === 3 && gShow.apart > 1000, info.glide);
ok('and is the same frame drawn again after a frame at 50 %', gAgain.apart === 0, info.glide);

const lg = (await logs()).filter((l) => /error|exception|GL_INVALID/i.test(l.t + ' ' + l.m) && !/Failed to load resource/.test(l.m)).slice(0, 5);
ok('no errors in the console', lg.length === 0, lg);
return { pass: fails.length === 0, fails, info };
