// The window the steps view meshes its z-plane in (clipWin: the whole-plane meshes' key includes it, so the same scene
// has to give the same window and so the same meshes on every load, #2399). A saved state with no window gets one
// from the pane's size at init, which is before the layout has its final box (a phone: 342 x 310 then, 376 x 656 once
// settled); the first re-centre, which the settled layout asks for, puts the source view's window at the settled size in
// its place, whichever plane the thread is on. z³ then cos, Everywhere, a 390 x 844 phone, each opened LOADS times:
// - saved on plane w₂ (sv.at 2): the window is the source view's at the pane's size, the pane's own box, not the
//   one the first, unsettled layout gave, and the same on every load;
// - on plane z, the thread sent to plane w₂ as soon as the steps view is up (before the settled layout's re-centre ran):
//   the same window, and the whole-plane meshes (__svAll, __svRing) built in it are the same on every load (their
//   evaluations, nodes and triangles).
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js).
// Prints {pass, fails, info}.
const fails = [], info = { saved: [], sent: [] };
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return !!cond; };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const K = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'steps_chain_kit.js'), 'utf8'))({ ev, go, view, settled, PORT });
const LOADS = 3;
const SETTLE_MS = 1500;          // the settled layout's re-centre comes about 0.4 s after the page's first frame
const WIN_EPS = 2e-3;            // the window is rounded outward to 1e-4 of its size
const BUILT_MAX_MS = 120000;
const CHAIN = [K.CUBE, { type: 'cos', params: {}, on: true }];
const BUILT = '(() => { const q = __cmwSphere(); return q.entries.length >= 2 && q.jobs.length === 0 && !q.kick; })()';
// the window the source view has at the pane's size: its centre, the pane's px over its scale
const expected = (c) => { const v = c.srcView, w = c.pane[0] / 2 / v.s, h = c.pane[1] / 2 / v.s; return { x0: v.cx - w, x1: v.cx + w, y0: v.cy - h, y1: v.cy + h }; };
const near = (a, b) => ['x0', 'x1', 'y0', 'y1'].every((k) => Math.abs(a[k] - b[k]) <= WIN_EPS);
const read = async () => {
  await sleep(SETTLE_MS);
  await settled({ max: 30000, until: '!__cmwClipWin().pending', only: true });
  return ev('__cmwClipWin()');
};
const open = (name, extra) => K.openChain({ ns: `scw${name}${Date.now()}`, steps: CHAIN, w: 390, h: 844, mobile: true, shapes: [], extra, max: 120000 });
for (let i = 0; i < LOADS; i++) {
  await open('a', { sv: { at: 2 } });
  info.saved.push(await read());
}
const first = info.saved[0];
ok('saved on plane w₂: the window is the source view\'s at the pane\'s size', info.saved.every((c) => near(c.win, expected(c))), info.saved.map((c) => ({ win: c.win, expected: expected(c), pane: c.pane })));
ok('saved on plane w₂: the same window on every load', info.saved.every((c) => near(c.win, first.win)), info.saved.map((c) => c.win));
for (let i = 0; i < LOADS; i++) {
  await open('b');
  await ev(`__cmwSet('alpha', 1); document.querySelector('.sv-cp').click(); __cmwSteps({ scope: 'all', go: 2, now: true }); 1`);
  await settled({ max: BUILT_MAX_MS, until: BUILT, only: true });
  const c = await read();
  const meshes = await ev('(() => __cmwSphere().entries.map((e) => ({ slot: e.slot, work: e.work, nodes: e.nodes, n: e.n })))()');
  info.sent.push(Object.assign({ meshes }, c));
}
const f0 = info.sent[0];
ok('sent to plane w₂ at once: the window is the source view\'s at the pane\'s size', info.sent.every((c) => near(c.win, expected(c))), info.sent.map((c) => ({ win: c.win, expected: expected(c) })));
ok('sent to plane w₂ at once: the same window on every load', info.sent.every((c) => near(c.win, f0.win)), info.sent.map((c) => c.win));
const MESHES = { all: /^__svAll\|/, ring: /^__svRing\|/ };
ok('sent to plane w₂ at once: both whole-plane meshes are published on every load', info.sent.every((c) => Object.values(MESHES).every((re) => c.meshes.some((m) => re.test(m.slot)))), info.sent.map((c) => c.meshes.map((m) => m.slot)));
for (const [tag, re] of Object.entries(MESHES)) {
  const at = info.sent.map((c) => c.meshes.find((m) => re.test(m.slot)));
  ok(`sent to plane w₂ at once: the ${tag} mesh is the same on every load (evaluations, nodes, triangles)`, at.every((m) => m && m.work === at[0].work && m.nodes === at[0].nodes && m.n === at[0].n), at);
}
return { pass: fails.length === 0, fails, info };
