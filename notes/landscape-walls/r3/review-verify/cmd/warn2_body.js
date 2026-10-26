// the warning flow with pictures: All sheets, a fresh sqrt formula, deformation f1 -> f2 playing; which frames, and does the picture suffer?
const K0 = 1000 + Math.floor(Math.random() * 8000);
const out = [];
await view(1440, 900, false, false);
let i = 0; logs();
for (const page of ['test.html', 'r2.html', 'base.html']) {
  i++;
  const f = `\\sin\\sqrt{z^2+${K0 + 7 * i}}`;
  await ld(page, 'cx' + Date.now(), { shapes: [], steps: [sq, { type: 'custom', params: { expr: f, cut: 180 }, on: true }], pattern: 'checker', srcView: { cx: 0, cy: 0, s: 60 }, sheets: true, height: 'im' });
  await sleep(2500);
  await ev('__cmwSetMain("land")');
  const t0 = Date.now();
  await sleep(1000);
  await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 2 } }); __cmwMorph({ T: 0, playing: true }); 1');
  const r = await paneRect();
  const rows = [];
  for (const at of [2000, 2800, 3600, 4400, 5500, 7000]) { while (Date.now() - t0 < at) await sleep(20); const n = logs().filter((l) => /WebGL|GL_INVALID/.test(l.m)).length; const T = (await ev('__cmwMorph({})')).T; const s = await shot(`W2-${page.replace(/\W/g, '')}-${at}`, r); rows.push([at, +T.toFixed(3), n, s.split('/').pop()]); }
  await ev('__cmwMorph({ playing: false })'); await settle(2500);
  const nStop = logs().filter((l) => /WebGL|GL_INVALID/.test(l.m)).length;
  const s = await shot(`W2-${page.replace(/\W/g, '')}-stop`, r);
  out.push({ page, f, rows, nStop, stop: s.split('/').pop() });
}
return out;
