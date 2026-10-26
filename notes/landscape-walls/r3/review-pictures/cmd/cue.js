// the per-sheet cue: the same frame with the cue off and on (GLR._lw.cue), at rest and on the moving path, t = 0.03 and 0.05
const out = [];
for (const [dark, phone] of [[false, false], [true, false], [false, true], [true, true]]) {
  if (phone) await view(390, 844, dark, true); else await view(1440, 900, dark, false);
  await ld('test.html', 'cu' + Date.now(), Object.assign({ view: { main: 'land' }, meshN: 240 }, CASES.user, { sheets: true }));
  await settle(1500); await ev('__cmwSetMain("land")'); await settle(2000);
  await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 1 } })'); await settle(900);
  const r = await paneRect();
  const nm = `cue-${phone ? 'phone' : 'desk'}-${dark ? 'dark' : 'light'}`;
  for (const T of [0.03, 0.05]) {
    for (const cue of ['none', 'tint']) {
      await ev(`GLR._lw = Object.assign(GLR._lw || {}, { cue: '${cue}' }); __cmwMorph({ T: ${T + 0.001} }); 1`); await settle(600);
      await ev(`__cmwMorph({ T: ${T} }); 1`); await settle(3500);
      await shot(`${nm}-t${T}-${cue}`, r);
    }
  }
  await ev(`GLR._lw.cue = undefined; 1`);
  out.push({ nm, rect: r, logs: logs().filter((l) => !/404|favicon/.test(l.m)).slice(0, 4) });
}
await view(1440, 900, false, false);
return out;
