'use strict';
// The exact image reference (test/lib/land_exact_core.js) on a synthetic frame whose map is H(z) = z^2 + z^3 / 10 over the w plane's box, whose one critical point
// of H beside the box is z = 0 (a simple one: H'(0) = 0, H''(0) = 2). Its two members near 0 merge there and are drawn at the heights +-Re z over a w place. The
// reference must decide every cell without failure and certify the critical point; the controls that must fail it:
// - the branch point moved BRANCH_CTL lattice cells (the move is in units of the failing cell: one cell leaves the point inside the cluster of suspect cells in so small a frame);
// - a Lipschitz bound taken far under the sampled one (the midpoints between the samples exceed it);
// - a singular point declared beside the certificate's disc;
// - a member removed from each scope of the completeness count.
//   node test/t_land_exact_core.js
const fs = require('fs'), path = require('path');
const { refImage, run } = eval(fs.readFileSync(path.join(__dirname, 'lib', 'land_exact_core.js'), 'utf8'));
let fails = 0;
const ok = (name, cond, got) => { if (!cond) { fails++; console.log('FAIL ' + name, got === undefined ? '' : JSON.stringify(got).slice(0, 400)); } };
const BOX = { x0: -1, x1: 1, y0: -1, y1: 1 }, SIZE = 60, CTL_SAFE = 0.01, BRANCH_CTL = 30, SING_AT = 1e-12, RISE = 8, SEED_ITERS = 40;
const cm = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const H = (z) => { const z2 = cm(z, z), z3 = cm(z2, z); return [z2[0] + z3[0] / 10, z2[1] + z3[1] / 10]; };
const dH = (z) => { const z2 = cm(z, z); return [2 * z[0] + 0.3 * z2[0], 2 * z[1] + 0.3 * z2[1]]; };
const root = (w, sgn) => {   // the member of w on the branch of sqrt(w) with the sign sgn, refined by Newton
  const r = Math.hypot(w[0], w[1]), th = Math.atan2(w[1], w[0]);
  let z = [sgn * Math.sqrt(r) * Math.cos(th / 2), sgn * Math.sqrt(r) * Math.sin(th / 2)];
  for (let k = 0; k < SEED_ITERS; k++) {
    const f = H(z), d = dH(z), res = [f[0] - w[0], f[1] - w[1]], den = d[0] * d[0] + d[1] * d[1];
    if (den < 1e-300) break;
    z = [z[0] - (res[0] * d[0] + res[1] * d[1]) / den, z[1] - (res[1] * d[0] - res[0] * d[1]) / den];
  }
  return z;
};
const frameOf = (extra) => Object.assign({
  box: BOX, W2: SIZE, H2: SIZE, all: false,
  enumAt: (ws) => ws.map((w) => [1, -1].map((s) => { const z = root(w, s); return { z, lam: null, h: z[0], sheet: 0, front: false }; }).map((m, _, a) => Object.assign(m, { front: m.h >= Math.max(...a.map((q) => q.h)) }))),
  hom: (z) => [{ H: H(z), dH: dH(z), cut: false }],
  project: (x, y, h) => [(x - BOX.x0) / (BOX.x1 - BOX.x0) * SIZE + RISE * h, (y - BOX.y0) / (BOX.y1 - BOX.y0) * SIZE],
  mask: () => null, layers: null,
  count: () => [],
}, extra || {});
const go = (frame, opts) => run(refImage(frame, opts));
const base = go(frameOf(), {});
ok('the reference decides every cell of the synthetic frame', base.failures.length === 0, base.failures.slice(0, 3));
ok('the critical point z = 0 of H is certified as a simple one of degree 2', base.certs.length === 1 && base.certs[0].d === 2 && Math.hypot(...base.certs[0].c) < 1e-6, base.certs);
const moved = go(frameOf(), { branch: BRANCH_CTL });
ok('the control: the branch point moved one cell fails the reference', moved.failures.some((f) => f.kind === 'branch' || f.kind === 'cellDepth'), moved.failures.slice(0, 3));
const lip = go(frameOf(), { CERT_LIP_SAFE: CTL_SAFE });
ok('the control: a Lipschitz bound far under the sampled one fails the certificate by the midpoints', lip.failures.some((f) => /midpoints between the samples/.test(f.why || '')), lip.failures.slice(0, 3));
const sing = go(frameOf({ sing: () => [{ sheet: 0, z: [SING_AT, 0], w: null, kind: 'pole' }] }), {});
ok('the control: a singular point declared beside the disc refuses the certificate', sing.failures.some((f) => /declared singular point/.test(f.why || '')), sing.failures.slice(0, 3));
// (the completeness count at each scope: a count that finds one member fewer fails, and one that finds them all passes)
const counts = [];
const countFrame = frameOf({ count: (w, o) => { counts.push(w); return [{ sheet: 0, N: 2, P: 0, members: o && o.dropOne ? 1 : 2, ok: !(o && o.dropOne), status: 'ok' }]; } });
const plain = go(countFrame, {});
ok('the completeness counts of the synthetic frame hold at the stride, at cells whose members change and beside the critical value', plain.failures.length === 0 && ['stride', 'boundary', 'critical'].every((k) => plain.cells.countedBy && plain.cells.countedBy[k] > 0), { by: plain.cells.countedBy, failures: plain.failures.slice(0, 2) });
for (const scope of ['stride', 'boundary', 'critical']) {
  const c = go(countFrame, { countDrop: scope });
  ok(`the control: a member removed from the ${scope} counts fails a ${scope} count and no other`, c.failures.length > 0 && c.failures.every((f) => f.kind === 'count' && f.scope === scope), c.failures.slice(0, 2));
}
// (the carried surface's domain: the members outside it are not drawn; with the domain ignored the reference draws more, the control)
const DOMAIN_R = 0.3;
const inDomain = (z) => Math.hypot(z[0], z[1]) <= DOMAIN_R;
const clipped = go(frameOf({ domain: inDomain }), {}), unclipped = go(frameOf({ domain: inDomain }), { domainOff: true });
const count = (r) => r.px.reduce((a, b) => a + b, 0);
ok('the reference keeps only the members inside the carried surface\'s domain', count(clipped) > 0 && count(clipped) < count(base) / 2, { clipped: count(clipped), all: count(base) });
ok('the control: with the domain ignored the reference draws the members outside it too', count(unclipped) === count(base), { unclipped: count(unclipped), all: count(base) });
if (fails) { console.log(fails + ' failed'); process.exit(1); }
console.log('ok');
