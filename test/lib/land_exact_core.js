// The exact image reference of the steps view's Landscape glide, one implementation for every suite that needs it
// (steps_land_exact_cmd.js and the hook checks of #1318). An expression for eval, in node or in the page:
//   const { refImage, run, CONSTS } = eval(fs.readFileSync('test/lib/land_exact_core.js', 'utf8'))
// refImage(frame, opts) is a generator (it yields now and then, so a page call stays short) that returns
//   { px, cells, certs, failures }
// px: the coverage the exact map draws, a Uint8Array of frame.W2 x frame.H2 half-resolution pixels (1: drawn);
// cells: counts of what each cell of the lattice became ({ facet, boundary, branch, empty, splits, rays, places });
// certs: the branch-point certificates issued ({ c, w, r, d, kantorovich, winding });
// failures: everything the reference could not decide, each { kind, ... } with its place. A reference with failures is not exact.
// run(gen) runs a generator to its result.
//
// The frame (what the page's hooks provide; the node check passes a synthetic one):
//   box: { x0, x1, y0, y1 }, the places w the lattice covers;   W2, H2: the size of px;
//   enumAt(ws): per place the enumerator's members [{ z: [re, im], lam: [re, im] | null, h, sheet, front? }];
//   hom(z, lam): per sheet { H: [re, im] | null, dH: [re, im] | null }, the map the frame draws z at (the preimage's forward map);
//   project(x, y, h): the half-resolution pixel [px, py] of the point (x, y, h) of the surface;
//   mask(x, y): 0..1 (the Inside-regions mask) or null;   all: every member is drawn (All sheets), else the front one;
//   layers(m): the drawn layers of a member [{ combo, h }] (All sheets' forward combos), default one layer of height m.h.
//   sing(): optional, the plan's own singular points [{ sheet, z, w, kind }] (w: the place each is drawn at, null where H is not finite);
//   count(w): optional, the completeness count at a place [{ ok, status }].
// opts: { nx, ny, depth, <the named bounds below> and the controls' perturbations: seed, seam, branch }.
//
// How a cell is judged (each cell of the lattice either proves its image is within E_SAFE / 2 pixels, or goes to the boundary
// method, or to a branch certificate, or fails loudly):
// - identity: a member is carried from one place to the next by path continuation with step control, never by taking the nearest
//   root of a fresh Newton (opts.seed turns that into the nearest root: a control);
// - a cell whose corners carry the same members is drawn linearly over its two triangles, and halved while the linear image is
//   over E_SAFE / 2 pixels from the exact one at the edges' midpoints and the centre, or its second differences do not decay like
//   a quadratic; one still over at CELL_DEPTH_MAX fails;
// - a cell whose corners differ in members, in the mask or in the drawn height across a wall is halved to a footprint of at most
//   BND_PX pixels and each pixel under it is decided by bisection along the pixel's own ray;
// - a cell whose continuation fails (a branch point) passes only with a certificate: the critical point of H, proved to exist and
//   to be unique in a disc by a Kantorovich test, its local degree by the argument principle on the disc's boundary; the pixels
//   under the disc are then decided as at a boundary. CERT_MAX certificates a frame, more fails.
(() => {
  const CONSTS = {
    CELL_DEPTH_MAX: 8,      // halvings of a lattice cell; one still over the bound there fails
    E_SAFE: 0.5,            // full-resolution pixels: the image error a cell may have is half of this
    PX_FULL: 2,             // full-resolution pixels per half-resolution pixel
    CURV_RATIO: 4,          // the second difference of a cell over that of its halves: 4 for a quadratic
    CURV_SLACK: 1,          // ... within this much either way
    CURV_FLOOR: 0.05,       // full-resolution pixels: a second difference below this is rounding
    CONT_STEP_MIN: 1e-12,   // the smallest share of a path a continuation step may be: below it the cell is branch-suspect
    CONT_RATIO: 0.5,        // a continuation step's Newton must contract at least this much
    CONT_NEAR: 0.25,        // a continuation step is under this share of the distance to the nearest other member
    NEWT_ITER: 8,           // iterations of a Newton correction
    NEWT_TOL: 1e-8,         // |H(z) - w| of a converged correction, relative to 1 + |w| (the forward map's own rounding is about 2e-10)
    SING_REACH: 8,          // leaf cells around a declared singular point's own cell that its certificate covers: the surface is not
                            // smooth there at any depth the lattice reaches (infinite slope), the pixels are decided by rays
    SING_ADJ: 3,            // leaf cells apart at most: suspect cells of one kind that touch are one neighbourhood
    SING_REACH_MAX: 40,     // leaf cells from the singular point at most, whatever touches
    SING_PX: 1e-3,          // a ray sample this close (in pixels of w) to a declared singular point is at it
    DISP_SEP: 0.5,          // a member's displacement is under this share of the smallest separation of its sheet's members to identify it
    NEWT_FLOOR: 1e-9,       // a first correction under this (relative to 1 + |z|) is rounding: its contraction ratio is not judged
    MATCH_TOL: 1e-5,        // a carried member equals an enumerated one within this of 1 + |z|
    BND_PX: 2,              // half-resolution pixels: a boundary cell is halved until its members' own edges are this short
    CAND_R: 1.5,            // half-resolution pixels: the pixels a ray is cast for lie this close to a member's projected corners and edges
    JUMP_PX: 3,             // half-resolution pixels: corners of one member this far apart at CELL_DEPTH_MAX are a wall
    RAY_SAMPLES: 8,         // samples along a pixel's ray inside a boundary cell
    RAY_SUB_PX: 1 / 16,     // a ray's bisection stops at this many pixels
    RAY_ITER: 40,           // a ray's bisection iterations at most (fails when reached)
    HIT_TOL: 1e-3,          // a ray's bisection ends at a surface where |g| is under this share of the height range, else at a wall
    CERT_MAX: 4,            // certificates a frame; more fails
    CERT_R: 1e-2,           // the certificate disc's radius relative to the members' distance
    CERT_WIND: 64,          // samples of the argument principle's circle at least
    CERT_ARG: Math.PI / 4,  // a step of the winding's argument is at most this
    CERT_LIP_N: 24,         // samples of the disc for the second derivative's bound
    RAY_PAD: 0.25,          // the ray's height range beyond the cell's corners', as a share of their range
    RAY_BOX: 0.5,           // the part of the ray kept: over the cell's box grown by this share of its width each side
    CERT_DELTA: 1e-3,       // the step of the finite differences of H' and H'' (relative to 1 + |z|)
    CERT_RHO_MIN: 1e-3,     // the smallest disc radius, relative to the members' distance
    CERT_LIP_SAFE: 1.25,    // the sampled bound of H''' is taken this much over
    CERT_CRIT_TOL: 1e-9,    // |H'(c)| of the located critical point
    CERT_DEGEN: 1e-9,       // |H''| under this share of |H'| (per unit of the members' distance): the critical point is not simple
    CERT_TIGHT: 0.125,      // the cluster certificate's inner circle, as a share of the outer
    CERT_WIND_RES: 1e-3,    // the winding number's distance from an integer
    PLACES_MAX: 4e6,        // places looked up at most (a bound on the run)
  };
  const K = CONSTS;
  const cabs = (a) => Math.hypot(a[0], a[1]);
  const csub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const cadd = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
  const cdiv = (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
  const cscale = (a, s) => [a[0] * s, a[1] * s];
  const fin = (a) => !!a && Number.isFinite(a[0]) && Number.isFinite(a[1]);
  const mid2 = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const dist2 = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);

  function* refImage(frame, opts = {}) {
    const o = Object.assign({ nx: 40, ny: 34, depth: 0 }, K, opts);
    const { box, W2, H2 } = frame;
    const px = new Uint8Array(W2 * H2);
    const cells = { facet: 0, boundary: 0, branch: 0, empty: 0, splits: 0, rays: 0, hits: 0, places: 0, apex: 0, why: {} };
    const why = (k) => { cells.why[k] = (cells.why[k] || 0) + 1; };
    const certs = [], failures = [];
    let singList = null;   // the plan's declared singular points, read once
    const fail = (f) => { if (failures.length < 64) failures.push(f); };
    const tick = () => { if (frame.progress) frame.progress(cells, failures); };
    const FINE = 1 << o.CELL_DEPTH_MAX;                       // lattice steps of the finest cell, per initial cell
    const NXF = o.nx * FINE, NYF = o.ny * FINE;
    const wAt = (i, j) => [box.x0 + i * (box.x1 - box.x0) / NXF, box.y0 + j * (box.y1 - box.y0) / NYF];
    const cellW = (box.x1 - box.x0) / NXF;                    // the finest cell's width in w
    // ---- the vertices: the members at a place (enumerated, never ordered by identity), with their drawn layers
    const verts = new Map();
    let places = 0, capped = false;
    function* lookup(list) {
      const need = list.filter(([i, j]) => !verts.has(i * (NYF + 1) + j));
      if (!need.length) return;
      if (places + need.length > o.PLACES_MAX) { fail({ kind: 'places', places }); capped = true; return; }
      for (let at = 0; at < need.length; at += 400) {
        const part = need.slice(at, at + 400), ws = part.map(([i, j]) => wAt(i, j));
        const e = frame.enumAt(ws);
        part.forEach(([i, j], k) => verts.set(i * (NYF + 1) + j, mkVert(ws[k], e[k] || [])));
        places += part.length; cells.places = places;
        tick(); yield;
      }
    }
    // a place's record: all members (for identity) and which are drawn, with their layers' pixels
    function mkVert(w, ms) {
      const mk = frame.mask ? frame.mask(w[0], w[1]) : null, masked = mk !== null && mk < 0.5;
      const all = ms.map((m, idx) => {
        const drawn = !masked && Number.isFinite(m.h) && (frame.all || m.front === true);
        const layers = drawn ? (frame.layers ? frame.layers(m) : [{ combo: '', h: m.h }]).filter((l) => Number.isFinite(l.h)) : [];
        for (const l of layers) l.P = frame.project(w[0], w[1], l.h);
        const ok = layers.filter((l) => l.P);
        return { z: m.z, lam: m.lam || null, sheet: m.sheet || 0, idx, drawn: drawn && ok.length > 0, layers: ok };
      });
      return { w, all, masked };
    }
    const vert = (i, j) => verts.get(i * (NYF + 1) + j);
    // ---- identity: continuation of every member of a place along the segment to another place
    const Hof = (m, z, lam) => { const r = frame.hom(z, lam)[m.sheet]; return r && fin(r.H) && fin(r.dH) ? r : null; };
    let newtWhy = '';   // why the last Newton correction gave up (for the failure's text)
    function newton(m, z, lam, w) {
      let d1 = null, d2 = null;
      const hist = [];
      for (let it = 0; it < o.NEWT_ITER; it++) {
        const r = Hof(m, z, lam);
        if (!r) { newtWhy = 'H or dH not finite at iteration ' + it + ' (z ' + z[0].toExponential(2) + ',' + z[1].toExponential(2) + ')'; return null; }
        const res = csub(r.H, w);
        hist.push(cabs(res).toExponential(1));
        if (cabs(res) <= o.NEWT_TOL * (1 + cabs(w))) return { z, lam, ratio: d1 === null || d1 <= o.NEWT_FLOOR * (1 + cabs(z)) || d2 === null ? 0 : d2 / d1 };
        if (cabs(r.dH) < 1e-300) { newtWhy = 'dH is 0'; return null; }
        const dz = cdiv(res, r.dH);
        if (it === 0) d1 = cabs(dz); else if (it === 1) d2 = cabs(dz);
        const z2 = csub(z, dz);
        lam = lam ? cadd(lam, relLog(z, z2)) : null;   // (the continued log coordinate moves with z)
        z = z2;
      }
      const r0 = Hof(m, z, lam), dl = 1e-7 * (1 + cabs(z)), zp = cadd(z, [dl, 0]), rp = Hof(m, zp, lam ? cadd(lam, relLog(z, zp)) : null);
      newtWhy = 'residuals ' + hist.join(' ') + '; sheet ' + m.sheet + ' z ' + z[0].toExponential(3) + ',' + z[1].toExponential(3) + ' lam ' + (lam ? lam[0].toFixed(4) + ',' + lam[1].toFixed(4) : 'null') + ' dH ' + (r0 ? r0.dH[0].toExponential(3) + ',' + r0.dH[1].toExponential(3) : '-') + ' fwd ' + (r0 && rp ? ((rp.H[0] - r0.H[0]) / dl).toExponential(3) + ',' + ((rp.H[1] - r0.H[1]) / dl).toExponential(3) : '-');
      return null;
    }
    const relLog = (z, z2) => { const q = cdiv(z2, z); return [Math.log(cabs(q)), Math.atan2(q[1], q[0])]; };
    // the member of place vb that the carried point z of a member m is: the nearest of m's own sheet (the same z repeats on
    // sheets beside the frame's own, as different surfaces), within MATCH_TOL; -1 when none
    const matchIn = (vb, m, z) => {
      let bj = -1, bd = Infinity;
      vb.all.forEach((n, j) => { if (n.sheet !== m.sheet) return; const d = dist2(z, n.z); if (d < bd) { bd = d; bj = j; } });
      return bj >= 0 && bd <= o.MATCH_TOL * (1 + cabs(vb.all[bj].z)) ? bj : -1;
    };
    // the members of place va matched to those of vb by displacement: each to the member of its sheet nearest to it, accepted only where the
    // displacement is under DISP_SEP of the smallest distance between two members of that sheet at either place, and no two take one;
    // null when any member cannot be matched so
    function displacementMap(va, vb) {
      const sep = (v, sheet) => {
        let m = Infinity;
        for (let a = 0; a < v.all.length; a++) for (let b = a + 1; b < v.all.length; b++) if (v.all[a].sheet === sheet && v.all[b].sheet === sheet) m = Math.min(m, dist2(v.all[a].z, v.all[b].z));
        return m;
      };
      const map = [], used = new Set();
      for (const m of va.all) {
        let bj = -1, bd = Infinity;
        vb.all.forEach((n, j) => { if (n.sheet !== m.sheet) return; const d = dist2(m.z, n.z); if (d < bd) { bd = d; bj = j; } });
        if (bj < 0) { map.push(-1); continue; }
        if (!(bd < o.DISP_SEP * Math.min(sep(va, m.sheet), sep(vb, m.sheet))) || used.has(bj)) return null;
        used.add(bj); map.push(bj);
      }
      return map;
    }
    // all members of `from` carried from place wA to place wB in lockstep: { ok, z[], lam[] } or { ok: false, why }
    function track(from, wA, wB) {
      let zs = from.map((m) => m.z), lams = from.map((m) => m.lam), t = 0, dt = 1, steps = 0, last = '';
      const dw = csub(wB, wA);
      while (t < 1) {
        const tn = Math.min(1, t + dt), w = [wA[0] + dw[0] * tn, wA[1] + dw[1] * tn];
        const pre = [];
        for (let k = 0; k < from.length; k++) {
          const r = Hof(from[k], zs[k], lams[k]);
          if (!r) { pre.push(null); continue; }
          pre.push(cadd(zs[k], cdiv(cscale(dw, tn - t), r.dH)));
        }
        let good = pre.every((p) => p);
        if (!good) last = 'H or H\' not finite';
        const next = [], nl = [];
        if (good) for (let k = 0; k < from.length && good; k++) {
          const near = Math.min(Infinity, ...pre.map((q, i) => (i !== k && from[i].sheet === from[k].sheet ? dist2(pre[k], q) : Infinity)));
          const step = dist2(pre[k], zs[k]);
          if (step >= o.CONT_NEAR * near && step > 0) { good = false; last = 'step ' + step.toExponential(2) + ' vs near ' + near.toExponential(2); break; }
          const lam0 = lams[k] ? cadd(lams[k], relLog(zs[k], pre[k])) : null;
          const nw = newton(from[k], pre[k], lam0, w);
          if (!nw) { good = false; last = 'newton did not converge: ' + newtWhy; break; }
          if (nw.ratio > o.CONT_RATIO) { good = false; last = 'newton ratio ' + nw.ratio.toExponential(2); break; }
          if (dist2(nw.z, pre[k]) >= o.CONT_NEAR * Math.max(near, step * 4)) { good = false; last = 'correction ' + dist2(nw.z, pre[k]).toExponential(2); break; }
          next.push(nw.z); nl.push(nw.lam);
        }
        if (good) { zs = next; lams = nl; t = tn; dt = Math.min(dt * 2, 1 - t || 1); steps++; }
        else { dt /= 2; if (dt < o.CONT_STEP_MIN) return { ok: false, why: 'step floor at t=' + t.toExponential(2) + ': ' + last, steps }; }
        if (steps > 4000) return { ok: false, why: 'steps' };
      }
      return { ok: true, z: zs, lam: lams, steps };
    }
    // the edge from place A to place B: for each member of A the member of B it continues to (-1: none); suspect when the continuation fails
    const pairCache = new Map();
    function pairing(ka, kb, va, vb) {
      const key = ka + '|' + kb;
      if (pairCache.has(key)) return pairCache.get(key);
      let res;
      if (!va.all.length && !vb.all.length) res = { map: [], back: [], suspect: false };
      else if (!va.all.length || !vb.all.length) res = { map: va.all.map(() => -1), back: vb.all.map(() => -1), suspect: false };
      else if (o.seed) {
        // (the control's identity: the nearest enumerated member to the place's own, as a fresh Newton would land)
        const map = va.all.map((m) => { let bj = -1, bd = Infinity; vb.all.forEach((n, j) => { if (n.sheet !== m.sheet) return; const d = dist2(m.z, n.z); if (d < bd) { bd = d; bj = j; } }); return bj; });
        res = { map, back: vb.all.map((_, j) => map.indexOf(j)), suspect: false };
      } else {
        const tr = track(va.all, va.w, vb.w);
        if (!tr.ok) res = { map: null, back: null, suspect: true, why: tr.why };
        else {
          const map = tr.z.map((z, i) => matchIn(vb, va.all[i], z));
          const used = new Set(map.filter((j) => j >= 0));
          res = { map, back: vb.all.map((_, j) => map.indexOf(j)), suspect: used.size !== map.filter((j) => j >= 0).length, why: 'two members to one' };
        }
      }
      pairCache.set(key, res);
      return res;
    }
    // ---- one cell
    const pxOf = (l) => l.P;
    const bboxOf = (vs) => {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const v of vs) for (const m of v.all) for (const l of m.layers) { if (!l.P) continue; x0 = Math.min(x0, l.P[0]); x1 = Math.max(x1, l.P[0]); y0 = Math.min(y0, l.P[1]); y1 = Math.max(y1, l.P[1]); }
      return [x0, y0, x1, y1];
    };
    const put = (x, y) => { x = Math.floor(x); y = Math.floor(y); if (x >= 0 && y >= 0 && x < W2 && y < H2) px[y * W2 + x] = 1; };
    function fill(A, B, Cc) {
      const x0 = Math.max(0, Math.floor(Math.min(A[0], B[0], Cc[0]) - 0.5)), x1 = Math.min(W2 - 1, Math.ceil(Math.max(A[0], B[0], Cc[0]) + 0.5));
      const y0 = Math.max(0, Math.floor(Math.min(A[1], B[1], Cc[1]) - 0.5)), y1 = Math.min(H2 - 1, Math.ceil(Math.max(A[1], B[1], Cc[1]) + 0.5));
      const den = (B[1] - Cc[1]) * (A[0] - Cc[0]) + (Cc[0] - B[0]) * (A[1] - Cc[1]);
      if (Math.abs(den) < 1e-12) { put(A[0], A[1]); put(B[0], B[1]); put(Cc[0], Cc[1]); return; }
      const eps = 0.5 / Math.max(1, dist2(B, A), dist2(Cc, A), dist2(Cc, B));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const qx = x + 0.5, qy = y + 0.5, l1 = ((B[1] - Cc[1]) * (qx - Cc[0]) + (Cc[0] - B[0]) * (qy - Cc[1])) / den, l2 = ((Cc[1] - A[1]) * (qx - Cc[0]) + (A[0] - Cc[0]) * (qy - Cc[1])) / den, l3 = 1 - l1 - l2;
        if (l1 >= -eps && l2 >= -eps && l3 >= -eps) px[y * W2 + x] = 1;
      }
    }
    // the exact members at an inner place of a cell, identified by continuation from the corner `from` (index into corners)
    function* exactAt(w, anchors) {
      const e = frame.enumAt([w])[0] || [];
      places++; cells.places = places;
      return mkVert(w, e);
    }
    // the longest projected edge of a member of the cell's corners that the edges carry from one corner to the next
    const EDGES = [[0, 1], [0, 2], [1, 3], [2, 3]];
    function* pairedSegments(vs, cp) {
      for (const [a, b] of EDGES) {
        const pm = cp.P[a + ',' + b];
        if (!pm || !pm.map) continue;
        for (let i = 0; i < vs[a].all.length; i++) {
          const j = pm.map[i];
          if (j < 0) continue;
          const A = vs[a].all[i], B = vs[b].all[j];
          if (!A.drawn || !B.drawn) continue;
          for (const la of A.layers) { const lb = B.layers.find((l) => l.combo === la.combo); if (lb) yield [la.P, lb.P]; }
        }
      }
    }
    function pairedExtent(vs, cp) {
      let m = 0;
      for (const [P, Q] of pairedSegments(vs, cp)) m = Math.max(m, dist2(P, Q));
      return m;
    }
    // the cell's (a) test: corners carry the same members; E at the midpoints and the centre; returns { E, ratioOk, why } or null when not (a)
    function* judgeA(vs, pr, cell) {
      // pr: pairings of the four edges 0-1, 0-2, 1-3, 2-3 (member of the first place -> member of the second)
      const n = vs[0].all.length;
      let E = 0, ratio = true, worst = null;
      // the centre and the four edge midpoints, from the exact enumeration, each member paired with the corners' by continuation
      // (lattice places while the cell is halvable: they are the children's vertices and are kept)
      const [ci, cj, cs] = cell, hf = cs / 2, whole = Number.isInteger(hf);
      const at = (di, dj) => [ci + di * cs, cj + dj * cs];
      const mids = [[0, 1, at(0.5, 0)], [0, 2, at(0, 0.5)], [1, 3, at(1, 0.5)], [2, 3, at(0.5, 1)], [1, 2, at(0.5, 0.5)]];
      if (whole) yield* lookup(mids.map((m) => m[2]));
      const spots = mids.map(([a, b, ij]) => [a, b, whole ? vert(ij[0], ij[1]).w : wAt(ij[0], ij[1]), whole ? ij : null]);
      for (const [a, b, w, ij] of spots) {
        const mv = ij ? vert(ij[0], ij[1]) : yield* exactAt(w);
        const pa = pairingTo(vs[a], mv), pb = pairingTo(vs[b], mv);
        if (pa.suspect || pb.suspect) return { suspect: true, why: 'midpoint continuation' };
        // each member of the corner a pairs with its member at the midpoint, and the corner b's member of the same chain must be the same one
        for (let i = 0; i < n; i++) {
          const ib = pr.chain(a, b, i);
          const ja = pa.map[i], jb = ib < 0 ? -2 : pb.map[ib];
          if (ja < 0 || jb < 0 || ja !== jb) return { mismatch: true, why: 'midpoint pairing' };
          const A = vs[a].all[i], B = vs[b].all[ib], M = mv.all[ja];
          if (A.drawn !== B.drawn || A.drawn !== M.drawn) return { mismatch: true, why: 'drawn' };
          if (!A.drawn) continue;
          if (A.layers.length !== M.layers.length || B.layers.length !== M.layers.length) return { mismatch: true, why: 'layers' };
          A.layers.forEach((la, q) => {
            const lb = B.layers.find((l) => l.combo === la.combo), lm = M.layers.find((l) => l.combo === la.combo);
            if (!lb || !lm) { ratio = false; worst = { why: 'combo' }; return; }
            const lin = mid2(la.P, lb.P), e = dist2(lin, lm.P) * o.PX_FULL;
            if (e > E) { E = e; worst = { w, member: i, E: e }; }
          });
        }
      }
      return { E, ratio, worst };
    }
    // pairing of a corner's members to those of an inner place
    function pairingTo(va, vb) {
      if (o.seed) {
        const map = va.all.map((m) => { let bj = -1, bd = Infinity; vb.all.forEach((nn, j) => { if (nn.sheet !== m.sheet) return; const d = dist2(m.z, nn.z); if (d < bd) { bd = d; bj = j; } }); return bj; });
        return { map, suspect: false };
      }
      if (!va.all.length || !vb.all.length) return { map: va.all.map(() => -1), suspect: false };
      const tr = track(va.all, va.w, vb.w);
      if (!tr.ok) return { map: null, suspect: true, why: tr.why };
      return { map: tr.z.map((z, i) => matchIn(vb, va.all[i], z)), suspect: false };
    }
    // the corners' pairings; chain(a, b, i): the member of corner b the member i of corner a continues to along the cell's edge
    function cornerPairs(ks, vs) {
      const E = { '0,1': [0, 1], '0,2': [0, 2], '1,3': [1, 3], '2,3': [2, 3] };
      const P = {};
      let suspect = false, why = '';
      for (const [key, [a, b]] of Object.entries(E)) {
        const p = pairing(ks[a], ks[b], vs[a], vs[b]);
        P[key] = p;
        if (p.suspect) { suspect = true; why = p.why; }
      }
      const chain = (a, b, i) => {
        const p = P[a + ',' + b];
        if (p) return p.map[i];
        const q = P[b + ',' + a];
        if (q) return q.back[i];
        // (the diagonal 1-2: through corner 0)
        const via = a === 1 ? chainOf(1, 0, i) : chainOf(2, 0, i);
        return via < 0 ? -1 : chainOf(0, b, via);
      };
      const chainOf = chain;
      return { P, suspect, why, chain };
    }
    // the corners carry the same members, in the same order: the edges pair them one to one, the four-cycle closes, the drawn flags and masks agree
    function sameMembers(vs, cp) {
      const n = vs[0].all.length;
      if (vs.some((v) => v.all.length !== n || v.masked !== vs[0].masked)) return false;
      for (let i = 0; i < n; i++) {
        const b = cp.chain(0, 1, i), c = cp.chain(0, 2, i);
        if (b < 0 || c < 0) return false;
        const d1 = cp.chain(1, 3, b), d2 = cp.chain(2, 3, c);
        if (d1 < 0 || d2 < 0 || d1 !== d2) return false;
        if (vs[0].all[i].drawn !== vs[1].all[b].drawn || vs[0].all[i].drawn !== vs[2].all[c].drawn || vs[0].all[i].drawn !== vs[3].all[d1].drawn) return false;
      }
      return true;
    }
    // ---- the work: a stack of cells [i, j, s, depth], s the lattice size of the cell
    const work = [];
    for (let j = o.ny - 1; j >= 0; j--) for (let i = o.nx - 1; i >= 0; i--) work.push([i * FINE, j * FINE, FINE, 0]);
    const leaves = { boundary: [], branch: [] };
    let spun = 0;
    while (work.length) {
      const [i, j, s, d] = work.pop();
      const ci = [[i, j], [i + s, j], [i, j + s], [i + s, j + s]];
      yield* lookup(ci);
      if (capped) break;
      const vs = ci.map(([a, b]) => vert(a, b)), ks = ci.map(([a, b]) => a * (NYF + 1) + b);
      if (vs.every((v) => !v.all.some((m) => m.drawn)) && vs.every((v) => !v.all.length || v.masked)) { cells.empty++; continue; }
      const cp = cornerPairs(ks, vs);
      const split = () => { const h = s / 2; work.push([i, j, h, d + 1], [i + h, j, h, d + 1], [i, j + h, h, d + 1], [i + h, j + h, h, d + 1]); cells.splits++; };
      if (cp.suspect) {
        why('suspect: ' + cp.why);
        // a branch-suspect cell: halved until a certificate covers it, then decided at the boundary
        if (d < o.CELL_DEPTH_MAX) { split(); continue; }
        leaves.branch.push({ i, j, s, vs, why: cp.why });
        continue;
      }
      if (!sameMembers(vs, cp)) {
        why('members differ');
        if (d < o.CELL_DEPTH_MAX && pairedExtent(vs, cp) > o.BND_PX) { split(); continue; }
        leaves.boundary.push({ i, j, s, vs, cp });
        continue;
      }
      if (!vs[0].all.some((m) => m.drawn)) { cells.empty++; continue; }
      const jd = yield* judgeA(vs, cp, [i, j, s]);
      if (jd.suspect || jd.mismatch) why('judge: ' + jd.why);
      if (jd.suspect) { if (d < o.CELL_DEPTH_MAX) { split(); continue; } leaves.branch.push({ i, j, s, vs, why: jd.why }); continue; }
      if (jd.mismatch) { if (d < o.CELL_DEPTH_MAX) { split(); continue; } leaves.boundary.push({ i, j, s, vs, cp }); continue; }
      if (jd.E >= o.E_SAFE / 2) {
        why('E over');
        if (d < o.CELL_DEPTH_MAX) { split(); continue; }
        // a wall: the corners of one member stay apart however fine the cell
        const bb = bboxOf(vs);
        if (Math.max(bb[2] - bb[0], bb[3] - bb[1]) > o.JUMP_PX) { leaves.boundary.push({ i, j, s, vs, cp }); continue; }
        // (at the depth cap: only a branch certificate may take the cell; otherwise it is a failure of the cell's depth)
        leaves.branch.push({ i, j, s, vs, why: 'E over at the cap', kind: 'cellDepth', info: { depth: d, w: wAt(i, j), E: jd.E, worst: jd.worst } });
        continue;
      }
      // accepted: fill every drawn layer's two triangles
      cells.facet++;
      vs[0].all.forEach((m, k) => {
        if (!m.drawn) return;
        const k1 = cp.chain(0, 1, k), k2 = cp.chain(0, 2, k), k3 = cp.chain(1, 3, k1);
        m.layers.forEach((l) => {
          const q = [vs[1].all[k1], vs[2].all[k2], vs[3].all[k3]].map((mm) => mm.layers.find((x) => x.combo === l.combo));
          if (q.every((x) => x)) { fill(l.P, q[0].P, q[1].P); fill(q[0].P, q[1].P, q[2].P); }
        });
      });
      if (++spun % 64 === 0) { tick(); yield; }
    }
    if (leaves.branch.length) yield* certifyBranches(leaves);
    yield* boundaryRays(leaves.boundary.concat(leaves.branch.filter((c) => c.certified)));
    for (const c of leaves.branch) if (!c.certified) fail(Object.assign({ kind: c.kind || 'branch', i: c.i, j: c.j, w: wAt(c.i, c.j), why: c.certWhy || c.why }, c.info));
    return { px, cells, certs, failures };

    // ---- (c) branch certificates
    // the critical point c of H beside a branch-suspect cell, proved by a Kantorovich test on H' and its degree by the argument
    // principle on a circle about it; the enumerator's members inside the disc, at a place on each side of H(c) inside the
    // circle's image, must be d of them
    function* certifyBranches(lv) {
      yield* certifyPass(lv);
      // (a leaf met before the certificate of the cell beside it was issued is covered by it where it lies within its reach)
      for (const c of lv.branch) {
        if (c.certified) continue;
        const ctr = wAt(c.i + c.s / 2, c.j + c.s / 2), diag = dist2(wAt(c.i, c.j), wAt(c.i + c.s, c.j + c.s));
        const known = certs.find((q) => dist2(q.w, ctr) <= q.rImage + diag);
        if (known) c.certified = known;
      }
    }
    function* certifyPass(lv) {
      issueSingular(lv);
      for (const c of lv.branch) {
        const ctr0 = wAt(c.i + c.s / 2, c.j + c.s / 2), diag0 = dist2(wAt(c.i, c.j), wAt(c.i + c.s, c.j + c.s)), known0 = certs.find((q) => dist2(q.w, ctr0) <= q.rImage + diag0);
        if (known0) c.certified = known0;
      }
      for (const c of lv.branch) {
        if (c.certified) continue;
        const ctr = wAt(c.i + c.s / 2, c.j + c.s / 2), diag = dist2(wAt(c.i, c.j), wAt(c.i + c.s, c.j + c.s));
        const known = certs.find((q) => dist2(q.w, ctr) <= q.rImage + diag);
        if (known) { c.certified = known; continue; }
        if (certs.length >= o.CERT_MAX) { fail({ kind: 'certMax', max: o.CERT_MAX, w: ctr }); c.certWhy = 'certMax'; continue; }
        const ms = c.vs.flatMap((v) => v.all);
        let pair = null, best = Infinity;
        for (let a = 0; a < ms.length; a++) for (let b = a + 1; b < ms.length; b++) {
          if (ms[a].sheet !== ms[b].sheet) continue;
          const d = dist2(ms[a].z, ms[b].z);
          if (d > 0 && d < best) { best = d; pair = [ms[a], ms[b]]; }
        }
        if (!pair) { c.certWhy = 'no merging pair'; continue; }
        // the plan's own singular point drawn in this cell (a branch point of a root or a logarithm: H is not analytic there, so
        // there is no critical point of H' to find): a declared point whose place is in the cell certifies it
        const cert = certifyAt(pair, best, ms.filter((q) => q.sheet === pair[0].sheet));
        if (!cert.ok) { c.certWhy = cert.why; continue; }
        // the location test: H(c) lies inside a cell of the suspect ones (the control moves it one cell), and then covers its neighbours
        const wc = o.branch ? [cert.w[0] + o.branch * c.s * cellW, cert.w[1]] : cert.w;
        const holds = lv.branch.some((q) => { const a = wAt(q.i, q.j), b = wAt(q.i + q.s, q.j + q.s); return wc[0] >= a[0] && wc[0] <= b[0] && wc[1] >= a[1] && wc[1] <= b[1]; });
        if (holds) { cert.w = wc; certs.push(cert); c.certified = cert; }
        else c.certWhy = 'the critical point is not in a suspect cell';
        yield;
      }
    }
    // a declared singular point of the plan (a branch point of the colour map or the end of the lift: H or the height is not smooth there, so
    // there is no critical point of H' to find) certifies the suspect cells within its reach: where a suspect cell lies within SING_REACH
    // leaf cells of the place it is drawn at. The control displaces the point beyond that reach, so that the cells are not covered.
    function issueSingular(lv) {
      if (!frame.sing) return;
      if (singList === null) singList = frame.sing() || [];
      const reach = o.SING_REACH * cellW, shift = o.branch ? o.branch * 4 * reach : 0;
      for (const q of singList) {
        if (!q.w) continue;
        const w = [q.w[0] + shift, q.w[1]];
        const near = lv.branch.some((c) => dist2(w, mid2(wAt(c.i, c.j), wAt(c.i + c.s, c.j + c.s))) <= reach + dist2(wAt(c.i, c.j), wAt(c.i + c.s, c.j + c.s)));
        if (!near) continue;
        if (certs.length >= o.CERT_MAX) { fail({ kind: 'certMax', max: o.CERT_MAX, w }); continue; }
        const cert = { ok: true, singular: q.kind, z: q.z, w, c: q.z, d: null, r: 0, rImage: reach, kantorovich: null, winding: null, inDisc: null };
        certs.push(cert);
        // the cells within reach, and the cells of the same kind that touch them (within SING_ADJ leaf cells) up to SING_REACH_MAX leaf
        // cells from the point: the neighbourhood where the surface is not smooth at the depth the lattice reaches
        const cdist = (c) => dist2(w, mid2(wAt(c.i, c.j), wAt(c.i + c.s, c.j + c.s)));
        const seeds = lv.branch.filter((c) => cdist(c) <= reach + dist2(wAt(c.i, c.j), wAt(c.i + c.s, c.j + c.s)));
        const seen = new Set(seeds), stack = seeds.slice();
        while (stack.length) {
          const c = stack.pop();
          c.certified = cert;
          for (const d of lv.branch) {
            if (seen.has(d) || d.kind !== c.kind || cdist(d) > o.SING_REACH_MAX * cellW) continue;
            if (dist2(mid2(wAt(c.i, c.j), wAt(c.i + c.s, c.j + c.s)), mid2(wAt(d.i, d.j), wAt(d.i + d.s, d.j + d.s))) <= o.SING_ADJ * cellW) { seen.add(d); stack.push(d); }
          }
        }
      }
    }
    function certifyAt(pair, sep, group) {
      const simple = certifySimple(pair, sep);
      if (simple.ok || !simple.degenerate) return simple;
      return certifyCluster(pair, sep, group, simple);
    }
    // a critical point of H that is not simple (H' has a zero of order m >= 2 there, as for a cube): the argument principle on a circle
    // counts the zeros of H' (m of them), their centroid is the point c, a circle a CERT_TIGHT share as wide holds all m, and the winding
    // of H - H(c) is m + 1, the local degree
    function certifyCluster(pair, sep, group, simple) {
      const m0 = pair[0], zc = group.reduce((a, q) => cadd(a, q.z), [0, 0]).map((x) => x / group.length);
      const lam0 = m0.lam ? cadd(m0.lam, relLog(m0.z, zc)) : null, lamAt = (z) => (lam0 ? cadd(lam0, relLog(zc, z)) : null);
      const dHat = (z) => { const r = Hof(m0, z, lamAt(z)); return r ? r.dH : null; };
      const R = 2 * Math.max(...group.map((q) => dist2(q.z, zc)), sep);
      // the winding and the centroid integral of f = H' about a circle (c0, r): adaptive steps of argument at most CERT_ARG
      const ring = (c0, r) => {
        let tot = 0, cen = [0, 0];
        const at = (th) => dHat(cadd(c0, [r * Math.cos(th), r * Math.sin(th)])), stack = [];
        for (let k = o.CERT_WIND; k > 0; k--) stack.push([2 * Math.PI * (k - 1) / o.CERT_WIND, 2 * Math.PI * k / o.CERT_WIND]);
        let steps = 0;
        while (stack.length) {
          const [a, b] = stack.pop(), A = at(a), B = at(b);
          if (!A || !B || cabs(A) < 1e-300 || cabs(B) < 1e-300) return null;
          const dth = Math.atan2(A[0] * B[1] - A[1] * B[0], A[0] * B[0] + A[1] * B[1]);
          if (Math.abs(dth) > o.CERT_ARG && b - a > 1e-9) { const mm = (a + b) / 2; stack.push([mm, b], [a, mm]); continue; }
          const lg = Math.log(cabs(B) / cabs(A)), zm = cadd(c0, [r * Math.cos((a + b) / 2), r * Math.sin((a + b) / 2)]);
          tot += dth; cen = cadd(cen, cscale([zm[0] * dth + zm[1] * lg, zm[1] * dth - zm[0] * lg], 1 / (2 * Math.PI)));
          if (++steps > 1e5) return null;
        }
        return { wind: tot / (2 * Math.PI), cen };
      };
      const big = ring(zc, R);
      if (!big) return { ok: false, why: 'cluster: H\' on the circle (' + simple.why + ')' };
      const mm = Math.round(big.wind);
      if (Math.abs(big.wind - mm) > o.CERT_WIND_RES || mm < 1) return { ok: false, why: 'cluster: zeros of H\' ' + big.wind.toFixed(4) };
      const c = cscale(big.cen, 1 / mm), r = R * o.CERT_TIGHT, small = ring(c, r);
      if (!small || Math.abs(small.wind - mm) > o.CERT_WIND_RES) return { ok: false, why: 'cluster: not tight ' + (small ? small.wind.toFixed(4) : 'x') };
      const rc = Hof(m0, c, lamAt(c));
      if (!rc) return { ok: false, why: 'cluster: H at c' };
      const at = (th) => { const zz = cadd(c, [r * Math.cos(th), r * Math.sin(th)]), rr = Hof(m0, zz, lamAt(zz)); return rr ? csub(rr.H, rc.H) : null; };
      let total = 0, rImage = Infinity, steps = 0;
      const stack = [];
      for (let k = o.CERT_WIND; k > 0; k--) stack.push([2 * Math.PI * (k - 1) / o.CERT_WIND, 2 * Math.PI * k / o.CERT_WIND]);
      while (stack.length) {
        const [a, b] = stack.pop(), A = at(a), B = at(b);
        if (!A || !B) return { ok: false, why: 'cluster: H on the circle' };
        const d = Math.atan2(A[0] * B[1] - A[1] * B[0], A[0] * B[0] + A[1] * B[1]);
        if (Math.abs(d) > o.CERT_ARG && b - a > 1e-9) { const mid = (a + b) / 2; stack.push([mid, b], [a, mid]); continue; }
        total += d; rImage = Math.min(rImage, cabs(A));
        if (++steps > 1e5) return { ok: false, why: 'winding steps' };
      }
      const deg = total / (2 * Math.PI), dd = Math.round(deg);
      if (Math.abs(deg - dd) > o.CERT_WIND_RES || dd !== mm + 1) return { ok: false, why: 'cluster: degree ' + deg.toFixed(4) + ' for ' + mm + ' zeros' };
      const inDisc = [[1, 0], [-1, 0]].map(([ux, uy]) => {
        const e = frame.enumAt([[rc.H[0] + ux * rImage / 2, rc.H[1] + uy * rImage / 2]])[0] || [];
        return e.filter((q) => q.sheet === m0.sheet && dist2(q.z, c) < r).length;
      });
      if (inDisc.some((q) => q !== dd)) return { ok: false, why: 'cluster: members in the disc ' + inDisc.join(',') + ' of ' + dd, inDisc };
      return { ok: true, c, w: rc.H, r, rImage, d: dd, kantorovich: null, cluster: { zeros: mm, R }, winding: deg, inDisc };
    }
    function certifySimple(pair, sep) {
      const m = pair[0], z0 = mid2(pair[0].z, pair[1].z), lam0 = m.lam ? cadd(m.lam, relLog(m.z, z0)) : null;
      const lamAt = (z) => (lam0 ? cadd(lam0, relLog(z0, z)) : null);
      const dHat = (z) => { const r = Hof(m, z, lamAt(z)); return r ? r.dH : null; };
      const delta = o.CERT_DELTA * (1 + cabs(z0));
      const d2H = (z) => { const a = dHat(cadd(z, [delta, 0])), b = dHat(csub(z, [delta, 0])); return a && b ? cscale(csub(a, b), 1 / (2 * delta)) : null; };
      const f = dHat(z0), fp = d2H(z0);
      if (!f || !fp || cabs(fp) < o.CERT_DEGEN * cabs(f) / (1 + sep)) return { ok: false, why: 'no derivative', degenerate: true };
      // Kantorovich for f = H': beta = 1/|f'|, eta = |f|/|f'|, the Lipschitz constant of f' (H''') sampled on the disc of radius rho
      const beta = 1 / cabs(fp), eta = cabs(f) * beta, rho = Math.max(2 * eta, sep * o.CERT_RHO_MIN);
      let lip = 0;
      for (let k = 0; k < o.CERT_LIP_N; k++) {
        const a = 2 * Math.PI * k / o.CERT_LIP_N, q = cadd(z0, [rho * Math.cos(a), rho * Math.sin(a)]);
        const u = d2H(cadd(q, [delta, 0])), v = d2H(csub(q, [delta, 0]));
        if (!u || !v) return { ok: false, why: 'no second derivative on the disc' };
        lip = Math.max(lip, cabs(cscale(csub(u, v), 1 / (2 * delta))));
      }
      lip *= o.CERT_LIP_SAFE;
      const kh = beta * eta * lip * beta;
      if (!(kh <= 0.5)) return { ok: false, why: 'Kantorovich h=' + kh.toExponential(2) + ' over 1/2', kh, degenerate: true };
      let c = z0;
      for (let it = 0; it < o.NEWT_ITER * 4; it++) {
        const fc = dHat(c), fpc = d2H(c);
        if (!fc || !fpc) return { ok: false, why: 'derivative lost' };
        if (cabs(fc) <= o.CERT_CRIT_TOL) break;
        c = csub(c, cdiv(fc, fpc));
      }
      if (dist2(c, z0) > rho) return { ok: false, why: 'Newton left the disc' };
      const rc = Hof(m, c, lamAt(c));
      if (!rc) return { ok: false, why: 'H at the critical point' };
      // the local degree: the winding of H(z) - H(c) about the circle of radius r
      const r = o.CERT_R * Math.max(sep, o.CERT_RHO_MIN);
      const at = (th) => { const zz = cadd(c, [r * Math.cos(th), r * Math.sin(th)]), rr = Hof(m, zz, lamAt(zz)); return rr ? csub(rr.H, rc.H) : null; };
      let total = 0, rImage = Infinity, steps = 0;
      const stack = [];
      for (let k = o.CERT_WIND; k > 0; k--) stack.push([2 * Math.PI * (k - 1) / o.CERT_WIND, 2 * Math.PI * k / o.CERT_WIND]);
      while (stack.length) {
        const [a, b] = stack.pop(), A = at(a), B = at(b);
        if (!A || !B) return { ok: false, why: 'H on the circle' };
        const d = Math.atan2(A[0] * B[1] - A[1] * B[0], A[0] * B[0] + A[1] * B[1]);
        if (Math.abs(d) > o.CERT_ARG && b - a > 1e-9) { const mm = (a + b) / 2; stack.push([mm, b], [a, mm]); continue; }
        total += d; rImage = Math.min(rImage, cabs(A));
        if (++steps > 1e5) return { ok: false, why: 'winding steps' };
      }
      const deg = total / (2 * Math.PI), d = Math.round(deg);
      if (Math.abs(deg - d) > o.CERT_WIND_RES || d < 2) return { ok: false, why: 'degree ' + deg.toFixed(4) };
      const inDisc = [[1, 0], [-1, 0]].map(([ux, uy]) => {
        const e = frame.enumAt([[rc.H[0] + ux * rImage / 2, rc.H[1] + uy * rImage / 2]])[0] || [];
        return e.filter((q) => q.sheet === m.sheet && dist2(q.z, c) < r).length;
      });
      if (inDisc.some((q) => q !== d)) return { ok: false, why: 'members in the disc ' + inDisc.join(',') + ' of ' + d, inDisc };
      return { ok: true, c, w: rc.H, r, rImage, d, kantorovich: { kh, rho, lip }, winding: deg, inDisc };
    }
    // ---- (b) rays: each pixel under a boundary cell is decided by bisection along its own ray
    function* boundaryRays(list) {
      const wPx = (box.x1 - box.x0) / W2;
      let n = 0;
      for (const c of list) {
        const pts = [];
        for (const v of c.vs) for (const m of v.all) for (const l of m.layers) pts.push(l.P);
        if (!pts.length) continue;
        cells[c.certified ? 'branch' : 'boundary']++;
        // the pixels to decide: those close to a drawn member's corners, and to the edges that carry it from one corner to the next
        // (a certified cell's members are not paired along edges: all of its corners' bounding box)
        const cand = new Set(), R = o.CAND_R;
        const mark = (P) => { for (let y = Math.floor(P[1] - R); y <= Math.floor(P[1] + R); y++) for (let x = Math.floor(P[0] - R); x <= Math.floor(P[0] + R); x++) if (x >= 0 && y >= 0 && x < W2 && y < H2) cand.add(y * W2 + x); };
        if (c.certified || !c.cp) {
          const bb = bboxOf(c.vs);
          for (let y = Math.floor(bb[1] - R); y <= Math.ceil(bb[3] + R); y++) for (let x = Math.floor(bb[0] - R); x <= Math.ceil(bb[2] + R); x++) if (x >= 0 && y >= 0 && x < W2 && y < H2) cand.add(y * W2 + x);
        } else {
          pts.forEach(mark);
          for (const [P, Q] of pairedSegments(c.vs, c.cp)) { const k = Math.max(1, Math.ceil(dist2(P, Q) / (R / 2))); for (let t = 1; t < k; t++) mark([P[0] + (Q[0] - P[0]) * t / k, P[1] + (Q[1] - P[1]) * t / k]); }
        }
        const hs = c.vs.flatMap((v) => v.all.flatMap((m) => m.layers.map((l) => l.h)));
        const lo = Math.min(...hs), hi = Math.max(...hs), pad = o.RAY_PAD * (hi - lo) + 1e-6;
        const sh = o.seam ? o.seam * FINE * cellW : 0;   // (the control moves the seam one cell of the lattice: the rays test the place one cell over)
        const w0 = wAt(c.i, c.j), w1 = wAt(c.i + c.s, c.j + c.s), mg = (w1[0] - w0[0]) * o.RAY_BOX;
        const bx = [w0[0] + sh - mg, w0[1] - mg, w1[0] + sh + mg, w1[1] + mg], cen = mid2([bx[0], bx[1]], [bx[2], bx[3]]);
        for (const key of cand) {
          if (px[key]) continue;
          const x = key % W2, y = (key - x) / W2;
          cells.rays++;
          if (rayHit([x + 0.5, y + 0.5], lo - pad, hi + pad, bx, cen, wPx)) { px[key] = 1; cells.hits++; }
          if (++n % 16 === 0) yield;
        }
      }
    }
    // the place under a pixel at a height: the ground point (x, y) with project(x, y, h) = q (Newton on the projection's own Jacobian)
    function solveW(q, h, g) {
      let w = g;
      const e = cellW * 0.25 + 1e-12;
      for (let it = 0; it < 8; it++) {
        const P = frame.project(w[0], w[1], h), Px = frame.project(w[0] + e, w[1], h), Py = frame.project(w[0], w[1] + e, h);
        if (!P || !Px || !Py) return null;
        const a = (Px[0] - P[0]) / e, b = (Py[0] - P[0]) / e, c2 = (Px[1] - P[1]) / e, d = (Py[1] - P[1]) / e, det = a * d - b * c2;
        if (Math.abs(det) < 1e-18) return null;
        const rx = q[0] - P[0], ry = q[1] - P[1];
        if (Math.hypot(rx, ry) < 1e-6) return w;
        w = [w[0] + (d * rx - b * ry) / det, w[1] + (-c2 * rx + a * ry) / det];
      }
      return w;
    }
    // does the pixel's ray (heights hLo..hHi over the pixel) meet a drawn member's surface over the box bx?
    function rayHit(q, hLo, hHi, bx, cen, wPx) {
      const inBox = (w) => !!w && w[0] >= bx[0] && w[0] <= bx[2] && w[1] >= bx[1] && w[1] <= bx[3];
      const hAt = (t) => hLo + (hHi - hLo) * t;
      // the part of the ray over the box: a scan, the samples then taken between its ends
      const N0 = o.RAY_SAMPLES * 4;
      let g = cen, first = -1, last = -1;
      for (let k = 0; k <= N0; k++) { const w = solveW(q, hAt(k / N0), g); if (w) g = w; if (inBox(w)) { if (first < 0) first = k; last = k; } }
      if (first < 0) return false;
      const tA = Math.max(0, (first - 1) / N0), tB = Math.min(1, (last + 1) / N0);
      const at = (t) => {
        const w = solveW(q, hAt(t), g);
        if (!w) return null;
        g = w; places++; cells.places = places;
        return { t, h: hAt(t), v: mkVert(w, frame.enumAt([w])[0] || []) };
      };
      const smp = [];
      for (let k = 0; k <= o.RAY_SAMPLES; k++) { const s = at(tA + (tB - tA) * k / o.RAY_SAMPLES); if (s) smp.push(s); }
      // a sample at a declared singular point of the plan (a branch point, where the members' surfaces meet): a drawn member is there
      // and the pixel is covered; no identity is needed or defined (the members all coincide)
      if (frame.sing) {
        if (singList === null) singList = frame.sing() || [];
        for (const sm of smp) for (const q of singList) {
          if (q.w && dist2(sm.v.w, q.w) <= o.SING_PX * wPx && sm.v.all.some((m) => m.drawn)) { cells.apex++; return true; }
        }
      }
      const layerG = (v, j, combo, h) => { const m = v.all[j]; if (!m || !m.drawn) return null; const l = m.layers.find((x) => x.combo === combo); return l ? h - l.h : null; };
      // where member k of sample A is at the sample S: its index there (carried by continuation), or -1
      const carry = (A, S) => {
        if (o.seed) return pairingTo(A.v, S.v).map;
        if (!A.v.all.length) return [];
        const tr = track(A.v.all, A.v.w, S.v.w);
        if (tr.ok) return tr.z.map((z, i) => matchIn(S.v, A.v.all[i], z));
        // (the continuation reached its step floor, beside a singular point of H: members are matched by displacement alone where
        // that is under half of the smallest separation of its sheet's members at both places, which makes the match unique)
        const near = displacementMap(A.v, S.v);
        if (near) return near;
        fail({ kind: 'rayIdentity', w: A.v.w, why: tr.why });
        return null;
      };
      const range = Math.max(hHi - hLo, 1e-12), wTiny = o.RAY_SUB_PX * wPx;
      for (let a = 0; a + 1 < smp.length; a++) {
        const A = smp[a], B = smp[a + 1], mapB = carry(A, B);
        if (!mapB) continue;
        for (let k = 0; k < A.v.all.length; k++) for (const la of A.v.all[k].layers) {
          const gA = layerG(A.v, k, la.combo, A.h);
          if (gA === null) continue;
          // the state of the member at the sample S: { present, g }
          const state = (S) => { const cm = carry(A, S), j = cm ? cm[k] : -1; if (j === undefined || j < 0) return { present: false }; const gg = layerG(S.v, j, la.combo, S.h); return gg === null ? { present: false } : { present: true, g: gg }; };
          const sB = state(B);
          if (gA === 0) return true;
          if (sB.present && Math.sign(sB.g) === Math.sign(gA) && sB.g !== 0) continue;
          // a bracket [lo, hi] with the member present and g of A's sign at lo; hi absent, or g of the other sign
          let lo = A, glo = gA, hi = B, hiPresent = sB.present, ghi = sB.g, it = 0;
          for (; it < o.RAY_ITER; it++) {
            if (dist2(lo.v.w, hi.v.w) <= wTiny) break;
            const M = at((lo.t + hi.t) / 2);
            if (!M) break;
            const sM = state(M);
            if (sM.present && Math.sign(sM.g) === Math.sign(gA) && sM.g !== 0) { lo = M; glo = sM.g; } else { hi = M; hiPresent = sM.present; ghi = sM.g; }
          }
          if (it >= o.RAY_ITER) { fail({ kind: 'rayIter', w: A.v.w }); continue; }
          // the stretch where it is present ends at lo: a sign change (a crossing: IVT between A and lo) or the surface's end
          if (hiPresent) {
            // a crossing of the surface where g is small at both ends of the narrowed bracket, else a wall (g jumps)
            if (Math.abs(glo) <= o.HIT_TOL * range && Math.abs(ghi) <= o.HIT_TOL * range) return true;
          }
        }
      }
      return false;
    }
  }
  function run(gen) { let r; do { r = gen.next(); } while (!r.done); return r.value; }
  return { refImage, run, CONSTS };
})()
