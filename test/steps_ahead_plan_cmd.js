// The render-ahead plan across the gallery (#2387): svAheadPlan decides from a chain's measured frame cost c, a motion's frame
// count N = ceil(ms / AHEAD_DT) and the pane's frame size: at most AHEAD_MS a frame, 'live'; c · N past AHEAD_WAIT_MAX_MS,
// 'time'; N frames past the memory budget, 'memory'; else 'ahead'. A map whose numbers sit near a limit may be drawn ahead on
// one machine and play live on another. This suite reads the decision and its inputs (__cmwSteps().aheadPlan, for each speed
// over one and over two planes) after a chain's probe, for a few gallery maps and the z^-2 scene of steps_ahead_cmd, and
// writes each map's numbers in info.table (and, in info.near, the maps within NEAR of a limit):
// - measured: the chain's probe ended with a cost;
// - rule: every row's decision is the rule applied to the row's own inputs (cost, N, frame size, the three limits);
// - said: a glide from rest at the page's speed says why it plays live, once (the live region's words), when its plan is 'time' or
//   'memory'; with the plan 'live' it says nothing; with 'ahead' it says the draw wait's why exactly when its fill (which times
//   itself) ended cut for time, by the fill's own record; a second glide says the draw wait's why exactly when the first was silent and its plan is 'time' or its fill ends cut for time;
// - cut: such a fill ends within the draw wait and a frame of its start, and its glide started within that of the press.
// info.glide has each map's estimate (cost times frames) beside the wait it made and its fill's record (each frame's ms).
// - the fill times itself (z^-2 at normal speed): a fill is drawn whole first, with a draw wait that holds, to see what it takes (its frames
//   are not fenced to the GPU as the probe's are, so it may be far faster than the probe's cost says); then the chain's cost is seeded
//   far under the fill's rate, so it plans 'ahead', and the draw wait is a quarter of the fill's time. The fill, which projects its end
//   at the rate so far, is cut for time at its 6th to 11th frame and says why once; its chain's cost is raised to at least that fill's own
//   rate and the chain then plans live; the next glide starts at once and says nothing more. A fill made whole feeds as well: a cost far over
//   its rate stays, one far under it comes to its rate. Each fill is judged by its own rate (read from its record), as fills of one chain
//   differ by a factor of two on a fast machine.
//   Forced: a first glide whose fill ran whole is silent and feeds its cost; with the draw wait then lowered to a quarter of that fill's time the
//   plan of the chain is 'time', and the second glide says the draw wait's why, once, and plays live at once.
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
// the wait a glide made is timed from outside the page, after the press, so it reads a few ms short of the page's own (its fill's cap)
const WAIT_SLACK_MS = 250;
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

// at rest on plane i, everything ready
const rest = async (i) => {
  await ev(`__cmwSteps({ go: ${i}, now: true }), 1`);
  await settled({ only: true, max: WAIT_MS, until: `!__cmwSteps().moving && __cmwSteps().x === ${i} && __cmwSteps().ready.ready` });
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
    const A = await ev('__cmwSteps().ahead');
    info.glide = Object.assign(info.glide || {}, { [tag]: { plan: row.plan, estimateMs: row.fillMs, waitedMs: Math.round(up.ms), said: said1.length, fill: A && { state: A.state, why: A.why, n: A.n, N: A.N, fillMs: A.fillMs, frameMs: A.frameMs } } });
    const sayMemory = said1.some((t) => t.includes(MEMORY)), sayTime = said1.some((t) => t.includes(TIME));
    // the fill's own record (it times itself): cut because its frames would end past the draw wait
    const cut = !!A && A.state === 'live' && A.why === 'time', maxFrame = Math.max(0, ...((A && A.frameMs) || []));
    // 'time' and 'memory' say why, once. A plan of 'ahead' says 'time' exactly when its fill ended cut for time; 'live' and 'ahead' never say 'memory'.
    const okSaid = row.plan === 'time' ? said1.length === 1 && sayTime
      : row.plan === 'memory' ? said1.length === 1 && sayMemory
      : !sayMemory && said1.length === (row.plan === 'ahead' && cut ? 1 : 0) && sayTime === (row.plan === 'ahead' && cut);
    ok(`${tag}: said: at ${m.speed}, one plane, the plan is ${row.plan}: it says why once when that is 'time' or 'memory'; an 'ahead' says the draw wait's why exactly when its fill ended cut for time; never the memory's why otherwise`, okSaid, { plan: row.plan, said1, fill: A && { state: A.state, why: A.why, n: A.n } });
    if (row.plan === 'ahead') {
      // (the fill's own clock: from its start to its end, the cap and a frame at most; the press to the glide under way, timed from outside the page
      // and counting the wait for the chain to be ready, a little looser)
      ok(`${tag}: cut: an 'ahead' fill that ended cut did so within the draw wait and a frame of its start, and the glide started within that and the test's slack of the press`,
        !cut || (A.fillMs <= P.waitMs + maxFrame && up.ms <= P.waitMs + maxFrame + WAIT_SLACK_MS), { fillMs: A && A.fillMs, maxFrame, waitMs: P.waitMs, pressMs: up.ms });
    }
    const plan2 = await ev(`(() => { const P = __cmwSteps().aheadPlan; const r = P && P.rows.find((x) => x.speed === ${JSON.stringify(m.speed)} && x.planes === 1); return r ? r.plan : null; })()`);
    await ev('__cmwSteps({ clock: 1000 / 60, go: 1 }), 1');
    await settled({ only: true, max: WAIT_MS, until: '!__cmwSteps().moving && __cmwSteps().x === 1' });
    const B = await ev('__cmwSteps().ahead');
    const said2 = (await ev('__live')).filter((t) => t.includes(SAID));
    // a reason is said once for a chain: a first glide that said it leaves the second silent. One that was silent (an 'ahead' whose fill ran whole,
    // which fed its cost) leaves a second that says the draw wait's why, once, exactly when its plan is now 'time' or its own fill ends cut for time
    const second = said2.slice(said1.length), cutB = !!B && B.state === 'live' && B.why === 'time';
    const want = said1.length === 0 && (plan2 === 'time' || cutB) ? 1 : 0;
    if (plan2 !== 'memory') ok(`${tag}: said: a second glide says the draw wait's why exactly when the first was silent and its plan is 'time' or its fill ends cut for time, once`, second.length === want && (want === 0 || second[0].includes(TIME)), { said1: said1.length, second, plan2, cutB, fill: B && { state: B.state, why: B.why, n: B.n } });
  } catch (e) {
    ok(`${what.name}: ran`, false, String(e && e.message || e).slice(0, 400));
  }
}

