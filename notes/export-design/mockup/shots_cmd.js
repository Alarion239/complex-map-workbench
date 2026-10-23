// screenshots of the mockup's states, light and dark (mockup/shot-<state>-<theme>.png)
const OUTD = path.join(DIR, '..', 'mockup');
const R = {};
for (const dark of [false, true]) {
  await send('Network.setCacheDisabled', { cacheDisabled: true }); await view(1240, 900, dark);
  await nav('http://localhost:8817/mockup-export.html');
  await sleep(1500);
  await ev('document.fonts ? document.fonts.ready.then(() => 1) : 1');
  const boxes = await ev(`[...document.querySelectorAll('section.state')].map((s) => { const r = s.getBoundingClientRect(); return [s.id, r.left, r.top + scrollY, r.width, r.height]; })`);
  for (const [id, x, y, w, h] of boxes) {
    const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x, y, width: w, height: h, scale: 1 } });
    const f = path.join(OUTD, `shot-${id}-${dark ? 'dark' : 'light'}.png`);
    fs.writeFileSync(f, Buffer.from(r.data, 'base64'));
    R[f.split('/').pop()] = [Math.round(w), Math.round(h)];
  }
  // phone width: the layout stacks
  if (!dark) { await view(760, 760, false); await nav('http://localhost:8817/mockup-export.html'); await sleep(1200); R.narrowOverflow = await ev('document.documentElement.scrollWidth - innerWidth'); await shot('mockup-760'); await view(390, 844, false, true); await nav('http://localhost:8817/mockup-export.html'); await sleep(1200); R.phoneOverflow = await ev('document.documentElement.scrollWidth - innerWidth'); await shot('mockup-phone'); }
}
R.logs = logs().filter((l) => l.t === 'EXC' || l.t === 'error').slice(0, 5);
await view(1440, 900, false);
return R;
