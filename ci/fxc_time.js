'use strict';
// Where a shader's link time goes on a slow compiler (Direct3D 11 compiles with FXC on the CPU at link time): the
// exact programs the app links for a scene, linked one at a time on their own, as captured and in variants that say
// what costs what. Two steps:
//   node ci/fxc_time.js capture [--sides current,base=REF,...] [--scenes expsin,sinzz,cubic,default] [--out FILE] [--no-build]
//     the steps view's scenes in this machine's Chrome (a fake KHR_parallel_shader_compile makes the app take its
//     real-GPU paths: prestart, background links): every inverse program linked by a first glide (and, for expsin, by the
//     globe's), per side: current is this checkout's build, any other side a commit's (ci/reference.js). Writes FILE
//     (default ci/fxc/bundle.json): the unique programs (vertex and fragment source), their variants and the job
//     list, the most informative first.
//   node ci/fxc_time.js time [--bundle FILE] [--budget-min 85] [--timeout-s 900] [--only RE] [--jobs 0,3,8] [--out FILE]
//     links each job's program in a Chrome of its own (its program cache off, nothing else running: the link's own
//     time, from the first shader compile to the link done, no parallel compile), kills the Chrome at the timeout,
//     and stops opening jobs once the budget is spent. Prints a table and writes FILE (default .ci/fxc/fxc.json).
//   node ci/fxc_time.js contend [--bundle FILE] [--targets 0,9] [--other-jobs 11,13,19,29] [--iters 64] [--budget-min 85] [--timeout-s 900] [--out FILE]
//     one program (a job of the bundle) linked alone, while the page redraws every frame, while 2 or 4 other programs link,
//     and with both: what slows a link in the app compared with a link alone.
//   node ci/fxc_time.js glide --ref REF [--scenes expsin,mk] [--rounds 2] [--timeout-s 900] [--budget-min 85] [--no-build] [--out FILE]
//     the first glide of the scenes in the app itself, this checkout against REF, the sides in turn: the seconds to its first
//     exact frame and the link seconds of its inverse programs.
//   node ci/fxc_time.js play [--ref REF] [--scenes expsin,mk] [--timeout-s 900] [--tail-s 420] [--no-build] [--out FILE]
//     the first glide as it plays (sampled every 250 ms): its first exact frame, its end, the frame rate meanwhile, the stalls
//     (holds) and every inverse program it links: when, how long, and what waited for it.
// Variants (the text of the fragment shader):
//   a  as the app links it
//   b  every for loop whose trip count is a literal or an IX_ constant gets "+ uZero" on its bound: a uniform nothing
//      sets (0), so the compiler cannot unroll it
//   c  the chain's own code stubbed (chainStep, chainHom, chainAt, chainHomAll, chainRange return their input): what the
//      program costs without the formula
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { ROOT, PY, serve, summary, run, esc } = require('./lib');
const { buildReference } = require('./reference');
const { launch, sleep } = require('../test/regress/perf/cdp');

const argv = process.argv.slice(2);
const MODE = argv[0];
const opt = (name, def) => { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : def; };
const flag = (name) => argv.includes('--' + name);

// the page's side of a timing: one program, the time from its first shader compile to the link done, and its first draw
const PAGE = `(() => {
  window.__go = (job) => {
    window.__res = null;
    (async () => {
      const c = document.createElement('canvas'); c.width = c.height = 64; document.body.appendChild(c);
      const gl = c.getContext('webgl2'), ext = gl.getExtension('KHR_parallel_shader_compile');
      const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
      const t0 = performance.now();
      const vs = mk(gl.VERTEX_SHADER, job.vs), fs = mk(gl.FRAGMENT_SHADER, job.fs);
      const p = gl.createProgram(); gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
      if (ext) while (!gl.getProgramParameter(p, ext.COMPLETION_STATUS_KHR)) await new Promise((r) => setTimeout(r, 5));
      const ok = !!gl.getProgramParameter(p, gl.LINK_STATUS), ms = performance.now() - t0;
      // (and one draw: a back end that finishes its work at the first use of the program, not at the link, is timed there too)
      let drawMs = 0;
      if (ok) {
        const t1 = performance.now();
        gl.useProgram(p); gl.bindVertexArray(gl.createVertexArray()); gl.drawArrays(gl.POINTS, 0, 1);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
        drawMs = performance.now() - t1;
      }
      window.__res = { ms, drawMs, ok, log: ok ? '' : ((gl.getProgramInfoLog(p) || '') + (gl.getShaderInfoLog(fs) || '')).slice(0, 600) };
    })().catch((e) => { window.__res = { ms: -1, ok: false, log: String(e) }; });
    return true;
  };
})();`;

// ---- the variants
// the function whose definition starts at "head" (e.g. 'vec2 chainStep(int i, vec2 z) {') with its body replaced
function stubBody(src, head, body) {
  const i = src.indexOf(head);
  if (i < 0) return { src, n: 0 };
  let d = 0, j = i + head.length - 1;
  for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) break; }
  return { src: `${src.slice(0, i + head.length)}\n  ${body}\n${src.slice(j)}`, n: 1 };
}
function variantB(fsrc) {
  let n = 0;
  const bound = '(?:\\d+|IX_[A-Z0-9_]+)(?: [-+] \\d+)?';
  let out = fsrc.replace(new RegExp(`(for \\(int (\\w+) = [^;]+; \\2 <=? )(${bound})(; )`, 'g'), (m, a, v, b, c) => { n++; return `${a}(${b}) + uZero${c}`; });
  out = out.replace(/(; (\w+) > (\d+|IX_[A-Z0-9_]+)); (\2)--/g, (m, a, v, b, w) => { n++; return `${a} - uZero; ${w}--`; });
  if (!n) return { src: fsrc, n };
  const decl = 'uniform highp int uZero;';
  if (/uniform highp int uNoUnroll;/.test(out)) out = out.replace(/uniform highp int uNoUnroll;/, (m) => `${m} ${decl}`);
  else if (/^precision [^\n]*;/m.test(out)) out = out.replace(/^(precision [^\n]*;)/m, `$1\n${decl}`);
  else return { src: fsrc, n: 0 };
  return { src: out, n };
}
function variantC(fsrc) {
  let s = fsrc, n = 0;
  for (const [head, body] of [['vec2 chainStep(int i, vec2 z) {', 'return z;'], ['vec2 chainHom(int i, vec2 z, float t) {', 'return z;'], ['vec2 chainAt(int k, vec2 z, float t, int how) {', 'return z;'],
    ['vec2 chainHomAll(vec2 z, int a, int b, float t) {', 'return z;'], ['vec2 chainRange(vec2 z, int a, int b) {', 'return z;']]) {
    const r = stubBody(s, head, body); s = r.src; n += r.n;
  }
  return { src: s, n };
}
const VARIANTS = [['a', (f) => ({ src: f, n: 1 })], ['b', variantB], ['c', variantC]];

