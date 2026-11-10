// The test hooks of an exact Landscape glide frame: window.__cmwLandEnum(pts) answers the CPU enumerator's members (src/inverse.js,
// on the plan and prep the frame inverts) at places of the shown plane's box, and window.__cmwLandFrameVerts(pts) the layers the frame
// draws at the nearest grid vertex of each. At a vertex's own place the enumerator has a member at the vertex's z (within Z_TOL)
// with the vertex's value and height, on whichever sheet it is; a z off by the control's offset is not found. Sheets off, cube root and log of an annulus, at u = .5.
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, info}.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const rAF2 = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))';
const LOAD_MAX_MS = 60000, VIEW_W = 1440, VIEW_H = 900;
const U = 0.5, PROBES = 4;               // the glide's place; the probe places are PROBES x PROBES over the box
const HEIGHT_TOL = 0.02;                 // world units (a box is about 2 wide), the exact suite's
const F_TOL = 1e-3;                      // the value's distance, plane units
const Z_TOL = 1e-3;                      // the member's distance from the vertex's z (the vertex's z is single precision), relative to |z| + 1
const WRONG_OFFSET = 1;                  // the control: a z this far from the vertex's matches no member
const ANN = [{ id: 'a1', kind: 'annulus', c: [0, 0], r: 1, r2: 3, visible: true }];
const CASES = [
  { tag: 'cube root', steps: [{ type: 'root', params: { n: 3 }, on: true }], shapes: [] },
  { tag: 'log of an annulus', steps: [{ type: 'log', params: { cut: 180, k: 0 }, on: true }], shapes: ANN },
];
await view(VIEW_W, VIEW_H, false, false);
for (const c of CASES) {
  const ns = 'landenum' + Date.now();
  await loadView('steps', ns, { shapes: c.shapes, steps: c.steps, sheets: false, height: 'im' });
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  await settled({ max: LOAD_MAX_MS, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
  await settled({ max: LOAD_MAX_MS * 2, until: '__cmwSteps().ready.ready' });
  await ev(`__cmwSteps({ scope: 'all', surf: 'land', go: 0, now: true, clock: 0 }); 1`);
  await ev(`__cmwSteps({ x: ${U} }); 1`); await settled({ max: LOAD_MAX_MS }); await ev(rAF2);
  const pts = await ev(`(() => { const b = __cmwLandCarry(true), o = []; for (let i = 0; i < ${PROBES}; i++) for (let j = 0; j < ${PROBES}; j++) o.push([b.x0 + (i + 0.5) * (b.x1 - b.x0) / ${PROBES}, b.y0 + (j + 0.5) * (b.y1 - b.y0) / ${PROBES}]); return o; })()`);
  const verts = await ev(`__cmwLandFrameVerts(${JSON.stringify(pts)})`);
  const vpts = pts.map((p, i) => (verts && verts[i] && verts[i][0] && verts[i][0].w) || p);
  const en = await ev(`__cmwLandEnum(${JSON.stringify(vpts)})`);
  ok(`${c.tag}: the hooks answer, a place each`, Array.isArray(verts) && Array.isArray(en) && verts.length === pts.length && en.length === pts.length, { v: verts && verts.length, e: en && en.length });
  let drawn = 0, found = 0, ownHit = 0, frontHit = 0, fronts = 0, wrong = 0, bad = [];
  pts.forEach((p, i) => {
    const l = verts[i] && verts[i][0];
    if (!l || !l.z) return;
    drawn++;
    const ms = en[i] || [], near = (m, dz) => Math.hypot(m.z[0] - l.z[0] - dz, m.z[1] - l.z[1]) <= Z_TOL * (Math.hypot(l.z[0], l.z[1]) + 1);
    if (ms.some((m) => near(m, 0))) found++; else if (bad.length < 3) bad.push({ p, l, ms });
    if (ms.some((m) => near(m, WRONG_OFFSET))) wrong++;
    const m0 = ms.find((m) => near(m, 0) && Math.abs(m.h - l.h) <= HEIGHT_TOL && m.f && l.f && Math.hypot(m.f[0] - l.f[0], m.f[1] - l.f[1]) <= F_TOL);
    if (m0) ownHit++;
    const fr = ms.filter((m) => m.front);
    fronts += fr.length === 1 ? 1 : 0;
    if (fr.length === 1 && near(fr[0], 0)) frontHit++;
  });
  info[c.tag] = { drawn, found, ownHit, wrong, fronts, frontHit };
  ok(`${c.tag}: some places are drawn`, drawn > 0, { drawn });
  ok(`${c.tag}: every drawn place has the enumerator's member at its z`, drawn > 0 && found === drawn, { drawn, found, bad });
  ok(`${c.tag}: every drawn place has a member at its z with its height and value`, ownHit === drawn, { drawn, ownHit });
  ok(`${c.tag}: each drawn place has one front member`, fronts === drawn, { drawn, fronts });
  ok(`${c.tag}: the front member is the one the frame draws (its z)`, frontHit === drawn, { drawn, frontHit });
  ok(`${c.tag}: the control (a z ${WRONG_OFFSET} off) matches no member`, wrong === 0, { wrong });
}
// a frame the mesh path draws has no inverse inputs: the hook answers null
await ev(`__cmwSteps({ scope: 'all', surf: 'land', go: 0, now: true, clock: 0 }); 1`); await settled({ max: LOAD_MAX_MS }); await ev(rAF2);
ok('a parked frame: the enumerator hook answers null', (await ev('__cmwLandEnum([[0, 0]])')) === null);
return { pass: !fails.length, fails, info };
