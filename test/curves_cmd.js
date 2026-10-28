// Equation curves wired into the app (notes/curves-design.md 4; the user's "Could you allow for 1-dimensional regions?
// For example, if I want to define a line as Re z = 0?"). A command file for a CDP daemon (test/cdp_kit README):
//   python3 build.py && test/<you>_cdp/q.sh test/curves_cmd.js
// Two parts:
// 1. Behaviour: the formula box routes equations (preview, classification messages, notes), exact recognitions become
//    the app's own shapes with handles (one undo step), traced curves a 'fcurve' shape; the command palette; row TeX;
//    the equation editor; undo / redo / reload; right-click integrals (closed: 2 pi i of 1/z around a Cassini oval);
//    hit-testing; globes, morph and export without errors; w-plane equations become targets.
// 2. Exact truth (strokes as rendered, read from the canvas): the ink of a curve is the difference between the
//    canvas with the curve shown and hidden. Every ink pixel must lie within 2.5 px of the TRUE curve (computed here,
//    independently of the app) and every point of the true curve in the pane within 2 px of ink:
//      exp of Re z = 0 is the unit circle; the Cayley image of the real axis is the unit circle (through w = 1, the
//      image of infinity); z^2 of Re z = 1 is the parabola Re w = 1 - (Im w)^2 / 4; 1/z of the traced hyperbola
//      Re z^2 = 1 is the lemniscate r^2 = cos 2 theta (through 0, the image of its ends at infinity); the traced curve
//      |sin z| = 1 itself (sinh^2 y = cos^2 x); the preimage of the target Re w^2 = 1 under z^2 (r^4 cos 4 theta = 1,
//      drawn per pixel by the preimage shader) and of the target lemniscate |w^2 - 1| = 1 under exp
//      (z = log(1 + e^{i phi}) / 2 + k pi i).
// (the daemon's port, as its load() opens it)
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const settle = async (ms = 1200) => {
  await sleep(ms);
  for (let i = 0; i < 40; i++) {
    const busy = await ev(`(() => { const a = document.getElementById('leftLed'), b = document.getElementById('rightLed'); return /busy/.test((a ? a.className : '') + (b ? b.className : '')); })()`);
    if (!busy) break;
    await sleep(150);
  }
  await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
};
const BASE = { pattern: 'solid', lines: false, unit: false, fov: false, outline: false, chev: false, alpha: 0.85, hideLeft: false, hideRight: false, solo: null, v3: true, v4: true, v5: true, nextId: 50 };
const typeIn = async (t) => {
  await ev(`(() => { const i = document.getElementById('formulaInput'); i.focus(); i.value = ${JSON.stringify(t)}; i.dispatchEvent(new Event('input')); return 1; })()`);
  await sleep(120);
  return ev(`({ prev: document.getElementById('formulaPrev').textContent, err: !!document.querySelector('#formulaPrev .err'), note: document.getElementById('formulaNote').hidden ? '' : document.getElementById('formulaNote').textContent, tag: document.getElementById('formulaPlane').textContent })`);
};
const addFormula = async (t) => { const r = await typeIn(t); await ev(`document.getElementById('formulaAdd').click()`); await sleep(250); return r; };
const shapes = () => ev('__cmwShapes()');
await view(1440, 900);

