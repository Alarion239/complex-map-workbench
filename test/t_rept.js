// A Repeat chain's exact plane (#1472, #1323 PR P): the REPT op (InvOps' REPT section) that stands for n copies of one
// rational step of degree 3, and its CPU twin's search (Inverse.enumerate).
//  1. routing: Newton's step for z^3 - 1 repeated 20 times (gallery 28) is one REPT op; other repeats keep their path;
//     a plan that holds a REPT op and another op is refused with its reason;
//  2. the root certificate: every certified root lies within its radius of a root that an independent float64
//     Durand-Kerner finds; a root set with a duplicate, a far-off root or a chain error past the roots' separation
//     fails;
//  3. the leaf and pixel rules (a constructed unresolved leaf): covered if a leaf covers, empty only when the search ran
//     out with every leaf resolved, unresolved otherwise;
//  4. the forward enclosures E_r: the images of points of the box, iterated in float64, lie in E_r (a sample: a test of
//     the enclosure, never its certificate); a box that holds the pole has no enclosure past E_0; reptDisc likewise;
//  5. the search against brute force: at Repeat x 2 every pixel's verdict equals the one from all 9 chains, unpruned;
//     at Repeat x 20 a box in the basin of 1 is empty outside E_20 with no root solved;
//  6. the budget: REPEAT_NODES_MAX is at least NODES_MARGIN times the most solves a gallery pixel needs, and a starved
//     budget reads unresolved, never empty;
//  7. the GLSL: the chain's inverse program holds the REPT walker.
// node test/t_rept.js [-v]
global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
global.Funcs = require('../src/funcs.js');
global.Region = require('../src/region.js');
const Inverse = require('../src/inverse.js');
const { InvOps } = require('../src/invops.js');
const GLChain = require('../src/glsl.js');
const C = CX.C;
const VERBOSE = process.argv.includes('-v');
let bad = 0, n = 0;
const check = (name, ok, info = '') => { n++; if (!ok) { bad++; console.log('FAIL', name, info); } else if (VERBOSE) console.log('ok  ', name); };
// a seeded stream (mulberry32)
let seed = 20261110;
const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const rf = (a, b) => a + rnd() * (b - a);

const NEWTON = 'z-(z^3-1)/(3*z^2)';
const St = (type, params, repeat) => Object.assign({ type, params: Object.assign(Funcs.defaults(type), params), on: true }, repeat ? { repeat } : {});
const chainOf = (steps) => ({ steps, built: Funcs.applyRepeats(steps, steps.map((s) => Funcs.build(s))) });
const newton = (copies) => chainOf([St('custom', { expr: NEWTON, cut: 180 }, { n: copies, len: 1 })]);
const kinds = (b) => { const r = InvOps.stepOps(b); return r.ok ? r.ops.map((o) => o.kind).join('>') : 'X: ' + r.reason; };

const SQUARE = { id: 'sq', kind: 'rect', a: [-2, -2], b: [2, 2] };          // the gallery example's region
const BITE = { id: 'bt', kind: 'rect', a: [0.6, -0.5], b: [1.6, 0.5] };      // the suite's bite region, in the basin of 1
const WIN = { x0: -4, x1: 4, y0: -3, y1: 3 };
const PIX = 1 / 140;                                                         // the suite's scale
const NODES_MARGIN = 50;                                                     // landconsult's condition: the cap >= 50 x the measured most
const GRID = 41;                                                             // samples per side of the window's grids
const DK_ITER = 400, DK_TOL = 1e-12;                                         // the reference roots: Durand-Kerner in float64
const ORBIT_MAX = 1e12;                                                      // a sample orbit past this is left out (float64 resolves nothing there)

