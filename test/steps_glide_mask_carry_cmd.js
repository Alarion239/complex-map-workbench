// The steps view's Inside-regions mask in a moving frame is the mask of the parked frame at the same u. The thread
// is held on the rail at u (a scrub not let go: the moving frame, whose mask never comes from the regions' SphereMesh,
// which is built only once the view has stopped), the frame is read, then let go: once the SphereMesh of the regions has
// been built and the pane is still, the parked frame at u is read, and the two frames are compared (compare in
// test/lib/held_frames.js): at most SAME_FRAC of their pixels more than DIFF_TOL (32/255) apart.
// The cases: the zeros of the zeta function at u = .25, .5, .75 (a region whose image under the glide's map has a
// critical strip that the shape's own tessellated mesh lacks; its parked frame is read once no SphereMesh job is left),
// and the partial sum of the exponential, whose regions fill the pane (its frames must stay the same).
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js).
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const DEFAULT_PORT = '8793';
const SAME_FRAC = 0.005;      // (steps_glide_look_cmd.js: the parked frame is the held frame's pixels)
const VIEW_W = 1200, VIEW_H = 800;   // (the views shard's pane, as steps_glide_look_cmd.js)
const SETTLE_MAX_MS = 60000;  // the page's start-up, an example, a rest frame and a parked frame each settle within it
const MESH_MAX_MS = 150000;   // a SphereMesh job of the zeta regions on a software renderer
const JOB_ASK_MS = 1500;      // a bounded wait: the parked frame's draw asks for the SphereMesh job within it, where a mask is drawn from the forward image; with the exact frame no job is asked for, so there is no event to wait on, and the job list is read once it has passed
const PARK_EPS = 1e-3;        // how near u the thread has parked
const CASES = [
  { tag: 'Zeros of the zeta function', example: 'Zeros of the zeta function', us: [0.25, 0.5, 0.75] },
  { tag: 'Partial sum of the exponential', example: 'Partial sums of the exponential', us: [0.5] },
];
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, DEFAULT_PORT])[1];
const { hold, grab, compare } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const names = [...fs.readFileSync(DIR + '/../../src/app/15-examples-guide.js', 'utf8').matchAll(/\bname: \$t\('((?:[^'\\]|\\.)*)'\)/g)].map((m) => m[1].replace(/\\'/g, "'"));
const ready = () => settled({ max: SETTLE_MAX_MS, until: 'typeof __cmwSteps === "function" && typeof __cmwExample === "function" && typeof __cmwSvX === "function" && !!window.GLR' });
// (at rest on plane i, its frame drawn)
const rest = async (i) => { await ev(`__cmwSteps({ go: ${i}, now: true }), 1`); await settled({ max: SETTLE_MAX_MS, until: `!__cmwSteps().moving && __cmwSvX() === ${i}` }); };
// (no SphereMesh job left to run: none is wanted by a frame, or the one asked for has been built)
const MESH_IDLE = `(() => { const q = __cmwSphere(); return !(Array.isArray(q.jobs) ? q.jobs.length : q.jobs); })()`;
await view(VIEW_W, VIEW_H, false, false);
for (const c of CASES) {
  const r = info[c.tag] = {};
  try {
    await go(`http://localhost:${PORT}/test.html?view=steps&ns=mcarry${Date.now()}&lang=en`);
    await ready();
    const ex = names.indexOf(c.example);
    ok(`${c.tag}: the example is found`, ex >= 0, names.length);
    await ev(`__cmwExample(${ex}); 1`);
    await settled({ max: SETTLE_MAX_MS });
    await ev(`__cmwSet('morphPaths', false), __cmwSet('alpha', 1), __cmwSteps(${JSON.stringify({ scope: 'in', surf: 'plane' })}), 1`);
    await rest(0);
    for (const u of c.us) {
      const held = (await hold(u)).ok, still = await grab('H' + u);
      await ev('window.__svScrubUp(), 1');
      const parked = (await settled({ max: SETTLE_MAX_MS, until: `GLR.pendingLinks === 0 && !__cmwSteps().anim && Math.abs(__cmwSvX() - ${u}) < ${PARK_EPS}` })).ok;
      await sleep(JOB_ASK_MS);
      const built = (await settled({ max: MESH_MAX_MS, until: MESH_IDLE })).ok;
      const settledP = await grab('P' + u);
      const diff = held && still && parked && built && settledP ? await compare('H' + u, 'P' + u) : null;
      r[u] = { held, still, parked, built, settledP, diff };
      ok(`${c.tag}: the frame held at u = ${u} has the parked frame's pixels (at most ${SAME_FRAC * 100} % of them more than 32/255 apart)`, !!diff && diff.frac <= SAME_FRAC, r[u]);
      await rest(0);
    }
  } catch (e) { ok(`${c.tag}: the case runs to its end`, false, String(e && e.message || e).slice(0, 300)); }
}
return { pass: fails.length === 0, fails, info };
