// The steps view's globe marks (0, ∞, 1, i, −1, −i) over the picture, with Inside regions as with Everywhere (#1577).
// The default page at rest on plane z, on the Sphere, at 1440 x 900: every mark the globe draws at full ink (it faces
// the camera, n·v past 0.3) must show on the final frame. A page wrapper of the 2D context's fillText and strokeText
// records where the left pane writes each mark (its box in device px, the glyph and its halo) and can leave the marks
// out; the frame is drawn with the marks and again without them, and in each full-ink mark's box at least GLYPH_MIN
// pixels must differ by more than DIFF levels (held_frames' compare). Everywhere is the reference, where nothing is
// drawn over the marks; Inside regions draws the colour globe kept inside the regions in a pass of its own, which must
// not cover them. On the default page the "i" faces the camera inside a region, so it is required among the full-ink
// marks: a frame with no such mark fails.
// The figure (Figure.build, the paper still) and the video's frame in the print look (Figure.glideArt, look null) draw
// these names as vectors over their art raster, so the raster, drawn off the page (artMode), must hold none of them,
// Everywhere and Inside regions alike: the wrapper counts the marks written while each builds on canvases that are not
// in the document and at least ART_MIN px each way (the art raster; the figure also writes its labels on a small canvas
// of its own to measure them).
// At rest on a plane past the colour plane (svGlobeRest), where some regions take the exact pass and others the
// carried mesh, the mesh is drawn over the exact pass's globe kept inside its regions, and must not cover the marks
// either (#1637): z² from plane z, coloured from plane z, at rest on w₁, Inside regions, with a disc around e^(i pi/4)
// (its image holds w = i) forced onto the mesh and a disc in the third quadrant left on the exact pass (the globe's
// path 'mixed', which the leg requires). The same checks, the figure's too.
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, results}.
const fails = [], R = {};
// (GLYPH_MIN: the least number of a mark's pixels its glyph and halo change, at dpr 1 (an "i" at GLOBE_MARK_PX changes
// about 60); DIFF: the levels of 255 by which a pixel must change to count; FULL_INK: the mark's alpha that counts as full
// ink (smoothstep(0.05, 0.3, n·v) at 1))
// ART_MIN: the least side, in px, of an off-page canvas counted as the figure's art raster (1403 x 1196 on the default
// page, 1186 x 1011 in the rest leg; the figure's label-measuring canvas is 48 x 32)
// VIDEO_PT: a video frame's picture size in pt, [w, h], as the video asks for it (1280 x 960 px at dpr 1: 960 x 720 pt)
const GLYPH_MIN = 15, DIFF = 32, FULL_INK = 0.99, ART_MIN = 256, VIDEO_PT = [960, 720];
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const QUIET_UNTIL = "window.__cmwSteps && __cmwSteps().ready.ready && !__cmwSteps().anim && !__cmwSteps().play && !(window.__cmwSphere && __cmwSphere().running) && GLR.pendingLinks === 0 && __cmwSvFixed()";
const quiet = () => settled({ max: 60000, until: QUIET_UNTIL });
const { grab } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
// the page's wrapper: __mk.seen[mark] = { x0, x1, y0, y1, a } for each mark the left pane wrote in the last frames;
// __mk.on false leaves the marks out; __mk.art: the marks written on canvases off the page at least ART_MIN px each way,
// each as "mark@WxH"
const WRAP = `(() => {
  if (window.__mk) return 1;
  const M = new Set(['0', '∞', '1', 'i', '−1', '−i']), P = CanvasRenderingContext2D.prototype;
  window.__mk = { on: true, seen: {}, art: [] };
  for (const fn of ['fillText', 'strokeText']) {
    const f = P[fn];
    P[fn] = function (t, x, y, ...rest) {
      const cv = this.canvas;
      if (M.has(t) && cv instanceof HTMLCanvasElement && !cv.isConnected && cv.width >= ${ART_MIN} && cv.height >= ${ART_MIN}) __mk.art.push(t + '@' + cv.width + 'x' + cv.height);
      if (this.canvas.id === 'canvasL' && M.has(t)) {
        const m = this.getTransform(), w = this.measureText(t).width, px = parseFloat((/([\\d.]+)px/.exec(this.font) || [0, 16])[1]);
        const X = m.a * x + m.c * y + m.e, Y = m.b * x + m.d * y + m.f, hw = (w / 2 + 3) * m.a, hh = (px / 2 + 3) * m.d;
        __mk.seen[t] = { x0: Math.floor(X - hw), x1: Math.ceil(X + hw), y0: Math.floor(Y - hh), y1: Math.ceil(Y + hh), a: this.globalAlpha };
        if (!__mk.on) return undefined;
      }
      return f.call(this, t, x, y, ...rest);
    };
  }
  return 1;
})()`;
// the frame drawn again (the thread set where it is), once it settles
const redraw = async () => {
  await ev('__cmwSteps({ x: __cmwSteps().x }), 1');
  await ev('await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))), 1');
  await quiet();
};
// in each recorded mark's box, the pixels of the kept frames a and b more than DIFF apart
const changed = (a, b) => ev(`(() => {
  const A = window.__heldPx[${JSON.stringify(a)}], B = window.__heldPx[${JSON.stringify(b)}], W = document.getElementById('canvasL').width, out = {};
  for (const [t, q] of Object.entries(__mk.seen)) {
    let n = 0;
    for (let y = Math.max(0, q.y0); y < q.y1; y++) for (let x = Math.max(0, q.x0); x < Math.min(W, q.x1); x++) {
      const i = 4 * (y * W + x);
      if (Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2])) > ${DIFF}) n++;
    }
    out[t] = { n, a: +q.a.toFixed(3), box: [q.x0, q.y0, q.x1, q.y1] };
  }
  return out;
})()`);

