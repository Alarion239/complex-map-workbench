// v16.3 the Touching circle (notes/orthogonal-circle/TANGENT-SPEC.md 7, "test/touch_cmd.js"). In the real app, with real
// pointer events (mouse; touch on the phone):
//   A (desktop 1440, light, English): the sixth Construct tile and its tooltip; refusals before the curve; the shown unit
//     circle as C, T on its stroke at 1, P = 2 + i (one undo step, the row, g / S at rest and over 20-frame drags of T once
//     round, of P across C and of P across the tangent at T); P → T gives the same circle; the curve stays picked; the
//     dashed hint drawn with no hover and a click on it (the tangent at T); P = 2, its two rings and a click on the upper
//     one (a tangent and its touching point, exactly tp); Intersect on K and C (one point, exactly T; the hover ring);
//     P inside (no rings); a tangent's P dragged inside (the reason) and out; refusals; Backspace, Esc, the plane menu;
//     ⋯ Region and Use complement (a tangent has none); Delete C with the cascade toast, then Undo.
//   B reload (bitwise), a link in a fresh namespace, the v16.2 test page on the same link (the cached curves).
//   C Russian: the tile fits 52 px, the chips, the rows, the reason, a caption.
//   D dark at 1440; 1024 × 768 and 768 × 1024 (the rail fits); the phone 390 × 844 (Android Chrome, touch): six
//     Construct tiles in More, a tile closes the sheet, the hint and the rings drawn without hover, a tap 8 px off the
//     hint, a tap 18 px off a ring, the chip's ×, the Russian sheet.
//   E the six export captions, EN and RU.
//   F BUDGET60: T and P dragged with 10 touching circles and 10 tangents built on them, 1/z in Y; the draft's hint and
//     rings while hovering with 20 shapes.
//   G Y: a touching circle on a target circle, through z₀″.
//   H screenshots (touch-*.png; copied to notes/orthogonal-circle/shots/touch/).
// A command file for a CDP daemon (test/cdp_kit README):  python3 build.py && test/<you>_cdp/q.sh test/touch_cmd.js
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
const names = async () => { const n = await CI({ names: true }); return (id) => (n.find((x) => x.id === id) || {}).name; };
const NS = 'tc' + (Date.now() % 1000000);
const section = async (k, f) => { if (!run(k)) return; try { await f(); } catch (e) { fails.push({ name: `section ${k} threw`, got: String(e && e.stack || e).slice(0, 700) }); } };
const clickR = async (x, y) => {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'right', buttons: 2, clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'right', buttons: 0, clickCount: 1 });
};
const menuItems = () => ev(`[...document.querySelectorAll('.ctx-menu .mi, .menu .mi, [role="menuitem"]')].filter((b) => b.getClientRects().length).map((b) => b.textContent.trim())`);
const menuClick = (start) => ev(`(() => { const b = [...document.querySelectorAll('.ctx-menu .mi, .menu .mi, [role="menuitem"]')].filter((b) => b.getClientRects().length).find((b) => b.textContent.trim().startsWith(${JSON.stringify(start)})); if (b) b.click(); return !!b; })()`);
const leaveAll = async () => { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 700, y: 880 }); await settle(80); };

// ------------------------------------------------ exact measures (constr_touch_tests.js's: BigInt from the floats)
const F64 = new Float64Array(1), U32 = new Uint32Array(F64.buffer);
function D(x) { if (x === 0) return { m: 0n, e: 0 }; F64[0] = x; const lo = U32[0], hi = U32[1], ex = (hi >>> 20) & 0x7ff; let m = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo), e; if (ex === 0) e = -1074; else { m |= 1n << 52n; e = ex - 1075; } return { m: hi >>> 31 ? -m : m, e }; }
const dmul = (a, b) => ({ m: a.m * b.m, e: a.e + b.e });
function dadd(a, b) { if (a.m === 0n) return b; if (b.m === 0n) return a; if (a.e < b.e) [a, b] = [b, a]; return { m: (a.m << BigInt(a.e - b.e)) + b.m, e: b.e }; }
const dsub = (a, b) => dadd(a, { m: -b.m, e: b.e });
function dnum(a) { if (a.m === 0n) return 0; const neg = a.m < 0n, M = neg ? -a.m : a.m, sh = Math.max(0, M.toString(2).length - 60); return (neg ? -1 : 1) * Number(M >> BigInt(sh)) * 2 ** (a.e + sh); }
function dForm(G, o2) {
  const A = D(G.A), Bx = D(G.B[0]), By = D(G.B[1]), C = D(G.C);
  const dx = dsub(D(o2[0]), D(G.o[0])), dy = dsub(D(o2[1]), D(G.o[1]));
  return { A, Bx: dadd(Bx, dmul(A, dx)), By: dadd(By, dmul(A, dy)), C: dadd(dadd(dmul(A, dadd(dmul(dx, dx), dmul(dy, dy))), dmul(D(2), dadd(dmul(Bx, dx), dmul(By, dy)))), C) };
}
// the overlap depth g / S: |1 - |cos|| / |A_K - sgn(cos) A_C| / S, exactly from the floats
function gapS(Kf, G, S) {
  const o = G.o, a = dForm(Kf, o), b = dForm(G, o);
  const ip = dsub(dadd(dmul(a.Bx, b.Bx), dmul(a.By, b.By)), dmul(D(0.5), dadd(dmul(a.A, b.C), dmul(b.A, a.C))));
  const n1 = dsub(dadd(dmul(a.Bx, a.Bx), dmul(a.By, a.By)), dmul(a.A, a.C)), n2 = dsub(dadd(dmul(b.Bx, b.Bx), dmul(b.By, b.By)), dmul(b.A, b.C));
  const num = dsub(dmul(n1, n2), dmul(ip, ip)), N = dnum(n1) * dnum(n2), c = dnum(ip) / Math.sqrt(N);
  const delta = dnum(num) / N / (1 + Math.abs(c)), kap = Math.abs(Kf.A - Math.sign(c) * G.A);
  return kap > 0 ? Math.abs(delta) / kap / S : 0;
}
function distTo(G, z) { const a = dForm(G, z), g = Math.hypot(dnum(a.Bx), dnum(a.By)); return Math.abs(dnum(a.C)) / (2 * g); }
const Cscale = (G) => (G.A ? Math.hypot(G.o[0] - G.B[0] / G.A, G.o[1] - G.B[1] / G.A) + Math.abs(Math.sqrt(Math.max(0, G.B[0] ** 2 + G.B[1] ** 2 - G.A * G.C)) / G.A) : 0);
const Sof = (T, P, G) => Math.max(Math.hypot(...T), P ? Math.hypot(...P) : 0, P ? Math.hypot(P[0] - T[0], P[1] - T[1]) : 0, Cscale(G));
// K's tangency to its curve (C's piece form as the core read it, K's tch.G) and incidence of T and P: {g, inc}
function touchErr(K, T, P) {
  if (!K || !K.tch) return { g: Infinity, inc: Infinity };
  const S = Sof(T, P, K.tch.G);
  return { g: gapS(K, K.tch.G, S), inc: Math.max(distTo(K, T), P ? distTo(K, P) : 0) / S };
}
const f1 = (x) => (x === 0 ? '0' : Number(x).toExponential(1));
const unitForm = { A: 1, B: [0, 0], C: -1, o: [0, 0] };
const sameForm = (a, b) => !!a && !!b && a.A === b.A && a.C === b.C && a.B[0] === b.B[0] && a.B[1] === b.B[1] && a.o[0] === b.o[0] && a.o[1] === b.o[1];
// a 20-frame mouse drag (select tool) along pts (screen), after a press at p0; each frame calls f()
async function dragPath(p0, pts, f) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p0[0], y: p0[1] });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p0[0], y: p0[1], button: 'left', buttons: 1, clickCount: 1 });
  for (const [x, y] of pts) {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1 });
    await ev('new Promise((r) => requestAnimationFrame(r))');
    await f();
  }
  const e = pts[pts.length - 1];
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: e[0], y: e[1], button: 'left', buttons: 0, clickCount: 1 });
  await settle(250);
}

const SA = {
  shapes: [{ id: 'fh', kind: 'curve', pts: [[-1.6, -2.6], [-1.0, -2.5], [-0.4, -2.65], [0.2, -2.55], [0.8, -2.6]], ci: 3, visible: true }],
  steps: [{ type: 'recip', params: {}, on: true }],
  srcView: { cx: 0.5, cy: 0, s: 75 }, unit: true, snap: true, nextId: 50, pattern: 'checker',
};

