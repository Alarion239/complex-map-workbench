// @ts-check
'use strict';
// parse.js's symbolic calculus: the AST constructors (N), simplification, the derivative and the inverse of a formula.
// Moved out of parse.js (issue #20, the file-size budget) as a factory parse.js calls where it stood, with the names
// of parse.js it reads (each declared before the call, or a function declaration); it returns the ones parse.js uses
const Symbolic = (host) => {
  const { compile, depends, hasBool, hasT, isBool, size, unroll, usesVars, usesZ } = host;
  const { C } = CX;
  // ---------- symbolic calculus: AST constructors, simplification, derivative, inverse ----------
  // num(v) builds a constant that toTex prints so that parse reads back the same double: the shortest round-trip
  // decimal, a small fraction p/q (\frac{1}{3}), or m\times 10^{n} for very large or small values.
  const lit = (s) => ({ t: 'num', v: C(parseFloat(s), 0), lit: s });
  const N_I = () => ({ t: 'num', v: C(0, 1), name: 'i' });
  /** @type {{ [name: string]: (...args: any[]) => ParseNode }} */
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
    if (a.t === 'idx') return a.v === b.v;
    if (a.f !== b.f || a.op !== b.op) return false;
    if ((a.t === 'sum' || a.t === 'iter') && (a.v !== b.v || !sameAst(a.lo, b.lo) || !sameAst(a.hi, b.hi))) return false;
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
      case 'sum': r = Object.assign({}, n, { a: S(n.a) }); break;
      case 'iter': r = Object.assign({}, n, { lo: S(n.lo), a: S(n.a) }); break;
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
      // (a sum's index is a constant here: a part without z has derivative 0, n z^{n−1} for z^n)
      if (!usesZ(n)) return lit('0');
      switch (n.t) {
        // [issue #5] term by term (with the same limits: a power series keeps its radius)
        case 'sum':
          if (usesZ(n.lo) || usesZ(n.hi)) throw new Error($t('The limits of a sum must not depend on z'));
          if (n.op === 'prod') { const u = unroll(n); if (u !== n) return D(u); throw new Error($t('A product of infinitely many factors cannot be differentiated here')); }
          return Object.assign({}, n, { a: D(n.a) });
        // [issue #6] a recurrence: the derivative of the formula it writes out (unroll), when that is short enough
        case 'iter': { const u = unroll(n); if (u.t !== 'iter' && size(u) <= 2000) return D(u); throw new Error($t('This recurrence has too many steps to be differentiated here')); }
        case 'binom': throw new Error($t('No derivative known for {f}', { f: 'binom' }));
        case 'var':
          if (n.n === 'z') return ONE();
          throw NH({ x: 'Re z', y: 'Im z', r: '|z|', theta: 'arg z' }[n.n] || n.n);
        case 'neg': return neg(D(n.a));
        case 'add': return add(D(n.a), D(n.b));
        case 'sub': return sub(D(n.a), D(n.b));
        case 'mul': return add(mul(D(n.a), n.b), mul(n.a, D(n.b)));
        case 'div':
          if (!usesZ(n.b)) return div(D(n.a), n.b);
          return div(sub(mul(D(n.a), n.b), mul(n.a, D(n.b))), sq(n.b));
        case 'pow': {
          const a = n.a, b = n.b;
          if (!usesZ(b) && depends(b)) return mul(mul(D(a), b), pow(a, sub(b, ONE())));
          if (!usesZ(a) && depends(a)) return mul(mul(D(b), call('log', a)), n);
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
            case 'gamma': return mul(Da, mul(n, call('digamma', a)));   // Γ′ = Γ ψ
            case 'zeta': return mul(Da, call('zetad', a));
            case 'fact': return mul(Da, mul(n, call('digamma', add(a, ONE()))));   // (z!)′ = z! ψ(z + 1)
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
    if (hasT(ast, 'sum')) throw new Error($t('A sum or product of many terms is not solved for z here; the Preimage view shows every solution of f(z) = w'));
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
          else if (['gamma', 'zeta', 'digamma', 'zetad'].includes(n.f)) throw new Error($t('Γ, ζ and ψ take each value infinitely often, so the formula has no inverse'));
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
  return { N, diff, invert, sameAst, simplify };
};
import { CX } from './cx.js';
export { Symbolic };
