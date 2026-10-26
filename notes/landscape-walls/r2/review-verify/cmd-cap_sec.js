globalThis.__pages = undefined; globalThis.__mesh = undefined; globalThis.__noOrbit = undefined; globalThis.__views = undefined; globalThis.__dark = undefined;
const out = { cap: [], sec: [], errs: [] };
await view(1440, 900, false, false);
for (const meshN of [240, 1920]) for (const [name, st, T] of [
  ['user t=0.2 AllSh Im', { steps: [sq, sn], sheets: true, height: 'im' }, 0.2],
  ['user t=0.2 Im', { steps: [sq, sn], sheets: false, height: 'im' }, 0.2],
  ['z^(1/5) tan 3z AllSh Re', { steps: [cust('z^{1/5}\\tan(3z)')], sheets: true, height: 're' }],
  ['tan Re', { steps: [{ type: 'tan', params: {}, on: true }], sheets: false, height: 're' }]]) {
  await openCase('test.html', Object.assign({ meshN }, st), T);
  await settle(2500);
  const r = await ev(RF); const p = (o) => o && `capped=${o.capped} Lc=${o.Lc} evals=${o.evals} need=${o.need}`;
  out.cap.push(`m${meshN} ${name}: land ${p(r.land)} | sheets ${p(r.sheets)}`);
}
for (const dark of [false, true]) {
  await view(1440, 900, dark, false);
  for (const meshN of [240, 1920]) {
    await ld('test.html', 'sec' + Date.now(), { meshN, shapes: [], steps: [cust('\\sec z')], pattern: 'checker', srcView: { cx: 0, cy: 0, s: 60 }, view: { main: 'land' }, sheets: false, height: 're' });
    await settle(1500); await ev('__cmwSetMain("land")'); await settle(4000);
    const r = await paneRect(); const nm = `sec-re-m${meshN}-${dark ? 'dark' : 'light'}`; await shot(nm, r);
    const f = await ev(RF); out.sec.push(`${nm}: capped=${f.land.capped} Lc=${f.land.Lc} evals=${f.land.evals}`);
  }
}
const l = logs().filter((x) => x.t === 'EXC' || x.t === 'error' || /warn/i.test(x.t) || /GL_|WebGL/.test(x.m)); if (l.length) out.errs.push(l.slice(0, 6));
await view(1440, 900, false, false);
return out;
