// A glide whose step the inverse pass draws holds on the plane it started from while that pass's program still links
// (GLR.holdLinks), so no frame between the planes is the carried mesh's; once the links are let go, the frame between
// the planes is the inverse pass's. The default example (exp, then a Möbius map), opened with the chain's programs held
// from the load (?glhold: the prestart and the warm-up can link nothing of the glide before the suite reads it), a
// scrub on the rail to the middle of its first glide, not let go. Before the scrub, the page's load work is done (the
// prestart asked for the glide's programs and the idle jobs finished, loaded()) and a frame of the glide has asked for
// its programs, the order a runner that links fast takes: a hold set after that frame finds the inverse pass's program
// linked, and its pending row fails.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const { hold } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
// (panes: false: the kit's settled would wait for the panes' compiles too, which the hold keeps pending)
const ready = () => settled({ max: 60000, panes: false, until: 'typeof __cmwSteps === "function" && !!window.GLR && !!document.querySelector(".sv-rail")' });
// the page's load work done: the prestart asked for the glide's programs (svReady's programs part counts more than the
// one it counts before any is asked for) and its idle jobs finished -> svReady's parts then; null when that did not
// come within a minute. Polled, not the kit's settled, which waits for the pane's compiles too (here they are held)
const loaded = () => ev(`(async () => {
  const s = () => { const { programs: p, jobs: j } = __cmwSteps().ready.parts; return !!p && p.total > 1 && !!j && j.done === j.total; };
  const t = performance.now() + 60000;
  while (!s() && performance.now() < t) await new Promise((r) => setTimeout(r, 50));
  return s() ? __cmwSteps().ready.parts : null;
})()`);
await view(1200, 800, false, false);
await go(`http://localhost:${PORT}/test.html?view=steps&ns=lh${Date.now()}&lang=en&glhold`);
await ready();
const atLoad = info.loaded = await loaded();
ok('the page\'s load work is done (the prestart asked for the glide\'s programs, the idle jobs finished)', !!atLoad, atLoad);
// (the order a runner that links fast can take: a frame of the glide asks for its programs before the suite reads it,
// as the warm-up's draw does; drawn at x = 0.5 and back on plane z, each two animation frames)
await ev(`(async () => { for (const x of [0.5, 0]) { __cmwSteps({ x }); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); } return 1; })()`);
await hold(0.5, false);
const held = await ev('(() => { const g = __cmwSteps().glide; return { x: __cmwSvX(), pending: GLR.pendingLinks, glide: g ? { u: g.u, path: g.path, reason: g.reason } : null }; })()');
info.held = held;
ok('links held: the thread is on the rail between the planes', held.x > 0.4 && held.x < 0.6, held);
ok('links held: the inverse pass\'s program is pending', held.pending > 0, held);
ok('links held: no frame between the planes is the carried mesh\'s', !held.glide || held.glide.path !== 'mesh', held);
await ev('GLR.holdLinks(false), 1');
const rel = await settled({ max: 30000, until: `(() => { const g = __cmwSteps().glide; return !!g && g.path === 'inverse'; })()` });
info.released = { ok: rel.ok, glide: await ev('__cmwSteps().glide && __cmwSteps().glide.path') };
ok('links let go: the frame between the planes is the inverse pass\'s', rel.ok, info.released);
await ev('window.__svScrubUp(), 1');
return { pass: fails.length === 0, fails, info };
