await send('Emulation.setDeviceMetricsOverride', { width: 1500, height: 1000, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'file://<project>/notes/ui-redesign-2/desktop/mockup.html' }); await sleep(7000);
await shot('../../desktop/shots/mockup-gallery-top');
return await ev('document.querySelectorAll("iframe").length');
