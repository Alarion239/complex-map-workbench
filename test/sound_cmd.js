// Sound (notes/sound/DESIGN.md; the engine is src/sound.js, the hooks the "sound" block of app.js): the browser side.
// Consent (no AudioContext and no per-event work until the user turns sound on; a remembered "on" waits for a click or
// key of the new page), the default tiers silent on hover, Shift+M (and M still the Deformation), the palette entries,
// the settings in lsk('cmw-sound') and never in the saved work, Interface and Mathematical-event cues from the app, the
// pointer tier (the voice, exact winding by ear, zero orders, the guards during view gestures and the deformation),
// loops (the winding, the first loop plays itself, Esc), Height contours in the Landscape, the keyboard probe (arrows,
// Z, O, D, Enter, L, Esc), the engine's queue and cluster guards and the suspended-context rule in a live context, the
// silent off, the loudness and phone targets (the lab of DESIGN §2.2 as assertions), the phone header, and the
// per-event cost of the tracker. The click regression is test/sound_clicks_cmd.js; the pure parts test/t_sound.js.
// A command file for a CDP daemon (test/cdp_kit README):
//   python3 build.py && test/<you>_cdp/q.sh test/sound_cmd.js
// Prints {pass, fails, R}; pass is true when every check holds.
const PORT = +(process.env.CMW_PORT || 8832), BASE = `http://localhost:${PORT}/test.html`;
// The kit's load() opens port 8793. This file loads through PORT, so the saved state, the sound settings and every
// nav() share one origin. (With the kit's load(), the 360 px step opened 8793, where sound was never turned on.)
const loadHere = async (ns, st, extra) => {
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await sleep(400);
  const o = Object.assign({ v3: true, v4: true, shapes: [], steps: [], nextId: 50, focus: 0, rightMode: 'image' }, st || {});
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); ${extra || ''}; 1`);
  await send('Page.navigate', { url: `${BASE}?ns=${ns}` }); await sleep(2200);
  return ev(`({cards: __qa.cards(), lamps: __qa.lamps()})`);
};
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 400) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const W = (re, im) => ev(`__cmwW2S('L', ${re}, ${im})`);
const snd = () => ev('__cmwSound()');
// (v16.5, Hear the function: the marimba notes replace the pointer harp, perfwin/sound/impl/SOUND-PLAN.md 5.1. The
// engine's Sound.hear.state().counts run since load; this reads them as harpCount() did, since the last call: up and
// down are the red line's crossings (line k ≡ 0 mod n, the harp's low D), notes the notes played, cracks the cuts)
const hearCount = () => ev(`(() => { const c = Sound.hear.state().counts, p = window.__hc0 || { dUp: 0, dDown: 0, notes: 0, merged: 0, cracks: 0 }; window.__hc0 = { dUp: c.dUp, dDown: c.dDown, notes: c.notes, merged: c.merged, cracks: c.cracks }; return { up: c.dUp - p.dUp, down: c.dDown - p.dDown, notes: c.notes - p.notes, merged: c.merged - p.merged, cracks: c.cracks - p.cracks }; })()`);
const made = (clear) => ev(`(() => { const m = (window.__made || []).slice(); ${clear ? '__made.length = 0;' : ''} return m; })()`);
const count = (list, name) => list.filter((x) => x === name).length;
const spy = () => ev(`(() => { window.__made = []; for (const [k, d] of Object.entries(Sound.CATALOG)) { if (d.__spy) continue; const m = d.make; d.make = (Pt, o) => { __made.push(k); return m(Pt, o); }; d.__spy = 1; } window.__calls = { argStep: 0 }; if (!Calc.argStep.__spy) { const a = Calc.argStep; Calc.argStep = function (...x) { __calls.argStep++; return a.apply(this, x); }; Calc.argStep.__spy = 1; } return 1; })()`);
const glide = async (pts, dt = 16) => { for (const p of pts) { await move(p[0], p[1]); await sleep(dt); } };
// (a0: where the circle starts; the harp's count of low Ds is exact for a loop that starts more than 3.75° from arg 0,
// and on z² − 1 a circle round 1 or 0 that starts on the real axis starts at arg 0 exactly)
const circle = async (c, r, turns = 1, n = 48, a0 = 0) => { const out = []; for (let i = 0; i <= n * turns; i++) { const a = a0 + 2 * Math.PI * i / n; out.push(await W(c[0] + r * Math.cos(a), c[1] + r * Math.sin(a))); } return out; };
const live = async () => (await snd()).live;
// every AudioContext the page makes is counted (window.__acN)
const inj = await send('Page.addScriptToEvaluateOnNewDocument', { source: '(() => { window.__acN = 0; const A = window.AudioContext; if (!A) return; window.AudioContext = class extends A { constructor(...a) { super(...a); window.__acN++; } }; })();' });
const ns = 'sndcmd' + Date.now();
const SQ = { steps: [{ type: 'custom', params: { expr: 'z^2-1', cut: 180 }, on: true }], srcView: { cx: 0, cy: 0, s: 120 } };
await view(1440, 900, false);
await loadHere(ns, SQ);
await ev(`__cmwSetMain('phase')`); await settle(900);
logs();
await spy();

// 1. off by default, and free while off: no AudioContext, no cue, no tracker call on hover, drag or click
let st = await ev('Sound.state()');
ok('off by default', st.on === false && st.audio === 'none' && (await ev('__acN')) === 0, st);
await glide(await circle([1, 0], 0.3, 1, 32));
await drag(500, 400, 700, 450, 10, 16);
await click(600, 300);
await settle(300);
R.off = await ev(`({ ac: __acN, ctx: !!Sound.debug().ctx, argStep: __calls.argStep, made: __made.length, pressed: document.getElementById('soundBtn').getAttribute('aria-pressed'), tab: document.getElementById('overlayL').hasAttribute('tabindex') })`);
ok('sound off: hover, drag and click create no AudioContext and do no work', R.off.ac === 0 && !R.off.ctx && R.off.argStep === 0 && R.off.made === 0 && R.off.pressed === 'false' && !R.off.tab, R.off);

// 2. the header button turns it on: running, the "on" key, aria-pressed, the settings under lsk('cmw-sound')
const btn = await ev(`(() => { const b = document.getElementById('soundBtn'), t = document.getElementById('exportBtn'), g = document.getElementById('settingsBtn'); const x = (e) => e.getBoundingClientRect().left; return { label: b.innerText.trim(), title: b.title, keys: b.getAttribute('aria-keyshortcuts'), order: x(t) < x(b) && x(b) < x(g) }; })()`);
// ([v17 D5] Theme moved into Settings: Sound sits between Export ▾ and ⚙ Settings)
ok('Sound button: labelled Sound, Shift+M, between Export and Settings', btn.label === 'Sound' && /Shift\+M/.test(btn.title) && btn.keys === 'Shift+M' && btn.order, btn);
await clickSel('#soundBtn');
await settle(600);
st = await ev('Sound.state()');
R.on = { st, made: await made(true), pressed: await ev(`document.getElementById('soundBtn').getAttribute('aria-pressed')`), ac: await ev('__acN') };
ok('on: running, one context, the toggle-on key', st.on && st.audio === 'running' && R.on.ac === 1 && R.on.made.join() === 'toggleOn' && R.on.pressed === 'true', R.on);
ok('first on: Interface and Events on, Snap and Hear F off', st.ui && st.events && !st.snap && !st.sonify, st);
await sleep(400);
R.store = await ev(`(() => { const s = localStorage.getItem('cmw-sound:${ns}'), w = localStorage.getItem('complex-map-workbench-v1:${ns}') || ''; return { s: s && JSON.parse(s), work: /sonify|cmw-sound|"vol"/.test(w), plain: localStorage.getItem('cmw-sound') }; })()`);
ok('settings in lsk(cmw-sound), never in the saved work', R.store.s && R.store.s.on === true && !R.store.work && R.store.plain === null, R.store);

// 3. the default tiers are silent on hover (no pointer cue, no voice)
await glide(await circle([1, 0], 0.25, 2, 32));
await glide(await circle([-1, 0], 0.02, 1, 16));
await settle(300);
R.quiet = { made: await made(true), live: await ev('(() => { const h = Sound.hear.state(); return h.counts.notes + (h.stroke ? 1 : 0); })()'), argStep: await ev('__calls.argStep') };
ok('default tiers: hovering zeros makes no cue, no voice, no tracking', !R.quiet.made.length && R.quiet.live === 0 && R.quiet.argStep === 0, R.quiet);

// 4. Shift+M toggles sound (silently off); M alone is still the Deformation
await key('M', 8); await settle(250);
R.shiftM = { on: await ev('Sound.prefs().on'), made: await made(true), active: await ev('Sound.debug().active'), audio: await ev('Sound.state().audio'), deform: (await ev('__cmwLayout()')).deform };
ok('Shift+M: off, silent, suspended, not the Deformation', !R.shiftM.on && !R.shiftM.made.length && R.shiftM.active === 0 && R.shiftM.audio === 'suspended' && !R.shiftM.deform, R.shiftM);
await key('M', 8); await settle(300);
R.shiftM2 = { on: await ev('Sound.prefs().on'), made: await made(true), audio: await ev('Sound.state().audio') };
ok('Shift+M again: on with its key', R.shiftM2.on && R.shiftM2.made.join() === 'toggleOn' && R.shiftM2.audio === 'running', R.shiftM2);
// M: the deformation plays (the swell once per play), arrives once, and loop repeats stay silent
await key('m'); await settle(200);
ok('M opens the Deformation', (await ev('__cmwLayout()')).deform === true);
let mm = [];
for (let i = 0; i < 40 && !mm.includes('morphEnd'); i++) { await sleep(150); mm = await made(); }
await sleep(2500);
mm = await made(true);
R.morph = mm;
ok('deformation: one swell and one arrival per play, none on loop repeats', count(mm, 'morphStart') === 1 && count(mm, 'morphEnd') === 1, mm);
await key('m'); await settle(300);

// 5. the palette entries
await key('k', 4); await settle(300);
await type('sound'); await settle(300);
R.palette = await ev(`(document.getElementById('palList') || {}).innerText || ''`);
await key('Escape'); await settle(200);
await key('k', 4); await settle(300);
await type('hear'); await settle(300);
R.palette += ' | ' + await ev(`(document.getElementById('palList') || {}).innerText || ''`);
ok('palette: Sound on/off, Hear the function on/off, Stop sound', /Sound on\/off/.test(R.palette) && /Hear the function on\/off/.test(R.palette) && /Stop sound/.test(R.palette), R.palette.slice(0, 300));
await key('Escape'); await settle(200); await made(true);

// 6. Interface cues from the app: a view switch, the theme, an export copied (soundCue('exportDone'))
await key('1'); await settle(500);
await key('2'); await settle(500);
R.viewCue = await made(true);
ok('view switch: the view key', count(R.viewCue, 'view') >= 1, R.viewCue);
// ([v17 D5] the theme button is in Settings on a laptop: its cycle, which the palette's Switch theme uses, still cues)
for (let i = 0; i < 3; i++) { await ev(`document.getElementById('themeBtn').click(), 1`); await settle(i < 2 ? 200 : 300); }
R.themeCue = await made(true);
ok('theme: a toggle key', R.themeCue.some((x) => x === 'toggleOn' || x === 'toggleOff'), R.themeCue);
await clickSel('#exportBtn'); await settle(400);
const latex = await ev(`(() => { const it = [...document.querySelectorAll('#popHost [role=menuitem], #popHost button')].find((b) => /Copy LaTeX with guarantees/.test(b.textContent)); if (!it) return null; it.click(); return 1; })()`);
await settle(400);
R.exportCue = await made(true);
ok('export copied: the export-ready cue', latex === 1 && R.exportCue.includes('exportDone'), { latex, made: R.exportCue });
await key('Escape'); await settle(200);

// 7. Hear the function under the pointer, from the popover (a real click on its switch)
await clickSel('#soundMore'); await settle(300);
R.pop = await ev(`({ open: !document.getElementById('sndPop').hidden, focus: document.activeElement && document.activeElement.id, vol: document.getElementById('sndVol').value })`);
await clickSel('#sndSo'); await settle(300);
await key('Escape'); await settle(200);
R.popAfter = { sonify: await ev('Sound.prefs().sonify'), hidden: await ev(`document.getElementById('sndPop').hidden`) };
ok('popover: opens on the caret, focus on the switch, Hear F turned on, Esc closes', R.pop.open && R.pop.focus === 'sndOn' && R.pop.vol === '70' && R.popAfter.sonify && R.popAfter.hidden, { pop: R.pop, after: R.popAfter });
await made(true);
// the harp (v15.2): around the simple zero at 1 twice: exactly +2 turns of arg F, a rising scale twice, the low Ds
// counted up minus down = 2; no continuous voice; silent while still
const c2 = await circle([1, 0], 0.3, 2, 48, 0.4);
await move(c2[0][0], c2[0][1]); await settle(200);
const phi0 = (await snd()).phi;
await hearCount();
await glide(c2);
await settle(200);
let s = await snd();
R.hover = { dphi: +(s.phi - phi0).toFixed(6), voice: s.voice, harp: await hearCount(), engine: await ev('Sound.state().engine') };
// (v16.5: the probe is roped, spec 3.1: it trails the pointer by up to 3 px, so after the pointer's two exact turns
// the probe's arg is short by up to 3 px of the 0.3 circle, about 0.02 turn here)
ok('Hear F: the notes, +2 turns around the zero at 1 twice (the probe roped 3 px behind): the red line 2 up, 0 down, 23 or 24 lines crossed (notes + merged; the rope can leave out the last), no voice', R.hover.engine === 'worklet' && R.hover.dphi > 1.97 && R.hover.dphi <= 2 + 1e-6 && R.hover.harp.up === 2 && R.hover.harp.down === 0 && R.hover.harp.notes + R.hover.harp.merged >= 23 && R.hover.harp.notes + R.hover.harp.merged <= 24, R.hover);
await sleep(300);
await hearCount(); await sleep(700); R.still = await hearCount();
ok('Hear F: silent while the pointer rests', R.still.notes === 0 && R.still.up === 0, R.still);
// round a pole: a falling scale (a step with a pole: (z − 1)/(z + 1)... here 1/(z² − 1) is not loaded: the pole case
// is section 18)
// a zero within 8 px: one ping of its order, and the message
await made(true);
await move(...(await W(-1.3, 0.002))); await settle(300);
for (let i = 0; i <= 24; i++) { await move(...(await W(-1.3 + 0.3 * i / 24, 0.002))); await sleep(20); }
await settle(300);
R.zero = { made: await made(true), live: await live() };
ok('a zero under the pointer: one ping, "Zero of order 1 here."', count(R.zero.made, 'zero') === 1 && /Zero of order 1 here/.test(R.zero.live), R.zero);
// guards: a pan that brings a zero under the pointer, and the next 250 ms, fire no zero or cut cue
await move(...(await W(0.6, 0.6))); await settle(700); await made(true);
{
  const a = await W(0.6, 0.6), b = await W(1, 0.002);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: a[0], y: a[1] });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: a[0], y: a[1], button: 'left', clickCount: 1 });
  for (let i = 1; i <= 12; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: a[0] + (b[0] - a[0]) * i / 12, y: a[1] + (b[1] - a[1]) * i / 12, button: 'left', buttons: 1 }); await sleep(16); }
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: b[0], y: b[1], button: 'left', clickCount: 1 });
  await sleep(60);
  await move(b[0] + 1, b[1]); await sleep(60); await move(b[0], b[1]);
  await sleep(120);
  R.pan = { made: await made(true), view: await ev(`(() => { const p = __cmwW2S('L', 0, 0); return p; })()`) };
}
ok('pan: no pointer cue during the gesture and the 250 ms after', !R.pan.made.some((x) => x === 'zero' || x === 'pole' || x === 'cut' || x === 'dense'), R.pan);
await ev(`document.getElementById('leftFit') && document.getElementById('leftFit').click(); 1`); await settle(600);
// (while the deformation plays, the probe follows H_t in (z, t) and its cues fire as for the pointer: section 16,
// test/sound_deform_cmd.js; until 2026-10-23 pointer cues were held during a play)

// 8. loops: the Lasso around both zeros: two rising bells while drawing, W = 2 announced, the first loop plays itself;
// Esc stops it at once and keeps sound on; a second loop sounds its winding and waits
await key('o'); await settle(200);
{
  const L = await circle([0, 0], 1.4, 1, 64, 0.4);
  await move(L[0][0], L[0][1]); await settle(200); await made(true); await hearCount();
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: L[0][0], y: L[0][1], button: 'left', clickCount: 1 });
  for (const p of L.slice(1)) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p[0], y: p[1], button: 'left', buttons: 1 }); await sleep(16); }
  await sleep(300);
  const drawing = await made(true), drawHarp = await hearCount();
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: L[L.length - 1][0], y: L[L.length - 1][1], button: 'left', clickCount: 1 });
  await sleep(250);
  s = await snd();
  R.loop1 = { drawing, drawHarp, made: await made(true), live: s.live, play: s.play, auto: s.auto, listenFn: s.listenFn, sang: s.sang };
}
ok('loop 1: the red line crossed twice up while drawing, "Winding number 2", plays itself (Listen along: the function\'s notes, 24 lines), then sings W = 2', R.loop1.drawHarp.up - R.loop1.drawHarp.down === 2 && !R.loop1.drawing.includes('turn') && /^Winding number 2.*Listening along the loop: 2 turns/.test(R.loop1.live) && R.loop1.play && R.loop1.auto && R.loop1.listenFn && R.loop1.listenFn.counts && R.loop1.listenFn.counts.notes >= 12 && R.loop1.sang === 2, R.loop1);
await sleep(600);
await key('Escape'); await sleep(150);
R.esc = { play: (await snd()).play, active: await ev('Sound.debug().active'), on: await ev('Sound.prefs().on'), sing: await ev('Sound.singState()') };
ok('Esc: the playback stops at once (the harp and the note dropped), sound stays on', !R.esc.play && R.esc.active === 0 && R.esc.on && !R.esc.sing.on, R.esc);
await key('o'); await settle(200);
{
  const L = await circle([-1, 0], 0.4, 1, 48);
  await move(L[0][0], L[0][1]); await settle(200); await made(true);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: L[0][0], y: L[0][1], button: 'left', clickCount: 1 });
  for (const p of L.slice(1)) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p[0], y: p[1], button: 'left', buttons: 1 }); await sleep(16); }
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: L[L.length - 1][0], y: L[L.length - 1][1], button: 'left', clickCount: 1 });
  await sleep(300);
  s = await snd();
  R.loop2 = { made: await made(true), live: s.live, play: s.play, sang: s.sang, sing: await ev('Sound.singState()') };
}
ok('loop 2 (Hear F on): "Winding number 1", the loop sings W = 1 (no pings), no playback', /Winding number 1/.test(R.loop2.live) && R.loop2.sang === 1 && R.loop2.sing.on && R.loop2.sing.tier === 'events' && !R.loop2.made.includes('loopDone') && !R.loop2.play, R.loop2);
// Listen along a curve, from the shape's menu (right-click); (v16.5 UX73) a pointer move no longer ends it: it plays to
// its end, Stop in its chip, Esc or another action
{
  const p = await W(-1.4, 0);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p[0], y: p[1] });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p[0], y: p[1], button: 'right', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p[0], y: p[1], button: 'right', clickCount: 1 });
  await settle(300);
  const it = await ev(`(() => { const it = [...document.querySelectorAll('#popHost [role=menuitem], #popHost button')].find((b) => /^Listen along/.test(b.textContent.trim())); if (!it) return [...document.querySelectorAll('#popHost [role=menuitem], #popHost button')].map((b) => b.textContent.trim()).join(' | '); const t = it.textContent.trim(); it.click(); return t; })()`);
  await sleep(300);
  const playing = (await snd()).play;
  await move(p[0] + 30, p[1] + 10); await sleep(150);
  R.listenMenu = { item: it, playing, after: (await snd()).play };
}
ok('curve menu: "Listen along …" plays; a pointer move does not end it (v16.5 UX73)', /^Listen along/.test(R.listenMenu.item) && R.listenMenu.playing && R.listenMenu.after, R.listenMenu);
await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`); await sleep(150);
await key('v'); await settle(200); await made(true);

