// The task lines #34 added (ux's approved table): Y's scroll or drag, Targets' disc drawn in Y, Natural domain's click on the F tile,
// the derivative's double-click on its card and Cauchy's drag of the circle. Each: nothing ticks without input; real mouse input ticks it
// within 300 ms; the result line (then) shows; the tour's English line is the approved one. 1440 × 900, English.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const R = [];
const check = (name, pass, detail) => R.push([name, !!pass, detail]);
const settle = async (ms = 900) => { await sleep(ms); await ev('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const cur = async () => { const c = await ev('Tour.current()'); return c ? c.chapter + '/' + c.id : null; };
const lit = () => ev('Tour.lit()');
logs();
const open = async (ns, w, h, dark, mobile, lang) => {
  await view(w, h, dark, mobile);
  await nav(U + '?ns=' + ns + (lang ? '&lang=' + lang : '')); await settle(1600);
  await ev('Tour.dismissSuggestion()');
};
const go = async (chapter, step) => { await ev(`Tour.start({ chapter: '${chapter}', step: ${step} })`); await settle(1500); };
const until = async (expr, max = 8000, dt = 40) => { const t0 = Date.now(); while (Date.now() - t0 < max) { if (await ev(expr)) return Date.now() - t0; await sleep(dt); } return null; };
const mdrag = async (x0, y0, x1, y1) => { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0, y: y0 }); await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x0, y: y0, button: 'left', clickCount: 1 }); for (let i = 1; i <= 10; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0 + (x1 - x0) * i / 10, y: y0 + (y1 - y0) * i / 10, button: 'left', buttons: 1 }); await sleep(16); } await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x1, y: y1, button: 'left', clickCount: 1 }); };
const center = (sel) => ev(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(sel)})].find((x) => x.getClientRects().length && x.offsetParent !== null); if (!e) return null; const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
const plane = async () => { for (let i = 0; i < 40; i++) { const L = await lit(); if (L && L.anchor) return L.anchor; await sleep(100); } throw new Error('no anchor at ' + (await cur()) + ' active ' + (await ev('Tour.isActive()'))); };

const where = (id) => ev(`(() => { for (const c of Tour._t.CHAPTERS) { const i = c.steps.findIndex((s) => s.id === ${JSON.stringify(id)}); if (i >= 0) return [c.id, i]; } return null; })()`);
const l2 = () => ev(`(() => { const e = document.querySelector('.ts-l2'); return e ? { text: e.textContent, done: e.classList.contains('done') } : null; })()`);
const goStep = async (id) => { const w = await where(id); if (!w) throw new Error('no step ' + id); await go(w[0], w[1]); return w; };
const ticks = async (ms = 2500) => until(`document.querySelector('.ts-l2').classList.contains('done')`, ms, 15);
// the pixel of a point z in a plane's plot (the plane's view centre and scale)
const px = (side, re, im) => ev(`(() => { const v = __cmwPlaneMenu().view(${JSON.stringify(side)}), b = document.getElementById('plot${side}').getBoundingClientRect(); return [b.left + b.width / 2 + (${re} - v.cx) * v.s, b.top + b.height / 2 - (${im} - v.cy) * v.s]; })()`);

await open('tt1', 1440, 900, false, false);
const task = async (id, text, fn, ready) => {
  try {
    await goStep(id);
    // (a step's scene can take a few seconds to load on a software renderer: the input waits for what it acts on)
    if (ready) { check(`${id}: its scene is up`, (await until(ready, 20000, 100)) != null); await settle(2500); }
    const a = await l2();
    check(`${id}: the task line is "${text}"`, a && a.text.replace(/\s+/g, ' ').trim().endsWith(text) && !a.done, a);
    await sleep(1800);
    check(`${id}: nothing ticks without input`, !(await l2()).done);
    await fn();
    const t = await ticks();
    check(`${id}: real input ticks it`, t != null, [await cur(), await l2()]);
    if (t != null) await sleep(200);
    return t;
  } catch (e) { check(`${id}: ran`, false, String(e && e.stack || e).slice(0, 300)); try { await ev('Tour.stop()'); } catch (x) { /* */ } return null; }
};

// y: a pan of Y (not of X)
await task('y', 'Scroll to zoom in Y, or drag to pan.', async () => {
  const b = await ev(`(() => { const b = document.getElementById('plotR').getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; })()`);
  await mdrag(b[0] + 150, b[3] - 90, b[0] + 210, b[3] - 120);
});
check('y: the result line says Y moved on its own', /Y moved on its own/.test((await l2()).text), await l2());
// (a pan of X alone does not tick Y's task)
await goStep('y');
{ const b = await ev(`(() => { const b = document.getElementById('plotL').getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; })()`);
  await mdrag(b[0] + 150, b[3] - 90, b[0] + 210, b[3] - 120); await sleep(500);
  check('y: a pan of X does not tick it', !(await l2()).done, await l2()); }

// targets: choose Disc, then drag in Y
await task('targets', 'Choose Disc, then drag in Y.', async () => {
  const d = await center('#tools > .tool[data-tool="disc"], #railTools > .tool[data-tool="disc"]');
  await mdrag(d[0], d[1], d[0], d[1]);   // (a click)
  await sleep(300);
  const b = await ev(`(() => { const b = document.getElementById('plotR').getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; })()`);
  await mdrag(b[0] + 200, b[1] + 200, b[0] + 280, b[1] + 260);
});
check('targets: the result line says X shades its preimage', /X shades its preimage/.test((await l2()).text), await l2());

