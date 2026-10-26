const out = { shots: [], errs: [], rf: [] };
const pw = { type: 'pown', params: { n: 3 }, on: true }, lg = { type: 'log', params: { cut: 180, k: 0 }, on: true };
const one = (t) => ({ type: t, params: {}, on: true });
const W = globalThis.__dpr || 1;
for (const dark of [false, true]) {
  await view(1440, 900, dark, false);
  if (W !== 1) await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: W, mobile: false });
  const th = (dark ? 'dark' : 'light') + (W !== 1 ? '-dpr' + W : '');
  await ld('test.html', 'pv' + th + Date.now(), { shapes: [{ id: 's1', kind: 'rect', a: [-3, -3], b: [3, 3] }], steps: [sq, sn], pattern: 'checker', srcView: { cx: 0, cy: 0, s: 60 }, view: { main: 'land' }, sheets: true, height: 'im' });
  await settle(1500); await ev('__cmwSetMain("land")'); await settle(800);
  await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 1 } })'); await settle(900);
  let r = await paneRect();
  for (const [T, hgt] of [[0.05, 'im'], [0.2, 'im'], [0.2, 're'], [1, 'im']]) {
    await ev(`__cmwSet('height', ${JSON.stringify(hgt)}); __cmwMorph({ T: ${T} }); 1`); await settle(3500);
    const name = `u-t${T}-${hgt}-${th}`; await shot(name, r); out.shots.push(name);
    if (T === 0.2 && hgt === 'im') out.rf.push({ name, rf: await ev(RF) });
  }
  if (W !== 1) continue;
  await ld('test.html', 'pl' + th + Date.now(), { shapes: [], steps: [pw, lg], pattern: 'checker', srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'land' }, sheets: true, height: 'im' });
  await settle(1500); await ev('__cmwSetMain("land")'); await settle(800);
  await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 1 } })'); await settle(900);
  r = await paneRect();
  await ev(`__cmwMorph({ T: 0.05 }); 1`); await settle(3500); await shot(`pl-t0.05-${th}`, r); out.shots.push(`pl-t0.05-${th}`);
  for (const [nm, st] of [['tan-re', { steps: [one('tan')], sheets: false, height: 're' }], ['sec-re', { steps: [one('sec')], sheets: false, height: 're' }], ['loglog-im-sheets', { steps: [cust('\\log(\\log z)')], sheets: true, height: 'im' }]]) {
    await ld('test.html', 'pc' + th + Date.now(), Object.assign({ shapes: [], pattern: 'checker', srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'land' } }, st));
    await settle(1500); await ev('__cmwSetMain("land")'); await settle(4000);
    r = await paneRect(); await shot(`${nm}-${th}`, r); out.shots.push(`${nm}-${th}`); out.rf.push({ name: nm, rf: await ev(RF) });
  }
  const l = logs().filter((x) => x.t === 'EXC' || x.t === 'error' || /warn/i.test(x.t) || /GL_|WebGL/.test(x.m)); if (l.length) out.errs.push({ th, l: l.slice(0, 6) });
}
await view(1440, 900, false, false);
return out;
