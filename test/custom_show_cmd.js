// A long formula step in the Inspector, without and with a display form (Funcs.build: params.show, params.showOf), in
// the built page (dist/test.html), desktop 1440 × 900:
//  1. no display form: the step's well says the formula is long and typesets nothing; the offer's rows show each step
//     once, the long row as u₁ = ⋯, none typeset at LONG characters or more, none wider than its row; F's well says the
//     expanded formula is long and its line for the step reads w₁ = f₁(z);
//  2. a display form: the well shows it (in w for a second step), whole, at 70 % or more; the note says so; the f(z) field
//     holds the formula unchanged; F's line and the offer's last row use it;
//  3. the formula edited (one character): the display form is gone (stale key), the long note is back; Undo returns it.
// A command file for the CDP daemon (test/cdp_kit README): python3 build.py && test/<you>_cdp/q.sh test/custom_show_cmd.js
// Prints {pass, fails, info}.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
let pass = 0;
const ok = (name, cond, got) => { if (cond) pass++; else fails.push({ name, got }); };
const settle = async (ms = 350) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const LONGF = 'exp(' + Array.from({ length: 30 }, (_, j) => `0.1*log(z-(0.5+0.${String(j).padStart(2, '0')}i))`).join('+') + ')';
const SHOW = 'c\\,z^{s}\\prod_{j=1}^{30}\\left(\\frac{z-p_j}{z}\\right)^{1/10}';
// the key, as Funcs.showKey writes it (FNV-1a, 32 bits)
const fnv = (s) => { s = String(s).trim(); let x = 0x811c9dc5; for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 0x01000193) >>> 0; return x.toString(16).padStart(8, '0'); };
const MOB = { type: 'custom', params: { expr: '((z-0.1)/(1-0.1*z))^2', cut: 180 }, on: true };
async function open(ns, steps) {
  // (the page of another namespace first: the app saves its state when it unloads, which would overwrite this one)
  await nav(`http://localhost:${PORT}/test.html?ns=${ns}-pre`);
  const o = { v3: true, v4: true, shapes: [{ id: 's1', kind: 'circle', c: [0, 0], r: 1 }], steps, nextId: 50, focus: 0, rightMode: 'image' };
  await ev(`localStorage.clear(); localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
  await nav(`http://localhost:${PORT}/test.html?ns=${ns}`); await settle(2200);
}
async function select(k) {
  await ev(`(() => { const c = ${k === 'F' ? `document.querySelector('#pipeline .ftile')` : `document.querySelector('#pipeline .card[data-k="${k}"]')`}; if (c) c.click(); return !!c; })()`);
  await settle(1200);
}
// the "in short" marks: on F's line (.iform > .shortmark) and on the split offer's rows (.so-row .shortmark)
const marks = () => ev(`(() => { const p = document.getElementById('propsPanel'); const vis = (e) => !!e && !e.hidden && e.getClientRects().length > 0;
  const f = p.querySelector('.iform > .shortmark'), r = [...p.querySelectorAll('.split-offer .so-row .shortmark')];
  const o = (e) => e && { role: e.getAttribute('role'), text: e.textContent, tip: e.getAttribute('data-tip'), desc: e.getAttribute('aria-description') };
  const bx = p.querySelector('.split-offer'); return { box: bx ? { hidden: bx.hidden, rows: bx.querySelectorAll('.so-row').length, html: bx.innerHTML.slice(0, 200) } : null, ready: typeof TeX !== 'undefined' && !!TeX.ready, f: vis(f) ? o(f) : null, rows: r.map(o), lastRow: r.length ? r[0].closest('.so-row') === [...p.querySelectorAll('.split-offer .so-row')].pop() : null }; })()`);
const look = () => ev(`(() => { const p = document.getElementById('propsPanel'); if (!p) return null; const vis = (e) => !!e && !e.hidden && e.getClientRects().length > 0;
  const well = p.querySelector('.iform .ftex:not(.long)'), lg = p.querySelector('.iform .ftex.long'), fx = p.querySelector('input[data-pkey="expr"]'), note = p.querySelector('.inote');
  const rows = [...p.querySelectorAll('.split-offer .so-tex')].map((t) => ({ n: (t.dataset.tex || '').length, tex: (t.dataset.tex || '').slice(0, 40), over: t.scrollWidth > t.clientWidth + 1, fs: t.style.fontSize }));
  const lines = [...p.querySelectorAll('.iform .wl > div > span')].map((t) => t.dataset.tex || '');
  return { well: vis(well) ? (well.dataset.tex || '') : null, wellOver: vis(well) ? well.scrollWidth > well.clientWidth + 1 : null, wellFs: well ? well.style.fontSize : '', wellSvg: well ? well.querySelectorAll('svg').length : 0, long: vis(lg) ? lg.textContent : null,
    field: fx ? fx.value : null, note: note ? note.textContent : '', rows, lines, offer: !!p.querySelector('.split-offer:not([hidden])') }; })()`);

await view(1440, 900, false);
// 1. no display form
await open('cshow1', [MOB, { type: 'custom', params: { expr: LONGF, cut: 180 }, on: true }]);
await settle(800);
ok('the key matches the app\'s',(await ev(`Funcs.showKey(${JSON.stringify(LONGF)})`)) === fnv(LONGF));
await select(2);
let L = await look();
ok('none: the well says the formula is long', L && L.long && /long/.test(L.long) && L.well === null, L);
ok('none: the well typesets nothing', L && L.wellSvg === 0, L && L.wellSvg);
ok('none: the field holds the formula', L && L.field === LONGF, L && L.field && L.field.length);
ok('none: the offer shows', L && L.offer, L);
ok('none: no row typeset at 700 characters or more', L && L.rows.length > 0 && L.rows.every((r) => r.n < 700), L && L.rows);
ok('none: the long row reads u₁ = ⋯', L && L.rows.some((r) => r.tex === 'u_{1}=\\cdots'), L && L.rows);
ok('none: no row wider than its place', L && L.rows.every((r) => !r.over), L && L.rows);
await select('F');
L = await look();
ok('none: F says the expanded formula is long', L && L.long && /expanded/.test(L.long), L);
ok('none: F\'s line for the step reads w₂ = f₂(w₁)', L && L.lines.some((t) => /w_\{2\}=f_\{2\}\(w_\{1\}\)/.test(t)), L && L.lines);
ok('none: no mark on F\'s line', (await marks()).f === null);
await select(2);
ok('none: no mark on the offer\'s rows', (await marks()).rows.length === 0);

// 2. a display form
await open('cshow2', [MOB, { type: 'custom', params: { expr: LONGF, cut: 180, show: SHOW, showOf: fnv(LONGF) }, on: true }]);
await select(2);
L = await look();
ok('show: the well shows the display form in w₁', L && L.well && L.well.includes('\\prod_{j=1}^{30}') && L.well.includes('{w_{1}}') && L.long === null, L);
ok('show: typeset', L && L.wellSvg > 0, L && L.wellSvg);
ok('show: whole, at 70 % or more', L && !L.wellOver && (!L.wellFs || parseFloat(L.wellFs) >= 70), L);
ok('show: the note says it is written in short', L && /Written in short/.test(L.note), L && L.note);
ok('show: the field holds the formula unchanged', L && L.field === LONGF, L && L.field && L.field.length);
ok('show: no row typeset at 700 characters or more', L && L.rows.every((r) => r.n < 700), L && L.rows);
ok('show: no row wider than its place', L && L.rows.every((r) => !r.over), L && L.rows);
info.showRows = L && L.rows; info.showOffer = L && L.offer;
await select('F');
L = await look();
const fw = await ev(`(() => { const e = document.querySelector('#propsPanel .iform .ftex:not(.long)'); return e && !e.hidden ? e.dataset.tex : null; })()`);
ok('show: F is written with the display form', fw && fw.includes('\\prod_{j=1}^{30}'), fw);
let M = await marks();
ok('show: F\'s line carries the mark, with the full-formula explanation', M.f && M.f.text === 'in short' && /each step/.test(M.f.tip) && M.f.desc === M.f.tip, M);
for (const [lang, word] of [['ru', 'кратко'], ['it', 'in breve']]) {
  await ev(`I18N.setPref('${lang}'), 1`); await settle(1200);
  const mf = await marks();
  ok(`show: F's mark reads in ${lang}`, mf.f && mf.f.text === word && mf.f.tip === mf.f.desc && !/^Written/.test(mf.f.tip), mf);
}
await ev(`I18N.setPref('en'), 1`); await settle(1200);

// 3. the formula edited: the key is stale
await select(2);
await ev(`(() => { const f = document.querySelector('#propsPanel input[data-pkey="expr"]'); f.focus(); f.value = f.value.replace(/\\)$/, '+0)'); f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true })); f.blur(); return 1; })()`);
await settle(1200);
L = await look();
ok('edited: the display form is gone', L && L.long && L.well === null && !/Written in short/.test(L.note), L);
await select('F');
ok('edited: no mark on F\'s line', (await marks()).f === null);
await select(2);
ok('edited: the step keeps its display text (Undo can use it)', (await ev(`__cmwP().steps[1].params.show`)) === SHOW);
await key('z', 2); await settle(1200);
L = await look();
ok('undo: the display form is back', L && L.well && L.well.includes('\\prod_{j=1}^{30}'), L);

// 2b. a shorter formula with a display form: the offer's rows are the chain, its last row ends with the display form
// (a formula too long for its rows shows each step once instead, with no display form to mark)
const SHEXPR = 'sin(z^2+1)', SHTEX = '\\mathrm{S}_{\\!\\sharp}';
const stepsB = (show) => [MOB, { type: 'custom', params: Object.assign({ expr: SHEXPR, cut: 180 }, show ? { show: SHTEX, showOf: fnv(SHEXPR) } : {}), on: true }];
await open('cshow3', stepsB(false));
await select(2);
M = await marks();
ok('plain: the offer shows rows, none marked', M.box && !M.box.hidden && M.box.rows > 1 && M.rows.length === 0, M);
await open('cshow4', stepsB(true));
await select(2);
M = await marks();
ok('offer: the last row carries the mark, once, with the explanation', M.rows.length === 1 && M.lastRow === true && M.rows[0].text === 'in short' && /each step's own field/.test(M.rows[0].tip) && M.rows[0].desc === M.rows[0].tip, M);
ok('offer: the last row ends with the display form', (await ev(`[...document.querySelectorAll('#propsPanel .split-offer .so-tex')].pop().dataset.tex`)).includes(SHTEX), M);
for (const [lang, word] of [['ru', 'кратко'], ['it', 'in breve']]) {
  await ev(`I18N.setPref('${lang}'), 1`); await settle(1200);
  const m = await marks();
  ok(`offer: the mark reads in ${lang}`, m.rows.length === 1 && m.rows[0].text === word && m.rows[0].tip === m.rows[0].desc && !/^Written/.test(m.rows[0].tip), m);
}
await ev(`I18N.setPref('en'), 1`); await settle(1200);
await ev(`(() => { const f = document.querySelector('#propsPanel input[data-pkey="expr"]'); f.focus(); f.value = f.value.replace(/\\)$/, '+0)'); f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true })); f.blur(); return 1; })()`);
await settle(1200);
M = await marks();
ok('offer edited: the offer still shows its rows, the mark is gone with the display form', M.box && !M.box.hidden && M.box.rows > 1 && M.rows.length === 0, M);

// 2c. two display-form steps, one bypassed: one mark on F's line (a bypassed step is not in F)
await open('cshow5', [MOB, { type: 'custom', params: { expr: SHEXPR, cut: 180, show: SHTEX, showOf: fnv(SHEXPR) }, on: false }, { type: 'custom', params: { expr: 'cos(z^2+1)', cut: 180, show: SHTEX, showOf: fnv('cos(z^2+1)') }, on: true }]);
await select('F'); await settle(800);
M = await marks();
ok('two steps, one bypassed: the mark on F\'s line, its role is note', M.f && M.f.text === 'in short' && M.f.role === 'note', Object.assign({ panel: await ev(`(document.querySelector('#propsPanel .ihead .ttl')||{}).textContent`) }, M));
await open('cshow6', [MOB, { type: 'custom', params: { expr: SHEXPR, cut: 180, show: SHTEX, showOf: fnv(SHEXPR) }, on: false }, MOB]);
await select('F');
M = await marks();
ok('only a bypassed step has a display form: no mark on F\'s line', M.f === null, M);

const errs = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error') && !/Failed to load resource|favicon/.test(x.m || ''));
ok('no page errors', errs.length === 0, errs.slice(0, 3));
return { pass, fails, info };
