// node notes/i18n/latex/gen_caption.js : one Russian figure caption, made by the i18n module (not by hand), written
// (1) as a LaTeX snippet the way figure.js writes it, compiled with pdfLaTeX and XeLaTeX by run_gen.sh, and
// (2) as caption segments for the outline composer demo (proto/cyr/cyrfig.html), so the two renderings can be
// compared (reviews i18n-7, lead-1, lead-2).
'use strict';
const fs = require('fs');
const path = require('path');
const I18N = require('../proto/i18n.js');
I18N.load('ru', JSON.parse(fs.readFileSync(path.join(__dirname, '../proto/ru.json'), 'utf8')));
const R = I18N.at('ru'), E = I18N.at('en');

// the caption: two panels (GLOSSARY 1.11: italic а, б; a no-break space before the dash), a notation change
// (\tan -> tg), a decimal (0{,}5), an integer interval ([-1, 1]: a comma, GLOSSARY 2.3) and a decimal one
// ([0{,}5;\,2]: a semicolon)
const segs = [
  { i: 'а' }, { t: ' — полоса ' }, { m: R.notation('0<\\operatorname{Im} z<\\pi') }, { t: ' в плоскости ' }, { m: 'z' },
  { t: '; ' }, { i: 'б' }, { t: ' — образ при отображении ' }, { m: R.notation('w=\\tan z') },
  { t: '. Растяжение ' }, { m: `|F'(z)|=${R.texNum(0.5)}` }, { t: ' на отрезке ' }, { m: R.texInterval(-1, 1) },
  { t: ' и не больше ' }, { m: R.texNum(2) }, { t: ' на ' }, { m: R.texInterval(0.5, 2) },
  { t: '. Ветвь ' }, { m: R.notation('\\log z') }, { t: ' с разрезом по лучу ' }, { m: '\\arg z=\\pi' },
  { t: '. Штриховые границы не принадлежат множествам.' },
].map((g) => (g.t != null ? { t: R.nbsp(g.t) } : g));
// a no-break space that ends one segment and the one-letter word that starts the next: nbsp() sees one segment at
// a time, so a one-letter word at a segment end gets its no-break space here
for (const g of segs) if (g.t != null) g.t = g.t.replace(/(^|[\s\u00a0])([вксоуиаВКСОУИА]) $/, '$1$2\u00a0');

// the LaTeX caption: \textit{а}, U+00A0 -> ~, the em dash as ---
const capTeX = segs.map((g) => (g.m != null ? `$${g.m}$` : g.i != null ? `\\textit{${g.i}}` : I18N.nbspTeX(g.t).replace(/—/g, '---'))).join('');
// the figure width is a TeX dimension: made by the English number formatter, never by the Russian one
const W = E.texNum(469.75), H = E.texNum(120);
const snippet = [
  '% Преамбула (pdfLaTeX): \\usepackage[T2A]{fontenc}\\usepackage[russian]{babel}\\usepackage{graphicx,amsmath,amssymb}',
  '% В XeLaTeX/LuaLaTeX вместо fontenc: \\usepackage{fontspec}. В английском документе: \\foreignlanguage{russian}{...}',
  '\\begin{figure}[h]',
  '  \\centering',
  `  \\ifdim\\linewidth<${W}pt\\resizebox{\\linewidth}{!}{\\rule{${W}pt}{${H}pt}}\\else\\rule{${W}pt}{${H}pt}\\fi`,
  `  \\caption{${capTeX}}`,
  '\\end{figure}',
].join('\n');
const doc = (engine) => [
  '\\documentclass{article}',
  engine === 'pdf' ? '\\usepackage[T2A]{fontenc}\n\\usepackage[russian]{babel}' : '\\usepackage{fontspec}\n\\setmainfont{cmunrm.otf}[BoldFont=cmunbx.otf,ItalicFont=cmunti.otf]\n\\usepackage[russian]{babel}',
  '\\usepackage{graphicx,amsmath,amssymb}',
  '\\begin{document}',
  snippet,
  '\\end{document}',
  '',
].join('\n');

// checks: the generated snippet, not a hand-written one
const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
ok(snippet.includes(`\\ifdim\\linewidth<469.75pt`), 'the dimension stays 469.75pt');
ok(!/\d\{,\}\d+pt/.test(snippet), 'no decimal comma in a dimension');
ok(capTeX.includes('[-1,1]') && !capTeX.includes('[-1;'), 'integer interval: a comma (lead-2)');
ok(capTeX.includes('[0{,}5;\\,2]'), 'decimal interval: a semicolon');
ok(capTeX.includes('\\operatorname{tg} z') && capTeX.includes('\\ln z'), 'Russian notation');
ok(capTeX.includes('\\textit{а}~---') && capTeX.includes('в~плоскости'), 'no-break spaces: before the dash, after в');

const dir = __dirname;
fs.writeFileSync(path.join(dir, 'gen_ru_pdflatex.tex'), doc('pdf'));
fs.writeFileSync(path.join(dir, 'gen_ru_xelatex.tex'), doc('xe'));
fs.writeFileSync(path.join(dir, 'gen_ru_snippet.tex'), snippet + '\n');
fs.writeFileSync(path.join(dir, 'gen_caption_segs.json'), JSON.stringify([{ b: R.nbsp(R.t('Figure {n}.', { n: 1 })) }, { t: ' ' }].concat(segs), null, 1));
console.log(fails.length ? 'FAIL ' + fails.join('; ') : 'generated snippet checks pass (6)');
process.exit(fails.length ? 1 : 0);
