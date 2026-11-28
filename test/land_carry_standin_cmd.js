// The carried Landscape's stand-in (#2411): plane w₂ past the colour plane T, at rest, while its programs
// (landCarryTF and landCarry) link, on a cold load with ?glhold (which keeps every chain program's link pending, GLR.holdLinks),
// in the steps view: z → z²+1 → exp, T = w₁, the Landscape of plane w₂, Everywhere. The carried frame is plane w₁'s points
// moved by exp (the glide's map from plane s = T), each at its height and colour in T, which are w₁'s own:
// - a job in the stand-in engine (standInOf) evaluates plane s's grid over its box, and ends with a level done (its nodes held:
//   __cmwStandIn, carry: true);
// - each node of it holds the place of its point (q: exp of the point) and its value in the height plane (w: the point itself, the
//   stages (s, T] being none), read against the box's point and exp, not against the app's own evaluators;
// - the plane's own Landscape (T = w₁: its stand-in is #2108's) has no carried job (control);
// - the draw (landCarryS: the grid's places, heights and values from the CPU, no chain): the frame draws the carried relief while the
//   programs link (more of the pane unlike its corner than the plate alone, still pending); from the release to the GPU picture no frame
//   shows the plate alone; and the stand-in is the GPU picture's: the unlike and colour shares of the pane are near its, and at most
//   DIFF_FRAC of its 16 px blocks' mean colours differ by more than 40 levels (test/lib/standin_kit.js).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const TOL = 1e-4, MIN_NODES = 33 * 33, PLATE_UNLIKE = 0.3, NEAR = 0.1, DIFF_FRAC = 0.05;
const K = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'standin_kit.js'), 'utf8'));
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
ok('plane w₂ past T: a carried job runs over the box grid and ends with a level done kept (the job ended, its nodes held)', w.ok && !!si && si.carry && si.land && si.nodes >= MIN_NODES && (si.end === 'done' || si.end === 'budget'), info.w2);
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
// the draw: the relief of the carried frame from the job's grid while the programs link, then the GPU picture
await settled({ only: true, max: 20000, panes: false, until: '__cmwLandStandIn()' });
const held = await K.look();
info.w2.held = { drawn: await ev('__cmwLandStandIn()'), carried: await ev('__cmwLandCarryStand()'), unlike: +held.unlike.toFixed(3), hue: +held.hue.toFixed(3), pending: await ev('GLR.frameStatus().pending') };
ok(`plane w₂ past T: the frame draws the carried stand-in's relief (more of the pane unlike the plate than ${PLATE_UNLIKE}), still pending`, info.w2.held.drawn && info.w2.held.carried && held.unlike > PLATE_UNLIKE && info.w2.held.pending === true, info.w2.held);
const rel = await K.release();
info.w2.release = { wait: rel.wait, frames: rel.frames, worstUnlike: rel.worstUnlike === null ? null : +rel.worstUnlike.toFixed(3) };
ok(`plane w₂ past T: from the release to the GPU picture no frame shows the plate alone (every frame's unlike share over ${PLATE_UNLIKE})`, !!rel.frames && rel.worstUnlike > PLATE_UNLIKE, info.w2.release);
const fin = await settled({ max: 30000 });
const after = await K.look();
info.w2.final = { wait: fin, unlike: +after.unlike.toFixed(3), hue: +after.hue.toFixed(3), apart: +K.apart(held, after).toFixed(3) };
ok(`plane w₂ past T: the stand-in's unlike and colour shares are near the GPU picture's (within ${NEAR})`, fin.ok && Math.abs(held.unlike - after.unlike) <= NEAR && Math.abs(held.hue - after.hue) <= NEAR, info.w2.final);
ok(`plane w₂ past T: the stand-in is the GPU picture's: at most ${DIFF_FRAC * 100} % of the ${K.BLOCK} px blocks differ by more than ${K.LEVELS} levels`, fin.ok && K.apart(held, after) <= DIFF_FRAC, info.w2.final);
await run(1, 'w1');
await settled({ only: true, max: 60000, panes: false, until: '!!__cmwStandIn() && __cmwStandIn().land && __cmwStandIn().end !== null' });
const own = await ev('__cmwStandIn()');
info.w1 = own;
ok('T = w₁ (its own relief): its stand-in is not a carried job (control)', !!own && own.land && !own.carry, own);
return { pass: fails.length === 0, fails, info };
