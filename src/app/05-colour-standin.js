  // ---------------- the colour plot's stand-in while its program links ----------------
  // While the colour plot's program links and nothing else can draw the plot (the chain's first version: a cold load, a
  // shared link, a reload), the plot is drawn from F's values on a grid of the pane: computed here on the CPU (cpuMap of
  // the plot's map) and coloured on the GPU as the plot is (GLR.drawColorPlot's st.standIn). The grid's nodes lie on the
  // pane's CSS pixels, every STANDIN_CELLS px, a level at a time: each level is drawn once it is complete, and the next,
  // twice as fine, takes the nodes it shares with it. A stand-in starts once the plot's program has had nothing to draw
  // for SM_LINKING_MS, so a quick link never computes one, and it runs in idle slices, none while anything moves: each
  // ends before an evaluation as long as the last would pass STANDIN_SLICE ms (the clock read after each), short of the
  // idle drivers' 6 ms by the collector's pause that the evaluations' garbage can bring into a slice. It spends at most
  // STANDIN_BUDGET ms: from the second slice on (the first one's evaluations wait on the JIT, many times as long as later
  // ones), at the end of each slice and before each level, the work left is costed at the time per evaluation measured
  // so far, and a stand-in whose work would not fit stops there, its finest level done still drawn. A chain whose first
  // level does not fit gets none: the pane waits as it would without it.
  const STANDIN_CELLS = [64, 32, 16, 8, 4];
  const STANDIN_SLICE = 3, STANDIN_BUDGET = 250;
  // the stand-in of the plot's map in its view: {key, vkey, map, F, x0, y0, s, w, h, next (the level being
  // evaluated), grid (the finest level done, drawn), prev (the same map's grid in an earlier view, drawn until this one
  // has a level), ms, n (evaluations), slices, firstSlice and maxSlice (ms: the first slice, the longest after it), end
  // (why it stopped: 'done', 'budget', 'error', 'linked'), dead}; null when there is none
  let standInJob = null;
  // the stand-in GLR.drawColorPlot gets with pane's plot of map (renderColor): the finest level done, or null when
  // there is none to draw (the plot's program draws, or has waited less than SM_LINKING_MS; not the screen's left pane)
  function colourStandIn(pane, map) {
    if (pane !== paneL || offRender || artMode || sideDraw || !(GLR.bareMs(map, ['color']) > SM_LINKING_MS)) { standInStop(); return null; }
    const v = pane.view, key = mapKeyOf(map), vkey = `${v.cx},${v.cy},${v.s},${pane.w},${pane.h}`;
    let j = standInJob;
    if (!j || j.key !== key || j.vkey !== vkey) {
      const prev = j && j.key === key ? j.grid || j.prev : null;
      standInStop();
      j = standInJob = { key, vkey, map, F: cpuMap(map), x0: v.cx - pane.w / (2 * v.s), y0: v.cy - pane.h / (2 * v.s), s: v.s, w: pane.w, h: pane.h,
        next: null, grid: null, prev, ms: 0, n: 0, slices: 0, firstSlice: 0, maxSlice: 0, end: null, dead: false,
        check: () => (mapKeyOf(map) !== key ? 'dead' : !(GLR.bareMs(map, ['color']) > 0) ? 'linked' : null), slice: (t0) => standInSlice(j, t0) };
      standInLevel(j, 0);
      standInRun(j);
    }
    return j.grid || j.prev;
  }
  function standInStop() {
    if (standInJob) standInJob.dead = true;
    standInJob = null;
  }
  // level li of job j, to evaluate: its nodes over the pane (one past each edge), with those it shares with the level
  // before, every other node across and up, taken from it
  function standInLevel(j, li) {
    const cell = STANDIN_CELLS[li], nx = Math.ceil(j.w / cell) + 1, ny = Math.ceil(j.h / cell) + 1, w = new Float32Array(2 * nx * ny), g = j.grid;
    if (g) {
      for (let b = 0; b < g.ny && 2 * b < ny; b++) {
        for (let a = 0; a < g.nx && 2 * a < nx; a++) { const p = 4 * (b * nx + a), q = 2 * (b * g.nx + a); w[p] = g.w[q]; w[p + 1] = g.w[q + 1]; }
      }
    }
    j.next = { x0: j.x0, y0: j.y0, h: cell / j.s, nx, ny, w, li, cell, k: 0 };
  }
  // the nodes of level L still to evaluate from node k on: all of them on the first level, three in four on the others
  const standInLeft = (L, k) => (L.nx * L.ny - k) * (L.li ? 0.75 : 1);
  // a stand-in job's idle driver: a slice at a time (j.slice(t0) -> why the job stops, or null to go on), waiting out any
  // motion between them; j.check() -> why it stops before its next slice ('dead': what it was for is gone; 'linked'), or null
  async function standInRun(j) {
    for (;;) {
      await yieldTask();
      while (!j.dead && (interacting() || fixBusy())) await yieldNow(60);
      if (j.dead) return;
      const stop = j.check();
      if (stop) { j.end = stop; j.dead = stop === 'dead'; return; }
      const t0 = performance.now();
      let end;
      try { end = j.slice(t0); } catch (e) { console.error('stand-in', e); end = 'error'; }
      const dt = performance.now() - t0;
      if (j.slices) j.maxSlice = Math.max(j.maxSlice, dt); else j.firstSlice = dt;
      j.ms += dt; j.slices++;
      if (end) { j.end = end; return; }
    }
  }
  // after an evaluation of job j that ended at t, last ms after the one before it, in a slice begun at t0, with left
  // evaluations still to cost: undefined to go on, else why the slice ends: null when the next evaluation, as long as the
  // last, would end past STANDIN_SLICE ms, 'budget' (from the second slice on) when the work left would not fit
  function standInDue(j, t0, last, t, left) {
    if (t - t0 + last < STANDIN_SLICE) return undefined;
    const spent = j.ms + t - t0;
    return j.slices && spent + left * spent / j.n > STANDIN_BUDGET ? 'budget' : null;
  }
  // one slice of job j, begun at t0: the next level's nodes until standInDue ends it; -> why the job stops, or null to go
  // on. A level done is drawn from the next frame on
  function standInSlice(j, t0) {
    let te = t0;
    for (;;) {
      const L = j.next, n = L.nx * L.ny;
      while (L.k < n) {
        const k = L.k++, a = k % L.nx, b = (k - a) / L.nx;
        if (L.li && a % 2 === 0 && b % 2 === 0) continue;
        const z = j.F(C(L.x0 + a * L.h, L.y0 + b * L.h));
        L.w[2 * k] = z.re; L.w[2 * k + 1] = z.im;
        j.n++;
        const t = performance.now(), due = standInDue(j, t0, t - te, t, standInLeft(L, L.k));
        te = t;
        if (due !== undefined) return due;
      }
      j.grid = L; j.prev = null;
      requestRender('L');
      if (L.li === STANDIN_CELLS.length - 1) return 'done';
      const spent = j.ms + performance.now() - t0;
      standInLevel(j, L.li + 1);
      if (j.slices && spent + standInLeft(j.next, 0) * spent / j.n > STANDIN_BUDGET) return 'budget';
    }
  }
  // ---------------- the carried colour's stand-in past a colour plane T > 0 ----------------
  // While the carried colour's programs link, a plane at rest past a colour plane T > 0 is drawn from its regions'
  // SphereMeshes (smNeed's 'linking'), each vertex coloured by its source point z's point of plane T, G(z) (cpuMap of the
  // stages 0 to T), as the colour plane colours it: G is computed here, a mesh at a time, in the colour plot's stand-in's
  // slices and budget (a mesh whose points do not fit gets none), and goes to the GPU with the mesh (GLR.setPreW)
  let carriedJob = null;
  const PRE_ARG = 16 / TAU;   // (the meshes' polar coordinates: (ln |z|, arg z) * PRE_ARG, PAT_PRE's)
  // whether SphereMesh entry e's mesh carries its points of plane T on the GPU; when not, its job starts (if none runs)
  // or goes on (e.carryW: the points made, {key, w}, w null when they did not fit the budget). preZ: the mesh keeps the source point itself, not its polar coordinates (graph paper's mesh)
  function carriedW(e, T, preZ) {
    const map = { mode: 0, a: 0, b: T }, key = `${e.key}|${mapKeyOf(map)}|${preZ ? 1 : 0}`;
    if (!e.res) return false;
    if (e.res.wKey === key) return true;
    if (e.carryW && e.carryW.key === key) return !!e.carryW.w && GLR.setPreW(e.res, e.carryW.w, key);
    const j = carriedJob;
    if (j && !j.end && !j.dead && sm.entries.get(j.e.key) === j.e) return false;
    const n3 = 3 * e.data.n, mapKey = mapKeyOf(map);
    const nj = carriedJob = { key, e, preZ, F: cpuMap(map), w: new Float32Array(2 * n3), seen: new Map(), k: 0, n: 0, ms: 0, slices: 0, firstSlice: 0, maxSlice: 0, end: null, dead: false,
      check: () => (sm.entries.get(e.key) !== e || mapKeyOf(map) !== mapKey ? 'dead' : null), slice: (t0) => carriedSlice(nj, t0) };
    standInRun(nj);
    return false;
  }
  // one slice of job j, begun at t0: the mesh's corners in order, each new source point's G evaluated once (corners share
  // points), as (ln |G|, arg G) * PRE_ARG with arg continuous across each triangle; -> why the job stops, or null to go on
  function carriedSlice(j, t0) {
    const A = j.e.data.attr, n3 = 3 * j.e.data.n;
    let te = t0;
    while (j.k < n3) {
      const k = j.k++, c = k % 3, a = ((k - c) / 3) * 12 + 4 * c, px = A[a + 2], py = A[a + 3], id = px + ',' + py;
      let g = j.seen.get(id), due;
      if (!g) {
        const lr = Math.max(-80, Math.min(80, px / PRE_ARG)), z = j.preZ ? C(px, py) : C(Math.exp(lr) * Math.cos(py / PRE_ARG), Math.exp(lr) * Math.sin(py / PRE_ARG));
        let w;
        try { w = j.F(z); } catch (err) { w = C(NaN, NaN); }
        const r = Math.hypot(w.re, w.im);
        g = Number.isNaN(r) ? [NaN, NaN] : !Number.isFinite(r) ? [80 * PRE_ARG, 0] : [Math.log(Math.max(r, 1e-300)) * PRE_ARG, Math.atan2(w.im, w.re) * PRE_ARG];
        j.seen.set(id, g); j.n++;
        const t = performance.now();
        due = standInDue(j, t0, t - te, t, (n3 - j.k) * j.n / j.k);
        te = t;
      }
      const turn = 2 * Math.PI * PRE_ARG, a0 = c ? j.w[2 * (k - c) + 1] : g[1];
      j.w[2 * k] = g[0]; j.w[2 * k + 1] = g[1] + turn * Math.round((a0 - g[1]) / turn);
      if (due === 'budget') j.e.carryW = { key: j.key, w: null };
      if (due !== undefined) return due;
    }
    j.e.carryW = { key: j.key, w: j.w };
    if (j.e.res) GLR.setPreW(j.e.res, j.w, j.key);
    requestRender('L');
    return 'done';
  }
