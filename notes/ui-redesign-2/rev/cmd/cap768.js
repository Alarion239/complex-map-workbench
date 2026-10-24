const ROOT = '<project>/notes/ui-redesign-2/';
const ST = { shapes: [{ id: 's1', kind: 'formula', expr: '|\\Im z|<\\frac{\\pi}{2}' }, { id: 's2', kind: 'line', a: [0, 0.8], b: [1, 0.8] }, { id: 's3', kind: 'point', p: [0, 0], label: 'z₀' }],
  steps: [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' }, on: true }, { type: 'zp', params: { a: '1', zeros: '0.5, -0.5i', poles: '-0.8+0.75i' }, on: true }],
  srcView: { cx: 0, cy: 0, s: 52 }, pattern: 'checker', focus: 3 };
const out = {};
for (const DARK of [false, true]) {
  const T = DARK ? 'dark' : 'light';
  await send('Emulation.setDeviceMetricsOverride', { width: 768, height: 1024, deviceScaleFactor: 2, mobile: false });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: T }] });
  await load('rv768' + T, ST, `localStorage.setItem('cmw-tour:rv768${T}', JSON.stringify({seen:true,dismissed:true}))`); await sleep(1500);
  await ev(`(()=>{let s=document.createElement('style');s.textContent='.layout{--lw:36px!important;--rw:0px!important} .layout > .panel.right{display:none!important} #stage{max-height:644px!important} .layout > .panel{position:static!important}';document.head.append(s);document.getElementById('stage').style.setProperty('--chain-h','188px');dispatchEvent(new Event('resize'));return 1})()`);
  await sleep(2500);
  const r = await ev(`__qa.vis('#panes')`);
  const o = await send('Page.captureScreenshot', { format: 'png', clip: { x: r.x, y: r.y, width: r.w, height: r.h, scale: 1 } });
  fs.writeFileSync(ROOT + 'desktop/img/' + T + '/p-xy768w-f3.png', Buffer.from(o.data, 'base64'));
  out[T] = [r.w, r.h, await ev('__cmwState().focus')];
}
return out;
