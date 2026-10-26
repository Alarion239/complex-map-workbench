// The phone layout (v15, src/phone.js + src/phone.css; notes/ui-redesign-2/phone/DESIGN.md, build/phone.md).
// Checks, at 360 × 780, 390 × 844 and 430 × 932, light and dark, English and Russian: one screen without page scroll
// or sideways overflow; no control under 44 × 44 on the main screen, in each sheet and in the long-press menu; every
// task of DESIGN.md 5 with its tap count; X | Y side by side above an open sheet, the planes resized once, after the
// sheet's animation; the inset swaps; the long-press menu (menu on release, a zero added exactly, no menu after a
// slide); a landscape phone (844 × 390) and a touch tablet (820 × 1180, the desktop tablet layout, unchanged).
// A command file for a CDP daemon (test/cdp_kit README):
//   python3 build.py && test/<you>_cdp/q.sh test/v15_phone_cmd.js
// Prints {pass, fails, info}; screenshots go to <daemon folder>/shots/v15ph-*.png.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const URL0 = `http://localhost:${PORT}/test.html?ns=v15ph`;
const fails = [], info = { taps: {}, audit: {}, scroll: {} };
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 350) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const errs = [];
const grab = async () => { errs.push(...(await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource|favicon/.test(x.m || ''))); };
const CHAIN3 = [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' }, on: true }, { type: 'zp', params: { a: '1', zeros: '0.5, -0.5i', poles: '-0.8+0.75i' }, on: true }];
const SHAPES = [{ id: 's1', kind: 'rect', a: [-3.2, -1.5], b: [3.2, 1.5] }];
let taps = 0;
const center = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e || !e.getClientRects().length) return null; e.scrollIntoView({ block: 'nearest', inline: 'nearest' }); const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
const touch = async (x, y, ms = 60) => {
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  await sleep(ms);
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
};
const tap = async (sel, wait = 380) => { const c = await center(sel); if (!c) { fails.push({ name: 'tap target missing', got: sel }); return false; } taps++; await touch(c[0], c[1]); await settle(wait); return true; };
const hold = async (x, y, ms, slide) => {
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  await sleep(ms);
  if (slide) for (let i = 1; i <= 6; i++) { await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (slide[0] * i) / 6, y: y + (slide[1] * i) / 6, id: 1 }] }); await sleep(16); }
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await settle(300);
};
const st = () => ev(`(() => { const s = __tourApi.snapshot().state; return { steps: s.steps.length, shapes: s.shapes.length, pattern: s.pattern, view: s.view && s.view.main, params: s.steps.map((x) => x.params), ph: Phone._state() }; })()`);
// the screen: no page scroll, nothing past the edges, no cut label
const screen = () => ev(`(() => {
  const de = document.documentElement, iw = innerWidth, ih = innerHeight;
  const out = [];
  const vis = (e) => { const s = getComputedStyle(e); return e.getClientRects().length && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0; };
  for (const e of document.querySelectorAll('.top *, #secDraw *, .pipe-wrap > :not(#pipeline), .ph-col *, .viewstack *, .chip.readout, .ph-sheet .ph-sh *, .ph-sheet .ph-row, .ph-sheet .ph-srow, .tdock *')) {
    if (!vis(e)) continue;
    const r = e.getBoundingClientRect();
    if (r.right > iw + 1 || r.left < -1 || r.bottom > ih + 1) out.push((e.id || e.className || e.tagName).toString().slice(0, 40) + ' ' + Math.round(r.left) + '..' + Math.round(r.right) + ' / ' + Math.round(r.bottom));
  }
  const cut = [];
  for (const e of document.querySelectorAll('#viewSwitch > button > span, #secDraw .tool > span, #secDraw .tm-label, .pipe-wrap > #morphBtn > span, .ph-sheet .ph-rl, .ph-sheet .ph-seg > button, .ph-tl')) {
    if (!vis(e)) continue;
    if (e.scrollWidth > e.clientWidth + 1) cut.push(e.textContent.trim().slice(0, 30) + ' ' + e.scrollWidth + '>' + e.clientWidth);
  }
  return { sh: Math.max(de.scrollHeight, document.body.scrollHeight), sw: Math.max(de.scrollWidth, document.body.scrollWidth), ih, iw, scrollY: scrollY, out: out.slice(0, 12), cut: cut.slice(0, 12) };
})()`);
// every control in sight at least 44 × 44 (the review's audit: buttons, fields, radios, menu items, links, summaries)
const audit = (scope) => ev(`(() => {
  const iw = innerWidth, ih = innerHeight;
  const sel = 'button, input:not([type=hidden]), select, textarea, summary, a[href], [role=radio], [role=menuitem], [role=menuitemradio], [role=option], [role=switch], [role=tab]';
  const root = document.querySelector(${JSON.stringify(scope || 'body')});
  if (!root) return { total: 0, small: ['no scope'] };
  const small = []; let total = 0;
  for (let e of root.querySelectorAll(sel)) {
    if (e.closest('[hidden], .ph-inset .plot, .xf, .modal-bg')) continue;
    if (e.matches('input[type=checkbox], input[type=radio]') && e.closest('label')) e = e.closest('label');
    const s = getComputedStyle(e);
    if (!e.getClientRects().length || s.visibility === 'hidden' || +s.opacity === 0 || s.pointerEvents === 'none') continue;
    const r = e.getBoundingClientRect();
    if (r.bottom <= 0 || r.top >= ih || r.right <= 0 || r.left >= iw) continue;
    // covered by the open sheet or its scrim (the main screen behind a sheet is not counted)
    const cx = Math.min(iw - 1, Math.max(0, r.left + r.width / 2)), cy = Math.min(ih - 1, Math.max(0, r.top + r.height / 2));
    const top = document.elementFromPoint(cx, cy);
    if (top && top !== e && !e.contains(top) && !top.contains(e) && (top.closest('.ph-sheet, .ph-scrim') && !e.closest('.ph-sheet'))) continue;
    total++;
    if (r.width < 43.5 || r.height < 43.5) small.push((e.id || (e.className && e.className.baseVal === undefined ? e.className : '') || e.tagName).toString().slice(0, 32) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' "' + ((e.getAttribute('aria-label') || e.textContent || '').trim()).slice(0, 24) + '"');
  }
  return { total, small: small.slice(0, 20), n: small.length };
})()`);
const panes = () => ev(`(() => { const r = (id) => { const e = document.getElementById(id); if (!e || !e.getClientRects().length) return null; const b = e.getBoundingClientRect(); return { l: Math.round(b.left), t: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height), b: Math.round(b.bottom) }; }; const sh = document.querySelector('.ph-sheet'); return { L: r('paneL'), R: r('paneR'), sheetTop: sh && !sh.hidden ? Math.round(sh.getBoundingClientRect().top) : null, chain: r('pipeline') }; })()`);
const closeSheet = async () => { await ev('Phone.close(true)'); await settle(250); };
const loadChain = async (ns, extra) => { await load(ns, Object.assign({ shapes: SHAPES, steps: CHAIN3, srcView: { cx: 0, cy: 0, s: 52 } }, extra || {})); await settle(600); };

