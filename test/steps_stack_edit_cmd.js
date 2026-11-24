// Editing the target on the Stack's glass (#1993), on M3 z³ − 1.2z + 0.3 with the disc |w − 1.1| < 0.25 on w₁ selected
// on z, the Stack shown, the Pick tool:
//  - the target's square, its radius handle, is drawn on the glass at c + r through the glass's map, at Tilt (35°) and
//    straight down; a drag of it out to the glass's point c + 0.35 sets r to 0.35, the centre where it was, and one Undo
//    puts r back and says "Undid: edit …";
//  - a drag of the target's ring moves its centre with the pointer, one undo step, said the same way;
//  - the arrows, with the plane focused, nudge the target; a run of three presses is one undo step;
//  - a point pinned on the glass (Shift+Enter) stays pinned while the camera turns and through Tilt ⇄ Look down;
//  - the edits survive a reload of the saved state and a link opened fresh;
//  - on a phone (390 × 844, touch) a finger's press 18 px off the square drags it, where a mouse's press there does not.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
let pass = 0;
const ok = (name, cond, got) => { if (cond) pass++; else fails.push({ name, got }); return !!cond; };
const until = (expr, max = 60000) => settled({ until: expr, max });
const frames = () => ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
const DEG = Math.PI / 180;
const STEPS = [{ type: 'custom', params: { expr: 'z^3-1.2z+0.3' }, on: true }];
const STATE = () => ({ v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'd', kind: 'disc', c: [1.1, 0], r: 0.25, stage: 1 }], steps: STEPS, nextId: 50, focus: 0, srcView: { cx: 0.6, cy: 0, s: 110 }, sv: { at: 0, T: -1, scope: 'all', surf: 'stack', cam: [-30, 35] } });
let NS = '';
// the page on state st (or a link's hash), the target selected and the Pick tool chosen
const open = async (w, h, phone, { st = STATE(), hash = '', ns = `sedit-${Date.now()}` } = {}) => {
  NS = ns;
  await view(w, h, false, phone);
  await nav(`http://localhost:${PORT}/gl-helpers.html`);
  if (st && !hash) await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps${hash}`);
  for (let i = 0; i < 100; i++) { try { if ((await ev(`typeof __cmwSteps === 'function' && !location.hash && !!document.querySelector('#svStrip .sv-plane') && __cmwSteps().ready.ready`)) === true) break; } catch (e) { /* the page reloads */ } await sleep(200); }
  await until('__cmwSteps().ready.ready');
  await ev(`__cmwSelect('d'); 1`);
  await until(`__cmwShapes().selected === 'd' && typeof __cmwStack === 'function' && !!__cmwStack().drawn`, 20000);
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
// the square's place on the page, from the Stack's last frame, or null where none is drawn
const square = () => ev(`(() => { const o = document.getElementById('overlayL').getBoundingClientRect(), d = __cmwStack().drawn, q = d && d.picks && d.picks.square; return q ? [o.left + q[0], o.top + q[1]] : null; })()`);
// a point w = [re, im] of the glass on the page, through the glass's map of the last frame
const onGlass = ([re, im]) => ev(`(() => { const o = document.getElementById('overlayL').getBoundingClientRect(), G = __cmwStack().drawn.glass, q = __cmwPlaneMenu().w2s('L', ${re}, ${im}), u = q[0] - o.left, v = q[1] - o.top; return [o.left + G[0] * u + G[2] * v + G[4], o.top + G[1] * u + G[3] * v + G[5]]; })()`);
const mouse = (type, x, y, o = {}) => send('Input.dispatchMouseEvent', Object.assign({ type, x, y, button: 'none', pointerType: 'mouse' }, o));
const touch = (type, pts) => send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1 })) });
// a drag from a to b in 10 steps, by a mouse or a finger
const dragTo = async (finger, a, b) => {
  const at = (i) => [a[0] + ((b[0] - a[0]) * i) / 10, a[1] + ((b[1] - a[1]) * i) / 10];
  if (finger) {
    await touch('touchStart', [a]);
    for (let i = 1; i <= 10; i++) { await touch('touchMove', [at(i)]); await sleep(15); }
    await touch('touchEnd', []);
  } else {
    await mouse('mouseMoved', a[0], a[1]);
    await mouse('mousePressed', a[0], a[1], { button: 'left', buttons: 1, clickCount: 1 });
    for (let i = 1; i <= 10; i++) await mouse('mouseMoved', ...at(i), { button: 'left', buttons: 1 });
    await mouse('mouseReleased', b[0], b[1], { button: 'left', buttons: 0, clickCount: 1 });
  }
  await frames();
};
// one Undo, and what the toast said
const undo = async () => {
  await ev(`document.getElementById('undoBtn').click()`);
  await sleep(300); await frames();
  return ev(`[...document.querySelectorAll('#toastHost .toast')].map((t) => t.textContent).join(' | ')`);
};
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// ---- the square, at Tilt and straight down
await open(1440, 900, false);
for (const [label, pitch] of [['Tilt (35°)', 35], ['straight down', 90]]) {
  await cam(-30, pitch);
  const sq = await square(), want = await onGlass([1.35, 0]);
  info[`square ${label}`] = { sq, want };
  ok(`${label}: the target's square is drawn on the glass at c + r`, !!sq && !!want && Math.hypot(sq[0] - want[0], sq[1] - want[1]) < 0.5, info[`square ${label}`]);
}
await cam(-30, 35);
{
  const sq = await square(), to = await onGlass([1.45, 0]), d0 = await disc();
  if (sq && to) {
    await dragTo(false, sq, to);
    const d1 = await disc();
    info.resize = { d0, d1 };
    ok('a drag of the square out to c + 0.35 on the glass sets r to 0.35, the centre where it was', near(d1.r, 0.35, 0.005) && d1.c[0] === d0.c[0] && d1.c[1] === d0.c[1], info.resize);
    const said = await undo(), d2 = await disc();
    info.resize.undo = { said, d2 };
    ok('one Undo puts r back, and says "Undid: edit …"', d2.r === 0.25 && /Undid: edit /.test(said), info.resize.undo);
  } else ok('the square to drag', false, { sq, to });
}

