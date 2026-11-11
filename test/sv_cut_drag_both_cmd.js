// A carried branch cut turns either way: in the plane after the cut, dragging its handle in two opposite directions turns
// the cut as the map from the cut's plane to the dragged one says, each way. The logarithm's cut (180°) in w₁ is dragged
// up and down, the square root's right and left.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, of, fails }.
const R = [];
const check = (name, pass, detail) => R.push([name, !!pass, detail]);
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1440, 900, false, false);
const open = async (steps) => {
  const ns = 'cutboth' + Date.now() + Math.floor(Math.random() * 1000);
  await loadView('steps', ns, { srcView: { cx: 0, cy: 0, s: 60 }, shapes: [], steps, height: 'im', snap: false });
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
  await ev(`__cmwSteps({ go: 1, now: true }); 1`); await settled({ max: 60000 });
};
const handles = () => ev('__cmwCutHandles()');
// the turn (degrees, in (−180, 180]) that a drag of the handle by (dx, dy) screen pixels gives the cut, from a fresh page,
// with the snap off and the handle's own value w in the plane of the drag (where the handle rests depends on how the page settled, so each
// drag is judged against its own start, not against another page's)
const turnOf = async (steps, dx, dy) => {
  await open(steps);
  const h = (await handles())[0];
  await drag(h.x, h.y, h.x + dx, h.y + dy, 8, 20);
  await settled({ max: 20000 });
  const h2 = (await handles())[0];
  return { turn: h2 ? ((h2.deg - h.deg + 540) % 360) - 180 : null, w: h.w };
};
const SCALE = 60;   // px per unit of every plane (srcView.s)
const argTurn = (z1, z0) => ((Math.atan2(z1[1], z1[0]) - Math.atan2(z0[1], z0[0])) * 180 / Math.PI);
// the turn of the cut that the pointer's move gives, where the map from the cut's plane to the dragged one is the logarithm
// (w = log z, so z = e^w, whose angle is Im w) or the square root (z = w²)
const expected = (type, w, dx, dy) => {
  const w1 = [w.re + dx / SCALE, w.im - dy / SCALE];
  if (type === 'log') return (w1[1] - w.im) * 180 / Math.PI;
  return argTurn([w1[0] * w1[0] - w1[1] * w1[1], 2 * w1[0] * w1[1]], [w.re * w.re - w.im * w.im, 2 * w.re * w.im]);
};
const TOL = 0.2;   // degrees: the cut is stored to 0.1°, and the start and the end each carry that rounding
const wrap = (d) => ((d + 540) % 360) - 180;
const LOG = [{ type: 'log', params: { cut: 180 }, on: true }];
const ROOT = [{ type: 'root', params: { n: 2, cut: 180 }, on: true }];
const both = async (name, type, steps, axis, d) => {
  const one = axis === 'y' ? [0, -d] : [d, 0], other = axis === 'y' ? [0, d] : [-d, 0];
  for (const [label, [dx, dy]] of [['one way', one], ['the other way', other]]) {
    const { turn, w } = await turnOf(steps, dx, dy);
    const want = w ? wrap(expected(type, w, dx, dy)) : null;
    check(`${name}: a drag ${label} turns the cut as the map says`, turn !== null && want !== null && Math.abs(turn) > 5 && Math.abs(turn - want) < TOL, { turn, want, w });
  }
};
await both('log, w₁, up and down 40 px', 'log', LOG, 'y', 40);
await both('log, w₁, up and down 20 px', 'log', LOG, 'y', 20);
await both('√z, w₁, right and left 30 px', 'root', ROOT, 'x', 30);
const fails = R.filter((r) => !r[1]);
return { pass: R.length - fails.length, of: R.length, fails };
