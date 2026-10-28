// Reviewer scratch: homotopy endpoints and inverse round trips over many parameter values.
global.CX = require('../../src/cx.js'); global.Expr = require('../../src/parse.js');
const Funcs = require('../../src/funcs.js');
const C = CX.C;
const cxs = ['0', '1', '-1', 'i', '-i', '2', '0.5', '1+i', '-2+0.5i', '0.3-0.7i', '3', '-0.25', '1.5', '0.5+0.5i', '-1+i', '2i', '1e0'];
const ints = [-3, -2, -1, 0, 1, 2, 3, 7];
const angs = [180, 90, -90, 0, 45, -135, 179, -179, 190, 360, -180];
function* combos(id) {
  const ps = Funcs.DEFS[id].params;
  const lists = ps.map((q) => q.type === 'cx' ? cxs : q.type === 'int' ? ints : q.type === 'angle' ? angs : q.type === 'choice' ? q.choices.map((c) => c[0]) : q.type === 'coeffs' ? ['1,0,-1,0', '2,1', '0,0,1,1', 'i,0,0', '5'] : ['z^2+1', '\\log z', '\\sqrt{z}+1']);
  const n = lists.reduce((a, l) => a * l.length, 1);
  for (let j = 0; j < Math.min(n, 3000); j++) {
    let r = j; const p = {};
    ps.forEach((q, i) => { p[q.key] = lists[i][r % lists[i].length]; r = Math.floor(r / lists[i].length); });
    yield p;
  }
}
const pts = [C(0.3, 0.7), C(-0.4, 0.2), C(0.8, -0.5), C(1.3, 0.4), C(-1.7, -0.9), C(0.05, 2.2)];
const bad = {};
const note = (k, m) => { (bad[k] = bad[k] || []).push(m); };
for (const id of Object.keys(Funcs.DEFS)) {
  for (const params of combos(id)) {
    const b = Funcs.build({ type: id, params });
    if (b.error) continue;
    for (const z of pts) {
      const f = b.f(z);
      if (!CX.isFin(f)) continue;
      if (b.hom) {
        const h0 = b.hom(0)(z), h1 = b.hom(1)(z);
        if (!(CX.abs(CX.sub(h0, z)) < 1e-9 * (1 + CX.abs(z)))) note('hom0', `${id} ${JSON.stringify(params)} z=${CX.fmt(z)} h0=${CX.fmt(h0)}`);
        if (!(CX.abs(CX.sub(h1, f)) < 1e-7 * (1 + CX.abs(f)))) note('hom1', `${id} ${JSON.stringify(params)} z=${CX.fmt(z)} h1=${CX.fmt(h1)} f=${CX.fmt(f)}`);
        // continuity in t (no jumps)
        let prev = h0, maxJ = 0;
        for (let t = 0.01; t <= 1.0001; t += 0.01) { const v = b.hom(Math.min(1, t))(z); if (CX.isFin(v) && CX.isFin(prev)) maxJ = Math.max(maxJ, CX.abs(CX.sub(v, prev)) / (1 + CX.abs(v))); prev = v; }
        if (maxJ > 0.5) note('homjump', `${id} ${JSON.stringify(params)} z=${CX.fmt(z)} max relative jump ${maxJ.toFixed(2)}`);
      }
    }
    if (b.inverse) {
      const ib = Funcs.build({ type: b.inverse.type, params: Object.assign(Funcs.defaults(b.inverse.type), b.inverse.params) });
      if (ib.error) { note('inverr', `${id} ${JSON.stringify(params)} -> ${ib.error}`); continue; }
      for (const z of pts) {
        const fz = b.f(z);
        if (!CX.isFin(fz)) continue;
        const left = ib.f(fz); // inverse(f(z)) == z required when f injective
        if (b.props.injective && !(CX.abs(CX.sub(left, z)) < 1e-5 * (1 + CX.abs(z)))) note('inv-left', `${id} ${JSON.stringify(params)} z=${CX.fmt(z)} inv(f(z))=${CX.fmt(left)}`);
        const right = b.f(ib.f(z)); // f(inverse(w)) == w for w in the image; for non-injective f the inverse is a right inverse everywhere
        if (!b.props.injective && CX.isFin(right) && !(CX.abs(CX.sub(right, z)) < 1e-5 * (1 + CX.abs(z)))) note('inv-right', `${id} ${JSON.stringify(params)} w=${CX.fmt(z)} f(inv(w))=${CX.fmt(right)}`);
      }
    }
  }
}
for (const [k, v] of Object.entries(bad)) { console.log(`== ${k}: ${v.length}`); for (const m of v.filter((m)=>!/^mobius|^blaschke|^recip|^mul|^affine|^pown/.test(m) && (process.env.K0 ? /"k":0/.test(m) : true)).slice(0, 12)) console.log('   ', m); }
console.log('done');
