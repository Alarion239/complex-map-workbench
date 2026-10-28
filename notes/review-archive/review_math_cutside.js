// Reviewer scratch: which side of each drawn ray cut does the function take on the cut itself?
// drawCuts hatches the clockwise side of every ray ("the side whose values the cut takes").
global.CX = require('../../src/cx.js'); global.Expr = require('../../src/parse.js');
const Funcs = require('../../src/funcs.js'); const C = CX.C;
for (const id of ['log', 'root', 'powa', 'arcsin', 'arccos', 'arctan', 'arsinh', 'arcosh', 'artanh']) {
  for (const cutDeg of (Funcs.DEFS[id].hasCut ? [180, 90, -45] : [null])) {
    const params = Object.assign(Funcs.defaults(id), cutDeg == null ? {} : { cut: cutDeg });
    const b = Funcs.build({ type: id, params });
    for (const c of b.cuts) {
      if (c.kind !== 'ray') continue;
      const d = C(Math.cos(c.ang), Math.sin(c.ang));
      const p = CX.add(c.p, CX.scale(d, 0.7));          // a point on the cut
      const nCW = C(d.im, -d.re);                        // clockwise normal
      const eps = 1e-9;
      const on = b.f(p), cw = b.f(CX.add(p, CX.scale(nCW, eps))), ccw = b.f(CX.sub(p, CX.scale(nCW, eps)));
      const side = CX.abs(CX.sub(on, cw)) < 1e-6 ? 'clockwise' : CX.abs(CX.sub(on, ccw)) < 1e-6 ? 'COUNTER-clockwise' : 'neither';
      console.log(`${id.padEnd(7)} cut ray from ${CX.fmt(c.p)} at ${(c.ang * 180 / Math.PI).toFixed(0)}°: value on cut = ${CX.fmt(on, 5).padEnd(22)} takes the ${side} side (cw ${CX.fmt(cw, 5)}, ccw ${CX.fmt(ccw, 5)})`);
    }
  }
}
