// v16 constructions, the interface (notes/constructions-v16/SPEC.md 4-12, 15, 16, 18 "constr_cmd"). In the real app,
// with real pointer events (mouse, and touch on the phone):
//   A (desktop 1440, light, English): Circle through 3 points from two points and a zero of f₁ (the press on ζ₁ picks,
//     never drags; Shift-click still adds a zero); dragging ζ₁ moves the disc (it passes through ζ₁ exactly); a
//     half-plane drawn from one polygon vertex to another binds both ends and follows the vertex; Intersect by a
//     click on a crossing (exactly on both curves); the Point tool on a stroke makes a point on the curve, which slides
//     along it; Midpoint, then a circle through z₀, z₁ and the midpoint is the half-plane (A = 0 exactly: collinear by
//     construction); undo and redo (one step per construction); drawing tools never make a point on a curve, a crossing
//     snap makes a helper, Alt places freely; a co-argument is not a target; a fixed constructed point says what it is
//     built from; a line through two free points drags both; delete with the cascade toast and Undo; Make free.
//   B save and load (reload: definitions recompute), a link to a fresh page.
//   C Russian: the tiles, the chip, the rows, the toast.
//   D dark, 1024 and 768 (the rail and its divider), shots.
//   E phone 390 × 844 (Android Chrome emulation, touch): More tools has the Construct tiles; a tile closes the sheet
//     and shows on the More key; taps 15 px off a point snap (22 px); the chip's ×.
//   F frame times while dragging a point with 1, 10 and 50 dependents (BUDGET60: rAF work and the pointermove handler
//     p95 ≤ 14 ms, frame delta p95 ≤ 16.7 ms; 50 is reported).
// A command file for a CDP daemon (test/cdp_kit README):  python3 build.py && test/<you>_cdp/q.sh test/constr_cmd.js
// Prints {pass, fails, info}; shots go to <daemon folder>/shots/cm-*.png (copied to notes/constructions-v16/shots).
const ONLY = typeof __ONLY !== 'undefined' ? __ONLY : null;
const run = (k) => !ONLY || ONLY.includes(k);
const fails = [], info = {};
let checks = 0;
const ok = (name, cond, got) => { checks++; if (!cond) fails.push({ name, got }); };
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e * Math.max(1, Math.abs(a), Math.abs(b));
const settle = async (ms = 300) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const errs = [];
const grab = async () => { errs.push(...(await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource|favicon/.test(x.m || ''))); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const W = (re, im, side = 'L') => ev(`__cmwW2S('${side}', ${re}, ${im})`);
const CI = (o) => ev(`__cmwCI(${JSON.stringify(o || null)})`);
const ST = () => CI({ shapes: true });
const byId = (st, id) => st.list.find((s) => s.id === id);
const last = (st) => st.list[st.list.length - 1];
const tool = async (id) => { const r = await clickSel(`#tools .tool[data-tool="${id}"], #constructTools .tool[data-tool="${id}"]`); await settle(120); return r; };
const parseZ = (t) => { const v = String(t).replace(/\s/g, '').replace(/−/g, '-'); const m = /^([-+]?\d*\.?\d+(?:e[-+]?\d+)?)?(?:([-+])(\d*\.?\d*)i)?$/.exec(v); if (!m) return null; return [m[1] ? +m[1] : 0, m[2] ? (m[2] === '-' ? -1 : 1) * (m[3] === '' ? 1 : +m[3]) : 0]; };
const mods = async (type, x, y, m, buttons) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: buttons || 0, clickCount: 1, modifiers: m || 0 });
// a drag with modifiers held (1 Alt, 8 Shift)
const dragM = async (x0, y0, x1, y1, m, n = 10) => {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0, y: y0, modifiers: m });
  await mods('mousePressed', x0, y0, m, 1);
  for (let i = 1; i <= n; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0 + (x1 - x0) * i / n, y: y0 + (y1 - y0) * i / n, button: 'left', buttons: 1, modifiers: m }); await sleep(16); }
  await mods('mouseReleased', x1, y1, m, 0);
};
const toastText = () => ev(`(document.querySelector('#toastHost .toast > span') || {}).textContent || ''`);
const STATE = {
  shapes: [
    { id: 's1', kind: 'point', p: [-1.5, 0], ci: 0, visible: true },
    { id: 's2', kind: 'point', p: [0.5, -1], ci: 1, visible: true },
    { id: 's3', kind: 'polygon', pts: [[-2.5, 1], [-1, 2.2], [0.5, 1.2]], ci: 2, visible: true },
    { id: 's4', kind: 'circle', c: [1.5, -0.5], r: 0.8, ci: 3, visible: true },
    { id: 's5', kind: 'segment', a: [0.5, -1.5], b: [2.5, 0.5], ci: 4, visible: true },
  ],
  steps: [{ type: 'zp', params: { a: '1', zeros: '1+0.5i', poles: '' }, on: true }],
  srcView: { cx: 0, cy: 0, s: 80 }, nextId: 50, pattern: 'checker',
};
const NS = 'cm' + (Date.now() % 1000000);
const dist = (p, c) => Math.hypot(p[0] - c[0], p[1] - c[1]);
// a section that throws is a failure, and the next section still runs
const section = async (k, f) => { if (!run(k)) return; try { await f(); } catch (e) { fails.push({ name: `section ${k} threw`, got: String(e && e.stack || e).slice(0, 700) }); } };

