// Shapes in the planes of the chain (#253, option B: forward only), in the steps view: on plane w₁ a disc drawn there is a
// shape of stage 1; plane w₂ shows its image, the chain's last plane (w₃) too, the z-plane does not; one Undo
// takes it away; removing the step before it moves it back to that step's input plane; a saved stage loads, one past
// the chain does not.
// A command file for a CDP daemon (test/cdp_kit README): python3 build.py && test/<you>_cdp/q.sh test/stage_shapes_cmd.js
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const errs = [];
const grab = async () => { errs.push(...(await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''))); };
async function openApp(st) {
  const ns = 'stg' + Date.now();
  await view(1440, 900, false, false);
  await loadView('steps', ns, Object.assign({ v3: true, v4: true, v5: true, v6: true, nextId: 50, rightMode: 'image' }, st));
  // (a loaded machine: the page answers once its hooks and the chain are up)
  await settled({ max: 40000, until: `typeof __cmwPre === 'function' && typeof __cmwP === 'function' && !!document.querySelector('#svStrip .sv-step')` });
}
// the plane shown, by its place in the chain (0 is z, 1 is w₁ …)
const atPlane = async (i) => { await ev(`__cmwSteps({ go: ${i}, now: true }), 1`); await settled({ max: 20000, until: `(() => { const s = __cmwSteps(); return s.x === ${i} && !s.anim && !s.moving; })()` }); };
// a hash of the plane's canvas pixels (a screenshot of it)
const picture = async () => {
  const r = await ev(`(() => { const c = document.getElementById('canvasL').getBoundingClientRect(); return { x: c.left, y: c.top, width: c.width, height: c.height }; })()`);
  const s = await send('Page.captureScreenshot', { format: 'png', clip: Object.assign({ scale: 1 }, r) });
  let h = 2166136261;
  for (let i = 0; i < s.data.length; i++) h = Math.imul(h ^ s.data.charCodeAt(i), 16777619) >>> 0;
  return h.toString(16);
};
const shapes = async () => (await ev('__cmwP()')).shapes.map((s) => ({ id: s.id, kind: s.kind, stage: s.stage }));
const planeOf = async () => (await ev('__cmwSteps()')).i;
const steps = [{ type: 'pown', params: { n: 2 }, on: true }, { type: 'add', params: { c: '1' }, on: true }, { type: 'pown', params: { n: 2 }, on: true }];
const base = { shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 0.5, ci: 0, visible: true }], steps };

// ---- draw a disc in w₁ (the plane after f₁), then look at w₂
await openApp(base);
await atPlane(2);
const r0 = await picture();
await atPlane(1);
await ev(`document.querySelector('.tool[data-tool="disc"]').click(); 1`);
await settled({ panes: false, until: `document.querySelector('.tool[data-tool="disc"]').matches('[aria-pressed="true"], .on')` });
ok('a drawing tool keeps the shown plane (w₁ stays)', (await planeOf()) === 1, await planeOf());
const L = await ev(`(() => { const c = document.getElementById('canvasL').getBoundingClientRect(); return [c.left, c.top, c.width, c.height]; })()`);
const x0 = L[0] + L[2] * 0.62, y0 = L[1] + L[3] * 0.42;
await drag(x0, y0, x0 + 45, y0, 12, 16);
await settled({ until: `__cmwP().shapes.length === 2` });
let sh = await shapes();
const drawn = sh.find((s) => s.id !== 's1');
ok('the disc drawn in w₁ is a shape of stage 1', !!drawn && drawn.kind === 'disc' && drawn.stage === 1, sh);
await atPlane(2);
ok('w₂ shows its image', (await picture()) !== r0, null);
await atPlane(1);
info.list = await ev(`[...document.querySelectorAll('#shapeList .shapes-sub')].map((e) => e.textContent)`);
ok('the Shapes list puts it under its plane', info.list.some((t) => /plane w/.test(t) || /w₁/.test(t)), info.list);
// ---- the whole chain: Y (w₃) shows its image, X (the z-plane) its preimage
await ev(`document.getElementById('undoBtn').click()`);
await settled({ until: `__cmwP().shapes.length === 1` });
ok('one Undo takes it away', (await shapes()).length === 1, await shapes());
const planeAfterUndo = await planeOf();
await ev(`document.getElementById('redoBtn').click()`);
await settled({ until: `__cmwP().shapes.some((s) => s.stage === 1)` });
ok('Redo brings it back, in w₁', (await shapes()).some((s) => s.stage === 1), await shapes());
info.planeAfterUndo = planeAfterUndo;
await atPlane(0);
const zWith = await picture();
await atPlane(3);
const yWith = await picture();
await ev(`document.getElementById('undoBtn').click()`);
await settled({ until: `__cmwP().shapes.length === 1` });
await atPlane(0);
const zWithout = await picture();
await atPlane(3);
const yWithout = await picture();
ok('the z-plane shows the preimage of a shape of w₁', zWith !== zWithout, [zWith, zWithout]);
ok('the whole chain\'s last plane (w₃) shows its image', yWith !== yWithout, [yWith, yWithout]);

