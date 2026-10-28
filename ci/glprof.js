'use strict';
// Shader program link times on this machine (issue #72): the app's ?glprof (GLR.profile()) through a fixed walk of the
// app, cold (a fresh profile, the GPU program cache empty) and then warm (the same profile again: Chrome's program
// cache), on the machine's own GPU and ANGLE back end (Direct3D 11 on Windows, Metal on the Mac). The GPU gate runs it
// on its machines (gpu-gate.yml, mode glprof); any machine can run it.
//   node ci/glprof.js [--no-build] [--walk all|quick] [--step-timeout S] [--out FILE] [--cache DIR]
// The walk: every example's first frame (exact images are on by default: their inverse programs too); then on the
// first example, the views (Phase, Landscape, both Spheres) and the deformation. Each step waits until every link it started has landed (or --step-timeout, default
// 1200 s: on Direct3D 11 one program has taken 12 minutes). Prints the programs by cold link time and writes FILE
// (default .ci/glprof/glprof.json): per pass, per step, per program {name, key, mode, inv, vs, fs, ms, by}.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ROOT, PY, serve, summary, run } = require('./lib');
const { launch, sleep } = require('../test/regress/perf/cdp');

const argv = process.argv.slice(2);
const opt = (name, def) => { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : def; };
const flag = (name) => argv.includes('--' + name);
const OUT = path.resolve(opt('out', path.join(ROOT, '.ci', 'glprof', 'glprof.json')));
const CACHE = path.resolve(opt('cache', path.join(os.tmpdir(), 'cmw-glprof-profile')));
const STEP_S = Number(opt('step-timeout', '1200'));
const QUICK = opt('walk', 'all') === 'quick';


// the walk after the examples: [label, the page's statement]
function walk() {
  const s = [['example 0 again', '__cmwExample(0)']];
  s.push(['Phase', "__cmwSetMain('phase')"], ['Landscape', "__cmwSetMain('land')"], ['X → Y', "__cmwSetMain('xy')"]);
  s.push(['Sphere (Y)', "__cmwSetView('R', 'sphere')"], ['Sphere (X)', "__cmwSetView('L', 'sphere')"]);
  s.push(['planes', "__cmwSetView('R', 'plane'); __cmwSetView('L', 'plane')"]);
  s.push(['deformation', '__cmwMorph({ open: true, T: 0.5 })'], ['deformation closed', '__cmwMorph({ open: false })']);
  return s;
}

async function pass(name, base) {
  const B = await launch({ cache: CACHE });
  const out = { pass: name, renderer: '', steps: [] };
  try {
    await B.nav(`${base}test.html?glprof&ns=glprof${Date.now()}`);
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
    const steps = [];
    for (let i = 0; i < (QUICK ? 3 : 80); i++) steps.push([`example ${i}`, `__cmwExample(${i})`, true]);
    for (const [label, js, ex] of [...steps, ...walk()]) {
      // (an example past the last throws: the examples are done)
      if (!(await B.ev(`(() => { try { ${js}; return true; } catch (e) { return false; } })()`))) { if (ex) continue; throw new Error('step failed: ' + label); }
      const st = await settle(label);
      out.steps.push(st);
      const ms = st.programs.reduce((a, p) => a + Math.max(0, p.ms || 0), 0);
      console.log(`[glprof] ${name} ${label}: ${st.programs.length} links, ${(ms / 1000).toFixed(1)} s of link time, ${st.s.toFixed(1)} s wall${st.timedOut ? ' (TIMED OUT)' : ''}`);
    }
  } finally { await B.close(); }
  return out;
}

(async () => {
  if (!flag('no-build') && run(PY, ['build.py'])) process.exit(2);
  const { server, base } = await serve(path.join(ROOT, 'dist'));
  fs.rmSync(CACHE, { recursive: true, force: true });   // cold: nothing cached
  const cold = await pass('cold', base);
  const warm = await pass('warm', base);
  server.close();
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ when: new Date().toISOString(), machine: `${os.platform()} ${os.cpus()[0].model}`, cold, warm }, null, 1));
  // the programs by cold link time, with their warm time (matched by name, chain key and mode, in order)
  const flat = (p) => p.steps.flatMap((s) => s.programs.map((x) => Object.assign({ step: s.label }, x)));
  const key = (x) => `${x.name}|${x.key}|${x.mode}`;
  const warmBy = new Map();
  for (const x of flat(warm)) { if (!warmBy.has(key(x))) warmBy.set(key(x), []); warmBy.get(key(x)).push(x); }
  const rows = flat(cold).map((x) => { const w = (warmBy.get(key(x)) || []).shift(); return { ...x, warm: w ? w.ms : null }; }).sort((a, b) => (b.ms || 0) - (a.ms || 0));
  const sum = (a) => a.reduce((s, x) => s + Math.max(0, x || 0), 0) / 1000;
  const lines = [`### Shader link times (${cold.renderer || 'unknown renderer'})`, '',
    `${rows.length} links. Link time in all: cold ${sum(rows.map((r) => r.ms)).toFixed(1)} s, warm ${sum(rows.map((r) => r.warm)).toFixed(1)} s.`, '',
    '| cold s | warm s | program | mode | source (vs + fs) | first in |', '|---|---|---|---|---|---|'];
  for (const r of rows.slice(0, 30)) lines.push(`| ${((r.ms || 0) / 1000).toFixed(2)} | ${r.warm == null ? '' : (r.warm / 1000).toFixed(2)} | ${r.inv ? 'inverse ' : ''}${r.name} \`${r.key}\` | ${r.mode} | ${r.vs} + ${r.fs} | ${r.step} |`);
  lines.push('', '| step | cold: links, wall s | warm: links, wall s |', '|---|---|---|');
  cold.steps.forEach((s, i) => { const w = warm.steps[i] || { programs: [], s: 0 }; lines.push(`| ${s.label}${s.timedOut ? ' (timed out)' : ''} | ${s.programs.length}, ${s.s.toFixed(1)} | ${w.programs.length}, ${w.s.toFixed(1)} |`); });
  const md = lines.join('\n') + '\n';
  summary(md);
  console.log(`[glprof] wrote ${path.relative(ROOT, OUT)}`);
})().catch((e) => { console.error(e); process.exit(2); });
