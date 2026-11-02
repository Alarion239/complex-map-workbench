// @ts-check
'use strict';
// Catalog of chainable functions: evaluation, LaTeX, guaranteed properties, branch cuts, homotopies.
const Funcs = (() => {
  const { C } = CX;
  const DEG = Math.PI / 180;
  const paren = Expr.paren;
  const PI = Math.PI;

  const PROP_KEYS = ['analytic', 'entire', 'rational', 'polynomial', 'mobius', 'proper', 'injective'];
  const props = (o = {}) => Object.assign({
    analytic: false, entire: false, rational: false, polynomial: false, mobius: false, proper: false, injective: false,
    deg: null, degExact: false, constant: false,
  }, o);
  const ALL = { analytic: true, entire: true, rational: true, polynomial: true, mobius: true, proper: true, injective: true, deg: 1, degExact: true };
  const CONSTANT = props({ analytic: true, entire: true, rational: true, polynomial: true, deg: 0, degExact: true, constant: true });

  const atom = (a) => (a.p >= 4 ? a.s : paren(a.s));
  // bare: a function applied without parentheses (\sin z), see Expr.toTex
  const fn = (name, a) => (a.p >= 4 && a.s.length <= 4 ? { s: `${name} ${a.s}`, p: 3, bare: true } : { s: `${name}${paren(a.s)}`, p: 3 });
  const powTex = (a, e) => ({ s: `${a.p >= 4 && !a.s.startsWith('\\frac') ? a.s : paren(a.s)}^{${e}}`, p: 3 });
  const compoundTex = Expr.compoundTex;
  // ---- shared numbers kept as names (issue #11) ----
  // A field that uses a shared number (c = a, α = 2a + 1, a zero at -a) keeps its TeX next to its value: build() gives
  // the value (a complex number, or each item of a list) a hidden .ptex = {s, p} (Expr.toTex of the field as typed,
  // which prints a name as its name), and the TeX helpers below print it instead of the number. A named value is never
  // simplified by its current value (a coefficient 1 dropped, a term 0 left out, a sign folded): F's formula stays the
  // same while a slider moves, and only the picture follows the value. Values without names render as before.
  const ptexOf = (c) => (c && c.ptex) || null;
  // the field's TeX when it holds names, else the value's
  const valTex = (c) => { const t = ptexOf(c); return t ? t.s : CX.tex(c); };
  // exactly 0 by value, and written without names (a name is never dropped)
  const zeroV = (c) => !ptexOf(c) && CX.isZero(c);
  function keepName(raw, v) {
    if (!v || typeof v !== 'object') return v;
    let ast;
    try { ast = Expr.parse(String(raw ?? '')); } catch (e) { return v; }
    if (!splitNames(ast).size) return v;
    const w = C(v.re, v.im);
    Object.defineProperty(w, 'ptex', { value: Expr.toTex(ast), enumerable: false });
    return w;
  }
  const keepNames = (raw, vs) => { const items = splitList(raw); return items.length === vs.length ? vs.map((v, i) => keepName(items[i], v)) : vs; };
  // x − c: a named c as written, in brackets only when it needs them (z − a, z + a for c = −a, z − (a + 1))
  function subTex(x, c) {
    const t = ptexOf(c);
    if (t.p === 2 && t.s.startsWith('-')) return { s: `${x.s}+${t.s.slice(1)}`, p: 0 };
    return { s: `${x.s}-${t.p <= 0 ? paren(t.s) : t.s}`, p: 0 };
  }
  function coefTex(c) {
    const t = ptexOf(c);
    if (t) return t.p <= 0 ? paren(t.s) : t.s;
    const s = CX.tex(c);
    return compoundTex(s) ? paren(s) : s;
  }
  function mulTex(c, a) {
    const t = ptexOf(c);
    if (!t && CX.eq(c, C(1, 0), 1e-12)) return a;
    if (!t && CX.eq(c, C(-1, 0), 1e-12)) return { s: '-' + (a.p <= 1 ? paren(a.s) : a.s), p: 2, bare: a.bare && a.p > 1 };
    const cs = coefTex(c);
    const as = a.p <= 2 ? paren(a.s) : a.s;
    // (a named coefficient that ends in a bare function, \sin a, is continued with \cdot, as Expr.toTex does)
    const dot = /^[0-9.]/.test(as) || (t && t.bare && t.p >= 1);
    return { s: `${cs}${dot ? '\\cdot ' : '\\,'}${as}`, p: cs.startsWith('-') ? 2 : 1, bare: a.bare && a.p > 2 };
  }
  function addTex(a, c) {
    const t = ptexOf(c);
    if (t) {
      if (t.p === 2 && t.s.startsWith('-')) return { s: `${a.s}${t.s}`, p: 0 };
      return { s: `${a.s}+${t.p <= 0 ? paren(t.s) : t.s}`, p: 0 };
    }
    if (CX.isZero(c)) return a;
    const s = CX.tex(c);
    const compound = compoundTex(s);
    if (!compound && s.startsWith('-')) return { s: `${a.s}${s}`, p: 0 };
    return { s: `${a.s}+${compound ? paren(s) : s}`, p: 0 };
  }
  // parameter text for an inverse: parses back to exactly c (never 1.0000e-5 rounded to 5 digits)
  const fmtC = (c) => CX.fmtExact(c);
  // angles in plain-text notes: one decimal at most, U+2212 minus
  const fmtDeg = (x) => I18N.num(String(+x.toFixed(1)).replace('-', '−'));
  // a half-open interval of angles, (a°, b°]; in Russian and Italian a semicolon when an end has a decimal comma
  // (GLOSSARY 2.3)
  const degIv = (a, b) => { const x = fmtDeg(a), y = fmtDeg(b); return `(${x}°${I18N.comma() && /,/.test(x + y) ? '; ' : ', '}${y}°]`; };

  // (issue #20) the homotopies, natural paths and derivatives live in src/natpaths.js and src/derivs.js
  const { XN, texOf, taylorAt, polyMul, ratOf, derivAst, derivativeStep } = Derivs;
  const { mobHom, mobHomTex, linHom, powHom, expHom, expHomTex, logHom, logHomTex, joukHom, ijoukHom, joukTex, vTex, expoTex, branchOr, ends, ZOOM, ZOOM_TEX, natData, genericZoomNat, customNat, polyNat, ratPath, ratZoomAt, ratZoomData, rationalNat, monomialOf, zerosPolesNat } = NatPaths;

  // ---- parameter helpers ----
  const cutParams = [
    { key: 'cut', label: $t('cut angle'), type: 'angle', def: 180 },
    { key: 'k', label: $t('sheet'), type: 'int', def: 0 },
  ];
  // a list field's items, read by one rule in both languages, so saved work survives a language switch (review
  // math-1, verify-1; GLOSSARY 2.3: lists of decimals take «;»): with a ';' outside brackets the items are split on
  // ';' and a comma between two digits is a decimal comma (0,5; -1 is 0.5 and -1); without one, on commas as before.
  // Only text typed into the field in a decimal-comma interface (Russian, Italian) is checked further (typedList): there
  // a comma between two digits with no ';' (0,5, -1) is refused with the hint, never read silently as two items.
  const RU_LIST = () => typeof I18N !== 'undefined' && !!I18N.comma && I18N.comma();
  // the list texts with a comma between two digits and no ';' that the user typed into a step's field in Russian
  // (step -> {key: Set of texts}); a saved or switched text is not in it, so it is read by the common rule. An undo
  // carries a step's set to the step restored at its place (typedKeep), so a refused text never comes back unchecked
  const typedLists = new WeakMap();
  const refusable = (s) => splitAt(s, ';').length < 2 && /\d,\d/.test(s);
  function typedList(step, key, text) {
    const s = String(text ?? '');
    if (!RU_LIST() || !step || typeof step !== 'object' || !refusable(s)) return;
    const m = typedLists.get(step) || {};
    (m[key] = m[key] || new Set()).add(s);
    typedLists.set(step, m);
  }
  function typedKeep(from, to) {
    if (!RU_LIST() || !Array.isArray(from) || !Array.isArray(to)) return;
    from.forEach((a, i) => { const m = a && typedLists.get(a), b = to[i]; if (m && b && typeof b === 'object' && b.type === a.type) typedLists.set(b, m); });
  }
  const typedHere = (step, key, raw) => RU_LIST() && !!step && !!((typedLists.get(step) || {})[key] || { has: () => false }).has(String(raw ?? ''));
  function splitAt(str, sep) {
    const parts = [];
    let depth = 0, cur = '';
    for (const ch of String(str ?? '')) {
      if ('([{'.includes(ch)) depth++;
      if (')]}'.includes(ch)) depth--;
      if (ch === sep && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;
    }
    parts.push(cur);
    return parts;
  }
  function listParts(str) {
    const semi = splitAt(str, ';');
    return semi.length > 1 ? semi.map((s) => s.replace(/(\d),(?=\d)/g, '$1.')) : splitAt(str, ',');
  }
  function listComma(str, typed) {
    if (typed && refusable(String(str ?? ''))) throw new Error($t('Use a decimal point: 0.5; separate the values with a comma and a space, or with ;'));
  }
  function parseCoeffs(str, typed) {
    // split on commas outside brackets (or on ';': listParts)
    listComma(str, typed);
    const parts = listParts(str);
    const trimmed = parts.map((s) => s.trim());
    if (trimmed.length > 1 && trimmed.some((s) => !s.length)) throw new Error($t('A coefficient is missing between two commas'));
    const co = trimmed.filter((s) => s.length).map((s) => Expr.constValue(s));
    if (!co.length) throw new Error($t('Enter at least one coefficient'));
    return co;
  }
  // ---- zeros and poles (the 'zp' step) ----
  // a list of complex values as typed (commas outside brackets; empty items dropped): the raw item strings
  function splitList(str) {
    return listParts(str).map((s) => s.trim()).filter((s) => s.length);
  }
  // at most 24 zeros and 24 poles (degree 24, as Write by zeros and poles allows; past it a drag misses 60 fps)
  const ZP_MAX = 24;
  function parseCxList(str, typed) {
    listComma(str, typed);
    return splitList(str).map((s, i) => {
      let v;
      try { v = Expr.constValue(s); } catch (e) { throw new Error($t('value {i}: {msg}', { i: i + 1, msg: e.message })); }
      if (!CX.isFin(v)) throw new Error($t('value {i} is not a finite number', { i: i + 1 }));
      return v;
    });
  }
  // a value as a list item: the exact shortest decimal, no spaces (parses back to exactly v)
  const zpItem = (v) => CX.fmtExact(C(v.re === 0 ? 0 : v.re, v.im === 0 ? 0 : v.im)).replace(/\s+/g, '');
  // a zero and a pole at exactly the same point cancel (a removable singularity, filled in): what is left
  // (written: only a zero and a pole written alike, the same value without names or the same names)
  const sameTex = (p, q) => (ptexOf(p) ? ptexOf(p).s : '') === (ptexOf(q) ? ptexOf(q).s : '');
  function zpCancel(zeros, poles, written) {
    const zs = zeros.slice(), ps = [], gone = [];
    for (const p of poles) {
      const i = zs.findIndex((z) => z.re === p.re && z.im === p.im && (!written || sameTex(z, p)));
      if (i >= 0) { gone.push(zs.splice(i, 1)[0]); } else ps.push(p);
    }
    return { zs, ps, gone };
  }
  // a ∏ (z − r) expanded (coefficients, highest degree first)
  const zpExpand = (a, rs) => rs.reduce((co, r) => polyMul(co, [C(1, 0), CX.neg(r)]), [a]);
  // the factored TeX: a ∏ (x − ζ_k)^{m} / ∏ (x − p_j)^{m} (equal values as powers, the factor x first)
  function zpFactors(list, x) {
    const groups = [];
    for (const r of list) {
      const g = groups.find((q) => q.r.re === r.re && q.r.im === r.im && sameTex(q.r, r));
      if (g) g.m++; else groups.push({ r, m: 1 });
    }
    groups.sort((p, q) => Number(zeroV(q.r)) - Number(zeroV(p.r)));
    return groups.map(({ r, m }) => {
      if (ptexOf(r)) { const base = subTex(x, r); return m === 1 ? base : powTex(base, m); }
      // x − r term by term: z − 1 − i, z + 0.5i (never z − (1 + i))
      let t = x.s;
      for (const part of [C(-r.re, 0), C(0, -r.im)]) {
        if (CX.isZero(part)) continue;
        const ps = CX.tex(part);
        t += compoundTex(ps) ? `+${paren(ps)}` : ps.startsWith('-') ? ps : `+${ps}`;
      }
      const base = CX.isZero(r) ? x : { s: t, p: 0 };
      return m === 1 ? base : powTex(base, m);
    });
  }
  function zpProd(fs, alone) {
    if (!fs.length) return null;
    if (fs.length === 1 && alone) return fs[0];
    return { s: fs.map((f) => (f.p >= 3 ? f.s : paren(f.s))).join(''), p: 3 };
  }
  function zpTex(a, zs, ps, x) {
    if (!zs.length && !ps.length) { const t = ptexOf(a), s = valTex(a); return { s, p: t ? t.p : compoundTex(s) ? 0 : 4 }; }
    const num = zpProd(zpFactors(zs, x), true), den = zpProd(zpFactors(ps, x), true);
    const body = den ? { s: `\\frac{${num ? num.s : '1'}}{${den.s}}`, p: 4 } : num;
    return mulTex(a, body);
  }
  // Funcs.toZerosPoles(step): a polynomial or rational step (or a custom rational formula) as a 'zp' step, by the
  // roots of its numerator and denominator (computed numerically, rounded to 12 digits where that keeps the map to
  // 1e-9): {step, note} or {error}. Funcs.fromZerosPoles(step): a 'zp' step expanded into a polynomial or rational
  // step (exact coefficients of the expansion): {step} or {error}.
  function toZerosPoles(step) {
    const b = build(step);
    if (b.error) return { error: b.error };
    let P, Q;
    const v = b.vals, id = b.def.id;
    if (id === 'poly') { P = CX.polyTrim(v.co); Q = [C(1, 0)]; }
    else if (id === 'rational') { P = CX.polyTrim(v.p); Q = CX.polyTrim(v.q); }
    else if (id === 'custom') {
      let pq = null;
      try { const ast = Expr.parse(v.expr); if (Expr.classify(ast).rational) pq = ratOf(ast); } catch (e) { pq = null; }
      if (!pq) return { error: $t('Only a polynomial or a rational formula can be written by its zeros and poles') };
      [P, Q] = pq;
    } else return { error: $t('{label} is not a polynomial or a rational map', { label: b.def.label }) };
    if (P.every(CX.isZero)) return { error: $t('The zero function has no zeros or poles to drag') };
    if (P.length > ZP_MAX + 1 || Q.length > ZP_MAX + 1) return { error: $t('Degree above {max}: too many zeros and poles to drag', { max: ZP_MAX }) };
    const a = CX.div(P[0], Q[0]);
    const clean = (r) => {
      const s = 1e-12 * Math.max(1, CX.abs(r));
      return C(Math.abs(r.re) < s ? 0 : +r.re.toPrecision(12), Math.abs(r.im) < s ? 0 : +r.im.toPrecision(12));
    };
    const roots = (co) => (co.length > 1 ? CX.polyRoots(co) : []);
    const raw = [roots(P), roots(Q)];
    if (!raw.every((l) => l.every(CX.isFin))) return { error: $t('The roots could not be computed') };
    const tidy = raw.map((l) => l.map(clean));
    const ok = (zs, ps) => {
      const f = (z) => { let n = a; for (const r of zs) n = CX.mul(n, CX.sub(z, r)); let d = C(1, 0); for (const r of ps) d = CX.mul(d, CX.sub(z, r)); return CX.div(n, d); };
      return [C(0.37, -0.81), C(-1.3, 0.6), C(2.1, 1.7), C(-0.45, -2.2)].every((z) => { const g = b.f(z), h = f(z); return !CX.isFin(g) || CX.abs(CX.sub(g, h)) <= 1e-9 * (1 + CX.abs(g)); });
    };
    const [zs, ps] = ok(tidy[0], tidy[1]) ? tidy : raw;
    const params = { a: zpItem(clean(a)), zeros: zs.map(zpItem).join(', '), poles: ps.map(zpItem).join(', ') };
    if (!ok(zs, ps)) return { error: $t('The zeros and poles found do not reproduce this map (its roots are too clustered)') };
    return { step: { type: 'zp', params }, note: `${$tn('{n} zero', '{n} zeros', zs.length)}, ${$tn('{n} pole', '{n} poles', ps.length)}` };
  }
  function fromZerosPoles(step) {
    const b = build(step);
    if (b.error) return { error: b.error };
    if (b.def.id !== 'zp') return { error: $t('Not a zeros-and-poles step') };
    const { P, Q } = b.zp;
    const co = (l) => l.map(fmtC).join(', ');
    if (Q.length === 1) return { step: { type: 'poly', params: { co: co(P.map((c) => CX.div(c, Q[0]))) } } };
    return { step: { type: 'rational', params: { p: co(P), q: co(Q) } } };
  }

  function polyTex(co, a) {
    // (a leading coefficient that is 0 by value but written with a name stays: its term is part of the formula)
    let i0 = 0;
    while (i0 < co.length - 1 && zeroV(co[i0])) i0++;
    co = co.slice(i0);
    const n = co.length - 1;
    const terms = [];
    co.forEach((c, i) => {
      const k = n - i;
      if (zeroV(c)) return;
      const t = ptexOf(c);
      let v = k === 0 ? '' : k === 1 ? atom(a) : `${atom(a)}^{${k}}`;
      let cs = valTex(c);
      const compound = t ? t.p <= 0 : compoundTex(cs);
      if (k > 0 && !t && cs === '1') cs = '';
      else if (k > 0 && !t && cs === '-1') cs = '-';
      else if (compound && (k > 0 || terms.length)) cs = paren(cs);
      if (k > 0 && cs && cs !== '-' && (/^[0-9.]/.test(v) || (t && t.bare && !compound))) cs += '\\cdot ';
      else if (k > 0 && cs && cs !== '-') cs += '\\,';
      terms.push(cs + v);
    });
    if (!terms.length) return { s: '0', p: 4 };
    let s = terms[0];
    for (let i = 1; i < terms.length; i++) s += terms[i].startsWith('-') ? terms[i] : '+' + terms[i];
    return { s, p: terms.length > 1 ? 0 : (s.startsWith('-') ? 2 : 1) };
  }
  // exact degree of polynomial-like function via sampling + DFT
  function numericPolyDegree(f, bound) {
    const N = bound + 1;
    const vals = [];
    for (let j = 0; j < N; j++) vals.push(f(C(Math.cos(2 * PI * j / N), Math.sin(2 * PI * j / N))));
    if (!vals.every(CX.isFin)) return null;
    const co = [];
    for (let m = 0; m < N; m++) {
      let s = C(0, 0);
      for (let j = 0; j < N; j++) s = CX.add(s, CX.mul(vals[j], C(Math.cos(-2 * PI * j * m / N), Math.sin(-2 * PI * j * m / N))));
      co.push(CX.scale(s, 1 / N));
    }
    const mx = Math.max(1e-300, ...co.map(CX.abs));
    let d = 0;
    for (let m = 0; m < N; m++) if (CX.abs(co[m]) > 1e-9 * Math.max(1, mx)) d = m;
    // verify reconstruction at an off-circle point
    const zt = C(0.37, -0.81);
    let r = C(0, 0);
    for (let m = N - 1; m >= 0; m--) r = CX.add(CX.mul(r, zt), co[m]);
    const ft = f(zt);
    if (CX.abs(CX.sub(r, ft)) > 1e-7 * (1 + CX.abs(ft))) return null;
    return d;
  }

  // Are p and q certainly coprime? The computed roots of q are clustered (a root of multiplicity m comes back
  // as m points about eps^(1/m) apart). Pellet's test on the Taylor expansion of q around each cluster
  // proves that the disc |z − c| < R holds exactly that many roots, so the discs hold all of q's roots, and
  // |p(c)| > Σ_{j≥1} |p_j| R^j proves p has no zero in the disc. Returns {coprime, centers} (centers: one per
  // cluster, for the pole markers).
  function coprimeTest(p, q, roots) {
    const left = roots.slice(), clusters = [];
    while (left.length) {
      const cl = [left.pop()];
      for (let grow = true; grow;) {
        grow = false;
        for (let j = left.length - 1; j >= 0; j--) {
          if (cl.some((r) => CX.abs(CX.sub(r, left[j])) < 1e-3 * (1 + CX.abs(r)))) { cl.push(left.splice(j, 1)[0]); grow = true; }
        }
      }
      const c = CX.scale(cl.reduce(CX.add, C(0, 0)), 1 / cl.length);
      const rad = Math.max(...cl.map((r) => CX.abs(CX.sub(r, c))));
      clusters.push({ c, m: cl.length, R: Math.max((2 * cl.length + 2) * rad, 1e-7 * (1 + CX.abs(c))) });
    }
    const centers = clusters.map((x) => x.c);
    const pZero = p.every(CX.isZero);
    const ok = !pZero && clusters.every(({ c, m, R }) => {
      const tq = taylorAt(q, c);
      let dom = 0, rest = 0;
      tq.t.forEach((x, j) => {
        const Rj = Math.pow(R, j);
        if (j === m) dom = (CX.abs(x) - tq.e[j]) * Rj; else rest += (CX.abs(x) + tq.e[j]) * Rj;
      });
      if (!(dom > rest)) return false;
      const tp = taylorAt(p, c);
      let tail = 0;
      for (let j = 1; j < tp.t.length; j++) tail += (CX.abs(tp.t[j]) + tp.e[j]) * Math.pow(R, j);
      return CX.abs(tp.t[0]) - tp.e[0] > tail;
    });
    return { coprime: ok, centers };
  }

  // ---- inverses that are not a catalog entry, and why there is none ----
  const NOTE_CONST = $t('This map is constant, so it has no inverse');
  const times = (d) => (d === 2 ? $t('twice') : $tn('{n} times', '{n} times', d));
  const NOTE_PRE = $t('use the Preimage view to see every solution of f(z) = w');
  // a z^n + b inverts to the principal root ((w − b)/a)^{1/n}, a branch of the inverse like ⁿ√ for zⁿ
  function polyInverse(c) {
    const d = c.length - 1;
    if (d === 0) return { inverse: null, inverseNote: NOTE_CONST };
    if (d === 1) return { inverse: { type: 'affine', params: { a: fmtC(CX.inv(c[0])), b: fmtC(CX.neg(CX.div(c[1], c[0]))) } } };
    if (c.slice(1, d).every(CX.isZero)) {
      const u = XN.div(XN.sub(XN.z(), XN.num(c[d])), XN.num(c[0]));
      const r = d === 2 ? XN.call('sqrt', u) : XN.root(XN.real(d), u);
      return { inverse: { type: 'custom', params: { expr: texOf(r), cut: 180 } } };
    }
    return { inverse: null, inverseNote: $t('A polynomial of degree {d} takes most values {times}, so it has no single inverse; {note}', { d, times: times(d), note: NOTE_PRE }) };
  }
  function rationalInverse(p, q, P) {
    if (P.constant) return { inverse: null, inverseNote: NOTE_CONST };
    if (P.mobius) {
      const two = (co) => (co.length === 1 ? [C(0, 0), co[0]] : co);
      const [a, b] = two(p), [c, d] = two(q);
      const m = [a, b, c, d];
      if (!CX.mobDetZero(m) && CX.mobRel(m) >= CX.MOB_EPS) return { inverse: { type: 'mobius', params: { a: fmtC(d), b: fmtC(CX.neg(b)), c: fmtC(CX.neg(c)), d: fmtC(a) } } };
    }
    if (P.degExact && P.deg >= 2) return { inverse: null, inverseNote: $t('This rational map has degree {d}, so it takes most values {times} and has no single inverse; {note}', { d: P.deg, times: times(P.deg), note: NOTE_PRE }) };
    return { inverse: null, inverseNote: $t('This rational map is not known to be one-to-one, so no inverse is offered; {note}', { note: NOTE_PRE }) };
  }
  function customInverse(ast, th) {
    try {
      const r = Expr.invert(ast, { theta: th });
      const expr = Expr.toTex(r.ast).s;
      Expr.parse(expr);
      return { inverse: { type: 'custom', params: { expr, cut: 180 } }, inverseKind: r.kind };
    } catch (e) {
      return { inverse: null, inverseNote: e.message };
    }
  }

  Derivs.init({ build, fmtDeg });

  const DEFS = {};
  const def = (d) => { DEFS[d.id] = d; };

  // ---------------- Linear & Möbius ----------------
  def({
    id: 'mul', group: $t('Linear & Möbius'), label: $t('Multiply by c'), menuTex: 'c\\,z',
    params: [{ key: 'c', label: 'c', type: 'cx', def: '2' }],
    build({ c }) {
      const nz = !CX.isZero(c);
      return {
        f: (z) => CX.mul(c, z),
        hom: nz ? mobHom([c, C(0, 0), C(0, 0), C(1, 0)]) : null,
        homTex: nz ? (v) => mobHomTex([c, C(0, 0), C(0, 0), C(1, 0)], v) : null,
        tex: (a) => mulTex(c, a),
        props: nz ? props(ALL) : CONSTANT,
        inverse: nz ? { type: 'mul', params: { c: fmtC(CX.inv(c)) } } : null,
        inverseNote: nz ? null : NOTE_CONST,
      };
    },
  });
  def({
    id: 'add', group: $t('Linear & Möbius'), label: $t('Translate by c'), menuTex: 'z+c',
    params: [{ key: 'c', label: 'c', type: 'cx', def: '1' }],
    build({ c }) {
      return {
        f: (z) => CX.add(z, c),
        hom: (t) => (z) => CX.add(z, CX.scale(c, t)),
        homTex: (v = 'z') => ({ tex: $t('the translations $H_t(%{v})=%{v}+tc$, $c=%{c}$', { v, c: CX.tex(c, 3) }), mobius: true }),
        tex: (a) => addTex(a, c),
        props: props(ALL),
        inverse: { type: 'add', params: { c: fmtC(CX.neg(c)) } },
      };
    },
  });
  def({
    id: 'affine', group: $t('Linear & Möbius'), label: $t('Affine'), menuTex: 'az+b',
    params: [{ key: 'a', label: 'a', type: 'cx', def: '1+i' }, { key: 'b', label: 'b', type: 'cx', def: '0' }],
    build({ a, b }) {
      const nz = !CX.isZero(a);
      return {
        f: (z) => CX.add(CX.mul(a, z), b),
        hom: nz ? mobHom([a, b, C(0, 0), C(1, 0)]) : null,
        homTex: nz ? (v) => mobHomTex([a, b, C(0, 0), C(1, 0)], v) : null,
        tex: (x) => addTex(mulTex(a, x), b),
        props: nz ? props(ALL) : CONSTANT,
        inverse: nz ? { type: 'affine', params: { a: fmtC(CX.inv(a)), b: fmtC(CX.neg(CX.div(b, a))) } } : null,
        inverseNote: nz ? null : NOTE_CONST,
      };
    },
  });
  def({
    id: 'recip', group: $t('Linear & Möbius'), label: $t('Inversion'), menuTex: '1/z',
    params: [],
    build() {
      return {
        f: (z) => CX.inv(z),
        hom: mobHom([C(0, 0), C(1, 0), C(1, 0), C(0, 0)]),
        homTex: (v) => mobHomTex([C(0, 0), C(1, 0), C(1, 0), C(0, 0)], v),
        tex: (a) => ({ s: `\\frac{1}{${a.s}}`, p: 4 }),
        props: props({ analytic: true, rational: true, mobius: true, injective: true, deg: 1, degExact: true }),
        poles: [C(0, 0)],
        domain: (v) => `${v}\\neq 0`,
        inverse: { type: 'recip', params: {} },
      };
    },
  });
  function mobiusBuild(a, b, c, d) {
    if (CX.isZero(c) && CX.isZero(d)) throw new Error($t('Denominator is zero (c = d = 0)'));
    const m = [a, b, c, d];
    const cz = CX.isZero(c);
    // ad − bc exactly 0: constant (away from the pole). Clearly nonzero against the scale of the entries
    // (scale invariant): a Möbius map. In between (10√2, 10, 20, 10√2, where rounding hides whether the exact
    // map is constant), claim only what holds either way.
    const degenerate = CX.mobDetZero(m);
    const mob = !degenerate && CX.mobRel(m) >= CX.MOB_EPS;
    const pole = cz ? null : CX.neg(CX.div(d, c));
    const P = degenerate ? props({ analytic: true, rational: true, deg: 0, degExact: true, constant: true, entire: cz, polynomial: cz })
      : mob ? props({ analytic: true, rational: true, mobius: true, injective: true, deg: 1, degExact: true, entire: cz, polynomial: cz, proper: cz })
        : props({ analytic: true, rational: true, deg: 1, degExact: false });
    return {
      f: degenerate && !cz ? ((k) => () => k)(CX.div(a, c)) : (z) => CX.mobApply(m, z),
      hom: mob ? mobHom(m) : null,
      homTex: mob ? (v) => mobHomTex(m, v) : null,
      tex: (x) => {
        // (v15.2: a zero a drops its term, \frac{1}{e^{-z}+1}, never \frac{0\,e^{-z}+1}{…}: the split's rows show it)
        const num = zeroV(a) ? { s: valTex(b), p: ptexOf(b) ? ptexOf(b).p : 4 } : addTex(mulTex(a, x), b);
        if (zeroV(c)) {
          // (a named entry is not divided out: (a z + b)/d, or a z + b for d = 1)
          if (ptexOf(a) || ptexOf(b) || ptexOf(d)) return !ptexOf(d) && CX.eq(d, C(1, 0), 0) ? num : { s: `\\frac{${num.s}}{${valTex(d)}}`, p: 4 };
          const dinv = CX.inv(d);
          return addTex(mulTex(CX.mul(a, dinv), x), CX.mul(b, dinv));
        }
        const den = addTex(mulTex(c, x), d);
        return { s: `\\frac{${num.s}}{${den.s}}`, p: 4 };
      },
      props: P,
      // (a constant map has no pole: −d/c is a removable singularity, so it gets no pole mark; review math-6)
      poles: pole && !degenerate ? [pole] : [],
      domain: pole ? (v) => `${v}\\neq ${CX.tex(pole)}` : null,
      inverse: !mob ? null : { type: 'mobius', params: { a: fmtC(d), b: fmtC(CX.neg(b)), c: fmtC(CX.neg(c)), d: fmtC(a) } },
      inverseNote: mob ? null : degenerate ? $t('ad − bc = 0 makes this map constant, so it has no inverse')
        : $t('ad − bc is too close to 0 to tell whether this map is invertible'),
    };
  }
  def({
    id: 'mobius', group: $t('Linear & Möbius'), label: $t('Möbius'), menuTex: '\\frac{az+b}{cz+d}',
    params: [
      { key: 'a', label: 'a', type: 'cx', def: '1' }, { key: 'b', label: 'b', type: 'cx', def: '-i' },
      { key: 'c', label: 'c', type: 'cx', def: '1' }, { key: 'd', label: 'd', type: 'cx', def: 'i' },
    ],
    presets: [
      { label: $t('Cayley  (z−i)/(z+i)'), params: { a: '1', b: '-i', c: '1', d: 'i' } },
      { label: $t('Inverse Cayley  i(1+z)/(1−z)'), params: { a: 'i', b: 'i', c: '-1', d: '1' } },
      { label: $t('Half-plane → disk  (z−1)/(z+1)'), params: { a: '1', b: '-1', c: '1', d: '1' } },
      { label: $t('Disk → right half-plane  (1+z)/(1−z)'), params: { a: '1', b: '1', c: '-1', d: '1' } },
    ],
    build({ a, b, c, d }) { return mobiusBuild(a, b, c, d); },
  });
  def({
    id: 'blaschke', group: $t('Linear & Möbius'), label: $t('Disk automorphism'), menuTex: 'e^{i\\varphi}\\frac{z-a}{1-\\bar a z}',
    params: [{ key: 'a', label: 'a', type: 'cx', def: '0.5' }, { key: 'phi', label: 'φ', type: 'angle', def: 0 }],
    build({ a, phi }) {
      const e = C(Math.cos(phi * DEG), Math.sin(phi * DEG));
      /** @type {any} */
      const r = mobiusBuild(e, CX.neg(CX.mul(e, a)), CX.neg(CX.conj(a)), C(1, 0));
      const rot = Math.abs(phi) % 360 < 1e-12;
      const ra = CX.abs(a);
      if (ra >= 1) r.branchNote = ra === 1 ? $t('|a| = 1 makes this map degenerate') : $t('|a| > 1: this map swaps the disk with its exterior, so it is not an automorphism of the disk');
      const at = ptexOf(a);
      r.tex = (x) => {
        const num = at ? subTex(x, a) : addTex(x, CX.neg(a));
        const ac = CX.conj(a);
        const den = at ? { s: `1-\\overline{${at.s}}\\,${x.p <= 2 ? paren(x.s) : x.s}`, p: 0 }
          : CX.isZero(ac) ? { s: '1', p: 4 } : addTex(mulTex(CX.neg(ac), x), C(1, 0));
        const fr = !at && CX.isZero(ac) ? num : { s: `\\frac{${num.s}}{${den.s}}`, p: 4 };
        return rot ? fr : { s: `e^{${CX.texNum(phi * DEG, 4)}i}${fr.p >= 4 ? fr.s : paren(fr.s)}`, p: 1 };
      };
      // the inverse is again a disk automorphism: a' = −e^{iφ} a, φ' = −φ
      if (r.inverse) r.inverse = { type: 'blaschke', params: { a: fmtC(CX.neg(CX.mul(e, a))), phi: phi === 0 ? 0 : -phi } };
      else if (ra === 1) r.inverseNote = $t('|a| = 1 makes this map constant, so it has no inverse');
      return r;
    },
  });

  // ---------------- Powers & roots ----------------
  def({
    id: 'pown', group: $t('Powers & roots'), label: $t('Integer power'), menuTex: 'z^n',
    // |n| <= 4096, like an integer exponent in a custom formula: z^n is computed exactly as labelled
    params: [{ key: 'n', label: 'n', type: 'int', def: 2, min: -4096, max: 4096 }],
    build({ n }) {
      const an = Math.abs(n);
      let P;
      if (n === 0) P = CONSTANT;
      else if (n > 0) P = props({ analytic: true, entire: true, rational: true, polynomial: true, proper: true, injective: n === 1, mobius: n === 1, deg: n, degExact: true });
      else P = props({ analytic: true, rational: true, injective: n === -1, mobius: n === -1, deg: an, degExact: true });
      let hom, homTex;
      if (n >= 0) { hom = powHom(C(n, 0), PI, 0); homTex = (v = 'z') => ({ tex: $t('the homotopy $H_t(%{v})=%{v}^{%{e}}$ (principal branch)', { v, e: expoTex(n) }) }); }
      else {
        const h1 = powHom(C(an, 0), PI, 0), inv = mobHom([C(0, 0), C(1, 0), C(1, 0), C(0, 0)]);
        homTex = (v = 'z') => ({ tex: $t('the homotopy $H_t(%{v})=%{v}^{%{e}}$ for $0\\le t\\le 1/2$ (principal branch), then the elliptic Möbius transformations from the identity to $1/w$', { v, e: expoTex(1 + 2 * (an - 1)) }) });
        hom = (t) => {
          if (t < 0.5) return h1(2 * t);
          const g = inv(2 * t - 1);
          return (z) => g(CX.ipow(z, an));
        };
      }
      let inverse = null;
      if (n >= 2) inverse = { type: 'root', params: { n, cut: 180, k: 0 } };
      else if (n === 1 || n === -1) inverse = { type: 'pown', params: { n } };
      else if (n <= -2) inverse = { type: 'powa', params: { alpha: fmtC(C(1 / n, 0)), cut: 180, k: 0 } };
      return {
        inverseNote: n === 0 ? $t('z⁰ = 1 is constant, so it has no inverse') : null,
        f: (z) => CX.ipow(z, n),
        hom, homTex, props: P,
        tex: (a) => (n === 1 ? a : n === 0 ? { s: '1', p: 4 } : n < 0 ? { s: `\\frac{1}{${an === 1 ? a.s : atom(a) + '^{' + an + '}'}}`, p: 4 } : powTex(a, n)),
        poles: n < 0 ? [C(0, 0)] : [],
        domain: n < 0 ? (v) => `${v}\\neq 0` : null,
        inverse,
      };
    },
  });
  def({
    id: 'root', group: $t('Powers & roots'), label: $t('n-th root'), menuTex: '\\sqrt[n]{z}', hasCut: true,
    params: [{ key: 'n', label: 'n', type: 'int', def: 2, min: 2 }, ...cutParams],
    build({ n, cut, k }) {
      n = Math.max(2, n);
      const th = cut * DEG;
      const kk = ((k % n) + n) % n;
      return {
        f: (z) => CX.powReal(z, 1 / n, th, kk),
        hom: powHom(C(1 / n, 0), th, kk),
        homTex: (v = 'z', o) => ({ tex: $t('the homotopy $H_t(%{v})=%{v}^{1-(%{m}/%{n})t}$ (%{cut})', { v, m: n - 1, n, cut: branchOr(o, cut, kk) }) }),
        tex: (a) => ({ s: n === 2 ? `\\sqrt{${a.s}}` : `\\sqrt[${n}]{${a.s}}`, p: 4 }),
        props: props({ analytic: true, injective: true }),
        cuts: [{ kind: 'ray', p: C(0, 0), ang: th, editable: true }],
        domain: (v) => `\\arg ${v}\\neq ${CX.texNum(cut, 2)}^\\circ`,
        branchNote: $t('sheet {k} of {n}', { k: kk, n }),
        inverse: { type: 'pown', params: { n } },
      };
    },
  });
  def({
    id: 'powa', group: $t('Powers & roots'), label: $t('Complex power'), menuTex: 'z^{\\alpha}', hasCut: true,
    params: [{ key: 'alpha', label: 'α', type: 'cx', def: '1.5' }, ...cutParams],
    build({ alpha, cut, k }) {
      const th = cut * DEG;
      const a2 = CX.abs2(alpha);
      const inj = a2 > 0 && Math.abs(alpha.re) >= a2;
      // Inverse z^{1/α} on the branch that undoes this one. Log here has arg in (φ − 360°, φ] with
      // φ = cut + 360k, so z^α has arg α·(that range). For real α > 0 the inverse's arg range ends at αφ; for α < 0
      // the range flips and ends at αφ + 360·min(1, |α|). Then f(f⁻¹(w)) = w when |α| ≥ 1, and f⁻¹(f(z)) = z
      // when |α| ≤ 1 (the injective case). A complex α would need a spiral cut: no inverse is offered.
      let inverse = null;
      if (a2 > 0 && alpha.im === 0) {
        const al = alpha.re, phi = cut + 360 * k;
        const X = al > 0 ? al * phi : al * phi + 360 * Math.min(1, -al);
        const k2 = Math.ceil((X - 180) / 360);
        inverse = { type: 'powa', params: { alpha: fmtC(C(1 / al, 0)), cut: +(X - 360 * k2).toFixed(9), k: k2 } };
      }
      return {
        inverseNote: inverse ? null : a2 === 0 ? $t('z⁰ = 1 is constant, so it has no inverse')
          : $t('A complex exponent winds around 0, so its inverse would need a spiral branch cut; use the Preimage view'),
        f: (z) => CX.pow(z, alpha, th, k),
        hom: powHom(alpha, th, k),
        homTex: (v = 'z', o) => ({ tex: alpha.im === 0 ? $t('the homotopy $H_t(%{v})=%{v}^{%{e}}$ (%{cut})', { v, e: expoTex(alpha.re), cut: branchOr(o, cut, k) }) : $t('the homotopy $H_t(%{v})=%{v}^{1+(\\alpha-1)t}$, $\\alpha=%{alpha}$ (%{cut})', { v, alpha: CX.tex(alpha, 3), cut: branchOr(o, cut, k) }) }),
        tex: (a) => powTex(a, valTex(alpha)),
        props: props({ analytic: true, injective: inj }),
        cuts: [{ kind: 'ray', p: C(0, 0), ang: th, editable: true }],
        domain: (v) => `\\arg ${v}\\neq ${CX.texNum(cut, 2)}^\\circ`,
        branchNote: $t('sheet {k}', { k }),
        inverse,
      };
    },
  });

  // ---------------- Exponential ----------------
  def({
    id: 'exp', group: $t('Exponential & log'), label: $t('Exponential'), menuTex: 'e^{z}',
    params: [],
    build() {
      return {
        f: CX.exp, hom: expHom, homTex: expHomTex,
        tex: (a) => ({ s: `e^{${a.s}}`, p: 3 }),
        props: props({ analytic: true, entire: true }),
        inverse: { type: 'log', params: { cut: 180, k: 0 } },
      };
    },
  });
  def({
    id: 'log', group: $t('Exponential & log'), label: $t('Logarithm'), menuTex: '\\log z', hasCut: true,
    params: [...cutParams],
    build({ cut, k }) {
      const th = cut * DEG;
      return {
        f: (z) => CX.log(z, th, k), hom: logHom(th, k), homTex: logHomTex(cut, k),
        tex: (a) => fn('\\log', a),
        props: props({ analytic: true, injective: true }),
        cuts: [{ kind: 'ray', p: C(0, 0), ang: th, editable: true }],
        domain: (v) => `\\arg ${v}\\neq ${CX.texNum(cut, 2)}^\\circ`,
        branchNote: `Im ∈ ${degIv(cut - 360 + 360 * k, cut + 360 * k)}`,
        inverse: { type: 'exp', params: {} },
      };
    },
  });

  // ---------------- Trigonometric ----------------
  const trig = [
    ['sin', $t('Sine'), '\\sin', CX.sin, true, 'arcsin'],
    ['cos', $t('Cosine'), '\\cos', CX.cos, true, 'arccos'],
    ['tan', $t('Tangent'), '\\tan', CX.tan, false, 'arctan'],
    ['sinh', $t('Hyperbolic sine'), '\\sinh', CX.sinh, true, 'arsinh'],
    ['cosh', $t('Hyperbolic cosine'), '\\cosh', CX.cosh, true, 'arcosh'],
    ['tanh', $t('Hyperbolic tangent'), '\\tanh', CX.tanh, false, 'artanh'],
  ];
  for (const [id, label, tx, F, entire, invId] of trig) {
    def({
      id, group: $t('Trigonometric'), label, menuTex: `${tx} z`, params: [],
      build() {
        const r = {
          f: F, hom: ends(F, ZOOM[id]), homTex: (v = 'z', o) => ({ tex: ZOOM_TEX[id](v, o) }), nat: { kind: 'zoom', fn: id }, tex: (a) => fn(tx, a),
          props: props({ analytic: true, entire }),
          inverse: { type: invId, params: {} },
        };
        if (id === 'tan') r.domain = (v) => `\\cos ${v}\\neq 0`;
        if (id === 'tanh') r.domain = (v) => `\\cosh ${v}\\neq 0`;
        return r;
      },
    });
  }
  const R = (p, ang) => ({ kind: 'ray', p, ang, editable: false });
  const realCuts = [R(C(1, 0), 0), R(C(-1, 0), PI)];
  const imagCuts = [R(C(0, 1), PI / 2), R(C(0, -1), -PI / 2)];
  const itrig = [
    ['arcsin', $t('Arcsine'), '\\arcsin', CX.asin, realCuts, 'sin', (v) => `${v}\\notin(-\\infty,-1]\\cup[1,\\infty)`],
    ['arccos', $t('Arccosine'), '\\arccos', CX.acos, realCuts, 'cos', (v) => `${v}\\notin(-\\infty,-1]\\cup[1,\\infty)`],
    ['arctan', $t('Arctangent'), '\\arctan', CX.atan, imagCuts, 'tan', (v) => `${v}\\notin i(-\\infty,-1]\\cup i[1,\\infty)`],
    ['arsinh', $t('Inverse sinh'), '\\operatorname{arsinh}', CX.asinh, imagCuts, 'sinh', (v) => `${v}\\notin i(-\\infty,-1]\\cup i[1,\\infty)`],
    ['arcosh', $t('Inverse cosh'), '\\operatorname{arcosh}', CX.acosh, [R(C(1, 0), PI)], 'cosh', (v) => `${v}\\notin(-\\infty,1]`],
    ['artanh', $t('Inverse tanh'), '\\operatorname{artanh}', CX.atanh, realCuts, 'tanh', (v) => `${v}\\notin(-\\infty,-1]\\cup[1,\\infty)`],
  ];
  for (const [id, label, tx, F, cuts, invId, dom] of itrig) {
    def({
      id, group: $t('Inverse trigonometric'), label, menuTex: `${tx} z`, params: [],
      build() {
        return {
          f: F, hom: ends(F, ZOOM[id]), homTex: (v = 'z', o) => ({ tex: ZOOM_TEX[id](v, o) }), nat: { kind: 'zoom', fn: id }, tex: (a) => fn(tx, a),
          props: props({ analytic: true, injective: true }),
          cuts, domain: dom, branchNote: $t('principal branch'),
          inverse: { type: invId, params: {} },
        };
      },
    });
  }

  // ---------------- Special ----------------
  def({
    id: 'joukowski', group: $t('Special'), label: $t('Joukowski'), menuTex: '\\tfrac12\\left(z+\\tfrac1z\\right)', params: [],
    build() {
      const f = (z) => CX.scale(CX.add(z, CX.inv(z)), 0.5);
      return {
        f, hom: ends(f, joukHom), nat: { kind: 'jouk' }, homTex: joukTex,
        tex: (a) => ({ s: `\\frac{1}{2}\\left(${a.s}+\\frac{1}{${a.s}}\\right)`, p: 1 }),
        props: props({ analytic: true, rational: true, proper: true, deg: 2, degExact: true }),
        poles: [C(0, 0)], domain: (v) => `${v}\\neq 0`,
        inverse: { type: 'ijouk', params: { branch: 'exterior' } },
      };
    },
  });
  def({
    id: 'ijouk', group: $t('Special'), label: $t('Inverse Joukowski'), menuTex: 'z\\pm\\sqrt{z^2-1}',
    params: [{ key: 'branch', label: $t('branch'), type: 'choice', def: 'exterior', choices: [['exterior', '|w| > 1'], ['interior', '|w| < 1']] }],
    build({ branch }) {
      const sg = branch === 'interior' ? -1 : 1;
      const f = (z) => CX.ijouk(z, sg);   // z + sg s, the interior branch as 1 / (z + s) (no cancellation)
      return {
        f, hom: ends(f, ijoukHom(sg)), nat: { kind: 'ijouk' },
        homTex: (v = 'z') => ({ tex: sg > 0 ? $t('the homotopy $H_t(%{v})=\\coth\\bigl((1-t/2)\\operatorname{arcoth}%{w}\\bigr)$, that is $C^{-1}\\bigl((C%{w})^{1-t/2}\\bigr)$ with $C(%{v})=\\frac{%{v}-1}{%{v}+1}$ (principal branch)', { v, w: vTex(v) }) : $t('the homotopy $H_t(%{v})=\\coth\\bigl((1-t/2)\\operatorname{arcoth}%{w}-\\pi i t/2\\bigr)$, that is $C^{-1}\\bigl(e^{\\pi i t}(C%{w})^{1-t/2}\\bigr)$ with $C(%{v})=\\frac{%{v}-1}{%{v}+1}$ (principal branch)', { v, w: vTex(v) }) }),
        // exactly what is evaluated: z ± √(z−1)·√(z+1) with principal roots (not √(z²−1), which differs on Re z < 0)
        tex: (a) => ({ s: `${a.s}${sg > 0 ? '+' : '-'}\\sqrt{${a.s}-1}\\,\\sqrt{${a.s}+1}`, p: 0 }),
        props: props({ analytic: true, injective: true }),
        cuts: [{ kind: 'seg', a: C(-1, 0), b: C(1, 0) }],
        domain: (v) => `${v}\\notin[-1,1]`, branchNote: branch === 'interior' ? $t('image in the unit disk') : $t('image outside the unit disk'),
        inverse: { type: 'joukowski', params: {} },
      };
    },
  });
  // [issue #4] the Gamma function and the Riemann zeta function (CX.gamma, CX.zeta). Γ deforms along the generic zoom
  // path (about p = 2, where Γ′ = Γψ > 0); ζ has no derivative here, so it takes the straight line and says why
  const POLES_G = Array.from({ length: 41 }, (_, k) => C(-k, 0));
  def({
    id: 'gamma', group: $t('Special'), label: $t('Gamma function'), menuTex: '\\Gamma(z)', params: [],
    build() {
      const f = CX.gamma;
      let nat = null;
      try { nat = genericZoomNat(Expr.parse('\\Gamma(z)'), f, 180); } catch (e) { nat = null; }
      return {
        f, hom: nat ? nat.hom : linHom(f), nat: nat ? nat.nat : null, natData: nat ? nat.natData : null,
        homTex: nat ? nat.homTex : (v = 'z') => ({ tex: $t('the straight-line homotopy $H_t(%{v})=(1-t)%{v}+t\\,f(%{v})$ (%{why})', { v, why: $t('this formula has no usable point to zoom about, so it has no natural path') }), segment: true }),
        tex: (a) => ({ s: `\\Gamma${paren(a.s)}`, p: 3 }),
        props: props({ analytic: true }),
        poles: POLES_G, domain: (v) => `${v}\\notin\\{0,-1,-2,\\dots\\}`,
        inverseNote: $t('Γ takes each value infinitely often, so it has no single inverse; {note}', { note: NOTE_PRE }),
      };
    },
  });
  def({
    id: 'zeta', group: $t('Special'), label: $t('Riemann zeta function'), menuTex: '\\zeta(z)', params: [],
    build() {
      const f = CX.zeta;
      return {
        f, hom: linHom(f),
        homTex: (v = 'z') => ({ tex: $t('the straight-line homotopy $H_t(%{v})=(1-t)%{v}+t\\,f(%{v})$ (%{why})', { v, why: $t('the zoom path needs ζ′, which is not available') }), segment: true }),
        tex: (a) => ({ s: `\\zeta${paren(a.s)}`, p: 3 }),
        props: props({ analytic: true }),
        poles: [C(1, 0)], domain: (v) => `${v}\\neq 1`,
        // ([issue #276] all of its singular points, finitely many, for the lines of a chain with no inverse plan. Γ has
        // none such: its poles 0, −1, −2, … run along a line's whole reach, which only the scan follows)
        sing: () => [{ z: C(1, 0), kind: 'pole' }],
        inverseNote: $t('ζ takes each value infinitely often, so it has no single inverse; {note}', { note: NOTE_PRE }),
      };
    },
  });
  // [issue #260] the Douady–Hubbard map Φ_M(z) = φ_z(z), the conformal map of the outside of the Mandelbrot set M onto
  // the outside of the closed unit disk (Φ_M(z) = z + O(1) at ∞), and the Böttcher coordinate φ_c of z ↦ z² + c, the
  // conformal map of {G_c > G_c(0)} (the whole basin of ∞ when c ∈ M) onto |w| > e^{G_c(0)}: CX.bottcher, by the
  // orbit and the square roots nearest to it. NaN on M (on the filled Julia set), wherever the orbit needs more than N
  // steps to pass 10⁴, and for φ_c below the critical potential. The external rays and equipotentials of the Inspector
  // card are Region's dhray and dheq. Both deform along the straight line (no zoom path: they are not defined at 0)
  const DH_NMAX = 64;
  // ([#299 review] its tooltip: why a band next to the set stays blank)
  const DH_NTIP = $t('Steps N: the orbit must pass |w| = 10⁴ within N steps (|u| > 2 is not enough for Φ), so a thin band next to the set, wider than the escape test |u| ≤ 2 leaves, stays blank');
  const dhNoInv = () => $t('Φ is one-to-one, but its inverse is not available as a step; {note}', { note: NOTE_PRE });
  const dhHomTex = (v = 'z') => ({ tex: $t('the straight-line homotopy $H_t(%{v})=(1-t)%{v}+t\\,f(%{v})$ (%{why})', { v, why: $t('Φ is defined only outside the set, so it has no point to zoom about') }), segment: true });
  def({
    id: 'dh', group: $t('Special'), label: $t('Douady–Hubbard map'), menuTex: '\\Phi_M(z)',
    params: [{ key: 'N', label: $t('steps N'), type: 'int', def: DH_NMAX, min: 1, max: DH_NMAX, tip: DH_NTIP }],
    build({ N }) {
      const f = (z) => CX.bottcher(z, z, N);
      return {
        f, hom: linHom(f), homTex: dhHomTex,
        tex: (a) => ({ s: `\\Phi_M${paren(a.s)}`, p: 3 }),
        props: props({ analytic: true, injective: true }),
        domain: (v) => `${v}\\notin M`,
        inverseNote: dhNoInv(),
      };
    },
  });
  def({
    id: 'bottcher', group: $t('Special'), label: $t('Böttcher coordinate'), menuTex: '\\varphi_c(z)',
    params: [{ key: 'c', label: 'c', type: 'cx', def: '-1' }, { key: 'N', label: $t('steps N'), type: 'int', def: DH_NMAX, min: 1, max: DH_NMAX, tip: DH_NTIP }],
    build({ c, N }) {
      const rho = CX.dhCritRho(c, N);
      const f = (z) => CX.bottcherJ(z, c, N, rho);
      return {
        f, hom: linHom(f), homTex: dhHomTex,
        tex: (a) => ({ s: `\\varphi_{${valTex(c)}}${paren(a.s)}`, p: 3 }),
        props: props({ analytic: true, injective: true }),
        domain: (v) => (rho > 1 ? `G_c(${v})>G_c(0)` : `${v}\\notin K_c`),
        inverseNote: dhNoInv(),
        dh: { rho },
      };
    },
  });
  def({
    id: 'conj', group: $t('Special'), label: $t('Conjugation'), menuTex: '\\bar z', params: [],
    build() {
      return {
        f: CX.conj,
        hom: (t) => (z) => C(z.re, z.im * (1 - 2 * t)),
        homTex: (v = 'z') => ({ tex: $t('the homotopy $H_t(%{v})=\\operatorname{Re} %{v}+i(1-2t)\\operatorname{Im} %{v}$', { v }), segment: true }),
        tex: (a) => ({ s: `\\overline{${a.s}}`, p: 4 }),
        props: props({ proper: true, injective: true }),
        inverse: { type: 'conj', params: {} },
      };
    },
  });

  // ---------------- Polynomial, rational, custom ----------------
  def({
    id: 'poly', group: $t('Polynomial & custom'), label: $t('Polynomial'), menuTex: 'a_nz^n+\\dots+a_0',
    params: [{ key: 'co', label: $t('coefficients aₙ, …, a₀'), type: 'coeffs', def: '1, 0, -1, 0' }],
    build({ co }) {
      const c = CX.polyTrim(co);
      const d = c.length - 1;
      const P = d === 0 ? CONSTANT : props({ analytic: true, entire: true, rational: true, polynomial: true, proper: true, injective: d === 1, mobius: d === 1, deg: d, degExact: true });
      const f = (z) => CX.polyEval(c, z);
      const nat = d >= 1 ? polyNat(c, f) : null;
      return {
        f, hom: nat ? nat.hom : linHom(f), homTex: nat ? nat.homTex : (v = 'z') => ({ tex: $t('the straight-line homotopy $H_t(%{v})=(1-t)%{v}+t\\,f(%{v})$ (a constant has no natural path)', { v }), segment: true }),
        nat: nat ? nat.nat : null, natData: nat ? nat.natData : null,
        tex: (a) => polyTex(co, a), props: P,
        ...polyInverse(c),
      };
    },
  });
  def({
    id: 'rational', group: $t('Polynomial & custom'), label: $t('Rational'), menuTex: '\\frac{p(z)}{q(z)}',
    params: [{ key: 'p', label: $t('numerator p: coefficients'), type: 'coeffs', def: '1, 0, 1' }, { key: 'q', label: $t('denominator q: coefficients'), type: 'coeffs', def: '1, 0' }],
    build({ p, q }) {
      const p0 = p, q0 = q;
      p = CX.polyTrim(p); q = CX.polyTrim(q);
      const dp = p.length - 1, dq = q.length - 1;
      const f = (z) => CX.div(CX.polyEval(p, z), CX.polyEval(q, z));
      if (q.length === 1 && CX.isZero(q[0])) throw new Error($t('Denominator is zero'));
      const pZero = p.length === 1 && CX.isZero(p[0]);
      let coprime = false, poles = [];
      if (dq === 0) coprime = true;
      else {
        // the exact degree max(dp, dq) is claimed only when no root of q can also be a root of p
        const t = coprimeTest(p, q, CX.polyRoots(q));
        coprime = t.coprime;
        poles = t.centers;
      }
      const deg = Math.max(dp, dq);
      let P;
      if (pZero) P = props({ analytic: true, rational: true, deg: 0, degExact: true, constant: true, entire: dq === 0, polynomial: dq === 0 });
      else if (dq === 0) {
        P = dp === 0 ? CONSTANT : props({ analytic: true, entire: true, rational: true, polynomial: true, proper: true, injective: dp === 1, mobius: dp === 1, deg: dp, degExact: true });
      } else {
        P = props({ analytic: true, rational: true, deg, degExact: coprime });
        if (coprime) {
          P.proper = dp > dq;
          P.injective = P.mobius = deg === 1;
          if (deg === 0) P.constant = true;
        }
      }
      const nat = P.constant ? null : rationalNat(p, q, f);
      return {
        f, hom: nat ? nat.hom : linHom(f), homTex: nat ? nat.homTex : (v = 'z') => ({ tex: $t('the straight-line homotopy $H_t(%{v})=(1-t)%{v}+t\\,f(%{v})$ (this map has no natural path)', { v }), segment: true }),
        nat: nat ? nat.nat : null, natData: nat ? nat.natData : null,
        tex: (a) => ({ s: `\\frac{${polyTex(p0, a).s}}{${polyTex(q0, a).s}}`, p: 4 }),
        props: P, poles, domain: dq > 0 ? (v) => `q(${v})\\neq 0` : null,
        ...rationalInverse(p, q, P),
      };
    },
  });
  // f(z) = a ∏ (z − ζ_k) / ∏ (z − p_j), the zeros and poles dragged in the input plane (notes/ui-design/zeros-poles.md).
  // Given as points, the numerator and denominator are coprime unless a zero and a pole coincide exactly (they cancel:
  // a removable singularity, filled in), so the degree max(#zeros, #poles) is exact.
  def({
    id: 'zp', group: $t('Polynomial & custom'), label: $t('Zeros and poles'), menuTex: 'a\\frac{\\prod(z-\\zeta_k)}{\\prod(z-p_j)}',
    params: [{ key: 'a', label: 'a', type: 'cx', def: '1' }, { key: 'zeros', label: $t('zeros'), type: 'cxlist', def: '1, -1' }, { key: 'poles', label: $t('poles'), type: 'cxlist', def: '0' }],
    build({ a, zeros, poles }) {
      if (zeros.length > ZP_MAX || poles.length > ZP_MAX) throw new Error($tn('At most {n} zeros and {n} poles', 'At most {n} zeros and {n} poles', ZP_MAX));
      const { zs, ps, gone } = zpCancel(zeros, poles);
      // (the formula cancels a zero and a pole only when they are written alike: a zero at a and a pole at c stay in it
      // while a slider makes them equal)
      const shown = zpCancel(zeros, poles, true);
      const nz = zs.length, np = ps.length, deg = Math.max(nz, np);
      const aZero = CX.isZero(a);
      const P = zpExpand(a, zs), Q = zpExpand(C(1, 0), ps);
      // evaluated as a ∏ ((z − ζ_k)/(z − p_k)) × the unpaired factors (no overflow of either product alone); ∞ at a pole
      // (a = 0: the constant 0 everywhere, the poles included: 0 · ∏/∏ has only removable singularities)
      const f = aZero ? () => C(0, 0) : (z) => {
        for (const p of ps) if (p.re === z.re && p.im === z.im) return C(Infinity, Infinity);
        let w = a;
        for (let i = 0; i < deg; i++) {
          if (i < nz && i < np) w = CX.mul(w, CX.div(CX.sub(z, zs[i]), CX.sub(z, ps[i])));
          else if (i < nz) w = CX.mul(w, CX.sub(z, zs[i]));
          else w = CX.div(w, CX.sub(z, ps[i]));
        }
        return w;
      };
      let Pr;
      if (aZero || deg === 0) Pr = props({ analytic: true, rational: true, deg: 0, degExact: true, constant: true, entire: aZero || !np, polynomial: aZero || !np });
      else if (!np) Pr = props({ analytic: true, entire: true, rational: true, polynomial: true, proper: true, injective: nz === 1, mobius: nz === 1, deg: nz, degExact: true });
      else Pr = props({ analytic: true, rational: true, deg, degExact: true, proper: nz > np, injective: deg === 1, mobius: deg === 1 });
      const nat = Pr.constant ? null : zerosPolesNat(a, zs, ps, f);
      // the caption names the zeros as the card does (ζ, p) and the zoom centre c (ratPath with the zp options)
      const homTex = nat ? nat.homTex : (v = 'z') => ({ tex: $t('the straight-line homotopy $H_t(%{v})=(1-t)%{v}+t\\,f(%{v})$ (a constant has no natural path)', { v }), segment: true });
      const domain = np && !aZero ? (v) => (np <= 3 ? `${v}\\notin\\{${[...new Set(ps.map((p) => CX.tex(p)))].join(',')}\\}` : `${v}\\neq p_j`) : null;
      const inv = Pr.constant ? { inverse: null, inverseNote: NOTE_CONST } : np ? rationalInverse(P, Q, Pr) : polyInverse(P);
      const notes = [];
      if (gone.length) { const at = [...new Set(gone.map((g) => CX.fmt(g, 4)))].join(', '); notes.push(gone.length === 1 ? $t('A zero and a pole cancel at {at}', { at }) : $tn('{n} zero–pole pairs cancel at {at}', '{n} zero–pole pairs cancel at {at}', gone.length, { at })); }
      if (aZero) notes.push(np ? $t('a = 0 makes the map the constant 0 (the poles too: they are removable)') : $t('a = 0 makes the map constant'));
      return {
        f, hom: nat ? nat.hom : linHom(f), homTex,
        nat: nat ? nat.nat : null, natData: nat ? nat.natData : null,
        tex: (x) => (zeroV(a) ? { s: '0', p: 4 } : zpTex(a, shown.zs, shown.ps, x)),
        props: Pr, poles: aZero ? [] : ps.slice(), domain,
        zp: { a, zeros: zs, poles: ps, gone, P, Q },
        branchNote: notes.length ? notes.join('; ') : null,
        ...inv,
      };
    },
  });
  def({
    // (v16.5 UX84: the type is "Formula"; the formula is in the card's tooltip)
    id: 'custom', group: $t('Polynomial & custom'), label: $t('Formula'), menuTex: 'f(z)\\ \\text{(LaTeX)}',
    params: [{ key: 'expr', label: 'f(z) =', type: 'expr', def: 'z^2+\\frac{1}{z}' }, { key: 'cut', label: $t('cut angle for log, √, powers'), type: 'angle', def: 180 }],
    hasCut: 'maybe',
    // (ast, part: a part of a recognized formula, built from its tree by buildVals; it is never recognized again)
    build({ expr, cut, ast: given, part }) {
      const ast = given || Expr.parse(expr);
      if (Expr.hasBool(ast)) throw new Error($t('A function cannot contain comparisons'));
      const vars = Expr.usesVars(ast);
      for (const v of vars) if (v !== 'z') throw new Error($t('Use z (or w) as the variable{hint}', { hint: v === 'x' || v === 'y' ? $t('; write Re z, Im z for real parts') : '' }));
      const th = cut * DEG;
      const f = Expr.compile(ast, { theta: th });
      // a formula that is undefined at every generic point (z/0, log 0, ...) is an error, not a map
      const probes = [C(0.37, -0.81), C(-1.3, 0.6), C(2.1, 1.7), C(-0.45, -2.2), C(0.9, 0.05)];
      // ([issue #242] and inside the half-plane where a Dirichlet series converges, which may lie right of them all)
      if (Expr.hasSeries(ast)) for (const x of Expr.seriesInfo(ast)) if (x.kind === 'dirichlet' && Number.isFinite(x.sigma)) probes.push(C(x.sigma + 2, 0.3), C(x.sigma + 6, 0.3));
      // (a recurrence whose orbits escape is ∞ there, not undefined)
      if (!probes.some((p) => CX.isFin(f(p))) && !Expr.hasIter(ast)) throw new Error($t('The formula is undefined for every z (check for a division by zero or a logarithm of 0)'));
      const cls = Expr.classify(ast);
      let P;
      if (!cls.dep) P = CONSTANT;
      else {
        P = props({ analytic: cls.analytic, entire: cls.entire, rational: cls.rational, polynomial: cls.poly });
        if (cls.poly) {
          // exact expansion into coefficients: the degree is claimed exact only when no coefficient above the
          // highest certainly nonzero one may be nonzero; otherwise only deg ≤ (cls.deg is an upper bound too)
          const e = Expr.polyDegree(ast, 4096);
          if (e && e.lo === e.hi) {
            const d = Math.max(0, e.hi);
            P.deg = d; P.degExact = true;
            if (d === 0) { P.constant = true; }
            else { P.proper = true; P.injective = P.mobius = d === 1; }
          } else {
            P.deg = e ? e.hi : cls.deg; P.degExact = false;
            P.proper = !!e && e.lo >= 1;
          }
        }
      }
      // a formula that is a chain of catalog steps renders, deforms and reports as that chain (recognizeCustom)
      const rec = part || !cls.dep || P.constant ? null : recChain(ast, cut, f);
      let nat = null;
      // ([issue #5, #6] a series or a recurrence deforms along the straight line for now: its zoom path waits for its
      // GPU twin)
      try { nat = !rec && cls.dep && !P.constant && !Expr.hasSeries(ast) && !Expr.hasIter(ast) ? customNat(ast, f, cut, cls.analytic) : null; } catch (e) { nat = null; }
      const r = /** @type {any} */ ({
        ast,
        f, hom: nat ? nat.hom : linHom(f),
        homTex: nat ? nat.homTex : (v = 'z') => ({ tex: $t('the straight-line homotopy $H_t(%{v})=(1-t)%{v}+t\\,f(%{v})$ (%{why})', { v, why: P.constant || !cls.dep ? $t('a constant has no natural path') : cls.analytic ? $t('this formula has no usable point to zoom about, so it has no natural path') : $t('this formula is not analytic, so it has no natural path') }), segment: true }),
        nat: nat ? nat.nat : null, natData: nat ? nat.natData || null : null,
        tex: (a) => Expr.toTex(ast, a),
        props: P,
        usesCut: cls.branch,
        domain: cls.branch ? (v) => $t('%{v}\\ \\text{off the branch cuts of the formula}', { v }) : (cls.entire ? null : (v) => $t('\\text{the formula is defined at } %{v}', { v })),
        branchNote: cls.branch ? $t('log, √ and powers use arg ∈ {iv}', { iv: degIv(cut - 360, cut) }) : null,
        ...(part ? { inverse: null } : customInverse(ast, th)),
      });
      if (rec) asChain(r, rec);
      // [issue #5] where its series converge: dashed circles (|z − c| = R, and r for a Laurent series) or the line
      // Re z = σ, drawn with the cuts, and the domain in words; R, r and σ are estimated from the coefficients
      const si = !rec && Expr.hasSeries(ast) ? Expr.seriesInfo(ast) : [];
      if (si.length) {
        const fx = (x) => CX.texNum(Number(x.toPrecision(2)), 4);
        const disc = (v, c) => { const t = CX.tex(c); return CX.isZero(c) ? `\\left|${v}\\right|` : `\\left|${v}-${Expr.compoundTex(t) || t.startsWith('-') ? paren(t) : t}\\right|`; };
        const parts = [];
        r.cuts = [];
        for (const x of si) {
          // ([issue #242] σ exact for coefficients periodic times a power of n, else estimated from them, and said so)
          if (x.kind === 'dirichlet') {
            if (Number.isFinite(x.sigma)) { r.cuts.push({ kind: 'vline', x: x.sigma }); parts.push((v) => `\\operatorname{Re} ${v}>\\sigma${x.est ? '\\approx' : '='} ${fx(x.sigma)}${x.est ? $t('\\ \\text{(estimated from the coefficients)}') : ''}`); }
            continue;
          }
          const R = Number.isFinite(x.R) ? x.R : null, rr = x.r > 0 ? x.r : null;
          if (R) r.cuts.push({ kind: 'circle', c: x.c, r: R });
          if (rr) r.cuts.push({ kind: 'circle', c: x.c, r: rr });
          if (R || rr) parts.push((v) => `${rr ? `r\\approx ${fx(rr)}<` : ''}${disc(v, x.c)}${R ? `<R\\approx ${fx(R)}` : ''}`);
        }
        if (parts.length) r.domain = (v) => parts.map((g) => g(v)).join(',\\ ');
      }
      return r;
    },
  });
  // [issue #5] a series: a power series Σ a_n (z − c)^n, a Laurent series Σ_{n ∈ ℤ} a_n (z − c)^n or a Dirichlet series
  // Σ a_n n^{−z}, from the formula a_n in n; built as the formula it writes (Expr's series: its values, the region where
  // it converges, drawn with the cuts, and the GPU's coefficients)
  const seriesExpr = (kind, an, c) => {
    // (c arrives as a number: a 'cx' parameter is read by build)
    const cv = c && typeof c === 'object' ? c : C(0, 0);
    if (!CX.isFin(cv)) throw new Error($t('The centre c must be a number'));
    const a = `\\left(${an}\\right)`, w = CX.isZero(cv) ? 'z' : `\\left(z-\\left(${CX.tex(cv)}\\right)\\right)`;
    if (kind === 'dirichlet') return `\\sum_{n=1}^{\\infty} ${a}\\,n^{-z}`;
    if (kind === 'laurent') return `\\sum_{n\\in\\mathbb{Z}} ${a}\\,${w}^{n}`;
    // (from n = 1 when a_0 is undefined, as for 1/n²)
    let a0 = null;
    try { a0 = Expr.compile(Expr.parse(`\\sum_{n=0}^{0} ${a}`))(C(0, 0)); } catch (e) { a0 = null; }
    return `\\sum_{n=${a0 && CX.isFin(a0) ? 0 : 1}}^{\\infty} ${a}\\,${w}^{n}`;
  };
  def({
    id: 'series', group: $t('Polynomial & custom'), label: $t('Series'), menuTex: '\\sum a_n (z-c)^n',
    params: [
      { key: 'kind', label: $t('kind'), type: 'choice', def: 'power', choices: [['power', $t('power series')], ['laurent', $t('Laurent series')], ['dirichlet', $t('Dirichlet series')]] },
      { key: 'an', label: 'aₙ =', say: 'a n', type: 'seq', def: '\\frac{1}{n!}', bound: ['n'] },
      { key: 'c', label: 'c =', type: 'cx', def: '0' },
    ],
    build({ kind, an, c }) {
      if (!String(an || '').trim()) throw new Error($t('Write the coefficients a_n as a formula in n'));
      const expr = seriesExpr(kind, an, kind === 'dirichlet' ? null : c);
      let r;
      // ([issue #242] a failure said in the series' own terms: a coefficient undefined at some n, or a Dirichlet series
      // whose rest cannot be bounded where the probes look)
      try { r = DEFS.custom.build({ expr, cut: 180 }); } catch (e) {
        const x = Expr.seriesInfo(Expr.parse(expr))[0] || {};
        throw x.bad != null ? new Error($t('The coefficient a_n is undefined at n = {n}', { n: x.bad })) : x.est ? new Error($t('This Dirichlet series converges too slowly to sum: a_n is not a periodic sequence times a power of n')) : e;
      }
      if (!Expr.seriesInfo(r.ast).length) throw new Error($t('The coefficients a_n must not depend on z'));
      r.usesCut = false;
      r.inverse = null;
      // (its TeX simplified: a_n = 1 writes n^{−z}, not 1·n^{−z})
      const sa = Expr.simplify(r.ast);
      r.tex = (x) => Expr.toTex(sa, x);
      r.inverseNote = $t('A series takes most values many times, so it has no single inverse; {note}', { note: NOTE_PRE });
      return r;
    },
  });
  // [issue #6] a recurrence: u_0 a formula in z, u_{k+1} = g(u_k, z), and the map z ↦ u_N (N from 0 to Expr.ITER_CAP);
  // ∞ where the orbit escapes. Built as the formula it writes (Expr's iter node): its values, guarantees (a polynomial
  // of exact degree when it is short enough to write out), d/dz and the GPU's loop.
  def({
    id: 'recurrence', group: $t('Polynomial & custom'), label: $t('Recurrence'), menuTex: 'u_{k+1}=g(u_k,z)',
    params: [
      { key: 'u0', label: 'u₀ =', say: 'u 0', type: 'seq', def: 'z' },
      { key: 'g', label: 'uₖ₊₁ =', say: 'u k+1', type: 'seq', def: 'u^2+z', bound: ['u'] },
      { key: 'N', label: 'N', type: 'int', def: 8, min: 0, max: Expr.ITER_CAP },
      { key: 'cut', label: $t('cut angle for log, √, powers'), type: 'angle', def: 180 },
    ],
    hasCut: 'maybe',
    build({ u0, g, N, cut }) {
      if (!String(u0 || '').trim()) throw new Error($t('Write the start u₀ as a formula in z'));
      if (!String(g || '').trim()) throw new Error($t('Write the rule as a formula in u and z, such as u^2+z'));
      if (!(Number.isInteger(N) && N >= 0 && N <= Expr.ITER_CAP)) throw new Error($t('N must be a whole number from 0 to {max}', { max: Expr.ITER_CAP }));
      if (/(^|[^A-Za-z\\])u(?![A-Za-z])/.test(u0)) throw new Error($t('u₀ is a formula in z: u is the letter of the rule'));
      const a0 = Expr.parse(u0);
      const ast = Expr.iterate(a0, Expr.parse(g, { bound: ['u'] }), { t: 'num', v: C(N, 0), lit: String(N) });
      const r = DEFS.custom.build({ expr: '', cut, ast });
      r.inverse = null;
      r.inverseNote = $t('A recurrence usually takes each value many times, so it has no single inverse; {note}', { note: NOTE_PRE });
      return r;
    },
  });

  // ---------------- a custom formula recognized as catalog steps (src/recognize.js) ----------------
  // notes/formula-recognition/DESIGN.md. The step keeps its formula (text, TeX, saved state, the sheet view, d/dz and its
  // inverse are the formula's); its map, natural path, guarantees, cuts and poles are those of the chain, and the
  // renderers (Inverse.stepOps, GLChain) draw it as the chain. b.rec = {steps, built, partial}.
  const REC_PROBES = [C(0.37, -0.81), C(-1.3, 0.6), C(2.1, 1.7), C(-0.45, -2.2), C(0.9, 0.05), C(-0.6, -0.35), C(1.7, -0.4)];
  // the chain gives the formula's values at generic points (tolerance tol), or the reading is refused
  function recProbe(f, g, tol) {
    for (const p of REC_PROBES) {
      const a = f(p), b = g(p), fa = CX.isFin(a), fb = CX.isFin(b);
      if (fa !== fb || (fa && !(CX.abs(CX.sub(a, b)) <= tol * (1 + CX.abs(a))))) return false;
    }
    return true;
  }
  // A log, root or power step of a recognized formula: on the CPU (its map and its homotopy, which the deformation's
  // curves follow) it evaluates as Expr.compile does, on the formula's raw θ and sheet 0: CX.log(z, θ),
  // CX.powReal(z, 1/n, θ), CX.pow(z, α, θ). finish() normalises a cut beyond (−180°, 180°] into (cut, k), which was the
  // same function off the ray but not on it (argCut(θ + 360°m) was not argCut(θ) + 2πm at a −0 point on the ray), so the
  // deformation ended on the other branch there (review verify-1); since review math-3 argCut reads the −0 alike at
  // every θ = 180° + 360°m, and the two agree on the ray too. b.vals keep the normalised (cut, k), which the GPU plan and
  // the inverse ops read.
  function onFormulaCut(b, th) {
    if (!b || b.error) return b;
    const v = b.vals;
    switch (b.def.id) {
      case 'log': b.f = (z) => CX.log(z, th); b.hom = logHom(th, 0); break;
      case 'root': { const e = 1 / Math.max(2, v.n); b.f = (z) => CX.powReal(z, e, th); b.hom = powHom(C(e, 0), th, 0); break; }
      case 'powa': { const al = v.alpha; b.f = (z) => CX.pow(z, al, th); b.hom = powHom(al, th, 0); break; }
    }
    return b;
  }
  function recBuild(rc, cut) {
    const th = cut * DEG;
    const built = rc.steps.map((s) => (s.type === 'custom'
      ? buildVals('custom', { expr: Expr.toTex(s.vals.ast).s, cut, ast: s.vals.ast, part: true })
      : onFormulaCut(buildVals(s.type, s.vals), th)));
    if (built.some((b) => !b || b.error || (b.props && b.props.constant))) return null;
    const fs = built.map((b) => b.f);
    return { built, fc: (z) => { for (const h of fs) z = h(z); return z; } };
  }
  // Readings are cached by the tree (shared numbers by name, not value) and the cut (review frperf-4): a formula without
  // shared numbers is read and built once; one with shared numbers is decided once at generic values (the tape of
  // value-dependent choices, checked at two generic sets and probed), then only replayed at the current values.
  const REC_CACHE = new Map(), REC_CACHE_MAX = 96;
  const recCached = (k, make) => {
    if (REC_CACHE.has(k)) { const v = REC_CACHE.get(k); REC_CACHE.delete(k); REC_CACHE.set(k, v); return v; }
    const v = make();
    REC_CACHE.set(k, v);
    if (REC_CACHE.size > REC_CACHE_MAX) REC_CACHE.delete(REC_CACHE.keys().next().value);
    return v;
  };
  function recChain(ast, cut, f) {
    const th = cut * DEG;
    const read = (a, opts) => { try { return Recognize.chain(a, cut, opts); } catch (e) { return null; } };
    const k = Recognize.key(ast, cut);
    if (!Recognize.hasParam(ast)) {
      return finishRec(recCached(k, () => {
        const rc = read(ast);
        const bt = rc && recBuild(rc, cut);
        // a guard against a reading the recognizer got wrong (not the proof, which is the reading itself)
        if (!bt || !recProbe(f, bt.fc, 1e-9)) return null;
        return { rc, bt };
      }), cut, th);
    }
    const tape = recCached(k, () => {
      const g = [0, 1].map((set) => { const ga = Recognize.generic(ast, set); return { ga, rc: read(ga, { tape: { mode: 'rec' } }) }; });
      if (!g[0].rc || !g[1].rc || JSON.stringify(g[0].rc.tape) !== JSON.stringify(g[1].rc.tape)) return null;
      for (const x of g) {
        const bt = recBuild(x.rc, cut);
        if (!bt || !recProbe(Expr.compile(x.ga, { theta: th }), bt.fc, 1e-9)) return null;
      }
      return g[0].rc.tape;
    });
    if (!tape) return null;
    const rc = read(ast, { tape: { mode: 'play', list: tape } });
    const bt = rc && recBuild(rc, cut);
    // the structure was proved at generic values; here only a gross difference refuses (no flicker at 1e-9 noise)
    if (!bt || !recProbe(f, bt.fc, 1e-6)) return null;
    return finishRec({ rc, bt }, cut, th);
  }
  // the groups' CPU functions: the formula's own pieces, Expr.compile on the formula's raw θ (review math-1, math-2);
  // ins[j]: the formula's own value of step j's input (its subtree step.inp, a function of z), for a step with a cut
  function finishRec(c, cut, th) {
    if (!c) return null;
    const { rc, bt } = c;
    // (v15.2: each group keeps its piece of the formula as typed, src, which the split writes its parameters from)
    if (!c.groups) c.groups = rc.groups.map((g) => ({ from: g.from, to: g.to, f: Expr.compile(g.src, { theta: th }), src: g.src }));
    if (!c.ins) c.ins = rc.steps.map((s, j) => (s.inp && sideMatters(bt.built[j]) ? Expr.compile(s.inp, { theta: th }) : null));
    return { steps: rc.steps, built: bt.built, partial: rc.partial, fc: bt.fc, groups: c.groups, ins: c.ins };
  }
  // a step whose value on a cut depends on the side its input is on: a catalog step that draws a cut, or a formula part
  const sideMatters = (b) => b.def.id === 'custom' || (b.cuts && b.cuts.length > 0);
  // multiplying by c: a rotation (|c| = 1, as −1 or i), a scaling (c > 0), else both; unknown (a shared number): both
  // (review steps-7: e^{iz} and 1/(1+e^{−z}) read "Scaling" for a rotation)
  const mulLabel = (c) => (!c || !CX.isFin(c) ? $t('Rotation and scaling') : Math.abs(CX.abs(c) - 1) < 1e-12 ? $t('Rotation') : c.im === 0 && c.re > 0 ? $t('Scaling') : $t('Rotation and scaling'));
  const recLabel = (b) => {
    switch (b.def.id) {
      case 'mul': return mulLabel(b.vals && b.vals.c);
      case 'add': return $t('Translation');
      case 'root': return b.vals.n === 2 ? $t('Square root') : $t('Root');
      default: return b.def.label;
    }
  };
  function asChain(r, rec) {
    const { built } = rec, n = built.length;
    const fs = built.map((b) => b.f);
    const homs = built.map((b) => b.hom || linHom(b.f));
    // r.f stays the formula's own (Expr.compile): its values, signed zeros on the cuts and overflow, bit for bit. The point
    // before step j is the formula's own pieces (the groups that end by j), then the catalog steps inside j's group. A
    // step with a cut (k ≤ j, the last one in j's group) starts from the formula's own value of its input instead
    // (rec.ins[k]), then the catalog steps k … j−1: it reads the side of its cut the formula reads, also inside a group,
    // where the catalog steps before it may carry the other signed zero (the formula's z + 1 − 1 turns −0 into +0 where
    // the chain passes z on; its −z keeps the −0 that a catalog mul(−1) turns into +0; review verify-1). Every cut
    // step's homotopy then runs into the formula's branch.
    const ins = rec.ins || [];
    const pres = built.map((b, j) => {
      const g = rec.groups.find((q) => q.from <= j && j < q.to);
      let k = j;
      while (k >= g.from && !ins[k]) k--;
      const out = [];
      if (k >= g.from) out.push(ins[k]);
      else { for (const q of rec.groups) { if (q.to > j) break; out.push(q.f); } k = g.from; }
      for (let i = k; i < j; i++) out.push(fs[i]);
      return out;
    });
    // the steps' own homotopies in turn, step j on [j/n, (j+1)/n] (as the catalog chain plays them one after another)
    r.hom = (t) => {
      if (!(t > 0)) return (z) => z;
      if (t >= 1) return r.f;
      const s = t * n, j = Math.min(n - 1, Math.floor(s)), H = homs[j](s - j), pre = pres[j];
      return (z) => { for (const h of pre) z = h(z); return H(z); };
    };
    if (n === 1) r.homTex = built[0].homTex || r.homTex;
    else {
      r.homTex = (v = 'z', o) => {
        const parts = built.map((b, j) => {
          const x = j ? `u_{${j}}` : v;
          const h = b.homTex ? b.homTex(x, o && o.sheets ? { sheets: true } : undefined) : null;
          return h && h.tex ? h.tex : $t('the straight-line homotopy $H_t(%{v})=(1-t)%{v}+t\\,%{F}(%{v})$', { v: x, F: 'f' });
        });
        return { tex: $t('the homotopy that runs its %{n} catalog steps in turn, each on an equal part of $0\\le t\\le 1$ ($u_j$: the point after step $j$): %{list}', { n: String(n), list: parts.join($t('; then ')) }) };
      };
    }
    r.nat = { kind: 'chain', n }; r.natData = null;
    // guarantees: those of the chain (a composition of the steps' guarantees), added to the formula's own
    const cp = composeProps(built.map((b) => b.props));
    for (const k of PROP_KEYS) if (cp[k]) r.props[k] = true;
    if (cp.rational && cp.degExact && cp.deg != null && !r.props.degExact) { r.props.deg = cp.deg; r.props.degExact = true; }
    // cuts and poles of the steps that the input plane sees: through the affine steps before them (a ray or a segment
    // stays one); the seam stays draggable when the steps before it only scale by a positive number and translate
    const cuts = [], poles = [];
    let a = C(1, 0), b0 = C(0, 0);
    for (const sb of built) {
      const back = (p) => CX.div(CX.sub(p, b0), a);
      for (const c of sb.cuts || []) {
        if (c.kind === 'ray') cuts.push({ kind: 'ray', p: back(c.p), ang: c.ang - CX.arg(a), editable: !!c.editable && a.im === 0 && a.re > 0 });
        else if (c.kind === 'seg') cuts.push({ kind: 'seg', a: back(c.a), b: back(c.b) });
      }
      for (const p of sb.poles || []) if (CX.isFin(p)) poles.push(back(p));
      const id = sb.def.id, v = sb.vals;
      if (id === 'mul') { a = CX.mul(v.c, a); b0 = CX.mul(v.c, b0); } else if (id === 'add') b0 = CX.add(b0, v.c);
      else if (id === 'affine') { a = CX.mul(v.a, a); b0 = CX.add(CX.mul(v.a, b0), v.b); } else break;
    }
    r.cuts = cuts; r.poles = poles;
    r.rec = { steps: rec.steps, built, partial: rec.partial, groups: rec.groups, ins: rec.ins, fc: rec.fc };
    // the Inspector's line: what the formula was read as, and what that gives
    let note;
    Object.defineProperty(r, 'recNote', {
      enumerable: false,
      get() {
        if (note !== undefined) return note;
        // one short clause, catalog names without parameter letters (review frperf-5)
        const chain = built.map(recLabel).join(' → ');
        note = rec.partial ? $t('Partly the same as {chain}', { chain }) : $t('Same as {chain}', { chain });
        return note;
      },
    });
  }

  // ---------------- a recognized formula as visible steps (src/formulasteps.js) ----------------
  const { shortCx, splitLabel, splitMorphT, splitMoves, splitNames, splitReason, splitRowsVar, splitStepTex, splitSteps, splitSubRows } = FormulaSteps({ DEFS, DEG, REC_CACHE_MAX, build, buildVals, mulLabel, recProbe });

  // ---------------- Calculus: d/dz, an operator on the chain so far ----------------
  // Stage maps G_k are functions of z: G_0(z) = z, G_k = f_k ∘ G_{k−1} for a map, G_k = (G_{k−1})′ for d/dz. A d/dz
  // step is not a map of w_{k−1}: f and the homotopy are NaN (callers use the stage functions, stageFunctions).
  const NAN_F = () => C(NaN, NaN);
  const plainVar = (s) => /^(?:z|w_\{?\d+\}?)$/.test(s);
  def({
    id: 'deriv', group: $t('Calculus'), label: 'd/dz', menuTex: '\\frac{d}{dz}', params: [], op: 'deriv',
    build() {
      return {
        op: 'deriv',
        f: NAN_F, hom: null,
        tex: (a) => (plainVar(a.s) ? { s: `\\frac{d${a.s === 'z' ? '' : ' '}${a.s}}{dz}`, p: 4 } : { s: `\\frac{d}{dz}\\left(${a.s}\\right)`, p: 3 }),
        props: Object.assign(props(), { deriv: true }),
        cuts: [], poles: [], domain: null,
        inverse: null,
        inverseNote: $t('d/dz differentiates the chain so far; it is not a map of w, so it has no inverse'),
      };
    },
  });

  const GROUPS = [$t('Linear & Möbius'), $t('Powers & roots'), $t('Exponential & log'), $t('Trigonometric'), $t('Inverse trigonometric'), $t('Special'), $t('Polynomial & custom'), $t('Calculus')];

  function defaults(type) {
    const d = DEFS[type];
    const p = {};
    for (const q of d.params) p[q.key] = q.def;
    return p;
  }

  // A composite formula is built by feeding each step's TeX into the next. A step that writes its argument twice
  // (Möbius, Joukowski, a polynomial) doubles the length, so a long chain grew without bound (60 steps of sin and
  // Möbius: a RangeError). Past TEX_CAP characters the next step stops composing: it passes the text on with a note
  // that the later steps are left out, marked .cut, and every later step passes it on unchanged (still longer than
  // the app's 700-character limit, so the app lists the steps one by one instead).
  const TEX_CAP = 6000;
  const NOTATION = I18N.lang !== 'en';
  const TEX_CUT_NOTE = $t('\\quad\\text{(truncated: the expanded formula is too long, so the later steps are left out)}');
  function capTex(tex) {
    return (a) => {
      if (a && a.cut) return a;
      if (a && typeof a.s === 'string' && a.s.length > TEX_CAP) return { s: a.s + TEX_CUT_NOTE, p: 0, cut: true };
      return tex(a);
    };
  }
  // Evaluate raw params and build. Returns built object or {error}.
  // A formula step's display form (params.show, TeX written in z): a short readable form the Inspector shows in place of
  // the expanded formula, for display only (the map, the field's text, the copied LaTeX and the export keep the formula).
  // It holds while the formula is the one it was written for: params.showOf = showKey(params.expr), FNV-1a (32 bits,
  // 8 hex digits) of the formula's text as UTF-16 code units, trimmed; an edited formula drops it, and Undo brings it back.
  function showKey(expr) {
    const s = String(expr == null ? '' : expr).trim();
    let x = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 0x01000193) >>> 0;
    return x.toString(16).padStart(8, '0');
  }
  // the display form in the step's own input (a = {s, p} as tex takes): each letter z outside control words and outside
  // \text-like groups becomes the input, in brackets unless it is an atom; the result counts as a sum (p 0)
  function showIn(tex, a) {
    const v = !a || a.s === 'z' ? 'z' : a.p >= 4 ? `{${a.s}}` : `\\left(${a.s}\\right)`;
    const s = v === 'z' ? tex : tex.replace(/\\(?:text|textit|textbf|mathrm|operatorname|mbox)\s*\{[^{}]*\}|\\[a-zA-Z]+|z/g, (m) => (m === 'z' ? v : m));
    return { s, p: 0 };
  }
  // (a link or a scene carries params.show as it was written, and MathJax typesets it as soon as it opens: a display
  // form that links, styles, names DOM nodes, loads extensions, defines macros or writes MathML is refused, and the
  // formula itself is shown)
  const SHOW_BAD = /\\(?:href|url|style|class|cssId|data|html|require|unicode|newcommand|renewcommand|newenvironment|renewenvironment|def|let|edef|gdef|mmlToken|tag|label|ref|eqref|begingroup|endgroup)(?![a-zA-Z])/;
  function withShow(b, p) {
    const t = p && typeof p.show === 'string' ? p.show.trim() : '';
    if (!t || !b || b.error || p.showOf !== showKey(p.expr) || SHOW_BAD.test(t)) return b;
    b.show = (a) => showIn(t, a);
    return b;
  }
  function build(step) {
    const d = DEFS[step.type];
    if (!d) return { error: $t('Unknown function {f}', { f: step.type }) };
    const v = {};
    try {
      for (const q of d.params) {
        const raw = step.params[q.key] ?? q.def;
        switch (q.type) {
          case 'cx': try { v[q.key] = keepName(raw, Expr.constValue(raw)); } catch (e) { throw new Error(`${q.label}: ${e.message}`); } break;
          case 'int': {
            const x = Math.round(Number(raw));
            if (!Number.isFinite(x)) throw new Error($t('{label} must be an integer', { label: q.label }));
            v[q.key] = Math.min(q.max ?? Infinity, Math.max(q.min ?? -Infinity, x));
            break;
          }
          case 'angle': { const x = Number(raw); if (!Number.isFinite(x)) throw new Error($t('{label} must be a number', { label: q.label })); v[q.key] = x; break; }
          case 'coeffs': try { v[q.key] = keepNames(raw, parseCoeffs(raw, typedHere(step, q.key, raw))); } catch (e) { throw new Error(`${q.label}: ${e.message}`); } break;
          case 'cxlist': try { v[q.key] = keepNames(raw, parseCxList(raw, typedHere(step, q.key, raw))); } catch (e) { throw new Error(`${q.label}: ${e.message}`); } break;
          default: v[q.key] = raw;
        }
      }
      const b = finish(d, v);
      return d.id === 'custom' ? withShow(b, step.params) : b;
    } catch (e) {
      return { error: e.message, def: d };
    }
  }
  // Build a step from parameter values already evaluated (complex numbers, numbers, coefficient arrays), as build gives
  // them to the definition: the steps of a recognized formula (recChain). Missing values take the defaults.
  function buildVals(type, vals) {
    const d = DEFS[type];
    if (!d) return { error: $t('Unknown function {f}', { f: type }) };
    try {
      const v = Object.assign({}, vals);
      for (const q of d.params) {
        if (v[q.key] !== undefined) continue;
        if (q.type === 'cx') v[q.key] = Expr.constValue(q.def);
        else if (q.type === 'coeffs') v[q.key] = parseCoeffs(q.def, false);
        else if (q.type === 'cxlist') v[q.key] = parseCxList(q.def, false);
        else v[q.key] = q.def;
      }
      return finish(d, v);
    } catch (e) {
      return { error: e.message, def: d };
    }
  }
  function finish(d, v) {
    {
      // a cut at θ + 360m on sheet k is the cut at θ on sheet k + m: normalise θ into (−180°, 180°] and carry the
      // turns into k, so (cut, k) names the evaluated branch uniquely and a θ outside that range keeps its values
      if (Number.isFinite(v.cut) && Number.isInteger(v.k)) {
        const m = Math.ceil((v.cut - 180) / 360);
        if (m) { v.cut -= 360 * m; v.k += m; }
        if (Number.isInteger(v.n) && d.id === 'root') { const n = Math.max(2, v.n); v.k = ((v.k % n) + n) % n; }
      }
      const b = d.build(v);
      if (typeof b.tex === 'function') b.tex = capTex(b.tex);
      // homotopy captions in the Russian interface: Russian notation (tg, sh, ln, arcth) in their math, at call time
      // (an English caption made under I18N.using('en') stays English). The generators stay English; English skips this.
      if (NOTATION && typeof b.homTex === 'function') { const h = b.homTex; b.homTex = (...a) => { const r = h(...a); return r && typeof r.tex === 'string' ? Object.assign({}, r, { tex: I18N.notation(r.tex) }) : r; }; }
      b.def = d;
      b.vals = v;
      b.cuts = b.cuts || [];
      b.poles = b.poles || [];
      return b;
    }
  }

  // B ∘ A for the props of two maps (A applied first)
  function compose2(A, B) {
    const r = props();
    for (const k of PROP_KEYS) r[k] = !!(A[k] && B[k]);
    r.constant = !!(A.constant || B.constant);
    if (r.rational && A.deg != null && B.deg != null) {
      r.deg = A.deg * B.deg;
      r.degExact = !!(A.degExact && B.degExact) || (r.deg === 0 && ((A.deg === 0 && !!A.degExact) || (B.deg === 0 && !!B.degExact)));
    }
    return r;
  }
  // What is guaranteed for F′ given what is guaranteed for F. Holomorphy (on the same domain), entire, rational and
  // polynomial carry over. A polynomial of degree d (exact or an upper bound) has a derivative of degree d − 1 (same
  // kind); a rational map of degree ≤ d has a derivative of degree ≤ 2d ((p′q − pq′)/q²); a constant's is 0. Proper
  // only for a polynomial of exact degree ≥ 2 (F′ then has exact degree ≥ 1), Möbius and injective only for exact
  // degree 2 (F′ is then az + b with a ≠ 0). Nothing else is claimed.
  function derivProps(P) {
    const r = props({ analytic: !!P.analytic, entire: !!P.entire, rational: !!P.rational, polynomial: !!P.polynomial });
    if (!r.analytic) return props(); // F′ of a map that is not holomorphic (z̄, |z|) is not a complex derivative
    const polyExact = r.polynomial && P.degExact && P.deg != null;
    if (P.constant || (polyExact && P.deg <= 1)) {
      r.constant = true;
      if (r.rational) { r.deg = 0; r.degExact = true; }
      return r;
    }
    if (r.polynomial && P.deg != null) { r.deg = Math.max(0, P.deg - 1); r.degExact = !!P.degExact; }
    else if (r.rational && P.deg != null) { r.deg = 2 * P.deg; r.degExact = false; }
    if (polyExact && P.deg >= 2) r.proper = true;
    if (polyExact && P.deg === 2) r.mobius = r.injective = true;
    return r;
  }
  // Props of the chain: a left fold over the active steps' props, a d/dz entry ({deriv: true}) mapping the props so
  // far to those of their derivative.
  function composeProps(list) {
    let acc = props(ALL);
    for (const p of list) acc = p && p.deriv ? derivProps(acc) : compose2(acc, p || props());
    return acc;
  }

  // ---------------- [issue #6] Repeat × N ----------------
  // step.repeat = {n, len} on the last step k of a block of len steps (k − len + 1 … k): the block runs n times. Its
  // last step is built as the block's tail: f_k, then the block n − 1 times more, so the chain's stages before k are
  // the first pass and w_k is after the last. It is drawn, deformed (copy by copy, each step on its own part of t),
  // inverted and continued onto sheets as the steps it runs, as a recognized formula is (b.rec); its guarantees are
  // those of the composition; d/dz after it uses the circle formula. At most REPEAT_MAX passes, and REPEAT_STEPS steps
  // weighed by the code they write into the GPU's program (the whole tail is one program: a heavy step many times is
  // minutes of compiling on Windows): a catalog step 1, Γ and ζ 16, a formula by the size of its tree.
  const REPEAT_MAX = 64, REPEAT_STEPS = 256;
  const astSize = (n) => (n && typeof n === 'object' && n.t ? 1 + ['a', 'b', 'n', 'lo', 'hi'].reduce((s, k) => s + astSize(n[k]), 0) : 0);
  const stepWeight = (b) => (b.rec ? b.rec.built.reduce((s, x) => s + stepWeight(x), 0) : b.def && (b.def.id === 'gamma' || b.def.id === 'zeta') ? 16
    : b.ast ? Math.max(1, Math.ceil(astSize(b.ast) / 8)) : 1);
  // repeat.by: N bound to a shared number (its value rounded, 1 … REPEAT_MAX); repeat.n is N otherwise, and the
  // value kept when the number is gone
  function repeatN(rp) {
    if (rp.by != null && typeof Expr.nameValue === 'function') {
      const v = Expr.nameValue(rp.by), re = v && typeof v === 'object' ? v.re : v;
      if (Number.isFinite(re)) return Math.min(REPEAT_MAX, Math.max(1, Math.round(re)));
    }
    return rp.n;
  }
  function repeatOk(steps, k) {
    const rp = steps[k - 1] && steps[k - 1].repeat;
    if (!rp || !Number.isInteger(rp.len) || rp.len < 1 || rp.len > k) return null;
    const n = repeatN(rp);
    return Number.isInteger(n) && n >= 1 ? (n === rp.n ? rp : Object.assign({}, rp, { n })) : null;
  }
  function repeatBuilt(steps, built, k) {
    const rp = repeatOk(steps, k), base = built[k - 1];
    if (!rp || rp.n === 1 || !base || base.error || steps[k - 1].on === false) return base;
    const a = k - rp.len + 1, block = [];
    for (let j = a; j <= k; j++) {
      const st = steps[j - 1], b = built[j - 1];
      if (!st || st.on === false || !b || b.error) continue;
      if (b.op === 'deriv' || st.type === 'deriv') return { error: $t('Repeat × N cannot hold a d/dz step'), def: base.def };
      block.push(b);
    }
    const w = block.reduce((s, b) => s + stepWeight(b), 0);
    if (w * rp.n > REPEAT_STEPS) return { error: $t('Repeat × N: this block is too heavy to draw {n} times; at most N = {max}', { n: rp.n, max: Math.max(1, Math.floor(REPEAT_STEPS / w)) }), def: base.def };
    const seq = [base];
    for (let r = 1; r < rp.n; r++) seq.push(...block);
    const fs = seq.map((b) => b.f), homs = seq.map((b) => b.hom || linHom(b.f)), m = seq.length;
    const f = (z) => { for (const g of fs) z = g(z); return z; };
    const names = block.length === 1 ? `f_{${k}}` : `\\left(f_{${k}}\\circ\\cdots\\circ f_{${a}}\\right)`;
    return {
      def: DEFS.custom, vals: { expr: '', cut: 180 }, repeat: { n: rp.n, len: rp.len, a, base, block },
      rec: { steps: seq.map((b) => ({ type: b.def.id })), built: seq },
      f,
      hom: (t) => {
        if (!(t > 0)) return (z) => z;
        if (t >= 1) return f;
        const x = t * m, j = Math.min(m - 1, Math.floor(x)), H = homs[j](x - j);
        return (z) => { for (let i = 0; i < j; i++) z = fs[i](z); return H(z); };
      },
      homTex: () => ({ tex: $t('the homotopy that runs the %{n} steps of the repeat in turn, each on an equal part of $0\\le t\\le 1$', { n: String(m) }) }),
      nat: { kind: 'chain', n: m }, natData: null,
      // (the whole count first, N passes of the block on the input, then the first pass written out: f^{∘N}(x) = f^{∘N-1}(f(x)))
      tex: capTex((x) => {
        const rest = rp.n === 2 ? names : `${names}^{\\circ ${rp.n - 1}}`;
        return { s: `${names}^{\\circ ${rp.n}}\\!\\left(${x && typeof x.s === 'string' ? x.s : 'z'}\\right)=${rest}\\!\\left(${base.tex(x).s}\\right)`, p: 4 };
      }),
      props: composeProps(seq.map((b) => b.props)),
      usesCut: seq.some((b) => b.usesCut),
      cuts: [], poles: [], domain: null, branchNote: null,
      inverse: null,
      inverseNote: $t('Repeated steps have no single inverse step; the exact renderer inverts them copy by copy when it can; {note}', { note: NOTE_PRE }),
    };
  }
  // the chain's built steps with every repeat applied (a copy; the others as they are)
  function applyRepeats(steps, built) {
    if (!steps.some((st) => st && st.repeat)) return built;
    return built.map((b, i) => (repeatOk(steps, i + 1) ? repeatBuilt(steps, built, i + 1) : b));
  }

  // ---------------- [#253] a shape's plane follows its step ----------------
  // A shape of plane k (the output of step k, k >= 1) belongs to the plane after that step: after the chain is edited
  // (old -> cur, the step objects), its plane is after the same step, wherever it went; when that step is gone (removed,
  // replaced, split into several), the plane before the first later step still in the chain (a removed step's input, a
  // replaced step's output, after the last of a split's steps), or the end of the chain. -> the new stage (0: z)
  function stageFollow(old, cur, k) {
    if (!(k >= 1)) return 0;
    const after = old[k - 1];
    if (!after) return Math.min(k, cur.length);
    const i = cur.indexOf(after);
    if (i >= 0) return i + 1;
    for (let p = k; p < old.length; p++) { const q = cur.indexOf(old[p]); if (q >= 0) return q; }
    return cur.length;
  }

  // ---------------- stage functions (CPU) ----------------
  const isLive = (steps, built, k) => {
    const st = steps[k - 1], b = built[k - 1];
    return !!st && st.on !== false && !!b && !b.error && !!b.def;
  };
  // f′ of one built step as a CPU function of its input, or null (no derivative is known)
  const derivFnCache = new WeakMap();
  function stepDerivFn(b) {
    if (b.repeat) return null;
    if (derivFnCache.has(b)) return derivFnCache.get(b);
    let f = null;
    const d = derivAst(b, { stable: true });
    if (!d.error) { try { f = Expr.compile(d.ast, { theta: d.cut * DEG }); } catch (e) { f = null; } }
    derivFnCache.set(b, f);
    return f;
  }
  // the 8th roots of unity, exactly as on the GPU
  const H2 = Math.SQRT1_2;
  const U8 = [C(1, 0), C(H2, H2), C(0, 1), C(-H2, H2), C(-1, 0), C(-H2, -H2), C(0, -1), C(H2, -H2)];
  // G′(z) by the circle formula (1/(N r)) Σ_j G(z + r ω^j) ω^{−j}, N = 8, r = rel (1 + |z|): the Cauchy integral by
  // the trapezoid rule, exact up to the Taylor terms of order 9, 17, ... (r⁸ a₉) and rounding (eps |G| / r)
  function circleAt(g, z, rel) {
    const r = rel * (1 + Math.hypot(z.re, z.im));
    let sr = 0, si = 0;
    for (const u of U8) {
      const w = g(C(z.re + r * u.re, z.im + r * u.im));
      sr += w.re * u.re + w.im * u.im; si += w.im * u.re - w.re * u.im;
    }
    return C(sr / (8 * r), si / (8 * r));
  }
  // radius of a circle formula whose input carries L − 1 circle formulas already (L = 1: an exact G)
  const CIRCLE_REL = 1e-3, CIRCLE_GROW = 4;
  const circleRel = (L) => CIRCLE_REL * Math.pow(CIRCLE_GROW, Math.max(0, L - 1));
  // Funcs.stageFunctions(steps, built) -> [G_0, ..., G_n], CPU functions of z: G_0(z) = z, G_k = f_k ∘ G_{k−1} for a
  // map, G_{k−1} itself for a bypassed or failed step, and G_k = G_{k−1}′ for a d/dz step: by the exact chain rule
  // Π f_j′(w_{j−1}) while no d/dz precedes (and every step has a known derivative), else by the circle formula.
  // G.levels[k] is the circle nesting level of stage k (0: exact). opts (for tests that model the GPU):
  // circleRel(L) replaces the radius rule, exact: false forbids the exact chain rule.
  function stageFunctions(steps, built, opts = {}) {
    const relOf = opts.circleRel || circleRel;
    /** @type {Array<(z: any) => any> & {levels?: number[]}} */
    const G = [(z) => z];
    const levels = [0];
    let seenD = false, L = 0;
    const pre = []; // live maps before the first d/dz
    for (let k = 1; k <= steps.length; k++) {
      const b = built[k - 1];
      if (!isLive(steps, built, k)) { G.push(G[k - 1]); levels.push(L); continue; }
      if (b.op === 'deriv') {
        const prev = G[k - 1];
        let g = null;
        if (!seenD && opts.exact !== false) {
          const ders = pre.map(stepDerivFn);
          if (ders.every(Boolean)) {
            const fs = pre.map((x) => x.f);
            g = (z) => {
              let D = C(1, 0);
              for (let j = 0; j < fs.length; j++) { D = CX.mul(D, ders[j](z)); z = fs[j](z); }
              return D;
            };
            L = 0;
          }
        }
        if (!g) { L += 1; const rel = relOf(L); g = (z) => circleAt(prev, z, rel); }
        seenD = true;
        G.push(g);
      } else {
        if (!seenD) pre.push(b);
        const prev = G[k - 1], f = b.f;
        G.push((z) => f(prev(z)));
      }
      levels.push(L);
    }
    G.levels = levels;
    return G;
  }

  // ---------------- whole Riemann surfaces and the deformation's sheets (src/sheets.js) ----------------
  const { SHEET_MAX, branchNode, sheetCombos, sheetCount, sheetCountOf, sheetEval, sheetHomOk, sheetMapCombos, sheetMapEval, sheetMapHow, sheetMapPieces, sheetSteps, stepSheets } = Sheets({ DEG, PI, circleAt, circleRel, isLive });

  return {
    DH_NMAX, DEFS, GROUPS, PROP_KEYS, defaults, build, buildVals, showKey, showIn, natData, ZOOM, ratZoomData, ratZoomAt, ratPath, polyNat, rationalNat, zerosPolesNat, monomialOf, ZP_MAX, splitList, parseCxList, typedList, typedKeep, zpItem, toZerosPoles, fromZerosPoles, mobHomTex, composeProps, derivProps, props, polyTex, numericPolyDegree, derivativeStep, derivAst,
    REPEAT_MAX, REPEAT_STEPS, repeatN, repeatOk, repeatBuilt, applyRepeats, stageFollow, stageFunctions, circleAt, circleRel, SHEET_MAX, sheetCount, sheetCountOf, branchNode, stepSheets, sheetSteps, sheetCombos, sheetEval, sheetMapHow, sheetHomOk, sheetMapPieces, sheetMapCombos, sheetMapEval,
    splitSteps, splitReason, splitLabel, splitStepTex, splitMorphT, splitRowsVar, splitSubRows, splitMoves, shortCx,
  };
})();
import { CX } from './cx.js';
import { Expr } from './parse.js';
import { Recognize } from './recognize.js';
import { Derivs } from './derivs.js';
import { NatPaths } from './natpaths.js';
import { Sheets } from './sheets.js';
import { FormulaSteps } from './formulasteps.js';
export { Funcs, Funcs as 'module.exports' };
