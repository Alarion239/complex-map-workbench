// The render-ahead plan across the gallery (#2387): svAheadPlan decides from a chain's measured frame cost c, a motion's frame
// count N = ceil(ms / AHEAD_DT) and the pane's frame size: at most AHEAD_MS a frame, 'live'; c · N past AHEAD_WAIT_MAX_MS,
// 'time'; N frames past the memory budget, 'memory'; else 'ahead'. A map whose numbers sit near a limit may be drawn ahead on
// one machine and play live on another. This suite reads the decision and its inputs (__cmwSteps().aheadPlan, for each speed
// over one and over two planes) after a chain's probe, for a few gallery maps and the z^-2 scene of steps_ahead_cmd, and
// writes each map's numbers in info.table (and, in info.near, the maps within NEAR of a limit):
// - measured: the chain's probe ended with a cost;
// - rule: every row's decision is the rule applied to the row's own inputs (cost, N, frame size, the three limits);
// - said: a glide from rest at the page's speed says why it plays live, once (the live region's words), when its plan is 'time' or
//   'memory'; with the plan 'live' it says nothing, and with 'ahead' it says only the draw wait's why, after waiting at least that long (the
//   fill's own cap); a second glide says nothing more. info.glide has each map's estimate (cost times frames) beside the wait it made.
// It asserts nothing about which side of a limit a map lands on: that depends on the machine. Run with CMW_AHEAD_PLAN_ALL=1 the
// suite measures the whole gallery, at the page's device pixel ratio (CMW_DPR) and at each CPU slowing in
// CMW_AHEAD_PLAN_RATES (a list such as '1,4', by default 1; Emulation.setCPUThrottlingRate slows the page's thread, not the GPU
// process, where lavapipe draws, so a rate of 4 is not a device four times slower) and, in CMW_AHEAD_PLAN_RANGE ('from-to', the gallery's
// indices; 0 is the z^-2 scene), the maps it measures; it asserts nothing but that it measured.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return !!cond; };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const goOk = async (url) => { if (!(await go(url))) throw new Error('no load event for ' + url); };
const ALL = !!process.env.CMW_AHEAD_PLAN_ALL, RANGE = (process.env.CMW_AHEAD_PLAN_RANGE || '0-99').split('-').map(Number), RATES = ALL ? (process.env.CMW_AHEAD_PLAN_RATES || '1').split(',').map(Number) : [1];
// (a window in which the steps view lays the pane out at about 870 x 560; a window of 900 x 600 leaves a strip 36 px high)
const VIEW_W = 1200, VIEW_H = 800, WAIT_MS = 120000, PROBE_WAIT_MS = 30000, NEAR = 0.2;
// the gallery maps the gated rows read (by name): one of the dearest frames and two of the cheapest, which a machine
// with another speed puts at the other side of the draw wait's limit
const GATED = ['Strip to disk', 'Cauchy: an essential singularity', 'A disc map moved by a point'];
const SCENE = { v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 },
  shapes: [{ id: 'd1', kind: 'disc', c: [0, 0], r: 0.5, ci: 0, visible: true }], steps: [{ type: 'pown', params: { n: -2 }, on: true }] };
const MEMORY = 'The glide draws as it goes: its frames would not fit in memory.', TIME = 'The glide draws as it goes: its frames would take too long to prepare.';
const SAID = 'The glide draws as it goes';
// every text the steps view's live region says, from now on, in window.__live (the observer is set once, a second call only empties the list)
const WATCH = `(() => { window.__live = []; if (window.__liveWatch) return 1; const el = document.querySelector('#stage > .sr-only[aria-live]'); window.__liveWatch = new MutationObserver(() => __live.push(el.textContent)); window.__liveWatch.observe(el, { childList: true, characterData: true, subtree: true }); return 1; })()`;
const READY = '!__cmwSteps().moving && __cmwSteps().ready.ready';
const HOOKS = 'typeof __cmwSteps === "function" && typeof __cmwExample === "function" && !!window.GLR';

