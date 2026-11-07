// The learn checks the steps view has: the tour line on a phone and a landscape phone, an example's fit with the tour's
// Sound chapter, a tap that closes a layer doing nothing else, the Russian strings (tour, tool row, tiles), and the
// sound settings' keyboard help and the Shapes editor's Listen along on a phone (412 x 860, Android Chrome emulation,
// real touch events through Input.dispatchTouchEvent). The classic views' own checks (the pane head's key, options and note,
// the deformation, the Shapes keys and menus) are ux165_learn_classic_cmd.js and the classic phone's (the target note, the
// message row) ux165_learn_phone_classic_cmd.js; the laptop's sound checks are ux165_learn_sound_cmd.js, the first-run line
// is ux165_learn_first_run_cmd.js and the Undo message is ux165_learn_msg_classic_cmd.js. A command file for a CDP daemon
// (test/cdp_kit README): python3 build.py && test/<you>_cdp/q.sh test/ux165_learn_cmd.js
// Prints { pass, of, fails: [[name, false, detail]], exc }.
const { U, R, check, settle, exc, grab, UA0, laptop, fresh, ready, firstVisit } = await eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'ux165_kit.js'), 'utf8'));
const box = (sel) => ev(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(sel)})].find((x) => x.getClientRects().length); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; })()`);
const meet = (a, b) => !!a && !!b && a.l < b.r - 0.5 && a.r > b.l + 0.5 && a.t < b.b - 0.5 && a.b > b.t + 0.5;
const mid = (b) => [b.l + b.w / 2, b.t + b.h / 2];
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const phone = async (w, h, dark = false) => { await send('Emulation.setUserAgentOverride', { userAgent: ANDROID, platform: 'Linux armv8l' }); await view(w, h, dark, true); };
const tap = async (x, y, hold = 60) => { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); await sleep(hold); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(250); };
const tdrag = async (x0, y0, x1, y1, n = 14) => { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] }); for (let i = 1; i <= n; i++) { await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * i / n, y: y0 + (y1 - y0) * i / n }] }); await sleep(16); } await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(300); };
const tapSel = async (sel) => { const b = await box(sel); if (!b) return false; await tap(...mid(b)); return true; };
const rclick = async (x, y) => { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'right', buttons: 2, clickCount: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'right', clickCount: 1 }); await sleep(250); };
logs();
let g = null;

// phone portrait: the row under the header, 44 px buttons, real taps
await phone(412, 860);
await firstVisit();
check('the page under test is the steps view (the suite is pinned to it)', await ev(`typeof __cmwSteps === 'function' && __cmwSteps().on === true`));
g = await ev(`(() => { const s = document.querySelector('.tour-lane'); if (!s) return null; const b = s.getBoundingClientRect(), h = document.querySelector('header').getBoundingClientRect(), p = document.querySelector('.panes').getBoundingClientRect(); return { mode: s.dataset.mode, top: b.top, hdr: h.bottom, bot: b.bottom, panes: p.top, w: b.width, minB: Math.min(...[...s.querySelectorAll('button')].map((x) => x.getBoundingClientRect().height)), scroll: document.documentElement.scrollHeight <= innerHeight }; })()`);
check('UX21 phone: the line is the row under the header, the planes start under it, 44 px buttons, no page scroll', g && g.mode === 'port' && Math.abs(g.top - g.hdr) <= 1 && g.panes >= g.bot - 0.5 && g.w >= 410 && g.minB >= 44 && g.scroll, g);
await shot('ux165-ux21-phone');
check('UX21 phone: the line\'s words are whole (no cut sentence)', await ev(`(() => { const t = document.querySelector('.tour-lane .tl-text'); return !(t.scrollWidth > t.clientWidth + 1 || t.scrollHeight > t.clientHeight + 1); })()`));
await tapSel('.tour-lane .btn.ghost'); await settle(500);
g = await ev(`({ lane: !!document.querySelector('.tour-lane'), out: JSON.parse(localStorage.getItem('cmw-tour') || '{}').outcome, toast: __qa.toasts().join(' ') })`);
check('UX21 phone: a tap on Not now dismisses it for good and says where the tour is', !g.lane && g.out === 'dismissed' && /⋯ › Guided tour/.test(g.toast), g);
// landscape phone: in the header when it has room
await phone(915, 412);
await firstVisit();
g = await ev(`(() => { const s = document.querySelector('.tour-lane'); if (!s) return null; const b = s.getBoundingClientRect(), p = document.querySelector('#paneL').getBoundingClientRect(); return { mode: s.dataset.mode, slot: s.parentNode.id, over: !(b.bottom <= p.top + 0.5) }; })()`);
check('UX21 landscape phone: the line in the header (or the row under it), never over X or Y', g && ((g.mode === 'head' && g.slot === 'tourHeadSlot') || g.mode === 'row') && !g.over, g);
await shot('ux165-ux21-phone-land');
grab();
// an example's fit keeps X's bottom margin, measured on the plane (the bar is in the head now): the tour's Grieg step
// and the next step have a finite view (it went NaN / div)
await laptop(1440, 900);
await fresh('ux165t'); await settle(1500);
await ev(`Tour.auto(true); Tour.start({ chapter: 'sound', step: 0 })`); await settle(2500);
const ro0 = await ev(`__qa.txt('#leftReadout')`);
await ev('Tour.next()'); await settle(2500);
const ro1 = await ev(`__qa.txt('#leftReadout')`);
check('UX20: with X\'s options in the head, an example\'s fit stays finite (the Sound chapter: "1 / div", not "NaN / div")', /^\d/.test(ro0) && /^\d/.test(ro1) && !/NaN/.test(ro0 + ro1), [ro0, ro1]);
await ev('Tour.stop()'); await settle(400);
// ---------------------------------------------------------------- UX89: a tap that closes a layer does nothing else
await phone(412, 860);
await fresh('ux165g'); await settle(2000);
await ev(`Tour.auto(true); Tour.start({ chapter: 'basics', step: 1 })`); await settle(1800);
await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, metaKey: true, bubbles: true }))`); await settle(600);
const palOpen = await ev(`!!document.querySelector('#popHost .pop')`);
const tt = await box('.tour-strip .ts-text');
await tap(tt.l + 30, tt.t + 10); await settle(500);
g = await ev(`({ pal: !!document.querySelector('#popHost .pop'), why: Tour.lit() && Tour.lit().why, active: Tour.isActive() })`);
check('UX89 phone: a tap on the strip that closes the open function list neither opens the sheet nor ends anything', palOpen && !g.pal && g.why === false && g.active, Object.assign({ palOpen }, g));
await tap(tt.l + 30, tt.t + 10); await settle(500);
check('UX89: the next tap on the strip opens the sheet as before', (await ev('Tour.lit() && Tour.lit().why')) === true);
await ev('Tour.stop()'); await settle(300);
grab();

