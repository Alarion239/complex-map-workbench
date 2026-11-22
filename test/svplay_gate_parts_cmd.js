// The Play gate's 10 s message says what is missing (#1953): after "Still preparing the glide" it names the first part of
// svReady() not done, in a fixed order: the programs, the colour's first draw, the pole tracks, the paths' outer part (the ring),
// the meshes, the left pane's frame. One sentence per part (each language puts its words in its own order), in English, Russian and Italian,
// in words the page's other texts use (no "ring" or "mesh" in the user's words).
// Rows:
// - each part held (the links for the programs: ?glhold; the others: the test hook holdJobs, a list of part names) has
//   the gate's first missing part (__cmwGateMissing) naming it, and the message after 10 s is that part's sentence (English, through the real wait);
// - several held: the first in the order is named (the programs before the jobs; the pole tracks before the ring before the meshes);
// - nothing named (no part missing): the message is the old sentence;
// - the sentences of the three languages are the strings below, through the page's translation (the test hook __cmwGateStill);
// - at 360 px, for each language, the longest sentence keeps the message two rows tall (the words, then Retry, Cancel and the
//   close button), inside the viewport;
// - at 1280, 1024 and 560 px, for each language, with the links held (the left plane draws its "Compiling…" note): Retry, Cancel and the
//   close button are on one row (none alone on a row of its own), and the note is not drawn while the message is up;
// - on a phone in portrait (360 and 412 px), with the links held: the message covers no key of the left plane.
// A command file for a CDP daemon:  <runner> test/svplay_gate_parts_cmd.js
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const ns = 'svp' + Date.now();
// (the sentence before this change, now the fallback)
const OLD = { en: 'Still preparing the glide.', ru: 'Переход всё ещё готовится.', it: 'Preparazione del passaggio ancora in corso.' };
const PARTS = ['programs', 'warm', 'poles', 'ring', 'meshes', 'redraw'];
// the sentences, as the page must say them
const TEXT = {
  en: {
    programs: 'Still preparing the glide: the drawing programs are not ready yet.',
    warm: 'Still preparing the glide: the colour is not drawn yet.',
    poles: 'Still preparing the glide: the paths of the poles are not computed yet.',
    ring: 'Still preparing the glide: the outer part of the plane is not computed yet.',
    meshes: 'Still preparing the glide: the regions are not meshed yet.',
    redraw: 'Still preparing the glide: the first frame is not drawn yet.',
  },
  ru: {
    programs: 'Переход всё ещё готовится: программы отрисовки ещё не готовы.',
    warm: 'Переход всё ещё готовится: цвет ещё не нарисован.',
    poles: 'Переход всё ещё готовится: пути полюсов ещё не вычислены.',
    ring: 'Переход всё ещё готовится: внешняя часть плоскости ещё не вычислена.',
    meshes: 'Переход всё ещё готовится: области ещё не триангулированы.',
    redraw: 'Переход всё ещё готовится: первый кадр ещё не нарисован.',
  },
  it: {
    programs: 'Preparazione del passaggio ancora in corso: i programmi di disegno non sono ancora pronti.',
    warm: 'Preparazione del passaggio ancora in corso: il colore non è ancora disegnato.',
    poles: 'Preparazione del passaggio ancora in corso: i percorsi dei poli non sono ancora calcolati.',
    ring: 'Preparazione del passaggio ancora in corso: la parte esterna del piano non è ancora calcolata.',
    meshes: 'Preparazione del passaggio ancora in corso: le regioni non sono ancora triangolate.',
    redraw: 'Preparazione del passaggio ancora in corso: il primo fotogramma non è ancora disegnato.',
  },
};
// (the toast's most at 360 px, as test/svplay_gate_cmd.js measures it: its padding and 1 px border either side, the words on two lines of 18 px, one row of 44 px buttons)
const GATE_TOAST_PAD = 12, GATE_TOAST_BORDER = 2, GATE_TOAST_WORDS_MAX = 2 * 18, GATE_TOAST_BUTTON_ROW = 44, HANG_WAIT_MS = 14000, ROW_EDGE_PX = 1, ROW_SPREAD_PX = 4, STILL_MS = 100, STILL_TRIES = 40;
const MSG = '#toastHost .toast';
const esc = () => ev('(document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })), 1)');

