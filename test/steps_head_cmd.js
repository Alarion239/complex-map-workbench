// The steps view's plane head (#441, behind ?view=steps), at 1024, 1280 and 1440 px in en, ru and it, on each plane
// of Cayley, then cube with the colour plane last:
// - the head is one row: every item it shows sits on the bar's row, none overlaps the next, none is cut;
// - it keeps the style row (#247) and every control of the bar: the title, the colour plane, the scope, the surface;
// - short of room, the colour-plane button keeps its wheel and its name (its words in its accessible name);
// - the surface is one button, named "Surface: …", that opens a menu of the three, the shown one checked; a pick
//   changes the surface;
// - on a phone the head's controls are in the header and the surface button is the same one;
// - (#364) switching through every Phase style leaves the style buttons where they are, classic and steps view, desk and
//   phone, en/ru/it.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const ns = 'svh' + Date.now();
// Cayley, then cube's chain with the upper half-plane: z → w₁ (Möbius) → w₂ (cube)
const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'h1', kind: 'halfplane', a: [0, 0], b: [1, 0], ci: 0, visible: true }],
  steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, { type: 'pown', params: { n: 3 }, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } };
const open = async (w, h, mobile, lang) => {
  await view(w, h, false, mobile);
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await sleep(300);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}${lang}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}${lang}&lang=${lang}&view=steps` }); await sleep(3000); await settle(500);
};
// the head's items, as laid out: each shown item's box, whether it is on the bar's row, cut or overlapping the next
const LAYOUT = `(() => {
  const head = document.querySelector('#paneL .pane-head'), bar = document.getElementById('svHead'), hr = head.getBoundingClientRect(), br = bar.getBoundingClientRect();
  const items = [...bar.children, ...[...head.children].filter((c) => c !== bar)].filter((c) => c.getClientRects().length && c.getBoundingClientRect().width > 0.5);
  const box = (c) => { const r = c.getBoundingClientRect(); return { id: c.id || String(c.className).split(' ').slice(0, 2).join('.'), x: Math.round(r.left - hr.left), y: Math.round(r.top - hr.top), w: Math.round(r.width), h: Math.round(r.height), cut: c.scrollWidth > c.clientWidth + 1 && getComputedStyle(c).overflow !== 'visible', mid: r.top + r.height / 2 }; };
  const bs = items.map(box), row = br.top + br.height / 2;
  const off = bs.filter((b) => Math.abs(b.mid - row) > 8).map((b) => b.id);
  const lap = []; const xs = bs.filter((b) => Math.abs(b.mid - row) <= 8).sort((a, b) => a.x - b.x);
  for (let i = 1; i < xs.length; i++) if (xs[i].x < xs[i - 1].x + xs[i - 1].w - 0.5) lap.push(xs[i - 1].id + '/' + xs[i].id);
  const inHead = (sel) => { const e = bar.querySelector(sel) || head.querySelector(sel); return !!e && e.getClientRects().length > 0; };
  return { hh: Math.round(hr.height), bar: bar.className, off, lap, cut: bs.filter((b) => b.cut).map((b) => b.id), right: Math.max(...bs.map((b) => b.x + b.w)), hw: Math.round(head.clientWidth),
    has: { title: inHead('.sv-title'), cp: inHead('.sv-cp'), scope: inHead('.sv-scope') || inHead('.sv-scope-menu'), surf: inHead('.sv-surf1'), styles: inHead('#dcSeg') },
    cpName: (bar.querySelector('.sv-cp') || {}).getAttribute && bar.querySelector('.sv-cp').getAttribute('aria-label'),
    surfName: bar.querySelector('.sv-surf1') && bar.querySelector('.sv-surf1').getAttribute('aria-label') };
})()`;
const runs = [];
for (const lang of ['en', 'ru', 'it']) {
  for (const [w, h] of [[1024, 768], [1280, 800], [1440, 900]]) {
    await open(w, h, false, lang);
    for (const go of [0, 1, 2]) {
      await ev(`__cmwSteps({ go: ${go}, now: true }); 1`); await settle(700);
      const L = await ev(LAYOUT), n = `${lang} ${w} plane ${go}`;
      runs.push({ n, hh: L.hh, bar: L.bar });
      ok(`${n}: the head is one row`, L.off.length === 0 && L.hh <= 44, L);
      ok(`${n}: no item overlaps the next, none is cut, all inside the head`, L.lap.length === 0 && L.cut.length === 0 && L.right <= L.hw + 1, L);
      ok(`${n}: the title, the colour plane, the scope, the surface and the style row all show`, Object.values(L.has).every(Boolean), L.has);
      ok(`${n}: the colour plane and the surface are named`, !!L.cpName && /:/.test(L.surfName || ''), [L.cpName, L.surfName]);
    }
  }
}
// (rework on #473) the head is not fitted during a glide, and is fitted once it lands: ru at 1024, glide z → w₁ → w₂
await open(1024, 768, false, 'ru');
for (const go of [1, 2]) {
  await ev(`__cmwSteps({ go: ${go} }); 1`);
  for (let i = 0; i < 150; i++) { if (!(await ev('__cmwSteps().moving'))) break; await sleep(100); }
  await settle(600);
  const L = await ev(LAYOUT);
  ok(`ru 1024 after a glide to plane ${go}: the head is one row`, L.off.length === 0 && L.hh <= 44 && L.lap.length === 0, L);
}
// the surface menu (en, 1280): one button, a menu of the three with the shown one checked, a pick changes the surface
await open(1280, 800, false, 'en');
await ev(`document.querySelector('#svHead .sv-surf1').click(); 1`); await settle(400);
const menu = await ev(`(() => { const m = document.querySelector('.pop.menu'); if (!m) return null; return { label: m.getAttribute('aria-label'), items: [...m.querySelectorAll('[role=menuitemradio]')].map((b) => b.textContent.trim() + ':' + b.getAttribute('aria-checked')) }; })()`);
ok('the surface button opens a menu of the three, Plane checked', menu && menu.label === 'Surface' && menu.items.join() === 'Plane:true,Sphere:false,Landscape:false', menu);
await ev(`[...document.querySelectorAll('.pop.menu [role=menuitemradio]')].find((b) => /Landscape/.test(b.textContent)).click(); 1`); await settle(1500);
const after = await ev(`({ surf: __cmwSteps().surf, name: document.querySelector('#svHead .sv-surf1').getAttribute('aria-label') })`);
ok('a pick in the menu changes the surface, and the button names it', after.surf === 'land' && after.name === 'Surface: Landscape', after);
// the phone: the same surface button in the header
await open(390, 844, true, 'en');
// (the steps view builds its head after the app's first layout: wait for it, at most 6 s on a software renderer)
for (let i = 0; i < 60 && !(await ev(`!!document.querySelector('#svHead .sv-surf1')`)); i++) await sleep(100);
const ph = await ev(`(() => { const b = document.querySelector('#svHead .sv-surf1'), r = b.getBoundingClientRect(); return { ph: document.documentElement.classList.contains('ph'), home: document.getElementById('svHead').parentElement.id, name: b.getAttribute('aria-label'), h: Math.round(r.height), popup: b.getAttribute('aria-haspopup') }; })()`);
ok('on a phone the header holds the same surface button, 40 px or more, with its menu', ph.ph && ph.home === 'top' && ph.name === 'Surface: Plane' && ph.h >= 40 && ph.popup === 'menu', ph);
// (phone on #473) at 360 px (and 390 in ru) the surface button stays clear of the header's ⋯: a tap on its right edge and
// on its middle lands on it; short of room it is its icon and ▾, still named "Surface: …"
// (eyes on #473: on every plane, w₁'s and w₂'s names are wider than z's)
for (const [w, lang, go] of [[360, 'en', 0], [360, 'ru', 0], [390, 'ru', 0], [360, 'en', 1], [360, 'ru', 1], [360, 'it', 1], [360, 'it', 2]]) {
  await open(w, 800, true, lang);
  for (let i = 0; i < 60 && !(await ev(`!!document.querySelector('#svHead .sv-surf1')`)); i++) await sleep(100);
  await ev(`__cmwSteps({ go: ${go}, now: true }); 1`);
  await settle(800);
  const t = await ev(`(() => { const s = document.querySelector('#svHead .sv-surf1'), m = document.getElementById('hdrMoreBtn'), r = s.getBoundingClientRect(), mr = m.getBoundingClientRect();
    const at = (x, y) => { const e = document.elementFromPoint(x, y); return !!e && !!e.closest('.sv-surf1'); };
    return { right: at(r.right - 3, r.top + r.height / 2), mid: at(r.left + r.width / 2, r.top + r.height / 2), gap: Math.round(mr.left - r.right), name: s.getAttribute('aria-label'), h: Math.round(r.height) }; })()`);
  ok(`phone ${w} ${lang} plane ${go}: the surface button is the hit target at its right edge and middle, clear of ⋯, named`, t.right && t.mid && t.gap >= 0 && /: /.test(t.name || '') && t.h >= 40, t);
}
// (#364) a style's extra options never shift the style row: switching through every style leaves the style buttons'
// rects unchanged, in the classic Phase head and in the steps view's head (1024, 1440), and in a phone's Display sheet
// (390), in en, ru and it
const STYLE_RECTS = `(() => { const g = [...document.querySelectorAll('#dcSeg')].find((e) => e.getClientRects().length); if (!g) return null;
  return [...g.querySelectorAll('button, [role=radio]')].map((b) => { const r = b.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)].join(','); }).join(' '); })()`;
for (const lang of ['en', 'ru', 'it']) {
  for (const [w, h, mobile] of [[1024, 768, false], [1440, 900, false], [390, 844, true]]) {
    for (const steps of [false, true]) {
      await view(w, h, false, mobile);
      await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await sleep(300);
      await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}s${lang}${w}${steps ? 1 : 0}', ${JSON.stringify(JSON.stringify(Object.assign({}, st, { view: { main: 'phase' } })))}); 1`);
      await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}s${lang}${w}${steps ? 1 : 0}&lang=${lang}${steps ? '&view=steps' : ''}` }); await sleep(3000); await settle(500);
      if (!steps) { await ev(`__cmwSetMain('phase'), 1`); await settle(800); }
      if (mobile) { await ev(`Phone.open('display'), 1`); await settle(1000); }
      const n = await ev(`(() => { const g = [...document.querySelectorAll('#dcSeg')].find((e) => e.getClientRects().length); return g ? g.querySelectorAll('button, [role=radio]').length : 0; })()`);
      const seen = [];
      for (let i = 0; i < n; i++) {
        await ev(`(() => { const g = [...document.querySelectorAll('#dcSeg')].find((e) => e.getClientRects().length); g.querySelectorAll('button, [role=radio]')[${i}].click(); return 1; })()`); await settle(500);
        seen.push(await ev(STYLE_RECTS));
      }
      const tag = `${steps ? 'steps' : 'classic'} ${w} ${lang}`;
      ok(`#364 ${tag}: the style row shows (${n} styles)`, n >= 3, n);
      ok(`#364 ${tag}: switching through every style leaves the style buttons where they were`, seen.length > 0 && seen.every((r) => r === seen[0]), seen);
    }
  }
}
// (#1047) the Landscape with All sheets, the chain √, cos, log and Height = Im F, at 1024 × 768: the title keeps its
// words, whole ("z · landscape of Im F", else "z · landscape"; no word is cut) and is not folded to the plane's letter alone
// (and at 1460 × 900 in en: the scope is a menu button and the key, folded to its glyph while the bar was short, is unfolded again, as the bar fits beside it)
for (const [lang, W, H] of [['en', 1024, 768], ['ru', 1024, 768], ['it', 1024, 768], ['en', 1460, 900]]) {
  const okl = (n, pass, detail) => ok(`${lang} ${W} × ${H} ${n}`, pass, detail);
  const LAND = Object.assign({}, st, { shapes: [], height: 'im', sheets: true,
    steps: [{ type: 'root', params: { n: 2 }, on: true }, { type: 'cos', params: {}, on: true }, { type: 'log', params: {}, on: true }] });
  await view(W, H, false, false);
  // (waits on a condition, counter-bounded: the state the next step reads, polled every 100 ms)
  const until = async (expr, n = 150) => { for (let i = 0; i < n; i++) { if (await ev(expr)) return true; await sleep(100); } return false; };
  await seed(`${ns}land${lang}${W}`, LAND);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}land${lang}${W}&lang=${lang}&view=steps` });
  await until(`typeof __cmwSteps === 'function' && !!document.querySelector('#svHead .sv-title') && document.fonts.status === 'loaded'`);
  await ev(`__cmwSteps({ scope: 'all', surf: 'land', go: 0, now: true }); 1`);
  // (the head is fitted: the surface is the Landscape, the title shows its words, and the bar's classes hold across two reads)
  await until(`(() => { const b = document.getElementById('svHead'), k = b.className + '|' + b.querySelector('.sv-title').innerText, r = window.__fk !== k; window.__fk = k;
    return __cmwSteps().surf === 'land' && /Im F/.test(b.querySelector('.sv-title').textContent) && !r; })()`);
  const title = await ev(`(() => { const t = document.querySelector('#svHead .sv-title'), r = t.getBoundingClientRect();
    return { surf: __cmwSteps().surf, hh: Math.round(document.querySelector('#paneL .pane-head').getBoundingClientRect().height), w: Math.round(r.width), cw: t.clientWidth, sw: t.scrollWidth, full: t.textContent, tip: t.getAttribute('data-tip'), before: getComputedStyle(t.querySelector('.sv-role'), '::before').content.replace(/"/g, ''), cut: [...document.querySelectorAll('#svHead, #svHead *')].filter((e) => { const c = getComputedStyle(e); return c.textOverflow === 'ellipsis' || (/hidden|clip/.test(c.overflowX) && e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0 && !/^(svg|path|canvas)$/i.test(e.tagName)); }).map((e) => e.id || String(e.className).slice(0, 30)), text: t.innerText, bar: document.getElementById('svHead').className }; })()`);
  info[`title${W}${lang}`] = title;
  const short = /\bsv-rs\b/.test(title.bar);
  okl('Landscape, All sheets, √ cos log: the title keeps its role, whole: "z · landscape of Im F" or "z · landscape"', title.surf === 'land' && !/\bsv-c2\b/.test(title.bar) && /Im F/.test(title.full || '') && (!short || title.before.length > 3), title);
  okl('Landscape, All sheets: the head is one row (under 48 px)', title.hh < 48, title);
  okl('Landscape, All sheets: the title is not folded to the plane\'s letter (it is 40 px or more: the letter, the dot and a word)', title.cw >= 40, title);
  okl('Landscape, All sheets: the role as one word has the whole title as its tip', !short || /^z · .*Im F/.test(title.tip || ''), title);
  okl('Landscape, All sheets: nothing in the steps bar is ellipsized or cut', title.cut.length === 0, title.cut);
  // (#1047) the fold order: the scope's switch is a menu button before the colour-plane button is its wheel, and the title's role goes last
  const fold = await ev(`(() => { const b = document.getElementById('svHead'), c = b.classList, m = b.querySelector('.sv-scope-menu'), sg = b.querySelector('.sv-scope:not(.sv-scope-menu)');
    const mr = m.getBoundingClientRect(), t = b.querySelector('.sv-title').getBoundingClientRect();
    return { cls: b.className, sm: c.contains('sv-sm'), c1: c.contains('sv-c1'), c2: c.contains('sv-c2'), keyFolded: (() => { const lg = document.getElementById('leftLegend'); return !!lg && !lg.hidden && lg.classList.contains('glyph'); })(), glyph: (() => { const lg = document.getElementById('leftLegend'); return !lg || lg.hidden || lg.classList.contains('glyph'); })(), si: c.contains('sv-si'), menuShown: mr.width > 0, segShown: sg.getBoundingClientRect().width > 0, menuH: Math.round(mr.height), tw: Math.round(t.width),
      name: m.getAttribute('aria-label'), popup: m.getAttribute('aria-haspopup'), text: m.textContent.trim() }; })()`);
  info[`fold${W}${lang}`] = fold;
  if (W === 1460) okl('Landscape, All sheets: the scope is a menu button and the Height key is unfolded again, the bar fitting beside it', fold.sm && !fold.keyFolded && title.hh < 48, fold);
  okl('the fold order: the Height key is a glyph while the scope is a menu button, unless the bar fits beside the unfolded key (one row)', !fold.sm || fold.keyFolded || fold.glyph || title.hh < 48, fold);
  okl('the fold order: the role goes last (sv-c2 only with sv-c1 and sv-sm)', !fold.c2 || (fold.c1 && fold.sm && fold.si), fold);
  okl('the folded scope is one menu button, haspopup=menu, named "Where colour shows: Everywhere", its words "Everywhere"',
    fold.sm ? fold.menuShown && !fold.segShown && fold.popup === 'menu' && (lang !== 'en' || (fold.name === 'Where colour shows: Everywhere' && fold.text === 'Everywhere')) : !fold.menuShown && fold.segShown, fold);
  if (lang === 'en' && fold.sm) {
    await ev(`document.querySelector('.sv-scope-menu').click(); 1`);
    await until(`!!document.querySelector('.pop.menu [role=menuitemradio]')`);
    const sm = await ev(`(() => { const m = document.querySelector('.pop.menu'); return m && { label: m.getAttribute('aria-label'), items: [...m.querySelectorAll('[role=menuitemradio]')].map((b) => b.textContent.trim() + ':' + b.getAttribute('aria-checked')) }; })()`);
    okl('the scope button opens a menu of the two, Everywhere checked', sm && sm.label === 'Where colour shows' && sm.items.join() === 'Everywhere:true,Inside regions:false', sm);
    await ev(`[...document.querySelectorAll('.pop.menu [role=menuitemradio]')].find((b) => /Inside/.test(b.textContent)).click(); 1`);
    await until(`__cmwSteps().scope === 'in' && /Inside/.test(document.querySelector('.sv-scope-menu').textContent)`);
    const after = await ev(`(() => { const m = document.querySelector('.sv-scope-menu'); return { scope: __cmwSteps().scope, name: m.getAttribute('aria-label'), text: m.textContent.trim() }; })()`);
    okl('a pick changes the scope, and the button names it', after.scope === 'in' && after.name === 'Where colour shows: Inside regions' && after.text === 'Inside', after);
  }
}
info.runs = runs.map((r) => `${r.n}: ${r.hh} px, ${r.bar.replace('sv-head', '').trim() || 'whole'}`);
info.checks = 'steps view head: one row at 1024/1280/1440 in en/ru/it on every plane, the surface menu, the phone';
return { pass: fails.length === 0, fails, info };