// ---------------------------------------------------------------- UX78, UX93: Russian
await phone(360, 780);
await fresh('ux165h', '&lang=ru'); await settle(2400);
g = await ev(`({ auto: I18N.t('Move on by itself'), tour: I18N.t('Guided tour'), welcome: I18N.t('Welcome to the Workbench'), start: I18N.t('Start the tour') })`);
check('UX78: «Дальше автоматически»', g.auto === 'Дальше автоматически', g);
check('UX93: the tour is «Обучение», the welcome title «Добро пожаловать»', g.tour === 'Обучение' && g.welcome === 'Добро пожаловать' && /обучение/.test(g.start), g);
// the tool row along the bottom: Polygon («Многоугольник») is its short form on one line, no hyphen
g = await ev(`[...document.querySelectorAll('#secDraw > .tools > .tool')].filter((b) => b.getClientRects().length).map((b) => { const sp = b.querySelector(':scope > span'), a = getComputedStyle(sp, '::after').content, shown = sp.dataset.phl ? a.replace(/^"|"$/g, '') : sp.textContent; return { t: b.dataset.tool, shown, h: Math.round(sp.getBoundingClientRect().height), soft: /\u00ad|-$/.test(shown) }; })`);
check('UX93 Russian phone tool row: one line each, Polygon «Многоуг.» (no «Много-угольник»)', g.length === 4 && g.every((x) => x.h <= 13 && !x.soft) && (g.find((x) => x.t === 'polygon') || {}).shown === 'Многоуг.', g);
await tapSel('#secDraw .tool-more > summary'); await settle(800);
const readTiles = () => ev(`[...document.querySelectorAll('.ph-tile')].filter((t) => t.getClientRects().length).map((t) => { const l = t.querySelector('.ph-tl'); return { t: l.textContent, fits: l.scrollWidth <= t.clientWidth + 0.5, soft: /\\u00ad/.test(l.textContent), words: l.textContent.split(' ').every((w) => true), lines: Math.round(l.getBoundingClientRect().height / 12) }; })`);
g = await readTiles(); await ev(`Phone.tab('construct')`); await settle(300); g.push(...(await readTiles()));   // (the Draw tab, then the Construct tab)
check('UX93 Russian phone tiles: no hyphenated tool name, every name fits its tile', g.length > 10 && g.every((x) => x.fits && !x.soft) && g.filter((x) => x.lines > 1).every((x) => / /.test(x.t)), g.filter((x) => !x.fits || x.soft || (x.lines > 1 && !/ /.test(x.t))));
await shot('ux165-ux93-ru-tiles');
await ev(`Tour.start({ chapter: 'basics', step: 0 })`); await settle(1500);
g = await ev(`(() => { const t = document.querySelector('#tourTitle'); if (!t) return null; const c = t.cloneNode(true); c.removeAttribute('id'); c.style.cssText = 'position:absolute;visibility:hidden;width:auto;max-width:none;overflow:visible'; document.body.appendChild(c); const need = c.getBoundingClientRect().width; c.remove(); return { title: t.textContent.trim(), need: Math.round(need * 100) / 100, have: Math.round(t.getBoundingClientRect().width * 100) / 100 }; })()`);
check('UX93: the welcome title reads «Добро пожаловать» on a 360 px phone, whole (no ellipsis)', g && g.title === 'Добро пожаловать' && g.have >= g.need, g);
await shot('ux165-ux93-ru-welcome');
await ev('Tour.stop()'); await settle(300);
grab();

