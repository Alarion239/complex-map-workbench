'use strict';
// Hear the function, the app's side (src/soundhooks.js, the app's sound hooks; perfwin/sound/impl/SOUND-PLAN.md 2, 3.2):
// the glue's own functions, taken from the module's text and run against the engine's contract, with the app around
// them stubbed (the state the app hands the hooks as getters, read as A.S, A.sndP and so on, from the stubs here):
//  * the rope (sndMove, spec 3.16): a resting hand's tremor inside 3 px (5 px for a finger) moves nothing; a moving hand
//    is followed 3 px behind; the stream gets the roped point, the order cues and the query the hand's own; no rope on
//    the keyboard probe;
//  * the outcome of a probe's step (sndHearAt): exact → hear.step; a branch cut → hear.cut (and said once); a step
//    through a zero → a seat, never a cut (Calc.throughZP); a typed change of F → hear.pathless; F failing the finite
//    test → hear.gap; a source change → a seat; a key step that crosses nothing plays the point (hear.query); the
//    order cue goes first, at the hand's point;
//  * Listen along's samples (sndSampleAt and the resumable sndSampler, spec 3.13) on the Mountain King, played by the
//    engine's batch
//    (Sound.HT.events): 250 px/s, one sample a ms, a seat only at the start, the four cuts as cuts, pan from x.
// Run: node test/t_hear_glue.js
const vm = require('vm');
const CX = global.CX = require('../src/cx.js');
const Calc = require('../src/calc.js');
const { SEASONG } = require('../src/seasong.js');
const C = CX.C, TAU = 2 * Math.PI;
let bad = 0, n = 0;
function check(name, ok, info = '') { n++; if (!ok) { bad++; console.log('FAIL', name, typeof info === 'string' ? info : JSON.stringify(info)); } else if (process.env.V) console.log('ok  ', name); }

const APP = require('./src_text').source('soundhooks.js');   // (the app's sound hooks, src/soundhooks.js)
// a function of the hooks by its name: from `function name(` to its closing brace (the glue's strings hold balanced braces)
function fnText(name) {
  const i = APP.indexOf(`  function ${name}(`);
  if (i < 0) throw new Error('no function ' + name);
  let d = 0, j = APP.indexOf('{', i);
  for (let k = j; k < APP.length; k++) { const c = APP[k]; if (c === '{') d++; else if (c === '}' && --d === 0) return APP.slice(i, k + 1); }
  throw new Error('unbalanced ' + name);
}
// a one-line const of the hooks by its name
function constText(name) { const m = APP.match(new RegExp(`\\n  const ${name} = [^\\n]*;\\n`)); if (!m) throw new Error('no const ' + name); return m[0]; }

// ---------- the engine, in a sandbox with no audio (its pure core and the contract's shape) ----------
const sb = {
  window: { localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, addEventListener() {} },
  document: { visibilityState: 'visible', addEventListener() {} }, navigator: {}, location: { search: '?ns=glue' },
  performance: { now: () => 0 }, setTimeout: () => 0, clearTimeout() {}, console, URL: { createObjectURL: () => '' }, Blob: function () {},
};
vm.createContext(sb);
vm.runInContext(require('./src_text').source('sound.js', { esm: 'strip' }) + '\n;globalThis.Sound = Sound;', sb);
const Sound = sb.Sound;
check('the engine has the contract: Sound.hear, Sound.along, Sound.HT (events, throughZP)', !!(Sound.hear && Sound.along && Sound.HT && Sound.HT.events && Sound.HT.throughZP && Sound.HT.throughZPAlong));

