// Browser acceptance of the Russian interface (phase 2b, notes/i18n/PHASE2B.md). Serve dist/ on the kit's port and run
// with a copy of test/cdp_kit: test/<you>_cdp/q.sh test/i18n_cmd.js. Result: { pass, of, fails: [[name, false, detail]] }.
//   1. Overflow, Russian and Italian against English, at 360, 390, 768, 900, 1024 and 1440 px, light and dark: the page never
//      scrolls sideways, the top bar fits, and no element is clipped in Russian that is not clipped in English.
//   2. No English left in the first screen and the header's menus at every width (test/i18n_scan.js). The full walk of
//      every view, dialog and tour step is test/i18n_walk_cmd.js.
//   3. Language: no globe in the bar; a four-way switch (Auto, English, Русский, Italiano) in ⚙ Settings and in the
//      phone's More sheet; the same rows in the palette ("язык", "language"). From 768 px the bar has no More button
//      and holds the secondary buttons, as at 1024 (frame f6, notes/ui-redesign-2/README.md).
//   4. Switching round-trips: work, view, undo history and open panels come back, in both directions, through the UI.
//   5. ЙЦУКЕН shortcuts through e.code; typing in a text field is never taken.
//   6. Detection: a ru-RU browser gets Russian; ?ns= pages stay English; uk-UA stays English.
//   7. The decimal-comma hint and Russian notation in the palette.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const SCAN = fs.readFileSync(path.join(DIR, '..', 'i18n_scan.js'), 'utf8');
const R = [];
const check = (name, pass, detail) => R.push([name, !!pass, detail === undefined ? null : detail]);
const kit = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'wait_kit.js'), 'utf8'))({ settled, ev, sleep, fails: { push: (f) => check(f.name, false, f.got) } });
const until = (expr, max = 5000) => settled({ max, only: true, until: expr });
const PAL = `!!document.querySelector('#popHost .palette, .pop.palette')`;
const ITEMS = `!!document.querySelector('#popHost .pal-item')`;
const settle = async (ms = 900) => { await sleep(ms); await ev('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
// a page just opened: the pause it always had, then its ready state (loaded, I18N there, the chain built), which a
// busy machine reaches later than any fixed pause; then two frames
const loaded = async (pause, ms = 30000) => {
  await settled({ max: pause });
  for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(200)) {
    let ok = false;
    try { ok = await ev(`document.readyState === 'complete' && typeof I18N === 'object' && !!document.querySelector('#svStrip .sv-add')`); } catch (e) { /* navigating */ }
    if (ok) break;
  }
  await settle(0);
};
const open = async (lang, w, dark, extra = '') => {
  const phone = w < 768;
  await view(w, phone ? 844 : 900, dark, phone);
  await go(`${U}?ns=i18n-${lang}-${w}${dark ? 'd' : ''}-${Date.now()}${lang ? '&lang=' + lang : ''}${extra}`); await loaded(3500);
  // (until MathJax has typeset the page's formulas, at most 15 s: it starts after the first paint, 3 to 5 s on a software
  // renderer, and a formula shows its fallback until then, #288)
  for (let i = 0; i < 60 && !(await ev(`!!(window.MathJax && MathJax.startup && MathJax.startup.document) && !document.querySelector('.tex-fallback')`)); i++) await sleep(250);
};
logs();
// ---- 1, 2: overflow and the first screen ----
// (an element no one sees is never clipped for a reader: a box of 1 px or less each way, or one a clip-path of inset(50%)
// or a clip of rect(0 0 0 0) hides, as the visually hidden live regions are styled (.sr-only); read from the computed style,
// not the element's name, so the next live region is skipped too)
const CLIP = `(() => {
  const out = [], W = innerWidth;
  const unseen = (cs, r) => (r.width <= 1 && r.height <= 1) || /^inset\\(\\s*50%/.test(cs.clipPath) || /^rect\\(0(px)?,?\\s*0(px)?,?\\s*0(px)?,?\\s*0(px)?\\)$/.test(cs.clip);
  const name = (e) => (e.id ? '#' + e.id : (e.closest('[id]') ? '#' + e.closest('[id]').id + ' ' : '') + e.tagName.toLowerCase() + '.' + [...e.classList].slice(0, 2).join('.'));
  for (const e of document.querySelectorAll('body *')) {
    if (!e.offsetParent && getComputedStyle(e).position !== 'fixed') continue;
    const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const r = e.getBoundingClientRect(); if (!r.width || !r.height || unseen(cs, r)) continue;
    if (e.closest('svg, mjx-container, canvas, .pane, .scroll, [data-scroll]')) continue;
    const text = [...e.childNodes].some((c) => c.nodeType === 3 && c.data.trim());
    if (text && (cs.overflow === 'hidden' || cs.textOverflow === 'ellipsis' || cs.overflowX === 'hidden') && e.scrollWidth > e.clientWidth + 1) out.push('clip ' + name(e));
    if (r.right > W + 1 && cs.position !== 'fixed' && !e.closest('.hdr-menu:not(:popover-open), [popover]:not(:popover-open)')) out.push('past edge ' + name(e));
  }
  const top = document.querySelector('.top');
  return { page: document.documentElement.scrollWidth > W + 0.5, bar: top ? top.scrollWidth > top.clientWidth + 0.5 : false, els: [...new Set(out)] };
})()`;
// (the check itself, on the English page at 1440: a visually hidden live region with text, styled as .sr-only is but with no
// class or id the check knows, is not reported; a visible element that cuts its text is)
{
  await open('en', 1440, false);
  const got = await ev(`(() => {
    const hid = document.createElement('div'), cut = document.createElement('div');
    hid.id = 'xClipHidden'; hid.setAttribute('aria-live', 'polite'); hid.textContent = 'a long announcement that does not fit in one pixel';
    hid.style.cssText = 'position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0';
    cut.id = 'xClipShown'; cut.textContent = 'a long label that does not fit in forty pixels';
    cut.style.cssText = 'position:fixed;left:20px;top:200px;width:40px;overflow:hidden;white-space:nowrap';
    document.body.append(hid, cut);
    const r = ${CLIP};
    hid.remove(); cut.remove();
    return r.els;
  })()`);
  check('the clip check: a visually hidden live region with text is not reported', !got.includes('clip #xClipHidden'), got);
  check('the clip check: a visible element that cuts its text is', got.includes('clip #xClipShown'), got);
}
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
// ---- 1b: Italian against English (#61's fitting rules are Russian-only; Italian gets the overflow checks too, from a
// phone to a wide desktop; its text is longer than English, shorter than Russian in most labels) ----
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
// (the header has no globe: Language is a four-way switch in ⚙ Settings, and in the phone's More sheet; the owner's
// decision of 2026-10-28, notes/i18n/USER-DECISIONS.md)
const setLang = async (v) => { await ev(`document.getElementById('settingsBtn').click(), 1`); await settle(400); return ev(`(() => { const b = document.querySelector('.set-pop #setLang [data-v="${v}"]'); if (!b) return false; b.click(); return true; })()`); };
await open('ru', 1440, false);
check('no globe in the bar: Language is in Settings', await ev(`!document.getElementById('langBtn') && !!document.getElementById('settingsBtn').offsetParent`));
await ev(`document.getElementById('settingsBtn').click(), 1`); await settle(500);
const items = await ev(`[...document.querySelectorAll('.set-pop #setLang button')].map((e) => e.textContent)`);
check('Settings: Language Авто, English, Русский, Italiano', JSON.stringify(items) === JSON.stringify(['Авто', 'English', 'Русский', 'Italiano']), items);
const mrect = await ev(`(() => { const m = document.querySelector('.set-pop'); if (!m) return null; const r = m.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; })()`);
check('Settings inside the window', mrect && mrect.l >= 0 && mrect.r <= 1440 && mrect.t >= 0, mrect);
await key('Escape'); await until(`!document.querySelector('.set-pop')`);
for (const q of ['язык', 'language']) {
  await key('k', 4); await until(PAL); await type(q); await until(ITEMS);
  const rows = await ev(`[...document.querySelectorAll('.pal-item .pal-label')].map((e) => e.textContent).filter((t) => /^Язык:/.test(t))`);
  check(`palette "${q}": the four Language rows`, rows.length === 4, rows);
  await key('Escape'); await until(`!document.querySelector('#popHost .palette, .pop.palette')`);
}
// (from 768 to 1023 the bar follows frame f6, as from 1024: no More button; the secondary buttons are in the bar,
// inside the window, and Settings, with Language, opens there)
for (const w of [768, 900, 1023]) {
  await open('ru', w, false);
  const st = await ev(`(() => { const vis = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
    // (Theme and the panel buttons are in Settings; the bar has Share and Settings)
    const ids = ['examplesBtn', 'cmdBtn', 'exportBtn', 'shareBtn', 'soundBtn', 'settingsBtn', 'helpBtn'];
    const inBar = ids.filter((id) => { const e = document.getElementById(id), r = e && e.getBoundingClientRect(); return vis(e) && r.top < 60 && r.right <= innerWidth - 4 && r.left >= 0; });
    return { more: vis(document.getElementById('hdrMoreBtn')), inBar, over: document.documentElement.scrollWidth - innerWidth }; })()`);
  check(`tablet ${w}: no More button; the secondary buttons in the bar, inside the window`, !st.more && st.inBar.length === 7 && st.over <= 0, st);
  await ev(`document.getElementById('settingsBtn').click(), 1`); await settle(500);
  const lm = await ev(`(() => { const m = document.querySelector('.set-pop'); if (!m) return null; const r = m.getBoundingClientRect(); return { n: m.querySelectorAll('#setLang button').length, l: r.left, r: r.right, t: r.top, b: r.bottom }; })()`);
  check(`tablet ${w}: Settings, with Language, opens from the bar, inside the window`, lm && lm.n === 4 && lm.l >= 0 && lm.r <= w && lm.t >= 0, lm);
  await key('Escape'); await until(`!document.querySelector('.set-pop')`);
}
for (const w of [1024, 1440]) {
  await open('en', w, false);
  check(`${w}: no More button, Settings in the bar (English)`, await ev(`getComputedStyle(document.getElementById('hdrMoreBtn')).display === 'none' && !!document.getElementById('settingsBtn').offsetParent`));
}
// ---- 4: switching round-trips through the UI ----
{
  const ns = 'i18n-sw-' + Date.now();
  await view(1440, 900, false, false);
  await go(`${U}?ns=${ns}`); await loaded(3500);
  check('switch: starts English', (await ev('I18N.lang')) === 'en');
  await key('k', 4); await until(PAL); await type('sin'); await until(ITEMS); await key('Enter'); await until(`!document.querySelector('#popHost .palette, .pop.palette') && !!document.querySelector('#svStrip .sv-step[data-k="1"] .sv-fchip')`);
  // a step chosen on the thread (the Inspector's step, the thread's place), the right panel hidden
  await ev(`(() => { const c = document.querySelector('#svStrip .sv-step[data-k="1"] .sv-fchip'); if (!c) return false; c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' })); c.click(); return true; })()`); await settle(1500);
  await ev(`document.getElementById('toggleRight').click(), 1`); await settle(400);
  const snapOf = `JSON.stringify({ st: __cmwState(), hist: document.getElementById('undoBtn').disabled, n: (() => { const o = JSON.parse(localStorage.getItem(__qa.key()) || 'null'); return o && o.steps ? o.steps.length : -1; })(), sv: (() => { const s = __cmwSteps(); return JSON.stringify({ on: s.on, sel: s.sel, i: s.i, T: s.T, main: s.main, surf: s.surf, scope: s.scope, all: s.all }); })(), right: document.getElementById('toggleRight').getAttribute('aria-pressed'), view: (() => { const o = JSON.parse(localStorage.getItem(__qa.key()) || 'null'); return o && JSON.stringify({ view: o.view, rightView: o.rightView, l: o.leftView || o.lview || null, shapes: o.shapes, steps: o.steps }); })() })`;
  // the saved work is written now (the switch writes it too); the same JSON must come back
  await ev(`document.getElementById('undoBtn').disabled, 1`);
  // (reads it once the page has booted: after a load or a language switch, fixed sleeps ran out on a machine that draws
  // in software, and the snapshot threw)
  const snap = async () => { for (let i = 0; i < 300 && (await ev(`typeof __cmwState === 'function' && !!document.getElementById('undoBtn')`)) !== true; i++) await sleep(200); return await evJson(snapOf); };
  const before = await snap();
  await setLang('ru');
  await sleep(4500); await settle(1500);
  const after = await snap();
  check('switch en→ru: Russian after the reload', (await ev('I18N.lang')) === 'ru' && (await ev('document.documentElement.lang')) === 'ru');
  check('switch en→ru: the work and view come back', JSON.stringify(after.st) === JSON.stringify(before.st), { before: before.st && Object.keys(before.st).length, after: after.st && Object.keys(after.st).length });
  check('switch en→ru: the steps view, the chosen step and the panels', after.n === before.n && !!after.sv && after.sv === before.sv && JSON.parse(after.sv).sel === 1 && after.right === 'false' && after.right === before.right, { before: { n: before.n, sv: before.sv, right: before.right }, after: { n: after.n, sv: after.sv, right: after.right } });
  check('switch en→ru: the saved work and the planes\' view come back', !!after.view && after.view === before.view, [before.view, after.view].map((v) => String(v).slice(0, 160)));
  check('switch en→ru: undo history kept', after.hist === false);
  await ev(`document.getElementById('undoBtn').click(), 1`); await settle(1000);
  check('switch en→ru: undo undoes the step added before the switch', (await ev(`(() => { const o = JSON.parse(localStorage.getItem(__qa.key()) || 'null'); return o && o.steps ? o.steps.length : -1; })()`)) === before.n - 1);
  await ev(`document.getElementById('redoBtn').click(), 1`); await settle(800);
  const before2 = await snap();
  await setLang('auto');
  await sleep(4500); await settle(1500);
  const after2 = await snap();
  check('switch ru→auto: English again (?ns= keeps English), same work', (await ev('I18N.lang')) === 'en' && JSON.stringify(after2.st) === JSON.stringify(before2.st) && after2.n === before2.n && after2.sv === before2.sv);
  // the phone (More is a sheet, with Language as a four-way switch in it): More → Русский
  await view(390, 844, false, true); await go(`${U}?ns=${ns}`); await loaded(3500);
  const b3 = await snap();
  await ev(`document.getElementById('hdrMoreBtn').click(), 1`); await settle(500);
  const pm = await ev(`(() => { const b = document.querySelector('.ph-sheet .ph-seg button[data-v="ru"]'); if (!b) return null; const m = b.parentElement, r = m.getBoundingClientRect(); return { n: m.querySelectorAll('button').length, l: r.left, r: r.right, t: r.top }; })()`);
  check('phone: the Language switch in the More sheet, inside the window', pm && pm.n === 4 && pm.l >= 0 && pm.r <= 390 && pm.t >= 0, pm);
  await ev(`(() => { const b = document.querySelector('.ph-sheet .ph-seg button[data-v="ru"]'); b && b.click(); })()`);
  await sleep(4500); await settle(1500);
  const a3 = await snap();
  check('phone switch: Russian, same work', (await ev('I18N.lang')) === 'ru' && JSON.stringify(a3.st) === JSON.stringify(b3.st) && a3.n === b3.n && a3.sv === b3.sv, { n: [b3.n, a3.n], sv: [b3.sv, a3.sv] });
  await ev(`I18N.setPref('auto'), 1`); await sleep(4000);
}
// ---- 5: ЙЦУКЕН shortcuts ----
// (the classic views' part, in i18n_classic_cmd.js: С is the Circle tool there, here it is the colour plane; Ь opens the
// deformation and З its Paths; digits 1 and 2 pick X → Y and Phase, and the steps view picks its plane by stage)
{
  await view(1440, 900, false, false);
  await go(`${U}?ns=i18n-keys-${Date.now()}&lang=ru`); await loaded(3500);
  await ev(`document.activeElement && document.activeElement.blur(), 1`);
  // (a key, then the page's quiet, at most 3 s; with quiet false, no wait: the caller waits for what the key starts)
  const press = async (k, code, mods = 0, quiet = true) => { const p = { type: 'keyDown', key: k, code, modifiers: mods, windowsVirtualKeyCode: code.startsWith('Key') ? code.charCodeAt(3) : code.startsWith('Digit') ? code.charCodeAt(5) : 0 }; if (!(mods & 6) && k.length === 1) p.text = k; await send('Input.dispatchKeyEvent', p); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, modifiers: mods }); if (quiet) await settled({ max: 3000 }); };
  const tool = () => ev(`(document.querySelector('.tool.on') || { dataset: {} }).dataset.tool || null`);
  // (С is C: the colour plane, as on a Latin layout; the thread is taken to the first plane, then С sets it as the colour plane)
  await ev(`__cmwSteps({ go: 0, now: true }), 1`);
  const T0 = await ev(`__cmwSteps().T`);
  await press('с', 'KeyC'); await settled({ max: 5000, only: true, until: `__cmwSteps().T === 0` }); check('ЙЦУКЕН С (KeyC) → the shown plane is the colour plane', T0 !== 0 && (await ev(`__cmwSteps().T`)) === 0, T0);
  await press('в', 'KeyD'); check('ЙЦУКЕН В (KeyD) → Disc', (await tool()) === 'disc');
  await press('и', 'KeyB'); check('ЙЦУКЕН И (KeyB) → Rectangle', (await tool()) === 'rect');
  await press('ы', 'KeyS'); check('ЙЦУКЕН Ы (KeyS) → Segment', (await tool()) === 'segment');
  await press('м', 'KeyV'); check('ЙЦУКЕН М (KeyV) → Select', (await tool()) === 'select');
  await press('л', 'KeyK', 4); await until(PAL); check('ЙЦУКЕН ⌘Л (KeyK) → palette', await ev(PAL)); await press('Escape', 'Escape'); await until(`!${PAL}`);
  await press('.', 'Slash'); await until(PAL); check('ЙЦУКЕН «.» on the / key → palette', await ev(PAL)); await press('Escape', 'Escape'); await until(`!${PAL}`);
  // (K and M play and pause the thread, P toggles its Paths; the thread is idle first)
  await settled({ max: 20000, until: `!__cmwSteps().moving && !!document.querySelector('#svStrip .sv-play') && !!document.querySelector('#svStrip .sv-paths')` });
  // (the page counts the plays that start, the times the Play button's label leaves its idle label, so a check can read
  // that a key played whether or not the play has ended by then; a key plays when the count goes up)
  await ev(`(() => { const b = document.querySelector('#svStrip .sv-play'); window.__starts = 0; let was = b.getAttribute('aria-label'); new MutationObserver(() => { const n = b.getAttribute('aria-label'); if (n !== was && n !== window.__idleLabel) window.__starts++; was = n; }).observe(b, { attributes: true, attributeFilter: ['aria-label'] }); window.__idleLabel = was; })(), 1`);
  // (a key that plays has no quiet wait of its own: the page is quiet only once the play has ended, 900 ms a plane at the
  // normal speed and the arrival's frames after it, which can take more than 3 s on a software renderer; the play's start
  // is waited for here, and its end after each check)
  const playsTo = async (k, code, n) => { await kit.prepared('true', 60000); await press(k, code, 0, false); await settled({ max: 5000, only: true, until: `window.__starts >= ${n}` }); return ev(`window.__starts >= ${n}`); };
  check('ЙЦУКЕН Ь (KeyM) → the thread plays', await playsTo('ь', 'KeyM', 1));
  await settled({ max: 20000, until: `!__cmwSteps().moving` });
  check('ЙЦУКЕН Л (KeyK) → the thread plays', await playsTo('л', 'KeyK', 2));
  await settled({ max: 20000, until: `!__cmwSteps().moving` });
  const paths = `document.querySelector('#svStrip .sv-paths').getAttribute('aria-pressed')`;
  const p0 = await ev(paths);
  await press('з', 'KeyP'); await settled({ max: 5000, only: true, until: `${paths} !== ${JSON.stringify(p0)}` }); const p1 = await ev(paths); check('ЙЦУКЕН З (KeyP) → Paths toggled', p0 != null && p1 !== p0, [p0, p1]);
  await press('з', 'KeyP'); await settled({ max: 5000, only: true, until: `${paths} === ${JSON.stringify(p0)}` });
  // (⌘У has no quiet wait of its own: the export dialog it opens is there at once, but the page is quiet only once the
  // dialog has built and typeset its figure, 1.6 to 2.6 s on a software renderer; the wait is for the dialog, and Escape
  // stops the build)
  await press('у', 'KeyE', 4, false); await until(`!!document.querySelector('.modal-bg')`, 10000); check('ЙЦУКЕН ⌘У (KeyE) → export dialog', await ev(`!!document.querySelector('.modal-bg')`));
  await press('Escape', 'Escape'); await until(`!document.querySelector('.modal-bg')`);
  // a text field keeps its letters: the region formula field
  await ev(`(() => { const f = document.getElementById('formulaInput'); f.value = ''; f.focus(); })()`);
  await press('м', 'KeyV'); await press('с', 'KeyC'); await press('ь', 'KeyM');
  const typed = await ev(`({ v: document.getElementById('formulaInput').value, tool: (document.querySelector('.tool.on') || { dataset: {} }).dataset.tool, starts: window.__starts })`);
  check('typing in a text field is never taken', typed.v === 'мсь' && typed.tool === 'select' && typed.starts === 2, typed);
  await ev(`document.getElementById('formulaInput').value = '', document.activeElement.blur(), 1`);
}
// ---- 6: detection ----
{
  const as = async (al, q) => { await send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36', acceptLanguage: al }); await go(U + q); await loaded(3000); return ev(`({ lang: I18N.lang, nav: navigator.languages.join(','), html: document.documentElement.lang })`); };
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
  await key('k', 4); await until(PAL); await type('tan'); await until(ITEMS);
  const pal = await ev(`document.querySelector('#popHost .pal-item') ? [...document.querySelectorAll('#popHost .pal-item')].slice(0, 4).map((e) => e.textContent).join(' | ') : ''`);
  check('ru palette: "tan" finds the tangent', /тангенс|tg/.test(pal), pal.slice(0, 160));
  await key('Escape');
  for (const [q, re, what] of [['дзета', /ζ/, 'ζ'], ['факториал', /Γ/, 'Γ']]) {
    await key('k', 4); await until(PAL); await type(q); await until(ITEMS);
    const p2 = await ev(`[...document.querySelectorAll('#popHost .pal-item')].slice(0, 4).map((e) => e.textContent).join(' | ')`);
    check(`ru palette: "${q}" finds ${what}`, re.test(p2), p2.slice(0, 160));
    await key('Escape');
  }
  await open('en', 1440, false);
  const e = await ev(`(() => { try { Expr.parse('0,5'); return null; } catch (e) { return e.message; } })()`);
  check('en: "0,5" keeps its English message', e === "Unexpected ','", e);
}
// ---- 8: the logarithm's example and its Landscape title say which sheets, in Russian ----
{
  await open('ru', 1440, false);
  // (the example picked from the Examples list by its Russian name)
  await clickSel('#examplesBtn'); await until(`!!document.querySelector('#popHost .examples .ex-name')`);
  const ex = await ev(`(() => { const b = [...document.querySelectorAll('#popHost .examples .ex-name')].find((e) => /Листы логарифма/.test(e.textContent)); if (!b) return [...document.querySelectorAll('#popHost .examples .ex-name')].map((e) => e.textContent).join(' | '); b.closest('button, [role="menuitem"], .mi').click(); return true; })()`);
  check('ru: the example is named «Листы логарифма» (not «Все листы»)', ex === true, ex);
  // (the plane head of the thread's first plane names the window of sheets its Landscape draws; the plane after the
  // logarithm, a carry from z, draws one surface, and its head names none: the title says what the pane draws, #1741)
  const head = `(document.querySelector('#svHead') || document.querySelector('.prole') || {}).textContent || ''`;
  const sheetsHead = `/, листы k = −2…2/.test(${head}) && !/все листы/.test(${head})`;
  await until(sheetsHead, 15000);
  check('ru: the steps plane head names the window of sheets («листы k = −2…2»), not «все листы»', await ev(sheetsHead), await ev(head));
  await ev(`__cmwSteps({ go: 1, now: true }), 1`);
  await until(`/w1/.test(${head}) || /w₁/.test(${head})`, 5000);
  // (the head changes as the step is taken; the Landscape's draw for plane 1 follows a frame or more later: until then
  // __cmwLandSheets().drawn is still plane 0's window of sheets, K = 5)
  await until('((__cmwLandSheets().drawn || {}).K || 1) === 1', 10000);
  const one = await ev(`({ K: (__cmwLandSheets().drawn || {}).K || 1, head: ${head} })`);
  check('ru: the plane after the logarithm draws one surface, and its head names no sheets (neither «листы» nor «все листы»)', one.K === 1 && !/листы/.test(one.head), one);
}
const errs = logs().filter((l) => /error|exception/i.test(JSON.stringify(l)) && !/favicon|404|fonts\.g/.test(JSON.stringify(l)));
check('no console errors', errs.length === 0, errs.slice(0, 5));
const fails = R.filter((r) => !r[1]);
return { pass: R.length - fails.length, of: R.length, fails };
