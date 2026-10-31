// Sound while the function under a still probe changes (notes/sound/DEFORMATION.md): the Deformation played and
// scrubbed with the pointer resting on X's Phase plane, on the merged deformation plane of X → Y and on the Landscape,
// and a zero dragged while the pointer rests elsewhere. Checks that the tone's parameters change every frame, that
// the pitch follows arg H_t exactly (the run's turns = the winding of t → H_t(z)), that the pointer-tier cues fire in
// t as specified (a zero of H_t passing: one ping of its order; a full turn: one bell; Height contours: one tick per
// level), that the transport's own cues stay once per play, and that nothing fires twice.
// A command file for a CDP daemon (test/cdp_kit README); sound_cmd.js runs it as its last section. Run alone:
//   python3 build.py && CMW_PORT=<port> node test/<you>_cdp/cdpd.js &  test/<you>_cdp/q.sh test/sound_deform_cmd.js
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
const W = (side, re, im) => ev(`__cmwW2S('${side}', ${re}, ${im})`);
const snd = () => ev('__cmwSound()');
const count = (list, name) => list.filter((x) => x === name).length;
// cues made (names) and the voice's set() calls ([time, arg in turns or ln|F|, ln|F|, the transport's t then]); both
// cleared on read
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
// the low Ds of a run of arg from f0 (turns) over d turns: the integers crossed
const wantDs = (f0, d) => Math.floor(f0 + d) - Math.floor(f0);
// the colour lines crossed by a run of arg from f0 over d > 0 turns, at 12 sectors (each one a note, or merged)
const wantLines = (f0, d) => Math.floor(12 * (f0 + d) + 1e-9) - Math.floor(12 * f0 + 1e-9);
// frames while something runs: rAF times, and the transport's t at each
const frames = (ms) => ev(`await new Promise((res) => { const t = [], T = [], t0 = performance.now(); const f = () => { t.push(performance.now()); T.push(__cmwState().morph.T); if (performance.now() - t0 < ${ms}) requestAnimationFrame(f); else res({ t, T }); }; requestAnimationFrame(f); })`, ms + 20000);
// every frame in which t moved has a voice update of its own: a set() call made at that frame's t (the probe reads
// the transport's t as it is when the engine is told, so a t is voiced only while it is the transport's). A set belongs
// to its frame by the t it carries, not by when it ran: the app's re-track and this test's frame callback are both
// requestAnimationFrame callbacks, and their order within a frame is not fixed (wave 12's gate, #502: one set ran just
// before this test's callback in its frame, and a window between this test's frame times counted it in the frame
// before)
const perFrame = (fr, vset) => {
  let moved = 0, missed = 0, changed = 0;
  const voiced = new Set(vset.map((s) => s[3]));
  for (let i = 1; i < fr.t.length - 2; i++) {
    if (fr.T[i] === fr.T[i - 1]) continue;
    moved++;
    if (!voiced.has(fr.T[i])) missed++;
  }
  for (let i = 1; i < vset.length; i++) if (vset[i][1] !== vset[i - 1][1] || vset[i][2] !== vset[i - 1][2]) changed++;
  return { moved, missed, sets: vset.length, changed };
};
const ns = 'snddef' + Date.now();
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

