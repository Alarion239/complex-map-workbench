// Play along the thread (#438, behind ?view=steps):
// - ▶ plays through every plane in a straight glide at the speed setting, and stops at the end; ▶ at the end starts over;
// - Loop starts over; K / M play and pause, Esc pauses; ‹ › pause it;
// - the range: Shift-drag on the thread, Shift+← → on the ring, its × and Esc clear it; play keeps to it;
// - reduced motion plays a plane every 2 s;
// - a phone: ▶ ‹ thread ›, a long press on ▶ opens Playback;
// - without the flag there is no ▶.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
// (a picture's FNV-1a hash: the suite has no require)
const fnv = (b) => { let h = 0x811c9dc5; for (let i = 0; i < b.length; i++) { h ^= b[i]; h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
const ns = 'sv' + Date.now();
// Cayley, then cube's chain with the upper half-plane: z → w₁ (Möbius) → w₂ (cube)
const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'h1', kind: 'halfplane', a: [0, 0], b: [1, 0], ci: 0, visible: true }],
  steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, { type: 'pown', params: { n: 3 }, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } };
const open = async (w, h, mobile, flag) => {
  await view(w, h, false, mobile);
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await sleep(300);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}&lang=en${flag ? '&view=steps' : ''}` }); await settled({ max: 30000, until: `typeof __cmwSteps === 'function'` }); await settle(500);
};
const S = () => ev('__cmwSteps()');
// (a glide: until it lands, at most 15 s on a software renderer)
const rest = async () => { for (let i = 0; i < 150; i++) { const s = await S(); if (!s.moving) return s; await sleep(100); } return S(); };
const plot = async () => ev(`(() => { const b = document.getElementById('plotL').getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height, scale: 1 }; })()`);
const hash = async (name) => { await settle(400); await shot(name, await plot()); return fnv(fs.readFileSync(`${DIR}/shots/${name}.png`)); };
const press = (k) => ev(`document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '${k}', bubbles: true, cancelable: true })); 1`);


const ctl = (o) => ev(`__cmwSteps(${JSON.stringify(o)})`);
const kdown = (k, mods = {}) => ev(`(document.activeElement || document.body).dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key: '${k}', bubbles: true, cancelable: true }, ${JSON.stringify(mods)}))); 1`);
const until = async (f, ms = 15000) => { const t0 = Date.now(); for (;;) { const s = await S(); if (f(s)) return { s, ms: Date.now() - t0 }; if (Date.now() - t0 > ms) return { s, ms: Date.now() - t0, timeout: true }; await sleep(25); } };
const nodes = () => ev(`[...document.querySelectorAll('#svStrip .sv-plane')].map((b) => { const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })`);

// the thread's place sampled in the page once a frame for ms (the heavy __cmwSteps() poll starves the frames and aliases a loop): its
// highest place and whether it fell back by more than half a plane (a wrap)
const watchX = async (ms) => {
  await ev(`window.__wx = { hi: 0, wrapped: false, last: -1, done: false }; (() => { const t0 = Date.now(), tick = () => { const x = __cmwSvX(), w = window.__wx; w.hi = Math.max(w.hi, x); if (x < w.last - 0.5) w.wrapped = true; w.last = x; if (Date.now() - t0 < ${ms}) requestAnimationFrame(tick); else w.done = true; }; requestAnimationFrame(tick); })(); 1`);
  for (let i = 0; i < 600; i++) { await sleep(100); const w = await ev('window.__wx'); if (w && w.done) return w; }
  return ev('window.__wx');
};
// the speed, measured in the page: x against performance.now() once a frame through a whole glide from z to w₂, then the slope of the
// samples between 0.03 and 1.97 (least squares), in planes a second. The poll's round trip (which takes a second here) is no part of it;
// a frame that is late moves a sample's x, not the rate
const rateAt = async (speed) => {
  let last = { rate: null, n: 0 };
  // (a glide that a loaded runner draws in fewer than three frames has no rate to read: it is measured again, up to three times; the
  // bounds the rate is held to are the same)
  for (let attempt = 0; attempt < 3; attempt++) {
    await ctl({ go: 0, now: true });
    await ev(`(() => { const e = document.querySelector('.sv-speed'); e.value = '${speed}'; e.dispatchEvent(new Event('change')); })(); 1`);
    // (the sampler and the play start in one call in the page: the round trip of a second is not between them)
    await ev(`window.__rt = { s: [], done: false }; (() => { const t0 = performance.now(); const tick = () => { const x = __cmwSvX(), t = performance.now(); window.__rt.s.push([t, x]); if (x >= 1.999 || t - t0 > 20000) { window.__rt.done = true; return; } requestAnimationFrame(tick); }; requestAnimationFrame(tick); __cmwSteps({ play: true }); })(); 1`);
    let rt = null;
    for (let i = 0; i < 300; i++) { await sleep(100); rt = await ev(`window.__rt`); if (rt && rt.done) break; }
    const p = rt.s.filter(([, x]) => x > 0.03 && x < 1.97);
    if (p.length < 3) { last = { rate: null, n: p.length }; continue; }
    const n = p.length, mt = p.reduce((a, [t]) => a + t, 0) / n, mx = p.reduce((a, [, x]) => a + x, 0) / n;
    const num = p.reduce((a, [t, x]) => a + (t - mt) * (x - mx), 0), den = p.reduce((a, [t]) => a + (t - mt) * (t - mt), 0);
    return { rate: +(num / den * 1000).toFixed(3), n };
  }
  return last;
};
// ---- the desktop ----
await open(1280, 800, false, true);
await ctl({ scope: 'all' });
const d0 = await ev(`(() => { const s = document.getElementById('svStrip'), p = s.querySelector('.sv-play'), n = s.querySelector('.sv-prev'); const rp = p.getBoundingClientRect(); return { play: !!p, before: !!(p.compareDocumentPosition(n) & 4), w: rp.width, h: rp.height, label: p.getAttribute('aria-label'), loop: s.querySelector('.sv-loop').getAttribute('aria-pressed') }; })()`);
ok('▶ is 44 px, before ‹, labelled Play; Loop is a toggle, off', d0.play && d0.before && d0.w >= 44 && d0.h >= 44 && d0.label === 'Play' && d0.loop === 'false', d0);

const lh = await ev(`document.querySelector('.sv-loop').getBoundingClientRect().height`);
ok('the Loop toggle is 36 px high, as the speed select', lh >= 35.5 && lh <= 37, lh);
ok('▶ says how to reach Speed and Loop', await ev(`document.querySelector('.sv-play').getAttribute('aria-description') === 'Hold for speed and loop'`), 'desc');

// the speed: fast is 450 ms a plane, so z → w₂ takes about 0.9 s; slow takes more than twice that
await ev(`(() => { const e = document.querySelector('.sv-speed'); e.value = 'fast'; e.dispatchEvent(new Event('change')); })(); 1`);
const tClick = Date.now();
await ev(`document.querySelector('.sv-play').click(); 1`);
ok('starting says where it plays from and to, in the live region', await ev(`/Playing from z to w/.test(document.querySelector('#stage .sr-only[aria-live]').textContent)`), await ev(`document.querySelector('#stage .sr-only[aria-live]').textContent`));
const p1 = await S();
ok('▶ starts a straight glide, and the button says Pause', p1.play === 'glide' && p1.moving && await ev(`document.querySelector('.sv-play').getAttribute('aria-label') === 'Pause'`), p1);
const e1 = await until((s) => !s.play); e1.ms = Date.now() - tClick;   // (from the press: the polls before it count)
ok('… and says where it stopped', await ev(`/Stopped at w/.test(document.querySelector('#stage .sr-only[aria-live]').textContent)`), await ev(`document.querySelector('#stage .sr-only[aria-live]').textContent`));
ok('… which ends on the last plane at rest', !e1.timeout && e1.s.i === 2 && Math.abs(e1.s.x - 2) < 1e-9 && !e1.s.moving, e1.s);
ok('… in about two planes of the speed (fast: 450 ms a plane)', e1.ms > 700 && e1.ms < 6000, e1.ms);
await ev(`document.querySelector('.sv-play').click(); 1`);
const p2 = await S();
ok('▶ at the end starts over', p2.play === 'glide' && p2.x < 1, p2);
await ev(`document.querySelector('.sv-play').click(); 1`);
const pz = await S();
ok('▶ again pauses: it stays where it was, and nothing moves on', pz.play === null, pz);
await sleep(300); const pz2 = await S();
ok('… (no drift after the pause)', Math.abs(pz2.x - pz.x) < 1e-9, [pz.x, pz2.x]);
// (nominal planes a second: slow 0.5, normal 1.11, each told from the other; fast, 2.2, is a 0.9 s glide that a software renderer's frames
// do not sample)
{ const r = await rateAt('slow'), n = await rateAt('normal');
  ok('the speeds are what they say: slow about 0.5 planes a second, normal about 1.1', r.rate > 0.3 && r.rate < 0.7 && n.rate > 0.8 && n.rate < 1.5, { slow: r, normal: n }); }
await ctl({ go: 0, now: true });
await ev(`(() => { const e = document.querySelector('.sv-speed'); e.value = 'slow'; e.dispatchEvent(new Event('change')); })(); 1`);
await ev(`document.querySelector('.sv-play').click(); 1`);
await sleep(1000);
const sl = await S();
ok('a play at slow is still going a second in', sl.play === 'glide', sl);
await ev(`(() => { const e = document.querySelector('.sv-speed'); e.value = 'fast'; e.dispatchEvent(new Event('change')); })(); 1`);
const e2 = await until((s) => !s.play);
ok('a new speed takes over while it plays', !e2.timeout && e2.s.i === 2 && e2.ms < 2500, e2);
ok('the speed is the state\'s: S.sv.speed holds the strip\'s choice, and the device keeps it as the default', (await S()).svSpeed === 'fast' && await ev(`localStorage.getItem('cmw-sv-speed') === 'fast'`), await S());

// keys: K plays and pauses, Esc pauses, ‹ › pause
await ctl({ go: 0, now: true });
await ev(`document.body.focus(); 1`);
await press('k'); ok('K plays', (await S()).play === 'glide', await S());
await press('k'); ok('K pauses', (await S()).play === null, await S());
await ctl({ go: 0, now: true });
await press('m'); ok('M plays', (await S()).play === 'glide', await S());
await press('Escape'); ok('Esc pauses', (await S()).play === null, await S());
await ctl({ go: 0, now: true });
await ctl({ play: true }); await sleep(100);
await ev(`document.querySelector('.sv-next').click(); 1`);
ok('› pauses it', (await S()).play === null, await S());
await rest();

// pause between two planes (more than the eighth that snaps): it parks there, and a state loaded afterwards is adopted
await ctl({ go: 0, now: true });
await ev(`(() => { const e = document.querySelector('.sv-speed'); e.value = 'slower'; e.dispatchEvent(new Event('change')); })(); 1`);
// (paused from inside the page the moment it passes 0.3, so no poll's lag decides where; ev does not wait for a promise, so the page
// leaves its answer in window.__midR. A frame gap that carries it past 0.7 (a cold start) is tried again, at most three times)
let midR = null, pk = null;
for (let attempt = 0; attempt < 3; attempt++) {
  await ctl({ go: 0, now: true });
  await ctl({ play: true });
  await ev(`window.__midR = null; (() => { const t0 = Date.now(); const tick = () => { const x = __cmwSvX(); if (x > 0.3 || Date.now() - t0 > 12000) { __cmwSteps({ play: false }); window.__midR = { ok: x > 0.3, x }; } else requestAnimationFrame(tick); }; requestAnimationFrame(tick); })(); 1`);
  midR = null;
  for (let i = 0; i < 160 && !midR; i++) { await sleep(100); midR = await ev(`window.__midR`); }
  pk = await S();
  if (midR && midR.ok && pk.x > 0.2 && pk.x < 0.8) break;
}
const mid = { timeout: !(midR && midR.ok), midR };
ok('pausing mid-glide parks between two planes, nothing plays on', !mid.timeout && pk.play === null && pk.x > 0.2 && pk.x < 0.8, { mid, pk: { play: pk.play, x: pk.x, moving: pk.moving } });
await ev(`(__cmwExample(3), 1)`); await sleep(2500); await settle(500);
const ad = await S();
ok('… and a state loaded after that is adopted (back on its first plane, not left parked)', Math.abs(ad.x - Math.round(ad.x)) < 1e-9 && ad.i === 0 && !ad.moving, ad);
// an example loaded under a Play, Loop on: Play stops and the new example's view is adopted (rework on #460)
await ev(`(() => { const e = document.querySelector('.sv-speed'); e.value = 'slow'; e.dispatchEvent(new Event('change')); })(); 1`);
await ctl({ go: 0, now: true });
await ev(`document.querySelector('.sv-loop').getAttribute('aria-pressed') === 'true' || document.querySelector('.sv-loop').click(); 1`);
await ctl({ play: true });
await sleep(600);
await ev(`(__cmwExample(5), 1)`); await sleep(2500); await settle(500);
const xl = await S();
ok('an example loaded while playing (Loop on) stops Play and shows its view from the first plane', xl.play === null && xl.i === 0 && Math.abs(xl.x - Math.round(xl.x)) < 1e-9 && !xl.moving, xl);
await ev(`document.querySelector('.sv-loop').getAttribute('aria-pressed') === 'false' || document.querySelector('.sv-loop').click(); 1`);
await ev(`(() => { const e = document.querySelector('.sv-speed'); e.value = 'fast'; e.dispatchEvent(new Event('change')); })(); 1`);
await open(1280, 800, false, true);
await ctl({ scope: 'all' });

// loop: it starts over at the end, and stays on
await ctl({ go: 0, now: true });
await ev(`document.querySelector('.sv-loop').click(); 1`);
const l1 = await S();
ok('Loop is on: aria-pressed, and kept for the browser', l1.loop === true && await ev(`document.querySelector('.sv-loop').getAttribute('aria-pressed') === 'true' && localStorage.getItem('cmw-sv-loop') === '1'`), l1);
await ctl({ play: true });
const wx = await watchX(6000);
const wrapped = wx.wrapped;
const l2 = await S();
ok('looping: it wrapped from the last plane to the start and still plays', wrapped && l2.play === 'glide', [wx, l2]);
await ctl({ play: false });
await ctl({ loop: false });

// the range: Shift-drag along the thread
await ctl({ go: 0, now: true });
const nd = await nodes();
const mouse = (type, x, y, mods = 0) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, modifiers: mods });
await mouse('mousePressed', nd[0].x, nd[0].y - 14, 8);
for (let i = 1; i <= 8; i++) await mouse('mouseMoved', nd[0].x + (nd[1].x - nd[0].x) * i / 8, nd[0].y - 14, 8);
await mouse('mouseReleased', nd[1].x, nd[0].y - 14, 8);
await settle(300);
const r1 = await S();
ok('Shift-drag from z to w₁ marks the range: steps 1…1, planes 0…1', r1.range && r1.range.a === 1 && r1.range.b === 1 && r1.range.lo === 0 && r1.range.hi === 1, r1.range);
ok('… and it did not move the view', r1.i === 0 && r1.x === 0, r1);
const bd = await ev(`(() => { const b = document.querySelector('.sv-band'); return { hidden: b.hidden, label: b.getAttribute('aria-label'), x: document.querySelector('.sv-bandx').getAttribute('aria-label'), vt: document.querySelector('.sv-thumb').getAttribute('aria-valuetext') }; })()`);
ok('the band shows, the clear button and the ring name it', !bd.hidden && /w₁/.test(bd.label) && bd.x === 'Clear the range' && /range z to w₁/.test(bd.vt), bd);
ok('the range is saved as S.homRange', JSON.stringify((await S()).homRange) === '[1,1]', (await S()).homRange);
await ctl({ play: true });
const e3 = await until((s) => !s.play);
ok('play keeps to the range: it stops on w₁, not at w₂', !e3.timeout && e3.s.i === 1 && Math.abs(e3.s.x - 1) < 1e-9, e3.s);
await ev(`document.querySelector('.sv-loop').click(); 1`);
await ctl({ play: true });
const wr0 = await watchX(5000);
const hi = wr0.hi, wr = wr0.wrapped;
ok('looping in a range: never past its end, and it starts over at its start', hi <= 1 + 1e-9 && wr, [hi, wr]);
await ctl({ play: false }); await ctl({ loop: false });
await press('Escape');
ok('Esc clears the range', (await S()).range === null, await S());

// the ring's keys: Shift+→ extends the range a plane at a time
await ctl({ go: 1, now: true });
await ev(`document.querySelector('.sv-thumb').focus(); 1`);
await kdown('ArrowRight', { shiftKey: true });
const k1 = await S();
ok('Shift+→ on the ring makes a range from the shown plane to the next', k1.range && k1.range.lo === 1 && k1.range.hi === 2 && k1.i === 1, k1.range);
await kdown('ArrowLeft', { shiftKey: true });
const k2 = await S();
ok('Shift+← extends it down a plane (here to every plane: no range)', k2.range === null, k2.range);
await kdown('ArrowRight', { shiftKey: true });
await ev(`document.querySelector('.sv-bandx').click(); 1`);
ok('its × clears the range, and the focus goes to the ring', (await S()).range === null && await ev(`document.activeElement === document.querySelector('.sv-thumb')`), await ev(`document.activeElement.className`));
// (the × is clear of the end node's ring)
await ctl({ range: [0, 1] }); await settle(200);
const bx = await ev(`(() => { const x = document.querySelector('.sv-bandx').getBoundingClientRect(), n = document.querySelectorAll('#svStrip .sv-plane .sv-node')[1].getBoundingClientRect(); return { xl: x.left, nr: n.right, xb: x.bottom, nt: n.top }; })()`);
ok('the band\'s × does not overlap the end plane\'s node', bx.xl >= bx.nr || bx.xb <= bx.nt, bx);
const chipHit = () => ev(`(() => { const x = document.querySelector('.sv-bandx').getBoundingClientRect(), cx = (x.left + x.right) / 2, cy = (x.top + x.bottom) / 2, hw = 12; return { size: [x.width, x.height], over: [...document.querySelectorAll('#svStrip .sv-fchip')].filter((c) => { const r = c.getBoundingClientRect(); return cx + hw > r.left && cx - hw < r.right && cy + hw > r.top && cy - hw < r.bottom; }).map((c) => c.getAttribute('aria-label')) }; })()`);
{ const cd = await chipHit(); ok('the band\'s × is at least 24 px and its circle touches no step chip', cd.size[0] >= 23.5 && cd.size[1] >= 23.5 && cd.over.length === 0, cd); }
const hit = await ev(`(() => { const x = document.querySelector('.sv-bandx'), r = x.getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { hit: e === x || x.contains(e), tag: e && (e.className || e.tagName) }; })()`);
ok('a click at the band\'s × lands on the ×, not on the plane under it', hit.hit, hit);
await ctl({ range: null });
await ctl({ go: 0, now: true });
await ctl({ range: [1, 2] });
await ev(`document.activeElement.blur(); 1`);
const rl = await ev(`(() => { const r = document.querySelector('.sv-rail').getBoundingClientRect(); return { x: r.left + 10, y: r.top + r.height / 2 }; })()`);
await mouse('mousePressed', rl.x, rl.y); await mouse('mouseReleased', rl.x, rl.y);
await sleep(400);
ok('a click on the thread outside the band clears it', (await S()).range === null, await S());

// reduced motion: a plane every 2 s, said in the live region
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
await ctl({ go: 0, now: true });
await ctl({ play: true });
const rm = await S();
ok('reduced motion: play is a slideshow, on whole planes', rm.play === 'slide' && rm.i === 0 && Number.isInteger(rm.x), rm);
await sleep(2600);
const rm2 = await S();
ok('… one plane after 2 s, with no glide in between, and the live region says so', rm2.i === 1 && Number.isInteger(rm2.x) && rm2.play === 'slide' && !rm2.anim && await ev(`/Plane w₁/.test(document.querySelector('#stage .sr-only[aria-live]').textContent)`), rm2);
await ctl({ play: false });
await send('Emulation.setEmulatedMedia', { features: [] });

// ---- a phone: ▶ ‹ thread ›; a long press on ▶ opens Playback ----
await open(390, 844, true, true);
const ph = await ev(`(() => { const s = document.getElementById('svStrip'), v = (q) => { const e = s.querySelector(q), r = e.getBoundingClientRect(); return { show: getComputedStyle(e).display !== 'none', w: r.width, h: r.height, l: r.left }; }; return { play: v('.sv-play'), prev: v('.sv-prev'), next: v('.sv-next'), speed: v('.sv-speed'), loop: v('.sv-loop'), sw: s.scrollWidth, cw: s.clientWidth }; })()`);
ok('phone: ▶ ‹ thread › at 44 px, the speed and Loop not on the strip, no sideways scroll', ph.play.show && ph.play.w >= 44 && ph.play.h >= 44 && ph.play.l < ph.prev.l && !ph.speed.show && !ph.loop.show && ph.sw <= ph.cw + 1, ph);
await ev(`(() => { const b = document.querySelector('.sv-play'); const o = { pointerType: 'touch', pointerId: 7, bubbles: true, isPrimary: true }; b.dispatchEvent(new PointerEvent('pointerdown', o)); })(); 1`);
await sleep(800);
const sh = await ev(`(() => { const s = document.querySelector('.sv-sheet'); return s && !s.hidden ? { name: s.getAttribute('aria-label'), rows: s.querySelectorAll('.sv-speed, .sv-loop').length } : null; })()`);
ok('a long press on ▶ opens the Playback sheet, with Speed and Loop', sh && sh.name === 'Playback' && sh.rows === 2, sh);
await ev(`document.querySelector('.sv-play').dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch', pointerId: 7, bubbles: true })); document.querySelector('.sv-play').click(); document.body.focus(); 1`);
await sleep(250);
ok('the release does not take the focus out of the sheet, which is modal', await ev(`!!document.activeElement.closest('.sv-sheet') && document.querySelector('.sv-sheet').getAttribute('aria-modal') === 'true'`), await ev(`document.activeElement.tagName`));
ok('the sheet lies over the toasts', await ev(`(() => { const z = (e) => +getComputedStyle(e).zIndex; return z(document.querySelector('.sv-sheet')) > z(document.getElementById('toastHost')) && z(document.querySelector('.sv-scrim')) > z(document.getElementById('toastHost')); })()`), 'z');
await ev(`document.querySelector('.sv-sheet .sv-loop').focus(); 1`);
await kdown('Tab');
ok('Tab stays in the sheet', await ev(`!!document.activeElement.closest('.sv-sheet')`), await ev(`document.activeElement.tagName`));
ok('… and the release is not a press: nothing plays', (await S()).play === null, await S());
await ev(`document.querySelector('.sv-sheet .sv-loop').click(); 1`);
ok('the sheet\'s Loop sets it', (await S()).loop === true, await S());
await ev(`(() => { const e = document.querySelector('.sv-sheet .sv-speed'); e.value = 'slower'; e.dispatchEvent(new Event('change')); })(); 1`);
ok('the sheet\'s Speed sets the state\'s speed too (one setting), and the strip\'s select follows', (await S()).svSpeed === 'slower' && await ev(`document.querySelector('#svStrip .sv-speed').value === 'slower'`), await S());
await ctl({ loop: false });
await ev(`document.querySelector('.sv-sheet .btn.small').click(); 1`);
ok('Done closes the sheet and gives the focus back to ▶', await ev(`document.querySelector('.sv-sheet').hidden && document.activeElement === document.querySelector('.sv-play')`), await ev(`document.activeElement.className`));
// the phone's Menu sheet has the row (the header's popover is hidden on a phone)
await ev(`document.getElementById('hdrMoreBtn').click(); 1`); await sleep(700);
const mr = await ev(`(() => { const r = [...document.querySelectorAll('.ph-sb[data-k="more"] .ph-row')].find((b) => /Playback/.test(b.textContent)); return r ? { name: r.textContent, h: r.getBoundingClientRect().height } : null; })()`);
ok('the phone\'s Menu sheet has a Playback… row (no long press needed)', mr && mr.h >= 43.5, mr);
await ev(`[...document.querySelectorAll('.ph-sb[data-k="more"] .ph-row')].find((b) => /Playback/.test(b.textContent)).click(); 1`); await sleep(600);
ok('… which opens the sheet, with the focus in it', await ev(`!document.querySelector('.sv-sheet').hidden && !!document.activeElement.closest('.sv-sheet')`), await ev(`document.activeElement.tagName + ' ' + document.querySelector('.sv-sheet').hidden`));
const dn = await ev(`(() => { const r = document.querySelector('.sv-sheet .btn.small').getBoundingClientRect(); return { w: r.width, h: r.height }; })()`);
ok('the sheet\'s Done is at least 44 px', dn.w >= 43.5 && dn.h >= 43.5, dn);
await ev(`document.querySelector('.sv-sheet .btn.small').click(); 1`);
await ctl({ range: [0, 1] }); await settle(300);
const hp = await ev(`(() => { const x = document.querySelector('.sv-bandx'), r = x.getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { hit: e === x || x.contains(e), w: r.width, h: r.height, tag: e && (e.className || e.tagName) }; })()`);
ok('phone: the band\'s × is 44 px and a tap at its centre lands on it', hp.hit && hp.w >= 43.5 && hp.h >= 43.5, hp);
await ctl({ range: null });

