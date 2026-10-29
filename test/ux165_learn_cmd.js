// v16.5 wave 1, the learn piece (notes/ux-audit/REPORT.md; as built: notes/ux-build/w1-learn-AS-BUILT.md): every fix
// of UX21, UX20, V01, UX80, UX77, UX78, UX93, UX89, UX90, UX60, UX70-UX74, UX87, UX88, UX97, UX99, UX102-UX104, on a
// laptop (1366 x 768), a phone (412 x 860, Android Chrome emulation, real touch events through
// Input.dispatchTouchEvent) and a landscape phone (915 x 412) where it matters. A command file for a CDP daemon
// (test/cdp_kit README): python3 build.py && test/<you>_cdp/q.sh test/ux165_learn_cmd.js
// Prints { pass, of, fails: [[name, false, detail]], exc }.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const R = [];
const check = (name, pass, detail) => R.push([name, !!pass, detail]);
const settle = async (ms = 600) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const exc = [];
const grab = () => { for (const l of logs()) if (l.t === 'EXC') exc.push(l.m.slice(0, 300)); };
const box = (sel) => ev(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(sel)})].find((x) => x.getClientRects().length); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; })()`);
const meet = (a, b) => !!a && !!b && a.l < b.r - 0.5 && a.r > b.l + 0.5 && a.t < b.b - 0.5 && a.b > b.t + 0.5;
const mid = (b) => [b.l + b.w / 2, b.t + b.h / 2];
const UA0 = await ev('navigator.userAgent');
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const phone = async (w, h, dark = false) => { await send('Emulation.setUserAgentOverride', { userAgent: ANDROID, platform: 'Linux armv8l' }); await view(w, h, dark, true); };
const laptop = async (w = 1366, h = 768, dark = false) => { await send('Emulation.setUserAgentOverride', { userAgent: UA0 }); await view(w, h, dark, false); };
const tap = async (x, y, hold = 60) => { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); await sleep(hold); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(250); };
const tdrag = async (x0, y0, x1, y1, n = 14) => { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] }); for (let i = 1; i <= n; i++) { await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * i / n, y: y0 + (y1 - y0) * i / n }] }); await sleep(16); } await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(300); };
const tapSel = async (sel) => { const b = await box(sel); if (!b) return false; await tap(...mid(b)); return true; };
const rclick = async (x, y) => { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'right', buttons: 2, clickCount: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'right', clickCount: 1 }); await sleep(250); };
// a fresh first visit (no ?ns=, nothing saved): the app's own rule for the first-run line
// a namespace's saved state is cleared first, so every run starts from the default scene
// (from another namespace's page: a page saves its own state when it is left)
// (the app is up: its state hook answers and the chain is drawn; a fresh page on a slow runner takes a few seconds)
const ready = async () => { for (let i = 0; i < 40 && !(await ev(`typeof __cmwState === 'function' && !!document.querySelector('#pipeline')`)); i++) await sleep(250); };
const fresh = async (ns, q = '') => { await nav(U + '?ns=ux165clean'); await ev(`(() => { for (const k of Object.keys(localStorage)) if (k.endsWith(':${ns}')) localStorage.removeItem(k); return 1; })()`); await nav(U + '?ns=' + ns + q); };
const firstVisit = async (q = '') => { await fresh('ux165x'); await ev(`(() => { for (const k of Object.keys(localStorage)) if (!/:/.test(k)) localStorage.removeItem(k); return 1; })()`); await nav(U + q); for (let i = 0; i < 40 && !(await ev(`!!document.querySelector('.tour-lane')`)); i++) await sleep(200); };
logs();

// ---------------------------------------------------------------- UX21: the first-run line, docked
await laptop();
await firstVisit();
let g = await ev(`(() => { const s = document.querySelector('.tour-lane'); if (!s) return null; const b = s.getBoundingClientRect(), p = document.querySelector('#paneL').getBoundingClientRect(), q = document.querySelector('#paneR').getBoundingClientRect(), i = document.querySelector('#rightPanel').getBoundingClientRect(); return { slot: s.parentNode.id, mode: s.dataset.mode, h: Math.round(b.height), clear: b.bottom <= p.top + 0.5 && b.bottom <= q.top + 0.5, insp: b.right <= i.left + 0.5, card: !!document.querySelector('.tour-suggest'), title: s.querySelector('.tl-title').textContent, btns: [...s.querySelectorAll('button')].map((x) => x.textContent) }; })()`);
check('UX21 laptop: the first-run invitation is one line in the docked slot, above X and Y, clear of the Inspector, no card', g && g.slot === 'tourSlot' && g.mode === 'desk' && g.h <= 48 && g.clear && g.insp && !g.card && /New here\?/.test(g.title), g);
check('UX21 laptop: Start the tour and Not now', g && g.btns.some((t) => /Start the tour/.test(t)) && g.btns.some((t) => /Not now/.test(t)), g && g.btns);
g = await ev(`(() => { const t = document.querySelector('.tour-lane .tl-text'); return { cut: t.scrollWidth > t.clientWidth + 1 || t.scrollHeight > t.clientHeight + 1, two: t.closest('.tour-lane').classList.contains('two'), body: !t.querySelector('.tl-body').hidden }; })()`);
check('UX21 laptop: the line is one line and its words are whole (the description only where it fits whole)', !g.cut && !g.two, g);
await shot('ux165-ux21-laptop');
await laptop(1366, 768, true); await settle(300); await shot('ux165-ux21-laptop-dark'); await laptop();
await ev(`document.querySelector('.tour-lane .btn.primary').click()`); await settle(1500);
check('UX21 laptop: Start runs the tour from Basics, and the line has gone', (await ev('Tour.isActive() && Tour.current().chapter === "basics"')) && !(await ev(`!!document.querySelector('.tour-lane')`)));
// (v16.5 UX77) Details folded at first on a laptop; the welcome lead says the practice is cleared (UX90)
g = await ev(`({ why: Tour.lit() ? Tour.lit().why : null, wl: (document.querySelector('.ts-wlw') || {}).textContent, lead: (document.querySelector('#tourLead') || {}).textContent })`);
check('UX77: Details starts folded at 1366, and is called Details', g.why === false && /Details/.test(g.wl || ''), g);
check('UX90: the welcome lead says what is cleared', /Practice freely: what you draw here is cleared at the end/.test(g.lead || ''), g.lead);
await ev(`document.querySelector('.ts-next').focus()`); await key('Escape'); await settle(500); await ev('Tour.stop()'); await settle(300);
await laptop(1440, 900);
await fresh('ux165w'); await settle(1500);
// (a fresh page on a slow runner: the app up before the tour starts, and the step lit before it is read)
await ready();
await ev(`Tour.start({ chapter: 'views' })`); await settle(1500);
for (let i = 0; i < 20 && !(await ev('!!Tour.lit()')); i++) await sleep(250);
check('UX77: Details folded at 1440 x 900 too (it opened from 1280 x 800 up)', (await ev('Tour.lit() && Tour.lit().why')) === false);
await ev('Tour.stop()'); await settle(300);
await laptop();

// phone portrait: the row under the header, 44 px buttons, real taps
await phone(412, 860);
await firstVisit();
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

// ---------------------------------------------------------------- UX20: keys and options in the pane head
await laptop();
await fresh('ux165a'); await settle(1800);
g = await ev(`(() => { const L = document.querySelector('#rightLegend'), F = document.querySelector('#rightFoot'), plot = document.querySelector('#plotR'); return { legHead: L.parentNode.classList.contains('pane-head'), footHead: F.parentNode.classList.contains('pane-head'), inPlot: [...plot.querySelectorAll(':scope > .legend-chip:not(.calc-chip):not([hidden]), :scope > .options')].filter((e) => e.getClientRects().length).length, sum: (L.querySelector('.lg-sum') || {}).textContent, onlyBtn: [...F.children].every((c) => c.classList.contains('opts-btn')) }; })()`);
check('UX20 laptop X → Y: the pattern key and the options are in Y\'s pane head, nothing of theirs on the plot', g.legHead && g.footHead && g.inPlot === 0 && /^cell /.test(g.sum || '') && g.onlyBtn, g);
let lb = await box('#rightLegend');
await move(lb.l + 8, lb.t + 8); await settle(500);
g = await ev(`(() => { const c = document.querySelector('#rightLegend > canvas'); const b = c.getBoundingClientRect(), h = document.querySelector('#paneR .pane-head').getBoundingClientRect(); return { shown: getComputedStyle(c).display !== 'none', under: b.top >= h.bottom - 1 }; })()`);
check('UX20: the key unfolds under the head only while pointed at (invited)', g.shown && g.under, g);
await shot('ux165-ux20-key-hover');
await move(300, 300); await settle(300);
check('UX20: and folds again', await ev(`getComputedStyle(document.querySelector('#rightLegend > canvas')).display === 'none'`));
// (#247: View outline and Phase key are toggles in Y's head, or behind its ⋯ when the head has no room; never over the plot)
const inlineKey = await ev(`(() => { const k = document.getElementById('wKeyChkR'), l = k && k.closest('label'); return !!(l && l.getClientRects().length && l.closest('#paneR .pane-head')); })()`);
if (!inlineKey) { await ev(`document.querySelector('#rightFoot .opts-btn:not(.pat-btn)').click()`); await settle(400); }
g = await ev(`(() => { const k = document.getElementById('wKeyChkR'), f = document.getElementById('fovChk'), l = k && k.closest('label'), p = document.querySelector('.opts-pop'), hd = document.querySelector('#paneR .pane-head').getBoundingClientRect(); if (!l) return null; const b = (p || l).getBoundingClientRect(); return { phaseKey: l.getClientRects().length > 0, fov: !!f, inHead: !!l.closest('.pane-head'), under: !p || b.top >= hd.bottom - 1, titles: p ? p.querySelectorAll('.opts-h').length : 0 }; })()`);
check('UX20/#247: View outline and Phase key in Y\'s head, or in its ⋯ pop-up under it, with no title', g && g.phaseKey && g.fov && (g.inHead || g.under) && g.titles === 0, g);
await key('Escape'); await settle(200);
for (const v of ['phase', 'land']) {
  await ev(`__cmwSetMain('${v}')`); await settle(2200);
  g = await ev(`(() => { const F = document.querySelector('#leftFoot'), plot = document.querySelector('#plotL'); return { head: F.parentNode.classList.contains('pane-head'), bars: [...plot.querySelectorAll(':scope > .options, :scope > .legend-chip:not([hidden]):not(.calc-chip)')].filter((e) => e.getClientRects().length).length, leg: document.querySelector('#leftLegend').parentNode.classList.contains('pane-head') }; })()`);
  check(`UX20 laptop ${v}: its option bar and key are in X's pane head, none over the plot`, g.head && g.leg && g.bars === 0, g);
  await shot('ux165-ux20-' + v);
}
await ev(`__cmwSetMain('xy')`); await settle(800);
// phone landscape: the key stays a folded glyph on the plane (its head is not shown)
await phone(915, 412);
await fresh('ux165b'); await settle(2000);
g = await ev(`(() => { const L = document.querySelector('#rightLegend'); return { inPlot: L.parentNode.id === 'plotR', folded: L.classList.contains('collapsed') }; })()`);
check('UX20 landscape phone: Y\'s pattern key is the folded glyph, not the box over Y', g.inPlot && g.folded, g);
check('UX20 phone: the glyph carries none of the head\'s words', await ev(`!document.querySelector('#leftLegend .lg-sum, #rightLegend .lg-sum')`));
grab();

