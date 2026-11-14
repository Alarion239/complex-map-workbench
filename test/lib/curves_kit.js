// What the curves suites share: the formula box helpers, the exact-truth scenes (a curve added through the formula box,
// its ink the difference between the canvas with it shown and hidden, scored against the true curve computed here) and
// the runner of one scene. An expression for eval in a suite:
// `const K = eval(fs.readFileSync(...))({ ev, send, go, load, shot, settled, view, fs, DIR, ok, R })`.
({ ev, send, go, load, shot, settled, view, fs, DIR, ok, R }) => {
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
// (the page is quiet: both panes' frames done, no animation running)
const settle = async () => { await settled({ max: 20000 }); };
const BASE = { pattern: 'solid', lines: false, unit: false, fov: false, outline: false, chev: false, alpha: 0.85, hideLeft: false, hideRight: false, solo: null, v3: true, v4: true, v5: true, nextId: 50 };
const typeIn = async (t) => {
  await ev(`(() => { const i = document.getElementById('formulaInput'); i.focus(); i.value = ${JSON.stringify(t)}; i.dispatchEvent(new Event('input')); return 1; })()`);
  // (the formula box's preview shows the text it parsed, or its error)
  await settled({ until: `document.getElementById('formulaPrev').textContent.trim() !== ''`, max: 5000 });
  return ev(`({ prev: document.getElementById('formulaPrev').textContent, err: !!document.querySelector('#formulaPrev .err'), note: document.getElementById('formulaNote').hidden ? '' : document.getElementById('formulaNote').textContent, tag: document.getElementById('formulaPlane').textContent })`);
};
// (the add clears the input when it made the shape; an error stays in the preview)
const addFormula = async (t) => {
  const r = await typeIn(t);
  await ev(`document.getElementById('formulaAdd').click()`);
  await settled({ until: `!document.getElementById('formulaInput').value || !!document.querySelector('#formulaPrev .err')`, max: 5000 });
  return r;
};
const shapes = () => ev('__cmwShapes()');
// (a target's stroke has a halo that lightens what is under it towards the paper: over a coloured plane that changes the
// colour too, but it is not ink. A pixel whose change is only a blend towards white, within 32 levels, is halo. This hides
// a stroke only where it is itself a lightening of what is under it: a coloured stroke changes a pixel in some other
// direction, so a missing or misplaced preimage still shows as ink missing from the shape's recall and as ink far from it)
const isHalo = (on, off, j) => {
  let dot = 0, nn = 0, res = 0;
  for (let c = 0; c < 3; c++) { const o = off[j + c]; dot += (on[j + c] - o) * (255 - o); nn += (255 - o) * (255 - o); }
  const a = nn > 0 ? dot / nn : 0;
  for (let c = 0; c < 3; c++) {
    const o = off[j + c];
    res = Math.max(res, Math.abs(on[j + c] - o - a * (255 - o)));
  }
  return a > 0 && res < 32;
};
// the ink of shape/target id on pane side: pixels that change by more than 90 (sum of |dRGB|) when it is hidden (skipHalo: not the
// target stroke's halo)
// (the steps view has one plane: the source plane is step 0, the right pane's plane is the chain's last step)
// (a later plane takes the shared view of the steps view, so the right pane's pinned view `rv` is set as that view first)
const inkOf = async (side, id, isTarget, nSteps, rv, skipHalo) => {
  if (await ev(`document.documentElement.classList.contains('sv')`)) {
    if (side === 'R') await ev(`__cmwSet('srcView', ${JSON.stringify(rv)}); 1`);
    await ev(`__cmwSteps({ go: ${side === 'R' ? nSteps : 0}, now: true })`);
    await settle();
    side = 'L';
  }
  const snap = `(() => { const c = document.getElementById('canvas${side}'); const s = document.createElement('canvas'); s.width = c.width; s.height = c.height; const x = s.getContext('2d', { willReadFrequently: true }); x.drawImage(c, 0, 0); return Array.from(x.getImageData(0, 0, s.width, s.height).data); })()`;
  const geo = await ev(`(() => { const c = document.getElementById('canvas${side}'), r = c.getBoundingClientRect(); return { w: c.width, h: c.height, r: [r.left, r.top], o: __cmwW2S('${side}', 0, 0), x1: __cmwW2S('${side}', 1, 0), y1: __cmwW2S('${side}', 0, 1) }; })()`);
  const on = await ev(snap);
  await ev(`(() => { const S = __cmwShapes(); return 1; })()`);
  // hide it through its row's eye button
  const idx = await ev(`(() => { const S = __cmwShapes(); const list = ${isTarget ? 'S.targets' : 'S.shapes'}; return list.findIndex((s) => s.id === ${JSON.stringify(id)}) + ${isTarget ? 'S.shapes.length' : 0}; })()`);
  await ev(`document.querySelectorAll('#shapeList .icon-btn.eye')[${idx}].click()`);
  await settle();
  const off = await ev(snap);
  await ev(`document.querySelectorAll('#shapeList .icon-btn.eye')[${idx}].click()`);
  await settle();
  const W = geo.w, H = geo.h, ink = [];
  for (let i = 0; i < W * H; i++) {
    const d = Math.abs(on[4 * i] - off[4 * i]) + Math.abs(on[4 * i + 1] - off[4 * i + 1]) + Math.abs(on[4 * i + 2] - off[4 * i + 2]);
    if (d <= 90) continue;
    if (skipHalo && isHalo(on, off, 4 * i)) continue;
    ink.push([i % W + 0.5, Math.floor(i / W) + 0.5]);
  }
  // world -> canvas px (dpr 1: CSS px relative to the canvas)
  const sx = geo.x1[0] - geo.o[0], sy = geo.y1[1] - geo.o[1];
  const toPx = (re, im) => [geo.o[0] - geo.r[0] + re * sx, geo.o[1] - geo.r[1] + im * sy];
  return { W, H, ink, toPx };
};
// truth: a list of world polylines (dense); score ink against it in px
const score = (name, I, polys, margin = 8, maxFar = 0) => {
  const pts = [];
  for (const pl of polys) {
    let prev = null;
    for (const [re, im] of pl) {
      const p = I.toPx(re, im);
      if (!Number.isFinite(p[0] + p[1]) || Math.abs(p[0]) > 1e6 || Math.abs(p[1]) > 1e6) { prev = null; continue; }
      if (prev) { const n = Math.ceil(Math.hypot(p[0] - prev[0], p[1] - prev[1]) / 0.25); if (n < 4000) for (let k = 1; k < n; k++) pts.push([prev[0] + (p[0] - prev[0]) * k / n, prev[1] + (p[1] - prev[1]) * k / n]); }
      pts.push(p); prev = p;
    }
  }
  const G = 4, grid = new Map(), keyOf = (x, y) => Math.floor(x / G) + ',' + Math.floor(y / G);
  const add = (m, p) => { const k = keyOf(p[0], p[1]); let a = m.get(k); if (!a) m.set(k, (a = [])); a.push(p); };
  for (const p of pts) if (p[0] > -20 && p[0] < I.W + 20 && p[1] > -20 && p[1] < I.H + 20) add(grid, p);
  const near = (m, p, r) => { let d = Infinity; const gx = Math.floor(p[0] / G), gy = Math.floor(p[1] / G), k = Math.ceil(r / G); for (let i = -k; i <= k; i++) for (let j = -k; j <= k; j++) { const a = m.get((gx + i) + ',' + (gy + j)); if (a) for (const q of a) { const e = Math.hypot(q[0] - p[0], q[1] - p[1]); if (e < d) d = e; } } return d; };
  const dist = I.ink.map((p) => near(grid, p, 12));
  dist.sort((a, b) => a - b);
  const far = dist.filter((d) => d > 2.5).length;
  const inkG = new Map();
  for (const p of I.ink) add(inkG, p);
  let n = 0, hit = 0;
  for (const p of pts) {
    if (p[0] < margin || p[0] > I.W - margin || p[1] < margin || p[1] > I.H - margin) continue;
    n++;
    if (near(inkG, p, 4) <= 2) hit++;
  }
  const r = { ink: I.ink.length, spill: I.ink.length ? far / I.ink.length : null, p99: dist.length ? +dist[Math.floor(0.99 * (dist.length - 1))].toFixed(2) : null, max: dist.length ? +dist[dist.length - 1].toFixed(2) : null, recall: n ? hit / n : null, n };
  R[name] = r;
  ok(`${name}: ink drawn`, r.ink > 50, r);
  r.far = far;
  ok(`${name}: every ink pixel within 2.5 px of the true curve${maxFar ? ` (at most ${maxFar} isolated stray px)` : ''}`, far <= maxFar, r);
  ok(`${name}: the true curve is drawn everywhere in the pane (recall >= 0.999)`, r.recall >= 0.999, r);
  return r;
};
const segPts = (a, b, n = 20000) => Array.from({ length: n + 1 }, (_, k) => [a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
const circle = (c, r, n = 4096) => [Array.from({ length: n + 1 }, (_, k) => [c[0] + r * Math.cos(2 * Math.PI * k / n), c[1] + r * Math.sin(2 * Math.PI * k / n)])];
const SC = [
  { name: 'exp_imag_axis', expr: 'Re z = 0', steps: [{ type: 'exp', params: {} }], rv: { cx: 0, cy: 0, s: 150 }, truth: () => circle([0, 0], 1) },
  { name: 'cayley_real_axis', expr: 'Im z = 0', steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' } }], rv: { cx: 0, cy: 0, s: 150 }, truth: () => circle([0, 0], 1) },
  { name: 'cayley_real_axis_at_1', expr: 'Im z = 0', steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' } }], rv: { cx: 1, cy: 0, s: 6000 }, truth: () => [Array.from({ length: 20001 }, (_, k) => { const t = -0.1 + 0.2 * k / 20000; return [Math.cos(t), Math.sin(t)]; })] },
  { name: 'sq_line_parabola', expr: 'Re z = 1', steps: [{ type: 'pown', params: { n: 2 } }], rv: { cx: -1, cy: 0, s: 60 }, truth: () => [Array.from({ length: 8001 }, (_, k) => { const v = -40 + 80 * k / 8000; return [1 - v * v / 4, v]; })] },
  { name: 'recip_hyperbola_lemniscate', expr: 'Re z^2 = 1', steps: [{ type: 'recip', params: {} }], rv: { cx: 0, cy: 0, s: 200 }, truth: () => {
    // r^2 = cos 2 theta, both lobes, through 0
    const out = [];
    for (const t0 of [-Math.PI / 4, 3 * Math.PI / 4]) out.push(Array.from({ length: 20001 }, (_, k) => { const t = t0 + Math.PI / 2 * k / 20000; const r = Math.sqrt(Math.max(0, Math.cos(2 * t))); return [r * Math.cos(t), r * Math.sin(t)]; }));
    return out;
  } },
  { name: 'abs_sin_traced', expr: '|\\sin z| = 1', steps: [{ type: 'exp', params: {} }], side: 'L', srcView: { cx: 0, cy: 0, s: 60 }, rv: { cx: 0, cy: 0, s: 30 }, truth: () => {
    const f = (sgn) => Array.from({ length: 20001 }, (_, k) => { const x = -12 + 24 * k / 20000; return [x, sgn * Math.asinh(Math.abs(Math.cos(x)))]; });
    return [f(1), f(-1)];
  } },
  { name: 'pre_target_hyperbola_z2', target: 'Re w^2 = 1', steps: [{ type: 'pown', params: { n: 2 } }], side: 'L', srcView: { cx: 0, cy: 0, s: 80 }, rv: { cx: 0, cy: 0, s: 60 }, truth: () => {
    // r^4 cos 4 theta = 1 on the four branches |4 theta - 2 k pi| < pi/2
    const out = [];
    for (let k = 0; k < 4; k++) out.push(Array.from({ length: 8001 }, (_, i) => { const t = k * Math.PI / 2 + (-Math.PI / 8 + 1e-6 + (Math.PI / 4 - 2e-6) * i / 8000); const r = Math.pow(Math.cos(4 * t), -0.25); return [r * Math.cos(t), r * Math.sin(t)]; }));
    return out;
  } },
  { name: 'pre_target_lemniscate_exp', target: '|w^2-1| = 1', steps: [{ type: 'exp', params: {} }], side: 'L', srcView: { cx: 1.5, cy: 0, s: 60 }, rv: { cx: 0, cy: 0, s: 120 }, truth: () => {
    // (the pane's left edge stays right of Re z = -5.7: the curve's two arms meet the node w = 0 as Re z -> -inf, where the level
    // function |w^2 - 1| - 1 loses its digits in float32 and no stroke can be placed within a pixel)
    // e^{2z} = 1 + e^{i phi}: z = log(1 + e^{i phi}) / 2 + k pi i
    const out = [];
    for (let k = -4; k <= 4; k++) out.push(Array.from({ length: 20001 }, (_, i) => { const ph = -Math.PI + 1e-9 + (2 * Math.PI - 2e-9) * i / 20000; const a = 1 + Math.cos(ph), b = Math.sin(ph); return [0.5 * Math.log(Math.hypot(a, b)), 0.5 * Math.atan2(b, a) + k * Math.PI]; }));
    return out;
  } },
  // the preimage stroke is a crossing test, not a pole or a kink (review findings): tan(Re w) = 1 and 1/Re w = 1 add
  // (maxFar: an isolated stray pixel is tolerated; the false pole-line stroke is a band ~4 px wide over the pane)
  // no stroke along the pole lines of g (Re w = pi/2 + k pi; Re w = 0), and the complex-sided sin w = conj(sin w)
  // keeps its axes at any sub-pixel offset (|A - B| had a kink that the jump test dropped)
  { name: 'pre_target_tan_poles', maxFar: 2, target: '\\tan(\\operatorname{Re} w) = 1', steps: [{ type: 'custom', params: { expr: 'z+0.25i', cut: 180 } }], side: 'L', srcView: { cx: 1.5, cy: 0, s: 80 }, rv: { cx: 1.5, cy: 0, s: 80 },
    truth: () => [-3, -2, -1, 0, 1, 2, 3].map((k) => segPts([Math.PI / 4 + k * Math.PI, -40], [Math.PI / 4 + k * Math.PI, 40])) },
  { name: 'pre_target_recip_pole', maxFar: 2, target: '\\frac{1}{\\operatorname{Re} w} = 1', steps: [{ type: 'custom', params: { expr: 'z+0.25i', cut: 180 } }], side: 'L', srcView: { cx: 0.25, cy: 0, s: 80 }, rv: { cx: 0, cy: 0, s: 80 },
    truth: () => [segPts([1, -40], [1, 40])] },
  ...[0, 0.25, 0.5].map((off) => ({ name: `pre_target_complex_sides_${off}`, target: '\\sin w = \\overline{\\sin w}', steps: [{ type: 'pown', params: { n: 2 } }], side: 'L', srcView: { cx: 0, cy: off / 90, s: 90 }, rv: { cx: 0, cy: 0, s: 30 },
    truth: () => {
      // Im sin(z^2) = 0: the axes (Im z^2 = 0) and the hyperbolas x^2 - y^2 = pi/2 + k pi
      const out = [segPts([-10, 0], [10, 0]), segPts([0, -10], [0, 10])];
      for (let k = -8; k <= 7; k++) {
        const c = Math.PI / 2 + k * Math.PI;
        for (const sx of [1, -1]) out.push(Array.from({ length: 4001 }, (_, i) => { const t = -4 + 8 * i / 4000; return c > 0 ? [sx * Math.sqrt(c) * Math.cosh(t), Math.sqrt(c) * Math.sinh(t)] : [Math.sqrt(-c) * Math.sinh(t), sx * Math.sqrt(-c) * Math.cosh(t)]; }));
      }
      return out;
    } })),
];
const runScene = async (sc) => {
  const st = Object.assign({}, BASE, { steps: sc.steps.map((s) => Object.assign({ on: true }, s)), srcView: sc.srcView || { cx: 0, cy: 0, s: 60 }, rightView: sc.rv, targets: [], shapes: [] });
  // the shapes come from the formula box as a user adds them (exact shapes or a curve formula)
  await load('curves-' + sc.name, st);
  await settle();
  if (sc.target) await addFormula(sc.target); else await addFormula(sc.expr);
  await settle();
  // a pinned right view (the app may have refit after the add)
  const s = await shapes();
  const id = sc.target ? s.targets[0] && s.targets[0].id : s.shapes[0] && s.shapes[0].id;
  if (!ok(`${sc.name}: the formula added a shape`, !!id, s)) return;
  // the right view as pinned: reload with the state the app saved (the add is in it) plus the pinned view
  // (the app has saved the shape or target the formula box added)
  await settled({ until: `(() => { const st = JSON.parse(localStorage.getItem('complex-map-workbench-v1:curves-${sc.name}') || 'null'); return !!st && (st.shapes || []).length + (st.targets || []).length > 0; })()`, max: 5000 });
  await ev(`(() => { const k = 'complex-map-workbench-v1:curves-${sc.name}'; const st = JSON.parse(localStorage.getItem(k)); st.rightView = ${JSON.stringify(sc.rv)}; st.srcView = ${JSON.stringify(sc.srcView || { cx: 0, cy: 0, s: 60 })}; st.clipWin = null; localStorage.setItem(k, JSON.stringify(st)); return 1; })()`);
  await go(`http://localhost:${PORT}/test.html?ns=curves-${sc.name}`);
  await settled({ until: `typeof __cmwSet === 'function' && typeof __cmwShapes === 'function'`, max: 30000 });
  await settle();
  // (#363: the reload opens the saved pattern as the phase; the scoring reads the solid fill, the renderer's own)
  await ev(`__cmwSet('pattern', ${JSON.stringify(BASE.pattern)}); 1`); await settle();
  // (the steps view draws a shape's curve on its colour plane only while Outlines is on; the classic right pane's image always does)
  if (await ev(`document.documentElement.classList.contains('sv')`)) { await ev(`__cmwSet('outline', true); 1`); await settle(); }
  const I = await inkOf(sc.side || 'R', id, !!sc.target, sc.steps.length, sc.rv, !!sc.target);
  score(sc.name, I, sc.truth(), 8, sc.maxFar || 0);
  await shot('curves-' + sc.name, sc.side === 'L' ? { x: 268, y: 44, width: 432, height: 570 } : { x: 706, y: 44, width: 432, height: 570 });
};
return { BASE, PORT, settle, typeIn, addFormula, shapes, SC, runScene };
}
