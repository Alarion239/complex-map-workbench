// Browser acceptance of the Russian interface (phase 2b, notes/i18n/PHASE2B.md). Serve dist/ on the kit's port and run
// with a copy of test/cdp_kit: test/<you>_cdp/q.sh test/i18n_cmd.js. Result: { pass, of, fails: [[name, false, detail]] }.
//   1. Overflow, Russian and Italian against English, at 360, 390, 768, 900, 1024 and 1440 px, light and dark: the page never
//      scrolls sideways, the top bar fits, and no element is clipped in Russian that is not clipped in English.
//   2. No English left in the first screen and the header's menus at every width (test/i18n_scan.js). The full walk of
//      every view, dialog and tour step is test/i18n_walk_cmd.js.
//   3. The globe: in the bar at 768 px and up (v15.1, frame f6; before, folded into More below 1024); its menu Auto (resolved), English, Русский,
//      Italiano (bd48ab3 added Italian); the same rows in the palette ("язык", "language"). The secondary buttons are in the bar from 768 too.
//   4. Switching round-trips: work, view, undo history and open panels come back, in both directions, through the UI.
//   5. ЙЦУКЕН shortcuts through e.code; typing in a text field is never taken.
//   6. Detection: a ru-RU browser gets Russian; ?ns= pages stay English; uk-UA stays English.
//   7. The decimal-comma hint and Russian notation in the palette.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const SCAN = fs.readFileSync(path.join(DIR, '..', 'i18n_scan.js'), 'utf8');
const R = [];
const check = (name, pass, detail) => R.push([name, !!pass, detail === undefined ? null : detail]);
const settle = async (ms = 900) => { await sleep(ms); await ev('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
// a page just opened: the pause it always had, then its ready state (loaded, I18N there, the chain built), which a
// busy machine reaches later than any fixed pause; then two frames
const loaded = async (pause, ms = 30000) => {
  await sleep(pause);
  for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(200)) {
    let ok = false;
    try { ok = await ev(`document.readyState === 'complete' && typeof I18N === 'object' && !!document.querySelector('#pipeline .card')`); } catch (e) { /* navigating */ }
    if (ok) break;
  }
  await settle(0);
};
const open = async (lang, w, dark, extra = '') => {
  const phone = w < 768;
  await view(w, phone ? 844 : 900, dark, phone);
  await nav(`${U}?ns=i18n-${lang}-${w}${dark ? 'd' : ''}-${Date.now()}${lang ? '&lang=' + lang : ''}${extra}`); await loaded(3500);
  // (until MathJax has typeset the page's formulas, at most 15 s: it starts after the first paint, 3 to 5 s on a software
  // renderer, and a formula shows its fallback until then, #288)
  for (let i = 0; i < 60 && !(await ev(`!!(window.MathJax && MathJax.startup && MathJax.startup.document) && !document.querySelector('.tex-fallback')`)); i++) await sleep(250);
};
logs();
// ---- 1, 2: overflow and the first screen ----
const CLIP = `(() => {
  const out = [], W = innerWidth;
  const name = (e) => (e.id ? '#' + e.id : (e.closest('[id]') ? '#' + e.closest('[id]').id + ' ' : '') + e.tagName.toLowerCase() + '.' + [...e.classList].slice(0, 2).join('.'));
  for (const e of document.querySelectorAll('body *')) {
    if (!e.offsetParent && getComputedStyle(e).position !== 'fixed') continue;
    const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue;
    if (e.closest('svg, mjx-container, canvas, .pane, .scroll, [data-scroll]')) continue;
    const text = [...e.childNodes].some((c) => c.nodeType === 3 && c.data.trim());
    if (text && (cs.overflow === 'hidden' || cs.textOverflow === 'ellipsis' || cs.overflowX === 'hidden') && e.scrollWidth > e.clientWidth + 1) out.push('clip ' + name(e));
    if (r.right > W + 1 && cs.position !== 'fixed' && !e.closest('.hdr-menu:not(:popover-open), [popover]:not(:popover-open)')) out.push('past edge ' + name(e));
  }
  const top = document.querySelector('.top');
  return { page: document.documentElement.scrollWidth > W + 0.5, bar: top ? top.scrollWidth > top.clientWidth + 0.5 : false, els: [...new Set(out)] };
})()`;
const WIDTHS = [360, 390, 768, 900, 1024, 1440];
for (const dark of [false, true]) {
  for (const w of WIDTHS) {
    await open('en', w, dark); const en = await ev(CLIP);
    await open('ru', w, dark); const ru = await ev(CLIP);
    const extra = ru.els.filter((x) => !en.els.includes(x));
    check(`overflow ${w}${dark ? ' dark' : ''}: page`, !ru.page, ru.page);
    check(`overflow ${w}${dark ? ' dark' : ''}: top bar`, !ru.bar && !en.bar, { ru: ru.bar, en: en.bar });
    check(`overflow ${w}${dark ? ' dark' : ''}: nothing clipped beyond English`, extra.length === 0, extra.slice(0, 8));
    if (!dark) {
      await ev(SCAN); await ev(`__i18nScan('first screen')`);
      // the header's menus, through More where the bar folds
      for (const id of ['settingsBtn', 'helpBtn', 'exportBtn', 'shareBtn', 'examplesBtn', 'soundMore']) {
        if (await ev(`getComputedStyle(document.getElementById('hdrMoreBtn')).display !== 'none'`)) { await ev(`document.getElementById('hdrMoreBtn').click(), 1`); await settle(300); await ev(`__i18nScan('more')`); }
        await ev(`(() => { const b = document.getElementById(${JSON.stringify(id)}); b && b.click(); })()`); await settle(500); await ev(`__i18nScan(${JSON.stringify('menu ' + id)})`);
        await key('Escape'); await key('Escape'); await settle(200);
      }
      const left = await ev(`__i18nLeft()`);
      check(`no English left ${w}`, left.length === 0, left.slice(0, 10).map((l) => `${l.text.slice(0, 80)} [${l.words.join(',')}] ${l.where} (${l.state})`));
    }
  }
}
// ---- 1b: Italian against English (issue #61: wave 1's fitting rules are Russian-only; Italian gets the overflow checks too,
// from a phone to a wide desktop; its text is longer than English, shorter than Russian in most labels) ----
for (const dark of [false, true]) {
  for (const w of [...WIDTHS, 1600, 1920]) {
    await open('en', w, dark); const en = await ev(CLIP);
    await open('it', w, dark); const it = await ev(CLIP);
    const extra = it.els.filter((x) => !en.els.includes(x));
    check(`overflow ${w}${dark ? ' dark' : ''} (it): page`, !it.page, it.page);
    check(`overflow ${w}${dark ? ' dark' : ''} (it): top bar`, !it.bar && !en.bar, { it: it.bar, en: en.bar });
    check(`overflow ${w}${dark ? ' dark' : ''} (it): nothing clipped beyond English`, extra.length === 0, extra.slice(0, 8));
  }
}
// ---- 3: Language in Settings, the tablet bar, the palette rows ----
// ([v17 D5, the owner's decision of 2026-10-28, notes/i18n/USER-DECISIONS.md] the header's globe went: Language is a
// four-way switch in ⚙ Settings, and in the phone's More sheet)
const setLang = async (v) => { await ev(`document.getElementById('settingsBtn').click(), 1`); await settle(400); return ev(`(() => { const b = document.querySelector('.set-pop #setLang [data-v="${v}"]'); if (!b) return false; b.click(); return true; })()`); };
await open('ru', 1440, false);
check('no globe in the bar: Language is in Settings', await ev(`!document.getElementById('langBtn') && !!document.getElementById('settingsBtn').offsetParent`));
await ev(`document.getElementById('settingsBtn').click(), 1`); await settle(500);
const items = await ev(`[...document.querySelectorAll('.set-pop #setLang button')].map((e) => e.textContent)`);
check('Settings: Language Авто, English, Русский, Italiano', JSON.stringify(items) === JSON.stringify(['Авто', 'English', 'Русский', 'Italiano']), items);
const mrect = await ev(`(() => { const m = document.querySelector('.set-pop'); if (!m) return null; const r = m.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; })()`);
check('Settings inside the window', mrect && mrect.l >= 0 && mrect.r <= 1440 && mrect.t >= 0, mrect);
await key('Escape'); await settle(200);
for (const q of ['язык', 'language']) {
  await key('k', 4); await settle(300); await type(q); await settle(500);
  const rows = await ev(`[...document.querySelectorAll('.pal-item .pal-label')].map((e) => e.textContent).filter((t) => /^Язык:/.test(t))`);
  check(`palette "${q}": the four Language rows`, rows.length === 4, rows);
  await key('Escape'); await settle(200);
}
// (v15.1, verify-6: from 768 to 1023 the bar follows frame f6, as from 1024: no More button; the secondary buttons are
// in the bar, inside the window, and Settings, with Language, opens there)
for (const w of [768, 900, 1023]) {
  await open('ru', w, false);
  const st = await ev(`(() => { const vis = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
    // ([v17 D5] Theme and the panel buttons are in Settings: the bar has Share and Settings instead)
    const ids = ['examplesBtn', 'cmdBtn', 'exportBtn', 'shareBtn', 'soundBtn', 'settingsBtn', 'helpBtn'];
    const inBar = ids.filter((id) => { const e = document.getElementById(id), r = e && e.getBoundingClientRect(); return vis(e) && r.top < 60 && r.right <= innerWidth - 4 && r.left >= 0; });
    return { more: vis(document.getElementById('hdrMoreBtn')), inBar, over: document.documentElement.scrollWidth - innerWidth }; })()`);
  check(`tablet ${w}: no More button; the secondary buttons in the bar, inside the window`, !st.more && st.inBar.length === 7 && st.over <= 0, st);
  await ev(`document.getElementById('settingsBtn').click(), 1`); await settle(500);
  const lm = await ev(`(() => { const m = document.querySelector('.set-pop'); if (!m) return null; const r = m.getBoundingClientRect(); return { n: m.querySelectorAll('#setLang button').length, l: r.left, r: r.right, t: r.top, b: r.bottom }; })()`);
  check(`tablet ${w}: Settings, with Language, opens from the bar, inside the window`, lm && lm.n === 4 && lm.l >= 0 && lm.r <= w && lm.t >= 0, lm);
  await key('Escape'); await settle(200);
}
for (const w of [1024, 1440]) {
  await open('en', w, false);
  check(`${w}: no More button, Settings in the bar (English)`, await ev(`getComputedStyle(document.getElementById('hdrMoreBtn')).display === 'none' && !!document.getElementById('settingsBtn').offsetParent`));
}
// ---- 4: switching round-trips through the UI ----
{
  const ns = 'i18n-sw-' + Date.now();
  await view(1440, 900, false, false);
  await nav(`${U}?ns=${ns}`); await loaded(3500);
  check('switch: starts English', (await ev('I18N.lang')) === 'en');
  await key('k', 4); await settle(300); await type('sin'); await settle(400); await key('Enter'); await settle(1200);
  // the deformation open and paused at t = 0.5 (a playing one moves t on its own), the right panel hidden
  await ev(`__cmwMorph({ open: true }), 1`); await settle(600); await ev(`__cmwMorph({ T: 0.5 }), 1`); await settle(300);
  await ev(`document.getElementById('toggleRight').click(), 1`); await settle(400);
  const snapOf = `JSON.stringify({ st: __cmwState(), hist: document.getElementById('undoBtn').disabled, cards: document.querySelectorAll('#pipeline .card').length, morph: !!document.getElementById('morphPlay'), right: document.getElementById('toggleRight').getAttribute('aria-pressed'), view: (() => { const o = JSON.parse(localStorage.getItem(__qa.key()) || 'null'); return o && JSON.stringify({ view: o.view, rightView: o.rightView, l: o.leftView || o.lview || null, shapes: o.shapes, steps: o.steps }); })() })`;
  // the saved work is written now (the switch writes it too); the same JSON must come back
  await ev(`document.getElementById('undoBtn').disabled, 1`);
  // (reads it once the page has booted: after a load or a language switch, fixed sleeps ran out on a machine that draws
  // in software, and the snapshot threw)
  const snap = async () => { for (let i = 0; i < 300 && (await ev(`typeof __cmwState === 'function' && !!document.getElementById('undoBtn')`)) !== true; i++) await sleep(200); return JSON.parse(await ev(snapOf)); };
  const before = await snap();
  await setLang('ru');
  await sleep(4500); await settle(1500);
  const after = await snap();
  check('switch en→ru: Russian after the reload', (await ev('I18N.lang')) === 'ru' && (await ev('document.documentElement.lang')) === 'ru');
  check('switch en→ru: the work and view come back', JSON.stringify(after.st) === JSON.stringify(before.st), { before: before.st && Object.keys(before.st).length, after: after.st && Object.keys(after.st).length });
  check('switch en→ru: chain, deformation and panels', after.cards === before.cards && after.morph && after.morph === before.morph && after.right === 'false' && after.right === before.right, { before: { cards: before.cards, morph: before.morph, right: before.right }, after: { cards: after.cards, morph: after.morph, right: after.right } });
  check('switch en→ru: the saved work and the planes\' view come back', !!after.view && after.view === before.view, [before.view, after.view].map((v) => String(v).slice(0, 160)));
  check('switch en→ru: undo history kept', after.hist === false);
  await ev(`document.getElementById('undoBtn').click(), 1`); await settle(1000);
  check('switch en→ru: undo undoes the step added before the switch', (await ev(`document.querySelectorAll('#pipeline .card').length`)) === before.cards - 1);
  await ev(`document.getElementById('redoBtn').click(), 1`); await settle(800);
  const before2 = await snap();
  await setLang('auto');
  await sleep(4500); await settle(1500);
  const after2 = await snap();
  check('switch ru→auto: English again (?ns= keeps English), same work', (await ev('I18N.lang')) === 'en' && JSON.stringify(after2.st) === JSON.stringify(before2.st) && after2.cards === before2.cards && after2.morph === before2.morph);
  // the phone (v15 phone layout: More is a sheet, Language a four-way switch in it since Italian, bd48ab3): More → Русский
  await view(390, 844, false, true); await nav(`${U}?ns=${ns}`); await loaded(3500);
  const b3 = await snap();
  await ev(`document.getElementById('hdrMoreBtn').click(), 1`); await settle(500);
  const pm = await ev(`(() => { const b = document.querySelector('.ph-sheet .ph-seg button[data-v="ru"]'); if (!b) return null; const m = b.parentElement, r = m.getBoundingClientRect(); return { n: m.querySelectorAll('button').length, l: r.left, r: r.right, t: r.top }; })()`);
  check('phone: the Language switch in the More sheet, inside the window', pm && pm.n === 4 && pm.l >= 0 && pm.r <= 390 && pm.t >= 0, pm);
  await ev(`(() => { const b = document.querySelector('.ph-sheet .ph-seg button[data-v="ru"]'); b && b.click(); })()`);
  await sleep(4500); await settle(1500);
  const a3 = await snap();
  check('phone switch: Russian, same work', (await ev('I18N.lang')) === 'ru' && JSON.stringify(a3.st) === JSON.stringify(b3.st) && a3.cards === b3.cards, { cards: [b3.cards, a3.cards] });
  await ev(`I18N.setPref('auto'), 1`); await sleep(4000);
}
// ---- 5: ЙЦУКЕН shortcuts ----
{
  await view(1440, 900, false, false);
  await nav(`${U}?ns=i18n-keys-${Date.now()}&lang=ru`); await loaded(3500);
  await ev(`document.activeElement && document.activeElement.blur(), 1`);
  const press = async (k, code, mods = 0) => { const p = { type: 'keyDown', key: k, code, modifiers: mods, windowsVirtualKeyCode: code.startsWith('Key') ? code.charCodeAt(3) : code.startsWith('Digit') ? code.charCodeAt(5) : 0 }; if (!(mods & 6) && k.length === 1) p.text = k; await send('Input.dispatchKeyEvent', p); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, modifiers: mods }); await sleep(300); };
  const tool = () => ev(`(document.querySelector('.tool.on') || { dataset: {} }).dataset.tool || null`);
  await press('с', 'KeyC'); check('ЙЦУКЕН С (KeyC) → Circle', (await tool()) === 'circle');
  await press('в', 'KeyD'); check('ЙЦУКЕН В (KeyD) → Disc', (await tool()) === 'disc');
  await press('и', 'KeyB'); check('ЙЦУКЕН И (KeyB) → Rectangle', (await tool()) === 'rect');
  await press('ы', 'KeyS'); check('ЙЦУКЕН Ы (KeyS) → Segment', (await tool()) === 'segment');
  await press('м', 'KeyV'); check('ЙЦУКЕН М (KeyV) → Select', (await tool()) === 'select');
  await press('л', 'KeyK', 4); await settle(300); check('ЙЦУКЕН ⌘Л (KeyK) → palette', await ev(`!!document.querySelector('#popHost .palette, .pop.palette')`)); await press('Escape', 'Escape');
  await press('.', 'Slash'); await settle(300); check('ЙЦУКЕН «.» on the / key → palette', await ev(`!!document.querySelector('#popHost .palette, .pop.palette')`)); await press('Escape', 'Escape');
  await press('ь', 'KeyM'); await settle(600); check('ЙЦУКЕН Ь (KeyM) → deformation on', !!(await ev(`!!document.getElementById('morphPlay')`)));
  const paths = `(document.getElementById('pathsBtn') || {}).getAttribute ? document.getElementById('pathsBtn').getAttribute('aria-pressed') : null`;
  const p0 = await ev(paths);
  await press('з', 'KeyP'); await settle(400); const p1 = await ev(paths); check('ЙЦУКЕН З (KeyP) in the deformation → Paths toggled', p0 != null && p1 !== p0, [p0, p1]);
  await press('з', 'KeyP'); await settle(300);
  await press('ь', 'KeyM'); await settle(500); check('ЙЦУКЕН Ь again → deformation off', !(await ev(`!!document.getElementById('morphPlay')`)));
  await press('Ь', 'KeyM', 8); await settle(800); check('ЙЦУКЕН ⇧Ь (Shift+KeyM) → sound on', await ev(`document.getElementById('soundBtn').getAttribute('aria-pressed') === 'true'`));
  await press('Ь', 'KeyM', 8); await settle(500); check('ЙЦУКЕН ⇧Ь again → sound off', await ev(`document.getElementById('soundBtn').getAttribute('aria-pressed') === 'false'`));
  await press('2', 'Digit2'); await settle(900); check('digit 2 → Phase', (await ev(`__cmwState().view.main`)) === 'phase');
  await press('1', 'Digit1'); await settle(900); check('digit 1 → X → Y', (await ev(`__cmwState().view.main`)) === 'xy');
  await press('у', 'KeyE', 4); await settle(1500); check('ЙЦУКЕН ⌘У (KeyE) → export dialog', await ev(`!!document.querySelector('.modal-bg')`));
  await press('Escape', 'Escape'); await settle(500);
  // a text field keeps its letters: the region formula field
  await ev(`(() => { const f = document.getElementById('formulaInput'); f.value = ''; f.focus(); })()`);
  await press('м', 'KeyV'); await press('с', 'KeyC'); await press('ь', 'KeyM');
  const typed = await ev(`({ v: document.getElementById('formulaInput').value, tool: (document.querySelector('.tool.on') || { dataset: {} }).dataset.tool, morph: !!document.getElementById('morphPlay') })`);
  check('typing in a text field is never taken', typed.v === 'мсь' && typed.tool === 'select' && !typed.morph, typed);
  await ev(`document.getElementById('formulaInput').value = '', document.activeElement.blur(), 1`);
}
// ---- 6: detection ----
{
  const as = async (al, q) => { await send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36', acceptLanguage: al }); await nav(U + q); await loaded(3000); return ev(`({ lang: I18N.lang, nav: navigator.languages.join(','), html: document.documentElement.lang })`); };
  await view(1440, 900, false, false);
  await nav(U + '?ns=i18n-det'); await ev(`(() => { for (const k of Object.keys(localStorage)) if (/^cmw-lang/.test(k)) localStorage.removeItem(k); })()`);
  const r1 = await as('ru-RU,ru,en', ''); check('a ru-RU browser gets Russian', r1.lang === 'ru' && r1.html === 'ru', r1);
  const r2 = await as('ru-RU,ru,en', '?ns=i18n-det2'); check('?ns= stays English on a ru-RU browser', r2.lang === 'en', r2);
  const r3 = await as('uk-UA,ru', ''); check('uk-UA first stays English', r3.lang === 'en', r3);
  const r4 = await as('en-US,en', ''); check('an English browser stays English, <html lang> untouched', r4.lang === 'en' && r4.html === '', r4);
  await send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36', acceptLanguage: 'en-US,en' });
}
// ---- 7: the decimal-comma hint, notation ----
{
  await open('ru', 1440, false);
  const m = await ev(`(() => { const r = {}; for (const s of ['0,5', 'sin(0,5z)', 'z^0,5', '|z|<1']) { try { Expr.parse(s); r[s] = null; } catch (e) { r[s] = e.message; } } return r; })()`);
  check('ru: "0,5" gets the hint', /Дробную часть отделяйте точкой: 0\.5/.test(m['0,5']), m['0,5']);
  check('ru: "sin(0,5z)" gets the hint after its message', /Дробную часть отделяйте точкой: 0\.5$/.test(m['sin(0,5z)'] || ''), m['sin(0,5z)']);
  check('ru: "z^0,5" gets the hint', /Дробную часть отделяйте точкой/.test(m['z^0,5'] || ''), m['z^0,5']);
  await key('k', 4); await settle(300); await type('tan'); await settle(600);
  const pal = await ev(`document.querySelector('#popHost .pal-item') ? [...document.querySelectorAll('#popHost .pal-item')].slice(0, 4).map((e) => e.textContent).join(' | ') : ''`);
  check('ru palette: "tan" finds the tangent', /тангенс|tg/.test(pal), pal.slice(0, 160));
  await key('Escape');
  for (const [q, re, what] of [['дзета', /ζ/, 'ζ'], ['факториал', /Γ/, 'Γ']]) {
    await key('k', 4); await settle(300); await type(q); await settle(600);
    const p2 = await ev(`[...document.querySelectorAll('#popHost .pal-item')].slice(0, 4).map((e) => e.textContent).join(' | ')`);
    check(`ru palette: "${q}" finds ${what}`, re.test(p2), p2.slice(0, 160));
    await key('Escape');
  }
  await open('en', 1440, false);
  const e = await ev(`(() => { try { Expr.parse('0,5'); return null; } catch (e) { return e.message; } })()`);
  check('en: "0,5" keeps its English message', e === "Unexpected ','", e);
}
// ---- 8 (v16.1 user-5): the logarithm's example and its Landscape title say which sheets, in Russian ----
{
  await open('ru', 1440, false);
  // (the example picked from the Examples list by its Russian name)
  await clickSel('#examplesBtn'); await settle(500);
  const ex = await ev(`(() => { const b = [...document.querySelectorAll('#popHost .examples .ex-name')].find((e) => /Листы логарифма/.test(e.textContent)); if (!b) return [...document.querySelectorAll('#popHost .examples .ex-name')].map((e) => e.textContent).join(' | '); b.closest('button, [role="menuitem"], .mi').click(); return true; })()`);
  check('ru: the example is named «Листы логарифма» (not «Все листы»)', ex === true, ex);
  await settle(2500);
  const t = await ev(`(() => { const e = document.querySelector('.prole .rf') || document.querySelector('.prole'); return e ? e.textContent : null; })()`);
  check('ru: the Landscape title names the window of sheets («листы k = −2…2»), not «все листы»', /, листы k = −2…2$/.test(t || '') && !/все листы/.test(t || ''), t);
}
const errs = logs().filter((l) => /error|exception/i.test(JSON.stringify(l)) && !/favicon|404|fonts\.g/.test(JSON.stringify(l)));
check('no console errors', errs.length === 0, errs.slice(0, 5));
const fails = R.filter((r) => !r[1]);
return { pass: R.length - fails.length, of: R.length, fails };
