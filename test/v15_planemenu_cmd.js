// The planes' context menu (src/planemenu.js; notes/ui-redesign-2/desktop/DESIGN.md 2.5, INTERFACE.md "Long-press"
// and "Keyboard and screen readers"), as issue #13 left it: a menu of objects only. Checks: a right-click (and a touch
// long-press) on a shape opens it with the head (the point and F there), one line integral, Hide and Delete (no
// Select); on empty plane, on X, Y, the deformation and the landscape, nothing opens (no Add zero / pole here, Add
// point here, Copy coordinates or Center view here); a zero mark keeps Remove, Turn into a pole, Edit; a right-click
// while drawing (a polygon's vertices, a left-button drag that draws) cancels the drawing and opens nothing; a
// double-click on empty plane centres the view there (X and Y), one on a shape does not; no menu after a pan, a pinch,
// a drag, a drawing or a slide after the ring; Shift+F10 opens it over a shape and says "Nothing here has a menu." over
// empty plane; light, dark and Russian.
// A command file for a CDP daemon (test/cdp_kit README):
//   python3 build.py && test/<you>_cdp/q.sh test/v15_planemenu_cmd.js
// Prints {pass, fails, info, shots}; screenshots go to <daemon folder>/shots/pm-*.png.
const fails = [], info = {}, shots = [];
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 400) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const exc = (l) => l.filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''));
const errs = [];
const grab = async () => { errs.push(...exc(await logs())); };
const H = (expr) => ev(`__cmwPlaneMenu().${expr}`);
const w2s = (side, re, im) => H(`w2s('${side}', ${re}, ${im})`);
const paneRect = (side) => ev(`(() => { const r = document.getElementById('overlay${side}').getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; })()`);
const menu = () => ev(`(() => { const p = document.querySelector('#popHost .pop.menu.pm'); if (!p) return null; return { role: p.getAttribute('role'), label: p.getAttribute('aria-label'), touch: p.classList.contains('pm-touch'), head: (p.querySelector('.pm-head') || {}).innerText || '', items: [...p.querySelectorAll('.mi')].map((b) => ({ id: b.dataset.pm, text: b.textContent, sub: (b.querySelector('.mi-sub') || {}).textContent || '', dis: b.disabled, role: b.getAttribute('role'), h: b.getBoundingClientRect().height })), focus: document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.pm || document.activeElement.id || document.activeElement.tagName : null }; })()`);
const anyMenu = () => ev(`!!document.querySelector('#popHost .pop.menu')`);
const closeAll = async () => { await key('Escape'); await settle(150); if (await anyMenu()) { await key('Escape'); await settle(150); } };
const rclick = async (x, y, mods = 0) => {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, modifiers: mods });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'right', buttons: 2, clickCount: 1, modifiers: mods });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'right', buttons: 0, clickCount: 1, modifiers: mods });
  await settle(250);
};
const pick = async (id, mods = 0) => {
  const r = await ev(`(() => { const b = document.querySelector('#popHost .pop.menu.pm .mi[data-pm="${id}"]'); if (!b) return null; const q = b.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; })()`);
  if (!r) return false;
  if (mods) await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Alt', code: 'AltLeft', windowsVirtualKeyCode: 18, modifiers: mods });
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r[0], y: r[1], modifiers: mods });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r[0], y: r[1], button: 'left', buttons: 1, clickCount: 1, modifiers: mods });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r[0], y: r[1], button: 'left', buttons: 0, clickCount: 1, modifiers: mods });
  if (mods) await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Alt', code: 'AltLeft', windowsVirtualKeyCode: 18, modifiers: 0 });
  await settle(300);
  return true;
};
const zpParams = async (k) => (await H('steps()'))[k - 1].params;
const hist = () => H('hist()');
const undo = async () => { await ev(`document.getElementById('undoBtn').click()`); await settle(300); };
const touchHold = async (x, y, ms, moveTo) => {
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  if (moveTo && moveTo.before) {
    for (let i = 1; i <= 6; i++) { await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (moveTo.before[0] * i) / 6, y: y + (moveTo.before[1] * i) / 6, id: 1 }] }); await sleep(16); }
  }
  await sleep(ms);
  let ex = x, ey = y;
  if (moveTo && moveTo.after) {
    for (let i = 1; i <= 6; i++) { ex = x + (moveTo.after[0] * i) / 6; ey = y + (moveTo.after[1] * i) / 6; await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: ex, y: ey, id: 1 }] }); await sleep(16); }
  }
  if (moveTo && moveTo.before) { ex = x + moveTo.before[0]; ey = y + moveTo.before[1]; }
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await settle(300);
};
const SHAPES = [{ id: 's1', kind: 'rect', a: [-1.5, -1], b: [-0.9, -0.4] }, { id: 's2', kind: 'circle', c: [0, 0], r: 0.5 }];
const CHAIN = [{ type: 'exp', params: {}, on: true }, { type: 'zp', params: { a: '1', zeros: '0.5', poles: '-0.5i' }, on: true }];
const ns = 'pm' + Date.now();
const ids = (mm) => (mm ? mm.items.map((i) => i.id) : []);
// (a Select item is offered only where shapes cover each other: UX42)
const NONE = /^(zp-add|zp-step|point-add|copy|center|shape-select)/;
const dbl = async (x, y) => {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  for (const n of [1, 2]) {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: n });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: n });
  }
  await settle(300);
};
const tool = async (t) => { await ev(`(() => { const b = document.querySelector('.tool[data-tool=${t}]'); b && b.click(); return 1; })()`); await settle(100); };

