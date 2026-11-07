// Browser checks and screenshots of the guided tour in the app: dist/test.html (src/tour.js wired by app.js's tourApi;
// the test hooks __tourApi and __tourTap). Serve dist/ on the kit's port and run with a copy of test/cdp_kit:
// test/<you>_cdp/q.sh test/tour_cmd.js. Shots land in <kit>/shots/; the result is { pass, of, fails: [[name, false,
// detail]], logs }. The lit patch of every step is checked by test/tour_lit_cmd.js.
// It runs in either view (ci/suite_views.js: the steps view here, the classic views in test/tour_cmd_classic_cmd.js) and
// addresses steps by id, their index read from the tour's chapters: the generic task step is X's pan in the classic views and
// Planes' first step in the steps view, the chapter after Basics Views or Planes. The strip's arrow keys (in the steps view ← →
// glide the planes), the Views chapter (the view switch, Phase, Sphere, Phase key) and the Deformation chapter are the classic
// views' only; the steps view checks its own chapter end (Edit a
// step) and Playing the chain's Part of the chain in their place.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const R = [];
const check = (name, pass, detail) => R.push([name, !!pass, detail]);
const settle = async (ms = 900) => { await sleep(ms); await ev('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const cur = () => ev('Tour.current()');
// (the shade's path is set by the strip's first paint, which a slow machine can reach after the settle: wait for it, up to 8 s)
const shaded = async () => { for (let i = 0; i < 320; i++) { if (await ev(`(() => { const s = document.querySelector('.tour-shade'); return !!(s && s.getAttribute('d')); })()`)) return true; await sleep(25); } return false; };
// (a condition wait: polls fn until it is truthy, up to max ms)
const waitFor = async (fn, max = 8000) => { for (const t0 = Date.now(); Date.now() - t0 < max;) { if (await fn()) return true; await sleep(30); } return false; };
// (the tour's current step, as { chapter, id })
const stepNow = async () => { const c = await cur(); return c ? c.chapter + '/' + c.id : null; };
// (Next, then the step has changed and the strip has its shade)
const nextStep = async () => { const was = await stepNow(); await ev('Tour.next()'); await waitFor(async () => (await stepNow()) !== was); await shaded(); };
// (Tour.start at a step or chapter, then the tour is on it and the strip has its shade)
const startAndWait = async (a) => { await ev(`Tour.start(${JSON.stringify(a)})`); await waitFor(async () => { const c = await cur(); return !!c && c.chapter === a.chapter && (a.step == null || c.step === a.step); }); await shaded(); };
const open = async (ns, at, w = 1440, h = 900, dark = false, mobile = false) => {
  await view(w, h, dark, mobile); await nav(U + '?ns=' + ns); await settle(1800);
  await ev('Tour.auto(false)');   // (tour_cmd checks the walk without the auto-advance; tour_auto_cmd.js checks it)
  if (at) { await ev(`Tour.start(${JSON.stringify(at)})`); await settle(1600); await shaded(); }
};
// the first-run card without ?ns= (the app's own rule), on this kit's own profile and origin
const fresh = async (keep) => { await nav(U + '?ns=t0'); await ev(`(() => { for (const k of Object.keys(localStorage)) if (!/:/.test(k)${keep ? " && !/^(complex-map-workbench-v1|cmw-tour)$/.test(k)" : ''}) localStorage.removeItem(k); })()`); };
const st = (k) => ev(`localStorage.getItem('${k}')`);
const recOf = async (ns) => JSON.parse((await st('cmw-tour:' + ns)) || '{}');
const box = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; })()`);
const meet = (a, b) => !!a && !!b && a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
const holes = async () => { await shaded(); return ev(`(document.querySelector('.tour-shade').getAttribute('d').match(/M/g) || []).length - 1`); };
const SHOTS = [];
logs();   // the console from earlier commands of this daemon is not ours
const snap = async (name) => { SHOTS.push(name); await shot(name); };

// a clean slate: this kit's own browser profile, file:// origin
await nav(U + '?ns=t0'); await ev('localStorage.clear()');
await waitFor(() => ev(`document.readyState === 'complete'`));
const SV = await isSteps();
// the tour's chapters in this view: [{ id, title, rev, steps: [ids] }]
const CH = await ev(`Tour._t.CHAPTERS.map((c) => ({ id: c.id, title: c.title, rev: c.rev, steps: c.steps.map((s) => s.id) }))`);
// a step by its 'chapter/id', as Tour.start's argument
const at = (p) => { const [chapter, id] = p.split('/'), c = CH.find((x) => x.id === chapter), step = c ? c.steps.indexOf(id) : -1; if (step < 0) throw new Error('no step ' + p); return { chapter, step }; };
const chOf = (id) => CH.find((c) => c.id === id);
// the generic task step (a pan of the left plane) and the step after it; the chapter after Basics
const PAN = SV ? 'planes/plane' : 'basics/x';
const PAN_TITLE = SV ? 'One plane at a time' : 'X: the domain';
const SECOND = CH[1];

// 1. a step on the real app: the spotlight follows its anchor; the strip sits above the panes, in the layout
await open('t1', at(PAN));
let g = await ev(`(() => { const c = document.querySelector('.tour-strip').getBoundingClientRect(), p = document.querySelector('#paneL').getBoundingClientRect(); return { mode: document.querySelector('.tour-strip').dataset.mode, overlap: !(c.left >= p.right || c.right <= p.left || c.top >= p.bottom || c.bottom <= p.top), above: c.bottom <= p.top + 0.5, hole: document.querySelector('.tour-shade').getAttribute('d').split('Z')[1] }; })()`);
check('X step: the strip above the pane, not over it', g.mode === 'desk' && !g.overlap && g.above, g);
check('X step: a hole in the shade', g.hole && g.hole.length > 10, g.hole);
g = await ev(`(() => { const s = document.querySelector('.tour-strip'), b = s.getBoundingClientRect(), e = document.elementFromPoint(b.left + b.width / 2, b.top + 20); return { inStrip: s.contains(e), title: document.querySelector('#tourTitle').textContent, lead: document.querySelector('#tourLead').textContent }; })()`);
check('the strip is a window of the shade, its title and task read without a tap', g.inStrip && g.title === PAN_TITLE && /^Drag empty space/.test(g.lead), g);
g = await ev(`({ role: document.querySelector('.tour-strip').getAttribute('role'), label: document.querySelector('.tour-strip').getAttribute('aria-label'), live: document.querySelector('.tour-sr[aria-live]').textContent })`);
check('the strip is a region and the step is read aloud', g.role === 'region' && g.label === 'Guided tour' && (() => { const [c, id] = PAN.split('/'), ch = chOf(c); return g.live.startsWith(`${ch.title}, step ${ch.steps.indexOf(id) + 1} of ${ch.steps.length}. ${PAN_TITLE}. Drag empty space`); })() && !/\\/.test(g.live), g);
await snap('tour-x-light');
check('the strip does not take the focus', await ev(`!document.querySelector('.tour-strip').contains(document.activeElement)`));
// (← → step the tour from its strip in the classic views; in the steps view they glide the planes, the thread step's task)
if (!SV) {
  await ev(`document.querySelector('.ts-next').focus()`);
  await key('ArrowRight'); await waitFor(async () => (await cur()).id !== 'x');
  check('ArrowRight: next step', (await cur()).id === 'y', await cur());
  await key('ArrowLeft'); await waitFor(async () => (await cur()).id === 'x');
  check('ArrowLeft: back', (await cur()).id === 'x', await cur());
} else {
  const first = (await cur()).id;
  await clickSel('.ts-next'); await waitFor(async () => (await cur()).id !== first);
  check('the strip\'s Next button: next step', (await cur()).id !== first, await cur());
  await clickSel('.ts-back'); await waitFor(async () => (await cur()).id === first);
  check('the strip\'s Back button: back', (await cur()).id === first, await cur());
}
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
await startAndWait({ chapter: SECOND.id });
check('restart inside the tour: the stash is still the user\'s work', (await st('cmw-tour-stash:t1')) === stash1);
await key('Escape'); await settle(400);
check('Escape ends the tour', !(await ev('Tour.isActive()')) && !(await ev(`!!document.querySelector('.tour-root')`)));
check('progress remembered', ((await recOf('t1')).last || {}).ch === SECOND.id, await recOf('t1'));
check('the stash is cleared', (await st('cmw-tour-stash:t1')) === null);

// 2. two lit areas, trimmed apart, and a Try it that the lit pane can complete
await open('t2', at('basics/draw'));
g = await ev(`(() => { const ps = document.querySelector('.tour-shade').getAttribute('d').split('Z').slice(1, -1), L = Tour.lit(), r = (sel) => { const b = document.querySelector(sel).getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; }, inHole = (a) => L.holes.some((h) => h.l <= a.l + 1 && h.t <= a.t + 1 && h.r >= a.r - 1 && h.b >= a.b - 1); return { n: ps.length, holes: L.holes.length, disc: inHole(r('#secDraw .tool[data-tool="disc"]')), pane: inHole(r('#paneL')), tryShown: !document.querySelector('.ts-ring').hidden }; })()`);
// (and the strip's window, with no ring; the steps view's tools sit on the left pane, so one hole holds both)
check('Draw: the tools and the left pane lit, the strip\'s window and a task', (SV ? g.n === g.holes + 1 && g.disc && g.pane : g.n === 3) && g.tryShown, g);
await snap('tour-draw-light');
// during a Try it, Tab reaches the lit tools as well as the callout
tabs = [];
for (let i = 0; i < 26; i++) { await key('Tab'); tabs.push(await ev(`document.querySelector('.tour-strip').contains(document.activeElement) ? 'card' : document.querySelector('#secDraw').contains(document.activeElement) ? 'tools' : 'OUT'`)); }
check('Try it: Tab reaches the lit tools (v16.4: the strip is a region, not a focus trap)', tabs.includes('tools') || tabs.includes('card') && !tabs.includes('OUT'), tabs);

// 3. Draw a disc, then the shapes step: the tour switches to Select, so dragging the line Im z = 0.8 moves it (no second disc)
await open('t3s', at('basics/draw'));
await clickSel('#secDraw .tool[data-tool="disc"]'); await settle(200);
await drag(380, 500, 420, 530, 10, 16); await settle(700);
check('Draw: a disc drawn in X ticks the Try it', await ev(`document.querySelector('.ts-l2').classList.contains('done')`));
const n0 = await ev(`__cmwShapes().shapes.length`);
await ev('Tour.next()'); await settle(1200);
g = await ev(`({ id: Tour.current().id, tool: document.querySelector('.tool.on[data-tool]').dataset.tool, tryText: document.querySelector('#tourLead').textContent })`);
check('Your shapes: Select is on, and the Try it says to press V', g.id === 'shapes' && g.tool === 'select' && /Press V/.test(g.tryText), g);
const [lx, ly] = await ev(`__cmwW2S('L', 1.5, 0.8)`);
await drag(lx, ly, lx, ly - 40, 14, 16); await settle(700);
g = await ev(`({ done: document.querySelector('.ts-l2').classList.contains('done'), ready: document.querySelector('.ts-next').classList.contains('ready'), n: __cmwShapes().shapes.length, sel: __cmwShapes().selected })`);
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
await open('t3p', at('basics/draw'));
// (the step lights the Disc tool alone, so the shade covers the other tools: Polygon by its key, G)
await ev(`document.activeElement && document.activeElement.blur()`); await key('g'); await settle(200);
check('Polygon picked by its key during the Draw step', await ev(`document.querySelector('#tools .tool.on').dataset.tool === 'polygon'`));
await click(380, 480); await sleep(150); await click(460, 500); await settle(300);
await key('Escape'); await settle(300);
check('Escape during a polygon: the tour stays', await ev('Tour.isActive()'));
await key('Escape'); await settle(300);
check('then Escape ends the tour', !(await ev('Tour.isActive()')));
// Escape in the callout always ends it
await open('t3q', at('basics/draw'));
await ev(`window.__cmwSelect && __cmwSelect(__cmwShapes().shapes[0].id)`);
await ev(`document.querySelector('.ts-next').focus()`);
await key('Escape'); await settle(300);
check('Escape with the focus in the callout ends the tour, busy or not', !(await ev('Tour.isActive()')));

// 4. Try it completes and advances: the end of a chapter with a task, Edit a step
if (SV) {
  await open('t3', null, 1440, 900, true);
  // the user's look never leaks into the scene: an opacity of 0.3 is set back to the default by the scene's look
  await ev(`__cmwSet('alpha', 0.3), 1`); await waitFor(() => ev('__cmwRegions().alpha === 0.3'));
  await ev(`Tour.start({ chapter: 'planes' })`); await shaded();
  g = await ev(`__cmwRegions()`);
  check('a scene sets its look: the default opacity even after the user chose 0.3', g && g.alpha === 0.85, g);
  // Edit a step ends Planes: clicking the chip f₁ ticks its Try it
  await ev(`Tour.start(${JSON.stringify(at('planes/step'))})`); await shaded();
  await clickSel('#svStrip .sv-step[data-k="1"] .sv-fchip');
  check('Edit a step: clicking the chip f₁ ticks the Try it', await waitFor(() => ev(`document.querySelector('.ts-l2').classList.contains('done')`)));
  g = await ev(`({ count: document.querySelector('.ts-count').textContent, next: document.querySelector('.ts-next').textContent, label: document.querySelector('.ts-next').getAttribute('aria-label'), h: Math.round(document.querySelector('.ts-row').getBoundingClientRect().height) })`);
  const nx = 'Next: ' + CH[2].title, n = chOf('planes').steps.length;
  check(`end of a chapter: "${nx}" (or Next → with that name) on the strip's one row`, new RegExp(`${n} of ${n}`).test(g.count) && (g.next === nx || g.label === nx) && g.h <= 62, g);
  await snap('tour-planes-end-dark');
} else {
  await open('t3', { chapter: 'views', step: 0 }, 1440, 900, true);
}
// the app's tooltip never covers the callout: hidden while it would, back as it moves away
// (ev does not wait for a promise's value here: the page keeps the answer in window.__tipCheck)
await ev(`(() => { const t = document.querySelector('#tip'), c = document.querySelector('.tour-strip').getBoundingClientRect(); t.textContent = 'A tooltip'; t.hidden = false; t.style.left = (c.left + 20) + 'px'; t.style.top = (c.top + 10) + 'px'; })()`);
const tipVis = () => ev(`getComputedStyle(document.querySelector('#tip')).visibility`);
await waitFor(async () => (await tipVis()) === 'hidden', 3000);
const over = await tipVis();
await ev(`(() => { const t = document.querySelector('#tip'); t.style.left = '20px'; t.style.top = '20px'; })()`);
await waitFor(async () => (await tipVis()) === 'visible', 3000);
g = { over, away: await tipVis() };
await ev(`document.querySelector('#tip').hidden = true`);
check('a tooltip over the callout is hidden, and shows again away from it', g.over === 'hidden' && g.away === 'visible', g);

