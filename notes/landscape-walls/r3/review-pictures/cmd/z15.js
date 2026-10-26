// z^{1/5} tan 3z, All sheets, Re: is more than one sheet drawn? this build, round 2, base; with and without the deformation transport
const out = [];
await view(1440, 900, false, false);
for (const page of ['test.html', 'r2/test.html', 'base/test.html']) for (const morph of [false, true]) {
  await ld(page, 'z5' + Date.now(), Object.assign({ shapes: [], pattern: 'checker', view: { main: 'land' }, meshN: 240 }, CASES.z15tan));
  await settle(1500); await ev('__cmwSetMain("land")'); await settle(2500);
  if (morph) { await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 1 } })'); await settle(900); await ev('__cmwMorph({ T: 1 })'); }
  await settle(4000);
  const r = await paneRect();
  const nm = `z15-${page.replace(/\W/g, '')}-${morph ? 'morph' : 'plain'}`;
  await shot(nm, r);
  const info = await ev(`(() => { try { const R = GLR.landRefine ? GLR.landRefine(false) : null; return R && { sheetsK: R.sheets && R.sheets.K, land: !!R.land }; } catch (e) { return String(e); } })()`);
  out.push({ nm, info, title: await ev(`(document.querySelector('#paneL .ptitle, #paneL .title, #paneL header') || {}).textContent || ''`), logs: logs().filter((l) => !/404|favicon/.test(l.m)).slice(0, 4) });
}
return out;