// ---- capture
const SHIM = `(() => {
  const C = 0x91B1;
  const proto = WebGL2RenderingContext.prototype;
  const ge = proto.getExtension, gp = proto.getProgramParameter, ss = proto.shaderSource, at = proto.attachShader, lp = proto.linkProgram;
  const seen = new WeakMap(), src = new WeakMap(), att = new WeakMap();
  window.__progs = [];
  proto.getExtension = function (n) { return n === 'KHR_parallel_shader_compile' ? { COMPLETION_STATUS_KHR: C, maxShaderCompilerThreadsKHR() {} } : ge.call(this, n); };
  proto.getProgramParameter = function (p, n) {
    if (n === C) { if (!seen.has(p)) seen.set(p, performance.now()); return performance.now() - seen.get(p) > 300; }
    return gp.call(this, p, n);
  };
  proto.shaderSource = function (s, t) { src.set(s, t); return ss.call(this, s, t); };
  proto.attachShader = function (p, s) { if (!att.has(p)) att.set(p, []); att.get(p).push(s); return at.call(this, p, s); };
  proto.linkProgram = function (p) {
    const ss2 = (att.get(p) || []).map((s) => src.get(s) || '');
    window.__progs.push({ vs: ss2[0] || '', fs: ss2[1] || '' });
    return lp.call(this, p);
  };
})();`;
// the scenes: the formula pasted into the field of a custom step that opened as z^2+1 (null: the default example, as it opens), as
// ci/glprof_typed.js's walk does, then the phases: [label, statement]
const GO = (k) => `__cmwSteps({ go: ${k} })`;
// (mk: the Mountain King example, opened and its first glide: the largest programs the app links, MOB carry ones)
const MOUNTAIN_KING = 'In the Hall of the Mountain King';
const LAST = '(() => { const n = __cmwSteps().planes.length - 1; if (n > 0) __cmwSteps({ go: n }); return true; })()';
const SCENES = {
  mk: { example: MOUNTAIN_KING, phases: [['open', null], ['glide', LAST]] },
  expsin: { edit: 'exp(sin(z))', phases: [['glide', GO(1)], ['globe', `(${GO(0)}, __cmwSteps({ surf: 'sphere' }), ${GO(1)})`]] },
  sinzz: { edit: 'sin(z)/z', phases: [['glide', GO(1)]] },
  cubic: { edit: 'z^3-2z+1', phases: [['glide', GO(1)]] },
  default: { phases: [['glide', GO(1)]] },
};
const isInv = (f) => /void invWalk\(|IX_NR_PASS/.test(f);
const sha1 = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);

// the index of the example called name in a tree's source (ci/glprof.js reads it the same way)
function exampleIndex(tree, name) {
  const src = fs.readFileSync(path.join(tree, 'src', 'app', '15-examples-guide.js'), 'utf8');
  return [...src.matchAll(/\bname: \$t\('((?:[^'\\]|\\.)*)'\)/g)].map((m) => m[1].replace(/\\'/g, "'")).indexOf(name);
}
async function captureScene(base, name, tree) {
  const sc = SCENES[name];
  const H = await launch({ inject: SHIM, width: 1440, height: 900 });
  try {
    const ns = `fxc${name}${Date.now()}`;
    await H.nav(`${base}blank.html`);
    if (sc.edit) {
      const st = { v3: true, v4: true, shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 0.9, ci: 0, visible: true }], steps: [{ type: 'custom', params: { expr: 'z^2+1', cut: 180 }, on: true }], nextId: 50, focus: 0, rightMode: 'image' };
      await H.ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
    }
    await H.nav(`${base}test.html?ns=${ns}&view=steps&glprof`);
    await H.until(`typeof __cmwSteps === 'function' && typeof GLR !== 'undefined'`, 240000, 200);
    // settled: no new link for 6 s and none pending
    const quiet = async (maxMs) => {
      const t0 = Date.now();
      let n = -1, since = Date.now();
      for (;;) {
        const k = await H.ev('window.__progs.length'), pend = await H.ev('GLR.pendingLinks');
        if (k !== n) { n = k; since = Date.now(); }
        if ((Date.now() - since > 6000 && !pend) || Date.now() - t0 > maxMs) return k;
        await sleep(250);
      }
    };
    let from = await quiet(240000);
    if (sc.example) {
      const i = exampleIndex(tree, sc.example);
      if (i < 0) throw new Error(`no example named ${sc.example} in ${tree}`);
      await H.ev(`__cmwExample(${i})`);
    }
    if (sc.edit) {
      await H.until(`!!document.querySelector('input[data-pkey="expr"]')`, 30000, 100);
      await H.ev(`(() => { const i = document.querySelector('input[data-pkey="expr"]'); i.focus(); i.value = ${JSON.stringify(sc.edit)}; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); i.blur(); return true; })()`);
      from = await quiet(600000);
    }
    const out = [];
    for (const [label, js] of sc.phases) {
      if (js) await H.ev(js);
      const to = await quiet(600000);
      const progs = await H.ev(`window.__progs.slice(${from}, ${to}).map((p) => ({ vs: p.vs, fs: p.fs }))`);
      const prof = await H.ev(`GLR.profile().slice(${from}, ${to}).map((r) => ({ name: r.name, mode: r.mode, inv: r.inv, key: String(r.key).slice(0, 60) }))`);
      console.log(`[fxc] ${name} ${label}: ${progs.length} links, ${progs.filter((p) => isInv(p.fs)).length} inverse; ${prof.map((r, i) => `${r.name}${r.inv ? "*" : ""} ${((progs[i] || { fs: "" }).fs.length / 1024).toFixed(0)}`).join(", ")}`);
      progs.forEach((p, i) => { if (isInv(p.fs)) out.push({ scene: name, phase: label, ...(prof[i] || {}), vs: p.vs, fs: p.fs }); });
      from = to;
    }
    return out;
  } finally { await H.close(); }
}

