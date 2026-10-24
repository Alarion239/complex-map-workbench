// v15.2 sound (notes/sound/AS-BUILT-v152.md): hearing the function as the user chose it, in the app. The phase harp
// under the pointer: its low Ds counted up minus down equal the winding number of a loop round a zero, a double zero
// and a pole (rising, rising twice, falling); curves sing: a drawn loop sings W (around a pole: −1), and while the
// deformation plays, the last loop's note changes the moment a zero crosses it; palette B's scrub (the air, the
// landmarks) and the motion bed; Esc and off silent. A command file for the CDP daemon (test/cdp_kit README):
//   python3 build.py && CMW_PORT=<port> node test/<you>_cdp/cdpd.js &   test/<you>_cdp/q.sh test/sound_v152_cmd.js
const PORT = +(process.env.CMW_PORT || 8832), BASE = `http://localhost:${PORT}/test.html`;
const loadHere = async (ns, st) => {
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await sleep(400);
  const o = Object.assign({ v3: true, v4: true, shapes: [], steps: [], nextId: 50, focus: 0, rightMode: 'image' }, st || {});
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
  await send('Page.navigate', { url: `${BASE}?ns=${ns}` }); await sleep(2200);
};
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 400) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const W = (re, im) => ev(`__cmwW2S('L', ${re}, ${im})`);
const snd = () => ev('__cmwSound()');
const glide = async (pts, dt = 16) => { for (const p of pts) { await move(p[0], p[1]); await sleep(dt); } };
const circle = async (c, r, turns = 1, n = 48, a0 = 0.4) => { const out = []; for (let i = 0; i <= n * turns; i++) { const a = a0 + 2 * Math.PI * i / n; out.push(await W(c[0] + r * Math.cos(a), c[1] + r * Math.sin(a))); } return out; };
const spy = () => ev(`(() => { window.__made = []; for (const [k, d] of Object.entries(Sound.CATALOG)) { if (d.__spy) continue; const m = d.make; d.make = (Pt, o) => { __made.push(k); return m(Pt, o); }; d.__spy = 1; } return 1; })()`);
const made = () => ev(`(() => { const m = __made.slice(); __made.length = 0; return m; })()`);
const ns = 'snd152' + Date.now();
const fn = (expr, s = 120) => ({ steps: [{ type: 'custom', params: { expr, cut: 180 }, on: true }], srcView: { cx: 0, cy: 0, s } });
const start = async (expr) => {
  await loadHere(ns, fn(expr));
  await ev(`__cmwSetMain('phase')`); await settle(900);
  await click(5, 300); await settle(200);
  await ev(`Sound.set({ on: true, vol: 0.7, ui: true, events: true, sonify: true }, { quiet: true }); await new Promise((r) => setTimeout(r, 600)); 1`);
  await ev(`__cmwSet('loop', false); 1`);
  await spy();
};
// a pointer loop round c (radius r, laps), the harp's count over it
const harpLoop = async (c, r, laps = 1) => {
  const pts = await circle(c, r, laps, 64);
  await move(pts[0][0], pts[0][1]); await settle(250);
  const phi0 = (await snd()).phi; await ev('Sound.harpCount()');
  await glide(pts); await settle(250);
  return { dphi: +((await snd()).phi - phi0).toFixed(6), harp: await ev('Sound.harpCount()') };
};
logs();
await view(1440, 900, false);

