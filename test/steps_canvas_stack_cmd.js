// One stack of canvas controls on every plane (laptop). A plane's .viewstack holds Zoom in, Zoom out, Fit view, then the
// plane's surface button, Sphere, in that order; both views show one plane, so there is nothing to expand. The stack is
// the same on the Plane, the Sphere and the Landscape, and its buttons keep their places (x and y within a half pixel)
// when the surface changes. A button the surface cannot use stays where it is and is aria-disabled with its reason in the
// tooltip and in an aria-describedby note: Sphere on the Landscape. Sphere keeps one name and carries the surface in
// aria-pressed: in the steps view one press switches the view's surface; in the classic view (?view=classic), which shows
// X alone, a press switches X's own surface.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const still = (o = {}) => settled(Object.assign({ until: 'window.__cmwSteps && !__cmwSteps().moving' }, o));
const ns = 'svstk' + Date.now();
const MOB = { type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, CUBE = { type: 'pown', params: { n: 3 }, on: true };
const SURFACES = ['plane', 'sphere', 'land'];
const STEPS_LABELS = ['Zoom in', 'Zoom out', 'Fit view', 'Sphere'];
const NO_SPHERE_ON_LAND = 'The Landscape has no sphere: choose Plane or Sphere in the surface menu';
const open = async (tag, steps, mode = 'steps') => {
  const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'h1', kind: 'halfplane', a: [0, 0], b: [1, 0], ci: 0, visible: true }], steps, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } };
  await view(1440, 900, false, false);
  await go(`http://localhost:${PORT}/gl-helpers.html`);
  const k = ns + tag;
  await ev(`localStorage.setItem('complex-map-workbench-v1:${k}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await go(`http://localhost:${PORT}/test.html?ns=${k}&lang=en&view=${mode}`);
  await still({ until: mode === 'steps' ? "window.__cmwSteps && __cmwSteps().on && !__cmwSteps().moving && !!document.querySelector('#svStrip .sv-rail')" : "!!window.__cmwSteps && !__cmwSteps().on && !!document.querySelector('#paneL .viewstack')" });
};
// the shown buttons of a plane's stack: label, state, the reason a disabled one gives, and its box
const stack = (side) => ev(`(() => [...document.querySelectorAll('#pane${side} .viewstack button')].filter((b) => b.getClientRects().length).map((b) => {
  const d = b.getAttribute('aria-describedby'), n = d && document.getElementById(d), r = b.getBoundingClientRect();
  return { label: b.getAttribute('aria-label'), disabled: b.getAttribute('aria-disabled'), pressed: b.getAttribute('aria-pressed'), title: b.title, note: n ? n.textContent : null, box: [r.left, r.top, r.width, r.height].map(Math.round) };
}))()`);
const byLabel = (list, l) => list.find((b) => b.label === l);
const matches = (list, LABELS) => list.length === LABELS.length && list.every((b, i) => (LABELS[i] instanceof RegExp ? LABELS[i].test(b.label) : b.label === LABELS[i]));
const POS_TOLERANCE = 0.5;   // px: the stack's buttons are at the same place after a surface switch
const samePlaces = (a, b) => a.length === b.length && a.every((r, i) => r.every((v, j) => Math.abs(v - b[i][j]) <= POS_TOLERANCE));

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
  boxes[surf] = s.map((b) => b.box);
}
for (const surf of ['sphere', 'land']) ok(`no button moves, x or y, between the plane and the ${surf}`, samePlaces(boxes[surf], boxes.plane), { plane: boxes.plane, [surf]: boxes[surf] });
await ev(`(__cmwSteps({ surf: 'plane' }), 1)`); await still();
const back = (await stack('L')).map((b) => b.box);
ok('and back on the plane every button is where it was', samePlaces(back, boxes.plane), { plane: boxes.plane, back });
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

// the classic view: X alone, the same four (one plane, nothing to expand), and a press switches X's own surface
// (standards-ok: Y's stack, its Sphere and its Fit view with no image go with Y's pane, which the classic view does not draw,
// #994; X's stack and its Sphere are read here. A plane with nothing to fit was Y on the sphere: X always has its picture)
await open('two', [MOB, CUBE], 'classic');
const cx = await stack('L');
ok('classic view, X: the stack is Zoom in, Zoom out, Fit view, Sphere', matches(cx, STEPS_LABELS), cx.map((b) => b.label));
const csp = byLabel(cx, 'Sphere');
ok('classic view, X: Sphere is enabled and released', !!csp && csp.disabled !== 'true' && csp.pressed === 'false', csp);
await ev(`document.querySelector('#paneL .viewstack button[aria-label="Sphere"]').click(), 1`); await still();
ok('classic view: Sphere on X shows pressed after a press', (byLabel(await stack('L'), 'Sphere') || {}).pressed === 'true', byLabel(await stack('L'), 'Sphere'));
return { pass: !fails.length, fails, info };