await section('A', async () => {
  await view(1440, 900, false, false);
  await load(NS, SA);
  await settle(900);
  await grab();
  // 1. the sixth tile, its tooltip, its label (52 px)
  const tiles = await ev(`[...document.querySelectorAll('#constructTools .tool')].map((b) => b.dataset.tool).join()`);
  ok('A1 the Construct grid has six tiles, Touching circle last', tiles === 'circle3,meet,midpoint,bisector,perp,touch', tiles);
  info.tile = await ev(`(() => { const b = document.querySelector('#constructTools .tool[data-tool="touch"]'), s = b.querySelector('span'); const lh = parseFloat(getComputedStyle(s).lineHeight); return { tip: b.dataset.tip, desc: b.dataset.desc, label: s.textContent, w: s.clientWidth, sw: s.scrollWidth, h: s.getBoundingClientRect().height, lh, btn: b.getBoundingClientRect().width, bottom: s.getBoundingClientRect().bottom - b.getBoundingClientRect().bottom }; })()`);
  ok('A1 tooltip: Touching circle + its description', info.tile.tip === 'Touching circle' && /^Pick a line or a circle, then the point where the new circle touches it/.test(info.tile.desc), info.tile);
  ok('A1 the tile label «Touching» fits the tile', info.tile.label === 'Touching' && info.tile.sw <= info.tile.w + 1 && info.tile.h <= info.tile.lh + 1 && info.tile.bottom <= 0, info.tile);
  await tool('touch');
  ok('A1 the chip before the curve', (await chipT()) === 'Pick a line or a circle · Touching · Esc cancels', await chipT());
  // refusals before the curve: empty space and a freehand curve
  const nA = (await ST()).list.length;
  const em = await W(-1.2, -1.4);
  await click(em[0], em[1]); await settle(150);
  const t1s = await toastText();
  const fz = await W(-0.4, -2.65);
  await click(fz[0], fz[1] + 1); await settle(150);
  const t2s = await toastText();
  let d = (await CI()).draft;
  ok('A10 a non-curve first: empty space and a freehand curve give the toast; nothing made', t1s === 'Click a line or a circle.' && t2s === 'Click a line or a circle.' && d && d.tool === 'touch' && d.curve1 === null && !d.picks.length && (await ST()).list.length === nA, [t1s, t2s, d]);
  // 2. the shown unit circle, then T on its stroke at 1, then 2 + i
  let st = await ST();
  const n0 = st.list.length, hi0 = st.hi;
  const u = await W(Math.cos(2.2), Math.sin(2.2));
  await move(u[0] + 2, u[1] - 2); await settle(120);
  ok('A2 hover: the ring on the unit circle', ((await CI()).ring || {}).chip === 'on the unit circle', (await CI()).ring);
  await click(u[0] + 2, u[1] - 2); await settle(150);
  ok('A2 the unit circle is picked (no shape yet); the chip', (await ST()).list.length === n0 && (await chipT()) === 'Point 1 of 2 · Touching · Esc cancels', await chipT());
  const t0 = await W(1, 0);
  // (on the real axis, 3 px outside: the projection onto the circle is 1 exactly)
  await move(t0[0] + 3, t0[1]); await settle(120);
  info.ringT = (await CI()).ring;
  await click(t0[0] + 3, t0[1]); await settle(150);
  d = (await CI()).draft;
  ok('A3 a click on the stroke at 1: T (on the unit circle), the chip offers the tangent', d && d.picks.length === 1 && d.picks[0].role === 'T' && d.picks[0].z[0] === 1 && d.picks[0].z[1] === 0 && (await chipT()) === 'Point 2 of 2, or the tangent · Touching · Esc cancels', [d, await chipT()]);
  ok('A6 after T: the hint is the tangent at 1 (x = 1)', d && d.hint && d.hint.A === 0 && d.hint.B[1] === 0 && d.hint.o[0] === 1 && d.hint.o[1] === 0, d && d.hint);
  await leaveAll();
  await shot('touch-d1440-light-hint');
  const p0 = await W(2, 1);
  await move(p0[0], p0[1]); await settle(150);
  await shot('touch-d1440-light-preview');
  await click(p0[0], p0[1]); await settle(400);
  st = await ST();
  const K1 = last(st), C1 = byId(st, K1.def.args[0].s), T1 = byId(st, K1.def.args[1].s), P1 = byId(st, K1.def.args[2].s);
  info.K1 = { id: K1.id, kind: K1.kind, def: K1.def, ci: K1.ci, C: C1, T: T1, P: P1 && P1.p };
  ok('A3 made in one undo step: Circle 1 (the unit circle), the glider z₀ at 1, the free z₁ = 2 + i, K', st.list.length === n0 + 4 && st.hi === hi0 + 1 && C1 && C1.kind === 'circle' && C1.r === 1 && T1.def && T1.def.op === 'glider' && T1.p[0] === 1 && T1.p[1] === 0 && P1.p[0] === 2 && P1.p[1] === 1 && K1.def.op === 'touch' && K1.ci !== C1.ci, info.K1);
  let nm = await names();
  info.rowK1 = await rowD(K1.id);
  ok('A3 the row: through z₁, touching Circle 1 at z₀', info.rowK1 === 'through z₁, touching Circle 1 at z₀' && nm(C1.id) === 'Circle 1', info.rowK1);
  let forms = await FORMS();
  let e = touchErr(forms[K1.id], T1.p, P1.p);
  info.restK1 = { g: f1(e.g), inc: f1(e.inc), tchIsC: sameForm(forms[K1.id].tch.G, unitForm) };
  ok('A3 at rest: g / S ≤ 1e-12, T and P on K (≤ 1e-15 S); C\'s form is the unit circle\'s', e.g <= 1e-12 && e.inc <= 1e-15 && info.restK1.tchIsC, info.restK1);
  await shot('touch-d1440-light-made');
  // 3. the drags: T once round, P across C, P across the tangent at T (20 frames each; undone after each)
  await tool('select');
  const sc = (await W(1, 0))[0] - (await W(0, 0))[0], c0 = await W(0, 0);
  const measure = (o) => async () => {
    const s2 = await ST(), k = byId(s2, K1.id), fm = (await FORMS())[K1.id];
    if (k.cundef || !fm) { o.und++; return; }
    if (k.def.flip !== o.flip0) o.flips++;
    const r = touchErr(fm, byId(s2, T1.id).p, byId(s2, P1.id).p);
    o.g = Math.max(o.g, r.g); o.inc = Math.max(o.inc, r.inc);
    if (k.kind === 'line') o.line = true;
    o.n++;
  };
  const fresh = async () => ({ und: 0, flips: 0, g: 0, inc: 0, n: 0, line: false, flip0: byId(await ST(), K1.id).def.flip });
  const oT = await fresh();
  await dragPath(t0, Array.from({ length: 20 }, (_, i) => { const a = 2 * Math.PI * (i + 1) / 20 - 0.0001; return [c0[0] + sc * Math.cos(a), c0[1] - sc * Math.sin(a)]; }), measure(oT));
  const tAfter = byId(await ST(), T1.id);
  await key('z', 4); await settle(250);
  const oP = await fresh(), pIn = await W(0.2, 0.3);
  await dragPath(p0, Array.from({ length: 20 }, (_, i) => [p0[0] + (pIn[0] - p0[0]) * (i + 1) / 20, p0[1] + (pIn[1] - p0[1]) * (i + 1) / 20]), measure(oP));
  const pAfter = byId(await ST(), P1.id).p;
  await key('z', 4); await settle(250);
  const oL = await fresh(), pL = await W(0.4, 1.2);
  await dragPath(p0, Array.from({ length: 20 }, (_, i) => [p0[0] + (pL[0] - p0[0]) * (i + 1) / 20, p0[1] + (pL[1] - p0[1]) * (i + 1) / 20]), measure(oL));
  const pAfterL = byId(await ST(), P1.id).p;
  await key('z', 4); await settle(250);
  const fmt = (o) => ({ und: o.und, flips: o.flips, g: f1(o.g), inc: f1(o.inc), n: o.n, line: o.line });
  info.drags = { T: fmt(oT), tAfter: tAfter.p, P: fmt(oP), pAfter, L: fmt(oL), pAfterL };
  ok('A4 T dragged once round (20 frames): defined, g / S ≤ 1e-12, T and P on K', oT.und === 0 && oT.n === 20 && oT.g <= 1e-12 && oT.inc <= 1e-15, info.drags);
  ok('A4 P dragged across C (20 frames): defined, no flip, g / S ≤ 1e-12', oP.und === 0 && oP.flips === 0 && oP.n === 20 && oP.g <= 1e-12 && oP.inc <= 1e-15 && Math.hypot(...pAfter) < 1, info.drags);
  ok('A4 P dragged across the tangent at T (20 frames): defined, no flip, g / S ≤ 1e-12', oL.und === 0 && oL.flips === 0 && oL.n === 20 && oL.g <= 1e-12 && oL.inc <= 1e-15 && pAfterL[0] < 1, info.drags);
  st = await ST();
  ok('A4 undo restores T and P', byId(st, T1.id).p[0] === 1 && byId(st, P1.id).p[0] === 2 && byId(st, P1.id).p[1] === 1, [byId(st, T1.id).p, byId(st, P1.id).p]);
  // 4. P → T gives the same circle (the curve stays picked: Circle 1)
  await tool('touch');
  const cb = await W(Math.cos(2.2), Math.sin(2.2));
  await click(cb[0] + 2, cb[1] - 2); await settle(120);
  await click(p0[0], p0[1]); await settle(120);
  d = (await CI()).draft;
  // (v16.3.1: a chip that would wrap keeps one line without "Esc cancels"; the rings' chip in X at 1440 does)
  const a5 = await ev(`(() => { const t = document.querySelector('#draftChipL .cm-t'); if (!t) return null; const r = document.createRange(); r.selectNodeContents(t); return { text: t.textContent, lines: new Set([...r.getClientRects()].map((q) => Math.round(q.top))).size }; })()`);
  const a5base = ((d && d.rings && d.rings.length) ? 'Touching point on Circle 1, or a ring for a tangent' : 'Touching point on Circle 1') + ' · Touching';
  ok('A5 P first: z₁ is P (off C); the chip asks for the touching point', d && d.picks.length === 1 && d.picks[0].role === 'P' && !!a5 && (a5.text === a5base + ' · Esc cancels' || (a5.text === a5base && a5.lines === 1)), [d, a5]);
  await click(t0[0] + 2, t0[1] + 2); await settle(400);
  st = await ST();
  const K2 = last(st);
  forms = await FORMS();
  ok('A5 then z₀ (on C by construction) is T: the same circle, bitwise', K2.id !== K1.id && K2.def.op === 'touch' && K2.def.args[1].s === T1.id && K2.def.args[2].s === P1.id && sameForm(forms[K2.id], forms[K1.id]), [K2.def, forms[K2.id], forms[K1.id]]);
  d = (await CI()).draft;
  ok('A5 the curve stays picked', d && d.curve1 && d.curve1.s === C1.id && d.picks.length === 0, d);
  await key('z', 4); await settle(250);
  // 5. after T: a click on the dashed tangent (P = ∞): the tangent at T
  await click(t0[0] + 2, t0[1] + 2); await settle(100);
  const hz = await W(1, -1.3);
  await move(hz[0] + 3, hz[1]); await settle(120);
  info.hintRing = (await CI()).ring;
  ok('A6 hover on the hint: "on the tangent at z₀"', info.hintRing && info.hintRing.cls === 'hint' && info.hintRing.chip === 'on the tangent at z₀' && info.hintRing.z[0] === 1, info.hintRing);
  await shot('touch-d1440-light-hint-snap');
  await click(hz[0] + 3, hz[1]); await settle(400);
  st = await ST();
  const KT = last(st);
  nm = await names();
  info.rowKT = await rowD(KT.id);
  forms = await FORMS();
  e = touchErr(forms[KT.id], T1.p, null);
  ok('A6 the tangent at T: args[2] = {inf: 1}, a line x = 1, its row', KT.def.op === 'touch' && KT.def.args[2].inf === 1 && KT.kind === 'line' && info.rowKT === `the tangent to Circle 1 at z₀` && e.g <= 1e-12 && distTo(forms[KT.id], [1, 7]) < 1e-15, [KT.def, info.rowKT, f1(e.g)]);
  // 6. P = 2: two rings; a click on the upper one: a tangent and its touching point
  const p2 = await W(2, 0);
  await click(p2[0], p2[1]); await settle(150);
  d = (await CI()).draft;
  info.rings = d && d.rings;
  ok('A7 P = 2: two rings', d && d.picks[0].role === 'P' && d.rings && d.rings.length === 2, d);
  await leaveAll();
  await shot('touch-d1440-light-rings');
  const up = d.rings.find((r) => r.tp[1] > 0), uz = await W(up.tp[0], up.tp[1]);
  await move(uz[0] + 4, uz[1] - 3); await settle(120);
  info.ringRing = (await CI()).ring;
  ok('A7 hover on the upper ring: "on a tangent from z₂", at the touching point', info.ringRing && info.ringRing.cls === 'ring' && /^on a tangent from z₂$/.test(info.ringRing.chip) && info.ringRing.z[0] === up.tp[0] && info.ringRing.z[1] === up.tp[1], info.ringRing);
  await shot('touch-d1440-light-ring-snap');
  const nB = (await ST()).list.length, hiB = (await ST()).hi;
  await click(uz[0] + 4, uz[1] - 3); await settle(400);
  st = await ST();
  const L2 = st.list[st.list.length - 2], M2 = last(st), P2 = byId(st, L2.def.args[1].s);
  forms = await FORMS();
  nm = await names();
  info.tangent = { L2: L2.def, M2: M2.def, p: M2.p, tp: up.tp, row: await rowD(M2.id), rowL: await rowD(L2.id) };
  ok('A7 the ring: a free z₂ = 2, a tangent (index ' + up.k + ') and its touching point, one undo step', st.list.length === nB + 3 && st.hi === hiB + 1 && L2.def.op === 'tangent' && L2.def.index === up.k && P2.p[0] === 2 && M2.def.op === 'meet' && M2.def.args[0].s === L2.id, info.tangent);
  ok('A7 the touching point equals tp exactly', M2.p[0] === up.tp[0] && M2.p[1] === up.tp[1] && !M2.cundef, info.tangent);
  ok('A7 its row: "Line 2 ∩ Circle 1, where they touch"; the tangent\'s row', info.tangent.row === 'Line 2 ∩ Circle 1, where they touch' && info.tangent.rowL === `tangent to Circle 1 at ${nm(M2.id)}, through z₂`, info.tangent);
  e = touchErr(forms[L2.id], M2.p, P2.p);
  ok('A7 the tangent: g / S ≤ 1e-12, P and tp on it', e.g <= 1e-12 && e.inc <= 1e-15, { g: f1(e.g), inc: f1(e.inc) });
  await clickSel(`.shape[data-id="${M2.id}"] .icon-btn.more`); await settle(250);
  info.meetMenu = await menuItems();
  ok('A7 the touching point\'s ⋯ has no Other point', !info.meetMenu.includes('Other point') && info.meetMenu.includes('Make free'), info.meetMenu);
  await key('Escape'); await settle(150);
  // 7. Intersect on K and C: one point, exactly T; the hover ring at T: one crossing
  await tool('meet');
  await move(t0[0] + 1, t0[1] + 1); await settle(150);
  info.meetRing = (await CI()).ring;
  ok('A8 Intersect, hover at T: the crossing ring sits exactly at T', info.meetRing && info.meetRing.cls === 'cross' && info.meetRing.z[0] === T1.p[0] && info.meetRing.z[1] === T1.p[1], info.meetRing);
  const kS = await W(2 + Math.cos(2.4), Math.sin(2.4)), cS = await W(Math.cos(-2.2), Math.sin(-2.2));
  const nI = (await ST()).list.length;
  await click(kS[0] + 1, kS[1]); await settle(100); await click(cS[0] + 1, cS[1]); await settle(350);
  st = await ST();
  const MI = last(st);
  info.meet = { n: st.list.length - nI, def: MI.def, p: MI.p, row: await rowD(MI.id) };
  ok('A8 Intersect on K and C: one point, exactly T; "Circle 2 ∩ Circle 1, where they touch"', st.list.length === nI + 1 && MI.def.op === 'meet' && MI.p[0] === T1.p[0] && MI.p[1] === T1.p[1] && info.meet.row === 'Circle 2 ∩ Circle 1, where they touch', info.meet);
  await key('z', 4); await settle(200);
  // 8. P inside C: no rings; the tangent's P dragged inside (the reason) and out
  await tool('touch');
  await click(cb[0] + 2, cb[1] - 2); await settle(100);
  const pi = await W(0.3, -0.4);
  await click(pi[0], pi[1]); await settle(150);
  d = (await CI()).draft;
  ok('A9 P inside C: no rings', d && d.picks.length === 1 && d.picks[0].role === 'P' && Array.isArray(d.rings) && d.rings.length === 0, d);
  await key('Escape'); await settle(100);
  await tool('select');
  const pz = await W(2, 0), pin = await W(0.5, 0);
  await drag(pz[0], pz[1], pin[0], pin[1], 10, 16); await settle(300);
  st = await ST();
  info.inside = { und: byId(st, L2.id).cundef, row: await rowD(L2.id), p: byId(st, P2.id).p };
  ok('A9 a tangent\'s P dragged inside: undefined, the reason', info.inside.und && info.inside.und.code === 'inside' && info.inside.row === 'The point is inside the circle, so no line through it touches the circle', info.inside);
  await shot('touch-d1440-light-inside');
  await drag(pin[0], pin[1], pz[0], pz[1], 10, 16); await settle(300);
  st = await ST();
  forms = await FORMS();
  ok('A9 dragged out: the line comes back, touching at the meet point', !byId(st, L2.id).cundef && !byId(st, M2.id).cundef && byId(st, M2.id).p[0] === forms[L2.id].tch.tp[0], [byId(st, L2.id).cundef, byId(st, M2.id).p]);
  // 9. refusals: after T a point on C; after P a point off C; the same point twice
  await tool('touch');
  await click(cb[0] + 2, cb[1] - 2); await settle(100);
  await click(t0[0] + 2, t0[1] + 2); await settle(100);
  const mz = await W(M2.p[0], M2.p[1]);
  await click(mz[0] + 1, mz[1] + 1); await settle(150);
  const r1 = await toastText();
  await click(t0[0] + 2, t0[1] + 2); await settle(150);
  const r2 = await toastText();
  d = (await CI()).draft;
  ok('A10 after T: a point on C is refused; the same point twice is refused; the draft stays', r1 === 'Click a point off Circle 1.' && r2 === 'Touching circle needs distinct points' && d && d.picks.length === 1, [r1, r2, d]);
  await key('Backspace'); await settle(100);
  await click(p0[0], p0[1]); await settle(100);
  const ez = await W(-1.5, 1.6);
  await click(ez[0], ez[1]); await settle(150);
  const r3 = await toastText();
  d = (await CI()).draft;
  ok('A10 after P: a click off C is refused', r3 === 'Click a point on Circle 1.' && d && d.picks.length === 1 && d.picks[0].role === 'P', [r3, d]);
  // 10. Backspace drops the point, then the curve; Esc; the plane menu
  await key('Backspace'); await settle(100);
  d = (await CI()).draft;
  const bs1 = d && d.picks.length === 0 && d.curve1 && d.curve1.s === C1.id;
  await key('Backspace'); await settle(100);
  d = (await CI()).draft;
  ok('A11 Backspace drops the point, then the curve', bs1 && (!d || !d.curve1) && (await chipT()).startsWith('Pick a line or a circle'), [bs1, d]);
  await click(cb[0] + 2, cb[1] - 2); await settle(100);
  await key('Escape'); await settle(100);
  ok('A11 Esc cancels the draft, curve included', !(await CI()).draft || !(await CI()).draft.curve1, (await CI()).draft);
  await tool('select');
  const cm = await W(Math.cos(-1.9), Math.sin(-1.9));
  await clickR(cm[0] + 1, cm[1]); await settle(250);
  info.planeMenu = await menuItems();
  ok('A11 the plane menu on a circle: no "Touching circle…" or "Perpendicular circle…" (issue #13: the toolbar\'s)', info.planeMenu.length > 0 && !info.planeMenu.some((t) => /^(Touching|Perpendicular) circle…/.test(t)), info.planeMenu);
  await key('Escape'); await settle(100);
  // 11. ⋯ Region on K1, Use complement; the tangent's ⋯ has no Region
  await tool('select');
  await clickSel(`.shape[data-id="${K1.id}"] .icon-btn.more`); await settle(250);
  info.rowMenuK = await menuItems();
  await menuClick('Region'); await settle(300);
  st = await ST();
  info.region = { kind: byId(st, K1.id).kind, fill: byId(st, K1.id).def.fill, comp: byId(st, K1.id).complement, row: await rowD(K1.id) };
  ok('A12 ⋯ Region: the disc; its row', info.region.kind === 'disc' && info.region.fill === 'in' && !info.region.comp && info.region.row === 'the disc through z₁, touching Circle 1 at z₀', [info.rowMenuK, info.region]);
  await clickSel(`.shape[data-id="${K1.id}"] .icon-btn.more`); await settle(250);
  await menuClick('Use complement'); await settle(300);
  st = await ST();
  ok('A12 Use complement: the outside', byId(st, K1.id).complement === true && (await rowD(K1.id)) === 'outside the circle through z₁, touching Circle 1 at z₀', [byId(st, K1.id), await rowD(K1.id)]);
  await shot('touch-d1440-light-region');
  await clickSel(`.shape[data-id="${L2.id}"] .icon-btn.more`); await settle(250);
  info.rowMenuL = await menuItems();
  ok('A12 a tangent line\'s ⋯ has no Region and no Use complement', !info.rowMenuL.includes('Region') && !info.rowMenuL.includes('Use complement') && info.rowMenuL.includes('Make free'), info.rowMenuL);
  await key('Escape'); await settle(150);
  // the Inspector of a point on K1: t from T
  // 12. Delete C: the cascade toast, then Undo
  const nDel = (await ST()).list.length;
  let plan = await ev(`Constr.deletePlan(__cmwP().figure ? JSON.parse(JSON.stringify(__cmwCI({shapes:true}))) : null, ['${C1.id}'])`).catch(() => null);
  await clickSel(`.shape[data-id="${C1.id}"] .shape-row`); await settle(200);
  await key('Delete'); await settle(300);
  info.delToast = await toastText();
  st = await ST();
  ok('A13 Delete C: the cascade toast; C, T, K, the tangents and the touching points go', /^Deleted Circle 1 and \d+ shapes built on it\.$/.test(info.delToast) && !byId(st, C1.id) && !byId(st, K1.id) && !byId(st, T1.id) && !byId(st, L2.id) && !byId(st, M2.id) && !!byId(st, P1.id), [info.delToast, st.list.map((s) => s.id)]);
  await clickSel('#toastHost .toast-act'); await settle(300);
  st = await ST();
  ok('A13 Undo brings them back', st.list.length === nDel && !!byId(st, K1.id) && !byId(st, K1.id).cundef && !!byId(st, M2.id), st.list.length);
  await grab();
});

