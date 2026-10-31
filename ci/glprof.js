'use strict';
// Shader program link times on this machine (issue #72): the app's ?glprof (GLR.profile()) through a fixed walk of the
// app, cold (a fresh profile, the GPU program cache empty) and then warm (the same profile again: Chrome's program
// cache), on the machine's own GPU and ANGLE back end (Direct3D 11 on Windows, Metal on the Mac). The GPU gate runs it
// on its machines (gpu-gate.yml, mode glprof); any machine can run it.
//   node ci/glprof.js [--no-build] [--ref REF] [--variant unroll] [--rounds N] [--clear-metal-cache] [--walk all|quick|extended|mountain|steps] [--step-timeout S] [--out FILE] [--cache DIR]
// --ref: the build of another commit too (ci/reference.js), the two sides in turn, current, reference, reference,
// current, ... (--rounds N: N pairs, default 2), each a cold and a warm pass: whatever the machine keeps between runs
// falls on both sides alike. --clear-metal-cache (macOS): before each cold pass, empty the Metal shader cache macOS keeps
// for Chrome outside its profile (see metalCaches); without it a fresh profile is not cold on the Mac (#237).
// The walk: every example's first frame (until __cmwExample says there is no such example) (exact images are on by default: their inverse programs too); then on the
// first example, the views (Phase, Landscape, both Spheres) and the deformation. --walk extended (#238's Windows list)
// adds: the deformation of the All sheets and Γ/ζ examples, the series examples (a Σ step, a power series), the gallery
// opened (its thumbnails' time), the Mountain King in the Landscape, and on every pass the first minute from the page's load (the start-up bar shown, the
// links pending, the page's long tasks, when the default example's exact image was first drawn). --walk mountain: after
// the start only the Mountain King (#395, #355): its first frame, its Landscape and its deformation. --walk steps (#439): the steps view (stepsWalk). --variant unroll (#238 item 3): a
// second side, this build with the loop guards of #206 stripped (max(N, uNoUnroll) -> N, K * uIxOne -> K), so FXC sees
// constant trip counts again: the unrolling hypothesis measured on one machine, the sides in turn (#196's uniform series
// bounds are not undone by it). Each step waits until every link it started has landed (or --step-timeout, default
// 1200 s: on Direct3D 11 one program has taken 12 minutes). Prints the programs by their cold time-share (links run in
// parallel: a link's own cost, about; see share below), to the job summary and the log, and writes FILE
// (default .ci/glprof/glprof.json): per pass, per step, per program {name, key, mode, inv, vs, fs, ms, by}.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { ROOT, PY, serve, summary, run, esc } = require('./lib');
const { buildReference } = require('./reference');
const { launch, sleep } = require('../test/regress/perf/cdp');

const argv = process.argv.slice(2);
const opt = (name, def) => { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : def; };
const flag = (name) => argv.includes('--' + name);
const OUT = path.resolve(opt('out', path.join(ROOT, '.ci', 'glprof', 'glprof.json')));
const CACHE = path.resolve(opt('cache', path.join(os.tmpdir(), 'cmw-glprof-profile')));
const STEP_S = Number(opt('step-timeout', '1200'));
const WALK = opt('walk', 'all'), QUICK = WALK === 'quick', EXTENDED = WALK === 'extended', MOUNTAIN = WALK === 'mountain', STEPS = WALK === 'steps';
if (!['all', 'quick', 'extended', 'mountain', 'steps'].includes(WALK)) throw new Error(`--walk ${WALK}: all, quick, extended, mountain or steps`);
const REF = opt('ref', '');
const VARIANT = opt('variant', '');
if (VARIANT && VARIANT !== 'unroll') throw new Error(`--variant ${VARIANT}: only unroll`);
if (VARIANT && REF) throw new Error('--variant and --ref: one second side at a time');
// (a variant: one round by default, the sides in turn once: a Windows side is about 50 minutes, the job has 300, #369)
const ROUNDS = Math.max(1, Number(opt('rounds', REF ? '2' : '1')) || 1);
const CLEAR_METAL = flag('clear-metal-cache') && process.platform === 'darwin';


