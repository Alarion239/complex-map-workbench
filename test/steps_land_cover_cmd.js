// The carried Landscape reaches the block the carried points can fill. A glide's carried surface is plane s's grid moved
// by the glide's map, plus patches: one about each pole of the map, and about each point where it is singular without
// being a pole (the logarithm at 0, the branch of a root at a pole of its Möbius), which take the surface far out in the
// block that no cell of the grid reaches, and rings over the plane outside the grid. All sheets carry the same patches,
// each sheet at its own height. The glide held at u = 0.002 and 0.998 on three chains, Landscape of Im F, Everywhere, one
// pane and camera (surface pixels: saturation over 30):
// - z³, which has no such point (the control), and every chain at u = 0.002: the carried frame has at least 95 % of the
//   pixels the plane at rest has, its topmost row within 3 px of the plane's;
// - the Logarithm of an annulus and a Möbius step then √ at u = 0.998: the carried points are the image of the plane's
//   principal branch (the log's strip, √'s right half-plane), every sheet over it, so the plane at rest, one surface
//   over the whole window, is not the bound. All sheets then have at least 90 % of the pixels the same chain has with
//   sheets off, and the logarithm's singular point has its patch (carried.patches).
// A command file for a CDP daemon (test/cdp_kit README); prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1440, 900, false, false);
const rAF2 = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))';
const surface = () => ev(`(() => { const cv = document.getElementById('canvasL'); const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0, top = -1; for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) { const i = (y * cv.width + x) * 4; if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > 30) { n++; if (top < 0) top = y; } } return { n, top }; })()`);
const ANN = [{ id: 'a1', kind: 'annulus', c: [0, 0], r: 1, r2: 3, visible: true }];
const LOG = [{ type: 'log', params: { cut: 180, k: 0 }, on: true }];
const MOB = [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, { type: 'root', params: { n: 2 }, on: true }];
// (min: the share of the plane's surface pixels the carried frame must have, at u = .002 and, with rest998, at .998; top:
// also the topmost row within 3 px of the plane's; sheets off, the footprint is the baseline of the same chain's All sheets)
const CASES = [
  { name: 'log of an annulus, sheets off', steps: LOG, shapes: ANN, sheets: false, min: 0.95, patched: true },
  { name: 'log of an annulus, All sheets', steps: LOG, shapes: ANN, sheets: true, min: 0.95, top: true, base: 'log of an annulus, sheets off', patched: true },
  { name: 'Möbius, √, sheets off', steps: MOB, shapes: [], sheets: false, min: 0.95 },
  { name: 'Möbius, √, All sheets', steps: MOB, shapes: [], sheets: true, min: 0.95, top: true, base: 'Möbius, √, sheets off' },
  { name: 'z^3, sheets off', steps: [{ type: 'pown', params: { n: 3 }, on: true }], shapes: [], sheets: false, min: 0.95, top: true, rest998: true },
];
for (const c of CASES) {
  const name = c.name;
  const ns = 'landcover' + Date.now();
  await loadView('steps', ns, { shapes: c.shapes, steps: c.steps, sheets: c.sheets, height: 'im' });
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
    const r = { rest, got, coverage: +(got.n / rest.n).toFixed(3), carried: !!carry, patches: carry && carry.patches };
    info[name][tag] = r;
    ok(`${name}, ${tag}: a carried frame`, r.carried, r);
    if (k === 0 || c.rest998) {
      ok(`${name}, ${tag}: the carried surface has >= ${c.min * 100} % of the plane's pixels`, r.coverage >= c.min, r);
      if (c.top) ok(`${name}, ${tag}: the topmost row within 3 px of the plane's`, Math.abs(got.top - rest.top) <= 3, r);
    } else {
      if (c.patched) ok(`${name}, ${tag}: the logarithm's singular point has its patch`, r.patches >= 1, r);
      if (c.base) { const b = info[c.base][tag]; ok(`${name}, ${tag}: >= 90 % of the pixels of ${c.base} (${b.got.n})`, got.n >= 0.9 * b.got.n, r); }
    }
  }
}
return { pass: !fails.length, fails, info };
