// The phone's parts of the classic view, checked on a phone (412 × 860, 360 × 780 and 915 × 412, Android emulation, real touch events through
// Input.dispatchTouchEvent) and on a laptop (1366 × 768, the mouse): Undo in every sheet head and in the Deformation bar, tips that never stick,
// Back closing the top layer, the function list, a rotation keeping the open sheet and field, the on-screen keyboard, the fixed key column,
// the speed key, the Shapes list and the ⋯ sheet, the Deformation bar in two rows, the Both key, the context bar, the cards' pictures, the
// last pick of a construction on touch, and a pinch on the app's own controls. They test the chain bar and its sheet, the Deformation bar and its
// dock, the Both key, the cards, and the Editor, keyboard and construction touches as the classic view reaches them. The Tools sheet's tabs,
// the tips in the Display and Editor sheets, a slow tap and the touch wording, which the steps view has, are test/ux165_phone_cmd.js.
// A command file for a CDP daemon (test/cdp_kit README):
//   python3 build.py && test/<you>_cdp/q.sh test/ux165_phone_classic_cmd.js
// Prints {pass, fails, info}. Run it on a fresh daemon: the pinch checks come last, because after a synthetic two-finger pinch headless Chrome's
// emulated touches stop producing pointer events until Chrome restarts.
// (the sleeps left in this file are the gestures' own timing: a finger held down, a finger moved at a pace)
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = () => settled({});
const errs = [];
const grab = async () => { errs.push(...(await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource|favicon/.test(x.m || ''))); };
const fresh = async (ns, w, h, dark, mobile, extra = '') => {
  await view(w, h, !!dark, !!mobile);
  await send('Page.navigate', { url: 'about:blank' }); await settled({ panes: false });
  await nav(`${U}?ns=ux165p-${ns}-${Date.now()}${extra}`); await settle();
};
const withState = async (ns, w, h, mobile, st) => { await view(w, h, false, !!mobile); await load(`ux165p-${ns}-${Date.now()}`, st); await settle(); };
const box = (sel) => ev(`(() => { const e = typeof ${JSON.stringify(sel)} === 'string' ? document.querySelector(${JSON.stringify(sel)}) : null; if (!e || !e.getClientRects().length) return null; const b = e.getBoundingClientRect(); const t = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return { l: Math.round(b.left), t: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height), r: Math.round(b.right), b: Math.round(b.bottom), top: !!t && (t === e || e.contains(t)) }; })()`);
const center = async (sel) => { const b = await box(sel); return b ? [b.l + b.w / 2, b.t + b.h / 2] : null; };
const touch = async (x, y, ms = 60) => { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }); await sleep(ms); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
// (on a phone the chain's cards, F, Add function and Numbers are rows of the chain sheet; while it is closed, a
// tap on one of them is first the tap on "N steps ▾" that opens it, as a user's)
const CHAIN = /#pipeline|#addStepBtn|\.ph-nums/;
const tap = async (sel) => {
  const into = () => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (e) e.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' }); })()`);
  await into(); await settled({ panes: false });
  let c = await center(sel);
  if (!c && CHAIN.test(sel)) { const o = await center('.ph-csteps'); if (o) { await touch(o[0], o[1]); await settle(); await into(); await settled({ panes: false }); c = await center(sel); } }
  if (!c) { fails.push({ name: 'tap target missing', got: sel }); return false; }
  await touch(c[0], c[1]); await settle(); return true;
};
const pinch = async (cx, cy, d0, d1) => {
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx - d0 / 2, y: cy, id: 1 }, { x: cx + d0 / 2, y: cy, id: 2 }] });
  for (let i = 1; i <= 10; i++) { const d = d0 + (d1 - d0) * i / 10; await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx - d / 2, y: cy, id: 1 }, { x: cx + d / 2, y: cy, id: 2 }] }); await sleep(16); }
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await settle();
};
const hold = async (x, y, ms) => { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }); await sleep(ms); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await settle(); };
const goBack = async () => { const h = await send('Page.getNavigationHistory'); if (h.currentIndex < 1) return false; await send('Page.navigateToHistoryEntry', { entryId: h.entries[h.currentIndex - 1].id }); await settle(); return true; };
const tipText = () => ev(`(() => { const t = document.getElementById('tip'); return t && !t.hidden ? t.textContent : null; })()`);
const phSt = () => ev('Phone._state()');
const STEPS2 = [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' }, on: true }];

// ---------------- Undo in every sheet head and in the deformation bar ----------------
await fresh('undo', 412, 860, false, true);
for (const k of ['edit', 'tools', 'display', 'more']) {
  await ev(`Phone.open('${k}')`); await settle();
  const u = await box('.ph-sheet .ph-hundo');
  ok(`UX24 the ${k} sheet's head has Undo, 44 px, uncovered`, u && u.w >= 44 && u.h >= 44 && u.top, u);
  await ev(`Phone.close(true)`); await settle();
}
// Undo in a head undoes: add a disc, open More tools, tap Undo there
const shapes0 = await ev(`__tourApi.snapshot().state.shapes.length`);
await tap('#secDraw .tool[data-tool="disc"]');
await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 150, y: 200, id: 1 }] });
for (let i = 1; i <= 10; i++) { await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 150 + i * 8, y: 200 + i * 3, id: 1 }] }); await sleep(30); }
await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await settle();
const shapes1 = await ev(`__tourApi.snapshot().state.shapes.length`);
await ev(`Phone.open('tools')`); await settle();
await tap('.ph-sheet .ph-hundo');
ok('UX24 Undo in the sheet head undoes', shapes1 === shapes0 + 1 && (await ev(`__tourApi.snapshot().state.shapes.length`)) === shapes0, [shapes0, shapes1]);
await ev(`Phone.close(true)`); await settle();
for (const [w, h] of [[412, 860], [360, 780]]) {
  await view(w, h, false, true); await settle();
  if (!(await ev(`!!document.querySelector('.tdock:not([hidden])')`))) { await ev(`document.getElementById('morphBtn').click()`); await settle(); }
  const u = await box('#secDraw > .ph-undo'), x = await box('.tdock:not([hidden]) .tclose'), sp = await box('.tdock:not([hidden]) .tscrub');
  ok(`UX24 ${w}: Undo stays at the left end of the deformation bar`, u && u.top && u.w >= 44 && u.l < 10, u);
  ok(`UX24 ${w}: the bar's × is whole on the screen`, x && x.top && x.r <= w, x);
  ok(`UX24 ${w}: the scrubber keeps at least 72 px`, sp && sp.w >= 72, sp);
}
await ev(`document.getElementById('morphBtn').click()`); await settle();
await grab();