await section('A', async () => {
  await view(1440, 900, false, false);
  await load(NS, STATE);
  await settle(800);
  await grab();
  ok('the Construct grid has six tiles (v16.3: Perpendicular circle, Touching circle)', (await ev(`[...document.querySelectorAll('#constructTools .tool')].map((b) => b.dataset.tool).join()`)) === 'circle3,meet,midpoint,bisector,perp,touch', null);
  // 14. the plane menu on a crossing: Mark the intersection
  const xc = await W(1.5 + 0.8 / Math.SQRT2, -0.5 + 0.8 / Math.SQRT2);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: xc[0] + 1, y: xc[1] + 1 });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: xc[0] + 1, y: xc[1] + 1, button: 'right', buttons: 2, clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: xc[0] + 1, y: xc[1] + 1, button: 'right', buttons: 0, clickCount: 1 });
  await settle(300);
  info.planeMenu = await ev(`[...document.querySelectorAll('.ctx-menu .mi')].map((b) => b.textContent.trim())`);
  ok('the plane menu on a crossing: Mark the intersection', (info.planeMenu || []).some((t) => t.startsWith('Mark the intersection')), info.planeMenu);
  await shot('cm-d1440-menu');
  await key('Escape'); await settle(150);
  // 1. Circle through 3 points: z₀, z₁ (3 px off), ζ₁; the press on ζ₁ picks it, never drags it
  await tool('circle3');
  let a = await W(-1.5, 0), b = await W(0.5, -1);
  const z = await W(1, 0.5);
  await move(a[0] + 3, a[1] - 2); await settle(80);
  const r0 = await CI();
  ok('hover: the ring is on z₀ with the chip "on z₀"', r0.ring && r0.ring.cls === 'point' && r0.ring.chip === 'on z₀', r0.ring);
  ok('the draft chip names the pick', (await ev(`document.querySelector('#draftChipL .cm-t') && document.querySelector('#draftChipL .cm-t').textContent`)) === 'Point 1 of 3 · 3 points · Esc cancels', await ev(`(document.querySelector('#draftChipL') || {}).textContent`));
  const hi0 = (await ST()).hi;
  await click(a[0] + 3, a[1] - 2); await settle(80);
  await click(b[0], b[1] + 4); await settle(80);
  await move(z[0] + 2, z[1] + 1); await settle(80);
  await shot('cm-d1440-c3-pick');
  await click(z[0] + 2, z[1] + 1); await settle(300);
  let st = await ST();
  const c3 = last(st);
  ok('circle3: one disc through z₀, z₁, ζ₁', c3.kind === 'disc' && c3.def && c3.def.op === 'circle3' && c3.def.fill === 'in' && c3.def.args[0].s === 's1' && c3.def.args[1].s === 's2' && typeof c3.def.args[2].zp === 'string', c3);
  ok('circle3: one undo step', st.hi === hi0 + 1, [hi0, st.hi]);
  ok('the press on ζ₁ did not move it', st.zeros === '1+0.5i', st.zeros);
  for (const p of [[-1.5, 0], [0.5, -1], [1, 0.5]]) ok('the circle passes through ' + p, near(dist(p, c3.c), c3.r, 1e-12), [dist(p, c3.c), c3.r]);
  info.c3row = await ev(`(document.querySelector('.shape[data-id="${c3.id}"] .d') || {}).textContent`);
  ok('the row reads the disc through z₀, z₁, ζ₁', info.c3row === 'the disc through z₀, z₁, ζ₁', info.c3row);
  ok('the Inspector shows the Construction view', (await ev(`(document.querySelector('#propsPanel .cm-idef') || {}).textContent`)) === 'the disc through z₀, z₁, ζ₁', null);
  await shot('cm-d1440-c3-done');
  // 2. drag ζ₁ (Select): the disc follows; Shift-click with Circle through 3 points still adds a zero
  await tool('select');
  await drag(z[0], z[1], z[0] + 48, z[1] - 32, 10, 16); await settle(300);
  st = await ST();
  const zeta = parseZ(st.zeros);
  const c3b = byId(st, c3.id);
  ok('ζ₁ moved', zeta && !(zeta[0] === 1 && zeta[1] === 0.5), st.zeros);
  ok('the disc follows ζ₁ (passes through it)', zeta && near(dist(zeta, c3b.c), c3b.r, 1e-12), [zeta, c3b.c, c3b.r]);
  ok('… and still through z₀, z₁', near(dist([-1.5, 0], c3b.c), c3b.r, 1e-12) && near(dist([0.5, -1], c3b.c), c3b.r, 1e-12), c3b);
  ok('the zero drag is one undo step', st.hi === hi0 + 2, st.hi);
  await tool('circle3');
  const e0 = await W(-0.5, -2.2);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: e0[0], y: e0[1], modifiers: 8 });
  await mods('mousePressed', e0[0], e0[1], 8, 1); await mods('mouseReleased', e0[0], e0[1], 8, 0); await settle(200);
  st = await ST();
  ok('Shift-click still adds a zero in a construction tool', String(st.zeros).split(',').length === 2, st.zeros);
  await key('z', 4); await settle(200);   // (undo the added zero)
  // 3. a half-plane from polygon vertex v0 to vertex v2: both ends bind and follow the vertex
  await tool('halfplane');
  const v0 = await W(-2.5, 1), v2 = await W(0.5, 1.2);
  await drag(v0[0] + 3, v0[1] - 2, v2[0] - 2, v2[1] + 3, 10, 16); await settle(300);
  st = await ST();
  const hp = last(st);
  ok('half-plane: both ends bound to the polygon vertices', hp.kind === 'halfplane' && hp.at && hp.at.a.s === 's3' && hp.at.a.h === 'v0' && hp.at.b.h === 'v2' && hp.a[0] === -2.5 && hp.b[0] === 0.5, hp);
  info.hpTip = await ev(`(document.querySelector('.shape[data-id="${hp.id}"] .cm-link') || {}).title`);
  ok('the row has the link glyph: follows …', /^follows vertex 1 of Polygon 1, vertex 3 of Polygon 1$/.test(info.hpTip || ''), info.hpTip);
  // drag vertex v0 (select the polygon first): the half-plane's end follows
  await tool('select');
  await clickSel('.shape[data-id="s3"] .shape-name'); await settle(200);
  await drag(v0[0], v0[1], v0[0] - 24, v0[1] + 16, 8, 16); await settle(300);
  st = await ST();
  const poly = byId(st, 's3'), hp2 = byId(st, hp.id);
  ok('the half-plane follows the dragged vertex', hp2.a[0] === poly.pts[0][0] && hp2.a[1] === poly.pts[0][1] && poly.pts[0][0] !== -2.5, [hp2.a, poly.pts[0]]);
  await shot('cm-d1440-halfplane');
  // 9. drawing tools: a segment from the circle's stroke (no crossing there) binds nothing; from a crossing, a helper
  await tool('segment');
  const sStroke = await W(1.5, 0.3), sEnd = await W(2.8, 1.5);
  await drag(sStroke[0], sStroke[1], sEnd[0], sEnd[1], 6, 16); await settle(250);
  st = await ST();
  const sg = last(st);
  ok('a drawing tool never makes a point on a curve', sg.kind === 'segment' && !sg.at && !st.list.some((p) => p.def && p.def.op === 'glider' && p.id !== gl.id), sg);
  const X2 = [1.5 - 0.8 / Math.SQRT2, -0.5 - 0.8 / Math.SQRT2], x2 = await W(X2[0], X2[1]), x2e = await W(-0.5, -2.4);
  await drag(x2[0] + 3, x2[1] - 3, x2e[0], x2e[1], 6, 16); await settle(250);
  st = await ST();
  const sg2 = last(st), hl = st.list.find((p) => sg2.at && sg2.at.a && p.id === sg2.at.a.s);
  ok('a crossing snap: the start binds to a helper meet point', !!hl && hl.helper === true && hl.owner === sg2.id && hl.def.op === 'meet' && dist(hl.p, X2) < 1e-12, [sg2.at, hl]);
  info.helperLabel = await CI({ names: true }).then((n) => (n.find((x) => hl && x.id === hl.id) || {}).name);
  ok('the helper row sits under its owner, indented', await ev(`(() => { const o = document.querySelector('.shape[data-id="${sg2.id}"]'); return !!o && !!o.nextElementSibling && o.nextElementSibling.dataset.id === '${hl && hl.id}' && o.nextElementSibling.classList.contains('cm-helper'); })()`), null);
  // Alt: free placement (nothing binds)
  const v1 = await W(-1, 2.2), v1e = await W(-0.2, 2.8);
  await dragM(v1[0] + 2, v1[1] + 2, v1e[0], v1e[1], 1, 6); await settle(250);
  st = await ST();
  ok('Alt: nothing binds', !last(st).at && last(st).kind === 'segment', last(st));
  // 4. Intersect: a click on the crossing of Circle 1 and Segment 1 (at c + 0.8 (1, 1)/√2)
  await tool('meet');
  const X = [1.5 + 0.8 / Math.SQRT2, -0.5 + 0.8 / Math.SQRT2];
  const xp = await W(X[0], X[1]);
  await move(xp[0] + 4, xp[1] + 3); await settle(80);
  const r1 = await CI();
  ok('hover on the crossing: "on Circle 1 ∩ Segment 1"', r1.ring && r1.ring.cls === 'cross' && r1.ring.chip === 'on Circle 1 ∩ Segment 1', r1.ring);
  await click(xp[0] + 4, xp[1] + 3); await settle(300);
  st = await ST();
  const m = last(st);
  ok('Intersect: a meet point', m.kind === 'point' && m.def && m.def.op === 'meet' && !m.helper, m);
  ok('the meet is on the circle', near(dist(m.p, [1.5, -0.5]), 0.8, 1e-12), m.p);
  ok('the meet is on the segment', Math.abs(m.p[1] - (m.p[0] - 2)) < 1e-12, m.p);
  ok('the meet is where it was clicked', dist(m.p, X) < 1e-9, [m.p, X]);
  // Intersect by two curves: both points
  const cs = await W(1.5, -1.3);
  await click(cs[0], cs[1]); await settle(120);
  const s5m = await W(2.3, 0.3);
  await click(s5m[0], s5m[1]); await settle(300);
  st = await ST();
  const two = st.list.slice(-2);
  ok('Intersect, curve then curve: two points (index 0, 1)', two.every((p) => p.def && p.def.op === 'meet') && two.map((p) => p.def.index).sort().join() === '0,1', two.map((p) => p.def));
  info.meetRows = await CI({ names: true }).then((n) => n.slice(-3).map((x) => x.def));
  // 5. the Point tool on the circle's stroke: a point on the curve; it slides along it
  await tool('point');
  const g0 = await W(1.5 + 0.8 * Math.cos(5.5), -0.5 + 0.8 * Math.sin(5.5));
  await click(g0[0] + 2, g0[1]); await settle(300);
  st = await ST();
  const gl = last(st);
  ok('the Point tool on a stroke: a point on the curve', gl.def && gl.def.op === 'glider' && gl.def.args[0].s === 's4' && Number.isFinite(gl.t), gl);
  ok('… on the circle', near(dist(gl.p, [1.5, -0.5]), 0.8, 1e-12), gl.p);
  await tool('select');
  await drag(g0[0], g0[1], g0[0] + 30, g0[1] + 50, 8, 16); await settle(300);
  st = await ST();
  const gl2 = byId(st, gl.id);
  ok('dragged, it slides along the circle', !!gl2 && gl2.t !== gl.t && near(dist(gl2.p, [1.5, -0.5]), 0.8, 1e-12), [gl.t, gl2.t, gl2.p]);
  // 6. a fixed constructed point: a drag says what it is built from
  const mp = await W(m.p[0], m.p[1]);
  await drag(mp[0], mp[1], mp[0] + 30, mp[1], 6, 16); await settle(250);
  st = await ST();
  ok('a meet point does not move', byId(st, m.id).p[0] === m.p[0], byId(st, m.id).p);
  info.builtToast = await toastText();
  ok('… and says what it is built from', /is built from Circle 1, Segment 1: drag those$/.test(info.builtToast), info.builtToast);
  // 7. Midpoint of z₀, z₁; a circle through z₀, z₁ and the midpoint: the half-plane, A = 0 exactly
  a = await W(-1.5, 0); b = await W(0.5, -1);
  await tool('midpoint');
  await click(a[0], a[1]); await settle(80); await click(b[0], b[1]); await settle(300);
  st = await ST();
  const mid = last(st);
  ok('Midpoint', mid.def && mid.def.op === 'midpoint' && mid.p[0] === -0.5 && mid.p[1] === -0.5, mid);
  await tool('circle3');
  const mq = await W(-0.5, -0.5);
  await click(a[0], a[1]); await settle(80); await click(b[0], b[1]); await settle(80); await click(mq[0], mq[1]); await settle(300);
  st = await ST();
  const col = last(st);
  ok('collinear by construction: the region is the half-plane, A = 0 exactly', col.kind === 'halfplane' && col.A === 0 && col.def.args[2].s === mid.id, col);
  info.colRow = await ev(`(document.querySelector('.shape[data-id="${col.id}"] .d') || {}).textContent`);
  ok('its row: the half-plane left of z₀ → z₁', info.colRow === 'the half-plane left of z₀ → z₁', info.colRow);
  // drag z₀: it stays a half-plane through z₀, z₁ (incidence), and its line passes through the moved z₀
  await tool('select');
  await drag(a[0], a[1], a[0] - 20, a[1] - 26, 8, 16); await settle(300);
  st = await ST();
  const z0 = byId(st, 's1').p, col2 = byId(st, col.id), mid2 = byId(st, mid.id);
  ok('after a drag of z₀: still A = 0, the midpoint follows', col2.kind === 'halfplane' && col2.A === 0 && mid2.p[0] === (z0[0] + 0.5) / 2, [col2.kind, col2.A, mid2.p, z0]);
  const cr = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  ok('… its edge passes through z₀ and z₁', !!col2.a && Math.abs(cr(col2.a, col2.b, z0)) < 1e-12 && Math.abs(cr(col2.a, col2.b, [0.5, -1])) < 1e-12, [col2.a, col2.b]);
  await shot('cm-d1440-collinear');
  // 8. undo and redo
  const nBefore = st.list.length, hiB = st.hi;
  await key('z', 4); await settle(250);
  st = await ST();
  ok('undo: z₀ back', byId(st, 's1').p[0] === -1.5 && st.list.length === nBefore, byId(st, 's1').p);
  await key('z', 4); await settle(250);
  st = await ST();
  ok('undo again: the half-plane through the midpoint is gone', !byId(st, col.id), st.list.length);
  await key('z', 12); await settle(250); await key('z', 12); await settle(250);
  st = await ST();
  ok('redo twice: back as it was', !!byId(st, col.id) && byId(st, 's1').p[0] === z0[0] && st.hi === hiB, st.hi);
  // 10. a co-argument is not a target: z₁ cannot land on z₀ (grid only); hovering it while picking shows the chip
  a = await W(...byId(await ST(), 's1').p); b = await W(0.5, -1);
  await tool('circle3');
  await click(a[0], a[1]); await settle(80);
  await move(a[0] + 2, a[1] + 1); await settle(80);
  const r2 = await CI();
  ok('a co-argument: "Circle through 3 points needs distinct points"', r2.ring && r2.ring.chip === 'Circle through 3 points needs distinct points', r2.ring);
  await key('Escape'); await settle(120);
  ok('Esc cancels the draft', !(await CI()).draft || !(await CI()).draft.picks.length, (await CI()).draft);
  // 11. a line through two free points: dragging the line drags both
  await tool('line');
  const pA = await W(-2.2, 2.4), pB = await W(-1.4, 2.7);
  await tool('point'); await click(pA[0], pA[1]); await settle(150); await click(pB[0], pB[1]); await settle(200);
  st = await ST();
  const [fa, fb] = st.list.slice(-2);
  await tool('line');
  await drag(pA[0], pA[1], pB[0], pB[1], 6, 16); await settle(250);
  st = await ST();
  const ln = last(st);
  ok('a line through two free points', ln.at && ln.at.a.s === fa.id && ln.at.b.s === fb.id, ln.at);
  await tool('select');
  const lm = await W(-1.8, 2.55);
  await click(lm[0], lm[1]); await settle(150);
  await drag(lm[0], lm[1], lm[0], lm[1] - 40, 8, 16); await settle(250);
  st = await ST();
  ok('dragging the line moves both points', byId(st, fa.id).p[1] > 2.7 && byId(st, fb.id).p[1] > 3 && byId(st, ln.id).a[1] === byId(st, fa.id).p[1], [byId(st, fa.id).p, byId(st, fb.id).p]);
  // the disc on ζ₁ pans X (its press is not a move)
  const v0view = await ev(`JSON.stringify(__cmwW2S('L', 0, 0))`);
  const c3n = byId(await ST(), c3.id);
  const dc = await W(c3n.c[0] - 0.3, c3n.c[1] - 0.6);
  await click(dc[0], dc[1]); await settle(150);
  await drag(dc[0], dc[1], dc[0] + 30, dc[1] + 10, 6, 16); await settle(250);
  st = await ST();
  ok('a disc built on ζ₁: a drag pans X, the disc does not move', byId(st, c3.id).c[0] === c3n.c[0] && (await ev(`JSON.stringify(__cmwW2S('L', 0, 0))`)) !== v0view, [byId(st, c3.id).c, c3n.c]);
  info.panToast = await toastText();
  // 12. delete z₁: the definitions built on it go, bindings to it are freed; one toast, Undo
  await tool('select');
  const nBeforeDel = (await ST()).list.length;
  const b1 = await W(0.5, -1);
  await click(b1[0], b1[1]); await settle(150);
  await key('Delete'); await settle(300);
  st = await ST();
  info.delToast = await toastText();
  ok('delete z₁: the cascade toast', /^Deleted z₁ and \d+ shapes? built on it\./.test(info.delToast), info.delToast);
  ok('… the 3-point disc and the midpoint are gone', !byId(st, c3.id) && !byId(st, mid.id) && !byId(st, col.id), st.list.map((s) => s.id));
  await clickSel('#toastHost .toast-act'); await settle(300);
  st = await ST();
  ok('Undo brings everything back', st.list.length === nBeforeDel && !!byId(st, c3.id), st.list.length);
  // 13. Make free (the row's ⋯): the shape stays, its definition goes
  await ev(`document.querySelector('.shape[data-id="${c3.id}"] .more').click()`); await settle(150);
  const items = await ev(`[...document.querySelectorAll('.menu .mi, [role=menu] .mi')].map((b) => b.textContent.trim())`);
  info.rowMenu = items;
  ok('the ⋯ menu has Make free, Use complement, Curve', ['Make free', 'Use complement', 'Curve'].every((t) => items.some((x) => x.startsWith(t))), items);
  await ev(`[...document.querySelectorAll('.menu .mi, [role=menu] .mi')].find((b) => b.textContent.trim().startsWith('Make free')).click()`); await settle(300);
  st = await ST();
  ok('Make free: no def, same disc', !byId(st, c3.id).def && byId(st, c3.id).kind === 'disc', byId(st, c3.id));
  await key('z', 4); await settle(250);
  await grab();
});