// 5. the steps on the deformation round's features show in this build: All at once, the zeros-and-poles step (the classic views' Deformation chapter; the steps view's Part of the chain is in Playing the chain)
if (SV) {
  await open('t4', at('playing/range'));
  g = await ev(`({ id: Tour.current().id, count: document.querySelector('.ts-count').textContent, next: document.querySelector('.ts-next').textContent })`);
  const n = chOf('playing').steps.length, nx = 'Next: ' + CH[3].title;
  check(`Part of the chain ends Playing the chain: "${nx}"`, g.id === 'range' && new RegExp(`${n} of ${n}$`).test(g.count) && (g.next === nx || g.next === 'Skip'), g);
  await snap('tour-range-light');
  await nextStep();
  check('Next on Part of the chain starts Editing the chain', ((await cur()) || {}).chapter === CH[3].id, await cur());
}
await startAndWait({ chapter: 'analysis' });
g = await ev(`({ cur: Tour.current(), count: document.querySelector('.ts-count').textContent })`);
check('Analysis counts 5 steps (v15: Zeros and poles moved to Editing)', g.cur && g.cur.id === 'targets' && /1 of 5$/.test(g.count), g);
g = await ev(`(Tour.lit() || {}).body`);
// (the steps view's step is Shapes on a later plane: a later plane's regions pulled back to z)
check('Targets: the copy names where the preimages show', SV ? /later plane/.test(g) && /all of their preimages/.test(g) : /X shades their preimages/.test(g) && /multiplicity/.test(g), g);
// the Cauchy phase style: Phase view, the style control lit whole (#247: on a desktop it is a row in X's pane head; its
// note, a sentence, is behind the head's ⋯ button, read in its popover), the integral over the scene's unit circle
await ev(`Tour.next()`); await settle(1800);
const litOpts = await ev(`(() => { const L = Tour.lit(), a = L && L.anchor, b = document.querySelector('#dcSeg'), r = b && b.getBoundingClientRect(); return !!(a && r && b.closest('.pane-head') && Math.abs(a.l - r.left) < 1 && Math.abs(a.r - r.right) < 1); })()`);
await ev(`document.querySelector('#leftFoot .opts-btn:not(.pat-btn)').click()`); await settle(500);
g = await ev(`(() => { const c = Tour.current(), L = Tour.lit(), sg = document.querySelector('#dcSeg'), a = L && L.anchor, r = sg && sg.getBoundingClientRect(), st = __cmwState(), note = document.querySelector('.opts-pop .foot-note'); return { c, scene: L && L.scene, main: st.view && st.view.main, dc: st.dc, lit: ${litOpts}, on: sg && (sg.querySelector('[aria-checked="true"]') || {}).textContent, note: note && note.textContent }; })()`);
check('Cauchy: the roots scene in Phase, the style control lit, Cauchy chosen, the integral over the unit circle', g.c && g.c.id === 'cauchy' && g.scene === 'roots' && g.main === 'phase' && g.dc === 'cauchy' && g.lit && g.on === 'Cauchy' && /inside, 0 outside/.test(g.note || '') && !/Select a closed curve/.test(g.note || ''), g);
await ev(`(() => { const b = document.querySelector('#leftFoot .opts-btn:not(.pat-btn)'); if (b && b.getAttribute('aria-expanded') === 'true') b.click(); return 1; })()`); await settle(300);
await snap('tour-cauchy-light');
// (Zeros and poles moved to the chapter Editing the chain, step 3; v15.2: step 4, after A formula in steps)
await startAndWait(at('edit/zp'));
check('Zeros and poles: its scene brings the Tiles style back', (await ev('__cmwState().dc')) === 'enhanced');
// (the zeros and poles are edited in the Inspector: the lit anchor is its parameter block)
g = await ev(`(() => { const c = Tour.current(), L = Tour.lit(), card = document.querySelector('#propsPanel .params.zp'); return { c, scene: L && L.scene, card: !!(card && L && L.anchor && Math.abs(card.getBoundingClientRect().left - L.anchor.l) < 1) }; })()`);
check('Zeros and poles: its scene and the zp card lit', g.c && g.c.id === 'zp' && g.scene === 'zp' && g.card, g);
await snap('tour-zp-light');
// a real drag of a zero ticks the Try it
const zh = await ev(`(__cmwZp().handles || []).find((q) => q.kind === 'zeros' || q.kind === 'zero')`);
if (zh) { await drag(zh.x, zh.y, zh.x + 12, zh.y - 18, 10, 16); await settle(700); }
check('Zeros and poles: dragging a zero ticks the Try it', !!zh && (await ev(`document.querySelector('.ts-l2').classList.contains('done')`)), zh);
// (Shared numbers: dragging the slider of a ticks the Try it, and the circle's radius follows a)
await ev('Tour.next()'); await settle(1800);
const sl = await ev(`(() => { const r = document.querySelector('#propsPanel .prm input[type=range]'); if (!r) return null; const b = r.getBoundingClientRect(); return { x: Math.round(b.left + b.width * 0.5), y: Math.round(b.top + b.height / 2), r: b.right }; })()`);
if (sl) { await drag(sl.x, sl.y, sl.x + 40, sl.y, 8, 16); await settle(700); }
g = await ev(`({ id: Tour.current().id, done: document.querySelector('.ts-l2').classList.contains('done'), a: (__cmwP().params || [])[0], r: (__cmwP().shapes.find((s) => s.kind === 'circle') || {}).r })`);
check('Shared numbers: the slider ticks the Try it, and the circle follows a', g.id === 'numbers' && g.done && g.a && Math.abs(g.a.value - g.r) < 1e-9 && g.a.value !== 1, g);
await snap('tour-numbers-light');
await startAndWait(at('analysis/cauchy'));   // (Cauchy; Next is Integrals)
await ev(`Tour.next()`); await settle(1800);
g = await ev(`({ c: Tour.current(), scene: Tour.lit() && Tour.lit().scene })`);
check('Integrals: the zp form of the residue scene', g.c && g.c.id === 'integral' && g.scene === 'residueZp', g);
await snap('tour-integral-light');
g = await ev(`(Tour.lit() || {}).body + ' | ' + document.querySelector('#tourLead').textContent`);
check('Integrals: right-click the circle itself and choose ∮', /Right-click the circle itself/.test(g) && /∮/.test(g) && !/Integrate/.test(g), g);
await ev('Tour.next()'); await settle(1500);
g = await ev(`({ id: Tour.current().id, body: (Tour.lit() || {}).body, panel: (document.querySelector('#propsPanel > section:nth-of-type(3)') || {}).textContent, tex: [...document.querySelectorAll('#propsPanel > section:nth-of-type(3) [data-tex], #propsPanel > section:nth-of-type(3) mjx-container')].map((e) => e.dataset.tex || e.getAttribute('aria-label') || '').join(' ') })`);
g.panel = await ev(`(document.querySelector('#propsPanel .insp-F .idom') || {}).textContent || ''`);
check('Natural domain comes next, and its copy matches the F Inspector of the zp scene (z ∉ {i, −i})', g.id === 'domain' && /written/.test(g.body) && /F tile/.test(g.body) && g.panel && !/formula is defined/.test(g.panel), { id: g.id, body: g.body, panel: (g.panel || '').slice(0, 120) });
await snap('tour-domain-light');
await ev('Tour.next()'); await settle(1500);
check('then Guarantees', (await cur()).id === 'guarantees');
// (the chapter left by the last Next of the Playing the chain walk above; the classic run does not walk one)
if (SV) {
  const LEFT = chOf('playing');
  check(`chapter counted done on leaving it (at its rev ${LEFT.rev})`, (await recOf('t4')).done[LEFT.id] === LEFT.rev, await recOf('t4'));
}

