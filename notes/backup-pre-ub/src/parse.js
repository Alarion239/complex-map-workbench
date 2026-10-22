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
  const PLAIN_NAMES = Object.keys(PLAIN).sort((a, b) => b.length - a.length);
  const LETTERS = { z: 'v:z', w: 'v:z', x: 'v:x', y: 'v:y', r: 'v:r', i: 'c:i', e: 'c:e' };

  function tokFrom(spec, pos) {
    const [t, v] = spec.split(':');
    if (t === 'f') return { t: 'func', v, pos };
    if (t === 'c') return { t: 'const', v, pos };
    if (t === 'v') return { t: 'var', v, pos };
    if (t === 'op') return { t: 'op', v, pos };
    return { t, pos };
  }

  function tokenize(src) {
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
          throw new ParseError(`Unexpected '\\${nx ?? ''}'`, i);
        }
        const name = m[1];
        const spec = LATEX_CMDS[name];
        if (!spec) {
          // suggest the nearest known commands ("Try \\sin or \\sinh")
          const dist = (a, b) => {
            const d = Array.from({ length: a.length + 1 }, (_, r) => [r, ...Array(b.length).fill(0)]);
            for (let c = 1; c <= b.length; c++) d[0][c] = c;
            for (let r = 1; r <= a.length; r++) for (let c = 1; c <= b.length; c++) d[r][c] = Math.min(d[r - 1][c] + 1, d[r][c - 1] + 1, d[r - 1][c - 1] + (a[r - 1] === b[c - 1] ? 0 : 1));
            return d[a.length][b.length];
          };
          const near = Object.keys(LATEX_CMDS).filter((k) => typeof LATEX_CMDS[k] !== 'string' || !LATEX_CMDS[k].startsWith('skip'))
            .map((k) => [k, dist(name, k)]).filter(([, dd]) => dd <= 2).sort((a, b) => a[1] - b[1] || a[0].length - b[0].length).slice(0, 2).map(([k]) => '\\' + k);
          throw new ParseError(`Unknown command \\${name}.${near.length ? ` Try ${near.join(' or ')}.` : ''}`, i);
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
          if (!mm) throw new ParseError(`\\${name} needs a name in braces`, i);
          i += mm[0].length;
          const inner = mm[1];
          const s2 = LATEX_CMDS[inner] && LATEX_CMDS[inner].startsWith('f:') ? LATEX_CMDS[inner] : (PLAIN[inner] || LETTERS[inner]);
          if (!s2) throw new ParseError(`Unknown name '${inner}'`, i);
          toks.push(tokFrom(s2, i));
          continue;
        }
        toks.push(tokFrom(spec, i));
        continue;
      }
      // a number, with an exponent only when [eE] is directly followed by digits (1e-12, 2.5E+3), so that
      // a bare e stays Euler's number (2e^{z}, 2e, e z)
      const num = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(src.slice(i));
      if (num) { toks.push({ t: 'num', v: parseFloat(num[0]), s: num[0], pos: i }); i += num[0].length; continue; }
      if (/[A-Za-z]/.test(ch)) {
        const rest = src.slice(i);
        let matched = null;
        for (const nm of PLAIN_NAMES) {
          if (rest.startsWith(nm)) { matched = nm; break; }
        }
        // lowercase re( / im( as functions
        if (!matched) {
          const mm = /^(re|im)\s*\(/.exec(rest);
          if (mm) matched = mm[1];
        }
        if (matched) {
          const spec = PLAIN[matched] || (matched === 're' ? 'f:re' : 'f:im');
          toks.push(tokFrom(spec, i));
          i += matched.length;
          continue;
        }
        if (LETTERS[ch]) { toks.push(tokFrom(LETTERS[ch], i)); i++; continue; }
        throw new ParseError(`Unknown symbol '${ch}'`, i);
      }
      const two = src.slice(i, i + 2);
      if (two === '**') { toks.push({ t: 'op', v: '^', pos: i }); i += 2; continue; }
      if (two === '<=' || two === '>=') { toks.push({ t: 'op', v: two, pos: i }); i += 2; continue; }
      if (two === '&&') { toks.push({ t: 'and', pos: i }); i += 2; continue; }
      if (ch === '&') { toks.push({ t: 'and', pos: i }); i++; continue; }
      if (ch === '≤') { toks.push({ t: 'op', v: '<=', pos: i }); i++; continue; }
      if (ch === '≥') { toks.push({ t: 'op', v: '>=', pos: i }); i++; continue; }
      if (ch === 'π') { toks.push({ t: 'const', v: 'pi', pos: i }); i++; continue; }
      if (ch === '·' || ch === '×') { toks.push({ t: 'op', v: '*', pos: i }); i++; continue; }
      if (ch === '−') { toks.push({ t: 'op', v: '-', pos: i }); i++; continue; }
      if ('+-*/^()[]{}|,<>'.includes(ch)) { toks.push({ t: 'op', v: ch, pos: i }); i++; continue; }
      throw new ParseError(`Unexpected '${ch}'`, i);
    }
    toks.push({ t: 'eof', pos: n });
    return toks;
  }

  function parse(src, { allowRel = false } = {}) {
    if (!src || !src.trim()) throw new ParseError('Empty expression', 0);
    const toks = tokenize(src);
    let p = 0, absDepth = 0;
    const peek = () => toks[p];
    const next = () => toks[p++];
    const isOp = (tk, v) => tk.t === 'op' && tk.v === v;
    const expect = (v) => {
      const tk = next();
      if (!isOp(tk, v)) throw new ParseError(`Expected '${v}'`, tk.pos);
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
    function parseAnd() {
      let a = parseNot();
      while (peek().t === 'and' || (allowRel && isOp(peek(), ','))) { next(); a = { t: 'and', a, b: parseNot() }; }
      return a;
    }
    function parseNot() {
      if (peek().t === 'not') { next(); return { t: 'not', a: parseNot() }; }
      return parseRel();
    }
    function parseRel() {
      let a = parseAdd();
      let res = null;
      while (peek().t === 'op' && ['<', '>', '<=', '>='].includes(peek().v)) {
        const op = next().v;
        const b = parseAdd();
        const c = { t: 'cmp', op, a, b };
        res = res ? { t: 'and', a: res, b: c } : c;
        a = b;
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
        case 'num': return { t: 'num', v: C(tk.v, 0), lit: tk.s };
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
            else if (RECIP_FN.includes(f)) throw new ParseError(`\\${f}^{-1} is ambiguous: write \\left(\\${f} z\\right)^{-1} for the reciprocal`, tk.pos);
          }
          let a;
          if (isOp(peek(), '(') || isOp(peek(), '{') || isOp(peek(), '[')) a = parsePrimary();
          else if (peek().t === 'eof') throw new ParseError(`Missing argument for ${tk.v}`, tk.pos);
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
            if (!(t2.t === 'op' && (t2.v === close || t2.v === ')' || t2.v === ']' || t2.v === '}'))) throw new ParseError(`Expected '${close}'`, t2.pos);
            return e;
          }
          if (tk.v === '|') {
            absDepth++;
            const e = parseAdd();
            absDepth--;
            if (!isOp(peek(), '|')) throw new ParseError(src.includes('||') ? "Expected '|'. To combine conditions, write 'or' instead of ||" : "Expected '|'", peek().pos);
            expect('|');
            return { t: 'call', f: 'abs', a: e };
          }
          throw new ParseError(`Unexpected '${tk.v}'`, tk.pos);
        }
        case 'eof': throw new ParseError('Unexpected end of expression', tk.pos);
        default: throw new ParseError(`Unexpected '${tk.t}'`, tk.pos);
      }
    }
    const ast = parseOr();
    if (peek().t !== 'eof') throw new ParseError(`Unexpected '${peek().v ?? peek().t}'`, peek().pos);
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
      if (isBool(n)) throw new ParseError('Comparisons are only allowed in region formulas', 0);
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
          if (depends(n.n)) throw new ParseError('Root index must be a constant', 0);
          const s = CX.div(CX.ONE, nv);
          if (s.im === 0) return (z) => CX.powReal(A(z), s.re, theta);
          return (z) => CX.pow(A(z), s, theta);
        }
        case 'call': {
          const A = build(n.a);
          if (n.f === 'log') return (z) => CX.log(A(z), theta);
          if (n.f === 'sqrt') return (z) => CX.powReal(A(z), 0.5, theta);
          const F = FUN[n.f];
          if (!F) throw new ParseError(`Unknown function ${n.f}`, 0);
          return (z) => F(A(z));
        }
      }
      throw new ParseError(`Cannot evaluate '${n.t}'`, 0);
    }
    return build(ast);
  }

  // Region formulas compile to a real "level" function, positive inside.
  function compileLevel(ast) {
    if (!hasBool(ast)) throw new ParseError('A region needs a comparison, e.g. |z| < 1', 0);
    const san = (v) => (Number.isNaN(v) ? -Infinity : v);
    function lv(n) {
      switch (n.t) {
        case 'cmp': {
          const A = compile(n.a), B = compile(n.b);
          if (n.op === '<' || n.op === '<=') return (z) => san(B(z).re - A(z).re);
          return (z) => san(A(z).re - B(z).re);
        }
        case 'and': { const a = lv(n.a), b = lv(n.b); return (z) => Math.min(a(z), b(z)); }
        case 'or': { const a = lv(n.a), b = lv(n.b); return (z) => Math.max(a(z), b(z)); }
        case 'not': { const a = lv(n.a); return (z) => -a(z); }
      }
      throw new ParseError('Combine comparisons with and / or / not', 0);
    }
    return lv(ast);
  }

  function constValue(src) {
    const ast = parse(String(src));
    if (hasBool(ast)) throw new ParseError('Expected a number', 0);
    if (depends(ast)) throw new ParseError('Expected a constant (no z)', 0);
    const v = compile(ast)(C(0, 0));
    if (!CX.isFin(v)) throw new ParseError('Value is not finite', 0);
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
    if (!CX.isFin(v)) throw new Error('The result contains a value that is not finite');
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
    const NH = (what) => new Error(`${what} is not holomorphic (it has no complex derivative), so this formula cannot be differentiated in z`);
    const { neg, add, sub, mul, div, pow, call } = N;
    const sq = (a) => pow(a, TWO());
    function D(n) {
      if (isBool(n)) throw new Error('A comparison has no derivative');
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
            if (!CX.isFin(v)) throw new Error('The exponent is not a finite number');
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
          if (depends(n.n)) throw new Error('Root index must be a constant');
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
            case 'conj': throw NH('Conjugation z̄');
            case 're': throw NH('Re z');
            case 'im': throw NH('Im z');
            case 'arg': throw NH('arg z');
          }
          throw new Error(`No derivative known for ${n.f}`);
        }
      }
      throw new Error(`Cannot differentiate '${n.t}'`);
    }
    return simplify(simplify(D(ast)));
  }

  // Inverse of a formula in which z occurs once, by undoing its operations from the outside in. Returns
  // {ast, kind}: kind 'both' (a true inverse), 'right' (a branch of the inverse: f(g(w)) = w, as arcsin for sin)
  // or 'left' (g(f(z)) = z, as exp for log). The inverse uses principal branches (cut 180°). Throws an Error whose
  // message says why there is none.
  function invert(ast, { theta = Math.PI } = {}) {
    if (hasBool(ast)) throw new Error('A comparison has no inverse');
    for (const v of usesVars(ast)) if (v !== 'z') throw new Error('Re z, Im z, |z| and arg z lose information, so the formula has no inverse');
    const count = (n) => (n.t === 'var' ? 1 : ['a', 'b', 'n'].reduce((s, k) => s + (n[k] ? count(n[k]) : 0), 0));
    const nz = count(ast);
    const CONST = 'The formula is constant, so it has no inverse';
    if (!nz) throw new Error(CONST);
    if (nz > 1) throw new Error(`z occurs ${nz} times in the formula, so it cannot be solved for z one operation at a time; the Preimage view shows every solution of f(z) = w`);
    const principal = theta === Math.PI;
    const nonzero = (n) => { const v = constVal(n); if (!CX.isFin(v) || CX.isZero(v)) throw new Error(CONST); return v; };
    const branchy = () => { if (!principal) throw new Error('A non-integer power with a cut other than 180° has no inverse here; set the cut to 180° or use the Preimage view'); };
    const SPIRAL = 'A complex exponent winds around 0, so its inverse would need a spiral branch cut; use the Preimage view';
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
          else throw new Error('|·|, Re, Im and arg lose information, so the formula has no inverse');
          n = n.a;
          break;
        }
        default: throw new Error('This formula has no inverse');
      }
    }
    if (!right && !left) throw new Error('The formula combines a step that takes values several times with a branch cut, so no single-valued inverse undoes it; use the Preimage view');
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
        case 'num': return numTex(n.v, n.name, n.lit);
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
          const op = { '<': '<', '>': '>', '<=': '\\le', '>=': '\\ge' }[n.op];
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

  return { parse, compile, compileLevel, constValue, classify, depends, usesVars, hasBool, toTex, ParseError, paren, polyExpand, polyDegree, compoundTex, diff, invert, simplify, N };
})();
if (typeof module !== 'undefined') module.exports = Expr;