// ---------------------------------------------------------------------------------------------------------------
// 1. X → Y: a right-click on empty X opens nothing; on the circle, its menu
await view(1440, 900, false);
await load(ns + 'a', { shapes: SHAPES, steps: CHAIN, srcView: { cx: 0, cy: 0, s: 110 } });
await settle(1200); await grab();
let p = await w2s('L', 1.3, 0.9);
await rclick(p[0], p[1]);
ok('a right-click on empty X opens no menu', !(await anyMenu()), await menu());
await closeAll();
p = await w2s('L', 0.5, 0);
await rclick(p[0], p[1]);
let m = await menu();
info.x = m;
ok('a right-click on a shape opens the plane menu (role=menu, named by its point)', !!m && m.role === 'menu' && /z = /.test(m.label || '') && /F\(z\) = /.test(m.label || ''), m);
ok('the head shows z and F(z)', !!m && /^z = /.test(m.head) && /F\(z\) = /.test(m.head), m && m.head);
ok('on the circle: one integral, Hide and Delete, in that order', !!m && ids(m).filter((i) => i === 'integral').length === 1 && JSON.stringify(ids(m).filter((i) => /^(integral|shape-hide|shape-delete)$/.test(i))) === JSON.stringify(['integral', 'shape-hide', 'shape-delete']), ids(m));
ok('no Select, Add zero / pole, Add point, Copy coordinates or Center view here', !!m && !ids(m).some((i) => NONE.test(i)), ids(m));
ok('no construction tool launchers', !!m && !m.items.some((i) => /…$/.test(i.text.trim())), m && m.items.map((i) => i.text));
ok('every item is a menuitem, 30 px or more', !!m && m.items.every((i) => i.role === 'menuitem' && i.h >= 29.5), m && m.items.map((i) => i.h));
const ii = m && m.items.find((i) => i.id === 'integral');
ok('the integral item: ∮ F dz around Circle 1', !!ii && /∮ F dz around Circle 1/.test(ii.text), ii);
shots.push(await shot('pm-x-light'));
await pick('integral');
await settle(600);
const ip = await ev(`(() => { const p = document.querySelector('.int-pop'); return p ? p.innerText : null; })()`);
ok('it opens the integral popover', !!ip && /around Circle 1/.test(ip), ip);
await closeAll();
// Hide (one undo step), Delete
let h0 = await hist();
await rclick(p[0], p[1]);
await pick('shape-hide');
ok('Hide hides the circle (one undo step)', (await H('shapes()')).find((s) => s.id === 's2').visible === false && (await hist()).hi === h0.hi + 1);
await undo();
await rclick(p[0], p[1]);
await pick('shape-delete');
ok('Delete removes the circle', !(await H('shapes()')).some((s) => s.id === 's2'));
await undo();
ok('undo brings it back', (await H('shapes()')).some((s) => s.id === 's2'));
// Y: empty, and the deformation plane: nothing
let R = await paneRect('R');
await rclick(R.l + 30, R.t + 30);
ok('Y: a right-click on empty plane opens nothing', !(await anyMenu()), await menu());
await closeAll();
await ev('__cmwMorph({ open: true, T: 0.5 })'); await settle(800);
R = await paneRect('R');
await rclick(R.l + 30, R.t + 30);
ok('the deformation plane: nothing', !(await anyMenu()), await menu());
await closeAll();
await ev('__cmwMorph({ open: false })'); await settle(500);
// the landscape and Phase over empty X: nothing
await ev(`__cmwSetMain('land'), 1`); await settle(1500);
let L = await paneRect('L');
await rclick(L.cx, L.cy + 40);
ok('Landscape: nothing', !(await anyMenu()), await menu());
await closeAll();
await ev(`__cmwSetMain('phase'), 1`); await settle(1200);
p = await w2s('L', 1.3, 0.9);
await rclick(p[0], p[1]);
ok('Phase, empty: nothing', !(await anyMenu()), await menu());
await closeAll();
await ev(`__cmwSetMain('xy'), 1`); await settle(800);
await grab();

