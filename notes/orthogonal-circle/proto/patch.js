// Builds proto/constr.js: v16.1's src/constr.js (= v16.2's) with the perpendicular circle of SPEC.md section 3 applied.
// Evidence only (the build applies the same edits to the work copy). Run: node notes/orthogonal-circle/proto/patch.js
'use strict';
const fs = require('fs'), path = require('path');
const SRC = path.join(__dirname, '../../v16.1-candidate/src/constr.js');
let s = fs.readFileSync(SRC, 'utf8');
const rep = (a, b) => { const n = s.split(a).length - 1; if (n !== 1) throw new Error(`anchor found ${n} times: ${a.slice(0, 70)}`); s = s.replace(a, () => b); };

// 1. the core function, after reanchorAt
rep(`  // ---------------------------------------------------------------- recompute (SPEC 3)`, `  // ---------------------------------------------------------------- the perpendicular circle (notes/orthogonal-circle/SPEC.md)
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
  function perpForm(Gc, P, Q) {
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
    // [math-3] Gc anchored at its centre (B = 0: a circle, a disc, an annulus, a sector's arc): A = -2 A' orient(o, P, Q),
    // so K is the line P Q itself when the decimals the user snapped are collinear with the centre
    if (a !== 0 && !isInf(Q) && Gc.A !== 0 && Gc.B[0] === 0 && Gc.B[1] === 0 && orientD(Gc.o, P, Q) === 0) {
      const d = sub(Q, P), L = abs(d), sn = Math.sign(bx * d[1] - by * d[0]);
      if (sn !== 0) { a = 0; bx = sn * d[1] / L; by = -sn * d[0] / L; }
    }
    const G = gc(sg * a, [sg * bx, sg * by], 0, P);
    return G ? { G } : { undef: 'pencil' };
  }

  // ---------------------------------------------------------------- recompute (SPEC 3)`);

// 2. evalNode: the perp branch
rep(`      if (op === 'meet' || op === 'glider') {
        const cs = [];`, `      if (op === 'perp') {
        const cr = args[0];
        if (!isCurveRef(cr)) return fail(U('argUndef', { x: null }));
        const e = ctx.idx.get(cr.s);
        if (!e || e.plane !== plane || e.s.cundef || e.s.undef) return fail(U('argUndef', { x: cr.s }));
        const pc = ctx.piecesOf(e.s)[cr.part];
        if (!pc || (pc.kind !== 'line' && pc.kind !== 'circle') || !pc.G) return fail(U('notCircle', { x: cr.s }));
        // the curve's own orientation: Use complement on a 3-point or perpendicular circle does not turn K over
        const cd = e.s.def, Gc = cd && cd.flip && (cd.op === 'circle3' || cd.op === 'perp') ? flipG(pc.G) : pc.G;
        const R = [args[1], args[2]].map(pt);
        const bad = R.find((x) => x.undef);
        if (bad) return fail(bad);
        const P = R[0].inf ? INF : R[0].z, Q = R[1].inf ? INF : R[1].z;
        const r = perpForm(Gc, P, Q);
        if (r.undef) return fail(U(r.undef));
        let G = r.G;
        // at creation (SPEC 2.3, as circle3): the disc; a line keeps the left side of P -> Q
        if (def.flip == null) def.flip = !isInf(P) && !isInf(Q) && (G.A < 0 || (G.A === 0 && dot(geomOf(G).d, sub(Q, P)) < 0));
        if (def.flip) G = flipG(G);
        const fin = [P, Q].filter((z) => !isInf(z));
        if (fin.length === 2) { G.e = abs(sub(fin[1], fin[0])); withPts(G, fin); }
        if (G.o[0] === 0 && G.o[1] === 0) G.thru0 = true;
        const ff = fieldsOfForm(G, def.fill === 'in');
        const rr = setKind(s, ff.kind, ff.f);
        s._g = G;
        res.ch = true; res.kindChanged = rr.kindChanged;
        return res;
      }
      if (op === 'meet' || op === 'glider') {
        const cs = [];`);

// 3. pieces: the c3 flag
rep(`if (out[0] && s.def && s.def.op === 'circle3') out[0].c3 = true;`, `if (out[0] && s.def && (s.def.op === 'circle3' || s.def.op === 'perp')) out[0].c3 = true;`);

