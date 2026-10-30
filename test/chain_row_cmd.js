// The phone's chain bar and chain sheet (issue #246, the owner's option B) and the step glide:
//   (a) at 360 × 740, 390 × 844 and 412 × 915, portrait, and 740 × 360 and 915 × 412, landscape, in English, and at 360
//       in Russian and Italian: the bar is one row, ‹, the plane it is at, ›, "N steps ▾", Deformation; no control
//       overlaps another or leaves the screen, every one is 44 × 44 px or more, no word is cut; no F tile, no card on
//       the bar;
//   (b) "N steps ▾" opens the chain as a sheet: Numbers, the whole map (F, named, with its guarantees in words), z and
//       each step as a row with its picture, Bypass and More (44 px targets), Add function last;
//   (c) ‹ glides the deformation from F to the plane after the step before: it opens the deformation paused at its
//       end, T moves at once and continuously, settles exactly on the step, and the chip names that step; ‹ again
//       goes on, › at once turns it round with no jump (T never moves by more than a step's share between samples),
//       quick presses go faster; ‹ at the start and › at the end are off;
//   (d) a step's row dragged by its grip below the next one moves the step (a touch screen has no drag and drop);
//   (e) a laptop (1440 px) keeps its strip: the cards and the F tile in the chain bar, no phone row, F without the
//       phone's name;
//   (f) with a step shown alone the chip names that step, marked alone, and ‹ ends Show alone and says so;
//   (g) under reduced motion ‹ › put T on the step at once.
// A command file for a CDP daemon (test/cdp_kit README).
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const fails = [];
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
const settle = async (ms = 400) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const ST = { shapes: [], steps: [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: {}, on: true }, { type: 'pown', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' } };
const fresh = async (w, h, mobile, lang, state = ST) => {
  await view(w, h, false, mobile);
  const ns = 'crow' + w + (lang || '') + (Date.now() % 1000000);
  await load(ns, state);
  if (lang) { await send('Page.navigate', { url: `${U}?ns=${ns}&lang=${lang}` }); await sleep(2500); }
  await settle(1000);
};
const glide = (d) => ev(`__cmwGlide(${d || 0})`);
// the bar's controls: their rects, whether any two overlap, any is under 44 px or off the screen, any word cut
const bar = () => ev(`(() => {
  const wrap = document.querySelector('.pipe-wrap'); if (!wrap) return null;
  const vis = (e) => e.getClientRects().length > 0 && e.getBoundingClientRect().width > 0;
  const ctl = [...wrap.querySelectorAll('.ph-crow > button, :scope > #morphBtn')].filter(vis).map((e) => { const r = e.getBoundingClientRect(); return { c: e.id || e.className.split(' ').pop(), l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, cut: [...e.querySelectorAll('span')].some((s) => s.scrollWidth > s.clientWidth + 1 && getComputedStyle(s).textOverflow !== 'ellipsis') }; });
  const over = [];
  for (let i = 0; i < ctl.length; i++) for (let j = i + 1; j < ctl.length; j++) { const a = ctl[i], b = ctl[j]; if (a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5) over.push([a.c, b.c]); }
  const W = innerWidth, H = innerHeight;
  return { n: ctl.length, names: ctl.map((c) => c.c), over, small: ctl.filter((c) => c.w < 44 || c.h < 44).map((c) => [c.c, Math.round(c.w), Math.round(c.h)]), off: ctl.filter((c) => c.l < -0.5 || c.r > W + 0.5 || c.t < -0.5 || c.b > H + 0.5).map((c) => c.c), cut: ctl.filter((c) => c.cut).map((c) => c.c),
    strip: [...document.querySelectorAll('#pipeline .card, #pipeline .ftile, #pipeline .add-card')].filter(vis).filter((e) => !e.closest('.ph-sheet')).length,
    chip: (document.querySelector('.ph-cchip') || {}).textContent, steps: (document.querySelector('.ph-csteps') || {}).textContent,
    prevOff: !!(document.querySelector('.ph-cprev') || {}).disabled, nextOff: !!(document.querySelector('.ph-cnext') || {}).disabled, barH: Math.round(wrap.getBoundingClientRect().height) };
})()`);

// ---- (a) the bar at five sizes, and in Russian and Italian at 360
for (const [w, h, lang] of [[360, 740, ''], [390, 844, ''], [412, 915, ''], [740, 360, ''], [915, 412, ''], [360, 740, 'ru'], [360, 740, 'it']]) {
  await fresh(w, h, true, lang);
  const tag = `${w}×${h} ${lang || 'en'}`;
  const b = await bar();
  ok(`${tag}: the bar is ‹, the plane, ›, N steps, Deformation`, b && b.n === 5 && b.names.join() === 'ph-cprev,ph-cchip,ph-cnext,ph-csteps,morphBtn', b);
  ok(`${tag}: no control overlaps another`, b && !b.over.length, b && b.over);
  ok(`${tag}: every control is 44 × 44 px or more`, b && !b.small.length, b && b.small);
  ok(`${tag}: none leaves the screen, no word is cut`, b && !b.off.length && !b.cut.length, b && [b.off, b.cut]);
  ok(`${tag}: no card, F tile or Add tile on the bar`, b && b.strip === 0, b && b.strip);
  ok(`${tag}: at rest the bar shows F's last step and 3 steps; › is off, ‹ on`, b && /3/.test(b.steps) && b.nextOff && !b.prevOff, b);
  if (w === 390) ok(`${tag}: the bar is 56 px (64 before #246)`, b && b.barH === 56, b && b.barH);
}

// ---- (b) the chain sheet
await fresh(390, 844, true, '');
await ev(`document.querySelector('.ph-csteps').click(); 1`); await settle(900);
const sh = await ev(`(() => {
  const body = document.querySelector('.ph-sb[data-k="chain"]'); if (!body || body.hidden) return { open: false, sheet: Phone.sheet() };
  const kids = [...body.querySelectorAll(':scope > .ph-nums, #pipeline > .ftile, #pipeline > .card, #pipeline > .add-card')].filter((e) => e.getClientRects().length);
  const rows = kids.map((e) => { const r = e.getBoundingClientRect(); return { c: e.className.split(' ')[0] + (e.dataset.k ? e.dataset.k : ''), t: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width) }; }).sort((a, b) => a.t - b.t);
  const acts = [...body.querySelectorAll('#pipeline .card[data-k] .acts button')].filter((e) => e.getClientRects().length).map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), e.getAttribute('aria-hidden'), getComputedStyle(e).pointerEvents]; });
  const f = body.querySelector('#pipeline .ftile');
  return { open: true, sheet: Phone.sheet(), order: rows.map((r) => r.c), rows, acts, fName: f && f.querySelector('.fwm') && getComputedStyle(f.querySelector('.fwm')).display !== 'none' ? f.querySelector('.fwm').textContent : null, fWords: f ? [...f.querySelectorAll('.lamp:not([hidden]) .lampname')].filter((e) => e.getClientRects().length).map((e) => e.textContent) : [] };
})()`);
ok('(b) N steps opens the chain sheet', sh && sh.open && sh.sheet === 'chain', sh);
ok('(b) its rows: Numbers, the whole map, z, f₁ f₂ f₃, Add function', sh && sh.order && sh.order.join() === 'ph-nums,ftile,card0,card1,card2,card3,add-card', sh && sh.order);
ok('(b) every row 44 px tall or more', sh && sh.rows && sh.rows.every((r) => r.h >= 44), sh && sh.rows);
ok('(b) the whole map is named, with its guarantees in words', sh && sh.fName === 'The whole map' && sh.fWords.length > 0, sh && [sh.fName, sh.fWords]);
ok('(b) each step has Bypass and More, 44 px targets a finger can press', sh && sh.acts && sh.acts.length === 6 && sh.acts.every((a) => a[0] >= 44 && a[1] >= 44 && a[2] == null && a[3] !== 'none'), sh && sh.acts);
await ev(`document.querySelector('#pipeline .card[data-k="2"]').click(); 1`); await settle(900);
ok('(b) a step\'s row opens its sheet', (await ev('Phone.sheet()')) === 'edit', await ev('Phone.sheet()'));
await ev('Phone.close(true); 1'); await settle(400);

// ---- (c) the glide
await fresh(390, 844, true, '');
await ev(`document.querySelector('.ph-cprev').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); 1`);
let g = await ev(`(() => { document.querySelector('.ph-cprev').click(); return __cmwGlide(); })()`);
ok('(c) ‹ opens the deformation paused at its end and aims at the step before', g && g.open && !g.playing && g.max === 3 && g.target === 2, g);
// samples of T while it glides (each 40 ms): it moves at once, monotonically, settles on 2
const sample = async (ms) => {
  const out = [], t0 = Date.now();
  while (Date.now() - t0 < ms) { const s = await glide(); out.push([Date.now() - t0, s.T, s.moving]); await sleep(40); }
  return out;
};
let S1 = await sample(4000);
if (!Array.isArray(S1)) { ok('(c) T can be sampled while it glides', false, S1); return { pass: false, fails }; }
const firstMove = S1.find((s) => s[1] < 3 - 1e-3);
ok('(c) T moves within 400 ms of the press', firstMove && firstMove[0] <= 400, S1.slice(0, 8));
ok('(c) and only towards the target', S1.every((s, i) => !i || s[1] <= S1[i - 1][1] + 1e-9), S1.map((s) => +s[1].toFixed(3)));
ok('(c) it settles exactly on 2', S1[S1.length - 1][1] === 2 && !S1[S1.length - 1][2], S1.slice(-3));
// (the glide's own time from the press to settling, the frames' dt, each at most 100 ms: the 2 s the owner set, on any
// machine; the wall time is longer only where a frame takes over 100 ms, as in this software-drawn browser)
const own = await glide();
ok('(c) it settles within 2 s of its own time', own.since > 0 && own.since <= 2, { since: own.since, wallMs: (S1.find((s) => !s[2]) || [null])[0] });
let b = await bar();
ok('(c) the chip names f₂, Möbius', b && /f2/.test(b.chip.replace(/\s/g, '')) && /Möbius/.test(b.chip), b && b.chip);
ok('(c) › is on again inside the chain', b && !b.nextOff && !b.prevOff, b);
// ‹ then › soon after: it turns round from where it is, no jump
await glide(-1); await sleep(250);
const before = await glide();
await glide(1);
S1 = await sample(3000);
const jumps = S1.map((s, i) => (i ? Math.abs(s[1] - S1[i - 1][1]) : 0));
ok('(c) a press the other way turns T round where it is (no jump)', Math.abs(S1[0][1] - before.T) < 0.25 && Math.max(...jumps) < 0.35, { before: before.T, T: S1.map((s) => +s[1].toFixed(3)) });
ok('(c) and it settles back on 2', S1[S1.length - 1][1] === 2, S1.slice(-2));
// quick presses go faster: ‹ ‹ (two steps) peaks faster than one
const speed = async (n) => {
  await ev('__cmwMorph({ T: 2 }); 1'); await settle(300);
  for (let i = 0; i < n; i++) { await glide(-1); await sleep(60); }
  const s = await sample(1500);
  let peak = 0; for (let i = 1; i < s.length; i++) peak = Math.max(peak, Math.abs(s[i][1] - s[i - 1][1]) / Math.max(1, s[i][0] - s[i - 1][0]));
  return peak * 1000;
};
const v1 = await speed(1), v2 = await speed(2);
ok('(c) two quick presses go faster than one', v2 > 1.3 * v1, { one: v1, two: v2 });
// the ends: at 0, ‹ is off
await ev('__cmwMorph({ T: 0 }); 1'); await settle(500); await glide(); await settle(300);
b = await bar();
ok('(c) at the start the chip is z and ‹ is off', b && b.prevOff && /z/.test(b.chip), b);
await ev('__cmwMorph({ open: false }); 1'); await settle(500);

// ---- (d) a step dragged by its grip
await fresh(390, 844, true, '');
await ev(`document.querySelector('.ph-csteps').click(); 1`); await settle(900);
const geo = await ev(`(() => { const g = document.querySelector('#pipeline .card[data-k="1"] .grip').getBoundingClientRect(), c2 = document.querySelector('#pipeline .card[data-k="2"]').getBoundingClientRect(); return { x: g.left + g.width / 2, y: g.top + g.height / 2, y2: c2.bottom - 4 }; })()`);
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: geo.x, y: geo.y });
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: geo.x, y: geo.y, button: 'left', buttons: 1, clickCount: 1 });
for (let i = 1; i <= 6; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: geo.x, y: geo.y + (geo.y2 - geo.y) * i / 6, button: 'left', buttons: 1 }); await sleep(30); }
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: geo.x, y: geo.y2, button: 'left', buttons: 0, clickCount: 1 });
await settle(700);
const types = await ev(`__cmwState().steps ? __cmwState().steps.map((s) => s.type) : [...document.querySelectorAll('#pipeline .card[data-k]:not(.region-card) .nm')].map((e) => e.textContent)`);
ok('(d) f₁ dragged below f₂ swaps them', Array.isArray(types) && /bius/i.test(String(types[0])) && /exp/i.test(String(types[1])), types);
await ev('Phone.close(true); 1'); await settle(300);