// ---------------- tooltips never stick ----------------
// phone: the + card's tip after an add through the palette (the focus comes back to +)
await fresh('tip', 412, 860, false, true);
await tap('#pipeline .add-card');
for (const c of 'sin') await key(c);
await settle(); await key('Enter'); await settled({ floor: 1300 });   // (the window the tip's absence is read after)
ok('UX34 phone: no tip after an add (the focus came back to +)', !(await tipText()), await tipText());
// phone: a long-press on a tool shows its tip, and it goes when the finger lifts (the add was made from the chain
// sheet, a modal layer over the tool row: it is closed first)
await ev('Phone.close(true); 1');
await settled({ until: `!document.querySelector('.ph-sheet.open')` });
let tc = await center('#secDraw .tool[data-tool="point"]');
for (let i = 0; i < 10; i++) {   // (the planes and the tool row move while the sheet goes: the press lands where the tool rests)
  await settle();
  const again = await center('#secDraw .tool[data-tool="point"]');
  const rest = !!again && !!tc && again[0] === tc[0] && again[1] === tc[1];
  tc = again;
  if (rest) break;
}
await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: tc[0], y: tc[1], id: 1 }] }); await sleep(700);
const lpTip = await tipText();
const lpKey = await ev(`!!document.querySelector('#tip .tip-key')`);
await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await settle();
ok('UX34 phone: a long-press shows the tip', !!lpTip, lpTip);
ok('UX17 phone: the long-press tip says tap and names no key', /Tap to place a point/.test(lpTip || '') && !/Click/.test(lpTip || '') && !lpKey, [lpTip, lpKey]);
ok('UX34 phone: the tip goes when the finger lifts', !(await tipText()), await tipText());
// laptop: hover only; no tip after an add (focus back on the + card), none after a programmatic focus
await fresh('tipL', 1366, 768, false, false);
const ac = await center('#pipeline .add-card');
await click(ac[0], ac[1]); await settle();
await type('sin z'); await settle(); await key('Enter'); await move(700, 400); await settled({ floor: 1200 });   // (the window the tip's absence is read after)
ok('UX34 laptop: no tip after an add', !(await tipText()), await tipText());
await ev(`document.getElementById('undoBtn').focus()`); await settled({ floor: 700 });   // (the window the tip's absence is read after)
ok('UX34 laptop: no tip after a programmatic focus', !(await tipText()), await tipText());
const dc = await center('#tools .tool[data-tool="disc"]');
await move(dc[0], dc[1]); await settled({ until: `(() => { const t = document.getElementById('tip'); return !!t && !t.hidden; })()` });
const hv = await tipText();
ok('UX34 laptop: hover shows the tip', !!hv && /Disc/.test(hv), hv);
ok('UX17 laptop: the hover tip keeps its key', await ev(`(document.querySelector('#tip .tip-key') || {}).textContent === 'D'`), hv);
await move(700, 400); await settled({ until: `(() => { const t = document.getElementById('tip'); return !t || t.hidden; })()` });
ok('UX34 laptop: the tip goes when the mouse leaves', !(await tipText()), await tipText());
info.backDesk = await ev('history.length');
await key('k', 4); await settle();
ok('UX12 laptop: the palette pushes no history entry', (await ev('history.length')) === info.backDesk, await ev('history.length'));
await key('Escape'); await settle();
await grab();

// ---------------- Back closes the top layer; Back from the bare app leaves ----------------
await view(412, 860, false, true);
await send('Page.navigate', { url: 'about:blank' }); await settled({ panes: false });
await nav(`${U}?ns=ux165p-back-${Date.now()}`); await settle();
const st = () => ev(`({ url: location.href, sheet: Phone.sheet(), pop: !!document.querySelector('#popHost > *'), modal: !!document.querySelector('.modal-bg') })`);
const layers = [
  ['the ⋯ sheet', async () => { await tap('#hdrMoreBtn'); }, (s) => s.sheet === 'more'],
  ['More tools', async () => { await tap('#toolMore > summary'); }, (s) => s.sheet === 'tools'],
  // (the function list opens from the chain sheet: the first Back closes the list, the second the sheet)
  ['the function list', async () => { await tap('#pipeline .add-card'); }, (s) => s.pop, 'chain'],
  ['the Export dialog', async () => { await ev(`Phone.open('more')`); await settle(); await ev(`[...document.querySelectorAll('.ph-row')].find((b) => /Export figure/.test(b.textContent)).click()`); await settle(); }, (s) => s.modal],
  ['the guide', async () => { await ev(`Phone.open('more')`); await settle(); await ev(`[...document.querySelectorAll('.ph-row')].find((b) => /^\s*Guide\s*$/.test(b.textContent)).click()`); await settle(); }, (s) => s.modal],
  ['the tour\'s chapter menu', async () => { await ev(`Phone.open('more')`); await settle(); await ev(`[...document.querySelectorAll('.ph-row')].find((b) => /Guided tour/.test(b.textContent)).click()`); await settle(); }, (s) => s.pop],
  // (a plane's menu is an object's, here the line Im z = 0.8 of the first scene; held empty plane opens nothing)
  ['a plane\'s menu', async () => { const p = await ev(`__cmwPlaneMenu().w2s('L', 1.5, 0.8)`); await hold(p[0], p[1], 700); }, (s) => s.pop],
];
for (const [name, openIt, isOpen, under] of layers) {
  await openIt();
  const a = await st();
  ok(`UX12 ${name} opens`, isOpen(a), a);
  await goBack();
  if (under) {
    const u = await st();
    ok(`UX12 Back closes ${name} and leaves the ${under} sheet under it`, /test\.html/.test(u.url) && u.sheet === under && !u.pop && !u.modal, u);
    await goBack();
  }
  const b = await st();
  ok(`UX12 Back closes ${name} and stays in the app`, /test\.html/.test(b.url) && !b.sheet && !b.pop && !b.modal, b);
}
// a sheet closed in the app leaves no entry behind: the next Back leaves
await tap('#hdrMoreBtn'); await tap('.ph-sheet .ph-x');
await goBack();
ok('UX12 Back from the bare app leaves it', (await ev('location.href')) === 'about:blank', await ev('location.href'));
await grab();

