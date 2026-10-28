// The sea song in the app (notes/sea-song/AS-BUILT.md): the example "In the Hall of the Mountain King", in English and
// Russian, desktop (light, dark) and phone emulation. It opens on the Phase view, Plain, with the whole spiral in view
// (above the style bar); Listen along from the curve's menu (right-click; a long press on the phone), the L key (the
// keyboard probe) and the guide's button play it with its stored tempo and dynamics: the harp sounds its 90 written
// notes (round 2: its own strings, every other crossing silent, notes/sea-song/r2), 22.97 s; a pointer move does not stop it, Esc does; with sound off the item says how to turn it on and does it; an
// edited curve falls back to today's rules (undo brings the melody back); frame times while it plays; no console
// errors. A command file for the CDP daemon (test/cdp_kit README):
//   python3 build.py && node test/<you>_cdp/cdpd.js &   test/<you>_cdp/q.sh test/seasong_cmd.js
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 300) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const errs = () => logs().filter((l) => /^(EXC|error|log-error)$/.test(l.t) && !/favicon|404/.test(l.m));
const NAME = { en: 'In the Hall of the Mountain King', ru: 'В пещере горного короля' };
// (round 2: 225 crossings of its own 8 lines, the 90 written notes sound, the 135 others are silent: notes/sea-song/r2)
const NOTES = 90, DUR = 22.9678;
const snd = () => ev('__cmwSound()');
const rclick = async (x, y) => {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'right', buttons: 2, clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'right', buttons: 0, clickCount: 1 });
  await settle(250);
};
const hold = async (x, y, ms = 700) => {
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  await sleep(ms);
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await settle(300);
};
const touch = async (x, y) => { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }); await sleep(60); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await settle(300); };
const menuItems = () => ev(`(() => { const p = document.querySelector('#popHost .pop.menu.pm'); return p ? [...p.querySelectorAll('.mi')].map((b) => ({ id: b.dataset.pm, text: b.textContent.trim() })) : null; })()`);
const pickXY = (id) => ev(`(() => { const b = document.querySelector('#popHost .pop.menu.pm .mi[data-pm="${id}"]'); if (!b) return null; const q = b.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; })()`);
// a point of the curve on screen (index k of its stored points), away from the cut handle
const curveXY = (k) => ev(`(() => { const p = SEASONG.pts[${k}]; return __cmwW2S('L', p[0], p[1]); })()`);
// the curve on screen: every point inside the plane, the lowest above the style bar, none under the colour key
const inView = () => ev(`(() => {
  const cv = document.querySelector('canvas.overlay[aria-keyshortcuts], .plot > canvas.overlay'); const r = cv.getBoundingClientRect();
  const bar = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Plain' || b.textContent.trim() === 'Фаза' || b.dataset.dc === 'phase');
  const br = bar && bar.getClientRects().length ? bar.parentElement.getBoundingClientRect() : null;
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const p of SEASONG.pts) { const [x, y] = __cmwW2S('L', p[0], p[1]); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  // (notes/sea-song/r2 review picture-2: the stored points inside the bar's box)
  const under = br ? SEASONG.pts.filter((p) => { const [x, y] = __cmwW2S('L', p[0], p[1]); return x >= br.left && x <= br.right && y >= br.top && y <= br.bottom; }).length : 0;
  return { plane: [r.left, r.top, r.right, r.bottom].map(Math.round), curve: [x0, y0, x1, y1].map(Math.round), bar: br ? [br.left, br.top, br.right, br.bottom].map(Math.round) : null, under };
})()`);
const listenState = async () => { const s = await snd(); return s.listenHarp; };
const frames = (ms) => ev(`await __qa.frames(${ms})`);   // (a top-level await: the daemon's replMode returns {} for a bare promise)