// ---------- 1. every width, light and dark, English and Russian: one screen, 44 px, no overflow ----------
const SIZES = [[360, 780], [390, 844], [430, 932]];
for (const lang of ['en', 'ru']) for (const dark of [false, true]) for (const [w, hgt] of SIZES) {
  const tag = `${w}-${dark ? 'dark' : 'light'}-${lang}`;
  await view(w, hgt, dark, true);
  await load('v15ph' + tag, { shapes: SHAPES, steps: CHAIN3, srcView: { cx: 0, cy: 0, s: 52 } });
  if (lang === 'ru') { await nav(`http://localhost:${PORT}/test.html?ns=v15ph${tag}&lang=ru`); }
  await settle(700);
  const s0 = await screen();
  info.scroll[tag] = { sh: s0.sh, ih: s0.ih, sw: s0.sw, iw: s0.iw };
  ok(`${tag}: no page scroll`, s0.sh <= s0.ih + 1 && s0.sw <= s0.iw + 1 && s0.scrollY === 0, s0);
  ok(`${tag}: nothing past the screen's edges`, !s0.out.length, s0.out);
  ok(`${tag}: no cut label`, !s0.cut.length, s0.cut);
  ok(`${tag}: the language`, (await ev('document.documentElement.dataset.lang || "en"')) === lang);
  const a0 = await audit('body');
  info.audit[tag + ' home'] = a0.total;
  ok(`${tag}: main screen, every control 44 × 44`, a0.n === 0 && a0.total >= 18, a0);
  if (w === 390 || w === 360) {
    await shot(`v15ph-home-${tag}`);
    // each sheet
    for (const [k, how] of [['edit', '#pipeline .card[data-k="3"]'], ['F', '#pipeline .ftile'], ['tools', '#toolMore > summary'], ['display', '#plotL .ph-dsp'], ['more', '#hdrMoreBtn']]) {
      await tap(how, 450);
      const s1 = await screen(), a1 = await audit(k === 'more' ? '.ph-sheet' : 'body');
      ok(`${tag}: ${k} sheet: no page scroll`, s1.sh <= s1.ih + 1 && s1.sw <= s1.iw + 1, s1);
      ok(`${tag}: ${k} sheet: nothing past the edges, no cut label`, !s1.out.length && !s1.cut.length, { out: s1.out, cut: s1.cut });
      ok(`${tag}: ${k} sheet: every control 44 × 44`, a1.n === 0, a1);
      info.audit[`${tag} ${k}`] = a1.total;
      if (w === 390 || k === 'edit') await shot(`v15ph-${k}-${tag}`);
      await closeSheet();
    }
  }
  await grab();
}