// ---- the ring: a drag moves the centre with the pointer, one undo step
{
  const a = await onGlass([1.1, 0.25]), b = await onGlass([1.2, 0.25]), d0 = await disc();
  await dragTo(false, a, b);
  const d1 = await disc();
  info.ring = { d0, d1 };
  ok('a drag of the ring moves the target\'s centre with the pointer (0.1 along the real axis)', near(d1.c[0] - d0.c[0], 0.1, 0.005) && near(d1.c[1], d0.c[1], 0.005) && d1.r === d0.r, info.ring);
  const said = await undo(), d2 = await disc();
  ok('one Undo puts the centre back, and says "Undid: edit …"', d2.c[0] === d0.c[0] && d2.c[1] === d0.c[1] && /Undid: edit /.test(said), { said, d2 });
}

// ---- the arrows nudge the target, a run of presses one undo step
{
  for (let i = 0; i < 8 && (await ev('document.activeElement && document.activeElement.id')) !== 'overlayL'; i++) await key('F6');
  const d0 = await disc();
  for (let i = 0; i < 3; i++) await key('ArrowRight');
  await frames();
  const d1 = await disc();
  info.nudge = { focus: await ev('document.activeElement && document.activeElement.id'), d0, d1 };
  ok('with the plane focused, → nudges the target right, three presses three steps', d1.c[0] > d0.c[0] + 1e-9 && d1.c[1] === d0.c[1] && d1.r === d0.r && (await ev('__cmwSteps()')).i === 0, info.nudge);
  await undo();
  const d2 = await disc();
  ok('the run of nudges is one undo step', d2.c[0] === d0.c[0] && d2.c[1] === d0.c[1], { d0, d2 });
}