// ---------------------------------------------------------------- V01 (phone): the target's note
await phone(412, 860);
await fresh('ux165c'); await settle(2200);
// (a pulse is the class going on: a record that only rewrites the pane's classes, as a resize does, is not one)
await ev(`(() => { const L = document.querySelector('#paneL'); window.__olds = []; new MutationObserver((ms) => { for (const m of ms) window.__olds.push(m.oldValue || ''); }).observe(L, { attributes: true, attributeFilter: ['class'], attributeOldValue: true }); return 1; })()`);
await tapSel('.pane.ph-inset .ph-swap'); await settle(600);
await tapSel('#secDraw [data-tool="disc"]'); await settle(300);
await tdrag(200, 330, 250, 380); await settle(1200);
g = await ev(`({ ro: __qa.txt('#rightReadout'), calc: (document.querySelector('#calcChip') || {}).hidden, pulse: (() => { const v = window.__olds.concat(document.querySelector('#paneL').className); let n = 0; for (let i = 0; i + 1 < v.length; i++) if (!/ph-pulse/.test(v[i]) && /ph-pulse/.test(v[i + 1])) n++; return n; })(), targets: __cmwState().targets })`);
check('V01 phone: after a target, Y\'s chip says "Shaded in X (the inset)", no note over Y, and the inset pulsed once', g.targets === 1 && /Shaded in X \(the inset\)/.test(g.ro) && g.calc === true && g.pulse === 1, g);
await shot('ux165-v01-phone');
// laptop: the note is in Y's pane head
await laptop();
await fresh('ux165d'); await settle(1800);
await ev(`document.querySelector('#tools [data-tool="disc"]').click()`); await settle(200);
const pr = await box('#plotR');
await drag(pr.l + pr.w * 0.5, pr.t + pr.h * 0.45, pr.l + pr.w * 0.55, pr.t + pr.h * 0.5); await settle(1200);
// (v16.5 UX20/V01 and the wave 1 merge, W1-MERGE.md 8: the note "gives way before the title itself would" (fitTitle,
// class nofit). With plane's worded Plane | Sphere (UX37), the "Y · " tag (UX27) and the key chip in Y's head, a
// 1366 px head may have no room for it: then it must be hidden by that rule only, i.e. Y's title would not fit beside
// it (measured as fitTitle measures, with the note and the title's classes put back at once), and never cut)
g = await ev(`(() => { const n = document.querySelector('#paneR .pane-head #rightNote'), t = document.querySelector('#rightTitle'), pr = t.querySelector('.prole'); const o = { note: n && n.textContent, shown: !!n && getComputedStyle(n).display !== 'none', cut: !!n && n.scrollWidth > n.clientWidth + 1, tip: n && n.dataset.tip, roleCut: getComputedStyle(pr).display !== 'none' && pr.scrollWidth > pr.clientWidth + 1, tiny: document.querySelector('#paneR').classList.contains('tiny'), calc: document.querySelector('#calcChip').hidden, targets: __cmwState().targets, nofit: !!n && n.classList.contains('nofit') };
  if (n && o.nofit) { const grow = t.nextElementSibling, pt = t.querySelector('.ptitle'), tabs = document.getElementById('rightTabs'), cls = t.className; n.classList.remove('nofit'); t.classList.remove('terse', 'short', 'notag'); const room = grow.offsetWidth + t.offsetWidth - (tabs ? Math.max(0, tabs.scrollWidth - tabs.clientWidth) : 0); o.withNote = { ptw: pt ? pt.scrollWidth : 0, room, noteW: n.getBoundingClientRect().width }; t.className = cls; n.classList.add('nofit'); o.gaveWay = !!pt && o.withNote.ptw > room; }
  return o; })()`);