// ---- 1. routing
const N20 = newton(20);
check('Newton x 20 is one REPT op', kinds(N20.built[0]) === 'REPT', kinds(N20.built[0]));
const op20 = InvOps.stepOps(N20.built[0]).ops[0];
check('its P/Q is (2z^3 + 1) / (3z^2) up to a power of 2', (() => {
  const P = op20.p.P, Q = op20.p.Q, k = P[0].re / 2;
  return op20.p.n === 20 && Math.abs(P[3].re / k - 1) < 1e-15 && Math.abs(Q[1].re / k - 3) < 1e-15 && [P[1], P[2], Q[0], Q[2], Q[3]].every((c) => c.re === 0 && c.im === 0);
})());
check(`Newton x ${InvOps.REPEAT_COPIES_MAX + 1} is not REPT (past the stack)`, !/^REPT/.test(kinds(newton(InvOps.REPEAT_COPIES_MAX + 1).built[0])));
check('Newton x 1 is the step itself, not REPT', !/^REPT/.test(kinds(newton(1).built[0])));
check('a cubic polynomial x 3 is REPT', kinds(chainOf([St('poly', { co: '1, 0, 0.5, 0.2' }, { n: 3, len: 1 })]).built[0]) === 'REPT');
check('a degree-2 step x 3 keeps its ops, copy by copy', kinds(chainOf([St('custom', { expr: 'z^2+0.3', cut: 180 }, { n: 3, len: 1 })]).built[0]) === 'IPOW>AFF>IPOW>AFF>IPOW>AFF');
check('deg Q = 3 is not REPT', !/^REPT/.test(kinds(chainOf([St('custom', { expr: '(z^3+1)/(z^3+2)', cut: 180 }, { n: 3, len: 1 })]).built[0])));
check('a block of two steps is not REPT', !/^REPT/.test(kinds(chainOf([St('mul', { c: '2' }), St('custom', { expr: NEWTON, cut: 180 }, { n: 3, len: 2 })]).built[1])));
const AN = chainOf([St('mul', { c: '2' }), St('custom', { expr: NEWTON, cut: 180 }, { n: 20, len: 1 })]);
const planAN = Inverse.planChain(AN.steps, AN.built, 0, 2);
check('a plan with REPT and another op is refused, with its reason', !planAN.ok && /repeated step/.test(planAN.reason), planAN.reason);
check('the REPT plane alone has a plan', Inverse.planChain(AN.steps, AN.built, 1, 2).ok);
const plan20 = Inverse.planChain(N20.steps, N20.built, 0, 1);
check('the gallery plane has a plan', plan20.ok && plan20.ops.length === 1);
check('a REPT plan is not injective, and a point\'s preimages are past the exact cap', !plan20.injective && !Inverse.pointPre(plan20, C(0.3, 0.1)).exact);

// ---- 2. the root certificate
// independent roots of P - v Q: Durand-Kerner in float64 on the monic cubic
function dkRoots(a) {
  const m = a.map((x) => CX.div(x, a[0])), p = (z) => CX.add(CX.mul(CX.add(CX.mul(CX.add(z, m[1]), z), m[2]), z), m[3]);
  let z = [C(0.4, 0.9), C(-0.9, 0.3), C(0.7, -0.6)].map((s) => CX.scale(s, 1 + CX.abs(m[1]) + Math.cbrt(CX.abs(m[3]))));
  for (let it = 0; it < DK_ITER; it++) {
    const nz = z.map((zi, i) => { let d = C(1, 0); z.forEach((zj, j) => { if (j !== i) d = CX.mul(d, CX.sub(zi, zj)); }); return CX.sub(zi, CX.div(p(zi), d)); });
    const mv = Math.max(...nz.map((x, i) => CX.abs(CX.sub(x, z[i]))));
    z = nz;
    if (mv < DK_TOL) break;
  }
  return z;
}
const { P: P20, Q: Q20 } = op20.p;
let certN = 0, inRad = 0, worst = 0;
for (let k = 0; k < 400; k++) {
  const v = rnd() < 0.2 ? C(rf(-1e3, 1e3), rf(-1e3, 1e3)) : C(rf(-4, 4), rf(-4, 4));
  const nd = InvOps.reptNode(P20, Q20, v, 0);
  if (!nd) continue;
  certN++;
  const ref = dkRoots(P20.map((pk, i) => CX.sub(pk, CX.mul(v, Q20[i]))));
  const ok = nd.z.every((z, i) => ref.some((r) => CX.abs(CX.sub(z, r)) <= nd.rho[i]));
  if (ok) inRad++;
  worst = Math.max(worst, ...nd.rho.map((r, i) => r / (1 + CX.abs(nd.z[i]))));
}
check('nearly every node certifies at v up to 1e3 (the certificate is not a refusal)', certN >= 390, `${certN}/400`);
check('every certified root lies within its radius of a float64 root', inRad === certN, `${inRad}/${certN}`);
check('the radii are float32-sized', worst < 1e-5, worst);
{
  const v = C(0.3, 0.2), a = P20.map((pk, i) => CX.sub(pk, CX.mul(v, Q20[i]))), z = InvOps.reptSolve(a);
  check('control: the solver\'s own roots certify', !!InvOps.reptCert(P20, Q20, v, 0, a, z));
  check('control: a duplicated root fails', !InvOps.reptCert(P20, Q20, v, 0, a, [z[0], z[0], z[2]]));
  // (a root moved off by FAR either fails or is certified with a radius that still reaches its root: a true statement)
  const FAR = 0.5, rf0 = InvOps.reptCert(P20, Q20, v, 0, a, [CX.add(z[0], C(FAR, 0)), z[1], z[2]]);
  check('control: a far-off root fails, or its radius reaches its root', !rf0 || rf0[0] >= FAR, rf0 && rf0[0]);
  check('control: a chain error past the roots\' separation fails', !InvOps.reptCert(P20, Q20, v, 1, a, z));
  check('control: a non-finite root fails', !InvOps.reptCert(P20, Q20, v, 0, a, [C(NaN, 0), z[1], z[2]]));
  // at the critical value 1 the roots 1, 1, -1/2 meet: no certificate (the pixel reads unresolved)
  check('control: the double root at the critical value 1 fails', !InvOps.reptNode(P20, Q20, C(1, 0), 0));
}

