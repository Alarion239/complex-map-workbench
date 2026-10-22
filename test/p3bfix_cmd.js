// P3b review fixes (the 14 confirmed findings): the C-handle ∞ snap, Space and buttons, double-click on a globe,
// the tool's idle hints and cursors, draft handles, the probe during a gesture, list rows that follow kind changes,
// unit-direction half-planes, the Space-held orbit the perf units use.
// A command file for a CDP daemon (test/cdp_kit README):  python3 build.py && test/<you>_cdp/q.sh test/p3bfix_cmd.js
// Prints {pass, fails, results}; pass is true when every check holds.
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 700) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
await view(1440, 900, false);
const paneR0 = async (side) => ev(`(() => { const r = document.getElementById('${side === 'L' ? 'canvasL' : 'canvasR'}').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()`);
const at = async (side, x, y) => { const o = await paneR0(side); const q = await ev(`__cmwGlobeXY('${side}', ${x}, ${y})`); return q ? [o[0] + q[0], o[1] + q[1]] : null; };
// the page position of a point P of the sphere (through its planar point; null at N or on the far side)
const atP = async (side, P) => { const z = await ev(`(() => { const z = Region.Globe.unlift(${JSON.stringify(P)}); return z ? [z.re, z.im] : null; })()`); return z ? at(side, z[0], z[1]) : null; };
const tool = async (t) => ev(`document.querySelector('#tools .tool[data-tool="${t}"]').click(); 1`);
const shapes = async () => ev('__cmwShapes()');
const M = (type, x, y, extra = {}) => send('Input.dispatchMouseEvent', Object.assign({ type, x, y }, extra));
const cursorL = async () => ev(`document.getElementById('overlayL').style.cursor`);
const readL = async () => ev(`document.getElementById('leftReadout').textContent`);
const readR = async () => ev(`document.getElementById('rightReadout').textContent`);
const DEG = Math.PI / 180;
const sph = (pol, az) => [Math.sin(pol) * Math.cos(az), Math.sin(pol) * Math.sin(az), Math.cos(pol)];
const capShape = async (C, h, kind = 'disc') => ev(`(() => { const s = { kind: '${kind}', c: [0, 0], r: 1 }; Region.Globe.applyCap(s, ${JSON.stringify(C)}, ${h}); return s; })()`);

// ---- 1. the C handle keeps the ∞ snap (finding 1) ----
// a disc cap with h = 0.5 (alpha = 60 deg) and C 100 deg from N, facing the camera
const cam = { pitch: 0.55, yaw: -1.0 };
const az = -2.2;   // an azimuth that faces the camera from (yaw -1.0, pitch 0.55) (checked below: on screen)
const capD = await capShape(sph(100 * DEG, az), 0.5);
await load('p3bfix1' + Date.now(), { shapes: [Object.assign({ id: 's1', ci: 0 }, capD)], steps: [], srcView: { cx: 0, cy: 0, s: 80 }, snap: false, nextId: 2 });
await ev('__cmwSetView("L", "sphere"); 1'); await settle(1500);
await ev(`__cmwCam("L", ${JSON.stringify(cam)}); 1`); await settle(800);
await tool('select');
await ev(`__cmwSelect('s1'); 1`); await settle(300);
const Rpx = (await ev(`__cmwGlobeSnap('L', 400, 400, 'round')`) || {}).R || 150;
R.Rpx = Rpx;
const dragC = async (polDeg) => {
  const H = await ev(`__cmwGlobeHandles('L')`);
  const o = await paneR0('L');
  const hc = H.find((h) => h[0] === 'C');
  const to = await atP('L', sph(polDeg * DEG, az));
  if (!hc || !hc[1] || !to) return { err: 'off screen', H, to };
  const x0 = o[0] + hc[1][0], y0 = o[1] + hc[1][1];
  await M('mouseMoved', x0, y0);
  await M('mousePressed', x0, y0, { button: 'left', clickCount: 1 });
  for (let i = 1; i <= 30; i++) { await M('mouseMoved', x0 + (to[0] - x0) * i / 30, y0 + (to[1] - y0) * i / 30, { button: 'left', buttons: 1 }); await sleep(12); }
  const chip = await readL();
  await M('mouseReleased', to[0], to[1], { button: 'left', clickCount: 1 });
  await settle(400);
  const s = (await shapes()).shapes[0];
  return { s, chip };
};
// the rim 0.01 deg from N (about 0.04 px): the half-plane, as a drawn rim or a slide
const c1 = await dragC(60.01);
R.c1 = c1;
ok('C handle dragged until the rim is 0.01 deg from N: stored as a half-plane (the ∞ snap)', c1.s && c1.s.kind === 'halfplane', c1);
ok('...and the chip said half-plane during the drag (no huge r)', c1.chip && /half-plane/.test(c1.chip), c1.chip);
// the sidebar row follows the kind change at once (finding 8) and writes the unit-direction form (finding 7)
const row1 = await ev(`(() => { const b = document.querySelector('#shapeList .shape[data-id="s1"]'); return b ? { name: b.querySelector('.k').textContent, tex: b.querySelector('.d').title } : null; })()`);
R.row1 = row1;
ok('the shape row is renamed Half-plane and its formula is an equation without a quotient', row1 && /^Half-plane/.test(row1.name) && !/frac/.test(row1.tex), row1);
await key('z', 4); await settle(400);   // undo (Meta+Z) back to the disc
const back = (await shapes()).shapes[0];
ok('one undo restores the disc', back && back.kind === 'disc' && Math.abs(back.r - capD.r) < 1e-9, back);
// 10 px of arc off N (more than the 8 px snap): a disc with r <= R/8 (the bound the snap keeps)
const c2 = await dragC(60 + (10 / Rpx) / DEG);
R.c2 = c2;
ok('C handle 10 px of arc from N: a disc with r bounded (r <= R/8 px)', c2.s && c2.s.kind === 'disc' && c2.s.r <= Rpx / 8 * 1.05, { c2, bound: Rpx / 8 });

