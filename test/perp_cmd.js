// v16.3 the Perpendicular circle (notes/orthogonal-circle/SPEC.md 7, "test/perp_cmd.js"). In the real app, with real
// pointer events (mouse; touch on the phone):
//   A (desktop 1440, light, English): the fifth Construct tile and its tooltip; the shown unit circle picked as the curve
//     (Circle 1 appears only with K, one undo step for all); K's colour; the row and the Inspector; |cos| at rest and over
//     20 frames of a z₀ drag across the circle; the curve stays picked; Backspace drops it; a pick on C's stroke; the real
//     axis (Line 1, the half-plane model); P on a disc's centre handle (a line); the pencil (the reason, the eye) and
//     back; C a polygon side and a 3-point circle; refusals (empty space, a freehand curve), Esc; the plane menu;
//     ⋯ Region, Use complement, the family as C's centre crosses PQ; Delete C with the cascade toast, then Undo.
//   B reload (bitwise), a link in a fresh namespace, the v16.2 test page on the same link (the cached circle, one toast).
//   C Russian: the tiles fit (EN and RU), the chip, the row, the reason, the caption.
//   D dark at 1440; 1024 × 768 and 768 × 1024 (the rail fits; fitRail drops Grid and Polar grid first); the phone
//     390 × 844 (Android Chrome, touch): five Construct tiles in More, a tile closes the sheet, a curve pick within
//     10 px, point picks within 22 px, the chip's ×, the Russian sheet.
//   E export captions, EN and RU: a circle C, and a polygon side C (its carrier line).
//   F BUDGET60: P dragged with 1 and 10 dependent perpendicular circles (curves and regions), 1/z in Y.
//   G Y: a perpendicular circle in Y through z₀″, C a target circle.
//   H screenshots (perp-*.png; copied to notes/orthogonal-circle/shots/perp/).
// A command file for a CDP daemon (test/cdp_kit README):  python3 build.py && test/<you>_cdp/q.sh test/perp_cmd.js
// For B's v16.2 page, copy notes/v16.2-candidate/dist/test.html to dist/v162-test.html first (removed afterwards).
const ONLY = typeof __ONLY !== 'undefined' ? __ONLY : null;
const run = (k) => !ONLY || ONLY.includes(k);
const fails = [], info = {};
let checks = 0;
const ok = (name, cond, got) => { checks++; if (!cond) fails.push({ name, got }); };
const settle = async (ms = 300) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const errs = [];
const grab = async () => { errs.push(...(await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error' || x.t === 'warning') && !/Failed to load resource|favicon/.test(x.m || ''))); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const W = (re, im, side = 'L') => ev(`__cmwW2S('${side}', ${re}, ${im})`);
const CI = (o) => ev(`__cmwCI(${JSON.stringify(o || null)})`);
const ST = () => CI({ shapes: true });
const FORMS = () => ev(`__cmwC().forms`);
const byId = (st, id) => st.list.find((s) => s.id === id);
const last = (st) => st.list[st.list.length - 1];
const tool = async (id) => { const r = await clickSel(`#tools .tool[data-tool="${id}"], #constructTools .tool[data-tool="${id}"]`); await settle(120); return r; };
const toastText = () => ev(`(document.querySelector('#toastHost .toast > span') || {}).textContent || ''`);
const toasts = () => ev(`[...document.querySelectorAll('#toastHost .toast')].map((t) => t.textContent.trim())`);
const chipT = (side = 'L') => ev(`(document.querySelector('#draftChip${side} .cm-t') || {}).textContent || ''`);
const rowD = (id) => ev(`(document.querySelector('.shape[data-id="${id}"] .d') || {}).textContent`);
const NS = 'pp' + (Date.now() % 1000000);
const section = async (k, f) => { if (!run(k)) return; try { await f(); } catch (e) { fails.push({ name: `section ${k} threw`, got: String(e && e.stack || e).slice(0, 700) }); } };
const clickR = async (x, y) => {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'right', buttons: 2, clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'right', buttons: 0, clickCount: 1 });
};
const menuItems = () => ev(`[...document.querySelectorAll('.ctx-menu .mi, .menu .mi, [role="menuitem"]')].filter((b) => b.getClientRects().length).map((b) => b.textContent.trim())`);
const menuClick = (start) => ev(`(() => { const b = [...document.querySelectorAll('.ctx-menu .mi, .menu .mi, [role="menuitem"]')].filter((b) => b.getClientRects().length).find((b) => b.textContent.trim().startsWith(${JSON.stringify(start)})); if (b) b.click(); return !!b; })()`);

// ------------------------------------------------ forms (the hooks' exact forms; plain shapes from their fields)
const sub2 = (a, b) => [a[0] - b[0], a[1] - b[1]];
function formOfShape(s, forms, part) {
  if (forms && forms[s.id]) return forms[s.id];
  if (s.kind === 'circle' || s.kind === 'disc') return { A: 1 / s.r, B: [0, 0], C: -s.r, o: s.c.slice() };
  let a, b;
  if (s.kind === 'polygon') { const n = s.pts.length; a = s.pts[part]; b = s.pts[(part + 1) % n]; } else { a = s.a; b = s.b; }
  const d = sub2(b, a), L = Math.hypot(d[0], d[1]);
  return { A: 0, B: [d[1] / L, -d[0] / L], C: 0, o: a.slice() };
}
function reanchor(G, o2) {
  const u = sub2(o2, G.o);
  return { A: G.A, B: [G.B[0] + G.A * u[0], G.B[1] + G.A * u[1]], C: G.C + 2 * (G.B[0] * u[0] + G.B[1] * u[1]) + G.A * (u[0] * u[0] + u[1] * u[1]), o: o2.slice() };
}
function cosAngle(G1, G2) {
  const a = reanchor(G1, G2.o), b = G2;
  const ip = a.B[0] * b.B[0] + a.B[1] * b.B[1] - 0.5 * (a.A * b.C + b.A * a.C);
  const n1 = a.B[0] ** 2 + a.B[1] ** 2 - a.A * a.C, n2 = b.B[0] ** 2 + b.B[1] ** 2 - b.A * b.C;
  return ip / Math.sqrt(n1 * n2);
}
const fAt = (G, z) => { const u = sub2(z, G.o); return G.A * (u[0] * u[0] + u[1] * u[1]) + 2 * (G.B[0] * u[0] + G.B[1] * u[1]) + G.C; };
// the distance from z to the curve of G (first order, exact enough for incidence checks)
const offCurve = (G, z) => { const u = sub2(z, G.o), g = [G.A * u[0] + G.B[0], G.A * u[1] + G.B[1]]; return Math.abs(fAt(G, z)) / (2 * Math.hypot(g[0], g[1])); };
const f1 = (x) => (x === 0 ? '0' : Number(x).toExponential(1));

const SA = {
  shapes: [
    { id: 'd1', kind: 'disc', c: [-1.0, -1.35], r: 0.3, ci: 2, visible: true },
    { id: 'fh', kind: 'curve', pts: [[-1.3, -1.85], [-0.9, -1.8], [-0.5, -1.9], [-0.1, -1.82], [0.3, -1.9]], ci: 3, visible: true },
    { id: 'pg', kind: 'polygon', pts: [[0.5, -1.5], [1.3, -1.5], [0.9, -1.0]], ci: 4, visible: true },
    { id: 'q1', kind: 'point', p: [-1.25, 1.3], ci: 5, visible: true },
    { id: 'q2', kind: 'point', p: [-0.75, 1.5], ci: 5, visible: true },
    { id: 'q3', kind: 'point', p: [-1.1, 1.85], ci: 5, visible: true },
    { id: 'c3', kind: 'circle', c: [0, 0], r: 1, ci: 6, visible: true, def: { op: 'circle3', args: [{ s: 'q1' }, { s: 'q2' }, { s: 'q3' }], fill: 'none' } },
  ],
  steps: [{ type: 'zp', params: { a: '1', zeros: '1+0.5i', poles: '' }, on: true }],
  srcView: { cx: 0, cy: 0, s: 150 }, unit: true, snap: true, nextId: 50, pattern: 'checker',
};
// the family state: K on a free circle C, P and Q on the real axis
const SF = {
  shapes: [
    { id: 'fc', kind: 'circle', c: [0, -0.5], r: 1, ci: 0, visible: true },
    { id: 'fp', kind: 'point', p: [-0.4, 0], ci: 1, visible: true },
    { id: 'fq', kind: 'point', p: [0.4, 0], ci: 1, visible: true },
    { id: 'fk', kind: 'circle', c: [0, 0], r: 1, ci: 2, visible: true, def: { op: 'perp', args: [{ s: 'fc', part: 0 }, { s: 'fp' }, { s: 'fq' }], fill: 'none' } },
  ],
  steps: [{ type: 'recip', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 120 }, snap: true, nextId: 50,
};

await section('A', async () => {
  await view(1440, 900, false, false);
  await load(NS, SA);
  await settle(900);
  await grab();
  // 1. the fifth tile, its tooltip, its label on two lines at most (52 px)
  const tiles = await ev(`[...document.querySelectorAll('#constructTools .tool')].map((b) => b.dataset.tool).join()`);
  ok('A1 the Construct grid has six tiles, Perpendicular circle fifth (v16.3: Touching circle last)', tiles === 'circle3,meet,midpoint,bisector,perp,touch', tiles);
  info.tile = await ev(`(() => { const b = document.querySelector('#constructTools .tool[data-tool="perp"]'), s = b.querySelector('span'); const lh = parseFloat(getComputedStyle(s).lineHeight); return { tip: b.dataset.tip, desc: b.dataset.desc, label: s.textContent, w: s.clientWidth, sw: s.scrollWidth, h: s.getBoundingClientRect().height, lh, btn: b.getBoundingClientRect().height, bottom: s.getBoundingClientRect().bottom - b.getBoundingClientRect().bottom }; })()`);
  ok('A1 tooltip: Perpendicular circle + its description', info.tile.tip === 'Perpendicular circle' && /^Pick a line or a circle, then two points/.test(info.tile.desc), info.tile);
  ok('A1 the tile label «Orthogonal» fits on one line, inside the tile (v16.3 review user-7)', info.tile.label === 'Orthogonal' && info.tile.sw <= info.tile.w + 1 && info.tile.h <= info.tile.lh + 1 && info.tile.bottom <= 0, info.tile);
  await tool('perp');
  // (the left pane is 427 px wide at 1440, under 560: the chip names the tool by its tile text)
  ok('A1 the chip before the curve', (await chipT()) === 'Pick a line or a circle · Orthogonal · Esc cancels', await chipT());
  // refusals before any curve is picked: empty space and a freehand curve give the toast, the draft stays; Esc
  const nA = (await ST()).list.length;
  const em = await W(-0.5, -1.2);
  await click(em[0], em[1]); await settle(150);
  const t1s = await toastText();
  const fz = await W(-0.5, -1.9);
  await click(fz[0], fz[1] + 1); await settle(150);
  const t2s = await toastText();
  let d0 = (await CI()).draft;
  ok('A11 empty space and a freehand curve: the toast, the draft stays, nothing made', t1s === 'Click a line or a circle.' && t2s === 'Click a line or a circle.' && d0 && d0.tool === 'perp' && d0.curve1 === null && (await ST()).list.length === nA && (await ev('__cmwCI({shapes:true}).tool')) === 'perp', [t1s, t2s, d0]);
  // 2. the shown unit circle as the curve: the ring and chip on hover, no shape until K is made
  let st = await ST();
  const n0 = st.list.length, hi0 = st.hi;
  const u = await W(Math.cos(0.9), Math.sin(0.9));
  await move(u[0] + 3, u[1] - 2); await settle(120);
  const ring = (await CI()).ring;
  ok('A2 hover: the ring on the unit circle, "on the unit circle"', ring && ring.chip === 'on the unit circle' && Math.abs(Math.hypot(ring.z[0], ring.z[1]) - 1) < 1e-15, ring);
  await click(u[0] + 3, u[1] - 2); await settle(150);
  let d = (await CI()).draft;
  st = await ST();
  ok('A2 the unit circle is picked; no shape yet', d && d.tool === 'perp' && d.curve1 === null && st.list.length === n0 && (await chipT()).startsWith('Point 1 of 2'), { d, n: st.list.length });
  // 3. z₀ (snapped 0.3 + 0.2i), then an empty spot: K
  const a = await W(0.3, 0.2), b = await W(-0.6, 0.5);
  await click(a[0] + 2, a[1] + 1); await settle(100);
  await move(b[0], b[1]); await settle(150);
  await shot('perp-d1440-light-preview');
  await click(b[0], b[1]); await settle(400);
  st = await ST();
  const K1 = last(st), C1 = st.list.find((s) => s.id === K1.def.args[0].s);
  const P1 = byId(st, K1.def.args[1].s), Q1 = byId(st, K1.def.args[2].s);
  info.K1 = { id: K1.id, kind: K1.kind, def: K1.def, ci: K1.ci, C: C1, P: P1.p, Q: Q1.p };
  ok('A3 K made: the unit circle as a circle shape first, two free points, K; one more undo step', st.list.length === n0 + 4 && C1 && C1.kind === 'circle' && C1.r === 1 && C1.c[0] === 0 && C1.c[1] === 0 && st.hi === hi0 + 1 && st.list.indexOf(C1) === n0, { n: st.list.length, hi: [hi0, st.hi] });
  ok('A3 z₀ snapped to 0.3 + 0.2i', P1.p[0] === 0.3 && P1.p[1] === 0.2, P1.p);
  ok('A3 K\'s colour differs from Circle 1\'s', K1.ci !== C1.ci, [K1.ci, C1.ci]);
  const names = await CI({ names: true });
  const nm = (id) => (names.find((x) => x.id === id) || {}).name;
  info.rowK1 = await rowD(K1.id);
  info.namesK1 = [nm(P1.id), nm(Q1.id), nm(C1.id)];
  ok('A3 the row: through z₃ and z₄, perpendicular to Circle 2 (the state has z₀–z₂ and Circle 1)', info.rowK1 === `perpendicular to ${nm(C1.id)}, through ${nm(P1.id)} and ${nm(Q1.id)}` && nm(C1.id) === 'Circle 2', [info.rowK1, info.namesK1]);
  info.inspK1 = await ev(`(document.querySelector('.cm-idef') || {}).textContent`);
  ok('A3 the Inspector reads the long form (v16.3 review user-10: the row puts the curve first)', info.inspK1 === `through ${nm(P1.id)} and ${nm(Q1.id)}, perpendicular to ${nm(C1.id)}`, info.inspK1);
  let forms = await FORMS();
  const cosRest = Math.abs(cosAngle(forms[K1.id], formOfShape(C1)));
  ok('A3 |cos| ≤ 1e-12 at rest; K through z₀ and z₁', cosRest <= 1e-12 && offCurve(forms[K1.id], P1.p) < 1e-14 && offCurve(forms[K1.id], Q1.p) < 1e-14, f1(cosRest));
  await shot('perp-d1440-light-made');
  // 4. the curve stays picked: two more clicks make K2 on Circle 1; Backspace drops the curve
  d = (await CI()).draft;
  ok('A4 the curve stays picked (Circle 1)', d && d.curve1 && d.curve1.s === C1.id && d.picks.length === 0, d);
  const e1 = await W(-0.3, -0.9), e2 = await W(0.8, -0.3);
  await click(e1[0], e1[1]); await settle(80); await click(e2[0], e2[1]); await settle(350);
  st = await ST();
  const K2 = last(st);
  forms = await FORMS();
  ok('A4 two clicks: K2 perpendicular to Circle 1', K2.def && K2.def.op === 'perp' && K2.def.args[0].s === C1.id && Math.abs(cosAngle(forms[K2.id], formOfShape(C1))) <= 1e-12 && st.list.length === n0 + 7, K2.def);
  await key('Backspace'); await settle(150);
  ok('A4 Backspace with no points drops the curve', (await CI()).draft && (await CI()).draft.curve1 === null && (await chipT()).startsWith('Pick a line or a circle'), [await CI(), await chipT()]);
  // undo: K2 and its points in one step; then K1, its points and Circle 1 in one step; redo both
  const hiK2 = st.hi;
  await key('z', 4); await settle(250);
  st = await ST();
  ok('A4 undo: K2 and its two points go in one step', st.list.length === n0 + 4 && st.hi === hiK2 - 1, [st.list.length, st.hi]);
  await key('z', 4); await settle(250);
  st = await ST();
  ok('A3 undo: K1, its two points and Circle 1 go in one step', st.list.length === n0 && !byId(st, C1.id), st.list.map((s) => s.id));
  await key('z', 12); await settle(250); await key('z', 12); await settle(300);
  st = await ST();
  ok('redo brings both back', st.list.length === n0 + 7 && !!byId(st, K1.id) && !!byId(st, K2.id), st.list.length);
  // 5. drag z₀ across Circle 1: 20 frames, never undefined, |cos| ≤ 1e-12, no flip
  await tool('select');
  const p0 = await W(0.3, 0.2), p1 = await W(1.6, 0.3);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p0[0], y: p0[1] });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p0[0], y: p0[1], button: 'left', buttons: 1, clickCount: 1 });
  let worst = 0, und = 0, flips = 0, crossed = false;
  const flip0 = byId(await ST(), K1.id).def.flip;
  for (let i = 1; i <= 20; i++) {
    const x = p0[0] + (p1[0] - p0[0]) * i / 20, y = p0[1] + (p1[1] - p0[1]) * i / 20;
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1 });
    await ev('new Promise((r) => requestAnimationFrame(r))');
    const s2 = await ST(), k = byId(s2, K1.id), p = byId(s2, P1.id).p, fm = (await FORMS())[K1.id];
    if (k.cundef || !fm) { und++; continue; }
    if (k.def.flip !== flip0) flips++;
    if (Math.hypot(p[0], p[1]) > 1) crossed = true;
    worst = Math.max(worst, Math.abs(cosAngle(fm, formOfShape(C1))));
  }
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p1[0], y: p1[1], button: 'left', buttons: 0, clickCount: 1 });
  await settle(250);
  info.drag = { worst: f1(worst), und, flips, crossed };
  ok('A5 z₀ dragged across Circle 1 (20 frames): defined, |cos| ≤ 1e-12, no flip', und === 0 && flips === 0 && crossed && worst <= 1e-12, info.drag);
  await key('z', 4); await settle(250);   // (z₀ back at 0.3 + 0.2i)
  // 6. a pick on C's stroke makes a point on C: K crosses C there at right angles
  await tool('perp');
  const onC1 = () => W(Math.cos(2.3), Math.sin(2.3));
  let cs = await onC1();
  await click(cs[0] + 2, cs[1]); await settle(100);
  const gp = await W(Math.cos(-2.6), Math.sin(-2.6)), e3 = await W(-0.1, -0.35);
  await click(gp[0] + 2, gp[1] - 1); await settle(100);
  await click(e3[0], e3[1]); await settle(350);
  st = await ST();
  const K3 = last(st), G3 = byId(st, K3.def.args[1].s);
  forms = await FORMS();
  ok('A6 a pick on C\'s stroke: a point on Circle 1; K crosses C there at right angles', K3.def.args[0].s === C1.id && G3.def && G3.def.op === 'glider' && G3.def.args[0].s === C1.id && Math.abs(Math.hypot(G3.p[0], G3.p[1]) - 1) < 1e-15 && offCurve(forms[K3.id], G3.p) < 1e-14 && Math.abs(cosAngle(forms[K3.id], formOfShape(C1))) <= 1e-12, { def: K3.def, g: G3 });
  // 7. the real axis: Line 1 through 0 and 1 (the half-plane model)
  await key('Escape'); await settle(100);
  const ra = await W(1.3, 0);
  await move(ra[0], ra[1] + 3); await settle(120);
  info.axisChip = ((await CI()).ring || {}).chip;
  await click(ra[0], ra[1] + 3); await settle(100);
  const h1 = await W(0.5, 1.2), h2 = await W(1.2, 0.6);
  await click(h1[0], h1[1]); await settle(80); await click(h2[0], h2[1]); await settle(350);
  st = await ST();
  const K4 = last(st), L1 = byId(st, K4.def.args[0].s);
  forms = await FORMS();
  info.L1 = L1;
  ok('A7 the real axis: "on the real axis", Line 1 through 0 and 1, K perpendicular to it', info.axisChip === 'on the real axis' && L1 && L1.kind === 'line' && L1.a[0] === 0 && L1.a[1] === 0 && L1.b[0] === 1 && L1.b[1] === 0 && Math.abs(cosAngle(forms[K4.id], formOfShape(L1))) <= 1e-12 && K4.kind === 'circle' && Math.abs(K4.c[1]) < 1e-15, { axisChip: info.axisChip, L1, K4: [K4.kind, K4.c] });
  // 8. P on a disc's centre handle: a line
  await key('Escape'); await settle(100);
  const ds = await W(-1.0 + 0.3 * Math.cos(0.4), -1.35 + 0.3 * Math.sin(0.4)), dc = await W(-1.0, -1.35), dq = await W(-0.4, -1.45);
  await click(ds[0] + 1, ds[1]); await settle(100);
  await click(dc[0] + 2, dc[1] + 2); await settle(100);
  await click(dq[0], dq[1]); await settle(350);
  st = await ST();
  const K5 = last(st);
  ok('A8 P on the disc\'s centre handle: K is a line', K5.def && K5.def.args[0].s === 'd1' && K5.def.args[1].s === 'd1' && K5.def.args[1].h === 'c' && K5.kind === 'line', K5);
  // 9. the pencil: 0.5 + 0.5i and its mirror image 1 + i in the unit circle; the reason, the eye; back when Q moves
  await key('Escape'); await settle(100);
  cs = await onC1();
  await click(cs[0] + 2, cs[1]); await settle(100);
  ok('A9 Circle 2 picked', (((await CI()).draft || {}).curve1 || {}).s === C1.id, (await CI()).draft);
  const m1 = await W(0.5, 0.5), m2 = await W(1, 1);
  await click(m1[0], m1[1]); await settle(80);
  await move(m2[0], m2[1]); await settle(100);
  await click(m2[0], m2[1]); await settle(350);
  st = await ST();
  const K6 = last(st), Q6 = byId(st, K6.def.args[2].s);
  info.pencil = { undef: K6.cundef, row: await rowD(K6.id), eye: await ev(`(document.querySelector('.shape[data-id="${K6.id}"] .eye') || {}).disabled`), P: byId(st, K6.def.args[1].s).p, Q: Q6.p };
  ok('A9 the pencil: undefined, the reason in the row, the eye disabled', K6.cundef && K6.cundef.code === 'pencil' && info.pencil.row === 'The points are symmetric in the curve: every circle through both is perpendicular to it' && info.pencil.eye === true, info.pencil);
  await shot('perp-d1440-light-pencil');
  await tool('select');
  await drag(m2[0], m2[1], m2[0] + 24, m2[1] - 12, 8, 16); await settle(300);
  st = await ST();
  ok('A9 K comes back when Q moves', !byId(st, K6.id).cundef && (await FORMS())[K6.id], byId(st, K6.id).cundef);
  // 10. C a polygon side, and a 3-point circle (in a fresh copy of the scene: no K near the side)
  await load(NS + 'k', SA); await settle(900);
  await tool('perp');
  ok('A10 a fresh draft', !((await CI()).draft || {}).curve1, (await CI()).draft);
  const sd = await W(0.9, -1.5);
  await click(sd[0], sd[1] + 1); await settle(100);
  ok('A10 the polygon side picked', JSON.stringify((((await CI()).draft || {}).curve1)) === JSON.stringify({ s: 'pg', part: 0 }), (await CI()).draft);
  const s1 = await W(0.3, -1.2), s2 = await W(0.1, -1.6);   // (clear of the zoom buttons at the pane's bottom right)
  await click(s1[0], s1[1]); await settle(80); await click(s2[0], s2[1]); await settle(350);
  st = await ST();
  const K7 = last(st);
  forms = await FORMS();
  ok('A10 C a polygon side: K perpendicular to its line', K7.def.args[0].s === 'pg' && K7.def.args[0].part === 0 && Math.abs(cosAngle(forms[K7.id], formOfShape(byId(st, 'pg'), null, 0))) <= 1e-12, [K7.def, f1(Math.abs(cosAngle(forms[K7.id], formOfShape(byId(st, 'pg'), null, 0))))]);
  ok('A10 its row names the side', /^perpendicular to side 1 of Polygon 1, through /.test(await rowD(K7.id) || ''), await rowD(K7.id));
  info.rowK7 = await rowD(K7.id);
  await key('Escape'); await settle(100);
  const c3 = byId(st, 'c3'), c3s = await W(c3.c[0] + c3.r * Math.cos(-0.3), c3.c[1] + c3.r * Math.sin(-0.3));
  await click(c3s[0] + 1, c3s[1]); await settle(100);
  const t1 = await W(-1.3, 0.9), t2 = await W(-0.4, 1.3);
  await click(t1[0], t1[1]); await settle(80); await click(t2[0], t2[1]); await settle(350);
  st = await ST();
  const K8 = last(st);
  forms = await FORMS();
  ok('A10 C a 3-point circle: K perpendicular to it', K8.def.args[0].s === 'c3' && Math.abs(cosAngle(forms[K8.id], forms.c3)) <= 1e-12, K8.def);
  await shot('perp-d1440-light-kinds');
  // 11. Esc; the plane menu (on the 3-point circle of this scene)
  await key('Escape'); await settle(100);
  // (a point of c3's stroke far from its three defining points: the plane menu takes a point first)
  const onC3 = async () => { const st3 = await ST(), c = byId(st3, 'c3'), qs = ['q1', 'q2', 'q3'].map((id) => byId(st3, id).p); let best = null, bd = -1;
    for (let k = 0; k < 24; k++) { const t = k / 24 * 2 * Math.PI, z = [c.c[0] + c.r * Math.cos(t), c.c[1] + c.r * Math.sin(t)], dd = Math.min(...qs.map((q) => Math.hypot(q[0] - z[0], q[1] - z[1]))); if (dd > bd && Math.abs(z[0]) < 1.3 && Math.abs(z[1]) < 1.9) { bd = dd; best = z; } }
    return W(best[0], best[1]); };
  cs = await onC3();
  await click(cs[0] + 1, cs[1]); await settle(100);
  ok('A11 a curve picked', (((await CI()).draft || {}).curve1 || {}).s === 'c3', (await CI()).draft);
  await key('Escape'); await settle(100);
  ok('A11 Esc cancels the draft, curve included', !(await CI()).draft || !(await CI()).draft.curve1, (await CI()).draft);
  await tool('select');
  cs = await onC3();
  await clickR(cs[0] + 1, cs[1]); await settle(250);
  info.planeMenu = await menuItems();
  ok('A11 the plane menu on a circle has "Perpendicular circle…" next to "Point on this curve"', info.planeMenu.indexOf('Perpendicular circle…') === info.planeMenu.indexOf('Point on this curve') + 1 && info.planeMenu.includes('Perpendicular circle…'), info.planeMenu);
  await menuClick('Perpendicular circle…'); await settle(200);
  d = (await CI()).draft;
  ok('A11 it starts the tool with that curve', (await ev('__cmwCI({shapes:true}).tool')) === 'perp' && d && d.curve1 && d.curve1.s === 'c3' && (await chipT()).startsWith('Point 1 of 2'), d);
  await key('Escape'); await settle(100);
  await grab();
  // 12. ⋯ Region; Use complement; the family as C's centre crosses PQ (K on a free circle C, P and Q on ℝ)
  await load(NS + 'f', SF); await settle(900);
  await clickSel('.shape[data-id="fk"] .icon-btn.more'); await settle(250);
  info.rowMenu = await menuItems();
  await menuClick('Region'); await settle(300);
  st = await ST();
  ok('A12 ⋯ Region: the disc', byId(st, 'fk').kind === 'disc' && byId(st, 'fk').def.fill === 'in' && !byId(st, 'fk').complement, [info.rowMenu, byId(st, 'fk')]);
  ok('A12 its row: the disc through …', /^disc perpendicular to Circle 1, through z₀ and z₁$/.test(await rowD('fk') || ''), await rowD('fk'));
  await clickSel('.shape[data-id="fk"] .icon-btn.more'); await settle(250);
  await menuClick('Use complement'); await settle(300);
  st = await ST();
  ok('A12 Use complement: the outside', byId(st, 'fk').kind === 'disc' && byId(st, 'fk').complement === true && /^outside a circle perpendicular to Circle 1, through/.test(await rowD('fk') || ''), [byId(st, 'fk'), await rowD('fk')]);
  // C's centre dragged from -0.5i up to 0.5i (its handle snaps to the grid): outside → half-plane → disc
  await clickSel('.shape[data-id="fc"] .shape-row'); await settle(200);
  const c0 = await W(0, -0.5), c1 = await W(0, 0.5);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c0[0], y: c0[1] });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: c0[0], y: c0[1], button: 'left', buttons: 1, clickCount: 1 });
  const fam = [];
  for (let i = 1; i <= 40; i++) {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c0[0], y: c0[1] + (c1[1] - c0[1]) * i / 40, button: 'left', buttons: 1 });
    await ev('new Promise((r) => requestAnimationFrame(r))');
    const k = byId(await ST(), 'fk'), f = k.cundef ? 'undef' : k.kind === 'disc' && k.complement ? 'outside' : k.kind;
    if (fam[fam.length - 1] !== f) fam.push(f);
  }
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: c1[0], y: c1[1], button: 'left', buttons: 0, clickCount: 1 });
  await settle(300);
  st = await ST();
  info.family = { fam, c: byId(st, 'fc').c };
  ok('A12 the family as C\'s centre crosses PQ: outside → half-plane → disc', fam.join() === 'outside,halfplane,disc', info.family);
  await shot('perp-d1440-light-family');
  // 13. Delete C: the cascade toast, then Undo (C selected by a click on its stroke)
  await key('Escape'); await settle(100);
  const fcc = byId(st, 'fc'), fs1 = await W(fcc.c[0] + fcc.r * Math.cos(-2.6), fcc.c[1] + fcc.r * Math.sin(-2.6));
  await click(fs1[0], fs1[1]); await settle(200);
  info.selBeforeDelete = (await ST()).selected;
  await key('Delete'); await settle(300);
  info.delToast = await toastText();
  st = await ST();
  ok('A13 Delete C: "Deleted Circle 1 and 1 shape built on it."', info.delToast === 'Deleted Circle 1 and 1 shape built on it.' && !byId(st, 'fc') && !byId(st, 'fk'), info.delToast);
  await clickSel('#toastHost .toast-act'); await settle(300);
  st = await ST();
  ok('A13 Undo brings C and K back', !!byId(st, 'fc') && !!byId(st, 'fk') && !byId(st, 'fk').cundef, st.list.map((s) => s.id));
  await grab();
});

