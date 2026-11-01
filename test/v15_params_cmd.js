// v15 shared numbers, links and scene files (src/params.js; notes/ui-redesign-2/constructions/DESIGN.md 1, phase 1).
// Checks, in the real app: a number is created by typing a new letter (Re z = a in the formula box); the same number is
// then used in a step (Möbius b = a i), a shape field (a disc's radius 2a), a zero (ζ₁ = a), a region formula
// (|z − a| < 0.5) and the curve Re z = a; dragging the Parameters slider moves all of them at once (frame times
// measured: rAF work per frame and the slider's input handler); at rest the picture equals a fresh load of the same
// state (exact, the renderer's own rest pass); the drag is one undo step and undo restores every user; saved state
// and a reload keep them; a link round-trips (to a fresh page, and over existing work: it asks, and Undo brings the
// work back); a scene file round-trips through the file picker; the Russian interface keeps them; a clash and a
// two-names edit are refused with their messages.
// A command file for a CDP daemon (test/cdp_kit README):  python3 build.py && test/<you>_cdp/q.sh test/v15_params_cmd.js
// Prints {pass, fails, info}; screenshots go to <daemon folder>/shots/v15p-*.png.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const exc = (l) => l.filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''));
const errs = [];
const grab = async () => { errs.push(...exc(await logs())); };
const P = () => ev('__cmwP()');
const NS = 'v15prm' + (Date.now() % 1000000);   // fresh namespaces every run (a link over saved work asks)
const STATE = {
  shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 0.6, ci: 0, visible: true }],
  steps: [{ type: 'mobius', params: { a: '1', b: '0', c: '0', d: '1' }, on: true }, { type: 'zp', params: { a: '1', zeros: '1', poles: '' }, on: true }],
  srcView: { cx: 0, cy: 0, s: 80 }, v5: true, v6: true,
};
// a text field: focus, type, Enter (change), blur: as a person does
const typeIn = async (sel, text) => {
  const r = await ev(`(()=>{const el=document.querySelector(${JSON.stringify(sel)}); if(!el) return null; el.scrollIntoView({block:'nearest'}); el.focus(); el.select && el.select(); return true})()`);
  if (!r) return false;
  await ev(`(()=>{const el=document.activeElement; el.value=''; el.dispatchEvent(new Event('input',{bubbles:true})); return 1})()`);
  await type(text);
  await key('Enter');
  await ev(`(()=>{const el=document.activeElement; if (el && el.blur) el.blur(); return 1})()`);
  await settle(300);
  return true;
};
// (v15 merge: a step's fields are in the Inspector; a click on the step's card selects it there)
const inStep = async (k, inner) => { await clickSel(`#pipeline .card[data-k="${k}"]`); await settle(300); return `#propsPanel .insp-step[data-k="${k}"] ${inner}`; };
const bound = async () => ev(`(()=>{const p=__cmwP(); const sh=p.shapes; return {
  a: (p.params.find((x)=>x.name==='a')||{}).value,
  b: p.steps[0].params.b, zeros: p.steps[1].params.zeros, errors: p.errors,
  disc: sh.find((s)=>s.id==='s1'), fcurve: sh.find((s)=>s.kind==='fcurve'), formula: sh.find((s)=>s.kind==='formula'), hi: p.hi, sig: p.sig }; })()`);

await view(1440, 900, false, false);
await load(NS, STATE);
await settle(800);
const origin = await ev('location.origin');
await grab();

// 1. create a number by typing: Re z = a in the formula box, Enter
await typeIn('#formulaInput', 'Re z = a');
let s = await P();
ok('typing a new letter creates the number a', s.params.length === 1 && s.params[0].name === 'a' && s.params[0].value === 1, s.params);
const fc = s.shapes.find((x) => x.kind === 'fcurve');
ok('Re z = a is a curve shape bound to a', fc && fc.bind && fc.bind.expr === 'Re z = a' && fc.expr === 'Re z = (1)', fc);
ok('the Parameters row appears', await ev(`!!document.querySelector('.prm-row[data-name="a"] input[type=range]')`), null);
const hiAfterCreate = s.hi;

