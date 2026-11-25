// The Stack on a phone (#1991), with touch emulation:
//  - Look down's targets are sized for a finger: on the flat plane, z² with |w − 1| < 0.5 on w₁ at s = 80 (the ring
//    40 px across its radius), a finger's press 18 px outside the ring drags the target with the pointer, where a
//    mouse's press there does not (it draws a disc); inside the ring a finger's band reaches a third of the ring's radius
//    (13 px here), so a press 20 px inside it on the lit patch of 1 drags that patch (the target follows the patch's
//    point under the finger, not the pointer); the lines are LD_HIT_TOUCH wide to a finger;
//  - on the Stack in Tilt (pitch 20°, the ring an ellipse on the glass) a finger's press 18 px off the ellipse drags the
//    target, a mouse's press there does not;
//  - the Tilt key on the column is at least 44 × 44, and a tap on it goes from Look down to Tilt and back, the camera
//    following (S.sv.cam);
//  - a second finger that lands while one is down turns the camera and leaves no pick behind: no lit twins, no pin;
//  - at 360 × 640 (en), 390 × 844 (ru), 740 × 360 (it), 600 × 320 (en) and 568 × 320 (ru), in Tilt, the Tilt key, Look
//    down's key and the plane's other keys meet neither each other nor the context bar; the Tilt key makes the column no
//    taller where it would reach the head (on a landscape phone it stands left of the Display key, the column's second;
//    the row checks it against the Sphere key, the column's first); the box lies in the pane above the bar, and the tubes'
//    labels clear of the keys.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
let pass = 0;
const ok = (name, cond, got) => { if (cond) pass++; else fails.push({ name, got }); return !!cond; };
const until = (expr, max = 60000) => settled({ until: expr, max });
const frames = () => ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
const DEG = Math.PI / 180;
const Z2 = [{ type: 'custom', params: { expr: 'z^2' }, on: true }], M3 = [{ type: 'custom', params: { expr: 'z^3-1.2z+0.3' }, on: true }];
const open = async (w, h, { lang = 'en', steps = M3, disc = { c: [1.1, 0], r: 0.25 }, s = 70, stack = true } = {}) => {
  const ns = `sphone-${lang}-${Date.now()}`;
  const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'd', kind: 'disc', c: disc.c, r: disc.r, stage: 1 }], steps, nextId: 50, focus: 0, srcView: { cx: disc.c[0], cy: disc.c[1], s } };
  await view(w, h, false, true);
  await nav(`http://localhost:${PORT}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await nav(`http://localhost:${PORT}/test.html?ns=${ns}&lang=${lang}&view=steps`);
  await until("typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip .sv-plane')", 40000);
  await until('__cmwSteps().ready.ready && __cmwSteps().i === 0');
  await ev(`__cmwSelect('d'); 1`);
  await until(`__cmwShapes().selected === 'd' && typeof __cmwLookDown === 'function' && !!__cmwLookDown()`);
  if (stack) {
    await ev(`__cmwSteps({ surf: 'stack' }); 1`);
    await until(`__cmwSteps().surf === 'stack' && typeof __cmwStack === 'function' && !!__cmwStack().drawn`, 20000);
  }
  await key('x');
  await settled({ panes: false, until: `__cmwPick().tool === 'pick'` });
  await frames();
};
const cam = async (yaw, pitch) => {
  await ev(`__cmwCam('L', { yaw: ${yaw * DEG}, pitch: ${pitch * DEG} }); 1`);
  await until(`(() => { const d = __cmwStack().drawn; return !!d && Math.abs(d.camera.yaw - ${yaw * DEG}) < 1e-9 && Math.abs(d.camera.pitch - ${pitch * DEG}) < 1e-9; })()`, 10000);
  await frames();
};
const disc = async () => (await ev('__cmwP()')).shapes.find((q) => q.id === 'd');
const nShapes = async () => (await ev('__cmwP()')).shapes.length;
const pane = () => ev(`(() => { const r = document.getElementById('overlayL').getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; })()`);
const box = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e || e.hidden || !e.getClientRects().length || getComputedStyle(e).visibility === 'hidden') return null; const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; })()`);
const meets = (a, b) => a[0] < b[2] - 0.5 && a[2] > b[0] + 0.5 && a[1] < b[3] - 0.5 && a[3] > b[1] + 0.5;
const inside = (a, b) => a[0] >= b[0] - 0.5 && a[1] >= b[1] - 0.5 && a[2] <= b[2] + 0.5 && a[3] <= b[3] + 0.5;
const touch = (type, pts) => send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1 })) });
const mouse = (type, x, y, o = {}) => send('Input.dispatchMouseEvent', Object.assign({ type, x, y, button: 'none', pointerType: 'mouse' }, o));
// a drag from p by (dx, dy) in 8 steps, by a finger or a mouse
const dragBy = async (finger, [x, y], dx, dy) => {
  if (finger) {
    await touch('touchStart', [[x, y]]);
    for (let i = 1; i <= 8; i++) { await touch('touchMove', [[x + (dx * i) / 8, y + (dy * i) / 8]]); await sleep(15); }
    await touch('touchEnd', []);
  } else {
    await mouse('mouseMoved', x, y);
    await mouse('mousePressed', x, y, { button: 'left', buttons: 1, clickCount: 1 });
    for (let i = 1; i <= 8; i++) await mouse('mouseMoved', x + (dx * i) / 8, y + (dy * i) / 8, { button: 'left', buttons: 1 });
    await mouse('mouseReleased', x + dx, y + dy, { button: 'left', buttons: 0, clickCount: 1 });
  }
  await frames();
};
const moved = (a, b) => [b.c[0] - a.c[0], b.c[1] - a.c[1]];
const near = (a, b, tol) => Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol;

// ---- the flat plane: z² with |w − 1| < 0.5 on w₁ at s = 80, Look down's ring 40 px in radius
const FLAT = { steps: Z2, disc: { c: [1, 0], r: 0.5 }, s: 80, stack: false };
// the ring's centre on the page, and its radius in css px
const ring = async () => { const L = await ev('__cmwLookDown()'), o = await pane(); return L && { c: [o[0] + L.c[0], o[1] + L.c[1]], r: L.r }; };
for (const finger of [true, false]) {
  const who = finger ? 'a finger' : 'a mouse';
  await open(390, 844, FLAT);
  const R = await ring(), d0 = await disc(), n0 = await nShapes();
  info[`flat out ${who}`] = { R };
  if (!ok(`flat: Look down's ring is drawn 40 px in radius (${who})`, !!R && Math.abs(R.r - 40) < 0.5, R)) continue;
  // (18 px above the ring's top: no lit patch there, and the lines lie along the real axis)
  await dragBy(finger, [R.c[0], R.c[1] - R.r - 18], 24, 0);
  const d1 = await disc(), dv = moved(d0, d1);
  info[`flat out ${who}`].dv = dv;
  if (finger) ok('flat: a finger\'s press 18 px outside the ring drags the target with the pointer (24 px: 0.3)', near(dv, [0.3, 0], 0.01) && (await nShapes()) === n0, dv);
  else ok('flat: a mouse\'s press 18 px outside the ring leaves the target where it was', near(dv, [0, 0], 1e-12), dv);
}
{
  // (20 px inside the ring, 20 px left of its centre: z = 0.75 on the lit patch of 1, |0.75² − 1| = 0.4375 < 0.5; a
  // finger's band inside a 40 px ring reaches 13⅓ px. The patch drags the target so that its point under the finger
  // stays under it: z 0.75 → 0.75 − 0.2i, w by (0.75 − 0.2i)² − 0.75² = −0.04 − 0.3i; the ring would move it by −0.2i)
  await open(390, 844, FLAT);
  const R = await ring(), d0 = await disc();
  if (R) {
    await dragBy(true, [R.c[0] - 20, R.c[1]], 0, 16);
    const dv = moved(d0, await disc());
    info['flat in'] = { R, dv };
    ok('flat: a finger\'s press 20 px inside the ring, on the lit patch of 1, drags the patch, not the ring', near(dv, [-0.04, -0.3], 0.01), dv);
  }
}
{
  // (the line from −1 to the centre, 16 px below it 100 px left of the ring: outside the ring's bands, on no patch)
  await open(390, 844, FLAT);
  const R = await ring(), d0 = await disc(), L = await ev('__cmwLookDown()');
  if (R) {
    await dragBy(true, [R.c[0] - 100, R.c[1] + 16], 24, 0);
    const dv = moved(d0, await disc());
    info['flat line'] = { dv, lines: L.lines };
    ok('flat: a finger\'s press 16 px off a line to the target drags the target (the lines 44 px wide to a finger)', near(dv, [0.3, 0], 0.01), dv);
  }
}

