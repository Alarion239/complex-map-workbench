// Sound on the classic Deformation: while the deformation plays, the last loop's note
// changes the moment a zero crosses it; palette B's scrub (the air, the landmarks) with the Deformation's slider; Esc while
// it plays is silent. The steps view has no open Deformation, so this runs in the classic view; the rest of the suite is
// sound_v152_cmd.js. A command file for the CDP daemon (test/cdp_kit README):
//   python3 build.py && CMW_PORT=<port> node test/<you>_cdp/cdpd.js &   test/<you>_cdp/q.sh test/sound_v152_deform_classic_cmd.js
const PORT = +(process.env.CMW_PORT || 8832), BASE = `http://localhost:${PORT}/test.html`;
const loadHere = async (ns, st) => {
  await go(`http://localhost:${PORT}/gl-helpers.html`);
  const o = Object.assign({ v3: true, v4: true, shapes: [], steps: [], nextId: 50, focus: 0, rightMode: 'image' }, st || {});
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
  await go(`${BASE}?ns=${ns}`);
  // (and the app's hooks are there: under a loaded software renderer the page can take longer than the 2.2 s, and a
  // hook read before it (__cmwSound, __cmwW2S) answers an exception, not a value)
  for (let i = 0; i < 40 && !(await ev(`typeof __cmwSound === 'function' && typeof __cmwW2S === 'function' && document.readyState === 'complete'`)); i++) await sleep(250);
};
// (the engine's Sound.hear.state().counts run since load; __hearCount() reads them as __hearCount() did, since
// its last call: up and down the red line's crossings (line k ≡ 0 mod n, the low D), notes the notes played, merged
// the crossings merged into one note, cracks the cuts; as sound_cmd.js's hearCount)
const inj = await send('Page.addScriptToEvaluateOnNewDocument', { source: '(() => { window.__hearCount = () => { const c = Sound.hear.state().counts, p = window.__hc0 || { dUp: 0, dDown: 0, notes: 0, merged: 0, cracks: 0 }; window.__hc0 = { dUp: c.dUp, dDown: c.dDown, notes: c.notes, merged: c.merged, cracks: c.cracks }; return { up: c.dUp - p.dUp, down: c.dDown - p.dDown, notes: c.notes - p.notes, merged: c.merged - p.merged, cracks: c.cracks - p.cracks }; }; })();' });
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = () => settled({ max: 4000 });
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
  await ev(`__cmwSetMain('phase')`); await settle();
  await click(5, 300); await settle();
  await ev(`Sound.set({ on: true, vol: 0.7, ui: true, events: true, sonify: true }, { quiet: true }); await new Promise((r) => setTimeout(r, 600)); 1`);
  await ev(`__cmwSet('loop', false); 1`);
  await spy();
};
// a pointer loop round c (radius r, laps), the notes' count over it
const harpLoop = async (c, r, laps = 1) => {
  const pts = await circle(c, r, laps, 64);
  await move(pts[0][0], pts[0][1]); await settle();
  const phi0 = (await snd()).phi; await ev('__hearCount()');
  await glide(pts); await settle();
  return { dphi: +((await snd()).phi - phi0).toFixed(6), harp: await ev('__hearCount()') };
};
logs();
await view(1440, 900, false);

// 3. curves sing while the deformation plays: z − 1 (H_t(z) = z − t: its zero runs from 0 to 1), the last loop
// |z − 0.75| = 0.3 (from 0.45 to 1.05): W = 0 until the zero enters it at t = 0.45, then W = 1; the note steps there
await start('z-1');
{
  const pts = []; for (let j = 0; j < 96; j++) { const a = 2 * Math.PI * j / 96; pts.push([0.75 + 0.3 * Math.cos(a), 0.3 * Math.sin(a)]); }
  await ev(`__cmwSound({ lastLoop: ${JSON.stringify(pts)} }); 1`);
  await move(5, 600); await settle();
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
  await settled({ until: `!Sound.singState().on && !__cmwSound().cv.on`, max: 1500, panes: false });
  R.deformAfter = { sing: await ev('Sound.singState()'), cv: (await snd()).cv };
  ok('deformation: the note fades 0.9 s after t stops', !R.deformAfter.sing.on && !R.deformAfter.cv.on, R.deformAfter);
  // the motion bed is off while Hear F is on; with Hear F off it follows a play (the synth's texture 2)
  await key('m'); await settled({ until: `!__cmwLayout().deform`, max: 4000 });
}

