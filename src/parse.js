'use strict';
// Expression language: accepts common LaTeX (\frac, \sqrt, \sin, e^{z}, \overline{z}, |z|, \le ...)
// and plain text (exp(z), sqrt(z), z**2, abs(z), Re(z) ...).
const Expr = (() => {
  const { C } = CX;

  class ParseError extends Error {
    constructor(msg, pos) { super(msg); this.pos = pos; }
  }

  const LATEX_CMDS = {
    sin: 'f:sin', cos: 'f:cos', tan: 'f:tan', cot: 'f:cot', sec: 'f:sec', csc: 'f:csc',
    sinh: 'f:sinh', cosh: 'f:cosh', tanh: 'f:tanh', coth: 'f:coth',
    arcsin: 'f:asin', arccos: 'f:acos', arctan: 'f:atan',
    arcsinh: 'f:asinh', arccosh: 'f:acosh', arctanh: 'f:atanh', arsinh: 'f:asinh', arcosh: 'f:acosh', artanh: 'f:atanh',
    exp: 'f:exp', log: 'f:log', ln: 'f:log', Log: 'f:log',
    Re: 'f:re', Im: 'f:im', arg: 'f:arg', Arg: 'f:arg', abs: 'f:abs', conj: 'f:conj',
    sqrt: 'sqrt', frac: 'frac', dfrac: 'frac', tfrac: 'frac', overline: 'conj', bar: 'conj',
    pi: 'c:pi', theta: 'v:theta', vartheta: 'v:theta',
    cdot: 'op:*', times: 'op:*', ast: 'op:*', div: 'op:/',
    le: 'op:<=', leq: 'op:<=', leqslant: 'op:<=', ge: 'op:>=', geq: 'op:>=', geqslant: 'op:>=', lt: 'op:<', gt: 'op:>',
    land: 'and', wedge: 'and', cap: 'and', lor: 'or', vee: 'or', cup: 'or', lnot: 'not', neg: 'not',
    lvert: 'op:|', rvert: 'op:|', vert: 'op:|', mid: 'op:|',
    left: 'skipdelim', right: 'skipdelim', bigl: 'skipdelim', bigr: 'skipdelim', Bigl: 'skipdelim', Bigr: 'skipdelim',
    big: 'skipdelim', Big: 'skipdelim', biggl: 'skipdelim', biggr: 'skipdelim',
    quad: 'skip', qquad: 'skip', displaystyle: 'skip',
    mathrm: 'name', operatorname: 'name', text: 'name', mathit: 'name', textrm: 'name', mathsf: 'name',
  };
  // plain-text names, longest first
  const PLAIN = {
    arcsinh: 'f:asinh', arccosh: 'f:acosh', arctanh: 'f:atanh', arcsin: 'f:asin', arccos: 'f:acos', arctan: 'f:atan',
    asinh: 'f:asinh', acosh: 'f:acosh', atanh: 'f:atanh', asin: 'f:asin', acos: 'f:acos', atan: 'f:atan',
    sinh: 'f:sinh', cosh: 'f:cosh', tanh: 'f:tanh', coth: 'f:coth', sin: 'f:sin', cos: 'f:cos', tan: 'f:tan',
    cot: 'f:cot', sec: 'f:sec', csc: 'f:csc', exp: 'f:exp', log: 'f:log', ln: 'f:log', Log: 'f:log',
    sqrt: 'sqrt', abs: 'f:abs', conj: 'f:conj', Re: 'f:re', Im: 'f:im', arg: 'f:arg', Arg: 'f:arg',
    pi: 'c:pi', theta: 'v:theta', and: 'and', or: 'or', not: 'not',
  };
  // Russian notation (notes/i18n/DESIGN.md 6), accepted in either language: tg, ctg, sh, ch, th, ... and Ln (the
  // principal branch, as Log). Kept out of LATEX_CMDS and PLAIN so the English 'Try \\sin or \\sinh' suggestions
  // stay as they are. Longest-first matching keeps theta and cosh whole; of these names only cosec starts with an
  // existing name (cos), and cos e c was an error before, so no formula that parsed before parses differently.
  // (GLOSSARY 2.1 also lists the plain arsinh, arcosh, artanh: review math-16; none is a prefix of another name)
  const RU_NAMES = { arctg: 'f:atan', arsh: 'f:asinh', arch: 'f:acosh', arth: 'f:atanh', cosec: 'f:csc', ctg: 'f:cot', cth: 'f:coth', tg: 'f:tan', sh: 'f:sinh', ch: 'f:cosh', th: 'f:tanh', Ln: 'f:log', arsinh: 'f:asinh', arcosh: 'f:acosh', artanh: 'f:atanh' };
  // tokenize(src, rel, ru): ru = false is the base tokenizer exactly. The Russian forms (these names, 0{,}5,
  // \text{или}) only take effect where it stops with an error, and RU_USED records that one did, so a formula that
  // fails anyway is re-read without them (parse below). In English it then gets the base's message, so English
  // messages stay the same; in Russian it gets the message of the pass that read the Russian forms.
  let RU_USED = false;
  const ruName = (k) => (Object.prototype.hasOwnProperty.call(RU_NAMES, k) ? ((RU_USED = true), RU_NAMES[k]) : undefined);
  const PLAIN_BASE = Object.keys(PLAIN).sort((a, b) => b.length - a.length);
  const PLAIN_NAMES = Object.keys(PLAIN).concat(Object.keys(RU_NAMES)).sort((a, b) => b.length - a.length);
  // names a reader may type that the app does not have: a specific message in Russian only (English messages stay)
  const RU_ONLY = () => typeof I18N !== 'undefined' && I18N.lang === 'ru';
  const UNSUPPORTED = {
    arcctg: () => $t('arcctg (arccot) is not available: write arctg(1/z)'), arccot: () => $t('arccot is not available: write arctan(1/z)'),
    acot: () => $t('acot is not available: write arctan(1/z)'), lg: () => $t('lg (the base-10 logarithm) is not available: write ln(z)/ln(10)'),
    // arcoth z = artanh(1/z) for the principal branches (review math-16)
    arcth: () => $t('arcth (arcoth) is not available: write arth(1/z)'), arcoth: () => $t('arcoth is not available: write artanh(1/z)'),
  };
  const UNSUPPORTED_NAMES = Object.keys(UNSUPPORTED).sort((a, b) => b.length - a.length);
  // 0,5 typed for 0.5 (Russian readouts show a decimal comma): a specific message in Russian only
  const commaHint = (src, pos) => (RU_ONLY() && src[pos] === ',' && /\d/.test(src[pos - 1] || '') && /\d/.test(src[pos + 1] || '')
    ? $t('Use a decimal point: 0.5, not 0,5 (a comma separates conditions)') : null);
  const LETTERS = { z: 'v:z', w: 'v:z', x: 'v:x', y: 'v:y', r: 'v:r', i: 'c:i', e: 'c:e' };
  // ---- shared numbers (v15, src/params.js; notes/ui-redesign-2/constructions/DESIGN.md 1.1) ----
  // Expr.setNames({get(name) -> number | undefined, display(name)}) turns on names: a letter the parser does not read
  // (a, k, A, a1, a_1, alpha, \alpha, α) is a shared number, read as its value (a num node with .param). Only text
  // that was an error without names reads differently: a run of letters is a name only when the base tokenizer
  // cannot read the whole run (xi stays x i, chi stays ch i). Without the hook (node tests) nothing changes.
  let NAMES = null, NAMED = null;
  const setNames = (h) => { NAMES = h || null; };
  const GREEK = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', zeta: 'ζ', eta: 'η', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω', Gamma: 'Γ', Delta: 'Δ', Lambda: 'Λ', Xi: 'Ξ', Sigma: 'Σ', Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω' };
  const GREEK_TEX = Object.assign({ varepsilon: 'ε', varphi: 'φ', varrho: 'ρ', varsigma: 'σ' }, GREEK);
  const GREEK_WORD = Object.assign({}, GREEK);
  delete GREEK_WORD.xi; delete GREEK_WORD.chi;           // plain xi and chi already read as x i and ch i
  const GREEK_CH = { 'ϕ': 'φ', 'ϵ': 'ε', 'ϱ': 'ρ', 'ς': 'σ' };
  const GREEK_NAME = Object.fromEntries(Object.entries(GREEK).map(([k, v]) => [v, k]));
  const SUBD = '₀₁₂₃₄₅₆₇₈₉';
  // a name's index after it: digits, _1, _{12} or ₁₂ -> {s: '12', len}
  function subAt(src, j) {
    const m = /^(?:_\{\s*(\d+)\s*\}|_(\d+)|(\d+)|([₀-₉]+))/.exec(src.slice(j));
    if (!m) return { s: '', len: 0 };
    return { s: m[1] || m[2] || m[3] || [...m[4]].map((c) => SUBD.indexOf(c)).join(''), len: m[0].length };
  }
  // a name in TeX: \alpha_{1}, a_{12}
  function nameTex(nm) {
    const m = /^(\D+)(\d*)$/.exec(nm) || [nm, nm, ''];
    const b = GREEK_NAME[m[1]] ? `\\${GREEK_NAME[m[1]]}` : m[1];
    return m[2] ? `${b}_{${m[2]}}` : b;
  }
  function nameTok(name, pos, len) {
    const v = NAMES.get(name);
    if (v === undefined && !NAMED.unknown.includes(name)) NAMED.unknown.push(name);
    NAMED.spans.push({ pos, len, name });
    return { t: 'num', v: v === undefined ? 0 : v, s: '', pos, param: name };
  }
  // the base tokenizer reads the whole run of letters (functions and z w x y r i e)
  function baseRun(run, ru) {
    const names = ru ? PLAIN_NAMES : PLAIN_BASE;
    let j = 0;
    while (j < run.length) {
      const r = run.slice(j), nm = names.find((x) => r.startsWith(x));
      if (nm) { j += nm.length; continue; }
      if (!LETTERS[run[j]]) return false;
      j++;
    }
    return true;
  }
  // the tokens of the run of letters at i when it holds names: a Greek name, one letter (with its index), or a product
  // of single letters with at most one new name (az, ai); any other run is an unknown function ("sinc")
  function nameRun(src, i, ru) {
    const rest = src.slice(i), run = /^[A-Za-z]+/.exec(rest)[0];
    if (baseRun(run, ru) || (RU_ONLY() && UNSUPPORTED_NAMES.some((nm) => rest.startsWith(nm)))) return null;
    const g = GREEK_WORD[run];
    if (g || run.length === 1) {
      const sb = subAt(src, i + run.length);
      return { toks: [nameTok((g || run) + sb.s, i, run.length + sb.len)], end: i + run.length + sb.len };
    }
    let fresh = 0;
    for (const c of run) if (!LETTERS[c] && NAMES.get(c) === undefined) fresh++;
    if (fresh > 1 || (fresh === 1 && run.length > 3)) throw new ParseError($t('Unknown function {f}', { f: run }), i);
    const toks = [...run].map((c, j) => (LETTERS[c] ? tokFrom(LETTERS[c], i + j) : nameTok(c, i + j, 1)));
    return { toks, end: i + run.length };
  }
  // Cyrillic look-alikes typed on a Russian layout read as the Latin letters (not inside a Russian word: и, или, не)
  const LOOK = { 'а': 'a', 'с': 'c', 'е': 'e', 'о': 'o', 'р': 'p', 'х': 'x', 'у': 'y', 'к': 'k', 'А': 'A', 'В': 'B', 'С': 'C', 'Е': 'E', 'Н': 'H', 'К': 'K', 'М': 'M', 'О': 'O', 'Р': 'P', 'Т': 'T', 'Х': 'X' };
  const CYR = /[А-Яа-яЁё]/;
  const latinize = (s) => s.replace(/[асеорхукАВСЕНКМОРТХ]/g, (c, k, all) => (CYR.test(all[k - 1] || '') || CYR.test(all[k + 1] || '') ? c : LOOK[c]));

  function tokFrom(spec, pos) {
    const [t, v] = spec.split(':');
    if (t === 'f') return { t: 'func', v, pos };
    if (t === 'c') return { t: 'const', v, pos };
    if (t === 'v') return { t: 'var', v, pos };
    if (t === 'op') return { t: 'op', v, pos };
    return { t, pos };
  }

  // rel: region formulas (parse with allowRel), where '=' (also '==' and the full-width '＝') is an equation; elsewhere
  // '=' stays an unexpected character
  function tokenize(src, rel = false, ru = true) {
    const toks = [];
    let i = 0;
    const n = src.length;
    while (i < n) {
      const ch = src[i];
      if (/\s/.test(ch) || ch === '~') { i++; continue; }
      if (ch === '\\') {
        const m = /^\\([A-Za-z]+)/.exec(src.slice(i));
        if (!m) {
          const nx = src[i + 1];
          if (nx === '{') { toks.push({ t: 'op', v: '(', pos: i }); i += 2; continue; }
          if (nx === '}') { toks.push({ t: 'op', v: ')', pos: i }); i += 2; continue; }
          if (nx === '|') { toks.push({ t: 'op', v: '|', pos: i }); i += 2; continue; }
          if (',;:! '.includes(nx)) { i += 2; continue; }
          throw new ParseError($t("Unexpected '\\%{x}'", { x: nx ?? '' }), i);
        }
        const name = m[1];
        const spec = LATEX_CMDS[name] || (ru ? ruName(name) : undefined);
        if (!spec && NAMES && GREEK_TEX[name]) {
          const sb = subAt(src, i + m[0].length);
          toks.push(nameTok(GREEK_TEX[name] + sb.s, i, m[0].length + sb.len)); i += m[0].length + sb.len; continue;
        }
        if (!spec) {
          // suggest the nearest known commands ("Try \\sin or \\sinh")
          const dist = (a, b) => {
            const d = Array.from({ length: a.length + 1 }, (_, r) => [r, ...Array(b.length).fill(0)]);
            for (let c = 1; c <= b.length; c++) d[0][c] = c;
            for (let r = 1; r <= a.length; r++) for (let c = 1; c <= b.length; c++) d[r][c] = Math.min(d[r - 1][c] + 1, d[r][c - 1] + 1, d[r - 1][c - 1] + (a[r - 1] === b[c - 1] ? 0 : 1));
            return d[a.length][b.length];
          };
          if (RU_ONLY() && Object.prototype.hasOwnProperty.call(UNSUPPORTED, name)) throw new ParseError(UNSUPPORTED[name](), i);
          // in Russian the suggestions include the Russian names: \tgh -> \tg or \th (GLOSSARY 2.4, review math-15)
          const near = (RU_ONLY() ? Object.keys(LATEX_CMDS).concat(Object.keys(RU_NAMES)) : Object.keys(LATEX_CMDS)).filter((k) => typeof LATEX_CMDS[k] !== 'string' || !LATEX_CMDS[k].startsWith('skip'))
            .map((k) => [k, dist(name, k)]).filter(([, dd]) => dd <= 2).sort((a, b) => a[1] - b[1] || a[0].length - b[0].length).slice(0, 2).map(([k]) => '\\' + k);
          throw new ParseError($t('Unknown command \\%{name}.%{try}', { name, try: near.length ? $t(' Try {x}.', { x: near.join($t(' or ')) }) : '' }), i);
        }
        i += m[0].length;
        if (spec === 'skip') continue;
        if (spec === 'skipdelim') {
          while (i < n && /\s/.test(src[i])) i++;
          if (src[i] === '.') i++;
          continue;
        }
        if (spec === 'name') {
          const mm = /^\s*\{\s*([A-Za-z]+)\s*\}/.exec(src.slice(i));
          // \text{или}, \text{и}, \text{не}: or, and, not in a Russian formula (I18N.notation writes \text{или})
          const rw = ru && !mm && /^\s*\{\s*(или|и|не)\s*\}/.exec(src.slice(i));
          if (rw) { RU_USED = true; toks.push({ t: { 'или': 'or', 'и': 'and', 'не': 'not' }[rw[1]], pos: i, src: rw[1] }); i += rw[0].length; continue; }
          if (!mm) throw new ParseError($t('\\%{name} needs a name in braces', { name }), i);
          i += mm[0].length;
          const inner = mm[1];
          const s2 = LATEX_CMDS[inner] && LATEX_CMDS[inner].startsWith('f:') ? LATEX_CMDS[inner] : (PLAIN[inner] || LETTERS[inner] || (ru ? ruName(inner) : undefined));
          if (!s2) throw new ParseError((RU_ONLY() && Object.prototype.hasOwnProperty.call(UNSUPPORTED, inner) && UNSUPPORTED[inner]()) || $t("Unknown name '{x}'", { x: inner }), i);
          toks.push(tokFrom(s2, i));
          continue;
        }
        toks.push(tokFrom(spec, i));
        continue;
      }
      // a number, with an exponent only when [eE] is directly followed by digits (1e-12, 2.5E+3), so that
      // a bare e stays Euler's number (2e^{z}, 2e, e z)
      const num = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(src.slice(i));
      // 0{,}5: the decimal comma of Russian TeX (I18N.texNum) reads as 0.5 (it was an error before)
      const dc = ru && num && /^\d+$/.test(num[0]) && /^\{,\}(\d+)/.exec(src.slice(i + num[0].length));
      if (dc) { RU_USED = true; const s = num[0] + '.' + dc[1]; toks.push({ t: 'num', v: parseFloat(s), s, pos: i }); i += num[0].length + dc[0].length; continue; }
      if (num) { toks.push({ t: 'num', v: parseFloat(num[0]), s: num[0], pos: i }); i += num[0].length; continue; }
      if (/[A-Za-z]/.test(ch)) {
        const rest = src.slice(i);
        if (NAMES && !/[A-Za-z]/.test(src[i - 1] || '')) {
          const nr = nameRun(src, i, ru);
          if (nr) { toks.push(...nr.toks); i = nr.end; continue; }
        }
        let matched = null;
        for (const nm of (ru ? PLAIN_NAMES : PLAIN_BASE)) {
          if (rest.startsWith(nm)) { matched = nm; break; }
        }
        // lowercase re( / im( as functions
        if (!matched) {
          const mm = /^(re|im)\s*\(/.exec(rest);
          if (mm) matched = mm[1];
        }
        if (matched) {
          const spec = PLAIN[matched] || (ru ? ruName(matched) : undefined) || (matched === 're' ? 'f:re' : 'f:im');
          toks.push(tokFrom(spec, i));
          i += matched.length;
          continue;
        }
        if (LETTERS[ch]) { toks.push(tokFrom(LETTERS[ch], i)); i++; continue; }
        const un = RU_ONLY() && UNSUPPORTED_NAMES.find((nm) => rest.startsWith(nm));
        if (un) throw new ParseError(UNSUPPORTED[un](), i);
        throw new ParseError($t("Unknown symbol '{x}'", { x: ch }), i);
      }
      const two = src.slice(i, i + 2);
      if (two === '**') { toks.push({ t: 'op', v: '^', pos: i }); i += 2; continue; }
      if (two === '<=' || two === '>=') { toks.push({ t: 'op', v: two, pos: i }); i += 2; continue; }
      if (rel && (ch === '=' || ch === '＝')) {
        // '=<' and '=>' are almost always a typo for <= and >=
        const nx = src[i + 1];
        if (nx === '<' || nx === '>') throw new ParseError($t("'={nx}' is not an operator: did you mean {choice}?", { nx, choice: nx === '<' ? '≤ (<=)' : '≥ (>=)' }), i);
        toks.push({ t: 'op', v: '=', pos: i }); i += two === '==' ? 2 : 1; continue;
      }
      if (two === '&&') { toks.push({ t: 'and', pos: i }); i += 2; continue; }
      if (ch === '&') { toks.push({ t: 'and', pos: i }); i++; continue; }
      if (ch === '≤') { toks.push({ t: 'op', v: '<=', pos: i }); i++; continue; }
      if (ch === '≥') { toks.push({ t: 'op', v: '>=', pos: i }); i++; continue; }
      if (ch === 'π') { toks.push({ t: 'const', v: 'pi', pos: i }); i++; continue; }
      if (ch === '·' || ch === '×') { toks.push({ t: 'op', v: '*', pos: i }); i++; continue; }
      if (ch === '−') { toks.push({ t: 'op', v: '-', pos: i }); i++; continue; }
      if ('+-*/^()[]{}|,<>'.includes(ch)) { toks.push({ t: 'op', v: ch, pos: i }); i++; continue; }
      // the words и, или, не as and, or, not (the Russian interface shows them between conditions: review ui-6)
      const rw = ru && /^(или|не|и)(?![А-Яа-яЁё])/.exec(src.slice(i));
      if (rw) { RU_USED = true; toks.push({ t: { 'или': 'or', 'и': 'and', 'не': 'not' }[rw[1]], pos: i, src: rw[1] }); i += rw[0].length; continue; }
      if (NAMES && (ch === 'θ' || ch === 'ϑ')) { toks.push({ t: 'var', v: 'theta', pos: i }); i++; continue; }
      if (NAMES && /[\u0391-\u03A9\u03B1-\u03C9\u03D5\u03F5\u03F1]/.test(ch)) {
        const sb = subAt(src, i + 1);
        toks.push(nameTok((GREEK_CH[ch] || ch) + sb.s, i, 1 + sb.len)); i += 1 + sb.len; continue;
      }
      if (NAMES && CYR.test(ch)) throw new ParseError($t('Use Latin letters for names'), i);
      throw new ParseError($t("Unexpected '{x}'", { x: ch }), i);
    }
    toks.push({ t: 'eof', pos: n });
    return toks;
  }

  // the names in a text, as written: [{pos, len, name}] (a list or a formula that does not parse yet: the names before
  // the first error; ';' lists read like ',' lists)
  function nameSpans(src) {
    if (!NAMES) return [];
    const saved = NAMED;
    NAMED = { unknown: [], spans: [] };
    try { tokenize(latinize(String(src)).replace(/;/g, ','), true, true); } catch (e) { /* the names before the error */ }
    const out = NAMED.spans;
    NAMED = saved;
    return out;
  }
  function parse(src, opts) {
    RU_USED = false;
    try { return parseOnce(src, opts, true); } catch (e) {
      if (!RU_USED || !(e instanceof ParseError)) throw withComma(e, src);
      try { return parseOnce(src, opts, false); } catch (e2) { throw withComma(RU_ONLY() && e2 instanceof ParseError ? e : e2, src); }
    }
  }
  // Russian only: any error in a formula with a decimal comma between digits (0,5) also says to use the point
  // (GLOSSARY 2.3, phase 2b); English errors are returned as they are
  function withComma(e, src) {
    if (!RU_ONLY() || !(e instanceof ParseError) || !/\d,\d/.test(String(src))) return e;
    const hint = $t('Use a decimal point: 0.5');
    return e.message.includes(hint) ? e : new ParseError(e.message.replace(/[.\s]+$/, '') + '. ' + hint, e.pos);
  }
  function parseOnce(src, opts, ru = true) {
    const { allowRel = false } = opts || {};
    if (!src || !src.trim()) throw new ParseError($t('Empty expression'), 0);
    if (NAMES) { src = latinize(String(src)); NAMED = { unknown: [], spans: [] }; }
    const toks = tokenize(src, allowRel, ru);
    let p = 0, absDepth = 0, digitComma = false;
    const peek = () => toks[p];
    const next = () => toks[p++];
    const isOp = (tk, v) => tk.t === 'op' && tk.v === v;
    const expect = (v) => {
      const tk = next();
      if (!isOp(tk, v)) throw new ParseError($t("Expected '{x}'", { x: v }), tk.pos);
    };
    const startsPrimary = (tk) => {
      if (['num', 'var', 'const', 'func', 'frac', 'sqrt', 'conj'].includes(tk.t)) return true;
      if (tk.t === 'op' && (tk.v === '(' || tk.v === '{' || tk.v === '[')) return true;
      if (tk.t === 'op' && tk.v === '|' && absDepth === 0) return true;
      return false;
    };
    function parseOr() {
      let a = parseAnd();
      while (peek().t === 'or') { next(); a = { t: 'or', a, b: parseAnd() }; }
      return a;
    }
    const hasCmp = (n) => !!n && (n.t === 'cmp' || ((n.t === 'and' || n.t === 'or') && (hasCmp(n.a) || hasCmp(n.b))) || (n.t === 'not' && hasCmp(n.a)));
    function parseAnd() {
      let a = parseNot();
      while (peek().t === 'and' || (allowRel && isOp(peek(), ','))) {
        const sep = next(), b = parseNot();
        // Russian only (review ui-1): |z| < 0,5 is |z| < 0 and 5; a comma between digits that leaves a condition on one
        // side and a bare number on the other was a decimal comma, and the message says to use the point (English
        // keeps its messages; a list with no condition at all, 1,0,-1, parses as before)
        const hint = sep.t === 'op' && commaHint(src, sep.pos);
        if (hint && hasCmp(a) !== hasCmp(b)) throw new ParseError(hint, sep.pos);
        if (hint) digitComma = true;
        a = { t: 'and', a, b };
      }
      return a;
    }
    function parseNot() {
      if (peek().t === 'not') { next(); return { t: 'not', a: parseNot() }; }
      return parseRel();
    }
    // a chain a < b <= c (also with '=': 0 < Im z = 1) is the 'and' of its links; every link after the first is
    // marked chain: true when it or the link before is an equation (classifyRelation names a = b = c in its message;
    // chains of inequalities, and everything without allowRel, have exactly the ASTs they had before equations)
    function parseRel() {
      let a = parseAdd();
      let res = null, prev = null;
      while (peek().t === 'op' && ['<', '>', '<=', '>=', '='].includes(peek().v)) {
        const op = next().v;
        const b = parseAdd();
        const c = { t: 'cmp', op, a, b };
        if (res && (op === '=' || prev === '=')) c.chain = true;
        res = res ? { t: 'and', a: res, b: c } : c;
        a = b; prev = op;
      }
      return res || a;
    }
    function parseAdd() {
      let a = parseMul();
      while (isOp(peek(), '+') || isOp(peek(), '-')) {
        const op = next().v;
        a = { t: op === '+' ? 'add' : 'sub', a, b: parseMul() };
      }
      return a;
    }
    function parseMul() {
      let a = parseUnary();
      for (;;) {
        const tk = peek();
        if (isOp(tk, '*') || isOp(tk, '/')) {
          next();
          a = { t: tk.v === '*' ? 'mul' : 'div', a, b: parseUnary() };
        } else if (startsPrimary(tk)) {
          a = { t: 'mul', a, b: parsePow() };
        } else break;
      }
      return a;
    }
    function parseUnary() {
      if (isOp(peek(), '-')) { next(); return { t: 'neg', a: parseUnary() }; }
      if (isOp(peek(), '+')) { next(); return parseUnary(); }
      return parsePow();
    }
    function parsePow() {
      const base = parsePrimary();
      if (isOp(peek(), '^')) { next(); return { t: 'pow', a: base, b: parseExponent() }; }
      return base;
    }
    function parseExponent() {
      if (isOp(peek(), '{')) {
        next();
        const e = parseAdd();
        expect('}');
        return e;
      }
      if (isOp(peek(), '-')) { next(); return { t: 'neg', a: parseExponent() }; }
      const b = parsePrimary();
      if (isOp(peek(), '^')) { next(); return { t: 'pow', a: b, b: parseExponent() }; }
      return b;
    }
    // \frac arguments: {expr} or a single token (\frac12 = 1/2)
    function parseGroup() {
      const tk = peek();
      if (isOp(tk, '{')) { next(); const e = parseOr(); expect('}'); return e; }
      if (tk.t === 'num' && !tk.split && tk.s.length > 1 && /^\d+$/.test(tk.s)) {
        const d = tk.s[0];
        tk.s = tk.s.slice(1); tk.v = parseFloat(tk.s);
        return { t: 'num', v: C(parseFloat(d), 0) };
      }
      return parsePrimary();
    }
    function parseGroupOrArg() {
      if (isOp(peek(), '{')) { next(); const e = parseOr(); expect('}'); return e; }
      return parsePrimary();
    }
    // argument of a function written without parentheses: \sin 2z, \log|z|
    function parseFuncArg() {
      let a;
      if (isOp(peek(), '-')) { next(); a = { t: 'neg', a: parsePow() }; } else a = parsePow();
      while (startsPrimary(peek()) && peek().t !== 'func') a = { t: 'mul', a, b: parsePow() };
      return a;
    }
    function parsePrimary() {
      const tk = next();
      switch (tk.t) {
        case 'num': return tk.param ? { t: 'num', v: C(tk.v, 0), param: tk.param } : { t: 'num', v: C(tk.v, 0), lit: tk.s };
        case 'const':
          if (tk.v === 'i') return { t: 'num', v: C(0, 1), name: 'i' };
          if (tk.v === 'e') return { t: 'num', v: C(Math.E, 0), name: 'e' };
          return { t: 'num', v: C(Math.PI, 0), name: 'pi' };
        case 'var': return { t: 'var', n: tk.v };
        case 'frac': { const a = parseGroup(); const b = parseGroup(); return { t: 'div', a, b }; }
        case 'sqrt': {
          if (isOp(peek(), '[')) {
            next();
            const nn = parseAdd();
            expect(']');
            return { t: 'root', n: nn, a: parseGroupOrArg() };
          }
          return { t: 'call', f: 'sqrt', a: parseGroupOrArg() };
        }
        case 'conj': return { t: 'call', f: 'conj', a: parseGroupOrArg() };
        case 'func': {
          let powAfter = null, f = tk.v;
          if (isOp(peek(), '^')) { next(); powAfter = parseExponent(); }
          // \sin^{-1} z is arcsin z (as in most textbooks); \sin^2 z stays (\sin z)^2
          if (powAfter && isMinusOne(powAfter)) {
            if (INV_FN[f]) { f = INV_FN[f]; powAfter = null; }
            else if (RECIP_FN.includes(f)) throw new ParseError($t('\\%{f}^{-1} is ambiguous: write \\left(\\%{f} z\\right)^{-1} for the reciprocal', { f }), tk.pos);
          }
          let a;
          if (isOp(peek(), '(') || isOp(peek(), '{') || isOp(peek(), '[')) a = parsePrimary();
          else if (peek().t === 'eof') throw new ParseError($t('Missing argument for {f}', { f: I18N.fnName(tk.v) }), tk.pos);
          else a = parseFuncArg();
          let node = { t: 'call', f, a };
          if (powAfter) node = { t: 'pow', a: node, b: powAfter };
          return node;
        }
        case 'op': {
          if (tk.v === '(' || tk.v === '[' || tk.v === '{') {
            const close = { '(': ')', '[': ']', '{': '}' }[tk.v];
            const saved = absDepth;
            absDepth = 0;
            const e = parseOr();
            absDepth = saved;
            const t2 = next();
            // accept mismatched bracket kinds produced by \left( ... \right] etc.
            if (!(t2.t === 'op' && (t2.v === close || t2.v === ')' || t2.v === ']' || t2.v === '}'))) throw new ParseError($t("Expected '{x}'", { x: close }), t2.pos);
            return e;
          }
          if (tk.v === '|') {
            absDepth++;
            const e = parseAdd();
            absDepth--;
            if (!isOp(peek(), '|')) throw new ParseError(src.includes('||') ? $t("Expected '|'. To combine conditions, write 'or' instead of ||") : $t("Expected '|'"), peek().pos);
            expect('|');
            return { t: 'call', f: 'abs', a: e };
          }
          throw new ParseError(commaHint(src, tk.pos) || $t("Unexpected '{x}'", { x: tk.v }), tk.pos);
        }
        case 'eof': throw new ParseError($t('Unexpected end of expression'), tk.pos);
        default: throw new ParseError($t("Unexpected '{x}'", { x: tk.src || tk.t }), tk.pos);
      }
    }
    const ast = parseOr();
    if (peek().t !== 'eof') throw new ParseError(commaHint(src, peek().pos) || $t("Unexpected '{x}'", { x: peek().v ?? peek().src ?? peek().t }), peek().pos);
    // Russian only (verify-5): a comma between two digits that still reads as two conditions (Re z>0,5<|z| is Re z>0
    // and 5<|z|) is kept, but a caller that passes opts.notes gets a warning to show under its field
    if (digitComma && opts && Array.isArray(opts.notes)) opts.notes.push($t('A comma between digits separates conditions; write the decimal part with a point'));
    // names not defined yet: one is offered as a new number (e.unknown), two at once are refused (DESIGN.md 1.4)
    if (NAMES && NAMED.unknown.length) {
      const u = NAMED.unknown, d = (n) => (NAMES.display ? NAMES.display(n) : n);
      const e = new ParseError(u.length === 1 ? $t('{x} is not defined yet: press Enter to add the number {x}', { x: d(u[0]) }) : $t('One new name at a time: {x}', { x: u.map(d).join(', ') }), 0);
      e.unknown = u.slice();
      throw e;
    }
    if (NAMES && opts && Array.isArray(opts.spans)) opts.spans.push(...NAMED.spans);
    return ast;
  }

  const INV_FN = { sin: 'asin', cos: 'acos', tan: 'atan', sinh: 'asinh', cosh: 'acosh', tanh: 'atanh' };
  const RECIP_FN = ['cot', 'sec', 'csc', 'coth'];
  function isMinusOne(n) {
    if (depends(n) || hasBool(n)) return false;
    try { const v = compile(n)(C(0, 0)); return v.re === -1 && v.im === 0; } catch (e) { return false; }
  }

  // ---------- analysis ----------
  const isBool = (n) => ['cmp', 'and', 'or', 'not'].includes(n.t);
  function depends(n) {
    switch (n.t) {
      case 'num': return false;
      case 'var': return true;
      default: return ['a', 'b', 'n'].some((k) => n[k] && depends(n[k]));
    }
  }
  function usesVars(n, set = new Set()) {
    if (n.t === 'var') set.add(n.n);
    for (const k of ['a', 'b', 'n']) if (n[k]) usesVars(n[k], set);
    return set;
  }
  function hasBool(n) {
    if (isBool(n)) return true;
    return ['a', 'b', 'n'].some((k) => n[k] && hasBool(n[k]));
  }

  // ---------- compilation to closures ----------
  const FUN = {
    sin: CX.sin, cos: CX.cos, tan: CX.tan, sinh: CX.sinh, cosh: CX.cosh, tanh: CX.tanh,
    cot: (a) => CX.inv(CX.tan(a)), sec: (a) => CX.inv(CX.cos(a)), csc: (a) => CX.inv(CX.sin(a)), coth: (a) => CX.inv(CX.tanh(a)),
    asin: CX.asin, acos: CX.acos, atan: CX.atan, asinh: CX.asinh, acosh: CX.acosh, atanh: CX.atanh,
    exp: CX.exp, abs: (a) => C(CX.abs(a), 0), conj: CX.conj, re: (a) => C(a.re, 0), im: (a) => C(a.im, 0),
    arg: (a) => C(Math.atan2(a.im, a.re), 0),
  };
  function compile(ast, { theta = Math.PI } = {}) {
    function build(n) {
      if (isBool(n)) throw new ParseError($t('Comparisons are only allowed in region formulas'), 0);
      if (!depends(n)) {
        // constants (\sqrt{2}, \log 2, i^{i}) always take their principal value, whatever the cut of the formula
        const f = theta === Math.PI ? buildRaw(n) : compile(n);
        const v = f(C(0, 0));
        return () => v;
      }
      return buildRaw(n);
    }
    function buildRaw(n) {
      switch (n.t) {
        case 'num': { const v = n.v; return () => v; }
        case 'var':
          switch (n.n) {
            case 'z': return (z) => z;
            case 'x': return (z) => C(z.re, 0);
            case 'y': return (z) => C(z.im, 0);
            case 'r': return (z) => C(Math.hypot(z.re, z.im), 0);
            case 'theta': return (z) => C(Math.atan2(z.im, z.re), 0);
          }
          break;
        case 'neg': { const A = build(n.a); return (z) => CX.neg(A(z)); }
        case 'add': { const A = build(n.a), B = build(n.b); return (z) => CX.add(A(z), B(z)); }
        case 'sub': { const A = build(n.a), B = build(n.b); return (z) => CX.sub(A(z), B(z)); }
        case 'mul': { const A = build(n.a), B = build(n.b); return (z) => CX.mul(A(z), B(z)); }
        case 'div': { const A = build(n.a), B = build(n.b); return (z) => CX.div(A(z), B(z)); }
        case 'pow': {
          const A = build(n.a), B = build(n.b);
          if (!depends(n.b)) {
            const v = B(C(0, 0));
            if (v.im === 0 && Number.isInteger(v.re) && Math.abs(v.re) <= 4096) { const k = v.re; return (z) => CX.ipow(A(z), k); }
            if (v.im === 0) { const s = v.re; return (z) => CX.powReal(A(z), s, theta); }
            return (z) => CX.pow(A(z), v, theta);
          }
          if (!depends(n.a)) {
            const base = A(C(0, 0));
            if (base.re === Math.E && base.im === 0) return (z) => CX.exp(B(z));
            const L = CX.log(base); // principal log of a constant base: 2^{z} = e^{z \ln 2} for every cut
            return (z) => CX.exp(CX.mul(B(z), L));
          }
          return (z) => CX.pow(A(z), B(z), theta);
        }
        case 'root': {
          const A = build(n.a), N = build(n.n);
          const nv = N(C(0, 0));
          if (depends(n.n)) throw new ParseError($t('Root index must be a constant'), 0);
          const s = CX.div(CX.ONE, nv);
          if (s.im === 0) return (z) => CX.powReal(A(z), s.re, theta);
          return (z) => CX.pow(A(z), s, theta);
        }
        case 'call': {
          const A = build(n.a);
          if (n.f === 'log') return (z) => CX.log(A(z), theta);
          if (n.f === 'sqrt') return (z) => CX.powReal(A(z), 0.5, theta);
          const F = FUN[n.f];
          if (!F) throw new ParseError($t('Unknown function {f}', { f: I18N.fnName(n.f) }), 0);
          return (z) => F(A(z));
        }
      }
      throw new ParseError($t("Cannot evaluate '{x}'", { x: n.t }), 0);
    }
    return build(ast);
  }

  // Region formulas compile to a real "level" function, positive inside.
  function compileLevel(ast) {
    if (!hasBool(ast)) throw new ParseError($t('A region needs a comparison, e.g. |z| < 1'), 0);
    const san = (v) => (Number.isNaN(v) ? -Infinity : v);
    function lv(n) {
      switch (n.t) {
        case 'cmp': {
          if (n.op === '=') throw new ParseError(CURVE_NOT_AREA, 0);
          const A = compile(n.a), B = compile(n.b);
          if (n.op === '<' || n.op === '<=') return (z) => san(B(z).re - A(z).re);
          return (z) => san(A(z).re - B(z).re);
        }
        case 'and': { const a = lv(n.a), b = lv(n.b); return (z) => Math.min(a(z), b(z)); }
        case 'or': { const a = lv(n.a), b = lv(n.b); return (z) => Math.max(a(z), b(z)); }
        case 'not': { const a = lv(n.a); return (z) => -a(z); }
      }
      throw new ParseError($t('Combine comparisons with and / or / not'), 0);
    }
    return lv(ast);
  }

  // ---------- equations: region formulas of dimension 1 ----------
  // Expr.classifyRelation(ast) -> the dimension of a region formula (parsed with allowRel):
  //   {dim: 'area'}                         inequalities only (Expr.compileLevel's formulas, unchanged);
  //   {dim: 'curve', pieces: [{eq, restrict, real}]}  at least one equation. The set is the union of the pieces; a
  //       piece is the curve of one equation eq ({t: 'cmp', op: '='}) where the area formula restrict (an AST, or
  //       null: everywhere) holds. 'or' unites curves, 'and' (',') with inequalities restricts them; real says how
  //       both sides were found real: 'structural' (built from Re, Im, |.|, arg, real constants...), 'numeric' (real
  //       at every test point: z \bar z = 1), 'partial' (real on part of the plane: \ln(\operatorname{Re} z) = 0;
  //       the curve lives where the difference of the sides is real) or 'complex' (complex sides whose difference D
  //       still vanishes along a curve: z = \bar z, \bar z = 1/z; the piece then has dir, a unit complex c such that
  //       the curve is the part of Re(D conj c) = 0 where Im(D conj c) = 0 too). The same equation twice joined by
  //       'and' is one piece. Sides equal on a whole region (|Re z| = Re z) are refused (REL_MSG.region);
  //   {dim: 'none', error}                   no comparison at all;
  //   {dim: 'error', error}                  a set that is neither a curve nor an area (the messages say why).
  const CURVE_NOT_AREA = $t('An equation (=) describes a curve, not a filled region: use <, >, ≤ or ≥ for an area');
  const REL_MSG = {
    none: $t('A region needs a comparison, e.g. |z| < 1, or an equation for a curve, e.g. Re z = 0'),
    points: $t("Two equations that must both hold meet only at isolated points, not along a curve. To draw both curves, join them with 'or'."),
    chain: $t("A chain like a = b = c asks for two equations at once, which meet only at isolated points. Write one equation, or join two with 'or'."),
    mix: $t("'or' between an equation and an inequality mixes a curve with an area. Add them as two shapes, or use ',' (and) to keep the part of the curve where the inequality holds."),
    not: $t("'not' of an equation is the whole plane minus a curve, which is not a curve. Put 'not' around inequalities only."),
    complex: $t('Both sides of an equation must be real numbers: here they are complex, and no curve was found where both their real and imaginary parts agree (a complex equation usually holds only at isolated points). Take Re, Im, |·| or arg of each side, e.g. Re z = 0, |z − 1| = 2 or arg z = π/4. For the isolated points where the sides agree, write |A − B| = 0 (for z³ = 1: |z^3 − 1| = 0).'),
    region: $t('The two sides are equal on a whole region, not along a curve, so the equation does not describe a curve. Use < or > for an area.'),
    constant: $t('This equation does not involve z, so it does not describe a curve.'),
    identity: $t('The two sides are equal for every z, so the equation does not pick out a curve.'),
    undefined: $t('The two sides are not finite anywhere, so the equation has no points.'),
    combine: $t('Combine comparisons with and / or / not'),
  };
  // structural realness: {real: the value is real wherever it is defined, nonneg: and >= 0}
  function realOf(n) {
    const R = (real, nonneg = false) => ({ real: !!real, nonneg: !!(real && nonneg) });
    if (!depends(n)) {
      let v = null;
      try { v = compile(n)(C(0, 0)); } catch (e) { v = null; }
      if (!v || !CX.isFin(v)) return R(false);
      const re = v.im === 0 || Math.abs(v.im) <= 1e-14 * Math.abs(v.re);
      return R(re, v.re >= 0);
    }
    switch (n.t) {
      case 'var': return n.n === 'z' ? R(false) : R(true, n.n === 'r');
      case 'neg': return R(realOf(n.a).real);
      case 'add': { const a = realOf(n.a), b = realOf(n.b); return R(a.real && b.real, a.nonneg && b.nonneg); }
      case 'sub': { const a = realOf(n.a), b = realOf(n.b); return R(a.real && b.real); }
      case 'mul': case 'div': { const a = realOf(n.a), b = realOf(n.b); return R(a.real && b.real, a.nonneg && b.nonneg); }
      case 'pow': {
        const a = realOf(n.a), b = realOf(n.b);
        if (!a.real || !b.real) return R(false);
        if (!depends(n.b)) {
          const v = compile(n.b)(C(0, 0)).re;
          if (Number.isInteger(v) && Math.abs(v) <= 4096) return R(true, a.nonneg || v % 2 === 0);
        }
        return R(a.nonneg, true);
      }
      case 'root': return R(realOf(n.a).nonneg, true);
      case 'call': {
        const a = realOf(n.a);
        switch (n.f) {
          case 're': case 'im': case 'arg': return R(true);
          case 'abs': return R(true, true);
          case 'conj': return R(a.real, a.nonneg);
          case 'exp': case 'cosh': return R(a.real, true);
          case 'sin': case 'cos': case 'tan': case 'cot': case 'sec': case 'csc':
          case 'sinh': case 'tanh': case 'coth': case 'atan': case 'asinh': return R(a.real);
          case 'sqrt': return R(a.nonneg, true);
          case 'log': return R(a.nonneg);
        }
        return R(false);
      }
    }
    return R(false);
  }
  // test points for the numerical checks of an equation: six radii, eight angles each (none at 0, ±1, ±i)
  const PROBE = (() => {
    const out = [];
    let k = 0;
    for (const r of [0.37, 0.93, 1.71, 2.9, 5.3, 11.7]) for (let j = 0; j < 8; j++, k++) { const t = 0.3 + 2.399963 * k; out.push(C(r * Math.cos(t), r * Math.sin(t))); }
    return out;
  })();
  // a complex equation A = B whose solutions still form a curve (z = \bar z, \bar z = 1/z, z^2 = \bar z^2: the real and
  // imaginary parts of D = A - B vanish together along it). Along chords between scaled probe points, the sign changes
  // of Re(D conj c) (c a fixed generic direction) are bisected; where |D| is at rounding level there too, the chord
  // crossed a curve of zeros of D (a chord almost never passes through an isolated zero, and at a pole |D| is about
  // the size of the sides). Two such crossings: returns c (Curves traces Re(D conj c) = 0 and keeps the part where
  // Im(D conj c) vanishes too); otherwise null.
  const CDIRS = [C(Math.cos(0.4636476090008061), Math.sin(0.4636476090008061)), C(Math.cos(2.0344439357957027), Math.sin(2.0344439357957027))];
  function complexCurveDir(A, B) {
    const D = (z) => { const a = A(z), b = B(z); return { re: a.re - b.re, im: a.im - b.im, m: CX.abs(a) + CX.abs(b) }; };
    const lerp = (p, q, t) => C(p.re + t * (q.re - p.re), p.im + t * (q.im - p.im));
    for (const c of CDIRS) {
      const gc = (z) => { const d = D(z); return d.re * c.re + d.im * c.im; };
      let hits = 0;
      for (const s of [1, 24, 600]) for (let k = 0; k + 1 < PROBE.length; k++) {
        const p = C(PROBE[k].re * s, PROBE[k].im * s), q = C(PROBE[k + 1].re * s, PROBE[k + 1].im * s);
        let tp = 0, fp = gc(p);
        for (let j = 1; j <= 12; j++) {
          const t = j / 12, f = gc(lerp(p, q, t));
          if (Number.isFinite(fp) && Number.isFinite(f) && (fp < 0) !== (f < 0)) {
            let lo = tp, hi = t, flo = fp;
            for (let it = 0; it < 64; it++) {
              const m = 0.5 * (lo + hi);
              if (m === lo || m === hi) break;
              const fm = gc(lerp(p, q, m));
              if (!Number.isFinite(fm)) break;
              if ((fm < 0) === (flo < 0)) { lo = m; flo = fm; } else hi = m;
            }
            const d = D(lerp(p, q, lo));
            if (Math.hypot(d.re, d.im) <= 1e-9 * d.m && ++hits >= 2) return c;
          }
          tp = t; fp = f;
        }
      }
    }
    return null;
  }
  // the kind of realness of an equation's sides, or the key of its REL_MSG error. An equation whose sides agree on an
  // open set (|Re z| = Re z on Re z >= 0, \log e^z = z on |Im z| < π) is refused: at a probe point where the sides
  // agree, they agree at three points around it too (a curve through the probe point passes through none of them).
  function equationKind(n) {
    if (!depends(n.a) && !depends(n.b)) return { err: 'constant' };
    const structural = realOf(n.a).real && realOf(n.b).real;
    let A, B;
    try { A = compile(n.a); B = compile(n.b); } catch (e) { return { err: null, msg: e.message }; }
    const same = (p) => {
      const a = A(p), b = B(p);
      return CX.isFin(a) && CX.isFin(b) && Math.hypot(a.re - b.re, a.im - b.im) <= 1e-12 * (CX.abs(a) + CX.abs(b));
    };
    let fin = 0, real = 0, zero = 0, area = 0;
    for (const p of PROBE) {
      const a = A(p), b = B(p);
      if (!CX.isFin(a) || !CX.isFin(b)) continue;
      fin++;
      const s = CX.abs(a) + CX.abs(b), dre = a.re - b.re, dim = a.im - b.im;
      if (Math.abs(dim) <= 1e-9 * s) real++;
      if (Math.hypot(dre, dim) <= 1e-12 * s) {
        zero++;
        const d = 1e-3 * CX.abs(p);
        if ([0.3, 2.4, 4.5].every((t) => same(C(p.re + d * Math.cos(t), p.im + d * Math.sin(t))))) area++;
      }
    }
    if (!fin) return { err: 'undefined' };
    if (zero === fin) return { err: 'identity' };
    if (area) return { err: 'region' };
    if (structural) return { real: 'structural' };
    if (real === fin) return { real: 'numeric' };
    if (real < 0.1 * fin) {
      const dir = complexCurveDir(A, B);
      return dir ? { real: 'complex', dir } : { err: 'complex' };
    }
    return { real: 'partial' };
  }
  // the same equation, either way round (sameAst: below, with simplify)
  const sameEq = (p, q) => (sameAst(p.a, q.a) && sameAst(p.b, q.b)) || (sameAst(p.a, q.b) && sameAst(p.b, q.a));
  function classifyRelation(ast) {
    if (!ast || !hasBool(ast)) return { dim: 'none', error: REL_MSG.none };
    class Fail { constructor(msg) { this.msg = msg; } }
    const AREA = { area: true };
    function go(n) {
      switch (n.t) {
        case 'cmp': {
          if (n.op !== '=') return AREA;
          const k = equationKind(n);
          if (k.err || k.msg) throw new Fail(k.err ? REL_MSG[k.err] : k.msg);
          return { pieces: [k.dir ? { eq: n, restrict: null, real: k.real, dir: k.dir } : { eq: n, restrict: null, real: k.real }] };
        }
        case 'and': {
          const a = go(n.a), b = go(n.b);
          // the same equation twice (Re z = 0 and Re z = 0) is that equation
          if (a.pieces && b.pieces && a.pieces.length === 1 && b.pieces.length === 1 && sameEq(a.pieces[0].eq, b.pieces[0].eq)) {
            const pa = a.pieces[0], pb = b.pieces[0];
            const rs = pa.restrict && pb.restrict ? { t: 'and', a: pa.restrict, b: pb.restrict } : pa.restrict || pb.restrict;
            return { pieces: [Object.assign({}, pa, { restrict: rs })] };
          }
          if (a.pieces && b.pieces) throw new Fail(n.b.chain ? REL_MSG.chain : REL_MSG.points);
          const r = (c, other) => ({ pieces: c.pieces.map((p) => Object.assign({}, p, { restrict: p.restrict ? { t: 'and', a: p.restrict, b: other } : other })) });
          if (a.pieces) return r(a, n.b);
          if (b.pieces) return r(b, n.a);
          return AREA;
        }
        case 'or': {
          const a = go(n.a), b = go(n.b);
          if (a.pieces && b.pieces) return { pieces: [...a.pieces, ...b.pieces] };
          if (a.pieces || b.pieces) throw new Fail(REL_MSG.mix);
          return AREA;
        }
        case 'not': {
          if (go(n.a).pieces) throw new Fail(REL_MSG.not);
          return AREA;
        }
      }
      throw new Fail(REL_MSG.combine);
    }
    try {
      const r = go(ast);
      return r.pieces ? { dim: 'curve', pieces: r.pieces } : { dim: 'area' };
    } catch (e) {
      if (e instanceof Fail) return { dim: 'error', error: e.msg };
      throw e;
    }
  }

  function constValue(src) {
    const ast = parse(String(src));
    if (hasBool(ast)) throw new ParseError($t('Expected a number'), 0);
    if (depends(ast)) throw new ParseError($t('Expected a constant (no z)'), 0);
    const v = compile(ast)(C(0, 0));
    if (!CX.isFin(v)) throw new ParseError($t('Value is not finite'), 0);
    return v;
  }

  // Structural classification of a function expression, used for guaranteed properties.
  function classify(ast) {
    const K = (o) => Object.assign({ dep: true, analytic: false, entire: false, rational: false, poly: false, deg: 0, branch: false }, o);
    const CONST = K({ dep: false, analytic: true, entire: true, rational: true, poly: true, deg: 0 });
    // a constant subexpression that is not a finite number (1/0, log 0, ...) makes nothing guaranteed
    const BADCONST = K({ dep: false });
    const cval = (n) => { try { return compile(n)(C(0, 0)); } catch (e) { return null; } };
    const finite = (v) => !!v && CX.isFin(v);
    function go(n) {
      if (!depends(n)) return finite(cval(n)) ? CONST : BADCONST;
      switch (n.t) {
        case 'var':
          if (n.n === 'z') return K({ analytic: true, entire: true, rational: true, poly: true, deg: 1 });
          return K({});
        case 'neg': return go(n.a);
        case 'add': case 'sub': {
          const a = go(n.a), b = go(n.b);
          return K({ analytic: a.analytic && b.analytic, entire: a.entire && b.entire, rational: a.rational && b.rational, poly: a.poly && b.poly, deg: Math.max(a.deg, b.deg), branch: a.branch || b.branch });
        }
        case 'mul': {
          const a = go(n.a), b = go(n.b);
          return K({ analytic: a.analytic && b.analytic, entire: a.entire && b.entire, rational: a.rational && b.rational, poly: a.poly && b.poly, deg: a.deg + b.deg, branch: a.branch || b.branch });
        }
        case 'div': {
          const a = go(n.a), b = go(n.b);
          if (!b.dep) {
            const v = cval(n.b);
            if (!finite(v) || (v.re === 0 && v.im === 0)) return K({ branch: a.branch });
            return a;
          }
          return K({ analytic: a.analytic && b.analytic, rational: a.rational && b.rational, branch: a.branch || b.branch });
        }
        case 'pow': {
          const a = go(n.a), b = go(n.b);
          if (!b.dep) {
            const v = cval(n.b);
            if (!finite(v)) return K({ branch: a.branch });
            const isInt = v.im === 0 && Number.isInteger(v.re) && Math.abs(v.re) <= 4096;
            if (isInt && v.re >= 0) return K({ analytic: a.analytic, entire: a.entire, rational: a.rational, poly: a.poly, deg: a.deg * v.re, branch: a.branch });
            if (isInt) return K({ analytic: a.analytic, rational: a.rational, branch: a.branch });
            return K({ analytic: a.analytic, branch: true });
          }
          if (!a.dep) {
            const base = cval(n.a);
            const nz = finite(base) && !(base.re === 0 && base.im === 0);
            return K({ analytic: b.analytic && nz, entire: b.entire && nz, branch: b.branch });
          }
          return K({ analytic: a.analytic && b.analytic, branch: true });
        }
        case 'root': {
          const a = go(n.a);
          return K({ analytic: a.analytic, branch: true });
        }
        case 'call': {
          const a = go(n.a);
          if (['exp', 'sin', 'cos', 'sinh', 'cosh'].includes(n.f)) return K({ analytic: a.analytic, entire: a.entire, branch: a.branch });
          if (['tan', 'cot', 'sec', 'csc', 'tanh', 'coth'].includes(n.f)) return K({ analytic: a.analytic, branch: a.branch });
          if (['log', 'sqrt'].includes(n.f)) return K({ analytic: a.analytic, branch: true });
          if (['asin', 'acos', 'atan', 'asinh', 'acosh', 'atanh'].includes(n.f)) return K({ analytic: a.analytic, branch: true, fixedCut: true });
          return K({ branch: a.branch });
        }
      }
      return K({});
    }
    return go(ast);
  }

  // ---------- exact polynomial expansion ----------
  // Coefficients (lowest degree first) of a formula with classify(ast).poly, i.e. built from z, constants,
  // + - * and non-negative integer powers, and / by a constant. Each coefficient c[k] carries m[k], a bound on the
  // sizes of the terms summed into it, so a cancelled coefficient (|c| tiny against m) is never taken for a
  // nonzero one. When every constant is a Gaussian integer and every m stays below 2^53 the arithmetic is exact
  // (exact: true) and c[k] = 0 means exactly 0. Throws a RangeError above maxDeg or on overflow.
  function polyExpand(ast, maxDeg = 4096) {
    const BIG = 2 ** 53;
    const isGI = (v) => Number.isInteger(v.re) && Number.isInteger(v.im) && Math.abs(v.re) < BIG && Math.abs(v.im) < BIG;
    const konst = (v, exact) => {
      if (!CX.isFin(v)) throw new RangeError('not finite');
      if (CX.abs(v) > 0 && CX.abs(v) < 1e-280) throw new RangeError('underflow');
      return { c: [v], m: [CX.abs(v)], exact: exact && isGI(v) };
    };
    // a nonzero bound near the underflow range loses its relative accuracy (or becomes 0, which would read as
    // an exactly zero coefficient): give up rather than guess
    const fin = (P) => {
      if (!P.m.every(Number.isFinite) || !P.c.every(CX.isFin)) throw new RangeError('overflow');
      if (P.m.some((x) => x > 0 && x < 1e-280)) throw new RangeError('underflow');
      if (P.exact && !P.m.every((x) => x < BIG)) P.exact = false;
      return P;
    };
    const lin = (A, B, sg) => {
      const n = Math.max(A.c.length, B.c.length), c = [], m = [];
      for (let i = 0; i < n; i++) {
        const a = A.c[i] || C(0, 0), b = B.c[i] || C(0, 0);
        c.push(C(a.re + sg * b.re, a.im + sg * b.im));
        m.push((A.m[i] || 0) + (B.m[i] || 0));
      }
      return fin({ c, m, exact: A.exact && B.exact });
    };
    const mul = (A, B) => {
      const n = A.c.length + B.c.length - 1;
      if (n - 1 > maxDeg) throw new RangeError('degree');
      const re = new Float64Array(n), im = new Float64Array(n), m = new Float64Array(n);
      for (let i = 0; i < A.c.length; i++) {
        const a = A.c[i], ma = A.m[i];
        if (ma === 0) continue;
        for (let j = 0; j < B.c.length; j++) {
          const b = B.c[j], mb = B.m[j];
          if (mb === 0) continue;
          if (!(ma * mb >= 1e-280)) throw new RangeError('underflow');
          re[i + j] += a.re * b.re - a.im * b.im;
          im[i + j] += a.re * b.im + a.im * b.re;
          m[i + j] += ma * mb;
        }
      }
      return fin({ c: Array.from(re, (x, k) => C(x, im[k])), m: Array.from(m), exact: A.exact && B.exact });
    };
    function pw(A, k) {
      // a monomial stays a monomial (z^{4096} costs nothing)
      const nz = [];
      A.m.forEach((x, i) => { if (x > 0) nz.push(i); });
      if (nz.length <= 1) {
        if (!nz.length) return k === 0 ? konst(C(1, 0), true) : A;
        const i = nz[0], d = i * k;
        if (d > maxDeg) throw new RangeError('degree');
        const c = Array.from({ length: d + 1 }, () => C(0, 0)), m = new Array(d + 1).fill(0);
        c[d] = CX.ipow(A.c[i], k); m[d] = Math.pow(A.m[i], k);
        if (k > 0 && !(m[d] >= 1e-280)) throw new RangeError('underflow');
        return fin({ c, m, exact: A.exact && (k === 0 || (A.c[i].im === 0 && Math.abs(A.c[i].re) === 1) || CX.isZero(A.c[i])) });
      }
      let r = konst(C(1, 0), true), b = A;
      for (;;) {
        if (k % 2 === 1) r = mul(r, b);
        k = Math.floor(k / 2);
        if (!k) return r;
        b = mul(b, b);
      }
    }
    function go(n) {
      switch (n.t) {
        case 'num': return konst(n.v, n.name !== 'e' && n.name !== 'pi');
        case 'var':
          if (n.n === 'z') return { c: [C(0, 0), C(1, 0)], m: [0, 1], exact: true };
          break;
        case 'neg': { const A = go(n.a); return { c: A.c.map(CX.neg), m: A.m, exact: A.exact }; }
        case 'add': return lin(go(n.a), go(n.b), 1);
        case 'sub': return lin(go(n.a), go(n.b), -1);
        case 'mul': return mul(go(n.a), go(n.b));
        case 'div': {
          if (depends(n.b)) break;
          const A = go(n.a), B = go(n.b);
          if (B.c.length !== 1) break;
          const b = B.c[0], ab = CX.abs(b);
          if (!(ab > 0)) throw new RangeError('division by zero');
          // relative size of b's own uncertainty, carried into every coefficient
          const rb = B.m[0] / ab;
          return fin({ c: A.c.map((x) => CX.div(x, b)), m: A.c.map((x, i) => (A.m[i] + CX.abs(x) * rb) / ab), exact: false });
        }
        case 'pow': {
          if (depends(n.b)) break;
          const v = compile(n.b)(C(0, 0));
          if (!(v.im === 0 && Number.isInteger(v.re) && v.re >= 0 && v.re <= 4096)) {
            if (depends(n.a)) break;
            return konst(compile(n)(C(0, 0)), false);
          }
          return pw(go(n.a), v.re);
        }
      }
      // any other constant subexpression (\sqrt{2}, \log 3, ...) is a plain number
      if (!depends(n)) return konst(compile(n)(C(0, 0)), false);
      throw new RangeError(`not a polynomial: ${n.t}`);
    }
    return go(ast);
  }
  // Degree of a polynomial formula: {lo, hi} with lo the highest index whose coefficient is certainly nonzero
  // and hi the highest one that may be nonzero (-1: none), so the degree is exactly lo when lo === hi.
  // null when the formula cannot be expanded (degree above maxDeg, overflow).
  function polyDegree(ast, maxDeg = 4096) {
    let P;
    try { P = polyExpand(ast, maxDeg); } catch (e) { if (e instanceof RangeError) return null; throw e; }
    let lo = -1, hi = -1;
    P.c.forEach((c, k) => {
      const a = CX.abs(c);
      if (P.exact) { if (a > 0) lo = hi = k; return; }
      if (a > 0 || P.m[k] > 0) hi = k;
      if (a > 1e-8 * P.m[k]) lo = k;
    });
    return { lo, hi, exact: P.exact };
  }

  // ---------- symbolic calculus: AST constructors, simplification, derivative, inverse ----------
  // num(v) builds a constant that toTex prints so that parse reads back the same double: the shortest round-trip
  // decimal, a small fraction p/q (\frac{1}{3}), or m\times 10^{n} for very large or small values.
  const lit = (s) => ({ t: 'num', v: C(parseFloat(s), 0), lit: s });
  const N_I = () => ({ t: 'num', v: C(0, 1), name: 'i' });
  const N = {
    z: () => ({ t: 'var', n: 'z' }),
    neg: (a) => ({ t: 'neg', a }),
    add: (a, b) => ({ t: 'add', a, b }), sub: (a, b) => ({ t: 'sub', a, b }),
    mul: (a, b) => ({ t: 'mul', a, b }), div: (a, b) => ({ t: 'div', a, b }),
    pow: (a, b) => ({ t: 'pow', a, b }), root: (n, a) => ({ t: 'root', n, a }),
    call: (f, a) => ({ t: 'call', f, a }),
    num: numNode, real: (x) => numNode(C(x, 0)),
  };
  function realNode(x) {
    if (x < 0) return N.neg(realNode(-x));
    if (x === 0) return lit('0');
    const s = CX.numExact(x);
    const fr = /^(\d+)\/(\d+)$/.exec(s);
    return fr ? N.div(lit(fr[1]), lit(fr[2])) : lit(s);
  }
  function numNode(v) {
    if (!CX.isFin(v)) throw new Error($t('The result contains a value that is not finite'));
    if (v.im === 0) return realNode(v.re);
    const ai = Math.abs(v.im);
    const ip = ai === 1 ? N_I() : N.mul(realNode(ai), N_I());
    if (v.re === 0) return v.im < 0 ? N.neg(ip) : ip;
    return v.im < 0 ? N.sub(realNode(v.re), ip) : N.add(realNode(v.re), ip);
  }
  const ONE = () => lit('1'), TWO = () => lit('2');
  const constVal = (n) => compile(n)(C(0, 0));
  // a folded constant is shown only when it prints short (6, -2/3, 0.25+i), otherwise the expression stays
  function niceConst(v) {
    if (!CX.isFin(v)) return false;
    const ok = (x) => {
      if (x === 0) return true;
      const s = CX.numExact(Math.abs(x));
      if (/^\d+\/\d+$/.test(s)) return +s.split('/')[1] <= 1000;
      return s.replace(/e.*$/, '').replace('.', '').replace(/^0+/, '').length <= 8;
    };
    return ok(v.re) && ok(v.im);
  }
  const isNum = (n, re, im = 0) => n.t === 'num' && n.v.re === re && n.v.im === im;
  const isZeroN = (n) => isNum(n, 0) || (n.t === 'neg' && isZeroN(n.a));
  const isOneN = (n) => isNum(n, 1);
  const isMinusOneN = (n) => isNum(n, -1) || (n.t === 'neg' && isOneN(n.a));
  // structurally equal subexpressions (the same function of z)
  function sameAst(a, b) {
    if (a === b) return true;
    if (!a || !b || a.t !== b.t) return false;
    if (a.t === 'num') return a.v.re === b.v.re && a.v.im === b.v.im;
    if (a.t === 'var') return a.n === b.n;
    if (a.f !== b.f || a.op !== b.op) return false;
    return ['a', 'b', 'n'].every((k) => (a[k] ? sameAst(a[k], b[k]) : !b[k]));
  }
  // bottom-up: constant folding (when the result prints short) and the 0 / 1 / sign rules; constants move to
  // the left of a product and products associate to the left, so toTex needs no parentheses for them
  function simplify(n) {
    const S = simplify;
    let r;
    switch (n.t) {
      case 'num': case 'var': return n;
      case 'neg': {
        const a = S(n.a);
        if (a.t === 'neg') return a.a;
        if (isZeroN(a)) return lit('0');
        r = N.neg(a);
        break;
      }
      case 'add': {
        const a = S(n.a), b = S(n.b);
        if (isZeroN(a)) return b;
        if (isZeroN(b)) return a;
        if (b.t === 'neg') return S(N.sub(a, b.a));
        if (a.t === 'neg' && depends(b)) return S(N.sub(b, a.a));
        r = N.add(a, b);
        break;
      }
      case 'sub': {
        const a = S(n.a), b = S(n.b);
        if (isZeroN(b)) return a;
        if (isZeroN(a)) return S(N.neg(b));
        if (b.t === 'neg') return S(N.add(a, b.a));
        r = N.sub(a, b);
        break;
      }
      case 'mul': {
        let a = S(n.a), b = S(n.b);
        if (isZeroN(a) || isZeroN(b)) return lit('0');
        if (isOneN(a)) return b;
        if (isOneN(b)) return a;
        if (isMinusOneN(a)) return S(N.neg(b));
        if (isMinusOneN(b)) return S(N.neg(a));
        if (a.t === 'neg') return S(N.neg(N.mul(a.a, b)));
        if (b.t === 'neg') return S(N.neg(N.mul(a, b.a)));
        if (b.t === 'div' && isOneN(b.a)) return S(N.div(a, b.b));
        if (a.t === 'div' && isOneN(a.a)) return S(N.div(b, a.b));
        if (!depends(b) && depends(a)) [a, b] = [b, a];
        if (!depends(a) && b.t === 'mul' && !depends(b.a)) {
          const v = constVal(N.mul(a, b.a));
          if (niceConst(v)) return S(N.mul(numNode(v), b.b));
        }
        if (b.t === 'mul') return S(N.mul(N.mul(a, b.a), b.b));
        r = N.mul(a, b);
        break;
      }
      case 'div': {
        const a = S(n.a), b = S(n.b);
        if (isZeroN(a)) return lit('0');
        if (isOneN(b)) return a;
        if (sameAst(a, b)) return lit('1');
        if (a.t === 'neg') return S(N.neg(N.div(a.a, b)));
        if (b.t === 'neg') return S(N.neg(N.div(a, b.a)));
        r = N.div(a, b);
        break;
      }
      case 'pow': {
        const a = S(n.a), b = S(n.b);
        if (isZeroN(b)) return lit('1');
        if (isOneN(b)) return a;
        if (isOneN(a)) return lit('1');
        r = N.pow(a, b);
        break;
      }
      case 'root': r = N.root(S(n.n), S(n.a)); break;
      case 'call': r = N.call(n.f, S(n.a)); break;
      default: return n;
    }
    if (!depends(r) && !hasBool(r)) {
      let v = null;
      try { v = constVal(r); } catch (e) { v = null; }
      if (v && niceConst(v)) return numNode(v);
    }
    return r;
  }

  // Symbolic derivative d/dz, simplified. Branches are kept: log, √, roots and powers of the result use the same
  // cut theta as the formula. The derivative of a principal inverse trig function uses its principal square root,
  // written as \sqrt when theta is 180° and as cos(arcsin u) etc. otherwise (the same function, independent of theta).
  function diff(ast, { theta = Math.PI } = {}) {
    const principal = theta === Math.PI;
    const NH = (what) => new Error($t('{what} is not holomorphic (it has no complex derivative), so this formula cannot be differentiated in z', { what }));
    const { neg, add, sub, mul, div, pow, call } = N;
    const sq = (a) => pow(a, TWO());
    function D(n) {
      if (isBool(n)) throw new Error($t('A comparison has no derivative'));
      if (!depends(n)) return lit('0');
      switch (n.t) {
        case 'var':
          if (n.n === 'z') return ONE();
          throw NH({ x: 'Re z', y: 'Im z', r: '|z|', theta: 'arg z' }[n.n] || n.n);
        case 'neg': return neg(D(n.a));
        case 'add': return add(D(n.a), D(n.b));
        case 'sub': return sub(D(n.a), D(n.b));
        case 'mul': return add(mul(D(n.a), n.b), mul(n.a, D(n.b)));
        case 'div':
          if (!depends(n.b)) return div(D(n.a), n.b);
          return div(sub(mul(D(n.a), n.b), mul(n.a, D(n.b))), sq(n.b));
        case 'pow': {
          const a = n.a, b = n.b;
          if (!depends(b)) {
            const v = constVal(b);
            if (!CX.isFin(v)) throw new Error($t('The exponent is not a finite number'));
            if (v.im === 0 && Number.isInteger(v.re)) return mul(mul(D(a), numNode(v)), pow(a, numNode(C(v.re - 1, 0))));
            const e1 = CX.sub(v, CX.ONE);
            return mul(mul(D(a), b), pow(a, niceConst(e1) ? numNode(e1) : sub(b, ONE())));
          }
          if (!depends(a)) {
            const base = constVal(a);
            if (base.re === Math.E && base.im === 0) return mul(D(b), n);
            return mul(mul(D(b), call('log', a)), n);
          }
          return mul(n, add(mul(D(b), call('log', a)), div(mul(b, D(a)), a)));
        }
        case 'root':
          if (depends(n.n)) throw new Error($t('Root index must be a constant'));
          return div(mul(D(n.a), n), mul(n.n, n.a));
        case 'call': {
          const a = n.a, Da = D(a);
          const s1 = () => (principal ? call('sqrt', sub(ONE(), sq(a))) : null);
          switch (n.f) {
            case 'exp': return mul(Da, n);
            case 'log': return div(Da, a);
            case 'sqrt': return div(Da, mul(TWO(), n));
            case 'sin': return mul(Da, call('cos', a));
            case 'cos': return neg(mul(Da, call('sin', a)));
            case 'tan': return div(Da, sq(call('cos', a)));
            case 'cot': return neg(div(Da, sq(call('sin', a))));
            case 'sec': return div(mul(Da, call('sin', a)), sq(call('cos', a)));
            case 'csc': return neg(div(mul(Da, call('cos', a)), sq(call('sin', a))));
            case 'sinh': return mul(Da, call('cosh', a));
            case 'cosh': return mul(Da, call('sinh', a));
            case 'tanh': return div(Da, sq(call('cosh', a)));
            case 'coth': return neg(div(Da, sq(call('sinh', a))));
            // principal square roots: sqrt(1 - u^2) = cos(arcsin u) = sin(arccos u), sqrt(u^2 + 1) = cosh(arsinh u),
            // sqrt(u - 1) sqrt(u + 1) = sinh(arcosh u)
            case 'asin': return div(Da, s1() || call('cos', n));
            case 'acos': return neg(div(Da, s1() || call('sin', n)));
            case 'atan': return div(Da, add(ONE(), sq(a)));
            case 'asinh': return div(Da, principal ? call('sqrt', add(sq(a), ONE())) : call('cosh', n));
            case 'acosh': return div(Da, principal ? mul(call('sqrt', sub(a, ONE())), call('sqrt', add(a, ONE()))) : call('sinh', n));
            case 'atanh': return div(Da, sub(ONE(), sq(a)));
            case 'abs': throw NH('|z|');
            case 'conj': throw NH($t('Conjugation z̄'));
            case 're': throw NH('Re z');
            case 'im': throw NH('Im z');
            case 'arg': throw NH('arg z');
          }
          throw new Error($t('No derivative known for {f}', { f: I18N.fnName(n.f) }));
        }
      }
      throw new Error($t("Cannot differentiate '{x}'", { x: n.t }));
    }
    return simplify(simplify(D(ast)));
  }

  // Inverse of a formula in which z occurs once, by undoing its operations from the outside in. Returns
  // {ast, kind}: kind 'both' (a true inverse), 'right' (a branch of the inverse: f(g(w)) = w, as arcsin for sin)
  // or 'left' (g(f(z)) = z, as exp for log). The inverse uses principal branches (cut 180°). Throws an Error whose
  // message says why there is none.
  function invert(ast, { theta = Math.PI } = {}) {
    if (hasBool(ast)) throw new Error($t('A comparison has no inverse'));
    for (const v of usesVars(ast)) if (v !== 'z') throw new Error($t('Re z, Im z, |z| and arg z lose information, so the formula has no inverse'));
    const count = (n) => (n.t === 'var' ? 1 : ['a', 'b', 'n'].reduce((s, k) => s + (n[k] ? count(n[k]) : 0), 0));
    const nz = count(ast);
    const CONST = $t('The formula is constant, so it has no inverse');
    if (!nz) throw new Error(CONST);
    if (nz > 1) throw new Error($tn('z occurs {n} times in the formula, so it cannot be solved for z one operation at a time; the Preimage view shows every solution of f(z) = w', 'z occurs {n} times in the formula, so it cannot be solved for z one operation at a time; the Preimage view shows every solution of f(z) = w', nz));
    const principal = theta === Math.PI;
    const nonzero = (n) => { const v = constVal(n); if (!CX.isFin(v) || CX.isZero(v)) throw new Error(CONST); return v; };
    const branchy = () => { if (!principal) throw new Error($t('A non-integer power with a cut other than 180° has no inverse here; set the cut to 180° or use the Preimage view')); };
    const SPIRAL = $t('A complex exponent winds around 0, so its inverse would need a spiral branch cut; use the Preimage view');
    const { neg, add, sub, mul, div, pow, call, root } = N;
    let w = N.z(), right = true, left = true, n = ast;
    const R = () => { left = false; }, L = () => { right = false; };
    // w -> w^{1/s} for a real exponent s: right inverse when |s| > 1, left inverse when |s| < 1 (principal branches)
    const realPow = (s) => {
      if (Number.isInteger(s) && Math.abs(s) <= 4096) {
        if (s === -1) w = div(ONE(), w);
        else if (s !== 1) {
          const m = Math.abs(s);
          const r = m === 2 ? call('sqrt', w) : root(realNode(m), w);
          w = s > 0 ? r : div(ONE(), r);
          R();
        }
        return;
      }
      branchy();
      w = pow(w, realNode(1 / s));
      if (Math.abs(s) > 1) R(); else L();
    };
    while (n.t !== 'var') {
      switch (n.t) {
        case 'neg': w = neg(w); n = n.a; break;
        case 'add': if (depends(n.a)) { w = sub(w, n.b); n = n.a; } else { w = sub(w, n.a); n = n.b; } break;
        case 'sub': if (depends(n.a)) { w = add(w, n.b); n = n.a; } else { w = sub(n.a, w); n = n.b; } break;
        case 'mul':
          if (depends(n.a)) { nonzero(n.b); w = div(w, n.b); n = n.a; } else { nonzero(n.a); w = div(w, n.a); n = n.b; }
          break;
        case 'div':
          if (depends(n.a)) { nonzero(n.b); w = mul(n.b, w); n = n.a; } else { nonzero(n.a); w = div(n.a, w); n = n.b; }
          break;
        case 'pow':
          if (!depends(n.b)) {
            const v = nonzero(n.b);
            if (v.im !== 0) throw new Error(SPIRAL);
            realPow(v.re);
            n = n.a;
          } else {
            const base = nonzero(n.a);
            if (base.re === 1 && base.im === 0) throw new Error(CONST);
            w = base.re === Math.E && base.im === 0 ? call('log', w) : div(call('log', w), call('log', n.a));
            R();
            n = n.b;
          }
          break;
        case 'root': {
          const v = nonzero(n.n);
          if (v.im !== 0) throw new Error(SPIRAL);
          if (Number.isInteger(v.re) && Math.abs(v.re) <= 4096) { w = pow(w, realNode(v.re)); L(); } else realPow(1 / v.re);
          n = n.a;
          break;
        }
        case 'call': {
          const INV = {
            exp: ['log', R], log: ['exp', L], sin: ['asin', R], cos: ['acos', R], tan: ['atan', R], sinh: ['asinh', R], cosh: ['acosh', R], tanh: ['atanh', R],
            asin: ['sin', L], acos: ['cos', L], atan: ['tan', L], asinh: ['sinh', L], acosh: ['cosh', L], atanh: ['tanh', L], conj: ['conj', () => {}],
          };
          const RECIP = { cot: 'atan', sec: 'acos', csc: 'asin', coth: 'atanh' };
          if (n.f === 'sqrt') { w = pow(w, TWO()); L(); }
          else if (INV[n.f]) { w = call(INV[n.f][0], w); INV[n.f][1](); }
          else if (RECIP[n.f]) { w = call(RECIP[n.f], div(ONE(), w)); R(); }
          else throw new Error($t('|·|, Re, Im and arg lose information, so the formula has no inverse'));
          n = n.a;
          break;
        }
        default: throw new Error($t('This formula has no inverse'));
      }
    }
    if (!right && !left) throw new Error($t('The formula combines a step that takes values several times with a branch cut, so no single-valued inverse undoes it; use the Preimage view'));
    return { ast: simplify(w), kind: right && left ? 'both' : right ? 'right' : 'left' };
  }

  // ---------- LaTeX output ----------
  // returns {s, p}: p = precedence (0 sum, 1 product, 2 unary minus, 3 function/power, 4 atom).
  // bare: the text ends in a function applied without parentheses (\sin z), which would swallow a following
  // juxtaposed factor when parsed back, so a product continues it with \cdot.
  const FNTEX = {
    sin: '\\sin', cos: '\\cos', tan: '\\tan', cot: '\\cot', sec: '\\sec', csc: '\\csc', sinh: '\\sinh', cosh: '\\cosh', tanh: '\\tanh', coth: '\\coth',
    asin: '\\arcsin', acos: '\\arccos', atan: '\\arctan', asinh: '\\operatorname{arsinh}', acosh: '\\operatorname{arcosh}', atanh: '\\operatorname{artanh}',
    log: '\\log', re: '\\operatorname{Re}', im: '\\operatorname{Im}', arg: '\\arg',
  };
  const paren = (x) => `\\left(${x}\\right)`;
  // a sum or difference at the top level (the minus of an exponent 10^{-5} does not count)
  const compoundTex = (s) => /[+]|.-/.test(s.replace(/^-/, '').replace(/\{-/g, '{'));
  function numTex(v, name, lit) {
    if (name === 'pi') return { s: '\\pi', p: 4 };
    if (name === 'e') return { s: 'e', p: 4 };
    // a literal as typed; scientific notation as m\times 10^{n}
    let s = lit && /^[\d.]+([eE][+-]?\d+)?$/.test(lit) ? lit : CX.tex(v);
    const sc = /^([\d.]+)[eE]\+?(-?\d+)$/.exec(s);
    if (sc) s = `${sc[1]}\\times 10^{${sc[2]}}`;
    if (compoundTex(s)) return { s, p: 0 };
    if (s.startsWith('-')) return { s, p: 2 };
    if (s.includes('\\times') || s.includes(' ')) return { s, p: 1 };
    return { s, p: 4 };
  }
  function toTex(ast, arg = { s: 'z', p: 4 }) {
    const wrap = (r, minP) => (r.p < minP ? paren(r.s) : r.s);
    function go(n) {
      switch (n.t) {
        case 'num': return n.param ? { s: nameTex(n.param), p: 4 } : numTex(n.v, n.name, n.lit);
        case 'var':
          if (n.n === 'z') return arg;
          if (n.n === 'x') return { s: `\\operatorname{Re}${arg.p >= 4 ? ' ' : ''}${wrap(arg, 4)}`, p: 3, bare: arg.p >= 4 };
          if (n.n === 'y') return { s: `\\operatorname{Im}${arg.p >= 4 ? ' ' : ''}${wrap(arg, 4)}`, p: 3, bare: arg.p >= 4 };
          if (n.n === 'r') return { s: `\\left|${arg.s}\\right|`, p: 4 };
          return { s: `\\arg${arg.p >= 4 ? ' ' : ''}${wrap(arg, 4)}`, p: 3, bare: arg.p >= 4 };
        case 'neg': { const a = go(n.a); return { s: '-' + wrap(a, 1), p: 2, bare: a.bare && a.p >= 1 }; }
        case 'add': { const a = go(n.a), b = go(n.b); return { s: `${a.s}+${b.p === 2 ? paren(b.s) : b.s}`, p: 0 }; }
        case 'sub': { const a = go(n.a), b = go(n.b); return { s: `${a.s}-${b.p <= 0 || b.p === 2 ? paren(b.s) : b.s}`, p: 0 }; }
        case 'mul': {
          const a = go(n.a), b = go(n.b);
          const as = wrap(a, 1), bs = b.p <= 2 ? paren(b.s) : b.s;
          const sep = (a.bare && a.p >= 1) || /^[0-9.]/.test(bs) || /^-/.test(bs) ? '\\cdot ' : '\\,';
          return { s: as + sep + bs, p: 1, bare: b.bare && b.p > 2 };
        }
        case 'div': return { s: `\\frac{${go(n.a).s}}{${go(n.b).s}}`, p: 4 };
        case 'pow': {
          const a = go(n.a), b = go(n.b);
          if (n.a.t === 'num' && n.a.name === 'e') return { s: `e^{${b.s}}`, p: 3 };
          return { s: `${a.p < 4 || n.a.t === 'div' ? paren(a.s) : a.s}^{${b.s}}`, p: 3 };
        }
        case 'root': return { s: `\\sqrt[${go(n.n).s}]{${go(n.a).s}}`, p: 4 };
        case 'call': {
          const a = go(n.a);
          if (n.f === 'sqrt') return { s: `\\sqrt{${a.s}}`, p: 4 };
          if (n.f === 'abs') return { s: `\\left|${a.s}\\right|`, p: 4 };
          if (n.f === 'conj') return { s: `\\overline{${a.s}}`, p: 4 };
          if (n.f === 'exp') return { s: `e^{${a.s}}`, p: 3 };
          const nm = FNTEX[n.f] || `\\operatorname{${n.f}}`;
          const bare = a.p === 4 && a.s.length <= 3;
          return { s: bare ? `${nm} ${a.s}` : `${nm}${paren(a.s)}`, p: 3, bare };
        }
        case 'cmp': {
          const op = { '<': '<', '>': '>', '<=': '\\le', '>=': '\\ge', '=': '=' }[n.op];
          return { s: `${go(n.a).s} ${op} ${go(n.b).s}`, p: -1 };
        }
        case 'and': return { s: `${go(n.a).s},\\ ${go(n.b).s}`, p: -2 };
        case 'or': return { s: `${go(n.a).s}\\ \\text{or}\\ ${go(n.b).s}`, p: -3 };
        case 'not': return { s: `\\neg\\left(${go(n.a).s}\\right)`, p: 4 };
      }
      return { s: '?', p: 4 };
    }
    return go(ast);
  }

  // a query as a phone keyboard or a paste gives it (review steps-6, steps-14): a capitalized first word that is a function
  // name only in lower case (Sin z, Exp z, Tg z: Android capitalizes the first letter; Log, Ln, Re, Im and Arg are
  // names as they are and stay), a capital Z alone at the start, and superscript digits (z², z⁻¹) as ^{…}
  const SUP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-', '⁺': '+' };
  function typed(src) {
    let q = String(src).replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]+/g, (m) => `^{${[...m].map((c) => SUP[c]).join('')}}`);
    const has = (w) => Object.prototype.hasOwnProperty.call(PLAIN, w) || Object.prototype.hasOwnProperty.call(RU_NAMES, w);
    q = q.replace(/^(\s*\\?)([A-Z][a-z]+)(?![A-Za-z])/, (m, a, w) => (!has(w) && has(w.toLowerCase()) ? a + w.toLowerCase() : m));
    q = q.replace(/^(\s*)Z(?![A-Za-z_])/, '$1z');
    return q;
  }
  return { parse, typed, compile, compileLevel, classifyRelation, REL_MSG, realOf, sameAst, constValue, classify, depends, usesVars, hasBool, toTex, ParseError, paren, polyExpand, polyDegree, compoundTex, diff, invert, simplify, N, setNames, nameTex, nameSpans, GREEK };
})();
if (typeof module !== 'undefined') module.exports = Expr;