// ---------------------------------------------------------------------------------------------------------------
// 2. a zero mark (step 1, zeros and poles alone) keeps its own items
await load(ns + 'b', { shapes: [{ id: 's1', kind: 'disc', c: [0, 1.2], r: 0.8 }], steps: [{ type: 'zp', params: { a: '1', zeros: '1, -1', poles: '0' }, on: true }], srcView: { cx: 0, cy: 0, s: 110 } });
await settle(1200); await grab();
const hd = await ev(`__cmwZp().handles.find((q) => q.kind === 'zeros' && q.i === 0)`);
await rclick(hd.x, hd.y);
m = await menu();
info.mark = m;
ok('on a zero mark: Remove ζ₁, Turn into a pole, Edit ζ₁', !!m && JSON.stringify(ids(m)) === JSON.stringify(['zp-remove', 'zp-swap', 'zp-edit']) && /Remove ζ₁/.test(m.items[0].text), ids(m));
h0 = await hist();
await pick('zp-swap');
let P = await zpParams(1);
ok('Turn into a pole: ζ₁ = 1 becomes a pole (one undo step)', P.zeros.split(',').map((s) => s.trim()).join(',') === '-1' && P.poles.split(',').map((s) => s.trim()).join(',') === '0,1' && (await hist()).hi === h0.hi + 1, P);
await undo();
await rclick(hd.x, hd.y);
await pick('zp-remove');
P = await zpParams(1);
const toastTxt = await ev(`(document.querySelector('#toastHost') || {}).innerText || ''`);
ok('Remove ζ₁ removes it, with an Undo toast', P.zeros.split(',').length === 1 && /Undo/i.test(toastTxt), { P, toastTxt });
await undo();
ok('undo brings it back', (await zpParams(1)).zeros.split(',').length === 2);
// empty plane with a zeros-and-poles step: still nothing (no Add zero here)
p = await w2s('L', 0.3, -0.7);
await rclick(p[0], p[1]);
ok('empty X with a zeros-and-poles step: nothing', !(await anyMenu()), await menu());
await closeAll();
// no zeros-and-poles step: no offer to make one
await load(ns + 'b2', { shapes: [], steps: [{ type: 'exp', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 110 } });
await settle(1200);
p = await w2s('L', 0.3, -0.7);
await rclick(p[0], p[1]);
ok('no zeros-and-poles step: nothing (no Add a zeros-and-poles step)', !(await anyMenu()), await menu());
await closeAll();
await grab();

// ---------------------------------------------------------------------------------------------------------------
// 3. double-click: empty plane centres the view there; a shape, or a drawing tool, leaves it
await load(ns + 'c', { shapes: SHAPES, steps: CHAIN, srcView: { cx: 0, cy: 0, s: 110 } });
await settle(1200);
await tool('select');
let v0 = await H(`view('L')`);
p = await w2s('L', 0.5, 0);
await dbl(p[0], p[1]);
let v1 = await H(`view('L')`);
ok('a double-click on a shape leaves the view', Math.abs(v1.cx - v0.cx) < 1e-9 && Math.abs(v1.cy - v0.cy) < 1e-9, { v0, v1 });
p = await w2s('L', 1.2, 0.8);
let z0 = await H(`s2w('L', ${p[0]}, ${p[1]})`);
await dbl(p[0], p[1]);
v1 = await H(`view('L')`);
ok('a double-click on empty X centres the view there', Math.abs(v1.cx - z0[0]) < 1e-9 && Math.abs(v1.cy - z0[1]) < 1e-9 && v1.s === v0.s, { v0, v1, z0 });
ok('a double-click opens no menu', !(await anyMenu()));
// (Y is the classic view's right pane, the image of the chain; the steps view's equivalent is its last plane, in the one pane)
const yPane = (await ev(`document.documentElement.classList.contains('sv')`)) ? 'L' : 'R';
if (yPane === 'L') { await ev(`__cmwSteps({ go: __cmwSteps().planes.length - 1, now: true })`); await settled({ until: '!__cmwSteps().moving' }); }
R = await paneRect(yPane);
const vr0 = await H(`view('${yPane}')`);
const zr = await H(`s2w('${yPane}', ${R.l + 60}, ${R.t + 60})`);
await dbl(R.l + 60, R.t + 60);
const vr1 = await H(`view('${yPane}')`);
ok('a double-click on empty Y centres Y there', Math.abs(vr1.cx - zr[0]) < 1e-9 && Math.abs(vr1.cy - zr[1]) < 1e-9, { vr0, vr1, zr });
if (yPane === 'L') { await ev(`__cmwSteps({ go: 0, now: true })`); await settled({ until: '!__cmwSteps().moving' }); }
await tool('point');
const nS0 = (await H('shapes()')).length;
v0 = await H(`view('L')`);
p = await w2s('L', v0.cx - 0.7, v0.cy + 0.4);
await dbl(p[0], p[1]);
v1 = await H(`view('L')`);
ok('a double-click with the Point tool places points and leaves the view', (await H('shapes()')).length > nS0 && Math.abs(v1.cx - v0.cx) < 1e-9, { v0, v1 });
await tool('select');
await grab();

// ---------------------------------------------------------------------------------------------------------------
// 4. a right-click while drawing cancels the drawing and opens nothing
await load(ns + 'd', { shapes: [], steps: CHAIN, srcView: { cx: 0, cy: 0, s: 110 } });
await settle(1200);
await tool('polygon');
for (const [re, im] of [[-1, -0.5], [0.5, -0.6], [0.2, 0.7]]) { const q = await w2s('L', re, im); await click(q[0], q[1]); await sleep(400); }
let nS = (await H('shapes()')).length;
ok('the polygon has a draft', (await H('drag()')) === null && nS === 0);
p = await w2s('L', 1.3, 0.9);
await rclick(p[0], p[1]);
ok('a right-click during a polygon cancels it, no menu', !(await anyMenu()) && (await H('shapes()')).length === 0, await menu());
// the next click starts a new polygon: one vertex, Enter closes nothing
p = await w2s('L', -1, 0.5);
await click(p[0], p[1]); await sleep(400);
await key('Enter'); await settle(200);
ok('the cancelled vertices are gone (a new click starts afresh)', (await H('shapes()')).length === 0);
await key('Escape'); await settle(100);
// a left-button drag that draws a disc, with the right button pressed during it
await tool('disc');
L = await paneRect('L');
const x0 = L.cx + 60, y0 = L.cy + 60;
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0, y: y0 });
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x0, y: y0, button: 'left', buttons: 1, clickCount: 1 });
for (let i = 1; i <= 6; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0 + i * 8, y: y0, button: 'left', buttons: 1 }); await sleep(16); }
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x0 + 48, y: y0, button: 'right', buttons: 3, clickCount: 1 });
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x0 + 48, y: y0, button: 'right', buttons: 1, clickCount: 1 });
await sleep(100);
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x0 + 48, y: y0, button: 'left', buttons: 0, clickCount: 1 });
await settle(300);
ok('a right-click during a drag that draws cancels it, no menu', !(await anyMenu()) && (await H('shapes()')).length === 0, { menu: await menu(), shapes: await H('shapes()') });
// a right-drag during a polygon still pans (the polygon stays)
await tool('polygon');
for (const [re, im] of [[-1, -0.5], [0.5, -0.6]]) { const q = await w2s('L', re, im); await click(q[0], q[1]); await sleep(400); }
v0 = await H(`view('L')`);
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: L.cx - 150, y: L.cy + 150 });
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: L.cx - 150, y: L.cy + 150, button: 'right', buttons: 2, clickCount: 1 });
for (let i = 1; i <= 8; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: L.cx - 150 + i * 8, y: L.cy + 150, button: 'right', buttons: 2 }); await sleep(16); }
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: L.cx - 86, y: L.cy + 150, button: 'right', buttons: 0, clickCount: 1 });
await settle(300);
v1 = await H(`view('L')`);
const q3 = await w2s('L', 0.2, 0.7);
await click(q3[0], q3[1]); await sleep(400);
await key('Enter'); await settle(300);
ok('a right-drag during a polygon pans and keeps it (Enter then closes it)', Math.abs(v1.cx - v0.cx) > 0.3 && (await H('shapes()')).length === 1, { v0, v1, n: (await H('shapes()')).length });
await tool('select');
await grab();