// 6. welcome (centred) and the end of Basics
await open('t5', { chapter: 'basics', step: 0 }, 1440, 900, true);
g = await ev(`({ shade: getComputedStyle(document.querySelector('.tour-root svg')).display, next: document.querySelector('.ts-next').textContent, back: document.querySelector('.ts-back').disabled && getComputedStyle(document.querySelector('.ts-back')).visibility === 'hidden', lead: document.querySelector('#tourLead').textContent })`);
check('welcome: no shade at all, Start, no Back, its lead (v16.5 UX90: says the practice is cleared)', g.shade === 'none' && g.next === 'Start' && g.back && /Practice freely: what you draw here is cleared at the end/.test(g.lead), g);
await snap('tour-welcome-dark');
await open('t5b', at('basics/examples'));
g = await ev(`({ next: document.querySelector('.ts-next').textContent })`);
check(`last step of Basics: "Next: ${SECOND.title}"`, g.next === 'Next: ' + SECOND.title, g);
await snap('tour-examples-light');
g = await ev(`(() => { const a = Tour.lit().anchor, h = Tour.lit().holes[0]; return { a, h, ok: h.l <= a.l && h.t <= a.t && h.r >= a.r && h.b >= a.b }; })()`);
check('Examples: the lit patch holds the whole button (not a dot at its corner)', g.ok, g);
await clickSel('.ts-x'); await settle(500);
g = await recOf('t5b');
check(`× on a chapter's last step ends the tour, Basics is done and Continue points at ${SECOND.title}`, !(await ev('Tour.isActive()')) && g.done.basics === 3 && g.last && g.last.ch === SECOND.id && g.last.i === 0, g);

