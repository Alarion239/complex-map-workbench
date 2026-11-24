// @ts-check
'use strict';
// The piece counter: how many pieces the preimage of a target disc |w − c| < r has, and their holes, read from the
// roots alone (the Stack's card, "3 preimages · 2 pieces · one covers the disc twice"; #1978, #1981).
//
// The d roots of F(z) = c + r e^{iθ} are followed once round the rim, θ from 0 to 2π (Inverse.pointPre at each step,
// each root matched to its own continuation). They come back permuted; each cycle of the permutation, its roots' paths
// joined, is one closed loop of the preimage's boundary, and its length k is how many times the loop covers the rim.
// F keeps orientation, so the preimage lies to the left of each loop as θ grows: a counter-clockwise loop (positive
// area) is a piece's outer edge, a clockwise one a hole's. A hole belongs to the smallest outer loop around it, or to
// the unbounded piece (the one that holds infinity, when F(∞) is in the disc) when none is around it. A piece covers
// the disc as many times as its loops' lengths sum to (the argument principle: no pole lies in a piece), and holds
// that many preimages of c, counted with multiplicity.
//
// Pure JS: needs CX, Inverse and Critical.
const Pieces = (() => {
  const { C, add, sub, mul, abs, scale, isFin } = CX;
  const TAU = 2 * Math.PI;
  // the largest step in θ; the step that moves each root by at most SEP_FRAC of the distance between the closest two;
  // a match taken only when the nearest root is MATCH_GAP times nearer than the next; at most HALVE halvings of a step
  // and MAX_STEPS steps in all
  const STEP_MAX = TAU / 64, SEP_FRAC = 0.2, MATCH_GAP = 3, HALVE = 30, MAX_STEPS = 20000;
  // a rim within ON_RIM (1 + r) of a critical value, or of F(∞), is not counted: roots meet there
  const ON_RIM = 1e-9;
  const finite = (o) => typeof o.pre === 'function' && !o.lattice && (!o.fam || o.fam.type === 'fin');
  // twice the signed area of a closed polyline (positive: counter-clockwise)
  function area2(path) {
    let s = 0;
    for (let i = 0, j = path.length - 1; i < path.length; j = i++) s += path[j].re * path[i].im - path[i].re * path[j].im;
    return s;
  }
  // z inside the closed polyline path (even-odd)
  function inside(path, z) {
    let c = false;
    for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
      const a = path[i], b = path[j];
      if ((a.im > z.im) !== (b.im > z.im) && z.re < (b.re - a.re) * (z.im - a.im) / (b.im - a.im) + a.re) c = !c;
    }
    return c;
  }
  // the roots of F at w: [z] when pointPre lists them, all simple, else null
  function rootsAt(plan, w) {
    const r = Inverse.pointPre(plan, w);
    return r.exact && r.mult.every((m) => m === 1) ? r.zs : null;
  }
  // each root of zs matched to one of next, nearest to its predicted place pred: the index array, or null when a match is
  // not clear
  function match(pred, next) {
    if (next.length !== pred.length) return null;
    const used = new Uint8Array(next.length), out = [];
    for (const p of pred) {
      let bi = -1, bd = Infinity, nd = Infinity;
      next.forEach((q, j) => { const d = abs(sub(q, p)); if (d < bd) { nd = bd; bd = d; bi = j; } else if (d < nd) nd = d; });
      if (bi < 0 || used[bi] || !(bd * MATCH_GAP < nd || next.length === 1)) return null;
      used[bi] = 1;
      out.push(bi);
    }
    return out;
  }
  // the roots' paths once round the rim: {paths: C[][] (root i's places, θ from 0 up to but not including 2π), perm:
  // root i ends at root perm[i]} or {reason}
  function follow(plan, c, r) {
    const F = (z) => Inverse.fwdOps(plan, z);
    const dF = (z) => { const h = 1e-6 * (1 + abs(z)); return scale(sub(F(add(z, C(h, 0))), F(sub(z, C(h, 0)))), 0.5 / h); };
    const rim = (t) => add(c, C(r * Math.cos(t), r * Math.sin(t)));
    const z0 = rootsAt(plan, rim(0));
    if (!z0) return { reason: 'the rim\'s first point has a multiple preimage' };
    if (!z0.length) return { paths: [], perm: [] };
    const paths = z0.map((z) => [z]);
    let zs = z0, t = 0, steps = 0;
    while (t < TAU) {
      if (++steps > MAX_STEPS) return { reason: 'too many steps round the rim' };
      // dz/dθ = i r e^{iθ} / F'(z)
      const vel = zs.map((z) => mul(C(-r * Math.sin(t), r * Math.cos(t)), CX.inv(dF(z))));
      let sep = Infinity;
      zs.forEach((z, i) => zs.forEach((q, j) => { if (j > i) sep = Math.min(sep, abs(sub(z, q))); }));
      const vmax = Math.max(...vel.map(abs));
      let dt = Math.min(STEP_MAX, TAU - t, isFin(C(vmax, 0)) && vmax > 0 && sep < Infinity ? SEP_FRAC * sep / vmax : STEP_MAX);
      let m = null, next = null;
      for (let h = 0; h <= HALVE && !m; h++, dt /= 2) {
        next = rootsAt(plan, rim(t + dt));
        if (!next) continue;
        m = match(zs.map((z, i) => add(z, scale(vel[i], dt))), next);
        if (m) t += dt;
      }
      if (!m || !next) return { reason: 'the roots could not be followed round the rim (a branch cut, or a critical value next to it)' };
      const nx = next;
      zs = m.map((j) => nx[j]);
      if (t < TAU) zs.forEach((z, i) => paths[i].push(z));
    }
    const perm = match(zs, z0);
    if (!perm) return { reason: 'the roots did not come back to the rim\'s first point' };
    return { paths, perm };
  }

  // Pieces.count(steps, built, a, b, c, r) -> the preimage in plane a of the disc |w − c| < r of plane b, through the
  // stages (a, b] (built: Funcs.build results):
  //   {counted: true, roots: [{z, mult, piece}] (the preimages of c, z null for infinity; piece: an index into pieces), pieces: [{loops:
  //   [index into loops], holes, covers, unbounded}] (covers: how many times it covers the disc), loops: [{path: C[],
  //   k, ccw}] (the boundary's closed loops in the order followed, k: how many times each covers the rim), holes (in
  //   all), joins: [{r, values}] (the join radii below r, Critical.joinRadii)} | {counted: false, reason}
  function count(steps, built, a, b, c, r) {
    const plan = Inverse.pointPlan(steps, built, a, b);
    if (!plan.ok) return { counted: false, reason: plan.reason };
    if (!plan.ops.every(finite)) return { counted: false, reason: 'the chain has infinitely many preimages' };
    const crit = Critical.ofChain(steps, built, a, b);
    if (!crit.values.known) return { counted: false, reason: crit.values.reason };
    const radii = Critical.joinRadii(crit.values.list, c), wInf = Inverse.critForward(plan.ops, 0, null);
    if (radii.some((e) => Math.abs(e.r - r) <= ON_RIM * (1 + r))) return { counted: false, reason: 'the rim passes through a critical value' };
    if (wInf && Math.abs(abs(sub(wInf, c)) - r) <= ON_RIM * (1 + r)) return { counted: false, reason: 'the rim passes through F(∞)' };
    const fl = follow(plan, c, r);
    if (!fl.paths) return { counted: false, reason: fl.reason };
    // the loops: the cycles of the permutation, their roots' paths joined
    const loops = [], seen = new Uint8Array(fl.perm.length);
    fl.perm.forEach((_, i0) => {
      if (seen[i0]) return;
      const path = [];
      let i = i0, k = 0;
      do { seen[i] = 1; path.push(...fl.paths[i]); i = fl.perm[i]; k++; } while (i !== i0);
      loops.push({ path, k, ccw: area2(path) > 0 });
    });
    // the pieces: one per outer loop, and the unbounded one when F(∞) is in the disc or a hole has no outer loop
    // around it; each hole in the smallest outer loop around it
    const pieces = [];
    const outerOf = loops.map((L, i) => (L.ccw ? pieces.push({ loops: [i], holes: 0, covers: L.k, unbounded: false }) - 1 : -1));
    const smallest = (z) => {
      let best = -1, ba = Infinity;
      loops.forEach((L, i) => { if (L.ccw && inside(L.path, z) && Math.abs(area2(L.path)) < ba) { ba = Math.abs(area2(L.path)); best = outerOf[i]; } });
      return best;
    };
    let unb = wInf && abs(sub(wInf, c)) < r ? pieces.push({ loops: [], holes: 0, covers: 0, unbounded: true }) - 1 : -1;
    loops.forEach((L, i) => {
      if (L.ccw) return;
      let p = smallest(L.path[0]);
      if (p < 0) { if (unb < 0) unb = pieces.push({ loops: [], holes: 0, covers: 0, unbounded: true }) - 1; p = unb; }
      pieces[p].loops.push(i); pieces[p].holes++; pieces[p].covers += L.k;
    });
    // the preimages of c, each in its piece: inside its outer loop and in none of its holes
    const pc = Inverse.pointPre(plan, c);
    if (!pc.exact) return { counted: false, reason: pc.reason };
    const roots = pc.zs.map((z, i) => {
      let p = smallest(z);
      if (p >= 0 && pieces[p].loops.slice(1).some((li) => inside(loops[li].path, z))) p = -1;
      return { z, mult: pc.mult[i], piece: p < 0 ? unb : p };
    });
    // (c = F(∞): infinity is a preimage of c in the unbounded piece, with what the loops leave over)
    if (unb >= 0 && wInf && abs(sub(wInf, c)) <= ON_RIM * (1 + abs(c))) {
      const left = pieces[unb].covers - roots.filter((e) => e.piece === unb).reduce((s, e) => s + e.mult, 0);
      if (left > 0) roots.push({ z: null, mult: left, piece: unb });
    }
    if (pieces.some((P, pi) => roots.filter((e) => e.piece === pi).reduce((s, e) => s + e.mult, 0) !== P.covers) || roots.some((e) => e.piece < 0)) {
      return { counted: false, reason: 'the preimages of the centre do not match the loops (the rim too close to a critical value)' };
    }
    return { counted: true, roots, pieces, loops, holes: pieces.reduce((s, P) => s + P.holes, 0), joins: radii.filter((e) => e.r < r) };
  }
  // a root of the next level within LINK_TOL (1 + |w|) of a root's image is its image
  const LINK_TOL = 1e-7;
  // Pieces.tree(steps, built, levels, c, r) -> the pieces of the disc's preimage on each of the planes levels (stage
  // indices, increasing, the last b: the disc's own plane) and how they nest, each piece in the piece of the next level
  // that its roots map into:
  //   {counted: true, levels: [{stage, count (Pieces.count from that stage to b; null for b), pieces: [{roots: [index into
  //   count.roots], parent: index into the next level's pieces (-1 for b's), covers}]}]} | {counted: false, reason, step}
  // The disc itself is b's one piece, its root c. A piece maps into one piece of the next level (a connected set's image is
  // connected, and the pieces are the components of the preimage), so all its roots agree on the parent. Levels are
  // counted from the top down; not counted at the first level that is not (step: the first step on from it to the next
  // level, the one the card names) or whose roots' images are not the next level's roots (step: the next level's)
  function tree(steps, built, levels, c, r) {
    if (levels.length < 2 || levels.some((k, i) => i && k <= levels[i - 1])) throw new Error('Pieces.tree: levels must increase, two or more');
    const b = levels[levels.length - 1], out = [{ stage: b, count: null, pieces: [{ roots: [0], parent: -1, covers: 1 }] }];
    // (the roots' places, per level: c for b's)
    let above = [c];
    for (let i = levels.length - 2; i >= 0; i--) {
      const k = levels[i], next = levels[i + 1], pc = count(steps, built, k, b, c, r);
      if (!pc.counted) {
        const on = steps.findIndex((st, j) => j >= k && j < next && st.on !== false);
        return { counted: false, reason: pc.reason, step: on >= 0 ? on + 1 : next };
      }
      const plan = Inverse.pointPlan(steps, built, k, next), up = out[0];
      // (the piece of the level above that holds the image of root z)
      const into = (z) => {
        const w = Inverse.critForward(plan.ops, 0, z);
        if (!w || !isFin(w)) return -1;
        const j = above.findIndex((q) => q && abs(sub(q, w)) <= LINK_TOL * (1 + abs(w)));
        return j < 0 ? -1 : up.pieces.findIndex((P) => P.roots.includes(j));
      };
      const pieces = pc.pieces.map((P, pi) => {
        const roots = pc.roots.map((e, ri) => (e.piece === pi ? ri : -1)).filter((ri) => ri >= 0);
        const ps = [...new Set(roots.map((ri) => into(pc.roots[ri].z)))];
        return { roots, parent: ps.length === 1 ? ps[0] : -1, covers: P.covers };
      });
      if (pieces.some((P) => P.parent < 0)) return { counted: false, reason: 'the pieces could not be linked to the next plane\'s', step: next };
      out.unshift({ stage: k, count: pc, pieces });
      above = pc.roots.map((e) => e.z);
    }
    return { counted: true, levels: out };
  }
  return { count, tree };
})();
import { CX } from './cx.js';
import { Inverse } from './inverse.js';
import { Critical } from './critical.js';
export { Pieces, Pieces as 'module.exports' };