// ---- the Stack in Tilt (pitch 20°): the ring an ellipse on the glass
// the ring's points on the page through the glass's map of the last frame
const ellipse = (c, r) => ev(`(() => { const o = document.getElementById('overlayL').getBoundingClientRect(), G = __cmwStack().drawn.glass, out = []; for (let i = 0; i < 64; i++) { const a = 2 * Math.PI * i / 64, q = __cmwPlaneMenu().w2s('L', ${c[0]} + ${r} * Math.cos(a), ${c[1]} + ${r} * Math.sin(a)), u = q[0] - o.left, v = q[1] - o.top; out.push([o.left + G[0] * u + G[2] * v + G[4], o.top + G[1] * u + G[3] * v + G[5]]); } return out; })()`);
for (const finger of [true, false]) {
  const who = finger ? 'a finger' : 'a mouse';
  await open(390, 844, {});
  await cam(0, 20);
  const pts = await ellipse([1.1, 0], 0.25), top = pts.reduce((a, b) => (b[1] < a[1] ? b : a)), bot = pts.reduce((a, b) => (b[1] > a[1] ? b : a));
  // (18 px off the ellipse along its minor axis, above it, or below it where the glass is not above)
  const o = await pane(), on = async (p) => { const k = await ev(`__cmwStack({ pick: [${p[0]} - ${o[0]}, ${p[1]} - ${o[1]}] })`); return !!k.glass && k.glass.on; };
  let spot = [top[0], top[1] - 18];
  if (!(await on(spot))) spot = [bot[0], bot[1] + 18];
  const d0 = await disc(), n0 = await nShapes();
  info[`tilt ${who}`] = { top, bot, spot, minor: (bot[1] - top[1]) / 2 };
  await dragBy(finger, spot, 24, 0);
  const d1 = await disc(), dv = moved(d0, d1);
  info[`tilt ${who}`].dv = dv;
  if (finger) ok('Tilt: a finger\'s press 18 px off the ring\'s ellipse on the glass drags the target', Math.hypot(...dv) > 0.05 && (await nShapes()) === n0, info[`tilt ${who}`]);
  else ok('Tilt: a mouse\'s press 18 px off the ring\'s ellipse leaves the target where it was', near(dv, [0, 0], 1e-12), info[`tilt ${who}`]);
}