// one leg: the frame at rest as it stands, with the marks and without them, each full-ink mark's box compared, the "i"
// required among them; then the figure of the same view, with no mark on its art raster
const leg = async (tag) => {
  await ev('__mk.on = true, __mk.seen = {}, 1');
  await redraw();
  ok(`${tag}: the frame with the marks settles`, await grab(`${tag}-marks`), null);
  await ev('__mk.on = false, 1');
  await redraw();
  ok(`${tag}: the frame without the marks settles`, await grab(`${tag}-none`), null);
  await ev('__mk.on = true, 1');
  const c = await changed(`${tag}-marks`, `${tag}-none`), st = await ev('__cmwSteps()');
  R[tag] = { marks: c, x: st.x, scope: st.scope, surf: st.surf, T: st.T };
  ok(`${tag}: the "i" faces the camera at full ink`, !!c.i && c.i.a >= FULL_INK, R[tag]);
  for (const [t, q] of Object.entries(c)) {
    if (q.a < FULL_INK) continue;
    ok(`${tag}: the mark "${t}" shows on the frame (at least ${GLYPH_MIN} of its pixels change)`, q.n >= GLYPH_MIN, q);
  }
  const fig = await ev('(async () => { __mk.art = []; const f = await Figure.build({}); return { built: !!f, art: __mk.art.slice() }; })()');
  R[tag].figure = fig;
  ok(`${tag}: the figure builds`, !!fig && fig.built, fig);
  ok(`${tag}: the figure's art raster holds none of the marks (the figure draws them as vectors)`, !!fig && fig.built && fig.art.length === 0, fig);
  // (the video's frame in the print look, at the thread's place: the same art layer, VIDEO_PT the frame's size)
  const vid = await ev(`(async () => { __mk.art = []; const r = await Figure.glideArt(${st.x}, { wpt: ${VIDEO_PT[0]}, hpt: ${VIDEO_PT[1]}, dpi: 96, raw: true, look: null }); return { drawn: !!r, art: __mk.art.slice() }; })()`);
  R[tag].video = vid;
  ok(`${tag}: the video's print-look frame is drawn`, !!vid && vid.drawn, vid);
  ok(`${tag}: the video's print-look frame holds none of the marks`, !!vid && vid.drawn && vid.art.length === 0, vid);
  return st;
};

await view(1440, 900, false, false);
await go(`http://localhost:${PORT}/test.html?ns=svmk${Date.now()}&view=steps`);
await settled({ max: 60000, until: "typeof __cmwSteps === 'function' && !!window.GLR && !!document.getElementById('canvasL')" });
await ev(`__cmwSet('morphPaths', false); 1`);
await ev(WRAP);
for (const scope of ['all', 'in']) {
  await ev(`__cmwSteps({ go: 0, now: true, surf: 'sphere', scope: '${scope}' }); 1`);
  await quiet();
  const st = await leg(scope);
  ok(`${scope}: on plane z, on the Sphere`, st.x === 0 && st.surf === 'sphere' && st.scope === scope, R[scope]);
}

// ---- at rest past the colour plane, the exact pass and the carried mesh together (svGlobeRest) ----
{
  // (the disc around e^(i pi/4) = sqrt(i): z² takes it to a disc of radius about 0.7 around w = i, which holds the "i"
  // mark's place on the globe)
  const FWD = { id: 's1', kind: 'disc', c: [Math.SQRT1_2, Math.SQRT1_2], r: 0.35, ci: 0, visible: true };
  const EXACT = { id: 's2', kind: 'disc', c: [-0.9, -0.6], r: 0.35, ci: 1, visible: true };
  const state = { v3: true, v4: true, v5: true, v6: true, shapes: [FWD, EXACT], steps: [{ type: 'pown', params: { n: 2 }, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } };
  const ns = `svmkr${Date.now()}`;
  await go(`http://localhost:${PORT}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(state))}); 1`);
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  await settled({ max: 60000, until: "typeof __cmwSteps === 'function' && typeof __cmwSvGlobe === 'function' && typeof __cmwForceForward === 'function' && !!window.GLR && !!document.getElementById('canvasL')" });
  await ev(`__cmwSet('morphPaths', false); 1`);
  await ev(WRAP);
  await ev(`__cmwForceForward(['${FWD.id}']); __cmwSteps({ go: 1, now: true, surf: 'sphere', scope: 'in', T: 0 }); 1`);
  await quiet();
  const st = await leg('rest');
  R.rest.path = (await ev('__cmwSvGlobe(0, 0)')).path;
  ok('rest: at rest on plane w1 past the colour plane z, Inside regions, on the Sphere', st.x === 1 && st.T === 0 && st.surf === 'sphere' && st.scope === 'in', R.rest);
  ok("rest: the globe carries by the exact pass and the mesh together (path 'mixed')", R.rest.path === 'mixed', R.rest);
  await ev('__cmwForceForward([]); 1');
}
await redraw();
R.logs = (await logs()).filter((l) => /error|exception/i.test(l.t) && !/Failed to load resource/.test(l.m)).slice(0, 5);
ok('no errors in the console', R.logs.length === 0, R.logs);
return { pass: fails.length === 0, fails, results: R };