async function capture() {
  const sides = opt('sides', 'current').split(',').map((s) => { const [label, ref] = s.includes('=') ? s.split('=') : [s, s]; return { label, ref: s === 'current' ? null : ref }; });
  const names = opt('scenes', Object.keys(SCENES).join(',')).split(',');
  if (!flag('no-build') && run(PY, ['build.py'])) process.exit(2);
  const found = [];
  for (const sd of sides) {
    const tree = sd.ref ? buildReference(sd.ref).dir : ROOT, dist = path.join(tree, 'dist');
    fs.writeFileSync(path.join(dist, 'blank.html'), '<!doctype html><title>b</title>');
    const S = await serve(dist);
    for (const n of names) {
      let r;
      try { r = await captureScene(S.base, n, tree); } catch (e) { console.log(`[fxc] ${sd.label} ${n}: ${String(e.message).split('\n')[0]}: once more`); r = await captureScene(S.base, n, tree); }
      // (a page slow under load can glide before its example is up: a scene that links no inverse program is run again)
      for (let k = 0; !r.length && k < 2; k++) { console.log(`[fxc] ${sd.label} ${n}: no inverse program: once more`); r = await captureScene(S.base, n, tree); }
      console.log(`[fxc] ${sd.label} ${n}: ${r.length} inverse programs: ${r.map((x) => `${x.phase} ${x.name} ${((x.vs.length + x.fs.length) / 1024).toFixed(0)} KB`).join('; ')}`);
      for (const x of r) found.push({ side: sd.label, ...x });
    }
    S.server.close();
  }
  // unique programs: one per distinct text, with the sides and scenes that link it
  const progs = new Map();
  for (const x of found) {
    const id = sha1(x.vs + '\0' + x.fs);
    if (!progs.has(id)) progs.set(id, { id, name: x.name, key: x.key, mode: x.mode, srcKB: +((x.vs.length + x.fs.length) / 1024).toFixed(1), vs: x.vs, fs: x.fs, in: [] });
    progs.get(id).in.push(`${x.side}/${x.scene}/${x.phase}`);
  }
  // the Mountain King's carry programs come in two sizes of the front buffer (IX_B, the key's B3 or B5, by the view the page is
  // in): the captured one's sibling with the other size, linked by the app on the Windows machines (B5)
  for (const p of [...progs.values()]) {
    if (!(p.in.some((s) => s.split('/')[1] === 'mk') && /MOB/.test(String(p.key)) && /carry/.test(String(p.key)) && p.fs.includes('const int IX_B = 3;'))) continue;
    const fs5 = p.fs.replace('const int IX_B = 3;', 'const int IX_B = 5;');
    progs.set(`${p.id}x5`, { ...p, id: `${p.id}x5`, key: String(p.key).replace(/\|B3$/, '|B5'), fs: fs5, srcKB: +((p.vs.length + fs5.length) / 1024).toFixed(1), in: p.in.map((s) => `${s.split('/')[0]}/mk/B5 (IX_B 5)`) });
  }
  // the jobs, the most informative first. The first side is the reference of the variants (b, c): only its programs get
  // them. First the Mountain King's MOB carry programs (the largest): each as the sides link it, then its b and c; then
  // every other program as captured (the scenes in the order given, the first side's first, small before large: a
  // timeout costs the most), then the variants of those, scene by scene
  const sceneOf = (p) => names.indexOf(p.in[0].split('/')[1]);
  const sideIdx = (p) => Math.min(...p.in.map((s) => sides.findIndex((q) => q.label === s.split('/')[0])));
  const isMk = (p) => p.in.some((s) => s.split('/')[1] === 'mk') && /MOB/.test(String(p.key)) && /carry/.test(String(p.key));
  const list = [...progs.values()].sort((p, q) => (isMk(q) - isMk(p)) || sceneOf(p) - sceneOf(q) || String(p.key).localeCompare(String(q.key)) || sideIdx(p) - sideIdx(q) || p.srcKB - q.srcKB);
  const sources = {}, job = (p, v, r) => { sources[`${p.id}:${v}`] = { vs: p.vs, fs: r.src }; return { prog: p.id, variant: v, srcKB: +((p.vs.length + r.src.length) / 1024).toFixed(1), changed: r.n }; };
  const variantsOf = (p) => (sideIdx(p) === 0 ? VARIANTS.slice(1).map(([v, make]) => [v, make(p.fs)]).filter(([v, r]) => { if (!r.n || r.src === p.fs) { console.log(`[fxc] ${p.id} ${p.name}: variant ${v} changes nothing: left out`); return false; } return true; }) : []);
  const ordered = [];
  for (const p of list.filter(isMk)) {
    ordered.push(job(p, 'a', { src: p.fs, n: 1 }));
    for (const [v, r] of variantsOf(p)) ordered.push(job(p, v, r));
  }
  const others = list.filter((p) => !isMk(p));
  for (const p of others) ordered.push(job(p, 'a', { src: p.fs, n: 1 }));
  for (const [v] of VARIANTS.slice(1)) for (const p of others) { const r = variantsOf(p).find(([x]) => x === v); if (r) ordered.push(job(p, v, r[1])); }
  const outFile = path.resolve(opt('out', path.join(ROOT, 'ci', 'fxc', 'bundle.json')));
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify({ when: new Date().toISOString(), sides: sides.map((s) => ({ label: s.label, ref: s.ref })), programs: list.map(({ vs, fs: f, ...m }) => m), jobs: ordered, sources }));
  console.log(`[fxc] ${list.length} programs, ${ordered.length} jobs -> ${path.relative(ROOT, outFile)} (${(fs.statSync(outFile).size / 1048576).toFixed(1)} MB)`);
  process.exit(0);
}

