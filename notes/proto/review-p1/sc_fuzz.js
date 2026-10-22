'use strict';
// Soundness + completeness fuzz of Inverse.prepare/enumerate (default walk: ranges, budgets, windows, early stop),
// against the app's own forward functions (Funcs.build(..).f).
//   node notes/proto/review-p1/sc_fuzz.js [seed] [shapesPerChain] [samplesPerShape] [filter]
const L = require('./lib.js');
const { Inverse, C, ru, pick, rnd, chain, boxOf, fmt } = L;
const seed0 = +(process.argv[2] || 1), NSH = +(process.argv[3] || 12), NS = +(process.argv[4] || 25), FILTER = process.argv[5] || '';
L.setSeed(seed0);
const rcx = (s) => L.cs(C(ru(-s, s), ru(-s, s)));
const cutR = () => pick([180, 90, -90, 0, 45, -135, Math.round(ru(-180, 180)), 300, -400]);
const kR = () => Math.floor(ru(-2, 3));
// step generators (varied parameters)
const GEN = {
  mul: () => ({ type: 'mul', params: { c: pick([rcx(3), '1e-6', '0.001+0.002i', '-1']) } }),
  add: () => ({ type: 'add', params: { c: rcx(50) } }),
  affine: () => ({ type: 'affine', params: { a: rcx(3), b: rcx(20) } }),
  recip: () => ({ type: 'recip' }),
  mobius: () => ({ type: 'mobius', params: pick([{ a: rcx(2), b: rcx(2), c: rcx(2), d: rcx(2) }, { a: '1', b: '-i', c: '1', d: 'i' }, { a: '1', b: '1', c: '1', d: '1.0001' }, { a: '1', b: '2', c: '1', d: '2.001' }]) }),
  blaschke: () => ({ type: 'blaschke', params: { a: pick([rcx(0.9), '0.5', '1.5i', '0.999']), phi: Math.round(ru(-180, 180)) } }),
  pown: () => ({ type: 'pown', params: { n: pick([-16, -7, -3, -2, -1, 1, 2, 3, 5, 8, 16]) } }),
  root: () => ({ type: 'root', params: { n: pick([2, 3, 4, 7]), cut: cutR(), k: kR() } }),
  powa: () => ({ type: 'powa', params: { alpha: pick(['1.5', '-0.7', '2.5', '3', '0.5', '15.5', '20', '61', '-18', 'i', '-i', '0.3+i', '0.05+i', '0.01+i', '20+2i', '2+0.5i', '-1+2i', '0.001+i', '0.2', '1/3', '0.5i', '3i', '0.7-0.2i']), cut: cutR(), k: kR() } }),
  exp: () => ({ type: 'exp' }),
  log: () => ({ type: 'log', params: { cut: cutR(), k: kR() } }),
  sin: () => ({ type: 'sin' }), cos: () => ({ type: 'cos' }), tan: () => ({ type: 'tan' }),
  sinh: () => ({ type: 'sinh' }), cosh: () => ({ type: 'cosh' }), tanh: () => ({ type: 'tanh' }),
  arcsin: () => ({ type: 'arcsin' }), arccos: () => ({ type: 'arccos' }), arctan: () => ({ type: 'arctan' }),
  arsinh: () => ({ type: 'arsinh' }), arcosh: () => ({ type: 'arcosh' }), artanh: () => ({ type: 'artanh' }),
  joukowski: () => ({ type: 'joukowski' }), ijouk: () => ({ type: 'ijouk', params: { branch: pick(['exterior', 'interior']) } }),
  conj: () => ({ type: 'conj' }),
  poly: () => ({ type: 'poly', params: { co: pick([`${rcx(2)}, ${rcx(3)}`, `${rcx(2)}, ${rcx(3)}, ${rcx(3)}`, '1, 0, 4', `${rcx(1)}, 0, 0, 0, ${rcx(3)}`, '1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1']) } }),
  rational: () => ({ type: 'rational', params: pick([{ p: `${rcx(2)}, ${rcx(2)}`, q: `${rcx(2)}, ${rcx(2)}` }, { p: `1, ${rcx(2)}, ${rcx(2)}`, q: `${rcx(2)}, ${rcx(2)}, ${rcx(2)}` }, { p: '1, 0, 1', q: '1, 0' }, { p: '2, 1', q: '3' }]) }),
  custom: () => ({ type: 'custom', params: { expr: pick(['e^{1/z}', 'z^{i}', '\\sqrt{z}+1', '2^{z}', '\\log(z-1)', '\\cot z', '\\frac{1}{z^2}', '\\sin(2z+1)', '\\overline{z}^2', '(z+1)^{1.5}',
    '\\sqrt[3]{z}', '\\arcsin(z)/2', '3-\\frac{2}{z+i}', 'i^{z}', '\\sec(z)', '(1+i)z^{0.7}', 'e^{z^2}', '\\log(\\log z)', '\\csc z', '\\coth(z)', 'z^{17.5}', '\\cosh(z/2)',
    'e^{-z}', '\\tan(1/z)', '(2-z)^{-1}', '\\exp(\\sin z)', '\\sqrt{\\sqrt{z}}', 'z^{0.5+0.5i}', '\\tanh(3z)', 'e^{iz}', '\\log(z^2)', '(z-1)^{-1.5}', 'e^{1/(z-1)}', '\\sin(1/z)', '10^{z}',
    '\\operatorname{artanh}(z/3)', '\\sqrt{1/z}', '\\overline{e^{z}}', 'e^{\\overline{z}}', '\\sinh(z)^{2}']), cut: cutR() } }),
};
const TYPES = Object.keys(GEN);
function randChain() {
  const n = pick([1, 1, 1, 2, 2, 3]);
  const out = [];
  for (let i = 0; i < n; i++) out.push(GEN[pick(TYPES)]());
  return out;
}
const stats = { chains: 0, inelMap: {}, shapes: 0, fwd: {}, samples: 0, skipped: 0, covMiss: 0, zMiss: 0, zMissTrunc: 0, unsound: 0, leaves: 0 };
const ex = { covMiss: [], zMiss: [], unsound: [] };
const WMAX = +(process.env.WMAX || 1e4);
const WC = +(process.env.WC || 25);   // window centres within +-WC (beyond ~38 the prepare() hang of hang_repro.js can trigger)
const IMAX = +(process.env.IMAX || 1e6);
const NCH = +(process.env.NCH || 400);
const t0 = Date.now();
for (let ci = 0; ci < NCH; ci++) {
  let list;
  if (ci < TYPES.length * 3) list = [GEN[TYPES[ci % TYPES.length]]()];
  else list = randChain();
  if (FILTER && !JSON.stringify(list).includes(FILTER)) continue;
  let ch;
  try { ch = chain(list); } catch (e) { continue; }
  stats.chains++;
  if (!ch.plan.ok) { stats.inelMap[ch.plan.reason.replace(/step \d+: /, '')] = (stats.inelMap[ch.plan.reason.replace(/step \d+: /, '')] || 0) + 1; continue; }
  const desc = JSON.stringify(list) + ' [' + ch.plan.ops.map((o) => o.kind).join('>') + ']';
  for (let si = 0; si < NSH; si++) {
    const shape = L.randShape();
    // random left view (clipWin): default, or random centre/zoom
    const win = rnd() < 0.4 ? L.WIN0 : boxOf(ru(-WC, WC) * (rnd() < 0.5 ? 1 : 0.02), ru(-WC, WC) * (rnd() < 0.5 ? 1 : 0.02), pick([15, 60, 240, 960, 3.75]));
    let prep;
    if (process.env.TRACE) require('fs').writeFileSync(process.env.TRACE + '/trace_'+seed0+'.json', JSON.stringify({ci, list, shape, win}));
    const tp0 = Date.now();
    try { prep = Inverse.prepare(ch.plan, { win, shape }); } catch (e) { console.log('PREPARE THREW', desc, JSON.stringify(shape), e.stack); continue; }
    stats.shapes++;
    if (Date.now() - tp0 > 200) console.log('SLOW PREPARE', Date.now() - tp0, 'ms', desc, JSON.stringify(shape));
    if (!prep.ok) { stats.fwd[prep.reason] = (stats.fwd[prep.reason] || 0) + 1; continue; }
    for (let t = 0; t < NS; t++) {
      const z = L.sampleIn(shape, 1e-6);
      if (!z) break;
      const w = ch.F(z);
      if (!CX.isFin(w) || CX.abs(w) > WMAX || CX.abs(w) < 1e-9) { stats.skipped++; continue; }
      // well-conditioned float64 path: every intermediate value moderate
      { let u = z, bad = false; for (const bb of ch.built) { u = bb.f(u); const a = CX.abs(u); if (!(a <= IMAX) || (a > 0 && a < 1 / IMAX)) bad = true; } if (bad) { stats.skipped++; continue; } }
      const dw = L.dF(ch.F, z), adw = CX.abs(dw);
      if (!(adw > 1e-12 && adw < 1e12) || !Number.isFinite(adw)) { stats.skipped++; continue; }
      stats.samples++;
      const pix = pick([1e-3, 1 / 60, 0.2]) * (1 + CX.abs(w)) * 0.1;
      let r1, r16;
      try {
        r1 = Inverse.enumerate(ch.plan, prep, w, pix, { K: 1 });
        r16 = Inverse.enumerate(ch.plan, prep, w, pix, { K: 16, B: 16 });
      } catch (e) { console.log('ENUMERATE THREW', desc, e.stack); stats.covMiss++; continue; }
      // soundness: every leaf on the right branch (lvl > 1e-3 px) maps back to w
      for (const lf of r16.leaves) {
        stats.leaves++;
        if (!(lf.lvl > 1e-3) || !CX.isFin(lf.z)) continue;
        const wb = ch.F(lf.z);
        const err = CX.abs(CX.sub(wb, w));
        if (!(err <= 1e-7 * (1 + CX.abs(w)))) {
          const d2 = CX.abs(L.dF(ch.F, lf.z));
          if (!(err <= 1e-7 * (1 + CX.abs(w)) + 1e-9 * d2 * (1 + CX.abs(lf.z)))) {
            stats.unsound++;
            if (ex.unsound.length < 12) ex.unsound.push({ desc, shape, w: fmt(w), z: fmt(lf.z), Fz: fmt(wb), lvl: lf.lvl, path: lf.path });
          }
        }
      }
      // coverage (K = 1): the pixel must be covered
      if (!(r1.U > 0)) {
        stats.covMiss++;
        if (ex.covMiss.length < 20) ex.covMiss.push({ desc, shape, win, z: fmt(z), w: fmt(w), pix, visited: r1.visited, trunc: r1.truncated, N: prep.N, need: prep.need, rspec: prep.rspec.map((x) => x && x.kind) });
      }
      // the sample's own preimage (K = 16: no early stop until 16 covering leaves)
      const tolZ = 1e-6 * (1 + CX.abs(z)) + 1e-9 * (1 + CX.abs(w)) / adw;
      const found = r16.leaves.some((lf) => CX.isFin(lf.z) && CX.abs(CX.sub(lf.z, z)) <= tolZ && lf.cov);
      if (!found) {
        if (r16.truncated || r16.nCov >= 16) stats.zMissTrunc++;
        else {
          stats.zMiss++;
          if (ex.zMiss.length < 20) {
            const near = r16.leaves.filter((lf) => CX.isFin(lf.z)).sort((a, b) => CX.abs(CX.sub(a.z, z)) - CX.abs(CX.sub(b.z, z)))[0];
            ex.zMiss.push({ desc, shape, win, z: fmt(z), w: fmt(w), pix, nearest: near && { z: fmt(near.z), cv: near.cv, lvl: near.lvl, s: near.s }, visited: r16.visited, N: prep.N, need: prep.need, rspec: prep.rspec.map((x) => x && x.kind) });
          }
        }
      }
    }
  }
}
console.log(`seed ${seed0}: ${stats.chains} chains, ${stats.shapes} shapes, ${stats.samples} samples (${stats.skipped} skipped), ${stats.leaves} leaves, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
console.log('map-level forward:', JSON.stringify(stats.inelMap));
console.log('shape-level forward:', JSON.stringify(stats.fwd));
console.log(`UNSOUND leaves: ${stats.unsound}; COVERAGE misses (K=1): ${stats.covMiss}; own-preimage misses (untruncated, K=16): ${stats.zMiss}; (truncated/overflow: ${stats.zMissTrunc})`);
for (const k of ['unsound', 'covMiss', 'zMiss']) for (const e of ex[k]) console.log(k.toUpperCase(), JSON.stringify(e));
