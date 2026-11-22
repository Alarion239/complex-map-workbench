// Sound while the function under a still probe changes without the pointer moving (notes/sound/DEFORMATION.md): a zero
// dragged while the pointer rests elsewhere (F at the probe changes every frame, its colour lines and a zero passing
// through it heard once each), sound off (the hook does nothing), and the layout changed under a still pointer (the
// probe after the re-pick is the point under it; after Esc, no tone until the pointer moves).
// A command file for a CDP daemon (test/cdp_kit README); sound_cmd.js runs it as its last section. Run alone:
//   python3 build.py && CMW_PORT=<port> node test/<you>_cdp/cdpd.js &  test/<you>_cdp/q.sh test/sound_still_probe_cmd.js
const PORT = +(process.env.CMW_PORT || 8832), BASE = `http://localhost:${PORT}/test.html`;
const loadHere = async (ns, st) => {
  await go(`http://localhost:${PORT}/gl-helpers.html`); await sleep(400);
  const o = Object.assign({ v3: true, v4: true, shapes: [], steps: [], nextId: 50, focus: 0, rightMode: 'image' }, st || {});
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
  await go(`${BASE}?ns=${ns}`); await sleep(2200);
};
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 400) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const W = (side, re, im) => ev(`__cmwW2S('${side}', ${re}, ${im})`);
const snd = () => ev('__cmwSound()');
const count = (list, name) => list.filter((x) => x === name).length;
// cues made (names) and the voice's update calls ([time, arg in turns, ln|F|, morph.T then]); both cleared on read
const spy = () => ev(`(() => {
  window.__made = []; window.__vset = [];
  for (const [k, d] of Object.entries(Sound.CATALOG)) { if (d.__spy) continue; const m = d.make; d.make = (Pt, o) => { __made.push(k); return m(Pt, o); }; d.__spy = 1; }
  // (v16.5, Hear the function, SOUND-PLAN 2.3: the harp, the tone and the Height voice are retired; F at the probe goes
  // to Sound.hear's seat / step / cut / pathless, one call per update, [time, arg in turns, ln|F|])
  const hw = (fn) => function (s) { __vset.push([performance.now(), s && s.phi, s && s.ln, __cmwState().morph.T]); return fn.apply(this, arguments); };
  if (!Sound.hear.__w) { for (const k of ['seat', 'step', 'cut', 'pathless']) Sound.hear[k] = hw(Sound.hear[k]); Sound.hear.__w = 1; }
  return 1; })()`);
// made cues, the updates, and the notes since the last take (Sound.hear.state().counts run since load): up and down
// are the red line's crossings (line k ≡ 0 mod n, the old harp's low D), notes and merged the notes decided
const take = () => ev(`(() => { const c = Sound.hear.state().counts, p = window.__hc0 || c; window.__hc0 = Object.assign({}, c); const o = { made: __made.slice(), vset: __vset.slice(), harp: { up: c.dUp - p.dUp, down: c.dDown - p.dDown, notes: c.notes - p.notes, merged: c.merged - p.merged, reps: c.reps - p.reps, cracks: c.cracks - p.cracks } }; __made.length = 0; __vset.length = 0; return o; })()`);
const ns = 'sndstill' + Date.now();
const POW5 = { steps: [{ type: 'custom', params: { expr: 'z^5', cut: 180 }, on: true }], srcView: { cx: 0, cy: 0, s: 120 } };
await view(1440, 900, false);
await loadHere(ns, POW5);
await ev(`__cmwSetMain('phase')`); await settle(900);
logs();
// a real click away from the controls (the activation the engine waits for), then sound on with Hear F
await click(5, 300); await settle(200);
await ev(`Sound.set({ on: true, vol: 0.7, ui: true, events: true, sonify: true }, { quiet: true }); await new Promise((r) => setTimeout(r, 500)); 1`);
await ev(`__cmwSet('loop', false); 1`);
await spy();
const th = 170 * Math.PI / 180, Z = [1.2 * Math.cos(th), 1.2 * Math.sin(th)];


