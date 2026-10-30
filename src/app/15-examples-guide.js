  // ---------------- examples ----------------
  const EX = [
    { name: $t('Empty canvas'), tex: '', blurb: $t('No shapes and no functions: start from scratch.'), view: { cx: 0, cy: 0, s: 90 }, shapes: [], steps: [] },
    {
      name: $t('Strip to disk'), tryDone: [[{ on: 'shape-moved', test: (e) => e.plane === 'z' }, { on: 'shape-added', test: (e) => e.plane === 'z' }]], try: $t('Try: drag a corner of the strip, or draw a disc in X, and watch Y.'), tour: 'basics', tex: 'w=\\frac{e^{z}-1}{e^{z}+1}', blurb: $t('exp opens the strip |Im z| < π/2 onto a half-plane; a Möbius map folds it into the disk.'), view: { cx: 0, cy: 0, s: 52 },
      shapes: [
        { kind: 'formula', expr: '|\\Im z|<\\frac{\\pi}{2}' },
        { kind: 'line', a: [0, 0.8], b: [1, 0.8] },
        { kind: 'point', p: [0, 0], label: 'z₀' },
      ],
      steps: [{ type: 'exp', params: {} }, { type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' } }],
    },
    {
      name: $t('Quarter plane squared'), tryDone: [[{ on: 'deformation-toggled', test: (e) => !!e.on }]], try: $t('Try: press Deformation and watch the quadrant open onto the half-plane.'), tour: 'deform', tex: 'w=z^{2}', blurb: $t('The first quadrant opens onto the upper half-plane; angles at 0 double.'), view: { cx: 0.6, cy: 0.6, s: 70 },
      shapes: [{ kind: 'sector', c: [0, 0], r: 0, t1: 0, t2: 90 }, { kind: 'pgrid', c: [0, 0], r: 2, nc: 4, nr: 16 }],
      steps: [{ type: 'pown', params: { n: 2 } }],
    },
    {
      name: $t('Joukowski airfoil'), tryDone: [[{ on: 'shape-moved', test: (e) => e.plane === 'z' }], [{ on: 'deformation-toggled', test: (e) => !!e.on }]], try: $t('Try: drag the circle through 1, then press Deformation.'), tour: 'deform', tex: 'w=\\tfrac12\\left(z+\\tfrac1z\\right)', blurb: $t('A circle through 1 becomes a wing with a sharp trailing edge.'), view: { cx: 0, cy: 0, s: 70 },
      shapes: [
        { kind: 'disc', c: [-0.12, 0.1], r: 1.1244998888, complement: true },
        { kind: 'circle', c: [-0.12, 0.1], r: 1.1244998888 },
        { kind: 'point', p: [1, 0], label: 'trailing edge' },
      ],
      steps: [{ type: 'joukowski', params: {} }],
    },
    {
      name: $t('Logarithm of an annulus'), tryDone: [[{ on: 'cut-moved' }]], try: $t('Try: drag the red cut and watch the seam move.'), tour: 'branches', tex: 'w=\\log z', blurb: $t('The annulus becomes a rectangle. Drag the red cut to move the seam.'), view: { cx: 0, cy: 0, s: 70 },
      shapes: [{ kind: 'annulus', c: [0, 0], r1: 0.5, r2: 2 }, { kind: 'circle', c: [0, 0], r: 1 }, { kind: 'segment', a: [0.5, 0.5], b: [1.5, 1.5] }],
      steps: [{ type: 'log', params: { cut: 180, k: 0 } }], focus: 1,
    },
    {
      name: $t('Disk automorphism'), tryDone: [[{ on: 'deformation-toggled', test: (e) => !!e.on }]], try: $t('Try: press Deformation: the disk turns into itself.'), tour: 'deform', tex: 'w=\\frac{z-a}{1-\\bar a z}', blurb: $t('A Möbius self-map of the disk, played as a deformation.'), view: { cx: 0, cy: 0, s: 110 },
      shapes: [{ kind: 'disc', c: [0, 0], r: 1 }, { kind: 'pgrid', c: [0, 0], r: 1, nc: 5, nr: 16 }],
      steps: [{ type: 'blaschke', params: { a: '0.5+0.3i', phi: 0 } }], morph: true,
    },
    {
      name: $t('Sine of a half-strip'), tryDone: [[{ on: 'view-changed', test: (e) => e.main === 'phase' }]], try: $t('Try: switch to Phase and look for the zeros of sin z.'), tour: 'views', tex: 'w=\\sin z', blurb: $t('The half-strip |Re z| < π/2, Im z > 0 maps onto the upper half-plane.'), view: { cx: 0, cy: 1.25, s: 105 },
      shapes: [{ kind: 'formula', expr: '|\\Re z|<\\frac{\\pi}{2}, \\Im z>0' }, { kind: 'cgrid', a: [-1.5, 0], b: [1.5, 2.4], n: 6 }],
      steps: [{ type: 'sin', params: {} }],
    },
    {
      name: $t('Square root and its sheets'), tryDone: [[{ on: 'sheet-changed' }]], try: $t('Try: on the step card, press ‹ or › to flip the sheet.'), tour: 'branches', tex: 'w=\\sqrt{z}', blurb: $t('The slit plane maps onto a half-plane. On the step card, ‹ › flips the sheet and Show all sheets draws both.'), view: { cx: 0, cy: 0, s: 70 },
      shapes: [{ kind: 'disc', c: [0, 0], r: 2 }, { kind: 'circle', c: [0.5, 0.3], r: 0.9 }],
      steps: [{ type: 'root', params: { n: 2, cut: 180, k: 0 } }], focus: 1,
    },
    {
      name: $t('Cayley, then cube'), tryDone: [[{ on: 'deformation-toggled', test: (e) => !!e.on }]], try: $t('Try: press Deformation: the half-plane becomes the disk, then wraps.'), tour: 'deform', tex: 'w=\\left(\\frac{z-i}{z+i}\\right)^{3}', blurb: $t('Half-plane to disk, then the disk wraps around itself three times.'), view: { cx: 0, cy: 1, s: 60 },
      shapes: [{ kind: 'halfplane', a: [0, 0], b: [1, 0] }, { kind: 'cgrid', a: [-2, 0], b: [2, 2.5], n: 8 }],
      steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' } }, { type: 'pown', params: { n: 3 } }],
    },
    {
      name: $t('A formula in LaTeX'), tryDone: [[{ on: 'formula-edited' }]], try: $t('Try: edit the formula in the Inspector and watch the plot follow.'), tour: 'edit', tex: 'w=\\frac{z^2-1}{z^2+1}', blurb: $t('A custom step shown as a color plot: zeros at ±1, poles at ±i.'), view: { cx: 0, cy: 0, s: 80 },
      shapes: [{ kind: 'rect', a: [-1.5, -1.5], b: [1.5, 1.5] }],
      steps: [{ type: 'custom', params: { expr: '\\frac{z^2-1}{z^2+1}', cut: 180 } }], rightMode: 'color',
    },
    {
      name: $t('Roots as preimages'), tryDone: [[{ on: 'shape-moved', test: (e) => e.plane === 'w' }]], try: $t('Try: drag the target 0 in Y and see its preimages in X.'), tour: 'analysis', tex: 'z^{3}-1=0', blurb: $t('The target 0 in the w-plane pulls back to the three cube roots of unity; the target circle to curves around them.'), view: { cx: 0, cy: 0, s: 90 },
      shapes: [{ kind: 'circle', c: [0, 0], r: 1 }],
      targets: [{ kind: 'point', p: [0, 0] }, { kind: 'circle', c: [0, 0], r: 0.6 }],
      steps: [{ type: 'custom', params: { expr: 'z^3-1', cut: 180 } }],
    },
    {
      name: $t('A residue by integration'), tryDone: [[{ on: 'integral-opened' }]], try: $t('Try: open a curve\'s menu on the circle and choose ∮.'), tour: 'analysis', tex: '\\oint_{|z-i|=1}\\frac{dz}{z^2+1}=\\pi', blurb: touchUI() ? $t('Hold a finger on the circle, then choose Integrate: around the pole at i the running integral misses its start by 2πi · Res = π.') : $t('Right-click the circle: around the pole at i the running integral misses its start by 2πi · Res = π.'), view: { cx: 0, cy: 0.5, s: 80 },
      shapes: [{ kind: 'circle', c: [0, 1], r: 1 }],
      steps: [{ type: 'custom', params: { expr: '\\frac{1}{z^2+1}', cut: 180 } }], rightMode: 'color', integrate: 0,
    },
    {
      name: $t('Cauchy: a simple pole'), tryDone: [[{ on: 'shape-moved', test: (e) => e.plane === 'z' }]], try: $t('Try: drag the circle until the pole at 0 is outside it: the inside becomes F, the outside 0.'), tour: 'analysis', tex: 'F(z)=\\frac{1}{z}', blurb: $t('F = 1/z has one pole, at 0, inside the circle. Inside, the Cauchy integral is F minus its principal part, here 0; outside it is the principal part, 1/z.'), view: { cx: 0, cy: 0, s: 90 },
      shapes: [{ kind: 'circle', c: [0.3, 0.2], r: 1 }],
      steps: [{ type: 'custom', params: { expr: '\\frac{1}{z}', cut: 180 } }], rightMode: 'color', dc: 'cauchy', selected: 0,
    },
    {
      name: $t('Cauchy: a regular part and a pole'), tryDone: [[{ on: 'shape-moved', test: (e) => e.plane === 'z' }]], try: $t('Try: drag the circle until the pole at 0 is outside it: the inside becomes F, the outside 0.'), tour: 'analysis', tex: 'F(z)=z+\\frac{1}{z}', blurb: $t('F = z + 1/z: inside the circle the Cauchy integral is z, the part of F that is regular at the pole; outside it is the principal part, 1/z.'), view: { cx: 0, cy: 0, s: 90 },
      shapes: [{ kind: 'circle', c: [0.3, 0.2], r: 1 }],
      steps: [{ type: 'custom', params: { expr: 'z+\\frac{1}{z}', cut: 180 } }], rightMode: 'color', dc: 'cauchy', selected: 0,
    },
    {
      name: $t('Cauchy: an essential singularity'), tryDone: [[{ on: 'shape-moved', test: (e) => e.plane === 'z' }]], try: $t('Try: drag the circle until the singularity at 0 is outside it: the inside becomes F, the outside 0.'), tour: 'analysis', tex: 'F(z)=e^{1/z}', blurb: $t('e^{1/z} has an essential singularity at 0: its principal part has infinitely many terms. The picture then draws the integral itself, point by point, instead of F minus a finite principal part.'), view: { cx: 0, cy: 0, s: 90 },
      shapes: [{ kind: 'circle', c: [0.3, 0.2], r: 1 }],
      steps: [{ type: 'custom', params: { expr: 'e^{\\frac{1}{z}}', cut: 180 } }], rightMode: 'color', dc: 'cauchy', selected: 0,
    },
    {
      name: $t('The derivative in the chain'), tryDone: [[{ on: 'step-focused' }]], try: $t('Try: move the d/dz card along the chain and watch the picture change.'), tour: 'branches', tex: 'w=\\frac{d}{dz}\\left(z^{3}-3z\\right)', blurb: $t('A d/dz step differentiates the chain so far: the critical points ±1 of z³ − 3z are the zeros of its derivative.'), view: { cx: 0, cy: 0, s: 80 },
      shapes: [{ kind: 'disc', c: [0, 0], r: 1.6 }, { kind: 'pgrid', c: [0, 0], r: 1.6, nc: 4, nr: 16 }],
      targets: [{ kind: 'point', p: [0, 0] }],
      steps: [{ type: 'custom', params: { expr: 'z^3-3z', cut: 180 } }, { type: 'deriv', params: {} }], rightMode: 'color',
    },
    {
      name: $t('Sheets of the logarithm'), tryDone: [[{ on: 'order-changed' }]], try: $t('Try: turn All sheets on and off in the Landscape.'), tour: 'branches', tex: 'w=\\log z', blurb: $t('Landscape with All sheets: Im log z climbs a helicoid around 0 instead of jumping at the cut.'), view: { cx: 0, cy: 0, s: 60 },
      shapes: [{ kind: 'annulus', c: [0, 0], r1: 0.5, r2: 2 }],
      steps: [{ type: 'log', params: { cut: 180, k: 0 } }], rightMode: '3d', sheets: true, height: 'im',
    },
    // a melody played by a function (notes/sea-song/FUNCTION.md): F = H(u(z)), src/seasong.js made by
    // tools/mk_function.js. H is a theme wheel: 25 Apollonius pairs of branch points, one just inside |u| = 1 and one
    // just outside, one pair a melodic step; on |u| = 1, |H| is constant and arg H a staircase on Grieg's theme (the
    // downbeat is u^s's branch cut, 82 ms ahead), so the sound's fixed map plays it: each colour line crossed is a
    // note, the cut is the crack. u = ((z - a)/(1 - az))^2, a disk automorphism squared: twice round a lap, faster
    // near z = a. No score and no special rule: the curve is two laps of the unit circle (song: the example's curve,
    // sndIsSong), played by Listen along at 250 px/s (19.1 s at view.s 380: four statements, 5.35 then 4.20 s a lap).
    // sectors: the Phase key's n (12, a line a semitone); fit: the box kept in view
    {
      name: $t('In the Hall of the Mountain King'), tex: SEASONG.tex, blurb: $t('Edvard Grieg, Peer Gynt (1875), played by a function. Along the unit circle arg F climbs in steps, one for each note of the theme, and the sound plays each colour line it crosses. Choose Listen along in the circle\'s menu (right-click, or hold on touch): each lap is the theme twice, faster the second time, and the branch cut just before every downbeat is the drum.'),
      view: SEASONG.view, fit: SEASONG.fit, shapes: [{ kind: 'curve', pts: SEASONG.pts, song: true, nameKey: 'circle' }], steps: SEASONG.steps, sectors: SEASONG.sectors, song: true, rightMode: 'color', dc: 'phase', thumbX: true, tip: true,
    },
    // [issue #4] the phase portraits of ζ (its first zeros on the critical line) and of Γ (its row of poles)
    {
      name: $t('Zeros of the zeta function'), tryDone: [[{ on: 'view-changed', test: (e) => e.main === 'land' }]], try: $t('Try: switch to the Landscape and look for the zeros on the line Re z = 1/2.'), tour: 'views', tex: 'w=\\zeta(z)', blurb: $t('The phase portrait of ζ over the critical strip 0 < Re z < 1: its first zeros ½ + 14.13i, ½ + 21.02i and ½ + 25.01i lie on the line Re z = ½, where every colour meets.'), view: { cx: 0.5, cy: 19.5, s: 40 },
      shapes: [
        { kind: 'formula', expr: '0<\\Re z<1' },
        { kind: 'line', a: [0.5, 0], b: [0.5, 1] },
        { kind: 'point', p: [0.5, 14.134725] }, { kind: 'point', p: [0.5, 21.022040] }, { kind: 'point', p: [0.5, 25.010858] },
      ],
      steps: [{ type: 'zeta', params: {} }], rightMode: 'color',
    },
    {
      name: $t('Poles of the Gamma function'), tryDone: [[{ on: 'probe' }]], try: $t('Try: hover a pole in Y: X marks the point with that value.'), tour: 'views', tex: 'w=\\Gamma(z)', blurb: $t('The phase portrait of Γ: its poles at 0, −1, −2, … sit in a row on the negative real axis, and Γ(n + 1) = n! grows fast to the right.'), view: { cx: -1.5, cy: 0, s: 60 },
      shapes: [{ kind: 'rect', a: [-4.5, -1.5], b: [2.5, 1.5] }],
      steps: [{ type: 'gamma', params: {} }], rightMode: 'color',
    },
    // [issue #5] series: the partial sums of e^z (N on a slider), a natural boundary, Li₂ from the Series step, ζ as a
    // Dirichlet series
    {
      name: $t('Partial sums of the exponential'), tryDone: [[{ on: 'number-changed' }]], try: $t('Try: drag N under Numbers: the zeros of the partial sum move out as N grows.'), tex: 'w=\\sum_{n=0}^{N}\\frac{z^n}{n!}', blurb: $t('The phase portrait of the partial sum 1 + z + z²/2! + … + zᴺ/N! of the series of eᶻ. Its N zeros lie near a curve that grows with N (Szegő’s curve), and inside it the colours are those of eᶻ.'), view: { cx: 0, cy: 0, s: 60 },
      params: [{ name: 'N', value: 8, min: 1, max: 30, step: 1 }],
      shapes: [{ kind: 'rect', a: [-4, -4], b: [4, 4] }],
      steps: [{ type: 'custom', params: { expr: '\\sum_{n=0}^{N} \\frac{z^n}{n!}', cut: 180 } }], rightMode: 'color',
    },
    {
      name: $t('A natural boundary'), tryDone: [[{ on: 'view-moved', test: (e) => e.how === 'zoom' }]], try: $t('Try: zoom in on the unit circle: the colours turn faster and faster towards it, all along it.'), tex: 'w=\\sum_{n=0}^{\\infty} z^{2^n}', blurb: $t('Σ z^(2ⁿ) converges in the unit disc and has no analytic continuation anywhere across the circle |z| = 1: every arc of it is a natural boundary. Outside the disc the series has no value and the plane is blank.'), view: { cx: 0, cy: 0, s: 250 },
      shapes: [{ kind: 'circle', c: [0, 0], r: 1 }],
      steps: [{ type: 'custom', params: { expr: '\\sum_{n=0}^{\\infty} z^{2^n}', cut: 180 } }], rightMode: 'color',
    },
    {
      name: $t('The dilogarithm from its series'), tryDone: [[{ on: 'shape-moved', test: (e) => e.plane === 'z' }]], try: $t('Try: drag the disc past the dashed circle: outside it the series has no value.'), tex: 'w=\\sum_{n=1}^{\\infty}\\frac{z^n}{n^2}', blurb: $t('Li₂(z) = Σ zⁿ/n², a Series step with aₙ = 1/n². The dashed circle is its circle of convergence, |z| = 1, estimated from the coefficients; the image of the disc is drawn only where the series converges.'), view: { cx: 0, cy: 0, s: 140 },
      shapes: [{ kind: 'disc', c: [0, 0], r: 0.9 }],
      steps: [{ type: 'series', params: { kind: 'power', an: '\\frac{1}{n^2}', c: '0' } }],
    },
    {
      name: $t('Zeta as a Dirichlet series'), try: $t('Try: open Zeros of the zeta function and compare the colours to the right of Re z = 1.'), tex: 'w=\\sum_{n=1}^{\\infty} n^{-z}', blurb: $t('Σ n^(−z), a Series step of the Dirichlet kind with aₙ = 1, is ζ(z) where it converges, to the right of the dashed line Re z = 1. To its left the series diverges and the plane is blank, while ζ itself continues.'), view: { cx: 3, cy: 0, s: 60 },
      shapes: [{ kind: 'rect', a: [1.5, -6], b: [5, 6] }],
      steps: [{ type: 'series', params: { kind: 'dirichlet', an: '1', c: '0' } }], rightMode: 'color',
    },
    // [issue #10] a complex number as a point: a Möbius map of the disc that moves a to 0
    {
      name: $t('A disc map moved by a point'), tryDone: [[{ on: 'number-changed', test: (e) => (e.names || []).includes('a') }]], try: $t('Try: drag the point a, or press Play beside a under Numbers: it circles the origin.'), tex: 'w=\\frac{z-a}{1-\\bar{a}z}', blurb: $t('The map (z − a)/(1 − āz) takes the unit disc onto itself and moves the point a to 0. The number a is complex: its point on the plane is the number, so dragging the point changes the map.'), view: { cx: 0, cy: 0, s: 150 },
      params: [{ name: 'a', value: 0.5, im: 0.3, min: -1, max: 1, step: 0.01 }],
      shapes: [{ kind: 'disc', c: [0, 0], r: 0.85 }, { kind: 'point', p: [0.5, 0.3], bind: { p: 'a' } }],
      steps: [{ type: 'custom', params: { expr: '\\frac{z-a}{1-\\overline{a}\\,z}', cut: 180 } }], rightMode: 'color',
    },
    // [issue #6] iteration: the Mandelbrot set (a region of X by its escape test), filled Julia sets that their map keeps,
    // and Newton's method for z³ − 1 as a Recurrence step
    {
      name: $t('The Mandelbrot set'), tryDone: [[{ on: 'view-moved', test: (e) => e.how === 'zoom' }]], try: $t('Try: zoom in on the boundary of the region: past about 10⁻⁵ the GPU’s float32 blurs it.'), tex: 'w=u_{12},\\ u_0=0,\\ u_{k+1}=u_k^2+z', blurb: $t('The region is the Mandelbrot set M: the c for which the orbit 0, c, c² + c, … stays bounded, drawn by its escape test |iter(u² + z, u, 0, 64)| ≤ 2. The map is the twelfth term of that orbit, a Recurrence step: it takes M into the disc |w| ≤ 2, and outside M its colours turn ever faster towards the boundary.'), view: { cx: -0.6, cy: 0, s: 150 },
      shapes: [{ kind: 'formula', expr: '|\\operatorname{iter}(u^2+z, u, 0, 64)|\\le 2' }],
      steps: [{ type: 'recurrence', params: { u0: '0', g: 'u^2+z', N: 12, cut: 180 } }], rightMode: 'color',
    },
    {
      name: $t('A Julia set that its map keeps'), tryDone: [[{ on: 'repeat-changed', test: (e) => e.n >= 2 }], [{ on: 'repeat-changed', test: (e) => e.n > 2 }]], try: $t('Try: on the card ⋯ → Repeat, then raise N: the image stays the same set.'), tex: 'w=z^2-0.75', blurb: $t('The filled Julia set K of z² − 0.75: the points whose orbits under z ↦ z² − 0.75 stay bounded. The map takes K onto itself, two to one, so the image in Y is K again.'), view: { cx: 0, cy: 0, s: 150 },
      shapes: [{ kind: 'formula', expr: '|\\operatorname{iter}(u^2-0.75, u, z, 64)|\\le 2' }],
      steps: [{ type: 'pown', params: { n: 2 } }, { type: 'add', params: { c: '-0.75' } }],
    },
    {
      name: $t('Douady’s rabbit'), tryDone: [[{ on: 'repeat-changed', test: (e) => e.n === 3 }]], try: $t('Try: on the card ⋯ → Repeat, N = 3: each ear goes round the three and comes back to itself.'), tex: 'w=z^2+c,\\ c\\approx-0.123+0.745i', blurb: $t('The filled Julia set of z² + c for c ≈ −0.123 + 0.745i, where the critical orbit has period 3: three ears meet at every pinch point, and the map turns them round, one to the next. The map keeps the set.'), view: { cx: 0, cy: 0, s: 150 },
      shapes: [{ kind: 'formula', expr: '|\\operatorname{iter}(u^2-0.1226+0.7449i, u, z, 96)|\\le 2' }],
      steps: [{ type: 'pown', params: { n: 2 } }, { type: 'add', params: { c: '-0.1226+0.7449i' } }],
    },
    {
      name: $t('Newton’s method for z³ − 1'), tryDone: [[{ on: 'repeat-changed', test: (e) => e.n >= 1 && e.n <= 3 }]], try: $t('Try: lower N in the bracket under the card to 1, 2, 3 and watch the basins form.'), tex: 'w=N_f^{\\circ 20}(z),\\ N_f(z)=z-\\frac{z^3-1}{3z^2}', blurb: $t('Newton’s map for z³ − 1, repeated twenty times (Repeat × N): Newton’s method from each starting point z. Almost every z ends at one of the three cube roots of 1, and the phase portrait colours the plane by where it ends: three basins, whose common boundary is a fractal (a Julia set).'), view: { cx: 0, cy: 0, s: 140 },
      shapes: [{ kind: 'rect', a: [-2, -2], b: [2, 2] }],
      steps: [{ type: 'custom', params: { expr: 'z-\\frac{z^3-1}{3z^2}', cut: 180 }, repeat: { n: 20, len: 1 } }], rightMode: 'color',
    },
    {
      name: $t('The Julia set of z² + i'), tryDone: [[{ on: 'repeat-changed', test: (e) => e.n === 3 && e.len === 2 }]], try: $t('Try: on the last card ⋯ → Repeat, f₁–f₂, then N = 3: the image is the curve |u₅| = 2, three levels out.'), tex: 'w=z^2+i', blurb: $t('The filled Julia set of z² + i is a dendrite: a tree with no interior, so it cannot be drawn as a region. It is drawn by the escape-time curve |u₈| = 2 (u₀ = z, uₖ₊₁ = uₖ² + i), which encloses it. The map takes this curve to the next level out, |u₇| = 2.'), view: { cx: 0, cy: 0, s: 150 },
      shapes: [{ kind: 'fcurve', expr: '|\\operatorname{iter}(u^2+i, u, z, 8)|=2' }],
      steps: [{ type: 'pown', params: { n: 2 } }, { type: 'add', params: { c: 'i' } }],
    },
    // [issue #260] the Douady–Hubbard map with external rays and equipotentials of M, and the Böttcher coordinate of a
    // Julia set whose c is a slider (at the end of the list: the examples before keep their places)
    {
      name: $t('The Douady–Hubbard map'), tryDone: [[{ on: 'view-moved', test: (e) => e.how === 'zoom' }, { on: 'dh-added' }]], try: $t('Try: zoom in where a ray meets M, or add a ray of your own on the card (θ = 1/7, 2/7, …); past about 10⁻⁵ the GPU’s float32 blurs the picture.'), tex: 'w=\\Phi_M(z)', blurb: $t('Φ_M maps the outside of the Mandelbrot set M one to one onto the outside of the unit disc. The rays it sends to the radii arg w = 2πθ are the external rays of M, and the curves it sends to the circles |w| = r are its equipotentials. The rays of angle 1/3 and 2/3 land together at −3/4, the root of the disc of period 2; 1/7 and 2/7 at the root of the bulb of period 3; 1/2 at the tip −2.'), view: { cx: -0.6, cy: 0, s: 150 },
      shapes: [...['0', '1/3', '2/3', '1/7', '2/7', '1/2'].map((t, i) => ({ kind: 'dhray', theta: t, c: null, ci: i })),
        ...[1.02, 1.1, 1.5].map((r, i) => ({ kind: 'dheq', r, c: null, ci: 6 + (i % 2) }))],
      steps: [{ type: 'dh', params: { N: 64 } }], rightMode: 'color',
    },
    {
      name: $t('Böttcher coordinates of a Julia set'), tryDone: [[{ on: 'number-changed', test: (e) => (e.names || []).includes('c') }]], try: $t('Try: press Play beside c under Numbers: the rays follow c; once c leaves M, φ_c is defined only outside the critical level.'), tex: 'w=\\varphi_c(z)', blurb: $t('φ_c maps the basin of ∞ of z ↦ z² + c onto the outside of a disc, z ↦ z² + c to w ↦ w². For c = −1 (the basilica) the rays of angle 1/3 and 2/3 land at the fixed point (1 − √5)/2, and the ray 0 at (1 + √5)/2.'), view: { cx: 0, cy: 0, s: 120 },
      params: [{ name: 'c', value: -1, min: -2, max: 0.5, step: 0.01 }],
      shapes: [...['0', '1/3', '2/3', '1/2'].map((t, i) => ({ kind: 'dhray', theta: t, c: [-1, 0], bind: { c: 'c' }, ci: i })),
        ...[1.05, 1.3].map((r, i) => ({ kind: 'dheq', r, c: [-1, 0], bind: { c: 'c' }, ci: 6 + i }))],
      steps: [{ type: 'bottcher', params: { c: 'c', N: 64 } }], rightMode: 'color',
    },
  ];
  // an example's box that must be in view (ex.fit: a phone's narrow plane, or X → Y's half): its view's scale at most,
  // centred on the box, for the X pane's size now; exFitKey: the view it gave (a view seen first after it fits again).
  // The plane's style bar floats over its bottom on a desktop (a 32 px row 8 px in, more rows on a narrow plane) and
  // does not scale with the view: it is kept clear in pixels, the box fitted and centred above it (notes/sea-song/r2
  // review picture-2); a phone has no bar on the plane
  let exFitKey = '';
  let currentExample = -1;
  // examples menu: 48x32 thumbnails rendered once with the real renderer, by swapping in a scratch state
  // Each is drawn with its own example's chain, in GLR side mode: the user's chain, its history and their programs
  // stay as they are, and a thumbnail whose chain programs are still compiling is not kept (exWait) but drawn again
  // when they land (GLR.onReady side), into the open gallery. exThumbs: example index -> data URL, for the current
  // look (pattern, opacity, theme); a change of look starts over.
  const exThumbs = new Map();
  const exWait = new Map();   // example index -> its chain structure key, compiling
  // theme preference is per viewer: auto follows the system
  function themePref() { try { return localStorage.getItem(lsk('cmw-theme')) || 'auto'; } catch (e) { return 'auto'; } }
  function setTheme(t) {
    try { localStorage.setItem(lsk('cmw-theme'), t); } catch (e) { /* storage unavailable */ }
    // one frame (spec 8.7): flush the new colors with transitions off, so none of the hover transitions start.
    // The class goes on <body>: the theme MutationObserver watches the class of <html>.
    const body = document.body;
    body.classList.add('no-trans');
    if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
    void getComputedStyle(body).color;
    body.classList.remove('no-trans');
    const b = $('themeBtn');
    const name = { auto: $t('Auto'), light: $t('Light'), dark: $t('Dark') }[t];
    if (b) {
      b.setAttribute('data-tip', $t('Theme: {name}', { name })); b.setAttribute('aria-label', $t('Theme: {name}', { name })); b.removeAttribute('title');
      const tl = b.querySelector('.tlabel'); if (tl) tl.textContent = name; // the markup already reads "Theme: "
    }
  }
  // Phase colors (issue 8): one palette for every view, a per-viewer setting like the theme (src/palette.js): the
  // wheel or one of Arb's color functions. The header's button opens a menu with a preview of each
  const PAL_NAMES = () => ({
    wheel: [$t('Wheel'), $t('The workbench\'s hue wheel: every phase equally bright')],
    arb: ['Arb', $t('Arb\'s colours: hue from the phase, zeros black, poles white')],
    arbPhase: [$t('Gold and blue'), $t('Arb\'s phase colours: white at arg 0, gold, black at ±π, blue')],
    arbDodge: [$t('Arb blend'), $t('Arb\'s colours and its phase colours blended')],
    chrome: [$t('Chrome'), $t('The Arb blend with a shiny colour balance')],
    warm: [$t('Warm'), $t('The Arb blend with a warm colour balance')],
    cold: [$t('Cold'), $t('The Arb blend with a cold colour balance')],
    tomato: [$t('Tomato'), $t('The Arb blend with a red colour balance')],
  });
  function palPref() { try { const v = localStorage.getItem(lsk('cmw-palette')); return Palette.LIST.some((p) => p[0] === v) ? v : 'wheel'; } catch (e) { return 'wheel'; } }
  // a disc whose |w| runs from 10^-3 at the centre to 10^3 at the rim, arg w the angle: the palette as Plain paints it
  const palPreviews = new Map();
  function palPreview(id) {
    if (palPreviews.has(id)) return palPreviews.get(id);
    const n = 40, cv = document.createElement('canvas'); cv.width = cv.height = n;
    const x = cv.getContext('2d'), img = x.createImageData(n, n), mode = Palette.modeOf(id);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n * 2 - 1, v = 1 - (j + 0.5) / n * 2, rho = Math.hypot(u, v), o = 4 * (j * n + i);
      if (rho > 1) continue;
      const a = Math.atan2(v, u), c = mode < 0 ? GLR.phaseRGB(a, 0.75) : Palette.arb(mode, a, Math.pow(10, 6 * rho - 3));
      img.data[o] = Math.round(255 * c[0]); img.data[o + 1] = Math.round(255 * c[1]); img.data[o + 2] = Math.round(255 * c[2]); img.data[o + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    const url = cv.toDataURL('image/png');
    palPreviews.set(id, url);
    return url;
  }
  // done: after a choice (the phone's More sheet relabels its row)
  function palItems(done) {
    const cur = GLR.palette(), names = PAL_NAMES();
    const list = Palette.LIST.map(([id]) => ({ label: names[id][0], tip: names[id][1], radio: true, checked: cur === id, iconHtml: `<img class="pcol-prev" alt="" src="${palPreview(id)}">`, run: () => { setPalette(id); if (done) done(); } }));
    list.menuLabel = $t('Phase colours'); list.focusChecked = true;
    return list;
  }
  function setPalette(id) {
    try { localStorage.setItem(lsk('cmw-palette'), id); } catch (e) { /* storage unavailable */ }
    const changed = GLR.setPalette(id);
    syncPalBtn();
    if (!changed || !paneL) return;
    drawLegend();
    requestRender('L', 'R', 'T');
  }
  function syncPalBtn() {
    const b = $('palBtn');
    if (!b) return;
    const name = PAL_NAMES()[GLR.palette()][0];
    b.setAttribute('data-tip', $t('Phase colours: {name}', { name })); b.setAttribute('aria-label', $t('Phase colours: {name}', { name })); b.removeAttribute('title');
    const pl = b.querySelector('.plabel'); if (pl) pl.textContent = name;
    const ic = /** @type {HTMLElement | null} */ (b.querySelector('.pcol-ic')); if (ic) ic.style.setProperty('--wheel', keyConic());
  }
  // ---------------- the Phase style button (issue #81) ----------------
  // The Phase view's style (Tiles, Plain, Modulus, Contours, Pulled-back grid, Cauchy) is one click away in the header,
  // beside the palette's disc, whenever X is the flat Phase view; in the Landscape the button is there too, dimmed, and says
  // where the styles live. Schematic glyphs, not a render of the user's function: they cost nothing and read in both themes.
  const STYLE_SVG = {
    enhanced: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="1.5" width="6" height="6" rx="1" fill="#F58C7E"/><rect x="8.5" y="1.5" width="6" height="6" rx="1" fill="#53B8F7"/><rect x="1.5" y="8.5" width="6" height="6" rx="1" fill="#6EC580"/><rect x="8.5" y="8.5" width="6" height="6" rx="1" fill="#CFA93E"/></svg>',
    phase: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 8V1.5A6.5 6.5 0 0 1 14.5 8z" fill="#F58C7E"/><path d="M8 8h6.5A6.5 6.5 0 0 1 8 14.5z" fill="#CFA93E"/><path d="M8 8v6.5A6.5 6.5 0 0 1 1.5 8z" fill="#6EC580"/><path d="M8 8H1.5A6.5 6.5 0 0 1 8 1.5z" fill="#53B8F7"/></svg>',
    classic: '<svg viewBox="0 0 16 16" aria-hidden="true"><defs><radialGradient id="stySg"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#fff"/></radialGradient></defs><circle cx="8" cy="8" r="6.5" fill="url(#stySg)" stroke="currentColor" stroke-width="1" stroke-opacity=".5"/></svg>',
    modulus: '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="8" cy="8" r="6.3"/><circle cx="8" cy="8" r="3.8"/><circle cx="8" cy="8" r="1.4"/></svg>',
    grid: '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><path d="M2 4.5c4 1.5 8-1.5 12 0M2 8c4 1.5 8-1.5 12 0M2 11.5c4 1.5 8-1.5 12 0M4.5 2c-1.5 4 1.5 8 0 12M8 2c-1.5 4 1.5 8 0 12M11.5 2c-1.5 4 1.5 8 0 12"/></svg>',
    cauchy: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.5" fill="#53B8F7" fill-opacity=".35" stroke="currentColor" stroke-width="1.3"/><circle cx="8" cy="8" r="1.2" fill="currentColor"/></svg>',
  };
  const styleName = () => (DC_STYLES.find((p) => p[0] === S.dc) || DC_STYLES[0])[1];
  // the style picked, from the plane head's row or the phone's chip (the other follows)
  function pickPhaseStyle(v) {
    setOpt('dc', v); setOpt('landPlain', false); buildRightFoot(); updateFocusUI(); paintChanged(); save();
    const sg = $('dcSeg'); if (sg) setSeg(sg, S.dc);
  }
  // {show: X is the flat Phase view or the Landscape, land: the Landscape (the styles are not its own), name, id}
  function styleState() { return { show: lColor() || lLand(), land: lLand(), name: styleName(), id: S.dc }; }
  function styleItems(done) {
    if (lLand()) {
      return Object.assign([{ label: $t('Styles belong to the flat Phase view'), disabled: true }, 'sep', { label: $t('Switch to Phase'), run: () => { setMain('phase'); if (done) done(); } }], { menuLabel: $t('Phase style') });
    }
    const list = DC_STYLES.map(([id, name, tip]) => ({ label: name, tip, radio: true, checked: S.dc === id, iconHtml: `<span class="sty-prev">${STYLE_SVG[id]}</span>`, run: () => { pickPhaseStyle(id); if (done) done(); } }));
    return Object.assign(list, { menuLabel: $t('Phase style'), focusChecked: true });
  }
  function viewBox(v) {
    const w = paneL ? paneL.w : 500, hh = paneL ? paneL.h : 500;
    return { x0: v.cx - w / 2 / v.s, x1: v.cx + w / 2 / v.s, y0: v.cy - hh / 2 / v.s, y1: v.cy + hh / 2 / v.s };
  }

  // ---------------- left-panel display controls ----------------
  const PATTERNS = [
    ['checker', $t('Checker'), $t('Checkerboard in z-coordinates: shows how squares are bent and scaled')],
    ['polar', $t('Log-polar'), $t('Checkerboard in log|z| and arg z: conformal maps keep these cells square')],
    ['tiles', $t('Tiles'), $t('Tiles with an F glyph: shows rotation, scaling and reflection')],
    ['grid', $t('Square grid'), $t('Cartesian grid lines of z carried by the map')],
    ['polargrid', $t('Polar grid'), $t('Circles |z| = const and rays arg z = const carried by the map')],
    ['phase', $t('Arg z'), $t('Colored by the argument of the source point z')],
    ['stretch', $t('Stretch'), $t('Local scale factor |F′(z)|: blue shrinks, amber grows')],
    // (the count follows the pattern size: sphN() longitude cells by sphN() / 2 latitude cells, 128 at size ×1)
    ['sphere', $t('Sphere checker'), () => $tn('Longitude and latitude cells of the Riemann sphere: {n} cells cover the plane and ∞', 'Longitude and latitude cells of the Riemann sphere: {n} cells cover the plane and ∞', sphN() * sphN() / 2)],
    ['solid', $t('Solid'), $t('Flat fill')],
  ];
  // live swatches (spec 6.4) in the first shape color's tokens (c0, alt, edge): the accent stays for the selection
  // ring, Stretch uses the stretch tokens (no red) and Phase the OKLCH wheel of the Phase tab
  function drawPatternSwatch(cv, id) {
    const x = cv.getContext('2d');
    const W = 52, H = 40, sc = cv.width / W; // 104×80 device px for a 52×40 swatch
    x.setTransform(sc, 0, 0, sc, 0, 0);
    const ink = TH.c[0], c0 = ink.c0, c1 = ink.alt, k = ink.edge;
    const mix = (p, q, t) => { const a = GLR.hexRGB(p), b = GLR.hexRGB(q); return `rgb(${a.map((v, i) => Math.round(255 * (v + (b[i] - v) * t))).join(',')})`; };
    x.fillStyle = c1; x.fillRect(0, 0, W, H);
    if (id === 'checker') {
      const c = 8;
      x.fillStyle = c0;
      for (let i = 0; i < W / c; i++) for (let j = 0; j < H / c; j++) if ((i + j) % 2 === 0) x.fillRect(i * c, j * c, c, c);
    } else if (id === 'tiles') {
      // a 4×3 checker of c1 and mix(c1, c0, 0.35), large enough for the F (stem, top bar, middle bar; y up)
      const c = 13;
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        const ox = i * c, oy = j * c;
        if ((i + j) % 2 === 0) { x.fillStyle = mix(c1, c0, 0.35); x.fillRect(ox, oy, c, c); }
        x.fillStyle = k;
        const box = (u0, u1, v0, v1) => x.fillRect(ox + u0 * c, oy + (1 - v1) * c, (u1 - u0) * c, (v1 - v0) * c);
        box(0.30, 0.42, 0.18, 0.82); box(0.30, 0.72, 0.70, 0.82); box(0.30, 0.62, 0.46, 0.56);
      }
    } else if (id === 'polar' || id === 'polargrid') {
      const cx = W * 0.25, cy = H * 0.9;
      x.lineWidth = 1;
      for (let r = 2, n = 0; r < 70; r *= 1.48, n++) {
        for (let q = 0; q < 16; q++) {
          if (id === 'polar' && (n + q) % 2) continue;
          x.beginPath();
          x.arc(cx, cy, r * 1.48, -q * Math.PI / 8, -(q + 1) * Math.PI / 8, true);
          x.arc(cx, cy, r, -(q + 1) * Math.PI / 8, -q * Math.PI / 8, false);
          x.closePath();
          if (id === 'polar') { x.fillStyle = c0; x.fill(); }
        }
        if (id === 'polargrid') { x.strokeStyle = c0; x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.stroke(); }
      }
      if (id === 'polargrid') {
        x.strokeStyle = k;
        for (let q = 0; q < 24; q++) {
          const a = q * 15 * DEG, axis = q % 6 === 0;
          x.globalAlpha = axis ? 1 : 0.7; x.lineWidth = axis ? 1.75 : 1;
          x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + 80 * Math.cos(a), cy - 80 * Math.sin(a)); x.stroke();
        }
        x.globalAlpha = 1;
      }
    } else if (id === 'grid') {
      // Re lines 1.25px k, Im lines 1px c0, every 5th +0.5px
      for (let i = 0, n = 0; i <= W; i += 8, n++) { x.strokeStyle = k; x.lineWidth = n % 5 ? 1.25 : 1.75; x.beginPath(); x.moveTo(i + 2, 0); x.lineTo(i + 2, H); x.stroke(); }
      for (let j = 0, n = 0; j <= H; j += 8, n++) { x.strokeStyle = c0; x.lineWidth = n % 5 ? 1 : 1.5; x.beginPath(); x.moveTo(0, j + 4); x.lineTo(W, j + 4); x.stroke(); }
    } else if (id === 'phase') {
      // wheel(arg s, L) with L = 0.62 + 0.14·saw(ln|s| / (π/6)), as the shader does
      x.setTransform(1, 0, 0, 1, 0, 0);
      const PW = cv.width, PH = cv.height, img = x.createImageData(PW, PH), u = 14 * sc; // 14 CSS px per unit
      for (let j = 0; j < PH; j++) for (let i = 0; i < PW; i++) {
        const re = (i + 0.5 - PW / 2) / u, im = (PH / 2 - j - 0.5) / u;
        const lr = Math.log(Math.hypot(re, im) || 1e-9) / (Math.PI / 6);
        const rgb = GLR.phaseRGB(Math.atan2(im, re), 0.62 + 0.14 * (lr - Math.floor(lr)));
        const o = 4 * (j * PW + i); img.data[o] = rgb[0] * 255; img.data[o + 1] = rgb[1] * 255; img.data[o + 2] = rgb[2] * 255; img.data[o + 3] = 255;
      }
      x.putImageData(img, 0, 0);
    } else if (id === 'sphere') {
      // the spherical checker about 0 (SPEC 6.3): 16 longitude sectors, latitude rings at |z| = tan(j pi / 16)
      x.setTransform(1, 0, 0, 1, 0, 0);
      const PW = cv.width, PH = cv.height, img = x.createImageData(PW, PH), u = 15 * sc, a = GLR.hexRGB(c0), b = GLR.hexRGB(c1);
      for (let j = 0; j < PH; j++) for (let i = 0; i < PW; i++) {
        const re = (i + 0.5 - PW / 2) / u, im = (PH / 2 - j - 0.5) / u;
        const th = Math.atan2(im, re), lat = 2 * Math.atan(Math.hypot(re, im));
        const par = (Math.floor(th * 16 / TAU) + Math.floor(lat * 8 / Math.PI)) & 1, c = par ? b : a;
        const o = 4 * (j * PW + i); img.data[o] = c[0] * 255; img.data[o + 1] = c[1] * 255; img.data[o + 2] = c[2] * 255; img.data[o + 3] = 255;
      }
      x.putImageData(img, 0, 0);
    } else if (id === 'stretch') {
      const g = x.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, TH.stretchShrink); g.addColorStop(0.5, TH.stretchMid); g.addColorStop(1, TH.stretchGrow);
      x.fillStyle = g; x.fillRect(0, 0, W, H);
    } else {
      x.fillStyle = c0; x.fillRect(0, 0, W, H);
    }
  }
  function buildDisplay() {
    const pat = $('patternSeg');
    pat.innerHTML = '';
    for (const [v, l, tip] of PATTERNS) {
      const cv = h('canvas', { width: 104, height: 80, 'aria-hidden': 'true' });
      const b = h('button', { class: 'pat' + (S.pattern === v ? ' on' : ''), role: 'radio', 'aria-checked': String(S.pattern === v), 'data-pat': v, 'data-tip': typeof tip === 'function' ? tip() : tip, 'aria-label': l,
        onclick: () => { setOpt('pattern', v); buildDisplay(); requestRender('L', 'R', 'T'); save(); tourEmit('pattern-changed', { id: S.pattern }); } }, cv, h('span', null, l));
      pat.append(b);
      drawPatternSwatch(cv, v);
    }
    // ([v17 D5; #247] the pane heads' pattern buttons: their swatch and name)
    for (const pb of document.querySelectorAll('.pat-btn')) {
      const sw = pb.querySelector('.disp-sw'), p = PATTERNS.find((x) => x[0] === S.pattern) || PATTERNS[0], name = $t('Pattern: {name}', { name: p[1] });
      if (sw) drawPatternSwatch(sw, S.pattern);
      pb.setAttribute('aria-label', name); pb.setAttribute('data-tip', name);
    }
    const ps = Math.round(Math.log2(S.patternScale || 1));
    $('patScale').value = ps;
    $('patScaleVal').textContent = ps === 0 ? '×1' : ps > 0 ? `×${2 ** ps}` : `×1/${2 ** -ps}`;
    $('meshRange').min = 0; $('meshRange').max = 1000; $('meshRange').step = 1;
    $('meshRange').value = meshToPos(S.meshN);
    showMeshVal(S.meshN);
    $('linesChk').checked = !!S.lines;
    $('chevChk').checked = !!S.chev;
    $('unitChk').checked = S.unit !== false;
    $('alphaRange').value = S.alpha;
    $('alphaVal').textContent = I18N.num(S.alpha.toFixed(2));
    for (const r of document.querySelectorAll('input[type=range]')) paintFader(r);
  }
  // filled part of a fader track (CSS reads --fill)
  function paintFader(r) {
    const lo = +r.min || 0, hi = r.max === '' ? 100 : +r.max, v = +r.value;
    const fill = `${((v - lo) / (hi - lo || 1)) * 100}%`;
    r.style.setProperty('--fill', fill);
    if (r.closest('.tscrub')) r.closest('.tscrub').style.setProperty('--fill', fill);
  }

  // below 1280 px the guarantees panel is an overlay drawer, below 1024 px the tools panel too
  // (v15: the Inspector never is a drawer: it docks at 264 px from 1024, under the chain from 768 to 1023)
  const isDrawer = (side) => (side === 'R' ? false : window.innerWidth < 1024) && window.innerWidth >= 768;
  // from 1024 to 1279 one side panel docks at a time (DESIGN.md 4)
  const oneDock = () => window.innerWidth >= 1024 && window.innerWidth < 1280;
  function setPanels(hideL, hideR) {
    const reqL = !!hideL, reqR = !!hideR;
    // only one drawer at a time when both panels are drawers
    if ((isDrawer('L') && isDrawer('R')) || oneDock()) {
      if (!hideL && S.hideLeft) hideR = true;
      else if (!hideR && S.hideRight) hideL = true;
    }
    // (review regress-1: a panel the one-dock rule closed is closed at run time only; the user's choice stays)
    const forcedL = !!hideL && !reqL, forcedR = !!hideR && !reqR;
    if (sndP.on && (!!hideL !== !!S.hideLeft || !!hideR !== !!S.hideRight)) sndToggleCue(!(hideL && hideR) && (!hideL && S.hideLeft || !hideR && S.hideRight));
    setHidden('L', !!hideL); setHidden('R', !!hideR);
    // only a choice made where the panel docks is the user's preference; drawers are run-time state
    if (!isDrawer('L') && !forcedL) dockPref.L = S.hideLeft;
    if (!isDrawer('R') && !forcedR) dockPref.R = S.hideRight;
    applyLayout();
    save();
  }
  function closeDrawers() {
    const l = isDrawer('L') && !S.hideLeft, r = isDrawer('R') && !S.hideRight;
    if (l || r) { setPanels(S.hideLeft || l, S.hideRight || r); return true; }
    return false;
  }
  function setSolo(which) {
    if (Views.merged(S.view, morphOn())) return; // a merged view is one panel: nothing to expand
    setOpt('solo', S.solo === which ? null : which);
    applyLayout();
    save();
  }
  function applyLayout() {
    const lay = document.querySelector('.layout');
    placeKeys();
    if (oneDock() && !S.hideLeft && !S.hideRight) setHidden('L', true);   // (run time: the docked choice stays the user's)
    if (!S.hideRight) closeTemp(); else requestRender('P');
    // ([v17 D4] the selected shape's editor follows the Inspector: in it while it shows, under its row when hidden)
    if (shapeEdWhere !== inspEditsShapes()) { shapeEdWhere = inspEditsShapes(); if (selected != null) buildShapeList(); }
    lay.classList.toggle('hide-left', !!S.hideLeft);
    lay.classList.toggle('hide-right', !!S.hideRight);
    $('toggleLeft').setAttribute('aria-pressed', String(!S.hideLeft));
    $('toggleRight').setAttribute('aria-pressed', String(!S.hideRight));
    $('pipeline').classList.toggle('compact', !!S.compact);
    setSeg($('chainMode'), S.compact ? 'compact' : 'cards');
    const panes = document.querySelector('.panes');
    // merged views (merged-views.md): one wide panel, the other pane hidden (on a phone too) and no expand button,
    // so it reads as a view of its own, not an expanded pane
    const one = solo(), mg = Views.merged(S.view, morphOn());
    panes.classList.toggle('solo-L', one === 'L');
    panes.classList.toggle('solo-R', one === 'R');
    panes.classList.toggle('merged-L', mg === 'L');
    panes.classList.toggle('merged-R', mg === 'R');
    for (const [id, w] of [['leftSolo', 'L'], ['rightSolo', 'R']]) {
      const b = $(id);
      b.hidden = !!mg;
      b.setAttribute('aria-pressed', String(S.solo === w));
      b.setAttribute('data-tip', S.solo === w ? $t('Show both planes') : $t('Expand plane')); b.removeAttribute('title');
      b.innerHTML = S.solo === w ? ICONS.restore : ICONS.expand;
    }
    syncModeChips();
    if (mg !== layoutMg || one !== layoutOne) { layoutMg = mg; layoutOne = one; if (paneL && paneR) onPaneResize(); requestRender('L', 'R', 'OL', 'OR'); }
  }
  let layoutMg = null, layoutOne = null;
  // the panes' canvases follow their boxes (the ResizeObserver, and a layout change at once: a merge or a split
  // must not leave a frame, a fit or a mesh to be made at the old width)
  function onPaneResize() {
    const a = paneL.resize(), b = paneR.resize();
    $('paneR').classList.toggle('narrow', $('paneR').getBoundingClientRect().width < 520);
    $('paneL').classList.toggle('narrow', $('paneL').getBoundingClientRect().width < 520);
    syncViewControls();
    fitRightTitle();
    if (a && leftStage() > 0 && leftAuto && solo() !== 'R') { paneL.setView(V.left); fitPane(paneL, leftStage()); }
    if (a || b) {
      // (a merged view widens one pane: its options strip re-flows at the new width; a hidden pane is not fitted)
      layoutFoot();
      sourceViewChanged();
      if (rightAuto && rImage() && solo() !== 'L') fitRight();
      requestRender('L', 'R', 'T');
      sndRelayout();   // (sound: the plane under a still pointer moved)
    }
  }

  // the mesh fader is piecewise logarithmic so each named stop sits on its tick
  // Draft, Normal, Fine, Ultra, Max
  const MESH_STOPS = [160, 240, 480, 960, 1920];
  function posToMesh(p) {
    const seg = Math.max(0, Math.min(3, Math.floor(p / 250))), t = (p - seg * 250) / 250;
    const a = MESH_STOPS[seg], b = MESH_STOPS[seg + 1];
    return Math.round(Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * t) / 10) * 10;
  }
  function meshToPos(n) {
    n = Math.max(MESH_STOPS[0], Math.min(MESH_STOPS[4], n));
    for (let i = 0; i < 4; i++) { const a = MESH_STOPS[i], b = MESH_STOPS[i + 1]; if (n <= b) return Math.round(i * 250 + 250 * Math.log(n / a) / Math.log(b / a)); }
    return 1000;
  }
  function showMeshVal(n) {
    $('meshVal').textContent = `${n}`;
    for (const b of document.querySelectorAll('#meshPresets button')) b.classList.toggle('on', +b.dataset.n === n);
    $('meshNote').hidden = n < 480;
    paintFader($('meshRange'));
  }
  function setMesh(n) {
    n = Math.max(MESH_MIN, Math.min(MESH_MAX, Math.round(n)));
    if (n === S.meshN) return;
    setOpt('meshN', n);
    dropAllGPU();
    $('meshRange').value = meshToPos(n);
    showMeshVal(n);
    if (rightAuto && rImage()) fitRight();
    requestRender('L', 'R', 'T');
    save();
  }

  // the views (merged-views.md): the top bar's switch X → Y · Phase · Landscape (keys 1-3 by e.code), the panes'
  // Plane | Sphere switches in their heads (Shift 1, 2: the left or only panel, X or the portrait; Shift 3, 4: Y),
  // and the Deformation toggle (M), which modifies the active view. The preimages and the integrals are parts of every
  // view.
  const SURF = {
    L: [['plane', $t('Plane'), '⇧1'], ['sphere', $t('Sphere'), '⇧2']],
    R: [['plane', $t('Plane'), '⇧3'], ['sphere', $t('Sphere'), '⇧4']],
  };
  const MAINS = [['xy', 'X → Y', '1', '<i>X</i><span class="arr"> → </span><i>Y</i>'], ['phase', $t('Phase'), '2', $t('Phase')], ['land', $t('Landscape'), '3', $t('Landscape')]];
  const VIEW_ICONS = { plane: MODE_ICONS.image, sphere: MODE_ICONS.sphere, land: MODE_ICONS['3d'], phase: MODE_ICONS.color, xy: MODE_ICONS.xy };
  // the globes' static programs, started in the background when a switch to Sphere is coming (the pointer or focus on
  // a Sphere control, the switch itself a frame ahead of its draw), so the first globe frame does not link them one
  // after another (GLR.prestart; P3 review: 51-55 ms long tasks on the first switch to X Sphere). Not at start-up:
  // compiles there compete with the first scene's own (example settle times)
  function prestartGlobe() { try { if (GLR.ok && GLR.prestart) GLR.prestart(GLR.GLOBE_PROGS); } catch (e) { /* the frame links them */ } }
  // side 'L': X's surface in the active view (X → Y's left pane or the phase panel); 'R': Y's (X → Y)
  function setView(side, surf) {
    if (side === 'L' && lLand()) return;
    const v = side === 'L' ? xView() : S.view.R;
    if (!v || v.surf === surf || !(side === 'L' ? Views.SURF_L : Views.SURF_R).includes(surf)) return;
    if (surf === 'sphere') prestartGlobe();
    v.surf = surf;
    viewChanged(side);
  }
  // Each view keeps its own plane view and cameras (merged-views.md): X → Y and Phase both show X's plane and globe,
  // so the plane view (S.srcView, and V.left at a focused stage) and the z-globe's camera are swapped on a switch; the
  // landscape (cam) and the w-globe (camS) belong to one view each already. A view seen for the first time starts from
  // the one it was switched from.
  const viewMem = {};
  const camKeys = (c) => ({ yaw: c.yaw, pitch: c.pitch, dist: c.dist, tx: c.tx || 0, ty: c.ty || 0, tz: c.tz || 0, fov: c.fov });
  function setMain(main) {
    if (!Views.MAIN.includes(main) || S.view.main === main) return;
    phHold();
    const from = S.view.main;
    soundCue('view', { k: Views.MAIN.indexOf(main) });
    if (main !== 'land' && (main === 'phase' ? S.view.P.surf : S.view.L.surf) === 'sphere') prestartGlobe();
    cancelTweens();
    viewMem[from] = { src: Object.assign({}, S.srcView), left: Object.assign({}, V.left), leftAuto, camL: camKeys(camL) };
    setViewOpt(null, 'main', main);
    const m = viewMem[main];
    if (m) {
      Object.assign(S.srcView, m.src); Object.assign(V.left, m.left); leftAuto = m.leftAuto;
      Object.assign(camL, m.camL, { vyaw: 0, vpitch: 0 });
    }
    // an example's box (ex.fit), untouched since it opened, fits the X pane of a view seen for the first time (review ui-3)
    const refit = !m && exFitKey && exFitKey === JSON.stringify(S.srcView) && EX[currentExample] && EX[currentExample].fit;
    // a shape draft and the probe end with the view they were made in; targets are edited in Y (X → Y only)
    draft = null; probe = null; hoverCut = 0; setReadouts(null);
    rHover = null; setHoverW(null);
    applyLayout();
    if (refit) { exFitTo(EX[currentExample]); paneL.setView(S.srcView); }
    sndRelayout();
    buildShapeList();
    updateFocusUI(); scheduleFix(); requestRender('L', 'R', 'OL', 'OR'); save();
    tourEmit('view-changed', { main });
  }
  // U-b's Phase toggle, kept for the test hooks: on, the Phase view on X's surface; off, X → Y on the phase panel's
  function setPhase(on) {
    if (!!on === (S.view.main === 'phase')) return;
    if (on) { if (S.view.main === 'xy') setViewOpt('P', 'surf', S.view.L.surf); setMain('phase'); }
    else { setViewOpt('L', 'surf', S.view.P.surf); setMain('xy'); }
  }
  function viewChanged(side) {
    if (side === 'R') {
      // targets are drawn and edited in Y Plane; a target draft and a target selection end with it (the transport
      // stays open)
      // targets are drawn in Y Plane and on the w-globe (P3b): a target draft ends with the view it was drawn in
      if (draft && draft.target) draft = null;
      rHover = null; setHoverW(null);
      if (autoFit()) { rightAuto = true; fitRight(); }
      buildShapeList();
    } else {
      // a shape draft ends with the view it was drawn in (the plane or the z-globe); the flat probe goes
      draft = draft && draft.target ? draft : null;
      if (!lFlat()) { probe = null; hoverCut = 0; setReadouts(null); }
    }
    updateFocusUI(); scheduleFix(); requestRender('L', 'R'); save();
  }
  // the head controls show the state
  function syncViewControls() {
    const main = S.view.main;
    setSeg($('viewSwitch'), main);
    setSeg($('leftTabs'), xView().surf);
    setSeg($('rightTabs'), S.view.R.surf);
    // the landscape is its own surface: no Plane | Sphere in its head
    const lt = $('leftTabs'); if (lt && lt.parentElement.hidden !== lLand()) lt.parentElement.hidden = lLand();
    if (lt) { const al = main === 'phase' ? $t('Phase portrait surface') : $t('Left pane surface'); if (lt.getAttribute('aria-label') !== al) lt.setAttribute('aria-label', al); }
    // X's switch (X → Y's left pane, the phase panel) takes Shift 1, 2; Y's takes Shift 3, 4
    for (const b of lt ? lt.children : []) { const k = b.dataset.mode === 'plane' ? '⇧1' : '⇧2'; const tip = `${b.getAttribute('aria-label')}${k ? '  ' + k : ''}`; if (b.dataset.tip !== tip) b.dataset.tip = tip; }
    // the view names the map in focus (P13)
    const vs = $('viewSwitch');
    if (vs) for (const b of vs.children) {
      const F = fnText(), tip = { xy: $t(`X → Y: the shapes and their images  1`), phase: $t('Phase portrait of {F}  2', { F }), land: $t('Landscape of {F}  3', { F }) }[b.dataset.mode];
      if (b.dataset.tip !== tip) b.dataset.tip = tip;
    }
    // the Deformation toggle: pressed while the transport is open; with no active step it explains instead of acting
    const mb = $('morphBtn');
    if (mb) {
      const can = morphRange().steps.length > 0;
      mb.setAttribute('aria-pressed', String(!!morph.open));
      mb.setAttribute('aria-disabled', String(!can && !morph.open));
      const tip = !can && !morph.open ? (S.focus > 0 ? $t('This step is off: turn it on to deform') : $t('Add a function to deform')) : morph.open ? $t('Close the deformation  M') : $t('Deformation of {F}  M', { F: S.focus > 0 ? fnText() : 'F' });
      if (mb.dataset.tip !== tip) mb.dataset.tip = tip;
    }
  }
  // Snap (the Draw heading and the rail) and Unit circle (Display) show the state (P3)
  function syncSnapUnit() {
    for (const id of ['snapBtn', 'railSnap']) { const b = $(id); if (b) b.setAttribute('aria-pressed', String(!!S.snap)); }
    const u = $('unitChk');
    if (u && u.checked !== !!S.unit) u.checked = !!S.unit;
  }
  // P4: a drawing tool pressed in X at focus k >= 2 draws nothing; the Whole chain button pulses once
  function pulseWhole() {
    const b = $('viewAllBtn');
    if (!b) return;
    b.classList.remove('pulse'); void b.offsetWidth; b.classList.add('pulse');
    clearTimeout(pulseWhole.t); pulseWhole.t = setTimeout(() => b.classList.remove('pulse'), 900);
  }
  // resizable gutters between the planes and above the chain (sizes are per viewer)
  function setupGutters() {
    const stage = $('stage'), panes = $('panes');
    const store = (k, v) => { try { localStorage.setItem(lsk(k), String(v)); } catch (e) { /* ignore */ } };
    const read = (k) => { try { return localStorage.getItem(lsk(k)); } catch (e) { return null; } };
    // (v15: the chain is 188 px with pictures, 96 with names; a height saved for the old 272 px cards is not reused)
    const ch = +read('cmw-chain-h2'); if (ch) document.documentElement.style.setProperty('--chain-h', ch + 'px');
    else if (S && S.compact) document.documentElement.style.setProperty('--chain-h', '96px');   // (Names, saved before v15)
    // TEMP-DEBUG-HOOK (removed before publishing)
    // the quality and perf suites render their scenes at the v14 pane geometry (a 272 px chain), so their golden images
    // and baselines stay valid (test/regress/quality/run_quality.js, test/regress/perf/run.js set window.__cmwChainH)
    if (window.__cmwChainH > 0) document.documentElement.style.setProperty('--chain-h', window.__cmwChainH + 'px'); // TEMP-DEBUG-HOOK
    const sp = +read('cmw-split'); if (sp) panes.style.setProperty('--split', String(sp));
    const drag1 = (el, onMove, onEnd) => el.addEventListener('pointerdown', (e) => {
      e.preventDefault(); el.setPointerCapture(e.pointerId); el.classList.add('active');
      const mv = (ev) => onMove(ev);
      const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.classList.remove('active'); onEnd && onEnd(); };
      el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up);
    });
    const row = $('gutterRow');
    if (row) drag1(row, (e) => {
      const r = stage.getBoundingClientRect();
      let hgt = r.bottom - e.clientY - 4;
      hgt = Math.max(96, Math.min(r.height * 0.5, hgt));
      for (const snapTo of [96, 188]) if (Math.abs(hgt - snapTo) < 12) hgt = snapTo;
      document.documentElement.style.setProperty('--chain-h', Math.round(hgt) + 'px');
      setOpt('compact', hgt < 140); $('pipeline').classList.toggle('compact', S.compact); setSeg($('chainMode'), S.compact ? 'compact' : 'cards');
    }, () => store('cmw-chain-h2', parseInt(getComputedStyle(stage).getPropertyValue('--chain-h')) || 188));
    const col = $('gutterCol');
    if (col) {
      drag1(col, (e) => {
        const r = panes.getBoundingClientRect();
        const f = Math.max(0.2, Math.min(0.8, (e.clientX - r.left) / r.width));
        panes.style.setProperty('--split', f.toFixed(4));
      }, () => store('cmw-split', panes.style.getPropertyValue('--split') || 0.5));
      col.addEventListener('dblclick', () => { panes.style.setProperty('--split', '0.5'); store('cmw-split', 0.5); });
    }
  }
  // tooltips: elements with data-tip (or title) show a styled tip after a short delay
  function setupTooltips() {
    const tip = $('tip');
    if (!tip) return;
    let timer = 0, cur = null, lastHide = 0, kbdTip = null, navKeyAt = -1e9;
    // (v16.5 UX17) the tool descriptions that say click, in touch words (the others drag, hold or pick)
    const TOUCH_DESC = {
      point: () => $t('Tap to place a point; its images are labelled a′, a″, …'),
      polygon: () => $t('Tap the vertices; tap the first one to close.'),
      segment: () => $t('Tap one end and then the other, or drag between them.'),
      line: () => $t('Tap two points, or drag through them; the line extends to infinity.'),
      ray: () => $t('Tap the start and then a point on the ray, or drag from the start.'),
      circle: () => $t('Tap the center and then a point on the circle, or drag from the center.'),
      meet: () => $t('Tap a crossing of two curves, or one curve and then another.'),
      touch: () => $t('Pick a line or a circle, then the point where the new circle touches it and a point it passes through, in either order. Tap the dashed tangent or Tangent line for the tangent line, or a ring for a tangent from the point. The curve stays picked for the next one.'),
    };
    const show = (el) => {
      const text = el.getAttribute('data-tip');
      // (v16.5 UX34: never for an element that went away, or one the mouse already left)
      if (!text || !el.isConnected || (el !== lpShown && el !== kbdTip && !el.matches(':hover'))) return;
      const [label, key] = text.split(/\s{2,}/);
      // (v16.5 UX17: a long-press tip on touch names no key and says tap, not click)
      const byTouch = el === lpShown;
      tip.innerHTML = '';
      tip.append(document.createTextNode(label));
      if (key && !byTouch) tip.append(h('span', { class: 'tip-key' }, key));
      // a tool's description: the tooltip's second line (items 3 and 6 moved the descriptions here)
      const tdesc = byTouch && TOUCH_DESC[el.getAttribute('data-tool')];
      const desc = tdesc ? tdesc() : el.getAttribute('data-desc');
      if (desc) tip.append(h('span', { class: 'tip-desc' }, desc));
      tip.hidden = false;
      const r = el.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
      let y = r.top - th - 6; if (y < 6) y = r.bottom + 6;
      tip.style.left = Math.max(6, Math.min(window.innerWidth - tw - 6, r.left + r.width / 2 - tw / 2)) + 'px';
      tip.style.top = y + 'px';
    };
    const hide = () => { clearTimeout(timer); if (!tip.hidden) lastHide = performance.now(); tip.hidden = true; cur = null; kbdTip = null; };
    document.addEventListener('pointerover', (e) => {
      if (e.pointerType === 'touch') return;
      const el = e.target.closest && e.target.closest('[data-tip],[title]');
      if (!el || el === cur) return;
      if (el.hasAttribute('title') && !el.hasAttribute('data-tip')) { el.setAttribute('data-tip', el.getAttribute('title')); el.removeAttribute('title'); }
      hide();
      cur = el;
      timer = setTimeout(() => show(el), performance.now() - lastHide < 300 ? 0 : 450);
    });
    document.addEventListener('pointerout', (e) => { if (cur && !lpShown && (!e.relatedTarget || !cur.contains(e.relatedTarget))) hide(); });
    document.addEventListener('pointerdown', hide, true);
    document.addEventListener('keydown', hide, true);
    // v16.5 UX34 (restores 'tooltips never stick'): a tip shows on hover only, never after a focus (a focus the app
    // moves, after a palette or a dialog closes, left the tip over the planes); it goes when its element goes, on a
    // scroll and when the window loses the pointer
    document.addEventListener('pointermove', () => { if (cur && !cur.isConnected) hide(); }, { passive: true, capture: true });
    document.addEventListener('scroll', (e) => { if (!tip.hidden && cur && (e.target === document || (e.target instanceof Element && e.target.contains(cur)))) { lpShown = null; hide(); } }, { passive: true, capture: true });
    window.addEventListener('blur', () => { lpCancel(); lpShown = null; hide(); });
    // ([v16.5 fix regress-9] a keyboard user's Tab still names an icon and its key: a tip after a focus that Tab, Shift+Tab
    // or an arrow key moved, on :focus-visible; a focus the app moves itself (after a click, a palette, a dialog, Enter or
    // Esc) shows none, as UX34 asks. It goes with the focus, on any key and on any press)
    document.addEventListener('keydown', (e) => { if (e.key === 'Tab' || /^Arrow/.test(e.key)) navKeyAt = performance.now(); }, true);
    document.addEventListener('focusin', (e) => {
      const el = e.target && e.target.closest ? e.target.closest('[data-tip],[title]') : null;
      if (!el || performance.now() - navKeyAt > 300 || !el.matches(':focus-visible')) return;
      if (el.hasAttribute('title') && !el.hasAttribute('data-tip')) { el.setAttribute('data-tip', el.getAttribute('title')); el.removeAttribute('title'); }
      hide();
      cur = el; kbdTip = el;
      timer = setTimeout(() => show(el), 300);
    });
    document.addEventListener('focusout', (e) => { if (kbdTip && (e.target === kbdTip || kbdTip.contains(e.target))) { kbdTip = null; hide(); } });
    // touch (P5): tooltips are skipped above, so a 450 ms long-press on a tool, a pattern swatch or a view button
    // shows the same tip; moving the finger cancels it, and the release after a tip does not also press the button
    // (#247: also the pane heads' icon toggles, style glyphs, pattern and ⋯ buttons, named only by their tips)
    const LP_SEL = '.tool[data-tip], .pat[data-tip], #viewSwitch [data-tip], #leftTabs [data-tip], #rightTabs [data-tip], .phbtn[data-tip], '
      + '.pane-head .ic-tg[data-tip], .pane-head .sty-seg > button[data-tip], .pane-head .opts-btn[data-tip], .shortmark[data-tip]';
    // (v16.3.1: lpDown, the press by its event's own time. The timer measures 450 ms on the page's clock, which a busy
    // page (one still settling) runs late: a quick tap whose release waited behind a long task looked like a long-press,
    // and its click was swallowed. The release decides by the events' times instead)
    let lp = null, lpShown = null, lpDown = null;
    const lpCancel = () => { if (lp) { clearTimeout(lp.t); lp = null; } };
    document.addEventListener('pointerdown', (e) => {
      lpCancel();
      if (lpShown) { lpShown = null; hide(); }
      lpDown = null;
      if (e.pointerType !== 'touch') return;
      const el = e.target.closest && e.target.closest(LP_SEL);
      if (!el) return;
      lpDown = { id: e.pointerId, t: e.timeStamp };
      lp = { el, x: e.clientX, y: e.clientY, id: e.pointerId, t: setTimeout(() => { lp = null; cur = el; lpShown = el; show(el); }, 450) };
    });
    document.addEventListener('pointermove', (e) => { if (lp && e.pointerId === lp.id && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 8) lpCancel(); }, { passive: true });
    document.addEventListener('pointercancel', lpCancel);
    document.addEventListener('pointerup', (e) => {
      lpCancel();
      const down = lpDown;
      lpDown = null;
      if (!lpShown) return;
      // a release less than 450 ms after the press, by the events' times, is a tap: the tip goes, the click goes through
      if (down && e.pointerId === down.id && e.timeStamp - down.t < 450) { lpShown = null; hide(); return; }
      // (v16.5 UX34) the tip goes when the finger lifts; the click that follows the release is swallowed
      const el = lpShown;
      const swallow = (ev) => { if (el.contains(ev.target)) { ev.preventDefault(); ev.stopPropagation(); } };
      document.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => document.removeEventListener('click', swallow, { capture: true }), 400);
      lpShown = null; hide();
    });
    // the long-press must not open the system's context menu over the tip
    document.addEventListener('contextmenu', (e) => { const tg = /** @type {HTMLElement} */ (e.target); if (lpShown || (lp && tg.closest && tg.closest(LP_SEL))) e.preventDefault(); });
  }
  // ---------------- keyboard focus across rebuilds ----------------
  // Lists, cards and segmented controls are rebuilt from the state. A control is known by its id, or by the
  // row/card keys above it (data-k, data-id, ...) plus its class and label, so its rebuilt twin can take the focus.
  const FK_ATTRS = ['data-k', 'data-id', 'data-mode', 'data-v', 'data-tool', 'data-conn', 'data-n'];
  const FK_STATE = new Set(['on', 'sel', 'focus', 'off', 'bad', 'active', 'dragging', 'drop', 'hidden-shape', 'copied', 'scrub', 'scrubbing']);
  function focusKey(el) {
    if (!(el instanceof Element) || el === document.body) return null;
    if (el.id) return { id: el.id };
    const path = [];
    let n = el, root = null;
    while (n && n !== document.body) {
      if (n !== el && n.id) { root = n.id; break; }
      const a = FK_ATTRS.filter((k) => n.hasAttribute(k)).map((k) => `${k}=${n.getAttribute(k)}`).join(',');
      if (a) path.push(a);
      n = n.parentElement;
    }
    if (!root) return null;
    const g = el.getAttribute('role') === 'radio' && el.closest('[role="radiogroup"]');
    return { root, path: path.join('|'), tag: el.tagName, cls: [...el.classList].filter((c) => !FK_STATE.has(c)).sort().join('.'), label: el.getAttribute('aria-label') || '', group: g ? g.getAttribute('aria-label') || '' : null };
  }
  function findByKey(key) {
    if (!key) return null;
    if (key.id) return $(key.id);
    const root = $(key.root);
    if (!root) return null;
    if (key.group != null) {
      // a radio hands the focus to the checked radio of its group
      const g = [root, ...root.querySelectorAll('[role="radiogroup"]')].find((x) => x.getAttribute('role') === 'radiogroup' && (x.getAttribute('aria-label') || '') === key.group);
      const on = g && g.querySelector('[role="radio"][aria-checked="true"]');
      if (on) return on;
    }
    let same = null, other = null;
    for (const el of root.getElementsByTagName(key.tag)) {
      const k = focusKey(el);
      if (!k || k.root !== key.root || k.cls !== key.cls) continue;
      if (k.path === key.path) { if (k.label === key.label) return el; same = same || el; } else other = other || el;
    }
    return same || other; // same row with a changed label (Hide → Show), else the same control in another row
  }
  // after a menu, palette or dialog closes: back to its opener, the opener's rebuilt twin, or the phone's ⋯ button
  // when the opener sat in that (now closed) menu
  function focusBack(anchor, key) {
    const a = document.activeElement;
    if (a && a !== document.body) return;
    const vis = (el) => (el && el !== document.body && el.isConnected && el.getClientRects().length ? el : null);
    const t = vis(anchor) || vis(findByKey(key)) || (anchor && anchor.closest && anchor.closest('#hdrMenu, #examplesBtn') ? vis($('hdrMoreBtn')) : null);
    if (t) t.focus({ preventScroll: true });
  }
  // radiogroups are one Tab stop: only the checked radio is tabbable
  function roveRadios() {
    for (const g of document.querySelectorAll('[role="radiogroup"]')) {
      const rs = [...g.querySelectorAll('[role="radio"]')];
      if (!rs.length) continue;
      const on = rs.find((r) => r.getAttribute('aria-checked') === 'true') || rs[0];
      for (const r of rs) { const t = r === on ? 0 : -1; if (r.tabIndex !== t) r.tabIndex = t; }
    }
  }
  // a laptop's tool grids and the chain are one Tab stop each, the arrows move inside, and F6 moves between
  // the areas (the top bar, the tools, X, Y, the chain, the Inspector). A phone keeps every control a stop
  const ROVE = [['#tools', '.tool'], ['#constructTools', '.tool'], ['#pipeline', '.card, .ftile']];
  const roveLast = new Map();   // group selector -> the item that last had the focus
  const onLaptop = () => !document.documentElement.classList.contains('ph');
  const shown = (el) => !!el && el.isConnected && el.getClientRects().length > 0;
  function roveGroups() {
    for (const [gs, isel] of ROVE) {
      const g = document.querySelector(gs);
      if (!g) continue;
      const items = /** @type {HTMLElement[]} */ ([...g.querySelectorAll(isel)]);
      if (!items.length) continue;
      if (!onLaptop()) { for (const it of items) if (it.tabIndex !== 0) it.tabIndex = 0; continue; }
      const vis = items.filter(shown), last = roveLast.get(gs);
      const on = (last && vis.includes(last) ? last : null) || vis.find((el) => el.classList.contains('on') || el.classList.contains('focus')) || vis[0];
      for (const it of items) { const t = it === on ? 0 : -1; if (it.tabIndex !== t) it.tabIndex = t; }
    }
  }
  // arrows inside a tool grid: left and right to the next tool, up and down to the nearest tool in the next row
  function toolKeys(e) {
    if (!onLaptop() || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const dx = { ArrowRight: 1, ArrowLeft: -1 }[e.key], dy = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (!dx && !dy && e.key !== 'Home' && e.key !== 'End') return;
    const t = /** @type {HTMLElement} */ (e.target), g = t && t.closest ? t.closest('#tools, #constructTools') : null;
    if (!g || !t.classList.contains('tool')) return;
    const items = /** @type {HTMLElement[]} */ ([...g.querySelectorAll('.tool')]).filter(shown), i = items.indexOf(t);
    if (i < 0) return;
    let j = i;
    if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = items.length - 1;
    else if (dx) j = Math.max(0, Math.min(items.length - 1, i + dx));
    else {
      const r = t.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let best = null, bd = Infinity;
      for (const o of items) {
        const q = o.getBoundingClientRect(), oy = q.top + q.height / 2;
        if (dy > 0 ? oy <= cy + r.height / 2 : oy >= cy - r.height / 2) continue;
        const d = Math.abs(oy - cy) * 4 + Math.abs(q.left + q.width / 2 - cx);
        if (d < bd) { bd = d; best = o; }
      }
      if (best) j = items.indexOf(best);
    }
    e.preventDefault(); e.stopPropagation();
    if (j !== i) items[j].focus({ preventScroll: true });
  }
  // F6 and Shift+F6: the next and the previous area. Each area takes the focus where it last had it
  function areaKeys(e) {
    if (e.key !== 'F6' || e.altKey || e.ctrlKey || e.metaKey || !onLaptop() || document.querySelector('.modal-bg')) return;
    const act = (gs) => { const g = document.querySelector(gs); return g ? /** @type {HTMLElement[]} */ ([...g.querySelectorAll(ROVE.find((r) => r[0] === gs)[1])]).find((el) => el.tabIndex === 0 && shown(el)) : null; };
    const plane = (p) => { const cv = p && p.ocanvas; if (cv && !cv.hasAttribute('tabindex')) cv.tabIndex = -1; return shown(cv) ? cv : null; };
    const first = (gs) => { const g = document.querySelector(gs); return g ? [...g.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex="0"]')].find(shown) || null : null; };
    const areas = [
      { id: 'top', el: () => first('#top'), has: (el) => !!el.closest('#top') },
      { id: 'tools', el: () => act('#tools'), has: (el) => !!el.closest('#secDraw, #railTools') },
      { id: 'x', el: () => plane(paneL), has: (el) => paneL && el === paneL.ocanvas },
      { id: 'y', el: () => plane(paneR), has: (el) => paneR && el === paneR.ocanvas },
      { id: 'chain', el: () => act('#pipeline'), has: (el) => !!el.closest('#pipeline') },
      { id: 'inspector', el: () => (S.hideRight ? null : first('#propsPanel')), has: (el) => !!el.closest('#propsPanel') },
    ].filter((a) => a.el());
    if (!areas.length) return;
    const a = document.activeElement;
    const i = areas.findIndex((r) => a && a !== document.body && r.has(a));
    const j = i < 0 ? (e.shiftKey ? areas.length - 1 : 0) : (i + (e.shiftKey ? -1 : 1) + areas.length) % areas.length;
    e.preventDefault(); e.stopPropagation();
    /** @type {HTMLElement} */ (areas[j].el()).focus({ preventScroll: true });
  }
  let lastFocus = null;
  function setupFocusKeeper() {
    document.addEventListener('keydown', toolKeys, true);
    document.addEventListener('keydown', areaKeys, true);
    document.addEventListener('focusin', (e) => {
      lastFocus = { el: e.target, key: focusKey(e.target) };
      const t = /** @type {Element} */ (e.target);
      for (const [gs, isel] of ROVE) { const g = document.querySelector(gs); if (g && t.closest && g.contains(t) && t.matches(isel)) { roveLast.set(gs, /** @type {HTMLElement} */ (t)); roveGroups(); } }
    });
    // a real blur (the user moved on) forgets the control; a blur by removal keeps it for the rebuild below
    document.addEventListener('focusout', (e) => { const tg = /** @type {HTMLElement} */ (e.target); const el = tg; queueMicrotask(() => { if (lastFocus && lastFocus.el === el && el.isConnected && document.activeElement !== el) lastFocus = null; }); });
    const mo = new MutationObserver(() => {
      roveRadios(); roveGroups();
      const a = document.activeElement;
      if ((a && a !== document.body) || !lastFocus || lastFocus.el.isConnected || document.querySelector('.modal-bg')) return;
      const el = findByKey(lastFocus.key);
      if (el && el.getClientRects().length) el.focus({ preventScroll: true });
    });
    for (const id of ['shapeList', 'pipeline', 'patternSeg', 'leftFoot', 'rightFoot', 'leftTabs', 'rightTabs', 'chainMode', 'propsPanel', 'tools']) {
      const el = $(id);
      if (el) mo.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-checked'] });
    }
    roveRadios(); roveGroups();
  }
  // radiogroups without their own handler: arrows (and Home/End) move the checked radio and the focus with it
  function radioKeys(group) {
    group.addEventListener('keydown', (e) => {
      const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!dir && e.key !== 'Home' && e.key !== 'End') return;
      const rs = [...group.querySelectorAll('[role="radio"]')];
      const i = rs.findIndex((r) => r.getAttribute('aria-checked') === 'true');
      const j = e.key === 'Home' ? 0 : e.key === 'End' ? rs.length - 1 : Math.max(0, Math.min(rs.length - 1, i + dir));
      e.preventDefault();
      if (j === i || !rs[j]) return;
      rs[j].click();
      const on = group.querySelector('[role="radio"][aria-checked="true"]');
      if (on) on.focus({ preventScroll: true });
    });
  }
  // toast with an optional action (used instead of confirmation dialogs).
  // An Undo toast is bound to the history entry it announces: it undoes exactly that action, and the next
  // undoable action, undo or redo dismisses it
  function undoToast(msg, also) {
    const at = hi;
    const t = toast(msg, $t('Undo'), () => { if (hi === at) $('undoBtn').click(); }, true);
    // (v16.5 UX01: a second action before Undo, "Added f₃ Sine · Show alone · Undo")
    if (t && also) { const u = t.querySelector('.toast-act'); u.before(h('button', { class: 'toast-act', onclick: () => { t.remove(); also[1](); } }, also[0])); }
    return t;
  }
  function dismissUndoToast() {
    const host = $('toastHost');
    if (host) for (const t of host.querySelectorAll('.toast[data-undo]')) t.remove();
  }
  // (v16.5 UX80, restores "nothing covers uninvited": a message never lands on a control) A desktop's messages sit
  // above the chain, centred between X's and Y's button columns (and above the deformation's transport), as wide as
  // the room between them, wrapping to a second line; a phone's sit above the chain bar, right of the inset and left of
  // the plane's key column, or above the inset where that room is too narrow. Placed whenever one shows (an observer
  // on the host) and when the layout changes.
  function placeToasts() {
    const host = $('toastHost');
    if (!host) return;
    const st = host.style;
    const clear = () => { if (host.hasAttribute('data-placed')) { host.removeAttribute('data-placed'); st.removeProperty('left'); st.removeProperty('bottom'); st.removeProperty('max-width'); } };
    // (D1, issue #23) Clear chain gives the chain head's room to a message placed there, and is back when it goes (the
    // message has its own Undo)
    const cc = $('clearChain'), away = (on) => { if (cc) cc.classList.toggle('toast-away', on); };
    away(false);
    // (a phone's messages have their own row over the tool row, where the context bar sits: CSS places them, and they cover nothing)
    if (document.documentElement.classList.contains('ph')) { clear(); return; }
    if (!host.firstElementChild) return;
    const box = (e) => (e && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' ? e.getBoundingClientRect() : null);
    const chain = box(document.querySelector('.pipe-wrap'));
    if (!chain || !(chain.width > 0)) { clear(); return; }
    const H = window.innerHeight, W = window.innerWidth;
    let lo = 8, hi = W - 8, top = chain.top;
    const dock = [...document.querySelectorAll('.tdock:not([hidden])')].map(box).filter(Boolean);
    for (const d of dock) top = Math.min(top, d.top);
    const inset = box(document.querySelector('.panes > .pane.ph-inset'));
    if (inset) {
      // a phone with the inset: right of it, left of the large plane's keys at the bottom
      const big = document.querySelector('.panes > .pane:not(.ph-inset):not([hidden])');
      const keys = big ? [...big.querySelectorAll('.viewstack, .ph-col')].map(box).filter((r) => r && r.width > 0 && r.bottom > inset.top) : [];
      lo = inset.right + 8;
      for (const r of keys) hi = Math.min(hi, r.left - 8);
      if (hi - lo < 200) {
        lo = 8; hi = W - 8; top = inset.top;
        for (const r of keys) if (r.bottom > top - 80) hi = Math.min(hi, r.left - 8);
      }
    } else {
      // ([v16.5 fix regress-3, the user's rule "nothing covers the work area uninvited"] a desktop's message goes in the
      // chain head's free middle, between its title and Pictures | Names, when it fits there whole on one line: it then
      // covers neither a plane nor a control. Only a message too long for it goes above the chain, as UX80 placed it)
      const hd = document.querySelector('.pipe-head'), grow = hd && hd.querySelector(':scope > .grow'), hb = box(hd);
      if (hb && grow && hb.height > 0 && hb.height < 60 && host.children.length === 1) {
        away(true);
        const kids = [...hd.children].filter((e) => e.getClientRects().length && getComputedStyle(e).display !== 'none'), gi = kids.indexOf(grow);
        const a = gi > 0 ? Math.max(...kids.slice(0, gi).map((e) => e.getBoundingClientRect().right)) : hb.left;
        const b = gi >= 0 && gi < kids.length - 1 ? Math.min(...kids.slice(gi + 1).map((e) => e.getBoundingClientRect().left)) : hb.right;
        host.setAttribute('data-placed', 'head'); st.maxWidth = 'none';
        const tw = host.firstElementChild.getBoundingClientRect(), room = b - a - 24;
        if (room >= 160 && tw.width <= room && tw.height <= hb.height) {
          st.left = Math.round((a + b) / 2) + 'px';
          st.bottom = Math.round(H - hb.bottom + (hb.height - tw.height) / 2) + 'px';
          st.maxWidth = Math.round(room) + 'px';
          return;
        }
        away(false);
        host.setAttribute('data-placed', '');
      }
      // the planes side by side: between X's and Y's button columns; one plane: left of its own
      const stacks = ['paneL', 'paneR'].map((id) => { const p = $(id); return p && p.getClientRects().length ? box(p.querySelector('.viewstack')) : null; });
      const plots = ['plotL', 'plotR'].map((id) => box($(id)));
      if (stacks[0] && stacks[1] && stacks[1].left > stacks[0].right) { lo = stacks[0].right + 8; hi = stacks[1].left - 8; }
      else { const k = stacks[1] ? 1 : 0, st2 = stacks[k], pl = plots[k]; if (st2 && pl && pl.width > 0) { lo = pl.left + 8; hi = st2.left - 8; } }
    }
    if (!(hi - lo >= 160)) { clear(); return; }
    host.setAttribute('data-placed', '');
    st.left = Math.round((lo + hi) / 2) + 'px';
    st.bottom = Math.round(H - top + 8) + 'px';
    st.maxWidth = Math.round(hi - lo) + 'px';
  }
  // (o.sticky: it stays until its action or its close button is used, or another toast replaces it: review v16 user-5;
  // o.ms: how long an ordinary one stays)
  function toast(msg, actionLabel, action, isUndo, o) {
    const host = $('toastHost');
    if (!host) return;
    host.innerHTML = '';
    const t = h('div', { class: 'toast', role: 'status', 'data-undo': isUndo ? '' : null }, h('span', null, msg));
    if (actionLabel) t.append(h('button', { class: 'toast-act', onclick: () => { t.remove(); action(); } }, actionLabel));
    if (o && o.sticky) { t.append(h('button', { class: 'icon-btn toast-x', 'aria-label': $t('Close'), html: ICONS.close, onclick: () => t.remove() })); host.append(t); return t; }
    host.append(t);
    let left = (o && o.ms) || 5000, t0 = performance.now(), timer = setTimeout(() => t.remove(), left);
    t.addEventListener('pointerenter', () => { clearTimeout(timer); left -= performance.now() - t0; });
    t.addEventListener('pointerleave', () => { t0 = performance.now(); timer = setTimeout(() => t.remove(), Math.max(800, left)); });
    return t;
  }
  // what the examples and the guide (src/examples.js) need from the app: its functions and constants, and the state
  // they reassign as getters (and setters for the state they write)
  function examplesApi() {
    return {
      EX, TeX, applyLayout, armOutside, blankState, buildPipeline, buildShapeList, cauchyCache, closePalette,
      commit, defMem, drawScene, dropAllGPU, dropShapeGPU, exLabelSync, exThumbs, exWait, fitPane, focusBack,
      focusKey, morph, nSteps, newShape, onPaneResize, openIntegralPop, openTransport, phHold, placePop, rebuild,
      setFocus, setSel, setState, snd, sndIsSong, sndPieceHint, sndPlayPiece, sndPtsKey, sndStopPlay, stageMap, touchUI,
      undoToast, viewBox, viewMem, pushShape, pushStep, pushTarget, setShapes, setSteps, setTargets, setParams,
      setOpt, deleteOpt,
      tourOn: (ev, f) => tourApi.on(ev, f),
      get S() { return S; },
      get TH() { return TH; },
      get clipWin() { return clipWin; }, set clipWin(v) { clipWin = v; },
      get currentExample() { return currentExample; }, set currentExample(v) { currentExample = v; },
      get exAt() { return exAt; }, set exAt(v) { exAt = v; },
      get exFitKey() { return exFitKey; }, set exFitKey(v) { exFitKey = v; },
      get hi() { return hi; },
      get hoverShape() { return hoverShape; }, set hoverShape(v) { hoverShape = v; },
      get paneL() { return paneL; },
      get paneR() { return paneR; },
      get popEl() { return popEl; }, set popEl(v) { popEl = v; },
      get selected() { return selected; }, set selected(v) { selected = v; },
      get sideDraw() { return sideDraw; }, set sideDraw(v) { sideDraw = v; },
    };
  }
  // the app calls the module by the old names (as untyped calls: their types stay the module's own)
  const EXM = /** @type {any} */ (Examples);
  function exFitTo(...args) { return EXM.exFitTo(...args); }
  function exOk(...args) { return EXM.exOk(...args); }
  function firstExample(...args) { return EXM.firstExample(...args); }
  function loadExample(...args) { return EXM.loadExample(...args); }
  function retryExampleThumbs(...args) { return EXM.retryExampleThumbs(...args); }
  function openGallery(...args) { return EXM.openGallery(...args); }
  function openGuide(...args) { return EXM.openGuide(...args); }

