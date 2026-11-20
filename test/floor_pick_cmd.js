// The floor picker (#1982, the Stack's P1a): the Pick tool in the steps view, on M3 = z³ − 1.2z + 0.3 with the floor z and
// the target's plane w₁, with real pointer events on a desktop and a phone's touch.
// - The tool shows on z, where a later plane holds the target, and keeps its place, hidden, on w₁; X picks it.
// - A press lights the point's twins: all three points with the same image, said in the live region.
// - A drag out draws a disc on w₁ about the pressed point's image, through the image of the release point, as one
//   edit (one Undo).
// - A drag on a lit patch moves its disc by the change of the image under the pointer, as one edit.
// - From the keyboard, Enter lights the twins of the view's centre and Enter again adds the disc about their image.
// - Select still pans the empty floor; on a phone one finger picks and two fingers pan.
// A command file for a CDP daemon (test/cdp_kit README): python3 build.py && test/<you>_cdp/q.sh test/floor_pick_cmd.js
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const errs = [];
const grab = async () => { errs.push(...(await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''))); };
// M3 and its value; points are [re, im]
const f = ([x, y]) => { const x2 = x * x - y * y, y2 = 2 * x * y; return [x2 * x - y2 * y - 1.2 * x + 0.3, x2 * y + y2 * x - 1.2 * y]; };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
// (a point's image, read back to 1e-9; a disc's centre and radius from a pointer's place, to what a pixel moves them)
const TOL = 1e-9, PX_TOL = 0.02;
const steps = [{ type: 'custom', params: { expr: 'z^3-1.2z+0.3' }, on: true }];
async function openApp(w, h, mobile) {
  const ns = 'fpick' + Date.now();
  await view(w, h, false, mobile);
  await loadView('steps', ns, { v3: true, v4: true, v5: true, v6: true, nextId: 50, rightMode: 'image', steps, shapes: [], srcView: { cx: 0, cy: 0, s: 120 } });
  await settled({ max: 40000, until: `typeof __cmwPick === 'function' && typeof __cmwP === 'function' && !!document.querySelector('#svStrip .sv-step')` });
}
const atPlane = async (i) => { await ev(`__cmwSteps({ go: ${i}, now: true }), 1`); await settled({ max: 20000, until: `(() => { const s = __cmwSteps(); return s.x === ${i} && !s.anim && !s.moving; })()` }); };
const pick = () => ev('__cmwPick()');
const discs = async () => (await ev('__cmwP()')).shapes.filter((s) => s.kind === 'disc');
const at = (re, im) => ev(`__cmwPlaneMenu().w2s('L', ${re}, ${im})`);
const zAt = (x, y) => ev(`__cmwPlaneMenu().s2w('L', ${x}, ${y})`);
const button = () => ev(`(() => { const b = document.querySelector('#tools .tool[data-tool="pick"]'); if (!b) return null; const r = b.getBoundingClientRect(); return { na: b.classList.contains('tool-na'), hidden: b.getAttribute('aria-hidden'), vis: getComputedStyle(b).visibility, box: [r.left, r.top, r.width, r.height], tab: b.tabIndex }; })()`);
const twinsHold = (lit, z0) => !!lit && lit.zs.length === 3 && lit.zs.every((q) => dist(f(q), f(z0)) <= TOL * (1 + Math.hypot(...f(z0)))) && lit.zs.some((q) => dist(q, z0) <= 1e-6);

// ---- desktop: the tool shows where it picks
await openApp(1440, 900, false);
await atPlane(0);
const b0 = await button();
ok('z, with w₁ past it: the Pick button shows', !!b0 && !b0.na && b0.vis === 'visible' && b0.hidden === 'false', b0);
await atPlane(1);
const b1 = await button();
ok('w₁, the target\'s own plane: the Pick button keeps its place, hidden', !!b1 && b1.na && b1.vis === 'hidden' && b1.hidden === 'true' && b1.tab === -1 && JSON.stringify(b1.box) === JSON.stringify(b0.box), { b0, b1 });
await key('x');
ok('w₁: X does not pick the tool there', (await pick()).tool !== 'pick', await pick());
await atPlane(0);
await key('x');
await settled({ panes: false, until: `__cmwPick().tool === 'pick'` });
ok('z: X picks the Pick tool', (await pick()).tool === 'pick', await pick());