// ---------------------------------------------------------------------------------------------------------------
// 5. no interference: a right-drag pan, a left-drag pan, a drawing, a mark drag open no menu
await load(ns + 'e', { shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 0.8 }], steps: [{ type: 'zp', params: { a: '1', zeros: '1, -1', poles: '0' }, on: true }], srcView: { cx: 0, cy: 0, s: 110 } });
await settle(1200);
L = await paneRect('L');
const hz = await ev(`__cmwZp().handles.find((q) => q.kind === 'zeros' && q.i === 0)`);
await drag(hz.x, hz.y, hz.x + 30, hz.y - 20, 8, 16);
await settle(300);
const zp0 = await zpParams(1);
ok('dragging a mark moves it, no menu', !(await anyMenu()) && zp0.zeros.split(',')[0].trim() !== '1', { hz, zp0 });
v0 = await H(`view('L')`);
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: L.cx - 150, y: L.cy + 150 });
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: L.cx - 150, y: L.cy + 150, button: 'right', buttons: 2, clickCount: 1 });
for (let i = 1; i <= 8; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: L.cx - 150 + i * 8, y: L.cy + 150, button: 'right', buttons: 2 }); await sleep(16); }
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: L.cx - 86, y: L.cy + 150, button: 'right', buttons: 0, clickCount: 1 });
await settle(300);
v1 = await H(`view('L')`);
ok('a right-drag pans and opens no menu', !(await anyMenu()) && Math.abs(v1.cx - v0.cx) > 0.3, { v0, v1 });
await closeAll();
v0 = v1;
await drag(L.cx - 150, L.cy + 150, L.cx - 100, L.cy + 120, 8, 16);
await settle(300);
v1 = await H(`view('L')`);
ok('a left-drag pans, no menu', !(await anyMenu()) && Math.abs(v1.cx - v0.cx) > 0.3, { v0, v1 });
await tool('disc');
nS = (await H('shapes()')).length;
await drag(L.cx + 100, L.cy + 100, L.cx + 140, L.cy + 100, 8, 16);
await settle(300);
ok('drawing a disc draws it, no menu', !(await anyMenu()) && (await H('shapes()')).length === nS + 1);
await tool('select');
await grab();