// ---------- 2. the tasks of DESIGN.md 5, with their tap counts (390 × 844, light, English) ----------
await view(390, 844, false, true);
await loadChain('v15phT');
const T = async (name, max, fn) => { taps = 0; const r = await fn(); info.taps[name] = taps; ok(`task "${name}": done`, r === true, r); ok(`task "${name}": ${max} taps or fewer`, taps <= max, taps); await closeSheet(); await ev(`document.querySelectorAll('#popHost .pop, .modal-bg').forEach((e) => e.remove())`); await settle(150); };
await T('Switch view', 1, async () => { await tap('#viewSwitch > button[data-mode="phase"]', 700); const s = await st(); const h = await ev(`document.querySelector('#viewSwitch > button[data-mode="phase"]').getBoundingClientRect().height`); await tap('#viewSwitch > button[data-mode="xy"]', 600); taps--; return s.view === 'phase' && h >= 44 || s; });
await T('Undo (bottom row)', 1, async () => { const n0 = (await st()).shapes; await ev(`__cmwShapes && 0`); await ev(`(() => { document.querySelector('#tools .tool[data-tool="disc"]').click(); })()`); const L = await panes(); await drag(L.L.l + 120, L.L.t + 140, L.L.l + 170, L.L.t + 170, 8, 16); await settle(300); await ev(`document.querySelector('#tools .tool[data-tool="select"]').click()`); const n1 = (await st()).shapes; const y = await ev(`document.querySelector('.ph-undo').getBoundingClientRect().top`); await tap('.ph-undo', 500); const n2 = (await st()).shapes; return (n1 === n0 + 1 && n2 === n0 && y > 760) || { n0, n1, n2, y }; });
await T('Draw a disc and watch its image', 1, async () => { const n0 = (await st()).shapes; await tap('#secDraw .tool[data-tool="disc"]'); const L = await panes(); await drag(L.L.l + 200, L.L.t + 160, L.L.l + 240, L.L.t + 190, 8, 16); await settle(400); const s = await st(); const ins = await ev(`!!document.querySelector('#paneR.ph-inset') && document.getElementById('paneR').getBoundingClientRect().width > 100`); await ev(`document.querySelector('#tools .tool[data-tool="select"]').click()`); return (s.shapes === n0 + 1 && ins) || { s, ins }; });
await T('Change a parameter of an existing step', 2, async () => { await tap('#pipeline .card[data-k="2"]', 500); const f = await center('#propsPanel input[id^="i2_"]'); if (!f) return 'no field'; taps++; await touch(f[0], f[1]); await settle(200); await ev(`(() => { const e = document.activeElement; e.select && e.select(); })()`); await type('2'); await key('Enter'); await settle(400); const p = await panes(); const v = (await st()).params[1]; return (p.L && p.R && p.L.w > 150 && p.R.w > 150 && p.L.b <= p.sheetTop && Object.values(v).includes('2')) || { p, v }; });
await T('Add a step and change its parameter', 4, async () => { const n0 = (await st()).steps; await tap('#addStepBtn', 600); await type('sin'); await settle(300); await key('Enter'); await settle(700); const n1 = (await st()).steps; await tap(`#pipeline .card[data-k="${n1}"]`, 500); const f = await center('#propsPanel input'); const p = await panes(); if (f) { taps++; await touch(f[0], f[1]); await settle(200); } return (n1 === n0 + 1 && p.L && p.R && p.L.w > 150 && p.L.b <= p.sheetTop) || { n0, n1, p, f }; });
await ev(`document.getElementById('undoBtn').click()`); await settle(400);
await T('Change the pattern', 2, async () => { const p0 = (await st()).pattern; await tap('#plotL .ph-dsp', 500); const t = await center(`.ph-sheet #patternSeg .pat:not(.on)`); if (!t) return 'no swatch'; taps++; await touch(t[0], t[1]); await settle(400); const p1 = (await st()).pattern; const pn = await panes(); return (p1 !== p0 && pn.L.b <= pn.sheetTop && pn.R && pn.R.w > 150) || { p0, p1, pn }; });
await T("See F's formula and guarantees", 1, async () => { await tap('#pipeline .ftile', 500); const t = await ev(`(() => { const e = document.querySelector('#propsPanel'); return e ? e.innerText : ''; })()`); return /Analytic|Not implied|Natural domain|domain/i.test(t) || t.slice(0, 200); });
await T('Drag a shared number and watch X and Y', 2, async () => { await ev(`Params.add('a', { value: 0.5, min: -2, max: 2, step: 0.01 })`); await settle(300); const nm = await ev(`document.querySelector('.ph-nums').textContent`); await tap('.ph-nums', 600); const sl = await ev(`(() => { const e = document.querySelector('#propsPanel input[type=range]'); if (!e) return null; e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); return [b.left + 6, b.top + b.height / 2, b.right - 6]; })()`); if (!sl) return 'no slider'; taps++; await drag(sl[0] + (sl[2] - sl[0]) / 2, sl[1], sl[0] + (sl[2] - sl[0]) * 0.8, sl[1], 6, 16); await settle(300); const v = await ev(`Params.get('a')`); const p = await panes(); return (/a/.test(nm) && v !== 0.5 && p.L && p.R && p.L.b <= p.sheetTop) || { nm, v, p }; });
await T('Add a zero at a chosen point of X (long-press)', 2, async () => {
  const z0 = String((await st()).params[2].zeros).split(',').length;
  const L = await panes(); const x = L.L.l + L.L.w * 0.3, y = L.L.t + L.L.h * 0.35;
  taps++; await hold(x, y, 650);
  const m = await ev(`(() => { const p = document.querySelector('#popHost .pop.menu.pm'); if (!p) return null; return { ids: [...p.querySelectorAll('.mi')].map((b) => b.dataset.pm), hs: [...p.querySelectorAll('.mi')].map((b) => b.getBoundingClientRect().height) }; })()`);
  if (!m || !m.ids.includes('zp-add-zeros-3')) return { m };
  ok('long-press menu: 44 px rows', m.hs.every((h) => h >= 43.5), m.hs);
  const a = await audit('#popHost'); ok('long-press menu: every control 44 × 44', a.n === 0, a);
  await shot('v15ph-ctx-390-light-en');
  await tap('#popHost .pop.menu.pm .mi[data-pm="zp-add-zeros-3"]', 500);
  const z1 = String((await st()).params[2].zeros).split(',').length;
  return z1 === z0 + 1 || { z0, z1 };
});
await T('Long-press then slide: no menu', 1, async () => { const L = await panes(); taps++; await hold(L.L.l + L.L.w * 0.5, L.L.t + L.L.h * 0.6, 650, [50, 30]); const any = await ev(`!!document.querySelector('#popHost .pop.menu')`); return !any || 'menu opened'; });
await T('Play the deformation', 1, async () => { await tap('.pipe-wrap > #morphBtn', 900); const on = await ev(`document.documentElement.classList.contains('ph-morph')`); const dock = await ev(`(() => { const d = document.querySelector('.tdock:not([hidden])'); if (!d) return null; const b = d.getBoundingClientRect(); return { top: Math.round(b.top), h: Math.round(b.height) }; })()`); const a = await audit('body'); ok('deformation: every control 44 × 44', a.n === 0, a); const s = await screen(); ok('deformation: nothing past the edges, no cut label', !s.out.length && !s.cut.length, s); await shot('v15ph-def-390-light-en'); await ev(`document.getElementById('morphBtn').click()`); await settle(500); return (on && dock && dock.top > 760) || { on, dock }; });
await T('Export a figure (to the dialog)', 3, async () => { await tap('#hdrMoreBtn', 450); const rows = await ev(`[...document.querySelectorAll('.ph-sheet .ph-row')].map((b) => b.textContent)`); const i = rows.findIndex((t) => /Export figure/.test(t)); if (i < 0) return rows; await tap(`.ph-sheet .ph-row:nth-of-type(${i + 1})`, 900); const open = await ev(`!!document.querySelector('.modal.xf')`); return open || 'no dialog'; });
await ev(`(() => { const b = document.querySelector('.modal.xf .close, .modal.xf [aria-label="Close"]'); if (b) b.click(); document.querySelectorAll('.modal-bg').forEach((e) => e.remove()); })()`); await settle(300);
await T('Turn on sound', 2, async () => { await tap('#hdrMoreBtn', 450); await tap('.ph-sheet .ph-switch', 300); const on = await ev(`document.querySelector('.ph-sheet .ph-switch').getAttribute('aria-checked')`); await ev(`document.querySelector('.ph-sheet .ph-switch').click()`); return on === 'true' || on; });
await T('Load an example', 3, async () => { await tap('#hdrMoreBtn', 450); const rows = await ev(`[...document.querySelectorAll('.ph-sheet .ph-row')].map((b) => b.textContent)`); const i = rows.findIndex((t) => /Examples/.test(t)); await tap(`.ph-sheet .ph-row:nth-of-type(${i + 1})`, 900); const n = await ev(`document.querySelectorAll('#popHost .examples .ex-item').length`); const r = await ev(`(() => { const p = document.querySelector('#popHost .pop.menu.examples'); if (!p) return null; const b = p.getBoundingClientRect(); return { l: b.left, r: b.right, b: b.bottom, iw: innerWidth, ih: innerHeight }; })()`); if (!n) return 'no gallery'; const a = await audit('#popHost'); ok('examples gallery: every control 44 × 44', a.n === 0, a); await tap('#popHost .examples .ex-item:nth-of-type(2)', 900); const s = await st(); return (s.steps === 2 && r && r.l >= 0 && r.r <= r.iw + 1) || { s, r }; });
await T('Swap the planes (tap the inset)', 1, async () => { const b0 = (await st()).ph.big; await tap('#paneR.ph-inset > .ph-swap', 600); const b1 = (await st()).ph.big; const p = await panes(); await tap('#paneL.ph-inset > .ph-swap', 600); taps--; return (b0 === 'L' && b1 === 'R' && p.R.w > 380 && p.L.w <= 120) || { b0, b1, p }; });
await T('Change language', 2, async () => { await tap('#hdrMoreBtn', 450); await tap('.ph-sheet .ph-seg button[data-v="ru"]', 300); await sleep(2500); await settle(500); const l = await ev('document.documentElement.dataset.lang'); await ev(`I18N.setPref('auto')`); await sleep(2500); return l === 'ru' || l; });
await nav(URL0 + 'T'); await settle(600);