// a state with every op (B, E): C the unit circle, T = 1 (a glider), P = 2 + i; K the touching circle; Kl the line
// case (P on the tangent at T); Kd the disc; Ko the outside; Kt the tangent at T; Ka the tangent from P and its point
const SB = {
  shapes: [
    { id: 'bc', kind: 'circle', c: [0, 0], r: 1, ci: 0, visible: true },
    { id: 'bt', kind: 'point', p: [1, 0], t: 0, ci: 1, visible: true, def: { op: 'glider', args: [{ s: 'bc', part: 0 }] } },
    { id: 'bp', kind: 'point', p: [2, 1], ci: 1, visible: true },
    { id: 'bq', kind: 'point', p: [1, 2], ci: 1, visible: true },
    { id: 'bk', kind: 'circle', c: [0, 0], r: 1, ci: 2, visible: true, def: { op: 'touch', args: [{ s: 'bc', part: 0 }, { s: 'bt' }, { s: 'bp' }], fill: 'none' } },
    { id: 'bl', kind: 'line', a: [0, 0], b: [1, 0], ci: 3, visible: true, def: { op: 'touch', args: [{ s: 'bc', part: 0 }, { s: 'bt' }, { s: 'bq' }], fill: 'none' } },
    { id: 'bd', kind: 'disc', c: [0, 0], r: 1, ci: 4, visible: true, def: { op: 'touch', args: [{ s: 'bc', part: 0 }, { s: 'bt' }, { s: 'bp' }], fill: 'in', flip: true } },
    { id: 'bo', kind: 'disc', c: [0, 0], r: 1, ci: 5, visible: true, def: { op: 'touch', args: [{ s: 'bc', part: 0 }, { s: 'bt' }, { s: 'bp' }], fill: 'in', flip: false } },
    { id: 'bn', kind: 'line', a: [0, 0], b: [1, 0], ci: 6, visible: true, def: { op: 'touch', args: [{ s: 'bc', part: 0 }, { s: 'bt' }, { inf: 1 }] } },
    { id: 'ba', kind: 'line', a: [0, 0], b: [1, 0], ci: 7, visible: true, def: { op: 'tangent', args: [{ s: 'bc', part: 0 }, { s: 'bp' }], index: 1, fill: 'none' } },
    { id: 'bm', kind: 'point', p: [0, 0], ci: 1, visible: true, def: { op: 'meet', args: [{ s: 'ba', part: 0 }, { s: 'bc', part: 0 }], index: 0 } },
  ],
  steps: [{ type: 'recip', params: {}, on: true }], srcView: { cx: 0.5, cy: 0.3, s: 75 }, snap: true, nextId: 60,
};