// ---- (f) a step shown alone: the chip names it, marked alone; ‹ ends Show alone and says so
await fresh(390, 844, true, '');
await ev(`document.querySelector('.ph-csteps').click(); 1`); await settle(800);
await ev(`document.querySelector('#pipeline .card[data-k="2"]').click(); 1`); await settle(900);
await ev(`(() => { const b = document.querySelector('#propsPanel .insp-step .ihead .alone-btn'); if (b) b.click(); return !!b; })()`); await settle(900);
await ev('Phone.close(true); 1'); await settle(500);
const al = await ev(`({ focus: __cmwState().focus, chip: document.querySelector('.ph-cchip').textContent, alone: document.querySelector('.ph-cchip').classList.contains('alone'), label: document.querySelector('.ph-cchip').getAttribute('aria-label') })`);
ok('(f) with f₂ shown alone the chip names f₂, marked alone (its accessible name says so)', al.focus === 2 && /f2/.test(al.chip.replace(/\s/g, '')) && al.alone && /Show alone/.test(al.label || ''), al);
await ev(`document.querySelector('.ph-cprev').click(); 1`); await settle(700);
const after = await ev(`({ focus: __cmwState().focus, open: __cmwGlide().open, toast: [...document.querySelectorAll('#toastHost .toast, #toastHost > *')].map((e) => e.textContent).join(' | ') })`);
ok('(f) ‹ then ends Show alone, says so, and glides the whole chain', after.focus === 0 && after.open && /Show alone ended/.test(after.toast), after);
await ev('__cmwMorph({ open: false }); 1'); await settle(500);