// ------------------------------------------------------------------ 1. behaviour
await load('curves', Object.assign({}, BASE, { shapes: [], targets: [], steps: [{ type: 'exp', params: {}, on: true }] }));
await settle(1500);
{
  const m = {};
  for (const t of ['Re z = 0', 'Re z = 0, Im z > 0', 'Re z = 0, |z| < 2', '|z| = 1, Im z > 0', '|z - 1| = 2 or Re z = 3', '\\arg z = \\pi/4', 'Re z^2 = 1', 'z = 1', 'Re z = 0 or |z| < 1', 'Re z = 1, Im z = 2', '|z| = -1', '|z| < 1', 'Re w = 1']) m[t] = await typeIn(t);
  R.box = m;
  ok('Re z = 0 previews and says it adds a line', !m['Re z = 0'].err && /a line/.test(m['Re z = 0'].note), m['Re z = 0']);
  ok('a restricted line is a ray', /a ray/.test(m['Re z = 0, Im z > 0'].note), m['Re z = 0, Im z > 0']);
  ok('a line cut by a disc is a segment', /a segment/.test(m['Re z = 0, |z| < 2'].note), m['Re z = 0, |z| < 2']);
  ok('a restricted circle is an arc', /an arc/.test(m['|z| = 1, Im z > 0'].note), m['|z| = 1, Im z > 0']);
  ok("'or' unites a circle and a line", /a circle and a line/.test(m['|z - 1| = 2 or Re z = 3'].note), m['|z - 1| = 2 or Re z = 3']);
  ok('arg z = pi/4 is a ray', /a ray/.test(m['\\arg z = \\pi/4'].note), m['\\arg z = \\pi/4']);
  ok('Re z^2 = 1 is traced', /traced curve/.test(m['Re z^2 = 1'].note), m['Re z^2 = 1']);
  ok('z = 1 is refused with the complex-sides message', m['z = 1'].err && /real/.test(m['z = 1'].prev) && /Re, Im/.test(m['z = 1'].prev), m['z = 1']);
  ok('a curve or an area is refused (mix)', m['Re z = 0 or |z| < 1'].err && /mixes a curve with an area/.test(m['Re z = 0 or |z| < 1'].prev), m['Re z = 0 or |z| < 1']);
  ok('two equations at once are refused (points)', m['Re z = 1, Im z = 2'].err, m['Re z = 1, Im z = 2']);
  ok('a circle of negative radius is refused with its note', m['|z| = -1'].err && /negative/.test(m['|z| = -1'].prev), m['|z| = -1']);
  ok('an inequality is still an area (no curve note)', !m['|z| < 1'].err && !m['|z| < 1'].note, m['|z| < 1']);
  ok('an equation in w is a target', !m['Re w = 1'].err && /as a target/.test(m['Re w = 1'].note) && /w/.test(m['Re w = 1'].tag), m['Re w = 1']);

  // adding: exact shapes with handles, one undo step for several
  await addFormula('Re z = 0');
  let s = await shapes();
  const line = s.shapes[s.shapes.length - 1];
  ok('Re z = 0 adds the line through 0 and i (unit direction)', line && line.kind === 'line' && line.a[0] === 0 && line.a[1] === 0 && line.b[0] === 0 && line.b[1] === 1, line);
  R.rowTex = await ev(`document.querySelector('#shapeList .d') ? document.querySelector('#shapeList .d').title : null`);
  // (issue #38: a row's tooltip is the spoken text, not the LaTeX)
  ok("the line's row shows its equation (its tooltip in words)", R.rowTex === 'Re z = 0', R.rowTex);
  const n0 = s.shapes.length;
  await addFormula('|z - 1| = 2 or Re z = 3');
  s = await shapes();
  ok("'or' adds a circle and a line", s.shapes.length === n0 + 2 && s.shapes[n0].kind === 'circle' && s.shapes[n0 + 1].kind === 'line' && s.shapes[n0].r === 2, s.shapes.slice(n0));
  await ev(`document.getElementById('undoBtn').click()`);
  await sleep(300);
  s = await shapes();
  ok('one undo removes both', s.shapes.length === n0, s.shapes.length);
  await ev(`document.getElementById('redoBtn').click()`);
  await sleep(300);
  s = await shapes();
  ok('redo brings both back', s.shapes.length === n0 + 2, s.shapes.length);
  await addFormula('|z| = 1, Im z > 0');
  s = await shapes();
  const arc = s.shapes[s.shapes.length - 1];
  ok('|z| = 1, Im z > 0 adds the arc 1 -> i -> -1', arc.kind === 'arc' && arc.a[0] === 1 && arc.b[0] === -1 && Math.abs(arc.m[1] - 1) < 1e-12, arc);
  await addFormula('Re z^2 = 1');
  s = await shapes();
  const fc = s.shapes[s.shapes.length - 1];
  ok('Re z^2 = 1 adds a curve formula holding its source', fc.kind === 'fcurve' && fc.expr === 'Re z^2 = 1', fc);
  const rows = await ev(`[...document.querySelectorAll('#shapeList .d')].map((d) => d.title)`);
  ok("the curve formula's row says its equation (the tooltip, not the LaTeX)", rows.includes('Re (z²) = 1') && rows.every((t) => !/\\\\operatorname/.test(t)), rows);
  // the equation editor: an area keeps the last good equation; a new equation is taken
  const ed = await ev(`(() => { const i = [...document.querySelectorAll('.shape-edit input.math-src')].pop(); if (!i) return null; i.value = '|z| < 1'; i.dispatchEvent(new Event('input')); const bad = i.classList.contains('bad'); i.value = 'Re z^2 = 2'; i.dispatchEvent(new Event('input')); i.dispatchEvent(new Event('change')); return { bad, now: i.classList.contains('bad') }; })()`);
  await sleep(300);
  s = await shapes();
  ok('the editor refuses an area and takes an equation', ed && ed.bad && !ed.now && s.shapes[s.shapes.length - 1].expr === 'Re z^2 = 2', [ed, s.shapes[s.shapes.length - 1]]);
  // the command palette offers the curve ('Add this curve' in its Curve formulas group) and adds it
  await ev(`document.getElementById('cmdBtn').click()`);
  await sleep(300);
  await ev(`(() => { const i = document.getElementById('palInput'); i.value = 'Im z = 1'; i.dispatchEvent(new Event('input')); return 1; })()`);
  await sleep(400);
  const palItems = await ev(`[...document.querySelectorAll('#palList [role=option], #palList .pal-item, #palList button')].map((b) => b.textContent.trim()).slice(0, 6)`);
  R.palette = palItems;
  ok('the palette offers "Add this curve"', palItems.some((t) => /Add this curve/.test(t) && /a line/.test(t)), palItems);
  const nBefore = (await shapes()).shapes.length;
  await key('Enter');
  await sleep(400);
  s = await shapes();
  ok('Enter in the palette adds the line Im z = 1', s.shapes.length === nBefore + 1 && s.shapes[nBefore].kind === 'line' && s.shapes[nBefore].a[1] === 1, s.shapes.slice(nBefore));
  // isolated zeros: points in view
  await addFormula('|z^2-1| = 0');
  s = await shapes();
  const pts = s.shapes.filter((x) => x.kind === 'point').map((x) => x.p.join(','));
  ok('|z^2 - 1| = 0 adds the points -1 and 1', pts.includes('-1,0') && pts.includes('1,0'), pts);
  // w: a target
  await addFormula('|w| = 1');
  s = await shapes();
  ok('|w| = 1 adds a target circle', s.targets.length === 1 && s.targets[0].kind === 'circle' && s.targets[0].r === 1, s.targets);
  // reload keeps everything
  await nav(`http://localhost:${PORT}/test.html?ns=curves`);
  await settle(2000);
  const s2 = await shapes();
  ok('a reload keeps the shapes and targets', JSON.stringify(s2.shapes.map((x) => [x.kind, x.expr || ''])) === JSON.stringify(s.shapes.map((x) => [x.kind, x.expr || ''])) && s2.targets.length === 1, s2.shapes.map((x) => x.kind));
  R.logs1 = (await logs()).filter((l) => /EXC|error/i.test(l.t));
  ok('no page errors (formula box)', !R.logs1.length, R.logs1);
}