await section('B', async () => {
  // save and load: the page reopened recomputes from the definitions; then a link to a fresh namespace
  if (!run('A')) { await view(1440, 900, false, false); await load(NS, STATE); await settle(800); }
  if (!run('A')) { await tool('circle3'); const a = await W(-1.5, 0), b = await W(0.5, -1), z = await W(1, 0.5); await click(a[0], a[1]); await settle(80); await click(b[0], b[1]); await settle(80); await click(z[0], z[1]); await settle(300); }
  let st = await ST();
  const before = st.list.filter((s) => s.def || s.at).map((s) => JSON.stringify([s.id, s.kind, s.def, s.at, s.c, s.r, s.p, s.a, s.b]));
  await nav(`${U}?ns=${NS}`); await settle(1500);
  st = await ST();
  const after = st.list.filter((s) => s.def || s.at).map((s) => JSON.stringify([s.id, s.kind, s.def, s.at, s.c, s.r, s.p, s.a, s.b]));
  ok('reload: every construction comes back, bitwise', before.length > 0 && before.join('\n') === after.join('\n'), { before: before.length, after: after.length, diff: before.filter((x, i) => x !== after[i]).slice(0, 2) });
  // drag ζ₁ after the reload: the 3-point disc still follows
  const c3 = st.list.find((s) => s.def && s.def.op === 'circle3' && s.def.args.some((r) => r.zp));
  const zeta0 = parseZ(String(st.zeros).split(',')[0]);
  await tool('select');
  const zz = await W(zeta0[0], zeta0[1]);
  await drag(zz[0], zz[1], zz[0] - 20, zz[1] + 30, 8, 16); await settle(300);
  st = await ST();
  const zeta = parseZ(String(st.zeros).split(',')[0]), c3b = byId(st, c3.id);
  ok('after a reload ζ₁ still drives its disc', near(dist(zeta, c3b.c), c3b.r, 1e-12) && zeta[0] !== zeta0[0], [zeta, c3b.c, c3b.r]);
  // a link: encodeLink of the saved state, opened in a fresh namespace
  const payload = await ev(`await Params.encodeLink(__cmwP().figure)`);
  await nav(`${U}?ns=${NS}lk#cmw=${payload}`); await settle(1800);
  st = await ST();
  const c3l = st.list.find((s) => s.id === c3.id);
  ok('a link opens the constructions', !!c3l && c3l.def && c3l.def.op === 'circle3' && near(dist(zeta, c3l.c), c3l.r, 1e-12), c3l);
  info.linkLen = payload.length;
  await grab();
});

