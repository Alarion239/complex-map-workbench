// v16.3 review fixes (notes/orthogonal-circle/ledger.json): the in-app checks of the user- and math-review findings
// that the node suite cannot see. A command file for a CDP daemon (test/cdp_kit README):
//   python3 build.py && test/<you>_cdp/q.sh test/fix163_cmd.js
//   U1 the unit circle picked as C is fixed (a body drag pans, a toast); Make free unlocks it
//   U5 after a ring's tangent, P stays picked with the other ring: the second tangent is one click; rows name the
//      touching point (U2)
//   U11 a click in the other plane keeps the draft
//   U9 names stay when K is a line for the moment; the decimal mirror pair is the pencil (math-3)
//   U13 a disc as C: "the circle of Disc 1"; M5 Use complement keeps a meet on K
//   U12 a touch tap on a tile: the chip's touch form before the curve
//   U3 dark: the rings (shot); U4 BUDGET60: T (a glider) and a free point dragged in a 28-shape disk scene
// the daemon's port: one constant (CMW_PORT in the daemon's environment, else 9826) [v16.3 verify-2]
const PORT = (typeof process !== 'undefined' && process.env && process.env.CMW_PORT) || 9826;
const fails = [], info = {};
let checks = 0;
const ok = (name, cond, got) => { checks++; if (!cond) fails.push({ name, got }); };
const settle = async (ms = 300) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const errs = [];
const grab = async () => { errs.push(...(await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error' || x.t === 'warning') && !/Failed to load resource|favicon/.test(x.m || ''))); };
const W = (re, im, side = 'L') => ev(`__cmwW2S('${side}', ${re}, ${im})`);
const CI = (o) => ev(`__cmwCI(${JSON.stringify(o || null)})`);
const ST = () => CI({ shapes: true });
const byId = (st, id) => st.list.find((s) => s.id === id);
const last = (st) => st.list[st.list.length - 1];
const tool = async (id) => { const r = await clickSel(`#tools .tool[data-tool="${id}"], #constructTools .tool[data-tool="${id}"]`); await settle(120); return r; };
const chipT = (side = 'L') => ev(`(document.querySelector('#draftChip${side} .cm-t') || {}).textContent || ''`);
const rowD = (id) => ev(`(document.querySelector('.shape[data-id="${id}"] .d') || {}).textContent`);
const rowK = (id) => ev(`(document.querySelector('.shape[data-id="${id}"] .shape-name .k') || {}).textContent`);
const toastAll = () => ev(`[...document.querySelectorAll('#toastHost .toast')].map((t) => t.textContent.trim()).join(' | ')`);
const names = async () => { const n = await CI({ names: true }); return (id) => (n.find((x) => x.id === id) || {}).name; };
const menuItems = () => ev(`[...document.querySelectorAll('.menu .mi, [role="menuitem"]')].filter((b) => b.getClientRects().length).map((b) => b.textContent.trim())`);
const menuClick = (start) => ev(`(() => { const b = [...document.querySelectorAll('.menu .mi, [role="menuitem"]')].filter((b) => b.getClientRects().length).find((b) => b.textContent.trim().startsWith(${JSON.stringify(start)})); if (b) b.click(); return !!b; })()`);
const NS = 'fx' + (Date.now() % 1000000);
const base = (shapes, o) => Object.assign({ shapes, steps: [{ type: 'recip', params: {}, on: true }], srcView: { cx: 0.3, cy: 0, s: 75 }, unit: true, snap: true, nextId: 50, pattern: 'checker' }, o || {});
const mdrag = async (p0, p1, n = 12) => {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p0[0], y: p0[1] });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p0[0], y: p0[1], button: 'left', buttons: 1, clickCount: 1 });
  for (let i = 1; i <= n; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p0[0] + (p1[0] - p0[0]) * i / n, y: p0[1] + (p1[1] - p0[1]) * i / n, button: 'left', buttons: 1 }); await sleep(16); }
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p1[0], y: p1[1], button: 'left', buttons: 0, clickCount: 1 });
  await settle(250);
};
await view(1440, 900, false, false);

