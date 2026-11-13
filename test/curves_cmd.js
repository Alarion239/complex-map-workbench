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
// (the preimage scenes of five targets, the target legend and the formula areas' renderer paths are in
// curves_target_cmd.js: the steps view does not draw them to the same tolerance, or has no right pane to read them in.)
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const K = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'curves_kit.js'), 'utf8'))({ ev, send, go, load, shot, settled, view, fs, DIR, ok, R });
const { BASE, PORT, settle, typeIn, addFormula, shapes } = K;
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
// (the scenes are in the kit; the five preimage scenes the steps view draws differently are in curves_target_cmd.js)
const MOVED = ['pre_target_lemniscate_exp', 'pre_target_tan_poles', 'pre_target_complex_sides_0', 'pre_target_complex_sides_0.25', 'pre_target_complex_sides_0.5'];
for (const sc of K.SC) if (!MOVED.includes(sc.name)) await K.runScene(sc);
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
  // (the targets are added as before; the legend's check is in curves_target_cmd.js; no run-time field in the saved state)
  await addFormula('|w| = 1');
  await addFormula('Re w^2 = 1');
  await settle(1200);
  await addFormula('|z^{30}-1| = 0');
  await addFormula('Re z^2 = 1');
  await settle(800);
  const saved = await ev(`localStorage.getItem('complex-map-workbench-v1:curves-p5') || ''`);
  R.savedErr = /"_err"/.test(saved) || JSON.stringify(await shapes()).includes('_err');
  ok('no run-time _err field in the saved state or __cmwShapes', !R.savedErr && saved.length > 0, R.savedErr);
}
R.logs3 = (await logs()).filter((l) => /EXC|error/i.test(l.t));
ok('no page errors (exact truth scenes)', !R.logs3.length, R.logs3);
return { pass: !fails.length, fails, results: R };
