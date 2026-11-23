// Picking in the Stack (19-stack-pick.js), on M3 z³ − 1.2z + 0.3 with the disc |w − 1.1| < 0.25 on w₁ selected on z, the
// Stack shown, with real pointer events:
//  - the point under the pointer on each level is the level's map inverted: at the top view (Look down's frame) and at
//    three tilted cameras, a floor point z and a glass point w drawn through their levels' maps are picked back as z and
//    w, to 1e-9 relative;
//  - with any tool, a hover on the floor reads its point z in the left readout (|z| and all), and one on the glass reads
//    w with its count of preimages;
//  - with the Pick tool, a hover on the glass drops strands to w's three preimages (each maps to w); where the glass lies
//    over the floor, a click pins the very point the hover showed (rvE's ruling, at three such pixels), the strands stay
//    when the pointer moves on, and Esc unpins them;
//  - a press held there reads the floor: its point's three twins light, and a press dragged on reads the floor under the
//    pointer; neither adds a shape or moves the target;
//  - with the Disc tool a drag out on the floor adds a disc on w₁ about the pressed point's image; with Pick a drag on a lit
//    patch moves the target by the change of the image under the pointer, and a drag on the target's ring on the glass
//    moves it with the pointer;
//  - from the keyboard, Shift+Enter on the focused plane pins the target's centre on the glass and says its count; each
//    pin says its own point, so two pins say two things;
//  - Esc puts the picks out one at a time: the pin, then the floor's lit twins, then the selection;
//  - a strand is drawn inside the box only: a held press near the floor's corner, whose image is far off, draws its
//    strands with open rings where they leave the box;
//  - the camera turns apart from the pick: with the Pick tool a right-button drag and a Shift-drag turn it, with Select a
//    drag does, and none of them moves the target or adds a shape;
//  - on a phone (390 × 844, touch) one finger lights the twins, and the left readout keeps the tapped point's z; two fingers
//    turn the camera, the target where it was.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
let pass = 0;
const ok = (name, cond, got) => { if (cond) pass++; else fails.push({ name, got }); return !!cond; };
const until = (expr, max = 60000) => settled({ until: expr, max });
const frames = () => ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
const DEG = Math.PI / 180, REL = 1e-9, PX_TOL = 0.02;
// M3 and its value; points are [re, im]
const f = ([x, y]) => { const x2 = x * x - y * y, y2 = 2 * x * y; return [x2 * x - y2 * y - 1.2 * x + 0.3, x2 * y + y2 * x - 1.2 * y]; };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const close = (a, b) => !!a && !!b && dist(a, b) <= REL * (1 + Math.hypot(...b));
const open = async (w, h, phone) => {
  const ns = `spick-${Date.now()}`;
  const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'd', kind: 'disc', c: [1.1, 0], r: 0.25, stage: 1 }], steps: [{ type: 'custom', params: { expr: 'z^3-1.2z+0.3' }, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: phone ? 70 : 110 } };
  await view(w, h, false, phone);
  await nav(`http://localhost:${PORT}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await nav(`http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps`);
  await until("typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip .sv-plane')", 40000);
  await until('__cmwSteps().ready.ready && __cmwSteps().i === 0');
  await ev(`__cmwSelect('d'); 1`);
  await until(`__cmwShapes().selected === 'd' && typeof __cmwLookDown === 'function' && !!__cmwLookDown()`);
  await ev(`__cmwSteps({ surf: 'stack' }); 1`);
  await until(`__cmwSteps().surf === 'stack' && typeof __cmwStack === 'function' && !!__cmwStack().drawn`, 20000);
  await frames();
};
const cam = async (yaw, pitch) => {
  await ev(`__cmwCam('L', { yaw: ${yaw * DEG}, pitch: ${pitch * DEG} }); 1`);
  await until(`(() => { const d = __cmwStack().drawn; return !!d && Math.abs(d.camera.yaw - ${yaw * DEG}) < 1e-9 && Math.abs(d.camera.pitch - ${pitch * DEG}) < 1e-9; })()`, 10000);
};
const S = () => ev('__cmwStack()');
const pickAt = (x, y) => ev(`(() => { const o = document.getElementById('overlayL').getBoundingClientRect(); return __cmwStack({ pick: [${x} - o.left, ${y} - o.top] }); })()`);
const disc = async () => (await ev('__cmwP()')).shapes.find((s) => s.id === 'd');
const nShapes = async () => (await ev('__cmwP()')).shapes.length;
// a plane point's place on the page through a level's map (up 0 the floor, 1 the glass) of the Stack's last frame
const onLevel = (up, [re, im]) => ev(`(() => { const o = document.getElementById('overlayL').getBoundingClientRect(), d = __cmwStack().drawn, m = ${up} ? d.glass : d.floor, q = __cmwPlaneMenu().w2s('L', ${re}, ${im}), u = q[0] - o.left, v = q[1] - o.top; return [o.left + m[0] * u + m[2] * v + m[4], o.top + m[1] * u + m[3] * v + m[5]]; })()`);
const mouse = (type, x, y, o = {}) => send('Input.dispatchMouseEvent', Object.assign({ type, x, y, button: 'none', pointerType: 'mouse' }, o));
const hover = async (x, y) => { for (const dx of [2, 1, 0]) await mouse('mouseMoved', x + dx, y); await frames(); };
const press = async (x0, y0, x1, y1, o = {}) => {
  const btn = o.button || 'left', mods = o.modifiers || 0;
  await mouse('mouseMoved', x0, y0, { modifiers: mods });
  await mouse('mousePressed', x0, y0, { button: btn, buttons: btn === 'right' ? 2 : 1, clickCount: 1, modifiers: mods });
  const n = x1 == null ? 0 : 12;
  for (let i = 1; i <= n; i++) await mouse('mouseMoved', x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, { button: btn, buttons: btn === 'right' ? 2 : 1, modifiers: mods });
  await mouse('mouseReleased', x1 == null ? x0 : x1, y1 == null ? y0 : y1, { button: btn, buttons: 0, clickCount: 1, modifiers: mods });
  await frames();
};
const readout = () => ev(`document.getElementById('leftReadout').textContent`);
// the first point of a grid over the pane where pred(the levels under it) holds, as page coordinates
const find = async (pred) => {
  const r = await ev(`(() => { const o = document.getElementById('overlayL').getBoundingClientRect(); return [o.left, o.top, o.width, o.height]; })()`);
  for (let j = 1; j < 24; j++) for (let i = 1; i < 24; i++) {
    const x = Math.round(r[0] + (r[2] * i) / 24), y = Math.round(r[1] + (r[3] * j) / 24), k = await pickAt(x, y);
    if (k && pred(k)) return [x, y];
  }
  return null;
};

await open(1440, 900, false);
const hooked = await ev(`(() => { const s = __cmwStack({ pick: [10, 10] }); return !!s && 'floor' in s && 'glass' in s; })()`);
ok('the Stack picks a level\'s point under the pointer (__cmwStack({ pick }))', hooked, hooked);

// ---- the same point as Look down: each level's map inverted, at the top view and tilted
const Z = [[0.1, -0.6], [-0.8, 0.3], [1, 0.2]], W = [[1.1, 0], [1.2, 0.15], [0.95, -0.1]];
const seen = [];
for (const [yaw, pitch] of [[0, 90], [-30, 35], [60, 20], [150, 60]]) {
  await cam(yaw, pitch);
  for (const z of Z) { const q = await onLevel(0, z), k = await pickAt(...q); seen.push({ yaw, pitch, level: 'floor', want: z, got: k && k.floor && k.floor.z }); }
  for (const w of W) { const q = await onLevel(1, w), k = await pickAt(...q); seen.push({ yaw, pitch, level: 'glass', want: w, got: k && k.glass && k.glass.w }); }
}
info.same = seen.filter((s) => !close(s.got, s.want));
ok('the floor\'s and the glass\'s points under the pointer are the ones their maps draw there, at the top view and at three tilted cameras', seen.length === 24 && seen.every((s) => close(s.got, s.want)), info.same);
// (seen straight down the levels' maps are the identity: the point picked is the flat plane's, Look down's)
await cam(0, 90);
const top = await onLevel(0, Z[0]), flatZ = await ev(`__cmwPlaneMenu().s2w('L', ${top[0]}, ${top[1]})`), topK = await pickAt(...top);
ok('straight down, the floor\'s point under the pointer is Look down\'s: the flat plane\'s point there', !!topK && !!topK.floor && !!topK.glass && close(topK.floor.z, flatZ) && close(topK.glass.w, flatZ), { topK, flatZ });

// ---- hovers read the point: the floor's z with any tool, the glass's w with its preimages
await cam(-30, 35);
const floorOnly = await find((k) => k.floor && k.floor.on && !(k.glass && k.glass.on) && k.hover === 'floor');
// (places where the glass lies over the floor, off the target's marks: a hover and a click read the glass, a hold the floor)
const overlap = (k) => k.floor && k.floor.on && k.glass && k.glass.on && k.hover === 'glass' && k.click === 'glass' && k.hold === 'floor' && Math.hypot(k.glass.w[0] - 1.1, k.glass.w[1]) > 0.5;
const both = await find(overlap);
info.places = { floorOnly, both };
ok('at Tilt the pane has places of the floor alone, and of the glass over the floor', !!floorOnly && !!both, info.places);
if (floorOnly) {
  await hover(...floorOnly);
  const t = await readout(), k = await pickAt(...floorOnly);
  ok('a hover on the floor (Select) reads its point z in the left readout', t.includes('|z|'), { t, k });
}
if (both) {
  await hover(...both);
  const t = await readout();
  ok('a hover on the glass (Select) reads w with its count of preimages', /3 preimages of/.test(t) && /w\s*₁/.test(t), t);
}

// ---- the Pick tool: the glass's strands, a pin, Esc
await key('x');
await settled({ panes: false, until: `__cmwPick().tool === 'pick'` });
if (both) {
  await hover(...both);
  const s = await S(), k = await pickAt(...both);
  info.hov = s.hov;
  ok('Pick: a hover on the glass drops strands to w\'s three preimages, each of which maps to w', !!s.hov && !s.hov.pinned && s.hov.zs.length === 3 && s.hov.zs.every((q) => close(f(q), s.hov.w)) && close(s.hov.w, k.glass.w), { hov: s.hov, k });
}
// (rvE's ruling: at three pixels where the glass lies over the floor, the click pins the very point the hover showed)
const spots = both ? [both, [both[0] + 23, both[1] + 11], [both[0] - 17, both[1] + 19]] : [];
const same = [];
for (const q of spots) {
  const k = await pickAt(...q);
  if (!k || !overlap(k)) continue;
  await hover(...q);
  const hv = (await S()).hov;
  await press(...q);
  const pn = (await S()).hov, live = (await ev('__cmwPick()')).live;
  same.push({ q, hover: hv && hv.w, pin: pn && pn.w, pinned: !!pn && pn.pinned, live });
  await key('Escape');
  await frames();
}
info.same = same;
ok('where the glass lies over the floor, a click pins the very point the hover showed (three pixels)', same.length === 3 && same.every((r) => r.pinned && close(r.pin, r.hover)), same);
ok('each pin says its own point in the live region, so three pins say three things', same.length === 3 && same.every((r) => /preimages? of w₁ = .* on z/.test(r.live)) && new Set(same.map((r) => r.live)).size === 3, same.map((r) => r.live));
if (both) {
  await press(...both);
  const pinned = (await S()).hov;
  await hover(...floorOnly);
  const after = (await S()).hov;
  ok('a pin\'s strands stay when the pointer moves on', !!pinned && pinned.pinned && !!after && after.pinned && close(after.w, pinned.w), { pinned, after });
  await key('Escape');
  await frames();
  const esc = await S();
  ok('Esc unpins the glass\'s point', !esc.hov || !esc.hov.pinned, esc.hov);
}

// ---- a press held, or dragged, where the glass lies over the floor reads the floor
const n0 = await nShapes(), d0 = await disc();
if (both) {
  const k = await pickAt(...both);
  await mouse('mouseMoved', ...both);
  await mouse('mousePressed', ...both, { button: 'left', buttons: 1, clickCount: 1 });
  await sleep(700);
  const held = (await ev('__cmwPick()')).lit, readHeld = await readout();
  await mouse('mouseReleased', ...both, { button: 'left', buttons: 0, clickCount: 1 });
  await frames();
  info.held = { held, z: k.floor.z, readHeld };
  ok('a press held where the glass lies over the floor reads the floor: the pressed point\'s three twins light, and the readout reads z', !!held && close(held.z0, k.floor.z) && held.zs.length === 3 && held.zs.every((q) => close(f(q), f(k.floor.z))) && readHeld.includes('|z|'), info.held);
  const end = [both[0] + 30, both[1] + 12], k1 = await pickAt(...end);
  await press(both[0], both[1], end[0], end[1]);
  const slid = (await ev('__cmwPick()')).lit;
  info.slid = { slid, z: k1.floor.z };
  ok('a press dragged reads the floor under the pointer: its twins light where it lifts', !!slid && close(slid.z0, k1.floor.z) && slid.zs.length === 3, info.slid);
  ok('a held or dragged press adds no shape and leaves the target', (await nShapes()) === n0 && dist((await disc()).c, d0.c) === 0, await disc());
  // ---- the Disc tool: a drag out on the floor adds a disc on w₁ about the pressed point's image
  await ev(`document.querySelector('#tools .tool[data-tool="disc"]').click(); 1`);
  await frames();
  await press(both[0], both[1], end[0], end[1]);
  await settled({ until: `__cmwP().shapes.length === ${n0 + 1}` });
  const nd = (await ev('__cmwP()')).shapes.filter((q) => q.id !== 'd').pop();
  info.out = { nd, w0: f(k.floor.z), w1: f(k1.floor.z) };
  ok('Disc: a drag out on the floor adds a disc on w₁ about the pressed point\'s image, through the release point\'s', !!nd && nd.stage === 1 && dist(nd.c, f(k.floor.z)) <= PX_TOL && Math.abs(nd.r - dist(f(k1.floor.z), f(k.floor.z))) <= PX_TOL * (1 + nd.r), info.out);
  await ev(`document.getElementById('undoBtn').click()`);
  await settled({ until: `__cmwP().shapes.length === ${n0}` });
  await ev(`__cmwSelect('d'); 1`);
  await key('x');
  await settled({ panes: false, until: `__cmwPick().tool === 'pick'` });
  await frames();
}

// ---- the keyboard: Shift+Enter on the focused plane pins the target's centre on the glass
for (let i = 0; i < 8 && (await ev('document.activeElement && document.activeElement.id')) !== 'overlayL'; i++) await key('F6');
await key('Enter', 8);
await frames();
{
  const s = await S(), live = (await ev('__cmwPick()')).live;
  info.key = { hov: s.hov, live };
  ok('Shift+Enter on the focused plane pins the target\'s centre on the glass, and says its count', !!s.hov && s.hov.pinned && close(s.hov.w, [1.1, 0]) && s.hov.zs.length === 3 && /3 preimages of w₁ = 1\.1 on z/.test(live), info.key);
  await key('Escape');
  await frames();
}

// ---- Esc puts the picks out one at a time: the pin, then the lit twins, then the selection
if (both && floorOnly) {
  await press(...floorOnly);
  await press(...both);
  const peel = [];
  const state = async () => { const s = await S(), P = await ev('__cmwPick()'); return { pin: !!s.hov && s.hov.pinned, lit: !!P.lit, sel: (await ev('__cmwShapes()')).selected }; };
  peel.push(await state());
  for (let i = 0; i < 3; i++) { await key('Escape'); await frames(); peel.push(await state()); }
  info.peel = peel;
  const want = [{ pin: true, lit: true, sel: 'd' }, { pin: false, lit: true, sel: 'd' }, { pin: false, lit: false, sel: 'd' }, { pin: false, lit: false, sel: null }];
  ok('Esc puts out the pin, then the floor\'s lit twins, then the selection', JSON.stringify(peel) === JSON.stringify(want), peel);
  await ev(`__cmwSelect('d'); 1`);
  await frames();
  // (after a held press, Esc puts out its twins and keeps the target, so Shift+Enter still pins the target's centre)
  await mouse('mouseMoved', ...both);
  await mouse('mousePressed', ...both, { button: 'left', buttons: 1, clickCount: 1 });
  await sleep(700);
  await mouse('mouseReleased', ...both, { button: 'left', buttons: 0, clickCount: 1 });
  await frames();
  for (let i = 0; i < 8 && (await ev('document.activeElement && document.activeElement.id')) !== 'overlayL'; i++) await key('F6');
  await key('Escape');
  await frames();
  const afterHold = { lit: !!(await ev('__cmwPick()')).lit, sel: (await ev('__cmwShapes()')).selected };
  await key('Enter', 8);
  await frames();
  const pinAfter = (await S()).hov;
  info.afterHold = { afterHold, pinAfter };
  ok('after a held press, Esc puts out its twins and keeps the target: Shift+Enter then pins the target\'s centre, not 0', !afterHold.lit && afterHold.sel === 'd' && !!pinAfter && pinAfter.pinned && close(pinAfter.w, [1.1, 0]), info.afterHold);
  await key('Escape');
  await frames();
}

// ---- strands stop at the box: a held press near the floor's corner, its image far off
{
  const corner = await ev(`(() => { const o = document.getElementById('overlayL').getBoundingClientRect(), m = __cmwStack().drawn.floor, u = o.width * 0.04, v = o.height * 0.04; return [Math.round(o.left + m[0] * u + m[2] * v + m[4]), Math.round(o.top + m[1] * u + m[3] * v + m[5])]; })()`);
  const ck = await pickAt(...corner);
  await mouse('mouseMoved', ...corner);
  await mouse('mousePressed', ...corner, { button: 'left', buttons: 1, clickCount: 1 });
  await sleep(700);
  await frames();
  const rec = (await S()).drawn.picks, lit = (await ev('__cmwPick()')).lit;
  await mouse('mouseReleased', ...corner, { button: 'left', buttons: 0, clickCount: 1 });
  await key('Escape');
  await frames();
  info.off = { corner, ck: ck && ck.floor, rec, w: lit && lit.w };
  ok('a strand is drawn inside the box only: a press held near the floor\'s corner draws its strands, with open rings where they leave the box', !!rec && rec.strands >= 1 && rec.off >= 1, info.off);
}

// ---- a drag on a lit patch moves the target
// (the real preimage of the disc's centre 1.1, z³ − 1.2z − 0.8 = 0 near 1.34: in its patch on the floor)
let xr = 1.3;
for (let i = 0; i < 30; i++) xr -= (xr ** 3 - 1.2 * xr - 0.8) / (3 * xr ** 2 - 1.2);
const patchZ = [xr, 0];
const pp = await onLevel(0, patchZ), pk = await pickAt(...pp);
info.patch = { pp, pk };
if (pk && pk.click === 'floor' && pk.hold === 'floor') {
  const c0 = (await disc()).c.slice(), q1 = [pp[0] + 18, pp[1] - 10], k1 = await pickAt(...q1);
  await press(pp[0], pp[1], q1[0], q1[1]);
  await settled({ until: `(() => { const s = __cmwP().shapes.find((q) => q.id === 'd'); return !!s && (s.c[0] !== ${c0[0]} || s.c[1] !== ${c0[1]}); })()` });
  const c1 = (await disc()).c, dw = [f(k1.floor.z)[0] - f(pk.floor.z)[0], f(k1.floor.z)[1] - f(pk.floor.z)[1]];
  ok('a drag on a lit patch moves the target by the change of the image under the pointer', dist(c1, [c0[0] + dw[0], c0[1] + dw[1]]) <= PX_TOL, { c0, c1, dw });
  await ev(`document.getElementById('undoBtn').click()`);
  await settled({ until: `(() => { const s = __cmwP().shapes.find((q) => q.id === 'd'); return !!s && s.c[0] === ${c0[0]} && s.c[1] === ${c0[1]}; })()` });
} else ok('the target\'s patch on the floor is picked as the floor (a floor mark)', false, info.patch);

// ---- a drag on the target's ring on the glass moves it with the pointer
{
  const d = await disc(), rp = await onLevel(1, [d.c[0] + d.r, d.c[1]]), rk = await pickAt(...rp);
  const q1 = [rp[0] + 20, rp[1] + 12], k1 = await pickAt(...q1);
  info.ring = { rk, k1 };
  if (rk && rk.click === 'glass' && rk.hold === 'glass') {
    await press(rp[0], rp[1], q1[0], q1[1]);
    await settled({ until: `(() => { const s = __cmwP().shapes.find((q) => q.id === 'd'); return !!s && (s.c[0] !== ${d.c[0]} || s.c[1] !== ${d.c[1]}); })()` });
    const c1 = (await disc()).c, want = [d.c[0] + k1.glass.w[0] - rk.glass.w[0], d.c[1] + k1.glass.w[1] - rk.glass.w[1]];
    ok('a drag on the target\'s ring on the glass moves the target with the pointer', dist(c1, want) <= PX_TOL, { c1, want });
    await ev(`document.getElementById('undoBtn').click()`);
    await settled({ until: `(() => { const s = __cmwP().shapes.find((q) => q.id === 'd'); return !!s && s.c[0] === ${d.c[0]} && s.c[1] === ${d.c[1]}; })()` });
  } else ok('a press on the target\'s ring is picked as the glass (a glass mark)', false, info.ring);
}

// ---- the camera turns apart from the pick, and never moves the target
if (both || floorOnly) {
  const d = await disc(), n = await nShapes(), mid = both || floorOnly, turns = [];
  for (const [how, o] of [['Pick, right button', { button: 'right' }], ['Pick, Shift', { modifiers: 8 }]]) {
    const y0 = (await S()).camera.yaw;
    await press(mid[0], mid[1], mid[0] + 60, mid[1] + 20, o);
    turns.push({ how, dyaw: (await S()).camera.yaw - y0 });
  }
  await key('v');
  await settled({ panes: false, until: `__cmwPick().tool === 'select'` });
  { const y0 = (await S()).camera.yaw; await press(mid[0], mid[1], mid[0] + 60, mid[1] + 20); turns.push({ how: 'Select', dyaw: (await S()).camera.yaw - y0 }); }
  info.turns = turns;
  ok('the camera turns apart from the pick: a right-button drag and a Shift-drag with Pick, a drag with Select', turns.every((t) => Math.abs(t.dyaw) > 5 * DEG), turns);
  const d1 = await disc();
  ok('a camera turn never moves the target or adds a shape', dist(d1.c, d.c) === 0 && d1.r === d.r && (await nShapes()) === n, { d, d1 });
} else ok('the camera turns apart from the pick (no place on the levels to press)', false, info.places);

// ---- a phone: one finger picks, two fingers turn the camera
await open(390, 844, true);
await key('x');
await settled({ panes: false, until: `__cmwPick().tool === 'pick'` });
{
  const spot = await find((k) => k.click === 'floor' && k.floor && k.floor.on && !(k.glass && k.glass.on));
  info.phone = { spot };
  if (spot) {
    const t = (type, pts) => send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1 })) });
    await t('touchStart', [spot]); await t('touchEnd', []);
    await settled({ panes: false, until: `!!__cmwPick().lit` });
    const lit = (await ev('__cmwPick()')).lit;
    ok('phone: one finger on the floor lights the twins', !!lit && lit.zs.length === 3, lit);
    const tapRead = await readout();
    // (a phone's readout is the short one: z and F(z))
    ok('phone: after the tap the left readout keeps the tapped point\'s z', /^z\s/.test(tapRead) && tapRead.includes('F(z)'), tapRead);
    const mid = await ev(`(() => { const o = document.getElementById('overlayL').getBoundingClientRect(); return [Math.round(o.left + o.width / 2), Math.round(o.top + o.height / 2)]; })()`);
    const d = await disc(), n = await nShapes(), y0 = (await S()).camera.yaw, a = [mid[0] - 50, mid[1]], b = [mid[0] + 30, mid[1]];
    await t('touchStart', [a, b]);
    for (let i = 1; i <= 8; i++) { await t('touchMove', [[a[0] + 8 * i, a[1]], [b[0] + 8 * i, b[1]]]); await sleep(20); }
    await t('touchEnd', []);
    await frames();
    const s = await S(), d1 = await disc();
    info.phone.turn = { dyaw: s.camera.yaw - y0, d, d1 };
    ok('phone: two fingers turn the camera, the target where it was and no shape added', Math.abs(s.camera.yaw - y0) > 5 * DEG && dist(d1.c, d.c) === 0 && (await nShapes()) === n, info.phone.turn);
  } else ok('phone: a floor spot outside the glass to press', false, info.phone);
}

return { pass: fails.length === 0, passed: pass, fails, info };