// the walk after the examples: [label, the page's statement]
function walk() {
  const s = [['example 0 again', '__cmwExample(0)']];
  s.push(['Phase', "__cmwSetMain('phase')"], ['Landscape', "__cmwSetMain('land')"], ['X → Y', "__cmwSetMain('xy')"]);
  s.push(['Sphere (Y)', "__cmwSetView('R', 'sphere')"], ['Sphere (X)', "__cmwSetView('L', 'sphere')"]);
  s.push(['planes', "__cmwSetView('R', 'plane'); __cmwSetView('L', 'plane')"]);
  s.push(['deformation', '__cmwMorph({ open: true, T: 0.5 })'], ['deformation closed', '__cmwMorph({ open: false })']);
  return s;
}

// --walk extended: the examples by their English names in src/app/15-examples-guide.js (their indices move as examples
// are added), each opened, then deformed and closed again; [label, statement, false, {until, measure}]: until, a
// condition polled from the statement on (its time is the step's firstS); measure, read once the links have landed
function exampleIndex(name) {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'app', '15-examples-guide.js'), 'utf8');
  const names = [...src.matchAll(/\bname: \$t\('((?:[^'\\]|\\.)*)'\)/g)].map((m) => m[1].replace(/\\'/g, "'"));
  return names.indexOf(name);
}
// (#238 item 2: the All sheets and the Γ/ζ examples deformed; item 3: a Σ step and a power series)
const EXTENDED_EXAMPLES = ['Sheets of the logarithm', 'Zeros of the zeta function', 'Poles of the Gamma function', 'Zeta as a Dirichlet series', 'Partial sums of the exponential', 'The dilogarithm from its series'];
// (#395, #355) the Mountain King: its first frame (mode 0, colour), its Landscape (landTF and landEdgeS of mode 0) and
// its deformation (mode 1, colour)
const MOUNTAIN_KING = 'In the Hall of the Mountain King';
function mountainKing(landscapeOnly) {
  const i = exampleIndex(MOUNTAIN_KING);
  if (i < 0) throw new Error(`no example named ${MOUNTAIN_KING}`);
  const s = [[`${MOUNTAIN_KING} (example ${i})`, `__cmwExample(${i})`, false, null],
    [`${MOUNTAIN_KING}: Landscape`, "__cmwSetMain('land')", false, null], [`${MOUNTAIN_KING}: Landscape closed`, "__cmwSetMain('xy')", false, null]];
  if (!landscapeOnly) s.push([`${MOUNTAIN_KING}: deformation`, '__cmwMorph({ open: true, T: 0.5 })', false, null], [`${MOUNTAIN_KING}: deformation closed`, '__cmwMorph({ open: false })', false, null]);
  return s;
}
// --walk steps (#439): the steps view (?view=steps) on Strip to disk, the zeros of zeta and the Mountain King: a
// glide over a step from z (the carried colour while gliding, map mode 1), a quarter-step scrub back, parked between two
// planes (Shift+←: a two-plane chain is at its last plane after the glide; tiers' review of #456), and the colour plane set to z, then a glide to the plane after it (the carried colour at rest past the
// colour plane): the carry, mesh, region and line programs a glide links. The keys are the view's own (svKeys)
const svKey = (key, shift) => `(document.dispatchEvent(new KeyboardEvent('keydown', { key: '${key}', shiftKey: ${!!shift}, bubbles: true })), true)`;
function stepsWalk() {
  const s = [];
  for (const nm of ['Strip to disk', 'Zeros of the zeta function', MOUNTAIN_KING]) {
    const i = exampleIndex(nm);
    if (i < 0) { console.log(`[glprof] no example named ${nm}: skipped`); continue; }
    const tag = `${nm} (example ${i})`;
    s.push([`steps: ${tag}`, `(__cmwExample(${i}), ${svKey('PageUp')}, ${svKey('PageUp')}, ${svKey('PageUp')})`, false, null]);
    s.push([`steps: ${tag}: glide to the next plane`, svKey('PageDown'), false, null]);
    s.push([`steps: ${tag}: scrub a quarter step back`, svKey('ArrowLeft', true), false, null]);
    s.push([`steps: ${tag}: back to z`, `(${svKey('PageUp')}, ${svKey('PageUp')})`, false, null]);
    s.push([`steps: ${tag}: colour from z`, svKey('c'), false, null]);
    s.push([`steps: ${tag}: the next plane, past the colour plane`, svKey('PageDown'), false, null]);
  }
  return s;
}
function extended() {
  const s = [];
  for (const nm of EXTENDED_EXAMPLES) {
    const i = exampleIndex(nm);
    if (i < 0) { console.log(`[glprof] no example named ${nm}: skipped`); continue; }
    s.push([`${nm} (example ${i})`, `__cmwExample(${i})`, false, null]);
    s.push([`${nm}: deformation`, '__cmwMorph({ open: true, T: 0.5 })', false, null], [`${nm}: deformation closed`, '__cmwMorph({ open: false })', false, null]);
  }
  // (#395: the Mountain King in the Landscape; its deformation is in the examples' walk already)
  s.push(...mountainKing(true));
  // (item 5: the gallery opened: until every example's thumbnail is drawn, and how many were)
  s.push(['the gallery opened', "(document.getElementById('examplesBtn').click(), true)", false,
    { until: "(() => { const it = [...document.querySelectorAll('.ex-item')]; return it.length > 0 && it.every((e) => { const g = e.querySelector('img, canvas'); return !g || (g.tagName === 'IMG' ? !!g.getAttribute('src') : g.width > 0); }); })()",
      measure: "(() => { const it = [...document.querySelectorAll('.ex-item')]; return { items: it.length, drawn: it.filter((e) => { const g = e.querySelector('img'); return !!(g && g.getAttribute('src')); }).length }; })()" }]);
  s.push(['the gallery closed', "(document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })), true)", false, null]);
  return s;
}
// (#238 items 8 and 4) from the page's first script on: the start-up bar's visibility, the links pending and the long
// tasks, every 100 ms for 60 s, read with the start step; and when the right pane first drew its exact image (the
// default example has exact images on: their inverse programs, cold on the cold pass) with nothing pending
const STARTUP = `(() => {
  const t0 = performance.now(), lt = [], tl = [];
  let exactMs = null;
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) lt.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: true }); } catch (e) { /* none */ }
  const tick = () => {
    const b = document.getElementById('warmBar'), G = window.GLR;
    tl.push([Math.round(performance.now() - t0), b ? (b.hidden ? 0 : 1) : -1, G && typeof G.pendingLinks === 'number' ? G.pendingLinks : -1]);
    if (exactMs == null) { try { const p = window.__cmwPaneStatus && window.__cmwPaneStatus('R'); if (p && !p.pending && !p.compiling && !p.exact && G && G.pendingLinks === 0) exactMs = Math.round(performance.now() - t0); } catch (e) { /* not yet */ } }
    if (performance.now() - t0 < 60000) setTimeout(tick, 100);
  };
  setTimeout(tick, 0);
  window.__gpStartup = () => {
    const on = tl.filter((x) => x[1] === 1);
    return { exactDrawnMs: exactMs, barFirstMs: on.length ? on[0][0] : null, barLastMs: on.length ? on[on.length - 1][0] : null, barShownMs: on.length * 100, pendingMax: Math.max(0, ...tl.map((x) => x[2])),
      longTasks: lt.length, longMax: Math.max(0, ...lt.map((x) => x[1])), longOver200: lt.filter((x) => x[1] > 200).length, samples: tl.length };
  };
})();`;

