'use strict';
// The size of every shader program the app links, as Direct3D 11's compiler sees it (issue #1545). On Windows ANGLE
// compiles each program with FXC, which inlines every call first, and its time grows about as the 2.9th power of that
// inlined size (#238); the cloud renderers and the Mac do not show the cost. This walks a fixed set of scenes in headless
// Chrome, takes each program's stages at linkProgram (GLR.profile(), ?glprof, names them: program, chain key, map mode)
// and sizes each stage with every call expanded (ci/glsl_inline.js), so a program that grows is seen at merge time.
//   node ci/fxc_size.js [--no-build] [--ref REF] [--json FILE] [--pages N]
// The scenes: the default example as the page opens, its first glide on the plane and on the globe, and its
// Landscape; every example's first frame; and the typed formulas of TYPED, each with the same four.
// The GL compiles nothing: each stage it is handed is a stub with the same transform-feedback output. What is measured
// is the source the app writes, and a software renderer takes minutes to compile and draw these programs.
// test/lib/late_links.js's KHR_parallel_shader_compile makes the app take a GPU's background-link paths.
// --ref: the build of another commit too (ci/reference.js), walked the same way. Exit 1 when a stage of this build is
// over NEW_KB and its program is new, or is over GROW_KB and grew by more than GROW. A program is its name, map mode and
// key (GLR.profile() keeps the key's first 40 characters), with the rest of an inverse program's key read from its source
// (variantOf) and, for a chain's program, the scene that linked it (sceneOf: two chains can share those 40 characters).
// A program only this build's walk linked, of a name and a key the reference's walk linked too, is listed apart, never
// failed: the walk, not the code, differs. Sources that share an id are one program at the larger size of each.
// --pages N: the browsers that walk at a time (default: one per 2 CPUs and 4 GB, at least 1).
// Prints the largest programs with their top functions (copies × own size) and their flagged loops (the loops with a
// constant trip bound whose body calls into the chain, which FXC can unroll); --json FILE writes every program.
// Exit 0 pass, 1 a program over the limits, 2 a setup problem.
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ROOT, PY, serve, summary, run, esc } = require('./lib');
const { buildReference } = require('./reference');
const { PAGES } = require('./browser_suites');
const SC = require('./steps_scenes');
const { inline } = require('./glsl_inline');
const { launch, sleep } = require('../test/regress/perf/cdp');

// the --ref limits: a new program over NEW_KB, or growth by more than GROW of one over GROW_KB (each stage; 1 KB = 1024
// characters). NEW_KB is the size that links in about 30 s on an Iris Xe laptop (#238: 62–76 KB took 8–29 s)
const KB = 1024, LIMITS = { NEW_KB: 100, GROW_KB: 40, GROW: 1.2 };
// the typed formulas, a page each list: an op of each kind the exact images invert (NEWT, NEWT^3, SIN·EXP, IPOW·LOG,
// JOUK), a special function, and a sum of 10 terms (its globe glide was the largest program of the #1545 survey). A page
// has one formula Newton inverts (NEWT): a second one would find the first one's inverse program under its id (#1578)
const TYPED = [['sin(z)/z', 'z^3-2z+1', 'exp(sin(z))'], ['gamma(z)', 'log(z^2+1)'],
  ['sin(z)+cos(2z)+exp(z/3)+log(z+2)+z^5+1/(z-1)+sqrt(z)+tan(z/2)+sinh(z)+z^2*exp(-z)', 'z+1/z']];
// a step is settled when no link is pending, the steps view is ready (its programs and its warm-up draw: svReady), the
// app's background warm-up has started every group (the deformation's, the globe's and the Landscape's programs:
// __cmwWarm's phase 'done') and no link has started for QUIET_MS; one still linking after STEP_MS is left as it is. A
// page's last step waits DRAIN_MS.
const QUIET_MS = 800, DRAIN_MS = 3000, STEP_MS = 30000;
const GB = 1024 ** 3;
const PAGES_AT_ONCE = Math.max(1, Math.min(Math.floor(os.cpus().length / 2), Math.floor(os.totalmem() / (4 * GB))));
const TOP = 20;

