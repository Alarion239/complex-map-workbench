// The Play gate's 10 s message says what is missing (#1953): after "Still preparing the glide" it names the first part of
// svReady() not done, in a fixed order: the programs, the colour's first draw, the pole tracks, the outer ring, the meshes,
// the left pane's frame. One sentence per part (each language puts its words in its own order), in English, Russian and Italian.
// Rows:
// - each part held (the links for the programs: ?glhold; the others: the test hook holdJobs, a list of part names) has
//   the gate's first missing part (__cmwGateMissing) naming it, and the message after 10 s is that part's sentence (English, through the real wait);
// - several held: the first in the order is named (the programs before the jobs; the pole tracks before the ring before the meshes);
// - nothing named (no part missing): the message is the old sentence;
// - the sentences of the three languages are the strings below, through the page's translation (the test hook __cmwGateStill);
// - at 360 px, for each language, the longest sentence keeps the message two rows tall (the words, then Retry, Cancel and the
//   close button), inside the viewport.
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
    programs: 'Still preparing the glide: the programs are still linking.',
    warm: 'Still preparing the glide: the first picture of the colour is not drawn.',
    poles: 'Still preparing the glide: the pole tracks are not done.',
    ring: 'Still preparing the glide: the outer ring is not done.',
    meshes: 'Still preparing the glide: the meshes are not built.',
    redraw: 'Still preparing the glide: the first frame is not drawn.',
  },
  ru: {
    programs: 'Переход всё ещё готовится: программы ещё компилируются.',
    warm: 'Переход всё ещё готовится: первая картинка цвета не нарисована.',
    poles: 'Переход всё ещё готовится: дорожки полюсов не готовы.',
    ring: 'Переход всё ещё готовится: внешнее кольцо не готово.',
    meshes: 'Переход всё ещё готовится: сетки не построены.',
    redraw: 'Переход всё ещё готовится: первый кадр не нарисован.',
  },
  it: {
    programs: 'Preparazione del passaggio ancora in corso: i programmi si stanno ancora collegando.',
    warm: 'Preparazione del passaggio ancora in corso: il primo disegno del colore non è fatto.',
    poles: 'Preparazione del passaggio ancora in corso: le tracce dei poli non sono pronte.',
    ring: 'Preparazione del passaggio ancora in corso: l\'anello esterno non è pronto.',
    meshes: 'Preparazione del passaggio ancora in corso: le mesh non sono costruite.',
    redraw: 'Preparazione del passaggio ancora in corso: il primo fotogramma non è disegnato.',
  },
};
// (the toast's most at 360 px, as test/svplay_gate_cmd.js measures it: its padding and 1 px border either side, the words on two lines of 18 px, one row of 44 px buttons)
const GATE_TOAST_PAD = 12, GATE_TOAST_BORDER = 2, GATE_TOAST_WORDS_MAX = 2 * 18, GATE_TOAST_BUTTON_ROW = 44, HANG_WAIT_MS = 14000, ROW_EDGE_PX = 1;
const MSG = '#toastHost .toast';
const esc = () => ev('(document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })), 1)');

// the example's steps view, the links held (programs not done) or not
async function open(w, h, lang, hold) {
  await view(w, h, false);
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
  await ev('(__cmwSteps({ play: true }), 1)');
  await settled({ max: HANG_WAIT_MS, only: true, until: `!!document.querySelector("${MSG}")` });
  const g = await ev(`(() => { const t = document.querySelector('${MSG}'), r = t.getBoundingClientRect(), w = t.querySelector('span').getBoundingClientRect(); const tops = [...t.querySelectorAll('button')].map((b) => Math.round(b.getBoundingClientRect().top)); return { text: t.querySelector('span').textContent, top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), wordsBottom: Math.round(w.bottom), tops: [...new Set(tops)], vw: innerWidth, vh: innerHeight }; })()`);
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

const exc = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''));
ok('no console errors', exc.length === 0, exc.slice(0, 4));
return { pass: fails.length === 0, nfails: fails.length, fails: fails.slice(0, 30), info };
