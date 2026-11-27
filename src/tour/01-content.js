  // the interface language (src/i18n.js, notes/i18n/DESIGN.md): $t(english, params). Run alone (the node tests), the
  // tour keeps its English: the same placeholder rule, %{name} always and {name} only in a template without TeX
  const I18 = typeof globalThis !== 'undefined' && /** @type {any} */ (globalThis).I18N ? /** @type {any} */ (globalThis).I18N : null;
  const $t = I18 ? I18.t : (s, p) => (p ? s.replace(/%\{(\w+)\}|\{(\w+)\}/g, (m, a, b) => { const k = a || (!/[$\\]/.test(s) && b); return k && k in p ? String(p[k]) : m; }) : s);
  // Russian notation (tg, sh, ln) where the tour sets TeX; English unchanged
  const notation = (tex) => (I18 ? I18.notation(tex) : tex);
  const VERSION = 3;          // content version; a chapter whose `rev` is newer than what a user saw is marked New
                              // (2: the Inspector, the F tile, the planes' menu, shared numbers, the phone layout;
                              // 3: the docked strip, a task in most steps, the Sound chapter)
  const SUGGEST_MAX = 3;      // an ignored suggestion comes back on at most this many openings

  // ---------------------------------------------------------------- content
  // Scenes are in the format of the app's examples (EX in app.js). `needs` names an app feature the scene relies on
  // (api.has(feature) === false: a step falls back to the next scene of its list, or is left out). `look` is the
  // display the copy assumes; the tour applies it with api.setLook right after api.loadScene, so a user's own opacity
  // or Landscape height never makes the copy false (restore() brings the user's look back).
  // (sectors, the phase sectors of Tiles: 12 lines 30° apart, Hear the function's notes)
  const LOOK = { alpha: null, height: 'log', sheets: false, phaseStyle: 'enhanced', paths: true, allAtOnce: false, sectors: 12 };
  const look = (o) => Object.assign({}, LOOK, o || {});
  const SCENES = {
    strip: {
      name: 'Strip to disk', view: { cx: 0, cy: 0, s: 52 }, look: look(),
      shapes: [{ kind: 'formula', expr: '|\\Im z|<\\frac{\\pi}{2}' }, { kind: 'line', a: [0, 0.8], b: [1, 0.8] }, { kind: 'point', p: [0, 0], label: 'z₀' }],
      steps: [{ type: 'exp', params: {} }, { type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' } }],
    },
    // notes/formula-steps/DESIGN.md 11: a typed formula that is a chain of catalog steps
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
    // the same maps as z² + 1 and then 1/w: the steps view shows no F chip on a one-step chain, so its F tour steps run on two steps
    residueZp2: {
      name: 'A residue by integration', needs: 'zp', view: { cx: 0, cy: 0.5, s: 80 }, look: look(),
      shapes: [{ kind: 'circle', c: [0, 1], r: 1 }],
      steps: [{ type: 'custom', params: { expr: 'z^2+1', cut: 180 } }, { type: 'zp', params: { a: '1', zeros: '', poles: '0' } }],
    },
    residue2: {
      name: 'A residue by integration', view: { cx: 0, cy: 0.5, s: 80 }, look: look(),
      shapes: [{ kind: 'circle', c: [0, 1], r: 1 }],
      steps: [{ type: 'custom', params: { expr: 'z^2+1', cut: 180 } }, { type: 'custom', params: { expr: '\\frac{1}{z}', cut: 180 } }],
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
    // one shared number a (src/params.js) used twice: the zeros ±a of the step and the radius of the circle
    // |z| = a (a shape field bound to a), so its slider moves both. `params` is the app's S.params
    numbers: {
      name: 'A shared number', needs: 'params', view: { cx: 0, cy: 0, s: 80 }, look: look(),
      params: [{ name: 'a', value: 1, min: 0.2, max: 1.8, step: 0.01 }],
      shapes: [{ kind: 'rect', a: [-1.5, -1.5], b: [1.5, 1.5] }, { kind: 'circle', c: [0, 0], r: 1, bind: { r: 'a' } }],
      steps: [{ type: 'custom', params: { expr: '\\frac{z^2-a^2}{z^2+1}', cut: 180 } }],
    },
    // constructions: 1/z, three free points z₀, z₁, z₂ and the line through z₀ and z₁ (its ends bound to them)
    construct: {
      name: 'Constructions', needs: 'constructions', view: { cx: 0, cy: 0, s: 80 }, look: look(),
      shapes: [{ kind: 'point', id: 'tc0', p: [-1.5, -0.5] }, { kind: 'point', id: 'tc1', p: [1, -1] }, { kind: 'point', id: 'tc2', p: [0.25, 1.25] },
        { kind: 'line', id: 'tc3', a: [-1.5, -0.5], b: [1, -1], at: { a: { s: 'tc0' }, b: { s: 'tc1' } } }],
      steps: [{ type: 'recip', params: {} }],
    },
    // notes/tour-r3/SPEC.md 4.2: the Grieg example itself, asked from the app at load time (app: its
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
  // try.ctl names the controls that complete the Try it (a tool's button, a slider, a view's key), lit while the
  // Try it shows, each its own area or a ring inside a lit one, and reachable with Tab; try.work names parts lit on a
  // touch screen only. live: the anchor is looked up again whenever the layout changes (a phone's tool in the More tools
  // sheet, then on the More key).
  // The panes are named by their role, X and Y, never left and right: on a phone they stack.
  // notes/tour-r3/SPEC.md 3: lead, one sentence the strip shows without a tap (what to look at; required on a
  // step with no task, with tryWide or with try.after); try.then, the result line once the task is done; try.after, an
  // earlier step of the chapter whose task must have been done in this run for this one to show; act: 'listen' (the
  // strip's Listen button) or 'sound' (Turn on sound, while the sound is not ready); hear: the step turns Hear the
  // function on (the user's setting comes back); captions: [[seconds, text]] shown while the step's piece plays
  // (capFrac: [[fraction of the playback, text]], for a Listen along whose duration is the curve's length at the zoom).
  // A task step moves on by itself CD_MS (1.5 s) after it is done (SPEC 2); try.advance (a door) after 0.7 s.
  // (try.off, the task while the sound is off, on a step whose act button turns it on; try.hint { on, test,
  // text, touch }, a line shown in place of the task when that event says the attempt went wrong)
  const orbit = (e) => !e || e.how === 'orbit';
  // the steps view's chapters, "Planes" and "Playing the chain". Each step puts the view where its task needs it (svPlace)
  // and is done by one of the events the steps view sends
  const PLANES = {
    id: 'planes', title: 'Planes', time: '2 min', rev: 1, scene: 'strip',
    steps: [
      { id: 'plane', anchor: 'paneL', title: 'One plane at a time', before: [['svPlace', { i: 0, T: -1, scope: 'all', surf: 'plane' }]],
        body: 'The view shows one plane of the chain, here $z$. Its colours come from the colour plane, the dot with the wheel on the thread.',
        try: { text: 'Drag empty space, or scroll to zoom.', touch: 'Drag empty space, or pinch.', on: 'view-moved', test: (e) => !e || e.how !== 'orbit', ctl: ['paneL'] } },
      { id: 'thread', anchor: 'svStrip', also: ['paneL'], title: 'The thread', before: [['svPlace', { i: 0 }]],
        body: 'Each dot is a plane, $z$, $w_1$, $w_2$; each chip between two dots is a step. ‹ › or ← → glide to the next plane, and the picture deforms along the step.',
        try: { text: 'Click ›, or press →.', touch: 'Tap ›, or swipe in from the right edge.', on: 'plane-changed', ctl: ['svNext'] } },
      { id: 'park', anchor: 'svRing', also: ['svStrip'], title: 'Between two planes', before: [['svPlace', { i: 0 }]],
        body: 'Drag the ring and let go between two dots: the view stays there and shows the step part way. Shift+← → moves a quarter step.',
        try: { text: 'Drag the ring halfway to the next dot.', touch: 'Drag the ring halfway to the next dot.', on: 'thread-parked', ctl: ['svRing'] } },
      { id: 'colour', anchor: 'svCp', also: ['svStrip'], title: 'The colour plane', before: [['svPlace', { i: 1, T: -1 }]],
        body: 'The colour plane holds the colour wheel. Every plane before it shows the wheel pulled back through the steps. Colour from here, or {C}, makes the shown plane the colour plane.',
        try: { text: 'Press {C}, or click Colour from here.', touch: 'Tap the wheel button.', on: 'colour-plane-set', ctl: ['svCp'] } },
      { id: 'carried', anchor: 'paneL', also: ['svStrip'], title: 'Past the colour plane', before: [['svPlace', { i: 1, T: 1 }]],
        body: 'Planes after it keep its colours: each point carries the colour it had there. The readout names where a point came from.',
        try: { text: 'Click ›, then hover a point.', touch: 'Tap ›, then hold a point and slide.', on: 'probe', test: (e) => !e || !!e.past, ctl: ['svNext'] } },
      { id: 'inside', anchor: 'svScope', title: 'Inside regions', before: [['svPlace', { i: 0, T: -1, scope: 'all' }]],
        body: 'Colour only inside the regions you draw, in every plane: a region and its images keep the same colours through the chain.',
        try: { text: 'Choose Inside regions.', touch: 'Choose Inside.', on: 'scope-changed', test: (e) => !e || e.s === 'in', ctl: ['svScope'] } },
      { id: 'surface', anchor: 'svSurf', title: 'Sphere and Landscape', before: [['svPlace', { i: 0, scope: 'all', surf: 'plane' }]],
        body: 'The same plane on the Riemann sphere, or as a landscape of the modulus. ‹ › glide on the sphere too.',
        try: { text: 'Choose Sphere.', touch: 'Tap the surface button, then Sphere.', on: 'surface-changed', test: (e) => !e || e.s === 'sphere', ctl: ['svSurf'] } },
      { id: 'step', anchor: 'svChip', title: 'Edit a step', before: [['svPlace', { i: 0, surf: 'plane' }]],
        body: 'A chip opens its step in the Inspector: change the function, its parameters or its formula, and every plane after it follows.',
        try: { text: 'Click the chip $f_1$.', touch: 'Tap the chip $f_1$.', on: 'step-selected', test: (e) => !e || e.k === 1, ctl: ['svChip'] } },
    ],
  };
  const PLAYING = {
    id: 'playing', title: 'Playing the chain', time: '1 min', rev: 1, scene: 'strip',
    steps: [
      { id: 'play', anchor: 'svPlay', also: ['svStrip'], title: 'Play', before: [['svPlace', { i: 0, T: -1, scope: 'all', surf: 'plane' }]],
        body: 'Play glides the picture along the whole chain, plane after plane, and stops at the last. Pause it anywhere: the view stays where it is.',
        try: { text: 'Click ▶, or press {K}.', touch: 'Tap ▶.', on: 'play-started', ctl: ['svPlay'] } },
      { id: 'speed', anchor: ['svSpeed', 'svPlay'], also: ['svStrip'], title: 'Speed and loop', before: [['svPlace', { i: 0 }]],
        body: 'The speed select sets how long each step takes. Click Loop to start over at the end instead of stopping.',
        deskTouch: 'The speed select sets how long each step takes. Tap Loop to start over at the end instead of stopping.', phoneFine: 'Hold ▶ to open Playback: its speed select sets how long each step takes, and clicking Loop starts over at the end instead of stopping.',
        touch: 'Hold ▶ to open Playback: its speed select sets how long each step takes, and tapping Loop starts over at the end instead of stopping.',
        try: { text: 'Click Loop.', deskTouch: 'Tap Loop.', phoneFine: 'Hold ▶, then click Loop.', touch: 'Hold ▶, then tap Loop.', on: 'loop-changed', ctl: ['svLoop'] } },
      { id: 'range', anchor: 'svRail', also: ['svStrip'], title: 'Part of the chain', before: [['svPlace', { i: 0 }]],
        body: 'A band over the thread plays only the steps inside it. Esc clears it.',
        deskTouch: 'A band over the thread plays only the steps inside it. Hold the thread, then drag across two chips.', phoneFine: 'A band over the thread plays only the steps inside it. Shift-drag across two chips; Esc clears it.',
        touch: 'A band over the thread plays only the steps inside it. Hold the thread, then drag across two chips.',
        try: { text: 'Shift-drag across two chips.', deskTouch: 'Hold the thread, then drag across two chips.', phoneFine: 'Shift-drag across two chips.', touch: 'Hold the thread, then drag across two chips.', on: 'range-set', ctl: ['svRail'] } },
    ],
  };
  const reorderMenu = 'In the ⋯ menu of $f_2$, choose Move left.';
  const reorderStep = { id: 'reorder', anchor: 'svMenu2', also: ['svStrip'], title: 'Reorder steps', before: [['svPlace', { i: 0, surf: 'plane' }]],
    body: 'A step\'s place in the chain decides what every plane after it shows.' + ' Move one with its ⋯ menu, or Alt+← and Alt+→ on the selected chip.', deskTouch: 'A step\'s place in the chain decides what every plane after it shows.' + ' Move one with its ⋯ menu.',
    touch: 'A step\'s place in the chain decides what every plane after it shows.' + ' Move one from its menu: hold the chip.', phoneFine: 'A step\'s place in the chain decides what every plane after it shows.' + ' Move one from its menu (right-click the chip), or Alt+← and Alt+→ on the selected chip.',
    try: { text: reorderMenu, deskTouch: reorderMenu, touch: 'Hold the chip $f_2$, then choose Move left.', phoneFine: 'Right-click the chip $f_2$, then choose Move left.', on: 'step-moved', test: (/** @type {any} */ e) => !e || e.from === 2, ctl: ['svMenu2'], then: 'The planes after this step changed with the order.' } };
  // a shape drawn on a later plane, its preimage on z under Inside regions; ticked by a disc drawn on a later plane, then ‹ to z
  const drawnLater = (/** @type {any} */ e, /** @type {any} */ m) => {
    if (!e) return true;
    if ('stage' in e) { m.drawn = e.stage > 0; return false; }
    return !!m.drawn && e.i === 0;
  };
  const CHAPTERS = [
    {
      id: 'basics', title: 'Basics', time: '2 min', rev: 3, scene: 'strip',
      steps: [
        { id: 'welcome', anchor: null, title: 'Welcome to the Workbench', before: [['view', 'xy'], ['surface', 'L', 'plane'], ['surface', 'R', 'plane'], ['tool', 'select']],
          lead: 'Practice freely: what you draw here is cleared at the end.',
          body: 'Draw a set in the $z$-plane, send it through a chain of functions and watch its image: about two minutes. What you draw during the tour is cleared when it ends, and your own work comes back exactly as it was.' },
        // (the Disc tool itself, where it shows: the Draw panel, the rail, a phone's tool row; live: the lit tool is
        // looked up again as the layout changes)
        { id: 'draw', anchor: 'tool:disc', also: ['paneL'], live: true, title: 'Draw a shape', before: [['plane', 'L']],
          body: 'Pick a tool and drag in the plane to add a shape. On a later plane the same tools add a shape that belongs to that plane.',
          try: { text: 'Choose Disc, then drag in the plane.', on: 'shape-added', then: 'The next plane shows its image under $F$.' } },
        // (tryWide: on a phone the list and X are a screen apart, so the drag is not asked for there)
        { id: 'shapes', anchor: 'shapes', also: ['paneL'], title: 'Your shapes', before: [['tool', 'select'], ['panel', 'left', 'tools:shapes']], tryWide: true,
          lead: 'Each shape is listed with its equation.',
          body: 'Each shape is listed with its equation; the eye hides it and ⋯ has the rest: duplicate, delete, integrate. With Select {V}, drag a shape or a handle and the image follows; {mod}{Z} undoes.',
          touch: 'Each shape is listed with its equation; the eye hides it and ⋯ has the rest: duplicate, delete, integrate. With Select, drag a shape or a handle and the image follows.',
          try: { text: 'Press {V}, then drag the line $\\operatorname{Im} z=0.8$ up or down.', touch: 'Tap the line $\\operatorname{Im} z=0.8$, then drag it up or down.', on: 'shape-moved', ctl: ['tool:select'], then: 'Y followed the line as you dragged it.' } },
        // (the task on a phone too, where the step's tools sheet holds the field and Add; its example is
        // not the field's placeholder, which reads like a filled field)
        { id: 'formula', anchor: 'formula', also: ['paneL'], title: 'Sets from formulas', before: [['panel', 'left', 'tools:shapes']],
          body: 'Type a set and click Add, such as $|z-1|<2$ or $0<\\operatorname{Im} z<\\pi$. An equation like $|z|=1$ adds a curve, and a formula in $w$ adds a target.',
          // (a phone's words for the places and gestures, here and below)
          touch: 'Type a set and tap Add, such as $|z-1|<2$ or $0<\\operatorname{Im} z<\\pi$. An equation like $|z|=1$ adds a curve, and a formula in $w$ adds a target.',
          try: { text: 'Type $|z+1|<1$ and click Add.', touch: 'Type $|z+1|<1$ and tap Add.', on: 'shape-added', test: (e) => !e || e.via === 'formula', then: 'A set from a formula is a shape like any other.' } },
        // (the open catalog holds the countdown: it moves on CD_MS after it closes)
        { id: 'add', anchor: 'svAdd', also: ['svStrip'], title: 'Add a function', before: [['focus', 0]],
          body: 'Add function on the thread adds a step: pick one from the catalog or type a formula such as $\\sin(z^2)$.' + ' Click a chip\'s ⋯ to move it, bypass it or remove it.', deskTouch: 'Add function on the thread adds a step: pick one from the catalog or type a formula such as $\\sin(z^2)$.' + ' Tap a chip\'s ⋯ to move it, bypass it or remove it.',
          touch: 'Add function on the thread adds a step: pick one from the catalog or type a formula such as $\\sin(z^2)$.' + ' Hold a chip to open its menu, which moves it, bypasses it or removes it.', phoneFine: 'Add function on the thread adds a step: pick one from the catalog or type a formula such as $\\sin(z^2)$.' + ' Right-click a chip to open its menu, which moves it, bypasses it or removes it.',
          try: { text: 'Click Add function.', touch: 'Tap Add function.', on: 'layer-opened', test: (/** @type {any} */ e) => !e || e.kind === 'catalog', ctl: ['svAdd'] } },
        { id: 'examples', anchor: ['examples', 'moreBtn'], title: 'Examples',
          lead: 'Worked examples, from Joukowski to a residue.',
          body: 'Worked examples, from the Joukowski airfoil to a residue found by integration. Open one whenever you want a starting point.',
          narrow: 'Worked examples are in this menu, from the Joukowski airfoil to a residue found by integration.' },
      ],
    },
    PLANES,
    PLAYING,
    {
      // notes/ui-redesign-2: the Inspector, zeros and poles, the planes' menu, shared numbers
      id: 'edit', title: 'Editing the chain', time: '1½ min', rev: 4, scene: 'strip',
      steps: [
        reorderStep,
        // (on a phone the panel action opens the Editor sheet, with X and Y side by side above it)
        // (on a touch screen the step is the editor's: its title and line say so)
        { id: 'inspector', anchor: 'inspector', also: ['chain'], title: 'The Inspector', titleTouch: 'The editor', before: [['view', 'xy'], ['surface', 'L', 'plane'], ['surface', 'R', 'plane'], ['select', 2], ['panel', 'right']], wait: 120,
          lead: 'The Inspector edits the selected step, here $f_2$.', leadTouch: 'The editor edits the tapped step, here $f_2$.', leadDeskTouch: 'The Inspector edits the selected step, here $f_2$.', leadPhoneFine: 'The editor edits the clicked step, here $f_2$.',
          body: 'The Inspector edits the selected step: its formula in full, a roomy field per coefficient, and ⋯ for the inverse, bypass, move and remove. A step\'s own coefficients carry its index, as $a_2$ here.',
          touch: 'A tapped card opens its editor in the sheet, with X and Y side by side above it, so the image changes as you type. A step\'s own coefficients carry its index, as $a_2$ here.', deskTouch: "The Inspector edits the selected step: its formula in full, a roomy field per coefficient, and ⋯ for the inverse, bypass, move and remove. A step's own coefficients carry its index, as $a_2$ here.", phoneFine: "A clicked card opens its editor in the sheet, with X and Y side by side above it, so the image changes as you type. A step's own coefficients carry its index, as $a_2$ here.",
          // (Replace… is the first item of ⋯; the search then takes this step's place)
          try: { text: 'In ⋯, choose Replace…, then pick a function.', on: 'step-replaced', test: (e) => !e || e.k === 2, ctl: ['invBtn'], then: 'Only $f_2$ changed; Undo brings the old one back.' } },
        // (the Inspector shows how a typed formula is built from catalog steps; split: the offer shows in the tour)
        { id: 'split', anchor: 'splitOffer', also: ['chain'], title: 'A formula in steps', split: true, before: [['scene', 'splitFormula'], ['view', 'xy'], ['surface', 'L', 'plane'], ['surface', 'R', 'plane'], ['select', 1], ['panel', 'right']], wait: 120,
          body: 'This formula is a chain of catalog steps; the Inspector shows how it is built. Split it, and each step gets its own chip and plane: the glide then plays through them. Undo brings the formula back.',
          touch: 'This formula is a chain of catalog steps; its editor shows how it is built. Split it, and each step gets its own chip and plane: the glide then plays through them. Undo brings the formula back.', deskTouch: 'This formula is a chain of catalog steps; the Inspector shows how it is built. Split it, and each step gets its own chip and plane: the glide then plays through them. Undo brings the formula back.', phoneFine: 'This formula is a chain of catalog steps; its editor shows how it is built. Split it, and each step gets its own chip and plane: the glide then plays through them. Undo brings the formula back.',
          try: { text: 'Click Split into 3 steps.', touch: 'Tap Split into 3 steps.', on: 'formula-split', ctl: ['splitBtn'], then: 'A chip and a plane for each transform; undo brings it back.' } },
        { id: 'zp', anchor: 'zpCard', also: ['paneL'], title: 'Zeros and poles', before: [['scene', 'zp'], ['view', 'xy'], ['tool', 'select'], ['select', 1], ['panel', 'right']], wait: 120,
          body: 'This step is built from its zeros and poles. Drag one in X, or click Add zero or Add pole for a new one: the map and its image follow. The axes button beside a coefficient picks a value on a small Argand diagram.',
          touch: 'This step is built from its zeros and poles. Drag one in X, or tap Add zero or Add pole for a new one: the map and its image follow.', deskTouch: 'This step is built from its zeros and poles. Drag one in X, or tap Add zero or Add pole for a new one: the map and its image follow. The axes button beside a coefficient picks a value on a small Argand diagram.', phoneFine: 'This step is built from its zeros and poles. Drag one in X, or click Add zero or Add pole for a new one: the map and its image follow.',
          try: { text: 'Drag a zero or a pole.', on: 'zp-moved', ctl: ['tool:select'], then: '$F$ and its image followed the mark.' } },
        { id: 'numbers', anchor: 'params', also: ['panes'], title: 'Numbers', before: [['scene', 'numbers'], ['view', 'phase'], ['select', 1], ['panel', 'right']], wait: 120,
          body: 'Type a new letter such as $a$ in any field, and a slider $a$ appears under Numbers. Here $a$ sets both zeros $\\pm a$ of $F$ and the circle $|z|=a$: drag the slider, and they move together.',
          try: { text: 'Drag the slider of $a$.', on: 'number-changed', ctl: ['paramSlider'], then: 'The zeros $\\pm a$ and the circle $|z|=a$ moved together.' } },
      ],
    },
    {
      // notes/constructions-v16/SPEC.md 16: circles through three points, following, snapping to crossings  standards-ok: a spec path in notes/
      id: 'construct', title: 'Constructions', time: '1 min', rev: 2, scene: 'construct',
      steps: [
        // (the Circle through 3 points tool itself; on a phone the More tools sheet opens with its tile, and once
        // it is picked the More key, which then shows it, is lit)
        { id: 'c3', anchor: 'tool:circle3', also: ['paneL'], live: true, title: 'Circle through three points', before: [['view', 'xy'], ['surface', 'L', 'plane'], ['surface', 'R', 'plane'], ['plane', 'L'], ['panel', 'sheet', 'tools:construct']],
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
      id: 'analysis', title: 'Analysis', time: '1½ min', rev: 2, scene: 'roots',
      steps: [
        { id: 'targets', anchor: 'paneL', also: ['svStrip'], title: 'Shapes on a later plane',
          before: [['svPlace', { i: 1, T: -1, scope: 'in', surf: 'plane' }]],
          body: 'A shape drawn on a later plane belongs to that plane. Under Inside regions every plane is coloured only inside its regions, and a later plane\'s regions are pulled back: on $z$, the colour marks every point the map sends into them, all of their preimages at once.',
          try: { text: 'On $w_1$, draw a disc, then click ‹ (or press ←).', touch: 'On $w_1$, draw a disc, then tap ‹.', on: ['shape-added', 'plane-changed'], test: drawnLater, ctl: ['tool:disc', 'svPrev'], then: 'Plane $z$ shows where the disc comes from.' } },
        // (on a desktop the style control is in X's pane head, or behind its ⋯ button, lit then)
        { id: 'cauchy', anchor: ['phaseStyle', 'leftOpts', 'panes'], also: ['panes'], title: 'Cauchy integral', before: [['view', 'phase'], ['surface', 'L', 'plane'], ['look', { phaseStyle: 'cauchy' }], ['tool', 'select']],
          lead: 'Cauchy\'s integral is $F$ inside $\\gamma$ and $0$ outside.',
          body: 'The phase style Cauchy plots $\\frac{1}{2\\pi i}\\oint_\\gamma\\frac{F(\\zeta)}{\\zeta-z}\\,d\\zeta$ over a closed curve $\\gamma$, here the unit circle. It equals $F(z)=z^3-1$ inside and $0$ outside; the three zeros of $F$ lie on $\\gamma$ itself. With several closed curves, the selected one is used.',
          try: { text: 'Drag the circle γ.', touch: 'Tap the circle γ, then drag it.', on: 'shape-moved', ctl: ['tool:select'], then: 'The integral is worked out again as γ moves.' } },
        // (the open popover holds the countdown: it moves on CD_MS after it closes)
        { id: 'integral', anchor: 'paneL', title: 'Integrals', before: [['scene', ['residueZp', 'residue']], ['view', 'xy'], ['tool', 'select'], ['plane', 'L']],
          body: 'Right-click the circle itself and choose $\\oint F\\,dz$: you get the integral, the winding number and the zeros and poles inside. It encloses the pole $i$ of $1/(z^2+1)$, so $\\oint=2\\pi i\\,\\operatorname{Res}_i F=\\pi$.',
          touch: 'Hold the circle itself and choose $\\oint F\\,dz$: you get the integral, the winding number and the zeros and poles inside. It encloses the pole $i$ of $1/(z^2+1)$, so $\\oint=2\\pi i\\,\\operatorname{Res}_i F=\\pi$.',
          try: { text: 'Right-click the circle, then choose $\\oint$.', touch: 'Hold the circle, then choose $\\oint$.', on: 'integral-opened', then: '$\\oint=2\\pi i\\,\\operatorname{Res}_i F=\\pi$.' } },
        // (api.anchor selects the F tile for these names, so the Inspector shows F; on a phone, in the Editor sheet)
        { id: 'domain', anchor: 'domain', also: ['fTile', 'svF'], title: 'Natural domain', before: [['scene', ['residueZp2', 'residue2']], ['panel', 'right']],
          lead: 'Here $F$ is defined for every $z$ except $\\pm i$.',
          body: 'Select the F tile at the end of the chain, and the Inspector shows where every step is defined. For a typed formula it reads "the formula is defined at $z$": here every $z$ except the poles $\\pm i$.',
          touch: 'Tap the F tile at the end of the chain, and its editor shows where every step is defined. For a typed formula it reads "the formula is defined at $z$": here every $z$ except the poles $\\pm i$.', deskTouch: 'Tap the F tile at the end of the chain, and the Inspector shows where every step is defined. For a typed formula it reads "the formula is defined at $z$": here every $z$ except the poles $\\pm i$.', phoneFine: 'Click the F tile at the end of the chain, and its editor shows where every step is defined. For a typed formula it reads "the formula is defined at $z$": here every $z$ except the poles $\\pm i$.',
          byScene: { residueZp2: 'Select the F tile at the end of the chain, and the Inspector shows where every step is defined: here every $z$ except the poles $\\pm i$, written $z\\notin\\{i,-i\\}$.', residueZp: 'Select the F tile at the end of the chain, and the Inspector shows where every step is defined: here every $z$ except the poles $\\pm i$, written $z\\notin\\{i,-i\\}$.' },
          touchByScene: { residueZp2: 'Tap the F tile at the end of the chain, and its editor shows where every step is defined: here every $z$ except the poles $\\pm i$, written $z\\notin\\{i,-i\\}$.', residueZp: 'Tap the F tile at the end of the chain, and its editor shows where every step is defined: here every $z$ except the poles $\\pm i$, written $z\\notin\\{i,-i\\}$.' }, deskTouchByScene: { residueZp2: 'Tap the F tile at the end of the chain, and the Inspector shows where every step is defined: here every $z$ except the poles $\\pm i$, written $z\\notin\\{i,-i\\}$.', residueZp: 'Tap the F tile at the end of the chain, and the Inspector shows where every step is defined: here every $z$ except the poles $\\pm i$, written $z\\notin\\{i,-i\\}$.' }, phoneFineByScene: { residueZp: 'Click the F tile at the end of the chain, and its editor shows where every step is defined: here every $z$ except the poles $\\pm i$, written $z\\notin\\{i,-i\\}$.' },
          try: { text: 'Click the F tile.', touch: 'Tap the F tile.', on: 'step-selected', test: (e) => !e || e.k === 'F', ctl: ['fTile', 'svF'], then: 'The Inspector lists where every step is defined.' } },
        { id: 'guarantees', anchor: 'guarantees', also: ['fTile', 'svF'], title: 'Guarantees', before: [['panel', 'right']],
          lead: 'What the chain guarantees: always true when listed.',
          body: 'The F tile names what the chain guarantees. A property is listed only when every step has it and composition keeps it, so it is always true; one not listed is not implied, but may hold. Step by step shows which step brings which.' },
      ],
    },
    {
      id: 'branches', title: 'Branches and inverses', time: '1 min', rev: 3, scene: 'logAnnulus',
      steps: [
        { id: 'cut', anchor: 'paneL', title: 'Branch cuts', before: [['view', 'xy'], ['surface', 'L', 'plane'], ['surface', 'R', 'plane'], ['tool', 'select'], ['plane', 'L']],
          body: '$\\log z$ needs a cut: the red ray in X is where its values jump by $2\\pi i$. Drag it to move the seam; the sheet $k$ in the Inspector adds $2\\pi i k$.',
          touch: '$\\log z$ needs a cut: the red ray in X is where its values jump by $2\\pi i$. Drag it to move the seam; the sheet $k$ in the step\'s editor adds $2\\pi i k$.', deskTouch: '$\\log z$ needs a cut: the red ray in X is where its values jump by $2\\pi i$. Drag it to move the seam; the sheet $k$ in the Inspector adds $2\\pi i k$.', phoneFine: "$\\log z$ needs a cut: the red ray in X is where its values jump by $2\\pi i$. Drag it to move the seam; the sheet $k$ in the step's editor adds $2\\pi i k$.",
          try: { text: 'Drag the red cut.', on: 'cut-moved', ctl: ['tool:select'], then: 'The seam moved; across it the values jump by $2\\pi i$.' } },
        { id: 'inverse', anchor: ['invBtn', 'chain'], also: ['panes'], title: 'Inverses', before: [['select', 1], ['panel', 'right']],
          body: 'Replace with the inverse, in the step\'s ⋯ menu in the Inspector, replaces a step by its inverse when there is a single-valued one, as $e^z$ is for $\\log z$. When there is none, as for $z^2$, it says why and offers the preimages instead.',
          touch: 'Replace with the inverse, in the ⋯ menu of the step\'s editor, replaces a step by its inverse when there is a single-valued one, as $e^z$ is for $\\log z$. When there is none, as for $z^2$, it says why and offers the preimages instead.', deskTouch: "Replace with the inverse, in the step's ⋯ menu in the Inspector, replaces a step by its inverse when there is a single-valued one, as $e^z$ is for $\\log z$. When there is none, as for $z^2$, it says why and offers the preimages instead.", phoneFine: "Replace with the inverse, in the ⋯ menu of the step's editor, replaces a step by its inverse when there is a single-valued one, as $e^z$ is for $\\log z$. When there is none, as for $z^2$, it says why and offers the preimages instead.",
          try: { text: 'In ⋯, choose Replace with the inverse.', on: 'step-replaced', test: (e) => !e || (e.k === 1 && e.type === 'exp'), ctl: ['invBtn'], then: '$e^z$ undoes $\\log z$ on this sheet.' } },
        // (the rail is placed on the second plane, so the chip, whose pill is a chip and a ⋯ wide, is in the rail's view on a phone)
        { id: 'deriv', anchor: 'paneL', also: ['svStrip'], title: 'The derivative as a step', before: [['scene', 'deriv'], ['view', 'xy'], ['plane', 'L'], ['svPlace', { i: 1 }]],
          lead: 'Here $F=3z^2-3$; the target $0$ marks its zeros $\\pm1$.',
          body: 'A $d/dz$ step differentiates the chain so far: here $F=3z^2-3$, the derivative of $z^3-3z$. The target $0$ marks its zeros $\\pm1$, the critical points of $z^3-3z$.',
          try: { text: 'Click the chip $d/dz$.', touch: 'Tap the chip $d/dz$.', on: 'step-selected', test: (/** @type {any} */ e) => !e || e.k === 2, ctl: ['svChip2'], then: 'The Inspector shows the step that differentiates the chain so far.' } },
        // (on a phone the All sheets check is in the Display sheet, which opens)
        { id: 'sheets', anchor: ['sheets', 'panes'], also: ['panes'], title: 'All sheets', before: [['scene', 'logSheets'], ['view', 'land'], ['tool', 'select'], ['panel', 'sheet', 'display']], wait: 120,
          body: 'In Landscape, All sheets draws the sheets of a multivalued map instead of its cut principal branch: $\\operatorname{Im}\\log z$ climbs a helicoid around $0$. $\\log z$ has infinitely many sheets, so a window of them is drawn; sheets ± sets its width.',
          try: { text: 'Drag to orbit the helicoid.', on: 'view-moved', test: orbit, ctl: ['panes'], then: 'Each turn round $0$ climbs one sheet, $2\\pi$ higher.' } },
      ],
    },
    {
      // notes/tour-r3/SPEC.md 4: hear, then how, then a closed curve; the sound settings step is the one that
      // Palette and keys leaves to this chapter. No step plays on arrival: music starts only from the strip's Listen
      id: 'sound', title: 'Sound', time: '1½ min', rev: 2, scene: 'song', needs: 'sound',
      steps: [
        { id: 'song', anchor: 'panes', needs: 'song', act: 'listen', title: 'Grieg on a curve', before: [['view', 'phase'], ['surface', 'L', 'plane'], ['tool', 'select']],
          body: 'Grieg\'s theme played by a function: along the unit circle $\\arg F$ climbs in steps, one for each note. Listen along walks the circle at an even pace and plays each colour line $\\arg F$ crosses; the branch cut before each downbeat is the drum.',
          try: { text: 'Click ▶ to listen.', touch: 'Tap ▶ to listen.', off: 'Click ▶ to turn sound on and listen.', offTouch: 'Tap ▶ to turn sound on and listen.', on: 'listen-ended', test: (e) => !e || ((!!e.piece || !!e.fn) && (!!e.full || e.heard >= Math.min(9, 0.45 * (e.dur || 20)))), then: 'Every note was $\\arg F$ crossing one of its colour lines.' },
          // (Hear the function: Listen along plays the function, so the captions are fractions of its duration
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
          try: { text: 'Click ▶ and listen as the loop winds round the zero.', touch: 'Tap ▶ and listen as the loop winds round the zero.', off: 'Click ▶ to turn sound on and hear the loop wind round the zero.', offTouch: 'Tap ▶ to turn sound on and hear the loop wind round the zero.', on: 'listen-ended', test: (e) => !e || (!!e.closed && e.W === 1 && !!e.full), then: '$W=1$: one turn of $\\arg F$, sung as F♯.' } },
        { id: 'settings', anchor: ['soundBtn', 'soundBar', 'moreBtn'], needs: 'sound', title: 'Sound settings',
          lead: 'Switch Sound and Hear the function on or off here.',
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
        // (and the copy button the copy names, in the head of F's Inspector)
        { id: 'formula-tex', anchor: 'composite', also: ['fTile', 'copyTex'], title: 'The formula in LaTeX', before: [['panel', 'right']],
          body: 'With the F tile selected, the Inspector shows $F$ in closed form; the copy button puts its LaTeX on the clipboard.',
          touch: 'With the F tile tapped, its editor shows $F$ in closed form; the copy button puts its LaTeX on the clipboard.', deskTouch: 'With the F tile tapped, the Inspector shows $F$ in closed form; the copy button puts its LaTeX on the clipboard.', phoneFine: 'With the F tile selected, its editor shows $F$ in closed form; the copy button puts its LaTeX on the clipboard.',
          try: { text: 'Click the copy button of $F$.', touch: 'Tap the copy button of $F$.', on: 'tex-copied', ctl: ['copyTex'], then: '$F$\'s LaTeX is on your clipboard.' } },
      ],
    },
    {
      // (keys are for a keyboard: on a touch screen the chapter is not offered, and the tour ends before it)
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
  // the Phase lines task: a lap up and a lap down (red's line, D, crossed each way: the event hear-turn), whichever
  // point gave which
  function harpUpDown(e, m) {
    if (!e) return true;
    m = m || {};
    if (e.dir > 0) m.up = 1;
    if (e.dir < 0) m.down = 1;
    return !!(m.up && m.down);
  }

  // Anchors of the current markup, used when the app's api.anchor(name) returns undefined for a name: a selector, or a
  // function returning the element.
  // (the thread's second step)
  const SV_K2 = '#svStrip .sv-step[data-k="2"]';
  const ANCHORS = {
    examples: '#examplesBtn', palette: '#cmdBtn', exportBtn: '#exportBtn', helpBtn: '#helpBtn', moreBtn: '#hdrMoreBtn',
    // (the steps view's thread, its ring, its Colour from here button, its two choices (a segmented control, or on a phone one
    // button that steps through them) and the first function chip)
    svStrip: '#svStrip', svNext: () => vis1('#svStrip .sv-next'), svRing: '#svStrip .sv-thumb', svCp: '#svHead .sv-cp', svScope: () => vis1('#svHead .sv-scope, #svHead .sv-scope-menu'),
    svSurf: () => vis1('#svHead .sv-surf, #svHead .sv-surf1'), svChip: () => vis1('#svStrip .sv-fchip'), svChip2: () => vis1(SV_K2 + ' .sv-fchip'),
    // (the whole map's F chip, at the end of the rail; on a phone the rail scrolls, so it is brought into view for the step that lights it)
    svF: () => { const e = vis1('#svStrip .sv-wholemap'); if (e && e.scrollIntoView) e.scrollIntoView({ block: 'nearest', inline: 'nearest' }); return e; },
    // (the play button, the rail with its band, and the speed select and Loop; on a phone those two are in the Playback sheet, which holding ▶ opens)
    svPlay: () => vis1('#svStrip .sv-play'), svRail: () => vis1('#svStrip .sv-rail'),
    svSpeed: () => vis1('#svStrip .sv-speed'), svLoop: () => vis1('#svStrip .sv-loop'),
    // (the thread's Add function button, in either form; the second chip's ⋯ menu, or on a phone, where chips have none, the chip)
    svPrev: () => vis1('#svStrip .sv-prev'), svAdd: () => vis1('#svStrip .sv-add'), svMenu2: () => vis1(SV_K2 + ' .sv-more') || ANCHORS.svChip2(),
    viewSwitch: '#viewSwitch', tools: '#secDraw',
    // (the Construct grid under Draw; hidden on a phone, where the tool row's More key leads to it)
    constructTools: () => { const e = /** @type {HTMLElement | null} */ (document.querySelector('#constructTools')); return e && e.offsetParent ? e : null; },
    formula: '#secFormula', shapes: '#secShapes',
    // (D3: the phone's context bar, while a construction tool is in hand: its Undo pick)
    ctxUndo: () => vis1('.ph-ctx[data-k="construct"] .ph-cb'),
    // (on the laptop the regions' display is behind X's Regions button in the pane head: the open
    // popover, or the button; on a phone the Display sheet's section)
    display: () => (document.documentElement.classList.contains('ph') ? document.querySelector('#regionsBox') : document.querySelector('.pat-pop') || document.querySelector('#leftFoot .pat-btn')),
    // (on a phone the chain, its Add tile and F are rows of the chain sheet; while it is closed, its "N steps ▾"
    // button in the chain bar, which opens it)
    chain: '.pipe-wrap', panes: '#panes', paneL: '#paneL', paneR: '#paneR',
    // (F's formula, guarantees and domain show in the Inspector with the F tile selected, which the app's api.anchor
    // does for these names)
    composite: '#propsPanel .insp-F .iform', guarantees: '#propsPanel .insp-F .iglist',
    domain: '#propsPanel .insp-F .idom', matrix: '#propsPanel .insp-F details.steps',
    // the editor of the selected zeros-and-poles step (its parameter block is .params.zp)
    zpCard: () => document.querySelector('#propsPanel .insp-step .params.zp'),
    // the selected formula step's split offer (how it is built from catalog steps)
    splitOffer: '#propsPanel .insp-step .split-offer:not([hidden])',
    // the Inspector's ⋯ menu of the selected step (Replace with the inverse); the All sheets check of the Landscape options (its label)
    invBtn: () => document.querySelector('#propsPanel .insp-step .ihead .more'),
    sheets: () => { const c = document.querySelector('#sheetsChk'); return c ? c.closest('label') || c : null; },
    // the Sound control of the top bar (the sound round)
    soundBtn: '#soundBtn', soundBar: '#soundPh',
    // the Phase style control of the Phase view's options (Tiles, Plain, …, Cauchy)
    phaseStyle: '#dcSeg',
    // X's Display options button (the head's ⋯, when the Phase style or Landscape's options do not fit
    // the head); INTEGRATION.md: the fallback of phaseStyle
    leftOpts: '#leftFoot .opts-btn:not(.pat-btn)',
    // the Inspector's Selection (the selected step's editor), its Parameters (shared numbers), the F tile that
    // closes the chain
    inspector: '#propsPanel .insp-sel', params: () => document.querySelector('#propsPanel .prm') || document.querySelector('#propsPanel .insp-params'),
    fTile: () => inChainSheet('#pipeline .ftile'),
    // notes/v16-user5/AS-BUILT-tour.md: the control a step's task needs, exactly. A tool is its own button where  standards-ok: a spec path in notes/
    // it shows: the Draw panel, the collapsed panel's rail, a phone's tool row or its More tools sheet; on a phone a tool
    // outside the row is the More key, which then carries the tool's icon and name
    'tool:disc': toolBtn('disc'), 'tool:select': toolBtn('select'), 'tool:line': toolBtn('line'), 'tool:circle3': toolBtn('circle3'),
    splitBtn: '#propsPanel .insp-step .split-offer:not([hidden]) .so-btn',
    // the slider of the first shared number
    paramSlider: () => vis1('#propsPanel .prm-row input[type="range"]'),
    // F's Copy LaTeX button, in the head of the Inspector with the F tile selected
    copyTex: '#propsPanel .insp-F .ihead .icon-btn',
  };
  // the first visible match of a selector (a control that has a copy elsewhere, hidden in this layout)
  function vis1(sel) { for (const e of document.querySelectorAll(sel)) if (visible(e)) return e; return null; }
  // a control of the chain: itself, or on a phone with the chain sheet closed, the button that opens it
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

