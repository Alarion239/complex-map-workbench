// Assemble inventory entries from refined candidates (+ page.html), with ids, kinds, hazards.
// usage: node build.js <cand.json> <raw.json> <srcDir> <testText> <out.json> <label> [provisional baseValues.json]
const fs = require('fs');
const path = require('path');
const [, , candF, rawF, srcDir, testF, outF, label, prov, baseVals] = process.argv;
const cand = JSON.parse(fs.readFileSync(candF)).keep;
const raw = JSON.parse(fs.readFileSync(rawF));
const testText = fs.existsSync(testF) ? fs.readFileSync(testF, 'utf8') : '';
const baseSet = baseVals ? new Set(JSON.parse(fs.readFileSync(baseVals))) : null;
const srcCache = {};
const srcLines = (f) => (srcCache[f] ||= fs.readFileSync(path.join(srcDir, f), 'utf8').split('\n'));
// identifier uses of literal values (compared, switch case, computed index) anywhere
const idUse = new Set(raw.filter((x) => x.ctx.cmp || x.ctx.caseTest || x.ctx.index).map((x) => x.value));
const KEYNAMES = new Set(['Escape', 'Enter', 'Tab', 'Home', 'End', 'Delete', 'Backspace', 'Space', 'Alt', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Shift']);
const RU_FN = /\\(tan|cot|sinh|cosh|tanh|coth|arctan|arccot|sec|csc)\b|\\operatorname\{(arsinh|arcosh|artanh|arcoth|Re|Im)\}|\\(log|arg)\b/;
const out = [], dnt = [], dropped = [];
const slug = (s, n = 4) => s.replace(/\$\{[^}]*\}/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\\[a-zA-Z]+/g, ' ').replace(/[^A-Za-z0-9]+/g, ' ').trim().toLowerCase().split(/\s+/).filter((w) => w && !['the', 'a', 'an', 'of', 'to', 'and', 'is', 'in', 'it', 'its', 'this'].includes(w)).slice(0, n).join('_') || 'x';
function phName(expr) {
  let e = expr.trim();
  let m;
  if ((m = /^sub\((.+)\)$/.exec(e))) e = m[1];
  if (/^[\w.]+$/.test(e)) return e.split('.').slice(-2).join('.');
  if ((m = /^([\w.]+)\(\)$/.exec(e))) return m[1].split('.').pop();
  if (/\?/.test(e)) return 'choice';
  if ((m = /^[\w.]+\(\s*([\w.]+)/.exec(e))) return m[1].split('.').slice(-2).join('.');
  if ((m = /^([\w.]+)\s*[-+*/]/.exec(e))) return m[1].split('.').pop();
  return 'x';
}
function normText(v) {
  const phs = [];
  let t = v.replace(/\$\{((?:[^{}]|\{[^{}]*\})*)\}/g, (all, e) => { const n = phName(e); phs.push(`{${n}} = ${e.length > 70 ? e.slice(0, 67) + '...' : e}`); return `{${n}}`; });
  return { text: t, phs };
}
function isPureMath(v) {
  if (/\\text\{[^}]*[A-Za-z]{3,}/.test(v)) return false;
  const s = v.replace(/\$\{((?:[^{}]|\{[^{}]*\})*)\}/g, ' ').replace(/\\[a-zA-Z]+/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ');
  const words = s.match(/[A-Za-z]{2,}/g) || [];
  return words.every((w) => /^(sin|cos|tan|cot|sec|csc|sinh|cosh|tanh|coth|exp|log|ln|arg|Re|Im|deg|id|div|lim|sup|inf|max|min|dz|dx|dy|mathrm|mathbb|le|ge|pi|tfrac|frac|bar|circ|neq|notin|cup|infty|left|right|sqrt|quad|pm|cdot|times|approx|oint|zeta|gamma|text|textbf|operatorname|arcsin|arccos|arctan|arsinh|arcosh|artanh|lt|gt|amp|nbsp|kg|mfclip)$/i.test(w));
}
function areaOf(x) {
  if (x.file === 'tour.js') return 'tour';
  if (x.file === 'sound.js') return 'sound';
  if (x.file === 'figure.js') return 'export';
  const f = x.ctx.fn || '', f2 = x.ctx.fn2 || '';
  if (/^(openGuide)$/.test(f) || /^(openGuide)$/.test(f2)) return 'guide';
  if (/figure|Figure|caption|Caption|phaseText|latex|Latex|homDef|patternSegs|exactTexF|openExportMenu|saveFile|copyLatex|figPanelsSeg|layoutCaption|morphHomSegs|phrase|inlineFrac|texEsc|panelKey|tickTex|panelVar|buildFigureNow|save$|rebuild|mj$|morphFigureLayers/.test(f + ' ' + f2)) return 'export';
  if (x.file === 'funcs.js' && x.ctx.prop === 'tex' || /homTex|HomTex|branchWords|joukWords|piIt/.test(f + f2)) return 'export';
  if (x.file === 'app.js' && x.line >= 9470 && x.line <= 9545) return 'export';
  if (['funcs.js', 'parse.js', 'region.js', 'curves.js', 'calc.js', 'cx.js', 'glsl.js'].includes(x.file)) return 'math';
  return 'chrome';
}
function kindOf(x, v, area) {
  const c = x.ctx, cal = c.callee || '', p = c.prop || '', a = c.assign || '';
  if (x.attr === 'title' || x.attr === 'data-tip' || p === 'data-tip' || p === 'title' && x.file !== 'tour.js' && x.file !== 'sound.js' && cal === 'h' || /\.title$|dataset\.tip/.test(a) || cal.endsWith('setAttribute') && /tip|title/i.test(srcLines(x.file)[x.line - 1] || '') && !/aria-label/.test(srcLines(x.file)[x.line - 1] || '')) return 'tooltip';
  if (x.attr === 'aria-label' || /^aria-/.test(p) || cal.endsWith('setAttribute') && /aria-label/.test(srcLines(x.file)[x.line - 1] || '') || /ariaLabel/.test(a) || cal === 'say' || cal === 'announce') return 'aria';
  if (x.attr === 'placeholder' || p === 'placeholder') return 'placeholder';
  if (/^(toast|undoToast)$/.test(cal)) return 'toast';
  if (/Error$|^RatErr$|^INEL$|^showErr$|^setNote$|^paneNote$/.test(cal) || /^(error|err|inverseNote|reason)$/.test(p) || /\bmsg\b|errTip/.test(a) || x.file === 'parse.js' && /^(none|points|chain|mix|not|complex|region|constant|identity|undefined|combine)$/.test(p) || /^(CURVE_NOT_AREA|CONST|SPIRAL|NOTE_CONST|NOTE_PRE)$/.test(a.replace('var ', ''))) return 'error';
  if (area === 'export' && (/\\[a-zA-Z]+|\$[^$]+\$/.test(v) && /\\(begin|end|section|documentclass|usepackage|item|caption|includegraphics|centering)|^%/.test(v))) return 'latex';
  if (area === 'export' || p === 'tex' && x.file === 'funcs.js') return /\\[a-zA-Z]|\$/.test(v) && !/[A-Za-z]{4,}\s+[A-Za-z]{3,}/.test(v.replace(/\\[a-zA-Z]+|\$[^$]*\$/g, '')) ? 'latex' : 'caption';
  if (/paletteItems|openPalette|drawPalettePreview|^render$/.test(c.fn || '') || /CMD_|SYN|KW/.test(a) || x.line >= 8236 && x.line <= 8260 && x.file === 'app.js') return 'palette';
  if (/^(items\.push|mi)$/.test(cal) || p === 'label' && /Menu|menu|onclick/.test(c.fn || '') || x.file === 'funcs.js' && p === 'label' || x.file === 'funcs.js' && /^(group|GROUPS)$/.test(p || a.replace('var ', '')) || /GROUPS|trig|itrig/.test(a) || cal === 'selectEl' && x.ctx.argi === 2) return 'menu';
  if (/^(seg|checkEl|selectEl)$/.test(cal) && x.ctx.argi === 4) return 'aria';
  if (/^(seg|checkEl|row)$/.test(cal) || x.file === 'tour.js' && cal === 'el' && x.ctx.argi >= 2 || /^(MAINS|PATTERNS|TOOLS)$/.test(a.replace('var ', '')) && x.value.length < 24 || p === 'L' || p === 'R') return 'button';
  if (/^(title|name|heading)$/.test(p) && x.file === 'tour.js' || p === 'name' && x.file === 'app.js' || p === 'label' && x.file === 'region.js' || /^h$/.test(cal) && /Composite map|Guarantees|Natural domain|Step by step|How these are decided|Export figure/.test(v)) return 'heading';
  if (/fillText|caption$|^chip$|^haloText$|^title$|^num$|^word$|^run$/.test(cal) || /^(m|t|b)$/.test(p) && x.file === 'app.js') return 'caption';
  return 'body';
}
function hazardsOf(x, v, text, kind) {
  const hz = [];
  const line = srcLines(x.file)[x.line - 1] || '';
  if (x.ctx.concat || /\.push\(|\.join\(|out\.push|segs\.push|r\.push|props\.push/.test(line) && /\.t\b|t:/.test(line) || x.piecesOf) hz.push('built from pieces');
  if (/\$\{/.test(v) && /=== 1 \?|> 1 \?|!== 1 \?|\? '' : 's'|'s' : ''|num\(|times\(|\bpl\(/.test(line) || /\{(n|nz|nOn|count|cnt|k|total|loadDropped|shown|others|hid|gone\.length|d|deg)\}/.test(text) && /\b(points?|roots?|items?|shapes?|steps?|times|more|pairs?|vertices|leaves|zeros|poles|hidden|targets?|cells?|sheets?|min|of)\b/.test(text)) hz.push('needs a plural');
  const caseExprs = [...v.matchAll(/\$\{((?:[^{}]|\{[^{}]*\})*)\}/g)].map((m) => m[1]).filter((e) => !/^(Fname0?|Fn|Fh|Fl|F|v|lv|p|q|f|k|j|i|n|nm\.\w+|T\(.*\)|CX\..*|fmt.*|num\(.*|f2?\(.*|sub\(.*\)|wHtml\(.*\)|yHtml\(.*\)|fxHtml\(.*\)|fnHtml\(.*\)|vTex\(.*\)|expoTex\(.*\)|piIt\(.*\)|texEsc\(.*\)|P\(.*\))$/.test(e.trim()));
  if (caseExprs.some((e) => /(label|name|what|where|word|kind|tg|toolName|mark|clause|its|the\(|role|of\b|surf|patWord|out\b|which|title|note|toLowerCase)/i.test(e)) || /\b(a|an|the)\s+\$\{/.test(v) && caseExprs.length) hz.push('needs grammatical case or gender');
  if (/\\[a-zA-Z]+|\$[^$\s][^$]*\$|[_^]\{/.test(v)) hz.push('contains LaTeX');
  if (/<[a-z][^>]*>/i.test(v)) hz.push('contains HTML markup');
  if (/⌘|⇧|\bCtrl\b|\bShift\b|\bEsc\b|[Pp]ress (Enter|Space|Tab)|Enter (or|to|closes)|\bSpace or\b|\bAlt\b|\{mod\}|^(Enter|Esc|Tab)$|\{[A-Z+?]\}|\s{2}[A-Z0-9?+\[\]]$|\s{2}⇧?[0-9]$|press \w|Press \{?\w/.test(v)) hz.push('contains a key name');
  if (/\b(min|ms|px|°|s)\b|×\d|\d×/.test(v) && /\d|\{/.test(v)) hz.push('units or number format');
  if (RU_FN.test(v)) hz.push('Russian notation (function names)');
  if (idUse.has(x.value) || x.ctx.isKeyUse) hz.push('do not translate: same literal used as an identifier (compared or a map key)');
  if (testText && x.value.length > 3 && !/\$\{/.test(x.value) && (testText.includes(`'${x.value}'`) || testText.includes(`"${x.value}"`) || testText.includes('`' + x.value + '`'))) hz.push('test/ uses this literal (selector or expected text): tests must pin English or use ids');
  return hz;
}
const seen = new Map();
let n = 0;
for (const x of cand) {
  const v = x.value, c = x.ctx;
  if (baseSet && baseSet.has(v)) continue;            // in-flight: only strings new relative to the base
  // final drops
  let drop = null;
  if (/^[#.][\w-]|\[data-|:is\(|:not\(|nth-of-type/.test(v)) drop = 'selector';
  else if (/^(https?:|image\/|text\/|application\/)|w3\.org/.test(v)) drop = 'url/mime';
  else if (/^(3d|load|r|L|R)$/.test(v) || /^&\w+;$/.test(v) || /^M\$\{|^0 0 \$\{/.test(v) || /^\s*[\w-]+="/.test(v)) drop = 'code';
  else if (x.file === 'tour.js' && /^(also|poles|zeros|a|b|expr|residueZp_)$/.test(c.prop || '')) drop = 'code';
  else if (/^(a|b|def)$/.test(c.prop || '') && x.file === 'app.js' && !/\s[a-z]{3,}/.test(v)) drop = 'example param';
  else if (c.prop === 'def' && x.file === 'funcs.js') drop = 'default value';
  else if (/REGION_EXAMPLES/.test(c.assign || '')) drop = 'formula source';
  else if (c.prop === 'rightMode' || c.prop === 'cacheKey') drop = 'code';
  if (KEYNAMES.has(v) && !/^(h|el|k)$/.test(c.callee || '')) { dnt.push({ value: v, where: `${x.file}:${x.line}`, why: 'keyboard key name compared with e.key' }); continue; }
  if (drop) { dropped.push({ v, why: drop, where: `${x.file}:${x.line}` }); continue; }
  const pieces = x.pieces && x.pieces.length && !(x.pieces.length === 1 && x.pieces[0].attr == null && x.pieces[0].text.replace(/<[^>]+>/g, '').trim() === v.replace(/<[^>]+>/g, '').trim()) ? x.pieces : null;
  const units = pieces ? pieces.map((p) => ({ v: p.text, attr: p.attr })) : [{ v, attr: null }];
  for (const u of units) {
    if (isPureMath(u.v) && !RU_FN.test(u.v)) { dropped.push({ v: u.v, why: 'pure notation', where: `${x.file}:${x.line}` }); continue; }
    const xx = Object.assign({}, x, { attr: u.attr, piecesOf: !!pieces });
    const area = areaOf(xx);
    const kind = kindOf(xx, u.v, area);
    const { text, phs } = normText(u.v);
    const hz = hazardsOf(xx, u.v, text, kind);
    let base = `${area}.${slug(text, 4)}`;
    if (seen.has(base)) { const k = seen.get(base) + 1; seen.set(base, k); base = `${base}_${k}`; } else seen.set(base, 1);
    const ctxParts = [];
    ctxParts.push(`${x.file.replace('.js', '')} ${c.fn ? c.fn + '()' : 'top level'}${c.fn2 ? ' in ' + c.fn2 + '()' : ''}`);
    if (c.callee) ctxParts.push(`passed to ${c.callee}(arg ${c.argi})`);
    if (c.prop) ctxParts.push(`property ${c.prop}`);
    if (c.owner) ctxParts.push(c.owner);
    if (u.attr) ctxParts.push(`${u.attr} attribute inside an HTML string`);
    else if (pieces) ctxParts.push('text run inside an HTML string');
    if (phs.length) ctxParts.push('placeholders: ' + phs.join('; '));
    const e = { id: base, area, file: `${x.file}:${x.line}`, kind, text, context: ctxParts.join('; '), hazards: hz };
    if (prov) e.provisional = true;
    out.push(e); n++;
  }
}
fs.writeFileSync(outF, JSON.stringify({ entries: out, doNotTranslate: dnt, dropped }, null, 1));
console.log(label, 'entries', out.length, 'dnt', dnt.length, 'dropped', dropped.length);
