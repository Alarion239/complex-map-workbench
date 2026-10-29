// The Mountain King in the app (notes/sea-song/FUNCTION.md): the example "In the Hall of the Mountain King" is an
// ordinary example, a function F = H(u(z)) whose Listen along on the unit circle plays Grieg's theme by the sound's
// fixed map (src/seasong.js, tools/mk_function.js). In English and Russian, desktop (light, dark) and phone emulation:
//  * the gallery lists it with its thumbnail; it opens on the Phase view, Plain, the whole circle in the plane;
//  * the circle's menu (right-click; a long press on the phone) has Listen along and no "Play the composition" (the
//    example has no score); Listen along first prepares its samples (F is costly: X's chip says "Preparing to listen
//    along: N %", with Stop), then plays the function itself: the notes, 344 of them, no repeats (|F| is constant on
//    the circle), 4 cracks, at 250 px/s of X's view (4π·s/250 s);
//  * the samples are kept: a second Listen along plays at once; Esc, L and the menu's Stop listening drop a
//    preparation; another example or the circle deleted stop it; the L key (the keyboard probe) plays it;
//  * the guide's paragraph and its button "Open and play" (the composition's way in, sndPlayPiece) open the example
//    and play the function; with sound off its toast says how to turn it on, and does;
//  * frame times while it prepares (recorded) and while it plays; no console errors.
// A command file for the CDP daemon (test/cdp_kit README):
//   python3 build.py && node test/<you>_cdp/cdpd.js &   node test/<you>_cdp/q.js test/seasong_cmd.js
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 300) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const errs = () => logs().filter((l) => /^(EXC|error|log-error)$/.test(l.t) && !/favicon|404/.test(l.m));
const NAME = { en: 'In the Hall of the Mountain King', ru: 'В пещере горного короля' };
// the Russian table (src/i18n_ru.js), for the strings the Russian pages show
const RU = {};
{ const src = fs.readFileSync(path.join(DIR, '..', '..', 'src', 'i18n_ru.js'), 'utf8'); new Function('I18N', src)({ define: (l, s) => Object.assign(RU, typeof s === 'string' ? JSON.parse(s) : s) }); }
const ru = (k) => RU[k] || k;
const strip = (s) => s.replace(/<[^>]+>/g, '');
// what F gives along the circle through the sound's map (t_seasong.js, the cmw-render comparison in the PR): 344
// notes (each colour line between two theme pitches is a note), no repeats, a crack a statement
const COUNTS = { notes: 344, reps: 0, cracks: 4 };
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
// a point of the circle on screen (index k of its stored points)
const curveXY = (k) => ev(`(() => { const p = SEASONG.pts[${k}]; return __cmwW2S('L', p[0], p[1]); })()`);
// X's scale (px a unit) and the playback's expected length: two laps of the unit circle at 250 px/s
const pxPerUnit = () => ev(`(() => { const a = __cmwW2S('L', 0, 0), b = __cmwW2S('L', 1, 0); return Math.hypot(b[0] - a[0], b[1] - a[1]); })()`);
const durAt = (s) => Math.min(30, Math.max(1, 4 * Math.PI * s / 250));
// the circle on screen: every point inside the plane; the stored points inside the style bar's box
const inView = () => ev(`(() => {
  const cv = document.querySelector('canvas.overlay[aria-keyshortcuts], .plot > canvas.overlay'); const r = cv.getBoundingClientRect();
  const bar = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Plain' || b.textContent.trim() === 'Фаза' || b.dataset.dc === 'phase');
  const br = bar && bar.getClientRects().length ? bar.parentElement.getBoundingClientRect() : null;
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const p of SEASONG.pts) { const [x, y] = __cmwW2S('L', p[0], p[1]); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const under = br ? SEASONG.pts.filter((p) => { const [x, y] = __cmwW2S('L', p[0], p[1]); return x >= br.left && x <= br.right && y >= br.top && y <= br.bottom; }).length : 0;
  return { plane: [r.left, r.top, r.right, r.bottom].map(Math.round), curve: [x0, y0, x1, y1].map(Math.round), bar: br ? [br.left, br.top, br.right, br.bottom].map(Math.round) : null, under };
})()`);
// the playback (the function's: listenFn), X's chip and its Stop button, the live region
const state = () => ev(`(() => { const s = __cmwSound(), c = document.getElementById('sphereChipL'); return { play: s.play, fn: s.listenFn, chip: c && !c.hidden ? c.firstChild.textContent : '', stop: !!(c && !c.hidden && c.querySelector('.chip-stop')), live: s.live }; })()`);
// (the first preparation is the costly-F path: Listen along samples F at once when that takes under 60 ms, and on a
// fast machine the first preparation is over before the chip is read twice. It runs with the page's CPU slowed 6×
// (CDP), so it counts up on every machine; the frame-rate checks run at full speed)
const slow = (on) => send('Emulation.setCPUThrottlingRate', { rate: on ? 6 : 1 });
const frames = (ms) => ev(`await __qa.frames(${ms})`);   // (a top-level await: the daemon's replMode returns {} for a bare promise)
// from a Listen along's start: the preparation (the chip's percentages seen) until it plays (up to maxS seconds)
async function waitPlay(maxS = 40) {
  const t0 = Date.now(), seen = [];
  let s = null;
  while (Date.now() - t0 < maxS * 1000) {
    s = await state();
    if (s.play) break;
    const m = /(\d+)\s?%/.exec(s.chip || '');
    if (m && seen[seen.length - 1] !== +m[1]) seen.push(+m[1]);
    if (!m && !s.chip && seen.length && Date.now() - t0 > 1500) break;   // (dropped)
    await sleep(150);
  }
  return { ms: Date.now() - t0, seen, s };
}
const playsFn = (s, dur) => !!s && s.play && !!s.fn && s.fn.mode === 'notes' && !!s.fn.counts && s.fn.counts.notes === COUNTS.notes
  && s.fn.counts.reps === COUNTS.reps && s.fn.counts.cracks === COUNTS.cracks && (dur == null || Math.abs(s.fn.dur - dur) < 0.02);