// ---- timing
async function timeAll() {
  const bundleFile = path.resolve(opt('bundle', path.join(ROOT, 'ci', 'fxc', 'bundle.json')));
  const B = JSON.parse(fs.readFileSync(bundleFile, 'utf8'));
  const budgetMs = Number(opt('budget-min', '85')) * 60000, timeoutMs = Number(opt('timeout-s', '900')) * 1000;
  const only = opt('only', '') ? new RegExp(opt('only', '')) : null;
  const jobsOnly = opt('jobs', '') ? new Set(opt('jobs', '').split(',').map(Number)) : null;   // (by index in the bundle's job list)
  const progs = new Map(B.programs.map((p) => [p.id, p]));
  const t00 = Date.now(), rows = [];
  let renderer = '';
  for (const [i, j] of B.jobs.entries()) {
    const p = progs.get(j.prog), label = `${p.name} ${p.key}`;
    if ((only && !only.test(`${label} ${j.variant}`)) || (jobsOnly && !jobsOnly.has(i))) continue;
    const row = { i, id: j.prog, name: p.name, key: p.key, in: p.in, variant: j.variant, srcKB: j.srcKB, changed: j.changed };
    rows.push(row);
    if (Date.now() - t00 > budgetMs) { row.status = 'skipped (budget)'; console.log(`[fxc] ${i} ${label} ${j.variant}: skipped, over the ${opt('budget-min', '85')} min budget`); continue; }
    const H = await launch({ inject: PAGE });
    try {
      await H.nav('about:blank');
      await H.until('typeof window.__go === "function"', 20000, 100);
      if (!renderer) renderer = await H.ev(`(() => { const g = document.createElement('canvas').getContext('webgl2'), x = g && g.getExtension('WEBGL_debug_renderer_info'); return x ? g.getParameter(x.UNMASKED_RENDERER_WEBGL) : ''; })()`);
      await H.ev(`window.__go(${JSON.stringify(B.sources[`${j.prog}:${j.variant}`])})`);
      const t1 = Date.now();
      let r = null;
      // (a poll the page's busy thread does not answer is left pending: the Chrome is closed at the timeout)
      while (!r && Date.now() - t1 < timeoutMs) { await sleep(500); r = await Promise.race([H.ev('window.__res').catch(() => null), sleep(2000).then(() => null)]); }
      if (r) { row.s = r.ms / 1000; row.drawS = r.drawMs / 1000; row.status = r.ok ? 'linked' : `failed: ${r.log.replace(/\s+/g, ' ').slice(0, 160)}`; } else { row.s = null; row.status = `timeout (${timeoutMs / 1000} s)`; }
    } finally { await H.close(); }
    console.log(`[fxc] ${i} ${label} (${p.in.join(', ')}) ${j.variant}: ${j.srcKB} KB, ${row.s == null ? '-' : `${row.s.toFixed(1)} s link + ${row.drawS.toFixed(1)} s first draw`}, ${row.status}`);
  }
  const outFile = path.resolve(opt('out', path.join(ROOT, '.ci', 'fxc', 'fxc.json')));
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify({ when: new Date().toISOString(), machine: `${os.platform()} ${os.cpus()[0].model}`, renderer, bundle: path.basename(bundleFile), sides: B.sides, rows }, null, 1));
  const cell = (r) => (!r ? '' : r.s != null ? `${r.s.toFixed(1)} + ${r.drawS.toFixed(1)}${r.status === 'linked' ? '' : ' (failed)'}` : /skipped/.test(r.status) ? 'skipped' : 'timeout');
  const lines = [`### Shader link times, one program at a time (${renderer || 'unknown renderer'})`, '',
    'Seconds from the first shader compile to the link done, plus the first draw (link + draw), each program alone in a Chrome of its own, the program cache off. a: as the app links it; b: constant loop bounds made non-constant (+ uZero); c: the chain\'s code stubbed.', '',
    '| program | linked by | source KB (a) | a: s | b: s | c: s |', '|---|---|---|---|---|---|'];
  for (const p of B.programs) {
    const by = (v) => rows.find((r) => r.id === p.id && r.variant === v);
    if (!rows.some((r) => r.id === p.id)) continue;
    lines.push(`| ${esc(p.name)} \`${esc(String(p.key).slice(0, 40))}\` | ${p.in.join(', ')} | ${(by('a') || {}).srcKB || p.srcKB} | ${cell(by('a'))} | ${cell(by('b'))} | ${cell(by('c'))} |`);
  }
  const bad = rows.filter((r) => r.status && !/^(linked|skipped)/.test(r.status));
  if (bad.length) lines.push('', 'Not linked:', '', ...bad.map((r) => `- ${r.name} ${r.variant}: ${r.status}`));
  lines.push('');
  const md = lines.join('\n');
  summary(md);
  console.log(md);
  console.log(`[fxc] wrote ${path.relative(ROOT, outFile)}`);
  process.exit(0);
}