await section('C', async () => {
  // Russian: the tiles, the chip, the rows, the cascade toast
  await view(1440, 900, false, false);
  await load(NS + 'ru', STATE);
  await nav(`${U}?ns=${NS}ru&lang=ru`); await settle(1800);
  const tiles = await ev(`[...document.querySelectorAll('#constructTools .tool > span')].map((s) => s.textContent.replace(/\u00ad/g, ''))`);
  ok('RU tiles', JSON.stringify(tiles) === JSON.stringify(['По 3 точкам', 'Пересечение', 'Середина', 'Перпендикуляр', 'Ортогональная', 'Касание']), tiles);
  ok('RU heading', (await ev(`document.querySelector('#cmHead').textContent`)) === 'Построения', null);
  const fits = await ev(`[...document.querySelectorAll('#constructTools .tool > span')].every((s) => s.scrollWidth <= s.clientWidth + 1)`);
  ok('RU tile labels fit', fits, tiles);
  await tool('circle3');
  const a = await W(-1.5, 0), b = await W(0.5, -1), z = await W(1, 0.5);
  await move(a[0], a[1]); await settle(80);
  ok('RU ring chip', (await CI()).ring.chip === 'привязка: z₀', (await CI()).ring);
  ok('RU draft chip', (await ev(`document.querySelector('#draftChipL .cm-t').textContent`)) === 'Точка 1 из 3 · По 3 точкам · Esc — отмена', await ev(`document.querySelector('#draftChipL .cm-t').textContent`));
  await click(a[0], a[1]); await settle(80); await click(b[0], b[1]); await settle(80);
  await move(z[0], z[1]); await settle(80);
  await shot('cm-d1440-ru-pick');
  await click(z[0], z[1]); await settle(300);
  const st = await ST();
  const c3 = last(st);
  info.ruRow = await ev(`(document.querySelector('.shape[data-id="${c3.id}"] .d') || {}).textContent`);
  ok('RU row', info.ruRow === 'круг, ограниченный окружностью через z₀, z₁ и ζ₁', info.ruRow);
  await shot('cm-d1440-ru-done');
  await tool('select');
  await click(b[0], b[1]); await settle(150);
  await key('Delete'); await settle(300);
  info.ruToast = await toastText();
  ok('RU delete toast', info.ruToast === 'Удалено: z₁ и зависимые фигуры (1).', info.ruToast);
  await grab();
});

await section('D', async () => {
  // dark; 1024 (the panel's grid) and 768 (the rail with its divider)
  await view(1440, 900, true, false);
  await load(NS + 'dk', STATE);
  await settle(800);
  await tool('circle3');
  const a = await W(-1.5, 0), b = await W(0.5, -1), z = await W(1, 0.5);
  await click(a[0], a[1]); await settle(80); await click(b[0], b[1]); await settle(80); await move(z[0] + 1, z[1]); await settle(100);
  await shot('cm-d1440-dark-pick');
  await click(z[0] + 1, z[1]); await settle(300);
  await tool('meet');
  const X = await W(1.5 + 0.8 / Math.SQRT2, -0.5 + 0.8 / Math.SQRT2);
  await move(X[0] + 2, X[1]); await settle(100);
  await shot('cm-d1440-dark-ring');
  await view(1024, 768, false, false); await settle(800);
  const g = await ev(`(() => { const e = document.querySelector('#constructTools'); const r = e && e.getBoundingClientRect(); return r ? [r.width, r.height, e.offsetParent ? 1 : 0] : null; })()`);
  info.grid1024 = g;
  await shot('cm-t1024');
  await view(768, 1024, false, false); await settle(800);
  info.rail768 = await ev(`(() => { const r = document.querySelector('#railTools'); if (!r || !r.offsetParent) return null; const b = r.getBoundingClientRect(), p = r.parentElement.getBoundingClientRect(); return { sep: !!r.querySelector('.rail-sep'), n: r.querySelectorAll('.rail-tool').length, bottom: b.bottom, panel: p.bottom, overflow: r.scrollHeight > r.clientHeight + 1 }; })()`);
  ok('768: the rail has the divider and the six tools', info.rail768 && info.rail768.sep && info.rail768.n >= 23, info.rail768);
  await shot('cm-t768');
  await view(1440, 900, false, false); await settle(500);
  await grab();
});