await section('B', async () => {
  // reload: bitwise; a link in a fresh namespace; the v16.2 page on the same link
  await view(1440, 900, false, false);
  await load(NS + 'b', SF); await settle(800);
  const snap = (st) => st.list.map((s) => JSON.stringify([s.id, s.kind, s.def, s.c, s.r, s.a, s.b, s.p, s.complement]));
  let st = await ST();
  const before = snap(st), fb = JSON.stringify((await FORMS()).fk);
  await nav(`${U}?ns=${NS}b`); await settle(1500);
  st = await ST();
  ok('B reload: every shape and K\'s form come back bitwise', before.join('\n') === snap(st).join('\n') && fb === JSON.stringify((await FORMS()).fk), { before, after: snap(st) });
  const payload = await ev(`await Params.encodeLink(__cmwP().figure)`);
  info.linkLen = payload && payload.length;
  await nav(`${U}?ns=${NS}lk#cmw=${payload}`); await settle(1800);
  st = await ST();
  ok('B a link opens K in a fresh namespace', before.join('\n') === snap(st).join('\n'), snap(st));
  const has162 = fs.existsSync(path.join(DIR, '..', '..', 'dist', 'v162-test.html'));
  info.v162 = has162;
  if (has162) {
    await nav(`http://localhost:${PORT}/v162-test.html?ns=${NS}old#cmw=${payload}`); await settle(2200);
    const old = await ev(`__cmwCI({shapes:true}).list.find((s) => s.id === 'fk')`);
    info.v162 = { old, linkToasts: await toasts() };
    ok('B the v16.2 page opens the link: K is the cached circle (no definition)', old && !old.def && old.kind === 'circle' && Math.abs(old.r - byId(st, 'fk').r) < 1e-12 && Math.abs(old.c[1] - byId(st, 'fk').c[1]) < 1e-12, info.v162);
    // the same state saved by v16.3, opened by v16.2 from storage: validate frees K (one loadFreed), its circle kept.
    // (v16.2 records the event but shows no toast at startup: Construct.on runs before the app's adapter exists)
    await nav(`${U}?ns=${NS}b`); await settle(1200);
    const saved = await ev(`localStorage.getItem(__qa.key())`);
    await ev(`localStorage.setItem('complex-map-workbench-v1:${NS}old2', localStorage.getItem(__qa.key())); 1`);
    await nav(`http://localhost:${PORT}/v162-test.html?ns=${NS}old2`);
    let seen = [];
    for (let i = 0; i < 10; i++) { seen = seen.concat(await toasts()); await sleep(150); }
    const r2 = await ev(`({ fk: __cmwCI({shapes:true}).list.find((s) => s.id === 'fk'), freed: __cmwC().freed, events: __cmwC().events })`);
    info.v162.store = { fk: r2.fk, freed: r2.freed, events: r2.events, toasts: [...new Set(seen)], savedLen: saved && saved.length };
    ok('B the v16.2 page from storage: K freed once (loadFreed), its circle kept', r2.fk && !r2.fk.def && r2.fk.kind === 'circle' && Math.abs(r2.fk.r - byId(st, 'fk').r) < 1e-12 && r2.freed === 1 && r2.events.filter((e) => e === 'loadFreed').length === 1, info.v162.store);
  } else ok('B the v16.2 page is served (dist/v162-test.html)', false, 'missing');
  await grab();
});

