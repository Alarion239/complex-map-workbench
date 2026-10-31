'use strict';
// Is this checkout's app the reference's app? The proof for phase 4 of issue #20 (ES modules and an esbuild bundle in
// place of build.py's concatenation), usable for any change that must not change the app. Two kinds of checks:
//   bytes: every byte of each page outside the app's script (the HTML, the CSS, the ru/it data blocks, the
//     MathJax tags) and the script's head up to the app's first file (i18n.js, a classic script before the
//     bundle) are the reference's, byte for byte, in the test page and the published page;
//   behaviour: both test pages in one Chrome, the same scenes: every shader source the app hands WebGL (a set: the
//     programs of the default scene, each example, and the Phase and Landscape views of a few), the audio worklet's
//     source (Blobs of JavaScript the page makes), each scene's picture (a screenshot of the window, pixel for pixel,
//     LIMIT the share of pixels that may differ, 0.01 % by default), the page's exceptions, and the globals: in the
//     test page the same names; in the published page no name the reference lacks, and every name the reference's
//     page sets on window (not the names its classic script declared, which the bundle keeps in its scope). The
//     published page runs scenes of its own through its UI (the default scene, two examples, sound on).
//   node ci/equiv.js --ref <commit> [--no-build] [--examples N] [--limit 0.0001] [--views 1,4,7]
// Exit 0 equivalent, 1 not, 2 setup problem. The summary lists each check.
const fs = require('fs');
const path = require('path');
const { ROOT, PY, run, serve, summary, esc } = require('./lib');
const { buildReference } = require('./reference');
const { launch, sleep } = require('../test/regress/perf/cdp');
const decode = require('../test/cdp_kit/png');

const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const REF = opt('--ref', 'origin/main');
const N_EX = Number(opt('--examples', '14'));
const LIMIT = Number(opt('--limit', '0.0001'));
const VIEWS = opt('--views', '1,4,7').split(',').map(Number);
const PUB_EXAMPLES = [1, 4];   // the published page's examples, by their place in the menu (it has no __cmwExample)

// a page split at its app script: the largest <script> without attributes (the data blocks, the ru/it tables, are
// <script type="application/json"> and never the app's); any case, and the end tag as HTML ends it (</script >,
// </SCRIPT foo>: the app's own text writes it <\/script, build.py's escape)
// (scanned, not a regular expression: tag-matching expressions are what CodeQL's bad-tag-filter flags; the tag names
// are compared case-free, a few characters at a time, so the page's own indices hold)
function splitPage(html) {
  const tagAt = (i, name) => html.slice(i, i + name.length).toLowerCase() === name;
  let best = null;
  for (let i = html.indexOf('<'); i >= 0; i = html.indexOf('<', i + 1)) {
    if (!tagAt(i, '<script')) continue;
    let j = i + 7;
    while (j < html.length && /\s/.test(html[j])) j++;
    if (html[j] !== '>') continue;   // a tag with attributes (or <scripts...): not the app's
    let at = j + 1;
    if (html[at] === '\n') at++;
    let end = html.indexOf('<', at);
    while (end >= 0 && !tagAt(end, '</script')) end = html.indexOf('<', end + 1);
    if (end < 0 || html.indexOf('>', end) < 0) break;
    if (!best || end - at > best.body.length) best = { at, body: html.slice(at, end) };
    i = end;
  }
  if (!best) return null;
  return { before: html.slice(0, best.at), script: best.body, after: html.slice(best.at + best.body.length) };
}
// the script's head: i18n.js, which build.py puts before the app's own files (its last line ends it)
function headOf(script) {
  const end = 'module.exports = I18N;', i = script.indexOf(end);
  return i < 0 ? '' : script.slice(0, i + end.length);
}

