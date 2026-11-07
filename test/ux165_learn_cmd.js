// The learn piece (notes/ux-build/w1-learn-AS-BUILT.md): the guided-tour line on the phone and the landscape phone, the
// keys on the Shapes rows and their right-click menus, and the rest of the learn checks below (the laptop's sound
// checks are ux165_learn_sound_cmd.js; its first-run line is ux165_learn_first_run_cmd.js; standards-ok: those checks
// moved there unchanged, and the deformation section's checks are not here because the dock and play button they
// drove no longer exist), on a
// laptop (1366 x 768), a phone (412 x 860, Android Chrome emulation, real touch events through
// Input.dispatchTouchEvent) and a landscape phone (915 x 412) where it matters. A command file for a CDP daemon
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
g = await ev(`(() => { const L = document.querySelector('#rightLegend'), F = document.querySelector('#rightFoot'), plot = document.querySelector('#plotR'); return { legHead: L.parentNode.classList.contains('pane-head'), footHead: F.parentNode.classList.contains('pane-head'), inPlot: [...plot.querySelectorAll(':scope > .legend-chip:not(.calc-chip):not([hidden]), :scope > .options')].filter((e) => e.getClientRects().length).length, sum: (L.querySelector('.lg-sum') || {}).textContent, onlyBtn: [...F.children].every((c) => { const r = c.getBoundingClientRect(), hd = c.closest('.pane-head'), h = hd && hd.getBoundingClientRect(); return !!h && r.top >= h.top - 1 && r.bottom <= h.bottom + 1; }) }; })()`);
// (#247: the head's controls are inline, compact, every one inside the head)
check('UX20 laptop X → Y: the pattern key and the options are in Y\'s pane head, nothing of theirs on the plot', g.legHead && g.footHead && g.inPlot === 0 && /^cell /.test(g.sum || '') && g.onlyBtn, g);
let lb = await box('#rightLegend');
await move(lb.l + 8, lb.t + 8); await settle(500);
g = await ev(`(() => { const c = document.querySelector('#rightLegend > canvas'); const b = c.getBoundingClientRect(), h = document.querySelector('#paneR .pane-head').getBoundingClientRect(); return { shown: getComputedStyle(c).display !== 'none', under: b.top >= h.bottom - 1 }; })()`);
check('UX20: the key unfolds under the head only while pointed at (invited)', g.shown && g.under, g);
await shot('ux165-ux20-key-hover');
await move(300, 300); await settle(300);
check('UX20: and folds again', await ev(`getComputedStyle(document.querySelector('#rightLegend > canvas')).display === 'none'`));
// (#247: View outline and Phase key are toggles in Y's head, or behind its ⋯ when the head has no room, or, when the head
// holds no toggle at all, in the pattern button's pop-up above the patterns (one button); never over the plot)
const inlineKey = await ev(`(() => { const k = document.getElementById('wKeyChkR'), l = k && k.closest('label'); return !!(l && l.getClientRects().length && l.closest('#paneR .pane-head')); })()`);
if (!inlineKey) { await ev(`(document.querySelector('#rightFoot .opts-btn:not(.pat-btn)') || document.querySelector('#rightFoot .pat-btn')).click()`); await settle(400); }
g = await ev(`(() => { const k = document.getElementById('wKeyChkR'), f = document.getElementById('fovChk'), l = k && k.closest('label'), p = document.querySelector('.opts-pop'), hd = document.querySelector('#paneR .pane-head').getBoundingClientRect(); if (!l) return null; const b = (p || l).getBoundingClientRect(); return { phaseKey: l.getClientRects().length > 0, fov: !!f, inHead: !!l.closest('.pane-head'), under: !p || b.top >= hd.bottom - 1, titles: p ? p.querySelectorAll('.opts-h').length : 0 }; })()`);
check('UX20/#247: View outline and Phase key in Y\'s head, or in its ⋯ pop-up under it, with no title', g && g.phaseKey && g.fov && (g.inHead || g.under) && g.titles === 0, g);
await key('Escape'); await settle(200);
for (const v of ['phase', 'land']) {
  await ev(`__cmwSetMain('${v}')`); await settle(2200);
  g = await ev(`(() => { const F = document.querySelector('#leftFoot'), plot = document.querySelector('#plotL'); return { head: F.parentNode.classList.contains('pane-head'), bars: [...plot.querySelectorAll(':scope > .options, :scope > .legend-chip:not([hidden]):not(.calc-chip)')].filter((e) => e.getClientRects().length).length, leg: document.querySelector('#leftLegend').parentNode.classList.contains('pane-head') }; })()`);
  // (#365: Phase's colour key lies on the plot, top right, always shown; the Landscape's height key is the head's chip)
  if (v === 'phase') check('UX20/#365 laptop phase: its option bar is in X\'s pane head, the key is the one thing on the plot', g.head && !g.leg && g.bars === 1, g);
  else check(`UX20 laptop ${v}: its option bar and key are in X's pane head, none over the plot`, g.head && g.leg && g.bars === 0, g);
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

// ---------------------------------------------------------------- UX80, UX20: the empty chain's Add function in Y's head
// (the chain cleared by the palette's Clear chain)
const clearChain = async () => { await key('k', 4); await settled({ until: "!!document.getElementById('palInput')", max: 8000 }); await type('Clear chain'); await settled({ until: "document.getElementById('palInput').value === 'Clear chain'", max: 8000 }); await key('Enter'); await settled({ until: '__cmwP().steps.length === 0', max: 8000 }); };
await laptop();
await fresh('ux165e'); await settle(1800);
await clearChain();
g = await ev(`(() => { const e = document.querySelector('#emptyRight'), b = e.querySelector('.btn'); return { head: e.parentNode.classList.contains('pane-head'), shown: !e.hidden && !!b && b.getClientRects().length > 0, tip: b && b.dataset.tip, tiny: document.querySelector('#paneR').classList.contains('tiny') }; })()`);
check('UX20 laptop: the empty chain\'s "Add function" is in Y\'s pane head, not over the picture', g.head && g.shown && /Add a function to map the region/.test(g.tip || '') && !g.tiny, g);
// (the title is fitted with the button in place: its role is whole, short or gone, never cut by an ellipsis: "imag…")
g = await ev(`(() => { const t = document.querySelector('#rightTitle'), pr = t.querySelector('.prole'), pt = t.querySelector('.ptitle'), vis = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none'; return { cls: t.className, prCut: vis(pr) && pr.scrollWidth > pr.clientWidth + 1, ptCut: vis(pt) && pt.scrollWidth > pt.clientWidth + 1 }; })()`);
check('UX20 laptop: with "Add function" in Y\'s head the title and its role are not cut', !g.prCut && !g.ptCut, g);

await phone(412, 860);
await fresh('ux165f'); await settle(2200);
await clearChain();
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
grab();

await laptop(1440, 900, false);
await send('Emulation.setUserAgentOverride', { userAgent: UA0 });
const fails = R.filter((r) => !r[1]);
return { pass: R.length - fails.length, of: R.length, fails, exc };