// 4. palette B's scrub with the slider (real input events): the landmarks ring, the texture runs, it fades on release
await ev(`Sound.set({ sonify: false }); 1`);
await key('m'); await settled({ until: `__cmwLayout().deform && Sound.state().audio === 'running' && __cmwState().morph.playing`, max: 4000, panes: false });
// (the opening plays t through once: the scrub starts when it has stopped)
await settled({ until: `!__cmwState().morph.playing`, max: 8000, panes: false });
// (the opening's own cues end first: three reads in a row with no new voice)
for (let quiet = 0, i = 0; quiet < 3 && i < 60; i++) { await settled({ max: 250, panes: false }); quiet = (await made()).length ? 0 : quiet + 1; }
{
  const r = await ev(`(() => { const e = document.getElementById('morphRange').getBoundingClientRect(); return [e.left, e.right, e.top + e.height / 2]; })()`);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r[1] - 2, y: r[2] });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r[1] - 2, y: r[2], button: 'left', clickCount: 1 });
  let mid = null;
  for (let i = 1; i <= 50; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r[1] - 2 - (r[1] - r[0] - 4) * i / 50, y: r[2], button: 'left', buttons: 1 }); await sleep(16); if (i === 25) mid = await ev('Sound.scrubState()'); }
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r[0] + 2, y: r[2], button: 'left', clickCount: 1 });
  await settled({ until: `!Sound.scrubState().tex`, max: 1000, panes: false });
  R.scrub = { mid, after: await ev('Sound.scrubState()'), made: await made() };
  const lm = R.scrub.made.filter((x) => x === 'landmark').length;
  ok('scrub: the air while dragging, the landmarks ¾ ½ ¼ 0 (3 to 4), no other cue; the air ends on release', mid.tex && mid.v > 0.3 && !R.scrub.after.tex && lm >= 3 && lm <= 4 && R.scrub.made.every((x) => x === 'landmark'), R.scrub);
}
await key('m'); await settled({ until: `!__cmwLayout().deform`, max: 4000 });

// 6. (review sound-1) Esc while the deformation plays: silent until the next thing a person does. Hear F off: the motion
// bed is over for this play (no re-arm on the next frames); Hear F on: the last loop does not sing H_t again
for (const hear of [false, true]) {
  await start('z-1');
  await ev(`Sound.set({ sonify: ${hear} }); 1`);
  if (hear) { const pts = []; for (let j = 0; j < 96; j++) { const a = 2 * Math.PI * j / 96; pts.push([0.75 + 0.3 * Math.cos(a), 0.3 * Math.sin(a)]); } await ev(`__cmwSound({ lastLoop: ${JSON.stringify(pts)} }); 1`); }
  await move(5, 600); await settle();
  await ev(`__cmwSet('morphSecs', 4); 1`);
  await key('m'); await settled({ until: `__cmwState().morph.playing`, max: 3000, panes: false });
  const before = { arm: (await snd()).morphArm, sing: (await ev('Sound.singState()')).on };
  await key('Escape');
  const after = [];
  for (let i = 0; i < 8; i++) { await sleep(100); const s = await snd(); after.push({ playing: (await ev('__cmwState().morph.playing')), arm: s.morphArm, sing: (await ev('Sound.singState()')).on, cv: s.cv.on }); }
  R['esc' + (hear ? 'HearOn' : 'HearOff')] = { before, after };
  ok(`Esc while the deformation plays (Hear F ${hear ? 'on' : 'off'}): it plays on, and nothing sounds again (no motion bed, no loop note) for 0.8 s`, after.some((a) => a.playing) && after.every((a) => !a.arm && !a.sing && !a.cv) && (hear ? before.sing : before.arm), { before, after });
  // the next action lets it sound: Play again
  if (hear) { await key('m'); await settled({ until: `!__cmwState().morph.playing`, max: 2000, panes: false }); await key('m'); await settled({ until: `__cmwState().morph.playing`, max: 2000, panes: false }); R.escUnhush = { sing: (await ev('Sound.singState()')).on, cv: (await snd()).cv }; ok('after Esc, Play again: the loop sings again', R.escUnhush.cv.on || R.escUnhush.sing, R.escUnhush); }
  await key('m'); await settled({ until: `!__cmwLayout().deform`, max: 4000 });
}
const exc =logs().filter((l) => l.t === 'EXC' || /Uncaught|TypeError|ReferenceError/.test(l.m || ''));
ok('no exceptions', !exc.length, exc.slice(0, 5));
await ev(`Sound.set({ on: false }); 1`);
return { pass: !fails.length, nfail: fails.length, fails, R };
