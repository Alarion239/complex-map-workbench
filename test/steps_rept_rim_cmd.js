// A repeated monomial step on a disc, parked Inside, drawn by its REPT plan's closed form: the pixels the closed form leaves to
// the search, where the search does not settle them either, lie on the image's rim (Inverse.REPT_RIM: within a few pixels
// of a boundary circle of the disc's image, or of the critical value 0). There they are a hairline along the image's edge,
// drawn in the grey no-value hatch, and the pane says nothing of them.
// - z³ ×20 on the disc tangent to |z| = 1 from inside, at 1440 × 900: its image is the unit disc, exact, with a ring of the
//   hatch about a pixel wide at |w| = 1. The ring is drawn (some of the plane's pixels are the hatch's grey, at most
//   RIM_PERIMETERS of the plane canvas's perimeters' worth: a line, not an area); the pane has no note, the LED is not
//   red, and the sentence of the hatch is neither its tip nor the pane's description. Its Landscape's region mask marks
//   the ring no-value (__cmwRept({ land: true })'s marked) and counts no unresolved pixel off the rim, and the pane says
//   nothing there either.
// - control: Newton's step for z³ − 1 twenty times on the gallery's square [−2, 2]² (no closed form), its search starved
//   to STARVED_NODES root solves once parked (__cmwRept({ nodes })): the hatch is an area (at least AREA_MIN_SHARE of the
//   plane), and the pane has the note, the red LED with the sentence as its tip, and the sentence as its description.
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, info}.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const VIEW_W = 1440, VIEW_H = 900, VIEW_SCALE = 140, SETTLE_LONG = 60000, NEXT_ID = 50;
const COPIES = 20;
const HATCH_SPREAD = 3, HATCH_LO = 100, HATCH_HI = 130;   // #1444's measure of the hatch's grey
// a hairline's hatch covers at most RIM_PERIMETERS of the plane canvas's perimeters in pixels; the control's area at least
// AREA_MIN_SHARE of the plane's pixels
const RIM_PERIMETERS = 2, AREA_MIN_SHARE = 0.2;
const STARVED_NODES = 5;   // root solves per pixel of the control's starved search
const HATCHED = 'Where the plane is hatched, the exact image could not be found.';
const TANGENT = { c: [0, 0.95], r: 0.05 }, SQUARE = { kind: 'rect', a: [-2, -2], b: [2, 2] };
const ready = () => settled({ max: SETTLE_LONG, until: 'typeof __cmwExample === "function" && typeof __cmwSteps === "function" && !!window.GLR' });
const { PARKED_DRAWN, parkInside } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'parked_kit.js'), 'utf8'))({ ev, settled, exampleNames });
await view(VIEW_W, VIEW_H, false, false);
const HATCH_SAID = "(document.getElementById('overlayLSay') || { textContent: '' }).textContent === " + JSON.stringify(HATCHED);   // the pane has said it (a frame after the hatch's draw)
const open = async (name, step, shape) => {
  const ns = 'rim' + Date.now();
  const steps = [Object.assign({ on: true, repeat: { n: COPIES, len: 1 } }, step)];
  const st = { v3: true, v4: true, v5: true, v6: true, exactImages: true, nextId: NEXT_ID, focus: 0, srcView: { cx: 0, cy: 0, s: VIEW_SCALE },
    shapes: [Object.assign({ id: 'd1', kind: 'disc', ci: 0, visible: true }, shape)], steps };
  await go(`http://localhost:${PORT}/gl-helpers.html`); await settled({ panes: false });
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await go(`http://localhost:${PORT}/test.html?view=steps&ns=${ns}&lang=en`);
  await ready();
  await parkInside(SETTLE_LONG, steps.length);
  const r = await settled({ max: SETTLE_LONG, until: PARKED_DRAWN });
  ok(`${name}: the plane is drawn within ${SETTLE_LONG} ms`, r.ok, r.busy);
};
// the plane canvas's share of pixels in the hatch's grey, and the pane's note box, LED tip and class, sentence and description
const look = () => ev(`(() => {
  const cs = [...document.querySelectorAll('#plotL canvas')].sort((p, q) => q.width * q.height - p.width * p.height), c = cs[0], d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let h = 0;
  for (let i = 0; i < d.length; i += 4) if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) <= ${HATCH_SPREAD} && d[i] >= ${HATCH_LO} && d[i] <= ${HATCH_HI}) h++;
  const led = document.getElementById('leftLed');
  const say = document.getElementById('overlayLSay'), cv = document.getElementById('overlayL');
  return { share: h / (d.length / 4), perimeterShare: 2 * (c.width + c.height) / (c.width * c.height), note: __cmwNoteBox('L'), tip: led && led.getAttribute('data-tip'), led: led && led.className, said: say ? say.textContent : null, described: cv ? cv.getAttribute('aria-describedby') : null, paths: __cmwPaths() };
})()`);
const quiet = (a) => !a.note && !/\berr\b/.test(a.led || '') && a.tip !== HATCHED && a.said !== HATCHED;

