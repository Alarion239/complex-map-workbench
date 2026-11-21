// The steps view's render-ahead frames (#1339): a glide from rest waits while its frames are drawn ahead off-screen, and
// then shows them, one copy a frame. z^-2 (pown's closed-form path, the inverse pass's frames) with a disc about 0,
// Everywhere, on the plane, at the fast speed; the cost at most which a motion plays live is set to 0 (ahead: { ms: 0 })
// and the wait's cap lifted, so the frames are drawn ahead on any machine:
// - first: the chain's first motion starts at once, with no wait (its cost is not known: the base's glide), and its frame
//   cost is measured after it ends, in idle moments;
// - made: the next glide 0 -> 1 waits until every frame is made, each the inverse pass's at its place;
// - (a) the same: during that glide (SV.anim set, its clock still), frame k drawn ahead is the left pane drawn live as
//   the screen draws the glide's frame k, byte for byte, at k = 0, 1, N/2 and N-1; control: frame k+1 is not;
// - (b) cost: a frame shown from them costs at most 14 ms to draw (__cmwTime, the pane read back), and it was shown
//   from them;
// - shown: with the clock running, the glide shows its frames, and they go at its end;
// - live frames: the visits that make the frames ask for none (they put dirty.L and renderAsks back): at most LIVE_MAX
//   frames are drawn on the screen while the frames are made, the page's own (a program landing, a status note's
//   timer; 2 on lavapipe), not one a frame made;
// - (d) a budget of 0 bytes: the glide plays live at once and says why once, after the plane's label it arrives at
//   ("<label>. The glide draws as it goes: …"); control: with the default budget it says nothing of the kind;
// - play: a Play (no loop) that plays live for time says why after the words of its stop, which stay, with a full stop;
// - cancel: Esc while the frames are made drops them, and no glide starts;
// - resume: Play paused on its frames and pressed again plays on at once with the same frames;
// - (c) an edit drops them: the colour's sectors changed mid-glide, the next frame is drawn live;
// - a hold while they are made is never kept: the zeta example, Inside regions, every pole track dropped once frames are
//   made (a frame's pole search tiny, the idle job held): the hold is met, every frame kept is the inverse pass's and the
//   live frame, and the glide starts on frames all exact, or plays live.
// Every wait is on a state the page reaches (settled's only: the page is not asked to be quiet, which it is not while frames
// are made or a glide runs).
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the exact shard (ci/browser_shards.js).
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return !!cond; };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const { holdIdle, releaseIdle } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'idle_queue.js'), 'utf8'))({ ev });
const goOk = async (url) => { if (!(await go(url))) throw new Error('no load event for ' + url); };
const FRAME_MS = 14, WAIT_MS = 120000, LIVE_MAX = 2, STILL_MS = 250, STILL_TRIES = 40, PRIME_CLOCK_MS = 200;
// the hold section's cap on the frames' wait (ahead.waitMs): past any count of the zeta chain's frames at any cost, so its plan
// draws them ahead however slow a frame is (the section tests the hold, not the cap; WAIT_MS bounds each of its waits)
const HOLD_WAIT_CAP_MS = 1e9;
const MEMORY = 'The glide draws as it goes: its frames would not fit in memory.', TIME = 'The glide draws as it goes: its frames would take too long to prepare.';
// every text the steps view's live region says, from now on, in window.__live
const WATCH = `(() => { window.__live = []; const el = document.querySelector('#stage > .sr-only[aria-live]'); new MutationObserver(() => __live.push(el.textContent)).observe(el, { childList: true, characterData: true, subtree: true }); return 1; })()`;
const STATE = { v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 }, sv: { speed: 'fast' },
  shapes: [{ id: 'd1', kind: 'disc', c: [0, 0], r: 0.5, ci: 0, visible: true }], steps: [{ type: 'pown', params: { n: -2 }, on: true }] };
