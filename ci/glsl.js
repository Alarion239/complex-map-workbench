'use strict';
// The GLSL conformance tests (GPU against CPU) in headless Chrome, on this platform's shader compiler (ANGLE Metal on
// macOS, Direct3D 11 on Windows, SwiftShader on Linux; CMW_ANGLE overrides it):
//   dist/glsl-test.html          test/glsl_test.js      (window.__glslTest)
//   dist/glsl-test-adv.html      test/glsl_test_adv.js  (window.__glslTest)
//   dist/glsl-inverse-test.html  test/glsl_inverse_test.js, run by __invTestRun() (window.__invTest)
//   node ci/glsl.js [--only glsl|adv|inverse] [--part i/n]
// --part i/n: every n-th chain of the glsl and adv pages, from the i-th (their ?parts=n&part=i-1: CI splits these long
// pages, slow on software rendering, into jobs); the inverse page runs whole (its chains come from one seeded
// sequence). Exit 0 pass, 1 a failure, 2 setup problem. The pass rules are those of the command files
// (test/glsl_inverse_cmd.js).
const fs = require('fs');
const path = require('path');
const { ROOT, PY, serve, summary, run, esc } = require('./lib');
const { launch, sleep } = require('../test/regress/perf/cdp');

const PAGES = [
  { id: 'glsl', make: 'test/make_glsl_test.py', page: 'glsl-test.html' },
  { id: 'adv', make: 'test/make_glsl_test_adv.py', page: 'glsl-test-adv.html' },
  { id: 'inverse', make: 'test/make_glsl_inverse_test.py', page: 'glsl-inverse-test.html' },
];
const arg = (k) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : null);
const only = arg('--only');
const [pi, pn] = (arg('--part') || '1/1').split('/').map(Number);
const TIMEOUT = 240 * 60 * 1000;   // (the job's own timeout is the real limit)

async function waitFor(B, expr, timeout) {
  const t0 = Date.now();
  for (;;) {
    const v = await B.ev(expr);
    if (v) return v;
    if (Date.now() - t0 > timeout) throw new Error(`timeout after ${Math.round(timeout / 1000)} s`);
    await sleep(500);
  }
}

async function main() {
  const pages = PAGES.filter((p) => !only || p.id === only);
  fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });   // (the page builders write there; a fresh checkout has none)
  for (const p of pages) if (run(PY, [p.make]) !== 0) throw new Error(`${p.make} failed`);
  const srv = await serve(path.join(ROOT, 'dist'));
  const rows = [];
  let failed = 0;
  try {
    for (const p of pages) {
      const B = await launch({ width: 1200, height: 800 });
      const t0 = Date.now();
      let r = null, pass = false, note = '';
      try {
        if (p.id === 'inverse') {
          await B.nav(srv.base + p.page);
          await B.ev(`(() => { window.__ci = undefined; Promise.resolve().then(() => __invTestRun({})).then((v) => { window.__ci = JSON.stringify(v); }, (e) => { window.__ci = JSON.stringify({ errors: [String(e && e.stack || e)] }); }); return 1; })()`);
          r = JSON.parse(await waitFor(B, 'window.__ci', TIMEOUT));
          pass = r.failCount === 0 && r.clip && r.clip.failCount === 0 && r.fs && r.fs.flat && r.fs.sphere && (!r.flip || r.flip.ok) && !(r.errors || []).length;
          note = `walk ${r.compared ?? '?'} compared, ${r.failCount ?? '?'} failed; clip ${r.clip ? r.clip.failCount : '?'} failed; fs flat ${r.fs && r.fs.flat}, sphere ${r.fs && r.fs.sphere}`;
        } else {
          await B.nav(srv.base + p.page + (pn > 1 ? `?parts=${pn}&part=${pi - 1}` : ''));
          await waitFor(B, 'window.__glslTest && window.__glslTest.done', TIMEOUT);
          r = await B.ev('(() => { const R = window.__glslTest; return { chains: R.chains, chainsTotal: R.chainsTotal, programs: R.programs, compared: R.compared, failCount: R.failCount, errors: R.errors, failures: (R.failures || []).slice(0, 10), failByChain: R.failByChain, singular: R.singular && { checked: R.singular.checked, badCount: R.singular.badCount }, ms: R.ms }; })()');
          pass = r.failCount === 0 && !(r.errors || []).length && !(r.singular && r.singular.badCount);
          note = `${r.chains}/${r.chainsTotal} chains, ${r.programs} programs, ${r.compared} values compared, ${r.failCount} failed${r.singular ? `, ${r.singular.badCount} bad singular` : ''}`;
        }
        r.renderer = await B.ev(`(() => { const gl = document.createElement('canvas').getContext('webgl2'); if (!gl) return null; const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); })()`);
        const exc = B.logs().filter((l) => l.t === 'EXC');
        if (exc.length) { pass = false; note += `; page exception: ${exc[0].m.slice(0, 200)}`; }
      } catch (e) { pass = false; note = String(e.message || e); } finally { await B.close(); }
      const s = ((Date.now() - t0) / 1000).toFixed(0);
      if (!pass) failed++;
      console.log(`${pass ? 'pass' : 'FAIL'} ${p.page} (${s} s): ${note}`);
      if (!pass) console.log(JSON.stringify(r, null, 1).slice(0, 6000));
      rows.push(`| ${pass ? '✅' : '❌'} | \`${p.page}\`${pn > 1 && p.id !== 'inverse' ? ` part ${pi}/${pn}` : ''} | ${s} s | ${esc(note)} |`);
      if (r && r.renderer) rows.renderer = r.renderer;
    }
  } finally { srv.server.close(); }
  summary([`### GLSL conformance (${process.platform}${rows.renderer ? `: ${esc(rows.renderer)}` : ''}): ${failed ? '❌' : '✅'}`, '', '| | page | time | result |', '|---|---|---|---|', ...rows, ''].join('\n'));
  return failed ? 1 : 0;
}
main().then((rc) => process.exit(rc), (e) => { console.error(e); summary(`### GLSL conformance: setup problem\n\n\`${esc(String(e.message || e))}\`\n`); process.exit(2); });