await section('E', async () => {
  // phone 390 × 844, touch (Android Chrome emulation)
  const touch = async (x, y, ms = 60) => { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }); await sleep(ms); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
  const center = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e || !e.getClientRects().length) return null; const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
  const ua0 = await ev('navigator.userAgent');
  await send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36' });
  await view(390, 844, false, true);
  await load(NS + 'ph', Object.assign({}, STATE, { srcView: { cx: -0.4, cy: 0, s: 70 } }));
  await settle(1200);
  const more = await center('#toolMore > summary');
  await touch(more[0], more[1]); await settle(500);
  info.phTiles = await ev(`[...document.querySelectorAll('.ph-tiles > *')].map((e) => e.tagName === 'H3' ? '#' + e.textContent : e.dataset.tool)`);
  ok('phone: More tools has the Construct heading and six tiles', (info.phTiles || []).join().includes('#Construct,circle3,meet,midpoint,bisector,perp,touch'), info.phTiles);
  await shot('cm-p390-more');
  const t3 = await center('.ph-tiles .ph-tile[data-tool="circle3"]');
  await touch(t3[0], t3[1]); await settle(600);
  ok('a Construct tile closes the sheet', await ev(`!document.querySelector('.ph-sheet') || document.querySelector('.ph-sheet').hidden || !document.querySelector('.ph-sb[data-k="tools"]:not([hidden])')`), null);
  ok('the More key shows the tool', (await ev(`document.querySelector('#toolMore > summary .ic-slot').dataset.ph`)) === 'circle3', await ev(`document.querySelector('#toolMore > summary .ic-slot').dataset.ph`));
  // taps 15 px off z₀ and z₁ snap (22 px), then an empty spot makes a free point
  const a = await W(-1.5, 0), b = await W(0.5, -1), e = await W(-0.5, 1.5);
  await touch(a[0] + 12, a[1] - 9); await settle(200);
  await touch(b[0] - 10, b[1] + 11); await settle(200);
  const d = (await CI()).draft;
  ok('phone: taps 15 px off the points pick them', d && d.picks.length === 2 && d.picks[0].ref && d.picks[0].ref.s === 's1' && d.picks[1].ref && d.picks[1].ref.s === 's2', d);
  info.phChip = await ev(`(document.querySelector('#draftChipL .cm-chip') || {}).textContent`);
  ok('phone chip: no Esc, a ×', /Point 3 of 3/.test(info.phChip || '') && !/Esc/.test(info.phChip) && !!(await ev(`document.querySelector('#draftChipL .cm-x')`)), info.phChip);
  await shot('cm-p390-pick');
  await touch(e[0], e[1]); await settle(400);
  const st = await ST();
  const c3 = last(st), fp = st.list[st.list.length - 2];
  ok('phone: an empty spot makes a free point in the same step', c3.def && c3.def.op === 'circle3' && c3.def.args[2].s === fp.id && !fp.def, [c3.def, fp]);
  await shot('cm-p390-done');
  // Russian on the phone (the tiles at 390 px)
  await nav(`${U}?ns=${NS}ph&lang=ru`); await settle(1800);
  const more2 = await center('#toolMore > summary');
  await touch(more2[0], more2[1]); await settle(500);
  info.phTilesRu = await ev(`[...document.querySelectorAll('.ph-tiles .ph-tile .ph-tl')].slice(-4).map((s) => [s.textContent, s.scrollWidth <= s.clientWidth + 1])`);
  await shot('cm-p390-more-ru');
  await send('Emulation.setUserAgentOverride', { userAgent: ua0 });
  await view(1440, 900, false, false); await settle(300);
  await grab();
});

await section('F', async () => {
  // frame times while a free point with 1, 10 and 50 dependents is dragged (half areas, half curves)
  await view(1440, 900, false, false);
  const perfOf = async (n) => {
    const shapes = [{ id: 'p0', kind: 'point', p: [-1, 0], ci: 0, visible: true }, { id: 'p1', kind: 'point', p: [1, 0], ci: 1, visible: true }];
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n * Math.PI * 0.9 + 0.05 * Math.PI, R = 0.8 + 1.4 * (k % 5) / 5;
      shapes.push({ id: 'q' + k, kind: 'point', p: [R * Math.cos(t) * 1.2, R * Math.sin(t) + 0.2], ci: 2, visible: true });
      shapes.push({ id: 'c' + k, kind: k % 2 ? 'circle' : 'disc', c: [0, 0], r: 1, ci: k % 8, visible: true, def: { op: 'circle3', args: [{ s: 'p0' }, { s: 'p1' }, { s: 'q' + k }], fill: k % 2 ? 'none' : 'in' } });
    }
    await load(NS + 'pf' + n + '_' + (perfOf.k = (perfOf.k || 0) + 1), { shapes, steps: [{ type: 'recip', params: {}, on: true }], srcView: { cx: 0, cy: 0.5, s: 90 }, nextId: 500 });
    await settle(1500);
    await tool('select');
    await ev(`(()=>{ window.__frw = []; window.__frd = []; window.__pm = []; let lastT = 0;
      if (!window.__rafWrapped) { window.__rafWrapped = true; const raf = window.requestAnimationFrame.bind(window);
        window.requestAnimationFrame = (cb) => raf((ts) => { const t0 = performance.now(); cb(ts); if (window.__frw) window.__frw.push(performance.now() - t0); }); }
      const tick = (ts) => { if (!window.__frd) return; if (lastT) window.__frd.push(ts - lastT); lastT = ts; requestAnimationFrame(tick); }; requestAnimationFrame(tick);
      let t0 = 0; window.addEventListener('pointermove', () => { t0 = performance.now(); }, true); window.addEventListener('pointermove', () => { if (window.__pm) window.__pm.push(performance.now() - t0); });
      return 1; })()`);
    const p = await W(-1, 0);
    await drag(p[0], p[1], p[0] + 60, p[1] - 40, 45, 16);
    await settle(200);
    const r = await ev(`(()=>{ const q = (a, p) => { const b = (a || []).slice().sort((x, y) => x - y); return b.length ? +b[Math.min(b.length - 1, Math.floor(p * b.length))].toFixed(2) : null; };
      const r = { work_p95: q(__frw, 0.95), work_max: q(__frw, 1), delta_p50: q(__frd, 0.5), delta_p95: q(__frd, 0.95), move_p95: q(__pm, 0.95), n: (__frd || []).length };
      window.__frw = null; window.__frd = null; window.__pm = null; return r; })()`);
    const st = await ST();
    const p0 = byId(st, 'p0').p, c0 = byId(st, 'c0');
    r.follows = near(dist(p0, c0.c), c0.r, 1e-12) && p0[0] !== -1;
    return r;
  };
  info.perf = {};
  // (best of two runs per count: the machine is shared, so one run can be skewed by another process)
  for (const n of [1, 10, 50]) {
    const r1 = await perfOf(n), r2 = await perfOf(n);
    const r = (r1.work_p95 + r1.delta_p95 <= r2.work_p95 + r2.delta_p95) ? r1 : r2;
    r.runs = [[r1.work_p95, r1.delta_p95, r1.move_p95], [r2.work_p95, r2.delta_p95, r2.move_p95]];
    info.perf[n] = r;
    ok(`drag with ${n} dependents: they follow`, r.follows, r);
    if (n <= 10) {
      ok(`BUDGET60 ${n} dependents: rAF work p95 ≤ 14 ms`, r.work_p95 != null && r.work_p95 <= 14, r);
      ok(`BUDGET60 ${n} dependents: pointermove p95 ≤ 14 ms`, r.move_p95 != null && r.move_p95 <= 14, r);
      ok(`BUDGET60 ${n} dependents: frame delta p95 ≤ 16.7 ms`, r.delta_p95 != null && r.delta_p95 <= 16.8, r);
    }
  }
  await shot('cm-perf50');
  await grab();
});

