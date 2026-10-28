// v15 desktop and tablet redesign (notes/ui-redesign-2/desktop/DESIGN.md; as built: notes/ui-redesign-2/build/desktop.md).
// Checks: the cards follow the view (X → Y, Phase, Landscape, the Deformation) and are cumulative; the last card's
// picture is exact against the main plane (Phase: colours at the same z; X → Y: the image at the same w); selecting a
// card is not Show alone; the Inspector edits a step (indexed coefficients, 32 px fields), Add zero / Add pole never
// switch to Show alone, × removes; the F tile (lit names, the F Inspector); the temporary Inspector; frame times while
// dragging a parameter (a zero) and a shape; light and dark; 1440, 1280, 1024, 768 (layout, no card name cut, the chain
// fits); Russian at the four widths. A command file for a CDP daemon (test/cdp_kit README):
//   python3 build.py && test/<you>_cdp/q.sh test/v15_desktop_cmd.js
// Prints {pass, fails, info, shots}; screenshots go to <daemon folder>/shots/v15d-*.png.
const fails = [], shots = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const exc = (l) => l.filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''));
const errs = [];
const grab = async () => { errs.push(...exc(await logs())); };
const cards = () => ev('__cmwCards()');
const drawCards = async () => { await settle(300); await ev('__cmwCardsNow()'); await settle(400); await ev('__cmwCardsNow()'); await settle(300); };
const PLAIN = { lines: false, unit: false, fov: false, outline: false, chev: false };
const CHAIN = [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' }, on: true }, { type: 'zp', params: { a: '1', zeros: '0.5, -0.5i', poles: '-0.8+0.75i' }, on: true }];
const SHAPES = [{ id: 's1', kind: 'formula', expr: '|\\Im z| < 0.8' }, { id: 's2', kind: 'line', a: [0, 0.8], b: [1, 0.8] }, { id: 's3', kind: 'point', p: [0, 0] }];
const ns = 'v15d' + Date.now();
await view(1440, 900, false);
await load(ns, Object.assign({ shapes: SHAPES, steps: CHAIN, pattern: 'checker', srcView: { cx: 0, cy: 0, s: 50 } }, PLAIN));
await settle(1500); await grab();

// 1. the chain: cards are a type and a picture; the F tile; no formula, fields or property strip on a card
let dom = await ev(`(() => [...document.querySelectorAll('#pipeline .card')].map((c) => ({ k: +c.dataset.k, nm: c.querySelector('.nm').textContent, ty: !!c.querySelector('.ty svg'), fields: c.querySelectorAll('input').length, chips: c.querySelectorAll('.pchip').length, h: Math.round(c.getBoundingClientRect().height), role: c.getAttribute('role') })))()`);
ok('cards: index, icon, name; no fields or strips; 134 px', dom.length === 4 && dom.every((c) => c.ty && c.fields === 0 && c.chips === 0 && c.h === 134 && c.role === 'option'), dom);
ok('the chain is 188 px', (await ev(`Math.round(document.querySelector('.pipe-wrap').getBoundingClientRect().height)`)) === 188, await ev(`document.querySelector('.pipe-wrap').getBoundingClientRect().height`));
ok('no Guarantees panel, no rail lamps', await ev(`!document.querySelector('#propsPanel .lamps') && !document.getElementById('railLamps')`), null);
let tile = await ev(`(() => { const t = document.querySelector('#pipeline .ftile'); return t ? { lit: [...t.querySelectorAll('.lamp:not([hidden])')].map((e) => e.dataset.lamp), on: [...t.querySelectorAll('.lamp.on')].map((e) => e.dataset.lamp), text: t.innerText.replace(/\\s+/g, ' ').trim(), last: t === document.querySelector('#pipeline').lastElementChild } : null; })()`);
ok('the F tile closes the chain: F and its lit property', tile && tile.last && tile.lit.join() === 'analytic' && tile.on.join() === 'analytic' && /^F Analytic/.test(tile.text), tile);
ok('the lamps read from the F tile (__qa.lamps)', /●analytic/.test(await ev('__qa.lamps()')) && /○rational/.test(await ev('__qa.lamps()')), await ev('__qa.lamps()'));

// 2. cards per view (cumulative: card k shows F_k), exact against the main plane
const kinds = {};
for (const [main, kind] of [['xy', 'xy'], ['phase', 'phase'], ['land', 'land']]) {
  await ev(`__cmwSetMain('${main}'), 1`); await settle(1200);
  await drawCards();
  const c = await cards();
  kinds[main] = c;
  ok(`${main}: the cards draw the ${kind} kind, all final`, c.kind === kind && c.cards.every((q) => q.sig && q.sig.startsWith(q.k === 0 ? 'xy|' : kind + '|') && !q.stale), c.cards.map((q) => [q.k, q.sig && q.sig.slice(0, 12), q.stale]));
  const blank = await ev(`[...document.querySelectorAll('#pipeline .card canvas')].map((cv) => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let mn = 255, mx = 0; for (let i = 0; i < d.length; i += 4 * 37) { const v = d[i] + d[i + 1] + d[i + 2]; mn = Math.min(mn, v); mx = Math.max(mx, v); } return mx - mn; })`);
  ok(`${main}: every card has a picture`, blank.every((r) => r > 40), blank);
  await shot('v15d-' + main + '-1440-light'); shots.push('v15d-' + main + '-1440-light');
}
ok('the step cards differ by view', [1, 2, 3].every((k) => new Set(['xy', 'phase', 'land'].map((m) => kinds[m].cards.find((q) => q.k === k).sig)).size === 3), null);

// exactness, Phase: the last card's colours are the main portrait's at the same z (cover-fitted window)
await ev(`__cmwSetMain('phase'), 1`); await settle(1200); await drawCards();
const PHASE_EXACT = `(() => {
  const C = __cmwCards(), n = C.cards.length - 1, c = C.cards.find((q) => q.k === n);
  const cv = document.querySelector('#pipeline .card[data-k="' + n + '"] canvas'), main = document.getElementById('canvasL');
  const ci = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data, mi = main.getContext('2d').getImageData(0, 0, main.width, main.height).data;
  const mv = C.main.view, md = C.main.dpr, out = [];
  const px = (a, W, X, Y) => { const o = (Math.round(Y) * W + Math.round(X)) * 4; return [a[o], a[o + 1], a[o + 2]]; };
  const inside = (cv, X, Y) => X >= 4 && Y >= 4 && X < cv.width - 4 && Y < cv.height - 4;
  // (away from the main plane's grid lines, axes and outlines: a pixel whose 5 x 5 neighbourhood is smooth in both)
  const smooth = (a, W, X, Y, r) => { const p0 = px(a, W, X, Y); for (let dy = -r; dy <= r; dy += r) for (let dx = -r; dx <= r; dx += r) { const q = px(a, W, X + dx, Y + dy); if (Math.max(Math.abs(q[0] - p0[0]), Math.abs(q[1] - p0[1]), Math.abs(q[2] - p0[2])) > 24) return false; } return true; };
  for (let j = 1; j < 16; j++) for (let i = 1; i < 24; i++) {
    const x = i / 24 * c.w, y = j / 16 * c.h;
    const re = c.view.cx + (x - c.w / 2) / c.view.s, im = c.view.cy - (y - c.h / 2) / c.view.s;
    const mx = C.main.w / 2 + (re - mv.cx) * mv.s, my = C.main.h / 2 - (im - mv.cy) * mv.s;
    if (!inside(main, mx * md, my * md)) continue;
    if (!smooth(ci, cv.width, x * c.dpr, y * c.dpr, 2) || !smooth(mi, main.width, mx * md, my * md, 2)) continue;
    const p = px(ci, cv.width, x * c.dpr, y * c.dpr), q = px(mi, main.width, mx * md, my * md);
    out.push(Math.max(Math.abs(p[0] - q[0]), Math.abs(p[1] - q[1]), Math.abs(p[2] - q[2])));
  }
  out.sort((a, b) => a - b);
  return { n: out.length, med: out[out.length >> 1], p90: out[Math.floor(out.length * 0.9)], max: out[out.length - 1] };
})()`;
const pe = await ev(PHASE_EXACT);
info.phaseExact = pe;
ok('Phase: the last card is the main portrait (median ≤ 3, p90 ≤ 10 of 255)', pe.n > 100 && pe.med <= 3 && pe.p90 <= 10, pe);

// exactness, X → Y: the last card's image is the main image at the same w (solid fill, flat pixels)
await ev(`__cmwSetMain('xy'), 1`); await settle(800);
await ev(`__cmwSet('pattern', 'solid'), __cmwSet('alpha', 1), 1`); await settle(1500); await drawCards();
const XY_EXACT = PHASE_EXACT.replace("document.getElementById('canvasL')", "document.getElementById('canvasR')")
  .replace("const mx = C.main.w / 2 + (re - mv.cx) * mv.s, my = C.main.h / 2 - (im - mv.cy) * mv.s;", "const cl = __cmwW2S('R', re, im), rr = main.getBoundingClientRect(), mx = cl[0] - rr.left, my = cl[1] - rr.top;")
  .replace('const mv = C.main.view, md = C.main.dpr', 'const md = main.width / main.getBoundingClientRect().width');
const xe = await ev(XY_EXACT);
info.xyExact = xe;
ok('X → Y: the last card is the main image (median ≤ 3, p90 ≤ 10 of 255)', xe.n > 60 && xe.med <= 3 && xe.p90 <= 10, xe);
await ev(`__cmwSet('pattern', 'checker'), 1`); await settle(800);

// the deformation: step k at its own t (one after another: 1, 0.55, 0 at T = 1.55)
await ev('__cmwMorph({ open: true, playing: false })'); await settle(600);
await ev('__cmwMorph({ T: 1.55 })'); await settle(800); await drawCards();
let cd = await cards();
ok('Deformation: cards at their own t', cd.kind === 'def' && cd.cards.filter((q) => q.k > 0).map((q) => +q.t.toFixed(2)).join() === '1,0.55,0' && cd.cards.every((q) => q.sig && !q.stale), cd.cards.map((q) => [q.k, q.t, !!q.sig]));
ok('Deformation: t labels on the cards', (await ev(`[...document.querySelectorAll('#pipeline .card .tlab')].map((e) => e.textContent).join('|')`)) === 't = 1.00|t = 0.55|t = 0.00', await ev(`[...document.querySelectorAll('#pipeline .card .tlab')].map((e) => e.textContent).join('|')`));
await shot('v15d-def-1440-light'); shots.push('v15d-def-1440-light');
// review verify-1: while it plays (the real Play button), no card shows a t other than its current one; after the
// pause the cards are redrawn and show their t again
const LABS = `(() => { const C = __cmwCards(); return [...document.querySelectorAll('#pipeline .card')].map((c) => { const l = c.querySelector('.tlab'), q = C.cards.find((x) => x.k === +c.dataset.k); return { k: +c.dataset.k, vis: !!l && l.textContent !== '' && getComputedStyle(l).visibility !== 'hidden', txt: l ? l.textContent : '', now: q ? 't = ' + q.t.toFixed(2) : '', T: __cmwMorph().T }; }); })()`;
await clickSel('#morphPlay');
const playS = [];
for (const ms of [250, 250]) { await sleep(ms); playS.push(await ev(LABS)); }
ok('Deformation playing: no visible card t differs from the card\'s current t', (await ev('__cmwMorph().playing')) && playS.every((s) => s.every((c) => !c.vis || c.txt === c.now)), playS);
await clickSel('#morphPlay'); await settle(1500);
const labsAfter = await ev(LABS);
ok('Deformation paused: the cards show their current t again', labsAfter.filter((c) => c.k > 0).every((c) => c.vis && c.txt === c.now), labsAfter);
await ev('__cmwMorph({ open: false })'); await settle(500);
await grab();

// 3. select is not focus; the Inspector edits the step (indexed coefficients, 32 px fields)
await clickSel('#pipeline .card[data-k="2"]'); await settle(700);
let c2 = await cards();
ok('a click selects f2 and keeps the whole chain', c2.sel === 2 && c2.focus === 0, { sel: c2.sel, focus: c2.focus });
let ins = await ev(`(() => { const e = document.querySelector('#propsPanel .insp-step[data-k="2"]'); if (!e) return null; return { labels: [...e.querySelectorAll('label.pl')].map((l) => l.textContent), tex: e.querySelector('.ftex').dataset.tex, h: [...e.querySelectorAll('.params input.inp')].map((i) => Math.round(i.getBoundingClientRect().height)), det: e.querySelector('.isub').textContent, ttl: e.querySelector('.ttl').textContent, alone: e.querySelector('.alone-btn').getAttribute('aria-pressed'), w: Math.round(document.getElementById('propsPanel').getBoundingClientRect().width) }; })()`);
ok('Inspector: f2 Möbius with a2 b2 c2 d2, 32 px fields, the generic formula and the determinant', ins && ins.labels.join() === 'a2,b2,c2,d2' && ins.h.every((x) => x === 32) && /a_\{2\}w_\{1\}\+b_\{2\}/.test(ins.tex) && /a₂d₂ − b₂c₂ = 2/.test(ins.det) && ins.alone === 'false' && ins.w >= 286, ins);
const sig2 = (await cards()).cards.find((q) => q.k === 2).sig;
await ev(`(() => { const e = document.querySelector('#propsPanel .insp-step[data-k="2"] input[data-pkey="b"]'); e.value = '-2'; e.dispatchEvent(new Event('input')); e.dispatchEvent(new Event('change')); })()`); await settle(900);
await drawCards();
const st2 = await ev('__qa.state()');
ok('editing b2 in the Inspector changes the step and redraws its card and the later ones', st2.steps[1].params.b === '-2' && (await cards()).cards.find((q) => q.k === 2).sig !== sig2, { b: st2.steps[1].params.b });
ok('the determinant follows', /= 3$/.test(await ev(`document.querySelector('#propsPanel .insp-step[data-k="2"] .isub').textContent`)), await ev(`document.querySelector('#propsPanel .insp-step[data-k="2"] .isub').textContent`));
await key('z', 4); await settle(600);
// Show alone: a double-click (or the lens, or L on the card); Whole chain returns
await ev(`document.querySelector('#pipeline .card[data-k="2"]').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`); await settle(800);
c2 = await cards();
ok('a double-click shows f2 alone', c2.focus === 2 && c2.sel === 2 && (await ev(`document.querySelector('#propsPanel .alone-btn').getAttribute('aria-pressed')`)) === 'true' && !(await ev(`document.getElementById('viewAllBtn').disabled`)), c2);
await clickSel('#viewAllBtn'); await settle(700);
ok('Whole chain returns, the selection stays', (await cards()).focus === 0 && (await cards()).sel === 2, await cards());
await ev(`document.querySelector('#pipeline .card[data-k="2"]').focus()`); await key('l'); await settle(600);
ok('L on a card toggles Show alone', (await cards()).focus === 2, await cards());
await key('l'); await settle(600);
await key('ArrowRight'); await settle(500);
ok('arrows move the selection along the chain', (await cards()).sel === 3, await cards());

// 4. zeros and poles: big buttons, never Show alone, × removes
let insz = await ev(`(() => { const e = document.querySelector('#propsPanel .insp-step[data-k="3"]'); return e ? { adds: [...e.querySelectorAll('.zp-add')].map((b) => [b.textContent.replace(/\\d+$/, ''), Math.round(b.getBoundingClientRect().height)]), syms: [...e.querySelectorAll('.zp-sym')].map((x) => x.textContent), a: e.querySelector('label.pl:not(.zp-sym)').textContent } : null; })()`);
ok('Inspector: Add zero / Add pole are 36 px; a3, ζ1 ζ2 p1', insz && insz.adds.map((x) => x.join(':')).join() === 'Add zero:36,Add pole:36' && insz.syms.join('') === 'ζ₁ζ₂p₁' && insz.a === 'Factor a3', insz);
await clickSel('#propsPanel .insp-step[data-k="3"] .zp-add.zeros'); await settle(700);
let s3 = await ev('__qa.state()');
ok('Add zero adds a zero and keeps the whole chain', s3.steps[2].params.zeros.split(',').length === 3 && (await cards()).focus === 0, { zeros: s3.steps[2].params.zeros, focus: (await cards()).focus });
await clickSel('#propsPanel .insp-step[data-k="3"] .zp-add.poles'); await settle(700);
s3 = await ev('__qa.state()');
ok('Add pole adds a pole and keeps the whole chain', s3.steps[2].params.poles.split(',').length === 2 && (await cards()).focus === 0, { poles: s3.steps[2].params.poles });
ok('the new marks are distinct and parse', (() => { const z = s3.steps[2].params.zeros.split(',').map((x) => x.trim()); const p = s3.steps[2].params.poles.split(',').map((x) => x.trim()); return new Set([...z, ...p]).size === 5; })(), s3.steps[2].params);
await clickSel('#propsPanel .insp-step[data-k="3"] input[data-zp="poles:1"] ~ .zp-del'); await settle(600);
await clickSel('#propsPanel .insp-step[data-k="3"] input[data-zp="zeros:2"] ~ .zp-del'); await settle(600);
s3 = await ev('__qa.state()');
ok('× removes them', s3.steps[2].params.zeros.split(',').length === 2 && s3.steps[2].params.poles.split(',').length === 1, s3.steps[2].params);
// (review verify-4) a zero or pole field shows the true minus (U+2212) when it is not focused, as the Parameters'
// value fields do; the stored text keeps the hyphen, and a field typed with a hyphen reads the same value
{
  const zf = `document.querySelector('#propsPanel .insp-step[data-k="3"] input[data-zp="zeros:1"]')`;
  await ev(`(() => { const e = ${zf}; e.focus(); e.value = '-0.5-0.25i'; e.dispatchEvent(new Event('input')); e.blur(); e.dispatchEvent(new Event('change')); })()`); await settle(600);
  const zv = await ev(`({ shown: ${zf}.value, stored: __qa.state().steps[2].params.zeros, others: [...document.querySelectorAll('#propsPanel input[data-zp]')].map((e) => e.value), bad: ${zf}.classList.contains('bad') })`);
  ok('zero/pole fields: the true minus on screen, the hyphen in the stored text', zv.shown === '−0.5−0.25i' && /(^|, )-0\.5-0\.25i(,|$)/.test(zv.stored) && !/−/.test(zv.stored) && !zv.bad && zv.others.every((t) => !/-/.test(t)), zv);
  // the step's own coefficient a₃ in the same block: the same form
  const af = `document.querySelector('#propsPanel .insp-step[data-k="3"] input[data-pkey="a"]')`;
  const a0 = await ev(`__qa.state().steps[2].params.a`);
  await ev(`(() => { const e = ${af}; e.focus(); e.value = '-1.5'; e.dispatchEvent(new Event('input')); e.blur(); e.dispatchEvent(new Event('change')); })()`); await settle(600);
  const av = await ev(`({ shown: ${af}.value, stored: __qa.state().steps[2].params.a, bad: ${af}.classList.contains('bad') })`);
  ok('a coefficient field: the true minus on screen, the hyphen in the stored text', av.shown === '−1.5' && av.stored === '-1.5' && !av.bad, av);
  await ev(`(() => { const e = ${af}; e.value = ${JSON.stringify(String(a0))}; e.dispatchEvent(new Event('input')); e.dispatchEvent(new Event('change')); })()`); await settle(400);
}
await shot('v15d-zp-1440-light'); shots.push('v15d-zp-1440-light');

// 5. the F tile and the F Inspector
await clickSel('#pipeline .ftile'); await settle(900);
let fi = await ev(`(() => { const e = document.querySelector('#propsPanel .insp-F'); if (!e) return null; return { lit: [...e.querySelectorAll('.iglist .lamp:not([hidden])')].map((x) => x.dataset.lamp), not: e.querySelectorAll('.ignot')[1].textContent, dom: e.querySelector('.idom').textContent.replace(/\\s+/g, ' '), folds: [...e.querySelectorAll('details.ifold')].map((d) => d.open), rows: e.querySelectorAll('.matrix tbody tr').length, f: (e.querySelector('.ftex').dataset.tex || '').slice(0, 6) }; })()`);
ok('F: the formula, the lit guarantee, one muted line, the domain, folded tables', fi && fi.lit.join() === 'analytic' && /^Not implied: entire, rational/.test(fi.not) && /Natural domain/.test(fi.dom) && fi.folds.join() === 'false,false' && fi.rows === 4 && fi.f.startsWith('F(z)='), fi);
ok('F selected: the tile is outlined', await ev(`document.querySelector('#pipeline .ftile').classList.contains('sel')`), null);
await shot('v15d-F-1440-light'); shots.push('v15d-F-1440-light');
await grab();

// 6. the temporary Inspector (panel hidden): over the stage's right edge, never over the chain; Esc closes
await key(']'); await settle(800);
await clickSel('#pipeline .card[data-k="2"]'); await settle(900);
let tmp = await ev(`(() => { const p = document.getElementById('propsPanel').getBoundingClientRect(), s = document.getElementById('panes').getBoundingClientRect(), ch = document.querySelector('.pipe-wrap').getBoundingClientRect(); return { cls: document.getElementById('propsPanel').className, p: [p.left, p.top, p.right, p.bottom], panes: [s.left, s.top, s.right, s.bottom], chainTop: ch.top, under: [...document.querySelectorAll('.pane.under-insp')].map((e) => e.id) }; })()`);
// (review design-5: with X and Y side by side the temporary Inspector takes the stage's right 296 px while it is open,
// so it never covers Y's centre)
ok('temporary Inspector (X → Y): 288 px beside the planes, from their top, covering none of them', /temp/.test(tmp.cls) && tmp.p[0] >= tmp.panes[2] + 4 && Math.abs(tmp.p[1] - tmp.panes[1]) <= 1 && Math.round(tmp.p[2] - tmp.p[0]) === 288 && tmp.under.length === 0, tmp);
await shot('v15d-temp-1440-light'); shots.push('v15d-temp-1440-light');
await key('Escape'); await settle(500);
ok('Esc closes it', !(await ev(`document.getElementById('propsPanel').classList.contains('temp')`)), null);
await key(']'); await settle(800);

// 7. frame times while dragging a parameter (a zero of a zeros-and-poles step in X) and a shape: the perf suite's
// instrumentation (test/regress/perf/inject.js: each animation frame's main-thread time plus its GPU sync): the
// design's gate (DESIGN.md 2.3) p95 ≤ 16.7 ms; BUDGET60 (p95 ≤ 14 ms) is the perf suite's paired gate (this ad-hoc
// scene measured 14.8 to 16.4 ms on the v15-base build too); then the time the cards take to redraw after the drag
const inj = await send('Page.addScriptToEvaluateOnNewDocument', { source: fs.readFileSync(path.join(DIR, '..', 'regress', 'perf', 'inject.js'), 'utf8') });
await load(ns + 'f', Object.assign({ shapes: [{ id: 's1', kind: 'disc', c: [0, 0.4], r: 0.8 }], steps: [{ type: 'zp', params: { a: '1', zeros: '1, -1', poles: '0.3i' }, on: true }, { type: 'exp', params: {}, on: true }], pattern: 'checker', srcView: { cx: 0, cy: 0, s: 110 } }, PLAIN));
await settle(1500); await drawCards();
const FR = (t0) => `(() => { const f = __perf.frames.filter((r) => r.t0 >= ${t0} && r.draws > 0).map((r) => r.t1 - r.t0).sort((a, b) => a - b); return { n: f.length, p50: +(f[f.length >> 1] || 0).toFixed(2), p95: +(f[Math.floor(f.length * 0.95)] || 0).toFixed(2), max: +(f[f.length - 1] || 0).toFixed(2) }; })()`;
const zh = (await ev('__cmwZp()')).handles.find((q) => q.kind === 'zeros' && q.i === 0);
let t0 = await ev('performance.now()');
if (zh) await drag(zh.x, zh.y, zh.x + 60, zh.y + 40, 60, 16);
const frZ = await ev(FR(t0));
info.framesZero = frZ;
ok('dragging a zero: p95 frame ≤ 16.7 ms', frZ.n > 20 && frZ.p95 <= 16.7, frZ);
await settle(800);
const cz = await ev(`__cmwW2S('L', 0, 0.4)`);
t0 = await ev('performance.now()');
await drag(cz[0], cz[1], cz[0] - 70, cz[1] + 30, 60, 16);
const frS = await ev(FR(t0));
info.framesShape = frS;
ok('dragging a shape: p95 frame ≤ 16.7 ms', frS.n > 20 && frS.p95 <= 16.7, frS);
info.cardsMs = await ev(`(() => { const t = performance.now(); __cmwCardsNow(); return +(performance.now() - t).toFixed(1); })()`);
await settle(900); await drawCards();
ok('after the drags the cards are exact again (final, not held)', (await cards()).cards.every((q) => q.sig && !q.stale), (await cards()).cards.map((q) => [q.k, !!q.sig, q.stale]));
await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: inj.identifier });
await grab();

