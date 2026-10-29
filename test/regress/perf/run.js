#!/usr/bin/env node
'use strict';
// Performance regression suite for the Complex Map Workbench.
//
//   node test/regress/perf/run.js [--out FILE] [--reps N] [--only REGEX] [--skip REGEX] [--base URL] [--quick] [--swiftshader] [--list]
//     [--settle-timeout MS] [--phone-cpu N] [--load-max L] [--load-wait S] [--unit-timeout S]
//
// Drives its own headless Chrome (real WebGL2 through ANGLE Metal) over CDP, opens dist/test.html with saved
// states (test/regress/perf/scenes.js), performs real CDP mouse drags / wheel steps / hovers, and reads timings that
// the in-page instrumentation (inject.js) collects: main-thread time per animation frame, GPU-synchronised frame time
// (1-px readPixels at the end of every frame that drew), rAF intervals, listener time per input event, WebGL memory,
// the LED "up to date" signal and the last rendering activity (settle detection).
// Writes one JSON file (default test/regress/perf/results/latest.json) with flat metrics {value, unit, kind, reps}.
// Compare it with the baseline using: python3 test/regress/compare.py  (see test/regress/README.md).
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const { launch, sleep } = require('./cdp');
const { SCENES, sceneState, MESH_SHAPES, mobiusHalfplanePole } = require('./scenes');

const HERE = __dirname;
const ROOT = path.resolve(HERE, '..', '..', '..');
const DIST = path.join(ROOT, 'dist');

// ---------------- options ----------------
const argv = process.argv.slice(2);
const opt = (name, def) => { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : def; };
const flag = (name) => argv.includes('--' + name);
const QUICK = flag('quick');
// opt-in units (a separate runner: swiftshader.ratio drives its own CPU-rendered browser for ~1.5 min) run only with
// --swiftshader or when --only names them; a full run without them records them in meta.optInSkipped, and
// compare_perf.py reports their baseline metrics as SKIP instead of missing
const WITH_OPT_IN = flag('swiftshader');
const REPS = Math.max(1, parseInt(opt('reps', QUICK ? '2' : '3'), 10));
// --quick (~3 min): the units the sphere-meshing work can move (unbounded regions, zoom/pan settle, the Max mesh,
// the region sphere, example loads, a per-frame map change, hover), plus the costliest per-pixel inverse case of
// SPEC 12.5 (z^i of H at dpr 2), 2 reps. The full suite runs at phase gates.
const QUICK_UNITS = new Set(['mesh', 'image.default.m240', 'image.logUHP.m240', 'image.logUHP.m1920', 'image.chain4.m240', 'sphere.logUHP', 'examples', 'scrub', 'scrub.morph', 'morph.open', 'hover.default', 'image.ziH.m240.dpr2']);
// Timings are only comparable on a quiet machine: before every unit the runner waits (up to LOAD_WAIT_S) for the
// 1-minute load average to drop under LOAD_MAX, and records the units that started busy (meta.busyUnits). With
// --require-quiet (baseline recording) a busy machine aborts the run instead. A unit is cut off after UNIT_TIMEOUT_S
// (the browser is relaunched), so a stalled machine cannot hold the suite for 25 minutes.
const LOAD_MAX = Number(opt('load-max', String(Math.max(4, os.cpus().length * 0.45))));
const LOAD_WAIT_S = Number(opt('load-wait', '90'));
const REQUIRE_QUIET = flag('require-quiet');
const UNIT_TIMEOUT_S = Number(opt('unit-timeout', '180'));
// --ab DIR: a PAIRED run. DIR is the dist/ of the reference app (run.sh --paired builds it from a source snapshot);
// every unit runs on the reference and on the current app back to back in the same browser, alternating which goes
// first, so both see the same machine state (a busy machine slows both alike instead of failing the comparison).
// Which side goes first is fixed per unit (by its id: a re-run of some units keeps each unit's order); --ab-flip
// swaps it, so a confirmation re-run can cancel what going first or second costs on a machine.
// The reference results go to --ab-out (default: OUT with -base before .json); compare OUT against them.
const AB_DIST = opt('ab', '') ? path.resolve(opt('ab')) : null;
const AB_FLIP = flag('ab-flip');
const refFirst = (id) => ([...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 2 === 0) !== AB_FLIP;
const abOut = () => path.resolve(opt('ab-out', OUT.replace(/\.json$/, '') + '-base.json'));
const OUT = path.resolve(opt('out', path.join(HERE, 'results', 'latest.json')));
const ONLY = opt('only', '') ? new RegExp(opt('only')) : null;
const SKIP = opt('skip', '') ? new RegExp(opt('skip')) : null;
let BASE = opt('base', 'http://localhost:8793/');
if (!BASE.endsWith('/')) BASE += '/';
const QUIET_MS = 600;       // settled = no draw and no LED change for this long, no LED busy, no program pending
const SETTLE_TIMEOUT = Number(opt('settle-timeout', '20000'));   // (CI on software rendering: longer, ci/perf_shard.js)
const MESHES = [240, 480, 1920];
const VIEW_W = 1440, VIEW_H = 900;

const log = (...a) => console.error('[perf]', ...a);

// ---------------- statistics ----------------
const sorted = (a) => a.slice().sort((x, y) => x - y);
function quant(a, p) {
  if (!a.length) return NaN;
  const s = sorted(a);
  const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
}
const median = (a) => quant(a, 0.5);
const r3 = (x) => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : x);

// ---------------- results ----------------
let RES = { meta: {}, metrics: {}, details: {}, errors: [] };
// kind decides the tolerance in compare_perf.py: frame_ms, cpu_ms, latency_ms, jank_ms, settle_ms, oneshot_ms, throughput, mem_bytes,
// quality_err, quality_min, coverage, check, info
let CURRENT_UNIT = null; // the unit whose scenarios are running (stored on every metric: run.sh re-runs failing units)
function put(name, kind, unit, reps, extra) {
  const vals = reps.filter((v) => v !== null && v !== undefined && !(typeof v === 'number' && Number.isNaN(v)));
  let value;
  if (kind === 'check') value = vals.length ? vals.every(Boolean) : false;
  else value = vals.length ? r3(median(vals)) : null;
  RES.metrics[name] = Object.assign({ value, unit, kind, reps: reps.map((v) => (typeof v === 'number' ? r3(v) : v)), unit_id: CURRENT_UNIT }, extra || {});
}
const detail = (k, v) => { RES.details[k] = v; };

// ---------------- page helpers ----------------
let B = null;           // the browser (cdp.launch)
let nsCounter = 0;

async function status() { return B.ev('__perf.status()'); }
// wait until the app is idle: LEDs not busy, no program compile pending (GLR.frameStatus().pending: the app draws a
// stand-in or nothing while a program compiles, and the LEDs do not show compiles), no draw / LED change for
// QUIET_MS. Returns {t (page time of the last activity), timeout}
// since: page time the wait starts from (the end of an input); activity before it does not count, and the quiet
// window is measured from max(since, last activity), so a frame that has not run yet cannot be missed.
async function settle(since = 0, quiet = QUIET_MS, timeout = SETTLE_TIMEOUT) {
  const t0 = Date.now();
  for (;;) {
    const s = await status();
    const last = Math.max(s.lastActT, since);
    if (s.ledL !== 'busy' && s.ledR !== 'busy' && !s.pending && s.now - last >= quiet) return { t: last, now: s.now, timeout: false };
    if (Date.now() - t0 > timeout) return { t: s.now, now: s.now, timeout: true };
    await sleep(80);
  }
}
// the longest main-thread stall in [a, b]: the longest frame (main thread + GPU sync) or long task (>= 50 ms)
async function jankIn(a, b) {
  const fr = await B.ev(`__perf.framesSince(${a}, ${b})`);
  const lt = await B.ev(`__perf.longSince(${a}, ${b})`);
  return Math.max(0, ...fr.map((f) => f[1] + f[2]), ...lt.map((t) => t[1]));
}
async function pageNow() { return B.ev('performance.now()'); }

// open the app with a saved state (written by an init script before the app's scripts run)
async function openApp(state) {
  const ns = `perf${process.pid}_${++nsCounter}`;
  const key = `complex-map-workbench-v1:${ns}`;
  // (v15: the app's chain is 188 px; the scenes keep the v14 pane geometry, a 272 px chain, through the test hook)
  const id = await B.addInit(`window.__cmwChainH = 272; if (location.pathname.endsWith('/test.html') && new URLSearchParams(location.search).get('ns') === ${JSON.stringify(ns)}) { try { localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(JSON.stringify(state))}); } catch (e) {} }`);
  const t0 = Date.now();
  await B.nav(`${BASE}test.html?ns=${ns}`);
  await B.removeInit(id);
  await B.until('typeof __cmwInfo === "function" && typeof __perf === "object" && __perf.draws > 0', 20000);
  // MathJax typesets the cards when it arrives: wait for it (bounded), so it does not land inside a measurement
  const mj = await B.until('(window.MathJax && MathJax.tex2svg && MathJax.startup && MathJax.startup.document) ? "yes" : (performance.now() > 12000 ? "no" : "")', 15000).catch(() => 'no');
  const s = await settle(await pageNow());
  const st = await B.ev('__cmwState()');
  const exc = B.logs().filter((l) => l.t === 'EXC');
  if (exc.length) RES.errors.push({ where: 'open ' + ns, exc: exc.slice(0, 3) });
  const health = Object.assign({ exc: exc.map((l) => String(l.m).slice(0, 160)), settled: !s.timeout }, await sceneHealth());
  if (OPENED) OPENED.push(health);
  return { ns, loadMs: Date.now() - t0, mathjax: mj, settled: !s.timeout, state: st, health };
}
// [#292] what a scene built and drew once it settled: the steps' errors (one per step, '' for none) and the shapes that
// have geometry (a mesh or lines). A paired run compares the two sides' (refCannot): a reference that fails where the
// current build succeeds lacks the feature the unit measures (a formula its parser cannot read draws nothing)
let OPENED = null;   // the scenes the running unit opened on the running side
async function sceneHealth() {
  return B.ev(`(() => {
    try {
      const p = typeof __cmwP === 'function' ? __cmwP() : null;
      const info = typeof __cmwInfo === 'function' ? __cmwInfo() : [];
      return { stepErrors: p && Array.isArray(p.errors) ? p.errors.map((e) => (e ? String(e).slice(0, 160) : '')) : [], drawn: info.filter((q) => (q.tris || 0) + (q.segs || 0) > 0).map((q) => q.id) };
    } catch (e) { return { stepErrors: [], drawn: [], hookError: String(e) }; }
  })()`).catch((e) => ({ stepErrors: [], drawn: [], hookError: String(e) }));
}
// why the reference cannot run a unit that the current build runs, or null: per scene opened (in order), a step that
// errs only on the reference, a shape that draws only on the current build (both settled: a mesh still being built is
// not a shape that cannot draw), or an exception only the reference threw; or the unit itself failed only on the
// reference
function refCannot(ref, cur, refErr, curErr) {
  if (refErr && !curErr) return `the unit failed on the reference: ${String(refErr).split('\n')[0].slice(0, 160)}`;
  for (let i = 0; i < Math.min(ref.length, cur.length); i++) {
    const a = ref[i], b = cur[i];
    const k = a.stepErrors.findIndex((e, j) => e && !b.stepErrors[j]);
    if (k >= 0) return `step f${k + 1} does not build there: ${a.stepErrors[k]}`;
    const gone = a.settled && b.settled ? b.drawn.filter((id) => !a.drawn.includes(id)) : [];
    if (gone.length) return `shape ${gone.join(', ')} draws nothing there`;
    if (a.exc.length && !b.exc.length) return `the scene throws there: ${a.exc[0]}`;
  }
  return null;
}

async function paneRect(side) {
  return B.ev(`(() => { const e = document.getElementById(${JSON.stringify(side === 'L' ? 'overlayL' : 'overlayR')}); const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; })()`);
}
async function paneShot(side) {
  const r = await paneRect(side);
  const buf = await B.shot({ x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.w), height: Math.round(r.h) });
  return crypto.createHash('sha1').update(buf).digest('hex');
}

// measurements of one interaction window [a, b] (page times) followed by a settle
async function windowStats(a, b) {
  const fr = await B.ev(`__perf.framesSince(${a}, ${b + 20})`); // [t0, cpu, gpu, draws, n, ts, t1]
  const ev = await B.ev(`__perf.evtsSince(${a}, ${b + 20})`);   // [type, timeStamp, ms]
  // every animation frame that ran app callbacks (planes redrawn with WebGL, or overlays only, e.g. while hovering)
  const drawn = fr.filter((f) => f[4] > 0);
  const frame = drawn.map((f) => f[1] + f[2]);
  const cpu = drawn.map((f) => f[1]);
  const ints = [];
  for (let i = 1; i < drawn.length; i++) ints.push(drawn[i][5] - drawn[i - 1][5]);
  // per dispatched event: the sum over its listeners
  const per = new Map();
  for (const [type, ts, ms] of ev) { const k = type + '|' + ts; per.set(k, { type, ts, ms: (per.has(k) ? per.get(k).ms : 0) + ms }); }
  const events = [...per.values()];
  // input-to-frame latency: from each input event's timestamp to the end of the first frame that drew after it
  const lat = [];
  for (const e of events) {
    if (!/^(pointermove|wheel)$/.test(e.type)) continue;
    const f = drawn.find((d) => d[0] >= e.ts);
    if (f) lat.push(f[6] - e.ts);
  }
  return { drawn, frame, cpu, ints, events, lat, dur: Math.max(1, b - a) };
}

// ---------------- interactions ----------------
// one leg of a drag on a pane (pixels relative to the pane centre)
// space: Space is held through the drag (outside the timed window). From P3b on, a left drag on an editable globe draws
// or moves the shape under it; with Space held it turns the globe in every tool and on every point, and a build before
// P3b ignores Space and turns it too, so a globe orbit leg measures the same orbit on both builds of a paired run.
async function dragLeg(side, dx, dy, button, n = 40, dt = 16, space = false) {
  const r = await paneRect(side);
  const x0 = r.cx - dx / 2, y0 = r.cy - dy / 2;
  if (space) await B.key('keyDown');
  const a = await pageNow();
  await B.drag(x0, y0, x0 + dx, y0 + dy, { n, dt, button });
  const b = await pageNow();
  if (space) await B.key('keyUp');
  const w = await windowStats(a, b);
  const s = await settle(b);
  return Object.assign(w, { settle: s.timeout ? null : Math.max(0, s.t - b), settleTimeout: s.timeout, jank: await jankIn(b + 1, s.now), a, b });
}
// a wheel gesture: `steps` wheel events of deltaY 50 (x1.083 zoom each) every `gap` ms at a point near the centre.
// delta: the deltaY sent over CDP (with a device scale factor of 2 the page receives half of it, so dpr-2 units send
// 50 x dpr to zoom by the same factor)
async function wheelLeg(side, steps, dir, gap = 16, delta = 50) {
  const r = await paneRect(side);
  await B.move(r.cx + 13, r.cy - 11);
  const a = await pageNow();
  // dispatched without waiting for each acknowledgement (a wheel ACK takes about two frames), like a trackpad
  // or a free-spinning wheel delivering an event every 16 ms
  const sent = [];
  const t0 = Date.now();
  for (let i = 0; i < steps; i++) {
    sent.push(B.wheel(r.cx + 13, r.cy - 11, dir * delta));
    const left = t0 + (i + 1) * gap - Date.now();
    if (left > 0) await sleep(left);
  }
  await Promise.all(sent);
  await sleep(20);
  const b = await pageNow();
  const w = await windowStats(a, b);
  const s = await settle(b);
  return Object.assign(w, { settle: s.timeout ? null : Math.max(0, s.t - b), settleTimeout: s.timeout, jank: await jankIn(b + 1, s.now), a, b });
}