// ---- 3. the leaf and pixel rules
const { leafUnres, verdict } = Inverse._rept;
const TOL = InvOps.REPT_AA_TOL;
check('a leaf whose edge lies past its error and half a pixel is resolved (covered)', !leafUnres(10, 1));
check('... and (empty)', !leafUnres(-10, 1));
check('a leaf within its error of the edge, the error past REPT_AA_TOL, is unresolved', leafUnres(0.2, 1) && leafUnres(-1.2, 1));
check('a leaf near the edge with an error within REPT_AA_TOL is the ordinary ramp', !leafUnres(0.2, TOL) && !leafUnres(0, TOL / 2));
check('a leaf with no measure of its error is unresolved', leafUnres(0.2, NaN));
const R0 = { fail: false, cap: false, unres: 0 };
check('a pixel with a covering leaf is covered, unresolved leaves or not', verdict(1, Object.assign({}, R0, { unres: 3, fail: true })) === 1);
check('a pixel with no cover and an unresolved leaf is unresolved, never empty', verdict(0, Object.assign({}, R0, { unres: 1 })) === -1);
check('... a failed certificate', verdict(0, Object.assign({}, R0, { fail: true })) === -1);
check('... the node budget', verdict(0, Object.assign({}, R0, { cap: true })) === -1);
check('a pixel whose search ran out with every leaf resolved is empty', verdict(0, R0) === 0);

// ---- 4. the forward enclosures
const Nf = (z) => CX.sub(z, CX.div(CX.sub(CX.mul(CX.mul(z, z), z), C(1, 0)), CX.scale(CX.mul(z, z), 3)));
{
  const E = InvOps.reptEnclose(P20, Q20, 20, { x0: 0.6, x1: 1.6, y0: -0.5, y1: 0.5 });
  check('the bite box has an enclosure at every level', E.every(Boolean));
  let outN = 0, tried = 0;
  for (let k = 0; k < 3000; k++) {
    let z = C(rf(0.6, 1.6), rf(-0.5, 0.5));
    for (let r = 1; r <= 20; r++) {
      z = Nf(z);
      if (!(CX.abs(z) < ORBIT_MAX)) break;
      tried++;
      const e = E[r];
      if (z.re < e.x0 || z.re > e.x1 || z.im < e.y0 || z.im > e.y1) outN++;
    }
  }
  check('every sampled orbit point of the bite box lies in its E_r (sampled: a test, not the certificate)', outN === 0 && tried > 50000, `${outN} of ${tried}`);
  check('E_20 of the bite box is a speck about the root 1', E[20].x1 - E[20].x0 < 1e-6 && E[20].x0 <= 1 && E[20].x1 >= 1, JSON.stringify(E[20]));
  const Es = InvOps.reptEnclose(P20, Q20, 20, { x0: -2, x1: 2, y0: -2, y1: 2 });
  check('the gallery square holds the pole: no enclosure past E_0 (no prune)', Es[0] && Es.slice(1).every((e) => e === null));
  let dOut = 0;
  for (let k = 0; k < 200; k++) {
    const c = C(rf(0.8, 1.4), rf(-0.3, 0.3)), rho = rf(1e-4, 0.05), r = 1 + Math.floor(rf(1, 6));
    const d = InvOps.reptDisc(P20, Q20, r, c, rho);
    if (!d) continue;
    for (let j = 0; j < 20; j++) {
      const t = rf(0, 2 * Math.PI), s = Math.sqrt(rnd()) * rho;
      let z = C(c.re + s * Math.cos(t), c.im + s * Math.sin(t));
      for (let q = 0; q < r; q++) z = Nf(z);
      if (CX.abs(CX.sub(z, d.c)) > d.r) dOut++;
    }
  }
  check('reptDisc encloses the sampled image of its disc', dOut === 0, dOut);
}

