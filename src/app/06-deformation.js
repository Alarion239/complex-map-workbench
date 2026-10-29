  // ---------------- the deformation as one picture (notes/ui-design/morph-figure.md 3-6) ----------------
  // One plane holds X (neutral grey), its image (the carried pattern) and the paths t -> H_t(z) of sample points: evenly
  // spaced, from X's boundary first, with equal-time marks (PATHS, pathsGen; notes/paths-aesthetics/AS-BUILT.md).
  // The figure is printed in the light theme whatever the screen's theme: fixed inks (the light theme's ink-2 and ink).
  const MF = { srcFillA: 0.07, srcEdgeW: 0.6, dash: '3.2 2.2', outlineInk: '#3E4C56' };
  const morphHasDeriv = () => morphRange().steps.some((k) => isDeriv(k));
  const mDist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const segD = (p, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
    const t = L2 > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)) : 0;
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  };
  const orient3 = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const segX = (a, b, c, d) => { const d1 = orient3(c, d, a), d2 = orient3(c, d, b), d3 = orient3(a, b, c), d4 = orient3(a, b, d); return d1 * d2 < 0 && d3 * d4 < 0; };
  // Liang-Barsky: does segment ab meet rectangle R?
  function segInRect(a, b, R) {
    let t0 = 0, t1 = 1; const dx = b[0] - a[0], dy = b[1] - a[1];
    const p = [-dx, dx, -dy, dy], q = [a[0] - R.x0, R.x1 - a[0], a[1] - R.y0, R.y1 - a[1]];
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) { if (q[i] < 0) return false; continue; }
      const r = q[i] / p[i];
      if (p[i] < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
    }
    return true;
  }
  // a uniform grid of segments (px) for distance, crossing and rectangle queries; tag: the path the segment belongs to
  // B (optional): px bounds that hold every segment; the cells are then a flat array (no hashing: the selection's
  // distance queries were most of its time), with a Map for anything outside
  function SegGrid(cell = 8, B = null) {
    const m = new Map();
    const key = (i, j) => i * 73856093 ^ j * 19349663;
    let arr = null, gx0 = 0, gy0 = 0, nx = 0, ny = 0;
    if (B) { gx0 = Math.floor(B.x0 / cell); gy0 = Math.floor(B.y0 / cell); nx = Math.floor(B.x1 / cell) - gx0 + 1; ny = Math.floor(B.y1 / cell) - gy0 + 1; if (nx > 0 && ny > 0 && nx * ny <= 1 << 20) arr = new Array(nx * ny); }
    const get = (i, j) => { if (arr) { const a = i - gx0, b = j - gy0; if (a >= 0 && a < nx && b >= 0 && b < ny) return arr[a * ny + b]; } return m.size ? m.get(key(i, j)) : undefined; };
    const put = (i, j, sgm) => {
      let l;
      if (arr) { const a = i - gx0, b = j - gy0; if (a >= 0 && a < nx && b >= 0 && b < ny) { l = arr[a * ny + b]; if (!l) arr[a * ny + b] = l = []; l.push(sgm); return; } }
      const k = key(i, j); l = m.get(k); if (!l) m.set(k, l = []); l.push(sgm);
    };
    // the cell range to visit: clipped to the array when nothing lies outside it
    const rng = (i0, i1, j0, j1) => (arr && !m.size ? [Math.max(i0, gx0), Math.min(i1, gx0 + nx - 1), Math.max(j0, gy0), Math.min(j1, gy0 + ny - 1)] : [i0, i1, j0, j1]);
    const add = (a, b, tag) => {
      const i0 = Math.floor(Math.min(a[0], b[0]) / cell), i1 = Math.floor(Math.max(a[0], b[0]) / cell);
      const j0 = Math.floor(Math.min(a[1], b[1]) / cell), j1 = Math.floor(Math.max(a[1], b[1]) / cell);
      if ((i1 - i0 + 1) * (j1 - j0 + 1) > 4096) return;
      const sgm = [a, b, tag];
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) put(i, j, sgm);
    };
    return {
      add,
      addLine(l, tag) { for (let i = 1; i < l.length; i++) add(l[i - 1], l[i], tag); if (l.length === 1) add(l[0], l[0], tag); },
      // the distance from p to the nearest segment within r (Infinity beyond r); skip(tag) leaves a path out
      near(p, r, skip) {
        let d = Infinity;
        const [i0, i1, j0, j1] = rng(Math.floor((p[0] - r) / cell), Math.floor((p[0] + r) / cell), Math.floor((p[1] - r) / cell), Math.floor((p[1] + r) / cell));
        for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const l = get(i, j); if (l) for (const s of l) if (!skip || s[2] !== skip) { const q = segD(p, s[0], s[1]); if (q < d) d = q; } }
        return d <= r ? d : Infinity;
      },
      // the tags of the segments segment ab crosses
      crossTags(a, b, out) {
        const [i0, i1, j0, j1] = rng(Math.floor(Math.min(a[0], b[0]) / cell), Math.floor(Math.max(a[0], b[0]) / cell), Math.floor(Math.min(a[1], b[1]) / cell), Math.floor(Math.max(a[1], b[1]) / cell));
        for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const l = get(i, j); if (l) for (const s of l) if (segX(a, b, s[0], s[1])) out.add(s[2]); }
      },
      hitsRect(R) {
        const [i0, i1, j0, j1] = rng(Math.floor(R.x0 / cell), Math.floor(R.x1 / cell), Math.floor(R.y0 / cell), Math.floor(R.y1 / cell));
        for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const l = get(i, j); if (l) for (const s of l) if (segInRect(s[0], s[1], R)) return true; }
        return false;
      },
    };
  }
  const resamplePx = (l, step = 1.5) => {
    const out = [l[0]];
    for (let i = 1; i < l.length; i++) { const a = l[i - 1], b = l[i], n = Math.ceil(mDist(a, b) / step); for (let k = 1; k <= n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); }
    return out;
  };
  const lenPx = (l) => { let s = 0; for (let i = 1; i < l.length; i++) s += mDist(l[i], l[i - 1]); return s; };
  // X: the visible area shapes (and curve shapes) of the z-plane; inside(z): z lies in one of the areas
  function morphX() {
    const vis = S.shapes.filter((s) => s.visible !== false);
    const areas = vis.filter((s) => kindType(s) === 'area');
    const levels = areas.map((s) => { try { return Region.levelOf(s); } catch (e) { return null; } }).filter(Boolean);
    const inside = (z) => levels.some((L) => { try { return L(z) > 0; } catch (e) { return false; } });
    let bounded = true;
    for (const s of areas) { try { if (!Region.bboxOf(s)) bounded = false; } catch (e) { bounded = false; } }
    const open = areas.some((s) => Region.isOpen(s));
    return { vis, areas, inside, bounded, open };
  }
  // X's boundary (and curve shapes) inside win, as world polylines [[re, im], ...]
  function morphOutline(X, win) {
    const out = [];
    for (const s of X.vis) {
      if (kindType(s) === 'point') continue;
      let cs = [];
      try { cs = Region.curvesOf(s, win); } catch (e) { cs = []; }
      for (const c of cs) {
        const p = Region.sampleCurve(c, win);
        const l = [];
        for (let i = 0; i + 1 < p.length; i += 2) l.push([p[i], p[i + 1]]);
        if (c.closed && l.length) l.push(l[0]);
        if (l.length > 1) out.push({ l, c, s });
      }
    }
    return out;
  }
  // run a generator to its end in slices of about `slice` ms between which the event loop runs (frames, input);
  // alive() false stops it (null)
  // (a macrotask through a MessageChannel: unlike setTimeout(0) it is not clamped to 4 ms when nested)
  const mfChan = new MessageChannel(), mfQ = [];
  mfChan.port1.onmessage = () => { const f = mfQ.shift(); if (f) f(); };
  const nextMacrotask = () => new Promise((res) => { mfQ.push(res); mfChan.port2.postMessage(0); });
  async function runGenSliced(g, alive = () => true, slice = 5) {
    let t0 = performance.now();
    for (;;) {
      const r = g.next();
      if (r.done) return r.value;
      if (performance.now() - t0 > slice) {
        await nextMacrotask();
        if (!alive()) return null;
        t0 = performance.now();
      }
    }
  }
  // the screen's selection. Choosing is never done inside a frame: a frame draws the last finished selection (its
  // paths re-traced under the current chain and shapes when those changed, re-projected when the view changed) and asks
  // for a new one, which runs in slices off the frame once the chain, the shapes and the view have been still for
  // 150 ms (a scrub, a shape drag, a pan or a zoom never re-choose per frame) and requests a render when it is done.
  // The first selection after opening starts at once.
  const mfCache = { key: '', vkey: '', v0: null, sel: null, rkey: '', rsel: null, job: null, want: '', timer: 0, prev: null };
  // The kept start points are points of the plane, not of the screen (merged-views review: a 60 px pan swapped the
  // whole set once the job ran, and during play the paths popped between sets): a selection stays while the view is
  // within a pan of 30 % of the panel and a zoom of 1.5x of the view it was chosen in, at the same panel size; the
  // frame re-projects its paths. A larger pan or zoom chooses again.
  function mfViewOk(pane) {
    const a = mfCache.v0, v = pane.view;
    if (!a || a.w !== pane.w || a.h !== pane.h || !(v.s > 0)) return false;
    const r = v.s / a.s;
    if (!(r < 1.5 && r > 1 / 1.5 && Math.abs(v.cx - a.cx) * v.s <= 0.3 * pane.w && Math.abs(v.cy - a.cy) * v.s <= 0.3 * pane.h)) return false;
    // (a scrub's auto-fit or a pan that leaves more than one kept start out of view chooses again, cross-faded; one such
    // path is drawn clipped meanwhile, with the chevron where it comes in, drawMorphPaths)
    let off = 0;
    if (mfCache.sel && !pane.globeSel) for (const k of mfCache.sel.kept) { const p = pane.w2s(k.sp.z); if (!(p[0] >= 0 && p[1] >= 0 && p[0] <= pane.w && p[1] <= pane.h) && ++off > 1) return false; }
    return true;
  }
  function mfScreenKey(pane) {
    const m = morphLen();
    const key = JSON.stringify([chainSig[nSteps()], S.focus, !!S.homAll, m, S.shapes.filter((s) => s.visible !== false), pane.globeSel ? `globe${mfGlobe.epoch}` : '']) + rangeKey();
    const v = pane.view, vkey = [v.cx, v.cy, v.s, pane.w, pane.h].join('|');
    return { key, vkey, m };
  }
  // no-go rectangles on the right plane (px of its overlay): the transport bar and the Pattern legend
  function mfNogo(pane) {
    const out = [];
    try {
      const r = pane.ocanvas.getBoundingClientRect();
      for (const id of ['rightFoot', 'rightLegend']) {
        const el = $(id);
        if (!el || el.hidden || el.offsetParent === null) continue;
        const q = el.getBoundingClientRect();
        // ([v16.5 fix regress-8] only where it lies over the plane: since UX20 a desktop's legend and options sit in the
        // pane head, above the overlay, and a rectangle outside it rules out nothing)
        const b = { x0: q.left - r.left - 4, x1: q.right - r.left + 4, y0: q.top - r.top - 4, y1: q.bottom - r.top + 4 };
        if (q.width > 0 && q.height > 0 && b.x1 > 0 && b.y1 > 0 && b.x0 < r.width && b.y0 < r.height) out.push(b);
      }
    } catch (e) { /* no layout: no rectangles */ }
    return out;
  }
  function mfStartJob(pane, key, vkey, m) {
    const want = key + '\n' + vkey;
    if (mfCache.job && mfCache.job.want === want) return;
    const job = { want, alive: true };
    if (mfCache.job) mfCache.job.alive = false;
    mfCache.job = job;
    const v = Object.assign({}, pane.view), W = pane.w, Hh = pane.h;
    // (the globe: chosen on the sphere as the camera shows it when the job starts, spaced in its px; a point turned
    // more than 70 degrees from the camera counts as not shown, so the limb's foreshortened scratches are never chosen)
    const cam = pane.globeSel && mfGlobe.cam ? { MVP: mfGlobe.cam.MVP.slice(), eye: mfGlobe.cam.eye.slice() } : null;
    const P = cam ? globeSelP(cam, W, Hh, PATHS.globeFace) : (w) => [W / 2 + (w.re - v.cx) * v.s, Hh / 2 - (w.im - v.cy) * v.s];
    const win = pane.box();
    const alive = () => job.alive && morph.open;
    // (nothing of it runs in the frame that asked: the first slice, the layout read of the no-go boxes included, is a
    // task of its own)
    const globe = !!pane.globeSel;
    job.run = nextMacrotask().then(() => (alive() ? runGenSliced(pathsGen(P, { x: 0, y: 0, w: W, h: Hh }, win, m, globe ? { globe, maxN: PATHS.globeMax } : { footPx: 8, nogo: mfNogo(pane) }), alive) : null)).then((sel) => {
      if (mfCache.job === job) mfCache.job = null;
      if (!sel || !job.alive) return;
      if (cam) sel.cam = cam;
      // (a new set for a moved view, the same chain and shapes (the globe's orbit epoch aside): cross-faded in)
      const base = (q) => q.replace(/"globe\d+"\]$/, '"globe"]');
      mfCache.prev = mfCache.sel && mfCache.key && base(mfCache.key) === base(key) && !!mfCache.sel.globe === globe ? { sel: mfCache.sel, next: sel, t0: performance.now() } : null;
      mfCache.key = key; mfCache.vkey = vkey; mfCache.v0 = { cx: v.cx, cy: v.cy, s: v.s, w: W, h: Hh }; mfCache.sel = sel; mfCache.rkey = ''; mfCache.rsel = null;
      requestRender('R');
    }).catch((e) => { if (mfCache.job === job) mfCache.job = null; console.error('deformation paths', e); });
  }
  function morphSelScreen(pane) {
    const { key, vkey, m } = mfScreenKey(pane);
    if (mfCache.sel && mfCache.key === key && (mfCache.vkey === vkey || mfViewOk(pane))) {
      // (a pending re-choice for a view that has come back within reach is dropped)
      if (mfCache.timer) { clearTimeout(mfCache.timer); mfCache.timer = 0; mfCache.want = ''; }
      if (mfCache.job) { mfCache.job.alive = false; mfCache.job = null; }
      return mfCache.sel;
    }
    const want = key + '\n' + vkey;
    if (!(mfCache.job && mfCache.job.want === want)) {
      if (mfCache.job) { mfCache.job.alive = false; mfCache.job = null; }
      // (review v16 regress-5: a bracket drag's snaps never start a selection; the release does, setHomRange's force)
      if (brDragging()) { clearTimeout(mfCache.timer); mfCache.timer = 0; mfCache.want = ''; }
      else if (!mfCache.sel && !tweens.length && !drag) { clearTimeout(mfCache.timer); mfCache.timer = 0; mfCache.want = ''; mfStartJob(pane, key, vkey, m); }
      // the 150 ms of stillness count from the last change of what is wanted, not from the last frame: a frame that
      // wants the same (a settle redraw after a scrub or a pan) must not restart the wait (it did: a scrub's settle
      // frames at +90 / +145 ms pushed the paths job, and the scene's settle, from ~150 to ~300 ms)
      else if (!(mfCache.timer && mfCache.want === want)) {
        clearTimeout(mfCache.timer);
        mfCache.want = want;
        mfCache.timer = setTimeout(() => { mfCache.timer = 0; mfCache.want = ''; const k2 = mfScreenKey(pane); if (!brDragging() && k2.key === key && k2.vkey === vkey && morphOn() && !(mfCache.sel && mfCache.key === key && mfViewOk(pane))) mfStartJob(pane, key, vkey, m); }, 150);
      }
    }
    if (!mfCache.sel) return null;
    if (mfCache.key === key) return mfCache.sel;
    // the chain or the shapes changed: the kept start points, re-traced under the current homotopy (cheap)
    if (mfCache.rkey !== key) {
      const Fc = new Map();
      const Fat = (T) => { let f = Fc.get(T); if (!f) { f = morphAt(T); Fc.set(T, f); } return f; };
      const P = (w) => pane.w2s(w);
      const N = Math.max(24, 24 * Math.ceil(m));
      const kept = [];
      for (const k of mfCache.sel.kept) { const r = pathRetrace(k, Fat, m, P, N); if (r) kept.push(r); }
      mfCache.rkey = key; mfCache.rsel = Object.assign({}, mfCache.sel, { kept, Tend: m });
    }
    return mfCache.rsel;
  }
  // The merged globe's live paths (merged-views review: the design's "one plane (or one globe)" both carry them): the
  // same selection, chosen off the frame in the deformation's own flat frame at the globe pane's size (defFitView,
  // fixed per chain, focus, path, shapes and pane size, so orbiting never re-chooses), drawn lifted to the sphere
  // The globe's paths are chosen on the sphere under the camera of the moment (globeSelP); an orbit that turns more than
  // one kept start (or a quarter of them) away from the camera chooses again (epoch), after the same 150 ms of stillness.
  const mfGlobe = { key: '', vp: null, cam: null, epoch: 0 };
  function morphSelGlobe(pane, cam) {
    if (cam) mfGlobe.cam = cam;
    const k = mfScreenKey(pane).key + `|${pane.w}x${pane.h}`;
    if (mfGlobe.key !== k || !mfGlobe.vp) {
      const vp = Object.create(Pane.prototype);
      vp.view = { cx: V.right.cx, cy: V.right.cy, s: V.right.s }; vp.w = pane.w; vp.h = pane.h; vp.dpr = pane.dpr; vp.ocanvas = null; vp.globeSel = true;
      vp.view = defFitView(vp, false);
      mfGlobe.key = k; mfGlobe.vp = vp;
    }
    const sel = morphSelScreen(mfGlobe.vp);
    if (sel && cam && mfCache.key === mfScreenKey(mfGlobe.vp).key) {
      const P = globeSelP(cam, pane.w, pane.h, 0.2);
      const off = sel.kept.filter((q) => !P(q.sp.z)).length;
      if (off > Math.max(1, 0.25 * sel.kept.length)) mfGlobe.epoch++;
    }
    return sel;
  }
  // the globe's projection for the choice: a point of the plane lifted to the sphere, in px of a w x h pane under the
  // camera cam {MVP, eye}; null where the sphere's normal there is more than acos(face) from the camera
  function globeSelP(cam, w, h, face) {
    const pane = { w, h };
    return (z) => {
      if (!z || !CX.isFin(z)) return null;
      const p = liftC(z.re, z.im), tv = [cam.eye[0] - p[0], cam.eye[1] - p[1], cam.eye[2] - p[2]], l = Math.hypot(...tv) || 1;
      if ((tv[0] * p[0] + tv[1] * p[1] + tv[2] * p[2]) / l <= face) return null;
      return project(pane, cam.MVP, p.map((x) => x * 1.01));
    };
  }
  // the screen's selection, finished now (a test hook): waits for (or starts) the job
  async function morphSelScreenNow(pane, force) {
    if (force) { mfCache.sel = null; mfCache.key = ''; if (mfCache.job) { mfCache.job.alive = false; mfCache.job = null; } }
    const { key, vkey, m } = mfScreenKey(pane);
    if (mfCache.sel && mfCache.key === key && (mfCache.vkey === vkey || mfViewOk(pane))) return mfCache.sel;
    clearTimeout(mfCache.timer); mfCache.timer = 0; mfCache.want = '';
    mfStartJob(pane, key, vkey, m);
    await mfCache.job.run;
    return mfCache.sel;
  }
  // ---------------- the deformation's paths t -> H_t(z) (notes/paths-aesthetics/AS-BUILT.md) ----------------
  // Evenly spaced paths (Jobard-Lefer streamline placement), seeded from X's boundary first and then inside X, with
  // equal-time marks: an open ring at z, small dots at t = m/4 and 3m/4, one arrowhead at t = m/2 and a filled dot at
  // H_t(z) (F(z) at the end). On screen only the travelled part 0 -> t is drawn, so a frame while playing looks like a
  // frame at rest. Spacings in the drawing's px (CSS px on screen; figure px, 1/96 in, x figK in the figure; x 1.4 for
  // the globe): seeds every sep px inside X and sep/3 along its boundary; a kept path keeps dTest px from every kept
  // path away from its own two ends and crosses none (when that leaves fewer than minN, a second pass allows one
  // crossing and 0.7 dTest); starts dS apart, ends dE apart; at most one path far longer than the way from z to F(z)
  // (a loop); at most maxN, and one per area^2 px^2 of the panel.
  // (review fixes, notes/paths-aesthetics/AS-BUILT.md "Review fixes"): shortK caps the count by the panel's short side
  // (a phone gets about 9); ink caps the summed length of the kept paths at ink x sqrt(panel area); a path longer than
  // longK dS keeps 2 dTest from the kept paths over all but longShare of its length; stubs under stubK dS are a last
  // resort (at most one); arrowheads live only on paths of arrowMin px or more
  // (verify fixes, AS-BUILT.md "Verify fixes"): the long-path spacing is measured at longD dTest and a path at the
  // limit is dropped; a corner where steps meet over vee degrees is rejected; a ring or an end dot keeps dE/2 from the
  // path's own line too; a pane under small px on its short side keeps no stub and draws an arrowhead on every kept
  // path; the globe prefers points inside X and keeps no path along X's outline; fade: ms of a cross-fade between sets
  const PATHS = { sep: 24, dTest: 14, dS: 34, dE: 26, maxN: 18, minN: 8, area: 110, edgeShare: 0.55, figK: 0.7, figMax: 12, globeMax: 9, globeK: 1.4, shortK: 0.7, ink: 2.5, longK: 3, longShare: 0.2, longD: 2.2, stubK: 1.2, arrowMin: 60, globeFace: 0.35, sharp: 0.75, vee: 120, small: 500, fade: 150 };
  // the last frame's moving points on the merged plane, [x, y, z.re, z.im] (a test hook compares them with H_T(z))
  let mfDrawn = null;
  // what the deformation's paths (src/morphpaths.js) need from the app: its functions and constants, and the state
  // they reassign as getters (and setters for the state they write)
  function morphPathsApi() {
    return {
      C, IDENT, MF, PATHS, SegGrid, V, activeSteps, allAtOnce, arcOf, cap1, capT, captionLatex, cmFormAnchor,
      compositeTexShort, dcGridStep, drawChevrons, drawCutBanks, drawCuts, drawFov, drawPoints, drawPullback,
      drawRulers, drawScene, fillTargets2D, fitTitle, focusF, hasTargets, homRangeOk, isDeriv, joinList, kindType,
      lFlat, layoutFoot, lenPx, mDist, mapKeyOf, mfCache, morph, morphHasDeriv, morphLen, morphOn, morphOutline,
      morphPrimes, morphRange, morphSelScreen, morphState, morphX, nSteps, noGL, openPalette, paintFader, paper,
      patternSegs, preimageTargets, stagePullbacks, updatePre, drawPre, rGlobe, rImage, rangeParts, renderSphere, requestInverseFor, requestRender,
      resamplePx, rightStage, segD, shapeGPU, shapeInk, shapePhrase, sheetsShown, stageF, stageMap, strokeTargets,
      sub, syncPlaying, trans, transState, tweens, updateCalcChip,
      get S() { return S; },
      get TH() { return TH; },
      get artMode() { return artMode; },
      get built() { return built; },
      get chainSig() { return chainSig; },
      get clipWin() { return clipWin; },
      get drag() { return drag; },
      get figMode() { return figMode; },
      get figVec() { return figVec; },
      get mfDrawn() { return mfDrawn; }, set mfDrawn(v) { mfDrawn = v; },
      get motionInT() { return motionInT; },
      get paneR() { return paneR; },
    };
  }
  // the app calls the module by the old names (as untyped calls: their types stay the module's own)
  const MP = /** @type {any} */ (MorphPaths);
  function pathMarkTimes(...args) { return MP.pathMarkTimes(...args); }
  function pathsGen(...args) { return MP.pathsGen(...args); }
  function retraceShare(...args) { return MP.retraceShare(...args); }
  function pathRetrace(...args) { return MP.pathRetrace(...args); }
  function drawMorphPathsX(...args) { return MP.drawMorphPathsX(...args); }
  function pathsSvg(...args) { return MP.pathsSvg(...args); }
  function morphFigureLayers(...args) { return MP.morphFigureLayers(...args); }
  function texSegs(...args) { return MP.texSegs(...args); }
  function inlineFrac(...args) { return MP.inlineFrac(...args); }
  function rangeTex(...args) { return MP.rangeTex(...args); }
  function wDefSegs(...args) { return MP.wDefSegs(...args); }
  function morphHomSegs(...args) { return MP.morphHomSegs(...args); }
  function pathTimesTex(...args) { return MP.pathTimesTex(...args); }
  function pathMarksTex(...args) { return MP.pathMarksTex(...args); }
  function morphCaption(...args) { return MP.morphCaption(...args); }
  function morphAt(...args) { return MP.morphAt(...args); }
  function syncTransport(...args) { return MP.syncTransport(...args); }
  function morphReadout(...args) { return MP.morphReadout(...args); }
  function setText(...args) { return MP.setText(...args); }
  function watchFader(...args) { return MP.watchFader(...args); }
  function wKeyAvail(...args) { return MP.wKeyAvail(...args); }
  function wKeyOn(...args) { return MP.wKeyOn(...args); }
  function renderRight(...args) { return MP.renderRight(...args); }

