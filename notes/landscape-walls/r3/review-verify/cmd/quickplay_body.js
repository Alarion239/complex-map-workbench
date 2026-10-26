// open the transport and play at once (no rest frame at t > 0 first): frames mid-play
const out = [];
for (const [page, sheets, mesh, dark] of [['test.html', false, 240, false], ['test.html', true, 240, false], ['test.html', false, 1920, false], ['base.html', false, 240, false], ['r2.html', false, 240, false]]) {
  await view(1440, 900, dark, false);
  await ld(page, 'qp' + Date.now(), Object.assign({}, CASES.user, { meshN: mesh, sheets, view: { main: 'land' } }));
  await settle(1500); await ev('__cmwSetMain("land")'); await settle(3500);
  const r = await paneRect();
  await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 1 } }); __cmwMorph({ T: 0, playing: true }); 1');
  const shots = [];
  for (let i = 0; i < 8; i++) { await sleep(120); const a = (await ev('__cmwMorph({})')).T; const f = await shot(`Q-${page.replace(/\W/g, '')}-${sheets ? 'all' : 'prin'}-${mesh}-${i}`, r); const b = (await ev('__cmwMorph({})')).T; shots.push([f.split('/').pop(), +a.toFixed(3), +b.toFixed(3)]); }
  await ev('__cmwMorph({ playing: false })'); await settle(2500);
  shots.push([(await shot(`Q-${page.replace(/\W/g, '')}-${sheets ? 'all' : 'prin'}-${mesh}-rest`, r)).split('/').pop(), (await ev('__cmwMorph({})')).T]);
  out.push({ page, sheets, mesh, shots });
}
return { out, logs: logs().filter((l) => !/404|favicon/.test(l.m)).slice(0, 6) };
