  // ---------------- the colour plot's stand-in while its program links ----------------
  // While the colour plot's program links and nothing else can draw the plot (the chain's first version: a cold load, a
  // shared link, a reload), the plot is drawn from F's values on a grid of the pane: computed here on the CPU (cpuMap of
  // the plot's map) and coloured on the GPU as the plot is (GLR.drawColorPlot's st.standIn). The grid's nodes lie on the
  // pane's CSS pixels, every STANDIN_CELLS px, a level at a time: each level is drawn once it is complete, and the next,
  // twice as fine, takes the nodes it shares with it. The phase globe's program (sphereP) has the same stand-in over
  // a longitude-latitude grid (globeStandIn, GLOBE_STANDIN_NODES: drawSphere's st.standIn), and the Landscape's
  // (landTF and land; with All sheets, landSheetTF and landSheet: the principal branch stands in for the sheets) over a
  // grid of the block's box (landStandIn, LAND_STANDIN_NODES: drawLandscape's st.standIn), in the same job. A stand-in starts once the plot's program has had nothing to draw
  // for SM_LINKING_MS, so a quick link never computes one, and it runs in idle slices, none while anything moves: each
  // ends before an evaluation as long as the last would pass STANDIN_SLICE ms (the clock read after each), short of the
  // idle drivers' 6 ms by the collector's pause that the evaluations' garbage can bring into a slice. It spends at most
  // STANDIN_BUDGET ms: from the second slice on (the first one's evaluations wait on the JIT, many times as long as later
  // ones), at the end of each slice and before each level, the work left is costed at the time per evaluation measured
  // so far, and a stand-in whose work would not fit stops there, its finest level done still drawn. A chain whose first
  // level does not fit gets none: the pane waits as it would without it.
  const STANDIN_CELLS = [64, 32, 16, 8, 4];
  // the phase globe's levels: the nodes across (longitude, the seam's node twice) and up (latitude, pole to pole)
  const GLOBE_STANDIN_NODES = [[33, 17], [65, 33], [129, 65], [257, 129]];
  // the Landscape's levels: the nodes across and up the block's box
  const LAND_STANDIN_NODES = [[33, 33], [65, 65], [129, 129], [257, 257]];
  const STANDIN_SLICE = 3, STANDIN_BUDGET = 250;
  // the stand-in of the plot's map in its view: {key, vkey, name (the plot's program; names: the programs the job waits on,
  // else [name]), map, F, globe (the globe's: no view in it), land (the Landscape's: the box), x0, y0, s, w, h, next (the level being evaluated), grid (the finest level done, drawn), prev (the same map's
  // grid in an earlier view, drawn until this one has a level), ms, n (evaluations), slices, firstSlice and maxSlice (ms:
  // the first slice, the longest after it), end (why it stopped: 'done', 'budget', 'error', 'linked'), dead}; null when there is none
  let standInJob = null;
  // the stand-in GLR.drawColorPlot gets with pane's plot of map (renderColor), the plot drawn by program name (color, or
  // the Cauchy style's cauchyF or cauchy: GLR.colorProgName): the finest level done, or null when there is none to draw
  // (the plot's program draws, or has waited less than SM_LINKING_MS; not the screen's left pane). It also tells the LEDs
  // whether the left pane's plot is still waiting on its program (setColourWaiting)
  function colourStandIn(pane, map, name = 'color') {
    const waited = pane === paneL && !offRender && !artMode && !sideDraw ? GLR.bareMs(map, [name]) : 0;
    if (!(waited > SM_LINKING_MS)) { standInStop(); return leftAsked(pane, waited, null); }
    const v = pane.view, vkey = `${v.cx},${v.cy},${v.s},${pane.w},${pane.h}`;
    return leftAsked(pane, waited, standInOf({ vkey, name, map, x0: v.cx - pane.w / (2 * v.s), y0: v.cy - pane.h / (2 * v.s), s: v.s, w: pane.w, h: pane.h }));
  }
  // the stand-in GLR.drawSphere gets with the left pane's colour globe of map (sphereView), drawn by sphereP: as
  // colourStandIn's, over longitude and latitude, whatever the camera
  function globeStandIn(pane, map) {
    const waited = pane === paneL && !offRender && !artMode && !sideDraw ? GLR.bareMs(map, ['sphereP']) : 0;
    if (!(waited > SM_LINKING_MS)) { standInStop(); return null; }
    return standInOf({ vkey: 'globe', name: 'sphereP', map, globe: true });
  }
  // the stand-in GLR.drawLandscape gets with the left pane's Landscape of map over box (landscapeView), drawn by landTF and
  // land: F's values over the box, from which the relief and its colour are drawn while they link. With All sheets (sheeted)
  // it waits on the sheets' programs (landSheetTF, landSheet) and the principal branch stands in for the covering surface
  function landStandIn(pane, map, box, sheeted) {
    const names = sheeted ? ['landSheetTF', 'landSheet'] : ['landTF', 'land'], waited = pane === paneL && !offRender && !artMode && !sideDraw && (map.mode || 0) === 0 ? GLR.bareMs(map, names) : 0;
    if (!(waited > SM_LINKING_MS)) { standInStop(); return null; }
    return standInOf({ vkey: `land|${box.x0},${box.x1},${box.y0},${box.y1}`, name: 'land', names, map, land: box });
  }
  // the job's grid for what a stand-in is of (key: the map, vkey: its view; the fields colourStandIn and globeStandIn
  // give), started when there is none for it: -> the finest level done, else the same map's from an earlier view
  function standInOf(o) {
    const key = mapKeyOf(o.map);
    let j = standInJob;
    if (!j || j.key !== key || j.vkey !== o.vkey || j.name !== o.name) {
      const prev = j && j.key === key && j.name === o.name ? j.grid || j.prev : null;
      standInStop();
      j = standInJob = Object.assign({ key, F: cpuMap(o.map), next: null, grid: null, prev, ms: 0, n: 0, slices: 0, firstSlice: 0, maxSlice: 0, end: null, dead: false }, o);
      standInLevel(j, 0);
      standInRun(j);
    }
    return j.grid || j.prev;
  }
  // the left pane's ask for its plot recorded (colourAsks, colourBlank, the LEDs' colourWaiting) -> its stand-in r
  function leftAsked(pane, waited, r) {
    if (pane === paneL) { colourAsks++; colourBlank = waited > 0 && !r; setColourWaiting(waited > 0); }
    return r;
  }
  // whether the left pane's colour plot is still waiting on its program (the stand-in draws it meanwhile, or soon will): the
  // left LED stays amber until it is done; a change updates the LEDs
  let colourWaiting = false;
  // how many times the left pane's colour plot has asked for its program (colourStandIn), and whether at the last ask it
  // drew nothing (its program still waiting and no stand-in to draw yet): a frame that asked reads colourBlank as its own
  let colourAsks = 0, colourBlank = false;
  function setColourWaiting(on) {
    if (on === colourWaiting) return;
    colourWaiting = on;
    updateLeds();
  }
  const colourPending = () => colourWaiting && lColor();
  function standInStop() {
    if (standInJob) standInJob.dead = true;
    standInJob = null;
  }
  // level li of job j, to evaluate: its nodes over the pane (one past each edge), with those it shares with the level
  // before, every other node across and up, taken from it
  function standInLevel(j, li) {
    const cell = j.globe || j.land ? 0 : STANDIN_CELLS[li], [nx, ny] = standInNodes(j)[li] || [Math.ceil(j.w / cell) + 1, Math.ceil(j.h / cell) + 1];
    const w = new Float32Array(2 * nx * ny), g = j.grid;
    if (g) {
      for (let b = 0; b < g.ny && 2 * b < ny; b++) {
        for (let a = 0; a < g.nx && 2 * a < nx; a++) { const p = 4 * (b * nx + a), q = 2 * (b * g.nx + a); w[p] = g.w[q]; w[p + 1] = g.w[q + 1]; }
      }
    }
    j.next = j.globe || j.land ? { nx, ny, w, li, cell, k: 0 } : { x0: j.x0, y0: j.y0, h: cell / j.s, nx, ny, w, li, cell, k: 0 };
  }
  // job j's levels' nodes ([across, up] each; none for the plane's, whose levels are cells of STANDIN_CELLS)
  const standInNodes = (j) => (j.globe ? GLOBE_STANDIN_NODES : j.land ? LAND_STANDIN_NODES : STANDIN_CELLS.map(() => null));
  // the point of the plane that grid node (a, b) of level L is: on the pane, its pixel; on the Landscape, the box's point a / (nx - 1)
  // across and b / (ny - 1) up; on the globe, the point of longitude -pi + 2 pi a / (nx - 1) and latitude
  // -pi / 2 + pi b / (ny - 1), projected from the north pole as the globe's shader does (a node at the pole is far out on the plane)
  function standInPoint(j, L, a, b) {
    if (j.land) return C(j.land.x0 + (j.land.x1 - j.land.x0) * a / (L.nx - 1), j.land.y0 + (j.land.y1 - j.land.y0) * b / (L.ny - 1));
    if (!j.globe) return C(L.x0 + a * L.h, L.y0 + b * L.h);
    if (b === 0) return C(0, 0);
    if (b === L.ny - 1) return C(1e12, 0);
    const lon = -Math.PI + 2 * Math.PI * a / (L.nx - 1), lat = -Math.PI / 2 + Math.PI * b / (L.ny - 1), c = Math.cos(lat), d = 1 - Math.sin(lat);
    return C(c * Math.cos(lon) / d, -c * Math.sin(lon) / d);
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
      if (!(GLR.bareMs(j.map, j.names || [j.name]) > 0)) { j.end = 'linked'; return; }
      const t0 = performance.now();
      let end;
      try { end = standInSlice(j, t0); } catch (e) { console.error('colour stand-in', e); end = 'error'; }
      const dt = performance.now() - t0;
      if (j.slices) j.maxSlice = Math.max(j.maxSlice, dt); else j.firstSlice = dt;
      j.ms += dt; j.slices++;
      if (end) { j.end = end; return; }
    }
  }
  // one slice of job j, begun at t0: the next level's nodes until the next one, as long as the last, would end past
  // STANDIN_SLICE ms; -> why the job stops, or null to go on. A level done is drawn from the next frame on
  function standInSlice(j, t0) {
    let te = t0;
    for (;;) {
      const L = j.next, n = L.nx * L.ny;
      while (L.k < n) {
        const k = L.k++, a = k % L.nx, b = (k - a) / L.nx;
        if (L.li && a % 2 === 0 && b % 2 === 0) continue;
        const z = j.F(standInPoint(j, L, a, b));
        L.w[2 * k] = z.re; L.w[2 * k + 1] = z.im;
        j.n++;
        const t = performance.now(), last = t - te;
        te = t;
        if (t - t0 + last >= STANDIN_SLICE) {
          const spent = j.ms + t - t0;
          return j.slices && spent + standInLeft(L, L.k) * spent / j.n > STANDIN_BUDGET ? 'budget' : null;
        }
      }
      j.grid = L; j.prev = null;
      requestRender('L');
      if (L.li === standInNodes(j).length - 1) return 'done';
      const spent = j.ms + performance.now() - t0;
      standInLevel(j, L.li + 1);
      if (j.slices && spent + standInLeft(j.next, 0) * spent / j.n > STANDIN_BUDGET) return 'budget';
    }
  }