// ---------------- the phone function list ----------------
await withState('pal', 412, 860, true, { shapes: [], steps: STEPS2 });
await tap('#pipeline .add-card');
const cb = await box('.pal-cancel'), chip = await box('.pal-at'), row = await box('.pal-item');
ok('UX29 Cancel in the search row, at least 44 px', cb && cb.w >= 44 && cb.h >= 44 && cb.top, cb);
ok('UX29 rows at least 48 px', row && row.h >= 48, row);
ok('UX29 the insert position is a chip of at least 44 px', chip && chip.h >= 44 && chip.top, chip);
const places = [];
for (let i = 0; i < 3; i++) { places.push(await ev(`document.querySelector('.pal-at').textContent`)); await tap('.pal-at'); }
ok('UX29 a tap moves the insert position along the chain', new Set(places).size === 3, places);
ok('UX29 the search field keeps the focus after a chip tap', (await ev('document.activeElement && document.activeElement.id')) === 'palInput', await ev('document.activeElement && document.activeElement.id'));
await tap('.pal-cancel');
ok('UX29 Cancel closes the list', !(await ev(`!!document.querySelector('#popHost .palette')`)));
await grab();

// ---------------- a rotation keeps the open sheet and the field ----------------
await withState('rot', 412, 915, true, { shapes: [], steps: STEPS2 });
await tap('.ph-csteps');   // (the cards are the chain sheet's rows)
const mob = await ev(`(() => { const c = [...document.querySelectorAll('#pipeline .card')].find((c) => /Möbius/.test(c.textContent)); c.scrollIntoView({ inline: 'nearest' }); const b = c.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
await touch(mob[0], mob[1]); await settle();
await ev(`(() => { const i = [...document.querySelectorAll('.ph-sheet input.inp')].filter((e) => e.getClientRects().length)[1]; i.focus(); i.setSelectionRange(1, 1); })()`); await settle();
const f0 = await ev(`[...document.querySelectorAll('.ph-sheet input')].indexOf(document.activeElement)`);
await view(915, 412, false, true); await settle();
const s1 = await phSt(), f1 = await ev(`[...document.querySelectorAll('.ph-sheet input')].indexOf(document.activeElement)`);
ok('UX68 to landscape: the Editor stays open', s1.land && s1.kind === 'edit', s1);
ok('UX68 to landscape: the same field has the focus', f1 === f0 && f0 >= 0, [f0, f1]);
await view(412, 915, false, true); await settle();
const s2 = await phSt(), f2 = await ev(`[...document.querySelectorAll('.ph-sheet input')].indexOf(document.activeElement)`);
ok('UX68 back to portrait: the Editor and the field again', !s2.land && s2.kind === 'edit' && f2 === f0, [s2, f2]);
await grab();

// ---------------- the on-screen keyboard ----------------
// (headless Chrome has no keyboard: Phone._kb(h) stands for a keyboard h px tall, as the visual viewport would report it)
await fresh('kb', 360, 780, false, true);
await tap('.ph-nums');
await ev(`[...document.querySelectorAll('.ph-sheet button')].find((b) => /Number/.test(b.textContent) && b.getClientRects().length).click()`); await settle();
const fk0 = await ev(`(() => { const a = document.activeElement; const b = a.getBoundingClientRect(); return { tag: a.tagName, top: Math.round(b.top), bottom: Math.round(b.bottom), ih: innerHeight }; })()`);
ok('UX69 a field takes the focus with no keyboard: the sheet keeps its height (the planes stay in view)', fk0.tag === 'INPUT' && !(await phSt()).full, [fk0, await phSt()]);
await ev('Phone._kb(330)'); await settle();
const fk = await ev(`(() => { const a = document.activeElement; const b = a.getBoundingClientRect(); return { tag: a.tagName, top: Math.round(b.top), bottom: Math.round(b.bottom), ih: innerHeight }; })()`);
ok('UX69 a 330 px keyboard: the field is lifted above it (the sheet grows when scrolling cannot do it)', fk.tag === 'INPUT' && fk.bottom <= fk.ih - 330 && fk.top > 56 && (await phSt()).full, [fk, await phSt()]);
ok('UX69 with the keyboard up the sheet body gets room at its end', (await ev(`parseFloat(getComputedStyle(document.querySelector('.ph-sb:not([hidden])')).paddingBottom)`)) >= 330);
await ev('Phone._kb(0)'); await settle();
ok('UX69 the sheet goes back to its height when the keyboard goes', !(await phSt()).full);
await ev('Phone._kb(330)'); await settle(); await ev('document.activeElement.blur()'); await settled({ until: `!Phone._state().full` });
ok('UX69 … or when the field is left', !(await phSt()).full);
await ev('Phone._kb(0)');
// a formula field with the keyboard up has a strip of symbols above the keyboard; a press types at the caret and the field keeps the focus
await ev(`Phone.open('tools')`); await settle();
await ev(`document.querySelector('.ph-tile[data-tool="formula"]').click()`); await settle();
await ev(`(() => { const f = document.getElementById('formulaInput'); f.focus(); f.value = '|z'; f.setSelectionRange(2, 2); })()`); await settle();
const noKb = await ev(`!!document.querySelector('.ph-keys:not([hidden])')`);
await ev('Phone._kb(330)'); await settle();
const ks = await ev(`(() => { const e = document.querySelector('.ph-keys'); const r = e.getBoundingClientRect(); return { shown: !e.hidden, bottom: Math.round(innerHeight - r.bottom), h: Math.round(r.height), labels: [...e.children].map((b) => b.textContent), small: [...e.children].filter((b) => { const q = b.getBoundingClientRect(); return q.width < 44 || q.height < 44; }).length, focus: document.activeElement.id }; })()`);
ok('UX46 a formula field: no strip without the keyboard; with it, a 44 px row on the keyboard\'s edge', !noKb && ks.shown && ks.bottom === 330 && ks.h === 44 && ks.small === 0 && ks.focus === 'formulaInput', [noKb, ks]);
ok('UX46 the strip is symbols only', ks.labels.join(' ') === 'z | < > ≤ π i Re Im arg ( )', ks.labels);
await ev(`[...document.querySelectorAll('.ph-keys button')].find((b) => b.textContent === '<').click()`); await settle();
const ty = await ev(`(() => { const f = document.getElementById('formulaInput'); return { v: f.value, c: f.selectionStart, focus: document.activeElement === f }; })()`);
ok('UX46 a press types the symbol at the caret and the field keeps the focus', ty.v === '|z<' && ty.c === 3 && ty.focus, ty);
await ev('Phone._kb(0)'); await settle();
ok('UX46 the strip goes with the keyboard', await ev(`document.querySelector('.ph-keys').hidden`));
await ev('document.activeElement.blur()');
// the Editor (split: X and Y above it): a coefficient with a short keyboard is lifted by a scroll, the planes stay
await withState('kbEd', 412, 915, true, { shapes: [], steps: STEPS2 });
await tap('.ph-csteps');   // (the cards are the chain sheet's rows)
const mobK = await ev(`(() => { const c = [...document.querySelectorAll('#pipeline .card')].find((c) => /Möbius/.test(c.textContent)); c.scrollIntoView({ inline: 'nearest' }); const b = c.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
await touch(mobK[0], mobK[1]); await settle();
await ev(`(() => { const i = [...document.querySelectorAll('.ph-sheet input.inp')].filter((e) => e.getClientRects().length)[3]; i.focus(); })()`); await settle();
await ev('Phone._kb(260)'); await settle();
const fe = await ev(`(() => { const a = document.activeElement; const b = a.getBoundingClientRect(); return { bottom: Math.round(b.bottom), ih: innerHeight }; })()`);
info.kbEditor = [fe, await phSt()];
ok('UX69 the Editor: the coefficient is above a 260 px keyboard', fe.bottom <= fe.ih - 260, info.kbEditor);
ok('UX69 the Editor: lifted by a scroll, the sheet keeps its height (X and Y stay in view)', !info.kbEditor[1].full, info.kbEditor);
await ev('Phone._kb(0)'); await ev('document.activeElement.blur()'); await settle();
await grab();

// ---------------- one fixed column of keys at the bottom right ----------------
await fresh('keys', 412, 860, false, true);
const keys = () => ev(`(() => { const o = {}; for (const e of document.querySelectorAll('.ph-col .ph-key, .viewstack .vbtn')) { if (!e.getClientRects().length || getComputedStyle(e).display === 'none' || e.closest('.ph-inset')) continue; const b = e.getBoundingClientRect(); o[e.classList.contains('ph-both-key') ? 'both' : e.classList.contains('ph-sph') ? 'sphere' : e.classList.contains('ph-dsp') ? 'display' : 'fit'] = [Math.round(b.left), Math.round(b.top)]; } return o; })()`);
const kv = {};
kv.xy = await keys();
await ev('Phone.swap()'); await settle(); kv.swap = await keys(); await ev('Phone.swap()'); await settle();
await ev(`document.querySelector('#viewSwitch [data-mode="phase"]').click()`); await settle(); kv.phase = await keys();
await ev(`document.querySelector('#viewSwitch [data-mode="land"]').click()`); await settle(); kv.land = await keys();
info.keys = kv;
for (const v of ['swap', 'phase', 'land']) for (const k of ['display', 'fit']) ok(`UX38 ${k} keeps its place in ${v}`, JSON.stringify(kv[v][k]) === JSON.stringify(kv.xy[k]), [kv.xy[k], kv[v][k]]);
for (const v of ['swap', 'phase']) ok(`UX38 sphere keeps its place in ${v}`, JSON.stringify(kv[v].sphere) === JSON.stringify(kv.xy.sphere), [kv.xy.sphere, kv[v].sphere]);
ok('D8 Both is the column\'s top key', kv.xy.both && kv.xy.both[1] < kv.xy.sphere[1] && kv.xy.both[0] === kv.xy.sphere[0], kv.xy);
ok('UX38 the column is at the bottom right, Sphere over Display over Fit', kv.xy.sphere[1] < kv.xy.display[1] && kv.xy.display[1] < kv.xy.fit[1] && kv.xy.fit[1] > 600 && kv.xy.fit[0] > 340, kv.xy);
// Landscape on a portrait phone: the surface uses more of the plane than the bounding sphere's fit
const lb = await ev(`(() => { const c = document.getElementById('canvasL').getBoundingClientRect(); return [c.left, c.top, c.width, c.height]; })()`);
const im = await img({ x: lb[0], y: lb[1], width: lb[2], height: lb[3] });
let x0 = 1e9, x1 = -1;
im.width = im.w; im.height = im.h;
const bg = [im.data[0], im.data[1], im.data[2]];
for (let y = Math.round(im.height * 0.2); y < im.height * 0.8; y += 2) for (let x = 0; x < im.width; x++) { const i = im.ch * (y * im.width + x); if (Math.abs(im.data[i] - bg[0]) + Math.abs(im.data[i + 1] - bg[1]) + Math.abs(im.data[i + 2] - bg[2]) > 60) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); } }
info.landWidth = [(x1 - x0) / im.width];
ok('UX106 the Landscape surface spans most of a portrait phone plane', (x1 - x0) / im.width > 0.8 && x0 > 0 && x1 < im.width - 1, [x0, x1, im.width]);
await ev(`document.querySelector('#viewSwitch [data-mode="xy"]').click()`); await settle();
await view(915, 412, false, true); await settle();
const k915 = await ev(`[...document.querySelectorAll('.ph-col')].filter((e) => e.getClientRects().length).map((e) => { const b = e.getBoundingClientRect(), p = e.closest('.plot').getBoundingClientRect(); return Math.round(p.bottom - b.bottom); })`);
ok('UX38 915 × 412: each plane\'s column sits at the same height above the bottom', k915.length === 2 && k915[0] === k915[1] && k915[0] <= 64, k915);
await grab();

// ---------------- the speed key cycles ----------------
await fresh('speed', 412, 860, false, true);
await ev(`document.getElementById('morphBtn').click()`); await settle();
const speeds = [];
for (let i = 0; i < 4; i++) { speeds.push(await ev(`document.querySelector('.tdock:not([hidden]) #speedSeg > button.on').textContent`)); await tap('.tdock:not([hidden]) #speedSeg > button.on'); }
ok('UX62 a tap on the speed moves on: 1×, 2×, 0.5×, 1×', speeds.join(' ') === '1× 2× 0.5× 1×', speeds);
await grab();

// ---------------- the Shapes list, the ⋯ sheet, the long-press tips ----------------
await withState('rows', 360, 780, true, { shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 1 }, { id: 's2', kind: 'rect', a: [-2, -1], b: [1, 0.5] }], steps: [{ type: 'zp', params: { a: '1', zeros: '0.5', poles: '-0.5' }, on: true }] });
await ev(`Phone.open('tools')`); await settle();
await ev(`Phone.tab('shapes')`); await settle();
const rows = await ev(`[...document.querySelectorAll('.ph-sheet .shape-row')].map((r) => { const b = r.getBoundingClientRect(), e = r.querySelector('.eye').getBoundingClientRect(), m = r.querySelector('.more').getBoundingClientRect(); return { h: Math.round(b.height), eyeR: Math.round(e.right), moreL: Math.round(m.left), moreR: Math.round(m.right), eh: Math.round(e.height), mh: Math.round(m.height) }; })`);
ok('UX45 rows at least 48 px', rows.length >= 2 && rows.every((r) => r.h >= 48), rows);
ok('UX45 the eye and ⋯ side by side, 44 px each, apart', rows.every((r) => r.eyeR <= r.moreL && r.eh >= 44 && r.mh >= 44), rows);
ok('UX45 ⋯ keeps a 16 px gutter at the edge', rows.every((r) => r.moreR <= 360 - 16), rows);
const tip = await ev(`(document.querySelector('.ph-sb[data-k="tools"] .ph-tip') || {}).textContent || ''`);
ok('UX40 More tools teaches the long press', /hold a finger/i.test(tip), tip);
await ev(`Phone.close(true)`); await settle();
await tap('#pipeline .card:not(.region-card)');
const zh = await ev(`(document.querySelector('.ph-sheet .zp-hint') || {}).textContent || ''`);
// (the long press is a mark's, "Drag a mark to move it; hold it for more.")
ok('UX40 the zeros-and-poles editor teaches the long press', /hold it for more/i.test(zh), zh);
await ev(`Phone.close(true)`); await settle();
await ev(`Phone.open('more')`); await settle();
const more = await ev(`({ text: document.querySelector('.ph-sheet[data-k="more"]').innerText, rows: [...document.querySelectorAll('.ph-sheet[data-k="more"] .ph-row')].map((r) => r.textContent.trim()) })`);
ok('V02 the links and scene files are rows of the ⋯ sheet', ['Copy link to this figure', 'Save scene', 'Open scene'].every((w) => more.rows.some((r) => r.includes(w))), more.rows);
ok('V02 no key shortcuts and no "again" rows before a first export', !/⌘|Ctrl E|again/.test(more.text), more.text);
await grab();

