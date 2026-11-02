// @ts-check
'use strict';
// funcs.js's sheets: the whole Riemann surfaces (local cuts, every sheet: stepSheets, sheetEval) and the deformation's
// sheets (sheetMap*). Moved out of funcs.js (issue #20, the file-size budget) as a factory funcs.js calls where it
// stood, with the names of funcs.js it reads (each declared before the call); it returns the ones funcs.js exports
const Sheets = (host) => {
  const { DEG, PI, circleAt, circleRel, isLive } = host;
  const { C } = CX;
  const { joukAt, linHom, logHom, powHom, sc } = NatPaths;
  // ---------------- whole Riemann surfaces: local cuts, every sheet ----------------
  // Each multivalued piece (an n-th root, log, a complex power, a branch node of a custom formula) is evaluated with
  // a LOCAL cut opposite the cell centre zc (cut angle = arg of the piece's input at zc + 180°, so the cut never
  // crosses the cell) and on a chosen sheet. Over all sheets the union of the cells is the covering surface.
  const SHEET_MAX = 24;
  // (v16.1 review math-3) sheets are numbered from the step's own branch: Th = its cut (radians) + 2 pi k (its sheet k;
  // a formula's branch nodes: its cut, k = 0). Digit d on the local cut of a cell centred where the piece's input is c0
  // is local sheet d + sheetOff(c0, Th): the shift from the local range (arg c0 - pi, arg c0 + pi] to the step's
  // (cut - 2 pi, cut] plus k. So digit 0 is the step itself (F, or the plain H_t) on every cell the step's cut does not
  // cross, the seam between the drawn sheets lies along that cut, and a window k = -W..W is centred on the step's
  // branch. The default (cut 180 degrees, k = 0) gives 0 everywhere: as before. GPU twin: glsl.js, the same floor.
  const sheetOff = (c0, Th) => Math.floor((Th - Math.atan2(c0.im, c0.re)) / (2 * PI));
  const stepTh = (bb) => { const v = bb.vals || {}, cut = (v.cut ?? 180) * DEG, k = v.k | 0; if (bb.def.id === 'root') { const n = Math.max(2, v.n); return cut + 2 * PI * (((k % n) + n) % n); } return cut + 2 * PI * k; };
  // branches of z^s: q for a real s = p/q (q ≤ 24; 1 for an integer), 0 (infinitely many: a window) otherwise. The
  // same exact test as sheetCountOf (v16.1 review math-7: a typed 0.333333333 is 333333333/10^9, not 1/3, so it gets
  // a window, as its caption says, and not 3 surfaces under "all 3 sheets")
  function sheetCount(s) {
    if (typeof s === 'number') s = C(s, 0);
    if (!s || s.im !== 0 || !Number.isFinite(s.re)) return 0;
    const q = sheetCountOf(s);
    return q <= SHEET_MAX ? q : 0;
  }
  // (v16.1 user-5) the true number of branches of z^s, for the captions (sheetCount stops at 24, where the landscape
  // switches to a window): q for a real s that is exactly a fraction p/q in lowest terms with q <= 10^6 (a typed 0.123
  // is 123/1000: 1000 sheets), Infinity otherwise (a non-real s, sqrt 2, pi: no fraction with q <= 10^6 is the double)
  function sheetCountOf(s) {
    if (typeof s === 'number') s = C(s, 0);
    if (!s || s.im !== 0 || !Number.isFinite(s.re)) return Infinity;
    const x = Math.abs(s.re);
    let h0 = 0, h1 = 1, k0 = 1, k1 = 0, y = x;   // the convergents h/k of the continued fraction of x
    for (let i = 0; i < 64; i++) {
      const a = Math.floor(y), h = a * h1 + h0, k = a * k1 + k0;
      if (k > 1e6) break;
      if (h / k === x) return k;
      h0 = h1; h1 = h; k0 = k1; k1 = k;
      const f = y - a;
      if (!(f > 0)) break;
      y = 1 / f;
    }
    return Infinity;
  }
  const constOf = (n) => Expr.compile(n)(C(0, 0));
  // how a node of a custom formula depends on the branch: null (single-valued, as constants, integer powers and
  // c^{g(z)} with the principal log of c), else {kind, n} (n sheets, 0: infinitely many)
  function branchNode(n) {
    if (!Expr.depends(n)) return null;
    if (n.t === 'call' && n.f === 'log') return { kind: 'log', n: 0 };
    if (n.t === 'call' && n.f === 'sqrt') return { kind: 'sqrt', n: 2 };
    if (n.t === 'root') { const s = CX.div(CX.ONE, constOf(n.n)); return { kind: 'root', s, n: sheetCount(s) }; }
    if (n.t === 'pow') {
      if (!Expr.depends(n.b)) {
        const v = constOf(n.b);
        if (v.im === 0 && Number.isInteger(v.re) && Math.abs(v.re) <= 4096) return null;
        return { kind: 'powc', v, n: sheetCount(v) };
      }
      if (!Expr.depends(n.a)) return null;
      return { kind: 'powv', n: 0 };
    }
    return null;
  }
  // pair evaluator of a custom formula for the sheet view: f(c, w, S) -> [value at c, value at w], every branch node
  // on the local cut opposite its input at c and on sheet S[i] (i: the node's index in evaluation order, children
  // first, a before b). Mirrors Expr.compile node by node. nodes: [{kind, n}].
  function pairCompile(ast, theta) {
    const nodes = [];
    const cutOf = (c) => Math.atan2(c.im, c.re) + PI;
    function go(n) {
      if (!Expr.depends(n)) { const v = constOf(n); return () => [v, v]; }
      switch (n.t) {
        case 'var': { const f = Expr.compile(n); return (c, w) => [f(c), f(w)]; }
        case 'neg': { const A = go(n.a); return (c, w, S) => { const a = A(c, w, S); return [CX.neg(a[0]), CX.neg(a[1])]; }; }
        case 'add': case 'sub': case 'mul': case 'div': {
          const A = go(n.a), B = go(n.b), op = CX[n.t];
          return (c, w, S) => { const a = A(c, w, S), b = B(c, w, S); return [op(a[0], b[0]), op(a[1], b[1])]; };
        }
        case 'pow': {
          const bn = branchNode(n);
          if (!Expr.depends(n.b)) {
            const A = go(n.a);
            if (!bn) { const k = constOf(n.b).re; return (c, w, S) => { const a = A(c, w, S); return [CX.ipow(a[0], k), CX.ipow(a[1], k)]; }; }
            const i = nodes.push(bn) - 1, v = bn.v;
            return (c, w, S) => { const a = A(c, w, S), th = cutOf(a[0]), s = S[i] + sheetOff(a[0], theta); return [CX.pow(a[0], v, th, s), CX.pow(a[1], v, th, s)]; };
          }
          if (!Expr.depends(n.a)) {
            const B = go(n.b), base = constOf(n.a);
            if (base.re === Math.E && base.im === 0) return (c, w, S) => { const b = B(c, w, S); return [CX.exp(b[0]), CX.exp(b[1])]; };
            const Lg = CX.log(base);
            return (c, w, S) => { const b = B(c, w, S); return [CX.exp(CX.mul(b[0], Lg)), CX.exp(CX.mul(b[1], Lg))]; };
          }
          const A = go(n.a), B = go(n.b);
          const i = nodes.push(bn) - 1;
          return (c, w, S) => { const a = A(c, w, S), b = B(c, w, S), th = cutOf(a[0]), s = S[i] + sheetOff(a[0], theta); return [CX.pow(a[0], b[0], th, s), CX.pow(a[1], b[1], th, s)]; };
        }
        case 'root': {
          const A = go(n.a), bn = branchNode(n), i = nodes.push(bn) - 1, s1 = bn.s;
          return (c, w, S) => { const a = A(c, w, S), th = cutOf(a[0]), s = S[i] + sheetOff(a[0], theta); return [CX.pow(a[0], s1, th, s), CX.pow(a[1], s1, th, s)]; };
        }
        case 'call': {
          const A = go(n.a);
          if (n.f === 'log' || n.f === 'sqrt') {
            const i = nodes.push(branchNode(n)) - 1, lg = n.f === 'log';
            return (c, w, S) => {
              const a = A(c, w, S), th = cutOf(a[0]), s = S[i] + sheetOff(a[0], theta);
              return lg ? [CX.log(a[0], th, s), CX.log(a[1], th, s)] : [CX.powReal(a[0], 0.5, th, s), CX.powReal(a[1], 0.5, th, s)];
            };
          }
          const F = Expr.compile({ t: 'call', f: n.f, a: { t: 'var', n: 'z' } }, { theta });
          return (c, w, S) => { const a = A(c, w, S); return [F(a[0]), F(a[1])]; };
        }
      }
      throw new Error($t("Cannot evaluate '{x}'", { x: n.t }));
    }
    const f = go(ast);
    return { f, nodes };
  }
  const pairCache = new WeakMap();
  function pairOf(b) {
    if (!pairCache.has(b)) pairCache.set(b, pairCompile(b.ast || Expr.parse(b.vals.expr), b.vals.cut * DEG));
    return pairCache.get(b);
  }
  // the multivalued pieces of one built step, in the order their sheet digits are read: [{n, of}] (n sheets, 0: a
  // window of 2W + 1 sheets, 1: single-valued after all, e.g. an integer exponent; of: the piece's own number of
  // sheets, Infinity for log, so a caption can say "k = -2, ..., 2 of infinitely many" or "of 30": v16.1 user-5)
  const nodeOf = (x) => (x.kind === 'sqrt' ? 2 : x.kind === 'root' ? sheetCountOf(x.s) : x.kind === 'powc' ? sheetCountOf(x.v) : Infinity);
  function stepSheets(b) {
    if (!b || b.error || !b.def || b.op === 'deriv') return [];
    const id = b.def.id, v = b.vals;
    if (id === 'root') { const n = Math.max(2, v.n); return [{ n: n <= SHEET_MAX ? n : 0, of: n }]; }
    if (id === 'powa') return [{ n: sheetCount(v.alpha), of: sheetCountOf(v.alpha) }];
    if (id === 'log') return [{ n: 0, of: Infinity }];
    // a recognized formula: the pieces of its steps, in order (as the catalog chain)
    if (id === 'custom' && b.rec) return b.rec.built.flatMap(stepSheets);
    if (id === 'custom') { try { return pairOf(b).nodes.map((x) => ({ n: x.n, of: nodeOf(x) })); } catch (e) { return []; } }
    return [];
  }
  // Funcs.sheetSteps(steps, built) -> [{k, n, node}]: the multivalued pieces of the live steps (n sheets, 0 for
  // infinitely many); node is the index of the branch node within a custom formula (0 otherwise)
  function sheetSteps(steps, built) {
    const out = [];
    for (let k = 1; k <= steps.length; k++) {
      if (!isLive(steps, built, k)) continue;
      stepSheets(built[k - 1]).forEach((e, node) => { if (e.n !== 1) out.push({ k, n: e.n, node }); });
    }
    return out;
  }
  // number of surfaces of the steps in (a, b] with window W: the product of the sheet counts (2W + 1 for an infinite
  // one); cap: at most SHEET_MAX (pass Infinity for the raw product)
  function sheetCombos(steps, built, W = 2, b = steps.length, cap = SHEET_MAX, a = 0) {
    let p = 1;
    for (const e of sheetSteps(steps, built)) if (e.k > a && e.k <= b) p *= e.n > 0 ? e.n : 2 * W + 1;
    return Math.min(p, cap);
  }
  // one built step on the pair [value at the cell centre, value at the point], every multivalued piece on the local cut
  // opposite its input at the centre and on its sheet s[i] (the step's pieces in stepSheets order)
  function stepPair(bb, pr, s) {
    const id = bb.def.id;
    const c0 = pr[0], w0 = pr[1];
    if (id === 'custom' && bb.rec) {
      let i = 0;
      for (const sb of bb.rec.built) { const m = stepSheets(sb).length; pr = stepPair(sb, pr, s.slice(i, i + m)); i += m; }
      return pr;
    }
    if (id === 'root' || id === 'powa' || id === 'log') {
      const th = Math.atan2(c0.im, c0.re) + PI, sh = s[0] + sheetOff(c0, stepTh(bb));
      if (id === 'root') { const e = 1 / Math.max(2, bb.vals.n); return [CX.powReal(c0, e, th, sh), CX.powReal(w0, e, th, sh)]; }
      if (id === 'powa') { const a = bb.vals.alpha; return [CX.pow(c0, a, th, sh), CX.pow(w0, a, th, sh)]; }
      return [CX.log(c0, th, sh), CX.log(w0, th, sh)];
    }
    if (id === 'custom') return pairOf(bb).f(c0, w0, s);
    return [bb.f(c0), bb.f(w0)];
  }
  // Funcs.sheetEval(steps, built, b, zc, z, combo, W) -> G_b(z) on surface number combo of the cell centred at zc.
  // combo is read as mixed-radix digits, lowest first, one per multivalued piece of the live steps 1..b in chain
  // order (sheetSteps; within a custom formula in evaluation order): radix n for n sheets (sheet = digit), 2W + 1 for
  // infinitely many (sheet = digit − W). A d/dz step differentiates the stage before it on the same surface by the
  // circle formula. Mirrored on the GPU by chainSheet. opts.a > 0: the steps in (a, b] only, z and zc points of the
  // w_a-plane, digits for their pieces only (GPU: chainSheetRange); NaN when a d/dz lies in (a, b].
  function sheetEval(steps, built, b, zc, z, combo = 0, W = 2, opts = {}) {
    const relOf = opts.circleRel || circleRel;
    b = Math.max(0, Math.min(b | 0, steps.length));
    const a0 = Math.max(0, Math.min(opts.a | 0, b));
    const S = [];
    let c = Math.max(0, Math.floor(+combo || 0));
    if (a0 > 0) for (let k = a0 + 1; k <= b; k++) if (isLive(steps, built, k) && built[k - 1].op === 'deriv') return C(NaN, NaN);
    for (let k = a0 + 1; k <= b; k++) {
      if (!isLive(steps, built, k)) continue;
      S[k] = stepSheets(built[k - 1]).map((e) => {
        const r = e.n > 0 ? e.n : 2 * W + 1;
        const d = c % r;
        c = Math.floor(c / r);
        return e.n > 0 ? d : d - W;
      });
    }
    // circle levels of the d/dz steps (every d/dz is a circle formula here)
    const lev = [];
    let L = 0;
    for (let k = 1; k <= b; k++) if (isLive(steps, built, k) && built[k - 1].op === 'deriv') lev[k] = ++L;
    const step = (k, pr) => stepPair(built[k - 1], pr, S[k]);
    function stage(k, zc0, z0) {
      let p = 0;
      for (let j = k; j >= 1; j--) if (isLive(steps, built, j) && built[j - 1].op === 'deriv') { p = j; break; }
      let pr;
      if (!p) pr = [zc0, z0];
      else {
        const rel = relOf(lev[p]);
        const g = (t) => stage(p - 1, zc0, t)[1];
        pr = [circleAt(g, zc0, rel), circleAt(g, z0, rel)];
      }
      for (let j = p + 1; j <= k; j++) if (isLive(steps, built, j)) pr = step(j, pr);
      return pr;
    }
    if (a0 > 0) {
      let pr = [zc, z];
      for (let k = a0 + 1; k <= b; k++) if (isLive(steps, built, k)) pr = step(k, pr);
      return pr[1];
    }
    return stage(b, zc, z)[1];
  }

  // ---------------- the deformation's sheets (notes/v16-user5/SHEETS-DESIGN.md) ----------------
  // H_t on the sheets that become F's: every multivalued piece keeps the digit it has in F's surfaces (sheetEval) and
  // its path runs on that sheet, with the local cut opposite its input at the cell centre. GPU twin: chainSheetHom.
  // How a deformation map applies step k: 0 not at all, 1 in full, 2 its path at t. Map mode 1 (step hi at t): the
  // steps (base, hi) in full, hi at t; mode 3 (all at once): (base, a] in full, (a, b] at t; both: the post (b, post]
  // in full when post > b (homrange.js state / cpuMap). The steps of the bracket not begun are not applied.
  function sheetMapHow(map, k) {
    const mode = map.mode || 0, base = map.base || 0, a = map.a || 0, hi = map.hi || 0, b = map.b || 0, post = map.post || 0;
    if (mode === 1) { if (k > base && k < hi) return 1; if (k === hi) return 2; }
    else if (mode === 3) { if (k > base && k <= a) return 1; if (k > a && k <= b) return 2; }
    if (post > b && k > b && k <= post) return 1;
    return 0;
  }
  // the step's path has a form on every sheet: a single-valued step (its own path on both points), a root, a power,
  // log, and a formula recognised as such steps (a formula with branch points otherwise follows a zoom or a straight
  // line of its principal value: no sheet form)
  function sheetHomOk(b) {
    if (!b || b.error || !b.def || b.op === 'deriv') return false;
    const id = b.def.id;
    if (id === 'root' || id === 'powa' || id === 'log') return true;
    if (id === 'custom' && b.rec) return b.rec.built.every(sheetHomOk);
    return !stepSheets(b).some((e) => e.n !== 1);
  }
  // Funcs.sheetMapPieces(steps, built, map, end) -> [{k, n, node, how}]: the multivalued pieces a deformation map (mode 1
  // or 3) applies, in digit order (n sheets, 0: a window of 2W + 1), or null when the map cannot be drawn as sheets (a
  // d/dz among its steps, a path at t with no sheet form, another mode). end > 0 (F's last step: the landscape passes
  // it, v16.1 review math-5): the digits are F's, read for every live step in (base, end] in chain order, and a step
  // the map does not apply yet (how 0) keeps its digits without acting, so surface c is F's surface c at every t (no
  // re-indexing when a step begins, no surface that vanishes at a node) and the count is F's
  function sheetMapPieces(steps, built, map, end = 0) {
    const mode = (map && map.mode) || 0;
    if (mode !== 1 && mode !== 3) return null;
    const out = [], base = map.base || 0;
    for (let k = 1; k <= steps.length; k++) {
      if (!isLive(steps, built, k)) continue;
      const how = sheetMapHow(map, k);
      if (!how && !(k > base && k <= end)) continue;
      const b = built[k - 1];
      if (b.op === 'deriv') return null;
      if (how === 2 && !sheetHomOk(b)) return null;
      stepSheets(b).forEach((e, node) => { if (e.n !== 1) out.push({ k, n: e.n, node, how }); });
    }
    return out;
  }
  // the number of surfaces of a deformation map with window W (capped at SHEET_MAX; Infinity for the raw product), 0
  // when it cannot be drawn as sheets; end: as sheetMapPieces (F's count)
  function sheetMapCombos(steps, built, map, W = 2, cap = SHEET_MAX, end = 0) {
    const ps = sheetMapPieces(steps, built, map, end);
    if (!ps) return 0;
    let p = 1;
    for (const e of ps) p *= e.n > 0 ? e.n : 2 * W + 1;
    return Math.min(p, cap);
  }
  // a step's path at 0 < t < 1 on the pair, its pieces on the sheets s (stepPair's order): roots and powers z^s with
  // s = 1 + (alpha - 1)t, log (z^u - 1)/u + u with u = 1 - t (powHom, logHom: the step's own paths, here on the local
  // cut and sheet), a recognised formula its steps' paths in turn (step j on [j/n, (j+1)/n], asChain), any other step
  // its own path (single-valued, sheetHomOk)
  function homPair(bb, pr, s, t) {
    const id = bb.def.id, c0 = pr[0], w0 = pr[1];
    if (id === 'custom' && bb.rec) {
      const subs = bb.rec.built, n = subs.length, x = t * n, j = Math.min(n - 1, Math.floor(x));
      let i = 0;
      for (let q = 0; q < n; q++) {
        const sb = subs[q], m = stepSheets(sb).length, ss = s.slice(i, i + m);
        i += m;
        if (q < j) pr = stepPair(sb, pr, ss);
        else if (q === j && x - j > 0) pr = homPair(sb, pr, ss, x - j);
      }
      return pr;
    }
    if (id === 'root' || id === 'powa' || id === 'log') {
      const th = Math.atan2(c0.im, c0.re) + PI, sh = s[0] + sheetOff(c0, stepTh(bb));
      const H = id === 'log' ? logHom(th, sh)(t) : powHom(id === 'root' ? C(1 / Math.max(2, bb.vals.n), 0) : bb.vals.alpha, th, sh)(t);
      return [H(c0), H(w0)];
    }
    const H = bb.hom ? bb.hom(t) : linHom(bb.f)(t);
    return [H(c0), H(w0)];
  }
  // a top-level step's path with a cut of its own at 0 < t < 1 (z^n: z^(1 + (n - 1)t), and the power path of a
  // (z - c)^n): on the local cut opposite its input at the cell centre c0, sheet 0; the Joukowski path: the formula of
  // c0's side of the unit circle for every z. The landscape so finds that cut by continuation (GPU: the step's _hc in
  // chainSheetHom); null for any other step
  function localCutHom(bb, c0, t) {
    if (!(t > 0 && t < 1) || !bb || !bb.def) return null;
    if (bb.def.id === 'pown') {
      const n = bb.vals.n, th = Math.atan2(c0.im, c0.re) + PI;
      if (n >= 0) return powHom(C(n, 0), th, 0)(t);
      return t < 0.5 ? powHom(C(-n, 0), th, 0)(2 * t) : null;
    }
    if (bb.nat && bb.nat.kind === 'jouk') {
      const J = joukAt(t, c0.re * c0.re + c0.im * c0.im < 1), lc = bb.nat.scaled && bb.natData ? bb.natData.lc : null;
      if (!lc) return J;
      const k = CX.exp(sc(lc, t));
      return (z) => CX.mul(k, J(z));
    }
    const d = bb.nat && bb.nat.kind === 'pow' ? bb.natData : null;
    if (!d) return null;
    const { la, c, n } = d, u = CX.sub(c0, c), th = Math.atan2(u.im, u.re) + PI, e = C(1 + (n - 1) * t, 0), k = CX.exp(sc(la, t));
    return (z) => CX.add(sc(c, 1 - t), CX.mul(k, CX.pow(CX.sub(z, c), e, th, 0)));
  }
  // Funcs.sheetMapEval(steps, built, map, zc, z, combo, W, end) -> H_t(z) on surface number combo of the cell centred
  // at zc, for a deformation map (mode 1 or 3; mode 0: sheetEval of the steps (a, b]). combo's mixed-radix digits,
  // lowest first, are read for the pieces the map applies (sheetMapPieces), as sheetEval reads F's: at t = 1 every step
  // is in full and the surfaces are F's, combo for combo; at t = 0 the path is the identity on every sheet. end > 0:
  // F's digits (every live step in (base, end]; a step not begun reads its digits and does not act), so surface c is
  // F's surface c at every t. NaN when the map cannot be drawn as sheets.
  function sheetMapEval(steps, built, map, zc, z, combo = 0, W = 2, end = 0) {
    const mode = (map && map.mode) || 0;
    if (mode !== 1 && mode !== 3) return sheetEval(steps, built, (map && map.b) || 0, zc, z, combo, W, { a: (map && map.a) || 0 });
    if (!sheetMapPieces(steps, built, map, end)) return C(NaN, NaN);
    const t = Math.max(0, Math.min(1, +map.t || 0)), base = map.base || 0;
    let c = Math.max(0, Math.floor(+combo || 0)), pr = [zc, z];
    for (let k = 1; k <= steps.length; k++) {
      if (!isLive(steps, built, k)) continue;
      const how = sheetMapHow(map, k);
      if (!how && !(k > base && k <= end)) continue;
      const b = built[k - 1];
      const s = stepSheets(b).map((e) => {
        const r = e.n > 0 ? e.n : 2 * W + 1, d = c % r;
        c = Math.floor(c / r);
        return e.n > 0 ? d : d - W;
      });
      if (!how) continue;
      if (how === 1 || t >= 1) pr = stepPair(b, pr, s);
      else if (t > 0) { const lc = localCutHom(b, pr[0], t); pr = lc ? [lc(pr[0]), lc(pr[1])] : homPair(b, pr, s, t); }
    }
    return pr[1];
  }
  return { SHEET_MAX, branchNode, sheetCombos, sheetCount, sheetCountOf, sheetEval, sheetHomOk, sheetMapCombos, sheetMapEval, sheetMapHow, sheetMapPieces, sheetSteps, stepSheets };
};
import { CX } from './cx.js';
import { Expr } from './parse.js';
import { NatPaths } from './natpaths.js';
export { Sheets };
