// A repeated step's glide is drawn exactly (#2510): the frames of a glide through Newton's map for z³ − 1 repeated
// twenty times (gallery 28) are drawn by the inverse pass, as its parked plane is (#1478), and not by the carried mesh.
// A frame at x = j + s copies is H_s ∘ R^j, H_s the gliding copy's homotopy (its rational zoom); the plan is one REPT
// op of j + 1 levels whose first level solves H_s (InvOps.reptHead).
// - routing: on the Plane and the Sphere, Everywhere and Inside regions, the glide's record at u = GLIDE_U (a frame
//   with a gliding copy) reads path 'inverse' and the ops ['REPT'], and on the Plane at u = COPY_U too (a frame on a
//   copy's end: j copies and no head). On the Sphere the record is the globe's own (__cmwSvGlobe: its carried path,
//   'inverse' where the inverse pass draws it, and u): __cmwSteps().glide is the flat pane's;
// - no unresolved pixel: the Plane's frames at GLIDE_U and END_U, Inside regions, draw none of the grey no-value
//   hatch (#1444's measure, steps_parked_repeat_cmd.js's);
// - coverage: Newton's map repeated BITE_N times over the box [0.3, 0.7] × [−0.3, 0.3], the frame at x = BITE_X
//   copies (a REPT of two levels, the head first), Inside regions: at a grid of pixels PITCH px apart the pixel is
//   coloured iff a member of w under the frame's own ops lies in the box (the copies' path: the closed-form roots of
//   each RAT3 and the affine maps of H_s, Inverse.homOps with rept false, not the REPT search). Coloured: at least
//   AMBIG_TOL from the same frame with no region (the paper); empty: within PAPER_TOL of it; between, ambiguous (at
//   most FAINT_MAX_SHARE). (Not the parked suite's nearer-Everywhere rule: on a glide's frame the members of w carry
//   different colours, colour(F(z)), so Inside regions shows the region's member where Everywhere shows the front
//   one.) A sample whose answer changes within EDGE_PX is the image's edge and is not scored (at most EDGE_MAX_SHARE
//   of the row); the reference must predict some samples coloured and some not;
// - the arrival: the same scene's frame at u = END_U colours the samples the parked plane after the step colours, but
//   for at most ARRIVE_MAX_SHARE of them (the frame is H_s at s = 1 − (1 − END_U) BITE_N, a hair from the copy's end);
// - the carried colour: Everywhere, the frame at BITE_X copies colours each point by where its member lands on plane 1,
//   colour(R³(z)), not by its own w: at most SAME_MAX_SHARE of its samples are within PAPER_TOL of the parked plane's
//   colour at the same point (colour(w)), where a frame coloured by w would match at all of them.
// A glide's frame is read where the glide's camera draws each point (__cmwSteps().glide.view), a plane at rest where its
// own view does. Every plane is read with the shapes' strokes hidden: the fill alone.
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, info}.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const GALLERY = 'Newton’s method for z³ − 1';
const GLIDE_U = 0.525;     // the gallery's glide at 10.5 copies: ten passed, the eleventh gliding
const COPY_U = 0.5;        // ... at 10 copies: on a copy's end, no head
const END_U = 0.999;       // a frame a hair from the glide's end
// the coverage scene: x 3, its frame at 1.75 copies (one passed, the second gliding), over a box whose image is a fifth
// of the window there and about a seventh parked (the CPU twin's counts)
const BITE_N = 3, BITE_X = 1.75;
const BITE = { a: [0.3, -0.3], b: [0.7, 0.3] };
const STEP_EXPR = 'z-(z^3-1)/(3*z^2)', CUT_DEG = 180;
const VIEW_W = 1200, VIEW_H = 800, VIEW_SCALE = 140;   // px: the page, and the scene's px per unit
const NEXT_ID = 50;        // the state's next shape id
const PITCH = 20;          // px between the sampled pixels
const AXIS_OFF = 10;       // px: the grid sits between the axis lines
const MARGIN = 0.14;       // share of the canvas, as the rulers' margin, left out of the sample
const EDGE_PX = 1.5;       // px: a sample whose reference answer changes within this distance is on the image's edge
const EDGE_MAX_SHARE = 0.05, FAINT_MAX_SHARE = 0.05;
const AMBIG_TOL = 24;      // RGB distance from the paper at which a sample is coloured
const PAPER_TOL = 6;       // ... within which it is the paper
const ARRIVE_MAX_SHARE = 0.02;   // most samples the frame at END_U may colour otherwise than the parked plane
const SAME_MAX_SHARE = 0.5;   // most samples a glide's frame, Everywhere, may share with the parked plane's colour
const MIN_EACH = 20;       // the least samples the reference predicts coloured, and empty
const HATCH_SPREAD = 3, HATCH_LO = 100, HATCH_HI = 130;   // the grey no-value hatch (#1444's measure)
const SETTLE = 60000, LIST_MAX = 8;
await view(VIEW_W, VIEW_H, false, false);
const ready = () => settled({ max: SETTLE, until: 'typeof __cmwExample === "function" && typeof __cmwSteps === "function" && !!window.GLR' });
// the left pane at rail position x (a glide's frame there): its record's u reaches x
const at = async (x) => {
  await ev(`__cmwSteps({ x: ${x} }); 1`);
  const r = await settled({ max: SETTLE, until: `(() => { const g = __cmwSteps().glide; return !!g && Math.abs(g.u - ${x}) < 1e-6; })()` });
  await settled({ max: SETTLE, panes: true, until: "!(__cmwPaneStatus('L') || { pending: true }).pending" });
  return r.ok;
};
const record = () => ev('(() => { const g = __cmwSteps().glide; return g && { path: g.path, reason: g.reason || null, ops: g.ops || null, u: g.u }; })()');
// the globe at rail position x: its record's u reaches x; -> {path (the carried path), u}
const globeAt = async (x) => {
  await ev(`__cmwSteps({ x: ${x} }); 1`);
  const r = await settled({ max: SETTLE, until: `Math.abs(__cmwSvGlobe(0, 0).u - ${x}) < 1e-6 && !!__cmwSvGlobe(0, 0).path` });
  await settled({ max: SETTLE, panes: true });
  return { came: r.ok, g: await ev('(() => { const g = __cmwSvGlobe(0, 0); return { path: g.path, u: g.u }; })()') };
};
const hatchCount = () => ev(`(() => {
  const cs = [...document.querySelectorAll('#plotL canvas')].sort((p, q) => q.width * q.height - p.width * p.height), c = cs[0], d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let h = 0;
  for (let i = 0; i < d.length; i += 4) if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) <= ${HATCH_SPREAD} && d[i] >= ${HATCH_LO} && d[i] <= ${HATCH_HI}) h++;
  return { hatch: h, pixels: d.length / 4 };
})()`);

