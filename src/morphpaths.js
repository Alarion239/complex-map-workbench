'use strict';
// The deformation's paths t -> H_t(z) (notes/paths-aesthetics/AS-BUILT.md; issue #20, phase 3: moved out of app.js):
// evenly spaced paths seeded from X's boundary, traced and drawn on the planes and the globes, with their arrows,
// marks and the transport's fader. The app hands it what it needs once, MorphPaths.init(api) at start-up
// (src/app/06-deformation.js, morphPathsApi): its functions and constants as they are, and the state it reassigns
// (S, morph's companions, ...) as getters on api, read as A.S and so on.
const MorphPaths = (() => {
  let A = null;
  let C, IDENT, MF, PATHS, SegGrid, V, activeSteps, allAtOnce, arcOf, cap1, capT, captionLatex, cmFormAnchor,
    compositeTexShort, dcGridStep, drawChevrons, drawCutBanks, drawCuts, drawFov, drawPoints, drawPullback,
    drawRulers, drawScene, fillTargets2D, fitTitle, focusF, hasTargets, homRangeOk, isDeriv, joinList, kindType,
    lFlat, layoutFoot, lenPx, mDist, mapKeyOf, mfCache, morph, morphHasDeriv, morphLen, morphOn, morphOutline,
    morphPrimes, morphRange, morphSelScreen, morphState, morphX, nSteps, noGL, openPalette, paintFader, paper,
    patternSegs, preimageTargets, stagePullbacks, updatePre, drawPre, rGlobe, rImage, rangeParts, renderSphere, requestInverseFor, requestRender,
    resamplePx, rightStage, segD, shapeGPU, shapeInk, shapePhrase, sheetsShown, stageF, stageMap, strokeTargets,
    sub, syncPlaying, trans, transState, tweens, updateCalcChip;
  // the times of a path's marks: one step (or all at once) has its arrowhead at m/2 (and, in the figure only, where the
  // caption explains them, dots at m/4 and 3m/4); steps one after another have an arrowhead in the middle of each step
  // (t = k - 1/2: never on the corner where the steps meet) and a bar across the path at each step's end inside the
  // range (t = k), so a corner reads as "the step changes here"
  function pathMarkTimes(Tend) {
    if (allAtOnce() || morphRange().steps.length < 2) return { arrows: [0.5 * Tend], dots: [0.25 * Tend, 0.75 * Tend], nodes: [], seq: false };
    const arrows = [], nodes = [];
    for (let k = 1; k - 0.5 < Tend + 1e-9; k++) arrows.push(k - 0.5);
    for (let k = 1; k < Tend - 1e-9; k++) nodes.push(k);
    if (!arrows.length) arrows.push(0.5 * Tend);
    return { arrows, dots: [], nodes, seq: true };
  }
  // t -> H_t(z), t in [0, Tend], as runs of samples {T, w, p}: N shared uniform times (H_T cached across paths), each
  // gap refined while its chord is over 1.5 px or its midpoint strays over 0.05 px from the chord (screen arclength and
  // turning: no kinks); a new run where H_T is not finite or very far off (a pole, infinity) or jumps (a cut: a chord
  // still over 3 px at depth 14, a time step of Tend / 786432). A jump is never drawn.
  function traceRuns(z, Fat, Tend, P, N) {
    const ev = (T) => { const w = Fat(T)(z); if (!w || !CX.isFin(w)) return null; const p = P(w); return p && Math.abs(p[0]) < 4e4 && Math.abs(p[1]) < 4e4 ? { T, w, p } : null; };
    const runs = [];
    let cur = [];
    const cut = () => { if (cur.length > 1) runs.push(cur); cur = []; };
    const rec = (a, b, d) => {
      const L = mDist(a.p, b.p);
      if (d >= 14) { if (L > 3) cut(); cur.push(b); return; }
      const m = ev(0.5 * (a.T + b.T));
      if (!m) { cut(); cur.push(b); return; }
      const dev = Math.hypot(m.p[0] - 0.5 * (a.p[0] + b.p[0]), m.p[1] - 0.5 * (a.p[1] + b.p[1]));
      if ((L < 1.5 && dev < 0.15) || (dev < 0.05 && d >= 1 && L < 30)) { cur.push(b); return; }
      rec(a, m, d + 1); rec(m, b, d + 1);
    };
    let a = ev(0);
    if (a) cur.push(a);
    for (let i = 1; i <= N; i++) {
      const b = ev(Tend * i / N);
      if (a && b) rec(a, b, 0); else { cut(); if (b) cur.push(b); }
      a = b;
    }
    cut();
    return runs;
  }
  // the marks of a path in the plane (pathMarkTimes): z = H_0(z), e = H_Tend(z) (null where not finite), the
  // arrowheads and the step bars with H_t(z) just before and after their time (a, b: the direction), the dots
  function pathMarksW(z, Fat, Tend) {
    const at = (T) => { const w = Fat(T)(z); return w && CX.isFin(w) ? w : null; };
    const h = Tend / 512, mt = pathMarkTimes(Tend);
    const dirAt = (T) => ({ T, w: at(T), a: at(Math.max(0, T - h)), b: at(Math.min(Tend, T + h)) });
    return { z: at(0), e: at(Tend), arrows: mt.arrows.map(dirAt), nodes: mt.nodes.map(dirAt), dots: mt.dots.map((T) => ({ T, w: at(T) })), seq: mt.seq };
  }
  // the selection (a generator: it yields between candidates, so it runs in slices off the frame;
  // runGenSliced). P maps the plane to px (null where a point is not shown: the globe's far side and limb), box is the
  // panel (px), win its world window. opt: scale (the spacings' factor), footPx, nogo (px rectangles to keep clear),
  // maxN, globe, fig (the exported figure: stricter about the frame and the picture's lines). Every path is traced whole
  // (the same points at every t: no popping while scrubbing or playing). A path may leave the panel (it is clipped
  // there, with a cue) when most of it is inside, but never leaves and comes back.
  function* pathsGen(P, box, win, Tend, opt = {}) {
    const k = (opt.scale || 1) * (opt.globe ? PATHS.globeK : 1);
    const sep = PATHS.sep * k, dT = PATHS.dTest * k, dS = PATHS.dS * k, dE = PATHS.dE * k;
    // (the count: maxN, one per area^2 px^2, and by the panel's short side: a phone's tall pane gets about 9, not 18)
    const sh = Math.min(box.w, box.h) / (PATHS.area * k);
    let cap = Math.max(4, Math.min(opt.maxN || PATHS.maxN, Math.round(box.w * box.h / (PATHS.area * k) ** 2), Math.round(PATHS.shortK * sh * sh)));
    const inkCap = PATHS.ink * Math.sqrt(box.w * box.h);
    // (a small pane, a phone: a stub is never kept and every kept path is long enough for its arrowhead, so each one
    // shows its direction; longer paths are preferred)
    const small = !opt.fig && Math.min(box.w, box.h) < PATHS.small * k;
    const stubPx = PATHS.stubK * dS, arrowPx = small ? stubPx : PATHS.arrowMin;
    const X = morphX(), outline = morphOutline(X, win);
    yield;
    const Fc = new Map();
    const Fat = (T) => { let f = Fc.get(T); if (!f) { f = morphAt(T); Fc.set(T, f); } return f; };
    const m0 = 2 * k, foot = opt.footPx || 0;
    const inner = { x0: box.x + m0, x1: box.x + box.w - m0, y0: box.y + m0, y1: box.y + box.h - foot - m0 };
    const nogo = opt.nogo || [];
    const inNogo = (p) => nogo.some((R) => p[0] >= R.x0 && p[0] <= R.x1 && p[1] >= R.y0 && p[1] <= R.y1);
    const inPanel = (p) => p[0] >= inner.x0 && p[0] <= inner.x1 && p[1] >= inner.y0 && p[1] <= inner.y1 && !inNogo(p);
    // (a start stands dS/2 inside the panel: a ring on the frame with a chevron beside it says nothing)
    const mS = 0.5 * dS;
    const inStart = (p) => p[0] >= inner.x0 + mS && p[0] <= inner.x1 - mS && p[1] >= inner.y0 + mS && p[1] <= inner.y1 - mS && !inNogo(p);
    const toW = (px, py) => C(win.x0 + (px - box.x) / box.w * (win.x1 - win.x0), win.y1 - (py - box.y) / box.h * (win.y1 - win.y0));
    // seeds: the point shapes, X's boundary every sep/3 px (its areas' outline; the curves when there is no area; a
    // formula area's boundary found on a grid, where X's inside test changes), and a square grid of step sep inside X
    const seeds = [];
    for (const s of X.vis) if (kindType(s) === 'point' && s.p) seeds.push({ z: C(s.p[0], s.p[1]), kind: 'point' });
    const eg = sep / 3;
    let nEdge = 0, nNode = 0;
    // (notes/deform-range/SPEC.md 5.2, D6: when H_0 is not the identity, a bracket's pre or post or a focused step
    // k > 1, the seeds are spaced at their starts H_0(z) in the plane, not at z: the boundary mapped through H_0, and a
    // z-grid binned by the screen point of H_0(z). With H_0 = id, today's code below, unchanged)
    const startId = !(A.S.focus > 1 || (A.S.focus === 0 && !!homRangeOk()));
    if (!startId) {
      const H0 = Fat(0);
      for (const o of outline) {
        if (X.areas.length && kindType(o.s) !== 'area') continue;
        let prev = null, rem = 0;
        for (let i = 0; i < o.l.length; i++) {
          const q = o.l[i], z = C(q[0], q[1]), w = H0(z), pp = CX.isFin(w) ? P(w) : null;
          if (!pp) { prev = null; rem = 0; continue; }
          const L = prev ? mDist(prev.p, pp) : 0;
          if (prev && L > 0 && L <= 60 * k) {
            let s2 = rem;
            for (; s2 <= L; s2 += eg) { const u = s2 / L, pq = [prev.p[0] + (pp[0] - prev.p[0]) * u, prev.p[1] + (pp[1] - prev.p[1]) * u]; if (inPanel(pq)) { seeds.push({ z: C(prev.z.re + (z.re - prev.z.re) * u, prev.z.im + (z.im - prev.z.im) * u), kind: 'edge' }); nEdge++; } }
            rem = s2 - L;
          } else rem = 0;
          prev = { p: pp, z };
          if (i % 512 === 511) yield;
        }
      }
      if (X.areas.length) {
        let bx = null;
        for (const sh of X.areas) { let b = null; try { b = Region.bboxOf(sh); } catch (e) { b = null; } if (!b) { bx = null; break; } bx = bx ? { x0: Math.min(bx.x0, b.x0), x1: Math.max(bx.x1, b.x1), y0: Math.min(bx.y0, b.y0), y1: Math.max(bx.y1, b.y1) } : b; }
        const cw = A.clipWin, W0 = bx ? { x0: Math.max(bx.x0, cw.x0), x1: Math.min(bx.x1, cw.x1), y0: Math.max(bx.y0, cw.y0), y1: Math.min(bx.y1, cw.y1) } : cw;
        let cells = null;
        for (const Ng of [96, 192]) {
          if (!(W0.x1 > W0.x0 && W0.y1 > W0.y0)) break;
          cells = new Map();
          let cnt = 0;
          for (let i = 0; i < Ng; i++) for (let j = 0; j < Ng; j++) {
            if (++cnt % 512 === 0) yield;
            const z = C(W0.x0 + (i + 0.5) * (W0.x1 - W0.x0) / Ng, W0.y0 + (j + 0.5) * (W0.y1 - W0.y0) / Ng);
            if (!X.inside(z)) continue;
            const w = H0(z);
            if (!CX.isFin(w)) continue;
            const pq = P(w);
            if (!pq || !inPanel(pq)) continue;
            const ci = Math.floor((pq[0] - inner.x0) / sep), cj = Math.floor((pq[1] - inner.y0) / sep), key2 = ci + ',' + cj;
            const d = mDist(pq, [inner.x0 + (ci + 0.5) * sep, inner.y0 + (cj + 0.5) * sep]), e = cells.get(key2);
            if (!e || d < e.d) cells.set(key2, { z, d });
          }
          // (a start image that the 96 x 96 grid samples thinly, a strong squeeze or stretch by H_0: once more, finer)
          if (cells.size >= 12) break;
        }
        if (cells) for (const e of cells.values()) { seeds.push({ z: e.z, kind: 'node' }); nNode++; }
      }
    } else {
    for (const o of outline) {
      if (X.areas.length && kindType(o.s) !== 'area') continue;
      let rem = 0;
      for (let i = 1; i < o.l.length; i++) {
        const a = o.l[i - 1], b = o.l[i], pa = P(C(a[0], a[1])), pb = P(C(b[0], b[1]));
        if (!pa || !pb) { rem = 0; continue; }
        const L = mDist(pa, pb);
        if (!(L > 0) || L > 2e4) continue;
        let s = rem;
        for (; s <= L; s += eg) { const u = s / L, p = [pa[0] + (pb[0] - pa[0]) * u, pa[1] + (pb[1] - pa[1]) * u]; if (inPanel(p)) { seeds.push({ z: C(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u), kind: 'edge' }); nEdge++; } }
        rem = s - L;
      }
    }
    if (X.areas.length && !nEdge && !opt.globe) {
      const st = 4 * k, ins = (px, py) => X.inside(toW(px, py));
      let n = 0;
      for (let py = inner.y0; py < inner.y1; py += st) for (let px = inner.x0; px < inner.x1; px += st) if (ins(px, py) && (!ins(px + st, py) || !ins(px - st, py) || !ins(px, py + st) || !ins(px, py - st)) && !inNogo([px, py]) && n++ % 2 === 0) seeds.push({ z: toW(px, py), kind: 'edge' });
    }
    if (X.areas.length) for (let py = inner.y0 + 0.75 * sep; py < inner.y1 - 0.5 * sep; py += sep) for (let px = inner.x0 + 0.75 * sep; px < inner.x1 - 0.5 * sep; px += sep) { const z = toW(px, py); if (X.inside(z) && !inNogo([px, py])) { seeds.push({ z, kind: 'node' }); nNode++; } }
    }
    // (a small X in a wide figure frame: its starts would be packed at print size while the paths run out of the frame)
    if (opt.fig && X.areas.length && nNode * sep * sep < 0.05 * box.w * box.h) cap = Math.min(cap, 5);
    // (the figure and the globe: the picture's own lines, X's outline at the start and at the end, which a path must not
    // lie along: on the globe a boundary point's path along X's outline reads as a mark on it)
    let picG = null;
    const picR = opt.globe ? 3 : 2;
    if (opt.fig || opt.globe) {
      picG = SegGrid(4 * k);
      const FE = Fat(Tend);
      for (const o of outline) {
        const l0 = o.l.map((q) => P(C(q[0], q[1]))), l1 = o.l.map((q) => { const w = FE(C(q[0], q[1])); return w && CX.isFin(w) ? P(w) : null; });
        for (const l of [l0, l1]) for (let i = 1; i < l.length; i++) if (l[i - 1] && l[i] && mDist(l[i - 1], l[i]) < 60 * k) picG.add(l[i - 1], l[i], 1);
      }
    }
    yield;
    const mt = pathMarkTimes(Tend);
    const N = Math.max(48, 48 * Math.ceil(Tend));
    // (why candidates were left out, by reason: a test hook's and the notes' view of the choice)
    const rej = {}, no = (w) => { rej[w] = (rej[w] || 0) + 1; };
    const cands = [];
    let n = 0;
    for (const sd of seeds) {
      if (++n % 6 === 0) yield;
      const runs = traceRuns(sd.z, Fat, Tend, P, N);
      if (!runs.length || runs[0][0].T > 0) { no('trace'); continue; }
      const p0 = runs[0][0].p;
      if (!inStart(p0)) { no('start'); continue; }
      // in the panel: the drawn length lin; the length before the path first leaves the panel; how often it comes
      // back in after leaving (an exit and a re-entry reads as an orphan line: never kept); the share of t shown
      let len = 0, lin = 0, pre = 0, out = false, back = 0, tShown = 0;
      for (const r of runs) {
        tShown += r[r.length - 1].T - r[0].T;
        for (let i = 0; i < r.length; i++) {
          const ip = inPanel(r[i].p);
          if (!ip) out = true; else if (out && (i === 0 || !inPanel(r[i - 1].p))) back++;
          if (!i) continue;
          const d = mDist(r[i].p, r[i - 1].p);
          len += Math.min(d, 400);
          if (ip && inPanel(r[i - 1].p)) { lin += d; if (!out) pre += d; }
        }
      }
      // (a stub: under stubK dS of drawn line it is a ring touching a dot, with no direction; a last resort)
      if (lin < 10 * k || back || (small && lin < stubPx)) { no(back ? 'reentry' : 'short'); continue; }
      if (out && pre < 2 * dS) { no('exit'); continue; }
      if (opt.globe && tShown < 0.6 * Tend) { no('hidden'); continue; }
      const lr = runs[runs.length - 1], e = lr[lr.length - 1];
      const pe = e.T >= Tend - 1e-9 && inPanel(e.p) ? e.p : null;
      if (!pe && lin < 0.4 * len) { no('off'); continue; }
      if (opt.fig && lin < 0.7 * len) { no('frame'); continue; }
      // (a path far longer than the way from z to F(z), the Joukowski cusp's loop: honest, but one is enough)
      const loop = !!pe && lin > 2.6 * mDist(p0, pe) + 40 * k;
      const rs = [];
      for (const r of runs) for (const p of resamplePx(r.map((q) => q.p), 3 * k)) if (inPanel(p)) rs.push(p);
      // a path that retraces itself (0 -> 1 -> 0 reads as one segment): over 20 % of it within 2 px of an earlier,
      // non-adjacent part of it; a back-and-forth that ends where it starts with no area inside
      if (retraceShare(rs, 2 * k, 6) > 0.2) { no('retrace'); continue; }
      // (a hairpin: tighter than about 4 px of radius it reads as a kink, not a curve; the corner where steps one after
      // another meet is not counted here, it has its own test below and a bar)
      if (sharpTurn(runs, mt.seq ? mt.nodes : [], 3 * k, inPanel) > PATHS.sharp) { no('sharp'); continue; }
      if (pe && mDist(p0, pe) < 6 * k) {
        let A = 0;
        for (let i = 1; i < rs.length; i++) A += rs[i - 1][0] * rs[i][1] - rs[i][0] * rs[i - 1][1];
        if (Math.abs(A) / 2 < 0.1 * lin * lin / (4 * Math.PI)) { no('fold'); continue; }
      }
      // (the figure: a path along the picture's lines hides them and reads as one of them)
      // (away from its own two ends: a boundary point starts on X's outline and ends on its image by construction)
      if (picG && rs.length) {
        let on = 0, nn = 0;
        for (const p of rs) { if (mDist(p, p0) < 0.75 * sep || (pe && mDist(p, pe) < 0.75 * sep)) continue; nn++; if (picG.near(p, picR) < picR) on++; }
        if (on > 0.3 * nn) { no('picture'); continue; }
      }
      // steps one after another: where they meet (t = k), the moving point at that time (kept dE apart, as the ends),
      // and the turn there: a turn over PATHS.vee (120) degrees, or over 100 with a short leg, is a doubled-back V that
      // reads as two paths flowing into one point (rejected); a milder turn costs a little. On a small pane every step's
      // leg must reach the arrowhead limit (stubPx), as a whole path must: a shorter leg crowds its arrowhead and the bar
      // onto a V (Strip to disk on a phone kept one 44 px path with two arrowheads and a bar)
      const pk = [];
      let turn = 0, vee = false;
      if (mt.seq) {
        const s = runs.flat();
        for (const Tk of mt.nodes) {
          const i = s.findIndex((q) => q.T >= Tk - 1e-9);
          if (i < 0 || Math.abs(s[i].T - Tk) > Tend / N) { pk.push(null); continue; }
          pk.push(inPanel(s[i].p) ? s[i].p : null);
          let a = i, b = i, la = 0, lb = 0, L1 = 0, L2 = 0;
          while (a > 0 && la < 6 * k) { la += mDist(s[a].p, s[a - 1].p); a--; }
          while (b < s.length - 1 && lb < 6 * k) { lb += mDist(s[b].p, s[b + 1].p); b++; }
          for (let j = 1; j < s.length; j++) { const d = Math.min(mDist(s[j].p, s[j - 1].p), 400); if (s[j].T <= Tk + 1e-9 && s[j].T > Tk - 1) L1 += d; else if (s[j].T > Tk && s[j].T <= Tk + 1 + 1e-9) L2 += d; }
          if (small && Math.min(L1, L2) < stubPx) vee = true;
          if (la < 1 || lb < 1) continue;
          const u = [s[i].p[0] - s[a].p[0], s[i].p[1] - s[a].p[1]], v = [s[b].p[0] - s[i].p[0], s[b].p[1] - s[i].p[1]];
          const ang = Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / (Math.hypot(...u) * Math.hypot(...v) || 1))));
          turn = Math.max(turn, ang);
          if (ang > PATHS.vee * DEG || (ang > 100 * DEG && Math.min(L1, L2) < 2 * dS)) vee = true;
        }
      }
      if (vee) { no('vee'); continue; }
      // (the ring and the end dot keep dE/2 from the path's own line beyond its first and before its last dS of
      // arclength: a hook's return leg passing its own ring reads as the ring sitting on the line)
      if (selfNear(runs, p0, pe, 0.5 * dE, dS, 6 * k)) { no('self'); continue; }
      cands.push({ sp: { z: sd.z, kind: sd.kind }, runs, p0, pe, pk, rs, len: lin, loop, turn, stub: lin < stubPx, long: lin > PATHS.longK * dS, dS: Infinity, dE: Infinity, dead: 0, kept: false });
    }
    const grid = SegGrid(6 * k, { x0: box.x - 1, y0: box.y - 1, x1: box.x + box.w + 1, y1: box.y + box.h + 1 });
    const kept = [];
    let nLoop = 0, nStub = 0, ink = 0;
    // (the globe: the share of the seeds whose start, or most of whose path, is on the sphere's far side: the globe's
    // hint when few paths are left)
    const ex = 0.75 * sep, lD = PATHS.longD * dT;
    const exempt = (p, c) => mDist(p, c.p0) < ex || (c.pe && mDist(p, c.pe) < ex);
    const nearLine = (p, c, r) => { for (let i = 1; i < c.rs.length; i++) if (segD(p, c.rs[i - 1], c.rs[i]) < r) return true; return false; };
    // (separation: no point of the path within d of a kept path; crossings: at most nX kept paths crossed; a long path
    // keeps 2 dTest over most of its length: long parallel arcs 15-25 px apart read as a bundle)
    const test = (c, d, nX) => {
      if (c.loop && nLoop) return false;
      if (c.stub && (nStub || !nX)) return false;
      // (the ink cap from the second path on: the first paths are the long ones, and two of them can already fill a pane)
      if (kept.length && ink + c.len > inkCap) return false;
      if (!kept.length) return true;
      // (no end dot on or beside a start ring; an end dot or a ring dE/2 clear of every other path's line)
      if (kept.some((q) => (c.pe && mDist(c.pe, q.p0) < 0.5 * dS) || (q.pe && mDist(q.pe, c.p0) < 0.5 * dS))) return false;
      if ((c.pe && grid.near(c.pe, 0.5 * dE) < 0.5 * dE) || grid.near(c.p0, 0.5 * dE) < 0.5 * dE) return false;
      if (kept.some((q) => nearLine(q.p0, c, 0.5 * dE) || (q.pe && nearLine(q.pe, c, 0.5 * dE)))) return false;
      let nFar = 0, nLong = 0;
      for (const p of c.rs) {
        if (exempt(p, c)) continue;
        if (grid.near(p, d) < d) return false;
        if (c.long) { nFar++; if (grid.near(p, lD) < lD) nLong++; }
      }
      if (c.long && nLong > PATHS.longShare * nFar) return false;
      // (and the same for the kept long paths: c must not bring one of them over longShare)
      const longKept = kept.filter((q) => q.long);
      if (longKept.length) {
        const cg = SegGrid(6 * k);
        for (let i = 1; i < c.rs.length; i++) cg.add(c.rs[i - 1], c.rs[i], 1);
        for (const q of longKept) {
          let add = 0;
          for (let i = 0; i < q.rs.length; i++) if (!q.nearMask[i] && !exempt(q.rs[i], q) && cg.near(q.rs[i], lD) < lD) add++;
          if (q.nNear + add > PATHS.longShare * q.nFar) return false;
        }
      }
      const crossed = new Set();
      for (const r of c.runs) {
        for (let i = 1; i < r.length; i++) {
          const a = r[i - 1].p, b = r[i].p;
          if ((!inPanel(a) && !inPanel(b)) || exempt(a, c)) continue;
          grid.crossTags(a, b, crossed);
          if (crossed.size > nX) return false;
        }
      }
      return true;
    };
    const keepC = (c) => {
      // (a long path's samples within 2 dTest of the other kept paths: those kept before it, then those kept after)
      if (c.long) {
        c.nearMask = new Uint8Array(c.rs.length); c.nNear = 0; c.nFar = 0;
        c.rs.forEach((p, i) => { if (exempt(p, c)) return; c.nFar++; if (grid.near(p, lD) < lD) { c.nearMask[i] = 1; c.nNear++; } });
      }
      const longKept = kept.filter((q) => q.long);
      if (longKept.length) {
        const cg = SegGrid(6 * k);
        for (let i = 1; i < c.rs.length; i++) cg.add(c.rs[i - 1], c.rs[i], 1);
        for (const q of longKept) for (let i = 0; i < q.rs.length; i++) if (!q.nearMask[i] && !exempt(q.rs[i], q) && cg.near(q.rs[i], lD) < lD) { q.nearMask[i] = 1; q.nNear++; }
      }
      kept.push(c); c.kept = true; ink += c.len;
      if (c.loop) nLoop++;
      if (c.stub) nStub++;
      for (const r of c.runs) for (let i = 1; i < r.length; i++) if (inPanel(r[i].p) || inPanel(r[i - 1].p)) grid.add(r[i - 1].p, r[i].p, c);
      for (const q of cands) {
        if (q.kept || q.dead === 1) continue;
        q.dS = Math.min(q.dS, mDist(q.p0, c.p0));
        if (q.pe && c.pe) q.dE = Math.min(q.dE, mDist(q.pe, c.pe));
        // (steps one after another: the moving points stand dE apart at each step's end too)
        for (let j = 0; j < q.pk.length; j++) if (q.pk[j] && c.pk[j]) q.dE = Math.min(q.dE, mDist(q.pk[j], c.pk[j]));
      }
    };
    // (marked points first, held to the same tests: spacing, no stub, no retrace)
    for (const c of cands) if (c.sp.kind === 'point' && kept.length < cap && !c.stub && c.dS >= dS && c.dE >= dE && test(c, dT, 0)) keepC(c);
    // farthest first: the start farthest from the kept starts (and the end from the kept ends); the boundary first (up
    // to edgeShare of the paths), then boundary and inside together (the boundary slightly preferred, longer paths
    // slightly preferred), then, when that leaves fewer than minN, the looser test (one crossing, 0.7 dTest, one stub)
    let it = 0;
    // (the globe: points inside X first, the boundary is not preferred: its paths lie along X's outline at the limb)
    for (const [d, nX, edges, upTo] of /** @type {[number, number, boolean, number][]} */ ([[dT, 0, true, opt.globe ? 0 : Math.ceil(PATHS.edgeShare * cap)], [dT, 0, false, cap], [0.7 * dT, 1, false, cap]])) {
      if (nX && kept.length >= Math.min(PATHS.minN, cap)) break;
      if (nX) for (const c of cands) if (c.dead === 2) c.dead = 0;
      while (kept.length < upTo) {
        let best = null, bs = -Infinity;
        for (const c of cands) {
          if (c.kept || c.dead || (edges && c.sp.kind !== 'edge')) continue;
          if (c.dS < dS || c.dE < dE) { c.dead = 1; continue; }
          const sc = Math.min(c.dS, c.dE * dS / dE, 4 * dS) + (c.sp.kind === 'edge' ? (opt.globe ? -0.35 : 0.35) * dS : 0) + (small ? 0.15 : 0.04) * Math.min(c.len, 200 * k) - (c.loop ? 0.5 * dS : 0) - (c.stub ? dS : 0) - dS * c.turn / Math.PI;
          // (review v16 regress-2: the score in whole micro-px, so candidates that tie but for rounding (1e-14 px, a
          // homotopy's end exact or not, another browser's Math) tie exactly, and the first in the seeds' fixed order
          // wins, as an exact tie always did)
          const scq = Math.round(sc * 1e6) / 1e6;
          if (scq > bs) { bs = scq; best = c; }
        }
        if (!best) break;
        if (test(best, d, nX)) keepC(best); else { best.dead = 2; no('spacing'); }
        if (++it % 3 === 0) yield;
      }
    }
    for (const c of kept) { c.mk = pathMarksW(c.sp.z, Fat, Tend); pathFlat(c); }
    const pxLines = outline.map((o) => o.l.map((q) => P(C(q[0], q[1]))).filter(Boolean));
    return { kept, log: [], budget: cap, X, outline, pxLines, endLines: [], Tend, nCands: cands.length, ms: { nT: Fc.size }, globe: !!opt.globe, ink, rej, arrowMin: arrowPx, away: opt.globe ? ((rej.trace || 0) + (rej.hidden || 0)) / Math.max(1, seeds.length) : 0 };
  }
  // whether a path's start p0 lies within r of its own line beyond its first skip px of arclength, or its end pe within
  // r of its own line before its last skip px (a closed path, pe within shut of p0, is the fold test's: its ends are
  // left alone)
  function selfNear(runs, p0, pe, r, skip, shut) {
    let L = 0;
    for (const q of runs) for (let i = 1; i < q.length; i++) L += Math.min(mDist(q[i].p, q[i - 1].p), 400);
    const closed = !!pe && mDist(p0, pe) < shut;
    let acc = 0;
    for (const q of runs) {
      for (let i = 1; i < q.length; i++) {
        const a = q[i - 1].p, b = q[i].p, a0 = acc;
        acc += Math.min(mDist(a, b), 400);
        if (a0 > skip && (!closed || acc < L - skip) && segD(p0, a, b) < r) return true;
        if (pe && !closed && acc < L - skip && segD(pe, a, b) < r) return true;
      }
    }
    return false;
  }
  // the share of a resampled polyline l (points every ~step px) lying within r of an earlier part of it at least gap
  // samples back (a path that goes back over itself)
  function retraceShare(l, r, gap) {
    if (l.length < gap + 2) return 0;
    const g = SegGrid(Math.max(4, 2 * r));
    let hit = 0;
    for (let i = gap + 1; i < l.length; i++) {
      g.add(l[i - gap - 1], l[i - gap], i);
      if (g.near(l[i], r) < r) hit++;
    }
    return hit / l.length;
  }
  // the sharpest turn (rad) of a path's runs between successive chords of step px of arclength, at vertices where
  // inPanel holds; each run is cut at the times in nodes (the corners where steps one after another meet)
  function sharpTurn(runs, nodes, step, inPanel) {
    let mx = 0;
    const piece = (l) => {
      // (points every step px of arclength along l)
      const u = [l[0]];
      let acc = 0;
      for (let i = 1; i < l.length; i++) {
        let a = l[i - 1];
        const b = l[i];
        let d = mDist(a, b);
        while (acc + d >= step) { const s = (step - acc) / d; a = [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s]; u.push(a); d = mDist(a, b); acc = 0; }
        acc += d;
      }
      for (let i = 2; i < u.length; i++) {
        if (!inPanel(u[i - 1])) continue;
        const ax = u[i - 1][0] - u[i - 2][0], ay = u[i - 1][1] - u[i - 2][1], bx = u[i][0] - u[i - 1][0], by = u[i][1] - u[i - 1][1];
        mx = Math.max(mx, Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by) || 1)))));
      }
    };
    for (const r of runs) {
      let cur = [r[0].p];
      for (let i = 1; i < r.length; i++) {
        cur.push(r[i].p);
        if (nodes.some((t) => Math.abs(r[i].T - t) < 1e-9)) { piece(cur); cur = [r[i].p]; }
      }
      if (cur.length > 1) piece(cur);
    }
    return mx;
  }
  // (a kept path's samples as one list s and its px polyline l: the test hooks' and the caption's view of it)
  const pathFlat = (c) => { c.s = c.runs.flat(); c.l = c.s.map((q) => q.p); c.lenPx = lenPx(c.l); return c; };
  // a kept path re-traced under a changed chain or shapes (the screen cache)
  function pathRetrace(k, Fat, Tend, P, N) {
    const runs = traceRuns(k.sp.z, Fat, Tend, P, N);
    return runs.length ? pathFlat({ sp: k.sp, runs, mk: pathMarksW(k.sp.z, Fat, Tend) }) : null;
  }
  // On screen (the merged plane; the globe with P its projection, null on the far side, where the run splits): the
  // travelled part 0 -> T in ink on a halo of the plane's colour (light and dark), the open ring at z, the marks the
  // moving point has passed (the arrowhead, one per step one after another, on paths of PATHS.arrowMin px or more; a
  // bar where steps meet; no time dots: the live view has no caption to explain them) and the moving point H_T(z), a
  // filled dot; a small open chevron where a path leaves the view or comes into it, and where it goes behind the
  // globe's limb. Nothing ahead of the moving point: rest and motion look alike. A path whose start has left the view
  // (a pan or a scrub's auto-fit) stays, clipped, with the chevron where it comes in, until the next choice (verify fix
  // path-3: it vanished at once). o.fade scales the opacity (the cross-fade between two sets, drawMorphPathsX); o.hook
  // false leaves the test hook's record alone.
  function drawMorphPaths(pane, sel, F, P = null, o = {}) {
    if (!sel || !sel.kept.length) return;
    const fade = o.fade == null ? 1 : o.fade;
    if (!(fade > 0.01)) return;
    const flat = !P;
    if (flat) P = (w) => pane.w2s(w);
    const ctx = pane.ctx, T = morph.T, W = pane.w, Hh = pane.h;
    const inView = (q) => q[0] >= 0 && q[0] <= W && q[1] >= 0 && q[1] <= Hh;
    const LW = flat ? 1.4 : 1.6, AL = 9.5, AW = 3.2, BAR = 4;
    const lines = [], rings = [], arrows = [], bars = [], heads = [], cues = [], drawnZ = [];
    // (a cue: an open chevron at tip (x, y) pointing along u)
    const edgeCue = (a, b, enter) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
      // the point where the segment crosses the view's edge, from its inside end
      const [o, q] = enter ? [b, a] : [a, b];
      const ex = q[0] - o[0], ey = q[1] - o[1];
      let u = 1;
      if (q[0] > W) u = Math.min(u, (W - o[0]) / ex); if (q[0] < 0) u = Math.min(u, -o[0] / ex); if (q[1] > Hh) u = Math.min(u, (Hh - o[1]) / ey); if (q[1] < 0) u = Math.min(u, -o[1] / ey);
      const x = o[0] + ex * u, y = o[1] + ey * u;
      cues.push(enter ? [x + 12 * ux, y + 12 * uy, ux, uy] : [x - 7 * ux, y - 7 * uy, ux, uy]);
    };
    for (const k of sel.kept) {
      const mk = k.mk;
      const pz = mk && mk.z && k.runs[0][0].T === 0 ? P(mk.z) : null;
      const wT = T > 0 ? F(k.sp.z) : null;
      const hp = wT && CX.isFin(wT) ? P(wT) : null;
      let headOn = false, len = 0;
      for (const r of k.runs || []) {
        if (r[0].T > T) break;
        let cur = [];
        const end = () => { if (cur.length > 1) lines.push(cur); cur = []; };
        let gone = false;
        for (const q of r) {
          if (q.T > T) break;
          const p = P(q.w);
          if (!p) {
            // (the globe: the run goes behind the limb; a chevron a little before the last point it shows)
            if (!flat && cur.length > 1 && !gone) { const a = cur[cur.length - 2], b = cur[cur.length - 1], d = mDist(a, b) || 1; cues.push([b[0] - 4 * (b[0] - a[0]) / d, b[1] - 4 * (b[1] - a[1]) / d, (b[0] - a[0]) / d, (b[1] - a[1]) / d]); }
            gone = true; end(); continue;
          }
          if (cur.length) len += mDist(cur[cur.length - 1], p);
          cur.push(p);
          if (!flat && gone && cur.length === 2) { const a = cur[0], b = cur[1], d = mDist(a, b) || 1; cues.push([a[0] + 10 * (b[0] - a[0]) / d, a[1] + 10 * (b[1] - a[1]) / d, (b[0] - a[0]) / d, (b[1] - a[1]) / d]); gone = false; }
        }
        // (the moving point joins the run it is on)
        if (hp && T <= r[r.length - 1].T + 1e-12 && cur.length && mDist(cur[cur.length - 1], hp) < 30) { cur.push(hp); headOn = true; }
        if (flat) for (let i = 1; i < cur.length; i++) { const a = inView(cur[i - 1]), b = inView(cur[i]); if (a && !b) edgeCue(cur[i - 1], cur[i], false); else if (!a && b) edgeCue(cur[i - 1], cur[i], true); }
        end();
      }
      if (headOn) { heads.push(hp); if (flat) drawnZ.push([hp[0], hp[1], k.sp.z.re, k.sp.z.im]); }
      if (!mk) continue;
      if (pz) rings.push(pz);
      // (a mark is drawn once the moving point has passed it, and only where it stands clear of the ring, the other
      // marks and the moving point: a slow stretch packs them)
      const placed = pz ? [pz] : [];
      const clear = (p, r) => placed.every((q) => mDist(p, q) >= r) && !(headOn && mDist(p, hp) < r);
      const dirOf = (m) => { const a = m.a && P(m.a), b = m.b && P(m.b), d = a && b ? mDist(a, b) : 0; return d > 1e-9 ? [(b[0] - a[0]) / d, (b[1] - a[1]) / d] : null; };
      const long = Math.max(len, k.lenPx || 0) >= (sel.arrowMin || PATHS.arrowMin);
      for (const m of mk.arrows || []) {
        if (!long || T < m.T - 1e-9 || !m.w) continue;
        const p = P(m.w), u = p && dirOf(m);
        if (u && clear(p, 9)) { arrows.push([p, u[0], u[1]]); placed.push(p); }
      }
      for (const m of mk.nodes || []) {
        if (T < m.T - 1e-9 || !m.w) continue;
        const p = P(m.w), u = p && dirOf(m);
        if (u && clear(p, 6)) { bars.push([p, u[0], u[1]]); placed.push(p); }
      }
    }
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const circles = (l, r) => { ctx.beginPath(); for (const p of l) { ctx.moveTo(p[0] + r, p[1]); ctx.arc(p[0], p[1], r, 0, TAU); } };
    const arrowPath = () => {
      ctx.beginPath();
      for (const [p, ux, uy] of arrows) {
        const tx = p[0] + 0.5 * AL * ux, ty = p[1] + 0.5 * AL * uy, bx = p[0] - 0.5 * AL * ux, by = p[1] - 0.5 * AL * uy;
        ctx.moveTo(tx, ty); ctx.lineTo(bx - AW * uy, by + AW * ux); ctx.lineTo(bx + 0.3 * AL * ux, by + 0.3 * AL * uy); ctx.lineTo(bx + AW * uy, by - AW * ux); ctx.closePath();
      }
    };
    const barPath = () => { ctx.beginPath(); for (const [p, ux, uy] of bars) { ctx.moveTo(p[0] - BAR * uy, p[1] + BAR * ux); ctx.lineTo(p[0] + BAR * uy, p[1] - BAR * ux); } };
    const chevrons = () => {
      ctx.beginPath();
      for (const [x, y, ux, uy] of cues) {
        const L = 5, c = Math.cos(0.6), s = Math.sin(0.6);
        ctx.moveTo(x - L * (ux * c - uy * s), y - L * (uy * c + ux * s)); ctx.lineTo(x, y); ctx.lineTo(x - L * (ux * c + uy * s), y - L * (uy * c - ux * s));
      }
    };
    // the casing (one pass for everything), then the ink
    const ga = (a) => { ctx.globalAlpha = a * fade; };
    ctx.strokeStyle = A.TH.halo; ga(0.55);
    ctx.beginPath(); for (const l of lines) { ctx.moveTo(l[0][0], l[0][1]); for (let i = 1; i < l.length; i++) ctx.lineTo(l[i][0], l[i][1]); }
    ctx.lineWidth = LW + 2.2; ctx.stroke();
    chevrons(); ctx.lineWidth = 3.4; ctx.stroke();
    barPath(); ctx.lineWidth = 3.6; ctx.stroke();
    ga(0.85); ctx.fillStyle = A.TH.halo;
    circles(rings, 3.9); ctx.fill(); circles(heads, 4.1); ctx.fill();
    arrowPath(); ctx.lineWidth = 1.8; ctx.stroke();
    ctx.strokeStyle = A.TH.ink; ctx.fillStyle = A.TH.ink; ga(0.92);
    ctx.beginPath(); for (const l of lines) { ctx.moveTo(l[0][0], l[0][1]); for (let i = 1; i < l.length; i++) ctx.lineTo(l[i][0], l[i][1]); }
    ctx.lineWidth = LW; ctx.stroke();
    chevrons(); ctx.lineWidth = 1.4; ctx.stroke();
    barPath(); ctx.lineWidth = 1.2; ctx.stroke();
    ga(1);
    circles(rings, 2.6); ctx.lineWidth = 1.25; ctx.stroke();
    arrowPath(); ctx.fill();
    circles(heads, 2.8); ctx.fill();
    ctx.restore();
    if (flat && o.hook !== false) A.mfDrawn = { T, heads: drawnZ };
  }
  // the live paths with the cross-fade between two sets (verify fix path-3: a new choice after a pan, a zoom or an
  // orbit swapped the whole set in one frame): for PATHS.fade ms after a choice replaced a set under the same chain and
  // shapes, the old set fades out while the new one fades in
  function drawMorphPathsX(pane, sel, F, P = null) {
    const pv = mfCache.prev;
    let u = 1;
    if (pv && pv.next === sel) {
      u = Math.min(1, (performance.now() - pv.t0) / PATHS.fade);
      if (u < 1) { drawMorphPaths(pane, pv.sel, F, P, { fade: 1 - u, hook: false }); requestRender('R'); } else mfCache.prev = null;
    }
    drawMorphPaths(pane, sel, F, P, { fade: u });
  }
  // the paths as print vectors in figure units (u: units per pt): items [{ runs: [[[x, y], ...], ...], z, e (the
  // start ring and the end dot: [x, y] or null), arrows: [{ p, d: [ux, uy] }], nodes: [{ p, d }] (where steps meet),
  // dots: [p], limbOut / limbIn: indices of the runs that go behind the globe's limb at their end / come from behind at
  // their start }]; o: { u, clip {x, y, w, h}, id }. Black, 0.5 pt, on a 1 pt white casing (0.25 pt each side: it
  // parts the line from a dark square without a second line on the grey ones); an open ring (1.3 pt) at z, a 3.4 pt
  // arrowhead at each arrow time, a 3.2 pt bar across the path where steps meet, dots (0.65 pt) at the dot times, a
  // filled dot (1.3 pt) at the end; an open chevron where a path leaves the clip or comes into it, or passes the limb
  function pathsSvg(items, o = {}) {
    const u = o.u || 1, clip = o.clip || null;
    const f2 = (v) => (Math.round(v * 100) / 100).toString();
    const inC = (p) => !clip || (p[0] >= clip.x && p[0] <= clip.x + clip.w && p[1] >= clip.y && p[1] <= clip.y + clip.h);
    let d = '', rings = '', dots = '', heads = '', ends = '', cues = '', bars = '';
    const chev = (x, y, ux, uy) => { const L = 2.6 * u, c = Math.cos(0.6), sn = Math.sin(0.6); cues += `M${f2(x - L * (ux * c - uy * sn))} ${f2(y - L * (uy * c + ux * sn))}L${f2(x)} ${f2(y)}L${f2(x - L * (ux * c + uy * sn))} ${f2(y - L * (uy * c - ux * sn))}`; };
    // (where segment a (inside the clip) -> b (outside) meets the clip's edge)
    const cross = (a, b) => {
      const dx = b[0] - a[0], dy = b[1] - a[1];
      let s = 1;
      if (b[0] > clip.x + clip.w) s = Math.min(s, (clip.x + clip.w - a[0]) / dx); if (b[0] < clip.x) s = Math.min(s, (clip.x - a[0]) / dx);
      if (b[1] > clip.y + clip.h) s = Math.min(s, (clip.y + clip.h - a[1]) / dy); if (b[1] < clip.y) s = Math.min(s, (clip.y - a[1]) / dy);
      return [a[0] + dx * s, a[1] + dy * s];
    };
    const unit = (a, b) => { const dd = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / dd, (b[1] - a[1]) / dd]; };
    for (const it of items) {
      let len = 0;
      it.runs.forEach((r, ri) => {
        if (r.length < 2) return;
        d += 'M' + r.map((p) => `${f2(p[0])} ${f2(p[1])}`).join('L');
        for (let i = 1; i < r.length; i++) {
          const a = r[i - 1], b = r[i];
          len += Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (!clip) continue;
          const ia = inC(a), ib = inC(b);
          if (ia === ib) continue;
          const [ux, uy] = unit(a, b);
          if (ia) { const c = cross(a, b); chev(c[0] - 2.2 * u * ux, c[1] - 2.2 * u * uy, ux, uy); }
          else { const c = cross(b, a); chev(c[0] + 4.8 * u * ux, c[1] + 4.8 * u * uy, ux, uy); }
        }
        if (it.limbOut && it.limbOut.includes(ri)) { const a = r[r.length - 2], b = r[r.length - 1], [ux, uy] = unit(a, b); chev(b[0] - 1.6 * u * ux, b[1] - 1.6 * u * uy, ux, uy); }
        if (it.limbIn && it.limbIn.includes(ri)) { const a = r[0], b = r[1], [ux, uy] = unit(a, b); chev(a[0] + 4 * u * ux, a[1] + 4 * u * uy, ux, uy); }
      });
      const z = it.z, e = it.e;
      if (z) rings += `<circle cx="${f2(z[0])}" cy="${f2(z[1])}" r="${f2(1.3 * u)}"/>`;
      if (e) ends += `<circle cx="${f2(e[0])}" cy="${f2(e[1])}" r="${f2(1.3 * u)}"/>`;
      if (len < 9 * u) continue;
      const placed = [z, e].filter(Boolean);
      const clear = (p, r) => inC(p) && placed.every((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) >= r * u);
      for (const m of it.arrows || []) {
        if (!m.p || !m.d || !clear(m.p, 3.4)) continue;
        const [ux, uy] = m.d, p = m.p, L = 3.4 * u, Wd = 1.35 * u, tx = p[0] + 0.5 * L * ux, ty = p[1] + 0.5 * L * uy, bx = p[0] - 0.5 * L * ux, by = p[1] - 0.5 * L * uy;
        heads += `<path d="M${f2(tx)} ${f2(ty)}L${f2(bx - Wd * uy)} ${f2(by + Wd * ux)}L${f2(bx + 0.3 * L * ux)} ${f2(by + 0.3 * L * uy)}L${f2(bx + Wd * uy)} ${f2(by - Wd * ux)}Z"/>`;
        placed.push(p);
      }
      for (const m of it.nodes || []) {
        if (!m.p || !m.d || !clear(m.p, 2.4)) continue;
        const [ux, uy] = m.d, p = m.p, B = 1.6 * u;
        bars += `M${f2(p[0] - B * uy)} ${f2(p[1] + B * ux)}L${f2(p[0] + B * uy)} ${f2(p[1] - B * ux)}`;
        placed.push(p);
      }
      for (const p of it.dots || []) if (p && clear(p, 2.4)) { dots += `<circle cx="${f2(p[0])}" cy="${f2(p[1])}" r="${f2(0.65 * u)}"/>`; placed.push(p); }
    }
    const w = (v) => f2(v * u);
    let body = '';
    // (every white casing first, then every black line: a bar's or a chevron's casing drawn over the path cut the line
    // at a step's corner into a gap with a loose slash beside it; verify fix path-1)
    if (d) body += `<path d="${d}" fill="none" stroke="#ffffff" stroke-width="${w(1)}" stroke-linecap="round" stroke-linejoin="round"/>`;
    if (cues) body += `<path d="${cues}" fill="none" stroke="#ffffff" stroke-width="${w(1.5)}" stroke-linecap="round" stroke-linejoin="round"/>`;
    if (bars) body += `<path d="${bars}" fill="none" stroke="#ffffff" stroke-width="${w(1.5)}" stroke-linecap="round"/>`;
    if (d) body += `<path d="${d}" fill="none" stroke="#000000" stroke-width="${w(0.5)}" stroke-linecap="round" stroke-linejoin="round" class="mf-paths"/>`;
    if (cues) body += `<path d="${cues}" fill="none" stroke="#000000" stroke-width="${w(0.5)}" stroke-linecap="round" stroke-linejoin="round"/>`;
    if (bars) body += `<path d="${bars}" fill="none" stroke="#000000" stroke-width="${w(0.5)}" stroke-linecap="round" class="mf-bars"/>`;
    if (dots) body += `<g fill="#000000" stroke="#ffffff" stroke-width="${w(0.3)}" paint-order="stroke">${dots}</g>`;
    if (heads) body += `<g fill="#000000" stroke="#ffffff" stroke-width="${w(0.35)}" stroke-linejoin="round" paint-order="stroke" class="mf-heads">${heads}</g>`;
    if (rings) body += `<g fill="#ffffff" stroke="#000000" stroke-width="${w(0.45)}" class="mf-rings">${rings}</g>`;
    if (ends) body += `<g fill="#000000" stroke="#ffffff" stroke-width="${w(0.35)}" paint-order="stroke" class="mf-ends">${ends}</g>`;
    if (!clip || !body) return body;
    const id = `${o.id || 'mp'}-clip`;
    return `<clipPath id="${id}"><rect x="${f2(clip.x)}" y="${f2(clip.y)}" width="${f2(clip.w)}" height="${f2(clip.h)}"/></clipPath><g clip-path="url(#${id})">${body}</g>`;
  }
  // X's outline over the moving image (so X never disappears under it): 1 px faint, dashed 4/3 when the set is open
  const mfOutlineCache = { skey: '', wkey: '', val: null, timer: 0 };
  function drawMorphOutline(pane, X, Fbase) {
    const ctx = pane.ctx, win = pane.box();
    // (X's boundary curves are sampled once per shapes and view, not per frame of the transport; while the view moves
    // (a pan, a zoom, the auto-fit of a scrub) the last sampling, the same curves in the plane, is re-projected, and
    // the settled view is sampled anew)
    const skey = JSON.stringify(X.vis), wkey = [win.x0, win.x1, win.y0, win.y1].join('|');
    const moving = !!(A.drag || tweens.length || performance.now() - A.motionInT < 150);
    if (mfOutlineCache.skey !== skey || !mfOutlineCache.val || (mfOutlineCache.wkey !== wkey && !moving)) { mfOutlineCache.skey = skey; mfOutlineCache.wkey = wkey; mfOutlineCache.val = morphOutline(X, win); }
    else if (mfOutlineCache.wkey !== wkey) { clearTimeout(mfOutlineCache.timer); mfOutlineCache.timer = setTimeout(() => requestRender('R'), 170); }
    const outline = mfOutlineCache.val;
    ctx.save();
    ctx.strokeStyle = A.TH.faint; ctx.lineWidth = 1; ctx.globalAlpha = 0.9;
    if (X.open) ctx.setLineDash([4, 3]);
    ctx.beginPath();
    for (const o of outline) {
      let pen = false, last = null;
      for (const q of o.l) {
        const w = Fbase ? Fbase(C(q[0], q[1])) : C(q[0], q[1]);
        if (!CX.isFin(w)) { pen = false; continue; }
        const p = pane.w2s(w);
        if (pen && last && mDist(p, last) > 60) pen = false;
        if (pen) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]);
        pen = true; last = p;
      }
    }
    ctx.stroke();
    ctx.restore();
  }
  // X's neutral tint (ink at 7 %) under the image, as a pass of the preimage shader with the identity map (z-plane X)
  function drawXTint(pane, X) {
    if (!GLR.drawPreimage || !X.areas.length) return;
    const ink = GLR.hexRGB(A.TH.ink);
    const targets = X.areas.map((s) => Object.assign({}, s, { color: ink, edge: ink, alpha: MF.srcFillA, width: 0 }));
    cmFormAnchor([pane.view.cx, pane.view.cy]);
    try { GLR.drawPreimage({ map: IDENT, view: pane.view, dpr: pane.dpr, targets, ink: A.TH.inkRGB, halo: GLR.hexRGB(A.TH.halo), haloA: 0 }); } catch (e) { console.error('X tint', e); }
  }
  // the figure's vector layers of the deformation panel (morph-figure.md 5), in figure px: X's outline and the paths
  // (pathsSvg, line weights in pt)
  function morphFigureLayers(sel, P, box, clipId) {
    const f2 = (v) => (Math.round(v * 100) / 100).toString();
    const dP = (l) => 'M' + l.map((p) => `${f2(p[0])} ${f2(p[1])}`).join('L');
    let s = `<defs><clipPath id="${clipId}"><rect x="${f2(box.x)}" y="${f2(box.y)}" width="${f2(box.w)}" height="${f2(box.h)}"/></clipPath></defs>`;
    // X's outline over the image
    const ol = sel.pxLines.filter((l) => l.length > 1);
    if (ol.length) s += `<g clip-path="url(#${clipId})"><path d="${ol.map(dP).join('')}" fill="none" stroke="${MF.outlineInk}" stroke-width="${MF.srcEdgeW}"${sel.X.open ? ` stroke-dasharray="${MF.dash}"` : ''}/></g>`;
    s += pathsSvg(sel.kept.map((k) => pathItem(k, P, sel.Tend)), { u: 96 / 72, clip: { x: box.x, y: box.y, w: box.w, h: box.h }, id: `${clipId}p` });
    return { svg: s, labelled: null };
  }
  // a kept path for pathsSvg under the projection P (figure px or pt): its runs, the ring at z only where the path
  // starts there, the end dot only where it reaches t = Tend, its arrowheads and step bars with their directions, its
  // time dots (pathMarkTimes)
  function pathItem(k, P, Tend) {
    const mk = k.mk || {}, runs = k.runs || [];
    const pr = (w) => (w ? P(w) : null);
    const dirOf = (m) => { const a = pr(m.a), b = pr(m.b), d = a && b ? mDist(a, b) : 0; return d > 1e-9 ? [(b[0] - a[0]) / d, (b[1] - a[1]) / d] : null; };
    const lr = runs[runs.length - 1];
    return {
      runs: runs.map((r) => r.map((q) => P(q.w))),
      z: runs.length && runs[0][0].T === 0 ? pr(mk.z) : null,
      e: lr && lr[lr.length - 1].T >= Tend - 1e-9 ? pr(mk.e) : null,
      arrows: (mk.arrows || []).map((m) => ({ p: pr(m.w), d: dirOf(m) })),
      nodes: (mk.nodes || []).map((m) => ({ p: pr(m.w), d: dirOf(m) })),
      dots: (mk.dots || []).map((m) => pr(m.w)),
    };
  }
  // the geometry of a kept path in the plane: 'segment', 'arc' or 'other' (the caption's path clause, measured)
  function morphPathShape(z, Tend) {
    const pts = [];
    for (let i = 0; i <= 40; i++) pts.push(morphAt(Tend * i / 40)(z));
    if (!pts.every((p) => CX.isFin(p))) return 'other';
    const a = pts[0], b = pts[40], L = CX.abs(CX.sub(b, a));
    if (!(L > 0)) return 'other';
    const u = CX.scale(CX.sub(b, a), 1 / L);
    const off = (p) => { const d = CX.sub(p, a); return Math.abs(d.re * u.im - d.im * u.re); };
    if (pts.every((p) => off(p) < 1e-7 * Math.max(1, L))) return 'segment';
    const m = pts[20];
    const ax = a.re, ay = a.im, bx = m.re, by = m.im, cx = b.re, cy = b.im;
    const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    if (Math.abs(d) < 1e-14) return 'other';
    const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
    const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
    const R = Math.hypot(ax - ux, ay - uy);
    return pts.every((p) => Math.abs(Math.hypot(p.re - ux, p.im - uy) - R) < 1e-7 * Math.max(1, R)) ? 'arc' : 'other';
  }
  // inline TeX ($...$) in a phrase -> caption segments
  const texSegs = (str) => String(str).split('$').map((x, i) => (i % 2 ? { m: x } : { t: x })).filter((x) => (x.m != null ? x.m.length : x.t.length));
  // inline maths in a deformation caption (morph-figure.md 5: no inline \frac): \tfrac for a quotient of numbers (and
  // pi), a slash with brackets as needed for expressions: \frac{z-i}{z+i} -> (z-i)/(z+i)
  function inlineFrac(tex) {
    const group = (str, i) => { // the brace group at i: [content, index after it]
      if (str[i] !== '{') { const m = /^\\[A-Za-z]+|^./.exec(str.slice(i)); return [m ? m[0] : '', i + (m ? m[0].length : 1)]; }
      let d = 0, j = i;
      for (; j < str.length; j++) { if (str[j] === '\\') { j++; continue; } if (str[j] === '{') d++; else if (str[j] === '}' && --d === 0) break; }
      return [str.slice(i + 1, j), j + 1];
    };
    const simple = (x) => /^(?:[A-Za-z0-9.]|\\pi|\\infty)+$/.test(x) || /^[A-Za-z0-9.]*(?:\^\{?[A-Za-z0-9.]+\}?|_\{?[A-Za-z0-9.]+\}?)$/.test(x);
    const numeric = (x) => /^(?:[0-9.]+|\\pi|[0-9.]+\\pi)$/.test(x);
    let out = '', i = 0;
    while (i < tex.length) {
      const k = tex.indexOf('\\frac', i);
      if (k < 0 || /[A-Za-z]/.test(tex[k + 5] || '')) { if (k < 0) { out += tex.slice(i); break; } out += tex.slice(i, k + 5); i = k + 5; continue; }
      out += tex.slice(i, k);
      let j = k + 5;
      while (tex[j] === ' ') j++;
      const [A0, j1] = group(tex, j);
      let j2 = j1; while (tex[j2] === ' ') j2++;
      const [B0, j3] = group(tex, j2);
      const A = inlineFrac(A0), B = inlineFrac(B0);
      if (numeric(A) && numeric(B)) out += `\\tfrac{${A}}{${B}}`;
      else out += `${simple(A) ? A : `(${A})`}/${simple(B) ? B : `(${B})`}`;
      i = j3;
    }
    return out;
  }
  // the homotopy phrase of the open deformation (morph-figure.md 5, table). Tend < m ('Up to t'): the phrase states the
  // whole homotopy, and the caption says once, at sentence level, which part is shown (stop)
  // (SPEC 8) the bracket in TeX: pre 'f_1', post 'f_3' (three or more: f_6\circ\cdots\circ f_4), H_0 = qp and
  // H_0(z) = qpz; null without a bracket or with no step outside it
  function rangeTex() {
    const p = A.S.focus === 0 ? rangeParts() : null;
    if (!p || (!p.pre.length && !p.post.length)) return null;
    // (a d/dz in the pre is an operator on the chain so far, not a map composed with it: the pre then starts from the
    // stage of its last d/dz, w_d, a function of z that the chain sentence defines, and goes on with the maps after it:
    // P = f_{a−1} ∘ … ∘ f_{d+1} ∘ w_d. Review v16 math-1)
    let d = 0;
    for (const k of p.pre) if (isDeriv(k)) d = k;
    const tok = (ks, w) => [...(w ? [`w_{${w}}`] : []), ...ks.map((k) => `f_{${k}}`)];
    const comp = (ts) => { const q = ts.slice().reverse(); return q.length <= 2 ? q.join('\\circ ') : `${q[0]}\\circ\\cdots\\circ ${q[q.length - 1]}`; };
    const app = (ts, x) => (!ts.length ? x : ts.length === 1 ? `${ts[0]}(${x})` : ts.length === 2 ? `${ts[1]}(${ts[0]}(${x}))` : `(${comp(ts)})(${x})`);
    const preT = tok(p.pre.filter((k) => k > d), d), postT = tok(p.post);
    const pre = preT.length ? comp(preT) : null, post = postT.length ? comp(postT) : null;
    const qp = [post, pre].filter(Boolean).join('\\circ ');
    // (v16.1, verify-2: the captions that write w_d also define it, as a function of z)
    const wdef = d ? `w_{${d}}=${stageTexOf(d)}` : null;
    return { range: { a: p.a, b: p.b }, pre, post, qp, qpz: app(postT, app(preT, 'z')), H: `H_t=${[post, 'G_t', pre].filter(Boolean).join('\\circ ')}`, deriv: d, wdef };
  }
  // the stage w_k as TeX in z: the active steps up to k composed (a d/dz step writes the derivative of what it is given)
  function stageTexOf(k) {
    let arg = { s: 'z', p: 4 };
    for (const j of activeSteps()) { if (j > k) break; arg = A.built[j - 1].tex(arg); }
    return arg.s;
  }
  // " Here w_d = ...", after a caption sentence that writes the bracket's start with a d/dz in its pre
  const wDefSegs = (rt) => (rt && rt.wdef ? capT(' Here %{w}.', { w: { m: rt.wdef } }) : []);
  // (v16.1 review user-1, user-2) the Landscape draws H_t on F's sheets: a deformed root, power or log runs on every
  // sheet, so its homotopy is not said to be on the principal branch (homTex's o.sheets: "on every sheet")
  const homSheetWords = () => { try { const sh = sheetsShown(); return !!(sh && sh.hom); } catch (e) { return false; } };
  function morphHomSegs(Tend) {
    const rt = rangeTex();
    if (rt) return morphHomSegsRange(Tend, rt);
    const { steps } = morphRange();
    const m = steps.length, all = allAtOnce();
    const upTo = Tend < (all ? 1 : m) - 1e-9;
    const stop = upTo ? capT(', shown for %{r}', { r: { m: `0\\le t\\le ${I18N.texNum(CX.fmtNum(Tend, 2))}` } }) : [];
    const range = (t1) => [{ t: ', ' }, { m: `0\\le t\\le ${t1}` }];
    // (several steps: f_k, p_k, ... name step k's map and centre; all at once, every H^{(k)}_t acts on u, since its input
    // there is H^{(k-1)}_t(z), not w_{k-1})
    const sh = homSheetWords();
    const phrase = (k, names) => {
      const b = A.built[k - 1], v = all && m > 1 ? 'u' : k === 1 ? 'z' : `w_{${k - 1}}`;
      const o = names || sh ? Object.assign(names ? { f: `f_{${k}}`, p: `p_{${k}}`, c: `c_{${k}}`, a: `a_{${k}}` } : {}, sh ? { sheets: true } : {}) : undefined;
      const r = b && b.homTex ? b.homTex(v, o) : null;
      if (r) return r;
      return { tex: $t('the straight-line homotopy $H_t(%{v})=(1-t)%{v}+t\\,%{F}(%{v})$', { v, F: m === 1 && A.S.focus === 0 ? 'F' : `f_{${k}}` }), segment: true };
    };
    if (m === 1) {
      const r = phrase(steps[0]);
      // (a phrase that states its own range of t does not get a second one)
      const own = /\\le\s*1|\\le t|t\\le|t</.test(r.tex);
      return { segs: [...texSegs(r.tex), ...(own ? [] : range(1))], stop, mobius: !!r.mobius, segment: !!r.segment };
    }
    // several steps all at once: H_t = H^{(n)}_t o ... o H^{(1)}_t, 0 <= t <= 1, each step's own homotopy at the same t
    if (all) {
      const own = (k, tex) => texSegs(tex).map((g) => (g.m == null ? g : { m: g.m.replace(/H_\{?([t0-9])\}?/g, (_, x) => `{H^{(${k})}_{${x}}}`) }));
      const comp = steps.map((k) => `H^{(${k})}_t`).reverse().join('\\circ ');
      const segs = capT('the homotopy {H}, {range}, that deforms every step at once: ', { H: { m: `H_t=${comp}` }, range: { m: '0\\le t\\le 1' } });
      steps.forEach((k, i) => {
        if (i) segs.push({ t: '; ' });
        segs.push(...capT('for {f}, {phrase}', { f: { m: `f_{${k}}` }, phrase: own(k, phrase(k, true).tex) }));
      });
      return { segs, stop, mobius: false };
    }
    // several steps: H_t runs the steps in turn, 0 <= t <= m; step k's own homotopy is H^{(k)}_s in its own time s,
    // H_t = H^{(k)}_{t-k+1} on k-1 <= t <= k
    const local = (k, tex) => texSegs(tex).map((g) => (g.m == null ? g : {
      m: g.m.replace(/(?<![\\A-Za-z])t/g, 's').replace(/H_\{?([s0-9])\}?/g, (_, x) => `{H^{(${k})}_{${x}}}`),
    }));
    const segs = capT('the homotopy {H}, {range}, that runs the steps in turn ({def} on {interval}): ', { H: { m: `H_t` }, range: { m: `0\\le t\\le ${m}` }, def: { m: 'H_t=H^{(k)}_{t-k+1}' }, interval: { m: 'k-1\\le t\\le k' } });
    steps.forEach((k, i) => {
      if (i) segs.push({ t: '; ' });
      segs.push(...capT('for {f}, {phrase}', { f: { m: `f_{${k}}` }, phrase: local(k, phrase(k, true).tex) }));
    });
    return { segs, stop, mobius: false };
  }
  // (SPEC 8) the homotopy with a bracket: "the homotopy H_t = f_3 o G_t o f_1, 0 <= t <= m, where G_t is <inner>";
  // inner is the bracketed part (a step's phrase with H renamed G; in turn or at once, with the "for f_k" list)
  function morphHomSegsRange(Tend, rt) {
    const { steps } = morphRange();
    const m = steps.length, all = allAtOnce(), a = rt.range.a;
    const upTo = Tend < (all ? 1 : m) - 1e-9;
    const stop = upTo ? capT(', shown for %{r}', { r: { m: `0\\le t\\le ${I18N.texNum(CX.fmtNum(Tend, 2))}` } }) : [];
    const toG = (g) => (g.m == null ? g : { m: g.m.replace(/H_(\{[^{}]*\}|[t0-9])/g, 'G_$1').replace(/H\^/g, 'G^') });
    const sh = homSheetWords();
    const phrase = (k, names) => {
      const b = A.built[k - 1], v = all && m > 1 ? 'u' : k === 1 ? 'z' : `w_{${k - 1}}`;
      const o = names || sh ? Object.assign(names ? { f: `f_{${k}}`, p: `p_{${k}}`, c: `c_{${k}}`, a: `a_{${k}}` } : {}, sh ? { sheets: true } : {}) : undefined;
      const r = b && b.homTex ? b.homTex(v, o) : null;
      if (r) return r;
      return { tex: $t('the straight-line homotopy $H_t(%{v})=(1-t)%{v}+t\\,%{F}(%{v})$', { v, F: `f_{${k}}` }), segment: true };
    };
    let inner, mob = false, seg = false;
    const list = [];
    if (m === 1) { const r = phrase(steps[0]); inner = texSegs(r.tex).map(toG); mob = !!r.mobius; seg = !!r.segment; }
    else if (all) {
      const own = (k, tex) => texSegs(tex).map((g) => (g.m == null ? g : { m: g.m.replace(/H_\{?([t0-9])\}?/g, (_, x) => `{H^{(${k})}_{${x}}}`) }));
      const G = steps.length === 2 ? `H^{(${steps[1]})}_t\\circ H^{(${steps[0]})}_t` : `H^{(${steps[m - 1]})}_t\\circ\\cdots\\circ H^{(${steps[0]})}_t`;
      inner = capT('the homotopy {G} that deforms these steps at once: ', { G: { m: G } });
      steps.forEach((k, i) => { if (i) list.push({ t: '; ' }); list.push(...capT('for {f}, {phrase}', { f: { m: `f_{${k}}` }, phrase: own(k, phrase(k, true).tex) })); });
    } else {
      const local = (k, tex) => texSegs(tex).map((g) => (g.m == null ? g : { m: g.m.replace(/(?<![\\A-Za-z])t/g, 's').replace(/H_\{?([s0-9])\}?/g, (_, x) => `{H^{(${k})}_{${x}}}`) }));
      inner = capT('the homotopy that runs the steps in turn ({def} on {interval}): ', { def: { m: `G_t=H^{(k)}_{t-k+${a}}` }, interval: { m: `k-${a}\\le t\\le ${a === 1 ? 'k' : `k-${a - 1}`}` } });
      steps.forEach((k, i) => { if (i) list.push({ t: '; ' }); list.push(...capT('for {f}, {phrase}', { f: { m: `f_{${k}}` }, phrase: local(k, phrase(k, true).tex) })); });
    }
    const innerAll = [...inner, ...list];
    const segs = capT('the homotopy %{H}, %{range}, where %{G} is %{inner}', { H: { m: rt.H }, range: { m: `0\\le t\\le ${all ? 1 : m}` }, G: { m: 'G_t' }, inner: innerAll });
    return { segs, stop, mobius: mob, segment: seg, inner: innerAll, innerShort: inner, rt };
  }
  // the times of a path's marks, m/4, m/2 and 3m/4, as TeX: a reduced fraction when m is whole (1/4, 3/2), else a number
  const pathTimesTex = (Tend) => [1, 2, 3].map((j) => {
    if (Math.abs(Tend - Math.round(Tend)) > 1e-9) return I18N.texNum(CX.fmtNum(Tend * j / 4, 3));
    let n = Math.round(Tend) * j, d = 4;
    while (n % 2 === 0 && d > 1) { n /= 2; d /= 2; }
    return d === 1 ? String(n) : `${n}/${d}`;
  });
  // a time as TeX: a reduced fraction when it is a whole number of quarters (1/4, 3/2), else a number
  const timeTex = (x) => {
    let n = Math.round(4 * x), d = 4;
    if (Math.abs(4 * x - n) > 1e-9) return I18N.texNum(CX.fmtNum(x, 3));
    while (n % 2 === 0 && d > 1) { n /= 2; d /= 2; }
    return d === 1 ? String(n) : `${n}/${d}`;
  };
  // the times of the marks (pathMarkTimes) as TeX lists for the captions: { seq, arrows: '1/2,\\ 3/2', nodes: '1' }
  const pathMarksTex = (Tend) => { const mt = pathMarkTimes(Tend), list = (l) => l.map(timeTex).join(',\\ '); return { seq: mt.seq, arrows: list(mt.arrows), nodes: list(mt.nodes), dots: mt.dots.map(timeTex) }; };
  // the deformation caption (morph-figure.md 5): generated from the shapes, the chain, the kept set and the measured
  // geometry of the paths; true of what is drawn. opt.both: the (b) part of the Both figure, after "The deformation
  // H_t, 0 <= t <= T:", which names the set of (a) instead of repeating it
  function morphCaption(sel, Tend, opt = {}) {
    const vis = A.S.shapes.filter((s) => s.visible !== false);
    let pi = 0;
    const lineShapes = vis.filter((s) => kindType(s) !== 'point');
    const shapeList = joinList(lineShapes.map((s) => shapePhrase(s, 0)));
    const pts = vis.filter((s) => kindType(s) === 'point').map((s) => shapePhrase(s, pi++));
    const lv = A.S.focus > 1 ? `w_{${A.S.focus - 1}}` : 'z', Fname = A.S.focus === 0 ? 'F' : `f_{${A.S.focus}}`;
    const Ftex = A.S.focus === 0 ? compositeTexShort() : (A.built[A.S.focus - 1] && !A.built[A.S.focus - 1].error ? A.built[A.S.focus - 1].tex({ s: lv, p: 4 }).s : null);
    const mapM = Ftex ? `${Fname}(${lv})=${Ftex}` : Fname;
    // (#363) the image's fill: the phase of z carried by the map, the one region fill
    const patWord = capT('coloured by the phase of %{z}', { z: { m: 'z' } });
    const out = [];
    const hom = morphHomSegs(Tend);
    const nSets = lineShapes.length || pts.length;
    const setSegs = shapeList.length ? shapeList : pts.length ? joinList(pts) : capT('the plane', {});
    // the same set in the genitive ("the image of ..."): Russian needs the case
    let pg = 0;
    const lineGen = joinList(lineShapes.map((s) => shapePhrase(s, 0, 'gen'))), ptsGen = joinList(vis.filter((s) => kindType(s) === 'point').map((s) => shapePhrase(s, pg++, 'gen')));
    const setGen = lineGen.length ? lineGen : ptsGen.length ? ptsGen : capT('the plane', {}, 'gen');
    // how X is drawn: its outline over the image (its 7 % tint lies under the image and can be covered by it); points
    // are the start dots
    const dashed = vis.some((s) => kindType(s) === 'area' && Region.isOpen(s));
    const mark = opt.both ? (lineShapes.length ? (dashed ? (nSets > 1 ? $t(', with dashed outlines,') : $t(', with a dashed outline,')) : $t(', outlined,')) : pts.length ? $t(' (dots)') : '')
      : (lineShapes.length ? (dashed ? $t(' (dashed outline)') : $t(' (outlined)')) : pts.length ? $t(' (dots)') : '') + (nSets > 1 ? $tx('serial', ',') : '');
    const head = opt.both ? [{ t: nSets > 1 ? $t('the sets of (a)') : $t('the set of (a)') }] : A.S.focus > 1 ? (A.S.focus - 1 === 1 ? capT('The image of %{set} after the first step', { set: setGen }) : capT('The image of %{set} after %{n} steps', { set: setGen, n: String(A.S.focus - 1) })) : cap1(setSegs);
    const its = nSets > 1 ? $t('their image') : $t('its image');
    const endM = { m: Tend < morphLen() - 1e-9 ? `H_{${I18N.texNum(CX.fmtNum(Tend, 2))}}` : mapM };
    // (SPEC 8: the 700-character rule: a long bracket caption drops the "for f_k, ..." list first)
    if (hom.rt && hom.inner && hom.innerShort && hom.inner.length > hom.innerShort.length && captionLatex(hom.segs).length > 360) {
      const inner = hom.innerShort.map((g) => (g.t != null ? { t: g.t.replace(/:\s*$/, '') } : g));
      hom.segs = capT('the homotopy %{H}, %{range}, where %{G} is %{inner}', { H: { m: hom.rt.H }, range: { m: `0\\le t\\le ${allAtOnce() ? 1 : morphRange().steps.length}` }, G: { m: 'G_t' }, inner });
    }
    if (hom.rt && !opt.both) {
      // (SPEC 8: with a bracket's pre or post, the start is H_0 = Q o P, not X itself)
      const mark0 = lineShapes.length ? (dashed ? $t(' (dashed outline)') : $t(' (outlined)')) : pts.length ? $t(' (dots)') : '';
      out.push(...capT('The images of %{set} under %{start}%{mark} and under %{end} (%{pat}), joined by %{hom}.', { set: setGen, start: { m: hom.rt.qp }, mark: mark0, end: endM, pat: patWord, hom: [...hom.segs, ...hom.stop] }));
    } else out.push(...capT('%{head}%{mark} and %{its} under %{end} (%{pat}), joined by %{hom}.', { head, mark, its, end: endM, pat: patWord, hom: [...hom.segs, ...hom.stop] }));
    out.push(...wDefSegs(hom.rt));
    const nb = sel.kept.filter((k) => k.sp.kind === 'corner' || k.sp.kind === 'edge').length;
    const ni = sel.kept.filter((k) => k.sp.kind === 'node').length;
    const np = sel.kept.filter((k) => k.sp.kind === 'point').length;
    const parts = [];
    if (nb) parts.push($tn('{n} boundary point', '{n} boundary points', nb));
    if (ni) parts.push($tn('{n} interior point', '{n} interior points', ni));
    if (np) parts.push($tn('{n} marked point', '{n} marked points', np));
    if (sel.kept.length) {
      let clause = '';
      if (hom.mobius || hom.segment) {
        const kinds = new Set(sel.kept.map((k) => morphPathShape(k.sp.z, Tend)));
        if (!kinds.has('other')) clause = kinds.size === 2 ? $t('; each is an arc of a circle or a segment') : kinds.has('arc') ? $t('; each is an arc of a circle') : $t('; each is a segment');
      }
      const q = pathTimesTex(Tend).map((x) => ({ m: `t=${x}` })), mx = pathMarksTex(Tend);
      const args = { p: { m: 't\\mapsto H_t(z)' }, parts: parts.length > 1 ? parts.slice(0, -1).join(', ') + $tx('list', ' and ') + parts[parts.length - 1] : parts[0], z: { m: hom.rt ? 'H_0(z)=' + hom.rt.qpz : 'z' }, end: { m: Tend < morphLen() - 1e-9 ? `H_{${I18N.texNum(CX.fmtNum(Tend, 2))}}(z)` : 'F(z)' }, q1: q[0], q2: q[1], q3: q[2], qa: { m: `t=${mx.arrows}` }, qn: { m: `t=${mx.nodes}` }, clause };
      // (steps one after another: an arrowhead in the middle of each step, a bar where the steps meet)
      if (!mx.seq) out.push(...capT(' Curves are the paths %{p} of %{parts}, from %{z} (circle) to %{end} (dot), with small dots at %{q1} and %{q3} and an arrowhead at %{q2}%{clause}.', args));
      else if (mx.nodes) out.push(...capT(' Curves are the paths %{p} of %{parts}, from %{z} (circle) to %{end} (dot), with an arrowhead at %{qa} (the middle of each step) and a bar at %{qn}, where one step ends and the next begins%{clause}.', args));
      else out.push(...capT(' Curves are the paths %{p} of %{parts}, from %{z} (circle) to %{end} (dot), with an arrowhead at %{qa}%{clause}.', args));
    }
    out.push(...patternSegs());
    if (vis.some((s) => kindType(s) === 'area' && Region.isOpen(s))) out.push({ t: $t(' Dashed boundaries do not belong to the sets.') });
    return out.map((g) => (g.m != null ? { m: inlineFrac(g.m) } : g));
  }
  // CPU homotopy at any time T (for trails)
  function morphAt(T) {
    const saved = morph.T;
    morph.T = T;
    const ms = morphState(false);
    morph.T = saved;
    return ms.F;
  }
  // Image with the deformation transport open (morph-figure.md 3): X's neutral tint, the shapes under H_t, X's outline
  // again over them, the paths t -> H_t(z) (rails, travelled parts, heads); ghost outlines of the start (only for an
  // unbounded X, which the tint would grey over half the pane) and of the end (dotted, while t < end)
  function renderMorph(pane) {
    pane.setView(V.right);
    paper(pane);
    const ms = morphState(false);
    const X = morphX();
    const m = morphLen();
    const base = A.S.focus > 0 ? A.S.focus - 1 : 0, end = A.S.focus > 0 ? A.S.focus : nSteps();
    // (with a bracket the start is H_0 = Q o P, drawn through ms.H0Map; with none, today's stage map, byte for byte)
    const rg = homRangeOk(), start = A.S.focus > 1 || !!rg;
    const startMap = rg ? ms.H0Map : stageMap(base), startF = rg ? ms.H0F : stageF(base);
    if (GLR.ok) {
      // the tint is X itself (z-plane): at a focused step the start is the image of X at stage base, outlined instead
      const tint = !start;
      const ghosts = () => {
        if (tint && !A.artMode) drawXTint(pane, X);
        if (A.figMode || A.artMode) return;
        for (const s of A.S.shapes) {
          if (s.visible === false || kindType(s) === 'point') continue;
          const r = shapeGPU(s);
          if (!r.lineRes) continue;
          const list = [];
          if (!tint || !X.bounded) list.push([startMap, startF, [4, 3]]);
          if (morph.T < m) list.push([stageMap(end), stageF(end), [1, 2]]);
          for (const [mm, Fm, dash] of list) {
            const mk = mapKeyOf(mm);
            GLR.drawLines(r.lineRes, { map: mm, view: pane.view, dpr: pane.dpr, M: 8, width: 1 * pane.dpr, color: GLR.hexRGB(A.TH.faint), alpha: 0.8, cacheKey: `${r.lineKey}|${mk}`, dash, arc: arcOf(r, Fm, mk) });
          }
        }
      };
      // (the colour key of X's portrait, when its Key switch is on, under the ghosts)
      const key = wKeyOn() && !A.figMode ? keyUnder(pane) : null;
      drawScene(pane, ms.map, morph.playing ? null : 'R', { noUnit: A.figMode, cache: !morph.playing, under: key ? () => { key(); ghosts(); } : ghosts, noGrid: !!key, arcF: ms.F, arcKey: `${ms.key}|${A.chainSig[nSteps()]}` });
    } else noGL(pane);
    // the morph figure draws the outline, the paths and their labels as vectors (buildFigure); a one-panel figure of
    // the merged plane (a d/dz step in the chain) draws them as on screen, with no screen-cached paths
    if ((A.figMode && A.figVec) || A.artMode) return;
    drawMorphOutline(pane, X, start ? startF : null);
    const paths = !A.figMode && A.S.morphPaths !== false && !morphHasDeriv();
    if (paths) {
      try { drawMorphPathsX(pane, morphSelScreen(pane), ms.F); } catch (e) { console.error('deformation paths', e); }
    } else {
      // (Paths off: the point trails from t = 0 to now, as before)
      const ctx = pane.ctx;
      const steps = Math.max(2, Math.ceil(morph.T * 40));
      const Fs = [];
      for (let i = 0; i <= steps; i++) Fs.push(morphAt(morph.T * i / steps));
      for (const s of A.S.shapes) {
        if (s.visible === false || kindType(s) !== 'point') continue;
        const z = C(s.p[0], s.p[1]);
        ctx.strokeStyle = shapeInk(s).edge; ctx.globalAlpha = 0.55; ctx.lineWidth = 1.25;
        ctx.beginPath();
        let pen = false, last = null, prev = null;
        for (const F of Fs) {
          const w = F(z);
          if (!CX.isFin(w)) { pen = false; continue; }
          const p = pane.w2s(w);
          if (pen) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]);
          pen = true; prev = last; last = p;
        }
        ctx.stroke();
        if (prev && last && Math.hypot(last[0] - prev[0], last[1] - prev[1]) > 0.1) {
          const a = Math.atan2(last[1] - prev[1], last[0] - prev[0]);
          ctx.beginPath(); ctx.moveTo(last[0], last[1]); ctx.lineTo(last[0] - 4 * Math.cos(a - 0.5), last[1] - 4 * Math.sin(a - 0.5)); ctx.moveTo(last[0], last[1]); ctx.lineTo(last[0] - 4 * Math.cos(a + 0.5), last[1] - 4 * Math.sin(a + 0.5)); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }
    drawPoints(pane, ms.F, { primes: morphPrimes() });
    drawRulers(pane, 'R');
  }
  // the transport's readout and scrubber follow the time in every view
  // (gate v16 deform_range_fps) the play tick calls this every frame, also in Phase and Landscape alone. It reads
  // before it writes (the phone's label check measured the scrubber after the readout changed: a forced layout every
  // frame), sets the readout's Text node instead of replacing it, and while playing moves the scrubber only when its
  // thumb moves by half a pixel: on a phone each change of the page's tree or a style was a full style recalc (the
  // page's :has() rules), about 1.5 to 2 ms a frame. Paused, the scrubber shows T exactly.
  function syncTransport() {
    const sl = /** @type {HTMLInputElement} */ ($('morphRange'));
    // (a phone's transport labels, SPEC 6.6)
    const fs = /** @type {HTMLElement | null} */ (sl && sl.closest('.tscrub[data-fit="1"]'));
    if (fs) { const w = sl.getBoundingClientRect().width; if (w > 0 && w < 120) { for (const x of /** @type {NodeListOf<HTMLElement>} */ (fs.querySelectorAll('.tfix'))) x.hidden = true; delete fs.dataset.fit; } }
    syncPlaying();
    const lab = $('morphLabel');
    if (lab) setText(lab, morphReadout(lab.dataset.short === '1'));
    if (sl && document.activeElement !== sl && +sl.value !== morph.T) {
      const w = faderW.get(sl) || 0, span = (+sl.max || 1) - (+sl.min || 0) || 1;
      if (!(morph.playing && w > 0 && Math.abs(morph.T - +sl.value) * w / span < 0.5)) { sl.value = morph.T; paintFader(sl); }
    }
  }
  // (v16.5 UX103) the deformation's readout in words: "Step 1 of 3 · f₂ · 84 %", the step and its function as the ticks
  // name it (it read "t = 0.84 / 3", like a page count); t itself is in its tooltip. All at once: "All steps · 84 %"
  // ([v16.5 fix regress-1] the percentage is padded to three figures with figure spaces, so the row never reflows while
  // it plays; short: "1/2 · f₁ · 53 %", the form a tight row takes (the words stay in the tooltip), so the close button
  // keeps its place on the row and the plane keeps its height)
  function morphReadout(short) {
    const m = morphLen(), T = Math.max(0, Math.min(m, morph.T));
    if (!(m > 0)) return '';
    const pc = (v) => String(v).padStart(3, '\u2007');
    if (allAtOnce()) return short ? `${pc(Math.round(100 * T))} %` : $t('All steps at once · {p} %', { p: pc(Math.round(100 * T)) });
    const i = Math.min(m, Math.floor(T) + 1), p = Math.round(100 * (T - (i - 1))), k = morphRange().steps[i - 1];
    const f = k == null ? '' : isDeriv(k) ? 'd/dz' : 'f' + sub(k);
    return short ? `${i}/${m} · ${f} · ${pc(p)} %` : $t('Step {k} of {m} · {f} · {p} %', { k: i, m, f, p: pc(p) });
  }
  // a text that changes every frame: its Text node's data (a characterData change), never a new node (a childList change)
  function setText(el, s) {
    const t = el.firstChild;
    if (t && t.nodeType === 3 && !t.nextSibling) { if (t.data !== s) t.data = s; } else el.textContent = s;
  }
  // the transport scrubber's width (a ResizeObserver: no layout read in a frame)
  const faderW = new WeakMap();
  let faderObs = null;
  const faderRO = typeof ResizeObserver !== 'undefined' ? new ResizeObserver((es) => { for (const e of es) faderW.set(e.target, e.contentRect.width); }) : null;
  function watchFader(rng) {
    if (!faderRO) return;
    if (faderObs && faderObs !== rng) faderRO.unobserve(faderObs);
    faderObs = rng; faderRO.observe(rng);
  }
  // the colour key of X's phase portrait painted under the Y plane (the Key switch in X's legend chip): the
  // portrait of the identity in the current style, so a colour in X reads off as a value in Y
  // (one predicate for the switch and the paint: on the landscape and under Cauchy the switch hides, and the key with it)
  // (merged views: the switch sits in the Phase view's legend; the key shows under Y's plane in X → Y)
  const wKeyAvail = () => A.S.dc !== 'cauchy';
  const wKeyOn = () => !!A.S.wKey && wKeyAvail() && A.S.view.main === 'xy' && rImage();
  function keyUnder(pane) {
    return () => GLR.drawColorPlot({ map: IDENT, view: pane.view, dpr: pane.dpr, style: A.S.dc, sectors: A.S.sectors || 12, grid: dcGridStep(pane), plane: A.TH.planeRGB, ink: A.TH.inkRGB, dark: A.TH.dark, cauchy: null });
  }
  function renderRight() {
    const pane = A.paneR;
    layoutFoot(); // re-flows the options strip only when the plot width changed
    if (rGlobe()) renderSphere(pane);
    else if (morphOn()) renderMorph(pane);
    else {
      pane.setView(V.right);
      paper(pane);
      const k = rightStage();
      const F = trans.k ? transState().F : stageF(k);
      const key = wKeyOn() && GLR.ok ? { noGrid: true, under: keyUnder(pane) } : null;
      if (GLR.ok) drawScene(pane, trans.k ? transState().map : stageMap(k), trans.k ? null : 'R', Object.assign({ cache: !trans.k }, key)); else noGL(pane);
      // a transition draws its homotopy forward; the stage it ends on is drawn inverse: its program compiles meanwhile
      // (after the chain's forward programs), so the last frame is exact instead of a forward stand-in (P2 review)
      if (trans.k && GLR.ok) requestInverseFor(stageMap(k));
      // ([#253] the shapes of a later plane: their preimages in this one)
      if (!trans.k && GLR.ok) stagePullbacks(pane, k);
      // the w-plane targets: fills (a pass of the preimage shader with the identity map), outlines, points
      if (hasTargets()) {
        const areas = preimageTargets(true);
        if (!drawPullback(pane, IDENT, areas)) fillTargets2D(pane, areas);
        strokeTargets(pane);
      }
      // (the image of X's view rectangle: only X Plane has one; the globe shows all of X, the landscape a trimmed box)
      if (A.S.fov !== false && !trans.k && !trans.glide && lFlat()) drawFov(pane, focusF());
      if (!trans.k) drawCutBanks(pane, k);
      drawChevrons(pane, F, trans.k ? undefined : k);
      if (A.S.focus > 0) drawCuts(pane, k, false, true);
      drawPoints(pane, F, { primes: k, k: trans.k ? undefined : k });
      if (!trans.k) { updatePre('R', pane, k); drawPre(pane, 'R', k); }
      if (hasTargets()) drawPoints(pane, (z) => z, { list: A.S.targets, target: true });
      drawRulers(pane, 'R');
    }
    if (morph.open) syncTransport();
    const er = $('emptyRight');
    if (er) {
      const show = !A.S.steps.length && rImage();
      if (show && !er.firstChild) er.append(h('span', null, $t('Add a function to map the region')), h('button', { class: 'btn primary small', 'data-tip': $t('Add a function to map the region'), onclick: (e) => openPalette(e.currentTarget, A.S.steps.length, { fnOnly: true }) }, $t('Add function')));
      // (v16.5 UX20: in Y's head the title is fitted with the button in place, so its role is whole, short or gone)
      if (er.hidden === show) { er.hidden = !show; if (er.parentNode && /** @type {HTMLElement} */ (er.parentNode).classList.contains('pane-head')) fitTitle('R'); }
    }
    updateCalcChip();
  }

  function init(api) {
    A = api;
    ({ C, IDENT, MF, PATHS, SegGrid, V, activeSteps, allAtOnce, arcOf, cap1, capT, captionLatex, cmFormAnchor, compositeTexShort, dcGridStep, drawChevrons, drawCutBanks, drawCuts, drawFov, drawPoints, drawPullback, drawRulers, drawScene, fillTargets2D, fitTitle, focusF, hasTargets, homRangeOk, isDeriv, joinList, kindType, lFlat, layoutFoot, lenPx, mDist, mapKeyOf, mfCache, morph, morphHasDeriv, morphLen, morphOn, morphOutline, morphPrimes, morphRange, morphSelScreen, morphState, morphX, nSteps, noGL, openPalette, paintFader, paper, patternSegs, preimageTargets, stagePullbacks, updatePre, drawPre, rGlobe, rImage, rangeParts, renderSphere, requestInverseFor, requestRender, resamplePx, rightStage, segD, shapeGPU, shapeInk, shapePhrase, sheetsShown, stageF, stageMap, strokeTargets, sub, syncPlaying, trans, transState, tweens, updateCalcChip } = api);
  }
  return { init, pathMarkTimes, pathsGen, retraceShare, pathRetrace, drawMorphPathsX, pathsSvg, morphFigureLayers, texSegs, inlineFrac, rangeTex, wDefSegs, morphHomSegs, pathTimesTex, pathMarksTex, morphCaption, morphAt, syncTransport, morphReadout, setText, watchFader, wKeyAvail, wKeyOn, renderRight };
})();
import { $, DEG, TAU, h } from './util.js';
import { CX } from './cx.js';
import { Region } from './region.js';
import { GLR } from './gl.js';
export { MorphPaths };
