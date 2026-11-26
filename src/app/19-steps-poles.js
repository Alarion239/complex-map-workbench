  // ---------------- the glide's pole tracks (a part of the steps view: the sheet key mid-glide, svSheetKeyAt, reads them) ----------------
  // The poles are tracked once per glide (the plane and the chain up to it, the windows), in idle moments: SV_POLE_K
  // steps of t, found on a grid over the camera's window (a quarter wider each side, SV_POLE_GRID cells a side) and on a
  // coarser one over the key's window widened by three times its size on each side, at t = 0 and every SV_POLE_SEED
  // steps; each followed from step to step by Newton's method on 1/F (or, where it leaves through a cut, by svPeakAt
  // while the points beside it go past 4 R), and read between two steps by linear interpolation, so the key moves
  // continuously with t. The search is a generator that pauses every SV_POLE_CHUNK evaluations of the map, so a slice of
  // it stops at SV_POLE_BUDGET ms whatever step it is in
  const SV_POLE_K = 64, SV_POLE_SEED = 8, SV_POLE_GRID = 24, SV_POLE_MAX = 8, SV_POLE_TOP = 8;
  const SV_POLE_CHUNK = 16, SV_POLE_BUDGET = 2;
  const svPoleMemo = new Map(), svPoleLast = new Map();
  // a pause of a search: once SV_POLE_CHUNK evaluations (E.n, counted by the map P.Ft gives) ran since the last. The
  // searches may pause at the start of each Newton or peak climb and of each grid, after each of their iterations and
  // every 8 points of a grid, so at most SV_POLE_CHUNK - 1 plus a peak climb's first 9 evaluations run between two
  // pauses: a slice ends within a few evaluations of its time (a map such as zeta's takes tens of µs each)
  function* svPoleTick(E) {
    if (E.n - E.at >= SV_POLE_CHUNK) { E.at = E.n; yield; }
  }
  // a search run to its end at once, through all its pauses: its result
  function svDrain(gen) {
    let r;
    do r = gen.next(); while (!r.done);
    return r.value;
  }
  // Newton's method on h = 1/F from z: a pole of F (h(z) = 0, |F| past 1e8) or null (it left the box or did not settle)
  function* svPoleAt(F, z, box, E) {
    const h = (p) => { const w = F(p); return w && CX.isFin(w) && !CX.isZero(w) ? CX.inv(w) : null; };
    yield* svPoleTick(E);
    for (let i = 0; i < 12; i++) {
      const e = 1e-6 * (1 + CX.abs(z)), h0 = h(z);
      if (!h0) return null;
      if (CX.abs(h0) < 1e-8) return z;
      const hp = h(CX.add(z, C(e, 0))), hm = h(CX.sub(z, C(e, 0)));
      if (!hp || !hm) return null;
      const d = CX.div(CX.sub(hp, hm), C(2 * e, 0));
      if (!CX.isFin(d) || CX.isZero(d)) return null;
      z = CX.sub(z, CX.div(h0, d));
      if (!CX.isFin(z) || z.re < box.x0 || z.re > box.x1 || z.im < box.y0 || z.im > box.y1) return null;
      yield* svPoleTick(E);
    }
    return null;
  }
  // where a pole leaves through a cut (the map continues past it on another branch): from z, the nearest local maximum
  // of |F| (climbing over 8 points about it, its step shrinking), while |F| there is past big; null otherwise. A
  // pole's track continues through it while the points beside it still go far, so the key does not lose it a step of
  // t before it reaches the cut (or gain it a step after)
  function* svPeakAt(F, z, big, E) {
    const m = (p) => { try { const w = F(p); return w && CX.isFin(w) ? CX.abs(w) : Infinity; } catch (e) { return 0; } };
    yield* svPoleTick(E);
    let v = m(z), h = 0.05 * (1 + CX.abs(z));
    for (let i = 0; i < 40 && h > 1e-7 * (1 + CX.abs(z)); i++) {
      let best = null, bv = v;
      for (let a = 0; a < 8; a++) { const p = CX.add(z, C(h * Math.cos(a * Math.PI / 4), h * Math.sin(a * Math.PI / 4))), u = m(p); if (u > bv) { bv = u; best = p; } }
      if (best) { z = best; v = bv; } else h /= 2;
      yield* svPoleTick(E);
    }
    return v > big && v < Infinity ? z : null;
  }
  // a point where F is unbounded without being a pole (the logarithm at 0, a root at a pole of its Möbius step: Newton's
  // method on 1/F reflects about it or crawls): z itself when F is not finite there, else the nearest peak of |F| from z
  // when it is past big and within box; null otherwise (a map that only grows, exp's, has its peak climbed out of the box)
  function* svSingularAt(F, z, big, E, box) {
    let w = null;
    try { w = F(z); } catch (e) { w = null; }
    if (!w || !CX.isFin(w)) return z;
    const p = yield* svPeakAt(F, z, big, E);
    return p && p.re >= box.x0 && p.re <= box.x1 && p.im >= box.y0 && p.im <= box.y1 ? p : null;
  }
  const SV_SING_BIG = 10;
  // svSingNewton's limits: at most SV_SING_ITERS Newton steps, each reading u again at most SV_SING_REREAD times; a
  // point is kept only where |F| at SV_SING_R (1 + |z|) from it is past big at each of four points, and grows towards it
  // by more than SV_SING_GROW from ten times as far (|F| ~ r^-a grows by 10^a: a root's a is at least about 0.2 where |F|
  // at that distance is past SV_SING_BIG, and a bounded branch point, 20 + √z at 0, does not grow); the four points are
  // turned SV_SING_TURN from the axes, so that a cut along an axis does not take one
  const SV_SING_ITERS = 16, SV_SING_R = 1e-6, SV_SING_GROW = 10 ** 0.1, SV_SING_TURN = 0.3, SV_SING_REREAD = 4;
  const SV_SING_OFF = [0.27, 0.31];   // svPolesIn's start for svSingNewton: this share of a cell off its grid point, on neither line
  // a point where F is unbounded without being a pole, from z, by Newton's method on u = h/h' (h = 1/F): u has a simple
  // zero where h has a zero of any order, a pole's (order 1) or a root's (|F| ~ |z - p|^-a, 0 < a < 1, where Newton's
  // method on h reflects about p or crawls). It is the point Newton's method settles on (u or its step under 1e-12 or
  // 1e-11 of 1 + |z|), within box, where |F| next to it is past big and grows towards it; null otherwise: a start that
  // does not settle (Newton on u reflects where u's zero is not simple, as exp(√z)'s u = -2√z sends z to -z), that
  // leaves the box, or that settles on no such point (a zero of h' alone)
  function* svSingNewton(F, z, box, big, E) {
    const h = (p) => { let w = null; try { w = F(p); } catch (e) { w = null; } return !w ? null : CX.isFin(w) ? (CX.isZero(w) ? null : CX.inv(w)) : C(0, 0); };
    const u = (p, e) => {
      const h0 = h(p), hp = h(CX.add(p, C(e, 0))), hm = h(CX.sub(p, C(e, 0)));
      if (!h0 || !hp || !hm) return null;
      const d = CX.div(CX.sub(hp, hm), C(2 * e, 0));
      return CX.isZero(h0) ? C(0, 0) : CX.isFin(d) && !CX.isZero(d) ? CX.div(h0, d) : null;
    };
    yield* svPoleTick(E);
    let gap = Infinity, settled = false;
    for (let i = 0; i < SV_SING_ITERS && !settled; i++) {
      // (the differences' step: a hundredth of the distance u gives, at most 1e-6 (1 + |z|) and at least 1e-14 (1 + |z|),
      // where float64 differences still resolve: steps that straddle the point, or the cut through it, would read the
      // difference across it. It is first the last step's distance; where u read with it says the point is nearer than
      // that (a Newton step lands much nearer the point, and so nearer its cut, than the step before was long), u is read
      // again with steps of a hundredth of its own distance, up to SV_SING_REREAD times, until they are)
      const s = CX.abs(z), lo = 1e-14 * (1 + s);
      let e = Math.max(lo, Math.min(1e-6 * (1 + s), gap / 100)), u0 = u(z, e);
      for (let k = 0; k < SV_SING_REREAD && u0 && CX.abs(u0) / 100 < e && e > lo; k++) { e = Math.max(lo, CX.abs(u0) / 100); u0 = u(z, e); }
      if (!u0) return null;
      if (CX.abs(u0) < 1e-12 * (1 + s)) { settled = true; break; }
      // (a step more than twice the last: Newton's method moving away from the zero, not towards it)
      if (CX.abs(u0) > 2 * gap) return null;
      gap = CX.abs(u0);
      const up = u(CX.add(z, C(e, 0)), e), um = u(CX.sub(z, C(e, 0)), e);
      if (!up || !um) return null;
      const d = CX.div(CX.sub(up, um), C(2 * e, 0));
      if (!CX.isFin(d) || CX.isZero(d)) return null;
      const step = CX.div(u0, d);
      z = CX.sub(z, step);
      if (!CX.isFin(z) || z.re < box.x0 || z.re > box.x1 || z.im < box.y0 || z.im > box.y1) return null;
      yield* svPoleTick(E);
      if (CX.abs(step) < 1e-11 * (1 + s)) settled = true;
    }
    if (!settled) return null;
    const m = (p) => { let w = null; try { w = F(p); } catch (e) { w = null; } return !w ? null : CX.isFin(w) ? CX.abs(w) : Infinity; };
    const r = SV_SING_R * (1 + CX.abs(z));
    for (let a = 0; a < 4; a++) {
      const c = Math.cos(a * Math.PI / 2 + SV_SING_TURN), sn = Math.sin(a * Math.PI / 2 + SV_SING_TURN);
      const near = m(CX.add(z, C(r * c, r * sn))), far = m(CX.add(z, C(10 * r * c, 10 * r * sn)));
      if (near == null || far == null || !(near > big) || (near < Infinity && !(near > SV_SING_GROW * far))) return null;
    }
    return z;
  }
  // the poles of F in box: the local maxima of |F| on an n x n grid over it, each refined (kept while within lim); with
  // sing, a start Newton's method does not settle on is refined to its singular point: where |F| there is past
  // SV_SING_BIG, by its nearest peak of |F|; else (and where that finds none) by svSingNewton, which finds a root's
  // point (√ of a Möbius step at its pole) from a grid whose |F| next to it is small
  function* svPolesIn(F, box, n, lim, E, sing = false) {
    const dx = (box.x1 - box.x0) / n, dy = (box.y1 - box.y0) / n, M = [];
    yield* svPoleTick(E);
    for (let j = 0; j <= n; j++) {
      for (let i = 0; i <= n; i++) {
        let w = null;
        try { w = F(C(box.x0 + i * dx, box.y0 + j * dy)); } catch (e) { w = null; }
        M.push(w && CX.isFin(w) ? CX.abs(w) : Infinity);
        if (i % 8 === 7) yield* svPoleTick(E);
      }
      yield* svPoleTick(E);
    }
    // (the starts: the grid's local maxima of |F|, and its SV_POLE_TOP points of the largest |F| / (1 + |z - c|), c the
    // box's centre: a map that grows like z far out hides a pole's maximum from a coarse grid, not its ratio)
    const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2, at = (i, j) => C(box.x0 + i * dx, box.y0 + j * dy);
    const starts = [], ratio = [];
    for (let j = 1; j < n; j++) for (let i = 1; i < n; i++) {
      const m = M[j * (n + 1) + i];
      ratio.push([m / (1 + Math.hypot(box.x0 + i * dx - cx, box.y0 + j * dy - cy)), i, j]);
      let top = true;
      for (let b = -1; b <= 1 && top; b++) for (let a = -1; a <= 1; a++) if ((a || b) && M[(j + b) * (n + 1) + i + a] > m) { top = false; break; }
      if (top) starts.push([i, j]);
    }
    ratio.sort((u, v) => v[0] - u[0]);
    for (const [, i, j] of ratio.slice(0, SV_POLE_TOP)) if (!starts.some(([a, b]) => a === i && b === j)) starts.push([i, j]);
    const out = [];
    for (const [i, j] of starts) {
      let p = yield* svPoleAt(F, at(i, j), lim, E);
      if (!p && sing && !(M[j * (n + 1) + i] < SV_SING_BIG)) p = yield* svSingularAt(F, at(i, j), SV_SING_BIG, E, lim);
      // (svSingNewton starts SV_SING_OFF of a cell off the grid's point: a root's cut through a Möbius step's pole runs
      // along a grid line where the pole is on an axis (the dipole's), and a start on it reads differences across it)
      if (!p && sing) p = yield* svSingNewton(F, C(box.x0 + (i + SV_SING_OFF[0]) * dx, box.y0 + (j + SV_SING_OFF[1]) * dy), lim, SV_SING_BIG, E);
      if (p && !out.some((q) => CX.abs(CX.sub(p, q)) < 1e-6 * (1 + CX.abs(p)))) out.push(p);
    }
    return out;
  }
  // a seed step's search for P's map F: svPolesIn over the camera's window and the coarse box, the SV_POLE_MAX nearest
  // the key's window's centre
  function* svPolesNear(F, P) {
    const fine = yield* svPolesIn(F, P.win, SV_POLE_GRID, P.box, P.E), coarse = yield* svPolesIn(F, P.box, SV_POLE_GRID / 2, P.box, P.E);
    return fine.concat(coarse).sort((p, q) => CX.abs(CX.sub(p, P.cz)) - CX.abs(CX.sub(q, P.cz))).slice(0, SV_POLE_MAX);
  }
  // the tracks of the glide's poles to plane b for the window w: {tr: [[z or null] x (SV_POLE_K + 1)], k: the next
  // step of t to make}, made by svPoleGen. Keyed by the chain up to plane b (the glide's map is h_{b,t} after the steps
  // before b): an edit after plane b keeps them
  function svPoleTracks(b, w) {
    // (the fine grid over the camera's window, what the view shows, a quarter wider each side: clipWin, kept while the
    // view stays inside it, can be many times larger after a zoom out and back, and its grid's cells too coarse to have
    // a point by a pole that has just come out of a cut)
    const v = S.srcView, hw = 0.75 * paneL.w / v.s, hh = 0.75 * paneL.h / v.s, cam = { x0: v.cx - hw, x1: v.cx + hw, y0: v.cy - hh, y1: v.cy + hh };
    const key = [b, chainSig[b], w.x0, w.x1, w.y0, w.y1, cam.x0, cam.x1, cam.y0, cam.y1].join('|');
    if (svPoleMemo.has(key)) return svPoleMemo.get(key);
    const ex = (f) => ({ x0: w.x0 - f * (w.x1 - w.x0), x1: w.x1 + f * (w.x1 - w.x0), y0: w.y0 - f * (w.y1 - w.y0), y1: w.y1 + f * (w.y1 - w.y0) });
    const Fp = stageF(b - 1), E = { n: 0, at: 0 };
    const P = { key, b, sig: chainSig[b], tr: [], k: 0, gen: null, found: null, seek: null, E, box: ex(3), win: cam, big: 4 * Math.hypot(w.x1 - w.x0, w.y1 - w.y0) / 2, cz: C((w.x0 + w.x1) / 2, (w.y0 + w.y1) / 2),
      Ft: (t) => { const H = homF(b, t); return (z) => { E.n++; return H(Fp(z)); }; } };
    if (svPoleMemo.size >= 16) svPoleMemo.clear();
    svPoleMemo.set(key, P);
    return P;
  }
  // P's tracks, step by step of t: each track followed from the step before; at a seed step the poles found there, each
  // new one back-tracked, and a track lost near one bridged to it. A seed step can find a pole the grid missed before (a
  // grid has no point near one that has just come out of a cut), and its back-track changes earlier steps: the tracks
  // are final only once every step is made (P.k past SV_POLE_K). A map that throws leaves no tracks
  function* svPoleGen(P) {
    const { tr, box, big, Ft, E } = P;
    try {
      for (let k = P.k; k <= SV_POLE_K; k++) {
        const F = Ft(k / SV_POLE_K);
        for (const r of tr) r[k] = r[k - 1] ? (yield* svPoleAt(F, r[k - 1], box, E)) || (yield* svPeakAt(F, r[k - 1], big, E)) : null;
        if (k % SV_POLE_SEED === 0) {
          const near = yield* svPolesNear(F, P);
          for (const p of near) {
            if (tr.some((r) => r[k] && CX.abs(CX.sub(r[k], p)) < 1e-6 * (1 + CX.abs(p)))) continue;
            // (a track lost near p is p's: the steps between are bridged on the line from there to p, so the key keeps the
            // pole through them, never dropping it for a step and taking it back)
            const last = (r) => r.findLastIndex((q, i) => q && i < k);
            const old = tr.find((r) => { if (r[k]) return false; const j = last(r); return j >= 0 && CX.abs(CX.sub(r[j], p)) < 0.25 * (1 + CX.abs(p)); });
            if (old) {
              const j = last(old);
              for (let i = j + 1; i <= k; i++) old[i] = CX.add(old[j], CX.mul(C((i - j) / (k - j), 0), CX.sub(p, old[j])));
              continue;
            }
            const r = new Array(SV_POLE_K + 1).fill(null);
            r[k] = p;
            // (and back to where it came into the box, or out of a cut: a pole a seed step finds has its track at the steps before it too)
            for (let j = k - 1; j >= 0 && r[j + 1]; j--) { const G = Ft(j / SV_POLE_K); r[j] = (yield* svPoleAt(G, r[j + 1], box, E)) || (yield* svPeakAt(G, r[j + 1], big, E)); }
            tr.push(r);
          }
        }
        P.k = k + 1;
      }
    } catch (e) { tr.length = 0; P.k = SV_POLE_K + 1; }
  }
  // gen run for at most ms (checked at its pauses): its last result ({done, value}). kind 'idle' or 'frame': counted in
  // __svPathStats where a measurement sets that object (the slices, the longest slice's ms, the most evaluations
  // between two pauses, and the idle slices' steps of t made)
  function svPoleRun(gen, E, ms, kind, P) {
    const t0 = performance.now(), k0 = P ? P.k : 0;
    let r, most = 0;
    for (;;) {
      const n0 = E.n;
      r = gen.next();
      most = Math.max(most, E.n - n0);
      if (r.done || performance.now() - t0 >= ms) break;
    }
    const ps = globalThis.__svPathStats, dt = performance.now() - t0;
    if (ps && kind) {
      const K = kind === 'idle' ? 'poleIdle' : 'poleFrame';
      ps[K] = (ps[K] || 0) + 1;
      ps[K + 'Max'] = Math.max(ps[K + 'Max'] || 0, dt);
      if (P) ps[K + 'Steps'] = (ps[K + 'Steps'] || 0) + P.k - k0;
      ps.poleChunk = Math.max(ps.poleChunk || 0, most);
    }
    return r;
  }
  // every glide's pole tracks forgotten, as right after load (a test hook's)
  function svDropTracks() { svPoleMemo.clear(); svPoleLast.clear(); svPolesWatch(); }
  // P's tracks made for at most ms; once whole, they are plane b's last whole tracks (svPoleLast)
  function svPoleMake(P, ms, kind) {
    if (P.k > SV_POLE_K) return;
    if (!P.gen) P.gen = svPoleGen(P);
    svPoleRun(P.gen, P.E, ms, kind, P);
    if (P.k > SV_POLE_K) svPoleLast.set(P.b, P);
  }
  // the poles near t of P's map while its tracks are not whole: a seed step's search at the tracks' seed step nearest t
  // (at most SV_POLE_K / SV_POLE_SEED + 1 searches a glide, those the whole tracks make anyway), SV_POLE_BUDGET ms of it
  // a frame, kept while t stays nearest it; until it is done, the last one done (none at first). Its frames' time is
  // counted in __svPathStats.poleSyncMs, its searches in poleSync, where a measurement sets that object
  function svPolesNow(P, t) {
    const j = Math.min(SV_POLE_K, Math.round(t * SV_POLE_K / SV_POLE_SEED) * SV_POLE_SEED);
    if (P.found && P.found.j === j) return P.found.poles;
    const ps = globalThis.__svPathStats, t0 = performance.now();
    if (!P.seek || P.seek.j !== j) {
      P.seek = { j, gen: (function* () { try { return yield* svPolesNear(P.Ft(j / SV_POLE_K), P); } catch (e) { return []; } })() };
      if (ps) ps.poleSync = (ps.poleSync || 0) + 1;
    }
    const r = svPoleRun(P.seek.gen, P.E, SV.poleFrameMs || SV_POLE_BUDGET, 'frame', null);
    if (r.done) { P.found = { j, poles: r.value }; P.seek = null; }
    if (ps) ps.poleSyncMs = (ps.poleSyncMs || 0) + performance.now() - t0;
    return P.found ? P.found.poles : [];
  }
  // svHoldB: plane b when the left pane's last frame held the glide into b for its missing tracks (svLinkHold), else 0: each
  // frame starts it at 0 (svDrawPlane), so a frame at rest, on the globe or of the classic core leaves no hold behind, and
  // the idle job (svPolesAhead) sets it to 0, and asks for a frame, once plane b's tracks are whole
  let svHoldB = 0;
  // how many things the last frame svHolds tested waits for: its inverse paths still linking, the carried meshes, the Cauchy style's
  // carried programs, and the pole tracks (one); 0 when the frame need not wait. A hold's ring is the share of it that has gone
  let svHoldLeft = 0;
  // the first glide whose tracks for the current windows are not whole, null when all are (the key's window is clipWin,
  // as svSheetKey gives it, without its singular points)
  // (the glide held by svLinkHold for its missing tracks comes first)
  function svPolesLeft() {
    const n = nSteps();
    for (const b of svHoldB ? [svHoldB] : []) if (b <= n && !derivIn(b - 1, b)) { const P = svPoleTracks(b, clipWin); if (P.k <= SV_POLE_K) return P; }
    for (let b = 1; b <= n; b++) {
      if (derivIn(b - 1, b) || svGlideEntire(b)) continue;
      const P = svPoleTracks(b, clipWin);
      if (P.k <= SV_POLE_K) return P;
    }
    return null;
  }
  // Whether the glide into plane b moves through entire maps alone, so its map h_{b,t} after the steps before b has no
  // pole at any t: step b is a polynomial step, whose homotopy has none (Inverse.polyHom: a root power, a zoom, or a
  // polynomial in u inverted by every root, NEWT with deg), and each active step before b is entire. Its frames' key then takes no pole tracks (svSheetKeyAt),
  // none are made for it (svPolesLeft), and its glide never waits for them (svTracksMissing)
  function svGlideEntire(b) {
    if (isDeriv(b) || !Inverse.polyHom(built[b - 1])) return false;
    for (let k = 1; k < b; k++) if (stepActive(k) && (isDeriv(k) || !(built[k - 1] && built[k - 1].props && built[k - 1].props.entire))) return false;
    return true;
  }
  // The pole tracks the frames of the glide into plane b are drawn from, while they are not made (null otherwise): its
  // inverse paths h have a Newton member (the poles it needs are plane b's tracks') and neither these tracks nor plane b's
  // last whole ones (svSheetKeyAt) exist. A glide through entire maps alone has none to wait for (svGlideEntire)
  function svTracksMissing(b, h) {
    if (svGlideEntire(b) || !(h && h.paths.some((p) => p.plan.ops.some((o) => o.kind === 'NEWT')))) return null;
    const P = svPoleTracks(b, svSheetKey(b).win), L = svPoleLast.get(b);
    return P.k <= SV_POLE_K && !(L && L.sig === chainSig[b]) ? P : null;
  }
  // The idle job: every glide's pole tracks for the current windows, then the outer ring's sizes of the glides beside
  // the plane and of the chain's other glides, nearest first, with their meshes, as far as the caches take them (svRingAhead, svRingNext),
  // SV_POLE_BUDGET ms an idle moment at most, so a glide finds them made. One job at a time (svPoleJob, its token: a
  // new one ends the one before); it reads its inputs (the chain, clipWin, the camera) afresh each slice, and
  // svPolesWatch starts it again once they change after it ended
  let svPoleJob = 0, svPoleBusy = false;
  function svPolesAhead() {
    const tok = ++svPoleJob;
    svPoleBusy = true;
    const ric = window.requestIdleCallback, idle = (f) => (ric ? ric.call(window, f, { timeout: 2000 }) : setTimeout(() => f(null), 100));
    const next = (dl) => {
      if (tok !== svPoleJob) return;
      const t0 = performance.now();
      // (a callback the browser ran for its timeout, not in an idle moment, has no time remaining and still runs one slice)
      const left = () => Math.min(SV_POLE_BUDGET - (performance.now() - t0), dl && !dl.didTimeout ? dl.timeRemaining() : SV_POLE_BUDGET);
      try {
        while (left() > 0) {
          const P = svPolesLeft();
          if (P) { svPoleMake(P, left(), 'idle'); if (P.k > SV_POLE_K && svHoldB === P.b) { svHoldB = 0; requestRender('L'); } }
          else if (!svRingAhead(left()) && !svMeshAhead(left())) break;
        }
        if (svPolesLeft() || svRingLeft() || svMeshNext()) { idle(next); return; }
      } catch (e) { /* (a map that cannot be evaluated: nothing more to make) */ }
      svPoleBusy = false;
    };
    idle(next);
  }
  // the idle job started again where its inputs changed since it ended (a frame of the view calls it)
  function svPolesWatch() {
    if (!svPoleBusy && (svPolesLeft() || svRingLeft() || svMeshNext())) svPolesAhead();
  }