const openState = async (tag) => {
  const ns = `${tag}${Date.now()}`;
  await goOk(`http://localhost:${PORT}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(STATE))}); 1`);
  await goOk(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  const r = await settled({ only: true, max: 60000, until: 'typeof __cmwSteps === "function" && typeof __cmwAhead === "function" && typeof __cmwTime === "function" && !!window.GLR' });
  if (!r.ok) throw new Error('the page hooks are not up after the navigation: ' + JSON.stringify(r));
};
const S = () => ev('(() => { const s = __cmwSteps(); return { x: s.x, anim: !!s.anim, moving: s.moving, ahead: s.ahead, glide: s.glide && { path: s.glide.path, b: s.glide.b, u: s.glide.u }, ready: s.ready.ready, speed: s.speed, cost: s.aheadCost, probe: s.aheadProbe, play: s.play, live: (document.querySelector("#stage > .sr-only[aria-live]") || {}).textContent || null }; })()');
// the steps view's state once two reads STILL_MS apart are the same (at most STILL_TRIES reads)
const stillS = async () => {
  let a = await S();
  for (let i = 0; i < STILL_TRIES; i++) {
    await ev(`new Promise((r) => setTimeout(() => r(1), ${STILL_MS}))`);
    const b = await S();
    if (JSON.stringify(b) === JSON.stringify(a)) return b;
    a = b;
  }
  return a;
};
// a wait that must come: a timeout ends the section it is in (thrown), with what the page says of it and of the frames'
// probe, so a state that never comes costs one wait and says why
const need = async (r, what) => {
  if (r.ok) return r;
  const probe = await ev('__cmwSteps().aheadProbe').catch(() => null);
  throw new Error(`${what}: not within its wait (${JSON.stringify(r.busy || r)}); the frames' probe: ${JSON.stringify(probe)}`);
};
// at rest on plane i, everything ready
const rest = async (i) => {
  await ev(`__cmwSteps({ go: ${i}, now: true }), 1`);
  await settled({ only: true, max: 60000, until: `!__cmwSteps().moving && __cmwSteps().x === ${i} && __cmwSteps().ready.ready` });
};
// a glide to plane i from rest, its clock at clock ms a frame; resolves once it is under way (its frames made)
const glide = async (i, clock) => {
  await ev(`__cmwSteps({ clock: ${clock} }), __cmwSteps({ go: ${i} }), 1`);
  return settled({ only: true, max: WAIT_MS, until: '!!__cmwSteps().anim' });
};

await view(900, 600, false, false);
await openState('ahead');
await ev(`__cmwSet('morphPaths', false), __cmwSteps({ scope: 'all', surf: 'plane', ahead: { ms: 0, waitMs: ${WAIT_MS} } }), 1`);
await rest(0);
await ev(WATCH);
info.speed = (await S()).speed;

// ---- first: the chain's first motion starts at once (its cost is not known), and the cost is measured after it ----
{
  const s0 = await S();
  ok('first: the chain\'s frame cost is not known yet', s0.cost === null, s0);
  const now = await ev('(() => { const s = __cmwSteps({ clock: 1000 / 60, go: 1 }); return { anim: !!s.anim, ahead: s.ahead, moving: s.moving }; })()');
  info.first = { now };
  ok('first: the first glide starts at once, in the press\'s own task (no wait, as without frames ahead)', now.anim && !now.ahead, now);
  await settled({ only: true, max: 60000, until: '!__cmwSteps().moving' });
  // (the probe ends: its frames drawn and timed, or given up, which its log says)
  const m = await settled({ only: true, max: WAIT_MS, until: '(() => { const p = __cmwSteps().aheadProbe; return !!p && p.state !== "waiting" && p.state !== "drawing"; })()' });
  const f = await S();
  Object.assign(info.first, { cost: f.cost, probe: f.probe });
  ok('first: its frame cost is measured once it has ended (the probe drew its frames)', m.ok && !!f.probe && f.probe.state === 'done' && f.cost > 0, info.first);
}

// ---- made, (a), (b) and the live frames: the glide 0 -> 1, the chain's cost known, with its clock still (1e-6 ms a frame) ----
await rest(0);
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
  await settled({ only: true, max: 30000, until: '__cmwSteps().ahead && __cmwSteps().ahead.shown > 20' });
  const m = await S();
  info.shown = m.ahead && { shown: m.ahead.shown, glide: m.glide };
  ok('shown: the glide shows its frames drawn ahead as it runs', !!m.ahead && m.ahead.shown > 20, m.ahead);
  await settled({ only: true, max: 60000, until: '!__cmwSteps().moving' });
  const end = await S();
  ok('shown: the glide ends on plane 1, and its frames go', end.x === 1 && !end.ahead, end);
}

