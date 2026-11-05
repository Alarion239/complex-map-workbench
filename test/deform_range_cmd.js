// The deformation range on the steps view (notes/deform-range/SPEC.md 13.4): the thread's range as S.homRange, in
// planes lo…hi, and the maps the thread draws inside it, one step at a time and all at once. For chain3 and sin∘√:
// the range's normal form, the map specs at the range's start, middle and end (mode 1 between two planes, mode 3 over a
// run), the end plane's image as the chain's F exactly, GPU against CPU at 64 probes, the state's save and load, and
// the range clearing at a whole chain. A command file for a CDP daemon:  <runner> test/deform_range_cmd.js
const fails = [];
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const MOB = { a: '1', b: '-1', c: '1', d: '1' };
const chain3 = [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: MOB, on: true }, { type: 'pown', params: { n: 2 }, on: true }];
const STRIP = [{ id: 's1', kind: 'formula', expr: '|\\Im z|<\\frac{\\pi}{2}' }, { id: 's2', kind: 'line', a: [0, 0.8], b: [1, 0.8] }, { id: 's3', kind: 'point', p: [0, 0] }];
const NS = 'deformrange' + Date.now();
const probesOf = (n, x0, x1, y0, y1) => { const out = []; let s = 5; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; for (let i = 0; i < n; i++) out.push([x0 + (x1 - x0) * r(), y0 + (y1 - y0) * r()]); return out; };
const near = (u, v, tol) => (u == null && v == null) || (u && v && Math.hypot(u[0] - v[0], u[1] - v[1]) <= tol * (1 + Math.hypot(v[0], v[1])));
const SJ = JSON.stringify;
// the thread's hook: the range as planes and as S.homRange, and the map the thread draws at x
const hook = (o) => ev(`(() => { const s = __cmwSteps(${o ? SJ(o) : ''}); return { on: s.on, planes: s.planes, homRange: s.homRange, range: s.range, x: s.x, all: s.all, homAll: s.homAll, between: s.between, i: s.i }; })()`);
// the map the thread draws at x: GPU (evalMap) against its CPU twin at pts; the worst relative error
const gpuVsCpu = (pts) => ev(`(() => { const m = __cmwSteps().between, g = GLR.evalMap(m, ${SJ(pts)}), c = __cmwEval('cpuMap', m, ${SJ(pts)}); if (!g) return { err: 'no gpu', m }; let worst = 0, n = 0; c.forEach((w, i) => { if (!w) return; const gx = g[2 * i], gy = g[2 * i + 1]; if (!isFinite(gx) || !isFinite(gy)) return; n++; worst = Math.max(worst, Math.hypot(gx - w[0], gy - w[1]) / (1 + Math.hypot(w[0], w[1]))); }); return { worst, n, m }; })()`);
// (opens the state and polls until the steps view is on with the thread's planes: one more than the steps that are on)
const open = async (name, st) => {
  await load(NS + name, Object.assign({ shapes: STRIP, srcView: { cx: 0, cy: 0, s: 52 } }, st));
  const want = st.steps.filter((x) => x.on !== false).length + 1;
  let ready = false;
  for (let i = 0; i < 100 && !ready; i++) {
    ready = await ev(`typeof __cmwSteps === 'function' && typeof GLR !== 'undefined' && GLR.ok && (() => { const s = __cmwSteps(); return s.on && s.planes.length === ${want}; })()`);
    if (!ready) await sleep(100);
  }
  ok(`${name}: the steps view is on with ${want} planes`, ready, await ev("typeof __cmwSteps === 'function' ? __cmwSteps().planes : null"));
};
await view(1440, 900, false);