// 9. the keyboard probe on a keyboard-focused X plane: arrows, Z, O, D, Enter (a loop), L, Esc
await ev(`document.activeElement && document.activeElement.blur(); document.getElementById('overlayL').focus(); 1`); await settle(200);
await key('ArrowRight'); await settle(200);
R.kb = { start: await live() };
await key('z'); await settle(200); R.kb.z = await live();
await key('o'); await settle(200); R.kb.o = await live();
await key('d'); await settle(200); R.kb.d = await live();
await made(true);
await key('Enter'); await settle(100); R.kb.enter = await live();
for (const k of ['ArrowUp', 'ArrowLeft', 'ArrowLeft', 'ArrowDown', 'ArrowDown', 'ArrowRight', 'ArrowRight']) { await key(k); await sleep(60); }
await key('Enter'); await settle(300); R.kb.loop = await live();
await key('l'); await sleep(300); R.kb.playing = (await snd()).play;
await key('Escape'); await sleep(150); R.kb.after = (await snd()).play;
R.kb.made = await made(true);
ok('keyboard: the probe starts at the centre', /^Probe at the centre, z = 0\. Steps of 0\.1/.test(R.kb.start), R.kb.start);
ok('keyboard: Z → the first zero with its order', /^Zero 1 of 2: order 1 at [−-]1/.test(R.kb.z), R.kb.z);
ok('keyboard: O → net order 1', /net order 1/.test(R.kb.o), R.kb.o);
ok('keyboard: D describes the view', /2 zeros/.test(R.kb.d) && /no poles/.test(R.kb.d), R.kb.d);
ok('keyboard: Enter … Enter: a loop around −1, winding 1', /^Loop started/.test(R.kb.enter) && /Winding number 1/.test(R.kb.loop), [R.kb.enter, R.kb.loop]);
ok('keyboard: L listens, Esc stops', R.kb.playing && !R.kb.after, R.kb);
// after a mouse click in the plane, the letters are the tool shortcuts again
await click(...(await W(1.6, 1.2))); await settle(150);
await key('l'); await settle(150);
R.kbClick = { tool: await ev(`document.querySelector('[data-tool].active, [data-tool][aria-pressed=true]') ? document.querySelector('[data-tool].active, [data-tool][aria-pressed=true]').dataset.tool : ''`), play: (await snd()).play, kbd: (await snd()).kbd };
ok('after a click in the plane, L is the Line tool again', !R.kbClick.play && !R.kbClick.kbd, R.kbClick);
await key('v'); await settle(150);

