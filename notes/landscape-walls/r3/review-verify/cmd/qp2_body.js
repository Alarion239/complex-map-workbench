// Loop on, the transport opened and played at once, or after a wait; frames over 5 s
const out = [];
for (const [page, wait, mesh] of [['test.html', 0, 240], ['r2.html', 0, 240], ['test.html', 1200, 240], ['test.html', 2500, 240], ['base.html', 0, 240]]) {
  await view(1440, 900, false, false);
  await ld(page, 'q2' + Date.now(), Object.assign({}, CASES.user, { meshN: mesh, sheets: false, view: { main: 'land' }, loop: true }));
  await settle(1500); await ev('__cmwSetMain("land")'); await settle(3500);
  await ev('__cmwSet("loop", true); 1');
  const r = await paneRect();
  await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 1 } }); 1');
  if (wait) await sleep(wait);
  await ev('__cmwMorph({ T: 0, playing: true }); 1');
  const t0 = Date.now();
  const shots = [];
  for (const at of [400, 1600, 3000, 4500, 6000]) { while (Date.now() - t0 < at) await sleep(20); const a = (await ev('__cmwMorph({})')).T; const f = await shot(`Q2-${page.replace(/\W/g, '')}-w${wait}-${at}`, r); shots.push([f.split('/').pop(), +a.toFixed(3)]); }
  const st = await ev('__cmwState().morph');
  await ev('__cmwMorph({ playing: false })'); await settle(1500);
  out.push({ page, wait, shots, st });
}
return { out, logs: logs().filter((l) => !/404|favicon/.test(l.m)).slice(0, 6) };
