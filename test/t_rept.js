// A Repeat chain's exact plane (#1472, #1323): the REPT op (InvOps' REPT section) that stands for n copies of one
// rational step of degree 3, and its CPU twin's search (Inverse.enumerate).
//  1. routing: Newton's step for z^3 - 1 repeated 20 times (gallery 28) is one REPT op, and so is a catalog step of
//     degree 3 (Integer power z^3, a coprime rational step, zeros and poles), the same op as its formula's; other
//     repeats (a P/Q that is not coprime among them) keep their path;
//     a repeat next to another step plans its copies: exactly when they are few, too long for a plan (tooLong) when
//     they are many; a plane range that holds the repeat alone plans it as REPT, with an inverse program of its own;
//  2. the root certificate: every certified root lies within its radius of a root that an independent float64
//     Durand-Kerner finds; a root set with a duplicate, a far-off root or a chain error past the roots' separation
//     fails;
//  3. the leaf and pixel rules (a constructed unresolved leaf): covered if a leaf covers, empty only when the search ran
//     out with every leaf resolved, unresolved otherwise;
//  4. the forward enclosures E_r: the images of points of the box, iterated in float64, lie in E_r (a sample: a test of
//     the enclosure, never its certificate); a box that holds the pole has no enclosure past E_0; reptDisc likewise;
//  4b. the escape set (deg P >= deg Q + 2): REPT_ESC_R passes its bound with every term rounded against it, and half of
//     it does not (the control); |R(z)| >= REPT_ESC_GROW |z| at sampled |z| >= REPT_ESC_R (a test, never the
//     certificate); Newton's step has none; z^3 x 20 on a disc off the unit circle is empty with no root solved at every
//     pixel; at Repeat x 2 with escaped cells every pixel's verdict equals the brute force over its 9 chains;
//  4c. the radius bound (a monomial step on a disc region): z^3 x 20 on a disc tangent to |z| = 1 from inside is empty
//     with no root solved past |w| = 1, never empty inside it, E_r bounded by |z| <= ~1; a disc strictly inside and one
//     across |z| = 1 as before; at Repeat x 2 every pixel's verdict equals the brute force;
//  4d. the closed form (a monomial step on a disc region): z^3 x 20 on discs tangent to, across, holding 0 and holding
//     the whole of |z| = 1, and 2 z^3 x 20 tangent to its circle |z| = 2^-1/2: every pixel off the circle (past the
//     pixel's reach) has its verdict with no root solved, the unresolved ones lie in the reach band about the circle,
//     and the search alone agrees wherever it resolves; at Repeat x 2 and x 3 every pixel's verdict equals the brute
//     force over its chains, and the search's within half a pixel of each boundary circle;
//  5. the search against brute force: at Repeat x 2 every pixel's verdict equals the one from all 9 chains, unpruned;
//     at Repeat x 20 a box in the basin of 1 is empty outside E_20 with no root solved;
//  6. the budget: REPEAT_NODES_MAX is at least NODES_MARGIN times the most solves a gallery pixel needs, and a starved
//     budget reads unresolved, never empty;
//  7. the GLSL: the chain's inverse program holds the REPT walker, a loop with no continue and no stack index that can be
//     negative. These two source rows are proxies for Direct3D's compiler fault: they guard the shape of code it
//     miscompiled, which this machine's GL does not reproduce; the evidence for the fault itself is the Gate's Windows
//     GLSL job.
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
// (a catalog step whose rational form is of degree 3, deg P > deg Q: the same REPT op as its formula's)
const opOf = (st) => { const r = InvOps.stepOps(chainOf([st]).built[0]); return r.ok && r.ops.length === 1 ? r.ops[0] : null; };
// (the same map: P and Q equal up to one factor, the leading coefficients' ratio; each scaled by a power of 2 near 1)
const sameOp = (a, c) => {
  if (!a || !c || a.kind !== 'REPT' || c.kind !== 'REPT' || a.p.n !== c.p.n) return false;
  const k = CX.div(a.p.P[0], c.p.P[0]), xs = [...a.p.P, ...a.p.Q], ys = [...c.p.P, ...c.p.Q];
  return xs.every((x, i) => CX.abs(CX.sub(x, CX.mul(k, ys[i]))) < 1e-14) && xs.every((x) => CX.abs(x) < 2) && Math.max(...xs.map(CX.abs)) > 0.5;
};
check('Integer power z^3 x 20 (a catalog step) is one REPT op, the one z^3 written as a formula has', sameOp(opOf(St('pown', { n: 3 }, { n: 20, len: 1 })), opOf(St('custom', { expr: 'z^3', cut: 180 }, { n: 20, len: 1 }))), kinds(chainOf([St('pown', { n: 3 }, { n: 20, len: 1 })]).built[0]));
check('a rational step of degree 3 (deg q < 3) x 3 is the REPT op of its formula', sameOp(opOf(St('rational', { p: '1, 0, 0, 0.5', q: '1, 0.3' }, { n: 3, len: 1 })), opOf(St('custom', { expr: '(z^3+0.5)/(z+0.3)', cut: 180 }, { n: 3, len: 1 }))), kinds(chainOf([St('rational', { p: '1, 0, 0, 0.5', q: '1, 0.3' }, { n: 3, len: 1 })]).built[0]));
check('zeros and poles of degree 3 (zeros 1, -1, 2; pole 0) x 3 is the REPT op of its formula', sameOp(opOf(St('zp', { a: '1', zeros: '1, -1, 2', poles: '0' }, { n: 3, len: 1 })), opOf(St('custom', { expr: '(z-1)*(z+1)*(z-2)/z', cut: 180 }, { n: 3, len: 1 }))), kinds(chainOf([St('zp', { a: '1', zeros: '1, -1, 2', poles: '0' }, { n: 3, len: 1 })]).built[0]));
check('a P/Q that is not coprime ((z^3 - z)/z, degree 2 in fact) x 3 is not REPT', !/^REPT/.test(kinds(chainOf([St('rational', { p: '1, 0, -1, 0', q: '1, 0' }, { n: 3, len: 1 })]).built[0])), kinds(chainOf([St('rational', { p: '1, 0, -1, 0', q: '1, 0' }, { n: 3, len: 1 })]).built[0]));
check('Integer power z^2 x 3 keeps its ops, copy by copy', kinds(chainOf([St('pown', { n: 2 }, { n: 3, len: 1 })]).built[0]) === 'IPOW>IPOW>IPOW', kinds(chainOf([St('pown', { n: 2 }, { n: 3, len: 1 })]).built[0]));
check('Integer power z^-3 x 3 is not REPT (deg Q = 3)', !/^REPT/.test(kinds(chainOf([St('pown', { n: -3 }, { n: 3, len: 1 })]).built[0])));
check('a degree-2 step x 3 keeps its ops, copy by copy', kinds(chainOf([St('custom', { expr: 'z^2+0.3', cut: 180 }, { n: 3, len: 1 })]).built[0]) === 'IPOW>AFF>IPOW>AFF>IPOW>AFF');
check('deg Q = 3 is not REPT', !/^REPT/.test(kinds(chainOf([St('custom', { expr: '(z^3+1)/(z^3+2)', cut: 180 }, { n: 3, len: 1 })]).built[0])));
check('a block of two steps is not REPT', !/^REPT/.test(kinds(chainOf([St('mul', { c: '2' }), St('custom', { expr: NEWTON, cut: 180 }, { n: 3, len: 2 })]).built[1])));
// (a repeat next to another step: its copies make the plan, as any other repeat's, so a short one plans exactly and a
// long one is too long for a plan (tooLong: the no-value hatch's case); one REPT op stands for a repeat only as the
// plane's one step)
const AN = chainOf([St('mul', { c: '2' }), St('custom', { expr: NEWTON, cut: 180 }, { n: 20, len: 1 })]);
const planAN = Inverse.planChain(AN.steps, AN.built, 0, 2);
check('Newton x 20 after x 2 is too long for a plan, not REPT', !planAN.ok && planAN.tooLong === true && planAN.reason === 'chain too long', planAN.reason);
// (a plane range that holds the repeat alone plans it as one REPT op, with an inverse program of its own: the repeat's
// own plane (1, 2] here, and plane 1 of a chain where the repeat comes first)
const planAN12 = Inverse.planChain(AN.steps, AN.built, 1, 2);
check('... and its plane (1, 2] alone plans as REPT', planAN12.ok && planAN12.ops.map((o) => o.kind).join('>') === 'REPT', planAN12.ok ? planAN12.ops.map((o) => o.kind).join('>') : planAN12.reason);
const NA = chainOf([St('custom', { expr: NEWTON, cut: 180 }, { n: 20, len: 1 }), St('mul', { c: '2' })]);
const planNA01 = Inverse.planChain(NA.steps, NA.built, 0, 1), planNA02 = Inverse.planChain(NA.steps, NA.built, 0, 2);
check('Newton x 20, then x 2: plane 1 plans as REPT, plane 2 is too long for a plan', planNA01.ok && planNA01.ops.map((o) => o.kind).join('>') === 'REPT' && !planNA02.ok && planNA02.tooLong === true, [planNA01.reason, planNA02.reason]);
const planKinds = (steps) => { const c = chainOf(steps), p = Inverse.planChain(c.steps, c.built, 0, steps.length); return p.ok ? p.ops.map((o) => o.kind).join('>') : `X: ${p.reason}${p.tooLong ? ' (tooLong)' : ''}`; };
const TIMES2 = St('mul', { c: '2' });
const NEXT_TO = [
  ['Integer power z^3 x 3, then x 2', [St('pown', { n: 3 }, { n: 3, len: 1 }), TIMES2], 'IPOW>IPOW>IPOW>AFF'],
  ['x 2, then Integer power z^3 x 10', [TIMES2, St('pown', { n: 3 }, { n: 10, len: 1 })], 'AFF' + '>IPOW'.repeat(10)],
  ['the formula z^3 x 3, then x 2', [St('custom', { expr: 'z^3', cut: 180 }, { n: 3, len: 1 }), TIMES2], 'IPOW>IPOW>IPOW>AFF'],
  ['Integer power z^3 x 20, then x 2', [St('pown', { n: 3 }, { n: 20, len: 1 }), TIMES2], 'X: chain too long (tooLong)'],
  ['x 2, then Integer power z^3 x 20', [TIMES2, St('pown', { n: 3 }, { n: 20, len: 1 })], 'X: chain too long (tooLong)'],
  ['the formula z^3 x 20, then x 2', [St('custom', { expr: 'z^3', cut: 180 }, { n: 20, len: 1 }), TIMES2], 'X: chain too long (tooLong)'],
  ['a rational step of degree 3 x 20, then x 2', [St('rational', { p: '1, 0, 0, 0.5', q: '1, 0.3' }, { n: 20, len: 1 }), TIMES2], 'X: chain too long (tooLong)'],
  ['zeros and poles of degree 3 x 20, then x 2', [St('zp', { a: '1', zeros: '1, -1, 2', poles: '0' }, { n: 20, len: 1 }), TIMES2], 'X: chain too long (tooLong)'],
];
for (const [name, steps, want] of NEXT_TO) check(`${name}: ${want}`, planKinds(steps) === want, planKinds(steps));
check('a rational step of degree 3 x 3, then x 2, has a plan with no REPT op', !/REPT|^X/.test(planKinds([St('rational', { p: '1, 0, 0, 0.5', q: '1, 0.3' }, { n: 3, len: 1 }), TIMES2])), planKinds([St('rational', { p: '1, 0, 0, 0.5', q: '1, 0.3' }, { n: 3, len: 1 }), TIMES2]));
check('Integer power z^3 x 20 alone plans as REPT', planKinds([St('pown', { n: 3 }, { n: 20, len: 1 })]) === 'REPT', planKinds([St('pown', { n: 3 }, { n: 20, len: 1 })]));
// (a point's plan, Inverse.pointPlan, decomposes each step as the chain's plans do; a step standing for its homotopy,
// Inverse.homBuilt, with a REPT op next to another step's op is refused: the walkers' REPT search is the plan's only op)
{
  const c = chainOf([TIMES2, St('pown', { n: 3 }, { n: 3, len: 1 })]), pp = Inverse.pointPlan(c.steps, c.built, 0, 2);
  check('x 2, then Integer power z^3 x 3: its point plan is AFF>IPOW>IPOW>IPOW, as its plan', pp.ok && pp.ops.map((o) => o.kind).join('>') === 'AFF>IPOW>IPOW>IPOW', pp.ok ? pp.ops.map((o) => o.kind).join('>') : pp.reason);
  const solo = chainOf([St('pown', { n: 3 }, { n: 20, len: 1 })]), hk = InvOps.stepOps(solo.built[0]);
  const hb = [c.built[0], Inverse.homBuilt(solo.built[0], hk)], hp = Inverse.planChain([c.steps[0], solo.steps[0]], hb, 0, 2);
  check('a homotopy stand-in carrying a REPT op next to x 2 is refused, with its reason', hk.ok && hk.ops[0].kind === 'REPT' && !hp.ok && /only as the plane's one step/.test(hp.reason), hp.reason);
}
// (each plan's ops are ops of the chain's GLSL inverse program, by step, node and kind, as the GPU's pass data reads them:
// a plane's plan and the program decompose a repeat the same way; a chain too long for a program has none to match)
{
  const chains = NEXT_TO.map(([name, steps]) => [name, steps]).concat([['Integer power z^3 x 20 alone', [St('pown', { n: 3 }, { n: 20, len: 1 })]],
    ['Integer power z^3 x 3, then x 2, on plane 1', [St('pown', { n: 3 }, { n: 3, len: 1 }), TIMES2], 1]]);
  let plans = 0;
  const wrong = [];
  for (const [name, steps, top = steps.length] of chains) {
    const c = chainOf(steps);
    for (let a = 0; a < top; a++) {
      const p = Inverse.planChain(c.steps, c.built, a, top), inv = GLChain.buildInverse(c.steps, c.built, p.opts);
      if (!p.ok) continue;
      plans++;
      if (inv.ok && !p.ops.every((o) => inv.ops.some((q) => q.step === o.step && q.node === o.node && q.kind === o.kind))) wrong.push(`${name} (${a}, ${top}]`);
    }
  }
  check('every plan\'s ops are ops of the GLSL inverse program for its options (step, node, kind)', plans >= 6 && wrong.length === 0, `${plans} plans, ${JSON.stringify(wrong)}`);
  // (a lone repeat's plan needs a program other than the chain's: the chain's holds the repeat's copies)
  const c = chainOf([TIMES2, St('pown', { n: 3 }, { n: 3, len: 1 })]), p = Inverse.planChain(c.steps, c.built, 1, 2), own = GLChain.buildInverse(c.steps, c.built);
  check('x 2, then z^3 x 3: plane (1, 2] plans REPT, an op the chain\'s own program does not hold', p.ok && p.ops[0].kind === 'REPT' && own.ok && !own.ops.some((q) => q.kind === 'REPT'), p.ok ? p.ops.map((o) => o.kind).join('>') : p.reason);
  // (a range whose one live step is not a repeat with a REPT form keeps the chain's options: no program of its own, even
  // when the chain holds such a repeat elsewhere)
  const p1 = Inverse.planChain(c.steps, c.built, 0, 1), plain = chainOf([TIMES2, St('add', { c: '1' })]), p2 = Inverse.planChain(plain.steps, plain.built, 1, 2);
  check('x 2, then z^3 x 3: plane 1 (x 2 alone) and plane (1, 2] of x 2, then + 1 keep their chain\'s options', p1.ok && p1.opts.rept === Inverse.chainOpts(c.steps, c.built).rept && p2.ok && p2.opts.rept === Inverse.chainOpts(plain.steps, plain.built).rept, [p1.opts, p2.opts]);
  const ezx = chainOf([St('exp', {}), St('pown', { n: 3 }, { n: 3, len: 1 }), TIMES2]), ch = Inverse.chainOpts(ezx.steps, ezx.built);
  const [e01, e12, e23] = [[0, 1], [1, 2], [2, 3]].map(([a, b]) => Inverse.planChain(ezx.steps, ezx.built, a, b));
  check('exp, then z^3 x 3, then x 2: planes (0, 1] and (2, 3] keep the chain\'s options, (1, 2] plans REPT', e01.ok && e01.opts.rept === ch.rept && e23.ok && e23.opts.rept === ch.rept && e12.ok && e12.ops[0].kind === 'REPT' && e12.opts.rept && !ch.rept, [e01.opts, e12.ok && e12.ops.map((o) => o.kind).join('>'), e23.opts]);
}
// (a chain whose own program cannot be built, its repeat's copies being more ops than a program holds: every plan it has
// draws by a program that builds and holds the plan's ops. A range that holds none of its repeats plans with the
// options whose program holds the repeat as one REPT op; a range that holds the repeat beside another step stays too
// long for a plan)
{
  const NEWT20 = St('custom', { expr: NEWTON, cut: 180 }, { n: 20, len: 1 }), PLUS1 = St('add', { c: '1' });
  const chains = [['x 2, then Newton x 20', [TIMES2, NEWT20]], ['Newton x 20, then x 2', [NEWT20, TIMES2]], ['x 2, then Newton x 20, then + 1', [TIMES2, NEWT20, PLUS1]]];
  let plans = 0;
  const wrong = [], own = [];
  for (const [name, steps] of chains) {
    const c = chainOf(steps);
    own.push(GLChain.buildInverse(c.steps, c.built).ok);
    for (let a = 0; a < steps.length; a++) for (let b = a + 1; b <= steps.length; b++) {
      const p = Inverse.planChain(c.steps, c.built, a, b);
      if (!p.ok) continue;
      plans++;
      const inv = GLChain.buildInverse(c.steps, c.built, p.opts);
      if (!inv.ok || !p.ops.every((o) => inv.ops.some((q) => q.step === o.step && q.node === o.node && q.kind === o.kind))) wrong.push(`${name} (${a}, ${b}]: ${inv.ok ? 'ops' : inv.reason}`);
    }
  }
  check('control: the chains\' own programs cannot be built (chain too long)', own.every((o) => !o), own);
  // (Inverse.programOps counts a program's ops as GLChain.buildInverse does, which builds it exactly when the count is at
  // most Inverse.OPS_MAX: rangeOpts decides by it)
  const counts = [];
  for (const [name, steps] of chains.concat([['x 2, then z^3 x 3', [TIMES2, St('pown', { n: 3 }, { n: 3, len: 1 })]]])) {
    const c = chainOf(steps);
    for (const opts of [Inverse.chainOpts(c.steps, c.built), { rept: true }]) {
      const count = Inverse.programOps(c.steps, c.built, opts).n, inv = GLChain.buildInverse(c.steps, c.built, opts);
      if (inv.ok !== (count <= Inverse.OPS_MAX) || (inv.ok && inv.ops.filter((o) => o.kind !== 'X').length !== count)) counts.push(`${name} ${JSON.stringify(opts)}: ${count}, ${inv.ok ? inv.ops.length : inv.reason}`);
    }
  }
  check('Inverse.programOps counts a program\'s ops as GLChain.buildInverse does: it builds exactly when the count is at most OPS_MAX', counts.length === 0, counts);
  check('a chain whose own program cannot be built: each of its plans has a program that builds and holds the plan\'s ops', plans === 7 && wrong.length === 0, `${plans} plans, ${JSON.stringify(wrong)}`);
  const p01 = Inverse.planChain(AN.steps, AN.built, 0, 1);
  check('x 2, then Newton x 20: plane 1 (x 2 alone) plans AFF with the REPT options; plane 2 stays too long for a plan', p01.ok && p01.ops.map((o) => o.kind).join('>') === 'AFF' && p01.opts.rept === true && !planAN.ok && planAN.tooLong === true, [p01.ok ? p01.ops.map((o) => o.kind).join('>') : p01.reason, p01.opts]);
  // (two such repeats: a program holds one REPT search, so the range between them keeps the chain's options)
  const two = chainOf([NEWT20, TIMES2, NEWT20]), p12 = Inverse.planChain(two.steps, two.built, 1, 2);
  check('Newton x 20, x 2, Newton x 20: plane (1, 2] keeps the chain\'s options (one REPT op to a program)', p12.ok && p12.opts.rept === Inverse.chainOpts(two.steps, two.built).rept, p12.opts);
}
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
  // the refined radius (the other roots' share taken out) is never above the crude n |p/p'| one
  let refined = 0, above = 0;
  for (let k = 0; k < 200; k++) {
    const v = C(rf(-4, 4), rf(-4, 4)), a = P20.map((pk, i) => CX.sub(pk, CX.mul(v, Q20[i]))), rho = InvOps.reptCert(P20, Q20, v, rf(0, 1e-4), a, InvOps.reptSolve(a));
    if (!rho) continue;
    rho.forEach((r, i) => { if (r < rho.crude[i]) refined++; if (!(r <= rho.crude[i])) above++; });
  }
  check('every refined radius is at most its crude one, and refining shrinks them', above === 0 && refined > 300, `${above} above, ${refined} smaller`);
}
{
  const v = C(0.3, 0.2), a = P20.map((pk, i) => CX.sub(pk, CX.mul(v, Q20[i]))), z = InvOps.reptSolve(a);
  check('control: the solver\'s own roots certify', !!InvOps.reptCert(P20, Q20, v, 0, a, z));
  check('control: a duplicated root fails', !InvOps.reptCert(P20, Q20, v, 0, a, [z[0], z[0], z[2]]));
  check('control: a root perturbed onto another\'s disc fails', !InvOps.reptCert(P20, Q20, v, 0, a, [z[0], CX.add(z[0], C(1e-6, 0)), z[2]]));
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

// ---- 4b. the escape set
const gridOf = (win, k) => { const out = []; for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) out.push(C(win.x0 + (i + 0.5) * (win.x1 - win.x0) / k, win.y0 + (j + 0.5) * (win.y1 - win.y0) / k)); return out; };
const ESC_SAMPLES = 4000;                                                    // sampled |z| >= R per map
const ESC_FAR = 64;                                                          // ... out to ESC_FAR R
const ESC_DISC = { id: 'ed', kind: 'disc', c: [1.5, 0], r: 0.1 };            // landconsult's worst case for z^3 x 20
const repOf = (expr, copies) => chainOf([St('custom', { expr, cut: 180 }, { n: copies, len: 1 })]);
const planOf = (ch) => Inverse.planChain(ch.steps, ch.built, 0, 1);
// a pixel's verdict from every chain of two backward roots, no prune, each leaf scored at its own point; null when a
// leaf lies within a pixel's ramp of the edge (the twin scores those by the ramp)
const brute2 = (o, L, w) => {
  let brute = 0;
  const n1 = InvOps.reptNode(o.p.P, o.p.Q, w, 0);
  for (let i = 0; n1 && i < 3; i++) {
    const n2 = InvOps.reptNode(o.p.P, o.p.Q, n1.z[i], n1.rho[i]);
    for (let k = 0; n2 && k < 3; k++) {
      const lv = L(n2.z[k]) / (CX.abs(CX.mul(n1.d[i], n2.d[k])) * PIX);
      if (Math.abs(lv) <= 1) return null;
      if (lv > 0) brute = 1;
    }
  }
  return brute;
};
{
  for (const expr of ['z^3', 'z^3-0.5', 'z^3+0.3+0.5i', 'z^3/(z+2)']) {
    const o = planOf(repOf(expr, 20)).ops[0], R = o && o.p.escR;
    check(`${expr}: one REPT op with an escape radius`, o && o.kind === 'REPT' && R > 0, R);
    if (!(R > 0)) continue;
    check(`${expr}: its bound holds at REPT_ESC_R, rounded against it`, InvOps.reptEscF(o.p.P, o.p.Q, R) > 0);
    check(`${expr}: control: half of it fails the bound`, !(InvOps.reptEscF(o.p.P, o.p.Q, R / 2) > 0));
    const Rf = (z) => CX.div(o.p.P.reduce((a, c) => CX.add(CX.mul(a, z), c), C(0, 0)), o.p.Q.reduce((a, c) => CX.add(CX.mul(a, z), c), C(0, 0)));
    let low = 0;
    for (let k = 0; k < ESC_SAMPLES; k++) {
      const m = R * Math.exp(rf(0, Math.log(ESC_FAR))), t = rf(0, 2 * Math.PI), z = C(m * Math.cos(t), m * Math.sin(t));
      if (!(CX.abs(Rf(z)) >= InvOps.REPT_ESC_GROW * m)) low++;
    }
    check(`${expr}: |R(z)| >= ${InvOps.REPT_ESC_GROW} |z| at every sampled |z| >= REPT_ESC_R (a test, not the certificate)`, low === 0, low);
  }
  check('Newton\'s step (deg P = deg Q + 1) has no escape radius', op20.p.escR === null, op20.p.escR);
  const plan = planOf(repOf('z^3', 20)), prep = Inverse.prepare(plan, { win: WIN, shape: ESC_DISC });
  let solves = 0, notEmpty = 0;
  const pts = gridOf(WIN, GRID);
  for (const w of pts) {
    const e = Inverse.enumerate(plan, prep, w, PIX, { leaves: false }).rept;
    solves += e.nodes; if (e.verdict !== 0) notEmpty++;
  }
  check('z^3 x 20 on the disc (1.5, 0.1): every pixel empty with no root solved', solves === 0 && notEmpty === 0, `${solves} solves, ${notEmpty} not empty`);
  check('... its E_20 is the escape set alone', prep.rept.E[20] && prep.rept.E[20].empty && prep.rept.E[20].esc > 1e5, JSON.stringify(prep.rept.E[20]));
  const prepNo = Inverse.prepare(Object.assign({}, plan, { ops: [Object.assign({}, plan.ops[0], { p: Object.assign({}, plan.ops[0].p, { escR: null }) })] }), { win: WIN, shape: ESC_DISC });
  check('control: without the escape radius E_20 is the whole plane (nothing prunes)', prepNo.rept.E[20] === null, JSON.stringify(prepNo.rept.E[20]));
  for (const [expr, shape] of [['z^3', { id: 'e1', kind: 'disc', c: [1.2, 0.3], r: 0.15 }], ['z^3-0.5', { id: 'e2', kind: 'rect', a: [1.15, -0.15], b: [1.35, 0.15] }]]) {
    const p2 = planOf(repOf(expr, 2)), pr2 = Inverse.prepare(p2, { win: WIN, shape }), L = Region.levelOf(shape);
    let same = 0, scored = 0, covered = 0, pruned = 0;
    for (const w of gridOf(WIN, GRID)) {
      const e = Inverse.enumerate(p2, pr2, w, PIX, { leaves: false }).rept, b = brute2(p2.ops[0], L, w);
      pruned += e.pruned;
      if (b === null) continue;
      scored++; covered += b;
      if (e.verdict === b) same++;
    }
    check(`${expr} x 2, ${shape.kind} with escaped cells: every pixel's verdict equals the brute force over its 9 chains`, same === scored && scored > 1000 && covered > 20 && covered < scored - 20 && pruned > 100 && pr2.rept.E[2].esc > 0, `${same}/${scored}, ${covered} covered, ${pruned} pruned, esc ${pr2.rept.E[2].esc}`);
  }
}

