  // ---------------- the colour plot's stand-in while its program links ----------------
  // While the colour plot's program links and nothing else can draw the plot (the chain's first version: a cold load, a
  // shared link, a reload), the plot is drawn from F's values on a grid of the pane: computed here on the CPU (cpuMap of
  // the plot's map) and coloured on the GPU as the plot is (GLR.drawColorPlot's st.standIn). The grid's nodes lie on the
  // pane's CSS pixels, every STANDIN_CELLS px, a level at a time: each level is drawn once it is complete, and the next,
  // twice as fine, takes the nodes it shares with it. The phase globe's program (sphereP) has the same stand-in over
  // a longitude-latitude grid (globeStandIn, GLOBE_STANDIN_NODES: drawSphere's st.standIn), and the Landscape's
  // (landTF and land) over a grid of the block's box (landStandIn, LAND_STANDIN_NODES: drawLandscape's st.standIn), in the
  // same job. A stand-in starts once the plot's program has had nothing to draw
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
  // the first slice, the longest after it), need (the work as last costed, ms: standInNeed), end (why it stopped:
  // 'done', 'budget', 'error', 'linked'), dead, check and slice (standInRun's)}; null when there is none
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
      j = standInJob = Object.assign({ key, F: cpuMap(o.map), next: null, grid: null, prev, ms: 0, n: 0, slices: 0, firstSlice: 0, maxSlice: 0, end: null, dead: false,
        check: () => (mapKeyOf(o.map) !== key ? 'dead' : !(GLR.bareMs(o.map, o.names || [o.name]) > 0) ? 'linked' : null), slice: (t0) => standInSlice(j, t0) }, o);
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
  // a stand-in job's idle driver: a slice at a time (j.slice(t0) -> why the job stops, null to go on, or 'rest' to go on
  // after j.rest ms), waiting out any motion between them; j.check() -> why it stops before its next slice ('linked', or
  // 'dead': what it was for is gone, the job then dead with no end), or null
  async function standInRun(j) {
    for (;;) {
      await yieldTask();
      while (!j.dead && (interacting() || fixBusy())) await yieldNow(60);
      if (j.dead) return;
      const stop = j.check();
      if (stop === 'dead') { j.dead = true; return; }
      if (stop) { j.end = stop; return; }
      const t0 = performance.now();
      let end;
      try { end = j.slice(t0); } catch (e) { console.error('stand-in', e); end = 'error'; }
      const dt = performance.now() - t0;
      if (j.slices) j.maxSlice = Math.max(j.maxSlice, dt); else j.firstSlice = dt;
      j.ms += dt; j.slices++;
      if (end === 'rest') { j.rests++; await yieldNow(j.rest); continue; }
      if (end) { j.end = end; return; }
    }
  }
  // after an evaluation of job j that ended at t, last ms after the one before it, in a slice begun at t0, with left
  // evaluations still to cost: undefined to go on, else why the slice ends: null when the next evaluation, as long as the
  // last, would end past STANDIN_SLICE ms, 'budget' (from the second slice on) when the work left would not fit budget
  // (j.need: the job's whole work as costed, ms)
  function standInDue(j, t0, last, t, left, budget = STANDIN_BUDGET) {
    if (t - t0 + last < STANDIN_SLICE) return undefined;
    return j.slices && standInNeed(j, j.ms + t - t0, left) > budget ? 'budget' : null;
  }
  // job j's whole work as costed, after spent ms with left evaluations to go, at its time per evaluation so far (kept
  // as j.need)
  const standInNeed = (j, spent, left) => (j.need = spent + left * spent / j.n);
  // one slice of job j, begun at t0: the next level's nodes until standInDue ends it; -> why the job stops, or null to go
  // on. A level done is drawn from the next frame on
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
        const t = performance.now(), due = standInDue(j, t0, t - te, t, standInLeft(L, L.k));
        te = t;
        if (due !== undefined) return due;
      }
      j.grid = L; j.prev = null;
      requestRender('L');
      if (L.li === standInNodes(j).length - 1) return 'done';
      const spent = j.ms + performance.now() - t0;
      standInLevel(j, L.li + 1);
      if (j.slices && standInNeed(j, spent, standInLeft(j.next, 0)) > STANDIN_BUDGET) return 'budget';
    }
  }
  // ---------------- the carried colour's stand-in past a colour plane T > 0 ----------------
  // While the carried colour's programs link, a plane at rest past a colour plane T > 0 is drawn from its regions'
  // SphereMeshes (smNeed's 'linking'), each vertex coloured by its source point z's point of plane T, G(z) (cpuMap of the
  // stages 0 to T), as the colour plane colours it: G is computed here, a mesh at a time, in the colour plot's stand-in's
  // slices, and goes to the GPU with the mesh (GLR.setPreW). Nothing is drawn until every mesh has its points, so a mesh
  // whose work does not fit the budget (each mesh's) rests, and goes on once the time since it started, at
  // CARRIED_SHARE of the main thread, pays for the work left, costed again after each slice (a busy CPU, as
  // a driver compiling on every core, makes the costing grow, and a CPU that frees up makes it shrink). A mesh whose
  // work is costed past CARRIED_MAX ms once an eighth of its corners are done gets none (before that, the costing runs
  // far high: the first slice's evaluations wait on the JIT, and the first triangles bring the most new points). G is
  // per vertex, interpolated across each triangle in a form that stands for it there (carriedForm): its polar
  // coordinates, or about a zero or a pole of G, G itself or 1/G. A cut of G that the plane does not share is blurred
  // across its triangles
  let carriedJob = null;
  const PRE_ARG = 16 / TAU;   // (the meshes' polar coordinates: (ln |z|, arg z) * PRE_ARG, PAT_PRE's)
  // (a rest lasts until the work fits, at least CARRIED_REST[0] ms and at most CARRIED_REST[1], then a slice costs it again)
  const CARRIED_SHARE = 0.25, CARRIED_MAX = 4000, CARRIED_REST = [100, 2000];
  // whether SphereMesh entry e's mesh carries its points of plane T on the GPU; when not, its job starts (if none runs)
  // or goes on (e.carryW: {key, w}, set when the job starts, w the points once it is done, null while it runs and for
  // good when it stopped first: past CARRIED_MAX, an error, the program linked). preZ: the mesh keeps the source point
  // itself, not its polar coordinates (graph paper's mesh); map: the plane's map, whose carried colour's program the job
  // ends at
  function carriedW(e, T, preZ, map) {
    const toT = { mode: 0, a: 0, b: T }, key = `${e.key}|${mapKeyOf(toT)}|${preZ ? 1 : 0}`;
    if (!e.res) return false;
    if (e.res.wKey === key) return true;
    if (e.carryW && e.carryW.key === key) return !!e.carryW.w && GLR.setPreW(e.res, e.carryW.w, key);
    const j = carriedJob;
    if (j && !j.end && !j.dead && sm.entries.get(j.e.key) === j.e) return false;
    const n3 = 3 * e.data.n, mapKey = mapKeyOf(toT);
    e.carryW = { key, w: null };
    const nj = carriedJob = { key, e, preZ, F: cpuMap(toT), w: new Float32Array(3 * n3), seen: new Map(), tri: [null, null, null], k: 0, n: 0, ms: 0, slices: 0, firstSlice: 0, maxSlice: 0, end: null, dead: false,
      t0: performance.now(), rests: 0, rest: 0, need: 0,
      check: () => (sm.entries.get(e.key) !== e || mapKeyOf(toT) !== mapKey ? 'dead' : GLR.linked(['regionPK'], map) ? 'linked' : null), slice: (t0) => carriedSlice(nj, t0) };
    standInRun(nj);
    return false;
  }
  // the source point of a pre-mapped mesh's polar coordinates (px, py) (PAT_PRE's, ln |z| clamped as PRE_SRC's)
  const preSrcOf = (px, py) => { const r = Math.exp(Math.max(-GLR.PRE_LN, Math.min(GLR.PRE_LN, px / PRE_ARG))); return C(r * Math.cos(py / PRE_ARG), r * Math.sin(py / PRE_ARG)); };
  // corner k of a pre-mapped mesh's data D (SphereMesh.publish's), in its triangle t at corner c: id, its source point's
  // key among the mesh's points, and z(), that point. zP: its P is the source point itself, not its polar coordinates
  // (graph paper's mesh, preZ, and SphereMesh's cart triangles)
  function preCorner(D, k, preZ) {
    const c = k % 3, t = (k - c) / 3, a = t * 12 + 4 * c, px = D.attr[a + 2], py = D.attr[a + 3], zP = preZ || !!(D.cart && D.cart[t]);
    return { c, t, zP, id: (zP ? 'z' : 'p') + px + ',' + py, z: () => (zP ? C(px, py) : preSrcOf(px, py)) };
  }
  // ---------------- the carried colour's stand-in on a glide frame past the colour plane ----------------
  // A glide frame's points move with u, so its stand-in is a linking SphereMesh of a plane at an end of the glide with
  // its source points mapped by the frame's map on the CPU, each once (the colour-plane points carriedW gives the mesh do
  // not depend on u): carriedPos puts them beside the mesh (GLR.setPrePos), once per frame map. A triangle the map
  // stretches past lim (the carried meshes' st.lim: a point the map sends far) is left out, as drawRegion leaves it out.
  // While the frame moves (moving), a mesh whose positions took over CARRIED_POS_MS to map keeps the ones it has (held
  // still until the frame rests). e.posMs: the time its last positions took; carriedPosLast: {n points, ms} of the last
  // positions mapped (the test hook's)
  const CARRIED_POS_MS = 12;
  let carriedPosLast = null;
  // the map F's value at z on the CPU, or NaN where F throws or gives no value (a corner the frame leaves out)
  function cpuAt(F, z) {
    try { return F(z) || C(NaN, NaN); } catch (err) { return C(NaN, NaN); }
  }
  function carriedPos(e, map, preZ, lim, moving) {
    const key = `${mapKeyOf(map)}|${preZ ? 1 : 0}|${lim}`;
    if (!e.res) return false;
    if (e.res.posKey === key || (moving && e.res.posKey && e.posMs > CARRIED_POS_MS)) return true;
    const D = e.data, n3 = 3 * D.n, F = cpuMap(map), pos = new Float32Array(2 * n3), seen = new Map(), o = e.res.org, t0 = performance.now();
    for (let k = 0; k < n3; k++) {
      const q = preCorner(D, k, preZ);
      let w = seen.get(q.id);
      if (!w) { w = cpuAt(F, q.z()); seen.set(q.id, w); }
      pos[2 * k] = w.re - o[0]; pos[2 * k + 1] = w.im - o[1];
      if (q.c !== 2) continue;
      const i = 2 * (k - 2), x0 = pos[i], y0 = pos[i + 1], x1 = pos[i + 2], y1 = pos[i + 3], x2 = pos[i + 4], y2 = pos[i + 5];
      const far = Math.max(Math.hypot(x1 - x0, y1 - y0), Math.hypot(x2 - x1, y2 - y1), Math.hypot(x0 - x2, y0 - y2));
      if (!(far <= lim)) pos.fill(NaN, i, i + 6);
    }
    e.posMs = performance.now() - t0;
    carriedPosLast = { n: seen.size, ms: +e.posMs.toFixed(1) };
    return GLR.setPrePos(e.res, pos, key);
  }
  // job j's G at source point z, an evaluation: [ln |G| * PRE_ARG, arg G * PRE_ARG, G's real and imaginary parts]; on a
  // pole, ln |G| at PRE_LN, arg 0 and the parts infinite
  function carriedG(j, z) {
    const w = cpuAt(j.F, z);
    j.n++;
    const r = Math.hypot(w.re, w.im);
    return Number.isNaN(r) ? [NaN, NaN, NaN, NaN] : !Number.isFinite(r) ? [GLR.PRE_LN * PRE_ARG, 0, Infinity, Infinity] : [Math.log(Math.max(r, 1e-300)) * PRE_ARG, Math.atan2(w.im, w.re) * PRE_ARG, w.re, w.im];
  }
  // one slice of job j, begun at t0: the mesh's corners in order, each new source point's G evaluated once (corners share
  // points), as (ln |G|, arg G) * PRE_ARG with arg continuous across each triangle, and at a triangle's last corner the
  // form it takes (carriedForm); -> why the job stops, or null to go on
  function carriedSlice(j, t0) {
    const D = j.e.data, n3 = 3 * D.n, turn = 2 * Math.PI * PRE_ARG;
    let te = t0;
    while (j.k < n3) {
      const k = j.k++, q = preCorner(D, k, j.preZ), c = q.c, t = q.t, zP = q.zP;
      let g = j.seen.get(q.id), due;
      if (!g) {
        g = carriedG(j, q.z());
        j.seen.set(q.id, g);
        const tn = performance.now();
        // (the work left at the rate of new points per corner so far, highest at the mesh's start, where a triangle brings
        // up to 3 new points against about 1 in 6 corners over a whole mesh: a mesh near the budget may rest first)
        due = standInDue(j, t0, tn - te, tn, (n3 - j.k) * j.n / j.k, Math.max(STANDIN_BUDGET, CARRIED_SHARE * (tn - j.t0)));
        te = tn;
        if (due === 'budget' && (j.need <= CARRIED_MAX || 8 * j.k < n3)) { j.rest = Math.min(CARRIED_REST[1], Math.max(CARRIED_REST[0], j.need / CARRIED_SHARE - (tn - j.t0))); due = 'rest'; }
      }
      const a0 = c ? j.w[3 * (k - c) + 1] : g[1];
      j.w[3 * k] = g[0]; j.w[3 * k + 1] = g[1] + turn * Math.round((a0 - g[1]) / turn); j.w[3 * k + 2] = 0;
      j.tri[c] = g;
      if (c === 2) carriedForm(j, t, zP);
      if (due !== undefined) return due;
    }
    j.e.carryW.w = j.w;
    if (j.e.res) GLR.setPreW(j.e.res, j.w, j.key);
    j.seen = null;
    requestRender('L');
    return 'done';
  }
  // the form triangle t of job j's mesh takes (setPreW's third float), its corners' G in j.tri (carriedG's) and their
  // polar form in j.w: 0, the polar form, unless polar coordinates fail to stand for G across it (SphereMesh.polarMiss:
  // about a zero or a pole of G); then whichever of the polar form, 1 (G itself) and 2 (1/G) lands nearest, on the
  // Riemann sphere, to G at the source point its centroid shows (an evaluation more: the mesh's P interpolated, zP its
  // source points themselves, as the linked program reads them); a corner on a pole of G, 2. Its corners are rewritten
  // in the form it takes
  function carriedForm(j, t, zP) {
    const g = j.tri, w = j.w, o = 9 * t;
    if (g.some((q) => Number.isNaN(q[2]))) return;
    let form = 2;
    if (g.every((q) => Number.isFinite(q[2]))) {
      const lr = (w[o] + w[o + 3] + w[o + 6]) / 3, ar = (w[o + 1] + w[o + 4] + w[o + 7]) / 3;
      if (!SphereMesh.polarMiss(g[0][2], g[0][3], g[1][2], g[1][3], g[2][2], g[2][3], lr, ar)) return;
      const A = j.e.data.attr, mx = (A[t * 12 + 2] + A[t * 12 + 6] + A[t * 12 + 10]) / 3, my = (A[t * 12 + 3] + A[t * 12 + 7] + A[t * 12 + 11]) / 3;
      const gc = carriedG(j, zP ? C(mx, my) : preSrcOf(mx, my));
      if (Number.isNaN(gc[2])) return;
      const L = SphereMesh.lift, at = L(gc[2], gc[3], [0, 0, 0]), q = [0, 0, 0];
      const far = (x, y) => { L(x, y, q); return Math.hypot(q[0] - at[0], q[1] - at[1], q[2] - at[2]); };
      const pc = preSrcOf(lr, ar), dPolar = far(pc.re, pc.im), dG = far((g[0][2] + g[1][2] + g[2][2]) / 3, (g[0][3] + g[1][3] + g[2][3]) / 3);
      let dInv = Infinity;
      if (g.every((p) => p[2] !== 0 || p[3] !== 0)) {
        const u = g.map((p) => CX.inv(C(p[2], p[3]))), v = CX.inv(C((u[0].re + u[1].re + u[2].re) / 3, (u[0].im + u[1].im + u[2].im) / 3));
        dInv = far(v.re, v.im);
      }
      form = dG <= dInv ? (dG < dPolar ? 1 : 0) : (dInv < dPolar ? 2 : 0);
    }
    // (a triangle from a zero of G to a pole keeps its polar form)
    if (!form || (form === 2 && g.some((p) => p[2] === 0 && p[3] === 0))) return;
    for (let c = 0; c < 3; c++) {
      const p = g[c], r = form === 1 ? C(p[2], p[3]) : Number.isFinite(p[2]) ? CX.inv(C(p[2], p[3])) : C(0, 0);
      w[o + 3 * c] = r.re; w[o + 3 * c + 1] = r.im; w[o + 3 * c + 2] = form;
    }
  }
