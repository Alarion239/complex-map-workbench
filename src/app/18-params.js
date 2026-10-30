  // ---------------- init ----------------
  // ---------------- v15: shared numbers, links and scene files (src/params.js; constructions/DESIGN.md 1) ----------------
  // A step's text fields keep the names (Funcs.build reads them through the parser's name scope); a shape's field that
  // holds names keeps its text in s.bind[key] and its value in the field itself (s.expr: the text with the values
  // written in), so the renderers and every cache keyed by a shape see plain values.
  // ([#241] seq: a series' a_n, a recurrence's u_0 and rule, whose bound letters, n and u, are never names)
  const FX_TYPES = ['cx', 'coeffs', 'cxlist', 'expr', 'seq'];
  // the text fields of a step: [key, text, {bound}] (the third: the options of Params.namesIn for that field)
  function stepTexts(st) {
    const d = Funcs.DEFS[st.type], out = [];
    if (!d) return out;
    for (const q of d.params) if (FX_TYPES.includes(q.type) && typeof st.params[q.key] === 'string') out.push([q.key, st.params[q.key], { bound: q.bound || [] }]);
    return out;
  }
  // [#240] the letters the chain's steps bind (a recurrence's u): not new numbers while it holds them
  const chainBinds = () => [...new Set(S.steps.flatMap((st) => { const d = Funcs.DEFS[st.type]; return d ? d.params.flatMap((q) => q.bound || []) : []; }))];
  // the names a step's fields use, with their values: part of the chain signature, so every cache keyed by it (cards,
  // fits, paths) sees a new value; the GPU programs keep their structure (the values are uniforms)
  function paramSig(st) {
    if (!S.params || !S.params.length) return '';
    let out = '';
    for (const [, v, o] of stepTexts(st)) for (const nm of Params.namesIn(v, o)) { const c = Params.getC(nm); out += `;${nm}=${c && c.im ? Params.reprC(c) : Params.get(nm)}`; }
    // ([issue #6] Repeat × N's N bound to a number: its value is the number of passes)
    if (st.repeat && st.repeat.by) out += `;${st.repeat.by}=${Params.get(st.repeat.by)}`;
    return out;
  }
  const stepUses = (st, names) => stepTexts(st).some(([, v, o]) => Params.namesIn(v, o).some((n) => names.has(n))) || !!(st.repeat && st.repeat.by && names.has(st.repeat.by));
  function bindField(s, key, text) {
    if (Params.namesIn(text).length) (s.bind || (s.bind = {}))[key] = String(text).trim();
    else if (s.bind && key in s.bind) { delete s.bind[key]; if (!Object.keys(s.bind).length) delete s.bind; }
  }
  function setExprBind(s, text) {
    bindField(s, 'expr', text);
    s.expr = s.bind && s.bind.expr ? Params.resolve(text) : text;
  }
  // the bound fields of shape s again (only those that use one of names, all when names is null): true if one changed.
  // A value outside the field's range (a radius ≤ 0) or a formula with no value makes the shape undefined (review
  // math-2): s.undef says why, the shape is not drawn (hidden; s.undefHid remembers that the rule hid it), and it comes
  // back as soon as the numbers give a valid value again. So the picture never depends on how a slider moved.
  const BIND_LIM = { r: [1e-9, Infinity], r1: [0, Infinity], r2: [0, Infinity], n: [1, 60, 1], nc: [1, 60, 1], nr: [1, 60, 1] };
  function applyBinds(s, names) {
    if (!s.bind) { if (s.undef) { delete s.undef; if (s.undefHid && !s.cHid) s.visible = true; delete s.undefHid; return true; } return false; }
    let ch = false, bad = null;
    const fv = (x) => CX.fmtNum(x, 4).replace(/-/g, '−');
    for (const [key, src] of Object.entries(s.bind)) {
      const touched = !names || Params.namesIn(src).some((n) => names.has(n));
      try {
        if (key === 'expr') { if (!touched) continue; Expr.checkRealSides(Expr.parse(src, { allowRel: true })); const r = Params.resolve(src); if (r !== s.expr) { s.expr = r; ch = true; } continue; }
        if (Array.isArray(s[key])) {
          const v = Expr.constValue(src);
          if (!CX.isFin(v)) { bad = bad || $t('{x} has no value here', { x: src }); continue; }
          if (touched && (v.re !== s[key][0] || v.im !== s[key][1])) { s[key] = [v.re, v.im]; ch = true; }
          continue;
        }
        let x = Params.evalReal(src);
        const lim = BIND_LIM[key];
        if (lim) {
          if (lim[2]) x = Math.round(x);
          const lo = key === 'r' && s.kind === 'sector' ? 0 : lim[0];
          if (!(x >= lo && x <= lim[1])) {
            const why = lim[2] ? $t('a count is a whole number from 1 to 60') : key === 'r' && lo > 0 ? $t('a radius must be positive') : $t('radii must be 0 or more');
            bad = bad || `${key.replace(/^r([12])$/, (m, d) => 'r' + sub(+d))} = ${src} = ${fv(x)}: ${why}`;
            continue;
          }
        }
        if (touched && x !== s[key]) { s[key] = x; ch = true; }
      } catch (e) { bad = bad || (e && e.message) || $t('{x} has no value here', { x: src }); }
    }
    // ([#299 review] an equipotential of the Julia set of a bound c: a c that lifts the critical level to the curve's
    // level or past it leaves no curve, and says so as any value out of range does)
    if (!bad && s.kind === 'dheq' && Array.isArray(s.c)) {
      const rho = CX.dhCritRho(C(s.c[0], s.c[1]), 64);
      if (!(s.r > rho)) bad = $t('The level |Φ| must be more than {r} here (the critical level of this c)', { r: CX.fmtNum(rho, 4) });
    }
    if (bad) {
      if (s.undef !== bad) { if (!s.undef && (s.visible !== false || s.cHid)) { s.visible = false; s.undefHid = true; } s.undef = bad; ch = true; }
    } else if (s.undef) { delete s.undef; if (s.undefHid && !s.cHid) s.visible = true; delete s.undefHid; ch = true; }
    return ch;
  }
  // the shared number a field of shape s is exactly (a point bound to a: bind.p = 'a'), or '': dragging that point moves
  // the number, and the point is named after it
  function boundNumber(s, key = 'p') {
    const t = s && s.bind && s.bind[key];
    if (typeof t !== 'string') return '';
    const nm = Params.namesIn(t)[0];
    return nm && Params.resolve(t, { [nm]: 0 }) === '(0)' && Params.getC(nm) ? nm : '';
  }
  // a point on the plane that shows the number nm (its position bound to it); the add is one undo step
  function addNumberPoint(nm) {
    const c = Params.getC(nm);
    if (!c) return null;
    const s = newShape('point', { p: [c.re, c.im], bind: { p: nm } });
    addShape(s);
    return s;
  }
  const numberPoint = (nm) => S.shapes.find((s) => s.kind === 'point' && boundNumber(s) === nm) || null;
  // the first name for a new number that the name field would accept: a, b, c, …
  function freeNumberName() {
    for (const c of 'abcdfghjklmnpqstuv'.split('').concat('αβγδεζηθικλμνξπρστυφχψω'.split(''))) { if (!Params.check(c).error) return c; }
    return '';
  }
  // the plane menu's "New complex number here": a number at z and its point, one undo step
  function newNumberHere(z) {
    const nm = freeNumberName();
    if (!nm) { toast($t('There is no free name left for a number.')); return null; }
    Params.add(nm, { value: { re: z.re, im: z.im } });
    addNumberPoint(nm);
    undoToast($t('Added the complex number {x}', { x: Params.display(nm) }));
    return nm;
  }
  // every bound field and every number by formula from the numbers' current values (review math-3: a state, a link or a
  // scene opens with its formulas as the truth; the stored values are only a cache)
  function bindsAll() {
    if (!S) return;
    try { Params.recompute(); } catch (e) { /* a cycle keeps the stored values */ }
    for (const x of S.shapes.concat(S.targets || [])) { try { applyBinds(x, null); } catch (e) { /* */ } }
  }

