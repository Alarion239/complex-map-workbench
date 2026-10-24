await send('Emulation.setDeviceMetricsOverride', { width: 840, height: 600, deviceScaleFactor: 1, mobile: false });
await nav('file://' + DIR + '/../rev/cmd/sheet.html?t=__T__&d=__D__'); await sleep(900);
await shot('../rev/sheet-__D__-__T__');
return 1;