// ---- contention: what slows a link inside the app (a link alone is 10x faster than in the app's glide run)
// One target program (a job of the bundle), linked in a Chrome of its own under each condition:
//   alone                    nothing else
//   draw                     the page redraws every animation frame: a full-page quad whose fragment shader loops
//                            (a stand-in for the held glide's plane: on WARP drawing runs on the same cores as FXC)
//   +N links                 N other programs of the bundle linked at the same time
//   draw + N links           both
// The result per run: the target's link seconds (from its first shader compile to the link done), and, with drawing,
// the frames drawn meanwhile and their mean and longest interval, so the load can be told from its effect.
const CONTEND_PAGE = `(() => {
  window.__contend = (cfg) => {
    window.__res = null;
    (async () => {
      const W = 1440, H = 900;
      const c = document.createElement('canvas'); c.width = W; c.height = H; document.body.appendChild(c);
      const gl = c.getContext('webgl2'), ext = gl.getExtension('KHR_parallel_shader_compile');
      const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
      const prog = (vsSrc, fsSrc) => { const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vsSrc)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fsSrc)); gl.linkProgram(p); return p; };
      const done = (p) => !ext || gl.getProgramParameter(p, ext.COMPLETION_STATUS_KHR);
      const idle = (ms) => new Promise((r) => setTimeout(r, ms));
      let frames = 0, last = 0, maxGap = 0, run = false, sumGap = 0;
      if (cfg.draw) {
        // a quad whose pixels each loop uN times: the cost of a frame is set by iters, and the frames drawn say what it was
        const dp = prog('#version 300 es\\nvoid main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }',
          '#version 300 es\\nprecision highp float; uniform float uT; uniform int uN; out vec4 o;\\nvoid main() { float v = gl_FragCoord.x * 0.001 + uT; for (int i = 0; i < uN; i++) v = sin(v * 1.3 + float(i)) + cos(v * 0.7); o = vec4(fract(v), fract(v * 3.0), fract(v * 7.0), 1.0); }');
        while (!done(dp)) await idle(5);
        gl.useProgram(dp); gl.uniform1i(gl.getUniformLocation(dp, 'uN'), cfg.iters); gl.viewport(0, 0, W, H);
        const tl = gl.getUniformLocation(dp, 'uT');
        const frame = (t) => {
          if (run) { if (last) { const g = t - last; maxGap = Math.max(maxGap, g); sumGap += g; frames++; } last = t; }
          window.__fc = (window.__fc || 0) + 1; gl.uniform1f(tl, t * 0.001); gl.drawArrays(gl.TRIANGLES, 0, 3); requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
        await idle(3000);
      }
      run = true; frames = 0; sumGap = 0; maxGap = 0; last = 0;
      const t0 = performance.now();
      const tp = prog(cfg.target.vs, cfg.target.fs);
      const others = cfg.others.map((o) => prog(o.vs, o.fs));
      while (!done(tp)) await idle(5);
      const ok = !!gl.getProgramParameter(tp, gl.LINK_STATUS), ms = performance.now() - t0;
      window.__res = { ms, ok, frames, frameMeanMs: frames ? sumGap / frames : 0, frameMaxMs: maxGap, othersDone: others.filter(done).length, log: ok ? '' : (gl.getProgramInfoLog(tp) || '').slice(0, 300) };
    })().catch((e) => { window.__res = { ms: -1, ok: false, log: String(e) }; });
    return true;
  };
})();`;

async function contend() {
  const bundleFile = path.resolve(opt('bundle', path.join(ROOT, 'ci', 'fxc', 'bundle.json')));
  const B = JSON.parse(fs.readFileSync(bundleFile, 'utf8'));
  const budgetMs = Number(opt('budget-min', '85')) * 60000, timeoutMs = Number(opt('timeout-s', '900')) * 1000;
  const targets = opt('targets', '0,9').split(',').map(Number), otherJobs = opt('other-jobs', '11,13,19,29').split(',').map(Number);
  const iters = Number(opt('iters', '64'));
  const src = (i) => B.sources[`${B.jobs[i].prog}:${B.jobs[i].variant}`];
  const nameOf = (i) => { const p = B.programs.find((q) => q.id === B.jobs[i].prog); return `${p.name} ${String(p.key).slice(0, 50)}`; };
  const conditions = [['alone', false, 0], ['draw', true, 0], ['2 links', false, 2], ['4 links', false, 4], ['draw + 2 links', true, 2], ['draw + 4 links', true, 4]];
  const t00 = Date.now(), rows = [];
  let renderer = '';
  for (const t of targets) {
    for (const [cond, draw, n] of conditions) {
      const row = { target: t, name: nameOf(t), srcKB: B.jobs[t].srcKB, cond };
      rows.push(row);
      if (Date.now() - t00 > budgetMs) { row.status = 'skipped (budget)'; continue; }
      const others = otherJobs.filter((j) => j !== t).slice(0, n).map(src);
      const H = await launch({ inject: CONTEND_PAGE });
      try {
        await H.nav('about:blank');
        await H.until('typeof window.__contend === "function"', 20000, 100);
        if (!renderer) renderer = await H.ev(`(() => { const g = document.createElement('canvas').getContext('webgl2'), x = g && g.getExtension('WEBGL_debug_renderer_info'); return x ? g.getParameter(x.UNMASKED_RENDERER_WEBGL) : ''; })()`);
        await H.ev(`window.__contend(${JSON.stringify({ target: src(t), others, draw, iters })})`);
        const t1 = Date.now();
        let r = null;
        while (!r && Date.now() - t1 < timeoutMs) { await sleep(500); r = await Promise.race([H.ev('window.__res').catch(() => null), sleep(2000).then(() => null)]); }
        if (r) Object.assign(row, { s: r.ms / 1000, frames: r.frames, frameMeanMs: r.frameMeanMs, frameMaxMs: r.frameMaxMs, status: r.ok ? 'linked' : `failed: ${r.log}` }); else row.status = `timeout (${timeoutMs / 1000} s)`;
      } finally { await H.close(); }
      console.log(`[fxc] ${row.name} (${row.srcKB} KB) ${cond}: ${row.s == null ? '-' : row.s.toFixed(1)} s${draw ? `, ${row.frames} frames, mean ${(row.frameMeanMs || 0).toFixed(0)} ms, longest ${(row.frameMaxMs || 0).toFixed(0)} ms` : ''}, ${row.status}`);
    }
  }
  const outFile = path.resolve(opt('out', path.join(ROOT, '.ci', 'fxc', 'contend.json')));
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify({ when: new Date().toISOString(), machine: `${os.platform()} ${os.cpus()[0].model}`, renderer, iters, otherJobs: otherJobs.map(nameOf), rows }, null, 1));
  const lines = [`### What slows a link: one program under load (${renderer || 'unknown renderer'})`, '',
    `The target's link seconds, each run in a Chrome of its own. draw: the page redraws a full-page quad (${iters} loop steps a pixel) every animation frame; N links: N other programs (${otherJobs.map(nameOf).map((s) => esc(s.slice(0, 30))).join('; ')}) linked at the same time. Frames: drawn during the link, mean and longest interval.`, '',
    '| target | condition | link s | frames | mean frame ms | longest ms |', '|---|---|---|---|---|---|'];
  for (const r of rows) lines.push(`| ${esc(r.name)} (${r.srcKB} KB) | ${r.cond} | ${r.s != null ? r.s.toFixed(1) : r.status} | ${r.frames == null || !/draw/.test(r.cond) ? '' : r.frames} | ${r.frameMeanMs && /draw/.test(r.cond) ? r.frameMeanMs.toFixed(0) : ''} | ${r.frameMaxMs && /draw/.test(r.cond) ? r.frameMaxMs.toFixed(0) : ''} |`);
  lines.push('');
  const md = lines.join('\n');
  summary(md);
  console.log(md);
  process.exit(0);
}

