// @ts-check
'use strict';
// funcs.js's formula steps: a custom formula recognized as catalog steps shown as visible steps (splitSteps, the
// rows, labels and moves of the split; notes/formula-steps/DESIGN.md 2). Moved out of funcs.js (issue #20, the
// file-size budget) as a factory funcs.js calls where it stood, with the names of funcs.js it reads (each declared
// before the call, or a function declaration); it returns the ones funcs.js exports
const FormulaSteps = (host) => {
  const { DEFS, DEG, REC_CACHE_MAX, build, buildVals, mulLabel, recProbe } = host;
  const { C } = CX;
  // ---------------- a recognized formula as visible steps (notes/formula-steps/DESIGN.md 2) ----------------
  // splitSteps(st, b): the formula step st as catalog steps written as text. One function decides what the search lists,
  // what the Inspector and the ⋯ menu offer and what a click writes, so they never disagree.
  //   {kind: 'one' | 'many' | 'none', steps: [{type, params, kept}], names, rows, eq, reason, pnames, blocked}
  // The steps are the recognizer's chain R as it is (Möbius runs stay merged: the deformation, cuts and lamps are the
  // ones already proved). Each group's parameters are written from the formula's own spelling (rule 1: shared numbers
  // keep their names), else as short exact numbers (rule 2), else the group stays a formula part (rule 3, kept); every
  // written step is built again from its text and checked against the formula's piece (the gate). Never Expr.simplify,
  // which folds a shared name into its value.
  const SPLIT_NOT_ONE = new Set(['poly', 'rational', 'zp', 'custom', 'deriv']);
  const SPLIT_MOB = new Set(['mul', 'add', 'affine', 'recip', 'mobius']);
  // a real number as short exact text: its shortest round-trip decimal with at most 6 significant digits, or p/q
  // (|p| ≤ 9999, 2 ≤ q ≤ 64) bit for bit; null otherwise
  function shortReal(x) {
    if (!Number.isFinite(x)) return null;
    if (x === 0) return '0';
    const ax = Math.abs(x), sg = x < 0 ? '-' : '', s = String(ax);
    if (!/e/i.test(s) && s.replace('.', '').replace(/^0+/, '').length <= 6) return sg + s;
    for (let q = 2; q <= 64; q++) { const p = Math.round(ax * q); if (p >= 1 && p <= 9999 && p / q === ax) return `${sg}\\frac{${p}}{${q}}`; }
    return null;
  }
  // a complex number as short exact text (x+y i), or null
  function shortCx(v) {
    if (!v || !CX.isFin(v)) return null;
    const re = shortReal(v.re), im = shortReal(Math.abs(v.im));
    if (re === null || im === null) return null;
    if (v.im === 0) return re;
    const ip = im === '1' ? 'i' : `${im}i`;
    if (v.re === 0) return (v.im < 0 ? '-' : '') + ip;
    return `${re}${v.im < 0 ? '-' : '+'}${ip}`;
  }
  // the shared numbers a tree uses
  function splitNames(n, out = new Set()) {
    if (n && typeof n === 'object') {
      if (n.t === 'num' && n.param != null) out.add(n.param);
      for (const k of ['a', 'b', 'n']) if (n[k]) splitNames(n[k], out);
    }
    return out;
  }
  function splitSubst(ast, by) {
    if (!ast || typeof ast !== 'object') return ast;
    if (ast.t === 'var' && ast.n === 'z') return by;
    const o = Object.assign({}, ast);
    for (const k of ['a', 'b', 'n']) if (o[k]) o[k] = splitSubst(o[k], by);
    return o;
  }
  // rule 1: a light symbolic affine reader over the piece as typed (u = a z + b, a quotient of two of them); it folds
  // two typed numbers only into a short exact number, and keeps names, i, π and e as written
  const sNum = (n) => n.t === 'num' && n.param == null;
  const sPlain = (n) => sNum(n) && n.name == null;
  const sIs = (n, re, im = 0) => sNum(n) && n.v.re === re && n.v.im === im;
  const sInt = (n) => sPlain(n) && n.v.im === 0 && Number.isInteger(n.v.re) && n.v.re > 0;
  const sLit = (v) => { const t = shortCx(v); if (t === null) return null; try { return Expr.parse(t); } catch (e) { return null; } };
  const sFold = (x, y, op) => (sPlain(x) && sPlain(y) ? sLit(op(x.v, y.v)) : null);
  const sOne = () => ({ t: 'num', v: C(1, 0), lit: '1' }), sZero = () => ({ t: 'num', v: C(0, 0), lit: '0' });
  const SK = {
    neg: (x) => (sPlain(x) && sLit(CX.neg(x.v))) || (x.t === 'neg' ? x.a : { t: 'neg', a: x }),
    add: (x, y) => (sIs(x, 0) ? y : sIs(y, 0) ? x : sFold(x, y, CX.add) || (y.t === 'neg' ? { t: 'sub', a: x, b: y.a } : { t: 'add', a: x, b: y })),
    mul: (x, y) => (sIs(x, 0) || sIs(y, 0) ? sZero() : sIs(x, 1) ? y : sIs(y, 1) ? x : sFold(x, y, CX.mul) || { t: 'mul', a: x, b: y }),
    div: (x, y) => (sIs(y, 1) || sIs(x, 0) ? x : sInt(x) && sInt(y) ? { t: 'div', a: x, b: y } : sFold(x, y, CX.div) || { t: 'div', a: x, b: y }),
  };
  function sAff(n) {
    if (n.t === 'var' && n.n === 'z') return { a: sOne(), b: sZero() };
    if (!Expr.depends(n)) return { a: sZero(), b: n };
    const r = (k) => sAff(n[k]);
    switch (n.t) {
      case 'neg': { const x = r('a'); return x && { a: SK.neg(x.a), b: SK.neg(x.b) }; }
      case 'add': { const x = r('a'), y = r('b'); return x && y && { a: SK.add(x.a, y.a), b: SK.add(x.b, y.b) }; }
      case 'sub': { const x = r('a'), y = r('b'); return x && y && { a: SK.add(x.a, SK.neg(y.a)), b: SK.add(x.b, SK.neg(y.b)) }; }
      case 'mul': {
        if (!Expr.depends(n.a)) { const y = r('b'); return y && { a: SK.mul(n.a, y.a), b: SK.mul(n.a, y.b) }; }
        if (!Expr.depends(n.b)) { const x = r('a'); return x && { a: SK.mul(n.b, x.a), b: SK.mul(n.b, x.b) }; }
        return null;
      }
      case 'div': { if (Expr.depends(n.b)) return null; const x = r('a'); return x && { a: SK.div(x.a, n.b), b: SK.div(x.b, n.b) }; }
    }
    return null;
  }
  function sQuot(n) {
    let neg = false;
    while (n.t === 'neg') { neg = !neg; n = n.a; }
    if (n.t !== 'div') return null;
    const P = sAff(neg ? { t: 'neg', a: n.a } : n.a), Q = sAff(n.b);
    return P && Q ? { a: P.a, b: P.b, c: Q.a, d: Q.b } : null;
  }
  const sTex = (n) => Expr.toTex(n).s;
  function splitRule1(s, src, cut) {
    switch (s.type) {
      case 'mul': { const r = sAff(src); return r && { c: sTex(r.a) }; }
      case 'add': { const r = sAff(src); return r && { c: sTex(r.b) }; }
      case 'affine': { const r = sAff(src); return r && { a: sTex(r.a), b: sTex(r.b) }; }
      case 'mobius': { const q = sQuot(src); return q && { a: sTex(q.a), b: sTex(q.b), c: sTex(q.c), d: sTex(q.d) }; }
      case 'powa':
        if (src.t === 'pow') return { alpha: sTex(src.b), cut, k: 0 };
        if (src.t === 'root') return { alpha: `\\frac{1}{${sTex(src.n)}}`, cut, k: 0 };
        return null;
    }
    return null;
  }
  // a Möbius map whose entries are not short: the smallest multiple (m ≤ 64) with Gaussian integer entries
  function mobInts(v) {
    const e = [v.a, v.b, v.c, v.d];
    for (let m = 2; m <= 64; m++) {
      const w = e.map((x) => C(x.re * m, x.im * m));
      if (!w.every((x) => Number.isInteger(x.re) && Number.isInteger(x.im))) continue;
      const t = w.map(shortCx);
      if (t.every((x) => x !== null)) return { a: t[0], b: t[1], c: t[2], d: t[3] };
    }
    return null;
  }
  // rule 2: the reading's values as short exact numbers (only for a piece without shared numbers)
  function splitRule2(s, cut) {
    const v = s.vals || {}, p = {};
    const one = (k) => { const t = shortCx(v[k]); if (t === null) throw new Error('long'); p[k] = t; };
    const list = (arr) => arr.map((x) => { const t = shortCx(x); if (t === null) throw new Error('long'); return t; }).join(', ');
    try {
      switch (s.type) {
        case 'custom': return { expr: Expr.toTex(v.ast).s, cut };
        case 'mul': case 'add': one('c'); break;
        case 'affine': one('a'); one('b'); break;
        case 'mobius': try { for (const k of 'abcd') one(k); } catch (e) { const m = mobInts(v); if (!m) throw e; Object.assign(p, m); } break;
        case 'pown': p.n = v.n; break;
        case 'root': p.n = v.n; p.cut = cut; p.k = 0; break;
        case 'powa': one('alpha'); p.cut = cut; p.k = 0; break;
        case 'log': p.cut = cut; p.k = 0; break;
        case 'poly': p.co = list(v.co); break;
        case 'rational': p.p = list(v.p); p.q = list(v.q); break;
        case 'zp': one('a'); p.zeros = list(v.zeros); p.poles = list(v.poles); break;
      }
    } catch (e) { return null; }
    return p;
  }
  // values for the shared numbers at which the gate checks a written step (generic: no special value)
  const SPLIT_GEN = [[0.7390851332151607, 1.324717957244746, 0.5671432904097838, 1.465571231876768],
    [1.2207440846057596, 0.8017118471377938, 1.6180339887498949, 0.4501836112948736]];
  function splitVals(n, map) {
    if (!n || typeof n !== 'object') return n;
    if (n.t === 'num' && n.param != null && map.has(n.param)) return Object.assign({}, n, { v: map.get(n.param) });
    const o = Object.assign({}, n);
    for (const k of ['a', 'b', 'n']) if (o[k]) o[k] = splitVals(o[k], map);
    return o;
  }
  // a written step built from its text: at the current values exactly as the app builds it (map null), or with its
  // shared numbers at the values of map
  function splitBuild(step, map, th) {
    if (!map) return build(step);
    if (step.type === 'custom') { try { return { f: Expr.compile(splitVals(Expr.parse(step.params.expr), map), { theta: th }) }; } catch (e) { return { error: e.message }; } }
    const d = DEFS[step.type], vals = {};
    try {
      for (const q of d.params) {
        const raw = step.params[q.key];
        if (raw === undefined) continue;
        if (q.type === 'cx') vals[q.key] = Expr.compile(splitVals(Expr.parse(String(raw)), map))(C(0, 0));
        else if (q.type === 'int' || q.type === 'angle') vals[q.key] = Number(raw);
        else return build(step);
      }
    } catch (e) { return { error: e.message }; }
    return buildVals(step.type, vals);
  }
  const textNames = (t) => { try { return splitNames(Expr.parse(String(t))); } catch (e) { return null; } };
  // the gate: the written steps, built from their texts, are the formula's piece (1e-12 at the probes, at the current
  // values or at two generic sets of the shared numbers), with the same names, and every decimal they add is short
  function splitGate(cand, src, cut, maps, typed) {
    const th = cut * DEG;
    const want = [...splitNames(src)].sort().join(','), got = new Set();
    for (const s of cand) {
      const d = DEFS[s.type];
      if (!d) return false;
      for (const q of d.params) {
        const t = s.params[q.key];
        if (typeof t !== 'string' || !(q.type === 'cx' || q.type === 'expr')) continue;
        const nm = textNames(t);
        if (!nm) return false;
        for (const x of nm) got.add(x);
        for (const m of t.match(/\d*\.?\d+/g) || []) if (m.replace('.', '').replace(/^0+/, '').length > 6 && !typed.includes(m)) return false;
      }
    }
    if ([...got].sort().join(',') !== want) return false;
    for (const map of maps) {
      let piece;
      try { piece = Expr.compile(map ? splitVals(src, map) : src, { theta: th }); } catch (e) { return false; }
      const bs = cand.map((s) => splitBuild(s, map, th));
      if (bs.some((x) => !x || x.error || typeof x.f !== 'function')) return false;
      if (!recProbe(piece, (z) => { for (const x of bs) z = x.f(z); return z; }, 1e-12)) return false;
    }
    return true;
  }
  // the name of a step in the derivation and the toast: the recognizer's (Scaling, Translation, Square root)
  function splitLabel(s) {
    if (s.kept || s.type === 'custom') return DEFS.custom.label;
    // (a shared number in c: at its current value, as the recognizer's note reads it)
    if (s.type === 'mul') { let v = null; try { v = Expr.constValue(String(s.params.c)); } catch (e) { v = null; } return mulLabel(v); }
    if (s.type === 'add') return $t('Translation');
    if (s.type === 'root') return Math.round(Number(s.params.n)) === 2 ? $t('Square root') : $t('Root');
    return DEFS[s.type] ? DEFS[s.type].label : s.type;
  }
  // a step's TeX applied to arg, its shared numbers printed as names (the Inspector's rule: z − a, never z − 0.7): each
  // field that holds names is built with a sentinel number, which the TeX then gets back as that field's own TeX
  const SPLIT_SENT = [7919, 7927, 7933, 7937, 7949, 7951, 7963, 7993, 8009, 8011, 8017, 8039];
  function splitStepTex(s, arg) {
    if (s.type === 'custom') { try { return Expr.toTex(Expr.parse(s.params.expr), arg); } catch (e) { return null; } }
    // (first every field written with a name, a fraction or a constant as written; then only the names; then values)
    return splitStepTex1(s, arg, 2) || splitStepTex1(s, arg, 1) || splitStepTex1(s, arg, 0);
  }
  function splitStepTex1(s, arg, how) {
    const d = DEFS[s.type], p2 = Object.assign({}, s.params), subs = [];
    for (const q of d.params) {
      const t = p2[q.key];
      if (!how || q.type !== 'cx' || typeof t !== 'string') continue;
      const nm = textNames(t);
      // (how 2: a name, a fraction, a constant, or a decimal longer than the catalog's 4 digits, as written)
      if (!nm || !(nm.size || (how === 2 && (/\\/.test(t) || /\d*\.\d{4,}|\d{5,}/.test(t)))) || subs.length >= SPLIT_SENT.length) continue;
      const neg = /^\s*-/.test(t), body = neg ? t.replace(/^\s*-/, '') : t, n = SPLIT_SENT[subs.length];
      let tx;
      try { tx = Expr.toTex(Expr.parse(body)).s; } catch (e) { return null; }
      subs.push([n, Expr.compoundTex(tx) && q.key !== 'alpha' ? `\\left(${tx}\\right)` : tx]);
      p2[q.key] = String(neg ? -n : n);
    }
    const b = build({ type: s.type, params: p2, on: true });
    if (!b || b.error) return null;
    const r = b.tex(arg);
    let out = r.s;
    for (const [n, tx] of subs) {
      const re = new RegExp(`(?<![\\d.])${n}(?![\\d.])`, 'g');
      if (!re.test(out)) return null;
      out = out.replace(re, `{${tx}}`);
    }
    return { s: out, p: r.p, bare: r.bare };
  }
  // the derivation z ↦ … ↦ F: row 0 is z (v: the step's input variable, w₆ for f₇: review steps-9), row k is step k
  // applied to row k−1; eq is the typed formula when the last row spells it differently (2\cos z = e^{iz}+e^{-iz}). A
  // mere reordering of sums and products (e^{−z}+1 for 1+e^{−z}, −z²+1 for 1−z²) is no news: the last row is then the
  // typed spelling, with no "=" (review steps-8)
  function splitRowsOf(steps, names, typedTex, v = 'z') {
    let arg = { s: v, p: 4 };
    const rows = [{ tex: v, name: '' }];
    for (let i = 0; i < steps.length; i++) {
      arg = splitStepTex(steps[i], arg);
      if (!arg) return { rows: null, eq: null };
      rows.push({ tex: arg.s, name: names[i] });
    }
    if (!typedTex) return { rows, eq: null };
    let ta = null;
    try { ta = Expr.parse(String(typedTex)); } catch (e) { ta = null; }
    const typedV = ta && v !== 'z' ? Expr.toTex(ta, { s: v, p: 4 }).s : typedTex;
    const nrm = (t) => String(t).replace(/\\left|\\right|\\,|\\cdot|\s|[{}]/g, '');
    if (nrm(arg.s) === nrm(typedV)) return { rows, eq: null };
    // (the same up to the order of terms and factors: compared in z, where both parse)
    let same = false;
    if (ta) { try { const z = v === 'z' ? arg.s : splitRowsOf(steps, names, null).rows.slice(-1)[0].tex; same = splitCanon(Expr.parse(z)) === splitCanon(ta); } catch (e) { same = false; } }
    if (same) { rows[rows.length - 1] = { tex: typedV, name: names[names.length - 1] }; return { rows, eq: null }; }
    return { rows, eq: typedV };
  }
  // an expression with its sums and products in a fixed order (the terms' and factors' own signatures, sorted)
  function splitCanon(n) {
    if (!n || typeof n !== 'object') return '';
    if (n.t === 'num') return `#${n.v.re},${n.v.im}`;
    if (n.t === 'var') return `v:${n.n}`;
    if (n.t === 'add' || n.t === 'sub') {
      const ts = [];
      (function terms(m, sg) { if (m.t === 'add') { terms(m.a, sg); terms(m.b, sg); } else if (m.t === 'sub') { terms(m.a, sg); terms(m.b, -sg); } else if (m.t === 'neg') terms(m.a, -sg); else ts.push((sg < 0 ? '-' : '+') + splitCanon(m)); })(n, 1);
      return `(${ts.sort().join('')})`;
    }
    if (n.t === 'mul') { const fs = []; (function facs(m) { if (m.t === 'mul') { facs(m.a); facs(m.b); } else fs.push(splitCanon(m)); })(n); return `[${fs.sort().join('*')}]`; }
    return `${n.t}:${n.f || ''}:${n.op || ''}{${splitCanon(n.a)}|${splitCanon(n.b)}|${splitCanon(n.n)}}`;
  }
  // the derivation one step a row, each step applied to the previous row's name (u₁ = z², u₂ = u₁ + 1, w₁ = sin u₂): the
  // Inspector's form for a chain whose cumulative rows do not fit (review steps-3). v: the input, out: the output's name
  function splitSubRows(sp, v, out) {
    if (!sp || !sp.steps || !sp.steps.length) return null;
    const n = sp.steps.length, rows = [];
    for (let i = 0; i < n; i++) {
      const lhs = i === n - 1 ? out || 'w' : `u_{${i + 1}}`, a = splitStepTex(sp.steps[i], { s: i ? `u_{${i}}` : v || 'z', p: 4 });
      if (!a) return null;
      rows.push({ tex: `${lhs}=${a.s}`, name: sp.names[i] });
    }
    return rows;
  }
  // the simple moves a Möbius step is made of, read only (DESIGN.md 8, "Split into simple moves", is not built): z ↦
  // z + d/c ↦ 1/(z + d/c) ↦ k/(z + d/c) ↦ k/(z + d/c) + a/c with k = −(ad − bc)/c²; for c = 0, z ↦ (a/d) z ↦ (a/d) z + b/d.
  // Moves that do nothing are left out. null when a number has no short exact form or the map is degenerate
  // (review steps-5: a fraction showed no transforms at all)
  function splitMoves(st, v = 'z') {
    if (!st || st.type !== 'mobius') return null;
    let m;
    try { m = ['a', 'b', 'c', 'd'].map((k) => Expr.constValue(String(st.params[k]))); } catch (e) { return null; }
    if (!m.every((x) => x && CX.isFin(x))) return null;
    const [a, b, c, d] = m, det = CX.sub(CX.mul(a, d), CX.mul(b, c));
    if (CX.isZero(det)) return null;
    const steps = [], one = (x) => x.re === 1 && x.im === 0;
    const push = (type, x) => {
      if (x === undefined) { steps.push({ type, params: {} }); return true; }
      const t = shortCx(x);
      if (t == null) return false;
      steps.push({ type, params: { c: t } });
      return true;
    };
    let ok = true;
    if (CX.isZero(c)) {
      const k = CX.div(a, d), t = CX.div(b, d);
      if (!one(k)) ok = push('mul', k) && ok;
      if (!CX.isZero(t)) ok = push('add', t) && ok;
    } else {
      const t1 = CX.div(d, c), k = CX.neg(CX.div(det, CX.mul(c, c))), t2 = CX.div(a, c);
      if (!CX.isZero(t1)) ok = push('add', t1) && ok;
      push('recip');
      if (!one(k)) ok = push('mul', k) && ok;
      if (!CX.isZero(t2)) ok = push('add', t2) && ok;
    }
    if (!ok || steps.length < 2) return null;
    const rows = splitRowsOf(steps, steps.map(splitLabel), null, v).rows;
    // (k\,\frac{1}{u} is written \frac{k}{u}, the sign in front: 3/(z−1), −2/(z+1))
    if (rows) {
      for (const r of rows) {
        const mm = /^(-?)([0-9.]*i?)\\,\\frac\{1\}\{/.exec(r.tex);
        if (!mm || !mm[2]) continue;
        let i = mm[0].length, dep = 1;
        for (; i < r.tex.length && dep; i++) dep += r.tex[i] === '{' ? 1 : r.tex[i] === '}' ? -1 : 0;
        if (dep) continue;
        r.tex = `${mm[1]}\\frac{${mm[2]}}{${r.tex.slice(mm[0].length, i - 1)}}${r.tex.slice(i)}`;
      }
    }
    return rows;
  }
  // the rows in another input variable (the Inspector's w_{k−1}), cached on the result
  function splitRowsVar(sp, v) {
    if (!sp || !sp.rows || !v || v === 'z') return sp ? { rows: sp.rows, eq: sp.eq } : null;
    const c = sp.rowsBy || (sp.rowsBy = new Map());
    if (!c.has(v)) c.set(v, splitRowsOf(sp.steps, sp.names, sp.typed, v));
    return c.get(v);
  }
  const SPLIT_CACHE = new Map();
  const splitCached = (k, make) => {
    if (SPLIT_CACHE.has(k)) { const v = SPLIT_CACHE.get(k); SPLIT_CACHE.delete(k); SPLIT_CACHE.set(k, v); return v; }
    const v = make();
    SPLIT_CACHE.set(k, v);
    if (SPLIT_CACHE.size > REC_CACHE_MAX) SPLIT_CACHE.delete(SPLIT_CACHE.keys().next().value);
    return v;
  };
  const splitNone = (reason, extra) => Object.assign({ kind: 'none', reason, steps: [], names: [], rows: null, eq: null }, extra || {});
  // the reading and the written steps (cached: a formula with shared numbers is read and written at generic values)
  function splitMake(ast, cut, expr, b) {
    let steps, groups;
    const pn = [...splitNames(ast)].sort();
    if (b) {
      if (!b.rec || !b.rec.groups || b.rec.groups.some((g) => !g.src)) return splitNone('R1');
      steps = b.rec.steps; groups = b.rec.groups;
    } else {
      const read = (set) => { try { return Recognize.chain(Recognize.generic(ast, set), cut, { tape: { mode: 'rec' } }); } catch (e) { return null; } };
      const r0 = read(0), r1 = read(1);
      if (!r0 || !r1 || JSON.stringify(r0.tape) !== JSON.stringify(r1.tape)) return splitNone('R1');
      steps = r0.steps; groups = r0.groups;
    }
    // (one container step: not a chain; with a shared number in it, its coefficients depend on that number)
    if (steps.length === 1 && SPLIT_NOT_ONE.has(steps[0].type)) return pn.length ? splitNone('R2', { pnames: pn }) : splitNone('R1');
    const maps = pn.length ? [0, 1].map((set) => new Map(pn.map((nm, i) => [nm, C(SPLIT_GEN[set][i % 4] + 0.013 * Math.floor(i / 4), 0)]))) : [null];
    const out = [];
    let nameBlock = false;
    for (const g of groups) {
      const gs = steps.slice(g.from, g.to), named = splitNames(g.src).size > 0;
      const tries = [];
      if (gs.length === 1) { const p1 = splitRule1(gs[0], g.src, cut); if (p1) tries.push([{ type: gs[0].type, params: p1 }]); }
      if (!named) { const p2 = gs.map((s) => splitRule2(s, cut)); if (p2.every(Boolean)) tries.push(gs.map((s, i) => ({ type: s.type, params: p2[i] }))); }
      const ok = tries.find((cand) => splitGate(cand, g.src, cut, maps, expr));
      if (ok) { for (const s of ok) out.push({ type: s.type, params: s.params, kept: s.type === 'custom', src: s.type === 'custom' ? null : undefined }); continue; }
      if (named) nameBlock = true;
      // rule 3: the group stays a formula part (joined with a formula part before it)
      const prev = out[out.length - 1];
      if (prev && prev.kept && prev.src) { prev.src = splitSubst(g.src, prev.src); prev.params = { expr: Expr.toTex(prev.src).s, cut }; }
      else out.push({ type: 'custom', params: { expr: Expr.toTex(g.src).s, cut }, kept: true, src: g.src });
    }
    // every formula part is the formula's own piece again (its TeX read back)
    for (const s of out) if (s.kept && s.src && !splitGate([{ type: 'custom', params: s.params }], s.src, cut, maps, expr)) return splitNone('R3');
    for (const s of out) delete s.src;
    const nk = out.filter((s) => !s.kept);
    const why = nameBlock ? 'R2' : 'R3';
    if (!nk.length || (nk.length < out.length && nk.every((s) => SPLIT_MOB.has(s.type)))) return splitNone(why, { pnames: pn });
    if (out.length === 1 && SPLIT_NOT_ONE.has(out[0].type)) return splitNone('R1');
    const names = out.map(splitLabel), typed = Expr.toTex(ast).s;
    const { rows, eq } = splitRowsOf(out, names, typed);
    return { kind: out.length === 1 ? 'one' : 'many', steps: out, names, rows, eq, reason: null, pnames: pn, typed };
  }
  function splitSteps(st, bIn) {
    if (!st || st.type !== 'custom') return splitNone('R1');
    const expr = String(st.params && st.params.expr != null ? st.params.expr : DEFS.custom.params[0].def);
    const cut = Number(st.params && st.params.cut != null ? st.params.cut : 180);
    const b = bIn || build(st);
    if (!b || b.error || !b.ast || !Number.isFinite(cut)) return splitNone('R4');
    const ast = b.ast, hasP = Recognize.hasParam(ast);
    // (an unexpected failure of the reader or the gate is no offer, never an error in the search or the Inspector)
    const res = splitCached(Recognize.key(ast, cut) + '\u0001' + expr, () => { try { return splitMake(ast, cut, expr, hasP ? null : b); } catch (e) { return splitNone('R1'); } });
    if (!hasP || res.kind === 'none') return res;
    // shared numbers: the structure was decided at generic values; at the current ones the formula may change kind
    // (\frac{az+1}{z+a} at a = 1): the offer stays, its button is disabled (R5), so nothing flickers while a slider moves
    const vk = JSON.stringify(Expr.toTex(ast).s) + JSON.stringify(res.pnames.map((nm) => { let v = null; (function walk(n) { if (!n || typeof n !== 'object' || v) return; if (n.t === 'num' && n.param === nm) { v = n.v; return; } walk(n.a); walk(n.b); walk(n.n); })(ast); return v; }));
    if (!res.hold || res.hold.k !== vk) {
      let ok = !!b.rec;
      if (ok) {
        try {
          const bs = res.steps.map((s) => build(s));
          ok = bs.every((x) => x && !x.error) && recProbe(b.f, (z) => { for (const x of bs) z = x.f(z); return z; }, 1e-9);
        } catch (e) { ok = false; }
      }
      res.hold = { k: vk, ok };
    }
    return res.hold.ok ? res : Object.assign({}, res, { blocked: true, reason: 'R5' });
  }
  // the deformation's time after a split (DESIGN.md 7.4): the formula, step j (0-based) of the chain played one step after
  // another, becomes n steps, so its unit [j, j+1) becomes [j, j+n) and the frame stays the same
  function splitMorphT(T, j, n) {
    if (!(T >= j)) return T;
    if (T < j + 1) return j + (T - j) * n;
    return T + n - 1;
  }
  // the reason a formula is not offered as steps, in words (R1–R5)
  function splitReason(sp) {
    switch (sp && sp.reason) {
      case 'R2': return $t('Its numbers depend on {names}', { names: (sp.pnames || []).join(', ') });
      case 'R3': return $t('Its numbers have no short exact form');
      case 'R4': return $t('This step has an error');
      case 'R5': return $t('Not at these values of the numbers');
      default: return $t('Not a chain of catalog steps');
    }
  }
  return { shortCx, splitLabel, splitMorphT, splitMoves, splitNames, splitReason, splitRowsVar, splitStepTex, splitSteps, splitSubRows };
};
import { CX } from './cx.js';
import { Expr } from './parse.js';
import { Recognize } from './recognize.js';
export { FormulaSteps };