// ---- the fill times itself (the z^-2 scene, normal speed): a fill is drawn first, whole, to see what it takes (the probe's fenced median says
// what a frame costs with the GPU waited for, which a fill does not); then the chain's cost is seeded far under the fill's rate, so the
// plan says 'ahead', and the draw wait is half the fill's time ----
if (!ALL) {
  try {
    await open({ scene: SCENE });
    const m = await measure(1);
    const c = m.plan.cost, N = 54;
    const tune = (cost, wait) => ev(`__cmwSteps({ ahead: { ms: 0, cost: ${cost}, waitMs: ${wait} } }), 1`);
    const planOf = () => ev('(() => { const P = __cmwSteps().aheadPlan; return P && P.rows.find((r) => r.speed === "normal" && r.planes === 1).plan; })()');
    const press = async (to) => {
      await ev(WATCH);
      await ev(`__cmwSteps({ clock: 1000 / 60, go: ${to} }), 1`);
      const up = await settled({ only: true, max: WAIT_MS, until: '!!__cmwSteps().anim || !__cmwSteps().moving' });
      await settled({ only: true, max: WAIT_MS, until: `!__cmwSteps().moving && __cmwSteps().x === ${to}` });
      const said = (await ev('__live')).filter((t) => t.includes(SAID));
      return { ms: up.ms, said, fill: await ev('__cmwSteps().ahead'), cost: await ev('__cmwSteps().aheadCost') };
    };
    // a draw wait that holds: the glide (its clock still) is drawn ahead whole and shown; its fill's time is read while it is under way
    await tune(c / 4, WAIT_MS);
    await rest(0);
    await ev(WATCH);
    await ev('__cmwSteps({ clock: 1e-6 }), __cmwSteps({ go: 1 }), 1');
    const under = await settled({ only: true, max: WAIT_MS, until: '!!__cmwSteps().anim' });
    await settled({ only: true, max: WAIT_MS, until: '((__cmwSteps().ahead || {}).shown || 0) > 0' });
    const d = { ms: under.ms, fill: await ev('__cmwSteps().ahead'), said: (await ev('__live')).filter((t) => t.includes(SAID)) };
    await ev('__cmwSteps({ clock: 1000 / 60 }), 1');
    await settled({ only: true, max: WAIT_MS, until: '!__cmwSteps().moving && __cmwSteps().x === 1' });
    ok('cut: control: with a draw wait that holds, the fill is made whole and its frames are shown', !!d.fill && d.fill.state === 'done' && d.fill.n === d.fill.N && d.fill.shown > 0 && d.fill.fillMs > 0, d.fill);
    ok('cut: control: it says nothing of the kind', d.said.length === 0, d.said);
    // the fill's rate (its first frame's one-time costs left out) and the wait that is a quarter of its time (fills of the same chain differ
    // by a factor of two on a fast machine: the next fill's projection is still over the wait); each later fill is judged by its own rate
    const rate = (d.fill.fillMs - d.fill.frameMs[0]) / (d.fill.N - 1), waitMs = Math.round(d.fill.fillMs / 4);
    await tune(rate / 8, waitMs);
    ok('cut: seeded under the fill\'s rate the chain plans ahead', (await planOf()) === 'ahead', { c, rate, seeded: rate / 8, waitMs });
    const a = await press(0);
    info.cut = { c, rate, waitMs, d, a };
    // (by the fill's own record: a fast fill makes the wait short, and the press to the glide under way is mostly the page's fixed overhead)
    const maxFrame = Math.max(0, ...((a.fill && a.fill.frameMs) || []));
    ok('cut: the fill is cut for time at its 6th to 11th frame, within the draw wait and a frame of its start', !!a.fill && a.fill.state === 'live' && a.fill.why === 'time' && a.fill.n >= 6 && a.fill.n < 12 && a.fill.fillMs <= waitMs + maxFrame, { fill: a.fill && { state: a.fill.state, why: a.fill.why, n: a.fill.n, N: a.fill.N, fillMs: a.fill.fillMs }, waitMs, maxFrame });
    ok('cut: the glide is under way within the draw wait and the test\'s slack of the press', a.ms < waitMs + WAIT_SLACK_MS, { pressMs: a.ms, waitMs });
    ok('cut: it says why once', a.said.length === 1 && a.said[0].includes(TIME), a.said);
    ok('cut: a cut feeds: the chain\'s cost is raised to at least that fill\'s own rate, and it plans live', !!a.fill && a.cost >= a.fill.rate - 0.01 && (await planOf()) === 'time', { cost: a.cost, fillRate: a.fill && a.fill.rate });
    const b = await press(1);
    info.cut.b = b;
    ok('cut: the next glide of the chain starts within 300 ms, with no wait', b.ms < 300, b.ms);
    ok('cut: and says nothing more', b.said.length === 0, b.said);
    // a fill that is made whole feeds too, by what it found, read during its glide (its clock still) so that each is judged by its own rate:
    // it never lowers the chain's cost (seeded far over any fill's rate, it stays) and raises it to the fill's rate (seeded far under it, it
    // comes to that rate, not to the probe's cost); with no draw wait that could cut it
    const whole = async (to, seed) => {
      await tune(seed, 1e9);
      await ev(WATCH);
      await ev(`__cmwSteps({ clock: 1e-6 }), __cmwSteps({ go: ${to} }), 1`);
      await settled({ only: true, max: WAIT_MS, until: '!!__cmwSteps().anim' });
      await settled({ only: true, max: WAIT_MS, until: '((__cmwSteps().ahead || {}).shown || 0) > 0' });
      const fill = await ev('__cmwSteps().ahead');
      await ev('__cmwSteps({ clock: 1000 / 60 }), 1');
      await settled({ only: true, max: WAIT_MS, until: `!__cmwSteps().moving && __cmwSteps().x === ${to}` });
      return { fill, said: (await ev('__live')).filter((t) => t.includes(SAID)), cost: await ev('__cmwSteps().aheadCost') };
    };
    const e = await whole(0, 20 * rate), g = await whole(1, rate / 8);
    info.cut.e = e; info.cut.g = g;
    const ran = (x) => !!x.fill && x.fill.state === 'done' && x.fill.n === x.fill.N;
    ok('cut: a fill made whole leaves a cost far over its rate unchanged', ran(e) && Math.abs(e.cost - 20 * rate) < 0.01, { cost: e.cost, seeded: 20 * rate, fill: e.fill && { state: e.fill.state, n: e.fill.n, rate: e.fill.rate } });
    ok('cut: a fill made whole raises a cost far under its rate to that fill\'s own rate', ran(g) && g.cost >= g.fill.rate - 0.001 && g.cost <= g.fill.rate + 0.011, { cost: g.cost, fill: g.fill && { state: g.fill.state, n: g.fill.n, rate: g.fill.rate } });
    // forced: a first glide whose fill ran whole is silent and feeds its cost; with the draw wait then lowered to a quarter of that fill's time
    // (a probe that had said the chain cheap, and a fill that shows it dearer), the plan of the same chain is 'time' and the second glide says why, once, and plays live at once
    // (on a page of its own: a reason is said once for a chain, and this chain's was said above)
    await open({ scene: SCENE });
    await measure(1);
    const f1 = await whole(0, rate / 8);
    await ev(`__cmwSteps({ ahead: { waitMs: ${Math.round(f1.fill.fillMs / 4)} } }), 1`);
    const plan2 = await planOf();
    const f2 = await press(1);
    info.cut.forced = { f1: { rate: f1.fill.rate, fillMs: f1.fill.fillMs, said: f1.said.length }, plan2, f2 };
    ok('cut: forced: the first glide, its fill made whole, is silent', ran(f1) && f1.said.length === 0, { said: f1.said, fill: f1.fill && { state: f1.fill.state, n: f1.fill.n } });
    ok('cut: forced: its cost fed, the plan of the chain at the lowered draw wait is time', plan2 === 'time', plan2);
    ok('cut: forced: the second glide says the draw wait\'s why once and plays live at once', f2.said.length === 1 && f2.said[0].includes(TIME) && f2.ms < 300, { said: f2.said, ms: f2.ms });
  } catch (e) {
    ok('cut: ran', false, String(e && e.message || e).slice(0, 400));
  }
}
info.table = table;
info.near = table.filter((t) => t.near && t.near.length).map((t) => `${t.name} @${t.rate}x: ${t.near.join(', ')}`);
return { pass: fails.length === 0, fails, info };