// 10. The Landscape (v16.5, Hear the function, SOUND-PLAN G1: the Height voice and its contour ticks are retired; the
// Landscape's probe (pickLand) is heard as on the planes: notes at the colour lines, no voice, no contour tick)
await key('3'); await settle(1500); await made(true); await hearCount();
{
  const r = await ev(`(() => { const b = document.getElementById('overlayL').getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; })()`);
  for (let i = 0; i <= 60; i++) { const u = i / 60; await move(r[0] + r[2] * (0.3 + 0.4 * u), r[1] + r[3] * (0.5 + 0.12 * Math.sin(6 * u))); await sleep(20); }
  await settle(400);
  s = await snd();
  R.height = { kind: s.kind, voice: s.voice, made: await made(true), hear: await hearCount() };
}
ok('Landscape: the probe on the relief is heard as on the planes (notes at its lines, no Height voice, no contour tick)', !R.height.voice && R.height.kind !== 'height' && !R.height.made.includes('contour') && R.height.hear.notes >= 2, R.height);
await key('2'); await settle(800);

// 11. the engine's guards in the live context: 12 turns → 8 bells and one flourish; an Interface cue right after
// plays; 20 zero entries at 40 ms → at most 3 pings and the dense cue
R.queue = await ev(`await (async () => { await new Promise((r) => setTimeout(r, 1500)); __made.length = 0; const r = []; for (let i = 0; i < 12; i++) r.push(Sound.turn({ dir: 1, pc: 0 })); const m = __made.slice(); const add = Sound.play('stepAdd', {}); return { r, bells: m.filter((x) => x === 'turn').length, many: m.filter((x) => x === 'turnMany').length, add }; })()`);
ok('queue: 12 turns → 8 bells and one flourish; an Interface cue still plays', R.queue.bells === 8 && R.queue.many === 1 && R.queue.add === true, R.queue);
R.cluster = await ev(`await (async () => { await new Promise((r) => setTimeout(r, 1500)); __made.length = 0; for (let i = 0; i < 20; i++) { Sound.play(i % 3 ? 'zero' : 'pole', { order: 1 }); await new Promise((r) => setTimeout(r, 40)); } const m = __made.slice(); return { zp: m.filter((x) => x === 'zero' || x === 'pole').length, dense: m.filter((x) => x === 'dense').length }; })()`);
ok('cluster: 20 entries → ≤ 3 pings and the dense cue', R.cluster.zp <= 3 && R.cluster.dense >= 1, R.cluster);
// nothing is queued on a clock that is not running: a context whose resume() never resolves
R.susp = await ev(`await (async () => {
  const c = Sound.debug().ctx; await c.suspend(); const res = c.resume; c.resume = () => new Promise(() => {});
  __made.length = 0; const live0 = Sound.hear.state().counts.notes; let n = 0;
  for (let i = 0; i < 24; i++) { if (Sound.play('toggleOn', {}) === true) n++; if (Sound.turn({ dir: 1 }) === true) n++; await new Promise((r) => setTimeout(r, 50)); }
  const out = { n, made: __made.length, live: Sound.hear.state().counts.notes - live0 };
  c.resume = res; await c.resume(); return out; })()`, 20000);
