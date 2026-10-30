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
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}&lang=en${flag ? '&view=steps' : ''}` }); await sleep(3000); await settle(500);
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

// ---- the desktop ----
await open(1280, 800, false, true);
await ctl({ scope: 'all' });
const d0 = await ev(`(() => { const s = document.getElementById('svStrip'), p = s.querySelector('.sv-play'), n = s.querySelector('.sv-prev'); const rp = p.getBoundingClientRect(); return { play: !!p, before: !!(p.compareDocumentPosition(n) & 4), w: rp.width, h: rp.height, label: p.getAttribute('aria-label'), loop: s.querySelector('.sv-loop').getAttribute('aria-pressed') }; })()`);
ok('▶ is 44 px, before ‹, labelled Play; Loop is a toggle, off', d0.play && d0.before && d0.w >= 44 && d0.h >= 44 && d0.label === 'Play' && d0.loop === 'false', d0);

// the speed: fast is 450 ms a plane, so z → w₂ takes about 0.9 s; slow takes more than twice that
await ev(`(() => { const e = document.querySelector('.sv-speed'); e.value = 'fast'; e.dispatchEvent(new Event('change')); })(); 1`);
await ev(`document.querySelector('.sv-play').click(); 1`);
const p1 = await S();
ok('▶ starts a straight glide, and the button says Pause', p1.play === 'glide' && p1.moving && await ev(`document.querySelector('.sv-play').getAttribute('aria-label') === 'Pause'`), p1);
const e1 = await until((s) => !s.play);
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
await ctl({ go: 0, now: true });
await ev(`(() => { const e = document.querySelector('.sv-speed'); e.value = 'slow'; e.dispatchEvent(new Event('change')); })(); 1`);
await ev(`document.querySelector('.sv-play').click(); 1`);
await sleep(1000);
const sl = await S();
ok('at slow (2 s a plane) it is not yet at w₁ after 1 s', sl.play === 'glide' && sl.x > 0.2 && sl.x < 0.9, sl);
await ev(`(() => { const e = document.querySelector('.sv-speed'); e.value = 'fast'; e.dispatchEvent(new Event('change')); })(); 1`);
const e2 = await until((s) => !s.play);
ok('a new speed takes over while it plays', !e2.timeout && e2.s.i === 2 && e2.ms < 2500, e2);

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

// loop: it starts over at the end, and stays on
await ctl({ go: 0, now: true });
await ev(`document.querySelector('.sv-loop').click(); 1`);
const l1 = await S();
ok('Loop is on: aria-pressed, and kept for the browser', l1.loop === true && await ev(`document.querySelector('.sv-loop').getAttribute('aria-pressed') === 'true' && localStorage.getItem('cmw-sv-loop') === '1'`), l1);
await ctl({ play: true });
let wrapped = false, last = -1, n = 0;
for (let t0 = Date.now(); Date.now() - t0 < 4000; n++) { const s = await S(); if (s.x < last - 0.5) wrapped = true; last = s.x; if (!s.play) break; await sleep(30); }
const l2 = await S();
ok('looping: it wrapped from the last plane to the start and still plays', wrapped && l2.play === 'glide', [wrapped, l2]);
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
ok('the range is saved as S.homRange', await ev(`JSON.stringify(S.homRange && [S.homRange.a, S.homRange.b]) === '[1,1]'`), await ev(`JSON.stringify(S.homRange)`));
await ctl({ play: true });
const e3 = await until((s) => !s.play);
ok('play keeps to the range: it stops on w₁, not at w₂', !e3.timeout && e3.s.i === 1 && Math.abs(e3.s.x - 1) < 1e-9, e3.s);
await ev(`document.querySelector('.sv-loop').click(); 1`);
await ctl({ play: true });
let hi = 0, wr = false; last = -1;
for (let t0 = Date.now(); Date.now() - t0 < 3500; ) { const s = await S(); hi = Math.max(hi, s.x); if (s.x < last - 0.5) wr = true; last = s.x; await sleep(30); }
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
ok('its × clears the range', (await S()).range === null, await S());
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
await ev(`document.querySelector('.sv-play').dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch', pointerId: 7, bubbles: true })); document.querySelector('.sv-play').click(); 1`);
ok('… and the release is not a press: nothing plays', (await S()).play === null, await S());
await ev(`document.querySelector('.sv-sheet .sv-loop').click(); 1`);
ok('the sheet\'s Loop sets it', (await S()).loop === true, await S());
await ctl({ loop: false });

// ---- without the flag: no ▶ ----
await open(1280, 800, false, false);
ok('without ?view=steps there is no ▶ and no band', await ev(`!document.querySelector('.sv-play') && !document.querySelector('.sv-band')`), 'classic');

info.checks = 'play along the thread: ▶, the speed, loop, keys, range (Shift-drag, ring keys, clear), reduced motion, phone sheet, classic';
return { pass: fails.length === 0, fails, info };
