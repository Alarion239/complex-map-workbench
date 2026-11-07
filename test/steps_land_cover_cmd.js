// The carried Landscape reaches the block the parked plane fills. A glide's carried surface is plane s's grid moved by the
// glide's map; a point of plane s where the map is singular without being a pole (the logarithm at 0, the branch of a
// root at a pole of its Möbius) takes the surface far out in the block, which no cell of the grid reaches, so each such
// point gets a patch of its own like a pole (svLandPatches). The glide held at u = 0.002 and 0.998 on three chains,
// Landscape of Im F, Everywhere, sheets off, one pane and camera, against the plane at rest there (surface pixels:
// saturation over 30):
// - the Logarithm of an annulus, and a Möbius step then √: the carried frame's surface has at least 95 % of the pixels
//   the plane at rest has, its topmost row within 3 px of the plane's;
// - z³, which has no such point: the same bounds (the control).
// A command file for a CDP daemon (test/cdp_kit README); prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1440, 900, false, false);
const rAF2 = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))';
const surface = () => ev(`(() => { const cv = document.getElementById('canvasL'); const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0, top = -1; for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) { const i = (y * cv.width + x) * 4; if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > 30) { n++; if (top < 0) top = y; } } return { n, top }; })()`);
const CHAINS = {
  'log of an annulus': { steps: [{ type: 'log', params: { cut: 180, k: 0 }, on: true }], shapes: [{ id: 'a1', kind: 'annulus', c: [0, 0], r: 1, r2: 3, visible: true }] },
  'Möbius, √': { steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, { type: 'root', params: { n: 2 }, on: true }], shapes: [] },
  'z^3': { steps: [{ type: 'pown', params: { n: 3 }, on: true }], shapes: [] },
};
for (const [name, c] of Object.entries(CHAINS)) {
  const ns = 'landcover' + Date.now();
  await loadView('steps', ns, { shapes: c.shapes, steps: c.steps, sheets: false, height: 'im' });
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
  await ev(`__cmwSteps({ scope: 'all', surf: 'land', go: 0, now: true, clock: 0 }); 1`);
  await settled({ max: 60000 });
  const last = (await ev('__cmwSteps().planes')).length - 1;
  info[name] = {};
  for (const [tag, k, x] of [['u=.002', 0, 0.002], ['u=.998', last, last - 0.002]]) {
    await ev(`__cmwSteps({ go: ${k}, now: true }); 1`); await settled({ max: 60000 }); await ev(rAF2);
    const rest = await surface();
    await ev(`__cmwSteps({ x: ${x} }); 1`); await settled({ max: 60000 }); await ev(rAF2);
    const carry = await ev('__cmwLandCarry()');
    const got = await surface();
    const r = { rest, got, coverage: +(got.n / rest.n).toFixed(3), carried: !!carry };
    info[name][tag] = r;
    ok(`${name}, ${tag}: a carried frame`, r.carried, r);
    ok(`${name}, ${tag}: the carried surface has >= 95 % of the plane's pixels`, r.coverage >= 0.95, r);
    ok(`${name}, ${tag}: the topmost row within 3 px of the plane's`, Math.abs(got.top - rest.top) <= 3, r);
  }
}
return { pass: !fails.length, fails, info };