// 8. light and dark; the four widths (English, then Russian)
await load(ns + 'w', Object.assign({ shapes: SHAPES, steps: CHAIN, pattern: 'checker', srcView: { cx: 0, cy: 0, s: 50 } }, PLAIN));
await settle(1200);
await view(1440, 900, true); await settle(1500); await drawCards();
const darkBg = await ev(`getComputedStyle(document.querySelector('#pipeline .ftile')).backgroundColor`);
ok('dark: the F tile and the cards take the dark theme', /rgb\((\d+), (\d+), (\d+)\)/.test(darkBg) && +darkBg.match(/\d+/)[0] < 80 && (await cards()).cards.every((q) => q.sig && q.sig.includes('|true|')), darkBg);
await shot('v15d-xy-1440-dark'); shots.push('v15d-xy-1440-dark');
await clickSel('#pipeline .card[data-k="3"]'); await settle(600);
await shot('v15d-zp-1440-dark'); shots.push('v15d-zp-1440-dark');
const LAYOUT = `(() => {
  const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) }; };
  const pl = document.getElementById('pipeline');
  const names = [...document.querySelectorAll('#pipeline .card .nm')].map((n) => ({ t: n.textContent, cutH: n.scrollHeight > n.clientHeight + 1, cutW: n.scrollWidth > n.clientWidth + 1 }));
  return { L: r(document.getElementById('canvasL')), R: r(document.getElementById('canvasR')), insp: r(document.getElementById('propsPanel')), chain: r(document.querySelector('.pipe-wrap')),
    fits: pl.scrollWidth <= pl.clientWidth + 1, names, ftile: r(document.querySelector('#pipeline .ftile')), lw: r(document.getElementById('leftPanel')), rw: r(document.getElementById('rightPanel')) };
})()`;
const widths = {};
for (const dark of [false]) for (const [w, hgt] of [[1440, 900], [1280, 800], [1024, 768], [768, 1024]]) {
  await view(w, hgt, dark); await settle(1400); await drawCards();
  const L = await ev(LAYOUT);
  widths[w] = L;
  ok(`${w}: no card name is cut`, L.names.every((n) => !n.cutH && !n.cutW), L.names);
  ok(`${w}: the region, three steps and F fit the chain`, L.fits, L);
  if (w >= 1280) ok(`${w}: the Inspector docks at 288 px on the right`, L.rw && L.rw.w === 288 && L.insp.x > L.R.x + L.R.w, L.rw);
  else if (w >= 1024) ok(`${w}: the Inspector docks at 264 px; the left panel is a rail`, L.rw && L.rw.w === 264 && L.lw.w === 36, { rw: L.rw, lw: L.lw });
  else ok(`${w}: the Inspector docks under the chain, 320 px, full width`, L.rw && L.rw.h === 320 && L.rw.y >= L.chain.y + L.chain.h && Math.abs(L.rw.w - L.chain.w) <= 2, { rw: L.rw, chain: L.chain });
  await shot(`v15d-xy-${w}-light`); shots.push(`v15d-xy-${w}-light`);
  // (review verify-6) the header: nothing runs past the right edge, and every secondary action (Examples, the command
  // field, both panel toggles, Export, Theme, Sound, Language, Help) is in the bar or in its More menu. Which of the two
  // at 768 px (frame f6, or the More menu of the lead default) is the user's call; this check holds for either.
  if (w <= 1024) {
    const HD = await ev(`(() => { const top = document.querySelector('.top'), tr = top.getBoundingClientRect(), vis = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
      // ([v17 D5] Theme and the panel buttons are in Settings: the bar has Share and Settings instead)
      const ids = ['examplesBtn', 'cmdBtn', 'exportBtn', 'shareBtn', 'soundBtn', 'langBtn', 'settingsBtn', 'helpBtn'], more = document.getElementById('hdrMoreBtn'), menu = document.getElementById('hdrMenu');
      const inMenu = (el) => !!el && !!menu && menu.contains(el);
      return { over: Math.max(0, ...[...top.querySelectorAll('button')].filter(vis).filter((b) => !menu || !menu.contains(b)).map((b) => Math.round(b.getBoundingClientRect().right - Math.min(tr.right, innerWidth)))),
        bar: ids.filter((id) => vis(document.getElementById(id)) && !(menu && menu.matches(':popover-open') && inMenu(document.getElementById(id)))), more: vis(more), menu: ids.filter((id) => inMenu(document.getElementById(id))), missing: ids.filter((id) => !document.getElementById(id)) }; })()`);
    info['hdr' + w] = HD;
    ok(`${w}: the header fits and every secondary action is in the bar or in More`, HD.over <= 0 && HD.missing.length === 0 && ['examplesBtn', 'cmdBtn', 'exportBtn', 'shareBtn', 'soundBtn', 'langBtn', 'settingsBtn', 'helpBtn'].every((id) => HD.bar.includes(id) || (HD.more && HD.menu.includes(id))), HD);
  }
}
info.widths = Object.fromEntries(Object.entries(widths).map(([w, L]) => [w, { L: L.L, R: L.R, insp: L.insp, chain: L.chain }]));
// Russian
await nav(`http://localhost:${(/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1]}/test.html?ns=${ns}w&lang=ru`); await settle(1800);
for (const [w, hgt] of [[1440, 900], [1280, 800], [1024, 768], [768, 1024]]) {
  await view(w, hgt, false); await settle(1400); await drawCards();
  const L = await ev(LAYOUT);
  ok(`ru ${w}: no card name is cut`, L.names.every((n) => !n.cutH && !n.cutW), L.names);
  ok(`ru ${w}: the chain fits`, L.fits, L.names);
  if (w === 1440 || w === 768) { await shot(`v15d-ru-${w}-light`); shots.push(`v15d-ru-${w}-light`); }
}
const ru = await ev(`(() => ({ names: [...document.querySelectorAll('#pipeline .card .nm')].map((n) => n.textContent.replace(/\\s+/g, ' ')), adds: [...document.querySelectorAll('#propsPanel .zp-add')].map((b) => b.textContent.replace(/\\d+$/, '')), sw: [...document.querySelectorAll('#chainMode button')].map((b) => b.textContent), tile: document.querySelector('#pipeline .ftile').innerText.replace(/\\s+/g, ' ').trim() }))()`);
ok('Russian: card names, Нуль / Полюс, Картинки | Названия, the F tile', ru.names.join('|') === 'Область|Экспонента|Дробно-линейная|Нули и полюсы' && ru.adds.join('|') === 'Нуль|Полюс' && ru.sw.join('|') === 'Картинки|Названия' && /Аналитична/.test(ru.tile), ru);   // (review russian-3, russian-1)
info.missing = await ev(`typeof I18N.missing === 'function' ? I18N.missing().filter((k) => /Inspector|Pictures|Names|Add zero|Add pole|alone|whole map|Not implied|Editor|card/.test(k)).slice(0, 20) : null`);
ok('Russian: no lookup misses in the new strings', !info.missing || info.missing.length === 0, info.missing);
await view(1440, 900, false);
await grab();
ok('no exceptions', errs.length === 0, errs.slice(0, 6));
return { pass: fails.length === 0, fails, info, shots };