// 1. the harp's count on loops: round a simple zero (twice), a double zero, a simple pole
await start('(z-1)^2*(z+1)/(z-1.5i)');
R.zero2 = await harpLoop([-1, 0], 0.35, 2);
ok('harp: two laps round the simple zero at −1: +2 turns, low Ds 2 up 0 down, rising', Math.abs(R.zero2.dphi - 2) < 1e-6 && R.zero2.harp.up === 2 && R.zero2.harp.down === 0 && R.zero2.harp.notes >= 9, R.zero2);
R.dbl = await harpLoop([1, 0], 0.35, 1);
ok('harp: one lap round the double zero at 1: +2 turns, low Ds 2 up, the scale twice', Math.abs(R.dbl.dphi - 2) < 1e-6 && R.dbl.harp.up === 2 && R.dbl.harp.down === 0 && R.dbl.harp.notes >= 9, R.dbl);
R.pole = await harpLoop([0, 1.5], 0.35, 1);
ok('harp: one lap round the pole at 1.5i: −1 turn, low Ds 0 up 1 down, falling', Math.abs(R.pole.dphi + 1) < 1e-6 && R.pole.harp.up === 0 && R.pole.harp.down === 1 && R.pole.harp.notes >= 4, R.pole);
R.none = await harpLoop([1.6, -1.2], 0.3, 1);
ok('harp: a lap round nothing: no turn, low Ds up − down = 0', Math.abs(R.none.dphi) < 1e-6 && R.none.harp.up === R.none.harp.down, R.none);
// silent while still: no note in 0.8 s with the pointer resting
R.still = await ev(`await (async () => { Sound.harpCount(); await new Promise((r) => setTimeout(r, 800)); return Sound.harpCount(); })()`);
ok('harp: silent while the pointer rests', R.still.notes === 0, R.still);

// 2. curves sing: a loop drawn with the Lasso round the pole sings W = −1 (Hear F on: no pings); round the double
// zero and the simple zero: W = 3 (the first loop of the page plays itself first: the harp along it, then the note)
await key('o'); await settle(200);
const lasso = async (c, r) => {
  const L = await circle(c, r, 1, 64);
  await move(L[0][0], L[0][1]); await settle(200); await made();
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: L[0][0], y: L[0][1], button: 'left', clickCount: 1 });
  for (const p of L.slice(1)) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p[0], y: p[1], button: 'left', buttons: 1 }); await sleep(16); }
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: L[L.length - 1][0], y: L[L.length - 1][1], button: 'left', clickCount: 1 });
  await sleep(300);
  const s = await snd();
  return { live: s.live, sang: s.sang, play: s.play, listenHarp: s.listenHarp, made: await made(), sing: await ev('Sound.singState()') };
};
R.l1 = await lasso([0, 0], 1.25);
ok('loop 1 round −1 and the double zero at 1 (W = 3): plays itself with the harp (3 low Ds up), then sings W = 3', /^Winding number 3/.test(R.l1.live) && R.l1.play && R.l1.listenHarp && R.l1.listenHarp.up === 3 && R.l1.listenHarp.down === 0 && R.l1.sang === 3, R.l1);
await key('Escape'); await sleep(200);
R.esc = { play: (await snd()).play, sing: await ev('Sound.singState()'), on: await ev('Sound.prefs().on') };
ok('Esc: the playback and its note stop, sound stays on', !R.esc.play && !R.esc.sing.on && R.esc.on, R.esc);
await key('o'); await settle(200);
R.l2 = await lasso([0, 1.5], 0.4);
ok('loop 2 round the pole: "Winding number -1", sings W = −1 (no pings), no playback', /Winding number -1|Winding number −1/.test(R.l2.live) && R.l2.sang === -1 && R.l2.sing.on && !R.l2.made.includes('loopDone') && !R.l2.play, R.l2);
// with Hear F off, a loop sounds palette B's pings instead
await ev(`Sound.set({ sonify: false }); 1`); await settle(300);
await key('o'); await settle(200);
R.l3 = await lasso([-1, 0], 0.4);
ok('loop 3 with Hear F off: the pings (loopDone), no note', /Winding number 1/.test(R.l3.live) && R.l3.made.includes('loopDone') && R.l3.sang === -1, R.l3);
await key('v'); await settle(200);

