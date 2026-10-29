// v15.2: a formula in steps and one simple function in the search (notes/formula-steps/DESIGN.md 14.2), in the built
// page (dist/test.html), English and Russian, light and dark, desktop 1440, tablet 1024 and 768, phone 390 and 360
// with Android Chrome emulation:
//  1. the search: a query that is one catalog step lists that step first and Enter adds it (no formula step); two or
//     more steps keep the formula first and offer Add as n steps second; a sum of two functions of z is a formula only;
//     the same from the add-step menu;
//  2. the Inspector's offer: rows and button, clear of every plane, hidden while the formula is typed key by key;
//  3. the split: the steps and texts, the selection, the planes unchanged (X → Y, Phase, Landscape: 0 px at 8/255),
//     the toast, Undo by the toast, by Ctrl/⌘Z; 4. inside a chain; 5. with the deformation open (frame and T);
//  6. a shared number: c reads −a, a slider sweep keeps the chain equal to F and one GPU program;
//  7. a one-step formula step: Replace with the Sine step, Undo; 8. the alone walk ‹ ›;
//  9. Russian (tg z, no English left, the summary at most 2 lines and the button 1 line); 10. dark; 11. tablet;
// 12. phone (the Editor sheet, 44 px, the split, the chain bar); 13. the tour stop; 14. frame times; 15. export.
// A command file for the CDP daemon (test/cdp_kit README): python3 build.py && test/<you>_cdp/q.sh test/split_cmd.js
// Prints {pass, fails, info}; screenshots go to <daemon folder>/shots/split-*.png.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = (ns, q = '') => `http://localhost:${PORT}/test.html?ns=${ns}${q}`;
const fails = [], info = {};
let pass = 0;
const ok = (name, cond, got) => { if (cond) pass++; else fails.push({ name, got }); };
const settle = async (ms = 350) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const errs = [];
const grab = async () => { errs.push(...(await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource|favicon/.test(x.m || ''))); };
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const DESKUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const SHAPES = [{ id: 's1', kind: 'rect', a: [-1.2, -1.2], b: [1.2, 1.2] }];
const F1 = (expr, cut = 180) => ({ type: 'custom', params: { expr, cut }, on: true });
async function open(ns, st, q = '') {
  // (a page without the app first: the app saves its state when it unloads, which would overwrite this one)
  await send('Page.navigate', { url: `http://localhost:${PORT}/blank-${ns}.html` }); await sleep(400);
  const o = Object.assign({ v3: true, v4: true, shapes: SHAPES, steps: [], nextId: 50, focus: 0, rightMode: 'image' }, st || {});
  await ev(`localStorage.clear(); localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
  await nav(U(ns, q)); await settle(2200);
}
const steps = () => ev('__cmwP().steps');
const sel = () => ev('__cmwCards().sel');
const hideToasts = (on) => ev(`(() => { let s = document.getElementById('qaNoToast'); if (!s) { s = document.createElement('style'); s.id = 'qaNoToast'; document.head.append(s); } s.textContent = ${on} ? '#toastHost{visibility:hidden!important} .tip,[role=tooltip]{display:none!important}' : ''; return 1; })()`);
// the planes (below their heads, whose titles name the step count), as pixels
const planesRect = () => ev(`(() => { const out = []; for (const id of ['paneL', 'paneR']) { const p = document.getElementById(id); if (!p || !p.getClientRects().length) continue; const r = p.getBoundingClientRect(); if (r.width < 10) continue; const hd = p.querySelector('.pane-head'); const top = hd ? hd.getBoundingClientRect().bottom + 2 : r.top; const ft = p.querySelector('.pane-foot, .opts'); out.push({ x: Math.round(r.left) + 2, y: Math.round(top), width: Math.round(r.width) - 4, height: Math.round(r.bottom - top - 44) }); } return out; })()`);
async function planes() { await hideToasts(true); await settle(1800); const rs = await planesRect(); const out = []; for (const r of rs) out.push(await img(r)); await hideToasts(false); return out; }
function diff(a, b) {
  if (a.length !== b.length) return -1;
  let n = 0;
  for (let i = 0; i < a.length; i++) { const p = a[i], q = b[i]; if (p.w !== q.w || p.h !== q.h) return -1; for (let j = 0; j < p.data.length; j += p.ch) if (Math.abs(p.data[j] - q.data[j]) > 8 || Math.abs(p.data[j + 1] - q.data[j + 1]) > 8 || Math.abs(p.data[j + 2] - q.data[j + 2]) > 8) n++; }
  return n;
}
// the palette: type q, read the rows (group headers start with #)
async function pal(q, fnOnly) {
  await ev(`document.querySelector('.pop.palette') ? 1 : 0`) && await key('Escape');
  const r = await clickSel(fnOnly ? '#addStepBtn' : '#cmdBtn'); await settle(200);
  if (typeof r === 'string') return null;
  await ev(`(() => { const i = document.getElementById('palInput'); i.value = ${JSON.stringify(q)}; i.dispatchEvent(new Event('input')); return 1; })()`);
  await settle(150);
  return ev(`[...document.querySelectorAll('#palList .pal-group, #palList .pal-item')].slice(0, 8).map((e) => e.classList.contains('pal-group') ? '#' + e.textContent : e.querySelector('.pal-label').textContent)`);
}
const rowsOf = (list) => (list || []).filter((x) => x[0] !== '#');
const block = () => ev(`(() => { const b = document.querySelector('#propsPanel .split-offer'); if (!b) return null; const r = b.getBoundingClientRect(); const btn = b.querySelector('.so-btn'), sm = b.querySelector('summary'); const lh = (e) => { if (!e) return 0; const cs = getComputedStyle(e); const l = parseFloat(cs.lineHeight) || 16; return Math.round((e.getBoundingClientRect().height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)) / l); };
  return { hidden: b.hidden || !b.getClientRects().length, open: b.open, rows: b.querySelectorAll('.so-row').length, sum: sm ? sm.textContent : '', btn: btn ? btn.textContent : '', btnDisabled: btn ? btn.disabled : null, btnH: btn ? Math.round(btn.getBoundingClientRect().height) : 0, btnW: btn ? Math.round(btn.getBoundingClientRect().width) : 0, btnLines: lh(btn), sumLines: sm ? Math.round(sm.querySelector('span:not([hidden])') ? sm.getBoundingClientRect().height / 18 : 1) : 0, text: b.innerText, r: [r.left, r.top, r.width, r.height], overflow: (() => { const p = document.getElementById('propsPanel'); return p ? p.scrollWidth - p.clientWidth : 0; })() }; })()`);
const clearOfPlanes = () => ev(`(() => { const b = document.querySelector('#propsPanel .split-offer'); if (!b) return null; const r = b.getBoundingClientRect(); return [...document.querySelectorAll('#paneL canvas, #paneR canvas')].filter((c) => c.getClientRects().length).every((c) => { const q = c.getBoundingClientRect(); return r.right <= q.left || r.left >= q.right || r.bottom <= q.top || r.top >= q.bottom; }); })()`);
const latin = (s) => (String(s || '').replace(/\\[a-zA-Z]+/g, '').match(/\b[A-Za-z]{2,}\b/g) || []).filter((w) => !['sin', 'cos', 'tg', 'sh', 'ch', 'th', 'arctg', 'ln', 'log', 'exp', 'Re', 'Im', 'arg', 'Esc', 'Enter', 'Shift', 'Tab', 'mod', 'Ctrl'].includes(w));

await send('Emulation.setUserAgentOverride', { userAgent: DESKUA, acceptLanguage: 'en-US,en' });
await view(1440, 900, false, false);

// ---------------- 1. the search, English, 1440 × 900, light ----------------
await open('fsA', { steps: [] });
{
  const l = await pal('sin z');
  ok('search sin z: item 0 is Sine, item 1 the formula', rowsOf(l)[0] === 'Sine' && rowsOf(l)[1] === 'Formula' && rowsOf(l).filter((x) => x === 'Sine').length === 1, l);
  await shot('split-search-sinz');
  await key('Enter'); await settle(700);
  const s = await steps();
  ok('search sin z: Enter adds the Sine step, no formula step', s.length === 1 && s[0].type === 'sin', s);
}
for (const [q, type, want] of [['\\frac{2z+1}{z-1}', 'mobius', { a: '2', b: '1', c: '1', d: '-1' }], ['z^{i}', 'powa', { alpha: 'i' }], ['2z+1', 'affine', { a: '2', b: '1' }], ['tg z', 'tan', {}], ['e^z', 'exp', {}], ['\\sqrt[3]{z}', 'root', { n: 3 }], ['conj z', 'conj', {}]]) {
  await open('fsA', { steps: [] });
  const l = await pal(q);
  ok(`search ${q}: one step first`, rowsOf(l)[1] === 'Formula', l);
  await key('Enter'); await settle(600);
  const s = await steps();
  ok(`search ${q}: adds ${type} with ${JSON.stringify(want)}`, s.length === 1 && s[0].type === type && Object.entries(want).every(([k, v]) => String(s[0].params[k]) === String(v)), s);
}
for (const [q, n] of [['z+1/z', 2], ['\\sin(z^2+1)', 3]]) {
  await open('fsA', { steps: [] });
  const l = await pal(q);
  ok(`search ${q}: the formula first, Add as ${n} steps second`, rowsOf(l)[0] === 'Formula' && rowsOf(l)[1] === `Add as ${n} steps`, l);
  if (q === '\\sin(z^2+1)') { await key('ArrowDown'); await settle(300); info.capRows = await ev(`document.querySelector('.pal-cap').textContent`); await shot('split-search-asSteps'); }
  else await key('ArrowDown');
  await key('Enter'); await settle(700);
  const s = await steps();
  ok(`search ${q}: Add as ${n} steps inserts ${n} steps`, s.length === n && !s.some((x) => x.type === 'custom'), s.map((x) => x.type));
}
{
  await open('fsA', { steps: [] });
  const l = await pal('z^2+\\sin z');
  ok('search z^2+\\sin z: the formula only', rowsOf(l)[0] === 'Formula' && !rowsOf(l).some((x) => /^Add as/.test(x)), l);
  await key('Escape');
  const l2 = await pal('sin z', true);
  ok('add-step menu: sin z lists Sine first', rowsOf(l2)[0] === 'Sine' && rowsOf(l2)[1] === 'Formula', l2);
  await key('Escape');
  // the slowest palette input handler while typing a formula
  await clickSel('#cmdBtn'); await settle(200);
  info.palInputMs = await ev(`await (async () => { const i = document.getElementById('palInput'); let worst = 0; const q = '\\\\sin(z^2+1)+\\\\frac{2z+1}{z-1}'; for (let k = 1; k <= q.length; k++) { i.value = q.slice(0, k); const t0 = performance.now(); i.dispatchEvent(new Event('input')); worst = Math.max(worst, performance.now() - t0); await new Promise((r) => setTimeout(r, 30)); } return +worst.toFixed(2); })()`);
  ok(`typing into the palette: the slowest input handler ≤ 4 ms (+ the list rebuild)`, info.palInputMs <= 12, info.palInputMs);
  await key('Escape');
}
await grab();

// ---------------- 2–3. the offer and the split ----------------
await open('fsB', { steps: [F1('\\sin(z^2+1)')] });
await clickSel('#pipeline .card[data-k="1"]'); await settle(900);
{
  const b = await block();
  ok('offer: 4 rows and the button', b && !b.hidden && b.rows === 4 && b.btn === 'Split into 3 steps', b);
  ok('offer: clear of every plane', await clearOfPlanes() === true);
  ok('offer: the note drops "Same as"', !/Same as/.test(await ev(`__qa.txt('#propsPanel .insp-step .inote') || ''`)));
  await shot('split-offer-en-light', { x: 1140, y: 40, width: 300, height: 520 });
  await shot('split-offer-en-light-full');
  // typing key by key: hidden throughout, shown after Enter
  const fx = '#propsPanel .insp-step input[data-pkey="expr"]';
  await clickSel(fx); await ev(`(() => { const i = document.querySelector('${fx}'); i.select(); return 1; })()`);
  await key('Backspace'); await settle(100);
  const seenWhile = [];
  for (const ch of '\\sin(z^2+1)') { await type(ch); await settle(60); const bb = await block(); seenWhile.push(bb ? bb.hidden : true); }
  ok('offer: hidden while typing', seenWhile.every((x) => x === true), seenWhile);
  await key('Enter'); await settle(700);
  const b2 = await block();
  ok('offer: shown after Enter', b2 && !b2.hidden && b2.rows === 4, b2);
}
{
  const before = JSON.stringify(await steps());
  const views = {};
  for (const main of ['xy', 'phase', 'land']) {
    await ev(`__cmwSetMain('${main}'), 1`); await settle(1200);
    const p0 = await planes();
    await clickSel('#pipeline .card[data-k="1"]'); await settle(500);
    await clickSel('#propsPanel .split-offer .so-btn'); await settle(500);
    const s = await steps();
    if (main === 'xy') {
      ok('split: 3 steps with their texts', JSON.stringify(s.map((x) => [x.type, x.params])) === JSON.stringify([['pown', { n: 2 }], ['add', { c: '1' }], ['sin', {}]]), s);
      ok('split: the first new step is selected', await sel() === 1, await sel());
      const t = await ev('__qa.toasts()');
      ok('split: the toast', t.some((x) => /^Split f₁ into f₁–f₃: Integer power → Translation → Sine\./.test(x)), t);
      // Undo by the toast's button (at once: the toast does not wait for the planes to be read), then redo
      await clickSel('#toastHost .toast button'); await settle(600);
      ok('split: the toast\'s Undo gives the formula back', JSON.stringify(await steps()) === before, await steps());
      await key('z', 4 + 8); await settle(800);
      ok('split: redo splits again', (await steps()).length === 3, await steps());
      info.longTasks = await ev(`await (async () => { const out = []; try { const po = new PerformanceObserver((l) => { for (const e of l.getEntries()) out.push(Math.round(e.duration)); }); po.observe({ type: 'longtask', buffered: false }); await new Promise((r) => setTimeout(r, 2000)); po.disconnect(); } catch (e) {} return out; })()`);
      await shot('split-result-en-light');
    }
    const p1 = await planes();
    views[main] = diff(p0, p1);
    ok(`split: ${main} unchanged (px over 8/255)`, views[main] === 0, views[main]);
    // Undo by Ctrl+Z (phase) and ⌘Z (xy, land)
    await key('z', main === 'phase' ? 2 : 4);
    await settle(600);
    ok(`split: undo (${main}) gives the formula back`, JSON.stringify(await steps()) === before, await steps());
  }
  info.splitPx = views;
  await ev(`__cmwSetMain('xy'), 1`); await settle(600);
}
await grab();

// ---------------- 4–5. inside a chain; the deformation open ----------------
const CH3 = [{ type: 'exp', params: {}, on: true }, F1('\\sin(z^2+1)'), { type: 'mul', params: { c: '2' }, on: true }];
await open('fsC', { steps: CH3 });
{
  await clickSel('#pipeline .card[data-k="2"]'); await settle(700);
  const p0 = await planes();
  await clickSel('#propsPanel .split-offer .so-btn'); await settle(500);
  const s = await steps();
  ok('chain: [exp, pown, add, sin, mul]', s.map((x) => x.type).join() === 'exp,pown,add,sin,mul', s.map((x) => x.type));
  ok('chain: f₂ selected', await sel() === 2);
  const p1 = await planes();
  ok('chain: planes unchanged', diff(p0, p1) === 0, diff(p0, p1));
  await key('z', 4); await settle(600);
  // the deformation open at T = 1.5
  await ev('__cmwMorph({ open: true, playing: false })'); await settle(600);
  await ev('__cmwMorph({ T: 1.5 })'); await settle(1200);
  await clickSel('#pipeline .card[data-k="2"]'); await settle(500);
  const q0 = await planes();
  await clickSel('#propsPanel .split-offer .so-btn'); await settle(400);
  const T = (await ev('__cmwMorph({})')).T;
  ok('deformation: T 1.5 -> 2.5', Math.abs(T - 2.5) < 1e-12, T);
  const q1 = await planes();
  info.morphPx = diff(q0, q1);
  ok('deformation: the frame is unchanged', info.morphPx === 0, info.morphPx);
  await shot('split-morph');
  await ev('__cmwMorph({ open: false })'); await settle(300);
}
await grab();

// ---------------- 6. a shared number ----------------
await open('fsD', { steps: [F1('(z-a)^3')], params: [{ name: 'a', value: 0.7, min: -2, max: 2, step: 0.01 }] });
{
  await clickSel('#pipeline .card[data-k="1"]'); await settle(700);
  await clickSel('#propsPanel .split-offer .so-btn'); await settle(700);
  const s = await steps();
  ok('shared: c₁ reads -a', s[0].type === 'add' && s[0].params.c === '-a' && s[1].type === 'pown' && +s[1].params.n === 3, s);
  const keys = new Set(), vals = [];
  for (const a of [0.5, 0.6, 0.7, 0.8, 0.9]) {
    await ev(`Params.set('a', ${a}), 1`); await settle(250);
    const z = await ev(`(() => { const w = __cmwPlaneMenu().stage(2, 0.3, -0.4); return w; })()`);
    const want = (() => { const re = 0.3 - a, im = -0.4; const r2re = re * re - im * im, r2im = 2 * re * im; return [r2re * re - r2im * im, r2re * im + r2im * re]; })();
    vals.push([a, z, want]);
    keys.add(await ev('__cmwZp().glKey'));
  }
  ok('shared: the chain equals F over the sweep', vals.every(([a, z, w]) => Math.abs(z[0] - w[0]) < 1e-9 && Math.abs(z[1] - w[1]) < 1e-9), vals);
  ok('shared: one GPU program over the sweep', keys.size === 1, [...keys]);
  // frame times over a 3 s slider sweep (BUDGET60)
  info.sweepFrames = await ev(`await (async () => { let go = true; let k = 0; const tick = () => { if (!go) return; Params.set('a', 0.7 + 0.2 * Math.sin(k++ / 9)); requestAnimationFrame(tick); }; requestAnimationFrame(tick); const f = await __qa.frames(3000); go = false; return f; })()`);
  ok('shared: sweep frames p95 ≤ 20 ms', info.sweepFrames.p95 <= 20, info.sweepFrames);
}
await grab();

// ---------------- 7. a one-step formula step ----------------
await open('fsE', { steps: [F1('sin z')] });
{
  await clickSel('#pipeline .card[data-k="1"]'); await settle(700);
  const b = await block();
  ok('one: "This is the step “Sine”." with Replace', b && !b.hidden && /This is the step “Sine”\./.test(b.sum) && b.btn === 'Replace with “Sine”', b);
  await shot('split-one-en', { x: 1140, y: 40, width: 300, height: 360 });
  // the ⋯ menu holds the same item
  await clickSel('#propsPanel .insp-step .ihead .more'); await settle(300);
  const mi = await ev(`[...document.querySelectorAll('.pop.menu .mi')].map((b) => b.textContent.trim())`);
  ok('one: the ⋯ menu offers Replace with “Sine”', mi.some((x) => /Replace with “Sine”/.test(x)), mi);
  await key('Escape'); await settle(200);
  const before = JSON.stringify(await steps());
  await clickSel('#propsPanel .split-offer .so-btn'); await settle(600);
  const s = await steps();
  ok('one: replaced by the Sine step', s.length === 1 && s[0].type === 'sin', s);
  ok('one: the toast', (await ev('__qa.toasts()')).some((x) => /f₁ is now the step “Sine”\./.test(x)));
  await key('z', 4); await settle(500);
  ok('one: Undo', JSON.stringify(await steps()) === before);
  // a refusal: the ⋯ item is disabled with its reason
  await open('fsE2', { steps: [F1('z^2+\\sin z')] });
  await clickSel('#pipeline .card[data-k="1"]'); await settle(600);
  await clickSel('#propsPanel .insp-step .ihead .more'); await settle(300);
  const it = await ev(`(() => { const b = [...document.querySelectorAll('.pop.menu .mi')].find((x) => /Split into steps/.test(x.textContent)); return b ? { dis: b.disabled, tip: b.getAttribute('aria-description') } : null; })()`);
  ok('refusal: Split into steps disabled with its reason', it && it.dis && it.tip === 'Not a chain of catalog steps', it);
  { const bb = await block(); ok('refusal: no offer', !bb || bb.hidden === true, bb); }
  await key('Escape');
}
await grab();

// ---------------- 8. the alone walk ----------------
await open('fsF', { steps: [{ type: 'pown', params: { n: 2 }, on: true }, { type: 'add', params: { c: '1' }, on: true }, { type: 'sin', params: {}, on: true }] });
{
  await clickSel('#pipeline .card[data-k="1"]'); await settle(400);
  await key('l'); await settle(500);
  const st = async () => ev(`({ f: __cmwCards().focus, prev: document.querySelector('#aloneChip .ac-nav.prev').disabled, next: document.querySelector('#aloneChip .ac-nav.next').disabled })`);
  const seq = [await st()];
  for (let i = 0; i < 3; i++) { await clickSel('#aloneChip .ac-nav.next'); await settle(300); seq.push(await st()); }
  await clickSel('#aloneChip .ac-nav.prev'); await settle(300); seq.push(await st());
  ok('alone walk: 1 → 2 → 3 → 3 → 2, ends disabled', seq.map((x) => x.f).join() === '1,2,3,3,2' && seq[0].prev && !seq[0].next && seq[2].next && !seq[2].prev, seq);
  await shot('split-alone-chip', { x: 260, y: 40, width: 460, height: 60 });
}
await grab();

// ---------------- 9. Russian, 1440 ----------------
await open('fsR', { steps: [] }, '&lang=ru');
{
  const l = await pal('tg z');
  ok('ru: tg z lists Тангенс first', rowsOf(l)[0] === 'Тангенс' && rowsOf(l)[1] === 'Формула', l);
  await key('Escape');
  const l2 = await pal('\\sin(z^2+1)');
  ok('ru: Добавить как 3 шага', rowsOf(l2)[1] === 'Добавить как 3 шага', l2);
  ok('ru: palette rows without English', latin(l2.join(' ')).length === 0, latin(l2.join(' ')));
  await key('Escape');
}
await open('fsR', { steps: [F1('\\operatorname{tg}(z^2+1)')] }, '&lang=ru');
{
  await clickSel('#pipeline .card[data-k="1"]'); await settle(900);
  const b = await block();
  ok('ru: the offer', b && !b.hidden && b.rows === 4 && b.btn === 'Разложить на 3 шага' && /^Составлена из 3 шагов/.test(b.sum), b);
  ok('ru: no English in the offer', latin(b.text).length === 0, latin(b.text));
  ok('ru: the summary 1–2 lines, the button 1 line', b.btnLines === 1 && b.r[3] > 0, b);
  info.ruSummaryH = await ev(`Math.round(document.querySelector('#propsPanel .split-offer summary').getBoundingClientRect().height)`);
  ok('ru: the summary at most 2 lines', info.ruSummaryH <= 2 * 18 + 8, info.ruSummaryH);
  await shot('split-offer-ru-light', { x: 1140, y: 40, width: 300, height: 520 });
  await clickSel('#propsPanel .insp-step .ihead .more'); await settle(300);
  const mi = await ev(`[...document.querySelectorAll('.pop.menu .mi')].map((b) => b.textContent.trim()).join(' | ')`);
  ok('ru: the ⋯ item', /Разложить на шаги/.test(mi), mi);
  await key('Escape'); await settle(200);
  await clickSel('#propsPanel .split-offer .so-btn'); await settle(700);
  const t = (await ev('__qa.toasts()')).join(' ');
  ok('ru: the toast', /^Шаг f₁ разложен на шаги f₁–f₃: Целая степень → Сдвиг → Тангенс\./.test(t), t);
  ok('ru: no English in the toast', latin(t.replace(/f₁|f₃/g, '')).length === 0, latin(t));
  ok('ru: steps 1–3', (await steps()).map((x) => x.type).join() === 'pown,add,tan');
  await shot('split-result-ru-light');
}
await grab();

// ---------------- 10. dark ----------------
await view(1440, 900, true, false);
await open('fsB', { steps: [F1('\\sin(z^2+1)')] });
await clickSel('#pipeline .card[data-k="1"]'); await settle(900);
await shot('split-offer-en-dark', { x: 1140, y: 40, width: 300, height: 520 });
{ const bb = await block(); ok('dark: the offer', bb && !bb.hidden, bb); }

// ---------------- 11. tablet ----------------
for (const [w, h] of [[1024, 768], [768, 1024]]) {
  await view(w, h, false, false);
  await open('fsT', { steps: [F1('\\sin(z^2+1)')], hideRight: false });
  await clickSel('#pipeline .card[data-k="1"]'); await settle(900);
  const b = await block();
  ok(`tablet ${w}: the offer in the docked Inspector, no sideways overflow`, b && !b.hidden && b.rows === 4 && b.overflow <= 0 && b.r[0] + b.r[2] <= w, b);
  ok(`tablet ${w}: clear of the planes`, await clearOfPlanes() === true);
  await shot(`split-tablet-${w}`);
}

// ---------------- 12. phone ----------------
const touch = async (x, y, ms = 60) => { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }); await sleep(ms); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
const tap0 = async (sel_, wait = 450) => { const c = await ev(`(() => { const e = document.querySelector(${JSON.stringify(sel_)}); if (!e || !e.getClientRects().length) return null; e.scrollIntoView({ block: 'nearest', inline: 'nearest' }); const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`); if (!c) return false; await touch(c[0], c[1]); await settle(wait); return true; };
// (#246: on a phone the chain's cards and Add function are rows of the chain sheet; while it is closed, a tap on one is
// first the tap on "N steps ▾" that opens it, as a user's)
const tap = async (sel_, wait = 450) => { if (await tap0(sel_, wait)) return true; if (!/#pipeline|#addStepBtn/.test(sel_) || !(await tap0('.ph-csteps', 600))) return false; return tap0(sel_, wait); };
await send('Emulation.setUserAgentOverride', { userAgent: ANDROID, acceptLanguage: 'en-US,en' });
for (const [w, h, lang, dark] of [[390, 844, 'en', false], [360, 780, 'en', false], [390, 844, 'ru', false], [390, 844, 'en', true]]) {
  const tag = `${w}-${lang}${dark ? '-dark' : ''}`;
  await view(w, h, dark, true);
  await open('fsP', { steps: [{ type: 'exp', params: {}, on: true }, F1('\\sin(z^2+1)')] }, lang === 'ru' ? '&lang=ru' : '');
  await tap('#pipeline .card[data-k="2"]', 900);
  const b = await block();
  ok(`phone ${tag}: the offer in the Editor sheet`, b && !b.hidden && b.rows === 4, b);
  ok(`phone ${tag}: the button ≥ 44 px tall and full width`, b && b.btnH >= 44 && b.btnW >= w - 80, b && [b.btnH, b.btnW]);
  await ev(`(() => { const b = document.querySelector('#propsPanel .split-offer'); if (b) b.scrollIntoView({ block: 'center' }); return 1; })()`); await settle(300);
  await shot(`split-phone-${tag}`);
  if (lang === 'en' && !dark) {
    await tap('#propsPanel .split-offer .so-btn', 900);
    const s = await steps();
    ok(`phone ${tag}: split`, s.map((x) => x.type).join() === 'exp,pown,add,sin', s.map((x) => x.type));
    const vis = await ev(`(() => { const c = document.querySelector('#pipeline .card[data-k="2"]'), bar = document.querySelector('.pipe-wrap'); if (!c || !bar) return null; const r = c.getBoundingClientRect(), q = bar.getBoundingClientRect(); return r.left >= q.left - 1 && r.right <= q.right + 1; })()`);
    ok(`phone ${tag}: the chain bar shows card 2`, vis === true, vis);
    ok(`phone ${tag}: ‹ › omitted`, await ev(`(() => { const b = document.querySelector('#aloneChip .ac-nav.next'); return !b || !b.getClientRects().length; })()`));
    await shot(`split-phone-${tag}-after`);
  }
}
await send('Emulation.setUserAgentOverride', { userAgent: DESKUA, acceptLanguage: 'en-US,en' });
await view(1440, 900, false, false);
await grab();

// ---------------- 13. the tour ----------------
await open('fsTour', { steps: [] });
{
  await ev(`Tour.start({ chapter: 'edit' })`); await settle(2000);
  const seen = [];
  for (let i = 0; i < 6; i++) {
    // (v16.4: the step's title is in the docked strip, #tourTitle; the pop-up card and its h2 are gone)
    const cur = await ev(`(() => { const t = document.querySelector('.tour-strip #tourTitle'); return t ? t.textContent : null; })()`);
    const b = await block();
    seen.push([cur, b ? !b.hidden : false]);
    if (/A formula in steps/.test(cur || '')) {
      await shot('split-tour');
      await clickSel('#propsPanel .split-offer .so-btn'); await settle(900);
      const done = await ev(`(() => { const e = document.querySelector('[class*=tour] .done, [class*=tour] [data-done], .tour-try.done, .tc-try.done'); return !!e || /✓|Done/.test((document.querySelector('[class*=tour-card], .tour-card') || {}).textContent || ''); })()`);
      info.tourTry = done;
      ok('tour: the Try completes on the click', (await steps()).map((x) => x.type).join() === 'pown,add,sin', await steps());
      break;
    }
    await key('ArrowRight'); await settle(1500);
  }
  info.tourSeen = seen;
  ok('tour: the offer shows only at its stop', seen.some(([t]) => /A formula in steps/.test(t || '')) && seen.every(([t, v]) => (/A formula in steps/.test(t || '') ? v : !v)), seen);
  await key('Escape'); await settle(800);
}
await grab();

// ---------------- 14. frame times: 12 nested sines, the deformation open ----------------
{
  let e = 'z'; for (let i = 0; i < 12; i++) e = `\\sin(${e})`;
  await open('fsS', { steps: [F1(e)] });
  await clickSel('#pipeline .card[data-k="1"]'); await settle(700);
  await clickSel('#propsPanel .split-offer .so-btn'); await settle(1500);
  ok('12 sines: 12 steps', (await steps()).length === 12);
  await ev('__cmwMorph({ open: true, playing: true })'); await settle(1500);
  info.sines12 = await ev('await __qa.frames(3000)');
  await ev('__cmwMorph({ open: false })');
  ok('12 sines, the deformation playing: p95 ≤ 20 ms', info.sines12.p95 <= 20, info.sines12);
}

// ---------------- 15. export ----------------
for (const lang of ['en', 'ru']) {
  await open('fsX', { steps: [F1('\\sin(z^2+1)')] }, lang === 'ru' ? '&lang=ru' : '');
  await clickSel('#pipeline .card[data-k="1"]'); await settle(600);
  await clickSel('#propsPanel .split-offer .so-btn'); await settle(1200);
  const r = await ev(`await (async () => { try { const f = await __cmwFig.build({ for: 'article', cols: 1 }); return f ? { cap: f.captionTex, n: f.captionTex.length } : null; } catch (e) { return { err: String(e).slice(0, 300) }; } })()`, 180000);
  ok(`export ${lang}: a figure with a caption ≤ 700 characters`, r && !r.err && r.cap && r.n <= 700 && !/undefined|NaN|null/.test(r.cap), r);
  info['cap_' + lang] = r && r.cap;
}
await grab();
ok('no errors in the console', errs.length === 0, errs.slice(0, 5));
return { pass, fails, info };
