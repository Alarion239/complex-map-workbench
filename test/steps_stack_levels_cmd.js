// The Stack's floor and glass (19-stack.js), on M3 z³ − 1.2z + 0.3 with the disc |w − 1.1| < 0.25 on w₁ selected on z:
//  - seen straight down (pitch 90°, yaw 0), the Stack's frame for the pane, its floor on the main canvas and its marks
//    on the overlay, is pixel-equal to Look down's frame on the flat plane (__cmwStack({ same }) counts the device px
//    that differ: 0 on both canvases);
//  - the control: a camera 1° off straight down, by pitch or by yaw, differs on both canvases, so the count sees a tilt;
//  - on the Stack surface the left plane is not flat (no rulers, no flat overlays), and the levels are drawn in the one
//    order floor, floor marks, tubes, lines, glass, glass marks, labels at every camera of a turn round the box and up to
//    straight down;
//  - tilted, the overlay holds the glass's ink where the target's ring and the glass's rim project, wherever the camera;
//  - the head's Surface button reads Stack and is named so, and the Surface menu checks it; at 320 × 568, where the head
//    shows the button as its icon and ▾, the Stack has an icon;
//  - a hover on the tilted floor reads no point (the flat plane's values there would be another point's);
//  - a drag on the plane turns the Stack's camera, and its pitch stays at or above 10°.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const LOAD_MS = 40000, READY_MS = 60000;
const fails = [], info = {};
let pass = 0;
const ok = (name, cond, got) => { if (cond) pass++; else fails.push({ name, got }); };
const until = (expr, max = READY_MS) => settled({ until: expr, max });
const frames = () => ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
const DEG = Math.PI / 180;
const M3 = [{ type: 'custom', params: { expr: 'z^3-1.2z+0.3' }, on: true }];
const ORDER = ['floor', 'floor marks', 'tubes', 'lines', 'glass', 'glass marks', 'labels'];
const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'd', kind: 'disc', c: [1.1, 0], r: 0.25, stage: 1 }], steps: M3, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 80 } };
const open = async (w, h, phone) => {
  const ns = `stack-${Date.now()}`;
  await view(w, h, false, phone);
  await nav(`http://localhost:${PORT}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await nav(`http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps`);
  await until("typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip .sv-plane')", LOAD_MS);
  await until('__cmwSteps().ready.ready && __cmwSteps().i === 0');
};
await open(1440, 900, false);
await ev(`__cmwSelect('d'); 1`);
await until(`__cmwShapes().selected === 'd' && typeof __cmwLookDown === 'function' && !!__cmwLookDown()`);
await frames(); await frames();
await until('true');

// seen straight down, the Stack's frame is Look down's
const hooked = await ev('typeof __cmwStack === "function"');
ok('the page has the Stack (__cmwStack)', hooked, hooked);
const same = async (yaw, pitch) => { await until('true'); return hooked ? ev(`__cmwStack({ same: { yaw: ${yaw}, pitch: ${pitch} } })`) : null; };
const top = await same(0, 90 * DEG);
info.top = top;
ok('straight down, the floor is pixel-equal to Look down\'s plane', !!top && top.px > 0 && top.main === 0, top);
ok('straight down, the floor\'s and the glass\'s marks are pixel-equal to Look down\'s', !!top && top.over === 0, top);
const tiltP = await same(0, 89 * DEG), tiltY = await same(1 * DEG, 90 * DEG);
info.control = { pitch89: tiltP, yaw1: tiltY };
ok('control: 1° of pitch off straight down changes the floor and the marks', !!tiltP && tiltP.main > 0 && tiltP.over > 0, tiltP);
ok('control: 1° of yaw changes the floor and the marks', !!tiltY && tiltY.main > 0 && tiltY.over > 0, tiltY);

// a hover over the plane's middle, then the left readout's text (control: on the flat plane it reads the point, |z| included)
const hoverText = async () => {
  const mid = await ev(`(() => { const r = document.getElementById('overlayL').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height * 0.6]; })()`);
  for (const dx of [0, 6, 12]) await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: mid[0] + dx, y: mid[1] });
  await frames();
  const t = await ev(`document.getElementById('leftReadout').textContent`);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 2, y: 2 });
  await frames();
  return t;
};
const flatHover = await hoverText();
ok('control: a hover on the flat plane reads the point', flatHover.includes('|z|'), flatHover);

// the Stack surface
await ev(`__cmwSteps({ surf: 'stack' }); 1`);
if (hooked) await until(`__cmwSteps().surf === 'stack' && !!__cmwStack().drawn`, 20000);
const s0 = hooked ? await ev('__cmwStack()') : null;
const rulers = await ev(`getComputedStyle(document.querySelector('#paneL .ruler')).visibility`);
info.surface = { s0, rulers };
ok('on the Stack the left plane is not flat: no rulers', !!s0 && s0.on && !s0.lflat && rulers === 'hidden', { s0, rulers });
ok('the Stack opens tilted, with the marks', !!s0 && s0.camera.pitch < 89 * DEG && s0.drawn.marks, s0);
// a turn round the box, and up to straight down
const CAMS = [[-30, 35], [60, 20], [150, 60], [-120, 88], [-170, 10], [0, 90]];
const seen = [];
for (const [yaw, pitch] of hooked ? CAMS : []) {
  await ev(`__cmwCam('L', { yaw: ${yaw * DEG}, pitch: ${pitch * DEG} }); 1`);
  await until(`(() => { const d = __cmwStack().drawn; return !!d && Math.abs(d.camera.yaw - ${yaw * DEG}) < 1e-9 && Math.abs(d.camera.pitch - ${pitch * DEG}) < 1e-9; })()`, 10000);
  const d = (await ev('__cmwStack()')).drawn;
  // the ring's point east of the target, and the middle of the glass's near edge, through the glass's map (css px)
  const ink = await ev(`(() => {
    const d = __cmwStack().drawn, G = d.glass, at = (x, y) => [G[0] * x + G[2] * y + G[4], G[1] * x + G[3] * y + G[5]];
    const o = document.getElementById('overlayL'), dpr = o.width / o.getBoundingClientRect().width;
    const pw = __cmwPlaneMenu().w2s('L', 1.35, 0), c0 = o.getBoundingClientRect();
    const alpha = (p) => { const x = Math.round(p[0] * dpr), y = Math.round(p[1] * dpr), q = o.getContext('2d').getImageData(x - 2, y - 2, 5, 5).data; let a = 0; for (let i = 3; i < q.length; i += 4) a = Math.max(a, q[i]); return a; };
    const W = c0.width, H = c0.height;
    return { ring: alpha(at(pw[0] - c0.left, pw[1] - c0.top)), rim: alpha(at(W / 2, H)) };
  })()`);
  seen.push({ yaw, pitch, order: d.order, marks: d.marks, ink });
}
info.turn = seen;
ok('the levels are drawn in one order at every camera', seen.length === CAMS.length && seen.every((s) => JSON.stringify(s.order) === JSON.stringify(ORDER)), seen.map((s) => s.order));
ok('the marks are drawn at every camera', seen.every((s) => s.marks), seen);
ok('the target\'s ring on the glass holds ink at every camera', seen.every((s) => s.ink.ring > 0), seen.map((s) => s.ink));
ok('tilted, the glass\'s rim holds ink at its near edge', seen.filter((s) => s.pitch < 90).every((s) => s.ink.rim > 0), seen.map((s) => s.ink));

// the head's Surface button and its menu say the Stack, to the eye and in the button's name
const head = await ev(`(() => { const b = document.querySelector('.sv-surf1'); return b ? { text: b.querySelector('.sv-surf-t').textContent, label: b.getAttribute('aria-label') } : null; })()`);
await ev(`document.querySelector('.sv-surf1').click(); 1`);
await frames();
const checked = await ev(`[...document.querySelectorAll('[role=menuitemradio][aria-checked=true]')].map((e) => e.textContent.trim())`);
for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
await frames();
const menuOpen = await ev(`[...document.querySelectorAll('[role=menuitemradio]')].some((e) => e.offsetParent !== null)`);
ok('the Surface menu closes on Escape', !menuOpen, menuOpen);
info.head = { head, checked };
ok('the head\'s Surface button reads Stack, and is named "Surface: Stack"', !!head && head.text === 'Stack' && head.label === 'Surface: Stack', head);
ok('the Surface menu checks Stack', checked.length === 1 && checked[0] === 'Stack', checked);
// the pointer over the tilted floor reads no point: the flat plane's values would be another point's
const hovered = await hoverText();
info.hover = { flat: flatHover, stack: hovered };
ok('a hover on the Stack reads no point in the readout', !hovered.includes('|z|'), info.hover);

// a drag turns the camera
await ev(`__cmwCam('L', { yaw: ${-30 * DEG}, pitch: ${35 * DEG} }); 1`);
await frames();
const ob = await ev(`(() => { const r = document.getElementById('overlayL').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
await drag(ob[0], ob[1], ob[0] + 80, ob[1] - 200, 12, 16);
await frames();
const turned = hooked ? await ev('__cmwStack().camera') : { yaw: -30 * DEG, pitch: 35 * DEG };
info.turned = turned;
ok('a drag on the plane turns the Stack\'s camera', Math.abs(turned.yaw + 30 * DEG) > 5 * DEG, turned);
ok('a drag down to the floor stops at a pitch of 10°', Math.abs(turned.pitch - 10 * DEG) < 1e-9, turned);

// at 320 × 568 the head shows the Surface button as its icon and ▾: on the Stack the icon is the Stack's own
await open(320, 568, true);
await ev(`__cmwSteps({ surf: 'stack' }); 1`);
await until(`__cmwSteps().surf === 'stack' && document.querySelector('.sv-surf1').getAttribute('aria-label') === 'Surface: Stack'`, 20000);
await frames();
const small = await ev(`(() => { const b = document.querySelector('.sv-surf1'), i = b.querySelector('.sv-surf-i svg'), r = i && i.getBoundingClientRect(), t = b.querySelector('.sv-surf-t'); return { icon: r ? [Math.round(r.width), Math.round(r.height)] : null, word: t && t.getClientRects().length ? t.textContent : '', label: b.getAttribute('aria-label') }; })()`);
info.small = small;
ok('at 320 × 568 the Surface button shows an icon on the Stack', !!small.icon && small.icon[0] > 0 && small.icon[1] > 0, small);

return { pass: fails.length === 0, passed: pass, fails, info };
