globalThis.__fmC = [
  { sheets: false, mesh: 240 }, { sheets: true, mesh: 240 },
  { sheets: false, mesh: 1920 }, { sheets: true, mesh: 1920 },
  { page: 'r2/test.html', sheets: false, mesh: 1920, Ts: [0.2] }, { page: 'r2/test.html', sheets: true, mesh: 1920, Ts: [0.2] },
  { sheets: false, mesh: 1920, dark: true, Ts: [0.2] }, { sheets: true, mesh: 1920, phone: true, Ts: [0.2] }, { sheets: false, mesh: 1920, phone: true, Ts: [0.2] },
];
// forced moving path (GLR._lw.motion, T stepped 0.006 a frame, as the r3 gate) vs rest, at several t, default and Max
const out = [];
const C = globalThis.__fmC || [];
for (const c of C) {
  const { page = 'test.html', sheets, dark = false, mesh = 240, phone = false, Ts = [0.08, 0.2, 0.26] } = c;
  if (phone) await view(390, 844, dark, true); else await view(1440, 900, dark, false);
  await ld(page, 'fm' + Date.now(), Object.assign({ view: { main: 'land' }, meshN: mesh }, CASES.user, { sheets }));
  await settle(1500); await ev('__cmwSetMain("land")'); await settle(2000);
  await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 1 } })'); await settle(900);
  const r = await paneRect();
  const nm = `fm-${page.replace(/\W/g, '').replace('testhtml', '') || 'r3'}-${sheets ? 'allsh' : 'princ'}-${mesh === 240 ? 'def' : 'max'}-${phone ? 'phone' : 'desk'}-${dark ? 'dark' : 'light'}`;
  const row = { nm, rect: r, t: [] };
  for (const T of Ts) {
    await ev(`__cmwMorph({ T: ${T} })`); await settle(4000);
    await shot(`${nm}-t${T}-rest`, r);
    await ev(`__cmwMorph({ T: ${(T - 0.072).toFixed(4)} })`); await settle(1500);
    await ev('GLR._lw = Object.assign(GLR._lw || {}, { motion: true }); 1');
    for (let t = T - 0.066; t < T - 1e-9; t += 0.006) { await ev(`__cmwMorph({ T: ${t.toFixed(4)} }); 1`); await ev('new Promise((r) => requestAnimationFrame(() => r(1)))'); await sleep(10); }
    await ev(`__cmwMorph({ T: ${T} }); 1`); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))');
    await shot(`${nm}-t${T}-move`, r);
    await ev('GLR._lw.motion = false; 1');
    row.t.push(T);
  }
  row.logs = logs().filter((l) => !/404|favicon/.test(l.m)).slice(0, 6);
  out.push(row);
}
await view(1440, 900, false, false);
return out;
