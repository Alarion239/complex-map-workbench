// A figure survives a link: the state the page writes for a link (__cmwFigureState) is made into a deflate-raw link and reopened,
// and every key the figure set comes back as it was set, except the keys the page normalises on opening, each named in NORMALISED
// with its reason and the value it must take. The reopened figure is made into a link and reopened once more: that state is the
// same as the first reopened one, compared both ways (a link's figure is a fixed point).
// Covered, one case each: the steps' fields; every kind of shape and the targets' fields; the shared numbers; constructions with
// references to a zeros-and-poles step; the view, the steps view's place (sv) and an older figure's view of Y and right pane's
// camera, which the page drops; the display options.
// Controls: every named normalisation is used by a case; the comparison reports a changed expression and a key the page does not
// carry; a normalised key is a real difference of the figure as set; the two-way comparison reports a key, or an array entry,
// that only the second state has; and a clipWin that differs is no difference, while a display option that differs is.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in misc-3 (ci/browser_shards.js).
// Prints {pass, fails, info}.
const { openLinked } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'link_kit.js'), 'utf8'));
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
// the format flags of a current figure: without them the page reads the figure as an older build's and resets the settings the
// older builds did not have
const CURRENT = { v3: true, v4: true, v5: true, v6: true };
// The figure's camera (figCam) is written at the link from the live camera and read at the load, so it is compared like any key, to
// CAM_DIGITS places (the camera is kept as distance over the fit's, a float). The Deformation's time (figMorph) is the steps view's
// place x at the load and not a key of the state; steps_link_migrate_cmd covers its reading, so it is left out here. The window of
// the left pane (clipWin) is no key a figure sets: the page derives it from the view at the left pane's size when it reads the
// figure (20-init.js) and derives it again once the pane is laid out (14-interaction.js), so a read before or after that layout
// differs; it is left out too.
const CAM_DIGITS = 9;
const strip = (o) => {
  const c = JSON.parse(JSON.stringify(o));
  delete c.figMorph;
  delete c.clipWin;
  if (c.figCam) for (const k of Object.keys(c.figCam)) if (typeof c.figCam[k] === 'number') c.figCam[k] = +c.figCam[k].toFixed(CAM_DIGITS);
  return c;
};
// the differences of `got` from `want`, over the keys `want` has ('path: wanted -> got'); both: over the keys either has
const diff = (want, got, p = '', both = false) => {
  if (want && got && typeof want === 'object' && typeof got === 'object') {
    const keys = both ? [...new Set([...Object.keys(want), ...Object.keys(got)])] : Object.keys(want);
    return keys.flatMap((k) => diff(want[k], got[k], p + '.' + k, both));
  }
  return JSON.stringify(want) === JSON.stringify(got) ? [] : [`${p}: ${JSON.stringify(want)} -> ${JSON.stringify(got)}`];
};
// The values the page changes on opening. Each is a path of the first figure and the value it takes, with the reason.
const NORMALISED = {
  'focus': [0, 'the steps view parks the classic focus on the whole chain (svViewFix)'],
  'view.main': ['phase', 'the view names the picture of the plane shown (svViewFix)'],
  'sv.T': [-1, 'the colour plane that is the last plane is written as -1'],
  'rightView': [undefined, 'no view draws Y: the page drops the right pane\'s camera'],
  'view.R': [undefined, 'no view draws Y: the page drops Y\'s view'],
  'params.1.value': [3, 'a number given by a formula takes the formula\'s value (a + 1, a = 2)'],
  'params.1.im': [1, 'the imaginary part of a number given by a formula is the formula\'s (a = 2 + i)'],
  'steps.0.uid': ['f1', 'a step that constructions refer to is given the next free uid; the references follow it'],
  'shapes.5.def.args.1.zp': ['f1', 'the reference follows the step\'s new uid'],
};
// `want` with the normalised values of the paths in `used` put in
const expected = (want, used) => {
  const out = JSON.parse(JSON.stringify(want));
  for (const path of used) {
    const keys = path.split('.');
    let o = out;
    for (let i = 0; i < keys.length - 1; i++) { if (o[keys[i]] === undefined) o[keys[i]] = {}; o = o[keys[i]]; }
    o[keys[keys.length - 1]] = NORMALISED[path][0];
  }
  return out;
};
const A = [0, 0], B = [1, 1];
const KINDS = [
  { kind: 'point', p: [0.3, 0.2] }, { kind: 'segment', a: A, b: B }, { kind: 'line', a: A, b: B }, { kind: 'ray', a: A, b: B },
  { kind: 'halfplane', a: A, b: B }, { kind: 'rect', a: A, b: B }, { kind: 'cgrid', a: A, b: B, n: 5 }, { kind: 'circle', c: A, r: 1 },
  { kind: 'disc', c: A, r: 1 }, { kind: 'pgrid', c: A, r: 1, nc: 4, nr: 9 }, { kind: 'annulus', c: A, r1: 0.5, r2: 1 },
  { kind: 'sector', c: A, r: 1, t1: 10, t2: 80 }, { kind: 'arc', a: A, m: [0.5, 0.9], b: B }, { kind: 'curve', pts: [[0, 0], [1, 0], [1, 1]] },
  { kind: 'polygon', pts: [[0, 0], [1, 0], [1, 1]] }, { kind: 'fcurve', expr: 'x^2' }, { kind: 'formula', expr: 'x>y' },
  { kind: 'dhray', theta: 0.25, c: null }, { kind: 'dheq', r: 2, c: null },
];
const FIRST_TARGET_ID = 30;
// the point of the glider g1 at t = 0.3 on the circle c1: the page derives a glider's place from its construction
const GLIDER_AT = [1.2055935056527556, 0.4537635989651591];
const point = (id, p) => ({ id, kind: 'point', p, ci: 1, visible: true });
// [case name, the figure, the NORMALISED paths it uses]
const CASES = [
  ['steps: type, params, on, repeat', { ...CURRENT, shapes: [], targets: [], nextId: 5, steps: [
    { type: 'pown', params: { n: 2 }, on: true, repeat: { n: 2, len: 1 } }, { type: 'exp', params: {}, on: false }, { type: 'pown', params: { n: 3 }, on: true }] }, []],
  ['display options and the selection', { ...CURRENT, steps: [{ type: 'pown', params: { n: 2 } }], shapes: [], targets: [], nextId: 5,
    view: { main: 'phase', L: { surf: 'plane', eq: false }, P: { surf: 'plane', eq: false }, D: { phase: true } },
    focus: 1, sel: 1, alpha: 0.6, meshN: 120, lines: true, unit: true, snap: true, outline: true, compact: true, chev: true, unitLevel: true, dcGrid: 5,
    patternScale: 2, figCam: { yaw: 0.4, pitch: -0.3, d: 1.5, tx: 0.1, ty: -0.2 }, sheets: true, sheetW: 3, height: 'abs', homAll: true, morphPaths: false, cauchyShow: 'in', cauchyPlus: true,
    landPlain: true, wKey: true, lscale: 1.5, sectors: 16, fov: false, srcView: { cx: 1, cy: 2, s: 77 }, morphSecs: 3.2 }, ['focus']],
  ['every kind of shape, and the targets', { ...CURRENT, steps: [{ type: 'pown', params: { n: 2 } }], nextId: 60,
    shapes: KINDS.map((k, i) => ({ ...k, id: 's' + (i + 1), ci: i % 8, visible: i % 3 !== 0, label: 'L' + i, ...(i % 2 ? { complement: true } : {}), ...(i === 1 ? { color: '#aa3300', stage: 1 } : {}) })),
    targets: [{ ...point('s' + FIRST_TARGET_ID, [1, 2]), label: 'T' }, { id: 's' + (FIRST_TARGET_ID + 1), kind: 'circle', c: A, r: 2, ci: 1, visible: false }] }, []],
  ['shared numbers', { ...CURRENT, steps: [{ type: 'pown', params: { n: 2 } }], shapes: [], targets: [], nextId: 5,
    params: [{ name: 'a', value: 2, min: 0, max: 5, step: 0.5, im: 1, play: 'bounce' }, { name: 'b', value: 1, min: -1, max: 3, step: 0.01, expr: 'a+1', play: 'loop' }] },
  ['params.1.value', 'params.1.im']],
  ['constructions with references to a zeros-and-poles step', { ...CURRENT, nextId: 20, targets: [],
    steps: [{ type: 'zp', params: { zeros: '1, -1', poles: '' }, uid: 'zpA', zpIds: { zeros: ['za', 'zb'], poles: [] } }, { type: 'pown', params: { n: 2 } }],
    shapes: [point('p1', [0, 0]), point('p2', [1, 0]), point('p3', [0, 1]),
      { id: 'c1', kind: 'circle', c: [0.5, 0.5], r: Math.SQRT1_2, ci: 3, visible: true, def: { op: 'circle3', args: [{ s: 'p1' }, { s: 'p2' }, { s: 'p3' }], fill: 'none', flip: false } },
      { id: 'g1', kind: 'point', p: GLIDER_AT, t: 0.3, ci: 4, visible: true, def: { op: 'glider', args: [{ s: 'c1', part: 0 }] } },
      { id: 'm1', kind: 'point', p: [0.5, 0], ci: 4, visible: true, def: { op: 'midpoint', args: [{ s: 'p1' }, { zp: 'zpA', kind: 'zeros', id: 'za' }] } }] },
  ['steps.0.uid', 'shapes.5.def.args.1.zp']],
  ['the view, the steps view\'s place and the globe', { ...CURRENT, steps: [{ type: 'pown', params: { n: 2 } }], shapes: [], targets: [], nextId: 5,
    view: { main: 'xy', L: { surf: 'sphere', eq: true }, R: { surf: 'sphere', eq: true }, P: { surf: 'sphere', eq: true }, D: { phase: false } },
    sv: { at: 1, T: 1, scope: 'in', surf: 'sphere', speed: 'slow' }, rightView: { cx: 1, cy: 2, s: 33 } }, ['view.main', 'view.R', 'sv.T', 'rightView']],
  ['the right pane\'s camera on a plane', { ...CURRENT, steps: [{ type: 'pown', params: { n: 2 } }], shapes: [], targets: [], nextId: 5, rightView: { cx: 1, cy: 2, s: 33 } }, ['rightView']],
];
for (const [name, figure, used] of CASES) {
  try {
    const first = strip(await openLinked(figure));
    const want = strip(expected(figure, used));
    const lost = diff(want, first);
    ok(`${name}: every key the figure set comes back (a normalised one at its named value)`, lost.length === 0, lost);
    const second = strip(await openLinked(first));
    const moved = diff(first, second, '', true);
    ok(`${name}: a second round trip changes nothing`, moved.length === 0, moved);
    info[name] = { lost: lost.length, moved: moved.length };
  } catch (e) { ok(`${name}: the case runs to its end`, false, String(e && e.message || e).slice(0, 300)); }
}
// controls: every named normalisation is used by a case; the comparison tells a changed key and a missing key from the same figure
ok('control: every normalisation is used by a case', Object.keys(NORMALISED).every((k) => CASES.some((c) => c[2].includes(k))), Object.keys(NORMALISED).filter((k) => !CASES.some((c) => c[2].includes(k))));
{
  const figure = CASES[3][1];
  const raw = await openLinked(figure), first = strip(raw);
  const want = strip(expected(figure, CASES[3][2]));
  const changed = JSON.parse(JSON.stringify(want));
  changed.params[1].expr = 'a+2';
  ok('control: the comparison reports a changed expression', diff(changed, first).length === 1, diff(changed, first));
  const missing = JSON.parse(JSON.stringify(want));
  missing.params[0].noSuchKey = 1;
  ok('control: the comparison reports a key the page does not carry', diff(missing, first).length === 1, diff(missing, first));
  // the normalised values are real changes: without them in `want`, the figure of this case differs
  ok('control: a normalised key is a difference of the figure as set', diff(figure, first).some((l) => l.startsWith('.params.1.value')), diff(figure, first));
  // the fixed point's comparison is two-way: a key, or an array entry, that only the second state has is a difference
  const more = JSON.parse(JSON.stringify(first));
  more.params.push(JSON.parse(JSON.stringify(more.params[0])));
  more.noSuchKey = 1;
  const extra = diff(first, more, '', true);
  ok('control: the two-way comparison reports what only the second state has', extra.length === 2 && diff(first, more).length === 0, extra);
  // the window is left out of both sides of the fixed point: a clipWin that differs between the round trips is no difference,
  // and a display option that differs beside it still is
  const win = raw.clipWin, shifted = JSON.parse(JSON.stringify(raw));
  if (win) shifted.clipWin = { x0: win.x0 + 0.5, x1: win.x1 + 0.5, y0: win.y0 - 0.25, y1: win.y1 + 0.25 };
  const option = JSON.parse(JSON.stringify(shifted));
  option.alpha = raw.alpha === 0.5 ? 0.6 : 0.5;
  const winMoved = diff(strip(raw), strip(shifted), '', true), optionMoved = diff(strip(raw), strip(option), '', true);
  ok('control: a clipWin that differs between the round trips is no difference, a display option that differs is', !!win && winMoved.length === 0 && optionMoved.length === 1 && optionMoved[0].startsWith('.alpha'), { win, winMoved, optionMoved });
}
const errs = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''));
ok('no page errors', !errs.length, errs.slice(0, 3).map((x) => String(x.m).slice(0, 200)));
return { pass: fails.length === 0, fails, info };
