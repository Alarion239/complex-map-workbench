// Look down and the readout card on a phone, the whole flow: M3 z³ − 1.2z + 0.3 with the disc |w − 1.1| < 0.25 of w₁,
// selected on plane z of the steps view.
//  - At 360 × 640 (en), 412 × 915 (it), 740 × 360 (en) and 568 × 320 (ru), Look down draws, and its key stands at the
//    plane's bottom left, folded to its title, a button at least 44 × 44, above the context bar and clear of the
//    plane's other keys; a tap unfolds it, its five marks inside it and the plane, still above the bar, at most 320 px
//    wide, none of its words cut, and clear of the plane's other keys shown; on a landscape phone where the room under
//    the readout would cut it, it takes the plane's top and the readout gives way. Beside an
//    open sheet on a landscape phone (568 × 320) too, its words wrapping in the plane's narrow room.
//  - The card is in the disc's row in Shapes, under its editor: the counts; the r slider's thumb 44 × 44, with the
//    ticks at the join radii placed for that thumb; a touch drag on the slider sets the disc's radius; the card's Look
//    down switch turns the marks and the key off.
//  - The open key's room is measured when its size or the root's classes change, not per overlay frame: 8 wheel steps
//    that zoom the plane measure it no more than once.
//  - With the Pick tool, a second finger on the plane while one draws a disc ends the drawing: no disc is added.
//  - In Russian the disc added from the keyboard is said «В плоскости w₁ добавлен круг…», as the rest of the view says it.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const LOAD_MS = 40000, READY_MS = 60000;
const fails = [], info = {};
let pass = 0;
const ok = (name, cond, got) => { if (cond) pass++; else fails.push({ name, got }); };
const until = (expr, max = READY_MS) => settled({ until: expr, max });
const frames = () => ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
const M3 = [{ type: 'custom', params: { expr: 'z^3-1.2z+0.3' }, on: true }];
const DISC = { id: 'd', kind: 'disc', c: [1.1, 0], r: 0.25, stage: 1 };
const S4 = Math.sqrt(0.4), J3 = Math.abs(1.1 - (0.3 + 0.8 * S4));
const touch = (type, pts) => send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1 })) });
const tap = async (p) => { await touch('touchStart', [p]); await touch('touchEnd', []); };
const open = async (w, h, lang, mobile = true) => {
  const ns = `ldphone-${lang}-${Date.now()}`;
  const st = { v3: true, v4: true, v5: true, v6: true, shapes: [Object.assign({}, DISC)], steps: M3, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } };
  await view(w, h, false, mobile);
  await nav(`http://localhost:${PORT}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await nav(`http://localhost:${PORT}/test.html?ns=${ns}&lang=${lang}&view=steps`);
  await until("typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip .sv-plane')", LOAD_MS);
  await until('__cmwSteps().ready.ready && __cmwSteps().i === 0');
  await frames();
};
const select = async (id) => { await ev(`__cmwSelect(${JSON.stringify(id)}); 1`); await until(`__cmwShapes().selected === ${JSON.stringify(id)}`); await frames(); await frames(); await frames(); };
const look = () => ev('typeof __cmwLookDown === "function" ? __cmwLookDown() : null');
const box = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e || e.hidden || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; })()`);
const meets = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
const inside = (a, b) => a[0] >= b[0] - 0.5 && a[1] >= b[1] - 0.5 && a[2] <= b[2] + 0.5 && a[3] <= b[3] + 0.5;
// the plane's other keys and chips shown over it, and the context bar
const others = () => ev(`[...document.querySelectorAll('#plotL > .chip, #plotL > .legend-chip, #plotL > .viewstack, #plotL > .empty-chip, #plotL > .draft-chip')].filter((e) => !e.hidden && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map((e) => { const r = e.getBoundingClientRect(); return { k: e.className, b: [r.left, r.top, r.right, r.bottom] }; })`);
const ctxTop = () => ev(`(() => { const c = document.querySelector('.ph-ctx.in:not(.under)'); return c ? c.getBoundingClientRect().top : Infinity; })()`);

// ---- the key at each size
for (const [w, h, lang] of [[360, 640, 'en'], [412, 915, 'it'], [740, 360, 'en'], [568, 320, 'ru']]) {
  const at = `${w}×${h} ${lang}`;
  await open(w, h, lang);
  await select('d');
  const L = await look(), pane = await box('#overlayL'), key = await box('#plotL .ld-key'), btn = await box('#plotL .ld-key > button.ld-ttl'), bar = await ctxTop(), oth = await others();
  const folded = await ev(`(() => { const k = document.querySelector('#plotL .ld-key'), b = k && k.querySelector('button.ld-ttl'); return !!k && k.classList.contains('folded') && !!b && b.getAttribute('aria-expanded') === 'false' && document.getElementById(b.getAttribute('aria-controls')) === k.querySelector('.ld-list') && !k.querySelector('.ld-list').getClientRects().length; })()`);
  info[at] = { L: !!L, pane, key, btn, bar, oth };
  ok(`${at}: Look down draws for the selected disc of w₁`, !!L && L.id === 'd' && L.lines.length === 3, L);
  ok(`${at}: the key is folded to its title, a button at least 44 × 44 that controls the marks' list`, folded && !!btn && btn[2] - btn[0] >= 44 && btn[3] - btn[1] >= 44, { folded, btn });
  ok(`${at}: the folded key lies in the plane, above the context bar`, !!key && !!pane && inside(key, pane) && key[3] <= bar + 0.5, { key, pane, bar });
  ok(`${at}: the folded key meets none of the plane's other keys`, !!key && !oth.some((o) => meets(o.b, key)), { key, oth });
  if (btn) await tap([(btn[0] + btn[2]) / 2, (btn[1] + btn[3]) / 2]);
  await frames();
  // (the marks counted where their words lie inside the key's box, none cut: the key does not scroll here)
  const k2 = await box('#plotL .ld-key'), n = await ev(`(() => { const k = document.querySelector('#plotL .ld-key'), kb = k.getBoundingClientRect(); if (k.querySelector('button.ld-ttl').getAttribute('aria-expanded') !== 'true' || k.scrollHeight > k.clientHeight + 1) return -1; return [...k.querySelectorAll('.ld-it')].filter((e) => { if (!e.getClientRects().length) return false; const g = document.createRange(); g.selectNodeContents(e); const b = g.getBoundingClientRect(); return b.left >= kb.left - 0.5 && b.right <= kb.right + 0.5 && b.top >= kb.top - 0.5 && b.bottom <= kb.bottom + 0.5; }).length; })()`), oth2 = await others();
  info[at].open = [k2, n, oth2];
  ok(`${at}: a tap unfolds the key, its five marks inside it, in the plane, above the context bar`, n === 5 && !!k2 && inside(k2, pane) && k2[3] <= bar + 0.5, { k2, n, pane, bar });
  ok(`${at}: the open key meets none of the plane's other keys shown (the readout, unless it gave way; the colour key; the buttons)`, !!k2 && !oth2.some((o) => meets(o.b, k2)), { k2, oth2 });
  ok(`${at}: the open key is at most 320 px wide, in rows`, !!k2 && k2[2] - k2[0] <= 320.5, k2);
}

