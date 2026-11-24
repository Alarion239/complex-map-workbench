// A region's image under a Repeat chain drawn by the exact REPT renderer keeps the shape's outline in the shape's colour
// while its carried boundary stays resolved, as every other step's image does (#1482); where the copies' expansion
// scatters the boundary, no carried outline is drawn, and the exact fill's own edge is the only one.
// - the bite: the rectangle [0.6, 1.6] × [−0.5, 0.5] under Newton's map for z³ − 1 repeated twice, parked on plane 1,
//   Inside regions. Its image is two bounded lobes, and the outline is the image of the rectangle's boundary, which
//   holds the exact fill's edge (an open map's image has its edge in the image of the boundary). EDGE_N points of the
//   boundary are carried to plane 1 on the CPU (N twice, in float64); at each one that lands RING_R px or more inside
//   the canvas, the frame has a stroke pixel within RING_R CSS px of it: a pixel that differs from the same frame with
//   the strokes hidden (__cmwHideStrokes) and lies within INK_TOL of the shape's ink (__cmwLook's edge), for at least
//   HIT_MIN of at least MIN_EDGE such points;
// - its control: the same count with another shape's ink (a hidden shape of another colour) finds at most CTRL_MAX of
//   them, so a stroke in another colour, or the colour plot's own edge, fails the row;
// - the gallery (the same step repeated twenty times over the square [−2, 2]²): its image covers the plane, and its
//   carried boundary is scattered by the copies' expansion. The frame with the strokes hidden differs from the frame
//   with them in at most NOISE_MAX of the canvas's pixels in the shape's ink: no carried outline comes back as noise.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the steps view (ci/suite_views.js). Prints
// {pass, fails, info}.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); return pass; };
const VIEW_W = 1200, VIEW_H = 800, VIEW_SCALE = 140;   // px: the page, and the scene's px per unit
const STEP_EXPR = 'z-(z^3-1)/(3*z^2)';   // Newton's map for z³ − 1
const CUT_DEG = 180;       // the formula step's cut direction
const BITE = { a: [0.6, -0.5], b: [1.6, 0.5] }, BITE_N = 2;
const EDGE_N = 400;        // points of the rectangle's boundary carried to plane 1
const RING_R = 3;          // CSS px around a carried point in which its stroke pixel is looked for
const INK_TOL = 40;        // largest channel difference (of 255) from the ink of a stroke pixel
const DIFF_MIN = 60;       // summed channel difference from the frame with the strokes hidden of a drawn pixel
const MIN_EDGE = 100;      // least carried points inside the canvas
const HIT_MIN = 0.9;       // least share of them with a stroke pixel in the shape's ink
const CTRL_MAX = 0.2;      // most share of them with a stroke pixel in the control's ink
const NOISE_MAX = 1e-4;    // most share of the gallery's canvas in its shape's ink where the strokes changed it
const SETTLE = 120000;     // ms: the most a wait for the parked plane takes
const { PARKED_DRAWN, loadGallery, parkInside } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'parked_kit.js'), 'utf8'))({ ev, settled, exampleNames });
const { grab } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
// the parked plane held twice, its strokes drawn (tag) and hidden (tag + '0')
const grabBoth = async (tag) => {
  for (const hide of [false, true]) {
    await ev(`__cmwHideStrokes(${hide}), 1`);
    const st = await settled({ max: SETTLE, until: PARKED_DRAWN });
    ok(`${tag}: the parked plane is drawn (strokes ${hide ? 'hidden' : 'shown'})`, st.ok, st.busy);
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
await view(VIEW_W, VIEW_H, false, false);

// ---- the bite: Repeat ×2, the outline along the exact fill's edge
const BITE_STATE = { v3: true, v4: true, v5: true, v6: true, exactImages: true, outline: true, nextId: 10, focus: 0, srcView: { cx: 0, cy: 0, s: VIEW_SCALE },
  shapes: [{ id: 's1', kind: 'rect', a: BITE.a, b: BITE.b, ci: 0, visible: true }, { id: 'c2', kind: 'rect', a: [3, 3], b: [3.5, 3.5], ci: 4, visible: false }],
  steps: [{ type: 'custom', params: { expr: STEP_EXPR, cut: CUT_DEG }, on: true, repeat: { n: BITE_N, len: 1 } }] };
await loadView('steps', 'reptol' + Date.now(), BITE_STATE);
await parkInside(SETTLE);
await grabBoth('B');
// the rectangle's boundary, EDGE_N points, each carried by N twice (N(z) = z − (z³ − 1) / (3 z²))
const edge = [];
const [ax, ay] = BITE.a, [bx, by] = BITE.b, per = 2 * (bx - ax + by - ay);
for (let i = 0; i < EDGE_N; i++) {
  let d = (i + 0.5) * per / EDGE_N, x, y;
  if (d < bx - ax) { x = ax + d; y = ay; } else if ((d -= bx - ax) < by - ay) { x = bx; y = ay + d; } else if ((d -= by - ay) < bx - ax) { x = bx - d; y = by; } else { d -= bx - ax; x = ax; y = by - d; }
  for (let k = 0; k < BITE_N; k++) {
    const r2 = x * x - y * y, i2 = 2 * x * y, r3 = r2 * x - i2 * y - 1, i3 = r2 * y + i2 * x;   // z² and z³ − 1
    const qr = 3 * r2, qi = 3 * i2, q = qr * qr + qi * qi;                                       // 3 z²
    x -= (r3 * qr + i3 * qi) / q; y -= (i3 * qr - r3 * qi) / q;
  }
  edge.push([x, y]);
}
const own = await measure('B', 's1', `(ring) => ring(${JSON.stringify(edge)})`);
const ctrl = await measure('B', 'c2', `(ring) => ring(${JSON.stringify(edge)})`);
info.bite = { own, ctrl };
ok(`bite ×${BITE_N}: at least ${MIN_EDGE} carried boundary points inside the canvas`, own.n >= MIN_EDGE, own);
ok(`bite ×${BITE_N}: the outline in the shape's ink along the image of its boundary (at least ${HIT_MIN} of the points)`, own.n > 0 && own.hit / own.n >= HIT_MIN, own);
ok(`bite ×${BITE_N}, control: another shape's ink is found along it at no more than ${CTRL_MAX} of the points`, ctrl.n > 0 && ctrl.hit / ctrl.n <= CTRL_MAX, ctrl);

// ---- the gallery: Repeat ×20, no carried outline as noise
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