// the example's steps view, the links held (programs not done) or not
async function open(w, h, lang, hold, mobile = false) {
  await view(w, h, false, mobile);
  await load(ns, {});
  await ev('(__cmwExample(1), 1)');
  const o = await ev('location.origin');
  await nav(`${o}/test.html?ns=${ns}${hold ? '&glhold' : ''}&view=steps&lang=${lang}`);
  await settled({ max: 30000, only: true, until: 'typeof __cmwSteps === "function" && typeof GLR === "object" && GLR.ok && __cmwSteps().on' });
  await ev('(__cmwSteps({ go: 0, now: true }), 1)');
  await settled({ max: hold ? 30000 : 60000, only: true, until: hold ? '__cmwSteps().ready.total > 0' : '__cmwSteps().ready.ready === true' });
}
// press Play, wait for the 10 s message, read it, end the wait; the page's list of held parts first
async function hung(holdJobs) {
  await ev(`(__cmwSteps({ holdJobs: ${JSON.stringify(holdJobs)} }), 1)`);
  const missing = await ev('__cmwGateMissing()');
  // (with the links held the left plane draws its "Compiling…" note once it has compiled for 300 ms: it is there before the message)
  const PILL = 'typeof __cmwCompileBox === "function" && !!__cmwCompileBox()';
  let pillBefore = await ev(PILL);
  for (let i = 0; holdJobs === true && !pillBefore && i < 40; i++) { await sleep(200); pillBefore = await ev(PILL); }
  await ev('(__cmwSteps({ play: true }), 1)');
  await settled({ max: HANG_WAIT_MS, only: true, until: `!!document.querySelector("${MSG}")` });
  // (the message picks its rows on the frame after it is made, and may be placed again after: read once its box has held still for two reads)
  const BOX = `(() => { const r = document.querySelector('${MSG}').getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(Math.round).join(); })()`;
  for (let i = 0, last = ''; i < STILL_TRIES; i++) { const b = await ev(BOX); if (b === last) break; last = b; await sleep(STILL_MS); }
  const g = await ev(`(() => { const t = document.querySelector('${MSG}'), r = t.getBoundingClientRect(), w = t.querySelector('span').getBoundingClientRect(); const tops = [...t.querySelectorAll('button')].map((b) => Math.round(b.getBoundingClientRect().top)); return { text: t.querySelector('span').textContent, top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), wordsBottom: Math.round(w.bottom), tops: [...new Set(tops)], vw: innerWidth, vh: innerHeight, pill: (() => { const b = typeof __cmwCompileBox === 'function' ? __cmwCompileBox() : null, c = document.getElementById('canvasL').getBoundingClientRect(); return b && { left: Math.round(c.left + b.x), right: Math.round(c.left + b.x + b.w), top: Math.round(c.top + b.y), bottom: Math.round(c.top + b.y + b.h) }; })() }; })()`);
  // (the left plane's key column: Fit view and the view stack around it, where a message must not stand)
  g.keys = await ev(`[...document.querySelectorAll('#leftFit, .pane:not(.ph-inset) .viewstack')].filter((e) => e.getClientRects().length).map((e) => { const b = e.getBoundingClientRect(); return { id: e.id || e.className, left: Math.round(b.left), right: Math.round(b.right), top: Math.round(b.top), bottom: Math.round(b.bottom) }; })`);
  g.pillBefore = pillBefore;
  await ev('(__cmwSteps({ play: false }), 1)');
  await esc();
  await settled({ max: 5000, only: true, until: `!document.querySelector("${MSG}")` });
  return Object.assign(g, { missing });
}

// 1. each part named, in English through the real wait
await open(1440, 900, 'en', false);
for (const part of PARTS.slice(1)) {
  const g = await hung([part]);
  info['held_' + part] = g;
  ok(`${part} held: the first missing part is ${part}`, g.missing === part, g);
  ok(`${part} held: the 10 s message is ${part}'s sentence`, g.text === TEXT.en[part], g);
}
// several held: the first in the order
for (const [held, first] of [[['meshes', 'ring'], 'ring'], [['meshes', 'ring', 'poles'], 'poles'], [['redraw', 'meshes'], 'meshes'], [['redraw', 'meshes', 'warm'], 'warm'], [true, 'poles']]) {
  const g = await hung(held);
  info['order_' + JSON.stringify(held)] = g;
  ok(`${JSON.stringify(held)} held: ${first} is named first`, g.missing === first && g.text === TEXT.en[first], g);
}
// the links held: the programs, before every job
await open(1440, 900, 'en', true);
{
  const g = await hung(true);
  info.held_programs = g;
  ok('the links held: the first missing part is programs, before the held jobs', g.missing === 'programs', g);
  ok('the links held: the 10 s message is the programs\' sentence', g.text === TEXT.en.programs, g);
}

