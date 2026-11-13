  // ---------------- the colour plot's stand-in while its program links ----------------
  // While the colour plot's program links and nothing else can draw the plot (the chain's first version: a cold load, a
  // shared link, a reload), the plot is drawn from F's values on a grid of the pane: computed here on the CPU (cpuMap of
  // the plot's map) and coloured on the GPU as the plot is (GLR.drawColorPlot's st.standIn). The grid's nodes lie on the
  // pane's CSS pixels, every STANDIN_CELLS px, a level at a time: each level is drawn once it is complete, and the next,
  // twice as fine, takes the nodes it shares with it. A stand-in starts once the plot's program has had nothing to draw
  // for SM_LINKING_MS, so a quick link never computes one, and it runs in idle slices of STANDIN_SLICE ms of evaluations
  // (the clock read after each), none while anything moves. It spends at most STANDIN_BUDGET ms: a level starts only
  // when its new nodes fit in what is left, at the cost per evaluation measured so far; a chain whose first level would
  // not fit, or one of whose evaluations takes over STANDIN_EVAL_MAX ms, gets none (the pane waits as it would without).
  const STANDIN_CELLS = [64, 32, 16, 8, 4];
  const STANDIN_SLICE = 4, STANDIN_BUDGET = 250, STANDIN_EVAL_MAX = 8;
  // the stand-in of the plot's map in its view: {key, vkey, map, F, x0, y0, s, w, h, next (the level being
  // evaluated), grid (the finest level done, drawn), prev (the same map's grid in an earlier view, drawn until this one
  // has a level), ms, n (evaluations), slices, maxSlice, end (why it stopped: 'done', 'budget', 'slow', 'error',
  // 'linked'), dead}; null when there is none
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
        next: null, grid: null, prev, ms: 0, n: 0, slices: 0, maxSlice: 0, end: null, dead: false };
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
  // the job's idle driver: a slice at a time, waiting out any motion between them
  async function standInRun(j) {
    for (;;) {
      await yieldTask();
      while (!j.dead && (interacting() || fixBusy())) await yieldNow(60);
      if (j.dead) return;
      if (mapKeyOf(j.map) !== j.key) { j.dead = true; return; }
      if (!(GLR.bareMs(j.map, ['color']) > 0)) { j.end = 'linked'; return; }
      const t0 = performance.now();
      let end;
      try { end = standInSlice(j, t0); } catch (e) { console.error('colour stand-in', e); end = 'error'; }
      const dt = performance.now() - t0;
      j.ms += dt; j.slices++; j.maxSlice = Math.max(j.maxSlice, dt);
      if (end) { j.end = end; return; }
    }
  }
  // one slice of job j, begun at t0: the next level's nodes until STANDIN_SLICE ms are spent; -> why the job stops, or
  // null to go on. A level done is drawn from the next frame on
  function standInSlice(j, t0) {
    let t = t0;
    for (;;) {
      const L = j.next, n = L.nx * L.ny;
      while (L.k < n) {
        const k = L.k++, a = k % L.nx, b = (k - a) / L.nx;
        if (L.li && a % 2 === 0 && b % 2 === 0) continue;
        const z = j.F(C(L.x0 + a * L.h, L.y0 + b * L.h));
        L.w[2 * k] = z.re; L.w[2 * k + 1] = z.im;
        j.n++;
        const t1 = performance.now();
        if (t1 - t > STANDIN_EVAL_MAX) return 'slow';
        t = t1;
        if (t - t0 >= STANDIN_SLICE) {
          const spent = j.ms + t - t0;
          return spent + standInLeft(L, L.k) * spent / j.n > STANDIN_BUDGET ? 'budget' : null;
        }
      }
      j.grid = L; j.prev = null;
      requestRender('L');
      if (L.li === STANDIN_CELLS.length - 1) return 'done';
      const spent = j.ms + t - t0;
      standInLevel(j, L.li + 1);
      if (spent + standInLeft(j.next, 0) * spent / j.n > STANDIN_BUDGET) return 'budget';
    }
  }