// ---------------- the deformation bar in two rows, a full-width scrubber, the Steps picker ----------------
await withState('d11', 412, 860, true, { shapes: [], steps: STEPS2 });
await ev(`document.getElementById('morphBtn').click()`); await settle();
const dk = await ev(`(() => { const d = document.querySelector('.tdock:not([hidden])'); if (!d) return null; const r = (e) => { const b = e && e.getBoundingClientRect(); return b && { l: Math.round(b.left), t: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) }; }; return { dock: r(d), scrub: r(d.querySelector('.tscrub')), range: r(d.querySelector('#morphRange')), play: r(d.querySelector('#morphPlay')), steps: r(d.querySelector('#stepsBtn')), close: r(d.querySelector('.tclose')), undo: r(document.querySelector('#secDraw > .ph-undo')), read: r(d.querySelector('.tscrub > .tread')), label: (d.querySelector('#stepsBtn') || {}).textContent, picked: d.querySelector('#stepsPick') && !d.querySelector('#stepsPick').hidden }; })()`);
ok('D11 two rows: the scrubber the full width, play, Steps and × below it, 44 px tall', dk && dk.range.w >= 412 - 24 && dk.play.t >= dk.scrub.t + dk.scrub.h - 2 && dk.steps.t === dk.play.t && dk.close.t === dk.play.t && dk.play.h >= 44 && dk.steps.h >= 44 && dk.close.h >= 44 && dk.range.h >= 44, dk);
ok('D11 the tool row\'s Undo stays at the left end of the second row', dk && dk.undo && dk.undo.l < dk.play.l && Math.abs(dk.undo.t + dk.undo.h / 2 - (dk.play.t + dk.play.h / 2)) < 12, dk);
ok('D11 the readout rides the scrubber, the Steps button names the range', dk && dk.read && dk.read.t < dk.range.t + 10 && /Every step|Steps/.test(dk.label), dk);
await ev(`document.getElementById('stepsBtn').click()`); await settle();
const pk = await ev(`(() => { const p = document.getElementById('stepsPick'); const b = p.getBoundingClientRect(); const c = [...p.querySelectorAll('select, input[type=checkbox]')].map((e) => ({ id: e.id || e.getAttribute('aria-label'), vis: e.getClientRects().length > 0 })); return { open: !p.hidden, bottom: Math.round(b.bottom), top: Math.round(document.querySelector('.tdock:not([hidden])').getBoundingClientRect().top), c, loop: !!p.querySelector('#loopChk'), order: !!p.querySelector('#homOrderSel') }; })()`);
ok('D11 the Steps picker holds the range, the order and Loop, above the bar', pk.open && pk.bottom <= pk.top && pk.loop && pk.order && pk.c.length >= 4 && pk.c.every((x) => x.vis), pk);
await ev(`document.getElementById('stepsBtn').click()`); await settle();
ok('D11 the picker closes', await ev(`document.getElementById('stepsPick').hidden`));
await ev(`document.getElementById('morphBtn').click()`); await settle();
await withState('d11l', 915, 412, true, { shapes: [], steps: STEPS2 });
await ev(`document.getElementById('morphBtn').click()`); await settle();
await settled({ max: 4000, until: `!!document.querySelector('.tdock:not([hidden])')` });   // (the dock is built after the click's frames)
const dlState = await ev(`({ cls: document.documentElement.className, btn: !!document.getElementById('morphBtn'), docks: [...document.querySelectorAll('.tdock')].map((d) => [d.id, d.hidden, d.children.length]) })`);
const dl = await ev(`(() => { const d = document.querySelector('.tdock:not([hidden])'); if (!d) return null; const r = (e) => { const b = e && e.getBoundingClientRect(); return b && { l: Math.round(b.left), t: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) }; }; return { dock: r(d), range: r(d.querySelector('#morphRange')), col: r(document.getElementById('secDraw')), undo: r(document.querySelector('#secDraw > .ph-undo')), ih: innerHeight }; })()`);
ok('D11 landscape: one row left of the tool column with a wide scrubber, Undo kept in the column', dl && dl.dock && dl.dock.t + dl.dock.h <= dl.ih + 1 && dl.dock.l + dl.dock.w <= dl.col.l + 1 && dl.range.w >= 300 && dl.undo.l >= dl.col.l - 1, { dl, dlState });
await ev(`document.getElementById('morphBtn').click()`); await settle();