await section('B', async () => {
  await view(1440, 900, false, false);
  await load(NS + 'b', SB); await settle(900);
  const snap = (st) => st.list.map((s) => JSON.stringify([s.id, s.kind, s.def, s.c, s.r, s.a, s.b, s.p, s.complement, s.cundef || null]));
  let st = await ST();
  const before = snap(st), fb = JSON.stringify(await FORMS());
  info.Bkinds = st.list.map((s) => s.id + ':' + s.kind + (s.complement ? '/out' : '') + (s.cundef ? '/undef' : ''));
  ok('B the state: a circle, a line, a disc, the outside, two lines and a touching point, all defined', info.Bkinds.join() === 'bc:circle,bt:point,bp:point,bq:point,bk:circle,bl:line,bd:disc,bo:disc/out,bn:line,ba:line,bm:point', info.Bkinds);
  await nav(`${U}?ns=${NS}b`); await settle(1500);
  st = await ST();
  ok('B reload: every shape and every form come back bitwise', before.join('\n') === snap(st).join('\n') && fb === JSON.stringify(await FORMS()), { before, after: snap(st) });
  const payload = await ev(`await Params.encodeLink(__cmwP().figure)`);
  info.linkLen = payload && payload.length;
  await nav(`${U}?ns=${NS}lk#cmw=${payload}`); await settle(1800);
  st = await ST();
  ok('B a link opens it in a fresh namespace', before.join('\n') === snap(st).join('\n'), snap(st));
  const has162 = fs.existsSync(path.join(DIR, '..', '..', 'dist', 'v162-test.html'));
  if (has162) {
    await nav(`http://localhost:${PORT}/v162-test.html?ns=${NS}old#cmw=${payload}`); await settle(2200);
    const old = await ev(`__cmwCI({shapes:true}).list.filter((s) => ['bk', 'bl', 'bd', 'bo', 'bn', 'ba', 'bm'].includes(s.id)).map((s) => ({ id: s.id, kind: s.kind, def: s.def || null, c: s.c, r: s.r, a: s.a, b: s.b, p: s.p }))`);
    const ev162 = await ev(`({ freed: __cmwC().freed, events: __cmwC().events })`);
    info.v162 = { old, ev162, toasts: await toasts() };
    const want = byId(st, 'bk');
    ok('B the v16.2 page opens the link: the touching circles and tangents as cached curves (no definition), the touching point kept', old.length === 7 && old.filter((s) => s.id !== 'bm').every((s) => !s.def) && Math.abs(old.find((s) => s.id === 'bk').r - want.r) < 1e-12 && old.find((s) => s.id === 'bm').def && old.find((s) => s.id === 'bm').def.op === 'meet', info.v162);
  } else ok('B the v16.2 page is served (dist/v162-test.html)', false, 'missing');
  await grab();
});

