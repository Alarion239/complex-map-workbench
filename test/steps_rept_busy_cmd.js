// The busy cue while an exact Repeat picture is still drawing (#1486): the gallery's Newton's map for z³ − 1 ×20, Inside
// regions, parked on w₁, drawn by the REPT renderer in tiles (GLR's reptDraw). While its draw has tiles left the left pane's
// status (the LED: its tip, read by assistive tech as its aria-label) says the exact picture is still drawing and the
// plot is aria-busy; the frame the picture lands the cue is gone:
// - at rest, the picture drawn: no cue (control);
// - the second pass held (__cmwRept({ holdB })), the frame pending: the cue, on every frame watched (CUE_FRAMES);
// - released: the cue is gone once the picture is drawn;
// - the LEDs' polite live region (#ledLive) says the cue's words once the cue has lasted, and "Up to date" when it ends;
// - in tiles of TILE_SOLVES root solves with the first pass at FAST_NODES, the cue names the tiles done, "k of n", with
//   0 <= k < n, on some frame while they draw, the count joined by no-break spaces (a tip never wraps inside it);
// - on a phone (PHONE_W x PHONE_H), where the LED is not laid out: the pane's corner note says the cue's words while the
//   second pass is held, and is gone once the picture is drawn;
// - on a phone, the plane turned to its Landscape with the second pass held, its programs held linking (GLR.holdLinks):
//   the corner holds one note on every frame. A long compile: the frames are both REPT-pending and compiling (control);
//   the cue (__cmwPaneStatus(role).cue) stays on the frames before the "Compiling…" note's COMPILE_NOTE_MS, gives way to
//   that note (__cmwCompileBox) on the frames from then, and is drawn again once the programs have linked. A short one
//   (released SHORT_COMPILE_MS after its first frame): no frame draws "Compiling…", and every frame draws the cue.
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const CUE = /^Drawing the exact picture/, CUE_FRAMES = 10, FAST_NODES = 5, TILE_SOLVES = 2 ** 26, HELD_TILES = 2 ** 49, WATCH_FRAMES = 80;
// (CUE_DELAY_MS: the page's wait before the phone's note, as the hairline's; LIVE_WAIT_MS: how long a read waits for it,
// and for the LEDs' live region, past it)
const CUE_DELAY_MS = 300, LIVE_WAIT_MS = 5000, PHONE_W = 360, PHONE_H = 640;
// (the page's wait before the "Compiling…" note; a short compile's length, under it)
const COMPILE_NOTE_MS = 300, SHORT_COMPILE_MS = 150;
const LAND_PROGS = ['landTF', 'land', 'floor', 'landCarryTF', 'landCarry'];
const LIVE = `((document.getElementById('ledLive') || {}).textContent || '')`;
// (the parked plane drawn, and the gallery parked on plane 1, Inside regions: test/lib/parked_kit.js)
const { PARKED_DRAWN: DRAWN, loadGallery, parkInside } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'parked_kit.js'), 'utf8'))({ ev, settled, exampleNames });
// the cue as the page shows it: the left LED's class and tip (its aria-label), and the plot's aria-busy
const cue = () => ev(`(() => { const l = document.getElementById('leftLed'), p = document.getElementById('plotL');
  return { led: l.className, label: l.getAttribute('aria-label') || '', tip: l.getAttribute('data-tip') || '', busy: p.getAttribute('aria-busy'), pending: !!(__cmwPaneStatus('L') || {}).rept }; })()`);
