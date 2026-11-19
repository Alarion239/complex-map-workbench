// @ts-check
'use strict';
// Critical points, critical values and join radii of a chain: what the Stack draws in red (crosses at the critical
// points, dashed strands up to their values, a dashed ring and a slider tick at each join radius; #1978, #1980).
//
// A chain's units are its steps' inverse ops (Inverse.pointPlan, each op's critical(): InvOps), or, for a step with
// none, the step itself: a rational map of exact degree by its formula (InvOps.ratCritical), a conformal map with
// none, or a step whose critical points are not known, with the reason. The chain's critical values are each unit's
// critical values, its lattice's values and its asymptotic values, carried through the units after it
// (Inverse.critForward). A unit's critical point counts only where the units before it reach it, from a finite point
// (Inverse.pointPre through them finds a preimage) or from infinity (they carry infinity to it), when they are all
// finite; otherwise it counts. A critical point at infinity of a later unit is reached from the poles of the units
// before it (and from infinity, where they keep it).
// A branch of a root, of log or of an inverse trigonometric function is one-to-one: its branch points join no pieces
// and are not critical points here (Inverse.singular lists them as 'branch').
//
// Pure JS: needs CX, Expr, InvOps and Inverse.
const Critical = (() => {
  const { sub, abs, isFin } = CX;
  // two values or points within SAME (1 + |w|) are one; two radii within SAME (1 + r) are one tick
  const SAME = 1e-9;
  const CRIT_NONE = Object.freeze({ crit: [], lattice: null, asym: [] });
  // the steps with no inverse ops whose critical points are known not to exist (conformal where they are defined)
  const CONFORMAL = new Set(['dh', 'bottcher']);
  // why a step with no inverse ops has no list, by its id
  const NOT_KNOWN = {
    gamma: 'Γ has infinitely many critical points, one in each interval (−k − 1, −k) of the real axis and one at 1.4616…; they are not listed',
    zeta: 'ζ has infinitely many critical points; they are not listed',
  };
  // [P, Q] (high-first, coprime) of a step that is a rational map of exact degree, or null
  function ratOf(b) {
    const P = b.props || {}, v = b.vals || {}, id = b.def && b.def.id;
    if (!P.rational || !P.degExact) return null;
    if (id === 'poly') return [CX.polyTrim(v.co), [CX.C(1, 0)]];
    if (id === 'rational') return [v.p, v.q];
    if (id === 'zp') return [b.zp.P, b.zp.Q];
    if (id === 'custom') {
      let rf;
      try { rf = InvOps.rationalForm(b.ast || Expr.parse(v.expr)); } catch (e) { return null; }
      return rf.ok ? [rf.P, rf.Q] : null;
    }
    return null;
  }
  // the units of live step b (st its state): {units, reason} (reason: why its critical points are not known)
  function unitsOf(st, b) {
    const plan = Inverse.pointPlan([st], [b]);
    if (plan.ok) return { units: plan.ops, reason: null };
    const id = b && b.def ? b.def.id : '';
    if (b && b.props && b.props.constant) return { units: [{ fwd: b.f, critical: () => null }], reason: 'a constant map: every point is critical' };
    if (CONFORMAL.has(id)) return { units: [{ fwd: b.f, critical: () => CRIT_NONE }], reason: null };
    const pq = ratOf(b);
    if (pq) return { units: [{ fwd: b.f, critical: () => InvOps.ratCritical(pq[0], pq[1], b.f) }], reason: null };
    return { units: [{ fwd: b.f, critical: () => null }], reason: NOT_KNOWN[id] || `its critical points are not known (${plan.reason})` };
  }
  // a unit whose preimages pointPre lists, all of them: one branch or finitely many, and no pole lattice
  const finite = (o) => typeof o.pre === 'function' && !o.lattice && (!o.fam || o.fam.type === 'fin');
  // the finite preimages of u (null = infinity) through units 0 .. i - 1, or null when they are not all listed: of a
  // finite u by pointPre; of infinity the poles of each unit k, pulled back through the units before it, as long as the
  // units after it keep infinity at infinity (infPre). A unit with branch points (a branch of log or of a root) sends
  // its singular points to infinity with no finite order, and no critical point comes through it from infinity
  function pullThrough(units, i, u) {
    const prefix = units.slice(0, i);
    if (!prefix.every(finite)) return null;
    if (u !== null) {
      const r = Inverse.pointPre({ ok: true, ops: prefix }, u);
      return r.exact ? r.zs : null;
    }
    const out = [];
    for (let k = i - 1; k >= 0 && !units[k].branch.length; k--) {
      for (const p of units[k].poles) {
        const r = Inverse.pointPre({ ok: true, ops: units.slice(0, k) }, p);
        if (!r.exact) return null;
        out.push(...r.zs);
      }
      if (!units[k].infPre) break;
    }
    return out;
  }
  // whether units 0 .. i - 1 carry infinity to the finite point u
  const fromInf = (units, i, u) => { const v = Inverse.critForward(units.slice(0, i), 0, null); return v !== null && abs(sub(v, u)) <= SAME * (1 + abs(u)); };
  const pushOnce = (list, e, key) => { if (!list.some((q) => abs(sub(q[key], e[key])) <= SAME * (1 + abs(e[key])))) list.push(e); };
  const fwdAll = (units, z) => Inverse.critForward(units, 0, z);

  // Critical.ofChain(steps, built, a, b, win) -> the critical data of the stages (a, b] (built: Funcs.build results;
  // off and failed steps are the identity; win: {x0, x1, y0, y1} in plane a, where an infinite set of critical points is
  // listed):
  //   values: {known: true, list: [{w, kind: 'critical' | 'asymptotic'}]} | {known: false, reason}: the critical and
  //     asymptotic values in plane b, finite only, each once;
  //   points: {complete: true, list: [{z, w}]} | {complete: false, inWindow: true, list} | {complete: false, list: [],
  //     reason}: the critical points z in plane a, finite only, each once, with their values w in plane b (null =
  //     infinity); complete when every one is listed, else those in win (pulled back through the units, at most cap)
  function ofChain(steps, built, a = 0, b = steps.length, win = null, cap = 16) {
    const units = [], reasons = [];
    for (let k = a; k < b; k++) {
      const st = steps[k], bb = built[k];
      if (!st || st.on === false || !bb || bb.error || !bb.def) continue;
      const r = unitsOf(st, bb);
      units.push(...r.units);
      if (r.reason) reasons.push(`step ${k + 1}: ${r.reason}`);
    }
    if (reasons.length) {
      const reason = reasons.join('; ');
      return { values: { known: false, reason }, points: { complete: false, list: [], reason } };
    }
    const values = [], points = [];
    let complete = true;
    units.forEach((o, i) => {
      const c = o.critical();
      for (const e of c.crit) {
        const zs = pullThrough(units, i, e.u);
        // (the units before it never reach it: no finite point, and not infinity)
        if (zs && !zs.length && e.u !== null && !fromInf(units, i, e.u)) continue;
        const w = Inverse.critForward(units, i + 1, e.w);
        if (w !== null) pushOnce(values, { w, kind: 'critical' }, 'w');
        if (zs) for (const z of zs) pushOnce(points, { z, w }, 'z');
        else complete = false;
      }
      if (c.lattice) {
        complete = false;
        for (const v of c.lattice.values) { const w = Inverse.critForward(units, i + 1, v); if (w !== null) pushOnce(values, { w, kind: 'critical' }, 'w'); }
      }
      for (const v of c.asym) { const w = Inverse.critForward(units, i + 1, v); if (w !== null) pushOnce(values, { w, kind: 'asymptotic' }, 'w'); }
    });
    if (complete) return { values: { known: true, list: values }, points: { complete: true, list: points } };
    // (infinitely many, or not all reached: those in the window, when every unit is an op that pulls back)
    if (!win || !units.every((o) => typeof o.pre === 'function')) {
      return { values: { known: true, list: values }, points: { complete: false, list: [], reason: win ? 'the critical points are infinitely many or cannot be pulled back here' : 'the critical points are infinitely many: give a window' } };
    }
    const list = Inverse.singular({ ok: true, ops: units }, win, ['crit'], cap).map((e) => ({ z: e.z, w: fwdAll(units, e.z) }));
    return { values: { known: true, list: values }, points: { complete: false, inWindow: true, list } };
  }
  // Critical.joinRadii(values, c) -> [{r, values: C[]}]: for a target disc |w − c| < r, the radii at which pieces of its
  // preimage join (or a piece closes round a hole): the distances from c to the values (ofChain's values.list), each
  // radius once with every value at it, increasing
  function joinRadii(values, c) {
    const out = [];
    for (const { w } of values) {
      if (!w || !isFin(w)) continue;
      const r = abs(sub(w, c)), e = out.find((q) => Math.abs(q.r - r) <= SAME * (1 + r));
      if (e) e.values.push(w); else out.push({ r, values: [w] });
    }
    return out.sort((p, q) => p.r - q.r);
  }
  return { ofChain, joinRadii };
})();
import { CX } from './cx.js';
import { Expr } from './parse.js';
import { InvOps } from './invops.js';
import { Inverse } from './inverse.js';
export { Critical, Critical as 'module.exports' };
