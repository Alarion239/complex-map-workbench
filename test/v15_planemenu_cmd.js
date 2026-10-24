// The planes' context menu (v15, src/planemenu.js; notes/ui-redesign-2/desktop/DESIGN.md 2.5, INTERFACE.md "Long-press"
// and "Keyboard and screen readers"). Checks: a right-click and a touch long-press open it on X, Y, the deformation,
// the globes (only where a point is) and the landscape; the head shows the point and F there; "Add zero / pole of fₖ
// here" for step 1, after exp (with "also at z + 2πik") and after a Möbius step, and the clicked point really becomes a
// zero or pole of F (F evaluated there); new marks snap to the ruler, Alt places them freely; one undo step per action;
// the mark's own items (Remove, Turn into a pole); the old integral items; no menu after a pan, a pinch, a drag, a
// drawing or a slide after the ring; Shift+F10 and Esc with the focus coming back; light, dark and Russian.
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
const lastZ = () => ev(`(() => { const c = PlaneMenu.lastCtx; return c ? { z: [c.z.re, c.z.im], free: [c.zFree.re, c.zFree.im], exact: [c.zExact.re, c.zExact.im] } : null; })()`);
const Fat = async (n, z) => H(`stage(${n}, ${z[0]}, ${z[1]})`);
const isInf = (F) => F[0] === null || F[1] === null || Math.hypot(F[0], F[1]) > 1e12;   // (JSON turns ∞ and NaN into null)
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
const CHAIN3 = [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' }, on: true }, { type: 'zp', params: { a: '1', zeros: '0.5', poles: '-0.5i' }, on: true }];
const SHAPES = [{ id: 's1', kind: 'rect', a: [-1.5, -1], b: [1.5, 1] }, { id: 's2', kind: 'circle', c: [0, 0], r: 0.5 }];
const ns = 'pm' + Date.now();

// ---------------------------------------------------------------------------------------------------------------
// 1. X → Y, exp · Möbius · zeros and poles: right-click on X
await view(1440, 900, false);
await load(ns + 'a', { shapes: SHAPES, steps: CHAIN3, srcView: { cx: 0, cy: 0, s: 110 } });
await settle(1200); await grab();
let p = await w2s('L', 0.83, 0.57);
await rclick(p[0], p[1]);
let m = await menu();
info.x = m;
ok('right-click on X opens the plane menu (role=menu, named by its point)', !!m && m.role === 'menu' && /z = /.test(m.label || '') && /F\(z\) = /.test(m.label || ''), m);
ok('the head shows z and F(z)', !!m && /^z = /.test(m.head) && /F\(z\) = /.test(m.head), m && m.head);
const ids = (mm) => (mm ? mm.items.map((i) => i.id) : []);
ok('groups in order: the object, Add zero/pole of f₃, Add point, Copy, Center', !!m && JSON.stringify(ids(m).filter((i) => /^(shape-select|zp-add-zeros-3|zp-add-poles-3|point-add|copy|center)$/.test(i))) === JSON.stringify(['shape-select', 'zp-add-zeros-3', 'zp-add-poles-3', 'point-add', 'copy', 'center']), ids(m));
const zi = m && m.items.find((i) => i.id === 'zp-add-zeros-3');
ok('Add zero of f₃ here, with "also at z + 2πik" (after exp)', !!zi && /Add zero of f₃ here/.test(zi.text) && /also at z \+ 2πik/.test(zi.sub), zi);
ok('every item is a menuitem, 30 px or more', !!m && m.items.every((i) => i.role === 'menuitem' && i.h >= 29.5), m && m.items.map((i) => i.h));
ok('no Constructions group (v16)', !!m && !m.items.some((i) => /circle through|midpoint|intersect/i.test(i.text)), ids(m));
shots.push(await shot('pm-x-light'));
let c = await lastZ();
const minor = 0.1;   // 110 px per unit: the bottom ruler's major division 1, minor 0.1
ok('the point snaps to the ruler (minor division 0.1)', !!c && Math.abs(c.z[0] / minor - Math.round(c.z[0] / minor)) < 1e-9 && Math.abs(c.z[1] / minor - Math.round(c.z[1] / minor)) < 1e-9 && Math.abs(c.z[0] - 0.8) < 1e-9 && Math.abs(c.z[1] - 0.6) < 1e-9, c);
let h0 = await hist();
await pick('zp-add-zeros-3');
let P = await zpParams(3);
let zs = P.zeros.split(',').map((s) => s.trim());
let F = await Fat(3, c.z);
info.addZero3 = { P, F, z: c.z };
ok('the zero is added to f₃ (one more zero)', zs.length === 2, P);
ok('the snapped point is now a zero of F (|F(z)| < 1e-12)', Math.hypot(F[0], F[1]) < 1e-12, F);
ok('no switch to Show alone', (await H('focus()')) === 0);
let h1 = await hist();
ok('one undo step', h1.hi === h0.hi + 1, [h0, h1]);
// "also at z + 2πik": z + 2πi is a zero too
F = await Fat(3, [c.z[0], c.z[1] + 2 * Math.PI]);
ok('z + 2πi is a zero of F too', Math.hypot(F[0], F[1]) < 1e-9, F);
await undo();
P = await zpParams(3);
ok('undo removes it', P.zeros.split(',').length === 1, P);
// a pole of f₃
p = await w2s('L', -0.62, 0.33);
await rclick(p[0], p[1]);
c = await lastZ();
await pick('zp-add-poles-3');
P = await zpParams(3);
F = await Fat(3, c.z);
ok('Add pole of f₃: the point is a pole of F', P.poles.split(',').length === 2 && isInf(F), { P, F });
await undo();
// Alt: free placement (the head and the added zero at the pointer, to the decade below a pixel)
p = await w2s('L', 0.8337, 0.5712);
await rclick(p[0], p[1], 1);
c = await lastZ();
await pick('zp-add-zeros-3');
P = await zpParams(3);
F = await Fat(3, c.z);
ok('Alt places it freely (not on the 0.1 ruler) and exactly', !!c && Math.abs(c.z[0] / minor - Math.round(c.z[0] / minor)) > 1e-6 && Math.abs(c.z[0] - 0.8337) < 0.01 && Math.hypot(F[0], F[1]) < 1e-12, { c, F });
await undo();
// the old integral items: a right-click on the circle |z| = 0.5
p = await w2s('L', 0.5, 0);
await rclick(p[0], p[1]);
m = await menu();
const ii = m && m.items.find((i) => i.id === 'integral');
ok('the integral item of the old menu: ∮ F dz around Circle 1', !!ii && /∮ F dz around Circle 1/.test(ii.text), ids(m));
await pick('integral');
await settle(600);
const ip = await ev(`(() => { const p = document.querySelector('.int-pop'); return p ? p.innerText : null; })()`);
ok('it opens the integral popover', !!ip && /around Circle 1/.test(ip), ip);
await closeAll();
// a zero mark: Remove ζ₁, Turn into a pole (one undo step each)
p = await w2s('L', 0, 0);   // not a mark: f₃'s marks live in w₂ (X shows z); show f₃ alone so X is its input
await ev(`(() => { const b = document.querySelector('#pipeline .card[data-k="3"]'); return 1; })()`);
info.objectOnZ = ids(await (async () => { await rclick(p[0], p[1]); return menu(); })());
await closeAll();

// ---------------------------------------------------------------------------------------------------------------
// 2. step 1 (zeros and poles alone): the zero is the clicked point itself; marks' own items
await load(ns + 'b', { shapes: [{ id: 's1', kind: 'disc', c: [0, 1.2], r: 0.8 }], steps: [{ type: 'zp', params: { a: '1', zeros: '1, -1', poles: '0' }, on: true }], srcView: { cx: 0, cy: 0, s: 110 } });
await settle(1200); await grab();
p = await w2s('L', 0.3, -0.7);
await rclick(p[0], p[1]);
m = await menu();
c = await lastZ();
const z1 = m && m.items.find((i) => i.id === 'zp-add-zeros-1');
ok('step 1: Add zero of f₁ here, no "also at" line', !!z1 && /Add zero of f₁ here/.test(z1.text) && !z1.sub, z1);
h0 = await hist();
await pick('zp-add-zeros-1');
P = await zpParams(1);
zs = P.zeros.split(',').map((s) => s.trim());
F = await Fat(1, c.z);
ok('step 1: the zero is the snapped point itself and F vanishes there', zs.length === 3 && zs[2] === '0.3-0.7i' && Math.hypot(F[0], F[1]) === 0, { zs, F, c });
ok('step 1: one undo step', (await hist()).hi === h0.hi + 1);
// the mark's menu
const hd = await ev(`__cmwZp().handles.find((q) => q.kind === 'zeros' && q.i === 0)`);
await rclick(hd.x, hd.y);
m = await menu();
info.mark = m;
ok('on a zero mark: Remove ζ₁, Turn into a pole', !!m && ids(m)[0] === 'zp-remove' && /Remove ζ₁/.test(m.items[0].text) && ids(m).includes('zp-swap'), ids(m));
h0 = await hist();
await pick('zp-swap');
P = await zpParams(1);
ok('Turn into a pole: ζ₁ = 1 becomes a pole (one undo step)', P.zeros.split(',').map((s) => s.trim()).join(',') === '-1,0.3-0.7i' && P.poles.split(',').map((s) => s.trim()).join(',') === '0,1' && (await hist()).hi === h0.hi + 1, P);
await undo();
await rclick(hd.x, hd.y);
await pick('zp-remove');
P = await zpParams(1);
const toastTxt = await ev(`(document.querySelector('#toastHost') || {}).innerText || ''`);
ok('Remove ζ₁ removes it, with an Undo toast', P.zeros.split(',').length === 2 && /Undo/i.test(toastTxt), { P, toastTxt });
await undo();
ok('undo brings it back', (await zpParams(1)).zeros.split(',').length === 3);

// ---------------------------------------------------------------------------------------------------------------
// 3. after a Möbius step: f₂'s pole goes to w₁ = M(z)
await load(ns + 'c', { shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 0.8 }], steps: [{ type: 'mobius', params: { a: '2', b: '1', c: '1', d: '3' }, on: true }, { type: 'zp', params: { a: '1', zeros: '0.5', poles: '' }, on: true }], srcView: { cx: 0, cy: 0, s: 110 } });
await settle(1200); await grab();
p = await w2s('L', -0.4, 0.9);
await rclick(p[0], p[1]);
m = await menu();
c = await lastZ();
const pm2 = m && m.items.find((i) => i.id === 'zp-add-poles-2');
ok('after Möbius: Add pole of f₂ here (one-to-one: no "also at" line)', !!pm2 && /Add pole of f₂ here/.test(pm2.text) && !(m.items.find((i) => i.id === 'zp-add-zeros-2') || {}).sub, m && m.items);
await pick('zp-add-poles-2');
F = await Fat(2, c.z);
const w1 = await Fat(1, c.z);
P = await zpParams(2);
ok('after Möbius: the pole is at w₁ = M(z) and z is a pole of F', P.poles.split(',').length === 1 && isInf(F) && P.poles.trim() === `${+w1[0].toPrecision(15)}+${+w1[1].toPrecision(15)}i`, { P, w1, F });   // (review math-7: stored at 15 significant digits)
await undo();
p = await w2s('L', 0.45, -0.35);
await rclick(p[0], p[1]);
c = await lastZ();
await pick('zp-add-zeros-2');
F = await Fat(2, c.z);
ok('after Möbius: an added zero makes F vanish at z', Math.hypot(F[0], F[1]) < 1e-12, F);