await section('C', async () => {
  // Russian: the tile, the chips, the rows, the reason, a caption
  await view(1440, 900, false, false);
  await load(NS + 'ru', SA);
  await nav(`${U}?ns=${NS}ru&lang=ru`); await settle(1800);
  info.ruTile = await ev(`(() => { const b = document.querySelector('#constructTools .tool[data-tool="touch"]'), s = b.querySelector('span'); const lh = parseFloat(getComputedStyle(s).lineHeight); return { label: s.textContent, w: s.clientWidth, sw: s.scrollWidth, h: s.getBoundingClientRect().height, lh, tip: b.dataset.tip, bw: b.getBoundingClientRect().width, bottom: s.getBoundingClientRect().bottom - b.getBoundingClientRect().bottom }; })()`);
  ok('C RU tile «Касание» fits the 52 px tile', info.ruTile.label === 'Касание' && info.ruTile.sw <= info.ruTile.w + 1 && info.ruTile.h <= 2 * info.ruTile.lh + 1 && info.ruTile.bottom <= 0 && info.ruTile.tip === 'Касающаяся окружность' && info.ruTile.bw <= 56, info.ruTile);
  await tool('touch');
  const esc = (await chipT()).split(' · ').pop();
  info.ruChips = [await chipT()];
  const u = await W(Math.cos(2.2), Math.sin(2.2));
  await click(u[0] + 2, u[1] - 2); await settle(100);
  info.ruChips.push(await chipT());
  const t0 = await W(1, 0), p0 = await W(2, 1);
  await click(t0[0] + 3, t0[1]); await settle(100);
  info.ruChips.push(await chipT());
  const hz = await W(1, -1.3);
  await move(hz[0] + 3, hz[1]); await settle(120);
  info.ruHint = ((await CI()).ring || {}).chip;
  await move(p0[0], p0[1]); await settle(120);
  await shot('touch-d1440-ru-preview');
  await click(p0[0], p0[1]); await settle(400);
  let st = await ST();
  const K = last(st);
  info.ruRow = await rowD(K.id);
  // P first: the chip after P, the ring chip
  const p2 = await W(2, 0);
  await click(p2[0], p2[1]); await settle(120);
  info.ruChips.push(await chipT());
  const d = (await CI()).draft, up = d.rings.find((r) => r.tp[1] > 0), uz = await W(up.tp[0], up.tp[1]);
  await move(uz[0] + 4, uz[1] - 3); await settle(120);
  info.ruRing = ((await CI()).ring || {}).chip;
  await click(uz[0] + 4, uz[1] - 3); await settle(400);
  st = await ST();
  const M = last(st), L = st.list[st.list.length - 2];
  info.ruRows = { K: info.ruRow, L: await rowD(L.id), M: await rowD(M.id) };
  const N = ' ';
  ok('C RU chips', info.ruChips[0] === `Выберите прямую или окружность · Касание · ${esc}` && info.ruChips[1] === `Точка 1 из 2 · Касание · ${esc}` && info.ruChips[2] === `Точка 2 из 2 или касательная · Касание · ${esc}` && info.ruChips[3] === `Точка касания на кривой: Окружность 1 или кольцо${N}— касательная · Касание · ${esc}`, info.ruChips);
  ok('C RU ring chips: привязка: касательная в точке z₀ / касательная из z₂', info.ruHint === 'привязка: касательная в точке z₀' && info.ruRing === 'привязка: касательная из z₂', [info.ruHint, info.ruRing]);
  ok('C RU rows', info.ruRows.K === `через z₁, касается кривой: Окружность 1; точка касания${N}— z₀` && /^касательная к кривой: Окружность 1 в точке z., через z₂$/.test(info.ruRows.L) && info.ruRows.M === 'Прямая 1 ∩ Окружность 1, точка касания', info.ruRows);
  await shot('touch-d1440-ru-made');
  // the reason: the tangent's P dragged inside
  await tool('select');
  const pin = await W(0.5, 0);
  await drag(p2[0], p2[1], pin[0], pin[1], 10, 16); await settle(300);
  info.ruReason = await rowD(L.id);
  ok('C RU reason (inside)', info.ruReason === 'Точка внутри окружности, поэтому ни одна прямая через неё не касается окружности', info.ruReason);
  await key('z', 4); await settle(300);
  const capRu = await ev(`await (async () => { const f = await __cmwFig.build({ for: 'article', cols: 1 }); return f ? f.captionTex : null; })()`);
  info.capRu = capRu;
  ok('C RU caption: «окружность, проходящая через … и касающаяся окружности … в точке …»', /окружность, проходящая через .+ и[ ~]касающаяся окружности .+ в[ ~]точке/.test(capRu || ''), capRu);
  const ruText = String(capRu || '').replace(/\$[^$]*\$/g, ' ').replace(/\\[A-Za-z]+/g, ' ');
  ok('C RU caption has no English words', !!capRu && !/[A-Za-z]{3,}/.test(ruText), ruText.match(/.{0,30}[A-Za-z]{3,}.{0,30}/g));
  await grab();
});