// ---- where the preimage is: a disc |w₁ − 1| < 0.5 under w₁ = z² is two lobes about z = ±1 in the z-plane, none at 0;
// a line Re w₂ = 2 in w₂ = w₁ + 1 is the hyperbola x² − y² = 1 (through z = ±1)
const same = (a, b) => Array.isArray(a) && Array.isArray(b) && a.every((x, i) => Math.abs(x - b[i]) <= 3);
const px = (a) => Array.isArray(a) && a.length === 3;
const pixel = (re, im) => ev(`(() => { const c = document.getElementById('canvasL'), r = c.getBoundingClientRect(), p = __cmwPlaneMenu().w2s('L', ${re}, ${im}), k = c.width / r.width;
  return [...c.getContext('2d').getImageData(Math.round((p[0] - r.left) * k), Math.round((p[1] - r.top) * k), 1, 1).data].slice(0, 3); })()`);
// (the five pixels are read until each is a pixel of the drawn plane, at most 40 rounds of 300 ms: the plane draws a frame or two after the page opens)
const probe = async () => { for (let i = 0; i < 40; i++) { const q = { p1: await pixel(1, 0), m1: await pixel(-1, 0), o: await pixel(0, 0.35), far: await pixel(0, 1.2), hy: await pixel(Math.SQRT2, 1) }; if (Object.values(q).every(px)) return q; await sleep(300); } return {}; };
// (the plane's scope is Inside regions once a shape exists and Everywhere for none: both pictures are taken in Inside regions, so a pixel outside every
// preimage is the same in the bare picture and in the pulled one, and the lobes are the only difference)
const inside = async () => { await ev(`__cmwSteps({ scope: 'in' }), 1`); await settled({ until: `__cmwSteps().scope === 'in'` }); };
const two = [{ type: 'pown', params: { n: 2 }, on: true }, { type: 'add', params: { c: '1' }, on: true }];
await openApp({ srcView: { cx: 0, cy: 0, s: 120 }, steps: two, shapes: [] });
await inside();
const bare = await probe();
const offBare = await ev(`__cmwRenderOff('L', 320, 240, 1)`);
await openApp({ srcView: { cx: 0, cy: 0, s: 120 }, steps: two, shapes: [{ id: 's2', kind: 'disc', c: [1, 0], r: 0.5, ci: 1, visible: true, stage: 1 }, { id: 's3', kind: 'line', a: [2, -1], b: [2, 1], ci: 2, visible: true, stage: 2 }] });
await inside();
const pulled = await probe();
const offPulled = await ev(`__cmwRenderOff('L', 320, 240, 1)`);
ok('an export of X draws the preimages too (its offscreen render differs from the bare one)', typeof offPulled === 'string' && offPulled.length > 100 && offPulled !== offBare, [String(offBare).length, String(offPulled).length]);
// a link round trip: the figure's link, opened on a page without shapes, brings them back in their planes
await ev(`Params.encodeLink(__cmwP().figure).then((l) => { window.__lk = l; }); 1`);
let link = null;
await settled({ panes: false, until: `!!window.__lk` });
link = await ev('window.__lk || null');
await openApp({ steps: two, shapes: [] });
await ev(`Params.decodeLink(${JSON.stringify(String(link))}).then((st) => { __cmwPOpen(st, 'link'); }); 1`);
// (opening a link replaces the page: a poll with a bound and a condition, which tolerates the reload between its reads)
for (let i = 0; i < 160; i++) {
  let got = false;
  try { got = await ev(`typeof __cmwP === 'function' && __cmwP().shapes.length === 2 && !!document.querySelector('#svStrip .sv-step')`); } catch (e) { got = false; }
  if (got) break;
  await sleep(250);
}
info.linked = (await shapes()).map((x) => [x.id, x.stage]);
ok('a link round trip keeps each shape\'s plane', typeof link === 'string' && JSON.stringify(info.linked) === JSON.stringify([['s2', 1], ['s3', 2]]), [typeof link, info.linked]);
info.pixels = { bare, pulled };
ok('the disc of w₁ is pulled back to z = 1 and z = −1', [bare, pulled].every((q) => px(q.p1) && px(q.m1) && px(q.o) && px(q.far) && px(q.hy)) && !same(pulled.p1, bare.p1) && !same(pulled.m1, bare.m1) && !same(pulled.p1, pulled.far) && !same(pulled.m1, pulled.far), info.pixels);
ok('… and not to z = 0.35i (w₁ = −0.12, outside it)', same(pulled.o, bare.o) && same(pulled.o, pulled.far), info.pixels);
ok('the line of w₂ is pulled back through two steps, onto the hyperbola x² − y² = 1', !same(pulled.hy, bare.hy), info.pixels);

