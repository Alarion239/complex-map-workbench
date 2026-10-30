'use strict';
// The published page (dist/complex-map-workbench.html, what pages.yml deploys) is the test page without its test hooks:
// build.py drops every block from "// TEMP-DEBUG-HOOK (removed before publishing)" to the next "// TEMP-DEBUG-HOOK".
// A start marker that lost its end marker (a block moved out of app.js took the end with it, wave 3) drops everything
// up to the next end marker, thousands of lines, and the published script no longer parses, while every other test
// runs the test page and passes. This builds both pages and compiles each script of the published one (syntax only),
// and checks that each dropped block is a hook: no longer than HOOK_MAX lines and holding no other start marker.
//   node test/t_publish.js
const fs = require('fs'), path = require('path'), vm = require('vm'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const { source } = require('./src_text');
let fails = 0;
const ok = (name, pass, detail) => { if (!pass) { fails++; console.log('FAIL ' + name, detail === undefined ? '' : JSON.stringify(detail).slice(0, 400)); } };
// the hook blocks as build.py finds them, per source file (a block never spans two files)
const START = '// TEMP-DEBUG-HOOK (removed before publishing)';
const RE = /\n[ \t]*\/\/ TEMP-DEBUG-HOOK \(removed before publishing\).*?\/\/ TEMP-DEBUG-HOOK\n/gs;
const HOOK_MAX = 300;   // lines: the longest hook block is about 240 (app.js's test helpers at the end of init)
const files = fs.readdirSync(path.join(ROOT, 'src')).filter((n) => n.endsWith('.js') && !/^i18n_|^cyr|^seasong/.test(n));
for (const f of [...files, 'app.js', 'gl.js']) {
  let text;
  try { text = source(f); } catch (e) { continue; }
  let m, n = 0;
  RE.lastIndex = 0;
  while ((m = RE.exec(text))) {
    n++;
    const lines = m[0].split('\n').length - 2, from = text.slice(0, m.index).split('\n').length + 1;
    ok(`${f}:${from}: a hook block of ${lines} lines (at most ${HOOK_MAX})`, lines <= HOOK_MAX, m[0].slice(0, 200));
    ok(`${f}:${from}: one start marker per block`, m[0].split(START).length === 2, m[0].slice(0, 200));
  }
  const starts = text.split(START).length - 1;
  ok(`${f}: every start marker has its end (${starts} start markers, ${n} blocks)`, starts === n, { starts, n });
}
// the pages themselves
execFileSync(process.env.PYTHON || 'python3', [path.join(ROOT, 'build.py')], { cwd: ROOT, stdio: 'pipe' });
const pub = fs.readFileSync(path.join(ROOT, 'dist', 'complex-map-workbench.html'), 'utf8');
const scripts = [...pub.matchAll(/<script>\n?([\s\S]*?)<\/script>/g)].map((x) => x[1]);
ok('the published page has its scripts', scripts.length >= 2, scripts.length);
scripts.forEach((s, i) => { try { new vm.Script(s, { filename: `published script ${i + 1}` }); } catch (e) { ok(`the published page's script ${i + 1} parses`, false, String(e.message)); } });
ok('no test hook left in the published page', !/__cmw/.test(scripts.join('\n')), null);
const test = fs.readFileSync(path.join(ROOT, 'dist', 'test.html'), 'utf8');
ok('the published script is the test script less its hooks (smaller, by less than a fifth)', pub.length < test.length && pub.length > 0.8 * test.length, { pub: pub.length, test: test.length });
// the offline page (issue #21, option b): the published page with MathJax and the faces inline, and nothing from a CDN;
// the published page names its size for Settings (Download offline page)
const off = fs.readFileSync(path.join(ROOT, 'dist', 'complex-map-workbench-offline.html'), 'utf8');
const offScripts = [...off.matchAll(/<script>\n?([\s\S]*?)<\/script>/g)].map((x) => x[1]);
offScripts.forEach((s, i) => { try { new vm.Script(s, { filename: `offline script ${i + 1}` }); } catch (e) { ok(`the offline page's script ${i + 1} parses`, false, String(e.message)); } });
ok('the offline page runs the published script', offScripts.length === scripts.length + 1 && offScripts.includes(scripts[scripts.length - 1]), { offline: offScripts.length, published: scripts.length });
ok('the offline page has MathJax and the faces inline', /id="cmw-mathjax"/.test(off) && /<style id="cmw-fonts">/.test(off) && /id="cmw-fonts-ru"/.test(off), null);
ok('the offline page has the PDF library inline, under the ids figure.js looks for', /id="cmw-jspdf"/.test(off) && /id="cmw-svg2pdf"/.test(off) && /jspdf\.umd\.min\.js["'], ["']cmw-jspdf["']\)/.test(pub) && /svg2pdf\.umd\.min\.js["'], ["']cmw-svg2pdf["']\)/.test(pub), null);
// (its tags: the scripts keep the live page's CDN URLs as strings, used only where the inline faces are missing;
// test/offline_cmd.js opens it with the network off and counts the requests)
ok('the offline page has no CDN tag', !/<(?:link|script)\b[^>]*(?:fonts\.googleapis\.com|fonts\.gstatic\.com|ajax\/libs\/mathjax)/.test(off), (off.match(/<(?:link|script)\b[^>]*(?:fonts\.g|mathjax)[^>]*>/g) || []).slice(0, 5));
ok('the offline page offers no download of itself', !/<meta name="cmw-offline"/.test(off), null);
const named = /<meta name="cmw-offline" content="(\d+)">/.exec(pub);
ok('the published page names the offline page\'s size', named && Number(named[1]) === Buffer.byteLength(off), { named: named && named[1], bytes: Buffer.byteLength(off) });
// the built pages' size budget (bytes), raised only on purpose: the published page is what every visit loads; the
// offline page is it plus MathJax (2.2 MB as a JSON block), the faces (0.7 MB as base64) and the PDF library (jsPDF
// and svg2pdf.js, 0.47 MB, #393), about 3.3 MB more
const BUDGET = { 'complex-map-workbench.html': 5.25e6, 'complex-map-workbench-offline.html': 8.75e6, offlineExtra: 3.6e6 };
const bytes = { 'complex-map-workbench.html': Buffer.byteLength(pub), 'complex-map-workbench-offline.html': Buffer.byteLength(off) };
for (const f of Object.keys(bytes)) ok(`dist/${f}: ${(bytes[f] / 1e6).toFixed(2)} MB, within its budget of ${BUDGET[f] / 1e6} MB`, bytes[f] <= BUDGET[f], bytes[f]);
const extra = bytes['complex-map-workbench-offline.html'] - bytes['complex-map-workbench.html'];
ok(`the offline page's MathJax, faces and PDF library: ${(extra / 1e6).toFixed(2)} MB, within ${BUDGET.offlineExtra / 1e6} MB`, extra > 0 && extra <= BUDGET.offlineExtra, extra);
console.log(fails ? `${fails} checks FAILED` : 'the published page: every script parses, hooks dropped whole; the offline page: its own MathJax and faces, within budget');
process.exit(fails ? 1 : 0);