// ---------- the glue in a context of its own: the app's state and helpers stubbed ----------
function glue(o = {}) {
  const calls = [], said = [];
  const H = {
    seat: (s) => { calls.push(['seat', s]); return { arg: 0, mod: 0, dUp: 0, dDown: 0 }; },
    step: (s) => { calls.push(['step', s]); const r = o.stepRes ? o.stepRes(s) : { arg: 1, mod: 0, dUp: 0, dDown: 0 }; return r; },
    cut: (s) => { calls.push(['cut', s]); return { arg: 0, mod: 0, dUp: 0, dDown: 0 }; },
    pathless: (s) => { calls.push(['pathless', s]); return { arg: 0, mod: 0, dUp: 0, dDown: 0 }; },
    gap: (t) => { calls.push(['gap', t]); },
    cue: (c) => { calls.push(['cue', c]); return 'played'; },
    query: (q) => { calls.push(['query', q]); return true; },
    end: () => { calls.push(['end']); }, active: () => false,
  };
  const ctx = {
    CX, Calc, C, TAU, Math, Number, Array, console, performance: { now: () => ctx.clock }, setTimeout: () => 0, clearTimeout: () => {},
    // (the glue's clock, ms; far ahead of the process's own performance.now(), which Calc.argStep reads for the 3 ms
    // deadline the glue gives it: on a loaded machine the test reaches √z's cut more than a second in, and a clock of
    // 1000 made that deadline already past)
    clock: 1e7, calls, said, H,
    SND: { hear: H, HT: Sound.HT, pathStep: Sound.pathStep },
    sndP: { on: true, sonify: true, events: true },
    S: { sectors: o.n || 12 },
    snd: { rope: null, lastSrc: '', ptype: o.ptype || 'mouse', phi: 0, last: null, g: null, lc: null, vKey: 'v', fKey: 'f', cKey: 'c#0', fcGen: 0, gestT: -1e9, userT: 0, perEval: 2e-4, T: null, path: null, near: 0, run: null, loop: null, play: null, kloop: null, fcN: 0, tracker: true, px: null },
    morph: { open: false, T: null, playing: false },
    chainSig: ['c'], nSteps: () => 0,
    F: o.F || ((z) => z),
    sndF: () => ctx.F, sndFAt: () => ctx.F,
    sndFrameKey: () => 'f', sndVKey: () => 'v', sndUnhush() {}, sndTurnBells() {}, requestRender() {}, rangeParts: () => null, focusDeriv: () => false, derivIn: () => false,
    sndHover: null, sndHoverOff: () => calls.push(['off']), sndStopPlay() {},
    sndNear: (F, z, g, pan, budget, deadline, vs, fn, t) => { calls.push(['near', z]); },
    sndSayOnce: (m) => said.push(m), sndFmt: (w) => `${w.re.toFixed(2)}${w.im < 0 ? '−' : '+'}${Math.abs(w.im).toFixed(2)}i`,
    $t: (s, p) => s.replace(/\{(\w+)\}/g, (m, k) => (p && k in p ? p[k] : m)),
    tourL: {}, tourEmit() {},
    leftView: () => ({ cx: 0, cy: 0, s: 100 }), V: { right: { s: 100 } },
    paneL: { w: 800 }, paneR: { w: 800 },
    sndPickAt: (src, x, y) => C((x - 400) / 100, (200 - y) / 100),
    // (the app's state as soundHooksApi hands it: getters, so a test's reassignment is seen)
    A: { get S() { return ctx.S; }, get sndP() { return ctx.sndP; }, get paneL() { return ctx.paneL; }, get paneR() { return ctx.paneR; }, get chainSig() { return ctx.chainSig; } },
  };
  vm.createContext(ctx);
  const code = [constText('sndClamp'), constText('sndOk'), constText('sndZP'), 'const sndHear = () => SND.hear;', fnText('sndBridge'), fnText('sndHearAt'), fnText('sndHold'), fnText('sndQueryAt'), fnText('sndSampleAt'), fnText('sndSampler'), fnText('sndMove'),
    'globalThis.G = { sndHearAt, sndSampleAt, sndSampler, sndMove, sndQueryAt, sndOk };'].join('\n');
  vm.runInContext(code, ctx);
  // sndHover → sndHearAt (as the hooks' sndHover does once the engine has Sound.hear)
  ctx.sndHover = (z, px, src, fn, zh) => ctx.G.sndHearAt(H, z, px, src, fn, zh || z);
  vm.runInContext('sndHover = globalThis.sndHover;', ctx);
  return ctx;
}
const kinds = (calls) => calls.filter((c) => c[0] !== 'near').map((c) => c[0]);
const px = (z) => [400 + 100 * z.re, 200 - 100 * z.im];
const move = (g, z, src = 'pointer') => { const [x, y] = px(z); g.clock += 16; g.G.sndMove(x, y, z, src); };

