// v15.2 review fixes (notes/workflows/ledger-v152.json): the formula-in-steps findings of review-v152-steps.json and
// regress-2, in the built page (dist/test.html), English and Russian, desktop 1440 and phone 390 (Android Chrome):
//  steps-1  the palette flow (the formula shown alone) and Add as n steps keep the planes: F, not the first sub-step;
//           with other steps the toast says which step is shown;
//  steps-2  the search caption's derivation is never cut (fits, or wraps after a ↦);
//  steps-3  12 nested sines: the rows switch to one step a row (u₁ = …), no row overflows, ↦ never alone on a line;
//  steps-4  a chain kept as one step says why in its note;  steps-5  a fraction shows its simple moves;
//  steps-6  Sin z (a capitalized first letter) and the inputs' autocapitalize;  steps-14  z² in the search;
//  steps-8  no "=" for a mere reordering;  steps-9  rows in the step's own variable;  steps-11  focus after Split;
//  steps-12 phone: the Add as n steps row shows the derivation; the offer's summary is in view when the sheet opens;
//  regress-2 the fold key is namespaced.
// A command file for the CDP daemon (test/cdp_kit README): python3 build.py && test/<you>_cdp/q.sh test/fix152_cmd.js
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
  await send('Page.navigate', { url: `http://localhost:${PORT}/blank-${ns}.html` }); await sleep(400);
  const o = Object.assign({ v3: true, v4: true, shapes: SHAPES, steps: [], nextId: 50, focus: 0, rightMode: 'image' }, st || {});
  await ev(`localStorage.clear(); localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
  await nav(U(ns, q)); await settle(2200);
}
const steps = () => ev('__cmwP().steps');
const focus = () => ev('__cmwCards().focus');
const hideToasts = (on) => ev(`(() => { let s = document.getElementById('qaNoToast'); if (!s) { s = document.createElement('style'); s.id = 'qaNoToast'; document.head.append(s); } s.textContent = ${on} ? '#toastHost{visibility:hidden!important} .tip,[role=tooltip]{display:none!important}' : ''; return 1; })()`);
const planesRect = () => ev(`(() => { const out = []; for (const id of ['paneL', 'paneR']) { const p = document.getElementById(id); if (!p || !p.getClientRects().length) continue; const r = p.getBoundingClientRect(); if (r.width < 10) continue; const hd = p.querySelector('.pane-head'); const top = hd ? hd.getBoundingClientRect().bottom + 2 : r.top; out.push({ x: Math.round(r.left) + 2, y: Math.round(top), width: Math.round(r.width) - 4, height: Math.round(r.bottom - top - 44) }); } return out; })()`);
async function planes() { await hideToasts(true); await settle(1800); const rs = await planesRect(); const out = []; for (const r of rs) out.push(await img(r)); await hideToasts(false); return out; }
function diff(a, b) {
  if (a.length !== b.length) return -1;
  let n = 0;
  for (let i = 0; i < a.length; i++) { const p = a[i], q = b[i]; if (p.w !== q.w || p.h !== q.h) return -1; for (let j = 0; j < p.data.length; j += p.ch) if (Math.abs(p.data[j] - q.data[j]) > 8 || Math.abs(p.data[j + 1] - q.data[j + 1]) > 8 || Math.abs(p.data[j + 2] - q.data[j + 2]) > 8) n++; }
  return n;
}
async function pal(q) {
  await ev(`document.querySelector('.pop.palette') ? 1 : 0`) && await key('Escape');
  await clickSel('#cmdBtn'); await settle(200);
  await ev(`(() => { const i = document.getElementById('palInput'); i.value = ${JSON.stringify(q)}; i.dispatchEvent(new Event('input')); return 1; })()`);
  await settle(250);
  return ev(`[...document.querySelectorAll('#palList .pal-item')].slice(0, 6).map((e) => e.querySelector('.pal-label').textContent)`);
}
// choose the palette row whose label is lab (Enter runs it)
async function palPick(q, lab) {
  const rows = await pal(q);
  const i = rows.indexOf(lab);
  if (i < 0) return rows;
  for (let k = 0; k < i; k++) { await key('ArrowDown'); await settle(60); }
  await settle(300);
  return i;
}
const offer = () => ev(`(() => { const b = document.querySelector('#propsPanel .split-offer'); if (!b) return null; const ol = b.querySelector('.so-rows'); return { hidden: b.hidden || !b.getClientRects().length, sum: (b.querySelector('summary') || {}).textContent || '', subst: !!(ol && ol.classList.contains('subst')), moves: b.querySelectorAll('.so-rows.moves .so-row').length, rows: [...b.querySelectorAll('.so-row')].map((li) => { const t = li.querySelector('.so-tex'), m = li.querySelector('.so-map'); const tr = t.getBoundingClientRect(), mr = m.getBoundingClientRect(); return { tex: t.dataset.tex, over: t.scrollWidth - t.clientWidth, fs: t.style.fontSize, mapTop: Math.round(mr.top), texTop: Math.round(tr.top), texH: Math.round(tr.height), map: m.textContent }; }) }; })()`);

await send('Emulation.setUserAgentOverride', { userAgent: DESKUA, acceptLanguage: 'en-US,en' });
await view(1440, 900, false, false);

// ---- steps-1: the palette flow ----
await open('fxA', { steps: [] });
{
  // the formula added as one step from the search (it is then shown alone), then split: the planes stay those of F
  const r = await palPick('\\sin(z^2+1)', 'Formula');
  await key('Enter'); await settle(1200);
  info.afterAdd = { focus: await focus(), steps: (await steps()).length };
  const p0 = await planes();
  await clickSel('#pipeline .card[data-k="1"]'); await settle(700);
  await clickSel('#propsPanel .split-offer .so-btn'); await settle(600);
  info.afterSplit = { focus: await focus(), steps: (await steps()).map((s) => s.type), active: await ev('document.activeElement && (document.activeElement.closest(".card") ? "card" : document.activeElement.tagName)') };
  const p1 = await planes();
  const d = diff(p0, p1);
  // (v16.5 UX01: an added step is selected, and the planes keep showing F: the focus stays 0)
  ok('steps-1: palette add (focus stays F) then Split: focus 0, the planes unchanged (0 px over 8/255)', info.afterAdd.focus === 0 && info.afterSplit.focus === 0 && info.afterSplit.steps.join() === 'pown,add,sin' && d === 0, { ...info, d });
  ok('steps-11: after Split the keyboard focus is on a card, not the page', info.afterSplit.active === 'card', info.afterSplit.active);
  await shot('fix-steps1-after-split');
}
await open('fxB', { steps: [] });
{
  // Add as 3 steps into an empty chain: F is the typed formula, shown whole (planes = the formula as one step)
  await palPick('\\sin(z^2+1)', 'Add as 3 steps');
  info.capRows = await ev(`(() => { const l = document.querySelector('.pal-cap .pal-rows'); if (!l) return null; const box = l.parentNode.getBoundingClientRect(); const ts = [...l.querySelectorAll('.drv-tex')].map((t) => t.getBoundingClientRect()); return { n: ts.length, inside: ts.every((r) => r.left >= box.left - 0.5 && r.right <= box.right + 0.5), lines: new Set(ts.map((r) => Math.round(r.top))).size, fs: l.style.fontSize, over: l.scrollWidth - l.clientWidth }; })()`);
  ok('steps-2: the caption shows all 4 rows of the derivation inside its box (fitted or wrapped, never cut)', info.capRows && info.capRows.n === 4 && info.capRows.inside && info.capRows.over <= 1, info.capRows);
  await shot('fix-steps2-caption', { x: 300, y: 60, width: 840, height: 640 });
  await key('Enter'); await settle(1200);
  const pA = await planes();
  info.addAs = { focus: await focus(), steps: (await steps()).map((s) => s.type) };
  await open('fxB2', { steps: [F1('\\sin(z^2+1)')] });
  const pB = await planes();
  const d = diff(pA, pB);
  ok('steps-1: Add as 3 steps into an empty chain shows F (focus 0): the planes equal the formula\'s', info.addAs.focus === 0 && info.addAs.steps.join() === 'pown,add,sin' && d === 0, { addAs: info.addAs, d });
}
await open('fxC', { steps: [{ type: 'exp', params: {}, on: true }, F1('\\sin(z^2+1)')], focus: 2 });
{
  await clickSel('#pipeline .card[data-k="2"]'); await settle(700);
  await clickSel('#propsPanel .split-offer .so-btn'); await settle(500);
  const t = await ev('__qa.toasts()');
  info.chainSplit = { focus: await focus(), toast: t };
  ok('steps-1: with other steps, f₂ shown alone stays f₂ and the toast says so', info.chainSplit.focus === 2 && t.some((x) => /Showing f₂ alone; › shows the next step\./.test(x)), info.chainSplit);
}
await grab();

// ---- steps-3, steps-9: 12 nested sines at f₂ ----
{
  let t = 'z^2+1'; for (let i = 0; i < 12; i++) t = `\\sin(${t})`;
  await open('fxD', { steps: [{ type: 'exp', params: {}, on: true }, F1(t)] });
  await clickSel('#pipeline .card[data-k="2"]'); await settle(2500);
  const o = await offer();
  info.long = o && { subst: o.subst, n: o.rows.length, over: Math.max(...o.rows.map((r) => r.over)), first: o.rows[0] && o.rows[0].tex, last: o.rows[o.rows.length - 1].tex };
  ok('steps-3: 12 nested sines: one step a row (u₁ = …), 14 rows, none overflows', o && o.subst && o.rows.length === 14 && o.rows.every((r) => r.over <= 1), info.long);
  ok('steps-9: the rows use the step\'s input variable w₁', o && /w_\{1\}/.test(o.rows[0].tex) && !/(^|[^a-z_])z([^a-z]|$)/.test(o.rows.map((r) => r.tex).join(' ')), o && o.rows.slice(0, 2));
  await shot('fix-steps3-long', { x: 1100, y: 40, width: 340, height: 860 });
  // a short chain keeps the cumulative rows, and the ↦ sits on the formula's line
  await open('fxE', { steps: [{ type: 'exp', params: {}, on: true }, F1('\\frac{1}{1+e^{-z}}')] });
  await clickSel('#pipeline .card[data-k="2"]'); await settle(1500);
  const o2 = await offer();
  info.short = o2;
  ok('steps-3: a short chain: cumulative rows, each ↦ on its formula\'s line', o2 && !o2.subst && o2.rows.slice(1).every((r) => r.map === '↦' && r.mapTop >= r.texTop - 2 && r.mapTop <= r.texTop + r.texH), o2 && o2.rows);
  ok('steps-8: 1/(1+e^{−z}): the last row is the typed spelling, no "="', o2 && !/=/.test(o2.rows[o2.rows.length - 1].tex) && /1\+e\^\{-w_\{1\}\}/.test(o2.rows[o2.rows.length - 1].tex), o2 && o2.rows[o2.rows.length - 1]);
  ok('steps-7: −z is named Rotation', o2 && /Rotation/.test(await ev(`__qa.txt('#propsPanel .split-offer') || ''`)), await ev(`__qa.txt('#propsPanel .split-offer')`));
}
// ---- steps-4: a recognized chain kept as one step says why; steps-5: a fraction's moves ----
{
  await open('fxF', { steps: [F1('\\frac{(z-1)(z+2)}{z-3}')] });
  await clickSel('#pipeline .card[data-k="1"]'); await settle(1200);
  info.note4 = await ev(`__qa.txt('#propsPanel .insp-step .inote')`);
  ok('steps-4: the note says why it stays one step', /Same as .* → .*; it stays one step: its numbers have no short exact form\./.test(info.note4 || ''), info.note4);
  await open('fxG', { steps: [F1('\\frac{2z+1}{z-1}')] });
  await clickSel('#pipeline .card[data-k="1"]'); await settle(1500);
  const o = await offer();
  info.moves = o;
  ok('steps-5: (2z+1)/(z−1) shows its moves: z ↦ z−1 ↦ 1/(z−1) ↦ 3/(z−1) ↦ 3/(z−1)+2', o && o.moves === 5 && /This is the step “Möbius”\./.test(o.sum) && o.rows.map((r) => r.tex).join(' | ') === 'z | z-1 | \\frac{1}{z-1} | \\frac{3}{z-1} | \\frac{3}{z-1}+2', o);
  await shot('fix-steps5-moves', { x: 1100, y: 40, width: 340, height: 500 });
}
// ---- steps-6, steps-14: the search reads Sin z and z²; inputs do not autocapitalize ----
{
  const l1 = await pal('Sin z'), l2 = await pal('z²'), l3 = await pal('Exp(z)');
  info.search = { l1, l2, l3 };
  ok('steps-6: "Sin z" lists Sine first', l1[0] === 'Sine', l1);
  ok('steps-6: "Exp(z)" lists Exponential first', /Exponential/.test(l3[0] || ''), l3);
  ok('steps-14: "z²" lists Integer power first', l2[0] === 'Integer power', l2);
  info.attrs = await ev(`(() => { const i = document.getElementById('palInput'); return { cap: i.getAttribute('autocapitalize'), cor: i.getAttribute('autocorrect'), region: document.getElementById('formulaInput').getAttribute('autocapitalize') }; })()`);
  ok('steps-6: the search and the region formula do not autocapitalize', info.attrs.cap === 'off' && info.attrs.cor === 'off' && info.attrs.region === 'off', info.attrs);
  await key('Escape');
  await open('fxH', { steps: [F1('z^2')] });
  await clickSel('#pipeline .card[data-k="1"]'); await settle(700);
  info.fieldCap = await ev(`(() => { const i = document.querySelector('#propsPanel .insp-step input[data-pkey="expr"]'); return i && i.getAttribute('autocapitalize'); })()`);
  ok('steps-6: the step\'s formula field does not autocapitalize', info.fieldCap === 'off', info.fieldCap);
}
// ---- regress-2: the fold key is namespaced ----
{
  await open('fxI', { steps: [F1('\\sin(z^2+1)')] });
  await clickSel('#pipeline .card[data-k="1"]'); await settle(700);
  await clickSel('#propsPanel .split-offer > summary'); await settle(300);
  info.fold = await ev(`({ ns: localStorage.getItem('cmw-split-fold:fxI'), raw: localStorage.getItem('cmw-split-fold') })`);
  ok('regress-2: folding writes cmw-split-fold:<ns>, not the raw key', info.fold.ns === '0' && info.fold.raw === null, info.fold);
  await clickSel('#propsPanel .split-offer > summary'); await settle(200);
}
// ---- Russian: the new strings ----
{
  await open('fxR', { steps: [{ type: 'exp', params: {}, on: true }, F1('\\sin(z^2+1)')], focus: 2 }, '&lang=ru');
  await clickSel('#pipeline .card[data-k="2"]'); await settle(900);
  await clickSel('#propsPanel .split-offer .so-btn'); await settle(500);
  const t = await ev('__qa.toasts()');
  ok('ru: the toast says which step is shown', t.some((x) => /Показан только шаг f₂; › показывает следующий шаг\./.test(x)), t);
  await open('fxR2', { steps: [F1('\\frac{(z-1)(z+2)}{z-3}')] }, '&lang=ru');
  await clickSel('#pipeline .card[data-k="1"]'); await settle(1200);
  info.noteRu = await ev(`__qa.txt('#propsPanel .insp-step .inote')`);
  ok('ru: the note says why it stays one step', /она остаётся одним шагом: у её чисел нет короткой точной записи\./.test(info.noteRu || ''), info.noteRu);
  await open('fxR3', { steps: [F1('\\frac{1}{1+e^{-z}}')] }, '&lang=ru');
  await clickSel('#pipeline .card[data-k="1"]'); await settle(1200);
  info.rowsRu = await ev(`__qa.txt('#propsPanel .split-offer')`);
  ok('ru: −z is «Поворот»', /Поворот/.test(info.rowsRu || ''), info.rowsRu);
  await shot('fix-ru-offer', { x: 1100, y: 40, width: 340, height: 500 });
}
await grab();

// ---- steps-12: phone 390 ----
await send('Emulation.setUserAgentOverride', { userAgent: ANDROID, acceptLanguage: 'en-US,en' });
await view(390, 844, false, true);
const touch = async (x, y, ms = 60) => { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }); await sleep(ms); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
const tap0 = async (s, wait = 450) => { const c = await ev(`(() => { const e = document.querySelector(${JSON.stringify(s)}); if (!e || !e.getClientRects().length) return null; e.scrollIntoView({ block: 'nearest', inline: 'nearest' }); const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`); if (!c) return false; await touch(c[0], c[1]); await settle(wait); return true; };
// (#246: on a phone the chain's cards and Add function are rows of the chain sheet; while it is closed, a tap on one is
// first the tap on "N steps ▾" that opens it, as a user's)
const tap = async (s, wait = 450) => { if (await tap0(s, wait)) return true; if (!/#pipeline|#addStepBtn/.test(s) || !(await tap0('.ph-csteps', 600))) return false; return tap0(s, wait); };
{
  await open('fxP', { steps: [{ type: 'exp', params: {}, on: true }, F1('\\sin(z^2+1)')] });
  await tap('#pipeline .card[data-k="2"]', 1200);
  info.phoneOffer = await ev(`(() => { const sm = document.querySelector('.split-offer:not([hidden]) > summary'); if (!sm) return null; const r = sm.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight }; })()`);
  ok('steps-12: phone: the offer\'s summary is in view when the Editor opens', info.phoneOffer && info.phoneOffer.top >= 0 && info.phoneOffer.bottom <= info.phoneOffer.vh, info.phoneOffer);
  await shot('fix-steps12-phone-sheet');
  await open('fxP2', { steps: [] });
  // (on the phone the search opens from the add card)
  await tap('#addStepBtn', 400);
  await ev(`(() => { const i = document.getElementById('palInput'); i.value = '\\\\sin(z^2+1)'; i.dispatchEvent(new Event('input')); return 1; })()`);
  await settle(900);
  const l = await ev(`[...document.querySelectorAll('#palList .pal-item')].slice(0, 4).map((e) => e.querySelector('.pal-label').textContent)`);
  info.phoneRow = await ev(`(() => { const r = [...document.querySelectorAll('#palList .pal-item')].find((e) => /Add as 3 steps/.test(e.textContent)); if (!r) return null; const d = r.querySelector('.pal-drv'); const b = r.getBoundingClientRect(); const ts = d ? [...d.querySelectorAll('.drv-tex')].map((t) => t.getBoundingClientRect()) : []; return { drv: !!d, n: ts.length, inside: ts.every((q) => q.right <= b.right + 0.5 && q.left >= b.left - 0.5 && q.bottom <= b.bottom + 0.5) }; })()`);
  ok('steps-12: phone: Add as 3 steps shows its derivation (4 formulas) inside the row', info.phoneRow && info.phoneRow.drv && info.phoneRow.n === 4 && info.phoneRow.inside, { l, row: info.phoneRow });
  await shot('fix-steps12-phone-search');
  await key('Escape');
}
await grab();
await send('Emulation.setUserAgentOverride', { userAgent: DESKUA, acceptLanguage: 'en-US,en' });
await view(1440, 900, false, false);
ok('no console errors or exceptions', errs.length === 0, errs.slice(0, 5));
return { pass, nfail: fails.length, fails, info };
