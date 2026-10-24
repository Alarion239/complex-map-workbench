await send('Emulation.setDeviceMetricsOverride', { width: 1720, height: 1000, deviceScaleFactor: 1, mobile: false });
await nav('file://' + DIR + '/../phone/mockup.html'); await sleep(1500);
return await ev(`[...document.querySelectorAll('#home-x .phone.th-light button')].length`);
