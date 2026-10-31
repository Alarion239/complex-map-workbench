// v16.4 (notes/tour-r3/SPEC.md 7.6): the tour's completion conditions and its auto-advance, with real CDP input, at
// 1440 × 900 (mouse, English) and 390 × 844 (touch, English), and the Sound chapter at 390 × 844 (touch, Russian) and
// 1440 (mouse laps round the zero and the pole). Each task: no advance without input; the tick within 300 ms of the
// event; the advance 1500 ± 150 ms after the event, whatever the pointer or keys do next (doors 700 ± 100); holds and cancels; the sound
// settings back after the chapter, after Esc and after a reload. Run: test/<you>_cdp/q.sh test/tour_auto_cmd.js
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const R = [];
const check = (name, pass, detail) => R.push([name, !!pass, detail]);
const settle = async (ms = 900) => { await sleep(ms); await ev('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const cur = async () => { const c = await ev('Tour.current()'); return c ? c.chapter + '/' + c.id : null; };
const lit = () => ev('Tour.lit()');
logs();
const open = async (ns, w, h, dark, mobile, lang) => {
  await view(w, h, dark, mobile);
  await nav(U + '?ns=' + ns + (lang ? '&lang=' + lang : '')); await settle(1600);
  await ev('Tour.dismissSuggestion()');
};
const go = async (chapter, step) => { await ev(`Tour.start({ chapter: '${chapter}', step: ${step} })`); await settle(1500); };
// polls until f() (an expression) is truthy; returns the ms waited, or null after max ms
const until = async (expr, max = 8000, dt = 40) => { const t0 = Date.now(); while (Date.now() - t0 < max) { if (await ev(expr)) return Date.now() - t0; await sleep(dt); } return null; };
// waits for the step to change from id; returns ms since t0
const advancedAt = async (id, t0, max = 9000) => { while (Date.now() - t0 < max) { if ((await cur()) !== id) return Date.now() - t0; await sleep(25); } return null; };
// the moment the step shows done, polled from t0, and what the countdown then has left. The countdown runs from the step's
// done, which an action that compiles a formula or rebuilds the chain can precede by that work's time (a spike blocks the page,
// and the poll with it): the advance is measured from the poll and expected as the countdown's own `left`, which never exceeds CD_MS.
// A blocked main thread also fires the countdown's timer late, by up to the blocked time: the page's long tasks (PerformanceObserver,
// buffered) are summed over the wait, so the advance may be late by what was blocked and never early
const ltInstall = () => ev(`(() => { if (!window.__lt) { window.__lt = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push([e.startTime, e.startTime + e.duration]); }).observe({ type: 'longtask', buffered: true }); } catch (e) { window.__lt = null; } } return !!window.__lt; })()`);
const doneAt = async (t0, max = 6000) => { await ltInstall(); while (Date.now() - t0 < max) { const L = await ev('(() => { const l = Tour.lit(); return l && l.done ? { left: l.countdown && l.countdown.left, p: performance.now() } : null; })()'); if (L) return { t: Date.now(), p: L.p, left: L.left, after: Date.now() - t0 }; await sleep(15); } return null; };
const leftOk = (d) => !!d && d.left != null && d.left <= CDMS + 20;
// the advance from a doneAt: the countdown's timer is due `left` ms after the poll. It fires at the end of any long task that covers
// that moment (a blocked main thread runs it late, never early), and the advance's own work (a chapter change) is a long task that
// starts at the due moment and shows when it ends. The advance must come between the due time and that end, within the poll's
// tolerance. Time is the page's clock, read in the poll that sees the advance. The page's blocked ms (long tasks) are reported
const advanceFrom = async (id, d, tol) => {
  let r = null;
  for (const t1 = Date.now() + 9000; Date.now() < t1;) { r = await ev(`(() => { const c = Tour.current(); return { id: c ? c.chapter + '/' + c.id : null, p: performance.now() }; })()`); if (r.id !== id) break; await sleep(25); }
  const p1 = r ? r.p : 0;
  const lt = d ? await ev(`(() => { const T = (window.__lt || []).slice().sort((x, y) => x[0] - y[0]); let f = ${d.p} + ${d.left}; for (const [a, b] of T) if (a <= f + 30 && f < b) f = b; return { exp: f - ${d.p}, blocked: T.reduce((s, [a, b]) => s + Math.max(0, Math.min(b, ${p1}) - Math.max(a, ${d.p})), 0) }; })()`) : { exp: 0, blocked: 0 };
  const exp = Math.round(lt.exp), blocked = Math.round(lt.blocked), at = d ? Math.round(p1 - d.p) : null;
  return { at, exp, blocked, ok: leftOk(d) && at != null && at >= d.left - tol && at <= exp + tol };
};
const stays = async (id, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await cur()) !== id) return false; await sleep(200); } return true; };
// (a phone page polls slowly under software rendering: the phone checks allow the poll's own latency)
const near = (v, want, tol) => v != null && Math.abs(v - want) <= tol;
const CDMS = 1500;   // the countdown (Tour._t.CD_MS: Alexander's 1 to 2 s, #250)
const center = (sel) => ev(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(sel)})].find((x) => x.getClientRects().length && x.offsetParent !== null); if (!e) return null; const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
const mdrag = async (x0, y0, x1, y1) => { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0, y: y0 }); await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x0, y: y0, button: 'left', clickCount: 1 }); for (let i = 1; i <= 10; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0 + (x1 - x0) * i / 10, y: y0 + (y1 - y0) * i / 10, button: 'left', buttons: 1 }); await sleep(16); } await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x1, y: y1, button: 'left', clickCount: 1 }); };
const T = (type, pts) => send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p) => ({ x: p[0], y: p[1], id: 1, radiusX: 4, radiusY: 4, force: 1 })) });
const tdrag = async (x0, y0, x1, y1, holdMs = 0) => { await T('touchStart', [[x0, y0]]); if (holdMs) await sleep(holdMs); for (let i = 1; i <= 10; i++) { await T('touchMove', [[x0 + (x1 - x0) * i / 10, y0 + (y1 - y0) * i / 10]]); await sleep(16); } await T('touchEnd', []); };
const tap = async (x, y) => { await T('touchStart', [[x, y]]); await sleep(50); await T('touchEnd', []); };
const paneBox = (sel) => ev(`(() => { const b = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; })()`);
const plane = async () => { for (let i = 0; i < 40; i++) { const L = await lit(); if (L && L.anchor) return L.anchor; await sleep(100); } throw new Error('no anchor at ' + (await cur()) + ' active ' + (await ev('Tour.isActive()'))); };
const tickAfter = async (t0) => { const w = await until(`document.querySelector('.ts-l2').classList.contains('done')`, 3000, 20); return w == null ? null : w + (Date.now() - t0) - w; };

