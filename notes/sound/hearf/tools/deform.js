// node tools/deform.js: for each function of options.html, the deformation H_t = (1 − t) z + t F(z) seen from the
// gesture's still probe and loop: when arg H_t(probe) turns fastest (the zero passing), how much it turns in all, and
// the loop's winding number W(t) at every step of 0.005 (where it steps).
const C = require('../proto/core.js');
for (const fn of C.FUNCS) {
  const D = fn.deform, pr = new C.Probe(); let best = { r: 0, t: 0 }, phi0 = null;
  for (let k = 0; k <= 2000; k++) { const t = k / 2000; pr.move(fn, D.probe[0], D.probe[1], t, t * 5, 80); if (phi0 === null) phi0 = pr.phi; if (!pr.first && pr.rate > best.r) best = { r: pr.rate, t }; }
  const turns = pr.phi - phi0;
  const steps = []; let Wp = null;
  for (let k = 1; k <= 200; k++) { const t = k / 200; const sp = C.curveSpectrum(fn, t, C.circlePts(D.loop, 256), 256); const W = sp && sp.ok ? sp.W : 'cut'; if (W !== Wp) { steps.push(t.toFixed(3) + ':' + W); Wp = W; } }
  console.log(fn.id.padEnd(5), 'probe: fastest turn at t =', best.t.toFixed(3), '(', best.r.toFixed(2), 'turn/s ), total', turns.toFixed(3), 'turns | loop W(t):', steps.join(' '));
}
