// winding of t -> H_t(z) by fine sampling (the app's own H through the hAt hook); m = morph length
const wind = (zr, zi, m, N = 3000) => ev(`(() => { let a0 = null, tot = 0, mn = 1e9; for (let i = 0; i <= ${N}; i++) { const w = __cmwSound({ hAt: [${m} * i / ${N}, ${zr}, ${zi}] }); const a = Math.atan2(w[1], w[0]); mn = Math.min(mn, Math.hypot(w[0], w[1])); if (a0 != null) { let d = a - a0; d -= 2 * Math.PI * Math.round(d / (2 * Math.PI)); tot += d; } a0 = a; } return { turns: tot / (2 * Math.PI), minAbs: mn }; })()`);
async function playCase(name, steps, z, opt = {}) {
  await loadS(steps);
  await soundOn('phase');
  if (opt.secs) await ev(`__cmwSet('morphSecs', ${opt.secs}); 1`);
  if (opt.all) await ev(`__cmwSet('homAll', true); 1`);
  const p = await W('L', z[0], z[1]); await rest(p); await settle(1900);
  const zz = (await S_()).rest; 
  await takeL();
  await recStart(); await act('m'); await key('m');
  const st0 = await ST();
  const m = await ev('(() => { const s = __cmwState(); return s.morph; })()');
  await sleep(opt.dur || 3000);
  const s = await S_(); const L = await takeL(); await recStop(name);
  const len = opt.len || 1;
  const wd = zz ? await wind(zz.z[0], zz.z[1], len) : null;
  const r = { z: zz && zz.z, wind: wd, run: s.run, cues: cueNames(L), sets: L.vs.length, st: await ST(), live: s.live };
  await key('m'); await settle(800);
  return r;
}
OUT.H_z9 = await playCase('arH', [{ type: 'custom', params: { expr: 'z^9', cut: 180 }, on: true }], [1.2 * Math.cos(170 * Math.PI / 180), 1.2 * Math.sin(170 * Math.PI / 180)]);
const two = [{ type: 'custom', params: { expr: 'z^3', cut: 180 }, on: true }, { type: 'custom', params: { expr: 'z^3', cut: 180 }, on: true }];
OUT.I_seq = await playCase('arIseq', two, [1.1 * Math.cos(100 * Math.PI / 180), 1.1 * Math.sin(100 * Math.PI / 180)], { len: 2, dur: 5000 });
OUT.I_all = await playCase('arIall', two, [1.1 * Math.cos(100 * Math.PI / 180), 1.1 * Math.sin(100 * Math.PI / 180)], { all: true, dur: 3000 });
OUT.J_zero_close = await playCase('arJ1', [{ type: 'custom', params: { expr: 'z-1', cut: 180 }, on: true }], [0.5, 0.03], { secs: 3.2, dur: 4600 });
OUT.J_zero_edge = await playCase('arJ2', [{ type: 'custom', params: { expr: 'z-1', cut: 180 }, on: true }], [0.5, 0.064], { secs: 3.2, dur: 4600 });
OUT.K_z50 = await playCase('arK', [{ type: 'custom', params: { expr: 'z^50-1', cut: 180 }, on: true }], [Math.cos(Math.PI / 50), Math.sin(Math.PI / 50)], { dur: 3000 });
OUT.L_sin = await playCase('arL', [{ type: 'custom', params: { expr: 'sin(1/z)', cut: 180 }, on: true }], [0.05, 0.01], { dur: 3000 });
OUT.M_sqrt = await playCase('arM', [{ type: 'custom', params: { expr: 'sqrt(z)', cut: 180 }, on: true }], [-1, 0.1], { dur: 3000 });
OUT.M_log = await playCase('arMl', [{ type: 'custom', params: { expr: 'log(z)', cut: 180 }, on: true }], [-1, 0.1], { dur: 3000 });
OUT.N_rat = await playCase('arN', [{ type: 'custom', params: { expr: '(z^12-0.3)/(z^12+0.3)', cut: 180 }, on: true }], [0.9, 0.05], { dur: 3000 });
return OUT;
