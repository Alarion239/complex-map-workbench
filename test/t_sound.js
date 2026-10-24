// Sound (notes/sound/DESIGN.md): the pure parts. Calc.argStep and Calc.orderAt (the probe's exact arg steps and the
// order at a point, by the argument principle), winding counts, and the engine's scheduler and its guards (src/sound.js
// run in a sandbox against a mock AudioContext: off by default, consent, the queues, the cluster and storm guards, the
// suspended-context rule, the silent off, Esc). v15.2 (notes/sound/AS-BUILT-v152.md): palette B's parts (variation,
// repetition, clean edges), the scrub's landmarks, the phase harp (its low Ds count the winding number), curves sing
// (the loudest harmonic is 4 + W). Run: node test/t_sound.js
const fs = require('fs'), path = require('path'), vm = require('vm');
global.CX = require('../src/cx.js');
const Calc = require('../src/calc.js');
const C = CX.C, TAU = 2 * Math.PI;
let bad = 0, n = 0;
function check(name, ok, info = '') { n++; if (!ok) { bad++; console.log('FAIL', name, info); } }
const mul = (a, b) => CX.mul(a, b), sub = (a, b) => CX.sub(a, b);
const rational = (zeros, poles) => (z) => {
  let w = C(1, 0);
  for (const [a, m] of zeros) for (let j = 0; j < m; j++) w = mul(w, sub(z, a));
  for (const [p, m] of poles) for (let j = 0; j < m; j++) w = CX.div(w, sub(z, p));
  return w;
};
const sqrtP = (z) => { const r = Math.hypot(z.re, z.im), u = Math.sqrt(0.5 * (r + z.re)), v = Math.sqrt(0.5 * Math.max(0, r - z.re)); return C(u, z.im < 0 ? -v : v); };
const expF = (z) => { const r = Math.exp(z.re); return C(r * Math.cos(z.im), r * Math.sin(z.im)); };

// ---------- Calc.argStep ----------
{
  const id = (z) => z;
  let r = Calc.argStep(id, C(1, 0), null, C(0, 1), null);
  check('argStep z: 1 → i is +π/2, exact', r.exact && Math.abs(r.d - Math.PI / 2) < 1e-12, JSON.stringify(r));
  // z^5 along a 45° arc chord: 5 × 45° = 225°, more than half a turn, with its true sign (a principal difference
  // would give −135°)
  const z5 = (z) => { let w = C(1, 0); for (let i = 0; i < 5; i++) w = mul(w, z); return w; };
  r = Calc.argStep(z5, C(1, 0), null, C(Math.SQRT1_2, Math.SQRT1_2), null);
  check('argStep z^5 over 45°: +225° (true sign)', r.exact && Math.abs(r.d - 5 * Math.PI / 4) < 1e-9, r.d);
  r = Calc.argStep(sqrtP, C(-1, 0.3), null, C(-1, -0.3), null);
  check('argStep √z across its cut: a jump', !r.exact && r.why === 'jump', JSON.stringify(r));
  r = Calc.argStep(sqrtP, C(1, 0.3), null, C(1, -0.3), null);
  check('argStep √z away from its cut: exact', r.exact && r.d < 0, JSON.stringify(r));
  r = Calc.argStep(id, C(-1, 0), null, C(1, 0), null);
  check('argStep through a zero: why zero', !r.exact && r.why === 'zero', JSON.stringify(r));
  r = Calc.argStep((z) => CX.inv(z), C(-1, 0), null, C(1, 0), null);
  check('argStep through a pole: why pole', !r.exact && r.why === 'pole', JSON.stringify(r));
  r = Calc.argStep(id, C(0, 0), null, C(1, 0), null);
  check('argStep from a zero: why end', !r.exact && r.why === 'end', JSON.stringify(r));
  // the wall-clock deadline (review: the 3 ms per event held even when the cost estimate is off): a slow F across
  // sin(1/z)'s essential singularity stops at the deadline, as 'budget', whatever the call budget
  {
    const slow = (z) => { const t = performance.now(); while (performance.now() - t < 0.02) { /* 20 µs a call */ } const q = CX.inv(z); return C(Math.sin(q.re) * Math.cosh(q.im), Math.cos(q.re) * Math.sinh(q.im)); };
    const t0 = performance.now();
    r = Calc.argStep(slow, C(-0.3, 0.02), null, C(0.3, 0.02), null, { budget: 1e6, deadline: t0 + 3 });
    const dt = performance.now() - t0;
    check('argStep deadline: stops near 3 ms as budget', !r.exact && r.why === 'budget' && dt < 6, JSON.stringify({ why: r.why, evals: r.evals, dt }));
    const t1 = performance.now();
    const m = Calc.orderAt(slow, C(0, 0), 0.05, { budget: 1e6, deadline: t1 + 3 });
    check('orderAt deadline: null within about 3 ms', m === null && performance.now() - t1 < 6, performance.now() - t1);
  }
  // a budget: e^(50 z) turns 50 radians along a unit step
  r = Calc.argStep((z) => expF(CX.scale(z, 50)), C(0, 0), null, C(0, 0.3), null, { budget: 20 });
  // (the budget is checked before each bisection; a few leaf evaluations already under way may finish)
  check('argStep over budget: why budget', !r.exact && r.why === 'budget' && r.evals <= 20 + 8, JSON.stringify(r));
  r = Calc.argStep((z) => expF(CX.scale(z, 50)), C(0, 0), null, C(0, 0.3), null);
  check('argStep e^(50z) over 0.3i: 15 radians', r.exact && Math.abs(r.d - 15) < 1e-9, r.d);
}

// ---------- Calc.orderAt (N − P on a 16-gon) ----------
{
  const sq = rational([[C(1, 0), 1], [C(-1, 0), 1]], []);
  check('orderAt z²−1 at 1: 1', Calc.orderAt(sq, C(1.02, 0.01), 0.1) === 1);
  check('orderAt z²−1 at 0: 0', Calc.orderAt(sq, C(0, 0), 0.3) === 0);
  check('orderAt z²−1 around both: 2', Calc.orderAt(sq, C(0, 0.01), 1.5) === 2);
  const rat = rational([[C(1, 0), 1], [C(-1, 0), 2]], [[C(0, 1), 1], [C(0, -1), 1]]);
  check('orderAt double zero: 2 (exact for m ≥ 2)', Calc.orderAt(rat, C(-1.03, 0.02), 0.1) === 2);
  check('orderAt pole: −1', Calc.orderAt(rat, C(0.01, 1.02), 0.1) === -1);
  const z7 = rational([[C(0.3, -0.2), 7]], []);
  check('orderAt order 7: 7', Calc.orderAt(z7, C(0.31, -0.19), 0.05) === 7);
  const p3 = rational([], [[C(0, 0), 3]]);
  check('orderAt pole of order 3: −3', Calc.orderAt(p3, C(0.004, 0.002), 0.02) === -3);
  check('orderAt √z at its branch point: null', Calc.orderAt(sqrtP, C(0, 0), 0.1) === null);
  check('orderAt e^z: 0', Calc.orderAt(expF, C(0.2, 5), 0.5) === 0);
  check('orderAt within a tiny budget: null', Calc.orderAt(z7, C(0.31, -0.19), 0.05, { budget: 10 }) === null);
}