// open the app in a language, theme and size; sound on (Interface off: the menu clicks stay quiet) after a gesture
async function open(lang, dark, phone, ns) {
  await view(phone ? 412 : 1440, phone ? 915 : 900, dark, phone);
  await nav(`${U}?ns=${ns}${lang === 'ru' ? '&lang=ru' : ''}`);
  await settle(900);
  if (phone) await touch(200, 12); else await click(700, 12);
  await ev(`Sound.set({ on: true, vol: 0.7, ui: false, events: true, sonify: false }, { quiet: true }); await new Promise((r) => setTimeout(r, 500)); 1`);
}
// the example's index (the gallery's order) and opening it as a user does
async function openExample(lang) {
  await clickSel('#examplesBtn'); await settle(500);
  const it = await ev(`(() => { const its = [...document.querySelectorAll('#popHost .examples .ex-item')]; const i = its.findIndex((b) => b.querySelector('.ex-name').textContent === ${JSON.stringify(NAME[lang])}); if (i < 0) return null; const r = its[i].getBoundingClientRect(); its[i].scrollIntoView({ block: 'nearest' }); const q = its[i].getBoundingClientRect(); const bl = its[i].querySelector('.ex-blurb'); return { i, xy: [q.left + q.width / 2, q.top + q.height / 2], title: its[i].title, blurb: bl.textContent, cut: bl.scrollWidth > bl.clientWidth + 1, others: its.filter((b, j) => j !== i && b.title).length }; })()`);
  ok(`${lang}: the gallery lists the example`, !!it, it);
  if (!it) return -1;
  R[lang + 'Blurb'] = it.blurb;
  ok(`${lang}: its tooltip is the whole description where the line is cut, none otherwise`, (it.cut ? it.title === it.blurb : !it.title) && it.blurb.length > 60, it);
  ok(`${lang}: no other example gained a tooltip (review ui-7)`, it.others === 0, it.others);
  ok(`${lang}: the description starts the same on every device (review ui-8)`, lang === 'en' ? /^Edvard Grieg, Peer Gynt \(1875\)\. Choose Listen along in the spiral's menu/.test(it.blurb) : /^Эдвард Григ, «Пер Гюнт» \(1875\)\. Выберите «Слушать вдоль кривой»/.test(it.blurb), it.blurb);
  // (the gallery draws its thumbnails one at a time, this example last: up to 30 s for it where frames are slow)
  await sleep(1200);
  for (let i = 0; i < 145; i++) {
    R[lang + 'Thumb'] = await ev(`(() => { const im = document.querySelectorAll('#popHost .examples .ex-item')[${it.i}].querySelector('img'); return im && im.src ? im.src.slice(0, 22) + '… ' + im.src.length : null; })()`);
    if (/^data:image\/png/.test(R[lang + 'Thumb'] || '')) break;
    await sleep(200);
  }
  ok(`${lang}: the gallery shows its thumbnail`, !!R[lang + 'Thumb'] && /^data:image\/png/.test(R[lang + 'Thumb']), R[lang + 'Thumb']);
  if (lang === 'en') await shot('desk_en_gallery');
  await click(it.xy[0], it.xy[1]); await settle(2500);
  return it.i;
}

// ---------------------------------------------------------------- desktop, English, light
await open('en', false, false, 'sea_en');
const EXI = await openExample('en');
R.exIndex = EXI;
const st = await ev('__cmwState()');
ok('en: Phase view, Plain', st.view.main === 'phase' && st.dc === 'phase', st);
ok('en: the Examples button names it', (await ev(`document.querySelector('#examplesBtn .exlabel').textContent`)) === NAME.en);
let iv = await inView();
R.desktopView = iv;
ok('desktop: the whole spiral in the plane, above the style bar', iv.curve[0] > iv.plane[0] && iv.curve[2] < iv.plane[2] && iv.curve[1] > iv.plane[1] && iv.curve[3] < (iv.bar ? iv.bar[1] : iv.plane[3]), iv);
await shot('desk_en_light');
// the laptop and tablet sizes (review picture-2): the example opened at each, the whole spiral in the plane and above
// the style bar (the bar is kept clear in pixels), no stored point inside the bar's box
R.sizes = {};
for (const [w, h] of [[1366, 768], [1280, 720], [1024, 768], [1024, 700], [768, 1024]]) {
  await view(w, h, false, false); await settle(500);
  await ev(`__cmwExample(${EXI}); 1`); await settle(900);
  const v = await inView();
  R.sizes[w + 'x' + h] = v;
  ok(`desktop ${w}×${h}: the whole spiral in the plane, above the style bar, no point under it`, v.curve[0] > v.plane[0] && v.curve[2] < v.plane[2] && v.curve[1] > v.plane[1] && v.curve[3] < (v.bar ? v.bar[1] : v.plane[3]) && v.under === 0, v);
}
await view(1440, 900, false, false); await settle(500);
await ev(`__cmwExample(${EXI}); 1`); await settle(900);
// the curve's menu: Listen along
let p = await curveXY(300);
await rclick(p[0], p[1]);
let items = await menuItems();
R.menuEn = items && items.map((x) => x.text);
ok('en: the curve menu has Listen along Spiral (review ui-9)', !!items && items.some((x) => x.id === 'listen' && x.text === 'Listen along Spiral'), items);
R.shapeList = await ev(`[...document.querySelectorAll('.shapes .shape-name, .shapes [data-sid] .name')].map((e) => e.textContent.trim()).slice(0, 3)`);
await shot('desk_en_menu');
let xy = await pickXY('listen');
if (xy) await click(xy[0], xy[1]);
await settle(400);
let L = await listenState();
R.listenMenu = L;
ok('menu: plays the melody: its 90 written notes, 22.97 s, its own dynamics', L && L.notes === NOTES && Math.abs(L.dur - DUR) < 1e-3 && L.piece === true, L);
R.framesDesk = await frames(3000);
ok('desktop: 60 fps while it plays (p95 under 20 ms)', R.framesDesk.p95 < 20, R.framesDesk);
// a pointer move does not stop a melody; Esc does
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p[0] + 60, y: p[1] + 40 }); await settle(200);
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p[0] + 160, y: p[1] - 80 }); await settle(200);
ok('a pointer move does not stop it', !!(await listenState()), await listenState());
await shot('desk_en_playing');
await key('Escape'); await settle(200);
ok('Esc stops it', !(await listenState()));
// the L key (the keyboard probe: the X plane focused from the keyboard)
await ev(`document.activeElement && document.activeElement.blur && document.activeElement.blur(); 1`);
await sleep(600);
R.kbdFocus = await ev(`(() => { const c = document.querySelector('canvas.overlay[aria-keyshortcuts]'); c.focus(); return document.activeElement === c; })()`);
await settle(100);
await key('l'); await settle(400);
L = await listenState();
ok('the L key plays the melody', L && L.notes === NOTES && L.piece === true, L);
await key('l'); await settle(200);
ok('L again stops it', !(await listenState()));
await ev('document.activeElement && document.activeElement.blur && document.activeElement.blur(); 1');
// sound off: the item stays, says how to turn sound on, and does
await ev(`Sound.set({ on: false }); 1`); await settle(200);
// (v16.5 UX74: the example's Try line left the docked slot when the melody played, so the planes got its room back
// and the spiral moved with its plane: the point is read again)
p = await curveXY(300);
await rclick(p[0], p[1]);
items = await menuItems();
ok('sound off: the curve menu still offers Listen along', !!items && items.some((x) => x.id === 'listen'), items);
xy = await pickXY('listen'); if (xy) await click(xy[0], xy[1]); await settle(300);
const toastEn = await ev(`__qa.toasts()`);
R.toastOff = toastEn;
ok('sound off: a toast says how to turn it on', toastEn.length === 1 && /Sound is off/.test(toastEn[0]) && /Turn on and listen/.test(toastEn[0]), toastEn);
await shot('desk_en_soundoff');
await clickSel('#toastHost .toast-act'); await settle(900);
L = await listenState();
ok('its button turns sound on and plays the melody', (await ev('Sound.prefs().on')) && L && L.notes === NOTES && L.piece, L);
await key('Escape'); await settle(200);
// an edited curve: today's rules (the curve dragged); undo brings the melody back
await ev(`Sound.set({ on: true, events: true }, { quiet: true }); 1`);
p = await curveXY(300);
await click(p[0], p[1]); await settle(250);
await drag(p[0], p[1], p[0] + 40, p[1] + 25, 10, 16); await settle(400);
await sleep(1200);
const qz = await ev(`__qa.state().shapes.find((x) => x.kind === 'curve').pts[300]`);
const q = await ev(`__cmwW2S('L', ${qz[0]}, ${qz[1]})`);
R.dragged = [q[0] - p[0], q[1] - p[1]].map(Math.round);
await rclick(q[0], q[1]);
xy = await pickXY('listen'); if (xy) await click(xy[0], xy[1]); await settle(400);
L = await listenState();
ok('an edited curve plays by today\'s rules (not the melody)', L && !L.piece && L.dur <= 7, { L, moved: R.dragged });
await key('Escape'); await settle(200);
await key('z', 2); await settle(400);   // Ctrl+Z (undo: Ctrl or ⌘)
p = await curveXY(300);
await rclick(p[0], p[1]);
xy = await pickXY('listen'); if (xy) await click(xy[0], xy[1]); await settle(400);
L = await listenState();
ok('undo restores the melody', L && L.piece && L.notes === NOTES, L);
await key('Escape'); await settle(200);
// what it plays changed: another example opened, the curve deleted (review ui-1)
const listenFromMenu = async () => { const c = await curveXY(300); await rclick(c[0], c[1]); const b = await pickXY('listen'); if (b) await click(b[0], b[1]); await settle(400); return listenState(); };
L = await listenFromMenu();
ok('ui-1: it plays before the change', L && L.piece, L);
await ev(`__cmwExample(0); 1`); await settle(400);
R.otherExample = await ev(`({ play: __cmwSound().play, live: !!__cmwSound().listenHarp })`);
ok('ui-1: opening another example stops it', !R.otherExample.play && !R.otherExample.live, R.otherExample);
await ev(`__cmwExample(${EXI}); 1`); await settle(1500);
L = await listenFromMenu();
ok('ui-1: it plays again', L && L.piece, L);
await ev(`(() => { const s = __qa.state().shapes[0]; return 1; })()`);
await settle(600);   // (and the plane moves over frames, a few a second on CI's software renderer)
p = await curveXY(300);
await click(p[0], p[1]); await settle(250);   // (selects the curve; the click does not stop a melody)
R.selBeforeDelete = await ev(`({ play: __cmwSound().play, selected: __cmwShapes().selected })`);
await key('Delete'); await settle(400);
R.deleted = await ev(`({ play: __cmwSound().play, shapes: __qa.state().shapes.length })`);
ok('ui-1: deleting the curve stops it', R.selBeforeDelete.play && R.deleted.shapes === 0 && !R.deleted.play, { before: R.selBeforeDelete, after: R.deleted });
await key('z', 2); await settle(400);
// X → Y: the spiral fits the X pane, which is half as wide (review ui-3)
await ev(`__cmwSetMain('xy'); 1`); await settle(800);
R.xyView = await ev(`(() => { const o = __cmwW2S('L', 0, 0), cv = [...document.querySelectorAll('canvas.overlay')].find((c) => { const q = c.getBoundingClientRect(); return q.width > 0 && o[0] >= q.left && o[0] <= q.right && o[1] >= q.top && o[1] <= q.bottom; }), r = cv.getBoundingClientRect(); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const p of SEASONG.pts) { const [x, y] = __cmwW2S('L', p[0], p[1]); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return { pane: [r.left, r.top, r.right, r.bottom].map(Math.round), curve: [x0, y0, x1, y1].map(Math.round), lay: __cmwLayout() }; })()`);
ok('ui-3: in X → Y the whole spiral is in the X pane', R.xyView.curve[0] >= R.xyView.pane[0] && R.xyView.curve[2] <= R.xyView.pane[2] && R.xyView.curve[1] >= R.xyView.pane[1] && R.xyView.curve[3] <= R.xyView.pane[3], R.xyView);
await shot('desk_en_xy');
await ev(`__cmwSetMain('phase'); 1`); await settle(600);
iv = await inView();
ok('ui-3: back in Phase, the view it had', iv.curve[0] > iv.plane[0] && iv.curve[2] < iv.plane[2], iv);
// the guide: the paragraph and its button (opens the example and plays it)
await ev(`__cmwExample(0); 1`); await settle(800);
await key('?'); await settle(500);
const g = await ev(`(() => { const b = document.querySelector('.modal [data-play="piece"]'); const p = b && b.closest('p').previousElementSibling; return b ? { btn: b.textContent, para: p ? p.textContent.slice(0, 80) : '' } : null; })()`);
R.guideEn = g;
ok('the guide has the melody paragraph and its button', !!g && /A curve as a melody/.test(g.para) && /^Open and play “In the Hall of the Mountain King”$/.test(g.btn), g);
R.guideTitle = await ev(`(() => { const p = document.querySelector('.modal [data-play="piece"]').closest('p').previousElementSibling; return { i: [...p.querySelectorAll('i')].map((e) => e.textContent), own: /has its own strings, one for each note Grieg wrote/.test(p.textContent) }; })()`);
ok('the guide: the title is not in the math italic, and the piece has its own strings (ui-5, r2)', !R.guideTitle.i.some((t) => /Mountain/.test(t)) && R.guideTitle.own, R.guideTitle);
await ev(`document.querySelector('.modal [data-play="piece"]').scrollIntoView({ block: 'center' }); 1`); await settle(1500);
R.guidePic = await ev(`(() => { const im = document.querySelector('.modal img.guide-piece'); return im ? { src: (im.src || '').slice(0, 22), w: im.naturalWidth } : null; })()`);
ok('the guide shows the spiral beside its button', !!R.guidePic && /^data:image\/png/.test(R.guidePic.src) && R.guidePic.w > 0, R.guidePic);
await shot('desk_en_guide');
await clickSel('.modal [data-play="piece"]'); await settle(2600);
L = await listenState();
ok('the guide button opens the example and plays it', !(await ev(`!!document.querySelector('.modal-bg')`)) && (await ev(`document.querySelector('#examplesBtn .exlabel').textContent`)) === NAME.en && L && L.piece && L.notes === NOTES, L);
await sleep(300);
await key('Escape'); await settle(200);
R.errorsEnLight = errs();
ok('en light: no console errors', R.errorsEnLight.length === 0, R.errorsEnLight);