// two programs the same up to a consistent renaming of the names they declare (esbuild renames a local that would
// clash in the bundle's one scope, as h to h2 in sound.js's SND_LIB, the audio worklet's source): the same syntax tree,
// each declared name of the reference mapped to one name here, and every other name (a free one: the worklet's
// globals) unchanged. -> null when they are, else what differs
function sameProgram(ta, tb) {
  const espree = require(path.join(ROOT, 'node_modules', 'espree'));
  const scope = require(path.join(ROOT, 'node_modules', 'eslint-scope'));
  const parse = (t) => { const ast = espree.parse(t, { ecmaVersion: 'latest', sourceType: 'script', range: true }); const sm = scope.analyze(ast, { ecmaVersion: 2022, sourceType: 'script' }); const v = new Map(); for (const sc of sm.scopes) { for (const x of sc.variables) for (const id of x.identifiers) v.set(id, x); for (const r of sc.references) if (r.resolved) v.set(r.identifier, r.resolved); } return { ast, v }; };
  let A, B;
  try { A = parse(ta); B = parse(tb); } catch (e) { return 'does not parse: ' + e.message; }
  // (what esbuild prints differently and means the same: void 0 for undefined)
  const isVoid0 = (n) => n && n.type === 'UnaryExpression' && n.operator === 'void' && n.argument && n.argument.type === 'Literal' && n.argument.value === 0;
  const map = new Map(), back = new Map();
  let why = null;
  (function eq(a, b, at) {
    if (why) return;
    if (a && a.type === 'Identifier' && a.name === 'undefined' && isVoid0(b)) return;
    if (a === null || typeof a !== 'object' || b === null || typeof b !== 'object') { if (a !== b) why = `${at}: ${JSON.stringify(a)} against ${JSON.stringify(b)}`; return; }
    if (Array.isArray(a) !== Array.isArray(b) || (Array.isArray(a) && a.length !== b.length)) { why = `${at}: lengths differ`; return; }
    if (a.type === 'Identifier' && b.type === 'Identifier') {
      const va = A.v.get(a), vb = B.v.get(b);
      if (!va || !vb) { if (va || vb || a.name !== b.name) why = `${at}: the name ${a.name} against ${b.name} (a free name must stay)`; return; }
      if ((map.has(va) && map.get(va) !== vb) || (back.has(vb) && back.get(vb) !== va)) { why = `${a.name}: one variable here is two there`; return; }
      map.set(va, vb); back.set(vb, va); return;
    }
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (k === 'start' || k === 'end' || k === 'range' || k === 'raw' || k === 'shorthand') continue;
      // (a property's name is no variable: x.h and { h: … } keep their names)
      const named = !a.computed && ((a.type === 'MemberExpression' && k === 'property') || ((a.type === 'Property' || a.type === 'MethodDefinition' || a.type === 'PropertyDefinition') && k === 'key'));
      if (named && a[k] && a[k].type === 'Identifier') { if (!b[k] || a[k].name !== b[k].name) why = `${at}: the property ${a[k].name} became ${b[k] && b[k].name}`; continue; }
      eq(a[k], b[k], a.type ? `${at}.${a.type}.${k}` : at);
    }
  })(A.ast, B.ast, 'program');
  return why;
}

const rows = [];
let bad = 0;
const check = (what, pass, detail = '') => { rows.push([pass ? '✅' : '❌', what, detail]); if (!pass) bad++; };

function bytes(refDist, curDist) {
  for (const page of ['test.html', 'complex-map-workbench.html']) {
    const a = splitPage(fs.readFileSync(path.join(refDist, page), 'utf8')), b = splitPage(fs.readFileSync(path.join(curDist, page), 'utf8'));
    if (!a || !b) { check(`${page}: an app script`, false, 'none found'); continue; }
    check(`${page}: the page outside the app script, byte for byte`, a.before === b.before && a.after === b.after, `${a.before.length + a.after.length} bytes` + (a.before === b.before ? '' : ', differs before the script') + (a.after === b.after ? '' : ', differs after it'));
    const ha = headOf(a.script), hb = headOf(b.script);
    check(`${page}: i18n.js at the script's head, byte for byte`, ha.length > 0 && ha === hb, `${ha.length} bytes`);
  }
}

