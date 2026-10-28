// v16.5 wave 1 merge (notes/ux-build/W1-MERGE.md): one look at the merged app in the real browser, as a person would
// use it, where the five pieces meet. Laptop 1366 × 768 (mouse) and phone 412 × 860 (Android emulation, touch through
// Input.dispatchTouchEvent); English and Russian; light and dark. Not a gate: it loads, works, and says nothing in the
// console; pictures go to <daemon>/shots/w1-merge/.
//   L1 laptop light: the default scene loads with no console error; Y's head carries the "Y · " tag (plane) and is not
//      cut; Snap shows its word (plane) with the rail piece's tooltip; a card's ⋯ shows Alt ← / Alt → (learn, via merge)
//   L2 one Alt+→ on a focused card moves the step one place, not two (learn and chain built the same key: merged as one)
//   L3 Examples: "New: empty canvas" first (chain) and the sound example's ♫ (learn) in the same list
//   L4 the user's case (rail): Perpendicular circle on the shown unit circle, two picks on it: the circle is made; a press
//      on the first pick is refused in the chip, by the pointer (plane's UX52 through the merge), not as a toast
//   L5 dark, Russian: loads with no console error; pictures
//   P1 phone light: loads, no console error; Undo in a sheet's head (phone); the user's case with real taps
//   P2 phone Russian: the More tools sheet's Construct tiles on one line each, «Гиперб.» for the new tool; no Ctrl/⌘ in a
//      shape's ⋯ on touch
//   P3 phone dark: loads, no console error
// A command file for the CDP daemon (test/cdp_kit README): python3 build.py && test/<you>_cdp/q.sh test/ux165_merge_cmd.js
const fails = [], info = {};
let checks = 0;
const ok = (name, cond, got) => { checks++; if (!cond) fails.push({ name, got }); };
const settle = async (ms = 300) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const errs = [];
const grab = async () => { errs.push(...(await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource|favicon|404/.test(x.m || ''))); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const NS = 'w1m' + (Date.now() % 100000);
const SHOT = (n) => shot('w1-merge/' + n);
const UA0 = await ev('navigator.userAgent');
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const phone = async (w, h, dark = false) => { await send('Emulation.setUserAgentOverride', { userAgent: ANDROID, platform: 'Linux armv8l' }); await view(w, h, dark, true); };
const laptop = async (w = 1366, h = 768, dark = false) => { await send('Emulation.setUserAgentOverride', { userAgent: UA0 }); await view(w, h, dark, false); };
const tap = async (x, y, ms = 60) => { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }); await sleep(ms); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(200); };
const box = (sel) => ev(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(sel)})].find((x) => x.getClientRects().length); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; })()`);
const mid = (b) => [b.l + b.w / 2, b.t + b.h / 2];
const W = (re, im, side = 'L') => ev(`__cmwW2S('${side}', ${re}, ${im})`);
const A = (deg, r = 1) => W(r * Math.cos(deg * Math.PI / 180), r * Math.sin(deg * Math.PI / 180));
const ST = () => ev(`__cmwCI({ shapes: true })`);
const DBG = () => ev(`__cmwCI(null)`);
const tool = async (id) => { await ev(`(() => { const b = [...document.querySelectorAll('[data-tool="${id}"]')].find((e) => e.offsetParent) || document.querySelector('[data-tool="${id}"]'); b.click(); return 1; })()`); await settle(150); };
const scale = async () => { const a = await W(0, 0), b = await W(1, 0); return b[0] - a[0]; };
const toasts = () => ev(`[...document.querySelectorAll('#toastHost .toast')].map((t) => t.textContent.trim()).join(' | ')`);
// a namespace's saved state is cleared first, so every run starts from the default scene
const fresh = async (ns, q = '') => { await nav(U + '?ns=w1mclean'); await ev(`(() => { for (const k of Object.keys(localStorage)) if (k.endsWith(':${ns}')) localStorage.removeItem(k); return 1; })()`); await nav(U + '?ns=' + ns + q); await settle(1200); };
const st0 = (extra) => Object.assign({ v3: true, v4: true, unit: true, snap: true, shapes: [], steps: [], nextId: 10, focus: 0 }, extra || {});
async function section(k, f) { try { await f(); } catch (e) { fails.push({ name: k + ' threw', got: String(e && e.stack || e).slice(0, 600) }); } await grab(); }
logs();

// ---------------------------------------------------------------- L1 laptop, light, English
await section('L1', async () => {
  await laptop();
  await fresh(NS + 'a');
  const h = await ev(`(() => { const t = document.getElementById('rightTitle'), p = t && t.querySelector('.ptitle'); const sb = document.getElementById('snapBtn');
    return { title: t ? t.textContent.trim() : null, cut: p ? p.scrollWidth > p.clientWidth + 1 : null, tiny: document.getElementById('paneR').classList.contains('tiny'),
      snapWord: sb && sb.querySelector('.snap-w') ? sb.querySelector('.snap-w').textContent : null, snapTip: sb && sb.dataset.tip, steps: document.querySelectorAll('#pipeline .card[data-k]:not([data-k="0"])').length }; })()`);
  info.L1 = h;
  ok('L1 Y\'s head carries the Y tag, whole', h.title && /^Y ·/.test(h.title) && !h.cut && !h.tiny, h);
  ok('L1 Snap shows its word with the rail piece\'s tooltip', h.snapWord === 'Snap' && /grid and to figures/.test(h.snapTip || ''), h);
  await SHOT('L1-laptop-light-en');
  if (h.steps >= 1) {
    const b = await box('#pipeline .card[data-k="1"] .thumb');
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: b.l + 20, y: b.t + 20 });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: b.l + 20, y: b.t + 20, button: 'right', buttons: 2, clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: b.l + 20, y: b.t + 20, button: 'right', buttons: 0, clickCount: 1 });
    await settle(300);
    const m = await ev(`[...document.querySelectorAll('#popHost .pop.menu .mi')].map((x) => [x.querySelector('.mi-label') ? x.querySelector('.mi-label').textContent : x.textContent, (x.querySelector('.mi-key') || {}).textContent || ''])`);
    info.L1menu = m;
    const ml = m.find((x) => x[0] === 'Move left'), mr = m.find((x) => x[0] === 'Move right');
    ok('L1 a card\'s ⋯ (right click, learn UX99) shows Alt ← / Alt → on Move left / right', ml && ml[1] === 'Alt ←' && mr && mr[1] === 'Alt →', m);
    await SHOT('L1-card-menu');
    await key('Escape'); await settle(200);
  }
});

// ---------------------------------------------------------------- L2 one Alt+→ moves one place
await section('L2', async () => {
  await laptop();
  await load(NS + 'b', st0({ steps: [{ type: 'exp', params: {}, on: true }, { type: 'recip', params: {}, on: true }, { type: 'mul', params: { c: '2' }, on: true }] }));
  await settle(800);
  const names = () => ev(`[...document.querySelectorAll('#pipeline .card[data-k]')].filter((c) => c.dataset.k !== '0').map((c) => c.querySelector('.nm').textContent).join(',')`);
  const a = await names();
  await ev(`document.querySelector('#pipeline .card[data-k="1"]').focus(); 1`);
  await key('ArrowRight', 1); await settle(400);
  const b = await names();
  const foc = await ev(`document.activeElement && document.activeElement.closest('.card') ? document.activeElement.closest('.card').dataset.k : null`);
  const A3 = a.split(',');
  info.L2 = { a, b, foc };
  ok('L2 one Alt+→ moves the step one place (not two), the card keeps the keyboard', A3.length === 3 && b === [A3[1], A3[0], A3[2]].join(',') && foc === '2', info.L2);
  info.L2toast = await toasts();
  await SHOT('L2-alt-move');
});

// ---------------------------------------------------------------- L3 Examples
await section('L3', async () => {
  await laptop();
  await ev(`document.getElementById('examplesBtn').click(), 1`); await settle(400);
  const g = await ev(`(() => { const it = [...document.querySelectorAll('.pop.menu.examples .ex-item')]; return { first: it[0] && it[0].querySelector('.ex-name').textContent, newCls: it[0] && it[0].classList.contains('ex-new'), snd: it.filter((x) => x.querySelector('.ex-snd')).map((x) => x.querySelector('.ex-name').textContent) }; })()`);
  info.L3 = g;
  ok('L3 Examples: "New: empty canvas" first, set apart (chain), and the sound example marked ♫ (learn)', g.first === 'New: empty canvas' && g.newCls && g.snd.length >= 1, g);
  await SHOT('L3-examples');
  await key('Escape'); await settle(200);
});

// ---------------------------------------------------------------- L4 the user's case on the laptop
await section('L4', async () => {
  await laptop();
  await load(NS + 'c', st0());
  await settle(900);
  await tool('perp');
  const pk = async (deg) => { const p = await A(deg); await click(p[0], p[1]); await settle(200); };
  await pk(200); await pk(120); await pk(60);
  let st = await ST();
  const Ks = st.list.filter((x) => x.def && x.def.op === 'perp');
  info.L4 = { n: Ks.length, toast: await toasts() };
  ok('L4 Perpendicular circle: C = the unit circle, two picks on it: the circle is made, no "needs distinct points"', Ks.length === 1 && !/distinct/.test(info.L4.toast), info.L4);
  // the tool keeps its C: a pick, then a press on that pick again: refused in the chip (UX52), not as a toast
  await pk(250);
  const p = await A(250); await click(p[0], p[1]); await settle(150);
  const d = await DBG();
  const chip = await ev(`(() => { const c = [...document.querySelectorAll('.cm-chip')].find((x) => x.getClientRects().length); return c ? c.textContent.trim() : null; })()`);
  info.L4b = { ring: d && d.ring, chip, toast: await toasts() };
  ok('L4 a press on the first pick is refused by the pointer (warn ring or chip), not by a toast', ((d && d.ring && d.ring.warn) || /distinct/.test(chip || '')) && !/distinct/.test(info.L4b.toast), info.L4b);
  await SHOT('L4-perp-two-on-unit-circle');
  await key('Escape'); await settle(200);
});

// ---------------------------------------------------------------- L5 dark, Russian
await section('L5', async () => {
  await laptop(1366, 768, true);
  await fresh(NS + 'd');
  await SHOT('L5-laptop-dark-en');
  await laptop(1366, 768, false);
  await fresh(NS + 'e', '&lang=ru');
  const t = await ev(`(() => { const t = document.getElementById('rightTitle'), p = t && t.querySelector('.ptitle'); return { title: t && t.textContent.trim(), cut: p ? p.scrollWidth > p.clientWidth + 1 : null, snap: (document.querySelector('#snapBtn .snap-w') || {}).textContent }; })()`);
  info.L5 = t;
  ok('L5 Russian laptop: Y\'s head whole', t.title && !t.cut, t);
  await SHOT('L5-laptop-light-ru');
  await laptop(1366, 768, true);
  await fresh(NS + 'f', '&lang=ru');
  await SHOT('L5-laptop-dark-ru');
});

// ---------------------------------------------------------------- P1 phone, light, English
await section('P1', async () => {
  await phone(412, 860);
  await fresh(NS + 'g');
  const g = await ev(`({ ph: document.documentElement.classList.contains('ph'), sw: document.documentElement.scrollWidth, iw: innerWidth, sh: document.documentElement.scrollHeight, ih: innerHeight })`);
  info.P1 = g;
  ok('P1 phone layout, one screen (no page scroll)', g.ph && g.sw <= g.iw + 1 && g.sh <= g.ih + 1, g);
  await SHOT('P1-phone-light-en');
  // the user's case with real taps: the shown unit circle as C, two taps on it
  await load(NS + 'h', st0());
  await settle(900);
  await tool('perp');
  const sp = await scale();
  const tp = async (deg) => { const p = await A(deg, 1 + 5 / sp); await tap(p[0], p[1]); await settle(200); };
  await tp(200); await tp(120); await tp(150);
  const st = await ST();
  const Ks = st.list.filter((x) => x.def && x.def.op === 'perp');
  info.P1b = { n: Ks.length, toast: await toasts() };
  ok('P1 phone: two taps on the unit circle make the perpendicular circle (no "needs distinct points")', Ks.length === 1 && !/distinct/.test(info.P1b.toast), info.P1b);
  // a tap that is no curve, with the Hyperbolic line tool's first pick: the refusal in touch words (merge: Tap, not Click)
  await tool('hyper');
  const e = await W(2.2, 2.4);
  await tap(e[0], e[1]); await settle(200);
  const chip = await ev(`(() => { const c = [...document.querySelectorAll('.cm-chip')].find((x) => x.getClientRects().length); return c ? c.textContent.trim() : null; })()`);
  info.P1c = { chip, toast: await toasts() };
  ok('P1 phone: a refused pick says Tap, never Click', !/Click/.test((chip || '') + info.P1c.toast), info.P1c);
  await SHOT('P1-phone-perp-taps');
  await ev(`document.getElementById('undoBtn') && 1`);
});

// ---------------------------------------------------------------- P2 phone, Russian
await section('P2', async () => {
  await phone(412, 860);
  await fresh(NS + 'i', '&lang=ru');
  // More tools: every tile's name on one line and whole (learn UX93), the new Hyperbolic tile too («Гиперб.»)
  const more = await box('#secDraw .tool-more > summary');
  if (more) { await tap(...mid(more)); await settle(800); }
  const tiles = await ev(`[...document.querySelectorAll('.ph-tile')].filter((t) => t.getClientRects().length).map((t) => { const l = t.querySelector('.ph-tl'); return { t: l.textContent, fits: l.scrollWidth <= t.clientWidth + 0.5, soft: /\\u00ad/.test(l.textContent), lines: Math.round(l.getBoundingClientRect().height / 12) }; })`);
  info.P2 = { more: !!more, tiles };
  const hy = (tiles || []).find((x) => /Гиперб/.test(x.t));
  ok('P2 Russian phone: the Hyperbolic tile reads «Гиперб.», whole, on one line', hy && hy.t === 'Гиперб.' && hy.fits && !hy.soft && hy.lines === 1, info.P2);
  ok('P2 Russian phone: no tile name hyphenated or cut', tiles.length > 10 && tiles.every((x) => x.fits && !x.soft), tiles.filter((x) => !x.fits || x.soft));
  await SHOT('P2-phone-ru-more-tools');
  await key('Escape'); await settle(300);
  // a shape's ⋯ on touch names no keyboard keys (merge: modK is empty on a touch screen)
  const items = await ev(`(() => { const s = __cmwShapes().shapes.find((x) => x.kind !== 'point') || __cmwShapes().shapes[0]; return s ? s.id : null; })()`);
  await ev(`__cmwSelect(${JSON.stringify(items)}); 1`); await settle(300);
  const row = await ev(`(() => { const b = document.querySelector('#shapeList .shape[data-id="${items}"] .more, #shapeList .shape[data-id="${items}"] [aria-label*="⋯"], #shapeList .shape[data-id="${items}"] button:last-child'); if (!b) return null; b.click(); return 1; })()`);
  await settle(500);
  const keys = await ev(`[...document.querySelectorAll('.mi-key')].filter((k) => k.getClientRects().length).map((k) => k.textContent).filter(Boolean)`);
  info.P2keys = { row, keys };
  ok('P2 phone: a shape\'s ⋯ shows no Ctrl / ⌘ keys', row === null || !keys.some((k) => /Ctrl|⌘/.test(k)), info.P2keys);
  await key('Escape'); await settle(200);
});

// ---------------------------------------------------------------- P3 phone, dark
await section('P3', async () => {
  await phone(412, 860, true);
  await fresh(NS + 'j');
  await SHOT('P3-phone-dark-en');
  await phone(412, 860, true);
  await fresh(NS + 'k', '&lang=ru');
  await SHOT('P3-phone-dark-ru');
});

await laptop(1440, 900, false);
ok('no exception or console error anywhere', errs.length === 0, errs.slice(0, 8));
return { checks, failed: fails.length, fails, info, errs: errs.slice(0, 12) };
