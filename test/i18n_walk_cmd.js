// "No English left" (phase 2b, notes/i18n/PHASE2B.md): walk the Russian interface through its views, every example and
// card, the deformation, every drawing tool and shape editor, the context menus, the palette, the guide, the help menu,
// the export dialog and its controls, the sound popover, every step of every tour chapter, and on narrow screens the
// drawers and the tool sheet. test/i18n_scan.js records every string with a Latin word that is not allowed (math, key
// names, file formats, product names, the app's name). Run with a copy of test/cdp_kit on the port that serves dist/:
// test/<you>_cdp/q.sh test/i18n_walk_cmd.js. For another width, prepend `globalThis.WALK = { w: 390, dark: true };`.
// About 7 minutes per width. Result: { w, dark, chapters, n, errors, left: [{ text, words, where, state }] }; n = 0 passes.
const P = globalThis.WALK || {};
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const W = P.w || 1440, DARK = !!P.dark, BASE = P.base || `http://localhost:${PORT}/`, PHONE = W < 768;
const SCAN = fs.readFileSync(path.join(DIR, '..', 'i18n_scan.js'), 'utf8');
await view(W, PHONE ? 844 : 900, DARK, PHONE);
await nav(`${BASE}test.html?ns=xbi-walk-${W}-${Date.now()}&lang=ru`); await sleep(4500);
await ev(SCAN);
const errs = [];
const S = async (label, ms = 350) => { await sleep(ms); await ev(`__i18nScan(${JSON.stringify(label)})`); };
const esc = async () => { await key('Escape'); await sleep(200); };
const clickId = async (id) => ev(`(() => { const b = document.getElementById(${JSON.stringify(id)}); if (!b) return false; b.click(); return true; })()`);
const center = async (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? [r.left + r.width / 2, r.top + r.height / 2] : null; })()`);
const more = async () => { const vis = await ev(`getComputedStyle(document.getElementById('hdrMoreBtn')).display !== 'none'`); if (vis) { await clickId('hdrMoreBtn'); await sleep(300); } return vis; };
await S('start');
// the header and its menus (through More where the bar folds)
for (const id of ['settingsBtn', 'exportBtn', 'shareBtn', 'helpBtn', 'soundMore', 'examplesBtn']) {   // ([v17 D5] Language is in Settings)
  if (await more()) await S('more menu');
  await clickId(id); await S('menu ' + id, 500); await esc(); await esc();
}
// views and surfaces
for (const m of ['phase', 'land', 'xy']) { await ev(`__cmwSetMain('${m}'), 1`); await S('view ' + m, 1200); }
await ev(`__cmwSetView('L', 'sphere'), 1`); await S('left sphere', 1200);
await ev(`__cmwSetView('R', 'sphere'), 1`); await S('right sphere', 1200);
await ev(`__cmwSetView('L', 'plane'), __cmwSetView('R', 'plane'), 1`); await S('planes', 800);
// the deformation and its paths
await ev(`__cmwMorph({ open: true }), 1`); await S('deformation', 1200);
await key('p'); await S('deformation paths', 800);
await ev(`__cmwMorph({ open: false }), 1`); await sleep(400);
// every example, every card of its chain, hover readouts
const nEx = await ev(`(() => { let n = 0; for (const b of document.querySelectorAll('[data-example], .gal-item')) n++; return n; })()`);
for (let i = 0; i < 40; i++) {
  const ok = await ev(`(() => { try { __cmwExample(${i}); return true; } catch (e) { return String(e); } })()`);
  if (ok !== true) break;
  await S('example ' + i, 1500);
  const nc = await ev(`document.querySelectorAll('#pipeline .card').length`);
  for (let c = 0; c < nc; c++) { await ev(`(() => { const c = document.querySelectorAll('#pipeline .card')[${c}]; c && c.click(); })()`); await S(`example ${i} card ${c}`, 500); }
  for (const sel of ['#overlayL', '#overlayR']) { const c = await center(sel); if (c) { await move(c[0], c[1]); await S(`example ${i} hover ${sel}`, 400); } }
  await ev(`__cmwSetMain('phase'), 1`); await S(`example ${i} phase`, 900);
  await ev(`__cmwSetMain('land'), 1`); await S(`example ${i} land`, 900);
  await ev(`__cmwSetMain('xy'), 1`); await sleep(500);
  await ev(`__cmwMorph({ open: true }), 1`); await S(`example ${i} deformation`, 900); await ev(`__cmwMorph({ open: false }), 1`);
}
// tools: each tool's hint
const tools = await ev(`[...document.querySelectorAll('.tool[data-tool]')].map((b) => b.dataset.tool)`);
for (const t of [...new Set(tools)]) { await ev(`(() => { const b = document.querySelector('.tool[data-tool=${t}]'); b && b.click(); })()`); await S('tool ' + t, 250); }
await esc();
// draw a circle, a point target in the right plane, the shape context menu
await ev(`__cmwExample(0), 1`); await sleep(1500);
{
  const L = await center('#overlayL');
  if (L) {
    await ev(`(() => { const b = document.querySelector('.tool[data-tool=circle]'); b && b.click(); })()`);
    await drag(L[0], L[1], L[0] + 60, L[1], 8, 20); await S('drew circle', 800);
    await ev(`(() => { const b = document.querySelector('.tool[data-tool=select]'); b && b.click(); })()`);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: L[0] + 60, y: L[1], button: 'right', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: L[0] + 60, y: L[1], button: 'right', clickCount: 1 });
    await S('context menu circle', 900);
    await esc();
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: L[0] - 80, y: L[1] - 70, button: 'right', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: L[0] - 80, y: L[1] - 70, button: 'right', clickCount: 1 });
    await S('context menu empty', 900);
    await esc();
  }
  const R = await center('#overlayR');
  if (R) {
    await ev(`(() => { const b = document.querySelector('.tool[data-tool=point]'); b && b.click(); })()`);
    await click(R[0] + 30, R[1] - 20); await S('target point', 1500);
  }
}
// one shape of each kind drawn by drag, with its editor open
{
  const L = await center('#overlayL');
  if (L) {
    let dx = -120;
    for (const t of ['segment', 'line', 'ray', 'arc', 'disc', 'rect', 'halfplane', 'annulus', 'sector', 'cgrid', 'pgrid', 'curve', 'point']) {
      const ok = await ev(`(() => { const b = document.querySelector('.tool[data-tool=${t}]'); if (!b || !b.offsetParent) return false; b.click(); return true; })()`);
      if (!ok) continue;
      if (t === 'point') await click(L[0] + dx, L[1] + 40); else await drag(L[0] + dx, L[1] - 40, L[0] + dx + 50, L[1] + 30, 10, 20);
      await S('drew ' + t, 700);
      await ev(`(() => { const r = document.querySelector('#shapeList .shape.sel .shape-name, #shapeList .shape:last-child .shape-name'); r && r.click(); })()`);
      await S('editor ' + t, 500);
      dx += 20;
    }
    await ev(`(() => { const b = document.querySelector('.tool[data-tool=select]'); b && b.click(); })()`);
  }
}
// the palette with queries
for (const q of ['', 'sin', 'tan', 'язык', 'language', 'нули', 'z^2', 'f(z', 'экспорт', 'deform']) {
  await key('k', 4); await sleep(300); if (q) await type(q); await S('palette ' + q, 700); await esc();
}
// the guide, the help menu, the export dialog and its menus
await key('?'); await S('guide', 1200); await esc();
await ev(`Tour.openHelpMenu && Tour.openHelpMenu(document.getElementById('helpBtn')), 1`); await S('help menu', 600); await esc();
await key('e', 4); await S('export dialog', 2500);
const xb = await ev(`[...document.querySelectorAll('.modal-bg button[aria-haspopup], .modal-bg summary, .modal-bg [role=tab], .modal-bg .seg button')].length`);
for (let i = 0; i < Math.min(xb, 30); i++) {
  await ev(`(() => { const b = [...document.querySelectorAll('.modal-bg button[aria-haspopup], .modal-bg summary, .modal-bg [role=tab], .modal-bg .seg button')][${i}]; b && b.click(); })()`);
  await S('export control ' + i, 900);
  await ev(`(() => { const m = document.querySelector('#popHost > .pop, .menu:popover-open'); if (m) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); })()`); await sleep(150);
}
await esc(); await esc();
// the sound popover and Sound on
await ev(`(() => { const b = document.getElementById('soundMore'); b && b.click(); })()`); await S('sound popover', 700); await esc();
await key('M', 8); await S('sound on', 1500); await key('M', 8); await sleep(400);
// the tour: every step of every chapter
const chapters = await ev(`Tour.chapters().map((c) => c.id)`);
for (const ch of chapters) {
  await ev(`Tour.start({ chapter: ${JSON.stringify(ch)} }), 1`); await sleep(1500);
  for (let s = 0; s < 40; s++) {
    const cur = await ev(`JSON.stringify(Tour.current())`);
    if (cur === 'null' || !cur.includes(`"${ch}"`)) break;
    await S(`tour ${cur}`, 700);
    await ev(`Tour.next(), 1`); await sleep(900);
  }
  await S('tour end ' + ch, 500);
  await ev(`Tour.stop(), 1`); await sleep(800);
}
// the phone and tablet panels: the drawers and the tool More sheet
if (W < 1024) {
  for (const id of ['toggleLeft', 'toggleRight']) { await more(); await clickId(id); await S('drawer ' + id, 900); await esc(); }
  await ev(`(() => { const t = document.getElementById('toolMore'); if (t) t.open = true; })()`); await S('tool more', 600);
  await ev(`(() => { const t = document.getElementById('toolMore'); if (t) t.open = false; })()`);
}
const left0 = await ev(`__i18nLeft()`);
// v15 (review russian-14): the Inspector for every card and the F tile, Parameters (add, a refused name, rename, the
// number's menu), the planes' menu on X (a zeros-and-poles chain, a shape) and, on a phone, every sheet
const ns15 = `xbi-walk15-${W}-${Date.now()}`;
const ST15 = { v3: true, v4: true, nextId: 50, focus: 0, rightMode: 'image', srcView: { cx: 0, cy: 0, s: 60 },
  shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 0.6 }, { id: 's2', kind: 'line', a: [0, 0.8], b: [1, 0.8] }],
  steps: [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: { a: '1', b: '-1', c: 'a', d: '1' }, on: true }, { type: 'zp', params: { a: '1', zeros: '0.5', poles: '-0.5i' }, on: true }],
  params: [{ name: 'a', value: 0.5, min: -2, max: 2, step: 0.01 }] };
await ev(`localStorage.setItem('complex-map-workbench-v1:${ns15}', ${JSON.stringify(JSON.stringify(ST15))}), 1`);
await nav(`${BASE}test.html?ns=${ns15}&lang=ru`); await sleep(4000);
await ev(SCAN);
const tryEv = async (js) => { try { return await ev(js); } catch (e) { return null; } };
for (const k of [0, 1, 2, 3, 'F']) {
  await tryEv(`(() => { const e = document.querySelector(${JSON.stringify(k === 'F' ? '#pipeline .ftile' : '#pipeline .card[data-k="KK"]')}.replace('KK', ${JSON.stringify(String(k))})); e && e.click(); return 1; })()`);
  await S('inspector ' + k, 900);
}
await tryEv(`(() => { const d = document.querySelector('#propsPanel details.ifold'); if (d) d.open = true; for (const x of document.querySelectorAll('#propsPanel details.ifold')) x.open = true; return 1; })()`); await S('inspector F folds', 500);
await tryEv(`(() => { const b = document.querySelector('.prm-add button'); b && b.click(); return 1; })()`); await S('parameters: new number', 500);
await type('д'); await key('Enter'); await S('parameters: a refused name', 500); await key('Escape'); await sleep(200);
await tryEv(`(() => { const b = document.querySelector('.prm-row .prm-name'); b && b.click(); return 1; })()`); await S('parameters: rename', 500); await key('Escape'); await sleep(200);
await tryEv(`(() => { const b = document.querySelector('.prm-row .prm-more'); b && b.click(); return 1; })()`); await S('parameters: menu', 500); await esc();
if (!PHONE) {
  for (const [lab, re, im] of [['empty X', -1.2, -1.1], ['shape', 0.5, 0.8]]) {
    await tryEv(`(() => { const p = __cmwPlaneMenu().w2s('L', ${re}, ${im}); PlaneMenu.open('L', null, { clientX: p[0], clientY: p[1] }); return 1; })()`);
    await S('plane menu ' + lab, 600); await esc();
  }
  await tryEv(`(() => { PlaneMenu.open('R', null, { clientX: document.getElementById('canvasR').getBoundingClientRect().left + 60, clientY: document.getElementById('canvasR').getBoundingClientRect().top + 60 }); return 1; })()`); await S('plane menu Y', 600); await esc();
} else {
  for (const k of ['edit', 'tools', 'display', 'more']) { await tryEv(`(Phone.open(${JSON.stringify(k)}), 1)`); await S('phone sheet ' + k, 800); await tryEv('(Phone.close(true), 1)'); await sleep(300); }
  await tryEv(`(Phone.open('edit', { params: true }), 1)`); await S('phone sheet numbers', 800); await tryEv('(Phone.close(true), 1)');
}
const left15 = await ev(`__i18nLeft()`);
// v16 (review v16 regress-8): the deformation range's interface: the transport with a bracket (push-forward, pullback,
// t = 0.5), a card's ⋯ → Deformation ▸ with its "from …" keys (desktop), the palette's range commands, the phone's
// Deformed steps row in the Display sheet, the bracket's aria text, and the Mountain King example's hint
const ns16 = `xbi-walk16-${W}-${Date.now()}`;
const ST16 = { v3: true, v4: true, nextId: 50, focus: 0, rightMode: 'image', srcView: { cx: 0, cy: 0, s: 90 },
  shapes: [{ id: 's1', kind: 'rect', a: [-1, -1], b: [1, 1] }], steps: [{ type: 'exp', params: {}, on: true }, { type: 'pown', params: { n: 2 }, on: true }, { type: 'sin', params: {}, on: true }] };
await ev(`localStorage.setItem('complex-map-workbench-v1:${ns16}', ${JSON.stringify(JSON.stringify(ST16))}), 1`);
await nav(`${BASE}test.html?ns=${ns16}&lang=ru`); await sleep(4000);
await ev(SCAN);
await tryEv(`(__cmwMorph({ open: true, playing: false }), 1)`); await S('v16 transport', 900);
await tryEv(`(__cmwMorph({ range: { a: 2, b: 3 } }), 1)`); await S('v16 bracket 2-3 push-forward', 900);
await tryEv(`(__cmwMorph({ T: 0.5 }), 1)`); await S('v16 bracket 2-3 t = 0.5', 600);
await tryEv(`(__cmwMorph({ range: { a: 1, b: 2 } }), 1)`); await S('v16 bracket 1-2 pullback', 900);
if (!PHONE) {
  for (const k of [2, 3]) {
    await tryEv(`await (async () => { document.querySelector('#pipeline .card[data-k="${k}"] .more').click(); await new Promise((r) => setTimeout(r, 400)); const b = [...document.querySelectorAll('.pop.menu .mi')].find((x) => /^(Deformation|Деформация)/.test((x.querySelector('.mi-label') || x).textContent.trim())); if (b) b.click(); return 1; })()`);
    await S('v16 card ' + k + ' Deformation submenu', 500); await esc();
  }
  for (const q of ['прообраз', 'скобк', 'bracket']) { await key('k', 4); await sleep(500); await type(q); await S('v16 palette ' + q, 600); await key('Escape'); await sleep(200); }
} else {
  await tryEv(`(Phone.open('display'), 1)`); await S('v16 phone Display sheet, Deformed steps', 900); await tryEv('(Phone.close(true), 1)'); await sleep(300);
}
const mkI = await tryEv(`(() => { for (let i = 0; i < 40; i++) { try { __cmwExample(i); } catch (e) { return -1; } if (__cmwState && document.querySelector('#examplesBtn .exlabel') && /горного|mountain/i.test(document.querySelector('#examplesBtn .exlabel').textContent)) return i; } return -1; })()`);
await S('v16 Mountain King and its hint', 1500);
const left = left0.concat(left15, await ev(`__i18nLeft()`));
const logsNow = logs().filter((l) => /error|exception/i.test(JSON.stringify(l)) && !/favicon|404/.test(JSON.stringify(l))).slice(0, 8);
return { w: W, dark: DARK, chapters: chapters.length, n: left.length, errors: logsNow, left };
