// @ts-check
'use strict';
// homrange.js: the deformation's arithmetic (notes/deform-range/SPEC.md 3.1), pure (no DOM), so the node tests run the
// shipped code. The chain is f_1 … f_n with f_1 acting first; a bracket a…b (S.homRange) deforms the steps a…b while
// the pre P = f_{a−1} ∘ … ∘ f_1 acts first and the post Q = f_n ∘ … ∘ f_{b+1} last, both in full:
// H_t = Q ∘ G_t ∘ P, from H_0 = Q ∘ P to H_end = F, both exact (every homotopy is the identity at t <= 0 and f at t >= 1).
// HomRange.make(env): env = { n, stepFn(k), isDeriv(k), stepActive(k), stageF(k), rangeF(a, b), built, C, uidOf?(k) }
// (n and built may be values or functions: the app passes getters, so one instance follows the live chain)
// -> { resolve(S), range(S), state(S, T, rel, base), cpuMap(map), homF(k, t), H0(S, rel), lastDeriv(), allowed(S) }
(function (root, factory) {
  const M = factory();
  if (typeof module === 'object' && module.exports) module.exports = M;
  else /** @type {any} */ (root).HomRange = M;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function make(env) {
    const C = env.C;
    const N = () => (typeof env.n === 'function' ? env.n() : env.n);
    const B = () => (typeof env.built === 'function' ? env.built() : env.built) || [];
    const uidOf = (S, k) => (env.uidOf ? env.uidOf(k) : S && S.steps && S.steps[k - 1] ? S.steps[k - 1].uid : undefined);
    const lerpF = (F0, F1, t) => (z) => { const a = F0(z), b = F1(z); return C((1 - t) * a.re + t * b.re, (1 - t) * a.im + t * b.im); };
    // a d/dz segment's straight line with exact ends (D3, review v16 math-2): G_{k−1} itself at t <= 0 and G_k at t >= 1,
    // so an infinite end does not make the other one NaN and a signed zero keeps its side of a cut (gl.js MAP_STAGE too)
    const lerpE = (F0, F1, t) => (t <= 0 ? F0 : t >= 1 ? F1 : lerpF(F0, F1, t));
    // the natural homotopy of step k at t, a map of its input plane; exact ends (D3): the identity at t <= 0, f at t >= 1
    function homF(k, t) {
      const f = env.stepFn(k);
      if (t <= 0) return (z) => z;
      if (t >= 1 && f) return f;
      const b = B()[k - 1];
      if (b && b.hom) return b.hom(t);
      const g = f || ((z) => z);
      return (z) => { const w = g(z); return C((1 - t) * z.re + t * w.re, (1 - t) * z.im + t * w.im); };
    }
    // the last active d/dz step (0 without one): nothing after the bracket may differentiate (the d/dz rule, D8)
    function lastDeriv() { let d = 0; const n = N(); for (let k = 1; k <= n; k++) if (env.isDeriv(k)) d = k; return d; }
    // the normal form of a candidate bracket {a, b} (1-based, inclusive) on the current chain: null when it holds no
    // active step or every active step (that is "every step"); b moves up to the last active d/dz
    function normal(a, b) {
      const n = N();
      if (!(n > 0)) return null;
      a = Math.max(1, Math.min(n, a | 0)); b = Math.max(1, Math.min(n, b | 0));
      if (a > b) { const x = a; a = b; b = x; }
      b = Math.max(b, lastDeriv());
      let inside = 0, outside = 0;
      for (let k = 1; k <= n; k++) if (env.stepActive(k)) { if (k >= a && k <= b) inside++; else outside++; }
      if (!inside || !outside) return null;
      return { a, b };
    }
    // S.homRange -> {a, b} or null (SPEC 2.2), written back in its normal form: a and b, ua and ub (null at the
    // chain's ends). Absent at focus > 0 is not touched (kept, ignored). A setting with no active step inside, or with
    // every active step inside, is dropped.
    // (anyFocus: resolved and written back at focus k too: a save, an undo entry)
    function resolve(S, anyFocus) {
      const hr = S && S.homRange;
      if (!hr || typeof hr !== 'object') return null;
      if (S.focus > 0 && !anyFocus) return null;
      const n = N();
      if (!(n > 0)) return null;
      const find = (u, idx, end) => {
        if (u === null) return end;
        if (typeof u === 'string') { for (let k = 1; k <= n; k++) if (uidOf(S, k) === u) return k; }
        return Math.max(1, Math.min(n, idx | 0));
      };
      // (read many times a frame: the last answer is kept while the setting, the steps and the chain's signature
      // env.sig() are the same)
      const sig = env.sig ? env.sig() : null;
      if (sig != null && memo && memo.hr === hr && memo.steps === S.steps && memo.sig === sig && memo.n === n && memo.a === hr.a && memo.b === hr.b && memo.ua === hr.ua && memo.ub === hr.ub) return memo.r && { a: memo.r.a, b: memo.r.b };
      const a0 = find(hr.ua, hr.a, 1), b0 = find(hr.ub, hr.b, n);
      const r = normal(a0, b0);
      if (!r) { delete S.homRange; memo = null; return null; }
      write(S, r);
      const h2 = S.homRange;
      memo = { hr: h2, steps: S.steps, sig, n, a: h2.a, b: h2.b, ua: h2.ua, ub: h2.ub, r };
      return { a: r.a, b: r.b };
    }
    let memo = null;
    function write(S, r) {
      const n = N(), ua = r.a === 1 ? null : uidOf(S, r.a), ub = r.b === n ? null : uidOf(S, r.b), h = S.homRange;
      // (the same setting keeps its object: no garbage on every read)
      if (h && typeof h === 'object' && h.a === r.a && h.b === r.b && h.ua === ua && h.ub === ub && Object.keys(h).length === 2 + Number(ua !== undefined) + Number(ub !== undefined)) return;
      const o = { a: r.a, b: r.b };
      if (ua !== undefined) o.ua = ua;
      if (ub !== undefined) o.ub = ub;
      S.homRange = o;
    }
    // what the transport deforms: lo (the stage the bracket starts from), b (its last step), p1 (the stage the post
    // ends at) and the active bracketed steps
    function range(S) {
      const n = N();
      if (S.focus > 0) { const k = S.focus; return { lo: k - 1, b: k, p1: k, steps: env.stepActive(k) ? [k] : [], r: null }; }
      const r = resolve(S);
      const lo = r ? r.a - 1 : 0, b = r ? r.b : n, steps = [];
      for (let k = lo + 1; k <= b; k++) if (env.stepActive(k)) steps.push(k);
      return { lo, b, p1: n, steps, r };
    }
    const leftStage = (S) => (S.focus === 0 || env.isDeriv(S.focus) ? 0 : S.focus - 1);
    const allAtOnce = (S, R) => !!S.homAll && R.steps.length > 1 && !R.steps.some((k) => env.isDeriv(k));
    // design-math 3's morphState: the GPU map spec, the CPU function, a key and the label's parts at time T; rel: the
    // source points live in the left plane (map.base = its stage); base: an explicit source stage (the merged probe)
    function state(S, T, rel, base) {
      const R = range(S), { lo, b, p1, steps } = R, m = steps.length;
      const pb = base != null ? base : rel ? leftStage(S) : 0;
      let live = false;
      for (let k = b + 1; k <= p1; k++) if (env.stepFn(k)) live = true;
      const Q = live ? env.rangeF(b, p1) : null;
      const wrap = (F) => (Q ? (z) => Q(F(z)) : F);
      const tag = (map) => { if (pb) map.base = pb; if (Q) { map.post = p1; map.b = b; } return map; };
      const sfx = `|${lo}|${b}|${p1}`;
      const H0F = wrap(env.rangeF(pb, lo));
      if (m === 0) {
        // (no active step inside: G_t is the identity, so H_t = Q ∘ P is the plain stage map pb → p1 when the post is
        // live; a mode-0 map takes no post, so it is never tagged with one: review v16 math-6)
        const top = Q ? p1 : lo, F = env.rangeF(pb, top);
        const map = { mode: 0, a: pb, b: top };
        if (pb) map.base = pb;
        return { map, F, key: `none|${pb}|${top}` + sfx, label: { kind: 'none' }, H0F: F, H0Map: Object.assign({}, map), m, R };
      }
      const H0Map = tag({ mode: 1, hi: steps[0], t: 0 });
      if (allAtOnce(S, R)) {
        const t = Math.max(0, Math.min(1, T));
        const F0 = env.rangeF(pb, lo), Hs = steps.map((k) => homF(k, t));
        const F = wrap((z) => { let w = F0(z); for (const H of Hs) w = H(w); return w; });
        return { map: tag({ mode: 3, a: lo, b, t }), F, key: `all|${pb}|${lo}|${b}|${t}` + sfx, label: { kind: 'all', t, part: !!R.r, steps }, H0F, H0Map, m, R };
      }
      const TT = Math.max(0, Math.min(m, T)), j = Math.min(m - 1, Math.floor(TT)), t = TT - j, k = steps[j];
      const Fprev = env.rangeF(pb, k - 1);
      let inner;
      if (env.isDeriv(k)) inner = lerpE(Fprev, env.rangeF(pb, k), t);
      else { const Ht = homF(k, t); inner = (z) => Ht(Fprev(z)); }
      return { map: tag({ mode: 1, hi: k, t }), F: wrap(inner), key: `nat|${pb}|${k}|${t}` + sfx, label: { kind: 'nat', k, t }, H0F, H0Map, m, R };
    }
    // the CPU twin of a GPU map spec (SPEC 4.1): {mode 1, hi, t, base?, b?, post?} = G_{b→post} ∘ h_{hi,t} ∘ G_{base→hi−1};
    // {mode 3, a, b, t, base?, post?} = G_{b→post} ∘ h_{b,t} ∘ … ∘ h_{a+1,t} ∘ G_{base→a}; modes 0 and 2 as before
    function cpuMap(map) {
      const mode = map.mode || 0, pb = map.base || 0;
      let inner, top;
      if (mode === 1) {
        const k = map.hi || 0, Fp = env.rangeF(pb, k - 1), t = map.t || 0;
        top = map.b || k;
        if (env.isDeriv(k)) inner = lerpE(Fp, env.rangeF(pb, k), t);
        else if (!env.stepFn(k)) inner = Fp;
        else { const Ht = homF(k, t); inner = (z) => Ht(Fp(z)); }
      } else if (mode === 2) return lerpF(env.rangeF(pb, map.a || 0), env.rangeF(pb, map.b || 0), map.t || 0);
      else if (mode === 3) {
        const F0 = env.rangeF(pb, map.a || 0), t = map.t || 0, Hs = [];
        top = map.b || 0;
        for (let k = (map.a || 0) + 1; k <= top; k++) if (env.stepActive(k)) Hs.push(env.isDeriv(k) ? () => C(NaN, NaN) : homF(k, t));
        inner = (z) => { let w = F0(z); for (const H of Hs) w = H(w); return w; };
      } else return env.rangeF(map.a || 0, map.b || 0);
      const post = (map.post || 0) > top ? env.rangeF(top, map.post) : null;
      return post ? (z) => post(inner(z)) : inner;
    }
    // H_0 as a function of the source plane and its GPU map spec
    function H0(S, rel) { const s = state(S, 0, rel); return { F: s.H0F, map: s.H0Map }; }
    // the stops of the bracket's ends (the drag, the sliders, the phone's selects): the steps each end may take with the
    // other end held, and the d/dz stop of the right end
    function stops(S) {
      const n = N(), d = lastDeriv(), r = resolve(S) || { a: 1, b: n };
      const okA = [], okB = [];
      for (let a = 1; a <= r.b; a++) if (a <= n) okA.push(a);
      for (let b = Math.max(r.a, d, 1); b <= n; b++) okB.push(b);
      return { a: r.a, b: r.b, okA, okB, deriv: d };
    }
    return { resolve, normal, write, range, state, cpuMap, homF, H0, lastDeriv, stops, leftStage, allAtOnce };
  }
  return { make };
});