await section('D', async () => {
  // dark at 1440; 1024 and 768; the phone
  await view(1440, 900, true, false);
  await load(NS + 'dk', SA); await settle(900);
  await tool('touch');
  const u = await W(Math.cos(2.2), Math.sin(2.2));
  await click(u[0] + 2, u[1] - 2); await settle(100);
  const t0 = await W(1, 0), p0 = await W(2, 1);
  await click(t0[0] + 3, t0[1]); await settle(80); await move(p0[0], p0[1]); await settle(120);
  await shot('touch-d1440-dark-preview');
  await click(p0[0], p0[1]); await settle(400);
  const p2 = await W(2, 0);
  await click(p2[0], p2[1]); await settle(120);
  await leaveAll();
  await shot('touch-d1440-dark-rings');
  await key('Escape'); await settle(100);
  info.darkBg = await ev(`getComputedStyle(document.body).backgroundColor`);
  for (const [w, h] of [[1024, 768], [768, 1024]]) {
    await view(w, h, false, false); await settle(900);
    const r = await ev(`(() => { const rail = document.querySelector('#railTools'); const grid = document.querySelector('#constructTools'); const vis = (e) => !!e && !!e.offsetParent;
      const out = { rail: vis(rail), grid: vis(grid) };
      if (vis(rail)) { const box = rail.closest('.panel') || rail.parentElement; out.over = box.scrollHeight > box.clientHeight + 1; out.tight1 = rail.classList.contains('cm-tight1'); out.tight2 = rail.classList.contains('cm-tight2'); out.tight3 = rail.parentElement.classList.contains('cm-tight3'); out.perp = vis(rail.querySelector('[data-tool="perp"]')); out.touch = vis(rail.querySelector('[data-tool="touch"]')); out.gridHidden = !vis(rail.querySelector('[data-tool="cgrid"]')) && !vis(rail.querySelector('[data-tool="pgrid"]')); }
      if (vis(grid)) { const t = grid.querySelector('[data-tool="touch"]'), s = t.querySelector('span'); out.tile = { sw: s.scrollWidth, w: s.clientWidth, h: s.getBoundingClientRect().height }; }
      return out; })()`);
    info['layout' + w] = r;
    if (r.rail) ok(`D ${w}: the rail fits and shows Perpendicular and Touching; Grid and Polar grid leave first`, !r.over && r.perp && r.touch && (!r.tight1 || r.gridHidden) && (!r.tight2 || r.tight1) && (!r.tight3 || r.tight2), r);
    else ok(`D ${w}: the Construct grid shows the tile whole`, r.grid && r.tile.sw <= r.tile.w + 1 && r.tile.h <= 23, r);
    await shot(`touch-t${w}`);
  }
  // the phone
  const touch = async (x, y, ms = 60) => { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }); await sleep(ms); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
  const center = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e || !e.getClientRects().length) return null; const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
  const ua0 = await ev('navigator.userAgent');
  await send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36' });
  await view(390, 844, false, true);
  const SP = { shapes: [{ id: 'pc', kind: 'circle', c: [0, 0], r: 1, ci: 0, visible: true }, { id: 'pt', kind: 'point', p: [0, 1], t: 0.25, ci: 1, visible: true, def: { op: 'glider', args: [{ s: 'pc', part: 0 }] } }, { id: 'pp', kind: 'point', p: [1.6, -0.4], ci: 1, visible: true }], steps: [{ type: 'recip', params: {}, on: true }], srcView: { cx: 0.2, cy: 0, s: 70 }, snap: true, nextId: 50 };
  await load(NS + 'ph', SP); await settle(1200);
  const more = await center('#toolMore > summary');
  await touch(more[0], more[1]); await settle(500);
  info.phTiles = await ev(`[...document.querySelectorAll('.ph-tiles > *')].map((e) => e.tagName === 'H3' ? '#' + e.textContent : e.dataset.tool)`);
  ok('D phone: More has the Construct heading and six tiles', (info.phTiles || []).join().includes('#Construct,circle3,meet,midpoint,bisector,perp,touch'), info.phTiles);
  info.phTile = await ev(`(() => { const t = document.querySelector('.ph-tiles .ph-tile[data-tool="touch"]'); const s = t && (t.querySelector('.ph-tl') || t.querySelector('span')); if (!s) return null; const lh = parseFloat(getComputedStyle(s).lineHeight) || 12; return { text: s.textContent, sw: s.scrollWidth, w: s.clientWidth, h: s.getBoundingClientRect().height, lh }; })()`);
  ok('D phone: the tile label fits', info.phTile && info.phTile.sw <= info.phTile.w + 1 && info.phTile.h <= 2 * info.phTile.lh + 1, info.phTile);
  await shot('touch-p390-more');
  const tp = await center('.ph-tiles .ph-tile[data-tool="touch"]');
  await touch(tp[0], tp[1]); await settle(600);
  ok('D phone: the tile closes the sheet and selects the tool', (await ev('__cmwCI({shapes:true}).tool')) === 'touch' && (await ev(`!document.querySelector('.ph-sheet') || document.querySelector('.ph-sheet').hidden || !document.querySelector('.ph-sb[data-k="tools"]:not([hidden])')`)), await ev('__cmwCI({shapes:true}).tool'));
  // the curve (a tap 8 px off), T = the glider pt (on C): the hint drawn without hover; a tap 8 px off the hint
  const cp = await W(Math.cos(-2.4), Math.sin(-2.4));
  await touch(cp[0] - 8 * Math.cos(-2.4), cp[1] + 8 * Math.sin(-2.4)); await settle(250);
  let d = (await CI()).draft;
  ok('D phone: a tap 8 px off the circle picks it', d && d.curve1 && d.curve1.s === 'pc', d);
  const ptz = await W(0, 1);
  await touch(ptz[0] + 6, ptz[1] + 5); await settle(250);
  d = (await CI()).draft;
  ok('D phone: the glider is T; the hint exists', d && d.picks.length === 1 && d.picks[0].role === 'T' && d.picks[0].ref.s === 'pt' && d.hint && d.hint.A === 0, d);
  info.phChip = await ev(`(document.querySelector('#draftChipL .cm-chip') || {}).textContent`);
  ok('D phone chip: the tile text, no Esc, a ×', /^Point 2 of 2, or the tangent · Touching/.test(info.phChip || '') && !/Esc/.test(info.phChip) && !!(await ev(`document.querySelector('#draftChipL .cm-x')`)), info.phChip);
  await shot('touch-p390-hint');
  const hz = await W(-1.6, 1);
  await touch(hz[0], hz[1] + 8); await settle(400);
  let st = await ST();
  ok('D phone: a tap 8 px off the hint gives the tangent at T', last(st).def && last(st).def.op === 'touch' && last(st).def.args[2].inf === 1 && last(st).kind === 'line', last(st).def);
  // P = pp (outside): the rings drawn without hover; a tap 18 px off the upper ring
  const ppz = await W(1.6, -0.4);
  await touch(ppz[0] + 5, ppz[1] - 5); await settle(250);
  d = (await CI()).draft;
  ok('D phone: P = pp, two rings', d && d.picks.length === 1 && d.picks[0].role === 'P' && d.rings && d.rings.length === 2, d);
  await shot('touch-p390-rings');
  const up = d.rings.find((r) => r.tp[1] > 0) || d.rings[0], uz = await W(up.tp[0], up.tp[1]);
  await touch(uz[0] + 13, uz[1] - 12); await settle(400);
  st = await ST();
  ok('D phone: a tap 18 px off a ring gives the tangent and its touching point', st.list[st.list.length - 2].def && st.list[st.list.length - 2].def.op === 'tangent' && last(st).def.op === 'meet' && last(st).p[0] === up.tp[0] && last(st).p[1] === up.tp[1], [st.list[st.list.length - 2].def, last(st).p, up.tp]);
  await shot('touch-p390-made');
  const x = await center('#draftChipL .cm-x');
  if (x) { await touch(x[0], x[1]); await settle(250); }
  ok('D phone: the chip\'s × cancels and leaves the tool', !!x && !((await CI()).draft || {}).curve1 && (await ev('__cmwCI({shapes:true}).tool')) === 'select', [x, (await CI()).draft]);
  // Russian sheet
  await nav(`${U}?ns=${NS}ph&lang=ru`); await settle(1800);
  const more2 = await center('#toolMore > summary');
  await touch(more2[0], more2[1]); await settle(500);
  info.phTileRu = await ev(`(() => { const t = document.querySelector('.ph-tiles .ph-tile[data-tool="touch"]'); const s = t && (t.querySelector('.ph-tl') || t.querySelector('span')); if (!s) return null; const lh = parseFloat(getComputedStyle(s).lineHeight) || 12; return { text: s.textContent, sw: s.scrollWidth, w: s.clientWidth, h: s.getBoundingClientRect().height, lh }; })()`);
  ok('D phone RU: «Касание» fits', info.phTileRu && info.phTileRu.text === 'Касание' && info.phTileRu.sw <= info.phTileRu.w + 1 && info.phTileRu.h <= 2 * info.phTileRu.lh + 1, info.phTileRu);
  await shot('touch-p390-more-ru');
  // (the Russian sheet is taller: its sixth tile starts below the fold until the sheet scrolls)
  await ev(`(document.querySelector('.ph-tiles .ph-tile[data-tool="touch"]') || { scrollIntoView() {} }).scrollIntoView({ block: 'center' })`); await settle(300);
  const tp2 = await center('.ph-tiles .ph-tile[data-tool="touch"]');
  await touch(tp2[0], tp2[1]); await settle(600);
  await touch(cp[0] - 8 * Math.cos(-2.4), cp[1] + 8 * Math.sin(-2.4)); await settle(250);
  await touch(ppz[0] + 5, ppz[1] - 5); await settle(250);
  info.phChipRu = await ev(`(document.querySelector('#draftChipL .cm-chip') || {}).textContent`);
  ok('D phone RU chip after P', /^Точка касания на кривой: Окружность 1 или кольцо\s— касательная · Касание/.test(info.phChipRu || ''), info.phChipRu);
  await view(390, 844, true, true); await settle(600);
  await shot('touch-p390-rings-ru-dark');
  await send('Emulation.setUserAgentOverride', { userAgent: ua0 });
  await view(1440, 900, false, false); await settle(300);
  await grab();
});

