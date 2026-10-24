// Sound (notes/sound/DESIGN.md): the pure parts. Calc.argStep and Calc.orderAt (the probe's exact arg steps and the
// order at a point, by the argument principle), winding counts, and the engine's scheduler and its guards (src/sound.js
// run in a sandbox against a mock AudioContext: off by default, consent, the queues, the cluster and storm guards, the
// suspended-context rule, the silent off, Esc). Run: node test/t_sound.js
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
  for (const k in env.Sound.CATALOG) { const d = env.Sound.CATALOG[k], m = d.make; d.make = (G, t, o) => { env.made.push(k); return m(G, t, o); }; }
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
    check('engine: no cue, no context while off', e.Sound.play('toggleOn', { force: true }) === false && e.Sound.voice() === null && e.ctxs.length === 0);
    check('engine: off → no AudioContext at all', e.ctxs.length === 0);
  }
  // a remembered "on" waits for a click or key of this page load
  {
    const e = makeEnv({ search: '', store: { 'cmw-sound': JSON.stringify({ on: true, vol: 0.7, ui: true, snap: false, events: true, sonify: true }) } });
    check('remembered on: no context at load', e.ctxs.length === 0 && e.Sound.prefs().on);
    check('remembered on: a hover schedules nothing', e.Sound.play('toggleOn', {}) === false && e.Sound.voice() === null && e.ctxs.length === 0);
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
    check('default tiers: no voice', e.Sound.voice() === null);
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
    check('suspended: no voice created', e.Sound.voice() === null);
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
    const v = e.Sound.voice(); v.set(0.1, 0, 0); v.gate(true);
    check('sources sounding before Esc', cues.length > 0);
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
    check('off: nothing plays after', e.Sound.play('toggleOn', { force: true }) === false && e.Sound.voice() === null);
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
