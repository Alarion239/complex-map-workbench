// v16.4 (notes/tour-r3/SPEC.md 7.6): the tour's completion conditions and its auto-advance, with real CDP input, at
// 1440 × 900 (mouse, English) and 390 × 844 (touch, English), and the Sound chapter at 390 × 844 (touch, Russian) and
// 1440 (mouse laps round the zero and the pole). Each task: no advance without input; the tick within 300 ms of the
// event; the advance 3000 ± 150 ms after the last input (doors 700 ± 100); restarts, holds and cancels; the sound
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
const stays = async (id, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await cur()) !== id) return false; await sleep(200); } return true; };
const near = (v, want, tol) => v != null && Math.abs(v - want) <= tol;
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
// X: no advance without input; a pan of empty space ticks it at once; 3 s after the release it moves on
await go('basics', 1);
check('x: nothing advances in 3.5 s without input', await stays('basics/x', 3500));
let a = await plane();
let x = a.l + 150, y = a.b - 90;
await mdrag(x, y, x + 60, y - 30);
let t0 = Date.now();
let tk = await until(`document.querySelector('.ts-l2').classList.contains('done')`, 2000, 15);
check('x: the tick within 300 ms of the pan', tk != null && tk <= 300, tk);
let at = await advancedAt('basics/x', t0);
check('x: moves on 3000 ± 150 ms after the release', near(at, 3000, 150), at);
// Draw: the disc; an input at +2 s moves the advance to +5 s
await go('basics', 4);
const disc = await center('#tools > .tool[data-tool="disc"]');
await click(disc[0], disc[1]); await settle(200);
a = await paneBox('#paneL');
await mdrag(a.l + 120, a.b - 140, a.l + 170, a.b - 100);
t0 = Date.now();
await until(`document.querySelector('.ts-l2').classList.contains('done')`, 2000, 15);
await sleep(2000 - (Date.now() - t0));
const hd = await center('header .wordmark');
await click(hd[0], hd[1]);
const t1 = Date.now();
at = await advancedAt('basics/draw', t1);
check('draw: an input at +2 s moves the advance to 3 s after it', near(at, 3000, 150), at);
// live region: the result line once, then "Next step in 3 seconds."
await go('basics', 4);
await click(disc[0], disc[1]); await settle(200);
await mdrag(a.l + 220, a.b - 140, a.l + 260, a.b - 110);
await sleep(150);
let liveT = await ev(`document.querySelector('.tour-sr[aria-live]').textContent`);
check('live region: "Done.", the result line and "Next step in 3 seconds."', /^Done\. Y shows its image under F\. Next step in 3 seconds\.$/.test(liveT), liveT);
await advancedAt('basics/draw', Date.now());
// a door: Choose Phase moves on 0.7 s after it
await go('views', 0);
const ph = await center('#viewSwitch > [data-mode="phase"]');
await click(ph[0], ph[1]); t0 = Date.now();
at = await advancedAt('views/switch', t0);
check('door (Three views): 700 ± 100 ms after the event', near(at, 700, 100), at);
// Phase key: a check; an input at +2 s restarts the countdown
await go('views', 4);
const kc = await center('#wKeyChkR');
check('key: the Phase key check is there', !!kc, kc);
if (kc) {
  await click(kc[0], kc[1]); t0 = Date.now();
  tk = await until(`document.querySelector('.ts-l2').classList.contains('done')`, 2000, 15);
  check('key: ticked within 300 ms', tk != null && tk <= 300, tk);
  await sleep(2000 - (Date.now() - t0));
  await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 700, y: 400, deltaX: 0, deltaY: 40 });
  at = await advancedAt('views/key', Date.now());
  check('key: a wheel at +2 s moves the advance to 3 s after it', near(at, 3000, 200), at);
}
try {
// a hold: the palette left open 6 s (Palette and keys: its task is done when it opens)
await go('keys', 0);
await key('k', 4); t0 = Date.now();
check('palette: the palette opens and the task ticks', (await until(`document.querySelector('.ts-l2').classList.contains('done')`, 2000)) != null);
check('palette: no advance while it stays open (6 s)', await stays('keys/palette', 6000));
const hold = await lit();
check('palette: the countdown is held by the layer', hold && hold.countdown.state === 'held' && hold.countdown.held.includes('layer'), hold && hold.countdown);
// (r3 review regress-5: no "Next step in 3 seconds" while held; said when the hold ends)
const liveH = await ev(`document.querySelector('.tour-sr[aria-live]').textContent`);
check('palette: while held the live region does not promise 3 seconds', !/3 seconds/.test(liveH), liveH);
await key('Escape'); t0 = Date.now();
await sleep(200);
const liveR = await ev(`document.querySelector('.tour-sr[aria-live]').textContent`);
check('palette: once it closes the live region says "Next step in 3 seconds."', liveR === 'Next step in 3 seconds.', liveR);
// (keys/palette is not the chapter's last step: it moves on 3 s after the palette closes)
at = await advancedAt('keys/palette', t0);
check('palette: moves on 3 s after it closes', near(at, 3000, 250), at);
} catch (e) { check('a hold: the palette left open 6 s' + ': ran', false, String(e && e.stack || e).slice(0, 300)); try { await ev('Tour.stop()'); } catch (x) { /* */ } }
try {
// (r3 review regress-1) a set added with Enter: the app empties the field, which keeps the focus; an empty field holds
// nothing, so it moves on 3 s after Enter. A field with text not yet sent holds it
await go('basics', 6);
const fi = await center('#secFormula input, #secFormula textarea, #secFormula [contenteditable]');
if (fi) {
  await click(fi[0], fi[1]); await settle(100);
  await ev(`(() => { const e = document.activeElement; e.value = ''; })()`);
  await type('|z-1|<2'); await key('Enter'); t0 = Date.now(); await settle(150);
  const ff = await lit();
  check('formula: done by the formula field (via formula)', ff && ff.done, ff && ff.countdown);
  at = await advancedAt('basics/formula', t0);
  check('formula: added with Enter, the focus still in the emptied field: moves on 3 s after Enter', near(at, 3000, 250), [at, await ev('document.activeElement && document.activeElement.id')]);
  await go('basics', 6);
  await click(fi[0], fi[1]); await settle(100);
  await ev(`(() => { const e = document.activeElement; e.value = ''; })()`);
  await type('|z|<1'); await key('Enter'); await settle(150);
  await type('0<'); await settle(100);
  check('formula: held while the field holds text not yet sent (5 s)', await stays('basics/formula', 5000), await lit());
  await key('Backspace'); await key('Backspace'); t0 = Date.now();
  at = await advancedAt('basics/formula', t0);
  check('formula: moves on 3 s after that text is gone', near(at, 3000, 250), at);
} else check('formula: the field is there', false);
} catch (e) { check('a focused text field holds it' + ': ran', false, String(e && e.stack || e).slice(0, 300)); try { await ev('Tour.stop()'); } catch (x) { /* */ } }
try {
// a finger, here the mouse, held down 6 s holds it
await go('basics', 1);
a = await plane(); x = a.l + 150; y = a.b - 90;
await mdrag(x, y, x + 50, y - 20);
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x + 50, y: y - 20, button: 'left', clickCount: 1 });
check('held down: no advance in 6 s', await stays('basics/x', 6000));
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x + 50, y: y - 20, button: 'left', clickCount: 1 }); t0 = Date.now();
at = await advancedAt('basics/x', t0);
check('held down: moves on 3 s after the release', near(at, 3000, 200), at);
} catch (e) { check('a finger, here the mouse, held down 6 s' + ': ran', false, String(e && e.stack || e).slice(0, 300)); try { await ev('Tour.stop()'); } catch (x) { /* */ } }
try {
// the page hidden holds it (document.hidden and visibilitychange, as a switch of tabs gives them; a frozen page in
// headless Chrome stops its frames for good, so it is not used here)
await go('basics', 1);
a = await plane(); await mdrag(a.l + 150, a.b - 90, a.l + 200, a.b - 120);
await ev(`Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); 1`);
check('a hidden page: no advance in 5 s', await stays('basics/x', 5000), await lit());
await ev(`delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); 1`); t0 = Date.now();
at = await advancedAt('basics/x', t0);
check('a hidden page: 3 s after it shows again', near(at, 3000, 200), at);
} catch (e) { check('the page hidden (frozen) holds it' + ': ran', false, String(e && e.stack || e).slice(0, 300)); try { await ev('Tour.stop()'); } catch (x) { /* */ } }
try {
// cancels: a press on the strip's text; Back; a step reached with Back; Move on by itself off
await go('basics', 1);
a = await plane(); await mdrag(a.l + 150, a.b - 90, a.l + 200, a.b - 120); await sleep(300);
const txt = await center('.ts-text');
await click(txt[0], txt[1]);
check('cancel: a press on the strip\'s text, no advance in 6 s', await stays('basics/x', 6000));
await ev('Tour.next()'); await settle(900);
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
check('Move on by itself off: a door (Three views) ticks and stays 3 s', await stays('views/switch', 3000) && (await lit()).done, await lit());
await ev('Tour.auto(true)');
} catch (e) { check("cancels: a press on the strip's text" + ': ran', false, String(e && e.stack || e).slice(0, 300)); try { await ev('Tour.stop()'); } catch (x) { /* */ } }
try {
// (r3 review user-5) a chapter's end with a task (Patterns): tick and result, then 3 s into the next chapter
await go('views', 5);
const st = await center('#patternSeg .pat[data-pat="stretch"]');
await click(st[0], st[1]); t0 = Date.now();
await sleep(200);
check('Patterns (a chapter\'s end): tick and result', /Blue shrinks/.test(await ev(`document.querySelector('#tourLead').textContent`)) && (await lit()).countdown.state === 'running', await lit());
at = await advancedAt('views/patterns', t0);
check('Patterns: moves on 3 s after, into Editing the chain', near(at, 3000, 250) && (await cur()) === 'edit/cards', [at, await cur()]);
// (r3 review user-1) once a task is done the spotlight steps aside: the shade fades and lets presses through
await go('basics', 1);
a = await plane(); await mdrag(a.l + 150, a.b - 90, a.l + 200, a.b - 120); await sleep(400);
const qq = await ev(`(() => { const L = Tour.lit(), s = document.querySelector('.tour-root .tour-dim'); const e = document.elementFromPoint(innerWidth - 40, innerHeight - 40); return { quiet: L.quiet, op: getComputedStyle(s).opacity, hit: e && !e.closest('[data-tour]') }; })()`);
check('done: the spotlight steps aside (quiet, faded, presses reach the app)', qq.quiet && +qq.op < 0.05 && qq.hit, qq);
} catch (e) { check("a chapter's end with a task (Patterns)" + ': ran', false, String(e && e.stack || e).slice(0, 300)); try { await ev('Tour.stop()'); } catch (x) { /* */ } }
try {
// reduced motion: Next counts down "Next · 3", "· 2", "· 1"
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
await go('basics', 1);
a = await plane(); await mdrag(a.l + 150, a.b - 90, a.l + 200, a.b - 120);
const labels = [];
for (let i = 0; i < 14; i++) { labels.push(await ev(`document.querySelector('.ts-next') && document.querySelector('.ts-next').textContent`)); await sleep(250); }
check('reduced motion: Next reads "Next · 3", "Next · 2", "Next · 1"', ['Next · 3', 'Next · 2', 'Next · 1'].every((l) => labels.includes(l)), labels);
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
await ev('Tour.stop()'); await settle(400);

} catch (e) { check('reduced motion: Next counts down' + ': ran', false, String(e && e.stack || e).slice(0, 300)); try { await ev('Tour.stop()'); } catch (x) { /* */ } }
try {
// ---------------- the Sound chapter at 1440 (mouse): Grieg, the phase lines' laps, a loop; the settings come back
await ev(`Sound.set({ on: false, sonify: false }, { quiet: true }); 1`);
await go('sound', 0);
const ab = await center('.ts-act');
await click(ab[0], ab[1]); t0 = Date.now();
const caps = [];
let last = '', durMs = 0;
while (Date.now() - t0 < 30000) {
  const t = await ev(`document.querySelector('#tourLead').textContent`);
  if (t !== last) { caps.push([Date.now() - t0, t.slice(0, 24)]); last = t; }
  // (v16.5: the function's Listen along; its duration is the circle's length at the zoom, 250 px/s)
  if (!durMs) durMs = 1000 * ((await ev(`(() => { const s = __cmwSound(); return s.listenFn ? s.listenFn.dur : 0; })()`)) || 0);
  if ((await cur()) !== 'sound/song') break;
  await sleep(40);
}
const capAt = (re) => (caps.find((c) => re.test(c[1])) || [null])[0];
check('Grieg: captions change at 0.2, 0.29 and 0.51 of the playback (± 300 ms, from the press: the branch-point pairs, the second downbeat crack, the second lap)', durMs > 0 && near(capAt(/^Each step is/), 0.2 * durMs, 300) && near(capAt(/^The crack is/), 0.29 * durMs, 300) && near(capAt(/^The second lap/), 0.51 * durMs, 300), [durMs, caps]);
const endAt = capAt(/^Every note/);
check('Grieg: no move for the whole piece, then the result line', endAt != null && endAt > durMs - 300, [durMs, caps]);
check('Grieg: moves on 3 s after the piece ends', (await cur()) === 'sound/strings' && caps.length >= 5, caps);
// the strings: Hear the function on (held), laps of radius 0.4 round 1 anticlockwise, then round -1
check('Strings: the tour holds Hear the function on', await ev(`Sound.prefs().sonify === true`));
const lap = async (cx) => { const pts = []; for (let i = 0; i <= 48; i++) { const th = -Math.PI / 2 + 2 * Math.PI * i / 48; pts.push(await ev(`__cmwPlaneMenu().w2s('L', ${cx + 0.4 * Math.cos(th)}, ${0.4 * Math.sin(th)})`)); } await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pts[0][0], y: pts[0][1] }); for (const p of pts) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p[0], y: p[1] }); await sleep(30); } };
await lap(1); await lap(-1);
t0 = Date.now();
check('Strings: two laps tick the task', (await until(`document.querySelector('.ts-l2').classList.contains('done')`, 1500)) != null, [await cur(), await ev('Sound.prefs()'), await ev('Sound.state().audio'), await ev('JSON.stringify(Sound.harpState())')]);
// (the pointer rests: no hover travel, so 3 s)
at = await advancedAt('sound/strings', t0);
check('Strings: moves on about 3 s after the last lap', at != null && at <= 3400, at);
check('A loop: Hear the function back to the user\'s (off)', await ev(`Sound.prefs().sonify === false`));
if ((await cur()) === 'sound/strings') await ev('Tour.next()');
await settle(1500);
const lb = await center('.ts-act');
await click(lb[0], lb[1]); t0 = Date.now();
const lp = await until(`document.querySelector('.ts-l2').classList.contains('done')`, 12000, 50);
check('A loop: Listen ends with W = 1, full: ticked', lp != null, lp);
at = await advancedAt('sound/loop', Date.now());
check('A loop: moves on 3 s after listen-ended', near(at, 3000, 250), at);
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
check('phone x: a touch pan, then 3000 ± 150 ms', near(at, 3000, 150), at);
await go('basics', 4);
const pd = await center('.ph-tile[data-tool="disc"], #tools > .tool[data-tool="disc"]');
await tap(pd[0], pd[1]); await settle(300);
a = await paneBox('#paneL');
await tdrag(a.r - 160, a.t + 100, a.r - 100, a.t + 160); t0 = Date.now();
at = await advancedAt('basics/draw', t0);
check('phone draw: a touch disc, then 3000 ± 150 ms', near(at, 3000, 150), at);
// a finger held down 6 s
await go('basics', 1);
a = await plane();
await tdrag(a.r - 60, a.t + 120, a.r - 140, a.t + 170);
await T('touchStart', [[a.r - 140, a.t + 170]]); await T('touchMove', [[a.r - 120, a.t + 190]]); await T('touchMove', [[a.r - 100, a.t + 210]]);
check('phone: a finger held down 6 s (a pan, then still), no advance', await stays('basics/x', 6000));
await T('touchEnd', []); t0 = Date.now();
at = await advancedAt('basics/x', t0);
check('phone: 3 s after the finger lifts', near(at, 3000, 250), at);
// the Why panel holds it, and a touch in X folds it (and reaches the app)
await go('basics', 1);
const pt = await center('.ts-text');
await tap(pt[0], pt[1]); await settle(300);
const why = await ev(`(() => { const w = document.querySelector('#tourWhy'), b = w.getBoundingClientRect(); return { open: !w.hidden, h: b.height, max: innerHeight / 2 }; })()`);
check('phone: Why opens a panel at most half the screen', why.open && why.h > 40 && why.h <= why.max + 1, why);
await tdrag(a.r - 60, a.b - 160, a.r - 140, a.b - 110);
check('phone: a touch in X folds Why and reaches the app (the pan ticks the task)', await ev(`document.querySelector('#tourWhy').hidden && document.querySelector('.ts-l2').classList.contains('done')`));
await ev('Tour.stop()'); await settle(300);

} catch (e) { check('390 × 844, touch, English' + ': ran', false, String(e && e.stack || e).slice(0, 300)); try { await ev('Tour.stop()'); } catch (x) { /* */ } }
try {
// ---------------- the Sound chapter at 390 × 844, touch, Russian
await open('au3', 390, 844, true, true, 'ru');
await ev(`Sound.set({ on: false, sonify: false }, { quiet: true }); 1`);
await go('sound', 0);
const ra = await center('.ts-act');
await tap(ra[0], ra[1]); t0 = Date.now();
await sleep(1500);
const ruCap = await ev(`document.querySelector('#tourLead').textContent`);
check('RU Grieg: the first caption in Russian', /Нота/.test(ruCap), ruCap);
const fit = await ev(`(() => { const e = document.querySelector('.ts-lead'); return e.scrollHeight <= e.clientHeight + 1 && e.scrollWidth <= e.clientWidth + 1 && document.querySelector('.ts-l2').scrollHeight <= document.querySelector('.ts-l2').clientHeight + 1; })()`);
check('RU Grieg: the caption fits the strip', fit);
// stopped at 10 s: listen-ended with heard >= 9 is done; then +3 s
await sleep(10000 - (Date.now() - t0));
const sa = await center('.ts-act');
await tap(sa[0], sa[1]); t0 = Date.now();
at = await advancedAt('sound/song', t0, 6000);
check('RU Grieg: stopped at 10 s counts (past the second drum): +3 s', near(at, 3000, 300), [at, await lit(), await ev('document.activeElement && document.activeElement.outerHTML.slice(0, 80)')]);
await settle(1500);
check('RU strings: on the strings step, with its Russian task', (await cur()) === 'sound/strings' && /Удерживайте палец/.test(await ev(`document.querySelector('#tourLead').textContent`)), await ev(`document.querySelector('#tourLead').textContent`));
const rs = await center('.ts-act');
if (rs) { await tap(rs[0], rs[1]); await settle(400); }
// a hold near 1, then a slide round it, then round -1
const tlap = async (cx) => { const pts = []; for (let i = 0; i <= 40; i++) { const th = -Math.PI / 2 + 2 * Math.PI * i / 40; pts.push(await ev(`__cmwPlaneMenu().w2s('L', ${cx + 0.4 * Math.cos(th)}, ${0.4 * Math.sin(th)})`)); } await T('touchStart', [pts[0]]); await sleep(600); for (const p of pts) { await T('touchMove', [p]); await sleep(25); } await T('touchEnd', []); };
await tlap(1); await tlap(-1); t0 = Date.now();
check('RU strings: hold then slide round 1 and -1 ticks it', (await until(`document.querySelector('.ts-l2').classList.contains('done')`, 1500)) != null, await lit());
at = await advancedAt('sound/strings', t0);
check('RU strings: then +3 s', near(at, 3000, 300), at);
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
const row = await ev(`(() => { const s = document.querySelector('.tour-strip'), vis = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden'; const x = s.querySelector('.ts-x'), n = s.querySelector('.ts-next'); return { x: vis(x) && x.getBoundingClientRect().width >= 44, chev: vis(s.querySelector('.ts-wl svg')), next: n.getAttribute('aria-label'), w: n.getBoundingClientRect().width }; })()`);
check('phone: × End in the portrait row (44 px), a chevron after the count, Next an arrow named "Next"', row.x && row.chev && row.next === 'Next' && row.w >= 44, row);
// user-1: the chain, the card then the lens in the sheet: ticked, nothing holds it, the sheet's × works, moves on
await go('basics', 7);
const c1 = await center('#pipeline .card[data-k="1"]');
await tap(c1[0], c1[1]); await settle(1000);
const ln = await center('#propsPanel .insp-step .ihead .alone-btn');
await tap(ln[0], ln[1]); t0 = Date.now(); await sleep(400);
const ch = await lit();
check('phone chain: the lens ticks it and nothing holds the countdown (the sheet is part of the step)', ch.done && ch.countdown.state === 'running' && !ch.countdown.held.length, ch.countdown);
const xb = await ev(`(() => { const e = [...document.querySelectorAll('.ph-sheet:not([hidden]) .ph-x, .ph-sheet:not([hidden]) [aria-label="Close"]')].find((x) => x.getClientRects().length); if (!e) return null; const b = e.getBoundingClientRect(); const h = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return { hit: !!h && (h === e || e.contains(h)) }; })()`);
check('phone chain: the sheet\'s close button can be pressed (no shade over it)', !xb || xb.hit, xb);
at = await advancedAt('basics/chain', t0);
check('phone chain: moves on 3 s after the lens', near(at, 3000, 250), at);
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
  at = await advancedAt('basics/formula', t0);
  check('phone formula: Add ticks it and it moves on 3 s after', near(at, 3000, 300), [at, await lit()]);
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
// ---------------- r3 review regress-4: a small laptop (1366 × 657): Why is a panel; the panes keep their size
await open('au7', 1366, 657, false, false);
await go('analysis', 0);
const p0 = await paneBox('#panes');
const wt = await center('.ts-text');
await click(wt[0], wt[1]); await settle(400);
const p1 = await paneBox('#panes');
const wl = await lit();
check('1366 × 657: Why opens as a panel over the work area, the panes keep their size', wl.why && wl.whyPanel && Math.abs((p1.b - p1.t) - (p0.b - p0.t)) < 1, { p0, p1, why: wl.why, panel: wl.whyPanel });
check('1366 × 657: the panes keep at least 330 px with the strip', p0.b - p0.t >= 330, p0);
await ev('Tour.stop()'); await settle(300);
} catch (e) { check('r3 review regress-4' + ': ran', false, String(e && e.stack || e).slice(0, 300)); try { await ev('Tour.stop()'); } catch (x) { /* */ } }
await view(1440, 900, false, false);
const L = logs().filter((l) => /EXC|\[tour\]/i.test(l.t + l.m)).slice(0, 12);
check('no exceptions or tour warnings', !L.length, L);
return { pass: R.filter((r) => r[1]).length, of: R.length, fails: R.filter((r) => !r[1]), logs: L };