// ---- 5. the search against brute force
const gridOf = (win, k) => { const out = []; for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) out.push(C(win.x0 + (i + 0.5) * (win.x1 - win.x0) / k, win.y0 + (j + 0.5) * (win.y1 - win.y0) / k)); return out; };
{
  const N2 = newton(2), plan = Inverse.planChain(N2.steps, N2.built, 0, 1), prep = Inverse.prepare(plan, { win: WIN, shape: BITE });
  const L = Region.levelOf(BITE), o = plan.ops[0];
  // brute force: every chain of two backward roots, no prune, the leaf scored at its own point (a leaf within a pixel's
  // ramp of the edge is left out: the twin scores it by the ramp)
  let same = 0, scored = 0, pruned = 0, covered = 0;
  for (const w of gridOf({ x0: 0.5, x1: 1.7, y0: -0.6, y1: 0.6 }, GRID).concat(gridOf(WIN, GRID))) {
    const e = Inverse.enumerate(plan, prep, w, PIX, { leaves: false }).rept;
    pruned += e.pruned;
    let brute = 0, near = false;
    const n1 = InvOps.reptNode(o.p.P, o.p.Q, w, 0);
    for (let i = 0; n1 && i < 3; i++) {
      const n2 = InvOps.reptNode(o.p.P, o.p.Q, n1.z[i], n1.rho[i]);
      for (let k = 0; n2 && k < 3; k++) {
        const z = n2.z[k], d = CX.mul(n1.d[i], n2.d[k]), lv = L(z) / (CX.abs(d) * PIX);
        if (Math.abs(lv) <= 1) near = true;
        if (lv > 0) brute = 1;
      }
    }
    if (near) continue;
    scored++; covered += brute;
    if (e.verdict === brute) same++;
  }
  check('Repeat x 2: every pixel\'s verdict equals the unpruned brute force over its 9 chains', same === scored && scored > 2000, `${same}/${scored}`);
  check('... over both covered and empty pixels', covered > 20 && covered < scored - 20, covered);
  check('... with children pruned through E_r', pruned > 1000, pruned);
  const prep20 = Inverse.prepare(plan20, { win: WIN, shape: BITE });
  const far = Inverse.enumerate(plan20, prep20, C(-1.3, 0.8), PIX, { leaves: false }).rept;
  check('Repeat x 20, bite box: a pixel outside E_20 is empty with no root solved', far.verdict === 0 && far.nodes === 0 && far.pruned === 1, JSON.stringify(far));
}

// ---- 6. the budget
{
  const prep = Inverse.prepare(plan20, { win: WIN, shape: SQUARE });
  let most = 0, unres = 0, cov = 0, starvedEmpty = 0, starvedUnres = 0;
  const pts = gridOf(WIN, GRID);
  for (const w of pts) {
    const e = Inverse.enumerate(plan20, prep, w, PIX, { leaves: false }).rept;
    most = Math.max(most, e.nodes); if (e.verdict < 0) unres++; if (e.verdict > 0) cov++;
    const s = Inverse.enumerate(plan20, prep, w, PIX, { leaves: false, reptNodes: 5 }).rept;
    if (s.verdict === 0) starvedEmpty++; if (s.verdict < 0) starvedUnres++;
  }
  check('the gallery square: every pixel covered, none unresolved', cov === pts.length && unres === 0, `${cov}/${pts.length}, ${unres} unresolved`);
  check(`REPEAT_NODES_MAX is at least ${NODES_MARGIN} x the most solves a gallery pixel needs`, InvOps.REPEAT_NODES_MAX >= NODES_MARGIN * most, `${InvOps.REPEAT_NODES_MAX} vs ${most}`);
  check('control: a starved budget reads unresolved, never empty', starvedUnres === pts.length && starvedEmpty === 0, `${starvedUnres} unresolved, ${starvedEmpty} empty`);
}

// ---- 7. the GLSL
{
  const inv = GLChain.buildInverse(N20.steps, N20.built);
  check('the inverse program holds the REPT walker and its stack', inv.ok && /#define IX_REPT 1/.test(inv.lib) && /ix0_node\(/.test(inv.lib) && /ixRI\[/.test(inv.walker), inv.reason);
  const vals = new Float32Array(4 * inv.slots);
  inv.fill(vals);
  check('its cells: n, then P and Q', vals[0] === 20 && vals[4] === Math.fround(P20[0].re) && vals[11] === Math.fround(P20[3].im) && vals[14] === Math.fround(Q20[1].re), Array.from(vals.slice(0, 20)).join(','));
}

console.log(`t_rept: ${n - bad}/${n} passed`);
process.exit(bad ? 1 : 0);
