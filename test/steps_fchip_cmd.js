// The thread's F chip, the whole map (behind ?view=steps):
// - on a laptop one chip ends the thread, in the rail's track after the last plane and before "+ Add function": the italic F and
//   "Whole map" as its label and tip, no ⋯, not a step of the chain (the step chips are as many as the steps), a Tab stop;
// - a click, and Enter on it from the keyboard, select F: the Inspector shows the composition, the natural domain and the
//   guarantees, and the chip says it is pressed (aria-pressed), and not pressed again once a step is selected;
// - its name is translated (ru, it);
// - on a phone it is not on the strip: the chain sheet has the whole-map row;
// - it is the round F alone and sticks to the rail's right end: at 1440 in en, ru and it, with 3 steps and with 12 that scroll, it is
//   in view, pressable and clear of the fade at rest;
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
    chips: document.querySelectorAll('#svStrip .sv-fchip').length, h: f.getBoundingClientRect().height }; })()`);
const insp = () => ev(`(document.getElementById('propsPanel') || document.body).textContent`);

await open(1280, 800, false, 'en');
const f0 = await whole();
ok('the F chip ends the thread (in the thread track, after the last plane) and sits before + Add function, a button named Whole map', f0 && f0.inRail && f0.afterRail && f0.beforeAdd && f0.tag === 'BUTTON' && /F/.test(f0.text) && /Whole map/.test(f0.text) && f0.label === 'Whole map', f0);
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
ok('F is not a step: the chain and the place on the thread are as they were', (await S()).planes.length === 4 && (await S()).x === 0, await S());

// a saved page that had F selected opens with the chip pressed
await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps` });
await settled({ max: 30000, until: `typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip .sv-wholemap')` });
ok('a page saved with F selected opens with the chip pressed', (await S()).sel === 'F' && (await whole()).pressed === 'true', { sel: (await S()).sel, f: await whole() });
// room: the chip is the thread's last item and sticks to the rail's right end, the round F alone (its words are its label and tip):
// at rest (the thread at its start) it is in the rail, on top at its centre (pressable) and clear of the rail's fade, in en, ru and
// it, with the 3-step chain and with a 12-step one that scrolls, and the rail keeps its width (more than 360 px at 1440)
const atRest = () => ev(`(() => { const r = document.querySelector('#svStrip .sv-rail'), f = document.querySelector('#svStrip .sv-wholemap'), n = f.querySelector('.sv-fn');
  r.scrollLeft = 0; const fb = f.getBoundingClientRect(), rb = r.getBoundingClientRect(), at = document.elementFromPoint(fb.left + fb.width / 2, fb.top + fb.height / 2);
  const fadeEdge = rb.right - parseFloat(getComputedStyle(document.getElementById('svStrip')).getPropertyValue('--wm'));
  return { rail: Math.round(r.clientWidth), scrolls: r.scrollWidth > r.clientWidth + 1, onlyF: getComputedStyle(n).display === 'none', label: f.getAttribute('aria-label'), tip: f.dataset.tip,
    inRail: fb.left >= rb.left - 1 && fb.right <= rb.right + 1, onTop: !!at && (at === f || f.contains(at)), clearOfFade: fb.left >= fadeEdge - 1, w: Math.round(fb.width), h: Math.round(fb.height) }; })()`);
const LABEL = { en: 'Whole map', ru: 'Вся карта', it: 'Mappa intera' };
const CHAIN12 = Array.from({ length: 12 }, () => LONG);
for (const lang of ['en', 'ru', 'it']) {
  for (const [what, chain] of [['3 steps', null], ['12 steps', CHAIN12]]) {
    await open(1440, 900, false, lang, chain);
    const w = await atRest();
    info[`1440 ${lang} ${what}`] = w;
    ok(`1440 ${lang}, ${what}: the chip is the F alone with its words as its label and tip, in the rail, on top at its centre, clear of the fade`,
      w.onlyF && w.label === LABEL[lang] && w.tip === LABEL[lang] && w.inRail && w.onTop && w.clearOfFade, w);
    if (what === '12 steps') ok(`1440 ${lang}, 12 steps: the thread scrolls, and the chip is still pressable at rest`, w.scrolls && w.onTop, w);
    else ok(`1440 ${lang}, 3 steps: the rail keeps its width (at least 360 px)`, w.rail >= 360, w);
  }
}
// (a press on it at rest selects F)
await open(1440, 900, false, 'en', CHAIN12);
await ev(`(() => { const f = document.querySelector('#svStrip .sv-wholemap'), b = f.getBoundingClientRect(); f.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse', clientX: b.left + 5, clientY: b.top + 5 })); f.click(); return 1; })()`);
await settled({});
ok('at rest on a 12-step thread, a press on the chip selects F', (await S()).sel === 'F', (await S()).sel);

// translated
for (const lang of ['ru', 'it']) {
  await open(1280, 800, false, lang);
  const f = await whole();
  ok(`${lang}: the chip's name is translated`, f && f.label && f.label !== 'Whole map' && !/Whole map/.test(f.text), f);
}

// a phone: the chain sheet has the whole-map row, so the strip has no chip
await open(390, 844, true, 'en');
const fp = await whole();
ok('phone: the strip has no F chip (the chain sheet holds the whole-map row)', fp && !fp.shown, fp);

// room: at 1024 the strip's controls sit on one row inside it, overlapping nothing, the rail keeps room for the thread
for (const lang of ['en', 'ru', 'it']) {
  await open(1024, 768, false, lang);
  const box = await ev(`(() => {
    const strip = document.getElementById('svStrip'), sb = strip.getBoundingClientRect();
    const items = ['.sv-play', '.sv-prev', '.sv-rail', '.sv-add', '.sv-next', '.sv-speed', '.sv-loop'].map((q) => { const e = strip.querySelector(q), r = e.getBoundingClientRect(); return { q, l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width }; });
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
