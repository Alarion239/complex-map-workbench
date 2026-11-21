// The Böttcher coordinate at c = -1 (#1438): over each w on the real axis, |w| from 1.05 to 1.3, the Newton plan of its homotopy
// H_t(z) = (1 - t) z + t f(z) has a member exactly when H_t takes the value w at a real z (past the fixed point beta = (1 + sqrt 5) / 2
// at which the external ray at angle 0 lands, and past -beta likewise). H_t is real there; its least value on the ray is
// about 1.31 at t = 0.5, so a real w below that has no preimage, while at t = 1 - END every w outside the unit circle has one.
// A scan of the real z gives the gap between H_t and w; the plan has one member where the gap is under PREIMAGE_TOL, none where it
// is not.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js).
// Prints {pass, fails, info}.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const BASE = `http://localhost:${PORT}`;
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const END = 1e-4, TS = [1 - END, 0.5];            // the homotopy's t: 1 - END and 0.5
const READY_MS = 60000;
const STEP = { type: 'bottcher', params: { c: '-1', N: 64 } };
const ON_AXIS = [[1.05, 0], [-1.05, 0], [1.3, 0], [-1.3, 0]];   // w on the real axis, |w| from 1.05 to 1.3
const Z_SCAN = { from: 1.62, to: 6, step: 0.0005 }, PREIMAGE_TOL = 2e-3;   // the real z scanned for a preimage of w, and how near H_t(z) must come
await view(1440, 900, false, false);
const ns = 'ba' + Date.now();
await go(`${BASE}/gl-helpers.html`);
await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify({ v3: true, v4: true, v5: true, v6: true, shapes: [], steps: [Object.assign({ on: true }, STEP)], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 60 } }))}); 1`);
await go(`${BASE}/test.html?ns=${ns}&lang=en&view=steps`);
await settled({ max: READY_MS, until: 'typeof __cmwSteps === "function" && !!window.Inverse && !!window.Funcs' });
const r = await ev(`(() => {
  const b = Funcs.build(${JSON.stringify(STEP)}), out = [];
  for (const t of ${JSON.stringify(TS)}) {
    const op = Inverse.homOps(b, t).ops[0];
    for (const [re, im] of ${JSON.stringify(ON_AXIS)}) {
      // the least distance from w to H_t at the real z scanned in the direction of w
      let best = Infinity;
      for (let z = ${Z_SCAN.from}; z <= ${Z_SCAN.to}; z += ${Z_SCAN.step}) { const x = Math.sign(re) * z, v = b.f({ re: x, im: 0 }); best = Math.min(best, Math.hypot((1 - t) * x + t * v.re - re, t * v.im - im)); }
      out.push({ t, w: [re, im], members: op.pre({ re, im }).length, gap: +best.toFixed(5) });
    }
  }
  return out;
})()`);
info.points = r;
for (const p of r) ok(`t = ${p.t}, w = ${p.w}: the plan has ${p.gap <= PREIMAGE_TOL ? 'one member' : 'no member'} (H_t ${p.gap <= PREIMAGE_TOL ? 'takes' : 'does not take'} the value on the real axis)`, p.members === (p.gap <= PREIMAGE_TOL ? 1 : 0), p);
return { pass: fails.length === 0, fails, info };