// integrals: 1/z around the Cassini oval |z^2 - 1| = 2 (a traced closed curve around 0): 2 pi i
await load('curves', Object.assign({}, BASE, { shapes: [{ id: 's1', kind: 'fcurve', expr: '|z^2-1| = 2', ci: 0, visible: true }, { id: 's2', kind: 'fcurve', expr: 'Re z^2 = 1', ci: 1, visible: true }], targets: [], steps: [{ type: 'custom', params: { expr: '1/z', cut: 180 }, on: true }] }));
await settle(1500);
{
  const integ = async (idx) => {
    await ev(`document.querySelectorAll('#shapeList .icon-btn.more')[${idx}].click()`);
    await sleep(200);
    await ev(`[...document.querySelectorAll('.pop.menu .mi')].find((b) => /Integrate/.test(b.textContent)).click()`);
    await sleep(1200);
    const t = await ev(`(() => { const p = document.querySelector('.int-pop'); return p ? p.innerText : null; })()`);
    await key('Escape'); await sleep(200);
    return t;
  };
  const a = await integ(0), b = await integ(1);
  R.integrals = [a, b];
  ok('the closed traced curve integrates 1/z to 2 pi i', /∮/.test(a || '') && /6\.2832\s*i/.test(a || '') && /winding of F∘γ about 0\s*\n?−1/.test(a || ''), a);
  ok('the open hyperbola integrates along its visible part', /∫ along/.test(b || '') && /visible part/.test(b || ''), b);
  // hit-testing: a click on the hyperbola's vertex (1, 0) selects it
  await ev('__cmwSelect(null)');
  const p = await ev(`__cmwW2S('L', 1, 0.6)`);
  // (Re z^2 = 1 at y = 0.6: x = sqrt(1.36))
  const q = await ev(`__cmwW2S('L', Math.sqrt(1.36), 0.6)`);
  await click(q[0], q[1]);
  await sleep(300);
  R.hit = (await shapes()).selected;
  ok('a click on the traced hyperbola selects it', R.hit === 's2', [R.hit, p, q]);
  // a right click on the closed traced curve opens its integral (canvas path: the hit test of the curve)
  await key('Escape');
  const rc = await ev(`__cmwW2S('L', Math.sqrt(3), 0)`);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rc[0], y: rc[1] });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rc[0], y: rc[1], button: 'right', buttons: 2, clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rc[0], y: rc[1], button: 'right', buttons: 0, clickCount: 1 });
  await sleep(600);
  let rtxt = await ev(`(() => { const p = document.querySelector('.int-pop'); if (p) return p.innerText; const m = [...document.querySelectorAll('.pop.menu .mi')].map((b) => b.textContent); return 'MENU ' + m.join(' | '); })()`);
  if (/^MENU/.test(rtxt)) { await ev(`(() => { const it = [...document.querySelectorAll('.pop.menu .mi')].find((b) => /Curve formula 1/.test(b.textContent) || /Integrate/.test(b.textContent)); if (it) it.click(); return 1; })()`); await sleep(1000); rtxt = await ev(`(() => { const p = document.querySelector('.int-pop'); return p ? p.innerText : null; })()`); }
  R.rightClick = rtxt;
  ok('a right click on the Cassini oval integrates around it', /∮ around Curve formula 1/.test(rtxt || '') && /6\.2832\s*i/.test(rtxt || ''), rtxt);
  await key('Escape'); await sleep(200);
  // the figure: its caption names the curves by their equations
  const cap = await ev(`await (async () => { const f = await __cmwBuildFigure({ panels: ['L', 'R'], widthIn: 7, caption: true }); return f ? f.captionTex : null; })()`, 60000);
  R.caption = cap;
  ok('the figure caption names the traced curves', typeof cap === 'string' && /the curve/.test(cap) && /operatorname\{Re\}/.test(cap), cap);
  // globes, morph, export: no errors, strokes on both globes
  await ev(`__cmwSetView('L', 'sphere'); __cmwSetView('R', 'sphere'); 1`);
  await settle(1500);
  await shot('curves-globes');
  const lines = await ev('__cmwLines()');
  ok('both curves have strokes (globes)', lines.filter((l) => l.segs > 100).length === 2, lines);
  await ev(`__cmwSetView('L', 'plane'); __cmwSetView('R', 'plane'); 1`);
  await settle(800);
  await ev('__cmwMorph({ open: true, T: 0.5 })');
  await settle(1200);
  await shot('curves-morph');
  await ev('__cmwMorph({ open: false })');
  await settle(600);
  const png = await ev(`(() => { try { return __cmwRenderOff('R', 600, 400, 1).length; } catch (e) { return 'EXC ' + e.message; } })()`);
  ok('the figure export renders the curves', typeof png === 'number' && png > 1000, png);
  R.logs2 = (await logs()).filter((l) => /EXC|error/i.test(l.t));
  ok('no page errors (integrals, globes, morph, export)', !R.logs2.length, R.logs2);
}