// ---- (d) a budget of 0 bytes: the glide plays live at once and says why after the label of the plane it reaches; once ----
{
  await rest(0);
  const said0 = await ev('__live.slice()');
  ok('(d) control: with the default budget the live region never said a glide draws as it goes', !said0.some((t) => t.includes('The glide draws as it goes')), said0);
  await ev('__cmwSteps({ ahead: { cap: 0 } }), __live = [], 1');
  const now = await ev('(() => { const s = __cmwSteps({ clock: 1000 / 60, go: 1 }); return { anim: !!s.anim, ahead: s.ahead }; })()');
  ok('(d) a budget of 0: the glide plays live at once, with no frame drawn ahead', now.anim && !now.ahead, now);
  await settled({ only: true, max: 60000, until: '!__cmwSteps().moving' });
  const texts = await ev('__live.slice()');
  info.d = { now, texts };
  ok('(d) it says why after the label of the plane it reaches, with a full stop between', texts.length > 0 && texts[texts.length - 1].endsWith('. ' + MEMORY) && texts[texts.length - 1].length > MEMORY.length + 2, texts);
  ok('(d) it says it once', texts.filter((t) => t.includes(MEMORY)).length === 1, texts);
  await ev('__live = [], __cmwSteps({ go: 0 }), 1');
  await settled({ only: true, max: 60000, until: '!__cmwSteps().moving' });
  const again = await ev('__live.slice()');
  info.dAgain = again;
  ok('(d) the second glide does not say it again', !again.some((t) => t.includes(MEMORY)), again);
  await ev('__cmwSteps({ ahead: { cap: null } }), 1');
}

// ---- play: a Play (no loop) that plays live for time says why with the words of its stop ----
{
  await rest(0);
  await ev('__cmwSteps({ ahead: { waitMs: 1 }, loop: false }), __live = [], 1');
  const now = await ev('(() => { const s = __cmwSteps({ clock: 1000 / 60, play: true }); return { play: s.play, ahead: s.ahead }; })()');
  await settled({ only: true, max: 60000, until: '!__cmwSteps().moving' });
  const texts = await ev('__live.slice()');
  info.play = { now, texts };
  ok('play: it plays live at once', now.play === 'glide' && !now.ahead, now);
  const t = texts.find((x) => x.includes(TIME));
  ok('play: it says why once, after the words of its stop and a full stop: the last words said', !!t && t === texts[texts.length - 1] && t.startsWith('Stopped at ') && t.endsWith('. ' + TIME) && texts.filter((x) => x.includes(TIME)).length === 1, texts);
  ok('play: "Playing from … to …" is never joined to it', !texts.some((x) => x.startsWith('Playing from') && x.includes(TIME)), texts);
  await ev(`__cmwSteps({ ahead: { waitMs: ${WAIT_MS} } }), 1`);
}

// ---- Cancel (Esc) while the frames are made: they go, and no glide starts ----
{
  await rest(0);
  await ev('__cmwSteps({ clock: 1e-6 }), __cmwSteps({ go: 1 }), 1');
  const filling = await settled({ only: true, max: WAIT_MS, until: '(() => { const a = __cmwSteps().ahead; return !!a && a.n >= 1 && a.state === "fill"; })()' });
  await ev('(document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })), 1)');
  const at = await S();
  // (no glide and no frame after it: the steps view read until two reads STILL_MS apart are the same)
  const later = await stillS();
  info.cancel = { filling: filling.ok, at: at.ahead, later: { anim: later.anim, ahead: later.ahead, x: later.x } };
  ok('cancel: Esc while the frames are made drops them', filling.ok && !at.ahead, info.cancel);
  ok('cancel: no glide starts, and no frame is made afterwards', !later.anim && !later.ahead && later.x === 0, info.cancel);
}

