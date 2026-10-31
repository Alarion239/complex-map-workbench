// exact sign of integer-coefficient polynomials at double points (BigInt), and a polyline distance index
// poly: [[c, i, j], ...] meaning sum c x^i y^j (c integer or rational given as [num, den])
const K = 1200n; // common denominator 2^K covers every double (incl. subnormals: 2^-1074)
const D = 1n << K;
function toBig(v) {
  // v = m * 2^e exactly
  if (v === 0) return 0n;
  const buf = new DataView(new ArrayBuffer(8)); buf.setFloat64(0, v);
  const hi = buf.getUint32(0), lo = buf.getUint32(4);
  const sign = hi >>> 31 ? -1n : 1n, ex = (hi >>> 20) & 0x7ff;
  let mant = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
  let e;
  if (ex === 0) e = -1074; else { mant |= 1n << 52n; e = ex - 1075; }
  // v * 2^K = mant * 2^(e + K)
  return sign * (mant << BigInt(e + Number(K)));
}
function signPoly(poly, x, y) {
  const X = toBig(x), Y = toBig(y);
  let deg = 0; for (const [, i, j] of poly) deg = Math.max(deg, i + j);
  let s = 0n, den = 1n;
  for (const [c] of poly) if (Array.isArray(c)) den *= BigInt(c[1]);
  for (const [c, i, j] of poly) {
    const num = Array.isArray(c) ? BigInt(c[0]) * (den / BigInt(c[1])) : BigInt(c) * den;
    s += num * X ** BigInt(i) * Y ** BigInt(j) * D ** BigInt(deg - i - j);
  }
  return s > 0n ? 1 : s < 0n ? -1 : 0;
}
// rigorous: is there a zero of the polynomial within rho of (x, y)? (a sign change around a circle of radius rho, or 0 at the point)
function zeroWithin(poly, x, y, rho, n = 48) {
  const s0 = signPoly(poly, x, y);
  if (s0 === 0) return true;
  for (let k = 0; k < n; k++) {
    const t = 2 * Math.PI * k / n;
    const s = signPoly(poly, x + rho * Math.cos(t), y + rho * Math.sin(t));
    if (s === 0 || s !== s0) return true;
  }
  return false;
}
// segment index for distance queries
function segIndex(polys, cell) {
  const map = new Map();
  const key = (i, j) => i + ',' + j;
  const segs = [];
  for (const p of polys) {
    const a = p.pts || p;
    for (let q = 0; q + 3 < a.length; q += 2) {
      const s = [a[q], a[q + 1], a[q + 2], a[q + 3]];
      if (!s.every(Number.isFinite)) continue;
      const id = segs.length; segs.push(s);
      const i0 = Math.floor(Math.min(s[0], s[2]) / cell), i1 = Math.floor(Math.max(s[0], s[2]) / cell);
      const j0 = Math.floor(Math.min(s[1], s[3]) / cell), j1 = Math.floor(Math.max(s[1], s[3]) / cell);
      if ((i1 - i0 + 1) * (j1 - j0 + 1) > 400) continue; // far tail chords: skip
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = key(i, j); if (!map.has(k)) map.set(k, []); map.get(k).push(id); }
    }
  }
  const dseg = (s, x, y) => {
    const dx = s[2] - s[0], dy = s[3] - s[1], L2 = dx * dx + dy * dy;
    let t = L2 > 0 ? ((x - s[0]) * dx + (y - s[1]) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t));
    return Math.hypot(s[0] + t * dx - x, s[1] + t * dy - y);
  };
  return (x, y, rmax) => {
    const r = Math.ceil(rmax / cell), i0 = Math.floor(x / cell), j0 = Math.floor(y / cell);
    let best = Infinity;
    for (let i = i0 - r; i <= i0 + r; i++) for (let j = j0 - r; j <= j0 + r; j++) { const L = map.get(key(i, j)); if (L) for (const id of L) best = Math.min(best, dseg(segs[id], x, y)); }
    return best;
  };
}
module.exports = { signPoly, zeroWithin, segIndex, toBig };
