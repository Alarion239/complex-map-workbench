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
//   I v16.4 Inside C only (notes/orthogonal-circle/segments/SPEC.md 11): the chip, the disc model, Intersect bitwise, no
//     pixel outside, the Inspector and ⋯, the half-plane, Y, export captions, links (v16.3 and v16.2 pages: copy their
//     dist/test.html to dist/v163-test.html and dist/v162-test.html first), layouts, BUDGET60, screenshots (seg-*.png).
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
  ok('A1 the Construct grid has seven tiles, Perpendicular circle fifth (v16.3: Touching circle; v16.5 UX55: Hyperbolic line last)', tiles === 'circle3,meet,midpoint,bisector,perp,touch,hyper', tiles);
  info.tile = await ev(`(() => { const b = document.querySelector('#constructTools .tool[data-tool="perp"]'), s = b.querySelector('span'); const lh = parseFloat(getComputedStyle(s).lineHeight); return { tip: b.dataset.tip, desc: b.dataset.desc, label: s.textContent, w: s.clientWidth, sw: s.scrollWidth, h: s.getBoundingClientRect().height, lh, btn: b.getBoundingClientRect().height, bottom: s.getBoundingClientRect().bottom - b.getBoundingClientRect().bottom }; })()`);
  ok('A1 tooltip: Perpendicular circle + its description', info.tile.tip === 'Perpendicular circle  W' && /^Pick a line or a circle, then two points/.test(info.tile.desc), info.tile);
  // (#35: the tool is the Perpendicular circle; its tile, too narrow for the word, reads ⊥ circle)
  ok('A1 the tile label «⊥ circle» fits on one line, inside the tile (v16.3 review user-7)', info.tile.label === '⊥ circle' && info.tile.sw <= info.tile.w + 1 && info.tile.h <= info.tile.lh + 1 && info.tile.bottom <= 0, info.tile);
  await tool('perp');
  // (the left pane is 427 px wide at 1440, under 560: the chip names the tool by its tile text)
  ok('A1 the chip before the curve', (await chipT()) === 'Pick a line or a circle · Perpendicular · Esc cancels', await chipT());
  // refusals before any curve is picked: empty space and a freehand curve give the toast, the draft stays; Esc
  const nA = (await ST()).list.length;
  const em = await W(-0.5, -1.2);
  await click(em[0], em[1]); await settle(150);
  const chipWarn = () => ev(`(document.querySelector('#draftChipL .cm-warn') || {}).textContent || ''`);   // (v16.5 UX52: a refusal is said in the chip)
  const t1s = await chipWarn();
  const fz = await W(-0.5, -1.9);
  await click(fz[0], fz[1] + 1); await settle(150);
  const t2s = await chipWarn();
  let d0 = (await CI()).draft;
  ok('A11 empty space and a freehand curve: the refusal in the chip (v16.5 UX52), the draft stays, nothing made', t1s === 'Click a line or a circle.' && t2s === 'Click a line or a circle.' && d0 && d0.tool === 'perp' && d0.curve1 === null && (await ST()).list.length === nA && (await ev('__cmwCI({shapes:true}).tool')) === 'perp', [t1s, t2s, d0]);
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
  // (v16.5 fix user-6: after the curve the chip says a point on it will do, "Pick a point (on {c} or anywhere)")
  const chipA2 = await chipT();
  ok('A2 the unit circle is picked; no shape yet', d && d.tool === 'perp' && d.curve1 === null && st.list.length === n0 && chipA2.startsWith('Pick a point (on the unit circle or anywhere) · 1 of 2'), { d, n: st.list.length, chip: chipA2 });
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
  // (v16.5 fix rail-4: the unit circle made a shape is "the unit circle" and takes no number; the state's own circle
  // stays Circle 1)
  ok('A3 the row: through z₃ and z₄, perpendicular to the unit circle (v16.5 rail-4; the state has z₀–z₂ and Circle 1)', info.rowK1 === `perpendicular to ${nm(C1.id)}, through ${nm(P1.id)} and ${nm(Q1.id)}` && nm(C1.id) === 'the unit circle', [info.rowK1, info.namesK1]);
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
  // (v16.5: every click clear of the construction chip, which takes two lines with Whole | Inside | Outside [UX51, UX55]:
  // a click on its buttons is the chip's, not the plane's)
  const chipBox = () => ev(`(() => { const c = document.getElementById('draftChipL'); if (c.hidden) return null; const r = c.getBoundingClientRect(); return [r.left - 8, r.top - 8, r.right + 8, r.bottom + 8]; })()`);
  const clear = (q, b) => !b || !(q[0] >= b[0] && q[0] <= b[2] && q[1] >= b[1] && q[1] <= b[3]);
  const c3 = byId(st, 'c3');
  let cb = await chipBox(), c3s = null;
  for (const a of [-0.5, -1, -1.5, -2, -2.5, 0, 3]) { const q = await W(c3.c[0] + c3.r * Math.cos(a), c3.c[1] + c3.r * Math.sin(a)); if (clear(q, cb)) { c3s = q; break; } }
  await click(c3s[0] + 1, c3s[1]); await settle(100);
  cb = await chipBox();
  // (and inside the plane, 16 px clear of its edges: at 1440 with the Inspector open, -1.5 lies left of X)
  const pb = await ev(`(() => { const r = document.getElementById('overlayL').getBoundingClientRect(); return [r.left + 16, r.top + 16, r.right - 16, r.bottom - 16]; })()`);
  const tq = [];
  for (const [a, b] of [[-1.3, 0.9], [-0.4, 1.3], [-1.5, -0.4], [-0.9, -1.1], [-1.9, 0.3], [-1.1, -0.2]]) { const q = await W(a, b); if (clear(q, cb) && q[0] >= pb[0] && q[0] <= pb[2] && q[1] >= pb[1] && q[1] <= pb[3]) tq.push(q); }
  const [t1, t2] = tq;
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
  // (issue #13) a right-click cancels the draft as Esc does, and opens no menu
  await click(cs[0] + 1, cs[1]); await settle(100);
  ok('A11 a curve picked again', (((await CI()).draft || {}).curve1 || {}).s === 'c3', (await CI()).draft);
  const emptyP = await ev(`(() => { const r = document.getElementById('overlayL').getBoundingClientRect(); return [r.left + r.width * 0.85, r.top + r.height * 0.15]; })()`);
  await clickR(emptyP[0], emptyP[1]); await settle(250);
  ok('A11 a right-click cancels the draft, curve included, and opens no menu', (!(await CI()).draft || !(await CI()).draft.curve1) && !(await menuItems()).length, [(await CI()).draft, await menuItems()]);
  await tool('select');
  cs = await onC3();
  await clickR(cs[0] + 1, cs[1]); await settle(250);
  info.planeMenu = await menuItems();
  ok('A11 the plane menu on a circle: Point on this curve, and no tool launchers (issue #13)', info.planeMenu.includes('Point on this curve') && !info.planeMenu.some((t) => /^(Perpendicular circle|Touching circle|Circle through this point|Midpoint with)…/.test(t)), info.planeMenu);
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
  ok('C RU tile «Ортого­нальная» fits on two lines at most', info.ruTile.label === 'Ортого-нальная' && info.ruTile.sw <= info.ruTile.w + 1 && info.ruTile.h <= 2 * info.ruTile.lh + 1 && info.ruTile.bottom <= 0 && info.ruTile.tip === 'Ортогональная окружность  W', info.ruTile);
  await tool('perp');
  // (v16.3.1: at 1440 the chip with «Esc — отмена» took two lines in X's 427 px; it now keeps one line without it.
  // v16.4.1: with v16.4's Whole | Inside icons the text without «Esc — отмена» does not fit one line either, so the rule
  // keeps the whole text on two lines, not cut, as v16.4 showed it)
  const ruChip = await ev(`(() => { const t = document.querySelector('#draftChipL .cm-t'); if (!t) return null; const r = document.createRange(); r.selectNodeContents(t); const s = document.querySelector('#draftChipL .cm-seg'); return { text: t.textContent.replace(/\\u00a0/g, ' '), lines: new Set([...r.getClientRects()].map((q) => Math.round(q.top))).size, cut: t.scrollHeight > t.clientHeight + 1, icons: !!s && s.classList.contains('cm-icons') }; })()`);
  // (#35: a chip that would wrap drops the tool's name first, which the pane head's chip shows, and keeps «Esc — отмена»
  // when that fits one line; else, as before, without «Esc — отмена» on one line, or the whole text on two)
  ok('C RU chip before the curve (one line without the tool\'s name, else without «Esc — отмена», when that fits; with the Whole | Inside icons the whole text on two lines, not cut)', !!ruChip && !ruChip.cut && ((ruChip.text === 'Выберите прямую или окружность · Esc — отмена' && ruChip.lines === 1) || (ruChip.text === 'Выберите прямую или окружность · Ортогональная' && ruChip.lines === 1) || (ruChip.text === 'Выберите прямую или окружность · Ортогональная · Esc — отмена' && ruChip.lines === 2 && ruChip.icons)), ruChip);
  const u = await W(Math.cos(0.9), Math.sin(0.9));
  await move(u[0] + 3, u[1] - 2); await settle(120);
  ok('C RU ring chip: привязка: единичная окружность', ((await CI()).ring || {}).chip === 'привязка: единичная окружность', (await CI()).ring);
  await click(u[0] + 3, u[1] - 2); await settle(100);
  // (v16.5 fix user-6: «Выберите точку (на кривой: … или в любом месте)»; v16.3.1/v16.5: a chip that would wrap with its
  // keyboard tail drops it when it then fits one line, as touch_cmd A5 accepts)
  const ruChip2 = await ev(`(() => { const t = document.querySelector('#draftChipL .cm-t'); if (!t) return null; const r = document.createRange(); r.selectNodeContents(t); return { text: t.textContent, lines: new Set([...r.getClientRects()].map((q) => Math.round(q.top))).size }; })()`);
  const ruBase2 = 'Выберите точку (на кривой: единичная окружность или в любом месте) · 1 из 2 · Ортогональная';
  // (construct.js syncChip, v16.3.1: without the tail when that is one line, or when the whole text would be cut at
  // the lines its place allows: then the shorter text, on two lines)
  ok('C RU chip after the curve', !!ruChip2 && (ruChip2.text === ruBase2 + ' · ⌫\u00a0— отменить выбор · Esc' || (ruChip2.text === ruBase2 && ruChip2.lines <= 2)), ruChip2);
  const a = await W(0.3, 0.2), b = await W(-0.6, 0.5);
  await click(a[0], a[1]); await settle(80); await move(b[0], b[1]); await settle(100);
  await shot('perp-d1440-ru-preview');
  await click(b[0], b[1]); await settle(400);
  let st = await ST();
  const K = last(st);
  info.ruRow = await rowD(K.id);
  // (v16.5 fix rail-4: the unit circle made a shape is «единичная окружность», no number)
  ok('C RU row: через z₃ и z₄, ортогонально кривой: единичная окружность', info.ruRow === 'ортогональна кривой: единичная окружность; через z₃ и z₄', info.ruRow);
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
  await ev(`Phone.tab('construct')`); await settle(200);   // (the Construct tools are on their own tab of the Tools sheet)
  info.phTiles = await ev(`[...document.querySelectorAll('.ph-tiles[data-tab="construct"] > .ph-tile')].map((e) => e.dataset.tool)`);
  ok('D phone: More has the Construct tab with its six tiles', (info.phTiles || []).join().includes('circle3,meet,midpoint,bisector,perp,touch'), info.phTiles);
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
  // (v16.5 fix user-6: "Pick a point (on Circle 1 or anywhere)"; pc is the scene's only circle)
  ok('D phone chip: the tile text, no Esc, a ×', /^Pick a point \(on Circle 1 or anywhere\) · 1 of 2 · Perpendicular/.test(info.phChip || '') && !/Esc/.test(info.phChip) && !!(await ev(`document.querySelector('#draftChipL .cm-x')`)), info.phChip);
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
  await ev(`Phone.tab('construct')`); await settle(200);
  info.phTileRu = await ev(`(() => { const t = document.querySelector('.ph-tiles .ph-tile[data-tool="perp"]'); const s = t && (t.querySelector('.ph-tl') || t.querySelector('span')); if (!s) return null; const lh = parseFloat(getComputedStyle(s).lineHeight) || 12; return { text: s.textContent.replace(/\\u00ad/g, '-'), sw: s.scrollWidth, w: s.clientWidth, h: s.getBoundingClientRect().height, lh }; })()`);
  // (v16.5 UX93: a phone tile shows a whole short form on one line, never a hyphenated word)
  ok('D phone RU: the tile reads «Ортогон.», whole, on one line', info.phTileRu && info.phTileRu.text === 'Ортогон.' && info.phTileRu.sw <= info.phTileRu.w + 1 && info.phTileRu.h <= info.phTileRu.lh + 1, info.phTileRu);
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

