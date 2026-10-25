// A node model of the proposed CPU side: morphRange / morphState(rel) / cpuMap with map.post, over a chain.
require('./load.js');
const X = globalThis.CX, FN = globalThis.Funcs, C = X.C;
function chain(stepsIn) {
  const steps = stepsIn.map((s) => ({ type: s.type, params: Object.assign(FN.defaults(s.type), s.params || {}), on: s.on !== false }));
  const built = steps.map((st) => FN.build(st));
  const n = steps.length;
  const stageFns = FN.stageFunctions(steps, built);
  const isDeriv = (k) => { const st = steps[k - 1], b = built[k - 1]; return !!st && st.on !== false && b && !b.error && (st.type === 'deriv' || b.op === 'deriv'); };
  const stepFn = (k) => { const st = steps[k - 1], b = built[k - 1]; if (!st || st.on === false || !b || b.error || isDeriv(k) || typeof b.f !== 'function') return null; return b.f; };
  const stepActive = (k) => !!stepFn(k) || isDeriv(k);
  const stageF = (k) => stageFns[Math.max(0, Math.min(n, k))];
  const derivIn = (a, b) => { for (let k = a + 1; k <= b; k++) if (isDeriv(k)) return true; return false; };
  const rangeF = (a, b) => { if (!a) return stageF(b); if (derivIn(a, b)) return () => C(NaN, NaN); const fs = []; for (let i = a + 1; i <= b; i++) { const f = stepFn(i); if (f) fs.push(f); } return (z) => { for (const f of fs) z = f(z); return z; }; };
  const ENDS = !process.env.NOENDS; const homF = (k, t) => { const b = built[k - 1]; if (ENDS && t <= 0) return (z) => z; if (ENDS && t >= 1 && stepFn(k)) return stepFn(k); if (b && b.hom) return b.hom(t); const f = stepFn(k) || ((z) => z); return (z) => { const w = f(z); return C((1 - t) * z.re + t * w.re, (1 - t) * z.im + t * w.im); }; };
  const lerpF = (F0, F1, t) => (z) => { const a = F0(z), b = F1(z); return C((1 - t) * a.re + t * b.re, (1 - t) * a.im + t * b.im); };
  const lastDeriv = () => { let d = 0; for (let k = 1; k <= n; k++) if (isDeriv(k)) d = k; return d; };
  // the proposed rule: 0 <= a < b <= n, an active step inside, no d/dz after b (b moves up to the last d/dz)
  function validRange(r) {
    if (!r) return null;
    let a = Math.max(0, Math.min(n - 1, r.a | 0)), b = Math.max(a + 1, Math.min(n, r.b | 0));
    b = Math.max(b, lastDeriv());
    for (let k = a + 1; k <= b; k++) if (stepActive(k)) return { a, b };
    return null;
  }
  function morphRange(S) {
    if (S.focus > 0) return { a: S.focus - 1, b: S.focus, p1: S.focus, steps: stepActive(S.focus) ? [S.focus] : [] };
    const r = validRange(S.range);
    const a = r ? r.a : 0, b = r ? r.b : n;
    const steps = []; for (let k = a + 1; k <= b; k++) if (stepActive(k)) steps.push(k);
    return { a, b, p1: n, steps };
  }
  const leftStage = (S) => (S.focus === 0 || isDeriv(S.focus) ? 0 : S.focus - 1);
  function morphState(S, T, rel) {
    const { a, b, p1, steps } = morphRange(S);
    const m = steps.length, pb = rel ? leftStage(S) : 0;
    let livePost = false; for (let k = b + 1; k <= p1; k++) if (stepFn(k)) livePost = true;
    const P = livePost ? rangeF(b, p1) : null;
    const wrap = (F) => (P ? (z) => P(F(z)) : F);
    const tag = (map) => { if (pb) map.base = pb; if (P) { map.post = p1; map.b = b; } return map; };
    const all = !!S.homAll && m > 1 && !steps.some(isDeriv);
    if (all) {
      const t = Math.max(0, Math.min(1, T)), F0 = rangeF(pb, a), Hs = steps.map((k) => homF(k, t));
      return { map: tag({ mode: 3, a, b, t }), F: wrap((z) => { let w = F0(z); for (const H of Hs) w = H(w); return w; }), m: 1 };
    }
    const TT = Math.max(0, Math.min(m, T)), j = Math.min(m - 1, Math.floor(TT)), t = TT - j, k = steps[j];
    const Fprev = rangeF(pb, k - 1);
    const inner = isDeriv(k) ? lerpF(Fprev, rangeF(pb, k), t) : ((Ht) => (z) => Ht(Fprev(z)))(homF(k, t));
    return { map: tag({ mode: 1, hi: k, t }), F: wrap(inner), m };
  }
  // the CPU twin of a map spec, with post
  function cpuMap(map) {
    const mode = map.mode || 0, pb = map.base || 0;
    let inner, top;
    if (mode === 1) { const k = map.hi, Fp = rangeF(pb, k - 1), t = map.t || 0; top = map.b || k; inner = isDeriv(k) ? lerpF(Fp, rangeF(pb, k), t) : !stepFn(k) ? Fp : ((Ht) => (z) => Ht(Fp(z)))(homF(k, t)); }
    else if (mode === 3) { const F0 = rangeF(pb, map.a || 0), t = map.t || 0, Hs = []; top = map.b; for (let k = (map.a || 0) + 1; k <= map.b; k++) if (stepActive(k)) Hs.push(isDeriv(k) ? () => C(NaN, NaN) : homF(k, t)); inner = (z) => { let w = F0(z); for (const H of Hs) w = H(w); return w; }; }
    else return rangeF(map.a || 0, map.b || 0);
    const post = (map.post || 0) > top ? rangeF(top, map.post) : null;
    return post ? (z) => post(inner(z)) : inner;
  }
  return { steps, built, n, stageF, rangeF, morphRange, morphState, cpuMap, homF, validRange, isDeriv, stepFn };
}
module.exports = { chain, X, C, FN };
