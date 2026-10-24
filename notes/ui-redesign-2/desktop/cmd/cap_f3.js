const out = {};
for (const DARK of [false, true]) {
  const T = DARK ? 'dark' : 'light';
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: DARK ? 'dark' : 'light' }] });
  await nav('http://localhost:8901/test.html?ns=dskT' + T);
  await sleep(1500);
  await ev(`__cmwSetMain('xy')`);
  await ev(`document.getElementById('stage').style.setProperty('--chain-h','188px')`);
  await sleep(500);
  for (let i = 0; i < 3 && (await ev('__cmwState().focus')) !== 3; i++) {
    await ev(`document.querySelector('#pipeline .card[data-k="3"] .nm').dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}))`);
    await sleep(600);
  }
  out[T] = await ev('__cmwState().focus');
  await sleep(2200);
  const r = await ev(`__qa.vis('#panes')`);
  await shot(`../../desktop/img/${T}/p-xy1440-f3`, { x: r.x, y: r.y, width: r.w, height: r.h });
  // the same at the 1024 and 768 layouts
  await send('Emulation.setDeviceMetricsOverride', { width: 1024, height: 768, deviceScaleFactor: 2, mobile: false });
  await ev(`(()=>{let s=document.createElement('style');s.id='dskG';s.textContent='.layout{--lw:36px!important; --rw:264px!important} .layout > .panel{position:static!important}';document.head.append(s);return 1})()`);
  await sleep(2500);
  let q = await ev(`__qa.vis('#panes')`); out[T + '1024'] = q;
  await shot(`../../desktop/img/${T}/p-xy1024-f3`, { x: q.x, y: q.y, width: q.w, height: q.h });
  await send('Emulation.setDeviceMetricsOverride', { width: 768, height: 1024, deviceScaleFactor: 2, mobile: false });
  await ev(`document.getElementById('dskG').textContent='.layout{--lw:36px!important; --rw:36px!important} #stage{max-height:704px!important} .layout > .panel{position:static!important}'`);
  await sleep(2500);
  q = await ev(`__qa.vis('#panes')`); out[T + '768'] = q;
  await shot(`../../desktop/img/${T}/p-xy768-f3`, { x: q.x, y: q.y, width: q.w, height: q.h });
  await ev(`document.getElementById('dskG').remove()`);
  for (let i = 0; i < 3 && (await ev('__cmwState().focus')) !== 0; i++) { await ev(`document.getElementById('viewAllBtn').click()`); await sleep(400); }
}
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
return out;
