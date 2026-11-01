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
  const VERSION = 3;          // content version; a chapter whose `rev` is newer than what a user saw is marked New
                              // (2: v15, the Inspector, the F tile, the planes' menu, shared numbers, the phone layout;
                              // 3: v16.4, the docked strip, a task in most steps, the Sound chapter)
  const SUGGEST_MAX = 3;      // an ignored suggestion comes back on at most this many openings

  // ---------------------------------------------------------------- content
  // Scenes are in the format of the app's examples (EX in app.js). `needs` names an app feature the scene relies on
  // (api.has(feature) === false: a step falls back to the next scene of its list, or is left out). `look` is the
  // display the copy assumes; the tour applies it with api.setLook right after api.loadScene, so a user's own opacity
  // or Landscape height never makes the copy false (restore() brings the user's look back).
  // (v16.4: phaseKey, Y's Phase key; sectors, the phase sectors of Tiles: 12 lines 30° apart, Hear the function's notes)
  const LOOK = { alpha: null, height: 'log', sheets: false, phaseStyle: 'enhanced', paths: true, allAtOnce: false, phaseKey: false, sectors: 12 };
  const look = (o) => Object.assign({}, LOOK, o || {});
  const SCENES = {
    strip: {
      name: 'Strip to disk', view: { cx: 0, cy: 0, s: 52 }, look: look(),
      shapes: [{ kind: 'formula', expr: '|\\Im z|<\\frac{\\pi}{2}' }, { kind: 'line', a: [0, 0.8], b: [1, 0.8] }, { kind: 'point', p: [0, 0], label: 'z₀' }],
      steps: [{ type: 'exp', params: {} }, { type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' } }],
    },
    // v15.2 (notes/formula-steps/DESIGN.md 11): a typed formula that is a chain of catalog steps
    splitFormula: {
      name: 'A formula in steps', view: { cx: 0, cy: 0, s: 80 }, look: look(),
      shapes: [{ kind: 'rect', a: [-1.2, -1.2], b: [1.2, 1.2] }],
      steps: [{ type: 'custom', params: { expr: '\\sin(z^2+1)', cut: 180 } }],
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
      name: 'Sheets of the logarithm', view: { cx: 0, cy: 0, s: 60 }, look: look({ height: 'im', sheets: true }),
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
    // v16 constructions: 1/z, three free points z₀, z₁, z₂ and the line through z₀ and z₁ (its ends bound to them)
    construct: {
      name: 'Constructions', needs: 'constructions', view: { cx: 0, cy: 0, s: 80 }, look: look(),
      shapes: [{ kind: 'point', id: 'tc0', p: [-1.5, -0.5] }, { kind: 'point', id: 'tc1', p: [1, -1] }, { kind: 'point', id: 'tc2', p: [0.25, 1.25] },
        { kind: 'line', id: 'tc3', a: [-1.5, -0.5], b: [1, -1], at: { a: { s: 'tc0' }, b: { s: 'tc1' } } }],
      steps: [{ type: 'recip', params: {} }],
    },
    // v16.4 (notes/tour-r3/SPEC.md 4.2): the Grieg example itself, asked from the app at load time (app: its
    // api.sceneSpec name; the fields here are placeholders), and the phase lines of F = (z − 1)/(z + 1) (Hear the function's notes; the ids harp and harpLoop are kept), whose lines of
    // constant arg F are arcs from the pole −1 to the zero 1, with a circle once round the zero
    song: { name: 'In the Hall of the Mountain King', app: 'song', needs: 'song', look: look({ phaseStyle: 'phase' }), view: { cx: 0, cy: 0, s: 60 }, shapes: [], steps: [] },
    harp: {
      name: 'Phase lines', needs: 'zp', view: { cx: 0, cy: 0, s: 110 }, fit: { x0: -2, x1: 2, y0: -1.2, y1: 1.2 }, look: look({ phaseStyle: 'enhanced', sectors: 12 }),
      shapes: [], steps: [{ type: 'zp', params: { a: '1', zeros: '1', poles: '-1' } }],
    },
    harpLoop: {
      name: 'Phase lines', needs: 'zp', view: { cx: 0, cy: 0, s: 110 }, fit: { x0: -2, x1: 2, y0: -1.2, y1: 1.2 }, look: look({ phaseStyle: 'enhanced', sectors: 12 }),
      shapes: [{ kind: 'circle', c: [1, 0], r: 0.6 }], steps: [{ type: 'zp', params: { a: '1', zeros: '1', poles: '-1' } }],
    },
  };

  // Copy markup: $tex$, {K} a key (kbd), **bold**. {mod} is ⌘ on Apple devices and Ctrl elsewhere.
  // A step: id, anchor (a name or a list of fallbacks; null = centred card), also (more lit areas), title, body,
  // narrow (body below 640 px), touch (body on a touch screen: no hover, no right-click), byScene (body by the scene
  // shown), before (actions run first), try ({text, touch, on: event(s), test(e, memory), count, advance, ctl, work, then,
  // after}), wait (ms after the actions), needs (an app feature, see api.has).
  // v16.1: try.ctl names the controls that complete the Try it (a tool's button, a slider, a view's key), lit while the
  // Try it shows, each its own area or a ring inside a lit one, and reachable with Tab; try.work names parts lit on a
  // touch screen only. live: the anchor is looked up again whenever the layout changes (a phone's tool in the More tools
  // sheet, then on the More key). pictures: the chain shows its cards' pictures during the step (api.chainPictures).
  // The panes are named by their role, X and Y, never left and right: on a phone they stack.
  // v16.4 (notes/tour-r3/SPEC.md 3): lead, one sentence the strip shows without a tap (what to look at; required on a
  // step with no task, with tryWide or with try.after); try.then, the result line once the task is done; try.after, an
  // earlier step of the chapter whose task must have been done in this run for this one to show; act: 'listen' (the
  // strip's Listen button) or 'sound' (Turn on sound, while the sound is not ready); hear: the step turns Hear the
  // function on (the user's setting comes back); captions: [[seconds, text]] shown while the step's piece plays
  // (capFrac: [[fraction of the playback, text]], for a Listen along whose duration is the curve's length at the zoom).
  // A task step moves on by itself CD_MS (1.5 s) after it is done (SPEC 2); try.advance (a door) after 0.7 s.
  // (r3 review: try.off, the task while the sound is off, on a step whose act button turns it on; try.hint { on, test,
  // text, touch }, a line shown in place of the task when that event says the attempt went wrong)
  const orbit = (e) => !e || e.how === 'orbit';
  const CHAPTERS = [
    {
      id: 'basics', title: 'Basics', time: '2 min', rev: 3, scene: 'strip',
      steps: [
        { id: 'welcome', anchor: null, title: 'Welcome to the Workbench', before: [['view', 'xy'], ['deform', false], ['surface', 'L', 'plane'], ['surface', 'R', 'plane'], ['tool', 'select']],
          lead: 'Practice freely: what you draw here is cleared at the end.',
          body: 'Draw a set in the $z$-plane, send it through a chain of functions and watch its image: about two minutes. What you draw during the tour is cleared when it ends, and your own work comes back exactly as it was.' },
        { id: 'x', anchor: 'paneL', title: 'X: the domain', before: [['plane', 'L'], ['tool', 'select']],
          body: 'X shows your shapes, here the strip $|\\operatorname{Im} z|<\\pi/2$, coloured by the phase of $z$, with a grid in $z$-coordinates. Scroll to zoom, drag empty space to pan, and {Z} fits both planes.',
          touch: 'X shows your shapes, here the strip $|\\operatorname{Im} z|<\\pi/2$, coloured by the phase of $z$, with a grid in $z$-coordinates. Pinch to zoom and drag empty space to pan.',
          try: { text: 'Drag empty space in X, or scroll to zoom.', touch: 'Drag empty space in X, or pinch.', on: 'view-moved', test: (e) => !e || (e.pane === 'L' && e.how !== 'orbit'), ctl: ['tool:select'] } },
        { id: 'y', anchor: 'paneR', title: 'Y: the image', before: [['plane', 'R'], ['tool', 'select']],
          lead: 'The strip becomes the unit disc, and angles are kept.',
          body: 'Y shows the image under $F(z)=(e^z-1)/(e^z+1)$: the strip becomes the unit disc. $F$ is conformal there: grid lines still cross at right angles, and tiny squares map to near-squares.',
          try: { text: 'Scroll to zoom in Y, or drag to pan.', touch: 'Pinch in Y, or drag.', on: 'view-moved', test: (e) => !e || (e.pane === 'R' && e.how !== 'orbit'), ctl: ['tool:select'], then: 'Y moved on its own: X keeps its view.' } },
        // (r3 review: on a phone Y is the large plane here also when the tour resumes at this step)
        { id: 'preimages', anchor: 'paneR', also: ['paneL'], title: 'Preimages', before: [['plane', 'R']],
          body: 'Hover a point $w$ in Y: X marks every $z$ in view with $F(z)=w$. Inside the disc there is exactly one in the strip, since $F$ maps the strip one-to-one onto the disc. Outside it there are two, $2\\pi i$ apart, as $F$ has period $2\\pi i$.',
          // (v15 touch: a still hold opens the planes' menu; a hold then a slide probes)
          touch: 'Hold a point $w$ in Y, then slide: X marks every $z$ in view with $F(z)=w$. Inside the disc there is exactly one in the strip, since $F$ maps the strip one-to-one onto the disc. Outside it there are two, $2\\pi i$ apart.',
          try: { text: 'Hover inside the disc, then outside it.', touch: 'Hold inside the disc until the ring fills, then slide out.', on: 'probe', test: probeInOut, then: 'Inside, one $z$; outside, two, $2\\pi i$ apart.',
            // (r3 review user-9: a hold shorter than the ring pans Y; the line says why)
            hint: { on: 'view-moved', test: (e) => !e || e.pane === 'R', touch: 'That moved Y: hold still until the ring fills, then slide.' } } },
        // (v16.1: the Disc tool itself, where it shows: the Draw panel, the rail, a phone's tool row; live: the lit tool is
        // looked up again as the layout changes)
        { id: 'draw', anchor: 'tool:disc', also: ['paneL'], live: true, title: 'Draw a shape', before: [['plane', 'L']],
          body: 'Pick a tool and drag in X to add a shape. The same tools in Y add a target in $w$ instead.',
          try: { text: 'Choose Disc, then drag in X.', on: 'shape-added', then: 'Y shows its image under $F$.' } },
        // (tryWide: on a phone the list and X are a screen apart, so the drag is not asked for there)
        { id: 'shapes', anchor: 'shapes', also: ['paneL'], title: 'Your shapes', before: [['tool', 'select'], ['panel', 'left', 'tools:shapes']], tryWide: true,
          lead: 'Each shape is listed with its equation.',
          body: 'Each shape is listed with its equation; the eye hides it and ⋯ has the rest: duplicate, delete, integrate. With Select {V}, drag a shape or a handle and the image follows; {mod}{Z} undoes.',
          touch: 'Each shape is listed with its equation; the eye hides it and ⋯ has the rest: duplicate, delete, integrate. With Select, drag a shape or a handle and the image follows.',
          try: { text: 'Press {V}, then drag the line $\\operatorname{Im} z=0.8$ up or down.', touch: 'Tap the line $\\operatorname{Im} z=0.8$, then drag it up or down.', on: 'shape-moved', ctl: ['tool:select'], then: 'Y followed the line as you dragged it.' } },
        // (r3 review user-2: the task on a phone too, where the step's tools sheet holds the field and Add; its example is
        // not the field's placeholder, which reads like a filled field)
        { id: 'formula', anchor: 'formula', also: ['paneL'], title: 'Sets from formulas', before: [['panel', 'left', 'tools:shapes']],
          body: 'Type a set and press Add, such as $|z-1|<2$ or $0<\\operatorname{Im} z<\\pi$. An equation like $|z|=1$ adds a curve, and a formula in $w$ adds a target.',
          // (v16.5 UX17: a phone's words for the places and gestures, here and below)
          touch: 'Type a set and tap Add, such as $|z-1|<2$ or $0<\\operatorname{Im} z<\\pi$. An equation like $|z|=1$ adds a curve, and a formula in $w$ adds a target.',
          try: { text: 'Type $|z+1|<1$ and press Add.', touch: 'Type $|z+1|<1$ and tap Add.', on: 'shape-added', test: (e) => !e || e.via === 'formula', then: 'A set from a formula is a shape like any other.' } },
        { id: 'chain', anchor: 'chain', also: ['panes'], title: 'The function chain', before: [['focus', 0]],
          // (v15: a click selects a step for the Inspector; a double-click, or the lens in the Inspector, shows it alone)
          body: 'The cards apply in order: $F=f_2\\circ f_1$ with $f_1(z)=e^z$. Click a card to select it, and the Inspector edits it. Double-click it to see that step alone: X and Y become its input and output.',
          // (#246: on a phone the steps are rows of the chain sheet, which the steps button under the planes opens)
          touch: 'The steps apply in order: $F=f_2\\circ f_1$ with $f_1(z)=e^z$. Open the chain with the steps button under the planes and tap a step: its editor opens, and Show alone there shows that step alone, with X and Y as its input and output.', deskTouch: 'The cards apply in order: $F=f_2\\circ f_1$ with $f_1(z)=e^z$. Tap a card to select it, and the Inspector edits it. Show alone there shows that step alone: X and Y become its input and output.', phoneFine: 'The steps apply in order: $F=f_2\\circ f_1$ with $f_1(z)=e^z$. Open the chain with the steps button under the planes and click a step: its editor opens, and Show alone there shows that step alone, with X and Y as its input and output.',
          try: { text: 'Double-click the card $f_1$.', touch: 'Open the chain, tap $f_1$, then Show alone.', deskTouch: 'Tap the card $f_1$, then Show alone.', phoneFine: 'Open the chain, click $f_1$, then Show alone.', on: 'step-focused', test: (e) => !e || e.k === 1, work: ['lens'], ctl: ['card1'], then: 'X and Y are now $f_1$\'s input and output.' } },
        // (the open catalog holds the countdown: it moves on CD_MS after it closes)
        { id: 'add', anchor: ['addStep', 'chain'], also: ['paneR'], title: 'Add a function', before: [['focus', 0]],
          body: 'Press {+} or click here to add a step: pick one from the catalog or type a formula such as $\\sin(z^2)$. Drag a card by its header to reorder.',
          touch: 'Open the chain with the steps button under the planes and tap Add function: pick one from the catalog or type a formula such as $\\sin(z^2)$. To reorder, drag a step by its grip.', deskTouch: 'Tap here to add a step: pick one from the catalog or type a formula such as $\\sin(z^2)$. Drag a card by its header to reorder.', phoneFine: 'Open the chain with the steps button under the planes and click Add function: pick one from the catalog or type a formula such as $\\sin(z^2)$. To reorder, drag a step by its grip.',
          try: { text: 'Press {+}, or click the add card.', touch: 'Open the chain, then tap Add function.', deskTouch: 'Tap Add function.', phoneFine: 'Open the chain, then click Add function.', on: 'layer-opened', test: (e) => !e || e.kind === 'catalog', ctl: ['addStep'] } },
        { id: 'examples', anchor: ['examples', 'moreBtn'], title: 'Examples',
          lead: 'Worked examples, from Joukowski to a residue.',
          body: 'Worked examples, from the Joukowski airfoil to a residue found by integration. Open one whenever you want a starting point.',
          narrow: 'Worked examples are in this menu, from the Joukowski airfoil to a residue found by integration.' },
      ],
    },
    {
      id: 'views', title: 'Views', time: '1 min', rev: 2, scene: 'rational',
      steps: [
        { id: 'switch', anchor: 'viewSwitch', also: ['panes'], title: 'Three views', before: [['deform', false], ['view', 'xy']],
          body: 'X → Y shows the two planes side by side. Phase and Landscape are pictures of $F$ over X, each in one wide panel. Keys {1} {2} {3}.',
          touch: 'X → Y shows the two planes. Phase and Landscape are pictures of $F$ over X, each filling the screen.', deskTouch: 'X → Y shows the two planes side by side. Phase and Landscape are pictures of $F$ over X, each in one wide panel.', phoneFine: 'X → Y shows the two planes. Phase and Landscape are pictures of $F$ over X, each filling the screen. Keys {1} {2} {3}.',
          try: { text: 'Choose Phase.', on: 'view-changed', test: (e) => !e || e.main === 'phase', advance: true, ctl: ['viewPhase'] } },
        { id: 'phase', anchor: 'panes', title: 'Phase portrait', before: [['view', 'phase'], ['surface', 'L', 'plane']],
          lead: 'Colour is $\\arg F$; all colours meet at zeros and poles.',
          body: 'Each $z$ is coloured by $\\arg F(z)$, here for $F(z)=(z^2-1)/(z^2+1)$, and the brightness bands are bounded by level curves of $|F|$. All colours meet at the zeros $\\pm1$ and the poles $\\pm i$, circling one way around a zero and the other way around a pole.',
          try: { text: 'Zoom in on a zero or a pole.', touch: 'Spread two fingers on a zero or a pole.', on: 'view-moved', test: (e) => !e || e.how === 'zoom', then: 'All the colours still meet there, however far you zoom.' } },
        { id: 'land', anchor: 'panes', title: 'Landscape', before: [['view', 'land'], ['tool', 'select']], wait: 120,
          body: 'The graph of $\\log|F|$ over X: zeros are pits and poles are peaks. Drag to orbit; the panel\'s options set the height and the colouring.',
          touch: 'The graph of $\\log|F|$ over X: zeros are pits and poles are peaks. Drag to orbit, pinch to zoom; the Display key sets the height and the colouring.', deskTouch: "The graph of $\\log|F|$ over X: zeros are pits and poles are peaks. Drag to orbit, pinch to zoom; the panel's options set the height and the colouring.", phoneFine: 'The graph of $\\log|F|$ over X: zeros are pits and poles are peaks. Drag to orbit, scroll to zoom; the Display key sets the height and the colouring.',
          try: { text: 'Drag to orbit.', on: 'view-moved', test: orbit, then: 'Zeros are pits and poles are peaks: $\\pm1$ and $\\pm i$.' } },
        { id: 'sphere', anchor: ['surfaceL', 'sphereKey'], also: ['panes'], title: 'The Riemann sphere', before: [['view', 'phase'], ['surface', 'L', 'sphere'], ['tool', 'select']],
          body: 'Sphere wraps the plane onto the Riemann sphere, with $\\infty$ at the north pole; here $F(\\infty)=1$, neither a zero nor a pole. You can draw on the sphere too.',
          try: { text: 'Drag the sphere to turn it.', on: 'view-moved', test: orbit, ctl: ['panes'], then: '$\\infty$ is the north pole; here $F(\\infty)=1$.' } },
        // (v16.5 UX20; #247: on a desktop Phase key is a toggle in Y's pane head, lit, or behind the head's ⋯ button when
        // the head has no room for it; on a phone, Y is the large plane and its options are in the Display sheet)
        { id: 'key', anchor: ['phaseKey', 'rightOpts'], also: ['paneR'], title: 'Phase key', before: [['view', 'xy'], ['surface', 'L', 'plane'], ['surface', 'R', 'plane'], ['look', { phaseKey: false }], ['plane', 'R'], ['panel', 'sheet', 'display']],
          touch: 'Phase key, in the Display sheet of Y, paints the phase colours of $w$ itself under the images, so a colour of the Phase portrait reads off as a value of $w=F(z)$.', deskTouch: 'Phase key, among the options of Y, paints the phase colours of $w$ itself under the images, so a colour of the Phase portrait reads off as a value of $w=F(z)$.', phoneFine: 'Phase key, in the Display sheet of Y, paints the phase colours of $w$ itself under the images, so a colour of the Phase portrait reads off as a value of $w=F(z)$.',
          body: 'Phase key, among the options of Y, paints the phase colours of $w$ itself under the images, so a colour of the Phase portrait reads off as a value of $w=F(z)$.',
          try: { text: 'Turn on Phase key.', on: 'phase-key', test: (e) => !e || e.on === true, ctl: ['phaseKey'], then: 'Each colour now reads as a value of $w$.' } },
      ],
    },
    {
      // v15 (notes/ui-redesign-2): the cards' pictures, the Inspector, zeros and poles, the planes' menu, shared numbers
      id: 'edit', title: 'Editing the chain', time: '1½ min', rev: 4, scene: 'strip',
      steps: [
        // (v16.1, pictures: the chain shows its cards' pictures for this step, Pictures rather than Names and tall enough;
        // the user's setting comes back when the tour leaves the step, and a note says so when it was changed)
        { id: 'cards', anchor: 'chain', also: ['viewSwitch'], pictures: true, title: 'Cards follow the view', before: [['deform', false], ['view', 'phase'], ['surface', 'L', 'plane']],
          body: 'Each card shows $F_k$, the map up to its step, in the open view: here its phase portrait. So the last card is the main picture, and the row shows how $F$ is built.',
          touch: 'Each step of the chain shows $F_k$, the map up to it, in the open view: here its phase portrait. So the last step is the main picture, and the chain (the steps button under the planes) shows how $F$ is built.', deskTouch: 'Each card shows $F_k$, the map up to its step, in the open view: here its phase portrait. So the last card is the main picture, and the row shows how $F$ is built.', phoneFine: 'Each step of the chain shows $F_k$, the map up to it, in the open view: here its phase portrait. So the last step is the main picture, and the chain (the steps button under the planes) shows how $F$ is built.',
          try: { text: 'Press {3}, or choose Landscape.', touch: 'Choose Landscape.', on: 'view-changed', test: (e) => !e || e.main === 'land', ctl: ['viewLand'], then: 'Each card now shows its own landscape.' } },
        // (on a phone the panel action opens the Editor sheet, with X and Y side by side above it)
        // (v16.5 UX17: on a touch screen the step is the editor's: its title and line say so)
        { id: 'inspector', anchor: 'inspector', also: ['chain'], title: 'The Inspector', titleTouch: 'The editor', before: [['view', 'xy'], ['surface', 'L', 'plane'], ['surface', 'R', 'plane'], ['select', 2], ['panel', 'right']], wait: 120,
          lead: 'The Inspector edits the selected step, here $f_2$.', leadTouch: 'The editor edits the tapped step, here $f_2$.', leadDeskTouch: 'The Inspector edits the selected step, here $f_2$.', leadPhoneFine: 'The editor edits the clicked step, here $f_2$.',
          body: 'The Inspector edits the selected step: its formula in full, a roomy field per coefficient, and ⋯ for the inverse, bypass, move and remove. A step\'s own coefficients carry its index, as $a_2$ here.',
          touch: 'A tapped card opens its editor in the sheet, with X and Y side by side above it, so the image changes as you type. A step\'s own coefficients carry its index, as $a_2$ here.', deskTouch: "The Inspector edits the selected step: its formula in full, a roomy field per coefficient, and ⋯ for the inverse, bypass, move and remove. A step's own coefficients carry its index, as $a_2$ here.", phoneFine: "A clicked card opens its editor in the sheet, with X and Y side by side above it, so the image changes as you type. A step's own coefficients carry its index, as $a_2$ here.",
          // (D1, issue #23: Replace… is the first item of ⋯; the search then replaces this step)
          try: { text: 'In ⋯, choose Replace…, then pick a function.', on: 'step-replaced', test: (e) => !e || e.k === 2, ctl: ['invBtn'], then: 'Only $f_2$ changed; Undo brings the old one back.' } },
        // (v15.2: the Inspector shows how a typed formula is built from catalog steps; split: the offer shows in the tour)
        { id: 'split', anchor: 'splitOffer', also: ['chain'], title: 'A formula in steps', split: true, before: [['scene', 'splitFormula'], ['view', 'xy'], ['surface', 'L', 'plane'], ['surface', 'R', 'plane'], ['select', 1], ['panel', 'right']], wait: 120,
          body: 'This formula is a chain of catalog steps; the Inspector shows how it is built. Split it, and each step gets its own card: the row then shows every transform in turn, and the deformation plays them one by one. Undo brings the formula back.',
          touch: 'This formula is a chain of catalog steps; its editor shows how it is built. Split it, and each step gets its own card: the row then shows every transform in turn, and the deformation plays them one by one. Undo brings the formula back.', deskTouch: 'This formula is a chain of catalog steps; the Inspector shows how it is built. Split it, and each step gets its own card: the row then shows every transform in turn, and the deformation plays them one by one. Undo brings the formula back.', phoneFine: 'This formula is a chain of catalog steps; its editor shows how it is built. Split it, and each step gets its own card: the row then shows every transform in turn, and the deformation plays them one by one. Undo brings the formula back.',
          try: { text: 'Press Split into 3 steps.', touch: 'Tap Split into 3 steps.', on: 'formula-split', ctl: ['splitBtn'], then: 'One card for each transform; undo brings the formula back.' } },
        { id: 'zp', anchor: 'zpCard', also: ['paneL'], title: 'Zeros and poles', before: [['scene', 'zp'], ['view', 'xy'], ['tool', 'select'], ['select', 1], ['panel', 'right']], wait: 120,
          body: 'This step is built from its zeros and poles. Drag one in X, or press Add zero or Add pole for a new one: the map and its image follow. The axes button beside a coefficient picks a value on a small Argand diagram.',
          touch: 'This step is built from its zeros and poles. Drag one in X, or tap Add zero or Add pole for a new one: the map and its image follow.', deskTouch: 'This step is built from its zeros and poles. Drag one in X, or tap Add zero or Add pole for a new one: the map and its image follow. The axes button beside a coefficient picks a value on a small Argand diagram.', phoneFine: 'This step is built from its zeros and poles. Drag one in X, or press Add zero or Add pole for a new one: the map and its image follow.',
          try: { text: 'Drag a zero or a pole.', on: 'zp-moved', ctl: ['tool:select'], then: '$F$ and its image followed the mark.' } },
        { id: 'numbers', anchor: 'params', also: ['panes'], title: 'Numbers', before: [['scene', 'numbers'], ['view', 'phase'], ['select', 1], ['panel', 'right']], wait: 120,
          body: 'Type a new letter such as $a$ in any field, and a slider $a$ appears under Numbers. Here $a$ sets both zeros $\\pm a$ of $F$ and the circle $|z|=a$: drag the slider, and they move together.',
          try: { text: 'Drag the slider of $a$.', on: 'number-changed', ctl: ['paramSlider'], then: 'The zeros $\\pm a$ and the circle $|z|=a$ moved together.' } },
      ],
    },
    {
      // v16 (notes/constructions-v16/SPEC.md 16): circles through three points, following, snapping to crossings
      id: 'construct', title: 'Constructions', time: '1 min', rev: 2, scene: 'construct',
      steps: [
        // (v16.1: the Circle through 3 points tool itself; on a phone the More tools sheet opens with its tile, and once
        // it is picked the More key, which then shows it, is lit)
        { id: 'c3', anchor: 'tool:circle3', also: ['paneL'], live: true, title: 'Circle through three points', before: [['deform', false], ['view', 'xy'], ['surface', 'L', 'plane'], ['surface', 'R', 'plane'], ['plane', 'L'], ['panel', 'sheet', 'tools:construct']],
          body: 'Pick three points: points already on the page, crossings, or empty spots. The circle and its disc follow them.',
          try: { text: 'Choose Circle through 3 points and click $z_0$, $z_1$, $z_2$.', touch: 'Choose Circle through 3 points in More, then tap $z_0$, $z_1$, $z_2$.', deskTouch: 'Choose Circle through 3 points and tap $z_0$, $z_1$, $z_2$.', phoneFine: 'Choose Circle through 3 points in More, then click $z_0$, $z_1$, $z_2$.', on: 'construct-added', test: (e) => !e || e.op === 'circle3', work: ['ctxUndo'], then: 'Its three points are its handles now.' } },
        // (after: the drag needs the circle c3 makes; without it the step is read)
        { id: 'follow', anchor: 'paneL', title: 'It follows its points', before: [['tool', 'select'], ['plane', 'L']],
          lead: 'Drag $z_2$ across the line: the disc changes family.',
          body: 'Drag $z_2$ across the line through $z_0$ and $z_1$: the disc becomes a half-plane, then the outside of the circle. Its image under $1/z$ follows.',
          try: { text: 'Drag $z_2$ across the line.', on: 'construct-family', test: (e) => !e || e.kind === 'halfplane' || e.kind === 'complement', ctl: ['tool:select'], after: 'c3', then: 'Disc, half-plane, outside: one family, and Y followed.' } },
        { id: 'meet', anchor: 'paneL', title: 'Intersections', before: [['plane', 'L'], ['panel', 'sheet', 'tools:draw']],
          body: 'Tools and dragged points snap to points, zeros, crossings and the grid. The Point tool also puts a point on a curve or the unit circle: drag it along, or pull hard to free it. Hold Alt to place freely; Intersect marks a crossing.',
          touch: 'Tools and dragged points snap to points, zeros, crossings and the grid. The Point tool also puts a point on a curve or the unit circle: drag it along, or pull hard to free it. Turn Snap off in the tools sheet to place freely.', deskTouch: 'Tools and dragged points snap to points, zeros, crossings and the grid. The Point tool also puts a point on a curve or the unit circle: drag it along, or pull hard to free it. Intersect marks a crossing.', phoneFine: 'Tools and dragged points snap to points, zeros, crossings and the grid. The Point tool also puts a point on a curve or the unit circle: drag it along, or pull hard to free it. Turn Snap off in the tools sheet to place freely.',
          try: { text: 'Draw a line from a crossing.', on: 'shape-added', test: (e) => !e || !!e.bound, ctl: ['tool:line'], then: 'Its end is tied to the crossing and follows it.' } },
      ],
    },
    {
      id: 'deform', title: 'Deformation', time: '1 min', rev: 3, scene: 'strip',
      steps: [
        { id: 'toggle', anchor: 'deformToggle', also: ['panes'], title: 'Deformation', before: [['view', 'xy'], ['surface', 'L', 'plane'], ['surface', 'R', 'plane'], ['deform', false]],
          body: 'Plays a homotopy $H_t$ from the identity to $F$, step by step, in every view. In X → Y the two panes merge into one plane.',
          try: { text: 'Click it, or press {M}.', touch: 'Tap it.', on: 'deformation-toggled', test: (e) => !e || e.on !== false, advance: true } },
        // (deformation-t: the user's own input on t; the deformation's own loop never sends it)
        { id: 'transport', anchor: 'transport', also: ['panes'], title: 'Play and scrub', before: [['deform', true]],
          body: 'Play, or drag $t$. Each step follows its natural path when it has one (the caption names it): $H_t$ is analytic for every $t$, so angles are kept wherever $H_t\'\\neq0$.',
          try: { text: 'Drag $t$.', on: 'deformation-t', ctl: ['playBtn', 'tSlider'], then: 'Angles are kept wherever $H_t\'\\neq0$.' } },
        { id: 'paths', anchor: 'paths', also: ['panes'], title: 'Paths', before: [['deform', true]],
          body: 'Paths draws $t\\mapsto H_t(z)$ for well-spread points $z$ of X, from $z$ to $F(z)$. Key {P}.',
          touch: 'Paths draws $t\\mapsto H_t(z)$ for well-spread points $z$ of X, from $z$ to $F(z)$.',
          try: { text: 'Click Paths twice, or press {P} twice.', touch: 'Tap Paths twice.', on: 'paths-toggled', count: 2, then: 'Each path runs from $z$ to $F(z)$.' } },
        // (on a phone the order select is in the deformation bar's Steps picker, which the step opens)
        { id: 'order', anchor: 'allAtOnce', also: ['panes'], needs: 'allAtOnce', title: 'All steps at once', before: [['deform', true], ['look', { allAtOnce: false }], ['panel', 'sheet', 'steps']],
          body: 'With two or more steps, choose All at once: every step deforms at the same $t$, so $H_t=H^{(2)}_t\\circ H^{(1)}_t$ with $0\\le t\\le 1$.',
          try: { text: 'Choose All at once.', on: 'order-changed', test: (e) => !e || e.all === true, ctl: ['allAtOnce'], then: 'Both steps now deform at the same $t$.' } },
        // (v16, notes/deform-range/SPEC.md 10.2: the bracket; on a phone the chain bar, where it is drawn)
        { id: 'range', anchor: 'bracketL', also: ['panes'], title: 'Part of the chain', before: [['deform', true], ['look', { allAtOnce: false }], ['range', null]],
          body: 'The bracket over the cards marks the steps that deform. Steps before it act first, in full; steps after it, last. Bracket $f_2$ alone and the Möbius map deforms the half-plane $f_1(X)$: $H_t=G_t\\circ f_1$.',
          try: { text: "Drag the bracket's left end past $f_1$.", touch: "In $f_2$'s ⋯ menu, choose Deformation, then Only $f_2$, inside $F$.", deskTouch: "Drag the bracket's left end past $f_1$.", phoneFine: "In $f_2$'s ⋯ menu, choose Deformation, then Only $f_2$, inside $F$.", on: 'deformation-range', test: (e) => !e || e.a === 2, work: ['card2Menu'], then: 'Only the Möbius map deforms; $f_1$ acts first, in full.' } },
      ],
    },
    {
      id: 'analysis', title: 'Analysis', time: '1½ min', rev: 2, scene: 'roots',
      steps: [
        { id: 'targets', anchor: 'paneR', also: ['paneL'], title: 'Targets and preimages', before: [['deform', false], ['view', 'xy'], ['surface', 'L', 'plane'], ['surface', 'R', 'plane'], ['plane', 'R']],
          lead: 'The target $0$ marks the three cube roots of unity.',
          body: 'Shapes drawn in Y are targets in $w$, and X shades their preimages. The target point $0$ marks the roots of $F(z)=z^3-1$ with their multiplicity, here the three cube roots of unity; the circle $|w|=0.6$ pulls back to three loops around them.',
          try: { text: 'Choose Disc, then drag in Y.', on: 'shape-added', test: (e) => !e || e.plane === 'w', ctl: ['tool:disc'], then: 'X shades its preimage under $F$.' } },
        // (v16.5 UX20; #247: on a desktop the style control is in X's pane head, or behind its ⋯ button, lit then)
        { id: 'cauchy', anchor: ['phaseStyle', 'leftOpts', 'panes'], also: ['panes'], title: 'Cauchy integral', before: [['view', 'phase'], ['surface', 'L', 'plane'], ['look', { phaseStyle: 'cauchy' }], ['tool', 'select']],
          lead: 'Cauchy\'s integral is $F$ inside $\\gamma$ and $0$ outside.',
          body: 'The phase style Cauchy plots $\\frac{1}{2\\pi i}\\oint_\\gamma\\frac{F(\\zeta)}{\\zeta-z}\\,d\\zeta$ over a closed curve $\\gamma$, here the unit circle. It equals $F(z)=z^3-1$ inside and $0$ outside; the three zeros of $F$ lie on $\\gamma$ itself. With several closed curves, the selected one is used.',
          try: { text: 'Drag the circle γ.', touch: 'Tap the circle γ, then drag it.', on: 'shape-moved', ctl: ['tool:select'], then: 'The integral is worked out again as γ moves.' } },
        // (the open popover holds the countdown: it moves on CD_MS after it closes)
        { id: 'integral', anchor: 'paneL', title: 'Integrals', before: [['scene', ['residueZp', 'residue']], ['view', 'xy'], ['tool', 'select'], ['plane', 'L']],
          body: 'Right-click the circle itself and choose $\\oint F\\,dz$: you get the integral, the winding number and the zeros and poles inside. It encloses the pole $i$ of $1/(z^2+1)$, so $\\oint=2\\pi i\\,\\operatorname{Res}_i F=\\pi$.',
          touch: 'Hold the circle itself and choose $\\oint F\\,dz$: you get the integral, the winding number and the zeros and poles inside. It encloses the pole $i$ of $1/(z^2+1)$, so $\\oint=2\\pi i\\,\\operatorname{Res}_i F=\\pi$.',
          try: { text: 'Right-click the circle, then choose $\\oint$.', touch: 'Hold the circle, then choose $\\oint$.', on: 'integral-opened', then: '$\\oint=2\\pi i\\,\\operatorname{Res}_i F=\\pi$.' } },
        // (v15: api.anchor selects the F tile for these names, so the Inspector shows F; on a phone, in the Editor sheet)
        { id: 'domain', anchor: 'domain', also: ['fTile', 'svF'], title: 'Natural domain', before: [['panel', 'right']],
          lead: 'Here $F$ is defined for every $z$ except $\\pm i$.',
          body: 'Select the F tile at the end of the chain, and the Inspector shows where every step is defined. For a typed formula it reads "the formula is defined at $z$": here every $z$ except the poles $\\pm i$.',
          touch: 'Tap the F tile at the end of the chain, and its editor shows where every step is defined. For a typed formula it reads "the formula is defined at $z$": here every $z$ except the poles $\\pm i$.', deskTouch: 'Tap the F tile at the end of the chain, and the Inspector shows where every step is defined. For a typed formula it reads "the formula is defined at $z$": here every $z$ except the poles $\\pm i$.', phoneFine: 'Click the F tile at the end of the chain, and its editor shows where every step is defined. For a typed formula it reads "the formula is defined at $z$": here every $z$ except the poles $\\pm i$.',
          byScene: { residueZp: 'Select the F tile at the end of the chain, and the Inspector shows where every step is defined: here every $z$ except the poles $\\pm i$, written $z\\notin\\{i,-i\\}$.' },
          touchByScene: { residueZp: 'Tap the F tile at the end of the chain, and its editor shows where every step is defined: here every $z$ except the poles $\\pm i$, written $z\\notin\\{i,-i\\}$.' }, deskTouchByScene: { residueZp: 'Tap the F tile at the end of the chain, and the Inspector shows where every step is defined: here every $z$ except the poles $\\pm i$, written $z\\notin\\{i,-i\\}$.' }, phoneFineByScene: { residueZp: 'Click the F tile at the end of the chain, and its editor shows where every step is defined: here every $z$ except the poles $\\pm i$, written $z\\notin\\{i,-i\\}$.' },
          try: { text: 'Click the F tile.', touch: 'Tap the F tile.', on: 'step-selected', test: (e) => !e || e.k === 'F', ctl: ['fTile'], then: 'The Inspector lists where every step is defined.' } },
        { id: 'guarantees', anchor: 'guarantees', also: ['fTile', 'svF'], title: 'Guarantees', before: [['panel', 'right']],
          lead: 'What the chain guarantees: always true when listed.',
          body: 'The F tile names what the chain guarantees. A property is listed only when every step has it and composition keeps it, so it is always true; one not listed is not implied, but may hold. Step by step shows which step brings which.' },
      ],
    },
    {
      id: 'branches', title: 'Branches and inverses', time: '1 min', rev: 3, scene: 'logAnnulus',
      steps: [
        { id: 'cut', anchor: 'paneL', title: 'Branch cuts', before: [['deform', false], ['view', 'xy'], ['surface', 'L', 'plane'], ['surface', 'R', 'plane'], ['tool', 'select'], ['plane', 'L']],
          body: '$\\log z$ needs a cut: the red ray in X is where its values jump by $2\\pi i$. Drag it to move the seam; the sheet $k$ in the Inspector adds $2\\pi i k$.',
          touch: '$\\log z$ needs a cut: the red ray in X is where its values jump by $2\\pi i$. Drag it to move the seam; the sheet $k$ in the step\'s editor adds $2\\pi i k$.', deskTouch: '$\\log z$ needs a cut: the red ray in X is where its values jump by $2\\pi i$. Drag it to move the seam; the sheet $k$ in the Inspector adds $2\\pi i k$.', phoneFine: "$\\log z$ needs a cut: the red ray in X is where its values jump by $2\\pi i$. Drag it to move the seam; the sheet $k$ in the step's editor adds $2\\pi i k$.",
          try: { text: 'Drag the red cut.', on: 'cut-moved', ctl: ['tool:select'], then: 'The seam moved; across it the values jump by $2\\pi i$.' } },
        { id: 'inverse', anchor: ['invBtn', 'chain'], also: ['panes'], title: 'Inverses', before: [['select', 1], ['panel', 'right']],
          body: 'Replace with the inverse, in the step\'s ⋯ menu in the Inspector, replaces a step by its inverse when there is a single-valued one, as $e^z$ is for $\\log z$. When there is none, as for $z^2$, it says why and offers the preimages instead.',
          touch: 'Replace with the inverse, in the ⋯ menu of the step\'s editor, replaces a step by its inverse when there is a single-valued one, as $e^z$ is for $\\log z$. When there is none, as for $z^2$, it says why and offers the preimages instead.', deskTouch: "Replace with the inverse, in the step's ⋯ menu in the Inspector, replaces a step by its inverse when there is a single-valued one, as $e^z$ is for $\\log z$. When there is none, as for $z^2$, it says why and offers the preimages instead.", phoneFine: "Replace with the inverse, in the ⋯ menu of the step's editor, replaces a step by its inverse when there is a single-valued one, as $e^z$ is for $\\log z$. When there is none, as for $z^2$, it says why and offers the preimages instead.",
          try: { text: 'In ⋯, choose Replace with the inverse.', on: 'step-replaced', test: (e) => !e || (e.k === 1 && e.type === 'exp'), ctl: ['invBtn'], then: '$e^z$ undoes $\\log z$ on this sheet.' } },
        { id: 'deriv', anchor: 'paneL', also: ['chain'], title: 'The derivative as a step', before: [['scene', 'deriv'], ['view', 'xy'], ['plane', 'L']],
          lead: 'Here $F=3z^2-3$; the target $0$ marks its zeros $\\pm1$.',
          body: 'A $d/dz$ step differentiates the chain so far: here $F=3z^2-3$, the derivative of $z^3-3z$. The target $0$ marks its zeros $\\pm1$, the critical points of $z^3-3z$.',
          try: { text: 'Double-click the card $d/dz$.', touch: 'Open the chain, tap $d/dz$, then Show alone.', deskTouch: 'Tap the card $d/dz$, then Show alone.', phoneFine: 'Open the chain, click $d/dz$, then Show alone.', on: 'step-focused', test: (e) => !e || e.k === 2, work: ['lens'], ctl: ['card2'], then: 'X and Y are now the derivative\'s input and output.' } },
        // (v16.1: on a phone the All sheets check is in the Display sheet, which opens)
        { id: 'sheets', anchor: ['sheets', 'panes'], also: ['panes'], title: 'All sheets', before: [['scene', 'logSheets'], ['view', 'land'], ['tool', 'select'], ['panel', 'sheet', 'display']], wait: 120,
          body: 'In Landscape, All sheets draws the sheets of a multivalued map instead of its cut principal branch: $\\operatorname{Im}\\log z$ climbs a helicoid around $0$. $\\log z$ has infinitely many sheets, so a window of them is drawn; sheets ± sets its width.',
          try: { text: 'Drag to orbit the helicoid.', on: 'view-moved', test: orbit, ctl: ['panes'], then: 'Each turn round $0$ climbs one sheet, $2\\pi$ higher.' } },
      ],
    },
    {
      // v16.4 (notes/tour-r3/SPEC.md 4): hear, then how, then a closed curve; the sound settings step moved in from
      // Palette and keys. No step plays on arrival: music starts only from the strip's Listen
      id: 'sound', title: 'Sound', time: '1½ min', rev: 2, scene: 'song', needs: 'sound',
      steps: [
        { id: 'song', anchor: 'panes', needs: 'song', act: 'listen', title: 'Grieg on a curve', before: [['deform', false], ['view', 'phase'], ['surface', 'L', 'plane'], ['tool', 'select']],
          body: 'Grieg\'s theme played by a function: along the unit circle $\\arg F$ climbs in steps, one for each note. Listen along walks the circle at an even pace and plays each colour line $\\arg F$ crosses; the branch cut before each downbeat is the drum.',
          try: { text: 'Press ▶ to listen.', touch: 'Tap ▶ to listen.', off: 'Press ▶ to turn sound on and listen.', on: 'listen-ended', test: (e) => !e || ((!!e.piece || !!e.fn) && (!!e.full || e.heard >= Math.min(9, 0.45 * (e.dur || 20)))), then: 'Every note was $\\arg F$ crossing one of its colour lines.' },
          // (v16.5, Hear the function: Listen along plays the function, so the captions are fractions of its duration
          // (capFrac), which is the path's length at 250 px/s and so the zoom's: the cuts, each statement's downbeat, at
          // 0.004, 0.283, 0.503 and 0.782 of the two laps (test/t_seasong.js's path), each 82 ms before its downbeat;
          // |F| is constant: each step is a pair of branch points)
          capFrac: true,
          captions: [[0, 'Each note is a phase line crossed: $\\arg F$ is the pitch.'], [0.2, 'Each step is two branch points, one each side of the circle.'], [0.29, 'The crack is the branch cut. The theme again, faster.'], [0.51, 'The second lap is the same circle: the same notes.']] },
        { id: 'strings', anchor: 'panes', needs: 'zp', hear: true, act: 'sound', title: 'Phase lines are notes', before: [['scene', 'harp'], ['view', 'phase'], ['tool', 'select']],
          body: 'The portrait\'s lines, every $30^\\circ$ of $\\arg F$, are notes a semitone apart, with D where $F>0$. Hear the function plays each line the pointer crosses as a marimba note. Anticlockwise round a zero the scale rises; round a pole it falls.',
          touch: 'The portrait\'s lines, every $30^\\circ$ of $\\arg F$, are notes a semitone apart, with D where $F>0$. Hear the function plays each line your finger crosses as a marimba note. Anticlockwise round a zero the scale rises; round a pole it falls.',
          try: { text: 'Circle the zero $1$, then the pole $-1$.', touch: 'Hold near $1$, slide round it, then round $-1$.', on: 'hear-turn', test: harpUpDown, then: 'A scale up and a scale down: one turn of $\\arg F$ each.' } },
        { id: 'loop', anchor: 'panes', needs: 'zp', act: 'listen', title: 'A loop sings its number', before: [['scene', 'harpLoop'], ['view', 'phase'], ['tool', 'select']],
          body: 'Listen along a closed curve plays the same notes, then sings one note: its winding number $W$, the zeros minus the poles inside. This circle goes once round the zero $1$, so $W=1$, sung as F♯.',
          try: { text: 'Press ▶ to listen.', touch: 'Tap ▶ to listen.', off: 'Press ▶ to turn sound on and listen.', on: 'listen-ended', test: (e) => !e || (!!e.closed && e.W === 1 && !!e.full), then: '$W=1$: one turn of $\\arg F$, sung as F♯.' } },
        { id: 'settings', anchor: ['soundBtn', 'soundBar', 'moreBtn'], needs: 'sound', title: 'Sound settings',
          lead: 'Turn sound, or Hear the function, on or off here.',
          body: 'Sound is on by default: quiet cues confirm what you do, and a closed loop plays its winding number. Turn it off here or with {Shift}{M}. To hear the function, turn it on here: each colour line that $\\arg F$ crosses plays a note.',
          narrow: 'Sound is on by default: quiet cues confirm what you do, and a closed loop plays its winding number. Turn it off in this menu. To hear the function, turn it on there: each colour line that $\\arg F$ crosses plays a note.',
          touch: 'Sound is on by default: quiet cues confirm what you do, and a closed loop plays its winding number. Turn it off here. To hear the function, turn it on here: each colour line that $\\arg F$ crosses plays a note.' },
      ],
    },
    {
      id: 'export', title: 'Export and LaTeX', time: '30 s', rev: 3, scene: null,
      steps: [
        { id: 'figure', anchor: ['exportBtn', 'moreBtn'], title: 'Figures for articles',
          lead: 'A vector figure with an exact caption, or LaTeX.',
          body: 'Export a vector figure of the current view, with a caption that states exactly what is drawn, or copy a LaTeX document with $F$, its natural domain and its guarantees.',
          narrow: 'Export, in this menu, makes a vector figure with a caption that states exactly what is drawn, or a LaTeX document with $F$, its natural domain and its guarantees.' },
        // (v16.1: and the copy button the copy names, in the head of F's Inspector)
        { id: 'formula-tex', anchor: 'composite', also: ['fTile', 'copyTex'], title: 'The formula in LaTeX', before: [['panel', 'right']],
          body: 'With the F tile selected, the Inspector shows $F$ in closed form; the copy button puts its LaTeX on the clipboard.',
          touch: 'With the F tile tapped, its editor shows $F$ in closed form; the copy button puts its LaTeX on the clipboard.', deskTouch: 'With the F tile tapped, the Inspector shows $F$ in closed form; the copy button puts its LaTeX on the clipboard.', phoneFine: 'With the F tile selected, its editor shows $F$ in closed form; the copy button puts its LaTeX on the clipboard.',
          try: { text: 'Press the copy button of $F$.', touch: 'Tap the copy button of $F$.', on: 'tex-copied', ctl: ['copyTex'], then: '$F$\'s LaTeX is on your clipboard.' } },
      ],
    },
    {
      // (v16.5 UX17: keys are for a keyboard: on a touch screen the chapter is not offered, and the tour ends before it)
      id: 'keys', title: 'Palette and keys', time: '30 s', rev: 3, scene: null, desk: true,
      steps: [
        // (the open palette holds the countdown)
        { id: 'palette', anchor: ['palette', 'moreBtn'], title: 'Command palette',
          body: 'Search functions, region formulas, examples and commands with {mod}{K}. Type a formula such as $e^{z^2}$ to add it as a step; a formula that is one catalog function, such as $\\sin z$, adds that function.',
          narrow: 'Search, in this menu, finds functions, formulas, examples and commands. Type a formula such as $e^{z^2}$ to add it as a step; a formula that is one catalog function, such as $\\sin z$, adds that function.',
          try: { text: 'Press {mod}{K}.', touch: 'Open ⋯, then Search.', on: 'palette-opened' } },
        { id: 'help', anchor: ['helpBtn', 'moreBtn'], title: 'Help is here',
          lead: 'The tour by chapter, the guide and every shortcut.',
          body: 'This button opens the tour by chapter, the guide and every shortcut. {?} opens the guide directly.',
          narrow: 'Guided tour, in this menu, starts the tour by chapter; Guide opens the whole guide.' },
      ],
    },
  ];
  // (#442, ux's spec) the steps view's chapter, "Planes". Only under ?view=steps (a property of the page, fixed at its load): there
  // it takes the place of Basics' X and Y steps (x, y, preimages, chain) and of the whole Deformation chapter. Each step puts the
  // view where its task needs it (svPlace) and is done by one of the events the steps view sends
  const SV_ON = (() => { try { return /** @type {any} */ (window).cmwView === 'steps' || new URLSearchParams(location.search).get('view') === 'steps'; } catch (e) { return false; } })();
  const PLANES = {
    id: 'planes', title: 'Planes', time: '2 min', rev: 1, scene: 'strip',
    steps: [
      { id: 'plane', anchor: 'paneL', title: 'One plane at a time', before: [['svPlace', { i: 0, T: -1, scope: 'all', surf: 'plane' }]],
        body: 'The view shows one plane of the chain, here $z$. Its colours come from the colour plane, the dot with the wheel on the thread.',
        try: { text: 'Drag empty space, or scroll to zoom.', touch: 'Drag empty space, or pinch.', on: 'view-moved', test: (e) => !e || e.how !== 'orbit' } },
      { id: 'thread', anchor: 'svStrip', also: ['paneL'], title: 'The thread', before: [['svPlace', { i: 0 }]],
        body: 'Each dot is a plane, $z$, $w_1$, $w_2$; each chip between two dots is a step. ‹ › or ← → glide to the next plane, and the picture deforms along the step.',
        try: { text: 'Press ›, or →.', touch: 'Tap ›, or swipe in from the right edge.', on: 'plane-changed' } },
      { id: 'park', anchor: 'svRing', also: ['svStrip'], title: 'Between two planes', before: [['svPlace', { i: 0 }]],
        body: 'Drag the ring and let go between two dots: the view stays there and shows the step part way. Shift+← → moves a quarter step.',
        try: { text: 'Drag the ring halfway to the next dot.', touch: 'Drag the ring halfway to the next dot.', on: 'thread-parked' } },
      { id: 'colour', anchor: 'svCp', also: ['svStrip'], title: 'The colour plane', before: [['svPlace', { i: 1, T: -1 }]],
        body: 'The colour plane holds the colour wheel. Every plane before it shows the wheel pulled back through the steps. Colour from here, or {C}, makes the shown plane the colour plane.',
        try: { text: 'Press {C}, or Colour from here.', touch: 'Tap the wheel button.', on: 'colour-plane-set' } },
      { id: 'carried', anchor: 'paneL', also: ['svStrip'], title: 'Past the colour plane', before: [['svPlace', { i: 1, T: 1 }]],
        body: 'Planes after it keep its colours: each point carries the colour it had there. The readout names where a point came from.',
        try: { text: 'Press ›, then hover a point.', touch: 'Tap ›, then hold a point and slide.', on: 'probe', test: (e) => !e || !!e.past } },
      { id: 'inside', anchor: 'svScope', title: 'Inside regions', before: [['svPlace', { i: 0, T: -1, scope: 'all' }]],
        body: 'Colour only inside the regions you draw, in every plane: a region and its images keep the same colours through the chain.',
        try: { text: 'Choose Inside regions.', touch: 'Choose Inside regions.', on: 'scope-changed', test: (e) => !e || e.s === 'in' } },
      { id: 'surface', anchor: 'svSurf', title: 'Sphere and Landscape', before: [['svPlace', { i: 0, scope: 'all', surf: 'plane' }]],
        body: 'The same plane on the Riemann sphere, or as a landscape of the modulus. ‹ › glide on the sphere too.',
        try: { text: 'Choose Sphere.', touch: 'Tap the surface button, then Sphere.', on: 'surface-changed', test: (e) => !e || e.s === 'sphere' } },
      { id: 'step', anchor: 'svChip', title: 'Edit a step', before: [['svPlace', { i: 0, surf: 'plane' }]],
        body: 'A chip opens its step in the Inspector: change the function, its parameters or its formula, and every plane after it follows.',
        try: { text: 'Click the chip $f_1$.', touch: 'Tap the chip $f_1$.', on: 'step-selected', test: (e) => !e || e.k === 1 } },
    ],
  };
  if (SV_ON) {
    const chs = /** @type {any[]} */ (CHAPTERS);
    const bi = CHAPTERS.findIndex((c) => c.id === 'basics'), di = CHAPTERS.findIndex((c) => c.id === 'deform');
    if (bi >= 0) chs[bi].steps = chs[bi].steps.filter((/** @type {any} */ st) => !['x', 'y', 'preimages', 'chain'].includes(st.id));
    if (di >= 0) chs.splice(di, 1);
    chs.splice(bi + 1, 0, PLANES);
  }
  // the Phase lines task: a lap up and a lap down (red's line, D, crossed each way: the event hear-turn), whichever
  // point gave which
  function harpUpDown(e, m) {
    if (!e) return true;
    m = m || {};
    if (e.dir > 0) m.up = 1;
    if (e.dir < 0) m.down = 1;
    return !!(m.up && m.down);
  }
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
    // (#442: the steps view's thread, its ring, its Colour from here button, its two choices (a segmented control, or on a phone one
    // button that steps through them) and the first function chip)
    svStrip: '#svStrip', svRing: '#svStrip .sv-thumb', svCp: '#svHead .sv-cp', svScope: '#svHead .sv-scope',
    svSurf: () => vis1('#svHead .sv-surf, #svHead .sv-surf1'), svChip: () => vis1('#svStrip .sv-fchip'), svF: () => vis1('#svStrip .sv-fall'),
    viewSwitch: '#viewSwitch', deformToggle: '#morphBtn', tools: '#secDraw', toolsRail: '#railTools',
    // (v16: the Construct grid under Draw; hidden on a phone, where the tool row's More key leads to it)
    constructTools: () => { const e = document.querySelector('#constructTools'); return e && e.offsetParent ? e : null; },
    formula: '#secFormula', shapes: '#secShapes',
    // (D3: the phone's context bar, while a construction tool is in hand: its Undo pick)
    ctxUndo: () => vis1('.ph-ctx[data-k="construct"] .ph-cb'),
    // ([v17 D4; #247; #363] on the laptop the regions' display is behind Y's Regions button in the pane head: the open
    // popover, or the button; on a phone the Display sheet's section)
    display: () => (document.documentElement.classList.contains('ph') ? document.querySelector('#regionsBox') : document.querySelector('.pat-pop') || document.querySelector('#rightFoot .pat-btn')),
    // (#246: on a phone the chain, its Add tile and F are rows of the chain sheet; while it is closed, its "N steps ▾"
    // button in the chain bar, which opens it)
    chain: '.pipe-wrap', addStep: () => inChainSheet('#addStepBtn'), panes: '#panes', paneL: '#paneL', paneR: '#paneR',
    surfaceL: '#leftTabs', surfaceR: '#rightTabs', transport: '.tdock:not([hidden])', paths: '#pathsBtn', allAtOnce: '#homOrderSel',
    // (v16: the deformation's bracket, its left end; on a phone, where it is drawn only, the chain bar)
    // (#246: on a phone the chain is the chain sheet's; while it is closed, its "N steps ▾" in the chain bar)
    bracketL: () => { const e = document.querySelector('#chainBracket:not([hidden]) .br-end.l'); return e && !document.documentElement.classList.contains('ph') ? e : inChainSheet('#pipeline'); },
    // (v15: the right panel is the Inspector; F's formula, guarantees and domain show there with the F tile selected,
    // which the app's api.anchor does for these names)
    rightPanel: '#rightPanel', composite: '#propsPanel .insp-F .iform', guarantees: '#propsPanel .insp-F .iglist',
    domain: '#propsPanel .insp-F .idom', matrix: '#propsPanel .insp-F details.steps',
    // the editor of the selected zeros-and-poles step (its parameter block is .params.zp)
    zpCard: () => document.querySelector('#propsPanel .insp-step .params.zp'),
    // v15.2: the selected formula step's split offer (how it is built from catalog steps)
    splitOffer: '#propsPanel .insp-step .split-offer:not([hidden])',
    // the Inspector's ⋯ menu of the selected step (Replace with the inverse); the All sheets check of the Landscape options (its label)
    invBtn: () => document.querySelector('#propsPanel .insp-step .ihead .more'),
    sheets: () => { const c = document.querySelector('#sheetsChk'); return c ? c.closest('label') || c : null; },
    // the Sound control of the top bar (the sound round); the Phase key check of Y's options (X → Y, Y on its plane)
    soundBtn: '#soundBtn', soundBar: '#soundPh',
    // the Phase style control of the Phase view's options (Tiles, Plain, …, Cauchy)
    phaseStyle: '#dcSeg',
    // (#247: Y's Phase key is in its head, or behind its ⋯, or, when the head holds no toggle, in the Regions button's
    // pop-up above the regions' options: the check while it is in the page, else the button that holds it)
    phaseKey: () => { const c = document.querySelector('#wKeyChkR'); return c && document.body.contains(c) ? c.closest('label') || c : yOpts(); },
    // Y's Display options button (#247: the head's ⋯, or the Regions button when the toggles are merged into its pop-up),
    // where the Phase key goes when Y's head has no room for it
    rightOpts: () => yOpts(),
    // (v16.5 UX20) X's Display options button (#247: the head's ⋯, when the Phase style or Landscape's options do not fit
    // the head); INTEGRATION.md: the fallback of phaseStyle
    leftOpts: '#leftFoot .opts-btn:not(.pat-btn)',
    // v15: the Inspector's Selection (the selected step's editor), its Parameters (shared numbers), the F tile that
    // closes the chain; on a phone, the Sphere key in the plane's right column
    // (v15.1) the selected step's Show alone button (v16.5 UX85: no longer a lens) in the Inspector's head: in a phone's sheet
    lens: '#propsPanel .insp-step .ihead .alone-btn',
    inspector: '#propsPanel .insp-sel', params: () => document.querySelector('#propsPanel .prm') || document.querySelector('#propsPanel .insp-params'),
    fTile: () => inChainSheet('#pipeline .ftile'), sphereKey: () => [...document.querySelectorAll('.ph-col .ph-sph')].find((e) => e.offsetParent) || null,
    // v16.1 (notes/v16-user5/AS-BUILT-tour.md): the control a step's task needs, exactly. A tool is its own button where
    // it shows: the Draw panel, the collapsed panel's rail, a phone's tool row or its More tools sheet; on a phone a tool
    // outside the row is the More key, which then carries the tool's icon and name
    'tool:disc': toolBtn('disc'), 'tool:select': toolBtn('select'), 'tool:line': toolBtn('line'), 'tool:circle3': toolBtn('circle3'),
    viewPhase: '#viewSwitch > [data-mode="phase"]', viewLand: '#viewSwitch > [data-mode="land"]',
    splitBtn: '#propsPanel .insp-step .split-offer:not([hidden]) .so-btn',
    // the card f₁; the card f₂, whose ⋯ shows on it (on a phone, where a card has none, f₂'s ⋯ in the Editor sheet that
    // a tap on the card opens)
    card1: () => inChainSheet('#pipeline .card[data-k="1"]'),
    card2: () => inChainSheet('#pipeline .card[data-k="2"]'),
    card2Menu: () => (phoneLayout() && vis1('.ph-sheet:not([hidden]) .insp-step[data-k="2"] .ihead .more')) || vis1('#pipeline .card[data-k="2"]'),
    // the slider of the first shared number; the deformation's t slider and Play
    paramSlider: () => vis1('#propsPanel .prm-row input[type="range"]'),
    tSlider: () => vis1('#morphRange'), playBtn: () => vis1('#morphPlay'),
    // F's Copy LaTeX button, in the head of the Inspector with the F tile selected
    copyTex: '#propsPanel .insp-F .ihead .icon-btn',
  };
  // the first visible match of a selector (a control that has a copy elsewhere, hidden in this layout)
  function vis1(sel) { for (const e of document.querySelectorAll(sel)) if (visible(e)) return e; return null; }
  // Y's display options: its ⋯ button, or the Regions button when the toggles are merged into its pop-up (#247)
  function yOpts() { return document.querySelector('#rightFoot .opts-btn:not(.pat-btn)') || document.querySelector('#rightFoot .pat-btn'); }
  // (#246) a control of the chain: itself, or on a phone with the chain sheet closed, the button that opens it
  function inChainSheet(sel) { return !document.documentElement.classList.contains('ph') ? document.querySelector(sel) : vis1(sel) || vis1('.ph-csteps'); }
  const phoneLayout = () => document.documentElement.classList.contains('ph');
  function toolBtn(id) {
    const q = `[data-tool="${id}"]`;
    return () => vis1(`.ph-sheet:not([hidden]) .ph-tile${q}`) || vis1(`#tools > .tool${q}, #constructTools > .tool${q}`) || vis1(`#railTools > .tool${q}`)
      || (phoneLayout() ? vis1('#toolMore > summary') : null);
  }
  // the app's hover tooltip: hidden while it would cover the callout
  const TIP_SEL = '#tip';
  // the app's toasts (an Undo after a delete): the rings are masked off them
  const TOAST_SEL = '#toastHost > *';

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
  // ([#465] the modifier signs and letters the page's faces have (vendor/LOCK.json, t_vendor): u_{k+1} is uₖ₊₁, z^{-n} is
  // z⁻ⁿ; texPlain writes the others as text)
  const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', n: 'ⁿ', z: 'ᶻ', i: 'ⁱ', '-': '⁻', '+': '⁺', '−': '⁻', '(': '⁽', ')': '⁾', j: 'ʲ', k: 'ᵏ', N: 'ᴺ' };
  const SUBS = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉', k: 'ₖ', n: 'ₙ', t: 'ₜ', i: 'ᵢ', '+': '₊', '-': '₋', '−': '₋', '(': '₍', ')': '₎', j: 'ⱼ' };
  // ([#465] a TeX command is read, never shown by its name: a style or a size is dropped (\displaystyle, \left, \bigl),
  // a letter or a sign is its character (\rho, \dots, \cdot), a function's name stays a name (sin, Res), \frac{a}{b} is
  // (a)/(b) at any depth, and any other command keeps only its argument. The characters are the faces' (t_vendor): a
  // sign they lack is written in ASCII (\langle is <, \cup is U))
  const TEX_SIGNS = {
    alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ϵ', varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', varrho: 'ϱ', sigma: 'σ', varsigma: 'ς', tau: 'τ', upsilon: 'υ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
    Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
    sum: 'Σ', prod: '∏', int: '∫', oint: '∮', infty: '∞', partial: '∂', ell: 'ℓ', prime: '′', circ: '∘', cdot: '·', times: '×', ast: '*', star: '*', dagger: '†',
    dots: '…', ldots: '…', cdots: '…', dotsc: '…', dotsb: '…', vdots: '…',
    neq: '≠', ne: '≠', le: '≤', leq: '≤', leqslant: '≤', ge: '≥', geq: '≥', geqslant: '≥', approx: '≈', sim: '~', equiv: '=', propto: '∝', pm: '±', mp: '∓',
    to: '→', rightarrow: '→', leftarrow: '←', mapsto: '↦', Rightarrow: '=>', Leftrightarrow: '<=>', iff: '<=>', implies: '=>',
    in: '∈', notin: '∉', subset: '⊂', subseteq: '⊂', cap: '∩', cup: 'U', setminus: '∖', neg: '¬', lnot: '¬', oplus: '⊕', perp: '⊥', angle: '∠',
    lfloor: '⌊', rfloor: '⌋', lceil: '[', rceil: ']', langle: '<', rangle: '>', lvert: '|', rvert: '|', vert: '|', mid: '|', lVert: '‖', rVert: '‖', Vert: '‖',
    quad: ' ', qquad: ' ', enspace: ' ', thinspace: ' ', medspace: ' ', thickspace: ' ',
  };
  const TEX_NAMES = new Set(['Re', 'Im', 'arg', 'Arg', 'log', 'Log', 'ln', 'exp', 'sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'sinh', 'cosh', 'tanh', 'coth', 'arcsin', 'arccos', 'arctan', 'Res', 'det', 'deg', 'dim', 'gcd', 'max', 'min', 'sup', 'inf', 'lim', 'liminf', 'limsup', 'sgn', 'ker', 'mod', 'bmod', 'pmod']);
  const TEX_DROP = new Set(['displaystyle', 'textstyle', 'scriptstyle', 'scriptscriptstyle', 'left', 'right', 'middle', 'big', 'Big', 'bigg', 'Bigg', 'bigl', 'bigr', 'Bigl', 'Bigr', 'biggl', 'biggr', 'Biggl', 'Biggr', 'limits', 'nolimits', 'mathstrut', 'strut', 'nonumber', 'notag']);
  // a command's argument at i: a balanced group (its inside) or one token
  function texArg(s, i) {
    while (s[i] === ' ') i++;
    if (s[i] === '{') {
      for (let j = i, d = 0; j < s.length; j++) {
        if (s[j] === '\\') { j++; continue; }
        if (s[j] === '{') d++; else if (s[j] === '}' && --d === 0) return { v: s.slice(i + 1, j), end: j + 1 };
      }
      return { v: s.slice(i + 1), end: s.length };
    }
    const m = /^\\(?:[a-zA-Z]+|.)|^[^\s}]/.exec(s.slice(i));
    return m ? { v: m[0], end: i + m[0].length } : null;
  }
  // the commands read (the scripts and the signs \{ \, are read after). A name (Im, log, an \operatorname) is set off
  // by U+0003 marks, so two names written together keep a space between them (\operatorname{Im}\log z: "Im log z",
  // not "Imlog z"); the marks are resolved once the names are read
  function texCmds(s) {
    const wrap = (x) => (/^\w+$/.test(x) ? x : '(' + x + ')');
    let out = '';
    for (let i = 0; i < s.length;) {
      if (s[i] !== '\\') { out += s[i++]; continue; }
      const m = /^\\([a-zA-Z]+)\*?/.exec(s.slice(i));
      if (!m) { out += s.slice(i, i + 2); i += 2; continue; }
      const w = m[1], j = i + m[0].length, a = texArg(s, j);
      if (/^[dtc]?frac$/.test(w) && a) {
        const b = texArg(s, a.end);
        if (b) { out += `${wrap(texCmds(a.v))}/${wrap(texCmds(b.v))}`; i = b.end; continue; }
      }
      if (w === 'binom' && a) {
        const b = texArg(s, a.end);
        if (b) { out += `C(${texCmds(a.v)}, ${texCmds(b.v)})`; i = b.end; continue; }
      }
      if (w === 'sqrt') {
        const n = /^\s*\[([^\]]*)\]/.exec(s.slice(j)), r = texArg(s, n ? j + n[0].length : j);
        if (r) { out += n ? `${wrap(texCmds(r.v))}^{1/${n[1]}}` : `√${wrap(texCmds(r.v))}`; i = r.end; continue; }
      }
      // (\left. and \right. size nothing: the dot goes too)
      if (TEX_DROP.has(w)) { const dot = /^(?:left|right|middle)$/.test(w) && /^\s*\./.exec(s.slice(j)); i = dot ? j + dot[0].length : j; continue; }
      if (TEX_SIGNS[w] != null) { out += TEX_SIGNS[w]; i = j; continue; }
      if (TEX_NAMES.has(w)) { out += '\u0003' + w + '\u0003'; i = j; continue; }
      if (a && (s[j] === '{' || /^(?:bar|overline|hat|tilde|vec|dot|mathbb|mathrm|mathbf|mathcal|boldsymbol)$/.test(w))) {
        // (any other command keeps its argument: \text{…} is its words, \operatorname{Res} a name, \mathbb{C} is ℂ, a
        // bar is the conjugate: z̄, pⱼ*)
        const v = texCmds(a.v);
        out += w === 'operatorname' ? '\u0003' + v + '\u0003' : w === 'mathbb' && (v === 'C' || v === 'Z') ? (v === 'C' ? 'ℂ' : 'ℤ') : w === 'overline' || w === 'bar' ? (/^\p{L}$/u.test(v) ? v + '̄' : wrap(v) + '*') : v;
        i = a.end; continue;
      }
      i = j;   // (a command without an argument that this reader does not know: nothing)
    }
    return out;
  }
  function texPlain(src) {
    let s = texCmds(String(src).replace(/\\\\/g, ' ').replace(/~/g, ' '));
    // a name's mark becomes a space between two letters (Im|log, i|Res), else nothing (sin|(z), log| z, Res|_i)
    s = s.replace(/\u0003+/g, (m, at, all) => (/\p{L}/u.test(all[at - 1] || '') && /\p{L}/u.test(all[at + m.length] || '') ? ' ' : ''));
    // escaped braces are set braces (kept); the others only group
    s = s.replace(/\\\{/g, '\u0001').replace(/\\\}/g, '\u0002');
    s = s.replace(/\\[,;!:]/g, ' ').replace(/\\ /g, ' ');
    const conv = (str, map) => ([...str].every((c) => map[c] != null) ? [...str].map((c) => map[c]).join('') : null);
    // ([#465] a degree, ^\circ, is the degree sign)
    s = s.replace(/\^\{?∘\}?/g, '°');
    // (a single sign first, so a script inside braces is read before its group: z^{2^n} is z^(2ⁿ); what has no modifier
    // form is written in parentheses, as plain text writes it: ^(∞); a lone index without one follows its letter: Φ_M is ΦM)
    s = s.replace(/\^([^\s{(])/g, (m, a) => conv(a, SUP) || m).replace(/_([^\s{(])/g, (m, a) => conv(a, SUBS) || m);
    // ([#465] the innermost group first, so a script inside a script is read before the one around it: e^{w_{1}} is
    // e^(w₁), not e^()w₁)
    const sup = (v) => conv(v, SUP) || '^(' + v + ')', subs = (v) => conv(v, SUBS) || ([...v].length === 1 ? v : '_(' + v + ')');
    for (let k = 0, t = ''; k < 4 && t !== s; k++) { t = s; s = s.replace(/\^\{([^{}]*)\}/g, (m, v) => sup(v)).replace(/_\{([^{}]*)\}/g, (m, v) => subs(v)); }
    // (a bare ^( or _( stays: it is already text, a script written in parentheses)
    s = s.replace(/\^([^\s{(])/g, (m, v) => sup(v)).replace(/_([^\s{(])/g, (m, v) => subs(v));
    s = s.replace(/[{}]/g, '').replace(/\u0001/g, '{').replace(/\u0002/g, '}');
    return s.replace(/\s*([<>=≠≤≥])\s*/g, ' $1 ').replace(/± (?=\w)/g, '±').replace(/\s+/g, ' ').trim();
  }
  function plainCopy(s, mod) {
    return parseCopy(s).map((t) => (t.t === 'tex' ? texPlain(t.v) : t.t === 'kbd' ? (t.v === 'mod' ? mod : t.v) : t.v)).join('');
  }
  // v16.4 (notes/tour-r3/SPEC.md 2): the countdown after a task is done, a pure reducer. state: { phase: 'idle' |
  // 'running' | 'held' | 'cancelled' | 'off' | 'fired', t0 (when the current run started), dur, door, holds: [kinds] }.
  // Events: { type: 'done', door, reduced, off (Move on by itself is off), never (the chapter's last step, a step
  // reached with Back) }, 'hold' / 'release' { kind } (paused while any hold
  // lasts; the last release starts it again from its full length), 'cancel' (no auto for this showing), 'off' (Move on
  // by itself turned off), 'fire'. A door (try.advance) moves on 0.7 s after done (0.3 s with reduced motion), held by
  // nothing; with Move on by itself off it only ticks, like any task (r3 review regress-6). left(state, now): the ms to
  // go while running, else null.
  const CD_MS = 1500;
  const cdInit = () => ({ phase: 'idle', t0: 0, dur: CD_MS, door: false, holds: [] });
  function countdown(st, e, now) {
    const s = st || cdInit();
    const holds = s.holds.slice();
    const out = (o) => Object.assign({}, s, { holds }, o || {});
    switch (e && e.type) {
      case 'done':
        if (s.phase === 'fired') return s;
        if (e.off && (e.door || s.phase === 'idle')) return out({ phase: 'off' });
        if (e.door) return out({ phase: 'running', t0: now, dur: e.reduced ? 300 : 700, door: true });
        if (s.phase !== 'idle') return s;
        if (e.never) return out({ phase: 'cancelled' });
        return out({ phase: holds.length ? 'held' : 'running', t0: now, dur: CD_MS, door: false });
      case 'hold':
        if (!e.kind || holds.includes(e.kind)) return s;
        holds.push(e.kind);
        return s.phase === 'running' && !s.door ? out({ phase: 'held' }) : out();
      case 'release': {
        const k = holds.indexOf(e.kind);
        if (k < 0) return s;
        holds.splice(k, 1);
        return s.phase === 'held' && !holds.length ? out({ phase: 'running', t0: now }) : out();
      }
      case 'cancel':
        return s.door || s.phase === 'fired' ? s : out({ phase: 'cancelled' });
      case 'off':
        return s.door || s.phase === 'fired' || s.phase === 'cancelled' ? s : out({ phase: 'off' });
      case 'fire':
        return s.phase === 'running' ? out({ phase: 'fired' }) : s;
      default:
        return s;
    }
  }
  // the live region's words for the countdown, from CD_MS itself ("Next step in 1.5 s.")
  const nextIn = () => $t('Next step in {n} s.', { n: I18 ? I18.num(CD_MS / 1000) : String(CD_MS / 1000) });
  const cdLeft = (s, now) => (s && s.phase === 'running' ? Math.max(0, s.t0 + s.dur - now) : null);
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
      // (v16.4) Move on by itself (on unless turned off); Why open on a wide screen (null: by the viewport)
      auto: r.auto !== false,
      why: r.why === true || r.why === false ? r.why : null,
      // (#34, UX76) a tour is running: a page that finds this set and no live tour of its own was cut short by a
      // reload or a crash, and offers to continue (stop() clears it)
      open: r.open === true,
    };
  }
  const seenRec = (r) => r.outcome != null || Object.keys(r.done).length > 0 || r.last != null;
  const shouldSuggest = (r) => !seenRec(r) && r.shown < SUGGEST_MAX;
  const chapterDone = (r, ch) => (r.done[ch.id] || 0) >= ch.rev;
  const chapterNew = (r, ch) => r.v > 0 && ch.rev > r.v;

  // ---------------------------------------------------------------- state
  let api = {}, rec = normRec(null), inited = false;
  let run = null;        // the running tour: {chs, ci, si, snap, scene, seq, opener, offs, ui, ...}
  let sugg = null;       // the suggestion card (or, id 'continue', the line that continues a tour cut short)
  let cutShort = false;  // (#34, UX76) init found a tour that a reload or a crash cut short
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
  // (#480) the phone layout (the `ph` class phone.js sets: the controls sit in its sheets and menus), apart from the pointer: place
  // words follow it, gesture words follow coarse(). Where there is no document (the unit tests): the narrow window.
  const layoutIsPhone = () => (typeof document !== 'undefined' && document.documentElement ? phoneLayout() : narrow());
  const isCoarseOf = (o) => (o && o.coarse != null ? o.coarse : coarse());
  const isPhoneOf = (o) => (o && o.phone != null ? o.phone : o && o.narrow != null ? o.narrow : layoutIsPhone());
  // (#480) one of an item's copies by layout and pointer. body (desk layout, fine pointer) and touch (phone layout, coarse
  // pointer) are the two the tour began with; deskTouch (desk, coarse) and phoneFine (phone, fine) are for the items whose
  // words name a place that differs between the layouts ("the Inspector" or "the editor", "Open the chain, then tap").
  // An item without them has gesture words only: a coarse pointer reads its touch copy, a fine one its body.
  const variantOf = (it, base, o, dt = 'deskTouch', pf = 'phoneFine') => {
    const c = isCoarseOf(o), ph = isPhoneOf(o);
    if (c) return (!ph && it[dt]) || it.touch || base;
    return (ph && it[pf]) || base;
  };
  // (v16.5 UX17) a chapter this screen offers: one for the keyboard (desk) is not offered on a touch screen
  const chapterShown = (c) => !(c && c.desk && coarse());
  // where the tour lives: the help button, or the ⋯ menu that holds it on a phone
  // (v15: on a phone the ⋯ sheet lists Guided tour)
  const helpWhere = () => (anchorEl('helpBtn') ? $t('Help') : anchorEl('moreBtn') ? $t('⋯ › Guided tour') : $t('Help'));
  // the copy a step shows here: by the scene shown, on a touch screen, below 640 px, else its body
  function copyFor(step, scene, o = {}) {
    const isCoarse = isCoarseOf(o), isPhone = isPhoneOf(o);
    // (v16.5 UX17; #480: and by layout, as the step's own copies)
    if (scene != null) {
      const tb = isCoarse ? (!isPhone && step.deskTouchByScene && step.deskTouchByScene[scene]) || (step.touchByScene && step.touchByScene[scene]) : isPhone && step.phoneFineByScene && step.phoneFineByScene[scene];
      if (tb) return $t(tb);
    }
    if (step.byScene && scene != null && step.byScene[scene]) return $t(step.byScene[scene]);
    // the anchor found was the ⋯ menu (the control itself lives in it here): the copy that says "in this menu"
    if (o.menu && step.narrow) return $t(step.narrow);
    // (#480) the phone layout's place words ("in this menu") belong to the layout, a touch screen's to the pointer
    if (isCoarse) return $t((!isPhone && step.deskTouch) || step.touch || (isPhone && step.narrow) || step.body);
    return $t((isPhone && (step.phoneFine || step.narrow)) || step.body);
  }
  // (v16.5 UX17) a step's lead and title on a touch screen, where it has its own
  const leadFor = (st, o = {}) => variantOf({ touch: st.leadTouch, deskTouch: st.leadDeskTouch, phoneFine: st.leadPhoneFine }, st.lead, o);
  const tryFor = (t, o = {}) => $t(variantOf(t, t.text, o));
  // (a hint after a wrong attempt: the gesture words of the pointer)
  const hintFor = (t, o = {}) => (t.hint ? (isCoarseOf(o) ? t.hint.touch || t.hint.text : t.hint.text) : null);
  // a step's Try it here (tryWide: not below 640 px, where what it asks for is off-screen)
  // (v16.4, try.after: only when that step's task of the same chapter was done in this run; else the step is read)
  const tryOf = (step) => (step.try && !(step.tryWide && narrow()) && !(step.try.after && !(run && run.doneTasks && run.doneTasks.has(CHAPTERS[run.ci].id + '/' + step.try.after))) ? step.try : null);
  // (v16.1) the controls that complete the step's Try it, while it shows
  const ctlOf = (step) => { const t = tryOf(step); return t && t.ctl ? [].concat(t.ctl) : []; };
  // the parts a Try it's touch task names (try.work), lit on a touch screen
  const workOf = (step) => { const t = tryOf(step); return t && t.work && t.touch && coarse() ? [].concat(t.work) : []; };

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
   and usable; the rings and a phone's Why panel (.tour-top) sit above every app layer, in the top layer while the app
   has one open there (its More menu is a popover). The strip itself is in the page's layout, a hole of the shade */
.tour-root { position: fixed; inset: 0; z-index: 25; pointer-events: none; }
:root.ph .tour-root { z-index: 27; }   /* (v15: above the chain bar, 26; under the More sheet, 28, a layer) */
.tour-top, .tour-top[popover] { position: fixed; inset: 0; z-index: 2147483000; pointer-events: none; width: auto; height: auto; max-width: none; max-height: none; margin: 0; padding: 0; border: 0; background: transparent; overflow: visible; color: inherit; }
.tour-top::backdrop { background: transparent; pointer-events: none; }
.tour-dim { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
.tour-dim .tour-shade { fill: var(--tour-scrim); pointer-events: visiblePainted; cursor: default; }
.tour-dim .tour-ring { fill: none; stroke: var(--accent); stroke-width: 1.5; pointer-events: none; }
.tour-dim .tour-glow { fill: none; stroke: var(--accent); stroke-opacity: 0.22; stroke-width: 7; pointer-events: none; }
.tour-dim .tour-mark { fill: none; stroke: var(--accent); stroke-width: 1.5; stroke-dasharray: 4 3; pointer-events: none; }
/* v15.1 (notes/tour/PHONE.md): on a phone the spotlight of a part inside a scrolling panel (a sheet, the chain) is
   drawn inside that panel, so the panel's own scroll moves it in the same frame as the content (no script follows) */
.tour-dim.tour-host { inset: auto; left: 0; top: 0; width: 1px; height: 1px; overflow: visible; z-index: 2147482000; pointer-events: none; }
/* (the rings fade while something they cannot follow natively moves: a fling of the page, a sliding layer) */
.tour-rings { transition: opacity 160ms linear; }
.tour-rings.moving { opacity: 0; transition: opacity 80ms linear; }
/* (r3 review user-1: once a task is done the spotlight steps aside, so the result can be looked at and touched; the
   next step brings it back) */
.tour-dim { transition: opacity 200ms linear; }
.tour-dim.tour-quiet, .tour-rings.tour-quiet { opacity: 0; transition: opacity 200ms linear; }
.tour-dim.tour-quiet .tour-shade { pointer-events: none; }
/* (v16.4: a lit control smaller than 48 x 48 px pulses its ring once when its step appears; the text is not beside it) */
.tour-rings g.pulse .tour-glow { animation: tour-ring-pulse 900ms var(--ease-out, ease-out) 1; }
@keyframes tour-ring-pulse { 40% { stroke-width: 14px; stroke-opacity: 0.45; } }
.tour-caret { position: absolute; width: 12px; height: 12px; background: var(--surface); border: 1px solid var(--line-strong); rotate: 45deg; }
/* ---- v16.4 (notes/tour-r3/SPEC.md 1): the docked strip, a row the layout makes room for. It covers nothing and never
   moves: the stage's first row on a tablet or a desktop (62 px, plus the step's body while Why is open), a 68 px row
   under a phone's header, or a landscape phone's header itself (48 px). The text block is the Why button. */
.tour-strip {
  position: relative; box-sizing: border-box; display: flex; flex-direction: column; width: 100%; height: 100%; min-width: 0; overflow: hidden;
  background: var(--surface); border: 1px solid var(--line); border-radius: 8px;
  color: var(--ink); font: var(--t-body); text-align: left; overflow-wrap: break-word;
}
/* (a desktop's slot holds the strip and the 8 px gap above the panes) */
#tourSlot:has(> .tour-strip[data-mode="desk"]) { padding-bottom: 8px; box-sizing: border-box; }
.tour-strip[data-mode="port"], .tour-strip[data-mode="row"] { border-width: 0 0 1px; border-radius: 0; }
.tour-strip[data-mode="head"] { border: 0; border-left: 1px solid var(--line); border-radius: 0; background: transparent; }
.ts-row { flex: 0 0 auto; display: flex; align-items: center; gap: 8px; min-width: 0; height: 60px; padding: 0 8px; box-sizing: border-box; }
/* (#34 T1) a laptop's row is 52 px: Back, the title with its count ("5/10 ▾", the chapters' menu) over the task, then Skip or
   Next and ×. The text block is plain text there, so its two lines sit on the row's own grid beside the count */
.tour-strip[data-mode="desk"] .ts-row { display: grid; grid-template-columns: auto auto auto minmax(0, 1fr) auto auto auto; grid-template-rows: 18px 18px; align-content: center; column-gap: 8px; row-gap: 1px; height: 52px; padding: 0 8px 0 4px; }
.tour-strip[data-mode="desk"] .ts-text { display: contents; }
.tour-strip[data-mode="desk"] .ts-l1 { grid-column: 2; grid-row: 1; }
.tour-strip[data-mode="desk"] .ts-chap { grid-column: 3; grid-row: 1; margin-left: -4px; }
.tour-strip[data-mode="desk"] .ts-l2 { grid-column: 2 / 5; grid-row: 2; font: 400 13px/18px var(--f-ui); color: var(--ink); }
.tour-strip[data-mode="desk"] .ts-back { grid-column: 1; grid-row: 1 / 3; }
.tour-strip[data-mode="desk"] .ts-act { grid-column: 5; grid-row: 1 / 3; }
.tour-strip[data-mode="desk"] .ts-next { grid-column: 6; grid-row: 1 / 3; }
.tour-strip[data-mode="desk"] .ts-x { grid-column: 7; grid-row: 1 / 3; }
.tour-strip[data-mode="port"] .ts-row { height: 67px; padding: 0 8px 0 4px; }
.tour-strip[data-mode="port"] .ts-text { padding: 2px 6px; gap: 0; }
.tour-strip[data-mode="head"] .ts-row, .tour-strip[data-mode="row"] .ts-row { height: 47px; padding: 0 4px 0 8px; }
.ts-text {
  flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; justify-content: center; gap: 1px;
  margin: 0; padding: 4px 6px; background: none; border: 0; border-radius: var(--r-2, 4px); color: var(--ink); font: inherit; text-align: left; cursor: pointer;
}
.ts-text:hover { background: var(--well, transparent); }
.ts-text:focus-visible, .tour-strip button:focus-visible, .ts-why button:focus-visible, .ts-why input:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.ts-l1 { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
.ts-title { flex: 0 1 auto; min-width: 0; margin: 0; font: 600 13px/18px var(--f-ui); color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tour-strip[data-mode="desk"] .ts-count { display: none; }
.ts-chap { flex: 0 0 auto; align-self: center; display: inline-flex; align-items: center; gap: 3px; height: 24px; min-height: 24px; margin: 0; padding: 0 4px; border: 0; border-radius: var(--r-2, 4px); background: none; color: var(--muted); font: 500 12px/18px var(--f-ui); white-space: nowrap; cursor: pointer; }
.ts-chap:hover { color: var(--ink); background: var(--well, transparent); }
.ts-chap[hidden] { display: none; }
.ts-chap svg { width: 12px; height: 12px; }
.ts-chap[aria-expanded="true"] svg { rotate: 180deg; }
.ts-count { flex: 0 0 auto; font: 400 12px/18px var(--f-ui); color: var(--muted); white-space: nowrap; }
.ts-chev { display: none; flex: 0 0 auto; color: var(--accent); }
.ts-chev svg { width: 12px; height: 12px; vertical-align: -2px; transition: rotate var(--t-fast, 120ms) var(--ease-out, ease-out); }
.ts-text[aria-expanded="true"] .ts-chev svg, .ts-text[aria-expanded="true"] .ts-tdn svg { rotate: 180deg; }
/* a laptop's text block is plain text (the explanation went with Details); a phone's opens its sheet */
.ts-text.inert { cursor: default; pointer-events: none; }
.ts-tdn svg { width: 11px; height: 11px; vertical-align: -1px; color: var(--accent); transition: rotate var(--t-fast, 120ms) var(--ease-out, ease-out); }
.ts-l2 { display: flex; align-items: flex-start; gap: 6px; min-width: 0; font: 400 13px/17px var(--f-ui); color: var(--ink-2); }
.ts-lead { flex: 1 1 auto; min-width: 0; text-wrap: pretty; }
.ts-lead:has(mjx-container) { padding-bottom: 2px; } /* an inline formula (sized in ex) stands a pixel or two below the line: the lead's box holds it */
.ts-tin { display: none; font-weight: 600; color: var(--ink); }
.ts-lead mjx-container { font-size: 104% !important; color: var(--ink); }
.ts-ring { flex: 0 0 13px; width: 13px; height: 13px; margin-top: 2px; border-radius: 50%; border: 1.5px solid var(--accent); box-sizing: border-box; display: grid; place-items: center; }
.ts-ring[hidden] { display: none; }
.ts-ring svg { width: 9px; height: 9px; opacity: 0; transform: scale(0.6); transition: opacity var(--t-med, 200ms) var(--ease-out, ease-out), transform var(--t-med, 200ms) var(--ease-out, ease-out); }
.ts-l2.done .ts-ring { border-color: transparent; }
.ts-l2.done .ts-ring svg { opacity: 1; transform: none; width: 14px; height: 14px; color: var(--ok, #2d7a4b); stroke-width: 2.4; }
.ts-l2.caption .ts-ring { border-style: dotted; }
.ts-l2.pulse { animation: tour-nudge 320ms var(--ease-std, ease); }
@keyframes tour-nudge { 30% { translate: 0 -3px; } 60% { translate: 0 1px; } }
/* a phone: the title and the count above two lines of lead; a landscape phone: the title in bold at the lead's start */
.tour-strip[data-mode="head"] .ts-l1, .tour-strip[data-mode="row"] .ts-l1 { display: none; }
.tour-strip[data-mode="head"] .ts-tin, .tour-strip[data-mode="row"] .ts-tin { display: inline; }
.tour-strip[data-mode="head"] .ts-l2, .tour-strip[data-mode="row"] .ts-l2 { font: 400 13px/16px var(--f-ui); color: var(--ink); }
.tour-strip[data-mode="head"] .ts-text, .tour-strip[data-mode="row"] .ts-text { padding: 2px 4px; }
/* (r3 review user-7: a phone's text block shows that it opens: a chevron after the count) */
.tour-strip[data-mode="port"] .ts-chev { display: inline; }
/* (v16.5 UX93: the count and its chevron closer, so «Добро пожаловать» is whole on a 360 px phone) */
.tour-strip[data-mode="port"] .ts-l1 { gap: 6px; }
.tour-strip[data-mode="port"] .ts-chev { margin-left: -3px; }
/* (r3 review user-3, user-10: a chapter whose line needs three lines here gets a taller row) */
.tour-strip[data-mode="port"][data-lines="3"] .ts-row { height: 75px; }
.tour-strip[data-mode="row"][data-lines="3"] .ts-row { height: 55px; }
/* (#553) four lines of lead, where a long language at 360 px needs them: a line (17 px, 16 in the landscape row) more */
.tour-strip[data-mode="port"][data-lines="4"] .ts-row { height: 92px; }
.tour-strip[data-mode="row"][data-lines="4"] .ts-row { height: 71px; }
/* the buttons: 32 px with a mouse, 44 px on a touch screen or a phone, 8 px apart */
.tour-strip .ts-btn { flex: 0 0 auto; width: 32px; height: 32px; min-width: 32px; min-height: 32px; }
.tour-strip .ts-btn[hidden], .tour-strip .ts-act[hidden] { display: none !important; }
.tour-strip .ts-act { flex: 0 0 auto; height: 32px; min-height: 32px; min-width: 32px; padding: 0 12px; gap: 6px; white-space: nowrap; }
.tour-strip .ts-act svg { width: 14px; height: 14px; flex: 0 0 14px; }
.tour-strip .ts-next { flex: 0 0 auto; position: relative; isolation: isolate; overflow: hidden; height: 32px; min-height: 32px; min-width: 64px; max-width: 220px; padding: 0 14px; white-space: nowrap; text-overflow: ellipsis; }
.tour-strip .ts-next { transition: none; }  /* Skip and Next swap in place; no fade between their two looks */
.tour-strip .ts-next.ready { box-shadow: inset 0 0 0 2px var(--accent-ink); }
/* (#34 T1) Next is earned: while the step's task is open the button is a quiet outlined Skip */
/* (Skip keeps its outlined look under :hover and :active, which the shared .btn.primary rules would fill with the accent: on a touch screen :hover stays on the button just tapped, which was Next a step ago; only a mouse gets the hover shade) */
.tour-strip .ts-next.skip, .tour-strip .ts-next.skip:not(:disabled):hover, .tour-strip .ts-next.skip:not(:disabled):active { background: var(--surface); color: var(--muted); border: 1px solid var(--line-strong); }
@media (hover: hover) { .tour-strip .ts-next.skip:not(:disabled):hover { color: var(--ink); background: var(--well, var(--surface)); } }
/* (r3 verify-1: while the countdown runs, the ring leaves out its bottom edge; the bar below is that edge, filling in) */
.tour-strip .ts-next.ready.counting { box-shadow: inset 0 2px var(--accent-ink), inset 2px 0 var(--accent-ink), inset -2px 0 var(--accent-ink); }
/* the countdown (r3 review user-4): a bar along Next's bottom edge in Next's own label colour, so it stands off the
   button as the label does, growing from left to right over the countdown (CD_MS); restarted with the countdown, frozen while held */
.tour-strip .ts-next::before { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 3px; z-index: -1; background: var(--accent-ink); transform-origin: 0 50%; transform: scaleX(0); }
.tour-strip .ts-next svg { width: 18px; height: 18px; display: block; }
.tour-strip .ts-ncount { font: 600 15px/1 var(--f-ui); }
.tour-strip .ts-next.counting::before { animation: tour-fill var(--tour-cd, 1500ms) linear forwards; }
.tour-strip .ts-next.counting.held::before { animation-play-state: paused; }
@keyframes tour-fill { to { transform: scaleX(1); } }
@media (pointer: coarse) {
  .tour-strip .ts-btn { width: 44px; height: 44px; min-width: 44px; min-height: 44px; }
  .tour-strip .ts-act, .tour-strip .ts-next { height: 44px; min-height: 44px; }
  .tour-strip .ts-act { min-width: 44px; }
  .tour-strip .ts-next::before { height: 4px; }
}
.tour-strip:not([data-mode="desk"]) .ts-btn { width: 44px; height: 44px; min-width: 44px; min-height: 44px; }
.tour-strip:not([data-mode="desk"]) .ts-next { width: 44px; height: 44px; min-width: 44px; max-width: 44px; min-height: 44px; padding: 0; display: inline-grid; place-items: center; }
.tour-strip:not([data-mode="desk"]) .ts-next::before { height: 4px; }
.tour-strip:not([data-mode="desk"]) .ts-act { width: 44px; height: 44px; min-width: 44px; padding: 0; justify-content: center; }
.tour-strip:not([data-mode="desk"]) .ts-act > span { display: none; }
/* (r3 review user-7, verify-2: × stays in a phone's portrait row and in the landscape row under the header; in the
   header it shows when the header has 52 px more than the strip needs (.ts-xok), else it is in Why) */
.tour-strip[data-mode="head"]:not(.ts-xok) .ts-x { display: none; }
.tour-strip[data-mode="head"] .ts-back, .tour-strip[data-mode="row"] .ts-back { display: none; }
/* (r3 review user-3: in a phone's portrait row the act button takes Back's place, which is in Why, so the line keeps
   its width while the Grieg captions play) */
.tour-strip[data-mode="port"].has-act .ts-back { display: none; }
/* Why: the step's body. Inline under the row on a tablet or a desktop (the strip grows; the panes shrink); on a phone a
   panel that hangs under the strip, over X, at most half the screen, opened only by a tap */
.ts-why { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; box-sizing: border-box; padding: 0 16px 10px 58px; font: 400 13px/19px var(--f-ui); color: var(--ink-2); }
.ts-why[hidden] { display: none; }
.ts-why .ts-foot { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; margin-top: 8px; }
.ts-why .ts-auto { display: inline-flex; align-items: center; gap: 6px; min-height: 28px; font: 400 12px/16px var(--f-ui); color: var(--ink-2); cursor: pointer; }
.ts-why .ts-auto input { margin: 0; width: 16px; height: 16px; accent-color: var(--accent); }
.ts-why .ts-wend { display: none; }
.tour-top .ts-why.ts-panel {
  position: fixed; left: 0; right: 0; top: 0; max-height: 50vh; max-height: 50dvh; padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
  background: var(--surface); border-bottom: 1px solid var(--line-strong); box-shadow: var(--shadow-3); pointer-events: auto;
  font-size: 13px; line-height: 20px;
}
.tour-top .ts-why.ts-panel .ts-wend { display: flex; gap: 8px; }
.tour-top .ts-why.ts-panel .ts-wend .btn { min-height: 44px; padding: 0 14px; }
.tour-top .ts-why.ts-panel .ts-auto { min-height: 44px; font-size: 13px; }
.tour-top .ts-why.ts-panel .ts-auto input { width: 20px; height: 20px; }
.tour-top .ts-why.ts-panel .ts-wtitle { display: block; margin: 0 0 4px; font: 600 15px/20px var(--f-ui); color: var(--ink); }
.ts-wtitle { display: none; }
.tour-sr { position: absolute; top: 0; left: 0; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
/* (v16.5 UX21) the learning lane: one line in the tour's docked slot (the first-run invitation, an example's Try
   line). It sits in the layout like the strip and covers nothing: a 48 px row at the stage's top on a desktop (plus the
   8 px gap), a 56 px row under a phone's header, a landscape phone's header when it has room */
.tour-lane {
  position: relative; box-sizing: border-box; display: flex; align-items: center; gap: 10px; width: 100%; height: 100%; min-width: 0; padding: 0 6px 0 10px;
  background: var(--surface); border: 1px solid var(--line-strong); border-radius: var(--r-3, 4px); color: var(--ink); font: var(--t-body);
  animation: fade-in var(--t-med, 200ms) var(--ease-out, ease-out);
}
#tourSlot:has(> .tour-lane[data-mode="desk"]) { padding-bottom: 8px; box-sizing: border-box; }
.tour-lane[data-mode="port"], .tour-lane[data-mode="row"] { border-width: 0 0 1px; border-radius: 0; padding: 0 4px 0 8px; gap: 8px; }
.tour-lane[data-mode="head"] { border: 0; border-left: 1px solid var(--line); border-radius: 0; background: transparent; padding: 0 2px 0 8px; gap: 6px; }
:root.ph.ph-land .stage > #tourSlot > .tour-lane[data-mode="row"] { position: fixed; left: 0; right: 0; top: calc(env(safe-area-inset-top, 0px) + var(--ph-head)); width: auto; height: var(--ph-tour, 48px); }
.tl-mark { flex: 0 0 24px; width: 24px; height: 24px; }
.tl-mark svg { width: 24px; height: 24px; display: block; }
.tour-lane:not([data-mode="desk"]) .tl-mark { display: none; }
.tl-text { flex: 1 1 auto; min-width: 0; margin: 0; font: 400 13px/17px var(--f-ui); color: var(--ink-2); display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; text-wrap: pretty; }
.tour-lane.grow .tl-text { -webkit-line-clamp: 4; line-clamp: 4; }
.tour-lane[data-mode="desk"]:not(.two) .tl-text { -webkit-line-clamp: 1; line-clamp: 1; display: block; white-space: nowrap; text-overflow: ellipsis; }
.tl-title { font-weight: 600; color: var(--ink); }
.tl-acts { flex: 0 0 auto; display: flex; align-items: center; gap: 6px; }
.tour-lane .tl-act { height: 32px; min-height: 32px; padding: 0 12px; white-space: nowrap; }
.tour-lane .tl-x { width: 32px; height: 32px; }
.tour-lane .tl-short { display: none; }
@media (pointer: coarse) { .tour-lane .tl-act { height: 44px; min-height: 44px; } .tour-lane .tl-x { width: 44px; height: 44px; } }
.tour-lane:not([data-mode="desk"]) .tl-act { height: 44px; min-height: 44px; padding: 0 10px; }
.tour-lane:not([data-mode="desk"]) .tl-x { width: 44px; height: 44px; }
.tour-lane:not([data-mode="desk"]) .tl-long { display: none; }
.tour-lane:not([data-mode="desk"]) .tl-short { display: inline; }
.tour-lane .tl-text mjx-container { color: var(--ink); }
/* the help menu (the app's menu component, plus a chapter row) */
.pop.menu.tour-menu { min-width: 264px; }
.tour-menu .mi { gap: 10px; }
.tour-menu .tour-num { flex: 0 0 16px; font: var(--t-readout); color: var(--faint); text-align: right; }
.tour-menu .tour-time { font: 400 11px/16px var(--f-mono); color: var(--faint); }
.tour-menu .tour-done { flex: 0 0 14px; width: 14px; height: 14px; color: var(--good); }
.tour-menu .tour-done svg { width: 14px; height: 14px; display: block; }
.tour-menu .tour-new { font: var(--t-caption); font-stretch: var(--ui-narrow-stretch); font-variation-settings: var(--ui-narrow-var); color: var(--accent); }
.tour-menu .mi.tour-continue { height: auto; min-height: 40px; padding-top: 4px; padding-bottom: 4px; white-space: normal; }
.tour-menu .tour-sub { display: block; font: 400 11px/16px var(--f-ui); color: var(--muted); }
@media (prefers-reduced-motion: reduce) { .ts-ring svg, .ts-chev svg, .ts-tdn svg, .tour-dim, .tour-dim.tour-quiet { transition: none; } .ts-l2.pulse, .tour-lane, .tour-rings g.pulse .tour-glow, .tour-strip .ts-next.counting::before { animation: none; } .tour-strip .ts-next::before { display: none; } }
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
  // a laptop's keyboard steps the tour (→ forward, ← back): the strip shows the key; a touch screen has none to show
  const keyHints = () => { try { return !matchMedia('(pointer: coarse)').matches; } catch (e) { return true; } };
  const ICON_X = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>';
  const ICON_LEFT = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M10 4l-4 4 4 4"/></svg>';
  const ICON_DOWN = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l4 4 4-4"/></svg>';
  const ICON_RIGHT = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>';
  const ICON_CHECK = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-7"/></svg>';
  const ICON_PLAY = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="currentColor"><path d="M5 3.5v9l7.5-4.5z"/></svg>';
  const ICON_STOP = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="currentColor"><rect x="4" y="4" width="8" height="8" rx="1"/></svg>';
  const ICON_SOUND = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6h2.5l3.5-3v10l-3.5-3h-2.5z"/><path d="M11 5.5a3.5 3.5 0 0 1 0 5M12.8 3.8a6 6 0 0 1 0 8.4"/></svg>';
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
    // v16.4: the strip (notes/tour-r3/SPEC.md 1.1). Row: Back, the text block (the title, the chapter's count, Why, and
    // the lead line: a caption, the result, the task or the lead), the act button, Next, × End; under it, Why
    const back = el('button', { class: 'icon-btn ts-btn ts-back', type: 'button', 'aria-label': $t('Back'), title: $t('Back') + (keyHints() ? '  ←' : '') });
    back.innerHTML = ICON_LEFT;
    const title = el('span', { class: 'ts-title', id: 'tourTitle' });
    const count = el('span', { class: 'ts-count' });
    const ringI = el('span', { class: 'ts-ring', 'aria-hidden': 'true', hidden: true });
    ringI.innerHTML = ICON_CHECK;
    const tin = el('span', { class: 'ts-tin', 'aria-hidden': 'true' });
    const lead = el('span', { id: 'tourLead' });
    const l2 = el('span', { class: 'ts-l2' }, ringI, el('span', { class: 'ts-lead' }, tin, lead));
    const chev = el('span', { class: 'ts-chev', 'aria-hidden': 'true' });
    chev.insertAdjacentHTML('beforeend', ICON_DOWN);
    const text = el('button', { class: 'ts-text', type: 'button', 'aria-describedby': 'tourTitle tourLead' },
      el('span', { class: 'ts-l1' }, title, count, chev), l2);
    // the chapter menu: on a wide strip the chapter and its count are a button that lists the chapters (done ones checked)
    const chap = el('button', { class: 'ts-chap', type: 'button', 'aria-haspopup': 'menu', 'aria-expanded': 'false', hidden: true }, el('span', { class: 'ts-chapl' }));
    chap.insertAdjacentHTML('beforeend', ICON_DOWN);
    chap.addEventListener('click', () => openHelpMenu(chap, 'chapters'));
    const act = el('button', { class: 'btn ts-act', type: 'button', hidden: true });
    const next = el('button', { class: 'btn primary ts-next', type: 'button' }, $t('Next'));
    const x = el('button', { class: 'icon-btn ts-btn ts-x', type: 'button', 'aria-label': $t('End the tour'), title: $t('End the tour') + '  Esc' });
    x.innerHTML = ICON_X;
    // (#34 T1: Move on by itself is in the chapter menu on a laptop, and in the sheet below on a phone)
    const row = el('div', { class: 'ts-row' }, back, text, chap, act, next, x);
    // the phone's sheet (a panel in the tour's top layer): the step's title, Move on by itself, Back and × End the tour,
    // which the narrow row has no room for
    const wtitle = el('span', { class: 'ts-wtitle', 'aria-hidden': 'true' });
    const autoC = el('input', { type: 'checkbox' });
    const autoL = el('label', { class: 'ts-auto' }, autoC, el('span', null, $t('Move on by itself')));
    const wBack = el('button', { class: 'btn ghost', type: 'button' }, $t('Back'));
    const wEnd = el('button', { class: 'btn ghost', type: 'button' }, $t('End the tour'));
    const wend = el('span', { class: 'ts-wend' }, wBack, wEnd);
    const why = el('div', { class: 'ts-why', id: 'tourWhy', hidden: true, 'data-tour': 'why' }, wtitle, el('div', { class: 'ts-foot' }, autoL, wend));
    const strip = el('section', { class: 'tour-strip', role: 'region', 'aria-label': $t('Guided tour'), 'data-tour': 'strip' }, row, why);
    // the safe-area insets, read from a probe (env() has no script API)
    const safeP = el('div', { 'aria-hidden': 'true', style: 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)' });
    top.append(safeP);
    document.body.append(root, top);
    return { root, top, svg, rsvg, ringG: g, shade, glow, ring, mark: markP, maskEl, maskRect, maskHoles, live, strip, row, back, text, chap, title, count, l2, ringI, tin, lead, act, next, x, why, wtitle, autoC, wBack, wEnd, safeP,
      holes: null, raf: 0, anim: null, motion: 0, topSet: [], hosts: new Map(), hostOk: new Map(), work: [], moveT: 0, mode: null, whyOpen: false };
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
  function liveElsewhere() {
    try { const live = JSON.parse(localStorage.getItem(sk(LIVE)) || 'null'); return !!(live && live.page !== PAGE && Date.now() - live.t < BEAT_STALE); } catch (e) { return false; }
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
    laneHide(null, false);
    closeMenu(false);
    const ci = chapterIndex(opt.chapter);
    // a chapter started from inside a running tour (its help step lights the help button): the snapshot taken when the
    // first tour began stays, and the app is not told that the tour ended and began again
    let lend = null, opener = opt.opener || null;
    const prev = run;
    if (prev) { lend = prev.lend; opener = opener || prev.opener; stop({ silent: true, keepWork: true }); }
    else lend = borrow();
    if (!opener) opener = document.activeElement !== document.body ? document.activeElement : null;
    const r = { ci, si: 0, lend, snap: lend ? lend.snap : null, scenes: !!lend, scene: undefined, sceneOk: {}, seq: 0, opener, offs: [], tryOffs: [], skipped: new Set(), why: new Map(), absent: new Set(), ui: null, el: null, step: null, dir: 1, timer: 0, tracked: null,
      doneTasks: new Set(), cd: cdInit(), cdT: 0, capT: [], caption: null, done: false };
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
    // (r3 review regress-7: the root's style attribute as it was before the tour, so its end leaves none it did not find;
    // a chapter started inside a running tour keeps the first run's)
    r.rootStyle = prev ? prev.rootStyle : document.documentElement.getAttribute('style');
    run = r;
    // (v16.4: the strip is mounted and sized before the first scene loads, which fits its view to the panes' size; the
    // phone's sheet starts folded)
    r.ui.whyOpen = false;
    r.ui.why.hidden = true;
    mountStrip(r);
    sizeDesk(r);
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
    const inStrip = (t) => !!t && t.nodeType === 1 && (ui.strip.contains(t) || ui.why.contains(t));
    ui.next.addEventListener('click', () => { if (run === r) go(1); });
    // (Back during the countdown cancels it; the step it reaches does not move on by itself)
    const back = () => { if (run !== r) return; cdFeed(r, { type: 'cancel' }); go(-1); };
    ui.back.addEventListener('click', back);
    ui.wBack.addEventListener('click', back);
    const end = () => { if (run === r) stop({ finished: lastOfChapter(r) }); };
    ui.x.addEventListener('click', end);
    ui.wEnd.addEventListener('click', end);
    // a press on the text block opens or closes Why, and cancels this showing's countdown (the user is reading)
    // (v16.5 UX89: a tap that closes an open layer, the function list say, does nothing else: it neither opens Details
    // nor stops the countdown)
    const openLayers = () => { try { return [...document.querySelectorAll('#popHost > .pop, .modal-bg, .ph-sheet:not([hidden]), [popover]:popover-open:not([data-tour])')]; } catch (e) { return []; } };
    const onDownL = () => { ui.downLayers = openLayers(); ui.downT = performance.now(); };
    document.addEventListener('pointerdown', onDownL, true);
    r.offs.push(() => document.removeEventListener('pointerdown', onDownL, true));
    const closedByTap = () => { const was = ui.downLayers || [], now = openLayers(); ui.downLayers = null; return performance.now() - (ui.downT || 0) < 1500 && was.some((x) => !now.includes(x)); };
    ui.text.addEventListener('click', () => { if (run !== r || !ui.whyPanel) return; if (closedByTap()) return; cdFeed(r, { type: 'cancel' }); setWhy(r, !ui.whyOpen); });
    ui.act.addEventListener('click', () => { if (run === r) actPress(r); });
    ui.autoC.addEventListener('change', () => { if (run === r) setAuto(ui.autoC.checked); });
    ui.shade.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); nudge(); });
    const onKey = (e) => {
      if (run !== r || e === fwdKey) return;
      const a = document.activeElement, inS = inStrip(a);
      const idle = a === document.body || a == null || inS;
      if (e.key === 'Escape') {
        // The app's own layer comes first, wherever the focus is: a menu, the palette or a dialog closes and the tour
        // stays. Then Escape in the strip ends the tour. Elsewhere the app's own Escape comes first: a field being
        // typed in, and whatever the app reports busy (a drawing, a drag, a selection, an open drawer, a Listen along).
        // Only when the app has nothing to cancel does Escape end the tour; a phone's open Why panel folds first
        if (appLayerOpen()) { if (inS) escToLayer(e); return; }
        if (ui.whyOpen && ui.whyPanel) { e.preventDefault(); e.stopPropagation(); setWhy(r, false); return; }
        if (!inS) {
          if (a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable)) return;
          if (appBusy()) return;
        }
        e.preventDefault(); e.stopPropagation(); stop({}); return;
      }
      // arrows step the tour when the focus is in the strip or nowhere (Enter stays the app's: it closes a polygon)
      if (!idle || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (a && a.tagName === 'INPUT' && a.type !== 'checkbox') return;
      if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); go(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); cdFeed(r, { type: 'cancel' }); go(-1); }
    };
    document.addEventListener('keydown', onKey, true);
    r.offs.push(() => document.removeEventListener('keydown', onKey, true));
    // (SPEC 2.2) on a phone a touch in the work area folds an open Why panel, and the touch goes on to the app. The
    // countdown ignores the pointer: it runs CD_MS from the event whatever the user does next
    const onDown = (e) => {
      if (run !== r || inStrip(e.target)) return;
      if (ui.whyOpen && ui.whyPanel) setWhy(r, false);
    };
    // a focused text field holds the countdown while it holds text not yet sent (the user may still be typing); the app
    // empties a field it has taken in (a set added with Enter), which ends the hold (r3 review regress-1). Checked on
    // focus, on input and four times a second (the app empties it without an input event)
    const isField = (a) => !!a && a.nodeType === 1 && (a.isContentEditable || a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && !/^(checkbox|radio|range|button|submit|color|file)$/i.test(a.type || 'text')));
    const unsent = (a) => isField(a) && !inStrip(a) && String(a.isContentEditable ? a.textContent : a.value || '').trim() !== '';
    const onFocus = () => { if (run !== r) return; cdFeed(r, { type: unsent(document.activeElement) ? 'hold' : 'release', kind: 'field' }); };
    ui.syncField = onFocus;
    const onVis = () => { if (run === r) cdFeed(r, { type: document.hidden ? 'hold' : 'release', kind: 'hidden' }); };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('focusin', onFocus, true);
    document.addEventListener('input', onFocus, true);
    r.offs.push(() => document.removeEventListener('input', onFocus, true));
    const onBlurF = () => setTimeout(onFocus, 0);
    document.addEventListener('focusout', onBlurF, true);
    document.addEventListener('visibilitychange', onVis);
    r.offs.push(() => document.removeEventListener('pointerdown', onDown, true),
      () => document.removeEventListener('focusin', onFocus, true), () => document.removeEventListener('focusout', onBlurF, true), () => document.removeEventListener('visibilitychange', onVis));
    if (document.hidden) cdFeed(r, { type: 'hold', kind: 'hidden' });
    // Listen along: the step's piece holds the countdown while it plays, and its captions run from its start
    if (typeof api.on === 'function') {
      try {
        const a = api.on('listen-started', (e) => { if (run !== r) return; cdFeed(r, { type: 'hold', kind: 'listen' }); startCaptions(r, e); syncAct(r); });
        const b = api.on('listen-ended', () => { if (run !== r) return; stopCaptions(r); cdFeed(r, { type: 'release', kind: 'listen' }); syncAct(r); paintLead(r); });
        for (const off of [a, b]) if (typeof off === 'function') r.offs.push(off);
      } catch (e) { warn('on listen', e); }
    }
    // (review-phone phone-3: a finger on the screen; a lit part its panel's fling left out of sight comes back once the
    // finger is off and the panel still)
    const onTouch = (e) => {
      if (run !== r) return;
      ui.touching = e.touches ? e.touches.length : 0;
      if (ui.touching) clearTimeout(ui.backT);
      if (!ui.touching && ui.backH) { const H = ui.backH; clearTimeout(ui.backT); ui.backT = setTimeout(() => { if (run === r) bringBack(r, H); }, BACK_MS); }
    };
    for (const t of ['touchstart', 'touchend', 'touchcancel']) { document.addEventListener(t, onTouch, { capture: true, passive: true }); r.offs.push(() => document.removeEventListener(t, onTouch, { capture: true, passive: true })); }
    const onHide = () => { if (run === r && r.lend && r.lend.stashed) unbeat(); };
    const onShow = (e) => { if (e.persisted && run === r && r.lend && r.lend.stashed) beat(); };
    addEventListener('pagehide', onHide);
    addEventListener('pageshow', onShow);
    r.offs.push(() => removeEventListener('pagehide', onHide), () => removeEventListener('pageshow', onShow));
    // The spotlight keeps up in the same frame: a scroll (of the page or any panel) and a resize are handled as they
    // fire, before the frame is painted; a ResizeObserver catches the lit elements, the strip and the open layers
    // changing size; a MutationObserver catches layout changes that fire no event (a panel opening, the chain
    // growing, a menu or a dialog opening); and while anything moves (a transition, an animation, the shade's own
    // morph) the layout runs every frame until it has been still for a while
    // (v15.1: a panel the spotlight is drawn inside scrolls with it natively: its frames need no script. Anything else
    // a phone's rings follow by script during a scroll fades them until it is still)
    const onMove = (e) => {
      if (run !== r) return;
      if (e && e.type === 'resize') remount(r);
      if (e && e.type === 'scroll' && ui.hosts.has(e.target)) {
        clearTimeout(ui.hostT); clearTimeout(ui.backT);
        const H = e.target;
        ui.hostT = setTimeout(() => { if (run === r) { layout(false); kick(4); ui.backT = setTimeout(() => { if (run === r) bringBack(r, H); }, BACK_MS - 140); } }, 140);
        return;
      }
      const was = ui.drawSig;
      layout(false); kick(12);
      if (e && e.type === 'scroll' && ui.drawSig !== was && phoneL()) moving(ui);
    };
    addEventListener('resize', onMove);
    addEventListener('scroll', onMove, true);
    r.offs.push(() => removeEventListener('resize', onMove), () => removeEventListener('scroll', onMove, true));
    r.offs.push(() => { clearTimeout(ui.hostT); clearTimeout(ui.backT); clearTimeout(ui.moveT); clearTimeout(r.cdT); clearTimeout(ui.pulseT); stopCaptions(r); });
    if (typeof visualViewport !== 'undefined' && visualViewport) {
      for (const t of ['resize', 'scroll']) { visualViewport.addEventListener(t, onMove); r.offs.push(() => visualViewport.removeEventListener(t, onMove)); }
    }
    const ours = (n) => { const e = n && (n.nodeType === 1 ? n : n.parentElement); return !e || !!e.closest('[data-tour="root"], [data-tour="top"], [data-tour="strip"], #tip'); };
    if (typeof ResizeObserver === 'function') {
      ui.ro = new ResizeObserver(() => { if (run === r) { layout(false); kick(12); } });
      ui.roSet = new Set();
      r.offs.push(() => ui.ro.disconnect());
    }
    if (typeof MutationObserver === 'function') {
      const mo = new MutationObserver((recs) => { if (run === r && recs.some((m) => !ours(m.target))) { syncTop(ui); syncLayers(r); kick(12); } });
      mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'open'] });
      r.offs.push(() => mo.disconnect());
      // (the app's layout class on the root: a phone turned to landscape moves the strip into the header)
      let was = document.documentElement.className;
      const mr = new MutationObserver(() => { const c = document.documentElement.className; if (run === r && c !== was) { was = c; remount(r); layout(false); kick(12); } });
      mr.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
      r.offs.push(() => mr.disconnect());
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
    // a popover or a modal dialog of the app opening (the top layer): the rings and a phone's Why panel go above it
    const onToggle = (e) => {
      if (run !== r || ours(e.target)) return;
      const go1 = () => { if (run === r) { syncTop(ui); syncLayers(r); layout(false); kick(20); } };
      queueMicrotask(go1); requestAnimationFrame(go1);
    };
    for (const t of ['beforetoggle', 'toggle']) { document.addEventListener(t, onToggle, true); r.offs.push(() => document.removeEventListener(t, onToggle, true)); }
    r.offs.push(() => { try { if (ui.top.matches(':popover-open')) ui.top.hidePopover(); } catch (e) { /* */ } });
    // a safety net for anything the observers miss, four times a second (the layers that hold the countdown, the act
    // button's sound state); the stash's heartbeat every two seconds
    let n = 0;
    r.timer = setInterval(() => { syncTop(ui); syncLayers(r); syncAct(r); onFocus(); track(); if (r.lend && r.lend.stashed && ++n % Math.round(BEAT_MS / 250) === 0) beat(); }, 250);
    r.offs.push(() => clearInterval(r.timer));
    // the app's hover tooltip sits above the strip: hidden while it would cover it
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
    const t = tip.getBoundingClientRect(), c = r.ui.strip.getBoundingClientRect();
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
  // Escape in the strip while a layer is open that the app's own Escape does not close (its layerOpen() does not
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
  // a tap on the shade: the strip's lead line pulses (the step is there)
  function nudge() {
    if (!run || reduced()) return;
    const l = run.ui.l2;
    l.classList.remove('pulse'); void l.offsetWidth; l.classList.add('pulse');
  }

  // ---------------------------------------------------------------- v16.4: the strip
  // where the strip goes: 'desk' (the stage's first row, 768 px and up), 'port' (a phone in portrait: a 68 px row under
  // the header), 'head' (a landscape phone: the header's free part, right of ⋯, when it is at least 260 px), 'row' (a
  // landscape phone whose header has no such room: a 48 px row under it)
  function stripMode() {
    const de = document.documentElement;
    if (!de.classList.contains('ph')) return 'desk';
    if (!de.classList.contains('ph-land')) return 'port';
    const top = document.querySelector('header.top, .top');
    if (!top) return 'row';
    const cs = getComputedStyle(top);
    let used = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0), k = 0;
    for (const c of top.children) {
      if (c.id === 'tourHeadSlot' || c.matches(':popover-open, [popover]') || getComputedStyle(c).display === 'none') continue;
      // (the view switch keeps at most 420 px, as when the header holds nothing else)
      used += c.id === 'viewSwitch' ? Math.min(420, c.scrollWidth > c.offsetWidth ? c.scrollWidth : Math.max(c.offsetWidth, 0)) : c.offsetWidth;
      k++;
    }
    const gap = parseFloat(cs.columnGap || cs.gap) || 4;
    const free = top.clientWidth - used - gap * k;
    stripMode.free = free;
    return free >= 260 ? 'head' : 'row';
  }
  // Mounts the strip in its slot (the app's api.slot, else the first child of .stage) and reserves its room: --tour-h
  // (the stage's first row) or --ph-tour (a phone's row under the header). Again on every resize. (r3 review user-10:
  // a landscape phone's header strip becomes the row under the header for a chapter whose line needs three lines
  // there, r.forceRow; user-3: a phone's row grows to three lines for a chapter that needs them, ui.lines)
  function mountStrip(r) {
    const ui = r.ui;
    let mode = stripMode();
    if (mode === 'head' && r.forceRow) mode = 'row';
    const where = mode === 'head' ? 'head' : 'stage';
    let slot = call('slot', where);
    if (!(slot && slot.nodeType === 1)) slot = document.getElementById(where === 'head' ? 'tourHeadSlot' : 'tourSlot');
    if (!slot && where === 'head') { mode = 'row'; slot = call('slot', 'stage') || document.getElementById('tourSlot'); }
    if (!(slot && slot.nodeType === 1)) {
      const st = document.querySelector('.stage');
      slot = el('div', { id: 'tourSlot', class: 'tour-slot' });
      if (st) st.prepend(slot); else document.body.prepend(slot);
      r.ownSlot = slot;
    }
    if (ui.slot && ui.slot !== slot) ui.slot.hidden = true;
    if (ui.strip.parentNode !== slot) slot.append(ui.strip);
    slot.hidden = false;
    const changed = ui.mode !== mode;
    ui.slot = slot; ui.mode = mode; ui.strip.dataset.mode = mode;
    ui.chap.hidden = mode !== 'desk' || !ui.chap.firstChild.textContent;
    // (r3 verify-2: × End in the landscape header only with 44 + 8 px to spare beyond the strip's 260)
    ui.strip.classList.toggle('ts-xok', mode === 'head' && stripMode.free >= 312);
    // the sheet: a panel in the tour's top layer on a phone (the narrow row has no room for Back, × End the tour and
    // Move on by itself); a laptop's strip has them in its row, and no sheet
    const panel = mode !== 'desk';
    const panelWas = !!ui.whyPanel;
    ui.whyPanel = panel;
    if (panel && ui.why.parentNode !== ui.top) { ui.top.append(ui.why); ui.why.classList.add('ts-panel'); }
    else if (!panel && ui.why.parentNode) { ui.why.remove(); ui.why.classList.remove('ts-panel'); ui.why.style.left = ''; ui.why.style.right = ''; ui.why.style.width = ''; }
    if ((changed || panel !== panelWas) && panel && ui.whyOpen) setWhy(r, false);
    if (!panel && panelWas) { ui.whyOpen = false; cdFeed(r, { type: 'release', kind: 'why' }); }
    // the text block opens the sheet on a phone; on a laptop it is plain text
    ui.text.classList.toggle('inert', !panel);
    ui.text.tabIndex = panel ? 0 : -1;
    if (panel) { ui.text.setAttribute('aria-expanded', String(!!ui.whyOpen)); ui.text.setAttribute('aria-controls', 'tourWhy'); ui.text.setAttribute('aria-label', $t('Tour options')); ui.text.removeAttribute('role'); }
    else { ui.text.removeAttribute('aria-expanded'); ui.text.removeAttribute('aria-controls'); ui.text.removeAttribute('aria-label'); ui.text.setAttribute('role', 'presentation'); }
    const st = document.documentElement.style;
    if (mode === 'desk') { st.removeProperty('--ph-tour'); sizeDesk(r); }
    else { st.removeProperty('--tour-h'); setPhTour(r); }
    if (changed && mode !== 'desk') call('slot', where);   // (the app's phone layout shares out its height again)
    paintNext(ui);
  }
  // the phone's row under the header: the one place that writes its height (--ph-tour), for the strip and for the lane,
  // true when it changed; PH_LINE: a line of the strip's or the lane's text, 17 px
  const PH_LINE = 17;
  const phTourGet = () => parseFloat(document.documentElement.style.getPropertyValue('--ph-tour')) || 0;
  function phTourSet(px) {
    if (phTourGet() === px) return false;
    document.documentElement.style.setProperty('--ph-tour', px + 'px');
    return true;
  }
  // a phone's row: 68 px in portrait (76 for three lines), 48 under a landscape header (56), none in the header
  function setPhTour(r) {
    const ui = r.ui, n = ui.lines || 2;
    ui.strip.dataset.lines = String(n);
    // (#553: Italian at 360 px needs four lines for "Tieni premuto dentro il disco…": the row grows by a line, 17 px, again)
    const v = ui.mode === 'port' ? (n >= 4 ? 93 : n === 3 ? 76 : 68) : ui.mode === 'row' ? (n >= 4 ? 72 : n === 3 ? 56 : 48) : 0;
    return phTourSet(v);
  }
  // a resize or a layout change: the strip's place, then its lines, measured again
  function remount(r) { r.forceRow = false; mountStrip(r); fitLines(r); }
  // The number of lines the strip's line needs in this chapter on a phone (r3 review user-3, user-10): every lead, task,
  // result, hint and caption of its steps, at the width each step leaves it (a step with an act button has 52 px less),
  // set out of sight in a copy of the line. A landscape header that would need three takes the row under the header
  // instead; the row and a portrait strip grow to three lines. A desktop's line keeps its two lines (Next shortens).
  function fitLines(r) {
    const ui = r.ui;
    if (ui.mode === 'desk') { ui.lines = 2; ui.strip.dataset.lines = '2'; return; }
    let n = needLines(r);
    // (r3 verify-2: × stays in the header only while the chapter's line keeps its two lines there; else it is in Why,
    // and the strip keeps the header, so X keeps its size)
    if (ui.mode === 'head' && n > 2 && ui.strip.classList.contains('ts-xok')) { ui.strip.classList.remove('ts-xok'); n = needLines(r); }
    if (ui.mode === 'head' && n > 2) { r.forceRow = true; mountStrip(r); n = needLines(r); }
    ui.lines = n > 3 ? 4 : n > 2 ? 3 : 2;
    if (setPhTour(r)) call('slot', ui.mode === 'head' ? 'head' : 'stage');
  }
  // what a step's line can show: [text, with the task's ring]
  function lineTexts(st) {
    const out = [];
    const t = st.try && !(st.tryWide && narrow()) ? st.try : null;
    if (st.lead) out.push([leadFor(st), false]);
    if (t) {
      out.push([variantOf(t, t.text), true], [t.then || 'Done.', true]);
      if (t.off) out.push([t.off, true]);
      const h = hintFor(t);
      if (h) out.push([h, true]);
    }
    for (const c of st.captions || []) out.push([c[1], false]);
    return out;
  }
  function needLines(r, dbg) {
    const ui = r.ui, ch = CHAPTERS[r.ci];
    const w0 = ui.l2.clientWidth;
    if (!(w0 > 0)) return 2;
    // (a portrait row's act button takes Back's place: the same width with or without it)
    const port = ui.mode === 'port';
    const actW = ui.act.hidden || port ? 0 : ui.act.offsetWidth + 8, actFull = port ? 0 : actW || 52;
    // (measured once per chapter, mode, width and language: a phone's visual viewport fires resize events while it is
    // pinched or its keyboard opens, and these change none of them)
    const key = [r.ci, ui.mode, w0, actW, I18 ? I18.lang : 'en', coarse(), narrow()].join('|');
    if (!dbg && r.lineKey === key) return r.lineN;
    const probe = el('span', { class: 'ts-l2', 'aria-hidden': 'true' });
    probe.style.cssText = 'position:absolute;left:0;top:0;height:auto;visibility:hidden;pointer-events:none';
    ui.text.append(probe);
    let n = 1;
    try {
      const lh = parseFloat(getComputedStyle(probe).lineHeight) || 17;
      ch.steps.forEach((st, i) => {
        if (r.absent.has(skipKey(r.ci, i))) return;
        probe.style.width = (w0 + actW - (st.act ? actFull : 0)) + 'px';
        for (const [text, ring] of lineTexts(st)) {
          probe.textContent = '';
          const ri = el('span', { class: 'ts-ring' });
          ri.hidden = !ring;
          const tin = el('span', { class: 'ts-tin' });
          tinFill(tin, stepTitle(st));
          probe.append(ri, el('span', { class: 'ts-lead' }, tin, el('span', null, richText($t(text)))));
          n = Math.max(n, Math.round(probe.offsetHeight / lh));
          if (dbg) dbg.push([st.id, probe.style.width, Math.round(probe.offsetHeight / lh), text]);
        }
      });
    } finally { probe.remove(); }
    r.lineKey = key; r.lineN = n;
    return n;
  }
  // the title at the start of a landscape strip's line: bold, with a chevron (it opens Why)
  function tinFill(tin, t) {
    tin.textContent = t + ' ';
    const d = el('span', { class: 'ts-tdn' });
    d.innerHTML = ICON_DOWN;
    tin.append(d, ' ');
  }
  // A desktop's strip height: 52 px, plus while Why is open inline the tallest body of the steps seen so far at this
  // width (measured off screen at each chapter's start; r3 review regress-4: it never shrinks during the tour, so the
  // panes change size at most when a taller chapter comes, not at every chapter). At most 45 % of the view, and never
  // so tall that the panes keep less than 360 px (Why scrolls inside).
  const ROW_H = 52, SLOT_GAP = 8;
  // a laptop's strip is one row high
  function sizeDesk(r) {
    const ui = r.ui;
    if (ui.mode !== 'desk') return;
    const v = (ROW_H + SLOT_GAP) + 'px';
    if (document.documentElement.style.getPropertyValue('--tour-h') !== v) document.documentElement.style.setProperty('--tour-h', v);
  }
  // the phone's sheet open or folded: it folds at every step and holds the countdown while it is open
  function setWhy(r, open) {
    const ui = r.ui;
    if (!ui.whyPanel) return;
    open = !!open;
    ui.whyOpen = open;
    ui.why.hidden = !open;
    ui.text.setAttribute('aria-expanded', String(open));
    cdFeed(r, { type: open ? 'hold' : 'release', kind: 'why' });
    if (open) placeWhy(r);
    layout(false); kick(12);
  }
  function placeWhy(r) {
    const ui = r.ui;
    if (!ui.whyPanel || !ui.whyOpen) return;
    const b = ui.strip.getBoundingClientRect();
    const t = Math.round(ui.mode === 'head' ? b.bottom + 1 : b.bottom);
    if (ui.why.style.top !== t + 'px') ui.why.style.top = t + 'px';
    if (ui.why.style.width) { ui.why.style.left = ''; ui.why.style.right = ''; ui.why.style.width = ''; }
  }
  // the chapter's last step, where the strip's × finishes the chapter
  const lastOfChapter = (r) => { const nx = seek(r.ci, r.si + 1, 1, isAbsent); return !nx || nx.ci !== r.ci; };
  // Move on by itself (SPEC 2.4): on by default, kept in the tour record; off, the countdown of this showing stops
  function setAuto(on) {
    rec.auto = !!on; save();
    if (run) { run.ui.autoC.checked = rec.auto; if (!rec.auto) cdFeed(run, { type: 'off' }); }
    return rec.auto;
  }
  // Next (r3 review user-7): on a wide screen "Start", "Finish", "Next: <chapter>" or "Next", shortened to "Next →" (the
  // full label its name) when it does not fit or would cut the lead line; on a phone an arrow, its label its name. With
  // reduced motion during a countdown, the seconds left ("Next · 3"; on a phone "3")
  function paintNext(ui) {
    const n = ui.next, cnt = n.dataset.count || '';
    const ph = !!ui.mode && ui.mode !== 'desk';
    // (#34 T1) Next is earned: while the step's task is open the button is a quiet, outlined Skip; once it is done, or when
    // the step has no task, the filled Next
    const r = run && run.ui === ui ? run : null;
    const open = !!(r && r.step && tryOf(r.step) && !r.done && r.caption == null);
    const base = open ? $t('Skip') : n.dataset.base || $t('Next');
    const cap = !ph && keyHints();
    const html = ph ? (cnt ? `<span class="ts-ncount">${esc(cnt)}</span>` : ICON_RIGHT) : null;
    const text = ph ? null : cnt ? $t('Next · {n}', { n: cnt }) : base;
    const aria = ph || cnt ? base : null;
    const sig = [html, text, aria, cap, open].join('|');
    // (a laptop's Next names the key that steps forward in its tooltip)
    if (n.dataset.sig !== sig) {
      n.dataset.sig = sig;
      n.classList.toggle('skip', open);
      if (html != null) n.innerHTML = html; else n.textContent = text;
      if (aria) n.setAttribute('aria-label', aria); else n.removeAttribute('aria-label');
      n.title = ph ? base : cap ? base + '  →' : '';
    }
    if (open || ph || cnt || !n.dataset.full) return;
    // (it does not fit, or it leaves the lead line too little room: never cut; a laptop's text block has no box of its own,
    // its task line is the one measured)
    const t = ui.text.offsetWidth > 0 ? ui.text : ui.l2, cut = t && t.offsetWidth > 0 && (t.scrollHeight > t.clientHeight + 1 || t.scrollWidth > t.clientWidth + 1);
    if ((n.offsetWidth > 0 && n.scrollWidth > n.clientWidth + 0.5) || cut) { n.textContent = $t('Next') + ' →'; n.setAttribute('aria-label', base); n.dataset.sig = 'short'; }
  }

  // ---------------------------------------------------------------- v16.4: the act button and the sound
  const soundState = () => { const s = call('soundState'); return s && typeof s === 'object' ? s : { on: false, events: false, sonify: false, playing: !!call('soundPlaying') }; };
  // the act button: Listen (Stop listening while it plays; Turn on and listen when the sound or Mathematical events are
  // off), or Turn on sound while the sound is not ready (a hear step). Icon only on a phone, its label its name
  function syncAct(r, st) {
    const ui = r.ui, step = st || r.step, kind = step && step.act;
    if (!kind) { if (!ui.act.hidden) { ui.act.hidden = true; ui.strip.classList.remove('has-act'); } return; }
    let label = '', icon = ICON_PLAY, show = true;
    if (kind === 'listen') {
      const s = soundState();
      if (s.playing) { label = $t('Stop listening'); icon = ICON_STOP; }
      else if (!(s.on && s.events)) label = $t('Turn on and listen');
      else label = $t('Listen');
    } else {
      show = call('soundReady') !== true;
      label = $t('Turn on sound'); icon = ICON_SOUND;
    }
    // (r3 review user-8: the task line says when the tour turns the sound on, try.off; a phone shows the icon only)
    if (kind === 'listen' && step === r.step) paintLead(r, step);
    const sig = [show, label].join('|');
    if (ui.act.dataset.sig === sig) return;
    ui.act.dataset.sig = sig;
    ui.act.hidden = !show;
    ui.strip.classList.toggle('has-act', show);
    ui.act.innerHTML = icon;
    ui.act.append(el('span', null, label));
    ui.act.setAttribute('aria-label', label);
    ui.act.title = label;
    paintNext(ui);
  }
  // the act button's press: the user gesture the audio engine needs
  function actPress(r) {
    const step = r.step;
    if (!step || !step.act) return;
    if (step.act === 'listen') {
      if (soundState().playing) { call('soundStop'); syncAct(r); return; }
      const was = soundState();
      call('soundHold', Object.assign({ on: true, events: true }, step.hear ? { sonify: true } : {}));
      if (step.hear && !was.sonify) r.sndNote = true;
      if (call('listen') === false) call('toast', $t('This browser cannot play sound here.'));
    } else {
      const was = soundState();
      call('soundHold', { on: true, events: true, sonify: true });
      if (!was.sonify) { r.sndNote = true; r.ui.live.textContent = $t('The tour turns Hear the function on for this step; your setting comes back after it.'); }
    }
    syncAct(r);
    setTimeout(() => { if (run === r) syncAct(r); }, 300);
  }
  // the sound a step holds (SPEC 4.3): a hear step turns Hear the function on when the sound is ready (with a note);
  // a listen step of the Sound chapter gives Hear the function back; a step with no sound of its own (Sound settings)
  // and a step outside the chapter give everything back, so the menu shows the user's own settings (r3 review user-6)
  function holdSound(r, ch, step) {
    call('soundStop');
    r.sndNote = false;
    if (ch.id !== 'sound' || !(step.hear || step.act)) { call('soundHold', null); return; }
    if (step.hear) {
      if (call('soundReady') === true) { const was = soundState(); call('soundHold', { sonify: true }); r.sndNote = !was.sonify; }
    } else call('soundHold', { sonify: null });
  }
  // captions while the step's piece plays: the tour's own timer from listen-started (±50 ms is fine for captions)
  function startCaptions(r, e) {
    stopCaptions(r);
    const step = r.step;
    // (the step's piece: the composition, or the function's own Listen along; capFrac scales by its duration)
    if (!step || !step.captions || !(e && (e.piece || e.fn))) return;
    const k = step.capFrac ? (Number.isFinite(e.dur) && e.dur > 0 ? e.dur : 0) : 1;
    if (!(k > 0)) return;
    const t0 = performance.now();
    r.capT = [];
    for (const [sec, text] of step.captions) {
      const at = Math.max(0, sec * k * 1000 - (performance.now() - t0));
      r.capT.push(setTimeout(() => { if (run !== r || r.step !== step) return; r.caption = text; paintLead(r); r.ui.live.textContent = plainCopy($t(text), modKey()); }, at));
    }
  }
  function stopCaptions(r) {
    for (const t of r.capT || []) clearTimeout(t);
    r.capT = [];
    if (r.caption != null) { r.caption = null; if (run === r) paintLead(r); }
  }

  // ---------------------------------------------------------------- v16.4: the countdown's feeds and its look
  function cdFeed(r, e) {
    if (!r || run !== r) return;
    const before = r.cd;
    r.cd = countdown(r.cd, e, performance.now());
    if (r.cd !== before) cdSync(r, before);
  }
  function cdSync(r, before) {
    const s = r.cd, ui = r.ui;
    clearTimeout(r.cdT);
    const now = performance.now(), L = cdLeft(s, now);
    const live = s.phase === 'running' || s.phase === 'held';
    const restarted = s.phase === 'running' && (!before || before.phase !== 'running' || before.t0 !== s.t0);
    const red = reduced();
    if (s.door) { ui.next.classList.remove('counting', 'held'); }
    else {
      ui.next.classList.toggle('held', s.phase === 'held');
      if (restarted && !red) { ui.next.style.setProperty('--tour-cd', s.dur + 'ms'); ui.next.classList.remove('counting'); void ui.next.offsetWidth; ui.next.classList.add('counting'); }
      if (!live) ui.next.classList.remove('counting', 'held');
      // (held: the fill freezes; when the hold ends the countdown starts again from its full length)
      if (s.phase === 'held' && before && before.phase !== 'held' && !red) ui.next.classList.add('counting');
    }
    nextLabel(r, red && live && !s.door ? Math.ceil((s.phase === 'running' ? L : s.dur) / 1000) : null);
    // (r3 review regress-5: the countdown is announced when it starts: at done when nothing holds it, else here, when the
    // last hold ends)
    if (r.done && !s.door && s.phase === 'running' && before && before.phase === 'held') ui.live.textContent = nextIn();
    if (L == null) return;
    // (reduced motion: the label counts down each second; otherwise one timer to the end)
    const wait = red && !s.door ? Math.max(1, L % 1000 || 1000) : L;
    r.cdT = setTimeout(() => {
      if (run !== r || r.cd !== s) return;
      if (cdLeft(s, performance.now()) > 1) { cdSync(r, s); return; }
      r.cd = countdown(s, { type: 'fire' }, performance.now());
      // (a focused text field is left first, so a phone's keyboard closes)
      const a = document.activeElement;
      if (a && a !== document.body && !r.ui.strip.contains(a) && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable)) { try { a.blur(); } catch (x) { /* */ } }
      go(1);
    }, wait);
  }
  // Next's countdown with reduced motion: the seconds left (n), or none
  function nextLabel(r, n) {
    const nx = r.ui.next, v = n != null ? String(n) : '';
    if ((nx.dataset.count || '') === v) return;
    if (v) nx.dataset.count = v; else delete nx.dataset.count;
    paintNext(r.ui);
  }
  // the app's layers open (a menu, the palette, a dialog, a popover, a sheet the step did not open) hold the countdown
  function syncLayers(r) {
    if (!r || run !== r) return;
    // (a layer the step itself opened, a phone's sheet, is part of the step: it holds nothing; r3 review user-1: so is a
    // layer that holds one of the step's lit parts, the Editor sheet with the lens that the chain's task opens)
    const cand = layerEls().filter((k) => !(r.stepLayers && r.stepLayers.has(k)));
    let open = cand.length > 0;
    if (open && r.step && r.tgt) { const els = litParts(r.step, r.tgt).map((q) => q.el); open = cand.some((k) => !els.some((e) => k.contains(e))); }
    if (open !== !!r.layerHeld) { r.layerHeld = open; cdFeed(r, { type: open ? 'hold' : 'release', kind: 'layer' }); }
  }

  // the next showable step from (ci, si) in direction dir, crossing chapters; null at either end. skip(ci, si): a step
  // known to be absent from this build
  function seek(ci, si, dir, skip) {
    const d = dir < 0 ? -1 : 1;
    while (ci >= 0 && ci < CHAPTERS.length) {
      // (v16.5 UX17: a chapter for the keyboard is passed over on a touch screen, unless the tour is in it)
      if (!chapterShown(CHAPTERS[ci]) && !(run && run.ci === ci)) { ci += d; si = d < 0 ? (ci >= 0 ? CHAPTERS[ci].steps.length - 1 : -1) : 0; continue; }
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
  const CHANGES = new Set(['scene', 'range', 'view', 'surface', 'deform', 'focus', 'panel', 'tool', 'look', 'select', 'plane', 'svPlace']);
  function absent(ci, si, scenes) {
    const ch = CHAPTERS[ci], st = ch.steps[si], k = sceneAt(ch, si), sc = k != null ? SCENES[k] : null;
    if (scenes === false && (k != null || (st.before || []).some((a) => CHANGES.has(a[0])))) return true;
    if (st.wide && narrow()) return true;
    return [].concat(st.needs || [], (sc && sc.needs) || [], ch.needs || []).some(featureOff);
  }

  async function go(dir) {
    if (!run) return;
    const r = run;
    const pos = seek(r.ci, r.si + dir, dir, isAbsent);
    if (!pos) { if (dir > 0) stop({ finished: true }); return; }
    // the end of a chapter counts as finishing it (#34, UX75: and says so)
    if (dir > 0 && pos.ci !== r.ci) { rec.done[CHAPTERS[r.ci].id] = CHAPTERS[r.ci].rev; save(); say($t('{chapter} done ✓', { chapter: $t(CHAPTERS[r.ci].title) })); }
    await show(pos.ci, pos.si, dir);
  }

  function loadScene(r, key) {
    if (key == null) return true;
    if (r.scene === key) return r.sceneOk[key] !== false;
    const spec0 = SCENES[key];
    // (v16.4: a scene the app holds, app: the Grieg example, asked for at load time; none: the scene is absent)
    let spec = spec0;
    if (spec0 && spec0.app) { const a = call('sceneSpec', spec0.app); spec = a && typeof a === 'object' ? Object.assign({}, a, { look: spec0.look }) : null; }
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
  const ACTIONS = { range: 'setRange', view: 'setView', surface: 'setSurface', deform: 'setDeformation', focus: 'focusStep', panel: 'showPanel', tool: 'setTool', look: 'setLook', select: 'selectStep', plane: 'showPlane' };
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
    rec.last = { ch: ch.id, i: si }; rec.open = true; save();
    // (v15.2: the Inspector's split offer shows during the tour only at a step that asks for it)
    call('splitOffer', !!step.split);
    // (v16.1: a step about the cards' pictures shows them, Pictures rather than Names; any other step, and the end of the
    // tour, gives the user's setting back. picNote: the tour changed it, and the step says so)
    r.picNote = call('chainPictures', !!step.pictures) === true && !!step.pictures;
    for (const off of r.tryOffs.splice(0)) off();
    // (v16.4: a new showing: no countdown, no caption, no Listen along from the step before; the Sound chapter's sound)
    clearTimeout(r.cdT);
    const holds = r.cd ? r.cd.holds.filter((k) => k !== 'why' && k !== 'listen') : [];
    r.cd = Object.assign(cdInit(), { holds });
    r.ui.next.classList.remove('counting', 'held', 'ready');
    stopCaptions(r);
    r.done = false; r.result = null; r.hint = null; r.quiet = false;
    holdSound(r, ch, step);
    if (r.ui.whyOpen && r.ui.whyPanel) setWhy(r, false);
    r.ui.strip.setAttribute('aria-busy', 'true');
    // (the strip shows the new step's title and line at once, while its scene and spotlight settle)
    r.caption = null;
    fill(r, ch, step);
    // A chapter's start, before its scene loads and is fitted: (r3 review regress-2) the side panel a step of the
    // chapter docks opens now, so the stage and the strip keep one place through the chapter (a drawer, or a phone's
    // sheet, still opens at its own step); the strip's lines for its copy (a phone); a desktop's Why for its steps
    if (r.chapterAt !== ci) {
      r.chapterAt = ci;
      const pa = r.scenes ? chapterPanel(r, ci) : null;
      if (pa) call('showPanel', pa[1], pa[2], true);
      remount(r);
      sizeDesk(r);
      await frames(1); if (stale()) return;
    }
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
    r.ui.strip.removeAttribute('aria-busy');
    // (v15.1: each step checks its panels anew)
    r.ui.hostOk = new Map();
    // (v16.4: the layers open now were opened by the step itself, a phone's sheet: they hold no countdown)
    r.stepLayers = new Set(layerEls());
    r.layerHeld = false;
    r.cd = Object.assign(cdInit(), { holds: r.cd.holds.filter((k) => k !== 'layer') });
    fill(r, ch, step);
    watchStep(r);
    layout(true);
    kick(30);
    announce(r, ch, step);
    armTry(r, step);
    pulseSmall(r);
    // (the strip is not a dialog: the focus stays where the user is working; when it was in the strip, it goes to Next)
    if (r.ui.strip.contains(document.activeElement) && document.activeElement !== r.ui.next) { try { r.ui.next.focus({ preventScroll: true }); } catch (e) { /* */ } }
  }

  // the first side panel a step of the chapter shows (['panel', 'left' | 'right', …]), the steps absent here aside
  function chapterPanel(r, ci) {
    const ch = CHAPTERS[ci];
    for (let i = 0; i < ch.steps.length; i++) {
      if (r.absent.has(skipKey(ci, i))) continue;
      const a = (ch.steps[i].before || []).find((x) => x[0] === 'panel' && (x[1] === 'left' || x[1] === 'right'));
      if (a) return a;
    }
    return null;
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
      // (the container's scroll-padding is room that something over it takes, such as the phone chain's pinned + and F)
      const sp = (k) => parseFloat(cs[k]) || 0;
      const top0 = q.top + a.clientTop, left0 = q.left + a.clientLeft;
      const top = top0 + sp('scrollPaddingTop'), left = left0 + sp('scrollPaddingLeft'), bot = top0 + a.clientHeight - sp('scrollPaddingBottom'), right = left0 + a.clientWidth - sp('scrollPaddingRight');
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
    // phone's sheet); the anchor's panels last, so it wins where both are in one panel. (v16.1: the controls a Try it
    // needs after it: the Select tool above the shape list of a short side panel shows whole, the list from its top)
    const ctls = ctlOf(step).map((a) => anchorEl(a)).filter((e) => e && e !== target);
    const alsoAll = [].concat(step.also || [], workOf(step)).map((a) => anchorEl(a)).filter((e) => e && e !== target).concat(ctls);
    const ctlsReveal = () => { let m = false; for (const e of ctls) if (panelsReveal(e)) m = true; return m; };
    let pm = false;
    for (const e of alsoAll) if (panelsReveal(e)) pm = true;
    if (panelsReveal(target)) pm = true;
    if (ctlsReveal()) pm = true;
    if (pm) await frames(1);
    // a control in the top bar or a fixed tool bar (or a phone's sheet) is always in view; scrolling the page would
    // only move the page under it
    if (inFixed(target)) return;
    const also = alsoAll.filter((e) => !inFixed(e));
    for (let pass = 0; pass < 2; pass++) {
      // cut by a scrolling panel (a section low in a side panel, the add card at the end of a long chain): that panel
      // scrolls first, so the whole target shows when it fits
      if (panelsReveal(target) | ctlsReveal()) await frames(1);
      // the lit area: the anchor, and its second lit element when both can be brought in
      const b = target.getBoundingClientRect();
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
    const t = stepTitle(step);
    ui.title.textContent = t;
    // (cut with an ellipsis where it does not fit: the full title stays its name)
    ui.title.setAttribute('aria-label', t); ui.title.title = t;
    tinFill(ui.tin, t);
    ui.wtitle.textContent = t;
    r.countText = $t('{k} of {total}', { k, total });
    r.countShort = `${k}/${total}`;
    ui.count.textContent = ui.mode === 'desk' ? `${$t(ch.title)} · ${r.countText}` : r.countShort;
    ui.count.setAttribute('aria-label', `${$t(ch.title)}, ${r.countText}`);
    // (the count in the text gives way to the chapter button where there is room for it)
    ui.chap.hidden = ui.mode !== 'desk';
    ui.chap.firstChild.textContent = r.countShort;
    ui.chap.setAttribute('aria-label', `${$t(ch.title)}, ${r.countText}. ${$t('Chapters')}`);
    ui.chap.setAttribute('title', $t('Chapters'));
    const nx = seek(r.ci, r.si + 1, 1, isAbsent);
    const nextCh = nx && nx.ci !== r.ci ? CHAPTERS[nx.ci] : null;
    const last = !nx;
    const base = step.anchor == null && r.ci === 0 && r.si === 0 ? $t('Start') : last ? $t('Finish') : nextCh ? $t('Next: {chapter}', { chapter: $t(nextCh.title) }) : $t('Next');
    delete ui.next.dataset.count;
    ui.next.dataset.base = base;
    if (nextCh) ui.next.dataset.full = base; else delete ui.next.dataset.full;
    paintNext(ui);
    // (no step before: Back keeps its place, unseen, so the text and Why stay aligned from step to step)
    const noBack = !seek(r.ci, r.si - 1, -1, isAbsent);
    ui.back.style.visibility = noBack ? 'hidden' : '';
    ui.back.disabled = noBack;
    ui.wBack.hidden = noBack;
    ui.autoC.checked = rec.auto !== false;
    ui.l2.classList.remove('done', 'caption');
    ui.act.dataset.sig = '';
    syncAct(r, step);
    paintLead(r, step);
    paintNext(ui);
  }
  // The lead line, by precedence (SPEC 1.1): a caption while the step's piece plays; the result line with a tick once the
  // task is done ("Done." when the step has none); the task with an empty ring; else the step's lead
  function paintLead(r, st) {
    const ui = r.ui, step = st || r.step;
    if (!step) return;
    const tr = tryOf(step);
    let text, ring = false, done = false, cap = false;
    if (r.caption != null) { text = $t(r.caption); cap = true; }
    else if (tr && r.done) {
      // (#34, UX75) the chapter's last task: the line says the chapter is done ("Basics done ✓"); Next names the next one
      const nx = seek(r.ci, r.si + 1, 1, isAbsent), end = !nx || nx.ci !== r.ci;
      const chDone = end ? $t('{chapter} done ✓', { chapter: $t(CHAPTERS[r.ci].title) }) : '';
      text = tr.then ? $t(tr.then) + (chDone ? ' ' + chDone : '') : chDone || $t('Done.');
      ring = true; done = true;
    }
    else if (tr && r.hint) { text = $t(r.hint); ring = true; }
    else if (tr) { text = tr.off && step.act === 'listen' && !(soundState().on && soundState().events) ? $t(tr.off) : tryFor(tr); ring = true; }
    else text = step.lead ? $t(leadFor(step)) : '';
    const sig = [text, ring, done, cap].join('|');
    if (ui.leadSig === sig) return;
    ui.leadSig = sig;
    ui.lead.textContent = '';
    ui.lead.append(richText(text));
    ui.ringI.hidden = !ring;
    ui.l2.classList.toggle('done', done);
    ui.l2.classList.toggle('caption', cap);
    paintNext(ui);
  }
  // The polite live region (SPEC 1.3): "Basics, step 5 of 10. Draw a shape. Choose Disc, then drag in X." (the lead on a
  // read step)
  function announce(r, ch, step) {
    const tr = tryOf(step);
    const end = (t) => (/[.!?…]\s*$/.test(t) ? t.trim() : t.trim() + '.');
    const line = tr ? plainCopy(tryFor(tr), modKey()) : step.lead ? plainCopy($t(leadFor(step)), modKey()) : '';
    // (what the tour changed in the user's settings for this step, and that they come back, is said to a screen reader: the
    // Details panel that showed it as text is gone)
    const notes = (r.picNote && step.pictures ? ' ' + $t('The tour turns the cards\' pictures on for this step; your setting comes back after it.') : '')
      + (r.sndNote && step.hear ? ' ' + $t('The tour turns Hear the function on for this step; your setting comes back after it.') : '');
    r.ui.live.textContent = $t('{chapter}, step {k}. {title}. ', { chapter: $t(ch.title), k: r.countText, title: stepTitle(step) }) + (line ? end(line) : '') + notes;
  }
  // a lit control smaller than 48 x 48 px pulses its ring once when the step appears (none with reduced motion)
  function pulseSmall(r) {
    const ui = r.ui;
    clearTimeout(ui.pulseT);
    ui.ringG.classList.remove('pulse');
    if (reduced() || !r.tgt) return;
    const els = [r.el, ...ctlOf(r.step).map((a) => anchorEl(a))].filter(Boolean);
    if (!els.some((e) => { const b = e.getBoundingClientRect(); return b.width > 1 && b.width < 48 && b.height < 48; })) return;
    void ui.ringG.getBoundingClientRect();
    ui.ringG.classList.add('pulse');
    ui.pulseT = setTimeout(() => ui.ringG.classList.remove('pulse'), 950);
  }

  // The lit areas of a step: its anchor's parts and its `also` areas, each exactly its visible box (step.pad grows them
  // when a step asks), with its corner radii; an anchor inside a lit panel is the mark.
  // the lit parts: the anchor's, then its `also` areas and (v15.1) the areas its Try it names (try.work), each once
  function litParts(step, tgt) {
    const parts = tgt.parts.slice();
    // (try.work names parts of the touch task: review-phone phone-2, the lens in the sheet the first tap opens)
    const ctl = new Set(ctlOf(step));
    for (const a of [].concat(step.also || [], ctlOf(step), workOf(step))) {
      const t = anchorOf(a);
      if (t) for (const q of t.parts) if (!parts.some((x) => x.el === q.el && !x.rect && !q.rect) && !covered(q.el) && !(ctl.has(a) && underLayer(q.el))) parts.push(q);
    }
    return parts;
  }
  // (v16.1) a Try it's control under an open layer it is not in (a phone's tool row under the Editor sheet) is not lit:
  // it cannot be reached there, and the step has switched to it already
  function underLayer(e) {
    const lay = layerEls().filter((k) => !k.contains(e));
    if (!lay.length || typeof document.elementsFromPoint !== 'function') return false;
    const b = e.getBoundingClientRect();
    const hit = document.elementsFromPoint((b.left + b.right) / 2, (b.top + b.bottom) / 2).find((h) => !h.closest('[data-tour]'));
    return !!hit && lay.some((k) => k.contains(hit));
  }
  function holesFor(step, tgt) {
    if (!tgt) return { holes: [], mark: null, insets: [] };
    const pad = step.pad != null ? step.pad : 0;
    // (a part clipped away has no hole: never an empty line where the anchor would be)
    const rects = litParts(step, tgt).map((q, i) => (i > 0 ? sideCut(q.el, partRect(q, pad)) : partRect(q, pad))).filter((q, i) => !q.hidden && (i === 0 || (q.r - q.l > 0.5 && q.b - q.t > 0.5)));
    return areasOf(rects, true);
  }
  // (r3 review fix pass) a lit part beside the anchor that an open layer covers along one whole side, X under the left
  // drawer the step opened at 768-1023 px, is lit only where it shows: cut back to the layer's edge, square corners
  // there. Not on a phone, whose sheets the spotlight is drawn into (hostPlan)
  function sideCut(e, q) {
    if (!e || phoneLayout() || q.hidden) return q;
    let els = null;
    try { if (fn('layers')) els = api.layers(); } catch (x) { els = null; }
    for (const k of [...(els || [])]) {
      if (!k || !k.getBoundingClientRect || k === e || k.contains(e) || e.contains(k) || (k.closest && k.closest('[data-tour]')) || !visible(k)) continue;
      const b = k.getBoundingClientRect();
      if (b.right <= q.l + 0.5 || b.left >= q.r - 0.5 || b.bottom <= q.t + 0.5 || b.top >= q.b - 0.5) continue;
      const spanV = b.top <= q.t + 0.5 && b.bottom >= q.b - 0.5, spanH = b.left <= q.l + 0.5 && b.right >= q.r - 0.5;
      const rad = q.rad.slice();   // [top-left, top-right, bottom-right, bottom-left]
      if (spanV && b.left <= q.l + 0.5 && b.right < q.r - 1) { q = Object.assign({}, q, { l: b.right }); rad[0] = rad[3] = 0; }
      else if (spanV && b.right >= q.r - 0.5 && b.left > q.l + 1) { q = Object.assign({}, q, { r: b.left }); rad[1] = rad[2] = 0; }
      else if (spanH && b.top <= q.t + 0.5 && b.bottom < q.b - 1) { q = Object.assign({}, q, { t: b.bottom }); rad[0] = rad[1] = 0; }
      else if (spanH && b.bottom >= q.b - 0.5 && b.top > q.t + 1) { q = Object.assign({}, q, { b: b.top }); rad[2] = rad[3] = 0; }
      else continue;
      q.rad = rad;
    }
    return q;
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
    // (v16.1: a part in a panel nested inside another lit part's panel, the slider of a in its list inside the Editor
    // sheet, is drawn in the outer panel: two shades one inside the other would dim the lit part around it, and their
    // two windows over the page would cancel out)
    for (let i = 0; i < hs.length; i++) for (let k = 0; hs[i] && k < hs.length; k++) if (hs[k] && hs[k] !== hs[i] && hs[k].contains(hs[i])) { hs[i] = hs[k]; k = -1; }
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
  // (a title that is a task reads as one: 'tour step' is the context of a Russian title in the imperative where the same
  // words, a button or a menu entry elsewhere, stay in the infinitive; a title starting in lower case is capitalised)
  const stepTitle = (st) => {
    const raw = layoutIsPhone() && st.titleTouch ? st.titleTouch : st.title, x = $tx('tour step', raw), t = x !== raw ? x : $t(raw);
    return /^\p{Ll}/u.test(t) ? t[0].toUpperCase() + t.slice(1) : t;
  };
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
  // the elements whose size the spotlight depends on: the strip, the page, the lit parts (the open layers join in layout)
  function watch(ui, els) {
    if (!ui.ro) return;
    for (const e of els) if (e && !ui.roSet.has(e)) { ui.roSet.add(e); try { ui.ro.observe(e); } catch (x) { /* */ } }
  }
  function watchStep(r) {
    const ui = r.ui;
    if (!ui.ro) return;
    ui.ro.disconnect(); ui.roSet = new Set();
    const els = [ui.strip, document.documentElement];
    if (r.tgt) els.push(...r.tgt.parts.map((q) => q.el));
    const tr = r.step ? tryOf(r.step) : null;
    for (const a of [].concat((r.step && r.step.also) || [], r.step ? ctlOf(r.step) : [], (tr && tr.work) || [])) { const t = anchorOf(a); if (t) els.push(...t.parts.map((q) => q.el)); }
    watch(ui, els);
  }
  // Measure and draw: on a step change (the shade morphs from where it was to the new area, measured afresh in each
  // frame), and whenever something moves (scroll, resize, observers, the motion loop). Returns whether anything
  // changed. v16.4: no placement any more; the strip is in the layout, a window of the shade with no ring, and a step
  // with no anchor (the welcome) draws no shade at all.
  function layout(stepChange) {
    const r = run;
    if (!r || !r.step) return false;
    const ui = r.ui, step = r.step;
    // the anchor went away while the step shows (a panel closed, the layout changed): another match
    if (r.el && !visible(r.el)) { const t = anchorOf(step.anchor); if (t) { r.tgt = t; r.el = t.el; } }
    // (v16.1, live: the anchor that shows now, a tool's tile in a phone's sheet rather than the More key under it)
    else if (step.live && step.anchor != null) { const t = anchorOf(step.anchor); if (t && t.el !== r.el) { r.tgt = t; r.el = t.el; watchStep(r); } }
    const tgtNow = r.el && visible(r.el) ? r.tgt : null;
    const { holes, mark, insets } = holesFor(step, tgtNow);
    const marks = [mark, ...(insets || [])].filter(Boolean);
    const layers = appLayers();
    watch(ui, layerEls());
    const vp = vpSize();
    // v15.1, a phone: the parts inside a scrolling panel are drawn inside it (hostPlan)
    const plan = hostPlan(r, step, tgtNow);
    if (!plan) for (const H of [...ui.hosts.keys()]) dropHost(ui, H);
    const wins0 = plan ? plan.wins : [];
    if (plan) watch(ui, plan.inner.map((x) => x.H));
    ui.work = holes.concat(wins0).map((h) => ({ l: h.l, t: h.t, r: h.r, b: h.b }));
    // the strip: a window of the shade (cut by the viewport)
    const sb = ui.strip.getBoundingClientRect();
    const sw = sb.width > 0 && sb.height > 0 ? { l: Math.max(0, sb.left), t: Math.max(0, sb.top), r: Math.min(vp.w, sb.right), b: Math.min(vp.h, sb.bottom), rad: radii(ui.strip) } : null;
    const wins = sw && sw.r > sw.l && sw.b > sw.t ? wins0.concat([sw]) : wins0;
    placeWhy(r);
    const shadeOn = holes.length > 0 || !!plan;
    if (ui.svg.style.display !== (shadeOn ? '' : 'none')) { ui.svg.style.display = shadeOn ? '' : 'none'; ui.rsvg.style.display = shadeOn ? '' : 'none'; }
    // (r3 review user-1: once the task is done the shade and the rings fade out and let every press through)
    const quiet = !!(r.done && r.quiet);
    if (ui.quiet !== quiet) { ui.quiet = quiet; ui.svg.classList.toggle('tour-quiet', quiet); ui.rsvg.classList.toggle('tour-quiet', quiet); }
    if (plan) for (const x of plan.inner) if (x.h.svg.classList.contains('tour-quiet') !== quiet) x.h.svg.classList.toggle('tour-quiet', quiet);
    const q = (h) => [h.l, h.t, h.r, h.b].map((v) => Math.round(v * 4) / 4);
    // (v15.1: with a plan, the fixed layer draws the parts outside the panels and a window over each panel; each panel
    // draws its own parts, in its content px, which a scroll of the panel does not change)
    const oHoles = plan ? plan.outer.holes : holes, oMarks = plan ? plan.outer.marks : marks;
    const dsig = JSON.stringify([oHoles.map(q), oMarks.map(q), wins.map(q), oHoles.map((h) => h.rad)]) + (plan ? plan.inner.map((x) => x.sig).join(';') : '');
    ui.drawSig = dsig;
    // (r3 review regress-3, found by the restored layers pass: the app's toasts too, as in v16.2, so a ring never draws
    // over an Undo)
    const toasts = [...document.querySelectorAll(TOAST_SEL)].filter(visible).map((e) => Object.assign(rectOf(e), { rad: radii(e) }));
    const masked = layers.concat(toasts, ui.whyOpen && ui.whyPanel ? [rectOf(ui.why)] : []);
    const sig = dsig + JSON.stringify(masked.map(q)) + [vp.w, vp.h].join(',');
    const changed = sig !== r.tracked;
    r.tracked = sig;
    if (stepChange) {
      const dur = reduced() ? 0 : ms(getComputedStyle(document.documentElement).getPropertyValue('--t-slow'), 240);
      // (no morph when the lit area stays where it is: the inner ring shows at once)
      const same = ui.holes && ui.holes.length === holes.length && ui.holes.every((h, i) => Math.max(Math.abs(h.l - holes[i].l), Math.abs(h.t - holes[i].t), Math.abs(h.r - holes[i].r), Math.abs(h.b - holes[i].b)) < 1);
      ui.anim = dur && !same && !plan && ui.holes && ui.holes.length && holes.length ? { from: ui.holes.slice(), t0: performance.now(), dur } : null;
    }
    let ended = false;
    if (ui.anim && !holes.length) ui.anim = null;
    if (ui.anim) {
      const u = ease(Math.min(1, (performance.now() - ui.anim.t0) / ui.anim.dur));
      // (the inner ring appears once the shade has settled)
      if (u < 1) { drawHoles(ui, between(ui.anim.from, holes, u), null, masked, wins); kick(2); return true; }
      ui.anim = null; ended = true;
    }
    if (changed || ended || stepChange) { drawHoles(ui, oHoles, oMarks, masked, wins); guardTip(r); }
    if (plan) for (const x of plan.inner) if (stepChange || x.h.sig !== x.sig) drawHost(x);
    ui.holes = holes;
    return changed;
  }
  const rectOf = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, rad: [0, 0, 0, 0] }; };
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
    // count: how many times the event must come (Paths twice, so it ends switched on). The tour listens only after the
    // step's own actions have run, so a task is done only by the user's hand
    let fired = false, hits = 0;
    const mem = {};
    const hit = (e) => {
      if (fired || run !== r || r.step !== step) return;
      try { if (t.test && !t.test(e, mem)) return; } catch (x) { return; }
      if (++hits < (t.count || 1)) return;
      fired = true;
      r.done = true;
      r.doneTasks.add(CHAPTERS[r.ci].id + '/' + step.id);
      r.ui.next.classList.add('ready');
      paintLead(r);
      // (SPEC 2.1) a door moves on after 0.7 s; any other task CD_MS after it is done, unless the step was reached with
      // Back, Move on by itself is off, this showing's countdown was cancelled, or no step follows. (r3 review user-5: a
      // chapter's last task moves on too, into the next chapter, which Next names)
      const never = !t.advance && (r.dir < 0 || !seek(r.ci, r.si + 1, 1, isAbsent));
      cdFeed(r, { type: 'done', door: !!t.advance, reduced: reduced(), off: rec.auto === false, never });
      // (a field the task's own input came from, emptied by the app: no hold; regress-1)
      if (r.ui.syncField) r.ui.syncField();
      // (r3 review regress-5: "Next step in 1.5 s" only when it runs now; a hold announces them when it ends. Said
      // a frame later, once a layer the task itself opens, the palette, is there and holds them)
      const res = t.then ? plainCopy($t(t.then), modKey()) : '';
      requestAnimationFrame(() => {
        if (run !== r || r.step !== step) return;
        syncLayers(r);
        const counting = !t.advance && r.cd && r.cd.phase === 'running';
        r.ui.live.textContent = $t('Done.') + (res ? ' ' + (/[.!?]$/.test(res) ? res : res + '.') : '') + (counting ? ' ' + nextIn() : '');
      });
      // (r3 review user-1: the spotlight steps aside, so the result can be seen and touched; a door moves on at once)
      r.quiet = !t.advance;
      layout(false); kick(4);
    };
    for (const ev of [].concat(t.on)) {
      try { const off = api.on(ev, hit); if (typeof off === 'function') r.tryOffs.push(off); } catch (e) { warn('on ' + ev, e); }
    }
    // try.hint: an event that says the attempt went wrong (a hold too short that panned Y) puts a line in place of the
    // task until the task is done
    const h = t.hint, ht = hintFor(t);
    if (ht && h.on) {
      const miss = (e) => {
        if (fired || run !== r || r.step !== step) return;
        try { if (h.test && !h.test(e)) return; } catch (x) { return; }
        if (r.hint === ht) return;
        r.hint = ht;
        paintLead(r);
        r.ui.live.textContent = plainCopy($t(ht), modKey());
      };
      for (const ev of [].concat(h.on)) {
        try { const off = api.on(ev, miss); if (typeof off === 'function') r.tryOffs.push(off); } catch (e) { warn('on ' + ev, e); }
      }
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
    // (v16.1: the chain's Pictures | Names setting as the user left it, before their work comes back)
    call('chainPictures', false);
    if (opt.finished) {
      rec.done[CHAPTERS[r.ci].id] = CHAPTERS[r.ci].rev;
      // "Continue the tour" picks up at the next chapter, or nowhere after the last
      const nc = CHAPTERS.findIndex((c, j) => j > r.ci && chapterShown(c));
      rec.last = nc > 0 ? { ch: CHAPTERS[nc].id, i: 0 } : null;
    }
    rec.open = false;
    save();
    const ui = r.ui;
    // (v16.4: the sound the Sound chapter held comes back; a Listen along stops)
    call('soundStop');
    call('soundHold', null);
    for (const g of [ui.svg, ui.rsvg, ...[...ui.hosts.values()].map((h) => h.svg)]) { g.style.transition = reduced() ? '' : 'opacity 120ms linear'; g.style.opacity = '0'; }
    ui.raf = 0;
    // the strip leaves the layout at once, and the room it had goes back to the panes
    const focusIn = ui.strip.contains(document.activeElement) || ui.why.contains(document.activeElement);
    ui.strip.remove(); ui.why.remove();
    if (ui.slot) ui.slot.hidden = true;
    if (r.ownSlot) r.ownSlot.remove();
    document.documentElement.style.removeProperty('--tour-h');
    document.documentElement.style.removeProperty('--ph-tour');
    call('slot', 'stage');
    const noStyle = () => { if (r.rootStyle == null && document.documentElement.getAttribute('style') === '') document.documentElement.removeAttribute('style'); };
    setTimeout(() => { ui.root.remove(); ui.top.remove(); for (const H of [...ui.hosts.keys()]) dropHost(ui, H); }, reduced() ? 0 : 140);
    if (opt.keepWork) return;
    // the user's work comes back exactly as it was; the message says so only when it did
    const back = giveBack(r.lend, false);
    call('onTour', false);
    // (r3 review regress-7: no style attribute left on the root that it did not have)
    noStyle();
    if (!opt.silent) {
      const where = helpWhere();
      lastToast = call('toast', !back ? $t('Your work could not be put back here, but it is safe: reload the page to get it back.')
        : !r.lend ? $t('The tour stays under {where}.', { where })
          : opt.finished && r.ci === CHAPTERS.length - 1 ? $t('Tour finished. Your work is back, and the tour stays under {where}.', { where }) : $t('Your work is back. The tour stays under {where}.', { where }));
      const to = r.opener && r.opener.isConnected ? r.opener : anchorEl(['helpBtn', 'moreBtn']);
      // (the focus goes back to the opener when it was in the strip, or nowhere)
      if (focusIn || document.activeElement === document.body || document.activeElement == null) { try { if (to) to.focus({ preventScroll: true }); } catch (e) { /* */ } }
    }
  }

  // ---------------------------------------------------------------- the first-run suggestion
  // (v16.5 UX21, notes/ux-audit REPORT 3.1: the invitation is one line in the tour's own docked slot, never a card over
  // the planes; the slot is the learning lane of wave 2's D7, which also takes an example's Try line: lane())
  function suggest(opt = {}) {
    if (!doc()) return false;
    load();
    // (#34, UX76) a tour cut short by a reload: the lane offers to continue it, in place of the first-run invitation
    const cont = cutShort && !!rec.last;
    cutShort = false;
    if (run || sugg || (!opt.force && !cont && !shouldSuggest(rec))) return false;
    const delay = opt.delay != null ? opt.delay : 1200;
    let tries = 0;
    const attempt = () => {
      if (run || !sugg || !sugg.pending) return;
      // (not while a menu or a dialog is open: wait for it to close, about 15 s at most, then until the next opening)
      if (appLayerOpen() && !opt.force) { if (++tries > 15) { sugg = null; return; } sugg.pending = setTimeout(attempt, 1000); return; }
      sugg = null;
      if (!cont || !showContinue()) showSuggest();
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
    const go1 = () => { hideSuggest(false); start({ chapter: 'basics', opener: anchorEl(['helpBtn', 'moreBtn']) }); };
    const dismiss = () => { rec.outcome = 'dismissed'; rec.v = Math.max(rec.v, VERSION); save(); hideSuggest(true); call('toast', $t('The tour is under {helpWhere} whenever you want it.', { helpWhere: helpWhere() })); };
    const box = laneShow({ id: 'suggest', title, body: $t('Draw a region, send it through a chain of functions and watch its image.'),
      acts: [{ label: $t('Start the tour'), short: $t('Start'), primary: true, run: go1 }, { label: $t('Not now'), run: dismiss }],
      label: $t('Tour suggestion'), drop: 'body', onEsc: () => hideSuggest(true) });
    if (!box) return;
    sugg = { box, lane: true };
    say($t('Tour suggestion: {title}. Start the tour or Not now.', { title }) + ' ' + $t('The tour stays under {where}.', { where: helpWhere() }));
    call('onSuggest', true);
  }
  // (#34, UX76) "Continue the tour: Views", the step it stopped at, [Continue] [×]; × forgets where it stopped (the
  // help menu's Continue the tour goes with it). -> whether the line is shown
  function showContinue() {
    const ch = rec.last && CHAPTERS.find((c) => c.id === rec.last.ch);
    if (!ch || !chapterShown(ch)) return false;
    injectCSS();
    const i = Math.min(rec.last.i, ch.steps.length - 1), title = $t('Continue the tour: {chapter}', { chapter: $t(ch.title) });
    const go1 = () => { hideSuggest(false); start({ chapter: ch.id, step: i, opener: anchorEl(['helpBtn', 'moreBtn']) }); };
    const box = laneShow({ id: 'continue', title, body: stepTitle(ch.steps[i]),
      acts: [{ label: $t('Continue'), primary: true, run: go1 }],
      label: $t('Continue the tour'), drop: 'body', onEsc: () => hideSuggest(true), onClose: () => { sugg = null; rec.last = null; save(); } });
    if (!box) return false;
    sugg = { box, lane: true, id: 'continue' };
    say(title + '. ' + $t('Continue, or close the line.'));
    return true;
  }
  function hideSuggest(anim) {
    if (!sugg) return;
    if (sugg.pending) clearTimeout(sugg.pending);
    const box = sugg.box, id = sugg.id || 'suggest';
    sugg = null;
    if (!box) return;
    laneHide(id, anim);
    if (id === 'suggest') call('onSuggest', false);
  }

  // ---------------------------------------------------------------- v16.5: the learning lane
  // One line at a time in the tour's own docked slot (UX21; wave 2's D7 lane): the first-run invitation, an example's
  // Try line (UX74). It covers nothing: the layout makes room for it as it does for the strip (--tour-h, the stage's
  // first row on a desktop; --ph-tour, a phone's row under the header; a landscape phone's header when it has room).
  // The tour takes the slot while it runs; × or the line's own action ends a line.
  // o: { id, title, body, acts: [{ label, short, primary, run }], label, drop: 'body' | 'title' (what goes first when the
  // line has no room: laneFit), icon, onEsc, onClose }
  const LANE_H = 48;
  let lane = null;
  function laneShow(o) {
    if (!doc() || run) return null;
    injectCSS();
    if (lane) laneHide(lane.id, false);
    const box = el('section', { class: 'tour-lane', role: 'region', 'aria-label': o.label || $t('Guided tour'), 'data-tour': o.id === 'suggest' ? 'suggest' : 'lane', 'data-lane': o.id });
    const markWrap = el('span', { class: 'tl-mark', 'aria-hidden': 'true' });
    markWrap.innerHTML = o.icon || mark();
    const text = el('p', { class: 'tl-text' }, el('b', { class: 'tl-title tour-sg-title' }, o.title || ''));
    if (o.body) text.append(' ', el('span', { class: 'tl-body tour-sg-body' }, richText(o.body)));
    const acts = el('div', { class: 'tl-acts' });
    for (const a of o.acts || []) {
      const b = el('button', { class: 'btn ' + (a.primary ? 'primary' : 'ghost') + ' tl-act', type: 'button', 'data-short': a.short || a.label }, el('span', { class: 'tl-long' }, a.label), el('span', { class: 'tl-short' }, a.short || a.label));
      b.addEventListener('click', () => a.run());
      acts.append(b);
    }
    if (o.onClose) {
      const x = el('button', { class: 'icon-btn tl-x', type: 'button', 'aria-label': $t('Close') });
      x.innerHTML = ICON_X;
      x.addEventListener('click', () => { laneHide(o.id, true); o.onClose(); });
      acts.append(x);
    }
    box.append(markWrap, text, acts);
    box.addEventListener('keydown', (e) => { if (e.key === 'Escape' && o.onEsc) { e.stopPropagation(); o.onEsc(); } });
    lane = { id: o.id, box, o, slot: null, mode: null };
    laneMount();
    addEventListener('resize', laneMount);
    return box;
  }
  function laneMount() {
    if (!lane || run) return;
    let mode = stripMode();
    const where = mode === 'head' ? 'head' : 'stage';
    let slot = call('slot', where);
    if (!(slot && slot.nodeType === 1)) slot = document.getElementById(where === 'head' ? 'tourHeadSlot' : 'tourSlot');
    if (!slot && where === 'head') { mode = 'row'; slot = document.getElementById('tourSlot'); }
    if (!slot) return;
    if (lane.slot && lane.slot !== slot) lane.slot.hidden = true;
    if (lane.box.parentNode !== slot) slot.append(lane.box);
    slot.hidden = false;
    lane.slot = slot; lane.mode = mode; lane.box.dataset.mode = mode;
    const st = document.documentElement.style;
    if (mode === 'desk') { st.removeProperty('--ph-tour'); st.setProperty('--tour-h', (LANE_H + SLOT_GAP) + 'px'); }
    else { st.removeProperty('--tour-h'); st.setProperty('--ph-tour', (mode === 'port' ? 56 : mode === 'row' ? 48 : 0) + 'px'); lane.baseH = phTourGet(); }   // (baseH: the row's own height, which laneFit grows from)
    call('slot', where);
    laneFit();
  }
  // the line's words are never cut mid-sentence: on a desktop one line, else without its optional part (o.drop: the
  // invitation's description, an example's name), else two lines; on a phone two lines, else without the optional part
  function laneFit() {
    if (!lane) return;
    const box = lane.box, tx = box.querySelector('.tl-text');
    if (!tx) return;
    const opt = tx.querySelector(lane.o.drop === 'title' ? '.tl-title' : '.tl-body'), desk = box.dataset.mode === 'desk';
    box.classList.remove('two');
    if (opt) opt.hidden = false;
    const over = () => tx.scrollWidth > tx.clientWidth + 1 || tx.scrollHeight > tx.clientHeight + 1;
    // (a phone's lane: back to its own height first, then grown below if the line needs more)
    box.classList.remove('grow'); delete tx.dataset.lines;
    if (!desk && lane.baseH && phTourGet() !== lane.baseH) laneSetH(lane.baseH);
    if (!over()) return;
    if (opt) { opt.hidden = true; if (!over()) return; if (desk) opt.hidden = false; }
    if (desk) { box.classList.add('two'); return; }
    // (a phone's line that still needs a third line: the lane takes the lines it needs, as the tour's strip does; the lines are 17 px, the text has 7 px above and below)
    // (at most four lines, 82 px: a line that would need a fifth is cut there; example_lane_cut_cmd.js lists such lines)
    box.classList.add('grow');
    tx.style.webkitLineClamp = 'unset'; tx.style.lineClamp = 'unset';
    const full = Math.max(2, Math.ceil((tx.scrollHeight - 1) / PH_LINE));
    tx.style.webkitLineClamp = ''; tx.style.lineClamp = '';
    laneSetH(Math.max(lane.baseH || 56, Math.min(4, full) * PH_LINE + 14));
    tx.dataset.lines = String(full);
  }
  function laneSetH(px) {
    if (phTourSet(px)) call('slot', lane.mode === 'head' ? 'head' : 'stage');
  }
  function laneHide(id, anim) {
    if (!lane || (id && lane.id !== id)) return false;
    const l = lane;
    lane = null;
    removeEventListener('resize', laneMount);
    const focusWasIn = l.box.contains(document.activeElement);
    l.box.remove();
    if (l.slot && !run) l.slot.hidden = true;
    if (!run) {
      const st = document.documentElement.style;
      st.removeProperty('--tour-h'); st.removeProperty('--ph-tour');
      if (document.documentElement.getAttribute('style') === '') document.documentElement.removeAttribute('style');
      call('slot', 'stage');
    }
    if (focusWasIn) { const h = anchorEl(['helpBtn', 'moreBtn']); try { if (h) h.focus({ preventScroll: true }); } catch (e) { /* */ } }
    return true;
  }

  // ---------------------------------------------------------------- the help menu
  function openHelpMenu(anchor, only) {
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
    // (only === 'chapters': the strip's chapter menu, the chapters alone, the running one marked)
    const chaptersOnly = only === 'chapters';
    const head = el('div', { class: 'menu-head', role: 'presentation' }, chaptersOnly ? $t('Chapters') : $t('Guided tour'));
    const kids = [head];
    const resume = rec.last && CHAPTERS.find((c) => c.id === rec.last.ch);
    if (chaptersOnly) { /* the chapters follow */ } else if (resume && !(rec.last.i === 0 && rec.last.ch === 'basics')) {
      const st = resume.steps[Math.min(rec.last.i, resume.steps.length - 1)];
      kids.push(mi('tour-continue', `<span class="mi-ic">${ICON_PLAY}</span><span class="mi-label">${esc($t('Continue the tour'))}<span class="tour-sub">${esc($t(resume.title))}: ${esc(stepTitle(st))}</span></span>`,
        () => start({ chapter: resume.id, step: rec.last.i, opener: anchor })));
    } else {
      kids.push(mi('', `<span class="mi-ic">${ICON_PLAY}</span><span class="mi-label">${esc($t('Take the tour'))}</span><span class="mi-key">${esc($t('2 min'))}</span>`, () => start({ chapter: 'basics', opener: anchor })));
    }
    if (!chaptersOnly) kids.push(el('div', { class: 'msep', role: 'separator' }));
    const here = run && run.ci != null ? CHAPTERS[run.ci] : null;
    CHAPTERS.forEach((c, i) => {
      if (!chapterShown(c)) return;
      const done = chapterDone(rec, c), fresh = chapterNew(rec, c);
      const title = $t(c.title), time = $t(c.time);
      kids.push(mi('', `<span class="tour-num">${i + 1}</span><span class="mi-label">${esc(title)}${fresh ? ` <span class="tour-new">${esc($t('New'))}</span>` : ''}</span>${done ? `<span class="tour-done" aria-label="${esc($t('done'))}">${ICON_CHECK}</span>` : ''}<span class="tour-time">${esc(time)}</span>`,
        () => start({ chapter: c.id, opener: anchor }), Object.assign({ 'aria-label': `${title}, ${time}${done ? $t(', done') : ''}` }, here === c ? { 'aria-current': 'step' } : {})));
    });
    // (#34 T1) the strip's chapter menu also holds Move on by itself, a checkbox, where the timer icon was
    if (chaptersOnly) {
      kids.push(el('div', { class: 'msep', role: 'separator' }));
      const on = rec.auto !== false;
      kids.push(mi('', `<span class="mi-ic">${on ? ICON_CHECK : ''}</span><span class="mi-label">${esc($t('Move on by itself'))}</span>`, () => setAuto(!on), { role: 'menuitemcheckbox', 'aria-checked': String(on) }));
    }
    if (!chaptersOnly) kids.push(el('div', { class: 'msep', role: 'separator' }));
    // on a touch screen there are no keys to show
    const keys = !coarse();
    if (!chaptersOnly) kids.push(mi('', `<span class="mi-ic">${ICON_BOOK}</span><span class="mi-label">${esc($t('Guide'))}</span>${keys ? '<span class="mi-key">?</span>' : ''}`, () => call('openGuide')));
    if (keys && !chaptersOnly) kids.push(mi('', `<span class="mi-ic">${ICON_KEYS}</span><span class="mi-label">${esc($t('Keyboard shortcuts'))}</span>`, () => call('openGuide', 'keys')));
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
    // (#34, UX76) a tour that was running and is not running in another page (its heartbeat is stale or gone): cut short
    cutShort = !run && rec.open && !liveElsewhere();
    if (cutShort) { rec.open = false; save(); }
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
    suggest, dismissSuggestion: () => hideSuggest(false), openHelpMenu,
    // (#34, UX76; tests) the line that continues a tour cut short, at once: -> whether it is shown
    offerContinue: () => { load(); if (run || sugg) return false; return showContinue(); },
    // (v16.5) the learning lane: one closable line in the tour's docked slot (an example's Try line, UX74)
    lane: (o) => !!laneShow(o || {}), laneHide: (id) => laneHide(id || null, false), laneId: () => (lane ? lane.id : null), closeHelpMenu: () => closeMenu(false),
    isSeen: () => seenRec(load()), isActive: () => !!run, reset,
    chapters: () => CHAPTERS.map((c) => ({ id: c.id, title: c.title, time: c.time, steps: c.steps.length, done: chapterDone(rec, c) })),
    current: () => (run ? { chapter: CHAPTERS[run.ci].id, step: run.si, id: CHAPTERS[run.ci].steps[run.si].id } : null),
    // the spotlight's geometry, for the browser checks: the lit areas (padded, in px), the anchor's own box, and (v16.4)
    // the strip's box, the phone's sheet, the countdown { left (ms), held: [kinds], state }, and the step's explanation as
    // plain text (body: the copy the strip no longer shows; the tests read what the steps say from it)
    lit: () => {
      if (!(run && run.ui && run.ui.holes)) return null;
      const ui = run.ui, a = run.el && run.el.isConnected ? run.el.getBoundingClientRect() : null, sb = ui.strip.getBoundingClientRect();
      const c = run.cd || cdInit();
      return { holes: ui.holes.map((h) => ({ l: h.l, t: h.t, r: h.r, b: h.b })), anchor: a ? { l: a.left, t: a.top, r: a.right, b: a.bottom } : null, scenes: run.scenes, scene: run.scene == null ? null : run.scene,
        strip: { l: sb.left, t: sb.top, r: sb.right, b: sb.bottom }, mode: ui.mode, why: !!ui.whyOpen, whyPanel: !!ui.whyPanel, done: !!run.done, quiet: !!ui.quiet, lines: ui.lines || 2, hint: run.hint || null,
        countdown: { left: cdLeft(c, performance.now()), held: c.holds.slice(), state: c.phase === 'fired' ? 'running' : c.phase },
        body: run.step ? plainCopy(copyFor(run.step, run.scene, { menu: run.inMenu }), modKey()) : '',
        work: (ui.work || []).map((h) => ({ l: h.l, t: h.t, r: h.r, b: h.b })), hosted: ui.hosts.size, layers: appLayers().length, moving: !!ui.anim || ui.strip.getAttribute('aria-busy') === 'true', skipped: skippedList() };
    },
    // Move on by itself (v16.4): read, or set (true or false)
    auto: (on) => { if (on === true || on === false) return setAuto(on); load(); return rec.auto !== false; },
    // the steps the running (else the last) tour skipped: [{ id: 'chapter/step', why: 'missing' | 'clipped' | 'scene' }]
    skipped: skippedList,
    // internals for the tests and the design tables
    _t: { cutShort: () => cutShort, CHAPTERS, PLANES, SV_ON, SCENES, ANCHORS, LOOK, parseCopy, texPlain, plainCopy, rrPath, litAreas, ms, normRec, seenRec, shouldSuggest, chapterDone, chapterNew, seek, absent, sceneAt, pickScene, copyFor, tryFor, leadFor, chapterShown, probeInOut, harpUpDown, countdown, cdLeft, cdInit, CD_MS, SUGGEST_MAX, KEY, STASH, LIVE, clippedAway,
      // (r3 review: the lines the running chapter's strip line needs here, for the browser checks)
      needLines: (dbg) => (run ? needLines(run, dbg) : null) },
  };
  return Tour;
})();
// a global binding for the app's scripts, and window.Tour for pages and tools that look it up there
if (typeof window !== 'undefined') window.Tour = Tour;
export { Tour };