// ---- a landscape phone with the Shapes sheet open beside the plane (568 × 320, ru): the key, folded and open, in the
// plane's narrow room, its marks' words inside it, clear of the button column
await open(568, 320, 'ru');
await select('d');
await ev(`Phone.open('tools', { tab: 'shapes', edit: 'd' }), 1`);
await until(`(() => { const c = document.querySelector('#shapeList .ro-card'); return !!c && c.getClientRects().length > 0; })()`, 10000);
await sleep(400); await frames();
{
  const pane = await box('#overlayL'), key = await box('#plotL .ld-key'), oth = await others(), btn = await box('#plotL .ld-key > button.ld-ttl');
  info.side = { pane, key, oth };
  ok('568×320 ru, the sheet open: the folded key lies in the plane, clear of its other keys', !!key && inside(key, pane) && !oth.some((o) => meets(o.b, key)), info.side);
  if (btn) await tap([(btn[0] + btn[2]) / 2, (btn[1] + btn[3]) / 2]);
  await frames();
  const k2 = await box('#plotL .ld-key'), col = (await others()).filter((o) => /viewstack/.test(o.k));
  const n = await ev(`(() => { const k = document.querySelector('#plotL .ld-key'), kb = k.getBoundingClientRect(); return [...k.querySelectorAll('.ld-it')].filter((e) => { if (!e.getClientRects().length) return false; const g = document.createRange(); g.selectNodeContents(e); const b = g.getBoundingClientRect(); return b.left >= kb.left - 0.5 && b.right <= kb.right + 0.5; }).length; })()`);
  info.side.open = { k2, col, n };
  ok('568×320 ru, the sheet open: the open key\'s five marks lie inside it, clear of the button column', n === 5 && !!k2 && inside(k2, pane) && !col.some((o) => meets(o.b, k2)), info.side.open);
}