// ---- the Tilt key: 44 × 44, Look down ⇄ Tilt, the camera kept in S.sv
await open(390, 844, {});
{
  const camNow = async () => { const p = await ev('__cmwFigureState()'); return p && p.sv && p.sv.cam; };
  await cam(0, 90);
  const k = await box('#plotL .ph-tilt');
  info.key = { k };
  ok('the Tilt key is shown on the Stack, at least 44 × 44', !!k && k[2] - k[0] >= 44 && k[3] - k[1] >= 44, k);
  if (k) {
    const tap = async () => { await touch('touchStart', [[(k[0] + k[2]) / 2, (k[1] + k[3]) / 2]]); await touch('touchEnd', []); await frames(); await sleep(400); await frames(); };
    await tap();
    const p1 = (await ev('__cmwStack()')).camera.pitch, c1 = await camNow();
    await tap();
    const p2 = (await ev('__cmwStack()')).camera.pitch, c2 = await camNow();
    info.key.taps = { p1, c1, p2, c2 };
    ok('a tap on the Tilt key turns Look down to Tilt, and S.sv keeps the camera', p1 < 85 * DEG && Array.isArray(c1) && c1[1] < 85, info.key.taps);
    ok('a second tap turns it back to Look down', Math.abs(p2 - 90 * DEG) < 1e-6 && Array.isArray(c2) && c2[1] === 90, info.key.taps);
  }
}

// ---- a second finger: the camera turns, and the first finger's pick is dropped
await open(390, 844, {});
await cam(0, 40);
{
  const o = await pane(), mid = [Math.round((o[0] + o[2]) / 2), Math.round((o[1] + o[3]) / 2)], a = [mid[0] - 50, mid[1]], b = [mid[0] + 30, mid[1]];
  const y0 = (await ev('__cmwStack()')).camera.yaw, n0 = await nShapes(), d0 = await disc();
  await touch('touchStart', [a]);
  await sleep(120);
  await touch('touchStart', [a, b]);
  for (let i = 1; i <= 8; i++) { await touch('touchMove', [[a[0] + 8 * i, a[1]], [b[0] + 8 * i, b[1]]]); await sleep(20); }
  await touch('touchEnd', []);
  await sleep(600); await frames();
  const s = await ev('__cmwStack()'), lit = (await ev('__cmwPick()')).lit, d1 = await disc();
  info.second = { dyaw: s.camera.yaw - y0, lit, hov: s.hov };
  ok('a second finger turns the camera', Math.abs(s.camera.yaw - y0) > 5 * DEG, info.second);
  ok('a second finger leaves no pick behind: no lit twins, no pin, no shape, the target where it was', !lit && !(s.hov && s.hov.pinned) && (await nShapes()) === n0 && near(moved(d0, d1), [0, 0], 1e-12), info.second);
}

