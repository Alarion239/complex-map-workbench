// A region's image under a Repeat chain drawn by the exact REPT renderer keeps the shape's outline in the shape's
// colour while its carried boundary resolves at the view, as every other step's image does (#1482); where the copies'
// expansion scatters the boundary, no carried outline is drawn, and the exact fill's own edge is the only one.
// - the bite: the rectangle [0.6, 1.6] × [−0.5, 0.5] under Newton's map for z³ − 1 repeated twice, parked on plane 1,
//   Inside regions. Its image is two bounded lobes, and the outline is the image of the rectangle's boundary, which
//   holds the exact fill's edge (an open map's image has its edge in the image of the boundary). EDGE_N points of the
//   boundary are carried to plane 1 on the CPU (N twice, in float64); at each one that lands RING_R px or more inside
//   the canvas, the frame has a stroke pixel within RING_R CSS px of it: a pixel that differs from the same frame with
//   the strokes hidden (__cmwHideStrokes) and lies within INK_TOL of the shape's ink (__cmwLook's edge), for at least
//   HIT_MIN of at least MIN_EDGE such points. At the scene's scale on the desk, and wheel-zoomed in about the image
//   until its scale is at least ZOOM times the scene's (the outline is refined for the view, so looking closer keeps
//   it), on the desk and in a narrow window (NARROW); and at least DEEP times on the desk about the image's top tip
//   (DEEP_N points of the boundary about it carried instead), where most of the image lies past the pane: its pieces
//   there are accepted unrefined (outlineRes's box), so the refined outline has at most DEEP_VERTS_MAX vertices
//   (__cmwRept({ outline }).verts; refining them all takes ten times as many), and the GPU's float32 places the
//   pieces the CPU's float64 accepted;
// - its control: the same count with another shape's ink (a hidden shape of another colour) finds at most CTRL_MAX of
//   them, so a stroke in another colour, or the colour plot's own edge, fails the row;
// - a pan: PAN_STEPS drags of 1 / (2 PAN_STEPS) of the pane's width each, each drawn, move the image left by half the
//   pane and refine the outline again at most PAN_RUNS_MAX times (__cmwRept({ outline }).runs: the refinement is kept
//   per pane-wide cell of the view, not redone per frame), and the outline is still there;
// - a Repeat no exact plan takes (sin, REFUSED_N times: its plane hatched, repeatRefused) draws no carried outline
//   over the hatch, though the sines carry the boundary smoothly: at most NOISE_MAX of the canvas in the shape's ink;
// - the gallery (the same step repeated twenty times over the square [−2, 2]²): its image covers the plane, and its
//   carried boundary is scattered by the copies' expansion. The frame with the strokes hidden differs from the frame
//   with them in at most NOISE_MAX of the canvas's pixels in the shape's ink: no carried outline comes back as noise.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the steps view (ci/suite_views.js). Prints
// {pass, fails, info}.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); return pass; };
const DESK = [1200, 800], NARROW = [360, 740];   // CSS px: the pages
const VIEW_SCALE = 140;    // the scene's px per unit
const ZOOM = 8, DEEP = 100;   // the zoomed rows' least scale over the scene's (the wheel's notches overshoot it)
const WHEEL_DY = -400, WHEEL_MAX = 40;   // a wheel notch's delta, and the most notches a zoom takes
const PAN_TOL = 0.1;       // the pan's share of the pane it may miss half the pane by
const STEP_EXPR = 'z-(z^3-1)/(3*z^2)';   // Newton's map for z³ − 1
const CUT_DEG = 180;       // the formula step's cut direction
const BITE = { a: [0.6, -0.5], b: [1.6, 0.5] }, BITE_N = 2;
const EDGE_N = 800;        // points of the rectangle's boundary carried to plane 1
const DEEP_N = 4000, DEEP_ARC = 0.02;   // the deep row's points, and the share of the perimeter they span
const DEEP_VERTS_MAX = 2000;  // most vertices of the deep row's refined outline (608 here; 6818 refining off the pane too)
const RING_R = 3;          // CSS px around a carried point in which its stroke pixel is looked for
const INK_TOL = 40;        // largest channel difference (of 255) from the ink of a stroke pixel
const DIFF_MIN = 60;       // summed channel difference from the frame with the strokes hidden of a drawn pixel
const MIN_EDGE = 100;      // least carried points inside the canvas
const HIT_MIN = 0.9;       // least share of them with a stroke pixel in the shape's ink
const CTRL_MAX = 0.2;      // most share of them with a stroke pixel in the control's ink
const PAN_STEPS = 10;      // the pan's steps
const PAN_RUNS_MAX = 1;    // most refinements over the pan
const REFUSED_N = 20;      // the refused repeat's count
const NOISE_MAX = 1e-4;    // most share of the gallery's canvas in its shape's ink where the strokes changed it
const SETTLE = 120000;     // ms: the most a wait for the parked plane takes
const { PARKED_DRAWN, loadGallery, parkInside } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'parked_kit.js'), 'utf8'))({ ev, settled, exampleNames });
const { grab } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const wheel = async (x, y, dy) => { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY: dy }); };
const parked = async (what) => { const st = await settled({ max: SETTLE, until: PARKED_DRAWN }); ok(`${what}: the parked plane is drawn`, st.ok, st.busy); };
// the parked plane held twice, its strokes drawn (tag) and hidden (tag + '0')
const grabBoth = async (tag) => {
  for (const hide of [false, true]) {
    await ev(`__cmwHideStrokes(${hide}), 1`);
    await parked(`${tag} (strokes ${hide ? 'hidden' : 'shown'})`);
    ok(`${tag}: the frame is still (strokes ${hide ? 'hidden' : 'shown'})`, await grab(tag + (hide ? '0' : '')), null);
  }
  await ev('__cmwHideStrokes(false), 1');
};
// in the page: the kept frames tag and tag + '0' and the ink of shape id; ring(pts) counts the plane points pts (each
// [re, im] of plane 1) RING_R px or more inside the canvas, and those with a stroke pixel of that ink within RING_R px;
// inked() counts the canvas's pixels in that ink where the strokes changed the frame
const measure = (tag, id, body) => ev(`(() => {
  const K = window.__heldPx, D = K[${JSON.stringify(tag)}], D0 = K[${JSON.stringify(tag + '0')}], c = document.getElementById('canvasL');
  const W = c.width, H = c.height, r = c.getBoundingClientRect(), dpr = W / r.width;
  const ink = [0, 2, 4].map((k) => parseInt(__cmwLook(${JSON.stringify(id)}, 'L').edge.replace('#', '').slice(k, k + 2), 16));
  const stroke = (i) => Math.abs(D[i] - D0[i]) + Math.abs(D[i + 1] - D0[i + 1]) + Math.abs(D[i + 2] - D0[i + 2]) > ${DIFF_MIN}
    && [0, 1, 2].every((k) => Math.abs(D[i + k] - ink[k]) <= ${INK_TOL});
  const R = Math.ceil(${RING_R} * dpr);
  const ring = (pts) => {
    let n = 0, hit = 0;
    for (const [re, im] of pts) {
      const p = __cmwW2S('L', re, im); if (!p) continue;
      const x = Math.round((p[0] - r.left) * dpr), y = Math.round((p[1] - r.top) * dpr);
      if (x < R || y < R || x >= W - R || y >= H - R) continue;
      n++;
      let f = false;
      for (let dy = -R; dy <= R && !f; dy++) for (let dx = -R; dx <= R && !f; dx++) if (dx * dx + dy * dy <= R * R && stroke(4 * ((y + dy) * W + x + dx))) f = true;
      if (f) hit++;
    }
    return { n, hit };
  };
  const inked = () => { let m = 0; for (let i = 0; i < W * H * 4; i += 4) if (stroke(i)) m++; return { m, of: W * H }; };
  return (${body})(ring, inked);
})()`);