// per-rep summary of one or more legs
function legSummary(legs, inputType) {
  const frame = legs.flatMap((l) => l.frame), cpu = legs.flatMap((l) => l.cpu), ints = legs.flatMap((l) => l.ints);
  const lat = legs.flatMap((l) => l.lat);
  const nDrawn = legs.reduce((s, l) => s + l.drawn.length, 0), dur = legs.reduce((s, l) => s + l.dur, 0);
  const inp = legs.flatMap((l) => l.events.filter((e) => e.type === inputType).map((e) => e.ms));
  const settles = legs.map((l) => l.settle);
  const pool = { frame, cpu, lat, inp };
  return {
    pool, jank: Math.max(...legs.map((l) => l.jank || 0)),
    frame_p50: quant(frame, 0.5), frame_p95: quant(frame, 0.95), cpu_p50: quant(cpu, 0.5), cpu_p95: quant(cpu, 0.95),
    raf_p50: quant(ints, 0.5), raf_p95: quant(ints, 0.95), fps: nDrawn / (dur / 1000), frames: nDrawn,
    lat_p50: quant(lat, 0.5), lat_p95: quant(lat, 0.95), input_p50: quant(inp, 0.5), input_p95: quant(inp, 0.95), inputs: inp.length,
    settle: settles.some((s) => s === null) ? null : settles.reduce((s, x) => s + x, 0) / settles.length,
    settleTimeout: legs.some((l) => l.settleTimeout),
  };
}
// budget: an absolute settle budget (ms) for interactions where the current code does no refinement at all (the
// right plane), so a coming refinement may take as long as the left plane's refinement already does
// Percentiles are taken over the frames / events pooled from all reps (more stable than a median of per-rep
// percentiles: 240 frames instead of 3 x 80); the per-rep values are kept in reps.
function pooled(reps, key, p) { return quant(reps.flatMap((r) => r.pool[key]), p); }
function putPooled(name, kind, unit, reps, key, p, perRep, extra) {
  put(name, kind, unit, reps.map((r) => r[perRep]), extra);
  const v = pooled(reps, key, p);
  RES.metrics[name].value = Number.isFinite(v) ? r3(v) : null;
}
function putInteraction(prefix, reps, { input = 'pointermove', budget = null } = {}) {
  const col = (k) => reps.map((r) => r[k]);
  putPooled(`${prefix}.frame_p50_ms`, 'frame_ms', 'ms', reps, 'frame', 0.5, 'frame_p50');
  putPooled(`${prefix}.frame_p95_ms`, 'frame_ms', 'ms', reps, 'frame', 0.95, 'frame_p95');
  putPooled(`${prefix}.cpu_p95_ms`, 'frame_ms', 'ms', reps, 'cpu', 0.95, 'cpu_p95');
  // throughput: frames per second while dragging / zooming (an input event every 16 ms)
  put(`${prefix}.fps`, 'throughput', 'frames/s', col('fps'));
  putPooled(`${prefix}.latency_p95_ms`, 'latency_ms', 'ms', reps, 'lat', 0.95, 'lat_p95');
  put(`${prefix}.raf_p95_ms`, 'info', 'ms', col('raf_p95'));
  putPooled(`${prefix}.input_p95_ms`, 'cpu_ms', 'ms', reps, 'inp', 0.95, 'input_p95', { input });
  // the longest stall between the end of the input and the settled view (remesh / fix-up frames, long tasks)
  put(`${prefix}.settle_jank_ms`, 'jank_ms', 'ms', col('jank'));
  put(`${prefix}.settle_ms`, 'settle_ms', 'ms', col('settle'), budget != null ? { budget_ms: r3(budget) } : undefined);
  put(`${prefix}.settled`, 'check', '', reps.map((r) => !r.settleTimeout));
}

// the left plane's refinement time (as measured in this run, with the settle tolerance applied) is the yardstick for
// the right plane, which the current code never refines
function settleBudget(leftMetric) {
  const m = RES.metrics[leftMetric];
  return m && Number.isFinite(m.value) ? 1.25 * m.value + 50 : null;
}

// GPU memory + geometry of the current scene, and the cost of a full static redraw of both planes
async function sceneStatics(prefix) {
  const mem = await B.ev('__perf.mem()');
  const info = await B.ev('__cmwInfo()');
  const sum = (k) => info.reduce((s, r) => s + (r[k] || 0), 0);
  put(`${prefix}.gpu_live_bytes`, 'mem_bytes', 'B', [mem.live]);
  put(`${prefix}.gpu_peak_bytes`, 'mem_bytes', 'B', [mem.peak]);
  put(`${prefix}.tris`, 'info', '', [sum('tris')]);
  put(`${prefix}.fix_tris`, 'info', '', [sum('fixR') + sum('fixL')]);
  put(`${prefix}.segs`, 'info', '', [sum('segs')]);
  detail(`${prefix}.cmwInfo`, info);
  detail(`${prefix}.mem`, mem);
  // static redraw: re-render both planes N times (no state change), GPU-synchronised
  // (the first redraw after a settle is always slower, GPU clocks ramping up: it is dropped)
  const fr = [];
  for (let i = 0; i < (QUICK ? 5 : 13); i++) {
    const a = await pageNow();
    await B.ev(`__cmwSet('__perfNoop', ${i}); 1`);
    let got = null;
    for (let k = 0; k < 40 && !got; k++) {
      await sleep(20);
      const f = await B.ev(`__perf.framesSince(${a}).filter((f) => f[3] > 0)`);
      if (f.length) got = f[0];
    }
    if (got && i > 0) fr.push(got[1] + got[2]);
  }
  put(`${prefix}.redraw_ms`, 'frame_ms', 'ms', [median(fr)], { samples: fr.map(r3) });
  await settle(await pageNow());
}

// ---------------- units ----------------
// A unit is one page load with its scenarios; --only / --skip select units by id (see --list).
const UNITS = [];
const unit = (id, desc, fn, extra) => UNITS.push(Object.assign({ id, desc, fn }, extra || {}));

// page code that presses the deformation's Play / Pause button when the app's playing state is not `play` (opening the
// deformation starts it playing; the button's name is in its aria-label)
const morphPlayIf = (play) => `{ const p = document.getElementById('morphPlay'); if (p && !!__cmwState().morph.playing !== ${play}) p.click(); }`;
const zoomScale = (side) => B.ev(`(() => { const a = __cmwW2S('${side}', 0, 0), b = __cmwW2S('${side}', 1, 0); return b[0] - a[0]; })()`);

// Image mode: static cost and memory, remesh through the app, pan both planes; at mesh 240 also wheel zoom.
async function imageUnit(scene, meshN) {
  const pre = `image.${scene}.m${meshN}`;
  const o = await openApp(sceneState(scene, { rightMode: 'image', meshN }));
  detail(`${pre}.open`, o);
  await sceneStatics(pre);
  // remesh through the app: __cmwSet('meshN') drops every GPU mesh; the next frame rebuilds them, then fix-ups run
  // (one-shot work: the minimum over the reps is the robust estimate of its cost, noise only adds)
  const rm = [];
  for (let i = 0; i < Math.max(REPS, QUICK ? 3 : 5); i++) {
    const a = await pageNow();
    await B.ev(`__cmwSet('meshN', ${meshN}); 1`);
    const s = await settle(a);
    const f = (await B.ev(`__perf.framesSince(${a}).filter((f) => f[3] > 0)`))[0];
    rm.push({ frame: f ? f[1] + f[2] : null, cpu: f ? f[1] : null, settle: s.timeout ? null : s.t - a, to: s.timeout });
  }
  const mn = (k) => { const v = rm.map((r) => r[k]).filter(Number.isFinite); return v.length ? Math.min(...v) : null; };
  put(`${pre}.remesh.cpu_ms`, 'info', 'ms', rm.map((r) => r.cpu), { stat: 'min' }); // JIT warm-up makes it too noisy to gate
  RES.metrics[`${pre}.remesh.cpu_ms`].value = r3(mn('cpu'));
  put(`${pre}.remesh.frame_ms`, 'oneshot_ms', 'ms', rm.map((r) => r.frame), { stat: 'min' });
  RES.metrics[`${pre}.remesh.frame_ms`].value = r3(mn('frame'));
  put(`${pre}.remesh.settle_ms`, 'settle_ms', 'ms', rm.map((r) => r.settle));
  put(`${pre}.remesh.settled`, 'check', '', rm.map((r) => !r.to));
  for (const side of ['L', 'R']) await panSide(pre, side, side === 'R' ? settleBudget(`${pre}.panL.settle_ms`) : null);
  if (meshN === 240) {
    for (const side of ['L', 'R']) {
      await zoomSide(pre, side, side === 'R' ? settleBudget(`${pre}.zoomL.in.settle_ms`) : null, side === 'R' ? settleBudget(`${pre}.zoomL.out.settle_ms`) : null);
    }
  }
  await sceneEnd(pre);
}
// a middle-button pan of one plane, there and back, REPS times: `${pre}.pan${side}.*`
async function panSide(pre, side, budget) {
  const id = `${pre}.pan${side}`;
  const reps = [];
  let moved = true;
  for (let i = 0; i < REPS; i++) {
    const w0 = await B.ev(`__cmwW2S('${side}', 0, 0)`);
    const leg1 = await dragLeg(side, 160, 70, 'middle');
    const w1 = await B.ev(`__cmwW2S('${side}', 0, 0)`);
    const leg2 = await dragLeg(side, -160, -70, 'middle');
    const w2 = await B.ev(`__cmwW2S('${side}', 0, 0)`);
    // the plane followed the pointer there and back
    const ok = Math.abs(w1[0] - w0[0] - 160) < 3 && Math.abs(w1[1] - w0[1] - 70) < 3 && Math.abs(w2[0] - w0[0]) < 3 && Math.abs(w2[1] - w0[1]) < 3;
    if (!ok) detail(`${id}.moved_fail_${i}`, { w0, w1, w2 });
    moved = moved && ok;
    reps.push(legSummary([leg1, leg2], 'pointermove'));
  }
  putInteraction(id, reps, { budget });
  put(`${id}.view_moved`, 'check', '', [moved]);
  return reps;
}
// a wheel zoom in (x6.8) and back out on one plane, REPS times: `${pre}.zoom${side}.{in,out}.*`
async function zoomSide(pre, side, budgetIn, budgetOut, delta = 50) {
  const id = `${pre}.zoom${side}`;
  const zin = [], zout = [];
  let ok = true;
  for (let i = 0; i < REPS; i++) {
    const s0 = await zoomScale(side);
    const l1 = await wheelLeg(side, 24, -1, 16, delta);
    const s1 = await zoomScale(side);
    const l2 = await wheelLeg(side, 24, +1, 16, delta);
    const s2 = await zoomScale(side);
    const good = s1 / s0 > 4 && Math.abs(s2 / s0 - 1) < 0.02;
    if (!good) detail(`${id}.zoom_fail_${i}`, { s0, s1, s2 });
    ok = ok && good;
    zin.push(legSummary([l1], 'wheel'));
    zout.push(legSummary([l2], 'wheel'));
  }
  putInteraction(`${id}.in`, zin, { input: 'wheel', budget: budgetIn });
  putInteraction(`${id}.out`, zout, { input: 'wheel', budget: budgetOut });
  put(`${id}.view_zoomed`, 'check', '', [ok]);
}
// memory after the interactions, and the app's own synchronous render timer (last: its getImageData readbacks may
// slow the 2D canvases of this page afterwards)
async function sceneEnd(pre) {
  const mem = await B.ev('__perf.mem()');
  put(`${pre}.gpu_live_end_bytes`, 'mem_bytes', 'B', [mem.live]);
  put(`${pre}.gpu_peak_end_bytes`, 'mem_bytes', 'B', [mem.peak]);
  const tm = await B.ev('__cmwTime(3)');
  put(`${pre}.cmwTime_left_ms`, 'info', 'ms', [tm.left]);
  put(`${pre}.cmwTime_right_ms`, 'info', 'ms', [tm.right]);
}