// 2. use it in a step (Möbius b = a i), a shape field (radius 2a), a zero (ζ₁ = a) and a region formula
await typeIn(await inStep(1, 'input[data-pkey="b"]'), 'a i');
s = await P();
ok('Möbius b = a i builds', s.steps[0].params.b === 'a i' && !s.errors[0], { b: s.steps[0].params.b, e: s.errors[0] });
await typeIn(await inStep(2, 'input[data-zp="zeros:0"]'), 'a');
s = await P();
ok('ζ₁ = a', s.steps[1].params.zeros === 'a' && !s.errors[1], { z: s.steps[1].params.zeros, e: s.errors[1] });
// the disc's radius: select the disc in the Shapes list, then its radius field
await ev(`(()=>{const r=document.querySelector('.shape[data-id="s1"] .shape-row'); if(r) r.click(); return !!r})()`);
await settle(300);
let radiusSel = await ev(`(()=>{const ed=document.querySelector('.shape-edit'); if(!ed) return null; const ins=[...ed.querySelectorAll('input[data-fx]')]; ins.forEach((x,i)=>x.dataset.t='fx'+i); return ins.length})()`);
info.shapeFields = radiusSel;
if (radiusSel >= 2) await typeIn('.shape-edit input[data-t="fx1"]', '2a');
s = await P();
let disc = s.shapes.find((x) => x.id === 's1');
ok('disc radius = 2a', disc && disc.bind && disc.bind.r === '2a' && disc.r === 2, disc);
await typeIn('#formulaInput', '|z - a| < 0.5');
s = await P();
const fm = s.shapes.find((x) => x.kind === 'formula' && x.bind);
ok('region formula |z − a| < 0.5 bound', fm && fm.bind.expr === '|z - a| < 0.5' && fm.expr === '|z - (1)| < 0.5', fm);
// refused: a clash and two new names at once
await typeIn(await inStep(1, 'input[data-pkey="c"]'), 's + t');
info.twoNames = await ev(`document.querySelector('#toastHost')?.textContent || ''`);
ok('two new names at once are refused', /One new name at a time/.test(info.twoNames) && (await P()).params.length === 1, info.twoNames);
await typeIn(await inStep(1, 'input[data-pkey="c"]'), '0');
const clash = await ev(`Params.check('r').error`);
ok('r is refused with its message', /ρ or R/.test(clash || ''), clash);
await grab();
await shot('v15p-1-bound');

// 3. drag the slider from 1 to 0.5: frame times, every user follows
const hiBeforeDrag = (await P()).hi;
const rg = await ev(`(()=>{const r=document.querySelector('.prm-row[data-name="a"] input[type=range]').getBoundingClientRect(); return [r.left, r.top + r.height / 2, r.width]})()`);
await ev(`(()=>{ window.__frw = []; window.__frd = []; window.__inp = []; let last = 0;
  if (!window.__rafWrapped) { window.__rafWrapped = true; const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => raf((ts) => { const t0 = performance.now(); cb(ts); if (window.__frw) window.__frw.push(performance.now() - t0); }); }
  const tick = (ts) => { if (!window.__frd) return; if (last) window.__frd.push(ts - last); last = ts; window.__tickId = requestAnimationFrame(tick); }; requestAnimationFrame(tick);
  let t0 = 0; window.addEventListener('input', () => { t0 = performance.now(); }, true); window.addEventListener('input', () => { if (window.__inp) window.__inp.push(performance.now() - t0); });
  return 1; })()`);
// x of value v on the track (thumb centre between the ends)
const xOf = (v) => rg[0] + 8 + (rg[2] - 16) * (v + 2) / 4;
await drag(xOf(1), rg[1], xOf(0.5), rg[1], 40, 16);
const perf = await ev(`(()=>{ const q = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b.length ? +b[Math.min(b.length - 1, Math.floor(p * b.length))].toFixed(2) : null; };
  const r = { work_p95: q(__frw, 0.95), work_max: q(__frw, 1), delta_p50: q(__frd, 0.5), delta_p95: q(__frd, 0.95), input_p95: q(__inp, 0.95), n: __frd.length, ni: __inp.length };
  window.__frw = null; window.__frd = null; window.__inp = null; return r; })()`);