// 7. Escape belongs to the app while its palette is open
await open('t6p', { chapter: 'keys', step: 0 });
await key('k', 4); await settle(600);
g = await ev(`({ pal: !!document.querySelector('#popHost > .pop'), tick: document.querySelector('.ts-l2').classList.contains('done') })`);
check('Command palette: Cmd-K opens it and ticks the Try it', g.pal && g.tick, g);
await key('Escape'); await settle(400);
g = await ev(`({ pal: !!document.querySelector('#popHost > .pop'), active: Tour.isActive() })`);
check('Escape closes the palette, not the tour', !g.pal && g.active, g);
await snap('tour-palette-light');
g = await ev(`(() => { const a = Tour.lit().anchor, h = Tour.lit().holes[0], c = document.querySelector('.tour-strip').getBoundingClientRect(); return { lit: h.l <= a.l && h.r >= a.r && h.t <= a.t && h.b >= a.b, covered: c.left < a.r && c.right > a.l && c.top < a.b && c.bottom > a.t }; })()`);
check('Command palette: the field is lit whole and the callout does not cover it', g.lit && !g.covered, g);
await ev('Tour.next()'); await settle(1000);
// (the Sound settings step moved to the Sound chapter, its last step)
if (await ev(`typeof Sound !== 'undefined'`)) {
  await ev(`Tour.start({ chapter: 'sound', step: 3 })`); await settle(1500);
  check('Sound settings: the Sound button is lit whole', await ev(`(() => { const a = Tour.lit().anchor, h = Tour.lit().holes[0]; return Tour.current().id === 'settings' && h.l <= a.l && h.r >= a.r && h.t <= a.t && h.b >= a.b; })()`));
  await ev(`Tour.start({ chapter: 'keys', step: 1 })`); await settle(1000);
}
check('Help is here: the help button is lit whole', await ev(`(() => { const a = Tour.lit().anchor, h = Tour.lit().holes[0]; return Tour.current().id === 'help' && h.l <= a.l && h.r >= a.r && h.t <= a.t && h.b >= a.b; })()`));
await snap('tour-help-light');
await ev(`Tour.start({ chapter: 'export' })`); await settle(1400);
check('Figures for articles: the export button is lit whole', await ev(`(() => { const a = Tour.lit().anchor, h = Tour.lit().holes[0]; return Tour.current().id === 'figure' && h.l <= a.l && h.r >= a.r && h.t <= a.t && h.b >= a.b; })()`));
await snap('tour-export-light');
await ev(`Tour.start({ chapter: 'keys' })`); await settle(1200);
await key('Escape'); await settle(400);
check('a second Escape ends the tour', !(await ev('Tour.isActive()')));

