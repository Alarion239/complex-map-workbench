// The steps view takes the shape keys the classic page has: ⌘D duplicates the selected shape, the arrows move it
// (Shift: ten steps) instead of stepping the chain, ⌘[ and ⌘] send it back and bring it forward; and a right click on a
// step's chip or a Shapes row opens its ⋯ menu at the pointer; and the toast a run of nudges ends with, the shape and its
// centre, holds at dpr 2, in the dark theme and at 1024 and 768 px wide. A command file for a CDP daemon (test/cdp_kit
// README); prints { pass, of, fails }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const R = [];
const check = (name, pass, detail) => R.push([name, !!pass, detail]);
const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'h1', kind: 'halfplane', a: [0, 0], b: [1, 0], ci: 0, visible: true }, { id: 'h2', kind: 'halfplane', a: [0, 1], b: [1, 1], ci: 1, visible: true }],
  steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, { type: 'pown', params: { n: 3 }, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } };
await view(1440, 900, false, false);
const ns = 'svkeys' + Date.now();
await seed(ns, st);
await go(`http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps`);
const idle = `__cmwSteps().on && !__cmwSteps().moving && !!document.querySelector('#paneL canvas')`;
await settled({ max: 30000, until: idle });
check('the page is the steps view', await ev('!!__cmwSteps().on'));
const shapes = () => ev(`JSON.stringify(__cmwShapes().shapes)`);
const ids = () => ev(`__cmwShapes().shapes.map((s) => s.id)`);
const sel = () => ev(`__cmwShapes().selected`);
const KC = { ArrowLeft: 37, ArrowRight: 39, ArrowUp: 38, ArrowDown: 40, d: 68, '[': 219, ']': 221, Escape: 27 };
// every wait is a poll of what the check needs, bounded by a deadline; a key is done when the next frame has drawn
const until = (expr, max = 8000) => settled({ max, only: true, until: expr });
const frame = () => ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
const press = async (k, modifiers = 0) => { const p = { key: k, code: /^[a-z]$/.test(k) ? 'Key' + k.toUpperCase() : k, modifiers, windowsVirtualKeyCode: KC[k] || 0 }; await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...p }); await send('Input.dispatchKeyEvent', { type: 'keyUp', ...p }); await frame(); };
const box = (sel) => ev(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(sel)})].find((x) => x.getClientRects().length); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; })()`);
const mid = (b) => [b.l + b.w / 2, b.t + b.h / 2];
const menu = `document.querySelector('#popHost .pop.menu')`;
const rclick = async (x, y) => { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'right', buttons: 2, clickCount: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'right', buttons: 0, clickCount: 1 }); await until(`!!${menu}`, 3000); };
const closeMenu = async () => { await press('Escape'); await until(`!${menu}`, 3000); };
const onPlane = () => ev(`(() => { const c = document.querySelector('#paneL canvas'); c.tabIndex = 0; c.focus(); return document.activeElement === c; })()`);
const stepNow = () => ev('__cmwSteps().i');
const calm = () => until('!__cmwSteps().moving');

await ev(`__cmwSelect('h1')`);
await until(`__cmwShapes().selected === 'h1'`);
check('the plane has focus', await onPlane());
const i0 = await stepNow();
const s0 = await shapes();
await press('ArrowRight');
check('an arrow moves the selected shape', (await shapes()) !== s0, null);
check('and does not step the chain', (await stepNow()) === i0, i0);
const s1 = await shapes();
await press('ArrowUp', 8);
check('Shift + an arrow moves it ten steps', (await shapes()) !== s1, null);
await press('ArrowRight'); await press('ArrowRight');
const sRun = await shapes();
await until(`[...document.querySelectorAll('#toastHost .toast')].some((t) => /^Moved .+[.]$/.test(t.textContent) && !/undefined/.test(t.textContent))`, 5000);
check('the shape\'s place is said once the nudges stop', await ev(`[...document.querySelectorAll('#toastHost .toast')].some((t) => /^Moved .+[.]$/.test(t.textContent) && !/undefined/.test(t.textContent))`), await ev(`document.getElementById('toastHost').textContent`));
await ev(`document.getElementById('undoBtn').click()`);
await until(`__cmwShapes().shapes.length > 0 && JSON.stringify(__cmwShapes().shapes) === ${JSON.stringify(s0)}`, 3000);
check('a run of nudges is one undo step', (await shapes()) === s0, null);
await ev(`document.getElementById('redoBtn').click()`);
await until(`JSON.stringify(__cmwShapes().shapes) === ${JSON.stringify(sRun)}`, 3000);
await onPlane();
const n0 = (await ids()).length;
await press('d', 4);
await until(`__cmwShapes().shapes.length === ${n0 + 1}`, 3000);
const after = await ids();
check('⌘D duplicates the selected shape and selects the copy', after.length === n0 + 1 && (await sel()) !== 'h1', { after });
const copy = await sel();
await press('[', 4);
await until(`__cmwShapes().shapes.map((s) => s.id).indexOf(${JSON.stringify(copy)}) === __cmwShapes().shapes.length - 2`, 3000);
const sent = await ids();
check('⌘[ sends it backward', sent.indexOf(copy) === sent.length - 2, sent);
await press(']', 4);
await until(`__cmwShapes().shapes.map((s) => s.id).indexOf(${JSON.stringify(copy)}) === __cmwShapes().shapes.length - 1`, 3000);
const fwd = await ids();
check('⌘] brings it forward', fwd.indexOf(copy) === fwd.length - 1, fwd);

// off the plane (the page body) the arrows step the chain even with a shape selected
await ev(`document.activeElement && document.activeElement.blur(), document.body.focus(), 1`);
const sb = await shapes(), jb = await stepNow();
await press('ArrowRight');
await until(`__cmwSteps().i !== ${jb}`);
await calm();
check('off the plane an arrow steps the chain and leaves the shape', (await stepNow()) !== jb && (await shapes()) === sb, jb);
// Esc deselects, and then the arrows on the plane step the chain
await onPlane();
await press('Escape');
await until('__cmwShapes().selected === null', 3000);
check('Esc deselects the shape', (await sel()) === null, await sel());
await onPlane();
const j0 = await stepNow();
await press('ArrowRight');
await until(`__cmwSteps().i !== ${j0}`);
await calm();
check('with no shape selected an arrow on the plane steps the chain', (await stepNow()) !== j0, j0);

// the right click
await until(`!!document.querySelector('#shapeList .shape[data-id="h1"] .shape-name')`, 3000);
const rowB = await box('#shapeList .shape[data-id="h1"] .shape-name');
if (rowB) await rclick(...mid(rowB));
let g = await ev(`(() => { const p = ${menu}; if (!p) return null; const b = p.getBoundingClientRect(); return { x: b.left, y: b.top, n: p.querySelectorAll('.mi').length }; })()`);
check('a right click on a Shapes row opens its ⋯ menu at the pointer', rowB && g && g.n > 2 && Math.abs(g.x - (mid(rowB)[0] + 2)) < 4, { rowB, g });
await closeMenu();
const cb = await box('.sv-step[data-k="1"] .sv-fchip');
if (cb) await rclick(...mid(cb));
g = await ev(`(() => { const p = ${menu}; if (!p) return null; return { n: p.querySelectorAll('.mi').length, t: p.textContent }; })()`);
check('a right click on a step\'s chip opens its ⋯ menu', cb && g && g.n > 3 && /Move right/.test(g.t), g);
await closeMenu();

// the shape's place said after a run of nudges, in other settings: at dpr 2, in the dark theme and at 1024 and 768 px wide. On each the
// toast names the shape and its centre as the state has them, lies whole inside the window, above the chain, covers no control, and
// reads at 4.5:1 (WCAG AA) against its own background
const { LUM_JS } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'contrast.js'), 'utf8'))();
// what the toast's checks read of an element, as a function for the page: whether it lies inside the window and above the chain, the
// controls it covers, and the contrast of its text against its own background (the toast's is opaque, so its alpha is not read)
const MEASURE = `(t) => {
  const r = t.getBoundingClientRect(), cs = getComputedStyle(t), strip = document.getElementById('svStrip').getBoundingClientRect();
  ${LUM_JS}
  const rgb = (s) => s.match(/[0-9.]+/g).slice(0, 3).map(Number), covered = [];
  for (const e of document.querySelectorAll('button, input, select, [role=slider]')) {
    if (!e.getClientRects().length || t.contains(e) || e.closest('#toastHost') || getComputedStyle(e).visibility === 'hidden') continue;
    const q = e.getBoundingClientRect();
    if (q.width && q.height && q.left < r.right && q.right > r.left && q.top < r.bottom && q.bottom > r.top) covered.push((e.id || e.className || e.tagName).toString().slice(0, 30));
  }
  return { inside: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, aboveChain: r.bottom <= strip.top, covered, contrast: ratio(rgb(cs.color), rgb(cs.backgroundColor)) };
}`;
const SETTINGS = [['dpr 2', 1440, 900, 2, false], ['dark theme', 1440, 900, 1, true], ['1024 px', 1024, 768, 1, false], ['768 px', 768, 1024, 1, false]];
const AA = 4.5;
const stDisc = Object.assign({}, st, { shapes: [{ id: 'd1', kind: 'disc', c: [0.5, 0.5], r: 0.6, ci: 1, visible: true }] });
for (const [name, w, h, dpr, dark] of SETTINGS) {
  await view(w, h, dark, false);
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile: false });
  const nsS = 'svkeysS' + w + dpr + Date.now();
  await seed(nsS, stDisc);
  await go(`http://localhost:${PORT}/test.html?ns=${nsS}&lang=en&view=steps`);
  await settled({ max: 30000, until: idle });
  await ev(`__cmwSelect('d1')`);
  await until(`__cmwShapes().selected === 'd1'`);
  await onPlane();
  await press('ArrowRight'); await press('ArrowRight');
  // (the toast of the settled run: a slow press can let the one for the first nudge show before the second, so the wait is for the toast that matches the state now, in place)
  const toastUp = `(() => { const t = document.querySelector('#toastHost .toast'), c = __cmwShapes().shapes.find((x) => x.id === 'd1').c; return !!t && t.textContent.startsWith('Moved Disc 1 to ' + (c[0] < 0 ? '−' : '') + Math.abs(c[0]).toFixed(3) + ' ' + (c[1] < 0 ? '−' : '+') + ' ' + Math.abs(c[1]).toFixed(3) + 'i.') && getComputedStyle(t).opacity === '1' && getComputedStyle(t).translate === 'none'; })()`;
  await until(toastUp, 8000);
  const m = await ev(`(() => { const t = document.querySelector('#toastHost .toast'), c = __cmwShapes().shapes.find((x) => x.id === 'd1').c;
    return Object.assign({ text: t.textContent, want: 'Moved Disc 1 to ' + (c[0] < 0 ? '−' : '') + Math.abs(c[0]).toFixed(3) + ' ' + (c[1] < 0 ? '−' : '+') + ' ' + Math.abs(c[1]).toFixed(3) + 'i.', dpr: devicePixelRatio, dark: matchMedia('(prefers-color-scheme: dark)').matches }, (${MEASURE})(t)); })()`);
  check(`${name}: the toast says the shape and its centre, as the state has them`, m.text.replace(/\s*×?$/, '') === m.want && m.dpr === dpr && m.dark === dark, m);
  check(`${name}: the toast lies whole inside the window, above the chain, covering no control`, m.inside && m.aboveChain && m.covered.length === 0, m);
  check(`${name}: the toast's words reach ${AA}:1 against its background`, m.contrast >= AA, m);
  await until(`!document.querySelector('#toastHost .toast')`, 9000);
}
// the measure can fail: a box past the window's edge, one below the chain's top, one over a control and one of 1:1 contrast are each read
// as what they are (on the last page above, 768 px wide)
const probe = (css) => ev(`(() => { const d = document.createElement('div'); d.textContent = 'probe'; d.style.cssText = 'position:fixed;color:#000;background:#fff;' + ${JSON.stringify(css)}; document.body.append(d); const m = (${MEASURE})(d); d.remove(); return m; })()`);
const away = await probe('left:calc(100vw - 20px);top:100px;width:200px;height:30px');
check('the measure reads a box past the window edge as outside', away.inside === false, away);
const low = await probe('left:300px;top:calc(100vh - 10px);width:200px;height:8px');
check('the measure reads a box below the chain\'s top as not above the chain', low.aboveChain === false, low);
const over = await ev(`(() => { const b = document.getElementById('undoBtn').getBoundingClientRect(), d = document.createElement('div'); d.style.cssText = 'position:fixed;left:' + b.left + 'px;top:' + b.top + 'px;width:' + b.width + 'px;height:' + b.height + 'px'; document.body.append(d); const m = (${MEASURE})(d); d.remove(); return m; })()`);
check('the measure reads a box over a control as covering it', over.covered.length > 0, over);
const flat = await probe('left:300px;top:100px;width:200px;height:30px;color:#777;background:#777');
check('the measure reads text on its own colour as no contrast', flat.contrast < AA, flat);
const fails = R.filter((r) => !r[1]);
return { pass: R.length - fails.length, of: R.length, fails };