ok('suspended context: 24 requests, none scheduled', R.susp.n === 0 && R.susp.made === 0 && R.susp.live <= 0, R.susp);
// the silent off: six sources sounding, then off → no sound made, every source stopped, then suspended
R.silentOff = await ev(`await (async () => {
  for (const k of ['toggleOn', 'stepAdd', 'view', 'error', 'exportDone', 'stepRemove']) Sound.play(k, { force: true });
  const before = __made.length; __made.length = 0;
  Sound.set({ on: false });
  const madeOff = __made.length;
  await new Promise((r) => setTimeout(r, 150));
  const after = Sound.debug().active, audio = Sound.state().audio;
  return { before, madeOff, after, audio };
})()`);
ok('off while six cues sound: no off sound, all stopped, suspended', R.silentOff.before >= 6 && R.silentOff.madeOff === 0 && R.silentOff.after === 0 && R.silentOff.audio === 'suspended', R.silentOff);
await ev(`Sound.set({ on: true }); 1`); await settle(300);

// 12. √z: a remembered "on" waits for a click of the new page; with the default tiers the cut is silent; with Hear F
// the cut ticks (≤ one per 120 ms)
await ev(`Sound.set({ sonify: false }); 1`);
await loadHere(ns, { steps: [{ type: 'custom', params: { expr: 'sqrt(z)', cut: 180 }, on: true }], srcView: { cx: 0, cy: 0, s: 120 } });
await ev(`__cmwSetMain('phase')`); await settle(900);
await spy();
const cutPass = async (n) => { for (let i = 0; i < n; i++) { const y = i % 2 ? 0.3 : -0.3; await move(...(await W(-1, y))); await sleep(40); } };
await cutPass(10);
R.remembered = { ac: await ev('__acN'), on: await ev('Sound.prefs().on'), audio: await ev('Sound.state().audio') };
ok('reload with "on" remembered: a hover creates no context', R.remembered.ac === 0 && R.remembered.on && R.remembered.audio === 'none', R.remembered);
await click(...(await W(1.5, 1.5))); await settle(400);
R.remembered.afterClick = { ac: await ev('__acN'), audio: await ev('Sound.state().audio') };
ok('reload: the first click starts it', R.remembered.afterClick.ac === 1 && R.remembered.afterClick.audio === 'running', R.remembered.afterClick);
await made(true);
await cutPass(40); await settle(200);
R.cutQuiet = await made(true);
ok('default tiers: crossing √z\'s cut 40 times makes no cue', !R.cutQuiet.length, R.cutQuiet);
await ev(`Sound.set({ sonify: true }); 1`); await settle(200);
await hearCount();
await cutPass(20); await settle(200);
R.cutTicks = { made: await made(true), hear: await hearCount() };
ok('Hear F: the cut cracks, at most one a pass', R.cutTicks.hear.cracks >= 3 && R.cutTicks.hear.cracks <= 20, R.cutTicks);