// 8. the suggestion (v16.5 UX21: one line in the tour's docked slot, never a card over the planes); Not now dismisses
// it for good
await open('t6');
await ev('Tour.reset(); Tour.suggest({ delay: 0, force: true })'); await settle(1200);
g = await ev(`(() => { const s = document.querySelector('.tour-lane[data-tour="suggest"]'); if (!s) return null; const b = s.getBoundingClientRect(), ps = ['#paneL', '#paneR'].map((q) => document.querySelector(q)).filter((e) => e && e.getClientRects().length).map((e) => e.getBoundingClientRect()); return { docked: s.parentNode.id === 'tourSlot', above: ps.length > 0 && ps.every((p) => b.bottom <= p.top + 0.5), panes: ps.map((p) => [p.top, p.width]), h: Math.round(b.height), focusKept: !s.contains(document.activeElement), noShade: !document.querySelector('.tour-root') }; })()`);
check('suggestion: a line in the docked slot above the planes, focus not taken, no shade', g && g.docked && g.above && g.h <= 56 && g.focusKept && g.noShade, g);
g = await ev(`({ title: document.querySelector('.tour-sg-title').textContent, body: document.querySelector('.tour-sg-body').textContent })`);
check('suggestion: the copy promises what Basics shows, and nothing about keeping the practice (UX90)', /chain of functions/.test(g.body) && !/work is kept/.test(g.body) && !/guarantee/.test(g.body), g);
await snap('tour-suggest-light');
await view(1440, 900, true); await settle(400);
await snap('tour-suggest-dark');
await clickSel('.tour-lane .btn.ghost'); await settle(300);
check('Not now: dismissed', (await recOf('t6')).outcome === 'dismissed');
check('dismissed: not suggested again', (await ev('Tour.suggest({ delay: 0 })')) === false);
await view(1440, 900, false);
// under ?ns= (the tests, the golden images) the card never shows by itself
await nav(U + '?ns=t6x'); await sleep(2600);
check('under ?ns= no suggestion shows', (await ev(`!!document.querySelector('.tour-lane')`)) === false);
// a first visit (no ?ns=, nothing saved): shown and counted; ignored, it comes back, at most three times
await fresh(); await nav(U);
for (let i = 0; i < 40 && (await ev(`!!document.querySelector('.tour-lane')`)) !== true; i++) await sleep(250);
check('first open: the suggestion shows', (await ev(`!!document.querySelector('.tour-lane')`)) === true);
check('first open: counted', JSON.parse((await st('cmw-tour')) || '{}').shown === 1);
check('a first visit says "New here?"', /New here/.test(await ev(`document.querySelector('.tour-sg-title').textContent`)));
// (v16.5 UX21) working in a pane leaves the line where it is: it covers nothing
await click(500, 400); await settle(300);
check('working in a pane: the line stays docked', await ev(`(() => { const s = document.querySelector('.tour-lane'); return !!s && s.parentNode.id === 'tourSlot'; })()`));
await nav(U);
for (let i = 0; i < 40 && (await ev(`!!document.querySelector('.tour-lane')`)) !== true; i++) await sleep(250);
check('a returning user (saved work) is not "new here"', /^Take the 2-minute tour$/.test(await ev(`document.querySelector('.tour-sg-title').textContent`)));
for (let k = 3; k <= 4; k++) { await nav(U); await sleep(2200); }
g = JSON.parse((await st('cmw-tour')) || '{}');
check('ignored: shown on three openings, then no more', g.shown === 3 && !(await ev(`!!document.querySelector('.tour-lane')`)), g);
await fresh(); await nav(U);
for (let i = 0; i < 40 && (await ev(`!!document.querySelector('.tour-lane')`)) !== true; i++) await sleep(250);
const w0 = await ev(`JSON.stringify(__cmwShapes())`);
await clickSel('.tour-lane .btn.primary'); await settle(1500);
check('Start: the tour runs from Basics and the outcome is taken', (await ev('Tour.isActive()')) && JSON.parse((await st('cmw-tour')) || '{}').outcome === 'taken');
await ev(`document.querySelector('.ts-next').focus()`); await key('Escape'); await settle(600);
check('Escape: the user\'s shapes are back', (await ev(`JSON.stringify(__cmwShapes())`)) === w0);
await fresh();