// ---------------------------------------------------------------------------------------------------------------
// 6. keyboard: Shift+F10 over a shape (the pointer's last place) opens it; over empty plane, a spoken note
await load(ns + 'f', { shapes: SHAPES, steps: CHAIN, srcView: { cx: 0, cy: 0, s: 110 } });
await settle(1200);
const f10 = async () => {
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'F10', code: 'F10', windowsVirtualKeyCode: 121, modifiers: 8 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'F10', code: 'F10', windowsVirtualKeyCode: 121, modifiers: 8 });
  await settle(250);
};
const focusX = () => ev(`document.activeElement && document.activeElement.blur(); const o = document.getElementById('overlayL'); if (!o.hasAttribute('tabindex')) o.tabIndex = 0; o.focus(); 1`);
p = await w2s('L', 0.5, 0);
await move(p[0], p[1]); await settle(100);
await focusX(); await settle(100);
await f10();
m = await menu();
ok('Shift+F10 over the circle opens its menu, the first item focused', !!m && ids(m).includes('shape-hide') && m.focus === m.items.find((i) => !i.dis).id, m);
await key('ArrowDown'); await settle(80);
const m2 = await menu();
ok('arrows move between items', !!m2 && m2.focus !== m.focus, [m && m.focus, m2 && m2.focus]);
await key('Escape'); await settle(200);
const fe = await ev(`document.activeElement && document.activeElement.id`);
ok('Esc closes it and the focus goes back to the plane', !(await anyMenu()) && fe === 'overlayL', fe);
p = await w2s('L', 1.3, 0.9);
await move(p[0], p[1]); await settle(100);
await focusX(); await settle(100);
await f10(); await settle(200);
const live = await ev(`(document.getElementById('pmLive') || {}).textContent || ''`);
ok('Shift+F10 over empty plane opens nothing and says so', !(await anyMenu()) && live === 'Nothing here has a menu.', live);
await closeAll();
await grab();