// 13. the loudness and phone targets (DESIGN §2.2), every cue rendered offline as in use, at 100 % volume
await ev(fs.readFileSync(path.join(DIR, '..', 'sound_lab.js'), 'utf8'));
const lab = await ev('await __sndLab()', 180000);
R.lab = lab && lab.voices;
// (snap, the scrub's plain detent and the cut are noise bursts read from a moving offset in one noise buffer, so their
// level varies by a few dB from one to the next: a wider band)
// (palette B, notes/sound/v2/DESIGN.md §2, column B, about ±2 dB: every play is a new strike. Pole and edge lose 7.8 and
// 5.6 dB through the phone model, as measured on the board: DESIGN v2 §8, open; their phone limit is 8 dB)
const GROUP = { snap: [-47, -40], landmark: [-48, -36], cut: [-41, -35], contour: [-43, -36], toggleOn: [-35, -30.5], toggleOff: [-36, -31.5], stepAdd: [-34, -29.5], stepRemove: [-34.5, -30], view: [-35, -30.5], edge: [-43, -38.5], morphStart: [-34, -30], morphEnd: [-33.5, -29], zero: [-33, -27], pole: [-35, -28.5], collide: [-34, -30], exportDone: [-31, -26.5], error: [-32.5, -28.5], turn: [-31.5, -27.5], turnMany: [-42, -35], dense: [-44.5, -39.5],
  // ([v16.5 rail SPEC 4.4] a point attached: under toggleOn; a point freed: at edge's level)
  attach: [-37, -33], detach: [-41.5, -37.5] };
