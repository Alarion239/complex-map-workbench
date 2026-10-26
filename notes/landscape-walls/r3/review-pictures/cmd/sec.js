// sec z Re at t = 0.38 (default mesh, desktop light): rest and the moving path (this build), rest in round 2 and the base
const out = [];
await view(1440, 900, false, false);
for (const page of ['test.html', 'r2/test.html', 'base/test.html']) {
  await ld(page, 'sc' + Date.now(), Object.assign({ shapes: [], pattern: 'checker', view: { main: 'land' }, meshN: 240 }, CASES.sec));
  await settle(1500); await ev('__cmwSetMain("land")'); await settle(2000);
  await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 1 } })'); await settle(900);
  const r = await paneRect();
  const nm = `sec-${page.replace(/\W/g, '')}`;
  await ev('__cmwMorph({ T: 0.38 })'); await settle(4000);
  await shot(nm + '-rest', r);
  if (page !== 'base/test.html') {
    await ev('__cmwMorph({ T: 0.308 })'); await settle(1500);
    await ev('GLR._lw = Object.assign(GLR._lw || {}, { motion: true }); 1');
    for (let t = 0.314; t < 0.38 - 1e-9; t += 0.006) { await ev(`__cmwMorph({ T: ${t.toFixed(4)} }); 1`); await ev('new Promise((r) => requestAnimationFrame(() => r(1)))'); await sleep(10); }
    await ev('__cmwMorph({ T: 0.38 }); 1'); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))');
    await shot(nm + '-move', r);
    await ev('GLR._lw.motion = false; 1');
  }
  out.push({ nm });
}
return out;
