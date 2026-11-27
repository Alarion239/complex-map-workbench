// The phone plane's keys are in the stack's DOM in the order they read on the screen (top to bottom, then left to right), so Tab and a screen
// reader's swipe walk them as the eye does: in the column (portrait, and landscape with room), on the Stack's landscape grid, in the
// one-row-high arrangement ("side"), under the tall bar ("low") and in the one row ("row"). A key that has the focus keeps it as the arrangement
// changes (the tall bar opening), and the laptop's order (Fit view, then Sphere) is back once the page leaves the phone layout.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const SETTLE_MAX = 20000;
const M3 = [{ type: 'custom', params: { expr: 'z^3-1.2z+0.3' }, on: true }];
// the stack's visible keys in the order Tab visits them (the DOM's) and in reading order
const order = () => ev(`(() => {
  const plot = document.getElementById('plotL'), stack = plot.querySelector(':scope > .viewstack');
  const vis = [...stack.querySelectorAll('.vbtn')].filter((e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden');
  const name = (e) => e.id || e.className.replace(/vbtn|ph-only/g, '').trim();
  const reading = vis.slice().sort((a, b) => { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return Math.round(ra.top / 10) - Math.round(rb.top / 10) || ra.left - rb.left; });
  return { dom: vis.map(name), reading: reading.map(name), keys: plot.dataset.keys || '', active: document.activeElement && name(document.activeElement) };
})()`);
const start = async (w, h, st) => {
  await view(w, h, false, true);
  const ns = 'sko' + w + (Date.now() % 1000000);
  await load(ns, { shapes: [{ id: 'd', kind: 'disc', c: [1.1, 0], r: 0.25, stage: 1 }], steps: M3, srcView: { cx: 1.1, cy: 0, s: 70 } });
  await go(`${U}?ns=${ns}&view=steps`);
  await settled({ max: SETTLE_MAX, until: `typeof __cmwSteps === 'function' && !!window.Phone && Phone.isOn() && __cmwSteps().ready.ready` });
  await ev(`(document.querySelectorAll('.toast-x').forEach((b) => b.click()), 1)`);
  if (st.stack) {
    await ev(`(__cmwSelect('d'), 1)`);
    await settled({ max: SETTLE_MAX, until: `typeof __cmwLookDown === 'function' && !!__cmwLookDown() && !!document.querySelector('.ph-ctx.in')` });
    await ev(`(__cmwSteps({ surf: 'stack' }), 1)`);
    await settled({ max: SETTLE_MAX, floor: 600, until: `__cmwSteps().surf === 'stack' && typeof __cmwStack === 'function' && !!__cmwStack().drawn` });
  }
};
const tallBar = async () => {
  await ev(`(document.querySelector('#constructTools .tool[data-tool="perp"]').click(), 1)`);
  await settled({ max: SETTLE_MAX, floor: 600, until: `document.documentElement.classList.contains('ph-ctx-tall')` });
};
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const check = async (tag, keys) => {
  const o = await order();
  info[tag] = o;
  ok(`${tag}: the keys stand in the ${keys || 'column'} arrangement`, o.keys === keys, o.keys);
  ok(`${tag}: the DOM order is the reading order`, same(o.dom, o.reading), { dom: o.dom, reading: o.reading });
  return o;
};
await start(390, 844, {});
await check('390x844 plane', '');
await start(390, 844, { stack: true });
await check('390x844 Stack', '');
await start(640, 360, { stack: true });
await check('640x360 Stack', '');
await start(568, 320, { stack: true });
await check('568x320 Stack', 'side');
await tallBar();
await check('568x320 Stack, tall bar', 'low');
// ---- the focus stays on a key as the arrangement changes under it, and the laptop's order is back after the phone layout
await start(568, 320, { stack: true });
await ev(`(document.getElementById('leftSph').focus(), 1)`);
await tallBar();
const f = await order();
ok('the focused Sphere key keeps the focus as the tall bar opens', f.active === 'leftSph', f);
await start(568, 320, {});
await ev(`(__cmwExample(1), 1)`);
await settled({ max: SETTLE_MAX, until: '__cmwSteps().planes.length > 1' });
await tallBar();
await check('568x320 example 1, tall bar', 'row');
await view(1280, 800, false, false);
await settled({ max: 10000, floor: 400, until: `!document.documentElement.classList.contains('ph')` });
const lap = await ev(`(() => { const s = document.querySelector('#plotL > .viewstack'); return [...s.querySelectorAll('.vbtn')].filter((e) => e.getClientRects().length > 0).map((e) => e.id); })()`);
ok('on the laptop the stack reads Zoom in, Zoom out, Fit view, Sphere', same(lap, ['leftZoomIn', 'leftZoomOut', 'leftFit', 'leftSph']), lap);
return { pass: fails.length === 0, fails: fails.slice(0, 40), info };
