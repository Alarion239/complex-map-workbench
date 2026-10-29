'use strict';
// The GLSL conformance tests (GPU against CPU) in headless Chrome, on this platform's shader compiler (ANGLE Metal on
// macOS, Direct3D 11 on Windows, SwiftShader on Linux; CMW_ANGLE overrides it):
//   dist/glsl-test.html          test/glsl_test.js      (window.__glslTest)
//   dist/glsl-test-adv.html      test/glsl_test_adv.js  (window.__glslTest)
//   dist/glsl-inverse-test.html  test/glsl_inverse_test.js, run by __invTestRun() (window.__invTest)
//   node ci/glsl.js [--only glsl|adv|inverse] [--part i/n] [--tier core|deep|all] [--sections LIST] [--filter TEXT]
//                   [--ref <commit> [--absolute [PAGES]] [--force]]
// With --ref, a page whose inputs (its builder, its test file and the sources the builder reads) are the same as the
// reference's is not run (nothing to compare) unless --force.
// Without --ref, every page must pass outright (the rules of the command files, test/glsl_inverse_cmd.js): what the
// development Mac's GPU does. GPUs differ in the last bits of exp, sin and cos, and a few chains near removable
// singularities ((e^z - 1)/z, sin z / z) miss the tolerance on some (GitHub's virtual Mac GPU). With --ref the pages
// of the reference commit (built from its own tests and sources) run on the same machine too, and this change fails
// only where it is worse: a chain that fails more often, a new error, a check that held and no longer does.
// --absolute with --ref: both; --absolute glsl,inverse: both for those pages, paired only for the others (the
// self-hosted Mac: adv fails 304 values there, in 10 chains near removable singularities, as every release since v14
// and the reference do). --part i/n: every n-th chain of the glsl and adv pages (?parts=n&part=i-1); the inverse page
// runs whole (its chains come from one seeded sequence). --filter TEXT: only the glsl page's chains whose name holds
// TEXT (?filter=; to time a few chains' shaders on one platform). Exit 0 pass, 1 a failure, 2 setup problem.
const fs = require('fs');
const path = require('path');
const { ROOT, PY, serve, summary, run, esc } = require('./lib');
const { buildReference, sameApp } = require('./reference');
const { launch, sleep } = require('../test/regress/perf/cdp');
const { parts: srcParts } = require('../test/src_text');

const PAGES = [
  { id: 'glsl', make: 'test/make_glsl_test.py', page: 'glsl-test.html' },
  { id: 'adv', make: 'test/make_glsl_test_adv.py', page: 'glsl-test-adv.html' },
  { id: 'inverse', make: 'test/make_glsl_inverse_test.py', page: 'glsl-inverse-test.html' },
];
const argv = process.argv.slice(2);
const arg = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null);
const only = arg('--only');
const ref = arg('--ref');
const absArg = arg('--absolute');
const absPages = absArg && !absArg.startsWith('--') ? absArg.split(',') : null;   // (null: every page)
if (absPages && absPages.some((id) => !PAGES.some((p) => p.id === id))) { console.error(`--absolute: pages are ${PAGES.map((p) => p.id).join(', ')}`); process.exit(2); }
const absolute = (p) => !ref || (argv.includes('--absolute') && (!absPages || absPages.includes(p.id)));
const [pi, pn] = (arg('--part') || '1/1').split('/').map(Number);
// --sections: the adv page's sections to run (?only=: direct, keys, compile, main). --part splits only main, the
// chains; the others run whole, so in parts they would run once per part (on Windows' software renderer a part of
// the whole page took 34-61 min): CI runs `direct,keys,compile` once and `main` in parts
const sections = arg('--sections');
const filter = arg('--filter');
// --tier core|deep|all (default all): test/glsl_tiers.js. The parts go by the chains' names (hash), so a new chain moves
// no other one. A reference that predates the tiers (no test/glsl_tiers.js) runs its old way, the parts by index and
// every chain, and so does this change then (?legacy=1): both sides run the same chains
const tier = ['core', 'deep', 'all'].includes(arg('--tier')) ? arg('--tier') : 'all';
let legacy = false;
const TIMEOUT = 240 * 60 * 1000;   // (the job's own timeout is the real limit)
// a line every CMW_GLSL_PROGRESS_S seconds (default 60) while a page runs. The glsl and adv pages run in one
// synchronous task, so the page cannot say how far it is; the browser can say how busy its processes were since the
// last line: the GPU process (ANGLE and the driver compiling shaders, then the draws), the page (its JS and the CPU
// side of the tests), or neither (a hang)
const PROGRESS = (+process.env.CMW_GLSL_PROGRESS_S || 60) * 1000;
// CMW_GLSL_CACHE: a folder kept between runs (the GPU gate's own machines) for Chrome's profile with its GPU program
// cache on. A program is cached by its source, so one compiled before, for the reference, for this change or in an
// earlier run, is not compiled again. On Direct3D 11 compiling is nearly all of a page's time: on the Windows laptop
// (Iris Xe) 1/64 of the glsl page took 103 s cold, 94 s of it in links, and 7 s from the cache, with the same results.
// The pages compare values, not timings, so a warm cache changes nothing they check.
const CACHE = process.env.CMW_GLSL_CACHE || null;

