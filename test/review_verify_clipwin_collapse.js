global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
global.Funcs = require('../src/funcs.js');
const Region = require('../src/region.js');
function areaOf(m) {
  let area = 0, maxW = 0;
  for (let t = 0; t < m.tri.length / 3; t++) {
    const a = m.tri[3 * t], b = m.tri[3 * t + 1], c = m.tri[3 * t + 2];
    area += Math.abs((m.src[2 * b] - m.src[2 * a]) * (m.src[2 * c + 1] - m.src[2 * a + 1]) - (m.src[2 * c] - m.src[2 * a]) * (m.src[2 * b + 1] - m.src[2 * a + 1])) / 2;
  }
  return area;
}
// emulate sourceViewChanged rounding for a 520x? px left pane
function nbOf(cx, cy, s, w, h) {
  const b = { x0: cx - w / 2 / s, x1: cx + w / 2 / s, y0: cy - h / 2 / s, y1: cy + h / 2 / s };
  return { real: b, nb: { x0: +b.x0.toPrecision(6), x1: +b.x1.toPrecision(6), y0: +b.y0.toPrecision(6), y1: +b.y1.toPrecision(6) } };
}
const cases = [
  { name: 'formula |z-100|<1 @ (100.5,0.3) s=6e5', s: { kind: 'formula', expr: '|z-100|<1' }, v: [100.5, 0.3, 6e5] },
  { name: 'disc c=100 r=1 @ (100.5,0.3) s=6e5', s: { kind: 'disc', c: [100, 0], r: 1 }, v: [100.5, 0.3, 6e5] },
  { name: 'formula |z|<1 @ (0.5,0.3) s=6e5 (control near origin)', s: { kind: 'formula', expr: '|z|<1' }, v: [0.5, 0.3, 6e5] },
];
for (const c of cases) {
  const { real, nb } = nbOf(c.v[0], c.v[1], c.v[2], 520, 380);
  for (const [lbl, win] of [['real box', real], ['rounded nb', nb]]) {
    let m; try { m = Region.buildMesh(c.s, win, 60); } catch (e) { console.log(c.name, lbl, 'ERR', e.message); continue; }
    const curves = (() => { try { return Region.curvesOf(c.s, win); } catch (e) { return []; } })();
    let polys = curves.map((cv) => Region.sampleCurve(cv, win)).filter((p) => p.length >= 4);
    console.log(c.name, '|', lbl, JSON.stringify(win), '| tris', m.tri.length / 3, 'area', areaOf(m).toExponential(3), 'viewArea', ((win.x1 - win.x0) * (win.y1 - win.y0)).toExponential(3), 'contours', m.contours.length, 'polys', polys.length);
  }
}