// ---- Play paused on its frames and pressed again goes on with the same schedule and frames, with no new wait ----
{
  await rest(0);
  await ev('__cmwSteps({ clock: 1e-6 }), __cmwSteps({ play: true }), 1');
  const up = await settled({ only: true, max: WAIT_MS, until: '__cmwSteps().play === "glide"' });
  await settled({ only: true, max: 30000, until: '!!__cmwSteps().ahead && __cmwSteps().ahead.shown > 0' });
  const a0 = (await S()).ahead;
  await ev('__cmwSteps({ play: false }), 1');
  const paused = await S();
  await ev('__cmwSteps({ play: true }), 1');
  const again = await S();
  await settled({ only: true, max: 30000, until: `!!__cmwSteps().ahead && __cmwSteps().ahead.shown > ${a0 ? a0.shown : 0}` });
  const a1 = (await S()).ahead;
  info.resume = { up: up.ok, a0, paused: { x: paused.x, ahead: paused.ahead && paused.ahead.state }, again: again.ahead && again.ahead.state, a1 };
  ok('resume: the play runs on frames drawn ahead', up.ok && !!a0 && a0.state === 'done' && a0.shown > 0, info.resume);
  ok('resume: paused, its frames stay', !!paused.ahead && paused.ahead.state === 'done', info.resume);
  ok('resume: pressed again, it plays at once (no wait) on the same frames (none made again)', again.play === 'glide' && !!a1 && a1.state === 'done' && a1.n === a0.n && a1.recs.length === a0.recs.length && a1.shown > a0.shown, info.resume);
  await ev('__cmwSteps({ clock: 1000 / 60 }), 1');
  await settled({ only: true, max: 60000, until: '!__cmwSteps().moving' });
}

// ---- (c) an edit drops them: the glide 0 -> 1, its clock still, the colour's sectors changed ----
{
  await rest(0);
  const up = await glide(1, 1e-6);
  const s = await S();
  ok('(c) the glide starts on frames drawn ahead', up.ok && s.anim && !!s.ahead && s.ahead.state === 'done', s.ahead);
  const t0 = await ev('__cmwTime(1).left'), s0 = await S();
  ok('(c) control: before the edit, a frame is shown from them', !!s0.ahead && s0.ahead.shown > 0, s0.ahead);
  await ev("__cmwSet('sectors', 7), 1");
  const t1 = await ev('__cmwTime(1).left'), s1 = await S();
  info.c = { t0, t1, after: s1.ahead, glide: s1.glide };
  ok('(c) after the edit, the frames are dropped and the frame is drawn live, mid-glide', !s1.ahead && s1.anim && t1 > 0, info.c);
  await ev('__cmwSteps({ clock: 1000 / 60 }), 1');
  await settled({ only: true, max: 60000, until: '!__cmwSteps().moving' });
}