// ---------- 3. the sheet: X | Y above it, one resize after the animation; the grabber; Esc ----------
await view(390, 844, false, true);
await loadChain('v15phS');
await ev(`window.__phRO = []; window.__phT0 = 0; const ro = new ResizeObserver((es) => { for (const e of es) window.__phRO.push([e.target.id, Math.round(performance.now() - window.__phT0), Math.round(e.contentRect.width), Math.round(e.contentRect.height)]); }); ro.observe(document.getElementById('canvasL')); ro.observe(document.getElementById('canvasR')); setTimeout(() => { window.__phRO = []; }, 100); 1`);
await settle(300);
await ev(`window.__phT0 = performance.now(); window.__phRO = []; 1`);
await tap('#pipeline .card[data-k="3"]', 700);
const ro = await ev('window.__phRO');
const p1 = await panes();
info.sheetResize = ro;
ok('sheet: the planes resize only after the sheet has slid in (≥ 200 ms), once per plane', ro.length >= 1 && ro.every((r) => r[1] >= 200) && new Set(ro.map((r) => r[0])).size === ro.length, ro);
ok('sheet: X | Y side by side above it', p1.L && p1.R && Math.abs(p1.L.w - p1.R.w) <= 2 && p1.L.t === p1.R.t && p1.R.l >= p1.L.l + p1.L.w - 1 && p1.L.b <= p1.chain.t + 1 && p1.chain.b <= p1.sheetTop + 1, p1);
ok('sheet: the planes keep a useful size', p1.L.h >= 240 && p1.L.w >= 190, p1);
await shot('v15ph-zp-390-light-en');
// the editor: Add zero / Add pole 48 px, the step's fields
const zp = await ev(`(() => { const b = [...document.querySelectorAll('#propsPanel button')].filter((x) => /Add zero|Add pole/.test(x.textContent)); return b.map((x) => Math.round(x.getBoundingClientRect().height)); })()`);
ok('editor: Add zero and Add pole, 44 px or more', zp.length === 2 && zp.every((x) => x >= 44), zp);
// the grabber: a tap opens the full height, another returns; Esc closes
await tap('.ph-sheet .ph-grab', 600);
// (review design-1: at full height the chain bar rides on the sheet's top edge, under the header, and covers no control)
const full = await ev(`(() => { const s = document.querySelector('.ph-sheet').getBoundingClientRect(), p = document.querySelector('.pipe-wrap').getBoundingClientRect(); const cov = []; for (const el of document.querySelectorAll('.ph-sheet input, .ph-sheet button')) { if (!el.getClientRects().length) continue; const b = el.getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2; if (y < 0 || y > innerHeight) continue; const t = document.elementFromPoint(x, y); if (t && !el.contains(t) && !t.contains(el) && !t.closest('.ph-sh')) cov.push(el.id || el.className); } return { top: Math.round(s.top), bar: [Math.round(p.top), Math.round(p.bottom)], cov, focus: document.activeElement && (document.activeElement.className || document.activeElement.tagName) }; })()`);
await tap('.ph-sheet .ph-grab', 600);
ok('sheet: the grabber opens the full height, the chain bar on its top edge, nothing covered, focus kept on the grabber', full.top <= 124 && full.bar[0] <= 60 && Math.abs(full.bar[1] - full.top) <= 1 && full.cov.length === 0 && /ph-grab/.test(String(full.focus)), full);
await key('Escape'); await settle(400);
const p2 = await panes();
ok('sheet: Esc closes it and the inset comes back', p2.sheetTop === null && (await ev(`!!document.querySelector('#paneR.ph-inset')`)), p2);
await grab();