// ---------------- 1440 × 900, mouse, English
await open('au1', 1440, 900, false, false);
// X: no advance without input; a pan of empty space ticks it at once; CD_MS after the release it moves on
await go('basics', 1);
check('x: nothing advances in 3.5 s without input', await stays('basics/x', 3500));
let a = await plane();
let x = a.l + 150, y = a.b - 90;
await mdrag(x, y, x + 60, y - 30);
let t0 = Date.now();
let tk = await until(`document.querySelector('.ts-l2').classList.contains('done')`, 2000, 15);
check('x: the tick within 300 ms of the pan', tk != null && tk <= 300, tk);
let at = await advancedAt('basics/x', t0);
check('x: moves on 1500 ± 150 ms after the release', near(at, CDMS, 150), at);
// Draw: the disc; an input at +1 s changes nothing: the advance stays at CD_MS after the event
await go('basics', 4);
const disc = await center('#tools > .tool[data-tool="disc"]');
await click(disc[0], disc[1]); await settle(200);
a = await paneBox('#paneL');
await mdrag(a.l + 120, a.b - 140, a.l + 170, a.b - 100);
t0 = Date.now();
await until(`document.querySelector('.ts-l2').classList.contains('done')`, 2000, 15);
await sleep(1000 - (Date.now() - t0));
const hd = await center('header .mark');
await click(hd[0], hd[1]);
at = await advancedAt('basics/draw', t0);
check('draw: an input at +1 s changes nothing: CD_MS after the event', near(at, CDMS, 150), at);
// live region: the result line once, then "Next step in 1.5 s."
await go('basics', 4);
await click(disc[0], disc[1]); await settle(200);
await mdrag(a.l + 220, a.b - 140, a.l + 260, a.b - 110);
await sleep(150);
let liveT = await ev(`document.querySelector('.tour-sr[aria-live]').textContent`);
check('live region: "Done.", the result line and "Next step in 1.5 s."', /^Done\. Y shows its image under F\. Next step in 1\.5 s\.$/.test(liveT), liveT);
await advancedAt('basics/draw', Date.now());
// a door: Choose Phase moves on 0.7 s after it
await go('views', 0);
const ph = await center('#viewSwitch > [data-mode="phase"]');
await click(ph[0], ph[1]); t0 = Date.now();
at = await advancedAt('views/switch', t0);
check('door (Three views): 700 ± 100 ms after the event', near(at, 700, 100), at);
// Phase key: a check; an input at +2 s does not restart the countdown
await go('views', 4);
// (v16.5 UX20; #247: on a desktop the check is a toggle in Y's pane head; when the head has no room it is behind the
// head's ⋯ button, which is opened first)
const ob = (await center('#wKeyChkR')) ? null : await center('#rightFoot .opts-btn:not(.pat-btn)');
if (ob) { await click(ob[0], ob[1]); await sleep(400); }
const kc = await center('#wKeyChkR');
check('key: the Phase key check is there', !!kc, kc);
if (kc) {
  await click(kc[0], kc[1]); t0 = Date.now();
  tk = await until(`document.querySelector('.ts-l2').classList.contains('done')`, 2000, 15);
  check('key: ticked within 300 ms', tk != null && tk <= 300, tk);
  await sleep(1000 - (Date.now() - t0));
  await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 700, y: 400, deltaX: 0, deltaY: 40 });
  at = await advancedAt('views/key', t0);
  check('key: a wheel at +1 s changes nothing: CD_MS after the event', near(at, CDMS, 300), at);
}
// (the Display options popover the step opened is closed again, so the next ⌘K opens the palette)
await ev(`(() => { const b = document.querySelector('#rightFoot .opts-btn:not(.pat-btn)'); if (b && b.getAttribute('aria-expanded') === 'true') b.click(); return 1; })()`); await sleep(200);
try {
// a hold: the palette left open 6 s (Palette and keys: its task is done when it opens)
await go('keys', 0);
await key('k', 4); t0 = Date.now();
check('palette: the palette opens and the task ticks', (await until(`document.querySelector('.ts-l2').classList.contains('done')`, 2000)) != null);
check('palette: no advance while it stays open (6 s)', await stays('keys/palette', 6000));
const hold = await lit();
check('palette: the countdown is held by the layer', hold && hold.countdown.state === 'held' && hold.countdown.held.includes('layer'), hold && hold.countdown);
// (r3 review regress-5: no "Next step in 1.5 s" while held; said when the hold ends)
const liveH = await ev(`document.querySelector('.tour-sr[aria-live]').textContent`);
check('palette: while held the live region does not promise 1.5 s', !/1\.5 s/.test(liveH), liveH);
await key('Escape'); t0 = Date.now();
await sleep(200);
const liveR = await ev(`document.querySelector('.tour-sr[aria-live]').textContent`);
check('palette: once it closes the live region says "Next step in 1.5 s."', liveR === 'Next step in 1.5 s.', liveR);
// (keys/palette is not the chapter's last step: it moves on CD_MS after the palette closes)
at = await advancedAt('keys/palette', t0);
check('palette: moves on CD_MS after it closes', near(at, CDMS, 250), at);
} catch (e) { check('a hold: the palette left open 6 s' + ': ran', false, String(e && e.stack || e).slice(0, 300)); try { await ev('Tour.stop()'); } catch (x) { /* */ } }
try {
// (r3 review regress-1) a set added with Enter: the app empties the field, which keeps the focus; an empty field holds
// nothing, so it moves on CD_MS after Enter. A field with text not yet sent holds it
await go('basics', 6);
const fi = await center('#secFormula input, #secFormula textarea, #secFormula [contenteditable]');
if (fi) {
  await click(fi[0], fi[1]); await settle(100);
  await ev(`(() => { const e = document.activeElement; e.value = ''; })()`);
  // (the countdown runs from the step's done, which follows Enter by the formula's compile: the advance is measured from
  // the moment done shows, and the countdown may fire late only as far as the page was blocked)
  await type('|z-1|<2'); await key('Enter'); t0 = Date.now();
  const dD = await doneAt(t0);
  const ff = await lit();
  check('formula: done by the formula field (via formula)', ff && ff.done, ff && ff.countdown);
  // (a main-thread spike across the countdown's due moment, as a formula's program link makes on a software GPU: 400 ms from
  // 100 ms before it is due, so the timer fires about 300 ms late)
  await ev(`setTimeout(() => { const t0 = performance.now(); while (performance.now() - t0 < 400); }, Math.max(0, ${dD ? dD.p + dD.left : 1000} - 100 - performance.now())); 1`);
  const aD = await advanceFrom('basics/formula', dD, 250);
  check('formula: added with Enter, the focus still in the emptied field: moves on CD_MS after it is done, late only as far as the page was blocked', aD.ok, [aD, dD, await ev('document.activeElement && document.activeElement.id')]);
  check('formula: the long-task record sees the 400 ms spike and the advance followed it', aD.blocked >= 350 && aD.at >= dD.left + 200, aD);
  await go('basics', 6);
  await click(fi[0], fi[1]); await settle(100);
  await ev(`(() => { const e = document.activeElement; e.value = ''; })()`);
  await type('|z|<1'); await key('Enter'); await settle(150);
  await type('0<'); await settle(100);
  check('formula: held while the field holds text not yet sent (5 s)', await stays('basics/formula', 5000), await lit());
  await key('Backspace'); await key('Backspace'); t0 = Date.now();
  at = await advancedAt('basics/formula', t0);
  check('formula: moves on CD_MS after that text is gone', near(at, CDMS, 250), at);
} else check('formula: the field is there', false);
} catch (e) { check('a focused text field holds it' + ': ran', false, String(e && e.stack || e).slice(0, 300)); try { await ev('Tour.stop()'); } catch (x) { /* */ } }
try {
// a finger, here the mouse, held down does not hold it: it moves on CD_MS after the task's event
await go('basics', 1);
a = await plane(); x = a.l + 150; y = a.b - 90;
await mdrag(x, y, x + 50, y - 20); t0 = Date.now();
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x + 50, y: y - 20, button: 'left', clickCount: 1 });
at = await advancedAt('basics/x', t0);
check('held down: moves on CD_MS after the event all the same', near(at, CDMS, 250), at);
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x + 50, y: y - 20, button: 'left', clickCount: 1 });
} catch (e) { check('a finger, here the mouse, held down' + ': ran', false, String(e && e.stack || e).slice(0, 300)); try { await ev('Tour.stop()'); } catch (x) { /* */ } }
try {
// the page hidden holds it (document.hidden and visibilitychange, as a switch of tabs gives them; a frozen page in
// headless Chrome stops its frames for good, so it is not used here)
await go('basics', 1);
a = await plane(); await mdrag(a.l + 150, a.b - 90, a.l + 200, a.b - 120);
await ev(`Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); 1`);
check('a hidden page: no advance in 5 s', await stays('basics/x', 5000), await lit());
await ev(`delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); 1`); t0 = Date.now();
at = await advancedAt('basics/x', t0);
check('a hidden page: CD_MS after it shows again', near(at, CDMS, 200), at);
} catch (e) { check('the page hidden (frozen) holds it' + ': ran', false, String(e && e.stack || e).slice(0, 300)); try { await ev('Tour.stop()'); } catch (x) { /* */ } }
try {
// cancels: a press on the strip's text; Back; a step reached with Back; Move on by itself off
await go('basics', 1);
a = await plane(); await mdrag(a.l + 150, a.b - 90, a.l + 200, a.b - 120); await sleep(300);
const txt = await center('.ts-l1');
const tText = Date.now();
await click(txt[0], txt[1]);
check('a laptop\'s strip text is plain: a press on it neither opens anything nor stops the advance', near(await advancedAt('basics/x', tText), CDMS, 700) && !(await ev(`!!document.querySelector('#tourWhy') && document.querySelector('#tourWhy').isConnected`)));
const bk = await center('.ts-back');
await click(bk[0], bk[1]); await settle(1200);
a = await plane(); await mdrag(a.l + 150, a.b - 90, a.l + 200, a.b - 120);
check('a step reached with Back: tick, no advance in 6 s', await stays('basics/x', 6000) && (await lit()).done);
await ev('Tour.auto(false)');
await go('basics', 1);
a = await plane(); await mdrag(a.l + 150, a.b - 90, a.l + 200, a.b - 120);
check('Move on by itself off: tick and ring, no advance in 6 s', await stays('basics/x', 6000) && (await ev(`document.querySelector('.ts-next').classList.contains('ready')`)));
// (r3 review regress-6: a door too)
await go('views', 0);
const phd = await center('#viewSwitch > [data-mode="phase"]');
await click(phd[0], phd[1]);
check('Move on by itself off: a door (Three views) ticks and stays 2 × CD_MS', await stays('views/switch', CDMS * 2) && (await lit()).done, await lit());
await ev('Tour.auto(true)');
} catch (e) { check("cancels: a press on the strip's text" + ': ran', false, String(e && e.stack || e).slice(0, 300)); try { await ev('Tour.stop()'); } catch (x) { /* */ } }
try {
// (r3 review user-5) a chapter's end with a task (Patterns): tick and result, then 3 s into the next chapter
await go('views', 5);
const st = await center('#patternSeg .pat[data-pat="stretch"]');
await click(st[0], st[1]); t0 = Date.now();
const dP = await doneAt(t0);
await sleep(200);
check('Patterns (a chapter\'s end): tick and result', /Blue shrinks/.test(await ev(`document.querySelector('#tourLead').textContent`)) && (await lit()).countdown.state === 'running', await lit());
const aP = await advanceFrom('views/patterns', dP, 250);
check('Patterns: moves on CD_MS after, into Editing the chain (late only as far as the page was blocked)', aP.ok && (await cur()) === 'edit/cards', [aP, dP, await cur()]);
// (r3 review user-1) once a task is done the spotlight steps aside: the shade fades and lets presses through
await go('basics', 1);
a = await plane(); await mdrag(a.l + 150, a.b - 90, a.l + 200, a.b - 120); await sleep(400);
const qq = await ev(`(() => { const L = Tour.lit(), s = document.querySelector('.tour-root .tour-dim'); const e = document.elementFromPoint(innerWidth - 40, innerHeight - 40); return { quiet: L.quiet, op: getComputedStyle(s).opacity, hit: e && !e.closest('[data-tour]') }; })()`);
check('done: the spotlight steps aside (quiet, faded, presses reach the app)', qq.quiet && +qq.op < 0.05 && qq.hit, qq);
} catch (e) { check("a chapter's end with a task (Patterns)" + ': ran', false, String(e && e.stack || e).slice(0, 300)); try { await ev('Tour.stop()'); } catch (x) { /* */ } }
try {
// reduced motion: Next counts down "Next · 2", "· 1" (the seconds left of 1.5)
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
await go('basics', 1);
a = await plane(); await mdrag(a.l + 150, a.b - 90, a.l + 200, a.b - 120);
const labels = [];
for (let i = 0; i < 14; i++) { labels.push(await ev(`document.querySelector('.ts-next') && document.querySelector('.ts-next').textContent`)); await sleep(250); }
check('reduced motion: Next reads "Next · 2", "Next · 1"', ['Next · 2', 'Next · 1'].every((l) => labels.includes(l)), labels);
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
await ev('Tour.stop()'); await settle(400);

} catch (e) { check('reduced motion: Next counts down' + ': ran', false, String(e && e.stack || e).slice(0, 300)); try { await ev('Tour.stop()'); } catch (x) { /* */ } }
try {
// ---------------- the Constructions chapter at 1440 (mouse): "Drag z2 across the line" is done by a disc turning into a
// half-plane or its outside, and the outside is only a complement flip (issue #34, T4)
await go('construct', 0);
const w2s = (x, y) => ev(`__cmwPlaneMenu().w2s('L', ${x}, ${y})`);
const c3b = await center('#constructTools .tool[data-tool="circle3"], #tools .tool[data-tool="circle3"]');
if (c3b) await click(c3b[0], c3b[1]);
await settle(300);
for (const p of [[-1.5, -0.5], [1, -1], [0.25, 1.25]]) { const q = await w2s(p[0], p[1]); await click(q[0], q[1]); await settle(250); }
check('construct: the circle task is done', (await until(`document.querySelector('.ts-l2').classList.contains('done')`, 2500)) != null, [await cur(), await lit()]);
check('construct: the tour moves on to the family step', (await advancedAt('construct/c3', Date.now() - 200, 6000)) != null && (await cur()) === 'construct/follow', await cur());
const sel = await center('#tools .tool[data-tool="select"]');
if (sel) { await click(sel[0], sel[1]); await settle(200); }
// (one drag from above the line to well below it: the disc turns into its outside in a step, never being a half-plane)
const z2a = await w2s(0.25, 1.25), z2c = await w2s(0.25, -2.2);
await mdrag(z2a[0], z2a[1], z2c[0], z2c[1]);
check('construct: dragging z2 across the line ticks the step (the disc becomes its outside)', (await until(`document.querySelector('.ts-l2').classList.contains('done')`, 2500)) != null, [await cur(), await lit()]);
await ev('Tour.stop()'); await settle(300);
} catch (e) { check('the Constructions chapter at 1440' + ': ran', false, String(e && e.stack || e).slice(0, 300)); try { await ev('Tour.stop()'); } catch (x) { /* */ } }
try {
// ---------------- the Sound chapter at 1440 (mouse): Grieg, the phase lines' laps, a loop; the settings come back
await ev(`Sound.set({ on: false, sonify: false }, { quiet: true }); 1`);
await go('sound', 0);
// (the strip shows Listen once the song scene is in, 1.5 to 3 s after the start on a loaded machine)
await until(`[...document.querySelectorAll('.ts-act')].some((e) => e.getClientRects().length && e.offsetParent !== null)`, 6000);
const ab = await center('.ts-act');
await click(ab[0], ab[1]); t0 = Date.now();
const caps = [];
let last = '', durMs = 0;
while (Date.now() - t0 < 30000) {
  const t = await ev(`document.querySelector('#tourLead').textContent`);
  if (t !== last) { caps.push([Date.now() - t0, t.slice(0, 24)]); last = t; }
  // (the function's Listen along; its duration is the circle's length at the zoom, 250 px/s)
  if (!durMs) durMs = 1000 * ((await ev(`(() => { const s = __cmwSound(); return s.listenFn ? s.listenFn.dur : 0; })()`)) || 0);
  if ((await cur()) !== 'sound/song') break;
  await sleep(40);
}
const capAt = (re) => (caps.find((c) => re.test(c[1])) || [null])[0];
// (the Mountain King's F is costly, so Listen along samples it first (f181c88, "Preparing to listen along")
// and starts seconds after the press: the fractions are counted from the playback's start, its first caption)
const capT0 = capAt(/^Each note is/);
check('Grieg: captions change at 0.2, 0.29 and 0.51 of the playback (± 300 ms, from its start: the branch-point pairs, the second downbeat crack, the second lap)', durMs > 0 && capT0 != null && near(capAt(/^Each step is/) - capT0, 0.2 * durMs, 300) && near(capAt(/^The crack is/) - capT0, 0.29 * durMs, 300) && near(capAt(/^The second lap/) - capT0, 0.51 * durMs, 300), [durMs, caps]);
const endAt = capAt(/^Every note/);
check('Grieg: no move for the whole piece, then the result line', endAt != null && endAt > durMs - 300, [durMs, caps]);
check('Grieg: moves on CD_MS after the piece ends', (await cur()) === 'sound/strings' && caps.length >= 5, caps);
// the strings: Hear the function on (held), laps of radius 0.4 round 1 anticlockwise, then round -1
check('Strings: the tour holds Hear the function on', await ev(`Sound.prefs().sonify === true`));
const lap = async (cx) => { const pts = []; for (let i = 0; i <= 48; i++) { const th = -Math.PI / 2 + 2 * Math.PI * i / 48; pts.push(await ev(`__cmwPlaneMenu().w2s('L', ${cx + 0.4 * Math.cos(th)}, ${0.4 * Math.sin(th)})`)); } await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pts[0][0], y: pts[0][1] }); for (const p of pts) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p[0], y: p[1] }); await sleep(30); } };
await lap(1); await lap(-1);
t0 = Date.now();
check('Strings: two laps tick the task', (await until(`document.querySelector('.ts-l2').classList.contains('done')`, 1500)) != null, [await cur(), await ev('Sound.prefs()'), await ev('Sound.state().audio'), await ev('JSON.stringify(Sound.harpState())')]);
// (the pointer rests: no hover travel, so CD_MS)
at = await advancedAt('sound/strings', t0);
check('Strings: moves on about CD_MS after the last lap', at != null && at <= CDMS + 400, at);
check('A loop: Hear the function back to the user\'s (off)', await ev(`Sound.prefs().sonify === false`));
if ((await cur()) === 'sound/strings') await ev('Tour.next()');
await settle(1500);
const lb = await center('.ts-act');
await click(lb[0], lb[1]); t0 = Date.now();
const lp = await until(`document.querySelector('.ts-l2').classList.contains('done')`, 12000, 50);
check('A loop: Listen ends with W = 1, full: ticked', lp != null, lp);
at = await advancedAt('sound/loop', Date.now());
check('A loop: moves on CD_MS after listen-ended', near(at, CDMS, 250), at);
check('Sound settings: the last step of the chapter', (await cur()) === 'sound/settings');
// (r3 review user-6: Sound settings shows the user's own settings, not the tour's)
check('Sound settings: the sound given back there (off, as the user had it)', await ev(`Sound.prefs().on === false && Sound.prefs().sonify === false`), await ev('Sound.prefs()'));
await ev('Tour.next()'); await settle(1500);
check('after the chapter: sound and Hear the function off again (as the user had them)', await ev(`Sound.prefs().on === false && Sound.prefs().sonify === false`), await ev('Sound.prefs()'));
// Esc mid-chapter, and a reload mid-chapter, give them back too
await go('sound', 1);
const sb = await center('.ts-act');
if (sb) { await click(sb[0], sb[1]); await settle(400); }
check('Turn on sound: sound and Hear the function on', await ev(`Sound.prefs().on === true && Sound.prefs().sonify === true`));
await ev(`document.querySelector('.ts-next').focus()`); await key('Escape'); await settle(500);
check('after Esc: both off again', await ev(`!Tour.isActive() && Sound.prefs().on === false && Sound.prefs().sonify === false`), await ev('Sound.prefs()'));
await go('sound', 1);
const sb2 = await center('.ts-act');
if (sb2) { await click(sb2[0], sb2[1]); await settle(400); }
await nav(U + '?ns=au1'); await settle(1800);
check('after a reload mid-chapter: both off again', await ev(`Sound.prefs().on === false && Sound.prefs().sonify === false`), await ev('Sound.prefs()'));

} catch (e) { check('the Sound chapter at 1440' + ': ran', false, String(e && e.stack || e).slice(0, 300)); try { await ev('Tour.stop()'); } catch (x) { /* */ } }
try {
// ---------------- 390 × 844, touch, English
await open('au2', 390, 844, false, true);
await go('basics', 1);
check('phone x: nothing advances in 3.5 s', await stays('basics/x', 3500));
a = await plane();
await tdrag(a.r - 60, a.t + 120, a.r - 140, a.t + 170); t0 = Date.now();
at = await advancedAt('basics/x', t0);
check('phone x: a touch pan, then 1500 ± 600 ms', near(at, CDMS, 600), at);
await go('basics', 4);
const pd = await center('.ph-tile[data-tool="disc"], #tools > .tool[data-tool="disc"]');
await tap(pd[0], pd[1]); await settle(300);
a = await paneBox('#paneL');
await tdrag(a.r - 160, a.t + 100, a.r - 100, a.t + 160); t0 = Date.now();
at = await advancedAt('basics/draw', t0);
check('phone draw: a touch disc, then 1500 ± 600 ms', near(at, CDMS, 600), at);
// a finger held down does not hold it: CD_MS after the task's event
await go('basics', 1);
a = await plane();
await tdrag(a.r - 60, a.t + 120, a.r - 140, a.t + 170); t0 = Date.now();
await T('touchStart', [[a.r - 140, a.t + 170]]); await T('touchMove', [[a.r - 120, a.t + 190]]); await T('touchMove', [[a.r - 100, a.t + 210]]);
at = await advancedAt('basics/x', t0);
check('phone: a finger held down: CD_MS after the event all the same', near(at, CDMS, 600), at);
await T('touchEnd', []);
// the Why panel holds it, and a touch in X folds it (and reaches the app)
await go('basics', 1);
const pt = await center('.ts-text');
await tap(pt[0], pt[1]); await settle(300);
const why = await ev(`(() => { const w = document.querySelector('#tourWhy'), b = w.getBoundingClientRect(); return { open: !w.hidden, h: b.height, max: innerHeight / 2 }; })()`);
check('phone: Why opens a panel at most half the screen', why.open && why.h > 40 && why.h <= why.max + 1, why);
// (v16.5 UX38: the plane's keys are one column at the bottom right of a phone's plane: the pan starts left of it)
await tdrag(a.r - 160, a.b - 160, a.r - 240, a.b - 110);
check('phone: a touch in X folds Why and reaches the app (the pan ticks the task)', await ev(`document.querySelector('#tourWhy').hidden && document.querySelector('.ts-l2').classList.contains('done')`));
// the Constructions chapter by finger: "Drag z2 across the line" is done by a touch drag too (issue #34, T4)
await go('construct', 0);
const moreK = await center('#toolMore > summary');
if (moreK) { await tap(moreK[0], moreK[1]); await settle(500); }
const c3t = await center('.ph-tiles .ph-tile[data-tool="circle3"]');
if (c3t) { await tap(c3t[0], c3t[1]); await settle(600); }
const pb = await paneBox('#paneL'), cx = (pb.l + pb.r) / 2, cy = (pb.t + Math.min(pb.b, 560)) / 2;
for (const p of [[cx - 70, cy + 40], [cx + 70, cy + 40], [cx, cy - 70]]) { await tap(p[0], p[1]); await settle(300); }
check('phone construct: the circle task is done', (await until(`document.querySelector('.ts-l2').classList.contains('done')`, 2500)) != null, [await cur(), await lit()]);
check('phone construct: the tour moves on to the family step', (await advancedAt('construct/c3', Date.now() - 200, 6000)) != null && (await cur()) === 'construct/follow', await cur());
const selK = await center('#secDraw .tool[data-tool="select"], #tools > .tool[data-tool="select"]');
if (selK) { await tap(selK[0], selK[1]); await settle(200); }
await tdrag(cx, cy - 70, cx, cy + 130);
check('phone construct: a finger dragging z2 across the line ticks the step', (await until(`document.querySelector('.ts-l2').classList.contains('done')`, 2500)) != null, [await cur(), await lit()]);
await ev('Tour.stop()'); await settle(300);

} catch (e) { check('390 × 844, touch, English' + ': ran', false, String(e && e.stack || e).slice(0, 300)); try { await ev('Tour.stop()'); } catch (x) { /* */ } }
try {
// ---------------- the Sound chapter at 390 × 844, touch, Russian
await open('au3', 390, 844, true, true, 'ru');
await ev(`Sound.set({ on: false, sonify: false }, { quiet: true }); 1`);
await go('sound', 0);
await until(`[...document.querySelectorAll('.ts-act')].some((e) => e.getClientRects().length && e.offsetParent !== null)`, 6000);
const ra = await center('.ts-act');
check('RU Grieg: the strip shows its Listen button', !!ra, await lit());
if (!ra) throw new Error('no Listen button on the phone strip');
await tap(ra[0], ra[1]);
// (the Mountain King's F is costly: Listen along prepares its samples first, so the times count from the playback's
// start, which the function's own Listen along marks: __cmwSound().listenFn)
const ruWait = await until(`(() => { const s = __cmwSound(); return !!s.listenFn; })()`, 25000);
t0 = Date.now();
const ruDur = await ev(`(() => { const s = __cmwSound(); return s.listenFn ? s.listenFn.dur : null; })()`);
check('RU Grieg: the function plays within 25 s of the press', ruWait != null && ruDur > 0, [ruWait, ruDur, await lit()]);
// (the first caption holds for the first 0.2 of the playback (capFrac), 1.5 s of this phone's 7.5 s: it is read while
// it shows, polled within 0.18 of the playback from its start, never at a fixed moment, which can land on the next one)
const capWin = Math.max(300, 180 * (ruDur || 7.5) - (Date.now() - t0));
await until(`/Нота/.test(document.querySelector('#tourLead').textContent)`, capWin);
const ruCap = await ev(`document.querySelector('#tourLead').textContent`);
check('RU Grieg: the first caption in Russian', /Нота/.test(ruCap), [ruCap, capWin]);
const fit = await ev(`(() => { const e = document.querySelector('.ts-lead'); return e.scrollHeight <= e.clientHeight + 1 && e.scrollWidth <= e.clientWidth + 1 && document.querySelector('.ts-l2').scrollHeight <= document.querySelector('.ts-l2').clientHeight + 1; })()`);
check('RU Grieg: the caption fits the strip', fit);
// stopped at 60 % of the piece (at most 10 s) from its start: listen-ended with heard >= min(9 s, 45 % of it) is done;
// then +CD_MS. The function's duration is the circle's length at the zoom, 250 px/s: 7.5 s on this phone
const stopAt = Math.min(10000, 600 * (ruDur || 10));
await sleep(Math.max(0, stopAt - (Date.now() - t0)));
const sa = await center('.ts-act');
check('RU Grieg: the strip shows Stop while it plays', !!sa, await lit());
if (!sa) throw new Error('no Stop button on the phone strip');
await tap(sa[0], sa[1]); t0 = Date.now();
at = await advancedAt('sound/song', t0, 6000);
check(`RU Grieg: stopped at ${(stopAt / 1000).toFixed(1)} s counts: +CD_MS`, near(at, CDMS, 600), [at, await lit(), await ev('document.activeElement && document.activeElement.outerHTML.slice(0, 80)')]);
await settle(1500);
check('RU strings: on the strings step, with its Russian task', (await cur()) === 'sound/strings' && /Удерживайте палец/.test(await ev(`document.querySelector('#tourLead').textContent`)), await ev(`document.querySelector('#tourLead').textContent`));
const rs = await center('.ts-act');
if (rs) { await tap(rs[0], rs[1]); await settle(400); }
// a hold near 1, then a slide round it, then round -1
const tlap = async (cx) => { const pts = []; for (let i = 0; i <= 40; i++) { const th = -Math.PI / 2 + 2 * Math.PI * i / 40; pts.push(await ev(`__cmwPlaneMenu().w2s('L', ${cx + 0.4 * Math.cos(th)}, ${0.4 * Math.sin(th)})`)); } await T('touchStart', [pts[0]]); await sleep(600); for (const p of pts) { await T('touchMove', [p]); await sleep(25); } await T('touchEnd', []); };
await tlap(1); await tlap(-1); t0 = Date.now();
check('RU strings: hold then slide round 1 and -1 ticks it', (await until(`document.querySelector('.ts-l2').classList.contains('done')`, 1500)) != null, await lit());
at = await advancedAt('sound/strings', t0);
check('RU strings: then +CD_MS', near(at, CDMS, 600), at);
await ev('Tour.stop()'); await settle(300);
check('RU: the sound back off after the tour', await ev(`Sound.prefs().on === false && Sound.prefs().sonify === false`));
// (r3 review user-6: a change the user makes during the chapter is theirs: Hear the function turned on in the strings
// step stays on after the chapter)
await go('sound', 1);
const rs2 = await center('.ts-act');
if (rs2) { await tap(rs2[0], rs2[1]); await settle(400); }
await ev(`(() => { const c = document.querySelector('#sndSo'); c.checked = false; c.dispatchEvent(new Event('change')); c.checked = true; c.dispatchEvent(new Event('change')); return 1; })()`);
await ev('Tour.stop()'); await settle(300);
check('RU: Hear the function, set by the user during the chapter, stays theirs after it', await ev(`Sound.prefs().sonify === true`), await ev('Sound.prefs()'));
await ev(`Sound.set({ on: false, sonify: false }, { quiet: true }); 1`);

} catch (e) { check('the Sound chapter at 390 × 844, touch, R' + ': ran', false, String(e && e.stack || e).slice(0, 300)); try { await ev('Tour.stop()'); } catch (x) { /* */ } }
try {
// ---------------- r3 review: the phone fixes at 390 × 844 and 360 × 740 (touch)
await open('au4', 390, 844, false, true);
// user-7: × and the chevron in the portrait row; Next an arrow named by its label
await go('basics', 1);
const row = await ev(`(() => { const s = document.querySelector('.tour-strip'), vis = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden'; const x = s.querySelector('.ts-x'), n = s.querySelector('.ts-next'); return { x: vis(x) && x.getBoundingClientRect().width >= 44, chev: vis(s.querySelector('.ts-chev svg')), next: n.getAttribute('aria-label'), w: n.getBoundingClientRect().width }; })()`);
check('phone: × End in the portrait row (44 px), a chevron after the count, Next an arrow named Next (Skip while a task is open)', row.x && row.chev && (row.next === 'Next' || row.next === 'Skip') && row.w >= 44, row);
// user-1: the chain, the card then the lens in the sheet: ticked, nothing holds it, the sheet's × works, moves on
await go('basics', 7);
// (#246: the card is a row of the chain sheet; the step lights "N steps ▾" while the sheet is closed, and a user taps it first)
if (!(await center('#pipeline .card[data-k="1"]'))) { const cs = await center('.ph-csteps'); if (cs) { await tap(cs[0], cs[1]); await settle(800); } }
const c1 = await center('#pipeline .card[data-k="1"]');
await tap(c1[0], c1[1]); await settle(1000);
const ln = await center('#propsPanel .insp-step .ihead .alone-btn');
await tap(ln[0], ln[1]); t0 = Date.now();
const dC = await doneAt(t0);
await sleep(400);
const ch = await lit();
check('phone chain: the lens ticks it and nothing holds the countdown (the sheet is part of the step)', ch.done && ch.countdown.state === 'running' && !ch.countdown.held.length, ch.countdown);
const xb = await ev(`(() => { const e = [...document.querySelectorAll('.ph-sheet:not([hidden]) .ph-x, .ph-sheet:not([hidden]) [aria-label="Close"]')].find((x) => x.getClientRects().length); if (!e) return null; const b = e.getBoundingClientRect(); const h = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return { hit: !!h && (h === e || e.contains(h)) }; })()`);
check('phone chain: the sheet\'s close button can be pressed (no shade over it)', !xb || xb.hit, xb);
const aC = await advanceFrom('basics/chain', dC, 600);
check('phone chain: moves on CD_MS after the lens (late only as far as the page was blocked)', aC.ok, [aC, dC]);
// user-2: Sets from formulas asks its task on a phone too, and moves on
await go('basics', 6);
const fl = await ev(`document.querySelector('#tourLead').textContent`);
check('phone formula: the task shows (a ring), not a lead', /Type/.test(fl) && !(await ev(`document.querySelector('.ts-ring').hidden`)), fl);
const pf = await center('#formulaInput');
if (pf) {
  await tap(pf[0], pf[1]); await settle(200);
  await type('|z+1|<1');
  const add = await ev(`(() => { const e = [...document.querySelectorAll('#secFormula button')].find((x) => x.getClientRects().length && /Add/.test(x.textContent)); if (!e) return null; const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
  if (add) await tap(add[0], add[1]); else await key('Enter');
  t0 = Date.now();
  const dF = await doneAt(t0);
  const aF = await advanceFrom('basics/formula', dF, 600);
  check('phone formula: Add ticks it and it moves on CD_MS after it is done (late only as far as the page was blocked)', aF.ok, [aF, dF, await lit()]);
} else check('phone formula: the field is there', false);
// user-9: a hold shorter than the ring pans Y: the line says why
await go('basics', 3);
const pr = await paneBox('#paneR');
await tdrag(pr.l + (pr.r - pr.l) / 2, pr.t + (pr.b - pr.t) / 2, pr.l + (pr.r - pr.l) / 2 + 60, pr.t + (pr.b - pr.t) / 2 + 20, 250);
await sleep(500);
const hl = await ev(`document.querySelector('#tourLead').textContent`);
check('phone preimages: a short hold that pans Y shows the hint', /ring fills/.test(hl) && /moved Y/.test(hl), hl);
await ev('Tour.stop()'); await settle(400);
// regress-7: the root has no style attribute after the tour (it had none before)
check('phone: no style left on the root after the tour', await ev(`document.documentElement.getAttribute('style') == null`), await ev(`document.documentElement.getAttribute('style')`));
// user-3: Russian at 360 px: every caption and the result fit, the strip three lines in the Sound chapter
await open('au5', 360, 740, true, true, 'ru');
await ev(`Sound.set({ on: false, sonify: false }, { quiet: true }); 1`);
await go('sound', 0);
const need = await ev('Tour._t.needLines()');
check('RU 360: the Sound chapter needs at most 3 lines, and the strip has them', need <= 3 && (await lit()).lines === Math.max(2, need), [need, (await lit()).lines]);
const pa = await center('.ts-act');
await tap(pa[0], pa[1]); t0 = Date.now();
const seenC = []; let lastC = '', cutC = [];
while (Date.now() - t0 < 27000 && (await cur()) === 'sound/song') {
  const g = await ev(`(() => { const s = document.querySelector('.tour-strip'), l2 = s.querySelector('.ts-l2'), t = s.querySelector('.ts-text'); return { lead: document.querySelector('#tourLead').textContent, cut: l2.getBoundingClientRect().bottom > s.getBoundingClientRect().bottom + 0.5 || t.scrollHeight > t.clientHeight + 1, title: s.querySelector('.ts-title').getBoundingClientRect().top >= s.getBoundingClientRect().top - 0.5 }; })()`);
  if (g.lead !== lastC) { lastC = g.lead; seenC.push(g.lead.slice(0, 20)); if (g.cut || !g.title) cutC.push(g); }
  await sleep(120);
}
check('RU 360: four captions and the result, none cut, the title in place', seenC.length >= 5 && !cutC.length, { seenC, cutC });
await ev('Tour.isActive() && Tour.stop()'); await settle(300);
// user-10: landscape Russian, Part of the chain: the strip takes the row under the header, its task not cut
await open('au6', 844, 390, true, true, 'ru');
await go('deform', 4);
const lr = await ev(`(() => { const s = document.querySelector('.tour-strip'), l2 = s.querySelector('.ts-l2'), t = s.querySelector('.ts-text'); return { mode: s.dataset.mode, cut: l2.getBoundingClientRect().bottom > s.getBoundingClientRect().bottom + 0.5 || t.scrollHeight > t.clientHeight + 1, lead: document.querySelector('#tourLead').textContent }; })()`);
check('RU landscape: Part of the chain\'s task not cut (the row under the header)', !lr.cut, lr);
await ev('Tour.isActive() && Tour.stop()'); await settle(300);
} catch (e) { check('r3 review phone fixes' + ': ran', false, String(e && e.stack || e).slice(0, 300)); try { await ev('Tour.stop()'); } catch (x) { /* */ } }
try {
// ---------------- a small laptop (1366 × 657): no sheet (a laptop's strip is one row); the panes keep their size
await open('au7', 1366, 657, false, false);
await go('analysis', 0);
const p0 = await paneBox('#panes');
const wt = await center('.ts-l1');
await click(wt[0], wt[1]); await settle(400);
const p1 = await paneBox('#panes');
const wl = await lit();
check('1366 × 657: a press on the text opens no sheet, the panes keep their size', !wl.why && !wl.whyPanel && Math.abs((p1.b - p1.t) - (p0.b - p0.t)) < 1, { p0, p1, why: wl.why, panel: wl.whyPanel });
check('1366 × 657: the panes keep at least 330 px with the strip', p0.b - p0.t >= 330, p0);
await ev('Tour.stop()'); await settle(300);
} catch (e) { check('a small laptop' + ': ran', false, String(e && e.stack || e).slice(0, 300)); try { await ev('Tour.stop()'); } catch (x) { /* */ } }
try {
// the screen-reader line of the tour (class tour-sr, #tourSay) is out of the flow: at 1366 × 768 the page is not taller than the window
await open('au8', 1366, 768, false, false);
await go('analysis', 0); await ev('Tour.stop()'); await settle(300); // the tour's CSS is injected on first use
const sh = await ev(`(() => { const n = document.createElement('div'); n.className = 'tour-sr'; n.textContent = 'x'; document.body.append(n); const r = { sh: document.documentElement.scrollHeight, ih: innerHeight, top: Math.round(n.getBoundingClientRect().top) }; n.remove(); return r; })()`);
check('1366 × 768: a tour-sr line at the end of the body does not make the page taller than the window', sh.sh <= sh.ih, sh);
} catch (e) { check('1366 × 768 page height' + ': ran', false, String(e && e.stack || e).slice(0, 300)); try { await ev('Tour.stop()'); } catch (x) { /* */ } }
await view(1440, 900, false, false);
const L = logs().filter((l) => /EXC|\[tour\]/i.test(l.t + l.m)).slice(0, 12);
check('no exceptions or tour warnings', !L.length, L);
return { pass: R.filter((r) => r[1]).length, of: R.length, fails: R.filter((r) => !r[1]), logs: L };
