// What the two zeros-and-poles suites share: the exactness probe of the image. An expression for eval in a suite:
// `const EXACT_SRC = eval(fs.readFileSync(...))(DISC)`, then `ev(EXACT_SRC('R'), 60000)` (the classic right pane) or
// `EXACT_SRC('L')` (the steps view's pane, on its last plane).
// Exactness: classify pixels of the right plane against the exact image of the disc |z| < R under the step's map
// (degree <= 2: the roots of a prod(z - zeta) - w prod(z - p) = 0). Samples on a 6 px lattice whose truth is the
// same 2 px around them (the boundary band is not scored), and 3.5 px away from the image of the boundary circle (its
// stroke, which a fold lays inside the image); a pixel is 'fill' when nearer the fill colour than the plane.
(DISC) => (SIDE) => `await (async () => {
  const st = __cmwP().steps.find((q) => q.type === 'zp').params, R = ${DISC.r}, CZ = { re: ${DISC.c[0]}, im: ${DISC.c[1]} };
  const C = (re, im) => ({ re, im });
  const cmul = (a, b) => C(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
  const csub = (a, b) => C(a.re - b.re, a.im - b.im);
  const cadd = (a, b) => C(a.re + b.re, a.im + b.im);
  const cdiv = (a, b) => { const d = b.re * b.re + b.im * b.im; return C((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); };
  const csqrt = (a) => { const r = Math.sqrt(Math.hypot(a.re, a.im)), t = Math.atan2(a.im, a.re) / 2; return C(r * Math.cos(t), r * Math.sin(t)); };
  const val = (s) => Expr.constValue(s);
  const list = (s) => Funcs.splitList(s).map(val);
  const a = val(st.a), zs = list(st.zeros), ps = list(st.poles);
  const expand = (c, rs) => rs.reduce((co, r) => { const o = co.map(() => C(0, 0)).concat([C(0, 0)]); co.forEach((x, i) => { o[i] = cadd(o[i], x); o[i + 1] = csub(o[i + 1], cmul(x, r)); }); return o; }, [c]);
  const P = expand(a, zs), Q = expand(C(1, 0), ps);
  const pad = (co) => [...Array(3 - co.length).fill(C(0, 0)), ...co];
  if (P.length > 3 || Q.length > 3) return { skipped: 'degree > 2' };
  const PP = pad(P), QQ = pad(Q);
  const inImage = (w) => {
    const A = csub(PP[0], cmul(w, QQ[0])), B = csub(PP[1], cmul(w, QQ[1])), Cc = csub(PP[2], cmul(w, QQ[2]));
    let roots;
    if (Math.hypot(A.re, A.im) < 1e-14) roots = Math.hypot(B.re, B.im) > 0 ? [cdiv(C(-Cc.re, -Cc.im), B)] : [];
    else { const d = csqrt(csub(cmul(B, B), cmul(C(4, 0), cmul(A, Cc)))); roots = [cdiv(csub(d, B), cmul(C(2, 0), A)), cdiv(C(-B.re - d.re, -B.im - d.im), cmul(C(2, 0), A))]; }
    return roots.some((z) => Math.hypot(z.re - CZ.re, z.im - CZ.im) < R);
  };
  const F = (z) => { const ev = (co) => co.reduce((s, c) => cadd(cmul(s, z), c), C(0, 0)); return cdiv(ev(P), ev(Q)); };
  const c = document.getElementById(${SIDE === 'L' ? "'canvasL'" : "'canvasR'"});
  const s = document.createElement('canvas'); s.width = c.width; s.height = c.height;
  const x = s.getContext('2d', { willReadFrequently: true }); x.drawImage(c, 0, 0);
  const d = x.getImageData(0, 0, s.width, s.height).data;
  const look = __cmwLook('s1', '${SIDE}'), dpr = look.dpr, v = look.view;
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const fill = hex(look.color), bg = hex(look.plane);
  const W = c.width / dpr, H = c.height / dpr;
  const w2 = (px, py) => C(v.cx + (px - W / 2) / v.s, v.cy - (py - H / 2) / v.s);
  const rim = [];
  for (let j = 0; j < 4000; j++) { const t = 2 * Math.PI * j / 4000, w = F(C(CZ.re + R * Math.cos(t), CZ.im + R * Math.sin(t))); if (Number.isFinite(w.re) && Number.isFinite(w.im)) rim.push([W / 2 + (w.re - v.cx) * v.s, H / 2 - (w.im - v.cy) * v.s]); }
  const nearRim = (px, py) => rim.some(([x, y]) => Math.abs(x - px) < 3.5 && Math.abs(y - py) < 3.5);
  let n = 0, bad = 0; const badAt = [];
  for (let py = 16; py < H - 16; py += 6) for (let px = 16; px < W - 16; px += 6) {
    const t = inImage(w2(px, py));
    let robust = true;
    for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2], [1.5, 1.5], [-1.5, 1.5], [1.5, -1.5], [-1.5, -1.5]]) if (inImage(w2(px + dx, py + dy)) !== t) { robust = false; break; }
    if (!robust || nearRim(px, py)) continue;
    const i = 4 * (Math.round(py * dpr) * c.width + Math.round(px * dpr));
    const p = [d[i], d[i + 1], d[i + 2]];
    const df = Math.hypot(p[0] - fill[0], p[1] - fill[1], p[2] - fill[2]), db = Math.hypot(p[0] - bg[0], p[1] - bg[1], p[2] - bg[2]);
    const got = df < db;
    n++;
    if (got !== t) { bad++; if (badAt.length < 6) badAt.push([px, py, t, p]); }
  }
  return { n, bad, rate: bad / Math.max(1, n), badAt };
})()`
