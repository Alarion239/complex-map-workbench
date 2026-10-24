// Screenshots of mockup.html: one PNG per screen (light and dark pair) into ../shots/after/
const P = '<project>/notes/ui-redesign-2/phone/';
await send('Emulation.setDeviceMetricsOverride', { width: 1720, height: 1000, deviceScaleFactor: 1, mobile: false });
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
await send('Emulation.setTouchEmulationEnabled', { enabled: false });
await nav('file://' + P + 'mockup.html'); await sleep(2500);
const ids = await ev(`[...document.querySelectorAll('.scr')].map(s=>s.id)`);
const out = {};
for (const id of ids) {
  const r = await ev(`(()=>{const e=document.querySelector('#${id} .fpair'); const b=e.getBoundingClientRect(); return {x:b.left-12,y:b.top+scrollY-12,w:b.width+24,h:b.height+24};})()`);
  const o = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: r.x, y: r.y, width: r.w, height: r.h, scale: 1 } });
  fs.writeFileSync(P + 'shots/after/' + id + '.png', Buffer.from(o.data, 'base64'));
  out[id] = r.w + 'x' + r.h;
}
out.bad = await ev(`[...document.querySelectorAll('img[data-k]')].filter(i=>!i.src).map(i=>i.dataset.k)`);
out.logs = logs().filter(l => l.t === 'EXC').slice(0, 5);
return out;
