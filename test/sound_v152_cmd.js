// v15.2 sound (notes/sound/AS-BUILT-v152.md): hearing the function as the user chose it, in the app. Under the
// pointer, the notes of Hear the function (v16.5: the marimba at each colour line arg F crosses, which replaced the
// pointer harp): the red line's crossings (its low D) counted up minus down equal the winding number of a loop round
// a zero, a double zero and a pole (rising, rising twice, falling), a note at each colour line crossed; curves sing: a drawn loop sings W (around a pole: −1), and while the
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
// (v16.5: the engine's Sound.hear.state().counts run since load; __hearCount() reads them as __hearCount() did, since
// its last call: up and down the red line's crossings (line k ≡ 0 mod n, the low D), notes the notes played, merged
// the crossings merged into one note, cracks the cuts; as sound_cmd.js's hearCount)
const inj = await send('Page.addScriptToEvaluateOnNewDocument', { source: '(() => { window.__hearCount = () => { const c = Sound.hear.state().counts, p = window.__hc0 || { dUp: 0, dDown: 0, notes: 0, merged: 0, cracks: 0 }; window.__hc0 = { dUp: c.dUp, dDown: c.dDown, notes: c.notes, merged: c.merged, cracks: c.cracks }; return { up: c.dUp - p.dUp, down: c.dDown - p.dDown, notes: c.notes - p.notes, merged: c.merged - p.merged, cracks: c.cracks - p.cracks }; }; })();' });
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
// a pointer loop round c (radius r, laps), the notes' count over it
const harpLoop = async (c, r, laps = 1) => {
  const pts = await circle(c, r, laps, 64);
  await move(pts[0][0], pts[0][1]); await settle(250);
  const phi0 = (await snd()).phi; await ev('__hearCount()');
  await glide(pts); await settle(250);
  return { dphi: +((await snd()).phi - phi0).toFixed(6), harp: await ev('__hearCount()') };
};
logs();
await view(1440, 900, false);

// 1. the notes' count on loops: round a simple zero (twice), a double zero, a simple pole (n = 12 colour lines: a note
// at each line crossed, 12 a turn; the probe is roped 3 px behind the pointer, so its turns end up to 3 px of arc short
// of the pointer's: under 0.03 turns round a simple zero or pole here, twice that round the double zero; and the
// lap's last line may be left out)
await start('(z-1)^2*(z+1)/(z-1.5i)');
R.zero2 = await harpLoop([-1, 0], 0.35, 2);
ok('notes: two laps round the simple zero at −1: +2 turns, the red line 2 up 0 down, a note at each line crossed (23 or 24)', R.zero2.dphi > 1.97 && R.zero2.dphi <= 2 + 1e-6 && R.zero2.harp.up === 2 && R.zero2.harp.down === 0 && R.zero2.harp.notes + R.zero2.harp.merged >= 23 && R.zero2.harp.notes + R.zero2.harp.merged <= 24, R.zero2);
R.dbl = await harpLoop([1, 0], 0.35, 1);
ok('notes: one lap round the double zero at 1: +2 turns, the red line 2 up, the 12 lines twice (23 or 24 notes)', R.dbl.dphi > 1.94 && R.dbl.dphi <= 2 + 1e-6 && R.dbl.harp.up === 2 && R.dbl.harp.down === 0 && R.dbl.harp.notes + R.dbl.harp.merged >= 23 && R.dbl.harp.notes + R.dbl.harp.merged <= 24, R.dbl);
R.pole = await harpLoop([0, 1.5], 0.35, 1);
ok('notes: one lap round the pole at 1.5i: −1 turn, the red line 0 up 1 down, falling (11 or 12 notes)', R.pole.dphi < -0.97 && R.pole.dphi >= -1 - 1e-6 && R.pole.harp.up === 0 && R.pole.harp.down === 1 && R.pole.harp.notes + R.pole.harp.merged >= 11 && R.pole.harp.notes + R.pole.harp.merged <= 12, R.pole);
R.none = await harpLoop([1.6, -1.2], 0.3, 1);
ok('notes: a lap round nothing: no turn, the red line up − down = 0', Math.abs(R.none.dphi) < 0.03 && R.none.harp.up === R.none.harp.down, R.none);
// silent while still: no note in 0.8 s with the pointer resting
R.still = await ev(`await (async () => { __hearCount(); await new Promise((r) => setTimeout(r, 800)); return __hearCount(); })()`);
ok('notes: silent while the pointer rests', R.still.notes === 0, R.still);

