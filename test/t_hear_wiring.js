'use strict';
// Hear the function, the wiring (perfwin/sound/impl/SOUND-PLAN.md 3.9, 3.13): the app's own lines that reach the sound
// hooks, and the hooks' handlers that reach the engine, taken from the source's text and run with the app around them
// stubbed (as test/t_hear_glue.js does; the engine a recording stub):
//  * the query (spec 3.9): a click on a still point (onUp, src/app/14-interaction.js), a finger's long press (the hold's
//    timer there) and Q on the keyboard probe (sndKey) play the point at once; Q with Hear the function off says so;
//  * a press of the pan button (the middle or right button) or a Shift+Alt click is a pan, never a query;
//  * the Notes / Glide radios of the Sound menu (sndInit → soundMode) reach the engine as Sound.set({ glide }); Glide
//    where it can never run is refused, said, and the radios show Notes again;
//  * Listen along's preparation (sndListenFn, a costly F sampled in slices): the same Listen along asked for again goes
//    on preparing (no second sampler), L stops it and its pending slice then plays nothing; the prepared samples play
//    again at once.
// Run: node test/t_hear_wiring.js
const vm = require('vm');
const CX = require('../src/cx.js');
const { source } = require('./src_text');
const C = CX.C, TAU = 2 * Math.PI;
let bad = 0, n = 0;
function check(name, ok, info = '') { n++; if (!ok) { bad++; console.log('FAIL', name, typeof info === 'string' ? info : JSON.stringify(info)); } else if (process.env.V) console.log('ok  ', name); }

const HOOKS = source('soundhooks.js'), APP = source('app.js');
// from `at` (an index of text) to the brace that closes the first one after it
function braced(text, at, what) {
  let d = 0;
  for (let k = text.indexOf('{', at); k < text.length; k++) { const c = text[k]; if (c === '{') d++; else if (c === '}' && --d === 0) return text.slice(at, k + 1); }
  throw new Error('unbalanced ' + what);
}
function fnText(name) { const i = HOOKS.indexOf(`  function ${name}(`); if (i < 0) throw new Error('no function ' + name); return braced(HOOKS, i, name); }
function constText(name) { const m = HOOKS.match(new RegExp(`\\n  const ${name} = [^\\n]*;\\n`)); if (!m) throw new Error('no const ' + name); return m[0]; }