// ---------------------------------------------------------------- U1: the unit circle stays fixed
{
  await load(NS + 'u1', base([]));
  await settle(900);
  await tool('perp');
  const u = await W(Math.cos(2.2), Math.sin(2.2));
  await click(u[0] + 2, u[1] - 2); await settle(150);
  for (const z of [[0.3, 0.2], [-0.5, 0.4]]) { const p = await W(z[0], z[1]); await click(p[0], p[1]); await settle(200); }
  let st = await ST();
  const K = last(st), C = byId(st, K.def.args[0].s);
  ok('U1 the unit circle picked as C: a fixed shape (fixed: unit), K on it', C && C.fixed === 'unit' && C.kind === 'circle' && K.def.op === 'perp' && K.def.nk === 'circle', [C, K.def]);
  // (v16.5 fix rail-4: the row's name is "The unit circle", no number, and its description is its equation)
  info.u1row = { name: await rowK(C.id), d: await rowD(C.id) };
  ok('U1 its row reads "the unit circle"', info.u1row.name === 'The unit circle' && /^\|z\|\s*=\s*1$/.test(info.u1row.d || ''), info.u1row);
  await tool('select');
  const a = await W(Math.cos(-2.4), Math.sin(-2.4));
  await click(a[0], a[1]); await settle(200);
  const sel = (await ST()).selected;
  const b = await W(Math.cos(-2.4) - 0.3, Math.sin(-2.4) - 0.2);
  await mdrag(a, b);
  st = await ST();
  const C2 = byId(st, C.id);
  info.u1toast = await toastAll();
  ok('U1 a body drag on its stroke does not move it (the press pans), with the toast', C2.c[0] === 0 && C2.c[1] === 0 && C2.r === 1 && /This is the unit circle: it stays fixed/.test(info.u1toast), { sel, c: C2.c, r: C2.r, toast: info.u1toast });
  info.u1handles = await ev(`(() => { const s = __cmwCI({ shapes: true }).list.find((x) => x.id === ${JSON.stringify(C.id)}); return s ? Object.keys(s).filter((k) => k === 'fixed') : null; })()`);
  await clickSel(`.shape[data-id="${C.id}"] .icon-btn.more`); await settle(250);
  info.u1menu = await menuItems();
  ok('U1 its ⋯ has Make free', info.u1menu.includes('Make free'), info.u1menu);
  await menuClick('Make free'); await settle(300);
  st = await ST();
  ok('U1 Make free unlocks it (no fixed), and its row is a plain circle again', !byId(st, C.id).fixed && (await rowK(C.id)) !== 'The unit circle', [byId(st, C.id), await rowK(C.id)]);
  await grab();
}

