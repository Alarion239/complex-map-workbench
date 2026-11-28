'use strict';
// The deformation's paths t -> H_t(z) (notes/paths-aesthetics/AS-BUILT.md):
// evenly spaced paths seeded from X's boundary, traced and drawn on the planes and the globes, with their arrows,
// marks and the transport's fader. The app hands it what it needs once, MorphPaths.init(api) at start-up
// (src/app/06-deformation.js, morphPathsApi): its functions and constants as they are, and the state it reassigns
// (S, morph's companions, ...) as getters on api, read as A.S and so on.
const MorphPaths = (() => {
  let A = null;
  let C, PATHS, SegGrid, allAtOnce, capT,
    kindType, classicSource, lenPx, mDist, mfCache, morph, morphOutline, morphRange, morphState, morphX,
    requestRender, resamplePx, segD;
  // the times of a path's marks: one step (or all at once) has its arrowhead at m/2 (and, in the figure only, where the
  // caption explains them, dots at m/4 and 3m/4); steps one after another have an arrowhead in the middle of each step
  // (t = k - 1/2: never on the corner where the steps meet) and a bar across the path at each step's end inside the
  // range (t = k), so a corner reads as "the step changes here". seq: steps one after another (default: the classic
  // transport's, classicSeq)
  const classicSeq = () => !allAtOnce() && morphRange().steps.length >= 2;
  function pathMarkTimes(Tend, seq = classicSeq()) {
    if (!seq) return { arrows: [0.5 * Tend], dots: [0.25 * Tend, 0.75 * Tend], nodes: [], seq: false };
    const arrows = [], nodes = [];
    for (let k = 1; k - 0.5 < Tend + 1e-9; k++) arrows.push(k - 0.5);
    for (let k = 1; k < Tend - 1e-9; k++) nodes.push(k);
    if (!arrows.length) arrows.push(0.5 * Tend);
    return { arrows, dots: [], nodes, seq: true };
  }
  // a path's start in the plane: z -> H_0(z), the point where t -> H_t(z) begins (z itself when the source's H_0 is the
  // identity, src.startId), or null where H_0(z) is not finite. The choice spaces its seeds at their starts (pathsGen),
  // and a kept choice is tested where its starts are (the flat pane's view check mfViewOk, the globe's epoch
  // morphSelGlobe), all by this one rule. (src: a deformation source, classicSource or svPathsSource; Fat: its H_T,
  // pathsGen's cached one)
  function startOf(src, Fat = src.Fat) {
    const H0 = src.startId ? null : Fat(0);
    return (z) => { const w = H0 ? H0(z) : z; return w && CX.isFin(w) ? w : null; };
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
  function pathMarksW(z, Fat, Tend, seq) {
    const at = (T) => { const w = Fat(T)(z); return w && CX.isFin(w) ? w : null; };
    const h = Tend / 512, mt = pathMarkTimes(Tend, seq);
    const dirAt = (T) => ({ T, w: at(T), a: at(Math.max(0, T - h)), b: at(Math.min(Tend, T + h)) });
    return { z: at(0), e: at(Tend), arrows: mt.arrows.map(dirAt), nodes: mt.nodes.map(dirAt), dots: mt.dots.map((T) => ({ T, w: at(T) })), seq: mt.seq };
  }
  // the selection (a generator: it yields between candidates, so it runs in slices off the frame;
  // runGenSliced). P maps the plane to px (null where a point is not shown: the globe's far side and limb), box is the
  // panel (px), win its world window. opt: scale (the spacings' factor), footPx, nogo (px rectangles to keep clear),
  // maxN, globe, fig (the exported figure: stricter about the frame and the picture's lines), src (the deformation
  // source, classicSource or svPathsSource: H_T as Fat(T), whether H_0 is the identity, the marks' order; default
  // classicSource()).
  // Every path is traced whole
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
    const src = opt.src || classicSource();
    const Fat = (T) => { let f = Fc.get(T); if (!f) { f = src.Fat(T); Fc.set(T, f); } return f; };
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
    // (notes/deform-range/SPEC.md 5.2, D6: when the source's H_0 is not the identity (src.startId false: in the classic
    // transport a bracket's pre or post or a focused step k > 1, in the steps view a run that starts past plane z), the
    // seeds are spaced at their starts H_0(z) in the plane, not at z: the boundary mapped through H_0, and a z-grid
    // binned by the screen point of H_0(z). With H_0 = id, the seeds are spaced at z, below)
    const startId = src.startId;
    if (!startId) {
      const start = startOf(src, Fat);
      for (const o of outline) {
        if (X.areas.length && kindType(o.s) !== 'area') continue;
        let prev = null, rem = 0;
        for (let i = 0; i < o.l.length; i++) {
          const q = o.l[i], z = C(q[0], q[1]), w = start(z), pp = w ? P(w) : null;
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
            const w = start(z);
            if (!w) continue;
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
    const mt = pathMarkTimes(Tend, src.seq);
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
          // (the score in whole micro-px, so candidates that tie but for rounding (1e-14 px, a
          // homotopy's end exact or not, another browser's Math) tie exactly, and the first in the seeds' fixed order
          // wins, as in an exact tie)
          const scq = Math.round(sc * 1e6) / 1e6;
          if (scq > bs) { bs = scq; best = c; }
        }
        if (!best) break;
        if (test(best, d, nX)) keepC(best); else { best.dead = 2; no('spacing'); }
        if (++it % 3 === 0) yield;
      }
    }
    for (const c of kept) { c.mk = pathMarksW(c.sp.z, Fat, Tend, src.seq); pathFlat(c); }
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
  function pathRetrace(k, Fat, Tend, P, N, seq) {
    const runs = traceRuns(k.sp.z, Fat, Tend, P, N);
    return runs.length ? pathFlat({ sp: k.sp, runs, mk: pathMarksW(k.sp.z, Fat, Tend, seq) }) : null;
  }
  // On screen (the merged plane; the globe with P its projection, null on the far side, where the run splits): the
  // travelled part 0 -> T in ink on a halo of the plane's colour (light and dark), the open ring at z, the marks the
  // moving point has passed (the arrowhead, one per step one after another, on paths of PATHS.arrowMin px or more; a
  // bar where steps meet; no time dots: the live view has no caption to explain them) and the moving point H_T(z), a
  // filled dot; a small open chevron where a path leaves the view or comes into it, and where it goes behind the
  // globe's limb. Nothing ahead of the moving point: rest and motion look alike. A path whose start has left the view
  // (a pan or a scrub's auto-fit) stays, clipped, with the chevron where it comes in, until the next choice (verify fix
  // path-3: it vanished at once). o.fade scales the opacity (the cross-fade between two sets, drawMorphPathsX); o.hook
  // false leaves the test hook's record alone; o.T the time drawn to (default the classic transport's).
  function drawMorphPaths(pane, sel, F, P = null, o = {}) {
    if (!sel || !sel.kept.length) return;
    const fade = o.fade == null ? 1 : o.fade;
    if (!(fade > 0.01)) return;
    const flat = !P;
    if (flat) P = (w) => pane.w2s(w);
    const ctx = pane.ctx, T = o.T == null ? morph.T : o.T, W = pane.w, Hh = pane.h;
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
    else if (o.hook !== false) A.mfGlobeDrawn = { T, heads: heads.length };
  }
  // the live paths with the cross-fade between two sets (a new choice after a pan, a zoom or an
  // orbit swapped the whole set in one frame): for PATHS.fade ms after a choice replaced a set under the same chain and
  // shapes, the old set fades out while the new one fades in
  // o: { T, side } (the time drawn to and the pane to redraw, default the classic transport's and 'R')
  function drawMorphPathsX(pane, sel, F, P = null, o = {}) {
    const pv = mfCache.prev;
    let u = 1;
    if (pv && pv.next === sel) {
      u = Math.min(1, (performance.now() - pv.t0) / PATHS.fade);
      if (u < 1) { drawMorphPaths(pane, pv.sel, F, P, { fade: 1 - u, hook: false, T: o.T }); requestRender(o.side || 'R'); } else mfCache.prev = null;
    }
    drawMorphPaths(pane, sel, F, P, { fade: u, T: o.T });
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
  // the times of a path's marks, m/4, m/2 and 3m/4, as TeX: a reduced fraction when m is whole (1/4, 3/2), else a number
  const pathTimesTex = (Tend) => [1, 2, 3].map((j) => {
    if (Math.abs(Tend - Math.round(Tend)) > 1e-9) return I18N.texNum(CX.fmtNum(Tend * j / 4, 3));
    let n = Math.round(Tend) * j, d = 4;
    while (n % 2 === 0 && d > 1) { n /= 2; d /= 2; }
    return d === 1 ? String(n) : `${n}/${d}`;
  });
  // the kept paths' starts counted by kind, as a phrase: "2 boundary points and 1 marked point"
  function keptParts(sel) {
    const nb = sel.kept.filter((k) => k.sp.kind === 'corner' || k.sp.kind === 'edge').length;
    const ni = sel.kept.filter((k) => k.sp.kind === 'node').length;
    const np = sel.kept.filter((k) => k.sp.kind === 'point').length;
    const parts = [];
    if (nb) parts.push($tn('{n} boundary point', '{n} boundary points', nb));
    if (ni) parts.push($tn('{n} interior point', '{n} interior points', ni));
    if (np) parts.push($tn('{n} marked point', '{n} marked points', np));
    return parts.length > 1 ? parts.slice(0, -1).join(', ') + $tx('list', ' and ') + parts[parts.length - 1] : parts[0];
  }
  // the sentence naming the paths of one step (the steps view's paths figure): from z (circle) to end (dot), small dots
  // at a quarter and three quarters of the way and an arrowhead in the middle
  function pathsSentence(sel, Tend, { z, end }) {
    if (!sel.kept.length) return [];
    const q = pathTimesTex(Tend).map((x) => ({ m: `t=${x}` }));
    return capT(' Curves are the paths %{p} of %{parts}, from %{z} (circle) to %{end} (dot), with small dots at %{q1} and %{q3} and an arrowhead at %{q2}.', { p: { m: 't\\mapsto H_t(z)' }, parts: keptParts(sel), z: { m: z }, end: { m: end }, q1: q[0], q2: q[1], q3: q[2] });
  }
  // CPU homotopy at any time T (for trails)
  function morphAt(T) {
    const saved = morph.T;
    morph.T = T;
    const ms = morphState(false);
    morph.T = saved;
    return ms.F;
  }
  function init(api) {
    A = api;
    ({ C, PATHS, SegGrid, allAtOnce, capT, kindType, classicSource, lenPx, mDist, mfCache, morph, morphOutline, morphRange, morphState, morphX, requestRender, resamplePx, segD } = api);
  }
  return { init, pathMarkTimes, pathsGen, startOf, retraceShare, pathRetrace, drawMorphPathsX, pathsSvg, texSegs, inlineFrac, pathsSentence, morphAt };
})();
import { DEG, TAU } from './util.js';
import { CX } from './cx.js';
import { Region } from './region.js';
export { MorphPaths };