// ---- 2. Space does not press a mouse-focused button (finding 2) ----
await load('p3bfix2' + Date.now(), { shapes: [], steps: [], srcView: { cx: 0, cy: 0, s: 80 }, snap: true });
await ev('__cmwSetView("L", "sphere"); 1'); await settle(1500);
await ev(`__cmwCam("L", ${JSON.stringify(cam)}); 1`); await settle(600);
await tool('point');
for (const [x, y] of [[0.5, 0.5], [-0.5, 1]]) { const p = await at('L', x, y); await click(p[0], p[1]); await settle(250); }
const nBefore = (await shapes()).shapes.length;
await clickSel('#undoBtn'); await settle(300);
const nAfterUndo = (await shapes()).shapes.length;
const focused = await ev('document.activeElement && document.activeElement.id');
// (a real Space key: code 'Space', as a keyboard sends it)
await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'Space', key: ' ', text: ' ', windowsVirtualKeyCode: 32 });
await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'Space', key: ' ', windowsVirtualKeyCode: 32 });
await settle(300);
const nAfterSpace = (await shapes()).shapes.length;
R.space = { nBefore, nAfterUndo, focused, nAfterSpace };
ok('Space after a mouse click on Undo turns nothing into a second Undo', nBefore === 2 && nAfterUndo === 1 && nAfterSpace === 1, R.space);

// ---- 3. double-click on a globe (finding 3) ----
await ev(`__cmwCam("L", ${JSON.stringify(cam)}); 1`); await settle(500);
const nPts0 = (await shapes()).shapes.length;
const pd = await at('L', 0.7, 0.9);
await M('mouseMoved', pd[0], pd[1]);
await M('mousePressed', pd[0], pd[1], { button: 'left', clickCount: 1 }); await M('mouseReleased', pd[0], pd[1], { button: 'left', clickCount: 1 });
await M('mousePressed', pd[0], pd[1], { button: 'left', clickCount: 2 }); await M('mouseReleased', pd[0], pd[1], { button: 'left', clickCount: 2 });
await settle(900);
const nPts1 = (await shapes()).shapes.length, camAfter = await ev('__cmwCam("L")');
R.dbl = { nPts0, nPts1, camAfter };
ok('Point tool double-click: one point, the camera kept', nPts1 === nPts0 + 1 && Math.abs(camAfter.yaw - cam.yaw) < 1e-6 && Math.abs(camAfter.pitch - cam.pitch) < 1e-6, R.dbl);
// Select on empty space: the double-click still brings the camera home
await tool('select');
const far = await at('L', 1.5, -1);
await M('mouseMoved', far[0], far[1]);
await M('mousePressed', far[0], far[1], { button: 'left', clickCount: 1 }); await M('mouseReleased', far[0], far[1], { button: 'left', clickCount: 1 });
await M('mousePressed', far[0], far[1], { button: 'left', clickCount: 2 }); await M('mouseReleased', far[0], far[1], { button: 'left', clickCount: 2 });
await settle(1200);
const camHome = await ev('__cmwCam("L")');
R.dblHome = camHome;
ok('Select double-click on empty space resets the camera', Math.abs(camHome.yaw - cam.yaw) > 0.01 || Math.abs(camHome.pitch - cam.pitch) > 0.01, camHome);
await ev(`__cmwCam("L", ${JSON.stringify(cam)}); 1`); await settle(500);