async function waitFor(B, expr, timeout) {
  const t0 = Date.now();
  for (;;) {
    const v = await B.ev(expr);
    if (v) return v;
    if (Date.now() - t0 > timeout) throw new Error(`timeout after ${Math.round(timeout / 1000)} s`);
    await sleep(500);
  }
}

// what a page is built from: its builder, and the files the builder reads (the sources it names, its test file, the
// fixtures), read from the builder itself so the list follows it; a source kept as parts (gl.js) is its folder, src/gl
function inputsOf(p) {
  const make = fs.readFileSync(path.join(ROOT, p.make), 'utf8');
  const files = [...new Set([...make.matchAll(/'([\w.]+\.js)'/g)].map((m) => m[1]))]
    .map((n) => (fs.existsSync(path.join(ROOT, 'src', n)) ? `src/${n}` : srcParts(n) ? `src/${n.replace(/\.js$/, '')}` : `test/${n}`));
  return [p.make, 'ci/glsl.js', ...files, ...(/src_parts/.test(make) ? ['tools/src_parts.py'] : []), ...(/fixtures/.test(make) ? ['test/fixtures'] : [])];
}

// builds the pages in root (a checkout or the reference's worktree) with its own builders
function buildPages(root, pages) {
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });   // (the builders write there; a fresh checkout has none)
  for (const p of pages) if (run(PY, [p.make], { cwd: root }) !== 0) throw new Error(`${p.make} failed in ${root}`);
}

// the CPU seconds of the browser's GPU process and of its pages so far (null if the browser does not say)
async function cpuOf(B) {
  try {
    const c = { gpu: 0, page: 0 };
    for (const x of (await B.browser('SystemInfo.getProcessInfo')).processInfo) {
      if (x.type === 'GPU') c.gpu += x.cpuTime; else if (x.type === 'renderer') c.page += x.cpuTime;
    }
    return c;
  } catch { return null; }
}

