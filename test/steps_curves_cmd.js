// A shape's curve in the steps view is drawn in the shape's own colour, whatever the phase colouring under it (behind ?view=steps):
// - at rest on the source plane and on the planes after it, and parked between two planes (the view on the move draws its
//   curves another way than the view at rest), in Everywhere and in Inside regions;
// - the plane's picture holds many pixels of the shapes' own ink (a curve that took the colours around it would hold none).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const ns = 'svcv' + Date.now();
// a line and a circle, both in the first palette colour (a blue the phase wheel has no pixel of); a Möbius step and a cube
const st = { v3: true, v4: true, v5: true, v6: true,
  shapes: [{ id: 'l1', kind: 'line', a: [-2, 0.5], b: [2, 1], ci: 0, visible: true }, { id: 's2', kind: 'circle', c: [0.3, 0.2], r: 0.8, ci: 0, visible: true }],
  steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, { type: 'pown', params: { n: 3 }, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } };
const open = async () => {
  await view(1280, 800, false, false);
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await settled({ panes: false });
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps` });
  await settled({ max: 30000, until: `typeof __cmwSteps === 'function' && typeof __cmwInk === 'function'` });
};
const ctl = (o) => ev(`__cmwSteps(${JSON.stringify(o)})`);
const quiet = () => settled({ max: 20000, until: `(() => { const s = __cmwSteps(); return !s.anim && !s.play; })()` });
// how many pixels of the plane's canvas (its rulers' margin left out) are within `tol` (a distance in RGB) of a shape's ink
const ink = (id, tol = 22) => ev(`(() => {
  const cs = [...document.querySelectorAll('#plotL canvas')].sort((p, q) => q.width * q.height - p.width * p.height), c = cs[0], x = c && c.getContext('2d');
  if (!x) return { __exc: 'no 2d canvas in #plotL' };
  const hex = __cmwInk(${JSON.stringify(id)}), v = parseInt(hex.slice(1), 16), R = v >> 16 & 255, G = v >> 8 & 255, B = v & 255;
  const m = Math.round(Math.min(c.width, c.height) * 0.14), w = c.width - 2 * m, h = c.height - 2 * m, d = x.getImageData(m, m, w, h).data;
  let n = 0; const near = (i) => Math.hypot(d[i] - R, d[i + 1] - G, d[i + 2] - B) <= ${tol};
  for (let i = 0; i < d.length; i += 4) if (near(i)) n++;
  return { hex, n };
})()`);
const states = [['z', { go: 0, now: true }], ['w1', { go: 1, now: true }], ['w2', { go: 2, now: true }], ['parked 0.5', { go: 0, now: true, park: 0.5 }], ['parked 1.5', { go: 1, now: true, park: 1.5 }]];
// (a curve is drawn in its colour along its length: well over a hundred pixels of it in a plane that shows it)
const MIN = 150;
for (const scope of ['all', 'in']) {
  await open();
  for (const [name, o] of states) {
    await ctl(Object.assign({ scope }, o)); await quiet();
    const a = await ink('l1');
    info[`${scope} ${name}`] = { ink: a.n, hex: a.hex };
    ok(`${scope}, ${name}: the canvas can be read`, !a.__exc, a);
    // the plane shows the curves, and they are in their own colour all along
    ok(`${scope}, ${name}: the curves of the plane are in their shape's own colour (${a.n} pixels)`, a.n >= MIN, a);
  }
}
return { pass: fails.length === 0, fails, info };