// ---- routing and the hatch, on the gallery
{
  await go(`http://localhost:${PORT}/test.html?ns=rg${Date.now()}&view=steps&lang=en`);
  await ready();
  const i = exampleNames().indexOf(GALLERY);
  ok(`the gallery holds ${GALLERY}`, i >= 0, i);
  await ev(`__cmwExample(${i}); 1`);
  await settled({ max: SETTLE, until: '__cmwSteps().adopted' });
  await ev('__cmwHideStrokes(true), 1');
  for (const surf of ['plane', 'sphere']) for (const scope of ['all', 'in']) {
    await ev(`__cmwSteps({ surf: '${surf}', scope: '${scope}', go: 0, now: true }); 1`);
    await settled({ max: SETTLE, until: '!__cmwSteps().moving' });
    if (surf === 'sphere') {
      const { came, g } = await globeAt(GLIDE_U);
      info[`${surf}/${scope}/u${GLIDE_U}`] = g;
      ok(`the Sphere, ${scope === 'in' ? 'Inside regions' : 'Everywhere'}: the glide at u = ${GLIDE_U} is drawn by the inverse pass`, came && g.path === 'inverse', { came, g });
      continue;
    }
    for (const u of [GLIDE_U, COPY_U]) {
      const came = await at(u), g = await record();
      info[`${surf}/${scope}/u${u}`] = g;
      ok(`${surf}, ${scope === 'in' ? 'Inside regions' : 'Everywhere'}: the glide at u = ${u} is drawn by the inverse pass as one REPT op`, came && !!g && g.path === 'inverse' && JSON.stringify(g.ops) === '["REPT"]', { came, g });
    }
    if (surf === 'plane' && scope === 'in') {
      for (const u of [GLIDE_U, END_U]) {
        await at(u);
        const h = await hatchCount();
        info[`hatch u${u}`] = h;
        ok(`the Plane, Inside regions: the frame at u = ${u} draws no unresolved hatch`, h.hatch === 0, h);
      }
    }
  }
}

// ---- coverage and the arrival, on the box scene (BITE)
const stateFor = (rect) => ({ v3: true, v4: true, v5: true, v6: true, exactImages: true, nextId: NEXT_ID, focus: 0, srcView: { cx: 0, cy: 0, s: VIEW_SCALE },
  shapes: rect ? [{ id: 's1', kind: 'rect', a: rect.a, b: rect.b, ci: 0, visible: true }] : [],
  steps: [{ type: 'custom', params: { expr: STEP_EXPR, cut: CUT_DEG }, on: true, repeat: { n: BITE_N, len: 1 } }] });