// ---- the rope (spec 3.16)
{
  const g = glue();
  move(g, C(1, 0));
  const r0 = g.snd.rope && [g.snd.rope.x, g.snd.rope.y];
  // a tremor of ±2.5 px round the resting hand: the roped point never moves
  for (let i = 0; i < 40; i++) { const a = i * 2.3; const [x, y] = px(C(1, 0)); g.clock += 16; g.G.sndMove(x + 2.5 * Math.cos(a), y + 2.5 * Math.sin(a), g.sndPickAt('pointer', x + 2.5 * Math.cos(a), y + 2.5 * Math.sin(a)), 'pointer'); }
  const steps = g.calls.filter((c) => c[0] === 'step');
  check('rope: a ±2.5 px tremor of a mouse moves nothing (every step at the rested point)', r0 && steps.length === 40 && steps.every((c) => c[1].phi === steps[0][1].phi && c[1].ln === steps[0][1].ln), steps.slice(0, 3));
  check('rope: the order cue looks at the hand\'s own point, the stream at the roped one', g.calls.filter((c) => c[0] === 'near').some((c) => Math.abs(c[1].re - 1) > 1e-3 || Math.abs(c[1].im) > 1e-3));
  // a moving hand: followed 3 px behind
  g.calls.length = 0;
  move(g, C(1.5, 0));
  const rp = g.snd.rope, hx = px(C(1.5, 0))[0];
  check('rope: a moving hand is followed 3 px behind', Math.abs(hx - rp.x - 3) < 1e-9, [hx, rp.x]);
  // a finger: 5 px
  const t = glue({ ptype: 'touch' });
  move(t, C(1, 0));
  const [x0, y0] = px(C(1, 0));
  t.clock += 16; t.G.sndMove(x0 + 4.5, y0, t.sndPickAt('pointer', x0 + 4.5, y0), 'pointer');
  check('rope: a finger\'s 4.5 px jitter stays inside its 5 px rope', t.snd.rope.x === x0, t.snd.rope);
  t.clock += 16; t.G.sndMove(x0 + 9, y0, t.sndPickAt('pointer', x0 + 9, y0), 'pointer');
  check('rope: a finger is followed 5 px behind', Math.abs(t.snd.rope.x - (x0 + 4)) < 1e-9, t.snd.rope);
  // the keyboard probe: no rope
  const k = glue();
  move(k, C(1, 0), 'key'); move(k, C(1.01, 0), 'key');
  check('rope: none on the keyboard probe', k.snd.rope === null && k.calls.filter((c) => c[0] === 'step').length === 1);
}