// (contours: the low ones, k ≤ −5, sit under the phone model's 550 Hz, as their Height notes do)
const PHONE = { pole: 8, edge: 7, contour: 8.5 };
for (const r of (lab && lab.rows) || []) {
  const g = r.name === 'loopDone' ? (r.o.w ? [-33.5, -29] : [-41, -33]) : GROUP[r.name];
  ok(`level ${r.name} ${JSON.stringify(r.o)}: LUFS-M in [${g}]`, g && r.lufs >= g[0] && r.lufs <= g[1], r.lufs);
  ok(`phone ${r.name} ${JSON.stringify(r.o)}: loses ≤ ${PHONE[r.name] || 5} dB`, r.loss <= (PHONE[r.name] || 5), r.loss);
  // (palette B's air and its woodblock and felt contacts carry more above 14 kHz than v15's cues did: −25 to −38 dB of
  // the total, as on the board the user heard; the pure strikes stay under −40)
  // ([v16.5 rail] detach is edge's felt tap: −35.6 dB, a felt contact like edge's)
  const hfLim = /^(view|exportDone|morphStart|error|edge|pole|detach)$/.test(r.name) ? -24 : -40;
  ok(`envelope ${r.name} ${JSON.stringify(r.o)}: peak < −6 dBFS, soft onset, ends at exactly 0, HF ≤ ${hfLim} dB`, r.peak < -6 && r.first < 0.35 && r.end === 0 && r.hf <= hfLim, r);
}
ok('lab: every cue measured', lab && lab.rows && lab.rows.length >= 28, lab && lab.rows && lab.rows.length);
const V = (lab && lab.voices) || {};
ok('harp: one note at velocity 0.7, |F| = 1 (seed 1): E and D (with its accent, +2 dB) −32 ± 2.5 LUFS-M, D 2 to 5 dB over E; phone loss ≤ 5 dB; a soft start', V.harp && Math.abs(V.harp.note + 32) <= 2.5 && Math.abs(V.harp.d + 32) <= 2.5 && V.harp.d - V.harp.note >= 2 && V.harp.d - V.harp.note <= 5 && V.harp.loss <= 5 && V.harp.first < 0.35, V.harp);
ok('harp: a run of 10 notes a second about −30 (−33 to −27)', V.harp && V.harp.run >= -33 && V.harp.run <= -27, V.harp);
ok('curves sing: the release note −31 ± 2 LUFS-M at W = 1 and W = −1 (the low-note make-up), phone loss ≤ 6 dB', V.sing && Math.abs(V.sing.w1 + 31) <= 2 && Math.abs(V.sing.wm1 + 31) <= 2.5 && V.sing.loss <= 6, V.sing);
ok('curves sing: the loudest harmonic of the note is 4 + W (F♯5 for 1, A4 for −1)', V.sing && V.sing.peak1 === 5 && V.sing.peakm1 === 3, V.sing);
ok('Height voice: −33 ± 1.5 LUFS on D5, phone range ≤ 8 dB', V.height && Math.abs(V.height.at0 + 33) <= 1.5 && V.height.phoneRange <= 8, V.height);