await section('C', async () => {
  // Russian: the tiles fit (EN at 1440 was A1), the chip, the row, the reason, the caption
  await view(1440, 900, false, false);
  await load(NS + 'ru', SA);
  await nav(`${U}?ns=${NS}ru&lang=ru`); await settle(1800);
  info.ruTile = await ev(`(() => { const b = document.querySelector('#constructTools .tool[data-tool="perp"]'), s = b.querySelector('span'); const lh = parseFloat(getComputedStyle(s).lineHeight); return { label: s.textContent.replace(/\\u00ad/g, '-'), w: s.clientWidth, sw: s.scrollWidth, h: s.getBoundingClientRect().height, lh, tip: b.dataset.tip, bottom: s.getBoundingClientRect().bottom - b.getBoundingClientRect().bottom }; })()`);
  ok('C RU tile «Ортого­нальная» fits on two lines at most', info.ruTile.label === 'Ортого-нальная' && info.ruTile.sw <= info.ruTile.w + 1 && info.ruTile.h <= 2 * info.ruTile.lh + 1 && info.ruTile.bottom <= 0 && info.ruTile.tip === 'Ортогональная окружность', info.ruTile);
  await tool('perp');
  ok('C RU chip before the curve', (await chipT()) === 'Выберите прямую или окружность · Ортогональная · Esc — отмена', await chipT());
  const u = await W(Math.cos(0.9), Math.sin(0.9));
  await move(u[0] + 3, u[1] - 2); await settle(120);
  ok('C RU ring chip: привязка: единичная окружность', ((await CI()).ring || {}).chip === 'привязка: единичная окружность', (await CI()).ring);
  await click(u[0] + 3, u[1] - 2); await settle(100);
  ok('C RU chip after the curve', (await chipT()) === 'Точка 1 из 2 · Ортогональная · Esc — отмена', await chipT());
  const a = await W(0.3, 0.2), b = await W(-0.6, 0.5);
  await click(a[0], a[1]); await settle(80); await move(b[0], b[1]); await settle(100);
  await shot('perp-d1440-ru-preview');
  await click(b[0], b[1]); await settle(400);
  let st = await ST();
  const K = last(st);
  info.ruRow = await rowD(K.id);
  ok('C RU row: через z₃ и z₄, ортогонально кривой: Окружность 2', info.ruRow === 'ортогональна кривой: Окружность 2; через z₃ и z₄', info.ruRow);
  // the pencil's reason
  const m1 = await W(0.5, 0.5), m2 = await W(1, 1);
  await click(m1[0], m1[1]); await settle(80); await click(m2[0], m2[1]); await settle(350);
  st = await ST();
  info.ruReason = await rowD(last(st).id);
  ok('C RU reason (pencil)', info.ruReason === 'Точки симметричны относительно кривой: любая окружность через них ей ортогональна', info.ruReason);
  await shot('perp-d1440-ru-made');
  // the caption (the pencil circle removed first: an undefined shape has no phrase)
  await key('z', 4); await settle(250);
  const capRu = await ev(`await (async () => { const f = await __cmwFig.build({ for: 'article', cols: 1 }); return f ? f.captionTex : null; })()`);
  info.capRuC = capRu;
  ok('C RU caption: «окружность, проходящая через … и ортогональная окружности …»', /окружност[ьи], проходящ(ая|ей) через .* и[ ~]ортогональн(ая|ой) окружности/.test(capRu || ''), capRu);
  const ruText = String(capRu || '').replace(/\$[^$]*\$/g, ' ').replace(/\\[A-Za-z]+/g, ' ');
  ok('C RU caption has no English words', !!capRu && !/[A-Za-z]{3,}/.test(ruText), ruText.match(/.{0,30}[A-Za-z]{3,}.{0,30}/g));
  await grab();
});