// 3. curves sing while the deformation plays: z − 1 (H_t(z) = z − t: its zero runs from 0 to 1), the last loop
// |z − 0.75| = 0.3 (from 0.45 to 1.05): W = 0 until the zero enters it at t = 0.45, then W = 1; the note steps there
await start('z-1');
{
  const pts = []; for (let j = 0; j < 96; j++) { const a = 2 * Math.PI * j / 96; pts.push([0.75 + 0.3 * Math.cos(a), 0.3 * Math.sin(a)]); }
  await ev(`__cmwSound({ lastLoop: ${JSON.stringify(pts)} }); 1`);
  await move(5, 600); await settle(200);
  await key('m');
  const tr = await ev(`await new Promise((res) => { const out = [], t0 = performance.now(); const f = () => { const s = __cmwSound(), m = __cmwState().morph; out.push([s.cv.T == null ? m.T : s.cv.T, s.cv.W, s.cv.on ? 1 : 0, Sound.singState().on ? 1 : 0]); if (performance.now() - t0 < 2600) requestAnimationFrame(f); else res(out); }; requestAnimationFrame(f); })`, 20000);
  const Ws = tr.filter((x) => x[1] != null);
  const step = tr.find((x, i) => i && x[1] === 1 && tr[i - 1][1] !== 1);
  R.deformLoop = { n: tr.length, first: Ws[0], last: Ws[Ws.length - 1], step, singing: tr.filter((x) => x[3]).length, live: (await snd()).live };
  ok('deformation: the loop sings while t runs (W 0 at first, 1 at the end)', Ws.length > 40 && Ws[0][1] === 0 && Ws[Ws.length - 1][1] === 1 && R.deformLoop.singing > 40, R.deformLoop);
  // (the t at which the loop's note was computed: the frame steps t by up to 0.03 in the middle of the eased play)
  const before = step && tr[tr.indexOf(step) - 1];
  R.deformLoop.before = before;
  ok('deformation: the note steps 0 → 1 when the zero enters the loop (t = 0.45, between two frames)', step && before && before[0] <= 0.45 + 1e-9 && step[0] >= 0.45 && step[0] - before[0] < 0.05, { before, step });
  ok('deformation: the change is spoken once', /Winding number of the loop: 1/.test(R.deformLoop.live), R.deformLoop.live);
  await sleep(1500);
  R.deformAfter = { sing: await ev('Sound.singState()'), cv: (await snd()).cv };
  ok('deformation: the note fades 0.9 s after t stops', !R.deformAfter.sing.on && !R.deformAfter.cv.on, R.deformAfter);
  // the motion bed is off while Hear F is on; with Hear F off it follows a play (the synth's texture 2)
  await key('m'); await settle(300);
}

// 4. palette B's scrub with the slider (real input events): the landmarks ring, the texture runs, it fades on release
await ev(`Sound.set({ sonify: false }); 1`);
await key('m'); await sleep(2800); await made();
{
  const r = await ev(`(() => { const e = document.getElementById('morphRange').getBoundingClientRect(); return [e.left, e.right, e.top + e.height / 2]; })()`);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r[1] - 2, y: r[2] });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r[1] - 2, y: r[2], button: 'left', clickCount: 1 });
  let mid = null;
  for (let i = 1; i <= 50; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r[1] - 2 - (r[1] - r[0] - 4) * i / 50, y: r[2], button: 'left', buttons: 1 }); await sleep(16); if (i === 25) mid = await ev('Sound.scrubState()'); }
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r[0] + 2, y: r[2], button: 'left', clickCount: 1 });
  await sleep(200);
  R.scrub = { mid, after: await ev('Sound.scrubState()'), made: await made() };
  const lm = R.scrub.made.filter((x) => x === 'landmark').length;
  ok('scrub: the air while dragging, the landmarks ¾ ½ ¼ 0 (3 to 4), no other cue; the air ends on release', mid.tex && mid.v > 0.3 && !R.scrub.after.tex && lm >= 3 && lm <= 4 && R.scrub.made.every((x) => x === 'landmark'), R.scrub);
}
await key('m'); await settle(300);