async function pass(name, base, tag) {
  const B = await launch(EXTENDED ? { cache: CACHE, inject: STARTUP } : { cache: CACHE });
  const out = { pass: name, renderer: '', steps: [] };
  try {
    await B.nav(`${base}test.html?glprof${STEPS ? '&view=steps' : ''}&ns=glprof${Date.now()}`);
    await B.until('typeof GLR === "object" && typeof GLR.profile === "function" && typeof __cmwExample === "function"', 120000);
    out.renderer = await B.ev(`(() => { const g = document.createElement('canvas').getContext('webgl2'), x = g && g.getExtension('WEBGL_debug_renderer_info'); return x ? g.getParameter(x.UNMASKED_RENDERER_WEBGL) : ''; })()`);
    let seen = 0;
    // a step's links start with its first draws (about a second after it): at least 2.5 s, then 1.5 s with none open
    const settle = async (label) => {
      const t0 = Date.now();
      let quiet = 0;
      for (;;) {
        const r = await B.ev('GLR.profile()');
        const open = r.slice(seen).filter((x) => x.ms === null).length;
        if (!open && Date.now() - t0 > 2500) quiet++; else quiet = 0;
        if (quiet >= 6) { const recs = r.slice(seen); seen = r.length; return { label, s: (Date.now() - t0) / 1000, programs: recs }; }
        if (Date.now() - t0 > STEP_S * 1000) { const recs = r.slice(seen); seen = r.length; return { label, s: (Date.now() - t0) / 1000, timedOut: true, programs: recs }; }
        await sleep(250);
      }
    };
    out.steps.push(await settle('start (the default example)'));
    if (EXTENDED) { await sleep(Math.max(0, 61000 - out.steps[0].s * 1000)); out.steps[0].measure = await B.ev('window.__gpStartup ? __gpStartup() : null'); }
    const steps = [];
    // (--walk mountain: only the Mountain King after the start, a few minutes even on WARP)
    if (!MOUNTAIN && !STEPS) for (let i = 0; i < (QUICK ? 3 : 200); i++) steps.push([`example ${i}`, `__cmwExample(${i})`, true]);
    let exDone = false;
    for (const [label, js, ex, x] of (MOUNTAIN ? mountainKing(false) : STEPS ? stepsWalk() : [...steps, ...walk(), ...(EXTENDED ? extended() : [])])) {
      if (ex && exDone) continue;
      // (__cmwExample is false past the last example: the examples are done)
      const t1 = Date.now();
      const r = await B.ev(`(() => { try { const r = ${js}; return r !== false; } catch (e) { return false; } })()`);
      if (!r) { if (ex) { exDone = true; continue; } throw new Error('step failed: ' + label); }
      let firstS;
      if (x && x.until) {
        for (;;) {
          if (await B.ev(`(() => { try { return !!${x.until}; } catch (e) { return false; } })()`)) { firstS = (Date.now() - t1) / 1000; break; }
          if (Date.now() - t1 > STEP_S * 1000) { firstS = null; break; }
          await sleep(100);
        }
      }
      const st = await settle(label);
      if (x && x.until) st.firstS = firstS;
      if (x && x.measure) st.measure = await B.ev(`(() => { try { return ${x.measure}; } catch (e) { return String(e); } })()`);
      out.steps.push(st);
      const ms = st.programs.reduce((a, p) => a + Math.max(0, p.ms || 0), 0);
      console.log(`[glprof] ${tag}${name} ${label}: ${st.programs.length} links, ${(ms / 1000).toFixed(1)} s of link time, ${st.s.toFixed(1)} s wall${st.timedOut ? ' (TIMED OUT)' : ''}`);
    }
  } finally { await B.close(); }
  return out;
}

