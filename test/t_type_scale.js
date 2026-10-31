'use strict';
// node test/t_type_scale.js : the interface's type scale (#288): every font size in src/page.html, src/*.css and the scripts under src/ (CSS in their template strings, canvas fonts, style.fontSize; not the generated tables) is one of
// 10 · 11 · 12 · 13 · 15 · 19 px (roles in :root, --t-*), a subscript or superscript is 0.75em, a percentage follows its surroundings, 0 hides text, and a size
// set with calc() starts from a size on the scale. A size off the scale fails unless OFFSCALE lists it with the reason.
// An entry that no longer matches anything fails too, so the list never keeps a reason for a rule that is gone.
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '..', 'src');
const SCALE = new Set([10, 11, 12, 13, 15, 19]);
// file, text (a piece of the declaration's line that names it), size, why
const OFFSCALE = [
  { file: 'phone.css', text: '[type="range"]', size: 16, why: 'iOS Safari zooms the page into a field set smaller than 16 px: the phone sheets\' fields keep 16 px' },
  { file: 'desk.css', text: '.ftile .fF {', size: 26, why: 'the function letter of a chain tile is a figure drawn large, not text: its size is its design, and the tile\'s height is set around it' },
  { file: 'phone.css', text: '.ftile > .fF {', size: 24, why: 'the phone\'s chain tile draws the function letter as a figure, as desk.css\'s tile does at 26 px' },
  { file: 'desk.css', text: '.sv-nav {', size: 26, why: 'the thread strip\'s < > are glyph arrows, 44 px targets, drawn large like a figure' },
];
// the font sizes a stylesheet's text sets: [size token, line number, line] (comments blanked first, keeping the lines)
function sizes(text) {
  const out = [];
  const blank = text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  blank.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(/(?<![\w-])font-size\s*:\s*([^;}]+)/g)) out.push([m[1].trim(), i + 1, line]);
    for (const m of line.matchAll(/(?<![\w-])(?:font|--t-[\w-]+)\s*:\s*([^;}]+)/g)) {
      const k = /(?:^|\s)((?:\d*\.)?\d+(?:px|em|rem|%))(?:\s*\/\s*[\w.]+)?(?=\s+(?:var\(|['"A-Za-z-]))/.exec(m[1]);
      if (k) out.push([k[1], i + 1, line]);
    }
  });
  // script text: a canvas or element font set in a string (c.font = `italic 500 13px ${family}`), style.fontSize / fontSize: 'Npx'
  blank.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(/\.font\s*=\s*[`'"]([^`'"]*)/g)) {
      const k = /(?:^|\s)((?:\d*\.)?\d+px)(?=[\s/]|$)/.exec(m[1]);
      if (k) out.push([k[1], i + 1, line]);
    }
    for (const m of line.matchAll(/\bfontSize\s*(?:=|:)\s*[`'"]((?:\d*\.)?\d+(?:px|em|rem))/g)) out.push([m[1], i + 1, line]);
  });
  return out;
}
// the sizes off the scale in a stylesheet's text: [size, line number, line]
function offScale(text) {
  const bad = [];
  for (const [tok, n, line] of sizes(text)) {
    let m;
    if ((m = /^calc\(\s*((?:\d*\.)?\d+)px\b/.exec(tok))) { if (!SCALE.has(+m[1])) bad.push([tok, n, line]); continue; }
    if (!(m = /^((?:\d*\.)?\d+)(px|em|rem|%)(?:\s*!important)?$/.exec(tok))) continue;   // (var(), inherit, keywords: not a size here)
    const v = +m[1];
    if (v === 0 || m[2] === '%') continue;   // (a percentage follows the size around it: MathJax's math inside a line of text)
    if (m[2] === 'em' && v === 0.75) continue;
    if (m[2] === 'px' && SCALE.has(v)) continue;
    bad.push([tok, n, line]);
  }
  return bad;
}
let fails = 0;
const fail = (msg) => { fails++; console.log('FAIL ' + msg); };
// the check itself: what it takes and what it rejects
for (const [css, want] of [
  ['.a { font-size: 14px; }', 1], ['.a { font: 600 11.5px/14px var(--f-ui); }', 1], [':root { --t-x: 400 9px/12px var(--f-ui); }', 1], ['sub { font-size: 0.72em; }', 1],
  ['.a { font-size: calc(12.5px * var(--k)); }', 1], ['.a { font: 600 11px/14px var(--f-ui); font-size: 0; }', 0], ['sub { font-size: 0.75em; }', 0],
  ['.a { font-size: calc(13px * var(--k, 1)); }', 0], ['.a { font: var(--t-body); }', 0], ['/* font-size: 14px */ .a { color: red }', 0], ['.a { font-size: 19px }', 0],
  ['ctx.font = `italic 500 14px ${TH.math}`;', 1], ['c.font = `10.5px ${th.mono}`;', 1], ['ctx.font = `600 11px ${TH.ui}`;', 0], ['el.style.fontSize = \'14px\';', 1], ['x = { fontSize: \'13px\' };', 0],
]) if (offScale(css).length !== want) fail(`the check read "${css}" as ${offScale(css).length} off the scale, wanted ${want}`);
// page.html, the stylesheets, and every script under src/ except the generated tables (CSS in template strings, canvas fonts,
// style.fontSize): a size no longer has to be in a stylesheet to be checked
const GENERATED = new Set(['cyr.js', 'i18n_it.js', 'i18n_ru.js']);
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const files = walk(SRC).filter((f) => /\.(css|html|js)$/.test(f) && !GENERATED.has(path.basename(f)));
const used = new Set();
let total = 0;
for (const f of files) {
  const base = path.basename(f), text = fs.readFileSync(f, 'utf8');
  total += sizes(text).length;
  for (const [tok, n, line] of offScale(text)) {
    const size = parseFloat(tok.replace(/^calc\(\s*/, ''));
    const i = OFFSCALE.findIndex((e) => e.file === base && e.size === size && line.includes(e.text));
    if (i >= 0) { used.add(i); continue; }
    fail(`${base}:${n}: font size ${tok} is not on the scale 10 · 11 · 12 · 13 · 15 · 19 px (subscripts 0.75em): ${line.trim().slice(0, 110)}`);
  }
}
OFFSCALE.forEach((e, i) => {
  if (!e.why || e.why.length < 20) fail(`OFFSCALE entry ${e.file} "${e.text}" has no reason`);
  if (!used.has(i)) fail(`OFFSCALE entry ${e.file} "${e.text}" (${e.size} px) matches nothing: remove it`);
});
if (total < 200) fail(`only ${total} font sizes were read: the check is not reading the files (it read 234 when written)`);
console.log(`${total} font sizes in ${files.length} files, ${OFFSCALE.length} off the scale on purpose, ${fails} failed`);
process.exit(fails ? 1 : 0);