// ---- a press lights the twins
const z0 = [0.25, 0.35];
const p0 = await at(...z0);
await click(p0[0], p0[1]);
await settled({ panes: false, until: `!!__cmwPick().lit` });
const zp = await zAt(p0[0], p0[1]);
let P = await pick();
info.lit = P.lit;
ok('a press lights the three twins: every point with the same image', twinsHold(P.lit, zp), P.lit);
await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
const twinInk = await Promise.all(P.lit.zs.map(([re, im]) => ev(`__cmwOverlayInk('L', [${re}, ${im}], 7)`)));
ok('the twins\' marks are on the plane\'s overlay, which holds ink at each of them', twinInk.length === 3 && twinInk.every((n) => n > 0), twinInk);
ok('the live region says how many', /3 preimages on z/.test(P.live), P.live);
ok('a press adds no shape', (await discs()).length === 0, await discs());

// ---- a drag out draws a disc on w₁, as one edit
const p1 = [p0[0] + 50, p0[1]];
await drag(p0[0], p0[1], p1[0], p1[1], 12, 16);
await settled({ until: `__cmwP().shapes.length === 1` });
let D = await discs();
const w0 = f(zp), w1 = f(await zAt(p1[0], p1[1]));
info.disc = D[0];
ok('a drag out draws a disc on w₁ about the pressed point\'s image, through the release point\'s', D.length === 1 && D[0].stage === 1
  && dist(D[0].c, w0) <= PX_TOL && Math.abs(D[0].r - dist(w1, w0)) <= PX_TOL * (1 + D[0].r), { D, w0, w1 });
await ev(`document.getElementById('undoBtn').click()`);
await settled({ until: `__cmwP().shapes.length === 0` });
ok('one Undo takes the disc away', (await discs()).length === 0, await discs());
await ev(`document.getElementById('redoBtn').click()`);
await settled({ until: `__cmwP().shapes.length === 1` });
D = await discs();
ok('Redo brings it back', D.length === 1 && D[0].stage === 1, D);

// ---- a drag on a lit patch moves the disc
const c0 = D.length ? D[0].c.slice() : [NaN, NaN], q0 = await at(...zp), q1 = [q0[0] + 30, q0[1] - 20];
await drag(q0[0], q0[1], q1[0], q1[1], 12, 16);
await settled({ until: `(() => { const s = __cmwP().shapes[0]; return !!s && (s.c[0] !== ${c0[0]} || s.c[1] !== ${c0[1]}); })()` });
D = await discs();
const dw = [f(await zAt(q1[0], q1[1]))[0] - f(await zAt(q0[0], q0[1]))[0], f(await zAt(q1[0], q1[1]))[1] - f(await zAt(q0[0], q0[1]))[1]];
ok('a drag on a lit patch moves its disc by the change of the image under the pointer', D.length === 1 && dist(D[0].c, [c0[0] + dw[0], c0[1] + dw[1]]) <= PX_TOL && D[0].stage === 1, { D, c0, dw });
await ev(`document.getElementById('undoBtn').click()`);
await settled({ until: `(() => { const s = __cmwP().shapes[0]; return !!s && s.c[0] === ${c0[0]} && s.c[1] === ${c0[1]}; })()` });
D = await discs();
ok('one Undo puts it back', D.length === 1 && dist(D[0].c, c0) === 0, D);

