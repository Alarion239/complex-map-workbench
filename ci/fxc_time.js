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
//   node ci/fxc_time.js time [--bundle FILE] [--budget-min 85] [--timeout-s 900] [--only RE] [--out FILE]
//     links each job's program in a Chrome of its own (its program cache off, nothing else running: the link's own
//     time, from the first shader compile to the link done, no parallel compile), kills the Chrome at the timeout,
//     and stops opening jobs once the budget is spent. Prints a table and writes FILE (default .ci/fxc/fxc.json).
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
  const progs = new Map(B.programs.map((p) => [p.id, p]));
  const t00 = Date.now(), rows = [];
  let renderer = '';
  for (const [i, j] of B.jobs.entries()) {
    const p = progs.get(j.prog), label = `${p.name} ${p.key}`;
    if (only && !only.test(`${label} ${j.variant}`)) continue;
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

(MODE === 'capture' ? capture() : MODE === 'time' ? timeAll() : Promise.reject(new Error('usage: node ci/fxc_time.js capture|time ...'))).catch((e) => { console.error(e); process.exit(2); });