// ---------------------------------------------------------------------------------------------------------------
// 7. touch (390 px phone): a long press on a shape opens the menu on release; on empty plane, a move first, a slide
// after the ring: nothing
await view(390, 844, false, true);
await load(ns + 'g', { shapes: [{ id: 's2', kind: 'circle', c: [0, 0], r: 0.8 }], steps: CHAIN, srcView: { cx: 0, cy: 0, s: 60 } });
await settle(1500); await grab();
L = await paneRect('L');
info.phonePane = L;
const gap = () => sleep(700);   // (gestures apart: no double tap)
v0 = await H(`view('L')`);
await touchHold(L.l + L.w / 2 - 60, L.t + L.h * 0.25, 650, { before: [40, 0] });   // (review regress-2: clear of the phone's inset, bottom-left)
v1 = await H(`view('L')`);
ok('touch: a pan first (40 px) pans and opens nothing', !(await anyMenu()) && Math.abs(v1.cx - v0.cx) > 0.2, { v0, v1 });
await gap();
// (a point of the circle away from its handles: a tap selects it, and its radius handle is at angle 0)
p = await w2s('L', 0.8 * Math.cos(2), 0.8 * Math.sin(2));
await touchHold(p[0], p[1], 250);
ok('touch: a short press opens nothing', !(await anyMenu()));
await gap();
await touchHold(p[0], p[1], 650);
m = await menu();
info.touch = m;
ok('touch: a long press on the circle opens its menu on release (44 px rows)', !!m && m.touch && ids(m).includes('shape-hide') && m.items.every((i) => i.h >= 43.5), m);
shots.push(await shot('pm-phone-light'));
await closeAll();
await gap();
const pe = await w2s('L', 0.2, 0.3);
await touchHold(pe[0], pe[1], 650);
ok('touch: a long press on empty plane opens nothing', !(await anyMenu()), await menu());
await gap();
await touchHold(L.cx, L.cy + 40, 650, { after: [50, 30] });
ok('touch: a slide after the ring probes and opens nothing', !(await anyMenu()));
const ringLeft = await ev(`document.querySelectorAll('.pm-ring').length`);
ok('touch: no ring left behind', ringLeft === 0, ringLeft);
await gap();
// a pinch is never a menu
await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: L.cx - 40, y: L.cy, id: 1 }, { x: L.cx + 40, y: L.cy, id: 2 }] });
await sleep(600);
await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: L.cx - 60, y: L.cy, id: 1 }, { x: L.cx + 60, y: L.cy, id: 2 }] });
await sleep(50);
await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await settle(300);
ok('touch: a held pinch opens nothing', !(await anyMenu()));
await grab();

// ---------------------------------------------------------------------------------------------------------------
// 8. dark and Russian
await view(1440, 900, true);
await load(ns + 'h', { shapes: SHAPES, steps: CHAIN, srcView: { cx: 0, cy: 0, s: 110 } });
await settle(1200);
p = await w2s('L', 0.5, 0);
await rclick(p[0], p[1]);
m = await menu();
ok('dark: the menu opens', !!m && ids(m).includes('shape-hide'));
shots.push(await shot('pm-x-dark'));
await closeAll();
await view(1440, 900, false);
await nav(`http://localhost:${(/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1]}/test.html?ns=${ns}h&lang=ru`);
await settle(1500);
p = await w2s('L', 0.5, 0);
await rclick(p[0], p[1]);
m = await menu();
info.ru = m;
ok('Russian: every item in Russian', !!m && m.items.length >= 3 && m.items.every((i) => !/[A-Za-z]{4,}/.test(i.text.replace(/Circle|Rectangle/g, ''))), m && m.items.map((i) => i.text));
ok('Russian: the decimal comma in the head', !!m && /0,50/.test(m.head), m && m.head);
shots.push(await shot('pm-x-ru'));
await closeAll();
const missing = await ev(`[...(I18N.missing || [])].filter((k) => /menu|Remove|Turn|Hide|Delete|Reset|Integrate|around|Listen|Shape hidden/i.test(k))`);
ok('Russian: no lookup misses for the menu', Array.isArray(missing) && missing.length === 0, missing);
await grab();

