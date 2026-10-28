global.CX = require('../../src/cx.js');
global.Expr = require('../../src/parse.js');
global.Funcs = require('../../src/funcs.js');
const Region = require('../../src/region.js');
// replicate app.js sourceViewChanged rounding
const box = (cx, cy, s, w, h) => ({ x0: cx - w / 2 / s, x1: cx + w / 2 / s, y0: cy - h / 2 / s, y1: cy + h / 2 / s });
const round = (b) => ({ x0: +b.x0.toPrecision(6), x1: +b.x1.toPrecision(6), y0: +b.y0.toPrecision(6), y1: +b.y1.toPrecision(6) });
const tryMesh = (s, w) => { try { const m = Region.buildMesh(s, w, 80); return { tris: m.tri.length / 3, contours: m.contours.length }; } catch (e) { return { err: e.message }; } };
const tryLines = (s, w, mesh) => { try { let out = Region.curvesOf(s, w); if (mesh) for (const c of mesh.contours) { const pc = Region.polyCurve(c.pts, false); if (pc) out.push(pc); } return out.map((c) => Region.sampleCurve(c, w)).filter((p) => p.length >= 4).length; } catch (e) { return 'err ' + e.message; } };
const cases = [
  ['disc formula', { kind: 'formula', expr: '|z-100|<1' }, 100.5, 0.3, 6e5],
  ['halfplane', Object.assign({ kind: Object.keys(Region.KINDS).find((k) => /half/i.test(k)) }), 1, 0.3, 1e9],
];
console.log('kinds', Object.keys(Region.KINDS).join(','));
for (const [name, s, cx, cy, sc] of cases) {
  if (s.kind && /half/i.test(s.kind)) { s.a = [1, -1]; s.b = [1, 1]; }
  const tb = box(cx, cy, sc, 516, 466), rb = round(tb);
  let mT = null; try { mT = Region.buildMesh(s, tb, 80); } catch (e) {}
  let mR = null; try { mR = Region.buildMesh(s, rb, 80); } catch (e) {}
  console.log(name, JSON.stringify(s), '\n  true win', JSON.stringify(tb), 'mesh', JSON.stringify(tryMesh(s, tb)), 'lines', tryLines(s, tb, mT),
    '\n  rounded', JSON.stringify(rb), 'mesh', JSON.stringify(tryMesh(s, rb)), 'lines', tryLines(s, rb, mR));
}