const open = async (rect) => {
  const ns = 'rgb' + Date.now();
  await go(`http://localhost:${PORT}/gl-helpers.html`); await settled({ panes: false });
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(stateFor(rect)))}); 1`);
  await go(`http://localhost:${PORT}/test.html?view=steps&ns=${ns}&lang=en`);
  await ready();
  await ev('__cmwHideStrokes(true), 1');
  await ev("__cmwSteps({ scope: 'in', surf: 'plane', go: 0, now: true }); 1");
  await settled({ max: SETTLE, until: '!__cmwSteps().moving' });
};
// the left canvas's colour at plane points ws; on a glide's frame (glide true) each point where the glide's camera
// (__cmwSteps().glide.view) draws it, which need not be the pane's own view (__cmwW2S's): w is drawn where the pane's
// view puts c + (w - g.c) g.s / c.s
const sample = (ws, glide) => ev(`(() => {
  const cs = [...document.querySelectorAll('#plotL canvas')].sort((p, q) => q.width * q.height - p.width * p.height), c = cs[0], x = c.getContext('2d'), r = c.getBoundingClientRect();
  const m = Math.round(Math.min(c.width, c.height) * ${MARGIN}), out = [];
  const pv = __cmwCards().main.view, gv = ${glide ? '__cmwSteps().glide.view' : 'null'} || pv, k = gv.s / pv.s;
  for (const [re0, im0] of ${JSON.stringify(ws)}) {
    const re = pv.cx + (re0 - gv.cx) * k, im = pv.cy + (im0 - gv.cy) * k;
    const p = __cmwW2S('L', re, im); if (!p) { out.push(null); continue; }
    const px = Math.round((p[0] - r.left) * c.width / r.width), py = Math.round((p[1] - r.top) * c.height / r.height);
    if (px < m || py < m || px >= c.width - m || py >= c.height - m) { out.push(null); continue; }
    const d = x.getImageData(px, py, 1, 1).data; out.push([d[0], d[1], d[2]]);
  }
  return out;
})()`);
const grid = (win) => {
  const [cx, cy, s] = win, W = VIEW_W / 2, H = VIEW_H / 2, ws = [];
  for (let j = -Math.floor(H / PITCH); j <= Math.floor(H / PITCH); j++) for (let i = -Math.floor(W / PITCH); i <= Math.floor(W / PITCH); i++) ws.push([cx + (i * PITCH + AXIS_OFF) / s, cy - (j * PITCH + AXIS_OFF) / s]);
  return ws;
};
// the reference at plane points ws, the frame at x copies: 1 when a member of w under the frame's own ops (rept false:
// each copy's RAT3 roots and H_s's affine maps) lies in the box, else 0; -1 where an op has no finite member list
const reference = (x, ws, e) => ev(`(() => {
  const st = [{ type: 'custom', params: Object.assign(Funcs.defaults('custom'), { expr: ${JSON.stringify(STEP_EXPR)}, cut: ${CUT_DEG} }), on: true, repeat: { n: ${BITE_N}, len: 1 } }];
  const b = Funcs.applyRepeats(st, st.map((s) => Funcs.build(s)))[0], r = Inverse.homOps(b, ${x} / ${BITE_N}, { rept: false });
  if (!r.ok || r.ops.some((o) => o.kind === 'REPT' || typeof o.pre !== 'function')) return null;
  const R = ${JSON.stringify(BITE)}, inR = (z) => z.re >= R.a[0] && z.re <= R.b[0] && z.im >= R.a[1] && z.im <= R.b[1];
  const one = (re, im) => { let ms = [{ re, im }]; for (let k = r.ops.length - 1; k >= 0; k--) ms = ms.flatMap((w) => r.ops[k].pre(w).map((m) => m.u)); return ms.some(inR) ? 1 : 0; };
  return ${JSON.stringify(ws)}.map(([re, im]) => [one(re, im), ...[[${e}, 0], [-${e}, 0], [0, ${e}], [0, -${e}]].map(([dx, dy]) => one(re + dx, im + dy))]);
})()`);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
// coloured per sample: 1 at least AMBIG_TOL from the paper, 0 within PAPER_TOL of it; null off the canvas or ambiguous
const classify = (pin, pap) => {
  let faint = 0;
  const got = pin.map((c, k) => {
    if (!c || !pap[k]) return null;
    const dp = dist(c, pap[k]);
    if (dp >= AMBIG_TOL) return 1;
    if (dp <= PAPER_TOL) return 0;
    faint++;
    return null;
  });
  return { got, faint };
};
{
  const xb = BITE_X / BITE_N;
  // the paper: the same chain and frames with no region
  await open(null);
  await at(xb);
  // (the samples on the grid of the glide's camera, which the frames are drawn with)
  const gv = await ev('__cmwSteps().glide.view'), win = [gv.cx, gv.cy, gv.s], ws = grid(win);
  const papX = await sample(ws, true);
  await at(END_U); const papE = await sample(ws, true);
  await ev(`__cmwSteps({ go: 1, now: true }); 1`); await settled({ max: SETTLE, until: '!__cmwSteps().moving' }); await settled({ max: SETTLE, panes: true });
  const papP = await sample(ws);
  // the region, Inside regions, at the frame, at END_U and parked on plane 1
  await open(BITE);
  const came = await at(xb), g = await record(), gv2 = await ev('__cmwSteps().glide.view');
  ok('the box scene\'s glide camera is the paper\'s', JSON.stringify(gv2) === JSON.stringify(gv), { gv, gv2 });
  info.bite = { record: g };
  ok(`box x ${BITE_N}: the frame at ${BITE_X} copies is drawn by the inverse pass as one REPT op`, came && !!g && g.path === 'inverse' && JSON.stringify(g.ops) === '["REPT"]', { came, g });
  const pinX = await sample(ws, true);
  await at(END_U); const pinE = await sample(ws, true);
  await ev(`__cmwSteps({ go: 1, now: true }); 1`); await settled({ max: SETTLE, until: '!__cmwSteps().moving' }); await settled({ max: SETTLE, panes: true });
  const pinP = await sample(ws);
  await ev("__cmwSteps({ scope: 'all', go: 0, now: true }); 1"); await settled({ max: SETTLE, until: '!__cmwSteps().moving' });
  await at(xb); const pallX = await sample(ws, true);
  await ev(`__cmwSteps({ go: 1, now: true }); 1`); await settled({ max: SETTLE, until: '!__cmwSteps().moving' }); await settled({ max: SETTLE, panes: true });
  const pallP = await sample(ws);
  {
    let n = 0, same = 0;
    pallX.forEach((c, k) => { if (!c || !pallP[k]) return; n++; if (dist(c, pallP[k]) <= PAPER_TOL) same++; });
    info.bite.colour = { samples: n, sameAsParked: same };
    ok(`box x ${BITE_N}, Everywhere: the frame at ${BITE_X} copies carries each point's colour from plane 1 (at most ${SAME_MAX_SHARE * 100} % of the samples the parked plane's colour of w)`, n > 100 && same <= SAME_MAX_SHARE * n, { n, same });
  }
  // coverage against the reference
  const ref = await reference(BITE_X, ws, EDGE_PX / win[2]);
  ok('the reference has the frame\'s own ops, each with a member list', Array.isArray(ref), ref);
  if (Array.isArray(ref)) {
    const { got, faint } = classify(pinX, papX);
    let n = 0, agree = 0, pred1 = 0, got1 = 0, edge = 0;
    const bad = [];
    ws.forEach((w, k) => {
      if (got[k] == null) return;
      const [p, ...near] = ref[k];
      if (near.some((q) => q !== p)) { edge++; return; }
      n++; pred1 += p; got1 += got[k];
      if (p === got[k]) agree++; else if (bad.length < LIST_MAX) bad.push({ w: w.map((v) => +v.toFixed(3)), predicted: p, plane: got[k] });
    });
    info.bite.coverage = { samples: n, agree, predictedColoured: pred1, planeColoured: got1, edge, faint, disagreements: bad };
    ok(`box x ${BITE_N} at ${BITE_X} copies: the reference predicts at least ${MIN_EACH} samples coloured and ${MIN_EACH} empty`, pred1 >= MIN_EACH && n - pred1 >= MIN_EACH, { n, pred1 });
    ok(`box x ${BITE_N} at ${BITE_X} copies: the frame colours what a member under the frame's own ops reaches`, n > 0 && agree === n, `${agree}/${n} agree, the frame colours ${got1}`);
    ok('... edge samples are few', edge <= EDGE_MAX_SHARE * (n + edge), `${edge} edge of ${n + edge}`);
    ok('... ambiguous samples are few', faint <= FAINT_MAX_SHARE * (n + edge + faint), `${faint} ambiguous`);
  }
  // the arrival: the frame at END_U against the parked plane
  {
    const e = classify(pinE, papE).got, p = classify(pinP, papP).got;
    let n = 0, differ = 0, col = 0;
    e.forEach((v, k) => { if (v == null || p[k] == null) return; n++; col += p[k]; if (v !== p[k]) differ++; });
    info.bite.arrival = { samples: n, differ, parkedColoured: col };
    ok(`box x ${BITE_N}: the frame at u = ${END_U} colours what the parked plane colours, but for at most ${ARRIVE_MAX_SHARE * 100} % of the samples`, n > 0 && col >= MIN_EACH && differ <= ARRIVE_MAX_SHARE * n, { n, differ, col });
  }
}
return { pass: fails.length === 0, fails, info };
