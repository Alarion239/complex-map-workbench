// v16.5 wave 1, the "plane" piece (notes/ux-build/w1-plane-AS-BUILT.md): every fix of UX09, UX10, UX14, UX15, UX27,
// UX37, UX44, UX48, UX51, UX52, UX55, UX56, UX66, UX67, UX86, UX91, UX92, UX94, UX95, UX100, UX101, UX105, in the real
// app with real input: the laptop at 1366 × 768 (mouse, keys), the phone at 412 × 860 (Android emulation, real touch
// events through Input.dispatchTouchEvent), 915 × 412 where it matters; English, and Russian where words changed.
// A command file for a CDP daemon (test/cdp_kit README):  python3 build.py && test/<you>_cdp/q.sh test/ux165_plane_cmd.js
// (__ONLY = ['L15', ...] runs some sections.)
const ONLY = typeof __ONLY !== 'undefined' ? __ONLY : null;
const run = (k) => !ONLY || ONLY.includes(k);
const fails = [], info = {};
let checks = 0;
const ok = (name, cond, got) => { checks++; if (!cond) fails.push({ name, got }); };
const settle = async (ms = 300) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const errs = [];
const grab = async () => { errs.push(...(await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource|favicon|MathJax|cdnjs/.test(x.m || ''))); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const W = (re, im, side = 'L') => ev(`__cmwW2S('${side}', ${re}, ${im})`);
const CI = (o) => ev(`__cmwCI(${JSON.stringify(o || null)})`);
const ST = () => CI({ shapes: true });
const tool = async (id) => { const r = await clickSel(`#tools .tool[data-tool="${id}"], #constructTools .tool[data-tool="${id}"]`); await settle(120); return r; };
const toastText = () => ev(`(document.querySelector('#toastHost .toast > span') || {}).textContent || ''`);
const chipT = (side = 'L') => ev(`(document.querySelector('#draftChip${side} .cm-t') || {}).textContent || ''`);
const NS = 'u5p' + (Date.now() % 1000000);
const section = async (k, f) => { if (!run(k)) return; try { await f(); } catch (e) { fails.push({ name: `section ${k} threw`, got: String(e && e.stack || e).slice(0, 700) }); } };
const clickR = async (x, y) => {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'right', buttons: 2, clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'right', buttons: 0, clickCount: 1 });
};
const dbl = async (x, y) => {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  for (const c of [1, 2]) {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: c });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: c });
  }
};
const menuItems = () => ev(`[...document.querySelectorAll('.ctx-menu .mi, .menu .mi, [role="menuitem"]')].filter((b) => b.getClientRects().length).map((b) => b.textContent.trim())`);
const closeMenus = async () => { await key('Escape'); await settle(80); };
// real touch: one finger (Input.dispatchTouchEvent; the page sees pointerType 'touch')
const tStart = (x, y, id = 1) => send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id, radiusX: 4, radiusY: 4, force: 1 }] });
const tMove = (pts) => send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1, radiusX: 4, radiusY: 4, force: 1 })) });
const tEnd = () => send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
const tap = async (x, y, ms = 50) => { await tStart(x, y); await sleep(ms); await tEnd(); await settle(120); };
const tdrag = async (x0, y0, x1, y1, n = 10, dt = 16) => { await tStart(x0, y0); await sleep(30); for (let i = 1; i <= n; i++) { await tMove([[x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n]]); await sleep(dt); } await tEnd(); await settle(150); };
const tapSel = async (css) => { const r = await ev(`(() => { const e = document.querySelector(${JSON.stringify(css)}); if (!e || !e.getClientRects().length) return null; const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`); if (!r || r.__exc) return null; await tap(r[0], r[1]); return r; };
const phone = async (w = 412, h = 860, dark = false) => { await view(w, h, dark, true); };
const laptop = async (dark = false) => { await view(1366, 768, dark, false); };
const putLang = (l) => ev(`localStorage.setItem('cmw-lang', ${JSON.stringify(l)}); 1`);