// ---------------------------------------------------------------- U5 / U2: both tangents from P, rows by the touching point
{
  await load(NS + 'u5', base([]));
  await settle(900);
  await tool('touch');
  const u = await W(Math.cos(2.2), Math.sin(2.2));
  await click(u[0] + 2, u[1] - 2); await settle(150);
  const p = await W(2, 0.4);
  await click(p[0], p[1]); await settle(200);
  let d = (await CI()).draft;
  // (v16.3.1: a chip that would wrap keeps one line without its keyboard tail; this one in X at 1440 does. v16.5 UX48
  // wording: "Pick the touching point …", the count, and "⌫ undo pick · Esc" once P is picked)
  const u6 = await ev(`(() => { const t = document.querySelector('#draftChipL .cm-t'); if (!t) return null; const r = document.createRange(); r.selectNodeContents(t); return { text: t.textContent, lines: new Set([...r.getClientRects()].map((q) => Math.round(q.top))).size }; })()`);
  const u6base = 'Pick the touching point on the unit circle, or a ring for a tangent · 2 of 2 · Touching';
  ok('U6 the chip after P with the rings', !!u6 && (u6.text === u6base + ' · ⌫ undo pick · Esc' || (u6.text === u6base && u6.lines === 1)), u6);
  const r0 = d.rings[0], r1 = d.rings[1], z0 = await W(r0.tp[0], r0.tp[1]);
  await click(z0[0] + 3, z0[1] - 2); await settle(400);
  let st = await ST();
  const L1 = st.list[st.list.length - 2], M1 = last(st);
  d = (await CI()).draft;
  ok('U5 after the first ring: P stays picked, the other ring is still offered', d && d.picks.length === 1 && d.picks[0].role === 'P' && d.picks[0].ref && d.picks[0].ref.s === L1.def.args[1].s && d.rings.length === 2, d);
  const n1 = st.list.length, z1 = await W(r1.tp[0], r1.tp[1]);
  await click(z1[0] + 3, z1[1] - 2); await settle(400);
  st = await ST();
  const L2 = st.list[st.list.length - 2], M2 = last(st);
  ok('U5 one click on the other ring: the second tangent through the same P', st.list.length === n1 + 2 && L2.def.op === 'tangent' && L2.def.index === r1.k && L2.def.args[1].s === L1.def.args[1].s && M2.def.op === 'meet', [L2.def, M2.def]);
  const nm = await names();
  info.u2rows = [await rowD(L1.id), await rowD(L2.id)];
  // (v16.5 fix rail-4: C is the shown unit circle made a shape, "the unit circle", no number)
  ok('U2 each tangent reads by its touching point', info.u2rows[0] === `tangent to the unit circle at ${nm(M1.id)}, through ${nm(L1.def.args[1].s)}` && info.u2rows[1] === `tangent to the unit circle at ${nm(M2.id)}, through ${nm(L1.def.args[1].s)}`, info.u2rows);
  // a click off C now starts the next circle (P is no longer refused there)
  d = (await CI()).draft;
  const q = await W(-1.5, 1.2);
  await click(q[0], q[1]); await settle(200);
  d = (await CI()).draft;
  ok('U5 with both tangents made, a click off C starts the next circle (it is the new P)', d && d.picks.length === 1 && d.picks[0].role === 'P' && Math.abs(d.picks[0].z[0] + 1.5) < 0.05, d);
  // U11: a click in Y's empty space keeps the draft
  const y = await W(0.2, 3.3, 'R');
  await click(y[0], y[1]); await settle(200);
  const d2 = (await CI()).draft;
  ok('U11 a click in the other plane on no curve keeps the draft (its curve and P)', d2 && d2.side === 'L' && d2.curve1 && d2.picks.length === 1, d2);
  // U3: dark mode, the rings (a shot)
  await view(1440, 900, true, false); await settle(500);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 700, y: 880 }); await settle(150);
  await shot('fix-dark-rings');
  await view(1440, 900, false, false); await settle(300);
  await grab();
}

// ---------------------------------------------------------------- U9, math-3, U13, math-5 (loaded states)
{
  const pt = (id, p) => ({ id, kind: 'point', p, ci: 1, visible: true });
  const perp = (id, c, a, b, fill, nk) => ({ id, kind: fill === 'in' ? 'disc' : 'circle', c: [0, 0], r: 1, ci: 2, visible: true, def: { op: 'perp', args: [{ s: c, part: 0 }, { s: a }, { s: b }], fill: fill || 'none', nk: nk || 'circle' } });
  await load(NS + 'u9', base([{ id: 'C', kind: 'circle', c: [0, 0], r: 1, ci: 0, visible: true }, pt('p', [0.5, 0.5]), pt('q', [0.8, 0.8]), perp('k', 'C', 'p', 'q'),
    { id: 'c3', kind: 'circle', c: [2, 2], r: 0.5, ci: 3, visible: true }, pt('m1', [1.3, 0.9]), pt('m2', [0.52, 0.36]), perp('kp', 'C', 'm1', 'm2'),
    { id: 'D', kind: 'disc', c: [-2, 0], r: 0.8, ci: 4, visible: true }, pt('a', [-1.5, 0.5]), pt('b', [-2.5, 1]), perp('kd', 'D', 'a', 'b', 'in'),
    { id: 'L', kind: 'line', a: [-3, 0.9], b: [3, 1.05], ci: 5, visible: true }, { id: 'x', kind: 'point', p: [0, 0], ci: 6, visible: true, def: { op: 'meet', args: [{ s: 'kd', part: 0 }, { s: 'L', part: 0 }], index: 0 } }]));
  await settle(900);
  let st = await ST();
  const nm = await names();
  ok('U9 K a line for the moment (P, Q collinear with the centre) keeps its name: Circle 2; the next circle stays Circle 3', byId(st, 'k').kind === 'line' && nm('k') === 'Circle 2' && nm('c3') === 'Circle 3', [byId(st, 'k').kind, nm('k'), nm('c3')]);
  ok('math-3 / U9 the decimal mirror pair 1.3+0.9i, 0.52+0.36i: the pencil, with its reason', !!byId(st, 'kp').cundef && byId(st, 'kp').cundef.code === 'pencil' && /symmetric in the curve/.test(await rowD('kp') || ''), [byId(st, 'kp').cundef, await rowD('kp')]);
  info.u13 = await rowD('kd');
  ok('U13 a disc as the curve: "the circle of Disc 1"', /^disc perpendicular to the circle of Disc 1, through /.test(info.u13 || ''), info.u13);
  const x0 = byId(st, 'x').p.slice(), f0 = !!byId(st, 'kd').def.flip, c0 = !!byId(st, 'kd').complement;
  await ev(`Construct.api.cm.setDef('kd', { flip: ${!f0} })`); await settle(300);
  st = await ST();
  ok('math-5 Use complement on K: the meet point on K stays where it is (its index swapped in the same step)', !byId(st, 'x').cundef && !!byId(st, 'kd').complement !== c0 && Math.hypot(byId(st, 'x').p[0] - x0[0], byId(st, 'x').p[1] - x0[1]) < 1e-12 && byId(st, 'x').def.index === 1, [x0, byId(st, 'x').p, byId(st, 'x').def, byId(st, 'x').cundef]);
  await key('z', 4); await settle(300);
  st = await ST();
  ok('math-5 one undo step brings back the flip and the index', !!byId(st, 'kd').complement === c0 && byId(st, 'x').def.index === 0, [byId(st, 'kd').complement, byId(st, 'x').def]);
  await grab();
}

