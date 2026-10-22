global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
global.Funcs = require('../src/funcs.js');
const Region = require('../src/region.js');
for (const win of [{ x0: -4, x1: 4, y0: -4, y1: 4 }, { x0: -6, x1: 6, y0: -4, y1: 4 }]) {
  for (const base of [60, 320]) {
    const m = Region.buildMesh({ kind: 'disc', c: [0, 0], r: 2 }, win, base);
    const inst = Region.meshInstances(m);
    const tris = m.tri.length / 3;
    for (const L of [4, 2]) {
      const P = (L + 1) * (L + 2) / 2 + L * L;
      const count = P * tris, W = 4096, H = Math.ceil(count / W), bytes = W * H * 8;
      console.log(JSON.stringify(win), 'base', base, 'tris', tris, 'instLen', inst.length || (inst.data && inst.data.length), 'L', L, 'P', P, 'H', H, 'MB per buf', (bytes / 1e6).toFixed(1), 'buf+tex MB', (2 * bytes / 1e6).toFixed(1));
    }
  }
}