// a disc, a line, three points: the scenes of the drawing and construction checks
const SD = {
  shapes: [
    { id: 'd1', kind: 'disc', c: [0, 0], r: 1, ci: 0, visible: true },
    { id: 'l1', kind: 'line', a: [-2, 1.5], b: [2, 1.5], ci: 1, visible: true },
    { id: 'p1', kind: 'point', p: [1.5, -1], ci: 2, visible: true },
  ],
  steps: [{ type: 'recip', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, snap: false, nextId: 60,
};

// ------------------------------------------------------------------------------------------------------------ UX15
await section('L15', async () => {
  await laptop();
  await load(NS + 'a', SD);
  await settle(700);
  await grab();
  const n0 = (await ST()).list.length, hi0 = (await ST()).hi;
  await tool('perp');
  const u = await W(0, 1.5);
  await click(u[0] + 40, u[1]); await settle(120);           // Line 1 picked
  const p = await W(-1, -1.5);
  await click(p[0], p[1]); await settle(120);                // a free point picked
  let d = (await CI()).draft;
  ok('UX15 laptop: the curve and one point are picked', d && d.curve1 && d.picks.length === 1, d);
  ok('UX15 laptop: Undo is enabled while the draft has picks', !(await ev(`document.getElementById('undoBtn').disabled`)));
  await key('z', 4); await settle(150);                      // ⌘Z
  d = (await CI()).draft;
  let st = await ST();
  ok('UX15 ⌘Z removes the last pick, never the earlier shapes', d && d.picks.length === 0 && d.curve1 && st.list.length === n0 && st.hi === hi0, { d, n: st.list.length, n0, hi: st.hi, hi0 });
  info.l15toast = await toastText();
  ok('UX15 a toast says what went', /^Undid the (pick|last pick)/.test(info.l15toast), info.l15toast);
  await clickSel('#undoBtn'); await settle(150);             // the Undo button: the curve pick
  d = (await CI()).draft;
  st = await ST();
  ok('UX15 the Undo button then removes the picked curve, nothing else', (!d || !d.curve1) && st.list.length === n0, { d, n: st.list.length });
  info.l15toast2 = await toastText();
  ok('UX15 the second toast names the curve', /Line 1/.test(info.l15toast2), info.l15toast2);
  // a finished circle: the kept curve is no pick of the next draft; Undo undoes the circle
  await click(u[0] + 40, u[1]); await settle(100);
  await click(p[0], p[1]); await settle(100);
  const q = await W(1, -1.5);
  await click(q[0], q[1]); await settle(200);
  st = await ST();
  ok('UX15 the orthogonal circle is made (2 points + the circle)', st.list.length === n0 + 3, st.list.length);
  await key('z', 4); await settle(200);
  st = await ST();
  ok('UX15 with no picks of its own, ⌘Z undoes the last construction as usual', st.list.length === n0, st.list.length);
  await key('Escape'); await key('Escape'); await settle(80);
});

// ------------------------------------------------------------------------------------------------------------ UX14
await section('L14', async () => {
  await laptop();
  await load(NS + 'b', { shapes: [], steps: [], srcView: { cx: 0, cy: 0, s: 80 }, snap: false });
  await settle(600);
  await tool('polygon');
  const P = [[-1, -1], [1, -1], [1.2, 1], [-0.5, 1.4]];
  for (const [a, b] of P) { const s = await W(a, b); await click(s[0], s[1]); await settle(60); }
  info.l14chip = await ev(`document.querySelector('#draftChipL > span').textContent`);
  ok('UX14 laptop chip: click the first point, Enter, ⌫', /Click the first point or press Enter to close · ⌫ removes the last point/.test(info.l14chip), info.l14chip);
  await key('Backspace'); await settle(80);
  let n = await ev(`__cmwDraft ? __cmwDraft().pts.length : -1`);
  ok('UX14 Backspace removes the last point', n === 3, n);
  await clickSel('#undoBtn'); await settle(80);
  n = await ev(`__cmwDraft ? __cmwDraft().pts.length : -1`);
  ok('UX14 Undo removes the last point', n === 2, n);
  const s3 = await W(1.2, 1);
  await click(s3[0], s3[1]); await settle(60);
  await key('Enter'); await settle(200);
  const st = await ST();
  ok('UX14 Enter closes the polygon (3 points)', st.list.length === 1 && st.list[0].kind === 'polygon' && st.list[0].pts.length === 3, st.list.map((s) => s.kind + ':' + (s.pts || []).length));
  // the close radius with a mouse: 12 px
  for (const [a, b] of P.slice(0, 3)) { const s = await W(a + 0.3, b + 0.3); await click(s[0], s[1]); await settle(60); }
  const f = await W(-0.7, -0.7);
  await click(f[0] + 10, f[1]); await settle(200);
  const st2 = await ST();
  ok('UX14 a click 10 px from the first point closes (mouse radius 12 px)', st2.list.length === 2 && st2.list[1].pts.length === 3, st2.list.map((s) => s.kind + ':' + (s.pts || []).length));
  await tool('select');
});

await section('P14', async () => {
  await phone();
  await load(NS + 'c', { shapes: [], steps: [], srcView: { cx: 0, cy: 0, s: 60 }, snap: false });
  await settle(900);
  await grab();
  await tapSel('.ph-tools .tool[data-tool="polygon"], #tools .tool[data-tool="polygon"]');
  await settle(120);
  info.p14tool = await ev(`__cmwCI({shapes:true}).tool`);
  const P = [[-1, -1], [1, -1], [1.2, 1], [-0.5, 1.4]];
  for (const [a, b] of P) { const s = await W(a, b); await tap(s[0], s[1]); }
  info.p14chip = await ev(`document.querySelector('#draftChipL > span').textContent`);
  ok('UX14 phone chip: tap the first point, Undo; never Enter', /^Tap the first point to close/.test(info.p14chip) && !/Enter/.test(info.p14chip), info.p14chip);
  // (the chip, all its words, clear of the plane's round buttons at the right)
  const pc = await ev(`(() => { const c = document.getElementById('draftChipL'), s = c.firstElementChild, r = c.getBoundingClientRect(); const bs = [...document.querySelectorAll('button')].filter((b) => b.getClientRects().length && !c.contains(b)).map((b) => b.getBoundingClientRect()).filter((b) => b.left > r.left + r.width / 2 || b.right > r.right - 4); const hit = bs.some((b) => b.left < r.right && b.right > r.left && b.top < r.bottom && b.bottom > r.top); return { hit, cut: s.scrollWidth > s.clientWidth + 0.5, w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right) }; })()`);
  ok('UX14 phone chip: clear of the round buttons, not cut', pc && !pc.hit && !pc.cut && pc.h <= 56, pc);
  const und = await ev(`(() => { const b = document.querySelector('.ph-undo'); return b ? { dis: b.disabled, vis: !!b.getClientRects().length } : null; })()`);
  ok('UX14 the phone Undo is enabled while drawing', und && !und.dis && und.vis, und);
  await tapSel('.ph-undo'); await settle(100);
  let n = await ev(`__cmwDraft().pts.length`);
  ok('UX14 the phone Undo removes the last point', n === 3, n);
  const f = await W(-1, -1);
  await tap(f[0] + 18, f[1] + 6); await settle(200);
  const st = await ST();
  ok('UX14 a tap 19 px from the first point closes (touch radius 24 px)', st.list.length === 1 && st.list[0].pts.length === 3, st.list.map((s) => s.kind + ':' + (s.pts || []).length));
});

// ------------------------------------------------------------------------------------------------------------ UX09
await section('P09', async () => {
  await phone();
  await load(NS + 'd', { shapes: [{ id: 'd1', kind: 'disc', c: [0, 0], r: 1, ci: 0, visible: true }, { id: 'l1', kind: 'line', a: [-2, 2], b: [2, 2], ci: 1, visible: true }], steps: [], srcView: { cx: 0, cy: 0, s: 60 }, snap: false });
  await settle(900);
  const c = await W(0, 0);
  await tap(c[0], c[1]);
  ok('UX09 a tap selects the disc', (await ST()).selected === 'd1', (await ST()).selected);
  const hs = await ev(`__cmwHandles ? __cmwHandles() : null`);
  info.p09handles = hs;
  ok('UX09 handles are drawn 12 px on touch', hs && hs.size === 12, hs);
  // the rim handle (r at angle 0): a drag starting 16 px off it resizes the disc
  const rim = await W(1, 0);
  await tdrag(rim[0] + 16, rim[1] + 4, rim[0] + 46, rim[1] + 4, 8);
  const d1 = (await ST()).list.find((s) => s.id === 'd1');
  ok('UX09 a drag 16 px off the rim handle resizes (22 px grab radius)', d1 && d1.r > 1.3, d1 && d1.r);
  // a line tapped 15 px off its stroke is selected
  const l = await W(0.5, 2);
  await tap(l[0], l[1] + 15);
  ok('UX09 a tap 15 px off a line selects it (18 px)', (await ST()).selected === 'l1', (await ST()).selected);
});

// ------------------------------------------------------------------------------------- UX48, UX51, UX52, UX55, UX100
await section('L48', async () => {
  await laptop();
  await load(NS + 'e', SD);
  await settle(700);
  await tool('circle3');
  info.c3chip = await chipT();
  ok('UX48 3 points: what to pick, the count, the tool, Esc', /^Pick a point or an empty spot · 1 of 3 · .*Esc cancels$/.test(info.c3chip), info.c3chip);
  const a = await W(-1.5, -1.5);
  await click(a[0], a[1]); await settle(120);
  // (v16.5 merge, V16.5-MERGE.md: v16.3.1's rule kept: a chip that would wrap with its keyboard tail drops it when it
  // then fits one line; so the tail, or no tail on one line, as touch_cmd A5 accepts)
  info.c3chip2 = await ev(`(() => { const t = document.querySelector('#draftChipL .cm-t'); if (!t) return null; const r = document.createRange(); r.selectNodeContents(t); return { text: t.textContent, lines: new Set([...r.getClientRects()].map((q) => Math.round(q.top))).size }; })()`);
  ok('UX48 after a pick: 2 of 3 and "⌫ undo pick · Esc" (or no tail, on one line)', !!info.c3chip2 && (/^Pick a point or an empty spot · 2 of 3 · .*⌫ undo pick · Esc$/.test(info.c3chip2.text) || (/^Pick a point or an empty spot · 2 of 3 · [^·]+$/.test(info.c3chip2.text) && info.c3chip2.lines === 1)), info.c3chip2);
  await clickSel('#draftChipL .cm-q'); await settle(150);
  info.how = await ev(`(document.querySelector('#draftChipL .cm-how') || {}).textContent || ''`);
  ok('UX48 the ? unfolds the how-to inside the chip', /^Pick three points/.test(info.how), info.how);
  await key('Escape'); await settle(60);
  await tool('meet');
  ok('UX48 Intersect: where two curves cross, or the first curve', /^Pick where two curves cross, or the first curve · 1 of 2/.test(await chipT()), await chipT());
  // UX52: a refused pick in the chip, not a toast; it goes with the tool
  await ev(`document.querySelectorAll('#toastHost .toast').forEach((t) => t.remove()); 1`);
  const e0 = await W(-0.5, -2.2);
  await click(e0[0], e0[1]); await settle(150);
  info.warn = await ev(`(document.querySelector('#draftChipL .cm-warn') || {}).textContent || ''`);
  ok('UX52 the refusal is in the chip', info.warn === 'Click a crossing of two curves, or a curve.', info.warn);
  ok('UX52 no toast at the bottom', (await toastText()) === '', await toastText());
  await tool('perp');
  ok('UX52 a tool change clears it', !(await ev(`!!document.querySelector('#draftChipL .cm-warn')`)));
  // UX51 / UX55: the chip's three choices in words; UX100: the kept curve as a token
  const segs = await ev(`[...document.querySelectorAll('#draftChipL .cm-seg .cm-sb')].map((b) => b.getAttribute('aria-label'))`);
  ok('UX55 the chip offers Whole | Inside | Outside | Between, as the Inspector does', JSON.stringify(segs) === '["Whole","Inside","Outside","Between"]', segs);
  const L = await W(0, 1.5);
  await click(L[0] + 40, L[1]); await settle(120);
  const p1 = await W(-1, -1.5), p2 = await W(1, -1.5);
  await click(p1[0], p1[1]); await settle(100); await click(p2[0], p2[1]); await settle(250);
  info.tok = await ev(`(document.querySelector('#draftChipL .cm-tok') || {}).textContent || ''`);
  ok('UX100 after the circle, the kept curve shows as "on Line 1 ×"', /^on Line 1×?$/.test(info.tok.trim()), info.tok);
  await clickSel('#draftChipL .cm-tokx'); await settle(120);
  const d = (await CI()).draft;
  ok('UX100 its × un-picks only the curve (the tool stays)', (!d || !d.curve1) && (await ST()).tool === 'perp' && /^Pick a line or a circle/.test(await chipT()), [d, await chipT()]);
  // the Outside choice: the other arc
  await clickSel('#draftChipL .cm-sb[aria-label="Outside"]'); await settle(80);
  await click(L[0] + 40, L[1]); await settle(100);
  const q1 = await W(-0.6, 0.6), q2 = await W(0.6, 0.4);
  await click(q1[0], q1[1]); await settle(100); await click(q2[0], q2[1]); await settle(250);
  const st = await ST(), made = st.list.filter((x) => x.def && x.def.op === 'perp');
  ok('UX55 Outside makes a hyperbolic line on the other side (seg set)', made.length === 2 && made[1].def.seg && made[1].def.nk === 'hyper', made.map((x) => x.def));
  await key('Escape'); await key('Escape'); await settle(60);
  await ev(`__cmwCI({fill: 'in'}); 1`);
});

await section('L55', async () => {
  await laptop();
  await load(NS + 'f', { shapes: [{ id: 'c1', kind: 'circle', c: [0, 0], r: 1.5, ci: 0, visible: true }], steps: [], srcView: { cx: 0, cy: 0, s: 90 }, snap: false, nextId: 60 });
  await settle(700);
  const tiles = await ev(`[...document.querySelectorAll('#constructTools .tool')].map((b) => b.dataset.tool).join()`);
  ok('UX55 a seventh Construct tile: Hyperbolic line', tiles === 'circle3,meet,midpoint,bisector,perp,touch,hyper', tiles);
  info.htip = await ev(`(() => { const b = document.querySelector('#constructTools .tool[data-tool="hyper"]'); return b ? { tip: b.dataset.tip, label: b.textContent.trim() } : null; })()`);
  ok('UX55 its tooltip and label', info.htip && info.htip.tip === 'Hyperbolic line  Y' && /Hyperbolic/.test(info.htip.label), info.htip);
  await tool('hyper');
  ok('UX55 the chip asks for the boundary first', /^Pick the boundary: a line or a circle/.test(await chipT()), await chipT());
  const c = await W(1.5, 0);
  await click(c[0], c[1]); await settle(100);
  const a = await W(-0.5, 0.3), b = await W(0.6, 0.5);
  await click(a[0], a[1]); await settle(100); await click(b[0], b[1]); await settle(300);
  const names = await CI({ names: true });
  const hl = names.find((x) => /^Hyperbolic line/.test(x.name || ''));
  ok('UX55 the result is named "Hyperbolic line 1"', !!hl && hl.name === 'Hyperbolic line 1', names);
  const st = await ST(), K = st.list.find((x) => x.def && x.def.op === 'perp');
  ok('UX55 it is the orthogonal arc inside the boundary (seg set)', K && K.def.seg && K.def.nk === 'hyper', K && K.def);
  await key('Escape'); await key('Escape'); await settle(60);
  await tool('select');
  const row = await ev(`(document.querySelector('.shape[data-id="${K.id}"] .d') || {}).textContent || ''`);
  await clickSel(`.shape[data-id="${K.id}"] .shape-name`); await settle(250);
  const insp = await ev(`(document.querySelector('#propsPanel .cm-idef') || {}).textContent || ''`);
  info.hdef = { row, insp };
  ok('UX55 one definition sentence in the row and the Inspector', /^hyperbolic line inside Circle 1/.test(row.trim()) && insp.trim() === row.trim(), info.hdef);
});

// ------------------------------------------------------------------------------------------------------------ UX101
await section('L101', async () => {
  await laptop();
  await load(NS + 'g', { shapes: [{ id: 'la', kind: 'line', a: [-2, 0.5], b: [2, 0.5], ci: 0, visible: true }, { id: 'lb', kind: 'line', a: [-2, -0.5], b: [2, -0.5], ci: 1, visible: true }], steps: [], srcView: { cx: 0, cy: 0, s: 90 }, snap: false, nextId: 60 });
  await settle(700);
  await tool('meet');
  const a = await W(-1, 0.5), b = await W(1, -0.5);
  await click(a[0], a[1]); await settle(100); await click(b[0], b[1]); await settle(200);
  info.par = await ev(`(document.querySelector('#draftChipL .cm-warn') || {}).textContent || ''`);
  ok('UX101 two parallel lines: "These lines are parallel: they meet only at ∞"', info.par === 'These lines are parallel: they meet only at ∞', info.par);
  await key('Escape'); await key('Escape');
  // a crossing made, then its line turned parallel: a hollow marker stays at the plane's edge
  await load(NS + 'g2', { shapes: [{ id: 'la', kind: 'line', a: [-2, 0.5], b: [2, 0.5], ci: 0, visible: true }, { id: 'lb', kind: 'line', a: [-2, -1], b: [2, 1], ci: 1, visible: true }, { id: 'm', kind: 'point', p: [1, 0.5], ci: 2, visible: true, def: { op: 'meet', args: [{ s: 'la', part: 0 }, { s: 'lb', part: 0 }], index: 0 } }], steps: [], srcView: { cx: 0, cy: 0, s: 90 }, snap: false, nextId: 60 });
  await settle(700);
  await ev(`(() => { const s = __cmwCI({ shapes: true }); return 1; })()`);
  // drag lb's end b so lb becomes parallel to la (y = -0.5 at both ends)
  await tool('select');
  const mid = await W(0, 0);
  await click(mid[0], mid[1]); await settle(150);
  const hb = await W(2, 1), ha = await W(-2, -1);
  await drag(ha[0], ha[1], ha[0], (await W(-2, -0.5))[1], 6, 16); await settle(100);
  await drag(hb[0], hb[1], hb[0], (await W(2, -0.5))[1], 10, 16); await settle(300);
  const inf = (await ST()).list.find((x) => x.id === 'm');
  ok('UX101 the crossing is at ∞ now', inf && inf.inf, inf);
  await shot('ux101-inf-mark');
  const px = await ev(`(() => { const c = document.getElementById('overlayL'), g = c.getContext('2d'), d = c.width / c.clientWidth; const W = c.clientWidth, H = c.clientHeight; const y = Math.round(${(await W(0, 0.5))[1]} - c.getBoundingClientRect().top); const row = g.getImageData(Math.round((W - 30) * d), Math.round((y - 12) * d), Math.round(24 * d), Math.round(24 * d)).data; let n = 0; for (let i = 3; i < row.length; i += 4) if (row[i] > 0) n++; return n; })()`);
  ok('UX101 a hollow marker is drawn at the plane edge on the line (overlay pixels there)', px > 20, px);
});

// ------------------------------------------------------------------------------------------------------------ UX56
await section('L56', async () => {
  await laptop();
  await load(NS + 'h', { shapes: [{ id: 'c1', kind: 'circle', c: [0, 0], r: 1, ci: 0, visible: true }, { id: 'pt', kind: 'point', p: [1, 0], ci: 1, visible: true, def: { op: 'glider', args: [{ s: 'c1', part: 0 }] }, t: 0 }], steps: [], srcView: { cx: 0, cy: 0, s: 90 }, snap: false, nextId: 60 });
  await settle(700);
  const p = await W(1, 0);
  await clickR(p[0], p[1]); await settle(250);
  info.m56 = await menuItems();
  // (issue #13: no bare Select item; the point's first row names it and where it lies. #39: objects stacked under the
  // cursor each have a "Select <name>" row, so every Select row names its object)
  ok('UX56 the point heads the menu (z₀ · lies on Circle 1), Select rows only name an object', /^z₀/.test(info.m56[0] || '') && /lies on Circle 1/.test(info.m56[0] || '') && info.m56.filter((t) => /^Select/.test(t)).every((t) => /^Select \S/.test(t) && t !== 'Select'), info.m56);
  ok('UX56 Delete names the point', info.m56.some((t) => /^Delete z₀/.test(t)), info.m56);
  ok('UX56 no "Add point here" over a point', !info.m56.some((t) => /Add point here/.test(t)), info.m56);
  ok('UX56 Make free names its shape', info.m56.some((t) => /^Make z₀ free/.test(t)), info.m56);
  await closeMenus();
});

// ------------------------------------------------------------------------------------------------------------ UX66
await section('L66', async () => {
  await laptop();
  await load(NS + 'i', { shapes: [], steps: [{ type: 'root', params: { n: 2, cut: 180, k: 0 }, on: true }], srcView: { cx: 0, cy: 0, s: 80 } });
  await settle(800);
  const v0 = await ev(`(() => { const r = document.getElementById('overlayL').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
  const sc = async () => { const a = await W(0, 0), b = await W(1, 0); return b[0] - a[0]; };
  const s0 = await sc();
  const z66 = await ev(`__cmwPlaneMenu().s2w('L', ${v0[0] + 60}, ${v0[1] - 40})`);
  await dbl(v0[0] + 60, v0[1] - 40); await settle(1500);
  const after = await ev(`JSON.parse(localStorage.getItem(__qa.key()) || '{}')`);
  const vw = await ev(`__cmwPlaneMenu().view('L')`);
  info.l66 = { cut1: after.steps && after.steps[0] && after.steps[0].params.cut, s0, s1: await sc(), z66, vw };
  ok('UX66 a double-click on empty X never turns the cut', info.l66.cut1 === 180, info.l66);
  // (issue #13: the double-click centres the view at the point, at the same scale; it replaced v16.5's ×2 zoom)
  ok('UX66 it centres the view there, same scale', Math.abs(vw.cx - z66[0]) < 1.5 / vw.s && Math.abs(vw.cy - z66[1]) < 1.5 / vw.s && Math.abs(info.l66.s1 / info.l66.s0 - 1) < 1e-6, info.l66);
});

// ------------------------------------------------------------------------------------------------------------ UX67
await section('L67', async () => {
  await laptop();
  await load(NS + 'j', { shapes: [], steps: [{ type: 'root', params: { n: 2, cut: 180, k: 0 }, on: true }], srcView: { cx: 0, cy: 0, s: 80 } });
  await settle(800);
  await clickSel('#pipeline .card[data-k="1"]'); await settle(300);
  info.l67 = await ev(`(() => { const c = document.querySelector('#propsPanel .sheet-ctl'); if (!c) return null; const p = c.parentElement; return { t: p.textContent.replace(/\\s+/g, ' ').trim(), order: [...p.children].map((e) => e.classList.contains('sh-prev') ? '‹' : e.tagName === 'INPUT' ? 'k' : e.classList.contains('sheet-ctl') ? 'ctl' : '?').join(' '), btns: [...p.querySelectorAll('button')].map((b) => b.getAttribute('aria-label') || b.textContent) }; })()`);
  ok('UX67 the step editor has ‹ k of 2 › · Show all sheets', info.l67 && info.l67.order === '‹ k ctl' && /^‹ ?of 2 ?›/.test(info.l67.t) && /Show all sheets/.test(info.l67.t), info.l67);
  const kNow = () => ev(`document.querySelector('#propsPanel .sheet-ctl').parentElement.querySelector('input').value`);
  await clickSel('#propsPanel .sheet-ctl .sh-next'); await settle(200);
  const k1 = await kNow();
  ok('UX67 › goes to sheet 1', +k1 === 1, k1);
  await clickSel('#propsPanel .sheet-ctl .sh-next'); await settle(200);
  const k2 = await kNow();
  ok('UX67 and wraps to 0 (a square root has 2 sheets)', +k2 === 0, k2);
  await clickSel('#propsPanel .sheet-ctl .sh-all'); await settle(900);
  const st = await ev(`__cmwState()`);
  ok('UX67 Show all sheets opens Landscape with All sheets on', st.view.main === 'land' && st.sheets === true, { main: st.view.main, sheets: st.sheets });
});

// ------------------------------------------------------------------------------------------------------- UX10, UX27, UX37
await section('L10', async () => {
  await laptop();
  await load(NS + 'k', { shapes: [{ id: 'd1', kind: 'disc', c: [0, 0], r: 1, ci: 0, visible: true }], steps: [{ type: 'exp', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 } });
  await settle(800);
  const p = await W(0.5, -0.8);
  await move(p[0], p[1]); await settle(200);
  info.l10 = await ev(`[...document.querySelectorAll('#leftReadout > .rln')].map((e) => e.textContent.replace(/\\s+/g, ' ').trim())`);
  ok('UX10 laptop: one readout with z and w = F(z)', info.l10.length === 2 && /^z = 0\.5/.test(info.l10[0]) && /^w = F\(z\) = /.test(info.l10[1]), info.l10);
  // (no line cut with an ellipsis: the text, measured to the sub-pixel, fits its line; at 1366 |z| and arg still show)
  const cut = await ev(`[...document.querySelectorAll('#leftReadout > .rln')].map((k) => { const rg = document.createRange(); rg.selectNodeContents(k); return +(rg.getBoundingClientRect().width - k.getBoundingClientRect().width).toFixed(2); })`);
  ok('UX10 laptop: no readout line is cut', cut.length === 2 && cut.every((d) => d <= 0.01), cut);
  ok('UX10 laptop: |z| and arg fit beside z at 1366', /\|z\| /.test(info.l10[0]) && /arg /.test(info.l10[0]), info.l10);
  // X expanded: F(z) is still read
  await clickSel('#leftSolo'); await settle(500);
  const p2 = await W(0.5, -0.8);
  await move(p2[0], p2[1]); await settle(200);
  const solo = await ev(`[...document.querySelectorAll('#leftReadout > .rln')].map((e) => e.textContent.replace(/\\s+/g, ' ').trim())`);
  ok('UX10 with X expanded, F(z) is read in X', solo.length === 2 && /^w = F\(z\)/.test(solo[1]), solo);
  await clickSel('#leftSolo'); await settle(400);
  // UX27: one name per plane
  info.l27 = await ev(`({ l: document.getElementById('leftTitle').textContent, r: document.getElementById('rightTitle').textContent, ax: document.getElementById('overlayL').getAttribute('aria-label'), ay: document.getElementById('overlayR').getAttribute('aria-label'), heads: [...document.querySelectorAll('#shapeList .shapes-sub')].map((e) => e.textContent) })`);
  ok('UX27 X\'s title: "X · z-plane, domain of F"', /^X · z-plane/.test(info.l27.l) && /domain of F/.test(info.l27.l), info.l27);
  ok('UX27 Y\'s title: "Y · w = F(z), image"', /^Y · w = F\(z\)/.test(info.l27.r) && /image/.test(info.l27.r), info.l27);
  ok('UX27 the canvases\' names', /^X, the z-plane/.test(info.l27.ax) && /^Y, the w-plane/.test(info.l27.ay), info.l27);
  ok('UX27 the Shapes headings: In X (z-plane), Targets in Y (w-plane)', info.l27.heads[0] === 'In X (z-plane)' && /^Targets in Y \(w/.test(info.l27.heads[1] || ''), info.l27.heads);
  const tnote = await ev(`(document.querySelector('#shapeList .empty-note') || {}).textContent || ''`);
  ok('UX27 no targets: "Draw one in Y (the w-plane)"', /Draw one in Y \(the w-plane\)/.test(tnote), tnote);
  // UX37: Plane | Sphere in words at 1366 with both panels
  info.l37 = await ev(`[...document.querySelectorAll('#leftTabs > button, #rightTabs > button')].map((b) => { const s = b.querySelector('span'); const r = b.getBoundingClientRect(); return { t: s && getComputedStyle(s).display !== 'none' ? s.textContent : '', h: Math.round(r.height) }; })`);
  ok('UX37 "Plane | Sphere" in words in both pane heads', info.l37.length === 4 && info.l37.every((x) => /^(Plane|Sphere)$/.test(x.t) && x.h >= 28), info.l37);
});

await section('P10', async () => {
  await phone();
  await load(NS + 'l', { shapes: [{ id: 'd1', kind: 'disc', c: [0, 0], r: 1, ci: 0, visible: true }], steps: [{ type: 'exp', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 60 } }, `localStorage.removeItem('cmw-probe-learned'); sessionStorage.removeItem('cmw-probe-taught')`);
  // (v16.5 fix regress-4: the line shows once a session, for 8 s; this suite's earlier phone sections were that once,
  // so the session's mark is cleared with the learned one, as ux165_fix_cmd's regress-4 clears the session)
  await settle(1000);
  info.p10idle = await ev(`document.getElementById('leftReadout').textContent`);
  ok('UX10 phone: the scale chip teaches the hold-and-slide', /Hold and slide to read F\(z\)/.test(info.p10idle), info.p10idle);
  const tag = await ev(`getComputedStyle(document.getElementById('leftReadout'), '::before').content`);
  ok('UX27 phone: the big plane\'s chip is tagged X', tag === '"X"', tag);
  const p = await W(0.5, -0.8);
  await tStart(p[0], p[1]); await sleep(800); await tMove([[p[0] + 14, p[1] + 4]]); await sleep(80); await tMove([[p[0] + 24, p[1] + 8]]); await sleep(200);
  info.p10probe = await ev(`[...document.querySelectorAll('#leftReadout > .rln')].map((e) => e.textContent.replace(/\\s+/g, ' ').trim())`);
  const wid = await ev(`(() => { const c = document.getElementById('leftReadout'); return [...c.children].every((k) => { const rg = document.createRange(); rg.selectNodeContents(k); return rg.getBoundingClientRect().width <= k.getBoundingClientRect().width + 0.01; }); })()`);
  await shot('ux10-phone-probe');
  await tEnd(); await settle(300);
  ok('UX10 phone: z = … and w = F(z) = …, no doubled z, not cut', info.p10probe.length === 2 && /^z = /.test(info.p10probe[0]) && /^w = F\(z\) = /.test(info.p10probe[1]) && wid, [info.p10probe, wid]);
  const idle2 = await ev(`document.getElementById('leftReadout').textContent`);
  ok('UX10 phone: after the first use the chip shows the scale only', !/Hold and slide/.test(idle2), idle2);
  // the phone in landscape (915 × 412): the same two lines, whole, inside the plane
  await phone(915, 412);
  await load(NS + 'l2', { shapes: [{ id: 'd1', kind: 'disc', c: [0, 0], r: 1, ci: 0, visible: true }], steps: [{ type: 'exp', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 60 } });
  await settle(1000);
  const q = await W(0.5, -0.8);
  await tStart(q[0], q[1]); await sleep(800); await tMove([[q[0] + 14, q[1] + 4]]); await sleep(80); await tMove([[q[0] + 24, q[1] + 8]]); await sleep(200);
  const land = await ev(`(() => { const c = document.getElementById('leftReadout'), r = c.getBoundingClientRect(), p = c.parentElement.getBoundingClientRect(); return { lines: [...c.querySelectorAll('.rln')].map((e) => e.textContent.replace(/\\s+/g, ' ').trim()), whole: [...c.children].every((k) => k.scrollWidth <= k.clientWidth + 1), inside: r.right <= p.right && r.bottom <= p.bottom }; })()`);
  await shot('ux10-phone-landscape-probe');
  await tEnd(); await settle(300);
  ok('UX10 phone landscape: z = … and w = F(z) = …, whole, inside the plane', land.lines.length === 2 && /^w = F\(z\) = /.test(land.lines[1]) && land.whole && land.inside, land);
});

// ------------------------------------------------------------------------------------------------------------ UX44
await section('L44', async () => {
  await laptop();
  await load(NS + 'm', { shapes: [{ id: 'd1', kind: 'disc', c: [0.2166667, -1.3846154], r: 1.5833333, ci: 0, visible: true }], steps: [], srcView: { cx: 0, cy: 0, s: 60 } });
  await settle(700);
  await clickSel('.shape[data-id="d1"] .shape-name'); await settle(300);
  info.l44 = await ev(`(() => { const f = document.querySelector('.shape-edit .field.cxf'); if (!f) return null; const i = f.querySelector('input'), r = i.getBoundingClientRect(), b = f.parentElement.getBoundingClientRect(); return { v: i.value, w: Math.round(r.width), box: Math.round(b.width), font: getComputedStyle(i).fontFamily, fits: i.scrollWidth <= i.clientWidth + 1 }; })()`);
  ok('UX44 the centre takes the full row and fits its value', info.l44 && info.l44.w >= info.l44.box - 24 && info.l44.fits, info.l44);
  ok('UX44 4 significant digits until clicked into', info.l44 && info.l44.v === '0.2167 - 1.385i', info.l44);
  const r = await ev(`(() => { const i = document.querySelector('.shape-edit .field.cxf input'); i.focus(); return i.value; })()`);
  ok('UX44 focused: the full value to edit', r === '0.216667 - 1.384615i', r);
  ok('UX105 inputs use a monospace with round parentheses (JetBrains Mono)', /JetBrains Mono/.test(info.l44 && info.l44.font), info.l44 && info.l44.font);
  await ev(`document.activeElement.blur(); 1`);
});

// ------------------------------------------------------------------------------------------------- UX86, UX91, UX92, UX94, UX95
await section('L86', async () => {
  await laptop();
  await load(NS + 'n', { shapes: [], steps: [], srcView: { cx: 0, cy: 0, s: 60 }, snap: true });
  await settle(700);
  info.l86 = await ev(`({ tool: document.querySelector('#tools .tool[data-tool="cgrid"]').dataset.tip, pat: (document.querySelector('#patternSeg [data-pat="grid"], #patternSeg .pat[data-v="grid"]') || {}).textContent || [...document.querySelectorAll('#patternSeg .pat')].map((b) => b.textContent.trim()).join('|') })`);
  ok('UX86 the tool is "Line grid", the pattern "Square grid"', info.l86.tool === 'Line grid' && /Square grid/.test(info.l86.pat), info.l86);
  // UX94: Snap says its state in a word
  const sn = await ev(`(() => { const b = document.getElementById('snapBtn'); return { t: b.textContent.trim(), on: b.getAttribute('aria-pressed'), bg: getComputedStyle(b).backgroundColor }; })()`);
  ok('UX94 the Snap button says "Snap" and is filled when on', sn.t === 'Snap' && sn.on === 'true' && sn.bg !== 'rgba(0, 0, 0, 0)', sn);
  // UX91: the first disc refits the cell, and says so
  await tool('disc');
  const a = await W(0.3, 0.2);
  await drag(a[0], a[1], a[0] + 24, a[1], 8, 16); await settle(400);
  info.l91 = await toastText();
  ok('UX91 a word when an added shape refits the pattern cell', /^The pattern cell is now .*, fitted to the shapes/.test(info.l91), info.l91);
  // UX94: off is outlined, not filled (moves that snap are the rail piece's, work/xu1-rail)
  await tool('select');
  const id = (await ST()).list[0].id;
  await clickSel('#snapBtn'); await settle(120);
  const so = await ev(`(() => { const b = document.getElementById('snapBtn'); return { on: b.getAttribute('aria-pressed'), bg: getComputedStyle(b).backgroundColor, bd: getComputedStyle(b).borderTopColor }; })()`);
  ok('UX94 Snap off: outlined, transparent', so.on === 'false' && so.bg === 'rgba(0, 0, 0, 0)' && so.bd !== 'rgba(0, 0, 0, 0)', so);
  await clickSel('#snapBtn'); await settle(120);
  // UX95: colour names, no Clear shapes in one shape's menu
  await clickSel(`.shape[data-id="${id}"] .icon-btn.more`); await settle(200);
  const items = await menuItems();
  ok('UX95 a shape\'s ⋯ has no "Clear shapes"', !items.some((t) => /Clear shapes/.test(t)), items);
  await ev(`(() => { const b = [...document.querySelectorAll('.menu .mi')].find((x) => x.textContent.trim().startsWith('Color')); if (b) b.click(); return !!b; })()`); await settle(200);
  const cols = await menuItems();
  ok('UX95 colours by name: Blue … Slate', cols.includes('Blue') && cols.includes('Slate') && !cols.some((t) => /Preset/.test(t)), cols);
  await closeMenus(); await closeMenus();
  // UX92: a bounded formula region has no "goes on forever" note; an unbounded one has
  await ev(`(() => { const i = document.getElementById('formulaInput'); i.value = '|z+1| < 1'; i.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
  await settle(150);
  await clickSel('#formulaAdd, #secFormula button.btn'); await settle(500);
  const fId = (await ST()).list.filter((x) => x.kind === 'formula').map((x) => x.id).pop();
  if ((await ST()).selected !== fId) await clickSel(`.shape[data-id="${fId}"] .shape-name`);
  await settle(300);
  ok('UX92 the formula region is selected (its editor shows)', (await ST()).selected === fId && (await ev(`!!document.querySelector('.shape-edit')`)), (await ST()).selected);
  const n1 = await ev(`!!document.querySelector('.shape-edit [data-unb]')`);
  ok('UX92 |z+1| < 1: no "unbounded" note', fId && !n1, { fId, n1 });
  await key('Escape'); await settle(100);
  await ev(`(() => { const i = document.getElementById('formulaInput'); i.value = '|Im z| < 1'; i.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
  await settle(150);
  await clickSel('#formulaAdd, #secFormula button.btn'); await settle(500);
  const gId = (await ST()).list.filter((x) => x.kind === 'formula').map((x) => x.id).pop();
  if ((await ST()).selected !== gId) await clickSel(`.shape[data-id="${gId}"] .shape-name`);
  await settle(300);
  const n2 = await ev(`(document.querySelector('.shape-edit [data-unb]') || {}).textContent || ''`);
  ok('UX92/UX95 a strip: "Goes on forever; drawn faded towards the edge."', gId !== fId && n2 === 'Goes on forever; drawn faded towards the edge.', { n2, fId, gId });
  // UX86: the Phase style
  await key('2'); await settle(900);
  // (v16.5 UX20, learn: on a desktop Phase's option bar is behind the plane's Display options button in the pane head;
  // a real click opens it when the style control is not inline, as mv_views_cmd does, and it is closed after)
  const optsB = await ev(`(() => { if (document.getElementById('dcSeg')) return null; const e = document.querySelector('#leftFoot .opts-btn'); if (!e || !e.getClientRects().length || e.getAttribute('aria-expanded') === 'true') return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
  if (Array.isArray(optsB)) { await click(optsB[0], optsB[1]); await settle(300); }
  const ph = await ev(`[...document.querySelectorAll('[data-dc], .options button, .options [role=radio], #dcSeg > button')].map((b) => b.textContent.trim()).filter((t) => /grid/i.test(t))`);
  ok('UX86 the Phase style is "Pulled-back grid"', ph.includes('Pulled-back grid'), ph);
  await ev(`(() => { const b = document.querySelector('#leftFoot .opts-btn'); if (b && b.getAttribute('aria-expanded') === 'true') b.click(); return 1; })()`); await settle(200);
  await key('1'); await settle(400);
});

// ------------------------------------------------------------------------------------------------------- phone: UX51, UX94, UX95
await section('P51', async () => {
  await phone();
  await load(NS + 'o', SD);
  await settle(1000);
  await ev(`document.querySelector('#constructTools .tool[data-tool="perp"]').click(); 1`); await settle(200);
  const u = await W(0, 1.5);
  await tap(u[0] + 30, u[1]);
  info.p51 = await ev(`(() => { const c = document.getElementById('draftChipL'); const x = c.querySelector('.cm-x'), q = x.getBoundingClientRect(); const hit = (dx, dy) => document.elementFromPoint(q.left + q.width / 2 + dx, q.top + q.height / 2 + dy) === x; return { t: (c.querySelector('.cm-t') || {}).textContent, segs: [...c.querySelectorAll('.cm-sb')].map((b) => [b.textContent, Math.round(b.getBoundingClientRect().width)]), x44: hit(20, 0) && hit(-20, 0) && hit(0, 20) && hit(0, -20) }; })()`);
  // (v16.5 fix user-6: after the curve, "Pick a point (on {c} or anywhere)"; the tap picks SD's Line 1)
  ok('UX51 phone chip: no Esc, the next pick in words', /^Pick a point \(on Line 1 or anywhere\) · 1 of 2/.test(info.p51.t) && !/Esc/.test(info.p51.t), info.p51);
  // (D3: on a phone the three choices are in the context bar, in words, and the chip drops its copy: one place)
  const barSeg = await ev(`[...document.querySelectorAll('.ph-ctseg > button')].map((b) => [b.textContent, Math.round(b.getBoundingClientRect().width), Math.round(b.getBoundingClientRect().height)])`);
  ok('UX51 phone: Whole | Inside | Outside | Between in words in the context bar, each ≥ 44 px, and not again in the chip', barSeg.length === 4 && barSeg.every(([t, w, h]) => t && w >= 44 && h >= 44) && info.p51.segs.every(([t, w]) => !w), [barSeg, info.p51.segs]);
  ok('UX51 phone chip: the × takes taps 44 × 44', info.p51.x44, info.p51);
  await shot('ux51-phone-chip');
  // UX15 on the phone: the Undo at the thumb takes the last pick
  const p = await W(-1, -1.5);
  await tap(p[0], p[1]);
  const n0 = (await ST()).list.length;
  await tapSel('.ph-undo');
  const d = (await CI()).draft;
  ok('UX15 phone: Undo removes the pick, not earlier work', d && d.picks.length === 0 && (await ST()).list.length === n0, d);
  await tapSel('#draftChipL .cm-x');
  // UX94: the Snap switch in More tools
  await tapSel('#toolMore'); await settle(400);
  const sw = await ev(`(() => { const b = document.querySelector('.ph-snap'); if (!b) return null; const a = getComputedStyle(b, '::after'); return { on: b.getAttribute('aria-pressed'), after: a.content, w: a.width, bg: getComputedStyle(b).backgroundColor }; })()`);
  ok('UX94 phone: Snap is a switch (a track after the word), not a filled pill', sw && sw.after === '""' && sw.w === '30px', sw);
  await shot('ux94-phone-snap');
  await key('Escape'); await settle(200);
  // UX95: the Display sheet's region section is "Shapes" (#35) ([v17 D5, #82]: a heading of the sheet, no longer the left
  // panel's #secDisplay)
  const disp = await ev(`(() => { const hs = [...document.querySelectorAll('h3.ph-h')].map((c) => c.textContent); return hs.includes('Shapes') && !hs.includes('Display') ? 'Shapes' : hs.join('|'); })()`);
  ok('UX95 phone: no second "Display" in the Display sheet', disp === 'Shapes', disp);
});

// ------------------------------------------------------------------- layout: the two-line readout, Snap, the touch ×
await section('LAY', async () => {
  // UX10 + UX48: X's two-line readout never runs under the construction chip (the chip sits below both lines, always)
  await laptop();
  await load(NS + 'lay', SD);
  await settle(700);
  await tool('perp');
  const u = await W(0, 1.5);
  await click(u[0] + 40, u[1]); await settle(120);
  const p = await W(-1, -1.2);
  await move(p[0], p[1]); await settle(200);
  const g = await ev(`(() => { const r = document.getElementById('leftReadout'), c = document.getElementById('draftChipL'); const a = r.getBoundingClientRect(), b = c.getBoundingClientRect(); return { lines: r.querySelectorAll('.rln').length, rb: Math.round(a.bottom), ct: Math.round(b.top), hidden: c.hidden }; })()`);
  ok('UX10/UX48 the chip sits below the two-line readout', g.lines === 2 && !g.hidden && g.ct >= g.rb + 4, g);
  const sp = await ev(`(() => { const c = document.getElementById('draftChipL'); return [...c.querySelectorAll('.cm-t > .cm-nw')].map((e) => e.getClientRects().length); })()`);
  ok('UX48 the count and the keys never break inside ("1 of 2", "Esc cancels")', sp.length >= 2 && sp.every((k) => k === 1), sp);
  // the chip does not move when the pointer leaves X
  await move(5, 400); await settle(200);
  const ct2 = await ev(`Math.round(document.getElementById('draftChipL').getBoundingClientRect().top)`);
  ok('UX10 the chip stays put when the readout goes back to one line', ct2 === g.ct, [g.ct, ct2]);
  // the key's "=" and parentheses in the maths face (not B612 Mono's "[")
  await move(p[0], p[1]); await settle(200);
  const ff = await ev(`[...document.querySelectorAll('#leftReadout .rln .rk .rm')].map((e) => getComputedStyle(e).fontFamily.split(',')[0])`);
  ok('UX105 the readout key\'s "(" and "=" are set in STIX', ff.length >= 3 && ff.every((f) => /STIX/.test(f)), ff);
  await key('Escape'); await key('Escape'); await settle(80);
  // UX48: with a mouse the ? sits beside the chip's words (two lines of words), never alone on a line below them
  for (const t of ['hyper', 'meet']) {
    await tool(t);
    const q = await ev(`(() => { const c = document.getElementById('draftChipL'), t = c.querySelector('.cm-t').getBoundingClientRect(), q = c.querySelector('.cm-q').getBoundingClientRect(); return { qTop: Math.round(q.top), qLeft: Math.round(q.left), tTop: Math.round(t.top), tBot: Math.round(t.bottom), tRight: Math.round(t.right) }; })()`);
    ok(`UX48 the ? beside the words (${t})`, q.qTop < q.tBot && q.qLeft >= q.tRight, q);
    await key('Escape'); await settle(60);
  }
  await tool('select');
  // UX94: the Snap button is one line: the word beside the icon, inside the button
  const sb = await ev(`(() => { const b = document.getElementById('snapBtn'), w = b.querySelector('.snap-w'), i = b.querySelector('.ic-slot'); const r = b.getBoundingClientRect(), q = w.getBoundingClientRect(), k = i.getBoundingClientRect(); return { h: Math.round(r.height), inside: q.left >= r.left && q.right <= r.right + 0.5 && q.top >= r.top - 0.5 && q.bottom <= r.bottom + 0.5, beside: q.left >= k.right - 0.5 && Math.abs((q.top + q.bottom) / 2 - (k.top + k.bottom) / 2) < 3 }; })()`);
  ok('UX94 the Snap button: the word beside the icon, inside the button', sb.h <= 26 && sb.inside && sb.beside, sb);
  // UX51: on the phone the × sits beside the words on the chip's first line; the choices on the second
  await phone();
  await load(NS + 'lay2', SD);
  await settle(900);
  await ev(`document.querySelector('#constructTools .tool[data-tool="perp"]').click(); 1`); await settle(200);
  const v = await W(0, 1.5);
  await tap(v[0] + 30, v[1]);
  const ph = await ev(`(() => { const c = document.getElementById('draftChipL'), t = c.querySelector('.cm-t').getBoundingClientRect(), x = c.querySelector('.cm-x').getBoundingClientRect(), s = c.querySelector('.cm-seg').getBoundingClientRect(), b = c.getBoundingClientRect(), pl = c.parentElement.getBoundingClientRect(); return { xTop: Math.round(x.top), tTop: Math.round(t.top), tBot: Math.round(t.bottom), segTop: Math.round(s.top), h: Math.round(b.height), right: Math.round(b.right), plot: Math.round(pl.right) }; })()`);
  ok('UX51 phone chip: the × on the first line of the sentence, one or two lines in all', ph.xTop <= ph.tBot && ph.h <= 96 && ph.right <= ph.plot, ph);
  await tapSel('#draftChipL .cm-x');
});

// ------------------------------------------------------------------------------------------------------------ UX47
// Line, Segment, Ray and Circle by two clicks or taps: a press without movement keeps the start and says so; the next
// press is the end; Esc drops it; a drag still works
await section('L47', async () => {
  await laptop();
  await load(NS + 'l47', { shapes: [], steps: [], srcView: { cx: 0, cy: 0, s: 80 }, snap: false, nextId: 10 });
  await settle(700);
  const n = async () => (await ST()).list.length;
  const last = async () => { const l = (await ST()).list; return l[l.length - 1]; };
  const near = (p, q) => !!p && Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.02;
  await tool('segment');
  let a = await W(-1, 0), b = await W(1, 0.5);
  await click(a[0], a[1]); await settle(150);
  info.l47hint = await toastText();
  ok('UX47 a click without movement draws nothing yet and says what to do', (await n()) === 0 && info.l47hint === 'Click the second point, or drag', [await n(), info.l47hint]);
  await move(b[0], b[1]); await settle(120);
  await click(b[0], b[1]); await settle(250);
  let s = await last();
  ok('UX47 Segment by two clicks: from the first to the second', (await n()) === 1 && s.kind === 'segment' && near(s.a, [-1, 0]) && near(s.b, [1, 0.5]), s);
  // Esc drops the start
  await tool('line');
  await click(a[0], a[1]); await settle(150);
  await key('Escape'); await settle(150);
  await click(b[0], b[1]); await settle(250);
  ok('UX47 Esc drops a waiting start: the next click starts again', (await n()) === 1, (await ST()).list.map((x) => x.kind));
  await key('Escape'); await settle(150);
  // Circle: the centre, then a point on it
  await tool('circle');
  const c = await W(0, -1), r = await W(1.2, -1);
  await click(c[0], c[1]); await settle(150);
  await click(r[0], r[1]); await settle(250);
  s = await last();
  ok('UX47 Circle by two clicks: centre, then radius', s.kind === 'circle' && near(s.c, [0, -1]) && Math.abs(s.r - 1.2) < 0.02, s);
  // a drag still works
  await tool('line');
  const d0 = await W(-1.5, 1), d1 = await W(1.5, 1.5);
  await drag(d0[0], d0[1], d1[0], d1[1], 8, 16); await settle(250);
  s = await last();
  ok('UX47 Line by a drag, as before', s.kind === 'line' && near(s.a, [-1.5, 1]) && near(s.b, [1.5, 1.5]), s);
  // a finger: two taps make a ray
  await tool('ray');
  const t0 = await W(-1, -2), t1 = await W(0.5, -2);
  await tap(t0[0], t0[1]); await settle(150);
  info.l47tap = await toastText();
  await tap(t1[0], t1[1]); await settle(250);
  s = await last();
  ok('UX47 two taps make a Ray; the first tap says "Tap the second point, or drag"', info.l47tap === 'Tap the second point, or drag' && s.kind === 'ray' && near(s.a, [-1, -2]) && near(s.b, [0.5, -2]), [info.l47tap, s]);
  await tool('select');
});

// ------------------------------------------------------------------------------------------------------------ Russian
await section('RU', async () => {
  await laptop();
  await load(NS + 'ru', SD, `localStorage.setItem('cmw-lang', 'ru')`);
  await nav(`${U}?ns=${NS}ru&lang=ru`); await settle(1500);
  info.ruLang = await ev(`I18N.lang`);
  await tool('hyper');
  info.ruChip = await chipT();
  ok('RU the Hyperbolic line chip in Russian', /^Выберите границу: прямую или окружность/.test(info.ruChip), info.ruChip);
  info.ruTile = await ev(`(document.querySelector('#constructTools .tool[data-tool="hyper"]') || {}).textContent`);
  ok('RU the tile «Гиперболическая»', /Гипербо/.test(info.ruTile || ''), info.ruTile);
  info.ruTitle = await ev(`document.getElementById('leftTitle').textContent`);
  ok('RU X\'s title starts "X ·"', /^X · /.test(info.ruTitle), info.ruTitle);
  info.ruHeads = await ev(`[...document.querySelectorAll('#shapeList .shapes-sub')].map((e) => e.textContent)`);
  ok('RU Shapes headings', info.ruHeads[0] === 'В X (плоскость z)', info.ruHeads);
  await shot('ux-ru-hyper-chip');
  await key('Escape');
  await ev(`localStorage.setItem('cmw-lang', 'en'); 1`);
});

// ------------------------------------------------------------------------------------------------------------ D9 (touch)
await section('D9', async () => {
  let stage = 'start';
  try {
  await phone();
  await load(NS + 'dn', { shapes: [{ id: 'd1', kind: 'disc', c: [0, 0], r: 1, ci: 0, visible: true }, { id: 'p1', kind: 'point', p: [1.5, -1.2], ci: 2, visible: true }], steps: [], srcView: { cx: 0, cy: 0, s: 60 }, snap: false, nextId: 60 });
  await settle(900);
  const sh = async (id) => (await ST()).list.find((s) => s.id === id);
  const o0 = await W(0, 0);
  stage = 'first'; // the first press on a disc only selects it; a drag from it pans the plane
  await tdrag(o0[0], o0[1], o0[0] + 40, o0[1] + 30, 8);
  const o1 = await W(0, 0), d = await sh('d1');
  ok('D9 touch: a drag from an unselected disc selects it and pans the plane (the disc stays)', (await ST()).selected === 'd1' && d.c[0] === 0 && d.c[1] === 0 && Math.abs(o1[0] - o0[0] - 40) < 4, [o0, o1, d]);   // (x only: the context bar that the selection brings makes the plane shorter)
  stage = 'second';
  await tdrag(o1[0], o1[1], o1[0] + 30, o1[1], 8);
  const d2 = await sh('d1'), o2 = await W(0, 0);
  ok('D9 touch: the selected disc then moves with a drag', d2.c[0] > 0.3 && Math.abs(o2[0] - o1[0]) < 4, [d2.c, o1, o2]);
  stage = 'point'; //: a drag moves it at once
  const pp = await W(1.5, -1.2);
  await tdrag(pp[0], pp[1], pp[0] + 30, pp[1] - 20, 8);
  const p1 = await sh('p1');
  ok('D9 touch: a drag from an unselected point moves it', p1.p[0] > 1.8, p1.p);
  stage = 'two'; // in hand, and draw nothing
  await tool('disc');
  const n0 = (await ST()).list.length, o3 = await W(0, 0);
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 150, y: 330, id: 1 }, { x: 250, y: 330, id: 2 }] });
  for (let i = 1; i <= 8; i++) { await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 150, y: 330 + i * 6, id: 1 }, { x: 250, y: 330 + i * 6, id: 2 }] }); await sleep(16); }
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await settle(200);
  const o4 = await W(0, 0);
  ok('D9 touch: two fingers pan with a drawing tool, and draw nothing', Math.abs(o4[1] - o3[1] - 48) < 6 && (await ST()).list.length === n0, [o3, o4, n0, (await ST()).list.length]);
  stage = 'edge';
  const box = await ev(`(() => { const b = document.getElementById('paneL').getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; })()`);
  await tdrag(box[0] + 6, box[1] + 200, box[0] + 60, box[1] + 240, 8);
  ok('D9 touch: a press in the outer 16 px draws nothing (it pans)', (await ST()).list.length === n0, (await ST()).list.length);
  stage = 'drawn'; //; a press elsewhere draws
  const q = await W(-2, 0.5), q2 = await W(-1.4, 1.1);
  await tdrag(q[0], q[1], q2[0], q2[1], 8);
  const n1 = (await ST()).list.length, dr = (await ST()).list[n1 - 1];
  info.d9dr = dr; info.d9n = [n0, n1];
  const mid = await W(dr.c[0], dr.c[1]);
  await tdrag(mid[0], mid[1], mid[0] + 24, mid[1] + 24, 8);
  const dr2 = (await ST()).list.find((x) => x.id === dr.id);
  ok('D9 touch: a drawing tool, a press on the disc just drawn moves it (no new shape)', n1 === n0 + 1 && (await ST()).list.length === n1 && Math.abs(dr2.c[0] - dr.c[0]) > 0.2, [n0, n1, dr.c, dr2.c]);
  const far = await W(1.6, 1.6), far2 = await W(2.2, 1.9);
  await tdrag(far[0], far[1], far2[0], far2[1], 8);
  ok('D9 touch: a press elsewhere draws', (await ST()).list.length === n1 + 1, [(await ST()).list.length, n1]);
  } catch (e) { fails.push({ name: 'D9 stage ' + stage, got: String(e && e.message || e).slice(0, 300) }); }
});