// ---------------------------------------------------------------------------------------------------------------
// 4. z² before the step: "also at −z"; Y, the deformation, the globes, the landscape, Phase
await load(ns + 'd', { shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 0.8 }], steps: [{ type: 'pown', params: { n: '2' }, on: true }, { type: 'zp', params: { a: '1', zeros: '0.5', poles: '' }, on: true }], srcView: { cx: 0, cy: 0, s: 110 } });
await settle(1200); await grab();
p = await w2s('L', 0.6, 0.2);
await rclick(p[0], p[1]);
m = await menu();
const zz = m && m.items.find((i) => i.id === 'zp-add-zeros-2');
ok('after z²: "also at −z"', !!zz && /also at −z/.test(zz.sub), zz);
await closeAll();
// Y
let R = await paneRect('R');
await rclick(R.cx + 40, R.cy - 30);
m = await menu();
info.y = m;
ok('Y: the head is w = …, no zero or pole items, Add point (a target), Copy, Center', !!m && /^w = /.test(m.head) && !/F\(/.test(m.head) && !ids(m).some((i) => /^zp-add/.test(i)) && ids(m).includes('point-add') && ids(m).includes('copy') && ids(m).includes('center'), m);
const tN = (await H('targets()')).length;
await pick('point-add');
ok('Y: Add point here adds a target point', (await H('targets()')).length === tN + 1);
await undo();
// Center view here and Copy coordinates (on X)
p = await w2s('L', 0.5, 0.5);
await rclick(p[0], p[1]);
c = await lastZ();
await pick('center');
const vL = await H(`view('L')`);
ok('Center view here centres X on the point', Math.abs(vL.cx - c.z[0]) < 1e-9 && Math.abs(vL.cy - c.z[1]) < 1e-9, { vL, c });
p = await w2s('L', 0.2, 0.3);
await rclick(p[0], p[1]);
await pick('copy');
const tt = await ev(`(document.querySelector('#toastHost') || {}).innerText || ''`);
ok('Copy coordinates: a toast with the value', /Copied 0\.2\+0\.3i/.test(tt), tt);
// the deformation
await ev('__cmwMorph({ open: true, T: 0.5 })'); await settle(800);
R = await paneRect('R');
await rclick(R.cx + 20, R.cy + 20);
m = await menu();
ok('the deformation plane: a menu with w and the view items, no zero/pole items', !!m && /^w = /.test(m.head) && ids(m).includes('copy') && !ids(m).some((i) => /^zp-add/.test(i)), m);
await closeAll();
await ev('__cmwMorph({ open: false })'); await settle(500);
// the X globe: a point there; nothing off the globe
await ev(`__cmwSetView('L', 'sphere'), 1`); await settle(1200);
let L = await paneRect('L');
await rclick(L.cx, L.cy);
m = await menu();
ok('X sphere: the menu where a point is, with Add zero of f₂', !!m && /^z = /.test(m.head) && ids(m).includes('zp-add-zeros-2'), m);
await closeAll();
await rclick(L.l + 8, L.t + 8);
ok('X sphere: no menu off the globe', !(await menu()));
await closeAll();
await ev(`__cmwSetView('L', 'plane'), 1`); await settle(600);
// the landscape
await ev(`__cmwSetMain('land'), 1`); await settle(1500);
L = await paneRect('L');
await rclick(L.cx, L.cy + 40);
m = await menu();
ok('Landscape: the menu over z with Add zero of f₂', !!m && /^z = /.test(m.head) && ids(m).includes('zp-add-zeros-2') && !ids(m).includes('center'), m);
await closeAll();
// Phase
await ev(`__cmwSetMain('phase'), 1`); await settle(1200);
p = await w2s('L', 0.3, 0.3);
await rclick(p[0], p[1]);
m = await menu();
ok('Phase: the menu over z with Add zero of f₂', !!m && ids(m).includes('zp-add-zeros-2'), m);
shots.push(await shot('pm-phase-light'));
await closeAll();
await ev(`__cmwSetMain('xy'), 1`); await settle(800);

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
let v0 = await H(`view('L')`);
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: L.cx - 150, y: L.cy + 150 });
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: L.cx - 150, y: L.cy + 150, button: 'right', buttons: 2, clickCount: 1 });
for (let i = 1; i <= 8; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: L.cx - 150 + i * 8, y: L.cy + 150, button: 'right', buttons: 2 }); await sleep(16); }
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: L.cx - 86, y: L.cy + 150, button: 'right', buttons: 0, clickCount: 1 });
await settle(300);
let v1 = await H(`view('L')`);
ok('a right-drag pans and opens no menu', !(await anyMenu()) && Math.abs(v1.cx - v0.cx) > 0.3, { v0, v1 });
await closeAll();
v0 = v1;
await drag(L.cx - 150, L.cy + 150, L.cx - 100, L.cy + 120, 8, 16);
await settle(300);
v1 = await H(`view('L')`);
ok('a left-drag pans, no menu', !(await anyMenu()) && Math.abs(v1.cx - v0.cx) > 0.3, { v0, v1 });
await ev(`(() => { const b = document.querySelector('.tool[data-tool=disc]'); b && b.click(); })()`);
const nS = (await H('shapes()')).length;
await drag(L.cx + 100, L.cy + 100, L.cx + 140, L.cy + 100, 8, 16);
await settle(300);
ok('drawing a disc draws it, no menu', !(await anyMenu()) && (await H('shapes()')).length === nS + 1);
await ev(`(() => { const b = document.querySelector('.tool[data-tool=select]'); b && b.click(); })()`);
await grab();

