const base = 'file://' + __BASE__ + '/frames/';
const list = [['f1-xy-1440', 1440, 900], ['f2-phase-1440', 1440, 900], ['f3-land-1440-nopanel', 1440, 900], ['f4-def-1440', 1440, 900], ['f5-xy-1024', 1024, 768], ['f6-xy-768', 768, 1024]];
const out = {};
for (const T of __THEMES__) {
  for (const [n, w, h] of list) {
    if (__ONLY__ && !__ONLY__.includes(n)) continue;
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: base + n + '.html?t=' + T }); await sleep(1600);
    await shot(`../../desktop/shots/after-${n}-${T}`);
  }
}
return out;
