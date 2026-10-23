// Browser checks and screenshots of the guided tour on the v12 app: notes/tour/harness.html (built by
// notes/tour/build_harness.py: the published v12 test build, src/tour.js, the demo adapter and the harness panel).
// Run with a copy of test/cdp_kit: notes/tour/cdp/q.sh test/tour_cmd.js. Shots land in <kit>/shots/; the result is
// { pass, of, fails: [[name, false, detail]], logs }. The lit patch of every step is checked by test/tour_lit_cmd.js.
const ROOT = DIR.replace(/\/notes\/tour\/cdp$/, '').replace(/\/test\/[^/]+$/, '');
const U = 'file://' + ROOT + '/notes/tour/harness.html';
const R = [];
const check = (name, pass, detail) => R.push([name, !!pass, detail]);
const settle = async (ms = 900) => { await sleep(ms); await ev('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const cur = () => ev('Tour.current()');
const open = async (q, w = 1440, h = 900, dark = false, mobile = false) => { await view(w, h, dark, mobile); await nav(U + '?' + q); await settle(1800); };
const st = (k) => ev(`localStorage.getItem('${k}')`);
const recOf = async (ns) => JSON.parse((await st('cmw-tour:' + ns)) || '{}');
const box = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; })()`);
const meet = (a, b) => !!a && !!b && a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
const holes = () => ev(`(document.querySelector('.tour-shade').getAttribute('d').match(/M/g) || []).length - 1`);
const SHOTS = [];
logs();   // the console from earlier commands of this daemon is not ours
const snap = async (name) => { SHOTS.push(name); await shot(name); };

// a clean slate: this kit's own browser profile, file:// origin
await nav(U + '?ns=t0&bare=1'); await ev('localStorage.clear()');

// 1. a step on the real app: the spotlight follows its anchor and the callout sits beside it
await open('ns=t1&tour=step&ch=basics&i=1');
let g = await ev(`(() => { const c = document.querySelector('.tour-card').getBoundingClientRect(), p = document.querySelector('#paneL').getBoundingClientRect(); return { side: document.querySelector('.tour-card').dataset.side, overlap: !(c.left >= p.right || c.right <= p.left || c.top >= p.bottom || c.bottom <= p.top), hole: document.querySelector('.tour-shade').getAttribute('d').split('Z')[1] }; })()`);
check('X step: callout beside the pane, not over it', g.side === 'right' && !g.overlap, g);
check('X step: a hole in the shade', g.hole && g.hole.length > 10, g.hole);
g = await ev(`({ role: document.querySelector('.tour-card').getAttribute('role'), live: document.querySelector('.tour-sr[aria-live]').textContent })`);
check('the callout is a dialog and the step is read aloud', g.role === 'dialog' && /Basics, step 2 of 10\. X: the domain\. X shows your shapes/.test(g.live) && !/\\/.test(g.live), g);
await snap('tour-x-light');
check('focus on Next', await ev(`document.activeElement === document.querySelector('.tour-card .btn.primary')`));
// Tab stays in the callout (no Try it here): Back, ×, Next
let tabs = [];
for (let i = 0; i < 4; i++) { await key('Tab'); tabs.push(await ev(`document.querySelector('.tour-card').contains(document.activeElement) ? document.activeElement.textContent || document.activeElement.getAttribute('aria-label') : 'OUT:' + document.activeElement.tagName`)); }
check('Tab cycles inside the callout', tabs.every((t) => !/^OUT/.test(t)), tabs);
await ev(`document.querySelector('.tour-card .btn.primary').focus()`);
await key('ArrowRight'); await settle(700);
check('ArrowRight: next step', (await cur()).id === 'y', await cur());
await key('ArrowLeft'); await settle(700);
check('ArrowLeft: back', (await cur()).id === 'x', await cur());
await click(120, 820); await settle(300);
check('a click on the shade keeps the tour', await ev('Tour.isActive()'));
const stash1 = await st('cmw-tour-stash:t1');
check('the user\'s work is stashed while the tour runs (its persisted state, this page\'s id)', stash1 && /"page"/.test(stash1) && /"state"/.test(stash1) && !/"mem"/.test(stash1), stash1 && stash1.slice(0, 60));
check('a heartbeat says this page holds the stash', /"page"/.test((await st('cmw-tour-live:t1')) || ''));
// a second Tour.init in this page (the app re-initialising) replaces the adapter and leaves the running tour alone
await ev(`window.__calls = []; window.__tourTap((k, n, a) => window.__calls.push(k + ':' + n)); Tour.init(window.__tourApi)`);
g = await ev(`({ restore: __calls.filter((c) => c === 'call:restore').length, active: Tour.isActive() })`);
check('Tour.init during a tour: no restore, the stash stays', g.restore === 0 && g.active && (await st('cmw-tour-stash:t1')) === stash1, g);
// a chapter started from inside the tour keeps the first snapshot (not the tour's scene)
await ev(`Tour.start({ chapter: 'views' })`); await settle(1500);
check('restart inside the tour: the stash is still the user\'s work', (await st('cmw-tour-stash:t1')) === stash1);
await key('Escape'); await settle(400);
check('Escape ends the tour', !(await ev('Tour.isActive()')) && !(await ev(`!!document.querySelector('.tour-root')`)));
check('progress remembered', (await recOf('t1')).last.ch === 'views');
check('the stash is cleared', (await st('cmw-tour-stash:t1')) === null);

// 2. two lit areas, trimmed apart, and a Try it that the lit pane can complete
await open('ns=t2&tour=step&ch=basics&i=4');
g = await ev(`(() => { const ps = document.querySelector('.tour-shade').getAttribute('d').split('Z').slice(1, -1); return { n: ps.length, tryShown: !document.querySelector('.tour-try').hidden }; })()`);
check('Draw: two holes (tools and the left pane) and a Try it', g.n === 2 && g.tryShown, g);
await snap('tour-draw-light');
// during a Try it, Tab reaches the lit tools as well as the callout
tabs = [];
for (let i = 0; i < 26; i++) { await key('Tab'); tabs.push(await ev(`document.querySelector('.tour-card').contains(document.activeElement) ? 'card' : document.querySelector('#secDraw').contains(document.activeElement) ? 'tools' : 'OUT'`)); }
check('Try it: Tab reaches the lit tools and the callout, nothing else', tabs.includes('tools') && tabs.includes('card') && !tabs.includes('OUT'), tabs);

// 3. Draw a disc, then the shapes step: the tour switches to Select, so dragging the line Im z = 0.8 moves it (no second disc)
await open('ns=t3s&tour=step&ch=basics&i=4');
await clickSel('#secDraw .tool[data-tool="disc"]'); await settle(200);
await drag(380, 500, 420, 530, 10, 16); await settle(700);
check('Draw: a disc drawn in X ticks the Try it', await ev(`document.querySelector('.tour-try').classList.contains('done')`));
const n0 = await ev(`__cmwShapes().shapes.length`);
await ev('Tour.next()'); await settle(1200);
g = await ev(`({ id: Tour.current().id, tool: document.querySelector('.tool.on[data-tool]').dataset.tool, tryText: document.querySelector('.tour-try').textContent })`);
check('Your shapes: Select is on, and the Try it says to press V', g.id === 'shapes' && g.tool === 'select' && /Press V/.test(g.tryText), g);
await drag(560, 293, 560, 250, 14, 16); await settle(700);
g = await ev(`({ done: document.querySelector('.tour-try').classList.contains('done'), ready: document.querySelector('.tour-card .btn.primary').classList.contains('ready'), n: __cmwShapes().shapes.length, sel: __cmwShapes().selected })`);
check('Your shapes: dragging the line ticks the Try it and draws nothing new', g.done && g.ready && g.n === n0, g);
await snap('tour-shapes-light');
// Escape with a shape selected: the app deselects, the tour stays; the next Escape (nothing left to cancel) ends it
await ev(`document.activeElement && document.activeElement.blur()`);
await key('Escape'); await settle(300);
g = await ev(`({ active: Tour.isActive(), sel: __cmwShapes().selected })`);
check('Escape with a shape selected: the selection goes, the tour stays', g.active && g.sel == null, g);
await key('Escape'); await settle(300);
check('a second Escape ends the tour', !(await ev('Tour.isActive()')));
// Escape while a polygon is being drawn cancels the polygon, not the tour
await open('ns=t3p&tour=step&ch=basics&i=4');
await clickSel('#secDraw .tool[data-tool="polygon"]'); await settle(200);
await click(380, 480); await sleep(150); await click(460, 500); await settle(300);
await key('Escape'); await settle(300);
check('Escape during a polygon: the tour stays', await ev('Tour.isActive()'));
await key('Escape'); await settle(300);
check('then Escape ends the tour', !(await ev('Tour.isActive()')));
// Escape in the callout always ends it
await open('ns=t3q&tour=step&ch=basics&i=4');
await ev(`window.__cmwSelect && __cmwSelect(__cmwShapes().shapes[0].id)`);
await ev(`document.querySelector('.tour-card .btn.primary').focus()`);
await key('Escape'); await settle(300);
check('Escape with the focus in the callout ends the tour, busy or not', !(await ev('Tour.isActive()')));

// 4. Try it completes and advances: the view switch; the portrait's callout sits below it
await open('ns=t3&tour=step&ch=views&i=0', 1440, 900, true);
// the user's look never leaks into the scene: a Stretch pattern is set back to Checker by the scene's look
await ev(`document.querySelector('#patternSeg [aria-label="Stretch"]').click()`); await settle(300);
await ev(`Tour.start({ chapter: 'views' })`); await settle(1600);
check('a scene sets its look: Checker even after the user chose Stretch', await ev(`document.querySelector('#patternSeg [aria-label="Checker"]').getAttribute('aria-checked') === 'true'`));
await snap('tour-views-switch-dark');
await ev(`window.__cmwSetMain('phase')`); await settle(1500);
g = await cur();
check('Try it "Choose Phase" advances to the portrait', g && g.id === 'phase', g);
await settle(500);
const panes = await box('#panes'), card = await box('.tour-card');
check('Phase portrait: the callout is below the panel, not over it', !meet(card, panes) && card.t >= panes.b, { card, panes });
await snap('tour-phase-dark');
// the sphere: the panel is lit, its Plane · Sphere control has a ring of its own
await ev('Tour.next()'); await settle(1200); await ev('Tour.next()'); await settle(1500);
g = await ev(`({ id: Tour.current().id, holes: (document.querySelector('.tour-shade').getAttribute('d').match(/M/g) || []).length - 1, mark: (document.querySelector('.tour-mark').getAttribute('d') || '').length > 10 })`);
check('Sphere: one lit panel and a ring on its surface control', g.id === 'sphere' && g.holes === 1 && g.mark, g);
await snap('tour-sphere-dark');
// patterns: Choose Stretch
await ev('Tour.next()'); await settle(1600);
check('Patterns step', (await cur()).id === 'patterns', await cur());
await clickSel('#patternSeg [aria-label="Stretch"]'); await settle(700);
check('Patterns: choosing Stretch ticks the Try it', await ev(`document.querySelector('.tour-try').classList.contains('done')`));
g = await ev(`({ count: document.querySelector('.tour-count').textContent, next: document.querySelector('.tour-card .btn.primary').textContent, done: !document.querySelectorAll('.tour-foot .btn')[1].hidden, h: Math.round(document.querySelector('.tour-foot').getBoundingClientRect().height) })`);
check('end of a chapter: Back, Done and "Next: Deformation" on one line', g.count === '' && g.next === 'Next: Deformation' && g.done && g.h <= 40, g);
await snap('tour-patterns-dark');
// the app's tooltip never covers the callout: hidden while it would, back as it moves away
// (ev does not wait for a promise's value here: the page keeps the answer in window.__tipCheck)
await ev(`(() => { const t = document.querySelector('#tip'), c = document.querySelector('.tour-card').getBoundingClientRect(); t.textContent = 'A tooltip'; t.hidden = false; t.style.left = (c.left + 20) + 'px'; t.style.top = (c.top + 10) + 'px'; })()`);
await sleep(120);
const over = await ev(`getComputedStyle(document.querySelector('#tip')).visibility`);
await ev(`(() => { const t = document.querySelector('#tip'); t.style.left = '20px'; t.style.top = '20px'; })()`);
await sleep(120);
g = { over, away: await ev(`getComputedStyle(document.querySelector('#tip')).visibility`) };
await ev(`document.querySelector('#tip').hidden = true`);
check('a tooltip over the callout is hidden, and shows again away from it', g.over === 'hidden' && g.away === 'visible', g);

// 5. features this build lacks are left out (v12: neither "All at once" nor the zeros-and-poles step)
await open('ns=t4&tour=step&ch=deform&i=2');
g = await ev(`({ id: Tour.current().id, count: document.querySelector('.tour-count').textContent, next: document.querySelector('.tour-card .btn.primary').textContent })`);
check('Paths is the last Deformation step on v12: "Next: Analysis"', g.id === 'paths' && g.next === 'Next: Analysis', g);
await snap('tour-paths-light');
await ev(`Tour.next()`); await settle(1600);
g = await ev(`({ cur: Tour.current(), count: document.querySelector('.tour-count').textContent })`);
check('deform/order is skipped into Analysis, which counts 4 steps', g.cur && g.cur.id === 'targets' && g.count === '1 of 4', g);
check('Targets: the copy names X and Y and the multiplicity', /X shades their preimages/.test(await ev(`document.querySelector('.tour-body').textContent`)) && /multiplicity/.test(await ev(`document.querySelector('.tour-body').textContent`)));
await ev(`Tour.next()`); await settle(1800);
g = await cur();
check('analysis/zp is skipped', g && g.id === 'integral', g);
await snap('tour-integral-light');
g = await ev(`document.querySelector('.tour-body').textContent + ' | ' + document.querySelector('.tour-try').textContent`);
check('Integrals: right-click the circle itself and choose ∮', /Right-click the circle itself/.test(g) && /∮/.test(g) && !/Integrate/.test(g), g);
await ev('Tour.next()'); await settle(1500);
g = await ev(`({ id: Tour.current().id, body: document.querySelector('.tour-body').textContent, panel: (document.querySelector('#propsPanel > section:nth-of-type(3)') || {}).textContent })`);
check('Natural domain comes next, and its copy matches the panel of a typed formula', g.id === 'domain' && /the formula is defined at/.test(g.body) && /formula is defined/.test(g.panel || ''), { id: g.id, body: g.body, panel: (g.panel || '').slice(0, 120) });
await ev('Tour.next()'); await settle(1500);
check('then Guarantees', (await cur()).id === 'guarantees');
check('chapter counted done on leaving it', (await recOf('t4')).done.deform === 1);

// 6. welcome (centred) and the end of Basics
await open('ns=t5&tour=step&ch=basics&i=0', 1440, 900, true);
g = await ev(`({ cls: document.querySelector('.tour-card').className, next: document.querySelector('.tour-card .btn.primary').textContent, holes: (document.querySelector('.tour-shade').getAttribute('d').match(/M/g) || []).length - 1, back: document.querySelector('.tour-foot .btn.ghost').hidden })`);
check('welcome: centred, no hole, Start, no Back', /center/.test(g.cls) && g.holes === 0 && g.next === 'Start' && g.back, g);
await snap('tour-welcome-dark');
await open('ns=t5b&tour=step&ch=basics&i=9');
g = await ev(`({ next: document.querySelector('.tour-card .btn.primary').textContent })`);
check('last step of Basics: "Next: Views"', g.next === 'Next: Views', g);
await snap('tour-examples-light');
g = await ev(`(() => { const a = Tour.lit().anchor, h = Tour.lit().holes[0]; return { a, h, ok: h.l <= a.l && h.t <= a.t && h.r >= a.r && h.b >= a.b }; })()`);
check('Examples: the lit patch holds the whole button (not a dot at its corner)', g.ok, g);
await clickSel('.tour-foot .btn.ghost:not([hidden]) + .btn.ghost'); await settle(500);
g = await recOf('t5b');
check('Done ends the tour, Basics is done and Continue points at Views', !(await ev('Tour.isActive()')) && g.done.basics === 1 && g.last && g.last.ch === 'views' && g.last.i === 0, g);

// 7. Escape belongs to the app while its palette is open
await open('ns=t6p&tour=step&ch=keys&i=0');
await key('k', 4); await settle(600);
g = await ev(`({ pal: !!document.querySelector('#popHost > .pop'), tick: document.querySelector('.tour-try').classList.contains('done') })`);
check('Command palette: Cmd-K opens it and ticks the Try it', g.pal && g.tick, g);
await key('Escape'); await settle(400);
g = await ev(`({ pal: !!document.querySelector('#popHost > .pop'), active: Tour.isActive() })`);
check('Escape closes the palette, not the tour', !g.pal && g.active, g);
await snap('tour-palette-light');
g = await ev(`(() => { const a = Tour.lit().anchor, h = Tour.lit().holes[0], c = document.querySelector('.tour-card').getBoundingClientRect(); return { lit: h.l <= a.l && h.r >= a.r && h.t <= a.t && h.b >= a.b, covered: c.left < a.r && c.right > a.l && c.top < a.b && c.bottom > a.t }; })()`);
check('Command palette: the field is lit whole and the callout does not cover it', g.lit && !g.covered, g);
await ev('Tour.next()'); await settle(1000);
check('Help is here: the help button is lit whole', await ev(`(() => { const a = Tour.lit().anchor, h = Tour.lit().holes[0]; return Tour.current().id === 'help' && h.l <= a.l && h.r >= a.r && h.t <= a.t && h.b >= a.b; })()`));
await snap('tour-help-light');
await ev(`Tour.start({ chapter: 'export' })`); await settle(1400);
check('Figures for articles: the export button is lit whole', await ev(`(() => { const a = Tour.lit().anchor, h = Tour.lit().holes[0]; return Tour.current().id === 'figure' && h.l <= a.l && h.r >= a.r && h.t <= a.t && h.b >= a.b; })()`));
await snap('tour-export-light');
await ev(`Tour.start({ chapter: 'keys' })`); await settle(1200);
await key('Escape'); await settle(400);
check('a second Escape ends the tour', !(await ev('Tour.isActive()')));

// 8. the suggestion: once, under the help button; Not now dismisses it for good
await open('ns=t6&tour=suggest');
await settle(600);
g = await ev(`(() => { const s = document.querySelector('.tour-suggest'); if (!s) return null; const b = s.getBoundingClientRect(), h = document.querySelector('#helpBtn').getBoundingClientRect(); return { below: b.top > h.bottom, right: b.right <= innerWidth - 8, focusKept: !s.contains(document.activeElement), noShade: !document.querySelector('.tour-root') }; })()`);
check('suggestion: under the help button, focus not taken, no shade', g && g.below && g.right && g.focusKept && g.noShade, g);
g = await ev(`({ title: document.querySelector('.tour-sg-title').textContent, body: document.querySelector('.tour-sg-body').textContent })`);
check('suggestion: the copy promises what Basics shows, and that the work is kept', /chain of functions/.test(g.body) && /work is kept/.test(g.body) && !/guarantee/.test(g.body), g);
await snap('tour-suggest-light');
await view(1440, 900, true); await settle(400);
await snap('tour-suggest-dark');
await clickSel('.tour-suggest .btn.ghost'); await settle(300);
check('Not now: dismissed', (await recOf('t6')).outcome === 'dismissed');
check('dismissed: not suggested again', (await ev('Tour.suggest({ delay: 0 })')) === false);
await view(1440, 900, false);
// a first visit without the force flag: shown and counted; ignored, it comes back, at most three times
await nav(U + '?ns=t6b&first=1&bare=1');
for (let i = 0; i < 40 && (await ev(`!!document.querySelector('.tour-suggest')`)) !== true; i++) await sleep(250);
check('first open: the suggestion shows', (await ev(`!!document.querySelector('.tour-suggest')`)) === true);
check('first open: counted', (await recOf('t6b')).shown === 1);
check('a first visit says "New here?"', /New here/.test(await ev(`document.querySelector('.tour-sg-title').textContent`)));
// working in a pane shrinks the card to a pill under Help
await click(500, 400); await settle(300);
g = await ev(`(() => { const s = document.querySelector('.tour-suggest'); const b = s.getBoundingClientRect(); return { compact: s.classList.contains('compact'), w: Math.round(b.width) }; })()`);
check('working in a pane shrinks the suggestion to a pill', g.compact && g.w < 240, g);
await snap('tour-suggest-pill-light');
await nav(U + '?ns=t6b&first=1&bare=1');
for (let i = 0; i < 40 && (await ev(`!!document.querySelector('.tour-suggest')`)) !== true; i++) await sleep(250);
check('a returning user (saved work) is not "new here"', /^Take the 2-minute tour$/.test(await ev(`document.querySelector('.tour-sg-title').textContent`)));
for (let k = 3; k <= 4; k++) { await nav(U + '?ns=t6b&first=1&bare=1'); await sleep(2200); }
g = await recOf('t6b');
check('ignored: shown on three openings, then no more', g.shown === 3 && !(await ev(`!!document.querySelector('.tour-suggest')`)), g);
await nav(U + '?ns=t6c&first=1&bare=1');
for (let i = 0; i < 40 && (await ev(`!!document.querySelector('.tour-suggest')`)) !== true; i++) await sleep(250);
await clickSel('.tour-suggest .btn.primary'); await settle(1500);
check('Start: the tour runs from Basics and the outcome is taken', (await ev('Tour.isActive()')) && (await recOf('t6c')).outcome === 'taken');
await key('Escape'); await settle(400);

// 9. the help menu: chapters, done marks, continue, keys
await open('ns=t7&tour=menu&rec=' + encodeURIComponent(JSON.stringify({ v: 1, shown: 1, outcome: 'taken', done: { basics: 1 }, last: { ch: 'views', i: 1 } })));
g = await ev(`(() => { const m = document.querySelector('.tour-menu'); return m && { items: [...m.querySelectorAll('.mi')].map(x => x.textContent.trim()), focus: m.contains(document.activeElement), role: m.getAttribute('role'), done: m.querySelectorAll('.tour-done').length }; })()`);
check('menu: continue, seven chapters, guide, shortcuts', g && g.items.length === 10 && /Continue/.test(g.items[0]) && g.role === 'menu' && g.done === 1 && /Branches and inverses/.test(g.items.join('|')), g);
check('menu: focus inside', g && g.focus);
await snap('tour-menu-light');
await view(1440, 900, true); await settle(300);
await snap('tour-menu-dark');
await key('ArrowDown'); await key('ArrowDown'); await key('Enter'); await settle(1800);
g = await cur();
check('menu: arrow keys and Enter start a chapter', g && g.chapter === 'views' && g.step === 0, g);
await key('Escape'); await settle(300);
await view(1440, 900, false);

// 10. reduced motion: no transitions, the shade jumps
await view(1440, 900, false);
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
await nav(U + '?ns=t9&tour=step&ch=basics&i=1'); await settle(1800);
const d0 = await ev(`document.querySelector('.tour-shade').getAttribute('d')`);
await ev('Tour.next()'); await sleep(320);
g = await ev(`({ tr: getComputedStyle(document.querySelector('.tour-card')).transitionDuration, d: document.querySelector('.tour-shade').getAttribute('d') })`);
const d1 = g.d; await sleep(300);
check('reduced motion: no card transition, the cut-out jumps', /^0s(, 0s)*$/.test(g.tr) && d1 !== d0 && d1 === (await ev(`document.querySelector('.tour-shade').getAttribute('d')`)), g.tr);
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });

// 11. the harness panel (no URL mode): it lists the chapters and logs what the tour asks of the app
await nav(U + '?ns=t10'); await settle(1500);
await ev(`(() => { const s = document.querySelector('.tour-suggest'); if (s) Tour.dismissSuggestion(); })()`);
g = await ev(`({ panel: !!document.querySelector('.th-panel'), chapters: document.querySelectorAll('.th-panel [data-chapters] .btn').length })`);
check('harness: panel with seven chapter buttons', g.panel && g.chapters === 7, g);
await clickSel('.th-panel [data-chapters] .btn:nth-child(4)'); await settle(2000);
g = await ev(`({ cur: Tour.current(), log: document.querySelector('.th-log').textContent })`);
check('harness: a chapter button starts it, the log shows the calls', g.cur && g.cur.chapter === 'analysis' && /loadScene/.test(g.log) && /setView/.test(g.log), g.log.slice(0, 200));
await snap('tour-harness-light');
await key('Escape'); await settle(400);

// 12. phone: the callout is a sheet, the anchor scrolled into the free half, nothing scrolls sideways
await open('ns=t8&tour=step&ch=basics&i=1', 390, 844, false, true);
g = await ev(`(() => { const c = document.querySelector('.tour-card').getBoundingClientRect(), p = document.querySelector('#paneL').getBoundingClientRect(); return { sheet: document.querySelector('.tour-card').classList.contains('sheet'), cw: Math.round(c.width), over: !(c.top >= p.bottom || c.bottom <= p.top), noHScroll: document.documentElement.scrollWidth <= innerWidth }; })()`);
check('phone: sheet, full width, not over the pane, no horizontal scroll', g.sheet && g.cw >= 390 - 32 && !g.over && g.noHScroll, g);
await snap('tour-phone-x');
await open('ns=t8b&tour=step&ch=basics&i=4', 390, 844, true, true);
g = await ev(`(() => { const c = document.querySelector('.tour-card').getBoundingClientRect(); return { lit: Tour.lit(), top: c.top, bottom: c.bottom }; })()`);
check('phone, two lit areas: the sheet sits between them', g.lit && g.lit.edge === 'middle' && g.lit.holes.length === 2 && g.lit.holes.every((h) => h.b <= g.top || h.t >= g.bottom), g);
await snap('tour-phone-draw-dark');
// what a phone reads: the panes by their role, touch instead of hover
const phoneText = [];
for (const [ch, i] of [['basics', 1], ['basics', 2], ['basics', 3], ['basics', 4], ['analysis', 0], ['analysis', 2]]) {
  await ev(`Tour.start({ chapter: '${ch}', step: ${i} })`); await settle(1300);
  phoneText.push(await ev(`Tour.current().id + ': ' + document.querySelector('.tour-body').textContent + ' ' + (document.querySelector('.tour-try').hidden ? '' : document.querySelector('.tour-try').textContent)`));
}
check('phone: no left, right or hover in what the steps say', phoneText.length === 6 && phoneText.every((t) => !/\bhover|\b(left|right)\b(?!\s+angles?)/i.test(t)), phoneText);
check('phone: the preimages step says touch and hold', phoneText.some((t) => /^preimages: Touch and hold/.test(t)), phoneText[2]);
await key('Escape'); await ev('Tour.stop()'); await settle(300);
await open('ns=t8c&tour=suggest', 390, 844, false, true); await settle(500);
await sleep(400);
g = await ev(`(() => { const s = document.querySelector('.tour-suggest').getBoundingClientRect(), h = document.querySelector('header').getBoundingClientRect(); return { top: s.top, hdr: h.bottom, b: innerHeight - s.bottom, w: Math.round(s.width) }; })()`);
check('phone: the suggestion is a sheet under the top bar, clear of the tool bar', g.top >= g.hdr && g.top <= g.hdr + 20 && g.b > 120 && g.w >= 390 - 32, g);
g = await ev(`document.querySelector('.tour-sg-body').textContent + document.querySelector('#tourSay').textContent`);
check('phone: the suggestion says where Help is (in ⋯)', /⋯ › Help/.test(g), g);
await snap('tour-phone-suggest');
// the help menu from the ⋯ menu: the help button closes with ⋯, the menu hangs under ⋯
await nav(U + '?ns=t8d&bare=1'); await settle(1500);
await clickSel('#hdrMoreBtn'); await settle(400);
await clickSel('#helpBtn'); await settle(500);
g = await ev(`(() => { const m = document.querySelector('.tour-menu'); if (!m) return null; const b = m.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, inView: b.left >= 0 && b.right <= innerWidth && b.top >= 0 }; })()`);
check('phone: Help in ⋯ opens the tour menu on screen', g && g.inView && g.t > 20, g);
g = await ev(`[...document.querySelectorAll('.tour-menu .mi')].map((x) => x.textContent.trim())`);
check('phone: the menu shows no key hints and no shortcuts item', !g.some((t) => /Keyboard shortcuts/.test(t)) && !g.some((t) => /\?$/.test(t)), g);
await snap('tour-phone-menu');
await view(1440, 900, false);

const L0 = logs().filter((l) => /EXC|error|\[tour\]/i.test(l.t + l.m)).slice(0, 12);
check('no exceptions or tour warnings in the console (sections 1 to 12)', !L0.some((l) => l.t === 'EXC' || /\[tour\]/.test(l.m)), L0);

// 13. two starts in a row, the first one's step missing: the second chapter wins
await open('ns=t11&bare=1');
await ev(`Tour.dismissSuggestion()`);
await ev(`window.__anchor0 = __tourApi.anchor; __tourApi.anchor = (n) => (n === 'paneL' ? null : __anchor0(n))`);
await ev(`Tour.start({ chapter: 'basics', step: 1 }); Tour.start({ chapter: 'keys' })`); await settle(2200);
g = await cur();
check('two starts in a row with a missing anchor: the tour ends on the second chapter', g && g.chapter === 'keys' && g.id === 'palette', g);
await ev(`__tourApi.anchor = __anchor0`);
await key('Escape'); await ev('Tour.stop()'); await settle(400);

// 14. an adapter whose snapshot throws: no scene is loaded, Basics is refused, the tour says nothing about work coming back
await open('ns=t12&bare=1');
await ev(`Tour.dismissSuggestion(); window.__calls = []; window.__tourTap((k, n, a) => window.__calls.push([k, n, a])); __tourApi.snapshot = () => { throw new Error('no snapshot'); }`);
await ev(`window.__started = 'pending'; Tour.start({ chapter: 'basics', step: 1 }).then((v) => { window.__started = v; })`); await settle(600);
g = await ev('window.__started');
let calls = await ev(`__calls.filter((c) => c[0] === 'call').map((c) => c[1] + (c[1] === 'toast' ? ': ' + c[2][0] : ''))`);
check('snapshot throws: Basics is refused and no scene is loaded', g === false && !(await ev('Tour.isActive()')) && !calls.some((c) => /^loadScene|^setView|^restore/.test(c)) && calls.some((c) => /not available/.test(c)), calls);
await ev(`window.__calls.length = 0`);
await ev(`Tour.start({ chapter: 'keys' })`); await settle(1200);
check('snapshot throws: a chapter that borrows nothing still runs', (await cur() || {}).id === 'palette' && (await ev('Tour.lit().scenes')) === false);
await ev(`document.querySelector('.tour-card .btn.primary').focus()`); await key('Escape'); await settle(400);
calls = await ev(`__calls.filter((c) => c[0] === 'call').map((c) => c[1] + (c[1] === 'toast' ? ': ' + c[2][0] : ''))`);
check('snapshot throws: no restore, and the toast does not say "Your work is back"', !calls.some((c) => /^restore|^loadScene/.test(c)) && calls.some((c) => /^toast: The tour stays under/.test(c)) && !calls.some((c) => /work is back/.test(c)), calls);
// a restore that fails: the backup stays and the toast says how to get the work back
await open('ns=t13&bare=1');
await ev(`Tour.dismissSuggestion(); window.__calls = []; window.__tourTap((k, n, a) => window.__calls.push([k, n, a])); __tourApi.restore = () => false`);
await ev(`Tour.start({ chapter: 'basics', step: 1 })`); await settle(1500);
await ev(`document.querySelector('.tour-card .btn.primary').focus()`); await key('Escape'); await settle(400);
calls = await ev(`__calls.filter((c) => c[0] === 'call').map((c) => c[1] + (c[1] === 'toast' ? ': ' + c[2][0] : ''))`);
const resumed = await ev(`__calls.some((c) => c[0] === 'call' && c[1] === 'sandbox' && c[2][0] === false)`);
check('a failed restore: the stash is kept, the autosave stays paused, the toast says to reload', !!(await st('cmw-tour-stash:t13')) && !resumed && calls.some((c) => /reload the page/.test(c)) && !calls.some((c) => /work is back/.test(c)), { calls, resumed });

const L = logs().filter((l) => /EXC|error|\[tour\]/i.test(l.t + l.m)).slice(0, 12);
// (section 14 warns on purpose: a snapshot that throws, a restore that fails)
check('no exceptions in the console (sections 13 and 14)', !L.some((l) => l.t === 'EXC'), L);
return { pass: R.filter((r) => r[1]).length, of: R.length, fails: R.filter((r) => !r[1]), shots: SHOTS, logs: L };