// 9. the help menu: chapters, done marks, continue, keys
await open('t7');
await ev(`localStorage.setItem('cmw-tour:t7', ${JSON.stringify(JSON.stringify({ v: 2, shown: 1, outcome: 'taken', done: { basics: 3 }, last: { ch: SECOND.id, i: 1 } }))})`);
await clickSel('#helpBtn'); await settle(500);
g = await ev(`(() => { const m = document.querySelector('.tour-menu'); return m && { items: [...m.querySelectorAll('.mi')].map(x => x.textContent.trim()), focus: m.contains(document.activeElement), role: m.getAttribute('role'), done: m.querySelectorAll('.tour-done').length }; })()`);
// (nine chapters, with Constructions; v16.4: ten, with Sound)
check('menu: continue, ten chapters, guide, shortcuts', g && g.items.length === 13 && /Continue/.test(g.items[0]) && g.role === 'menu' && g.done === 1 && /Branches and inverses/.test(g.items.join('|')), g);
check('menu: focus inside', g && g.focus);
await snap('tour-menu-light');
await view(1440, 900, true); await settle(300);
await snap('tour-menu-dark');
await key('ArrowDown'); await key('ArrowDown'); await key('Enter'); await settle(1800);
g = await cur();
check('menu: arrow keys and Enter start a chapter', g && g.chapter === SECOND.id && g.step === 0, g);
await key('Escape'); await settle(300);
await view(1440, 900, false);

// 10. reduced motion: no transitions, the shade jumps
await view(1440, 900, false);
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
// (a step whose next lights another area: X → Y, or in the steps view the thread → the ring)
await nav(U + '?ns=t9'); await waitFor(() => ev('!!window.Tour')); await startAndWait(at(SV ? 'planes/thread' : PAN));
const d0 = await ev(`document.querySelector('.tour-shade').getAttribute('d')`);
// (review verify-10: not a fixed 320 ms wait, which failed once under load while the step was still being placed: every
// frame's shade path is recorded until it has changed and then held for two frames (at most 3 s). A jump shows at
// most a few distinct paths; a 320 ms tween would show one per frame. The expression awaits the promise itself: in the
// daemon's REPL mode a returned promise comes back as {})
g = await ev(`await new Promise((res) => { const sh = () => document.querySelector('.tour-shade').getAttribute('d'), d0 = ${JSON.stringify(d0)}, seen = [], t0 = performance.now(); let last = null, same = 0;
  Tour.next();
  const tick = () => { const d = sh(); if (d !== last) { if (d !== d0) seen.push(d); last = d; same = 0; } else same++;
    if ((last !== d0 && same >= 2) || performance.now() - t0 > 3000) res({ tr: getComputedStyle(document.querySelector('.tour-strip')).transitionDuration, d: last, paths: seen.length, ms: Math.round(performance.now() - t0) });
    else requestAnimationFrame(tick); };
  requestAnimationFrame(tick); })`, 10000);
const d1 = g.d; await sleep(300);
check('reduced motion: the cut-out jumps', d1 !== d0 && g.paths <= 3 && d1 === (await ev(`document.querySelector('.tour-shade').getAttribute('d')`)), g);
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });

