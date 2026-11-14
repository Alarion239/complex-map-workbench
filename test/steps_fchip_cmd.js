// The thread's F chip, the whole map (behind ?view=steps):
// - on a laptop one chip ends the thread, after the rail and before "+ Add function" (not in the rail: it never lies over a plane): the italic F and
//   "Whole map" as its label and tip, no ⋯, not a step of the chain (the step chips are as many as the steps), a Tab stop;
// - a click, and Enter on it from the keyboard, select F: the Inspector shows the composition, the natural domain and the
//   guarantees, and the chip says it is pressed (aria-pressed), and not pressed again once a step is selected;
// - its name is translated (ru, it);
// - on a phone it is not on the strip: the chain sheet has the whole-map row;
// - it is the round F alone, clear of the rail: at 1440 in en, ru and it, with 3 steps and with 12 that scroll, it is
//   in view, pressable and overlaps nothing at rest;
// - "+ Add function" keeps its words only while the thread fits beside them and can still sit on the pane's centre line; else it folds to the round + (at 1440 a one-step thread is centred, so the + is round; the
//   2-step chain shows whole in en and it, and the Playback ⋯ at the strip end leaves the + round there);
// - at 1024 px in English, Russian and Italian the strip's controls sit on one row inside it, overlapping nothing.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const ns = 'svf' + Date.now();
const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 's2', kind: 'circle', c: [0.3, 0.2], r: 0.8, ci: 0, visible: true }],
  steps: [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, { type: 'pown', params: { n: 3 }, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } };
const LONG = { type: 'sin', params: {}, on: true };
const open = async (w, h, touch, lang, chain) => {
  const stx = chain ? Object.assign({}, st, { steps: chain }) : st;
  await view(w, h, false, touch);
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await settled({ panes: false });
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(stx))}); 1`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}&lang=${lang}&view=steps` });
  await settled({ max: 30000, until: `typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip .sv-wholemap')` });
};
const S = () => ev('__cmwSteps()');
const whole = () => ev(`(() => { const f = document.querySelector('#svStrip .sv-wholemap'); if (!f) return null; const rail = document.querySelector('#svStrip .sv-rail'), add = document.querySelector('#svStrip .sv-add'), planes = [...document.querySelectorAll('#svStrip .sv-plane')], last = planes[planes.length - 1];
  return { text: f.textContent, label: f.getAttribute('aria-label'), pressed: f.getAttribute('aria-pressed'), tab: f.tabIndex, tag: f.tagName, hidden: f.hidden, shown: getComputedStyle(f).display !== 'none',
    more: !!f.querySelector('.sv-more'), inRail: rail.contains(f), afterRail: !!(last && (last.compareDocumentPosition(f) & Node.DOCUMENT_POSITION_FOLLOWING)), beforeAdd: !!(f.compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING),
    chips: document.querySelectorAll('#svStrip .sv-fchip').length, h: f.getBoundingClientRect().height, w: f.getBoundingClientRect().width }; })()`);
const insp = () => ev(`(document.getElementById('propsPanel') || document.body).textContent`);

await open(1280, 800, false, 'en');
const f0 = await whole();
ok('the F chip ends the thread (after the rail, over no plane) and sits before + Add function, a button named Whole map', f0 && !f0.inRail && f0.afterRail && f0.beforeAdd && f0.tag === 'BUTTON' && /F/.test(f0.text) && /Whole map/.test(f0.text) && f0.label === 'Whole map', f0);
ok('it has no ⋯, it is a Tab stop, and it is not one of the step chips (as many as the steps)', f0 && !f0.more && f0.tab === 0 && f0.chips === 3, f0);
ok('it is not pressed while a step, not F, is selected', f0 && f0.pressed === 'false', f0);
await ev(`document.querySelector('#svStrip .sv-wholemap').click(); 1`);
await settled({});
const f1 = await whole(), s1 = await S();
ok('a click selects F: the chip says pressed', s1.sel === 'F' && f1.pressed === 'true', { sel: s1.sel, f1 });
const t1 = await insp();
ok('… and the Inspector shows the natural domain and the guarantees', /Natural domain/.test(t1) && /uarantee|property/i.test(t1), t1.slice(0, 200));
await ev(`document.querySelector('#svStrip .sv-fchip').click(); 1`);
await settled({});
ok('selecting a step again lets F go: the chip is not pressed', (await whole()).pressed === 'false' && (await S()).sel !== 'F', await whole());
await ev(`document.querySelector('#svStrip .sv-wholemap').focus(); 1`);
await key('Enter');
await settled({});
ok('Enter on the focused chip selects F too', (await S()).sel === 'F' && (await whole()).pressed === 'true', await S());
// the plane stays where it was: F is no plane and no step
const PLANES = 4;   // (z and the three steps' images)
ok('F is not a step: the chain and the place on the thread are as they were', (await S()).planes.length === PLANES && (await S()).x === 0, await S());

