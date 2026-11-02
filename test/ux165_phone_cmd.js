// The phone's parts the steps view has, checked on a phone (412 × 860, 360 × 780 and a laptop's 1366 × 768, Android emulation, real touch
// events through Input.dispatchTouchEvent): the Tools sheet's tabs and the ⋯ menu (grouped, searchable), a tip inside the Display and Editor
// sheets (none cut, at 390 and at 360 px in Russian), a slow tap picks a point during a construction, and the guide's and the tour's touch
// wording (no Palette and keys on touch). The suite is pinned to the steps view (ci/suite_views.js) and checks every page it opens is the steps
// view. The phone's parts of the classic view (the chain bar and its sheet, the Deformation bar, the Both key, the cards) are
// test/ux165_phone_classic_cmd.js.
// A command file for a CDP daemon (test/cdp_kit README): python3 build.py && test/<you>_cdp/q.sh test/ux165_phone_cmd.js
// Prints {pass, fails, info}.
// (the sleeps left in this file are the gestures' own timing: a finger held down, a finger moved at a pace)
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = () => settled({});
const errs = [];
const grab = async () => { errs.push(...(await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource|favicon/.test(x.m || ''))); };
const fresh = async (ns, w, h, dark, mobile, extra = '') => {
  await view(w, h, !!dark, !!mobile);
  await send('Page.navigate', { url: 'about:blank' }); await settled({ panes: false });
  await nav(`${U}?ns=ux165p-${ns}-${Date.now()}${extra}`); await settle();
  ok('the steps view is on', await ev('typeof __cmwSteps === "function" && __cmwSteps().on'), null);
};
const withState = async (ns, w, h, mobile, st) => { await view(w, h, false, !!mobile); await load(`ux165p-${ns}-${Date.now()}`, st); await settle();
  ok('the steps view is on', await ev('typeof __cmwSteps === "function" && __cmwSteps().on'), null);
};
const box = (sel) => ev(`(() => { const e = typeof ${JSON.stringify(sel)} === 'string' ? document.querySelector(${JSON.stringify(sel)}) : null; if (!e || !e.getClientRects().length) return null; const b = e.getBoundingClientRect(); const t = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return { l: Math.round(b.left), t: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height), r: Math.round(b.right), b: Math.round(b.bottom), top: !!t && (t === e || e.contains(t)) }; })()`);
const center = async (sel) => { const b = await box(sel); return b ? [b.l + b.w / 2, b.t + b.h / 2] : null; };
const touch = async (x, y, ms = 60) => { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }); await sleep(ms); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
// (on a phone the chain's cards, F, Add function and Numbers are rows of the chain sheet; while it is closed, a
// tap on one of them is first the tap on "N steps ▾" that opens it, as a user's)
const CHAIN = /#pipeline|#addStepBtn|\.ph-nums/;
const tap = async (sel) => {
  const into = () => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (e) e.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' }); })()`);
  await into(); await settled({ panes: false });
  let c = await center(sel);
  if (!c && CHAIN.test(sel)) { const o = await center('.ph-csteps'); if (o) { await touch(o[0], o[1]); await settle(); await into(); await settled({ panes: false }); c = await center(sel); } }
  if (!c) { fails.push({ name: 'tap target missing', got: sel }); return false; }
  await touch(c[0], c[1]); await settle(); return true;
};
const hold = async (x, y, ms) => { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }); await sleep(ms); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await settle(); };
const STEPS2 = [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' }, on: true }];

// ---------------- the Tools sheet's tabs; the ⋯ menu grouped and searchable ----------------
await withState('d6', 360, 780, true, { shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 1 }, { id: 's2', kind: 'rect', a: [-2, -1], b: [1, 0.5] }], steps: STEPS2 });
await ev(`Phone.open('tools')`); await settle();
const tabInfo = async () => ev(`(() => { const tabs = [...document.querySelectorAll('.ph-sheet .ph-tabs > button')]; const body = document.querySelector('.ph-sheet .ph-sb[data-k="tools"]'); return { names: tabs.map((b) => b.textContent), on: tabs.filter((b) => b.getAttribute('aria-selected') === 'true').map((b) => b.dataset.tab), h: tabs.map((b) => Math.round(b.getBoundingClientRect().height)), w: tabs.map((b) => Math.round(b.getBoundingClientRect().width)), fits: body.scrollHeight <= body.clientHeight + 1, cut: tabs.some((b) => b.scrollWidth > b.clientWidth + 1), badge: (document.querySelector('#toolMore .ph-badge') || {}).textContent }; })()`);
const t0 = await tabInfo();
ok('D6 three tabs: Draw, Construct, Shapes with its count; 44 px, none cut', JSON.stringify(t0.names) === JSON.stringify(['Draw', 'Construct', 'Shapes 2']) && t0.h.every((x) => x >= 44) && !t0.cut, t0);
ok('D6 the Draw tab fits at 360 × 780 without scrolling; the More key shows the shape count', t0.on[0] === 'draw' && t0.fits && t0.badge === '2', t0);
await tap('.ph-tabs > button[data-tab="construct"]');
const t1 = await tabInfo();
ok('D6 the Construct tab fits without scrolling and lists the construction tools', t1.on[0] === 'construct' && t1.fits && (await ev(`!![...document.querySelectorAll('.ph-sheet .ph-tiles[data-tab="construct"] .ph-tile')].find((t) => t.dataset.tool === 'circle3')`)), t1);
await tap('.ph-tabs > button[data-tab="shapes"]');
const t2 = await tabInfo();
ok('D6 the Shapes tab holds the shapes and the formula field', t2.on[0] === 'shapes' && (await ev(`document.querySelectorAll('.ph-sheet .shape-row').length`)) === 2 && (await ev(`!!document.querySelector('.ph-sheet .ph-tabpane #formulaInput')`)), t2);
await ev(`Phone.close(true)`); await settle();
await ev(`Phone.open('tools')`); await settle();
ok('D6 the sheet reopens on the last tab', (await tabInfo()).on[0] === 'shapes');
await ev(`Phone.close(true)`); await settle();
await ev(`Phone.open('more')`); await settle();
const mn = await ev(`(() => { const b = document.querySelector('.ph-sb[data-k="more"]'); const q = b.querySelector('.ph-search'); const vis = () => [...b.querySelectorAll('.ph-row, .ph-srow')].filter((r) => !r.hidden).map((r) => r.textContent.trim().slice(0, 30)); const heads = () => [...b.querySelectorAll('.ph-h')].filter((h) => !h.hidden).map((h) => h.textContent); const o = { heads: heads(), q: q && Math.round(q.getBoundingClientRect().height), all: vis().length }; q.value = 'theme'; q.dispatchEvent(new Event('input')); o.theme = vis(); o.headsT = heads(); q.value = ''; q.dispatchEvent(new Event('input')); o.back = vis().length; return o; })()`);
ok('D6 the ⋯ menu: Scene, Figure, Sound, Help, Look, with a 44 px search field', JSON.stringify(mn.heads) === JSON.stringify(['Scene', 'Figure', 'Sound', 'Help', 'Look']) && mn.q >= 44, mn);
ok('D6 searching "theme" leaves the Theme row (and the command search), and clearing restores every row', mn.theme.some((r) => /^Theme/.test(r)) && mn.theme.length <= 3 && mn.back === mn.all, mn);
await ev(`Phone.close(true)`); await settle();
// ---------------- a tip inside the Display and Editor sheets, none cut, at 390 and at 360 px in Russian ----------------
for (const [w, extra, lang] of [[390, '', 'en'], [360, '&lang=ru', 'ru']]) {
  await fresh('tips' + w, w, 780, false, true, extra); await settle();
  for (const k of ['display', 'edit']) {
    await ev(`Phone.open('${k}')`); await settle();
    const t = await ev(`(() => { const b = document.querySelector('.ph-sb[data-k="${k}"]'), p = b && b.querySelector('.ph-tip'); if (!p) return null; p.scrollIntoView({ block: 'nearest' }); const r = p.getBoundingClientRect(), s = p.querySelector('span:last-child'), b2 = b.getBoundingClientRect(); return { text: p.textContent, h: Math.round(r.height), left: Math.round(r.left), right: Math.round(r.right), vis: !!p.getClientRects().length, cut: s.scrollWidth > s.clientWidth + 1 || p.scrollHeight > p.clientHeight + 1, inBody: r.left >= b2.left - 1 && r.right <= b2.right + 1 }; })()`);
    ok(`UX40 the ${k} sheet has its tip at ${w} px (${lang}), whole and inside the sheet`, t && t.vis && t.h > 0 && !t.cut && t.inBody && t.right <= w && /^(Tip|Совет)/.test(t.text), t);
  }
  await ev('Phone.close(true)'); await settle();
}

