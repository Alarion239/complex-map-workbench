// One stack of canvas controls on every plane (laptop). A plane's .viewstack holds Zoom in, Zoom out, Fit view, Expand, then the
// plane's surface button, Sphere, in that order; the steps view shows one plane, so its Expand (which swaps two planes) is not
// shown and its stack is the other four. The stack is the same on the Plane, the Sphere and the Landscape, and its buttons keep
// their places relative to each other when the surface changes. A button the surface cannot use stays where it is and is
// aria-disabled with its reason in the tooltip and in an aria-describedby note: Sphere on the Landscape, Fit on a plane with no
// image. Sphere keeps one name and carries the surface in aria-pressed: in the steps view one press switches the view's surface;
// with two planes shown (?view=classic) a press switches that plane's own surface.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const still = (o = {}) => settled(Object.assign({ until: 'window.__cmwSteps && !__cmwSteps().moving' }, o));
const ns = 'svstk' + Date.now();
const MOB = { type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, CUBE = { type: 'pown', params: { n: 3 }, on: true };
const SURFACES = ['plane', 'sphere', 'land'];
const STEPS_LABELS = ['Zoom in', 'Zoom out', 'Fit view', 'Sphere'];
const TWO_LABELS = ['Zoom in', 'Zoom out', 'Fit view', /^Expand the (left|right) plane$/, 'Sphere'];
const NO_SPHERE_ON_LAND = 'The Landscape has no sphere: choose Plane or Sphere in the surface menu';
const NOTHING_TO_FIT = 'Nothing to fit yet';
const open = async (tag, steps, mode = 'steps') => {
  const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'h1', kind: 'halfplane', a: [0, 0], b: [1, 0], ci: 0, visible: true }], steps, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } };
  await view(1440, 900, false, false);
  await go(`http://localhost:${PORT}/gl-helpers.html`);
  const k = ns + tag;
  await ev(`localStorage.setItem('complex-map-workbench-v1:${k}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await go(`http://localhost:${PORT}/test.html?ns=${k}&lang=en&view=${mode}`);
  await still({ until: mode === 'steps' ? "window.__cmwSteps && __cmwSteps().on && !__cmwSteps().moving && !!document.querySelector('#svStrip .sv-rail')" : "!!window.__cmwSteps && !__cmwSteps().on && !!document.querySelector('#paneR .viewstack')" });
};
// the shown buttons of a plane's stack: label, state, the reason a disabled one gives, and its box
const stack = (side) => ev(`(() => [...document.querySelectorAll('#pane${side} .viewstack button')].filter((b) => b.getClientRects().length).map((b) => {
  const d = b.getAttribute('aria-describedby'), n = d && document.getElementById(d), r = b.getBoundingClientRect();
  return { label: b.getAttribute('aria-label'), disabled: b.getAttribute('aria-disabled'), pressed: b.getAttribute('aria-pressed'), title: b.title, note: n ? n.textContent : null, box: [r.left, r.top, r.width, r.height].map(Math.round) };
}))()`);
const byLabel = (list, l) => list.find((b) => b.label === l);
const matches = (list, LABELS) => list.length === LABELS.length && list.every((b, i) => (LABELS[i] instanceof RegExp ? LABELS[i].test(b.label) : b.label === LABELS[i]));
// (a box relative to the stack's first button: the stack follows the plot's edge, which moves when the rulers go)
const rel = (boxes) => boxes.map((b) => [b[0] - boxes[0][0], b[1] - boxes[0][1], b[2], b[3]]);

// the steps view: one plane
await open('chain', [MOB, CUBE]);
const boxes = {};
for (const surf of SURFACES) {
  await ev(`(__cmwSteps({ surf: '${surf}' }), 1)`); await still();
  const s = await stack('L'), tag = surf;
  ok(`${tag}: the stack is Zoom in, Zoom out, Fit view, Sphere`, matches(s, STEPS_LABELS), s.map((b) => b.label));
  const sp = byLabel(s, 'Sphere');
  if (sp) {
    ok(`${tag}: Sphere is pressed exactly on the sphere`, sp.pressed === String(surf === 'sphere'), sp.pressed);
    if (surf === 'land') ok(`${tag}: on the Landscape Sphere is aria-disabled, with its reason in the tooltip and the note`, sp.disabled === 'true' && sp.title === NO_SPHERE_ON_LAND && sp.note === NO_SPHERE_ON_LAND, sp);
    else ok(`${tag}: Sphere is enabled on the ${surf}`, sp.disabled !== 'true', sp);
  }
  const fit = byLabel(s, 'Fit view');
  ok(`${tag}: Fit view stays enabled`, !!fit && fit.disabled !== 'true', fit);
  boxes[surf] = rel(s.map((b) => b.box));
}
for (const surf of ['sphere', 'land']) ok(`no button moves, relative to the stack, between the plane and the ${surf}`, JSON.stringify(boxes[surf]) === JSON.stringify(boxes.plane), { plane: boxes.plane, [surf]: boxes[surf] });
// one press switches the view's surface and the key shows it
await ev(`(__cmwSteps({ surf: 'plane' }), 1)`); await still();
await ev(`document.querySelector('#paneL .viewstack button[aria-label="Sphere"]').click(), 1`); await still();
const afterOn = await ev(`__cmwSteps().surf`);
ok('one press of Sphere makes the view\'s surface the sphere', afterOn === 'sphere', afterOn);
ok('Sphere shows pressed after it', (byLabel(await stack('L'), 'Sphere') || {}).pressed === 'true');
await ev(`document.querySelector('#paneL .viewstack button[aria-label="Sphere"]').click(), 1`); await still();
const afterOff = await ev(`__cmwSteps().surf`);
ok('a second press takes it back to the plane', afterOff === 'plane', afterOff);
ok('Sphere shows released after it', (byLabel(await stack('L'), 'Sphere') || {}).pressed === 'false');

// two planes shown (the classic view): the five, on each plane
await open('two', [MOB, CUBE], 'classic');
for (const side of ['L', 'R']) {
  const s = await stack(side);
  ok(`two planes, ${side}: the stack is Zoom in, Zoom out, Fit view, Expand, Sphere`, matches(s, TWO_LABELS), s.map((b) => b.label));
  const sp = byLabel(s, 'Sphere');
  ok(`two planes, ${side}: Sphere is enabled and released`, !!sp && sp.disabled !== 'true' && sp.pressed === 'false', sp);
}
// a press on the right plane switches that plane's surface, and it has no image to fit then
await ev(`document.querySelector('#paneR .viewstack button[aria-label="Sphere"]').click(), 1`); await still();
const r = await stack('R'), l = await stack('L');
ok('two planes: Sphere on the right plane shows pressed there', (byLabel(r, 'Sphere') || {}).pressed === 'true', byLabel(r, 'Sphere'));
ok('two planes: and the left plane\'s Sphere is untouched', (byLabel(l, 'Sphere') || {}).pressed === 'false', byLabel(l, 'Sphere'));
const rf = byLabel(r, 'Fit view');
ok('a right plane with no image has Fit view aria-disabled, with its reason in the tooltip and the note, and in its place', !!rf && rf.disabled === 'true' && rf.title === NOTHING_TO_FIT && rf.note === NOTHING_TO_FIT && matches(r, TWO_LABELS), { rf, labels: r.map((b) => b.label) });
return { pass: !fails.length, fails, info };