// ---------------------------------------------------------------- desktop, English, dark
await view(1440, 900, true, false); await settle(800);
await shot('desk_en_dark');

// ---------------------------------------------------------------- desktop, Russian
await open('ru', false, false, 'sea_ru');
await openExample('ru');
ok('ru: the Examples button names it', (await ev(`document.querySelector('#examplesBtn .exlabel').textContent`)) === NAME.ru);
await shot('desk_ru_light');
p = await curveXY(300);
await rclick(p[0], p[1]);
items = await menuItems();
R.menuRu = items && items.map((x) => x.text);
ok('ru: Слушать вдоль кривой «Спираль»', !!items && items.some((x) => x.id === 'listen' && x.text === 'Слушать вдоль кривой «Спираль»'), items);
await shot('desk_ru_menu');
await key('Escape'); await settle(200);
await ev(`Sound.set({ on: false }); 1`); await settle(200);
await rclick(p[0], p[1]);
xy = await pickXY('listen'); if (xy) await click(xy[0], xy[1]); await settle(300);
R.toastRu = await ev(`__qa.toasts()`);
ok('ru: the sound-off toast in Russian', R.toastRu.length === 1 && /Звук выключен/.test(R.toastRu[0]) && /Включить и слушать/.test(R.toastRu[0]), R.toastRu);
await key('Escape'); await settle(200);
await ev(`__cmwExample(0); 1`); await settle(600);
await key('?'); await settle(500);
R.guideRu = await ev(`(() => { const b = document.querySelector('.modal [data-play="piece"]'); const p = b && b.closest('p').previousElementSibling; return b ? { btn: b.textContent, para: p ? p.textContent.slice(0, 80) : '' } : null; })()`);
ok('ru: the guide paragraph and button in Russian', !!R.guideRu && /Кривая как мелодия/.test(R.guideRu.para) && /^Открыть и\u00a0сыграть «В\u00a0пещере горного короля»$/.test(R.guideRu.btn), R.guideRu);
R.guideRuText = await ev(`(() => { const p = document.querySelector('.modal [data-play="piece"]').closest('p').previousElementSibling; return { quoted: /«В\u00a0пещере горного короля»/.test(p.textContent), i: [...p.querySelectorAll('i')].map((e) => e.textContent), on: /которую он/.test(p.textContent), own: /собственные струны/.test(p.textContent) }; })()`);
ok('ru: the title in «ёлочки», not italic; no ambiguous «он» (ui-5, ui-6)', R.guideRuText.quoted && !R.guideRuText.i.some((t) => /пещере/.test(t)) && !R.guideRuText.on && R.guideRuText.own, R.guideRuText);
await ev(`document.querySelector('.modal [data-play="piece"]').scrollIntoView({ block: 'center' }); 1`); await settle(200);
await shot('desk_ru_guide');
await key('Escape'); await settle(200);
R.errorsRu = errs();
ok('ru: no console errors', R.errorsRu.length === 0, R.errorsRu);