// the tangent disc: the ring drawn, nothing said
{
  const name = `z^3 ×${COPIES} on the disc tangent to |z| = 1`;
  await open(name, { type: 'custom', params: { expr: 'z^3', cut: 180 } }, TANGENT);
  await settled({ max: SETTLE_LONG, panes: true });
  const a = await look();
  info.tangent = a;
  ok(`${name}: the regions' path is the inverse pass (control)`, a.paths.length === 1 && a.paths[0].path === 'inverse', a.paths);
  ok(`${name}: the ring at |w| = 1 is drawn in the hatch, a hairline (some pixels, at most ${RIM_PERIMETERS} perimeters of the canvas)`, a.share > 0 && a.share <= RIM_PERIMETERS * a.perimeterShare, { share: a.share, perimeterShare: a.perimeterShare });
  ok(`${name}: no note, the LED not red, and the hatch's sentence neither its tip nor the pane's description`, quiet(a), { note: a.note, led: a.led, tip: a.tip, said: a.said });
  await ev("__cmwSteps({ surf: 'land' }); 1"); await settled({ max: SETTLE_LONG, panes: true });
  const lm = await ev('__cmwRept({ land: true })'), ld = await look();
  info['tangent landscape'] = { mask: lm, look: ld };
  ok(`${name}, Landscape: the region mask marks the ring no-value and counts no unresolved pixel off the rim`, !!lm && lm.marked > 0 && lm.unresolved === 0, lm);
  ok(`${name}, Landscape: no note, the LED not red, and the hatch's sentence neither its tip nor the pane's description`, quiet(ld), { note: ld.note, led: ld.led, tip: ld.tip, said: ld.said });
}
// control: an area of the hatch (a starved search, no closed form) keeps the note
{
  const name = `Newton's step ×${COPIES} on the square [−2, 2]², starved to ${STARVED_NODES} root solves (control)`;
  await open(name, { type: 'custom', params: { expr: 'z-(z^3-1)/(3*z^2)', cut: 180 } }, SQUARE);
  await ev(`__cmwRept({ nodes: ${STARVED_NODES} }); 1`);
  const r = await settled({ max: SETTLE_LONG, panes: true, until: HATCH_SAID });
  ok(`${name}: the pane says it within ${SETTLE_LONG} ms`, r.ok, r.busy);
  const a = await look();
  info.starved = a;
  await ev('__cmwRept({ nodes: 0 }); 1');
  ok(`${name}: the hatch is an area (at least ${AREA_MIN_SHARE * 100} % of the plane)`, a.share >= AREA_MIN_SHARE, a.share);
  ok(`${name}: a note on the pane, the LED red with the sentence as its tip, and the sentence as the pane's description`, !!a.note && /\berr\b/.test(a.led || '') && a.tip === HATCHED && a.said === HATCHED && a.described === 'overlayLSay', { note: a.note, led: a.led, tip: a.tip, said: a.said, described: a.described });
}
return { pass: fails.length === 0, fails, info };