// 14. the tracker's cost per pointer event (synthetic pointermoves on the X plane, z² − 1 and a heavy chain): Hear F
// on against off; the budget is about 3 ms of F calls an event
const cost = async (jumpy) => ev(`await (async () => {
  const el = document.getElementById('overlayL'), b = el.getBoundingClientRect(), N = 300;
  const fire = (i) => { const a = ${jumpy ? '2.4 * i' : '2 * Math.PI * i / 120'}, r = ${jumpy ? '4 + 30 * ((i * 7) % 10) / 10' : '1'}; el.dispatchEvent(new PointerEvent('pointermove', { clientX: b.left + b.width / 2 + ${jumpy ? 'r' : 160} * Math.cos(a), clientY: b.top + b.height / 2 + ${jumpy ? 'r' : 110} * Math.sin(a), pointerId: 1, pointerType: 'mouse', isPrimary: true, bubbles: true })); };
  // (also the tracker's own time per event: Calc.argStep and Calc.orderAt, wrapped for the run)
  const A = Calc.argStep, O = Calc.orderAt; let tr = 0;
  Calc.argStep = function (...a) { const t = performance.now(); try { return A.apply(this, a); } finally { tr += performance.now() - t; } };
  Calc.orderAt = function (...a) { const t = performance.now(); try { return O.apply(this, a); } finally { tr += performance.now() - t; } };
  const run = () => { const t = [], q = []; for (let i = 0; i < N; i++) { tr = 0; const t0 = performance.now(); fire(i); t.push(performance.now() - t0); q.push(tr); } t.sort((x, y) => x - y); return { mean: +(t.reduce((s, x) => s + x, 0) / N).toFixed(3), p95: +t[Math.floor(0.95 * N)].toFixed(3), max: +t[N - 1].toFixed(3), trMax: +Math.max(...q).toFixed(3) }; };
  try {
    Sound.set({ on: false }); run(); const off = run();
    Sound.set({ on: true, sonify: true }); run(); const on = run();
    return { off, on, perEval: __cmwSound().perEval };
  } finally { Calc.argStep = A; Calc.orderAt = O; }
})()`, 60000);
await loadHere(ns, SQ); await ev(`__cmwSetMain('phase')`); await settle(900); await click(5, 300); await settle(200);
R.costSq = await cost();
// (erf is a series: the costliest calls of F in the app; then the derivative of the whole chain)
await loadHere(ns, { steps: [{ type: 'custom', params: { expr: 'erf(z^2)*erf(1/(z+0.3))', cut: 180 }, on: true }, { type: 'custom', params: { expr: 'erf(z)+erf(2z)+tan(z)*log(z+2)', cut: 180 }, on: true }, { type: 'custom', params: { expr: 'z^5-z', cut: 180 }, on: true }, { type: 'deriv', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 60 } });
await ev(`__cmwSetMain('phase')`); await settle(1500); await click(5, 300); await settle(200);
R.costHeavy = await cost();
if (R.costHeavy.on.trMax >= 4) {
  const a = [R.costHeavy, await cost(), await cost()].sort((x, y) => x.on.trMax - y.on.trMax);
  R.costHeavy = Object.assign({}, a[1], { attempts: a.map((x) => ({ off: x.off.max, on: x.on.max, tracker: x.on.trMax })) });
}
// frames while the pointer sweeps the heavy chain's portrait at 60 Hz (real input), Hear F off and on
const sweep = async (on) => {
  await ev(`Sound.set({ on: true, sonify: ${on} }); 1`); await settle(300);
  const b = await ev(`(() => { const r = document.getElementById('overlayL').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
  await ev(`window.__fr = __qa.frames(2500); 1`);
  const t0 = Date.now(); let i = 0;
  while (Date.now() - t0 < 2400) { const a = 2 * Math.PI * (i++) / 90; await move(b[0] + 220 * Math.cos(a), b[1] + 150 * Math.sin(1.3 * a)); await sleep(14); }
  return ev('await __fr');
};
R.framesOff = await sweep(false);
R.framesOn = await sweep(true);
ok('frames: Hear F keeps the hover sweep at ≥ 55 fps and adds ≤ 2 ms at p95', R.framesOn.fps >= 55 && R.framesOn.p95 <= R.framesOff.p95 + 2, { off: R.framesOff, on: R.framesOn });
// sin(1/z) near 0 with jumps of up to 34 px an event: arg F turns wildly between events, so the budget is used up
await loadHere(ns, { steps: [{ type: 'custom', params: { expr: 'sin(1/z)', cut: 180 }, on: true }], srcView: { cx: 0, cy: 0, s: 120 } });
await ev(`__cmwSetMain('phase')`); await settle(1200); await click(5, 300); await settle(200);
// (a pause of the page's thread, from GC or the machine, lands in one event now and then, with Hear F off as well:
// as the perf suite confirms a failing unit, a run over the limit is measured twice more and the median run counts)
R.costJumpy = await cost(true);
if (R.costJumpy.on.max >= 8 || R.costJumpy.on.p95 - R.costJumpy.off.p95 >= 2 || R.costJumpy.on.trMax >= 4) {
  const a = [R.costJumpy, await cost(true), await cost(true)].sort((x, y) => x.on.max - y.on.max);
  R.costJumpy = Object.assign({}, a[1], { attempts: a.map((x) => ({ off: x.off.max, on: x.on.max, tracker: x.on.trMax })) });
}
ok('tracker cost: Hear F adds < 4 ms per event (z² − 1)', R.costSq.on.mean - R.costSq.off.mean < 4, R.costSq);
ok('tracker cost: sin(1/z) with jumps: the budget holds (p95 + < 2 ms, max < 8 ms)', R.costJumpy.on.p95 - R.costJumpy.off.p95 < 2 && R.costJumpy.on.max < 8, R.costJumpy);
ok('tracker cost: the tracker itself stays within its 3 ms deadline (max < 4 ms an event; the median of 3 runs when one is over)', [R.costSq, R.costHeavy, R.costJumpy].every((c) => c.on.trMax < 4), { sq: R.costSq.on.trMax, heavy: R.costHeavy.on.trMax, jumpy: R.costJumpy.on.trMax, attempts: [R.costHeavy.attempts, R.costJumpy.attempts] });
ok('tracker cost: Hear F adds < 5 ms per event at p95 (a heavy chain: the budget holds)', R.costHeavy.on.p95 - R.costHeavy.off.p95 < 5, R.costHeavy);
await ev(`Sound.set({ sonify: false }); 1`);

// 15. phones (360, 390), the v15 layout (src/phone.js; the v14 speaker in the bar is gone): Sound is a row of More (⋯)
// with its switch and Settings; the switch shows the state and turns sound off; Settings opens the popover, which
// fits; no sideways overflow
for (const w of [360, 390]) {
  await view(w, 780, false, true);
  await nav(`${BASE}?ns=${ns}`); await settle(1200);
  await ev(`Sound.set({ on: true }, { quiet: true }); 1`); await settle(200);
  const over = await ev(`document.documentElement.scrollWidth - innerWidth`);
  const sheet = async () => { await clickSel('#hdrMoreBtn'); await settle(500); return ev(`(() => { const b = document.querySelector('.ph-sb[data-k="more"]'), sw = b && b.querySelector('.ph-switch'), set = b && b.querySelector('.ph-link'); const vis = (e) => !!e && !e.closest('[hidden]') && e.getClientRects().length > 0; return { open: vis(b), sw: vis(sw), set: vis(set), checked: sw ? sw.getAttribute('aria-checked') : null }; })()`); };
  const on = await sheet();
  await clickSel('.ph-sb[data-k="more"] .ph-switch'); await settle(300);
  const off = { on: await ev('Sound.state().on'), checked: await ev(`(() => { const sw = document.querySelector('.ph-sb[data-k="more"] .ph-switch'); return sw ? sw.getAttribute('aria-checked') : null; })()`) };
  await clickSel('.ph-sb[data-k="more"] .ph-link'); await settle(500);
  const pop = await ev(`(() => { const r = document.getElementById('sndPop').getBoundingClientRect(); return { l: r.left, r: r.right, b: r.bottom, w: innerWidth, h: innerHeight, open: !document.getElementById('sndPop').hidden }; })()`);
  await key('Escape'); await settle(200); await ev(`Sound.set({ on: true }); 1`);
  R['phone' + w] = { over, on, off, pop };
  ok(`${w} px: More has the Sound row (switch on, Settings); no overflow`, on.open && on.sw && on.set && on.checked === 'true' && over <= 0, { over, on });
  ok(`${w} px: the switch turns sound off and shows it`, off.on === false && off.checked === 'false', off);
  ok(`${w} px: Settings opens the popover, which fits`, pop.open && pop.l >= 0 && pop.r <= pop.w && pop.b <= pop.h, pop);
}
await view(1440, 900, false, false);
await ev(`Sound.set({ on: false }); 1`);

// 16. the function under a still probe changes (notes/sound/DEFORMATION.md): the Deformation played and scrubbed with
// the pointer still over X's Phase plane, the merged deformation plane and the Landscape; a zero dragged while the
// pointer rests elsewhere; sound off. The cases are test/sound_deform_cmd.js (also run alone).
// (the section reads the console log itself: what came before is kept for the check of exceptions below)
const logsBefore = logs();
{
  const AF = Object.getPrototypeOf(async function () {}).constructor;
  const H = { ev, nav, view, shot, key, type, click, move, drag, clickSel, load, logs, send, sleep, img, fs, path, DIR };
  const D = await new AF(...Object.keys(H), fs.readFileSync(path.join(DIR, '..', 'sound_deform_cmd.js'), 'utf8'))(...Object.values(H));
  R.deform = D.R;
  for (const f of D.fails || [{ name: 'did not run', got: D }]) fails.push(Object.assign({}, f, { name: 'deformation: ' + f.name }));
  await ev(`Sound.set({ on: false }); 1`);
}
// 17. v15 defaults (notes/sound/README.md, the user's decision of 2026-10-23), on a page without ?ns= (the published
// page's storage keys; removed again below): sound on, Interface and Mathematical events on, Snap ticks and Hear the
// function off; no AudioContext and no cue before the first click or key; the first click starts it; a stored choice
// wins. (Sections 1 to 16 run under ?ns=, where sound starts off.)
{
  const clean = `localStorage.removeItem('cmw-sound'); localStorage.removeItem('complex-map-workbench-v1'); 1`;
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await sleep(300);
  await ev(clean);
  await send('Page.navigate', { url: BASE }); await sleep(2200);
  await spy();
  let s = await ev('Sound.state()');
  const pre = { st: s, ac: await ev('__acN'), pressed: await ev(`document.getElementById('soundBtn').getAttribute('aria-pressed')`), stored: await ev(`localStorage.getItem('cmw-sound')`) };
  R.v15def = { pre };
  ok('v15 default: on, Interface and events on, Snap and Hear F off', s.on && s.ui && s.events && !s.snap && !s.sonify && pre.pressed === 'true', pre);
  ok('v15 default: no AudioContext at load, nothing stored', s.audio === 'none' && pre.ac === 0 && pre.stored === null, pre);
  await move(700, 400); await settle(300);
  R.v15def.hover = { ac: await ev('__acN'), made: await made(true) };
  ok('v15 default: a hover starts nothing and plays nothing', R.v15def.hover.ac === 0 && !R.v15def.hover.made.length, R.v15def.hover);
  await click(700, 400); await settle(600);
  s = await ev('Sound.state()');
  R.v15def.click = { audio: s.audio, ac: await ev('__acN') };
  ok('v15 default: the first click creates the context, running', s.audio === 'running' && R.v15def.click.ac === 1, R.v15def.click);
  // a stored choice wins: off, stored, survives a reload
  await clickSel('#soundBtn'); await settle(400);
  await send('Page.navigate', { url: BASE }); await sleep(2200);
  s = await ev('Sound.state()');
  await click(700, 400); await settle(400);
  R.v15def.stored = { on: s.on, ac: await ev('__acN'), stored: await ev(`localStorage.getItem('cmw-sound')`) };
  ok('v15 default: a stored "off" wins on reload, and a click creates nothing', !s.on && R.v15def.stored.ac === 0 && /"on":false/.test(R.v15def.stored.stored || ''), R.v15def.stored);
  await ev(clean);
}
await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: inj.identifier });
const exc = logsBefore.concat(logs()).filter((l) => l.t === 'EXC' || /Uncaught|TypeError|ReferenceError/.test(l.m || ''));
ok('no exceptions', !exc.length, exc.slice(0, 5));
return { pass: !fails.length, nfail: fails.length, fails, R };