const on = (c) => !!c && / busy/.test(' ' + c.led) && CUE.test(c.label) && c.label === c.tip && c.busy === 'true';
const off = (c) => !!c && !CUE.test(c.label) && c.busy !== 'true';
// (until is true on a frame within ms, read every two frames: settled() waits for the panes to be quiet, which a held
// pass never is): { ok, ms }
const poll = async (until, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(until)) return { ok: true, ms: Date.now() - t0 }; await frames(2); } return { ok: false, ms }; };
const frames = (n) => ev(`new Promise((r) => { let k = ${n}; const f = () => (--k > 0 ? requestAnimationFrame(f) : r(1)); requestAnimationFrame(f); })`);
await view(1200, 800, false, false);
await go(`http://localhost:${PORT}/test.html?view=steps&lang=en`);
await settled({ max: 60000, until: 'typeof __cmwExample === "function" && typeof __cmwSteps === "function" && typeof __cmwRept === "function" && !!window.GLR' });
await loadGallery(60000);
await parkInside(60000);
await settled({ max: 120000, until: DRAWN });
const rest = info.rest = await cue();
ok('at rest, the picture drawn: no busy cue (the LED says nothing of drawing, the plot is not aria-busy)', off(rest), rest);
// (a new bound: the plane is walked again, its second pass held)
await ev(`__cmwRept({ fast: ${FAST_NODES}, holdB: true, tiles: ${HELD_TILES} }); 1`);
const held = [];
for (let i = 0; i < CUE_FRAMES; i++) { await frames(2); held.push(await cue()); }
info.held = held;
ok(`with the second pass held (the frame pending), every frame of ${CUE_FRAMES} shows the cue: the LED busy, its tip and aria-label "Drawing the exact picture…", the plot aria-busy`, held.every((c) => c.pending && on(c)), held.find((c) => !(c.pending && on(c))));
// (the tile count agrees with its number: one tile is "of 1 tile")
ok('the tile count agrees with its number ("of 1 tile", not "of 1 tiles")', held.every((c) => !/\sof\s1 tiles\b/.test(c.label)), held.map((c) => c.label));
// (the LEDs' live region: the cue's words said once it has lasted)
const said = info.said = await poll(`/Drawing the exact picture/.test(${LIVE})`, CUE_DELAY_MS + LIVE_WAIT_MS);
ok('the LEDs\' live region says "Drawing the exact picture…" once the cue has lasted', said.ok, { said, live: await ev(LIVE) });
await ev('__cmwRept({ holdB: false }); 1');
await settled({ max: 120000, until: DRAWN });
await frames(2);
const done = info.done = await cue();
ok('released, once the picture is drawn the cue is gone', off(done), done);
const landed = info.landed = await poll(`/Up to date/.test(${LIVE})`, LIVE_WAIT_MS);
ok('the LEDs\' live region says "Up to date" when the cue ends', landed.ok, { landed, live: await ev(LIVE) });
// (tiles of TILE_SOLVES: the second pass draws in several tiles, a call each)
await ev(`__cmwRept({ fast: ${FAST_NODES}, tiles: ${TILE_SOLVES} }); 1`);
let counted = null;
for (let i = 0; i < WATCH_FRAMES && !counted; i++) {
  await frames(1);
  const c = await cue(), m = /(\d+)\sof\s(\d+) tiles?/.exec(c.label);
  if (m && on(c)) counted = { k: +m[1], n: +m[2], label: c.label };
}
info.counted = counted;
ok('in tiles, the cue names the tiles done: "k of n tiles", 0 <= k < n', !!counted && counted.k >= 0 && counted.k < counted.n, counted);
ok('the count is joined by no-break spaces ("k\u00a0of\u00a0n")', !!counted && /\d\u00a0of\u00a0\d/.test(counted.label), counted);
await settled({ max: 120000, until: DRAWN });
await frames(2);
const after = info.after = await cue();
ok('the tiles drawn, the cue is gone', off(after), after);
await ev('__cmwRept({ fast: 0, tiles: 0 }); 1');
// ---- a phone: the LED is not laid out, the pane's corner note carries the cue ----
await view(PHONE_W, PHONE_H, false, true);
await go(`http://localhost:${PORT}/test.html?view=steps&lang=en`);
await settled({ max: 60000, until: 'typeof __cmwExample === "function" && typeof __cmwSteps === "function" && typeof __cmwRept === "function" && !!window.GLR' });
await loadGallery(60000);
await parkInside(60000);
await settled({ max: 120000, until: DRAWN });
const phone = info.phone = { led: await ev("document.getElementById('leftLed').offsetWidth"), rest: (await ev("__cmwPaneStatus('L')") || {}).cue || null };
await ev(`__cmwRept({ fast: ${FAST_NODES}, holdB: true, tiles: ${HELD_TILES} }); 1`);
const noted = await poll(`(() => { const s = __cmwPaneStatus('L'); return !!s && s.rept && /^Drawing the exact picture/.test(s.cue || ''); })()`, CUE_DELAY_MS + LIVE_WAIT_MS);
phone.held = Object.assign({ ok: noted.ok }, await ev("__cmwPaneStatus('L')"));
ok('a phone: the LED is not laid out (control: the corner note stands in for it)', phone.led === 0, phone);
ok('a phone: at rest, the picture drawn, no corner note', !phone.rest, phone);
ok('a phone: the second pass held, the pane\'s corner note says the cue ("Drawing the exact picture…")', noted.ok, phone);
await ev('__cmwRept({ holdB: false }); 1');
await settled({ max: 120000, until: DRAWN });
await frames(2);
phone.done = (await ev("__cmwPaneStatus('L')") || {}).cue || null;
ok('a phone: released, once the picture is drawn the note is gone', !phone.done, phone);
// ---- a phone, the Landscape: its programs are first asked for once the plane's inverse program has linked. Held, they
// stand in while the REPT draw's second pass is held too. A page script logs each frame's corner from the hold on: the
// frame's time, whether it is REPT-pending and compiling, the cue drawn, and whether that frame drew "Compiling…" (the
// note's box stamped with the frame's time); with releaseMs, it releases the links that long after the first compiling
// frame ----
const CORNER_LOG = (releaseMs) => `(() => { const log = window.__cornerLog = []; let last = null, t0 = null;
  const tick = () => {
    const s = __cmwPaneStatus('L');
    if (s && s.t !== last) {
      last = s.t;
      const b = __cmwCompileBox();
      log.push({ t: s.t, rept: !!s.rept, compiling: !!s.compiling, cue: s.cue || null, box: !!b && b.t === s.t });
      if (s.compiling && t0 === null) { t0 = s.t; ${releaseMs == null ? '' : `setTimeout(() => GLR.holdLinks(false), ${releaseMs});`} }
    }
    if (log.length < 4000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick); return 1; })()`;