// 11. the palette lists the chapters ("Tour: …"); one starts its chapter, and the app gets the tour's calls
await nav(U + '?ns=t10'); await settle(1500);
await ev(`window.__calls = []; window.__tourTap((k, n, a) => window.__calls.push(n))`);
await key('k', 4); await settle(500); await type('tour'); await settle(500);
g = await ev(`[...document.querySelectorAll('#palList [role=option]')].map((x) => x.textContent.trim()).filter((t) => /^Tour:/.test(t))`);
check('palette: ten "Tour: …" entries', g.length === 10 && g.some((t) => /Tour: Analysis/.test(t)), g);
await ev(`(() => { const o = [...document.querySelectorAll('#palList [role=option]')].find((x) => /Tour: Analysis/.test(x.textContent)); o && o.click(); })()`); await settle(2000);
g = await ev(`({ cur: Tour.current(), calls: window.__calls })`);
check('palette: Tour: Analysis starts it; the tour loads its scene through the app', g.cur && g.cur.chapter === 'analysis' && g.calls.includes('loadScene') && g.calls.includes(SV ? 'svPlace' : 'setView') && g.calls.includes('sandbox'), g);
await snap('tour-analysis-light');
await ev(`document.querySelector('.ts-next').focus()`); await key('Escape'); await settle(400);

// 12. phone: the strip is a 68 px row under the header; X is 608 px (600 before #246's 56 px chain bar); nothing scrolls sideways
await open('t8', at(PAN), 390, 844, false, true);
g = await ev(`(() => { const c = document.querySelector('.tour-strip').getBoundingClientRect(), p = document.querySelector('#paneL').getBoundingClientRect(), h = document.querySelector('header.top').getBoundingClientRect(); return { mode: document.querySelector('.tour-strip').dataset.mode, top: c.top, h: c.height, cw: Math.round(c.width), head: h.bottom, paneT: p.top, paneH: Math.round(p.height), paneB: p.bottom, sv: (() => { const e = document.querySelector('#svStrip'); if (!e || !e.getClientRects().length) return null; const b = e.getBoundingClientRect(); return { t: b.top, b: b.bottom }; })(), overP: c.top < p.bottom && c.bottom > p.top, noHScroll: document.documentElement.scrollWidth <= innerWidth }; })()`);
// (the chain bar is 56 px, 8 less than before, and X has them: 608)
// (the steps view: the plane runs from the strip to the foot of the thread, which lies over its bottom)
check('phone: the strip under the header, full width, 68 px, X below it (608 px, or down to the thread\'s foot), no horizontal scroll', g.mode === 'port' && Math.abs(g.top - g.head) <= 1 && g.h === 68 && g.cw === 390 && !g.overP && (SV ? !!g.sv && Math.abs(g.paneT - (g.top + g.h)) <= 1 && Math.abs(g.paneB - g.sv.b) <= 1 : g.paneH === 608) && g.noHScroll, g);
await snap('tour-phone-x');
await open('t8b', at('basics/draw'), 390, 844, true, true);
g = await ev(`(() => { const c = document.querySelector('.tour-strip').getBoundingClientRect(), t = document.querySelector('#secDraw').getBoundingClientRect(), d = document.querySelector('#tools > .tool[data-tool="disc"]').getBoundingClientRect(), top = document.elementFromPoint(innerWidth / 2, (c.top + c.bottom) / 2); return { lit: Tour.lit(), top: c.top, bottom: c.bottom, row: { t: t.top, b: t.bottom }, disc: { l: d.left, t: d.top, r: d.right, b: d.bottom }, stripOnTop: !!(top && top.closest('.tour-strip')) }; })()`);
// (v16.1, user 5: the Disc key itself, not the whole row; v16.4: the strip clear of the tool row and on top)
check('phone, two lit areas: the Disc key lit whole, the strip clear of the tool row and on top', g.lit && g.lit.holes.length === 2 && ['l', 't', 'r', 'b'].every((k) => Math.abs(g.lit.holes[0][k] - g.disc[k]) <= 1) && (g.bottom <= g.row.t || g.top >= g.row.b) && g.stripOnTop, g);
await snap('tour-phone-draw-dark');
// what a phone reads: the panes by their role, touch instead of hover
const phoneText = [];
const PHONE_STEPS = SV ? ['planes/plane', 'planes/park', 'planes/carried', 'basics/draw', 'analysis/targets', 'analysis/integral'] : ['basics/x', 'basics/y', 'basics/preimages', 'basics/draw', 'analysis/targets', 'analysis/integral'];
for (const p of PHONE_STEPS) {
  await startAndWait(at(p));
  phoneText.push(await ev(`Tour.current().id + ': ' + (Tour.lit() || {}).body + ' ' + document.querySelector('#tourLead').textContent`));
}
check('phone: no left, right or hover in what the steps say', phoneText.length === 6 && phoneText.every((t) => !/\bhover|\b(left|right)\b(?!\s+angles?)/i.test(t)), phoneText);
// (the probe's step: preimages, or in the steps view Past the colour plane)
check('phone: the probe step says hold, then slide', phoneText.some((t) => (SV ? /^carried: .*hold a point and slide/ : /^preimages: Hold a point/).test(t)), phoneText[2]);
await key('Escape'); await ev('Tour.stop()'); await settle(300);
await open('t8c', null, 390, 844, false, true); await ev('Tour.reset(); Tour.suggest({ delay: 0, force: true })'); await settle(900);
await sleep(400);
g = await ev(`(() => { const s = document.querySelector('.tour-lane').getBoundingClientRect(), h = document.querySelector('header').getBoundingClientRect(), p = document.querySelector('.panes').getBoundingClientRect(), bs = [...document.querySelectorAll('.tour-lane button')].map((b) => b.getBoundingClientRect().height); return { top: s.top, hdr: h.bottom, panes: p.top, bot: s.bottom, w: Math.round(s.width), minB: Math.min(...bs) }; })()`);
check('phone: the suggestion is the docked row under the top bar (v16.5 UX21), the planes start under it, 44 px buttons', Math.abs(g.top - g.hdr) <= 1 && g.panes >= g.bot - 0.5 && g.w >= 390 - 2 && g.minB >= 44, g);
g = await ev(`document.querySelector('.tour-sg-body').textContent + document.querySelector('#tourSay').textContent`);   // (the live region says where it is)
check('phone: the suggestion says where the tour is (⋯ › Guided tour)', /⋯ › Guided tour/.test(g), g);
await snap('tour-phone-suggest');
// the help menu from the ⋯ menu: the help button closes with ⋯, the menu hangs under ⋯
await nav(U + '?ns=t8d'); await settle(1500);
// (⋯ opens the More sheet, whose Guided tour row opens the tour menu)
await clickSel('#hdrMoreBtn'); await settle(500);
await ev(`(() => { const b = [...document.querySelectorAll('.ph-row')].find((x) => /Guided tour/.test(x.textContent)); b && b.click(); })()`); await settle(600);
g = await ev(`(() => { const m = document.querySelector('.tour-menu'); if (!m) return null; const b = m.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, inView: b.left >= 0 && b.right <= innerWidth && b.top >= 0 }; })()`);
check('phone: Guided tour in ⋯ opens the tour menu on screen', g && g.inView && g.t > 20, g);
g = await ev(`[...document.querySelectorAll('.tour-menu .mi')].map((x) => x.textContent.trim())`);
check('phone: the menu shows no key hints and no shortcuts item', !g.some((t) => /Keyboard shortcuts/.test(t)) && !g.some((t) => /\?$/.test(t)), g);
await snap('tour-phone-menu');
await view(1440, 900, false);