check('UX20 laptop: the target\'s note is in Y\'s pane head ("Preimage in X"), whole (or, without room beside the title, given way to it: W1-MERGE.md 8), not over the plane; the title keeps its place', g.targets === 1 && g.note === 'Preimage in X' && (g.shown || g.gaveWay === true) && !g.cut && !g.roleCut && !g.tiny && g.calc === true, g);
check('UX20 laptop: the note\'s tooltip is plain words', /^Where F lands in the targets of Y/.test(g.tip || ''), g.tip);
await shot('ux165-v01-laptop');
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
await laptop();

// ---------------------------------------------------------------- UX80: messages clear of the planes' controls
await laptop();
await fresh('ux165e'); await settle(1800);
await ev(`document.querySelector('#clearChain').click()`); await settle(500);
// (v16.5 fix regress-3, consented by the user 2026-10-27 (W1-MERGE-NOTES.md): a desktop message that fits whole on one
// line goes in the chain head's free middle (#toastHost data-placed="head"); only a longer one goes above the chain)
g = await ev(`(() => { const t = document.querySelector('#toastHost .toast').getBoundingClientRect(), r = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; }; return { t: { l: t.left, t: t.top, r: t.right, b: t.bottom }, x: r('#paneL .viewstack'), y: r('#paneR .viewstack'), chain: r('.pipe-wrap'), head: r('.pipe-head'), placed: document.getElementById('toastHost').getAttribute('data-placed') }; })()`);
check('UX80 laptop: the Undo message sits in the chain head (v16.5 regress-3) or above the chain, between X\'s and Y\'s button columns', !meet(g.t, g.x) && !meet(g.t, g.y) && (g.placed === 'head' ? g.t.t >= g.head.t - 1 && g.t.b <= g.head.b + 1 && g.t.l >= g.head.l && g.t.r <= g.head.r : g.t.b <= g.chain.t && g.t.l >= g.x.r && g.t.r <= g.y.l), g);
await shot('ux165-ux80-laptop');
g = await ev(`(() => { const e = document.querySelector('#emptyRight'), b = e.querySelector('.btn'); return { head: e.parentNode.classList.contains('pane-head'), shown: !e.hidden && !!b && b.getClientRects().length > 0, tip: b && b.dataset.tip, tiny: document.querySelector('#paneR').classList.contains('tiny') }; })()`);
check('UX20 laptop: the empty chain\'s "Add function" is in Y\'s pane head, not over the picture', g.head && g.shown && /Add a function to map the region/.test(g.tip || '') && !g.tiny, g);
// (the title is fitted with the button in place: its role is whole, short or gone, never cut by an ellipsis: "imag…")
g = await ev(`(() => { const t = document.querySelector('#rightTitle'), pr = t.querySelector('.prole'), pt = t.querySelector('.ptitle'), vis = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none'; return { cls: t.className, prCut: vis(pr) && pr.scrollWidth > pr.clientWidth + 1, ptCut: vis(pt) && pt.scrollWidth > pt.clientWidth + 1 }; })()`);
check('UX20 laptop: with "Add function" in Y\'s head the title and its role are not cut', !g.prCut && !g.ptCut, g);
await phone(412, 860);
await fresh('ux165f'); await settle(2200);
await ev(`document.querySelector('#clearChain').click()`); await settle(500);
g = await ev(`(() => { const r = (e) => { if (!e || !e.getClientRects().length) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; }; return { t: r(document.querySelector('#toastHost .toast')), inset: r(document.querySelector('.pane.ph-inset')), fit: r(document.querySelector('.pane:not(.ph-inset) .viewstack')), col: r(document.querySelector('.pane:not(.ph-inset) .ph-col')), chain: r(document.querySelector('.pipe-wrap')) }; })()`);
// (#66: a phone's message takes the row over the tool row, under the chain bar, and the planes give that row up: it covers none of them)
check('UX80 phone: the message sits in its own row under the chain bar, clear of the inset, Fit and the key column', g.t && !meet(g.t, g.inset) && !meet(g.t, g.fit) && !meet(g.t, g.col) && g.t.t >= g.chain.b - 1 && g.t.b - g.t.t >= 44, g);
await shot('ux165-ux80-phone');
grab();