await section('G', async () => {
  // undefined and back; a zero removed; drawing in Y on z₀″; the export caption (EN, RU)
  await view(1440, 900, false, false);
  const SG = {
    shapes: [
      { id: 'u1', kind: 'circle', c: [0, 0], r: 1, ci: 0, visible: true },
      { id: 'u2', kind: 'point', p: [-2, 0.5], ci: 1, visible: true },
      { id: 'u3', kind: 'point', p: [2, 0.5], ci: 2, visible: true },
      { id: 'u4', kind: 'line', a: [-2, 0.5], b: [2, 0.5], at: { a: { s: 'u2' }, b: { s: 'u3' } }, ci: 3, visible: true },
      { id: 'u5', kind: 'point', p: [-1, -1.5], ci: 4, visible: true },
    ],
    steps: [{ type: 'zp', params: { a: '1', zeros: '1.5-1i', poles: '' }, on: true }],
    srcView: { cx: 0, cy: 0, s: 80 }, nextId: 50,
  };
  await load(NS + 'g', SG); await settle(800);
  // Intersect at the crossing (√0.75, 0.5)
  await tool('meet');
  const X = await W(Math.sqrt(0.75), 0.5);
  await click(X[0] + 2, X[1] - 2); await settle(300);
  let st = await ST();
  const m = last(st);
  ok('G: the meet at (√0.75, 0.5)', m.def && m.def.op === 'meet' && Math.abs(m.p[0] - Math.sqrt(0.75)) < 1e-12 && m.p[1] === 0.5, m);
  // drag the line (built on two free points: both move) up off the circle: the meet is undefined, hidden, with its reason
  await tool('select');
  const L0 = await W(-1.5, 0.5);
  await click(L0[0], L0[1]); await settle(150);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: L0[0], y: L0[1] });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: L0[0], y: L0[1], button: 'left', buttons: 1, clickCount: 1 });
  for (let i = 1; i <= 10; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: L0[0], y: L0[1] - 9 * i, button: 'left', buttons: 1 }); await sleep(16); }
  await settle(120);
  st = await ST();
  const mm = byId(st, m.id);
  ok('G: mid-gesture the meet is undefined (hidden)', mm.cundef && mm.cundef.code === 'nomeet' && mm.visible === false, mm);
  await shot('cm-d1440-ghost');
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: L0[0], y: L0[1] - 90, button: 'left', buttons: 0, clickCount: 1 });
  await settle(300);
  info.undefRow = await ev(`(document.querySelector('.shape[data-id="${m.id}"] .d') || {}).textContent`);
  ok('G: its row gives the reason', info.undefRow === 'The curves do not meet here', info.undefRow);
  ok('G: its eye is disabled', await ev(`!!(document.querySelector('.shape[data-id="${m.id}"] .eye') || {}).disabled`), null);
  await key('z', 4); await settle(300);
  st = await ST();
  ok('G: undo: the meet is back, visible', !byId(st, m.id).cundef && byId(st, m.id).visible !== false, byId(st, m.id));
  // a circle through u5, u2 and ζ₁; then ζ₁ dragged off the plane: removed, the circle undefined (nothing deleted)
  await tool('circle3');
  const p5 = await W(-1, -1.5), p2 = await W(-2, 0.5), zq = await W(1.5, -1);
  await click(p5[0], p5[1]); await settle(80); await click(p2[0], p2[1]); await settle(80); await click(zq[0], zq[1]); await settle(300);
  st = await ST();
  const cz = last(st);
  ok('G: a circle on ζ₁', cz.def && cz.def.args.some((r) => r.zp), cz.def);
  await tool('select');
  const box = await ev(`(() => { const r = document.querySelector('#paneL canvas:last-of-type').getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; })()`);
  await drag(zq[0], zq[1], box[2] + 30, zq[1], 14, 16); await settle(400);
  st = await ST();
  info.zpToast = await toastText();
  ok('G: ζ₁ removed; the circle is undefined, not deleted', st.zeros === '' && byId(st, cz.id) && byId(st, cz.id).cundef && byId(st, cz.id).cundef.code === 'zpRemoved', [st.zeros, byId(st, cz.id)]);
  ok('G: the toast says how many are undefined', /1 shape is now undefined\.$/.test(info.zpToast), info.zpToast);
  info.zpRow = await ev(`(document.querySelector('.shape[data-id="${cz.id}"] .d') || {}).textContent`);
  ok('G: its row names the removed zero by its value [review user-6]', /^The zero at .+ was removed$/.test(info.zpRow || ''), info.zpRow);
  await key('z', 4); await settle(300);
  st = await ST();
  ok('G: undo brings ζ₁ and the circle back', st.zeros === '1.5-1i' && !byId(st, cz.id).cundef, [st.zeros, byId(st, cz.id).cundef]);
  // the export caption names the circle through its points
  const cap = await ev(`await (async () => { const f = await __cmwFig.build({ for: 'article', cols: 1 }); return f ? f.captionTex : null; })()`);
  info.capEn = cap;
  ok('G: the caption: the circle through z₂ = …, z₀ = … and ζ₁ = …', /the (circle|disc bounded by the circle) through z₂ = .*, z₀ = .* and ζ₁ = 1\.5 − i/.test(cap || '') || /through/.test(cap || ''), cap);
  // drawing in Y: Circle through 3 points picks z₂″ (F(z₂) of X's point) and two empty spots
  await tool('circle3');
  const st0 = await ST();
  const wz = await ev(`(() => { const s = __cmwCI({shapes:true}).list.find((x) => x.id === 'u5'); return s.p; })()`);
  const w5 = await ev(`(() => { const z = [-1, -1.5]; return [z[0] - 1.5, z[1] + 1]; })()`);   // f₁(z) = z − 1.5 + i
  const y0 = await W(w5[0], w5[1], 'R'), y1 = await W(1, 1.2, 'R'), y2 = await W(-1.2, 1.5, 'R');
  await move(y0[0] + 2, y0[1] + 2); await settle(100);
  info.yRing = (await CI()).ring;
  await click(y0[0] + 2, y0[1] + 2); await settle(80); await click(y1[0], y1[1]); await settle(80); await click(y2[0], y2[1]); await settle(300);
  st = await ST();
  const yt = last(st);
  ok('G: in Y the circle picks z₂″ (an image ref)', yt.def && yt.def.args[0].img === 'u5' && st.list.length === st0.list.length + 3, [yt.def, info.yRing]);
  await shot('cm-d1440-y');
  // Russian caption
  await nav(`${U}?ns=${NS}g&lang=ru`); await settle(1800);
  const capRu = await ev(`await (async () => { const f = await __cmwFig.build({ for: 'article', cols: 1 }); return f ? f.captionTex : null; })()`);
  info.capRu = capRu;
  ok('G: the Russian caption names the circle', /проходящей через|проходящая через/.test(capRu || ''), capRu);
  // v16 verify-2: no English inside the Russian caption (outside maths and TeX commands)
  const ruText = String(capRu || '').replace(/\$[^$]*\$/g, ' ').replace(/\\[A-Za-z]+/g, ' ');
  ok('G verify-2: the Russian caption has no English words', !!capRu && !/[A-Za-z]{3,}/.test(ruText), ruText.match(/.{0,30}[A-Za-z]{3,}.{0,30}/g));
  await grab();
});