await phone(412, 860);
await fresh('ux165s2'); await settle(2000);
check('UX88 phone: the sound settings show no keyboard help on touch', await ev(`getComputedStyle(document.querySelector('.snd-keys')).display === 'none'`));
// UX72 phone: More, then the curve's row in Shapes (real taps): its editor has Listen along, a 44 px button
await tapSel('#toolMore'); await settle(600);
await ev(`Phone.tab('shapes')`); await settle(300);   // (the Shapes tab of the Tools sheet)
await ev(`(() => { const e = document.querySelector('#shapeList .shape[data-id="s2"] .shape-name'); e && e.scrollIntoView({ block: 'center' }); return 1; })()`); await settle(300);
await tapSel('#shapeList .shape[data-id="s2"] .shape-name'); await settle(500);
await ev(`(() => { const e = document.querySelector('#shapeList .shape[data-id="s2"] .shape-edit [data-act="listen-along"]'); e && e.scrollIntoView({ block: 'center' }); return 1; })()`); await settle(300);
g = await box('#shapeList .shape[data-id="s2"] .shape-edit [data-act="listen-along"]');
check('UX72 phone: the selected curve\'s editor in the Shapes sheet has Listen along, 44 px high', g && g.h >= 44, g);
await shot('ux165-ux72-editor-phone');
grab();

await laptop(1440, 900, false);
await send('Emulation.setUserAgentOverride', { userAgent: UA0 });
const fails = R.filter((r) => !r[1]);
return { pass: R.length - fails.length, of: R.length, fails, exc };
