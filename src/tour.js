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
  const VERSION = 2;          // content version; a chapter whose `rev` is newer than what a user saw is marked New
                              // (2: v15, the Inspector, the F tile, the planes' menu, shared numbers, the phone layout)
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
    // v15: one shared number a (src/params.js) used twice: the zeros ±a of the step and the radius of the circle
    // |z| = a (a shape field bound to a), so its slider moves both. `params` is the app's S.params
    numbers: {
      name: 'A shared number', needs: 'params', view: { cx: 0, cy: 0, s: 80 }, look: look(),
      params: [{ name: 'a', value: 1, min: 0.2, max: 1.8, step: 0.01 }],
      shapes: [{ kind: 'rect', a: [-1.5, -1.5], b: [1.5, 1.5] }, { kind: 'circle', c: [0, 0], r: 1, bind: { r: 'a' } }],
      steps: [{ type: 'custom', params: { expr: '\\frac{z^2-a^2}{z^2+1}', cut: 180 } }],
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
      id: 'basics', title: 'Basics', time: '2 min', rev: 2, scene: 'strip',
      steps: [
        { id: 'welcome', anchor: null, title: 'Welcome to the Workbench', before: [['view', 'xy'], ['deform', false], ['surface', 'L', 'plane'], ['surface', 'R', 'plane']],
          body: 'Draw a set in the $z$-plane, send it through a chain of functions and watch its image. This takes about two minutes, and your own work comes back when the tour ends.' },
        { id: 'x', anchor: 'paneL', title: 'X: the domain', place: 'right', before: [['plane', 'L']],
          body: 'X shows your shapes, here the strip $|\\operatorname{Im} z|<\\pi/2$, with a checkerboard drawn in $z$-coordinates. Scroll to zoom, drag empty space to pan, and {Z} fits both planes.',
          touch: 'X shows your shapes, here the strip $|\\operatorname{Im} z|<\\pi/2$, with a checkerboard drawn in $z$-coordinates. Pinch to zoom and drag empty space to pan.' },
        { id: 'y', anchor: 'paneR', title: 'Y: the image', place: 'left', before: [['plane', 'R']],
          body: 'Y shows the image under $F(z)=(e^z-1)/(e^z+1)$: the strip becomes the unit disc. $F$ is conformal there: grid lines still cross at right angles, and tiny squares map to near-squares.' },
        // (Y lit with X beside it: the callout sits below Y, not over X where the preimage marks appear)
        { id: 'preimages', anchor: 'paneR', also: ['paneL'], title: 'Preimages', place: 'bottom',
          body: 'Hover a point $w$ in Y: X marks every $z$ in view with $F(z)=w$. Inside the disc there is exactly one in the strip, since $F$ maps the strip one-to-one onto the disc. Outside it there are two, $2\\pi i$ apart, as $F$ has period $2\\pi i$.',
          // (v15 touch: a still hold opens the planes' menu; a hold then a slide probes)
          touch: 'Hold a point $w$ in Y, then slide: X marks every $z$ in view with $F(z)=w$. Inside the disc there is exactly one in the strip, since $F$ maps the strip one-to-one onto the disc. Outside it there are two, $2\\pi i$ apart.',
          try: { text: 'Hover inside the disc, then outside it.', touch: 'Hold inside the disc, then slide out of it.', on: 'probe', test: probeInOut } },
        { id: 'draw', anchor: ['tools', 'toolsRail'], also: ['paneL'], title: 'Draw a shape', place: 'right', before: [['plane', 'L']],
          body: 'Pick a tool and drag in X to add a shape. The same tools in Y add a target in $w$ instead.',
          try: { text: 'Choose Disc, then drag in X.', on: 'shape-added' } },
        // (tryWide: on a phone the list and X are a screen apart, so the drag is not asked for there)
        { id: 'shapes', anchor: 'shapes', also: ['paneL'], title: 'Your shapes', place: 'right', before: [['tool', 'select'], ['panel', 'left', 'tools']], tryWide: true,
          body: 'Each shape is listed with its equation; the eye hides it and ⋯ has the rest: duplicate, delete, integrate. With Select {V}, drag a shape or a handle and the image follows; {mod}{Z} undoes.',
          touch: 'Each shape is listed with its equation; the eye hides it and ⋯ has the rest: duplicate, delete, integrate. With Select, drag a shape or a handle and the image follows.',
          try: { text: 'Press {V}, then drag the line $\\operatorname{Im} z=0.8$ up or down.', touch: 'Drag the line $\\operatorname{Im} z=0.8$ up or down.', on: 'shape-moved' } },
        { id: 'formula', anchor: 'formula', title: 'Sets from formulas', place: 'right', before: [['panel', 'left', 'tools']],
          body: 'Type a set and press Add, such as $|z-1|<2$ or $0<\\operatorname{Im} z<\\pi$. An equation like $|z|=1$ adds a curve, and a formula in $w$ adds a target.' },
        { id: 'chain', anchor: 'chain', title: 'The function chain', place: 'top',
          // (v15: a click selects a step for the Inspector; a double-click, or the lens in the Inspector, shows it alone)
          body: 'The cards apply in order: $F=f_2\\circ f_1$ with $f_1(z)=e^z$. Click a card to select it, and the Inspector edits it. Double-click it to see that step alone: X and Y become its input and output.',
          touch: 'The cards apply in order: $F=f_2\\circ f_1$ with $f_1(z)=e^z$. Tap a card, and the sheet opens its editor; the lens there shows that step alone, with X and Y as its input and output.',
          try: { text: 'Double-click the card $f_1$.', touch: 'Tap the card $f_1$, then the lens in the sheet.', on: 'step-focused', test: (e) => !e || e.k === 1, work: ['lens'] } },
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
        { id: 'sphere', anchor: ['surfaceL', 'sphereKey'], also: ['panes'], title: 'The Riemann sphere', place: 'bottom', before: [['view', 'phase'], ['surface', 'L', 'sphere']],
          body: 'Sphere wraps the plane onto the Riemann sphere, with $\\infty$ at the north pole; here $F(\\infty)=1$, neither a zero nor a pole. You can draw on the sphere too.' },
        // (when Y's strip is too short for it, it is in the Display options button, which is lit instead; on a phone,
        // Y is the large plane and its options are in the Display sheet)
        { id: 'key', anchor: ['phaseKey', 'rightOpts'], also: ['paneR'], title: 'Phase key', place: 'left', before: [['view', 'xy'], ['surface', 'L', 'plane'], ['surface', 'R', 'plane'], ['plane', 'R'], ['panel', 'sheet', 'display']],
          body: 'Phase key, among the options of Y, paints the phase colours of $w$ itself under the images, so a colour of the Phase portrait reads off as a value of $w=F(z)$.' },
        { id: 'patterns', anchor: 'patterns', also: ['paneR'], title: 'Patterns', place: 'bottom', before: [['view', 'xy'], ['surface', 'L', 'plane'], ['surface', 'R', 'plane'], ['look', { pattern: 'checker' }], ['panel', 'left', 'display']],
          body: 'The pattern is painted on X and carried to Y by $F$. Checker shows how squares are bent and scaled, Log-polar cells stay square under a conformal map, and Stretch shades by $|F\'(z)|$: blue shrinks, amber grows.',
          try: { text: 'Choose Stretch.', on: 'pattern-changed', test: (e) => !e || e.id == null || e.id === 'stretch' } },
      ],
    },
    {
      // v15 (notes/ui-redesign-2): the cards' pictures, the Inspector, zeros and poles, the planes' menu, shared numbers
      id: 'edit', title: 'Editing the chain', time: '1½ min', rev: 2, scene: 'strip',
      steps: [
        { id: 'cards', anchor: 'chain', also: ['viewSwitch'], title: 'Cards follow the view', place: 'top', before: [['deform', false], ['view', 'phase'], ['surface', 'L', 'plane']],
          body: 'Each card shows $F_k$, the map up to its step, in the open view: here its phase portrait. So the last card is the main picture, and the row shows how $F$ is built.',
          try: { text: 'Press {3}, or choose Landscape.', touch: 'Choose Landscape.', on: 'view-changed', test: (e) => !e || e.main === 'land' } },
        // (on a phone the panel action opens the Editor sheet, with X and Y side by side above it)
        { id: 'inspector', anchor: 'inspector', also: ['chain'], title: 'The Inspector', place: 'left', before: [['view', 'xy'], ['surface', 'L', 'plane'], ['surface', 'R', 'plane'], ['select', 2], ['panel', 'right']], wait: 120,
          body: 'The Inspector edits the selected step: its formula in full, a roomy field per coefficient, and ⋯ for the inverse, bypass, move and remove. A step\'s own coefficients carry its index, as $a_2$ here.',
          touch: 'A tapped card opens its editor in the sheet, with X and Y side by side above it, so the image changes as you type. A step\'s own coefficients carry its index, as $a_2$ here.' },
        { id: 'zp', anchor: 'zpCard', also: ['paneL'], title: 'Zeros and poles', place: 'left', before: [['scene', 'zp'], ['view', 'xy'], ['select', 1], ['panel', 'right']], wait: 120,
          body: 'This step is built from its zeros and poles. Drag one in X, or press Add zero or Add pole for a new one: the map and its image follow. The axes button beside a coefficient picks a value on a small Argand diagram.',
          touch: 'This step is built from its zeros and poles. Drag one in X, or tap Add zero or Add pole for a new one: the map and its image follow.',
          try: { text: 'Drag a zero or a pole.', on: 'zp-moved' } },
        // (the planes' menu, src/planemenu.js: on X the mark goes to w₀ = z, exactly; behind other steps to F_{k-1}(z))
        { id: 'zpHere', anchor: 'paneL', title: 'Add a zero here', place: 'right', needs: 'planeMenu', before: [['select', 1], ['plane', 'L']],
          body: 'Right-click a point of X and choose Add zero of $f_1$ here: that point becomes a zero of $F$. After earlier steps, the zero goes where the point lands, so it stays exact.',
          touch: 'Hold a point of X and choose Add zero of $f_1$ here: that point becomes a zero of $F$. After earlier steps, the zero goes where the point lands, so it stays exact.',
          try: { text: 'Right-click X, then Add zero of $f_1$ here.', touch: 'Hold X, then Add zero of $f_1$ here.', on: 'zp-added' } },
        { id: 'numbers', anchor: 'params', also: ['panes'], title: 'Shared numbers', place: 'left', before: [['scene', 'numbers'], ['view', 'phase'], ['select', 1], ['panel', 'right']], wait: 120,
          body: 'Type a new letter such as $a$ in any field, and a slider $a$ appears under Parameters. Here $a$ sets both zeros $\\pm a$ of $F$ and the circle $|z|=a$: drag the slider, and they move together.',
          try: { text: 'Drag the slider of $a$.', on: 'number-changed' } },
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
        // (on a phone the order select is in the Display sheet while the deformation shows)
        { id: 'order', anchor: 'allAtOnce', needs: 'allAtOnce', title: 'All steps at once', place: 'top', before: [['deform', true], ['panel', 'sheet', 'display']],
          body: 'With two or more steps, choose All at once: every step deforms at the same $t$, so $H_t=H^{(2)}_t\\circ H^{(1)}_t$ with $0\\le t\\le 1$.' },
      ],
    },
    {
      id: 'analysis', title: 'Analysis', time: '1½ min', rev: 2, scene: 'roots',
      steps: [
        { id: 'targets', anchor: 'paneR', also: ['paneL'], title: 'Targets and preimages', place: 'bottom', before: [['deform', false], ['view', 'xy'], ['surface', 'L', 'plane'], ['surface', 'R', 'plane'], ['plane', 'R']],
          body: 'Shapes drawn in Y are targets in $w$, and X shades their preimages. The target point $0$ marks the roots of $F(z)=z^3-1$ with their multiplicity, here the three cube roots of unity; the circle $|w|=0.6$ pulls back to three loops around them.' },
        { id: 'cauchy', anchor: ['phaseStyle', 'panes'], also: ['panes'], title: 'Cauchy integral', place: 'top', before: [['view', 'phase'], ['surface', 'L', 'plane'], ['look', { phaseStyle: 'cauchy' }]],
          body: 'The phase style Cauchy plots $\\frac{1}{2\\pi i}\\oint_\\gamma\\frac{F(\\zeta)}{\\zeta-z}\\,d\\zeta$ over a closed curve $\\gamma$, here the unit circle. It equals $F(z)=z^3-1$ inside and $0$ outside; the three zeros of $F$ lie on $\\gamma$ itself. Select another closed curve to use it instead.' },
        { id: 'integral', anchor: 'paneL', title: 'Integrals', place: 'right', before: [['scene', ['residueZp', 'residue']], ['view', 'xy'], ['plane', 'L']],
          body: 'Right-click the circle itself and choose $\\oint F\\,dz$: you get the integral, the winding number and the zeros and poles inside. It encloses the pole $i$ of $1/(z^2+1)$, so $\\oint=2\\pi i\\,\\operatorname{Res}_i F=\\pi$.',
          touch: 'Hold the circle itself and choose $\\oint F\\,dz$: you get the integral, the winding number and the zeros and poles inside. It encloses the pole $i$ of $1/(z^2+1)$, so $\\oint=2\\pi i\\,\\operatorname{Res}_i F=\\pi$.',
          try: { text: 'Right-click the circle, then choose $\\oint$.', touch: 'Hold the circle, then choose $\\oint$.', on: 'integral-opened' } },
        // (v15: api.anchor selects the F tile for these names, so the Inspector shows F; on a phone, in the Editor sheet)
        { id: 'domain', anchor: 'domain', also: ['fTile'], title: 'Natural domain', place: 'left', before: [['panel', 'right']],
          body: 'Select the F tile at the end of the chain, and the Inspector shows where every step is defined. For a typed formula it reads "the formula is defined at $z$": here every $z$ except the poles $\\pm i$.',
          byScene: { residueZp: 'Select the F tile at the end of the chain, and the Inspector shows where every step is defined: here every $z$ except the poles $\\pm i$, written $z\\notin\\{i,-i\\}$.' } },
        { id: 'guarantees', anchor: 'guarantees', also: ['fTile'], title: 'Guarantees', place: 'left', before: [['panel', 'right']],
          body: 'The F tile names what the chain guarantees. A property is listed only when every step has it and composition keeps it, so it is always true; one not listed is not implied, but may hold. Step by step shows which step brings which.' },
      ],
    },
    {
      id: 'branches', title: 'Branches and inverses', time: '1 min', rev: 2, scene: 'logAnnulus',
      steps: [
        { id: 'cut', anchor: 'paneL', title: 'Branch cuts', place: 'right', before: [['deform', false], ['view', 'xy'], ['surface', 'L', 'plane'], ['surface', 'R', 'plane'], ['plane', 'L']],
          body: '$\\log z$ needs a cut: the red ray in X is where its values jump by $2\\pi i$. Drag it to move the seam; the sheet $k$ in the Inspector adds $2\\pi i k$.',
          try: { text: 'Drag the red cut.', on: 'cut-moved' } },
        { id: 'inverse', anchor: ['invBtn', 'chain'], title: 'Inverses', place: 'left', before: [['select', 1], ['panel', 'right']],
          body: 'Replace with the inverse, in the step\'s ⋯ menu in the Inspector, replaces a step by its inverse when there is a single-valued one, as $e^z$ is for $\\log z$. When there is none, as for $z^2$, it says why and offers the preimages instead.' },
        // (X lit with the chain: the callout sits over Y, which is not lit, beside X)
        { id: 'deriv', anchor: 'paneL', also: ['chain'], title: 'The derivative as a step', place: 'right', before: [['scene', 'deriv'], ['view', 'xy'], ['plane', 'L']],
          body: 'A $d/dz$ step differentiates the chain so far: here $F=3z^2-3$, the derivative of $z^3-3z$. The target $0$ marks its zeros $\\pm1$, the critical points of $z^3-3z$.' },
        { id: 'sheets', anchor: ['sheets', 'panes'], also: ['panes'], title: 'All sheets', place: 'bottom', before: [['scene', 'logSheets'], ['view', 'land']], wait: 120,
          body: 'In Landscape, All sheets draws the whole Riemann surface of a multivalued map: $\\operatorname{Im}\\log z$ climbs a helicoid around $0$ instead of jumping at the cut.' },
      ],
    },
    {
      id: 'export', title: 'Export and LaTeX', time: '30 s', rev: 2, scene: null,
      steps: [
        { id: 'figure', anchor: ['exportBtn', 'moreBtn'], title: 'Figures for articles', place: 'bottom',
          body: 'Export a vector figure of the current view, with a caption that states exactly what is drawn, or copy a LaTeX document with $F$, its natural domain and its guarantees.',
          narrow: 'Export, in this menu, makes a vector figure with a caption that states exactly what is drawn, or a LaTeX document with $F$, its natural domain and its guarantees.' },
        { id: 'formula-tex', anchor: 'composite', also: ['fTile'], title: 'The formula in LaTeX', place: 'left', before: [['panel', 'right']],
          body: 'With the F tile selected, the Inspector shows $F$ in closed form; the copy button puts its LaTeX on the clipboard.' },
      ],
    },
    {
      id: 'keys', title: 'Palette and keys', time: '30 s', rev: 2, scene: null,
      steps: [
        { id: 'palette', anchor: ['palette', 'moreBtn'], title: 'Command palette', place: 'bottom',
          body: 'Search functions, region formulas, examples and commands with {mod}{K}. Type a formula such as $e^{z^2}$ to add it as a step.',
          narrow: 'Search, in this menu, finds functions, formulas, examples and commands. Type a formula such as $e^{z^2}$ to add it as a step.',
          try: { text: 'Press {mod}{K}.', touch: 'Open ⋯, then Search functions and commands.', on: 'palette-opened' } },
        { id: 'sound', anchor: ['soundBtn', 'soundBar', 'moreBtn'], needs: 'sound', title: 'Sound', place: 'bottom',
          body: 'Sound is on by default: quiet cues confirm what you do, and a closed loop plays its winding number. Turn it off here or with {Shift}{M}. The tone that plays $\\arg F$ as pitch stays off until you turn it on here.',
          narrow: 'Sound is on by default: quiet cues confirm what you do, and a closed loop plays its winding number. Turn it off in this menu. The tone that plays $\\arg F$ as pitch stays off until you turn it on there.',
          touch: 'Sound is on by default: quiet cues confirm what you do, and a closed loop plays its winding number. Turn it off here. The tone that plays $\\arg F$ as pitch stays off until you turn it on here.' },
        { id: 'help', anchor: ['helpBtn', 'moreBtn'], title: 'Help is here', place: 'bottom',
          body: 'This button opens the tour by chapter, the reference guide and every shortcut. {?} opens the guide directly.',
          narrow: 'Guided tour, in this menu, starts the tour by chapter; Reference guide opens the whole guide.' },
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
    // (v15: the right panel is the Inspector; F's formula, guarantees and domain show there with the F tile selected,
    // which the app's api.anchor does for these names)
    rightPanel: '#rightPanel', composite: '#propsPanel .insp-F .iform', guarantees: '#propsPanel .insp-F .iglist',
    domain: '#propsPanel .insp-F .idom', matrix: '#propsPanel .insp-F details.steps',
    // the editor of the selected zeros-and-poles step (its parameter block is .params.zp)
    zpCard: () => document.querySelector('#propsPanel .insp-step .params.zp'),
    // the Inspector's ⋯ menu of the selected step (Replace with the inverse); the All sheets check of the Landscape options (its label)
    invBtn: () => document.querySelector('#propsPanel .insp-step .ihead .more'),
    sheets: () => { const c = document.querySelector('#sheetsChk'); return c ? c.closest('label') || c : null; },
    // the Sound control of the top bar (the sound round); the Phase key check of Y's options (X → Y, Y on its plane)
    soundBtn: '#soundBtn', soundBar: '#soundPh',
    // the Phase style control of the Phase view's options (Tiles, Plain, …, Cauchy)
    phaseStyle: '#dcSeg',
    phaseKey: () => { const c = document.querySelector('#wKeyChkR'); return c ? c.closest('label') || c : null; },
    // Y's Display options button, where the Phase key goes when Y's options strip has no room for it
    rightOpts: '#rightFoot .opts-btn',
    // v15: the Inspector's Selection (the selected step's editor), its Parameters (shared numbers), the F tile that
    // closes the chain; on a phone, the Sphere key in the plane's right column
    // (v15.1) the selected step's lens (Show this step alone) in the Inspector's head: in a phone's sheet
    lens: '#propsPanel .insp-step .ihead .alone-btn',
    inspector: '#propsPanel .insp-sel', params: () => document.querySelector('#propsPanel .prm') || document.querySelector('#propsPanel .insp-params'),
    fTile: '#pipeline .ftile', sphereKey: () => [...document.querySelectorAll('.ph-col .ph-sph')].find((e) => e.offsetParent) || null,
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
  // opt.safe: the safe-area insets {t, r, b, l} (a phone's notch and home bar), kept clear like the 12 px margin.
  // opt.block: rects the card must never cover, the layers the user opened (the palette, a menu, a dialog): every place
  // above is tried clear of them, then places beside them; when none is clear the result is {mode: 'dock'}, and the
  // caller docks the callout, compact, at an edge (placeDock).
  const M = 12, GAP = 14;
  // the area of the card at (x, y) over rects, each grown by m
  const overArea = (card, x, y, rects, m = 4) => rects.reduce((s, h) => s + Math.max(0, Math.min(x + card.w, h.r + m) - Math.max(x, h.l - m)) * Math.max(0, Math.min(y + card.h, h.b + m) - Math.max(y, h.t - m)), 0);
  // the box the card stays in: the viewport less the margin and the safe area
  const bounds = (vp, sf = {}) => ({ l: M + (sf.l || 0), t: M + (sf.t || 0), r: vp.w - M - (sf.r || 0), b: vp.h - M - (sf.b || 0) });
  function place(hole, card, vp, opt = {}) {
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const B = bounds(vp, opt.safe);
    const others = (opt.others || []).filter(Boolean);
    const block = (opt.block || []).filter(Boolean);
    const lit = hole ? [hole].concat(others) : others;
    const over = (x, y, rects, m = 4) => overArea(card, x, y, rects, m);
    // clear of every open layer (8 px apart)
    const free = (x, y) => !block.length || over(x, y, block, 8) === 0;
    const DOCK = { mode: 'dock', side: null, x: 0, y: 0, caret: null };
    const MINI = { mode: 'mini', side: null, x: 0, y: 0, caret: null };
    if (vp.w < (opt.narrow || 640)) {
      // a sheet across the bottom or the top, or in a gap between lit areas
      const ys = [];
      const low = hole && (hole.t + hole.b) / 2 > vp.h * 0.55;
      ys.push(['bottom', B.b - card.h], ['top', B.t]);
      if (low) ys.reverse();
      const sorted = lit.slice().sort((a, b) => a.t - b.t);
      for (let i = 0; i + 1 < sorted.length; i++) {
        const g0 = sorted[i].b, g1 = sorted[i + 1].t;
        if (g1 - g0 >= card.h + 16) ys.push(['middle', Math.round(g0 + (g1 - g0 - card.h) / 2)]);
      }
      // with a layer open: right above or below it too
      for (const k of block) { if (k.t - 8 - card.h >= B.t) ys.push(['middle', k.t - 8 - card.h]); if (k.b + 8 + card.h <= B.b) ys.push(['middle', k.b + 8]); }
      let best = null;
      // (covering the anchor costs most: on a phone a large plane and a bar may leave no gap between them)
      for (const [side, y] of ys) {
        if (!free(B.l, y)) continue;
        const o = over(B.l, y, lit, 2) + (hole ? 7 * over(B.l, y, [hole], 2) : 0);
        if (!best || o < best.o) best = { side, y, o };
        if (o === 0) break;
      }
      if (!best) return DOCK;
      // (v15.1, opt.mini: a phone keeps every lit area, the step's work area, clear; with no such place the callout
      // collapses to a one-line bar, placeMini)
      if (opt.mini && best.o > 0 && overArea(card, B.l, best.y, lit, 0) > 0) return MINI;
      return { mode: 'sheet', side: best.side, x: B.l, y: Math.round(best.y), caret: null };
    }
    const fl = [[B.l, B.t], [B.r - card.w, B.t], [B.l, B.b - card.h], [B.r - card.w, B.b - card.h]];
    // beside each open layer, and the corners: the places left when a layer is in the way
    const aside = () => {
      const out = [];
      for (const k of block) { const s = sides(k); for (const side of ['right', 'left', 'bottom', 'top']) if (s[side]) out.push([s[side].x, s[side].y]); }
      return out.concat(fl).map(([x, y]) => ({ mode: 'float', side: null, x, y, caret: null }));
    };
    if (!hole) {
      const c = { mode: 'center', side: null, x: Math.round(clamp((vp.w - card.w) / 2, B.l, B.r - card.w)), y: Math.round(clamp((vp.h - card.h) / 2, B.t, B.b - card.h)), caret: null };
      if (free(c.x, c.y)) return c;
      let best = null;
      for (const q of aside()) { if (!free(q.x, q.y)) continue; const o = over(q.x, q.y, lit); if (!best || o < best.o) best = Object.assign(q, { o }); }
      return best ? fin(best) : DOCK;
    }
    // the four places beside R, centred on c (default: R's centre) along the shared edge
    function sides(R, c) {
      const cx = c ? c.x : (R.l + R.r) / 2, cy = c ? c.y : (R.t + R.b) / 2;
      return {
        right: R.r + GAP + card.w <= B.r && { x: R.r + GAP, y: clamp(cy - card.h / 2, B.t, B.b - card.h) },
        left: R.l - GAP - card.w >= B.l && { x: R.l - GAP - card.w, y: clamp(cy - card.h / 2, B.t, B.b - card.h) },
        bottom: R.b + GAP + card.h <= B.b && { x: clamp(cx - card.w / 2, B.l, B.r - card.w), y: R.b + GAP },
        top: R.t - GAP - card.h >= B.t && { x: clamp(cx - card.w / 2, B.l, B.r - card.w), y: R.t - GAP - card.h },
      };
    }
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
    for (const c of cands) if (over(c.x, c.y, lit) === 0 && free(c.x, c.y)) return fin(c);
    // (v15.1, a phone in landscape: nothing beside the lit areas, so the bar; never over them)
    if (opt.mini && lit.length) return MINI;
    // 2b. below or above the hole, short of room by a little: at the viewport's edge there, over the hole's rim only
    // (Preimages at 900 px: under Y, over Y's bottom margin, not inside Y over its disc)
    for (const side of order) {
      let y = null;
      // (below: over the hole's bottom rim by at most a quarter of the card, where the panes keep their options strips;
      // above: 12 %, the panes' titles)
      if (side === 'bottom') { const v = B.b - card.h; if (v < hole.b + GAP && v > hole.b - 0.25 * card.h) y = v; }
      else if (side === 'top') { const v = B.t; if (v + card.h > hole.t - GAP && v + card.h < hole.t + 0.12 * card.h) y = v; }
      if (y == null) continue;
      const x = clamp(hx - card.w / 2, B.l, B.r - card.w);
      // (over the rims of all the lit areas together, X's and Y's: at most a quarter of the card below, 12 % above)
      if (over(x, y, lit) <= (side === 'bottom' ? 0.25 : 0.12) * card.w * card.h && free(x, y)) return fin({ mode: 'edge', side, x, y, caret: null });
    }
    // 3. no room beside it (a panel as wide as the stage): inside the hole, in the corner with the fewest controls
    if (hole.r - hole.l >= card.w + 32 && hole.b - hole.t >= card.h + 32) {
      const avoid = (typeof opt.avoid === 'function' ? opt.avoid() : opt.avoid) || [];
      const ins = [[hole.l + 16, hole.b - 16 - card.h], [hole.r - 16 - card.w, hole.b - 16 - card.h], [hole.l + 16, hole.t + 16], [hole.r - 16 - card.w, hole.t + 16]]
        .map(([x, y]) => ({ mode: 'inset', side: null, x: clamp(x, B.l, B.r - card.w), y: clamp(y, B.t, B.b - card.h), caret: null }));
      let best = null;
      for (const c of ins) { if (!free(c.x, c.y)) continue; const o = over(c.x, c.y, avoid, 6) + over(c.x, c.y, others); if (!best || o < best.o) best = Object.assign(c, { o }); }
      if (best) return fin(best);
    }
    // 4. a small screen: the place that covers the least of what is lit, without a pointer
    cands.push(...fl.map(([x, y]) => ({ mode: 'float', side: null, x, y, caret: null })));
    if (block.length) cands.push(...aside());
    let best = null;
    for (const c of cands) { if (!free(c.x, c.y)) continue; const o = over(c.x, c.y, lit); if (!best || o < best.o) best = Object.assign(c, { o }); }
    if (!best) return DOCK;
    return fin(Object.assign(best, { mode: 'float', caret: null }));
    function fin(c) { return { mode: c.mode, side: c.side, x: Math.round(c.x), y: Math.round(c.y), caret: c.caret == null ? null : Math.round(c.caret) }; }
  }
  // The docked callout (place() found no room clear of an open layer): compact, in a corner or along the top or the
  // bottom edge, where it covers the least of the open layers, then of what is lit. A layer that fills the screen (a
  // dialog on a phone) leaves no such place: the callout then keeps off the layer's controls (opt.avoid: rects, or a
  // function called only then). card: the docked card's size; opt: {safe, block, lit, avoid}. Returns {mode: 'dock',
  // side: 'top' | 'bottom', x, y}.
  function placeDock(card, vp, opt = {}) {
    // (8 px from the screen's edges, not 12: a dialog with a narrow margin above or below it still leaves room)
    const sf = opt.safe || {};
    const B = { l: 8 + (sf.l || 0), t: 8 + (sf.t || 0), r: vp.w - 8 - (sf.r || 0), b: vp.h - 8 - (sf.b || 0) };
    const block = (opt.block || []).filter(Boolean), lit = (opt.lit || []).filter(Boolean);
    const xs = [B.r - card.w, B.l, Math.round((vp.w - card.w) / 2)];
    let avoid = null;
    // the cost of a place, compared in order: the layers' controls it covers, the layers it covers, how close it comes
    // to them (8 px), how far it is from the screen's edge (only when scanning), what is lit
    const cost = (x, y, edge) => {
      const ob = overArea(card, x, y, block, 0);
      if (ob > 0 && avoid == null) avoid = (typeof opt.avoid === 'function' ? opt.avoid() : opt.avoid) || [];
      return [ob > 0 ? overArea(card, x, y, avoid, 4) : 0, ob, overArea(card, x, y, block, 8) + (edge || 0), overArea(card, x, y, lit, 0)];
    };
    const less = (a, b) => { for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 0.5) return a[i] < b[i]; return false; };
    let best = null;
    for (const [side, y] of [['top', B.t], ['bottom', B.b - card.h]]) {
      for (const x of xs) { const o = cost(x, y); if (!best || less(o, best.o)) best = { side, x, y, o }; }
    }
    // every edge place covers a control (a dialog that fills a phone's screen): the strip nearest an edge that covers none
    if (best.o[0] > 0) {
      for (let y = B.t; y <= B.b - card.h; y += 8) {
        for (const x of xs) {
          const o = cost(x, y, 10 * Math.min(y - B.t, B.b - card.h - y));
          if (less(o, best.o)) best = { side: y - B.t <= B.b - card.h - y ? 'top' : 'bottom', x, y, o };
        }
      }
    }
    return { mode: 'dock', side: best.side, x: Math.round(Math.max(B.l, best.x)), y: Math.round(Math.max(B.t, best.y)), caret: null, over: best.o[1] };
  }
  // v15.1: the collapsed bar of a phone (place() returned 'mini'), covering none of the work area and no open layer
  // (review-phone phone-4). Places tried: the top and the bottom edge, 2 px inside the safe area (a phone's header and
  // tool row are 56 px), and in landscape, where the header is 48 px, a slim bar (opt.slimH, no inner padding) 1 px
  // inside; then right below or above a lit area. In each, the bar runs full width or along the widest free stretch,
  // at least opt.minW (the title, Back, the count and Next). Of the clear places: the one placed before (opt.prev)
  // while it is still clear (no chasing), else the widest, at an edge, not slim, farther from the anchor. When none is
  // clear: the full-width edge that covers the least of the work area and no layer, else null (the caller docks).
  // opt: {safe, work, block, anchor, minW, slimH, prev}. Returns {mode: 'mini', side, x, y, w, h, slim, over}.
  function placeMini(bar, vp, opt = {}) {
    const sf = opt.safe || {}, work = (opt.work || []).filter(Boolean), block = (opt.block || []).filter(Boolean);
    const x0 = 8 + (sf.l || 0), x1 = vp.w - 8 - (sf.r || 0), a = opt.anchor, ay = a ? (a.t + a.b) / 2 : vp.h / 2;
    const top = sf.t || 0, bot = vp.h - (sf.b || 0);
    const minW = Math.min(x1 - x0, opt.minW || 220);
    const cands = [], fulls = [];
    const band = (side, y0, h, slim, edge) => {
      const y = Math.round(y0);
      if (y < top || y + h > bot) return;
      const far = Math.abs(y + h / 2 - ay);
      if (edge && !slim) fulls.push({ side, y, x: x0, w: x1 - x0, h, slim, o: overArea({ w: x1 - x0, h }, x0, y, work, 0), k: overArea({ w: x1 - x0, h }, x0, y, block, 0), far });
      // the free stretches of the band
      const cut = work.concat(block).filter((q) => q.b > y && q.t < y + h && q.r > x0 && q.l < x1).map((q) => [Math.max(x0, q.l), Math.min(x1, q.r)]).sort((p, q) => p[0] - q[0]);
      let x = x0;
      for (const [l, r] of cut.concat([[x1, x1]])) { if (l - x >= minW) cands.push({ side, y, x: Math.round(x), w: Math.floor(l - x), h, slim, edge, far }); x = Math.max(x, r); }
    };
    band('top', top + 2, bar.h, false, true); band('bottom', bot - 2 - bar.h, bar.h, false, true);
    if (opt.slimH) { band('top', top + 1, opt.slimH, true, true); band('bottom', bot - 1 - opt.slimH, opt.slimH, true, true); }
    for (const q of work) { band('middle', q.b + 2, bar.h, false, false); band('middle', q.t - 2 - bar.h, bar.h, false, false); }
    const pv = opt.prev;
    const prev = pv && cands.find((c) => c.y === pv.y && c.h === pv.h && c.x <= pv.x + 0.5 && c.x + c.w >= pv.x + pv.w - 0.5);
    let c = prev ? Object.assign({}, prev, { x: pv.x, w: pv.w }) : cands.sort((p, q) => q.w - p.w || (q.edge ? 1 : 0) - (p.edge ? 1 : 0) || (p.slim ? 1 : 0) - (q.slim ? 1 : 0) || q.far - p.far)[0];
    if (!c) c = fulls.filter((q) => q.k === 0).sort((p, q) => p.o - q.o || q.far - p.far)[0];
    return c ? { mode: 'mini', side: c.side, x: c.x, y: c.y, w: c.w, h: c.h, slim: !!c.slim, over: c.o || 0, caret: null } : null;
  }
  // The widest strip beside the open layers, left or right, from the screen's edge (8 px, and the safe area) to 8 px
  // short of the layers: the docked callout narrows into it rather than cover a layer (a dialog with side margins
  // narrower than the docked strip). 0 when it is narrower than min.
  function dockGutter(vp, opt = {}) {
    const sf = opt.safe || {}, block = (opt.block || []).filter(Boolean);
    if (!block.length) return 0;
    const U = block.reduce((u, h) => ({ l: Math.min(u.l, h.l), r: Math.max(u.r, h.r) }), { l: Infinity, r: -Infinity });
    const w = Math.floor(Math.max(U.l - 8 - (8 + (sf.l || 0)), vp.w - 8 - (sf.r || 0) - (U.r + 8)));
    return w >= (opt.min || 120) ? w : 0;
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
  let lastWhy = null;    // the steps the last run skipped, and why (Tour.skipped())
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
  // (v15: on a phone the ⋯ sheet lists Guided tour)
  const helpWhere = () => (anchorEl('helpBtn') ? $t('Help') : anchorEl('moreBtn') ? $t('⋯ › Guided tour') : $t('Help'));
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
  // What a name lights (api.anchor, else the ANCHORS default): an Element (HTML or SVG); a list of Elements, a composite
  // anchor whose visible members are each lit exactly; or a region of an element, { el, rect }, such as a part of a
  // canvas: rect is { x, y, w, h } in CSS px from the element's top left corner, or a function returning a client rect
  // { left, top, right, bottom }. Normalised to { el (the first visible element), parts: [{ el, rect? }] } or null.
  function anchorVal(n) {
    let e;
    try { e = api.anchor ? api.anchor(n) : undefined; } catch (x) { e = undefined; }
    if (e === undefined && ANCHORS[n]) { try { e = typeof ANCHORS[n] === 'function' ? ANCHORS[n]() : document.querySelector(ANCHORS[n]); } catch (x) { e = null; } }
    return e;
  }
  function normAnchor(v) {
    if (!v) return null;
    if (Array.isArray(v) || (typeof NodeList !== 'undefined' && v instanceof NodeList)) {
      const els = [...v].filter(visible);
      return els.length ? { el: els[0], parts: els.map((e) => ({ el: e })) } : null;
    }
    if (v.el && v.rect && !(typeof Element !== 'undefined' && v instanceof Element)) return visible(v.el) ? { el: v.el, parts: [{ el: v.el, rect: v.rect }] } : null;
    return visible(v) ? { el: v, parts: [{ el: v }] } : null;
  }
  // (ok: a further test, such as not clipped away)
  function anchorOf(names, ok) {
    for (const n of [].concat(names)) { const t = normAnchor(anchorVal(n)); if (t && (!ok || ok(t))) return t; }
    return null;
  }
  function anchorEl(names) { const t = anchorOf(names); return t ? t.el : null; }
  // a part's box in client px: the element's border box, or its region
  function partBox(p) {
    const b = p.el.getBoundingClientRect();
    if (!p.rect) return b;
    try {
      const q = typeof p.rect === 'function' ? p.rect(p.el) : p.rect;
      if (q && q.left != null) return { left: q.left, top: q.top, right: q.right, bottom: q.bottom, width: q.right - q.left, height: q.bottom - q.top };
      if (q && q.x != null) return { left: b.left + q.x, top: b.top + q.y, right: b.left + q.x + q.w, bottom: b.top + q.y + q.h, width: q.w, height: q.h };
    } catch (e) { /* the element's box */ }
    return b;
  }
  // the corner radii of an element in px [top left, top right, bottom right, bottom left]: its border-radius, or the
  // rx of an SVG rect; 0 for anything else
  function radii(e) {
    try {
      if (typeof HTMLElement !== 'undefined' && e instanceof HTMLElement) {
        const cs = getComputedStyle(e), b = e.getBoundingClientRect(), m = Math.min(b.width, b.height);
        return ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius'].map((k) => {
          const v = String(cs[k] || '0').split(' ')[0], n = parseFloat(v);
          return !Number.isFinite(n) ? 0 : /%$/.test(v) ? (n / 100) * m : n;
        });
      }
      if (e && e.tagName === 'rect' && e.rx && e.rx.baseVal && e.getScreenCTM) {
        const k = e.rx.baseVal.value * Math.abs(e.getScreenCTM().a || 1);
        return [k, k, k, k];
      }
    } catch (x) { /* square */ }
    return [0, 0, 0, 0];
  }
  // the part of e that can be seen: its box (or the given box) cut by every scrolling or clipping ancestor (a side
  // panel that scrolls)
  function seenBox(e, box) {
    const r = box || e.getBoundingClientRect();
    let l = r.left, t = r.top, rr = r.right, b = r.bottom;
    // (a fixed box, such as a phone's tool row, is not clipped by the ancestors above it)
    let fx = getComputedStyle(e).position === 'fixed';
    // clip: the box the ancestors that clip and cannot scroll leave (null: none)
    let clip = null;
    for (let a = e.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
      if (fx) break;
      const cs = getComputedStyle(a);
      fx = cs.position === 'fixed';
      if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
      // a box that cannot clip: display: contents (the header's popover on a wide screen: auto overflow, a 0 × 0 box)
      if (cs.display === 'contents') continue;
      const q = a.getBoundingClientRect();
      if (q.width === 0 && q.height === 0) continue;
      l = Math.max(l, q.left); t = Math.max(t, q.top); rr = Math.min(rr, q.right); b = Math.min(b, q.bottom);
      // (only a panel that cannot scroll: a scrolled panel is scrolled back by reveal, or by the user)
      if (/(hidden|clip)/.test(cs.overflowX + cs.overflowY)) clip = clip ? { l: Math.max(clip.l, q.left), t: Math.max(clip.t, q.top), r: Math.min(clip.r, q.right), b: Math.min(clip.b, q.bottom) } : { l: q.left, t: q.top, r: q.right, b: q.bottom };
    }
    return { l, t, r: Math.max(l, rr), b: Math.max(t, b), full: r, clip };
  }
  // the viewport the tour draws in: the layout viewport less any classic scroll bar (what position: fixed fills)
  function vpSize() {
    const d = document.documentElement;
    return { w: (d && d.clientWidth) || innerWidth, h: (d && d.clientHeight) || innerHeight };
  }
  // Clipped away: a panel that cannot scroll leaves (almost) nothing of a part that would fit in it (a phone in
  // landscape squeezes the panes to a strip: the transport below them is cut to a 0 px line). A part bigger than its
  // panel is not clipped away: its visible part is what is lit. The viewport does not count (a scroll brings it in).
  function clippedAway(full, s) {
    if (!s.clip) return false;
    const c = s.clip, fw = full.right - full.left, fh = full.bottom - full.top;
    const w = Math.min(full.right, c.r) - Math.max(full.left, c.l), h = Math.min(full.bottom, c.b) - Math.max(full.top, c.t);
    if (fw <= 0 || fh <= 0) return false;
    if (w < Math.min(6, fw / 2) || h < Math.min(6, fh / 2)) return true;
    const big = fw > c.r - c.l + 1 || fh > c.b - c.t + 1;
    return !big && w * h < 0.25 * fw * fh;
  }
  // A part's lit rect: exactly its visible box (grown by pad, 0 unless a step asks), cut by the viewport, with its
  // corner radii; a corner on a cut edge is square. hidden: the part is clipped away.
  function partRect(p, pad) {
    const full = partBox(p), s = seenBox(p.el, full), vp = vpSize(), W = vp.w, H = vp.h;
    const l = Math.max(0, s.l - pad), t = Math.max(0, s.t - pad), rr = Math.min(W, s.r + pad), b = Math.min(H, s.b + pad);
    const cut = [t > full.top - pad + 0.5, rr < full.right + pad - 0.5, b < full.bottom + pad - 0.5, l > full.left - pad + 0.5];   // top, right, bottom, left
    const k = p.rect ? [0, 0, 0, 0] : radii(p.el);
    const rad = [cut[0] || cut[3] ? 0 : k[0], cut[0] || cut[1] ? 0 : k[1], cut[2] || cut[1] ? 0 : k[2], cut[2] || cut[3] ? 0 : k[3]].map((x) => (x > 0 ? x + pad : 0));
    return { l, t, r: Math.max(l, rr), b: Math.max(t, b), rad, hidden: clippedAway(full, s) };
  }
  // every part of an anchor is clipped away
  const tgtHidden = (tgt) => !!tgt && tgt.parts.every((q) => partRect(q, 0).hidden);

  // ---------------------------------------------------------------- styles
  const CSS = `
/* the spotlight's shade: the app's ink, a little deeper than the modal scrim so the lit patch reads at a glance */
:root { --tour-scrim: #121A2080; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --tour-scrim: #000000A3; } }
:root[data-theme="dark"] { --tour-scrim: #000000A3; }
/* two layers: the shade (z 25) sits under the app's own menus, palette and dialogs, so a layer the user opens is lit
   and usable; the ring and the callout (.tour-top) sit above every app layer, in the top layer while the app has one
   open there (its More menu is a popover) */
.tour-root { position: fixed; inset: 0; z-index: 25; pointer-events: none; }
:root.ph .tour-root { z-index: 27; }   /* (v15: above the chain bar, 26; under the More sheet, 28, a layer) */
.tour-top, .tour-top[popover] { position: fixed; inset: 0; z-index: 2147483000; pointer-events: none; width: auto; height: auto; max-width: none; max-height: none; margin: 0; padding: 0; border: 0; background: transparent; overflow: visible; color: inherit; }
.tour-top::backdrop { background: transparent; pointer-events: none; }
.tour-dim { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
.tour-dim .tour-shade { fill: var(--tour-scrim); pointer-events: visiblePainted; cursor: default; }
.tour-dim .tour-ring { fill: none; stroke: var(--accent); stroke-width: 1.5; pointer-events: none; }
.tour-dim .tour-glow { fill: none; stroke: var(--accent); stroke-opacity: 0.22; stroke-width: 7; pointer-events: none; }
.tour-dim .tour-mark { fill: none; stroke: var(--accent); stroke-width: 1.5; stroke-dasharray: 4 3; pointer-events: none; }
.tour-card {
  position: fixed; z-index: 1; left: 0; top: 0; width: 320px; max-width: calc(100% - 24px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)); pointer-events: auto;
  max-height: calc(100vh - 24px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
  max-height: calc(100dvh - 24px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
  display: flex; flex-direction: column; box-sizing: border-box;
  background: var(--surface); border: 1px solid var(--line-strong); border-radius: var(--r-4, 6px); box-shadow: var(--shadow-3);
  color: var(--ink); font: var(--t-body); text-align: left; outline: none; overflow-wrap: break-word;
  transition: opacity var(--t-med) var(--ease-out), translate var(--t-med) var(--ease-out);
}
.tour-card.center { width: 380px; }
.tour-card.entering { opacity: 0; translate: 0 4px; }
.tour-card.sheet { width: auto; right: calc(12px + env(safe-area-inset-right, 0px)); left: calc(12px + env(safe-area-inset-left, 0px)) !important; max-width: none; }
/* docked: an open layer leaves no room for the whole callout; it waits along an edge, title and × only */
.tour-card.docked { width: max-content; min-width: min(220px, calc(100% - 24px)); max-width: min(420px, calc(100% - 24px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px))); }
.tour-card.docked .tour-scroll, .tour-card.docked .tour-foot, .tour-card.docked .tour-chap, .tour-card.docked .tour-caret { display: none; }
.tour-card.docked .tour-dock { display: block; }
.tour-card.docked .tour-in { padding: 0 0 0 14px; }
.tour-card.docked .tour-head { margin: 0; }
/* the × alone: no strip beside the layers is wide enough for the title */
.tour-card.docked.tight { width: auto; min-width: 0; }
.tour-card.docked.tight .tour-in { padding: 0; }
.tour-card.docked.tight .tour-dock { display: none; }
.tour-dock { display: none; flex: 1 1 auto; min-width: 0; padding: 4px 0; font: 600 14px/20px var(--f-ui); color: var(--ink); }
/* v15.1 (notes/tour/PHONE.md): on a phone the spotlight of a part inside a scrolling panel (a sheet, the chain) is
   drawn inside that panel, so the panel's own scroll moves it in the same frame as the content (no script follows) */
.tour-dim.tour-host { inset: auto; left: 0; top: 0; width: 1px; height: 1px; overflow: visible; z-index: 2147482000; pointer-events: none; }
/* (the rings fade while something they cannot follow natively moves: a fling of the page, a sliding layer) */
.tour-rings { transition: opacity 160ms linear; }
.tour-rings.moving { opacity: 0; transition: opacity 80ms linear; }
.tour-card.mini { width: auto; max-width: none; right: auto; }
/* v15.1: the one-line bar a phone's callout collapses to when no place keeps clear of the step's work area: the step's
   title and, on a Try it step, its task (a tap shows the whole step), Back, the count and Next. (review-phone phone-1:
   .tour-card first, so the app's .icon-btn (display: inline-grid) cannot show the fold button outside its case) */
.tour-card .tour-grow, .tour-card .tour-fold, .tour-card .tour-mback { display: none; }
.tour-card.mini .tour-bar { display: block; }
.tour-card.mini .tour-in { flex-direction: row; align-items: center; gap: 8px; padding: 3px 3px 3px 4px; }
/* (a phone in landscape: the header is 48 px; the bar fits in it with no inner padding) */
.tour-card.mini.slim .tour-in { padding-top: 0; padding-bottom: 0; }
.tour-card.mini .tour-head { flex: 1 1 auto; min-width: 0; margin: 0; }
.tour-card.mini .tour-scroll, .tour-card.mini .tour-chap, .tour-card.mini .tour-x, .tour-card.mini .tour-caret, .tour-card.mini .tour-dock,
.tour-card.mini .tour-fold, .tour-card.mini .tour-foot .btn.ghost { display: none !important; }
.tour-card.mini .tour-grow { display: flex; }
.tour-card.mini .tour-mback:not([hidden]) { display: inline-grid; place-items: center; flex: 0 0 auto; width: 44px; height: 44px; min-width: 44px; min-height: 44px; }
/* (8 px between the bar's 44 px buttons, as on the whole card: POLISH.md, the audit's btnGap) */
.tour-card.mini .tour-foot { flex: 0 0 auto; flex-wrap: nowrap; margin: 0; gap: 8px; }
.tour-card.mini .tour-count { display: block; flex: 0 0 auto; }
/* (review-phone phone-8e: the focus ring inside the bar's own border) */
.tour-card.mini button:focus-visible { outline-offset: -3px; }
.tour-grow { flex: 1 1 auto; align-items: center; gap: 6px; min-width: 0; min-height: 44px; padding: 0 6px; margin: 0; background: none; border: 0; border-radius: var(--r-2, 4px); color: var(--ink); text-align: left; cursor: pointer; }
.tour-gs { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; justify-content: center; }
/* the title: two lines when it is alone (360 px, Russian), one beside the task */
.tour-gt { overflow: hidden; font: 600 14px/18px var(--f-ui); display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow-wrap: anywhere; }
.tour-card.has-task .tour-gt { display: block; white-space: nowrap; text-overflow: ellipsis; font-size: 13px; line-height: 17px; }
.tour-gk { display: flex; align-items: center; gap: 5px; min-width: 0; font: 400 12px/16px var(--f-ui); color: var(--ink-2); }
.tour-gk[hidden] { display: none; }
.tour-gk > span:last-child { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.tour-gk .tour-tick { flex: 0 0 12px; width: 12px; height: 12px; border-radius: 50%; border: 1.5px solid var(--accent); box-sizing: border-box; display: grid; place-items: center; }
.tour-gk .tour-tick svg { width: 8px; height: 8px; opacity: 0; }
.tour-gk.done .tour-tick { background: var(--accent); }
.tour-gk.done .tour-tick svg { opacity: 1; color: var(--accent-ink); }
.tour-grow > svg, .tour-fold svg, .tour-mback svg { flex: 0 0 16px; width: 16px; height: 16px; color: var(--accent); }
.tour-card.over .tour-fold { display: inline-grid; place-items: center; flex: 0 0 auto; }
.tour-card.nudge { animation: tour-nudge 320ms var(--ease-std); }
@keyframes tour-nudge { 30% { translate: 0 -3px; } 60% { translate: 0 1px; } }
.tour-bar { position: absolute; left: -1px; right: -1px; top: -1px; height: 3px; border-radius: var(--r-4, 6px) var(--r-4, 6px) 0 0; overflow: hidden; background: transparent; }
.tour-bar > i { display: block; height: 100%; width: 0; background: var(--accent); transition: width var(--t-slow) var(--ease-std); }
.tour-in { display: flex; flex-direction: column; min-height: 0; padding: 14px 16px 12px; }
.tour-scroll { flex: 0 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
.tour-head { display: flex; align-items: center; gap: 8px; min-height: 20px; margin: -10px -12px 2px 0; flex: 0 0 auto; }
.tour-chap { flex: 1 1 auto; min-width: 0; font: var(--t-caption); color: var(--muted); letter-spacing: 0.01em; white-space: normal; overflow-wrap: anywhere; }
/* buttons: at least 36 px with a mouse, 44 px on a touch screen, 8 px apart; the row wraps rather than clip */
.tour-card .tour-x { flex: 0 0 auto; width: 36px; height: 36px; min-width: 36px; min-height: 36px; }
.tour-title { margin: 0 0 6px; font: 600 15px/20px var(--f-ui); color: var(--ink); text-wrap: balance; }
.tour-body { margin: 0; font: 400 13px/19px var(--f-ui); color: var(--ink-2); text-wrap: pretty; }
.tour-body .kbd, .tour-try .kbd { margin: 0 1px; }
.tour-body mjx-container, .tour-try mjx-container { font-size: 106% !important; color: var(--ink); }
/* MathJax's hidden copy for screen readers starts at the formula's top and can reach 2 px below it: kept inside the
   formula, so a formula on the last line never makes the text scroll */
.tour-card mjx-assistive-mml { box-sizing: border-box !important; max-height: 100% !important; }
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
.tour-foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px; margin-top: 14px; flex: 0 0 auto; }
.tour-count { flex: 1 1 auto; min-width: 0; font: var(--t-readout); color: var(--muted); white-space: nowrap; }
.tour-count:empty { display: none; }
.tour-foot .btn { height: auto; min-height: 36px; min-width: 36px; padding: 0 14px; white-space: nowrap; max-width: 100%; }
.tour-card button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.tour-card .tour-fold { width: 36px; height: 36px; min-width: 36px; min-height: 36px; }
@media (pointer: coarse) {
  .tour-card .tour-x, .tour-card .tour-fold { width: 44px; height: 44px; min-width: 44px; min-height: 44px; }
  .tour-foot .btn { min-height: 44px; min-width: 44px; padding: 0 16px; }
  .tour-head { margin: -12px -14px 2px 0; }
}
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
  const ICON_UP = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10l4-4 4 4"/></svg>';
  const ICON_LEFT = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M10 4l-4 4 4 4"/></svg>';
  const ICON_DOWN = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l4 4 4-4"/></svg>';
  const ICON_CHECK = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-7"/></svg>';
  const ICON_PLAY = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="currentColor"><path d="M5 3.5v9l7.5-4.5z"/></svg>';
  const ICON_BOOK = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M2.5 3.5c2-.8 3.8-.6 5.5.7v9c-1.7-1.3-3.5-1.5-5.5-.7zM13.5 3.5c-2-.8-3.8-.6-5.5.7v9c1.7-1.3 3.5-1.5 5.5-.7z"/></svg>';
  const ICON_KEYS = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="1.5" y="4" width="13" height="8.5" rx="1.5"/><path d="M4 7h.01M6.5 7h.01M9 7h.01M11.5 7h.01M5 10h6"/></svg>';
  const mark = () => {
    const m = document.querySelector('header svg.mark');
    return m ? `<svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true">${m.innerHTML}</svg>` : '';
  };

  // ---------------------------------------------------------------- spotlight
  // Two SVGs. The shade (in .tour-root, under the app's own layers): a full-screen fill with a hole per lit area
  // (even-odd), so clicks on the shade stop and clicks in a hole reach the app. The rings (in .tour-top, above every
  // layer): a 1.5px accent ring and a soft glow just outside each hole, and a dashed ring just outside an anchor that
  // sits inside a lit panel; they are masked out of any open layer, so they never draw over what the user opened. A
  // hole is exactly the lit element's visible border box, with its corner radii; holes animate in JS between steps
  // (CSS cannot animate a path in every browser), towards the target as it is measured in each frame.
  const radOf = (h) => (Array.isArray(h.rad) ? h.rad : [0, 1, 2, 3].map(() => h.rad || 0));
  function rrPath(h) {
    const w = h.r - h.l, ht = h.b - h.t, m = Math.max(0, Math.min(w / 2, ht / 2));
    const [a, b, c, d] = radOf(h).map((x) => Math.max(0, Math.min(x, m)));
    return `M${h.l + a} ${h.t}H${h.r - b}A${b} ${b} 0 0 1 ${h.r} ${h.t + b}V${h.b - c}A${c} ${c} 0 0 1 ${h.r - c} ${h.b}H${h.l + d}A${d} ${d} 0 0 1 ${h.l} ${h.b - d}V${h.t + a}A${a} ${a} 0 0 1 ${h.l + a} ${h.t}Z`;
  }
  // a rect grown by e, its radii with it (a ring drawn just outside a hole)
  const grow = (h, e) => ({ l: h.l - e, t: h.t - e, r: h.r + e, b: h.b + e, rad: radOf(h).map((x) => x + e) });
  // (each SVG's viewBox is its own client box, so one unit is one CSS px at the same place: a classic scroll bar
  // narrows the fixed roots, never the drawing's scale)
  const boxOf = (g) => { const b = g.getBoundingClientRect(); return b.width > 0 && b.height > 0 ? b : Object.assign({ left: 0, top: 0 }, vpSize(), { width: vpSize().w, height: vpSize().h }); };
  // (wins, v15.1: windows over the panels a phone's spotlight is drawn inside: open in the shade, with no ring)
  function drawHoles(ui, holes, mark, layers, wins) {
    const sb = boxOf(ui.svg), rb = boxOf(ui.rsvg);
    const X = sb.left, Y = sb.top, W = sb.width, H = sb.height;
    ui.svg.setAttribute('viewBox', `${X} ${Y} ${W} ${H}`);
    ui.rsvg.setAttribute('viewBox', `${rb.left} ${rb.top} ${rb.width} ${rb.height}`);
    ui.shade.setAttribute('d', `M${X} ${Y}H${X + W}V${Y + H}H${X}Z` + holes.map(rrPath).join('') + (wins || []).map(rrPath).join(''));
    ui.ring.setAttribute('d', holes.map((h) => rrPath(grow(h, 0.75))).join(''));
    ui.glow.setAttribute('d', holes.map((h) => rrPath(grow(h, 3.5))).join(''));
    // (mark: the anchor's own ring, or a list: the anchor's and the insets')
    if (mark !== undefined) ui.mark.setAttribute('d', [].concat(mark || []).map((m) => rrPath(grow(m, 0.75))).join(''));
    if (layers !== undefined) {
      for (const [k, v] of [['x', rb.left], ['y', rb.top], ['width', rb.width], ['height', rb.height]]) { ui.maskRect.setAttribute(k, v); ui.maskEl.setAttribute(k, v); }
      ui.maskHoles.setAttribute('d', (layers || []).map((h) => rrPath(grow(h, 2))).join(''));
    }
    ui.holes = holes;
  }
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  // the holes drawn u of the way from `from` to `to` (pairs morph; a hole without a partner grows from, or into, the
  // first partner's rectangle)
  function between(from, to, u) {
    const lerp = (a, b) => a + (b - a) * u;
    if (!from.length || !to.length) return to;
    const n = Math.max(from.length, to.length), out = [];
    for (let i = 0; i < n; i++) {
      const a = from[i] || from[0], b = to[i] || to[0], ra = radOf(a), rb = radOf(b);
      out.push({ l: lerp(a.l, b.l), t: lerp(a.t, b.t), r: lerp(a.r, b.r), b: lerp(a.b, b.b), rad: ra.map((x, j) => lerp(x, rb[j])) });
    }
    return out;
  }

  let maskN = 0;
  function buildUI() {
    const NS = 'http://www.w3.org/2000/svg';
    const mk = (cls) => { const p = document.createElementNS(NS, 'path'); p.setAttribute('class', cls); return p; };
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'tour-dim'); svg.setAttribute('aria-hidden', 'true');
    const shade = mk('tour-shade');
    shade.setAttribute('fill-rule', 'evenodd');
    svg.append(shade);
    // the rings, masked out of the open layers
    const rsvg = document.createElementNS(NS, 'svg');
    rsvg.setAttribute('class', 'tour-dim tour-rings'); rsvg.setAttribute('aria-hidden', 'true');
    const id = 'tourRingMask' + (++maskN);
    const defs = document.createElementNS(NS, 'defs'), maskEl = document.createElementNS(NS, 'mask'), maskRect = document.createElementNS(NS, 'rect'), maskHoles = document.createElementNS(NS, 'path');
    maskEl.setAttribute('id', id); maskEl.setAttribute('maskUnits', 'userSpaceOnUse'); maskEl.setAttribute('maskContentUnits', 'userSpaceOnUse');
    maskRect.setAttribute('fill', '#fff'); maskRect.setAttribute('x', '0'); maskRect.setAttribute('y', '0');
    maskHoles.setAttribute('fill', '#000');
    maskEl.append(maskRect, maskHoles); defs.append(maskEl);
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('mask', `url(#${id})`);
    const glow = mk('tour-glow'), ring = mk('tour-ring'), markP = mk('tour-mark');
    g.append(glow, ring, markP);
    rsvg.append(defs, g);
    const live = el('div', { class: 'tour-sr', 'aria-live': 'polite', 'aria-atomic': 'true' });
    const root = el('div', { class: 'tour-root', 'data-tour': 'root' }, svg);
    const top = el('div', { class: 'tour-top', 'data-tour': 'top' }, rsvg, live);
    const bar = el('i');
    const chap = el('span', { class: 'tour-chap' });
    const dock = el('span', { class: 'tour-dock', 'aria-hidden': 'true' });
    const x = el('button', { class: 'icon-btn tour-x', type: 'button', 'aria-label': $t('End the tour'), title: $t('End the tour') + '  Esc' });
    x.innerHTML = ICON_X;
    // (v15.1, a phone: the collapsed bar's title, a tap shows the whole step; the whole step over the work area folds back)
    // (review-phone phone-5: on a Try it step the bar also shows the task, ticked when it is done)
    const growT = el('span', { class: 'tour-gt' });
    const growKT = el('span');
    const growK = el('span', { class: 'tour-gk', hidden: true }, el('span', { class: 'tour-tick', 'aria-hidden': 'true' }), growKT);
    growK.firstChild.innerHTML = ICON_CHECK;
    const grow = el('button', { class: 'tour-grow', type: 'button', 'aria-expanded': 'false', 'aria-label': $t('Show the whole step') });
    grow.innerHTML = ICON_UP;
    grow.append(el('span', { class: 'tour-gs' }, growT, growK));
    // (review-phone phone-8b: Back in the bar, as an icon)
    const mback = el('button', { class: 'icon-btn tour-mback', type: 'button', 'aria-label': $t('Back'), title: $t('Back') });
    mback.innerHTML = ICON_LEFT;
    const fold = el('button', { class: 'icon-btn tour-fold', type: 'button', 'aria-label': $t('Collapse the step'), title: $t('Collapse the step') });
    fold.innerHTML = ICON_DOWN;
    const title = el('h2', { class: 'tour-title', id: 'tourTitle' });
    const body = el('p', { class: 'tour-body', id: 'tourBody' });
    const tryBox = el('div', { class: 'tour-try', hidden: true });
    const count = el('span', { class: 'tour-count' });
    const back = el('button', { class: 'btn ghost', type: 'button' }, $t('Back'));
    const done = el('button', { class: 'btn ghost', type: 'button', hidden: true }, $t('Done'));
    const next = el('button', { class: 'btn primary', type: 'button' }, $t('Next'));
    const caret = el('span', { class: 'tour-caret', 'aria-hidden': 'true' });
    const foot = el('div', { class: 'tour-foot' }, count, mback, back, done, next);
    const card = el('div', { class: 'tour-card entering', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'tourTitle', 'aria-describedby': 'tourBody', tabindex: '-1', 'data-tour': 'card' },
      el('div', { class: 'tour-bar', 'aria-hidden': 'true' }, bar), caret,
      el('div', { class: 'tour-in' }, el('div', { class: 'tour-head' }, grow, chap, dock, fold, x), el('div', { class: 'tour-scroll' }, title, body, tryBox), foot));
    top.append(card);
    // the safe-area insets, read from a probe (env() has no script API)
    const safeP = el('div', { 'aria-hidden': 'true', style: 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)' });
    top.append(safeP);
    document.body.append(root, top);
    return { root, top, svg, rsvg, shade, glow, ring, mark: markP, maskEl, maskRect, maskHoles, live, card, bar, chap, dock, x, grow, growT, growK, growKT, mback, fold, title, body, tryBox, count, back, done, next, foot, caret, safeP, holes: null, raf: 0, anim: null, motion: 0, topSet: [],
      hosts: new Map(), hostOk: new Map(), work: [], expanded: false, lastP: null, moveT: 0 };
  }
  function safeArea(ui) {
    try { const cs = getComputedStyle(ui.safeP); return { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 }; } catch (e) { return { t: 0, r: 0, b: 0, l: 0 }; }
  }

  // ---------------------------------------------------------------- the app's layers
  // What the user can open over the app: its popovers (#popHost: the palette, menus, the integral popover, the
  // coordinate pad, the options sheet), a dialog (.modal-bg's box), the sound settings, anything in the top layer
  // (the header's More menu is a popover). api.layers() may list them instead (elements). The callout never covers
  // them, and the rings are masked out of them.
  const LAYER_SEL = '#popHost > *, .modal-bg > *, .snd-pop:not([hidden]), dialog[open]';
  function layerEls() {
    let els = null;
    try { if (fn('layers')) els = api.layers(); } catch (e) { els = null; }
    if (!els || typeof els.length !== 'number') {
      els = [...document.querySelectorAll(LAYER_SEL)];
      try { els.push(...document.querySelectorAll(':popover-open')); } catch (e) { /* no popover API */ }
    }
    // (v15: a layer that holds the step's own anchor, a phone's sheet or a drawer the step opened, is part of the step:
    // it is lit, not kept clear, and its rings are not masked off)
    const lit = run && run.el && run.el.isConnected ? run.el : null;
    return [...els].filter((e) => e && e.closest && !e.closest('[data-tour="root"], [data-tour="top"]') && visible(e) && !(lit && e.contains(lit)));
  }
  // the controls of the open layers (a docked callout over a full-screen dialog keeps off them)
  function layerControls() {
    const out = [];
    for (const k of layerEls()) {
      for (const c of k.querySelectorAll('button, input, select, textarea, a[href], summary, [role="button"], [role="option"], [role="menuitem"], [tabindex]:not([tabindex="-1"])')) {
        const b = c.getBoundingClientRect();
        if (b.width > 1 && b.height > 1) out.push({ l: b.left, t: b.top, r: b.right, b: b.bottom });
        if (out.length > 300) return out;
      }
    }
    return out;
  }
  function appLayers() {
    return layerEls().map((e) => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, rad: radii(e) }; });
  }
  // The callout's layer joins the top layer (as a manual popover) while the app has something there, shown after it
  // so it stays above; it leaves when the app's top layer is empty. (Only then: the app's layerOpen() counts open
  // popovers, and a tour always in the top layer would read as a layer that never closes.)
  function topLayerApp() {
    try { return [...document.querySelectorAll(':popover-open, dialog:modal')].filter((e) => !e.closest('[data-tour]')); } catch (e) { return []; }
  }
  function syncTop(ui) {
    const top = ui && ui.top;
    if (!top || !top.isConnected || typeof top.showPopover !== 'function') return;
    const now = topLayerApp();
    let isOpen = false;
    try { isOpen = top.matches(':popover-open'); } catch (e) { isOpen = false; }
    const added = now.some((e) => !ui.topSet.includes(e));
    ui.topSet = now;
    if (now.length ? isOpen && !added : !isOpen) return;
    const a = document.activeElement;
    try {
      if (now.length) {
        if (!top.hasAttribute('popover')) top.setAttribute('popover', 'manual');
        if (isOpen) top.hidePopover();
        top.showPopover();
      } else {
        top.hidePopover();
        top.removeAttribute('popover');
      }
    } catch (e) { warn('top layer', e); }
    if (a && a !== document.activeElement && top.contains(a)) { try { a.focus({ preventScroll: true }); } catch (e) { /* */ } }
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
    const r = { ci, si: 0, lend, snap: lend ? lend.snap : null, scenes: !!lend, scene: undefined, sceneOk: {}, seq: 0, opener, offs: [], tryOffs: [], skipped: new Set(), why: new Map(), absent: new Set(), ui: null, el: null, step: null, dir: 1, timer: 0, tracked: null };
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
    ui.mback.addEventListener('click', () => { if (run === r) go(-1); });
    ui.done.addEventListener('click', () => stop({ finished: true }));
    ui.x.addEventListener('click', () => stop({}));
    // (v15.1, a phone: the bar shows the whole step; the whole step, over the work area, folds back into the bar)
    ui.grow.addEventListener('click', () => { if (run !== r) return; ui.expanded = true; ui.lastP = null; layout(false); try { ui.next.focus({ preventScroll: true }); } catch (e) { /* */ } });
    ui.fold.addEventListener('click', () => { if (run !== r) return; ui.expanded = false; ui.lastP = null; layout(false); try { ui.grow.focus({ preventScroll: true }); } catch (e) { /* */ } });
    ui.shade.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); nudge(); });
    const onKey = (e) => {
      if (run !== r || e === fwdKey) return;
      const inCard = ui.card.contains(document.activeElement);
      const idle = document.activeElement === document.body || document.activeElement == null || inCard;
      if (inCard) { ui.keyEl = document.activeElement; ui.keyAt = performance.now(); }
      if (e.key === 'Escape') {
        // The app's own layer comes first, wherever the focus is: a menu, the palette or a dialog closes and the tour
        // stays. Then Escape in the callout ends the tour. Elsewhere the app's own Escape comes first: a field being
        // typed in, and whatever the app reports busy (a drawing, a drag, a selection, an open drawer). Only when the
        // app has nothing to cancel does Escape end the tour
        if (appLayerOpen()) { if (inCard) escToLayer(e); return; }
        if (!inCard) {
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
    // a click elsewhere: the user has moved on, the focus is theirs (no return to the callout when the layers close)
    // (v15.1, a phone: a touch in the step's work area folds the whole step back into its bar, and the touch goes on to
    // the app: the callout never stays over what the user is working on)
    const onDown = (e) => {
      if (run !== r || ui.card.contains(e.target)) return;
      ui.refocus = null; ui.keyEl = null;
      if (ui.expanded && phoneL() && inRects(e.clientX, e.clientY, ui.work)) { ui.expanded = false; ui.lastP = null; layout(false); }
    };
    document.addEventListener('pointerdown', onDown, true);
    r.offs.push(() => document.removeEventListener('pointerdown', onDown, true));
    // (review-phone phone-3: a finger on the screen; a lit part its panel's fling left out of sight comes back once the
    // finger is off and the panel still)
    const onTouch = (e) => {
      if (run !== r) return;
      ui.touching = e.touches ? e.touches.length : 0;
      if (ui.touching) clearTimeout(ui.backT);
      if (!ui.touching && ui.backH) { const H = ui.backH; clearTimeout(ui.backT); ui.backT = setTimeout(() => { if (run === r) bringBack(r, H); }, BACK_MS); }
    };
    for (const t of ['touchstart', 'touchend', 'touchcancel']) { document.addEventListener(t, onTouch, { capture: true, passive: true }); r.offs.push(() => document.removeEventListener(t, onTouch, { capture: true, passive: true })); }
    r.offs.push(() => { const h = document.querySelector(TOAST_SEL); if (h && ui.toastDy) { h.style.transform = ''; ui.toastDy = 0; } });
    const onHide = () => { if (run === r && r.lend && r.lend.stashed) unbeat(); };
    const onShow = (e) => { if (e.persisted && run === r && r.lend && r.lend.stashed) beat(); };
    addEventListener('pagehide', onHide);
    addEventListener('pageshow', onShow);
    r.offs.push(() => removeEventListener('pagehide', onHide), () => removeEventListener('pageshow', onShow));
    // The spotlight keeps up in the same frame: a scroll (of the page or any panel) and a resize are handled as they
    // fire, before the frame is painted; a ResizeObserver catches the lit elements, the callout and the open layers
    // changing size; a MutationObserver catches layout changes that fire no event (a panel opening, the chain
    // growing, a menu or a dialog opening); and while anything moves (a transition, an animation, the shade's own
    // morph) the layout runs every frame until it has been still for a while
    // (v15.1: a panel the spotlight is drawn inside scrolls with it natively: its frames need no script, and the
    // callout is checked once the scroll has calmed. Anything else a phone's rings follow by script during a scroll
    // fades them until it is still)
    const onMove = (e) => {
      if (run !== r) return;
      if (e && e.type === 'scroll' && ui.hosts.has(e.target)) {
        clearTimeout(ui.hostT); clearTimeout(ui.backT);
        const H = e.target;
        // (the callout is checked 140 ms after the scroll calms; the anchor is brought back only BACK_MS later, so the
        // user can look round the panel, and nothing moves by itself right after a fling: review-phone-verify
        // new-bringback)
        ui.hostT = setTimeout(() => { if (run === r) { layout(false); kick(4); ui.backT = setTimeout(() => { if (run === r) bringBack(r, H); }, BACK_MS - 140); } }, 140);
        return;
      }
      const was = ui.drawSig;
      layout(false); kick(12);
      if (e && e.type === 'scroll' && ui.drawSig !== was && phoneL()) moving(ui);
    };
    addEventListener('resize', onMove);
    addEventListener('scroll', onMove, true);
    r.offs.push(() => document.removeEventListener('keydown', onKey, true), () => removeEventListener('resize', onMove), () => removeEventListener('scroll', onMove, true));
    r.offs.push(() => { clearTimeout(ui.hostT); clearTimeout(ui.backT); clearTimeout(ui.moveT); });
    if (typeof visualViewport !== 'undefined' && visualViewport) {
      for (const t of ['resize', 'scroll']) { visualViewport.addEventListener(t, onMove); r.offs.push(() => visualViewport.removeEventListener(t, onMove)); }
    }
    const ours = (n) => { const e = n && (n.nodeType === 1 ? n : n.parentElement); return !e || !!e.closest('[data-tour="root"], [data-tour="top"], #tip'); };
    if (typeof ResizeObserver === 'function') {
      ui.ro = new ResizeObserver(() => { if (run === r) { layout(false); kick(12); } });
      ui.roSet = new Set();
      r.offs.push(() => ui.ro.disconnect());
    }
    if (typeof MutationObserver === 'function') {
      const mo = new MutationObserver((recs) => { if (run === r && recs.some((m) => !ours(m.target))) { syncTop(ui); kick(12); } });
      mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'open'] });
      r.offs.push(() => mo.disconnect());
    }
    const onAnim = (e) => {
      if (run !== r || ours(e.target)) return;
      kick(45);
      // (v15.1, a phone: a lit part's panel slides or rides, on the compositor: the rings drawn over the page fade
      // while it moves rather than trail it)
      if (phoneL() && r.step && r.tgt && e.target instanceof Element && (e.type === 'animationstart' || /^(transform|translate|top|bottom|left|right|inset|margin)/.test(e.propertyName || ''))) {
        let d = 0;
        try { const cs = getComputedStyle(e.target); d = Math.max(...String(e.type === 'animationstart' ? cs.animationDuration : cs.transitionDuration).split(',').map((v) => ms(v.trim(), 0))); } catch (x) { d = 0; }
        if (d > 0 && litParts(r.step, r.tgt).some((q) => e.target.contains(q.el))) moving(ui, Math.min(1200, d + 80));
      }
    };
    for (const t of ['transitionrun', 'animationstart']) { document.addEventListener(t, onAnim, true); r.offs.push(() => document.removeEventListener(t, onAnim, true)); }
    // a popover or a modal dialog of the app opening (the top layer): the callout goes above it at once
    const onToggle = (e) => {
      if (run !== r || ours(e.target)) return;
      const go = () => { if (run === r) { syncTop(ui); layout(false); kick(20); } };
      queueMicrotask(go); requestAnimationFrame(go);
    };
    for (const t of ['beforetoggle', 'toggle']) { document.addEventListener(t, onToggle, true); r.offs.push(() => document.removeEventListener(t, onToggle, true)); }
    r.offs.push(() => { try { if (ui.top.matches(':popover-open')) ui.top.hidePopover(); } catch (e) { /* */ } });
    // a safety net for anything the observers miss, four times a second; the stash's heartbeat every two seconds
    let n = 0;
    r.timer = setInterval(() => { syncTop(ui); track(); if (r.lend && r.lend.stashed && ++n % Math.round(BEAT_MS / 250) === 0) beat(); }, 250);
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
  // (every layer the tour itself keeps clear counts, also one the app's layerOpen() does not report: the sound settings)
  function appLayerOpen() {
    if (layerEls().length) return true;
    try { if (fn('layerOpen')) return !!api.layerOpen(); } catch (e) { /* fall through */ }
    try { return !!document.querySelector('#popHost > .pop, .modal-bg, .pal, .palette, [popover]:popover-open:not([data-tour])'); } catch (e) { return !!document.querySelector('#popHost > .pop, .modal-bg, .pal, .palette'); }
  }
  // Escape in the callout while a layer is open that the app's own Escape does not close (its layerOpen() does not
  // report it: the sound settings close on an Escape inside them): the key goes to that layer, the topmost one
  function escToLayer(e) {
    let own = true;
    try { own = fn('layerOpen') ? !!api.layerOpen() : true; } catch (x) { own = true; }
    if (own) return;
    const k = layerEls().filter((x) => !x.contains(document.activeElement)).pop();
    if (!k) return;
    e.preventDefault(); e.stopPropagation();
    try { fwdKey = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }); k.dispatchEvent(fwdKey); } catch (x) { /* */ } finally { fwdKey = null; }
  }
  let fwdKey = null;   // the Escape forwarded to a layer (the tour's own key handler lets it pass)
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
  const CHANGES = new Set(['scene', 'view', 'surface', 'deform', 'focus', 'panel', 'tool', 'look', 'select', 'plane']);
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
  const ACTIONS = { view: 'setView', surface: 'setSurface', deform: 'setDeformation', focus: 'focusStep', panel: 'showPanel', tool: 'setTool', look: 'setLook', select: 'selectStep', plane: 'showPlane' };
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
    // a step that does not ask for the panel: a phone's sheet that an earlier step opened closes (optional)
    if (r.scenes && !(step.before || []).some((a) => a[0] === 'panel')) call('closeSheet');
    for (const a of step.before || []) {
      if (a[0] === 'scene') continue;
      act(r, a);
      await null;
      if (stale()) return;
    }
    await frames(2);
    await sleep(step.wait || (step.before && step.before.length ? 60 : 0));
    if (stale()) return;
    // the fonts the copy and the lit controls are set in (a Cyrillic face loads on first use)
    if (typeof document.fonts === 'object' && document.fonts && document.fonts.status !== 'loaded') { await Promise.race([document.fonts.ready, sleep(1000)]); if (stale()) return; }
    let tgt = step.anchor == null ? null : anchorOf(step.anchor);
    let target = tgt ? tgt.el : null;
    // Missing in this build or this layout, or clipped away: skip it, in the direction of travel. The skip is reported
    // (Tour.skipped(), and a warning once per step and run), never silent
    const skip = async (why) => {
      const key = skipKey(ci, si);
      r.skipped.add(key);
      if (!r.why.has(key)) { r.why.set(key, why); warn('step skipped', `${key} (${why})`); }
      const d = dir || 1;
      const pos = seek(ci, si + d, d, isAbsent);
      if (!pos) { if (d > 0) stop({ finished: true }); else await show(ci, si, 1); return; }
      if (pos.ci !== ci && d > 0) { rec.done[ch.id] = ch.rev; save(); }
      await show(pos.ci, pos.si, d);
    };
    if (!ok) { await skip('scene'); return; }
    if (step.anchor != null && !target) { await skip('missing'); return; }
    r.step = step; r.el = target; r.tgt = tgt;
    // the copy of a control that lives in the ⋯ menu here says "in this menu"
    r.inMenu = !!target && [].concat(step.anchor).length > 1 && target === anchorEl('moreBtn') && anchorEl([].concat(step.anchor)[0]) !== target;
    // bring the lit area into view: between the top bar and what is fixed at the bottom (a phone's tool bar, and the
    // sheet the callout becomes), measured again once the scroll has ended
    if (target) {
      await reveal(target, step); if (stale()) return;
      // measured once it has settled: the lit area unchanged over two frames (a view switch, a panel sliding open)
      await steady(r, step, 700); if (stale()) return;
      // clipped away by a panel that cannot scroll (the panes squeezed to a strip on a phone in landscape): another of
      // the step's anchors, else the step is skipped (an empty line lit where the control would be helps no one)
      if (tgtHidden(r.tgt)) {
        tgt = anchorOf(step.anchor, (t) => !tgtHidden(t));
        if (!tgt) { r.step = null; await skip('clipped'); return; }
        target = tgt.el; r.el = target; r.tgt = tgt;
        await reveal(target, step); if (stale()) return;
        await steady(r, step, 700); if (stale()) return;
      }
    }
    r.ui.card.removeAttribute('aria-busy');
    // (v15.1: each step starts with its callout as placed, not as the user last unfolded it, and checks its panels anew)
    r.ui.expanded = false; r.ui.lastP = null; r.ui.hostOk = new Map();
    fill(r, ch, step);
    watchStep(r);
    layout(true);
    kick(30);
    announce(r, ch, step);
    armTry(r, step);
    try { r.ui.next.focus({ preventScroll: true }); } catch (e) { /* */ }
  }

  // the band of the viewport that nothing fixed covers: below the top bar, above a bottom bar and (on a phone) the sheet
  function fixedEdge(y, fromTop) {
    let best = null;
    const vp = vpSize(), xs = [vp.w * 0.25, vp.w * 0.5, vp.w * 0.75];
    for (const x of xs) {
      for (const e of document.elementsFromPoint(x, y)) {
        if (e.closest('[data-tour]')) continue;
        let a = e;
        for (; a && a !== document.body && a !== document.documentElement; a = a.parentElement) { const p = getComputedStyle(a).position; if (p === 'fixed' || p === 'sticky') break; }
        if (!a || a === document.body || a === document.documentElement) break;
        const q = a.getBoundingClientRect();
        if (q.width < vp.w * 0.4) break;
        best = fromTop ? Math.max(best == null ? 0 : best, q.bottom) : Math.min(best == null ? vp.h : best, q.top);
        break;
      }
    }
    return best;
  }
  function freeBand() {
    const H = vpSize().h, top = fixedEdge(2, true) || 0, bar = fixedEdge(H - 3, false);
    let bot = bar == null ? H : bar;
    if (narrow()) bot = Math.min(bot, H * 0.58);
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
  // Scrolls every scrolling ancestor of e (not the page) so e's box is inside it, 8 px clear, when it fits; when it
  // does not, so its start shows. Instant: the spotlight follows in the same frame. Returns whether anything moved.
  function panelsReveal(e) {
    let moved = false;
    for (let a = e.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
      const cs = getComputedStyle(a);
      const sy = /(auto|scroll|overlay)/.test(cs.overflowY) && a.scrollHeight > a.clientHeight + 1;
      const sx = /(auto|scroll|overlay)/.test(cs.overflowX) && a.scrollWidth > a.clientWidth + 1;
      if (!sy && !sx) continue;
      const q = a.getBoundingClientRect(), b = e.getBoundingClientRect(), m = 8;
      const top = q.top + a.clientTop, left = q.left + a.clientLeft, bot = top + a.clientHeight, right = left + a.clientWidth;
      // (a part that fits only without the 8 px margins is placed whole, with equal margins)
      const need = (lo, hi, a0, a1) => {
        if (hi - lo <= a1 - a0 - 2 * m) return lo < a0 + m ? lo - a0 - m : hi > a1 - m ? hi - a1 + m : 0;
        if (hi - lo <= a1 - a0) { const mm = (a1 - a0 - (hi - lo)) / 2; return lo < a0 + mm - 0.5 || hi > a1 - mm + 0.5 ? lo - a0 - mm : 0; }
        return lo < a0 || lo > a0 + m ? lo - a0 - m : 0;
      };
      const dy = sy ? need(b.top, b.bottom, top, bot) : 0, dx = sx ? need(b.left, b.right, left, right) : 0;
      if (Math.abs(dy) < 1 && Math.abs(dx) < 1) continue;
      const y0 = a.scrollTop, x0 = a.scrollLeft;
      try { a.scrollTo({ top: y0 + dy, left: x0 + dx, behavior: 'instant' }); } catch (x) { a.scrollTop = y0 + dy; a.scrollLeft = x0 + dx; }
      if (a.scrollTop !== y0 || a.scrollLeft !== x0) moved = true;
    }
    return moved;
  }
  // waits (at most maxMs) until the step's lit areas are the same in two frames running
  async function steady(r, step, maxMs) {
    const t0 = performance.now();
    let last = '';
    while (performance.now() - t0 < maxMs) {
      if (run !== r || r.step !== step) return;
      const sig = JSON.stringify(holesFor(step, r.tgt).holes.map((h) => [h.l, h.t, h.r, h.b].map((v) => Math.round(v * 2))));
      if (sig === last) return;
      last = sig;
      await frames(1);
    }
  }
  const inFixed = (e) => { for (let a = e; a && a !== document.body && a !== document.documentElement; a = a.parentElement) { const p = getComputedStyle(a).position; if (p === 'fixed' || p === 'sticky') return true; } return false; };
  async function reveal(target, step) {
    // the panels that cut a lit part scroll first (v15: the F tile in a scrolled chain strip, a section low in a
    // phone's sheet); the anchor's panels last, so it wins where both are in one panel
    const alsoAll = [].concat(step.also || []).map((a) => anchorEl(a)).filter((e) => e && e !== target);
    let pm = false;
    for (const e of alsoAll) if (panelsReveal(e)) pm = true;
    if (panelsReveal(target)) pm = true;
    if (pm) await frames(1);
    // a control in the top bar or a fixed tool bar (or a phone's sheet) is always in view; scrolling the page would
    // only move the page under it
    if (inFixed(target)) return;
    const also = alsoAll.filter((e) => !inFixed(e));
    for (let pass = 0; pass < 2; pass++) {
      // cut by a scrolling panel (a section low in a side panel, the add card at the end of a long chain): that panel
      // scrolls first, so the whole target shows when it fits
      if (panelsReveal(target)) await frames(1);
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
      } else if (also.length && narrow() && b.bottom - b.top <= room) {
        // two lit areas that cannot both fit (X and Y on a phone): the anchor whole, at the band's edge toward the
        // other, so as much of the other shows as can
        delta = box.top < b.top - 1 ? b.bottom - band.bot + 8 : b.top - band.top - 8;
      } else if (also.length && narrow()) {
        delta = b.top - band.top - 8;
      } else if (b.bottom - b.top <= room) {
        if (b.top < band.top + 2) delta = b.top - band.top - 8;
        else if (b.bottom > band.bot - 2) delta = b.bottom - band.bot + 8;
      } else if (b.top < band.top - 2 || b.top > band.top + 0.4 * room) delta = b.top - band.top - 8;
      if (Math.abs(delta) < 2) return;
      const maxY = Math.max(0, document.documentElement.scrollHeight - vpSize().h);
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
    ui.title.textContent = stepTitle(step);
    ui.body.textContent = '';
    ui.body.append(richText(copyFor(step, r.scene, { menu: r.inMenu })));
    r.countText = $t('{k} of {total}', { k, total });
    r.countShort = `${k}/${total}`;
    ui.bar.style.width = `${(100 * k / Math.max(1, total)).toFixed(1)}%`;
    ui.tryBox.textContent = '';
    ui.tryBox.classList.remove('done');
    ui.growK.classList.remove('done');
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
    ui.next.removeAttribute('aria-label');
    if (nextCh) { ui.next.dataset.full = ui.next.textContent; ui.next.dataset.short = $t('Next'); } else { delete ui.next.dataset.full; delete ui.next.dataset.short; }
    ui.dock.textContent = stepTitle(step);
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
    r.ui.live.textContent = $t('{chapter}, step {k}. {title}. ', { chapter: $t(ch.title), k, title: stepTitle(step) }) + plainCopy(copyFor(step, r.scene, { menu: r.inMenu }), modKey()) + (tr ? $t(' Try it: ') + plainCopy(tryFor(tr), modKey()) : '');
  }

  // The lit areas of a step: its anchor's parts and its `also` areas, each exactly its visible box (step.pad grows them
  // when a step asks), with its corner radii; an anchor inside a lit panel is the mark.
  // the lit parts: the anchor's, then its `also` areas and (v15.1) the areas its Try it names (try.work), each once
  function litParts(step, tgt) {
    const parts = tgt.parts.slice();
    // (try.work names parts of the touch task: review-phone phone-2, the lens in the sheet the first tap opens)
    const tr = tryOf(step), work = tr && tr.work && tr.touch && coarse() ? tr.work : [];
    for (const a of [].concat(step.also || [], work)) {
      const t = anchorOf(a);
      if (t) for (const q of t.parts) if (!parts.some((x) => x.el === q.el && !x.rect && !q.rect) && !covered(q.el)) parts.push(q);
    }
    return parts;
  }
  function holesFor(step, tgt) {
    if (!tgt) return { holes: [], mark: null, insets: [] };
    const pad = step.pad != null ? step.pad : 0;
    // (a part clipped away has no hole: never an empty line where the anchor would be)
    const rects = litParts(step, tgt).map((q) => partRect(q, pad)).filter((q, i) => !q.hidden && (i === 0 || (q.r - q.l > 0.5 && q.b - q.t > 0.5)));
    return areasOf(rects, true);
  }
  // the lit areas of rects (the anchor's first when anchorFirst): merged, with their radii, the mark and the insets
  function areasOf(rects, anchorFirst) {
    if (!rects.length) return { holes: [], mark: null, insets: [] };
    const { holes, mark } = litAreas(rects);
    // each hole takes the radii of the part whose box it is (the panel an anchor sits in), else of the part it overlaps most
    const match = (h) => {
      let best = null, bo = -1;
      for (const q of rects) {
        if (Math.max(Math.abs(q.l - h.l), Math.abs(q.t - h.t), Math.abs(q.r - h.r), Math.abs(q.b - h.b)) < 0.5) return q.rad;
        const o = Math.max(0, Math.min(q.r, h.r) - Math.max(q.l, h.l)) * Math.max(0, Math.min(q.b, h.b) - Math.max(q.t, h.t));
        if (o > bo) { bo = o; best = q; }
      }
      return best ? best.rad : [0, 0, 0, 0];
    };
    // (v15: a lit part inside a larger lit area, other than the anchor, X's inset on a phone inside the lit Y, the chain
    // under a merged Inspector: a ring of its own, like the mark)
    const area = (q) => Math.max(0, q.r - q.l) * Math.max(0, q.b - q.t);
    const insets = rects.slice(1).filter((q) => area(q) > 1 && holes.some((h) => q.l >= h.l - 0.5 && q.t >= h.t - 0.5 && q.r <= h.r + 0.5 && q.b <= h.b + 0.5 && area(h) > 1.3 * area(q)))
      .map((q) => ({ l: q.l, t: q.t, r: q.r, b: q.b, rad: q.rad }));
    return { holes: holes.map((h) => Object.assign(h, { rad: match(h) })), mark: anchorFirst && mark ? Object.assign(mark, { rad: rects[0].rad }) : null, insets };
  }

  // ---------------------------------------------------------------- v15.1: the spotlight inside a scrolling panel
  // On a phone (notes/tour/PHONE.md) a panel that scrolls (a sheet, the chain bar) scrolls on the compositor: its
  // content moves in a frame the page's script has not seen yet, so a spotlight drawn in fixed position over the page
  // trails it by a frame or more during a touch scroll and its fling (the jiggle). There a lit part inside such a panel
  // is drawn inside the panel: an SVG at the panel's content origin, above its content, so its shade and ring scroll
  // with the content in the same frame, with no script. The fixed shade leaves a window over the panel's visible box,
  // which does not move while the panel scrolls.
  const phoneL = () => { try { return narrow() || document.documentElement.classList.contains('ph'); } catch (e) { return false; } };
  // the panel that scrolls e (null: none, or e does not move with it: fixed or sticky on the way)
  function scrollerOf(e) {
    if (/^(fixed|sticky)$/.test(getComputedStyle(e).position)) return null;
    for (let a = e.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if ((/(auto|scroll|overlay)/.test(cs.overflowY) && a.scrollHeight > a.clientHeight + 1) || (/(auto|scroll|overlay)/.test(cs.overflowX) && a.scrollWidth > a.clientWidth + 1)) return a;
      if (/^(fixed|sticky)$/.test(cs.position)) return null;
    }
    return null;
  }
  // a static panel becomes the drawing's containing block (position: relative) only when no absolutely positioned
  // element inside it is placed from a box outside it (it would move); once per panel and step
  function canHost(ui, H) {
    if (ui.hostOk.has(H)) return ui.hostOk.get(H);
    const hs = getComputedStyle(H);
    // (a panel that fades its own content with an opacity would fade the shade drawn in it too, and its background
    // would show undimmed through the window: drawn over the page instead. A mask, the chain bar's scroll fades, is
    // taken off while the panel hosts (review-phone phone-3): its edges are the shade's then)
    let ok = !(parseFloat(hs.opacity) < 1);
    if (ok && hs.position === 'static') {
      for (const d of H.querySelectorAll('*')) {
        const op = d.offsetParent;
        if (!op || H.contains(op)) continue;
        const cs = getComputedStyle(d);
        // (an empty box that clips, the chain's listbox for screen readers, shows nothing wherever it moves)
        if (cs.position === 'absolute' && !(d.offsetWidth === 0 && d.offsetHeight === 0 && /(hidden|clip)/.test(cs.overflowX + cs.overflowY))) { ok = false; break; }
      }
    }
    ui.hostOk.set(H, ok);
    return ok;
  }
  function hostSvg(ui, H) {
    let h = ui.hosts.get(H);
    if (h && h.svg.parentNode === H) return h;
    if (h) dropHost(ui, H);
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'tour-dim tour-host'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('data-tour', 'host');
    svg.setAttribute('width', '1'); svg.setAttribute('height', '1');
    const mk = (cls) => { const p = document.createElementNS(NS, 'path'); p.setAttribute('class', cls); svg.append(p); return p; };
    const shade = mk('tour-shade');
    shade.setAttribute('fill-rule', 'evenodd');
    const glow = mk('tour-glow'), ring = mk('tour-ring'), mark = mk('tour-mark');
    // a touch on the dimmed part of the panel still scrolls it (nothing is prevented) but reaches none of its controls
    const stopIt = (e) => { e.stopPropagation(); if (e.type === 'click' || e.type === 'contextmenu') e.preventDefault(); };
    for (const t of ['pointerdown', 'pointerup', 'mousedown', 'click', 'dblclick', 'contextmenu']) shade.addEventListener(t, stopIt);
    shade.addEventListener('touchstart', stopIt, { passive: true });
    // (review-phone phone-6: the panel's own style is recorded on the panel by the first drawing in it, and put back by
    // the last one out, so a run that starts while the last one's drawing fades out keeps the panel set up)
    if (!H.querySelector(':scope > svg.tour-host') && !('tourHost' in H.dataset)) {
      H.dataset.tourHost = JSON.stringify([H.style.position, H.style.maskImage, H.style.webkitMaskImage, H.style.overscrollBehavior]);
      if (getComputedStyle(H).position === 'static') H.style.position = 'relative';
      // (no rubber band at the panel's ends while it hosts: the bounce moves the content past its own edge, where the
      // drawing's layer ends, and showed an undimmed strip at the panel's edge for a moment)
      H.style.overscrollBehavior = 'none';
      const hs = getComputedStyle(H), faded = (v) => v && v !== 'none';
      if (faded(hs.maskImage) || faded(hs.webkitMaskImage)) { H.style.maskImage = 'none'; H.style.webkitMaskImage = 'none'; }
    }
    H.append(svg);
    h = { H, svg, shade, glow, ring, mark, sig: '' };
    ui.hosts.set(H, h);
    return h;
  }
  function dropHost(ui, H) {
    const h = ui.hosts.get(H);
    if (!h) return;
    h.svg.remove();
    ui.hosts.delete(H);
    if (H.querySelector(':scope > svg.tour-host') || !('tourHost' in H.dataset)) return;
    try { const [pos, m, wm, ob] = JSON.parse(H.dataset.tourHost); H.style.position = pos; H.style.maskImage = m; H.style.webkitMaskImage = wm; H.style.overscrollBehavior = ob || ''; } catch (e) { /* */ }
    delete H.dataset.tourHost;
  }
  // a hosted part's lit rect in its panel's content px (origin ox, oy in client px): its box cut only by what clips it
  // inside the panel (the panel's own clip cuts the drawing natively)
  function hostRect(q, H, pad, ox, oy) {
    const full = partBox(q);
    let l = full.left, t = full.top, rr = full.right, b = full.bottom;
    for (let a = q.el.parentElement; a && a !== H; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if ((cs.overflowX === 'visible' && cs.overflowY === 'visible') || cs.display === 'contents') continue;
      const z = a.getBoundingClientRect();
      if (z.width === 0 && z.height === 0) continue;
      l = Math.max(l, z.left); t = Math.max(t, z.top); rr = Math.min(rr, z.right); b = Math.min(b, z.bottom);
    }
    if (rr - l < 0.5 || b - t < 0.5) return null;
    const cut = [t > full.top + 0.5, rr < full.right - 0.5, b < full.bottom - 0.5, l > full.left + 0.5];
    const k = q.rect ? [0, 0, 0, 0] : radii(q.el);
    const rad = [cut[0] || cut[3] ? 0 : k[0], cut[0] || cut[1] ? 0 : k[1], cut[2] || cut[1] ? 0 : k[2], cut[2] || cut[3] ? 0 : k[3]].map((x) => (x > 0 ? x + pad : 0));
    return { l: l - pad - ox, t: t - pad - oy, r: rr + pad - ox, b: b + pad - oy, rad };
  }
  // A phone's drawing plan: null when no lit part is inside a panel that scrolls. Else { outer: { holes, marks } (the
  // parts drawn over the page), wins (each panel's visible box: a window in the fixed shade, with no ring), inner: [{ h,
  // holes, marks, ext, sig }] (in each panel's content px) }. A panel whose window would overlap a part drawn over the
  // page is not used (the even-odd shade would dim their overlap twice).
  function hostPlan(r, step, tgt) {
    const ui = r.ui;
    if (!tgt || !phoneL()) return null;
    const parts = litParts(step, tgt);
    const hs = parts.map((q) => { const H = scrollerOf(q.el); return H && canHost(ui, H) ? H : null; });
    if (!hs.some(Boolean)) return null;
    const pad = step.pad != null ? step.pad : 0, vp = vpSize();
    const outerOf = (q, i) => { const pr = partRect(q, pad); return pr.hidden || (i > 0 && !(pr.r - pr.l > 0.5 && pr.b - pr.t > 0.5)) ? null : pr; };
    const winOf = (H) => {
      const b = H.getBoundingClientRect(), l = b.left + H.clientLeft, t = b.top + H.clientTop;
      const s = seenBox(H, { left: l, top: t, right: l + H.clientWidth, bottom: t + H.clientHeight });
      const w = { l: Math.max(0, s.l), t: Math.max(0, s.t), r: Math.min(vp.w, s.r), b: Math.min(vp.h, s.b), rad: [0, 0, 0, 0] };
      return w.r - w.l >= 1 && w.b - w.t >= 1 ? w : null;
    };
    const outer = [], groups = new Map(), wins = new Map();
    parts.forEach((q, i) => { if (hs[i]) { if (!groups.has(hs[i])) groups.set(hs[i], []); groups.get(hs[i]).push({ q, i }); } });
    for (const H of groups.keys()) wins.set(H, winOf(H));
    const ov = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
    parts.forEach((q, i) => { if (!hs[i]) { const pr = outerOf(q, i); if (pr) outer.push({ pr, i }); } });
    for (const [H, list] of [...groups]) {
      const w = wins.get(H);
      if (w && !outer.some((o) => ov(o.pr, w) > 1)) continue;
      // (no window, or it overlaps a part drawn over the page: this panel's parts are drawn over the page too)
      groups.delete(H); wins.delete(H);
      for (const { q, i } of list) { const pr = outerOf(q, i); if (pr) outer.push({ pr, i }); }
    }
    for (const H of [...ui.hosts.keys()]) if (!groups.has(H)) dropHost(ui, H);
    if (!groups.size) return null;
    outer.sort((a, b) => a.i - b.i);
    const inner = [];
    const qz = (h) => [h.l, h.t, h.r, h.b].map((v) => Math.round(v * 4) / 4).join(' ');
    for (const [H, list] of groups) {
      const h = hostSvg(ui, H), o = h.svg.getBoundingClientRect();
      const a = areasOf(list.map(({ q }) => hostRect(q, H, pad, o.left, o.top)).filter(Boolean), list[0].i === 0);
      const x = { h, H, holes: a.holes, marks: [a.mark, ...a.insets].filter(Boolean), ext: { w: H.scrollWidth, h: H.scrollHeight } };
      x.sig = x.holes.map(qz).join(',') + '|' + x.holes.map((q) => q.rad.join(' ')).join(',') + '|' + x.marks.map(qz).join(',') + '|' + x.ext.w + 'x' + x.ext.h;
      inner.push(x);
    }
    const out = areasOf(outer.map((o) => o.pr), !!outer.length && outer[0].i === 0);
    return { outer: { holes: out.holes, marks: [out.mark, ...out.insets].filter(Boolean) }, wins: [...wins.values()], inner };
  }
  function drawHost(x) {
    const { h, holes, marks, ext } = x;
    // (well past the content's edges, an iOS overscroll included: the panel's own clip cuts the shade to its box)
    const E = 4000;
    h.shade.setAttribute('d', `M${-E} ${-E}H${ext.w + E}V${ext.h + E}H${-E}Z` + holes.map(rrPath).join(''));
    h.ring.setAttribute('d', holes.map((q) => rrPath(grow(q, 0.75))).join(''));
    h.glow.setAttribute('d', holes.map((q) => rrPath(grow(q, 3.5))).join(''));
    h.mark.setAttribute('d', marks.map((m) => rrPath(grow(m, 0.75))).join(''));
    h.sig = x.sig;
  }
  // the rings over the page fade while something moves that they can only follow by script (a fling of the page or
  // of a panel not drawn in, a sliding sheet): a ring a frame behind its target is the jiggle
  function moving(ui, ms0) {
    ui.rsvg.classList.add('moving');
    clearTimeout(ui.moveT);
    ui.moveT = setTimeout(() => ui.rsvg.classList.remove('moving'), ms0 || 160);
  }
  // (review-phone phone-3) a panel the spotlight is drawn inside, scrolled until the step's anchor is wholly out of its
  // visible box (a swipe from the lit + of the chain bar): once the panel is still and no finger is down, it scrolls
  // back just far enough to show the anchor again
  // a step's title starts with a capital letter: a key shared with a phrase used mid-sentence ('Cauchy integral',
  // «интеграл Коши» in a pane's title) is capitalized here; review-phone-verify extra-ru-cauchy
  const stepTitle = (st) => { const t = $t(st.title); return /^[а-яё]/.test(t) ? t[0].toUpperCase() + t.slice(1) : t; };
  const BACK_MS = 1800;   // (after the last scroll of the panel, or the finger's lift)
  function bringBack(r, H) {
    const ui = r.ui;
    ui.backH = null;
    if (!r.step || !r.tgt || !ui.hosts.has(H)) return;
    const q = r.tgt.parts[0];
    if (!q || !q.el || !H.contains(q.el)) return;
    if (ui.touching) { ui.backH = H; return; }
    const b = partBox(q), z = H.getBoundingClientRect();
    const l = z.left + H.clientLeft, t = z.top + H.clientTop, rr = l + H.clientWidth, bb = t + H.clientHeight, m = 8;
    const outX = b.right <= l + 1 || b.left >= rr - 1, outY = b.bottom <= t + 1 || b.top >= bb - 1;
    if (!outX && !outY) return;
    const dx = outX ? (b.left < l ? b.left - l - m : b.right - rr + m) : 0, dy = outY ? (b.top < t ? b.top - t - m : b.bottom - bb + m) : 0;
    try { H.scrollBy({ left: dx, top: dy, behavior: reduced() ? 'auto' : 'smooth' }); } catch (e) { H.scrollLeft += dx; H.scrollTop += dy; }
  }
  // (v15.1) the visual viewport at the page's own scale (a phone's keyboard, its URL bar): what lies outside it counts
  // as unsafe, so the callout stays in sight. Pinch-zoomed in, the page is the user's to pan: the callout is not chased.
  function viewSafe(sf, vp) {
    const v = typeof visualViewport !== 'undefined' ? visualViewport : null;
    if (!v || !(v.scale <= 1.01)) return sf;
    return { t: Math.max(sf.t || 0, v.offsetTop), l: Math.max(sf.l || 0, v.offsetLeft), b: Math.max(sf.b || 0, vp.h - v.offsetTop - v.height), r: Math.max(sf.r || 0, vp.w - v.offsetLeft - v.width) };
  }
  const inRects = (x, y, rs) => (rs || []).some((h) => x >= h.l && x <= h.r && y >= h.t && y <= h.b);
  // the collapsed bar's text: the step's title and, on a Try it step, its task (review-phone phone-5) in its button, read
  // out with the title (phone-8d); the count in short (phone-8c); Back as an icon (phone-8b); Next as on the whole step,
  // "Next: <chapter>" (phone-8a), shortened by fitMini when the bar has no room for it
  function miniText(ui, r, on) {
    ui.grow.setAttribute('aria-expanded', 'false');
    const tr = r.step ? tryOf(r.step) : null;
    if (on) {
      const task = tr ? plainCopy(tryFor(tr), modKey()) : '';
      ui.growT.textContent = ui.title.textContent;
      ui.growKT.textContent = task;
      ui.growK.hidden = !tr;
      ui.growK.classList.toggle('done', ui.tryBox.classList.contains('done'));
      ui.card.classList.toggle('has-task', !!tr);
      // (each part ends in one full stop: a task that ends in its own stop gets no second one)
      const end = (t) => (/[.!?…]\s*$/.test(t) ? t.trim() : t + '.') + ' ';
      ui.grow.setAttribute('aria-label', end(ui.title.textContent) + (tr ? end($t('Try it') + ': ' + task) : '') + $t('Show the whole step'));
      ui.count.textContent = r.countShort || r.countText || '';
      ui.count.setAttribute('aria-label', r.countText || '');
      ui.mback.hidden = ui.back.hidden;
      if (ui.next.dataset.full) { ui.next.textContent = ui.next.dataset.full; ui.next.removeAttribute('aria-label'); }
    } else {
      ui.card.classList.remove('has-task');
      ui.count.removeAttribute('aria-label');
      ui.count.textContent = ui.next.dataset.full ? '' : r.countText || '';
    }
  }
  // the bar's Next: "Next: <chapter>" while the title keeps 120 px, else "Next →" (its full label its accessible name)
  function fitMini(ui) {
    const n = ui.next;
    if (!n.dataset.full || ui.grow.offsetWidth >= 120) return false;
    n.textContent = n.dataset.short + ' →'; n.setAttribute('aria-label', n.dataset.full);
    return true;
  }
  // A second lit area the app itself covers (v15, a short desktop window: the chain under the Inspector) is not lit:
  // at its centre and four inner points the topmost element of the app, the tour and the open layers aside, is
  // another element. (The anchor is never dropped this way.)
  function covered(e) {
    if (!e || !e.isConnected || typeof document.elementsFromPoint !== 'function') return false;
    // (a part inside an open layer, the lens in a phone's sheet, is covered only by what is above it in that layer)
    const b = e.getBoundingClientRect(), vp = vpSize(), lay = layerEls().filter((k) => !k.contains(e));
    let n = 0;
    for (const [fx, fy] of [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
      const x = b.left + fx * b.width, y = b.top + fy * b.height;
      if (x < 0 || y < 0 || x >= vp.w || y >= vp.h) continue;
      const hit = document.elementsFromPoint(x, y).find((h) => !h.closest('[data-tour]') && !lay.some((k) => k.contains(h)));
      n++;
      if (!hit || hit === e || e.contains(hit) || hit.contains(e)) return false;
    }
    return n > 0;
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

  // the elements whose size the spotlight depends on: the callout, the page, the lit parts (the open layers join in layout)
  function watch(ui, els) {
    if (!ui.ro) return;
    for (const e of els) if (e && !ui.roSet.has(e)) { ui.roSet.add(e); try { ui.ro.observe(e); } catch (x) { /* */ } }
  }
  function watchStep(r) {
    const ui = r.ui;
    if (!ui.ro) return;
    ui.ro.disconnect(); ui.roSet = new Set();
    const els = [ui.card, document.documentElement];
    if (r.tgt) els.push(...r.tgt.parts.map((q) => q.el));
    const tr = r.step ? tryOf(r.step) : null;
    for (const a of [].concat((r.step && r.step.also) || [], (tr && tr.work) || [])) { const t = anchorOf(a); if (t) els.push(...t.parts.map((q) => q.el)); }
    watch(ui, els);
  }
  // "Next: <chapter>" shortens to "Next" (the full label stays its accessible name) when it would not fit the row
  function fitNext(ui) {
    const n = ui.next, full = n.dataset.full;
    if (!full) return;
    if (n.textContent !== full) { n.textContent = full; n.removeAttribute('aria-label'); }
    // (v15: "Next: Editing the chain" beside Back and Done wraps in a 320 px card: a free-standing card widens, up to
    // 380 px, to keep the row on one line)
    const card = ui.card;
    if (!card.style.width && !card.classList.contains('sheet') && !card.classList.contains('docked') && ui.foot.clientWidth > 0) {
      const kids = [...ui.foot.children].filter((c) => !c.hidden && c.offsetWidth > 0);
      if (kids.length > 1 && kids[kids.length - 1].offsetTop > kids[0].offsetTop + 2) {
        const need = kids.reduce((s, c) => s + c.offsetWidth, 0) + 8 * (kids.length - 1) - ui.foot.clientWidth;
        const w = Math.ceil(card.offsetWidth + need + 1);
        if (w <= Math.min(380, vpSize().w - 24)) card.style.width = w + 'px';
      }
    }
    if (ui.foot.clientWidth > 0 && n.scrollWidth > ui.foot.clientWidth + 0.5) { n.textContent = n.dataset.short; n.setAttribute('aria-label', full); }
  }
  // Measure, place and draw: on a step change (the shade morphs from where it was to the new area, measured afresh in
  // each frame), and whenever something moves (scroll, resize, observers, the motion loop). Returns whether anything
  // changed. The callout goes beside the lit area, inside the viewport and its safe area, clear of every open layer;
  // with no room clear of the layers it docks along an edge.
  function layout(stepChange) {
    const r = run;
    if (!r || !r.step) return false;
    const ui = r.ui, step = r.step;
    // the anchor went away while the step shows (a panel closed, the layout changed): another match, or a centred card
    if (r.el && !visible(r.el)) { const t = anchorOf(step.anchor); if (t) { r.tgt = t; r.el = t.el; } }
    const tgtNow = r.el && visible(r.el) ? r.tgt : null;
    const { holes, mark, insets } = holesFor(step, tgtNow);
    const marks = [mark, ...(insets || [])].filter(Boolean);
    const layers = appLayers();
    watch(ui, layerEls());
    const safe0 = safeArea(ui), vp = vpSize(), nar = narrow();
    const card = ui.card;
    const block = layers.map((k) => ({ l: k.l, t: k.t, r: k.r, b: k.b }));
    // v15.1, a phone: the parts inside a scrolling panel are drawn inside it (hostPlan). The step's work area is every
    // lit area, and the whole visible box of a panel that holds one (the user scrolls it): the callout keeps clear of
    // it, and a touch in it folds the whole step back into its bar. The visual viewport bounds the callout too.
    const ph = phoneL();
    const plan = hostPlan(r, step, tgtNow);
    if (!plan) for (const H of [...ui.hosts.keys()]) dropHost(ui, H);
    const wins = plan ? plan.wins : [];
    if (plan) watch(ui, plan.inner.map((x) => x.H));
    ui.work = holes.concat(wins).map((h) => ({ l: h.l, t: h.t, r: h.r, b: h.b }));
    const safe = ph ? viewSafe(safe0, vp) : safe0;
    // the whole callout's size: measured afresh unless it is docked (or a phone's bar) and nothing that sets it has
    // changed since (no undocking and redocking in every frame while a layer stays open)
    const key = [r.seq, vp.w, vp.h, nar, ui.title.textContent.length, ui.body.childNodes.length].join(',');
    let size;
    if ((card.classList.contains('docked') || card.classList.contains('mini')) && ui.full && ui.full.key === key) size = ui.full.size;
    else {
      if (card.classList.contains('mini')) { card.classList.remove('mini', 'slim'); miniText(ui, r, false); }
      card.classList.toggle('sheet', nar);
      card.classList.remove('docked', 'tight');
      card.style.width = ''; card.style.minWidth = '';
      fitNext(ui);
      // (v15 review regress-4: a callout meant to sit below a tall area, the planes, with too little room under it at
      // 320 px tries a wider, shorter card, up to 600 px, before place() falls back to covering the area)
      const h0 = holes[0];
      if (step.place === 'bottom' && h0 && !nar) {
        // (the room between the area itself, without its lit margin, and the viewport's margin: place() then puts the
        // card there, beside the area or at the viewport's edge over the lit margin only)
        const room = vp.h - M - (h0.b - (step.pad != null ? step.pad : 0));
        // (review-polish-verify V-1: up to the width of all the lit areas together, X and Y side by side; when no width
        // fits the room, the narrowest that is short of it by at most a quarter of its height, which place() 2b puts
        // at the viewport's edge over the areas' bottom rim (their options strips), not inside the anchor over what the
        // step is about: Preimages in Russian, over Y's disc)
        const span = holes.reduce((u, q) => ({ l: Math.min(u.l, q.l), r: Math.max(u.r, q.r) }), { l: h0.l, r: h0.r });
        if (card.offsetHeight > room && room >= 96) {
          let edge = null;
          for (const w of [440, 520, 600, 680]) {
            if (w > Math.min(vp.w - 2 * M, Math.max(320, span.r - span.l))) break;
            card.style.width = w + 'px';
            fitNext(ui);
            if (card.offsetHeight <= room) break;
            if (edge == null && card.offsetHeight * 0.75 <= room) edge = w;
          }
          if (card.offsetHeight > room) { card.style.width = edge != null ? edge + 'px' : ''; fitNext(ui); }
        }
      }
      size = { w: card.offsetWidth, h: card.offsetHeight };
      ui.full = { key, size };
    }
    // beside the anchor's area, clear of every lit area; the pointer aims at the anchor itself when it sits in a lit panel
    let p = place(holes[0] || null, size, vp, {
      prefer: step.place, others: holes.slice(1).concat(wins), point: mark ? { x: (mark.l + mark.r) / 2, y: (mark.t + mark.b) / 2 } : null,
      // (review-phone phone-10: the bar only on a touch screen; a narrow window with a mouse keeps v15's card)
      avoid: () => controlsIn(r.el), safe, block, mini: ph && coarse() && !ui.expanded,
    });
    // (a phone: the callout stays where it is, collapsed or whole, while it keeps as clear of the work area and the
    // layers as when it was placed: it never chases a scroll, a fling or a sliding sheet)
    const pkey = [r.seq, vp.w, vp.h, size.w, size.h, ui.expanded].join(',');
    // (review-phone phone-7: the bar is kept only while place() still asks for it: nothing lit any more, the whole card)
    const lp = ph && !stepChange && ui.lastP && ui.lastP.key === pkey && p.mode !== 'dock' ? ui.lastP : null;
    const prevMini = lp && lp.p.mode === 'mini' && p.mode === 'mini' ? lp.p : null;
    if (lp && !prevMini && lp.p.mode !== 'mini' && lp.p.mode !== 'dock' && overArea(size, lp.p.x, lp.p.y, ui.work, 0) <= lp.o + 1 && overArea(size, lp.p.x, lp.p.y, block, 8) === 0) p = lp.p;
    else ui.lastP = ph && p.mode !== 'mini' ? { key: pkey, p, o: p.mode === 'dock' ? 0 : overArea(size, p.x, p.y, ui.work, 0) } : ui.lastP;
    if (p.mode === 'mini') {
      // the one-line bar at an edge: the step's title (and task), Back, the count and Next; it stays where it was while
      // that is still clear (placeMini's prev), else moves (review-phone phone-4: never over the work area while a clear
      // place exists; no room clear of an open layer: docked)
      card.classList.remove('sheet', 'docked', 'tight');
      card.style.minWidth = '';
      card.classList.remove('slim');
      card.classList.add('mini');
      miniText(ui, r, true);
      const full = vp.w - 16 - (safe.l || 0) - (safe.r || 0);
      card.style.width = full + 'px';
      const bar = { w: full, h: card.offsetHeight };
      let pad = 6;
      try { const cs = getComputedStyle(card.querySelector('.tour-in')); pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom); } catch (e) { /* */ }
      const pm = placeMini(bar, vp, { safe, work: ui.work, block, anchor: holes[0], prev: prevMini, minW: Math.min(full, 240), slimH: bar.h - pad });
      if (pm) {
        p = pm; size = { w: pm.w, h: pm.h };
        card.classList.toggle('slim', pm.slim);
        card.style.width = pm.w + 'px';
        fitMini(ui);
        ui.lastP = { key: pkey, p: pm, o: 0 };
      } else { card.classList.remove('mini', 'slim'); card.style.width = ''; miniText(ui, r, false); fitNext(ui); p = { mode: 'dock', side: null, x: 0, y: 0, caret: null }; }
    } else if (card.classList.contains('mini')) {
      // (unfolded: the whole step, at the size measured for it)
      card.classList.remove('mini', 'slim');
      card.style.width = '';
      miniText(ui, r, false);
      card.classList.toggle('sheet', nar && p.mode !== 'dock');
      fitNext(ui);
    }
    if (p.mode === 'dock') {
      card.classList.remove('sheet');
      card.classList.add('docked');
      // The docked strip: whole (the title and the ×), else narrower into the strip beside the layers (the title
      // wraps), else the × alone; the first that covers no layer, else the whole one, kept off the layers' controls
      const dockAs = (t) => { card.classList.toggle('tight', t === 'tight'); card.style.width = typeof t === 'number' ? t + 'px' : ''; card.style.minWidth = typeof t === 'number' ? '0px' : ''; return { w: card.offsetWidth, h: card.offsetHeight }; };
      const at = (sz) => placeDock(sz, vp, { safe, block, lit: holes, avoid: () => layerControls() });
      const s0 = dockAs(null), p0 = at(s0);
      size = s0; p = p0;
      if (p0.over > 0) {
        const gw = dockGutter(vp, { safe, block, min: (coarse() ? 44 : 36) + 100 });
        let ok = false;
        if (gw && gw < s0.w) { const s1 = dockAs(gw), p1 = at(s1); if (p1.over <= 0) { size = s1; p = p1; ok = true; } }
        if (!ok) { const s2 = dockAs('tight'), p2 = at(s2); if (p2.over <= 0) { size = s2; p = p2; ok = true; } }
        if (!ok) dockAs(null);
      }
    } else if (card.classList.contains('docked')) {
      card.classList.remove('docked', 'tight');
      card.style.width = ''; card.style.minWidth = '';
      card.classList.toggle('sheet', nar);
    }
    // (the whole step over the work area, shown from the bar: a button folds it back)
    card.classList.toggle('over', ph && p.mode !== 'mini' && p.mode !== 'dock' && ui.expanded && overArea(size, p.x, p.y, ui.work, 0) > 0);
    // the focus goes back to the callout when the layers it left for close (⌘K from Next, then Esc)
    refocus(ui, layers.length);
    card.dataset.side = p.mode === 'side' && p.caret != null ? p.side : '';
    card.dataset.edge = p.mode === 'sheet' || p.mode === 'dock' || p.mode === 'mini' ? p.side : '';
    card.style.top = p.y + 'px';
    card.style.left = nar && p.mode !== 'dock' && p.mode !== 'mini' ? '' : p.x + 'px';
    if (p.caret != null) card.style.setProperty('--caret', p.caret + 'px');
    // a toast (an Undo after a delete) moves clear of the callout, and the rings keep off it like off a layer
    const sheetL = 12 + (safe.l || 0);
    const cr = nar && p.mode !== 'dock' && p.mode !== 'mini' ? { l: sheetL, t: p.y, r: vp.w - 12 - (safe.r || 0), b: p.y + size.h } : { l: p.x, t: p.y, r: p.x + size.w, b: p.y + size.h };
    const toasts = guardToast(ui, cr, vp, safe);
    const masked = toasts.length ? layers.concat(toasts) : layers;
    const q = (h) => [h.l, h.t, h.r, h.b].map((v) => Math.round(v * 4) / 4);
    // (v15.1: with a plan, the fixed layer draws the parts outside the panels and a window over each panel; each panel
    // draws its own parts, in its content px, which a scroll of the panel does not change)
    const oHoles = plan ? plan.outer.holes : holes, oMarks = plan ? plan.outer.marks : marks;
    const dsig = JSON.stringify([oHoles.map(q), oMarks.map(q), wins.map(q), oHoles.map((h) => h.rad)]) + (plan ? plan.inner.map((x) => x.sig).join(';') : '');
    ui.drawSig = dsig;
    const sig = dsig + JSON.stringify([block.map(q), toasts.map(q)]) + [p.x, p.y, p.mode, p.side, size.w, size.h, vp.w, vp.h].join(',');
    const changed = sig !== r.tracked;
    r.tracked = sig;
    if (stepChange) {
      const dur = reduced() ? 0 : ms(getComputedStyle(document.documentElement).getPropertyValue('--t-slow'), 240);
      // (no morph when the lit area stays where it is: the inner ring shows at once)
      const same = ui.holes && ui.holes.length === holes.length && ui.holes.every((h, i) => Math.max(Math.abs(h.l - holes[i].l), Math.abs(h.t - holes[i].t), Math.abs(h.r - holes[i].r), Math.abs(h.b - holes[i].b)) < 1);
      ui.anim = dur && !same && !plan && ui.holes && ui.holes.length && holes.length ? { from: ui.holes.slice(), t0: performance.now(), dur } : null;
      card.classList.add('entering');
      requestAnimationFrame(() => card.classList.remove('entering'));
    }
    let ended = false;
    if (ui.anim && !holes.length) ui.anim = null;
    if (ui.anim) {
      const u = ease(Math.min(1, (performance.now() - ui.anim.t0) / ui.anim.dur));
      // (the inner ring appears once the shade has settled)
      if (u < 1) { drawHoles(ui, between(ui.anim.from, holes, u), null, masked); kick(2); return true; }
      ui.anim = null; ended = true;
    }
    if (changed || ended || stepChange) { drawHoles(ui, oHoles, oMarks, masked, wins); guardTip(r); }
    if (plan) for (const x of plan.inner) if (stepChange || x.h.sig !== x.sig) drawHost(x);
    ui.holes = holes;
    return changed;
  }
  // The focus and the app's layers: when the first layer opens with the focus in the callout (or a key from it just
  // opened it: ⌘K), that control is remembered; when the last one closes and the focus is left outside the callout
  // and not in a field, it goes back there (a click elsewhere in between forgets it)
  function refocus(ui, n) {
    const was = ui.nLayers || 0, a = document.activeElement;
    ui.nLayers = n;
    if (!was && n) ui.refocus = ui.card.contains(a) ? a : ui.keyEl && performance.now() - (ui.keyAt || 0) < 1500 ? ui.keyEl : null;
    else if (was && !n) {
      const f = ui.refocus;
      ui.refocus = null;
      if (!f || !f.isConnected || !visible(f) || ui.card.contains(a)) return;
      if (a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable)) return;
      try { f.focus({ preventScroll: true }); } catch (e) { /* */ }
    }
  }
  // The app's toasts sit under the callout: one that would be covered moves, up or down, just clear of it (the less
  // far of the two that stays on screen), and back once the callout is out of its way. Returns the toasts' boxes.
  const TOAST_SEL = '#toastHost';
  function guardToast(ui, c, vp, safe) {
    const host = document.querySelector(TOAST_SEL);
    if (!host) return [];
    const kids = [...host.children].filter(visible);
    const dy0 = ui.toastDy || 0;
    if (!kids.length) { if (dy0) { host.style.transform = ''; ui.toastDy = 0; } return []; }
    const boxes = kids.map((k) => { const b = k.getBoundingClientRect(); return { l: b.left, t: b.top - dy0, r: b.right, b: b.bottom - dy0, rad: radii(k) }; });
    const U = boxes.reduce((u, h) => ({ l: Math.min(u.l, h.l), t: Math.min(u.t, h.t), r: Math.max(u.r, h.r), b: Math.max(u.b, h.b) }));
    const m = 8, lo = (safe.t || 0) + m, hi = vp.h - (safe.b || 0) - m;
    let dy = 0;
    if (U.l < c.r + m && U.r > c.l - m && U.t < c.b + m && U.b > c.t - m) {
      const fits = [c.t - m - U.b, c.b + m - U.t].filter((d) => U.t + d >= lo && U.b + d <= hi).sort((a, b) => Math.abs(a) - Math.abs(b));
      dy = fits.length ? Math.round(fits[0]) : 0;
    }
    if (dy !== dy0) { host.style.transform = dy ? `translateY(${dy}px)` : ''; ui.toastDy = dy; }
    return boxes.map((b) => ({ l: b.l, t: b.t + dy, r: b.r, b: b.b + dy, rad: b.rad }));
  }
  // the motion loop: layout every frame for n frames, longer while things keep changing or the shade morphs
  function kick(n) {
    const r = run;
    if (!r) return;
    const ui = r.ui;
    ui.motion = Math.max(ui.motion || 0, n || 2);
    if (!ui.raf) ui.raf = requestAnimationFrame(tick);
  }
  function tick() {
    const r = run;
    if (!r) return;
    const ui = r.ui;
    ui.raf = 0;
    if (layout(false)) ui.motion = Math.max(ui.motion, 12); else ui.motion--;
    if (!ui.raf && (ui.anim || ui.motion > 0)) ui.raf = requestAnimationFrame(tick);
  }
  // a CSS time token in ms ('240ms', '0.24s'); the fallback when it is missing
  function ms(v, dflt) {
    const m = /^\s*([\d.]+)\s*(ms|s)?\s*$/.exec(String(v || ''));
    return m ? parseFloat(m[1]) * (m[2] === 's' ? 1000 : 1) : dflt;
  }
  function track() { kick(2); }

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
      r.ui.growK.classList.add('done');
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
    lastWhy = r.why;
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
    for (const g of [ui.svg, ui.rsvg, ...[...ui.hosts.values()].map((h) => h.svg)]) { g.style.transition = reduced() ? '' : 'opacity 120ms linear'; g.style.opacity = '0'; }
    ui.raf = 0;
    setTimeout(() => { ui.root.remove(); ui.top.remove(); for (const H of [...ui.hosts.keys()]) dropHost(ui, H); }, reduced() ? 0 : 140);
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
      kids.push(mi('tour-continue', `<span class="mi-ic">${ICON_PLAY}</span><span class="mi-label">${esc($t('Continue the tour'))}<span class="tour-sub">${esc($t(resume.title))}: ${esc(stepTitle(st))}</span></span>`,
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
  function skippedList() { const w = run ? run.why : lastWhy; return w ? [...w].map(([id, why]) => ({ id, why })) : []; }
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
        anchor: a ? { l: a.left, t: a.top, r: a.right, b: a.bottom } : null, scenes: run.scenes, scene: run.scene == null ? null : run.scene,
        docked: run.ui.card.classList.contains('docked'), mini: run.ui.card.classList.contains('mini'), expanded: !!run.ui.expanded,
        work: (run.ui.work || []).map((h) => ({ l: h.l, t: h.t, r: h.r, b: h.b })), hosted: run.ui.hosts.size, layers: appLayers().length, moving: !!run.ui.anim || run.ui.card.getAttribute('aria-busy') === 'true', skipped: skippedList() };
    },
    // the steps the running (else the last) tour skipped: [{ id: 'chapter/step', why: 'missing' | 'clipped' | 'scene' }]
    skipped: skippedList,
    // internals for the tests and the design tables
    _t: { CHAPTERS, SCENES, ANCHORS, LOOK, parseCopy, texPlain, plainCopy, place, placeDock, placeMini, rrPath, litAreas, ms, normRec, seenRec, shouldSuggest, chapterDone, chapterNew, seek, absent, sceneAt, pickScene, copyFor, tryFor, probeInOut, SUGGEST_MAX, KEY, STASH, LIVE, dockGutter, clippedAway },
  };
  return Tour;
})();
// a global binding for the app's scripts, and window.Tour for pages and tools that look it up there
if (typeof window !== 'undefined') window.Tour = Tour;
if (typeof module !== 'undefined' && module.exports) module.exports = { Tour };