// 2. curves sing: a loop drawn with the Lasso round the pole sings W = −1 (Hear F on: no pings); round the double
// zero and the simple zero: W = 3 (the first loop of the page plays itself first: Listen along, the function's notes
// along it, then the note)
await key('o'); await settle(200);
const lasso = async (c, r) => {
  const L = await circle(c, r, 1, 64);
  await move(L[0][0], L[0][1]); await settle(200); await made();
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: L[0][0], y: L[0][1], button: 'left', clickCount: 1 });
  for (const p of L.slice(1)) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p[0], y: p[1], button: 'left', buttons: 1 }); await sleep(16); }
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: L[L.length - 1][0], y: L[L.length - 1][1], button: 'left', clickCount: 1 });
  await sleep(300);
  const s = await snd();
  return { live: s.live, sang: s.sang, play: s.play, listenFn: s.listenFn, made: await made(), sing: await ev('Sound.singState()') };
};
R.l1 = await lasso([0, 0], 1.25);
ok('loop 1 round −1 and the double zero at 1 (W = 3): plays itself (Listen along: the function\'s notes, 36 lines), then sings W = 3', /^Winding number 3/.test(R.l1.live) && R.l1.play && R.l1.listenFn && R.l1.listenFn.mode === 'notes' && R.l1.listenFn.counts && R.l1.listenFn.counts.notes >= 18 && R.l1.listenFn.counts.notes <= 36 && R.l1.sang === 3, R.l1);
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