// ---- UX42: shapes that cover each other: the menu lists every one under the pointer, Bring to front / Send to back;
// Alt-click cycles; list rows drag to reorder
await load(ns + 'o', { shapes: [{ id: 'd1', kind: 'disc', c: [0, 0], r: 0.8 }, { id: 'd2', kind: 'disc', c: [0.3, 0], r: 0.8 }], steps: CHAIN, srcView: { cx: 0, cy: 0, s: 110 } });
await settle(900);
const ov = await w2s('L', 0.1, 0);
await rclick(ov[0], ov[1]);
m = await menu();
const sel = m ? m.items.filter((i) => i.id === 'shape-select') : [];
ok('UX42 two discs under the pointer: "Select …" for each, by name', sel.length === 2 && sel.every((i) => /^Select Disc \d/.test(i.text.trim())), m && m.items.map((i) => i.text));
ok('UX42 the top disc: Send to back, no Bring to front', ids(m).includes('shape-back') && !ids(m).includes('shape-front'), ids(m));
const hOv = await hist();
await pick('shape-back');
const ord = (await ev('__cmwShapes()')).shapes.map((x) => x.id);
ok('UX42 Send to back puts the top disc first in the list, one undo step', JSON.stringify(ord) === JSON.stringify(['d2', 'd1']) && (await hist()).hi === hOv.hi + 1, [ord, await hist()]);
await rclick(ov[0], ov[1]);
m = await menu();
ok('UX42 the disc now on top has Send to back again, and no Bring to front', ids(m).includes('shape-back') && !ids(m).includes('shape-front'), ids(m));
const pickOther = m && m.items.find((i) => i.id === 'shape-select' && !i.disabled);
await closeAll();
const aclick = async (x, y, alt) => {
  const mods = alt ? 1 : 0;
  if (alt) await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Alt', code: 'AltLeft', windowsVirtualKeyCode: 18, modifiers: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, modifiers: mods });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1, modifiers: mods });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1, modifiers: mods });
  if (alt) await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Alt', code: 'AltLeft', windowsVirtualKeyCode: 18, modifiers: 0 });
  await settle(250);
  return (await ev('__cmwShapes()')).selected;
};
await ev(`__cmwSelect(null)`); await settle(200);
const c0 = await aclick(ov[0], ov[1], false), c1 = await aclick(ov[0], ov[1], true), c2 = await aclick(ov[0], ov[1], true);
ok('UX42 Alt-click cycles through the shapes under the pointer and round again', !!c0 && !!c1 && c1 !== c0 && c2 === c0, [c0, c1, c2]);
ok('UX42 a pick from the menu is a selection', !!pickOther, pickOther);
const dnd = await ev(`(() => { const box = (id) => document.querySelector('#shapeList .shape[data-id="' + id + '"]'); const a = box('d2'), b = box('d1'); if (!a || !b) return null; const dt = new DataTransfer(); const ev = (t, el) => el.dispatchEvent(new DragEvent(t, { bubbles: true, cancelable: true, dataTransfer: dt })); ev('dragstart', a); ev('dragover', b); ev('drop', b); ev('dragend', a); return __cmwShapes().shapes.map((x) => x.id); })()`);
ok('UX42 a dragged shape row dropped on another takes its place', JSON.stringify(dnd) === JSON.stringify(['d1', 'd2']), dnd);

ok('no console errors', errs.length === 0, errs.slice(0, 6));
return { pass: fails.length === 0, fails, info: { x: info.x && info.x.items.map((i) => i.text), ru: info.ru && info.ru.items.map((i) => i.text), mark: info.mark && info.mark.items.map((i) => i.text), touch: info.touch && info.touch.items.map((i) => i.text), phonePane: info.phonePane }, shots };