// ---- 4c. the radius bound (a monomial step on a disc region, #1485)
{
  const TANGENT = { id: 'td', kind: 'disc', c: [0, 0.95], r: 0.05 };          // the disc tangent to |z| = 1 from inside
  const INSIDE = { id: 'ti', kind: 'disc', c: [0, 0.5], r: 0.2 };            // strictly inside |z| < 1
  const ACROSS = { id: 'ta', kind: 'disc', c: [1, 0], r: 0.12 };             // across |z| = 1
  const RW = { x0: -1.6, x1: 1.6, y0: -1.2, y1: 1.2 }, RG = 25;            // the measured view and its grid
  const NEAR = 0.02;                                                         // |w| within this of 1 is left out (the pixel's own reach)
  const ACROSS_SOLVES = 20;                                                  // the most root solves an across pixel needs (measured)
  const pts = gridOf(RW, RG);
  const run = (shape, copies) => {
    const p = planOf(repOf('z^3', copies)), pr = Inverse.prepare(p, { win: RW, shape }), t = { out: 0, outEmpty0: 0, inn: 0, innEmpty: 0, inside: { 1: 0, 0: 0, '-1': 0 }, solves: 0, max: 0 };
    for (const w of pts) {
      const e = Inverse.enumerate(p, pr, w, PIX, { leaves: false }).rept, a = CX.abs(w);
      t.solves += e.nodes; t.max = Math.max(t.max, e.nodes); t.inside[e.verdict]++;
      if (a > 1 + NEAR) { t.out++; if (e.verdict === 0 && e.nodes === 0) t.outEmpty0++; }
      else if (a < 1 - NEAR) { t.inn++; if (e.verdict === 0) t.innEmpty++; }
    }
    return { t, pr };
  };
  const tg = run(TANGENT, 20);
  check('z^3 x 20 on the tangent disc: every pixel with |w| > 1 (past the pixel\'s reach) is empty with no root solved', tg.t.out > 300 && tg.t.outEmpty0 === tg.t.out, JSON.stringify(tg.t));
  check('... and no pixel with |w| < 1 reads empty (each holds a chain into the disc)', tg.t.inn > 200 && tg.t.innEmpty === 0, JSON.stringify(tg.t));
  check('... its E_r has a radius bound at every level, E_20\'s within 1e-4 of 1', tg.pr.rept.E.slice(1).every((e) => e && e.rad > 0) && tg.pr.rept.E[20].rad < 1 + 1e-4, JSON.stringify(tg.pr.rept.E[20]));
  const ins = run(INSIDE, 20);
  check('z^3 x 20 strictly inside |z| < 1: every pixel but the one at 0 empty with no root solved', ins.t.solves <= 1 && ins.t.inside[0] >= pts.length - 1, JSON.stringify(ins.t));
  const acr = run(ACROSS, 20);
  check(`z^3 x 20 across |z| = 1: every pixel but one covered, at most ${ACROSS_SOLVES} root solves a pixel`, acr.t.inside[1] >= pts.length - 1 && acr.t.max <= ACROSS_SOLVES, JSON.stringify(acr.t));
  // (at x 2 every pixel's verdict equals the brute force over its 9 chains, the radius bound pruning)
  const p2 = planOf(repOf('z^3', 2)), pr2 = Inverse.prepare(p2, { win: RW, shape: TANGENT }), L = Region.levelOf(TANGENT);
  let same = 0, scored = 0, pruned = 0;
  for (const w of pts) {
    const e = Inverse.enumerate(p2, pr2, w, PIX, { leaves: false }).rept, b = brute2(p2.ops[0], L, w);
    pruned += e.pruned;
    if (b === null) continue;
    scored++;
    if (e.verdict === b) same++;
  }
  check('z^3 x 2 on the tangent disc: E_2 has a radius bound, and every pixel\'s verdict equals the brute force over its 9 chains', same === scored && scored > 500 && pr2.rept.E[2].rad > 0, `${same}/${scored}, pruned ${pruned}`);
}