// ------------------------------------------------------------------ 2. exact truth
// the ink of shape/target id on pane side: pixels that change by more than 90 (sum of |dRGB|) when it is hidden
const inkOf = async (side, id, isTarget) => {
  const snap = `(() => { const c = document.getElementById('canvas${side}'); const s = document.createElement('canvas'); s.width = c.width; s.height = c.height; const x = s.getContext('2d', { willReadFrequently: true }); x.drawImage(c, 0, 0); return Array.from(x.getImageData(0, 0, s.width, s.height).data); })()`;
  const geo = await ev(`(() => { const c = document.getElementById('canvas${side}'), r = c.getBoundingClientRect(); return { w: c.width, h: c.height, r: [r.left, r.top], o: __cmwW2S('${side}', 0, 0), x1: __cmwW2S('${side}', 1, 0), y1: __cmwW2S('${side}', 0, 1) }; })()`);
  const on = await ev(snap);
  await ev(`(() => { const S = __cmwShapes(); return 1; })()`);
  // hide it through its row's eye button
  const idx = await ev(`(() => { const S = __cmwShapes(); const list = ${isTarget ? 'S.targets' : 'S.shapes'}; return list.findIndex((s) => s.id === ${JSON.stringify(id)}) + ${isTarget ? 'S.shapes.length' : 0}; })()`);
  await ev(`document.querySelectorAll('#shapeList .icon-btn.eye')[${idx}].click()`);
  await settle(900);
  const off = await ev(snap);
  await ev(`document.querySelectorAll('#shapeList .icon-btn.eye')[${idx}].click()`);
  await settle(600);
  const W = geo.w, H = geo.h, ink = [];
  for (let i = 0; i < W * H; i++) {
    const d = Math.abs(on[4 * i] - off[4 * i]) + Math.abs(on[4 * i + 1] - off[4 * i + 1]) + Math.abs(on[4 * i + 2] - off[4 * i + 2]);
    if (d > 90) ink.push([i % W + 0.5, Math.floor(i / W) + 0.5]);
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
  { name: 'pre_target_lemniscate_exp', target: '|w^2-1| = 1', steps: [{ type: 'exp', params: {} }], side: 'L', srcView: { cx: -1, cy: 0, s: 60 }, rv: { cx: 0, cy: 0, s: 120 }, truth: () => {
    // e^{2z} = 1 + e^{i phi}: z = log(1 + e^{i phi}) / 2 + k pi i
    const out = [];
    for (let k = -4; k <= 4; k++) out.push(Array.from({ length: 20001 }, (_, i) => { const ph = -Math.PI + 1e-9 + (2 * Math.PI - 2e-9) * i / 20000; const a = 1 + Math.cos(ph), b = Math.sin(ph); return [0.5 * Math.log(Math.hypot(a, b)), 0.5 * Math.atan2(b, a) + k * Math.PI]; }));
    return out;
  } },
  // the preimage stroke is a crossing test, not a pole or a kink (review findings): tan(Re w) = 1 and 1/Re w = 1 add
  // (maxFar: an isolated stray pixel is tolerated; the false pole-line stroke was a band ~4 px wide over the pane)
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
for (const sc of SC) {
  const st = Object.assign({}, BASE, { steps: sc.steps.map((s) => Object.assign({ on: true }, s)), srcView: sc.srcView || { cx: 0, cy: 0, s: 60 }, rightView: sc.rv, targets: [], shapes: [] });
  // the shapes come from the formula box as a user adds them (exact shapes or a curve formula)
  await load('curves-' + sc.name, st);
  await settle(1200);
  if (sc.target) await addFormula(sc.target); else await addFormula(sc.expr);
  await settle(1800);
  // a pinned right view (the app may have refit after the add)
  const s = await shapes();
  const id = sc.target ? s.targets[0] && s.targets[0].id : s.shapes[0] && s.shapes[0].id;
  if (!ok(`${sc.name}: the formula added a shape`, !!id, s)) continue;
  if (!sc.side || sc.side === 'R') {
    await ev(`(() => { const st = JSON.parse(localStorage.getItem('complex-map-workbench-v1:curves-${sc.name}')); return 1; })()`);
  }
  // the right view as pinned: reload with the state the app saved (the add is in it) plus the pinned view
  await sleep(400);
  await ev(`(() => { const k = 'complex-map-workbench-v1:curves-${sc.name}'; const st = JSON.parse(localStorage.getItem(k)); st.rightView = ${JSON.stringify(sc.rv)}; st.srcView = ${JSON.stringify(sc.srcView || { cx: 0, cy: 0, s: 60 })}; st.clipWin = null; localStorage.setItem(k, JSON.stringify(st)); return 1; })()`);
  await nav(`http://localhost:${PORT}/test.html?ns=curves-${sc.name}`);
  await settle(2500);
  const I = await inkOf(sc.side || 'R', id, !!sc.target);
  score(sc.name, I, sc.truth(), 8, sc.maxFar || 0);
  await shot('curves-' + sc.name, sc.side === 'L' ? { x: 268, y: 44, width: 432, height: 570 } : { x: 706, y: 44, width: 432, height: 570 });
}
// ------------------------------------------------------------------ 3. review findings (P5)
{
  await load('curves-p5', Object.assign({}, BASE, { shapes: [], targets: [], steps: [{ type: 'pown', params: { n: 2 }, on: true }], srcView: { cx: 0, cy: 0, s: 80 } }));
  await settle(1500);
  const m = {};
  for (const t of ['|z^{30}-1| = 0', '|\\sin(1/z)| = 0', 'Re(z)=0 or Re(z) = 0', '|z|=1 or |z|=1', 'z = 1', '\\sin z = 0']) m[t] = await typeIn(t);
  R.p5box = m;
  ok('|z^{30}-1| = 0 adds points (its zeros), not an empty traced curve', !m['|z^{30}-1| = 0'].err && /30 points/.test(m['|z^{30}-1| = 0'].note) && !/traced/.test(m['|z^{30}-1| = 0'].note), m['|z^{30}-1| = 0']);
  ok('|sin(1/z)| = 0 says only some of its zeros are added', /some of the zeros/.test(m['|\\sin(1/z)| = 0'].note), m['|\\sin(1/z)| = 0']);
  ok("'or' of the same line adds one line", /Adds a line/.test(m['Re(z)=0 or Re(z) = 0'].note), m['Re(z)=0 or Re(z) = 0']);
  ok("'or' of the same circle adds one circle", /Adds a circle/.test(m['|z|=1 or |z|=1'].note), m['|z|=1 or |z|=1']);
  ok('a complex equation names |A − B| = 0 for its points', m['z = 1'].err && /\|A − B\| = 0/.test(m['z = 1'].prev) && m['\\sin z = 0'].err && /\|A − B\| = 0/.test(m['\\sin z = 0'].prev), [m['z = 1'], m['\\sin z = 0']]);
  // the target legend: curve targets are drawn, not shaded; no run-time field in the saved state
  await addFormula('|w| = 1');
  await addFormula('Re w^2 = 1');
  await settle(1200);
  // (v16.5 UX20: on a desktop the target note is Y's head note, "Preimage in X", and what is shaded or drawn is its
  // tooltip: with curve targets only, it says they are drawn, and nothing is shaded)
  R.legend = await ev(`(() => { const e = document.getElementById('rightNote'); return e && !e.hidden ? [e.textContent, e.dataset.tip || ''] : []; })()`);
  ok('the legend of curve targets says drawn, not shaded', R.legend.some((t) => /drawn/i.test(t)) && !R.legend.some((t) => /shaded/i.test(t)), R.legend);
  await addFormula('|z^{30}-1| = 0');
  await addFormula('Re z^2 = 1');
  await settle(800);
  const saved = await ev(`localStorage.getItem('complex-map-workbench-v1:curves-p5') || ''`);
  R.savedErr = /"_err"/.test(saved) || JSON.stringify(await shapes()).includes('_err');
  ok('no run-time _err field in the saved state or __cmwShapes', !R.savedErr && saved.length > 0, R.savedErr);
  // the inverse renderer's formula areas keep their own cap of 4 (the preimage pass's 8 is for traced targets)
  const six = ['|z| < 1', '|z-1| < 0.5', '|z+1| < 0.5', '|z-i| < 0.5', '|z+i| < 0.5', '|z-2| < 0.3'].map((e, i) => ({ id: 'f' + i, kind: 'formula', expr: e, ci: i, visible: true }));
  await load('curves-p5b', Object.assign({}, BASE, { shapes: six, targets: [], steps: [{ type: 'pown', params: { n: 2 }, on: true }] }));
  await settle(2500);
  R.sixPaths = await ev('__cmwPaths()');
  const rp = R.sixPaths.filter((p) => p.role === 'R');
  ok('formula areas: the first four draw inverse, the fifth and sixth forward (fifth formula shape)', rp.length === 6 && rp.slice(0, 4).every((p) => p.path === 'inverse') && rp.slice(4).every((p) => p.path === 'forward' && /fifth formula shape/.test(p.reason || '')), rp);
}
R.logs3 = (await logs()).filter((l) => /EXC|error/i.test(l.t));
ok('no page errors (exact truth scenes)', !R.logs3.length, R.logs3);
return { pass: !fails.length, fails, results: R };