// ---------------- the Both key shows X above Y; remembered ----------------
await withState('both', 412, 860, true, { shapes: [], steps: STEPS2 });
const bx = () => ev(`(() => { const r = (id) => { const b = document.getElementById(id).getBoundingClientRect(); return { l: Math.round(b.left), t: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height), inset: document.getElementById(id).classList.contains('ph-inset') }; }; const k = document.querySelector('#paneL .ph-both-key'); const kb = k && k.getBoundingClientRect(); return { L: r('paneL'), R: r('paneR'), key: k && { w: Math.round(kb.width), h: Math.round(kb.height), vis: k.getClientRects().length > 0, pressed: k.getAttribute('aria-pressed') }, saved: (() => { try { return Object.keys(localStorage).filter((x) => /^cmw-ph-both/.test(x)).map((x) => localStorage.getItem(x)); } catch (e) { return null; } })() }; })()`);
const b0 = await bx();
ok('D8 the Both key: 44 px, off by default, the inset is the default', b0.key && b0.key.vis && b0.key.w >= 44 && b0.key.h >= 44 && b0.key.pressed === 'false' && b0.R.inset && b0.L.h > 500, b0);
await tap('#paneL .ph-both-key');
const b1 = await bx();
ok('D8 Both: X above Y, each about half the stage, no inset', b1.key.pressed === 'true' && !b1.L.inset && !b1.R.inset && b1.L.w >= 400 && b1.R.w >= 400 && b1.R.t >= b1.L.t + b1.L.h - 2 && Math.abs(b1.L.h - b1.R.h) <= 4 && b1.L.h >= 300, b1);
ok('D8 the choice is remembered', b1.saved && b1.saved.includes('1'), b1.saved);
await ev(`Phone.open('display')`); await settle();
const b2 = await ev(`(() => { const a = document.getElementById('paneL').getBoundingClientRect(), b = document.getElementById('paneR').getBoundingClientRect(); return { sideBySide: Math.abs(a.top - b.top) < 4 && b.left > a.left }; })()`);
ok('D8 an open sheet takes over with X | Y side by side', b2.sideBySide, b2);
await ev(`Phone.close(true)`); await settle();
const b3 = await bx();
ok('D8 … and Both is back when the sheet closes', !b3.L.inset && !b3.R.inset && b3.R.t >= b3.L.t + b3.L.h - 2, b3);
await tap('#paneR .ph-both-key');
const b4 = await bx();
ok('D8 Both off: the large plane and the inset again', b4.key.pressed === 'false' && (b4.L.inset !== b4.R.inset) && b4.saved.includes('0'), b4);
// probing X draws on the inset's overlay (the image point's dot and the gauge; the dot itself is judged on a screenshot)
await withState('probe', 412, 860, true, { shapes: [], steps: STEPS2 });
const ovPx = () => ev(`(() => { let n = 0; for (const c of document.querySelectorAll('#paneR canvas')) { let g = null; try { g = c.getContext('2d'); } catch (e) { /* */ } if (!g || !c.width) continue; const d = g.getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; } return n; })()`);
const px0 = await ovPx();
await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 230, y: 300, id: 1 }] }); await sleep(750);
for (let i = 1; i <= 4; i++) { await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 230 + i * 6, y: 300 - i * 5, id: 1 }] }); await sleep(80); }
await settle();
const px1 = await ovPx();
await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await settle();
ok('D8 probing X draws on the phone\'s Y inset overlay', px1 > px0 + 20, [px0, px1]);
await withState('bothl', 915, 412, true, { shapes: [], steps: STEPS2 });
ok('D8 landscape has both planes already: no Both key', await ev(`[...document.querySelectorAll('.ph-both-key')].every((k) => !k.getClientRects().length)`));