await section('D', async () => {
  // dark at 1440; 1024 and 768; the phone
  await view(1440, 900, true, false);
  await load(NS + 'dk', SA); await settle(900);
  await tool('perp');
  const u = await W(Math.cos(0.9), Math.sin(0.9));
  await click(u[0] + 3, u[1] - 2); await settle(100);
  const a = await W(0.3, 0.2), b = await W(-0.6, 0.5);
  await click(a[0], a[1]); await settle(80); await move(b[0], b[1]); await settle(120);
  await shot('perp-d1440-dark-preview');
  await click(b[0], b[1]); await settle(400);
  await shot('perp-d1440-dark-made');
  info.darkBg = await ev(`getComputedStyle(document.body).backgroundColor`);
  for (const [w, h] of [[1024, 768], [768, 1024]]) {
    await view(w, h, false, false); await settle(900);
    const r = await ev(`(() => { const rail = document.querySelector('#railTools'); const grid = document.querySelector('#constructTools'); const vis = (e) => !!e && !!e.offsetParent;
      const out = { rail: vis(rail), grid: vis(grid) };
      if (vis(rail)) { const box = rail.closest('.panel') || rail.parentElement; out.over = box.scrollHeight > box.clientHeight + 1; out.tight1 = rail.classList.contains('cm-tight1'); out.tight2 = rail.classList.contains('cm-tight2'); out.tight3 = rail.parentElement.classList.contains('cm-tight3'); out.toolsBottom = Math.round(rail.getBoundingClientRect().bottom); out.panelBottom = Math.round(box.getBoundingClientRect().bottom); out.perp = vis(rail.querySelector('[data-tool="perp"]')); out.gridHidden = !vis(rail.querySelector('[data-tool="cgrid"]')) && !vis(rail.querySelector('[data-tool="pgrid"]')); out.lassoShown = vis(rail.querySelector('[data-tool="lasso"]')); }
      if (vis(grid)) { const t = grid.querySelector('[data-tool="perp"]'), s = t.querySelector('span'); out.tile = { sw: s.scrollWidth, w: s.clientWidth, h: s.getBoundingClientRect().height }; }
      return out; })()`);
    info['layout' + w] = r;
    if (r.rail) ok(`D ${w}: the rail fits and shows Perpendicular; Grid and Polar grid leave first`, !r.over && r.perp && (!r.tight1 || r.gridHidden) && (!r.tight2 || r.tight1) && (!r.tight3 || r.tight2), r);
    else ok(`D ${w}: the Construct grid shows the tile whole`, r.grid && r.tile.sw <= r.tile.w + 1 && r.tile.h <= 23, r);
    await shot(`perp-t${w}`);
  }
  // the phone
  const touch = async (x, y, ms = 60) => { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }); await sleep(ms); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
  const center = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e || !e.getClientRects().length) return null; const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
  const ua0 = await ev('navigator.userAgent');
  await send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36' });
  await view(390, 844, false, true);
  const SP = { shapes: [{ id: 'pc', kind: 'circle', c: [0, 0], r: 1, ci: 0, visible: true }, { id: 'pp', kind: 'point', p: [0.4, 0.3], ci: 1, visible: true }], steps: [{ type: 'recip', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 70 }, snap: true, nextId: 50 };
  await load(NS + 'ph', SP); await settle(1200);
  const more = await center('#toolMore > summary');
  await touch(more[0], more[1]); await settle(500);
  info.phTiles = await ev(`[...document.querySelectorAll('.ph-tiles > *')].map((e) => e.tagName === 'H3' ? '#' + e.textContent : e.dataset.tool)`);
  ok('D phone: More has the Construct heading and six tiles', (info.phTiles || []).join().includes('#Construct,circle3,meet,midpoint,bisector,perp,touch'), info.phTiles);
  info.phTile = await ev(`(() => { const t = document.querySelector('.ph-tiles .ph-tile[data-tool="perp"]'); const s = t && (t.querySelector('.ph-tl') || t.querySelector('span')); if (!s) return null; const lh = parseFloat(getComputedStyle(s).lineHeight) || 12; return { text: s.textContent.replace(/\\u00ad/g, '-'), sw: s.scrollWidth, w: s.clientWidth, h: s.getBoundingClientRect().height, lh, tw: t.getBoundingClientRect().width }; })()`);
  ok('D phone: the tile label fits on two lines at most', info.phTile && info.phTile.sw <= info.phTile.w + 1 && info.phTile.h <= 2 * info.phTile.lh + 1, info.phTile);
  await shot('perp-p390-more');
  const tp = await center('.ph-tiles .ph-tile[data-tool="perp"]');
  await touch(tp[0], tp[1]); await settle(600);
  ok('D phone: the tile closes the sheet and selects the tool', (await ev('__cmwCI({shapes:true}).tool')) === 'perp' && (await ev(`!document.querySelector('.ph-sheet') || document.querySelector('.ph-sheet').hidden || !document.querySelector('.ph-sb[data-k="tools"]:not([hidden])')`)), await ev('__cmwCI({shapes:true}).tool'));
  // a curve pick 8 px off the circle (10 px on touch), then a point 15 px off pp (22 px), then an empty spot
  const cp = await W(Math.cos(2.2), Math.sin(2.2));
  await touch(cp[0] - 8 * Math.cos(2.2), cp[1] + 8 * Math.sin(2.2)); await settle(250);
  let d = (await CI()).draft;
  ok('D phone: a tap 8 px off the circle picks it', d && d.curve1 && d.curve1.s === 'pc', d);
  info.phChip = await ev(`(document.querySelector('#draftChipL .cm-chip') || {}).textContent`);
  ok('D phone chip: the tile text, no Esc, a ×', /^Point 1 of 2 · Orthogonal/.test(info.phChip || '') && !/Esc/.test(info.phChip) && !!(await ev(`document.querySelector('#draftChipL .cm-x')`)), info.phChip);
  const pp = await W(0.4, 0.3);
  await touch(pp[0] + 12, pp[1] - 9); await settle(200);
  d = (await CI()).draft;
  ok('D phone: a tap 15 px off a point picks it', d && d.picks.length === 1 && d.picks[0].ref && d.picks[0].ref.s === 'pp', d);
  await shot('perp-p390-pick');
  const pe = await W(-0.5, -0.6);
  await touch(pe[0], pe[1]); await settle(400);
  let st = await ST();
  ok('D phone: K made', last(st).def && last(st).def.op === 'perp' && last(st).def.args[1].s === 'pp', last(st).def);
  await shot('perp-p390-made');
  await touch(cp[0], cp[1]); await settle(150);
  const x = await center('#draftChipL .cm-x');
  if (x) { await touch(x[0], x[1]); await settle(250); }
  ok('D phone: the chip\'s × cancels and leaves the tool', !!x && !((await CI()).draft || {}).curve1 && (await ev('__cmwCI({shapes:true}).tool')) === 'select', [x, (await CI()).draft]);
  // Russian sheet
  await nav(`${U}?ns=${NS}ph&lang=ru`); await settle(1800);
  const more2 = await center('#toolMore > summary');
  await touch(more2[0], more2[1]); await settle(500);
  info.phTileRu = await ev(`(() => { const t = document.querySelector('.ph-tiles .ph-tile[data-tool="perp"]'); const s = t && (t.querySelector('.ph-tl') || t.querySelector('span')); if (!s) return null; const lh = parseFloat(getComputedStyle(s).lineHeight) || 12; return { text: s.textContent.replace(/\\u00ad/g, '-'), sw: s.scrollWidth, w: s.clientWidth, h: s.getBoundingClientRect().height, lh }; })()`);
  ok('D phone RU: «Ортого­нальная» fits on two lines at most', info.phTileRu && info.phTileRu.text === 'Ортого-нальная' && info.phTileRu.sw <= info.phTileRu.w + 1 && info.phTileRu.h <= 2 * info.phTileRu.lh + 1, info.phTileRu);
  await shot('perp-p390-more-ru');
  await view(390, 844, true, true); await settle(600);
  await shot('perp-p390-more-ru-dark');
  await send('Emulation.setUserAgentOverride', { userAgent: ua0 });
  await view(1440, 900, false, false); await settle(300);
  await grab();
});