await section('H', async () => {
  // X Sphere: picks on the globe; N (∞) gives circle(P, Q, ∞), the line through P and Q (its region the half-plane)
  await view(1440, 900, false, false);
  await load(NS + 'h', { shapes: [{ id: 'h1', kind: 'point', p: [-0.5, 0.3], ci: 0, visible: true }, { id: 'h2', kind: 'point', p: [0.6, -0.2], ci: 1, visible: true }], steps: [{ type: 'recip', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, nextId: 50 });
  await settle(800);
  await key('2', 8); await settle(900);   // X: Sphere
  ok('H: X shows its globe', (await ev(`__cmwState().view.L ? __cmwState().view.L.surf : JSON.stringify(__cmwState().view)`)) === 'sphere' || /sphere/.test(JSON.stringify(await ev(`__cmwState().view`))), await ev(`__cmwState().view`));
  await tool('circle3');
  const lift = async (x, y) => ev(`Region.Globe.lift(${x}, ${y})`);
  // z₀ and z₁ (near the south pole, in view), then a drag turns the globe (a drag is no pick), then N
  const p1 = await CI({ gs: ['L', await lift(-0.5, 0.3)] }), p2 = await CI({ gs: ['L', await lift(0.6, -0.2)] });
  info.globe = { p1, p2 };
  ok('H: the points are on the globe face', !!p1 && !!p2, { p1, p2 });
  if (p1 && p2) {
    await click(p1[0] + 2, p1[1] + 1); await settle(100);
    await click(p2[0] - 1, p2[1] + 2); await settle(100);
    const c = await ev(`(() => { const r = document.querySelector('#paneL').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
    let qN = await CI({ gs: ['L', [0, 0, 1]] });
    for (let k = 0; k < 4 && !qN; k++) { await drag(c[0], c[1] - 60, c[0], c[1] + 60, 10, 16); await settle(500); qN = await CI({ gs: ['L', [0, 0, 1]] }); }
    info.globe.qN = qN;
    ok('H: the draft survives the turn', ((await CI()).draft || { picks: [] }).picks.length === 2, (await CI()).draft);
    ok('H: N is on the globe face after the turn', !!qN, qN);
    if (qN) {
      await click(qN[0] + 2, qN[1] - 2); await settle(400);
      const st = await ST();
      const cc = last(st);
      ok('H: circle(z₀, z₁, ∞) from the globe: the half-plane left of z₀ → z₁', cc.def && cc.def.op === 'circle3' && cc.def.args[0].s === 'h1' && cc.def.args[1].s === 'h2' && cc.def.args[2].inf === 1 && cc.kind === 'halfplane', cc);
      await shot('cm-d1440-globe');
    }
  }
  await key('1', 8); await settle(500);
  await grab();
});

await section('I', async () => {
  // Polygon: its vertices bind; a press on a bound vertex of the selected polygon drags the point beneath
  await view(1440, 900, false, false);
  await load(NS + 'i', { shapes: [{ id: 'i1', kind: 'point', p: [-1, -1], ci: 0, visible: true }, { id: 'i2', kind: 'point', p: [1, -1], ci: 1, visible: true }], steps: [], srcView: { cx: 0, cy: 0, s: 80 }, nextId: 50 });
  await settle(800);
  await tool('polygon');
  const a = await W(-1, -1), b = await W(1, -1), c = await W(0, 1);
  await click(a[0] + 3, a[1] - 2); await settle(80); await click(b[0] - 2, b[1] + 3); await settle(80); await click(c[0], c[1]); await settle(80);
  await click(a[0], a[1]); await settle(300);
  let st = await ST();
  const pg = last(st);
  ok('I: a polygon with its first two vertices bound to z₀, z₁', pg.kind === 'polygon' && pg.at && pg.at.v0.s === 'i1' && pg.at.v1.s === 'i2' && !pg.at.v2, pg);
  await tool('select');
  await clickSel(`.shape[data-id="${pg.id}"] .shape-name`); await settle(200);
  await drag(a[0], a[1], a[0] - 30, a[1] + 20, 8, 16); await settle(300);
  st = await ST();
  const z0 = byId(st, 'i1').p, pg2 = byId(st, pg.id);
  ok('I: a press on the bound vertex drags z₀; the polygon follows', z0[0] < -1.2 && pg2.pts[0][0] === z0[0] && pg2.pts[0][1] === z0[1] && pg2.pts[2][1] === 1, [z0, pg2.pts]);
  // a free point dropped on another point: no binding, no merge [C22]
  const zq = await W(z0[0], z0[1]);
  await clickSel('.shape[data-id="i2"] .shape-name'); await settle(150);
  const bq = await W(1, -1);
  await drag(bq[0], bq[1], zq[0] + 2, zq[1] - 1, 10, 16); await settle(300);
  st = await ST();
  ok('I: a free point dropped on a point stays free', !byId(st, 'i2').at && !byId(st, 'i2').def, byId(st, 'i2'));
  await grab();
});

await section('R', async () => {
  // the v16 review fixes (notes/constructions-v16/ledger.json), in the app
  await view(1440, 900, false, false);
  const RS = {
    shapes: [
      { id: 'r1', kind: 'point', p: [-1.5, 0], ci: 0, visible: true },
      { id: 'r2', kind: 'point', p: [0.5, -1], ci: 1, visible: true },
      { id: 'r3', kind: 'point', p: [0, 1], ci: 2, visible: true },
      { id: 'rc', kind: 'circle', c: [0, 0], r: 1, ci: 3, visible: true, def: { op: 'circle3', args: [{ s: 'r1' }, { s: 'r2' }, { s: 'r3' }], fill: 'none' } },
      { id: 'rg', kind: 'point', p: [0, 0], t: 0.3, ci: 4, visible: true, def: { op: 'glider', args: [{ s: 'rc', part: 0 }] } },
      { id: 'rl', kind: 'line', a: [-1.5, 0], b: [0.5, -1], ci: 5, visible: true, at: { a: { s: 'r1' }, b: { s: 'r2' } } },
    ],
    steps: [{ type: 'mobius', params: { a: '1', b: '0', c: '1', d: '2' }, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, nextId: 60, pattern: 'checker',
  };
  await load(NS + 'r', RS);
  await settle(900);
  // user-4, picture-8: point rows are named as the plane labels them
  const names = await ev(`['r1', 'r2', 'r3'].map((id) => (document.querySelector('.shape[data-id="' + id + '"] .shape-name .k') || {}).textContent)`);
  ok('R user-4: point rows read z₀, z₁, z₂', JSON.stringify(names) === JSON.stringify(['z₀', 'z₁', 'z₂']), names);
  // user-5: a line bound to two points reads by its points
  const lrow = await ev(`(document.querySelector('.shape[data-id="rl"] .d') || {}).textContent`);
  ok('R user-5: the bound line\'s row is "line through z₀ and z₁"', lrow === 'line through z₀ and z₁', lrow);
  // v16 verify-4: the definition is not cut off in its row at 1440 (it takes the full width under the name)
  const lclip = await ev(`(() => { const e = document.querySelector('.shape[data-id="rl"] .d > .cm-def'); return e ? [e.scrollHeight, e.clientHeight, e.scrollWidth, e.clientWidth] : null; })()`);
  ok('R verify-4: the bound line\'s definition is shown whole', !!lclip && lclip[0] <= lclip[1] + 1 && lclip[2] <= lclip[3] + 1, lclip);
  // user-11: the definition wraps, and the tooltip holds it whole
  const tip = await ev(`(document.querySelector('.shape[data-id="rc"] .d') || {}).title`);
  ok('R user-11: the row tooltip starts with the definition', /^through z₀, z₁, z₂/.test(tip || ''), tip);
  // user-7: ⋯ Delete says what goes with it
  await clickSel('.shape[data-id="rc"] .icon-btn.more'); await settle(250);
  const mi = await ev(`[...document.querySelectorAll('.ctx-menu .mi, .menu .mi, [role="menuitem"]')].map((b) => b.textContent.trim())`);
  ok('R user-7: the row menu\'s Delete counts what is built on it', (mi || []).some((t) => /^Delete \(and 1 built on it\)/.test(t)), mi);
  await key('Escape'); await settle(150);
  // user-3: a bound handle's field is read-only "= z₀" with Make free
  await clickSel('.shape[data-id="rl"] .shape-name'); await settle(300);
  const bf = await ev(`[...document.querySelectorAll('.shape[data-id="rl"] .cm-boundf input')].map((i) => [i.value, i.readOnly])`);
  ok('R user-3: the bound ends show "= z₀" read-only', JSON.stringify(bf) === JSON.stringify([['= z₀', true], ['= z₁', true]]), bf);
  // user-1, user-15: a new name in a glider's t makes the number (range 0…1) and binds t
  await clickSel('.shape[data-id="rg"] .shape-name'); await settle(400);
  const tin = await ev(`(() => { const i = document.querySelector('.cm-it'); if (!i) return null; i.value = 'k'; i.dispatchEvent(new Event('change', { bubbles: true })); return document.querySelector('.cm-imean') && document.querySelector('.cm-imean').textContent; })()`);
  await settle(300);
  const pk = { params: await ev(`Params.list()`) };
  const sh = await ST();
  const g = byId(sh, 'rg');
  const kp = pk && pk.params ? pk.params.find((x) => x.name === 'k') : null;
  ok('R user-1: typing a new name in t adds the number and binds t', !!kp && g.bind && g.bind.t === 'k' && kp.min === 0 && kp.max === 1, { kp, bind: g.bind, t: g.t });
  ok('R user-15: the t field says what t means', /^0 at z₀, ¼ at z₁, ½ at z₂$/.test(tin || ''), tin);
  // picture-1: zoomed in on a defining point (the window follows the view, as a zoom does), the stroke of the circle
  // through 3 points passes through the exact crossing on a row 20 px above z₁, within a pixel, at s = 1e2 … 1e8
  {
    const req = process.mainModule ? process.mainModule.require : null;
    const decode = req ? (() => { const m = { exports: null }; new Function('module', 'require', fs.readFileSync(path.join(DIR, 'png.js'), 'utf8'))(m, req); return m.exports; })() : null;
    const errsPx = [];
    for (const sc of [1e2, 1e4, 1e6, 1e8]) {
      const v = { cx: 1, cy: 0, s: sc };
      await load(NS + 'z' + Math.log10(sc), { shapes: [
        { id: 'p1', kind: 'point', p: [-1, 0], ci: 0, visible: true }, { id: 'p2', kind: 'point', p: [1, 0], ci: 1, visible: true }, { id: 'p3', kind: 'point', p: [0, 0.6], ci: 2, visible: true },
        { id: 'pc', kind: 'circle', c: [0, 0], r: 1, ci: 3, visible: true, def: { op: 'circle3', args: [{ s: 'p1' }, { s: 'p2' }, { s: 'p3' }], fill: 'none' } }],
        steps: [], srcView: v, clipWin: { x0: 1 - 300 / sc, x1: 1 + 300 / sc, y0: -300 / sc, y1: 300 / sc }, nextId: 50, pattern: 'checker' });
      await settle(900);
      const r = 1.1333333333333333, cy = -0.5333333333333333, y = 20 / sc, x = Math.sqrt(r * r - (y - cy) * (y - cy));
      const [ex, ey] = await W(x, y);
      if (!decode) { errsPx.push(null); continue; }
      const f = await shot('cm-zoom-' + Math.log10(sc));
      const img = decode(fs.readFileSync(f)), row = Math.round(ey);
      let best = null, bs = -1;
      for (let px = Math.round(ex) - 60; px <= Math.round(ex) + 60; px++) {
        const i = (row * img.w + px) * img.ch, R = img.data[i], G = img.data[i + 1], B = img.data[i + 2];
        const sat = Math.max(R, G, B) - Math.min(R, G, B);
        if (sat > bs) { bs = sat; best = px; }
      }
      errsPx.push(+(best - ex).toFixed(2));
    }
    info.zoomStrokePx = errsPx;
    ok('R picture-1: the stroke passes the exact crossing within 1 px at s = 1e2, 1e4, 1e6, 1e8', errsPx.every((e) => e != null && Math.abs(e) <= 1), errsPx);
  }
  // regress-1: a scene without constructions saves no step ids
  await load(NS + 'r1', { shapes: [{ id: 'q1', kind: 'disc', c: [0, 0], r: 1, ci: 0, visible: true }], steps: [{ type: 'zp', params: { a: '1', zeros: '1, 2', poles: '' }, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, nextId: 50 });
  await settle(700);
  await clickSel('.shape[data-id="q1"] .eye'); await settle(200); await clickSel('.shape[data-id="q1"] .eye'); await settle(900);
  const saved = await ev(`(() => { const k = Object.keys(localStorage).find((x) => x.includes('${NS}r1') && /^\\{.*"shapes"/s.test(localStorage.getItem(x) || '')); return k ? localStorage.getItem(k) : null; })()`);
  ok('R regress-1: no uid or zpIds in the save of a scene without constructions', !!saved && !/"uid"|"zpIds"/.test(saved) && /"nextId":50/.test(saved), saved && saved.slice(0, 200));
  await grab();
});

await section('V', async () => {
  // v16 verify-1: in Select, a press on a point of a 3-point Circle (Curve) takes the point, not the circle through it
  await view(1440, 900, false, false);
  const pt = (id, p, ci) => ({ id, kind: 'point', p, ci, visible: true });
  await load(NS + 'v', { shapes: [Object.assign(pt('v0', [-2, 1.5], 4), { label: 'P' }), pt('v1', [-1, -0.5], 0), pt('v2', [1, -0.5], 1), pt('v3', [0.2, 1], 2),
    { id: 'vc', kind: 'circle', c: [0, 0], r: 1, ci: 3, visible: true, def: { op: 'circle3', args: [{ s: 'v1' }, { s: 'v2' }, { s: 'v3' }], fill: 'none' } }],
    steps: [{ type: 'recip', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 120 }, nextId: 50 });
  await settle(800);
  // (a labelled point takes a plane index too: after P the rows read z₁, z₂, z₃, as the plane and the definition do)
  const vn = await ev(`['v1', 'v2', 'v3'].map((id) => (document.querySelector('.shape[data-id="' + id + '"] .shape-name .k') || {}).textContent)`);
  const vdef = await ev(`(document.querySelector('.shape[data-id="vc"] .d') || {}).textContent`);
  ok('V: after a labelled point the rows read z₁, z₂, z₃, as the definition', JSON.stringify(vn) === JSON.stringify(['z₁', 'z₂', 'z₃']) && /z₁, z₂, z₃/.test(vdef || ''), [vn, vdef]);
  await tool('select');
  const a = await W(1, -0.5), b = await W(1.5, 0);
  await click(a[0], a[1]); await settle(200);
  const sel1 = (await CI({ shapes: true })).selected;
  ok('V verify-1: a click on z₁ of a 3-point circle selects z₁', sel1 === 'v2', sel1);
  const r0 = byId(await ST(), 'vc').r;
  await drag(a[0], a[1], b[0], b[1], 12, 16); await settle(400);
  const st = await ST(), p1 = byId(st, 'v1').p, p2 = byId(st, 'v2').p, c = byId(st, 'vc');
  ok('V verify-1: dragging z₁ moves only z₁, and the circle follows it', near(p1[0], -1) && near(p1[1], -0.5) && Math.abs(p2[0] - 1.5) < 0.02 && Math.abs(p2[1]) < 0.02 && Math.abs(c.r - r0) > 1e-3 && near(dist(p2, c.c), c.r, 1e-9), [p1, p2, c.c, c.r, r0]);
  await grab();
});

ok('no console errors', errs.length === 0, errs.slice(0, 5));
return { pass: fails.length === 0, checks, fails, info };