await section('I', async () => {
  // v16.4 Inside C only (notes/orthogonal-circle/segments/SPEC.md 11 I): the disc model made with the chip, the hooks' ends
  // and Intersect bitwise, no K pixel outside the disc, the rows, a drag through the diameter; the Inspector and ⋯ (one
  // undo step each), Region, a glider stopped at an end, a crossing that goes undefined; the half-plane (a semicircle, the
  // vertical ray); Y under 1/z (an open arc); export captions EN and RU; reload, v16.3 and v16.2 pages; layouts (dark,
  // Russian, phone, tablet); BUDGET60 with 10 seg dependents; screenshots (seg-*.png)
  const PNG = process.mainModule.require(path.join(DIR, 'png.js'));   // (the daemon's own require)
  const img = async (name) => PNG(fs.readFileSync(await shot(name)));
  const near3 = (a, b, t = 18) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) <= t;
  const hist = async () => (await ST()).hi;
  const ends = (k) => [k.a, k.b];
  const segOn = async (v) => { await ev(`(() => { const b = [...document.querySelectorAll('#draftChipL .cm-sb, #draftChipR .cm-sb')].find((x) => x.getAttribute('aria-label') === ${JSON.stringify(v)}); b && b.click(); return !!b; })()`); await settle(150); };
  const inspBtn = (lab) => ev(`(() => { const b = [...document.querySelectorAll('.cm-iside button')].find((x) => x.textContent.trim() === ${JSON.stringify(lab)}); if (b) b.click(); return !!b; })()`);
  const rowMenuOf = async (id) => { const r = await ev(`(() => { const b = document.querySelector('.shape[data-id="${id}"] .more'); if (!b) return null; b.scrollIntoView({ block: 'nearest' }); const q = b.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; })()`); if (r) { await click(r[0], r[1]); await settle(200); } return r; };
  const SD = { shapes: [], steps: [{ type: 'recip', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 170 }, unit: true, snap: true, nextId: 50 };
  // ---- I1 the disc scene (desktop 1440, light, English)
  await view(1440, 900, false, false);
  await load(NS + 'i1', SD); await settle(900);
  await tool('perp');
  info.segChip = await ev(`[...document.querySelectorAll('#draftChipL .cm-sb')].map((b) => [b.getAttribute('aria-label'), b.title, b.getAttribute('aria-pressed')])`);
  ok('I1 the chip has Whole | Inside | Outside (Whole on; v16.5 UX55: the Inspector\'s three), with its tooltip', JSON.stringify(info.segChip.map((x) => x[0])) === '["Whole","Inside","Outside"]' && info.segChip[0][2] === 'true' && /^Inside: only the arc inside the curve/.test(info.segChip[1][1]), info.segChip);
  await segOn('Inside');
  const u = await W(Math.cos(0.9), Math.sin(0.9));
  await click(u[0] + 2, u[1] - 1); await settle(150);
  const PQ = [[[0.3, 0.2], [-0.6, 0.5]], [[-0.3, -0.6], [0.6, -0.1]], [[0.1, 0.7], [-0.2, -0.3]]];
  // (the dashed preview: the arc the click will make, read on the overlay canvas: ink on K's carrier inside the disc only)
  const prevPix = (Bz) => ev(`(() => { const r0 = __cmwW2S('L', 0, 0); const cvs = [...document.querySelectorAll('canvas')].filter((c) => { const b = c.getBoundingClientRect(); return r0[0] > b.left && r0[0] < b.right && r0[1] > b.top && r0[1] < b.bottom; }); const cv = cvs.reverse().find((c) => { try { return !!c.getContext('2d'); } catch (e) { return false; } }); if (!cv) return null;
    const b = cv.getBoundingClientRect(), k = cv.width / b.width, cx = cv.getContext('2d'), G = Constr.perpForm({ A: 1, B: [0, 0], C: -1, o: [0, 0] }, [0.3, 0.2], ${JSON.stringify(Bz)}).G, g = Constr.geomOf(G);
    let inI = 0, inN = 0, outI = 0, outN = 0;
    for (let j = 0; j < 720; j++) { const t = j * Math.PI / 360, z = [g.c[0] + g.r * Math.cos(t), g.c[1] + g.r * Math.sin(t)], m = Math.hypot(z[0], z[1]); if (Math.abs(m - 1) < 0.06) continue; const s = __cmwW2S('L', z[0], z[1]), x = (s[0] - b.left) * k, y = (s[1] - b.top) * k; if (x < 3 || y < 3 || x > cv.width - 4 || y > cv.height - 4) continue; const d = cx.getImageData(Math.round(x) - 1, Math.round(y) - 1, 3, 3).data; let a = 0; for (let i = 3; i < d.length; i += 4) a = Math.max(a, d[i]); if (m < 1) { inN++; if (a > 40) inI++; } else { outN++; if (a > 40) outI++; } }
    return { inI, inN, outI, outN }; })()`);
  for (const [a, b] of PQ) { const A = await W(a[0], a[1]), B = await W(b[0], b[1]); await click(A[0] + 1, A[1]); await settle(100); await move(B[0], B[1]); await settle(150); if (a[0] === 0.3) { await shot('seg-d1440-preview'); info.segPreview = await prevPix(b); } await click(B[0], B[1]); await settle(350); }
  ok('I1 the dashed preview draws the arc inside the disc only', info.segPreview && info.segPreview.inN > 20 && info.segPreview.inI > 0.4 * info.segPreview.inN && info.segPreview.outI === 0, info.segPreview);
  await key('Escape'); await tool('select'); await settle(200);
  let st = await ST();
  const Ks = st.list.filter((s) => s.def && s.def.op === 'perp'), C1 = byId(st, Ks[0].def.args[0].s);
  const names = await CI({ names: true }), nm = (id) => (names.find((x) => x.id === id) || {}).name;
  // (v16.5 fix rail-4: the shown unit circle made the shape C is "the unit circle", no number)
  ok('I1 three geodesics, each an arc with seg 1 and nk hyper, named Hyperbolic line 1–3 (v16.5 UX55); C is the unit circle (v16.5 rail-4)', Ks.length === 3 && Ks.every((k, i) => k.kind === 'arc' && k.def.seg === 1 && k.def.nk === 'hyper' && nm(k.id) === `Hyperbolic line ${i + 1}`) && nm(C1.id) === 'the unit circle', Ks.map((k) => [k.kind, k.def.seg, k.def.nk, nm(k.id)]).concat([['C', nm(C1.id)]]));
  const rows = [];
  for (const k of Ks) rows.push(await rowD(k.id));
  info.segRows = rows;
  ok('I1 rows: "hyperbolic line inside the unit circle, through z₀ and z₁" (v16.5 rail-4)', rows[0] === 'hyperbolic line inside the unit circle, through z₀ and z₁' && rows.every((r) => /^hyperbolic line inside the unit circle, through z. and z.$/.test(r)), rows);
  // Intersect(K, C) in both orders: the hooks' ends, bitwise
  const mk = Ks.flatMap((k, i) => [[k.id, C1.id, 0], [k.id, C1.id, 1], [C1.id, k.id, 0], [C1.id, k.id, 1]].map(([a, b, x], j) => ({ id: `im${i}${j}`, kind: 'point', p: [0, 0], visible: true, helper: false, def: { op: 'meet', args: [{ s: a, part: 0 }, { s: b, part: 0 }], index: x } })));
  await ev(`__cmwC({ call: 'create', args: [${JSON.stringify(mk)}] })`); await settle(300);
  st = await ST();
  let bitsOk = true;
  const fm = await FORMS();
  Ks.forEach((k0, i) => {
    const k = byId(st, k0.id), m = (j) => byId(st, `im${i}${j}`).p, e = fm[k.id].sg.ends;
    const be = (a, b) => Object.is(a[0], b[0]) && Object.is(a[1], b[1]);
    if (!(be(m(0), e[0]) && be(m(1), e[1]) && be(m(2), e[1]) && be(m(3), e[0]) && [k.a, k.b].every((x) => be(x, e[0]) || be(x, e[1])))) bitsOk = false;
  });
  ok('I1 Intersect(K, C) gives the drawn ends bitwise, in both orders (i ↔ 1 − i)', bitsOk, Ks.map((k) => [byId(st, k.id).a, byId(st, k.id).b]));
  await ev(`__cmwC({ call: 'remove', args: [${JSON.stringify(mk.map((x) => x.id))}] })`); await settle(300);
  await shot('seg-d1440-light-disc');
  // no K pixel outside the disc: the carriers sampled outside |z| > 1 + (half a stroke + 3 px), with and without the K's
  const pts = [];
  for (const k of Ks) {
    const g = fm[k.id], A = g.A;
    if (A === 0) continue;
    const c = [g.o[0] - g.B[0] / A, g.o[1] - g.B[1] / A], r = 1 / Math.abs(A);
    for (let j = 0; j < 720; j++) { const z = [c[0] + r * Math.cos(j * Math.PI / 360), c[1] + r * Math.sin(j * Math.PI / 360)]; if (Math.hypot(...z) > 1 + 5 / 170 && Math.abs(z[0]) < 1.25 && Math.abs(z[1]) < 1.25) pts.push(await W(z[0], z[1])); }
  }
  const im1 = await img('seg-i1-with');
  await ev(`(() => { for (const id of ${JSON.stringify(Ks.map((k) => k.id))}) { const s = __cmwP ? null : null; } return 1; })()`);
  await ev(`(() => { const S = __cmwCI({shapes:true}); return 1; })()`);
  for (const k of Ks) await ev(`(() => { const e = document.querySelector('.shape[data-id="${k.id}"] .eye'); if (e) e.click(); return !!e; })()`);
  await settle(400);
  const im0 = await img('seg-i1-without');
  for (const k of Ks) await ev(`(() => { const e = document.querySelector('.shape[data-id="${k.id}"] .eye'); if (e) e.click(); return !!e; })()`);
  await settle(300);
  const diff = pts.filter((p) => !near3(im1.at(p[0], p[1]), im0.at(p[0], p[1])));
  info.outsideSamples = { n: pts.length, differ: diff.length };
  ok('I1 no K pixel outside |z| = 1 by more than half a stroke (carriers sampled outside, with and without the K\'s)', pts.length > 100 && diff.length === 0, info.outsideSamples);
  // drag z₀ over 20 frames through the diameter (0, z₁ collinear at 0.36 − 0.3i): never undefined, the arc stays inside
  const P1 = byId(st, Ks[0].def.args[1].s);
  const d0 = await W(0.3, 0.2), d1 = await W(0.42, -0.5);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: d0[0], y: d0[1] });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: d0[0], y: d0[1], button: 'left', buttons: 1, clickCount: 1 });
  let und = 0, outside = 0, lineSeen = false;
  for (let i = 1; i <= 20; i++) {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: d0[0] + (d1[0] - d0[0]) * i / 20, y: d0[1] + (d1[1] - d0[1]) * i / 20, button: 'left', buttons: 1 });
    await ev('new Promise((r) => requestAnimationFrame(r))');
    const s2 = await ST(), k = byId(s2, Ks[0].id), f = (await FORMS())[k.id];
    if (k.cundef || !f) { und++; continue; }
    if (Math.abs(f.A) < 0.05) lineSeen = true;
    if (!(Math.hypot(...k.m) < 1) || Math.abs(Math.hypot(...k.a) - 1) > 1e-14 || Math.abs(Math.hypot(...k.b) - 1) > 1e-14) outside++;
  }
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: d1[0], y: d1[1], button: 'left', buttons: 0, clickCount: 1 });
  await settle(250);
  info.segDrag = { und, outside, lineSeen, p: byId(await ST(), P1.id).p };
  ok('I1 z₀ dragged 20 frames through the diameter: no undefined frame, the arc stays inside, its ends on |z| = 1', und === 0 && outside === 0 && byId(await ST(), P1.id).p[1] < 0, info.segDrag);
  await key('z', 4); await settle(300);
  // ---- I2 the Inspector and ⋯
  const K1 = Ks[0].id;
  await ev(`__cmwCI({}) && 1`);
  await ev(`(() => { const r = document.querySelector('.shape[data-id="${K1}"] .shape-name') || document.querySelector('.shape[data-id="${K1}"]'); r && r.click(); return 1; })()`); await settle(300);
  info.inspSides = await ev(`[...document.querySelectorAll('.cm-iside button')].map((b) => b.textContent.trim() + (b.classList.contains('on') ? '*' : ''))`);
  ok('I2 the Inspector: Whole | Inside | Outside, Inside on', JSON.stringify(info.inspSides) === '["Whole","Inside*","Outside"]', info.inspSides);
  const steps = [];
  for (const [lab, want] of [['Outside', -1], ['Whole', 0], ['Inside', 1]]) {
    const h0 = await hist();
    await inspBtn(lab); await settle(300);
    const k = byId(await ST(), K1);
    steps.push([lab, k.def.seg || 0, k.kind, (await hist()) - h0]);
  }
  info.inspSteps = steps;
  ok('I2 Whole / Inside / Outside each toggle in one undo step', steps.every(([lab, v, kind, dh], i) => v === [-1, 0, 1][i] && dh === 1 && kind === (v ? 'arc' : 'circle')), steps);
  const h0 = await hist();
  await rowMenuOf(K1);
  info.segMenu = await menuItems();
  const okOther = await menuClick('Other side'); await settle(300);
  const kO = byId(await ST(), K1);
  ok('I2 ⋯: Other side and Whole circle while on; Other side flips the side in one undo step', info.segMenu.includes('Other side') && info.segMenu.includes('Whole circle') && okOther && kO.def.seg === -1 && (await hist()) - h0 === 1, [info.segMenu, kO.def.seg]);
  await key('z', 4); await settle(300);
  await rowMenuOf(K1);
  await menuClick('Region'); await settle(300);
  const kR = byId(await ST(), K1);
  ok('I2 Region turns the switch off', kR.def.fill === 'in' && !('seg' in kR.def) && kR.kind === 'disc', kR.def);
  await key('z', 4); await settle(300);
  ok('I2 undo brings Inside back', byId(await ST(), K1).def.seg === 1, byId(await ST(), K1).def);
  // a glider on the arc stops at the ends
  await ev(`__cmwC({ call: 'create', args: [[{ id: 'ig', kind: 'point', p: [0, 0], t: 0.5, visible: true, def: { op: 'glider', args: [{ s: '${K1}', part: 0 }] } }]] })`); await settle(300);
  st = await ST();
  // ([v16.5 rail SPEC 2.3] 30 px past the end: the stretch zone, so it stays on its arc; a pull of 40 px held frees it)
  const sI = (await W(1, 0))[0] - (await W(0, 0))[0];
  const kk = byId(st, K1), g0 = byId(st, 'ig').p, kEnd = 1 + 30 / (sI * Math.hypot(kk.a[0], kk.a[1])), gEnd = await W(kk.a[0] * kEnd, kk.a[1] * kEnd);
  const gs = await W(g0[0], g0[1]);
  await drag(gs[0], gs[1], gEnd[0], gEnd[1], 20, 16); await settle(300);
  st = await ST();
  const gl = byId(st, 'ig');
  info.glider = { t: gl.t, p: gl.p, a: byId(st, K1).a };
  ok('I2 a glider dragged past an end stops there (t 0, the end bitwise)', (gl.t === 0 || gl.t === 1) && Object.is(gl.p[0], (gl.t === 0 ? byId(st, K1).a : byId(st, K1).b)[0]) && Object.is(gl.p[1], (gl.t === 0 ? byId(st, K1).a : byId(st, K1).b)[1]), info.glider);
  // Intersect on two crossing geodesics (Arc 1 and Arc 3): a point; move Arc 3's z₄ so they no longer cross: undefined
  await tool('meet');
  const fm2 = await FORMS();
  let X = null;
  { const k1 = byId(st, Ks[0].id), k3 = byId(st, Ks[2].id); for (let j = 0; j < 4000 && !X; j++) { const z = [-1 + 2 * (j % 200) / 200, -1 + 2 * Math.floor(j / 200) / 20]; } }
  // (the crossing from the forms: Newton on both levels from the middle of Arc 1)
  { const f = (G, z) => fAt(G, z), G1 = fm2[Ks[0].id], G3 = fm2[Ks[2].id]; let z = byId(st, Ks[0].id).m.slice(); for (let it = 0; it < 60; it++) { const h = 1e-7, J = [[(f(G1, [z[0] + h, z[1]]) - f(G1, z)) / h, (f(G1, [z[0], z[1] + h]) - f(G1, z)) / h], [(f(G3, [z[0] + h, z[1]]) - f(G3, z)) / h, (f(G3, [z[0], z[1] + h]) - f(G3, z)) / h]], F = [f(G1, z), f(G3, z)], det = J[0][0] * J[1][1] - J[0][1] * J[1][0]; z = [z[0] - (J[1][1] * F[0] - J[0][1] * F[1]) / det, z[1] - (-J[1][0] * F[0] + J[0][0] * F[1]) / det]; } X = z; }
  const xs = await W(X[0], X[1]);
  const nBefore = (await ST()).list.length;
  await move(xs[0], xs[1]); await settle(150); await click(xs[0], xs[1]); await settle(400);
  st = await ST();
  const M = st.list.length > nBefore ? last(st) : null;
  ok('I2 Intersect on two crossing geodesics makes a point inside the disc', M && M.def && M.def.op === 'meet' && !M.cundef && Math.hypot(...M.p) < 1, M && M.def);
  await tool('select');
  const z4 = byId(st, Ks[2].def.args[1].s), z4s = await W(z4.p[0], z4.p[1]), z4t = await W(0.2, -0.7);
  await drag(z4s[0], z4s[1], z4t[0], z4t[1], 16, 16); await settle(400);
  st = await ST();
  const M2 = M && byId(st, M.id);
  info.meetUndef = M2 && { undef: M2.cundef, row: await rowD(M.id), k3: byId(st, Ks[2].id).cundef };
  ok('I2 moving one geodesic so they no longer cross: the point is undefined, with its reason', M2 && M2.cundef && M2.cundef.code === 'nomeet' && info.meetUndef.row && info.meetUndef.row.length > 3 && !byId(st, Ks[2].id).cundef, info.meetUndef);
  await key('z', 4); await settle(300);
  await shot('seg-d1440-light-made');
  // ---- I3 the half-plane: the real axis; a semicircle, then the vertical ray 1+i, 1+2i
  await load(NS + 'i3', { shapes: [], steps: [{ type: 'recip', params: {}, on: true }], srcView: { cx: 1, cy: 1, s: 150 }, unit: false, snap: true, nextId: 50 });
  await settle(900);
  await tool('perp'); await segOn('Inside');
  const ax = await W(2.3, 0);
  await click(ax[0], ax[1] + 1); await settle(150);
  for (const [a, b] of [[[0.5, 1], [2, 0.5]], [[1, 1], [1, 2]]]) { const A = await W(a[0], a[1]), B = await W(b[0], b[1]); await click(A[0], A[1]); await settle(100); await click(B[0], B[1]); await settle(350); }
  await key('Escape'); await tool('select'); await settle(200);
  st = await ST();
  const H = st.list.filter((s) => s.def && s.def.op === 'perp');
  info.half = H.map((k) => ({ kind: k.kind, a: k.a, b: k.b, m: k.m, seg: k.def.seg, row: null }));
  for (let i = 0; i < H.length; i++) info.half[i].row = await rowD(H[i].id);
  ok('I3 half-plane: a semicircle above the axis (an arc, its ends on it) and the vertical ray from 1 (kind ray, above)', H.length === 2 && H[0].kind === 'arc' && H[0].a[1] === 0 && H[0].b[1] === 0 && H[0].m[1] > 0 && H[1].kind === 'ray' && H[1].a[0] === 1 && H[1].a[1] === 0 && H[1].b[1] > 0, info.half);
  ok('I3 rows: "hyperbolic line on one side of Line 1, through …"', info.half.every((h) => /^hyperbolic line on one side of /.test(h.row || '')), info.half.map((h) => h.row));
  // the ray drawn above the axis up to the pane's edge, nothing below
  const imH1 = await img('seg-i3-with');
  for (const k of H) await ev(`(() => { const e = document.querySelector('.shape[data-id="${k.id}"] .eye'); if (e) e.click(); return 1; })()`);
  await settle(400);
  const imH0 = await img('seg-i3-without');
  for (const k of H) await ev(`(() => { const e = document.querySelector('.shape[data-id="${k.id}"] .eye'); if (e) e.click(); return 1; })()`);
  await settle(300);
  const top = await ev(`(() => { const r = document.querySelector('#plotL canvas, .plot canvas') ; return r ? r.getBoundingClientRect().top : 0; })()`);
  const above = [], below = [];
  for (let y = 1.3; y < 7; y += 0.1) { const p = await W(1, y); if (p[1] > top + 12 && Math.abs(y - 2) > 0.15) above.push(p); }
  for (let y = -0.2; y > -0.9; y -= 0.1) below.push(await W(1, y));
  const aDrawn = above.filter((p) => !near3(imH1.at(p[0], p[1]), imH0.at(p[0], p[1]))).length, bDrawn = below.filter((p) => !near3(imH1.at(p[0], p[1]), imH0.at(p[0], p[1]))).length;
  info.ray = { above: [aDrawn, above.length], below: [bDrawn, below.length] };
  ok('I3 the vertical ray is drawn above the axis to the pane\'s edge, nothing below', aDrawn === above.length && above.length > 3 && bDrawn === 0, info.ray);
  await shot('seg-d1440-light-halfplane');
  // ---- I4 Y under 1/z: the image of Arc 1 is open: nothing drawn on the image of K's outside part
  await load(NS + 'i4', { shapes: [{ id: 'c', kind: 'circle', c: [0, 0], r: 1, ci: 0, visible: true }, { id: 'p', kind: 'point', p: [0.3, 0.2], ci: 1, visible: true }, { id: 'q', kind: 'point', p: [-0.6, 0.5], ci: 1, visible: true },
    { id: 'k', kind: 'arc', a: [1, 0], m: [0, 0.5], b: [-1, 0], ci: 2, visible: true, def: { op: 'perp', args: [{ s: 'c', part: 0 }, { s: 'p' }, { s: 'q' }], fill: 'none', nk: 'arc', seg: 1 } }],
    steps: [{ type: 'recip', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 150 }, nextId: 50 });
  await settle(1000);
  const fk = (await FORMS()).k, ck = [fk.o[0] - fk.B[0] / fk.A, fk.o[1] - fk.B[1] / fk.A], rk = 1 / Math.abs(fk.A);
  const ypts = [];
  for (let j = 0; j < 720; j++) { const z = [ck[0] + rk * Math.cos(j * Math.PI / 360), ck[1] + rk * Math.sin(j * Math.PI / 360)]; if (Math.hypot(...z) < 1 + 6 / 150) continue; const d = z[0] * z[0] + z[1] * z[1], w = [z[0] / d, -z[1] / d]; if (Math.hypot(...w) > 1 - 6 / 60) continue; ypts.push(await W(w[0], w[1], 'R')); }
  // (Y fits its view to what is shown, so K's own colour is the test: read on the drawn image, at F(K(1/2)))
  const imY1 = await img('seg-i4-with');
  const kM = byId(await ST(), 'k').m, dM = kM[0] * kM[0] + kM[1] * kM[1], onImg = await W(kM[0] / dM, -kM[1] / dM, 'R');
  let ink = null, bestD = -1;
  for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) { const c = imY1.at(onImg[0] + dx, onImg[1] + dy), dd = Math.abs(c[0] - c[1]) + Math.abs(c[1] - c[2]) + Math.abs(c[0] - c[2]); if (dd > bestD) { bestD = dd; ink = c; } }
  const yDiff = ypts.filter((p) => near3(imY1.at(p[0], p[1]), ink, 60)).length;
  const kY = byId(await ST(), 'k');
  info.yOpen = { n: ypts.length, drawn: yDiff, kind: kY.kind, ink };
  ok('I4 Y under 1/z: the image is the open arc only (nothing on the image of K outside the disc)', kY.kind === 'arc' && ypts.length > 20 && yDiff === 0, info.yOpen);
  // ---- I5 export captions, EN and RU (through z₀ and z₁; and on K when z₁ is outside the disc)
  const capF = () => ev(`await (async () => { const f = await __cmwFig.build({ for: 'article', cols: 1 }); return f ? f.captionTex : null; })()`);
  info.segCap = await capF();
  ok('I5 EN caption: "the hyperbolic line through z₀ … and z₁ … in the domain |z|<1"', /the hyperbolic line through .+ and .+ in the domain \$\|z\|<1\$/.test(info.segCap || ''), info.segCap);
  await ev(`__cmwC({ call: 'moved', args: [{ all: true }] }) && 1`);
  const SE = JSON.parse(JSON.stringify(await ev(`JSON.parse(JSON.stringify(__cmwCI({shapes:true}).list))`)));
  await load(NS + 'i5', { shapes: SE.map((s) => (s.id === 'q' ? Object.assign(s, { p: [-1.2, 1] }) : s)), steps: [{ type: 'recip', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 150 }, nextId: 50 });
  await settle(900);
  info.segCapOn = await capF();
  ok('I5 EN caption, z₁ outside: "the hyperbolic line in the domain |z|<1 on the circle through …"', /the hyperbolic line in the domain \$\|z\|<1\$ on the circle through .+ perpendicular to/.test(info.segCapOn || ''), info.segCapOn);
  await nav(`${U}?ns=${NS}i4&lang=ru`); await settle(1800);
  info.segCapRu = await capF();
  ok('I5 RU caption: «гиперболическая прямая в области |z|<1, проходящая через …»', /гиперболическая прямая в[ ~]области \$\|z\|<1\$, проходящая через .+ и[ ~]/.test(info.segCapRu || ''), info.segCapRu);
  await nav(`${U}?ns=${NS}i5&lang=ru`); await settle(1800);
  info.segCapOnRu = await capF();
  ok('I5 RU caption, z₁ outside: «… лежащая на окружности, проходящей через …»', /гиперболическая прямая в[ ~]области \$\|z\|<1\$, лежащая на[ ~]окружности, проходящей через/.test(info.segCapOnRu || ''), info.segCapOnRu);
  // the SVG: K's path from e_start to e_end, butt caps
  await nav(`${U}?ns=${NS}i4`); await settle(1500);
  info.segSvg = await ev(`await (async () => { const f = await __cmwFig.build({ for: 'article', cols: 1 }); const svg = f && (f.svg || (f.panels && f.panels[0] && f.panels[0].svg)) || ''; const caps = (svg.match(/stroke-linecap="[a-z]+"/g) || []).slice(0, 8); return { has: !!svg, len: svg.length, caps, keys: f ? Object.keys(f).slice(0, 20) : null }; })()`);
  // ---- I6 links: reload bitwise; the v16.3 page (whole circles); the v16.2 page (plain arcs)
  const snapS = (s2) => s2.list.map((s) => JSON.stringify([s.id, s.kind, s.def, s.c, s.r, s.a, s.b, s.m, s.p]));
  st = await ST();
  const bef = snapS(st), fb = JSON.stringify((await FORMS()).k);
  await nav(`${U}?ns=${NS}i4`); await settle(1500);
  ok('I6 reload: every shape and K\'s form come back bitwise', bef.join('\n') === snapS(await ST()).join('\n') && fb === JSON.stringify((await FORMS()).k), snapS(await ST()));
  const payload = await ev(`await Params.encodeLink(__cmwP().figure)`);
  for (const [v, want] of [['163', 'circle'], ['162', 'arc']]) {
    const has = fs.existsSync(path.join(DIR, '..', '..', 'dist', `v${v}-test.html`));
    if (!has) { info['v' + v] = 'no page'; continue; }
    await logs();
    await nav(`http://localhost:${PORT}/v${v}-test.html?ns=${NS}o${v}#cmw=${payload}`); await settle(2200);
    const old = await ev(`__cmwCI({shapes:true}).list.find((s) => s.id === 'k')`);
    const lg = (await logs()).filter((x) => x.t === 'EXC' || x.t === 'error');
    info['v' + v] = { kind: old && old.kind, seg: old && old.def && old.def.seg, def: !!(old && old.def), errs: lg.slice(0, 3) };
    ok(v === '163' ? 'I6 the v16.3 page opens the link: K is the whole circle (seg kept), no console error' : 'I6 the v16.2 page opens the link: K is a plain arc', old && old.kind === want && (v === '162' || old.def.seg === 1) && lg.length === 0, info['v' + v]);
  }
  await nav(`${U}?ns=${NS}i1`); await settle(1500);
  await logs();
  // ---- I7 layouts: dark; Russian (chip, Inspector, rows, ⋯); tablet 768; phone 390 × 844
  await view(1440, 900, true, false); await settle(500);
  await shot('seg-d1440-dark-disc');
  await view(1440, 900, false, false);
  await nav(`${U}?ns=${NS}i1&lang=ru`); await settle(1800);
  await tool('perp'); await settle(200);
  info.ruChip = await ev(`[...document.querySelectorAll('#draftChipL .cm-sb')].map((b) => [b.getAttribute('aria-label'), b.title])`);
  await key('Escape'); await tool('select');
  st = await ST();
  const KR = st.list.filter((s) => s.def && s.def.op === 'perp');
  info.ruRow = await rowD(KR[0].id);
  await ev(`(() => { const r = document.querySelector('.shape[data-id="${KR[0].id}"] .shape-name') || document.querySelector('.shape[data-id="${KR[0].id}"]'); r && r.click(); return 1; })()`); await settle(300);
  info.ruInsp = await ev(`(() => { const g = document.querySelector('.cm-iside'); if (!g) return null; const r = g.getBoundingClientRect(), p = g.parentElement.getBoundingClientRect(); return { labels: [...g.querySelectorAll('button')].map((b) => b.textContent.trim()), w: r.width, right: r.right, pr: p.right }; })()`);
  await rowMenuOf(KR[0].id);
  info.ruMenu = await menuItems();
  await key('Escape');
  // (v16.5 fix rail-4: C, the shown unit circle made a shape, is «единичная окружность» in the row, no number)
  ok('I7 Russian: the chip (Целиком | Внутри), the row, the Inspector control and the ⋯ items', JSON.stringify(info.ruChip.map((x) => x[0])) === '["Целиком","Внутри","Снаружи"]' && /^гиперболическая прямая внутри кривой: единичная окружность; через z₀ и z₁$/.test(info.ruRow || '') && info.ruInsp && JSON.stringify(info.ruInsp.labels) === '["Целиком","Внутри","Снаружи"]' && info.ruInsp.right <= info.ruInsp.pr + 0.5 && info.ruMenu.includes('Другая сторона') && info.ruMenu.includes('Окружность целиком'), { chip: info.ruChip, row: info.ruRow, insp: info.ruInsp, menu: info.ruMenu });
  await shot('seg-d1440-light-ru');
  await view(1440, 900, true, false); await settle(500);
  await shot('seg-d1440-dark-ru');
  await view(768, 1024, false, false);
  await nav(`${U}?ns=${NS}i1`); await settle(1800);
  await shot('seg-t768-light');
  await view(390, 844, false, true);
  await nav(`${U}?ns=${NS}i1`); await settle(2200);
  await shot('seg-p390-light');
  await view(390, 844, true, true); await settle(500);
  await shot('seg-p390-dark');
  await nav(`${U}?ns=${NS}i1&lang=ru`); await settle(2200);
  await view(390, 844, false, true); await settle(400);
  await shot('seg-p390-light-ru');
  await view(1440, 900, false, false);
  // (the Inspector control at 360 px: the phone's sheet holds the Inspector; measured in a 360 px box)
  await nav(`${U}?ns=${NS}i1&lang=ru`); await settle(1800);
  st = await ST();
  await ev(`(() => { const r = document.querySelector('.shape[data-id="${st.list.find((s) => s.def && s.def.op === 'perp').id}"] .shape-name'); r && r.click(); return 1; })()`); await settle(300);
  info.fit360 = await ev(`(() => { const g = document.querySelector('.cm-iside'); if (!g) return null; const box = document.createElement('div'); box.style.cssText = 'position:fixed;left:0;top:0;width:360px;padding:0 16px;box-sizing:border-box'; const c = g.cloneNode(true); box.append(c); document.body.append(box); const w = c.getBoundingClientRect().width, sw = c.scrollWidth; box.remove(); return { w, sw }; })()`);
  ok('I7 the Inspector control fits a 360 px Inspector in Russian', info.fit360 && info.fit360.w <= 328 && info.fit360.sw <= 328, info.fit360);
  await grab();
  // ---- I8 BUDGET60: P dragged with 10 seg dependents, 1/z in Y; rAF work vs the whole-circle run
  const perfSeg = async (seg) => {
    const shapes = [{ id: 'C', kind: 'circle', c: [0, 0], r: 1, ci: 0, visible: true }, { id: 'p0', kind: 'point', p: [0.3, 0.2], ci: 1, visible: true }];
    for (let k = 0; k < 10; k++) {
      const t = (k + 0.5) / 10 * 2 * Math.PI, R = 0.4 + 0.5 * (k % 3) / 3;
      shapes.push({ id: 'q' + k, kind: 'point', p: [R * Math.cos(t), R * Math.sin(t)], ci: 2, visible: true });
      shapes.push({ id: 'k' + k, kind: 'circle', c: [0, 0], r: 1, ci: k % 8, visible: true, def: Object.assign({ op: 'perp', args: [{ s: 'C', part: 0 }, { s: 'p0' }, { s: 'q' + k }], fill: 'none', nk: 'circle' }, seg ? { seg: 1 } : {}) });
    }
    await load(NS + 'ps' + seg + '_' + (perfSeg.k = (perfSeg.k || 0) + 1), { shapes, steps: [{ type: 'recip', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 110 }, nextId: 500 });
    await settle(1500);
    await tool('select');
    await ev(`(()=>{ window.__frw = []; window.__frd = []; let lastT = 0;
      if (!window.__rafWrapped) { window.__rafWrapped = true; const raf = window.requestAnimationFrame.bind(window);
        window.requestAnimationFrame = (cb) => raf((ts) => { const t0 = performance.now(); cb(ts); if (window.__frw) window.__frw.push(performance.now() - t0); }); }
      const tick = (ts) => { if (!window.__frd) return; if (lastT) window.__frd.push(ts - lastT); lastT = ts; requestAnimationFrame(tick); }; requestAnimationFrame(tick); return 1; })()`);
    const p = await W(0.3, 0.2);
    await drag(p[0], p[1], p[0] + 60, p[1] - 30, 45, 16);
    await settle(200);
    return ev(`(()=>{ const q = (a, p) => { const b = (a || []).slice().sort((x, y) => x - y); return b.length ? +b[Math.min(b.length - 1, Math.floor(p * b.length))].toFixed(2) : null; };
      const r = { work_p95: q(__frw, 0.95), delta_p95: q(__frd, 0.95), n: (__frd || []).length }; window.__frw = null; window.__frd = null; return r; })()`);
  };
  const best = (a, b) => (a.work_p95 + a.delta_p95 <= b.work_p95 + b.delta_p95 ? a : b);
  const rw = best(await perfSeg(0), await perfSeg(0)), rs = best(await perfSeg(1), await perfSeg(1));
  info.segPerf = { whole: rw, seg: rs };
  ok('I8 BUDGET60, 10 seg dependents, 1/z in Y: frame p95 ≤ 16.7 ms', rs.delta_p95 != null && rs.delta_p95 <= 16.8, info.segPerf);
  ok('I8 rAF work no worse than the whole-circle run by more than 1 ms', rs.work_p95 <= rw.work_p95 + 1, info.segPerf);
  await shot('seg-perf10');
  await grab();
});

