'use strict';
// region.js: (1) every pre-existing export behaves identically to notes/backup-pre-sphere/src/region.js on random
// inputs; (2) the new supportOf / clipPrimitive / shapeClip / convexOf / formulaBox are conservative.
const path = require('path');
const L = require('./lib.js');
const { C, ru, pick, rnd } = L;
const Rnew = Region;
const Rold = require(path.resolve(__dirname, '../../backup-pre-sphere/src/region.js'));
L.setSeed(99);
const OLD_KEYS = Object.keys(Rold);
const missing = OLD_KEYS.filter((k) => !(k in Rnew));
console.log('old exports', OLD_KEYS.length, 'missing in new:', missing.length ? missing : 'none', '; new-only:', Object.keys(Rnew).filter((k) => !(k in Rold)));
const ser = (x) => JSON.stringify(x, (k, v) => (typeof v === 'function' ? 'fn' : v instanceof Float64Array || v instanceof Uint32Array || v instanceof Float32Array ? Array.from(v) : v));
let diffs = 0, n = 0;
const kinds = ['disc', 'rect', 'polygon', 'halfplane', 'annulus', 'sector', 'sector0', 'cdisc', 'crect', 'chalf', 'formula'];
const win = { x0: -3.4, x1: 3.4, y0: -4.3, y1: 4.3 };
for (let i = 0; i < 400; i++) {
  const s = L.randShape(kinds);
  const s2 = JSON.parse(JSON.stringify(s));
  const zs = Array.from({ length: 20 }, () => C(ru(-120, 120), ru(-120, 120)));
  const cmp = (name, a, b) => { n++; if (ser(a) !== ser(b)) { diffs++; if (diffs < 5) console.log('DIFF', name, JSON.stringify(s)); } };
  cmp('levelOf', zs.map(Rold.levelOf(s)), zs.map(Rnew.levelOf(s2)));
  cmp('bboxOf', Rold.bboxOf(s), Rnew.bboxOf(s2));
  cmp('hitTest', zs.map((z) => Rold.hitTest(s, z, 0.5, win)), zs.map((z) => Rnew.hitTest(s2, z, 0.5, win)));
  cmp('handlesOf', Rold.handlesOf(s), Rnew.handlesOf(s2));
  let c1, c2;
  try { c1 = Rold.curvesOf(s, win).map((c) => [0, 0.3, 0.7, 1].map(c.f)); } catch (e) { c1 = 'err ' + e.message; }
  try { c2 = Rnew.curvesOf(s2, win).map((c) => [0, 0.3, 0.7, 1].map(c.f)); } catch (e) { c2 = 'err ' + e.message; }
  cmp('curvesOf', c1, c2);
  if (i % 8 === 0) {
    let m1, m2;
    try { m1 = Rold.buildMesh(s, win, { res: 24 }); } catch (e) { m1 = 'err ' + e.message; }
    try { m2 = Rnew.buildMesh(s2, win, { res: 24 }); } catch (e) { m2 = 'err ' + e.message; }
    cmp('buildMesh', m1, m2);
  }
  const d = C(ru(-1, 1), ru(-1, 1));
  Rold.translate(s, d); Rnew.translate(s2, d);
  cmp('translate', s, s2);
  const a = C(ru(-5, 5), ru(-5, 5)), dd = C(ru(-1, 1), ru(-1, 1));
  cmp('clipLine', Rold.clipLine(a, dd, win), Rnew.clipLine(a, dd, win));
  cmp('expandBox', Rold.expandBox(win, 3), Rnew.expandBox(win, 3));
}
for (const k of Object.keys(Rold.KINDS)) { n++; const A = C(-1.2, 0.4), B = C(2.1, -0.7); let x1, x2; try { x1 = Rold.defaultsFor(k, A, B, win); } catch (e) { x1 = 'err ' + e.message; } try { x2 = Rnew.defaultsFor(k, A, B, win); } catch (e) { x2 = 'err ' + e.message; } if (ser(x1) !== ser(x2)) { diffs++; console.log('DIFF defaultsFor', k); } }
console.log(`existing behaviour: ${n} comparisons, ${diffs} differences`);

// ---- (2) conservativeness of the additions
let supBad = 0, supN = 0, clipBad = 0, clipN = 0, holeBad = 0, marginBad = 0, ex = [];
for (let i = 0; i < 3000; i++) {
  const s = L.randShape(kinds.concat(['polygon', 'sector', 'sector0']));
  if (rnd() < 0.15 && s.kind === 'polygon') s.complement = true;            // complement of a (maybe non-convex) polygon
  if (rnd() < 0.1 && s.kind === 'sector') s.complement = true;
  const Lv = Region.levelOf(s), bb = Region.bboxOf(s) || { x0: -250, x1: 250, y0: -250, y1: 250 };
  const pts = [];
  for (let t = 0; t < 4000 && pts.length < 200; t++) { const z = C(ru(bb.x0, bb.x1), ru(bb.y0, bb.y1)); if (Lv(z) > 0) pts.push(z); }
  for (let k = 0; k < 16; k++) {
    const th = rnd() * 2 * Math.PI, e = C(Math.cos(th), Math.sin(th));
    const [lo, hi] = Region.supportOf(s, e);
    for (const z of pts) { supN++; const v = z.re * e.re + z.im * e.im; if (v < lo - 1e-9 * (1 + Math.abs(v)) || v > hi + 1e-9 * (1 + Math.abs(v))) { supBad++; if (ex.length < 4) ex.push(['support', s, e, lo, hi, v]); } }
  }
  const prim = Region.clipPrimitive(s);
  for (let k = 0; k < 8; k++) {
    const z0 = C(ru(-150, 150), ru(-150, 150)), q = C(ru(-3, 3), ru(-3, 3));
    const margin = rnd() < 0.5 ? 0 : ru(0, 2);
    const r = Region.shapeClip(prim, z0, q, margin);
    for (let t = -400; t <= 400; t += 0.37) {
      const z = C(z0.re + t * q.re, z0.im + t * q.im), lv = Lv(z);
      if (lv > 1e-9) {
        clipN++;
        if (t < r.lo - 1e-9 || t > r.hi + 1e-9) { clipBad++; if (ex.length < 8) ex.push(['clip', s, z0, q, t, r]); }
        if (r.hlo <= r.hhi && t > r.hlo + 1e-9 && t < r.hhi - 1e-9) { holeBad++; if (ex.length < 12) ex.push(['hole', s, z0, q, t, r]); }
      } else if (margin > 0 && lv > -margin * 0.999 && s.kind !== 'formula') {
        // within the margin of the shape (level is a distance lower bound for built-in kinds)
        if (t < r.lo - 1e-9 || t > r.hi + 1e-9 || (r.hlo <= r.hhi && t > r.hlo + 1e-9 && t < r.hhi - 1e-9)) { marginBad++; if (ex.length < 14) ex.push(['margin', s, z0, q, t, r, margin, lv]); }
      }
    }
  }
}
console.log(`supportOf: ${supBad} of ${supN} inside points outside the support; shapeClip: ${clipBad} of ${clipN} inside line points outside [lo, hi], ${holeBad} inside the hole, ${marginBad} margin points excluded`);
for (const e of ex) console.log(JSON.stringify(e));