// the point of the rectangle's boundary at arc length d from its corner a, carried by N twice
// (N(z) = z − (z³ − 1) / (3 z²))
const carry = (d) => {
  const [ax, ay] = BITE.a, [bx, by] = BITE.b;
  let x, y;
  if (d < bx - ax) { x = ax + d; y = ay; } else if ((d -= bx - ax) < by - ay) { x = bx; y = ay + d; } else if ((d -= by - ay) < bx - ax) { x = bx - d; y = by; } else { d -= bx - ax; x = ax; y = by - d; }
  for (let k = 0; k < BITE_N; k++) {
    const r2 = x * x - y * y, i2 = 2 * x * y, r3 = r2 * x - i2 * y - 1, i3 = r2 * y + i2 * x;   // z² and z³ − 1
    const qr = 3 * r2, qi = 3 * i2, q = qr * qr + qi * qi;                                       // 3 z²
    x -= (r3 * qr + i3 * qi) / q; y -= (i3 * qr - r3 * qi) / q;
  }
  return [x, y];
};
const PER = 2 * (BITE.b[0] - BITE.a[0] + BITE.b[1] - BITE.a[1]);
// the boundary's image, EDGE_N points; and the deep row's, DEEP_N points within DEEP_ARC of the perimeter about the
// arc length that carries to the image's top tip, which that row zooms about
const edge = Array.from({ length: EDGE_N }, (_, i) => carry((i + 0.5) * PER / EDGE_N));
const tipK = edge.reduce((m, p, i) => (p[1] > edge[m][1] ? i : m), 0), tipD = (tipK + 0.5) * PER / EDGE_N;
const deepEdge = Array.from({ length: DEEP_N }, (_, i) => carry(((tipD + (i / (DEEP_N - 1) - 0.5) * DEEP_ARC * PER) % PER + PER) % PER));
// (the image's centre, which the zoomed rows zoom about)
const mid = [edge.reduce((t, p) => t + p[0], 0) / EDGE_N, edge.reduce((t, p) => t + p[1], 0) / EDGE_N];
const BITE_STATE = { v3: true, v4: true, v5: true, v6: true, exactImages: true, outline: true, nextId: 10, focus: 0, srcView: { cx: 0, cy: 0, s: VIEW_SCALE },
  shapes: [{ id: 's1', kind: 'rect', a: BITE.a, b: BITE.b, ci: 0, visible: true }, { id: 'c2', kind: 'rect', a: [3, 3], b: [3.5, 3.5], ci: 4, visible: false }],
  steps: [{ type: 'custom', params: { expr: STEP_EXPR, cut: CUT_DEG }, on: true, repeat: { n: BITE_N, len: 1 } }] };
