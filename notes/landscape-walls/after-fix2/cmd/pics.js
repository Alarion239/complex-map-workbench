globalThis.__cases = null;
const B = 'http://127.0.0.1:9807/';
const PAGE = globalThis.__page || 'test.html';
const settle = async (ms = 700) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const ld = async (st) => {
  const ns = 'vp' + Date.now();
  await send('Page.navigate', { url: B + 'gl-helpers.html' }); await sleep(400);
  const o = Object.assign({ v3: true, v4: true, shapes: [], steps: [], nextId: 50, focus: 0, rightMode: 'image', pattern: 'checker', srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'land' }, sheets: false, height: 'im', meshN: 240 }, st);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
  await send('Page.navigate', { url: B + PAGE + '?ns=' + ns }); await sleep(2500);
  await ev('__cmwSetMain("land")'); await settle(2500);
};
const rect = async () => ev(`(() => { const e = document.querySelector('#paneL') || document.querySelector('.pane'); const b = e.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), width: Math.round(b.width), height: Math.round(b.height) }; })()`);
const cx = (expr) => ({ type: 'custom', params: { expr, cut: 180 }, on: true });
const out = [];
const W = globalThis.__W || [1440, 900, false];
const tag = (globalThis.__tag || '') ;
for (const dark of (globalThis.__darks || [false, true])) {
  await view(W[0], W[1], dark, W[2]);
  const th = (dark ? 'dark' : 'light') + tag;
  const sq = { type: 'root', params: { n: 2, cut: 180 }, on: true }, sn = { type: 'sin', params: {}, on: true };
  for (const [id, st, T] of (globalThis.__cases || [
    ['user-t0.2-im-sh', { shapes: [{ id: 's1', kind: 'rect', a: [-3, -3], b: [3, 3] }], steps: [sq, sn], srcView: { cx: 0, cy: 0, s: 60 }, sheets: true, height: 'im' }, 0.2],
    ['tan-re', { steps: [{ type: 'tan', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 60 }, height: 're' }, null],
    ['sec-re', { steps: [cx('\\sec z')], srcView: { cx: 0, cy: 0, s: 60 }, height: 're' }, null],
    //['loglog-im-sh', { steps: [cx('\\log\\log z')], srcView: { cx: 0, cy: 0, s: 80 }, height: 'im', sheets: true }, null],
    //['sqrtz-over-zm1-im-sh', { steps: [cx('\\frac{\\sqrt{z}}{z-1}')], srcView: { cx: 0, cy: 0, s: 80 }, height: 'im', sheets: true }, null],
    //['asin-recip-re', { steps: [cx('\\arcsin(z)+1/z')], srcView: { cx: 0, cy: 0, s: 110 }, height: 're' }, null],
  ])) {
    await ld(st);
    if (T != null) { await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 1 } })'); await settle(900); await ev(`__cmwMorph({ T: ${T}, playing: false })`); await settle(3000); }
    const r = await rect();
    await shot('p-' + id + '-' + th, r);
    out.push({ id, th, cuts: await ev('(() => { const m = GLR.landMesh(); return m ? m.cuts : null; })()') });
  }
}
out.push({ logs: logs().filter((l) => !/404|favicon/.test(l.m)).slice(0, 8) });
return out;