// ---- the outcome of a step (spec 3.1, 3.7, 3.9, 3.15; [B10], Q11)
{
  // exact steps round a zero of F = z, then a seat on a source change
  const g = glue();
  for (let i = 0; i <= 24; i++) { const a = TAU * i / 24; g.clock += 16; g.G.sndHearAt(g.H, C(Math.cos(a), Math.sin(a)), 400, 'pointer', false, C(Math.cos(a), Math.sin(a))); }
  const k = kinds(g.calls), st = g.calls.filter((c) => c[0] === 'step');
  check('a lap round a zero: a seat, then exact steps; φ +1 turn', k[0] === 'seat' && k.slice(1).every((x) => x === 'step') && st.length === 24 && Math.abs(st[23][1].phi - st[0][1].phi - 23 / 24) < 1e-9, k.join(' '));
  const s = st[5][1];
  check('a sample is {t, phi, ln, pan, n, src}', ['t', 'phi', 'ln', 'pan', 'n', 'src'].every((f) => f in s) && s.n === 12 && s.src === 'hand' && Math.abs(s.t - g.clock / 1000) < 1 && s.pan === 0, s);
  check('the order cue (sndNear) runs before the stream, at the hand', g.calls[0][0] === 'near' || g.calls.findIndex((c) => c[0] === 'near') < g.calls.findIndex((c) => c[0] === 'step'));
  g.calls.length = 0;
  g.clock += 16; g.G.sndHearAt(g.H, C(1, 0.1), 400, 'key', false, C(1, 0.1));
  check('the source changing (pointer → keys) is a stroke start: a seat', kinds(g.calls)[0] === 'seat', kinds(g.calls));
}
{
  // √z across its cut (the negative real axis): a cut, said once
  const g = glue({ F: (z) => CX.sqrt(z) });
  g.G.sndHearAt(g.H, C(-1, 0.05), 400, 'pointer', false, C(-1, 0.05));
  g.clock += 16; g.G.sndHearAt(g.H, C(-1, -0.05), 400, 'pointer', false, C(-1, -0.05));
  check('√z across its cut: hear.cut', kinds(g.calls).join(' ') === 'seat cut', kinds(g.calls));
  check('√z across its cut: the factor is said', g.said.length === 1 && /^Branch cut: F jumps by a factor /.test(g.said[0]), g.said);
  // F = z through its zero exactly: argStep jumps by π, throughZP finds the zero: a seat, never a cut
  const z = glue();
  z.G.sndHearAt(z.H, C(-0.5, 0), 400, 'pointer', false, C(-0.5, 0));
  z.clock += 16; z.G.sndHearAt(z.H, C(0.5, 0), 400, 'pointer', false, C(0.5, 0));
  check('F = z, a step through its zero: a seat, not a cut (throughZP)', kinds(z.calls).join(' ') === 'seat seat' && !z.said.length, kinds(z.calls));
  // 1/z through its pole: the same
  const p = glue({ F: (w) => CX.div(C(1, 0), w) });
  p.G.sndHearAt(p.H, C(-0.5, 0), 400, 'pointer', false, C(-0.5, 0));
  p.clock += 16; p.G.sndHearAt(p.H, C(0.5, 0), 400, 'pointer', false, C(0.5, 0));
  check('1/z, a step through its pole: a seat, not a cut', kinds(p.calls).join(' ') === 'seat seat', kinds(p.calls));
  // F not finite at the point: a gap
  const q = glue({ F: (w) => CX.div(C(1, 0), w) });
  q.G.sndHearAt(q.H, C(0.5, 0), 400, 'pointer', false, C(0.5, 0));
  q.clock += 16; q.G.sndHearAt(q.H, C(0, 0), 400, 'pointer', false, C(0, 0));
  check('F infinite at the point: hear.gap (and the cue looks there, [V6])', kinds(q.calls).join(' ') === 'seat gap' && q.calls.some((c) => c[0] === 'near' && c[1].re === 0), q.calls.map((c) => c[0]));
  // a typed change of F (the chain changed, no path): pathless
  const t = glue();
  t.G.sndHearAt(t.H, C(1, 1), 400, 'pointer', false, C(1, 1));
  t.F = (w) => CX.mul(w, C(2, 0)); t.chainSig[0] = 'c2';
  t.clock += 16; t.G.sndHearAt(t.H, C(1, 1), 400, 'pointer', true, C(1, 1));
  check('F typed anew under a still probe: hear.pathless with src fn', kinds(t.calls).join(' ') === 'seat pathless' && t.calls[t.calls.length - 1][1].src === 'fn', kinds(t.calls));
  // a key step that crosses no line and no band edge plays the point
  const k = glue({ stepRes: () => ({ arg: 0, mod: 0, dUp: 0, dDown: 0 }) });
  k.G.sndHearAt(k.H, C(1, 0), 400, 'key', false, C(1, 0));
  k.clock += 16; k.G.sndHearAt(k.H, C(1.01, 0), 401, 'key', false, C(1.01, 0));
  const qq = k.calls.find((c) => c[0] === 'query');
  check('a key step that crosses nothing: hear.query at the new point', kinds(k.calls).join(' ') === 'seat step query' && qq && Math.abs(qq[1].ln - Math.log(1.01)) < 1e-12 && qq[1].phi === 0, kinds(k.calls));
  check('a key step\'s sample says src key', k.calls.find((c) => c[0] === 'step')[1].src === 'key');
  // pan from x: the pane's left edge −0.3, its right +0.3
  const e = glue();
  e.G.sndHearAt(e.H, C(1, 0), 0, 'pointer', false, C(1, 0)); e.clock += 16; e.G.sndHearAt(e.H, C(1, 0.01), 800, 'pointer', false, C(1, 0.01));
  check('pan: −0.3 at the pane\'s left edge, +0.3 at its right', Math.abs(e.calls.find((c) => c[0] === 'seat')[1].pan + 0.3) < 1e-12 && Math.abs(e.calls.find((c) => c[0] === 'step')[1].pan - 0.3) < 1e-12);
  // the query at a zero: |F| = 0, ln −∞, the probe's pitch class
  const z0 = glue();
  z0.snd.phi = 0.25;
  check('the query exactly on a zero: ln −∞ at the probe\'s pitch class', z0.G.sndQueryAt(C(0, 0), 400, 'pointer') && z0.calls[0][1].ln === -Infinity && z0.calls[0][1].phi === 0.25, z0.calls[0]);
}

