const th = 170 * Math.PI / 180, Z = [1.2 * Math.cos(th), 1.2 * Math.sin(th)];
const HEAVY = [{ type: 'custom', params: { expr: 'erf(z^2)*erf(1/(z+0.3))', cut: 180 }, on: true }, { type: 'custom', params: { expr: 'erf(z)+erf(2z)+tan(z)*log(z+2)', cut: 180 }, on: true }, { type: 'custom', params: { expr: 'z^5-z', cut: 180 }, on: true }];
const frames = (ms) => ev(`await new Promise((res) => { const t = []; const t0 = performance.now(); const f = () => { t.push(performance.now()); if (performance.now() - t0 < ${ms}) requestAnimationFrame(f); else res(t); }; requestAnimationFrame(f); })`, ms + 20000);
const stat = (t) => { const d = []; for (let i = 1; i < t.length; i++) d.push(t[i] - t[i - 1]); const s = d.slice().sort((a, b) => a - b); return { fps: +(1000 * d.length / (t[t.length - 1] - t[0])).toFixed(1), p95: +s[Math.floor(0.95 * s.length)].toFixed(1), max: +s[s.length - 1].toFixed(1), over20: d.filter((x) => x > 20).length, n: d.length }; };
const res = {};
for (const [chain, steps] of [['heavy', HEAVY]]) {
  await loadS(steps); await soundOn('phase'); await ev(`__cmwSet('morphSecs', 3.2); __cmwSet('homAll', true); 1`);
  const p = await W('L', ...Z); await rest(p); await settle(1500);
  // warm-up play (first-play costs)
  await key('m'); await sleep(3000); await key('m'); await settle(800);
  for (const cpu of [1, 4]) {
    await send('Emulation.setCPUThrottlingRate', { rate: cpu });
    for (const mode of ['off', 'on', 'hearOff', 'on', 'off']) {
      if (mode === 'off') await ev(`Sound.set({ on: false }); 1`); else if (mode === 'hearOff') await ev(`Sound.set({ on: true, sonify: false }); 1`); else await ev(`Sound.set({ on: true, sonify: true }); 1`);
      await rest(p); await settle(600);
      const fc0 = (await S_()).fcN;
      await key('m'); const fr = await frames(2500); const fc1 = (await S_()).fcN; await key('m'); await settle(700);
      (res[chain + '_' + cpu + 'x'] = res[chain + '_' + cpu + 'x'] || []).push(Object.assign({ mode, evals: fc1 - fc0, perEval: (await S_()).perEval }, stat(fr)));
    }
  }
  await send('Emulation.setCPUThrottlingRate', { rate: 1 });
}
return res;
