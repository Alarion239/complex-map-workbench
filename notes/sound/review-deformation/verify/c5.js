const th = 170 * Math.PI / 180, Z = [1.2 * Math.cos(th), 1.2 * Math.sin(th)];
const POW5 = [{ type: 'custom', params: { expr: 'z^5', cut: 180 }, on: true }];
// P: Landscape, loop on, pointer resting on the relief
await loadS(POW5); await soundOn('land'); await ev(`__cmwSet('loop', true); 1`);
{ const b = await ev(`(() => { const r = document.elementFromPoint(400, 450).getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()`);
  const p = [b[0] + b[2] * 0.42, b[1] + b[3] * 0.55]; await rest(p); await settle(1900); await takeL();
  await recStart(); await act('m'); await key('m'); const t0 = await ev('performance.now()'); await sleep(6000);
  const s = await S_(); const L = await takeL(); await recStop('v5P');
  OUT.P = { kind: s.kind, rest: s.rest, sets: L.vs.length, cues: L.cue.filter((c) => !/morph/.test(c[1])).map((c) => [Math.round(c[0] - t0), c[1], c[3]]).slice(0, 40), ncontour: L.cue.filter((c) => c[1] === 'tick').length };
  await key('m'); await settle(800); await ev(`__cmwSet('loop', false); 1`);
}
// Q: keyboard scrub on the slider while the pointer rests on X's Phase plane
await ev(`__cmwSetMain('phase')`); await settle(900);
{ const p = await W('L', ...Z); await rest(p); await settle(1900);
  await ev(`__cmwMorph({ open: true }); __cmwMorph({ playing: false }); __cmwMorph({ T: 0 }); 1`); await settle(400);
  const rest0 = (await S_()).rest;
  await ev(`document.getElementById('morphRange').focus(); 1`); await takeL();
  await recStart(); const t0 = await ev('performance.now()');
  for (let i = 0; i < 20; i++) { await key('ArrowRight'); await sleep(60); }
  await sleep(300);
  for (let i = 0; i < 20; i++) { await key('ArrowLeft'); await sleep(60); }
  await sleep(500);
  const s = await S_(); const L = await takeL(); await recStop('v5Q');
  OUT.Q = { rest0, rest: s.rest, sets: L.vs.length, run: s.run, T: (await ST()).T, cues: L.cue.map((c) => [Math.round(c[0] - t0), c[1], c[3]]).filter((c) => c[1] !== 'morphTick').slice(0, 20), nticks: L.cue.filter((c) => c[1] === 'morphTick').length };
  await ev(`__cmwMorph({ open: false }); 1`); await settle(600);
}
// R: the keyboard probe, Loop on, the deformation plays: does the 280 ms keyboard sample rule hold?
{ await ev(`__cmwSet('loop', true); 1`);
  const p = await W('L', 0, 0);
  await ev(`(() => { const el = document.elementFromPoint(${p[0]}, ${p[1]}); el.focus(); return el.tagName; })()`); await sleep(200);
  await key('ArrowRight'); await sleep(150); await key('ArrowUp'); await sleep(600);
  const s0 = await S_(); await takeL();
  await recStart(); await key('m'); const t0 = await ev('performance.now()'); await sleep(5000);
  const s = await S_(); const L = await takeL(); await recStop('v5R');
  const g = L.gate; const sets = L.vs.map((v) => Math.round(v[0] - t0));
  OUT.R = { kz0: s0.kz, kbd: s0.kbd, rest: s.rest, sets: L.vs.length, lastSet: sets[sets.length - 1], gatesOn: g.filter((x) => x[1]).length, gatesOff: g.filter((x) => !x[1]).length, voice: s.voice, active: await ev('document.activeElement.tagName') };
  await key('m'); await settle(500); await ev(`__cmwSet('loop', false); 1`);
}
return OUT;