await section('J', async () => {
  // v16.4 review fixes (notes/orthogonal-circle/segments/ledger.json): captions close their phrase (user-2, user-3), the
  // outside's domain on the sphere (math-3), through only for points of the domain (math-7), the row off the arc
  // (user-6), the ⋯ item's words (math-6), the chip's words by its free width (user-4), the phone's hit area (user-5)
  const capF = (o) => ev(`await (async () => { const f = await __cmwFig.build(${JSON.stringify(o || { for: 'article', cols: 1 })}); return f ? f.captionTex : null; })()`);
  const Kd = (id, a, b, seg, c = 'c') => ({ id, kind: 'arc', a: [1, 0], m: [0, 1], b: [-1, 0], visible: true, def: Object.assign({ op: 'perp', args: [{ s: c, part: 0 }, { s: a }, { s: b }], fill: 'none', nk: 'arc' }, seg ? { seg } : {}) });
  const pt = (id, p) => ({ id, kind: 'point', p, visible: true });
  const scene = (shapes) => ({ shapes, steps: [{ type: 'recip', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 150 }, nextId: 50 });
  const UC = { id: 'c', kind: 'circle', c: [0, 0], r: 1, visible: true };
  const text = (tex) => String(tex || '').replace(/\\\[[\s\S]*?\\\]|\$[^$]*\$/g, ' M ');
  const stray = (tex) => /,\s*[,.;:()]|,\s*$|⁣/.test(text(tex));
  await view(1440, 900, false, false);
  // J1 a hyperbolic triangle: EN and RU captions, the on-screen caption and the homework caption
  const tri = scene([UC, pt('p0', [0.1, 0.6]), pt('p1', [-0.5, -0.3]), pt('p2', [0.55, -0.25]), Kd('k1', 'p0', 'p1', 1), Kd('k2', 'p1', 'p2', 1), Kd('k3', 'p2', 'p0', 1)]);
  await load(NS + 'j1', tri); await settle(900);
  info.jEn = await capF();
  info.jScreen = await ev(`__cmwCapText(['L', 'R'])`);
  info.jHw = await capF({ for: 'homework', cols: 1 });
  ok('J1 EN caption (user-3): "…in the domain |z|<1, in the z-plane", no stray comma', /in the domain \$\|z\|<1\$, in the \$z\$-plane/.test(info.jEn || '') && !stray(info.jEn) && !stray(info.jScreen) && !stray(info.jHw), [info.jEn, info.jHw]);
  await nav(`${U}?ns=${NS}j1&lang=ru`); await settle(1800);
  info.jRu = await capF();
  info.jRuHw = await capF({ for: 'homework', cols: 1 });
  ok('J1 RU caption (user-2): the participial phrase closed before «и» and «в плоскости», no stray comma', /\$z_\{2\}\$, и[~ ]гиперболическая прямая/.test(info.jRu || '') && /\$z_\{0\}\$, в[~ ]плоскости/.test(info.jRu || '') && /\$z_\{1\}\$, гиперболическая/.test(info.jRu || '') && !stray(info.jRu) && !stray(info.jRuHw), [info.jRu, info.jRuHw]);
  await nav(`${U}?ns=${NS}j1`); await settle(1500);
  // J2 the outside of the disc: its domain on the sphere (math-3)
  await load(NS + 'j2', scene([UC, pt('p0', [0.3, 0.2]), pt('p1', [-0.6, 0.5]), Kd('k1', 'p0', 'p1', -1)])); await settle(900);
  info.jOut = await capF();
  ok('J2 the outside: "in the domain {|z|>1} ∪ {∞}" (math-3)', /the hyperbolic line in the domain \$\\\{\|z\|>1\\\}\\cup\\\{\\infty\\\}\$/.test(info.jOut || ''), info.jOut);
  // J3 P on C (an ideal point): not "through" (math-7)
  await load(NS + 'j3', scene([UC, pt('p0', [Math.cos(0.7), Math.sin(0.7)]), pt('p1', [-0.3, 0.2]), Kd('k1', 'p0', 'p1', 1)])); await settle(900);
  info.jOnC = await capF();
  info.jOnCRow = await rowD('k1');
  ok('J3 z₀ on C: the caption names K ("in the domain |z|<1 on the circle through …"), the row too (math-7, user-6)', /the hyperbolic line in the domain \$\|z\|<1\$ on the circle through/.test(info.jOnC || '') && info.jOnCRow === 'hyperbolic line inside Circle 1, on the circle through z₀ and z₁', [info.jOnC, info.jOnCRow]);
  // J4 a vertex dragged outside the disc: the row (user-6), EN and RU
  await load(NS + 'j4', scene([UC, pt('p0', [0.35, 1.15]), pt('p1', [-0.5, -0.3]), pt('p2', [0.55, -0.25]), Kd('k1', 'p0', 'p1', 1), Kd('k2', 'p1', 'p2', 1)])); await settle(900);
  info.jRows = [await rowD('k1'), await rowD('k2')];
  await nav(`${U}?ns=${NS}j4&lang=ru`); await settle(1800);
  info.jRowsRu = [await rowD('k1'), await rowD('k2')];
  ok('J4 z₀ outside: "hyperbolic line inside Circle 1, on the circle through z₀ and z₁"; the side through z₁, z₂ unchanged (user-6)', info.jRows[0] === 'hyperbolic line inside Circle 1, on the circle through z₀ and z₁' && info.jRows[1] === 'hyperbolic line inside Circle 1, through z₁ and z₂' && info.jRowsRu[0] === 'гиперболическая прямая внутри кривой: Окружность 1; на окружности через z₀ и z₁', [info.jRows, info.jRowsRu]);
  await nav(`${U}?ns=${NS}j4`); await settle(1500);
  // J5 the ⋯ item for a disc C drawn as its complement: "Outside Disc 1 only" (math-6)
  await load(NS + 'j5', scene([{ id: 'c', kind: 'disc', c: [0, 0], r: 1, complement: true, visible: true }, pt('p0', [0.3, 0.2]), pt('p1', [-0.6, 0.5]), Object.assign(Kd('k1', 'p0', 'p1', 0), { kind: 'circle', c: [0, 0], r: 1, def: { op: 'perp', args: [{ s: 'c', part: 0 }, { s: 'p0' }, { s: 'p1' }], fill: 'none', nk: 'circle' } })])); await settle(900);
  const mb = await ev(`(() => { const b = document.querySelector('.shape[data-id="k1"] .more'); if (!b) return null; b.scrollIntoView({ block: 'nearest' }); const q = b.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; })()`);
  if (mb) { await click(mb[0], mb[1]); await settle(250); }
  info.jMenu = await menuItems();
  const it = (info.jMenu || []).find((x) => /only$/.test(x));
  if (it) { await menuClick(it); await settle(300); }
  info.jMenuRow = await rowD('k1');
  ok('J5 C a complement disc: the ⋯ item reads "Outside the circle of Disc 1 only", and the row then says outside (math-6)', it === 'Outside the circle of Disc 1 only' && /^hyperbolic line outside the circle of Disc 1, /.test(info.jMenuRow || ''), [info.jMenu, info.jMenuRow]);
  await key('Escape');
  // J6 the chip at 1440: words once C is picked (they fit), and Whole's tooltip (user-4)
  await load(NS + 'j6', scene([UC, pt('p0', [0.3, 0.2])])); await settle(900);
  await tool('perp');
  info.jChip0 = await ev(`(() => { const s = document.querySelector('#draftChipL .cm-seg'); return s && { cls: s.className, txt: [...s.querySelectorAll('.cm-sb')].map((b) => [b.textContent, b.title]) }; })()`);
  const u = await W(Math.cos(2.2), Math.sin(2.2));
  await click(u[0] + 1, u[1]); await settle(250);
  info.jChip1 = await ev(`(() => { const s = document.querySelector('#draftChipL .cm-seg'), el = document.querySelector('#draftChipL'), pl = el && el.parentElement; return s && { cls: s.className, txt: [...s.querySelectorAll('.cm-sb')].map((b) => b.textContent), chip: document.querySelector('#draftChipL .cm-t').textContent, right: el.getBoundingClientRect().right, plot: pl.getBoundingClientRect().right }; })()`);
  await shot('seg-fix-d1440-chip', { x: 0, y: 0, width: 760, height: 160, scale: 1 });
  ok('J6 1440: once C is picked the chip reads "Whole | Inside" in words, inside its plane; Whole\'s tooltip says what it does (user-4)', info.jChip1 && !/cm-icons/.test(info.jChip1.cls) && JSON.stringify(info.jChip1.txt) === '["Whole","Inside","Outside"]' && info.jChip1.right <= info.jChip1.plot && info.jChip0 && info.jChip0.txt[0][1] === 'Whole: the whole circle', [info.jChip0, info.jChip1]);
  await key('Escape'); await tool('select');
  // J7 the phone: the chips' segment buttons take taps 40 px tall (user-5), the 3-point chip too
  await view(390, 844, false, true);
  await load(NS + 'j7', scene([UC, pt('p0', [0.3, 0.2])])); await settle(1200);
  const hits = (sel) => ev(`(() => { return [...document.querySelectorAll(${JSON.stringify(sel)})].map((b) => { const q = b.getBoundingClientRect(), x = q.left + q.width / 2, y = q.top + q.height / 2; const at = (dy) => { const e = document.elementFromPoint(x, y + dy); return !!e && e.closest('.cm-sb') === b; }; return { h: Math.round(q.height), up: at(-18), down: at(18) }; }); })()`);
  const ctr = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e || !e.getClientRects().length) return null; const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
  const tch = async (x, y) => { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }); await sleep(60); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
  const tile = async (t) => { const mo = await ctr('#toolMore > summary'); if (mo) { await tch(mo[0], mo[1]); await settle(500); await ev(`Phone.tab(Phone.tabOf('${t}'))`); await settle(200); } const tp = await ctr(`.ph-tiles .ph-tile[data-tool="${t}"]`); if (tp) { await tch(tp[0], tp[1]); await settle(600); } };
  await tile('perp');
  const cp = await W(Math.cos(2.2), Math.sin(2.2));
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cp[0], y: cp[1], id: 1 }] }); await sleep(60); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await settle(300);
  info.jPhone = { tool: await ev('__cmwCI({shapes:true}).tool'), cls: await ev(`(document.querySelector('#draftChipL .cm-seg') || {}).className`), perp: await hits('#draftChipL .cm-sb') };
  await shot('seg-fix-p390-chip');
  await key('Escape'); await settle(200);
  await tile('circle3');
  info.jPhone.c3 = { tool: await ev('__cmwCI({shapes:true}).tool'), cls: await ev(`(document.querySelector('#draftChipL .cm-seg') || {}).className`), hits: await hits('#draftChipL .cm-sb') };
  ok('J7 phone: the Orthogonal chip\'s buttons take taps 18 px above and below their centre (40 px tall), same look (user-5)', /cm-touch/.test(info.jPhone.cls || '') && info.jPhone.perp.length === 3 && info.jPhone.perp.every((b) => b.up && b.down && b.h <= 24) && /cm-touch/.test(info.jPhone.c3.cls || '') && info.jPhone.c3.hits.every((b) => b.up && b.down), info.jPhone);
  await view(1440, 900, false, false); await settle(300);
  // J8 (review-verify verify-1) a meet of two hyperbolic lines, English drops the closing comma before "and" (it read as a
  // list break), keeps it before "in the z-plane"; Russian keeps it before «и»
  const mt = { id: 'm', kind: 'point', p: [-0.5, -0.3], visible: true, def: { op: 'meet', args: [{ s: 'k1', part: 0 }, { s: 'k2', part: 0 }], index: 0 } };
  await load(NS + 'j8', scene([UC, pt('p0', [0.1, 0.6]), pt('p1', [-0.5, -0.3]), pt('p2', [0.55, -0.25]), Kd('k1', 'p0', 'p1', 1), Kd('k2', 'p1', 'p2', 1), mt])); await settle(900);
  info.jMeet = await capF(); info.jMeetScreen = await ev(`__cmwCapText(['L', 'R'])`);
  await nav(`${U}?ns=${NS}j8&lang=ru`); await settle(1800);
  info.jMeetRu = await capF();
  await nav(`${U}?ns=${NS}j8`); await settle(1500);
  ok('J8 EN: no closing comma before "and" (a meet; one list-final ", and"), still before "in the z-plane"; RU keeps «…, и~…» (verify-1)',
    !!info.jMeet && /in the domain \$\|z\|<1\$ and the hyperbolic line through/.test(info.jMeet) && (info.jMeet.match(/, and /g) || []).length === 1 && ((info.jMeetScreen || '').match(/, and /g) || []).length === 1 && !stray(info.jMeet) && !stray(info.jMeetScreen)
    && /, in the \$z\$-plane/.test(info.jMeet) && /\$z_\{1\}\$, и[~ ]гиперболической прямой/.test(info.jMeetRu || ''), [info.jMeet, info.jMeetScreen, info.jMeetRu]);
  await grab();
});

info.errs = errs.slice(0, 12);
ok('no console errors or exceptions', errs.length === 0, errs.slice(0, 6));
return { pass: fails.length === 0, checks, fails, info };
