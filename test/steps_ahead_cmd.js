// The steps view's render-ahead frames (#1339): a glide from rest waits while its frames are drawn ahead off-screen, and
// then shows them, one copy a frame. z^-2 (pown's closed-form path, the inverse pass's frames) with a disc about 0,
// Everywhere, on the plane, at the fast speed; the cost at most which a motion plays live is set to 0 (ahead: { ms: 0 })
// and the wait's cap lifted, so the frames are drawn ahead on any machine:
// - made: the glide 0 -> 1 waits until every frame is made, each the inverse pass's at its place;
// - (a) the same: during that glide (SV.anim set, its clock still), frame k drawn ahead is the left pane drawn live as
//   the screen draws the glide's frame k, byte for byte, at k = 0, 1, N/2 and N-1; control: frame k+1 is not;
// - (b) cost: a frame shown from them costs at most 14 ms to draw (__cmwTime, the pane read back), and it was shown
//   from them;
// - shown: with the clock running, the glide shows its frames, and its glide record is the frame's;
// - (c) an edit drops them: the colour's sectors changed mid-glide, the next frame is drawn live;
// - live frames: the visits that make the frames ask for none (they put dirty.L and renderAsks back): at most LIVE_MAX
//   frames are drawn on the screen while the frames are made, the page's own (a program landing, a status note's
//   timer; 2 on lavapipe), not one a frame made;
// - (d) a budget of 0 bytes: the glide plays live and the live region says why, once; control: with the default budget it
//   says nothing of the kind;
// - cancel: Esc while the frames are made drops them, and no glide starts;
// - resume: Play paused on its frames and pressed again plays on at once with the same frames;
// - a hold while they are made is never kept: the zeta example, Inside regions, every pole track dropped once frames are
//   made (a frame's pole search tiny, the idle job held): the hold is met, every frame kept is the inverse pass's and the
//   live frame, and the glide starts on frames all exact, or plays live.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the exact shard (ci/browser_shards.js).
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const { holdIdle, releaseIdle } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'idle_queue.js'), 'utf8'))({ ev });
const goOk = async (url) => { if (!(await go(url))) throw new Error('no load event for ' + url); };
const FRAME_MS = 14, WAIT_MS = 120000, LIVE_MAX = 2, MEMORY = 'Playing live: the frames would not fit in memory.';
const STATE = { v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 }, sv: { speed: 'fast' },
  shapes: [{ id: 'd1', kind: 'disc', c: [0, 0], r: 0.5, ci: 0, visible: true }], steps: [{ type: 'pown', params: { n: -2 }, on: true }] };