// ---- the card in the disc's row (360 × 640)
await open(360, 640, 'en');
await select('d');
await ev(`Phone.open('tools', { tab: 'shapes', edit: 'd' }), 1`);
await until(`(() => { const c = document.querySelector('#shapeList .ro-card'); return !!c && c.getClientRects().length > 0; })()`, 10000);
await ev(`(() => { document.querySelector('#shapeList .ro-card').scrollIntoView({ block: 'center' }); return 1; })()`);
await frames();
let c = await ev('__cmwReadout()');
info.card = c;
ok('the card is in the disc\'s row in Shapes, with the counts', !!c && c.where === 'row' && c.id === 'd' && c.counts === '3 preimages · 3 pieces', c);
// (getComputedStyle does not read a range's thumb: the last rule whose selector, less ::-webkit-slider-thumb, matches the slider)
const thumb = await ev(`(() => { const r = document.querySelector('#shapeList .ro-r'); let wh = null; for (const sh of document.styleSheets) { let rules; try { rules = sh.cssRules; } catch (e) { continue; } for (const ru of rules) { if (!ru.selectorText || !ru.style) continue; for (const sel of ru.selectorText.split(',')) { const m = /^(.*)::-webkit-slider-thumb$/.exec(sel.trim()); if (m && r.matches(m[1]) && ru.style.width) wh = [ru.style.width, ru.style.height]; } } } return [...(wh || [null, null]), getComputedStyle(r.parentElement).getPropertyValue('--ro-th').trim()]; })()`);
info.thumb = thumb;
ok('the r slider\'s thumb is 44 × 44', thumb[0] === '44px' && thumb[1] === '44px' && thumb[2] === '44px', thumb);
// (a tick sits on the track at r / top of the way from the thumb's centre at 0, 22 css px in, to its centre at the top)
ok('the ticks at the join radii are placed for the 44 px thumb', !!c && c.ticks.length === 2 && Math.abs(c.ticks[0].r - J3) < 1e-6 && c.ticks.every((t) => Math.abs(t.x - (22 + (t.w - 44) * (t.r / c.max))) <= 1.5), c && c.ticks);
const rr = await box('#shapeList .ro-r');
let r1 = null;
// (no card in the row: nothing to drag)
if (rr && c) {
  const x0 = rr[0] + 22 + (rr[2] - rr[0] - 44) * (c.r / c.max), y0 = (rr[1] + rr[3]) / 2;
  await touch('touchStart', [[x0, y0]]);
  for (let i = 1; i <= 8; i++) { await touch('touchMove', [[x0 + 4 * i, y0]]); await sleep(20); }
  await touch('touchEnd', []);
  await until(`__cmwShapes().shapes.find((s) => s.id === 'd').r > 0.3`, 10000);
  await frames();
  c = await ev('__cmwReadout()');
  r1 = await ev(`__cmwShapes().shapes.find((s) => s.id === 'd').r`);
  info.dragged = [r1, c];
}
ok('a touch drag on the slider sets the disc\'s radius, and the card follows', r1 > 0.3 && !!c && Math.abs(c.r - r1) < 1e-12 && c.counts === '3 preimages · 2 pieces · one covers the disc twice', { r1, c });
const sw = await box('#shapeList .ro-card input[type=checkbox]');
if (sw) await tap([(sw[0] + sw[2]) / 2, (sw[1] + sw[3]) / 2]);
await frames(); await frames();
const offL = await look(), offKey = await ev(`(() => { const k = document.querySelector('#plotL .ld-key'); return !k || k.hidden; })()`);
ok('the card\'s Look down switch turns the marks and the key off', !!sw && offL === null && offKey, { sw, offL, offKey });

