// Merge base JS entries, page.html entries and provisional in-flight entries into notes/i18n/inventory.json.
const fs = require('fs');
const [, , outF, baseSrc] = process.argv;
const J = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const base = J('base_inv.json');
const ids = new Set(base.entries.map((e) => e.id));
const uid = (id) => { let k = id, n = 2; while (ids.has(k)) k = `${id}_${n++}`; ids.add(k); return k; };
const slug = (s) => s.replace(/<[^>]+>/g, ' ').replace(/[^A-Za-z0-9]+/g, ' ').trim().toLowerCase().split(/\s+/).filter((w) => w && !['the', 'a', 'an', 'of', 'to', 'and', 'or', 'in', 'this'].includes(w)).slice(0, 4).join('_') || 'x';
function pageEntries(rows, src, prov, area, baseVals) {
  const out = [];
  const lines = src.split('\n');
  for (const r of rows) {
    if (baseVals && baseVals.has(r.value)) continue;
    if (r.attr === 'text' && r.line === 1) continue;                       // <title> seen twice
    if (/^(w|-plane|Complex|Map Workbench|Key in the)$/.test(r.value) && r.attr === 'text') continue;   // merged by hand below
    if (/^⌘K$/.test(r.value)) continue;
    const L = lines[r.line - 1] || '';
    let kind = { title: 'tooltip', 'data-tip': 'tooltip', 'aria-label': 'aria', placeholder: 'placeholder', alt: 'aria', 'title-tag': 'heading', 'css-content': 'placeholder' }[r.attr];
    if (!kind) {
      const before = L.slice(0, L.indexOf('>' + r.value) + 1);
      const tag = (before.match(/<(\w+)[^<]*>$/) || [])[1] || '';
      const inBtn = /<button[^>]*>(?:(?!<\/button>).)*$/.test(before);
      kind = /^(h1|h2|summary)$/.test(tag) || /<h2>[^<]*$|<h2><span class="grow">$/.test(before) ? 'heading' : inBtn || /^(button|label)$/.test(tag) || /class="check|fader-row|fl"/.test(before.slice(-60)) ? 'button' : 'body';
    }
    const hz = [];
    if (/⌘|⇧|\s{2}[\[\]?A-Z]$|press Enter/.test(r.value)) hz.push('contains a key name');
    if (/^\|z-1\| < 2$/.test(r.value)) hz.push('do not translate: a formula example');
    if (/^Theme: Auto$/.test(r.value)) hz.push('built from pieces');
    out.push({ id: uid(`${area}.${slug(r.value)}`), area, file: `page.html:${r.line}`, kind, text: r.value, context: `page.html ${r.attr === 'text' ? 'text node' : r.attr + (r.attr === 'title-tag' || r.attr === 'css-content' ? '' : ' attribute')}; static markup (app.js may overwrite it later)`, hazards: hz, ...(prov ? { provisional: true } : {}) });
  }
  return out;
}
const pageSrc = fs.readFileSync(baseSrc + '/page.html', 'utf8');
const pageBase = pageEntries(J('page_base.json'), pageSrc, false, 'chrome', null);
pageBase.push(
  { id: uid('chrome.wordmark'), area: 'chrome', file: 'page.html:1646', kind: 'heading', text: '<span class="wm-pre">Complex </span>Map Workbench', context: 'header wordmark; the first word hides on narrow screens', hazards: ['built from pieces', 'contains HTML markup', 'product name: decide whether to translate'] },
  { id: uid('chrome.key_in_w_plane'), area: 'chrome', file: 'page.html:1736', kind: 'button', text: 'Key in the <i>w</i>-plane', context: 'checkbox in the left legend chip (also rebuilt as "Key in the {y}-plane" by drawLegendSide)', hazards: ['built from pieces', 'contains HTML markup'] },
);
const JUNK = (t) => /'use strict'|^`|keys\.map|^ArrowUp ArrowDown|^-(phase|landscape|deformation)$|^\$\{/.test(t);
const CODES = new Set(['parse.js:27', 'parse.js:568', 'parse.js:589', 'parse.js:590', 'parse.js:591', 'parse.js:596']);
const entries = [...base.entries.filter((e) => !CODES.has(e.file)), ...pageBase];
const dnt = [...base.doNotTranslate];
dnt.push({ value: '-phase, -landscape, -deformation', where: 'work/xr app.js:9430 (provisional)', why: 'file-name suffixes of exported figures' });
const seenText = new Set(entries.map((e) => e.text));
const baseVals = new Set(J('basevals.json'));
const AREA = { xs: 'sound', xt: 'tour', xr: 'export' };
for (const w of ['xs', 'xt', 'xr']) {
  const d = J(`${w}_inv.json`);
  for (const e of d.entries) {
    if (JUNK(e.text) || seenText.has(e.text)) continue;
    seenText.add(e.text);
    const area = e.file.startsWith('sound.js') ? 'sound' : e.file.startsWith('figure.js') ? 'export' : e.area === 'guide' || /^app\.js:110[3-6]\d/.test(e.file) ? 'guide' : AREA[w];
    entries.push(Object.assign({}, e, { id: uid(e.id.replace(/^\w+\./, area + '.')), area, file: `work/${w}/src/${e.file}`, provisional: true }));
  }
  const pg = pageEntries(J(`page_${w}.json`), fs.readFileSync(`${process.argv[4]}/work/${w}/src/page.html`, 'utf8'), true, AREA[w], baseVals);
  for (const e of pg) { if (seenText.has(e.text)) continue; seenText.add(e.text); e.file = `work/${w}/src/${e.file}`; entries.push(e); }
}
// do-not-translate list: entries whose literal is also an identifier or a test string, plus key names and parser tables
for (const e of entries) for (const h of e.hazards) if (/^(do not translate|test\/ uses)/.test(h)) dnt.push({ value: e.text, where: e.file, why: h.replace(/^do not translate: /, ''), entry: e.id });
dnt.push(
  { value: 'sin cos tan cot sec csc sinh cosh tanh coth arcsin arccos arctan arcsinh arccosh arctanh arsinh arcosh artanh asin acos atan asinh acosh atanh exp log ln Log Re Im arg Arg abs conj pi theta vartheta (and \\le \\ge \\cdot \\times ...)', where: 'parse.js:12-39 (LaTeX command and plain-name tables)', why: 'formula identifiers the parser accepts; saved work and shared links contain them. Russian spellings (tg, ctg, sh, ch, th, cth, arctg, arcctg, Arg, Ln) must be ADDED as aliases, never replace these' },
  { value: 'Linear & Möbius, Powers & roots, Exponential & log, Trigonometric, Inverse trigonometric, Special, Polynomial & custom, Calculus', where: 'funcs.js:952-1475 (def.group and GROUPS)', why: 'group names are also the keys that order the catalog: translate through a display map, keep the keys' },
  { value: 'e.key letters: k z y m p Z and the TOOLS letters (V P S L R C A F D B G O H N K); also [ ] ? / + =', where: 'app.js:11805-11860 (global keydown); tour.js:796-812, 1306-1309', why: 'with the Russian layout e.key is Cyrillic (к я н ь з...), [ ] become х ъ, ? and / move: letter and bracket shortcuts must read e.code (KeyK, BracketLeft); the shortcut labels shown to users stay Latin' },
  { value: 'step type ids (mul add affine recip mobius blaschke pown root powa exp log sin ... zp custom deriv), shape kinds (point segment line ray circle arc curve cgrid pgrid disc rect polygon halfplane annulus sector formula fcurve), view modes (xy phase land plane sphere), theme values (auto light dark), pattern ids', where: 'funcs.js def ids, region.js KINDS, view.js, app.js', why: 'saved in work, URLs and localStorage; only their display labels are inventoried' },
);
// counts
const count = (pred) => { const m = {}; for (const e of entries.filter(pred)) { m[e.area] ||= {}; m[e.area][e.kind] = (m[e.area][e.kind] || 0) + 1; } return m; };
const hzCount = {}; for (const e of entries) for (const h of e.hazards) { const k = h.replace(/:.*/, ''); hzCount[k] = (hzCount[k] || 0) + 1; }
const doc = {
  about: 'User-visible strings of Complex Map Workbench. Base: notes/gate-morph-zp-r1/src (frozen). Provisional entries come from work/xr, work/xs, work/xt as of 2026-10-22 and will change. file is file:line in the base unless the path says work/<copy>. text uses {name} where the code interpolates; context lists each placeholder with its source expression.',
  generated: '2026-10-22',
  counts: { base: count((e) => !e.provisional), provisional: count((e) => e.provisional), total: entries.length, baseTotal: entries.filter((e) => !e.provisional).length, provisionalTotal: entries.filter((e) => e.provisional).length, hazards: hzCount },
  entries,
  doNotTranslate: dnt,
  notInventoried: { count: base.dropped.length, note: 'literals with letters that are not shown to users or need no translation: pure notation (z, w_k, \\infty), CSS, selectors, cache keys, URLs, example parameters, formula examples; plus internal diagnostics never shown (inverse.js and gl.js reasons, morph-path selection log, GLSL errors, console notes)', sample: base.dropped.slice(0, 60) },
};
fs.writeFileSync(outF, JSON.stringify(doc, null, 1));
console.log(JSON.stringify(doc.counts, null, 0));