// a saved page that had F selected opens with the chip pressed
await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps` });
await settled({ max: 30000, until: `typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip .sv-wholemap')` });
ok('a page saved with F selected opens with the chip pressed', (await S()).sel === 'F' && (await whole()).pressed === 'true', { sel: (await S()).sel, f: await whole() });
// room: the chip is after the rail, the round F alone (its words are its label and tip):
// at rest (the thread at its start) it is on top at its centre (pressable) and clear of the rail, in en, ru and
// it, with the 3-step chain and with a 12-step one that scrolls, and the rail keeps its width (at least 320 px at 1440)
const atRest = () => ev(`(() => { const r = document.querySelector('#svStrip .sv-rail'), f = document.querySelector('#svStrip .sv-wholemap'), n = f.querySelector('.sv-fn');
  r.scrollLeft = 0; const fb = f.getBoundingClientRect(), rb = r.getBoundingClientRect(), at = document.elementFromPoint(fb.left + fb.width / 2, fb.top + fb.height / 2);
  return { rail: Math.round(r.clientWidth), scrolls: r.scrollWidth > r.clientWidth + 1, onlyF: getComputedStyle(n).display === 'none', label: f.getAttribute('aria-label'), tip: f.dataset.tip,
    addFolded: getComputedStyle(document.querySelector('#svStrip .sv-add-t')).display === 'none', moreLast: (() => { const k = [...document.querySelector('#svStrip').children].filter((e) => e.getClientRects().length).pop(); return !!k && k.classList.contains('sv-playmore'); })(), addOnTop: (() => { const a = document.querySelector('#svStrip .sv-add').getBoundingClientRect(), e = document.elementFromPoint(a.left + a.width / 2, a.top + a.height / 2); return !!e && !!e.closest('.sv-add'); })(), clearOfRail: fb.left >= rb.right - 1, onTop: !!at && (at === f || f.contains(at)), w: Math.round(fb.width), h: Math.round(fb.height) }; })()`);
// (the chip's name is the page's own translation of the English key, read under each language from the table the page ships,
// so a new wording in tools/it_table.json or tools/ru_extra.json keeps this check; ru and it must differ from the English)
const KEY = 'Whole map';
const labelOf = (lang) => ev(`I18N.at(${JSON.stringify(lang)}).t(${JSON.stringify(KEY)})`);
const CHAIN12 = Array.from({ length: 12 }, () => LONG);
for (const lang of ['en', 'ru', 'it']) {
  for (const [what, chain] of [['1 step', st.steps.slice(0, 1)], ['2 steps', st.steps.slice(0, 2)], ['3 steps', null], ['12 steps', CHAIN12]]) {
    await open(1440, 900, false, lang, chain);
    if (what === '1 step') {
      // (a one-step chain has no F chip: F is f₁ there)
      const none = await ev(`(() => { const f = document.querySelector('#svStrip .sv-wholemap'); return { hidden: !f || f.getClientRects().length === 0, rail: document.querySelector('#svStrip .sv-rail').scrollWidth > document.querySelector('#svStrip .sv-rail').clientWidth + 1, addWords: getComputedStyle(document.querySelector('#svStrip .sv-add-t')).display !== 'none' }; })()`);
      info[`1440 ${lang} ${what}`] = none;
      ok(`1440 ${lang}, 1 step: no F chip, the thread does not scroll, + Add function is the round + (its words would keep the thread off centre)`, none.hidden && !none.rail && !none.addWords, none);
      continue;
    }
    const w = await atRest();
    const label = await labelOf(lang);
    ok(`1440 ${lang}, ${what}: the chip's name is ${lang === 'en' ? 'the English' : 'translated, not the English'}`, typeof label === 'string' && label.length > 0 && (lang === 'en' ? label === KEY : label !== KEY), label);
    info[`1440 ${lang} ${what}`] = w;
    ok(`1440 ${lang}, ${what}: the chip is the F alone with its words as its label and tip, on top at its centre, clear of the rail`,
      w.onlyF && w.label === label && w.tip === label && w.clearOfRail && w.onTop, w);
    if (what === '12 steps') ok(`1440 ${lang}, 12 steps: the thread scrolls, and the chip is still pressable at rest`, w.scrolls && w.onTop, w);
    if (what === '3 steps') ok(`1440 ${lang}, 3 steps: the rail keeps its width (at least 320 px, with the chip beside it)`, w.rail >= 320, w);
    // (the Playback ⋯ ends the strip and takes the room of "+ Add function"'s words once the thread is longer than a step or two:
    // + keeps its words on a short thread and is the round one beside a longer one; the rule never lets the words make the thread
    // scroll; a two-step chain that fits with its names only beside the round + keeps them, and one that fits only with the
    // chips' letters shows them, so it is whole either way)
    ok(`1440 ${lang}, ${what}: the Playback ⋯ ends the strip, and the words of + Add function never make the thread scroll`, w.moreLast && (w.addFolded || !w.scrolls), w);
    if (what === '1 step') ok(`1440 ${lang}, 1 step: + Add function is the round + (centring the thread), which does not scroll`, w.addFolded && !w.scrolls && w.addOnTop, w);
    if (what === '2 steps') ok(`1440 ${lang}, 2 steps: + Add function is the round + (the words would not fit beside the thread and the Playback controls), whole and on top, and the chain z … w₂ shows whole and does not scroll`, w.addFolded && w.addOnTop && !w.scrolls, w);
    else if (what === '12 steps') ok(`1440 ${lang}, 12 steps: + Add function is the round + (its words would make the thread scroll more), whole and on top`, w.addFolded && w.addOnTop, w);
  }
}
// (a real mouse press on it at rest selects F, and the chip says it is pressed: aria-pressed follows whether F is the selected step)
await open(1440, 900, false, 'en', CHAIN12);
const ctr = await ev(`(() => { const f = document.querySelector('#svStrip .sv-wholemap'), b = f.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: ctr[0], y: ctr[1] });
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: ctr[0], y: ctr[1], button: 'left', clickCount: 1 });
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: ctr[0], y: ctr[1], button: 'left', clickCount: 1 });
await settled({});
const pr = await ev(`document.querySelector('#svStrip .sv-wholemap').getAttribute('aria-pressed')`);
ok('at rest on a 12-step thread, a mouse press on the chip selects F and the chip is pressed', (await S()).sel === 'F' && pr === 'true', { sel: (await S()).sel, pr });
// … and it is pressed only while F is the selected step: selecting a step lets it go, the chip stays where it was
await ev(`document.querySelector('#svStrip .sv-step[data-k="1"] .sv-fchip').click(); 1`);
await settled({});
ok('selecting a step lets the chip go: aria-pressed false', (await ev(`document.querySelector('#svStrip .sv-wholemap').getAttribute('aria-pressed')`)) === 'false' && (await S()).sel !== 'F', await S());

// translated
for (const lang of ['ru', 'it']) {
  await open(1280, 800, false, lang);
  const f = await whole();
  ok(`${lang}: the chip's name is translated`, f && f.label && f.label !== 'Whole map' && !/Whole map/.test(f.text), f);
}

