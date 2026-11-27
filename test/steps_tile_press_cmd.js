// The glide tile is laid out off the glide's frames (#2458): the tile's layout (its formulas typeset, svTileLay's measures
// and obstacle search, the morph built) is made in an idle moment (svTileLater), not in the frame that asks for it, the
// steps view's sync, which on a press is the glide's first frame and draws its picture too (the two together are one
// long task on a slow machine). A chain of two steps whose composite is long (steps_glide_tile's TILE_CHAIN), the page
// at 1200 x 800, the thread at rest on w₁, with __cmwTile's trace of each layout and typesetting (now: made where a
// layout may be, svTileLater's job or the hook; else in a frame):
// - press: a glide from w₁ to w₂ (__cmwSteps go, played live, its frames the steps view's own, each advancing it 1/60 s
//   however long it takes to draw: clock): none of the tile's layouts and none of its typesetting runs in a frame
//   (control: the glide made at least one of each);
// - held: the thread held between z and w₁ (x 0.5, a frame asks for a new pair of planes, the one laid out last being another):
//   the tile shows within SHOW_MS of the page's last long task that ended before its layout job started, and at the spot a layout
//   made at once gives (__cmwTile(true): the same box), its layouts made in the job; and again with the frame that asks taking
//   SLOW_FRAME_MS, as a cold first draw does on a slow runner.
// The page opens with ?view=steps (loadView('steps', …)).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
let pass = 0;
const ok = (name, cond, got) => { if (cond) pass++; else fails.push({ name, got }); return !!cond; };
const READY = 'typeof __cmwSteps === "function" && !!window.GLR && typeof __cmwTile === "function"';
const SHOW_MS = 1000, SLOW_FRAME_MS = 1600;
const TILE_CHAIN = [{ type: 'custom', params: { expr: 'z^2+1/z' }, on: true }, { type: 'custom', params: { expr: 'sin(z)+exp(z)/(z-1)' }, on: true }];
const BOX = '(() => { const el = document.getElementById("svTile"); if (!el || el.hidden || getComputedStyle(el).visibility === "hidden") return null; const r = el.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; })()';

await view(1200, 800, false, false);
await loadView('steps', 'svtilepress' + Date.now(), { shapes: [], steps: TILE_CHAIN }, { lang: 'en' });
await settled({ max: 30000, until: READY });
// (every glide plays live, its frames the steps view's own: no frames drawn ahead, render-ahead's)
await ev(`__cmwSteps({ ahead: { ms: 1e9 } }), __cmwSteps({ go: 1, now: true }); 1`);
await settled({ max: 60000, until: '!__cmwSteps().moving && __cmwSteps().ready.ready' });

// ---- press: a glide from w₁ to w₂
await ev('__cmwTile(false, true), 1');
await ev(`__cmwSteps({ clock: 1000 / 60, go: 2 }); 1`);
const end = await settled({ max: 60000, until: '!__cmwSteps().moving && __cmwSteps().x === 2' });
// (a layout job the glide queued has run: its trace counts too)
await settled({ max: 5000, until: '!__cmwTile().idle' });
const trace = info.press = (await ev('__cmwTile().trace')) || [];
await ev('__cmwTile(false, false), __cmwSteps({ clock: 0 }), 1');
const inFrame = trace.filter((e) => !e.now);
ok('press: the glide ran to w₂ (control)', end.ok, end);
ok('press: the glide laid the tile out and typeset its formulas (control)', trace.some((e) => e.what === 'lay') && trace.some((e) => e.what === 'tex'), trace);
ok('press: none of the tile\'s layouts or typesetting ran in a frame of the glide', inFrame.length === 0, { inFrame, trace });

// ---- held: the thread between z and w₁ (a pair of planes not laid out yet), shown within SHOW_MS, at the spot laid out at once.
// The idle job that lays the tile out runs when the page has a moment: a long task, a cold first draw's of that pair's programs
// (1.5-2 s on a hosted runner), holds it back however soon it is due, and that task's length is the machine's, not the tile's.
// So the time is counted from the end of the last long task that ended before the layout job started (the first layout's or
// typesetting's time in the trace; from the hold if there was none): what is left is the job's wait for an idle moment and what
// its own work takes, which is a long task too and is not subtracted. Twice: as it comes, and with the frame that asks made to
// take SLOW_FRAME_MS, a long task longer than SHOW_MS (the hosted runners' reading, the time from the hold, was 1.5-1.9 s)
const holdAt = async (slowMs) => {
  // (the pair laid out last is w₁ and w₂, so that the held thread's pair, z and w₁, is not laid out when it is held)
  await ev(`__cmwSteps({ x: 1.5 }), __cmwTile(true), 1`);
  await ev(`__cmwSteps({ go: 0, now: true }); 1`);
  await settled({ max: 60000, until: '!__cmwSteps().moving && __cmwSteps().ready.ready' });
  await ev('__cmwTile(false, true), 1');
  await ev(`window.__lt = [], window.__ltObs = new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push([e.startTime, e.startTime + e.duration]); }), window.__ltObs.observe({ type: 'longtask' }), 1`);
  await ev(`window.__t0 = performance.now(), __cmwSteps({ x: 0.5 }), ${slowMs ? `requestAnimationFrame(() => { const t = performance.now(); while (performance.now() - t < ${slowMs}); }), ` : ''}1`);
  const shown = await settled({ max: SHOW_MS + slowMs + 5000, until: `${BOX} !== null` });
  const ms = await ev('performance.now() - window.__t0');
  await sleep(200);
  const trace = (await ev('__cmwTile().trace')) || [];
  const jobAt = trace.length ? Math.min(...trace.map((e) => e.t)) : null;
  const since = await ev(`(() => { window.__ltObs.takeRecords().forEach((e) => window.__lt.push([e.startTime, e.startTime + e.duration])); window.__ltObs.disconnect(); const shownAt = window.__t0 + ${ms}, jobAt = ${jobAt === null ? 'Infinity' : jobAt}, ended = window.__lt.map((e) => e[1]).filter((t) => t <= jobAt); return Math.round(shownAt - Math.max(window.__t0, ...ended)); })()`);
  const held = await ev(BOX);
  const atOnce = await ev(`(__cmwTile(true), ${BOX})`);
  await ev('__cmwTile(false, false), 1');
  return { shown: shown.ok, ms: Math.round(ms), since, held, atOnce, trace };
};
const sameBox = (h) => !!h.held && !!h.atOnce && h.held.every((v, k) => Math.abs(v - h.atOnce[k]) <= 1);
const inJob = (h) => h.trace.length > 0 && h.trace.every((e) => e.now);
const held = info.held = await holdAt(0);
ok(`held: the tile shows within ${SHOW_MS} ms of the thread held between z and w₁, from the page's last long task before its layout job`, held.shown && held.since <= SHOW_MS, held);
ok('held: at the spot a layout made at once gives', sameBox(held), held);
ok('held: its layouts ran where a layout may be, not in the frame', inJob(held), held.trace);
const slow = info.heldSlow = await holdAt(SLOW_FRAME_MS);
ok(`held, its frame taking ${SLOW_FRAME_MS} ms: the tile shows within ${SHOW_MS} ms of that frame's end, from the last long task before its layout job`, slow.shown && slow.since <= SHOW_MS, slow);
ok('held, its frame taking long: at the spot a layout made at once gives', sameBox(slow), slow);
ok('held, its frame taking long: its layouts ran where a layout may be, not in the frame', inJob(slow), slow.trace);

return { pass: fails.length === 0, passed: pass, fails, info };