// one page in a fresh browser -> { r (the page's result), note, ok (the outright rules), ms, cpu (seconds: gpu, page) }
// (side: 'this change' or 'reference', for the progress lines)
async function runPage(base, p, side) {
  let B = null;
  // (Chrome exits 21 while another Chrome still holds the profile: the previous page's, closing, or one a cancelled
  // job left behind; after three tries the page runs without the cache)
  for (let i = 0; CACHE && !B && i < 3; i++) {
    try { B = await launch({ width: 1200, height: 800, cache: CACHE }); } catch (e) {
      console.log(`the shader cache ${CACHE} did not open (${e.message || e})${i < 2 ? '; again in 10 s' : ': running without it'}`);
      if (i < 2) await sleep(10000);
    }
  }
  B = B || await launch({ width: 1200, height: 800 });
  const t0 = Date.now();
  const c0 = await cpuOf(B);
  let last = { t: t0, c: c0 }, cpu = null;
  console.log(`${p.page} (${side}): started`);
  const beat = setInterval(async () => {
    const c = await cpuOf(B), t = Date.now();
    if (!c || !last.c) return;
    const pct = (k) => `${Math.round((c[k] - last.c[k]) / ((t - last.t) / 1000) * 100)}%`;
    console.log(`  ${p.page} (${side}): ${Math.round((t - t0) / 60000)} min; CPU since the last line: GPU process ${pct('gpu')}, page ${pct('page')} (100% = one core)`);
    last = { t, c };
  }, PROGRESS);
  let r = null, ok = false, note = '';
  try {
    if (p.id === 'inverse') {
      await B.nav(base + p.page + (legacy ? '?legacy=1' : tier !== 'all' ? `?tier=${tier}` : ''));
      await B.ev(`(() => { window.__ci = undefined; Promise.resolve().then(() => __invTestRun({})).then((v) => { window.__ci = JSON.stringify(v); }, (e) => { window.__ci = JSON.stringify({ errors: [String(e && e.stack || e)] }); }); return 1; })()`);
      r = JSON.parse(await waitFor(B, 'window.__ci', TIMEOUT));
      ok = r.failCount === 0 && r.clip && r.clip.failCount === 0 && r.fs && r.fs.flat && r.fs.sphere && (!r.flip || r.flip.ok) && !(r.errors || []).length;
      note = `walk ${r.compared ?? '?'} compared, ${r.failCount ?? '?'} failed; clip ${r.clip ? r.clip.failCount : '?'} failed; fs flat ${r.fs && r.fs.flat}, sphere ${r.fs && r.fs.sphere}`;
    } else {
      const q = [...(pn > 1 ? [`parts=${pn}`, `part=${pi - 1}`] : []), ...(legacy ? ['legacy=1'] : tier !== 'all' ? [`tier=${tier}`] : []), ...(sections && p.id === 'adv' ? [`only=${sections}`] : []), ...(filter && p.id === 'glsl' ? [`filter=${encodeURIComponent(filter)}`] : [])];
      await B.nav(base + p.page + (q.length ? '?' + q.join('&') : ''));
      await waitFor(B, 'window.__glslTest && window.__glslTest.done', TIMEOUT);
      r = await B.ev('(() => { const R = window.__glslTest; return { chains: R.chains, chainsTotal: R.chainsTotal, programs: R.programs, compared: R.compared, failCount: R.failCount, errors: R.errors, failures: (R.failures || []).slice(0, 10), failByChain: R.failByChain, singular: R.singular && { checked: R.singular.checked, badCount: R.singular.badCount }, ms: R.ms }; })()');
      ok = r.failCount === 0 && !(r.errors || []).length && !(r.singular && r.singular.badCount);
      note = `${r.chains}/${r.chainsTotal} chains, ${r.programs} programs, ${r.compared} values compared, ${r.failCount} failed${r.singular ? `, ${r.singular.badCount} bad singular` : ''}`;
    }
    r.renderer = await B.ev(`(() => { const gl = document.createElement('canvas').getContext('webgl2'); if (!gl) return null; const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); })()`);
    const exc = B.logs().filter((l) => l.t === 'EXC');
    if (exc.length) { ok = false; r.exception = exc[0].m.slice(0, 300); note += `; page exception: ${r.exception}`; }
  } catch (e) { r = r || {}; r.setup = String(e.message || e); ok = false; note = r.setup; } finally {
    clearInterval(beat);
    const c = c0 && await cpuOf(B);
    if (c) cpu = { gpu: c.gpu - c0.gpu, page: c.page - c0.page };
    await B.close();
  }
  return { r, ok, note, ms: Date.now() - t0, cpu };
}

// ' (95 s; CPU: GPU process 60 s, page 30 s)'
const timeNote = (x) => ` (${(x.ms / 1000).toFixed(0)} s${x.cpu ? `; CPU: GPU process ${x.cpu.gpu.toFixed(0)} s, page ${x.cpu.page.toFixed(0)} s` : ''})`;

// where this change is worse than the reference on the same machine -> list of reasons
function worse(p, cur, rf) {
  const out = [];
  const c = cur.r || {}, f = rf.r || {};
  if (c.setup) return [`did not run: ${c.setup}`];
  if (c.exception && !f.exception) out.push(`page exception: ${c.exception}`);
  const fe = new Set(f.errors || []);
  for (const e of c.errors || []) if (!fe.has(e)) out.push(`new error: ${String(e).slice(0, 200)}`);
  const by = (x) => (p.id === 'inverse' ? x.byChain : x.failByChain) || {};
  const cb = by(c), fb = by(f);
  for (const [k, n] of Object.entries(cb)) {
    const m = typeof n === 'number' ? n : (n && n.fails) || 0, m0 = typeof fb[k] === 'number' ? fb[k] : (fb[k] && fb[k].fails) || 0;
    if (m > m0) out.push(`${k}: ${m} failed (reference ${m0})`);
  }
  if (p.id === 'inverse') {
    if ((c.failCount || 0) > (f.failCount || 0) && !out.length) out.push(`walk: ${c.failCount} failed (reference ${f.failCount})`);
    if (c.clip && f.clip && c.clip.failCount > f.clip.failCount) out.push(`clip: ${c.clip.failCount} failed (reference ${f.clip.failCount})`);
    for (const k of ['flat', 'sphere']) if (f.fs && f.fs[k] && !(c.fs && c.fs[k])) out.push(`fs ${k}: no longer matches`);
    if (f.flip && f.flip.ok && !(c.flip && c.flip.ok)) out.push('flip: no longer ok');
  } else {
    if ((c.failCount || 0) > (f.failCount || 0) && !out.length) out.push(`${c.failCount} failed (reference ${f.failCount})`);
    if ((c.singular?.badCount || 0) > (f.singular?.badCount || 0)) out.push(`bad singular ${c.singular.badCount} (reference ${f.singular?.badCount || 0})`);
  }
  return out;
}