// ---- Listen along's samples on the Mountain King (spec 3.13, 6), played by the engine's batch
{
  const sbx = { console, performance: { now: () => 0 }, setTimeout, clearTimeout };
  vm.createContext(sbx);
  for (const [f, nm] of [['cx', 'CX'], ['symbolic', 'Symbolic'], ['parse', 'Expr'], ['derivs', 'Derivs'], ['natpaths', 'NatPaths'], ['funcs', 'Funcs']]) vm.runInContext(require('./src_text').source(f + '.js', { esm: 'strip' }) + `\n;globalThis.${nm} = ${nm};`, sbx, { filename: f + '.js' });
  const [s1, s2] = SEASONG.steps, fU = sbx.Expr.compile(sbx.Expr.parse(s1.params.expr)), fG = sbx.Expr.compile(sbx.Expr.parse(s2.params.expr));
  const F = (z) => fG(fU(z));
  const g = glue();
  g.leftView = () => SEASONG.view;
  vm.runInContext('leftView = globalThis.leftView;', g);
  g.performance = { now: () => Date.now() };
  vm.runInContext('performance = globalThis.performance;', g);
  const P = SEASONG.pts;
  let L = 0;
  for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
  const dur = L * SEASONG.view.s / 250, M = Math.ceil(1000 * dur) + 1;
  const t0 = Date.now();
  // (its F costs about 4 evaluations a sample, 19 000 samples: seconds of work, so Listen along samples it in slices of
  // 12 ms between frames, sndSampler; here the slices run back to back)
  const sm = g.G.sndSampler(F, P, false, M);
  let slices = 0;
  while (sm && !sm.run(12) && slices < 1e5) slices++;
  const R = sm && sm.done() ? sm.result() : null, ms = Date.now() - t0;
  check('Listen along on the Mountain King: sampled in slices of 12 ms, to the end', !!R && slices > 0, { slices, ms });
  check('a slice keeps to its 12 ms (within one block of 64 samples)', !!R && ms / (slices + 1) < 60, { slices, ms });
  if (R) {
    const smp = R.smp, cuts = smp.filter((s) => s.cut).length, seats = smp.filter((s) => s.seat).length, gaps = smp.filter((s) => s.gap).length;
    check('19.1 s at 250 px/s, a sample a millisecond', Math.abs(dur - 19.1) < 0.3 && smp.length === M && Math.abs(smp[1].t - 0.001) < 1e-12 && Math.abs(smp[M - 1].t - (M - 1) / 1000) < 1e-9, [dur, smp.length]);
    check('a seat only at the start, no gap, the four downbeats as cuts', seats === 1 && smp[0].seat && !gaps && cuts === 4, { seats, gaps, cuts });
    check('pan from x in X\'s pane, within ±0.3', smp.every((s) => Math.abs(s.pan) <= 0.3 + 1e-12) && Math.max(...smp.map((s) => s.pan)) > 0.05 && Math.min(...smp.map((s) => s.pan)) < -0.05);
    check('every sample finite', smp.every((s) => Number.isFinite(s.phi) && Number.isFinite(s.ln) && Number.isFinite(s.t)));
    const log = Sound.HT.events(smp, { n: 12, cues: [] });
    const cnt = (k) => log.filter((e) => e.k === k).length;
    check('the engine plays it: 4 cracks, at least the theme\'s 104 notes', cnt('crack') === 4 && cnt('note') >= 100, { note: cnt('note'), crack: cnt('crack'), rep: cnt('rep'), ms });
    // the closed loop's W: a circle round a zero of F = z, once, W = 1
    const c = glue();
    c.leftView = () => ({ cx: 0, cy: 0, s: 100 });
    vm.runInContext('leftView = globalThis.leftView;', c);
    const ring = Array.from({ length: 64 }, (_, i) => [Math.cos(TAU * i / 64), Math.sin(TAU * i / 64)]);
    const Rc = c.G.sndSampleAt((z) => z, ring, true, 2001);
    check('a closed circle round a zero: W = 1, one turn', Rc && Rc.W === 1 && Math.abs(Rc.turns - 1) < 1e-9, Rc && [Rc.W, Rc.turns]);
    const Rs = c.G.sndSampleAt((z) => CX.sqrt(z), ring, true, 2001);
    check('a closed circle round √z\'s branch point: a cut, no W', Rs && Rs.W === null && Rs.smp.filter((s) => s.cut).length === 1, Rs && Rs.smp.filter((s) => s.cut).length);
  }
}

console.log(bad ? `t_hear_glue: ${bad} of ${n} FAILED` : `t_hear_glue: all ${n} passed`);
process.exitCode = bad ? 1 : 0;