const openState = async (tag) => {
  const ns = `${tag}${Date.now()}`;
  await goOk(`http://localhost:${PORT}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(STATE))}); 1`);
  await goOk(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  const r = await settled({ max: 60000, until: 'typeof __cmwSteps === "function" && typeof __cmwAhead === "function" && typeof __cmwTime === "function" && !!window.GLR' });
  if (!r.ok) throw new Error('the page hooks are not up after the navigation: ' + JSON.stringify(r));
};
const S = () => ev('(() => { const s = __cmwSteps(); return { x: s.x, anim: !!s.anim, moving: s.moving, ahead: s.ahead, glide: s.glide && { path: s.glide.path, b: s.glide.b, u: s.glide.u }, ready: s.ready.ready, speed: s.speed, live: (document.querySelector("#stage > .sr-only[aria-live]") || {}).textContent || null }; })()');
// at rest on plane i, everything ready
const rest = async (i) => {
  await ev(`__cmwSteps({ go: ${i}, now: true }), 1`);
  await settled({ max: 60000, until: `!__cmwSteps().moving && __cmwSteps().x === ${i} && __cmwSteps().ready.ready` });
};
// a glide to plane i from rest, its clock at clock ms a frame; resolves once it is under way (its frames made)
const glide = async (i, clock) => {
  await ev(`__cmwSteps({ clock: ${clock} }), __cmwSteps({ go: ${i} }), 1`);
  return settled({ max: WAIT_MS, until: '!!__cmwSteps().anim' });
};

await view(900, 600, false, false);
await openState('ahead');
await ev(`__cmwSet('morphPaths', false), __cmwSteps({ scope: 'all', surf: 'plane', ahead: { ms: 0, waitMs: ${WAIT_MS} } }), 1`);
await rest(0);
info.speed = (await S()).speed;

// ---- made, (a), (b) and the live frames: the glide 0 -> 1 with its clock still (1e-6 ms a frame) ----
{
  const up = await glide(1, 1e-6);
  const s = await S();
  info.made = { up: up.ok, ahead: s.ahead && Object.assign({}, s.ahead, { recs: undefined }) };
  ok('made: the glide starts', up.ok && s.anim, { up, s });
  const R = s.ahead;
  ok('made: its frames are drawn ahead, all of them', !!R && R.state === 'done' && R.n === R.N && R.N > 2, R);
  ok('made: every frame is the inverse pass\'s', !!R && R.recs.length === R.N && R.recs.every((p, k) => p === 'inverse' || k === 0), R && R.recs);
  ok(`live frames: the visits ask for no frame: at most ${LIVE_MAX} drawn on the screen while ${R ? R.N : '?'} were made`, !!R && R.live <= LIVE_MAX, R && R.live);
  if (R && R.state === 'done') {
    for (const k of [...new Set([0, 1, R.N >> 1, R.N - 1])]) {
      const c = await ev(`__cmwAhead(${k})`), x = await ev(`__cmwAhead(${Math.min(R.N - 1, k + 1)}, ${k})`), g = await S();
      info[`a k=${k}`] = { same: c, next: x };
      ok(`(a) k = ${k}: during the glide`, g.anim && g.moving, g);
      ok(`(a) k = ${k}: the live frame is the inverse pass's (or plane z's at k = 0)`, !!c && (k === 0 || (c.rec && c.rec.path === 'inverse')), c);
      ok(`(a) k = ${k}: the frame drawn ahead is the live frame, byte for byte`, !!c && c.n > 0 && c.diff === 0, c);
      if (k + 1 < R.N) ok(`(a) control k = ${k}: frame k + 1 is not`, !!x && x.n > 0 && x.diff > 0, x);
    }
    const before = (await S()).ahead.shown;
    const ms = await ev('__cmwTime(10).left'), after = (await S()).ahead;
    info.b = { ms, shown: after.shown - before };
    ok('(b) the frames drawn were shown from the frames drawn ahead', after.shown - before >= 10, info.b);
    ok(`(b) a frame shown from them costs at most ${FRAME_MS} ms`, ms > 0 && ms <= FRAME_MS, info.b);
  }
  // shown: the clock runs, a frame a 1/60 s
  await ev('__cmwSteps({ clock: 1000 / 60 }), 1');
  await settled({ max: 30000, until: '__cmwSteps().ahead && __cmwSteps().ahead.shown > 20' });
  const m = await S();
  info.shown = m.ahead && { shown: m.ahead.shown, glide: m.glide };
  ok('shown: the glide shows its frames drawn ahead as it runs', !!m.ahead && m.ahead.shown > 20, m.ahead);
  await settled({ max: 60000, until: '!__cmwSteps().moving' });
  const end = await S();
  ok('shown: the glide ends on plane 1, and its frames go', end.x === 1 && !end.ahead, end);
}

// ---- (c) an edit drops them: the glide 1 -> 0, its clock still, the colour's sectors changed ----
{
  const up = await glide(0, 1e-6);
  const s = await S();
  ok('(c) the glide starts on frames drawn ahead', up.ok && s.anim && !!s.ahead && s.ahead.state === 'done', s.ahead);
  const t0 = await ev('__cmwTime(1).left'), s0 = await S();
  ok('(c) control: before the edit, a frame is shown from them', !!s0.ahead && s0.ahead.shown > 0, s0.ahead);
  await ev("__cmwSet('sectors', 7), 1");
  const t1 = await ev('__cmwTime(1).left'), s1 = await S();
  info.c = { t0, t1, after: s1.ahead, glide: s1.glide };
  ok('(c) after the edit, the frames are dropped and the frame is drawn live, mid-glide', !s1.ahead && s1.anim && t1 > 0, info.c);
  await ev('__cmwSteps({ clock: 1000 / 60 }), 1');
  await settled({ max: 60000, until: '!__cmwSteps().moving' });
}

// ---- (d) a budget of 0 bytes: live, said once; control: the default budget said nothing ----
{
  await rest(0);
  const said0 = info.made && (await S()).live;
  ok('(d) control: with the default budget the live region does not say the glide plays live', !String(said0 || '').startsWith('Playing live'), said0);
  await ev('__cmwSteps({ ahead: { cap: 0 } }), 1');
  const up = await glide(1, 1e-6);
  const s = await S();
  info.d = { live: s.live, ahead: s.ahead };
  // (after (c)'s edit the chain's frame cost is measured again: its probe frames are dropped once the budget is read)
  ok('(d) a budget of 0: the glide plays live for want of memory, with no frame held', up.ok && s.anim && (!s.ahead || (s.ahead.state === 'live' && s.ahead.why === 'memory' && s.ahead.slots === 0)), info.d);
  ok('(d) the live region says why: memory', s.live === MEMORY, s.live);
  await ev('__cmwSteps({ clock: 1000 / 60 }), 1');
  await settled({ max: 60000, until: '!__cmwSteps().moving' });
  await glide(0, 1e-6);
  const again = await S();
  info.dAgain = { live: again.live, ahead: again.ahead };
  ok('(d) the second glide does not say it again', !String(again.live || '').includes(MEMORY), info.dAgain);
  ok('(d) the second glide decides at once from the chain\'s measured cost: no probe frame', again.anim && !again.ahead, info.dAgain);
  await ev('__cmwSteps({ clock: 1000 / 60, ahead: { cap: null } }), 1');
  await settled({ max: 60000, until: '!__cmwSteps().moving' });
}

// ---- Cancel (Esc) while the frames are made: they go, and no glide starts ----
{
  await rest(0);
  await ev('__cmwSteps({ clock: 1e-6 }), __cmwSteps({ go: 1 }), 1');
  const filling = await settled({ max: WAIT_MS, until: '(() => { const a = __cmwSteps().ahead; return !!a && a.n >= 1 && a.state === "fill"; })()' });
  await ev('(document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })), 1)');
  const at = await S();
  await ev('new Promise((r) => setTimeout(() => r(1), 1000))');
  const later = await S();
  info.cancel = { filling: filling.ok, at: at.ahead, later: { anim: later.anim, ahead: later.ahead, x: later.x } };
  ok('cancel: Esc while the frames are made drops them', filling.ok && !at.ahead, info.cancel);
  ok('cancel: no glide starts, and no frame is made afterwards', !later.anim && !later.ahead && later.x === 0, info.cancel);
}

// ---- Play paused on its frames and pressed again goes on with the same schedule and frames, with no new wait ----
{
  await rest(0);
  await ev('__cmwSteps({ clock: 1e-6 }), __cmwSteps({ play: true }), 1');
  const up = await settled({ max: WAIT_MS, until: '__cmwSteps().play === "glide"' });
  await settled({ max: 30000, until: '!!__cmwSteps().ahead && __cmwSteps().ahead.shown > 0' });
  const a0 = (await S()).ahead;
  await ev('__cmwSteps({ play: false }), 1');
  const paused = await S();
  await ev('__cmwSteps({ play: true }), 1');
  const again = await S();
  await settled({ max: 30000, until: `!!__cmwSteps().ahead && __cmwSteps().ahead.shown > ${a0 ? a0.shown : 0}` });
  const a1 = (await S()).ahead;
  info.resume = { up: up.ok, a0, paused: { x: paused.x, ahead: paused.ahead && paused.ahead.state }, again: again.ahead && again.ahead.state, a1 };
  ok('resume: the play runs on frames drawn ahead', up.ok && !!a0 && a0.state === 'done' && a0.shown > 0, info.resume);
  ok('resume: paused, its frames stay', !!paused.ahead && paused.ahead.state === 'done', info.resume);
  ok('resume: pressed again, it plays at once on the same frames (none made again)', !!a1 && a1.state === 'done' && a1.n === a0.n && a1.costs.join() === a0.costs.join() && a1.shown > a0.shown, info.resume);
  await ev('__cmwSteps({ clock: 1000 / 60 }), 1');
  await settled({ max: 60000, until: '!__cmwSteps().moving' });
}

// ---- a hold while the frames are made is never kept: the zeta example (its glide's Newton ops draw from pole tracks),
// Inside regions; once a frame is made, every pole track dropped and a frame's own pole search all but nothing, with the
// page's idle moments held (lib/idle_queue.js) so the idle job does not make the tracks again ----
{
  const ex = exampleNames().indexOf('Zeros of the zeta function');
  ok('hold: the zeta example is found', ex >= 0, ex);
  await goOk(`http://localhost:${PORT}/test.html?ns=aheadz${Date.now()}&lang=en&view=steps`);
  await settled({ max: 60000, until: 'typeof __cmwExample === "function" && typeof __cmwSteps === "function" && typeof __cmwAhead === "function" && !!window.GLR' });
  await ev(`__cmwExample(${ex}), 1`);
  await ev(`__cmwSteps({ scope: 'in', ahead: { ms: 0, waitMs: ${WAIT_MS} } }), 1`);
  await rest(0);
  await settled({ max: 120000, until: 'GLR.pendingLinks === 0 && __cmwSteps().ready.ready' });
  await holdIdle();
  await ev('__cmwSteps({ clock: 1e-6 }), __cmwSteps({ go: 1 }), 1');
  const made = await settled({ max: WAIT_MS, until: '(() => { const a = __cmwSteps().ahead; return !!a && a.n >= 2; })()' });
  await ev('__cmwSteps({ poleFrameMs: 0.001, dropTracks: true }), 1');
  const met = await settled({ max: WAIT_MS, until: '(() => { const a = __cmwSteps().ahead; return !a || a.rejects > 0 || a.state !== "probe" && a.state !== "fill"; })()' });
  const R = (await S()).ahead;
  info.hold = { made: made.ok, met: met.ok, ahead: R };
  ok('hold: the hold is met while the frames are made (a frame drawn is not kept)', !!R && R.rejects > 0, R);
  ok('hold: every frame kept is the inverse pass\'s', !!R && R.recs.length === R.n && R.n >= 2 && R.recs.every((p, k) => p === 'inverse' || k === 0), R && R.recs);
  if (R && R.state !== 'live') for (const k of [1, R.n - 1]) {
    const c = await ev(`__cmwAhead(${k})`);
    ok(`hold: frame ${k} kept is the live frame, byte for byte`, !!c && c.n > 0 && c.diff === 0, c);
  }
  await releaseIdle();
  const up = await settled({ max: WAIT_MS, until: '!!__cmwSteps().anim' });
  const s = await S();
  info.holdEnd = { up: up.ok, ahead: s.ahead && { state: s.ahead.state, why: s.ahead.why, n: s.ahead.n, N: s.ahead.N, rejects: s.ahead.rejects }, live: s.live };
  ok('hold: the glide starts, on frames all exact or live', up.ok && !!s.ahead && (s.ahead.state === 'done' || (s.ahead.state === 'live' && s.ahead.why === 'exact')), info.holdEnd);
  await ev('__cmwSteps({ clock: 1000 / 60, poleFrameMs: null }), 1');
  await settled({ max: WAIT_MS, until: '!__cmwSteps().moving' });
}
await ev('__cmwSteps({ clock: 0, ahead: { ms: null, waitMs: null, cap: null } }), 1');
return { pass: fails.length === 0, fails, info };