// ---- 4. idle hints and cursors (findings 4, 6, 12) ----
await move(5, 5); await settle(200);
await tool('disc'); await settle(200);
const hDisc = await readL();
await tool('select'); await settle(200);
const hSel = await readL();
await tool('annulus'); await settle(200);
const hAnn = await readL();
R.hints = { hDisc, hSel, hAnn };
ok('idle hint on the editable X globe follows the tool', /Drag to draw a disc/.test(hDisc) && /Space/.test(hDisc) && /a shape to move it/.test(hSel) && /^Drag to turn; ∞/.test(hAnn), R.hints);
await tool('point'); await settle(150);
const inf = await at('L', NaN, NaN);
await move(inf[0] + 3, inf[1] + 2); await settle(150);
const curInf = await cursorL();
const away = await at('L', 0.5, 0.5);
await move(away[0], away[1]); await settle(150);
const curAway = await cursorL();
R.cursor = { curInf, curAway };
ok('Point tool: not-allowed within 10 px of ∞, crosshair elsewhere', curInf === 'not-allowed' && curAway === 'crosshair', R.cursor);
const tip = await ev(`document.querySelector('#tools .tool[data-tool="select"]').dataset.desc`);
ok('the Select tooltip mentions turning a sphere', /sphere/.test(tip), tip);

// ---- 5. a draft shows its handles; the probe is gone during a gesture (findings 5, 10, 14) ----
await tool('circle'); await settle(150);
const d0 = await at('L', 0.4, 0.6), d1 = await at('L', 1.2, 0.2);
await M('mouseMoved', d0[0], d0[1]); await settle(100);
await M('mousePressed', d0[0], d0[1], { button: 'left', clickCount: 1 });
for (let i = 1; i <= 8; i++) { await M('mouseMoved', d0[0] + (d1[0] - d0[0]) * i / 8, d0[1] + (d1[1] - d0[1]) * i / 8, { button: 'left', buttons: 1 }); await sleep(16); }
await settle(200);
const ovl = await ev(`(() => { const o = document.getElementById('overlayL'), r = o.getBoundingClientRect(), d = o.width / r.width; const g = o.getContext('2d'); const px = (x, y) => Array.from(g.getImageData(Math.round((x - r.left) * d), Math.round((y - r.top) * d), 1, 1).data); return { c: px(${d0[0]}, ${d0[1]}), rim: px(${d1[0]}, ${d1[1]}) }; })()`);
const chipDraft = await readL();
await M('mouseReleased', d1[0], d1[1], { button: 'left', clickCount: 1 });
await settle(300);
R.draft = { ovl, chipDraft };
ok('a Circle being drawn on the globe shows its centre and rim handles', ovl.c[3] > 200 && ovl.rim[3] > 200, ovl);
ok('during the gesture the readout is the set, not a probe at the press point', !/\|z\|/.test(chipDraft) && /circle|line/.test(chipDraft), chipDraft);
const after = await readL();
ok('after release no probe readout stays at the press point', !/\|z\|/.test(after), after);