// ---------------- the context bar for what is selected or under way ----------------
await withState('d3', 360, 780, true, { shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 1 }, { id: 's2', kind: 'rect', a: [-2, -1], b: [1, 0.5] }], steps: STEPS2 });
const ctxInfo = () => ev(`(() => { const b = document.querySelector('.ph-ctx'); if (!b || b.hidden || b.classList.contains('under')) return null; const r = b.getBoundingClientRect(), row = document.querySelector('.pipe-wrap').getBoundingClientRect(); const bt = [...b.querySelectorAll('button')].map((x) => { const q = x.getBoundingClientRect(); return { t: x.textContent.trim(), w: Math.round(q.width), h: Math.round(q.height), dis: x.disabled }; }); const pr = document.getElementById('paneL').getBoundingClientRect(); return { k: b.dataset.k, text: b.querySelector('.ph-ct') && b.querySelector('.ph-ct').innerText.replace(/\\n/g, ' | '), h: Math.round(r.height), above: Math.round(row.top - r.bottom), btn: bt, paneBottom: Math.round(pr.bottom), barTop: Math.round(r.top) }; })()`);
const d0 = await ev(`(() => { const p = document.getElementById('paneL').getBoundingClientRect(), c = document.querySelector('.pipe-wrap').getBoundingClientRect(); return [Math.round(p.height), Math.round(c.top)]; })()`);
ok('D3 nothing selected: no bar', (await ctxInfo()) === null);
await ev(`__cmwSelect('s1')`); await settle();
const c1 = await ctxInfo();
const d1 = await ev(`(() => { const p = document.getElementById('paneL').getBoundingClientRect(), c = document.querySelector('.pipe-wrap').getBoundingClientRect(); return [Math.round(p.height), Math.round(c.top)]; })()`);
ok('D3 a selected shape: a 56 px bar over the chain bar with its name and definition, Edit, Delete and ⋯ at 44 px', c1 && c1.k === 'shape' && c1.h === 56 && c1.above === 0 && /Disc 1 \|/.test(c1.text) && c1.btn.length === 3 && c1.btn.every((x) => x.h >= 44 && x.w >= 44), c1);
ok('D3 (#463) the planes and the chain bar do not move for the bar: it floats over them', d0[0] === d1[0] && d0[1] === d1[1], [d0, d1]);
await ev(`__cmwSelect('s2')`); await settle();
ok('D3 a new selection updates the bar', /Rectangle|Rect/i.test((await ctxInfo()).text), await ctxInfo());
await ev(`document.querySelector('.ph-ctx .ph-cb.ico').click()`); await settle();
ok('D3 ⋯ opens the shape\'s menu (Rename … Delete)', await ev(`(() => { const m = document.querySelector('#popHost .pop.menu'); return !!m && /Rename/.test(m.innerText) && /Delete/.test(m.innerText); })()`));
await key('Escape'); await settle();
await ev(`document.querySelector('.ph-ctx .ph-cb.prim').click()`); await settle();
ok('D3 Edit opens the Tools sheet at the shape, and the bar gives way', (await phSt()).kind === 'tools' && (await ctxInfo()) === null, await phSt());
await ev(`Phone.close(true)`); await settle();
ok('D3 the bar is back when the sheet closes', !!(await ctxInfo()));
const n0 = (await ev(`__cmwShapes().shapes.length`));
await ev(`[...document.querySelectorAll('.ph-ctx .ph-cb')].find((b) => /Delete/.test(b.textContent)).click()`); await settle();
ok('D3 Delete removes the shape and the bar goes', (await ev(`__cmwShapes().shapes.length`)) === n0 - 1 && (await ctxInfo()) === null, [n0, await ev(`__cmwShapes().shapes.length`)]);
try {
// the Undo message takes the bar's row, under the planes, so it covers none of them
const ts = await ev(`(() => { const t = document.querySelector('#toastHost .toast'); if (!t) return null; const r = t.getBoundingClientRect(), p = document.getElementById('paneL').getBoundingClientRect(), a = t.querySelector('.toast-act'); return { top: Math.round(r.top), h: Math.round(r.height), paneBottom: Math.round(p.bottom), act: a ? Math.round(a.getBoundingClientRect().height) : 0, w: Math.round(r.width) }; })()`);
ok('D3 the Delete message is a 56 px row under the planes (#66), its Undo 44 px', ts && ts.h === 56 && ts.top >= ts.paneBottom - 1 && ts.act >= 44 && ts.w >= 358, ts);
await ev(`document.querySelector('#secDraw .tool[data-tool="polygon"]').click()`); await settle();
const pc = await center('#paneL');
await touch(pc[0] - 80, pc[1] - 60); await settle(); await touch(pc[0] + 60, pc[1] - 40); await settle();
const p2 = await ctxInfo();
ok('D3 a polygon in progress: Last, Done (not yet), Cancel', p2 && p2.k === 'polygon' && p2.btn.map((x) => x.t).join('|') === '⌫ Last|Done|Cancel' && p2.btn[1].dis, p2);
await touch(pc[0] + 20, pc[1] + 30); await settle();
const p3 = await ctxInfo(); 
ok('D3 three points: Done is on', p3 && !p3.btn[1].dis, p3);
await ev(`document.querySelector('.ph-ctx .ph-cb').click()`); await settle();
ok('D3 Last takes the last point back', (await ctxInfo()).btn[1].dis === true, await ctxInfo());
await touch(pc[0] + 20, pc[1] + 30);
await settled({ until: `(() => { const b = [...document.querySelectorAll('.ph-ctx .ph-cb')].find((x) => /Done/.test(x.textContent)); return !!b && !b.disabled; })()` });
const sh0 = await ev(`__cmwShapes().shapes.length`);
await ev(`[...document.querySelectorAll('.ph-ctx .ph-cb')].find((b) => /Done/.test(b.textContent)).click()`); await settled({ until: `__cmwShapes().shapes.length === ${sh0 + 1}` });
ok('D3 Done makes the polygon', (await ev(`__cmwShapes().shapes.length`)) === sh0 + 1, [sh0, await ev(`__cmwShapes().shapes.length`)]);
await ev(`document.querySelector('#secDraw .tool[data-tool="polygon"]').click()`); await settle();
await touch(pc[0] - 60, pc[1]); await settle();
await ev(`[...document.querySelectorAll('.ph-ctx .ph-cb')].find((b) => /Cancel/.test(b.textContent)).click()`); await settle();
const cc = await ctxInfo();
ok('D3 Cancel drops the polygon (the finished one is still the selection)', !cc || cc.k !== 'polygon', cc);
// a construction: what to pick next, Undo pick, ×
await ev(`[...document.querySelectorAll('#constructTools .tool[data-tool]')].find((b) => b.dataset.tool === 'circle3').click()`); await settle();
const k1 = await ctxInfo();
ok('D3 a construction tool: the bar says what to pick (1 of 3), Undo pick waits, × is 44 px', k1 && k1.k === 'construct' && /Pick a point/.test(k1.text) && /1 of 3/.test(k1.text) && k1.btn.length === 2 && k1.btn[0].dis && k1.btn.every((x) => x.h >= 44 && x.w >= 44), k1);
await touch(pc[0] - 60, pc[1] - 20); await settle();
const k2 = await ctxInfo();
ok('D3 after a pick: 2 of 3 and Undo pick is on', k2 && /2 of 3/.test(k2.text) && !k2.btn[0].dis, k2);
await ev(`document.querySelector('.ph-ctx .ph-cb').click()`); await settle();
ok('D3 Undo pick takes it back', /1 of 3/.test(((await ctxInfo()) || {}).text || ''), await ctxInfo());
await ev(`document.querySelector('.ph-ctx .ph-cb.ico').click()`); await settle();
const k3 = await ctxInfo();
ok('D3 × lets the tool go (the bar is the selection\'s again)', !k3 || k3.k !== 'construct', k3);
// the orthogonal circle: Whole | Inside | Outside in words on a second row
await ev(`[...document.querySelectorAll('#constructTools .tool[data-tool]')].find((b) => b.dataset.tool === 'perp').click()`); await settle();
const q1 = await ev(`(() => { const b = document.querySelector('.ph-ctx'); if (!b || b.hidden) return null; const r = b.getBoundingClientRect(); return { h: Math.round(r.height), seg: [...b.querySelectorAll('.ph-ctseg > button')].map((x) => ({ t: x.textContent, h: Math.round(x.getBoundingClientRect().height), on: x.getAttribute('aria-checked') })) }; })()`);
ok('D3 the orthogonal circle: a taller bar with Whole, Inside, Outside, Between as 44 px words', q1 && q1.h >= 100 && q1.seg.map((x) => x.t).join('|') === 'Whole|Inside|Outside|Between' && q1.seg.every((x) => x.h >= 44) && q1.seg[0].on === 'true', q1);
ok('D3 the plane\'s own Whole | Inside chip is gone while the bar has those words', await ev(`[...document.querySelectorAll('.cm-chip .cm-seg:not(.cm-tan)')].every((e) => !e.getClientRects().length)`));
await ev(`[...document.querySelectorAll('.ph-ctseg > button')][1].click()`); await settle();
ok('D3 choosing Inside sets the tool and the bar shows it', (await ev(`Construct.seg`)) === 'in' && (await ev(`[...document.querySelectorAll('.ph-ctseg > button')][1].getAttribute('aria-checked')`)) === 'true');
await ev(`Construct.seg = 'whole'; document.querySelector('.ph-ctx .ph-cb.ico').click()`); await settle();
} catch (e) { fails.push({ name: 'D3 threw', got: String(e.stack).slice(0, 600) }); }
await ev(`document.querySelector('#secDraw .tool[data-tool="select"]').click()`); await settle();

