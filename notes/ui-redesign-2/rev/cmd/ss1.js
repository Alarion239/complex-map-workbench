await send('Emulation.setDeviceMetricsOverride', { width: 840, height: 600, deviceScaleFactor: 1, mobile: false });
await nav('file://' + DIR + '/../rev/cmd/sheet.html?t=light&d=desktop'); await sleep(900);
await shot('../rev/sheet-desktop-light');
return 1;