// ---- the first glide in the app, this build against another (--ref): how long the wait is for its first exact frame, and the link
// seconds of the inverse programs it links. The app is driven as the glprof walk drives it (the page's own links, the app's own
// drawing, the program cache off); each cell is a Chrome of its own, the sides in turn.
async function glideCell(base, name, tree, timeoutMs) {
  const sc = SCENES[name], glide = sc.phases.find(([l]) => l === 'glide')[1];
  const H = await launch({ width: 1440, height: 900 });
  try {
    const ns = `fxc${name}${Date.now()}`;
    await H.nav(`${base}blank.html`);
    if (sc.edit) {
      const st = { v3: true, v4: true, shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 0.9, ci: 0, visible: true }], steps: [{ type: 'custom', params: { expr: 'z^2+1', cut: 180 }, on: true }], nextId: 50, focus: 0, rightMode: 'image' };
      await H.ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
    }
    await H.nav(`${base}test.html?ns=${ns}&view=steps&glprof`);
    await H.until(`typeof __cmwSteps === 'function' && typeof GLR !== 'undefined'`, 240000, 200);
    // settled: no link open and no new one for 6 s
    const quiet = async (maxMs) => {
      const t0 = Date.now();
      let n = -1, since = Date.now();
      for (;;) {
        const r = await H.ev('GLR.profile()'), open = r.filter((x) => x.ms === null).length;
        if (r.length !== n) { n = r.length; since = Date.now(); }
        if ((Date.now() - since > 6000 && !open) || Date.now() - t0 > maxMs) return r.length;
        await sleep(250);
      }
    };
    await quiet(timeoutMs);
    if (sc.example) {
      const i = exampleIndex(tree, sc.example);
      if (i < 0) throw new Error(`no example named ${sc.example} in ${tree}`);
      await H.ev(`__cmwExample(${i})`);
    }
    if (sc.edit) {
      await H.until(`!!document.querySelector('input[data-pkey="expr"]')`, 30000, 100);
      await H.ev(`(() => { const i = document.querySelector('input[data-pkey="expr"]'); i.focus(); i.value = ${JSON.stringify(sc.edit)}; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); i.blur(); return true; })()`);
    }
    const n0 = await quiet(timeoutMs);
    await H.ev('window.__gpRec0 = __cmwSteps().glide; 1');
    const t1 = Date.now();
    await H.ev(glide);
    let firstS = null;
    while (Date.now() - t1 < timeoutMs) {
      if (await H.ev('(() => { const g = __cmwSteps().glide; return !!g && g !== window.__gpRec0 && g.path === "inverse"; })()')) { firstS = (Date.now() - t1) / 1000; break; }
      await sleep(100);
    }
    await quiet(Math.max(60000, timeoutMs - (Date.now() - t1)));
    const recs = (await H.ev('GLR.profile()')).slice(n0);
    const inv = recs.filter((r) => r.inv);
    const sum = (a) => a.reduce((s, r) => s + Math.max(0, r.ms || 0), 0) / 1000;
    return { firstS, links: recs.length, linkS: sum(recs), invLinks: inv.length, invS: sum(inv), inv: inv.map((r) => `${String(r.key).slice(0, 40)}: ${r.ms == null ? 'open' : (r.ms / 1000).toFixed(1)} s`), open: recs.filter((r) => r.ms === null).length };
  } finally { await H.close(); }
}