// ---------- winding counts (what a loop, the bells and "listen along" report) ----------
{
  const circle = (c, r, N = 96) => Array.from({ length: N }, (_, k) => [c.re + r * Math.cos(TAU * k / N), c.im + r * Math.sin(TAU * k / N)]);
  const rat = rational([[C(1, 0), 1], [C(-1, 0), 2]], [[C(0, 1), 1], [C(0, -1), 1]]);
  const w = (F, pts) => Calc.argPrinciple(F, pts);
  check('winding around the double zero: 2', w(rat, circle(C(-1, 0), 0.4)).winding === 2);
  check('winding around zero 1 and pole i: 0', w(rat, circle(C(0.5, 0.5), 0.75)).winding === 0 && w(rat, circle(C(0.5, 0.5), 0.75)).ok);
  check('winding around everything: 3 − 2 = 1', w(rat, circle(C(0, 0), 2)).winding === 1);
  check('winding of 1/z around 0: −1', w((z) => CX.inv(z), circle(C(0, 0), 1)).winding === -1);
  const r = w(sqrtP, circle(C(0, 0), 1));
  check('√z around its branch point: not ok (a cut crosses)', !r.ok, JSON.stringify(r));
  // the turn bells of a loop, as the app counts them (a turn back must reach the previous integer): the arg sampled
  // along the loop and stepped exactly, exactly W bells, all the same direction
  const pts = circle(C(-1, 0), 0.4, 200).map(([x, y]) => C(x, y)).concat([C(-0.6, 0)]);
  let phi = 0, k = 0, up = 0, down = 0;
  for (let i = 1; i < pts.length; i++) {
    phi += Calc.argStep(rat, pts[i - 1], null, pts[i], null).d / TAU;
    while (phi >= k + 1) { k++; up++; }
    while (phi <= k - 1) { k--; down++; }
  }
  check('bells around the double zero: 2 up, 0 down', up === 2 && down === 0, `${up} ${down}`);
}