// ---------------------------------------------------------------------------------------------------------------
// 6. keyboard: Shift+F10 on a focused X plane, arrows, Esc returns the focus
await ev(`document.activeElement && document.activeElement.blur(); const o = document.getElementById('overlayL'); if (!o.hasAttribute('tabindex')) o.tabIndex = 0; o.focus(); 1`);
await settle(100);
await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'F10', code: 'F10', windowsVirtualKeyCode: 121, modifiers: 8 });
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'F10', code: 'F10', windowsVirtualKeyCode: 121, modifiers: 8 });
await settle(250);
m = await menu();
ok('Shift+F10 opens the menu, the first item focused', !!m && m.focus === m.items.find((i) => !i.dis).id, m);
await key('ArrowDown'); await settle(80);
const m2 = await menu();
ok('arrows move between items', !!m2 && m2.focus !== m.focus, [m && m.focus, m2 && m2.focus]);
await key('Escape'); await settle(200);
const fe = await ev(`document.activeElement && document.activeElement.id`);
ok('Esc closes it and the focus goes back to the plane', !(await anyMenu()) && fe === 'overlayL', fe);
await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'ContextMenu', code: 'ContextMenu', windowsVirtualKeyCode: 93 });
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ContextMenu', code: 'ContextMenu', windowsVirtualKeyCode: 93 });
await settle(250);
ok('the Menu key opens it too', !!(await menu()));
await closeAll();