// 2. the sentences of the three languages, through the page's translation; nothing named: the old sentence
for (const lang of ['en', 'ru', 'it']) {
  await open(1440, 900, lang, false);
  const got = await ev(`(() => { const o = {}; for (const p of ${JSON.stringify(PARTS)}) o[p] = __cmwGateStill(p); o.none = __cmwGateStill(null); return o; })()`);
  info['text_' + lang] = got;
  for (const part of PARTS) ok(`${lang}: the sentence for ${part}`, got[part] === TEXT[lang][part], { got: got[part], want: TEXT[lang][part] });
  ok(`${lang}: no part named, the old sentence`, got.none === OLD[lang], got.none);
}

// 3. 360 px, each language: the longest sentence, the message two rows tall inside the viewport
for (const lang of ['en', 'ru', 'it']) {
  const longest = PARTS.reduce((a, b) => (TEXT[lang][b].length > TEXT[lang][a].length ? b : a));
  // (the programs are held by the links, the others by the list)
  await open(360, 780, lang, longest === 'programs');
  const g = await hung(longest === 'programs' ? true : [longest]);
  info['narrow_' + lang] = g;
  ok(`narrow ${lang}: the longest sentence (${longest}) is the message`, g.text === TEXT[lang][longest], g);
  ok(`narrow ${lang}: the buttons are on one row, below the words`, g.tops.length === 1 && g.tops[0] >= g.wordsBottom - ROW_EDGE_PX, g);
  ok(`narrow ${lang}: the message is two rows (words, buttons) and inside the viewport`, g.bottom - g.top <= GATE_TOAST_PAD + GATE_TOAST_BORDER + GATE_TOAST_WORDS_MAX + GATE_TOAST_BUTTON_ROW && g.left >= 0 && g.right <= g.vw && g.bottom <= g.vh, g);
}

// 4. desktop widths, each language, the links held (the left plane draws its "Compiling…" note): the buttons stay together (Retry, Cancel and
// the close button on one row: none alone on a row of its own), and the "Compiling…" note, which the message's own words make
// redundant, is not drawn under or beside it
const DESK = [[1280, 800], [1024, 768], [560, 800]];
for (const [w, h] of DESK) {
  for (const lang of ['en', 'ru', 'it']) {
    await open(w, h, lang, true);
    const g = await hung(true);
    info[`desk_${w}_${lang}`] = g;
    ok(`${w} px ${lang}: the "Compiling…" note was drawn before the message (control)`, g.pillBefore === true, g);
    // (the close button is smaller than the others and centred on the row: its top is a pixel or two lower)
    ok(`${w} px ${lang}: Retry, Cancel and the close button are on one row`, Math.max(...g.tops) - Math.min(...g.tops) <= ROW_SPREAD_PX, g);
    ok(`${w} px ${lang}: the "Compiling…" note is not drawn while the message is up (the message names the programs)`, !g.pill, g);
    ok(`${w} px ${lang}: the message is inside the viewport`, g.left >= 0 && g.right <= g.vw && g.bottom <= g.vh, g);
  }
}

// 5. a phone in portrait (touch), the links held: the message covers no key of the left plane (Fit view and the view stack, which stand
// above it), and the note is not drawn under it. rvE: a message lifted over the note reached Fit view's lowest 13 px
const PHONES = [[360, 640], [412, 915]];
const overlap = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
for (const [w, h] of PHONES) {
  for (const lang of ['en', 'ru', 'it']) {
    await open(w, h, lang, true, true);
    const g = await hung(true);
    info[`phone_${w}_${lang}`] = g;
    ok(`phone ${w} px ${lang}: the "Compiling…" note was drawn before the message (control)`, g.pillBefore === true, g);
    ok(`phone ${w} px ${lang}: the left plane's keys are found (control)`, g.keys.length > 0, g);
    ok(`phone ${w} px ${lang}: the message covers none of the left plane's keys`, !g.keys.some((k) => overlap(g, k)), g);
    ok(`phone ${w} px ${lang}: the "Compiling…" note is not drawn while the message is up`, !g.pill, g);
  }
}

const exc = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''));
ok('no console errors', exc.length === 0, exc.slice(0, 4));
return { pass: fails.length === 0, nfails: fails.length, fails: fails.slice(0, 30), info };