async function main() {
  let pages = PAGES.filter((p) => !only || p.id === only);
  if (ref && !argv.includes('--force')) {
    const same = pages.filter((p) => sameApp(ref, inputsOf(p)));
    for (const p of same) console.log(`${p.page}: its inputs are the same as at ${ref} (${inputsOf(p).join(', ')}): nothing to compare`);
    pages = pages.filter((p) => !same.includes(p));
    if (!pages.length) {
      summary(`### GLSL conformance (${process.platform}): nothing to compare\n\nThe shader code and the tests of ${same.map((p) => `\`${p.page}\``).join(', ')} are the same as at \`${ref}\`.\n`);
      return 0;
    }
  }
  buildPages(ROOT, pages);
  const R = ref ? buildReference(ref) : null;
  if (R) buildPages(R.dir, pages);
  legacy = !!R && !fs.existsSync(path.join(R.dir, 'test', 'glsl_tiers.js'));
  if (legacy) console.log(`the reference predates test/glsl_tiers.js: both sides run its way (parts by index, every chain${tier !== 'all' ? `; --tier ${tier} not applied` : ''})`);
  const srv = await serve(path.join(ROOT, 'dist'));
  const rsrv = R ? await serve(path.join(R.dir, 'dist')) : null;
  const rows = [], details = [];
  let failed = 0, renderer = null;
  try {
    for (const p of pages) {
      const cur = await runPage(srv.base, p, 'this change');
      const rf = R ? await runPage(rsrv.base, p, 'reference') : null;
      const why = rf ? worse(p, cur, rf) : [];
      const pass = (!absolute(p) || cur.ok) && !why.length && !(cur.r && cur.r.setup);
      if (!pass) failed++;
      renderer = renderer || (cur.r && cur.r.renderer);
      const label = `\`${p.page}\`${legacy || tier === 'all' ? '' : ` ${tier}`}${sections && p.id === 'adv' ? ` ${sections}` : ''}${filter && p.id === 'glsl' ? ` filter ${filter}` : ''}${pn > 1 && p.id !== 'inverse' ? ` part ${pi}/${pn}` : ''}`;
      const s = (cur.ms / 1000).toFixed(0);
      console.log(`${pass ? 'pass' : 'FAIL'} ${p.page}${timeNote(cur)}: ${cur.note}${rf ? ` | reference${timeNote(rf)}: ${rf.note}` : ''}`);
      if (why.length) console.log('  worse than the reference:\n    ' + why.join('\n    '));
      if (!pass || (rf && !cur.ok)) console.log(JSON.stringify(cur.r, null, 1).slice(0, 6000));
      rows.push(`| ${pass ? '✅' : '❌'} | ${label} | ${s} s | ${esc(cur.note)} | ${rf ? esc(rf.note) : ''} |`);
      if (why.length) details.push(`**${label}: worse than the reference**\n\n${why.slice(0, 30).map((w) => `- ${esc(w)}`).join('\n')}`);
      else if (rf && !cur.ok) details.push(`${label}: fails some outright checks on this machine, as the reference does (${esc(cur.note)}): not gated here`);
    }
  } finally { srv.server.close(); if (rsrv) rsrv.server.close(); }
  summary([`### GLSL conformance (${process.platform}${renderer ? `: ${esc(renderer)}` : ''}${R ? `; against \`${R.sha.slice(0, 12)}\`` : ''}): ${failed ? '❌' : '✅'}`, '',
    `| | page | time | this change | ${R ? 'reference' : ''} |`, '|---|---|---|---|---|', ...rows, '', ...details, ''].join('\n'));
  return failed ? 1 : 0;
}
// (ci/impact.js reads the pages and their inputs)
if (require.main === module) main().then((rc) => process.exit(rc), (e) => { console.error(e); summary(`### GLSL conformance: setup problem\n\n\`${esc(String(e.message || e))}\`\n`); process.exit(2); });
module.exports = { PAGES, inputsOf };
