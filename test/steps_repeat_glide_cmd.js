// A repeated step's glide is drawn exactly (#2510): the frames of a glide through Newton's map for z³ − 1 repeated
// twenty times (gallery 28) are drawn by the inverse pass, as its parked plane is (#1478), and not by the carried mesh.
// A frame at x = j + s copies is H_s ∘ R^j, H_s the gliding copy's homotopy (its rational zoom); the plan is one REPT
// op of j + 1 levels whose first level solves H_s (InvOps.reptHead).
// - routing: on the Plane and the Sphere, Everywhere and Inside regions, the glide's record at u = GLIDE_U (a frame
//   with a gliding copy) reads path 'inverse' and the ops ['REPT'], and on the Plane at u = COPY_U too (a frame on a
//   copy's end: j copies and no head). The Sphere's first move after the surface changes is a warm-up: the hook's
//   record keeps the Plane's last u for that one move, with or without this change;
// - no unresolved pixel: the Plane's frames at GLIDE_U and END_U, Inside regions, draw none of the grey no-value
//   hatch (#1444's measure, steps_parked_repeat_cmd.js's);
// - coverage: Newton's map repeated BITE_N times over the bite box [0.6, 1.6] × [−0.5, 0.5], the frame at x = BITE_X
//   copies (a REPT of two levels, the head first), Inside regions: at a grid of pixels PITCH px apart the pixel is
//   coloured iff a member of w under the frame's own ops lies in the box (the copies' path: the closed-form roots of
//   each RAT3 and the affine maps of H_s, Inverse.homOps with rept false, not the REPT search). Coloured: nearer the
//   same frame drawn Everywhere than the same frame with no region (the paper), as the parked suite reads it; a sample
//   whose answer changes within EDGE_PX is the image's edge and is not scored (at most EDGE_MAX_SHARE of the row), one
//   within AMBIG_TOL of both is ambiguous (at most FAINT_MAX_SHARE); the reference must predict some samples coloured
//   and some not;
// - the arrival: the same scene's frame at u = END_U colours the samples the parked plane after the step colours, but
//   for at most ARRIVE_MAX_SHARE of them (the frame is H_s at s = 1 − (1 − END_U) BITE_N, a hair from the copy's end).
// Every plane is read with the shapes' strokes hidden: the fill alone.
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, info}.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const GALLERY = 'Newton’s method for z³ − 1';
const GLIDE_U = 0.525;     // the gallery's glide at 10.5 copies: ten passed, the eleventh gliding
const COPY_U = 0.5;        // ... at 10 copies: on a copy's end, no head
const WARM_U = 0.3;        // the Sphere's warm-up move
const END_U = 0.999;       // a frame a hair from the glide's end
const BITE_N = 3, BITE_X = 1.75;   // the coverage scene: x 3, its frame at 1.75 copies (one passed, the second gliding)
const BITE = { a: [0.6, -0.5], b: [1.6, 0.5] };
const STEP_EXPR = 'z-(z^3-1)/(3*z^2)', CUT_DEG = 180;
const VIEW_W = 1200, VIEW_H = 800, VIEW_SCALE = 140;   // px: the page, and the scene's px per unit
const NEXT_ID = 50;        // the state's next shape id
const PITCH = 20;          // px between the sampled pixels
const AXIS_OFF = 10;       // px: the grid sits between the axis lines
const MARGIN = 0.14;       // share of the canvas, as the rulers' margin, left out of the sample
const EDGE_PX = 1.5;       // px: a sample whose reference answer changes within this distance is on the image's edge
const EDGE_MAX_SHARE = 0.05, FAINT_MAX_SHARE = 0.05;
const AMBIG_TOL = 24;      // RGB distance: nearer neither the Everywhere colour nor the paper by more is ambiguous
const ARRIVE_MAX_SHARE = 0.02;   // most samples the frame at END_U may colour otherwise than the parked plane
const MIN_EACH = 20;       // the least samples the reference predicts coloured, and empty
const HATCH_SPREAD = 3, HATCH_LO = 100, HATCH_HI = 130;   // the grey no-value hatch (#1444's measure)
const SETTLE = 60000, LIST_MAX = 8;
await view(VIEW_W, VIEW_H, false, false);
const ready = () => settled({ max: SETTLE, until: 'typeof __cmwExample === "function" && typeof __cmwSteps === "function" && !!window.GLR' });
// the left pane at rail position x (a glide's frame there): its record's u reaches x
const at = async (x) => {
  await ev(`__cmwSteps({ x: ${x} }); 1`);
  const r = await settled({ max: SETTLE, until: `(() => { const g = __cmwSteps().glide; return !!g && Math.abs(g.u - ${x}) < 1e-6; })()` });
  await settled({ max: SETTLE, panes: true });
  return r.ok;
};
const record = () => ev('(() => { const g = __cmwSteps().glide; return g && { path: g.path, reason: g.reason || null, ops: g.ops || null, u: g.u }; })()');
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
    if (surf === 'sphere') { await ev(`__cmwSteps({ x: ${WARM_U} }); 1`); await settled({ max: SETTLE, until: `(() => { const g = __cmwSteps().glide; return !!g && Math.abs(g.u - ${WARM_U}) < 1e-6; })()` }); }
    for (const u of surf === 'plane' ? [GLIDE_U, COPY_U] : [GLIDE_U]) {
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

// ---- coverage and the arrival, on the bite scene
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
const sample = (ws) => ev(`(() => {
  const cs = [...document.querySelectorAll('#plotL canvas')].sort((p, q) => q.width * q.height - p.width * p.height), c = cs[0], x = c.getContext('2d'), r = c.getBoundingClientRect();
  const m = Math.round(Math.min(c.width, c.height) * ${MARGIN}), out = [];
  for (const [re, im] of ${JSON.stringify(ws)}) {
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
// coloured per sample: nearer the Everywhere colour than the paper's; null off the canvas or ambiguous
const classify = (pin, pall, pap) => {
  let faint = 0;
  const got = pin.map((c, k) => {
    if (!c || !pall[k] || !pap[k]) return null;
    const da = dist(c, pall[k]), dp = dist(c, pap[k]);
    if (Math.abs(da - dp) < AMBIG_TOL) { faint++; return null; }
    return da < dp ? 1 : 0;
  });
  return { got, faint };
};
{
  const xb = BITE_X / BITE_N;
  // the paper: the same chain and frames with no region
  await open(null);
  const win = await ev('__cmwSteps().win'), ws = grid(win);
  await at(xb); const papX = await sample(ws);
  await at(END_U); const papE = await sample(ws);
  await ev(`__cmwSteps({ go: 1, now: true }); 1`); await settled({ max: SETTLE, until: '!__cmwSteps().moving' }); await settled({ max: SETTLE, panes: true });
  const papP = await sample(ws);
  // the region, Inside regions and Everywhere, at the frame, at END_U and parked on plane 1
  await open(BITE);
  const win2 = await ev('__cmwSteps().win');
  ok('the bite scene\'s window is the paper\'s', JSON.stringify(win2) === JSON.stringify(win), { win, win2 });
  const came = await at(xb), g = await record();
  info.bite = { record: g };
  ok(`bite x ${BITE_N}: the frame at ${BITE_X} copies is drawn by the inverse pass as one REPT op`, came && !!g && g.path === 'inverse' && JSON.stringify(g.ops) === '["REPT"]', { came, g });
  const pinX = await sample(ws);
  await at(END_U); const pinE = await sample(ws);
  await ev(`__cmwSteps({ go: 1, now: true }); 1`); await settled({ max: SETTLE, until: '!__cmwSteps().moving' }); await settled({ max: SETTLE, panes: true });
  const pinP = await sample(ws);
  await ev("__cmwSteps({ scope: 'all', go: 0, now: true }); 1"); await settled({ max: SETTLE, until: '!__cmwSteps().moving' });
  await at(xb); const pallX = await sample(ws);
  await at(END_U); const pallE = await sample(ws);
  await ev(`__cmwSteps({ go: 1, now: true }); 1`); await settled({ max: SETTLE, until: '!__cmwSteps().moving' }); await settled({ max: SETTLE, panes: true });
  const pallP = await sample(ws);
  // coverage against the reference
  const ref = await reference(BITE_X, ws, EDGE_PX / win[2]);
  ok('the reference has the frame\'s own ops, each with a member list', Array.isArray(ref), ref);
  if (Array.isArray(ref)) {
    const { got, faint } = classify(pinX, pallX, papX);
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
    ok(`bite x ${BITE_N} at ${BITE_X} copies: the reference predicts at least ${MIN_EACH} samples coloured and ${MIN_EACH} empty`, pred1 >= MIN_EACH && n - pred1 >= MIN_EACH, { n, pred1 });
    ok(`bite x ${BITE_N} at ${BITE_X} copies: the frame colours what a member under the frame's own ops reaches`, n > 0 && agree === n, `${agree}/${n} agree, the frame colours ${got1}`);
    ok('... edge samples are few', edge <= EDGE_MAX_SHARE * (n + edge), `${edge} edge of ${n + edge}`);
    ok('... ambiguous samples are few', faint <= FAINT_MAX_SHARE * (n + edge + faint), `${faint} ambiguous`);
  }
  // the arrival: the frame at END_U against the parked plane
  {
    const e = classify(pinE, pallE, papE).got, p = classify(pinP, pallP, papP).got;
    let n = 0, differ = 0, col = 0;
    e.forEach((v, k) => { if (v == null || p[k] == null) return; n++; col += p[k]; if (v !== p[k]) differ++; });
    info.bite.arrival = { samples: n, differ, parkedColoured: col };
    ok(`bite x ${BITE_N}: the frame at u = ${END_U} colours what the parked plane colours, but for at most ${ARRIVE_MAX_SHARE * 100} % of the samples`, n > 0 && col >= MIN_EACH && differ <= ARRIVE_MAX_SHARE * n, { n, differ, col });
  }
}
return { pass: fails.length === 0, fails, info };
