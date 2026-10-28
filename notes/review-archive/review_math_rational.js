// Reviewer scratch: rational step with shared / repeated roots; exact-degree and Möbius claims.
global.CX = require('../../src/cx.js'); global.Expr = require('../../src/parse.js');
const Funcs = require('../../src/funcs.js'); const C = CX.C;
let seed = 5; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const mulPoly = (a, b) => { const r = Array(a.length + b.length - 1).fill(0).map(() => C(0, 0)); a.forEach((x, i) => b.forEach((y, j) => { r[i + j] = CX.add(r[i + j], CX.mul(x, y)); })); return r; };
const fromRoots = (rs, lead = 1) => rs.reduce((p, r) => mulPoly(p, [C(1, 0), CX.neg(r)]), [C(lead, 0)]);
const fmt = (p) => p.map((c) => CX.fmt(c, 12).replace(/\s/g, '')).join(',');
let bad = 0, n = 0;
for (let t = 0; t < 3000; t++) {
  const pool = [C(1, 0), C(-1, 0), C(0, 1), C(2, 0), C(0.5, 0), C(0, 0), C(1, 1)];
  const shared = Array.from({ length: Math.floor(rnd() * 3) }, () => pool[Math.floor(rnd() * pool.length)]);
  const pr = shared.concat(Array.from({ length: Math.floor(rnd() * 3) }, () => pool[Math.floor(rnd() * pool.length)]));
  const qr = shared.concat(Array.from({ length: Math.floor(rnd() * 4) }, () => pool[Math.floor(rnd() * pool.length)]));
  if (!qr.length) continue;
  // true reduced degrees
  const qa = qr.slice(), pa = [];
  for (const r of pr) { const i = qa.findIndex((x) => CX.abs(CX.sub(x, r)) < 1e-12); if (i >= 0) qa.splice(i, 1); else pa.push(r); }
  const trueDeg = Math.max(pa.length, qa.length);
  const b = Funcs.build({ type: 'rational', params: { p: fmt(fromRoots(pr)), q: fmt(fromRoots(qr)) } });
  if (b.error) continue;
  n++;
  const P = b.props;
  if (P.degExact && P.deg !== trueDeg) { bad++; if (bad < 8) console.log('deg claim', P.deg, 'true', trueDeg, 'p roots', pr.map((x) => CX.fmt(x)).join(' '), '| q roots', qr.map((x) => CX.fmt(x)).join(' ')); }
  if (P.mobius && trueDeg !== 1) { bad++; console.log('MOBIUS claim false', pr, qr); }
  if (P.proper && !(pa.length > qa.length && qa.length === qr.length - 0)) {
    // proper needs every pole of q to survive (no removable point) and deg p' > deg q'
    if (!(pa.length > qa.length) || qa.length !== qr.length - (pr.length - pa.length)) { bad++; console.log('PROPER claim false', pr.map((x) => CX.fmt(x)), qr.map((x) => CX.fmt(x))); }
  }
}
console.log('checked', n, 'bad', bad);
