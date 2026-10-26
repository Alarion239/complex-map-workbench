globalThis.__pages = undefined; globalThis.__mesh = undefined; globalThis.__noOrbit = undefined; globalThis.__views = undefined; globalThis.__dark = undefined;
const out = { cap: [], errs: [] };
await view(1440, 900, false, false);
for (const meshN of [240, 1920]) for (const [name, st, T] of [
  ['z^(1/5) tan 3z AllSh Re', { steps: [cust('z^{1/5}\\tan(3z)')], sheets: true, height: 're' }],
  ['user t=0.2 AllSh Im', { steps: [sq, sn], sheets: true, height: 'im' }, 0.2]]) {
  await openCase('test.html', Object.assign({ meshN }, st), T);
  await settle(2500);
  const r = await ev(RF); const p = (o) => o && `capped=${o.capped} Lc=${o.Lc} evals=${o.evals} need=${o.need} g=${o.g}`;
  out.cap.push(`m${meshN} ${name}: sheets ${p(r.sheets)}`);
  if (name.startsWith('z^')) await shot(`ztan-allsh-re-m${meshN}`, await paneRect());
}
const l = logs().filter((x) => x.t === 'EXC' || x.t === 'error' || /warn/i.test(x.t) || /GL_|WebGL/.test(x.m)); if (l.length) out.errs.push(l.slice(0, 6));
return out;