// ---------------- 1. push-forward: chain3, the range f2–f3 (planes 1…3, S.homRange {2, 3}) ----------------
await open('push', { steps: chain3, pattern: 'checker' });
let h = await hook();
ok('the steps view is on, with planes 0…3', h.on && SJ(h.planes) === '[0,1,2,3]', h);
h = await hook({ range: [1, 3] });
ok('push: the range planes 1…3 are saved as S.homRange {2, 3}', SJ(h.homRange) === '[2,3]' && h.range && h.range.a === 2 && h.range.b === 3 && h.range.lo === 1 && h.range.hi === 3, h);
const pts = probesOf(64, -2, 2, -1.5, 1.5);
// one step at a time: between planes 1 and 2 it is mode 1 into step 2, between 2 and 3 into step 3
h = await hook({ order: 'steps', span: null, x: 1.5 });
ok('push: x 1.5 one at a time is mode 1, hi 2, u ½', h.between.mode === 1 && h.between.hi === 2 && Math.abs(h.between.t - 0.5) < 1e-9 && !('post' in h.between), h.between);
h = await hook({ x: 2.5 });
ok('push: x 2.5 one at a time is mode 1, hi 3', h.between.mode === 1 && h.between.hi === 3, h.between);
for (const x of [1.25, 1.5, 2.5, 2.75]) { await hook({ x }); const g = await gpuVsCpu(pts); ok(`push: GPU = CPU at x ${x}`, g.worst < 2e-4, g); }
// the start is the plane 1's image, the end the chain's F exactly
await hook({ x: 1 });
const Fs = await ev(`__cmwEval('F', null, ${SJ(pts)})`);
let b0 = await ev(`__cmwEval('cpuMap', __cmwSteps().between, ${SJ(pts)})`), s1 = await ev(`__cmwEval('cpuMap', { mode: 0, a: 0, b: 1 }, ${SJ(pts)})`);
ok('push: the range starts at plane 1: the map there is w₁ = e^z', b0.every((w, i) => near(w, s1[i], 1e-12)), b0.slice(0, 2));
const zs = [[-1, 1.5707], [0.5, 1.5707], [1.2, -1.5707], [-0.3, -1.5707]];
const e0 = await ev(`__cmwEval('cpuMap', __cmwSteps().between, ${SJ(zs)})`);
ok('push: at its start the image is e^z', zs.every((z, i) => near(e0[i], [Math.exp(z[0]) * Math.cos(z[1]), Math.exp(z[0]) * Math.sin(z[1])], 1e-12)), e0);
await hook({ x: 3 });
const be = await ev(`__cmwEval('cpuMap', __cmwSteps().between, ${SJ(pts)})`);
ok('push: at the range end the image is F exactly', be.every((w, i) => (w == null && Fs[i] == null) || (w && Fs[i] && w[0] === Fs[i][0] && w[1] === Fs[i][1])), null);
const ge = await gpuVsCpu(pts);
ok('push: GPU = CPU at the end', ge.worst < 2e-4, ge);
// all at once: offered, one map over the planes 1…3 (mode 3, a 1, b 3)
h = await hook({ order: 'all', span: [1, 3], x: 2 });
ok('push: all at once is on and offered', h.all === true && h.homAll === true, { all: h.all, homAll: h.homAll });
ok('push: all at once at its middle is mode 3, a 1, b 3, t ½', h.between.mode === 3 && h.between.a === 1 && h.between.b === 3 && Math.abs(h.between.t - 0.5) < 1e-9, h.between);
for (const x of [1.5, 2, 2.5]) { await hook({ x }); const g = await gpuVsCpu(pts); ok(`push all at once: GPU = CPU at x ${x}`, g.worst < 2e-4, g); }
await hook({ order: 'steps', span: null });

