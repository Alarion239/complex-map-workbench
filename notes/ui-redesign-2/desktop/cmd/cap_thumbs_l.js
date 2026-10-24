const DARK = false; const T = DARK ? 'dark' : 'light';
const ST = { shapes: [
  { id: 's1', kind: 'formula', expr: '|\\Im z|<\\frac{\\pi}{2}' },
  { id: 's2', kind: 'line', a: [0, 0.8], b: [1, 0.8] },
  { id: 's3', kind: 'point', p: [0, 0], label: 'z₀' } ],
  steps: [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' }, on: true }, { type: 'zp', params: { a: '1', zeros: '0.5, -0.5i', poles: '-0.8+0.75i' }, on: true }],
  srcView: { cx: 0, cy: 0, s: 52 }, pattern: 'checker' };
const dpr = async (w, h) => { await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: false }); await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: DARK ? 'dark' : 'light' }] }); };
await dpr(1440, 900);
await load('dskT' + T, ST);
await sleep(1500);
const focus = async (k) => {
  for (let i = 0; i < 3; i++) {
    const f = await ev('__cmwState().focus');
    if (f === k) return;
    if (k === 0) await clickSel('#viewAllBtn'); else await clickSel(`#pipeline .card[data-k="${k}"] .nm`);
    await sleep(500);
  }
};
const crop = async (sel, name) => { const r = await ev(`__qa.vis(${JSON.stringify(sel)})`); if (!r) return 'nosel ' + sel; await shot(`../../desktop/img/${T}/${name}`, { x: r.x, y: r.y, width: r.w, height: r.h }); return r; };
const out = {};
const wheel = async (sel, dy) => { const r = await ev(`__qa.vis(${JSON.stringify(sel)})`); const x = r.x + r.w / 2, y = r.y + r.h / 2; for (let i = 0; i < 4; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY: dy / 4 }); await sleep(60); } };
const ZOOM = { phase2: -800, def2: -900, def1: -150 };
// 1. X -> Y thumbnails from the chain itself, at the new card size (172 x 106)
await ev(`(()=>{const s=document.createElement('style');s.id='dsk1';s.textContent='#pipeline .card{width:172px!important;flex:0 0 172px!important} #pipeline .card .thumb{flex:0 0 106px!important;height:106px!important} #stage{--chain-h:300px!important}';document.head.append(s);document.getElementById('stage').style.setProperty('--chain-h','300px');return 1})()`);
await sleep(2500);
for (const k of [0, 1, 2, 3]) out['xy' + k] = await crop(`#pipeline .card[data-k="${k}"] .thumb`, `t-xy-${k}`);
await ev(`document.getElementById('dsk1').remove()`);
// 2. small stage for per-step pictures of the other views
await ev(`(()=>{const s=document.createElement('style');s.id='dsk2';s.textContent='#stage{width:300px!important;justify-self:start} .plot > :not(canvas){display:none!important} .tdock{display:none!important}';document.head.append(s);document.getElementById('stage').style.setProperty('--chain-h', (848-232)+'px');return 1})()`);
await sleep(800);
for (const v of ['phase', 'land']) {
  await ev(`__cmwSetMain('${v}')`);
  for (const k of [1, 2, 3]) {
    await focus(k); await sleep(400);
    if (v === 'phase') { await key('z'); await sleep(500); if (ZOOM[v + k]) await wheel('#plotL', ZOOM[v + k]); }
    await sleep(v === 'land' ? 2600 : 1800);
    out[v + k] = await crop('#plotL', `t-${v}-${k}`);
  }
  await focus(0);
}
await ev(`__cmwSetMain('xy')`); await sleep(600);
const Ts = { 1: 1, 2: 0.55, 3: 0 };
for (const k of [1, 2, 3]) {
  await focus(k); await sleep(400);
  await ev(`__cmwMorph({open:true})`); await sleep(500);
  out['paths' + k] = await ev(`(()=>{const b=[...document.querySelectorAll('#tdockR button, #tdockL button')].find((x)=>/Paths/.test(x.textContent)); if (b && b.getAttribute('aria-pressed')==='true') { b.click(); return 'off'; } return b ? b.getAttribute('aria-pressed') : 'none'; })()`);
  await ev(`__cmwMorph({T:${Ts[k]}})`); await sleep(900);
  if (ZOOM['def' + k]) await wheel('#plotR', ZOOM['def' + k]);
  await sleep(1500);
  out['def' + k] = await crop('#plotR', `t-def-${k}`);
  out['defst' + k] = await ev('__cmwState().morph');
  await ev(`__cmwMorph({open:false})`); await sleep(400);
}
await focus(0);
await ev(`document.getElementById('dsk2').remove(); document.getElementById('stage').style.removeProperty('--chain-h'); 1`);
return { out, logs: logs().filter((l) => l.t === 'EXC').slice(0, 5) };