// ---- the keyboard: Enter on the focused plane lights the view centre's twins, Enter again adds the disc
// (F6 steps through the page's areas; the plane is one of them)
for (let i = 0; i < 8 && (await ev('document.activeElement && document.activeElement.id')) !== 'overlayL'; i++) await key('F6');
ok('F6 reaches the plane', (await ev('document.activeElement && document.activeElement.id')) === 'overlayL', await ev('document.activeElement && document.activeElement.id'));
await key('Enter');
await settled({ panes: false, until: `(() => { const l = __cmwPick().lit; return !!l && Math.hypot(l.z0[0], l.z0[1]) < 0.5; })()` });
P = await pick();
const vc = await ev(`(() => { const v = __cmwPlaneMenu().view('L'); return [v.cx, v.cy]; })()`);
ok('Enter lights the twins of the view\'s centre', !!P.lit && dist(P.lit.z0, vc) <= 1e-9 && twinsHold(P.lit, P.lit.z0), { lit: P.lit, vc });
await key('Enter');
await settled({ until: `__cmwP().shapes.length === 2` });
D = await discs();
ok('Enter again adds a disc on w₁ about their image, selected', D.length === 2 && D[1].stage === 1 && dist(D[1].c, f(vc)) <= 1e-9 && D[1].r > 0 && (await ev('__cmwShapes().selected')) === D[1].id, D);

// ---- Select still pans the empty floor
await ev(`document.querySelector('.tool[data-tool="select"]').click(); 1`);
const v0 = await ev(`__cmwPlaneMenu().view('L')`), e0 = await at(-1.6, -1.1);
await drag(e0[0], e0[1], e0[0] + 40, e0[1] + 25, 10, 16);
await settled({});
const v1 = await ev(`__cmwPlaneMenu().view('L')`);
ok('Select: a drag on the empty floor pans and draws nothing', (v1.cx !== v0.cx || v1.cy !== v0.cy) && (await discs()).length === 2, { v0, v1 });
await grab();

// ---- a phone: one finger picks, two fingers pan
await openApp(390, 844, true);
await atPlane(0);
await ev(`document.querySelector('.tool[data-tool="pick"]').click(); 1`);
await settled({ panes: false, until: `__cmwPick().tool === 'pick'` });
const touch = (type, pts) => send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1 })) });
const t0 = await at(0.2, -0.3);
await touch('touchStart', [t0]); await touch('touchEnd', []);
await settled({ panes: false, until: `!!__cmwPick().lit` });
P = await pick();
ok('phone: a tap lights the three twins', twinsHold(P.lit, await zAt(t0[0], t0[1])), P.lit);
await touch('touchStart', [t0]);
for (let i = 1; i <= 10; i++) { await touch('touchMove', [[t0[0] + 4 * i, t0[1]]]); await sleep(20); }
await touch('touchEnd', []);
await settled({ until: `__cmwP().shapes.length === 1` });
D = await discs();
ok('phone: a one-finger drag out draws a disc on w₁', D.length === 1 && D[0].stage === 1 && dist(D[0].c, f(await zAt(t0[0], t0[1]))) <= PX_TOL, D);
const pv0 = await ev(`__cmwPlaneMenu().view('L')`), m = [t0[0] - 60, t0[1] + 150], n = [t0[0] + 60, t0[1] + 150];
await touch('touchStart', [m, n]);
for (let i = 1; i <= 8; i++) { await touch('touchMove', [[m[0], m[1] + 5 * i], [n[0], n[1] + 5 * i]]); await sleep(20); }
await touch('touchEnd', []);
await settled({});
const pv1 = await ev(`__cmwPlaneMenu().view('L')`);
ok('phone: two fingers pan, and draw nothing', (pv1.cy !== pv0.cy || pv1.cx !== pv0.cx) && (await discs()).length === 1, { pv0, pv1, D: await discs() });
await grab();
ok('no page errors', errs.length === 0, errs.slice(0, 5));
return { pass: fails.length === 0, fails, info };