// ---------------- 2. pullback: chain3, the range f1–f2 (planes 0…2, S.homRange {1, 2}) ----------------
await open('pull', { steps: chain3, pattern: 'checker' });
h = await hook({ range: [0, 2] });
ok('pull: the range planes 0…2 are S.homRange {1, 2}', SJ(h.homRange) === '[1,2]' && h.range.lo === 0 && h.range.hi === 2, h);
await hook({ order: 'steps', span: null, x: 0 });
const id0 = await ev(`__cmwEval('cpuMap', __cmwSteps().between, ${SJ(pts)})`);
ok('pull: the range starts at plane 0: the image is z itself', id0.every((w, i) => w && w[0] === pts[i][0] && w[1] === pts[i][1]), id0.slice(0, 2));
for (const x of [0.5, 1, 1.5, 2]) { await hook({ x }); const g = await gpuVsCpu(pts); ok(`pull: GPU = CPU at x ${x}`, g.worst < 2e-4, g); }
// Phase: the colour plane (the last plane) in the range's run
await hook({ go: 3, now: true });
const ph = await hook({ x: 2.5 });
const gp = await gpuVsCpu(probesOf(16, -2, 2, -1.5, 1.5));
ok('pull: between planes 2 and 3 (past the range), GPU = CPU at 16 probes', gp.worst < 2e-4, gp);
await hook({ range: null, go: 0, now: true });

// ---------------- 3. sin(√z): the range over each step, both cuts of the root ----------------
for (const cut of [180, -90]) {
  await open('sin' + cut, { shapes: [{ id: 's1', kind: 'rect', a: [0, -2], b: [40, 2] }], steps: [{ type: 'root', params: { n: 2, cut }, on: true }, { type: 'sin', params: {}, on: true }], pattern: 'checker', dc: 'enhanced', srcView: { cx: 20, cy: 0, s: 30 } });
  for (const [lo, hi, a, b] of [[0, 1, 1, 1], [1, 2, 2, 2]]) {
    h = await hook({ range: [lo, hi], order: 'steps', span: null });
    ok(`sin√ cut ${cut}: range planes ${lo}…${hi} is S.homRange {${a}, ${b}}`, SJ(h.homRange) === `[${a},${b}]`, h.homRange);
    await hook({ x: lo + 0.5 });
    const g = await gpuVsCpu(probesOf(32, 0.2, 30, -2, 2));
    ok(`sin√ cut ${cut}: range ${lo}…${hi} at x ${lo + 0.5}: GPU = CPU (32 probes)`, g.worst < 2e-4 && g.n > 8, g);
  }
  await hook({ range: null });
}

// ---------------- 4. saving, loading, clearing ----------------
await open('save', { steps: chain3.concat([{ type: 'sin', params: {}, on: true }]), homRange: { a: 2, b: 3 } });
h = await hook();
ok('a saved range loads by its indices: S.homRange {2, 3}, planes 1…3', SJ(h.homRange) === '[2,3]' && h.range && h.range.lo === 1 && h.range.hi === 3, h);
let saved = null;
for (let i = 0; i < 20 && !saved; i++) { await sleep(150); saved = await ev(`(() => { try { const s = JSON.parse(localStorage.getItem('complex-map-workbench-v1:${NS}save') || '{}'); return s.homRange || null; } catch (e) { return String(e); } })()`); }
ok('the saved state carries {a, b}', saved && saved.a === 2 && saved.b === 3, saved);
h = await hook({ range: [0, 4] });
ok('a range over every plane is no range', h.homRange === null && h.range === null, h);
h = await hook({ range: [1, 2] });
ok('range planes 1…2 is S.homRange {2, 2}', SJ(h.homRange) === '[2,2]', h);
h = await hook({ range: null });
ok('range: null clears it', h.homRange === null && h.range === null, h);
await open('idx', { steps: chain3, homRange: { a: 2, b: 2 } });
h = await hook();
ok('a state without ua/ub loads by index', SJ(h.homRange) === '[2,2]' && h.range.lo === 1 && h.range.hi === 2, h);
// a step that is off ends the range's span in the thread: the planes are those of the steps that are on
await open('off', { steps: [chain3[0], Object.assign({}, chain3[1], { on: false }), chain3[2]], homRange: { a: 3, b: 3 } });
h = await hook();
ok('with f₂ off: the thread has planes 0, 1, 3 and S.homRange {3, 3} is the last of them', SJ(h.planes) === '[0,1,3]' && h.range && h.range.hi === 2 && h.range.lo === 1, h);

const exc = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''));
ok('no console errors or exceptions', exc.length === 0, exc.slice(0, 6));
return { pass: fails.length === 0, nfails: fails.length, fails: fails.slice(0, 30) };