// a screenshot hash of a pane with the pointer outside both panes and the view settled: hovering a pane changes it by
// itself (hover markers, the Sphere view's highlight), so a shot taken with the pointer still inside after a drag
// would differ even if the drag had not moved the view
async function shotAtRest(side) {
  await B.move(5, 5);
  await settle(await pageNow());
  return paneShot(side);
}
// Phase: pan both planes; Landscape and Sphere: orbit the pane that shows the view (left-button drag). view_moved
// compares shots of the dragged pane at rest before and after the first leg.
// Layout-aware (U-b, notes/ui-design/panels.md 10): the reference build (the old layout) shows the Phase, Landscape
// and phase-sphere views in pane R; the current build shows them in pane L (X) and the images in pane R (Y). The page
// says which pane shows the view (__cmwPaneOf; a build without it is the old layout: R), and the unit drags that pane,
// so the paired gate compares like with like. The metric ids keep the old layout's names: `.panR` / `.orbit` is the
// pane of the view itself on both builds, `.panL` the other pane.
async function modeUnit(pre, scene, mode, kind) {
  const st = sceneState(scene, { rightMode: mode, meshN: 240 });
  const o = await openApp(st);
  detail(`${pre}.open`, o);
  // (with the scene's sphereMode: an old Sphere > Phase scene is the X globe, pane L)
  const viewSide = await B.ev(`typeof __cmwPaneOf === 'function' ? __cmwPaneOf(${JSON.stringify(mode)}, ${JSON.stringify(st.sphereMode || 'image')}) : 'R'`);
  detail(`${pre}.viewPane`, viewSide);
  // Merged views (notes/ui-design/merged-views.md): Phase and Landscape are one wide panel, with no other pane beside
  // them (__cmwOtherPane: null). The old layout's other pane was the shapes plane X next to the view, so `.panL` then
  // pans X's plane in the X → Y view (the same picture, the same pane width as the reference's), and the view is
  // switched back before `.panR` / `.orbit`. A build without the hook has the other pane beside the view.
  const otherSide = await B.ev(`typeof __cmwOtherPane === 'function' ? __cmwOtherPane(${JSON.stringify(mode)}, ${JSON.stringify(st.sphereMode || 'image')}) : ${JSON.stringify(viewSide === 'R' ? 'L' : 'R')}`);
  const mergedMain = otherSide === null ? await B.ev('__cmwLayout().main') : null;
  detail(`${pre}.otherPane`, otherSide === null ? `merged (${mergedMain}): X in X → Y` : otherSide);
  // (merged-views review: the view's own pane is the full-width panel here, about twice the reference's pane width, so
  // `.panR` / `.orbit` compare a 2x-wider picture with the reference's half-width pane; said in the details)
  if (otherSide === null) detail(`${pre}.viewWidth`, await B.ev(`(() => { const l = __cmwLayout(); return 'full-width panel ' + Math.round(l.wL) + ' px (the reference: a half-width pane)'; })()`));
  await sceneStatics(pre);
  for (const idSide of kind === 'pan' ? ['L', 'R'] : ['R']) {
    const merged = otherSide === null && idSide === 'L';
    if (merged) { await B.ev("__cmwSetMain('xy'), 1"); await sleep(300); await settle(await pageNow()); }
    if (otherSide === null && idSide === 'R' && kind === 'pan') { await B.ev(`__cmwSetMain(${JSON.stringify(mergedMain)}), 1`); await sleep(300); await settle(await pageNow()); }
    const side = idSide === 'R' ? viewSide : merged ? 'L' : otherSide;
    const id = kind === 'pan' ? `${pre}.pan${idSide}` : `${pre}.orbit`;
    const reps = [];
    let moved = true;
    for (let i = 0; i < REPS; i++) {
      const h0 = await shotAtRest(side);
      // (a globe orbit holds Space: on an editable globe a plain left drag on a region would move it, P3b)
      const sp = kind === 'orbit' && mode === 'sphere';
      const leg1 = await dragLeg(side, 160, 60, kind === 'pan' ? 'middle' : 'left', 40, 16, sp);
      const h1 = await shotAtRest(side);
      const leg2 = await dragLeg(side, -160, -60, kind === 'pan' ? 'middle' : 'left', 40, 16, sp);
      moved = moved && h0 !== h1;
      reps.push(legSummary([leg1, leg2], 'pointermove'));
    }
    putInteraction(id, reps);
    put(`${id}.view_moved`, 'check', '', [moved]);
  }
  await sceneEnd(pre);
}

// X Sphere at stage 0 (notes/ui-design/panels.md 11, P3): the region itself on the z-globe, exact through infinity (one
// inverse pass per shape over the globe; before P3 and in the reference, the lifted mesh): orbit the left pane
async function globeLUnit(pre, scene) {
  const st = sceneState(scene, { rightMode: 'image', meshN: 240, leftSphere: true });
  const o = await openApp(st);
  detail(`${pre}.open`, o);
  await sceneStatics(pre);
  const id = `${pre}.orbit`, reps = [];
  let moved = true;
  for (let i = 0; i < REPS; i++) {
    const h0 = await shotAtRest('L');
    // Space held: the X globe is editable and the region covers the press point (P3b: a plain drag would move it)
    const leg1 = await dragLeg('L', 160, 60, 'left', 40, 16, true);
    const h1 = await shotAtRest('L');
    const leg2 = await dragLeg('L', -160, -60, 'left', 40, 16, true);
    moved = moved && h0 !== h1;
    reps.push(legSummary([leg1, leg2], 'pointermove'));
  }
  putInteraction(id, reps);
  put(`${id}.view_moved`, 'check', '', [moved]);
  await sceneEnd(pre);
}

// Loading each example with __cmwExample(i): time to the first frame that drew and until settled, memory after.
const N_EXAMPLES = 14; // EX in src/app.js (0 'Empty canvas' .. 13 'Every sheet of the logarithm')
async function examplesUnit() {
  const per = new Map();
  for (let rep = 0; rep < (QUICK ? 1 : REPS); rep++) {
    log('examples rep', rep + 1);
    await openApp(sceneState('default', { rightMode: 'image', meshN: 240 }));
    for (let i = 0; i < N_EXAMPLES; i++) {
      // (the previous example's SphereMeshes are freed first, as loading this one would: otherwise this example's peak
      // carries them in, e.g. examples.10.gpu_peak = examples.9.gpu_live exactly)
      await B.ev('(typeof __cmwSmReset === "function" && __cmwSmReset()); __perf.resetPeak(); 1');
      const [a, b, name] = await B.ev(`(() => { const t0 = performance.now(); __cmwExample(${i}); const t1 = performance.now(); const l = document.querySelector('#examplesBtn .exlabel'); return [t0, t1, l ? l.textContent : '']; })()`);
      // the first frame that drew after the call
      let first = null;
      for (let k = 0; k < 300 && !first; k++) {
        const f = await B.ev(`__perf.framesSince(${a}).filter((f) => f[3] > 0)`);
        if (f.length) first = f[0]; else await sleep(10);
      }
      let morph = null, from = a;
      const st = await B.ev('__cmwState()');
      if (st.morph && st.morph.playing) {
        // an example that plays its deformation: measure the animation for 1.5 s, then pause it and settle
        const m0 = await pageNow();
        await sleep(1500);
        const m1 = await pageNow();
        const w = await windowStats(m0, m1);
        morph = { frame_p95: quant(w.frame, 0.95), fps: w.drawn.length / (w.dur / 1000) };
        from = await B.ev(`(() => { const p = document.getElementById('morphPlay'); if (p) p.click(); return performance.now(); })()`);
      }
      const s = await settle(from);
      const mem = await B.ev('__perf.mem()');
      const info = await B.ev('__cmwInfo()');
      // compiles (SPEC 12.5): the programs linked for this load, when the last one was ready, and the inverse
      // programs (none before P2): their compile + first draw (from the first inverse link to the end of the first
      // frame that drew with one) and the time from the call to that frame. A slow inverse compile may outlast the
      // settle (the app shows a forward stand-in meanwhile): wait for its first frame, bounded
      let cp = await compileStats(a, s.now);
      if (cp.inv_never_drew) { await waitInverseFrame(a, 5000); cp = await compileStats(a, await pageNow()); }
      const rec = per.get(i) || { name, call: [], ttff: [], settle: [], live: [], peak: [], tris: [], morphFrame: [], morphFps: [], to: [], progs: [], compile: [], invProgs: [], invCompile: [], invFirst: [], invAfter: [], invNever: [] };
      rec.invNever.push(cp.inv_never_drew);
      rec.progs.push(cp.programs); rec.compile.push(cp.compile_ms); rec.invProgs.push(cp.inv_programs);
      rec.invCompile.push(cp.inv_compile_ms); rec.invFirst.push(cp.inv_first_draw_ms); rec.invAfter.push(cp.inv_after_call_ms);
      rec.call.push(b - a);
      rec.ttff.push(first ? first[6] - a : null);
      rec.settle.push(s.timeout ? null : s.t - from);
      rec.to.push(s.timeout);
      rec.live.push(mem.live); rec.peak.push(mem.peak);
      rec.tris.push(info.reduce((x, q) => x + (q.tris || 0) + (q.fixR || 0) + (q.fixL || 0), 0));
      if (morph) { rec.morphFrame.push(morph.frame_p95); rec.morphFps.push(morph.fps); }
      per.set(i, rec);
    }
  }
  for (const [i, r] of per) {
    const id = `examples.${i}`;
    put(`${id}.call_ms`, 'info', 'ms', r.call, { name: r.name }); // part of first_frame_ms; too noisy on its own
    put(`${id}.first_frame_ms`, 'oneshot_ms', 'ms', r.ttff, { name: r.name });
    put(`${id}.settle_ms`, 'settle_ms', 'ms', r.settle, { name: r.name });
    put(`${id}.settled`, 'check', '', r.to.map((x) => !x));
    put(`${id}.gpu_live_bytes`, 'mem_bytes', 'B', r.live, { name: r.name });
    put(`${id}.gpu_peak_bytes`, 'mem_bytes', 'B', r.peak, { name: r.name });
    put(`${id}.tris`, 'info', '', r.tris, { name: r.name });
    put(`${id}.programs`, 'info', '', r.progs, { name: r.name });
    put(`${id}.compile_ms`, 'oneshot_ms', 'ms', r.compile, { name: r.name });
    put(`${id}.inv_programs`, 'info', '', r.invProgs, { name: r.name });
    put(`${id}.inv_compile_ms`, 'info', 'ms', r.invCompile, { name: r.name });
    // expect: an inverse program was linked in some rep, so a value must exist (null would mean the harness lost it)
    put(`${id}.inv_first_draw_ms`, 'limit', 'ms', r.invFirst, { name: r.name, limit: INV_FIRST_DRAW_LIMIT, expect: r.invProgs.some((n) => n > 0), never_drew: r.invNever.some(Boolean) });
    // a rep whose inverse program never drew is not outvoted by the median: the value is then the worst rep
    if (r.invNever.some(Boolean)) RES.metrics[`${id}.inv_first_draw_ms`].value = r3(Math.max(...r.invFirst.filter(Number.isFinite)));
    put(`${id}.inv_after_call_ms`, 'info', 'ms', r.invAfter, { name: r.name });
    if (r.morphFps.length) {
      put(`${id}.morph.fps`, 'throughput', 'frames/s', r.morphFps, { name: r.name });
      put(`${id}.morph.frame_p95_ms`, 'frame_ms', 'ms', r.morphFrame, { name: r.name });
    }
  }
}

// The examples with inverse programs loaded with COLD inverse compiles (P2 review: macOS caches compiled Metal libraries
// system-wide, so examples.N.inv_first_draw_ms is always warm): GLR._src.coldCompiles gives every new inverse program a
// unique uniform, as on a user's first visit. Reported as info (SPEC 14 open question 7 is the lead's: 13.10 measured
// 254-356 ms cold for the unbounded scenes against the 250 ms limit).
const COLD_EXAMPLES = [2, 3, 4, 6, 7, 8, 9];
async function examplesColdUnit() {
  const per = new Map();
  for (let rep = 0; rep < (QUICK ? 1 : REPS); rep++) {
    await openApp(sceneState('default', { rightMode: 'image', meshN: 240 }));
    // (an app without inverse programs, e.g. the paired run's pre-sphere reference: nothing to measure)
    if (!(await B.ev(`typeof GLR !== 'undefined' && !!GLR._src && 'coldCompiles' in GLR._src`))) return;
    await B.ev('GLR._src.coldCompiles = true; 1');
    for (const i of COLD_EXAMPLES) {
      const [a, name] = await B.ev(`(() => { const t0 = performance.now(); __cmwExample(${i}); const l = document.querySelector('#examplesBtn .exlabel'); return [t0, l ? l.textContent : '']; })()`);
      const s = await settle(a);
      let cp = await compileStats(a, s.now);
      if (cp.inv_never_drew) { await waitInverseFrame(a, 5000); cp = await compileStats(a, await pageNow()); }
      const st = await B.ev('__cmwState()');
      if (st.morph && st.morph.playing) await B.ev(`(() => { const p = document.getElementById('morphPlay'); if (p) p.click(); return 1; })()`);
      const r = per.get(i) || { name, first: [], ready: [], progs: [] };
      r.first.push(cp.inv_first_draw_ms); r.ready.push(cp.inv_compile_ms); r.progs.push(cp.inv_programs);
      per.set(i, r);
    }
  }
  for (const [i, r] of per) {
    put(`examples.cold.${i}.inv_first_draw_ms`, 'info', 'ms', r.first, { name: r.name, limit_warm: INV_FIRST_DRAW_LIMIT });
    put(`examples.cold.${i}.inv_compile_ms`, 'info', 'ms', r.ready, { name: r.name });
    put(`examples.cold.${i}.inv_programs`, 'info', '', r.progs, { name: r.name });
  }
}

// programs linked in [a, b] (page times): how many, when the last forward one was ready (ms after a; 0 when nothing
// was compiled), and the inverse programs: count, ready, compile + first draw, first inverse frame after a. An inverse
// program that was linked but drew no frame by b is NOT "nothing measured": inv_first_draw_ms is then the whole
// window b - (its link), a lower bound of the real time (inv_never_drew), so the 250 ms limit still judges it.
const INV_FIRST_DRAW_LIMIT = 250;   // SPEC 4.7: compile plus first draw of the inverse program <= 250 ms
async function compileStats(a, b) {
  const progs = await B.ev(`__perf.progsSince(${a}, ${b})`);   // [t, ready, inv]
  const fwd = progs.filter((p) => !p[2]), inv = progs.filter((p) => p[2]);
  const lastReady = (l) => { const r = l.map((p) => p[1]).filter((x) => x !== null); return r.length ? Math.max(...r) : null; };
  const f = (await B.ev(`__perf.framesSince(${a}, ${b}).filter((f) => f[7] > 0)`))[0];
  const inv0 = inv.length ? Math.min(...inv.map((p) => p[0])) : null;
  const never = inv0 !== null && !f;
  return {
    programs: progs.length, inv_programs: inv.length, unseen: progs.filter((p) => p[1] === null).length,
    compile_ms: fwd.length ? (lastReady(fwd) !== null ? Math.max(0, lastReady(fwd) - a) : null) : 0,
    inv_compile_ms: inv.length && lastReady(inv) !== null ? lastReady(inv) - a : null,
    inv_first_draw_ms: f && inv0 !== null ? f[6] - inv0 : (never ? b - inv0 : null),
    inv_after_call_ms: f ? f[6] - a : (never ? b - a : null),
    inv_never_drew: never,
  };
}
// after an inverse program was linked (since page time a), wait (bounded) for the first frame drawn with one:
// returns that frame's end time, or null when none came within timeout (or no inverse program was linked)
async function waitInverseFrame(a, timeout = 5000) {
  const t0 = Date.now();
  for (;;) {
    const r = await B.ev(`(() => { const l = __perf.progsSince(${a}).some((p) => p[2]); const f = __perf.framesSince(${a}).filter((f) => f[7] > 0)[0]; return [l, f ? f[6] : null]; })()`);
    if (!r[0] || r[1] !== null) return r[1];
    if (Date.now() - t0 > timeout) return null;
    await sleep(50);
  }
}
// does the app say that some shape of the right plane is drawn on the inverse path (SPEC 10.1 __cmwPaths, P2 on)?
// null when the hook does not exist (before P2)
async function pathsSayInverse() {
  return B.ev(`(() => { if (typeof __cmwPaths !== 'function') return null; try { const p = __cmwPaths(); return Array.isArray(p) && p.some((r) => r && r.role === 'R' && (r.viewKind || 'flat') === 'flat' && r.path === 'inverse'); } catch (e) { return null; } })()`);
}
// the unit measured the path it meant to: when the app says a shape is inverse (or, without the hook, an inverse
// program was linked), some draws of the unit must have used an inverse program (SPEC 12.5; before P2: true)
async function inverseDrawnCheck(name, draws, linkedSince = 0) {
  const says = await pathsSayInverse();
  const linked = (await B.ev(`__perf.progsSince(${linkedSince}).some((p) => p[2])`));
  const expected = says === null ? linked : says;
  put(name, 'check', '', [!expected || draws > 0], { expected, paths_say_inverse: says, inverse_linked: linked, inv_draws: draws });
}

