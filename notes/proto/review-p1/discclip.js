'use strict';
// Region.shapeClip's disc piece solves |z0 + t q - c|^2 = r^2 as b^2 - |q|^2 (|z0 - c|^2 - r^2): catastrophic
// cancellation when |z0 - c| >> r. (1) float64 failures on the CPU; (2) the same formula in float32 (the GLSL port
// of SPEC 4.3) vs a stable projection form.
const L = require('./lib.js');
const { Inverse, C, fmt } = L;
const f = Math.fround;
// (1) CPU: z^{1000i} of |z - 1e10| < 1 (apex 0, distance 1e10): every pixel of the image is empty
{
  const ch = L.chain([{ type: 'powa', params: { alpha: '1000i' } }]), shape = { kind: 'disc', c: [1e10, 0], r: 1 };
  const prep = Inverse.prepare(ch.plan, { win: L.WIN0, shape });
  let n = 0, miss = 0;
  for (let t = 0; t < 500; t++) { const z = L.sampleIn(shape); const w = ch.F(z); n++; const r = Inverse.enumerate(ch.plan, prep, w, 1e-6, { K: 1 }); if (!(r.U > 0)) miss++; }
  console.log(`(1) z^{1000i}, |z-1e10|<1: prepare ok=${prep.ok}; ${miss} of ${n} image points not covered`);
  const r = Region.shapeClip(Region.clipPrimitive(shape), C(0, 0), C(1, 2e-11));
  console.log(`    shapeClip(disc, z0 = 0, q = 1+2e-11 i) -> lo ${r.lo}, hi ${r.hi} (true: about [1e10-1, 1e10+1])`);
}
// (2) float32 emulation of the disc formula vs a stable form, for exp members z0 = Log w (Im in (-pi, pi]), q = 2 pi i
function clip32(z0, q, c, r) {
  const dx = f(z0.re - c.re), dy = f(z0.im - c.im), qq = f(f(q.re * q.re) + f(q.im * q.im));
  const b = f(f(dx * q.re) + f(dy * q.im)), cc = f(f(f(dx * dx) + f(dy * dy)) - f(r * r)), D = f(f(b * b) - f(qq * cc));
  if (!(D >= 0)) return null;
  const s = f(Math.sqrt(D));
  return [f(f(-b - s) / qq), f(f(-b + s) / qq)];
}
function clip32stable(z0, q, c, r) {
  const dx = f(c.re - z0.re), dy = f(c.im - z0.im), qq = f(f(q.re * q.re) + f(q.im * q.im)), ql = f(Math.sqrt(qq));
  const tc = f(f(f(dx * q.re) + f(dy * q.im)) / qq), h = f(Math.abs(f(f(q.re * dy) - f(q.im * dx))) / ql);
  if (!(h <= r)) return null;
  const half = f(f(Math.sqrt(f(f(r - h) * f(r + h)))) / ql);
  return [f(tc - half), f(tc + half)];
}
for (const [cy, r] of [[60, 1], [60, 0.1], [60, 0.01], [100, 0.001], [20, 0.01]]) {
  const c = C(0.3, cy);
  let n = 0, bad = 0, badS = 0;
  for (let k = 0; k < 20000; k++) {
    // a z in the disc, its exp member line
    const a = Math.random() * 2 * Math.PI, rr = r * Math.sqrt(Math.random()) * 0.999, z = C(c.re + rr * Math.cos(a), c.im + rr * Math.sin(a));
    const w = CX.exp(z), z0 = CX.log(w), q = C(0, 2 * Math.PI), m = Math.round((z.im - z0.im) / (2 * Math.PI));
    n++;
    const i32 = clip32(z0, q, c, r), s32 = clip32stable(z0, q, c, r);
    if (!i32 || m < Math.ceil(i32[0]) - 1 || m > Math.floor(i32[1]) + 1) bad++;
    if (!s32 || m < Math.ceil(s32[0]) - 1 || m > Math.floor(s32[1]) + 1) badS++;
  }
  console.log(`(2) exp of |z-(0.3+${cy}i)| < ${r}: float32 quadratic misses the member in ${(100 * bad / n).toFixed(1)} % of samples; stable projection form ${(100 * badS / n).toFixed(1)} %`);
}
