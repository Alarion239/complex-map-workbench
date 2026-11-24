// Surface ▸ Stack (#1989, P2d): the Stack as the fourth Surface, on M3 z³ − 1.2z + 0.3 with no shapes, real pointer and
// key events:
//  - the Surface menu opens the Stack in two clicks, with a starter disc on w₁ (selected, said in the live region), whose
//    three pieces are apart (three tubes) and which lies in the view the glass shows (at most 0.15 of its width across),
//    at the Tilt camera; one Undo takes the disc away;
//  - on the desk the head shows the Stack's view control, Tilt | Look down | Plane, on the Stack only: a radio group with
//    one Tab stop (the checked radio); Look down turns the camera straight down (yaw 0), Tilt back to Tilt, Plane leaves
//    for the Plane surface; an arrow key moves the check and keeps the focus on the radio it checked (rvE's row), ← at
//    Tilt stays there (no wrap), and → onto Plane leaves with the focus on the Surface button;
//  - on the Stack the disc card's Look down switch is hidden (the control has a Look down of its own), and on the Plane
//    it shows;
//  - a link carries the Surface and the Stack's camera (Look down opens as Look down), and an old link with no camera
//    opens the Stack at Tilt on the desk;
//  - the zoom key and the wheel zoom the Stack's floor;
//  - on a phone (390 × 844) the head has no view control; the Stack opens in Look down; the plane's key column has a 44 px Tilt key, pressed while
//    tilted, which a tap toggles; the Display sheet carries the same three-state control; an old link opens in Look down.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
let pass = 0;
const ok = (name, cond, got) => { if (cond) pass++; else fails.push({ name, got }); return !!cond; };
const until = (expr, max = 60000) => settled({ until: expr, max });
const frames = () => ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
const DEG = Math.PI / 180;
const STEPS = [{ type: 'custom', params: { expr: 'z^3-1.2z+0.3' }, on: true }];
const STATE = (o = {}) => Object.assign({ v3: true, v4: true, v5: true, v6: true, shapes: [], steps: STEPS, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 110 } }, o);
const hooked = () => ev('typeof __cmwStack === "function"');
const openState = async (st, w, h, phone, hash = '') => {
  const ns = `ssurf-${Date.now()}`;
  await view(w, h, false, phone);
  await nav(`http://localhost:${PORT}/gl-helpers.html`);
  if (!hash) await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps${hash}`);
  for (let i = 0; i < 100; i++) { try { if ((await ev(`typeof __cmwSteps === 'function' && !location.hash && !!document.querySelector('#svStrip .sv-plane') && __cmwSteps().ready.ready`)) === true) break; } catch (e) { /* the page reloads */ } await sleep(200); }
  await until('__cmwSteps().ready.ready');
  await frames();
};
const S = () => ev('__cmwSteps()');
const cam = async () => ((await hooked()) ? (await ev('__cmwStack()')).camera : null);
const near = (a, b) => Math.abs(a - b) < 1e-6;
// the head's view control: its radios' state, and which one has the focus
const ctl = () => ev(`(() => { const g = document.querySelector('.sv-camseg'); if (!g) return null; const r = [...g.querySelectorAll('[role=radio]')]; return { shown: !g.hidden && g.getClientRects().length > 0, role: g.getAttribute('role'), label: g.getAttribute('aria-label'), radios: r.map((b) => ({ v: b.dataset.v, text: b.textContent, checked: b.getAttribute('aria-checked'), tab: b.tabIndex })), focus: r.indexOf(document.activeElement) }; })()`);
const radio = (v) => ev(`(() => { const b = document.querySelector('.sv-camseg [data-v="${v}"]'); if (!b) return null; const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
const lookSwitch = () => ev(`(() => { const e = document.querySelector('.ro-look'); return e ? e.getClientRects().length > 0 : null; })()`);
const settleCam = () => until(`typeof __cmwStack !== 'function' || !__cmwStack().drawn || true`).then(frames).then(() => sleep(500)).then(frames);
const chooseStack = async () => {
  await ev(`document.querySelector('.sv-surf1').click(); 1`);
  await frames();
  const item = await ev(`(() => { const e = [...document.querySelectorAll('[role=menuitemradio]')].find((x) => x.textContent.trim() === 'Stack'); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
  if (item) await click(item[0], item[1]);
  await until(`__cmwSteps().surf === 'stack'`, 20000);
  await frames();
  return !!item;
};

// ---- the desk: two clicks, the starter disc
await openState(STATE(), 1440, 900, false);
const two = await chooseStack();
await until(`typeof __cmwStack === 'function' && !!__cmwStack().drawn && !!__cmwStack().drawn.tubes`, 20000);
const P0 = await ev('__cmwP()'), sel = (await ev('__cmwShapes()')).selected, st0 = (await hooked()) ? await ev('__cmwStack()') : null;
const live0 = await ev(`(document.querySelector('#svStrip [aria-live], [aria-live]') || {}).textContent || ''`);
info.start = { shapes: P0.shapes, sel, live: live0, tubes: st0 && st0.drawn && st0.drawn.tubes && st0.drawn.tubes.pieces.length, camera: st0 && st0.camera };
ok('the Surface menu opens the Stack in two clicks', two && (await S()).surf === 'stack', info.start);
ok('the Stack opens with a starter disc on w₁, selected, and says so', P0.shapes.length === 1 && P0.shapes[0].kind === 'disc' && P0.shapes[0].stage === 1 && sel === P0.shapes[0].id && /starter disc added on w₁/.test(live0), info.start);
ok('the starter disc\'s pieces are apart: three tubes', !!st0 && !!st0.drawn.tubes && st0.drawn.tubes.pieces.length === 3, info.start);
ok('on the desk the Stack opens at Tilt', !!st0 && near(st0.camera.yaw, -30 * DEG) && near(st0.camera.pitch, 35 * DEG), st0 && st0.camera);
{
  // (the view the glass shows is the floor's: [cx, cy, s] and the pane's css size)
  const v = (await S()).win, pw = await ev(`(() => { const r = document.getElementById('overlayL').getBoundingClientRect(); return [r.width, r.height]; })()`), d = P0.shapes[0];
  const W = pw[0] / v[2], H = pw[1] / v[2];
  info.start.view = { v, W, H };
  ok('the starter disc lies in the view the glass shows, at most 0.15 of its width across', !!d && Math.abs(d.c[0] - v[0]) + d.r <= W / 2 && Math.abs(d.c[1] - v[1]) + d.r <= H / 2 && d.r <= 0.15 * W + 1e-9, info.start);
}

// ---- the view control
let c = await ctl();
info.ctl = c;
ok('the head shows the Stack\'s view control: a radio group Tilt | Look down | Plane, Tilt checked', !!c && c.shown && c.role === 'radiogroup' && c.radios.map((r) => r.text).join('|') === 'Tilt|Look down|Plane' && c.radios[0].checked === 'true', c);
ok('the control is one Tab stop: the checked radio', !!c && c.radios.filter((r) => r.tab === 0).length === 1 && c.radios[0].tab === 0, c);
ok('on the Stack the card\'s Look down switch is hidden', (await lookSwitch()) === false, await lookSwitch());
const dn = await radio('down');
if (dn) await click(dn[0], dn[1]);
await settleCam();
let cm = await cam(), st1 = (await hooked()) ? await ev('__cmwStack()') : null;
info.down = { cm, c: await ctl() };
ok('Look down turns the camera straight down, yaw 0, and the control checks it', !!cm && near(cm.pitch, 90 * DEG) && near(cm.yaw, 0) && (await ctl()).radios[1].checked === 'true', info.down);
ok('straight down the tubes are not drawn (the frame is Look down\'s)', !!st1 && st1.drawn && st1.drawn.tubes === null, st1 && st1.drawn && st1.drawn.tubes);
// (the keyboard: the checked radio focused, an arrow key checks the next and keeps the focus on it)
await ev(`document.querySelector('.sv-camseg [aria-checked="true"]').focus(), 1`);
await key('ArrowLeft');
await settleCam();
c = await ctl(); cm = await cam();
info.key = { c, cm };
ok('an arrow key checks the next radio and keeps the focus on it (Tilt, from Look down)', !!c && c.radios[0].checked === 'true' && c.focus === 0 && c.radios[0].tab === 0 && !!cm && near(cm.pitch, 35 * DEG), info.key);
await key('ArrowRight');
await settleCam();
c = await ctl();
ok('the arrow on: Look down checked, the focus on it', !!c && c.radios[1].checked === 'true' && c.focus === 1, c);
// (Tilt by the pointer)
const tl = await radio('tilt');
if (tl) await click(tl[0], tl[1]);
await settleCam();
cm = await cam();
ok('Tilt turns the camera back to Tilt', !!cm && near(cm.yaw, -30 * DEG) && near(cm.pitch, 35 * DEG), cm);
// (← at Tilt stays there: no wrap round to Plane)
await ev(`document.querySelector('.sv-camseg [aria-checked="true"]').focus(), 1`);
await key('ArrowLeft');
await frames();
c = await ctl();
ok('← at Tilt stays at Tilt (no wrap round to Plane), the focus on it', (await S()).surf === 'stack' && !!c && c.radios[0].checked === 'true' && c.focus === 0, c);

// ---- zoom: the key and the wheel
const w0 = (await S()).win;
await ev(`document.getElementById('leftZoomIn').click(); 1`);
await sleep(400); await frames();
const w1 = (await S()).win;
const mid = await ev(`(() => { const r = document.getElementById('overlayL').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height * 0.7]; })()`);
await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: mid[0], y: mid[1], deltaX: 0, deltaY: -300 });
await frames(); await sleep(200);
const w2 = (await S()).win;
info.zoom = { w0, w1, w2 };
ok('the zoom key and the wheel zoom the Stack\'s floor', w1[2] > w0[2] * 1.2 && w2[2] > w1[2], info.zoom);

// ---- a link carries the Surface and the Stack's camera
if (dn) await click(dn[0], dn[1]);
await settleCam();
const fs0 = await ev('__cmwFigureState()');
info.link = { sv: fs0 && fs0.sv };
ok('a link carries the Stack and its camera (Look down: [0, 90])', !!fs0 && !!fs0.sv && fs0.sv.surf === 'stack' && JSON.stringify(fs0.sv.cam) === '[0,90]', info.link);
await ev(`(Params.encodeLink(__cmwFigureState()).then((p) => { window.__ssLink = p; }), 1)`);
let payload = null;
for (let i = 0; i < 50 && !payload; i++) { await sleep(100); payload = await ev('window.__ssLink || null'); }
// ---- Plane leaves (by the keyboard: → from Look down), the focus on the Surface button, and the switch shows again
await ev(`document.querySelector('.sv-camseg [aria-checked="true"]').focus(), 1`);
await key('ArrowRight');
await until(`__cmwSteps().surf === 'plane'`, 20000);
await frames(); await sleep(50);
c = await ctl();
const fsurf = await ev(`!!document.activeElement && document.activeElement.classList.contains('sv-surf1')`);
ok('Plane leaves for the Plane surface, and the control goes with the Stack', (await S()).surf === 'plane' && !!c && !c.shown, c);
ok('→ onto Plane leaves with the focus on the Surface button, not the page', fsurf, await ev(`document.activeElement && (document.activeElement.className || document.activeElement.tagName)`));
ok('on the Plane the card\'s Look down switch shows', (await lookSwitch()) === true, await lookSwitch());
// ---- one Undo takes the starter disc away
{
  const n = (await ev('__cmwP()')).shapes.length;
  await ev(`document.getElementById('undoBtn').click()`);
  await until(`__cmwP().shapes.length === ${n - 1}`, 10000);
  ok('one Undo takes the starter disc away', (await ev('__cmwP()')).shapes.length === n - 1, (await ev('__cmwP()')).shapes);
}
// ---- the link opens on the Stack in Look down
if (payload) {
  await openState(null, 1440, 900, false, `#cmw=${payload}`);
  const s = await S(), cl = await cam();
  info.link.opened = { surf: s.surf, cam: cl };
  ok('the link opens on the Stack, in Look down', s.surf === 'stack' && !!cl && near(cl.pitch, 90 * DEG) && near(cl.yaw, 0), info.link.opened);
} else ok('the link encodes', false, payload);
// ---- an old link, with no camera, opens the Stack at Tilt on the desk
const OLD = STATE({ shapes: [{ id: 'd', kind: 'disc', c: [1.1, 0], r: 0.25, stage: 1 }], sv: { at: 0, T: -1, scope: 'all', surf: 'stack' } });
await openState(OLD, 1440, 900, false);
{
  const s = await S(), cl = await cam();
  info.old = { surf: s.surf, cam: cl };
  ok('an old state with no camera opens the Stack at Tilt on the desk', s.surf === 'stack' && !!cl && near(cl.pitch, 35 * DEG) && near(cl.yaw, -30 * DEG), info.old);
}

// ---- a phone: Look down first, the Tilt key, the Display sheet
await openState(STATE(), 390, 844, true);
await chooseStack();
await until(`typeof __cmwStack === 'function' && !!__cmwStack().drawn`, 20000);
await frames();
{
  const cl = await cam();
  ok('phone: the Stack opens in Look down', !!cl && near(cl.pitch, 90 * DEG) && near(cl.yaw, 0), cl);
  const headSeg = await ev(`(() => { const g = document.querySelector('.sv-camseg'); return g ? g.getClientRects().length : null; })()`);
  ok('phone: the head has no view control (no room: the Tilt key and the Display sheet carry it)', headSeg === 0, headSeg);
  const keyAt = () => ev(`(() => { const b = document.querySelector('#plotL .ph-col .ph-tilt'); if (!b) return null; const r = b.getBoundingClientRect(); return { shown: !b.hidden && r.width > 0, box: [r.width, r.height], label: b.getAttribute('aria-label'), pressed: b.getAttribute('aria-pressed'), at: [r.left + r.width / 2, r.top + r.height / 2] }; })()`);
  let k = await keyAt();
  info.phoneKey = { k };
  ok('phone: the key column has a Tilt key, 44 px, named Tilt, not pressed in Look down', !!k && k.shown && k.box[0] >= 44 && k.box[1] >= 44 && k.label === 'Tilt' && k.pressed === 'false', k);
  if (k) {
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: k.at[0], y: k.at[1], id: 1 }] });
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await settleCam();
    const k1 = await keyAt(), c1 = await cam();
    info.phoneKey.after = { k1, c1 };
    ok('phone: a tap on Tilt tilts the camera and presses the key; its name stays Tilt', !!k1 && k1.pressed === 'true' && k1.label === 'Tilt' && !!c1 && near(c1.pitch, 35 * DEG), info.phoneKey.after);
  }
  const ok1 = await ev(`(() => { const b = document.querySelector('#plotL .ph-dsp'); if (!b) return false; b.click(); return true; })()`);
  await frames(); await sleep(300);
  const sheet = await ev(`(() => { const g = document.querySelector('.sv-sheet-stack'); return g ? { shown: g.getClientRects().length > 0, radios: [...g.querySelectorAll('[role=radio]')].map((b) => [b.textContent, b.getAttribute('aria-checked')]) } : null; })()`);
  info.sheet = sheet;
  ok('phone: the Display sheet carries the three-state control, set to the camera (Tilt)', ok1 && !!sheet && sheet.shown && sheet.radios.map((r) => r[0]).join('|') === 'Tilt|Look down|Plane' && sheet.radios[0][1] === 'true', sheet);
}
await openState(OLD, 390, 844, true);
{
  const s = await S(), cl = await cam();
  ok('phone: an old state with no camera opens the Stack in Look down', s.surf === 'stack' && !!cl && near(cl.pitch, 90 * DEG), { surf: s.surf, cl });
}

return { pass: fails.length === 0, passed: pass, fails, info };
