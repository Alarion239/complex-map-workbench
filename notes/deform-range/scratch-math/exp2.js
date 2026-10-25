require('./load.js');
const X = globalThis.CX, F = globalThis.Funcs, C = X.C;
const build = (type, params) => F.build({ type, params: Object.assign(F.defaults(type), params || {}), on: true });
const sinb = build('sin');
for (const cut of [180, -90]) {
  const sq = build('root', { n: 2, cut });
  const H = (t) => { const h = sq.hom(t); return (z) => sinb.f(h(z)); };
  // Newton continuation of zeros from t=0 (z = k pi) in steps of dt; stop when Newton fails or jumps
  const tracks = [];
  for (const k of [-2, -1, 1, 2]) {
    let z = C(k * Math.PI, 0), t = 0, dt = 1 / 200, end = null;
    const pts = [[0, z]];
    while (t < 1 - 1e-12) {
      const t1 = Math.min(1, t + dt), Ht = H(t1);
      let w = z, ok = false;
      for (let i = 0; i < 30; i++) {
        const f0 = Ht(w), h = 1e-7 * (1 + X.abs(w));
        const d = X.scale(X.sub(Ht(X.add(w, C(h, 0))), Ht(X.sub(w, C(h, 0)))), 1 / (2 * h));
        const step = X.div(f0, d);
        w = X.sub(w, step);
        if (X.abs(step) < 1e-13 * (1 + X.abs(w))) { ok = X.abs(Ht(w)) < 1e-9; break; }
      }
      if (!ok || X.abs(X.sub(w, z)) > 0.5 + 2 * X.abs(z) * dt) { if (dt > 1e-6) { dt /= 4; continue; } end = t; break; }
      z = w; t = t1; pts.push([t, z]); dt = Math.min(1 / 200, dt * 2);
    }
    tracks.push(`k=${k} cut=${cut}: ` + (end !== null ? `ends at t=${end.toFixed(4)} z=${X.fmt(z)} arg=${(Math.atan2(z.im, z.re) * 180 / Math.PI).toFixed(1)}deg` : `reaches t=1 at z=${X.fmt(z)}`));
  }
  console.log(tracks.join('\n'));
}