// --variant unroll: a copy of dist whose shader sources have the loop guards stripped, so every guarded loop has a
// constant trip count again (the app is otherwise the same); says how many it stripped
function unrolledDist(dist) {
  const out = path.join(os.tmpdir(), 'cmw-glprof-unrolled');
  fs.rmSync(out, { recursive: true, force: true });
  fs.cpSync(dist, out, { recursive: true });
  let n = 0;
  for (const f of fs.readdirSync(out).filter((x) => /\.(js|html)$/.test(x))) {
    const p = path.join(out, f), a = fs.readFileSync(p, 'utf8');
    const b = a.replace(/max\(\s*([^,()]+?(?:\([^()]*\))?)\s*,\s*uNoUnroll\s*\)/g, (m, x) => { n++; return x; }).replace(/\s*\*\s*uIxOne\b/g, () => { n++; return ''; });
    if (b !== a) fs.writeFileSync(p, b);
  }
  console.log(`[glprof] --variant unroll: ${n} loop guards stripped in ${out}`);
  if (!n) throw new Error('--variant unroll: no loop guard found to strip');
  return out;
}

// macOS keeps the Metal shaders it compiled for a process in the user's cache folder (getconf DARWIN_USER_CACHE_DIR),
// outside Chrome's profile: under com.apple.metal/<process>/ and <process>/com.apple.metal/. Chrome's are the ones
// whose process names Chrome (its GPU process is a Chrome helper); -> [{ dir, kb }]
const du = (d) => { let n = 0; try { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); n += e.isDirectory() ? du(f) : e.isFile() ? fs.statSync(f).size : 0; } } catch (e) { /* gone */ } return n; };
const ls = (d) => { try { return fs.readdirSync(d); } catch (e) { return []; } };
function userCacheDir() {
  if (process.platform !== 'darwin') return '';
  try { return execFileSync('getconf', ['DARWIN_USER_CACHE_DIR'], { encoding: 'utf8' }).trim(); } catch (e) { return ''; }
}
function metalCaches() {
  const C = userCacheDir(), out = [];
  if (!C) return out;
  for (const x of ls(path.join(C, 'com.apple.metal'))) if (/chrom/i.test(x)) out.push(path.join(C, 'com.apple.metal', x));
  for (const x of ls(C)) if (/chrom/i.test(x)) for (const y of ls(path.join(C, x))) if (/^com\.apple\.metal/.test(y)) out.push(path.join(C, x, y));
  return out.map((dir) => ({ dir, kb: Math.round(du(dir) / 1024) }));
}
// empties Chrome's Metal caches (only those folders), saying what it removed; when there is none, what the cache folder
// holds that could be one (Metal's folders and Chrome's), so the right one can be found
function clearMetal() {
  const C = userCacheDir();
  if (!C) { console.log('[glprof] no user cache folder (getconf DARWIN_USER_CACHE_DIR): nothing cleared'); return; }
  const found = metalCaches();
  for (const { dir, kb } of found) { fs.rmSync(dir, { recursive: true, force: true }); console.log(`[glprof] removed Chrome's Metal cache ${dir} (${kb} KB)`); }
  if (!found.length) {
    const near = ls(C).filter((x) => /metal|chrom/i.test(x)).map((x) => x + (/metal/i.test(x) ? ` [${ls(path.join(C, x)).join(', ')}]` : ''));
    console.log(`[glprof] no Chrome Metal cache under ${C}; there: ${near.join('; ') || 'nothing named metal or chrome'}`);
  }
}