// In Russian at 360: no word cut, the buttons keep their 44 px
await fresh('d3ru', 360, 780, false, true, '&lang=ru'); await settle();
await ev(`__cmwSelect(__cmwShapes().shapes[0].id)`); await settle();
const ruChk = () => ev(`(() => { const b = document.querySelector('.ph-ctx'); if (!b || b.hidden) return null; const bt = [...b.querySelectorAll('button')]; return { over: b.scrollWidth > b.clientWidth + 1, cut: bt.filter((x) => x.scrollWidth > x.clientWidth + 1).map((x) => x.textContent), small: bt.filter((x) => x.getBoundingClientRect().height < 44 || x.getBoundingClientRect().width < 44).map((x) => x.textContent), t: bt.map((x) => x.textContent.trim()) }; })()`);
const r1 = await ruChk();
ok('D3 ru, a selected shape: Изменить, Удалить and ⋯ fit at 360 px', r1 && !r1.over && !r1.cut.length && !r1.small.length, r1);
await ev(`[...document.querySelectorAll('#constructTools .tool[data-tool]')].find((b) => b.dataset.tool === 'perp').click()`); await settle();
const r2 = await ruChk();
ok('D3 ru, the orthogonal circle: its words and Отменить выбор fit at 360 px', r2 && !r2.over && !r2.cut.length && !r2.small.length, r2);