// A. X's Phase plane, the pointer still: M opens the transport and plays H_t; the tone follows every frame, no zero,
// pole or cut, the transport's swell and arrival once each. The transport bar shrinks the plane, so the point under the
// still pointer moves and the probe follows it (H, review snddef-2/8). Then the pointer on z in the open layout and Play
// again from the end: +1.889 turns exactly (the winding of t → H_t(z) from t = 0), one bell
{
  const p0 = await W('L', ...Z);
  await move(p0[0] + 3, p0[1]); await sleep(40); await move(p0[0], p0[1]); await settle(300);
  await take();
  await key('m');
  const fr = await frames(2600);
  await settle(300);
  const s = await snd(), got = await take();
  // the app's H_t at the probe agrees with the natural path z^(1+4t) (asked while the transport is open)
  R.hAt = await ev(`__cmwSound({ hAt: [0.5, ${Z[0]}, ${Z[1]}] })`);
  { const a = Math.atan2(R.hAt[1], R.hAt[0]), want = ((3 * th + Math.PI) % (2 * Math.PI)) - Math.PI; ok('z^5: H_½ at the probe is z³ (the natural path z^(1+4t))', Math.abs(a - want) < 1e-9 && Math.abs(Math.hypot(...R.hAt) - Math.pow(1.2, 3)) < 1e-9, R.hAt); }
  R.phaseOpen = { frames: fr.t.length, per: perFrame(fr, got.vset), made: got.made, run: s.run, T: s.T, fcN: s.fcN, rest: s.rest };
  ok('A Phase, still pointer, M: a voice update in every frame t moved', R.phaseOpen.per.moved > 60 && R.phaseOpen.per.missed === 0 && R.phaseOpen.per.changed >= R.phaseOpen.per.moved - 2, R.phaseOpen.per);
  ok('A Phase, M: no zero, pole, cut or dense', !got.made.some((x) => /^(zero|pole|cut|dense|turnMany)$/.test(x)), got.made);
  ok('A Phase, M: the swell and the arrival once each', count(got.made, 'morphStart') === 1 && count(got.made, 'morphEnd') === 1, got.made);
  const p = await W('L', ...Z);
  await move(p[0] + 3, p[1]); await sleep(40); await move(p[0], p[1]); await settle(300);
  await take();
  await ev(`document.getElementById('morphPlay').click(); 1`);
  const fr2 = await frames(2600);
  await settle(300);
  const s2 = await snd(), got2 = await take();
  R.phase = { frames: fr2.t.length, per: perFrame(fr2, got2.vset), made: got2.made, run: s2.run, T: s2.T, fcN: s2.fcN, rest: s2.rest };
  ok('A Phase, Play: a voice update in every frame t moved', R.phase.per.moved > 60 && R.phase.per.missed === 0 && R.phase.per.changed >= R.phase.per.moved - 2, R.phase.per);
  // (the probe is roped, spec 3.1, so it rests up to 3 px from the pointer's z: the run is the winding at the
  // probe's own point, 4·arg z_probe, about 4 × 170°)
  const za = s2.rest ? Math.atan2(s2.rest.z[1], s2.rest.z[0]) : NaN;
  ok('A Phase: the run is the winding of t → H_t(z) at the probe: 4 arg z (4 × 170° = 1.889 turns)', s2.run && Math.abs(s2.run.phi - 4 * za / (2 * Math.PI)) < 1e-6 && Math.abs(za - th) < 0.03, { run: s2.run, rest: s2.rest });
  R.phase.harp = got2.harp;
  const linesA = wantLines(za / (2 * Math.PI), 4 * za / (2 * Math.PI));
  ok('A Phase: the notes: the red line 2 up (arg z = 170° + 1.889 turns crosses 1 and 2), a note at each colour line crossed (23), no zero, pole, cut or dense', got2.harp.up === wantDs(za / (2 * Math.PI), 4 * za / (2 * Math.PI)) && got2.harp.down === 0 && got2.harp.notes + got2.harp.merged === linesA && !got2.made.some((x) => /^(zero|pole|cut|dense|turnMany)$/.test(x)), { harp: got2.harp, linesA, made: got2.made });
  ok('A Phase, Play: the swell and the arrival once each', count(got2.made, 'morphStart') === 1 && count(got2.made, 'morphEnd') === 1, got2.made);
}
// A2. Play again with Loop on, and the pointer jiggling by 1 px now and then: the loop repeat is a new start (no cut,
// no bell back), each play rings its one bell, nothing twice
{
  await ev(`__cmwSet('loop', true); 1`);
  const p = await W('L', ...Z);
  await take();
  await clickSel('#morphPlay').catch(() => {});
  await ev(`(() => { const b = document.getElementById('morphPlay'); return b ? 1 : 0; })()`);
  // the click moved the pointer: back to the probe point
  await move(p[0] + 2, p[1]); await sleep(30); await move(p[0], p[1]);
  const t0 = Date.now(); let j = 0;
  while (Date.now() - t0 < 5600) { await sleep(400); j++; await move(p[0] + (j % 2), p[1]); }
  await move(p[0], p[1]);
  await settle(200);
  const got = await take();
  R.loopRuns = { made: got.made, morph: await ev('__cmwState().morph') };
  R.loopRuns.harp = got.harp;
  ok('A2 Loop: two low Ds a play (two plays in 5.6 s), never down, never a cut at the repeat', got.harp.up >= 2 && got.harp.up <= 6 && got.harp.down === 0 && !got.made.some((x) => /^(cut|zero|pole|dense|turnMany)$/.test(x)), { harp: got.harp, made: got.made });
  ok('A2 Loop: one swell, no arrival repeated on loops', count(got.made, 'morphStart') <= 1 && count(got.made, 'morphEnd') <= 1, got.made);
  await key('m'); await settle(400);
  await ev(`__cmwSet('loop', false); 1`);
}