// ---------------------------------------------------------------------------------------------------------------
// 7. touch (390 px phone): a long press opens the menu on release; a move first, a slide after the ring: no menu
await view(390, 844, false, true);
await load(ns + 'f', { shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 0.8 }], steps: [{ type: 'exp', params: {}, on: true }, { type: 'zp', params: { a: '1', zeros: '0.5', poles: '' }, on: true }], srcView: { cx: 0, cy: 0, s: 60 } });
await settle(1500); await grab();
L = await paneRect('L');
info.phonePane = L;
const gap = () => sleep(700);   // (gestures apart: no double tap)
v0 = await H(`view('L')`);
await touchHold(L.l + L.w / 2 - 60, L.t + L.h * 0.25, 650, { before: [40, 0] });   // (review regress-2: clear of the phone's inset, bottom-left)
v1 = await H(`view('L')`);
ok('touch: a pan first (40 px) pans and opens nothing', !(await anyMenu()) && Math.abs(v1.cx - v0.cx) > 0.2, { v0, v1 });
await gap();
await touchHold(L.cx + 20, L.cy - 20, 250);
ok('touch: a short press opens nothing', !(await anyMenu()));
await gap();
await touchHold(L.cx + 20, L.cy - 20, 650);
m = await menu();
info.touch = m;
ok('touch: a long press opens the menu on release (44 px rows)', !!m && m.touch && ids(m).includes('zp-add-zeros-2') && m.items.every((i) => i.h >= 43.5), m);
shots.push(await shot('pm-phone-light'));
c = await lastZ();
await ev(`(() => { const b = document.querySelector('#popHost .pop.menu.pm .mi[data-pm="zp-add-zeros-2"]'); b && b.click(); })()`);
await settle(300);
F = await Fat(2, c.z);
ok('touch: Add zero of f₂ here makes the pressed point a zero of F', Math.hypot(F[0], F[1]) < 1e-12, { F, c });
await closeAll();
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
await load(ns + 'g', { shapes: SHAPES, steps: CHAIN3, srcView: { cx: 0, cy: 0, s: 110 } });
await settle(1200);
p = await w2s('L', 0.83, 0.57);
await rclick(p[0], p[1]);
m = await menu();
ok('dark: the menu opens', !!m && ids(m).includes('zp-add-zeros-3'));
shots.push(await shot('pm-x-dark'));
await closeAll();
await view(1440, 900, false);
await nav(`http://localhost:${(/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1]}/test.html?ns=${ns}g&lang=ru`);
await settle(1500);
p = await w2s('L', 0.83, 0.57);
await rclick(p[0], p[1]);
m = await menu();
info.ru = m;
const zr = m && m.items.find((i) => i.id === 'zp-add-zeros-3');
ok('Russian: every item in Russian', !!m && !!zr && /Добавить нуль функции f₃/.test(zr.text) && /также в точках z \+ 2πik/.test(zr.sub) && m.items.every((i) => !/[A-Za-z]{4,}/.test(i.text.replace(/Rectangle|Circle|Прямоугольник/g, ''))), m);
ok('Russian: the decimal comma in the head', !!m && /0,80/.test(m.head), m && m.head);
shots.push(await shot('pm-x-ru'));
await closeAll();
const missing = await ev(`[...(I18N.missing || [])].filter((k) => /here|point|zero|pole|Copy|Center|Remove|Turn|Hide|Select|Delete|Reset|also|Added|Shape hidden/i.test(k))`);
ok('Russian: no lookup misses for the menu', Array.isArray(missing) && missing.length === 0, missing);
await grab();

ok('no console errors', errs.length === 0, errs.slice(0, 6));
return { pass: fails.length === 0, fails, info: { x: info.x && info.x.items.map((i) => i.text), ru: info.ru && info.ru.items.map((i) => i.text), mark: info.mark && info.mark.items.map((i) => i.text), objectOnZ: info.objectOnZ, phonePane: info.phonePane, addZero3: info.addZero3 }, shots };