// 4. OPS and validate
rep(`const OPS = { circle3: { n: 3, pts: true },`, `const OPS = { circle3: { n: 3, pts: true }, perp: { n: 3, sig: ['c', 'p', 'p'] },`);
rep(`          else if (O.curves && !d.args.every((r) => okCurveRef(r, plane))) ok = false;`, `          else if (O.curves && !d.args.every((r) => okCurveRef(r, plane))) ok = false;
          else if (O.sig && !d.args.every((r, i) => (O.sig[i] === 'c' ? okCurveRef(r, plane) : okPointRef(r, plane)))) ok = false;`);
rep(`          if (ok && d.op === 'circle3' && d.fill !== 'in') d.fill = 'none';
          if (ok && d.op === 'circle3' && d.flip != null) d.flip = !!d.flip;`, `          if (ok && (d.op === 'circle3' || d.op === 'perp') && d.fill !== 'in') d.fill = 'none';
          if (ok && (d.op === 'circle3' || d.op === 'perp') && d.flip != null) d.flip = !!d.flip;`);

// 5. the glider parameter: pts3In, glide, projectPiece
rep(`  function pts3In(ctx, cs, plane) {
    if (!cs || !cs.def || cs.def.op !== 'circle3') return null;`, `  function pts3In(ctx, cs, plane) {
    // a perpendicular circle: the M(R) map anchored at P, scaled by |PQ|, its sign undoing the flip
    // (z(t) = mR(K at P, sg |PQ| tan(pi t)): P at 0, the point opposite P at 1/2, infinity there for a line)
    if (cs && cs.def && cs.def.op === 'perp') {
      const R = cs.def.args.slice(1).map((r) => resolveIn(ctx, r, plane));
      if (R.some((x) => x.undef)) return 'inf';
      const fin = R.filter((x) => !x.inf).map((x) => x.z);
      if (!fin.length) return 'inf';
      return { mr: fin[0], s: fin.length === 2 ? abs(sub(fin[1], fin[0])) : 1, sg: cs.def.flip ? -1 : 1 };
    }
    if (!cs || !cs.def || cs.def.op !== 'circle3') return null;`);
rep(`    if (pts3) { const u = (((t % 1) + 1) % 1);`, `    if (pts3 && pts3.mr) {
      const u = (((t % 1) + 1) % 1), H = reanchorAt(pc.G, pts3.mr);
      return Math.abs(u - 0.5) < 1e-15 ? mR(H, Infinity) : mR(H, pts3.sg * pts3.s * Math.tan(Math.PI * u));
    }
    if (pts3) { const u = (((t % 1) + 1) % 1);`);
rep(`    if (pts3) {
      const w = projectForm(pc.G, z);`, `    if (pts3 && pts3.mr) {
      // tau of the nearest point w: w - o = i B tau / (1 - i A tau / 2), so tau = (w - o) / (i (B + A (w - o) / 2))
      const w = projectForm(pc.G, z), H = reanchorAt(pc.G, pts3.mr), v = sub(w, H.o);
      const den = [H.B[0] + H.A * v[0] / 2, H.B[1] + H.A * v[1] / 2], tau = div(v, [-den[1], den[0]])[0];
      let t = Math.atan(tau / (pts3.sg * pts3.s)) / Math.PI;
      if (!Number.isFinite(t)) t = 0.5;
      t = ((t % 1) + 1) % 1;
      return { t, z: glide(pc, t, pts3) };
    }
    if (pts3) {
      const w = projectForm(pc.G, z);`);

// 6. describe and the exports
rep(`fill: d && d.op === 'circle3' ? (d.fill === 'in' ? 'in' : 'none') : null`, `fill: d && (d.op === 'circle3' || d.op === 'perp') ? (d.fill === 'in' ? 'in' : 'none') : null`);
rep(`    orientD, projectForm, pieceDist, pieceBox, pts3,`, `    orientD, projectForm, pieceDist, pieceBox, pts3, perpForm,`);

fs.writeFileSync(path.join(__dirname, 'constr.js'), s);
console.log('proto/constr.js written,', s.split('\n').length, 'lines (v16.1:', fs.readFileSync(SRC, 'utf8').split('\n').length + ')');