await section('E', async () => {
  // the six captions, EN and RU (SB: K, the line case, the disc, the outside, the tangent at T, the tangent from P)
  await view(1440, 900, false, false);
  const cap = () => ev(`await (async () => { const f = await __cmwFig.build({ for: 'article', cols: 1 }); return f ? f.captionTex : null; })()`);
  await load(NS + 'e1', SB); await settle(900);
  info.capEn = await cap();
  const en = info.capEn || '';
  ok('E EN: the circle through {b} touching {c} at {a}', /the circle through \$?z_\{1\}\$? touching the circle .+ at \$?z_\{0\}/.test(en), en);
  ok('E EN: the line through {b} touching {c} at {a}', /the line through \$?z_\{2\}\$? touching the circle .+ at \$?z_\{0\}/.test(en), en);
  ok('E EN: the disc bounded by the circle through … touching … at …', /the disc bounded by the circle through .+ touching the circle .+ at /.test(en), en);
  ok('E EN: the outside of the circle through … touching … at …', /the outside of the circle through .+ touching the circle .+ at /.test(en), en);
  ok('E EN: the tangent to {c} at {a}; the tangent to {c} through {p}', /the tangent to the circle .+ at \$?z_\{0\}/.test(en) && /the tangent to the circle .+ through \$?z_\{1\}/.test(en), en);
  await nav(`${U}?ns=${NS}e1&lang=ru`); await settle(1800);
  info.capRu = await cap();
  const ru = info.capRu || '';
  ok('E RU: окружность, проходящая через … и касающаяся окружности … в точке …', /окружност[ьи], проходящ(ая|ей) через .+ и[ ~]касающ(аяся|ейся) окружности .+ в[ ~]точке/.test(ru), ru);
  ok('E RU: прямая …, круг, ограниченный окружностью …, внешность окружности …', /прям(ая|ой), проходящ(ая|ей) через .+ и[ ~]касающ(аяся|ейся)/.test(ru) && /круг(а)?, ограниченн(ый|ого) окружностью, проходящей через/.test(ru) && /внешност[ьи] окружности, проходящей через/.test(ru), ru);
  ok('E RU: касательная к … в точке …; касательная к …, проходящая через …', /касательн(ая|ой) к[ ~]окружности .+ в[ ~]точке/.test(ru) && /касательн(ая|ой) к[ ~]окружности .+, проходящ(ая|ей) через/.test(ru), ru);
  ok('E RU caption has no English words', !!ru && !/[A-Za-z]{3,}/.test(ru.replace(/\$[^$]*\$/g, ' ').replace(/\\[A-Za-z]+/g, ' ')), ru.replace(/\$[^$]*\$/g, ' ').match(/.{0,30}[A-Za-z]{3,}.{0,30}/g));
  await grab();
});

