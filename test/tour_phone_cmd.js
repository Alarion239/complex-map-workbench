// v16.4 (notes/tour-r3/SPEC.md 7.5): the tour on a phone, now a docked strip. 390 × 844 and 360 × 780 in portrait,
// 844 × 390 and 780 × 360 in landscape, English and Russian, touch. Every step: its title and its lead or task show on
// arrival (no tap); the strip stays in one place; the tool row's buttons and the view switch are not covered by it (the
// topmost element at their centres, the tour's shade aside, is the button); portrait: the strip is the 68 px row under
// the header and X is 608 px high at 390 × 844 (600 before #246's 56 px chain bar); landscape: the strip sits in the header (X keeps its size) or in a 48 px
// row. Then: the Why panel is at most half the screen, scrolls inside, folds on a touch in X and that touch reaches the
// app; a sheet a step opens starts below the strip. (The v15.1 mini bar and its fold are gone with the callout.)
// (r3 review: the strip keeps one place per chapter; a chapter whose line needs three lines has a 76 px portrait row, or
// in landscape the row under the header (48 or 56 px); portrait shows × End and a chevron after the count, Next is an
// arrow named by its label; no lead, task, result, hint or caption of a chapter needs more lines than the strip has)
// Run: test/<you>_cdp/q.sh test/tour_phone_cmd.js
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const R = [];
const check = (name, pass, detail) => R.push([name, !!pass, detail]);
const settle = async (ms = 900) => { await sleep(ms); await ev('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))');
  // (v16.4: and until the step has settled: the strip no longer busy, the spotlight's morph over)
  for (let i = 0; i < 40; i++) { if (await ev(`!Tour.isActive() || (!document.querySelector('.tour-strip[aria-busy]') && !!Tour.lit() && !Tour.lit().moving)`)) break; await sleep(100); } };