// domain: click the F tile
await task('domain', 'Click the F tile.', async () => {
  const f = await center('#pipeline .ftile');
  await mdrag(f[0], f[1], f[0], f[1]);
});
check('domain: the result line names the Inspector', /Inspector lists where every step is defined/.test((await l2()).text), await l2());

// deriv: double-click the card d/dz (the second card of its scene)
await task('deriv', 'Double-click the card d/dz.', async () => {
  const c = await center('#pipeline .card[data-k="2"]');
  for (const n of [1, 2]) { await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: c[0], y: c[1], button: 'left', clickCount: n }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: c[0], y: c[1], button: 'left', clickCount: n }); }
});
check('deriv: the result line says X and Y are its input and output', /input and output/.test((await l2()).text), await l2());

// cauchy: drag the circle gamma (Select is on); a fresh page, as the focus the double-click above left on a card is no part of it
await open('tt2', 1440, 900, false, false);
await task('cauchy', 'Drag the circle γ.', async () => {
  const p = await px('L', Math.SQRT1_2, Math.SQRT1_2);
  await mdrag(p[0], p[1], p[0] + 40, p[1] - 30);
}, `__cmwShapes().shapes.some((x) => x.kind === 'circle') && __cmwView().main === 'phase'`);
check('cauchy: the result line says the integral is worked out again', /worked out again/.test((await l2()).text), await l2());


const T = (type, pts) => send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p) => ({ x: p[0], y: p[1], id: 1, radiusX: 4, radiusY: 4, force: 1 })) });
const tdrag = async (x0, y0, x1, y1, holdMs = 0) => { await T('touchStart', [[x0, y0]]); if (holdMs) await sleep(holdMs); for (let i = 1; i <= 10; i++) { await T('touchMove', [[x0 + (x1 - x0) * i / 10, y0 + (y1 - y0) * i / 10]]); await sleep(16); } await T('touchEnd', []); };
const tap = async (x, y) => { await T('touchStart', [[x, y]]); await sleep(50); await T('touchEnd', []); };

// ---------------- 390 × 844, touch: the touch lines tick
await open('tt3', 390, 844, false, true);
const taskT = async (id, text, fn, ready) => {
  try {
    await goStep(id); await settle(2500);   // (a phone's scene takes longer to settle)
    if (ready) { check(`phone ${id}: its scene is up`, (await until(ready, 20000, 100)) != null); await settle(2500); }
    const a = await l2();
    check(`phone ${id}: the task line is "${text}"`, a && a.text.replace(/\s+/g, ' ').trim().endsWith(text) && !a.done, a);
    await sleep(1500);
    check(`phone ${id}: nothing ticks without input`, !(await l2()).done);
    await fn();
    const t = await ticks(4000);
    check(`phone ${id}: a finger ticks it`, t != null, [await cur(), await l2()]);
  } catch (e) { check(`phone ${id}: ran`, false, String(e && e.stack || e).slice(0, 300)); try { await ev('Tour.stop()'); } catch (x) { /* */ } }
};
// y: a finger drags Y (the large plane on a phone at this step)
await taskT('y', 'Pinch in Y, or drag.', async () => {
  const b = await ev(`(() => { const b = document.getElementById('plotR').getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; })()`);
  await tdrag(b[0] + 120, b[1] + 200, b[0] + 190, b[1] + 160);
});
// domain: a tap on the F tile (in the chain sheet, which a tap on the steps button opens)
await taskT('domain', 'Tap the F tile.', async () => {
  if (!(await center('#pipeline .ftile'))) { const cs = await center('.ph-csteps'); if (cs) { await tap(cs[0], cs[1]); await settle(800); } }
  const f = await center('#pipeline .ftile');
  await tap(f[0], f[1]);
});
// deriv: the chain, the card d/dz, then Show alone in its sheet
await open('tt5', 390, 844, false, true);   // (a fresh page: the F tile's sheet above is no part of it)
await taskT('deriv', 'Open the chain, tap d/dz, then Show alone.', async () => {
  if (!(await center('#pipeline .card[data-k="2"]'))) { const cs = await center('.ph-csteps'); if (cs) { await tap(cs[0], cs[1]); await settle(1500); } }
  const c = await center('#pipeline .card[data-k="2"]');
  await tap(c[0], c[1]); await settle(2000);   // (the editor sheet slides up: its lens is tapped where it rests)
  const ln = await center('#propsPanel .insp-step .ihead .alone-btn');
  await tap(ln[0], ln[1]);
});
// cauchy: a finger drags the circle (the Select tool is on)
await open('tt4', 390, 844, false, true);
await taskT('cauchy', 'Tap the circle γ, then drag it.', async () => {
  const p = await px('L', Math.SQRT1_2, Math.SQRT1_2);
  await tap(p[0], p[1]); await sleep(700);   // (a bare drag of an unselected curve pans the plane: the touch line says tap first)
  await tdrag(p[0], p[1], p[0] + 30, p[1] - 20);
}, `__cmwShapes().shapes.some((x) => x.kind === 'circle') && __cmwView().main === 'phase'`);

const L = logs().filter((l) => /EXC|\[tour\]/i.test(l.t + l.m)).slice(0, 12);
check('no exceptions or tour warnings', !L.length, L);
return { pass: R.filter((r) => r[1]).length, of: R.length, fails: R.filter((r) => !r[1]), logs: L };