// ---- a pin stays while the camera turns, and through Tilt ⇄ Look down
{
  for (let i = 0; i < 8 && (await ev('document.activeElement && document.activeElement.id')) !== 'overlayL'; i++) await key('F6');
  await key('Enter', 8);
  await frames();
  const h0 = (await ev('__cmwStack()')).hov;
  await cam(40, 50);
  const h1 = (await ev('__cmwStack()')).hov;
  await cam(0, 90);
  const h2 = (await ev('__cmwStack()')).hov;
  await cam(-30, 35);
  const h3 = (await ev('__cmwStack()')).hov;
  info.pin = { h0, h1, h2, h3 };
  const same = (h) => !!h && h.pinned && !!h0 && h.w[0] === h0.w[0] && h.w[1] === h0.w[1] && h.zs.length === h0.zs.length;
  ok('a point pinned on the glass stays pinned while the camera turns, and through Look down and back', !!h0 && h0.pinned && same(h1) && same(h2) && same(h3), info.pin);
}

// ---- the edits survive a reload and a link
{
  // (out to c + 0.45: far enough on the foreshortened glass to be a drag, past the pick's slop)
  const sq = await square(), to = await onGlass([1.55, 0]);
  info.saved = { sq, to };
  if (sq && to) await dragTo(false, sq, to);
  const a = await onGlass([1.1, 0.3]), b = await onGlass([1.0, 0.3]);
  await dragTo(false, a, b);
  const d0 = await disc();
  await sleep(600);
  await ev(`(Params.encodeLink(__cmwFigureState()).then((p) => { window.__seLink = p; }), 1)`);
  let payload = null;
  for (let i = 0; i < 50 && !payload; i++) { await sleep(100); payload = await ev('window.__seLink || null'); }
  Object.assign(info.saved, { d0 });
  await open(1440, 900, false, { st: null, ns: NS });
  const d1 = await disc();
  info.saved.reload = d1;
  ok('after a resize and a ring drag, a reload of the saved state keeps the target\'s centre and radius', !!d1 && near(d1.r, d0.r, 1e-12) && near(d1.c[0], d0.c[0], 1e-12) && near(d1.c[1], d0.c[1], 1e-12) && Math.abs(d0.r - 0.25) > 0.01, info.saved);
  if (payload) {
    await open(1440, 900, false, { hash: `#cmw=${payload}` });
    const d2 = await disc();
    info.saved.link = d2;
    ok('a link opened fresh shows the edited target', !!d2 && near(d2.r, d0.r, 1e-9) && near(d2.c[0], d0.c[0], 1e-9) && near(d2.c[1], d0.c[1], 1e-9), info.saved);
  } else ok('the link encodes', false, payload);
}

// ---- a phone: a finger reaches the square 18 px off it, a mouse does not
for (const finger of [true, false]) {
  const who = finger ? 'a finger' : 'a mouse';
  await open(390, 844, true);
  await cam(-30, 35);
  const sq = await square(), d0 = await disc();
  if (!sq) { ok(`phone (${who}): the square is drawn`, false, sq); continue; }
  // (18 px right of the square, off the ring, the glass's point there a little beyond it)
  const a = [sq[0] + 18, sq[1]], b = [sq[0] + 38, sq[1]];
  await dragTo(finger, a, b);
  const d1 = await disc();
  info[`phone ${who}`] = { sq, d0, d1 };
  if (finger) ok('phone: a finger\'s press 18 px off the square drags it: r grows, the centre stays', d1.r > d0.r + 0.01 && d1.c[0] === d0.c[0] && d1.c[1] === d0.c[1], info[`phone ${who}`]);
  else ok('phone: a mouse\'s press 18 px off the square leaves r as it was', d1.r === d0.r, info[`phone ${who}`]);
}

return { pass: fails.length === 0, passed: pass, fails, info };