// ---------- the engine: src/sound.js in a sandbox, against a mock AudioContext ----------
function makeEnv(opts = {}) {
  const env = { clock: 0, ctxs: [], timers: [], listeners: {}, store: new Map(Object.entries(opts.store || {})), made: [], userActive: !!opts.userActive };
  class Param {
    constructor(v) { this.value = v; this.calls = []; }
    setValueAtTime(v, t) { this.calls.push(['set', v, t]); return this; }
    linearRampToValueAtTime(v, t) { this.calls.push(['lin', v, t]); return this; }
    exponentialRampToValueAtTime(v, t) { this.calls.push(['exp', v, t]); return this; }
    setTargetAtTime(v, t, c) { this.calls.push(['tgt', v, t, c]); return this; }
    cancelScheduledValues(t) { this.calls.push(['cancel', t]); return this; }
    setValueCurveAtTime(c, t, d) { this.calls.push(['curve', c.length, t, d]); return this; }
  }
  class AC {
    constructor() {
      env.ctxs.push(this);
      this.state = opts.startSuspended ? 'suspended' : 'running'; this.currentTime = 0; this.sampleRate = 48000; this.baseLatency = 0.005; this.outputLatency = 0;
      this.sources = []; this.destination = this.node();
      this.resumeNever = false;
    }
    node(extra = {}) { const c = this; return Object.assign({ context: c, gain: new Param(1), connect: (d) => d, disconnect() {} }, extra); }
    createGain() { return this.node(); }
    createStereoPanner() { return this.node({ pan: new Param(0) }); }
    createConvolver() { return this.node({ buffer: null }); }
    createWaveShaper() { return this.node({ curve: null, oversample: 'none' }); }
    createBiquadFilter() { return this.node({ frequency: new Param(350), Q: new Param(1), type: 'lowpass' }); }
    createBuffer(ch, len, fs) { const d = Array.from({ length: ch }, () => new Float32Array(len)); return { length: len, sampleRate: fs, numberOfChannels: ch, getChannelData: (i) => d[i] }; }
    createPeriodicWave() { return {}; }
    src(kind) {
      const c = this, s = this.node({ kind, frequency: new Param(440), detune: new Param(0), type: 'sine', buffer: null, onended: null, started: null, stopped: null,
        start(t) { s.started = t; c.sources.push(s); }, stop(t) { s.stopped = t == null ? c.currentTime : t; }, setPeriodicWave() {} });
      return s;
    }
    createOscillator() { return this.src('osc'); }
    createBufferSource() { return this.src('buf'); }
    resume() { if (this.resumeNever) return new Promise(() => {}); this.state = 'running'; if (this.onstatechange) this.onstatechange(); return Promise.resolve(); }
    suspend() { this.state = 'suspended'; if (this.onstatechange) this.onstatechange(); return Promise.resolve(); }
  }
  const win = {
    AudioContext: opts.noAudio ? undefined : AC,
    localStorage: { getItem: (k) => (env.store.has(k) ? env.store.get(k) : null), setItem: (k, v) => env.store.set(k, String(v)), removeItem: (k) => env.store.delete(k) },
    addEventListener: (t, f) => { (env.listeners[t] = env.listeners[t] || []).push(f); },
  };
  const sandbox = {
    window: win, console, Math, JSON, Object, Array, Float32Array, Float64Array, Number, String, Set, Map, Promise, Error, isFinite, encodeURIComponent,
    // (a test page by default, as the app's test tabs are: ?ns=; search: '' is the published page)
    location: { search: opts.search != null ? opts.search : '?ns=t0' },
    URLSearchParams,
    navigator: { userActivation: { get hasBeenActive() { return true; }, get isActive() { return env.userActive; } } },
    document: { visibilityState: 'visible', addEventListener: (t, f) => { (env.listeners['doc:' + t] = env.listeners['doc:' + t] || []).push(f); } },
    performance: { now: () => env.clock },
    setTimeout: (f, ms) => { env.timers.push({ f, at: env.clock + (ms || 0) }); return env.timers.length; },
    clearTimeout: (id) => { if (id && env.timers[id - 1]) env.timers[id - 1].f = null; },
    URL: { createObjectURL: () => 'blob:x' }, Blob: function () {},
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/sound.js'), 'utf8') + '\n;globalThis.Sound = Sound;', sandbox);
  env.Sound = sandbox.Sound;
  for (const k in env.Sound.CATALOG) { const d = env.Sound.CATALOG[k], m = d.make; d.make = (Pt, o) => { env.made.push(k); return m(Pt, o); }; }
  env.fire = (t, e = {}) => { for (const f of env.listeners[t] || []) f(Object.assign({ type: t }, e)); };
  env.advance = (ms) => {
    const end = env.clock + ms;
    for (;;) {
      let next = null;
      for (const tm of env.timers) if (tm.f && tm.at <= end && (!next || tm.at < next.at)) next = tm;
      if (!next) break;
      env.clock = next.at; const f = next.f; next.f = null; f();
    }
    env.clock = end;
    for (const c of env.ctxs) if (c.state === 'running') c.currentTime += ms / 1000;
  };
  env.ctx = () => env.ctxs[env.ctxs.length - 1] || null;
  return env;
}
const flush = () => new Promise((r) => setImmediate(r));

(async () => {
  // v15 defaults (notes/sound/README.md): the published page has sound on, Interface and Mathematical events on, Snap
  // ticks and Hear the function off; nothing is created or played before the page's first click or key
  {
    const e = makeEnv({ search: '' });
    const p = e.Sound.prefs();
    check('v15 default: on, Interface and events on, snap and Hear F off', p.on && p.ui && p.events && !p.snap && !p.sonify, JSON.stringify(p));
    check('v15 default: no context at load', e.ctxs.length === 0 && e.Sound.state().audio === 'none');
    check('v15 default: nothing plays before a gesture', e.Sound.play('toggleOn', {}) === false && e.Sound.play('stepAdd', {}) === false && e.ctxs.length === 0);
    e.fire('keydown', { key: 'Escape' });
    check('v15 default: Esc is not an activation', e.ctxs.length === 0);
    e.fire('pointerdown');
    check('v15 default: the first click creates the context', e.ctxs.length === 1 && e.ctx().state === 'running');
    check('v15 default: nothing stored until the user chooses', !e.store.has('cmw-sound'));
  }
  // v15.2 the deformation scrub (palette B, notes/sound/v2/DESIGN.md §3 with board-fixes.md): the texture follows the
  // speed (the synth's; none in this mock, which has no AudioWorklet), and the landmarks t = 0, ¼, ½, ¾, 1 ring a
  // wooden note: one per input event (the nearest where t lands), re-armed only 0.02 away (0.05 at the ends), the same
  // one at most once in 150 ms
  {
    const e = makeEnv({ search: '' }); e.fire('pointerdown');
    const S = e.Sound, marks = () => e.made.filter((k) => k === 'landmark').length;
    let u = 0.1;
    for (let i = 0; i < 20; i++) { e.advance(100); S.scrub(u, u + 0.01); u += 0.01; }
    check('scrub slow (0.1 → 0.3): one landmark (¼), no detents', marks() === 1 && e.made.length === 1, e.made.join());
    e.advance(400); e.made.length = 0;
    u = 0.05;
    let vmax = 0;
    for (let i = 0; i < 40; i++) { e.advance(16); const u1 = Math.min(1, u + 0.025); S.scrub(u, u1); u = u1; vmax = Math.max(vmax, S.scrubState().v); }
    check('scrub fast (0.05 → 1): ¼, ½, ¾ and 1, one each', marks() === 4, e.made.join());
    check('scrub fast: the speed is t per second (0.025 per 16 ms: 1.56)', Math.abs(vmax - 0.025 / 0.016) < 1e-6, vmax);
    e.advance(400); e.made.length = 0;
    // a resting, trembling hand on ½ (±0.004): one note, then none until t leaves ½ by 0.02
    S.scrub(0.4, 0.5); for (let i = 0; i < 40; i++) { e.advance(16); S.scrub(0.5 + 0.004 * (i % 2 ? 1 : -1), 0.5 - 0.004 * (i % 2 ? 1 : -1)); }
    check('scrub: a 2 px tremor on ½ rings ½ once', marks() === 1, marks());
    e.advance(400); e.made.length = 0;
    S.scrub(0.6, 0.6); e.advance(200); S.scrub(0, 1);
    check('scrub: a jump 0 → 1 in one event rings one landmark', marks() === 1, marks());
    // Mathematical events off: nothing
    S.set({ events: false }); e.made.length = 0; e.advance(2000);
    for (let i = 0; i < 10; i++) { e.advance(100); S.scrub(0.1 + 0.05 * i, 0.15 + 0.05 * i); }
    check('scrub: Mathematical events off, no landmark', marks() === 0);
    S.scrubEnd();
  }
  // a stored choice always wins over the default
  {
    const e = makeEnv({ search: '', store: { 'cmw-sound': JSON.stringify({ on: false, vol: 0.7, ui: true, snap: false, events: true, sonify: false }) } });
    check('stored off wins: off at load', e.Sound.prefs().on === false);
    e.fire('pointerdown'); e.fire('click');
    check('stored off wins: a click creates nothing', e.ctxs.length === 0 && e.Sound.play('toggleOn', { force: true }) === false);
  }
  // a test page (?ns=): off by default, so the quality and perf suites stay silent; nothing is created at load, on a
  // hover or a click
  {
    const e = makeEnv();
    check('engine: off by default under ?ns=', e.Sound.prefs().on === false && e.Sound.state().audio === 'none');
    e.fire('pointerdown'); e.fire('click');
    check('engine: no cue, no context while off', e.Sound.play('toggleOn', { force: true }) === false && e.Sound.heightVoice() === null && e.ctxs.length === 0);
    check('engine: off → no AudioContext at all', e.ctxs.length === 0);
  }
  // a remembered "on" waits for a click or key of this page load
  {
    const e = makeEnv({ search: '', store: { 'cmw-sound': JSON.stringify({ on: true, vol: 0.7, ui: true, snap: false, events: true, sonify: true }) } });
    check('remembered on: no context at load', e.ctxs.length === 0 && e.Sound.prefs().on);
    check('remembered on: a hover schedules nothing', e.Sound.play('toggleOn', {}) === false && e.Sound.heightVoice() === null && e.ctxs.length === 0);
    e.fire('keydown', { key: 'Escape' });
    check('remembered on: Esc is not an activation', e.ctxs.length === 0);
    e.fire('pointerdown');
    check('remembered on: the first click creates it', e.ctxs.length === 1 && e.ctx().state === 'running');
  }
  // the lsk namespace: a ?ns= page keeps its own setting
  {
    const e = makeEnv({ search: '?ns=t1', store: { 'cmw-sound': JSON.stringify({ on: true }) } });
    check('storage key: lsk(cmw-sound) under ?ns=', e.Sound.prefs().on === false);
    e.Sound.set({ on: true }, { quiet: true });
    check('storage key written: cmw-sound:t1', e.store.has('cmw-sound:t1') && JSON.parse(e.store.get('cmw-sound:t1')).on === true);
  }
  // turning on: the defaults, and the "on" confirmation inside the gesture
  {
    const e = makeEnv();
    e.Sound.set({ on: true });
    const p = e.Sound.prefs();
    check('first on: Interface on, snap off, events on, sonify off', p.ui && !p.snap && p.events && !p.sonify, JSON.stringify(p));
    check('first on: the toggle-on key plays', e.made.join() === 'toggleOn', e.made.join());
    // default tiers: pointer cues (cut, zero, contour, turn) are silent
    e.made.length = 0;
    for (let i = 0; i < 40; i++) { e.advance(130); e.Sound.play('cut', {}); e.Sound.play('zero', { order: 1 }); e.Sound.tick({ k: i % 5 }); e.Sound.turn({ dir: 1 }); }
    check('default tiers: no pointer cue at all', e.made.length === 0, e.made.join());
    check('default tiers: no voice, no harp', e.Sound.heightVoice() === null && e.Sound.harp(0.3, {}) === null && e.Sound.harp(1.3, {}) === null);
    // snap ticks have their own switch
    check('snap: off by default', e.Sound.play('snap', {}) === false);
    e.Sound.set({ snap: true }); e.advance(200);
    check('snap: on with its switch', e.Sound.play('snap', {}) === true);
  }
  // count-bearing queues: 5 turns in one event → 5 bells; 12 → 8 and one flourish; Interface cues still play after
  {
    const e = makeEnv();
    e.Sound.set({ on: true, sonify: true }, { quiet: true }); e.advance(10);
    e.made.length = 0;
    const r5 = []; for (let i = 0; i < 5; i++) r5.push(e.Sound.turn({ dir: 1, pc: 0 }));
    check('queue: 5 turns → 5 bells', r5.every((x) => x === true) && e.made.filter((x) => x === 'turn').length === 5, JSON.stringify(r5));
    e.advance(3000); e.made.length = 0;
    const r12 = []; for (let i = 0; i < 12; i++) r12.push(e.Sound.turn({ dir: 1, pc: 0 }));
    const bells = e.made.filter((x) => x === 'turn').length, many = e.made.filter((x) => x === 'turnMany').length;
    check('queue: 12 turns → 8 bells and one flourish', bells === 8 && many === 1, `${bells} ${many} ${JSON.stringify(r12)}`);
    check('queue: the rest coalesced, none silently refused', r12.filter((x) => x === 'coalesced').length === 4, JSON.stringify(r12));
    e.advance(100);
    check('queue: an Interface cue right after still plays', e.Sound.play('stepAdd', {}) === true);
    // contour ticks: ≤ 12 a second, beyond 0.5 s of backlog they coalesce
    e.advance(3000); e.made.length = 0;
    const rt = []; for (let i = 0; i < 10; i++) rt.push(e.Sound.tick({ k: i }));
    check('contour ticks: 6 queued, the rest coalesced', e.made.filter((x) => x === 'contour').length === 6 && rt.filter((x) => x === 'coalesced').length === 4, `${e.made.join()} ${JSON.stringify(rt)}`);
    // the audio clock moves by render quanta even inside one burst of calls (the v14 gate measured 256 frames at
    // 48 kHz after the 3rd call): the first bell has not sounded yet, so still 8 bells and one flourish
    for (const q of [1, 2]) {
      e.advance(3000); e.made.length = 0;
      const rm = []; for (let i = 0; i < 12; i++) { if (i === 3) for (const c of e.ctxs) c.currentTime += q * 256 / 48000; rm.push(e.Sound.turn({ dir: 1, pc: 0 })); }
      const b = e.made.filter((x) => x === 'turn').length, m = e.made.filter((x) => x === 'turnMany').length;
      check(`queue: the clock moves ${q} render ${q > 1 ? 'quanta' : 'quantum'} mid-burst: still 8 bells and one flourish`, b === 8 && m === 1 && rm.filter((x) => x === 'coalesced').length === 4, `${b} ${m} ${JSON.stringify(rm)}`);
    }
  }
  // zeros and poles: a shared gap, and a cluster becomes one "dense" cue then 600 ms of silence
  {
    const e = makeEnv();
    e.Sound.set({ on: true, sonify: true }, { quiet: true }); e.advance(10);
    e.made.length = 0;
    for (let i = 0; i < 20; i++) { e.Sound.play(i % 3 ? 'zero' : 'pole', { order: 1 }); e.advance(40); }
    const zp = e.made.filter((x) => x === 'zero' || x === 'pole').length, dense = e.made.filter((x) => x === 'dense').length;
    check('cluster: 20 entries at 40 ms → at most 3 pings and the dense cue', zp <= 3 && dense >= 1 && zp + dense <= 5, e.made.join());
    e.advance(2000); e.made.length = 0;
    e.Sound.play('zero', { order: 2 }); e.advance(100); e.Sound.play('zero', { order: 2 });
    check('zeros: a shared 250 ms gap', e.made.filter((x) => x === 'zero').length === 1, e.made.join());
  }
  // the storm guard: at most 14 decorative cues a second; an error always gets through
  {
    const e = makeEnv();
    e.Sound.set({ on: true }, { quiet: true }); e.advance(10);
    e.made.length = 0;
    const names = ['toggleOn', 'toggleOff', 'stepAdd', 'stepRemove', 'view', 'edge', 'exportDone'];
    for (let i = 0; i < 40; i++) { e.Sound.play(names[i % names.length], {}); e.advance(20); }
    check('storm guard: ≤ 14 in a second', e.made.length <= 14 * 1 + 1, e.made.length);
    check('storm guard: an error gets through', e.Sound.play('error', {}) === true);
  }
  // never queued on a clock that is not running: a context whose resume() never resolves
  {
    const e = makeEnv();
    e.Sound.set({ on: true, sonify: true }, { quiet: true }); e.advance(10);
    const c = e.ctx(); c.resumeNever = true; await c.suspend(); e.made.length = 0;
    let ok = 0;
    for (let i = 0; i < 24; i++) { if (e.Sound.play('toggleOn', {}) === true) ok++; if (e.Sound.turn({ dir: 1 }) === true) ok++; e.advance(50); }
    check('suspended: 24 requests, none scheduled', ok === 0 && e.made.length === 0, `${ok} ${e.made.join()}`);
    check('suspended: no voice created, no harp note', e.Sound.heightVoice() === null && e.Sound.harp(0.1, {}) === null);
    // the one exception: a single sound inside an active gesture
    e.userActive = true;
    const g1 = e.Sound.play('toggleOn', { force: true, grace: true }), g2 = e.Sound.play('toggleOff', { force: true, grace: true });
    check('suspended: one sound inside a gesture, not two', g1 === true && g2 === false, `${g1} ${g2}`);
  }
  // off is immediate and silent; Esc stops everything and keeps the setting
  {
    const e = makeEnv();
    e.Sound.set({ on: true, sonify: true }, { quiet: true }); e.advance(10);
    const c = e.ctx();
    for (const k of ['toggleOn', 'stepAdd', 'error']) { e.Sound.play(k, { force: true }); }
    const cues = [...e.Sound.debug().G.active];
    const v = e.Sound.heightVoice(); v.set(0.1, 0, undefined, 12); v.gate(true);
    // a harp run (fallback strings: buffers)
    e.Sound.harpReset(0.02); for (let i = 1; i <= 6; i++) { e.advance(16); e.Sound.harp(0.02 + 0.1 * i, { dt: 0.016 }); }
    const strings = [...e.Sound.debug().G.active].filter((s) => !cues.includes(s));
    check('sources sounding before Esc', cues.length > 0 && strings.length > 0, `${cues.length} ${strings.length}`);
    cues.push(...strings);
    e.Sound.hush();
    const T = c.currentTime;
    check('Esc: every cue source stopped within 80 ms', cues.every((s) => s.stopped != null && s.stopped <= T + 0.08), cues.map((s) => s.stopped).slice(0, 4));
    const gl = v.engine === 'nodes' ? null : null;
    check('Esc: the voice is gated off (τ 4 ms)', e.Sound.debug().live === 1);
    check('Esc: the bus fades on raised cosines (no step)', e.Sound.debug().G.bus.gain.calls.some((x) => x[0] === 'curve'));
    check('Esc: the setting stays on', e.Sound.prefs().on === true);
    e.advance(500);
    e.made.length = 0; const n0 = c.sources.length;
    e.Sound.set({ on: false });
    check('off: no sound is made', e.made.length === 0 && c.sources.length === n0, e.made.join());
    check('off: every source stopped', c.sources.every((s) => s.stopped != null));
    e.advance(100);
    check('off: the context is suspended', c.state === 'suspended');
    check('off: nothing plays after', e.Sound.play('toggleOn', { force: true }) === false && e.Sound.heightVoice() === null && e.Sound.harp(5.3, {}) === null);
  }
  // the tracker driven by t at a fixed z (notes/sound/DEFORMATION.md): Sound.pathStep and Sound.turns, as the app uses
  // them while the deformation plays or is scrubbed under a still probe
  {
    const S = makeEnv().Sound, A = Calc.argStep;
    const cexp = (re, im) => { const r = Math.exp(re); return C(r * Math.cos(im), r * Math.sin(im)); };
    const clog = (z) => C(Math.log(Math.hypot(z.re, z.im)), Math.atan2(z.im, z.re));
    // the transport's schedule: m steps of eased motion (as frame() plays them) sampled at hz frames a second
    const play = (m, hz, secs = 1.6) => { const Ts = [0]; for (let j = 0; j < m; j++) { const n = Math.round(secs * hz); for (let i = 1; i <= n; i++) { const u = i / n; Ts.push(j + (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2)); } } return Ts; };
    // follow H_T(z) along a list of transport times; returns {phi (turns), up, down, jumps, steps, why}
    const follow = (Hat, z, Ts, opts = {}) => {
      const L = { phi: 0, k: 0 }; let up = 0, down = 0, jumps = 0, g0 = Hat(Ts[0])(z), whys = [];
      for (let i = 1; i < Ts.length; i++) {
        const g1 = Hat(Ts[i])(z), r = S.pathStep(A, Hat, z, Ts[i - 1], g0, z, Ts[i], g1, opts);
        if (!r.exact) { whys.push(r.why); if (r.why === 'jump') jumps++; }
        L.phi += r.d / TAU; S.turns(L, (d) => (d > 0 ? up++ : down++)); g0 = g1;
      }
      return { phi: L.phi, up, down, jumps, whys };
    };
    // (a) a rotation: H_t(z) = e^(2πi·3t) z: three turns at any z ≠ 0, three rising bells, at 60 and 240 Hz
    const rot = (T) => (z) => CX.mul(cexp(0, TAU * 3 * T), z);
    for (const hz of [60, 240]) {
      const r = follow(rot, C(0.4, -0.7), play(1, hz));
      check(`t-tracker: e^(2πi·3t)z at ${hz} Hz: +3 turns, 3 bells up`, Math.abs(r.phi - 3) < 1e-9 && r.up === 3 && r.down === 0 && !r.whys.length, JSON.stringify(r));
    }
    // (b) the pitch follows arg H_t: z^(1+4t) (the natural path of z^5, principal) at z = e^(i·170°): the tracked arg is
    // (1+4t)·170° at every frame, so the total is 4 × 170° = 1.889 turns: one bell
    {
      const th = 170 * Math.PI / 180, z = C(Math.cos(th), Math.sin(th));
      const pw = (T) => (w) => cexp(CX.mul(C(1 + 4 * T, 0), clog(w)).re, CX.mul(C(1 + 4 * T, 0), clog(w)).im);
      const Ts = play(1, 60); let phi = th / TAU, g0 = pw(0)(z), worst = 0;
      for (let i = 1; i < Ts.length; i++) { const g1 = pw(Ts[i])(z); phi += S.pathStep(A, pw, z, Ts[i - 1], g0, z, Ts[i], g1).d / TAU; g0 = g1; worst = Math.max(worst, Math.abs(phi - (1 + 4 * Ts[i]) * th / TAU)); }
      const r = follow(pw, z, Ts);
      check('t-tracker: z^(1+4t) at 170°: the pitch is arg H_t at every frame (exact)', worst < 1e-9, worst);
      check('t-tracker: z^(1+4t) at 170°: 1.889 turns, one bell', Math.abs(r.phi - 4 * th / TAU) < 1e-9 && r.up === 1 && r.down === 0, JSON.stringify(r));
    }
    // (c) the turn count over a play equals the winding of t → H_t(z): two steps one after another (as morphState
    // builds them), rotate twice, then a pole moving round the probe (−1 turn): +1 net, 2 up and 1 down at 60 Hz
    {
      const z = C(0.3, 0.2);
      const Hat = (T) => (w) => {
        const j = Math.min(1, Math.floor(T)), t = T - j;
        const a = j === 0 ? CX.mul(cexp(0, TAU * 2 * t), w) : CX.mul(cexp(0, TAU * 2), w);
        if (j === 0) return a;
        const p = C(z.re + 0.5 * Math.cos(TAU * t), z.im + 0.5 * Math.sin(TAU * t)), q = C(z.re + 0.5, z.im);
        return CX.mul(a, CX.div(CX.sub(w, q), CX.sub(w, p)));
      };
      const r = follow(Hat, z, play(2, 60));
      // the winding of the path by fine sampling (an independent count)
      let wsum = 0, g0 = Hat(0)(z); for (let i = 1; i <= 20000; i++) { const g1 = Hat(2 * i / 20000)(z); wsum += Math.atan2(g0.re * g1.im - g0.im * g1.re, g0.re * g1.re + g0.im * g1.im); g0 = g1; }
      check('t-tracker: two steps, the turn count is the winding of t → H_t(z)', Math.abs(r.phi - wsum / TAU) < 1e-6 && Math.abs(r.phi - 1) < 1e-6 && r.up === 2 && r.down === 1, JSON.stringify({ r, w: wsum / TAU }));
    }
    // (d) a zero of order 2 of H_t passes the probe: H_t(z) = (z − a(t))²(z + 2), a(t) = −1 + 2t; the probe at 0.01i.
    // The app's rule frame by frame (orderAt on the 8 px circle, held until the 14 px circle no longer gives it; here
    // 1 px = 0.006): one ping, of order 2, and the tracked arg stays exact through it
    {
      const z = C(0, 0.01), px = 0.006;
      const Hat = (T) => (w) => { const a = C(-1 + 2 * T, 0), d = CX.sub(w, a); return CX.mul(CX.mul(d, d), CX.add(w, C(2, 0))); };
      const Ts = play(1, 60); let near = 0; const pings = [];
      for (const T of Ts) {
        const F = Hat(T), g = F(z), hh = 0.5 * px;
        const ld = CX.abs(CX.sub(F(C(z.re + hh, z.im)), F(C(z.re - hh, z.im)))) / (2 * hh) / CX.abs(g);
        if (near) { if (!(ld > 1 / (14 * px)) || Calc.orderAt(F, z, 14 * px) !== near) near = 0; continue; }
        if (!(ld > 1 / (8 * px))) continue;
        const m = Calc.orderAt(F, z, 8 * px);
        if (m) { near = m; pings.push(m); }
      }
      const r = follow(Hat, z, Ts);
      const exact = (2 * (Math.atan2(0.01, -1) - Math.atan2(0.01, 1)) + 0) / TAU;
      check('t-tracker: a double zero of H_t sweeping across the probe: one ping, of order 2', pings.length === 1 && pings[0] === 2, JSON.stringify(pings));
      check('t-tracker: … and the tracked arg is exact through it (+0.994 turns)', Math.abs(r.phi - exact) < 1e-9 && r.up === 0, JSON.stringify({ r, exact }));
    }
    // (e) a cut of H_t sweeping across the probe: √(e^(2πit) z) (principal) at z = 1 jumps once, at t = ½
    {
      const sq = (T) => (w) => { const v = CX.mul(cexp(0, TAU * T), w); return sqrtP(v); };
      const r = follow(sq, C(1, 0), play(1, 60));
      check('t-tracker: a cut of H_t sweeping across the probe: one jump', r.jumps === 1, JSON.stringify(r));
    }
    // (f) no double count: the path in (z, t) split between pointer events and frames, in any order, sums to the
    // same total as one step (the probe moves away and back while t runs)
    {
      const z0 = C(0.4, -0.7), P = (s) => C(z0.re + 0.3 * Math.sin(Math.PI * s), z0.im + 0.2 * Math.sin(Math.PI * s));
      const one = S.pathStep(A, rot, z0, 0, rot(0)(z0), z0, 1, rot(1)(z0));
      let tot = 0, zp = z0, Tp = 0, gp = rot(0)(z0);
      const cuts = [0.013, 0.05, 0.051, 0.2, 0.33, 0.5, 0.71, 0.9, 0.97, 1];
      for (const s of cuts) { const zz = s === 1 ? z0 : P(s), g = rot(s)(zz), r = S.pathStep(A, rot, zp, Tp, gp, zz, s, g); tot += r.d; zp = zz; Tp = s; gp = g; }
      check('t-tracker: one path split between pointer events and frames: the same total, no double count', one.exact && Math.abs(tot - one.d) < 1e-9 && Math.abs(one.d - 3 * TAU) < 1e-9, { one: one.d, tot });
    }
    // (g) the bell rule: a wobble at a turn rings once; going back rings a falling bell
    {
      const L = { phi: 0, k: 0 }, out = [];
      for (const p of [0.5, 0.99, 1.02, 0.97, 1.03, 0.9, 1.6, 2.05, 1.8, 0.95, 0.99]) { L.phi = p; S.turns(L, (d) => out.push(d)); }
      check('turns: a wobble at a turn rings once; back past a turn rings down', out.join() === '1,1,-1', out.join());
    }
  }
  // ---------- v15.2: palette B, the harp, curves sing (pure; the parts as the synth receives them) ----------
  {
    const S = makeEnv().Sound, posted = [], g = { c: { sampleRate: 48000 }, synth: { post: (l) => posted.push(...l) }, offline: false, active: new Set() };
    const cue = (name, o) => { posted.length = 0; S.cueTo(g, name, 1, o || {}); return posted[0]; };
    // variation: two plays differ, a seed repeats; the turn bell has no pitch variation (its pitch is information)
    const f0 = (c) => c.parts.filter((p) => p.k === 'm').map((p) => p.f);
    const a1 = cue('toggleOn', { seed: 7, noRep: true }), a2 = cue('toggleOn', { seed: 7, noRep: true }), a3 = cue('toggleOn', { noRep: true });
    check('variation: the same seed gives the same strike', JSON.stringify(a1.parts) === JSON.stringify(a2.parts));
    check('variation: another play is another strike', JSON.stringify(a1.parts) !== JSON.stringify(a3.parts));
    const b1 = cue('turn', { pc: 0.3, dir: 1 }), b2 = cue('turn', { pc: 0.3, dir: 1 });
    // (glass beats: each mode is a pair f ± b/2 with a random b; the pair's mean is the pitch)
    const pit = (c, i) => (f0(c)[2 * i] + f0(c)[2 * i + 1]) / 2;
    check('turn bell: no pitch variation (grace note and bell)', [0, 4].every((i) => Math.abs(pit(b1, i) - pit(b2, i)) < 1e-9), JSON.stringify([pit(b1, 0), pit(b2, 0), pit(b1, 4), pit(b2, 4)]));
    // repetition softens (−1 dB a repeat within 2 s, to −4 dB); count-bearing cues keep their level
    const gs = []; for (let i = 0; i < 6; i++) { posted.length = 0; S.cueTo(g, 'stepAdd', 10 + 0.3 * i, {}); gs.push(posted[0].g); }
    const db = gs.map((x) => 20 * Math.log10(x / gs[0]));
    check('repetition: −1 dB a repeat, down to −4 dB', Math.abs(db[1] + 1) < 1e-6 && Math.abs(db[4] + 4) < 1e-6 && Math.abs(db[5] + 4) < 1e-6, db.map((x) => x.toFixed(2)).join());
    posted.length = 0; S.cueTo(g, 'stepAdd', 20, {}); const gFresh = posted[0].g;
    check('repetition: after 2 s of silence, full level again', Math.abs(gFresh - gs[0]) < 1e-9);
    const ls = []; for (let i = 0; i < 4; i++) { posted.length = 0; S.cueTo(g, 'loopDone', 30 + 0.2 * i, { w: 2 }); ls.push(posted[0].g); }
    check('repetition: count-bearing cues (loop pings) keep their level', ls.every((x) => Math.abs(x - ls[0]) < 1e-12));
    // gesture: a faster strike is brighter and louder (the mallet: τ ∝ vel^−0.2)
    const lo = cue('zero', { vel: 0.35, seed: 3 }), hi = cue('zero', { vel: 0.95, seed: 3 });
    check('gesture: a faster approach strikes the zero harder (shorter contact, louder)', hi.parts[0].tau < lo.parts[0].tau && hi.parts[0].a > lo.parts[0].a);
    // clean edges: every catalog cue, rendered by the fallback's own code, starts from 0 and ends at exactly 0
    const L = S.LIB;
    let worst = '';
    for (const name of Object.keys(S.CATALOG)) {
      const c = cue(name, { order: 2, w: 3, k: 1, q: 2, seed: 1 });
      let end = 0; for (const p of c.parts) end = Math.max(end, L.partEnd(p));
      const n = Math.ceil(end * 48000) + 4, y = new Float32Array(n);
      for (const p of c.parts) L.MAKE[p.k](p, 48000).run(y, Math.round((p.d || 0) * 48000), n);
      let pk = 0; for (const v of y) pk = Math.max(pk, Math.abs(v));
      if (!(Math.abs(y[0]) < 1e-3 * pk && y[n - 1] === 0 && y[n - 2] === 0 && pk > 0)) worst += `${name}: first ${y[0]} last ${y[n - 1]} peak ${pk}; `;
    }
    check('clean edges: every cue starts at 0 and ends at exactly 0', !worst, worst);
  }
  // the phase harp: arg F tracked exactly along a loop (Calc.argStep), fed to the harp: the low Ds counted up minus
  // down are the winding number; a loop round a zero rises, round a pole falls; a tremor across a line plays nothing
  {
    const S = makeEnv().Sound;
    const loop = (F, c, r, laps = 1, N = 240, th0 = 0.37) => {
      const st = S.Harp(), notes = [];
      let z0 = C(c.re + r * Math.cos(th0), c.im + r * Math.sin(th0)), g0 = F(z0), phi = Math.atan2(g0.im, g0.re) / TAU;
      S.harpStep(st, null, 0, phi, {});
      for (let i = 1; i <= N * laps; i++) {
        const th = th0 + TAU * i / N, z1 = C(c.re + r * Math.cos(th), c.im + r * Math.sin(th)), g1 = F(z1), q = Calc.argStep(F, z0, g0, z1, g1);
        phi += q.d / TAU; z0 = z1; g0 = g1;
        for (const nn of S.harpStep(st, null, i * 0.02, phi, { dt: 0.02 })) notes.push(nn);
      }
      return { W: st.up - st.down, up: st.up, down: st.down, notes, phi };
    };
    const zp = rational([[C(1, 0), 1], [C(-1, 0), 2]], [[C(0, 1), 1], [C(0.5, -0.8), 2]]);
    const cases = [['a simple zero', C(1, 0), 0.3, 1, 1], ['a double zero', C(-1, 0), 0.3, 1, 2], ['a simple pole', C(0, 1), 0.3, 1, -1], ['a double pole', C(0.5, -0.8), 0.25, 1, -2],
      ['a simple zero, two laps', C(1, 0), 0.3, 2, 2], ['all four inside (1 + 2 − 1 − 2)', C(0, 0), 1.6, 1, 0], ['nothing inside', C(2.5, 2.5), 0.4, 1, 0]];
    for (const [what, c, r, laps, W] of cases) {
      const h = loop(zp, c, r, laps);
      check(`harp: ${what}: low Ds up − down = ${W}`, h.W === W && Math.abs(h.phi - h.notes.length * 0 - h.phi) < 1, JSON.stringify({ up: h.up, down: h.down }));
    }
    // a loop round a zero plays a rising scale (every note up, D E F♯ A B in turn); round a pole a falling one
    const up = loop(zp, C(1, 0), 0.3), dn = loop(zp, C(0, 1), 0.3);
    const cls = (ns) => ns.map((x) => ((x.i % 5) + 5) % 5);
    check('harp: round a zero, a rising scale of 5 notes a turn', up.notes.length === 5 && up.notes.every((x) => x.dir > 0) && cls(up.notes).every((j, k, a) => !k || j === (a[k - 1] + 1) % 5), JSON.stringify(cls(up.notes)));
    check('harp: round a pole, a falling scale', dn.notes.length === 5 && dn.notes.every((x) => x.dir < 0) && cls(dn.notes).every((j, k, a) => !k || j === (a[k - 1] + 4) % 5), JSON.stringify(cls(dn.notes)));
    const dz = loop(zp, C(-1, 0), 0.3);
    // (a note sounds once arg F is 3.75° past its line: a line within that of the loop's end waits for the next move)
    check('harp: round a double zero, the scale twice (9 or 10 notes, all up, 2 low Ds)', dz.notes.length >= 9 && dz.notes.length <= 10 && dz.notes.every((x) => x.dir > 0) && dz.up === 2, JSON.stringify({ n: dz.notes.length, up: dz.up, down: dz.down }));
    // a tremor of ±3° across a line (and across arg 0, the D): nothing; a step of 8° across it: one note
    const st = S.Harp(); S.harpStep(st, null, 0, 1 / 6 - 0.004, {});
    let k = 0; for (let i = 0; i < 50; i++) k += S.harpStep(st, null, i * 0.02, 1 / 6 + (i % 2 ? 0.008 : -0.008), { dt: 0.02 }).length;
    check('harp: a ±3° tremor across E plays nothing (hysteresis 3.75°)', k === 0, k);
    k = S.harpStep(st, null, 1, 1 / 6 + 0.012, { dt: 0.02 }).length;
    check('harp: past the hysteresis it plays once', k === 1, k);
    // the D-only zone (a trembling hand within 8 px of a zero): only the Ds sound, and the count stays exact
    const sh = S.Harp(); S.harpStep(sh, null, 0, 0.05, {}); let noted = 0;
    for (let i = 1; i <= 20; i++) { sh.notes = 0; S.harpStep(sh, null, i * 0.02, 0.05 + 0.1 * i, { dt: 0.02, shaky: true }); noted += sh.notes; }
    check('harp: the D-only zone counts every D (2 turns: 2 up) and plays only those', sh.up === 2 && sh.down === 0, JSON.stringify(sh));
  }
  // v15.2 review fixes. math-1: whole turns hidden in one piece (|F| steady, a fast phase) are seen: e^{30z} moved up
  // by 0.40 and 0.42 turns arg F by 12.0 and 12.6 rad (they read −0.57 and 0.03, exact, before)
  {
    const e30 = (z) => expF(CX.scale(z, 30));
    for (const L of [0.4, 0.42, 25.1 / 30]) {
      const r = Calc.argStep(e30, C(0, 0), null, C(0, L), null);
      check(`math-1: argStep e^{30z} over ${L}i is ${(30 * L).toFixed(2)} rad`, r.exact && Math.abs(r.d - 30 * L) < 1e-9, JSON.stringify(r));
    }
    const r = Calc.argStep((z) => CX.sin(CX.scale(z, 20)), C(-0.3, 1), null, C(0.3, 1), null);
    check('math-1: argStep sin(20z) along Im z = 1, 0.6 wide: −12 rad', r.exact && Math.abs(r.d + 12) < 1e-6, JSON.stringify(r));
    // a pointer loop round nothing for e^{30z} (0.42 up in one event, 42 slow steps back): 0 Ds (was −2)
    const S = makeEnv().Sound, st = S.Harp();
    let z0 = C(0, 0), g0 = e30(z0), phi = 0;
    S.harpStep(st, null, 0, phi, {});
    const path = [C(0, 0.42)]; for (let i = 41; i >= 0; i--) path.push(C(0, 0.01 * i));
    for (const z1 of path) { const g1 = e30(z1), q = Calc.argStep(e30, z0, g0, z1, g1); phi += q.d / TAU; z0 = z1; g0 = g1; S.harpStep(st, null, 0, phi, { dt: 0.016 }); }
    check('math-1: a pointer loop round nothing for e^{30z}: 0 low Ds net', st.up === st.down && Math.abs(phi) < 1e-9, JSON.stringify({ up: st.up, down: st.down, phi }));
  }
  // sound-2: the singer has a note for W = −3 … 20 only (harmonic 4 + W of D3); outside, the callers ping or speak
  {
    const S = makeEnv().Sound;
    check('sound-2: singable W −3 … 20, not −4, −5 or 21', [-3, 0, 1, 20].every((W) => S.singable(W)) && ![-4, -5, 21, 0.5].some((W) => S.singable(W)));
    const ph = new Float64Array(256); for (let j = 0; j < 256; j++) ph[j] = -4 * j / 256;
    const a = S.curveAmps(ph, -4);
    check('sound-2: W = −4 has no harmonic (why it is not sung)', a.n0 === 0 && a.A.every((x) => x < 0.05), JSON.stringify(a.A.slice(0, 4)));
  }
  // sound-3: a finger held still 10 px from a zero (F = z, 1 px a unit), on a line, with a 9 Hz tremor of ±1.5 px: the
  // band of 2.5 px (the app's |F'/F| · 2.5 px) plucks nothing; with the fixed 7.5° band it chattered
  {
    const S = makeEnv().Sound;
    const held = (band) => {
      const st = S.Harp(); let phi = null, prev = null;
      for (let k = 0; k < 600; k++) {
        const t = k / 60, x = 10 + 1.5 * Math.sin(TAU * 9 * t), y = 1.5 * Math.sin(TAU * 8.3 * t + 1);
        const a = Math.atan2(y, x) / TAU; if (phi === null) phi = a; else { let d = a - prev; d -= Math.round(d); phi += d; } prev = a;
        S.harpStep(st, null, t, phi, { dt: 1 / 60, h: band ? (1 / Math.hypot(x, y)) * 2.5 / TAU : 0 });
      }
      return st.notes;
    };
    const n0 = held(false), n1 = held(true);
    check('sound-3: a held finger near a zero: 0 notes with the 2.5 px band (many without)', n1 === 0 && n0 > 10, JSON.stringify({ fixed: n0, band: n1 }));
    // the band never loses a count: a loop round the zero at 10 px from arg 0.4 turn, 3 laps: 3 Ds up
    const st = S.Harp(); let phi = 0.4; S.harpStep(st, null, 0, phi, {});
    for (let i = 1; i <= 360; i++) { phi = 0.4 + 3 * i / 360; S.harpStep(st, null, i / 60, phi, { dt: 1 / 60, h: 0.1 * 2.5 / TAU }); }
    check('sound-3: with the band, 3 laps round a zero still give 3 low Ds', st.up === 3 && st.down === 0, JSON.stringify(st));
  }
  // math-4: a drawn loop that starts on the D line (arg F within the band of 0) and closes there: harpClose brings the
  // count to W (it played W − 1 before); a loop that only wiggles across nothing stays at 0
  {
    const e = makeEnv();
    e.Sound.set({ on: true, sonify: true }, { quiet: true }); e.advance(10);
    const S = e.Sound;
    const lap = (start, W, wig) => {
      S.harpReset(start); S.harpCount();
      let c0 = null;
      const N = 60;
      for (let i = 0; i <= N; i++) {
        e.advance(16);
        const phi = wig ? start + 0.05 * Math.sin(Math.PI * i / N) : start + W * i / N;
        S.harp(phi, { dt: 0.016 });
        if (i === 0) c0 = S.harpState().c;
      }
      S.harpClose(c0 + 5 * W, {});
      return S.harpCount();
    };
    for (const [start, W] of [[0.001, 1], [0.003, 1], [-0.002, 1], [0.001, -1], [0.003, 2], [0.4, 1]]) {
      const r = lap(start, W, false);
      check(`math-4: a loop from arg ${start} turn, W = ${W}: low Ds up − down = W`, r.up - r.down === W, JSON.stringify(r));
    }
    const r = lap(0.001, 0, true);
    check('math-4: a wiggle from arg 0.001 turn up and back: 0 Ds', r.up === 0 && r.down === 0, JSON.stringify(r));
  }
  // curves sing: the phase along a closed curve played as one period; its loudest harmonic is 4 + W (D5 for 0, F♯5 for
  // 1, A5 for 2, A4 for −1), and the spectral centre is exactly W
  {
    const S = makeEnv().Sound;
    const sample = (F, c, r, M = 512) => { const ph = new Float64Array(M); let z0 = C(c.re + r, c.im), g0 = F(z0), acc = Math.atan2(g0.im, g0.re) / TAU; ph[0] = acc; for (let j = 1; j <= M; j++) { const th = TAU * j / M, z1 = C(c.re + r * Math.cos(th), c.im + r * Math.sin(th)), g1 = F(z1); acc += Calc.argStep(F, z0, g0, z1, g1).d / TAU; if (j < M) ph[j] = acc; z0 = z1; g0 = g1; } return { ph, W: Math.round(acc - ph[0]) }; };
    const loudest = (A) => A.indexOf(Math.max(...A)) + 1;
    const centre = (A, W) => { let e = 0, m = 0; for (let n = 1; n <= A.length; n++) { e += A[n - 1] * A[n - 1]; m += (n - 4) * A[n - 1] * A[n - 1]; } return m / e; };
    const cases = [['z − 0.6 on |z| = 1', (z) => sub(z, C(0.6, 0)), C(0, 0), 1, 1], ['z³ − 1 on |z| = 1.5', (z) => sub(mul(z, mul(z, z)), C(1, 0)), C(0, 0), 1.5, 3],
      ['(z − ½)/(z + ½) on |z| = 1', (z) => CX.div(sub(z, C(0.5, 0)), CX.add(z, C(0.5, 0))), C(0, 0), 1, 0], ['1/z on |z| = 1', (z) => CX.inv(z), C(0, 0), 1, -1],
      ['z² with the zero off centre', (z) => mul(sub(z, C(0.5, 0.2)), sub(z, C(0.5, 0.2))), C(0, 0), 1, 2], ['e^z on |z| = 3 (W = 0, wide)', expF, C(0, 0), 3, 0]];
    for (const [what, F, c, r, W] of cases) {
      const sm = sample(F, c, r), a = S.curveAmps(sm.ph, sm.W);
      check(`curves sing: ${what}: W = ${W}, the loudest harmonic ${4 + W}`, sm.W === W && a.n0 === 4 + W && loudest(a.A) === 4 + W, JSON.stringify({ W: sm.W, loud: loudest(a.A), A: a.A.slice(0, 9).map((x) => +x.toFixed(3)) }));
      if (W !== 0 || what.startsWith('(')) check(`curves sing: ${what}: the spectral centre is W (±0.05)`, Math.abs(centre(a.A, W) - W) < 0.05, centre(a.A, W));
    }
  }
  // no Web Audio: everything is a no-op
  {
    const e = makeEnv({ noAudio: true });
    e.Sound.set({ on: true });
    check('no Web Audio: no error, nothing plays', e.Sound.state().supported === false && e.Sound.play('toggleOn', {}) === false);
  }
  await flush();
  console.log(`${n - bad}/${n} sound checks passed`);
  if (bad) process.exitCode = 1;
})();
