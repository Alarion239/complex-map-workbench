const th = 170 * Math.PI / 180, Z = [1.2 * Math.cos(th), 1.2 * Math.sin(th)];
const pk = async (k, vk) => { await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: k, code: k, windowsVirtualKeyCode: vk }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: k, windowsVirtualKeyCode: vk }); };
await loadS([{ type: 'custom', params: { expr: 'z^9', cut: 180 }, on: true }]); await soundOn('phase');
const res = {};
for (const gap of [700, 1900]) {
  const p = await W('L', ...Z); await rest(p); await settle(1900);
  await ev(`__cmwMorph({ open: true }); __cmwMorph({ playing: false }); __cmwMorph({ T: 0 }); 1`); await sleep(500);
  await ev(`document.getElementById('morphRange').focus(); 1`); await takeL();
  for (let i = 0; i < 10; i++) { await pk('PageUp', 33); await sleep(gap); }
  const s = await S_(); const L = await takeL();
  res['gap' + gap] = { T: (await ST()).T, turns: L.cue.filter((c) => c[1] === 'turn').length, phiTotal: s.phi, run: s.run, sets: L.vs.length };
  await ev(`__cmwMorph({ open: false }); 1`); await settle(800);
}
return res;
