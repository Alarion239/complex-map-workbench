// A carried branch cut turns the same either way: in the plane after the cut, a drag of its handle by some distance one
// way and by the same distance the other way give turns of the same size and opposite signs. The logarithm's cut (180°)
// in w₁ is the case of the report (the cut moved up and not down); the square root's cut is the other multi-valued map.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, of, fails }.
const R = [];
const check = (name, pass, detail) => R.push([name, !!pass, detail]);
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1440, 900, false, false);
const open = async (steps) => {
  const ns = 'cutboth' + Date.now() + Math.floor(Math.random() * 1000);
  await loadView('steps', ns, { srcView: { cx: 0, cy: 0, s: 60 }, shapes: [], steps, height: 'im' });
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
  await ev(`__cmwSteps({ go: 1, now: true }); 1`); await settled({ max: 60000 });
};
const handles = () => ev('__cmwCutHandles()');
// the turn (degrees, in (−180, 180]) that a drag of the handle by (dx, dy) screen pixels gives the cut, from a fresh page
const turnOf = async (steps, dx, dy) => {
  await open(steps);
  const h = (await handles())[0];
  await drag(h.x, h.y, h.x + dx, h.y + dy, 8, 20);
  await settled({ max: 20000 });
  const h2 = (await handles())[0];
  return h2 ? ((h2.deg - h.deg + 540) % 360) - 180 : null;
};
const LOG = [{ type: 'log', params: { cut: 180 }, on: true }];
const ROOT = [{ type: 'root', params: { n: 2, cut: 180 }, on: true }];
const both = async (name, steps, axis, d) => {
  const one = axis === 'y' ? [0, -d] : [d, 0], other = axis === 'y' ? [0, d] : [-d, 0];
  const a = await turnOf(steps, ...one), b = await turnOf(steps, ...other);
  check(`${name}: a drag one way turns the cut`, a !== null && Math.abs(a) > 5, { a });
  check(`${name}: the same drag the other way turns it as far, the other way round`, a !== null && b !== null && Math.abs(a) > 5 && Math.abs(a + b) < 1.5, { a, b });
};
await both('log, w₁, up and down 40 px', LOG, 'y', 40);
await both('log, w₁, up and down 20 px', LOG, 'y', 20);
await both('√z, w₁, right and left 30 px', ROOT, 'x', 30);
const fails = R.filter((r) => !r[1]);
return { pass: R.length - fails.length, of: R.length, fails };