// each link's time-share of the GPU process and its peers, within its pass: links run in parallel and share the GPU
// process, so a link's ms (start to done) includes the time it queued behind the others. share: the integral over its
// span of 1 / (links open), an estimate of its own cost; peers: the most links open with it at once
function shares(p) {
  const all = p.steps.flatMap((s) => s.programs).filter((x) => x.ms > 0);
  const ev = all.flatMap((x) => [[x.t0, 1], [x.t0 + x.ms, -1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  for (const x of all) {
    const t1 = x.t0 + x.ms;
    let n = 0, t = -Infinity, share = 0, peers = 1;
    for (const [te, d] of ev) {
      if (te > x.t0 && t < t1) { const a = Math.max(t, x.t0), b = Math.min(te, t1); if (b > a && n > 0) share += (b - a) / n; }
      n += d; t = te;
      if (te >= x.t0 && te < t1) peers = Math.max(peers, n);
    }
    x.share = share; x.peers = peers;
  }
}
const flat = (p) => p.steps.flatMap((s) => s.programs.map((x) => Object.assign({ step: s.label }, x)));
const key = (x) => `${x.name}|${x.key}|${x.mode}`;
const sec = (a) => a.reduce((s, x) => s + Math.max(0, x || 0), 0) / 1000;
// a pass in numbers: links, link time and time-shared link time (s)
const totals = (p) => { const a = flat(p); return { links: a.length, s: sec(a.map((x) => x.ms)), share: sec(a.map((x) => x.share)) }; };
const mean = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);

(async () => {
  if (!flag('no-build') && run(PY, ['build.py'])) process.exit(2);
  const sides = [{ side: 'current', dist: path.join(ROOT, 'dist') }];
  if (REF) { const R = buildReference(REF); sides.push({ side: `reference ${R.sha.slice(0, 12)}`, dist: R.dist, sha: R.sha }); }
  if (VARIANT === 'unroll') sides.push({ side: 'unrolled (#206 guards stripped)', dist: unrolledDist(path.join(ROOT, 'dist')) });
  for (const s of sides) Object.assign(s, await serve(s.dist));
  const order = [];
  for (let r = 0; r < ROUNDS; r++) order.push(...(r % 2 ? sides.slice().reverse() : sides));
  const runs = [];
  for (const [i, s] of order.entries()) {
    const tag = order.length > 1 ? `run ${i + 1} (${s.side}) ` : '';
    fs.rmSync(CACHE, { recursive: true, force: true });   // cold: nothing cached
    if (CLEAR_METAL) clearMetal();
    const cold = await pass('cold', s.base, tag);
    if (CLEAR_METAL) console.log(`[glprof] after the cold pass, Chrome's Metal cache: ${metalCaches().map((c) => `${c.dir} (${c.kb} KB)`).join(', ') || 'none found'}`);
    const warm = await pass('warm', s.base, tag);
    shares(cold); shares(warm);
    runs.push({ run: i + 1, side: s.side, cold, warm });
  }
  for (const s of sides) s.server.close();
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ when: new Date().toISOString(), machine: `${os.platform()} ${os.cpus()[0].model}`, reference: sides[1] ? sides[1].sha || sides[1].side : null, walk: WALK, clearMetal: CLEAR_METAL, runs }, null, 1));
  const lines = [`### Shader link times (${runs[0].cold.renderer || 'unknown renderer'})`, ''];
  if (runs.length > 1) {
    // every run, then each side's mean (the sides in turn: current, reference, reference, current, ...)
    lines.push(`${runs.length} runs, the sides in turn${CLEAR_METAL ? ", Chrome's Metal cache emptied before each cold pass" : ''}. Link time in s (time-shared in brackets).`, '',
      '| run | side | links | cold | warm |', '|---|---|---|---|---|');
    for (const r of runs) { const c = totals(r.cold), w = totals(r.warm); lines.push(`| ${r.run} | ${r.side} | ${c.links} | ${c.s.toFixed(1)} (${c.share.toFixed(1)}) | ${w.s.toFixed(1)} (${w.share.toFixed(1)}) |`); }
    lines.push('', '| side | cold time-shared: mean (min-max) | warm time-shared: mean (min-max) |', '|---|---|---|');
    const by = sides.map((s) => {
      const rs = runs.filter((r) => r.side === s.side), c = rs.map((r) => totals(r.cold).share), w = rs.map((r) => totals(r.warm).share);
      lines.push(`| ${s.side} | ${mean(c).toFixed(2)} (${Math.min(...c).toFixed(2)}-${Math.max(...c).toFixed(2)}) | ${mean(w).toFixed(2)} (${Math.min(...w).toFixed(2)}-${Math.max(...w).toFixed(2)}) |`);
      return { c: mean(c), w: mean(w) };
    });
    if (by.length > 1) {
      const pct = (a, b) => (b > 0 ? `${a >= b ? '+' : ''}${((a / b - 1) * 100).toFixed(0)} %` : '-');
      lines.push('', `Current against the reference, time-shared: cold ${pct(by[0].c, by[1].c)}, warm ${pct(by[0].w, by[1].w)}.`);
      // the programs, each side's mean cold time-share per run (a program linked twice in a pass counts twice)
      const per = sides.map((s) => {
        const rs = runs.filter((r) => r.side === s.side), m = new Map();
        for (const r of rs) for (const x of flat(r.cold)) { const k = key(x); if (!m.has(k)) m.set(k, { x, ms: 0 }); m.get(k).ms += (x.share || 0) / rs.length; }
        return m;
      });
      const ks = [...new Set([...per[0].keys(), ...per[1].keys()])];
      const got = (m, k) => (m.has(k) ? m.get(k).ms : null);
      const s2 = (v) => (v == null ? '' : (v / 1000).toFixed(2));
      const rows = ks.map((k) => ({ k, x: (per[0].get(k) || per[1].get(k)).x, a: got(per[0], k), b: got(per[1], k) }))
        .sort((p, q) => Math.max(q.a || 0, q.b || 0) - Math.max(p.a || 0, p.b || 0)).slice(0, 25);
      lines.push('', '| program | mode | current: cold share s | reference: cold share s |', '|---|---|---|---|');
      for (const r of rows) lines.push(`| ${r.x.inv ? 'inverse ' : ''}${r.x.name} \`${esc(r.x.key)}\` | ${r.x.mode} | ${s2(r.a)} | ${s2(r.b)} |`);
    }
    lines.push('', `The current build's run ${runs[0].run}:`, '');
  }
  // the programs by cold time-share, with their warm time (matched by name, chain key and mode, in order)
  const { cold, warm } = runs[0];
  const warmBy = new Map();
  for (const x of flat(warm)) { if (!warmBy.has(key(x))) warmBy.set(key(x), []); warmBy.get(key(x)).push(x); }
  const rows = flat(cold).map((x) => { const w = (warmBy.get(key(x)) || []).shift(); return { ...x, warm: w ? w.ms : null, wshare: w ? w.share : null }; }).sort((a, b) => (b.share || 0) - (a.share || 0));
  lines.push(`${rows.length} links. Link time in all: cold ${sec(rows.map((r) => r.ms)).toFixed(1)} s (time-shared ${sec(rows.map((r) => r.share)).toFixed(1)} s), warm ${sec(rows.map((r) => r.warm)).toFixed(1)} s (time-shared ${sec(rows.map((r) => r.wshare)).toFixed(1)} s).`, '',
    'cold s: start to done (queueing included); share: its time-share of the GPU process (its own cost, about); peers: the most links open with it.', '',
    '| cold s | share s | peers | warm s | warm share s | program | mode | source (vs + fs) | first in |', '|---|---|---|---|---|---|---|---|---|');
  const s2 = (v) => (v == null ? '' : (v / 1000).toFixed(2));
  for (const r of rows.slice(0, 30)) lines.push(`| ${s2(r.ms || 0)} | ${s2(r.share)} | ${r.peers || ''} | ${s2(r.warm)} | ${s2(r.wshare)} | ${r.inv ? 'inverse ' : ''}${r.name} \`${r.key}\` | ${r.mode} | ${r.vs} + ${r.fs} | ${r.step} |`);
  lines.push('', '| step | cold: links, wall s | warm: links, wall s |', '|---|---|---|');
  cold.steps.forEach((s, i) => { const w = warm.steps[i] || { programs: [], s: 0 }; lines.push(`| ${s.label}${s.timedOut ? ' (timed out)' : ''} | ${s.programs.length}, ${s.s.toFixed(1)} | ${w.programs.length}, ${w.s.toFixed(1)} |`); });
  // (--walk extended: the timed steps and the measurements, cold and warm)
  const timed = cold.steps.map((s, i) => [s, warm.steps[i] || {}]).filter(([s]) => s.firstS !== undefined || s.measure !== undefined);
  if (timed.length) {
    lines.push('', '| step | cold: first s, measured | warm: first s, measured |', '|---|---|---|');
    const f = (s) => `${s.firstS === undefined ? '' : s.firstS === null ? 'timed out' : s.firstS.toFixed(1)}${s.measure !== undefined ? ' ' + esc(JSON.stringify(s.measure)) : ''}`;
    for (const [c, w] of timed) lines.push(`| ${c.label} | ${f(c)} | ${f(w)} |`);
  }
  const md = lines.join('\n') + '\n';
  summary(md);
  console.log(md);   // (the job log too: the summary and the artifact are out of reach of some readers)
  console.log(`[glprof] wrote ${path.relative(ROOT, OUT)}`);
})().catch((e) => { console.error(e); process.exit(2); });