// the page, opened on the scene (a saved state) or on gallery example i
const open = async (what) => {
  const ns = `aheadplan${Date.now() % 1e9}`;
  await view(VIEW_W, VIEW_H, false, false);
  if (what.scene) {
    await goOk(`http://localhost:${PORT}/gl-helpers.html`);
    await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(what.scene))}); 1`);
  }
  await goOk(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  const up = await settled({ only: true, max: 60000, until: HOOKS });
  if (!up.ok) throw new Error('the page hooks are not up: ' + JSON.stringify(up));
  if (what.example != null) await ev(`__cmwExample(${what.example}), 1`);
  const r = await settled({ only: true, max: WAIT_MS, until: READY });
  if (!r.ok) throw new Error('the chain is not ready: ' + JSON.stringify(r.busy || r));
};
// the gallery's maps: [index, name] by __cmwExample's order (0, the empty canvas, is no map)
const gallery = () => exampleNames().map((n, i) => [i, n]).filter(([i]) => i > 0);
// the chain's first glide (0 -> 1) plays live, and its probe measures the frame cost -> { plan: __cmwSteps().aheadPlan, probe }
const measure = async (rate) => {
  await ev(WATCH);
  await send('Emulation.setCPUThrottlingRate', { rate });
  try {
    await ev('__cmwSteps({ clock: 1000 / 60, go: 1 }), 1');
    await settled({ only: true, max: WAIT_MS, until: '!__cmwSteps().moving' });
    await settled({ only: true, max: PROBE_WAIT_MS, until: '(() => { const p = __cmwSteps().aheadProbe; return !!p && p.state !== "waiting" && p.state !== "drawing"; })()' });
  } finally { await send('Emulation.setCPUThrottlingRate', { rate: 1 }); }
  return ev('({ plan: __cmwSteps().aheadPlan, probe: __cmwSteps().aheadProbe, speed: __cmwSteps().speed })');
};
// the plan's rule, applied to a row's own inputs (svAheadPlan's)
const rule = (P, row) => (P.cost <= P.liveMs ? 'live' : P.cost * row.N > P.waitMs ? 'time' : row.bytes > P.budget ? 'memory' : 'ahead');
// how close a row is to each limit (1 is on it) and whether one is within NEAR
const margins = (P, row) => ({ live: +(P.cost / P.liveMs).toFixed(2), time: +(row.fillMs / P.waitMs).toFixed(2), memory: +(row.bytes / P.budget).toFixed(2) });
const nearOf = (P, row) => Object.entries(margins(P, row)).filter(([, v]) => Math.abs(v - 1) <= NEAR).map(([k]) => k);

const table = [];
const record = (name, rate, m) => {
  const P = m.plan, dpr = P && P.dpr;
  if (!P) { table.push({ name, rate, dpr, cost: null, probe: m.probe && { state: m.probe.state, why: m.probe.why } }); return; }
  const cell = (r) => `${r.plan} N${r.N} t${margins(P, r).time} m${margins(P, r).memory}${nearOf(P, r).length ? ' NEAR ' + nearOf(P, r).join('+') : ''}`;
  const rows = {};
  for (const r of P.rows) rows[`${r.speed}/${r.planes}`] = cell(r);
  table.push({ name, rate, dpr, cost: +P.cost.toFixed(1), frame: `${P.pw}x${P.ph}`, rows, near: P.rows.filter((r) => nearOf(P, r).length).map((r) => `${r.speed}/${r.planes}:${nearOf(P, r).join('+')}`) });
};

const maps = ALL ? gallery() : null;
const todo = ALL ? [{ name: 'z^-2 scene (steps_ahead_cmd)', scene: SCENE, i: 0 }, ...maps.map(([i, name]) => ({ name: `${i} ${name}`, example: i, i }))].filter((w) => w.i >= RANGE[0] && w.i <= RANGE[1]) : null;
let wanted = null;
if (!ALL) {
  const all = gallery();
  wanted = GATED.map((n) => all.find(([, name]) => name === n)).filter(Boolean);
  ok('gated maps: every named gallery map is in the gallery', wanted.length === GATED.length, GATED.filter((n) => !all.some(([, name]) => name === n)));
}
const list = ALL ? todo : [{ name: 'z^-2 scene (steps_ahead_cmd)', scene: SCENE }, ...wanted.map(([i, name]) => ({ name: `${i} ${name}`, example: i }))];
for (const rate of RATES) for (const what of list) {
  try {
    await open(what);
    const m = await measure(rate);
    record(what.name, rate, m);
    if (ALL) { ok(`${what.name} at ${rate}x: measured (a probe ran)`, true); continue; }
    const P = m.plan;
    const tag = what.name;
    ok(`${tag}: measured: the chain's probe ended with a cost`, !!P && m.probe && m.probe.state === 'done' && P.cost > 0, m.probe);
    if (!P) continue;
    ok(`${tag}: rule: each row's decision is the rule applied to its own inputs`, P.rows.length === 8 && P.rows.every((r) => r.plan === rule(P, r)), P.rows.filter((r) => r.plan !== rule(P, r)));
    ok(`${tag}: rule: the frame count is ceil(ms / (1000 / 60)) and the bytes are N frames of the pane's size`, P.rows.every((r) => r.N === Math.ceil(r.ms / (1000 / 60)) && r.bytes === r.N * P.pw * P.ph * 4), P.rows.slice(0, 2));
    // a glide from rest at the page's speed over one plane (back to plane 0): what it says, how long it waited for its frames; then a second one
    const row = P.rows.find((r) => r.speed === m.speed && r.planes === 1);
    await ev(WATCH);
    await ev('__cmwSteps({ clock: 1000 / 60, go: 0 }), 1');
    const up = await settled({ only: true, max: WAIT_MS, until: '!!__cmwSteps().anim || !__cmwSteps().moving' });
    await settled({ only: true, max: WAIT_MS, until: '!__cmwSteps().moving && __cmwSteps().x === 0' });
    const said1 = (await ev('__live')).filter((t) => t.includes(SAID));
    info.glide = Object.assign(info.glide || {}, { [tag]: { plan: row.plan, estimateMs: row.fillMs, waitedMs: Math.round(up.ms), said: said1.length } });
    const sayMemory = said1.some((t) => t.includes(MEMORY)), sayTime = said1.some((t) => t.includes(TIME));
    // 'time' and 'memory' say why, once. A plan of 'ahead' may still say 'time': the fill is cut off at the draw wait's cap, which the
    // estimate (the cost times the frames) may fall short of; then the glide waited at least that long. 'live' and 'ahead' never say 'memory'.
    const okSaid = row.plan === 'time' ? said1.length === 1 && sayTime
      : row.plan === 'memory' ? said1.length === 1 && sayMemory
      : !sayMemory && (said1.length === 0 || (said1.length === 1 && sayTime && row.plan === 'ahead' && up.ms >= P.waitMs));
    ok(`${tag}: said: at ${m.speed}, one plane, the plan is ${row.plan}: it says why once when that is 'time' or 'memory', never the memory's why otherwise, and the draw wait's why only after waiting for it`, okSaid, { plan: row.plan, said1, waitedMs: up.ms, waitMs: P.waitMs });
    await ev('__cmwSteps({ clock: 1000 / 60, go: 1 }), 1');
    await settled({ only: true, max: WAIT_MS, until: '!__cmwSteps().moving && __cmwSteps().x === 1' });
    const said2 = (await ev('__live')).filter((t) => t.includes(SAID));
    ok(`${tag}: said: a second glide says nothing more`, said2.length === said1.length, { said1: said1.length, said2: said2.length });
  } catch (e) {
    ok(`${what.name}: ran`, false, String(e && e.message || e).slice(0, 400));
  }
}
info.table = table;
info.near = table.filter((t) => t.near && t.near.length).map((t) => `${t.name} @${t.rate}x: ${t.near.join(', ')}`);
return { pass: fails.length === 0, fails, info };