// ---- (g) reduced motion: ‹ › go to the step at once, with no sweep
await fresh(390, 844, true, '');
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
await ev(`document.querySelector('.ph-cprev').click(); 1`); await sleep(60);
const rm = await glide();
ok('(g) reduced motion: ‹ puts T on the step at once, nothing gliding', rm.open && rm.T === 2 && !rm.moving, rm);
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
await ev('__cmwMorph({ open: false }); 1'); await settle(500);

// ---- (e) the laptop keeps its strip
await fresh(1440, 900, false, '');
const lap = await ev(`(() => ({ row: !!document.querySelector('.ph-crow') && document.querySelector('.ph-crow').getClientRects().length > 0, cards: [...document.querySelectorAll('#pipeline > .card')].filter((e) => e.getClientRects().length).length, f: !!document.querySelector('#pipeline > .ftile') && document.querySelector('#pipeline > .ftile').getClientRects().length > 0, fName: !!document.querySelector('#pipeline .ftile .fwm') && document.querySelector('#pipeline .ftile .fwm').getClientRects().length > 0, inBar: !!document.querySelector('.pipe-wrap #pipeline') }))()`);
ok('(e) 1440 px: the strip of cards and the F tile in the chain bar, no phone row, no phone name on F', lap && !lap.row && lap.cards === 4 && lap.f && !lap.fName && lap.inBar, lap);
await view(1440, 900, false, false);
return { pass: fails.length === 0, fails };
