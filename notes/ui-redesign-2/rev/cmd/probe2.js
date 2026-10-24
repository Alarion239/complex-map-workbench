await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await load('rvprobe', { shapes: [{ id: 's1', kind: 'formula', expr: '|\\Im z|<\\frac{\\pi}{2}' }], steps: [{ type: 'exp', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 52 } });
await ev(`__cmwSetMain('land')`); await sleep(1800);
return await ev(`[...document.querySelectorAll('canvas')].filter(c=>c.offsetWidth).map(c=>c.id+' | '+c.className+' | '+c.parentElement.id+'.'+c.parentElement.className+' '+c.offsetWidth+'x'+c.offsetHeight+' vis='+getComputedStyle(c).visibility)`);
