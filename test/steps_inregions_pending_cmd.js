// The steps view's Inside regions on plane w₁ while the region program is still linking (#1198): the plane's frame
// draws no mask yet, and the pane reports that frame as pending (not quiet) until the link lands and the picture is
// redrawn, so a check that waits for the pane to be quiet never reads the unfinished mask. ?glhold keeps the chain's
// programs linking (GLR.holdLinks) on any back end, so the check does not depend on how quickly the back end links.
//   - held: the left pane's last frame is pending;
//   - released and quiet: the pane is not pending, and the mask is 1 at 1 + i and 2 (Re w₁ > 0), 0 at -1 + 0.5i.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const DEFAULT_PORT = '8793';
const MAX_HELD_FRAMES = 40;   // frames waited for the pane's pending status while the links are held
const MASK_TOL = 0.05;        // a mask value counts as equal within it
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, DEFAULT_PORT])[1];
await view(1440, 900, false, false);
await go(`http://localhost:${PORT}/test.html?view=steps&ns=inpend${Date.now()}&glhold`);
await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR', panes: false });
await ev(`__cmwSteps({ scope: 'in', surf: 'land', go: 1, now: true }); 1`);
// (frames drawn while the links are held; the last one is the pane's status)
let held = null;
for (let i = 0; i < MAX_HELD_FRAMES; i++) {
  await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
  held = await ev(`(() => { const s = __cmwPaneStatus('L'); return s && { pending: !!s.pending, compiling: !!s.compiling, mask: typeof __cmwLandMask === 'function' ? __cmwLandMask(1, 1) : 'no hook' }; })()`);
  if (held && held.pending) break;
}
info.held = held;
ok('links held: the left pane reports its last frame as pending', !!held && held.pending === true, held);
await ev('(GLR.holdLinks(false), 1)');
const q = await settled({ max: 60000 });
ok('released: the pane becomes quiet', q.ok === true, q);
const st = await ev(`(() => { const s = __cmwPaneStatus('L'); return s && { pending: !!s.pending, compiling: !!s.compiling }; })()`);
info.after = st;
ok('released and quiet: not pending', !!st && !st.pending && !st.compiling, st);
const mask = [];
for (const [x, y, want] of [[1, 1, 1], [2, 0, 1], [-1, 0.5, 0]]) {
  const v = await ev(`typeof __cmwLandMask === 'function' ? __cmwLandMask(${x}, ${y}) : 'no hook'`);
  mask.push([x, y, v]);
  ok(`released and quiet: the mask at ${x} + ${y}i is ${want}`, typeof v === 'number' && Math.abs(v - want) < MASK_TOL, v);
}
info.mask = mask;
return { pass: fails.length === 0, fails, info };
