require('./load.js');
const X = globalThis.CX, F = globalThis.Funcs, C = X.C;
const build = (type, params) => F.build({ type, params: Object.assign(F.defaults(type), params || {}), on: true });
const sq = build('root', { n: 2 });
const sn = build('custom', { expr: '\\sin z' });
const sinb = F.DEFS.sin ? build('sin') : sn;
console.log('types', Object.keys(F.DEFS).join(' '));
console.log('sq keys', Object.keys(sq).join(' '));
// H_t = sin(h_{1,t}(z)), h = z^{1 - t/2}
const H = (t) => { const h = sq.hom(t); return (z) => sinb.f(h(z)); };
// zeros: sin(u)=0 at u = k pi; u = z^s, s = 1 - t/2; principal arg z in (-pi, pi]
for (const t of [0, 0.25, 0.5, 0.75, 1]) {
  const s = 1 - t / 2, out = [];
  for (const k of [-2, -1, 1, 2]) {
    const zeta = C(k * Math.PI, 0), phi = k > 0 ? 0 : Math.PI, r = Math.abs(k * Math.PI);
    // preimage: z = r^{1/s} e^{i phi/s} if phi/s in (-pi, pi]
    const a = phi / s;
    if (a > -Math.PI && a <= Math.PI + 1e-12) { const z = C(Math.pow(r, 1 / s) * Math.cos(a), Math.pow(r, 1 / s) * Math.sin(a)); out.push(`k=${k}: z=${X.fmt(z)} |H|=${X.abs(H(t)(z)).toExponential(1)}`); }
    else out.push(`k=${k}: gone (arg ${(a / Math.PI).toFixed(3)}pi)`);
  }
  console.log('t=' + t, out.join('; '));
}
