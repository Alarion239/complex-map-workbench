// The sheet order of the exact renderer (Inverse.front, Inverse.order): the front of a set is the candidate with the
// largest Im z (then the largest Re z) among those whose key D is within TIE_D of the smallest key, and no member
// beyond D_min + TIE_D competes.
//   (a) two keys equal to float noise tie wherever they fall against a multiple of TIE_D
//   (b) a chain of three keys spaced 0.7 TIE_D: the first two compete, the third never does
//   (c) the order of a random set does not depend on the order its members are listed in, and its front agrees with
//       the rule applied to the whole set
// Run: node test/t_inverse_order.js   (exit code 1 on any failure)
global.CX = require('../src/cx.js');
const Inverse = require('../src/inverse.js');
const { TIE_D } = Inverse;
const C = CX.C;
let bad = 0;
const check = (name, ok, got) => { if (!ok) { bad++; console.log('FAIL ' + name + (got === undefined ? '' : ': ' + JSON.stringify(got))); } };
const cand = (D, re, im, id) => ({ D, z: C(re, im), id });
const ids = (l) => l.map((c) => c.id).join(',');

// (a) a pair of equal keys straddling a rounding step (k + 1/2) TIE_D by 1e-9 on either side
for (const k of [0, 1, 17, 1000]) {
  const edge = (k + 0.5) * TIE_D;
  const lo = cand(edge - 1e-9, 0.5, 1, 'lo'), hi = cand(edge + 1e-9, 0.5, -1, 'hi');
  check(`pair at step edge ${k}: front is the larger Im z (lo, Im 1)`, Inverse.front(lo, hi) && !Inverse.front(hi, lo));
  const lo2 = cand(edge - 1e-9, 0.5, -1, 'lo'), hi2 = cand(edge + 1e-9, 0.5, 1, 'hi');
  check(`pair at step edge ${k}, swapped: front is hi (Im 1)`, Inverse.front(hi2, lo2) && !Inverse.front(lo2, hi2));
  check(`order at step edge ${k}`, ids(Inverse.order([hi2, lo2])) === 'hi,lo' && ids(Inverse.order([lo2, hi2])) === 'hi,lo');
}
// equal keys with equal Im z: the larger Re z; a key a full step apart: the smaller key, whatever the Im z
check('equal Im z: larger Re z in front', Inverse.front(cand(1, 2, 1), cand(1, 1, 1)));
check('a key TIE_D apart does not tie', Inverse.front(cand(1, 0, -5), cand(1 + TIE_D, 0, 5)));
check('infinite keys are equal', Inverse.front(cand(Infinity, 0, 1), cand(Infinity, 0, -1)) && !Inverse.front(cand(Infinity, 0, 1), cand(1, 0, -1)));

// (b) the chain: D = 0, 0.7 TIE_D, 1.4 TIE_D; the third is within TIE_D of the second but not of the smallest
{
  const c = [cand(0, 0, 0, 'a'), cand(0.7 * TIE_D, 0, 1, 'b'), cand(1.4 * TIE_D, 0, 2, 'c')];
  check('chain: c never competes with a; b beats a; then c is the smallest of the rest', ids(Inverse.order(c)) === 'b,a,c', ids(Inverse.order(c)));
  check('chain: the same in every listing order', [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]].every((p) => ids(Inverse.order(p.map((i) => c[i]))) === 'b,a,c'));
}

// (c) random sets
let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
for (let trial = 0; trial < 2000; trial++) {
  const n = 1 + Math.floor(rnd() * 7);
  const base = rnd() * 4;
  // keys clustered at multiples of 0.3 TIE_D so that chains and ties are common; some equal
  const l = [];
  for (let i = 0; i < n; i++) l.push(cand(base + Math.floor(rnd() * 8) * 0.3 * TIE_D + (rnd() < 0.5 ? 0 : 1e-12 * rnd()), Math.floor(rnd() * 3), Math.floor(rnd() * 3) + (rnd() < 0.5 ? 0 : rnd()), i));
  const ref = Inverse.order(l);
  let shuffled = l.slice();
  for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
  const sh = Inverse.order(shuffled);
  // exact ties of every kind (same key, same z) may list in either order: compare the candidates' (D, z)
  const key = (c) => `${c.D}|${c.z.re}|${c.z.im}`;
  check(`random ${trial}: order independent of the listing`, ref.map(key).join(' ') === sh.map(key).join(' '), { a: ref.map(key), b: sh.map(key) });
  // the front: the largest Im z (then Re z) among keys < D_min + TIE_D
  const dmin = Math.min(...l.map((c) => c.D));
  let f = null;
  for (const c of l) if (c.D - dmin < TIE_D && (!f || Inverse.front({ D: dmin, z: c.z }, { D: dmin, z: f.z }))) f = c;
  // (two candidates at one z tie exactly: the front is compared by its z)
  check(`random ${trial}: the front is the rule's`, ref[0].z.re === f.z.re && ref[0].z.im === f.z.im, { got: key(ref[0]), want: key(f) });
}
console.log(bad ? `${bad} failed` : 'inverse order: all passed');
process.exit(bad ? 1 : 0);