info.perf = perf;
ok('slider drag: rAF work p95 ≤ 14 ms', perf.work_p95 != null && perf.work_p95 <= 14, perf);
ok('slider drag: input handler p95 ≤ 14 ms', perf.input_p95 != null && perf.input_p95 <= 14, perf);
await settle(1500);
let b = await bound();
info.afterDrag = { a: b.a, b: b.b, r: b.disc.r, fc: b.fcurve.expr, fm: b.formula.expr };
ok('the slider sets a', Math.abs(b.a - 0.5) < 0.02, b.a);
const A = b.a;
ok('the curve follows', b.fcurve.expr === `Re z = (${A})`, b.fcurve.expr);
ok('the radius follows (2a)', b.disc.r === 2 * A, b.disc.r);
ok('the region formula follows', b.formula.expr === `|z - (${A})| < 0.5`, b.formula.expr);
ok('the steps read the new value', /;a=/.test(b.sig) && b.sig.endsWith(`;a=${A}`), b.sig.slice(-30));
const zero = await ev(`(()=>{ const z = __cmwZp(); return z ? z.params.zeros : null })()`);
ok('the zero keeps its formula', b.zeros === 'a', b.zeros);
ok('the drag is one undo step', b.hi === hiBeforeDrag + 1, { hi: b.hi, was: hiBeforeDrag });
await shot('v15p-2-dragged');
// exact at rest: the rest frame after the drag equals a fresh load of the same saved state
const restL = await ev(`__cmwRenderOff('L', 320, 240, 1)`), restR = await ev(`__cmwRenderOff('R', 320, 240, 1)`);
await ev('new Promise((r) => setTimeout(r, 400))');
await nav(origin + '/test.html?ns=' + NS);
await settle(1500);
const freshL = await ev(`__cmwRenderOff('L', 320, 240, 1)`), freshR = await ev(`__cmwRenderOff('R', 320, 240, 1)`);
ok('rest frame after the drag = a fresh load (X)', restL === freshL, restL.length + ' vs ' + freshL.length);
ok('rest frame after the drag = a fresh load (Y)', restR === freshR, restR.length + ' vs ' + freshR.length);
b = await bound();
ok('reload keeps the number and its users', b.a === A && b.b === 'a i' && b.disc.bind.r === '2a' && b.fcurve.bind.expr === 'Re z = a' && b.zeros === 'a', b);
ok('the row is back after the reload', await ev(`document.querySelector('.prm-row[data-name="a"] .prm-val').value`) === String(A), null);

// 4. undo (in a fresh history: set by the field, then undo)
await typeIn('.prm-row[data-name="a"] .prm-val', '-0.75');
b = await bound();
ok('the value field sets a', b.a === -0.75 && b.fcurve.expr === 'Re z = (-0.75)', b.a);
await key('z', 4);
await settle(600);
b = await bound();
ok('undo restores a and every user', b.a === A && b.fcurve.expr === `Re z = (${A})` && b.disc.r === 2 * A && b.formula.expr === `|z - (${A})| < 0.5`, { a: b.a, fc: b.fcurve.expr, r: b.disc.r });
ok('undo updates the slider', +(await ev(`document.querySelector('.prm-row[data-name="a"] input[type=range]').value`)) === A, null);
await grab();