// ---------- 4. landscape phone and a touch tablet ----------
await view(844, 390, false, true);
await loadChain('v15phL');
const sL = await screen(), pL = await panes(), aL = await audit('body');
ok('landscape phone: no page scroll', sL.sh <= sL.ih + 1 && sL.sw <= sL.iw + 1, sL);
ok('landscape phone: X | Y side by side', pL.L && pL.R && pL.L.w > 300 && pL.R.w > 300 && pL.L.t === pL.R.t, pL);
ok('landscape phone: every control 44 × 44', aL.n === 0, aL);
await shot('v15ph-land-844');
await tap('#pipeline .card[data-k="2"]', 600);
const pL2 = await panes();
ok('landscape phone: the editor is a side sheet; both planes stay in sight', pL2.L && pL2.R && pL2.L.w > 150 && pL2.R.l + pL2.R.w <= 844 - 359, pL2);
await shot('v15ph-land-844-edit');
await closeSheet();
await view(820, 1180, false, true);
await loadChain('v15phTab');
const tab = await ev(`({ ph: document.documentElement.classList.contains('ph'), sh: document.documentElement.scrollHeight, ih: innerHeight, insp: !!document.querySelector('#rightPanel #propsPanel') })`);
ok('touch tablet: the desktop tablet layout (no phone classes, the Inspector in its panel)', !tab.ph && tab.insp, tab);
await shot('v15ph-tablet-820');
// back to desktop: nothing of the phone left
await view(1440, 900, false, false);
await loadChain('v15phD');
const dk = await ev(`({ ph: document.documentElement.classList.contains('ph'), only: [...document.querySelectorAll('.ph-only')].filter((e) => e.getClientRects().length).length, insp: !!document.querySelector('#rightPanel #propsPanel'), morph: !!document.querySelector('.top > #morphBtn') })`);
ok('desktop: no phone classes or controls; the Inspector and the Deformation toggle at home', !dk.ph && dk.only === 0 && dk.insp && dk.morph, dk);
await grab();
ok('no console errors', errs.length === 0, errs.slice(0, 6));
return { pass: fails.length === 0, fails, info };
