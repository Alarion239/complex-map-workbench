// @ts-check
'use strict';
// The constructions on a curve C (notes/orthogonal-circle): Inside C only and Between z0 and z1 (segments/SPEC.md),
// the perpendicular circle (SPEC.md) and the touching circle (TANGENT-SPEC.md). Moved out of constr.js (issue #20,
// the file-size budget) as a factory constr.js calls where these sections stood, with the names of its own they
// read; constr.js takes the names back.
const ConstrOrtho = (host) => {
  const {
    FLIPPED, INF, TAU, abs, add, canonKey, decOf, decompose, div, dot, eqP, fOf, flipG, formOfFields, gc, geomOf,
    handleKeys, handlePos, index, isCurveRef, isInf, isPointRef, isXY, ldexp, lists, mR, makeCtx, meets, mrTaus,
    onCarrier, onPiece, orientD, projectPiece, pts3In, reanchor, reanchorAt, recompute, resolveIn, scl, sub
  } = host;

  // ---------------------------------------------------------------- Inside C only (notes/orthogonal-circle/segments/SPEC.md)
  // A perpendicular circle K with def.seg = 1 | -1 is the arc of K where seg f_Gc < 0 (Gc: C's piece form, the flip of a
  // constructed C undone), its ends K ∩ C. Runtime only: s._seg = {G, H, k, side, Gc, u0, D, ends: [start, end], m: [the
  // meets in Intersect's order K, C], L, kind, fields}; K's glider map z(u) = mR(H, k tan(pi u)) (H: K anchored at P, or Q
  // when P is infinity; k = sg |PQ|, as pts3In) runs from ends[0] (u0) to ends[1] (u0 + D)
  // the u of a point w of K, in [0, 1) (infinity: 1/2)
  function segU(H, k, w) {
    if (isInf(w)) return 0.5;
    const v = sub(w, H.o), den = [H.B[0] + H.A * v[0] / 2, H.B[1] + H.A * v[1] / 2], tau = div(v, [-den[1], den[0]])[0];
    let t = Math.atan(tau / k) / Math.PI;
    if (!Number.isFinite(t)) t = 0.5;
    return ((t % 1) + 1) % 1;
  }
  function segAtU(q, u) { u = ((u % 1) + 1) % 1; return Math.abs(u - 0.5) < 1e-15 ? mR(q.H, Infinity) : mR(q.H, q.k * Math.tan(Math.PI * u)); }
  const span1 = (a, b) => ((((b - a) % 1) + 1) % 1);
  const cpz = (z) => (isInf(z) ? INF : z.slice());
  // on the arc, by its u (the ends with a margin of 1e-12)
  const segInU = (q, u) => { const v = span1(q.u0, u); return v <= q.D + 1e-12 || v >= 1 - 1e-12; };
  // the chordal distance on the Riemann sphere (infinity included)
  function chordal(a, b) {
    const w = (z) => (isInf(z) ? 0 : 1 / Math.sqrt(1 + z[0] * z[0] + z[1] * z[1]));
    if (isInf(a) && isInf(b)) return 0;
    if (isInf(a) || isInf(b)) return 2 * w(isInf(a) ? b : a);
    return 2 * abs(sub(a, b)) * w(a) * w(b);
  }
  // segOf(G, GcP, Gc, side, P, Q, flip): K's form G, C's piece form GcP (the meets: Intersect's), Gc (the side)
  function segOf(G, GcP, Gc, side, P, Q, flip) {
    const m = meets(G, GcP);
    if (!m || m[0] == null || m[1] == null) return { undef: 'nomeet' };
    const fin = [P, Q].filter((z) => !isInf(z));
    if (!fin.length) return { undef: 'lineInf' };
    const k = (flip ? -1 : 1) * (fin.length === 2 ? abs(sub(fin[1], fin[0])) : 1);
    const q = { G, H: reanchorAt(G, fin[0]), k, side, Gc };
    const u = m.map((z) => segU(q.H, k, z));
    // the arc u0 -> u1 (u increasing) whose middle (its quarter when the middle is infinity) is on the side
    const sideOk = (a, b) => { let z = segAtU(q, a + span1(a, b) / 2); if (!isXY(z)) z = segAtU(q, a + span1(a, b) / 4); return isXY(z) && fOf(Gc, z) * side < 0; };
    const i0 = sideOk(u[0], u[1]) ? 0 : 1;
    q.u0 = u[i0]; q.D = span1(u[i0], u[1 - i0]);
    if (!(q.D > 0)) return { undef: 'nomeet' };
    q.ends = [cpz(m[i0]), cpz(m[1 - i0])]; q.m = [cpz(m[0]), cpz(m[1])];
    return segTail(q);
  }
  // the rest of a seg object once its ends, u0 and D are known: its middle, its size, and the shape's fields (the middle of
  // the arc, or its quarter when the middle is infinity)
  function segTail(q) {
    let mid = segAtU(q, q.u0 + q.D / 2);
    if (!isXY(mid)) mid = segAtU(q, q.u0 + q.D / 4);
    const fe = q.ends.filter(isXY);
    q.L = Math.max(...fe.map((e) => abs(sub(e, mid))), 1e-300);
    // the shape's fields, for code that knows only kinds (hit tests, Preimage packing, v16.2): an arc a, m, b, or a ray
    // from the finite end when the other is infinity (C and K both lines)
    if (fe.length === 2) { q.kind = 'arc'; q.fields = { a: q.ends[0].slice(), m: mid.slice(), b: q.ends[1].slice(), c: undefined, r: undefined, complement: undefined }; }
    else { q.kind = 'ray'; q.fields = { a: fe[0].slice(), b: mid.slice(), m: undefined, c: undefined, r: undefined, complement: undefined }; }
    return q;
  }
  // [issue #70] "Between z0 and z1": the true hyperbolic segment of K from P to Q (no tails): of the two arcs of K between
  // them, the one that K's two meets with C do not cut (P and Q on the same side of C, inside or outside). On opposite
  // sides each arc holds a meet: undefined ('betweenSides'). A point on C is an end of the segment. The same seg object as
  // segOf's (ends, u0, D, H, k), so gliders, crossings, hit tests, the images and the globe treat it as that arc.
  function betweenOf(G, GcP, P, Q, flip) {
    if (isInf(P) || isInf(Q)) return { undef: 'lineInf' };
    const m = meets(G, GcP);
    if (!m || m[0] == null || m[1] == null) return { undef: 'nomeet' };
    const dist = abs(sub(Q, P));
    if (!(dist > 0)) return { undef: 'coincide' };
    const k = (flip ? -1 : 1) * dist;
    const q = { G, H: reanchorAt(G, P), k };
    const uP = segU(q.H, k, P), uQ = segU(q.H, k, Q), um = m.map((z) => segU(q.H, k, z));
    // a meet strictly inside the arc from a to b (increasing u), with a margin so a meet at an end does not count
    const cut = (a, b) => um.some((u) => { const v = span1(a, u), D = span1(a, b); return v > 1e-12 && v < D - 1e-12; });
    const fwd = cut(uP, uQ), back = cut(uQ, uP);
    if (fwd === back) return { undef: 'betweenSides' };
    const [a, b] = fwd ? [uQ, uP] : [uP, uQ];
    q.u0 = a; q.D = span1(a, b);
    if (!(q.D > 0)) return { undef: 'coincide' };
    q.ends = fwd ? [cpz(Q), cpz(P)] : [cpz(P), cpz(Q)]; q.m = [cpz(m[0]), cpz(m[1])];
    return segTail(q);
  }
  // the form a perpendicular circle's side is measured against: C's piece form, a constructed C's flip undone
  const gcOf = (C, pc) => (pc && pc.G ? (C && C.def && C.def.flip && FLIPPED.includes(C.def.op) ? flipG(pc.G) : pc.G) : null);
  // the side drawn when the switch is turned on (SPEC 2.2): C drawn as a region, its region; a circle, its disc; a line,
  // P's side (Q's when P is on C or infinity; else above C, or left of it when C is steeper than 45 degrees)
  function segSideOf(C, pc, P, Q) {
    const Gc = gcOf(C, pc);
    if (!Gc) return 1;
    if (C && (C.kind === 'disc' || C.kind === 'halfplane')) {
      const R = C._g || formOfFields(C);
      const lam = R ? (R.A !== 0 || Gc.A !== 0 ? R.A * Gc.A : dot(R.B, Gc.B)) : 0;
      if (lam) return lam > 0 ? 1 : -1;
    }
    if (Gc.A !== 0) return Gc.A > 0 ? 1 : -1;
    for (const z of [P, Q]) if (isXY(z) && !onCarrier(Gc, z, null)) return fOf(Gc, z) < 0 ? 1 : -1;
    const g = geomOf(Gc), steep = Math.abs(g.d[1]) > Math.abs(g.d[0]);
    return fOf(Gc, add(g.p, steep ? [-1, 0] : [0, 1])) < 0 ? 1 : -1;
  }
  // the two sides of a perpendicular circle's C, by their words: {line, steep, Gc, sides: [[word, seg], [word, seg]],
  // seg (now: 0, 1, -1), dflt (segSideOf)} | null. A circle: in (bounded), out; a line: above, below (left, right when
  // steeper than 45 degrees)
  function segSides(state, id, env) {
    const ctx = makeCtx(state, env, null), e = ctx.idx.get(id), s = e && e.s, d = s && s.def;
    if (!d || d.op !== 'perp' || !isCurveRef(d.args[0])) return null;
    const ce = ctx.idx.get(d.args[0].s), C = ce && ce.s, pc = C && ctx.piecesOf(C)[d.args[0].part];
    if (!pc || (pc.kind !== 'line' && pc.kind !== 'circle')) return null;
    const Gc = gcOf(C, pc);
    if (!Gc) return null;
    const R = d.args.slice(1).map((r) => resolveIn(ctx, r, e.plane)), pt = (r) => (r && !r.undef && !r.inf ? r.z : null);
    const out = { line: Gc.A === 0, steep: false, Gc, seg: d.seg === 1 || d.seg === -1 ? d.seg : 0, dflt: segSideOf(C, pc, pt(R[0]), pt(R[1])) };
    if (Gc.A !== 0) out.sides = [['in', Gc.A > 0 ? 1 : -1], ['out', Gc.A > 0 ? -1 : 1]];
    else {
      const g = geomOf(Gc);
      out.steep = Math.abs(g.d[1]) > Math.abs(g.d[0]);
      const s1 = fOf(Gc, add(g.p, out.steep ? [-1, 0] : [0, 1])) < 0 ? 1 : -1;
      out.sides = out.steep ? [['left', s1], ['right', -s1]] : [['above', s1], ['below', -s1]];
    }
    out.word = out.seg ? out.sides.find((x) => x[1] === out.seg)[0] : null;
    return out;
  }
  // z's mirror image in the curve of the form G, on the sphere: a circle swaps its centre and infinity; a line keeps
  // infinity (review math-2)
  function mirrorIn(G, z) {
    if (isInf(z)) return G.A === 0 ? INF : geomOf(G).c.slice();
    if (!isXY(z)) return null;
    if (G.A === 0) { const f = fOf(G, z), b2 = dot(G.B, G.B); return b2 > 0 ? sub(z, scl(G.B, f / b2)) : null; }
    const g = geomOf(G), v = sub(z, g.c), d2 = dot(v, v);
    return d2 > 0 ? add(g.c, scl(v, g.r * g.r / d2)) : INF;
  }
  // Constr.setSeg(state, id, seg, env): Inside C only on (1 | -1) or off (0) on the perpendicular circle id, its gliders
  // moved so none leaves the drawn curve (SPEC 4): on, a glider off the drawn side goes to its mirror image in C (on K,
  // on the arc); the other side, every glider to its mirror image; off, every glider keeps its point. One state change
  // (the caller records one undo step). Returns the ids of K's gliders, or null
  function setSeg(state, id, seg, env) {
    const e = index(state).get(id), s = e && e.s, d = s && s.def;
    if (!d || d.op !== 'perp') return null;
    // (Whole while Between is on: Between goes off)
    if (d.between === 1 && !(seg === 1 || seg === -1)) return setBetween(state, id, false, env);
    const was = d.seg === 1 || d.seg === -1 ? d.seg : 0, now = seg === 1 || seg === -1 ? seg : 0;
    if (was === now) return [];
    const info = segSides(state, id, env), Gc = info && info.Gc;
    const gl = lists(state)[e.plane].filter((g) => g && g.def && g.def.op === 'glider' && Array.isArray(g.def.args) && g.def.args[0] && g.def.args[0].s === id);
    // (a glider at infinity is the point infinity: review math-2; f_Gc there has the sign of Gc.A, 0 for a line)
    const want = gl.map((g) => {
      const z = g._atInf ? INF : g.p;
      if (g.cundef || !(isInf(z) || isXY(z))) return null;
      if (!Gc || !now) return cpz(z);
      if (!was && now * (isInf(z) ? Gc.A : fOf(Gc, z)) <= 0) return cpz(z);
      return mirrorIn(Gc, z) || cpz(z);
    });
    if (now) { d.seg = now; d.fill = 'none'; delete d.between; } else delete d.seg;
    recompute(state, { all: true }, env);
    if (!s.cundef) {
      const ctx = makeCtx(state, env, null), p3 = now ? null : pts3In(ctx, s, e.plane);
      gl.forEach((g, i) => {
        const w = want[i], pc = w && ctx.piecesOf(s)[g.def.args[0].part];
        if (!pc) return;
        const mr = !now && pc.c3 && p3 && p3 !== 'inf' ? p3 : null;
        // (off, infinity: K's u = 1/2 when K's map is the M(R) one; else its t stays)
        if (isInf(w) && !now) { if (mr && mr.mr) g.t = 0.5; return; }
        const pr = projectPiece(pc, w, mr);
        if (pr && Number.isFinite(pr.t)) g.t = pr.t;
      });
      recompute(state, { all: true }, env);
    }
    return gl.map((g) => g.id);
  }
  // [issue #70] Constr.setBetween(state, id, on, env): Between z0 and z1 on (true) or off on the perpendicular circle id (on
  // clears Inside C only: the two are one choice). Its gliders move so none leaves the drawn curve: on, a glider off the
  // segment goes to its nearer end; off, every glider keeps its point. One state change (the caller records one undo
  // step). Returns the ids of K's gliders, or null
  function setBetween(state, id, on, env) {
    const e = index(state).get(id), s = e && e.s, d = s && s.def;
    if (!d || d.op !== 'perp') return null;
    const was = d.between === 1, now = !!on;
    if (was === now && !(now && (d.seg === 1 || d.seg === -1))) return [];
    const gl = lists(state)[e.plane].filter((g) => g && g.def && g.def.op === 'glider' && Array.isArray(g.def.args) && g.def.args[0] && g.def.args[0].s === id);
    const want = gl.map((g) => { const z = g._atInf ? INF : g.p; return g.cundef || !(isInf(z) || isXY(z)) ? null : cpz(z); });
    if (now) { d.between = 1; delete d.seg; d.fill = 'none'; } else delete d.between;
    recompute(state, { all: true }, env);
    if (!s.cundef) {
      const ctx = makeCtx(state, env, null), p3 = now ? null : pts3In(ctx, s, e.plane);
      gl.forEach((g, i) => {
        let w = want[i];
        const pc = w && ctx.piecesOf(s)[g.def.args[0].part];
        if (!pc) return;
        if (now && pc.seg && !onPiece(pc, w)) w = chordal(w, pc.seg.ends[0]) <= chordal(w, pc.seg.ends[1]) ? cpz(pc.seg.ends[0]) : cpz(pc.seg.ends[1]);
        const mr = !now && pc.c3 && p3 && p3 !== 'inf' ? p3 : null;
        if (isInf(w) && !now) { if (mr && mr.mr) g.t = 0.5; return; }
        const pr = projectPiece(pc, w, mr);
        if (pr && Number.isFinite(pr.t)) g.t = pr.t;
      });
      recompute(state, { all: true }, env);
    }
    return gl.map((g) => g.id);
  }
  // the drawn curve of a seg K on a circle (SPEC 6.1; a line's arc is Region.segCurvesOf's: the chord, or the line kinds'
  // long rays, review math-1, math-4): one open curve object. A circle no larger than 50 window diagonals (Region's
  // MR_RATIO): f by its angle, as a whole circle is drawn, the ends exact; a larger one: f the M(R) map of K anchored at the
  // window's foot (as Region's mrCurve), restricted to the arc, and gsamp sampleMR's samples of K (dense within 1.25x the
  // window, geometric beyond), those on the arc in order, the ends first and last, bitwise
  function segCurves(q, win) {
    if (!win || !(win.x1 - win.x0 > 0)) { const c = q.ends.find(isXY) || [0, 0], h = Math.max(1, q.L); win = { x0: c[0] - h, x1: c[0] + h, y0: c[1] - h, y1: c[1] + h }; }
    const cx = (win.x0 + win.x1) / 2, cy = (win.y0 + win.y1) / 2, diag = Math.hypot(win.x1 - win.x0, win.y1 - win.y0);
    const H = reanchor(q.G, [cx, cy]), H0 = Object.assign({}, H, { C: 0 });
    const tauOf = (z) => { if (isInf(z)) return Infinity; const v = sub(z, H0.o), den = [H0.B[0] + H0.A * v[0] / 2, H0.B[1] + H0.A * v[1] / 2]; return div(v, [-den[1], den[0]])[0]; };
    const phi = (z) => { const t = tauOf(z); return Number.isFinite(t) ? Math.atan(t / diag) : Math.PI / 2; };
    const mod = (x) => (((x % Math.PI) + Math.PI) % Math.PI);
    let mid = segAtU(q, q.u0 + q.D / 2);
    if (!isXY(mid)) mid = segAtU(q, q.u0 + q.D / 4);
    const C2 = (z) => (z ? { re: z[0], im: z[1] } : { re: NaN, im: NaN });
    const g = geomOf(q.G);
    if (!(g.r > 50 * diag)) {
      const ang = (z) => Math.atan2(z[1] - g.c[1], z[0] - g.c[0]), m2 = (x) => (((x % TAU) + TAU) % TAU);
      const as = ang(q.ends[0]), ae = ang(q.ends[1]), am = ang(mid);
      const Da = m2(am - as) < m2(ae - as) ? (m2(ae - as) || TAU) : -(m2(as - ae) || TAU);
      return [{ n0: 160, closed: false, cap: 'butt', gform: q.G, seg: true,
        f: (x) => (x <= 0 ? C2(q.ends[0]) : x >= 1 ? C2(q.ends[1]) : C2([g.c[0] + g.r * Math.cos(as + x * Da), g.c[1] + g.r * Math.sin(as + x * Da)])) }];
    }
    const ps = phi(q.ends[0]), pe = phi(q.ends[1]), pm = phi(mid);
    // the direction of increasing angle from the start: the one that meets the middle before the end
    const up = mod(pm - ps) < mod(pe - ps);
    const Dl = up ? mod(pe - ps) || Math.PI : -(mod(ps - pe) || Math.PI);
    const at = (p) => { const z = mR(H0, diag * Math.tan(p)); return isInf(z) || !isXY(z) ? null : z; };
    return [{ n0: 400, closed: false, cap: 'butt', gform: q.G, seg: true,
      f: (x) => (x <= 0 ? C2(q.ends[0]) : x >= 1 ? C2(q.ends[1]) : C2(at(ps + x * Dl))),
      gsamp: (w, step) => segSample(q, w || win, step) }];
  }
  // the samples of a seg curve on a huge circle (Float64Array [x0, y0, ...]): sampleMR's parameters at the window w
  function segSample(q, w, step) {
    const cx = (w.x0 + w.x1) / 2, cy = (w.y0 + w.y1) / 2;
    const H = reanchor(q.G, [cx, cy]), H0 = Object.assign({}, H, { C: 0 });
    const ts = mrTaus(H, w, step);
    const tauOf = (z) => { if (isInf(z)) return Infinity; const v = sub(z, H0.o), den = [H0.B[0] + H0.A * v[0] / 2, H0.B[1] + H0.A * v[1] / 2]; return div(v, [-den[1], den[0]])[0]; };
    let mid = segAtU(q, q.u0 + q.D / 2);
    if (!isXY(mid)) mid = segAtU(q, q.u0 + q.D / 4);
    const t0 = tauOf(q.ends[0]), t1 = tauOf(q.ends[1]), tm = tauOf(mid);
    // on the projective line: the arc from t0 to t1 through tm, increasing (wrapping through infinity) or decreasing
    const inc = (a, b, x) => (a <= b ? x > a && x < b : x > a || x < b);
    const up = inc(t0, t1, tm);
    const inArc = (x) => (up ? inc(t0, t1, x) : inc(t1, t0, x));
    // the parameters in arc order: from t0 in the arc's direction to the list's end, then (when the arc passes through
    // infinity) from the list's other end; null marks infinity
    const n = ts.length, out = [], seq = [];
    const push = (z) => { out.push(z[0], z[1]); };
    let all = true;
    if (up) {
      let j = 0;
      while (j < n && !(ts[j] > t0)) j++;
      for (; j < n; j++) { if (!inArc(ts[j])) { all = false; break; } seq.push(ts[j]); }
      if (all && t0 > t1) { seq.push(null); for (let k = 0; k < n && inArc(ts[k]); k++) seq.push(ts[k]); }
    } else {
      let j = n - 1;
      while (j >= 0 && !(ts[j] < t0)) j--;
      for (; j >= 0; j--) { if (!inArc(ts[j])) { all = false; break; } seq.push(ts[j]); }
      if (all && t1 > t0) { seq.push(null); for (let k = n - 1; k >= 0 && inArc(ts[k]); k--) seq.push(ts[k]); }
    }
    // (through the antipode: the parameter infinity, a point of the circle)
    push(q.ends[0]);
    for (const x of seq) push(mR(H0, x === null ? Infinity : x));
    push(q.ends[1]);
    return new Float64Array(out);
  }

  // ---------------------------------------------------------------- the perpendicular circle (notes/orthogonal-circle/SPEC.md)
  // perpForm(Gc, P, Q): the generalized circle through P and Q that crosses the curve of the form Gc at right angles.
  // Lifted, a point z is the row (|z - o|^2, 2(z - o), 1) and a curve G the row (-C/2, B, -A/2): a form passes through
  // z when it is orthogonal to z's row, and crosses G at right angles when it is orthogonal to G's row. Anchored at P
  // (C = 0): (A, Bx, By) = (|d|^2, 2d) x (-C'/2, B'), d = Q - P, (A', B', C') = Gc re-anchored at P; Q = INF: (0, -B'y,
  // B'x). Every step is exact (dyadic BigInt on the doubles), with one rounding at the end, so the right angle holds to
  // the last rounding wherever P and Q are (on the curve, at its centre, next to P's mirror image P*). {G} | {undef}
  const dz = (x) => { const [m, e] = decompose(x); return { m, e }; };
  const dmul = (a, b) => ({ m: a.m * b.m, e: a.e + b.e });
  const dadd = (a, b) => { if (a.m === 0n) return b; if (b.m === 0n) return a; if (a.e < b.e) [a, b] = [b, a]; return { m: (a.m << BigInt(a.e - b.e)) + b.m, e: b.e }; };
  const dneg = (a) => ({ m: -a.m, e: a.e });
  const dsub = (a, b) => dadd(a, dneg(b));
  const TWO = { m: 2n, e: 0 };
  // dyadics to doubles under one common power of two (gc normalizes after: no overflow, no underflow of the largest)
  function dScaled(xs) {
    const len = (a) => (a.m < 0n ? -a.m : a.m).toString(2).length;
    const top = Math.max(...xs.filter((a) => a.m !== 0n).map((a) => len(a) + a.e));
    return xs.map((a) => {
      if (a.m === 0n) return 0;
      const neg = a.m < 0n, M = neg ? -a.m : a.m, sh = Math.max(0, len(a) - 64);
      return (neg ? -1 : 1) * ldexp(Number(M >> BigInt(sh)), sh + a.e - top);
    });
  }
  // [v16.3 review math-3, math-4] numbers as the decimals the user snapped or typed (decOf: 12 digits), scaled to integers
  // under one power of ten: BigInts, or null when one is not such a decimal (or the scales are too far apart)
  /** @returns {bigint[] | null} */
  function decInts(xs) {
    const ds = xs.map(decOf);
    if (ds.some((d) => !d)) return null;
    const es = ds.filter((d) => d[0] !== 0n).map((d) => d[1]);
    if (!es.length) return ds.map(() => 0n);
    const E = Math.min(...es);
    if (Math.max(...es) - E > 80) return null;
    return ds.map(([m, e]) => (m === 0n ? 0n : m * 10n ** BigInt(e - E)));
  }
  // perpForm(Gc, P, Q, pc?): pc, C's piece, gives the decimals C was drawn with (a circle's centre and radius, a line's
  // two points) for the decimal rules below; without it (or when they are not decimals) only the exact rules apply
  function perpForm(Gc, P, Q, pc) {
    if (!Gc) return { undef: 'notCircle' };
    if (isInf(P) && isInf(Q)) return { undef: 'lineInf' };
    const zero = (z) => !isInf(z) && z[0] === 0 && z[1] === 0;
    // the anchor: P; Q when P is infinity, or when Q alone is exactly 0 (the Lambda rule's thru0 [C9]). Swapping the two
    // point rows turns the null vector over: sg = -1 keeps the curve's orientation
    let sg = 1;
    if (isInf(P) || (zero(Q) && !zero(P))) { [P, Q] = [Q, P]; sg = -1; }
    if (!isInf(Q) && eqP(P, Q)) return { undef: 'coincide' };
    const A0 = dz(Gc.A), Bx0 = dz(Gc.B[0]), By0 = dz(Gc.B[1]), C0 = dz(Gc.C);
    const ux = dsub(dz(P[0]), dz(Gc.o[0])), uy = dsub(dz(P[1]), dz(Gc.o[1]));
    const Bx1 = dadd(Bx0, dmul(A0, ux)), By1 = dadd(By0, dmul(A0, uy));
    const C1 = dadd(dadd(dmul(A0, dadd(dmul(ux, ux), dmul(uy, uy))), dmul(TWO, dadd(dmul(Bx0, ux), dmul(By0, uy)))), C0);
    let A, Bx, By;
    if (isInf(Q)) { A = { m: 0n, e: 0 }; Bx = dneg(By1); By = Bx1; }
    else {
      const dx = dsub(dz(Q[0]), dz(P[0])), dy = dsub(dz(Q[1]), dz(P[1])), dd = dadd(dmul(dx, dx), dmul(dy, dy));
      A = dmul(TWO, dsub(dmul(dx, By1), dmul(dy, Bx1)));
      Bx = dsub(dneg(dmul(dy, C1)), dmul(dd, By1));
      By = dadd(dmul(dd, Bx1), dmul(dx, C1));
    }
    if (A.m === 0n && Bx.m === 0n && By.m === 0n) return { undef: 'pencil' };      // Q = P* (or P at the centre, Q = INF)
    let [a, bx, by] = dScaled([A, Bx, By]);
    const fin2 = !isInf(P) && !isInf(Q);
    // [v16.3 review math-3, user-9] Q = P* in the decimals (the exact test above sees it only when P* is a double): a
    // circle C (c, r): P, Q collinear with c and (P - c).(Q - c) = r^2; a line C through a, b: Q - P perpendicular to
    // b - a and the midpoint of P Q on it. One configuration, one outcome: the pencil, as for 0.5 and 2
    if (fin2 && pc && pc.kind === 'circle' && Gc.A !== 0 && isXY(pc.c) && pc.r > 0 && orientD(pc.c, P, Q) === 0) {
      const v = decInts([P[0], P[1], Q[0], Q[1], pc.c[0], pc.c[1], pc.r]);
      if (v) { const [px, py, qx, qy, cx, cy, rr] = v; if ((px - cx) * (qx - cx) + (py - cy) * (qy - cy) === rr * rr) return { undef: 'pencil' }; }
    }
    // [v16.3.1, verify-1] C through three points p1, p2, p3 (a 3-point circle, an arc): its centre and radius are not
    // decimals, but its form is rational in the points. Anchored at p1, f(z) = A|u|^2 + D ux + E uy (circle3's A, D,
    // E); P, Q are mirror images when A u v* + (D - iE) u / 2 + (D + iE) v* / 2 = 0 (u = P - p1, v = Q - p1), both
    // parts tested exactly in the decimals scaled to integers. (A 0 here and not in the form, or the reverse, by
    // incidence: the decimals do not describe the form, and the rule is skipped)
    const p3 = pc && (pc.kind === 'circle' || pc.kind === 'line') ? pc.arc3 || (pc.G && pc.G.p3) || (pc.G && pc.G.pts && pc.G.pts.length === 3 ? pc.G.pts : null) : null;
    if (fin2 && p3 && p3.every(isXY)) {
      const v = decInts([p3[0][0], p3[0][1], p3[1][0], p3[1][1], p3[2][0], p3[2][1], P[0], P[1], Q[0], Q[1]]);
      if (v) {
        const [x1, y1, x2, y2, x3, y3, px, py, qx, qy] = v;
        const q1x = x2 - x1, q1y = y2 - y1, r1x = x3 - x1, r1y = y3 - y1, sq = q1x * q1x + q1y * q1y, sr = r1x * r1x + r1y * r1y;
        const A3 = q1x * r1y - q1y * r1x, D3 = sr * q1y - sq * r1y, E3 = sq * r1x - sr * q1x;
        const ux = px - x1, uy = py - y1, vx = qx - x1, vy = qy - y1;
        if ((A3 === 0n) === (Gc.A === 0)
          && 2n * A3 * (ux * vx + uy * vy) + D3 * (ux + vx) + E3 * (uy + vy) === 0n
          && 2n * A3 * (uy * vx - ux * vy) + D3 * (uy - vy) + E3 * (vx - ux) === 0n) return { undef: 'pencil' };
      }
    }
    if (fin2 && pc && pc.kind === 'line' && Gc.A === 0 && isXY(pc.a) && isXY(pc.b)) {
      const v = decInts([pc.a[0], pc.a[1], pc.b[0], pc.b[1], P[0], P[1], Q[0], Q[1]]);
      if (v) {
        const [ax, ay, bx2, by2, px, py, qx, qy] = v, ex = bx2 - ax, ey = by2 - ay;
        if ((qx - px) * ex + (qy - py) * ey === 0n) {
          if (ex * ((py - ay) + (qy - ay)) - ey * ((px - ax) + (qx - ax)) === 0n) return { undef: 'pencil' };
          // [v16.3 review math-4] P Q perpendicular to the line C in the decimals: K is the line P Q itself (the circle
          // of radius ~1e16 that rounding gives is not drawn, named a disc, or met at a finite far point), its side
          // from the rounded form, as the circle rule below
          if (a !== 0) {
            const d = sub(Q, P), L = abs(d), sn = Math.sign(bx * d[1] - by * d[0]);
            if (sn !== 0) { a = 0; bx = sn * d[1] / L; by = -sn * d[0] / L; }
          }
        }
      }
    }
    // [math-3] Gc anchored at its centre (B = 0: a circle, a disc, an annulus, a sector's arc): A = -2 A' orient(o, P, Q),
    // so K is the line P Q itself when the decimals the user snapped are collinear with the centre
    if (a !== 0 && !isInf(Q) && Gc.A !== 0 && Gc.B[0] === 0 && Gc.B[1] === 0 && orientD(Gc.o, P, Q) === 0) {
      const d = sub(Q, P), L = abs(d), sn = Math.sign(bx * d[1] - by * d[0]);
      if (sn !== 0) { a = 0; bx = sn * d[1] / L; by = -sn * d[0] / L; }
    }
    const G = gc(sg * a, [sg * bx, sg * by], 0, P);
    return G ? { G } : { undef: 'pencil' };
  }

  // ---------------------------------------------------------------- touching (notes/orthogonal-circle/TANGENT-SPEC.md)
  // a dyadic to a double (one rounding)
  const dnum1 = (a) => { if (a.m === 0n) return 0; const neg = a.m < 0n, M = neg ? -a.m : a.m, sh = Math.max(0, M.toString(2).length - 64); return (neg ? -1 : 1) * ldexp(Number(M >> BigInt(sh)), sh + a.e); };
  // Gc re-anchored at p, exactly: {A, Bx, By, C} dyadic (C = f(p))
  function atD(Gc, p) {
    const A0 = dz(Gc.A), Bx0 = dz(Gc.B[0]), By0 = dz(Gc.B[1]), C0 = dz(Gc.C);
    const ux = dsub(dz(p[0]), dz(Gc.o[0])), uy = dsub(dz(p[1]), dz(Gc.o[1]));
    return { A: A0, Bx: dadd(Bx0, dmul(A0, ux)), By: dadd(By0, dmul(A0, uy)), C: dadd(dadd(dmul(A0, dadd(dmul(ux, ux), dmul(uy, uy))), dmul(TWO, dadd(dmul(Bx0, ux), dmul(By0, uy)))), C0) };
  }
  // touchForm(Gc, T, P): the generalized circle touching Gc at T (a point of Gc) through P. Anchored at T (C = 0):
  // (A, B) = (-2 d.B', |d|^2 B'), d = P - T, B' = Gc's B at T; P = INF: (0, B'), the tangent at T. {G, tp} | {undef}
  function touchForm(Gc, T, P) {
    if (!Gc) return { undef: 'notCircle' };
    if (isInf(T) && isInf(P)) return { undef: 'lineInf' };
    if (isInf(T)) {
      if (Gc.A !== 0) return { undef: 'argUndef' };
      return { G: { A: 0, B: Gc.B.slice(), C: 0, o: P.slice() }, tp: INF };     // (C's B bitwise: exactly parallel)
    }
    if (!isInf(P) && eqP(P, T)) return { undef: 'coincide' };
    const c = atD(Gc, T);
    let A, Bx, By, o = T;
    if (isInf(P)) { A = { m: 0n, e: 0 }; Bx = c.Bx; By = c.By; }
    else {
      const dx = dsub(dz(P[0]), dz(T[0])), dy = dsub(dz(P[1]), dz(T[1])), dd = dadd(dmul(dx, dx), dmul(dy, dy));
      A = dmul({ m: -2n, e: 0 }, dadd(dmul(dx, c.Bx), dmul(dy, c.By)));
      Bx = dmul(dd, c.Bx); By = dmul(dd, c.By);
      // the Lambda rule [C9]: P alone exactly 0 -> anchored at P, exactly: B + A d, C = 0
      if (P[0] === 0 && P[1] === 0 && !(T[0] === 0 && T[1] === 0)) { Bx = dadd(Bx, dmul(A, dx)); By = dadd(By, dmul(A, dy)); o = P; }
    }
    if (A.m === 0n && Bx.m === 0n && By.m === 0n) return { undef: 'coincide' };
    const [a, bx, by] = dScaled([A, Bx, By]);
    const G = gc(a, [bx, by], 0, o);
    return G ? { G, tp: T.slice() } : { undef: 'coincide' };
  }
  // tangentNear(Gc, T, Z): the tangent at T to the circle Gc as a click target of the touching circle (TANGENT-SPEC.md
  // 4): {G, z, d}, the tangent, the foot of Z on it and Z's distance to it (world units). null: Gc a line or no tangent
  function tangentNear(Gc, T, Z) {
    if (!Gc || Gc.A === 0 || isInf(T) || isInf(Z)) return null;
    const r = touchForm(Gc, T, INF);
    if (!r.G) return null;
    const g = geomOf(r.G), L = Math.hypot(g.d[0], g.d[1]);
    if (!(L > 0)) return null;
    const u = [g.d[0] / L, g.d[1] / L], w = sub(Z, g.p), tt = dot(w, u);
    const z = [g.p[0] + tt * u[0], g.p[1] + tt * u[1]];
    return { G: r.G, z, d: Math.hypot(Z[0] - z[0], Z[1] - z[1]) };
  }
  // tangentForm(Gc, P, k): the line through P touching the circle Gc; k = 0 touches left of the ray P -> centre, k = 1
  // right. B', s^2 = A f(P), N^2 = |B'|^2 - s^2 exact; n = (N B' + sg s J B') / |B'|^2. A line Gc: its parallel, at INF
  function tangentForm(Gc, P, k) {
    if (!Gc) return { undef: 'notCircle' };
    if (isInf(P)) return { undef: 'lineInf' };
    if (Gc.A === 0) return { G: { A: 0, B: Gc.B.slice(), C: 0, o: P.slice() }, tp: INF };   // (C's B bitwise: exactly parallel)
    const c = atD(Gc, P), s2d = dmul(c.A, c.C);
    if (s2d.m < 0n) return { undef: 'inside' };
    const b2d = dadd(dmul(c.Bx, c.Bx), dmul(c.By, c.By));
    const Bx = dnum1(c.Bx), By = dnum1(c.By), b2 = dnum1(b2d), sq = Math.sqrt(dnum1(s2d)), N = Math.sqrt(dnum1(dsub(b2d, s2d)));
    const sg = k === 1 ? 1 : -1;
    const G = gc(0, [(N * Bx - sg * sq * By) / b2, (N * By + sg * sq * Bx) / b2], 0, P);
    if (!G) return { undef: 'coincide' };
    const u = [-G.B[1], G.B[0]], t = -(Bx * u[0] + By * u[1]) / Gc.A;
    return { G, tp: [P[0] + t * u[0], P[1] + t * u[1]] };
  }
  // the touching point of two pieces by construction (a touch or tangent piece and the curve it was built on, or two
  // touches of one curve at one point), else null
  const sameG = (a, b) => !!a && !!b && a.A === b.A && a.C === b.C && a.B[0] === b.B[0] && a.B[1] === b.B[1] && a.o[0] === b.o[0] && a.o[1] === b.o[1];
  function touchAt(pa, pb) {
    const ta = pa.G && pa.G.tch, tb = pb.G && pb.G.tch;
    if (ta && sameG(ta.G, pb.G)) return ta.tp;
    if (tb && sameG(tb.G, pa.G)) return tb.tp;
    if (ta && tb && sameG(ta.G, tb.G) && !isInf(ta.tp) && !isInf(tb.tp) && eqP(ta.tp, tb.tp)) return ta.tp;
    return null;
  }
  // [v16.4 segments SPEC 2.3] the meets of a seg K and the curve C it was built on: the drawn ends, bitwise (order K, C:
  // index i is the meet i of K's form with C's; order C, K: the entering rule reverses at a right angle, so i <-> 1 - i)
  function segAt(pa, pb) {
    const ka = pa.seg && pa.G && pa.G.sg, kb = pb.seg && pb.G && pb.G.sg;
    if (ka && sameG(ka.G, pb.G)) return [{ z: cpz(ka.ends[0]), index: 0 }, { z: cpz(ka.ends[1]), index: 1 }];
    if (kb && sameG(kb.G, pa.G)) return [{ z: cpz(kb.ends[1]), index: 0 }, { z: cpz(kb.ends[0]), index: 1 }];
    return null;
  }
  // two seg pieces on the same C with a common end (both infinity, or within 1e-9 of the larger arc's size)
  function segParallel(pa, pb) {
    const ka = pa.seg && pa.G && pa.G.sg, kb = pb.seg && pb.G && pb.G.sg;
    if (!ka || !kb || !sameG(ka.G, kb.G)) return false;
    const L = Math.max(pa.seg.L, pb.seg.L);
    return pa.seg.ends.some((e) => pb.seg.ends.some((f) => (isInf(e) && isInf(f)) || (isXY(e) && isXY(f) && (eqP(e, f) || abs(sub(e, f)) <= 1e-9 * L))));
  }
  // a point ref on a curve ref by construction (a glider on it, a meet with it, one of its defining points, a handle of
  // its shape at an end of the piece), through bound handles
  const POSK = /^(p|a|b|m|c|v\d+)$/;
  function onCurveByRefs(state, pref, cref) {
    if (!isPointRef(pref) || !isCurveRef(cref)) return false;
    const ctx = makeCtx(state, {}, null);
    const same = (c) => isCurveRef(c) && c.s === cref.s && c.part === cref.part;
    const k = canonKey(ctx, pref), m = /^s:([^:]+)$/.exec(k);
    const pe = m ? ctx.idx.get(m[1]) : null, d = pe && pe.s.def;
    if (d && ((d.op === 'glider' && same(d.args[0])) || (d.op === 'meet' && d.args.some(same)))) return true;
    const e = ctx.idx.get(cref.s);
    if (!e) return false;
    const C = e.s, cd = C.def, keys = new Set();
    if (cd && cd.op === 'circle3') cd.args.forEach((r) => keys.add(canonKey(ctx, r)));
    if (cd && (cd.op === 'perp' || cd.op === 'touch' || cd.op === 'tangent')) cd.args.slice(1).forEach((r) => { if (r && !r.inf) keys.add(canonKey(ctx, r)); });
    // (never a rectangle's corner: its corners are re-sorted from min/max, so a handle drag moves corner a to other
    // sides while the curve ref keeps its part [v16.3 review math-1])
    const pc = !cd && C.kind !== 'rect' ? ctx.piecesOf(C)[cref.part] : null;
    if (pc) {
      const ends = [pc.a, pc.b].concat(pc.arc3 || []).filter(isXY);
      for (const h of handleKeys(C)) { if (!POSK.test(h)) continue; const z = handlePos(C, h); if (z && ends.some((w) => eqP(w, z))) keys.add(canonKey(ctx, { s: C.id, h })); }
    }
    return keys.has(k);
  }

  return {
    segU, segAtU, span1, cpz, segInU, chordal, segOf, betweenOf, gcOf, segSideOf, segSides, mirrorIn, setSeg,
    setBetween, segCurves, perpForm, touchForm, tangentNear, tangentForm, touchAt, segAt, segParallel, onCurveByRefs
  };
};
export { ConstrOrtho };