// ---- 6. a slide through N: the row name and the open editor follow (finding 8) ----
await load('p3bfix6' + Date.now(), { shapes: [{ id: 's1', ci: 0, kind: 'disc', c: [0.6, 2.2], r: 0.7 }], steps: [], srcView: { cx: 0, cy: 0, s: 80 }, snap: false, nextId: 2 });
await ev('__cmwSetView("L", "sphere"); 1'); await settle(1500);
await ev(`__cmwCam("L", ${JSON.stringify(cam)}); 1`); await settle(600);
await tool('select');
await ev(`__cmwSelect('s1'); 1`); await settle(300);
// pressed on the disc and slid over N to the far side of it (N's screen point mirrored)
const sA = await at('L', 0.6, 2.2), nS = await at('L', NaN, NaN);
R.slidePts = { sA, nS };
const sB = sA && nS ? [2 * nS[0] - sA[0], 2 * nS[1] - sA[1]] : null;
if (!sB) return { pass: false, fails: fails.concat([{ name: 'slide: points off screen', got: R.slidePts }]), results: R };
await M('mouseMoved', sA[0], sA[1]);
await M('mousePressed', sA[0], sA[1], { button: 'left', clickCount: 1 });
const seen = [];
for (let i = 1; i <= 8; i++) {
  await M('mouseMoved', sA[0] + (sB[0] - sA[0]) * i / 8, sA[1] + (sB[1] - sA[1]) * i / 8, { button: 'left', buttons: 1 }); await sleep(30);
  seen.push(await ev(`(() => { const s = __cmwShapes().shapes[0]; const b = document.querySelector('#shapeList .shape[data-id="s1"]'); const inp = b && b.querySelectorAll('.shape-edit input'); return { kind: s.kind + (s.complement ? '~' : ''), c: s.c, r: s.r, name: b && b.querySelector('.k').textContent, ed: inp ? Array.from(inp).map((x) => x.value) : null }; })()`));
}
await M('mouseReleased', sB[0], sB[1], { button: 'left', clickCount: 1 });
await settle(300);
R.slide = seen;
const nameOk = seen.every((v) => (v.kind === 'halfplane' ? /^Half-plane/.test(v.name) : /^Disc/.test(v.name)));
const edOk = seen.filter((v) => v.kind === 'disc' && v.ed && v.ed.length >= 2).every((v) => Math.abs(parseFloat(v.ed[1]) - v.r) < 1e-4 * Math.max(1, v.r));
ok('during the slide the row name follows the kind', nameOk, seen.map((v) => [v.kind, v.name]));
ok('during the slide the open editor shows the stored radius', edOk, seen.map((v) => [v.kind, v.r, v.ed]));

// ---- 7. the landscape takes no drawing: cursor and hint (finding 12) ----
await ev('__cmwSetView("L", "land"); 1'); await settle(1500);
await tool('disc'); await settle(200);
await move(5, 5); await settle(150);
const landHint = await readL();
const lp = await paneR0('L');
await move(lp[0] + lp[2] / 2, lp[1] + lp[3] / 2); await settle(150);
const landCur = await cursorL();
await move(5, 5); await settle(150);
R.land = { landHint, landCur };
// (merged views: the landscape is its own view, so the hint names the view that draws, "Draw in X → Y (1)")
ok('Landscape with a drawing tool: not-allowed and "Draw in X → Y (1)"', landCur === 'not-allowed' && /Draw in X → Y \(1\)/.test(landHint), R.land);
await tool('select');

// ---- 8. the perf units' orbit: Space held turns an editable globe over a region (finding 11) ----
await load('p3bfix8' + Date.now(), { shapes: [{ id: 's1', ci: 0, kind: 'halfplane', a: [0, 0], b: [1, 0] }], steps: [], srcView: { cx: 0, cy: 0, s: 80 }, snap: true, nextId: 2 });
await ev('__cmwSetView("L", "sphere"); 1'); await settle(1500);
const c0 = await ev('__cmwCam("L")');
const pr = await paneR0('L');
const x0 = pr[0] + pr[2] / 2 - 80, y0 = pr[1] + pr[3] / 2 - 30;
await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'Space', key: ' ', windowsVirtualKeyCode: 32 });
await drag(x0, y0, x0 + 160, y0 + 60, 40, 16);
await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'Space', key: ' ', windowsVirtualKeyCode: 32 });
await settle(1500);
const c1o = await ev('__cmwCam("L")'), s8 = (await shapes()).shapes[0];
R.orbit = { dyaw: c1o.yaw - c0.yaw, dpitch: c1o.pitch - c0.pitch, s8 };
ok('Space held + left drag over the half-plane turns the globe and leaves the region', Math.abs(R.orbit.dyaw) > 0.1 && s8.kind === 'halfplane' && s8.a[0] === 0 && s8.b[0] === 1, R.orbit);

R.logs = logs().filter((l) => /error|exception/i.test(l.t) && !/404/.test(l.m)).slice(0, 6);
ok('no errors in the console', !R.logs.length, R.logs);
return { pass: !fails.length, fails, results: R };