// the left plane's px per unit, as drawn
const scaleAt = () => ev(`(() => { const a = __cmwW2S('L', 0, 0), b = __cmwW2S('L', 1, 0); return b[0] - a[0]; })()`);
// the bite on page [w, h], wheel-zoomed zoom times about the image: the outline in the shape's ink along the carried
// boundary, and the control's ink not
const bite = async (tag, page, zoom, at = mid, pts = edge) => {
  await view(page[0], page[1], false, false);
  await loadView('steps', 'reptol' + Date.now(), BITE_STATE);
  await parkInside(SETTLE);
  const s0 = await scaleAt();
  if (zoom !== 1) {
    for (let i = 0; i < WHEEL_MAX && (await scaleAt()) < zoom * s0; i++) {
      const p = await ev(`__cmwW2S('L', ${at[0]}, ${at[1]})`);
      await wheel(p[0], p[1], WHEEL_DY);
      await settled({ max: SETTLE, panes: false });
    }
    const s1 = await scaleAt();
    info[tag + ' zoom'] = { s0, s1 };
    ok(`${tag}: the wheel zooms the plane in at least ${zoom} times`, s1 >= zoom * s0, info[tag + ' zoom']);
  }
  await grabBoth(tag);
  const ol = info[tag + ' outline'] = await ev('__cmwRept({ outline: true })');
  if (zoom === DEEP) ok(`${tag}: the outline is refined on the pane alone, at most ${DEEP_VERTS_MAX} vertices`, !!ol && ol.verts <= DEEP_VERTS_MAX, ol);
  const own = await measure(tag, 's1', `(ring) => ring(${JSON.stringify(pts)})`);
  const ctrl = await measure(tag, 'c2', `(ring) => ring(${JSON.stringify(pts)})`);
  info[tag] = { own, ctrl };
  const what = `bite ×${BITE_N} ${page === NARROW ? `in a ${page[0]} px window` : 'on the desk'}${zoom !== 1 ? `, wheel-zoomed to at least ${zoom} times its scale` : ''}`;
  ok(`${what}: at least ${MIN_EDGE} carried boundary points inside the canvas`, own.n >= MIN_EDGE, own);
  ok(`${what}: the outline in the shape's ink along the image of its boundary (at least ${HIT_MIN} of the points)`, own.n > 0 && own.hit / own.n >= HIT_MIN, own);
  ok(`${what}, control: another shape's ink is found along it at no more than ${CTRL_MAX} of the points`, ctrl.n > 0 && ctrl.hit / ctrl.n <= CTRL_MAX, ctrl);
};
await bite('B', DESK, 1);
await bite('Z', DESK, ZOOM);
await bite('P', NARROW, ZOOM);
await bite('D', DESK, DEEP, edge[tipK], deepEdge);