// ---- the z-globe too: the disc of w₁ is pulled back onto the sphere (one pass per later plane), z = 1 in view
const gpix = (re, im) => ev(`(() => { const c = document.getElementById('canvasL'), r = c.getBoundingClientRect(), q = __cmwGlobeXY('L', ${re}, ${im}), k = c.width / r.width;
  return q ? [...c.getContext('2d').getImageData(Math.round(q[0] * k), Math.round(q[1] * k), 1, 1).data].slice(0, 3) : null; })()`);
const globe = async (shapes) => {
  await openApp({ srcView: { cx: 0, cy: 0, s: 120 }, steps: two, shapes });
  await inside();
  await ev(`__cmwSteps({ surf: 'sphere' }), 1`); await settled({ max: 20000, until: `__cmwSteps().surf === 'sphere'` });
  await ev('__cmwCam("L", { pitch: 0.2, yaw: 0 }); 1'); await settled({ max: 20000 });
  return { p1: await gpix(1, 0), o: await gpix(0.5, 0), far: await gpix(0.25, 0) };
};
const gBare = await globe([]), gPulled = await globe([{ id: 's2', kind: 'disc', c: [1, 0], r: 0.5, ci: 1, visible: true, stage: 1 }]);
info.globe = { gBare, gPulled };
// (besides the comparison with the bare globe: the lobe is the disc's warm fill on a neutral globe, more red over blue at z = 1 than at 0.5 or 0.25 by 20 levels)
const warm = (q) => q[0] - q[2];
ok('on the z-globe the disc of w₁ is pulled back to z = 1, not to 0.5', [gBare, gPulled].every((q) => px(q.p1) && px(q.o) && px(q.far)) && !same(gPulled.p1, gBare.p1) && same(gPulled.o, gBare.o) && warm(gPulled.p1) - Math.max(warm(gPulled.o), warm(gPulled.far)) > 20, info.globe);

// ---- the steps change: the shape follows its plane; a saved stage loads
await openApp(Object.assign({}, base, { shapes: base.shapes.concat([{ id: 's2', kind: 'disc', c: [0.3, 0.2], r: 0.1, ci: 1, visible: true, stage: 1 }]) }));
ok('a saved stage loads', (await shapes()).find((s) => s.id === 's2').stage === 1, await shapes());
await ev(`document.querySelector('#svStrip .sv-step[data-k="1"] .sv-more').click()`);
await settled({ panes: false, until: `!!document.querySelector('#popHost .mi')` });
info.menu = await ev(`(() => { const b = [...document.querySelectorAll('#popHost .mi')].find((e) => e.querySelector('.mi-label').textContent === 'Remove'); if (!b) return [...document.querySelectorAll('#popHost .mi .mi-label')].map((e) => e.textContent); b.click(); return true; })()`);
await settled({ until: `!__cmwP().shapes.find((s) => s.id === 's2').stage` });
ok('removing f₁ moves the shape of w₁ to f₁\'s input plane, the z-plane', info.menu === true && !(await shapes()).find((s) => s.id === 's2').stage, [info.menu, await shapes()]);
await ev(`document.getElementById('undoBtn').click()`);
await settled({ until: `__cmwP().shapes.find((s) => s.id === 's2').stage === 1` });
ok('Undo puts it back in w₁', (await shapes()).find((s) => s.id === 's2').stage === 1, await shapes());
await openApp(Object.assign({}, base, { shapes: base.shapes.concat([{ id: 's2', kind: 'disc', c: [0.3, 0.2], r: 0.1, ci: 1, visible: true, stage: 9 }]) }));
ok('a stage past the chain is dropped (the shape is the z-plane\'s)', !(await shapes()).find((s) => s.id === 's2').stage, await shapes());
await grab();
ok('no page errors', errs.length === 0, errs.slice(0, 5));
return { pass: fails.length === 0, fails, info };