// ---------------------------------------------------------------- U12: a touch tap on a tile, the chip before the curve
{
  await nav(`http://localhost:${PORT}/test.html?ns=${NS}u12`); await settle(1500);
  const r = await ev(`(() => { const b = document.querySelector('#constructTools .tool[data-tool="perp"]'); const q = b.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; })()`);
  // touch input needs touch emulation on, or Input.dispatchTouchEvent never returns [v16.3 verify-2]
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r[0], y: r[1] }] });
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await settle(400);
  await send('Emulation.setTouchEmulationEnabled', { enabled: false });
  info.u12 = { chip: await chipT(), x: await ev(`!!document.querySelector('#draftChipL .cm-x')`), tool: (await ST()).tool };
  ok('U12 a tile tapped by touch: the chip has no "Esc cancels" and has a × before the curve', info.u12.tool === 'perp' && info.u12.chip === 'Pick a line or a circle · Perpendicular' && info.u12.x, info.u12);
  await grab();
}

// ---------------------------------------------------------------- U4: BUDGET60, T (a glider) and a free point in a 28-shape disk scene
{
  const scene = (k) => {
    const sh = [{ id: 'C', kind: 'circle', c: [0, 0], r: 1, ci: 0, visible: true, fixed: 'unit' }, { id: 'T', kind: 'point', p: [1, 0], t: 0.05, ci: 1, visible: true, def: { op: 'glider', args: [{ s: 'C', part: 0 }] } }];
    for (let j = 0; j < 6; j++) {
      const a = j / 6 * 2 * Math.PI;
      sh.push({ id: 'pa' + j, kind: 'point', p: [+(0.5 * Math.cos(a)).toFixed(2), +(0.5 * Math.sin(a)).toFixed(2)], ci: 2, visible: true }, { id: 'pb' + j, kind: 'point', p: [+(0.3 * Math.cos(a + 2)).toFixed(2), +(0.3 * Math.sin(a + 2)).toFixed(2)], ci: 2, visible: true });
      sh.push({ id: 'k' + j, kind: j % 2 ? 'circle' : 'disc', c: [0, 0], r: 1, ci: j % 8, visible: true, def: { op: 'perp', args: [{ s: 'C', part: 0 }, { s: 'pa' + j }, { s: 'pb' + j }], fill: j % 2 ? 'none' : 'in', nk: 'circle' } });
    }
    for (let j = 0; j < 3; j++) {
      sh.push({ id: 'q' + j, kind: 'point', p: [-0.6 + 0.3 * j, -0.2 + 0.1 * j], ci: 2, visible: true });
      sh.push({ id: 't' + j, kind: j % 2 ? 'circle' : 'disc', c: [0, 0], r: 1, ci: (j + 3) % 8, visible: true, def: { op: 'touch', args: [{ s: 'C', part: 0 }, { s: 'T' }, { s: 'q' + j }], fill: j % 2 ? 'none' : 'in', nk: 'circle' } });
    }
    return { shapes: sh, steps: [{ type: 'recip', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 160 }, unit: true, snap: false, nextId: 500, ns: k };
  };
  const instrument = () => ev(`(()=>{ window.__frw = []; window.__frd = []; window.__pm = []; let lastT = 0;
      if (!window.__rafWrapped) { window.__rafWrapped = true; const raf = window.requestAnimationFrame.bind(window);
        window.requestAnimationFrame = (cb) => raf((ts) => { const t0 = performance.now(); cb(ts); if (window.__frw) window.__frw.push(performance.now() - t0); }); }
      const tick = (ts) => { if (!window.__frd) return; if (lastT) window.__frd.push(ts - lastT); lastT = ts; requestAnimationFrame(tick); }; requestAnimationFrame(tick);
      let t0 = 0; window.addEventListener('pointermove', () => { t0 = performance.now(); }, true); window.addEventListener('pointermove', () => { if (window.__pm) window.__pm.push(performance.now() - t0); });
      return 1; })()`);
  const collect = () => ev(`(()=>{ const q = (a, p) => { const b = (a || []).slice().sort((x, y) => x - y); return b.length ? +b[Math.min(b.length - 1, Math.floor(p * b.length))].toFixed(2) : null; };
      const r = { work_p95: q(__frw, 0.95), delta_p95: q(__frd, 0.95), delta_max: q(__frd, 1), move_p95: q(__pm, 0.95), n: (__frd || []).length };
      window.__frw = null; window.__frd = null; window.__pm = null; return r; })()`);
  const perfOf = async (what, k) => {
    await load(NS + 'pf' + what + k, scene(k)); await settle(1500);
    await tool('select');
    await instrument();
    const c0 = await W(0, 0), sc = (await W(1, 0))[0] - c0[0];
    const at = what === 'T' ? (a) => [c0[0] + sc * Math.cos(a), c0[1] - sc * Math.sin(a)] : (a) => [c0[0] + sc * 0.5 + sc * 0.3 * (Math.cos(a) - 1), c0[1] - sc * 0.3 * Math.sin(a)];
    const a0 = what === 'T' ? 0.05 * 2 * Math.PI : 0, p0 = at(a0);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p0[0], y: p0[1] });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p0[0], y: p0[1], button: 'left', buttons: 1, clickCount: 1 });
    for (let i = 1; i <= 90; i++) { const q = at(a0 + 3 * i / 90); await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: q[0], y: q[1], button: 'left', buttons: 1 }); await sleep(16); }
    const e = at(a0 + 3);
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: e[0], y: e[1], button: 'left', buttons: 0, clickCount: 1 });
    await settle(250);
    const r = await collect(), st = await ST();
    r.moved = what === 'T' ? byId(st, 'T').t !== 0.05 : byId(st, 'pa0').p[0] !== 0.5;
    r.und = st.list.filter((s) => s.cundef).length;
    return r;
  };
  info.perf = {};
  for (const what of ['T', 'z']) {
    const runs = [await perfOf(what, 1), await perfOf(what, 2), await perfOf(what, 3)];
    info.perf[what] = runs;
  }
  const best = (rs, k) => Math.min(...rs.map((r) => r[k]));
  ok('U4 T (a glider) dragged, 28 shapes: it moves; frame p95 ≤ 16.8 ms (best of 3); pointermove p95 ≤ 4 ms', info.perf.T.every((r) => r.moved && r.und === 0) && best(info.perf.T, 'delta_p95') <= 16.8 && best(info.perf.T, 'move_p95') <= 4, info.perf.T);
  ok('U4 a free point dragged in the same scene: frame p95 ≤ 16.8 ms (best of 3)', info.perf.z.every((r) => r.moved) && best(info.perf.z, 'delta_p95') <= 16.8, info.perf.z);
  await grab();
}
ok('no console errors', errs.length === 0, errs.slice(0, 6));
return { pass: fails.length === 0, checks, fails, info };
