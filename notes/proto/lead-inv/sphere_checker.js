'use strict';
// The spherical checker (SPEC 7) on log(H), z^i(H), Cayley(H), exp(H), at the default view and zoomed out 16x.
//   node notes/proto/lead-inv/sphere_checker.js   -> out/sph_<scene>[_out16].png
const path = require('path'), fs = require('fs');
const R = require('./render.js');
const Q = require(path.resolve(__dirname, '../../../test/regress/quality/scenes.js'));
const PNG = require(path.resolve(__dirname, '../../../test/regress/quality/pngio.js'));
const pick = (n) => Q.SCENES.find((s) => s.name === n) || R.NEW.find((s) => s.name === n);
for (const n of ['logH', 'zi_H', 'cayley_H', 'expH']) for (const f of [1, 16]) {
  const sc = pick(n), v = Object.assign({}, sc.rightView, { s: sc.rightView.s / f });
  const r = R.render(sc, v, 'sphere', { alpha: 1 });
  fs.writeFileSync(path.join(__dirname, 'out', `sph_${n}${f > 1 ? '_out' + f : ''}.png`), PNG.encode(R.W, R.H, r.rgba));
  console.log(n, f, r.ms.toFixed(0) + ' ms');
}
