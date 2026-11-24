// A landscape phone's plane keys (Sphere and Display in the right column, Fit view at the foot) stand inside the plane, above the
// context bar, however short the plane is (#2398): in the steps view on the flat plane at 568 x 320, 600 x 320, 640 x 360 and 740 x 360,
// with the plane as the page starts (no bar: a control), with example 1 (its row under the head leaves a plane 148 px tall at 320 px),
// with a selected shape's bar (56 px), with both, and with the tall construction bar on example 1. Each key's box lies inside the plane
// and above the bar's top, no two keys overlap, and each key is the topmost element at its centre. The folded colour key meets none of
// them, but under the tall bar on example 1, where the plane above the bar (58 px at 320 px, 84 px at 360 px) holds the row of keys
// and not the colour key above it: where that key stands then is #2407.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
// a disc and a rectangle on a two-step chain: the shape s1 is there to select
const ST = { shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 1 }, { id: 's2', kind: 'rect', a: [-2, -1], b: [1, 0.5] }], steps: [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' } };
const SIZES = [[568, 320], [600, 320], [640, 360], [740, 360]];
// the states: the page's own plane or example 1's, and no bar, the selected shape's bar or the tall construction bar
const STATES = [['start', false, ''], ['example 1', true, ''], ['Edit bar', false, 'edit'], ['example 1, Edit bar', true, 'edit'], ['example 1, tall bar', true, 'tall']];
const SLACK = 0.5;            // layout rounding, px
const SETTLE_MAX = 20000;     // how long the page may take to start, the example to load and the bar to slide in, ms
// the plane's keys, the plane, the bar and the folded colour key
const geometry = () => ev(`(() => {
  const r = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; }, shown = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  const plot = document.getElementById('plotL'), bar = document.querySelector('.ph-ctx.in:not(.under)'), lg = document.getElementById('leftLegend');
  const keys = [...plot.querySelectorAll(':scope > .ph-col > .ph-key, :scope > .viewstack .vbtn')].filter(shown).map((e) => {
    const b = r(e), x = (b.l + b.r) / 2, y = (b.t + b.b) / 2, top = document.elementFromPoint(x, y);
    return { id: e.id || e.className.replace(/\\s+/g, '.'), ...b, onTop: !!top && (top === e || e.contains(top)), over: top && !(top === e || e.contains(top)) ? (top.id || top.className || top.tagName) + '' : '' };
  });
  return { cls: document.documentElement.className, plot: r(plot), bar: bar ? r(bar) : null, keys, legend: shown(lg) && lg.classList.contains('collapsed') ? r(lg) : null };
})()`);
const meets = (a, b) => a.l < b.r - SLACK && a.r > b.l + SLACK && a.t < b.b - SLACK && a.b > b.t + SLACK;
for (const [w, h] of SIZES) for (const [state, ex, bar] of STATES) {
  const tag = `${w}x${h} ${state}`;
  await view(w, h, false, true);
  const ns = 'pkr' + w + state.replace(/\W/g, '') + (Date.now() % 1000000);
  await load(ns, ST);
  await go(`${U}?ns=${ns}&view=steps`);
  await settled({ max: SETTLE_MAX, until: `typeof __cmwSteps === 'function' && typeof __cmwExample === 'function' && !!window.Phone && Phone.isOn() && !!document.querySelector('#shapeList .shape[data-id="s1"]')` });
  if (ex) {
    await ev(`(__cmwExample(1), 1)`);
    await settled({ max: SETTLE_MAX, until: '__cmwSteps().planes.length > 1 && !!document.querySelector("#shapeList .shape")' });
  }
  await ev(`(__cmwSteps({ surf: 'plane' }), 1)`);
  // (the example's message is transient: it is dismissed, as it times out on a real page)
  await ev(`(document.querySelectorAll('.toast-x').forEach((b) => b.click()), 1)`);
  if (bar === 'edit') await ev(`(__cmwSelect(document.querySelector('#shapeList .shape').dataset.id), 1)`);
  else if (bar === 'tall') await ev(`(document.querySelector('#constructTools .tool[data-tool="perp"]').click(), 1)`);
  await settled({ max: SETTLE_MAX, floor: 600, until: `!document.querySelector('.toast')${bar ? ` && !!document.querySelector('.ph-ctx.in')${bar === 'tall' ? ' && document.documentElement.classList.contains("ph-ctx-tall")' : ''}` : ''}` });
  const g = await geometry();
  info[tag] = { plot: [g.plot.t, g.plot.b].map(Math.round), bar: g.bar && Math.round(g.bar.t), keys: g.keys.map((k) => `${k.id} [${Math.round(k.l)}, ${Math.round(k.t)}, ${Math.round(k.r)}, ${Math.round(k.b)}]`) };
  ok(`${tag}: a landscape phone in the steps view`, /\bph-land\b/.test(g.cls) && /\bsv\b/.test(g.cls), g.cls);
  ok(`${tag}: the bar is ${bar ? 'open' : 'shut'}`, !!g.bar === !!bar, g.bar);
  ok(`${tag}: the plane shows its Sphere and Display keys and Fit view`, g.keys.length >= 3, g.keys.map((k) => k.id));
  const foot = g.bar ? Math.min(g.plot.b, g.bar.t) : g.plot.b;
  for (const k of g.keys) {
    ok(`${tag}: ${k.id} stands inside the plane, under its top`, k.t >= g.plot.t - SLACK && k.l >= g.plot.l - SLACK && k.r <= g.plot.r + SLACK, { key: k, plotTop: g.plot.t });
    ok(`${tag}: ${k.id} stands above the ${g.bar ? "bar's top" : "plane's foot"}`, k.b <= foot + SLACK, { key: k, foot });
    ok(`${tag}: ${k.id} is the topmost element at its centre`, k.onTop, k.over);
    if (g.legend && bar !== 'tall') ok(`${tag}: the folded colour key meets no plane key (${k.id})`, !meets(k, g.legend), { key: k, legend: g.legend });
  }
  for (let i = 0; i < g.keys.length; i++) for (let j = i + 1; j < g.keys.length; j++) ok(`${tag}: ${g.keys[i].id} and ${g.keys[j].id} do not overlap`, !meets(g.keys[i], g.keys[j]), [g.keys[i], g.keys[j]]);
}
return { pass: fails.length === 0, fails: fails.slice(0, 60), info };