// 5. a link: to a fresh page (opens directly), and over existing work (asks; Undo brings the work back)
const figure = (await P()).figure;
const payload = await ev(`await Params.encodeLink(__cmwP().figure)`);
info.linkLength = (origin + '/test.html#cmw=' + payload).length;
await nav(origin + '/test.html?ns=' + NS + '-link#cmw=' + payload);
await settle(2500);
let L = await P();
ok('a link opens on a fresh page', L.params.length === 1 && L.params[0].value === A && L.steps[0].params.b === 'a i' && L.shapes.some((x) => x.bind && x.bind.expr === 'Re z = a'), { p: L.params, b: L.steps[0].params.b });
ok('the link is gone from the address bar', !(await ev('location.hash')), null);
ok('the link figure equals the original', JSON.stringify(L.figure.shapes) === JSON.stringify(figure.shapes) && JSON.stringify(L.figure.steps) === JSON.stringify(figure.steps) && JSON.stringify(L.figure.params) === JSON.stringify(figure.params), null);
// over existing work: a different figure saved in this namespace first
await ev(`Params.set('a', 1.25), 1`);
await settle(500);
await ev('new Promise((r) => setTimeout(r, 400))');
await nav(origin + '/test.html?ns=' + NS + '-link#cmw=' + payload);
await settle(1500);
const ask = await ev(`(document.querySelector('#toastHost [role=alertdialog]') || {}).textContent || ''`);
ok('a link over existing work asks first', /Open it in place of yours/.test(ask) && (await P()).params[0].value === 1.25, ask);
await ev(`(()=>{ const b = [...document.querySelectorAll('#toastHost [role=alertdialog] button')].find((x) => x.textContent === 'Open'); b.click(); return 1 })()`);
await settle(2500);
L = await P();
ok('Open replaces the figure', L.params[0].value === A, L.params);
const undoBtn = await ev(`(()=>{ const b = [...document.querySelectorAll('#toastHost button')].find((x) => x.textContent === 'Undo'); if (!b) return false; b.click(); return true })()`);
await settle(2500);
L = await P();
ok('Undo after opening brings the work back', undoBtn && L.params[0].value === 1.25, { undoBtn, p: L.params });
// an older link: a state saved by an earlier build (no params; the old view fields) still opens
const oldState = { v3: true, v4: true, shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 1 }], steps: [{ type: 'exp', params: {}, on: true }], rightMode: 'image', nextId: 2, focus: 0 };
const oldPayload = await ev(`await Params.encodeLink(${JSON.stringify(oldState)})`);
await nav(origin + '/test.html?ns=' + NS + '-old#cmw=' + oldPayload);
await settle(2500);
L = await P();
ok('a link of an older build opens', L.steps.length === 1 && L.steps[0].type === 'exp' && L.shapes.length === 1 && L.params.length === 0, { s: L.steps, p: L.params });
await grab();

// 6. a scene file through Open scene… (the file picker)
const scenePath = path.join(DIR, 'shots', 'v15p-scene.cmw.json');
fs.mkdirSync(path.dirname(scenePath), { recursive: true });
fs.writeFileSync(scenePath, await ev(`Params.scene(${JSON.stringify(figure)})`));
await nav(origin + '/test.html?ns=' + NS + '-scene');
await settle(1500);
await ev(`(()=>{ document.getElementById('shareBtn').click(); return 1 })()`);   // ([v17 D5] Open scene… is Share's)
await settle(200);
await ev(`(()=>{ const it = [...document.querySelectorAll('.pop.menu .mi')].find((x) => /Open scene/.test(x.textContent)); if (it) it.click(); return !!it })()`);
await settle(200);
const doc = await send('DOM.getDocument', { depth: -1 });
const q = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: 'input[type=file]' });
if (q && q.nodeId) await send('DOM.setFileInputFiles', { files: [scenePath], nodeId: q.nodeId });
await settle(3000);
L = await P();
ok('a scene file opens', q && q.nodeId && L.params.length === 1 && L.params[0].value === A && L.steps[1].params.zeros === 'a', { q: !!(q && q.nodeId), p: L.params });
ok('the scene says it opened', /Opened the scene/.test(await ev(`document.querySelector('#toastHost')?.textContent || ''`)), null);
const bad = await ev(`(()=>{ try { Params.readScene('{"app":"other"}'); return ''; } catch (e) { return e.message; } })()`);
ok('a file that is not a scene is refused', /not a scene/.test(bad), bad);
await grab();

// 7. the Russian interface keeps them (the language switch reloads with the saved state)
await nav(origin + '/test.html?ns=' + NS);
await settle(1200);
await ev(`I18N.setPref('ru'), 1`);
await settle(3500);
b = await bound();
const ru = await ev(`({ head: document.querySelector('.prm h2')?.textContent, lang: I18N.lang, row: !!document.querySelector('.prm-row[data-name="a"]') })`);
ok('the language switch keeps the numbers', ru.lang === 'ru' && b.a === A && b.b === 'a i' && b.fcurve.bind.expr === 'Re z = a', { ru, a: b.a });
ok('Parameters in Russian', ru.head === 'Числа' && ru.row, ru);   // (v16.5 UX65: Numbers, «Числа»)
await shot('v15p-3-ru');
await view(1440, 900, true, false);
await settle(800);
await shot('v15p-4-ru-dark');
await ev(`I18N.setPref('en'), 1`);
await settle(3000);
await view(1440, 900, false, false);
await grab();

ok('no exceptions', errs.length === 0, errs.slice(0, 5));
return { pass: fails.length === 0, fails, info };