// 5. off while the harp rings: silent, suspended
await ev(`Sound.set({ sonify: true }); 1`); await settle(200);
{
  const pts = await circle([0, 0], 0.3, 1, 24);
  await glide(pts, 10);
  R.off = await ev(`await (async () => { __made.length = 0; Sound.set({ on: false }); const m = __made.length; await new Promise((r) => setTimeout(r, 150)); return { made: m, audio: Sound.state().audio, harp: Sound.harp(0.5, {}) }; })()`);
  ok('off while the harp rings: no sound made, suspended, the harp refuses', R.off.made === 0 && R.off.audio === 'suspended' && R.off.harp === null, R.off);
}
// 6. (review sound-1) Esc while the deformation plays: silent until the next thing a person does. Hear F off: the motion
// bed is over for this play (no re-arm on the next frames); Hear F on: the last loop does not sing H_t again
for (const hear of [false, true]) {
  await start('z-1');
  await ev(`Sound.set({ sonify: ${hear} }); 1`);
  if (hear) { const pts = []; for (let j = 0; j < 96; j++) { const a = 2 * Math.PI * j / 96; pts.push([0.75 + 0.3 * Math.cos(a), 0.3 * Math.sin(a)]); } await ev(`__cmwSound({ lastLoop: ${JSON.stringify(pts)} }); 1`); }
  await move(5, 600); await settle(200);
  await ev(`__cmwSet('morphSecs', 4); 1`);
  await key('m'); await sleep(600);
  const before = { arm: (await snd()).morphArm, sing: (await ev('Sound.singState()')).on };
  await key('Escape');
  const after = [];
  for (let i = 0; i < 8; i++) { await sleep(100); const s = await snd(); after.push({ playing: (await ev('__cmwState().morph.playing')), arm: s.morphArm, sing: (await ev('Sound.singState()')).on, cv: s.cv.on }); }
  R['esc' + (hear ? 'HearOn' : 'HearOff')] = { before, after };
  ok(`Esc while the deformation plays (Hear F ${hear ? 'on' : 'off'}): it plays on, and nothing sounds again (no motion bed, no loop note) for 0.8 s`, after.some((a) => a.playing) && after.every((a) => !a.arm && !a.sing && !a.cv) && (hear ? before.sing : before.arm), { before, after });
  // the next action lets it sound: Play again
  if (hear) { await key('m'); await sleep(150); await key('m'); await sleep(700); R.escUnhush = { sing: (await ev('Sound.singState()')).on, cv: (await snd()).cv }; ok('after Esc, Play again: the loop sings again', R.escUnhush.cv.on || R.escUnhush.sing, R.escUnhush); }
  await key('m'); await settle(200);
}
// 7. (review sound-3) a finger held still 10 px from a zero on the D line (arg F = 0), trembling ±1.5 px at about
// 9 Hz for 3 s: the harp plucks nothing (it chattered: 100+ notes in 10 s before)
await start('z');
await ev(`Sound.set({ sonify: true }); 1`);
{
  const c = await W(0, 0);
  const x0 = c[0] + 10, y0 = c[1];
  await move(x0, y0); await settle(300); await ev('Sound.harpCount()');
  for (let k = 0; k < 180; k++) { const t = k / 60; await move(x0 + 1.5 * Math.sin(2 * Math.PI * 9 * t), y0 + 1.5 * Math.sin(2 * Math.PI * 8.3 * t + 1)); await sleep(16); }
  R.held = await ev('Sound.harpCount()');
  ok('a held finger 10 px from a zero, trembling ±1.5 px: no note', R.held.notes === 0, R.held);
  // and a real circle round it still counts: one lap, 1 low D up
  R.heldLap = await harpLoop([0, 0], 0.25, 1);
  ok('the same zero, one lap of radius 0.25: low Ds 1 up 0 down', R.heldLap.harp.up === 1 && R.heldLap.harp.down === 0, R.heldLap);
}
const exc = logs().filter((l) => l.t === 'EXC' || /Uncaught|TypeError|ReferenceError/.test(l.m || ''));
ok('no exceptions', !exc.length, exc.slice(0, 5));
await ev(`Sound.set({ on: false }); 1`);
return { pass: !fails.length, nfail: fails.length, fails, R };
