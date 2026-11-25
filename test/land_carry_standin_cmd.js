// The carried Landscape's stand-in, its CPU half (#2411): plane w₂ past the colour plane T, at rest, while its programs
// (landCarryTF and landCarry) link, on a cold load with ?glhold (which keeps every chain program's link pending, GLR.holdLinks),
// in the steps view: z → z²+1 → exp, T = w₁, the Landscape of plane w₂, Everywhere. The carried frame is plane w₁'s points
// moved by exp (the glide's map from plane s = T), each at its height and colour in T, which are w₁'s own:
// - a job in the stand-in engine (standInOf) evaluates plane s's grid over its box, and ends with a level done (its nodes kept:
//   __cmwStandIn, carry: true);
// - each node of it holds the place of its point (q: exp of the point) and its value in the height plane (w: the point itself, the
//   stages (s, T] being none), read against the box's point and exp, not against the app's own evaluators;
// - the plane's own Landscape (T = w₁: its stand-in is #2108's) has no carried job (control).
// The draw that shows it waits on the carried draw (#1874). A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const TOL = 1e-4, MIN_NODES = 33 * 33;
const loaded = "typeof __cmwSteps === 'function' && !!window.GLR";
const run = async (at, tag) => {
  await view(1200, 800, false, false);
  const ns = 'lcs' + tag + Date.now();
  await seed(ns, { steps: [{ type: 'custom', params: { expr: 'z^2+1', cut: 180 }, on: true }, { type: 'exp', params: {}, on: true }],
    shapes: [{ kind: 'disc', c: [0, 0], r: 1, id: 's1' }], sv: { at, T: 1, scope: 'all', surf: 'land' } });
  if (!(await go(`http://localhost:${PORT}/test.html?ns=${ns}&glhold&view=steps`))) throw new Error('no load event');
  await settled({ max: 30000, panes: false, until: loaded });
};
await run(2, 'w2');
const w = await settled({ only: true, max: 60000, panes: false, until: '!!__cmwStandIn() && __cmwStandIn().carry && __cmwStandIn().end !== null' });
const si = await ev('__cmwStandIn()'), cs = await ev('typeof __cmwCarryStandIn === "function" ? __cmwCarryStandIn(9) : null');
info.w2 = { wait: w, standIn: si, nodes: cs ? cs.nodes.length : null, box: cs ? cs.box : null };
ok('plane w₂ past T: a carried job runs and ends with a level done kept (the job ended, its nodes drawn)', w.ok && !!si && si.carry && si.land && si.nodes >= MIN_NODES && (si.end === 'done' || si.end === 'budget'), info.w2);
if (cs) {
  const { box } = cs, bad = [];
  for (const n of cs.nodes) {
    const px = box.x0 + (box.x1 - box.x0) * n.fx, py = box.y0 + (box.y1 - box.y0) * n.fy, e = Math.exp(px);
    const qx = e * Math.cos(py), qy = e * Math.sin(py), sc = 1 + Math.hypot(qx, qy);
    if (Math.hypot(n.w[0] - px, n.w[1] - py) > TOL * (1 + Math.hypot(px, py)) || Math.hypot(n.q[0] - qx, n.q[1] - qy) > TOL * sc) bad.push({ fx: n.fx, fy: n.fy, w: n.w, q: n.q, want: [qx, qy] });
  }
  info.w2.bad = bad.slice(0, 4);
  ok('plane w₂ past T: each node holds its place (exp of the point) and its value (the point itself) of plane w₁', bad.length === 0 && cs.nodes.length === 81, { bad: bad.slice(0, 4), nodes: cs.nodes.length });
} else ok('plane w₂ past T: the carried job has a grid to read', false, info.w2);
await run(1, 'w1');
await settled({ only: true, max: 60000, panes: false, until: '!!__cmwStandIn() && __cmwStandIn().land && __cmwStandIn().end !== null' });
const own = await ev('__cmwStandIn()');
info.w1 = own;
ok('T = w₁ (its own relief): its stand-in is not a carried job (control)', !!own && own.land && !own.carry, own);
return { pass: fails.length === 0, fails, info };
