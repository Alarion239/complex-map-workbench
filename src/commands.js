'use strict';
// The command palette (Ctrl+K, /, the + of the chain): search over functions, steps, tools, examples, settings and the
// guide, with a live preview of the region under a candidate step (issue #20, phase 3: moved out of app.js). The app
// hands it what it needs once, Commands.init(api) at start-up (src/app/12-command-palette.js, commandsApi): its
// functions and constants as they are, and the state it reassigns (S, built, selected, ...) as getters on api, read
// as A.S and so on. The popover layer (popEl, closePalette) stays the app's: the palette is one of its popovers.
const Commands = (() => {
  let A = null;
  let palState = null;
  let C, EX, FT_WORD, HR, ICONS, PAL_NAMES, REGION_EXAMPLES, SUB, TOOLS, TeX, activeSteps, addCurveShapes, addShape,
    addStep, addSteps, armOutside, chooseRange, circleDeriv, closePalette, copyFigureLink, copyText, curvePlan,
    defOf, derivativeAction, enOf, exOk, exThumbs, fUni, focusBack, focusKey, fsub, intLabel, integrateSelected,
    integrateShape, inverseAction, isDerivStep, kindType, lLand, latexDocument, leftStage, loadExample, morph,
    morphOn, nSteps, newShape, openGallery, openGuide, pickLang, pickScene, recentTypes, renumberPoints, renumberZp,
    replaceSteps, robustBox, saveScene, lsk, selOf, setFocus, setHomAll, setMain, setMorphPaths, setPalette, setPanels, setTheme,
    setTool, setView, shapeGPU, shapeInk, shapeKey, shapeNames, sndExportDone, soundHear, soundMode, soundStop, soundToggle,
    stageF, sub, toast, toggleAlone, toggleTransport, tourEmit, viewBox;
  const FN_INFO = {
    mul: [$t('Rotation and scaling; conformal on ℂ'), $t('scale rotate rotation multiply dilation')],
    add: [$t('Translation; conformal on ℂ'), $t('translate shift move')],
    affine: [$t('Rotate, scale and shift; conformal on ℂ'), $t('linear affine')],
    recip: [$t('A rotation of the Riemann sphere; circles to circles'), $t('inverse reciprocal inversion 1/z')],
    mobius: [$t('Circles to circles; ad − bc ≠ 0'), $t('mobius möbius fractional linear cayley bilinear')],
    blaschke: [$t('Automorphism of the unit disk'), $t('disk automorphism blaschke')],
    pown: [$t('n-fold cover of ℂ ∖ {0}; angles multiply by n'), $t('power square cube z^2 z^3')],
    root: [$t('Branch of the n-th root with a movable cut'), $t('sqrt root square root cube root nth root')],
    powa: [$t('z^α on a chosen branch'), $t('complex power exponent')],
    exp: [$t('Conformal on ℂ; injective on strips of height 2π'), $t('exponential e^z')],
    log: [$t('Branch of the logarithm with a movable cut'), $t('logarithm ln log')],
    sin: [$t('Half-strip to half-plane'), 'sine'], cos: [$t('Half-strip to half-plane'), 'cosine'], tan: [$t('Strip to the slit sphere'), 'tangent'],
    sinh: [$t('Rotated sine'), $t('hyperbolic sine')], cosh: [$t('Rotated cosine'), $t('hyperbolic cosine')], tanh: [$t('Rotated tangent'), $t('hyperbolic tangent')],
    arcsin: [$t('Principal branch; cuts on the real axis beyond ±1'), $t('asin inverse sine')], arccos: [$t('Principal branch; cuts on the real axis beyond ±1'), $t('acos inverse cosine')], arctan: [$t('Principal branch; cuts on the imaginary axis beyond ±i'), $t('atan inverse tangent')],
    arsinh: [$t('Principal branch'), 'asinh'], arcosh: [$t('Principal branch'), 'acosh'], artanh: [$t('Principal branch'), 'atanh'],
    joukowski: [$t('Circles through ±1 to airfoils'), $t('joukowski joukowsky airfoil')],
    ijouk: [$t('Branch of the inverse Joukowski map'), $t('inverse joukowski joukowsky')],
    // [issue #4] (the aliases are searched in every language: the Greek letters and the plain names too)
    gamma: [$t('Meromorphic; poles at 0, −1, −2, …; Γ(n + 1) = n!'), $t('gamma Γ factorial euler special function')],
    zeta: [$t('Meromorphic; a pole at 1; its nontrivial zeros lie on the critical strip'), $t('zeta ζ riemann critical strip primes special function')],
    series: [$t('A power, Laurent or Dirichlet series from its coefficients aₙ; drawn where it converges'), $t('series sum power series taylor laurent dirichlet coefficients sigma Σ')],
    recurrence: [$t('z ↦ u_N, from u₀ by the rule u ↦ g(u, z) N times: Mandelbrot and Julia iterations, Newton’s method'), $t('recurrence iterate iteration orbit mandelbrot julia newton fixed point sequence u_n')],
    // [issue #260]
    dh: [$t('The conformal map of the outside of the Mandelbrot set onto the outside of the unit disk; its external rays and equipotentials'), $t('douady hubbard mandelbrot riemann map external ray equipotential bottcher Φ phi')],
    bottcher: [$t('φ_c: the conformal map of the basin of ∞ of z² + c onto the outside of a disk; external rays of the Julia set'), $t('bottcher böttcher julia basin external ray equipotential filled julia set φ phi')],
    conj: [$t('Reflection in the real axis; not analytic'), $t('conjugate reflection bar conj')],
    poly: [$t('Coefficients from the highest degree down'), 'polynomial'],
    rational: [$t('Quotient of two polynomials'), $t('rational p/q')],
    zp: [$t('Drag its zeros and poles in the input plane'), $t('zeros poles roots factored polynomial rational drag place')],
    custom: [$t('Any formula in LaTeX or plain text'), $t('custom formula latex expression')],
    deriv: [$t('Derivative of the chain so far: w = (previous stage)′'), $t('derivative differentiate prime d/dz dz derivative of the chain')],
  };
  // [issue #260] the external rays and equipotentials of the chain's first Φ_M or φ_c step (its Inspector fields)
  function dhActs() {
    const k = A.S.steps.findIndex((st) => st.on !== false && (st.type === 'dh' || st.type === 'bottcher')) + 1;
    if (!k) return [];
    return [
      [$t('Add an external ray to f{x}…', { x: sub(k) }), () => A.dhFocusAdd(k, 'dhray'), '', $t('external ray, ray, angle, landing point, douady, hubbard, mandelbrot, julia, bottcher')],
      [$t('Add an equipotential to f{x}…', { x: sub(k) }), () => A.dhFocusAdd(k, 'dheq'), '', $t('equipotential, level curve, potential, green function, douady, hubbard, mandelbrot, julia, bottcher')],
    ];
  }
  const defaultPropsCache = new Map();
  function defaultProps(type) {
    if (!defaultPropsCache.has(type)) {
      const b = Funcs.build({ type, params: Funcs.defaults(type), on: true });
      defaultPropsCache.set(type, b && !b.error ? b.props : {});
    }
    return defaultPropsCache.get(type);
  }
  // v16.5 UX29: the palette on a phone: Cancel at the right of the search row (it had no visible way out), and the
  // insert position a chip on its own row: a tap moves the new step's place along the chain (at the start, after f₁,
  // …, at the end), the chip saying where. (D1, issue #23: the Replace chip, when there is one, comes first on that row,
  // and the position chip shows only while the choice is Insert)
  function phonePalette(pop, input, opener, okey, where) {
    const head = pop.querySelector('.pal-head'), ctx = head && head.querySelector('.pal-ctx');
    if (!head) return;
    head.append(h('button', { class: 'pal-cancel', type: 'button', onclick: () => { closePalette(); focusBack(opener, okey); } }, $t('Cancel')));
    const n = A.S.steps.length;
    if (!ctx || !palState || n < 1) return;
    const at0 = palState;
    const label = (at) => (at <= 0 ? $t('Insert at the start') : at >= n ? $t('Insert at the end') : $t('Insert after f{x}', { x: sub(at) }));
    // (a press keeps the focus, and the phone's keyboard, in the search field)
    const chip = h('button', { class: 'pal-at', type: 'button', onpointerdown: (e) => e.preventDefault(), onmousedown: (e) => e.preventDefault() });
    const paint = () => {
      const t = label(palState.at);
      chip.innerHTML = t.replace(/f([₀-₉]+)/, (m, d) => `<i>f</i><sub>${[...d].map((c) => SUB.indexOf(c)).join('')}</sub>`) + `<span class="pal-at-ic" aria-hidden="true">${ICONS.chevR || '›'}</span>`;
      chip.setAttribute('aria-label', $t('Where the new step goes: {place}. Tap to move it', { place: t }));
    };
    chip.addEventListener('click', () => {
      if (!palState || palState !== at0) return;
      const at = (palState.at + 1) % (n + 1);
      palState.at = at; palState.before = Math.max(0, at - 1);
      paint();
      if (palState.render) palState.render();
      if (document.activeElement !== input) input.focus({ preventScroll: true });
    });
    paint();
    ctx.remove();
    head.after(h('div', { class: 'pal-atrow' }, where || '', chip));
    palState.atChip = chip;
    chip.hidden = palState.mode !== 'insert';
  }
  function paletteItems(q, fnOnly) {
    q = Expr.typed(q.trim());
    const ql = q.toLowerCase();
    const items = /** @type {any[] & { oneType?: string, parseErr?: string, parseErrPos?: number }} */ ([]);
    const score = (text) => (I18N.lang === 'en' || !ql ? score1(text) : Math.max(score1(text), score1(enOf(text))));
    const score1 = (text) => {
      if (!ql) return 1;
      const t = text.toLowerCase();
      if (t.startsWith(ql)) return 3;
      if (t.split(/[\s/,;()]+/).some((w) => w.startsWith(ql))) return 2;
      return t.includes(ql) ? 1 : 0;
    };
    // a formula typed into the search becomes a custom step (or a region, for a relation)
    // (a function's own name, such as d/dz, is not read as a formula)
    if (q && /[z(\\^|<>]/.test(q) && !Object.values(Funcs.DEFS).some((d) => String(d.label).toLowerCase() === ql)) {
      try {
        const ast = Expr.parse(q, { allowRel: true });
        if (Expr.hasBool(ast)) {
          const dm = !fnOnly ? Curves.dimOf(ast) : { dim: 'area' };
          if (dm.dim === 'error') throw new Error(dm.error);
          if (!fnOnly && dm.dim === 'curve') {
            // an equation: a curve in the z-plane (the app's own shapes when recognized exactly)
            const plan = curvePlan(q, viewBox(A.S.srcView));
            items.push({ kind: 'region', group: 'Curve formulas', tex: Expr.toTex(ast).s, label: $t('Add this curve'), desc: $t('Adds {what} in the z-plane', { what: plan.what }), q: q.replace(/\s+/g, ''), run: () => { if (leftStage() > 0) setFocus(0); addCurveShapes(plan, false); } });
          } else if (!fnOnly) { Expr.compileLevel(ast); items.push({ kind: 'region', group: 'Region formulas', tex: Expr.toTex(ast).s, label: $t('Add this shape'), desc: $t('A set in the z-plane'), q: q.replace(/\s+/g, ''), run: () => { if (leftStage() > 0) setFocus(0); A.shapeVia = 'formula'; try { addShape(newShape('formula', { expr: q })); } finally { A.shapeVia = null; } } }); }
        } else if (Expr.depends(ast) && [...Expr.usesVars(ast)].every((v) => v === 'z')) {
          const cst = { type: 'custom', params: { expr: q, cut: 180 }, on: true };
          const cb = Funcs.build(cst);
          const formula = { kind: 'fn', type: 'custom', params: { expr: q }, group: 'Custom formula', tex: `f(z)=${Expr.toTex(ast).s}`, label: $t('Formula'), desc: cb.error ? cb.error : $t('Adds this formula as a step'), props: cb.error ? {} : cb.props, run: (at) => addStep('custom', { expr: q }, at) };
          // v15.2 (notes/formula-steps/DESIGN.md 4): a query that reads as exactly one catalog step is that step, with its
          // parameters written from the query, listed first (Enter adds it); the formula is the second choice. A query
          // of several steps keeps the formula first and offers it as those steps second.
          const sp = cb.error ? null : Funcs.splitSteps(cst, cb);
          if (sp && sp.kind === 'one' && !sp.blocked && sp.rows) {
            const s0 = sp.steps[0], d0 = Funcs.DEFS[s0.type], p0 = Object.assign(Funcs.defaults(s0.type), s0.params);
            const b0 = Funcs.build({ type: s0.type, params: p0, on: true });
            items.oneType = s0.type;
            items.push({ kind: 'fn', type: s0.type, params: p0, group: d0.group, tex: `f(z)=${sp.rows[1].tex}`, label: d0.label, desc: (FN_INFO[s0.type] || [''])[0], props: b0.error ? {} : b0.props, one: true, run: (at) => addStep(s0.type, p0, at) });
            items.push(formula);
          } else if (sp && sp.kind === 'many' && !sp.blocked && sp.rows) {
            const n = sp.steps.length;
            items.push(formula, { kind: 'fn', type: 'custom', params: { expr: q }, group: 'Custom formula', tex: formula.tex, label: $tn('Add as {n} step', 'Add as {n} steps', n, { n }), desc: sp.names.join(' → '), props: formula.props, rows: sp.rows, run: (at) => addSteps(sp.steps, at) });
          } else items.push(formula);
        }
      } catch (e) {
        // (v16.5 UX16: one new letter, "z^2 + a", is a row like any other: the formula with a new number a = 1, added
        // together as one undo step; the region box and the Inspector's fields already work this way)
        const nc = e.unknown && e.unknown.length === 1 ? Params.check(e.unknown[0]) : null;
        let row = null;
        if (nc && !nc.error) {
          try {
            const a2 = withNewName(nc.name, () => Expr.parse(q, { allowRel: true }));
            if (!Expr.hasBool(a2) && Expr.depends(a2) && [...Expr.usesVars(a2)].every((v) => v === 'z')) {
              const x = Params.display(nc.name);
              row = { kind: 'fn', type: 'custom', params: { expr: q }, newName: nc.name, group: 'Custom formula', tex: `f(z)=${Expr.toTex(a2).s}`, label: $t('Formula, with a new number {x} = 1', { x }), desc: $t('Adds the number {x} and the step; one Undo removes both', { x }), props: {},
                run: (at) => { Params.add(nc.name); return addStep('custom', { expr: q }, at, { msg: (k) => $t('Added f{k} Formula and the number {x}.', { k: sub(k), x }) }); } };
              items.push(row);
            }
          } catch (e2) { /* not a formula with that number either: the parser's message below */ }
        }
        // (v16.5 UX23: the message, where it went wrong, and the repairs that read as a formula)
        if (!row) { items.parseErr = e.message; items.parseErrPos = e.pos; for (const f of formulaFixes(q)) items.push({ kind: 'fix', group: $t('Fix the formula'), label: f.label, fixTo: f.t, run: () => null }); }
      }
    }
    const fnItem = (d, group, sc) => {
      const [desc] = FN_INFO[d.id] || [''];
      return { kind: 'fn', type: d.id, group, tex: d.menuTex, label: d.label, desc, sc, props: defaultProps(d.id), run: (at) => addStep(d.id, null, at) };
    };
    if (!ql) for (const t of recentTypes()) items.push(fnItem(Funcs.DEFS[t], $t('Recently used'), 1));
    const fns = [];
    for (const g of Funcs.GROUPS) {
      for (const d of Object.values(Funcs.DEFS).filter((x) => x.group === g)) {
        const [desc, alias] = FN_INFO[d.id] || ['', ''];
        const ls = score(d.label);
        const sc = Math.max(ls ? ls + 1 : 0, score(alias), score(d.id), ql && score(desc) ? 0.5 : 0);
        if (ql && sc < 0.5) continue;
        fns.push(fnItem(d, g, sc));
      }
    }
    // d/dz: an operator on the chain so far, listed even when its group is not one of the function groups
    const dd = Funcs.DEFS.deriv;
    if (dd && !Funcs.GROUPS.includes(dd.group)) {
      const [desc, alias] = FN_INFO.deriv;
      const sc = Math.max(score(dd.label) ? score(dd.label) + 1 : 0, score(alias), score('deriv'), ql && score(desc) ? 0.5 : 0);
      if (!ql || sc >= 0.5) fns.push(fnItem(dd, 'Calculus', sc));
    }
    if (ql) fns.sort((a, b) => b.sc - a.sc);
    // (no two Sine rows: the one-step reading of the query is the catalog row of that type)
    items.push(...(items.oneType ? fns.filter((x) => x.type !== items.oneType) : fns));
    if (!fnOnly) {
      const typed = items.find((x) => x.kind === 'region');
      for (const c of REGION_EXAMPLES) if ((!ql || score(c)) && !(typed && typed.q === c.replace(/\s+/g, ''))) items.push({ kind: 'region', group: 'Region formulas', tex: c, label: $t('Add shape'), desc: '', run: () => { if (leftStage() > 0) setFocus(0); A.shapeVia = 'formula'; try { addShape(newShape('formula', { expr: c })); } finally { A.shapeVia = null; } } });
      EX.forEach((ex, i) => { if (!exOk(ex) || (ql && i === 0)) return; /* (v16.5 UX03: searched, the empty canvas is the New command) */ if (!ql || score(ex.name.replace(/\\[a-z]+/g, ' ')) || score(ex.blurb || '')) items.push({ kind: 'ex', i, group: $t('Examples'), tex: ex.tex || '', label: ex.name.replace(/\$/g, ''), desc: ex.blurb || '', run: () => loadExample(i) }); });
      // every step's inverse and derivative (a d/dz step has neither)
      A.S.steps.forEach((st, i) => {
        const k = i + 1, nm = defOf(st).label;
        if (isDerivStep(st, A.built[i])) return;
        for (const [inv, run] of [[true, () => inverseAction(k)], [false, () => derivativeAction(k)]]) {
          const label = inv ? $t('Inverse of f{k} ({nm})', { k: sub(k), nm }) : $t('Derivative of f{k} ({nm})', { k: sub(k), nm });
          const plain = inv ? $t('Inverse of f{k} {nm}', { k, nm }) : $t('Derivative of f{k} {nm}', { k, nm });
          if (!ql || score(plain) || score(label) || score($t('replace'))) items.push({ kind: 'cmd', group: $t('Steps'), label, key: '', run });
        }
      });
      // the views are also found by what they are for (roots, contour integrals, …)
      // (U8: the panes' views, with the words of the earlier single view control as aliases)
      // (comma-separated phrases, each matched on its own: a query that starts a phrase scores 3, one that starts a
      // word 2, so multi-word aliases such as 'phase portrait' and 'domain colouring' are found)
      const VIEW_ALIAS = {
        xy: $t('x to y, x -> y, split, both planes, domain and image, shapes and images, planes'),
        lplane: $t('left plane, domain, z-plane, shapes, regions'), lsphere: $t('left sphere, riemann sphere, globe, infinity, domain sphere, z-sphere, phase sphere'),
        land: $t('left landscape, landscape, 3d, surface, riemann surface, modulus surface, height, relief, sheets'),
        phase: $t('phase portrait, domain colouring, domain coloring, colouring, coloring, color, colour, phase, argument, modulus, left phase'),
        rplane: $t('right plane, image, image plane, map, targets, preimages, w-plane'), rsphere: $t('right sphere, riemann sphere, globe, infinity, image sphere, w-sphere'),
      };
      const aliasScore = (alias) => Math.max(0, ...alias.split(',').map((p) => score(p.trim())));
      const view = [
        [$t('View: X → Y'), () => setMain('xy'), '1', VIEW_ALIAS.xy],
        [$t('View: Phase portrait'), () => setMain('phase'), '2', VIEW_ALIAS.phase],
        [$t('View: Landscape'), () => setMain('land'), '3', VIEW_ALIAS.land],
        [A.S.view.main === 'phase' ? $t('Phase: Plane') : $t('X: Plane'), () => { if (lLand()) setMain('xy'); setView('L', 'plane'); }, lLand() ? '' : '⇧1', VIEW_ALIAS.lplane],
        [A.S.view.main === 'phase' ? $t('Phase: Sphere') : $t('X: Sphere'), () => { if (lLand()) setMain('xy'); setView('L', 'sphere'); }, lLand() ? '' : '⇧2', VIEW_ALIAS.lsphere],
        [$t('Y: Plane'), () => { setMain('xy'); setView('R', 'plane'); }, A.S.view.main === 'xy' ? '⇧3' : '', VIEW_ALIAS.rplane],
        [$t('Y: Sphere'), () => { setMain('xy'); setView('R', 'sphere'); }, A.S.view.main === 'xy' ? '⇧4' : '', VIEW_ALIAS.rsphere],
        [morph.open ? $t('Deformation off') : $t('Deformation on (play the homotopy)'), () => toggleTransport(), 'M', $t('morph deformation homotopy animate animation merge')],
        [A.S.morphPaths !== false ? $t('Deformation: hide the paths t ↦ H_t(z)') : $t('Deformation: show the paths t ↦ H_t(z)'), () => setMorphPaths(!(A.S.morphPaths !== false)), morphOn() && A.S.view.main === 'xy' ? 'P' : '', $t('paths trajectories arrows homotopy deformation lines')],
        [A.S.homAll ? $t('Deformation: the steps one after another') : $t('Deformation: all steps at once'), () => setHomAll(!A.S.homAll), '', $t('deformation order steps simultaneous together sequence homotopy at once')],
        // (v16: the bracket for the selected step, else the last; SPEC 6.5)
        ...(activeSteps().length >= 2 ? (() => {
          const k = Number.isInteger(A.S.sel) && A.S.sel >= 1 && A.S.sel <= nSteps() ? A.S.sel : nSteps(), n = nSteps();
          const al = $t('part range bracket pullback pull-back precompose push-forward inside under outer inner') + ', ' + 'part range bracket pullback pull-back precompose push-forward inside under outer inner';
          return [[$t('Deformation: only {f}, inside F', { f: fUni(k) }), () => chooseRange(HR.normal(k, k)), '', al],
            [$t('Deformation: steps {f1}–{f2}', { f1: fUni(k), f2: fUni(n) }), () => chooseRange(HR.normal(k, n)), '', al],
            [$t('Deformation: steps {f1}–{f2}', { f1: fUni(1), f2: fUni(k) }), () => chooseRange(HR.normal(1, k)), '', al],
            [$t('Deformation: every step'), () => chooseRange(null), '', al]];
        })() : []),
        ...integrateRows(),
        [$t('Show the roots: a target at 0'), () => { if (A.S.targets.some((t) => t.visible !== false && t.kind === 'point' && t.p[0] === 0 && t.p[1] === 0)) return; addShape(newShape('point', { p: [0, 0] }, true), true); }, '', $t('roots zeros poles solve solutions equation preimages target')],
        ...(Funcs.DEFS.deriv ? [[$t('Derivative of the chain: add d/dz'), () => addStep('deriv', null, A.S.focus > 0 ? A.S.focus : A.S.steps.length), '', $t('derivative prime differentiate d/dz')]] : []),
        [$t('Fit both planes'), () => /** @type {any} */ ($('leftFit').click()) || $('rightFit').click(), 'Z'],
        [$t('Unit circle on or off'), () => $('unitChk').click(), ''],
        [$t('Snap to grid and figures on or off'), () => $('snapBtn').click(), ''],
        [$t('Switch theme'), () => $('themeBtn').click(), ''],
        ...(ql ? Palette.LIST.map(([id]) => [$t('Phase colours: {name}', { name: PAL_NAMES()[id][0] }), () => setPalette(id), '', 'palette, colours, colors, цвета, палитра, colori, arb, chrome']) : []),
        [$t('Draw panel'), () => setPanels(!A.S.hideLeft, A.S.hideRight), '['],
        [$t('Inspector panel'), () => setPanels(A.S.hideLeft, !A.S.hideRight), ']'],
        // (the language names carry their own lang for a screen reader, as in the menu: verify-7)
        ...(ql ? [[$t('Language: {name}', { name: $t('Auto') }), () => pickLang('auto'), '', 'language, язык, lingua, russian, русский, english, английский, italian, italiano'], [$t('Language: {name}', { name: 'English' }), () => pickLang('en'), '', 'language, язык, lingua, english, английский, inglese', () => I18N.parts('Language: {name}', { name: h('span', { lang: 'en' }, 'English') })], [$t('Language: {name}', { name: 'Русский' }), () => pickLang('ru'), '', 'language, язык, lingua, russian, русский, russo', () => I18N.parts('Language: {name}', { name: h('span', { lang: 'ru' }, 'Русский') })], [$t('Language: {name}', { name: 'Italiano' }), () => pickLang('it'), '', 'language, язык, lingua, italian, итальянский, italiano', () => I18N.parts('Language: {name}', { name: h('span', { lang: 'it' }, 'Italiano') })]] : []),
      ];
      for (const [label, run, key, alias, labelParts] of view) if (!ql || score(label) || (alias && aliasScore(alias) >= 2)) items.push(labelParts ? { kind: 'cmd', group: $t('View'), label, key, run, labelParts } : { kind: 'cmd', group: $t('View'), label, key, run });
      const acts = [
        [$t('Undo'), () => $('undoBtn').click(), '⌘Z'],
        [$t('Redo'), () => $('redoBtn').click(), '⇧⌘Z'],
        [$t('Clear chain'), () => $('clearChain').click(), ''],
        [$t('Clear all shapes and targets'), () => $('clearShapes').click(), ''],
        // ([UX54] names are kept when others are deleted: these make them tidy again)
        [$t('Renumber points'), () => renumberPoints(), '', $t('renumber, rename, numbers, names, points, tidy'), 1],
        [$t('Renumber zeros and poles'), () => renumberZp(), '', $t('renumber, rename, numbers, names, zeros, poles, tidy'), 1],
        [$t('Open the guide'), () => openGuide(), '?', $t('help, guide, manual, documentation, docs, reference, how to')],
        // (v16.5 UX03: the header's and the menus' commands, listed when searched, each with its key)
        [$t('Export figure…'), () => Figure.open(), /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘E' : 'Ctrl E', $t('export, png, pdf, svg, picture, image, save image, download, print, video, movie'), 1],
        [$t('Copy LaTeX with guarantees'), () => { copyText(latexDocument()); toast($t('LaTeX copied: the map, its natural domain and its guarantees.')); sndExportDone(); }, '', $t('latex, tex, overleaf, copy formula, guarantees'), 1],
        [$t('Copy link to this figure'), () => { copyFigureLink(); }, '', $t('link, share, url, copy link, send'), 1],
        [$t('Save scene (.cmw.json)'), () => { saveScene(); }, '', $t('save, scene, file, download, keep'), 1],
        [$t('Open scene…'), () => { pickScene(); }, '', $t('open, load, scene, file, import'), 1],
        [$t('New: empty canvas'), () => loadExample(0), '', $t('new, empty, blank, reset, start over, clear all, fresh'), 1],
        [$t('Examples…'), () => { const b = $('examplesBtn'); openGallery(b && b.getClientRects().length ? b : $('cmdBtn')); }, '', $t('example, examples, gallery, demo, samples'), 1],
        [$t('Theme: {name}', { name: $t('Dark') }), () => setTheme('dark'), '', $t('dark, night, black, theme'), 1],
        [$t('Theme: {name}', { name: $t('Light') }), () => setTheme('light'), '', $t('light, day, white, theme'), 1],
        [$t('Theme: {name}', { name: $t('Auto') }), () => setTheme('auto'), '', $t('auto, system, theme'), 1],
        [$t('Keyboard shortcuts'), () => openGuideAt($t('Keys')), '?', $t('keys, shortcuts, keyboard, hotkeys'), 1],
        ...(Number.isInteger(selOf()) && selOf() > 0 && A.S.focus !== selOf() ? [[$t('Show f{x} alone', { x: sub(selOf()) }), () => toggleAlone(selOf()), 'L', $t('alone, solo, isolate, only, show alone, step alone'), 1]] : []),
        ...(A.S.focus > 0 ? [[$t('Show F'), () => setFocus(0), '', $t('show f, whole chain, all steps, back, alone'), 1]] : []),
        [$t('Sound on/off'), () => soundToggle(), '⇧M'],
        [$t('Hear the function on/off'), () => soundHear(), ''],
        ...(Sound.hear ? [[$t('Hear the function: notes'), () => soundMode(false), ''], [$t('Hear the function: glide'), () => soundMode(true), '']] : []),
        [$t('Stop sound'), () => soundStop(), 'Esc'],
        ...Tour.chapters().map((c) => [$t('Tour: {title}', { title: $t(c.title) }), () => Tour.start({ chapter: c.id }), '']),
        ...Construct.paletteActs(),   // (v16: the four tools; Make free, Use complement)
        ...dhActs(),
      ];
      for (const [label, run, key, alias, searched] of acts) if (!ql ? !searched : score(label) || (alias && aliasScore(alias) >= 2)) items.push({ kind: 'cmd', group: $t('Actions'), label, key, run });
      // (v16.5 UX03: the drawing tools, with their keys, and the guide's sections, found by what they are for)
      if (ql) {
        for (const [id, label, key, , group] of TOOLS) {
          if (group === 'construct') continue;   // (Construct.paletteActs lists those)
          const lab = $t('Tool: {name}', { name: label }), al = TOOL_ALIAS()[id];
          if (score(label) >= 2 || score(lab) >= 2 || (al && aliasScore(al) >= 2)) items.push({ kind: 'cmd', group: $t('Tools'), label: lab, key, run: () => setTool(id) });
        }
        for (const [t, al] of GUIDE_SECS()) {
          const lab = $t('Guide: {title}', { title: t });
          if (score(t) >= 2 || aliasScore(al) >= 2) items.push({ kind: 'cmd', group: $t('Guide'), label: lab, key: '', run: () => openGuideAt(t) });
        }
      }
      // (a plain word that names a command more than a function lists the commands first)
      if (ql && !/[()^\\|<>+\-*/=0-9]/.test(q) && !items.some((x) => x.kind === 'fn' && (x.sc || 0) >= 2)) {
        const cmds = items.filter((x) => x.kind === 'cmd'), rest = items.filter((x) => x.kind !== 'cmd');
        items.length = 0; items.push(...cmds, ...rest);
      }
    }
    return items;
  }
  // (v16.5 UX03) the words people use for the drawing tools and the guide's sections (translated: Russian finds them too)
  const TOOL_ALIAS = () => ({
    select: $t('select, move, pointer, arrow, pan'), point: $t('point, dot, mark'), segment: $t('segment, line segment'), line: $t('line, straight line'),
    ray: $t('ray, half-line'), circle: $t('circle, round curve'), arc: $t('arc, circular arc'), curve: $t('freehand, pen, sketch, curve'),
    disc: $t('disc, disk, circle, round region'), rect: $t('rectangle, box, square'), polygon: $t('polygon, triangle'), lasso: $t('lasso, freehand region'),
    halfplane: $t('half-plane, half plane'), annulus: $t('annulus, ring, donut'), sector: $t('sector, wedge, pie'), formula: $t('formula, region formula, set, equation'),
    cgrid: $t('grid, grid lines'), pgrid: $t('polar grid, rays and circles'),
  });
  const GUIDE_SECS = () => [
    [$t('Shapes'), $t('region, regions, shape, shapes, draw, set')], [$t('Function chain'), $t('chain, step, steps, card, cards, add function, insert, move, reorder, alone')],
    [$t('Numbers'), $t('number, numbers, parameter, parameters, slider, letter')], [$t('Branch cuts'), $t('cut, cuts, branch, sheet, sheets, seam')],
    [$t('The planes\' menu'), $t('right-click, menu, long-press, zero, zeros, pole, poles, add zero')], [$t('Views'), $t('view, views, phase, landscape, sphere, plane')],
    [$t('Deformation'), $t('deformation, homotopy, morph, animate, play')], [$t('Preimages and roots'), $t('preimage, preimages, root, roots, solve, target')],
    [$t('Inverses and derivatives'), $t('inverse, derivative, replace')], [$t('Integrals'), $t('integral, integrate, residue, contour, winding')],
    [$t('Sound'), $t('sound, audio, listen, hear, music')], [$t('Guarantees'), $t('guarantee, guarantees, property, conformal, injective, analytic')],
    [$t('Keys'), $t('keys, shortcuts, keyboard, hotkeys, help')],
  ];
  // (v16.5 UX03) a guide section found in the palette: the guide opens at its heading
  function openGuideAt(sec) {
    openGuide();
    const m = document.querySelector('.modal-bg .modal');
    const hd = m && [...m.querySelectorAll('h3')].find((x) => x.textContent.trim() === sec);
    if (hd) hd.scrollIntoView({ block: 'start' });
  }
  // (v16.5 UX16) parse with one more number, name = 1, as if it were already added (the palette's row and preview)
  function withNewName(name, fn) {
    if (typeof Expr.setNames !== 'function') return fn();
    Expr.setNames({ get: (n) => (n === name ? 1 : Params.read(n)), display: Params.display });
    try { return fn(); } finally { Params.install(); }
  }
  // (v16.5 UX23) the repairs of a formula that does not parse, each offered only when the repaired text reads as a step
  // or a set: close the brackets, drop a trailing operator, one operator for a doubled one, the nearest function name
  const FIX_FN = ['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'sinh', 'cosh', 'tanh', 'coth', 'exp', 'log', 'ln', 'sqrt', 'abs', 'arg', 'conj', 'arcsin', 'arccos', 'arctan', 'arsinh', 'arcosh', 'artanh', 'Re', 'Im'];
  function editDist(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);   // two letters swapped: one slip ("sni")
    }
    return d[a.length][b.length];
  }
  function formulaFixes(q) {
    const out = [], seen = new Set([q]);
    const reads = (t) => { try { const a = Expr.parse(t, { allowRel: true }); return Expr.hasBool(a) || (Expr.depends(a) && [...Expr.usesVars(a)].every((v) => v === 'z')); } catch (e) { return false; } };
    const offer = (label, t) => { if (t && !seen.has(t) && reads(t)) { seen.add(t); out.push({ label, t }); } };
    const open = (q.match(/\(/g) || []).length - (q.match(/\)/g) || []).length;
    if (open > 0) { const t = q + ')'.repeat(open); offer($t('Close the bracket: {f}', { f: t }), t); }
    const cut = q.replace(/[\s+\-*/^·,]+$/, '');
    if (cut !== q) offer($t('Drop the trailing {x}: {f}', { x: q.slice(cut.length).trim(), f: cut }), cut);
    const one = q.replace(/([+\-*/^])(\s*\1)+/g, '$1');
    if (one !== q) offer($t('Did you mean {f}?', { f: one }), one);
    const named = q.replace(/(^|[^\\A-Za-z])([A-Za-z]{2,})/g, (m, pre, w) => {
      if (FIX_FN.includes(w) || /^z+$/i.test(w) || w === 'pi') return m;
      let best = null, bd = w.length > 4 ? 3 : 2;
      for (const f of FIX_FN) { const dd = editDist(w.toLowerCase(), f.toLowerCase()); if (dd < bd) { bd = dd; best = f; } }
      return best ? pre + best : m;
    });
    if (named !== q) offer($t('Did you mean {f}?', { f: named }), named);
    return out.slice(0, 3);
  }
  // (v16.5 UX82) the strongest properties of a palette row, in words, on the highlighted row only (like the F tile)
  function propWords(P) {
    if (!P) return '';
    const words = Object.assign({}, P, { homeo: P.injective, conformal: P.analytic && P.injective }), W = FT_WORD();
    return Inspector.STRONG.filter((key) => words[key]).slice(0, 2).map((key) => W[key]).join(' · ');
  }
  // the palette's integrals: the selected curve's, else one row per curve to pick from (never a curve picked for you)
  function integrateRows() {
    const ok = (x) => x.visible !== false && kindType(x) !== 'point' && x.kind !== 'cgrid' && x.kind !== 'pgrid';
    const al = $t('contour line integral integrate residue residues winding number argument principle cauchy');
    const sel = A.S.shapes.find((x) => x.id === A.selected && ok(x));
    const list = sel ? [sel] : A.S.shapes.filter(ok).slice(0, 6);
    if (!list.length) return [[$t('Integrate along a curve'), () => integrateSelected(), '', al]];
    const names = shapeNames();
    return list.map((x) => [intLabel(x, names), () => integrateShape(x.id), '', al + ', ' + (names.get(x.id) || '')]);
  }
  // (D1) a row's function in words, for Replace F with …; and the Replace rows' labels
  function fnName(it) { return it.rows ? $t('these steps') : it.type === 'custom' ? $t('this formula') : it.label; }
  function whereLabel(m, it) {
    const name = fnName(it), k = palState.target;
    if (m === 'replaceF') return $t('Replace F with {name}', { name });
    return $t('Replace f{x} {old} with {name}', { x: sub(k), old: defOf(A.S.steps[k - 1]).label, name });
  }
  function openPalette(anchor, at, opt = {}) {
    // re-clicking the control that opened it closes it
    if (A.popEl && A.popEl.classList.contains('palette') && anchor && palState && palState.opener === anchor) { closePalette(); return; }
    closePalette();
    const explicit = at != null;
    const insertAt = explicit ? at : (A.S.focus > 0 ? A.S.focus : A.S.steps.length);
    const ctxText = explicit ? (at === 0 ? $t('Insert at the start') : $t('Insert after f{x}', { x: sub(at) })) : (A.S.focus > 0 ? $t('Insert after f{x}', { x: sub(A.S.focus) }) : $t('Insert at the end'));
    const input = h('input', { class: 'pal-input', id: 'palInput', placeholder: opt.fnOnly ? $t('Search functions, or type a formula in z') : $t('Search functions, regions, examples, commands'), spellcheck: 'false', autocapitalize: 'off', autocorrect: 'off', autocomplete: 'off', 'aria-label': $t('Search'), role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'palList' });
    const list = h('div', { class: 'pal-list', role: 'listbox', id: 'palList' });
    const pvCanvas = h('canvas', { width: 368, height: 368 });
    const pvCap = h('div', { class: 'pal-cap' });
    const preview = h('div', { class: 'pal-preview', 'aria-hidden': 'true' }, pvCanvas, pvCap);
    const pop = h('div', { class: 'pop palette', role: 'dialog', 'aria-modal': 'true', 'aria-label': opt.fnOnly ? $t('Add a function') : $t('Command palette') },
      h('div', { class: 'pal-head' }, h('span', { class: 'pal-icon', html: ICONS.search }), input, h('span', { class: 'pal-ctx', html: ctxText.replace(/f([₀-₉]+)/, (m, d) => `<i>f</i><sub>${[...d].map((c) => SUB.indexOf(c)).join('')}</sub>`) }), h('span', { class: 'kbd' }, 'Esc')),
      h('div', { class: 'pal-body' }, list, preview),
      h('div', { class: 'pal-foot' }, h('span', null, h('span', { class: 'kbd' }, '↑'), h('span', { class: 'kbd' }, '↓'), $t(' to move')), h('span', { class: 'pal-enter' }, h('span', { class: 'kbd' }, 'Enter'), h('span', { class: 'pal-verb' }, $t(' to add'))), h('span', null, h('span', { class: 'kbd' }, 'Shift Enter'), $t(' to insert before')), h('span', null, h('span', { class: 'kbd' }, 'Esc'), $t(' to close'))));
    const opener = anchor || document.activeElement, okey = focusKey(opener);
    // (D1, issue #23) where a function goes: inserted, F replaced by it, or step f_k replaced by it. A chip in the search
    // row says which (Tab or a click changes it) and remembers the last choice; a card's "Insert a function after it"
    // always inserts, and its "Replace…" and the Inspector's title always replace that step
    const n0 = A.S.steps.length;
    const modes = n0 < 1 ? ['insert'] : n0 === 1 ? ['insert', 'replaceF'] : ['insert', 'replaceF', 'replace'];
    let mode = 'insert';
    try { const m = localStorage.getItem(lsk('cmw-pal-where')); if (modes.includes(m)) mode = m; } catch (e) { /* ignore */ }
    if (opt.insert) mode = 'insert';
    if (opt.replace) mode = n0 === 1 ? 'replaceF' : 'replace';
    const target = Math.max(1, Math.min(n0, opt.replace || insertAt));
    palState = { at: insertAt, before: explicit ? at : (A.S.focus > 0 ? A.S.focus - 1 : 0), sel: 0, items: [], opener, pvTimer: 0, mode, modes, target };
    const fx = (t) => t.replace(/f([₀-₉]+)/, (m, d) => `<i>f</i><sub>${[...d].map((c) => SUB.indexOf(c)).join('')}</sub>`);
    const atText = (a) => (a <= 0 ? $t('Insert at the start') : a >= n0 ? $t('Insert at the end') : $t('Insert after f{x}', { x: sub(a) }));
    const whereText = (m) => (m === 'replaceF' ? $t('Replace F') : m === 'replace' ? $t('Replace f{x}', { x: sub(target) }) : document.documentElement.classList.contains('ph') ? $t('Insert') : atText(palState.at));
    const where = modes.length > 1 ? h('button', { class: 'pal-ctx pal-where', type: 'button', onpointerdown: (e) => e.preventDefault(), onmousedown: (e) => e.preventDefault(), onclick: () => { cycleWhere(1); input.focus({ preventScroll: true }); } }) : null;
    const paintWhere = () => {
      if (!where) return;
      const t = whereText(palState.mode);
      where.innerHTML = fx(t) + `<span class="pal-at-ic" aria-hidden="true">${ICONS.chevD || '▾'}</span>`;
      where.setAttribute('aria-label', $t('Where it goes: {place}. Tab changes it', { place: t }));
      if (palState.atChip) palState.atChip.hidden = palState.mode !== 'insert';
    };
    const cycleWhere = (d) => {
      const i = modes.indexOf(palState.mode);
      palState.mode = modes[(i + d + modes.length) % modes.length];
      try { localStorage.setItem(lsk('cmw-pal-where'), palState.mode); } catch (e) { /* ignore */ }
      paintWhere();
      palState.sel = 0; render();
    };
    tourEmit('palette-opened', {});
    // (v16.4) the step catalog: the add card, {+}, the palette's Add a step
    if (opt.fnOnly) tourEmit('layer-opened', { kind: 'catalog' });
    const runItem = (it, before) => {
      // (v16.5 UX23: a repair puts the repaired formula in the field and adds it as Enter would)
      if (it.kind === 'fix') {
        input.value = it.fixTo; palState.sel = 0; render();
        const f = palState.items[0];
        if (f && (f.kind === 'fn' || f.kind === 'region')) runItem(f, before); else input.focus();
        return;
      }
      const at = before ? palState.before : palState.at;
      const m = it.kind === 'fn' ? it.mode || palState.mode : 'insert';
      closePalette();
      const r = m === 'insert' ? it.run(at) : replaceSteps(m === 'replaceF' ? 0 : target - 1, m === 'replaceF' ? n0 : 1, it.run, it.name || fnName(it));
      // a new step's card takes the focus; anything else returns it to the opener when the run rebuilt it away
      if (r instanceof Element && r.isConnected && (it.kind === 'fn' || document.activeElement === document.body)) /** @type {HTMLElement} */ (r).focus({ preventScroll: true });
      else focusBack(opener, okey);
    };
    const render = () => {
      const items = paletteItems(input.value, opt.fnOnly);
      // (D1) a search with an answer lists its best function three ways, the chosen way first: Replace F with sin z,
      // Insert sin z after f₂, Replace f₂ Möbius with sin z; the other matches go the chosen way
      // (the Insert row keeps the row's own label, the chip saying where; a new number's row is not repeated)
      const i0 = modes.length > 1 && input.value.trim() ? items.findIndex((x) => x.kind === 'fn') : -1;
      if (i0 >= 0 && !items[i0].newName) {
        const it = items[i0], order = modes.slice(modes.indexOf(palState.mode)).concat(modes.slice(0, modes.indexOf(palState.mode)));
        items.splice(i0, 1, ...order.map((m) => (m === 'insert' ? Object.assign({}, it, { mode: m }) : Object.assign({}, it, { mode: m, name: fnName(it), label: whereLabel(m, it), labelParts: null, desc: m === 'replaceF' ? $t('F becomes this alone; Undo brings the chain back') : $t('The other steps stay') }))));
      }
      palState.items = items;
      palState.sel = Math.min(palState.sel, Math.max(0, items.length - 1));
      list.innerHTML = '';
      let group = null;
      items.forEach((it, i) => {
        // (four groups stay English as data: items.parseErr below looks for them)
        if (it.group !== group) { group = it.group; list.append(h('div', { class: 'pal-group', role: 'presentation' }, group === 'Custom formula' ? $t('Formula') : group === 'Region formulas' ? $t('Region formulas') : group === 'Curve formulas' ? $t('Curve formulas') : group === 'Calculus' ? $t('Calculus') : group)); }
        const t = h('span', { class: 'pal-tex' });
        // (Add as n steps: the start of its own derivation, not the formula row's TeX again: review verify-4)
        if (it.rows) t.append(drvStart(it.rows));
        else if (it.tex) TeX.set(t, it.tex);
        const props = h('span', { class: 'pal-props' });
        // (v16.5 UX82: no row of letters; the highlighted row names its strongest properties in words)
        if (it.props) { const w = propWords(it.props); if (w) props.append(h('span', { class: 'pal-pw' }, w)); }
        else if (it.key) props.append(h('span', { class: 'kbd' }, it.key));
        const row = h('div', { class: 'pal-item' + (i === palState.sel ? ' sel' : ''), role: 'option', id: `pal-o${i}`, 'aria-selected': String(i === palState.sel), 'data-i': i,
          onpointermove: () => { if (palState.sel !== i) { palState.sel = i; mark(false); } },
          onclick: (e) => runItem(it, e.shiftKey) },
        t, h('span', { class: 'pal-main' }, h('span', { class: 'pal-label' }, ...(it.labelParts ? it.labelParts() : [it.label])),
          // (on a phone the preview with its derivation is hidden: Add as n steps shows the derivation itself, small and
          // fitted, instead of the step names, review steps-12)
          it.rows && document.documentElement.classList.contains('ph') ? h('span', { class: 'pal-desc pal-drv' }, drvLine(it.rows, 'drv-line')) : it.desc ? h('span', { class: 'pal-desc' }, it.desc) : ''), props);
        list.append(row);
      });
      fitPalTex(list, items);
      // a query that looks like a formula but does not parse gets the parser's message, in grey, with the place it stopped
      // marked; a plain word that finds commands or functions gets none (v16.5 UX23, UX03)
      const raw = Expr.typed(input.value.trim()), fl = /[()^\\|<>+\-*/=0-9]/.test(raw);
      if (items.parseErr && !items.some((x) => x.group === 'Custom formula' || x.group === 'Region formulas' || x.group === 'Curve formulas') && (fl || !items.some((x) => x.kind !== 'fix'))) {
        const at = Math.max(0, Math.min(raw.length, items.parseErrPos | 0));
        list.prepend(h('div', { class: 'pal-empty pal-err', role: 'presentation' },
          h('span', { class: 'pe-q' }, raw.slice(0, at), h('span', { class: 'pe-bad' }, raw.slice(at, at + 1) || '\u2002'), raw.slice(at + 1)),
          h('span', { class: 'pe-msg' }, $t('Not a formula yet: {parseErr}', { parseErr: items.parseErr }))));
      }
      else if (!items.length) list.append(h('div', { class: 'pal-empty' }, opt.fnOnly ? $t('No match. Type a formula in z, such as e^{z^2}, to add it as a step.') : $t('No match. Type a formula in z to add it as a step, a set such as |z| < 1, or a curve such as Re z = 0.')));
      mark(false);
    };
    const mark = (scroll = true) => {
      for (const el of list.querySelectorAll('.pal-item')) {
        const on = +el.dataset.i === palState.sel;
        el.classList.toggle('sel', on);
        el.setAttribute('aria-selected', String(on));
        if (on && scroll) el.scrollIntoView({ block: 'nearest' });
      }
      input.setAttribute('aria-activedescendant', `pal-o${palState.sel}`);
      // (v16.5 UX03, UX23: Enter says what it does to the highlighted row, and is grey when there is nothing to run)
      const it = palState.items[palState.sel], en = pop.querySelector('.pal-enter'), vb = pop.querySelector('.pal-verb');
      if (en && vb) {
        const verb = !it ? '' : it.kind === 'cmd' ? $t(' to run') : it.kind === 'ex' ? $t(' to open') : it.kind === 'fix' ? $t(' to fix') : it.kind === 'fn' && (it.mode || palState.mode) !== 'insert' ? $t(' to replace') : $t(' to add');
        en.classList.toggle('off', !verb);
        if (verb && vb.textContent !== verb) vb.textContent = verb;
      }
      schedulePreview();
    };
    const schedulePreview = () => {
      clearTimeout(palState.pvTimer);
      const it = palState.items[palState.sel];
      palState.pvTimer = setTimeout(() => { if (A.popEl === pop) drawPalettePreview(pvCanvas, pvCap, it); }, 60);
    };
    input.addEventListener('input', () => { palState.sel = 0; render(); });
    input.addEventListener('keydown', (e) => {
      const n = palState.items.length;
      if (e.key === 'ArrowDown') { e.preventDefault(); if (n) palState.sel = (palState.sel + 1) % n; mark(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (n) palState.sel = (palState.sel - 1 + n) % n; mark(); }
      else if (e.key === 'Enter') { e.preventDefault(); const it = palState.items[palState.sel]; if (it) runItem(it, e.shiftKey); }
      else if (e.key === 'Escape') { e.preventDefault(); closePalette(); focusBack(opener, okey); }
      else if (e.key === 'Tab') {
        // Tab changes where the function goes (D1); with nothing to replace, it cycles groups
        e.preventDefault();
        if (where) { cycleWhere(e.shiftKey ? -1 : 1); return; }
        if (!n) return;
        const g = palState.items[palState.sel].group;
        const order = [...new Set(palState.items.map((x) => x.group))];
        const gi = order.indexOf(g), next = order[(gi + (e.shiftKey ? order.length - 1 : 1)) % order.length];
        palState.sel = palState.items.findIndex((x) => x.group === next);
        mark();
      }
    });
    $('popHost').append(pop);
    A.popEl = pop;
    if (document.documentElement.classList.contains('ph')) phonePalette(pop, input, opener, okey, where);   // (v16.5 UX29)
    else if (where) pop.querySelector('.pal-ctx').replaceWith(where);
    palState.render = render;
    paintWhere();
    render();
    // centred 14vh from the top; a bottom sheet on phones
    if (window.innerWidth < 768) pop.classList.add('sheet');
    else {
      pop.style.left = Math.max(12, (window.innerWidth - pop.offsetWidth) / 2) + 'px';
      pop.style.top = Math.round(window.innerHeight * 0.14) + 'px';
    }
    input.focus({ preventScroll: true });
    armOutside(anchor || null);
  }
  // the preview plate: the region pushed through the chain with the candidate inserted (CPU, coarse mesh)
  const pvMeshes = new Map();
  function drawPalettePreview(cv, cap, it) {
    const ctx = cv.getContext('2d');
    const W = cv.width, Hh = cv.height;
    if (!it || (it.kind !== 'fn' && it.kind !== 'ex')) {
      ctx.fillStyle = A.TH.plane; ctx.fillRect(0, 0, W, Hh);
      cap.textContent = it && it.kind === 'region' ? $t('Adds a shape to the z-plane') : '';
      return;
    }
    if (it.kind === 'ex') {
      cap.textContent = $t('Example');
      const url = exThumbs.get(it.i);
      ctx.fillStyle = A.TH.plane; ctx.fillRect(0, 0, W, Hh);
      if (url) { const img = new Image(); img.onload = () => { const s = Math.min(W / img.width, Hh / img.height); ctx.drawImage(img, (W - img.width * s) / 2, (Hh - img.height * s) / 2, img.width * s, img.height * s); }; img.src = url; }
      return;
    }
    // (v16.5 UX16: a formula with a new number is previewed with that number = 1, as it will be added)
    const mk = () => Funcs.build({ type: it.type, params: Object.assign(Funcs.defaults(it.type), it.params || {}), on: true });
    const b = it.newName ? withNewName(it.newName, mk) : mk();
    if (!b || b.error) { ctx.fillStyle = A.TH.plane; ctx.fillRect(0, 0, W, Hh); cap.textContent = b ? b.error : ''; return; }
    const pre = stageF(palState ? palState.at : A.S.steps.length), f = b.f;
    // d/dz differentiates the chain up to the insertion point
    const F = isDerivStep({ type: it.type }, b) || typeof f !== 'function' ? circleDeriv(pre) : (z) => f(pre(z));
    const pane = new Pane(cv);
    pane.w = W / 2; pane.h = Hh / 2; pane.dpr = 2;
    const xs = [], ys = [], jobs = [];
    const core = Region.expandBox(A.clipWin, 1.05);
    for (const s of A.S.shapes) {
      if (s.visible === false) continue;
      const t = kindType(s), ink = shapeInk(s), r = shapeGPU(s);
      if (t === 'point') { const w = F(C(s.p[0], s.p[1])); if (CX.isFin(w)) { xs.push(w.re); ys.push(w.im); jobs.push({ pt: w, ink }); } continue; }
      if (t === 'area') {
        const key = shapeKey(s) + '|' + JSON.stringify(A.clipWin);
        let mesh = pvMeshes.get(s.id);
        if (!mesh || mesh.key !== key) { try { mesh = Region.buildMesh(s, A.clipWin, 24); mesh.key = key; } catch (e) { mesh = null; } pvMeshes.set(s.id, mesh); }
        if (mesh) {
          const mm = Region.mapMesh(mesh, F);
          for (let i = 0; i < mm.pos.length; i += 2) {
            if (mesh.stretched) { const x = mesh.src[i], y = mesh.src[i + 1]; if (x < core.x0 || x > core.x1 || y < core.y0 || y > core.y1) continue; }
            if (Math.abs(mm.pos[i]) < 1e9 && Math.abs(mm.pos[i + 1]) < 1e9) { xs.push(mm.pos[i]); ys.push(mm.pos[i + 1]); }
          }
          jobs.push({ mm, ink });
        }
      }
      for (const p of r.polys || []) {
        const n = p.length / 2, stride = Math.max(1, Math.floor(n / 500)), pts = [];
        for (let i = 0; i < n; i += stride) pts.push(F(C(p[2 * i], p[2 * i + 1])));
        jobs.push({ line: pts, ink });
      }
    }
    const bx = robustBox(xs, ys);
    if (bx) pane.fitBox(bx, 0.1); else pane.fitBox({ x0: -2, x1: 2, y0: -2, y1: 2 });
    pane.begin(A.TH.plane);
    Axes.draw(pane, Object.assign({}, A.TH, { label: 'rgba(0,0,0,0)' }), { unitCircle: false, labels: false });
    for (const j of jobs) {
      if (j.mm) {
        ctx.fillStyle = j.ink.c0; ctx.globalAlpha = Math.min(0.9, A.S.alpha);
        ctx.beginPath();
        const P = j.mm.pos, T = j.mm.tri;
        for (let t = 0; t < T.length; t += 3) {
          const [ax, ay] = pane.w2sxy(P[2 * T[t]], P[2 * T[t] + 1]), [bx2, by] = pane.w2sxy(P[2 * T[t + 1]], P[2 * T[t + 1] + 1]), [cx2, cy] = pane.w2sxy(P[2 * T[t + 2]], P[2 * T[t + 2] + 1]);
          if (Math.abs(ax) > 4e4 || Math.abs(ay) > 4e4) continue;
          ctx.moveTo(ax, ay); ctx.lineTo(bx2, by); ctx.lineTo(cx2, cy); ctx.closePath();
        }
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (j.line) {
        ctx.strokeStyle = j.ink.edge; ctx.lineWidth = 1.25; ctx.lineJoin = 'round';
        ctx.beginPath();
        let pen = false, px = 0, py = 0;
        for (const w of j.line) {
          if (!CX.isFin(w)) { pen = false; continue; }
          const [x, y] = pane.w2s(w);
          if (Math.abs(x) > 4e4 || Math.abs(y) > 4e4 || (pen && Math.hypot(x - px, y - py) > 60)) { pen = false; continue; }
          if (pen) ctx.lineTo(x, y); else ctx.moveTo(x, y);
          pen = true; px = x; py = y;
        }
        ctx.stroke();
      } else if (j.pt) {
        const [x, y] = pane.w2s(j.pt);
        ctx.fillStyle = j.ink.edge; ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill();
      }
    }
    cap.innerHTML = $t('Image after adding {f}', { f: fsub((palState ? palState.at : A.S.steps.length) + 1) });
    // (Add as n steps: the derivation z ↦ z² ↦ z²+1 ↦ sin(z²+1), wrapped after a ↦ when it is long: never cut, never
    // tiny; review steps-2, verify-3)
    if (it.rows) {
      cap.innerHTML = '';
      cap.append(drvLine(it.rows, 'pal-rows'));
    }
  }
  // a derivation as a line of its rows' formulas joined by ↦, each typeset on its own in display style (a fraction's
  // parts at the full size, its scripts one level down), a row and the ↦ after it kept together, so the line breaks
  // after a ↦. It wraps first; only a row wider than the whole box makes the line smaller, down to 85 % (the scripts
  // stay at about 8 px), and a row wider still scrolls. Never cut, never unreadable (review steps-2, steps-12; v15.2.1
  // verify-3: it shrank to 70 % before it wrapped, and a fraction's exponent came out at 4.6 px)
  function drvLine(rows, cls, min = 0.85) {
    const line = h('span', { class: cls });
    rows.forEach((r, i) => {
      const t = h('span', { class: 'drv-tex' });
      line.append(h('span', { class: 'drv-step' }, t, i < rows.length - 1 ? h('span', { class: 'drv-map', 'aria-hidden': 'true' }, '↦') : ''));
      TeX.set(t, `\\displaystyle ${r.tex}`);
    });
    let tries = 0;
    const fit = () => {
      if (!line.isConnected) { if (++tries < 60) requestAnimationFrame(fit); return; }
      const box = line.parentNode, cs = box && getComputedStyle(box), avail = box ? box.clientWidth - parseFloat(cs.paddingLeft || '0') - parseFloat(cs.paddingRight || '0') : 0;
      if (!TeX.ready || !(avail > 0)) { if (++tries < 120) requestAnimationFrame(fit); return; }
      line.style.removeProperty('--drv-k');
      line.classList.remove('scroll');
      let w = 0;
      for (const s of line.children) w = Math.max(w, s.getBoundingClientRect().width);
      if (w > avail + 0.5) {
        const k = Math.max(min, Math.floor((avail / w) * 100) / 100);
        line.style.setProperty('--drv-k', String(k));
        if (w * k > avail + 0.5) line.classList.add('scroll');
      }
    };
    requestAnimationFrame(fit);
    return line;
  }
  // the start of a derivation for a search row's formula column: z ↦ z² ↦ ⋯, as many rows as fit (fitPalTex)
  function drvStart(rows) {
    const line = h('span', { class: 'drv-start' });
    rows.forEach((r, i) => {
      const t = h('span', { class: 'drv-tex' });
      line.append(h('span', { class: 'drv-step' }, i ? h('span', { class: 'drv-map' }, '↦') : '', t));
      TeX.set(t, r.tex);
    });
    line.append(h('span', { class: 'drv-step drv-more', hidden: true }, h('span', { class: 'drv-map' }, '↦'), h('span', { class: 'drv-dots' }, '⋯')));
    return line;
  }
  // a search row's formula in its column (120 px; 84 px on a phone), once laid out: smaller when it is wider, down to
  // 85 %; past that without its "f(z) =" or "w =", down to 75 %; past that it ends in a fade, never a hard cut. The
  // Add as n steps row keeps as many rows of its derivation as fit and ends in ↦ ⋯ (review verify-4: both rows showed
  // the same cut formula, "f(z) = sin" on the phone)
  function fitPalTex(list, items, tries = 0) {
    requestAnimationFrame(() => {
      if (!list.isConnected || palState === null || palState.items !== items) return;
      if (!TeX.ready || !list.clientWidth) { if (tries < 120) fitPalTex(list, items, tries + 1); return; }
      for (const row of list.querySelectorAll('.pal-item')) {
        const it = items[+row.dataset.i], t = row.querySelector('.pal-tex');
        if (!it || !t || !(t.clientWidth > 0)) continue;
        const avail = t.clientWidth;
        t.classList.remove('over');
        t.style.removeProperty('--fit');
        if (it.rows) {
          const line = t.firstChild, steps = line ? [...line.children] : [], more = steps.pop();
          if (!more || line.getBoundingClientRect().width <= avail + 0.5) continue;
          more.hidden = false;
          let k = steps.length - 1;
          for (; k >= 1; k--) { steps[k].hidden = true; if (line.getBoundingClientRect().width <= avail + 0.5) break; }
          if (!k) t.classList.add('over');
          continue;
        }
        let w = t.scrollWidth;
        if (w <= avail + 0.5) continue;
        const bare = it.tex && /^(?:f\(z\)|w)=/.test(it.tex) ? it.tex.replace(/^(?:f\(z\)|w)=/, '') : '';
        if (bare && w * 0.85 > avail + 0.5) { TeX.set(t, bare); w = t.scrollWidth; }
        if (w <= avail + 0.5) continue;
        const f = Math.max(0.75, Math.floor((avail / w) * 100) / 100);
        t.style.setProperty('--fit', String(f));
        if (w * f > avail + 0.5) t.classList.add('over');
      }
    });
  }

  // closePalette (the app's) asks for the palette's opener before it removes the popover, and tells it after
  const opener = () => palState && palState.opener;
  function closed() { if (palState) { clearTimeout(palState.pvTimer); palState = null; } }
  function init(api) {
    A = api;
    ({ C, EX, FT_WORD, HR, ICONS, PAL_NAMES, REGION_EXAMPLES, SUB, TOOLS, TeX, activeSteps, addCurveShapes, addShape, addStep, addSteps, armOutside, chooseRange, circleDeriv, closePalette, copyFigureLink, copyText, curvePlan, defOf, derivativeAction, enOf, exOk, exThumbs, fUni, focusBack, focusKey, fsub, intLabel, integrateSelected, integrateShape, inverseAction, isDerivStep, kindType, lLand, latexDocument, leftStage, loadExample, morph, morphOn, nSteps, newShape, openGallery, openGuide, pickLang, pickScene, recentTypes, renumberPoints, renumberZp, replaceSteps, robustBox, saveScene, lsk, selOf, setFocus, setHomAll, setMain, setMorphPaths, setPalette, setPanels, setTheme, setTool, setView, shapeGPU, shapeInk, shapeKey, shapeNames, sndExportDone, soundHear, soundMode, soundStop, soundToggle, stageF, sub, toast, toggleAlone, toggleTransport, tourEmit, viewBox } = api);
  }
  return { init, openPalette, opener, closed };
})();
import { $, TAU, h } from './util.js';
import { CX } from './cx.js';
import { Expr } from './parse.js';
import { Funcs } from './funcs.js';
import { Region } from './region.js';
import { Curves } from './curves.js';
import { Palette } from './palette.js';
import { Axes, Pane } from './view.js';
import { Figure } from './figure.js';
import { Sound } from './sound.js';
import { Tour } from './tour.js';
import { Inspector } from './inspector.js';
import { Construct } from './construct.js';
import { Params } from './params.js';
export { Commands };
