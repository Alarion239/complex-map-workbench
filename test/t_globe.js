// P3b (panels.md 9.3-9.6): the globe-editing functions of src/region.js, checked against the reference
// notes/ui-design/mockup-src/cap_check.js (conjugate lift). Run: node test/t_globe.js (exit 1 on a failure)
global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
global.Funcs = require('../src/funcs.js');
const Region = require('../src/region.js');
const G = Region.Globe;
let fails = 0;
const ok = (name, cond, got) => { if (!cond) { fails++; console.log('FAIL', name, got === undefined ? '' : JSON.stringify(got)); } else console.log('ok  ', name); };
// a seeded generator, so a failure repeats
let seed = 12345;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const unit = () => { const v = [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]; const l = Math.hypot(...v); return v.map((x) => x / l); };
const inside = (s, x, y) => Region.levelOf(s)(CX.C(x, y)) > 0;

// 1. the lift and its inverse (precision near infinity included)
{
  let e = 0;
  for (let i = 0; i < 2000; i++) {
    const m = Math.pow(10, 12 * rnd() - 6), t = 2 * Math.PI * rnd(), x = m * Math.cos(t), y = m * Math.sin(t);
    const z = G.unlift(G.lift(x, y));
    e = Math.max(e, Math.hypot(z.re - x, z.im - y) / m);
  }
  ok('unlift(lift(z)) = z, |z| in [1e-6, 1e6], relative error < 1e-12', e < 1e-12, e);
  ok('unlift(N) is null (infinity holds no point)', G.unlift([0, 0, 1]) === null);
  const P = G.lift(0.5, 0);
  ok('lift: 0 at the south pole, infinity at N, the conjugate lift (Im z > 0 has P_y < 0)', G.lift(0, 0)[2] === -1 && G.lift(1e300, 0)[2] > 0.999999 && G.lift(0, 1)[1] < 0 && Math.abs(P[0] - 0.8) < 1e-15);
}
// 2. caps <-> disc / complement / half-plane: membership P.C > h agrees with the stored shape, and back
{
  let bad = 0, maxe = 0, nHalf = 0, nComp = 0, nDisc = 0;
  for (let it = 0; it < 3000; it++) {
    const C = unit();
    let h = rnd() * 1.8 - 0.9;
    if (it % 10 === 0) h = C[2];                          // infinity exactly on the rim
    const s = G.shapeOfCap(C, h, 'disc');
    if (s.kind === 'halfplane') nHalf++; else if (s.complement) nComp++; else nDisc++;
    for (let k = 0; k < 20; k++) {
      const x = (rnd() - 0.5) * 8, y = (rnd() - 0.5) * 8, P = G.lift(x, y);
      const m = P[0] * C[0] + P[1] * C[1] + P[2] * C[2] - h;
      if (Math.abs(m) > 1e-6 && (m > 0) !== inside(s, x, y)) bad++;
    }
    const back = G.capOf(s);
    maxe = Math.max(maxe, Math.hypot(back.C[0] - C[0], back.C[1] - C[1], back.C[2] - C[2]), Math.abs(back.h - h));
  }
  ok(`cap -> shape: membership agrees at 60000 points (${nDisc} discs, ${nComp} complements, ${nHalf} half-planes)`, bad === 0 && nHalf === 300 && nComp > 100 && nDisc > 100, bad);
  ok('cap -> shape -> cap returns C and h to 1e-12', maxe < 1e-12, maxe);
}
// 3. a rim through N is the half-plane (line) exactly; the circle family gives circles and lines
{
  const C = G.norm3([0.3, -0.5, 0.2]);
  const s = G.shapeOfCap(C, C[2], 'disc'), l = G.shapeOfCap(C, C[2], 'circle'), c = G.shapeOfCap(C, 0.1, 'circle');
  ok('rim through N: a half-plane (disc family), a line (circle family), a circle off N', s.kind === 'halfplane' && l.kind === 'line' && c.kind === 'circle' && !('complement' in c));
  // the stored half-plane's edge is the rim: its points lift onto P.C = h
  const a = CX.C(s.a[0], s.a[1]), b = CX.C(s.b[0], s.b[1]);
  let e = 0;
  for (const t of [-100, -1, 0, 0.5, 3, 1e4]) { const z = CX.add(a, CX.scale(CX.sub(b, a), t)); const P = G.lift(z.re, z.im); e = Math.max(e, Math.abs(G.dot3(P, C) - C[2])); }
  ok('the half-plane edge lies on the rim', e < 1e-12, e);
  // the region is on the left of a -> b and contains the cap's centre direction
  const zc = G.unlift(C);
  ok('the half-plane contains the cap centre', inside(s, zc.re, zc.im));
}
// 4. rotation keeps h and changes the kind across infinity
{
  const s = { kind: 'disc', c: [0, 1.5], r: 0.5 };
  const cap0 = G.capOf(s);
  // slide the disc toward N (along the meridian of its centre) by twice its distance to N
  const zc = G.unlift(cap0.C), P0 = cap0.C;
  const ang = Math.acos(Math.min(1, P0[2]));   // the centre onto N: the cap now holds infinity
  const ax = G.norm3(G.cross3(P0, [0, 0, 1]));
  const R = G.rotAxis(ax, ang);
  const t = JSON.parse(JSON.stringify(s));
  ok('rotateShape returns true for a disc', G.rotateShape(t, R));
  const cap1 = G.capOf(t);
  ok('rotation keeps h', Math.abs(cap1.h - cap0.h) < 1e-12, [cap0.h, cap1.h]);
  ok('a disc slid over infinity becomes the complement of a disc', t.kind === 'disc' && t.complement === true, t);
  // part way: the rim exactly through N gives the half-plane
  const half = JSON.parse(JSON.stringify(s));
  const angH = Math.acos(Math.min(1, P0[2])) - Math.acos(cap0.h);
  G.applyCap(half, G.rot3(G.rotAxis(ax, angH), cap0.C), cap0.h);
  const capH = G.capOf(half);
  ok('rotating the rim onto N (|C_z - h| < 1e-12) stores the half-plane', half.kind === 'halfplane' || Math.abs(capH.C[2] - capH.h) > 1e-12, [half.kind, capH && capH.C[2] - capH.h]);
  // a line slid off infinity becomes a circle
  const ln = { kind: 'line', a: [0, 1], b: [1, 1] };
  G.rotateShape(ln, G.rotAxis([1, 0, 0], 0.3));
  ok('a line slid off infinity becomes a circle', ln.kind === 'circle' && ln.r > 0, ln);
  // a point follows the rotation; one that would land on infinity stays
  const pt = { kind: 'point', p: [0.5, 0.5] }, Pp = G.lift(0.5, 0.5);
  ok('a point rotated onto N stays where it was', !G.rotateShape(pt, G.rotationTo(Pp, [0, 0, 1])) && pt.p[0] === 0.5);
  G.rotateShape(pt, G.rotationTo(Pp, G.lift(-1, 2)));
  ok('a point rotated from P(z0) to P(z1) lands on z1', Math.hypot(pt.p[0] + 1, pt.p[1] - 2) < 1e-12, pt.p);
  ok('rotationTo takes P0 to P1', (() => { let e = 0; for (let i = 0; i < 200; i++) { const a = unit(), b = unit(), q = G.rot3(G.rotationTo(a, b), a); e = Math.max(e, Math.hypot(q[0] - b[0], q[1] - b[1], q[2] - b[2])); } return e < 1e-12; })());
  // other kinds do not rotate
  ok('a rectangle does not rotate', !G.rotateShape({ kind: 'rect', a: [0, 0], b: [1, 1] }, R));
}
// 5. handles on the globe
{
  const s = { kind: 'disc', c: [0.5, -0.25], r: 0.75 };
  const hs = G.globeHandlesOf(s, 0.7);
  const cap = G.capOf(s);
  ok('a cap has a centre and a rim handle', hs.length === 2 && hs[0][0] === 'C' && hs[1][0] === 'rim');
  ok('the rim handle is on the rim, at its angle', Math.abs(G.dot3(hs[1][1], cap.C) - cap.h) < 1e-12 && Math.abs(G.rimAngle(cap.C, hs[1][1]) - 0.7) < 1e-12);
  // the rim handle through N gives the half-plane (opts.h = C_z, the app's snap)
  const t = JSON.parse(JSON.stringify(s));
  G.setGlobeHandle(t, 'rim', [0, 0, 1], { h: cap.C[2] });
  ok('the rim handle snapped through N stores a half-plane', t.kind === 'halfplane' && !('c' in t) && !('r' in t), t);
  // and dragged on past N, the complement of a disc
  const u = JSON.parse(JSON.stringify(t));
  const c2 = G.capOf(u);
  G.setGlobeHandle(u, 'rim', G.rimPoint(c2.C, c2.C[2] - 0.2, 0));
  ok('the rim dragged past N stores the complement of a disc', u.kind === 'disc' && u.complement === true, u);
  // the centre handle moves the cap (h kept)
  const v = JSON.parse(JSON.stringify(s));
  G.setGlobeHandle(v, 'C', G.lift(-2, 0));
  const cv = G.capOf(v);
  ok('the centre handle moves the cap and keeps h', Math.abs(cv.h - cap.h) < 1e-12 && Math.hypot(...cv.C.map((x, k) => x - G.lift(-2, 0)[k])) < 1e-12);
  // planar kinds: their handles lifted, none at infinity
  const hr = G.globeHandlesOf({ kind: 'ray', a: [0, 0], b: [1e7, 0] });
  ok('planar handles are lifted, a handle beyond 1e6 is not shown', hr.length === 1 && hr[0][0] === 'a');
  const sg = { kind: 'segment', a: [0, 0], b: [1, 1] };
  ok('a planar handle takes the planar point of P', G.setGlobeHandle(sg, 'b', G.lift(2, -3)) && Math.hypot(sg.b[0] - 2, sg.b[1] + 3) < 1e-12);
  ok('a planar handle is not moved to infinity', !G.setGlobeHandle(sg, 'b', [0, 0, 1]) && Math.hypot(sg.b[0] - 2, sg.b[1] + 3) < 1e-12);
}
// 6. curves sampled on the sphere: lines and rays reach N, caps' rims are their circles
{
  const dN = (c) => { let m = Infinity; const pts = c.pts; for (let i = 0; i + 1 < pts.length + (c.closed ? 1 : 0); i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; for (let k = 0; k <= 8; k++) { const t = k / 8, q = a.map((x, j) => x + t * (b[j] - x)); m = Math.min(m, Math.hypot(q[0], q[1], q[2] - 1)); } } return m; };
  const ln = Region.sphereCurvesOf({ kind: 'line', a: [0, 1], b: [1, 1] }, 192);
  ok('a line is a closed circle of the sphere through N', ln.length === 1 && ln[0].closed && dN(ln[0]) < 0.02, dN(ln[0]));
  const hp = Region.sphereCurvesOf({ kind: 'halfplane', a: [3, 0], b: [3, 1] }, 192);
  ok('a half-plane edge passes N', dN(hp[0]) < 0.02, dN(hp[0]));
  const ry = Region.sphereCurvesOf({ kind: 'ray', a: [1, 1], b: [2, 3] }, 192);
  const last = ry[0].pts[ry[0].pts.length - 1];
  ok('a ray ends at N exactly and starts at its origin', last[2] === 1 && Math.hypot(...ry[0].pts[0].map((x, k) => x - G.lift(1, 1)[k])) < 1e-15);
  const sec = Region.sphereCurvesOf({ kind: 'sector', c: [0, 0], r: 0, t1: 0, t2: 90 }, 64);
  ok('an unbounded sector: two rays to N', sec.length === 2 && sec.every((c) => c.pts[c.pts.length - 1][2] === 1));
  const disc = { kind: 'disc', c: [0.3, 0.2], r: 0.4 }, cap = G.capOf(disc), dc = Region.sphereCurvesOf(disc, 96)[0];
  ok('a disc rim is sampled on its cap rim', dc.pts.every((p) => Math.abs(G.dot3(p, cap.C) - cap.h) < 1e-12));
  const rc = Region.sphereCurvesOf({ kind: 'rect', a: [-1, -1], b: [1, 2] }, 96);
  ok('a rectangle: its planar boundary lifted (on the unit sphere)', rc.length === 1 && rc[0].closed && rc[0].pts.every((p) => Math.abs(Math.hypot(...p) - 1) < 1e-12));
  ok('a formula set has no curves', Region.sphereCurvesOf({ kind: 'formula', expr: '|z|<1' }).length === 0);
}
// 7. area membership on the globe
{
  const comp = { kind: 'disc', c: [0, 0], r: 1, complement: true };
  ok('the complement of a disc contains infinity (P.C > h at N)', G.globeInside(comp, [0, 0, 1]) && !G.globeInside(comp, G.lift(0.2, 0.1)));
  ok('a half-plane: membership at finite points', G.globeInside({ kind: 'halfplane', a: [0, 0], b: [1, 0] }, G.lift(0, 1)) && !G.globeInside({ kind: 'halfplane', a: [0, 0], b: [1, 0] }, G.lift(0, -1)));
  ok('a rectangle: by its level, never at infinity', G.globeInside({ kind: 'rect', a: [-1, -1], b: [1, 1] }, G.lift(0.5, 0.5)) && !G.globeInside({ kind: 'rect', a: [-1, -1], b: [1, 1] }, [0, 0, 1]));
}
// 8. P3b fixes: a half-plane or line stored from a cap has a unit direction and prints as an equation; the ∞ snap of a
// moved centre (setGlobeHandle opts.infSnap) can store no huge r
{
  // the Y-globe case of the review: a cap centred on 1.2i whose rim passes N
  const C0 = G.lift(0, 1.2), Cn = G.norm3(C0);
  const hpS = { kind: 'disc', c: [0, 0], r: 1 };
  G.applyCap(hpS, Cn, Cn[2]);
  const d = [hpS.b[0] - hpS.a[0], hpS.b[1] - hpS.a[1]];
  ok('a half-plane from a cap: |b - a| = 1, a the edge point nearest 0', hpS.kind === 'halfplane' && Math.abs(Math.hypot(...d) - 1) < 1e-15 && Math.abs(d[0] * hpS.a[0] + d[1] * hpS.a[1]) < 1e-15, hpS);
  const tx = Region.KINDS.halfplane.tex(hpS);
  ok('its TeX is Im z > 0.183 (no meaningless denominator)', tx === '\\operatorname{Im}z>0.183', tx);
  // membership is unchanged by the normalisation: the cap test and the planar level agree
  let bad = 0;
  for (let i = 0; i < 400; i++) { const P = unit(), z = G.unlift(P); if (!z) continue; const m = G.dot3(P, Cn) - Cn[2]; if (Math.abs(m) > 1e-9 && (m > 0) !== inside(hpS, z.re, z.im)) bad++; }
  ok('the normalised half-plane is the same set as its cap', bad === 0, bad);
  // a rim 0.57 deg from N on the real axis side: Re z > t
  const Cr = G.lift(100, 0), hr = Cr[2];
  const reS = { kind: 'disc', c: [0, 0], r: 1 }; G.applyCap(reS, Cr, hr);
  ok('a half-plane facing +Re prints Re z > t', /^\\operatorname\{Re\}z>/.test(Region.KINDS.halfplane.tex(reS)), Region.KINDS.halfplane.tex(reS));
  const lnS = { kind: 'circle', c: [0, 0], r: 1 }; const Cg = G.norm3(G.lift(0.3, 0.4)); G.applyCap(lnS, Cg, Cg[2]);
  const lt = Region.KINDS.line.tex(lnS);
  ok('a line from a cap prints its equation Re(e^{-i phi} z) = t', lnS.kind === 'line' && /^\\operatorname\{Re\}\\left\(e\^\{-?[0-9.]+\^\\circ i\}z\\right\)=/.test(lt), lt);
  ok('a line drawn by two points in the plane keeps "line through"', /line through/.test(Region.KINDS.line.tex({ kind: 'line', a: [0, 0], b: [2, 1] })));
  ok('a half-plane drawn in the plane with |b - a| != 1 keeps its quotient form', /frac/.test(Region.KINDS.halfplane.tex({ kind: 'halfplane', a: [0, 0], b: [2, 1] })));
  // setGlobeHandle 'C' with the ∞ snap callback: a centre whose rim would pass 0.01 deg from N stores the half-plane
  const capD = { kind: 'disc', c: [0, 0], r: 1 }; G.applyCap(capD, G.lift(0.3, -0.2), 0.5);
  const al = Math.acos(0.5), near = al + 0.01 * Math.PI / 180, Pn = [Math.sin(near), 0, Math.cos(near)];
  const R150 = 150, snap = (C, h) => { const a = Math.acos(C[2]), b = Math.acos(h); return Math.abs(a - b) * R150 <= 8 && C[2] !== h ? [Math.sin(b) * C[0] / Math.hypot(C[0], C[1]), Math.sin(b) * C[1] / Math.hypot(C[0], C[1]), h] : null; };
  const t1 = JSON.parse(JSON.stringify(capD)); G.setGlobeHandle(t1, 'C', Pn, { infSnap: snap });
  ok('the C handle with its rim 0.01 deg from N: a half-plane (opts.infSnap)', t1.kind === 'halfplane', t1);
  const t0 = JSON.parse(JSON.stringify(capD)); G.setGlobeHandle(t0, 'C', Pn);
  ok('without the callback the same move stores the huge r the snap prevents', t0.kind === 'disc' && t0.r > 1000, t0.r);
  // 9 px of arc away: a disc with r <= 20 sin(alpha) (alpha = the cap's angular radius, 60 deg here)
  const far = al + 9 / R150, Pf = [Math.sin(far), 0, Math.cos(far)];
  const t2 = JSON.parse(JSON.stringify(capD)); G.setGlobeHandle(t2, 'C', Pf, { infSnap: snap });
  ok('9 px of arc from N: a disc with r <= 20 sin(alpha)', t2.kind === 'disc' && t2.r <= 20 * Math.sin(al), t2);
}
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