// ---- the keys, the bar and the box at the phone sizes, in Tilt
for (const [w, h, lang] of [[360, 640, 'en'], [390, 844, 'ru'], [740, 360, 'it'], [600, 320, 'en'], [568, 320, 'ru']]) {
  const at = `${w}×${h} ${lang}`;
  await open(w, h, { lang });
  await cam(0, 35);
  await sleep(300); await frames();
  const P = await pane(), tilt = await box('#plotL .ph-tilt'), ld = await box('#plotL .ld-key'), sph = await box('#plotL .ph-col > .ph-sph');
  const bar = await ev(`(() => { const c = document.querySelector('.ph-ctx.in:not(.under)'); return c ? c.getBoundingClientRect().top : Infinity; })()`);
  const others = await ev(`[...document.querySelectorAll('#plotL > .chip, #plotL > .legend-chip, #plotL > .viewstack, #plotL > .ph-col, #plotL > .empty-chip, #plotL > .draft-chip, #toastHost .toast')].filter((e) => !e.hidden && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map((e) => { const r = e.getBoundingClientRect(); return { k: e.className, b: [r.left, r.top, r.right, r.bottom] }; })`);
  // (the box: the pane's corners through the floor's and the glass's maps; the labels' plates as placed)
  const s = await ev('__cmwStack()'), d = s.drawn, corners = [];
  for (const m of [d.floor, d.glass]) for (const [u, v] of [[0, 0], [P[2] - P[0], 0], [0, P[3] - P[1]], [P[2] - P[0], P[3] - P[1]]]) corners.push([P[0] + m[0] * u + m[2] * v + m[4], P[1] + m[1] * u + m[3] * v + m[5]]);
  const bx = [Math.min(...corners.map((q) => q[0])), Math.min(...corners.map((q) => q[1])), Math.max(...corners.map((q) => q[0])), Math.max(...corners.map((q) => q[1]))];
  const labels = ((d.tubes && d.tubes.labels) || []).filter((L) => L.box).map((L) => [P[0] + L.box[0], P[1] + L.box[1], P[0] + L.box[2], P[1] + L.box[3]]);
  info[at] = { P, tilt, ld, sph, bar, others, bx, labels };
  ok(`${at}: the Tilt key is shown, at least 44 × 44, above the context bar`, !!tilt && tilt[2] - tilt[0] >= 44 && tilt[3] - tilt[1] >= 44 && tilt[3] <= bar + 0.5, { tilt, bar });
  ok(`${at}: Look down's key is above the context bar and meets neither the Tilt key nor the plane's other keys`, !!ld && ld[3] <= bar + 0.5 && !(tilt && meets(ld, tilt)) && !others.some((q) => meets(q.b, ld)), { ld, tilt, others });
  ok(`${at}: the Tilt key meets none of the plane's other keys, nor a toast`, !!tilt && !others.filter((q) => !(inside(tilt, q.b))).some((q) => meets(q.b, tilt)), { tilt, others });
  // (on a landscape phone the column's keys already reach the head: there the Tilt key stands beside them, not above)
  ok(`${at}: the Tilt key raises the column neither above the pane nor above the column's Sphere key`, !!tilt && !!sph && tilt[1] >= Math.min(P[1], sph[1]) - 0.5, { tilt, sph, P });
  ok(`${at}: the box lies in the pane, above the context bar`, inside(bx, P) && bx[3] <= bar + 0.5, { bx, P, bar });
  ok(`${at}: the tubes' labels lie in the pane, clear of the keys and above the bar`, labels.every((L) => inside(L, P) && L[3] <= bar + 0.5 && !(ld && meets(L, ld)) && !(tilt && meets(L, tilt))), { labels, ld, tilt, bar });
}

return { pass: fails.length === 0, passed: pass, fails, info };