// F. a zero dragged while the pointer rests elsewhere (a zeros-and-poles step, the zero moved once a frame, as a second
// pointer or the step's fields would): the tone follows each frame; the zero circling the probe once rings one bell;
// the zero passing under the probe pings once
await loadHere(ns, { steps: [{ type: 'zp', params: { a: '1', zeros: '0.5, -1', poles: '' }, on: true }], srcView: { cx: 0, cy: 0, s: 120 } });
await ev(`__cmwSetMain('phase')`); await settle(900);
await click(5, 300); await settle(200);
await spy();
{
  const A = [0.2, 0.5], p = await W('L', ...A);
  await move(p[0] + 3, p[1]); await sleep(40); await move(p[0], p[1]); await settle(300);
  // the zero to A + 0.3 first, then (a new run, 1.6 s later) once round A, counter-clockwise, 90 frames
  await ev(`__cmwSound({ zp: [1, 'zeros', 0, ${A[0] + 0.3}, ${A[1]}] }); 1`); await sleep(1900);
  await take();
  const circ = await ev(`await (async () => { const out = []; for (let i = 0; i <= 90; i++) { const a = 2 * Math.PI * i / 90; __cmwSound({ zp: [1, 'zeros', 0, ${A[0]} + 0.3 * Math.cos(a), ${A[1]} + 0.3 * Math.sin(a)] }); await new Promise((r) => requestAnimationFrame(r)); out.push(__cmwSound().g); } await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); return out; })()`, 60000);
  const got = await take(), s = await snd();
  let changed = 0; for (let i = 1; i < circ.length; i++) if (circ[i] && circ[i - 1] && (circ[i][0] !== circ[i - 1][0] || circ[i][1] !== circ[i - 1][1])) changed++;
  R.zpCircle = { changed, sets: got.vset.length, made: got.made, run: s.run };
  ok('F a zero dragged round the still probe: F at the probe changes every frame', changed >= 85 && got.vset.length >= 85, R.zpCircle);
  R.zpCircle.harp = got.harp;
  ok('F … +1 turn: the 12 colour lines once (the red line once up, 12 notes), no zero ping (it stays 0.3 away)', s.run && Math.abs(s.run.phi - 1) < 0.02 && got.harp.up === 1 && got.harp.down === 0 && got.harp.notes + got.harp.merged >= 11 && got.harp.notes + got.harp.merged <= 12 && !got.made.some((x) => /^(zero|pole|cut|dense)$/.test(x)), R.zpCircle);
  // then straight through the probe: one ping of order 1
  await sleep(1800); await take();
  await ev(`await (async () => { for (let i = 0; i <= 60; i++) { __cmwSound({ zp: [1, 'zeros', 0, ${A[0]} - 0.4 + 0.8 * i / 60, ${A[1]} + 0.001] }); await new Promise((r) => requestAnimationFrame(r)); } await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); return 1; })()`, 60000);
  const got2 = await take(), s2 = await snd();
  R.zpThrough = { made: got2.made, live: s2.live };
  ok('F a zero dragged through the still probe: one ping of order 1', count(got2.made, 'zero') === 1 && /Zero of order 1 here/.test(s2.live) && !got2.made.some((x) => /^(pole|cut|dense)$/.test(x)), R.zpThrough);
  // the pointer leaves: a later change of F makes no sound
  await move(5, 300); await settle(200); await take();
  await ev(`__cmwSound({ zp: [1, 'zeros', 0, 0.9, 0.9] }); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); 1`);
  const got3 = await take();
  ok('F the pointer left the plane: no tone when F changes', got3.vset.length === 0 && !got3.made.length, got3);
}

// G. sound off: the hook does nothing (no evaluation, no rAF of its own)
{
  await ev(`Sound.set({ on: false }); 1`); await settle(200);
  const p = await W('L', 0.2, 0.5);
  await move(p[0], p[1]); await settle(200);
  const n0 = (await snd()).fcN;
  await ev(`await (async () => { for (let i = 0; i <= 20; i++) { __cmwSound({ zp: [1, 'zeros', 0, 0.5, 0.01 * i] }); await new Promise((r) => requestAnimationFrame(r)); } return 1; })()`);
  const n1 = (await snd()).fcN;
  ok('G sound off: no function-driven evaluation', n1 === n0, { n0, n1 });
}
// H. the pointer still on z^5, the layout changed under it: the probe after the re-pick is the point a pointer event at the
// same place gives (Phase → Landscape → Phase; X → Y) (review snddef-2/8); then Esc, and a layout change brings no tone
// back while the pointer stays still (review snddef-1)
await loadHere(ns, POW5);
await ev(`__cmwSetMain('phase')`); await settle(900);
await click(5, 300); await settle(200);
await ev(`Sound.set({ on: true, vol: 0.7, ui: true, events: true, sonify: true }, { quiet: true }); await new Promise((r) => setTimeout(r, 500)); __cmwSet('loop', false); 1`);
await spy();
{
  const p = await W('L', ...Z);
  await move(p[0] + 3, p[1]); await sleep(40); await move(p[0], p[1]); await settle(1900);
  const same = async () => { const a = (await snd()).rest; await move(p[0], p[1]); await settle(300); const b = (await snd()).rest; return { a, b, px: a && b && a.src === b.src ? +(Math.hypot(a.z[0] - b.z[0], a.z[1] - b.z[1]) * 120).toFixed(2) : null }; };
  const steps = [['land', `__cmwSetMain('land')`, 1200], ['phase', `__cmwSetMain('phase')`, 1200], ['xy', `__cmwSetMain('xy')`, 1200]];
  R.repick = {};
  for (const [name, act, ms] of steps) {
    await ev(act);
    // (the first Landscape takes its programs' link: the re-pick is read once the page is quiet)
    await sleep(ms); await settled();
    R.repick[name] = await same();
  }
  // (px: the distance in X at 120 px per unit, the scale of srcView)
  for (const [name, o] of Object.entries(R.repick)) ok(`H re-pick after ${name}: the point under the pointer`, o.a && o.b && o.px != null && o.px < 0.5, o);
  // Esc at rest, then another view: no voice update, no rest
  await ev(`__cmwSetMain('phase')`); await settle(900);
  const q = await W('L', ...Z);
  await move(q[0] + 3, q[1]); await sleep(40); await move(q[0], q[1]); await settle(600);
  await key('Escape'); await settle(100); await take();
  await ev(`__cmwSetMain('land')`); await sleep(1200);
  const e2 = await take(), s2 = await snd();
  R.escLayout = { viewSets: e2.vset.length, viewRest: s2.rest };
  ok('H Esc, then another view: no tone while the pointer stays still', e2.vset.length === 0 && !s2.rest, R.escLayout);
  await move(q[0] + 20, q[1]); await settle(400);
  const e3 = await take();
  ok('H after Esc, the pointer moves: the tone is back', e3.vset.length >= 1 && !!(await snd()).rest, { sets: e3.vset.length });
  await ev(`__cmwSetMain('phase')`); await settle(600);
}

const exc = logs().filter((l) => l.t === 'EXC' || /Uncaught|TypeError|ReferenceError/.test(l.m || ''));
ok('no exceptions', !exc.length, exc.slice(0, 5));
return { pass: !fails.length, nfail: fails.length, fails, R };