// in the page, before the app: each program's stages recorded at linkProgram (window.__fxcLinks: [vs, fs]), and the GL
// handed stubs (a vertex stage keeps the transform feedback's tfOut, with its type)
const CAPTURE = `(() => {
  const P = WebGL2RenderingContext.prototype, shaderSource = P.shaderSource, attachShader = P.attachShader, linkProgram = P.linkProgram;
  const text = new WeakMap(), stages = new WeakMap();
  window.__fxcLinks = [];
  P.shaderSource = function (s, src) {
    const frag = this.getShaderParameter(s, this.SHADER_TYPE) === this.FRAGMENT_SHADER, tf = /\\bout\\s+(\\w+)\\s+tfOut\\s*;/.exec(src);
    text.set(s, { frag, src });
    return shaderSource.call(this, s, frag ? '#version 300 es\\nprecision highp float;\\nout vec4 o;\\nvoid main() { o = vec4(0.0); }\\n'
      : '#version 300 es\\n' + (tf ? 'out ' + tf[1] + ' tfOut;\\n' : '') + 'void main() { gl_Position = vec4(0.0); gl_PointSize = 1.0;' + (tf ? ' tfOut = ' + tf[1] + '(0.0);' : '') + ' }\\n');
  };
  P.attachShader = function (p, s) { if (!stages.has(p)) stages.set(p, []); stages.get(p).push(s); return attachShader.call(this, p, s); };
  P.linkProgram = function (p) {
    const t = (stages.get(p) || []).map((s) => text.get(s) || { src: '' }), vs = t.find((x) => !x.frag), fs = t.find((x) => x.frag);
    window.__fxcLinks.push([vs ? vs.src : '', fs ? fs.src : '']);
    return linkProgram.call(this, p);
  };
})();
`;
const LATE_LINK_MS = 100;
const INJECT = `window.__lateLinkMs = ${LATE_LINK_MS};\n${fs.readFileSync(path.join(ROOT, 'test', 'lib', 'late_links.js'), 'utf8')}\n${CAPTURE}`;
const APP = "typeof GLR === 'object' && typeof GLR.profile === 'function' && typeof __cmwExample === 'function' && typeof __cmwSteps === 'function'";
const SHAPES = [{ id: 's1', kind: 'disc', c: [0, 0], r: 0.9, ci: 0, visible: true }];
const savedState = (expr) => ({ v3: true, v4: true, shapes: SHAPES, steps: [{ type: 'custom', params: { expr, cut: 180 }, on: true }], nextId: 50, focus: 0, rightMode: 'image' });
// a formula pasted into the step's field (its input, then its change: applied and committed)
const paste = (f) => `(() => { const i = document.querySelector('input[data-pkey="expr"]'); if (!i) return false; i.value = ${JSON.stringify(f)};
  i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`;
// a chain's first glide on the plane and on the globe (parked halfway, so its programs are drawn until they have
// linked), and its Landscape: [label, statement]
// (plane 1 jumped to: the programs at rest there, none of a glide's frames in between, whose timing varies)
const PARK = '__cmwSteps({ park: 0.5 })', PLANE_1 = '(__cmwSteps({ go: 1, now: true }), true)';
const fourScenes = (tag) => [[`${tag}: glide`, PARK], [`${tag}: plane 1`, PLANE_1], [`${tag}: globe`, `(${SC.glideBack()}, ${SC.surface('sphere')})`],
  [`${tag}: globe glide`, PARK], [`${tag}: Landscape`, `(${SC.glideBack()}, ${SC.surface('plane')}, ${SC.main('land')})`], [`${tag}: back`, SC.main('xy')]];
// the pages, each walked in a browser of its own (some at a time: walk): { formula (the step the page opens with;
// none: the default example), steps: [label, statement] (the first: the page as it opens) }
function pages(names) {
  const half = Math.ceil(names.length / 2), open = ['the default example', null];
  const examples = (from, to) => names.slice(from, to).map((n, i) => [`example ${from + i} (${n})`, `__cmwExample(${from + i})`]);
  const typed = (list) => list.flatMap((f, i) => [[`typed ${f}`, i ? paste(f) : null], ...fourScenes(`typed ${f}`)]);
  return [{ steps: [open, ...fourScenes(open[0])] }, { steps: [open, ...examples(0, half)] }, { steps: [open, ...examples(half)] },
    ...TYPED.map((list) => ({ formula: list[0], steps: typed(list) }))];
}