// Scrubbing the phi label of a disk automorphism (a Mobius step): every 4 px of drag changes phi by 1 degree.
// morph: the same with the deformation open and paused (its arrows must not be re-chosen in every frame of the scrub)
async function scrubUnit(morph = false) {
  const pre = morph ? 'scrub.blaschke_phi_morph' : 'scrub.blaschke_phi';
  const o = await openApp(sceneState('scrub', { rightMode: 'image', meshN: 240 }));
  detail(`${pre}.open`, o);
  if (morph) {
    const ok = await B.ev(`(() => { const b = document.getElementById('morphBtn'); if (!b) return false; b.click(); ${morphPlayIf(false)} return true; })()`);
    if (!ok) throw new Error('no deformation button');
    await sleep(400);
    await settle(await pageNow());
  }
  // (v15: a step's fields are in the Inspector, #i1_phi, once step 1 is selected; earlier builds: the card's #p1_phi)
  const PHI = `(document.getElementById('i1_phi') || document.getElementById('p1_phi'))`;
  await B.ev(`(() => { if (document.querySelector('#propsPanel .insp-sel') && !document.getElementById('i1_phi')) { const c = document.querySelector('#pipeline .card[data-k="1"]'); if (c) c.click(); } return 1; })()`);
  await sleep(200);
  const reps = [];
  let changed = true;
  for (let i = 0; i < REPS; i++) {
    const legs = [];
    for (const dir of [1, -1]) {
      const r = await B.ev(`(() => { const e = ${PHI}, l = e && document.querySelector('label[for="' + e.id + '"]'); if (!l) return null; l.scrollIntoView({ block: 'nearest' }); const b = l.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
      if (!r) throw new Error('scrub label p1_phi not found');
      const v0 = await B.ev(`${PHI}.value`);
      const a = await pageNow();
      await B.drag(r[0], r[1], r[0] + dir * 160, r[1], { n: 40, dt: 16, button: 'left' });
      const b = await pageNow();
      const v1 = await B.ev(`${PHI}.value`);
      changed = changed && Math.abs(Number(v1) - Number(v0)) >= 30;
      const w = await windowStats(a, b);
      const s = await settle(b);
      legs.push(Object.assign(w, { settle: s.timeout ? null : Math.max(0, s.t - b), settleTimeout: s.timeout, jank: await jankIn(b + 1, s.now) }));
    }
    reps.push(legSummary(legs, 'pointermove'));
  }
  putInteraction(pre, reps);
  put(`${pre}.value_changed`, 'check', '', [changed]);
  await sceneStatics(pre);
}

// Opening the deformation on the examples with the most candidate paths (7: sqrt, 4: log of an annulus): the frames
// and the longest stall of the 1.2 s after the button is pressed, while it plays and its arrows are chosen
async function morphOpenUnit() {
  for (const ex of [7, 4]) {
    const pre = `morph.open.ex${ex}`;
    const frame = [], jank = [];
    for (let i = 0; i < REPS; i++) {
      await openApp(sceneState('scrub', { rightMode: 'image', meshN: 240 }));
      await B.ev(`__cmwExample(${ex})`);
      await sleep(300);
      await settle(await pageNow());
      // closed first when the example opens it
      await B.ev(`(() => { const b = document.getElementById('morphBtn'); if (b && b.getAttribute('aria-pressed') === 'true') b.click(); return 0; })()`);
      await sleep(300);
      await settle(await pageNow());
      const a = await B.ev(`(() => { const t = performance.now(); const b = document.getElementById('morphBtn'); if (b) b.click(); return t; })()`);
      await sleep(1200);
      const b = await pageNow();
      const w = await windowStats(a, b);
      frame.push(quant(w.frame, 0.95));
      jank.push(await jankIn(a, b));
    }
    put(`${pre}.frame_p95_ms`, 'frame_ms', 'ms', frame);
    put(`${pre}.jank_ms`, 'jank_ms', 'ms', jank);
  }
}

// The deformation playing in the Phase and Landscape views (merged-views review): one full-width panel paints H_t at
// every frame (868 px wide at 1440 x 900, against v11's ~430 px pane). The scene opens in the view (rightMode color /
// 3d: the Phase / Landscape view here, the old layout's pane in the reference), the toggle (#morphBtn) opens the
// deformation, which plays; 2 s of playback are measured. The reference cannot paint H_t in its phase pane (its
// deformation is a view of the right pane), so this unit is like-for-unlike against it and is gated by the absolute
// 60 fps budget (compare_perf BUDGET60: frame p95 <= 14 ms, fps >= 55); `.view` says which picture played.
async function morphViewsUnit() {
  for (const [mode, main] of [['color', 'phase'], ['3d', 'land']]) {
    for (const scene of ['default', 'scrub']) {
      const pre = `morph.play.${main}.${scene}`;
      const frame = [], fps = [], jank = [];
      let view = '';
      for (let i = 0; i < REPS; i++) {
        await openApp(sceneState(scene, { rightMode: mode, meshN: 240 }));
        const ok = await B.ev(`(() => { const b = document.getElementById('morphBtn'); if (!b) return false; if (b.getAttribute('aria-pressed') !== 'true') b.click(); ${morphPlayIf(true)} return true; })()`);
        if (!ok) throw new Error('no deformation button');
        await sleep(500);
        view = await B.ev(`typeof __cmwLayout === 'function' ? (() => { const l = __cmwLayout(); return l.main + (l.deform ? '+deformation' : '') + ':' + l.shown.join(''); })() : 'reference:' + __cmwState().mode`);
        const a = await pageNow();
        await sleep(2000);
        const b = await pageNow();
        const w = await windowStats(a, b);
        frame.push(quant(w.frame, 0.95));
        fps.push(w.drawn.length * 1000 / w.dur);
        jank.push(await jankIn(a, b));
      }
      put(`${pre}.frame_p95_ms`, 'frame_ms', 'ms', frame);
      put(`${pre}.fps`, 'throughput', 'frames/s', fps);
      put(`${pre}.jank_ms`, 'jank_ms', 'ms', jank);
      detail(`${pre}.view`, view);
    }
  }
}

// Issue #48 (walls verify-5): the Max mesh (1920) Landscape with All sheets while the deformation plays, the user's
// case (sqrt then sin of the square |Re z|, |Im z| < 3, height Im). `first`: the first play after a load (the sheets'
// and the walls' first draws land in it), 2.5 s from T = 0; `steady`: the same play again from T = 0. Both are held to
// the 60 fps budget (fps >= 55, frame p95 <= 14 ms) on the machines with real GPUs.
async function morphLandMaxUnit() {
  const pre = 'morph.play.land.max';
  const st = sceneState('default', { shapes: [{ id: 's1', kind: 'rect', a: [-3, -3], b: [3, 3] }], steps: [{ type: 'root', params: { n: 2, cut: 180 }, on: true }, { type: 'sin', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 60 }, rightMode: '3d', view: { main: 'land' }, sheets: true, height: 'im', meshN: 1920 });
  const m = { first: { frame: [], fps: [], jank: [] }, steady: { frame: [], fps: [], jank: [] } };
  let view = '';
  for (let i = 0; i < REPS; i++) {
    await openApp(st);
    await B.ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 1 } })');
    await settle(await pageNow());
    view = await B.ev('typeof __cmwLayout === "function" ? (() => { const l = __cmwLayout(); return l.main + (l.deform ? "+deformation" : "") + ":" + l.shown.join("") + (__cmwState().sheets ? ", All sheets" : ""); })() : ""');
    for (const k of ['first', 'steady']) {
      await B.ev('__cmwMorph({ T: 0 }); __cmwMorph({ playing: true }); 1');
      const a = await pageNow();
      await sleep(2500);
      const b = await pageNow();
      await B.ev('__cmwMorph({ playing: false }); 1');
      const w = await windowStats(a, b);
      m[k].frame.push(quant(w.frame, 0.95));
      m[k].fps.push(w.drawn.length * 1000 / w.dur);
      m[k].jank.push(await jankIn(a, b));
      await settle(await pageNow());
    }
  }
  for (const k of ['first', 'steady']) {
    put(`${pre}.${k}.frame_p95_ms`, 'frame_ms', 'ms', m[k].frame);
    put(`${pre}.${k}.fps`, 'throughput', 'frames/s', m[k].fps);
    put(`${pre}.${k}.jank_ms`, 'jank_ms', 'ms', m[k].jank);
  }
  detail(`${pre}.view`, view);
}

// Hovering the right plane in Image mode: preimages of w are tracked in the left plane on every pointermove.
async function hoverUnit(scene) {
  const pre = `hover.${scene}`;
  const o = await openApp(sceneState(scene, { rightMode: 'image', meshN: 240 }));
  detail(`${pre}.open`, o);
  const reps = [];
  let found = true;
  for (let i = 0; i < REPS; i++) {
    const r = await paneRect('R');
    const a = await pageNow();
    // a slow sweep through the plane (no buttons): 60 moves 16 ms apart along a wave
    for (let k = 0; k <= 60; k++) {
      const t = Date.now();
      const u = k / 60;
      await B.move(r.cx + (u - 0.5) * r.w * 0.5, r.cy + Math.sin(u * Math.PI * 2) * r.h * 0.15);
      const left = 16 - (Date.now() - t);
      if (left > 0) await sleep(left);
    }
    const b = await pageNow();
    const hov = await B.ev('__cmwState().hov');
    found = found && Array.isArray(hov) && hov.length > 0;
    const w = await windowStats(a, b);
    await B.move(5, 5); // leave the plane, so the next sweep starts with a fresh search
    const s = await settle(b);
    const sm = legSummary([Object.assign(w, { settle: s.timeout ? null : Math.max(0, s.t - b), settleTimeout: s.timeout, jank: 0 })], 'pointermove');
    sm.preimages = Array.isArray(hov) ? hov.length : 0;
    reps.push(sm);
  }
  const col = (k) => reps.map((r) => r[k]);
  putPooled(`${pre}.input_p50_ms`, 'cpu_ms', 'ms', reps, 'inp', 0.5, 'input_p50');
  putPooled(`${pre}.input_p95_ms`, 'cpu_ms', 'ms', reps, 'inp', 0.95, 'input_p95');
  putPooled(`${pre}.frame_p95_ms`, 'frame_ms', 'ms', reps, 'frame', 0.95, 'frame_p95');
  put(`${pre}.fps`, 'throughput', 'frames/s', col('fps'));
  putPooled(`${pre}.latency_p95_ms`, 'latency_ms', 'ms', reps, 'lat', 0.95, 'lat_p95');
  put(`${pre}.preimages`, 'info', '', col('preimages'));
  put(`${pre}.found_preimages`, 'check', '', [found]);
}

// CPU mesh build (Region.buildMesh) per shape kind and resolution, with mesh-quality figures.
const MESH_BENCH = function (spec, Q, runs, win) {
  const s = Object.assign({ id: 'bench', visible: true, ci: 0 }, JSON.parse(JSON.stringify(spec.s)));
  const times = [];
  let m = null;
  Region.buildMesh(s, win, Q); // warm-up (JIT, parse caches)
  for (let i = 0; i < runs; i++) { const t0 = performance.now(); m = Region.buildMesh(s, win, Q); times.push(performance.now() - t0); }
  times.sort((a, b) => a - b);
  const out = { ms: times[0], times }; // deterministic CPU work: the fastest run is the robust estimate (noise only adds)
  if (!m || !m.src || !m.tri) return Object.assign(out, { api: Object.keys(m || {}) });
  const P = m.src, T = m.tri, nt = T.length / 3;
  out.tris = nt; out.verts = P.length / 2;
  // quality: minimum angle per triangle (degrees), total area, and the area inside the window (Sutherland-Hodgman)
  const angs = [];
  let area = 0, inWin = 0;
  const clipArea = (poly) => {
    const edges = [
      [(p) => p[0] >= win.x0, (a, b) => { const t = (win.x0 - a[0]) / (b[0] - a[0]); return [win.x0, a[1] + t * (b[1] - a[1])]; }],
      [(p) => p[0] <= win.x1, (a, b) => { const t = (win.x1 - a[0]) / (b[0] - a[0]); return [win.x1, a[1] + t * (b[1] - a[1])]; }],
      [(p) => p[1] >= win.y0, (a, b) => { const t = (win.y0 - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), win.y0]; }],
      [(p) => p[1] <= win.y1, (a, b) => { const t = (win.y1 - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), win.y1]; }]];
    let pts = poly;
    for (const [inside, cut] of edges) {
      const res = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        const ia = inside(a), ib = inside(b);
        if (ia) res.push(a);
        if (ia !== ib) res.push(cut(a, b));
      }
      pts = res;
      if (!pts.length) return 0;
    }
    let s2 = 0;
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s2 += a[0] * b[1] - b[0] * a[1]; }
    return Math.abs(s2) / 2;
  };
  const inside = (p) => p[0] >= win.x0 && p[0] <= win.x1 && p[1] >= win.y0 && p[1] <= win.y1;
  const ang = (x, y, z) => Math.acos(Math.max(-1, Math.min(1, (y * y + z * z - x * x) / (2 * y * z)))) * 180 / Math.PI;
  for (let t = 0; t < nt; t++) {
    const a = T[3 * t], b = T[3 * t + 1], c = T[3 * t + 2];
    const A = [P[2 * a], P[2 * a + 1]], Bp = [P[2 * b], P[2 * b + 1]], Cp = [P[2 * c], P[2 * c + 1]];
    const ar = Math.abs((Bp[0] - A[0]) * (Cp[1] - A[1]) - (Cp[0] - A[0]) * (Bp[1] - A[1])) / 2;
    area += ar;
    inWin += inside(A) && inside(Bp) && inside(Cp) ? ar : clipArea([A, Bp, Cp]);
    const la = Math.hypot(Bp[0] - Cp[0], Bp[1] - Cp[1]), lb = Math.hypot(A[0] - Cp[0], A[1] - Cp[1]), lc = Math.hypot(A[0] - Bp[0], A[1] - Bp[1]);
    if (ar > 0 && la > 0 && lb > 0 && lc > 0) angs.push(Math.min(ang(la, lb, lc), ang(lb, la, lc), ang(lc, la, lb)));
  }
  angs.sort((x, y) => x - y);
  out.minAngle_p5 = angs.length ? angs[Math.floor(angs.length * 0.05)] : 0;
  out.degenerate = nt - angs.length;
  out.area = area;
  // the exact area of shape ∩ window, by sampling the shape's level function on a fine grid
  const L = Region.levelOf(s);
  const NX = 800, NY = Math.round(800 * (win.y1 - win.y0) / (win.x1 - win.x0));
  let hit = 0;
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    if (L(CX.C(win.x0 + (i + 0.5) * (win.x1 - win.x0) / NX, win.y0 + (j + 0.5) * (win.y1 - win.y0) / NY)) > 0) hit++;
  }
  out.winArea = hit / (NX * NY) * (win.x1 - win.x0) * (win.y1 - win.y0);
  out.inWin = inWin;
  out.coverage = out.winArea > 0 ? inWin / out.winArea : null;
  if (spec.area) out.areaErr = Math.abs(area - spec.area) / spec.area;
  return out;
};
async function meshUnit() {
  await openApp(sceneState('logUHP', { rightMode: 'image', meshN: 240 }));
  await B.ev(`window.__perfMeshBench = ${MESH_BENCH.toString()}; 1`);
  const win = { x0: -4, x1: 4, y0: -3, y1: 3 };
  const QS = QUICK ? [60, 480] : [60, 120, 480]; // the app's base resolution for meshN 240, 480, 1920 (meshN / 4)
  for (const spec of MESH_SHAPES) {
    for (const Q of QS) {
      const id = `mesh.${spec.name}.q${Q}`;
      const runs = Q >= 480 ? 5 : 9;
      const reps = [];
      for (let i = 0; i < REPS; i++) reps.push(await B.ev(`__perfMeshBench(${JSON.stringify(spec)}, ${Q}, ${runs}, ${JSON.stringify(win)})`));
      const r0 = reps[0];
      put(`${id}.build_ms`, 'cpu_ms', 'ms', reps.map((r) => r.ms), { stat: 'min' });
      RES.metrics[`${id}.build_ms`].value = r3(Math.min(...reps.map((r) => r.ms)));
      put(`${id}.api_ok`, 'check', '', [r0.tris !== undefined], r0.tris === undefined ? { api: r0.api } : undefined);
      if (r0.tris === undefined) continue;
      put(`${id}.tris`, 'info', '', [r0.tris]);
      put(`${id}.min_angle_p5_deg`, 'quality_min', 'deg', [r0.minAngle_p5]);
      put(`${id}.window_coverage`, 'coverage', '', [r0.coverage]);
      if (r0.areaErr !== undefined) put(`${id}.area_err`, 'quality_err', '', [r0.areaErr]);
    }
  }
}

// ---------------- units of SPEC 12.5 (phase P0): exact images through infinity ----------------
const setDpr = (dpr) => B.send('Emulation.setDeviceMetricsOverride', { width: VIEW_W, height: VIEW_H, deviceScaleFactor: dpr, mobile: false });
// draws with an inverse program so far (inject.js; 0 before P2): tells whether a unit measured the inverse path
const invDraws = async () => (await B.ev('__perf.counters()')).invDraws;

// Image mode, right plane only: statics, pan R, wheel zoom R in and out (each with its settle), at device pixel ratio
// dpr (the viewport stays 1440x900 CSS px; dpr 2 draws 4x the pixels). Scenes with pinned right views.
// over: further state (the opacity variants: {alpha}). half_passes (info): inverse passes drawn at half resolution by
// the cost guard during the pan and zoom (P2 review: a gate pass reached at half resolution is visible)
const halfDraws = async () => B.ev(`typeof GLR !== 'undefined' && GLR.inverseHalfDraws !== undefined ? GLR.inverseHalfDraws : 0`);
async function imageRUnit(pre, scene, dpr, over = {}) {
  if (dpr !== 1) await setDpr(dpr);
  try {
    const o = await openApp(sceneState(scene, Object.assign({ rightMode: 'image', meshN: 240 }, over)));
    detail(`${pre}.open`, o);
    const got = await B.ev('[devicePixelRatio, document.getElementById("canvasR").width, document.getElementById("canvasR").height]');
    detail(`${pre}.canvasR`, got);
    put(`${pre}.dpr_ok`, 'check', '', [Math.abs(got[0] - dpr) < 1e-9]);
    // an inverse program linked during the load must have drawn before anything is measured (a slow compile shows
    // the forward stand-in meanwhile; settle() waits for GLR.frameStatus().pending, this also without that flag)
    if ((await B.ev('__perf.counters()')).invLinks > 0) detail(`${pre}.inv_first_frame_t`, await waitInverseFrame(0, 5000));
    const d0 = await invDraws(), h0 = await halfDraws();
    await sceneStatics(pre);
    await panSide(pre, 'R', null);
    await zoomSide(pre, 'R', null, null, 50 * dpr);
    const dn = (await invDraws()) - d0;
    put(`${pre}.inv_draws`, 'info', '', [dn]);
    put(`${pre}.half_passes`, 'info', '', [(await halfDraws()) - h0]);
    await inverseDrawnCheck(`${pre}.inverse_drawn`, dn);
    detail(`${pre}.paths`, await B.ev(`typeof __cmwPaths === 'function' ? __cmwPaths() : null`));
    await sceneEnd(pre);
  } finally { if (dpr !== 1) await setDpr(1); }
}

async function smUnit(pre, scene) {
  const o = await openApp(sceneState(scene, { rightMode: 'image', meshN: 240 }));
  detail(`${pre}.open`, o);
  const sm = () => B.ev(`typeof __cmwSphere === 'function' ? (() => { const s = __cmwSphere(); return { built: s.stats.built, maxSlice: s.stats.maxSlice, ms: s.stats.ms, slices: s.stats.slices, partial: s.stats.partial, entries: s.entries.map((e) => [e.why, e.n, e.ms, e.settleMs, e.partial]), maxPerSlot: Math.max(0, ...Object.values(s.entries.reduce((m, e) => { m[e.slot] = (m[e.slot] || 0) + 1; return m; }, {}))) }; })() : null`);
  const s0 = await sm();
  detail(`${pre}.sphere_mesh`, s0);
  if (s0) {
    put(`${pre}.sm_built`, 'check', '', [s0.built >= 1]);
    put(`${pre}.sm_job_ms`, 'info', 'ms', [Math.round(s0.ms)]);
  }
  await sceneStatics(pre);
  await panSide(pre, 'R', null);
  await zoomSide(pre, 'R', null, null, 50);
  const s1 = await sm();
  detail(`${pre}.sphere_mesh_after`, s1);
  if (s1) {
    put(`${pre}.sm_max_slice_ms`, 'info', 'ms', [+s1.maxSlice.toFixed(2)]);
    put(`${pre}.sm_slices_6ms`, 'check', '', [s1.maxSlice <= 6]);
    // memory: one published mesh per slot at rest after the pan and the zooms (the slot's older meshes are dropped)
    put(`${pre}.sm_one_per_slot`, 'check', '', [s1.maxPerSlot <= 1]);
  }
  await sceneEnd(pre);
}

// Scrubbing a Mobius parameter (phi of a disk automorphism, followed by (1 + w)/(1 - w)) of the upper half-plane, whose
// boundary is a long line. The chain's pole blaschke^-1(1) moves with phi and crosses that boundary during each drag
// (pole_crossed checks it from the phi values the drags produced), so a refinement keyed on singular points would
// see a new key on every motion frame. Besides the frame times the unit counts line resampling (Region.sampleCurve)
// and line re-uploads (GLR.createLines) during the scrub (P4 must keep both at 0: refinement happens on settle only)
// and after it, while it settles.
async function scrubMobiusUnit() {
  const pre = 'scrub.mobius_halfplane';
  const o = await openApp(sceneState('mobius_halfplane', { rightMode: 'image', meshN: 240 }));
  detail(`${pre}.open`, o);
  await B.ev(`(() => { if (window.__lineCount) return 1; const c = window.__lineCount = { up: 0, samp: 0 };
    const cl = GLR.createLines; GLR.createLines = function () { c.up++; return cl.apply(this, arguments); };
    const sc = Region.sampleCurve; Region.sampleCurve = function () { c.samp++; return sc.apply(this, arguments); }; return 1; })()`);
  const count = () => B.ev('[__lineCount.up, __lineCount.samp]');
  // (v15: the Inspector's #i1_phi once step 1 is selected; earlier builds: the card's #p1_phi)
  const PHI = `(document.getElementById('i1_phi') || document.getElementById('p1_phi'))`;
  await B.ev(`(() => { if (document.querySelector('#propsPanel .insp-sel') && !document.getElementById('i1_phi')) { const c = document.querySelector('#pipeline .card[data-k="1"]'); if (c) c.click(); } return 1; })()`);
  await sleep(200);
  const reps = [];
  let changed = true, up = 0, samp = 0, upS = 0, sampS = 0, crossed = true;
  const phis = [];
  // the pole's side of the boundary changes between phi0 and phi1 (sampled every 0.5 deg: one crossing per drag)
  const crosses = (p0, p1) => { let n = 0, prev = Math.sign(mobiusHalfplanePole(p0).im); for (let k = 1, K = Math.max(1, Math.ceil(Math.abs(p1 - p0) * 2)); k <= K; k++) { const sg = Math.sign(mobiusHalfplanePole(p0 + (p1 - p0) * k / K).im); if (sg !== prev && sg !== 0) { n++; prev = sg; } } return n; };
  for (let i = 0; i < REPS; i++) {
    const legs = [];
    for (const dir of [1, -1]) {
      const r = await B.ev(`(() => { const e = ${PHI}, l = e && document.querySelector('label[for="' + e.id + '"]'); if (!l) return null; l.scrollIntoView({ block: 'nearest' }); const b = l.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
      if (!r) throw new Error('scrub label p1_phi not found');
      const v0 = await B.ev(`${PHI}.value`);
      const c0 = await count();
      const a = await pageNow();
      await B.drag(r[0], r[1], r[0] + dir * 160, r[1], { n: 40, dt: 16, button: 'left' });
      await sleep(40);   // the frame of the last tick (refinement on settle starts only after the 150-200 ms debounces)
      const b = await pageNow();
      const c1 = await count();
      const v1 = await B.ev(`${PHI}.value`);
      changed = changed && Math.abs(Number(v1) - Number(v0)) >= 30;
      crossed = crossed && crosses(Number(v0), Number(v1)) >= 1;
      phis.push([Number(v0), Number(v1)]);
      const w = await windowStats(a, b);
      const s = await settle(b);
      const c2 = await count();
      up += c1[0] - c0[0]; samp += c1[1] - c0[1]; upS += c2[0] - c1[0]; sampS += c2[1] - c1[1];
      legs.push(Object.assign(w, { settle: s.timeout ? null : Math.max(0, s.t - b), settleTimeout: s.timeout, jank: await jankIn(b + 1, s.now) }));
    }
    reps.push(legSummary(legs, 'pointermove'));
  }
  putInteraction(pre, reps);
  put(`${pre}.value_changed`, 'check', '', [changed]);
  put(`${pre}.pole_crossed`, 'check', '', [crossed]);
  detail(`${pre}.phi_legs`, phis.map(([p0, p1]) => ({ phi0: p0, phi1: p1, pole0: mobiusHalfplanePole(p0), pole1: mobiusHalfplanePole(p1) })));
  put(`${pre}.line_uploads`, 'info', '', [up]);
  put(`${pre}.line_samples`, 'info', '', [samp]);
  put(`${pre}.settle_line_uploads`, 'info', '', [upS]);
  put(`${pre}.settle_line_samples`, 'info', '', [sampS]);
  put(`${pre}.no_line_resample`, 'check', '', [up === 0 && samp === 0]);
  await sceneStatics(pre);
}

// Opening the examples gallery: its 48x32 thumbnails are drawn with each example's chain in GLR side mode. Records
// the time until every thumbnail has its image, the frames meanwhile, the programs linked and how many of them are
// inverse programs (expected 0: side chains never start an inverse compile, SPEC 4.4 / 10.7). A fresh page per rep
// (thumbnails are cached per page).
async function galleryUnit() {
  const pre = 'gallery.open';
  const r = { thumbs: [], settle: [], jank: [], progs: [], inv: [], n: [], all: [] };
  for (let rep = 0; rep < REPS; rep++) {
    await openApp(sceneState('default', { rightMode: 'image', meshN: 240 }));
    const c0 = await B.ev('__perf.counters()');
    const xy = await B.ev(`(() => { const b = document.getElementById('examplesBtn').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
    await B.mouse('mouseMoved', xy[0], xy[1]);
    const a = await pageNow();
    await B.mouse('mousePressed', xy[0], xy[1], { button: 'left', buttons: 1, clickCount: 1 });
    await B.mouse('mouseReleased', xy[0], xy[1], { button: 'left', buttons: 0, clickCount: 1 });
    const THUMBS = `[...document.querySelectorAll('#popHost .examples .ex-item:not([hidden]) .ex-thumb')]`;
    let t = null;
    try { t = await B.until(`(() => { const im = ${THUMBS}; return im.length && im.every((x) => x.getAttribute('src')) ? performance.now() : 0; })()`, 20000, 20); } catch (e) { t = null; }
    const b = t || await pageNow();
    const s = await settle(b);
    const shown = await B.ev(`(() => { const im = ${THUMBS}; return [im.length, im.filter((x) => x.getAttribute('src')).length]; })()`);
    const c1 = await B.ev('__perf.counters()');
    r.thumbs.push(t ? t - a : null); r.settle.push(s.timeout ? null : s.t - a); r.jank.push(await jankIn(a, s.now));
    r.progs.push(c1.links - c0.links); r.inv.push(c1.invLinks - c0.invLinks); r.n.push(shown[0]); r.all.push(shown[0] > 0 && shown[0] === shown[1]);
    await B.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await B.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await settle(await pageNow());
  }
  put(`${pre}.thumbs_ms`, 'oneshot_ms', 'ms', r.thumbs);
  put(`${pre}.settle_ms`, 'settle_ms', 'ms', r.settle);
  // the thumbnails are drawn in timer callbacks, not animation frames: the main-thread cost shows as long tasks (jank)
  put(`${pre}.jank_ms`, 'jank_ms', 'ms', r.jank);
  put(`${pre}.programs`, 'info', '', r.progs);
  put(`${pre}.inv_programs`, 'info', '', r.inv);
  put(`${pre}.thumbs`, 'info', '', r.n);
  put(`${pre}.all_thumbs`, 'check', '', r.all);
  put(`${pre}.no_inverse_compiles`, 'check', '', r.inv.map((x) => x === 0));
}

// Hovering the shape list dims every other shape to half its alpha. On exp of the upper half-plane (plus a disc whose
// row is hovered, so the half-plane is the dimmed shape) the sweep must run no compile and no fix-up / SphereMesh job
// (SPEC 8.8: Kmax is computed for the dimmed alpha). Records frame times, programs linked and LED busy starts.
async function hoverDimUnit() {
  const pre = 'hover.dim';
  const o = await openApp(sceneState('hoverdim', { rightMode: 'image', meshN: 240 }));
  detail(`${pre}.open`, o);
  const rowXY = (id) => B.ev(`(() => { const e = document.querySelector('.shape[data-id="${id}"] .shape-row'); if (!e) return null; e.scrollIntoView({ block: 'nearest' }); const b = e.getBoundingClientRect(); return [b.left + b.width * 0.4, b.top + b.height / 2]; })()`);
  // the dimming really happens: the right pane differs while the disc's row is hovered
  await B.move(5, 5); await settle(await pageNow());
  const h0 = await paneShot('R');
  const p2 = await rowXY('s2');
  if (!p2) throw new Error('shape row s2 not found');
  await B.move(p2[0], p2[1]); await settle(await pageNow());
  const h1 = await paneShot('R');
  await B.move(5, 5); await settle(await pageNow());
  put(`${pre}.dimmed`, 'check', '', [h0 !== h1]);
  const reps = [];
  let links = 0, inv = 0, busy = 0;
  for (let i = 0; i < REPS; i++) {
    const p1 = await rowXY('s1'), q2 = await rowXY('s2');
    const c0 = await B.ev('__perf.counters()');
    const a = await pageNow();
    // 6 visits to each row, 8 moves (16 ms apart) inside it per visit
    for (let k = 0; k < 12; k++) {
      const p = k % 2 ? p1 : q2;
      for (let m = 0; m < 8; m++) {
        const t = Date.now();
        await B.move(p[0] + (m - 4) * 3, p[1] + ((m % 3) - 1) * 2);
        const left = 16 - (Date.now() - t);
        if (left > 0) await sleep(left);
      }
    }
    const b = await pageNow();
    await B.move(5, 5);
    const w = await windowStats(a, b);
    const s = await settle(b);
    const c1 = await B.ev('__perf.counters()');
    links += c1.links - c0.links; inv += c1.invLinks - c0.invLinks; busy += c1.ledBusy - c0.ledBusy;
    reps.push(legSummary([Object.assign(w, { settle: s.timeout ? null : Math.max(0, s.t - b), settleTimeout: s.timeout, jank: await jankIn(b + 1, s.now) })], 'pointermove'));
  }
  putPooled(`${pre}.frame_p50_ms`, 'frame_ms', 'ms', reps, 'frame', 0.5, 'frame_p50');
  putPooled(`${pre}.frame_p95_ms`, 'frame_ms', 'ms', reps, 'frame', 0.95, 'frame_p95');
  // (no latency metric: a frame is drawn only when the hovered row changes, not per pointermove)
  put(`${pre}.settle_ms`, 'settle_ms', 'ms', reps.map((r) => r.settle));
  put(`${pre}.settle_jank_ms`, 'jank_ms', 'ms', reps.map((r) => r.jank));
  put(`${pre}.programs`, 'info', '', [links]);
  put(`${pre}.inv_programs`, 'info', '', [inv]);
  put(`${pre}.jobs`, 'info', '', [busy]);
  put(`${pre}.no_compile`, 'check', '', [links === 0]);
  put(`${pre}.no_job`, 'check', '', [busy === 0]);
}

// ---------------- wave 1's pointer and per-frame work (issue #63) ----------------
// Work wave 1 added to pointer paths and to the frame (notes/ux-build/w1-review-regress.json regress-6, regress-7):
// the snap and detent search of a hover with Point or a construction tool, of a body drag with Snap on and of a rail
// glide; the hover probe's readout on X; the Y render's target note and the overlay frame's undo state while the
// deformation plays. On the GPU gate these meet the 60 fps budget (frames, input handlers); on GitHub's machines they
// are reported.
const w2s = (side, re, im) => B.ev(`__cmwW2S('${side}', ${re}, ${im})`);
async function pickTool(id) {
  const ok = await B.ev(`(() => { const b = [...document.querySelectorAll('[data-tool="${id}"]')].find((e) => e.offsetParent) || document.querySelector('[data-tool="${id}"]'); if (!b) return false; b.click(); return true; })()`);
  if (!ok) throw new Error(`no tool ${id}`);
  await settle(await pageNow());
}
// moves along page points 16 ms apart, with the left button held when `held` (press at the first, release at the
// last) -> the window's stats and its settle, as dragLeg's
async function pathLeg(pts, held = false) {
  const btn = held ? { button: 'left', buttons: 1 } : {};
  await B.mouse('mouseMoved', pts[0][0], pts[0][1]);
  if (held) await B.mouse('mousePressed', pts[0][0], pts[0][1], { button: 'left', buttons: 1, clickCount: 1 });
  const a = await pageNow();
  for (const [x, y] of pts.slice(1)) {
    const t = Date.now();
    await B.mouse('mouseMoved', x, y, btn);
    const left = 16 - (Date.now() - t);
    if (left > 0) await sleep(left);
  }
  const [x1, y1] = pts[pts.length - 1];
  if (held) await B.mouse('mouseReleased', x1, y1, { button: 'left', buttons: 0, clickCount: 1 });
  const b = await pageNow();
  const w = await windowStats(a, b);
  if (!held) await B.move(5, 5);   // (leave the plane: the next sweep starts with a fresh search)
  const s = await settle(b);
  return Object.assign(w, { settle: s.timeout ? null : Math.max(0, s.t - b), settleTimeout: s.timeout, jank: await jankIn(b + 1, s.now), a, b });
}
// a sweep through a pane: 61 points along a wave over half its width
async function sweepPts(side) {
  const r = await paneRect(side);
  return Array.from({ length: 61 }, (_, k) => { const u = k / 60; return [r.cx + (u - 0.5) * r.w * 0.5, r.cy + Math.sin(u * Math.PI * 2) * r.h * 0.15]; });
}
// points round a circle of the left plane (centre c, radius r; degrees a0 to a1)
async function arcPts(c, r, a0, a1, n) {
  const out = [];
  for (let i = 0; i <= n; i++) { const t = (a0 + (a1 - a0) * i / n) * Math.PI / 180; out.push(await w2s('L', c[0] + r * Math.cos(t), c[1] + r * Math.sin(t))); }
  return out;
}
const shapeOf = (id) => B.ev(`(() => { const s = (__cmwCI({ shapes: true }).list || []).find((x) => x.id === ${JSON.stringify(id)}); return s ? JSON.parse(JSON.stringify(s)) : null; })()`);
// the hover metrics: the pointermove handlers (the snap search runs in them), the frames, the input-to-frame latency
function putPointer(pre, reps) {
  putPooled(`${pre}.input_p50_ms`, 'cpu_ms', 'ms', reps, 'inp', 0.5, 'input_p50', { input: 'pointermove' });
  putPooled(`${pre}.input_p95_ms`, 'cpu_ms', 'ms', reps, 'inp', 0.95, 'input_p95', { input: 'pointermove' });
  putPooled(`${pre}.frame_p95_ms`, 'frame_ms', 'ms', reps, 'frame', 0.95, 'frame_p95');
  putPooled(`${pre}.cpu_p95_ms`, 'frame_ms', 'ms', reps, 'cpu', 0.95, 'cpu_p95');
  put(`${pre}.fps`, 'throughput', 'frames/s', reps.map((r) => r.fps));
  putPooled(`${pre}.latency_p95_ms`, 'latency_ms', 'ms', reps, 'lat', 0.95, 'lat_p95');
}
// hovering X with a tool over the Line grid and its circles: Point (snapAt with the display curves and detentAt on
// every move), Orthogonal (a construction tool's target search)
async function pointerHoverUnit(pre, toolId) {
  detail(`${pre}.open`, await openApp(sceneState('gridCircles', { rightMode: 'image', meshN: 240 })));
  await pickTool(toolId);
  const reps = [];
  for (let i = 0; i < REPS; i++) reps.push(legSummary([await pathLeg(await sweepPts('L'))], 'pointermove'));
  putPointer(pre, reps);
  // the search ran: on a grid line inside the unit circle the ring names a target (recorded, not gated)
  const at = await w2s('L', 0.5, 0.004);
  await B.move(at[0], at[1]); await settle(await pageNow());
  detail(`${pre}.ring`, await B.ev(`(() => { const d = typeof __cmwCI === 'function' && __cmwCI(null); return d && d.ring ? d.ring.chip || null : null; })()`).catch(() => null));
  await B.move(5, 5);
}
// a body drag of the disc with Snap on across the grid (anchorMove's snapAt on every pointermove)
async function pointerSnapDragUnit() {
  const pre = 'pointer.snap_drag';
  const reps = [];
  let moved = true;
  for (let i = 0; i < REPS; i++) {
    await openApp(sceneState('gridCircles', { rightMode: 'image', meshN: 240 }));
    await pickTool('select');
    const d0 = await shapeOf('d1');
    const p0 = await w2s('L', d0.c[0], d0.c[1]), p1 = await w2s('L', 1.1, -0.8);
    const pts = Array.from({ length: 41 }, (_, k) => [p0[0] + (p1[0] - p0[0]) * k / 40, p0[1] + (p1[1] - p0[1]) * k / 40]);
    reps.push(legSummary([await pathLeg(pts, true)], 'pointermove'));
    const d1 = await shapeOf('d1');
    moved = moved && !!d1 && Math.hypot(d1.c[0] - d0.c[0], d1.c[1] - d0.c[1]) > 1;
  }
  putPointer(pre, reps);
  put(`${pre}.settle_ms`, 'settle_ms', 'ms', reps.map((r) => r.settle));
  put(`${pre}.moved`, 'check', '', [moved]);
}
// the glider g dragged round the unit circle (railDrag: detentAt and the dwell timer on every move)
async function pointerGliderUnit() {
  const pre = 'pointer.glider';
  const reps = [];
  let glided = true;
  for (let i = 0; i < REPS; i++) {
    await openApp(sceneState('gridCircles', { rightMode: 'image', meshN: 240 }));
    await pickTool('select');
    const g0 = await shapeOf('g');
    reps.push(legSummary([await pathLeg(await arcPts([0, 0], 1, 36, 300, 44), true)], 'pointermove'));
    const g1 = await shapeOf('g');
    glided = glided && !!g1 && g1.def && g1.def.op === 'glider' && Math.abs(g1.t - g0.t) > 0.5 && Math.abs(Math.hypot(g1.p[0], g1.p[1]) - 1) < 1e-9;
  }
  putPointer(pre, reps);
  put(`${pre}.on_circle`, 'check', '', [glided]);
}
// the hover probe on X in X -> Y (the default example): setReadouts on every pointermove
async function pointerProbeXUnit() {
  const pre = 'pointer.probe_x';
  detail(`${pre}.open`, await openApp(sceneState('default', { rightMode: 'image', meshN: 240 })));
  await pickTool('select');
  const reps = [];
  for (let i = 0; i < REPS; i++) reps.push(legSummary([await pathLeg(await sweepPts('L'))], 'pointermove'));
  putPointer(pre, reps);
}
// example 10 (Roots as preimages: targets in Y) with the deformation playing, panning Y (updateCalcChip's targetNote
// in every Y render, updateUndo in every overlay frame)
async function pointerRootsUnit() {
  const pre = 'pointer.roots_morph_pan';
  const reps = [];
  let playing = true, targets = 0;
  for (let i = 0; i < REPS; i++) {
    await openApp(sceneState('default', { rightMode: 'image', meshN: 240 }));
    await B.ev('__cmwExample(10); 1');
    await settle(await pageNow());
    const ok = await B.ev(`(() => { const b = document.getElementById('morphBtn'); if (!b) return false; if (b.getAttribute('aria-pressed') !== 'true') b.click(); ${morphPlayIf(true)} return true; })()`);
    if (!ok) throw new Error('no deformation button');
    await sleep(500);
    const st = await B.ev('__cmwState()');
    playing = playing && !!(st.morph && st.morph.playing);
    targets = st.targets;
    const r = await paneRect('R');
    const pts = Array.from({ length: 41 }, (_, k) => [r.cx - 60 + 120 * k / 40, r.cy + 30 * Math.sin(k / 40 * Math.PI)]);
    // (a pan while the deformation plays: the view never settles, so the leg's settle is not used)
    const btn = { button: 'left', buttons: 1 };
    await B.mouse('mouseMoved', pts[0][0], pts[0][1]);
    await B.mouse('mousePressed', pts[0][0], pts[0][1], Object.assign({ clickCount: 1 }, btn));
    const a = await pageNow();
    for (const [x, y] of pts.slice(1)) { const t = Date.now(); await B.mouse('mouseMoved', x, y, btn); const left = 16 - (Date.now() - t); if (left > 0) await sleep(left); }
    await B.mouse('mouseReleased', pts[40][0], pts[40][1], { button: 'left', buttons: 0, clickCount: 1 });
    const b = await pageNow();
    const w = await windowStats(a, b);
    reps.push(legSummary([Object.assign(w, { settle: 0, settleTimeout: false, jank: await jankIn(a, b) })], 'pointermove'));
  }
  putPointer(pre, reps);
  put(`${pre}.jank_ms`, 'jank_ms', 'ms', reps.map((r) => r.jank));
  put(`${pre}.playing`, 'check', '', [playing]);
  put(`${pre}.targets`, 'info', '', [targets]);
}

// SwiftShader (CPU WebGL2, the renderer of machines without a usable GPU): pan-frame p50 of the right plane for the
// quality suite's bounded golden scenes with exact images on (default) and off (__cmwSet('exactImages', false), the
// forward path). SPEC 4.7 gate: the ratio on / off <= 3 with the cost guard active. Before P2 both draws are forward
// (ratio about 1; inv_draws_on 0). Runs in its own headless Chrome (--use-angle=swiftshader).
const SS_SCENES = ['disc_cube', 'joukowski', 'annulus_log', 'poly_mobius'];
const SS_RATIO_LIMIT = 3;
// ---------------- the phone profile (CI: ci/README.md) ----------------
// A phone emulated in the same headless Chrome: a 390 x 844 CSS px mobile viewport at device pixel ratio 3 (the app's
// phone layout), touch input (one-finger drags), and the page's main thread slowed --phone-cpu times
// (Emulation.setCPUThrottlingRate; 4 is DevTools' mid-tier mobile). It approximates a phone's screen and CPU; the GPU
// stays the machine's. Every phone unit opens its own page, so the desktop units are unaffected.
const PHONE = { width: 390, height: 844, dpr: 3 };
const PHONE_CPU = Math.max(1, Number(opt('phone-cpu', '4')));
async function asPhone(fn) {
  await B.send('Emulation.setDeviceMetricsOverride', { width: PHONE.width, height: PHONE.height, deviceScaleFactor: PHONE.dpr, mobile: true });
  await B.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await B.send('Emulation.setCPUThrottlingRate', { rate: PHONE_CPU });
  try { return await fn(); } finally {
    await B.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await B.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    await B.send('Emulation.setDeviceMetricsOverride', { width: VIEW_W, height: VIEW_H, deviceScaleFactor: 1, mobile: false });
  }
}
// the plane the phone shows (the larger visible overlay): 'L' or 'R'
const phonePane = () => B.ev(`(() => { const a = (id) => { const r = document.getElementById(id).getBoundingClientRect(); const w = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0)), h = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)); return w * h; }; return a('overlayL') >= a('overlayR') ? 'L' : 'R'; })()`);
// a one-finger drag on the phone's plane by (dx, dy) px, from `from` (page px; default: centred on the plane), measured
// as dragLeg measures a mouse drag
async function touchLeg(side, dx, dy, from = null, n = 40, dt = 16) {
  const r = await paneRect(side);
  const [x0, y0] = from || [r.cx - dx / 2, r.cy - dy / 2];
  const a = await pageNow();
  await B.touchDrag(x0, y0, x0 + dx, y0 + dy, { n, dt });
  const b = await pageNow();
  const w = await windowStats(a, b);
  const s = await settle(b);
  return Object.assign(w, { settle: s.timeout ? null : Math.max(0, s.t - b), settleTimeout: s.timeout, jank: await jankIn(b + 1, s.now), a, b });
}
// opening the app: navigation start -> the first frame that drew, REPS fresh pages
async function phoneOpenUnit() {
  const first = [], settled = [];
  for (let i = 0; i < REPS; i++) {
    const o = await asPhone(async () => {
      const r = await openApp(sceneState('default', { rightMode: 'image', meshN: 240 }));
      const f = await B.ev('__perf.framesSince(0).filter((f) => f[3] > 0)');
      r.layout = await B.ev(`document.documentElement.classList.contains('ph') ? 'phone' : 'desktop'`);
      return Object.assign(r, { first: f.length ? f[0][6] : null });
    });
    first.push(o.first); settled.push(o.settled);
    detail(`phone.open.layout_${i}`, o.layout);
    put('phone.open.phone_layout', 'check', '', [o.layout === 'phone']);
  }
  put('phone.open.first_frame_ms', 'oneshot_ms', 'ms', first);
  put('phone.open.settled', 'check', '', settled);
}
// one-finger pans of the plane the phone shows, there and back (as panSide). A finger on a shape moves the shape, on
// empty space it pans: the drag starts on the empty point 2.6i above the default scene's strip |Im z| < pi/2 (the
// point stays under the finger, so the leg back starts there too)
async function phonePanUnit() {
  await asPhone(async () => {
    await openApp(sceneState('default', { rightMode: 'image', meshN: 240 }));
    const side = await phonePane();
    detail('phone.pan.side', side);
    const reps = [];
    let moved = true;
    for (let i = 0; i < REPS; i++) {
      const w0 = await B.ev(`__cmwW2S('${side}', 0, 0)`);
      const p0 = await B.ev(`__cmwW2S('${side}', 0, 2.6)`);
      const leg1 = await touchLeg(side, 120, 40, p0);
      const w1 = await B.ev(`__cmwW2S('${side}', 0, 0)`);
      const leg2 = await touchLeg(side, -120, -40, [p0[0] + 120, p0[1] + 40]);
      moved = moved && Math.abs(w1[0] - w0[0] - 120) < 6 && Math.abs(w1[1] - w0[1] - 40) < 6;
      reps.push(legSummary([leg1, leg2], 'pointermove'));
    }
    putInteraction('phone.pan', reps);
    put('phone.pan.view_moved', 'check', '', [moved]);
  });
}
// the Landscape view: one-finger orbits
async function phoneLandUnit() {
  await asPhone(async () => {
    await openApp(sceneState('default', { rightMode: 'image', meshN: 240 }));
    await B.ev(`__cmwSetMain('land'); 1`);
    await settle(await pageNow());
    const side = await phonePane();
    detail('phone.landscape.side', side);
    const reps = [];
    for (let i = 0; i < REPS; i++) reps.push(legSummary([await touchLeg(side, 140, 0), await touchLeg(side, -140, 0)], 'pointermove'));
    putInteraction('phone.landscape.orbit', reps);
  });
}
// the deformation playing (H_t at every frame) in the X -> Y view and in Landscape
async function phoneMorphUnit() {
  for (const main of ['xy', 'land']) {
    const frame = [], fps = [];
    for (let i = 0; i < REPS; i++) {
      await asPhone(async () => {
        await openApp(sceneState('default', { rightMode: 'image', meshN: 240 }));
        if (main !== 'xy') { await B.ev(`__cmwSetMain('${main}'); 1`); await settle(await pageNow()); }
        await B.ev('__cmwMorph({ open: true, playing: true }); 1');
        await sleep(800);
        const a = await pageNow();
        await sleep(2000);
        const b = await pageNow();
        const w = await windowStats(a, b);
        frame.push(quant(w.frame, 0.95));
        fps.push(w.drawn.length * 1000 / w.dur);
        await B.ev('__cmwMorph({ playing: false }); 1');
      });
    }
    put(`phone.morph.${main}.frame_p95_ms`, 'frame_ms', 'ms', frame);
    put(`phone.morph.${main}.fps`, 'throughput', 'frames/s', fps);
  }
}
// loading examples: the call -> the first frame that drew, and -> settled
const PHONE_EXAMPLES = [1, 2, 4, 7, 9, 12];
async function phoneExamplesUnit() {
  const per = new Map();
  await asPhone(async () => {
    for (let rep = 0; rep < REPS; rep++) {
      await openApp(sceneState('default', { rightMode: 'image', meshN: 240 }));
      for (const i of PHONE_EXAMPLES) {
        const a = await B.ev(`(() => { const t0 = performance.now(); __cmwExample(${i}); return t0; })()`);
        let first = null;
        for (let k = 0; k < 600 && !first; k++) {
          const f = await B.ev(`__perf.framesSince(${a}).filter((f) => f[3] > 0)`);
          if (f.length) first = f[0]; else await sleep(10);
        }
        let from = a;
        if ((await B.ev('__cmwState()')).morph?.playing) from = await B.ev(`(() => { __cmwMorph({ playing: false }); return performance.now(); })()`);
        const s = await settle(from);
        const rec = per.get(i) || { ttff: [], settle: [], ok: [] };
        rec.ttff.push(first ? first[6] - a : null); rec.settle.push(s.timeout ? null : s.t - from); rec.ok.push(!s.timeout);
        per.set(i, rec);
      }
    }
  });
  for (const [i, r] of per) {
    put(`phone.examples.${i}.first_frame_ms`, 'oneshot_ms', 'ms', r.ttff);
    put(`phone.examples.${i}.settle_ms`, 'settle_ms', 'ms', r.settle);
    put(`phone.examples.${i}.settled`, 'check', '', r.ok);
  }
}

async function swiftshaderUnit() {
  const pre = 'swiftshader.ratio';
  const reps = 1;   // one pan there and back per mode: SwiftShader frames take 50-130 ms on the suite's machine
  const main = B;
  const SS = await launch({ inject: fs.readFileSync(path.join(HERE, 'inject.js'), 'utf8'), width: VIEW_W, height: VIEW_H, dpr: 1, angle: 'swiftshader' });
  B = SS;
  try {
    await openApp(sceneState('default', { meshN: 240 }));
    const gpu = await B.ev(`(() => { const gl = __perf.gls[0]; if (!gl) return null; const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); })()`);
    detail(`${pre}.gpu`, gpu);
    detail(`${pre}.flags`, SS.flags);
    put(`${pre}.is_swiftshader`, 'check', '', [/swiftshader/i.test(gpu || '')]);
    for (const scene of SS_SCENES) {
      await openApp(sceneState(scene, { rightMode: 'image', meshN: 240 }));
      const res = {};
      for (const mode of ['on', 'off']) {
        const t0 = await pageNow();
        await B.ev(`__cmwSet('exactImages', ${mode === 'on'}); 1`);
        await settle(t0);
        if (mode === 'on') await waitInverseFrame(0, 10000);   // a pending inverse compile draws a forward stand-in
        const d0 = await invDraws();
        const rr = [];
        for (let i = 0; i < reps; i++) {
          const leg1 = await dragLeg('R', 160, 70, 'middle');
          const leg2 = await dragLeg('R', -160, -70, 'middle');
          rr.push(legSummary([leg1, leg2], 'pointermove'));
        }
        const id = `${pre}.${scene}.${mode}`;
        putPooled(`${id}.frame_p50_ms`, 'frame_ms', 'ms', rr, 'frame', 0.5, 'frame_p50');
        putPooled(`${id}.frame_p95_ms`, 'frame_ms', 'ms', rr, 'frame', 0.95, 'frame_p95');
        put(`${id}.fps`, 'throughput', 'frames/s', rr.map((x) => x.fps));
        res[mode] = { p50: pooled(rr, 'frame', 0.5), inv: (await invDraws()) - d0, frames: rr.reduce((n, x) => n + (x.frames || 0), 0) };
        // exact images on: when the app says the shape is inverse (the cost guard may demote it: then it says
        // forward), the pan must have drawn with the inverse program, or the ratio compared forward with forward
        if (mode === 'on') await inverseDrawnCheck(`${pre}.${scene}.inverse_drawn_on`, res.on.inv);
      }
      put(`${pre}.${scene}.ratio`, 'limit', 'x', [res.on.p50 / res.off.p50], { limit: SS_RATIO_LIMIT });
      put(`${pre}.${scene}.inv_draws_on`, 'info', '', [res.on.inv]);
      // the share of the measured frames drawn with the inverse program (P2 review: a ratio over frames the guard had
      // demoted compares forward with forward)
      put(`${pre}.${scene}.inv_share_on`, 'info', '', [res.on.frames ? Math.min(1, res.on.inv / res.on.frames) : null], { inv_draws: res.on.inv, frames: res.on.frames });
    }
  } finally {
    B = main;
    await SS.close();
  }
}

unit('mesh', 'CPU mesh build per shape kind (Region.buildMesh) and mesh quality', meshUnit);
for (const scene of ['default', 'logUHP', 'chain4']) {
  for (const meshN of MESHES) unit(`image.${scene}.m${meshN}`, `Image mode, ${SCENES[scene].label}, mesh ${meshN}: statics, remesh, pan L/R${meshN === 240 ? ', wheel zoom L/R' : ''}`, () => imageUnit(scene, meshN));
}
unit('phase.default', 'Phase mode: pan left and right planes', () => modeUnit('phase.default', 'default', 'color', 'pan'));
unit('landscape.default', 'Landscape: orbit', () => modeUnit('landscape.default', 'default', '3d', 'orbit'));
// iteration (#6): the default N of the Mandelbrot example in Phase (its pan L is the X -> Y view: the sphere mesh of
// the escape-test region on the CPU). (No Landscape unit: on a software renderer one orbit of it outlasts the unit's
// 180 s, which would end the shard's run; landscape.default takes 120 s there)
unit('phase.mandel', 'Phase mode, the Mandelbrot example (u_12, escape test of 64): pan left and right planes', () => modeUnit('phase.mandel', 'mandel', 'color', 'pan'));
unit('sphere.default', 'Sphere (regions): orbit', () => modeUnit('sphere.default', 'default', 'sphere', 'orbit'));
unit('sphere.logUHP', 'Sphere (regions), unbounded region: orbit', () => modeUnit('sphere.logUHP', 'logUHP', 'sphere', 'orbit'));
unit('examples', `load each of the ${N_EXAMPLES} examples: first frame, settle, memory`, examplesUnit);
unit('scrub', 'parameter scrub (phi label of a disk automorphism)', () => scrubUnit(false));
unit('scrub.morph', 'parameter scrub with the deformation open and paused (its arrows)', () => scrubUnit(true));
unit('morph.open', 'opening the deformation on examples 7 and 4 (choosing its arrows off the frame)', morphOpenUnit);
unit('morph.play.views', 'the deformation playing in the full-width Phase and Landscape panels (H_t at every frame; 60 fps budget)', morphViewsUnit);
unit('morph.play.land.max', 'issue #48: the Max mesh (1920) Landscape with All sheets while the deformation plays, sqrt then sin: the first play after a load and a second one (60 fps budget)', morphLandMaxUnit);
unit('hover.default', 'hover preimage tracking, default example', () => hoverUnit('default'));
unit('hover.cubic', 'hover preimage tracking, z^3 - 1', () => hoverUnit('cubic'));
// SPEC 12.5 (P0): exact images through infinity (the new units are NEW in the comparison until the baseline is
// re-recorded with them)
for (const scene of ['ziH', 'expH']) {
  unit(`image.${scene}.m240`, `Image mode, ${SCENES[scene].label}: statics, pan R, wheel zoom R (dpr 1)`, () => imageRUnit(`image.${scene}.m240`, scene, 1));
  unit(`image.${scene}.m240.dpr2`, `Image mode, ${SCENES[scene].label}: statics, pan R, wheel zoom R at dpr 2`, () => imageRUnit(`image.${scene}.m240.dpr2`, scene, 2));
}
// P5 (SPEC 12.5): the forward fallback's settle (SphereMesh jobs in idle slices: none over 6 ms), then pan and zoom R
// and their settles (a right-view zoom by more than 2x rebuilds the mesh)
for (const scene of ['custom_e_z1z', 'expexp_H']) unit(`image.${scene}.m240`, `Image mode, ${SCENES[scene].label}: settle, statics, pan R, wheel zoom R (dpr 1)`, () => smUnit(`image.${scene}.m240`, scene));
unit('image.disc_cube.dpr2', `Image mode, ${SCENES.disc_cube.label}: statics, pan R, wheel zoom R at dpr 2`, () => imageRUnit('image.disc_cube.dpr2', 'disc_cube', 2));
// P2 review: the opacity slider's lower settings (the compositing buffer grows with the front count K)
for (const scene of ['ziH', 'expH']) {
  for (const [a, dprs] of [[0.5, [2]], [0.3, [1, 2]]]) for (const d of dprs) {
    const id = `image.${scene}.a${Math.round(a * 100)}${d === 2 ? '.dpr2' : ''}`;
    unit(id, `Image mode, ${SCENES[scene].label} at opacity ${a}: statics, pan R, wheel zoom R (dpr ${d})`, () => imageRUnit(id, scene, d, { alpha: a }));
  }
}
unit('examples.cold', `load the examples with inverse programs (${COLD_EXAMPLES.join(', ')}) with cold inverse compiles: compile + first draw (info)`, examplesColdUnit);
unit('sphere.ziH', 'Sphere (regions), z^i of the upper half-plane: orbit', () => modeUnit('sphere.ziH', 'ziH', 'sphere', 'orbit'));
unit('sphere.globeL0', 'X Sphere at stage 0: the upper half-plane on the z-globe (exact through infinity): orbit', () => globeLUnit('sphere.globeL0', 'logUHP'));
unit('scrub.mobius_halfplane', 'scrub phi of a disk automorphism + (1+w)/(1-w) of the upper half-plane (the pole crosses the boundary): frames, no line resampling during the scrub', scrubMobiusUnit);
unit('gallery.open', 'open the examples gallery: thumbnails, compiles (no inverse compiles for side chains)', galleryUnit);
unit('hover.dim', 'hover the shape list on exp of the upper half-plane: frames, no compile, no job', hoverDimUnit);
unit('pointer.hover_point', 'wave 1 (#63): hover X with Point over a Line grid plus circles (snap and detent search)', () => pointerHoverUnit('pointer.hover_point', 'point'));
unit('pointer.hover_orth', 'wave 1 (#63): hover X with Orthogonal over a Line grid plus circles', () => pointerHoverUnit('pointer.hover_orth', 'perp'));
unit('pointer.snap_drag', 'wave 1 (#63): drag a disc by its body with Snap on across a Line grid plus circles', pointerSnapDragUnit);
unit('pointer.glider', 'wave 1 (#63): slide a glider round the unit circle among a Line grid and circles', pointerGliderUnit);
unit('pointer.probe_x', 'wave 1 (#63): the hover probe on X in X -> Y (its readout on every move)', pointerProbeXUnit);
unit('pointer.roots_morph_pan', 'wave 1 (#63): example 10 (Roots as preimages) with the deformation playing, panning Y', pointerRootsUnit);
unit('phone.open', `phone profile (${PHONE.width}x${PHONE.height} @${PHONE.dpr}x, touch, CPU / ${PHONE_CPU}): open the app, first frame`, phoneOpenUnit);
unit('phone.pan', 'phone profile: one-finger pans of the plane shown', phonePanUnit);
unit('phone.landscape', 'phone profile: Landscape, one-finger orbits', phoneLandUnit);
unit('phone.morph', 'phone profile: the deformation playing in X -> Y and Landscape', phoneMorphUnit);
unit('phone.examples', `phone profile: load examples ${PHONE_EXAMPLES.join(', ')}: first frame, settle`, phoneExamplesUnit);
unit('swiftshader.ratio', `(opt-in: --swiftshader) SwiftShader (own browser): pan R of ${SS_SCENES.join(', ')} with exact images on / off`, swiftshaderUnit, { optIn: true });

// ---------------- meta ----------------
function sha(file) { try { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 16); } catch (e) { return null; } }
function srcHash() {
  const h = crypto.createHash('sha256');
  const dir = path.join(ROOT, 'src');
  try { for (const f of fs.readdirSync(dir).sort()) h.update(f).update(fs.readFileSync(path.join(dir, f))); } catch (e) { return null; }
  return h.digest('hex').slice(0, 16);
}
async function reachable(url) {
  return new Promise((res) => {
    const req = http.get(url, (r) => { r.resume(); res(r.statusCode === 200); });
    req.on('error', () => res(false));
    req.setTimeout(3000, () => { req.destroy(); res(false); });
  });
}
// a tiny static server for dist/ (used with --serve, or when the base URL is unreachable)
function serveDist(dir = DIST) {
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.pdf': 'application/pdf' };
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const f = path.join(dir, path.normalize(u).replace(/^([/\\])+/, ''));
    if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((res) => srv.listen(0, '127.0.0.1', () => res(srv)));
}

async function main() {
  if (flag('list')) { for (const u of UNITS) console.log(u.id.padEnd(22), u.desc); return; }
  const t0 = Date.now();
  let server = null;
  // a server at BASE that serves another tree's build (the main tree's 8793 while this runs from a work copy) would
  // measure that build under this tree's name: then this tree's dist/ is served instead
  const sameBuild = async (url) => {
    try { const r = await fetch(url, { cache: 'no-store' }); const b = Buffer.from(await r.arrayBuffer()); return b.equals(fs.readFileSync(path.join(DIST, 'test.html'))); } catch (e) { return true; }
  };
  let other = false;
  if (!flag('serve') && opt('base', '') === '' && (await reachable(BASE + 'test.html')) && !(await sameBuild(BASE + 'test.html'))) other = true;
  if (flag('serve') || other || !(await reachable(BASE + 'test.html'))) {
    if (other) log(`${BASE}test.html is not this tree's dist/test.html: serving ${DIST} myself`);
    else if (!flag('serve')) log(`${BASE}test.html is not reachable: serving dist/ myself`);
    server = await serveDist();
    BASE = `http://127.0.0.1:${server.address().port}/`;
  }
  let serverA = null, BASE_A = null;
  if (AB_DIST) {
    if (!fs.existsSync(path.join(AB_DIST, 'test.html'))) throw new Error(`--ab: no test.html in ${AB_DIST}`);
    serverA = await serveDist(AB_DIST);
    BASE_A = `http://127.0.0.1:${serverA.address().port}/`;
  }
  const BASE_B = BASE;
  const inject = fs.readFileSync(path.join(HERE, 'inject.js'), 'utf8');
  B = await launch({ inject, width: VIEW_W, height: VIEW_H, dpr: 1 });
  // paired runs: the reference gets its own browser (own profile, own GPU program cache), so neither side inherits
  // the other's compiled shaders and each sees the same cold/warm sequence
  const B_B = B;
  const B_A = AB_DIST ? await launch({ inject, width: VIEW_W, height: VIEW_H, dpr: 1 }) : null;
  RES.meta = {
    suite: 'cmw-perf', version: 1, date: new Date().toISOString(), reps: REPS, quick: QUICK, only: ONLY ? String(ONLY) : null, skip: SKIP ? String(SKIP) : null,
    machine: { platform: `${os.platform()} ${os.release()}`, arch: os.arch(), cpu: (os.cpus()[0] || {}).model, cores: os.cpus().length, memGB: Math.round(os.totalmem() / 2 ** 30), loadavgStart: os.loadavg().map((x) => +x.toFixed(2)), node: process.version, host: os.hostname() },
    browser: { product: B.version.product, userAgent: B.version.userAgent, path: B.chromePath, flags: B.flags, viewport: [VIEW_W, VIEW_H], dpr: 1 },
    app: { base: BASE, distTestHtml: sha(path.join(DIST, 'test.html')), src: srcHash() },
    protocol: { quietMs: QUIET_MS, settleTimeoutMs: SETTLE_TIMEOUT, meshes: MESHES, gpuSync: '1-px gl.readPixels after every rAF callback that issued draws', drag: '40 moves x 16 ms, there and back (middle button pans, left button orbits)', wheel: '24 wheel events of deltaY 50, 16 ms apart, in then out' },
    units: {},
  };
  try {
    await openApp(sceneState('default', { meshN: 240 }));
    RES.meta.browser.gpu = await B.ev(`(() => { const gl = __perf.gls[0]; if (!gl) return null; const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); })()`);
  } catch (e) { RES.errors.push({ where: 'gpu-info', error: String(e) }); }
  // paired runs: a side's browser waits on a blank page while the other side measures, so nothing it left running (a
  // deformation still playing, a refinement) competes with the other side for the GPU and CPU (every unit opens the
  // app itself)
  const park = async (br) => { try { await br.nav('about:blank'); } catch (e) { /* the next unit's openApp navigates anyway */ } };
  if (B_A) {
    // the same warm-up page on the reference browser, so both start from the same state
    try { B = B_A; BASE = BASE_A; await openApp(sceneState('default', { meshN: 240 })); } catch (e) { RES.errors.push({ where: 'ref-warmup', error: String(e) }); }
    B = B_B; BASE = BASE_B;
    await park(B_A); await park(B_B);
  }
  RES.meta.loadMax = LOAD_MAX;
  RES.meta.busyUnits = [];
  RES.meta.optInSkipped = [];
  const RES_B = RES;
  let RES_A = null;
  if (AB_DIST) {
    RES_A = { meta: JSON.parse(JSON.stringify(RES.meta)), metrics: {}, details: {}, errors: [] };
    RES_A.meta.app = { base: BASE_A, distTestHtml: sha(path.join(AB_DIST, 'test.html')), src: null, reference: AB_DIST };
    RES_A.meta.paired = 'reference'; RES_B.meta.paired = 'current';
  }
  const writeAll = () => {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(RES_B, null, 1));
    if (RES_A) fs.writeFileSync(abOut(), JSON.stringify(RES_A, null, 1));
  };
  for (const u of UNITS) {
    if (ONLY && !ONLY.test(u.id)) continue;
    if (SKIP && SKIP.test(u.id)) continue;
    if (QUICK && !ONLY && !QUICK_UNITS.has(u.id)) continue;
    if (u.optIn && !WITH_OPT_IN && !ONLY) { RES.meta.optInSkipped.push(u.id); continue; }
    // wait for a quiet machine (other agents, builds, a second headless browser make every timing meaningless)
    const tw = Date.now();
    while (os.loadavg()[0] > LOAD_MAX && Date.now() - tw < LOAD_WAIT_S * 1000) await sleep(3000);
    const load = +os.loadavg()[0].toFixed(2);
    if (load > LOAD_MAX) {
      if (REQUIRE_QUIET) {
        log(`machine busy (1-min load ${load} > ${LOAD_MAX}) before ${u.id}: aborting (--require-quiet)`);
        await B.close();
        if (server) server.close();
        process.exit(3);
      }
      log(`WARNING: machine busy (1-min load ${load} > ${LOAD_MAX}) before ${u.id}: its timings are not trustworthy`);
      RES.meta.busyUnits.push({ unit: u.id, load });
    }
    const scenes = new Map(), failed = new Map();
    const sides = !RES_A ? [[RES_B, BASE_B, '', B_B]] : (refFirst(u.id) ? [[RES_A, BASE_A, ' (reference)', B_A], [RES_B, BASE_B, ' (current)', B_B]] : [[RES_B, BASE_B, ' (current)', B_B], [RES_A, BASE_A, ' (reference)', B_A]]);
    for (const [res, base, tag, br] of sides) {
      RES = res; BASE = base; B = br;
      const tu = Date.now();
      log(u.id + tag);
      CURRENT_UNIT = u.id;
      let timer = null;
      const timeout = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(`unit timed out after ${UNIT_TIMEOUT_S} s (machine stalled?)`)), UNIT_TIMEOUT_S * 1000); });
      OPENED = []; scenes.set(res, OPENED);
      try { await Promise.race([u.fn(), timeout]); } catch (e) {
        failed.set(res, String(e && e.message || e));
        RES.errors.push({ where: u.id, error: String(e && e.stack || e) });
        log('ERROR in', u.id + tag, e && e.stack || e);
        if (/timed out after/.test(String(e))) {
          // a stalled machine: the timings of this run are worthless, and the unit may still be driving the browser
          RES.meta.units[u.id] = Math.round((Date.now() - tu) / 100) / 10;
          RES_B.meta.aborted = `${u.id}${tag}: ${e.message}`;
          writeAll();
          log(`aborting the run; partial results in ${OUT}`);
          for (const b of [B_A, B_B]) { try { if (b) await b.close(); } catch (e2) { /* ignore */ } }
          if (server) server.close();
          if (serverA) serverA.close();
          process.exit(4);
        }
      } finally { clearTimeout(timer); }
      RES.meta.units[u.id] = Math.round((Date.now() - tu) / 100) / 10;
      if (RES_A) await park(br);
    }
    OPENED = null;
    RES = RES_B; BASE = BASE_B; B = B_B;
    // [#292] a unit the reference cannot run (it lacks the feature the unit measures): its reference metrics say so, and
    // compare_perf.py reports the unit's metrics as NEW instead of comparing them with an empty scene's
    if (RES_A) {
      const why = refCannot(scenes.get(RES_A) || [], scenes.get(RES_B) || [], failed.get(RES_A), failed.get(RES_B));
      if (why) {
        log(`${u.id}: the reference cannot run it (${why}): NEW, not compared`);
        (RES_A.meta.refUnsupported || (RES_A.meta.refUnsupported = {}))[u.id] = why;
        for (const m of Object.values(RES_A.metrics)) if (m.unit_id === u.id) m.ref_unsupported = why;
      }
    }
  }
  CURRENT_UNIT = null;
  for (const [b, res] of [[B_B, RES_B], [B_A, RES_A]]) {
    if (!b) continue;
    const exc = b.logs().filter((l) => l.t === 'EXC');
    if (exc.length) res.errors.push({ where: 'page', exc: exc.slice(0, 5) });
  }
  for (const res of RES_A ? [RES_A, RES_B] : [RES_B]) {
    RES = res;
    put('suite.no_errors', 'check', '', [RES.errors.length === 0]);
    RES.meta.seconds = Math.round((Date.now() - t0) / 100) / 10;
    RES.meta.machine.loadavgEnd = os.loadavg().map((x) => +x.toFixed(2));
  }
  RES = RES_B;
  await B_B.close();
  if (B_A) await B_A.close();
  if (server) server.close();
  if (serverA) serverA.close();
  writeAll();
  log(`wrote ${OUT}: ${Object.keys(RES_B.metrics).length} metrics in ${RES_B.meta.seconds} s, ${RES_B.errors.length} errors`);
  if (RES_A) log(`wrote ${abOut()} (reference): ${Object.keys(RES_A.metrics).length} metrics, ${RES_A.errors.length} errors`);
}

if (require.main === module) {
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => { try { if (B) await B.close(); } catch (e) { /* ignore */ } process.exit(130); });
  main().catch(async (e) => { console.error(e); try { if (B) await B.close(); } catch (x) { /* ignore */ } process.exit(2); });
}
// for perf/selftest.js: the runner's own helpers, driven against a browser it launched
module.exports = {
  use(browser, base) { B = browser; if (base) BASE = base.endsWith('/') ? base : base + '/'; },
  RES, settle, compileStats, waitInverseFrame, inverseDrawnCheck, openApp, paneShot, shotAtRest, dragLeg, pageNow, UNITS, INV_FIRST_DRAW_LIMIT,
};