const L0 = logs().filter((l) => /EXC|error|\[tour\]/i.test(l.t + l.m)).slice(0, 12);
check('no exceptions or tour warnings in the console (sections 1 to 12)', !L0.some((l) => l.t === 'EXC' || /\[tour\]/.test(l.m)), L0);

// 13. two starts in a row, the first one's step missing: the second chapter wins
await open('t11');
await ev(`Tour.dismissSuggestion()`);
await ev(`window.__anchor0 = __tourApi.anchor; __tourApi.anchor = (n) => (n === 'paneL' ? null : __anchor0(n))`);
await ev(`Tour.start(${JSON.stringify(at(PAN))}); Tour.start({ chapter: 'keys' })`); await waitFor(async () => ((await cur()) || {}).chapter === 'keys'); await shaded();
g = await cur();
check('two starts in a row with a missing anchor: the tour ends on the second chapter', g && g.chapter === 'keys' && g.id === 'palette', g);
await ev(`__tourApi.anchor = __anchor0`);
await key('Escape'); await ev('Tour.stop()'); await settle(400);

// 14. an adapter whose snapshot throws: no scene is loaded, Basics is refused, the tour says nothing about work coming back
await open('t12');
await ev(`Tour.dismissSuggestion(); window.__calls = []; window.__tourTap((k, n, a) => window.__calls.push([k, n, a])); __tourApi.snapshot = () => { throw new Error('no snapshot'); }`);
await ev(`window.__started = 'pending'; Tour.start({ chapter: 'basics', step: 1 }).then((v) => { window.__started = v; })`); await settle(600);
g = await ev('window.__started');
let calls = await ev(`__calls.filter((c) => c[0] === 'call').map((c) => c[1] + (c[1] === 'toast' ? ': ' + c[2][0] : ''))`);
check('snapshot throws: Basics is refused and no scene is loaded', g === false && !(await ev('Tour.isActive()')) && !calls.some((c) => /^loadScene|^setView|^restore/.test(c)) && calls.some((c) => /not available/.test(c)), calls);
await ev(`window.__calls.length = 0`);
await ev(`Tour.start({ chapter: 'keys' })`); await settle(1200);
check('snapshot throws: a chapter that borrows nothing still runs', (await cur() || {}).id === 'palette' && (await ev('Tour.lit().scenes')) === false);
await ev(`document.querySelector('.ts-next').focus()`); await key('Escape'); await settle(400);
calls = await ev(`__calls.filter((c) => c[0] === 'call').map((c) => c[1] + (c[1] === 'toast' ? ': ' + c[2][0] : ''))`);
check('snapshot throws: no restore, and the toast does not say "Your work is back"', !calls.some((c) => /^restore|^loadScene/.test(c)) && calls.some((c) => /^toast: The tour stays under/.test(c)) && !calls.some((c) => /work is back/.test(c)), calls);
// a restore that fails: the backup stays and the toast says how to get the work back
await open('t13');
await ev(`Tour.dismissSuggestion(); window.__calls = []; window.__tourTap((k, n, a) => window.__calls.push([k, n, a])); __tourApi.restore = () => false`);
await ev(`Tour.start({ chapter: 'basics', step: 1 })`); await settle(1500);
await ev(`document.querySelector('.ts-next').focus()`); await key('Escape'); await settle(400);
calls = await ev(`__calls.filter((c) => c[0] === 'call').map((c) => c[1] + (c[1] === 'toast' ? ': ' + c[2][0] : ''))`);
const resumed = await ev(`__calls.some((c) => c[0] === 'call' && c[1] === 'sandbox' && c[2][0] === false)`);
check('a failed restore: the stash is kept, the autosave stays paused, the toast says to reload', !!(await st('cmw-tour-stash:t13')) && !resumed && calls.some((c) => /reload the page/.test(c)) && !calls.some((c) => /work is back/.test(c)), { calls, resumed });

const L = logs().filter((l) => /EXC|error|\[tour\]/i.test(l.t + l.m)).slice(0, 12);
// (section 14 warns on purpose: a snapshot that throws, a restore that fails)
check('no exceptions in the console (sections 13 and 14)', !L.some((l) => l.t === 'EXC'), L);
return { pass: R.filter((r) => r[1]).length, of: R.length, fails: R.filter((r) => !r[1]), shots: SHOTS, logs: L };