// one page's walk -> { renderer, steps: [{ label, ms, links }], links: [{ step, name, key, mode, inv, vs, fs }] }
async function walkPage(base, page) {
  const B = await launch({ inject: INJECT });
  const out = { renderer: '', steps: [], links: [] };
  let n0 = 0;   // (the links read so far)
  const settle = async (label, quiet) => {
    const s0 = Date.now();
    for (let n = -1, since = s0; ;) {
      await sleep(100);
      const s = await B.ev(`({ n: __fxcLinks.length, pending: GLR.pendingLinks, ready: (() => { const r = __cmwSteps().ready; return r.ready || !r.total; })()
        && (typeof __cmwWarm !== 'function' || __cmwWarm().phase === 'done') })`);
      if (s.n !== n) { n = s.n; since = Date.now(); }
      if ((!s.pending && s.ready && Date.now() - since >= quiet) || Date.now() - s0 > STEP_MS) break;
    }
    // (GLR.profile() has a record per linkProgram call, in the same order: their sizes must agree)
    const recs = await B.ev(`(() => { const p = GLR.profile(), l = __fxcLinks; return p.length !== l.length ? { p: p.length, l: l.length } : p.slice(${n0}).map((r, i) => Object.assign(r, { src: l[${n0} + i] })); })()`);
    if (!Array.isArray(recs)) throw new Error(`${label}: GLR.profile() has ${recs.p} links, the capture ${recs.l}`);
    for (const r of recs) {
      if (r.vs !== r.src[0].length || r.fs !== r.src[1].length) throw new Error(`${label}: ${r.name}'s sources and its GLR.profile() record differ`);
      out.links.push({ step: label, name: r.name, key: r.key, mode: r.mode, inv: r.inv, vs: r.src[0], fs: r.src[1] });
    }
    n0 += recs.length;
    out.steps.push({ label, ms: Date.now() - s0, links: recs.length });
    console.log(`[fxc_size] ${label}: ${recs.length} links, ${((Date.now() - s0) / 1000).toFixed(1)} s`);
  };
  try {
    const ns = `fxc${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
    if (page.formula) {
      await B.nav(`${base}blank.html`);
      await B.ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(savedState(page.formula)))}); 1`);
    }
    await B.nav(`${base}test.html?glprof&view=steps&ns=${ns}`);
    await B.until(APP, 120000, 100);
    out.renderer = await B.ev("(() => { const g = document.createElement('canvas').getContext('webgl2'), x = g && g.getExtension('WEBGL_debug_renderer_info'); return x ? g.getParameter(x.UNMASKED_RENDERER_WEBGL) : ''; })()");
    for (const [i, [label, js]] of page.steps.entries()) {
      if (js && !(await B.ev(js))) throw new Error(`${label}: the page did not take the step`);
      await settle(label, i === page.steps.length - 1 ? DRAIN_MS : QUIET_MS);
    }
  } finally { await B.close(); }
  return out;
}
// one build's walk, `at` pages at a time: its pages' links in the pages' order -> { renderer, ms, steps, links, memory
// (the machine's memory in use, at the start and at its peak, sampled each second) }
async function walk(base, root, at) {
  const t0 = Date.now(), list = pages(SC.exampleNames(root)), done = [];
  const used = () => os.totalmem() - os.freemem(), memory = { start: used(), peak: used() };
  const sampler = setInterval(() => { memory.peak = Math.max(memory.peak, used()); }, 1000);
  let next = 0;
  const browser = async () => { while (next < list.length) { const i = next++; done[i] = await walkPage(base, list[i]); } };
  try { await Promise.all(Array.from({ length: at }, browser)); } finally { clearInterval(sampler); }
  return { renderer: done[0].renderer, ms: Date.now() - t0, steps: done.flatMap((d) => d.steps), links: done.flatMap((d) => d.links), memory };
}

// one stage sized: { src (characters), size (inlined), top: [[function, copies, own]...], loops }
function stage(src) {
  if (!src) return { src: 0, size: 0, top: [], loops: [] };
  const r = inline(src);
  const top = [...r.copies].map(([fn, k]) => [fn, k, r.own.get(fn)]).sort((a, b) => b[1] * b[2] - a[1] * a[2]).slice(0, 8);
  return { src: src.length, size: r.size, top, loops: r.loops };
}
// what an inverse program's key holds past GLR.profile()'s 40 characters, read from its fragment stage: the carried,
// staged and NR-pass variants and the B class (src/gl/07-inverse-api.js, invProgKey); '' for any other program
function variantOf(fsSrc) {
  const b = /\bconst int IX_B = (\d+);/.exec(fsSrc);
  if (!b) return '';
  const on = (d) => new RegExp(`^#define ${d}\\b`, 'm').test(fsSrc);
  return [on('IX_CARRY') && 'carry', on('IX_STAGED') && 'staged', on('IX_NR_PASS') && 'nr', `B${b[1]}`].filter(Boolean).join(',');
}
// the scene a step belongs to: a formula or an example (its label before the first ': ')
const sceneOf = (step) => step.split(': ')[0];
// a walk's links as programs, one per id (above), each stage sized once; sources sharing an id (sources > 1) are one
// program at the larger size of each stage
function programs(links) {
  const rows = new Map(), seen = new Set(), sized = new Map();
  const hash = (s) => crypto.createHash('sha1').update(s).digest('hex');
  const sizeOf = (src) => { const h = hash(src); if (!sized.has(h)) sized.set(h, stage(src)); return sized.get(h); };
  for (const l of links) {
    const variant = variantOf(l.fs);
    const id = `${l.name}|m${l.mode}|${l.key}${variant ? '|' + variant : ''}${l.key === 'static' ? '' : ' @ ' + sceneOf(l.step)}`;
    const h = hash(id + '\0' + l.vs + '\0' + l.fs);
    const row = rows.get(id);
    if (seen.has(h)) { row.links++; continue; }
    seen.add(h);
    const vsSized = sizeOf(l.vs), fsSized = sizeOf(l.fs);
    if (!row) rows.set(id, { id, name: l.name, mode: l.mode, key: l.key, variant, inv: l.inv, scene: l.step, links: 1, sources: 1, vs: vsSized, fs: fsSized });
    else Object.assign(row, { links: row.links + 1, sources: row.sources + 1, vs: vsSized.size > row.vs.size ? vsSized : row.vs, fs: fsSized.size > row.fs.size ? fsSized : row.fs });
  }
  return [...rows.values()].sort((a, b) => big(b) - big(a));
}
const big = (p) => Math.max(p.vs.size, p.fs.size);