async function glideAB() {
  const refSha = opt('ref', '');
  if (!refSha) throw new Error('glide: --ref REF (the other side)');
  const names = opt('scenes', 'expsin,mk').split(','), rounds = Math.max(1, Number(opt('rounds', '2')) || 1);
  const timeoutMs = Number(opt('timeout-s', '900')) * 1000, budgetMs = Number(opt('budget-min', '85')) * 60000;
  if (!flag('no-build') && run(PY, ['build.py'])) process.exit(2);
  const R = buildReference(refSha);
  const sides = [{ label: 'current', tree: ROOT }, { label: `reference ${R.sha.slice(0, 8)}`, tree: R.dir }];
  for (const sd of sides) { sd.dist = path.join(sd.tree, 'dist'); fs.writeFileSync(path.join(sd.dist, 'blank.html'), '<!doctype html><title>b</title>'); Object.assign(sd, await serve(sd.dist)); }
  const t00 = Date.now(), rows = [];
  for (let r = 0; r < rounds; r++) {
    for (const name of names) {
      for (const sd of (r % 2 ? sides.slice().reverse() : sides)) {
        const row = { round: r + 1, scene: name, side: sd.label };
        rows.push(row);
        if (Date.now() - t00 > budgetMs) { row.status = 'skipped (budget)'; continue; }
        try { Object.assign(row, await glideCell(sd.base, name, sd.tree, timeoutMs), { status: 'ok' }); } catch (e) { row.status = `failed: ${String(e.message).split('\n')[0]}`; }
        console.log(`[fxc] round ${r + 1} ${name} ${sd.label}: first exact frame ${row.firstS == null ? 'none' : row.firstS.toFixed(1) + ' s'}, ${row.invLinks} inverse links ${row.invS == null ? '' : row.invS.toFixed(1) + ' s'} (${(row.inv || []).join('; ')}), ${row.status}`);
      }
    }
  }
  for (const sd of sides) sd.server.close();
  const outFile = path.resolve(opt('out', path.join(ROOT, '.ci', 'fxc', 'glide.json')));
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify({ when: new Date().toISOString(), machine: `${os.platform()} ${os.cpus()[0].model}`, rows }, null, 1));
  const f = (v) => (v == null ? 'none' : v.toFixed(1));
  const lines = ['### The first glide in the app, this build against the reference', '', 'Seconds from the glide\'s start to its first exact frame (the inverse pass drawing it), and the link seconds of the inverse programs the glide links (the sum, parallel links added). One Chrome per cell, program cache off, the sides in turn.', '',
    '| scene | side | round | first exact frame s | inverse links | inverse link s | other links open at the end |', '|---|---|---|---|---|---|---|'];
  for (const r of rows) lines.push(`| ${r.scene} | ${r.side} | ${r.round} | ${r.status === 'ok' ? f(r.firstS) : r.status} | ${r.invLinks == null ? '' : r.invLinks} | ${r.invS == null ? '' : f(r.invS)} | ${r.open == null ? '' : r.open} |`);
  lines.push('');
  const md = lines.join('\n');
  summary(md);
  console.log(md);
  process.exit(0);
}

// ---- the first glide as it plays, in the app: what the links that land after the first exact frame are, and what the play does meanwhile
// The glide is sampled every 250 ms (its position, its path, whether it is moving) and the app's animation-frame callbacks are
// timed from the page's first script on. Per cell:
//   firstS     seconds from the glide's start to its first exact frame
//   playS      seconds until the glide has stopped moving at its end; meshAfter: samples after the first exact frame whose frame was
//              the carried mesh, not the inverse pass (0: every frame was exact)
//   fps        animation-frame callbacks a second between the first exact frame and the end of the play, and the longest gap (ms)
//   stalls     intervals where the glide was moving but its position stood still for over a second (a hold: on what is open then)
//   links      every inverse program linked from the glide's start: its start and end (s from the glide's start), its link seconds,
//              and what waited for it: "first frame" (done by the first exact frame), "held" (a stall overlaps its link), or "none"
const PLAY_PROBE = `(() => {
  window.__rafT = [];
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((t) => { window.__rafT.push(t); return cb(t); });
})();`;
async function playCell(base, name, tree, timeoutMs, tailMs) {
  const sc = SCENES[name], glide = sc.phases.find(([l]) => l === 'glide')[1];
  const H = await launch({ width: 1440, height: 900, inject: PLAY_PROBE });
  try {
    const ns = `fxc${name}${Date.now()}`;
    await H.nav(`${base}blank.html`);
    if (sc.edit) {
      const st = { v3: true, v4: true, shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 0.9, ci: 0, visible: true }], steps: [{ type: 'custom', params: { expr: 'z^2+1', cut: 180 }, on: true }], nextId: 50, focus: 0, rightMode: 'image' };
      await H.ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
    }
    await H.nav(`${base}test.html?ns=${ns}&view=steps&glprof`);
    await H.until(`typeof __cmwSteps === 'function' && typeof GLR !== 'undefined'`, 240000, 200);
    const quiet = async (maxMs) => {
      const t0 = Date.now();
      let n = -1, since = Date.now();
      for (;;) {
        const r = await H.ev('GLR.profile()'), open = r.filter((x) => x.ms === null).length;
        if (r.length !== n) { n = r.length; since = Date.now(); }
        if ((Date.now() - since > 6000 && !open) || Date.now() - t0 > maxMs) return r.length;
        await sleep(250);
      }
    };
    await quiet(timeoutMs);
    if (sc.example) {
      const i = exampleIndex(tree, sc.example);
      if (i < 0) throw new Error(`no example named ${sc.example} in ${tree}`);
      await H.ev(`__cmwExample(${i})`);
    }
    if (sc.edit) {
      await H.until(`!!document.querySelector('input[data-pkey="expr"]')`, 30000, 100);
      await H.ev(`(() => { const i = document.querySelector('input[data-pkey="expr"]'); i.focus(); i.value = ${JSON.stringify(sc.edit)}; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); i.blur(); return true; })()`);
    }
    const n0 = await quiet(timeoutMs);
    await H.ev('window.__gpRec0 = __cmwSteps().glide; 1');
    const g0 = await H.ev('performance.now()');
    const t1 = Date.now();
    await H.ev(glide);
    // samples: [s, moving, x, path, exact]
    const samples = [];
    let firstS = null, endS = null, moved = false;
    while (Date.now() - t1 < timeoutMs + tailMs) {
      const r = await H.ev('(() => { const s = __cmwSteps(), g = s.glide; return [performance.now(), !!s.moving, s.x, g ? g.path : null, !!g && g !== window.__gpRec0 && g.path === "inverse"]; })()');
      const at = (r[0] - g0) / 1000;
      samples.push([at, r[1], r[2], r[3], r[4]]);
      if (r[4] && firstS == null) firstS = at;
      if (r[1]) moved = true;
      if (moved && !r[1] && endS == null && firstS != null) endS = at;
      const recs = (await H.ev('GLR.profile()')).slice(n0).filter((x) => x.inv);
      const open = recs.filter((x) => x.ms === null).length;
      if (endS != null && !open) break;
      if (endS != null && at - endS > tailMs / 1000) break;
      if (firstS == null && Date.now() - t1 > timeoutMs) break;
      await sleep(250);
    }
    const raf = (await H.ev('window.__rafT')).map((t) => (t - g0) / 1000);
    const recs = (await H.ev('GLR.profile()')).slice(n0).filter((x) => x.inv).map((x) => ({ key: String(x.key).slice(0, 44), start: (x.t0 - g0) / 1000, end: x.ms == null ? null : (x.t0 + x.ms - g0) / 1000, s: x.ms == null ? null : x.ms / 1000 }));
    // stalls: the glide moving with its position unchanged for over a second
    const stalls = [];
    let st0 = null;
    for (let i = 1; i < samples.length; i++) {
      const still = samples[i][1] && samples[i][2] === samples[i - 1][2];
      if (still && st0 == null) st0 = samples[i - 1][0];
      if (!still && st0 != null) { if (samples[i - 1][0] - st0 > 1) stalls.push([st0, samples[i - 1][0]]); st0 = null; }
    }
    if (st0 != null && samples[samples.length - 1][0] - st0 > 1) stalls.push([st0, samples[samples.length - 1][0]]);
    for (const r of recs) {
      const e = r.end == null ? Infinity : r.end;
      r.waited = firstS != null && e <= firstS + 0.6 ? 'first frame' : stalls.some(([a, b]) => r.start < b && e > a) ? 'held' : 'none';
    }
    const play = raf.filter((t) => firstS != null && t >= firstS && (endS == null || t <= endS));
    const gaps = play.slice(1).map((t, i) => t - play[i]);
    return { firstS, playS: endS, meshAfter: samples.filter((x) => firstS != null && x[0] > firstS && x[3] === 'mesh').length, frames: play.length, fps: play.length > 1 ? (play.length - 1) / (play[play.length - 1] - play[0]) : null, longestGapMs: gaps.length ? Math.max(...gaps) * 1000 : null, stalls, links: recs };
  } finally { await H.close(); }
}

