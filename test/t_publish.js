'use strict';
// The published page (dist/complex-map-workbench.html, what pages.yml deploys) is the test page without its test hooks:
// the build drops every block from the opening marker line to the next marker (tools/hook_marker.js), then the script's
// comments and indentation (tools/strip_js.js, test/t_strip_js.js), and the stylesheet's comments and spare whitespace
// (tools/strip_css.js, test/t_strip_css.js).
// A start marker without its end marker (a block moved out of app.js with the end left behind) drops everything
// up to the next end marker, thousands of lines, and the published script does not parse, while every other test
// runs the test page and passes. A marker outside a block (a plain pair, or a lone marker) drops nothing and the hook
// ships. This checks that every marker of the sources belongs to a block, that build.py carries the same expression,
// builds both pages and compiles each script of the published one (syntax only), and checks that each dropped block is
// a hook: at most HOOK_MAX lines long and holding no other start marker, and that no marker reaches the published page.
//   node test/t_publish.js
const fs = require('fs'), path = require('path'), vm = require('vm'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const { source } = require('./src_text');
let fails = 0;
const ok = (name, pass, detail) => { if (!pass) { fails++; console.log('FAIL ' + name, detail === undefined ? '' : JSON.stringify(detail).slice(0, 400)); } };
// the hook blocks as build.py finds them, per source file (a block never spans two files)
const { BLOCK: RE, BLOCK_SRC, ANY, OPENER } = require('../tools/hook_marker');
const RETIRED = 'TEMP-DEBUG' + '-HOOK';
const HOOK_MAX = 300;   // lines: the longest hook block is about 240 (app.js's test helpers at the end of init)
const files = fs.readdirSync(path.join(ROOT, 'src')).filter((n) => /\.[jt]s$/.test(n) && !/^i18n_|^seasong/.test(n));
for (const f of new Set([...files, 'app.js', 'gl.js'])) {
  let text;
  try { text = source(f); } catch (e) { continue; }
  let m, n = 0;
  RE.lastIndex = 0;
  while ((m = RE.exec(text))) {
    n++;
    const lines = m[0].split('\n').length - 2, from = text.slice(0, m.index).split('\n').length + 1;
    ok(`${f}:${from}: a hook block of ${lines} lines (at most ${HOOK_MAX})`, lines <= HOOK_MAX, m[0].slice(0, 200));
    ok(`${f}:${from}: one start marker per block`, (m[0].match(OPENER) || []).length === 1, m[0].slice(0, 200));
  }
  // the retired alias is no longer dropped from the page: a block in it would ship its hook
  ok(`${f}: no marker in the retired spelling`, !text.includes(RETIRED), null);
  const starts = (text.match(OPENER) || []).length;
  ok(`${f}: every start marker has its end (${starts} start markers, ${n} blocks)`, starts === n, { starts, n });
  // every marker is one end of a block: a plain pair or a lone marker would leave its code in the page
  const markers = (text.match(ANY) || []).length;
  ok(`${f}: every hook marker belongs to a block (${markers} markers, ${n} blocks)`, markers === 2 * n, { markers, blocks: n });
}
// a marked pair is one block, and a plain pair is none
{
  const strip = (t) => t.replace(RE, '\n');
  const code = (a, b) => `a;\n  ${a}\n  hook();\n  ${b}\nb;\n`;
  ok('a TEST-HOOK pair is dropped', strip(code('// TEST-HOOK (dropped from the published page by build.py)', '// TEST-HOOK')) === 'a;\nb;\n', strip(code('// TEST-HOOK (dropped from the published page by build.py)', '// TEST-HOOK')));
  ok('a plain pair is not dropped', strip(code('// TEST-HOOK', '// TEST-HOOK')).includes('hook();'), null);
  ok('a plain pair counts as two markers and no block', (code('// TEST-HOOK', '// TEST-HOOK').match(ANY) || []).length === 2 && (code('// TEST-HOOK', '// TEST-HOOK').match(RE) || []).length === 0, null);
}
// the pages themselves
execFileSync(process.env.PYTHON || 'python3', [path.join(ROOT, 'build.py')], { cwd: ROOT, stdio: 'pipe' });
const py = fs.readFileSync(path.join(ROOT, 'build.py'), 'utf8');
ok('build.py drops the blocks by the same expression', py.includes(`re.sub(r'${BLOCK_SRC}'`), null);
ok('build.py checks that no hook marker is left in the published script', /assert 'TEST-HOOK' not in pub_js,/.test(py), null);
const pub = fs.readFileSync(path.join(ROOT, 'dist', 'complex-map-workbench.html'), 'utf8');
const scripts = [...pub.matchAll(/<script>\n?([\s\S]*?)<\/script>/g)].map((x) => x[1]);
ok('the published page has its scripts', scripts.length >= 2, scripts.length);
scripts.forEach((s, i) => { try { new vm.Script(s, { filename: `published script ${i + 1}` }); } catch (e) { ok(`the published page's script ${i + 1} parses`, false, String(e.message)); } });
ok('no test hook left in the published page', !/__cmw/.test(scripts.join('\n')), null);
ok('no hook marker left in the published page', !scripts.some((x) => (x.match(ANY) || []).length), scripts.map((x) => (x.match(ANY) || []).length));
// (#2012) the app's script ships without comments or indentation (tools/strip_js.js): no comment, and no gap between two
// tokens holds more than one line break or one space; strings, regexes and template literals (the GLSL) are tokens, kept
{
  const app = scripts[scripts.length - 1], gaps = { comments: 0, wide: 0 };
  let last = 0;
  require('acorn').parse(app, { ecmaVersion: 'latest', onComment: () => { gaps.comments++; }, onToken: (t) => { if (t.type.label === 'eof') return; const g = app.slice(last, t.start); if (g && g !== ' ' && g !== '\n') gaps.wide++; last = t.end; } });
  ok('the published app script has no comment (tools/strip_js.js)', gaps.comments === 0, gaps.comments);
  ok('… and no indentation: each gap between two tokens is one line break or one space', gaps.wide === 0, gaps.wide);
  // (#2037) the GLSL in template strings ships without its comments: the GLSL templates are marked (glsl`…`,
  // src/glsl.js), and their strings hold no `//` but one that runs on into a value ${…} (kept: tools/strip_js.js);
  // all the template strings together hold at most TEMPLATE_COMMENT_MAX bytes of `//` to a line's end, the text and
  // URLs of the templates that are not GLSL (about 1 kB) with those few
  const GLSL_TEMPLATES_MIN = 80, TEMPLATE_COMMENT_MAX = 2000;
  const tpl = { glsl: 0, glslComments: 0, commentBytes: 0 };
  const walk = (nd, inGlsl) => {
    if (!nd || typeof nd.type !== 'string') return;
    if (nd.type === 'TaggedTemplateExpression' && nd.tag.type === 'Identifier' && /^glsl\d*$/.test(nd.tag.name)) {
      tpl.glsl++;
      for (const q of nd.quasi.quasis) {
        const lines = q.value.raw.split('\n');
        lines.forEach((l, i) => { if (l.includes('//') && (q.tail || i < lines.length - 1) && !/\\$/.test(l)) tpl.glslComments++; });
      }
    }
    if (nd.type === 'TemplateLiteral') for (const q of nd.quasis) for (const m of q.value.raw.match(/\/\/[^\n]*/g) || []) tpl.commentBytes += m.length;
    for (const k in nd) {
      const v = nd[k];
      if (Array.isArray(v)) { for (const x of v) walk(x); } else if (v && typeof v.type === 'string') walk(v);
    }
  };
  walk(require('acorn').parse(app, { ecmaVersion: 'latest' }));
  ok(`the published app script marks its GLSL templates (glsl\`…\`: at least ${GLSL_TEMPLATES_MIN})`, tpl.glsl >= GLSL_TEMPLATES_MIN, tpl);
  ok('… and their strings hold no `//` comment but one that runs on into a value', tpl.glsl > 0 && tpl.glslComments === 0, tpl);
  ok(`the published app script's template strings hold at most ${TEMPLATE_COMMENT_MAX} bytes of \`//\` to a line's end`, tpl.commentBytes <= TEMPLATE_COMMENT_MAX, tpl);
}
// the stylesheet ships without its comments and spare whitespace (tools/strip_css.js, test/t_strip_css.js): no comment
// but an empty one that parts two names, and no gap but one line break or one space; the offline page has the same
const sheetOf = (page) => { const m = page.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '').match(/<style>[\s\S]*?<\/style>/g) || []; return m.length === 1 ? m[0].slice('<style>'.length, -'</style>'.length) : null; };
{
  const css = sheetOf(pub), gaps = css == null ? [] : require('../tools/strip_css').lex(css).filter((x) => x.gap);
  ok('the published page has its one stylesheet (outside its scripts)', css != null && css.length > 0, css && css.length);
  ok('the published stylesheet has no comment (tools/strip_css.js)', gaps.every((x) => !x.text.replace(/\/\*\*\//g, '').includes('/*')), gaps.filter((x) => x.text.includes('/*')).length);
  ok('… and no spare whitespace: each gap between two tokens is one line break or one space', gaps.every((x) => x.text === ' ' || x.text === '\n' || x.text === '/**/'), gaps.filter((x) => x.text !== ' ' && x.text !== '\n' && x.text !== '/**/').length);
}
const test = fs.readFileSync(path.join(ROOT, 'dist', 'test.html'), 'utf8');
ok('the published script is the test script less its hooks (smaller, by less than a fifth)', pub.length < test.length && pub.length > 0.8 * test.length, { pub: pub.length, test: test.length });
// the offline page (issue #21, option b): the published page with MathJax and the faces inline, and nothing from a CDN;
// the published page names its size for Settings (Download offline page)
const off = fs.readFileSync(path.join(ROOT, 'dist', 'complex-map-workbench-offline.html'), 'utf8');
const offScripts = [...off.matchAll(/<script>\n?([\s\S]*?)<\/script>/g)].map((x) => x[1]);
offScripts.forEach((s, i) => { try { new vm.Script(s, { filename: `offline script ${i + 1}` }); } catch (e) { ok(`the offline page's script ${i + 1} parses`, false, String(e.message)); } });
ok('the offline page runs the published script', offScripts.length === scripts.length + 1 && offScripts.includes(scripts[scripts.length - 1]), { offline: offScripts.length, published: scripts.length });
ok('the offline page has MathJax and the faces inline', /id="cmw-mathjax"/.test(off) && /<style id="cmw-fonts">/.test(off) && !/id="cmw-fonts-ru"/.test(off) && /font-family:"Roboto Flex"/.test(off) && !/font-family:"(?:Archivo|B612 Mono)"/.test(off), null);
ok('the offline page has the PDF library inline, under the ids figure.js looks for', /id="cmw-jspdf"/.test(off) && /id="cmw-svg2pdf"/.test(off) && /jspdf\.umd\.min\.js["'], ["']cmw-jspdf["']\)/.test(pub) && /svg2pdf\.umd\.min\.js["'], ["']cmw-svg2pdf["']\)/.test(pub), null);
// (its tags: the scripts keep the live page's CDN URLs as strings, used only where the inline faces are missing;
// test/offline_cmd.js opens it with the network off and counts the requests)
ok('the offline page has no CDN tag', !/<(?:link|script)\b[^>]*(?:fonts\.googleapis\.com|fonts\.gstatic\.com|ajax\/libs\/mathjax|npm\/mathjax@|mathjax-stix2-font)/.test(off), (off.match(/<(?:link|script)\b[^>]*(?:fonts\.g|mathjax)[^>]*>/g) || []).slice(0, 5));
ok('the offline page has the published page\'s stylesheet', sheetOf(off) != null && sheetOf(off) === sheetOf(pub), [sheetOf(off) && sheetOf(off).length, sheetOf(pub) && sheetOf(pub).length]);
ok('the offline page offers no download of itself', !/<meta name="cmw-offline"/.test(off), null);
const named = /<meta name="cmw-offline" content="(\d+)">/.exec(pub);
ok('the published page names the offline page\'s size', named && Number(named[1]) === Buffer.byteLength(off), { named: named && named[1], bytes: Buffer.byteLength(off) });
// the built pages' size budget (bytes), raised only on purpose: the published page is what every visit loads; the
// offline page is it plus MathJax (MathJax 4 and its STIX2 font, every range of it, which the live page loads on demand,
// #288: 4.1 MB of JSON, gzipped in base64 as 1.75 MB, #491), the faces (0.7 MB as base64) and the PDF library (jsPDF and
// svg2pdf.js, 0.47 MB, #393), about 2.78 MB more. The pages as built are 4.53 and 7.30 MB: the app's script without its
// comments and indentation and its GLSL templates without their comments (tools/strip_js.js), and the stylesheet
// without its comments and spare whitespace (tools/strip_css.js). The budgets leave about 0.17 and 0.2 MB above them, all
// of it for the app's own code (about 0.04 MB of it for the certified Repeat-chain coverage renderer, #1478), none of it
// test code or a second copy: the app code that grows the page most is the steps view (app.js) and the GL renderer
// with its shaders and inverse pass (gl.js, glsl.js, invops.js, inverse.js). What still ships that the page does not
// run: the language tables' repeated English keys
const BUDGET = { 'complex-map-workbench.html': 4.7e6, 'complex-map-workbench-offline.html': 7.5e6, offlineExtra: 3.1e6 };
const bytes = { 'complex-map-workbench.html': Buffer.byteLength(pub), 'complex-map-workbench-offline.html': Buffer.byteLength(off) };
for (const f of Object.keys(bytes)) ok(`dist/${f}: ${(bytes[f] / 1e6).toFixed(2)} MB, within its budget of ${BUDGET[f] / 1e6} MB`, bytes[f] <= BUDGET[f], bytes[f]);
const extra = bytes['complex-map-workbench-offline.html'] - bytes['complex-map-workbench.html'];
ok(`the offline page's MathJax, faces and PDF library: ${(extra / 1e6).toFixed(2)} MB, within ${BUDGET.offlineExtra / 1e6} MB`, extra > 0 && extra <= BUDGET.offlineExtra, extra);
// (#491) the offline page's MathJax block: the vendored files' JSON, gzipped, in base64; inflated the two ways the page
// does (DecompressionStream is zlib's gunzip; fflate's, vendored, where a browser lacks it), it is every file exactly
{
  const zlib = require('zlib');
  const V = path.join(__dirname, '..', 'vendor', 'js');
  const want = { core: fs.readFileSync(path.join(V, 'tex-svg-nofont.js'), 'utf8'), '[mathjax-stix2]/svg': fs.readFileSync(path.join(V, 'mathjax-stix2', 'svg.js'), 'utf8') };
  for (const f of fs.readdirSync(path.join(V, 'mathjax-stix2', 'svg', 'dynamic')).filter((n) => n.endsWith('.js')).sort()) want[`[mathjax-stix2]/svg/dynamic/${f}`] = fs.readFileSync(path.join(V, 'mathjax-stix2', 'svg', 'dynamic', f), 'utf8');
  want['a11y/assistive-mml'] = fs.readFileSync(path.join(V, 'a11y', 'assistive-mml.js'), 'utf8');
  const blockOf = (id) => { const m = new RegExp(`<script type="application/json" id="${id}">([\\s\\S]*?)</script>`).exec(off); return m ? JSON.parse(m[1]) : null; };
  const b64 = blockOf('cmw-mathjax'), gz = typeof b64 === 'string' ? Buffer.from(b64, 'base64') : null;
  const viaZlib = gz ? JSON.parse(zlib.gunzipSync(gz).toString('utf8')) : null;
  const ff = new Function('module', 'exports', blockOf('cmw-fflate') + '\nreturn module.exports;')({ exports: {} }, {});
  const viaFflate = gz && ff && ff.gunzipSync ? JSON.parse(ff.strFromU8(ff.gunzipSync(new Uint8Array(gz)))) : null;
  const same = (o) => !!o && Object.keys(o).length === Object.keys(want).length && Object.keys(want).every((k) => o[k] === want[k]);
  ok('the offline page\'s MathJax block is gzipped (base64) and inflates to the vendored files (zlib, as DecompressionStream)', same(viaZlib), gz && gz.length);
  ok('… and the same through the page\'s fallback, fflate', same(viaFflate), !!viaFflate);
  ok('… with no name or time in its gzip header (the same bytes from the same input)', !!gz && gz.readUInt32LE(4) === 0 && (gz[3] & 0x08) === 0, gz && [...gz.subarray(0, 10)]);
}
console.log(fails ? `${fails} checks FAILED` : 'the published page: every script parses, hooks dropped whole; the offline page: its own MathJax and faces, within budget');
process.exit(fails ? 1 : 0);
