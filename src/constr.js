'use strict';
// Constructions (v16 CORE, notes/constructions-v16/SPEC.md; from notes/ui-redesign-2/constructions/poc/constr.js):
// exact geometry of generalized circles, refs to the points on the page, and the dependency graph of the app's
// constructed shapes. Plain JS, no DOM, no strings (undefined reasons are codes): window.Constr in the page,
// module.exports in node.
//
// Every curve is a GENERALIZED CIRCLE in an oriented, normalized Hermitian form about an anchor o:
//   f(z) = A |z - o|^2 + 2 Re(conj(B) (z - o)) + C,   |B|^2 - A C = 1,   the left side (interior) is f < 0.
// A = 0 is a line (a circle through infinity). Near the curve f/2 is the signed distance, at any radius, so a circle
// through three almost collinear points is as accurate as the line it tends to. Three EXACTLY collinear points
// (decided by an exact orientation predicate) give A = 0 exactly: a true line, never a huge circle. A point BUILT on
// line(P, Q) (a meet with it, a glider on it, the midpoint of P and Q) is collinear with P and Q by INCIDENCE, which
// the graph tracks: its rounded coordinates may be off the line, but circle(P, Q, X) is still exactly the line.
//
// Part 1 (the proof of concept, kept whole: its 84 tests run against this file in test/t_constr.js): the exact
// predicate, forms, meets with the entering rule, Moebius gliders, a named-node graph with formulas.
// Part 2 (v16 CORE, below "v16 CORE"): the app's shapes. A shape may carry s.at (bound handles) and s.def (a
// construction: circle3, meet, glider, midpoint, bisector); Constr.recompute writes their concrete fields, the
// runtime form s._g, s.cundef / s.cHid (undefined) and s._atInf (a point at infinity), in topological order.
const Constr = (function (factory) {
  const M = factory(); if (typeof window !== 'undefined') /** @type {any} */ (window).Constr = M;
  return M;
})(function () {
  const EPS = 2 ** -53;
  const INF = 'inf';                       // the point at infinity
  const isInf = (p) => p === INF;

  // (issue #20) part 1, the proof of concept, lives in src/constrpoc.js
  const Poc = ConstrPoc({ EPS, INF, isInf, reanchor });
  const {
    isXY, decompose, ldexp, orient, decOf, orientD, add, sub, mul, div, scl, abs, dot, cross, latin, parse, namesOf,
    analyze, evalAst, gc, isLine, fOf, geomOf, circle3, line2, withPts, circleCP, circleCR, bisector, crossing, meets,
    meets0, onCurve, paramNear, mob3inv, project, projectForm, apollonius, steiner, equationCurve, CURVE_KINDS,
    POINT_KINDS, graph, fromJSON, shapeOf, FormulaError
  } = Poc;

  // =====================================================================================================
  // v16 CORE (notes/constructions-v16/SPEC.md): constructions on the app's own shapes. Everything below works on
  // the app's state {shapes, targets, steps, nextId} and its shape objects; no DOM, no strings (reasons are codes).
  // =====================================================================================================
  const TAU = 2 * Math.PI;
  const eqP = (a, b) => a[0] === b[0] && a[1] === b[1];
  const flipG = (g) => (g ? Object.assign({ A: -g.A, B: [-g.B[0], -g.B[1]], C: -g.C, o: g.o.slice() }, g.e ? { e: g.e } : {}) : g);

  // ---------------------------------------------------------------- the exact form (SPEC 2.2)
  // the form of a shape's own fields: disc and circle (the disc, or its complement), half-plane and line (left side)
  function formOfFields(s) {
    if (!s) return null;
    if ((s.kind === 'disc' || s.kind === 'circle') && isXY(s.c) && s.r > 0 && Number.isFinite(s.r)) {
      // anchored at the centre: A = 1 / r, B = 0, C = -r (|B|^2 - AC = 1)
      const g = { A: 1 / s.r, B: [0, 0], C: -s.r, o: s.c.slice() };
      return s.kind === 'disc' && s.complement ? flipG(g) : g;
    }
    if ((s.kind === 'halfplane' || s.kind === 'line') && isXY(s.a) && isXY(s.b)) {
      const g = line2(s.a, s.b);
      return g && s.kind === 'halfplane' && s.complement ? flipG(g) : g;
    }
    return null;
  }
  // Constr.formOf(shape): the runtime gcircle form s._g when present, else the form of the shape's fields
  function formOf(s) { return (s && s._g) || formOfFields(s); }
  // [f, fx, fy] at z (float64, relative to o); f < 0 inside (the left side), f / 2 the signed distance near the curve
  function level(G, z) {
    const ux = z[0] - G.o[0], uy = z[1] - G.o[1];
    return [G.A * (ux * ux + uy * uy) + 2 * (G.B[0] * ux + G.B[1] * uy) + G.C, 2 * (G.A * ux + G.B[0]), 2 * (G.A * uy + G.B[1])];
  }
  // the same curve anchored at its point nearest z0 (exact algebra for a quadratic: B' = B + A (o' - o), C' = f(o'))
  // (one argument, the proof of concept's form: anchored at the point nearest 0, C = 0 exactly)
  function reanchor(G, z0) {
    if (z0 == null) { const o = projectForm(G, [0, 0]); return { A: G.A, B: add(G.B, scl(sub(o, G.o), G.A)), C: 0, o: o.slice() }; }
    const o2 = projectForm(G, z0);      // ([review math-1]: never through the centre)
    if (!isXY(o2)) return Object.assign({}, G);
    const du = [o2[0] - G.o[0], o2[1] - G.o[1]];
    const B2 = [G.B[0] + G.A * du[0], G.B[1] + G.A * du[1]];
    const C2 = level(G, o2)[0];
    const out = { A: G.A, B: B2, C: C2, o: o2 };
    if (G.thru0) out.thru0 = true;
    return out;
  }
  // the Moebius map with 0, 1, inf -> p, q, r: { map(t), inv(z) } (real t runs along the generalized circle p, q, r)
  function mob3obj(p, q, r) {
    return { map: (t) => mob3t(p, q, r, t), inv: (z) => mob3inv(p, q, r, z) };
  }
  const mob3t = (P, Q, R, t) => {
    if (!Number.isFinite(t)) return R;
    const qp = sub(Q, P), rq = sub(R, Q);
    return div(add(scl(mul(R, qp), t), mul(P, rq)), add(scl(qp, t), rq));
  };
  // [review math-12] the same map when one of P, Q, R is infinity (its limit, so a glider does not jump when a meet
  // of lines turns parallel): R = inf: P + t (Q - P); P = inf: R + (Q - R) / t; Q = inf: (R t - P) / (t - 1)
  function mob3x(P, Q, R, t) {
    if (!Number.isFinite(t)) return isInf(R) ? INF : R.slice();
    if (isInf(R)) return add(P, scl(sub(Q, P), t));
    if (isInf(P)) return t === 0 ? INF : add(R, scl(sub(Q, R), 1 / t));
    if (isInf(Q)) return t === 1 ? INF : scl(sub(scl(R, t), P), 1 / (t - 1));
    return mob3t(P, Q, R, t);
  }
  function mob3invx(P, Q, R, z) {
    let w;
    if (isInf(R)) w = div(sub(z, P), sub(Q, P));
    else if (isInf(P)) w = div(sub(R, Q), sub(R, z));
    else if (isInf(Q)) w = div(sub(z, P), sub(z, R));
    else return mob3inv(P, Q, R, z);
    return w[0];
  }
  // the M(R) parametrization of a form anchored on its curve (C = 0): z(tau) = o + i B tau / (1 - i A tau / 2):
  // arc length near o, the antipode (A != 0) or infinity (A = 0) at tau = inf; continuous through A = 0 (SPEC 2.2 [C7])
  function mR(G, tau) {
    if (!Number.isFinite(tau)) return G.A === 0 ? INF : [G.o[0] - 2 * G.B[0] / G.A, G.o[1] - 2 * G.B[1] / G.A];
    const num = [-G.B[1] * tau, G.B[0] * tau], den = [1, -G.A * tau / 2];
    const w = div(num, den);
    return [G.o[0] + w[0], G.o[1] + w[1]];
  }

  // ---------------------------------------------------------------- refs
  // ref: {s} a point shape | {s, h} a handle | {zp: uid, kind, id, i, step} a zero or pole of f1 | {inf: 1} |
  //      {s, part} a curve piece (meet, glider) | {img: id} F(z0) of X's point shape (targets only)
  const isPointRef = (r) => !!r && typeof r === 'object' && (r.inf === 1 || r.inf === true || typeof r.zp === 'string' || typeof r.img === 'string' || (typeof r.s === 'string' && r.part == null));
  const isCurveRef = (r) => !!r && typeof r === 'object' && typeof r.s === 'string' && Number.isInteger(r.part) && r.part >= 0;
  function refKey(r) {
    if (!r) return '?';
    if (r.inf) return 'inf';
    // [v16.5 rail SPEC 3.2] a construction's pending pick (a point target while the draft is open); a shown display curve
    // not yet a shape ({disp}); a crossing by its two curves and its index or seed (never 's:undefined')
    if (Number.isInteger(r.pend)) return `pend:${r.pend}`;
    if (typeof r.disp === 'string') return `d:${r.disp}`;
    if (Array.isArray(r.meet)) return `m:${r.meet.map(refKey).sort().join('|')}:${r.index != null ? r.index : isXY(r.seed) ? r.seed.map((v) => +v.toPrecision(12)).join(',') : '?'}`;
    if (typeof r.zp === 'string') return `zp:${r.zp}:${r.id}`;
    if (typeof r.img === 'string') return `img:${r.img}`;
    if (r.part != null) return `c:${r.s}:${r.part}`;
    return r.h ? `s:${r.s}:${r.h}` : `s:${r.s}`;
  }
  const lists = (state) => [Array.isArray(state.shapes) ? state.shapes : [], Array.isArray(state.targets) ? state.targets : []];
  function index(state) {
    const m = new Map();
    lists(state).forEach((L, plane) => L.forEach((s, i) => { if (s && s.id) m.set(s.id, { s, plane, i }); }));
    return m;
  }
  // the position handles of a shape (Region.handlesOf when the app's Region is loaded; the same keys otherwise)
  function handlePos(s, h) {
    if (Region.handlesOf && Region.KINDS && Region.KINDS[s.kind]) {
      try { const hs = Region.handlesOf(s); for (const [k, z] of hs) if (k === h) return [z.re, z.im]; } catch (e) { /* */ }
      return null;
    }
    if (/^v\d+$/.test(h)) { const p = s.pts && s.pts[+h.slice(1)]; return isXY(p) ? p.slice() : null; }
    if (h === 'r' && isXY(s.c)) return [s.c[0] + s.r, s.c[1]];
    if ((h === 'r1' || h === 'r2') && isXY(s.c)) return [s.c[0] + s[h], s.c[1]];
    return isXY(s[h]) ? s[h].slice() : null;
  }
  const handleKeys = (s) => {
    if (Region.handlesOf && Region.KINDS && Region.KINDS[s.kind]) { try { return Region.handlesOf(s).map((x) => x[0]); } catch (e) { return []; } }
    const out = [];
    for (const k of ['p', 'a', 'b', 'm', 'c']) if (isXY(s[k])) out.push(k);
    if (Array.isArray(s.pts)) s.pts.forEach((_, i) => out.push('v' + i));
    if (s.r != null) out.push('r');
    return out;
  };
  const RADIUS_KEYS = new Set(['r', 'r1', 'r2']);
  const U = (code, args) => ({ undef: { code, args: args || {} } });

  // ---------------------------------------------------------------- steps: uids and zero ids (SPEC 1.2 [C12])
  // ids come from the shapes' counter (state.nextId), with their own prefixes: steps 'f', zeros and poles 'q'
  // [review regress-1] the shapes' counter (state.nextId) is left alone: step and zero ids have their own prefixes,
  // and a run-time counter skips every id in use, including the ids of refs whose step or zero is gone (so a stale ref
  // never finds a new owner). Ids nothing refers to are not saved (stripIds), so a scene without constructions saves
  // and links as in v15.1
  function freshId(state, prefix, taken) {
    let n = Number.isInteger(state._idn) && state._idn > 0 ? state._idn : 1;
    while (taken.has(prefix + n)) n++;
    state._idn = n + 1;
    taken.add(prefix + n);
    return prefix + n;
  }
  function takenIds(state) {
    const t = new Set();
    for (const L of lists(state)) for (const s of L) {
      if (!s) continue;
      if (s.id) t.add(s.id);
      for (const { ref } of (isNode(s) ? refsOf(s) : [])) if (ref && typeof ref.zp === 'string') { t.add(ref.zp); if (typeof ref.id === 'string') t.add(ref.id); }
    }
    for (const st of state.steps || []) {
      if (st && typeof st.uid === 'string') t.add(st.uid);
      if (st && st.zpIds) for (const k of ['zeros', 'poles']) for (const id of st.zpIds[k] || []) t.add(id);
    }
    return t;
  }
  // the step uids some shape refers to (a zero, or a step by uid)
  function referencedSteps(state) {
    const out = new Set();
    for (const L of lists(state)) for (const s of L) if (s && isNode(s)) for (const { ref } of refsOf(s)) if (ref && typeof ref.zp === 'string') out.add(ref.zp);
    return out;
  }
  // Constr.idReplacer(state): a JSON.stringify replacer that leaves out uid and zpIds of the steps nothing refers to
  // (and run-time fields, as the app's noRuntime does) [review regress-1]
  function idReplacer(state) {
    const used = referencedSteps(state || {});
    return function (k, v) {
      if (typeof k === 'string' && k[0] === '_') return undefined;
      if ((k === 'uid' || k === 'zpIds') && this && typeof this === 'object' && 'params' in this && 'type' in this && !used.has(this.uid)) return undefined;
      return v;
    };
  }
  // syncSteps(state, env): every step gets a unique uid; every zeros-and-poles step zpIds parallel to its lists. A list
  // whose length changed is matched to its ids greedily by nearest value (ties by index) against the last values seen
  // (st._zpv, runtime); values left over get fresh ids, ids left over are removed. Returns true if anything changed.
  // [UX54] zpNums, parallel too, are the numbers the zeros and poles are called by (ζ₃, p₁): each keeps its number while
  // others come and go, a new one takes the next after the largest, and they are saved (a save without them, from an
  // earlier build, numbers by place, as that build did)
  function syncSteps(state, env) {
    let ch = false;
    const steps = Array.isArray(state.steps) ? state.steps : [];
    const taken = takenIds(state), seen = new Set();
    for (const st of steps) {
      if (!st || typeof st !== 'object') continue;
      if (typeof st.uid !== 'string' || !/^f\d+$/.test(st.uid) || seen.has(st.uid)) { if (st.uid != null) taken.delete(st.uid); st.uid = freshId(state, 'f', taken); ch = true; }
      seen.add(st.uid);
      if (st.type !== 'zp') { if (st.zpIds) { delete st.zpIds; ch = true; } continue; }
      if (!st.zpIds || typeof st.zpIds !== 'object') { st.zpIds = { zeros: [], poles: [] }; ch = true; }
      const prevV = st._zpv || {};
      const nowV = {};
      const nums0 = st.zpNums && typeof st.zpNums === 'object' ? st.zpNums : {};
      const nums = {};
      for (const kind of ['zeros', 'poles']) {
        const vals = env && env.zpAll ? env.zpAll(st, kind) : [];
        nowV[kind] = vals;
        let ids = Array.isArray(st.zpIds[kind]) ? st.zpIds[kind].filter((x) => typeof x === 'string') : [];
        if (new Set(ids).size !== ids.length) ids = [...new Set(ids)];
        // (the saved numbers, when they are a list of distinct positive integers as long as ids, or as the values)
        const n0 = Array.isArray(nums0[kind]) && nums0[kind].every((x) => Number.isInteger(x) && x > 0) && new Set(nums0[kind]).size === nums0[kind].length ? nums0[kind] : null;
        let nk = n0 && n0.length === ids.length ? n0.slice() : null;
        if (ids.length !== vals.length) {
          const old = Array.isArray(prevV[kind]) && prevV[kind].length === ids.length ? prevV[kind] : null;
          const out = new Array(vals.length).fill(null);
          if (old && vals.length) {
            // greedy nearest value: all (old, new) pairs by distance, ties by index
            const pairs = [];
            for (let i = 0; i < ids.length; i++) for (let j = 0; j < vals.length; j++) {
              const a = old[i], b = vals[j];
              const d = a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : (a || b ? Infinity : 0);
              pairs.push([d, i, j]);
            }
            pairs.sort((x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2]);
            const usedI = new Set();
            for (const [d, i, j] of pairs) { if (!(d < Infinity) || usedI.has(i) || out[j]) continue; usedI.add(i); out[j] = ids[i]; }
          } else for (let j = 0; j < Math.min(ids.length, vals.length); j++) out[j] = ids[j];
          for (let j = 0; j < out.length; j++) if (!out[j]) { out[j] = freshId(state, 'q', taken); rebindZero(state, st, kind, out[j], vals[j], ids); }
          // the numbers follow the ids; a load (no ids yet) keeps the saved ones; the new take the next after the largest
          if (!ids.length && n0 && n0.length === vals.length) nk = n0.slice();
          else {
            const byId = new Map(nk ? ids.map((id, i) => [id, nk[i]]) : []);
            nk = out.map((id) => (byId.has(id) ? byId.get(id) : null));
            let next = Math.max(0, ...nk.filter((x) => x != null)) + 1;
            nk = nk.map((x) => (x != null ? x : next++));
          }
          ids = out; ch = true;
        }
        if (!nk) nk = vals.map((v, i) => i + 1);
        st.zpIds[kind] = ids;
        nums[kind] = nk;
      }
      if (JSON.stringify(nums) !== JSON.stringify(nums0)) { st.zpNums = nums; ch = true; }
      st._zpv = nowV;
    }
    return ch;
  }
  // a zero (pole) new in the list, at the value a removed one last had: the refs that lost it take it again [user-6]
  function rebindZero(state, st, kind, id, v, live) {
    if (!isXY(v)) return;
    const tol = 1e-9 * (1 + Math.hypot(v[0], v[1]));
    for (const L of lists(state)) for (const s of L) {
      if (!s || !isNode(s)) continue;
      for (const { ref } of refsOf(s)) {
        if (!ref || ref.zp !== st.uid || ref.kind !== kind || live.includes(ref.id)) continue;
        const lv = lastZp.get(ref);
        if (lv && Math.hypot(lv[0] - v[0], lv[1] - v[1]) <= tol) ref.id = id;
      }
    }
  }
  // zpRemoveId(step, kind, i): the id of the removed zero or pole goes with it (call before the list loses item i)
  function zpRemoveId(st, kind, i) {
    if (!st || !st.zpIds || !Array.isArray(st.zpIds[kind])) return null;
    const [id] = st.zpIds[kind].splice(i, 1);
    if (st._zpv && Array.isArray(st._zpv[kind])) st._zpv[kind].splice(i, 1);
    if (st.zpNums && Array.isArray(st.zpNums[kind])) st.zpNums[kind].splice(i, 1);
    return id || null;
  }
  // the number zero (pole) i of a 'zp' step is called by: ζₙ, pₙ (zpNums, else its place, 1-based)
  function zpNum(st, kind, i) {
    const a = st && st.zpNums && st.zpNums[kind];
    return a && Number.isInteger(a[i]) ? a[i] : i + 1;
  }
  // renumber the zeros and poles of a 'zp' step by their places again (the card's Renumber)
  function zpRenumber(st) {
    if (!st || st.type !== 'zp' || !st.zpNums) return false;
    let ch = false;
    for (const kind of ['zeros', 'poles']) {
      const a = st.zpNums[kind];
      if (Array.isArray(a) && a.some((x, i) => x !== i + 1)) { st.zpNums[kind] = a.map((x, i) => i + 1); ch = true; }
    }
    return ch;
  }

  // ---------------------------------------------------------------- resolving a point ref
  // ctx: {state, idx (index()), env: {zp(st, kind, i) -> [x, y] | null, F(z) -> [x, y] | INF | null}}
  function zpMark(ref, st, i) {
    const j = Number.isInteger(i) ? i : (Number.isInteger(ref.i) ? ref.i : 0);
    // (n: its number now, so a reason still names a zero after it is removed)
    return { kind: ref.kind, i: j, n: zpNum(st, ref.kind, j), step: st ? (ctxStepIndex(st) + 1) : null };
  }
  let ctxSteps = null;
  // [review user-6] the last value each zero ref resolved to (run time): the reason names a removed zero by its value,
  // and a zero added back at that value takes the ref again (syncSteps)
  const lastZp = typeof WeakMap !== 'undefined' ? new WeakMap() : new Map();
  const ctxStepIndex = (st) => (ctxSteps ? ctxSteps.indexOf(st) : -1);
  function resolveIn(ctx, ref, plane) {
    if (!ref || typeof ref !== 'object') return U('argUndef', { x: null });
    if (ref.inf) return { inf: true };
    if (typeof ref.zp === 'string') {
      const steps = ctx.state.steps || [];
      ctxSteps = steps;
      const k = steps.findIndex((st) => st && st.uid === ref.zp);
      if (k < 0) return U('stepRemoved', { mark: zpMark(ref, null) });
      const st = steps[k];
      const ids = (st.zpIds && st.zpIds[ref.kind]) || [];
      const i = ids.indexOf(ref.id);
      if (i < 0) { const lv = lastZp.get(ref); return U('zpRemoved', lv ? { mark: zpMark(ref, st), v: lv.slice() } : { mark: zpMark(ref, st) }); }
      if (k !== 0 || st.type !== 'zp') return U('zpNotF1', { mark: zpMark(ref, st, i), f: k + 1 });
      const v = ctx.env && ctx.env.zp ? ctx.env.zp(st, ref.kind, i) : null;
      if (!isXY(v)) return U('argUndef', { x: { mark: zpMark(ref, st, i) } });
      lastZp.set(ref, v.slice());
      return { z: v.slice() };
    }
    if (typeof ref.img === 'string') {
      const e = ctx.idx.get(ref.img);
      if (!e || e.plane !== 0 || e.s.kind !== 'point') return U('argUndef', { x: ref.img });
      if (e.s.cundef || e.s.undef) return U('argUndef', { x: ref.img });
      if (e.s._atInf) return ctx.env && ctx.env.F ? norm(ctx.env.F(INF)) : U('argUndef', { x: ref.img });
      const w = ctx.env && ctx.env.F ? ctx.env.F(e.s.p) : null;
      return norm(w, ref.img);
    }
    const e = ctx.idx.get(ref.s);
    if (!e || e.plane !== plane) return U('argUndef', { x: ref.s });
    const s = e.s;
    if (s.cundef || s.undef) return U('argUndef', { x: s.id });
    if (!ref.h) {
      if (s.kind !== 'point') return U('argUndef', { x: s.id });
      if (s._atInf) return { inf: true };
      return isXY(s.p) ? { z: s.p.slice() } : U('argUndef', { x: s.id });
    }
    const z = handlePos(s, ref.h);
    return z ? { z } : U('argUndef', { x: s.id });
  }
  function norm(w, id) {
    if (w === INF) return { inf: true };
    if (isXY(w)) return { z: w.slice() };
    if (w && Number.isFinite(w.re) && Number.isFinite(w.im)) return { z: [w.re, w.im] };
    return U('argUndef', { x: id || null });
  }
  // Constr.resolve(state, ref, plane, env)
  function resolve(state, ref, plane, env) { return resolveIn({ state, idx: index(state), env: env || {} }, ref, plane | 0); }

  // ---------------------------------------------------------------- pieces of a shape's curves (SPEC 2.4, 2.5)
  // {part, kind: 'line'|'circle'|'traced', G, a, b, lo, hi (line: z = a + t (b - a), t in [lo, hi]), c, r, a0, span
  //  (circle: angles a0 .. a0 + span, ccw), closed, period, poly ({pts, closed}: the whole polygon, for gliders),
  //  pts (traced)}
  function linePiece(a, b, lo, hi, part, extra) {
    const G = line2(a, b);
    if (!G) return null;
    return Object.assign({ part, kind: 'line', G, a: a.slice(), b: b.slice(), lo, hi, closed: false, period: 0 }, extra || {});
  }
  function circlePiece(c, r, part, a0, span, G) {
    if (!(r > 0) || !isXY(c)) return null;
    const full = !(span < TAU);
    return { part, kind: 'circle', G: G || { A: 1 / r, B: [0, 0], C: -r, o: c.slice() }, c: c.slice(), r, a0: a0 || 0, span: full ? TAU : span, closed: full, period: full ? 1 : 0 };
  }
  // [review math-8] a slot that is gone (a side of zero length, a sector's missing edge): it keeps its part number, so
  // the parts after it are never renumbered, and it meets nothing
  const NONE = (part) => ({ part, kind: 'none', closed: false, period: 0 });
  // the traced components of a formula or freehand curve: [{pts: [[x, y]...], g?: (x, y) -> level}] (env.trace gives
  // components; an older env a flat list)
  function compsOf(tr) {
    if (!tr) return [];
    if (Array.isArray(tr) && tr.length && isXY(tr[0])) return [{ pts: tr }];
    return (Array.isArray(tr) ? tr : []).filter((c) => c && Array.isArray(c.pts) && c.pts.length >= 2);
  }
  function pieces(s, env) {
    if (!s) return [];
    const out = [];
    const push = (p) => { if (p) { p.part = out.length; out.push(p); } };
    const slot = (p) => { const k = out.length; out.push(p || NONE(k)); out[k].part = k; };
    if (s._g) {
      const G = s._g;
      if (G.A === 0) push(Object.assign(linePiece(geomOf(G).p, add(geomOf(G).p, geomOf(G).d), -Infinity, Infinity, 0) || {}, { G }));
      else { const g = geomOf(G); push(circlePiece(g.c, g.r, 0, 0, TAU, G)); }
      if (out[0] && s.def && (s.def.op === 'circle3' || s.def.op === 'perp' || (s.def.op === 'touch' && !(s.def.args[2] && s.def.args[2].inf)))) out[0].c3 = true;
      // [v16.4 segments] Inside C only: the arc (its carrier's kind, G and c3 kept), t from 0 to 1 between its ends
      if (out[0] && s._seg && s.def && s.def.op === 'perp' && (s.def.seg || s.def.between)) Object.assign(out[0], { seg: s._seg, closed: false, period: 0 });
      return out.filter((p) => p && p.kind);
    }
    switch (s.kind) {
      case 'line': case 'halfplane': if (isXY(s.a) && isXY(s.b)) push(linePiece(s.a, s.b, -Infinity, Infinity, 0)); break;
      case 'segment': if (isXY(s.a) && isXY(s.b)) push(linePiece(s.a, s.b, 0, 1, 0)); break;
      case 'ray': if (isXY(s.a) && isXY(s.b)) push(linePiece(s.a, s.b, 0, Infinity, 0)); break;
      case 'circle': case 'disc': if (isXY(s.c)) push(circlePiece(s.c, s.r, 0, 0, TAU)); break;
      case 'annulus': if (isXY(s.c)) { slot(circlePiece(s.c, Math.min(s.r1, s.r2), 0, 0, TAU)); slot(circlePiece(s.c, Math.max(s.r1, s.r2), 1, 0, TAU)); } break;
      case 'arc': {
        // [review math-7] the exact form of the circle through a, m, b (its huge radius loses nothing), tested and
        // parametrized through a, m, b; c, r and the angles are for drawing and distances only
        if (!(isXY(s.a) && isXY(s.m) && isXY(s.b))) break;
        const G = circle3(s.a, s.m, s.b);
        if (!G) break;
        const arc3 = [s.a.slice(), s.m.slice(), s.b.slice()], om = orientD(s.a, s.m, s.b);
        if (G.A === 0) { push(Object.assign(linePiece(s.a, s.b, 0, 1, 0), { G, gen: true, arc3, om })); break; }
        const g = geomOf(G);
        const ang = (p) => Math.atan2(p[1] - g.c[1], p[0] - g.c[0]);
        const ccw = (x, from) => ((((x - from) % TAU) + TAU) % TAU);
        const ta = ang(s.a), tb = ang(s.b), tm = ang(s.m);
        // from a counterclockwise when m comes before b, else from b
        if (ccw(tm, ta) < ccw(tb, ta)) push(Object.assign(circlePiece(g.c, g.r, 0, ta, ccw(tb, ta), G), { from: 'a', gen: true, arc3, om }));
        else push(Object.assign(circlePiece(g.c, g.r, 0, tb, ccw(ta, tb), G), { from: 'b', gen: true, arc3, om }));
        break;
      }
      case 'rect': case 'polygon': {
        let pts;
        if (s.kind === 'rect') {
          if (!(isXY(s.a) && isXY(s.b))) break;
          const x0 = Math.min(s.a[0], s.b[0]), x1 = Math.max(s.a[0], s.b[0]), y0 = Math.min(s.a[1], s.b[1]), y1 = Math.max(s.a[1], s.b[1]);
          pts = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
        } else pts = (s.pts || []).filter(isXY);
        const poly = { pts, closed: true };
        // one slot per side, part = the side's index [math-8]
        for (let i = 0; i < pts.length; i++) slot(linePiece(pts[i], pts[(i + 1) % pts.length], 0, 1, i, { poly, side: i }));
        break;
      }
      case 'sector': {
        // fixed slots [math-8]: 0 the first edge, 1 the arc, 2 the second edge
        if (!isXY(s.c)) break;
        const span = (((s.t2 - s.t1) % 360) + 360) % 360 || 360, t1 = s.t1 * Math.PI / 180, t2 = (s.t1 + span) * Math.PI / 180;
        const u1 = [Math.cos(t1), Math.sin(t1)], u2 = [Math.cos(t2), Math.sin(t2)];
        if (s.r > 0) {
          slot(span < 360 ? linePiece(s.c, add(s.c, scl(u1, s.r)), 0, 1, 0) : null);
          slot(circlePiece(s.c, s.r, 1, t1, span * Math.PI / 180));
          slot(span < 360 ? linePiece(add(s.c, scl(u2, s.r)), s.c, 0, 1, 2) : null);
        } else {
          slot(span < 360 ? linePiece(s.c, add(s.c, u1), 0, Infinity, 0) : null);
          slot(null);
          slot(span < 360 ? linePiece(s.c, add(s.c, u2), 0, Infinity, 2) : null);
        }
        break;
      }
      case 'curve': if (Array.isArray(s.pts) && s.pts.length >= 2) { const pts = s.pts.filter(isXY); push({ kind: 'traced', pts, comps: [{ pts }], closed: false, period: 0 }); } break;
      case 'fcurve': {
        // [review math-11] one piece, its components kept apart (never joined into one polyline: no phantom crossings),
        // each with its level function for the float64 Newton step
        const comps = compsOf(env && env.trace ? env.trace(s) : null);
        if (comps.length) push({ kind: 'traced', pts: comps[0].pts, comps, closed: false, period: 0, formula: true });
        break;
      }
    }
    return out;
  }
  // on the piece (to within a relative tolerance)? line: its t range; circle: its angular range; arc: the side of its
  // chord that holds m [math-7]
  function onPiece(pc, z) {
    if (!pc || pc.kind === 'none') return false;
    if (pc.seg) {
      // [v16.4 segments SPEC 2.4] the ends (bitwise, or within 1e-9 of the arc's size), else by u along the arc
      const q = pc.seg;
      if (z === INF) return q.ends.some(isInf) || (pc.G.A === 0 && segInU(q, 0.5));
      for (const e of q.ends) if (isXY(e) && (eqP(z, e) || abs(sub(z, e)) <= 1e-9 * q.L)) return true;
      return segInU(q, segU(q.H, q.k, z));
    }
    if (z === INF) return pc.kind === 'line' && (pc.hi === Infinity || pc.lo === -Infinity);
    if (pc.arc3 && pc.om !== 0) {
      const [a, , b] = pc.arc3;
      if (eqP(z, a) || eqP(z, b)) return true;
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (Math.min(Math.hypot(z[0] - a[0], z[1] - a[1]), Math.hypot(z[0] - b[0], z[1] - b[1])) <= 1e-9 * L) return true;
      const oz = orient(a, z, b);
      return oz !== 0 && (oz > 0) === (pc.om > 0);
    }
    if (pc.kind === 'line') {
      if (pc.lo === -Infinity && pc.hi === Infinity) return true;
      const d = sub(pc.b, pc.a), L = dot(d, d), t = dot(sub(z, pc.a), d) / L, e = 1e-9;
      return t >= pc.lo - e && t <= pc.hi + e;
    }
    if (pc.kind === 'circle') {
      if (pc.closed) return true;
      const a = Math.atan2(z[1] - pc.c[1], z[0] - pc.c[0]);
      const x = ((((a - pc.a0) % TAU) + TAU) % TAU);
      return x <= pc.span + 1e-9 || x >= TAU - 1e-9;
    }
    return true;
  }
  // two pieces are "two lines" [C6] only by kind: lines, segments, rays, half-plane edges, polygon sides, bisectors,
  // 3-point circles that are lines by incidence. A 3-point circle or an arc that is a line for the moment keeps the
  // entering rule, which orders [p, inf] continuously through that instant [review math-5]
  const lineByKind = (pc) => pc.kind === 'line' && !pc.gen && (!pc.c3 || !!(pc.G && pc.G.byInc));
  // the meets of two pieces with the entering rule: [{z | INF | null, index}] (two lines: one, index 'finite') [C6]
  /** @returns {({ z: any, index: number | string }[] & { coincide?: boolean })} */
  function meetsOf(pa, pb) {
    if (!pa || !pb || pa.kind === 'none' || pb.kind === 'none') return [];
    if (pa.kind === 'traced' || pb.kind === 'traced') return [];
    const tp = touchAt(pa, pb);
    if (tp != null) return lineByKind(pa) && lineByKind(pb) ? [{ z: tp, index: 'finite' }] : [{ z: tp, index: 0 }, { z: tp, index: 1 }];
    const sa = segAt(pa, pb);
    if (sa) return sa;
    // (review math-5) two hyperbolic lines of one C that share an end are limiting parallels: their carriers touch only
    // there, at an ideal point, which is no point of the plane, so neither index meets
    if (segParallel(pa, pb)) return lineByKind(pa) && lineByKind(pb) ? [{ z: null, index: 'finite' }] : [{ z: null, index: 0 }, { z: null, index: 1 }];
    if (lineByKind(pa) && lineByKind(pb)) {
      const m = meets0(pa.G, pb.G);
      return [{ z: m[0], index: 'finite' }];
    }
    const m = meets(pa.G, pb.G);
    /** @type {{ z: any, index: number | string }[] & { coincide?: boolean }} */
    const out = [{ z: m[0], index: 0 }, { z: m[1], index: 1 }];
    if (m.coincide) out.coincide = true;
    return out;
  }
  // Constr.meets on pieces (spec name): [{z | INF, index}]
  function meetsPieces(pa, pb) { return meetsOf(pa, pb).filter((x) => x.z != null); }
  // polyline crossings of two traced (or sampled) pieces: per component [math-11]
  function polysOf(pc, box) {
    if (pc.kind === 'traced') return pc.comps || [{ pts: pc.pts }];
    // a carrier sampled finely inside the box (for a traced partner)
    const n = 400, out = [];
    if (pc.kind === 'line') {
      const c = Math.max(box.x1 - box.x0, box.y1 - box.y0) * 2, mid = [(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2];
      const d = sub(pc.b, pc.a), L = abs(d), u = scl(d, 1 / L), t0 = dot(sub(mid, pc.a), u);
      let lo = t0 - c, hi = t0 + c;
      if (pc.lo > -Infinity) lo = Math.max(lo, pc.lo * L);
      if (pc.hi < Infinity) hi = Math.min(hi, pc.hi * L);
      for (let i = 0; i <= n; i++) out.push(add(pc.a, scl(u, lo + (hi - lo) * i / n)));
      return [{ pts: out }];
    }
    for (let i = 0; i <= n; i++) { const a = pc.a0 + pc.span * i / n; out.push([pc.c[0] + pc.r * Math.cos(a), pc.c[1] + pc.r * Math.sin(a)]); }
    return [{ pts: out }];
  }
  function segX(a, b, c, d) {
    const r = sub(b, a), s = sub(d, c), den = cross(r, s);
    if (den === 0) return null;
    const t = cross(sub(c, a), s) / den, u = cross(sub(c, a), r) / den;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? add(a, scl(r, t)) : null;
  }
  function polyCross(P, Q) {
    const out = [];
    for (let i = 1; i < P.length; i++) for (let j = 1; j < Q.length; j++) {
      const a = P[i - 1], b = P[i], c = Q[j - 1], d = Q[j];
      if (Math.max(a[0], b[0]) < Math.min(c[0], d[0]) || Math.max(c[0], d[0]) < Math.min(a[0], b[0]) || Math.max(a[1], b[1]) < Math.min(c[1], d[1]) || Math.max(c[1], d[1]) < Math.min(a[1], b[1])) continue;
      const x = segX(a, b, c, d);
      if (x) out.push({ z: x, h: Math.max(Math.hypot(b[0] - a[0], b[1] - a[1]), Math.hypot(d[0] - c[0], d[1] - c[1])) });
    }
    return out;
  }
  const bboxPts = (P) => { let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const p of P) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); } return { x0, x1, y0, y1 }; };
  // the level function of a piece's component (a form: exact; a formula component: its g; freehand: none)
  function levelFn(pc, comp) {
    if (pc.kind === 'traced') return comp && typeof comp.g === 'function' ? comp.g : null;
    const G = pc.G;
    return G ? (x, y) => fOf(G, [x, y]) : null;
  }
  // [review math-11] Newton on two level functions from a polyline crossing, to float64 (central differences); the
  // estimate stays when it does not converge within the chord's reach h
  function newton2(z, fa, fb, h) {
    if (!fa || !fb) return z;
    let p = z.slice();
    for (let k = 0; k < 8; k++) {
      const e = 1e-7 * (1 + Math.abs(p[0]) + Math.abs(p[1]));
      const a = fa(p[0], p[1]), b = fb(p[0], p[1]);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return z;
      if (a === 0 && b === 0) break;
      const ax = (fa(p[0] + e, p[1]) - fa(p[0] - e, p[1])) / (2 * e), ay = (fa(p[0], p[1] + e) - fa(p[0], p[1] - e)) / (2 * e);
      const bx = (fb(p[0] + e, p[1]) - fb(p[0] - e, p[1])) / (2 * e), by = (fb(p[0], p[1] + e) - fb(p[0], p[1] - e)) / (2 * e);
      const det = ax * by - ay * bx;
      if (!Number.isFinite(det) || det === 0) return z;
      const dx = (a * by - b * ay) / det, dy = (b * ax - a * bx) / det;
      p = [p[0] - dx, p[1] - dy];
      if (Math.hypot(dx, dy) <= 1e-15 * (1 + Math.abs(p[0]) + Math.abs(p[1]))) break;
    }
    return isXY(p) && Math.hypot(p[0] - z[0], p[1] - z[1]) <= 2 * h + 1e-12 ? p : z;
  }
  // the point of a level set nearest z (Newton along the gradient), within reach h of z
  function newton1(z, f, h) {
    if (!f) return z;
    let p = z.slice();
    for (let k = 0; k < 8; k++) {
      const e = 1e-7 * (1 + Math.abs(p[0]) + Math.abs(p[1]));
      const v = f(p[0], p[1]);
      if (!Number.isFinite(v)) return z;
      if (v === 0) break;
      const gx = (f(p[0] + e, p[1]) - f(p[0] - e, p[1])) / (2 * e), gy = (f(p[0], p[1] + e) - f(p[0], p[1] - e)) / (2 * e), g2 = gx * gx + gy * gy;
      if (!(g2 > 0)) return z;
      const dx = v * gx / g2, dy = v * gy / g2;
      p = [p[0] - dx, p[1] - dy];
      if (Math.hypot(dx, dy) <= 1e-15 * (1 + Math.abs(p[0]) + Math.abs(p[1]))) break;
    }
    return isXY(p) && Math.hypot(p[0] - z[0], p[1] - z[1]) <= 2 * h + 1e-12 ? p : z;
  }
  // the crossing of two pieces nearest z (traced pieces: the polyline crossing nearest the seed z, refined); box limits
  // the search ({x0, x1, y0, y1}, optional). Returns {z, index} | {z, seed} | null [C28]
  function meetNear(pa, pb, z, box) {
    if (!pa || !pb || pa.kind === 'none' || pb.kind === 'none') return null;
    const inBox = (p) => !box || (p[0] >= box.x0 && p[0] <= box.x1 && p[1] >= box.y0 && p[1] <= box.y1);
    if (pa.kind === 'traced' || pb.kind === 'traced') {
      const tp = pa.kind === 'traced' ? pa : pb;
      const b = box || bboxPts([].concat(...(tp.comps || [{ pts: tp.pts }]).map((c) => c.pts)));
      const xs = [];
      for (const ca of polysOf(pa, b)) for (const cb of polysOf(pb, b)) {
        for (const x of polyCross(ca.pts, cb.pts)) {
          const r = newton2(x.z, levelFn(pa, ca), levelFn(pb, cb), x.h);
          if (inBox(r)) xs.push(r);
        }
      }
      if (!xs.length) return null;
      xs.sort((p, q) => Math.hypot(p[0] - z[0], p[1] - z[1]) - Math.hypot(q[0] - z[0], q[1] - z[1]));
      return { z: xs[0], seed: xs[0] };
    }
    let best = null, bd = Infinity;
    for (const m of meetsOf(pa, pb)) {
      if (!m.z || m.z === INF || !onPiece(pa, m.z) || !onPiece(pb, m.z) || !inBox(m.z)) continue;
      const d = Math.hypot(m.z[0] - z[0], m.z[1] - z[1]);
      if (d < bd) { bd = d; best = { z: m.z, index: m.index }; }
    }
    return best;
  }
  // a point of a piece by its parameter (wraps on closed pieces) and the parameter of the point nearest z
  //   c3 (a circle through three points): S(t) = M(tan(pi t)), M(0, 1, inf) = P, Q, R: S(0) = P, S(1/4) = Q, S(1/2) = R
  //   (one of P, Q, R may be infinity: the limit map [math-12]); an arc a, m, b: S(t) = M(tan(pi t / 2)), M(0, 1, inf) =
  //   a, m, b: S(0) = a, S(1/2) = m, S(1) = b [math-7]
  function glide(pc, t, pts3) {
    if (!pc || !Number.isFinite(t) || pc.kind === 'none') return null;
    if (pc.kind === 'traced') return null;
    // [v16.4 segments] the arc: its ends bitwise at t <= 0 and t >= 1, else K's glider map at u0 + t D
    if (pc.seg) { const q = pc.seg; return t <= 0 ? cpz(q.ends[0]) : t >= 1 ? cpz(q.ends[1]) : segAtU(q, q.u0 + t * q.D); }
    if (pts3 && pts3.mr) {
      const u = (((t % 1) + 1) % 1), H = reanchorAt(pc.G, pts3.mr);
      return Math.abs(u - 0.5) < 1e-15 ? mR(H, Infinity) : mR(H, pts3.sg * pts3.s * Math.tan(Math.PI * u));
    }
    if (pts3) { const u = (((t % 1) + 1) % 1); if (Math.abs(u - 0.5) < 1e-15) return isInf(pts3[2]) ? INF : pts3[2].slice(); return mob3x(pts3[0], pts3[1], pts3[2], Math.tan(Math.PI * u)); }
    if (pc.arc3) {
      const [a, m, b] = pc.arc3;
      if (t <= 0) return a.slice();
      if (t >= 1) return b.slice();
      if (t === 0.5) return m.slice();
      return mob3t(a, m, b, Math.tan(Math.PI * t / 2));
    }
    if (pc.poly) {
      const P = pc.poly.pts, n = P.length;
      const u = pc.poly.closed ? ((t % n) + n) % n : t;
      const i = Math.min(n - 1, Math.max(0, Math.floor(u))), f = u - i, a = P[i], b = P[(i + 1) % n];
      return [a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1])];
    }
    if (pc.kind === 'line') return [pc.a[0] + t * (pc.b[0] - pc.a[0]), pc.a[1] + t * (pc.b[1] - pc.a[1])];
    const u = pc.closed ? (((t % 1) + 1) % 1) : t, an = pc.a0 + u * (pc.closed ? TAU : pc.span);
    // [v16.5 rail SPEC 3.4] a whole circle from 0: cos and sin of the turn u, exact at the quarter turns, and the half-turn
    // partner the bitwise negation (a detent at i is i; t and t + 1/2 are antipodes)
    if (pc.closed && pc.a0 === 0) { const [cu, su] = turnCS(u); return [pc.c[0] + pc.r * cu, pc.c[1] + pc.r * su]; }
    return [pc.c[0] + pc.r * Math.cos(an), pc.c[1] + pc.r * Math.sin(an)];
  }
  // [v16.5 rail SPEC 3.4] the perpendicular circle through two gliders on C's own plain circle (no pts3, its t a turn
  // fraction) whose parameters are half a turn apart (to 2^-40): the line through C's centre and P, its normal on the side
  // of K's normal at P (the orientation of the circle it is the limit of). ctx: {idx}; G: perpForm's form. null: not that
  function antipodeLine(ctx, pc, cr, ra, rb, P, G) {
    if (!pc || pc.kind !== 'circle' || !pc.closed || pc.c3 || pc.arc3 || pc.seg || pc.a0 !== 0) return null;
    const tOf = (r) => {
      if (!r || typeof r.s !== 'string' || r.h || r.part != null) return null;
      const e = ctx.idx.get(r.s), d = e && e.s.def;
      if (!d || d.op !== 'glider' || !Array.isArray(d.args) || !d.args[0] || d.args[0].s !== cr.s || (d.args[0].part | 0) !== (cr.part | 0)) return null;
      return Number.isFinite(e.s.t) ? e.s.t : null;
    };
    const ta = tOf(ra), tb = tOf(rb);
    if (ta == null || tb == null) return null;
    const dt = tb - ta, f = dt - Math.floor(dt);
    if (!(Math.abs(f - 0.5) <= Math.pow(2, -40))) return null;
    const o = pc.c, v = sub(P, o), L = abs(v);
    if (!(L > 0)) return null;
    let n = [-v[1] / L, v[0] / L];
    if (n[0] * G.B[0] + n[1] * G.B[1] < 0) n = [-n[0], -n[1]];
    return gc(0, n, 0, o);
  }
  // (cos 2 pi u, sin 2 pi u) for u in [0, 1): reduced to a half turn and a quarter turn first
  function turnCS(u) {
    let sg = 1;
    if (u >= 0.5) { u -= 0.5; sg = -1; }
    let c, s;
    if (u < 0.25) { if (u === 0) { c = 1; s = 0; } else { const a = TAU * u; c = Math.cos(a); s = Math.sin(a); } }
    else { const v = u - 0.25; if (v === 0) { c = 0; s = 1; } else { const a = TAU * v; c = -Math.sin(a); s = Math.cos(a); } }
    return [sg * c + 0, sg * s + 0];
  }
  // ---------------------------------------------------------------- [v16.5 rail] the grid lattice and the pull off a rail
  // the finest drawn grid tier at least 14 px apart (gl.js drawGrid's tiers: 0.5, 1, 5, 10, 50, 100 times d0)
  const GRID_TIERS = [0.5, 1, 5, 10, 50, 100];
  function gridStep(s) {
    if (!(s > 0)) return 1;
    const d0 = Math.pow(10, Math.ceil(Math.log10(8 / s)));
    for (const m of GRID_TIERS) if (d0 * m * s >= 14) return +(d0 * m).toPrecision(12);
    return +(d0 * 100).toPrecision(12);
  }
  // [v16.5 fix rail-2, user-2] the detents may never quantize a rail: a circle drawn rPx px in radius takes the finest of
  // 15°, 30°, 45° and 90° whose arc is at least 5 detent radii R on screen, so one detent's window covers at most 40 % of
  // the rail (60 px per unit: 30° with a mouse, 90° with a finger, which then rests at 37°; 15° again zoomed in).
  // {deg, R} | null (a circle too small for any). A line's lattice detents: R capped at a fifth of the step
  const DETENT_DEG = [15, 30, 45, 90];
  function angleDetent(rPx, R) {
    if (!(rPx > 0) || !(R > 0)) return null;
    for (const deg of DETENT_DEG) { const arc = rPx * deg * Math.PI / 180; if (arc >= 5 * R) return { deg, R: Math.min(R, 0.2 * arc) }; }
    return null;
  }
  const latticeDetentR = (stepPx, R) => Math.max(0, Math.min(R, 0.2 * stepPx));
  // the zones of a pull (SPEC 2.3), in screen px: glide below glide; stretch up to free; let go at free held for dwell
  // ms, or at yank at once
  const RAIL = { mouse: { glide: 16, free: 40, yank: 80 }, touch: { glide: 24, free: 64, yank: 128 }, dwell: 120 };
  // railPull(state, d, now, touch) -> {zone: 'glide' | 'stretch' | 'free', state}: state is {since} (the time d first
  // reached free in the current run) or null; pure
  function railPull(state, d, now, touch) {
    const R = touch ? RAIL.touch : RAIL.mouse;
    if (!(d >= R.glide)) return { zone: 'glide', state: null };
    if (d >= R.yank) return { zone: 'free', state: null };
    if (d < R.free) return { zone: 'stretch', state: null };
    const since = state && Number.isFinite(state.since) ? state.since : now;
    return now - since >= RAIL.dwell ? { zone: 'free', state: null } : { zone: 'stretch', state: { since } };
  }
  function tRange(pc) {
    if (!pc || pc.kind === 'none') return [0, 0];
    if (pc.seg || pc.arc3) return [0, 1];
    if (pc.kind === 'line') return pc.poly ? [0, pc.poly.closed ? Infinity : pc.poly.pts.length - 1] : [pc.lo, pc.hi];
    if (pc.kind === 'circle') return pc.closed ? [-Infinity, Infinity] : [0, 1];
    return [0, 0];
  }
  function projectPiece(pc, z, pts3) {
    if (!pc || pc.kind === 'none') return null;
    if (pc.kind === 'traced') {
      let best = null, bd = Infinity, bc = null, bh = 0;
      for (const comp of pc.comps || [{ pts: pc.pts }]) {
        const P = comp.pts;
        for (let i = 1; i < P.length; i++) {
          const a = P[i - 1], b = P[i], d = sub(b, a), L = dot(d, d);
          const t = L > 0 ? Math.max(0, Math.min(1, dot(sub(z, a), d) / L)) : 0, q = add(a, scl(d, t));
          const dd = Math.hypot(q[0] - z[0], q[1] - z[1]);
          if (dd < bd) { bd = dd; best = q; bc = comp; bh = Math.sqrt(L); }
        }
      }
      if (!best) return null;
      const r = newton1(best, bc && typeof bc.g === 'function' ? bc.g : null, bh);     // [math-11] onto the level set
      return { seed: r, z: r };
    }
    if (pc.seg) {
      // [v16.4 segments] the nearest point of the carrier, by its u along the arc; off the arc, the nearer end (on the sphere)
      // (infinity, review math-2: u = 1/2; an infinite end is that end, else its t on the arc, else the nearer end)
      const q = pc.seg, w = isInf(z) ? INF : projectForm(pc.G, z), v = isInf(w) ? span1(q.u0, 0.5) : isXY(w) ? span1(q.u0, segU(q.H, q.k, w)) : NaN;
      const ie = isInf(z) ? q.ends.findIndex(isInf) : -1;
      const t = ie >= 0 ? ie : v <= q.D ? v / q.D : v >= 1 - 1e-12 ? 0 : (chordal(z, q.ends[0]) <= chordal(z, q.ends[1]) ? 0 : 1);
      return { t, z: glide(pc, t) };
    }
    if (pts3 && pts3.mr) {
      // tau of the nearest point w: w - o = i B tau / (1 - i A tau / 2), so tau = (w - o) / (i (B + A (w - o) / 2))
      const w = projectForm(pc.G, z), H = reanchorAt(pc.G, pts3.mr), v = sub(w, H.o);
      const den = [H.B[0] + H.A * v[0] / 2, H.B[1] + H.A * v[1] / 2], tau = div(v, [-den[1], den[0]])[0];
      let t = Math.atan(tau / (pts3.sg * pts3.s)) / Math.PI;
      if (!Number.isFinite(t)) t = 0.5;
      t = ((t % 1) + 1) % 1;
      return { t, z: glide(pc, t, pts3) };
    }
    if (pts3) {
      const w = projectForm(pc.G, z);
      let t = Math.atan(mob3invx(pts3[0], pts3[1], pts3[2], w)) / Math.PI;
      if (!Number.isFinite(t)) t = 0.5;
      t = ((t % 1) + 1) % 1;
      return { t, z: glide(pc, t, pts3) };
    }
    if (pc.arc3) {
      const [a, m, b] = pc.arc3;
      const w = projectForm(pc.G, z), tau = mob3inv(a, m, b, w);
      let t;
      if (tau >= 0 && tau < Infinity) t = 2 * Math.atan(tau) / Math.PI;
      else if (tau === Infinity) t = 1;
      else t = Math.hypot(z[0] - a[0], z[1] - a[1]) <= Math.hypot(z[0] - b[0], z[1] - b[1]) ? 0 : 1;
      return { t, z: glide(pc, t) };
    }
    if (pc.poly) {
      const P = pc.poly.pts, n = P.length;
      let best = null, bd = Infinity;
      for (let i = 0; i < (pc.poly.closed ? n : n - 1); i++) {
        const a = P[i], b = P[(i + 1) % n], d = sub(b, a), L = dot(d, d);
        const f = L > 0 ? Math.max(0, Math.min(1, dot(sub(z, a), d) / L)) : 0, q = add(a, scl(d, f));
        const dd = Math.hypot(q[0] - z[0], q[1] - z[1]);
        if (dd < bd) { bd = dd; best = { t: i + f, z: q }; }
      }
      return best;
    }
    if (pc.kind === 'line') {
      const d = sub(pc.b, pc.a), L = dot(d, d);
      let t = dot(sub(z, pc.a), d) / L;
      t = Math.max(pc.lo, Math.min(pc.hi, t));
      return { t, z: glide(pc, t) };
    }
    const an = Math.atan2(z[1] - pc.c[1], z[0] - pc.c[0]);
    let u = ((((an - pc.a0) % TAU) + TAU) % TAU) / (pc.closed ? TAU : pc.span);
    if (!pc.closed && u > 1) u = (u - 1) * pc.span < (TAU - pc.span) / 2 ? 1 : 0;
    return { t: u, z: glide(pc, u) };
  }
  // the distance from z to a piece (the snap): exact for a closed form, |f| / (|grad f| / 2 + 1), at any radius
  function pieceDist(pc, z) {
    if (!pc || pc.kind === 'none') return Infinity;
    if (pc.kind === 'circle' && pc.closed && pc.G) {
      const u = sub(z, pc.G.o), f = fOf(pc.G, z), g = 2 * Math.hypot(pc.G.A * u[0] + pc.G.B[0], pc.G.A * u[1] + pc.G.B[1]);
      return Math.abs(f) / (g / 2 + 1);
    }
    if (pc.kind === 'line' && !pc.arc3 && !pc.seg) {
      const d = [pc.b[0] - pc.a[0], pc.b[1] - pc.a[1]], L = d[0] * d[0] + d[1] * d[1];
      let t = ((z[0] - pc.a[0]) * d[0] + (z[1] - pc.a[1]) * d[1]) / L;
      t = Math.max(pc.lo, Math.min(pc.hi, t));
      return Math.hypot(pc.a[0] + t * d[0] - z[0], pc.a[1] + t * d[1] - z[1]);
    }
    if (pc.kind === 'traced') {
      let best = Infinity;
      for (const comp of pc.comps || [{ pts: pc.pts || [] }]) {
        const P = comp.pts;
        for (let i = 1; i < P.length; i++) {
          const a = P[i - 1], b = P[i], d = [b[0] - a[0], b[1] - a[1]], L = d[0] * d[0] + d[1] * d[1];
          const t = L > 0 ? Math.max(0, Math.min(1, ((z[0] - a[0]) * d[0] + (z[1] - a[1]) * d[1]) / L)) : 0;
          best = Math.min(best, Math.hypot(a[0] + t * d[0] - z[0], a[1] + t * d[1] - z[1]));
        }
      }
      return best;
    }
    const pr = projectPiece(pc, z);
    return pr && isXY(pr.z) ? Math.hypot(pr.z[0] - z[0], pr.z[1] - z[1]) : Infinity;
  }
  // a piece's bounding box (Infinity for unbounded pieces): the snap's prefilter [review regress-4]
  function pieceBox(pc) {
    if (!pc || pc.kind === 'none') return null;
    if (pc.kind === 'traced') return bboxPts([].concat(...(pc.comps || [{ pts: pc.pts }]).map((c) => c.pts)));
    if (pc.kind === 'line') {
      if (!(Number.isFinite(pc.lo) && Number.isFinite(pc.hi))) return { x0: -Infinity, x1: Infinity, y0: -Infinity, y1: Infinity };
      const p = glide(Object.assign({}, pc, { arc3: null, poly: null }), pc.lo), q = glide(Object.assign({}, pc, { arc3: null, poly: null }), pc.hi);
      return bboxPts([p, q]);
    }
    if (pc.kind === 'circle') return Number.isFinite(pc.r) && pc.r < 1e12 ? { x0: pc.c[0] - pc.r, x1: pc.c[0] + pc.r, y0: pc.c[1] - pc.r, y1: pc.c[1] + pc.r } : { x0: -Infinity, x1: Infinity, y0: -Infinity, y1: Infinity };
    return null;
  }

  // ---------------------------------------------------------------- the graph over the state (SPEC 3)
  const OPS = { circle3: { n: 3, pts: true }, perp: { n: 3, sig: ['c', 'p', 'p'] }, touch: { n: 3, sig: ['c', 'p', 'p'] }, tangent: { n: 2, sig: ['c', 'p'] }, midpoint: { n: 2, pts: true }, bisector: { n: 2, pts: true }, meet: { n: 2, curves: true }, glider: { n: 1, curves: true } };
  const POINT_OPS = new Set(['meet', 'glider', 'midpoint']);
  const isNode = (s) => !!s && ((s.at && typeof s.at === 'object') || (s.def && typeof s.def === 'object'));
  function refsOf(s) {
    const out = [];
    if (s.at && typeof s.at === 'object') for (const [k, r] of Object.entries(s.at)) out.push({ key: k, ref: r, at: true });
    if (s.def && Array.isArray(s.def.args)) s.def.args.forEach((r, i) => out.push({ key: i, ref: r, at: false }));
    return out;
  }
  // the shape ids a ref depends on (the shape of a handle, a point, a curve; X's point of an image ref)
  const refDep = (r) => (r && typeof r.s === 'string' ? r.s : r && typeof r.img === 'string' ? r.img : null);
  function structSig(state) {
    let sig = '';
    for (const L of lists(state)) {
      for (const s of L) if (s && isNode(s)) sig += s.id + JSON.stringify(s.at || 0) + (s.def ? s.def.op + JSON.stringify(s.def.args) : '') + ';';
      sig += '|';
    }
    return sig;
  }
  const graphCache = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function graphOf(state) {
    const sig = structSig(state);
    const c = graphCache && graphCache.get(state);
    if (c && c.sig === sig && c.shapes === state.shapes && c.targets === state.targets) return c;
    const idx = index(state);
    const nodes = new Map(), users = new Map();
    const all = [];
    lists(state).forEach((L) => L.forEach((s) => { if (s && s.id) all.push(s); }));
    for (const s of all) {
      if (!isNode(s)) continue;
      const deps = new Set(), zps = new Set();
      let img = false;
      for (const { ref } of refsOf(s)) {
        const d = refDep(ref);
        if (d && idx.has(d)) deps.add(d);
        if (ref && typeof ref.zp === 'string') zps.add(ref.zp);
        if (ref && typeof ref.img === 'string') img = true;
      }
      nodes.set(s.id, { id: s.id, s, deps, zps, img });
      for (const d of deps) { if (!users.has(d)) users.set(d, new Set()); users.get(d).add(s.id); }
    }
    // Kahn's algorithm, ties broken by list order (shapes, then targets)
    const pos = new Map(all.map((s, i) => [s.id, i]));
    const indeg = new Map();
    for (const n of nodes.values()) indeg.set(n.id, [...n.deps].filter((d) => nodes.has(d)).length);
    const ready = [...nodes.keys()].filter((k) => indeg.get(k) === 0).sort((a, b) => pos.get(a) - pos.get(b));
    const order = [];
    while (ready.length) {
      const x = ready.shift();
      order.push(x);
      for (const y of users.get(x) || []) {
        if (!nodes.has(y)) continue;
        indeg.set(y, indeg.get(y) - 1);
        if (indeg.get(y) === 0) {
          // insert by list order (ties by list order)
          let k = 0; while (k < ready.length && pos.get(ready[k]) < pos.get(y)) k++;
          ready.splice(k, 0, y);
        }
      }
    }
    const cyclic = new Set([...nodes.keys()].filter((k) => !order.includes(k)));
    const G = { sig, shapes: state.shapes, targets: state.targets, nodes, users, order, cyclic, idx };
    if (graphCache) graphCache.set(state, G);
    return G;
  }
  function closure(G, ids) {
    const seen = new Set(), st = [...ids];
    while (st.length) { const x = st.pop(); if (seen.has(x)) continue; seen.add(x); for (const y of G.users.get(x) || []) st.push(y); }
    return seen;
  }
  // Constr.graph(state): {order, users(id), sources(id), roots(id), excluded(id, key?)}
  function graph2(state) {
    const G = graphOf(state);
    const users = (id) => { const s = closure(G, [id]); s.delete(id); return s; };
    const sources = (id) => { const n = G.nodes.get(id); return n ? [...n.deps] : []; };
    const roots = (id) => {
      const out = new Set(), seen = new Set(), st = [id];
      while (st.length) {
        const x = st.pop();
        if (seen.has(x)) continue; seen.add(x);
        const n = G.nodes.get(x);
        if (!n || (x !== id && !n.deps.size && !n.zps.size)) { if (x !== id) out.add(x); continue; }
        for (const d of n.deps) st.push(d);
        if (n.zps.size) for (const z of n.zps) out.add('zp:' + z);
      }
      return out;
    };
    // the targets a gesture on shape id (handle key) may not use: itself, everything built on it, and the
    // co-arguments of every construction it (or that handle) defines [C11]
    const excluded = (id, key) => {
      const out = closure(G, [id]);
      for (const uid of G.users.get(id) || []) {
        const n = G.nodes.get(uid);
        if (!n) continue;
        const rs = refsOf(n.s);
        if (!rs.some(({ ref }) => refDep(ref) === id && (key == null || !ref.h || ref.h === key))) continue;
        for (const { ref } of rs) { const d = refDep(ref); if (d && d !== id) out.add(d); }
      }
      return out;
    };
    return { order: G.order.slice(), cyclic: [...G.cyclic], users, sources, roots, excluded, has: (id) => G.nodes.has(id) };
  }

  // ---------------------------------------------------------------- incidence (collinear by construction)
  function canonKey(ctx, ref, depth = 0) {
    if (!ref) return '?';
    if (depth > 32) return refKey(ref);
    if (typeof ref.s === 'string' && ref.part == null) {
      const e = ctx.idx.get(ref.s);
      if (e) {
        const k = ref.h || (e.s.kind === 'point' ? 'p' : null);
        if (k && e.s.at && e.s.at[k]) return canonKey(ctx, e.s.at[k], depth + 1);
      }
      return ref.h ? `s:${ref.s}:${ref.h}` : `s:${ref.s}`;
    }
    return refKey(ref);
  }
  const keyOf2 = (p, q) => [p, q].sort().join('|');
  function lineKeysOfCurve(ctx, cref, depth = 0) {
    const out = new Set();
    if (!cref || depth > 16) return out;
    const e = ctx.idx.get(cref.s);
    if (!e) return out;
    const s = e.s;
    const pcs = ctx.piecesOf(s);
    const pc = pcs[cref.part | 0];
    if (!pc || pc.kind !== 'line') return out;
    out.add(`L:${s.id}:${pc.part}`);
    if (['line', 'segment', 'ray', 'halfplane'].includes(s.kind) && !s.def && s.at && s.at.a && s.at.b) {
      const ka = canonKey(ctx, s.at.a), kb = canonKey(ctx, s.at.b);
      out.add(keyOf2(ka, kb));
      const ia = incOf(ctx, ka, depth + 1), ib = incOf(ctx, kb, depth + 1);
      for (const k of ia) if (ib.has(k)) out.add(k);
    }
    if (s.def && s.def.op === 'circle3' && s._g && s._g.A === 0 && s._g.byInc) {
      const ks = s.def.args.map((r) => canonKey(ctx, r));
      for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) out.add(keyOf2(ks[i], ks[j]));
    }
    return out;
  }
  function incOf(ctx, key, depth = 0) {
    const out = new Set();
    if (depth > 16) return out;
    const m = /^s:([^:]+)$/.exec(key);
    if (!m) return out;
    const e = ctx.idx.get(m[1]);
    if (!e || !e.s.def) return out;
    const d = e.s.def;
    if (d.op === 'meet') for (const c of d.args) for (const k of lineKeysOfCurve(ctx, c, depth + 1)) out.add(k);
    // [review math-4] a glider on a polygon or rectangle slides over every side: it is on no one side's line
    if (d.op === 'glider') {
      const ce = ctx.idx.get(d.args[0] && d.args[0].s), pc = ce ? ctx.piecesOf(ce.s)[d.args[0].part | 0] : null;
      if (!(pc && pc.poly)) for (const k of lineKeysOfCurve(ctx, d.args[0], depth + 1)) out.add(k);
    }
    if (d.op === 'midpoint') {
      const ka = canonKey(ctx, d.args[0]), kb = canonKey(ctx, d.args[1]);
      out.add(keyOf2(ka, kb));
      const ia = incOf(ctx, ka, depth + 1), ib = incOf(ctx, kb, depth + 1);
      for (const k of ia) if (ib.has(k)) out.add(k);
    }
    return out;
  }
  function collinearByRefs(ctx, refs) {
    const [p, q, r] = refs.map((x) => canonKey(ctx, x));
    const ip = incOf(ctx, p), iq = incOf(ctx, q), ir = incOf(ctx, r);
    if (ir.has(keyOf2(p, q)) || iq.has(keyOf2(p, r)) || ip.has(keyOf2(q, r))) return true;
    for (const k of ip) if (iq.has(k) && ir.has(k)) return true;
    return false;
  }

  // ---------------------------------------------------------------- evaluating one node
  const GEOM_FIELDS = ['p', 'a', 'b', 'c', 'r', 'complement'];
  function setKind(s, kind, fields) {
    const before = s.kind;
    for (const k of GEOM_FIELDS) if (!(k in fields) && k in s && (k !== 'p' || kind !== 'point')) delete s[k];
    s.kind = kind;
    let ch = before !== kind;
    for (const [k, v] of Object.entries(fields)) {
      if (Array.isArray(v)) { if (!Array.isArray(s[k]) || s[k][0] !== v[0] || s[k][1] !== v[1]) { s[k] = v.slice(); ch = true; } }
      else if (v === undefined) { if (k in s) { delete s[k]; ch = true; } }
      else if (s[k] !== v) { s[k] = v; ch = true; }
    }
    return { ch, kindChanged: before !== kind };
  }
  // the concrete fields of a form: curve ('circle' | 'line') or region ('disc' | 'halfplane' | complement)
  function fieldsOfForm(G, region, keepKind) {
    if (G.A === 0) {
      const g = geomOf(G);
      const kind = region ? 'halfplane' : 'line';
      return { kind: keepKind && ['line', 'halfplane'].includes(keepKind) && !region ? keepKind : kind, f: { a: g.p, b: add(g.p, g.d), c: undefined, r: undefined, complement: undefined } };
    }
    const g = geomOf(G);
    if (!region) return { kind: 'circle', f: { c: g.c, r: g.r, a: undefined, b: undefined, complement: undefined } };
    return { kind: 'disc', f: { c: g.c, r: g.r, a: undefined, b: undefined, complement: G.A < 0 ? true : undefined } };
  }
  // the ops whose def.flip is Use complement (a curve built on one undoes it: K never turns over) [v16.3 review math-2]
  const FLIPPED = ['circle3', 'perp', 'touch', 'tangent'];
  // T on the curve of the form G, to within rounding: the distance |f(T)| / |grad f(T)| at most 1e-12 S, S the figure's
  // size (|T|, |P|, |P - T|, C's centre and radius, or its anchor for a line) [v16.3 review math-1]
  function onCarrier(G, T, P) {
    const u = sub(T, G.o), f = G.A * dot(u, u) + 2 * dot(G.B, u) + G.C, gr = 2 * abs([G.A * u[0] + G.B[0], G.A * u[1] + G.B[1]]);
    if (f === 0) return true;
    if (!(gr > 0)) return false;
    let S = Math.max(abs(T), abs(G.o), 1e-300);
    if (P && !isInf(P)) S = Math.max(S, abs(P), abs(sub(P, T)));
    if (G.A !== 0) { const g = geomOf(G); S = Math.max(S, abs(g.c) + g.r); }
    return Math.abs(f) / gr <= 1e-12 * S;
  }
  // evaluate shape s (a node). Returns {ch, kindChanged, undef: {code, args} | null, inf}
  function evalNode(ctx, s, plane) {
    const pt = (r) => resolveIn(ctx, r, plane);
    const fail = (u) => ({ undef: u.undef || u });
    const res = { ch: false, kindChanged: false, undef: null, inf: false };
    const def = s.def;
    if (def) {
      const op = def.op, args = Array.isArray(def.args) ? def.args : [];
      if (op === 'circle3' || op === 'midpoint' || op === 'bisector') {
        const R = args.map(pt);
        const bad = R.find((x) => x.undef);
        if (bad) return fail(bad);
        const P = R.map((x) => (x.inf ? INF : x.z));
        if (op === 'midpoint') {
          if (P.some(isInf)) { res.inf = true; return res; }
          const r = setKind(s, 'point', { p: [(P[0][0] + P[1][0]) / 2, (P[0][1] + P[1][1]) / 2] });
          res.ch = r.ch; res.kindChanged = r.kindChanged; delete s._g;
          return res;
        }
        if (op === 'bisector') {
          if (P.some(isInf)) return fail(U('lineInf'));
          if (eqP(P[0], P[1])) return fail(U('coincide'));
          const G = bisector(P[0], P[1]);
          const ff = fieldsOfForm(G, s.kind === 'halfplane', s.kind);
          const r = setKind(s, ff.kind, ff.f);
          s._g = G;
          res.ch = r.ch; res.kindChanged = r.kindChanged;
          return res;
        }
        // circle3: the exact predicate decides A (0 for collinear points and by incidence); flip from creation
        const fin = P.filter((x) => !isInf(x));
        if (fin.length < 2) return fail(U('lineInf'));
        if ((fin.length === 3 && (eqP(P[0], P[1]) || eqP(P[1], P[2]) || eqP(P[0], P[2]))) || (fin.length === 2 && eqP(fin[0], fin[1]))) return fail(U('coincide3'));
        const inc = fin.length === 3 && collinearByRefs(ctx, args);
        let G = circle3(P[0], P[1], P[2], inc);
        if (!G) return fail(U('coincide3'));
        // at creation (SPEC 2.3): the disc whatever the order of the taps (sign(A) of the same form that is drawn, so
        // the decimal-collinear rule [math-3] holds here too); collinear points keep the left side of P -> Q [math-9]
        if (def.flip == null) def.flip = fin.length === 3 && (G.A < 0 || (G.A === 0 && dot(geomOf(G).d, sub(P[1], P[0])) < 0));
        if (def.flip) G = flipG(G);
        G.byInc = inc && G.A === 0;
        // (v16.3.1, verify-1: the three points the form was built through, for perpForm's decimal mirror test; a
        // flip keeps them, as a re-anchoring does)
        if (fin.length === 3) G.p3 = P.map((z) => z.slice());
        // the Lambda rule's thru0 from incidence [C9]: a defining point exactly at 0 (the anchor, C = 0 exactly)
        const zi = fin.findIndex((p) => p[0] === 0 && p[1] === 0);
        if (zi >= 0) { G = reanchorAt(G, fin[zi]); G.thru0 = true; }
        const ff = fieldsOfForm(G, def.fill === 'in');
        const r = setKind(s, ff.kind, ff.f);
        s._g = G;
        res.ch = r.ch || true; res.kindChanged = r.kindChanged;
        return res;
      }
      if (op === 'perp') {
        delete s._seg;
        const cr = args[0];
        if (!isCurveRef(cr)) return fail(U('argUndef', { x: null }));
        const e = ctx.idx.get(cr.s);
        if (!e || e.plane !== plane || e.s.cundef || e.s.undef) return fail(U('argUndef', { x: cr.s }));
        const pc = ctx.piecesOf(e.s)[cr.part];
        if (!pc || (pc.kind !== 'line' && pc.kind !== 'circle') || !pc.G) return fail(U('notCircle', { x: cr.s }));
        // the curve's own orientation: Use complement on a 3-point, perpendicular or touching circle does not turn K
        // over [v16.3 review math-2: one list for perp and touch]
        const cd = e.s.def, Gc = cd && cd.flip && FLIPPED.includes(cd.op) ? flipG(pc.G) : pc.G;
        const R = [args[1], args[2]].map(pt);
        const bad = R.find((x) => x.undef);
        if (bad) return fail(bad);
        const P = R[0].inf ? INF : R[0].z, Q = R[1].inf ? INF : R[1].z;
        const r = perpForm(Gc, P, Q, pc);
        if (r.undef) return fail(U(r.undef));
        let G = r.G;
        // [v16.5 rail SPEC 3.4] P and Q gliders on C's own plain circle, half a turn apart by their parameters: the diameter
        if (G.A !== 0 && !isInf(P) && !isInf(Q)) { const L = antipodeLine(ctx, pc, cr, args[1], args[2], P, G); if (L) G = L; }
        // at creation (SPEC 2.3, as circle3): the disc; a line keeps the left side of P -> Q
        if (def.flip == null) def.flip = !isInf(P) && !isInf(Q) && (G.A < 0 || (G.A === 0 && dot(geomOf(G).d, sub(Q, P)) < 0));
        if (def.flip) G = flipG(G);
        const fin = [P, Q].filter((z) => !isInf(z));
        if (fin.length === 2) { G.e = abs(sub(fin[1], fin[0])); withPts(G, fin); }
        if (G.o[0] === 0 && G.o[1] === 0) G.thru0 = true;
        // [issue #70] Between z0 and z1: the segment of K from P to Q (the side follows P: nothing stored)
        if (def.between === 1 && def.fill !== 'in') {
          const sd = betweenOf(G, pc.G, P, Q, !!def.flip);
          if (sd.undef) { delete s._seg; return fail(U(sd.undef)); }
          s._g = G; s._seg = sd;
          const rr = setKind(s, sd.kind, sd.fields);
          res.ch = true; res.kindChanged = rr.kindChanged;
          return res;
        }
        // [v16.4 segments SPEC 2] Inside C only: the arc of K on the side seg of Gc, its ends K ∩ C
        if ((def.seg === 1 || def.seg === -1) && def.fill !== 'in') {
          const sd = segOf(G, pc.G, Gc, def.seg, P, Q, !!def.flip);
          if (sd.undef) { delete s._seg; return fail(U(sd.undef)); }
          G.sg = { G: { A: pc.G.A, B: pc.G.B.slice(), C: pc.G.C, o: pc.G.o.slice() }, ends: sd.m };
          s._g = G; s._seg = sd;
          const rr = setKind(s, sd.kind, sd.fields);
          res.ch = true; res.kindChanged = rr.kindChanged;
          return res;
        }
        delete s._seg;
        const ff = fieldsOfForm(G, def.fill === 'in');
        const rr = setKind(s, ff.kind, Object.assign(ff.f, { m: undefined }));
        s._g = G;
        res.ch = true; res.kindChanged = rr.kindChanged;
        return res;
      }
      if (op === 'touch' || op === 'tangent') {
        const cr = args[0];
        if (!isCurveRef(cr)) return fail(U('argUndef', { x: null }));
        const e = ctx.idx.get(cr.s);
        if (!e || e.plane !== plane || e.s.cundef || e.s.undef) return fail(U('argUndef', { x: cr.s }));
        const pc = ctx.piecesOf(e.s)[cr.part];
        if (!pc || (pc.kind !== 'line' && pc.kind !== 'circle') || !pc.G) return fail(U('notCircle', { x: cr.s }));
        const cd = e.s.def, Gc = cd && cd.flip && FLIPPED.includes(cd.op) ? flipG(pc.G) : pc.G;
        const R = args.slice(1).map(pt);
        const bad = R.find((x) => x.undef);
        if (bad) return fail(bad);
        const Z = R.map((x) => (x.inf ? INF : x.z));
        // [v16.3 review math-1] T must lie on C's carrier (a rectangle's corner moves to other sides as its handles are
        // dragged; a crafted save): else K touches nothing, and the meet rule would report T as a crossing
        if (op === 'touch' && !isInf(Z[0]) && !onCarrier(pc.G, Z[0], Z[1])) return fail(U('offCurve', { x: cr.s, part: cr.part }));
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
      if (op === 'meet' || op === 'glider') {
        const cs = [];
        for (const r of args) {
          if (!isCurveRef(r)) return fail(U('argUndef', { x: null }));
          const e = ctx.idx.get(r.s);
          if (!e || e.plane !== plane) return fail(U('argUndef', { x: r.s }));
          if (e.s.cundef || e.s.undef) return fail(U('argUndef', { x: r.s }));
          const pc = ctx.piecesOf(e.s)[r.part];
          if (!pc) return fail(U('argUndef', { x: r.s }));
          cs.push({ pc, s: e.s });
        }
        if (op === 'meet') {
          let z = null;
          if (def.seed && (cs[0].pc.kind === 'traced' || cs[1].pc.kind === 'traced')) {
            const m = meetNear(cs[0].pc, cs[1].pc, def.seed, null);
            z = m ? m.z : null;
            if (!z) return fail(U('nomeet'));
          } else {
            const ms = meetsOf(cs[0].pc, cs[1].pc);
            const want = def.index === 'finite' ? 'finite' : (def.index | 0);
            const m = ms.find((x) => x.index === want) || (want !== 'finite' && ms.length === 1 ? null : null);
            if (!m && ms.length === 1 && ms[0].index === 'finite') z = ms[0].z;          // a pair turned into two lines
            else if (m) z = m.z;
            // two lines turned into a pair with a circle (an older save's 'finite' on a 3-point circle): the meet nearest
            // the last value, so the point does not jump to the far crossing [review math-5]
            if (z == null && ms.length === 2 && def.index === 'finite') {
              const fin = ms.filter((x) => isXY(x.z) && onPiece(cs[0].pc, x.z) && onPiece(cs[1].pc, x.z));
              const last = isXY(s.p) && !s._atInf ? s.p : null;
              if (fin.length && last) z = fin.sort((u, v) => Math.hypot(u.z[0] - last[0], u.z[1] - last[1]) - Math.hypot(v.z[0] - last[0], v.z[1] - last[1]))[0].z;
              else z = fin.length ? fin[0].z : ms[0].z;
            }
            if (z == null) return fail(U(ms.coincide ? 'coincideCurves' : 'nomeet'));
            if (z === INF) {
              if (!onPiece(cs[0].pc, INF) || !onPiece(cs[1].pc, INF)) return fail(U('nomeet'));
              res.inf = true;
              s._note = ms.every((x) => x.z === INF) || (ms.length === 1 && ms[0].z === INF) ? 'parallel' : null;
              return res;
            }
            if (!onPiece(cs[0].pc, z) || !onPiece(cs[1].pc, z)) return fail(U('nomeet'));
          }
          delete s._note;
          const r = setKind(s, 'point', { p: z });
          res.ch = r.ch; res.kindChanged = r.kindChanged; delete s._g;
          return res;
        }
        // glider: t on the piece (wraps on closed pieces), or the projection of the seed on a traced piece
        const pc = cs[0].pc, cs0 = cs[0].s;
        let z;
        if (pc.kind === 'traced') {
          const pr = projectPiece(pc, isXY(def.seed) ? def.seed : (isXY(s.p) ? s.p : pc.pts[0]));
          if (!pr) return fail(U('nomeet'));
          z = pr.z;
        } else {
          const t = Number.isFinite(s.t) ? s.t : 0;
          const p3 = ctx.pts3Of(cs0, plane);
          if (p3 === 'inf') return fail(U('argUndef', { x: cs0.id }));
          const [lo, hi] = p3 ? [-Infinity, Infinity] : tRange(pc);
          if (!(t >= lo - 1e-12 && t <= hi + 1e-12)) return fail(U('tRange', { t }));
          z = glide(pc, t, p3);
          if (!isXY(z)) { res.inf = true; return res; }
        }
        const r = setKind(s, 'point', { p: z });
        res.ch = r.ch; res.kindChanged = r.kindChanged; delete s._g;
        return res;
      }
      return fail(U('argUndef', { x: null }));
    }
    // bound handles: positions first, then the radii through their points [C15]
    const at = s.at || {};
    const keys = Object.keys(at);
    for (const k of keys) {
      if (RADIUS_KEYS.has(k)) continue;
      const r = pt(at[k]);
      if (r.undef) return fail(r);
      if (r.inf) return fail(U(['line', 'segment', 'ray', 'halfplane'].includes(s.kind) ? 'lineInf' : 'handleInf', { key: k }));
      const z = r.z;
      if (/^v\d+$/.test(k)) {
        const i = +k.slice(1);
        if (!Array.isArray(s.pts) || i >= s.pts.length) return fail(U('argUndef', { x: null }));
        if (!eqP(s.pts[i], z)) { s.pts[i] = z.slice(); res.ch = true; }
      } else if (k === 'c' || k === 'p' || k === 'a' || k === 'b' || k === 'm') {
        if (!isXY(s[k]) || !eqP(s[k], z)) { s[k] = z.slice(); res.ch = true; }
      }
    }
    if (['line', 'segment', 'ray', 'halfplane', 'rect'].includes(s.kind) && at.a && at.b && isXY(s.a) && isXY(s.b) && eqP(s.a, s.b)) return fail(U('coincide'));
    for (const k of keys) {
      if (!RADIUS_KEYS.has(k)) continue;
      const r = pt(at[k]);
      if (r.undef) return fail(r);
      if (r.inf) return fail(U('handleInf', { key: k }));
      if (!isXY(s.c)) return fail(U('argUndef', { x: null }));
      const rr = Math.hypot(r.z[0] - s.c[0], r.z[1] - s.c[1]);
      if (!(rr > 0)) return fail(U('coincide'));
      if (s[k] !== rr) { s[k] = rr; res.ch = true; }
    }
    return res;
  }
  function reanchorAt(G, p) {
    const du = [p[0] - G.o[0], p[1] - G.o[1]];
    const out = Object.assign({}, G, { B: [G.B[0] + G.A * du[0], G.B[1] + G.A * du[1]], C: 0, o: p.slice() });
    return out;
  }

  // (issue #20) Inside C only, the perpendicular and the touching circles live in src/constrortho.js
  const {
    segU, segAtU, span1, cpz, segInU, chordal, segOf, betweenOf, gcOf, segSideOf, segSides, mirrorIn, setSeg,
    setBetween, segCurves, perpForm, touchForm, tangentNear, tangentForm, touchAt, segAt, segParallel, onCurveByRefs
  } = ConstrOrtho({
    FLIPPED, INF, TAU, abs, add, canonKey, decOf, decompose, div, dot, eqP, fOf, flipG, formOfFields, gc, geomOf,
    handleKeys, handlePos, index, isCurveRef, isInf, isPointRef, isXY, ldexp, lists, mR, makeCtx, meets, mrTaus,
    onCarrier, onPiece, orientD, projectPiece, pts3In, reanchor, reanchorAt, recompute, resolveIn, scl, sub
  });

  // ---------------------------------------------------------------- recompute (SPEC 3)
  // Constr.recompute(state, changed, env) -> {ids, kindChanged, undefChanged, order}
  // changed: {all} | {shapes: [ids], zp: [step uids], chain: bool, params: bool}; env: {zp, zpAll, F, trace}
  function recompute(state, changed, env) {
    const G = graphOf(state);
    const ctx = makeCtx(state, env, G);
    let todo;
    if (!changed || changed.all) todo = G.order;
    else {
      const seeds = new Set(changed.shapes || []);
      const zp = new Set(changed.zp || []);
      for (const n of G.nodes.values()) {
        if ([...n.zps].some((u) => zp.has(u) || changed.zpAny)) seeds.add(n.id);
        if (n.img && changed.chain) seeds.add(n.id);
      }
      const cl = closure(G, seeds);
      todo = G.order.filter((id) => cl.has(id));
    }
    const out = { ids: [], kindChanged: [], undefChanged: [], order: G.order };
    for (const id of todo) {
      const n = G.nodes.get(id);
      if (!n || G.cyclic.has(id)) continue;
      const s = n.s, plane = ctx.idx.get(id).plane;
      let r;
      try { r = evalNode(ctx, s, plane); } catch (e) { r = { undef: { code: 'argUndef', args: { x: null } } }; }
      ctx.pieceCache.delete(s);
      const was = !!s.cundef, wasInf = !!s._atInf;
      if (r.undef) {
        const same = s.cundef && s.cundef.code === r.undef.code && JSON.stringify(s.cundef.args) === JSON.stringify(r.undef.args);
        if (!same) { s.cundef = r.undef; out.undefChanged.push(id); }
        // two owners [C2]: the graph hides it (cHid) when it is shown, or when the other owner hides it
        if (!s.cHid && (s.visible !== false || s.undefHid)) { s.visible = false; s.cHid = true; }
        if (!was) out.ids.push(id);
        continue;
      }
      if (was) {
        delete s.cundef; out.undefChanged.push(id);
        if (s.cHid) { delete s.cHid; if (!s.undefHid) s.visible = true; }
      }
      if (r.inf) { if (!wasInf) { s._atInf = true; r.ch = true; } } else if (wasInf) { delete s._atInf; r.ch = true; }
      if (r.ch || was) out.ids.push(id);
      if (r.kindChanged) out.kindChanged.push(id);
    }
    lastRecompute = { n: todo.length, ids: out.ids.length, at: Date.now() };
    return out;
  }
  let lastRecompute = null;
  function makeCtx(state, env, G) {
    const idx = G ? G.idx : index(state);
    const pieceCache = new Map();
    const ctx = { state, idx, env: env || {}, pieceCache };
    ctx.piecesOf = (s) => { if (!pieceCache.has(s)) pieceCache.set(s, pieces(s, ctx.env)); return pieceCache.get(s); };
    // the three points of a circle3 for its glider parameter, null when it is not a circle3; 'inf': an argument is
    // undefined. One of them may be infinity (INF): the limit map keeps the glider continuous [review math-12]
    ctx.pts3Of = (cs, plane) => pts3In(ctx, cs, plane);
    return ctx;
  }
  function pts3In(ctx, cs, plane) {
    // a perpendicular circle: the M(R) map anchored at P, scaled by |PQ|, its sign undoing the flip
    // (z(t) = mR(K at P, sg |PQ| tan(pi t)): P at 0, the point opposite P at 1/2, infinity there for a line)
    if (cs && cs.def && cs.def.op === 'perp') {
      if ((cs.def.seg || cs.def.between) && cs._seg) return null;           // (Inside C only, or Between: the arc's own t, 0 to 1 between its ends)
      const R = cs.def.args.slice(1).map((r) => resolveIn(ctx, r, plane));
      if (R.some((x) => x.undef)) return 'inf';
      const fin = R.filter((x) => !x.inf).map((x) => x.z);
      if (!fin.length) return 'inf';
      return { mr: fin[0], s: fin.length === 2 ? abs(sub(fin[1], fin[0])) : 1, sg: cs.def.flip ? -1 : 1 };
    }
    if (cs && cs.def && cs.def.op === 'touch') {
      if (cs.def.args[2] && cs.def.args[2].inf) return null;
      const R = cs.def.args.slice(1).map((r) => resolveIn(ctx, r, plane));
      if (R.some((x) => x.undef)) return 'inf';
      const fin = R.filter((x) => !x.inf).map((x) => x.z);
      if (!fin.length) return 'inf';
      return { mr: fin[0], s: fin.length === 2 ? abs(sub(fin[1], fin[0])) : 1, sg: cs.def.flip ? -1 : 1 };
    }
    if (!cs || !cs.def || cs.def.op !== 'circle3') return null;
    const R = cs.def.args.map((r) => resolveIn(ctx, r, plane));
    if (R.some((x) => x.undef)) return 'inf';
    if (R.filter((x) => x.inf).length > 1) return 'inf';
    return R.map((x) => (x.inf ? INF : x.z));
  }
  // Constr.pts3(state, shape, plane, env): the same, for the interface's projections
  function pts3(state, s, plane, env) {
    const r = pts3In({ state, idx: index(state), env: env || {} }, s, plane | 0);
    return r === 'inf' ? null : r;
  }

  // ---------------------------------------------------------------- validate (load), plans (SPEC 8, 9)
  // Constr.validate(state, env): fallbacks [C29], refs, argument types, cycles. Shapes that fail drop def and at
  // (their concrete fields stay). Returns {freed: n}
  function validate(state, env) {
    let freed = 0;
    const steps = Array.isArray(state.steps) ? state.steps : [];
    const uids = new Set(steps.map((st) => st && st.uid));
    const f1 = steps[0] && steps[0].type === 'zp' ? steps[0] : null;
    const idx = index(state);
    const free = (s) => {
      delete s.def; delete s.at; delete s.helper; delete s.owner;
      if (s.cHid) { delete s.cHid; if (!s.undefHid) s.visible = true; }
      delete s.cundef; delete s._g; delete s._atInf; delete s._seg;
      freed++;
    };
    const okPointRef = (r, plane) => {
      if (!isPointRef(r)) return false;
      if (r.inf) return true;
      if (typeof r.zp === 'string') {
        if (!['zeros', 'poles'].includes(r.kind) || typeof r.id !== 'string') {
          // fallback by index
          if (!['zeros', 'poles'].includes(r.kind) || !Number.isInteger(r.i)) return false;
        }
        if (!uids.has(r.zp)) {
          // [C29] a uid found nowhere: rebind to f1 when f1 is a zeros-and-poles step
          if (!f1) return true;          // stays (undefined: "the step was removed")
          r.zp = f1.uid;
        }
        const st = steps.find((x) => x && x.uid === r.zp);
        if (st && st.zpIds && Array.isArray(st.zpIds[r.kind]) && !st.zpIds[r.kind].includes(r.id)) {
          if (Number.isInteger(r.i) && r.i >= 0 && r.i < st.zpIds[r.kind].length && !st._idsKept) r.id = st.zpIds[r.kind][r.i];
        }
        return true;
      }
      if (typeof r.img === 'string') { const e = idx.get(r.img); return plane === 1 && !!e && e.plane === 0; }
      const e = idx.get(r.s);
      if (!e || e.plane !== plane) return false;
      if (r.h) return handleKeys(e.s).includes(r.h);
      return e.s.kind === 'point';
    };
    const okCurveRef = (r, plane) => {
      if (!isCurveRef(r)) return false;
      const e = idx.get(r.s);
      if (!e || e.plane !== plane) return false;
      return true;              // the piece count may follow the shape's kind (checked at recompute: undefined)
    };
    lists(state).forEach((L, plane) => {
      for (const s of L) {
        if (!s || !isNode(s)) continue;
        let ok = true;
        if (s.at != null) {
          if (typeof s.at !== 'object' || Array.isArray(s.at)) ok = false;
          else {
            const hk = handleKeys(s);
            for (const [k, r] of Object.entries(s.at)) if (!hk.includes(k) || !okPointRef(r, plane)) { ok = false; break; }
            if (ok && !Object.keys(s.at).length) delete s.at;
          }
        }
        if (ok && s.def != null) {
          const d = s.def, O = d && OPS[d.op];
          if (!O || !Array.isArray(d.args) || d.args.length !== O.n) ok = false;
          else if (O.pts && !d.args.every((r) => okPointRef(r, plane))) ok = false;
          else if (O.curves && !d.args.every((r) => okCurveRef(r, plane))) ok = false;
          else if (O.sig && !d.args.every((r, i) => (O.sig[i] === 'c' ? okCurveRef(r, plane) : okPointRef(r, plane)))) ok = false;
          else if (d.op === 'meet' && !(d.index === 0 || d.index === 1 || d.index === 'finite')) d.index = 0;
          else if (d.op === 'tangent' && !(d.index === 0 || d.index === 1)) d.index = 0;
          if (ok && ['circle3', 'perp', 'touch', 'tangent'].includes(d.op) && d.fill !== 'in') d.fill = 'none';
          if (ok && ['circle3', 'perp', 'touch', 'tangent'].includes(d.op) && d.flip != null) d.flip = !!d.flip;
          // [v16.4 segments] Inside C only: a perpendicular circle drawn as a curve, seg 1 or -1 (Region wins)
          if (ok && 'seg' in d && !(d.op === 'perp' && (d.seg === 1 || d.seg === -1) && d.fill !== 'in')) delete d.seg;
          // [issue #70] Between z0 and z1: between 1 on a perpendicular circle drawn as a curve; it wins over seg
          if (ok && 'between' in d && !(d.op === 'perp' && d.between === 1 && d.fill !== 'in')) delete d.between;
          if (ok && d.between === 1) delete d.seg;
          if (ok && d.op === 'glider' && !Number.isFinite(s.t)) s.t = 0;
          if (ok && d.seed != null && !isXY(d.seed)) delete d.seed;
        }
        if (ok && s.cundef && (typeof s.cundef !== 'object' || typeof s.cundef.code !== 'string')) delete s.cundef;
        if (!ok) free(s);
      }
    });
    // cycles: the shapes on a cycle become free
    const G = graphOf(state);
    for (const id of G.cyclic) { const e = idx.get(id); if (e) free(e.s); }
    // helpers whose owner is gone stay as ordinary points
    for (const L of lists(state)) for (const s of L) if (s && s.helper && !idx.has(s.owner)) { delete s.helper; delete s.owner; }
    return { freed };
  }
  // Constr.deletePlan(state, ids) -> {del, freed: [{id, key}], undef: []}: only definitions cascade [C17]; the at
  // bindings to a deleted shape are freed; helpers go with their owner when nothing else uses them [C16]
  function deletePlan(state, ids) {
    const G = graphOf(state);
    const del = new Set(ids);
    let grew = true;
    while (grew) {
      grew = false;
      for (const n of G.nodes.values()) {
        if (del.has(n.id) || !n.s.def) continue;
        if (n.s.def.args.some((r) => del.has(refDep(r)))) { del.add(n.id); grew = true; }
      }
      // helpers owned by deleted shapes that nothing kept uses
      for (const L of lists(state)) for (const s of L) {
        if (!s || !s.helper || del.has(s.id) || !del.has(s.owner)) continue;
        const usedBy = [...(G.users.get(s.id) || [])].filter((u) => !del.has(u));
        if (!usedBy.length) { del.add(s.id); grew = true; }
      }
    }
    const freed = [];
    for (const n of G.nodes.values()) {
      if (del.has(n.id) || !n.s.at) continue;
      for (const [k, r] of Object.entries(n.s.at)) if (del.has(refDep(r))) freed.push({ id: n.id, key: k });
    }
    return { del: [...del], freed, undef: [] };
  }
  // Constr.zeroRemovePlan(state, zref {zp, kind, id}) -> {undef: [ids], freed: [{id, key}]} [C12]
  function zeroRemovePlan(state, zref) {
    const G = graphOf(state);
    const hit = (r) => r && r.zp === zref.zp && r.kind === zref.kind && r.id === zref.id;
    const freed = [], direct = new Set();
    for (const n of G.nodes.values()) {
      if (n.s.at) for (const [k, r] of Object.entries(n.s.at)) if (hit(r)) freed.push({ id: n.id, key: k });
      if (n.s.def && n.s.def.args.some(hit)) direct.add(n.id);
    }
    const undef = [...closure(G, direct)].filter((id) => G.nodes.get(id) && G.nodes.get(id).s.def);
    return { undef, freed };
  }
  // apply a plan's freed bindings (the handle stays where it is and becomes free)
  function applyFreed(state, freed) {
    const idx = index(state);
    for (const { id, key } of freed) {
      const e = idx.get(id);
      if (!e || !e.s.at) continue;
      delete e.s.at[key];
      if (!Object.keys(e.s.at).length) delete e.s.at;
    }
  }
  // Constr.moveRoots(state, id) -> [free point ids] | null: translating those moves the shape and everything built on
  // them exactly (constructions commute with translation) [C18]
  function moveRoots(state, id) {
    const G = graphOf(state), idx = G.idx;
    const n0 = G.nodes.get(id);
    if (!n0) return null;
    const out = new Set(), seen = new Set(), st = [id];
    while (st.length) {
      const x = st.pop();
      if (seen.has(x)) continue; seen.add(x);
      const n = G.nodes.get(x);
      if (n) {
        for (const { ref } of refsOf(n.s)) {
          if (!ref || ref.inf) continue;
          if (typeof ref.zp === 'string' || typeof ref.img === 'string') return null;
          if (ref.h || ref.part != null) {
            const e = idx.get(ref.s);
            if (!e) return null;
            // a curve or handle of a constructed / bound shape: follow it; of a free shape: not a point root
            if (G.nodes.has(ref.s)) { st.push(ref.s); continue; }
            return null;
          }
          st.push(ref.s);
        }
        continue;
      }
      const e = idx.get(x);
      if (!e || e.s.kind !== 'point') return null;
      out.add(x);
    }
    const pos = [...idx.keys()];
    return [...out].sort((a, b) => pos.indexOf(a) - pos.indexOf(b));
  }
  // Constr.wouldCycle(state, id, refs): would shape id depending on these refs close a cycle (a ref to id itself or to
  // anything built on it)? [review math-6]
  function wouldCycle(state, id, refs) {
    const G = graphOf(state);
    const bad = closure(G, [id]);
    return (refs || []).some((r) => { const d = refDep(r); return d != null && bad.has(d); });
  }
  // Constr.dragRoots(state, id) -> [refs]: what the user can drag to change shape id, following definitions and bound
  // handles down to free points, free handles, zeros and free curves [review user-13]
  function dragRoots(state, id) {
    const idx = index(state), out = [], seen = new Set(), keys = new Set();
    const add = (r) => { const k = refKey(r); if (!keys.has(k)) { keys.add(k); out.push(r); } };
    const walk = (s, depth) => {
      if (!s || seen.has(s.id) || depth > 32) return;
      seen.add(s.id);
      for (const { ref } of refsOf(s)) visit(ref, depth + 1);
    };
    const visit = (r, depth) => {
      if (!r || r.inf) return;
      if (typeof r.zp === 'string') { add(r); return; }
      if (typeof r.img === 'string') { const e = idx.get(r.img); if (e) visit({ s: r.img }, depth); return; }
      const e = idx.get(r.s);
      if (!e) return;
      const t = e.s;
      if (r.part != null) { if (isNode(t)) walk(t, depth); else add({ s: t.id, part: r.part }); return; }
      if (r.h) { if (t.at && t.at[r.h]) visit(t.at[r.h], depth + 1); else add(r); return; }
      if (t.def) { walk(t, depth); return; }
      if (t.at && t.at.p) { visit(t.at.p, depth + 1); return; }
      add({ s: t.id });
    };
    const e = idx.get(id);
    if (e) walk(e.s, 0);
    return out;
  }
  // Constr.describe(state, id) -> {op, args, fill, flip, index, family, t, at, inf, undef, note} (no text)
  // Constr.setFlip(state, id, flip): Use complement on a 3-point, perpendicular or touching circle. Flipping K's form
  // reverses the entering rule of every meet on it (index 0 and 1 trade places), so the meet points on K swap their index
  // in the same step and stay where they are [v16.3 review math-5]. Returns the ids of the meets swapped
  function setFlip(state, id, flip) {
    const e = index(state).get(id), d = e && e.s.def;
    if (!d) return [];
    const was = !!d.flip, now = !!flip;
    d.flip = now;
    if (was === now || !FLIPPED.includes(d.op)) return [];
    const out = [];
    for (const L of lists(state)) for (const s of L) {
      const m = s && s.def;
      if (!m || m.op !== 'meet' || m.seed || !(m.index === 0 || m.index === 1) || !Array.isArray(m.args) || !m.args.some((r) => r && r.s === id)) continue;
      m.index = 1 - m.index; out.push(s.id);
    }
    return out;
  }
  function describe(state, id) {
    const e = index(state).get(id);
    if (!e) return null;
    const s = e.s, d = s.def || null;
    let family = s.kind;
    if (s.kind === 'disc' && s.complement) family = 'complement';
    return {
      op: d ? d.op : (s.at ? 'bound' : null), args: d ? d.args.slice() : [], at: s.at ? Object.assign({}, s.at) : null,
      fill: d && ['circle3', 'perp', 'touch'].includes(d.op) ? (d.fill === 'in' ? 'in' : 'none') : null, flip: d ? !!d.flip : null,
      seg: d && d.op === 'perp' ? (d.seg === 1 || d.seg === -1 ? d.seg : 0) : null,
      between: d && d.op === 'perp' ? (d.between === 1 ? 1 : 0) : null,
      index: d && (d.op === 'meet' || d.op === 'tangent') ? d.index : null, family, t: d && d.op === 'glider' ? s.t : null,
      inf: !!s._atInf, undef: s.cundef || null, note: s._note || null,
    };
  }
  // the M(R) samples of a huge circle or a gcircle near a window (SPEC 2.2 [C7]): Float64Array [x0, y0, ...],
  // dense (step) within the window's reach, geometric (ratio) beyond, closing through the antipode
  function sampleMR(G, win, step, far) {
    const cx = (win.x0 + win.x1) / 2, cy = (win.y0 + win.y1) / 2;
    const H = reanchor(G, [cx, cy]);
    const H0 = Object.assign({}, H, { C: 0 });
    const all = mrTaus(H, win, step, far);
    const out = [];
    for (const x of all) { const z = mR(H0, x); out.push(z[0], z[1]); }
    if (H.A !== 0) { const z = mR(H0, Infinity); out.push(z[0], z[1]); const z0 = mR(H0, all[0]); out.push(z0[0], z0[1]); }
    return new Float64Array(out);
  }
  // sampleMR's parameters (ascending) for the form H re-anchored at the window's centre (segSample's too)
  function mrTaus(H, win, step, far) {
    const cx = (win.x0 + win.x1) / 2, cy = (win.y0 + win.y1) / 2, diag = Math.hypot(win.x1 - win.x0, win.y1 - win.y0);
    const d0 = Math.hypot(H.o[0] - cx, H.o[1] - cy);
    const inner = 0.625 * diag + d0;                       // |tau| within which the curve can meet the 1.25x window
    const ts = [0];
    for (let i = 1, n = Math.ceil(inner / step); i <= n; i++) ts.push(inner * i / n);
    let t = inner, h = step;
    const lim = H.A === 0 ? (far || 220) * diag / 2 : 1e28;
    while (t < lim && ts.length < 6000) { h *= 1.035; if (H.A !== 0 && Math.abs(H.A * t) > 8) h = t * 0.25; t += h; ts.push(Math.min(t, lim)); }
    return ts.slice(1).reverse().map((x) => -x).concat(ts);
  }

  return {
    // PoC (the 66 + 18 tests: test/t_constr.js)
    graph: (st) => (st && (Array.isArray(st.shapes) || Array.isArray(st.targets)) ? graph2(st) : graph()), fromJSON, parse, analyze, latin, namesOf, project: (a, z) => (a && a.kind ? projectPiece(a, z) : project(a, z)), apollonius, steiner, crossing, evalAst, FormulaError, INF, isInf,
    orient, circle3, line2, circleCP, circleCR, bisector, onCurve, paramNear, fOf, geomOf, isLine, shapeOf, equationCurve,
    CURVE_KINDS, POINT_KINDS, get exactCalls() { return Poc.exactCalls; },
    mob3t, mob3inv, meets2: meets, meets0,
    // v16 CORE (SPEC 20.2)
    formOf, formOfFields, level, reanchor, mob3: mob3obj, mR, sampleMR,
    pieces, meets: (a, b) => (a && a.G ? meetsPieces(a, b) : meets(a, b)), meetNear, project2: projectPiece, projectPiece, glide, onPiece, tRange,
    resolve, graphOf: graph2, recompute, validate, deletePlan, zeroRemovePlan, applyFreed, moveRoots, describe,
    syncSteps, zpRemoveId, zpNum, zpRenumber, refKey, isPointRef, isCurveRef, OPS, POINT_OPS,
    // v16.5 rail (notes/ux-build/rail/SPEC.md)
    gridStep, GRID_TIERS, DETENT_DEG, angleDetent, latticeDetentR, RAIL, railPull, turnCS, antipodeLine,
    // v16 review fixes
    orientD, projectForm, pieceDist, pieceBox, pts3, perpForm, touchForm, tangentForm, tangentNear, onCurveByRefs, touchAt, setFlip, wouldCycle, dragRoots, idReplacer, referencedSteps,
    // Inside C only (notes/orthogonal-circle/segments/SPEC.md)
    segOf, betweenOf, segAt, segSideOf, segSides, setSeg, setBetween, segCurves, mirrorIn, gcOf, onCarrier,
    get lastRecompute() { return lastRecompute; },
  };
});
import { Region } from './region.js';
import { ConstrPoc } from './constrpoc.js';
import { ConstrOrtho } from './constrortho.js';
export { Constr, Constr as 'module.exports' };
