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
// - on a phone, Play pressed while the second pass is held: the Play gate waits, and its message (#toastHost) comes up over
//   the pane's corner (control); a page script logs each frame from then, and no frame drawn while the message is up draws
//   the cue there; once the message is closed (its ×) the cue is drawn again, the gate still waiting.
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const CUE = /^Drawing the exact picture/, CUE_FRAMES = 10, FAST_NODES = 5, TILE_SOLVES = 2 ** 26, HELD_TILES = 2 ** 49, WATCH_FRAMES = 80;
// (CUE_DELAY_MS: the page's wait before the phone's note, as the hairline's; LIVE_WAIT_MS: how long a read waits for it,
// and for the LEDs' live region, past it)
const CUE_DELAY_MS = 300, LIVE_WAIT_MS = 5000, PHONE_W = 360, PHONE_H = 640;
// (the Play gate's message: it comes after GATE_MS of waiting; a read waits for it that long and LIVE_WAIT_MS more)
const GATE_MS = 10000, MSG = '#toastHost .toast';
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
// ---- a phone, the Play gate: Play pressed while the second pass is held, its message comes up over the pane's corner ----
{
  // (a new bound, half the tiles, so the drawn plane is walked again with its second pass held)
  await ev(`__cmwRept({ fast: ${FAST_NODES}, holdB: true, tiles: ${HELD_TILES / 2} }); 1`);
  const cued = await poll(`(() => { const s = __cmwPaneStatus('L'); return !!s && s.rept && /^Drawing the exact picture/.test(s.cue || ''); })()`, CUE_DELAY_MS + LIVE_WAIT_MS);
  // (a page script: each frame's time, whether it is REPT-pending, the cue drawn, and whether the message is up)
  await ev(`(() => { const log = window.__gateLog = []; let last = null;
    const tick = () => {
      const s = __cmwPaneStatus('L');
      if (s && s.t !== last) { last = s.t; log.push({ t: s.t, rept: !!s.rept, cue: s.cue || null, msg: !!document.querySelector('${MSG}') }); }
      if (log.length < 4000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick); __cmwSteps({ play: true }); return 1; })()`);
  const up = await settled({ max: GATE_MS + LIVE_WAIT_MS, panes: false, only: true, until: `!!document.querySelector('${MSG}')` });
  // (the frames from a moment after the message came up: a frame drawn as it came is not read)
  const tUp = await ev('performance.now()');
  await frames(20);
  const geo = await ev(`(() => { const m = document.querySelector('${MSG}'), p = document.getElementById('plotL'); if (!m || !p) return null;
    const a = m.getBoundingClientRect(), b = p.getBoundingClientRect(); return { msg: { x: a.left, y: a.top, w: a.width, h: a.height }, plot: { x: b.left, y: b.top, w: b.width, h: b.height } }; })()`);
  // (the corner note's place, cornerNote's: 8.5 px in from the pane's left, its 18 px tall pill 8 px above the pane's foot)
  const corner = geo && { x: geo.plot.x + 8.5, y: geo.plot.y + geo.plot.h - 26, w: 40, h: 18 };
  const covers = !!geo && corner.x < geo.msg.x + geo.msg.w && geo.msg.x < corner.x + corner.w && corner.y < geo.msg.y + geo.msg.h && geo.msg.y < corner.y + corner.h;
  const under = (await ev('window.__gateLog || []')).filter((e) => e.rept && e.msg && e.t > tUp);
  await ev(`(document.querySelector('${MSG} .toast-x').click(), 1)`);
  const back = await poll(`(() => { const s = __cmwPaneStatus('L'); return !document.querySelector('${MSG}') && !!s && s.rept && /^Drawing the exact picture/.test(s.cue || ''); })()`, CUE_DELAY_MS + LIVE_WAIT_MS);
  const waiting = await ev('!!__cmwSteps().moving');
  info.gate = { cued: cued.ok, up: up.ok, geo, corner, covers, under, back: back.ok, waiting };
  ok('a phone, the Play gate: Play waits on the REPT draw, and its message comes up over the pane\'s corner (control)', cued.ok && up.ok && covers && under.length > 0, info.gate);
  ok('a phone, the Play gate: while the message is up, the cue is not drawn under it', under.length > 0 && under.every((e) => !e.cue), under.find((e) => e.cue) || info.gate);
  ok('a phone, the Play gate: the message closed, the cue is drawn again while the gate still waits', back.ok && waiting, info.gate);
  await ev('(__cmwSteps({ play: false }), __cmwRept({ holdB: false }), 1)');
}
await ev('__cmwRept({ fast: 0, tiles: 0 }); 1');
return { pass: fails.length === 0, fails, info };
