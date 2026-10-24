async function playCase2(name, steps, z, opt = {}) {
  await loadS(steps);
  await soundOn('phase');
  if (opt.all) await ev(`__cmwSet('homAll', true); 1`);
  const p = await W('L', z[0], z[1]); await rest(p); await settle(1900);
  await takeL();
  await recStart(); await act('m'); await key('m'); const t0 = await ev('performance.now()');
  await sleep(opt.dur || 3000);
  const s = await S_(); const L = await takeL(); await recStop(name);
  const r = { z: s.rest && s.rest.z, run: s.run,
    cues: L.cue.filter((c) => !/morph/.test(c[1])).map((c) => [Math.round(c[0] - t0), c[1] + (/(zero|pole)/.test(c[1]) ? JSON.parse(c[2]).order : ''), c[3]]),
    say: L.say.map((x) => [Math.round(x[0] - t0), x[1]]) };
  await key('m'); await settle(800);
  return r;
}
OUT.K = await playCase2('v4K', [{ type: 'custom', params: { expr: 'z^50-1', cut: 180 }, on: true }], [Math.cos(Math.PI / 50), Math.sin(Math.PI / 50)]);
OUT.L = await playCase2('v4L', [{ type: 'custom', params: { expr: 'sin(1/z)', cut: 180 }, on: true }], [0.05, 0.01]);
OUT.Cut = await playCase2('v4Cut', [{ type: 'custom', params: { expr: 'i*z', cut: 180 }, on: true }, { type: 'custom', params: { expr: 'sqrt(z)', cut: 180 }, on: true }], [0.6 * Math.cos(2.1), 0.6 * Math.sin(2.1)], { all: true });
return OUT;
