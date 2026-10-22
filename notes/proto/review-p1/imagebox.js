'use strict';
// imageBox conservativeness: the range box of an outer family's coordinate over G(shape) (prepare's rspec 'box')
// against dense sampling of the shape, plus end-to-end coverage of the samples outside the box.
//   node notes/proto/review-p1/imagebox.js [randomCases]
const L = require('./lib.js');
const { Inverse, C, ru, pick, chain, fmt } = L;
const NR = +(process.argv[2] || 300);
const TAU = 2 * Math.PI;
// the family coordinate exactly as SPEC 3.6 defines it: <u, p/|p|> for additive families, ln|u| for ROOTPOW
function coordOf(o) {
  const F = o.fam;
  if (F.type === 'add') { const pa = CX.abs(F.p), e = C(F.p.re / pa, F.p.im / pa); return { f: (u) => u.re * e.re + u.im * e.im, unit: pa }; }
  return { f: (u) => Math.log(CX.abs(u)), unit: Math.abs(F.S.re) };
}
function check(name, list, shape, win, nDense = 100000, verbose = true) {
  const ch = chain(list);
  if (!ch.plan.ok) return null;
  const prep = Inverse.prepare(ch.plan, { win: win || L.WIN0, shape });
  const out = [];
  ch.plan.ops.forEach((o, j) => {
    const sp = prep.rspec[j];
    if (!sp || sp.kind !== 'box' || !Number.isFinite(sp.lo) || !Number.isFinite(sp.hi)) return;
    const { f, unit } = coordOf(o);
    const G = (z) => { let u = z; for (let k = 0; k < j; k++) u = ch.plan.ops[k].fwd(u); return u; };
    const Lv = Region.levelOf(shape), bb = Region.bboxOf(shape);
    let mn = Infinity, mx = -Infinity, zmn = null, zmx = null, n = 0;
    for (let t = 0; n < nDense && t < nDense * 20; t++) {
      const z = C(ru(bb.x0, bb.x1), ru(bb.y0, bb.y1));
      if (!(Lv(z) > 0)) continue;
      n++;
      const v = f(G(z));
      if (!Number.isFinite(v)) continue;
      if (v < mn) { mn = v; zmn = z; }
      if (v > mx) { mx = v; zmx = z; }
    }
    const below = sp.lo - mn, above = mx - sp.hi;
    const narrower = below > 1e-9 * (1 + Math.abs(mn)) || above > 1e-9 * (1 + Math.abs(mx));
    out.push({ j, kind: o.kind, box: [sp.lo, sp.hi], dense: [mn, mx], narrowerBy: Math.max(below, above) / unit, narrower, zmn, zmx, ok: prep.ok, reason: prep.reason });
    if (verbose) console.log(`${name.padEnd(26)} op ${j} ${o.kind}: box [${sp.lo.toFixed(4)}, ${sp.hi.toFixed(4)}]  dense [${mn.toFixed(4)}, ${mx.toFixed(4)}]  ${narrower ? `NARROWER by ${(Math.max(below, above) / unit).toFixed(3)} periods` : 'ok'}  (prepare ok=${prep.ok}${prep.reason ? ' ' + prep.reason : ''}, N=${prep.N.join('x')})`);
  });
  return { ch, prep, out };
}
// end-to-end: sample z in the shape, w = F(z), require the pixel to be covered
function coverage(name, res, shape, NS = 4000) {
  const { ch, prep } = res;
  if (!prep.ok) return;
  let n = 0, miss = 0, ex = null;
  for (let t = 0; t < NS; t++) {
    const z = L.sampleIn(shape, 1e-6);
    const w = ch.F(z);
    if (!CX.isFin(w)) continue;
    n++;
    const r = Inverse.enumerate(ch.plan, prep, w, 1e-3, { K: 16, B: 16 });
    if (!(r.U > 0)) { miss++; if (!ex) ex = { z: fmt(z), w: fmt(w) }; }
  }
  console.log(`   end-to-end ${name}: ${miss} of ${n} sampled image points NOT COVERED${ex ? ' e.g. z = ' + ex.z + ', w = ' + ex.w : ''}`);
}
console.log('--- aliasing of the 8 x 8 x 9 sample grid with a periodic prefix');
const cases = [
  ['exp∘exp rect y∈[0,16π]', [{ type: 'exp' }, { type: 'exp' }], { kind: 'rect', a: [0, 0], b: [2, 16 * Math.PI] }],
  ['exp∘exp rect y∈[-8π,8π]', [{ type: 'exp' }, { type: 'exp' }], { kind: 'rect', a: [0, -8 * Math.PI], b: [2, 8 * Math.PI] }],
  ['exp∘exp rect y∈[0,8π]', [{ type: 'exp' }, { type: 'exp' }], { kind: 'rect', a: [0, 0], b: [2, 8 * Math.PI] }],
  ['sin(e^z) rect y∈[0,16π]', [{ type: 'exp' }, { type: 'sin' }], { kind: 'rect', a: [0, 0], b: [2.5, 16 * Math.PI] }],
  ['e^{sin z} rect x∈[0,16π]', [{ type: 'sin' }, { type: 'exp' }], { kind: 'rect', a: [0, 0.5], b: [16 * Math.PI, 2.2] }],
  ['exp∘exp disc r=8π', [{ type: 'exp' }, { type: 'exp' }], { kind: 'disc', c: [0, 0], r: 8 * Math.PI }],
];
for (const [name, list, shape] of cases) {
  const r = check(name, list, shape);
  if (r && r.out.some((o) => o.narrower)) coverage(name, r, shape);
}
console.log('--- random bounded shapes through non-affine prefixes');
L.setSeed(4242);
const PRE = [[{ type: 'exp' }], [{ type: 'sin' }], [{ type: 'cos' }], [{ type: 'sinh' }], [{ type: 'pown', params: { n: 8 } }], [{ type: 'pown', params: { n: 16 } }], [{ type: 'recip' }], [{ type: 'log' }],
  [{ type: 'tan' }], [{ type: 'powa', params: { alpha: '1.5' } }], [{ type: 'mul', params: { c: '3' } }, { type: 'exp' }], [{ type: 'joukowski' }], [{ type: 'pown', params: { n: 2 } }]];