// ---------------------------------------------------------------- phone emulation (412 × 915), English light and dark, Russian dark
for (const [lang, dark] of [['en', false], ['en', true], ['ru', true]]) {
  const tag = `phone_${lang}_${dark ? 'dark' : 'light'}`;
  await open(lang, dark, true, 'sea_' + tag);
  await ev(`__cmwExample(${EXI}); 1`); await settle(2500);
  iv = await inView();
  R[tag + '_view'] = iv;
  ok(`${tag}: the whole spiral in the plane`, iv.curve[0] >= iv.plane[0] && iv.curve[2] <= iv.plane[2] && iv.curve[1] > iv.plane[1] && iv.curve[3] < iv.plane[3], iv);
  ok(`${tag}: Phase view`, (await ev('__cmwState().view.main')) === 'phase');
  await shot(tag);
  p = await curveXY(300);
  await hold(p[0], p[1], 700);
  items = await menuItems();
  ok(`${tag}: the long-press menu has Listen along`, !!items && items.some((x) => x.id === 'listen'), items);
  if (lang === 'en' && !dark) await shot(tag + '_menu');
  xy = await pickXY('listen');
  if (xy) await touch(xy[0], xy[1]);
  await settle(400);
  L = await listenState();
  ok(`${tag}: the long-press menu plays the melody`, L && L.notes === NOTES && L.piece, L);
  R['frames_' + tag] = await frames(3000);
  ok(`${tag}: 60 fps while it plays (p95 under 20 ms)`, R['frames_' + tag].p95 < 20, R['frames_' + tag]);
  if (lang === 'en' && !dark) await shot(tag + '_playing');
  await key('Escape'); await settle(200);
  R['errors_' + tag] = errs();
  ok(`${tag}: no console errors`, R['errors_' + tag].length === 0, R['errors_' + tag]);
}
await view(1440, 900, false, false);
return { pass: fails.length === 0, fails, R };