// the probe in each page: shader sources and JavaScript Blobs, recorded from the first script on
const INIT = `(() => {
  const sh = window.__eqShaders = new Set(), js = window.__eqBlobs = [];
  const p = WebGL2RenderingContext.prototype, src = p.shaderSource;
  p.shaderSource = function (s, text) { sh.add(text); return src.call(this, s, text); };
  const B = window.Blob;
  window.Blob = function (parts, o) { const b = new B(parts, o); try { if (o && /javascript/.test(o.type || '')) js.push(parts.map((x) => (typeof x === 'string' ? x : '')).join('')); } catch (e) { /* */ } return b; };
  window.Blob.prototype = B.prototype;
})();`;
const GLOBALS0 = new Set();   // the names of an empty page: left out of the comparison

// the reference script's top-level names: a classic script's top-level const and let are globals that are not properties
// of window, so the globals compared are window's own properties and these names, wherever typeof finds them
function topNames(script) {
  const acorn = require(path.join(ROOT, 'node_modules', 'acorn'));
  const out = new Set();
  for (const n of acorn.parse(script, { ecmaVersion: 'latest', sourceType: 'script' }).body) {
    if (n.type === 'VariableDeclaration') for (const d of n.declarations) { if (d.id.type === 'Identifier') out.add(d.id.name); }
    else if ((n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') && n.id) out.add(n.id.name);
  }
  return [...out];
}

async function probe(base, page, scenes, top) {
  const B = await launch({ width: 1280, height: 800, dpr: 1 });
  try {
    await B.nav('about:blank');
    for (const n of await B.ev('Object.getOwnPropertyNames(window)')) GLOBALS0.add(n);
    await B.addInit(INIT);
    await B.nav(base + page);
    // started: the document loaded and the chain drew its cards (a fixed wait let the published page, 4.9 MB, be
    // measured before its app had run now and then: no globals, no worklet, another picture); then a moment to settle
    let started = false;
    for (let t = Date.now(); !started && Date.now() - t < 30000; await sleep(250)) {
      try { started = await B.ev(`document.readyState === 'complete' && !!document.querySelector('#pipeline .card')`); } catch (e) { /* still loading */ }
    }
    if (!started) throw new Error(`${page} did not start within 30 s (no chain card)`);
    await sleep(3000);
    const own = (await B.ev('Object.getOwnPropertyNames(window)')).filter((n) => !GLOBALS0.has(n) && !/^__eq/.test(n));
    // (a name is there when evaluating it throws no ReferenceError: a top-level `let x;` is there, undefined)
    const lex = await B.ev(`${JSON.stringify(top)}.filter((n) => { try { (0, eval)(n); return true; } catch (e) { return !(e instanceof ReferenceError); } })`);
    const out = { shots: [], own: own.sort(), globals: [...new Set([...own, ...lex])].sort() };
    for (const [name, js] of scenes) {
      if (js) { try { await B.ev(js); } catch (e) { out.shots.push([name, null, String(e.message).slice(0, 200)]); continue; } }
      await sleep(1500);
      // (a picture of a moment: a deformation an example plays is stopped at t = 0.5, and the shader compiles land)
      await B.ev(`(() => { try { const m = __cmwState().morph; if (m && m.open) __cmwMorph({ playing: false, T: 0.5 }); } catch (e) { /* a page without the hooks */ } return 1; })()`);
      for (let k = 0; k < 40 && await B.ev('typeof GLR !== "undefined" && GLR.compiling === true'); k++) await sleep(250);
      // (and the chain's cards drawn: a card draws in a quiet moment, so one page can be a moment behind the other)
      for (let k = 0; k < 40 && await B.ev(`(() => { try { return __cmwCards().cards.some((c) => !c.sig || c.stale); } catch (e) { return false; } })()`); k++) await sleep(250);
      await sleep(1500);
      // (a toast's moment differs with the page's speed: none in the picture)
      await B.ev(`document.querySelectorAll('.toast').forEach((t) => t.remove()); 1`);
      await B.ev('document.fonts.ready.then(() => 1)');   // (the text in its own font on both sides)
      await sleep(200);
      out.shots.push([name, await B.shot(), null]);
    }
    if (scenes.length) {
      // sound on (a click first: the page's first gesture starts its audio), so the audio worklet's source is made
      await B.mouse('mousePressed', 640, 12, { button: 'left', clickCount: 1 }); await B.mouse('mouseReleased', 640, 12, { button: 'left', clickCount: 1 }); await sleep(300);
      // (the test page's Sound; the published bundle has no such global, so its sound button)
      try { await B.ev(`typeof Sound !== 'undefined' ? (Sound.set({ on: true, vol: 0.2, ui: false, events: true, sonify: false }, { quiet: true }), 1) : (document.getElementById('soundBtn').click(), 1)`); } catch (e) { /* the page without sound */ }
      await sleep(2000);
    }
    out.shaders = [...await B.ev('[...window.__eqShaders]')].sort();
    out.blobs = (await B.ev('window.__eqBlobs')).slice().sort();
    out.errors = B.logs().filter((l) => l.t === 'EXC' || (/error/.test(l.t) && !/ERR_TUNNEL|Failed to load resource/.test(l.m))).map((l) => String(l.m).slice(0, 200));
    return out;
  } finally { await B.close(); }
}

function pixels(a, b) {
  const A = decode(a), Bi = decode(b);
  if (A.w !== Bi.w || A.h !== Bi.h) return 1;
  let n = 0;
  for (let i = 0; i < A.w * A.h; i++) { const p = i * A.ch, q = i * Bi.ch; if (A.data[p] !== Bi.data[q] || A.data[p + 1] !== Bi.data[q + 1] || A.data[p + 2] !== Bi.data[q + 2]) n++; }
  return n / (A.w * A.h);
}

// each scene's picture, the reference's against this checkout's
function pictures(pre, scenes, a, b) {
  for (let k = 0; k < scenes.length; k++) {
    const [name, pa, ea] = a.shots[k], [, pb, eb] = b.shots[k];
    if (ea || eb) { check(`${pre}${name}: the scene`, false, ea || eb); continue; }
    const d = pixels(pa, pb);
    if (d > LIMIT && process.env.EQUIV_SHOTS) { const f = `${pre}${name}`.replace(/\W+/g, '_'); fs.mkdirSync(process.env.EQUIV_SHOTS, { recursive: true }); fs.writeFileSync(path.join(process.env.EQUIV_SHOTS, `${f}-ref.png`), pa); fs.writeFileSync(path.join(process.env.EQUIV_SHOTS, `${f}-cur.png`), pb); }
    check(`${pre}${name}: the picture`, d <= LIMIT, `${(d * 100).toFixed(4)} % of pixels differ (at most ${(LIMIT * 100).toFixed(4)} %)`);
  }
}

async function behaviour(refDist, curDist) {
  const scenes = [['default scene', null]];
  for (let i = 0; i < N_EX; i++) scenes.push([`example ${i}`, `__cmwExample(${i}); 1`]);
  for (const i of VIEWS) for (const v of ['phase', 'land']) scenes.push([`example ${i}, ${v}`, `__cmwExample(${i}); __cmwSetMain('${v}'); 1`]);
  const top = topNames(splitPage(fs.readFileSync(path.join(refDist, 'test.html'), 'utf8')).script);
  const [sa, sb] = [await serve(refDist), await serve(curDist)];
  try {
    const a = await probe(sa.base, 'test.html', scenes, top), b = await probe(sb.base, 'test.html', scenes, top);
    check('test page: the same globals', JSON.stringify(a.globals) === JSON.stringify(b.globals), `${a.globals.length} names` + diffNames(a.globals, b.globals));
    check('test page: no exception', b.errors.length === 0, b.errors.slice(0, 3).join(' | '));
    check('every shader source, the same set', JSON.stringify(a.shaders) === JSON.stringify(b.shaders), `${a.shaders.length} sources` + (a.shaders.length === b.shaders.length ? '' : ` against ${b.shaders.length}`));
    if (process.env.EQUIV_SHOTS) { fs.mkdirSync(process.env.EQUIV_SHOTS, { recursive: true }); a.blobs.forEach((t, i) => fs.writeFileSync(path.join(process.env.EQUIV_SHOTS, `blob${i}-ref.js`), t)); b.blobs.forEach((t, i) => fs.writeFileSync(path.join(process.env.EQUIV_SHOTS, `blob${i}-cur.js`), t)); }
    {
      const why = a.blobs.length !== b.blobs.length ? `${a.blobs.length} blobs against ${b.blobs.length}` : a.blobs.map((t, i) => (t === b.blobs[i] ? null : sameProgram(t, b.blobs[i]))).find((x) => x) || null;
      const same = a.blobs.every((t, i) => t === b.blobs[i]);
      check('the audio worklet and other JavaScript Blobs, the same program', !why, `${a.blobs.length} blobs` + (why ? `: ${why}` : same ? ', the same text' : ', the same program up to the renaming of its own names'));
    }
    pictures('', scenes, a, b);
    // the published page: what only the bundle could break (a lookup on window, eval or new Function, the hooks'
    // removal) shows in its own scenes, through its UI (it has no test hooks): the default scene, two examples from the
    // menu, sound on
    const pubTop = topNames(splitPage(fs.readFileSync(path.join(refDist, 'complex-map-workbench.html'), 'utf8')).script);
    const pubScenes = [['default scene', null], ...PUB_EXAMPLES.map((i) => [`example ${i}`, `new Promise((r) => { document.getElementById('examplesBtn').click(); setTimeout(() => { const it = [...document.querySelectorAll('.ex-item')].filter((x) => !x.hidden)[${i}]; if (it) it.click(); r(it ? 1 : 0); }, 400); })`])];
    const pa = await probe(sa.base, 'complex-map-workbench.html', pubScenes, pubTop), pb = await probe(sb.base, 'complex-map-workbench.html', pubScenes, pubTop);
    const extra = pb.globals.filter((n) => !pa.globals.includes(n));
    check('published page: no global the reference lacks', extra.length === 0, extra.slice(0, 10).join(', '));
    // (a name the reference's script declared at its top is a global only because the script was classic; the bundle
    // keeps it in its scope. Any other name, one the page sets on window, must stay)
    const lost = pa.own.filter((n) => !pb.own.includes(n) && !pubTop.includes(n));
    check('published page: every global the page sets on window is still there', lost.length === 0, lost.length ? lost.slice(0, 10).join(', ') : `${pa.own.filter((n) => !pubTop.includes(n)).length} names`);
    check('published page: no exception', pb.errors.length === 0, pb.errors.slice(0, 3).join(' | '));
    check('published page: the audio worklet and other JavaScript Blobs, the same program', pa.blobs.length === pb.blobs.length && pa.blobs.every((t, i) => t === pb.blobs[i] || !sameProgram(t, pb.blobs[i])), `${pa.blobs.length} blobs against ${pb.blobs.length}`);
    pictures('published page, ', pubScenes, pa, pb);
  } finally { sa.server.close(); sb.server.close(); }
}
const diffNames = (a, b) => { const x = a.filter((n) => !b.includes(n)), y = b.filter((n) => !a.includes(n)); return (x.length ? `; only in the reference: ${x.slice(0, 8).join(', ')}` : '') + (y.length ? `; only here: ${y.slice(0, 8).join(', ')}` : ''); };

async function main() {
  if (!argv.includes('--no-build') && run(PY, ['build.py']) !== 0) { console.error('build failed'); return 2; }
  const R = buildReference(REF);
  console.log(`equivalence against ${R.sha.slice(0, 12)} (${REF})`);
  bytes(R.dist, path.join(ROOT, 'dist'));
  await behaviour(R.dist, path.join(ROOT, 'dist'));
  summary(`### The app against ${R.sha.slice(0, 12)} (${REF}): ${bad ? `${bad} check(s) differ` : 'equivalent'}\n\n| | check | detail |\n|---|---|---|\n` + rows.map((r) => `| ${r[0]} | ${r[1]} | ${esc(r[2])} |`).join('\n') + '\n');
  return bad ? 1 : 0;
}
main().then((rc) => process.exit(rc), (e) => { console.error(e); process.exit(2); });