// ---- 4d. the closed form (a monomial step on a disc region, #2375)
// a pixel's verdict from every chain of copies backward roots (3^copies), no prune, each leaf scored at its own point;
// null when a leaf lies within a pixel's ramp of the edge
const bruteN = (o, L, w, copies) => {
  let brute = 0;
  const rec = (z, rho, d, r) => {
    if (r === copies) { const lv = L(z) / (d * PIX); if (Math.abs(lv) <= 1) return false; if (lv > 0) brute = 1; return true; }
    const nd = InvOps.reptNode(o.p.P, o.p.Q, z, rho);
    if (!nd) return false;
    for (let i = 0; i < 3; i++) if (!rec(nd.z[i], nd.rho[i], d * CX.abs(nd.d[i]), r + 1)) return false;
    return true;
  };
  return rec(w, 0, 1, 0) ? brute : null;
};
{
  const RW = { x0: -1.6, x1: 1.6, y0: -1.2, y1: 1.2 }, RG = 25;            // the view and its grid, as in 4c
  const NEAR = 0.02;                                                         // |w| within this of the invariant circle is left out
  const BAND = 2;                                                            // px: the reach band about the circle, with a margin
  const EDGE_ANGLES = 64, EDGE_PX = [-0.45, -0.2, 0.2, 0.45];               // the boundary circles' samples: angles, px off the circle
  const EDGE_U = 0.03;                                                       // coverage: the leaves' ramp tolerance
  const ARC_SWEEP = 150, ARC_STEP = 2e-5;                                    // the radii about r0: r0 (1 + j ARC_STEP), |j| <= ARC_SWEEP
  let edgeRows = 0;
  const pts = gridOf(RW, RG);
  // (z^3: the invariant circle |z| = 1; 2 z^3: |z| = 2^-1/2)
  const S = Math.SQRT1_2;
  const CASES = [
    { name: 'z^3 x 20 on the disc tangent to |z| = 1 from inside', expr: 'z^3', R: 1, shape: { id: 'c1', kind: 'disc', c: [0, 0.95], r: 0.05 } },
    { name: 'z^3 x 20 on a disc across |z| = 1', expr: 'z^3', R: 1, shape: { id: 'c2', kind: 'disc', c: [1, 0], r: 0.12 } },
    { name: 'z^3 x 20 on a disc across |z| = 1 that holds 0', expr: 'z^3', R: 1, shape: { id: 'c3', kind: 'disc', c: [0.2, 0], r: 1 } },
    { name: 'z^3 x 20 on a disc that holds |z| = 1 whole', expr: 'z^3', R: 1, shape: { id: 'c4', kind: 'disc', c: [0.1, -0.1], r: 1.5 } },
    { name: '2 z^3 x 20 on the disc tangent to |z| = 2^-1/2 from inside', expr: '2*z^3', R: S, shape: { id: 'c5', kind: 'disc', c: [0, S - 0.05], r: 0.05 } },
  ];
  for (const cs of CASES) {
    const p = planOf(repOf(cs.expr, 20)), pr = Inverse.prepare(p, { win: RW, shape: cs.shape });
    // (a circle |z| = rho near R meets the disc from inside R when |c| - r < R, from outside when |c| + r > R)
    const cl = Math.hypot(cs.shape.c[0], cs.shape.c[1]), vIn = cl - cs.shape.r < cs.R ? 1 : 0, vOut = cl + cs.shape.r > cs.R ? 1 : 0;
    const t = { inn: 0, inRight0: 0, out: 0, outRight0: 0, ring: 0, unres: 0, solves: 0, wide: 0, searched: 0, agree: 0, offRim: 0 };
    for (const w of pts) {
      const e = Inverse.enumerate(p, pr, w, PIX, { leaves: false }).rept, a = CX.abs(w);
      t.solves += e.nodes;
      if (e.verdict === -1 && !e.rim) t.offRim++;
      if (a < PIX) continue;   // (the pixel at the critical value 0, whose one preimage is 0: its verdict is its ramp's)
      if (e.verdict === -1 && Math.abs(a - cs.R) > BAND * PIX) t.wide++;
      // (the search alone, where it resolves the pixel)
      const s0 = Inverse.enumerate(p, pr, w, PIX, { leaves: false, reptClosed: false }).rept;
      if (s0.verdict !== -1) { t.searched++; if (s0.verdict === e.verdict) t.agree++; }
      if (a < cs.R * (1 - NEAR)) { t.inn++; if (e.verdict === vIn && e.nodes === 0) t.inRight0++; }
      else if (a > cs.R * (1 + NEAR)) { t.out++; if (e.verdict === vOut && e.nodes === 0) t.outRight0++; }
      else { t.ring++; if (e.verdict === -1) t.unres++; }
    }
    check(`${cs.name}: every pixel inside the circle (past the pixel's reach) is ${vIn ? 'covered' : 'empty'}, with no root solved`, t.inn > 100 && t.inRight0 === t.inn, JSON.stringify(t));
    check(`... every pixel outside it is ${vOut ? 'covered' : 'empty'}, with no root solved`, t.out > 100 && t.outRight0 === t.out, JSON.stringify(t));
    check(`... every unresolved pixel lies within ${BAND} px of the circle (the reach band)`, t.wide === 0, JSON.stringify(t));
    check('... and every one, the critical value 0\'s too, is on the image\'s rim (rim: a hairline, which the pane says nothing of)', t.offRim === 0, JSON.stringify(t));
    check('... wherever the search alone resolves a pixel, its verdict is the closed form\'s', t.searched > 300 && t.agree === t.searched, JSON.stringify(t));
  }
  // (control: a search starved to one root solve on z^3 x 3, where the closed form leaves most pixels to the search, reads
  // unresolved away from the boundary circles too, and there off the rim: the rim is the edge, not every unresolved pixel)
  {
    const cs = CASES[1], p = planOf(repOf(cs.expr, 3)), pr = Inverse.prepare(p, { win: RW, shape: cs.shape });
    let unres = 0, offRim = 0;
    for (const w of pts) {
      const e = Inverse.enumerate(p, pr, w, PIX, { leaves: false, reptNodes: 1 }).rept;
      if (e.verdict === -1) { unres++; if (!e.rim) offRim++; }
    }
    check(`control: z^3 x 3 on a disc across |z| = 1, starved to one root solve: unresolved pixels off the rim`, offRim > 0 && offRim < unres, `${offRim} of ${unres} unresolved off the rim`);
  }
  // (within half a pixel of each boundary circle |w| = R ((|c| +- r) / R)^M, where a preimage meets the disc's edge, at
  // x 2 and x 3: wherever the search alone resolves a point, its verdict and its coverage U (a partial cover there) are
  // the closed form's, which leaves the pixel's reach to the search)
  for (const cs of CASES) for (const copies of [2, 3]) {
    const p = planOf(repOf(cs.expr, copies)), pr = Inverse.prepare(p, { win: RW, shape: cs.shape }), M = 3 ** copies;
    const cl = Math.hypot(cs.shape.c[0], cs.shape.c[1]);
    let searched = 0, agree = 0;
    const wrong = [];
    for (const edge of [cl + cs.shape.r, cl - cs.shape.r]) {
      if (!(edge > 0)) continue;
      const Rb = cs.R * Math.pow(edge / cs.R, M);
      if (!(Rb > 4 * PIX && Rb < 4)) continue;
      for (let k = 0; k < EDGE_ANGLES; k++) for (const t of EDGE_PX) {
        const th = 2 * Math.PI * (k + 0.5) / EDGE_ANGLES, a = Rb + t * PIX, w = C(a * Math.cos(th), a * Math.sin(th));
        const s0 = Inverse.enumerate(p, pr, w, PIX, { leaves: false, reptClosed: false });
        if (s0.rept.verdict === -1) continue;
        searched++;
        const e = Inverse.enumerate(p, pr, w, PIX, { leaves: false });
        if (e.rept.verdict === s0.rept.verdict && Math.abs(e.U - s0.U) <= EDGE_U) agree++;
        else if (wrong.length < 3) wrong.push({ w: [+w.re.toFixed(4), +w.im.toFixed(4)], t, got: [e.rept.verdict, +e.U.toFixed(3)], search: [s0.rept.verdict, +s0.U.toFixed(3)] });
      }
    }
    if (searched) check(`${cs.name.replace(' x 20', ` x ${copies}`)}: within half a pixel of each boundary circle, the closed form's verdict and coverage are the search's`, agree === searched && searched > 100, `${agree}/${searched} ${JSON.stringify(wrong)}`);
    edgeRows += searched ? 1 : 0;
  }
  check('the boundary circles were sampled for at least 6 of the cases at x 2 and x 3', edgeRows >= 6, edgeRows);
  // (the arc just wide enough: z^3 x 4 at w = -1 has its 81 preimages at angles pi / 81 + 2 pi j / 81 on |z| = 1, and
  // the disc c (1, 0) of radius r0 = 2 sin(pi / 162) meets that circle along the arc |arg z| <= pi / 81, so near r0 the
  // covering preimages lie at the arc's two ends, within a pixel's reach of the disc's edge (at x 4 the arc test's margin,
  // (pi / 2M)^2 against sin^2(pi / 2M), is below the reach): at each radius of a sweep about r0, and at points half a
  // pixel about w = -1, the closed form's verdict and coverage are the search's)
  {
    const p = planOf(repOf('z^3', 4)), r0 = 2 * Math.sin(Math.PI / 162);
    let searched = 0, agree = 0, closedCov = 0;
    const wrong = [];
    for (let j = -ARC_SWEEP; j <= ARC_SWEEP; j++) {
      const shape = { id: 'aw', kind: 'disc', c: [1, 0], r: r0 * (1 + j * ARC_STEP) }, pr = Inverse.prepare(p, { win: RW, shape });
      for (const [dx, dy] of [[0, 0], [0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]]) {
        const w = C(-1 + dx * PIX, dy * PIX);
        const s0 = Inverse.enumerate(p, pr, w, PIX, { leaves: false, reptClosed: false });
        if (s0.rept.verdict === -1) continue;
        searched++;
        const e = Inverse.enumerate(p, pr, w, PIX, { leaves: false });
        if (e.rept.nodes === 0 && e.rept.verdict === 1) closedCov++;
        if (e.rept.verdict === s0.rept.verdict && Math.abs(e.U - s0.U) <= EDGE_U) agree++;
        else if (wrong.length < 3) wrong.push({ j, w: [w.re, w.im], got: [e.rept.verdict, +e.U.toFixed(3)], search: [s0.rept.verdict, +s0.U.toFixed(3)] });
      }
    }
    check('z^3 x 4 at w = -1 on discs about r0 = 2 sin(pi / 162): the closed form\'s verdict and coverage are the search\'s, where the arc just holds two preimages', agree === searched && searched > 100 && closedCov > 0, `${agree}/${searched}, closed form covered ${closedCov}, ${JSON.stringify(wrong)}`);
  }
  // (at x 2 and x 3, where the preimages' spacing is wide, every pixel's verdict equals the brute force over its chains,
  // the closed form deciding over a quarter of them)
  for (const cs of CASES) for (const copies of [2, 3]) {
    const p = planOf(repOf(cs.expr, copies)), pr = Inverse.prepare(p, { win: RW, shape: cs.shape }), L = Region.levelOf(cs.shape);
    let same = 0, scored = 0, unres = 0, closed = 0;
    const wrong = [];
    for (const w of pts) {
      const e = Inverse.enumerate(p, pr, w, PIX, { leaves: false }).rept, b = bruteN(p.ops[0], L, w, copies);
      if (b === null) continue;
      scored++;
      if (e.nodes === 0 && CX.abs(w) >= PIX) closed++;
      if (e.verdict === b) same++;
      else if (e.verdict === -1) unres++;
      else if (wrong.length < 3) wrong.push({ w: [w.re, w.im], got: e.verdict, brute: b });
    }
    check(`${cs.name.replace(' x 20', ` x ${copies}`)}: every pixel's verdict equals the brute force over its ${3 ** copies} chains`, same === scored && scored > 400 && closed * 4 > scored, `${same}/${scored}, closed form ${closed}, unresolved ${unres}, ${JSON.stringify(wrong)}`);
  }
}

// ---- 5. the search against brute force
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
  // (proxies for Direct3D's compiler fault, which runs only there: a continue after a descent fell through to the leaf,
  // and both arms of ?: are evaluated)
  check('proxy for the Direct3D fault: the REPT walker has no continue', !/\bcontinue\b/.test(inv.walker), inv.walker.match(/.*continue.*/g));
  check('proxy for the Direct3D fault: the REPT walker has no stack index that can be negative (no ?: over the stack, every index under max(.., 0) or a level >= 0)', !/\?[^;]*ix(RI|RZ|RR|RJ)\[/.test(inv.walker) && !/ixRI\[[a-z]+\d* - 1\]/.test(inv.walker), inv.walker.match(/.*(\?|- 1\]).*/g));
  const vals = new Float32Array(4 * inv.slots);
  inv.fill(vals);
  check('its cells: n, then P and Q', vals[0] === 20 && vals[4] === Math.fround(P20[0].re) && vals[11] === Math.fround(P20[3].im) && vals[14] === Math.fround(Q20[1].re), Array.from(vals.slice(0, 20)).join(','));
}

console.log(`t_rept: ${n - bad}/${n} passed`);
process.exit(bad ? 1 : 0);