// ---- a second finger ends a disc being drawn with the Pick tool
await open(360, 640, 'en');
await ev(`(() => { document.querySelector('#tools .tool[data-tool="pick"]').click(); return 1; })()`);
await until(`__cmwPick().tool === 'pick'`, 10000);
const p0 = await ev(`__cmwPlaneMenu().w2s('L', -0.9, 0.9)`), pn = await box('#overlayL');
ok('the press point lies in the plane', p0[0] > pn[0] + 20 && p0[0] < pn[2] - 80 && p0[1] > pn[1] + 60 && p0[1] < pn[3] - 60, { p0, pn });
await touch('touchStart', [p0]);
for (let i = 1; i <= 8; i++) { await touch('touchMove', [[p0[0] + 5 * i, p0[1]]]); await sleep(20); }
const drawing = await ev('__cmwShapes().shapes.length');
await touch('touchStart', [[p0[0] + 40, p0[1]], [p0[0] + 40, p0[1] + 120]]);
for (let i = 1; i <= 6; i++) { await touch('touchMove', [[p0[0] + 40, p0[1] + 4 * i], [p0[0] + 40, p0[1] + 120 + 4 * i]]); await sleep(20); }
await touch('touchEnd', []);
await settled({});
const after = await ev('__cmwShapes().shapes.map((s) => s.id)'), hist = await ev(`__cmwPlaneMenu().hist()`);
info.second = { drawing, after, hist };
ok('a second finger ends the disc being drawn: none is added', drawing === 2 && after.length === 1 && after[0] === 'd', info.second);

// ---- Russian: the disc added from the keyboard, «В плоскости w₁»
await open(1440, 900, 'ru', false);
await ev(`(() => { document.querySelector('#tools .tool[data-tool="pick"]').click(); return 1; })()`);
await until(`__cmwPick().tool === 'pick'`, 10000);
for (let i = 0; i < 8 && (await ev('document.activeElement && document.activeElement.id')) !== 'overlayL'; i++) await key('F6');
await key('Enter');
await until(`!!__cmwPick().lit`, 10000);
await key('Enter');
await until(`__cmwShapes().shapes.length === 2`, 10000);
const said = await ev('__cmwPick().live');
info.ru = said;
ok('ru: the disc added is said «В плоскости w₁ добавлен круг…»', /^В плоскости w₁ добавлен круг с центром в образе выбранной точки/.test(said), said);
// ---- the open key's room is not measured per overlay frame: 8 wheel steps zoom the plane and redraw the overlay with
// the key's size unchanged (568 × 320, ru, the key open over the readout)
await open(568, 320, 'ru');
await select('d');
{
  const btn = await box('#plotL .ld-key > button.ld-ttl');
  if (btn) await tap([(btn[0] + btn[2]) / 2, (btn[1] + btn[3]) / 2]);
  await frames(); await frames(); await frames();
  // (the wheel on the plane right of the open key, left of the button column: the first point of the plane itself, its overlay, at
  // least 8 px right of the key and level with its middle; the keys and the folded colour key beside the column take their own wheels)
  const f0 = (await look()).fits, v0 = await ev(`__cmwPlaneMenu().view('L')`), kb = await box('#plotL .ld-key');
  const p = await ev(`(() => { const y = ${(kb[1] + kb[3]) / 2}; for (let x = ${kb[2] + 8}; x < innerWidth; x += 4) { const e = document.elementFromPoint(x, y); if (e && e.id === 'overlayL') return [x, y]; } return null; })()`);
  ok('a point of the plane right of the open key takes the wheel', !!p, { key: kb });
  for (let i = 0; p && i < 8; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: p[0], y: p[1], deltaX: 0, deltaY: -40 }); await frames(); }
  await frames(); await frames();
  const L1 = await look(), v1 = await ev(`__cmwPlaneMenu().view('L')`);
  info.fits = { f0, f1: L1 && L1.fits, v0, v1, over: await ev(`document.querySelector('#plotL .ld-key').classList.contains('over-readout')`) };
  ok('8 wheel steps redraw the overlay but measure the open key\'s room no more than once', v1.s !== v0.s && !!L1 && L1.fits - f0 <= 1 && info.fits.over, info.fits);
}
return { pass: fails.length === 0, passed: pass, fails, info };
