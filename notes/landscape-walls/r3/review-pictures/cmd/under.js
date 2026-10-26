// from below: the user's case, All sheets, t = 0.05 and playing, light and dark, default mesh
const out = [];
for (const dark of [false, true]) {
  await view(1440, 900, dark, false);
  await ld('test.html', 'un' + Date.now(), Object.assign({ shapes: [], pattern: 'checker', view: { main: 'land' }, meshN: 240 }, CASES.user, { sheets: true }));
  await settle(1500); await ev('__cmwSetMain("land")'); await settle(2000);
  await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 1 } })'); await settle(900);
  const c0 = await ev('__cmwCam("L")');
  await ev(`__cmwCam('L', { pitch: ${-Math.abs(c0.pitch)} }); __cmwMorph({ T: 0.05 }); 1`); await settle(4000);
  const r = await paneRect();
  const nm = `under-${dark ? 'dark' : 'light'}`;
  await shot(nm + '-rest', r);
  await ev('__cmwMorph({ playing: true })');
  for (let i = 0; i < 6; i++) await shot(`${nm}-play${i}`, r);
  await ev('__cmwMorph({ playing: false })');
  out.push({ nm, c0 });
}
await view(1440, 900, false, false);
return out;