// ---- a narrow phone (360): the range's × stays inside the screen, even at the last plane ----
await open(360, 740, true, true);
await ctl({ range: [0, 1] }); await settle(400);
{ const cd = await chipHit(); ok('360 px: the × (a 44 px box, its 24 px circle) touches no step chip', cd.size[0] >= 43.5 && cd.over.length === 0, cd); }
// a tap 3 px inside the top edge of the chip or the node under the ×'s box is the chip's or the node's, not the ×'s
{ const ov = await ev(`(() => { const x = document.querySelector('.sv-bandx'), b = x.getBoundingClientRect(), out = []; for (const e of document.querySelectorAll('#svStrip .sv-fchip, #svStrip .sv-plane')) { const r = e.getBoundingClientRect(), l = Math.max(r.left, b.left), rr = Math.min(r.right, b.right); if (rr - l < 4 || r.top > b.bottom + 1 || r.bottom < b.top) continue; const px = (l + rr) / 2, py = r.top + 3, h = document.elementFromPoint(px, py); out.push({ el: e.className.split(' ')[0] + ' ' + (e.getAttribute('aria-label') || '').slice(0, 6), at: [Math.round(px), Math.round(py)], hitX: h === x || x.contains(h), hit: h && (h.className || h.tagName) }); } return out; })()`);
  ok('360 px: a tap 3 px inside the top edge of the chip or node under the × is theirs, not the ×\'s', ov.length > 0 && ov.every((o) => !o.hitX), ov); }
await ctl({ range: [1, 2] }); await settle(400);
const nw = await ev(`(() => { const x = document.querySelector('.sv-bandx'), r = x.getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { l: r.left, r: r.right, w: r.width, h: r.height, iw: window.innerWidth, hit: e === x || x.contains(e) }; })()`);
ok('360 px: the × is 44×44, inside the screen, and hit-tests on itself, with the range ending on the last plane', nw.l >= 0 && nw.r <= nw.iw + 0.5 && nw.w >= 43.5 && nw.h >= 43.5 && nw.hit, nw);
await ctl({ range: null });

// ---- without the flag: no ▶ ----
await open(1280, 800, false, false);
ok('without ?view=steps there is no ▶ and no band', await ev(`!document.querySelector('.sv-play') && !document.querySelector('.sv-band')`), 'classic');

info.checks = 'play along the thread: ▶, the speed, loop, keys, range (Shift-drag, ring keys, clear), reduced motion, phone sheet, classic';
return { pass: fails.length === 0, fails, info };
