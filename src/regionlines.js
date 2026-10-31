// @ts-check
'use strict';
// The settle-time line refinement of the regions (SPEC 9.1, P4: Region.Lines): moved out of region.js (issue #20, the
// file-size budget) as a factory region.js calls where it stood, with the names of region.js it reads (each declared
// before that point); region.js takes Lines and defaultsFor back.
const RegionLines = (host) => {
  const { NOPACE, REACH, REF_RATIO, TAIL_LIM, clipLine, drain, expandBox, sampleCurveGen } = host;
  const { C } = CX;

  // ---------- settle-time line refinement (SPEC 9.1, P4) ----------
  // Lines.refine(curves, F, sing, caps) -> polylines (Float64Array [x0, y0, x1, y1, ...] in source space), for the
  // line renderer (createLines), built on settle only; motion frames keep sampleCurve's samples.
  // - F: the CPU stage map(s) the lines are drawn under (one function or a list). Long curves with c.reach (curvesOf
  //   with {reach: 'sphere'}) continue their tails until every map leaves TAIL_LIM or every image stops moving (float32
  //   resolution); formula contours with c.outer that
  //   end on an open side of the stretched mesh's outer box continue as rays along their last segment (same reach).
  // - sing: [{z}] the chain's singular points (Inverse.singular, nearest the window first), or null: then the curve is
  //   scanned under F[0] (float64, at most caps.maxEval evaluations): a non-finite value or a jump (midpoint deviation
  //   over 0.25 x chord) is located by 40 bisection steps and becomes a singular point.
  // - A singular point p within one sample step of a curve segment gets samples at distances d_k = step * REF_RATIO^-k on
  //   both sides along the curve, down to 1e-30 R (R: the window's half-diagonal; on a straight curve computed from
  //   p's foot, so far below the coordinates' own size near 0; also not below float32 resolution of the GPU's
  //   origin-relative positions, caps.origin). p itself is excluded: a curve through p is split there (its two sides
  //   map to different places: two circles of z^i, a pole's two ends at infinity), one off p keeps its samples down to
  //   a tenth of its distance. At most caps.maxInsert samples per curve, in the order of sing (distance to the window).
  // caps: {win, origin: [x, y], maxInsert (8192), maxEval (2048)}
  const Lines = (() => {
    const RATIO = REF_RATIO, LN_R = Math.log(RATIO), EPS = 2.220446049250313e-16;
    const add = (a, b) => C(a.re + b.re, a.im + b.im);
    const boxDist = (b, z) => Math.hypot(Math.max(b.x0 - z.re, 0, z.re - b.x1), Math.max(b.y0 - z.im, 0, z.im - b.y1));
    const fin = (w) => !!w && Number.isFinite(w.re) && Number.isFinite(w.im);
    // A fresh run stop (P4 review): fed the samples of a run in order (a tail past FAR toward the reach end, or the
    // samples inserted toward a singular point), it returns true once every map is done with the run (the sample just
    // fed is kept as the run's last). A map is done for good once
    // - its image left TAIL_LIM (float32 drops the pieces) or is not finite;
    // - its image has stopped moving (3 steps in a row under float32 resolution of the image: a Mobius map toward the
    //   image of infinity, exp toward 0);
    // - its image has wrapped: the image chords have turned by more than WRAP since the run began (z^i along a ray
    //   traces |w| = const once per 2 pi of ln|z|: later turns only draw the same circle again).
    // seed: the run's starting point (the FAR end of a tail), so the first step is judged too.
    const WRAP = 2.5 * Math.PI;
    const runStop = (Fs) => (seed) => {
      const st = Fs.map(() => ({ w: null, dir: NaN, turn: 0, still: 0, done: false }));
      const feed = (z) => {
        let all = true;
        Fs.forEach((F, i) => {
          const m = st[i];
          if (m.done) return;
          const w = F(z);
          if (!fin(w) || !(Math.abs(w.re) <= TAIL_LIM && Math.abs(w.im) <= TAIL_LIM)) { m.done = true; return; }
          const p = m.w;
          if (p) {
            const dx = w.re - p.re, dy = w.im - p.im, ch = Math.hypot(dx, dy);
            m.still = ch <= 1.2e-7 * Math.max(Math.hypot(w.re, w.im), 1e-12) ? m.still + 1 : 0;
            if (ch > 0) {
              const dir = Math.atan2(dy, dx);
              if (dir === dir && m.dir === m.dir) { let a = dir - m.dir; a -= 2 * Math.PI * Math.round(a / (2 * Math.PI)); m.turn += Math.abs(a); }
              m.dir = dir;
            }
          }
          m.w = w;
          if (m.still >= 3 || m.turn > WRAP) m.done = true;
          else all = false;
        });
        return all;
      };
      if (seed) feed(seed);
      return feed;
    };
    const tailStop = runStop;
    // the image of the segment za-zb under F is not resolved by its two ends: the midpoint's image is off the chord's
    // midpoint by more than 0.25 x chord (the jump scan's test); a non-finite image counts as resolved here (a pole or
    // an overflow is the other stops' business)
    function unresolved(F, za, zb) {
      const wa = F(za), wb = F(zb), wm = F(C((za.re + zb.re) / 2, (za.im + zb.im) / 2));
      if (!fin(wa) || !fin(wb) || !fin(wm)) return false;
      const ch = Math.hypot(wb.re - wa.re, wb.im - wa.im), dev = Math.hypot(wm.re - (wa.re + wb.re) / 2, wm.im - (wa.im + wb.im) / 2);
      return dev > 0.25 * ch && dev > 1e-9 * Math.max(Math.hypot(wa.re, wa.im), Math.hypot(wb.re, wb.im), Math.hypot(wm.re, wm.im));
    }
    // A long curve (line, ray, half-plane boundary) whose image is no longer resolved by its samples far out (exp of a
    // vertical line, sin and cos: the samples land at unrelated angles of a periodic image and draw chords across it)
    // ends where the run of unresolved segments begins: walking out from the window, the first 3 segments in a row
    // that are unresolved under every map, both ends outside expandBox(win, CUT_BOX). A single unresolved segment (a
    // pole crossed far out: the image continues on the other side) is kept.
    const CUT_BOX = 4;
    function* cutUnresolved(pts, Fs, win, pc) {
      const n = pts.length / 2;
      if (!Fs.length || n < 4) return pts;
      const box = expandBox(win, CUT_BOX), cx = (win.x0 + win.x1) / 2, cy = (win.y0 + win.y1) / 2;
      const P = (i) => C(pts[2 * i], pts[2 * i + 1]);
      const out = (i) => { const x = pts[2 * i], y = pts[2 * i + 1]; return x < box.x0 || x > box.x1 || y < box.y0 || y > box.y1; };
      let m = 0, best = Infinity;
      for (let i = 0; i < n; i++) { const d = Math.hypot(pts[2 * i] - cx, pts[2 * i + 1] - cy); if (d < best) { best = d; m = i; } }
      const bad = (i, j) => out(i) && out(j) && Fs.every((F) => unresolved(F, P(i), P(j)));
      // the last kept index walking from m in direction sgn
      const walk = function* (sgn) {
        let run = 0;
        for (let i = m; sgn > 0 ? i + 1 < n : i > 0; i += sgn) {
          if (bad(i, i + sgn)) { if (++run >= 3) return i - sgn * 2; } else run = 0;
          if (pc.due()) yield;
        }
        return sgn > 0 ? n - 1 : 0;
      };
      const hi = yield* walk(1), lo = yield* walk(-1);
      if (lo === 0 && hi === n - 1) return pts;
      return pts.slice(2 * lo, 2 * hi + 2);
    }
    // (v16.1) A kept segment with an end outside the window whose image bends within it is halved until, under every
    // map, each piece's image midpoint is within BEND of its chord: the GPU draws a segment as 8 straight pieces, so a
    // geometric tail step of exp along a vertical line (up to 1.8 rad of the unit circle) drew chords up to 1 px inside
    // the circle at 150 px per unit (gate v16: curves exp_imag_axis). Only segments the cut test calls resolved under
    // every map are halved (one it keeps unresolved is a pole crossed far out); at most FAR_DEPTH halvings per segment
    // and FAR_EVAL map evaluations per curve. Inside the window today's samples (diag / 700) are kept as they are.
    const BEND = 1 / 32, FAR_DEPTH = 6, FAR_EVAL = 8192;
    function* resolveFar(pts0, Fs, win, pc) {
      if (!Fs.length || pts0.length < 4) return pts0;
      const pts = yield* wrapCut(pts0, Fs, win, pc), n = pts.length / 2;
      let ev = 0;
      const img = (x, y) => { ev += Fs.length; const z = C(x, y); return Fs.map((F) => F(z)); };
      const inWin = (x, y) => x >= win.x0 && x <= win.x1 && y >= win.y0 && y <= win.y1;
      // 1: halve, 0: drawn as it is
      const bent = (A, B, M) => {
        let any = false;
        for (let i = 0; i < A.length; i++) {
          const a = A[i], b = B[i], m = M[i];
          if (!fin(a) || !fin(b) || !fin(m)) return false;
          const ch = Math.hypot(b.re - a.re, b.im - a.im), dev = Math.hypot(m.re - (a.re + b.re) / 2, m.im - (a.im + b.im) / 2);
          if (dev > 0.25 * ch) return false;
          if (dev > BEND * ch && dev > 1e-9 * Math.max(Math.hypot(a.re, a.im), Math.hypot(b.re, b.im), Math.hypot(m.re, m.im))) any = true;
        }
        return any;
      };
      const out = [pts[0], pts[1]];
      let changed = false, Wa = img(pts[0], pts[1]);
      const split = function* (ax, ay, A, bx, by, B, depth) {
        if (depth < FAR_DEPTH && ev < FAR_EVAL) {
          const mx = (ax + bx) / 2, my = (ay + by) / 2, M = img(mx, my);
          if (pc.due()) yield;
          if (bent(A, B, M)) { changed = true; yield* split(ax, ay, A, mx, my, M, depth + 1); yield* split(mx, my, M, bx, by, B, depth + 1); return; }
        }
        out.push(bx, by);
      };
      for (let i = 0; i + 1 < n; i++) {
        const ax = pts[2 * i], ay = pts[2 * i + 1], bx = pts[2 * i + 2], by = pts[2 * i + 3];
        if (inWin(ax, ay) && inWin(bx, by)) { out.push(bx, by); Wa = null; continue; }
        const A = Wa || img(ax, ay), B = img(bx, by);
        yield* split(ax, ay, A, bx, by, B, 0);
        Wa = B;
        if (pc.due()) yield;
      }
      return changed ? new Float64Array(out) : pts;
    }
    // walking out of the window on each side, the samples end once the image has turned by WRAP under every map past
    // expandBox(win, CUT_BOX) (the run stop's rule: exp along a vertical line draws the unit circle again and again, 8 more turns in its
    // tails); what follows draws the same curve again
    function* wrapCut(pts, Fs, win, pc) {
      const n = pts.length / 2, box = expandBox(win, CUT_BOX);   // (never inside the cut test's box)
      const inWin = (i) => { const x = pts[2 * i], y = pts[2 * i + 1]; return x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1; };
      const cx = (win.x0 + win.x1) / 2, cy = (win.y0 + win.y1) / 2;
      let m = 0, best = Infinity;
      for (let i = 0; i < n; i++) { const d = Math.hypot(pts[2 * i] - cx, pts[2 * i + 1] - cy); if (d < best) { best = d; m = i; } }
      const walk = function* (sgn) {
        const st = Fs.map(() => ({ w: null, dir: NaN, turn: 0 }));
        for (let i = m; sgn > 0 ? i < n : i >= 0; i += sgn) {
          const z = C(pts[2 * i], pts[2 * i + 1]), out = !inWin(i);
          let all = true;
          Fs.forEach((F, k) => {
            const q = st[k], w = F(z);
            if (!fin(w)) { q.w = null; q.dir = NaN; all = false; return; }
            if (q.w && out) {
              const dx = w.re - q.w.re, dy = w.im - q.w.im;
              if (dx || dy) { const dir = Math.atan2(dy, dx); if (q.dir === q.dir) { let a = dir - q.dir; a -= 2 * Math.PI * Math.round(a / (2 * Math.PI)); q.turn += Math.abs(a); } q.dir = dir; }
            } else if (!out) { q.turn = 0; q.dir = NaN; }
            q.w = w;
            if (!(q.turn > WRAP)) all = false;
          });
          if (all) return i;
          if (pc.due()) yield;
        }
        return sgn > 0 ? n - 1 : 0;
      };
      const hi = yield* walk(1), lo = yield* walk(-1);
      return lo === 0 && hi === n - 1 ? pts : pts.slice(2 * lo, 2 * hi + 2);
    }
    // the smallest offset along u from q that float32 still separates from q in origin-relative GPU coordinates
    function f32Floor(q, u, o) {
      if (!o) return 0;
      let m = Infinity;
      const dx = Math.abs(q.re - o[0]), dy = Math.abs(q.im - o[1]);
      if (Math.abs(u.re) > 1e-12) m = Math.min(m, dx * 1.2e-7 / Math.abs(u.re));
      if (Math.abs(u.im) > 1e-12) m = Math.min(m, dy * 1.2e-7 / Math.abs(u.im));
      return Number.isFinite(m) ? m : 0;
    }
    // a formula contour that ends on an open side of the mesh's outer box continues as a ray (its last segment's
    // direction) toward the reach box, with geometric spacing and the tail stop
    function* rayEnds(pts, c, win, mk, pc) {
      const ob = c.outer, op = c.openSides || {}, tol = 2 * (c.cell || 0) + 1e-9 * Math.max(ob.x1 - ob.x0, ob.y1 - ob.y0);
      const onOpen = (z) => (op.x0 && Math.abs(z.re - ob.x0) <= tol) || (op.x1 && Math.abs(z.re - ob.x1) <= tol) || (op.y0 && Math.abs(z.im - ob.y0) <= tol) || (op.y1 && Math.abs(z.im - ob.y1) <= tol);
      const n = pts.length / 2;
      if (n < 2) return pts;
      const P = (i) => C(pts[2 * i], pts[2 * i + 1]);
      const ray = function* (e, prev) {
        const d = CX.sub(e, prev), h0 = CX.abs(d), stop = mk ? mk(e) : null;
        if (!(h0 > 0)) return [];
        const u = CX.scale(d, 1 / h0), cl = clipLine(e, u, expandBox(win, REACH), 0);
        if (!cl) return [];
        const tEnd = CX.abs(CX.sub(cl[1], e)), out = [];
        let t = 0, h = h0;
        for (let i = 0; i < 4000; i++) {
          h *= RATIO; t += h;
          if (t >= tEnd) { out.push(cl[1]); break; }
          const z = add(e, CX.scale(u, t));
          out.push(z);
          if (stop && stop(z)) break;
          if (pc.due()) yield;
        }
        return out;
      };
      const head = onOpen(P(0)) ? (yield* ray(P(0), P(1))).reverse() : [];
      const tailP = onOpen(P(n - 1)) ? yield* ray(P(n - 1), P(n - 2)) : [];
      if (!head.length && !tailP.length) return pts;
      const out = new Float64Array(pts.length + 2 * (head.length + tailP.length));
      let k = 0;
      for (const z of head) { out[k++] = z.re; out[k++] = z.im; }
      out.set(pts, k); k += pts.length;
      for (const z of tailP) { out[k++] = z.re; out[k++] = z.im; }
      return out;
    }
    // the jump scan of an ineligible chain: located singular points [{z, on: true, w (bracket width)}]
    const jumpScan = (pts, F, maxEval) => drain(jumpScanGen(pts, F, maxEval, NOPACE));
    function* jumpScanGen(pts, F, maxEval, pc) {
      const n = pts.length / 2;
      if (n < 2 || !F) return [];
      let ev = 0;
      const at = (u) => { const i = Math.min(n - 2, Math.max(0, Math.floor(u))), f = u - i; return C(pts[2 * i] + f * (pts[2 * i + 2] - pts[2 * i]), pts[2 * i + 1] + f * (pts[2 * i + 3] - pts[2 * i + 1])); };
      const Fz = (u) => { ev++; return F(at(u)); };
      const stride = Math.max(1, Math.ceil((n - 1) / Math.max(1, Math.floor(maxEval / 3))));
      const us = [];
      for (let u = 0; u < n - 1; u += stride) us.push(u);
      us.push(n - 1);
      const W = [];
      for (const u of us) { W.push(Fz(u)); if (pc.due()) yield; }
      const found = [];
      for (let k = 0; k + 1 < us.length && ev < maxEval; k++) {
        let u0 = us[k], u1 = us[k + 1], w0 = W[k], w1 = W[k + 1];
        const um = (u0 + u1) / 2, wm = Fz(um);
        let bad = !fin(w0) || !fin(w1) || !fin(wm);
        const chord = bad ? 0 : Math.hypot(w1.re - w0.re, w1.im - w0.im);
        if (!bad) bad = Math.hypot(wm.re - (w0.re + w1.re) / 2, wm.im - (w0.im + w1.im) / 2) > 0.25 * chord && chord > 0;
        if (pc.due()) yield;
        if (!bad || ev + 40 > maxEval) continue;
        // 40 bisection steps toward the half with the non-finite value or the larger change
        const big = (a, b) => (!fin(a) || !fin(b) ? Infinity : Math.hypot(b.re - a.re, b.im - a.im));
        let a0 = u0, a1 = u1, wa = w0, wb = w1;
        for (let it = 0; it < 40; it++) {
          const m = (a0 + a1) / 2, w = Fz(m);
          if (big(wa, w) >= big(w, wb)) { a1 = m; wb = w; } else { a0 = m; wa = w; }
          if (pc.due()) yield;
        }
        // a real jump keeps a large change (or a non-finite value) over the final bracket; a smooth bend does not
        const jump = big(wa, wb);
        if (!(jump > 0.25 * Math.max(chord, 1e-300)) && Number.isFinite(jump)) continue;
        const za = at(a0), zb = at(a1);
        found.push({ z: C((za.re + zb.re) / 2, (za.im + zb.im) / 2), on: true, w: Math.hypot(zb.re - za.re, zb.im - za.im) });
      }
      return found;
    }
    // insertion on a straight polyline (lines, rays, segments, polygons, formula contours): per segment, the inserted
    // points with their order keys (offset of p's foot in the segment, signed distance); breaks where a curve passes p
    function* insertStraight(pts, sps, caps) {
      const pc = caps.pc || NOPACE;
      const n = pts.length / 2;
      const P = (i) => C(pts[2 * i], pts[2 * i + 1]);
      const segs = [];
      for (let i = 0; i + 1 < n; i++) {
        const a = P(i), b = P(i + 1), d = CX.sub(b, a), h = CX.abs(d);
        segs.push({ a, b, h, u: h > 0 ? CX.scale(d, 1 / h) : C(1, 0) });
      }
      const ins = segs.map(() => []);
      const drop = new Uint8Array(n);
      let budget = caps.maxInsert;
      for (const sp of sps) {
        if (budget <= 1) break;
        const { j, p } = sp, sg = segs[j];
        let tq = (p.re - sg.a.re) * sg.u.re + (p.im - sg.a.im) * sg.u.im;
        const on = sp.on || sp.d <= 8 * EPS * (Math.abs(p.re) + Math.abs(p.im) + CX.abs(sg.a) + CX.abs(sg.b)) + 1e-300;
        const tol = 8 * EPS * (Math.abs(p.re) + Math.abs(p.im) + CX.abs(sg.a)) + 1e-300;
        let at = 0;                                   // 0 inside, 1 at the segment's start, 2 at its end
        if (tq <= tol) { tq = 0; at = 1; } else if (tq >= sg.h - tol) { tq = sg.h; at = 2; }
        const q = at === 1 ? sg.a : at === 2 ? sg.b : add(sg.a, CX.scale(sg.u, tq));
        const d0 = Math.min(sg.h, sp.lim);
        const lo = Math.max(1e-30 * caps.R, on ? (sp.w || 0) : sp.d / 10, f32Floor(q, sg.u, caps.origin));
        if (!(d0 > lo)) continue;
        const K = Math.min(Math.floor(Math.log(d0 / lo) / LN_R), Math.floor(budget / 2) - 1);
        if (K < 0) continue;
        budget -= 2 * (K + 1);
        if (on) {
          if (at === 1) drop[j] = 1; else if (at === 2) drop[j + 1] = 1;
          else ins[j].push({ tb: tq, sub: 0, brk: true });
        }
        for (const sgn of [-1, 1]) {
          // the run toward p ends once every map is done with it (its image wrapped, stopped moving or left TAIL_LIM)
          const stop = caps.stop ? caps.stop() : null;
          for (let k = 0, dk = d0; k <= K; k++, dk /= RATIO) {
            // inside segment j: keyed by p's foot and the signed distance (exact order however small dk is)
            const room = sgn < 0 ? tq : sg.h - tq;
            if (dk < room) {
              const z = add(q, CX.scale(sg.u, sgn * dk));
              ins[j].push({ tb: tq, sub: sgn * dk, z });
              if (stop && stop(z)) break;
              if (pc.due()) yield;
              continue;
            }
            if (dk === room) continue;               // the vertex itself
            // past it: walk the polyline (corners followed), keyed by the offset in that segment
            let rem = dk - room, i = j + sgn;
            while (i >= 0 && i < segs.length && rem > segs[i].h) { rem -= segs[i].h; i += sgn; }
            if (i < 0 || i >= segs.length || rem === segs[i].h) continue;
            const s2 = segs[i];
            const tb = sgn < 0 ? s2.h - rem : rem;
            const z = sgn < 0 ? add(s2.b, CX.scale(s2.u, -rem)) : add(s2.a, CX.scale(s2.u, rem));
            ins[i].push({ tb, sub: 0, z });
            if (stop && stop(z)) break;
            if (pc.due()) yield;
          }
        }
      }
      // assemble, with breaks
      const out = [];
      let cur = [];
      const flush = () => { if (cur.length >= 4) out.push(cur); cur = []; };
      const put = (z) => { const L = cur.length; if (L && cur[L - 2] === z.re && cur[L - 1] === z.im) return; cur.push(z.re, z.im); };
      for (let i = 0; i < n; i++) {
        if (drop[i]) flush(); else put(P(i));
        if (i < segs.length && ins[i].length) {
          ins[i].sort((x, y) => x.tb - y.tb || x.sub - y.sub);
          for (const e of ins[i]) { if (e.brk) flush(); else put(e.z); }
        }
      }
      flush();
      return out;
    }
    // insertion on a smooth parametric curve (circles, arcs): in its parameter, uniform samples i / n as today
    function* insertParam(c, n, sps, caps) {
      const pc = caps.pc || NOPACE;
      const ss = [];
      for (let i = 0; i <= n; i++) ss.push({ s: i / n });
      let budget = caps.maxInsert;
      const closed = !!c.closed;
      for (const sp of sps) {
        if (budget <= 1) break;
        const { j, p } = sp;
        // p's foot: a ternary search of |f(s) - p| around the nearest chord
        let s0 = (j - 1) / n, s1 = (j + 2) / n;
        if (!closed) { s0 = Math.max(0, s0); s1 = Math.min(1, s1); }
        const g = (s) => { const z = c.f(s); return Math.hypot(z.re - p.re, z.im - p.im); };
        for (let it = 0; it < 80; it++) { const m1 = s0 + (s1 - s0) / 3, m2 = s1 - (s1 - s0) / 3; if (g(m1) <= g(m2)) s1 = m2; else s0 = m1; }
        let sp0 = (s0 + s1) / 2;
        const dist0 = g(sp0), e = 1e-7 / n, z1 = c.f(sp0 + e), z0 = c.f(sp0 - e);
        const speed = Math.hypot(z1.re - z0.re, z1.im - z0.im) / (2 * e);
        if (!(speed > 0)) continue;
        const on = sp.on || dist0 <= 1e-12 * (CX.abs(p) + caps.R);
        const d0 = Math.min(sp.h, sp.lim);
        const lo = Math.max(1e-30 * caps.R, on ? (sp.w || 0) : dist0 / 10, 4 * EPS * (Math.abs(sp0) + 1) * speed);
        if (!(d0 > lo)) continue;
        const K = Math.min(Math.floor(Math.log(d0 / lo) / LN_R), Math.floor(budget / 2) - 1);
        if (K < 0) continue;
        budget -= 2 * (K + 1);
        if (closed) sp0 = ((sp0 % 1) + 1) % 1;
        // (inserted parameters of a closed curve wrap around; the regular samples keep 0 and 1)
        const wrap = (s) => (closed ? (s < 0 ? s + 1 : s > 1 ? s - 1 : s) : s);
        for (const sgn of [-1, 1]) {
          const stop = caps.stop ? caps.stop() : null;
          for (let k = 0, dk = d0; k <= K; k++, dk /= RATIO) {
            const s1 = wrap(sp0 + sgn * dk / speed);
            ss.push({ s: s1 });
            if (stop && stop(c.f(s1))) break;
            if (pc.due()) yield;
          }
        }
        if (on) ss.push({ s: sp0, brk: true });
      }
      const valid = ss.filter((e) => e.brk || (e.s >= 0 && e.s <= 1));
      valid.sort((x, y) => x.s - y.s || (x.brk ? 1 : 0) - (y.brk ? 1 : 0));
      const out = [];
      let cur = [], lastS = NaN;
      const flush = () => { if (cur.length >= 4) out.push(cur); cur = []; lastS = NaN; };
      for (let i = 0; i < valid.length; i++) {
        const e = valid[i];
        if (e.brk) {
          // drop the samples at p itself, then split
          while (cur.length && lastS === e.s) { cur.length -= 2; lastS = NaN; }
          flush();
          // skip samples equal to p's parameter after the break
          while (i + 1 < valid.length && valid[i + 1].s === e.s && !valid[i + 1].brk) i++;
          continue;
        }
        if (e.s === lastS) continue;
        const z = c.f(e.s);
        cur.push(z.re, z.im); lastS = e.s;
      }
      flush();
      // a closed curve split somewhere: join its last piece to its first (they meet where the loop started)
      if (closed && out.length >= 2 && valid.some((e) => e.brk)) {
        const last = out.pop(), first = out.shift();
        out.unshift(last.concat(first.slice(2)));
      }
      return out;
    }
    // the singular points within one sample step of the polyline: [{p, j (nearest segment), d, h, lim}], in sing order
    function nearPoints(pts, sing, R) {
      const n = pts.length / 2, out = [];
      if (n < 2) return out;
      let bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity, hmax = 0;
      for (let i = 0; i < n; i++) { const x = pts[2 * i], y = pts[2 * i + 1]; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
      for (let i = 0; i + 1 < n; i++) hmax = Math.max(hmax, Math.hypot(pts[2 * i + 2] - pts[2 * i], pts[2 * i + 3] - pts[2 * i + 1]));
      const seen = [];
      for (const e of sing) {
        const p = e.z;
        // one entry per location (a branch point that is also an accumulation point: z^i at 0)
        if (fin(p) && seen.some((q) => Math.hypot(q.re - p.re, q.im - p.im) <= 1e-12 * (1 + Math.abs(p.re) + Math.abs(p.im)))) continue;
        if (fin(p)) seen.push(p);
        if (!fin(p) || p.re < bx0 - hmax || p.re > bx1 + hmax || p.im < by0 - hmax || p.im > by1 + hmax) continue;
        let best = Infinity, bj = -1;
        for (let i = 0; i + 1 < n; i++) {
          const ax = pts[2 * i], ay = pts[2 * i + 1], bx = pts[2 * i + 2], by = pts[2 * i + 3];
          const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
          let t = L2 > 0 ? ((p.re - ax) * dx + (p.im - ay) * dy) / L2 : 0;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const dd = Math.hypot(p.re - ax - t * dx, p.im - ay - t * dy);
          if (dd < best) { best = dd; bj = i; }
        }
        if (bj < 0) continue;
        const h = Math.hypot(pts[2 * bj + 2] - pts[2 * bj], pts[2 * bj + 3] - pts[2 * bj + 1]);
        if (!(best <= h) && !e.on) continue;
        out.push({ p, j: bj, d: best, h, on: !!e.on, w: e.w || 0, lim: Infinity });
      }
      // neighbouring points share the room between them (their sample runs do not overlap)
      for (const a of out) for (const b of out) if (a !== b) { const dd = Math.hypot(a.p.re - b.p.re, a.p.im - b.p.im); if (dd / 2 < a.lim) a.lim = dd / 2; }
      return out.filter((a) => a.lim > 0);
    }
    // Dash arc lengths for createLines' segment order (P4 review): per segment, the arc length of the polyline's image
    // under F at the segment start and the segment's image length. A long polyline (a sample farther than LONG_R x R
    // from c: lines, rays, half-plane boundaries, formula contours to the mesh's outer box) is measured from an anchor
    // near the view, the point of the polyline nearest c (the window centre) in the source, instead of its first
    // sample: reach tails start up to 1e19 (image) or 1e28 (source) away, where float32 no longer resolves a dash
    // period. The anchor is a source point, the same for today's samples and the refined ones (they agree near the
    // view), so the dash phase does not move when the refined samples are swapped in. A bounded polyline keeps today's
    // origin, its first sample. R: the window's half-diagonal. -> Float32Array [arc0, len0, arc1, len1, ...]
    const LONG_R = 50;
    function arcs(polys, F, c, R) {
      let n = 0;
      for (const p of polys) n += Math.max(0, p.length / 2 - 1);
      const data = new Float32Array(2 * n);
      let o = 0;
      for (const p of polys) {
        const m = p.length / 2;
        if (m < 2) continue;
        const acc = new Float64Array(m - 1), len = new Float64Array(m - 1);
        let pw = F(C(p[0], p[1]));
        if (!fin(pw)) pw = null;
        let bj = 0, bt = 0, best = Infinity;
        for (let i = 1; i < m; i++) {
          const w = F(C(p[2 * i], p[2 * i + 1])), ok = fin(w);
          len[i - 1] = ok && pw ? Math.hypot(w.re - pw.re, w.im - pw.im) : 0;
          pw = ok ? w : null;
          // the source point nearest c on this segment
          const ax = p[2 * i - 2], ay = p[2 * i - 1], dx = p[2 * i] - ax, dy = p[2 * i + 1] - ay, L2 = dx * dx + dy * dy;
          let t = L2 > 0 ? ((c[0] - ax) * dx + (c[1] - ay) * dy) / L2 : 0;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const d = Math.hypot(c[0] - ax - t * dx, c[1] - ay - t * dy);
          if (d < best) { best = d; bj = i - 1; bt = t; }
        }
        let far = 0;
        for (let i = 0; i < m; i++) far = Math.max(far, Math.abs(p[2 * i] - c[0]), Math.abs(p[2 * i + 1] - c[1]));
        if (!(far > LONG_R * R)) { bj = 0; bt = 0; }
        // accumulated outward from the anchor (a sum from the far end would lose the view's lengths in float64 too)
        acc[bj] = -bt * len[bj];
        for (let i = bj + 1; i < m - 1; i++) acc[i] = acc[i - 1] + len[i - 1];
        for (let i = bj - 1; i >= 0; i--) acc[i] = acc[i + 1] - len[i];
        for (let i = 0; i < m - 1; i++) { data[o++] = acc[i]; data[o++] = len[i]; }
      }
      return data;
    }
    // caps.pc: a pacer (refineGen yields where pc.due()); refine runs it through
    const refine = (curves, F, sing, caps = {}) => drain(refineGen(curves, F, sing, caps));
    function* refineGen(curves, F, sing, caps = {}) {
      const win = caps.win, pc = caps.pc || NOPACE;
      const Fs = (Array.isArray(F) ? F : F ? [F] : []).filter((f) => typeof f === 'function');
      const stop = Fs.length ? tailStop(Fs) : null;
      const R = Math.hypot(win.x1 - win.x0, win.y1 - win.y0) / 2;
      const cp = { R, origin: caps.origin || null, maxInsert: caps.maxInsert ?? 8192, stop, pc };
      const maxEval = caps.maxEval ?? 2048;
      const out = [];
      for (const c of curves) {
        if (!c) continue;
        let pts = yield* sampleCurveGen(c, win, { tail: stop, pc });
        if (c.long && c.reach) pts = yield* resolveFar(yield* cutUnresolved(pts, Fs, win, pc), Fs, win, pc);
        if (c.pts && c.outer && !c.closed) pts = yield* rayEnds(pts, c, win, stop, pc);
        if (pts.length < 4) continue;
        let list = sing ? sing.slice().sort((a, b) => boxDist(win, a.z) - boxDist(win, b.z)) : yield* jumpScanGen(pts, Fs[0], maxEval, pc);
        const sps = nearPoints(pts, list, R);
        if (!sps.length) { out.push(pts); continue; }
        const straight = !!(c.long || c.pts || (c.a && c.b));
        if (straight) { for (const q of yield* insertStraight(pts, sps, cp)) out.push(new Float64Array(q)); continue; }
        const n = pts.length / 2 - 1;
        for (const q of yield* insertParam(c, n, sps, cp)) out.push(q instanceof Float64Array ? q : new Float64Array(q));
      }
      return out;
    }
    return { refine, refineGen, REACH, TAIL_LIM, jumpScan, arcs, unresolved };
  })();

  function defaultsFor(kind, z0, z1) {
    const a = [z0.re, z0.im], b = [z1.re, z1.im];
    const r = Math.hypot(z1.re - z0.re, z1.im - z0.im);
    switch (kind) {
      case 'point': return { p: a };
      case 'segment': case 'line': case 'ray': case 'halfplane': case 'rect': case 'cgrid': return { a, b, ...(kind === 'cgrid' ? { n: 8 } : {}) };
      case 'circle': case 'disc': return { c: a, r };
      case 'pgrid': return { c: a, r, nc: 6, nr: 12 };
      case 'annulus': return { c: a, r1: r / 2, r2: r };
      case 'sector': return { c: a, r, t1: 0, t2: 60 };
      case 'arc': {
        const mid = [(z0.re + z1.re) / 2 - (z1.im - z0.im) * 0.35, (z0.im + z1.im) / 2 + (z1.re - z0.re) * 0.35];
        return { a, m: mid, b };
      }
    }
    return {};
  }

  return { Lines, defaultsFor };
};
import { CX } from './cx.js';
export { RegionLines };
