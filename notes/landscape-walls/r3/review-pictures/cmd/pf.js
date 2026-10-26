// phone 390 x 844, Max mesh, the user's case playing with All sheets: frame times, this build and the base alternating
const out = [];
for (const k of [0, 1]) for (const page of ['test.html', 'base/test.html']) {
  await view(390, 844, false, true);
  await ld(page, 'pf' + Date.now(), Object.assign({ shapes: [], pattern: 'checker', view: { main: 'land' }, meshN: 1920 }, CASES.user, { sheets: true }));
  await settle(1500); await ev('__cmwSetMain("land")'); await settle(2500);
  await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 1 } })'); await settle(900);
  await ev('__cmwMorph({ T: 0, playing: true })'); await sleep(600);
  const f = await ev('await (async () => await __qa.frames(3000))()', 30000);
  await ev('__cmwMorph({ playing: false })');
  out.push({ page, k, f });
}
await view(1440, 900, false, false);
return out;