// 5. off while the notes ring: silent, suspended
await ev(`Sound.set({ sonify: true }); 1`); await settle(200);
{
  const pts = await circle([0, 0], 0.3, 1, 24);
  await glide(pts, 10);
  R.off = await ev(`await (async () => { __made.length = 0; Sound.set({ on: false }); const m = __made.length; await new Promise((r) => setTimeout(r, 150)); return { made: m, audio: Sound.state().audio, hear: Sound.hear.step({ t: performance.now() / 1000, phi: 0.3, ln: 0 }) }; })()`);
  ok('off while the notes ring: no sound made, suspended, Sound.hear refuses a step', R.off.made === 0 && R.off.audio === 'suspended' && R.off.hear === null, R.off);
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
// 9 Hz for 3 s: no note (the harp chattered there: 100+ notes in 10 s before; the notes' Schmitt band holds)
await start('z');
await ev(`Sound.set({ sonify: true }); 1`);
{
  const c = await W(0, 0);
  const x0 = c[0] + 10, y0 = c[1];
  await move(x0, y0); await settle(300); await ev('__hearCount()');
  for (let k = 0; k < 180; k++) { const t = k / 60; await move(x0 + 1.5 * Math.sin(2 * Math.PI * 9 * t), y0 + 1.5 * Math.sin(2 * Math.PI * 8.3 * t + 1)); await sleep(16); }
  R.held = await ev('__hearCount()');
  ok('a held finger 10 px from a zero, trembling ±1.5 px: no note', R.held.notes === 0, R.held);
  // and a real circle round it still counts: one lap, 1 low D up
  R.heldLap = await harpLoop([0, 0], 0.25, 1);
  ok('the same zero, one lap of radius 0.25: the red line 1 up 0 down, the 12 lines (11 or 12 notes)', R.heldLap.harp.up === 1 && R.heldLap.harp.down === 0 && R.heldLap.harp.notes + R.heldLap.harp.merged >= 11 && R.heldLap.harp.notes + R.heldLap.harp.merged <= 12, R.heldLap);
}
// 8. (review verify-1, v15.2.1) the phone: a long press near a zero, then one lap round it that stops where it began.
// Its D sounds at the end, from any start: 3°, 5° and 8° above the D line 15 px from the zero, 3° at 30 px, and 5.7°
// at 6 px (inside the harp's D-only zone, where that lap was silent); then the finger held there with a ±1.5 px
// tremor: no note
{
  const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
  await send('Emulation.setUserAgentOverride', { userAgent: ANDROID, acceptLanguage: 'en-US,en' });
  await view(390, 844, false, true);
  await loadHere(ns + 'ph', fn('z'));
  await ev(`__cmwSetMain('phase')`); await settle(900);
  await ev(`Sound.set({ on: true, vol: 0.7, ui: true, events: true, sonify: true }, { quiet: true }); await new Promise((r) => setTimeout(r, 600)); 1`);
  await ev(`__cmwSet('loop', false); 1`);
  const T = (type, pts) => send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p) => ({ x: p[0], y: p[1], id: 1, radiusX: 4, radiusY: 4, force: 1 })) });
  const c0 = await W(0, 0);
  const lap = async (r, deg, n = 48) => {
    const a0 = deg * Math.PI / 180, P = (a) => [c0[0] + r * Math.cos(a), c0[1] - r * Math.sin(a)];
    await T('touchStart', [P(a0)]); await sleep(650);
    await ev('__hearCount()');
    for (let i = 1; i <= n; i++) { await T('touchMove', [P(a0 + 2 * Math.PI * i / n)]); await sleep(16); }
    // (touchmoves reach the page at its next frame, merged: where frames are slow the lap's last ones are still queued)
    await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
    const h = await ev('__hearCount()');
    const [x0, y0] = P(a0);
    for (let k = 0; k < 90; k++) { const t = k / 60; await T('touchMove', [[x0 + 1.5 * Math.sin(2 * Math.PI * 9 * t), y0 + 1.5 * Math.sin(2 * Math.PI * 8.3 * t + 1)]]); await sleep(16); }
    const held = await ev('__hearCount()');
    // (v16.5: the probe is roped 5 px behind the finger; when the finger lifts it jumps onto the finger's point, so the
    // lap's last crossings, its D among them, sound at the lift. The finger is back at the lap's end, then lifts: the
    // lap's count is its stroke's and the lift's, the hold's tremor counted apart)
    await T('touchMove', [P(a0)]); await sleep(16);
    await T('touchEnd', []); await sleep(300);
    const lift = await ev('__hearCount()');
    return { up: h.up + lift.up, down: h.down + lift.down, notes: h.notes + lift.notes, merged: h.merged + lift.merged, held: held.notes, lift };
  };
  R.touchLaps = {};
  // (v16.5: a lap of z crosses the 12 colour lines once, the red one, its D, last: 11 or 12 notes, the probe roped 5 px
  // behind the finger; the harp played its 5 strings, or the D alone in its D-only zone, 6 px from the zero)
  for (const [r, deg] of [[15, 3], [15, 5], [15, 8], [30, 3], [6, 5.7]]) {
    const q = R.touchLaps[`r${r}_from${deg}`] = await lap(r, deg);
    ok(`a touch lap ${r} px from a zero, from ${deg}° above the D line: 1 low D up at its end, the 12 lines (11 or 12 notes); held there: no note`, q.up === 1 && q.down === 0 && q.notes + q.merged >= 11 && q.notes + q.merged <= 12 && q.held === 0, q);
  }
  await view(1440, 900, false, false);
  await send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36', acceptLanguage: 'en-US,en' });
}
const exc =logs().filter((l) => l.t === 'EXC' || /Uncaught|TypeError|ReferenceError/.test(l.m || ''));
ok('no exceptions', !exc.length, exc.slice(0, 5));
await ev(`Sound.set({ on: false }); 1`);
return { pass: !fails.length, nfail: fails.length, fails, R };