// B. a zero of H_t sweeping across the still pointer: z − 1 (H_t(z) = z − t), the pointer at 0.5 + 0.003i: one ping of
// order 1 and its message; the pitch goes up half a turn (less a little)
await loadHere(ns, { steps: [{ type: 'custom', params: { expr: 'z-1', cut: 180 }, on: true }], srcView: { cx: 0, cy: 0, s: 120 } });
await ev(`__cmwSetMain('phase')`); await settle(900);
await click(5, 300); await settle(200);
await ev(`__cmwSet('loop', false); 1`);
await spy();
{
  // (M opens and plays once: the transport bar shrinks the plane; then the pointer on 0.5 + 0.003i and Play again)
  await key('m'); await sleep(3000);
  const p = await W('L', 0.5, 0.003);
  await move(p[0] + 3, p[1]); await sleep(40); await move(p[0], p[1]); await settle(300);
  const phi0 = (await snd()).phi;
  await take();
  await ev(`document.getElementById('morphPlay').click(); 1`);
  const fr = await frames(2300);
  await settle(200);
  const s = await snd(), got = await take();
  R.hAtB = await ev(`__cmwSound({ hAt: [0.25, 0.5, 0.003] })`);
  ok('z − 1: H_¼(0.5) = 0.25 (the zero moves from 0 to 1)', Math.abs(R.hAtB[0] - 0.25) < 1e-9, R.hAtB);
  R.zeroSweep = { per: perFrame(fr, got.vset), made: got.made, live: s.live, dphi: s.phi - phi0, run: s.run, rest: s.rest };
  ok('B a zero of H_t passes the still pointer: one ping, order 1, "Zero of order 1 here."', count(got.made, 'zero') === 1 && !got.made.some((x) => /^(pole|cut|dense)$/.test(x)) && /Zero of order 1 here/.test(s.live), R.zeroSweep);
  ok('B the tone follows every frame', R.zeroSweep.per.missed === 0 && R.zeroSweep.per.moved > 40, R.zeroSweep.per);
  // (the probe is roped, 3 px, spec 3.1: the run is arg(z − 1) − arg z at the probe's own z, within 3 px of
  // 0.5 + 0.003i)
  const zb = s.rest ? s.rest.z : [0.5, 0.003];
  ok('B the run: arg(z − t) from 0.006° to 179.7°: +0.4989 turns; a note at each of the 5 colour lines crossed (30° to 150°), no red line', s.run && Math.abs(s.run.phi - (Math.atan2(zb[1], zb[0] - 1) - Math.atan2(zb[1], zb[0])) / (2 * Math.PI)) < 1e-6 && Math.abs(zb[0] - 0.5) < 0.03 && Math.abs(zb[1] - 0.003) < 0.03 && got.harp.up === 0 && got.harp.down === 0 && got.harp.notes + got.harp.merged === 5, { run: s.run, harp: got.harp });
}
// C. scrubbing while the pointer rests on the plane (the slider moved by the keyboard): the tone follows each step,
// the scrub detents play, and the zero sweeping back pings once
{
  await ev(`(() => { const r = document.getElementById('morphRange'); r.value = 1; r.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
  await settle(300);
  const p = await W('L', 0.5, 0.003);
  await move(p[0] + 2, p[1]); await sleep(40); await move(p[0], p[1]); await settle(300);
  await take();
  // (the slider snaps to an integer within 0.03: t is read back from the transport)
  const steps = await ev(`await (async () => { const r = document.getElementById('morphRange'), out = []; r.focus(); for (let i = 1; i <= 40; i++) { r.value = 1 - i / 40; r.dispatchEvent(new Event('input', { bubbles: true })); await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))); out.push([__cmwState().morph.T, __cmwSound().g]); } return out; })()`);
  await settle(200);
  const got = await take(), s = await snd(), z0 = s.rest.z;
  let follows = 0; for (const [t, g] of steps) if (g && Math.abs(g[0] - (z0[0] - t)) < 1e-9 && Math.abs(g[1] - z0[1]) < 1e-12) follows++;
  R.scrub = { follows, sets: got.vset.length, made: got.made, live: s.live };
  ok('C scrub with a still pointer: H_t at the probe follows every step of the slider', follows === 40 && got.vset.length >= 38, R.scrub);
  // (SOUND-PLAN G2: while Hear the function sounds F under the resting probe, the scrub's air and landmarks
  // are silent, so only F is heard)
  ok('C scrub with the probe resting: no scrub landmarks (F is heard), and one zero ping on the way back, no cut', count(got.made, 'landmark') === 0 && count(got.made, 'zero') === 1 && !got.made.some((x) => /^(cut|dense)$/.test(x)), got.made);
  await key('m'); await settle(400);
}

// D. the merged deformation plane of X → Y (z^5): the pointer still at a point p of the plane; the tone is H_t(p),
// read as a point of X (DEFORMATION.md): the same 1.889 turns and one bell as in A
await loadHere(ns, POW5);
await ev(`__cmwSetMain('xy')`); await settle(900);
await click(5, 300); await settle(200);
await ev(`__cmwSet('loop', false); 1`);
await spy();
{
  await key('m'); await settle(200);
  // let the first play finish (the plane is fitted), then put the pointer on the plane and play again
  await sleep(3500);
  const lay = await ev('__cmwLayout()');
  const p = await W('R', ...Z);
  await move(p[0] + 3, p[1]); await sleep(40); await move(p[0], p[1]); await settle(300);
  const s0 = await snd();
  await take();
  await ev(`document.getElementById('morphPlay').click(); 1`);
  const fr = await frames(2600);
  await settle(300);
  const s = await snd(), got = await take();
  R.merged = { lay, rest: s0.rest, per: perFrame(fr, got.vset), made: got.made, run: s.run };
  // (the probe is roped, 3 px, spec 3.1: within 0.04 of p at the merged plane's fit)
  ok('D merged plane: the probe is the plane\'s point (src merged)', lay.merged === 'R' && s0.rest && s0.rest.src === 'merged' && Math.abs(s0.rest.z[0] - Z[0]) < 0.04 && Math.abs(s0.rest.z[1] - Z[1]) < 0.04, { lay, rest: s0.rest });
  ok('D merged plane: a hear update in every frame t moved', R.merged.per.moved > 60 && R.merged.per.missed === 0, R.merged.per);
  ok('D merged plane: H_t(p) as in X: about 1.889 turns, the red line 2 up, no zero or cut', s.run && Math.abs(s.run.phi - 4 * th / (2 * Math.PI)) < 0.02 && got.harp.up === 2 && got.harp.down === 0 && !got.made.some((x) => /^(zero|pole|cut|dense)$/.test(x)), { run: s.run, harp: got.harp, made: got.made });
  // M closes the deformation: X → Y splits again; the still pointer's probe is the point now under it (X: its z; Y: no
  // tone), found again by the re-pick (review snddef-2), never the merged plane's point
  await take();
  await key('m'); await settle(300);
  const sc = await snd(), under = await ev(`(() => { const e = document.elementFromPoint(${p[0]}, ${p[1]}); return e ? e.id : ''; })()`);
  const after = await take();
  R.mergedClose = { under, rest: sc.rest, sets: after.vset.length };
  ok('D closing the deformation: the probe is the point now under the pointer', under === 'overlayL' ? sc.rest && sc.rest.src === 'pointer' && after.vset.length >= 1 : !(sc.rest && sc.rest.src === 'merged'), R.mergedClose);
}

// E. the Landscape (z^5): the pointer still on the relief; the Height voice follows |H_t| every frame and ticks once
// per contour crossed
await ev(`__cmwSetMain('land')`); await settle(1500);
{
  const r = await ev(`(() => { const b = document.getElementById('overlayL').getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; })()`);
  // a point of the relief where |z| is well above 1 (contours to cross); keep the first point the relief picks
  let pick = null, at = null;
  for (const [u, v] of [[0.62, 0.5], [0.6, 0.45], [0.66, 0.55], [0.55, 0.42], [0.5, 0.5]]) { const q = [r[0] + u * r[2], r[1] + v * r[3]]; const z = await ev(`__cmwSound({ pick: [${q[0]}, ${q[1]}] })`); if (z && Math.hypot(z[0], z[1]) > 0.6) { pick = z; at = q; break; } }
  await move(at[0] + 2, at[1]); await sleep(40); await move(at[0], at[1]); await settle(300);
  const s0 = await snd();
  await take();
  // the Height voice's moves as posted to the worklet ({ at, lf, dur }), to check the swap glide at the open
  await ev(`(() => { window.__hm = []; const pm = MessagePort.prototype.postMessage; if (!pm.__hm) { MessagePort.prototype.postMessage = function (d, ...r) { try { if (Array.isArray(d) && d[0] && 'lf' in d[0] && 'dur' in d[0]) __hm.push([d[0].at, d[0].dur]); } catch (e) {} return pm.call(this, d, ...r); }; MessagePort.prototype.postMessage.__hm = 1; } return 1; })()`);
  await key('m');
  const fr = await frames(2600);
  await settle(300);
  const s = await snd(), got = await take();
  const hm = await ev('__hm.slice()');
  // (every move inside the glide ends at its end: before the fix the next frame asked for 8 ms)
  let cuts = 0; for (let i = 0; i < hm.length; i++) if (hm[i][1] >= 0.149) { const end = hm[i][0] + hm[i][1]; for (let j = i + 1; j < hm.length && hm[j][0] < end - 0.006; j++) if (hm[j][0] + hm[j][1] < end - 0.006) cuts++; }
  R.landGlide = { glides: hm.filter((x) => x[1] >= 0.149).length, cuts, first: hm.slice(0, 4) };
  // (Hear the function, SOUND-PLAN G1: the Height voice and its swap glide and contour ticks are retired; the
  // Landscape's probe is heard as on the planes, so no Height move is posted and |H_t|'s levels are no ticks)
  ok('E Landscape: no Height voice moves (the voice is retired)', R.landGlide.glides === 0, R.landGlide);
  const z = s0.rest ? s0.rest.z : pick, q = 2 * Math.PI / 12, lr = Math.log(Math.hypot(z[0], z[1]));
  const k0 = Math.floor(lr / q), k1 = Math.floor(5 * lr / q);
  // (nFrames, T0, T1: how many frames the 2.6 s held and t at the first and the last, to read a failure)
  R.land = { pick, rest: s0.rest, kind: s.kind, per: perFrame(fr, got.vset), made: got.made, harp: got.harp, ticksWant: Math.abs(k1 - k0), nFrames: fr.t.length, T0: fr.T[0], T1: fr.T[fr.T.length - 1] };
  ok('E Landscape: H_t at the still probe heard as on the planes, a hear update in every frame t moved', s.kind !== 'height' && R.land.per.moved > 60 && R.land.per.missed === 0 && got.harp.notes >= 1, R.land);
  ok("E Landscape: no contour tick (|H_t| is heard as the notes' loudness)", count(got.made, 'contour') === 0, R.land);
  await key('m'); await settle(400);
}

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
// same place gives (open and close in Phase, which resize the plane by the transport bar; Phase → Landscape → Phase;
// X → Y; M there merges the planes and closes them) (review snddef-2/8); then Esc, and a layout change brings no tone
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
  const steps = [['open', 'M', 2400], ['close', 'M', 1200], ['land', `__cmwSetMain('land')`, 1200], ['phase', `__cmwSetMain('phase')`, 1200], ['xy', `__cmwSetMain('xy')`, 1200], ['merge', 'M', 3600], ['split', 'M', 1200]];
  R.repick = {};
  for (const [name, act, ms] of steps) {
    if (act === 'M') await key('m'); else await ev(act);
    await sleep(ms);
    R.repick[name] = await same();
  }
  // (px: the distance in X at 120 px per unit, the scale of srcView; the merged plane has its own fit)
  for (const [name, o] of Object.entries(R.repick)) ok(`H re-pick after ${name}: the point under the pointer`, o.a && o.b && o.px != null && o.px < 0.5, o);
  // Esc during a play, then M closes the transport; Esc at rest, then another view: no voice update, no rest
  await ev(`__cmwSetMain('phase')`); await settle(900);
  const q = await W('L', ...Z);
  await move(q[0] + 3, q[1]); await sleep(40); await move(q[0], q[1]); await settle(600);
  await key('m'); await sleep(700); await key('Escape'); await settle(100); await take();
  await sleep(1800); await key('m'); await sleep(1000);
  const e1 = await take(), s1 = await snd();
  await move(q[0] + 3, q[1]); await sleep(40); await move(q[0], q[1]); await settle(600);
  await key('Escape'); await settle(100); await take();
  await ev(`__cmwSetMain('land')`); await sleep(1200);
  const e2 = await take(), s2 = await snd();
  R.escLayout = { closeSets: e1.vset.length, closeRest: s1.rest, viewSets: e2.vset.length, viewRest: s2.rest };
  ok('H Esc, then M closes the transport: no tone while the pointer stays still', e1.vset.length === 0 && !s1.rest, R.escLayout);
  ok('H Esc, then another view: no tone while the pointer stays still', e2.vset.length === 0 && !s2.rest, R.escLayout);
  await move(q[0] + 20, q[1]); await settle(400);
  const e3 = await take();
  ok('H after Esc, the pointer moves: the tone is back', e3.vset.length >= 1 && !!(await snd()).rest, { sets: e3.vset.length });
  await ev(`__cmwSetMain('phase')`); await settle(600);
}

const exc = logs().filter((l) => l.t === 'EXC' || /Uncaught|TypeError|ReferenceError/.test(l.m || ''));
ok('no exceptions', !exc.length, exc.slice(0, 5));
return { pass: !fails.length, nfail: fails.length, fails, R };
