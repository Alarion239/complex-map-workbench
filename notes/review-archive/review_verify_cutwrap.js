global.CX = require('../../src/cx.js');
global.Expr = require('../../src/parse.js');
const Funcs = require('../../src/funcs.js');
const C = CX.C;
const f = (z) => CX.fmt ? CX.fmt(z) : `${z.re}+${z.im}i`;
// replicate setCut normalisation from app.js
function setCutNorm(deg) { let d = ((deg % 360) + 360) % 360; if (d > 180) d -= 360; d = Math.round(d * 10) / 10; if (d === -180) d = 180; return d; }
function branchTag(type, params) { let deg = ((+params.cut % 360) + 360) % 360; if (deg > 180) deg -= 360; let t = `cut ${+deg.toFixed(1)}°`; const kk = Math.round(+params.k || 0); if (type === 'root') { const n = Math.max(2, Math.round(+params.n || 2)); t += `, sheet ${((kk % n) + n) % n}/${n}`; } else if (kk) t += `, sheet ${kk}`; return t; }
const pts = [C(1,0), C(0,1), C(0.5,-0.5), C(-1, 0.1)];
for (const [label, raw] of [['default 180', 180], ['drag to 179 (CW 1deg)', setCutNorm(179)], ['drag to 181 (CCW 1deg)', setCutNorm(181)], ['drag to 190 (CCW 10deg)', setCutNorm(190)], ['typed 190', 190], ['typed -170', -170], ['typed -180', -180], ['typed -90', -90]]) {
  for (const type of ['root', 'log']) {
    const params = Object.assign(Funcs.defaults(type), { cut: raw });
    const b = Funcs.build({ type, params });
    console.log(label.padEnd(26), 'stored', String(raw).padEnd(6), type.padEnd(5), branchTag(type, params).padEnd(22), pts.map((z) => f(b.f(z))).join(' | '));
  }
}
// custom formula constant subexpressions
for (const cut of [180, -90]) {
  for (const expr of ['\\sqrt{2}\\,z', '\\log(2)+z']) {
    const b = Funcs.build({ type: 'custom', params: { expr, cut } });
    console.log('custom', cut, expr, '->', f(b.f(C(1, 0))), 'note:', b.branchNote, 'usesCut:', b.usesCut);
  }
}
