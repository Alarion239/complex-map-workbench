// node test/t_cyr.js : the Cyrillic word module for figures (src/cyr.js, made by tools/make_cyr_module.py). The compact
// outlines draw the same points as the phase-1 CMU tables (notes/i18n/proto/cyr), every face is stroked to MathJax's
// weight (stroke 13: words and upright operator names have one weight), and words, kerning, no-break spaces, the
// TeX splitter and the composer give XD.tex's item shape.
'use strict';
const fs = require('fs'), path = require('path');
const CYR = require('../src/cyr.js');
const SRC = path.join(__dirname, '../notes/i18n/proto/cyr');
let fails = 0, checks = 0;
const ok = (c, msg) => { checks++; if (!c) { fails++; if (fails < 30) console.log('FAIL', msg); } };
// absolute points of an SVG path (M L H V C Z, absolute or relative)
function points(d) {
  const t = d.match(/[MLHVCZmlhvcz]|-?\d*\.?\d+/g);
  let i = 0, x = 0, y = 0, sx = 0, sy = 0, cmd = null;
  const pts = [];
  const n = () => +t[i++];
  while (i < t.length) {
    if (/[A-Za-z]/.test(t[i])) { cmd = t[i++]; if (/[Zz]/.test(cmd)) { x = sx; y = sy; pts.push(['Z']); continue; } }
    const rel = cmd === cmd.toLowerCase(), c = cmd.toUpperCase();
    if (c === 'M') { x = (rel ? x : 0) + n(); y = (rel ? y : 0) + n(); sx = x; sy = y; pts.push(['M', x, y]); cmd = rel ? 'l' : 'L'; }
    else if (c === 'L') { x = (rel ? x : 0) + n(); y = (rel ? y : 0) + n(); pts.push(['L', x, y]); }
    else if (c === 'H') { x = (rel ? x : 0) + n(); pts.push(['L', x, y]); }
    else if (c === 'V') { y = (rel ? y : 0) + n(); pts.push(['L', x, y]); }
    else if (c === 'C') { const a = [n(), n(), n(), n(), n(), n()]; const b = rel ? a.map((v, j) => v + (j % 2 ? y : x)) : a; pts.push(['C', ...b]); x = b[4]; y = b[5]; }
  }
  return pts;
}
const same = (p, q) => p.length === q.length && p.every((a, i) => a[0] === q[i][0] && a.slice(1).every((v, j) => Math.abs(v - q[i][j + 1]) < 0.011));
for (const f of ['rm', 'bx', 'ti']) {
  const T = JSON.parse(fs.readFileSync(path.join(SRC, `cyr_${f}.json`), 'utf8'));
  const F = CYR.face(f);
  ok(F.stroke === 13, `${f}: stroke 13 (MathJax's weight)`);
  const want = f === 'ti' ? [...'абвгдежзиклм'] : Object.keys(T.glyphs);
  ok(Object.keys(F.glyphs).length === want.length, `${f}: ${Object.keys(F.glyphs).length} glyphs, want ${want.length}`);
  for (const ch of want) {
    const g = F.glyphs[ch], o = T.glyphs[ch];
    ok(g && g[0] === o[0], `${f} ${ch}: advance`);
    ok(g && same(points(g[1]), points(o[1])), `${f} ${ch}: the compact outline draws the same points`);
  }
  for (const [pair, v] of Object.entries(F.kern)) ok(T.kern[pair] === v, `${f} kern ${pair}`);
}
// a word: XD.tex's shape, advances and kerning in units of pt/1000
const rm = CYR.face('rm');
const w = CYR.word('Образ', 'rm', 10, '#123456');
let adv = 0, prev = null;
for (const ch of 'Образ') { adv += (prev && rm.kern[prev + ch]) || 0; adv += rm.glyphs[ch][0]; prev = ch; }
ok(Math.abs(w.w - adv / 100) < 1e-9, 'word width = advances + kerning');
ok(w.k === 0.01 && w.vb0 === 0 && w.a > 6 && w.a < 8 && w.d >= 0, 'metrics in pt: ' + JSON.stringify([w.a, w.d]));
ok(/fill="#123456" stroke="#123456" stroke-width="13"/.test(w.inner) && /scale\(1,-1\)/.test(w.inner), 'the color and the stroke on the group, y up as MathJax');
ok(w.glyphs.length === 5 && w.glyphs.every(([k]) => /^CYR-RM-[0-9A-F]+$/.test(k)) && (w.inner.match(/<use /g) || []).length === 5, 'one glyph key per character, @NS@ uses');
ok(!/<text/.test(w.inner), 'no <text>');
const a = CYR.word('а б', 'rm', 10), b = CYR.word('а б', 'rm', 10);
ok(Math.abs(a.w - b.w) < 1e-9 && Math.abs(a.w * 100 - (rm.glyphs['а'][0] + rm.space + rm.glyphs['б'][0])) < 1e-6, 'a no-break space has the interword width (333 in cmr10)');
ok(CYR.word('Круг-A, PDF-файл', 'rm', 10) !== null, 'mixed-script words come from one face');
ok(CYR.word('日本', 'rm', 10) === null && CYR.word('Ж', 'ti', 10) === null, 'a missing character: null (MathJax fallback)');
ok(CYR.word('Рис. 1.', 'bx', 10).glyphs.every(([k]) => k.startsWith('CYR-BX-')), 'bold face for «Рис. 1.»');
// the splitter
const sp = CYR.split('\\text{сетка } [-1,1]\\times[0,2]');
ok(JSON.stringify(sp) === JSON.stringify([{ t: 'сетка ', face: 'rm' }, { m: ' [-1,1]\\times[0,2]' }]), 'split: words, then math ' + JSON.stringify(sp));
ok(JSON.stringify(CYR.split('\\textbf{Рис.~1.} \\textit{а}~--- круг')) === JSON.stringify([{ t: 'Рис. 1.', face: 'bx' }, { m: ' ' }, { t: 'а', face: 'ti' }, { m: '~--- круг' }]), 'split: bold, italic, ~ is U+00A0');
ok(JSON.stringify(CYR.split('\\text{z-plane} + \\operatorname{tg} z')) === JSON.stringify([{ m: '\\text{z-plane} + \\operatorname{tg} z' }]), 'split: Latin words and operator names stay with MathJax');
ok(JSON.stringify(CYR.split('\\text{при $t=0$}')) === JSON.stringify([{ m: '\\text{при $t=0$}' }]), 'split: words with math inside stay with MathJax');
// the composer
const math = (tex, pt) => ({ inner: `<M>${tex}</M>`, glyphs: [['TEX-I-1D467', 'M0 0']], w: 4, a: 7, d: 2, vb0: -5, k: pt / 1000 });
const ts = CYR.typeset('\\text{образ } z', 10, '#000', math);
const wd = CYR.word('образ ', 'rm', 10);
ok(Math.abs(ts.w - (wd.w + 4)) < 1e-9 && ts.a === Math.max(wd.a, 7) && ts.d === Math.max(wd.d, 2), 'typeset: widths add, ascent and descent are the maxima');
ok(ts.inner.includes(`translate(${+(wd.w / 0.01 + 5).toFixed(2)},0)"><M> z</M>`), 'typeset: the math run follows the words (its vb0 undone)');
ok(ts.glyphs.some(([k]) => k === 'TEX-I-1D467') && ts.glyphs.some(([k]) => k.startsWith('CYR-RM-')), 'typeset: both glyph sets');
const fb = CYR.typeset('\\text{日本}', 10, '#000', math);
ok(fb.inner.includes('<M>\\text{日本}</M>'), 'typeset: no Cyrillic, MathJax keeps the run');
const fb2 = CYR.typeset('\\text{Ж日}', 10, '#000', math);
ok(fb2.inner.includes('<M>\\text{Ж日}</M>'), 'typeset: a character the face lacks: the run falls back to MathJax');
// Italian: accented letters composed from the face's own outlines (base + the CMU grave, mirrored for the acute)
const it = CYR.word('così più è perché città È', 'rm', 10);
ok(it !== null && !/<text/.test(it.inner), 'Italian words come from the face (no <text>)');
const ce = rm.composed['è'], ca = rm.composed['é'], ci = rm.composed['ì'], cE = rm.composed['È'];
ok(ce && ce[0] === rm.glyphs.e[0] && cE[0] === rm.glyphs.E[0], 'a composed letter keeps its base advance');
ok(ce[3] > rm.glyphs.e[3] && cE[3] > ce[3] + 200, 'the accent sits above the x-height, higher over a capital');
ok((ci[1].match(/m/g) || []).length === 2 && (rm.glyphs.i[1].match(/m/g) || []).length === 2, 'ì: the dotless stem and the accent (the dot is dropped)');
const xs = (d) => points(d).filter((p) => p[0] !== 'Z').map((p) => p[1]);
const span = (d, y0) => { const p = points(d).filter((q) => q[0] !== 'Z' && q[2] > y0); const v = p.map((q) => q[1]); return [Math.min(...v), Math.max(...v)]; };
const [ga0, ga1] = span(ce[1], 460), [aa0, aa1] = span(ca[1], 460);
ok(Math.abs((ga0 + ga1) / 2 - (aa0 + aa1) / 2) < 1 && xs(ce[1]).length === xs(ca[1]).length, 'the acute is the grave mirrored about the same centre');
ok(CYR.needs('perché') && CYR.needs('Образ') && !CYR.needs('perche'), 'needs: Cyrillic or an accented Latin letter');
ok(Object.keys(rm.glyphs).every((ch) => !/[àèéìòù]/.test(ch)), 'the face itself is unchanged (composed letters are kept apart)');
console.log(fails ? `${fails} of ${checks} checks FAILED` : `all ${checks} checks pass`);
process.exit(fails ? 1 : 0);