// ------------------------------------------------------------------------------------------------------------ D9 (laptop)
await section('D9L', async () => {
  let stage = 'start';
  try {
  await laptop();
  await load(NS + 'dl', { shapes: [{ id: 'd1', kind: 'disc', c: [-2, -1.5], r: 0.4, ci: 0, visible: true }], steps: [], srcView: { cx: 0, cy: 0, s: 80 }, snap: true, nextId: 60 });
  await settle(900);
  // a drag with Alt held throughout (the kit's drag takes no modifiers)
  const adrag = async (x0, y0, x1, y1, mods) => {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0, y: y0, modifiers: mods });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x0, y: y0, button: 'left', buttons: 1, clickCount: 1, modifiers: mods });
    for (let i = 1; i <= 8; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0 + (x1 - x0) * i / 8, y: y0 + (y1 - y0) * i / 8, button: 'left', buttons: 1, modifiers: mods }); await sleep(16); }
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x1, y: y1, button: 'left', buttons: 0, clickCount: 1, modifiers: mods });
    await settle(200);
  };
  stage = 'draw';
  await tool('disc');
  const n0 = (await ST()).list.length;
  const a = await W(1, 1), a2 = await W(1.6, 1);
  await adrag(a[0], a[1], a2[0], a2[1], 0);
  const n1 = (await ST()).list.length, dr = (await ST()).list[n1 - 1];
  ok('D9 laptop: a drawing tool draws a disc', n1 === n0 + 1, [n0, n1]);
  stage = 'move';
  const mid = await W(dr.c[0] + 0.2, dr.c[1]), mid2 = await W(dr.c[0] + 0.2, dr.c[1] + 0.8);
  await adrag(mid[0], mid[1], mid2[0], mid2[1], 0);
  const dr2 = (await ST()).list.find((x) => x.id === dr.id);
  ok('D9 laptop: a press on the disc just drawn moves it (no new shape)', (await ST()).list.length === n1 && Math.abs(dr2.c[1] - dr.c[1]) > 0.5, [dr.c, dr2.c, (await ST()).list.length]);
  stage = 'alt';
  const cc = await W(dr2.c[0] + 0.15, dr2.c[1]), e2 = await W(dr2.c[0] + 0.55, dr2.c[1]);
  const startZ = [dr2.c[0] + 0.15, dr2.c[1]];
  await adrag(cc[0], cc[1], e2[0], e2[1], 1);
  const l3 = (await ST()).list, nw = l3[l3.length - 1];
  ok('D9 laptop: Alt + press draws a new shape even on the disc just drawn', l3.length === n1 + 1 && nw.id !== dr.id, [l3.length, n1]);
  const off = (v) => Math.abs(v * 4 - Math.round(v * 4));   // (the grid snaps to quarters here: a raw point is off it)
  ok('D9 laptop: what Alt places does not snap', nw && nw.c && (nw.c[0] !== startZ[0] || nw.c[1] !== startZ[1]) && Math.hypot(nw.c[0] - startZ[0], nw.c[1] - startZ[1]) < 0.05 && (off(nw.c[0]) > 0.01 || off(nw.c[1]) > 0.01), [nw && nw.c, startZ]);
  stage = 'altselect';
  await tool('select');
  const hz = await W(startZ[0] + 0.12, startZ[1] + 0.1);   // (inside both discs, away from their handles)
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: hz[0], y: hz[1] });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: hz[0], y: hz[1], button: 'left', buttons: 1, clickCount: 1, modifiers: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: hz[0], y: hz[1], button: 'left', buttons: 0, clickCount: 1, modifiers: 1 });
  await settle(200);
  const sel1 = (await ST()).selected;
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: hz[0], y: hz[1], button: 'left', buttons: 1, clickCount: 1, modifiers: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: hz[0], y: hz[1], button: 'left', buttons: 0, clickCount: 1, modifiers: 1 });
  await settle(200);
  const sel2 = (await ST()).selected;
  ok('D9 laptop: with Select, Alt-click still cycles the shapes under it', !!sel1 && !!sel2 && sel1 !== sel2, [sel1, sel2]);
  } catch (e) { fails.push({ name: 'D9 laptop stage ' + stage, got: String(e && e.message || e).slice(0, 300) }); }
});

await grab();
return { checks, fails: fails.length, failed: fails, info, errs: errs.slice(0, 12) };