// this build's programs against the reference's -> { fails: the stages over the limits [{ id, scene, stage, now, was
// (null: new) }], walk: the programs only this walk linked whose name and key the reference's walk linked too }
function compare(head, ref) {
  const old = new Map(ref.map((p) => [p.id, p])), names = new Set(ref.map((p) => p.name)), keys = new Set(ref.map((p) => p.key));
  const fails = [], walkOnly = [];
  for (const p of head) {
    if (!old.has(p.id) && names.has(p.name) && keys.has(p.key)) { walkOnly.push(p); continue; }
    for (const st of ['vs', 'fs']) {
      const now = p[st].size, was = old.has(p.id) ? old.get(p.id)[st].size : null;
      if (was === null ? now > LIMITS.NEW_KB * KB : now > LIMITS.GROW_KB * KB && now > LIMITS.GROW * was) fails.push({ id: p.id, scene: p.scene, stage: st, now, was });
    }
  }
  return { fails, walk: walkOnly };
}

const k1 = (n) => (n / KB).toFixed(1);
const progLabel = (p) => `${p.name} m${p.mode} \`${esc(p.key)}\`${p.variant ? ` ${p.variant}` : ''}`;
function report(head, ref, { fails, walk: walkOnly }) {
  const L = [`### Inlined program sizes, as FXC sees them (${head.renderer || 'unknown renderer'})`, '',
    `${head.programs.length} programs (${head.links.length} links) over ${head.steps.length} steps, ${(head.ms / 1000).toFixed(0)} s,`
    + ` ${head.at} pages at a time; the machine's memory in use: ${(head.memory.peak / GB).toFixed(1)} GB at the peak`
    + ` (${(head.memory.start / GB).toFixed(1)} GB at the start) of ${(os.totalmem() / GB).toFixed(1)} GB.`
    + ' KB: characters / 1024 with every call expanded; source: vs + fs as written.', '',
    '| # | program | scene | fs KB | vs KB | source KB | top functions (copies × KB) | loops |', '|---|---|---|---|---|---|---|---|'];
  head.programs.slice(0, TOP).forEach((p, i) => {
    const s = p.fs.size >= p.vs.size ? p.fs : p.vs;
    const top = s.top.slice(0, 4).map(([fn, k, own]) => `${fn} ×${k} ${k1(k * own)}`).join(', ');
    L.push(`| ${i + 1} | ${progLabel(p)} | ${esc(p.scene)} | ${k1(p.fs.size)} | ${k1(p.vs.size)} | ${k1(p.vs.src + p.fs.src)} | ${top} | ${p.vs.loops.length + p.fs.loops.length} |`);
  });
  const loops = new Map();
  for (const p of head.programs.slice(0, TOP)) {
    for (const l of [...p.vs.loops, ...p.fs.loops]) {
      const k = `${l.fn}|${l.bound}`;
      if (!loops.has(k)) loops.set(k, Object.assign({ programs: 0 }, l));
      loops.get(k).programs++;
    }
  }
  if (loops.size) {
    L.push('', `Loops with a constant trip bound whose body calls into the chain, in those ${TOP} (FXC can unroll them, #414):`, '',
      '| function | bound | trips | one trip KB | calls into the chain | programs |', '|---|---|---|---|---|---|');
    for (const l of loops.values()) L.push(`| ${l.fn} | \`${esc(l.bound)}\` | ${l.trip === null ? '?' : l.trip} | ${k1(l.size)} | ${l.chain.join(', ')} | ${l.programs} |`);
  }
  if (ref) {
    const old = new Map(ref.programs.map((p) => [p.id, p]));
    const moved = head.programs.filter((p) => old.has(p.id) && big(p) !== big(old.get(p.id)))
      .sort((a, b) => Math.abs(big(b) - big(old.get(b.id))) - Math.abs(big(a) - big(old.get(a.id)))).slice(0, TOP);
    const ids = new Set(head.programs.map((p) => p.id));
    L.push('', `Against the reference ${ref.sha.slice(0, 12)}: ${head.programs.filter((p) => !old.has(p.id)).length - walkOnly.length} programs new, `
      + `${walkOnly.length} linked by this walk only (their name and key are in the reference's walk), ${ref.programs.filter((p) => !ids.has(p.id)).length} gone`
      + `${walkOnly.length ? ` (this walk only: ${walkOnly.map((p) => `${p.id} ${k1(big(p))} KB`).join('; ')})` : ''}; ${moved.length ? 'the largest changes' : 'no size changed'}:`, '');
    if (moved.length) {
      L.push('| program | scene | reference KB | this build KB | change |', '|---|---|---|---|---|');
      for (const p of moved) { const a = big(old.get(p.id)), b = big(p); L.push(`| ${progLabel(p)} | ${esc(p.scene)} | ${k1(a)} | ${k1(b)} | ${b >= a ? '+' : ''}${((b / a - 1) * 100).toFixed(1)} % |`); }
    }
    L.push('', fails.length ? `**FAIL**: ${fails.length} stages over the limits (new over ${LIMITS.NEW_KB} KB, or over ${LIMITS.GROW_KB} KB and +${Math.round((LIMITS.GROW - 1) * 100)} %):` : `PASS: no stage is new over ${LIMITS.NEW_KB} KB or grew past +${Math.round((LIMITS.GROW - 1) * 100)} % over ${LIMITS.GROW_KB} KB.`);
    for (const f of fails) L.push(`- ${f.id} ${f.stage} (${f.scene}): ${f.was === null ? 'new' : k1(f.was) + ' KB →'} ${k1(f.now)} KB`);
  }
  return L.join('\n') + '\n';
}