async function playAB() {
  const refSha = opt('ref', '');
  const names = opt('scenes', 'expsin,mk').split(','), timeoutMs = Number(opt('timeout-s', '900')) * 1000, tailMs = Number(opt('tail-s', '420')) * 1000;
  if (!flag('no-build') && run(PY, ['build.py'])) process.exit(2);
  const sides = [{ label: 'current', tree: ROOT }];
  if (refSha) { const R = buildReference(refSha); sides.push({ label: `reference ${R.sha.slice(0, 8)}`, tree: R.dir }); }
  for (const sd of sides) { sd.dist = path.join(sd.tree, 'dist'); fs.writeFileSync(path.join(sd.dist, 'blank.html'), '<!doctype html><title>b</title>'); Object.assign(sd, await serve(sd.dist)); }
  const rows = [];
  for (const name of names) {
    for (const sd of sides) {
      const row = { scene: name, side: sd.label };
      rows.push(row);
      try { Object.assign(row, await playCell(sd.base, name, sd.tree, timeoutMs, tailMs), { status: 'ok' }); } catch (e) { row.status = `failed: ${String(e.message).split('\n')[0]}`; }
      console.log(`[fxc] ${name} ${sd.label}: first exact ${row.firstS == null ? 'none' : row.firstS.toFixed(1)} s, play ended ${row.playS == null ? 'never' : row.playS.toFixed(1)} s, ${row.fps == null ? '-' : row.fps.toFixed(1)} fps, mesh frames after ${row.meshAfter}, ${row.status}`);
    }
  }
  for (const sd of sides) sd.server.close();
  const outFile = path.resolve(opt('out', path.join(ROOT, '.ci', 'fxc', 'play.json')));
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify({ when: new Date().toISOString(), machine: `${os.platform()} ${os.cpus()[0].model}`, rows }, null, 1));
  const f = (v, d = 1) => (v == null ? 'none' : v.toFixed(d));
  const lines = ['### The first glide as it plays', '', 'Seconds from the glide\'s start. fps: the app\'s animation-frame callbacks a second from the first exact frame to the end of the play; mesh: samples after the first exact frame drawn by the carried mesh.', '',
    '| scene | side | first exact frame | play ended | fps (longest gap ms) | mesh frames after | stalls (s) |', '|---|---|---|---|---|---|---|'];
  for (const r of rows) lines.push(`| ${r.scene} | ${r.side} | ${r.status === 'ok' ? f(r.firstS) : r.status} | ${f(r.playS)} | ${f(r.fps)} (${f(r.longestGapMs, 0)}) | ${r.meshAfter == null ? '' : r.meshAfter} | ${(r.stalls || []).map(([a, b]) => `${a.toFixed(0)}-${b.toFixed(0)}`).join(', ')} |`);
  lines.push('', '| scene | side | inverse program | starts s | ends s | link s | what waited for it |', '|---|---|---|---|---|---|---|');
  for (const r of rows) for (const l of r.links || []) lines.push(`| ${r.scene} | ${r.side} | ${esc(l.key)} | ${f(l.start)} | ${l.end == null ? 'open' : f(l.end)} | ${l.s == null ? 'open' : f(l.s)} | ${l.waited} |`);
  lines.push('');
  const md = lines.join('\n');
  summary(md);
  console.log(md);
  process.exit(0);
}

(MODE === 'capture' ? capture() : MODE === 'time' ? timeAll() : MODE === 'contend' ? contend() : MODE === 'glide' ? glideAB() : MODE === 'play' ? playAB() : Promise.reject(new Error('usage: node ci/fxc_time.js capture|time|contend|glide|play ...'))).catch((e) => { console.error(e); process.exit(2); });