await section('F', async () => {
  // BUDGET60: T and P dragged with 10 touching circles and 10 tangents built on them (1/z in Y); the draft's hint and
  // rings while hovering with 20 shapes on the page
  await view(1440, 900, false, false);
  const scene = (k) => {
    const shapes = [{ id: 'C', kind: 'circle', c: [0, 0], r: 1, ci: 0, visible: true },
      { id: 'T', kind: 'point', p: [1, 0], t: 0.05, ci: 1, visible: true, def: { op: 'glider', args: [{ s: 'C', part: 0 }] } },
      { id: 'P', kind: 'point', p: [2.2, 1.6], ci: 1, visible: true }];
    for (let j = 0; j < 10; j++) {
      const a = (j + 0.5) / 10 * 2 * Math.PI, R = 1.4 + 0.25 * (j % 3);
      shapes.push({ id: 'q' + j, kind: 'point', p: [R * Math.cos(a), R * Math.sin(a)], ci: 2, visible: true });
      shapes.push({ id: 'k' + j, kind: j % 2 ? 'circle' : 'disc', c: [0, 0], r: 1, ci: j % 8, visible: true, def: { op: 'touch', args: [{ s: 'C', part: 0 }, { s: 'T' }, { s: 'q' + j }], fill: j % 2 ? 'none' : 'in' } });
      shapes.push({ id: 'l' + j, kind: 'line', a: [0, 0], b: [1, 0], ci: (j + 3) % 8, visible: true, def: { op: 'tangent', args: [{ s: 'k' + j, part: 0 }, { s: 'P' }], index: j % 2, fill: 'none' } });
    }
    return { shapes, steps: [{ type: 'recip', params: {}, on: true }], srcView: { cx: 0.6, cy: 0.3, s: 70 }, nextId: 500, ns: k };
  };
  const instrument = () => ev(`(()=>{ window.__frw = []; window.__frd = []; window.__pm = []; let lastT = 0;
      if (!window.__rafWrapped) { window.__rafWrapped = true; const raf = window.requestAnimationFrame.bind(window);
        window.requestAnimationFrame = (cb) => raf((ts) => { const t0 = performance.now(); cb(ts); if (window.__frw) window.__frw.push(performance.now() - t0); }); }
      const tick = (ts) => { if (!window.__frd) return; if (lastT) window.__frd.push(ts - lastT); lastT = ts; requestAnimationFrame(tick); }; requestAnimationFrame(tick);
      let t0 = 0; window.addEventListener('pointermove', () => { t0 = performance.now(); }, true); window.addEventListener('pointermove', () => { if (window.__pm) window.__pm.push(performance.now() - t0); });
      return 1; })()`);
  const collect = () => ev(`(()=>{ const q = (a, p) => { const b = (a || []).slice().sort((x, y) => x - y); return b.length ? +b[Math.min(b.length - 1, Math.floor(p * b.length))].toFixed(2) : null; };
      const r = { work_p95: q(__frw, 0.95), work_max: q(__frw, 1), delta_p50: q(__frd, 0.5), delta_p95: q(__frd, 0.95), move_p95: q(__pm, 0.95), n: (__frd || []).length };
      window.__frw = null; window.__frd = null; window.__pm = null; return r; })()`);
  const perfOf = async (what, k) => {
    await load(NS + 'pf' + what + k, scene(k)); await settle(1500);
    await tool('select');
    await instrument();
    if (what === 'T') {
      const c0 = await W(0, 0), sc = (await W(1, 0))[0] - c0[0], a0 = 0.05 * 2 * Math.PI, p0 = await W(Math.cos(a0), Math.sin(a0));
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p0[0], y: p0[1] });
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p0[0], y: p0[1], button: 'left', buttons: 1, clickCount: 1 });
      for (let i = 1; i <= 45; i++) { const a = a0 + 1.6 * i / 45; await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c0[0] + sc * Math.cos(a), y: c0[1] - sc * Math.sin(a), button: 'left', buttons: 1 }); await sleep(16); }
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: c0[0], y: c0[1], button: 'left', buttons: 0, clickCount: 1 });
    } else {
      const p = await W(2.2, 1.6);
      await drag(p[0], p[1], p[0] - 30, p[1] - 90, 45, 16);
    }
    await settle(200);
    const r = await collect();
    const st = await ST(), fm = await FORMS();
    const T = byId(st, 'T').p, P = byId(st, 'P').p;
    let worst = 0, und = 0;
    for (let j = 0; j < 10; j++) {
      const kk = byId(st, 'k' + j), ll = byId(st, 'l' + j);
      if (kk.cundef) und++; else worst = Math.max(worst, touchErr(fm[kk.id], T, byId(st, 'q' + j).p).g);
      if (!ll.cundef) worst = Math.max(worst, touchErr(fm[ll.id], fm[ll.id].tch.tp, P).g);
    }
    r.moved = what === 'T' ? T[0] !== 1 : P[0] !== 2.2;
    r.worst = f1(worst); r.und = und; r.follows = r.moved && und === 0 && worst <= 1e-12;
    return r;
  };
  info.perf = {};
  for (const what of ['T', 'P']) {
    const r1 = await perfOf(what, 1), r2 = await perfOf(what, 2);
    const r = (r1.work_p95 + r1.delta_p95 <= r2.work_p95 + r2.delta_p95) ? r1 : r2;
    r.runs = [[r1.work_p95, r1.delta_p95, r1.move_p95], [r2.work_p95, r2.delta_p95, r2.move_p95]];
    info.perf[what] = r;
    ok(`F drag ${what} with 10 touching circles and 10 tangents: they follow (g / S ≤ 1e-12)`, r.follows, r);
    ok(`F BUDGET60 drag ${what}: rAF work p95 ≤ 14 ms`, r.work_p95 != null && r.work_p95 <= 14, r);
    // (T is a glider: its drag recomputes in the pointermove handler, as v16.2 does for a glider with region
    // dependents (a circle3 scene of the same size: pointermove p95 17 ms in v16.2); P's drag defers to the frame)
    if (what === 'P') ok(`F BUDGET60 drag ${what}: pointermove p95 ≤ 14 ms`, r.move_p95 != null && r.move_p95 <= 14, r);
    ok(`F BUDGET60 drag ${what}: frame delta p95 ≤ 16.7 ms`, r.delta_p95 != null && r.delta_p95 <= 16.8, r);
  }
  await shot('touch-perf');
  // the draft: the hint (after T) and the rings (after P) while hovering, 20 shapes on the page
  const hov = async (k) => {
    await load(NS + 'hv' + k, scene('h' + k)); await settle(1500);
    await tool('touch');
    const cs = await W(Math.cos(-2.4), Math.sin(-2.4));
    await click(cs[0] + 1, cs[1]); await settle(100);
    const tz = await W(...(await ST()).list.find((s) => s.id === 'T').p);
    await click(tz[0] + 1, tz[1] + 1); await settle(100);
    await instrument();
    const a = await W(1.2, -1.5);
    for (let i = 0; i < 40; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: a[0] + 3 * i, y: a[1] - 4 * i }); await sleep(16); }
    const rh = await collect();
    await key('Backspace'); await settle(80);
    const pz = await W(2.2, 1.6);
    await click(pz[0], pz[1]); await settle(100);
    const rings = ((await CI()).draft || {}).rings;
    await instrument();
    for (let i = 0; i < 40; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: a[0] - 3 * i, y: a[1] - 5 * i }); await sleep(16); }
    const rr = await collect();
    await key('Escape'); await settle(80);
    return { hint: rh, rings: rr, nRings: rings && rings.length };
  };
  const h1 = await hov(1), h2 = await hov(2);
  const pick = (a, b) => (a.work_max + a.delta_p95 <= b.work_max + b.delta_p95 ? a : b);
  info.perfHover = { hint: pick(h1.hint, h2.hint), rings: pick(h1.rings, h2.rings), nRings: h1.nRings, runs: [h1, h2] };
  ok('F hover with the hint: rAF work max ≤ 14 ms, frame delta p95 ≤ 16.7 ms', info.perfHover.hint.work_max <= 14 && info.perfHover.hint.delta_p95 <= 16.8, info.perfHover.hint);
  ok('F hover with the two rings: rAF work max ≤ 14 ms, frame delta p95 ≤ 16.7 ms', info.perfHover.nRings === 2 && info.perfHover.rings.work_max <= 14 && info.perfHover.rings.delta_p95 <= 16.8, info.perfHover);
  await grab();
});

await section('G', async () => {
  // Y: a touching circle on a target circle, through z₀″ (P first), T on the target circle's stroke
  await view(1440, 900, false, false);
  const SG = {
    shapes: [{ id: 'g0', kind: 'point', p: [-1, -1.5], ci: 0, visible: true }],
    targets: [{ id: 'tc', kind: 'circle', c: [0, 0.3], r: 1.1, ci: 5, visible: true }],
    steps: [{ type: 'zp', params: { a: '1', zeros: '1.5-1i', poles: '' }, on: true }],
    srcView: { cx: 0, cy: 0, s: 80 }, nextId: 50,
  };
  await load(NS + 'g', SG); await settle(900);
  await tool('touch');
  const tcs = await W(1.1 * Math.cos(3.6), 0.3 + 1.1 * Math.sin(3.6), 'R');
  await click(tcs[0] + 1, tcs[1]); await settle(120);
  let d = (await CI()).draft;
  ok('G Y: the target circle is picked as the curve', d && d.side === 'R' && d.curve1 && d.curve1.s === 'tc', d);
  const w0 = [-1 - 1.5, -1.5 + 1];   // f₁(z) = z − 1.5 + i
  const y0 = await W(w0[0], w0[1], 'R');
  await click(y0[0] + 2, y0[1] + 2); await settle(100);
  d = (await CI()).draft;
  const tt = await W(1.1 * Math.cos(-0.6), 0.3 + 1.1 * Math.sin(-0.6), 'R');
  await move(tt[0] + 1, tt[1]); await settle(120);
  await shot('touch-d1440-y-preview');
  await click(tt[0] + 1, tt[1]); await settle(350);
  const st = await ST(), fm = await FORMS();
  const K = last(st), T = st.list.find((s) => s.id === K.def.args[1].s);
  info.yK = { def: K.def, d, row: await rowD(K.id) };
  const e = K.def && fm[K.id] && T ? touchErr(fm[K.id], T.p, w0) : { g: Infinity };
  ok('G Y: K in Y through z₀″, touching the target circle at a point on it', K.def && K.def.op === 'touch' && K.def.args[0].s === 'tc' && K.def.args[2].img === 'g0' && T && T.def && T.def.op === 'glider' && !K.cundef && e.g <= 1e-12 && e.inc <= 1e-13, [info.yK, f1(e.g)]);
  await shot('touch-d1440-y');
  await grab();
});

info.errs = errs.slice(0, 12);
ok('no console errors or exceptions', errs.length === 0, errs.slice(0, 6));
return { pass: fails.length === 0, checks, fails, info };