async function main() {
  const argv = process.argv.slice(2);
  const opt = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null);
  const REF = opt('--ref'), OUT = opt('--json'), AT = Number(opt('--pages')) || PAGES_AT_ONCE;
  if (!argv.includes('--no-build') && run(PY, ['build.py'])) process.exit(2);
  const sides = [{ root: ROOT, dist: path.join(ROOT, 'dist') }];
  if (REF) { const R = buildReference(REF); sides.push({ root: R.dir, dist: R.dist, sha: R.sha }); }
  for (const s of sides) {
    PAGES['blank.html'](s.dist, 'blank.html');
    const { server, base } = await serve(s.dist);
    try { Object.assign(s, await walk(base, s.root, AT), { at: AT }); } finally { server.close(); }
    s.programs = programs(s.links);
    console.log(`[fxc_size] ${s.sha ? 'reference ' + s.sha.slice(0, 12) : 'this build'}: ${s.programs.length} programs, ${s.links.length} links, ${(s.ms / 1000).toFixed(0)} s,`
      + ` ${AT} pages at a time, memory in use ${(s.memory.peak / GB).toFixed(1)} GB at the peak (${(s.memory.start / GB).toFixed(1)} GB at the start)`);
  }
  const [head, ref] = sides;
  const verdict = ref ? compare(head.programs, ref.programs) : { fails: [], walk: [] }, { fails } = verdict;
  const md = report(head, ref, verdict);
  summary(md);
  if (process.env.GITHUB_STEP_SUMMARY) console.log(md);
  if (OUT) {
    const side = (s) => ({ sha: s.sha || null, renderer: s.renderer, ms: s.ms, at: s.at, memory: s.memory, steps: s.steps, programs: s.programs });
    fs.writeFileSync(OUT, JSON.stringify({ when: new Date().toISOString(), limits: LIMITS, head: side(head), ref: ref ? side(ref) : null, fails, walkOnly: verdict.walk.map((p) => p.id) }, null, 1));
    console.log(`[fxc_size] wrote ${OUT}`);
  }
  process.exit(fails.length ? 1 : 0);
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(2); });
module.exports = { compare, programs, LIMITS };
