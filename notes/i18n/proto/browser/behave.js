// browser checks: English unchanged against the base build, letter shortcuts on the Russian layout, a language
// switch that keeps the work, the view and the undo history
// the server's origin: the run copy substitutes its own port for 8817
const BASE = 'http://localhost:8817';
const RUN = Date.now().toString(36);   // fresh namespaces: an earlier run's saved state never leaks in
const R = {};
const fails = [];
const ok = (name, c, got) => { if (!c) fails.push({ name, got }); };
// review i18n-2: snapDom: every element; snapVis: rendered elements only (what a person sees). The header keeps the
// Language (globe) button in both languages (user decision 2026-10-22): it is the one named exception, asserted below
const snapVis = `(() => { const out = []; const app = document.getElementById('app'); for (const el of app.querySelectorAll('*')) { if (!el.checkVisibility()) continue; for (const a of ['title','aria-label','placeholder','data-tip']) { const v = el.getAttribute(a); if (v) out.push(a + '=' + v); } for (const n of el.childNodes) if (n.nodeType === 3 && n.data.trim()) out.push(n.data.trim()); } return out; })()`;
const snapDom = `(() => { const out = []; const app = document.getElementById('app'); for (const el of app.querySelectorAll('*')) { for (const a of ['title','aria-label','placeholder','data-tip']) { const v = el.getAttribute(a); if (v) out.push(a + '=' + v); } for (const n of el.childNodes) if (n.nodeType === 3 && n.data.trim()) out.push(n.data.trim()); } return out; })()`;
const canv = `(() => { const c = document.getElementById('canvasR'); const g = c.getContext('webgl2') || c.getContext('2d'); const d = document.createElement('canvas'); d.width = c.width; d.height = c.height; const x = d.getContext('2d'); x.drawImage(c, 0, 0); const px = x.getImageData(0, 0, d.width, d.height).data; let h = 0; for (let i = 0; i < px.length; i += 7) h = (h * 31 + px[i]) >>> 0; return d.width + 'x' + d.height + ':' + h; })()`;
const lefthash = `(() => { const c = document.getElementById('canvasL'); const d = document.createElement('canvas'); d.width = c.width; d.height = c.height; const x = d.getContext('2d'); x.drawImage(c, 0, 0); const px = x.getImageData(0, 0, d.width, d.height).data; let h = 0; for (let i = 0; i < px.length; i += 7) h = (h * 31 + px[i]) >>> 0; return d.width + 'x' + d.height + ':' + h; })()`;
// 1. English: the same DOM text and the same planes as the base build (test.html vs base.html), Russian browser
//    languages included: a test namespace stays English
await send('Emulation.setLocaleOverride', { locale: 'ru-RU' }).catch(() => {});
await send('Network.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (Macintosh) Chrome/130 Safari/537.36', acceptLanguage: 'ru-RU,ru', platform: 'MacIntel' }).catch(() => {});
await view(1440, 900, false);
await nav(BASE + '/base.html?ns=engbase' + RUN + '');
await sleep(3500);
const settled = async (expr) => { let a = await ev(expr); for (let i = 0; i < 8; i++) { await sleep(1500); const b = await ev(expr); if (a === b) return b; a = b; } return a; };
const baseR = await settled(canv), baseL = await settled(lefthash);
const baseDom = await ev(snapDom), baseVis = await ev(snapVis);
await nav(BASE + '/test.html?ns=engnew' + RUN + '');
await sleep(3500);
R.navLang = await ev('navigator.languages.join(",") + " / " + I18N._detect(navigator) + " / ui " + I18N.uiLang');
const newR = await settled(canv), newL = await settled(lefthash);
const newDom = await ev(snapDom), newVis = await ev(snapVis);
const minus = (a, b) => { const m = new Map(); for (const x of b) m.set(x, (m.get(x) || 0) + 1); return a.filter((x) => { const c = m.get(x) || 0; if (c) { m.set(x, c - 1); return false; } return true; }); };
R.domAdded = minus(newDom, baseDom); R.domRemoved = minus(baseDom, newDom);
ok('English DOM: the only addition is the phone Language row', JSON.stringify(R.domAdded.sort()) === JSON.stringify(['Auto', 'Language:', 'aria-label=Language: Auto', 'title=Language']) && R.domRemoved.length === 0, { added: R.domAdded, removed: R.domRemoved });
// the globe's own visible strings, read from the button itself: the only difference allowed at 1440 px
R.langBtnVis = await ev(`(() => { const b = document.getElementById('langBtn'); if (!b.checkVisibility()) return null; const out = []; for (const el of [b, ...b.querySelectorAll('*')]) { if (!el.checkVisibility()) continue; for (const a of ['title','aria-label','placeholder','data-tip']) { const v = el.getAttribute(a); if (v) out.push(a + '=' + v); } for (const n of el.childNodes) if (n.nodeType === 3 && n.data.trim()) out.push(n.data.trim()); } return out; })()`);
R.visAdded = minus(newVis, baseVis); R.visRemoved = minus(baseVis, newVis);
ok('English 1440 px: the globe button is in the header (user decision 2026-10-22)', Array.isArray(R.langBtnVis) && R.langBtnVis.length > 0, R.langBtnVis);
ok('English rendered DOM at 1440 px equals the base except #langBtn', JSON.stringify(R.visAdded.slice().sort()) === JSON.stringify((R.langBtnVis || []).slice().sort()) && R.visRemoved.length === 0, { added: R.visAdded, removed: R.visRemoved, langBtn: R.langBtnVis });
// 768-1023 px: the bar is short of room, so the globe folds away and the bar gets no wider than the base
const barW = `(() => { const t = document.querySelector('.top'); return [t.scrollWidth - t.clientWidth, document.getElementById('langBtn').checkVisibility()]; })()`;
R.bar = {};
for (const w of [768, 900, 1000]) {
  await view(w, 900, false); await sleep(400);
  const nb = await ev(barW);
  await nav(BASE + '/base.html?ns=engbase' + RUN + ''); await sleep(2500);
  const bb = await ev(`(() => { const t = document.querySelector('.top'); return t.scrollWidth - t.clientWidth; })()`);
  await nav(BASE + '/test.html?ns=engnew' + RUN + ''); await sleep(2500);
  R.bar[w] = { base: bb, now: nb[0], globe: nb[1] };
  ok(`English ${w} px: the globe folds, the bar is no wider than the base`, nb[1] === false && nb[0] <= bb, R.bar[w]);
}
await view(1440, 900, false); await sleep(600);
await view(390, 844, false, true); await sleep(600);
R.phoneLangRow = await ev(`(() => { document.getElementById('hdrMoreBtn').click(); const b = document.getElementById('langBtn'); const v = b.checkVisibility(); document.getElementById('hdrMenu').hidePopover(); return v; })()`);
ok('phone: the Language row is in the More menu', R.phoneLangRow === true, R.phoneLangRow);
await view(1440, 900, false); await sleep(400);
ok('English right plane pixels identical', baseR === newR, [baseR, newR]);
ok('English left plane pixels identical', baseL === newL, [baseL, newL]);
R.enLang = await ev(`[document.documentElement.getAttribute('lang'), !!document.getElementById('i18n-fonts'), document.documentElement.dataset.lang || ''].join('|')`);
R.baseLang = await ev(`await fetch(BASE_URL).then((r) => r.text()).then((t) => (/<html[^>]*lang="([^"]*)"/.exec(t) || [0, 'none'])[1])`.replace('BASE_URL', JSON.stringify(BASE + '/base.html')));
ok('English: <html lang> untouched, no font link, no data-lang (review i18n-20)', R.enLang === `${R.baseLang === 'none' ? '' : R.baseLang}|false|`, [R.enLang, R.baseLang]);
R.enTableFetch = await ev(`performance.getEntriesByType('resource').some((e) => e.name.includes('i18n/ru.json'))`);
ok('English fetches no Russian table (review i18n-18)', R.enTableFetch === false, R.enTableFetch);
R.enFontLink = await ev(`!!document.getElementById('i18n-fonts')`);
ok('English loads no Cyrillic faces', R.enFontLink === false, R.enFontLink);
// 2. Russian layout: e.key is Cyrillic, e.code is the physical key
await nav(BASE + '/test.html?ns=rukeys' + RUN + '&lang=ru');
await sleep(3000);
const rk = async (k, code, kc, mods = 0) => { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: kc, text: mods & 6 ? '' : k, unmodifiedText: k, modifiers: mods }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: kc, modifiers: mods }); await sleep(250); };
await move(700, 450);
const toolOn = `(document.querySelector('.tool.on') || {}).dataset ? document.querySelector('.tool.on').dataset.tool : null`;
await rk('с', 'KeyC', 67); R.afterC = await ev(toolOn); ok('С (C) picks Circle', R.afterC === 'circle', R.afterC);
await rk('м', 'KeyV', 86); R.afterV = await ev(toolOn); ok('М (V) picks Select', R.afterV === 'select', R.afterV);
const hidL = `getComputedStyle(document.getElementById('leftPanel')).display + '/' + document.getElementById('toggleLeft').getAttribute('aria-pressed')`;
R.leftBefore = await ev(hidL);
await rk('х', 'BracketLeft', 219); R.leftAfter = await ev(hidL); ok('Х ([) toggles the region tools', R.leftAfter !== R.leftBefore, [R.leftBefore, R.leftAfter]);
await rk('х', 'BracketLeft', 219); R.leftBack = await ev(hidL); ok('Х again restores', R.leftBack === R.leftBefore, R.leftBack);
// review i18n-6: every tool letter, from its tooltip ("Окружность  C"), fired as the Cyrillic key of that position
const JC = { Q: 'й', W: 'ц', E: 'у', R: 'к', T: 'е', Y: 'н', U: 'г', I: 'ш', O: 'щ', P: 'з', A: 'ф', S: 'ы', D: 'в', F: 'а', G: 'п', H: 'р', J: 'о', K: 'л', L: 'д', Z: 'я', X: 'ч', C: 'с', V: 'м', B: 'и', N: 'т', M: 'ь' };
// one button per tool (the rail and the grid repeat them); the formula tool (T) opens its editor, so it goes last
const toolKeys = await ev(`[...new Map([...document.querySelectorAll('.tool[data-tool]')].map((b) => [b.dataset.tool, b])).values()].map((b) => [b.dataset.tool, ((b.dataset.tipBase || b.dataset.tip || '').match(/\\s([A-Z])$/) || [])[1]]).filter((x) => x[1]).sort((a, b) => (a[1] === 'T') - (b[1] === 'T'))`);
R.toolKeys = [];
for (const [tool, L] of toolKeys) {
  await rk(JC[L], 'Key' + L, L.charCodeAt(0));
  // T (formula) focuses the formula field, as in English; every other letter picks its tool
  const on = L === 'T' ? (await ev(`document.activeElement.id`) === 'formulaInput' ? tool : 'no focus') : await ev(toolOn);
  R.toolKeys.push(L + ':' + (on === tool ? 'ok' : on));
  ok(`${JC[L]} (${L}) picks ${tool}`, on === tool, on);
  if (L === 'T') { await key('Escape'); await ev(`document.activeElement.blur(); 1`); await sleep(200); }
  await rk('м', 'KeyV', 86);
}
R.defBefore = await ev(`document.getElementById('morphBtn').getAttribute('aria-pressed')`);
await rk('ь', 'KeyM', 77); R.defAfter = await ev(`document.getElementById('morphBtn').getAttribute('aria-pressed')`);
ok('Ь (M) toggles the deformation', R.defBefore !== R.defAfter, [R.defBefore, R.defAfter]);
await rk('ь', 'KeyM', 77);
const hidR = `getComputedStyle(document.getElementById('rightPanel') || document.body).display + '/' + document.getElementById('toggleRight').getAttribute('aria-pressed')`;
R.rightBefore = await ev(hidR); await rk('ъ', 'BracketRight', 221); R.rightAfter = await ev(hidR);
ok('Ъ (]) toggles the guarantees', R.rightAfter !== R.rightBefore, [R.rightBefore, R.rightAfter]);
await rk('ъ', 'BracketRight', 221);
await ev(`document.getElementById('cmdBtn').click()`); await sleep(300); await type('z^2'); await sleep(300); await key('Enter'); await sleep(1200);
R.stepsBeforeUndo = await ev(`document.querySelectorAll('.card[data-k], .card-step, .step-card').length`);
R.undoBefore = await ev(`document.getElementById('undoBtn').disabled`);
await rk('я', 'KeyZ', 90, 4); await sleep(600);
R.redoAfter = await ev(`document.getElementById('redoBtn').disabled`);
ok('⌘Я (⌘Z) undoes', R.undoBefore === false && R.redoAfter === false, [R.undoBefore, R.redoAfter]);
await rk('Я', 'KeyZ', 90, 12); await sleep(600);
ok('⇧⌘Я (⇧⌘Z) redoes', await ev(`document.getElementById('redoBtn').disabled`) === true, 'redo');
// review i18n-20: the '/' key of ЙЦУКЕН-PC types '.' and opens the palette
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: '.', code: 'Slash', windowsVirtualKeyCode: 191, text: '.', unmodifiedText: '.' }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: '.', code: 'Slash', windowsVirtualKeyCode: 191 }); await sleep(300);
R.palSlash = await ev(`!!document.querySelector('#popHost .pop')`); ok('ЙЦУКЕН-PC "/" key (types ".") opens the palette', R.palSlash, R.palSlash);
await key('Escape'); await sleep(200);
// ⌘Л is ⌘K: the palette
await rk('л', 'KeyK', 75, 4); R.pal = await ev(`!!document.querySelector('#popHost .pop')`); ok('⌘Л opens the palette', R.pal, R.pal);
await key('Escape'); await sleep(200);
// Russian static strings in place
R.ru = await ev(`[document.querySelector('#secDraw h2 .grow').textContent, document.getElementById('leftFit').title, document.documentElement.lang, document.getElementById('formulaInput').getAttribute('aria-label'), getComputedStyle(document.body).fontFamily]`);
ok('Russian walker', R.ru[0] === 'Рисование' && R.ru[1] === 'Вписать в окно  Z' && R.ru[2] === 'ru', R.ru);
R.fontsRu = await ev(`await (async () => { await document.fonts.ready; return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family + ' ' + f.unicodeRange.slice(0, 14)).filter((s) => /Roboto|JetBrains/.test(s)); })()`);
// 3. switch the language: the work, the view and the undo history come back
await view(1440, 900, false);
await nav(BASE + '/test.html?ns=switch1' + RUN + '');
await sleep(3000);
await ev(`__cmwSetMain && __cmwSetMain('phase')`); await sleep(800);
await ev(`__cmwSetMain && __cmwSetMain('xy')`); await sleep(800);
// an undoable change: add a function from the palette
await ev(`document.getElementById('cmdBtn').click()`); await sleep(300); await type('z^2'); await sleep(300); await key('Enter'); await sleep(1500);
const st = `const RUN_ID = '${RUN}'; JSON.stringify((() => { const s = JSON.parse(localStorage.getItem('complex-map-workbench-v1:switch1' + RUN_ID)); return { steps: s.steps.length, shapes: s.shapes.length, view: s.view, focus: s.focus }; })())`;
await ev(`document.getElementById('undoBtn').click()`); await sleep(600);
await ev(`document.getElementById('redoBtn').click()`); await sleep(1200);
const before = { st: await ev(st), undo: await ev(`document.getElementById('undoBtn').disabled + '/' + document.getElementById('redoBtn').disabled`), R: await ev(canv), L: await ev(lefthash) };
await ev(`I18N.setPref('ru'); 1`).catch(() => {});
await sleep(4000);
const after = { st: await ev(st), undo: await ev(`document.getElementById('undoBtn').disabled + '/' + document.getElementById('redoBtn').disabled`), lang: await ev('I18N.uiLang'), R: await ev(canv), L: await ev(lefthash) };
ok('switch: Russian after the reload', after.lang === 'ru', after.lang);
ok('switch: the same saved state', before.st === after.st, [before.st, after.st]);
ok('switch: undo history kept', before.undo === after.undo, [before.undo, after.undo]);
ok('switch: the same planes (pixels)', before.R === after.R && before.L === after.L, [before.R, after.R, before.L, after.L]);
await ev(`document.getElementById('undoBtn').click()`); await sleep(1000);
R.afterUndo = await ev(st);
ok('switch: undo still undoes the last step', JSON.parse(R.afterUndo).steps === JSON.parse(before.st).steps - 1, [before.st, R.afterUndo]);
await ev(`I18N.setPref('auto'); 1`).catch(() => {});
await sleep(3500);
R.backTo = await ev('I18N.uiLang + " pref " + I18N.readPref()');
// 4. review i18n-3: blocked storage: no reload, no lost work, a note instead
await nav(BASE + '/test.html?ns=switch2' + RUN + '');
await sleep(3000);
await ev(`window.__noReload = 1; Storage.prototype.setItem = function () { throw new DOMException('blocked', 'SecurityError'); }; Storage.prototype.removeItem = function () { throw new DOMException('blocked', 'SecurityError'); }; 1`);
R.blockedRes = await ev(`JSON.stringify(I18N.setPref('ru'))`);
await sleep(2000);
R.blocked = await ev(`[window.__noReload, I18N.uiLang, (document.querySelector('#toastHost .toast') || {}).textContent || ''].join(' | ')`);
ok('blocked storage: no reload, still English, a note', /^1 \| en \| .*storage/.test(R.blocked), [R.blockedRes, R.blocked]);
// review i18n-3: a full quota keeps the older save but throws on the new one: the switch must not reload (the latest
// change would be lost). Only the work's key throws; the language setting itself can be written.
await nav(BASE + '/test.html?ns=switch3' + RUN + '');
await sleep(3000);
await ev(`document.getElementById('cmdBtn').click()`); await sleep(300); await type('z^2'); await sleep(300); await key('Enter'); await sleep(1500);
await ev(`document.dispatchEvent(new Event('visibilitychange')); 1`); await sleep(300);
R.quotaOld = await ev(`Object.keys(localStorage).filter((k) => /^complex-map-workbench-v1:switch3/.test(k)).length`);
await ev(`window.__noReload = 1; const si = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (/^complex-map-workbench-v1:/.test(k)) throw new DOMException('full', 'QuotaExceededError'); return si.call(this, k, v); }; 1`);
await ev(`document.getElementById('cmdBtn').click()`); await sleep(300); await type('sin z'); await sleep(300); await key('Enter'); await sleep(1200);
R.quotaRes = await ev(`JSON.stringify(I18N.setPref('ru'))`);
await sleep(2000);
R.quota = await ev(`[window.__noReload, I18N.uiLang, I18N.readPref(), [...document.querySelectorAll('#toastHost .toast')].map((t) => t.textContent).join(' / ')].join(' | ')`);
ok('full quota with an older save: no reload, still English, setting restored, a note', R.quotaOld === 1 && /^1 \| en \| auto \| .*storage/.test(R.quota), [R.quotaOld, R.quotaRes, R.quota]);
// the language menu: radio items (review i18n-20)
await view(390, 844, false, true); await sleep(500);
R.langMenu = await ev(`await (async () => { document.getElementById('hdrMoreBtn').click(); await new Promise((r) => setTimeout(r, 200)); document.getElementById('langBtn').click(); await new Promise((r) => setTimeout(r, 300)); return [...document.querySelectorAll('#popHost .mi')].map((b) => b.getAttribute('role') + ':' + b.getAttribute('aria-checked')).join(','); })()`);
ok('language menu items are menuitemradio with aria-checked', /^menuitemradio:true,menuitemradio:false,menuitemradio:false$/.test(R.langMenu), R.langMenu);
await key('Escape'); await view(1440, 900, false);
return { pass: fails.length === 0, fails, R, before: before.st, after: after.st };