// open the app in a language, theme and size; sound on (Interface off: the menu clicks stay quiet) after a gesture
async function open(lang, dark, phone, ns) {
  await view(phone ? 412 : 1440, phone ? 915 : 900, dark, phone);
  await nav(`${U}?ns=${ns}${Date.now()}${lang === 'ru' ? '&lang=ru' : ''}`);
  await settle(900);
  if (phone) await touch(200, 12); else await click(700, 12);
  await ev(`Sound.set({ on: true, vol: 0.7, ui: false, events: true, sonify: false }, { quiet: true }); await new Promise((r) => setTimeout(r, 500)); 1`);
}
// the example's index (the gallery's order) and opening it as a user does
async function openExample(lang) {
  await clickSel('#examplesBtn'); await settle(500);
  const it = await ev(`(() => { const its = [...document.querySelectorAll('#popHost .examples .ex-item')]; const i = its.findIndex((b) => b.querySelector('.ex-name').textContent === ${JSON.stringify(NAME[lang])}); if (i < 0) return null; its[i].scrollIntoView({ block: 'nearest' }); const q = its[i].getBoundingClientRect(); const bl = its[i].querySelector('.ex-blurb'); return { i, xy: [q.left + q.width / 2, q.top + q.height / 2], title: its[i].title, blurb: bl.textContent, cut: bl.scrollWidth > bl.clientWidth + 1 }; })()`);
  ok(`${lang}: the gallery lists the example`, !!it, it);
  if (!it) return -1;
  R[lang + 'Blurb'] = it.blurb;
  ok(`${lang}: its tooltip is the whole description where the line is cut, none otherwise`, (it.cut ? it.title === it.blurb : !it.title) && it.blurb.length > 60, it);
  ok(`${lang}: the description says it is played by a function`, lang === 'en' ? /^Edvard Grieg, Peer Gynt \(1875\), played by a function\./.test(it.blurb) : /^Эдвард Григ/.test(it.blurb) && it.blurb !== it.blurb.replace(/[а-я]/g, ''), it.blurb);
  // (the gallery draws its thumbnails one at a time: up to 30 s for this one where frames are slow)
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
// Listen along from the circle's menu (desktop: right-click; phone: a long press)
async function listenMenu(phone) {
  const c = await curveXY(300);
  if (phone) await hold(c[0], c[1], 700); else await rclick(c[0], c[1]);
  const items = await menuItems();
  const b = await pickXY('listen');
  if (b) { if (phone) await touch(b[0], b[1]); else await click(b[0], b[1]); }
  await settle(150);
  return items;
}

// ---------------------------------------------------------------- desktop, English, light
await open('en', false, false, 'sea_en');
const EXI = await openExample('en');
R.exIndex = EXI;
const st = await ev('__cmwState()');
ok('en: Phase view, Plain', st.view.main === 'phase' && st.dc === 'phase', { main: st.view.main, dc: st.dc });
ok('en: the Examples button names it', (await ev(`document.querySelector('#examplesBtn .exlabel').textContent`)) === NAME.en);
let iv = await inView();
R.desktopView = iv;
ok('desktop: the whole circle in the plane', iv.curve[0] > iv.plane[0] && iv.curve[2] < iv.plane[2] && iv.curve[1] > iv.plane[1] && iv.curve[3] < iv.plane[3], iv);
await shot('desk_en_light');
// the laptop and tablet sizes: the example opened at each, the whole circle in the plane, no stored point under the
// style bar
R.sizes = {};
for (const [w, h] of [[1366, 768], [1280, 720], [1024, 768], [768, 1024]]) {
  await view(w, h, false, false); await settle(500);
  await ev(`__cmwExample(${EXI}); 1`); await settle(900);
  const v = await inView();
  R.sizes[w + 'x' + h] = v;
  ok(`desktop ${w}×${h}: the whole circle in the plane, no point under the style bar`, v.curve[0] > v.plane[0] && v.curve[2] < v.plane[2] && v.curve[1] > v.plane[1] && v.curve[3] < v.plane[3] && v.under === 0, v);
}
await view(1440, 900, false, false); await settle(500);
await ev(`__cmwExample(${EXI}); 1`); await settle(1200);
const S0 = await pxPerUnit(), DUR0 = durAt(S0);
R.pxPerUnit = S0; R.durExpected = DUR0;
// the circle's menu: Listen along, and no "Play the composition" (no score: the function is the music)
await slow(true);
let items = await listenMenu(false);
R.menuEn = items && items.map((x) => x.text);
ok('en: the circle menu has Listen along Circle', !!items && items.some((x) => x.id === 'listen' && x.text === 'Listen along Circle'), items);
ok('en: no "Play the composition" item (the example has no score)', !!items && !items.some((x) => /composition/i.test(x.text)), items);
// the preparation: X's chip counts the share prepared, with Stop; the live region says it once
let s0 = await state();
R.prepFirst = s0;
ok('Listen along first prepares: X\'s chip says "Preparing to listen along: N %" with Stop', !s0.play && /^Preparing to listen along: \d+ %$/.test(s0.chip) && s0.stop, s0);
ok('the live region says F takes a moment', /Preparing to listen along: F takes a moment here\./.test(s0.live), s0.live);
await shot('desk_en_preparing');
R.framesPrep = await frames(1500);   // (recorded: the samples are made in 12 ms slices between frames)
let wp = await waitPlay(40);
await slow(false);
R.prep = { ms: wp.ms, seen: wp.seen };
ok('the preparation counts up, then the function plays', wp.seen.length >= 2 && wp.seen.every((v, i) => !i || v >= wp.seen[i - 1]) && !!wp.s.play, R.prep);
ok(`it plays the function: ${COUNTS.notes} notes, no repeats, ${COUNTS.cracks} cracks, 4π·s/250 s`, playsFn(wp.s, DUR0), { s: wp.s, DUR0 });
ok('X\'s chip: Listening along Circle, with Stop', wp.s.chip === 'Listening along Circle' && wp.s.stop, wp.s.chip);
R.framesDesk = await frames(3000);
ok('desktop: 60 fps while it plays (p95 under 20 ms)', R.framesDesk.p95 < 20, R.framesDesk);
await shot('desk_en_playing');
await key('Escape'); await settle(200);
ok('Esc stops it', !(await state()).play);
// the samples are kept: Listen along again plays at once
items = await listenMenu(false);
s0 = await state();
R.again = s0;
ok('Listen along again plays at once (the samples were kept)', playsFn(s0, DUR0) && !/Preparing/.test(s0.chip), s0);
await key('Escape'); await settle(200);
// a new size: new samples (250 px/s of the new view). The menu's Stop listening, then Esc, drop the preparation
await view(1366, 768, false, false); await settle(800);
const S1 = await pxPerUnit(), DUR1 = durAt(S1);
items = await listenMenu(false);
s0 = await state();
// (the samples for this view: when its scale is another, the speed and the samples' key are too, and it prepares, or
// plays at once when the new samples are ready within the sampler's first 60 ms, as they can be once F's code is
// warm; when the scale is the same, as at 1440×900 and 1366×768 with the circle fitted to the plane's height, the kept
// samples play at once. Either way it plays this view's duration, DUR1)
const fresh = (s, dur) => (!s.play && /^Preparing to listen along: \d+ %$/.test(s.chip)) || playsFn(s, dur);
ok('1366×768: this view\'s samples: it prepares, or plays DUR1 at once', fresh(s0, DUR1), { s0, S1, DUR0, DUR1 });
let c = await curveXY(300);
await rclick(c[0], c[1]);
items = await menuItems();
ok('while it prepares the menu says Stop listening', !!items && items.some((x) => x.id === 'listen' && x.text === 'Stop listening'), items);
const xy0 = await pickXY('listen'); if (xy0) await click(xy0[0], xy0[1]);
await settle(400);
s0 = await state();
ok('Stop listening drops the preparation', !s0.play && !s0.chip, s0);
await sleep(1500);
ok('… and nothing plays later', !(await state()).play);
items = await listenMenu(false);
await sleep(600);
await key('Escape'); await settle(300);
s0 = await state();
await sleep(1500);
ok('Esc drops the preparation, nothing plays later', !s0.play && !s0.chip && !(await state()).play, s0);
// the L key (the keyboard probe: the X plane focused from the keyboard) prepares and plays; L again stops it
await ev(`document.activeElement && document.activeElement.blur && document.activeElement.blur(); 1`);
await sleep(400);
R.kbdFocus = await ev(`(() => { const c = document.querySelector('canvas.overlay[aria-keyshortcuts]'); c.focus(); return document.activeElement === c; })()`);
await settle(100);
await key('l'); await settle(300);
s0 = await state();
ok('the L key starts it (preparing, or playing DUR1 at once)', /^Preparing to listen along/.test(s0.chip) || fresh(s0, DUR1), s0);
wp = await waitPlay(40);
ok('the L key plays the function', playsFn(wp.s, DUR1), { s: wp.s, DUR1 });
await key('l'); await settle(200);
ok('L again stops it', !(await state()).play);
await ev('document.activeElement && document.activeElement.blur && document.activeElement.blur(); 1');
await view(1440, 900, false, false); await settle(800);
// what it plays changed: another example opened, the circle deleted (also while it prepares)
await listenMenu(false);
wp = await waitPlay(5);
ok('ui-1: it plays (1440×900: its kept samples)', playsFn(wp.s, DUR0), wp.s);
await ev(`__cmwExample(0); 1`); await settle(400);
R.otherExample = await state();
ok('ui-1: opening another example stops it', !R.otherExample.play && !R.otherExample.chip, R.otherExample);
await ev(`__cmwExample(${EXI}); 1`); await settle(1500);
await listenMenu(false);
wp = await waitPlay(40);
ok('ui-1: it plays again', playsFn(wp.s, DUR0), wp.s);
c = await curveXY(300);
await click(c[0], c[1]); await settle(250);   // (selects the circle; the click does not stop it)
R.selBeforeDelete = await ev(`({ play: __cmwSound().play, selected: __cmwShapes().selected })`);
await key('Delete'); await settle(400);
for (let i = 0; i < 50 && (await ev('__cmwSound().play')); i++) await sleep(200);
R.deleted = await state();
ok('ui-1: deleting the circle stops it', R.selBeforeDelete.play && !R.deleted.play && !R.deleted.chip, { before: R.selBeforeDelete, after: R.deleted });
await key('z', 2); await settle(600);   // Ctrl+Z (undo: Ctrl or ⌘)
// the guide: the paragraph and its button (the composition's way in: opens the example and plays the function)
await ev(`__cmwExample(0); 1`); await settle(800);
await key('?'); await settle(500);
const g = await ev(`(() => { const b = document.querySelector('.modal [data-play="piece"]'); const p = b && b.closest('p').previousElementSibling; return b ? { btn: b.textContent, para: p ? p.textContent : '' } : null; })()`);
R.guideEn = g && { btn: g.btn, para: g.para.slice(0, 120) };
ok('the guide has the melody paragraph and its button', !!g && /^A curve as a melody\./.test(g.para) && /is a function/.test(g.para) && /^Open and play “In the Hall of the Mountain King”$/.test(g.btn), R.guideEn);
ok('the guide: the paragraph names no harp or score', !!g && !/harp|strings|score/i.test(g.para), R.guideEn);
await ev(`document.querySelector('.modal [data-play="piece"]').scrollIntoView({ block: 'center' }); 1`); await settle(1500);
R.guidePic = await ev(`(() => { const im = document.querySelector('.modal img.guide-piece'); return im ? { src: (im.src || '').slice(0, 22), w: im.naturalWidth } : null; })()`);
ok('the guide shows the example\'s picture beside its button', !!R.guidePic && /^data:image\/png/.test(R.guidePic.src) && R.guidePic.w > 0, R.guidePic);
await shot('desk_en_guide');
await clickSel('.modal [data-play="piece"]'); await settle(600);
wp = await waitPlay(40);
ok('the guide button opens the example and plays the function', !(await ev(`!!document.querySelector('.modal-bg')`)) && (await ev(`document.querySelector('#examplesBtn .exlabel').textContent`)) === NAME.en && playsFn(wp.s, DUR0), wp.s);
await key('Escape'); await settle(200);
// sound off: the circle's menu (no score) and the guide's button, whose toast turns sound on and plays
await ev(`Sound.set({ on: false }); 1`); await settle(200);
c = await curveXY(300);
await rclick(c[0], c[1]);
items = await menuItems();
R.menuSoundOff = items && items.map((x) => x.text);   // (recorded: the item needs sound on where there is no score)
await key('Escape'); await settle(200);
await ev(`__cmwExample(0); 1`); await settle(600);
await key('?'); await settle(500);
// (the button is below the guide's fold at 1440×900: brought into view, as above, so the click reaches it)
await ev(`document.querySelector('.modal [data-play="piece"]').scrollIntoView({ block: 'center' }); 1`); await settle(300);
await clickSel('.modal [data-play="piece"]'); await settle(900);
const toastEn = await ev(`__qa.toasts()`);
R.toastOff = toastEn;
ok('sound off: the guide button\'s toast says how to turn it on', toastEn.length === 1 && /Sound is off/.test(toastEn[0]) && /Turn on and listen/.test(toastEn[0]), toastEn);
await shot('desk_en_soundoff');
await clickSel('#toastHost .toast-act'); await settle(600);
wp = await waitPlay(40);
ok('its button turns sound on and plays the function', (await ev('Sound.prefs().on')) && playsFn(wp.s, DUR0), wp.s);
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
items = await listenMenu(false);
R.menuRu = items && items.map((x) => x.text);
const circRu = ru('Circle');
ok('ru: the circle menu says Listen along in Russian', !!items && items.some((x) => x.id === 'listen' && x.text === ru('Listen along {name}').replace('{name}', circRu)), { items, want: ru('Listen along {name}'), circRu });
ok('ru: no "Play the composition" item', !!items && !items.some((x) => x.text === ru('Play the composition (Grieg, arranged on this curve)')), items);
s0 = await state();
R.prepRu = s0;
const prepRe = new RegExp('^' + ru('Preparing to listen along: {p} %').replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('\\{p\\}', '\\d+') + '$');
ok('ru: the preparation chip in Russian', !s0.play && prepRe.test(s0.chip), { chip: s0.chip, want: ru('Preparing to listen along: {p} %') });
await shot('desk_ru_preparing');
wp = await waitPlay(40);
ok('ru: it plays the function', playsFn(wp.s), wp.s);
await key('Escape'); await settle(200);
await ev(`Sound.set({ on: false }); 1`); await settle(200);
await ev(`__cmwExample(0); 1`); await settle(600);
await key('?'); await settle(500);
R.guideRu = await ev(`(() => { const b = document.querySelector('.modal [data-play="piece"]'); const p = b && b.closest('p').previousElementSibling; return b ? { btn: b.textContent, para: p ? p.textContent : '' } : null; })()`);
const paraKey = Object.keys(RU).find((k) => k.startsWith('<b>A curve as a melody.</b>'));
const paraRu = paraKey ? strip(RU[paraKey]).replace(/&nbsp;/g, ' ') : '';
ok('ru: the guide paragraph and button in Russian', !!R.guideRu && !!paraKey && R.guideRu.para.slice(0, 40) === paraRu.slice(0, 40) && R.guideRu.btn === ru('Open and play “In the Hall of the Mountain King”'),
  { got: R.guideRu && { btn: R.guideRu.btn, para: R.guideRu.para.slice(0, 60) }, want: paraRu.slice(0, 60) });
await ev(`document.querySelector('.modal [data-play="piece"]').scrollIntoView({ block: 'center' }); 1`); await settle(200);
await shot('desk_ru_guide');
await clickSel('.modal [data-play="piece"]'); await settle(900);
R.toastRu = await ev(`__qa.toasts()`);
ok('ru: the sound-off toast in Russian', R.toastRu.length === 1 && /Звук выключен/.test(R.toastRu[0]) && R.toastRu[0].includes(ru('Turn on and listen')), R.toastRu);
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
  ok(`${tag}: the whole circle in the plane`, iv.curve[0] >= iv.plane[0] && iv.curve[2] <= iv.plane[2] && iv.curve[1] > iv.plane[1] && iv.curve[3] < iv.plane[3], iv);
  ok(`${tag}: Phase view`, (await ev('__cmwState().view.main')) === 'phase');
  await shot(tag);
  const sP = await pxPerUnit();
  items = await listenMenu(true);
  ok(`${tag}: the long-press menu has Listen along`, !!items && items.some((x) => x.id === 'listen'), items);
  if (lang === 'en' && !dark) await shot(tag + '_preparing');
  wp = await waitPlay(60);
  R['prep_' + tag] = { ms: wp.ms, seen: wp.seen.length };
  ok(`${tag}: the long-press menu prepares and plays the function`, playsFn(wp.s, durAt(sP)), { s: wp.s, dur: durAt(sP) });
  R['frames_' + tag] = await frames(3000);
  ok(`${tag}: 60 fps while it plays (p95 under 20 ms)`, R['frames_' + tag].p95 < 20, R['frames_' + tag]);
  if (lang === 'en' && !dark) await shot(tag + '_playing');
  await key('Escape'); await settle(200);
  R['errors_' + tag] = errs();
  ok(`${tag}: no console errors`, R['errors_' + tag].length === 0, R['errors_' + tag]);
}
await view(1440, 900, false, false);
return { pass: fails.length === 0, fails, R };