const T = (type, pts) => send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p) => ({ x: p[0], y: p[1], id: 1, radiusX: 4, radiusY: 4, force: 1 })) });
const tap = async (x, y) => { await T('touchStart', [[x, y]]); await sleep(50); await T('touchEnd', []); };
const tdrag = async (x0, y0, x1, y1) => { await T('touchStart', [[x0, y0]]); for (let i = 1; i <= 10; i++) { await T('touchMove', [[x0 + (x1 - x0) * i / 10, y0 + (y1 - y0) * i / 10]]); await sleep(16); } await T('touchEnd', []); };
logs();
const PROBE = `(() => {
  const s = document.querySelector('.tour-strip');
  if (!s || !Tour.isActive()) return null;
  const b = s.getBoundingClientRect(), c = Tour.current();
  const vis = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  const title = s.dataset.mode === 'head' || s.dataset.mode === 'row' ? s.querySelector('.ts-tin') : s.querySelector('.ts-title');
  const lead = document.querySelector('#tourLead');
  // the topmost element at a point, the tour's shade and rings aside
  const top = (x, y) => (document.elementsFromPoint(x, y) || []).find((e) => !e.closest('[data-tour="root"], [data-tour="top"]'));
  const covered = [];
  for (const e of document.querySelectorAll('#secDraw > .tools > .tool, #secDraw > .ph-undo, #secDraw > .tool-more > summary, #viewSwitch > button, #hdrMoreBtn')) {
    if (!vis(e)) continue;
    const q = e.getBoundingClientRect(), x = q.left + q.width / 2, y = q.top + q.height / 2;
    if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
    const t = top(x, y);
    if (t && t.closest('.tour-strip, #tourWhy')) covered.push((e.id || e.dataset.tool || e.dataset.mode || e.className) + '<' + (t ? (t.id || t.className) : 'none'));
  }
  const p = document.querySelector('#paneL').getBoundingClientRect(), h = document.querySelector('header.top').getBoundingClientRect();
  const xb = s.querySelector('.ts-x'), chev = s.querySelector('.ts-chev svg'), nx = s.querySelector('.ts-next');
  return { id: c.chapter + '/' + c.id, ch: c.chapter, lines: Tour.lit() ? Tour.lit().lines : null, need: Tour._t.needLines(), x: vis(xb) && xb.getBoundingClientRect().width >= 44, xok: s.classList.contains('ts-xok'), chev: vis(chev), nextName: nx.getAttribute('aria-label') || '', nextW: Math.round(nx.getBoundingClientRect().width), mode: s.dataset.mode, strip: [b.left, b.top, b.right, b.bottom].map(Math.round), title: vis(title) && title.textContent.trim().length > 2, lead: vis(lead) && lead.textContent.trim().length > 4,
    leadCut: (() => { const e = s.querySelector('.ts-lead'); return e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1; })(), covered, paneH: Math.round(p.height), paneT: Math.round(p.top), head: Math.round(h.bottom), headTop: Math.round(h.top) };
})()`;
for (const [w, h] of [[390, 844], [360, 780], [844, 390], [780, 360]]) for (const lang of ['en', 'ru']) {
  const tag = `${w}x${h}-${lang}`;
  await view(w, h, lang === 'ru', true);
  await nav(U + `?ns=ph${w}${lang}` + (lang === 'ru' ? '&lang=ru' : '')); await settle(1500);
  await ev('Tour.dismissSuggestion()');
  // X without the tour, for landscape (the strip in the header changes nothing)
  const x0 = await ev(`Math.round(document.querySelector('#paneL').getBoundingClientRect().height)`);
  await ev('Tour.auto(false)');
  await ev(`Tour.start({ chapter: 'basics' })`); await settle(1500);
  let first = null, n = 0;
  const byCh = {};
  for (let k = 0; k < 60 && (await ev('Tour.isActive()')); k++) {
    const g = await ev(PROBE);
    if (!g) break;
    n++;
    const nm = `${tag} ${g.id}`;
    first = first || g;
    check(`${nm}: title and lead or task on arrival, no tap, nothing cut`, g.title && g.lead && !g.leadCut, g);
    const c0 = byCh[g.ch] || (byCh[g.ch] = g);
    check(`${nm}: the strip in one place through the chapter`, JSON.stringify(g.strip) === JSON.stringify(c0.strip), [c0.strip, g.strip]);
    check(`${nm}: the chapter's lines fit the strip (${g.need} needed, ${g.lines} given)`, g.need <= g.lines, [g.need, g.lines, g.mode]);
    if (g.mode === 'port') check(`${nm}: portrait: × End (44 px), a chevron after the count, Next a 44 px arrow named by its label`, g.x && g.chev && g.nextW === 44 && g.nextName.length > 3, g);
    // (r3 verify-2: in landscape × End is in the row under the header, and in the header when it has 52 px to spare)
    if (g.mode !== 'port') check(`${nm}: landscape: × End (44 px) in the row under the header, in the header with room`, g.mode === 'row' ? g.x : g.x === g.xok, g);
    if (g.mode === 'port') check(`${nm}: portrait row ${g.lines === 3 ? 76 : 68} px under the header`, g.strip[3] - g.strip[1] === (g.lines === 3 ? 76 : 68) && Math.abs(g.strip[1] - g.head) <= 1, g.strip);
    else check(`${nm}: landscape, the header (X keeps its size) or the row under it (${g.lines === 3 ? 56 : 48} px)`, g.mode === 'head' ? g.strip[1] >= g.headTop - 1 && g.strip[3] <= g.head + 1 && g.lines === 2 : g.mode === 'row' && g.strip[3] - g.strip[1] === (g.lines === 3 ? 56 : 48), g);
    check(`${nm}: the tool row and the view switch not covered by the strip`, g.covered.length === 0, g.covered);
    const before = JSON.stringify(await ev('Tour.current()'));
    await ev('Tour.next()'); await settle(1000);
    if ((await ev('Tour.isActive()')) && JSON.stringify(await ev('Tour.current()')) === before) { check(`${nm}: Next moves on`, false); break; }
  }
  check(`${tag}: the walk saw the steps (at least 40)`, n >= 40, n);
  if (first) {
    // (#246: the chain bar is 56 px, 8 less than before, and X has them: 608, 600 with a three-line row)
    if (h > w) check(`${tag}: portrait, the strip is the row under the header${w === 390 ? '; X is 608 px (600 with a three-line row)' : ''}`, first.mode === 'port' && Math.abs(first.strip[1] - first.head) <= 1 && (w !== 390 || first.paneH === (first.lines === 3 ? 600 : 608)), first);
    else check(`${tag}: landscape, the strip in the header (X keeps its size) or a 48 or 56 px row`, (first.mode === 'head' && first.strip[1] >= first.headTop - 1 && first.strip[3] <= first.head + 1 && Math.abs(first.paneH - x0) <= 1) || (first.mode === 'row' && first.strip[3] - first.strip[1] === (first.lines === 3 ? 56 : 48)), [first, x0]);
  }
  // Why: a panel at most half the screen, scrolling inside, folded by a touch in X, which reaches the app
  if (lang === 'en') {
    await ev(`Tour.start({ chapter: 'basics', step: 1 })`); await settle(1500);
    const tb = await ev(`(() => { const b = document.querySelector('.ts-text').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
    await tap(tb[0], tb[1]); await settle(400);
    const wy = await ev(`(() => { const w = document.querySelector('#tourWhy'), b = w.getBoundingClientRect(), cs = getComputedStyle(w); return { open: !w.hidden, h: b.height, half: innerHeight / 2, scroll: /(auto|scroll)/.test(cs.overflowY), top: b.top, strip: document.querySelector('.tour-strip').getBoundingClientRect().bottom, held: Tour.lit().countdown.held }; })()`);
    check(`${tag}: Why opens a panel under the strip, at most half the screen, scrolling inside, holding the countdown`, wy.open && wy.h <= wy.half + 1 && wy.scroll && Math.abs(wy.top - wy.strip) <= 2 && wy.held.includes('why'), wy);
    const pb = await ev(`(() => { const b = document.querySelector('#paneL').getBoundingClientRect(), w = document.querySelector('#tourWhy').getBoundingClientRect(); return { l: b.left, t: Math.max(b.top, w.bottom), r: b.right, b: b.bottom }; })()`);
    // (the middle of X below the panel: clear of the plane's own buttons on its right and of the inset at its bottom left)
    const y = (pb.t + pb.b) / 2, x = (pb.l + pb.r) / 2;
    await tdrag(x + 30, y - 10, x - 40, y + 20); await settle(300);
    const after = await ev(`({ folded: document.querySelector('#tourWhy').hidden, done: document.querySelector('.ts-l2').classList.contains('done') })`);
    check(`${tag}: a touch in X folds Why and reaches the app (the pan ticks the task)`, after.folded && after.done, after);
    // a sheet a step opens starts below the strip (Phase key: the Display sheet)
    await ev(`Tour.start({ chapter: 'views', step: 4 })`); await settle(1600);
    const sh = await ev(`(() => { const s = [...document.querySelectorAll('.ph-sheet')].find((e) => !e.hidden && e.getClientRects().length); const t = document.querySelector('.tour-strip').getBoundingClientRect(); return s ? { sheet: Math.round(s.getBoundingClientRect().top), strip: Math.round(t.bottom), mode: document.querySelector('.tour-strip').dataset.mode } : null; })()`);
    check(`${tag}: a sheet the step opens starts below the strip`, !sh || sh.sheet >= sh.strip - 1 || sh.mode === 'head', sh);
  }
  await ev('Tour.stop()'); await settle(300);
}
await view(1440, 900, false, false);
// (r3 fix pass, as v16.2's audit: a step the layout leaves out, views/key on a landscape phone since v15, is the engine's
// report and is counted by "the walk saw the steps"; it is listed in skipped, not failed here)
const LALL = logs();
const SKIPS = [...new Set(LALL.filter((l) => /\[tour\] step skipped/.test(l.m)).map((l) => l.m))];
const L = LALL.filter((l) => /EXC|\[tour\]/i.test(l.t + l.m) && !/\[tour\] step skipped/.test(l.m)).slice(0, 12);
check('no exceptions or tour warnings', !L.length, L);
const fails = R.filter((r) => !r[1]);
return { pass: R.length - fails.length, of: R.length, fails: fails.slice(0, 60), nFails: fails.length, logs: L, skipped: SKIPS };