// ---------- the app's side (src/app/14-interaction.js) ----------
// onDown's pan button, onUp's query on a click, and the long press's timer
const panBtnM = APP.match(/\n\s*const panBtn = ([^;\n]+);/);
const upM = APP.match(/\n(\s*if \(e && e\.pointerType !== 'touch'[^\n]*sndQueryClick\(pane, side, qx, qy\);[^\n]*)\n/);
const holdAt = APP.indexOf('t: setTimeout(() => {');
check('the app\'s text has the pan button, the click\'s query and the long press\'s timer', !!(panBtnM && upM && holdAt > 0));
check('a pan-button press on X is a pan marked pb (onDown)', /if \(panBtn\) \{ drag = \{ mode: 'panL',[^\n]*pb: true \}/.test(APP) && /drag = \{ mode: 'panR',[^\n]*pb: panBtn \}/.test(APP));
function app() {
  const ctx = { Math, performance: { now: () => 1000 }, queried: [], moved: [], tool: 'select', hold: null, drag: null, d0: null, ring: null, holdMenuT: 0, touches: new Map([[1, [0, 0]]]),
    pane: { id: 'paneL' }, side: 'L', x0: 120, y0: 80, cv: { getBoundingClientRect: () => ({ left: 0, top: 0 }) }, V: { right: {} }, menu: false };
  Object.assign(ctx, {
    evXY: (pane, e) => [e.x, e.y], sndQueryClick: (pane, side, x, y) => ctx.queried.push([pane.id, side, x, y]),
    PM: () => null, cancelDrawing: () => false, leftView: () => ({ cx: 0, cy: 0 }), requestRender() {}, camOf: () => ({}), setCursor() {},
    openIntegralMenu: () => ctx.menu, onMove: (pane, side, ev) => ctx.moved.push(ev),
  });
  vm.createContext(ctx);
  vm.runInContext(`globalThis.panBtnOf = (e) => (${panBtnM[1]});\nglobalThis.upQuery = (pane, side, e, d) => {${upM[1]}\n};\nglobalThis.holdFire = ${braced(APP, holdAt + 't: setTimeout('.length, 'hold')};`, ctx);
  return ctx;
}
// a press and its release on X with the Select tool, no drag: the down event's pan button as onDown marks it
const click = (g, down, up = down, o = {}) => { const d = Object.assign({ mode: 'panL', pb: !!g.panBtnOf(down), far: false }, o); g.upQuery(g.pane, 'L', Object.assign({ type: 'pointerup', pointerType: 'mouse', x: 120, y: 80 }, up), d); return g.queried.length; };
{
  const g = app();
  check('a click on a still point of X plays it (onUp → sndQueryClick at the click)', click(g, { button: 0 }) === 1 && g.queried[0].join() === 'paneL,L,120,80', g.queried);
  check('a click on Y plays it too', (g.upQuery(g.pane, 'R', { type: 'pointerup', pointerType: 'mouse', button: 0, x: 5, y: 6 }, { mode: 'panR', pb: false }), g.queried.length === 2 && g.queried[1][1] === 'R'));
  const q0 = g.queried.length;
  check('a middle-button click is a pan, not a query', click(g, { button: 1 }) === q0);
  check('a right-button click is a pan, not a query', click(g, { button: 2 }) === q0);
  check('a Shift+Alt click is a pan, not a query', click(g, { button: 0, shiftKey: true, altKey: true }) === q0);
  check('a Shift+Alt press released after the keys is still a pan (pb)', click(g, { button: 0, shiftKey: true, altKey: true }, { button: 0 }) === q0);
  check('a middle-button release after a left press plays nothing', click(g, { button: 0 }, { button: 1 }) === q0);
  check('a press that dragged (far) is a pan, not a query', click(g, { button: 0 }, { button: 0 }, { far: true }) === q0);
  check('a finger\'s tap is not the click\'s query (its query is the long press)', click(g, { button: 0 }, { button: 0, pointerType: 'touch' }) === q0);
  g.tool = 'point';
  check('a construction tool\'s click is no query', click(g, { button: 0 }) === q0);
  g.tool = 'select';
  check('a click on X\'s globe or landscape (orbit, no drag) plays it', click(g, { button: 0 }, { button: 0 }, { mode: 'orbit', side: 'L' }) === q0 + 1);
  check('a pointercancel is no click', (g.upQuery(g.pane, 'L', { type: 'pointercancel', pointerType: 'mouse', button: 0 }, { mode: 'panL' }), g.queried.length === q0 + 1));
}
{
  // the long press: a still finger's hold engages the probe and plays the pressed point
  const hold = (o = {}) => {
    const g = app();
    g.d0 = g.drag = Object.assign({ mode: 'panL', moved: false, cx: 0, cy: 0 }, o.d0);
    g.hold = { id: 1, x: g.x0, y: g.y0, ev: { pointerId: 1, tag: 'held' } };
    if (o.touches) g.touches = new Map(o.touches.map((t, i) => [i, t]));
    if (o.menu) g.menu = true;
    g.holdFire();
    return g;
  };
  const g = hold();
  check('a long press plays the point pressed (sndQueryClick at its start)', g.queried.length === 1 && g.queried[0].join() === 'paneL,L,120,80' && g.drag.mode === 'probe' && g.moved.length === 1 && g.moved[0].tag === 'held', g.queried);
  check('a finger that moved before the ring was full: no query', hold({ d0: { moved: true } }).queried.length === 0);
  check('a second finger: no query', hold({ touches: [[0, 0], [9, 9]] }).queried.length === 0);
  check('a long press on a curve opens its menu, no query', hold({ menu: true }).queried.length === 0);
}

// ---------- the hooks' side (src/soundhooks.js) ----------
// a stub element: attributes, listeners, the fields the hooks set
class El {
  constructor(id) { this.id = id; this.attrs = {}; this.dataset = {}; this.style = {}; this.L = {}; this.hidden = false; this.checked = false; this.disabled = false; this.value = ''; this.textContent = ''; this.innerHTML = ''; }
  setAttribute(k, v) { this.attrs[k] = String(v); } getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; } hasAttribute(k) { return k in this.attrs; } removeAttribute(k) { delete this.attrs[k]; }
  set tabIndex(v) { this.attrs.tabindex = String(v); }
  addEventListener(t, f) { (this.L[t] = this.L[t] || []).push(f); } removeEventListener() {}
  fire(t, o = {}) { const ev = Object.assign({ type: t, target: this, prevented: false, preventDefault() { ev.prevented = true; }, stopPropagation() {} }, o); for (const f of this.L[t] || []) f(ev); return ev; }
  querySelector() { return null; } contains() { return false; } focus() {} getBoundingClientRect() { return { width: 0, bottom: 0, right: 0 }; }
}
function hooks(o = {}) {
  const said = [], sets = [], calls = [], timers = [], els = new Map();
  const st = { on: true, vol: 0.7, ui: true, snap: false, events: true, sonify: true, glide: false, glideOk: true, supported: true, audio: 'none', engine: 'worklet', remembered: true };
  const subs = [];
  const H = { query: (q) => { calls.push(['query', q]); return true; }, end() {}, state: () => ({}) };
  const SND = {
    hear: H, along: () => { calls.push(['along']); return null; },
    state: () => Object.assign({}, st), prefs: () => Object.assign({}, st), subscribe: (f) => subs.push(f),
    set: (p) => { sets.push(p); Object.assign(st, p); for (const f of subs) f(Object.assign({}, st)); },
    play: (k) => calls.push(['play', k]), hush: () => calls.push(['hush']), stopTag: () => {},
  };
  const ctx = {
    CX, C, TAU, Math, Number, Array, Object, String, JSON, console, said, sets, calls, timers, st, H, SND, els,
    clock: 1e6, performance: { now: () => ctx.clock },
    setTimeout: (f) => { timers.push(f); return timers.length; }, clearTimeout() {}, requestAnimationFrame: () => 0, cancelAnimationFrame() {},
    $: (id) => { if (!els.has(id)) els.set(id, new El(id)); return els.get(id); },
    $t: (s, p) => s.replace(/\{(\w+)\}/g, (m, k) => (p && k in p ? p[k] : m)), $tx: (k, s) => s, I18N: { num: (x) => String(x), keyOf: (e) => e.key, lang: 'en' },
    document: new El('document'), window: { innerWidth: 1280 }, navigator: { userAgent: 'node', platform: 'node', maxTouchPoints: 0 },
    Calc: { argStep() {}, orderAt() {} },
    sndP: { on: true, sonify: true, events: true }, S: { sectors: 12, shapes: [], focus: 0 },
    paneL: { w: 800, h: 400, ocanvas: new El('paneL') }, paneR: { w: 800, h: 400, ocanvas: new El('paneR') }, probe: null,
    snd: { rope: { x: 1, y: 2, src: 'pointer' }, phi: 0, last: null, kz: null, kbd: false, ptrT: -1e9, kloop: null, lastLoop: null, play: null, prep: null, prepR: null, listenN: 0, tracker: true, voice: null, ptrOn: true, cv: {} },
    F: o.F || ((z) => z), fk: 'f1', view: { cx: 0, cy: 1, s: 100 }, solo: () => '', morphOn: () => false,
    leftView: () => ctx.view, sndF: () => ctx.F, sndFKey: () => ctx.fk,
    sndSay: (s) => said.push(s), sndFmt: (z) => CX.fmt(z, 2), sndHover: (z, px, src) => calls.push(['hover', z, src]),
    sndPickAt: (src, x, y) => C((x - 400) / 100, (200 - y) / 100),
    sndRender() {}, setReadouts() {}, sndVoiceOff() {}, sndCurveOff() {}, sndPtr() {}, sndPtrUp() {}, sndRelayout() {}, sndUnhush() {}, soundToggle() {},
    tourSndMine() {}, tourEmit: (k) => calls.push(['tour', k]), updateDraftChips() {}, sndPlayEnded() {},
    touchUI: () => false, morph: { open: false },
    sndSampler: (F, pts, closed, M) => { const sm = ctx.mkSampler(F, pts, closed, M); calls.push(['sampler', M]); return sm; },
    sndListenGo: (R) => { calls.push(['go', R]); return true; },
    sndListenShape: () => calls.push(['shape']),
  };
  ctx.A = {
    get S() { return ctx.S; }, get sndP() { return ctx.sndP; }, set sndP(v) { ctx.sndP = v; }, get paneL() { return ctx.paneL; }, get paneR() { return ctx.paneR; },
    get probe() { return ctx.probe; }, set probe(v) { ctx.probe = v; }, get chainSig() { return ['c']; }, get built() { return []; },
  };
  vm.createContext(ctx);
  const code = [constText('sndClamp'), constText('sndOk'), 'const sndHear = () => (SND && SND.hear ? SND.hear : null);', constText('sndStep'),
    ...['sndBridge', 'sndQueryAt', 'sndQueryClick', 'sndQueryKey', 'sndKeyStart', 'sndProbeTo', 'sndKey', 'soundMode', 'sndGlideOk', 'sndSync', 'sndInit', 'sndListen', 'sndListenFn', 'sndStopPlay'].map(fnText),
    'globalThis.G = { sndQueryClick, sndKey, sndInit, sndListen, sndSync };'].join('\n');
  vm.runInContext(code, ctx);
  return ctx;
}
const queries = (h) => h.calls.filter((c) => c[0] === 'query').map((c) => c[1]);
const key = (h, k, o = {}) => h.paneL.ocanvas.fire('keydown', Object.assign({ key: k }, o));
const near = (a, b) => Math.abs(a - b) < 1e-12;
const tick = (h) => { const f = h.timers.shift(); if (f) f(); };   // (the next pending timer, if any)

// ---- the query a click and a long press reach (sndQueryClick)
{
  const h = hooks();
  h.G.sndQueryClick({}, 'L', 400, 100);   // z = i: arg F a quarter turn, |F| = 1, the pane's middle
  const q = queries(h);
  check('the click\'s query plays F at the point clicked (Sound.hear.query)', q.length === 1 && near(q[0].phi, 0.25) && near(q[0].ln, 0) && near(q[0].pan, 0), q);
  h.G.sndQueryClick({}, 'L', 800, 200);
  check('its pan from x: +0.3 at X\'s right edge', near(queries(h)[1].pan, 0.3), queries(h)[1]);
  h.G.sndQueryClick({}, 'R', 400, 100);
  check('a click on Y with no deformation shown there plays nothing (Y is not X\'s plane)', queries(h).length === 2);
  h.sndP = { on: true, sonify: false, events: true };
  h.G.sndQueryClick({}, 'L', 400, 100);
  check('with Hear the function off a click plays nothing', queries(h).length === 2);
}

// ---- Q on the keyboard probe (sndKey, through the X plane's keydown)
{
  const h = hooks();
  h.G.sndInit();
  h.snd.kbd = false;
  check('Q after a click in the plane stays the app\'s shortcut (no probe)', !key(h, 'q').prevented && !queries(h).length);
  h.paneL.ocanvas.fire('focus');   // (the focus came from the keyboard: no press in the last 400 ms)
  check('the plane focused from the keyboard takes the probe\'s keys', h.snd.kbd === true);
  const e = key(h, 'q');
  const q = queries(h);
  check('Q: the probe starts at the view\'s centre and its point plays at once', e.prevented && q.length === 1 && near(q[0].phi, 0.25) && near(q[0].ln, 0) && near(q[0].pan, 0) && h.snd.kz && near(h.snd.kz.im, 1), q);
  check('Q: the probe\'s start is said', h.said.some((s) => /^Probe at the centre, z = /.test(s)), h.said);
  key(h, 'ArrowRight');
  key(h, 'Q');
  const q2 = queries(h);
  check('Q (or Shift+Q) after a step plays the probe\'s new point', q2.length === 2 && near(q2[1].phi, Math.atan2(1, 0.1) / TAU) && near(q2[1].ln, 0.5 * Math.log(1.01)), q2[1]);
  check('Ctrl+Q is not the probe\'s', !key(h, 'q', { ctrlKey: true }).prevented && queries(h).length === 2);
  h.SND.set({ sonify: false });   // (the engine's state reaches the hooks' sndP through sndSync)
  h.said.length = 0;
  const e2 = key(h, 'q');
  check('Q with Hear the function off: no note, and it says how to turn it on', e2.prevented && queries(h).length === 2 && h.said.length === 1 && h.said[0] === 'Hear the function under the pointer is off: turn it on in the Sound menu to hear the point.', h.said);
  h.SND.set({ on: false });
  check('Q with sound off is not the probe\'s', !key(h, 'q').prevented && queries(h).length === 2);
  const h2 = hooks();
  h2.SND.hear = null;
  h2.G.sndInit(); h2.paneL.ocanvas.fire('focus');
  check('Q on an engine with no Sound.hear is not the probe\'s', !key(h2, 'q').prevented && !h2.said.length);
}

// ---- the Notes / Glide radios (sndInit → soundMode → Sound.set)
{
  const h = hooks();
  h.G.sndInit();
  const notes = h.$('sndNotes'), glide = h.$('sndGlide');
  check('the radios start on the engine\'s mode: Notes', notes.checked && !glide.checked && !glide.disabled);
  glide.checked = true; glide.fire('change');
  check('Glide reaches the engine: Sound.set({ glide: true })', h.sets.length === 1 && h.sets[0].glide === true && h.st.glide === true, h.sets);
  check('Glide: said, the rope let go, the radios on Glide', h.said[h.said.length - 1] === 'Hear the function: glide.' && h.snd.rope === null && glide.checked && !notes.checked, h.said);
  notes.checked = true; notes.fire('change');
  check('Notes reaches the engine: Sound.set({ glide: false })', h.sets.length === 2 && h.sets[1].glide === false && h.st.glide === false && h.said[h.said.length - 1] === 'Hear the function: notes.' && notes.checked && !glide.checked, h.sets);
  glide.checked = false; glide.fire('change');
  check('a radio that turns unchecked sets nothing', h.sets.length === 2);
  check('the radios are off while sound is off, or both Hear the function and events are', (h.SND.set({ on: false }), notes.disabled && glide.disabled) && (h.SND.set({ on: true, sonify: false, events: false }), notes.disabled) && (h.SND.set({ sonify: true }), !notes.disabled && !glide.disabled));
  // where the Glide can never run (the nodes engine, no AudioWorklet): refused, said, the radios back on Notes
  const g = hooks();
  g.st.glideOk = false;
  g.G.sndInit();
  const gl = g.$('sndGlide'), no = g.$('sndNotes');
  check('no worklet: the Glide radio is off, its note shown', gl.disabled && g.$('sndGlideNo').hidden === false);
  gl.checked = true; gl.fire('change');
  check('no worklet: Glide never reaches the engine; said; the radios show Notes', !g.sets.length && g.said[g.said.length - 1] === 'Glide needs a browser with AudioWorklet.' && no.checked && !gl.checked, g.said);
}

// ---- Listen along's preparation (sndListen → sndListenFn on a costly F; L in sndKey)
{
  const h = hooks();
  let done = false, frac = 0.4;
  const R = { smp: [], zs: [], W: null };
  h.mkSampler = () => ({ run: () => done, frac: () => frac, result: () => R });
  const shape = { id: 's1' };
  h.S.shapes.push(shape);
  h.view = { cx: 0, cy: 0, s: 100 };
  const pts = [[0, 0], [2.5, 0], [5, 0]];   // 5 units, 500 px at 250 px/s: 2 s, 2001 samples
  const samplers = () => h.calls.filter((c) => c[0] === 'sampler').length, gos = () => h.calls.filter((c) => c[0] === 'go').length;
  check('Listen along on a costly F prepares: said, its tour event, one sampler of 2001 samples, a slice pending', h.G.sndListen(pts, false, '', null, shape) === true && samplers() === 1 && h.calls.find((c) => c[0] === 'sampler')[1] === 2001
    && h.snd.prep && h.said[h.said.length - 1] === 'Preparing to listen along: F takes a moment here.' && h.calls.some((c) => c[0] === 'tour' && c[1] === 'listen-preparing') && h.timers.length === 1 && !gos(), { said: h.said, calls: h.calls.map((c) => c[0]) });
  const prep = h.snd.prep, nSaid = h.said.length;
  check('the same Listen along again while it prepares: it goes on preparing (no second sampler, not said again)', h.G.sndListen(pts, false, '', null, shape) === true && samplers() === 1 && h.snd.prep === prep && h.said.length === nSaid && h.timers.length === 1);
  frac = 0.6;
  tick(h);
  check('a slice not done: the share prepared (60 %) and the next slice', prep.pc === 60 && h.timers.length === 1 && h.snd.prep === prep && !gos(), prep);
  h.G.sndInit(); h.paneL.ocanvas.fire('focus');
  const e = key(h, 'l');
  check('L stops the preparation', e.prevented && h.snd.prep === null && !h.calls.some((c) => c[0] === 'shape'));
  done = true;
  tick(h);
  check('a slice after L plays nothing (no Sound.along, no start)', !gos() && !h.calls.some((c) => c[0] === 'along') && !h.timers.length && h.snd.prepR == null);
  // asked again after the stop: prepared afresh, to its end; then again: the prepared samples at once
  done = false;
  check('Listen along again after L prepares afresh', h.G.sndListen(pts, false, '', null, shape) === true && samplers() === 2 && h.snd.prep && h.snd.prep !== prep);
  done = true;
  tick(h);
  check('its samples ready: it starts with them, kept for the next time', gos() === 1 && h.calls.find((c) => c[0] === 'go')[1] === R && h.snd.prep === null && h.snd.prepR && h.snd.prepR.R === R);
  check('the same Listen along once prepared: it starts at once (no sampler)', h.G.sndListen(pts, false, '', null, shape) === true && gos() === 2 && samplers() === 2);
  // F changed while it prepares (the chain, t): dropped silently
  done = false; h.fk = 'f2';
  h.G.sndListen(pts, false, '', null, shape);
  const p2 = h.snd.prep, ns = h.said.length;
  h.fk = 'f3';
  tick(h);
  check('F changed while it prepares: dropped silently, nothing plays', samplers() === 3 && p2 && h.snd.prep === null && gos() === 2 && h.said.length === ns && !h.timers.length);
  // another curve while one prepares: the new one replaces it
  h.fk = 'f4';
  h.G.sndListen(pts, false, '', null, shape);
  const p3 = h.snd.prep;
  h.G.sndListen([[0, 0], [0, 4]], false, '', null, shape);
  check('another curve while one prepares replaces it', samplers() === 5 && h.snd.prep && h.snd.prep !== p3 && h.snd.prep.key !== p3.key);
}

console.log(bad ? `t_hear_wiring: ${bad} of ${n} FAILED` : `t_hear_wiring: all ${n} passed`);
process.exitCode = bad ? 1 : 0;