// a phone: F is a round 44 px chip at the end of the rail, after the last plane (the rail scrolls it in; the chain sheet has the row too)
await open(390, 844, true, 'en');
const fp = await whole();
ok('phone: F is a 44 px button inside the rail, after the last plane, named Whole map', fp && fp.shown && fp.inRail && fp.afterRail && fp.tag === 'BUTTON' && fp.label === 'Whole map' && fp.h === 44 && fp.w === 44, fp);

// room: at 1024 the strip's controls sit on one row inside it, overlapping nothing, the rail keeps room for the thread
for (const lang of ['en', 'ru', 'it']) {
  await open(1024, 768, false, lang);
  const box = await ev(`(() => {
    const strip = document.getElementById('svStrip'), sb = strip.getBoundingClientRect();
    const items = ['.sv-play', '.sv-prev', '.sv-rail', '.sv-wholemap', '.sv-add', '.sv-next', '.sv-speed', '.sv-loop'].map((q) => { const e = strip.querySelector(q), r = e.getBoundingClientRect(); return { q, l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width }; });
    return { strip: [sb.left, sb.right, sb.top, sb.bottom], items, scroll: strip.scrollWidth - strip.clientWidth };
  })()`);
  const inside = box.items.every((i) => i.l >= box.strip[0] - 0.5 && i.r <= box.strip[1] + 0.5);
  const oneRow = box.items.every((i) => i.t >= box.strip[2] - 0.5 && i.b <= box.strip[3] + 0.5);
  const sorted = box.items.slice().sort((p, q) => p.l - q.l);
  const clear = sorted.every((i, k) => !k || i.l >= sorted[k - 1].r - 0.5);
  const rail = box.items.find((i) => i.q === '.sv-rail');
  info[`1024 ${lang}`] = { rail: Math.round(rail.w) };
  const fn = await ev(`({ words: getComputedStyle(document.querySelector('#svStrip .sv-wholemap .sv-fn')).display, label: document.querySelector('#svStrip .sv-wholemap').getAttribute('aria-label') })`);
  ok(`1024 ${lang}: the chip is the F alone, its name its label`, fn.words === 'none' && !!fn.label, fn);
  ok(`1024 ${lang}: the strip's controls sit inside it, on one row, overlapping nothing`, inside && oneRow && clear && box.scroll <= 0, box);
  ok(`1024 ${lang}: the rail keeps room for the thread (at least 160 px)`, rail.w >= 160, rail);
}
return { pass: fails.length === 0, fails, info };
