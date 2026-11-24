// A repeated step that no exact plan takes, parked, Inside regions (#2364): the plane says so instead of staying empty.
// A Repeat of twenty copies of Integer power n = 4, or of the sine, is twenty ops, more than a plan holds (Inverse.OPS_MAX), so
// the plane's regions have no inverse path, and drawn forward through every copy they leave nothing to see. The disc of the
// scene (c = 1, r = 0.12) is parked on plane 1, Inside regions:
// - the control: each scene's path is `forward`, its reason `chain too long` (the plan's own: __cmwPaths);
// - the plane is covered by the grey no-value hatch (#1444's measure: the share of the plane's pixels in the hatch's grey), and
//   says why in a note on the pane, in its LED's tip (red) and in the pane's description for a screen reader;
// - controls: the same step repeated twice (a plan takes it: the exact image, no hatch, no note), and the twenty copies with the
//   colour Everywhere (the plane's colour needs no regions: no hatch, no note).
// The same holds for a repeated degree-3 step next to another step (#2405), parked on the plane past both: Integer power n = 3
// and the formula z^3, each followed by ×2, and ×2 followed by Integer power n = 3. Their copies make the plan, as any other
// repeat's next to a step (one REPT op stands for a repeat only as the plane's one step).
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, info}.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const VIEW_W = 1200, VIEW_H = 800, VIEW_SCALE = 140, SETTLE_LONG = 60000, NEXT_ID = 50;
const COPIES = 20, FEW = 2;                // the repeat counts: more ops than a plan holds, and few
const HATCH_SPREAD = 3, HATCH_LO = 100, HATCH_HI = 130;   // #1444's measure of the hatch's grey
const HATCH_MIN_SHARE = 0.8, HATCH_MAX_SHARE = 0.02;      // of the plane's pixels: covered, and not covered
const NOTE = 'This repeated step is too long to draw exactly, so the image of the regions is not known here and the plane is hatched. Fewer copies draw exactly.';
const ready = () => settled({ max: SETTLE_LONG, until: 'typeof __cmwExample === "function" && typeof __cmwSteps === "function" && !!window.GLR' });
const { PARKED_DRAWN, parkInside } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'parked_kit.js'), 'utf8'))({ ev, settled, exampleNames });
await view(VIEW_W, VIEW_H, false, false);
// (each scene: its repeated step, and the steps before and after it; parked on the plane past all of them)
const TIMES2 = { type: 'mul', params: { c: '2' }, on: true };
const SCENES = [{ name: 'Integer power n = 4', step: { type: 'pown', params: { n: 4 } } }, { name: 'sine', step: { type: 'sin', params: {} } },
  { name: 'Integer power n = 3, then ×2', step: { type: 'pown', params: { n: 3 } }, after: [TIMES2] },
  { name: 'the formula z^3, then ×2', step: { type: 'custom', params: { expr: 'z^3', cut: 180 } }, after: [TIMES2] },
  { name: '×2, then Integer power n = 3', step: { type: 'pown', params: { n: 3 } }, before: [TIMES2] }];
const open = async (sc, n, everywhere) => {
  const ns = 'pr' + Date.now();
  const steps = [...(sc.before || []), Object.assign({ on: true, repeat: { n, len: 1 } }, sc.step), ...(sc.after || [])];
  const st = { v3: true, v4: true, v5: true, v6: true, exactImages: true, nextId: NEXT_ID, focus: 0, srcView: { cx: 0, cy: 0, s: VIEW_SCALE },
    shapes: [{ id: 'd1', kind: 'disc', c: [1, 0], r: 0.12, ci: 0, visible: true }], steps };
  await go(`http://localhost:${PORT}/gl-helpers.html`); await settled({ panes: false });
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await go(`http://localhost:${PORT}/test.html?view=steps&ns=${ns}&lang=en`);
  await ready();
  if (everywhere) { await ev("__cmwSteps({ scope: 'all' }); 1"); await settled({ max: SETTLE_LONG, panes: false }); await ev(`__cmwSteps({ go: ${steps.length}, now: true }); 1`); await settled({ max: SETTLE_LONG, until: '!__cmwSteps().anim && !__cmwSteps().play' }); } else await parkInside(SETTLE_LONG, steps.length);
  const r = await settled({ max: SETTLE_LONG, until: PARKED_DRAWN });
  ok(`${sc.name} ×${n}${everywhere ? ', Everywhere' : ''}: the plane is drawn within ${SETTLE_LONG} ms`, r.ok, r.busy);
};
// the plane canvas's pixels in the hatch's grey, and the pane's note box, LED tip and sentence
const look = () => ev(`(() => {
  const cs = [...document.querySelectorAll('#plotL canvas')].sort((p, q) => q.width * q.height - p.width * p.height), c = cs[0], d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let h = 0;
  for (let i = 0; i < d.length; i += 4) if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) <= ${HATCH_SPREAD} && d[i] >= ${HATCH_LO} && d[i] <= ${HATCH_HI}) h++;
  const led = document.getElementById('leftLed');
  const say = document.getElementById('overlayLSay'), cv = document.getElementById('overlayL');
  return { share: h / (d.length / 4), note: __cmwNoteBox('L'), tip: led && led.getAttribute('data-tip'), led: led && led.className, said: say ? say.textContent : null, described: cv ? cv.getAttribute('aria-describedby') : null, paths: __cmwPaths() };
})()`);
for (const sc of SCENES) {
  await open(sc, COPIES, false);
  const a = await look();
  info[sc.name] = a;
  ok(`${sc.name} ×${COPIES}: no plan takes it: the regions' path is forward, "chain too long" (control)`, a.paths.length === 1 && a.paths[0].path === 'forward' && a.paths[0].reason === 'chain too long', a.paths);
  ok(`${sc.name} ×${COPIES}: the parked plane is covered by the grey no-value hatch`, a.share >= HATCH_MIN_SHARE, a.share);
  ok(`${sc.name} ×${COPIES}: a note on the pane, and the LED's tip, say why`, !!a.note && a.tip === NOTE && /\berr\b/.test(a.led || ''), { note: a.note, tip: a.tip, led: a.led });
  ok(`${sc.name} ×${COPIES}: the sentence is the pane's description for a screen reader`, a.said === NOTE && a.described === 'overlayLSay', { said: a.said, described: a.described });
  await open(sc, FEW, false);
  const b = await look();
  info[sc.name + ' few'] = b;
  ok(`${sc.name} ×${FEW}: a plan takes it (the regions' path is not forward): no hatch, no note`, b.paths.length === 1 && b.paths[0].path !== 'forward' && b.share <= HATCH_MAX_SHARE && !b.note && b.tip !== NOTE && b.said !== NOTE, { share: b.share, note: b.note, tip: b.tip, said: b.said, paths: b.paths });
  await open(sc, COPIES, true);
  const c = await look();
  info[sc.name + ' everywhere'] = c;
  ok(`${sc.name} ×${COPIES}, Everywhere: the colour needs no regions: no hatch, no note (control)`, c.share <= HATCH_MAX_SHARE && !c.note && c.tip !== NOTE, { share: c.share, note: c.note, tip: c.tip });
}
return { pass: fails.length === 0, fails, info };
