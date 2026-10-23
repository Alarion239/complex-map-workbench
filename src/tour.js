'use strict';
// Guided tour: a spotlight walk through the Workbench in chapters (notes/tour/DESIGN.md). The app hands over a small
// adapter with Tour.init(api) (notes/tour/INTEGRATION.md); everything else (content, spotlight, callout, the first-run
// suggestion, the help menu, persistence, CSS) lives here. A step whose anchor is missing is skipped, so the tour keeps
// working while the UI evolves.
const Tour = (() => {
  // the interface language (src/i18n.js, notes/i18n/DESIGN.md): $t(english, params). Run alone (the node tests), the
  // tour keeps its English: the same placeholder rule, %{name} always and {name} only in a template without TeX
  const I18 = typeof globalThis !== 'undefined' && globalThis.I18N ? globalThis.I18N : null;
  const $t = I18 ? I18.t : (s, p) => (p ? s.replace(/%\{(\w+)\}|\{(\w+)\}/g, (m, a, b) => { const k = a || (!/[$\\]/.test(s) && b); return k && k in p ? String(p[k]) : m; }) : s);
  // Russian notation (tg, sh, ln) where the tour sets TeX; English unchanged
  const notation = (tex) => (I18 ? I18.notation(tex) : tex);
  const VERSION = 1;          // content version; a chapter whose `rev` is newer than what a user saw is marked New
  const SUGGEST_MAX = 3;      // an ignored suggestion comes back on at most this many openings

  // ---------------------------------------------------------------- content
  // Scenes are in the format of the app's examples (EX in app.js). `needs` names an app feature the scene relies on
  // (api.has(feature) === false: a step falls back to the next scene of its list, or is left out). `look` is the
  // display the copy assumes; the tour applies it with api.setLook right after api.loadScene, so a user's own pattern,
  // opacity or Landscape height never makes the copy false (restore() brings the user's look back).
  const LOOK = { pattern: 'checker', alpha: null, height: 'log', sheets: false, phaseStyle: 'enhanced', paths: true, allAtOnce: false };
  const look = (o) => Object.assign({}, LOOK, o || {});
  const SCENES = {
    strip: {
      name: 'Strip to disk', view: { cx: 0, cy: 0, s: 52 }, look: look(),
      shapes: [{ kind: 'formula', expr: '|\\Im z|<\\frac{\\pi}{2}' }, { kind: 'line', a: [0, 0.8], b: [1, 0.8] }, { kind: 'point', p: [0, 0], label: 'z₀' }],
      steps: [{ type: 'exp', params: {} }, { type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' } }],
    },
    rational: {
      name: 'A rational map', view: { cx: 0, cy: 0, s: 80 }, look: look(),
      shapes: [{ kind: 'rect', a: [-1.5, -1.5], b: [1.5, 1.5] }],
      steps: [{ type: 'custom', params: { expr: '\\frac{z^2-1}{z^2+1}', cut: 180 } }],
    },
    // the same map as `rational`, built from its zeros and poles (the 'zp' step of funcs.js)
    zp: {
      name: 'Zeros and poles', needs: 'zp', view: { cx: 0, cy: 0, s: 80 }, look: look(),
      shapes: [{ kind: 'rect', a: [-1.5, -1.5], b: [1.5, 1.5] }],
      steps: [{ type: 'zp', params: { a: '1', zeros: '1, -1', poles: 'i, -i' } }],
    },
    roots: {
      name: 'Roots as preimages', view: { cx: 0, cy: 0, s: 90 }, look: look(),
      shapes: [{ kind: 'circle', c: [0, 0], r: 1 }],
      targets: [{ kind: 'point', p: [0, 0] }, { kind: 'circle', c: [0, 0], r: 0.6 }],
      steps: [{ type: 'custom', params: { expr: 'z^3-1', cut: 180 } }],
    },
    // 1/(z²+1) as a zeros-and-poles step (a = 1, no zeros, poles ±i): its natural domain reads z ∉ {i, −i}
    residueZp: {
      name: 'A residue by integration', needs: 'zp', view: { cx: 0, cy: 0.5, s: 80 }, look: look(),
      shapes: [{ kind: 'circle', c: [0, 1], r: 1 }],
      steps: [{ type: 'zp', params: { a: '1', zeros: '', poles: 'i, -i' } }],
    },
    residue: {
      name: 'A residue by integration', view: { cx: 0, cy: 0.5, s: 80 }, look: look(),
      shapes: [{ kind: 'circle', c: [0, 1], r: 1 }],
      steps: [{ type: 'custom', params: { expr: '\\frac{1}{z^2+1}', cut: 180 } }],
    },
    logAnnulus: {
      name: 'Logarithm of an annulus', view: { cx: 0, cy: 0, s: 70 }, look: look(), focus: 1,
      shapes: [{ kind: 'annulus', c: [0, 0], r1: 0.5, r2: 2 }, { kind: 'circle', c: [0, 0], r: 1 }, { kind: 'segment', a: [0.5, 0.5], b: [1.5, 1.5] }],
      steps: [{ type: 'log', params: { cut: 180, k: 0 } }],
    },
    deriv: {
      name: 'The derivative in the chain', view: { cx: 0, cy: 0, s: 80 }, look: look(),
      shapes: [{ kind: 'disc', c: [0, 0], r: 1.6 }, { kind: 'pgrid', c: [0, 0], r: 1.6, nc: 4, nr: 16 }],
      targets: [{ kind: 'point', p: [0, 0] }],
      steps: [{ type: 'custom', params: { expr: 'z^3-3z', cut: 180 } }, { type: 'deriv', params: {} }],
    },
    logSheets: {
      name: 'Every sheet of the logarithm', view: { cx: 0, cy: 0, s: 60 }, look: look({ height: 'im', sheets: true }),
      shapes: [{ kind: 'annulus', c: [0, 0], r1: 0.5, r2: 2 }],
      steps: [{ type: 'log', params: { cut: 180, k: 0 } }],
    },
  };

  // Copy markup: $tex$, {K} a key (kbd), **bold**. {mod} is ⌘ on Apple devices and Ctrl elsewhere.
  // A step: id, anchor (a name or a list of fallbacks; null = centred card), also (more lit areas), title, body,
  // narrow (body below 640 px), touch (body on a touch screen: no hover, no right-click), byScene (body by the scene
  // shown), before (actions run first), try ({text, touch, on: event(s), test(e, memory), count, advance}), place
  // (the preferred side of the callout), wait (ms after the actions), needs (an app feature, see api.has).
  // The panes are named by their role, X and Y, never left and right: on a phone they stack.
  const CHAPTERS = [
    {
      id: 'basics', title: 'Basics', time: '2 min', rev: 1, scene: 'strip',
      steps: [
        { id: 'welcome', anchor: null, title: 'Welcome to the Workbench', before: [['view', 'xy'], ['deform', false], ['surface', 'L', 'plane'], ['surface', 'R', 'plane']],
          body: 'Draw a set in the $z$-plane, send it through a chain of functions and watch its image. This takes about two minutes, and your own work comes back when the tour ends.' },
        { id: 'x', anchor: 'paneL', title: 'X: the domain', place: 'right',
          body: 'X shows your shapes, here the strip $|\\operatorname{Im} z|<\\pi/2$, with a checkerboard drawn in $z$-coordinates. Scroll to zoom, drag empty space to pan, and {Z} fits both planes.',
          touch: 'X shows your shapes, here the strip $|\\operatorname{Im} z|<\\pi/2$, with a checkerboard drawn in $z$-coordinates. Pinch to zoom and drag empty space to pan.' },
        { id: 'y', anchor: 'paneR', title: 'Y: the image', place: 'left',
          body: 'Y shows the image under $F(z)=(e^z-1)/(e^z+1)$: the strip becomes the unit disc. $F$ is conformal there: grid lines still cross at right angles, and tiny squares map to near-squares.' },
        // (Y lit with X beside it: the callout sits below Y, not over X where the preimage marks appear)
        { id: 'preimages', anchor: 'paneR', also: ['paneL'], title: 'Preimages', place: 'bottom',
          body: 'Hover a point $w$ in Y: X marks every $z$ in view with $F(z)=w$. Inside the disc there is exactly one in the strip, since $F$ maps the strip one-to-one onto the disc. Outside it there are two, $2\\pi i$ apart, as $F$ has period $2\\pi i$.',
          touch: 'Touch and hold a point $w$ in Y: X marks every $z$ in view with $F(z)=w$. Inside the disc there is exactly one in the strip, since $F$ maps the strip one-to-one onto the disc. Outside it there are two, $2\\pi i$ apart.',
          try: { text: 'Hover inside the disc, then outside it.', touch: 'Touch and hold inside the disc, then outside it.', on: 'probe', test: probeInOut } },
        { id: 'draw', anchor: ['tools', 'toolsRail'], also: ['paneL'], title: 'Draw a shape', place: 'right',
          body: 'Pick a tool and drag in X to add a shape. The same tools in Y add a target in $w$ instead.',
          try: { text: 'Choose Disc, then drag in X.', on: 'shape-added' } },
        // (tryWide: on a phone the list and X are a screen apart, so the drag is not asked for there)
        { id: 'shapes', anchor: 'shapes', also: ['paneL'], title: 'Your shapes', place: 'right', before: [['tool', 'select']], tryWide: true,
          body: 'Each shape is listed with its equation; the eye hides it and ⋯ has the rest: duplicate, delete, integrate. With Select {V}, drag a shape or a handle and the image follows; {mod}{Z} undoes.',
          touch: 'Each shape is listed with its equation; the eye hides it and ⋯ has the rest: duplicate, delete, integrate. With Select, drag a shape or a handle and the image follows.',
          try: { text: 'Press {V}, then drag the line $\\operatorname{Im} z=0.8$ up or down.', touch: 'Drag the line $\\operatorname{Im} z=0.8$ up or down.', on: 'shape-moved' } },
        { id: 'formula', anchor: 'formula', title: 'Sets from formulas', place: 'right',
          body: 'Type a set and press Add, such as $|z-1|<2$ or $0<\\operatorname{Im} z<\\pi$. An equation like $|z|=1$ adds a curve, and a formula in $w$ adds a target.' },
        { id: 'chain', anchor: 'chain', title: 'The function chain', place: 'top',
          body: 'The cards apply in order: $F=f_2\\circ f_1$ with $f_1(z)=e^z$. Click a card to focus that step, and X and Y become its input and output.',
          touch: 'The cards apply in order: $F=f_2\\circ f_1$ with $f_1(z)=e^z$. Tap a card to focus that step, and X and Y become its input and output.',
          try: { text: 'Click the card $f_1$.', touch: 'Tap the card $f_1$.', on: 'step-focused', test: (e) => !e || e.k === 1 } },
        { id: 'add', anchor: ['addStep', 'chain'], title: 'Add a function', place: 'top', before: [['focus', 0]],
          body: 'Press {+} or click here to add a step: pick one from the catalog or type a formula such as $\\sin(z^2)$. Drag a card by its header to reorder.',
          touch: 'Tap here to add a step: pick one from the catalog or type a formula such as $\\sin(z^2)$. Drag a card by its header to reorder.' },
        { id: 'examples', anchor: ['examples', 'moreBtn'], title: 'Examples', place: 'bottom',
          body: 'Worked examples, from the Joukowski airfoil to a residue found by integration. Open one whenever you want a starting point.',
          narrow: 'Worked examples are in this menu, from the Joukowski airfoil to a residue found by integration.' },
      ],
    },
    {
      id: 'views', title: 'Views', time: '1 min', rev: 1, scene: 'rational',
      steps: [
        { id: 'switch', anchor: 'viewSwitch', title: 'Three views', place: 'bottom', before: [['deform', false], ['view', 'xy']],
          body: 'X → Y shows the two planes side by side. Phase and Landscape are pictures of $F$ over X, each in one wide panel. Keys {1} {2} {3}.',
          touch: 'X → Y shows the two planes. Phase and Landscape are pictures of $F$ over X, each in one wide panel.',
          try: { text: 'Choose Phase.', on: 'view-changed', test: (e) => !e || e.main === 'phase', advance: true } },
        { id: 'phase', anchor: 'panes', title: 'Phase portrait', place: 'bottom', before: [['view', 'phase'], ['surface', 'L', 'plane']],
          body: 'Each $z$ is coloured by $\\arg F(z)$, here for $F(z)=(z^2-1)/(z^2+1)$, and the brightness bands are bounded by level curves of $|F|$. All colours meet at the zeros $\\pm1$ and the poles $\\pm i$, circling one way around a zero and the other way around a pole.' },
        { id: 'land', anchor: 'panes', title: 'Landscape', place: 'bottom', before: [['view', 'land']], wait: 120,
          body: 'The graph of $\\log|F|$ over X: zeros are pits and poles are peaks. Drag to orbit; the panel\'s options set the height and the colouring.' },
        { id: 'sphere', anchor: 'surfaceL', also: ['panes'], title: 'The Riemann sphere', place: 'bottom', before: [['view', 'phase'], ['surface', 'L', 'sphere']],
          body: 'Sphere wraps the plane onto the Riemann sphere, with $\\infty$ at the north pole; here $F(\\infty)=1$, neither a zero nor a pole. You can draw on the sphere too.' },
        // (wide: Y's options hold the Phase key only on a wide screen; on a phone the step is left out from the start)
        { id: 'key', anchor: 'phaseKey', also: ['paneR'], title: 'Phase key', place: 'left', wide: true, before: [['view', 'xy'], ['surface', 'L', 'plane'], ['surface', 'R', 'plane']],
          body: 'Phase key, among the options of Y, paints the phase colours of $w$ itself under the images, so a colour of the Phase portrait reads off as a value of $w=F(z)$.' },
        { id: 'patterns', anchor: 'patterns', also: ['paneR'], title: 'Patterns', place: 'bottom', before: [['view', 'xy'], ['surface', 'L', 'plane'], ['surface', 'R', 'plane'], ['look', { pattern: 'checker' }]],
          body: 'The pattern is painted on X and carried to Y by $F$. Checker shows how squares are bent and scaled, Log-polar cells stay square under a conformal map, and Stretch shades by $|F\'(z)|$: blue shrinks, amber grows.',
          try: { text: 'Choose Stretch.', on: 'pattern-changed', test: (e) => !e || e.id == null || e.id === 'stretch' } },
      ],
    },
    {
      id: 'deform', title: 'Deformation', time: '1 min', rev: 1, scene: 'strip',
      steps: [
        { id: 'toggle', anchor: 'deformToggle', title: 'Deformation', place: 'bottom', before: [['view', 'xy'], ['surface', 'L', 'plane'], ['surface', 'R', 'plane'], ['deform', false]],
          body: 'Plays a homotopy $H_t$ from the identity to $F$, step by step, in every view. In X → Y the two panes merge into one plane.',
          try: { text: 'Click it, or press {M}.', touch: 'Tap it.', on: 'deformation-toggled', test: (e) => !e || e.on !== false, advance: true } },
        { id: 'transport', anchor: 'transport', also: ['panes'], title: 'Play and scrub', place: 'top', before: [['deform', true]],
          body: 'Play, or drag $t$. Each step follows its natural path when it has one (the caption names it): $H_t$ is analytic for every $t$, so angles are kept wherever $H_t\'\\neq0$.',
          try: { text: 'Drag $t$.', on: 'deformation-t' } },
        { id: 'paths', anchor: 'paths', title: 'Paths', place: 'top', before: [['deform', true]],
          body: 'Paths draws $t\\mapsto H_t(z)$ for well-spread points $z$ of X, from $z$ to $F(z)$. Key {P}.',
          touch: 'Paths draws $t\\mapsto H_t(z)$ for well-spread points $z$ of X, from $z$ to $F(z)$.',
          try: { text: 'Click Paths twice, or press {P} twice.', touch: 'Tap Paths twice.', on: 'paths-toggled', count: 2 } },
        { id: 'order', anchor: 'allAtOnce', needs: 'allAtOnce', title: 'All steps at once', place: 'top', before: [['deform', true]],
          body: 'With two or more steps, choose All at once: every step deforms at the same $t$, so $H_t=H^{(2)}_t\\circ H^{(1)}_t$ with $0\\le t\\le 1$.' },
      ],
    },
    {
      id: 'analysis', title: 'Analysis', time: '1½ min', rev: 1, scene: 'roots',
      steps: [
        { id: 'targets', anchor: 'paneR', also: ['paneL'], title: 'Targets and preimages', place: 'bottom', before: [['deform', false], ['view', 'xy'], ['surface', 'L', 'plane'], ['surface', 'R', 'plane']],
          body: 'Shapes drawn in Y are targets in $w$, and X shades their preimages. The target point $0$ marks the roots of $F(z)=z^3-1$ with their multiplicity, here the three cube roots of unity; the circle $|w|=0.6$ pulls back to three loops around them.' },
        { id: 'cauchy', anchor: ['phaseStyle', 'panes'], also: ['panes'], title: 'Cauchy integral', place: 'top', before: [['view', 'phase'], ['surface', 'L', 'plane'], ['look', { phaseStyle: 'cauchy' }]],
          body: 'The phase style Cauchy plots $\\frac{1}{2\\pi i}\\oint_\\gamma\\frac{F(\\zeta)}{\\zeta-z}\\,d\\zeta$ over a closed curve $\\gamma$, here the unit circle. It equals $F(z)=z^3-1$ inside and $0$ outside; the three zeros of $F$ lie on $\\gamma$ itself. Select another closed curve to use it instead.' },
        { id: 'zp', anchor: 'zpCard', also: ['paneL'], title: 'Zeros and poles', place: 'top', before: [['scene', 'zp']],
          body: 'This step is built from its zeros and poles. Drag one, and the map, its image and its guarantees follow. The axes button beside $a$, as beside every complex parameter, picks a value on a small Argand diagram.',
          try: { text: 'Drag a zero or a pole.', on: 'zp-moved' } },
        { id: 'integral', anchor: 'paneL', title: 'Integrals', place: 'right', before: [['scene', ['residueZp', 'residue']], ['view', 'xy']],
          body: 'Right-click the circle itself and choose $\\oint F\\,dz$: you get the integral, the winding number and the zeros and poles inside. It encloses the pole $i$ of $1/(z^2+1)$, so $\\oint=2\\pi i\\,\\operatorname{Res}_i F=\\pi$.',
          touch: 'Touch and hold the circle itself and choose $\\oint F\\,dz$: you get the integral, the winding number and the zeros and poles inside. It encloses the pole $i$ of $1/(z^2+1)$, so $\\oint=2\\pi i\\,\\operatorname{Res}_i F=\\pi$.',
          try: { text: 'Right-click the circle, then choose $\\oint$.', touch: 'Touch and hold the circle, then choose $\\oint$.', on: 'integral-opened' } },
        { id: 'domain', anchor: 'domain', title: 'Natural domain', place: 'left', before: [['panel', 'right']],
          body: 'Where every step is defined. For a typed formula the panel reads "the formula is defined at $z$": here that is every $z$ except the poles $\\pm i$.',
          byScene: { residueZp: 'Where every step is defined: here every $z$ except the poles $\\pm i$, which the panel writes $z\\notin\\{i,-i\\}$.' } },
        { id: 'guarantees', anchor: 'guarantees', title: 'Guarantees', place: 'left', before: [['panel', 'right']],
          body: 'A lamp is lit only when every step has the property and composition keeps it, so a lit lamp is always true; unlit means only that the chain does not imply it. Step by step, below, shows which step brings which property.' },
      ],
    },
    {
      id: 'branches', title: 'Branches and inverses', time: '1 min', rev: 1, scene: 'logAnnulus',
      steps: [
        { id: 'cut', anchor: 'paneL', title: 'Branch cuts', place: 'right', before: [['deform', false], ['view', 'xy'], ['surface', 'L', 'plane'], ['surface', 'R', 'plane']],
          body: '$\\log z$ needs a cut: the red ray in X is where its values jump by $2\\pi i$. Drag it to move the seam; the sheet $k$ on the card adds $2\\pi i k$.',
          try: { text: 'Drag the red cut.', on: 'cut-moved' } },
        { id: 'inverse', anchor: ['invBtn', 'chain'], title: 'Inverses', place: 'top',
          body: '$f^{-1}$ on a card replaces a step by its inverse when there is a single-valued one, as $e^z$ is for $\\log z$. When there is none, as for $z^2$, it says why and offers the preimages instead.' },
        // (X lit with the chain: the callout sits over Y, which is not lit, beside X)
        { id: 'deriv', anchor: 'paneL', also: ['chain'], title: 'The derivative as a step', place: 'right', before: [['scene', 'deriv'], ['view', 'xy']],
          body: 'A $d/dz$ step differentiates the chain so far: here $F=3z^2-3$, the derivative of $z^3-3z$. The target $0$ marks its zeros $\\pm1$, the critical points of $z^3-3z$.' },
        { id: 'sheets', anchor: ['sheets', 'panes'], also: ['panes'], title: 'All sheets', place: 'bottom', before: [['scene', 'logSheets'], ['view', 'land']], wait: 120,
          body: 'In Landscape, All sheets draws the whole Riemann surface of a multivalued map: $\\operatorname{Im}\\log z$ climbs a helicoid around $0$ instead of jumping at the cut.' },
      ],
    },
    {
      id: 'export', title: 'Export and LaTeX', time: '30 s', rev: 1, scene: null,
      steps: [
        { id: 'figure', anchor: ['exportBtn', 'moreBtn'], title: 'Figures for articles', place: 'bottom',
          body: 'Export a vector figure of the current view, with a caption that states exactly what is drawn, or copy a LaTeX document with $F$, its natural domain and its guarantees.',
          narrow: 'Export, in this menu, makes a vector figure with a caption that states exactly what is drawn, or a LaTeX document with $F$, its natural domain and its guarantees.' },
        { id: 'formula-tex', anchor: 'composite', title: 'The formula in LaTeX', place: 'left', before: [['panel', 'right']],
          body: 'Composite map: $F$ in closed form; the copy button puts its LaTeX on the clipboard.' },
      ],
    },
    {
      id: 'keys', title: 'Palette and keys', time: '30 s', rev: 1, scene: null,
      steps: [
        { id: 'palette', anchor: ['palette', 'moreBtn'], title: 'Command palette', place: 'bottom',
          body: 'Search functions, region formulas, examples and commands with {mod}{K}. Type a formula such as $e^{z^2}$ to add it as a step.',
          narrow: 'Search, in this menu, finds functions, formulas, examples and commands. Type a formula such as $e^{z^2}$ to add it as a step.',
          try: { text: 'Press {mod}{K}.', touch: 'Open ⋯, then Add function or command.', on: 'palette-opened' } },
        { id: 'sound', anchor: ['soundBtn', 'soundBar', 'moreBtn'], needs: 'sound', title: 'Sound', place: 'bottom',
          body: 'Sound stays off until you turn it on here or with {Shift}{M}. Then quiet cues confirm what you do, a closed loop plays its winding number, and an optional tone plays $\\arg F$ as pitch.',
          narrow: 'Sound stays off until you turn it on, in this menu. Then quiet cues confirm what you do, a closed loop plays its winding number, and an optional tone plays $\\arg F$ as pitch.',
          touch: 'Sound stays off until you turn it on here. Then quiet cues confirm what you do, a closed loop plays its winding number, and an optional tone plays $\\arg F$ as pitch.' },
        { id: 'help', anchor: ['helpBtn', 'moreBtn'], title: 'Help is here', place: 'bottom',
          body: 'This button opens the tour by chapter, the reference guide and every shortcut. {?} opens the guide directly.',
          narrow: 'Help, in this menu, opens the tour by chapter and the reference guide.' },
      ],
    },
  ];
  // the preimages Try it: a probe of Y inside the disc and one outside it (w: [re, im] or {re, im}); a probe without
  // w (an app that does not report it) ticks it at once
  function probeInOut(e, m) {
    if (!e) return true;
    if (e.pane === 'L') return false;
    if (e.w == null) return true;
    m = m || {};
    const a = Array.isArray(e.w) ? Math.hypot(e.w[0], e.w[1]) : Math.hypot(e.w.re, e.w.im);
    if (!Number.isFinite(a)) return false;
    if (a < 0.98) m.inside = true;
    if (a > 1.02) m.outside = true;
    return !!(m.inside && m.outside);
  }

  // Anchors of the current markup, used when the app's api.anchor(name) returns undefined for a name: a selector, or a
  // function returning the element.
  const ANCHORS = {
    examples: '#examplesBtn', palette: '#cmdBtn', exportBtn: '#exportBtn', helpBtn: '#helpBtn', moreBtn: '#hdrMoreBtn',
    viewSwitch: '#viewSwitch', deformToggle: '#morphBtn', tools: '#secDraw', toolsRail: '#railTools',
    'tool:disc': '.tool[data-tool="disc"]', formula: '#secFormula', shapes: '#secShapes', display: '#secDisplay',
    patterns: '#patternSeg', chain: '.pipe-wrap', addStep: '#addStepBtn', panes: '#panes', paneL: '#paneL', paneR: '#paneR',
    surfaceL: '#leftTabs', surfaceR: '#rightTabs', transport: '.tdock:not([hidden])', paths: '#pathsBtn', allAtOnce: '#homOrderSel',
    rightPanel: '#rightPanel', composite: '#propsPanel > section:nth-of-type(1)', guarantees: '#propsPanel > section:nth-of-type(2)',
    domain: '#propsPanel > section:nth-of-type(3)', matrix: '#propsPanel > section:nth-of-type(4)',
    // the card of the first zeros-and-poles step (its parameter block is .params.zp)
    zpCard: () => { const p = document.querySelector('.pipe .card .params.zp, .card .params.zp'); return p ? p.closest('.card') : null; },
    // the f⁻¹ button of the first card that has one; the All sheets check of the Landscape options (its label)
    invBtn: () => [...document.querySelectorAll('.card button')].find((b) => /<sup>\s*(−|-|&minus;)1\s*<\/sup>/.test(b.innerHTML)) || null,
    sheets: () => { const c = document.querySelector('#sheetsChk'); return c ? c.closest('label') || c : null; },
    // the Sound control of the top bar (the sound round); the Phase key check of Y's options (X → Y, Y on its plane)
    soundBtn: '#soundBtn', soundBar: '#soundPh',
    // the Phase style control of the Phase view's options (Tiles, Plain, …, Cauchy)
    phaseStyle: '#dcSeg',
    phaseKey: () => { const c = document.querySelector('#wKeyChkR'); return c ? c.closest('label') || c : null; },
  };
  // the app's hover tooltip: hidden while it would cover the callout
  const TIP_SEL = '#tip';

  // ---------------------------------------------------------------- pure helpers (unit-tested in test/t_tour.js)
  // copy markup -> tokens
  function parseCopy(s) {
    const out = [];
    const re = /\$([^$]+)\$|\{(mod|[^{}\s]{1,6})\}|\*\*([^*]+)\*\*/g;
    let i = 0, m;
    while ((m = re.exec(s))) {
      if (m.index > i) out.push({ t: 'text', v: s.slice(i, m.index) });
      if (m[1] != null) out.push({ t: 'tex', v: m[1] });
      else if (m[2] != null) out.push({ t: 'kbd', v: m[2] });
      else out.push({ t: 'b', v: m[3] });
      i = re.lastIndex;
    }
    if (i < s.length) out.push({ t: 'text', v: s.slice(i) });
    return out;
  }
  // TeX -> readable text (screen readers, and the page before MathJax has loaded)
  const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', n: 'ⁿ', z: 'ᶻ', i: 'ⁱ', '-': '⁻', '+': '⁺' };
  const SUBS = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉', k: 'ₖ', n: 'ₙ', t: 'ₜ', i: 'ᵢ' };
  function texPlain(src) {
    let s = String(src);
    const grp = '\\{((?:[^{}]|\\{[^{}]*\\})*)\\}';
    for (let k = 0; k < 3; k++) s = s.replace(new RegExp('\\\\[dt]?frac' + grp + grp, 'g'), (m, a, b) => `${/^\w+$/.test(a) ? a : '(' + a + ')'}/${/^\w+$/.test(b) ? b : '(' + b + ')'}`);
    // a name (Im, log, an \operatorname) is set off by U+0003 marks, so two names written together keep a space
    // between them (\operatorname{Im}\log z: "Im log z", not "Imlog z"); the marks are resolved once the names are read
    s = s.replace(/\\operatorname\{(\w+)\}/g, '\u0003$1\u0003').replace(/\\(Re|Im|arg|log|sin|cos|exp)\b/g, '\u0003$1\u0003');
    const WORDS = { pi: 'π', infty: '∞', neq: '≠', ne: '≠', pm: '±', mapsto: '↦', circ: '∘', oint: '∮', int: '∫', cdot: '·', le: '≤', leq: '≤', ge: '≥', geq: '≥', to: '→', gamma: 'γ', zeta: 'ζ', theta: 'θ', alpha: 'α', in: '∈', notin: '∉' };
    s = s.replace(/\\([a-zA-Z]+)/g, (m, w) => (WORDS[w] != null ? WORDS[w] : '\u0003' + w + '\u0003'));
    // a name's mark becomes a space between two letters (Im|log, i|Res), else nothing (sin|(z), log| z, Res|_i)
    s = s.replace(/\u0003+/g, (m, at, all) => (/\p{L}/u.test(all[at - 1] || '') && /\p{L}/u.test(all[at + m.length] || '') ? ' ' : ''));
    // escaped braces are set braces (kept); the others only group
    s = s.replace(/\\\{/g, '\u0001').replace(/\\\}/g, '\u0002');
    s = s.replace(/\\[,;!:]/g, ' ').replace(/\\ /g, ' ');
    const conv = (str, map) => ([...str].every((c) => map[c] != null) ? [...str].map((c) => map[c]).join('') : null);
    s = s.replace(/\^\{([^{}]*)\}|\^(\S)/g, (m, a, b) => { const v = a != null ? a : b; return conv(v, SUP) || '^(' + v + ')'; });
    s = s.replace(/_\{([^{}]*)\}|_(\S)/g, (m, a, b) => { const v = a != null ? a : b; return conv(v, SUBS) || '_' + v; });
    s = s.replace(/[{}]/g, '').replace(/\u0001/g, '{').replace(/\u0002/g, '}');
    return s.replace(/\s*([<>=≠≤≥])\s*/g, ' $1 ').replace(/± (?=\w)/g, '±').replace(/\s+/g, ' ').trim();
  }
  function plainCopy(s, mod) {
    return parseCopy(s).map((t) => (t.t === 'tex' ? texPlain(t.v) : t.t === 'kbd' ? (t.v === 'mod' ? mod : t.v) : t.v)).join('');
  }
  // Where the callout goes. hole: the lit area the step is about, {l, t, r, b}, or null (a centred card); card: {w, h};
  // vp: {w, h}. opt.others: more lit areas (kept clear too); opt.prefer: the preferred side; opt.avoid: rects inside
  // the hole to keep clear when the card has to sit in it (an array, or a function called only then); opt.narrow: the
  // width below which the card is a sheet. Returns {mode: 'center' | 'side' | 'inset' | 'sheet' | 'float', side, x, y, caret}:
  // side is right/left/bottom/top beside the hole (caret: where along the card's edge its pointer sits) or, for a
  // sheet, top/middle/bottom; 'float' is the last resort, the place that covers the least of what is lit. The first
  // place that covers no lit area wins.
  const M = 12, GAP = 14;
  function place(hole, card, vp, opt = {}) {
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const others = (opt.others || []).filter(Boolean);
    const lit = hole ? [hole].concat(others) : others;
    const over = (x, y, rects, m = 4) => rects.reduce((s, h) => s + Math.max(0, Math.min(x + card.w, h.r + m) - Math.max(x, h.l - m)) * Math.max(0, Math.min(y + card.h, h.b + m) - Math.max(y, h.t - m)), 0);
    if (vp.w < (opt.narrow || 640)) {
      // a sheet across the bottom or the top, or in a gap between lit areas
      const ys = [];
      const low = hole && (hole.t + hole.b) / 2 > vp.h * 0.55;
      ys.push(['bottom', vp.h - card.h - M], ['top', M]);
      if (low) ys.reverse();
      const sorted = lit.slice().sort((a, b) => a.t - b.t);
      for (let i = 0; i + 1 < sorted.length; i++) {
        const g0 = sorted[i].b, g1 = sorted[i + 1].t;
        if (g1 - g0 >= card.h + 16) ys.push(['middle', Math.round(g0 + (g1 - g0 - card.h) / 2)]);
      }
      let best = null;
      for (const [side, y] of ys) {
        const o = over(M, y, lit, 2);
        if (!best || o < best.o) best = { side, y, o };
        if (o === 0) break;
      }
      return { mode: 'sheet', side: best.side, x: M, y: Math.round(best.y), caret: null };
    }
    if (!hole) return { mode: 'center', side: null, x: Math.round((vp.w - card.w) / 2), y: Math.round((vp.h - card.h) / 2), caret: null };
    // the four places beside R, centred on c (default: R's centre) along the shared edge
    const sides = (R, c) => {
      const cx = c ? c.x : (R.l + R.r) / 2, cy = c ? c.y : (R.t + R.b) / 2;
      return {
        right: R.r + GAP + card.w + M <= vp.w && { x: R.r + GAP, y: clamp(cy - card.h / 2, M, vp.h - card.h - M) },
        left: R.l - GAP - card.w >= M && { x: R.l - GAP - card.w, y: clamp(cy - card.h / 2, M, vp.h - card.h - M) },
        bottom: R.b + GAP + card.h + M <= vp.h && { x: clamp(cx - card.w / 2, M, vp.w - card.w - M), y: R.b + GAP },
        top: R.t - GAP - card.h >= M && { x: clamp(cx - card.w / 2, M, vp.w - card.w - M), y: R.t - GAP - card.h },
      };
    };
    const order = ['right', 'left', 'bottom', 'top'];
    if (order.includes(opt.prefer)) order.unshift(...order.splice(order.indexOf(opt.prefer), 1));
    const cands = [];
    // 1. beside the hole, its pointer at the hole's centre (kept off the card's rounded corners)
    const hx = opt.point ? opt.point.x : (hole.l + hole.r) / 2, hy = opt.point ? opt.point.y : (hole.t + hole.b) / 2;
    const s1 = sides(hole, { x: hx, y: hy });
    for (const side of order) {
      const p = s1[side];
      if (!p) continue;
      const caret = side === 'right' || side === 'left' ? clamp(hy - p.y, 18, card.h - 18) : clamp(hx - p.x, 18, card.w - 18);
      cands.push({ mode: 'side', side, x: p.x, y: p.y, caret });
    }
    // 2. beside all the lit areas together (no pointer: it would point at a gap)
    if (others.length) {
      const U = lit.reduce((u, h) => ({ l: Math.min(u.l, h.l), t: Math.min(u.t, h.t), r: Math.max(u.r, h.r), b: Math.max(u.b, h.b) }));
      const s2 = sides(U);
      for (const side of order) if (s2[side]) cands.push({ mode: 'side', side, x: s2[side].x, y: s2[side].y, caret: null });
    }
    for (const c of cands) if (over(c.x, c.y, lit) === 0) return fin(c);
    // 2b. below or above the hole, short of room by a little: at the viewport's edge there, over the hole's rim only
    // (Preimages at 900 px: under Y, over Y's bottom margin, not inside Y over its disc)
    for (const side of order) {
      let y = null;
      if (side === 'bottom') { const v = vp.h - card.h - M; if (v < hole.b + GAP && v > hole.b - 0.12 * card.h) y = v; }
      else if (side === 'top') { const v = M; if (v + card.h > hole.t - GAP && v + card.h < hole.t + 0.12 * card.h) y = v; }
      if (y == null) continue;
      const x = clamp(hx - card.w / 2, M, vp.w - card.w - M);
      if (over(x, y, lit) <= 0.12 * card.w * card.h && over(x, y, others) === 0) return fin({ mode: 'edge', side, x, y, caret: null });
    }
    // 3. no room beside it (a panel as wide as the stage): inside the hole, in the corner with the fewest controls
    if (hole.r - hole.l >= card.w + 32 && hole.b - hole.t >= card.h + 32) {
      const avoid = (typeof opt.avoid === 'function' ? opt.avoid() : opt.avoid) || [];
      const ins = [[hole.l + 16, hole.b - 16 - card.h], [hole.r - 16 - card.w, hole.b - 16 - card.h], [hole.l + 16, hole.t + 16], [hole.r - 16 - card.w, hole.t + 16]]
        .map(([x, y]) => ({ mode: 'inset', side: null, x: clamp(x, M, vp.w - card.w - M), y: clamp(y, M, vp.h - card.h - M), caret: null }));
      let best = null;
      for (const c of ins) { const o = over(c.x, c.y, avoid, 6) + over(c.x, c.y, others); if (!best || o < best.o) best = Object.assign(c, { o }); }
      return fin(best);
    }
    // 4. a small screen: the place that covers the least of what is lit, without a pointer
    cands.push(...[[M, M], [vp.w - card.w - M, M], [M, vp.h - card.h - M], [vp.w - card.w - M, vp.h - card.h - M]].map(([x, y]) => ({ mode: 'float', side: null, x, y, caret: null })));
    let best = null;
    for (const c of cands) { const o = over(c.x, c.y, lit); if (!best || o < best.o) best = Object.assign(c, { o }); }
    return fin(Object.assign(best, { mode: 'float', caret: null }));
    function fin(c) { return { mode: c.mode, side: c.side, x: Math.round(c.x), y: Math.round(c.y), caret: c.caret == null ? null : Math.round(c.caret) }; }
  }
  // The lit areas of a step from its padded rects (the anchor's first): areas that mostly overlap merge into one (the
  // anchor inside a lit panel: the panel is lit and the anchor gets a ring of its own, `mark`); areas that only touch
  // are trimmed apart, since an even-odd shade would dim their overlap again. Returns {holes (the anchor's first), mark}.
  function litAreas(rects) {
    const area = (h) => Math.max(0, h.r - h.l) * Math.max(0, h.b - h.t);
    const hs = rects.map((r, i) => ({ l: r.l, t: r.t, r: r.r, b: r.b, src: [i] }));
    for (let again = true; again;) {
      again = false;
      for (let i = 0; i < hs.length && !again; i++) {
        for (let j = i + 1; j < hs.length && !again; j++) {
          const A = hs[i], B = hs[j];
          const ov = { l: Math.max(A.l, B.l), t: Math.max(A.t, B.t), r: Math.min(A.r, B.r), b: Math.min(A.b, B.b) };
          if (ov.r <= ov.l || ov.b <= ov.t) continue;
          if (area(ov) >= 0.5 * Math.min(area(A), area(B))) {
            hs[i] = { l: Math.min(A.l, B.l), t: Math.min(A.t, B.t), r: Math.max(A.r, B.r), b: Math.max(A.b, B.b), src: A.src.concat(B.src) };
            hs.splice(j, 1);
          } else if (ov.r - ov.l <= ov.b - ov.t) {
            const mid = (ov.l + ov.r) / 2, [P, Q] = A.l <= B.l ? [A, B] : [B, A];
            P.r = mid - 2; Q.l = mid + 2;
          } else {
            const mid = (ov.t + ov.b) / 2, [P, Q] = A.t <= B.t ? [A, B] : [B, A];
            P.b = mid - 2; Q.t = mid + 2;
          }
          again = true;
        }
      }
    }
    const k = hs.findIndex((h) => h.src.includes(0));
    if (k > 0) hs.unshift(hs.splice(k, 1)[0]);
    const r0 = rects[0], h0 = hs[0];
    const mark = h0 && h0.src.length > 1 && (h0.r - h0.l) * (h0.b - h0.t) > 1.3 * area(r0) ? { l: r0.l, t: r0.t, r: r0.r, b: r0.b } : null;
    return { holes: hs.map((h) => ({ l: h.l, t: h.t, r: h.r, b: h.b })), mark };
  }
  // the persisted record, with defaults for anything missing or malformed
  function normRec(r) {
    r = r && typeof r === 'object' ? r : {};
    return {
      v: Number.isFinite(r.v) ? r.v : 0,
      shown: Number.isFinite(r.shown) ? r.shown : 0,
      outcome: r.outcome === 'taken' || r.outcome === 'dismissed' ? r.outcome : null,
      done: r.done && typeof r.done === 'object' ? Object.assign({}, r.done) : {},
      last: r.last && typeof r.last.ch === 'string' ? { ch: r.last.ch, i: r.last.i | 0 } : null,
    };
  }
  const seenRec = (r) => r.outcome != null || Object.keys(r.done).length > 0 || r.last != null;
  const shouldSuggest = (r) => !seenRec(r) && r.shown < SUGGEST_MAX;
  const chapterDone = (r, ch) => (r.done[ch.id] || 0) >= ch.rev;
  const chapterNew = (r, ch) => r.v > 0 && ch.rev > r.v;

  // ---------------------------------------------------------------- state
  let api = {}, rec = normRec(null), inited = false;
  let run = null;        // the running tour: {chs, ci, si, snap, scene, seq, opener, offs, ui, ...}
  let sugg = null;       // the suggestion card
  let menu = null;       // the help menu
  const doc = () => (typeof document !== 'undefined' ? document : null);
  const mac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
  const modKey = () => (mac() ? '⌘' : 'Ctrl');
  const sk = (k) => { try { return (api.storageKey && api.storageKey(k)) || k; } catch (e) { return k; } };
  const KEY = 'cmw-tour', STASH = 'cmw-tour-stash', LIVE = 'cmw-tour-live';
  // this page's id: the stash and its heartbeat name the page whose tour holds them, so another tab never takes them
  const PAGE = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const BEAT_MS = 2000, BEAT_STALE = 6000;
  let lastToast = null, recheckT = 0;
  function load() { try { rec = normRec(JSON.parse(localStorage.getItem(sk(KEY)) || 'null')); } catch (e) { rec = normRec(null); } return rec; }
  function save() { try { localStorage.setItem(sk(KEY), JSON.stringify(rec)); } catch (e) { /* storage unavailable: the tour still runs */ } }
  const call = (name, ...a) => { try { return typeof api[name] === 'function' ? api[name](...a) : undefined; } catch (e) { warn(name, e); return false; } };
  const warn = (what, e) => { try { console.warn('[tour]', what, e && e.message ? e.message : e); } catch (x) { /* */ } };
  const reduced = () => {
    try {
      const v = getComputedStyle(document.documentElement).getPropertyValue('--t-slow').trim();
      if (v === '0ms' || v === '0s') return true;
      return matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) { return false; }
  };
  const frames = (n = 2) => new Promise((res) => { const f = () => (--n <= 0 ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); });
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
  const narrow = () => (typeof innerWidth === 'number' ? innerWidth < 640 : false);
  // a touch screen: no hover, no right-click, no key hints
  const coarse = () => { try { return matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } };
  const phone = () => narrow() || coarse();
  // where the tour lives: the help button, or the ⋯ menu that holds it on a phone
  const helpWhere = () => (anchorEl('helpBtn') ? $t('Help') : anchorEl('moreBtn') ? $t('⋯ › Help') : $t('Help'));
  // the copy a step shows here: by the scene shown, on a touch screen, below 640 px, else its body
  function copyFor(step, scene, o = {}) {
    const isCoarse = o.coarse != null ? o.coarse : coarse(), isNarrow = o.narrow != null ? o.narrow : narrow();
    if (step.byScene && scene != null && step.byScene[scene]) return $t(step.byScene[scene]);
    // the anchor found was the ⋯ menu (the control itself lives in it here): the copy that says "in this menu"
    if (o.menu && step.narrow) return $t(step.narrow);
    if (isCoarse && step.touch) return $t(step.touch);
    if ((isNarrow || isCoarse) && step.narrow) return $t(step.narrow);
    return $t(step.body);
  }
  const tryFor = (t, o = {}) => $t((o.coarse != null ? o.coarse : coarse()) && t.touch ? t.touch : t.text);
  // a step's Try it here (tryWide: not below 640 px, where what it asks for is off-screen)
  const tryOf = (step) => (step.try && !(step.tryWide && narrow()) ? step.try : null);

  function el(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids) if (k != null) e.append(k);
    return e;
  }
  // copy -> DOM (TeX through the app's renderer when it has one)
  function richText(s) {
    const frag = document.createDocumentFragment();
    const toks = parseCopy(s);
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (t.t === 'text') frag.append(t.v);
      else if (t.t === 'b') frag.append(el('b', null, t.v));
      else if (t.t === 'kbd') frag.append(el('span', { class: 'kbd' }, t.v === 'mod' ? modKey() : t.v));
      else {
        let m = null;
        const tex = notation(t.v);
        try { m = api.tex ? api.tex(tex) : null; } catch (e) { m = null; }
        if (!(m && m.nodeType)) m = el('span', { class: 'tour-math' }, texPlain(tex));
        if (m.setAttribute && !m.getAttribute('aria-label')) m.setAttribute('aria-label', texPlain(tex));
        // punctuation right after a formula stays on its line
        const nx = toks[i + 1], pm = nx && nx.t === 'text' ? /^[.,;:!?)]+/.exec(nx.v) : null;
        if (pm) { frag.append(el('span', { class: 'tour-nb' }, m, pm[0])); nx.v = nx.v.slice(pm[0].length); }
        else frag.append(m);
      }
    }
    return frag;
  }

  // ---------------------------------------------------------------- anchors
  function visible(e) {
    if (!e || !e.isConnected) return false;
    if (typeof e.checkVisibility === 'function' && !e.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true })) return false;
    const r = e.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  }
  function anchorEl(names) {
    for (const n of [].concat(names)) {
      let e;
      try { e = api.anchor ? api.anchor(n) : undefined; } catch (x) { e = undefined; }
      if (e === undefined && ANCHORS[n]) { try { e = typeof ANCHORS[n] === 'function' ? ANCHORS[n]() : document.querySelector(ANCHORS[n]); } catch (x) { e = null; } }
      if (visible(e)) return e;
    }
    return null;
  }
  // the part of e that can be seen: its box cut by every scrolling or clipping ancestor (a side panel that scrolls)
  function seenBox(e) {
    const r = e.getBoundingClientRect();
    let l = r.left, t = r.top, rr = r.right, b = r.bottom;
    for (let a = e.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
      // a box that cannot clip: display: contents (the header's popover on a wide screen: auto overflow, a 0 × 0 box)
      if (cs.display === 'contents') continue;
      const q = a.getBoundingClientRect();
      if (q.width === 0 && q.height === 0) continue;
      l = Math.max(l, q.left); t = Math.max(t, q.top); rr = Math.min(rr, q.right); b = Math.min(b, q.bottom);
    }
    return { l, t, r: Math.max(l, rr), b: Math.max(t, b), full: r };
  }
  function rectOf(e, pad) {
    const s = seenBox(e), W = innerWidth, H = innerHeight;
    const l = Math.max(2, s.l - pad), t = Math.max(2, s.t - pad), rr = Math.min(W - 2, s.r + pad), b = Math.min(H - 2, s.b + pad);
    return { l, t, r: Math.max(l, rr), b: Math.max(t, b) };
  }

  // ---------------------------------------------------------------- styles
  const CSS = `
/* the spotlight's shade: the app's ink, a little deeper than the modal scrim so the lit patch reads at a glance */
:root { --tour-scrim: #121A2080; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --tour-scrim: #000000A3; } }
:root[data-theme="dark"] { --tour-scrim: #000000A3; }
.tour-root { position: fixed; inset: 0; z-index: 25; pointer-events: none; }
.tour-dim { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.tour-dim .tour-shade { fill: var(--tour-scrim); pointer-events: visiblePainted; cursor: default; }
.tour-dim .tour-ring { fill: none; stroke: var(--accent); stroke-width: 1.5; pointer-events: none; }
.tour-dim .tour-glow { fill: none; stroke: var(--accent); stroke-opacity: 0.22; stroke-width: 7; pointer-events: none; }
.tour-dim .tour-mark { fill: none; stroke: var(--accent); stroke-width: 1.5; stroke-dasharray: 4 3; pointer-events: none; }
.tour-card {
  position: fixed; z-index: 35; left: 0; top: 0; width: 320px; max-width: calc(100vw - 24px); pointer-events: auto;
  background: var(--surface); border: 1px solid var(--line-strong); border-radius: var(--r-4, 6px); box-shadow: var(--shadow-3);
  color: var(--ink); font: var(--t-body); text-align: left; outline: none;
  transition: opacity var(--t-med) var(--ease-out), translate var(--t-med) var(--ease-out);
}
.tour-card.center { width: 380px; }
.tour-card.entering { opacity: 0; translate: 0 4px; }
.tour-card.sheet { width: auto; right: max(12px, env(safe-area-inset-right, 0px)); left: max(12px, env(safe-area-inset-left, 0px)) !important; max-width: none; }
.tour-card.sheet[data-edge="bottom"] { top: auto !important; bottom: calc(12px + env(safe-area-inset-bottom, 0px)); }
.tour-card.nudge { animation: tour-nudge 320ms var(--ease-std); }
@keyframes tour-nudge { 30% { translate: 0 -3px; } 60% { translate: 0 1px; } }
.tour-bar { position: absolute; left: -1px; right: -1px; top: -1px; height: 3px; border-radius: var(--r-4, 6px) var(--r-4, 6px) 0 0; overflow: hidden; background: transparent; }
.tour-bar > i { display: block; height: 100%; width: 0; background: var(--accent); transition: width var(--t-slow) var(--ease-std); }
.tour-in { padding: 14px 16px 12px; }
.tour-head { display: flex; align-items: center; gap: 8px; min-height: 20px; margin: -2px -6px 2px 0; }
.tour-chap { flex: 1 1 auto; font: var(--t-caption); color: var(--muted); letter-spacing: 0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tour-x { width: 24px; height: 24px; }
.tour-title { margin: 0 0 6px; font: 600 15px/20px var(--f-ui); color: var(--ink); text-wrap: balance; }
.tour-body { margin: 0; font: 400 13px/19px var(--f-ui); color: var(--ink-2); text-wrap: pretty; }
.tour-body .kbd, .tour-try .kbd { margin: 0 1px; }
.tour-body mjx-container, .tour-try mjx-container { font-size: 106% !important; color: var(--ink); }
.tour-math { font: italic 500 14px/1 var(--f-math); color: var(--ink); white-space: nowrap; }
.tour-nb { white-space: nowrap; }
.tour-try {
  display: flex; align-items: flex-start; gap: 8px; margin: 12px 0 0; padding: 8px 10px;
  background: var(--accent-soft); border-radius: var(--r-3, 4px); font: 400 13px/18px var(--f-ui); color: var(--ink);
}
.tour-try > b { font-weight: 600; color: var(--accent); white-space: nowrap; }
.tour-try .tour-tick { flex: 0 0 16px; width: 16px; height: 16px; margin-top: 1px; border-radius: 50%; border: 1.5px solid var(--accent); display: grid; place-items: center; }
.tour-try .tour-tick svg { width: 10px; height: 10px; opacity: 0; transform: scale(0.6); transition: opacity var(--t-med) var(--ease-out), transform var(--t-med) var(--ease-out); }
.tour-try.done .tour-tick { background: var(--accent); }
.tour-try.done .tour-tick svg { opacity: 1; transform: none; color: var(--accent-ink); }
.tour-foot { display: flex; align-items: center; gap: 6px; margin-top: 14px; }
.tour-count { flex: 1 1 auto; font: var(--t-readout); color: var(--muted); white-space: nowrap; }
.tour-foot .btn { white-space: nowrap; }
.tour-foot .btn.primary.ready { box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 28%, transparent); }
.tour-caret { position: absolute; width: 12px; height: 12px; background: var(--surface); border: 1px solid var(--line-strong); rotate: 45deg; }
.tour-card[data-side="right"] .tour-caret { left: -7px; top: calc(var(--caret) - 6px); border-top: 0; border-right: 0; }
.tour-card[data-side="left"] .tour-caret { right: -7px; top: calc(var(--caret) - 6px); border-bottom: 0; border-left: 0; }
.tour-card[data-side="bottom"] .tour-caret { top: -7px; left: calc(var(--caret) - 6px); border-bottom: 0; border-right: 0; }
.tour-card[data-side="top"] .tour-caret { bottom: -7px; left: calc(var(--caret) - 6px); border-top: 0; border-left: 0; }
.tour-card:not([data-side]) .tour-caret, .tour-card[data-side=""] .tour-caret { display: none; }
.tour-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
/* the first-run suggestion: a quiet card under the help button, never modal */
.tour-suggest {
  position: fixed; z-index: 35; width: 340px; max-width: calc(100vw - 24px); padding: 14px 14px 12px 16px;
  background: var(--surface); border: 1px solid var(--line-strong); border-radius: var(--r-4, 6px); box-shadow: var(--shadow-3);
  color: var(--ink); font: var(--t-body); animation: pop-in var(--t-med) var(--ease-out);
}
.tour-suggest .tour-caret { top: -7px; left: calc(var(--caret, 300px) - 6px); border-bottom: 0; border-right: 0; }
.tour-suggest.no-caret .tour-caret { display: none; }
.tour-sg-row { display: flex; gap: 12px; align-items: flex-start; }
.tour-sg-mark { flex: 0 0 28px; width: 28px; height: 28px; margin-top: 1px; }
.tour-sg-text { flex: 1 1 auto; min-width: 0; }
.tour-sg-title { margin: 0 0 4px; font: 600 14px/19px var(--f-ui); color: var(--ink); }
.tour-sg-body { margin: 0; font: 400 13px/18px var(--f-ui); color: var(--ink-2); text-wrap: pretty; }
.tour-sg-acts { display: flex; gap: 6px; margin-top: 12px; }
.tour-sg-x { margin: -6px -6px 0 0; }
.tour-suggest .tour-sg-pill { display: none; }
.tour-suggest.compact { width: auto; padding: 4px; }
.tour-suggest.compact .tour-sg-row { display: none; }
.tour-suggest.compact .tour-sg-pill { display: inline-flex; align-items: center; gap: 6px; }
.tour-sg-pill svg { width: 14px; height: 14px; color: var(--accent); }
.tour-sg-pill .tour-time { font: 400 11px/16px var(--f-mono); color: var(--faint); }
.tour-suggest.closing, .tour-card.closing { animation: fade-out var(--t-fast) linear forwards; }
@media (max-width: 639px) {
  .tour-suggest { left: max(12px, env(safe-area-inset-left, 0px)) !important; right: max(12px, env(safe-area-inset-right, 0px)); width: auto; max-width: none; }
  .tour-suggest.compact { left: auto !important; }
  .tour-suggest .tour-caret { display: none; }
  .tour-foot .btn { height: 36px; padding: 0 14px; }
  .tour-x { width: 32px; height: 32px; }
}
/* the help menu (the app's menu component, plus a chapter row) */
.pop.menu.tour-menu { min-width: 264px; }
.tour-menu .mi { gap: 10px; }
.tour-menu .tour-num { flex: 0 0 16px; font: var(--t-readout); color: var(--faint); text-align: right; }
.tour-menu .tour-time { font: 400 11px/16px var(--f-mono); color: var(--faint); }
.tour-menu .tour-done { flex: 0 0 14px; width: 14px; height: 14px; color: var(--good); }
.tour-menu .tour-done svg { width: 14px; height: 14px; display: block; }
.tour-menu .tour-new { font: var(--t-caption); color: var(--accent); }
.tour-menu .mi.tour-continue { height: auto; min-height: 40px; padding-top: 4px; padding-bottom: 4px; white-space: normal; }
.tour-menu .tour-sub { display: block; font: 400 11.5px/16px var(--f-ui); color: var(--muted); }
@media (prefers-reduced-motion: reduce) { .tour-card, .tour-bar > i, .tour-try .tour-tick svg { transition: none; } .tour-card.nudge, .tour-suggest { animation: none; } }
`;
  // a polite announcement outside the tour (the suggestion): one shared live region
  function say(text) {
    let n = document.getElementById('tourSay');
    if (!n) { n = el('div', { id: 'tourSay', class: 'tour-sr', 'aria-live': 'polite', 'aria-atomic': 'true' }); document.body.append(n); }
    n.textContent = '';
    setTimeout(() => { n.textContent = text; }, 60);
  }
  function injectCSS() {
    if (document.getElementById('tourCSS')) return;
    document.head.append(el('style', { id: 'tourCSS' }, CSS));
  }
  const ICON_X = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>';
  const ICON_CHECK = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-7"/></svg>';
  const ICON_PLAY = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="currentColor"><path d="M5 3.5v9l7.5-4.5z"/></svg>';
  const ICON_BOOK = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M2.5 3.5c2-.8 3.8-.6 5.5.7v9c-1.7-1.3-3.5-1.5-5.5-.7zM13.5 3.5c-2-.8-3.8-.6-5.5.7v9c1.7-1.3 3.5-1.5 5.5-.7z"/></svg>';
  const ICON_KEYS = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="1.5" y="4" width="13" height="8.5" rx="1.5"/><path d="M4 7h.01M6.5 7h.01M9 7h.01M11.5 7h.01M5 10h6"/></svg>';
  const mark = () => {
    const m = document.querySelector('header svg.mark');
    return m ? `<svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true">${m.innerHTML}</svg>` : '';
  };

  // ---------------------------------------------------------------- spotlight
  // One SVG: a full-screen shade with rounded holes (even-odd), so clicks on the shade stop and clicks in a hole reach
  // the app; a 1.5px accent ring and a soft glow around each hole. Holes animate in JS (CSS cannot animate a path in
  // every browser).
  function rrPath(h) {
    const w = h.r - h.l, ht = h.b - h.t, r = Math.max(0, Math.min(h.rad, w / 2, ht / 2));
    return `M${h.l + r} ${h.t}H${h.r - r}A${r} ${r} 0 0 1 ${h.r} ${h.t + r}V${h.b - r}A${r} ${r} 0 0 1 ${h.r - r} ${h.b}H${h.l + r}A${r} ${r} 0 0 1 ${h.l} ${h.b - r}V${h.t + r}A${r} ${r} 0 0 1 ${h.l + r} ${h.t}Z`;
  }
  function drawHoles(ui, holes, mark) {
    const W = innerWidth, H = innerHeight;
    ui.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    ui.shade.setAttribute('d', `M0 0H${W}V${H}H0Z` + holes.map(rrPath).join(''));
    const rings = holes.map(rrPath).join('');
    ui.ring.setAttribute('d', rings);
    ui.glow.setAttribute('d', rings);
    if (mark !== undefined) ui.mark.setAttribute('d', mark ? rrPath(mark) : '');
    ui.holes = holes;
  }
  function animateHoles(ui, to, mark, dur) {
    cancelAnimationFrame(ui.raf);
    const from = ui.holes || [];
    // the inner ring appears once the shade has settled
    ui.mark.setAttribute('d', '');
    const ms = dur;
    if (!ms || reduced() || !from.length || !to.length) { drawHoles(ui, to, mark); return; }
    // pairs morph; a hole without a partner grows from (or into) the first partner's rectangle
    const n = Math.max(from.length, to.length);
    const A = [], B = [];
    for (let i = 0; i < n; i++) { A.push(from[i] || from[0]); B.push(to[i] || to[0]); }
    const t0 = performance.now();
    const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
    const lerp = (a, b, u) => a + (b - a) * u;
    const frame = (now) => {
      const u = ease(Math.min(1, (now - t0) / ms));
      drawHoles(ui, A.map((a, i) => { const b = B[i]; return { l: lerp(a.l, b.l, u), t: lerp(a.t, b.t, u), r: lerp(a.r, b.r, u), b: lerp(a.b, b.b, u), rad: lerp(a.rad, b.rad, u) }; }));
      if (u < 1) ui.raf = requestAnimationFrame(frame); else drawHoles(ui, to, mark);
    };
    ui.raf = requestAnimationFrame(frame);
  }

  function buildUI() {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'tour-dim'); svg.setAttribute('aria-hidden', 'true');
    const mk = (cls) => { const p = document.createElementNS(NS, 'path'); p.setAttribute('class', cls); return p; };
    const shade = mk('tour-shade'), glow = mk('tour-glow'), ring = mk('tour-ring'), markP = mk('tour-mark');
    shade.setAttribute('fill-rule', 'evenodd');
    svg.append(shade, glow, ring, markP);
    const live = el('div', { class: 'tour-sr', 'aria-live': 'polite', 'aria-atomic': 'true' });
    const root = el('div', { class: 'tour-root', 'data-tour': 'root' }, svg, live);
    const bar = el('i');
    const chap = el('span', { class: 'tour-chap' });
    const x = el('button', { class: 'icon-btn tour-x', type: 'button', 'aria-label': $t('End the tour'), title: $t('End the tour') + '  Esc' });
    x.innerHTML = ICON_X;
    const title = el('h2', { class: 'tour-title', id: 'tourTitle' });
    const body = el('p', { class: 'tour-body', id: 'tourBody' });
    const tryBox = el('div', { class: 'tour-try', hidden: true });
    const count = el('span', { class: 'tour-count' });
    const back = el('button', { class: 'btn ghost', type: 'button' }, $t('Back'));
    const done = el('button', { class: 'btn ghost', type: 'button', hidden: true }, $t('Done'));
    const next = el('button', { class: 'btn primary', type: 'button' }, $t('Next'));
    const caret = el('span', { class: 'tour-caret', 'aria-hidden': 'true' });
    const card = el('div', { class: 'tour-card entering', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'tourTitle', 'aria-describedby': 'tourBody', tabindex: '-1', 'data-tour': 'card' },
      el('div', { class: 'tour-bar', 'aria-hidden': 'true' }, bar), caret,
      el('div', { class: 'tour-in' }, el('div', { class: 'tour-head' }, chap, x), title, body, tryBox, el('div', { class: 'tour-foot' }, count, back, done, next)));
    root.append(card);
    document.body.append(root);
    return { root, svg, shade, glow, ring, mark: markP, live, card, bar, chap, x, title, body, tryBox, count, back, done, next, holes: null, raf: 0 };
  }

  // ---------------------------------------------------------------- the run
  function chapterIndex(id) { const i = CHAPTERS.findIndex((c) => c.id === id); return i < 0 ? 0 : i; }

  // The user's work while the tour borrows the canvas (INTEGRATION.md §3). The tour changes the scene only when it can
  // put the work back: snapshot, restore and loadScene exist, snapshot() gave a value, and the saved copy on disk is
  // safe, either because the app paused its autosave (api.sandbox(true)) or because the backup stash was written and
  // read back. Otherwise it runs without scenes: only the steps that change nothing are shown.
  const fn = (k) => typeof api[k] === 'function';
  function borrow() {
    if (!(fn('snapshot') && fn('restore') && fn('loadScene'))) { warn('no scenes', 'snapshot, restore and loadScene are required to show the tour\'s scenes'); return null; }
    let paused = false;
    if (fn('sandbox')) { try { paused = api.sandbox(true) !== false; } catch (e) { warn('sandbox', e); } }
    let snap = null;
    try { snap = api.snapshot(); } catch (e) { warn('snapshot', e); snap = null; }
    if (snap == null) { if (paused) call('sandbox', false); warn('no scenes', 'snapshot() gave nothing'); return null; }
    const stashed = writeStash(snap, paused);
    if (!paused && !stashed) { warn('no scenes', 'the autosave is not paused and the backup could not be stored'); return null; }
    return { snap, paused, stashed };
  }
  // the backup: only the persisted part of the snapshot (snap.state when it has one: the undo history stays in memory),
  // checked by reading it back. Its heartbeat (LIVE) tells other pages that this one is using it
  const stashOf = (snap) => (snap && typeof snap === 'object' && 'state' in snap ? { state: snap.state } : snap);
  // (paused: the app's autosave is held, so the saved copy is the user's work, as savedMark() fingerprints it now)
  function writeStash(snap, paused) {
    let mark = null;
    try { mark = fn('savedMark') ? api.savedMark() : null; } catch (e) { mark = null; }
    try {
      const v = JSON.stringify({ page: PAGE, snap: stashOf(snap), paused: !!paused, mark });
      localStorage.setItem(sk(STASH), v);
      if (localStorage.getItem(sk(STASH)) !== v) return false;
      beat();
      return true;
    } catch (e) { warn('stash', e); try { localStorage.removeItem(sk(STASH)); } catch (x) { /* */ } return false; }
  }
  function beat() { try { localStorage.setItem(sk(LIVE), JSON.stringify({ page: PAGE, t: Date.now() })); } catch (e) { /* */ } }
  // this page is going away (a reload, a closed tab): its heartbeat goes with it, so the next page recovers at once
  function unbeat() {
    try { const live = JSON.parse(localStorage.getItem(sk(LIVE)) || 'null'); if (live && live.page === PAGE) localStorage.removeItem(sk(LIVE)); } catch (e) { /* */ }
  }
  function dropStash() { try { localStorage.removeItem(sk(STASH)); localStorage.removeItem(sk(LIVE)); } catch (e) { /* */ } }

  // Synchronous up to the new run (a second start in the same tick finds it and takes it over, never a fresh snapshot
  // of the tour's own scene); the only wait is the first step.
  function start(opt = {}) {
    if (!doc()) return Promise.resolve(false);
    if (!inited) init(api);
    // a "Your work is back" toast from the tour that just ended would sit over this one's controls
    if (lastToast && lastToast.isConnected) lastToast.remove();
    lastToast = null;
    hideSuggest(false);
    closeMenu(false);
    const ci = chapterIndex(opt.chapter);
    // a chapter started from inside a running tour (its help step lights the help button): the snapshot taken when the
    // first tour began stays, and the app is not told that the tour ended and began again
    let lend = null, opener = opt.opener || null;
    const prev = run;
    if (prev) { lend = prev.lend; opener = opener || prev.opener; stop({ silent: true, keepWork: true }); }
    else lend = borrow();
    if (!opener) opener = document.activeElement !== document.body ? document.activeElement : null;
    const r = { ci, si: 0, lend, snap: lend ? lend.snap : null, scenes: !!lend, scene: undefined, sceneOk: {}, seq: 0, opener, offs: [], tryOffs: [], skipped: new Set(), absent: new Set(), ui: null, el: null, step: null, dir: 1, timer: 0, tracked: null };
    // steps on a feature this build does not have (api.has), or that need a scene the tour cannot borrow, are left out
    // from the start, so the count is right
    CHAPTERS.forEach((c, i) => c.steps.forEach((st, j) => { if (absent(i, j, r.scenes)) r.absent.add(skipKey(i, j)); }));
    const first = seek(ci, Math.min(Math.max(0, opt.step | 0), CHAPTERS[ci].steps.length - 1), 1, (a, b) => r.absent.has(skipKey(a, b)));
    if (!first || first.ci !== ci) {
      // nothing of this chapter can be shown here
      if (lend) giveBack(lend, true);
      if (prev) call('onTour', false);
      call('toast', $t('The tour is not available in this build.'));
      return Promise.resolve(false);
    }
    r.si = first.si;
    rec.outcome = 'taken';
    rec.v = Math.max(rec.v, VERSION);
    save();
    injectCSS();
    r.ui = buildUI();
    run = r;
    wire(r);
    if (!prev) call('onTour', true);
    return show(r.ci, r.si, 1).then(() => true);
  }
  // the user's work back; true when it is (or nothing was borrowed). A failed restore keeps the autosave paused and the
  // backup stash, so the saved copy stays the user's and a reload brings it back
  function giveBack(lend, quiet) {
    if (!lend) return true;
    let ok = false;
    try { ok = api.restore(lend.snap) !== false; } catch (e) { warn('restore', e); ok = false; }
    if (!ok) { if (!quiet) warn('restore', 'the user\'s work could not be put back; the backup is kept'); return false; }
    if (lend.paused) call('sandbox', false);
    dropStash();
    return true;
  }

  function wire(r) {
    const ui = r.ui;
    ui.next.addEventListener('click', () => go(1));
    ui.back.addEventListener('click', () => go(-1));
    ui.done.addEventListener('click', () => stop({ finished: true }));
    ui.x.addEventListener('click', () => stop({}));
    ui.shade.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); nudge(); });
    const onKey = (e) => {
      if (run !== r) return;
      const inCard = ui.card.contains(document.activeElement);
      const idle = document.activeElement === document.body || document.activeElement == null || inCard;
      if (e.key === 'Escape') {
        // Escape in the callout ends the tour. Elsewhere the app's own Escape comes first: a menu, the palette or a
        // dialog, a field being typed in, and whatever the app reports busy (a drawing, a drag, a selection, an open
        // drawer). Only when the app has nothing to cancel does Escape end the tour
        if (!inCard) {
          if (appLayerOpen()) return;
          const a = document.activeElement;
          if (a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable)) return;
          if (appBusy()) return;
        }
        e.preventDefault(); e.stopPropagation(); stop({}); return;
      }
      if (e.key === 'Tab') { if (!appLayerOpen()) trapTab(e); return; }
      // arrows step the tour when nothing else has the focus (Enter stays the app's: it closes a polygon)
      if (!idle || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); go(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); go(-1); }
    };
    document.addEventListener('keydown', onKey, true);
    const onHide = () => { if (run === r && r.lend && r.lend.stashed) unbeat(); };
    const onShow = (e) => { if (e.persisted && run === r && r.lend && r.lend.stashed) beat(); };
    addEventListener('pagehide', onHide);
    addEventListener('pageshow', onShow);
    r.offs.push(() => removeEventListener('pagehide', onHide), () => removeEventListener('pageshow', onShow));
    const onMove = () => track();
    addEventListener('resize', onMove);
    addEventListener('scroll', onMove, true);
    r.offs.push(() => document.removeEventListener('keydown', onKey, true), () => removeEventListener('resize', onMove), () => removeEventListener('scroll', onMove, true));
    // layout changes that fire no event (a panel opening, the chain growing): a cheap check four times a second; the
    // stash's heartbeat every two seconds
    let n = 0;
    r.timer = setInterval(() => { track(); if (r.lend && r.lend.stashed && ++n % Math.round(BEAT_MS / 250) === 0) beat(); }, 250);
    r.offs.push(() => clearInterval(r.timer));
    // the app's hover tooltip sits above the callout: hidden while it would cover it
    const tip = document.querySelector(TIP_SEL);
    if (tip && typeof MutationObserver === 'function') {
      const mo = new MutationObserver(() => guardTip(r));
      mo.observe(tip, { attributes: true, attributeFilter: ['hidden', 'style', 'class'], childList: true });
      r.offs.push(() => { mo.disconnect(); if (tip.dataset.tourHid) { tip.style.visibility = ''; delete tip.dataset.tourHid; } });
    }
  }
  function guardTip(r) {
    const tip = document.querySelector(TIP_SEL);
    if (!tip || run !== r) return;
    const t = tip.getBoundingClientRect(), c = r.ui.card.getBoundingClientRect();
    const shown = !tip.hidden && t.width > 0 && t.height > 0;
    const over = shown && t.left < c.right + 4 && t.right > c.left - 4 && t.top < c.bottom + 4 && t.bottom > c.top - 4;
    if (over && !tip.dataset.tourHid) { tip.dataset.tourHid = '1'; tip.style.visibility = 'hidden'; }
    else if (!over && tip.dataset.tourHid) { delete tip.dataset.tourHid; tip.style.visibility = ''; }
  }
  function appLayerOpen() {
    try { if (fn('layerOpen')) return !!api.layerOpen(); } catch (e) { /* fall through */ }
    return !!document.querySelector('#popHost > .pop, .modal-bg, .pal, .palette, [popover]:popover-open');
  }
  // the app has something of its own that Escape cancels (INTEGRATION.md §3: busy)
  function appBusy() {
    try { if (fn('busy')) return !!api.busy(); } catch (e) { /* fall through */ }
    return !!document.querySelector('#toolMore[open]');
  }
  function trapTab(e) {
    const ui = run.ui;
    // what Tab can reach (a toolbar's roving tabindex is kept: its other buttons have tabindex -1)
    const sel = ':is(button, [href], input, select, textarea, summary, [tabindex]):not([tabindex="-1"]):not([disabled]):not([hidden])';
    const inCard = [...ui.card.querySelectorAll(sel)].filter((x) => x.offsetParent !== null || x === document.activeElement);
    // during a Try it the lit element stays reachable from the keyboard
    const lit = run.step && tryOf(run.step) && run.el ? [...run.el.querySelectorAll(sel)].filter(visible) : [];
    const ring = inCard.concat(lit);
    if (!ring.length) return;
    const i = ring.indexOf(document.activeElement);
    e.preventDefault();
    const j = i < 0 ? 0 : (i + (e.shiftKey ? -1 : 1) + ring.length) % ring.length;
    ring[j].focus();
  }
  function nudge() {
    if (!run || reduced()) return;
    const c = run.ui.card;
    c.classList.remove('nudge'); void c.offsetWidth; c.classList.add('nudge');
    try { c.querySelector('.btn.primary').focus({ preventScroll: true }); } catch (e) { /* */ }
  }

  // the next showable step from (ci, si) in direction dir, crossing chapters; null at either end. skip(ci, si): a step
  // known to be absent from this build
  function seek(ci, si, dir, skip) {
    const d = dir < 0 ? -1 : 1;
    while (ci >= 0 && ci < CHAPTERS.length) {
      const st = CHAPTERS[ci].steps;
      if (si < 0) { ci--; if (ci >= 0) si = CHAPTERS[ci].steps.length - 1; continue; }
      if (si >= st.length) { ci++; si = 0; continue; }
      if (skip && skip(ci, si)) { si += d; continue; }
      return { ci, si };
    }
    return null;
  }
  const isAbsent = (ci, si) => !!run && run.absent.has(skipKey(ci, si));
  const featureOff = (f) => { try { return typeof api.has === 'function' && api.has(f) === false; } catch (e) { return false; } };
  // a scene name, or a list of them: the first whose features this build has (else the last, whose steps are absent)
  function pickScene(k) {
    if (!Array.isArray(k)) return k;
    return k.find((x) => !(SCENES[x] && [].concat(SCENES[x].needs || []).some(featureOff))) || k[k.length - 1];
  }
  // the actions that change the scene or the view: only when the tour can put the user's work back (borrow)
  const CHANGES = new Set(['scene', 'view', 'surface', 'deform', 'focus', 'panel', 'tool', 'look']);
  function absent(ci, si, scenes) {
    const ch = CHAPTERS[ci], st = ch.steps[si], k = sceneAt(ch, si), sc = k != null ? SCENES[k] : null;
    if (scenes === false && (k != null || (st.before || []).some((a) => CHANGES.has(a[0])))) return true;
    if (st.wide && narrow()) return true;
    return [].concat(st.needs || [], (sc && sc.needs) || []).some(featureOff);
  }

  async function go(dir) {
    if (!run) return;
    const r = run;
    const pos = seek(r.ci, r.si + dir, dir, isAbsent);
    if (!pos) { if (dir > 0) stop({ finished: true }); return; }
    // the end of a chapter counts as finishing it
    if (dir > 0 && pos.ci !== r.ci) { rec.done[CHAPTERS[r.ci].id] = CHAPTERS[r.ci].rev; save(); }
    await show(pos.ci, pos.si, dir);
  }

  function loadScene(r, key) {
    if (key == null) return true;
    if (r.scene === key) return r.sceneOk[key] !== false;
    const spec = SCENES[key];
    let ok = !!spec && r.scenes;
    if (ok) {
      const res = call('loadScene', JSON.parse(JSON.stringify(spec)));
      ok = res !== false;
      // the display the copy assumes (the user's own look comes back with restore)
      if (ok && spec.look) call('setLook', Object.assign({}, spec.look));
    }
    r.scene = key; r.sceneOk[key] = ok;
    return ok;
  }
  const ACTIONS = { view: 'setView', surface: 'setSurface', deform: 'setDeformation', focus: 'focusStep', panel: 'showPanel', tool: 'setTool', look: 'setLook' };
  function act(r, a) {
    const [name, ...args] = a;
    if (name === 'scene') return loadScene(r, pickScene(args[0]));
    if (CHANGES.has(name) && !r.scenes) return false;
    return call(ACTIONS[name] || name, ...args) !== false;
  }

  // the scene a step shows: the last `scene` action at or before it in its chapter, else the chapter's own
  function sceneAt(ch, si) {
    let k = ch.scene;
    for (let i = 0; i <= si; i++) for (const a of ch.steps[i].before || []) if (a[0] === 'scene') k = a[1];
    return pickScene(k);
  }
  const skipKey = (ci, si) => CHAPTERS[ci].id + '/' + CHAPTERS[ci].steps[si].id;

  async function show(ci, si, dir) {
    const r = run;
    if (!r) return;
    const token = ++r.seq;
    // a newer show of this run, a restart or the end of the tour: this one gives up (run is the live run, r this one's)
    const stale = () => run !== r || token !== r.seq;
    if (isAbsent(ci, si)) {
      const pos = seek(ci, si, dir || 1, isAbsent) || seek(ci, si, -(dir || 1), isAbsent);
      if (!pos) { stop({}); return; }
      ci = pos.ci; si = pos.si;
    }
    const ch = CHAPTERS[ci], step = ch.steps[si];
    r.ci = ci; r.si = si; r.dir = dir;
    rec.last = { ch: ch.id, i: si }; save();
    for (const off of r.tryOffs.splice(0)) off();
    r.ui.card.setAttribute('aria-busy', 'true');
    const want = sceneAt(ch, si);
    const ok = want == null ? true : loadScene(r, want);
    for (const a of step.before || []) {
      if (a[0] === 'scene') continue;
      act(r, a);
      await null;
      if (stale()) return;
    }
    await frames(2);
    await sleep(step.wait || (step.before && step.before.length ? 60 : 0));
    if (stale()) return;
    const target = step.anchor == null ? null : anchorEl(step.anchor);
    if ((step.anchor != null && !target) || !ok) {
      // missing in this build or this layout: skip it, in the direction of travel
      r.skipped.add(skipKey(ci, si));
      const d = dir || 1;
      const pos = seek(ci, si + d, d, isAbsent);
      if (!pos) { if (d > 0) stop({ finished: true }); else await show(ci, si, 1); return; }
      if (pos.ci !== ci && d > 0) { rec.done[ch.id] = ch.rev; save(); }
      await show(pos.ci, pos.si, d);
      return;
    }
    r.step = step; r.el = target;
    // the copy of a control that lives in the ⋯ menu here says "in this menu"
    r.inMenu = !!target && [].concat(step.anchor).length > 1 && target === anchorEl('moreBtn') && anchorEl([].concat(step.anchor)[0]) !== target;
    // bring the lit area into view: between the top bar and what is fixed at the bottom (a phone's tool bar, and the
    // sheet the callout becomes), measured again once the scroll has ended
    if (target) { await reveal(target, step); if (stale()) return; }
    r.ui.card.removeAttribute('aria-busy');
    fill(r, ch, step);
    layout(true);
    announce(r, ch, step);
    armTry(r, step);
    try { r.ui.next.focus({ preventScroll: true }); } catch (e) { /* */ }
  }

  // the band of the viewport that nothing fixed covers: below the top bar, above a bottom bar and (on a phone) the sheet
  function fixedEdge(y, fromTop) {
    let best = null;
    const xs = [innerWidth * 0.25, innerWidth * 0.5, innerWidth * 0.75];
    for (const x of xs) {
      for (const e of document.elementsFromPoint(x, y)) {
        if (e.closest('[data-tour]')) continue;
        let a = e;
        for (; a && a !== document.body && a !== document.documentElement; a = a.parentElement) { const p = getComputedStyle(a).position; if (p === 'fixed' || p === 'sticky') break; }
        if (!a || a === document.body || a === document.documentElement) break;
        const q = a.getBoundingClientRect();
        if (q.width < innerWidth * 0.4) break;
        best = fromTop ? Math.max(best == null ? 0 : best, q.bottom) : Math.min(best == null ? innerHeight : best, q.top);
        break;
      }
    }
    return best;
  }
  function freeBand() {
    const top = fixedEdge(2, true) || 0, bar = fixedEdge(innerHeight - 3, false);
    let bot = bar == null ? innerHeight : bar;
    if (narrow()) bot = Math.min(bot, innerHeight * 0.58);
    return { top, bot: Math.max(top + 80, bot) };
  }
  function scrollWin(y) {
    return new Promise((res) => {
      if (Math.abs(y - scrollY) < 1) { res(); return; }
      if (reduced()) { scrollTo({ top: y, behavior: 'auto' }); res(); return; }
      let done = false;
      const fin = () => { if (done) return; done = true; removeEventListener('scrollend', fin); res(); };
      addEventListener('scrollend', fin);
      setTimeout(fin, 700);
      scrollTo({ top: y, behavior: 'smooth' });
    });
  }
  const inFixed = (e) => { for (let a = e; a && a !== document.body && a !== document.documentElement; a = a.parentElement) { const p = getComputedStyle(a).position; if (p === 'fixed' || p === 'sticky') return true; } return false; };
  async function reveal(target, step) {
    // a control in the top bar or a fixed tool bar is always in view; scrolling would only move the page under it
    if (inFixed(target)) return;
    const also = [].concat(step.also || []).map((a) => anchorEl(a)).filter((e) => e && e !== target && !inFixed(e));
    for (let pass = 0; pass < 2; pass++) {
      // mostly cut off by a scrolling panel (a section low in a side panel, the add card at the end of a long chain):
      // that panel scrolls first
      const sb = seenBox(target), b0 = sb.full;
      const fw = Math.min(b0.width, innerWidth * 0.5), fh = Math.min(b0.height, innerHeight * 0.5);
      const clipped = fw > 0 && fh > 0 && Math.min(sb.r - sb.l, fw) * Math.min(sb.b - sb.t, fh) < 0.6 * fw * fh;
      if (clipped) { target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' }); await frames(1); }
      // the lit area: the anchor, and its second lit element when both can be brought in
      let b = target.getBoundingClientRect();
      const box = { top: b.top, bottom: b.bottom };
      for (const e of also) { const q = e.getBoundingClientRect(); box.top = Math.min(box.top, q.top); box.bottom = Math.max(box.bottom, q.bottom); }
      const band = freeBand(), room = band.bot - band.top - 16;
      let delta = 0;
      if (box.bottom - box.top <= room) {
        // it fits: wholly inside the band
        if (box.top < band.top + 2) delta = box.top - band.top - 8;
        else if (box.bottom > band.bot - 2) delta = box.bottom - band.bot + 8;
      } else if (also.length && narrow()) {
        // two lit areas that cannot both fit (X and Y on a phone): their middle in the middle of the band
        delta = (box.top + box.bottom) / 2 - (band.top + band.bot) / 2;
      } else if (b.bottom - b.top <= room) {
        if (b.top < band.top + 2) delta = b.top - band.top - 8;
        else if (b.bottom > band.bot - 2) delta = b.bottom - band.bot + 8;
      } else if (b.top < band.top - 2 || b.top > band.top + 0.4 * room) delta = b.top - band.top - 8;
      if (Math.abs(delta) < 2) return;
      const maxY = Math.max(0, document.documentElement.scrollHeight - innerHeight);
      const y = Math.max(0, Math.min(maxY, scrollY + delta));
      if (Math.abs(y - scrollY) < 1) return;
      await scrollWin(y);
      await frames(1);
      if (!run) return;
    }
  }

  function fill(r, ch, step) {
    const ui = r.ui;
    // the count leaves out the steps this run found missing
    const shown = ch.steps.filter((s, i) => s === step || !(r.skipped.has(skipKey(r.ci, i)) || r.absent.has(skipKey(r.ci, i))));
    const k = shown.indexOf(step) + 1, total = shown.length;
    ui.chap.textContent = $t(ch.title);
    ui.title.textContent = $t(step.title);
    ui.body.textContent = '';
    ui.body.append(richText(copyFor(step, r.scene, { menu: r.inMenu })));
    r.countText = $t('{k} of {total}', { k, total });
    ui.bar.style.width = `${(100 * k / Math.max(1, total)).toFixed(1)}%`;
    ui.tryBox.textContent = '';
    ui.tryBox.classList.remove('done');
    const tr = tryOf(step);
    ui.tryBox.hidden = !tr;
    if (tr) {
      const tick = el('span', { class: 'tour-tick', 'aria-hidden': 'true' });
      tick.innerHTML = ICON_CHECK;
      const txt = el('span', null, el('b', null, $t('Try it')), ' ');
      txt.append(richText(tryFor(tr)));
      ui.tryBox.append(tick, txt);
    }
    const nx = seek(r.ci, r.si + 1, 1, isAbsent);
    const nextCh = nx && nx.ci !== r.ci ? CHAPTERS[nx.ci] : null;
    const last = !nx;
    ui.next.textContent = step.anchor == null && r.ci === 0 && r.si === 0 ? $t('Start') : last ? $t('Finish') : nextCh ? $t('Next: {chapter}', { chapter: $t(nextCh.title) }) : $t('Next');
    ui.next.classList.remove('ready');
    ui.done.hidden = !nextCh;
    // at a chapter's end the footer holds Back, Done and "Next: <chapter>"; the full progress line says the rest
    ui.count.textContent = nextCh ? '' : r.countText;
    ui.back.hidden = !seek(r.ci, r.si - 1, -1, isAbsent);
    ui.card.classList.toggle('center', step.anchor == null && !narrow());
  }
  function announce(r, ch, step) {
    const k = r.countText;
    const tr = tryOf(step);
    r.ui.live.textContent = $t('{chapter}, step {k}. {title}. ', { chapter: $t(ch.title), k, title: $t(step.title) }) + plainCopy(copyFor(step, r.scene, { menu: r.inMenu }), modKey()) + (tr ? $t(' Try it: ') + plainCopy(tryFor(tr), modKey()) : '');
  }

  function holesFor(step, target) {
    if (!target) return { holes: [], mark: null };
    const pad = step.pad != null ? step.pad : 6;
    const list = [target];
    for (const a of [].concat(step.also || [])) { const e = anchorEl(a); if (e && !list.includes(e)) list.push(e); }
    const { holes, mark } = litAreas(list.map((e) => rectOf(e, pad)));
    const rad = (h) => Object.assign(h, { rad: h.r - h.l > 240 && h.b - h.t > 160 ? 10 : 8 });
    return { holes: holes.map(rad), mark: mark && Object.assign(mark, { rad: 7 }) };
  }
  // controls inside the lit area that an inset callout should not cover
  function controlsIn(e) {
    if (!e) return [];
    const out = [];
    for (const c of e.querySelectorAll('button, input, select, label, [role="radiogroup"], [role="toolbar"], .seg, .kbd')) {
      const b = c.getBoundingClientRect();
      if (b.width > 1 && b.height > 1) out.push({ l: b.left, t: b.top, r: b.right, b: b.bottom });
      if (out.length > 120) break;
    }
    return out;
  }

  // measure, place and draw; animate on a step change, follow scrolls and resizes immediately
  function layout(stepChange) {
    const r = run;
    if (!r || !r.step) return;
    const ui = r.ui, step = r.step;
    // the anchor went away while the step shows (a panel closed, the layout changed): another match, or a centred card
    if (r.el && !visible(r.el)) r.el = anchorEl(step.anchor) || r.el;
    const { holes, mark } = holesFor(step, r.el && visible(r.el) ? r.el : null);
    const card = ui.card;
    card.classList.toggle('sheet', narrow());
    const cw = card.offsetWidth, chh = card.offsetHeight;
    // beside the anchor's area, clear of every lit area; the pointer aims at the anchor itself when it sits in a lit panel
    const p = place(holes[0] || null, { w: cw, h: chh }, { w: innerWidth, h: innerHeight }, {
      prefer: step.place, others: holes.slice(1), point: mark ? { x: (mark.l + mark.r) / 2, y: (mark.t + mark.b) / 2 } : null,
      avoid: () => controlsIn(r.el),
    });
    card.dataset.side = p.mode === 'side' && p.caret != null ? p.side : '';
    card.dataset.edge = p.mode === 'sheet' ? p.side : '';
    if (p.mode !== 'sheet') { card.style.left = p.x + 'px'; card.style.top = p.y + 'px'; }
    else { card.style.left = ''; card.style.top = p.side === 'top' ? 'calc(12px + env(safe-area-inset-top, 0px))' : p.side === 'middle' ? p.y + 'px' : ''; }
    if (p.caret != null) card.style.setProperty('--caret', p.caret + 'px');
    const sig = JSON.stringify(holes.concat(mark ? [mark] : []).map((h) => [h.l, h.t, h.r, h.b].map(Math.round))) + p.x + ',' + p.y + p.mode + p.side;
    if (!stepChange && sig === r.tracked) return;
    r.tracked = sig;
    if (stepChange) {
      animateHoles(ui, holes, mark, ms(getComputedStyle(document.documentElement).getPropertyValue('--t-slow'), 240));
      card.classList.add('entering');
      requestAnimationFrame(() => card.classList.remove('entering'));
    } else { cancelAnimationFrame(ui.raf); drawHoles(ui, holes, mark); }
  }
  // a CSS time token in ms ('240ms', '0.24s'); the fallback when it is missing
  function ms(v, dflt) {
    const m = /^\s*([\d.]+)\s*(ms|s)?\s*$/.exec(String(v || ''));
    return m ? parseFloat(m[1]) * (m[2] === 's' ? 1000 : 1) : dflt;
  }
  let trackQ = false;
  function track() {
    if (!run || trackQ) return;
    trackQ = true;
    requestAnimationFrame(() => { trackQ = false; layout(false); });
  }

  function armTry(r, step) {
    const t = tryOf(step);
    if (!t || !t.on || typeof api.on !== 'function') return;
    // mem: what this showing of the step has seen so far (the preimages Try it wants a point inside and one outside);
    // count: how many times the event must come (Paths twice, so it ends switched on)
    let fired = false, hits = 0;
    const mem = {};
    const hit = (e) => {
      if (fired || run !== r || r.step !== step) return;
      try { if (t.test && !t.test(e, mem)) return; } catch (x) { return; }
      if (++hits < (t.count || 1)) return;
      fired = true;
      r.ui.tryBox.classList.add('done');
      r.ui.next.classList.add('ready');
      r.ui.live.textContent = $t('Done.');
      if (t.advance) setTimeout(() => { if (run === r && r.step === step) go(1); }, reduced() ? 300 : 700);
    };
    for (const ev of [].concat(t.on)) {
      try { const off = api.on(ev, hit); if (typeof off === 'function') r.tryOffs.push(off); } catch (e) { warn('on ' + ev, e); }
    }
  }

  // Ends the run at once (no waiting: a start right after it finds no run, or takes this one over). keepWork: another
  // chapter takes over (start keeps the borrowed work, the paused autosave and the stash, and tells the app nothing)
  function stop(opt = {}) {
    const r = run;
    if (!r) return;
    run = null;
    r.seq++;   // a show() of this run still waiting gives up
    for (const off of r.tryOffs.splice(0)) off();
    for (const off of r.offs.splice(0)) off();
    cancelAnimationFrame(r.ui.raf);
    if (opt.finished) {
      rec.done[CHAPTERS[r.ci].id] = CHAPTERS[r.ci].rev;
      // "Continue the tour" picks up at the next chapter, or nowhere after the last
      rec.last = r.ci + 1 < CHAPTERS.length ? { ch: CHAPTERS[r.ci + 1].id, i: 0 } : null;
    }
    save();
    const ui = r.ui;
    ui.card.classList.add('closing');
    ui.svg.style.transition = reduced() ? '' : 'opacity 120ms linear';
    ui.svg.style.opacity = '0';
    setTimeout(() => ui.root.remove(), reduced() ? 0 : 140);
    if (opt.keepWork) return;
    // the user's work comes back exactly as it was; the message says so only when it did
    const back = giveBack(r.lend, false);
    call('onTour', false);
    if (!opt.silent) {
      const where = helpWhere();
      lastToast = call('toast', !back ? $t('Your work could not be put back here, but it is safe: reload the page to get it back.')
        : !r.lend ? $t('The tour stays under {where}.', { where })
          : opt.finished && r.ci === CHAPTERS.length - 1 ? $t('Tour finished. Your work is back, and the tour stays under {where}.', { where }) : $t('Your work is back. The tour stays under {where}.', { where }));
      const to = r.opener && r.opener.isConnected ? r.opener : anchorEl(['helpBtn', 'moreBtn']);
      try { if (to) to.focus({ preventScroll: true }); } catch (e) { /* */ }
    }
  }

  // ---------------------------------------------------------------- the first-run suggestion
  function suggest(opt = {}) {
    if (!doc()) return false;
    load();
    if (run || sugg || (!opt.force && !shouldSuggest(rec))) return false;
    const delay = opt.delay != null ? opt.delay : 1200;
    let tries = 0;
    const attempt = () => {
      if (run || !sugg || !sugg.pending) return;
      // never over a menu or a dialog: wait for it to close (about 15 s at most, then until the next opening)
      if (appLayerOpen() && !opt.force) { if (++tries > 15) { sugg = null; return; } sugg.pending = setTimeout(attempt, 1000); return; }
      sugg = null;
      showSuggest();
    };
    sugg = { pending: setTimeout(attempt, delay) };
    return true;
  }
  function showSuggest() {
    injectCSS();
    rec.shown += 1; save();
    // a returning user (saved work) is not "new here"
    const returning = call('hasWork') === true;
    const title = returning ? $t('Take the 2-minute tour') : $t('New here? Take a 2-minute tour');
    const close = el('button', { class: 'icon-btn small tour-sg-x', type: 'button', 'aria-label': $t('Dismiss the tour suggestion') });
    close.innerHTML = ICON_X;
    const startB = el('button', { class: 'btn primary', type: 'button' }, $t('Start the tour'));
    const later = el('button', { class: 'btn ghost', type: 'button' }, $t('Not now'));
    const markWrap = el('span', { class: 'tour-sg-mark', 'aria-hidden': 'true' });
    markWrap.innerHTML = mark();
    // the compact form: once the user starts working, the card shrinks to a pill under Help (it no longer covers the
    // composite map), until Start, × or the next opening
    const pill = el('button', { class: 'btn ghost tour-sg-pill', type: 'button', 'aria-label': title });
    pill.innerHTML = `${ICON_PLAY}<span>${$t('Take the tour')}</span><span class="tour-time">${$t('2 min')}</span>`;
    const box = el('section', { class: 'tour-suggest', role: 'region', 'aria-label': $t('Tour suggestion'), 'data-tour': 'suggest' },
      el('span', { class: 'tour-caret', 'aria-hidden': 'true' }),
      el('div', { class: 'tour-sg-row' }, markWrap,
        el('div', { class: 'tour-sg-text' },
          el('h2', { class: 'tour-sg-title' }, title),
          el('p', { class: 'tour-sg-body' }, $t('Draw a region, send it through a chain of functions and watch its image. About two minutes, and your work is kept.')),
          el('div', { class: 'tour-sg-acts' }, startB, later)),
        close),
      pill);
    const go1 = () => { hideSuggest(true); start({ chapter: 'basics', opener: anchorEl(['helpBtn', 'moreBtn']) }); };
    startB.addEventListener('click', go1);
    pill.addEventListener('click', go1);
    const dismiss = () => { rec.outcome = 'dismissed'; rec.v = Math.max(rec.v, VERSION); save(); hideSuggest(true); call('toast', $t('The tour is under {helpWhere} whenever you want it.', { helpWhere: helpWhere() })); };
    later.addEventListener('click', dismiss);
    close.addEventListener('click', dismiss);
    box.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); hideSuggest(true); } });
    const onDown = (e) => {
      if (!sugg || sugg.box !== box || box.classList.contains('compact')) return;
      const t = e.target;
      if (box.contains(t) || (t.closest && t.closest('#helpBtn, #hdrMoreBtn, .tour-menu'))) return;
      box.classList.add('compact');
      positionSuggest();
    };
    document.addEventListener('pointerdown', onDown, true);
    // the keyboard: the card is the next Tab stop after Help (and Shift+Tab goes back to Help); Escape on the page
    // hides it for this session, unless a menu, a dialog, a field or something of the app's takes that Escape
    const onKeySg = (e) => {
      if (!sugg || sugg.box !== box || e.altKey || e.ctrlKey || e.metaKey) return;
      const help = anchorEl(['helpBtn', 'moreBtn']), a = document.activeElement;
      if (e.key === 'Tab') {
        const fs = [...box.querySelectorAll('button')].filter(visible);
        if (!fs.length || !help) return;
        if (!e.shiftKey && a === help) { e.preventDefault(); fs[0].focus(); }
        else if (e.shiftKey && a === fs[0]) { e.preventDefault(); help.focus(); }
        else if (!e.shiftKey && a === fs[fs.length - 1]) {
          const all = [...document.querySelectorAll('button, [href], input, select, textarea, [tabindex]')].filter((x) => !x.disabled && x.tabIndex >= 0 && !box.contains(x) && !x.closest('[data-tour]') && visible(x));
          const i = all.indexOf(help);
          if (i >= 0 && all[i + 1]) { e.preventDefault(); all[i + 1].focus(); }
        }
        return;
      }
      if (e.key === 'Escape' && !box.contains(a)) {
        if (run || appLayerOpen() || appBusy()) return;
        if (a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable)) return;
        hideSuggest(true);
      }
    };
    document.addEventListener('keydown', onKeySg, true);
    document.body.append(box);
    sugg = { box, off: () => { document.removeEventListener('pointerdown', onDown, true); document.removeEventListener('keydown', onKeySg, true); } };
    say($t('Tour suggestion: {title}. Start the tour or Not now.', { title }) + (anchorEl('helpBtn') ? ' ' + $t('Tab from Help reaches it; Escape hides it.') : '') + ' ' + $t('The tour stays under {where}.', { where: helpWhere() }));
    positionSuggest();
    addEventListener('resize', positionSuggest);
    call('onSuggest', true);
  }
  function positionSuggest() {
    if (!sugg || !sugg.box) return;
    const box = sugg.box, help = anchorEl(['helpBtn', 'moreBtn']);
    if (narrow() || !help) {
      // on a phone: under the top bar, clear of the tool bar along the bottom
      const hdr = document.querySelector('header');
      const top = hdr ? Math.round(hdr.getBoundingClientRect().bottom + 8) : 64;
      box.classList.add('no-caret'); box.style.left = ''; box.style.right = '12px'; box.style.top = top + 'px';
      return;
    }
    const b = help.getBoundingClientRect(), w = box.offsetWidth;
    const left = Math.max(12, Math.min(innerWidth - w - 12, b.left + b.width / 2 - w + (box.classList.contains('compact') ? 22 : 28)));
    box.classList.remove('no-caret');
    box.style.left = left + 'px'; box.style.right = 'auto'; box.style.top = Math.round(b.bottom + 12) + 'px';
    box.style.setProperty('--caret', Math.round(b.left + b.width / 2 - left) + 'px');
  }
  function hideSuggest(anim) {
    if (!sugg) return;
    if (sugg.pending) clearTimeout(sugg.pending);
    if (sugg.off) sugg.off();
    const box = sugg.box;
    sugg = null;
    removeEventListener('resize', positionSuggest);
    if (!box) return;
    const focusWasIn = box.contains(document.activeElement);
    if (anim && !reduced()) { box.classList.add('closing'); setTimeout(() => box.remove(), 100); } else box.remove();
    if (focusWasIn) { const h = anchorEl(['helpBtn', 'moreBtn']); try { if (h) h.focus({ preventScroll: true }); } catch (e) { /* */ } }
    call('onSuggest', false);
  }

  // ---------------------------------------------------------------- the help menu
  function openHelpMenu(anchor) {
    if (!doc()) return;
    if (menu) { closeMenu(true); return; }
    injectCSS();
    load();
    hideSuggest(false);
    anchor = anchor || anchorEl(['helpBtn', 'moreBtn']);
    const items = [];
    const mi = (cls, html, onClick, extra = {}) => {
      const b = el('button', Object.assign({ class: 'mi ' + (cls || ''), role: 'menuitem', type: 'button', tabindex: '-1' }, extra));
      b.innerHTML = html;
      b.addEventListener('click', () => { closeMenu(false); onClick(); });
      items.push(b);
      return b;
    };
    const head = el('div', { class: 'menu-head', role: 'presentation' }, $t('Guided tour'));
    const kids = [head];
    const resume = rec.last && CHAPTERS.find((c) => c.id === rec.last.ch);
    if (resume && !(rec.last.i === 0 && rec.last.ch === 'basics')) {
      const st = resume.steps[Math.min(rec.last.i, resume.steps.length - 1)];
      kids.push(mi('tour-continue', `<span class="mi-ic">${ICON_PLAY}</span><span class="mi-label">${esc($t('Continue the tour'))}<span class="tour-sub">${esc($t(resume.title))}: ${esc($t(st.title))}</span></span>`,
        () => start({ chapter: resume.id, step: rec.last.i, opener: anchor })));
    } else {
      kids.push(mi('', `<span class="mi-ic">${ICON_PLAY}</span><span class="mi-label">${esc($t('Take the tour'))}</span><span class="mi-key">${esc($t('2 min'))}</span>`, () => start({ chapter: 'basics', opener: anchor })));
    }
    kids.push(el('div', { class: 'msep', role: 'separator' }));
    CHAPTERS.forEach((c, i) => {
      const done = chapterDone(rec, c), fresh = chapterNew(rec, c);
      const title = $t(c.title), time = $t(c.time);
      kids.push(mi('', `<span class="tour-num">${i + 1}</span><span class="mi-label">${esc(title)}${fresh ? ` <span class="tour-new">${esc($t('New'))}</span>` : ''}</span>${done ? `<span class="tour-done" aria-label="${esc($t('done'))}">${ICON_CHECK}</span>` : ''}<span class="tour-time">${esc(time)}</span>`,
        () => start({ chapter: c.id, opener: anchor }), { 'aria-label': `${title}, ${time}${done ? $t(', done') : ''}` }));
    });
    kids.push(el('div', { class: 'msep', role: 'separator' }));
    // on a touch screen there are no keys to show
    const keys = !phone();
    kids.push(mi('', `<span class="mi-ic">${ICON_BOOK}</span><span class="mi-label">${esc($t('Reference guide'))}</span>${keys ? '<span class="mi-key">?</span>' : ''}`, () => call('openGuide')));
    if (keys) kids.push(mi('', `<span class="mi-ic">${ICON_KEYS}</span><span class="mi-label">${esc($t('Keyboard shortcuts'))}</span>`, () => call('openGuide', 'keys')));
    const pop = el('div', { class: 'pop menu tour-menu', role: 'menu', 'aria-label': $t('Help'), 'data-tour': 'menu' }, ...kids);
    const host = document.getElementById('popHost') || document.body;
    host.append(pop);
    // below the anchor, right-aligned to it, kept on screen. On a phone the help button sits in the ⋯ menu, which
    // closes on the click: after a frame the menu re-measures and hangs under whatever is visible (⋯)
    const position = () => {
      const a = anchor && visible(anchor) ? anchor : anchorEl(['helpBtn', 'moreBtn']);
      const b = a ? a.getBoundingClientRect() : { left: innerWidth - 12, right: innerWidth - 12, bottom: 48, top: 48 };
      const w = pop.offsetWidth, hgt = pop.offsetHeight;
      const left = Math.max(12, Math.min(innerWidth - w - 12, b.right - w));
      let top = b.bottom + 6;
      if (top + hgt > innerHeight - 12) top = Math.max(12, b.top - 6 - hgt);
      pop.style.left = left + 'px'; pop.style.top = top + 'px';
    };
    position();
    requestAnimationFrame(() => { if (menu && menu.pop === pop) position(); });
    if (anchor) anchor.setAttribute('aria-expanded', 'true');
    const onKey = (e) => {
      const i = items.indexOf(document.activeElement);
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(true); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); const j = (i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length; items[i < 0 ? 0 : j].focus(); }
      else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); items[e.key === 'Home' ? 0 : items.length - 1].focus(); }
      else if (e.key === 'Tab') { e.preventDefault(); closeMenu(true); }
    };
    const onDown = (e) => { if (!pop.contains(e.target) && !(anchor && anchor.contains(e.target))) closeMenu(false); };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onDown, true);
    menu = { pop, anchor, off: () => { document.removeEventListener('keydown', onKey, true); document.removeEventListener('pointerdown', onDown, true); } };
    items[0].focus({ preventScroll: true });
    return pop;
  }
  function closeMenu(refocus) {
    if (!menu) return;
    const m = menu; menu = null;
    m.off(); m.pop.remove();
    if (m.anchor) { m.anchor.setAttribute('aria-expanded', 'false'); if (refocus) try { m.anchor.focus({ preventScroll: true }); } catch (e) { /* */ } }
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------------------------------------------------------------- public
  function init(a) {
    api = a || {};
    inited = true;
    load();
    // a tour running in this page holds the stash: a second init only replaces the adapter
    if (!run) recoverStash();
    return Tour;
  }
  // A tour cut short by a reload or a crash: put the user's work back before anything else. Another page's live tour
  // (its heartbeat is fresh) keeps its stash; the stash goes only once restore() has taken it.
  // A fresh heartbeat of another page: that page may still be touring (another tab), or it just went away without
  // saying so (a crash); look again once its heartbeat would be stale, never give up for the session.
  // A backup written while the app's autosave was paused (paused, with the saved copy's fingerprint, mark) holds
  // nothing the saved copy lacks: the saved copy is that work, or newer work saved since (after a reload, or in
  // another tab). Such a backup is dropped, never restored over the saved copy.
  function recoverStash() {
    clearTimeout(recheckT); recheckT = 0;
    if (run) return;
    let raw = null;
    try { raw = localStorage.getItem(sk(STASH)); } catch (e) { warn('storage', e); return; }
    if (!raw) return;
    try {
      const live = JSON.parse(localStorage.getItem(sk(LIVE)) || 'null');
      if (live && live.page !== PAGE && Date.now() - live.t < BEAT_STALE) {
        recheckT = setTimeout(recoverStash, Math.max(500, BEAT_STALE - (Date.now() - live.t) + 250));
        return;
      }
    } catch (e) { /* malformed heartbeat: recover */ }
    let st;
    try { st = JSON.parse(raw); } catch (e) { warn('stash', e); dropStash(); return; }
    if (st && typeof st === 'object' && st.page === PAGE) return;   // this page's own (a restore that failed): kept
    const snap = st && typeof st === 'object' && 'page' in st && 'snap' in st ? st.snap : st;
    if (snap == null) { dropStash(); return; }
    if (st && st.paused === true && st.mark != null && fn('savedMark')) {
      let now = null;
      try { now = api.savedMark(); } catch (e) { now = null; }
      if (now != null) { dropStash(); return; }
    }
    if (!fn('restore')) return;
    let ok = false;
    try { ok = api.restore(snap, { fromStash: true }) !== false; } catch (e) { warn('restore', e); ok = false; }
    if (ok) dropStash();
  }
  // forget the record (a "Show the tour suggestion again" command); a backup of the user's work is never dropped here
  function reset() { rec = normRec(null); save(); }

  const Tour = {
    VERSION, init, start, stop: (o) => Promise.resolve(stop(o || {})), next: () => go(1), back: () => go(-1),
    suggest, dismissSuggestion: () => hideSuggest(false), openHelpMenu, closeHelpMenu: () => closeMenu(false),
    isSeen: () => seenRec(load()), isActive: () => !!run, reset,
    chapters: () => CHAPTERS.map((c) => ({ id: c.id, title: c.title, time: c.time, steps: c.steps.length, done: chapterDone(rec, c) })),
    current: () => (run ? { chapter: CHAPTERS[run.ci].id, step: run.si, id: CHAPTERS[run.ci].steps[run.si].id } : null),
    // the spotlight's geometry, for the browser checks: the lit areas (padded, in px) and the callout's placement
    // and the anchor's own box
    lit: () => {
      if (!(run && run.ui && run.ui.holes)) return null;
      const a = run.el && run.el.isConnected ? run.el.getBoundingClientRect() : null;
      return { holes: run.ui.holes.map((h) => ({ l: h.l, t: h.t, r: h.r, b: h.b })), side: run.ui.card.dataset.side || null, edge: run.ui.card.dataset.edge || null,
        anchor: a ? { l: a.left, t: a.top, r: a.right, b: a.bottom } : null, scenes: run.scenes, scene: run.scene == null ? null : run.scene };
    },
    // internals for the tests and the design tables
    _t: { CHAPTERS, SCENES, ANCHORS, LOOK, parseCopy, texPlain, plainCopy, place, litAreas, ms, normRec, seenRec, shouldSuggest, chapterDone, chapterNew, seek, absent, sceneAt, pickScene, copyFor, tryFor, probeInOut, SUGGEST_MAX, KEY, STASH, LIVE },
  };
  return Tour;
})();
// a global binding for the app's scripts, and window.Tour for pages and tools that look it up there
if (typeof window !== 'undefined') window.Tour = Tour;
if (typeof module !== 'undefined' && module.exports) module.exports = { Tour };
