// The steps view's one camera, S.srcView, keeps its scale through a Play (#2373): a plane after the first shows the view
// the camera holds, and ▶ from z to w₁ must leave it as it was, whichever way the frames of the glide are drawn (a catalog step
// repeated ×3, drawn ahead, or the same step written as a formula, drawn live as the glide goes). P/Q (z³ + 0.5)/(z + 0.3) ×3
// as one step with Repeat ×3, a disc as the region, Inside regions, from a saved state whose camera has its own scale (s0, not
// the page's default 60): at 1440 × 900 (s0 140) and 360 × 640 on a phone (s0 90), each chain from z by ▶ to w₁:
// - the camera's scale is s0 on every frame of the glide and where it lands;
// - the scale the plane reads (its "N / div" badge) is the same for the catalog step and the formula.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const READY = 'typeof __cmwSteps === "function" && !!window.GLR && __cmwSteps().ready.ready';
const REP = { n: 3, len: 1 };
const CHAINS = {
  catalog: { type: 'rational', params: { p: '1, 0, 0, 0.5', q: '1, 0.3' }, on: true, repeat: REP },
  formula: { type: 'custom', params: { expr: '(z^3+0.5)/(z+0.3)', cut: 180 }, on: true, repeat: REP },
};
const frames = () => ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
for (const [w, h, phone, s0] of [[1440, 900, false, 140], [360, 640, true, 90]]) {
  const badge = {};
  for (const [name, step] of Object.entries(CHAINS)) {
    const tag = `${w} x ${h} ${name}`;
    await view(w, h, false, phone);
    await loadView('steps', 'svcam' + Date.now(), { shapes: [{ id: 's1', kind: 'disc', c: [0.6, 0.4], r: 0.25, ci: 0, visible: true }], steps: [step], srcView: { cx: 0, cy: 0, s: s0 } }, {});
    await settled({ max: 30000, until: READY });
    await ev(`__cmwSteps({ scope: 'in' }); 1`);
    await frames();
    // (every change of the camera's scale from here, with where the thread was)
    await ev(`window.__camTrace = []; (() => { let last = null; const tick = () => { const s = __cmwFigureState().srcView.s; if (s !== last) { window.__camTrace.push({ s, x: +(+__cmwSteps().x).toFixed(3) }); last = s; } requestAnimationFrame(tick); }; tick(); })(); 1`);
    await ev(`document.querySelector('.sv-play').click(); 1`);
    await settled({ max: 120000, until: '__cmwSteps().i === 1 && !__cmwSteps().moving' });
    await frames();
    const trace = info[tag] = await ev(`window.__camTrace`);
    ok(`${tag}: the camera's scale is ${s0} on every frame of the Play, and where it lands`, trace.length === 1 && trace[0].s === s0, trace);
    badge[name] = await ev(`(() => { const m = /([0-9.]+)\\s*\\/\\s*div/.exec(document.getElementById('paneL').textContent); return m ? m[1] : null; })()`);
  }
  info[`${w} badge`] = badge;
  ok(`${w} x ${h}: the plane reads the same scale for the catalog step and the formula`, !!badge.catalog && badge.catalog === badge.formula, badge);
}
return { pass: fails.length === 0, fails, info };