// ---------------- a slow tap picks a point during a construction ----------------
await fresh('slow', 412, 860, false, true);
await ev(`[...document.querySelectorAll('#constructTools .tool[data-tool]')].find((b) => b.dataset.tool === 'circle3').click()`); await settle();
const z0 = await ev(`(() => { const p = window.__cmwPlaneMenu && __cmwPlaneMenu(); return p ? p.w2s('L', 0, 0) : null; })()`);
await hold(z0[0], z0[1], 700);
ok('UX49 a 700 ms tap on z₀ picks it, no menu', !(await ev(`!!document.querySelector('#popHost > .pop.menu.pm')`)) && (await ev('Construct.debug().draft ? Construct.debug().draft.picks.length : 0')) === 1, await ev('Construct.debug().draft && Construct.debug().draft.picks.length'));
await hold(z0[0] + 120, z0[1] - 160, 700);
// (a long press while drawing cancels the drawing, as Esc does, and opens no menu)
// (as Esc: the picks and the picked curve go, the tool stays armed)
ok('UX49 a long press on empty space cancels the construction and opens no menu (issue #13)', !(await ev(`!!document.querySelector('#popHost > .pop.menu.pm')`)) && (await ev('(() => { const d = Construct.debug().draft; return !d || (!d.picks.length && !d.curve1); })()')), await ev('Construct.debug().draft'));
await key('Escape'); await settle();
await grab();