await section('E', async () => {
  // export captions: a circle C, and a polygon side C (its carrier line), EN and RU
  await view(1440, 900, false, false);
  const SE = {
    shapes: [
      { id: 'ec', kind: 'circle', c: [0, 0], r: 1, ci: 0, visible: true },
      { id: 'e1', kind: 'point', p: [0.3, 0.2], ci: 1, visible: true }, { id: 'e2', kind: 'point', p: [-0.6, 0.5], ci: 1, visible: true },
      { id: 'ek', kind: 'circle', c: [0, 0], r: 1, ci: 2, visible: true, def: { op: 'perp', args: [{ s: 'ec', part: 0 }, { s: 'e1' }, { s: 'e2' }], fill: 'none' } },
    ],
    steps: [{ type: 'recip', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 120 }, nextId: 50,
  };
  const SE2 = {
    shapes: [
      { id: 'pg', kind: 'polygon', pts: [[-1, -1], [1, -1], [0, 1]], ci: 0, visible: true },
      { id: 'e1', kind: 'point', p: [0.3, 0.2], ci: 1, visible: true }, { id: 'e2', kind: 'point', p: [-0.6, 0.5], ci: 1, visible: true },
      { id: 'ek', kind: 'circle', c: [0, 0], r: 1, ci: 2, visible: true, def: { op: 'perp', args: [{ s: 'pg', part: 0 }, { s: 'e1' }, { s: 'e2' }], fill: 'none' } },
    ],
    steps: [{ type: 'recip', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 120 }, nextId: 50,
  };
  const cap = () => ev(`await (async () => { const f = await __cmwFig.build({ for: 'article', cols: 1 }); return f ? f.captionTex : null; })()`);
  await load(NS + 'e1', SE); await settle(900);
  info.capC = await cap();
  ok('E EN caption, circle C: "the circle through z₀ = … and z₁ = … perpendicular to the circle |z| = 1"', /the circle through .+ and .+ perpendicular to the circle/.test(info.capC || ''), info.capC);
  await nav(`${U}?ns=${NS}e1&lang=ru`); await settle(1800);
  info.capCru = await cap();
  ok('E RU caption, circle C', /окружность, проходящая через .+ и[ ~].+ и[ ~]ортогональная окружности/.test(info.capCru || '') && !/[A-Za-z]{3,}/.test(String(info.capCru).replace(/\$[^$]*\$/g, ' ').replace(/\\[A-Za-z]+/g, ' ')), info.capCru);
  await load(NS + 'e2', SE2); await settle(900);
  info.capL = await cap();
  ok('E EN caption, a polygon side C: perpendicular to the line (its carrier)', /perpendicular to the line/.test(info.capL || ''), info.capL);
  await nav(`${U}?ns=${NS}e2&lang=ru`); await settle(1800);
  info.capLru = await cap();
  ok('E RU caption, a polygon side C: ортогональная прямой', /ортогональная прямой/.test(info.capLru || ''), info.capLru);
  await grab();
});

await section('F', async () => {
  // BUDGET60: P dragged with 1 and 10 dependent perpendicular circles (curves and regions), 1/z in Y
  await view(1440, 900, false, false);
  const perfOf = async (n) => {
    const shapes = [{ id: 'C', kind: 'circle', c: [0, 0], r: 1, ci: 0, visible: true }, { id: 'p0', kind: 'point', p: [0.3, 0.2], ci: 1, visible: true }];
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n * 2 * Math.PI, R = 0.5 + 1.2 * (k % 3) / 3;
      shapes.push({ id: 'q' + k, kind: 'point', p: [R * Math.cos(t), R * Math.sin(t)], ci: 2, visible: true });
      shapes.push({ id: 'k' + k, kind: k % 2 ? 'circle' : 'disc', c: [0, 0], r: 1, ci: k % 8, visible: true, def: { op: 'perp', args: [{ s: 'C', part: 0 }, { s: 'p0' }, { s: 'q' + k }], fill: k % 2 ? 'none' : 'in' } });
    }
    await load(NS + 'pf' + n + '_' + (perfOf.k = (perfOf.k || 0) + 1), { shapes, steps: [{ type: 'recip', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 110 }, nextId: 500 });
    await settle(1500);
    await tool('select');
    await ev(`(()=>{ window.__frw = []; window.__frd = []; window.__pm = []; let lastT = 0;
      if (!window.__rafWrapped) { window.__rafWrapped = true; const raf = window.requestAnimationFrame.bind(window);
        window.requestAnimationFrame = (cb) => raf((ts) => { const t0 = performance.now(); cb(ts); if (window.__frw) window.__frw.push(performance.now() - t0); }); }
      const tick = (ts) => { if (!window.__frd) return; if (lastT) window.__frd.push(ts - lastT); lastT = ts; requestAnimationFrame(tick); }; requestAnimationFrame(tick);
      let t0 = 0; window.addEventListener('pointermove', () => { t0 = performance.now(); }, true); window.addEventListener('pointermove', () => { if (window.__pm) window.__pm.push(performance.now() - t0); });
      return 1; })()`);
    const p = await W(0.3, 0.2);
    await drag(p[0], p[1], p[0] + 120, p[1] - 40, 45, 16);
    await settle(200);
    const r = await ev(`(()=>{ const q = (a, p) => { const b = (a || []).slice().sort((x, y) => x - y); return b.length ? +b[Math.min(b.length - 1, Math.floor(p * b.length))].toFixed(2) : null; };
      const r = { work_p95: q(__frw, 0.95), work_max: q(__frw, 1), delta_p50: q(__frd, 0.5), delta_p95: q(__frd, 0.95), move_p95: q(__pm, 0.95), n: (__frd || []).length };
      window.__frw = null; window.__frd = null; window.__pm = null; return r; })()`);
    const st = await ST(), fm = await FORMS();
    const p0 = byId(st, 'p0').p;
    r.follows = p0[0] !== 0.3 && st.list.filter((s) => s.def && s.def.op === 'perp').every((k) => !k.cundef && offCurve(fm[k.id], p0) < 1e-13 && Math.abs(cosAngle(fm[k.id], formOfShape(byId(st, 'C')))) < 1e-12);
    return r;
  };
  info.perf = {};
  // (best of two runs per count: the machine is shared, so one run can be skewed by another process)
  for (const n of [1, 10]) {
    const r1 = await perfOf(n), r2 = await perfOf(n);
    const r = (r1.work_p95 + r1.delta_p95 <= r2.work_p95 + r2.delta_p95) ? r1 : r2;
    r.runs = [[r1.work_p95, r1.delta_p95, r1.move_p95], [r2.work_p95, r2.delta_p95, r2.move_p95]];
    info.perf[n] = r;
    ok(`F drag with ${n} dependents: they follow (through P, perpendicular to C)`, r.follows, r);
    ok(`F BUDGET60 ${n} dependents: rAF work p95 ≤ 14 ms`, r.work_p95 != null && r.work_p95 <= 14, r);
    ok(`F BUDGET60 ${n} dependents: pointermove p95 ≤ 14 ms`, r.move_p95 != null && r.move_p95 <= 14, r);
    ok(`F BUDGET60 ${n} dependents: frame delta p95 ≤ 16.7 ms`, r.delta_p95 != null && r.delta_p95 <= 16.8, r);
  }
  await shot('perp-perf10');
  await grab();
});

await section('G', async () => {
  // Y: a perpendicular circle in Y through z₀″ (the image of X's point), C a target circle
  await view(1440, 900, false, false);
  const SG = {
    shapes: [{ id: 'g0', kind: 'point', p: [-1, -1.5], ci: 0, visible: true }],
    targets: [{ id: 'tc', kind: 'circle', c: [0, 0.3], r: 1.1, ci: 5, visible: true }],
    steps: [{ type: 'zp', params: { a: '1', zeros: '1.5-1i', poles: '' }, on: true }],
    srcView: { cx: 0, cy: 0, s: 80 }, nextId: 50,
  };
  await load(NS + 'g', SG); await settle(900);
  await tool('perp');
  const tcs = await W(1.1 * Math.cos(3.6), 0.3 + 1.1 * Math.sin(3.6), 'R');   // (clear of the pane's legend notes)
  await click(tcs[0] + 1, tcs[1]); await settle(120);
  let d = (await CI()).draft;
  ok('G Y: the target circle is picked as the curve', d && d.side === 'R' && d.curve1 && d.curve1.s === 'tc', d);
  const w0 = [-1 - 1.5, -1.5 + 1];   // f₁(z) = z − 1.5 + i
  const y0 = await W(w0[0], w0[1], 'R'), y1 = await W(0.8, -0.9, 'R');
  await move(y0[0] + 2, y0[1] + 2); await settle(100);
  info.yRing = (await CI()).ring;
  await click(y0[0] + 2, y0[1] + 2); await settle(80); await click(y1[0], y1[1]); await settle(350);
  const st = await ST(), fm = await FORMS();
  const K = last(st);
  ok('G Y: K in Y through z₀″, perpendicular to the target circle', K.def && K.def.op === 'perp' && K.def.args[0].s === 'tc' && K.def.args[1].img === 'g0' && !K.cundef && Math.abs(cosAngle(fm[K.id], formOfShape(byId(st, 'tc')))) <= 1e-12 && offCurve(fm[K.id], w0) < 1e-13, [K.def, info.yRing]);
  info.yRow = await rowD(K.id);
  await shot('perp-d1440-y');
  await grab();
});

info.errs = errs.slice(0, 12);
ok('no console errors or exceptions', errs.length === 0, errs.slice(0, 6));
return { pass: fails.length === 0, checks, fails, info };
