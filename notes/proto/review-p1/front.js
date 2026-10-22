'use strict';
// Front order / early stop: Inverse.enumerate (default walk) vs my own full preimage set (truth.js) with my own D.
//   node notes/proto/review-p1/front.js [scenarioFilter] [views] [grid]
const L = require('./lib.js');
const T = require('./truth.js');
const { Inverse, C, ru, boxOf, fmt } = L;
const FILTER = process.argv[2] || '', NV = +(process.argv[3] || 12), G = +(process.argv[4] || 40);
const H = { kind: 'halfplane', a: [0, 0], b: [1, 0] };
const S = (list, shape, img, views, extra = {}) => Object.assign({ list, shape, img, views }, extra);
const rv = (cx, cy, rad, s0, s1) => () => boxOf(cx + ru(-rad, rad), cy + ru(-rad, rad), Math.exp(ru(Math.log(s0), Math.log(s1))));
const cay = { type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' } };
const SCEN = {
  e1z: S([{ type: 'recip' }, { type: 'exp' }], { kind: 'disc', c: [0, 0], r: 1 }, { cx: 0, cy: 0, s: 60 }, rv(0, 0, 0.8, 60, 3000)),
  expCayley: S([cay, { type: 'exp' }], { kind: 'disc', c: [0, -1], r: 1.5 }, { cx: 0, cy: 0, s: 60 }, rv(0, -1, 0.8, 60, 3000)),
  expH: S([{ type: 'exp' }], H, { cx: 0, cy: 0, s: 60 }, rv(0, 0.5, 0.8, 60, 3000)),
  ziH: S([{ type: 'powa', params: { alpha: 'i' } }], H, { cx: 0, cy: 0, s: 190 }, rv(0, 0.5, 0.8, 60, 3000)),
  tan2z1: S([{ type: 'affine', params: { a: '2', b: '1' } }, { type: 'tan' }], { kind: 'disc', c: [0, 0], r: 3 }, { cx: 0, cy: 0, s: 60 }, rv(0, 0, 0.8, 60, 3000)),
  // every window family kind: plain, after a rotating AFF, after a MOB, with a trailing AFF / MOB
  ...Object.fromEntries(['exp', 'sin', 'cos', 'tan', 'sinh', 'cosh', 'tanh'].flatMap((t) => [
    [`${t}_plain`, S([{ type: t }], H, { cx: 0.3, cy: 0.2, s: 40 }, rv(0, 0.5, 0.8, 60, 3000))],
    [`${t}_rotAff`, S([{ type: 'affine', params: { a: '0.8+0.6i', b: '0.3' } }, { type: t }], H, { cx: 0.3, cy: 0.2, s: 40 }, rv(0, 0.5, 0.8, 60, 3000))],
    [`${t}_mob`, S([{ type: 'mobius', params: { a: '1', b: '0.5', c: '0.3i', d: '1' } }, { type: t }], { kind: 'disc', c: [0.2, 0.1], r: 2 }, { cx: 0.3, cy: 0.2, s: 40 }, rv(0, 0, 0.8, 60, 3000))],
    [`${t}_trail`, S([{ type: t }, { type: 'mobius', params: { a: '1', b: '0', c: '0.2', d: '1' } }], H, { cx: 0.3, cy: 0.2, s: 40 }, rv(0, 0.5, 0.8, 60, 3000))],
  ])),
  powai_rotAff: S([{ type: 'affine', params: { a: '0.8+0.6i', b: '0.3' } }, { type: 'powa', params: { alpha: 'i' } }], H, { cx: 0, cy: 0, s: 190 }, rv(0, 0.5, 0.8, 60, 3000)),
  // adversarial: wide/zoomed-out left views
  sin_rotAff_wide: S([{ type: 'affine', params: { a: '0.6+0.8i', b: '0' } }, { type: 'sin' }], H, { cx: 0.3, cy: 0.2, s: 20 }, rv(0, 0, 10, 4, 30)),
  cos_rotAff_wide: S([{ type: 'affine', params: { a: '0.6+0.8i', b: '0' } }, { type: 'cos' }], H, { cx: 0.3, cy: 0.2, s: 20 }, rv(0, 0, 10, 4, 30)),
  sinh_rotAff_wide: S([{ type: 'affine', params: { a: '0.96+0.28i', b: '0' } }, { type: 'sinh' }], H, { cx: 0.3, cy: 0.2, s: 20 }, rv(0, 0, 10, 4, 30)),
  sin_powa_bump: S([{ type: 'sin' }, { type: 'powa', params: { alpha: '0.5+0.5i' } }], H, { cx: 0.3, cy: 0.2, s: 60 }, rv(0, 0, 3, 5, 20)),
  sin_1pi: S([{ type: 'affine', params: { a: '1+i', b: '0' } }, { type: 'sin' }], H, { cx: 0.3, cy: 0.2, s: 40 }, rv(0, 0.5, 0.8, 60, 3000)),
  sin_1pi_out: S([{ type: 'affine', params: { a: '1+i', b: '0' } }, { type: 'sin' }], H, { cx: 0.3, cy: 0.2, s: 40 }, rv(0, 0, 3, 10, 60)),
  exp_rot_sq: S([{ type: 'affine', params: { a: '1+i', b: '0' } }, { type: 'exp' }, { type: 'pown', params: { n: 2 } }], H, { cx: 0.3, cy: 0.2, s: 40 }, rv(0, 0.5, 0.8, 60, 3000)),
  exp_rot_sq_out: S([{ type: 'affine', params: { a: '1+i', b: '0' } }, { type: 'exp' }, { type: 'pown', params: { n: 2 } }], H, { cx: 0.3, cy: 0.2, s: 40 }, rv(0, 0, 3, 10, 60)),
  sin_powai_bump: S([{ type: 'sin' }, { type: 'powa', params: { alpha: '2+i' } }], H, { cx: 0.3, cy: 0.2, s: 60 }, rv(0, 0, 3, 5, 20)),
};
let totPx = 0, totCmp = 0, totMis = 0, totMisTr = 0;
for (const [name, sc] of Object.entries(SCEN)) {
  if (FILTER && !name.includes(FILTER)) continue;
  const ch = L.chain(sc.list);
  if (!ch.plan.ok) { console.log(name, 'plan ineligible', ch.plan.reason); continue; }
  L.setSeed(12345);
  const Lv = Region.levelOf(sc.shape);
  let cmp = 0, mis = 0, misTr = 0, amb = 0, maxGap = 0, ex = [], spill = 0, hole = 0, fwd = 0, visitedSum = 0;
  for (let vi = 0; vi < NV; vi++) {
    const win = sc.views();
    const prep = Inverse.prepare(ch.plan, { win, shape: sc.shape });
    if (!prep.ok) { fwd++; continue; }
    const P = prep.sing;
    const pix = 1 / sc.img.s;
    for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) {
      const w = C(sc.img.cx + (i + 0.5 - G / 2) * 410 / G * pix, sc.img.cy + (j + 0.5 - G / 2) * 516 / G * pix);
      totPx++;
      // truth
      const zs = T.preimages(ch, w, 45);
      const clean = [], ambig = [];
      for (const z of zs) {
        const d = CX.abs(L.dF(ch.F, z));
        if (!(d > 0) || !Number.isFinite(d)) { ambig.push({ z }); continue; }
        const zpx = pix / d, lev = Lv(z), spx = lev / zpx;
        const D = L.myD(z, win, P);
        const cand = { z, D, spx };
        if (Math.abs(spx) < 2.5) { ambig.push(cand); continue; }
        if (lev <= 0) continue;
        // near a cut (or a singularity): the forward map is not linear within 2.5 px
        const f0 = ch.F(z), dd = L.dF(ch.F, z);
        let cut = false;
        for (let k = 0; k < 8 && !cut; k++) {
          const del = C(2.5 * zpx * Math.cos(k * Math.PI / 4), 2.5 * zpx * Math.sin(k * Math.PI / 4));
          const pred = CX.add(f0, CX.mul(dd, del)), act = ch.F(CX.add(z, del));
          if (!(CX.abs(CX.sub(act, pred)) <= 0.25 * CX.abs(CX.mul(dd, del)))) cut = true;
        }
        if (cut) ambig.push(cand); else clean.push(cand);
      }
      clean.sort((a, b) => (L.myFront(a, b) ? -1 : 1));
      const tf = clean[0];
      if (ambig.some((a) => !a.D || !tf || a.D <= tf.D + 1e-9)) { amb++; continue; }
      const r = Inverse.enumerate(ch.plan, prep, w, pix, { K: 1, leaves: false });
      visitedSum += r.visited;
      cmp++;
      const e0 = r.entries[0];
      if (!tf) { if (e0) { spill++; if (ex.length < 6) ex.push({ kind: 'spill', w: fmt(w), e0: fmt(e0.z), win }); } continue; }
      if (!e0) { hole++; mis++; if (r.truncated) misTr++; if (ex.length < 6) ex.push({ kind: 'hole', w: fmt(w), truth: fmt(tf.z), D: tf.D, trunc: r.truncated, win }); continue; }
      if (CX.abs(CX.sub(e0.z, tf.z)) > 1e-6 * (1 + CX.abs(tf.z))) {
        mis++;
        if (r.truncated) { misTr++; maxGap = Math.max(maxGap, e0.D - tf.D); }
        if (ex.length < 6 && !r.truncated) ex.push({ kind: 'front', w: fmt(w), enumFront: fmt(e0.z), enumD: e0.D, truthFront: fmt(tf.z), truthD: tf.D, trunc: r.truncated, win, N: prep.N, stopOp: prep.stopOp, mob: !!prep.stopMob, P: P.map(fmt) });
      }
    }
  }
  totCmp += cmp; totMis += mis; totMisTr += misTr;
  console.log(`${name.padEnd(18)} [${ch.plan.ops.map((o) => o.kind).join('>')}] compared ${cmp} px (ambiguous ${amb}, views forward ${fwd}): mismatches ${mis} (in truncated windows ${misTr}, max key gap ${maxGap.toFixed(5)}), holes ${hole}, spill ${spill}, leaves/px ${(visitedSum / Math.max(1, cmp)).toFixed(1)}`);
  for (const e of ex) console.log('   ', JSON.stringify(e));
}
console.log(`TOTAL compared ${totCmp}: mismatches ${totMis} (truncated ${totMisTr}), untruncated ${totMis - totMisTr}`);