const FAM = [{ type: 'exp' }, { type: 'sin' }, { type: 'tan' }, { type: 'sinh' }, { type: 'powa', params: { alpha: 'i' } }, { type: 'cosh' }];
let tot = 0, nar = 0, worst = 0;
for (let i = 0; i < NR; i++) {
  const list = pick(PRE).concat([pick(FAM)]);
  const k = pick(['disc', 'rect', 'polygon', 'annulus', 'sector']);
  let shape = L.randShape([k]);
  // scale into a range where the prefix stays moderate
  const sc = Math.exp(ru(Math.log(0.05), Math.log(4)));
  const off = [ru(-4, 4), ru(-4, 4)];
  const mv = (p) => [off[0] + (p[0] - (shape.c || shape.a || shape.pts[0])[0]) * sc / 30, off[1] + (p[1] - (shape.c || shape.a || shape.pts[0])[1]) * sc / 30];
  shape = JSON.parse(JSON.stringify(shape));
  const ref = (shape.c || shape.a || shape.pts[0]).slice();
  const mv2 = (p) => [off[0] + (p[0] - ref[0]) * sc / 30, off[1] + (p[1] - ref[1]) * sc / 30];
  for (const key of ['c', 'a', 'b']) if (shape[key]) shape[key] = mv2(shape[key]);
  if (shape.pts) shape.pts = shape.pts.map(mv2);
  for (const key of ['r', 'r1', 'r2']) if (shape[key]) shape[key] *= sc / 30;
  const r = check('rand', list, shape, L.WIN0, 30000, false);
  if (!r) continue;
  for (const o of r.out) {
    tot++;
    if (o.narrower) {
      nar++; worst = Math.max(worst, o.narrowerBy);
      if (nar <= 8) console.log(`NARROWER ${JSON.stringify(list)} ${JSON.stringify(shape)} op ${o.j} ${o.kind}: box [${o.box.map((x) => x.toFixed(4))}] dense [${o.dense.map((x) => x.toFixed(4))}] by ${o.narrowerBy.toFixed(3)} periods (prepare ok=${o.ok})`);
    }
  }
}
console.log(`random: ${tot} finite boxes checked, ${nar} narrower than dense sampling (worst ${worst.toFixed(3)} periods)`);
