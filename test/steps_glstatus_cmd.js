// The steps view's left pane between planes (svRenderMoving) keeps its GPU status (__cmwPaneStatus('L'), what the
// compiling note and the pane's settle read) as fresh as at rest: the square root example with a step added while its
// programs are held linking (GLR.holdLinks), parked on the new plane (its frame waits for them), then held mid-glide
// before it (a scrub on the rail, not let go). Once the links are let go and none is pending, the next frame between
// planes says nothing is pending or compiling. Inside regions, with the links held, a frame between planes says they
// are pending.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1200, 800, false, false);
const names = [...fs.readFileSync(DIR + '/../../src/app/15-examples-guide.js', 'utf8').matchAll(/\bname: \$t\('((?:[^'\\]|\\.)*)'\)/g)].map((m) => m[1].replace(/\\'/g, "'"));
const ready = async () => { await settled({ max: 30000, until: 'typeof __cmwExample === "function" && typeof __cmwSteps === "function" && typeof __cmwPaneStatus === "function" && !!window.GLR' }); };
// the thread on the rail at x, pressed and not let go: window.__svScrubTo(x) moves it, window.__svScrubUp() lets it go
const scrub = async (x) => ev(`(() => {
  const rail = document.querySelector('.sv-rail'), ns = [...document.querySelectorAll('.sv-track .sv-plane')].map((b) => { const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  const px = (x) => { const i = Math.min(Math.floor(x), ns.length - 2); return ns[i][0] + (ns[i + 1][0] - ns[i][0]) * (x - i); }, cy = ns[0][1];
  const ev = (type, x) => rail.dispatchEvent(new PointerEvent(type, { pointerId: 73, pointerType: 'mouse', button: 0, buttons: 1, isPrimary: true, bubbles: true, clientX: px(x), clientY: cy }));
  ev('pointerdown', 0); ev('pointermove', 0.05); ev('pointermove', ${x});
  window.__svScrubTo = (x) => ev('pointermove', x);
  window.__svScrubUp = () => ev('pointerup', ${x});
  return 1;
})()`);
// (the thread at x and a left-pane status newer than t1: a frame drawn there since)
const renewed = (x, t1) => `Math.abs(__cmwSvX() - ${x}) < 0.01`
  + ` && (() => { const s = __cmwPaneStatus('L'); return !!s && s.t > ${t1}; })()`;
{
  const ex = names.indexOf('Square root and its sheets');
  ok('the square root example is found', ex >= 0, names.length);
  await go(`http://localhost:${PORT}/test.html?view=steps&ns=gs${Date.now()}`);
  await ready();
  await ev(`__cmwExample(${ex}); 1`);
  await adopted();
  await settled({ max: 20000 });
  await ev(`__cmwSteps(${JSON.stringify({ scope: 'all', surf: 'plane', go: 0, now: true })}); 1`);
  await settled({ max: 20000 });
  const n0 = await ev('__cmwSteps().planes.length');
  // (the new step's programs held linking: its plane's frame waits for them)
  await ev('GLR.holdLinks(true), 1');
  await ev(`__cmwAddStep('exp'), 1`);
  await settled({ max: 20000, panes: false, until: `__cmwSteps().planes.length === ${n0 + 1}` });
  const last = n0;
  await ev(`__cmwSteps({ go: ${last}, now: true }), 1`);
  const waits = `(() => { const s = __cmwPaneStatus('L'); return !!s && (s.pending || s.compiling); })()`;
  const atRest = await settled({ max: 20000, panes: false, until: `!__cmwSteps().moving && ${waits}` });
  const s0 = await ev(`__cmwPaneStatus('L')`);
  info.held = { atRest: atRest.ok, status: s0, pendingLinks: await ev('GLR.pendingLinks') };
  ok('with the links held, the new plane\'s frame at rest waits for its programs',
    atRest.ok && s0 && (s0.pending || s0.compiling), info.held);
  // (held mid-glide before the new plane: every frame from here is one between planes)
  const x = last - 0.5;
  await scrub(x);
  await settled({ max: 20000, panes: false, until: `Math.abs(__cmwSvX() - ${x}) < 0.01 && __cmwSteps().moving` });
  await ev('GLR.holdLinks(false), 1');
  const linked = await settled({ max: 20000, panes: false, until: 'GLR.pendingLinks === 0' });
  const t1 = await ev('performance.now()');
  await ev(`window.__svScrubTo(${x - 0.05}), 1`);
  const fresh = await settled({ max: 10000, panes: false, until: renewed(x - 0.05, t1) });
  const s1 = await ev(`__cmwPaneStatus('L')`);
  const between = await ev('__cmwSteps().moving');
  info.released = { linked: linked.ok, fresh: fresh.ok, status: s1, between, t1 };
  ok('once the links are let go: none is pending', linked.ok, info.released);
  ok('between planes: the frame after the links landed renews the left pane\'s status',
    fresh.ok && s1 && s1.t > t1, info.released);
  ok('between planes, with no link pending: the left pane says nothing is pending or compiling',
    s1 && !s1.pending && !s1.compiling && !s1.error, info.released);
  ok('the thread is still between planes', between === true, info.released);
  await ev('window.__svScrubUp(), 1');
}
// Inside regions, while the links are held: the frames between planes (the colour kept inside the regions' mask) say
// that the pane waits for its programs
{
  const ex = names.indexOf('Square root and its sheets');
  await go(`http://localhost:${PORT}/test.html?view=steps&ns=gi${Date.now()}`);
  await ready();
  await ev(`__cmwExample(${ex}); 1`);
  await adopted();
  await settled({ max: 20000 });
  await ev(`__cmwSteps(${JSON.stringify({ scope: 'in', surf: 'plane', go: 0, now: true })}); 1`);
  await settled({ max: 20000 });
  const n0 = await ev('__cmwSteps().planes.length');
  await ev('GLR.holdLinks(true), 1');
  await ev(`__cmwAddStep('exp'), 1`);
  await settled({ max: 20000, panes: false, until: `__cmwSteps().planes.length === ${n0 + 1}` });
  await ev(`__cmwSteps({ scope: 'in' }), 1`);
  const x = n0 - 0.5;
  await scrub(x);
  await settled({ max: 20000, panes: false, until: `Math.abs(__cmwSvX() - ${x}) < 0.01 && __cmwSteps().moving` });
  const t1 = await ev('performance.now()');
  await ev(`window.__svScrubTo(${x - 0.05}), 1`);
  const fresh = await settled({ max: 10000, panes: false, until: renewed(x - 0.05, t1) });
  const s1 = await ev(`__cmwPaneStatus('L')`);
  info.inside = { fresh: fresh.ok, status: s1, pendingLinks: await ev('GLR.pendingLinks') };
  Object.assign(info.inside, { between: await ev('__cmwSteps().moving'), scope: await ev('__cmwSteps().scope') });
  ok('Inside regions between planes, links held: the frame renews the left pane\'s status',
    fresh.ok && s1 && s1.t > t1, info.inside);
  ok('Inside regions between planes, links held: the left pane says its programs are pending',
    s1 && s1.pending, info.inside);
  await ev('window.__svScrubUp(), 1');
  await ev('GLR.holdLinks(false), 1');
}
return { pass: fails.length === 0, fails, info };