// ---------------- touch wording of the guide and the tour; no Palette and keys on touch ----------------
const guideText = async () => { await ev(`(document.querySelector('.modal-bg') || { remove() {} }).remove()`); await ev(`__tourApi.openGuide()`); await settle(); return ev(`(document.querySelector('.modal') || {}).innerText || ''`); };
await fresh('guide', 412, 860, false, true);
const gp = await guideText();
const DESK = ['tools on the left', 'Inspector on the right', 'Double-click', 'Shift-click', 'Right-click', 'Drag a card', 'Hover a point'];
ok('UX17 the phone guide has no desktop places or gestures', gp.length > 3000 && DESK.every((w) => !gp.includes(w)), DESK.filter((w) => gp.includes(w)));
ok('UX17 the phone guide names the phone\'s places', /Hold a finger/.test(gp) && /chain bar/.test(gp) && /bottom row/.test(gp), gp.slice(0, 200));
ok('UX17 the phone guide has no Keys section', !/\nKeys\n/.test(gp) && !(await ev(`!!document.querySelector('.modal table.keys')`)));
await ev(`document.querySelector('.modal-bg').remove()`);
const menuItems = async () => { await ev(`Tour.openHelpMenu(document.getElementById('hdrMoreBtn'))`); await settle(); const m = await ev(`[...document.querySelectorAll('.tour-menu .mi')].map((b) => b.textContent.trim())`); await ev('Tour.closeHelpMenu()'); return m; };
const mp = await menuItems();
ok('UX17 the phone tour menu has no Palette and keys', mp.length > 5 && !mp.some((t) => /Palette and keys/.test(t)), mp);
ok('UX17 tour copy on touch: no lens, no drag of a card', await ev(`(() => { const C = Tour._t.CHAPTERS, out = []; for (const c of C) for (const s of c.steps) { const t = Tour._t.copyFor(s, null, { coarse: true }); if (/\\blens\\b|Drag a card|Right-click|Double-click/.test(t)) out.push(c.id + '/' + s.id); } return out.length === 0; })()`));
await fresh('guideL', 1366, 768, false, false);
const gl = await guideText();
ok('UX17 the laptop guide keeps its wording and its Keys', /tools on the left/.test(gl) && (await ev(`!!document.querySelector('.modal table.keys')`)), gl.slice(0, 120));
await ev(`document.querySelector('.modal-bg').remove()`);
const ml = await menuItems();
ok('UX17 the laptop tour menu keeps Palette and keys', ml.some((t) => /Palette and keys/.test(t)), ml);
// Russian, on the phone
await fresh('guideRu', 412, 860, false, true, '&lang=ru');
const gr = await guideText();
ok('UX17 Russian phone guide: the touch wording', /Удерживайте палец/.test(gr) && !/Щёлкните правой кнопкой/.test(gr), gr.slice(0, 160));
await ev(`document.querySelector('.modal-bg').remove()`);
await grab();

// In Russian at 360: the sheet head keeps its keys whole (the title gives way)
await fresh('headRu', 360, 780, false, true, '&lang=ru');
await ev(`Phone.open('tools')`); await settle();
const hr = await ev(`(() => { const r = (s) => { const e = document.querySelector(s); const b = e.getBoundingClientRect(); return { w: Math.round(b.width), sw: e.scrollWidth, cw: e.clientWidth, r: Math.round(b.right) }; }; return { snap: r('.ph-sheet .ph-snap'), undo: r('.ph-sheet .ph-hundo'), x: r('.ph-sheet .ph-x') }; })()`);
ok('UX24 Russian 360: the Snap pill is not squeezed, Undo and × are 44 px', hr.snap.sw <= hr.snap.cw + 1 && hr.undo.w >= 44 && hr.x.w >= 44 && hr.snap.r <= hr.undo.r - 44, hr);
await ev(`Phone.close(true)`); await settle();
await grab();

ok('no exceptions or console errors', errs.length === 0, errs.slice(0, 5));
return { pass: fails.length === 0, fails, info };