const LOG = 'window.__cornerLog || []';
// the phone's page with the gallery parked, the second pass held and the cue drawn; then the links held and the Landscape
// (the Landscape's programs, LAND_PROGS, held by name from the page's start: the warm-up starts them a view ahead, apart from
// the plane's, and they stay linking until the switch asks for them)
// (each on a page of its own namespace: none restores the Landscape another left)
const landHeld = async (releaseMs) => {
  await go(`http://localhost:${PORT}/test.html?view=steps&lang=en&ns=reptland${Date.now()}`);
  await settled({ max: 60000, until: 'typeof __cmwExample === "function" && typeof __cmwSteps === "function" && typeof __cmwRept === "function" && !!window.GLR' });
  await ev(`GLR.holdLinks(true, ${JSON.stringify(LAND_PROGS)}); 1`);
  await loadGallery(60000);
  await parkInside(60000);
  const drawn = await settled({ max: 120000, until: DRAWN });
  await ev(`__cmwRept({ fast: ${FAST_NODES}, holdB: true, tiles: ${HELD_TILES} }); 1`);
  const cued = await poll(`(() => { const s = __cmwPaneStatus('L'); return !!s && s.rept && /^Drawing the exact picture/.test(s.cue || ''); })()`, CUE_DELAY_MS + LIVE_WAIT_MS);
  await ev(`${CORNER_LOG(releaseMs)}; __cmwSteps({ surf: 'land' }); 1`);
  return { drawn: drawn.ok, cued: cued.ok };
};
// the logged frames that are REPT-pending, each with its time since the first compiling frame (since)
const reptFrames = (log) => { const c = log.find((e) => e.compiling), t0 = c ? c.t : Infinity; return log.filter((e) => e.rept).map((e) => Object.assign({ since: e.t - t0 }, e)); };
const release = async () => {
  await ev('GLR.holdLinks(false); __cmwRept({ holdB: false }); 1');
  const r = await settled({ max: 120000, until: DRAWN });
  await ev('__cmwRept({ fast: 0, tiles: 0 }); 1');
  return r;
};
// a long compile: held until the "Compiling…" note has been drawn
{
  const start = await landHeld(null);
  const noted = await poll(`(() => { const l = ${LOG}, c = l.filter((e) => e.compiling); return c.length > 1 && c[c.length - 1].t - c[0].t >= ${COMPILE_NOTE_MS} && c[c.length - 1].box; })()`, COMPILE_NOTE_MS + LIVE_WAIT_MS);
  const frs = reptFrames(await ev(LOG)), both = frs.filter((e) => e.compiling);
  const early = both.filter((e) => e.since < COMPILE_NOTE_MS), late = both.filter((e) => e.since >= COMPILE_NOTE_MS);
  await ev('GLR.holdLinks(false); 1');
  const back = await poll(`(() => { const s = __cmwPaneStatus('L'); return !!s && s.rept && !s.compiling && /^Drawing the exact picture/.test(s.cue || ''); })()`, CUE_DELAY_MS + LIVE_WAIT_MS);
  info.landLong = { start, noted: noted.ok, frames: frs, back: back.ok };
  ok('a phone, Landscape, a long compile: the frames are both REPT-pending and compiling, past the "Compiling…" note\'s wait, and the note is drawn (control)', start.drawn && start.cued && noted.ok && early.length > 0 && late.length > 0 && late.every((e) => e.box), info.landLong);
  ok(`a phone, Landscape, a long compile: the frames before the "Compiling…" note's ${COMPILE_NOTE_MS} ms draw the cue, alone (the corner is never empty)`, early.length > 0 && early.every((e) => CUE.test(e.cue || '') && !e.box), early.find((e) => !CUE.test(e.cue || '') || e.box) || info.landLong);
  ok('a phone, Landscape, a long compile: from then the cue gives way to "Compiling…", the corner\'s one note', late.length > 0 && late.every((e) => !e.cue), late.find((e) => e.cue) || info.landLong);
  ok('a phone, Landscape: the programs linked, the second pass still held, the corner note says the cue again', back.ok, info.landLong);
  info.landLong.released = (await release()).ok;
}
// a short compile: the links released SHORT_COMPILE_MS after its first frame
{
  const start = await landHeld(SHORT_COMPILE_MS);
  const over = await poll(`(() => { const l = ${LOG}, i = l.findIndex((e) => e.compiling); return i >= 0 && l.slice(i).some((e) => !e.compiling && e.rept && !!e.cue); })()`, COMPILE_NOTE_MS + LIVE_WAIT_MS);
  const frs = reptFrames(await ev(LOG)), both = frs.filter((e) => e.compiling);
  info.landShort = { start, over: over.ok, frames: frs };
  ok(`a phone, Landscape, a short compile: some frames are both REPT-pending and compiling, none ${COMPILE_NOTE_MS} ms after the first, and "Compiling…" is never drawn (control)`, start.drawn && start.cued && over.ok && both.length > 0 && both.every((e) => e.since < COMPILE_NOTE_MS && !e.box), info.landShort);
  ok('a phone, Landscape, a short compile: every frame draws the cue (it does not blink off)', frs.length > 0 && frs.every((e) => CUE.test(e.cue || '')), frs.find((e) => !CUE.test(e.cue || '')) || info.landShort);
  info.landShort.released = (await release()).ok;
}
return { pass: fails.length === 0, fails, info };