// ---------------------------------------------------------------- UX89: a tap that closes a layer does nothing else
await phone(412, 860);
await fresh('ux165g'); await settle(2000);
await ev(`Tour.auto(true); Tour.start({ chapter: 'basics', step: 1 })`); await settle(1800);
await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, metaKey: true, bubbles: true }))`); await settle(600);
const palOpen = await ev(`!!document.querySelector('#popHost .pop')`);
const tt = await box('.tour-strip .ts-text');
await tap(tt.l + 30, tt.t + 10); await settle(500);
g = await ev(`({ pal: !!document.querySelector('#popHost .pop'), why: Tour.lit() && Tour.lit().why, active: Tour.isActive() })`);
check('UX89 phone: a tap on the strip that closes the open function list neither opens Details nor ends anything', palOpen && !g.pal && g.why === false && g.active, Object.assign({ palOpen }, g));
await tap(tt.l + 30, tt.t + 10); await settle(500);
check('UX89: the next tap on the strip opens Details as before', (await ev('Tour.lit() && Tour.lit().why')) === true);
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

// ---------------------------------------------------------------- sound: UX70, UX71, UX72, UX73, UX74, UX87, UX88
await laptop();
await fresh('ux165s'); await settle(1800);
g = await ev(`(() => { const b = document.querySelector('#soundBtn').getBoundingClientRect(), c = document.querySelector('#soundMore').getBoundingClientRect(); return { cw: c.width, gap: c.left - b.right }; })()`);
check('UX87: the Sound settings caret is 24 to 28 px, with a gap from the switch', g.cw >= 24 && g.cw <= 28 && g.gap >= 2, g);
await ev(`document.querySelector('#soundMore').click()`); await settle(500);
g = await ev(`(() => { const p = document.querySelector('#sndPop'), kids = [...p.children]; const iHear = kids.findIndex((k) => k.querySelector && k.querySelector('#sndSo')), iVol = kids.findIndex((k) => k.querySelector && k.querySelector('#sndVol')); return { iHear, iVol, diag: !!p.querySelector('details.snd-diag #sndState'), diagOpen: p.querySelector('details.snd-diag').open, keys: getComputedStyle(p.querySelector('.snd-keys')).display !== 'none', small: (p.querySelector('.snd-hear small') || {}).textContent }; })()`);
check('UX70: Hear the function is the first row after Sound, with a one-line description', g.iHear === 1 && g.iVol > g.iHear && /round a zero they rise/.test(g.small || ''), g);
check('UX88: the engine line is under a folded Diagnostics; keyboard help on a laptop', g.diag && !g.diagOpen && g.keys, g);
await shot('ux165-ux70-sound-pop');
await key('Escape'); await settle(200);
await ev(`Sound.set({ on: true, events: true, sonify: true }); 1`); await settle(300);
check('UX70: a wave on the Sound button while Hear the function is on', (await ev(`document.querySelector('#soundBtn').dataset.hear`)) === 'on');
await ev(`Sound.set({ sonify: false }); 1`); await settle(200);
check('UX70: and none when it is off', (await ev(`document.querySelector('#soundBtn').dataset.hear`)) === 'off');
// UX72: Listen along in a curve's row menu
const rowB = await box('#shapeList .shape[data-id="s2"] .shape-row > .more');
if (rowB) { await click(...mid(rowB)); await settle(300); }
g = await ev(`[...document.querySelectorAll('#popHost .pop.menu .mi-label')].map((x) => x.textContent)`);
check('UX72: the Shapes row\'s ⋯ has "Listen along it" under "Integrate … along it"', g.indexOf('Listen along it') === g.findIndex((x) => /^Integrate/.test(x)) + 1, g);
await ev(`[...document.querySelectorAll('#popHost .pop.menu .mi')].find((b) => /Listen along it/.test(b.textContent)).click()`); await settle(900);
g = await ev(`({ play: __cmwSound().play, chip: __qa.txt('#sphereChipL'), stop: !!document.querySelector('#sphereChipL .chip-stop') })`);
check('UX71: the listening chip names the curve and has a Stop button', g.play && /^Listening along/.test(g.chip) && g.stop, g);
await shot('ux165-ux71-listening');
// UX73: a pointer move over the plane no longer cuts it
const pl = await box('#plotL');
for (let i = 0; i < 6; i++) { await move(pl.l + 100 + i * 15, pl.t + 120 + i * 9); await sleep(40); }
check('UX73: moving the pointer over X does not stop Listen along', await ev('__cmwSound().play'));
await ev(`document.querySelector('#sphereChipL .chip-stop').click()`); await settle(300);
check('UX71: Stop stops it, and the chip goes', !(await ev('__cmwSound().play')) && (await ev(`document.querySelector('#sphereChipL').hidden`)));
// UX72: and in the selected curve's editor (a real click on the row's name, then on the button)
const nameB = await box('#shapeList .shape[data-id="s2"] .shape-name');
if (nameB) { await click(...mid(nameB)); await settle(400); }
// ([v17 D4] on the laptop the selected shape's editor is in the Inspector)
await ev(`(() => { const e = document.querySelector('#propsPanel .sh-insp[data-id="s2"] .shape-edit [data-act="listen-along"]'); e && e.scrollIntoView({ block: 'center' }); return 1; })()`); await settle(300);
const edB = await box('#propsPanel .sh-insp[data-id="s2"] .shape-edit [data-act="listen-along"]');
g = { btn: edB, text: await ev(`(document.querySelector('#propsPanel .sh-insp[data-id="s2"] .shape-edit [data-act="listen-along"]') || {}).textContent || null`) };
if (edB) { await click(...mid(edB)); await settle(900); }
g.play = await ev('__cmwSound().play');
check('UX72: the selected curve\'s editor has "Listen along it", and it plays', edB && g.text === 'Listen along it' && g.play, g);
await shot('ux165-ux72-editor');
await ev(`document.querySelector('#sphereChipL .chip-stop') && document.querySelector('#sphereChipL .chip-stop').click()`); await settle(300);
await ev(`Sound.set({ on: false }); 1`);
// UX74: the melody example: ♫ in Examples, and a Try line that stays
await ev(`document.querySelector('#examplesBtn').click()`); await settle(600);
g = await ev(`[...document.querySelectorAll('#popHost .examples .ex-item')].filter((b) => b.querySelector('.ex-snd')).map((b) => ({ name: b.querySelector('.ex-name').textContent, mark: b.querySelector('.ex-snd').textContent, tip: b.querySelector('.ex-snd').title, y: Math.abs(b.querySelector('.ex-snd').getBoundingClientRect().top - b.querySelector('.ex-name').getBoundingClientRect().top) }))`);
check('UX74: the sound example is marked ♫ in Examples, beside its name (the name stays the name)', g.length === 1 && g[0].mark === '♫' && g[0].name === 'In the Hall of the Mountain King' && g[0].tip === 'With sound' && g[0].y < 2, g);
await ev(`document.querySelector('#popHost .examples .ex-snd').closest('.ex-item').click()`); await settle(2500);
g = await ev(`(() => { const l = document.querySelector('.tour-lane[data-lane="example"]'); return l ? { slot: l.parentNode.id, btn: [...l.querySelectorAll('.btn.primary')].map((b) => b.textContent)[0], x: !!l.querySelector('.tl-x') } : null; })()`);
check('UX74: opening it shows a Try line in the docked slot, Listen its button, × to close', g && g.slot === 'tourSlot' && /Listen/.test(g.btn) && g.x, g);
g = await ev(`(() => { const r = document.querySelector('#plotL').getBoundingClientRect(), l = document.querySelector('.tour-lane').getBoundingClientRect(); let y0 = 1e9, y1 = -1e9, x0 = 1e9, x1 = -1e9; for (const p of SEASONG.pts) { const [x, y] = __cmwW2S('L', p[0], p[1]); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return { plane: [r.left, r.top, r.right, r.bottom].map(Math.round), curve: [x0, y0, x1, y1].map(Math.round), lane: Math.round(l.bottom) }; })()`);
check('UX74: the plane is fitted with the Try line in place: the whole spiral is in X, under the line', g.curve[0] > g.plane[0] && g.curve[2] < g.plane[2] && g.curve[1] > g.plane[1] && g.curve[3] < g.plane[3] && g.plane[1] >= g.lane, g);
await shot('ux165-ux74-lane');
await sleep(10000);
check('UX74: the Try line stays (it went after 9 s)', await ev(`!!document.querySelector('.tour-lane[data-lane="example"]')`));
await ev(`document.querySelector('.tour-lane .tl-x').click()`); await settle(300);
check('UX74: × closes it, and the planes get the room back', !(await ev(`!!document.querySelector('.tour-lane')`)) && !(await ev(`document.documentElement.style.getPropertyValue('--tour-h')`)));
grab();
// UX88 phone: no keyboard help on a touch screen
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

// ---------------------------------------------------------------- deformation: UX102, UX103, UX104, UX97 (K, Shift+→), UX60
await laptop();
await fresh('ux165m'); await settle(1800);
await key('m'); await settle(800);
// (v16.5 fix regress-1: a row too tight for the words takes the short form "1/2 · f₁ · 53 %", marked data-short, the
// words staying in the tooltip; the title's two spans read "Deformation" and "from z to w" with no space between)
g = await ev(`({ ro: __qa.txt('#morphLabel'), short: (document.querySelector('#morphLabel') || { dataset: {} }).dataset.short || null, title: __qa.txt('#rightTitle'), speed: [...document.querySelectorAll('#speedSeg > button')].map((b) => b.textContent) })`);
check('UX103: the readout is in words ("Step k of m · fₖ · p %"; in a tight row its short form, v16.5 regress-1) and the title too ("Deformation from z to w")', (/^Step \d+ of 2 · f[₁₂] · \d+ %$/.test(g.ro) || (g.short === '1' && /^\d\/2 · f[₁₂] · \d+ %$/.test(g.ro))) && /^Deformation\s*from z to w$/.test(g.title), g);
const pb = await box('#morphPlay');
await move(...mid(pb)); await sleep(700);
const tip1 = await ev(`[document.querySelector('#tip').hidden, document.querySelector('#tip').textContent]`);
await click(...mid(pb)); await sleep(200); await move(10, 10); await sleep(200); await move(...mid(pb)); await sleep(700);
const tip2 = await ev(`[document.querySelector('#tip').hidden, document.querySelector('#tip').textContent, __cmwState().morph.playing]`);
check('UX104: the play button\'s tooltip follows a click (Pause, then Play)', tip1[0] === false && /^Pause/.test(tip1[1]) && tip2[0] === false && /^Play/.test(tip2[1]) && tip2[2] === false, { tip1, tip2 });
await key('k'); await settle(200);
check('UX97: K plays the deformation', await ev('__cmwState().morph.playing'));
await key('k'); await settle(100);
await ev(`(() => { const s = document.getElementById('morphRange'); return 1; })()`);
await key('ArrowLeft', 8); await key('ArrowLeft', 8); await key('ArrowLeft', 8); await settle(100);
const t0 = await ev('__cmwState().morph.T');
await key('ArrowRight', 8); await settle(150);
g = await ev(`({ T: __cmwState().morph.T, ro: __qa.txt('#morphLabel'), short: (document.querySelector('#morphLabel') || { dataset: {} }).dataset.short || null })`);
// (the readout in words, or its short form in a tight row: v16.5 regress-1)
check('UX97: Shift+← goes back to t = 0, Shift+→ to the next step\'s tick', t0 === 0 && g.T === 1 && (/Step 2 of 2 · f₂ · 0 %|Step 1 of 2 · f₁ · 100 %/.test(g.ro) || (g.short === '1' && /^(2\/2 · f₂ · 0 %|1\/2 · f₁ · 100 %)$/.test(g.ro))), Object.assign({ t0 }, g));
await ev(`document.querySelector('#tools [data-tool="disc"]').click()`); await settle(300);
g = await ev(`({ chip: __qa.txt('#sphereChipR'), btn: !!document.querySelector('#sphereChipR .chip-draw') })`);
check('UX102: a draw tool in the deformation: the chip offers "Turn off and draw"', g.btn && /Turn off and draw/.test(g.chip), g);
await shot('ux165-ux102-chip');
await ev(`document.querySelector('#sphereChipR .chip-draw').click()`); await settle(600);
g = await ev(`({ open: __cmwState().morph.open, tool: (document.querySelector('#tools .tool.on, #tools .tool[aria-pressed="true"]') || { dataset: {} }).dataset.tool || null })`);
check('UX102: it turns the deformation off and keeps the chosen tool', g.open === false && g.tool === 'disc', g);
await ev(`document.querySelector('#tools [data-tool="select"]').click()`);
// UX60: Video listed with the deformation off; choosing it turns the deformation on and opens on Video
await ev(`Figure.open()`); await settle(1500);
g = await ev(`({ fmts: [...document.querySelectorAll('#xfFmt > button')].map((b) => b.dataset.v), dis: (document.querySelector('#xfFmt [data-v="video"]') || {}).disabled })`);
check('UX60: Video is listed with the deformation off', g.fmts.includes('video') && g.dis === false, g);
await ev(`document.querySelector('#xfFmt [data-v="video"]').click()`); await settle(2500);
g = await ev(`({ open: __cmwState().morph.open, dlg: !!document.querySelector('.modal.xf'), vid: (document.querySelector('#xfFmt [aria-checked="true"], #xfFmt [aria-pressed="true"], #xfFmt .on') || { dataset: {} }).dataset.v || null })`);
check('UX60: choosing Video turns the deformation on and the dialog opens on Video', g.open === true && g.dlg && g.vid === 'video', g);
await shot('ux165-ux60-video');
await key('Escape'); await settle(400);
await ev(`(() => { try { const s = JSON.parse(localStorage.getItem('cmw-figure-v1:ux165m') || 'null'); } catch (e) { /* */ } return 1; })()`);
grab();
// Russian: 0,5×
await fresh('ux165m', '&lang=ru'); await settle(2000);
await ready();
await key('m'); await settle(600);
for (let i = 0; i < 12 && !(await ev(`!!document.querySelector('#speedSeg > button')`)); i++) await sleep(250);
g = await ev(`({ speed: [...document.querySelectorAll('#speedSeg > button')].map((b) => b.textContent), ro: __qa.txt('#morphLabel') })`);
check('UX103 Russian: «0,5×» and «Шаг k из m · fₖ · p %»', g.speed[0] === '0,5×' && /^Шаг \d+ из\s2 · f[₁₂] · \d+\s%$/.test(g.ro), g);
await shot('ux165-ux103-ru');
await key('m'); await settle(300);
await nav(U + '?ns=ux165m&lang=en'); await settle(800);
await ev(`localStorage.removeItem('cmw-lang:ux165m'); localStorage.removeItem('cmw-lang'); 1`);

// ---------------------------------------------------------------- UX97 keys on shapes, UX99 right-click menus
await laptop();
await fresh('ux165k'); await settle(1800);
await ev(`__cmwSelect('s2')`); await settle(200);
const n0 = await ev(`__cmwShapes().shapes.length`);
await ev(`document.body.focus()`);
await key('d', 4); await settle(300);
g = await ev(`({ n: __cmwShapes().shapes.length, sel: __cmwShapes().selected })`);
check('UX97: ⌘D duplicates the selected shape and selects the copy', g.n === n0 + 1 && g.sel !== 's2', Object.assign({ n0 }, g));
const sid = g.sel;
const before = await ev(`JSON.stringify(__cmwShapes().shapes.find((s) => s.id === ${JSON.stringify(sid)}))`);
await key('ArrowRight'); await settle(200);
const after = await ev(`JSON.stringify(__cmwShapes().shapes.find((s) => s.id === ${JSON.stringify(sid)}))`);
check('UX97: an arrow moves the selected shape', before !== after, { before, after });
await key('[', 4); await settle(200);
g = await ev(`__cmwShapes().shapes.map((s) => s.id)`);
check('UX97: ⌘[ sends it backward', g.indexOf(sid) === g.length - 2, g);
await rclick(...mid(await box('#shapeList .shape[data-id="s2"] .shape-name')));
g = await ev(`(() => { const p = document.querySelector('#popHost .pop.menu'); if (!p) return null; const b = p.getBoundingClientRect(); return { x: b.left, y: b.top, keys: [...p.querySelectorAll('.mi')].filter((m) => /Duplicate|Bring forward|Send backward/.test(m.textContent)).map((m) => m.querySelector('.mi-key').textContent) }; })()`);
const at1 = mid(await box('#shapeList .shape[data-id="s2"] .shape-name'));
check('UX99: a right click on a Shapes row opens its ⋯ menu at the pointer', g && Math.abs(g.x - at1[0]) < 4 && (Math.abs(g.y - at1[1]) < 4 || g.y < at1[1]), Object.assign({ at1 }, g));
check('UX97: the menu shows the keys (⌘D, ⌘], ⌘[)', g && g.keys.length === 3 && g.keys.every((k) => /[⌘C]/.test(k)), g && g.keys);
await key('Escape'); await settle(200);
const cb = await box('#pipeline .card[data-k="1"] .thumb');
await rclick(cb.l + 30, cb.t + 30);
g = await ev(`(() => { const p = document.querySelector('#popHost .pop.menu'); if (!p) return null; const b = p.getBoundingClientRect(); return { x: b.left, y: b.top, b: b.bottom, n: p.querySelectorAll('.mi').length }; })()`);
check('UX99: a right click on a chain card opens its ⋯ menu at the pointer', g && g.n > 2 && Math.abs(g.x - (cb.l + 32)) < 4 && (Math.abs(g.y - (cb.t + 32)) < 4 || Math.abs(g.b - (cb.t + 28)) < 4), Object.assign({ at: [cb.l + 30, cb.t + 30] }, g));
await shot('ux165-ux99-card');
await key('Escape');
// UX97: Alt+→ / Alt+← move the focused chain step right / left (its ⋯ menu's Move right / left), the card keeps focus
await settle(200);
const st0 = await ev(`[...document.querySelectorAll('#pipeline .card[data-k]')].filter((c) => c.dataset.k !== '0').map((c) => c.querySelector('.nm').textContent).join(',')`);
await ev(`document.querySelector('#pipeline .card[data-k="1"]').focus(); 1`);
await key('ArrowRight', 1); await settle(400);
g = await ev(`({ st: [...document.querySelectorAll('#pipeline .card[data-k]')].filter((c) => c.dataset.k !== '0').map((c) => c.querySelector('.nm').textContent).join(','), foc: document.activeElement && document.activeElement.closest('.card') ? document.activeElement.closest('.card').dataset.k : null })`);
const st1 = g;
await key('ArrowLeft', 1); await settle(400);
const st2 = await ev(`[...document.querySelectorAll('#pipeline .card[data-k]')].filter((c) => c.dataset.k !== '0').map((c) => c.querySelector('.nm').textContent).join(',')`);
check('UX97: Alt+→ moves the focused step right (focus stays on it), Alt+← moves it back', st0.split(',').length >= 2 && st1.st === st0.split(',').slice(0, 2).reverse().concat(st0.split(',').slice(2)).join(',') && st1.foc === '2' && st2 === st0, { st0, st1, st2 });
grab();

await laptop(1440, 900, false);
await send('Emulation.setUserAgentOverride', { userAgent: UA0 });
const fails = R.filter((r) => !r[1]);
return { pass: R.length - fails.length, of: R.length, fails, exc };