// ---- a hold while the frames are made is never kept: the zeta example (its glide's Newton ops draw from pole tracks),
// Inside regions; once a frame is made, every pole track dropped and a frame's own pole search all but nothing, with the
// page's idle moments held (lib/idle_queue.js) so the idle job does not make the tracks again. The chain's cost is measured
// first, by one live glide and the probe after it (its log, __cmwSteps().aheadProbe, says how it went: drawn, or given up
// and why). Its frames are drawn ahead whatever they cost (HOLD_WAIT_CAP_MS), and a glide that plays live ends the section at
// once, with the cost. A wait that runs out ends the section at once (need), with the probe's log ----
{
  let held = false;
  try {
    const ex = exampleNames().indexOf('Zeros of the zeta function');
    if (!ok('hold: the zeta example is found', ex >= 0, ex)) throw new Error('no zeta example');
    await goOk(`http://localhost:${PORT}/test.html?ns=aheadz${Date.now()}&lang=en&view=steps`);
    await need(await settled({ only: true, max: 60000, until: 'typeof __cmwExample === "function" && typeof __cmwSteps === "function" && typeof __cmwAhead === "function" && !!window.GLR' }), 'the page hooks');
    await ev(`__cmwExample(${ex}), 1`);
    // (the example's chain adopted before the scope is set: a load that lands later sets the example's own scope)
    await adopted();
    await ev(`__cmwSteps({ scope: 'in', ahead: { ms: 0, waitMs: ${HOLD_WAIT_CAP_MS} } }), 1`);
    await ev(`__cmwSteps({ go: 0, now: true }), 1`);
    await need(await settled({ only: true, max: WAIT_MS, until: '!__cmwSteps().moving && __cmwSteps().x === 0 && __cmwSteps().ready.ready && __cmwSteps().scope === "in"' }), 'plane z at rest, ready, Inside regions');
    // (the chain's cost: a live glide, then the probe in the idle moments after it)
    const t0 = Date.now();
    // (its clock PRIME_CLOCK_MS a frame: a few frames, each of the zeta chain's slow on a software renderer)
    await ev(`__cmwSteps({ clock: ${PRIME_CLOCK_MS}, go: 1 }), 1`);
    await need(await settled({ only: true, max: WAIT_MS, until: '!__cmwSteps().moving' }), 'the live glide ends');
    await need(await settled({ only: true, max: WAIT_MS, until: '(() => { const p = __cmwSteps().aheadProbe; return !!p && p.state !== "waiting" && p.state !== "drawing"; })()' }), 'the probe ends');
    const probe = (await S()).probe;
    info.holdProbe = Object.assign({ ms: Date.now() - t0 }, probe);
    if (!ok('hold: the zeta chain\'s frame cost is measured (the probe drew its frames)', !!probe && probe.state === 'done' && probe.cost > 0, probe)) throw new Error('the probe did not measure the chain');
    await ev(`__cmwSteps({ go: 0, now: true }), 1`);
    await need(await settled({ only: true, max: WAIT_MS, until: 'GLR.pendingLinks === 0 && !__cmwSteps().moving && __cmwSteps().x === 0 && __cmwSteps().ready.ready' }), 'plane z at rest, ready again');
    await holdIdle();
    held = true;
    await ev('__cmwSteps({ clock: 1e-6 }), __cmwSteps({ go: 1 }), 1');
    // (the plan's decision first: the glide waits while its frames are made, or it plays live, said at once with the chain's cost)
    await need(await settled({ only: true, max: WAIT_MS, until: '(() => { const s = __cmwSteps(), a = s.ahead; return (!!a && (a.n >= 2 || a.state === "live")) || (!a && !!s.anim); })()' }), 'two frames made, or the glide played live');
    const plan = (await S()).ahead;
    if (!ok('hold: the glide waits while its frames are made (not played live for their time or memory)', !!plan && !(plan.state === 'live' && (plan.why === 'time' || plan.why === 'memory')), { ahead: plan, cost: probe.cost })) throw new Error('the glide played live');
    await ev('__cmwSteps({ poleFrameMs: 0.001, dropTracks: true }), 1');
    await need(await settled({ only: true, max: WAIT_MS, until: '(() => { const a = __cmwSteps().ahead; return !a || a.rejects > 0 || a.state !== "fill"; })()' }), 'the hold met, or the frames made');
    const R = (await S()).ahead;
    info.hold = { ahead: R };
    ok('hold: the hold is met while the frames are made (a frame drawn is not kept)', !!R && R.rejects > 0, R);
    // (a held visit asks for a frame, svLinkHold's requestRender; the visit puts the ask back, so none is drawn for it)
    ok(`hold: the held visits draw no live frame: at most ${LIVE_MAX} drawn on the screen while the frames were made`, !!R && R.live <= LIVE_MAX, R && R.live);
    ok('hold: every frame kept is the inverse pass\'s', !!R && R.recs.length === R.n && R.n >= 2 && R.recs.every((p, k) => p === 'inverse' || k === 0), R && R.recs);
    if (R && R.state !== 'live') for (const k of [1, R.n - 1]) {
      const c = await ev(`__cmwAhead(${k})`);
      ok(`hold: frame ${k} kept is the live frame, byte for byte`, !!c && c.n > 0 && c.diff === 0, c);
    }
    await releaseIdle();
    held = false;
    const up = await need(await settled({ only: true, max: WAIT_MS, until: '!!__cmwSteps().anim' }), 'the glide starts');
    const s2 = await S();
    info.holdEnd = { up: up.ok, ahead: s2.ahead && { state: s2.ahead.state, why: s2.ahead.why, n: s2.ahead.n, N: s2.ahead.N, rejects: s2.ahead.rejects }, live: s2.live };
    ok('hold: the glide starts, on frames all exact or live', !!s2.ahead && (s2.ahead.state === 'done' || (s2.ahead.state === 'live' && s2.ahead.why === 'exact')), info.holdEnd);
    // (the live glide ended in a few frames, its clock PRIME_CLOCK_MS a frame)
    await ev(`__cmwSteps({ clock: ${PRIME_CLOCK_MS}, poleFrameMs: null }), 1`);
    await need(await settled({ only: true, max: WAIT_MS, until: '!__cmwSteps().moving' }), 'the glide ends');
  } catch (e) {
    fails.push({ name: 'hold: the section ended at a wait that did not come', got: String(e && e.message || e) });
  } finally {
    if (held) await releaseIdle();
  }
}
await ev('__cmwSteps({ clock: 0, ahead: { ms: null, waitMs: null, cap: null } }), 1');
return { pass: fails.length === 0, fails, info };
