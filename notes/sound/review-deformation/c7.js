const th = 170 * Math.PI / 180, Z = [1.2 * Math.cos(th), 1.2 * Math.sin(th)];
const pk = async (k, vk) => { await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: k, code: k, windowsVirtualKeyCode: vk }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: k, windowsVirtualKeyCode: vk }); };
await loadS([{ type: 'custom', params: { expr: 'z-1', cut: 180 }, on: true }]); await soundOn('phase');
const p = await W('L', 0.5, 0.03); await rest(p); await settle(1900);
await ev(`__cmwMorph({ open: true }); __cmwMorph({ playing: false }); __cmwMorph({ T: 0 }); 1`); await sleep(500);
await ev(`document.getElementById('morphRange').focus(); 1`); await takeL();
await recStart(); const t0 = await ev('performance.now()'); const Ts = [];
for (let i = 0; i < 10; i++) { await pk('PageUp', 33); await sleep(120); Ts.push((await ST()).T); }
await sleep(300);
for (let i = 0; i < 10; i++) { await pk('PageDown', 34); await sleep(120); Ts.push((await ST()).T); }
await sleep(400);
const s = await S_(); const L = await takeL(); await recStop('arQ2');
OUT.Q = { Ts, rest: s.rest, sets: L.vs.length, run: s.run, cues: L.cue.map((c) => [Math.round(c[0] - t0), c[1] + (/(zero|pole)/.test(c[1]) ? JSON.parse(c[2]).order : ''), c[3]]).filter((c) => !/morphTick/.test(c[1])), nticks: L.cue.filter((c) => c[1] === 'morphTick').length, say: L.say.map((x) => [Math.round(x[0] - t0), x[1]]) };
await ev(`__cmwMorph({ open: false }); 1`);
return OUT;