// ---- the pan: the outline kept per pane-wide cell, not refined again at each frame
{
  await view(DESK[0], DESK[1], false, false);
  await loadView('steps', 'reptolpan' + Date.now(), BITE_STATE);
  await parkInside(SETTLE);
  await parked('pan, before');
  const r0 = await ev('__cmwRept({ outline: true })');
  const b = await ev("(() => { const r = document.getElementById('canvasL').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()");
  const at0 = await ev(`__cmwW2S('L', ${mid[0]}, ${mid[1]})`), dx = b[2] / (2 * PAN_STEPS), y = b[1] + b[3] / 2;
  for (let i = 0; i < PAN_STEPS; i++) {
    const x = b[0] + b[2] / 2 - (i - PAN_STEPS / 2) * dx;
    await drag(x, y, x - dx, y, 4, 40);
    await parked(`pan, step ${i + 1}`);
  }
  const r1 = await ev('__cmwRept({ outline: true })'), at1 = await ev(`__cmwW2S('L', ${mid[0]}, ${mid[1]})`);
  info.pan = { before: r0, after: r1, moved: at1[0] - at0[0], pane: b[2] };
  ok('pan: the drags move the image left by half the pane', Math.abs(at0[0] - at1[0] - b[2] / 2) <= PAN_TOL * b[2], info.pan);
  ok(`pan of half the pane in ${PAN_STEPS} drawn steps: the outline refined again at most ${PAN_RUNS_MAX} time`, !!r0 && !!r1 && r1.runs - r0.runs <= PAN_RUNS_MAX, info.pan);
  await grabBoth('N');
  const own = await measure('N', 's1', `(ring) => ring(${JSON.stringify(edge)})`);
  info.panned = own;
  ok(`pan: the outline still in the shape's ink along the image of its boundary (at least ${HIT_MIN} of the points)`, own.n >= MIN_EDGE && own.hit / own.n >= HIT_MIN, own);
}

// ---- a Repeat no exact plan takes (sin ×20: more ops than a plan holds, its plane hatched): no carried outline over
// the hatch either, though the sines carry the boundary smoothly toward 0
{
  await view(DESK[0], DESK[1], false, false);
  await loadView('steps', 'reptolref' + Date.now(), Object.assign({}, BITE_STATE, { steps: [{ type: 'sin', params: {}, on: true, repeat: { n: REFUSED_N, len: 1 } }] }));
  await parkInside(SETTLE);
  await grabBoth('R');
  const ref = await measure('R', 's1', '(ring, inked) => inked()');
  info.refused = ref;
  ok(`a refused repeat (sin ×${REFUSED_N}): the strokes ink at most ${NOISE_MAX} of the canvas in the shape's colour`, ref.m / ref.of <= NOISE_MAX, ref);
}

// ---- the gallery: Repeat ×20, no carried outline as noise
await view(DESK[0], DESK[1], false, false);
await loadView('steps', 'reptolg' + Date.now(), {});
await loadGallery(SETTLE);
await parkInside(SETTLE);
await grabBoth('G');
const gid = await ev('__cmwShapes().shapes.find((s) => s.visible !== false).id');
const noise = await measure('G', gid, '(ring, inked) => inked()');
info.gallery = noise;
ok(`gallery ×20: the strokes ink at most ${NOISE_MAX} of the canvas in the shape's colour (no scattered outline)`, noise.m / noise.of <= NOISE_MAX, noise);

const exc = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''));
ok('no console errors', exc.length === 0, exc.slice(0, 4));
return { pass: fails.length === 0, fails, info };
