const out = {};
for (const DARK of [false, true]) {
  const T = DARK ? 'dark' : 'light';
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: DARK ? 'dark' : 'light' }] });
  await nav('http://localhost:8901/test.html?ns=dskT' + T);
  await sleep(2500);
  const r = await ev(`__qa.vis('#leftPanel')`);
  await shot(`../../desktop/img/${T}/left1440`, { x: r.x, y: r.y, width: r.w, height: r.h });
  out[T] = r;
}
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
return out;