// ---------------- no cut "No shapes" on the phone's card pictures (the laptop's keep it) ----------------
await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => { for (const C of [self.CanvasRenderingContext2D, self.OffscreenCanvasRenderingContext2D]) { if (!C) continue; const P = C.prototype; for (const f of ['fillText', 'strokeText']) { const o = P[f]; P[f] = function (t, ...a) { if (String(t) === 'No shapes') { self.__noShapes = (self.__noShapes || 0) + 1; } return o.call(this, t, ...a); }; } } })();` });
for (const [w, h, mob, want] of [[412, 860, true, false], [1366, 768, false, true]]) {
  await withState(`thumb${w}`, w, h, mob, { shapes: [], steps: STEPS2 }); await settle();
  const nsh = await ev('window.__noShapes || 0');
  ok(`UX83 ${w}: "No shapes" ${want ? 'drawn where it fits' : 'never drawn on a 44 px picture'}`, want ? nsh > 0 : nsh === 0, nsh);
}
await grab();

// ---------------- the last pick of a construction on touch: the preview under the finger, lift to commit ----------------
await fresh('last', 412, 860, false, true);
await ev(`[...document.querySelectorAll('#constructTools .tool[data-tool]')].find((b) => b.dataset.tool === 'circle3').click()`); await settle();
await touch(150, 250); await settle(); await touch(260, 330); await settle();
const n50 = () => ev(`__tourApi.snapshot().state.shapes.length`);
const nBefore = await n50();
const pk2 = await ev('Construct.debug().draft ? Construct.debug().draft.picks.length : -1');
await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: 450, id: 1 }] }); await sleep(200);
for (let i = 1; i <= 5; i++) { await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200 + i * 10, y: 450 - i * 12, id: 1 }] }); await sleep(80); }
await settle();
const dn = await ev(`(() => { const d = Construct.debug(); return { hover: d.hover, picks: d.draft ? d.draft.picks.length : -1, shapes: __tourApi.snapshot().state.shapes.length }; })()`);
ok('UX50 two picks made, the third finger down and sliding: the preview follows it, nothing is made yet', pk2 === 2 && dn.hover && dn.picks === 2 && dn.shapes === nBefore, [pk2, dn, nBefore]);
const h1 = dn.hover;
await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 300, y: 380, id: 1 }] }); await settle();
const h2 = await ev('Construct.debug().hover');
ok('UX50 sliding moves the preview', h2 && (Math.abs(h2[0] - h1[0]) > 0.05 || Math.abs(h2[1] - h1[1]) > 0.05), [h1, h2]);
await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await settle();
ok('UX50 lifting makes the third pick: the circle and its points are made', (await n50()) > nBefore, [nBefore, await n50()]);
await key('Escape'); await settle();

// ---------------- a pinch on the app's own controls never zooms the page; the planes keep their pinch ----------------
// (last: after a synthetic two-finger pinch, headless Chrome's emulated touches stop producing pointer events)
await fresh('pinch', 412, 860, false, true);
for (const [name, sel] of [['header', '.top'], ['chain bar', '.pipe-wrap'], ['tool row', '#secDraw']]) {
  const b = await box(sel);
  await pinch(206, b.t + b.h / 2, 60, 200);
  ok(`UX13 pinch on the ${name}: the page stays at 1×`, (await ev('visualViewport.scale')) === 1, await ev('visualViewport.scale'));
}
await ev(`Phone.open('tools')`); await settle();
const sh = await box('.ph-sheet .ph-sh');
await pinch(120, sh.t + 30, 40, 160);
ok('UX13 pinch on a sheet head: the page stays at 1×', (await ev('visualViewport.scale')) === 1);
await pinch(206, sh.t + 200, 40, 160);
ok('UX13 pinch on a sheet body: the page stays at 1×', (await ev('visualViewport.scale')) === 1);
await ev(`Phone.close(true)`); await settle();
const sc0 = await ev(`document.getElementById('leftReadout').textContent`);
await pinch(206, 300, 60, 200);
const sc1 = await ev(`document.getElementById('leftReadout').textContent`);
ok('UX13 a pinch on the plane still zooms the plane', sc0 !== sc1 && (await ev('visualViewport.scale')) === 1, [sc0, sc1]);
await grab();

ok('no exceptions or console errors', errs.length === 0, errs.slice(0, 5));
return { pass: fails.length === 0, fails, info };
