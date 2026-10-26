// Critic's prototype for TANGENT-SPEC.md section 1: proto/constr.js (v16.2 + perp) with touch, tangent, the meet rule,
// gliders, OPS and onCurveByRefs applied in memory, written to tangent-scratch/constr-touch.js. Evidence only.
// Run: node notes/orthogonal-circle/tangent-scratch/tpatch.js
'use strict';
const fs = require('fs'), path = require('path');
let s = fs.readFileSync(path.join(__dirname, '../proto/constr.js'), 'utf8');
const rep = (a, b) => { const n = s.split(a).length - 1; if (n !== 1) throw new Error(`anchor found ${n} times: ${a.slice(0, 70)}`); s = s.replace(a, () => b); };

// 1. touchForm, tangentForm, onCurveByRefs (after perpForm)
rep(`  // ---------------------------------------------------------------- recompute (SPEC 3)`, `  // ---------------------------------------------------------------- touching (notes/orthogonal-circle/TANGENT-SPEC.md)
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
  // a point ref on a curve ref by construction (a glider on it, a meet with it, one of its defining points, a handle of
  // its shape at an end of the piece), through bound handles
  const POSK = /^(p|a|b|m|c|v\\d+)$/;
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
    const pc = !cd ? ctx.piecesOf(C)[cref.part] : null;
    if (pc) {
      const ends = [pc.a, pc.b].concat(pc.arc3 || []).filter(isXY);
      for (const h of handleKeys(C)) { if (!POSK.test(h)) continue; const z = handlePos(C, h); if (z && ends.some((w) => eqP(w, z))) keys.add(canonKey(ctx, { s: C.id, h })); }
    }
    return keys.has(k);
  }

  // ---------------------------------------------------------------- recompute (SPEC 3)`);

// 2. evalNode branches (before meet/glider)
rep(`      if (op === 'meet' || op === 'glider') {`, `      if (op === 'touch' || op === 'tangent') {
        const cr = args[0];
        if (!isCurveRef(cr)) return fail(U('argUndef', { x: null }));
        const e = ctx.idx.get(cr.s);
        if (!e || e.plane !== plane || e.s.cundef || e.s.undef) return fail(U('argUndef', { x: cr.s }));
        const pc = ctx.piecesOf(e.s)[cr.part];
        if (!pc || (pc.kind !== 'line' && pc.kind !== 'circle') || !pc.G) return fail(U('notCircle', { x: cr.s }));
        const cd = e.s.def, Gc = cd && cd.flip && ['circle3', 'perp', 'touch', 'tangent'].includes(cd.op) ? flipG(pc.G) : pc.G;
        const R = args.slice(1).map(pt);
        const bad = R.find((x) => x.undef);
        if (bad) return fail(bad);
        const Z = R.map((x) => (x.inf ? INF : x.z));
        const r = op === 'touch' ? touchForm(Gc, Z[0], Z[1]) : tangentForm(Gc, Z[0], def.index === 1 ? 1 : 0);
        if (r.undef) return fail(U(r.undef, r.undef === 'notCircle' || r.undef === 'argUndef' ? { x: cr.s } : {}));
        let G = r.G;
        if (def.flip == null) def.flip = op === 'touch' && G.A < 0;
        if (def.flip) G = flipG(G);
        G.tch = { G: { A: pc.G.A, B: pc.G.B.slice(), C: pc.G.C, o: pc.G.o.slice() }, tp: isInf(r.tp) ? INF : r.tp.slice() };
        const fin = (op === 'touch' ? Z : [Z[0], r.tp]).filter((z) => !isInf(z));
        if (fin.length === 2) { G.e = abs(sub(fin[1], fin[0])); withPts(G, fin); }
        if (G.o[0] === 0 && G.o[1] === 0) G.thru0 = true;
        const ff = fieldsOfForm(G, def.fill === 'in');
        const rr = setKind(s, ff.kind, ff.f);
        s._g = G;
        res.ch = true; res.kindChanged = rr.kindChanged;
        return res;
      }
      if (op === 'meet' || op === 'glider') {`);

// 3. the meet rule
rep(`    if (pa.kind === 'traced' || pb.kind === 'traced') return [];`, `    if (pa.kind === 'traced' || pb.kind === 'traced') return [];
    const tp = touchAt(pa, pb);
    if (tp != null) return lineByKind(pa) && lineByKind(pb) ? [{ z: tp, index: 'finite' }] : [{ z: tp, index: 0 }, { z: tp, index: 1 }];`);

// 4. pieces: c3 for a touch with a finite second point
rep(`      if (out[0] && s.def && (s.def.op === 'circle3' || s.def.op === 'perp')) out[0].c3 = true;`,
  `      if (out[0] && s.def && (s.def.op === 'circle3' || s.def.op === 'perp' || (s.def.op === 'touch' && !(s.def.args[2] && s.def.args[2].inf)))) out[0].c3 = true;`);

// 5. gliders on a touch: M(R) anchored at T
rep(`    if (!cs || !cs.def || cs.def.op !== 'circle3') return null;`, `    if (cs && cs.def && cs.def.op === 'touch') {
      if (cs.def.args[2] && cs.def.args[2].inf) return null;
      const R = cs.def.args.slice(1).map((r) => resolveIn(ctx, r, plane));
      if (R.some((x) => x.undef)) return 'inf';
      const fin = R.filter((x) => !x.inf).map((x) => x.z);
      if (!fin.length) return 'inf';
      return { mr: fin[0], s: fin.length === 2 ? abs(sub(fin[1], fin[0])) : 1, sg: cs.def.flip ? -1 : 1 };
    }
    if (!cs || !cs.def || cs.def.op !== 'circle3') return null;`);

// 6. OPS, validate, exports
rep(`perp: { n: 3, sig: ['c', 'p', 'p'] },`, `perp: { n: 3, sig: ['c', 'p', 'p'] }, touch: { n: 3, sig: ['c', 'p', 'p'] }, tangent: { n: 2, sig: ['c', 'p'] },`);
rep(`          else if (d.op === 'meet' && !(d.index === 0 || d.index === 1 || d.index === 'finite')) d.index = 0;`,
  `          else if (d.op === 'meet' && !(d.index === 0 || d.index === 1 || d.index === 'finite')) d.index = 0;
          else if (d.op === 'tangent' && !(d.index === 0 || d.index === 1)) d.index = 0;`);
rep(`if (ok && (d.op === 'circle3' || d.op === 'perp') && d.fill !== 'in')`, `if (ok && ['circle3', 'perp', 'touch', 'tangent'].includes(d.op) && d.fill !== 'in')`);
rep(`if (ok && (d.op === 'circle3' || d.op === 'perp') && d.flip != null)`, `if (ok && ['circle3', 'perp', 'touch', 'tangent'].includes(d.op) && d.flip != null)`);
rep(`    orientD, projectForm, pieceDist, pieceBox, pts3, perpForm,`, `    orientD, projectForm, pieceDist, pieceBox, pts3, perpForm, touchForm, tangentForm, onCurveByRefs,`);

fs.writeFileSync(path.join(__dirname, 'constr-touch.js'), s);
console.log('wrote constr-touch.js', s.split('\n').length, 'lines');
