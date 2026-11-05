// A glide whose step the inverse pass draws holds on the plane it started from while that pass's program still links
// (GLR.holdLinks), so no frame between the planes is the carried mesh's; once the links are let go, the frame between
// the planes is the inverse pass's. The default example (exp, then a Möbius map), a scrub on the rail to the middle of
// its first glide, not let go.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const ready = () => settled({ max: 60000, until: 'typeof __cmwSteps === "function" && !!window.GLR && !!document.querySelector(".sv-rail")' });
const scrub = (x) => ev(`(() => {
  const rail = document.querySelector('.sv-rail'), ns = [...document.querySelectorAll('.sv-track .sv-plane')].map((b) => { const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  const px = (x) => { const i = Math.min(Math.floor(x), ns.length - 2); return ns[i][0] + (ns[i + 1][0] - ns[i][0]) * (x - i); }, cy = ns[0][1];
  const ev = (type, x) => rail.dispatchEvent(new PointerEvent(type, { pointerId: 73, pointerType: 'mouse', button: 0, buttons: 1, isPrimary: true, bubbles: true, clientX: px(x), clientY: cy }));
  ev('pointerdown', 0); ev('pointermove', 0.05); ev('pointermove', ${x});
  window.__svScrubUp = () => ev('pointerup', ${x});
  return 1;
})()`);
await view(1200, 800, false, false);
await go(`http://localhost:${PORT}/test.html?view=steps&ns=lh${Date.now()}&lang=en`);
await ready();
await ev('GLR.holdLinks(true), 1');
await scrub(0.5);
await ev('await new Promise((r) => setTimeout(r, 3000)), 1');
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
