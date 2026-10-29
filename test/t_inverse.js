// The CPU preimage enumerator (src/inverse.js) and the shape geometry it uses (src/region.js), SPEC 12.1 (a)-(f),
// (j), (k). Run: node test/t_inverse.js [--quick]   (exit code 1 on any failure)
global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
global.Funcs = require('../src/funcs.js');
global.Region = require('../src/region.js');
const Inverse = require('../src/inverse.js');
const C = CX.C;
const PI = Math.PI, TAU = 2 * PI, DEG = PI / 180;
const QUICK = process.argv.includes('--quick');
let bad = 0, n = 0;
function check(name, ok, info = '') { n++; if (!ok) { bad++; console.log('FAIL', name, info); } }
let seed = 12345;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const rc = (s = 2) => C((rnd() * 2 - 1) * s, (rnd() * 2 - 1) * s);
const cs = (z) => `${z.re}${z.im < 0 ? '' : '+'}${z.im}i`;
const St = (type, params = {}, on = true) => ({ type, params: Object.assign(Funcs.defaults(type), params), on });
function planOf(list, a, b) {
  const steps = list.map((s) => St(s.type, s.params || {}));
  const built = steps.map(Funcs.build);
  const plan = Inverse.planChain(steps, built, a, b);
  const F = (z) => plan.ops.reduce((u, o) => o.fwd(u), z);
  return { plan, F, steps, built };
}
// the default clipWin: the left view {cx: 0, cy: 0, s: 60} of a 410 x 516 pane
const boxOf = (cx, cy, s, w = 410, h = 516) => ({ x0: cx - w / 2 / s, x1: cx + w / 2 / s, y0: cy - h / 2 / s, y1: cy + h / 2 / s });
const WIN0 = boxOf(0, 0, 60);
const H = { kind: 'halfplane', a: [0, 0], b: [1, 0] };
const t0All = Date.now();
const section = (name) => console.log(`--- ${name}`);

// =================================================================================================
// (a) round trips: soundness, completeness, decomposition for every catalog type and the custom formulas
// =================================================================================================
section('(a) round trips');
{
  const cases = [];
  const add = (type, params) => cases.push({ type, params });
  for (let i = 0; i < 3; i++) {
    add('mul', { c: cs(rc()) }); add('add', { c: cs(rc()) }); add('affine', { a: cs(rc()), b: cs(rc()) });
    add('mobius', { a: cs(rc()), b: cs(rc()), c: cs(rc()), d: cs(rc()) });
    add('blaschke', { a: cs(rc(0.7)), phi: Math.round(rnd() * 360 - 180) });
  }
  add('recip', {});
  for (const nn of [-16, -5, -2, -1, 1, 2, 3, 7, 16]) add('pown', { n: nn });
  for (const nn of [2, 3, 5]) for (const k of [-1, 0, 1, 2]) add('root', { n: nn, cut: Math.round(rnd() * 360 - 180), k });
  for (const al of ['1.5', '0.5', '-0.7', '2.5', 'i', '0.3+i', '-0.2+0.8i', '3', '0.25', '-2']) for (const k of [-1, 0, 1, 2]) add('powa', { alpha: al, cut: Math.round(rnd() * 360 - 180), k });
  for (const al of ['15.5', '16', '17.5', '20', '-18', '20+0.1i', '20+2i', '0.05+i', '0.01+i']) add('powa', { alpha: al, cut: 180, k: 0 });
  add('exp', {});
  for (const k of [-1, 0, 1, 2]) add('log', { cut: Math.round(rnd() * 360 - 180), k });
  add('log', { cut: 180, k: 0 }); add('log', { cut: 90, k: 1 });
  for (const t of ['sin', 'cos', 'tan', 'sinh', 'cosh', 'tanh', 'arcsin', 'arccos', 'arctan', 'arsinh', 'arcosh', 'artanh', 'joukowski', 'conj']) add(t, {});
  add('ijouk', { branch: 'exterior' }); add('ijouk', { branch: 'interior' });
  add('poly', { co: '2, 1-i, 3' }); add('poly', { co: '1+i, 0, 0, -2' }); add('poly', { co: '0.5, -1' }); add('poly', { co: '1, 0, 4' }); add('poly', { co: '2, 0, 0, 0, 0, 1-i' });
  add('rational', { p: '1, -i', q: '1, i' }); add('rational', { p: '1, 0, 1', q: '1, 0' }); add('rational', { p: '1, 2, 0', q: '1, 0, -3' }); add('rational', { p: '2, 1', q: '3' });
  // zeros and poles (degree <= 2 exact: MOB, AFF, QUAD, RAT2)
  add('zp', {}); add('zp', { a: '2i', zeros: '1+i', poles: '-0.5' }); add('zp', { a: '1', zeros: '', poles: '0.3-i' }); add('zp', { a: '-1', zeros: '1, i', poles: '' });
  add('zp', { a: '0.5', zeros: '1+i, -2', poles: '0.25i, 3' }); add('zp', { a: '1', zeros: '0, 0', poles: '' }); add('zp', { a: '3', zeros: '0.5', poles: '' });
  const CUSTOM = [['e^{1/z}', 180], ['z^{i}', 180], ['\\sqrt{z}+1', 180], ['2^{z}', 180], ['\\log(z-1)', 90], ['\\cot z', 180], ['\\frac{1}{z^2}', 180],
    ['\\sin(2z+1)', 180], ['\\overline{z}^2', 180], ['(z+1)^{1.5}', 60], ['\\sqrt[3]{z}', -90], ['\\arcsin(z)/2', 180], ['\\operatorname{artanh}(z)', 180],
    ['3-\\frac{2}{z+i}', 180], ['i^{z}', 180], ['\\sec(z)', 180], ['(1+i)z^{0.7}', 150], ['e^{z^2}', 180], ['\\log(\\log z)', 180], ['\\csc z', 180], ['\\coth(z)', 180],
    ['z^{17.5}', 180], ['-\\tanh(z)', 180], ['\\cosh(z/2)', 180], ['\\arctan z', 180], ['\\operatorname{arcosh} z', 180], ['\\arccos(z)', 180], ['\\operatorname{arsinh}(z)', 180],
    ['\\exp(z)-1', 180], ['\\sinh(z)', 180], ['\\sqrt[2.5]{z}', 180], ['z', 180], ['(2-z)^{-1}', 180],
    // rational parts in which z occurs more than once (SPEC 3.3 rev 3; test/t_inverse_rational.js has the full table)
    ['\\frac{z^2-1}{z^2+1}', 180], ['(z+1/z)/2', 180], ['z^2+2z', 180], ['\\frac{(z-1)(z-2i)}{z-0.5}', 180], ['\\log\\frac{z-1}{z+1}', 90], ['\\sqrt{z^2-1}', 180],
    ['z^3+\\frac{1}{z^3}', 180], ['\\frac{z^4-1}{z^4+1}', 180], ['\\sin(z+1/z)', 180]];
  for (const [e, cut] of CUSTOM) add('custom', { expr: e, cut });
  const shape = { kind: 'disc', c: [0, 0], r: 3 };
  const inel = [];
  let fails = 0, total = 0;
  const kinds = new Set();
  for (const cse of cases) {
    const st = St(cse.type, cse.params), b = Funcs.build(st);
    if (b.error) { check(`build ${cse.type} ${JSON.stringify(cse.params)}`, false, b.error); continue; }
    const plan = Inverse.planChain([st], [b]);
    if (!plan.ok) { inel.push(`${cse.type} ${JSON.stringify(cse.params)}: ${plan.reason}`); continue; }
    plan.ops.forEach((o) => kinds.add(o.kind));
    const prep = Inverse.prepare(plan, { win: WIN0, shape });
    let unsound = 0, miss = 0, dec = 0, tried = 0;
    for (let t = 0; t < 200; t++) {
      const u = rc(2.5), w = b.f(u);
      if (!CX.isFin(w) || CX.abs(w) > 1e8) continue;
      tried++;
      let x = u; for (const o of plan.ops) x = o.fwd(x);
      if (!(CX.abs(CX.sub(x, w)) <= 1e-9 * (1 + CX.abs(w)))) dec++;
      const r = Inverse.enumerate(plan, prep, w, 1, { full: 40, ramp: 1e-9 });
      for (const lf of r.leaves) {
        if (!(lf.lvl > 1e-7) || !CX.isFin(lf.z)) continue;
        const wb = b.f(lf.z);
        if (!(CX.abs(CX.sub(wb, w)) <= 1e-8 * (1 + CX.abs(w)))) unsound++;
      }
      const tol = 1e-7 * (1 + CX.abs(u));
      if (!r.leaves.some((lf) => CX.isFin(lf.z) && CX.abs(CX.sub(lf.z, u)) <= tol && lf.lvl >= -1e-6)) miss++;
    }
    total++;
    const ok = !unsound && !miss && !dec && tried > 50;
    if (!ok) fails++;
    check(`round trip ${cse.type} ${JSON.stringify(cse.params)} [${plan.ops.map((o) => o.kind).join('>')}]`, ok, `unsound ${unsound} missed ${miss} decomposition ${dec} (of ${tried})`);
  }
  console.log(`${total} eligible step cases, ${fails} failing; op kinds covered: ${[...kinds].sort().join(' ')}`);
  console.log(`ineligible: ${inel.length ? inel.join('; ') : 'none'}`);
  check('round trips: no ineligible case among the eligible list', inel.length === 0, inel.join('; '));
  const ALL_KINDS = ['AFF', 'MOB', 'IPOW', 'ROOTPOW', 'EXP', 'EXPC', 'LOG', 'SIN', 'COS', 'TAN', 'SINH', 'COSH', 'TANH', 'ASIN', 'ACOS', 'ATAN', 'ASINH', 'ACOSH', 'ATANH', 'JOUK', 'IJOUK', 'CONJ', 'QUAD', 'RAT2'];
  check('every op kind is exercised', ALL_KINDS.every((k) => kinds.has(k)), ALL_KINDS.filter((k) => !kinds.has(k)).join(' '));
  // every catalog type is decomposed (or ineligible by rule)
  const covered = new Set(cases.map((c) => c.type));
  // (d/dz, Γ, ζ, a series, a recurrence, Φ_M and φ_c are ineligible by rule: below)
  const byRule = new Set(['deriv', 'gamma', 'zeta', 'series', 'recurrence', 'dh', 'bottcher']);
  check('every catalog type except d/dz, Γ, ζ, a series, a recurrence, Φ_M and φ_c is round-tripped', Object.keys(Funcs.DEFS).every((id) => byRule.has(id) || covered.has(id)), Object.keys(Funcs.DEFS).filter((id) => !byRule.has(id) && !covered.has(id)).join(' '));
  // ineligible exactly
  const INELIGIBLE = [
    ['poly', { co: '1, 0, -1, 0' }, 'polynomial of degree 3'], ['rational', { p: '1, 0, 0, 1', q: '1, 0' }, 'rational map of degree 3'],
    ['custom', { expr: 'z^2+\\frac{1}{z}' }, 'rational formula of degree 3'], ['custom', { expr: '\\Re z+1' }, 'lose'], ['custom', { expr: '\\Im(z)' }, 'lose'],
    ['custom', { expr: '|z|^2' }, 'lose'], ['custom', { expr: '\\arg(z)' }, 'lose'], ['deriv', {}, 'd/dz'], ['pown', { n: 17 }, '|n| > 16'], ['custom', { expr: 'z^{20}' }, '|n| > 16'],
    ['poly', { co: '1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1' }, '|n| > 16'], ['custom', { expr: 'z^{z}' }, 'variable base and exponent'], ['custom', { expr: '(1+z)^{\\sin z}' }, ''], ['custom', { expr: 'z\\cdot\\overline{z}' }, 'more than once'],
    ['mul', { c: '0' }, 'constant'], ['powa', { alpha: '0' }, 'constant'], ['mobius', { a: '1', b: '2', c: '2', d: '4' }, ''],
    // (issue #4) Γ and ζ take each value infinitely often: X → Y uses the sphere-mesh fallback
    ['gamma', {}, 'no inverse enumerator'], ['zeta', {}, 'no inverse enumerator'], ['custom', { expr: '\\Gamma(z)+1' }, 'infinitely often'],
    // (issue #5) a series: the sphere-mesh fallback too
    ['series', { kind: 'power', an: '\\frac{1}{n!}', c: '0' }, ''], ['custom', { expr: '\\sum_{n=0}^{\\infty} \\frac{z^n}{n!}' }, ''],
    // (issue #6) a recurrence: the sphere-mesh fallback (Repeat × N unrolls its steps)
    ['recurrence', { u0: 'z', g: 'u^2+z', N: 2, cut: 180 }, 'no inverse enumerator'],
    // (issue #260) Φ_M and φ_c: one-to-one, but with no inverse here (the sphere-mesh fallback)
    ['dh', {}, 'no inverse enumerator'], ['bottcher', {}, 'no inverse enumerator'],
  ];
  for (const [type, params, why] of INELIGIBLE) {
    const st = St(type, params), b = Funcs.build(st);
    const plan = Inverse.planChain([st], [b]);
    check(`ineligible ${type} ${JSON.stringify(params)}`, !plan.ok && (!why || String(plan.reason).includes(why)), plan.reason);
  }
  const p70 = planOf([{ type: 'powa', params: { alpha: '70' } }]).plan;
  const pr70 = Inverse.prepare(p70, { win: WIN0, shape: H });
  check('powa 70: shape level too many branches', p70.ok && !pr70.ok && pr70.reason === 'too many branches', pr70.reason);
  // the custom-formula recognizer of the chain (customOps) decomposes the formulas the app accepts
  const cust = (e) => Inverse.stepOps(Funcs.build(St('custom', { expr: e, cut: 180 })));
  check('custom cot = TAN then MOB', cust('\\cot z').ok && cust('\\cot z').ops.map((o) => o.kind).join() === 'TAN,MOB');
  check('custom 2^z = EXPC', cust('2^{z}').ops.map((o) => o.kind).join() === 'EXPC');
  check('custom e^{z^2} = IPOW then EXP', cust('e^{z^2}').ops.map((o) => o.kind).join() === 'IPOW,EXP');
  check('custom 3 - 2/(z+i) = AFF, MOB, AFF', cust('3-\\frac{2}{z+i}').ops.map((o) => o.kind).join() === 'AFF,MOB,AFF');
  // stage ranges: off and failed steps are the identity, (a, b] selects the ops
  {
    const { steps, built } = planOf([{ type: 'exp' }, { type: 'mobius' }, { type: 'deriv' }, { type: 'sin' }]);
    const p02 = Inverse.planChain(steps, built, 0, 2), p03 = Inverse.planChain(steps, built, 0, 3), p34 = Inverse.planChain(steps, built, 3, 4);
    check('stage range (0, 2]', p02.ok && p02.ops.map((o) => o.kind).join() === 'EXP,MOB' && p02.ops[1].step === 2);
    check('d/dz in range is ineligible', !p03.ok && /d\/dz/.test(p03.reason), p03.reason);
    check('stage range (3, 4]', p34.ok && p34.ops.map((o) => o.kind).join() === 'SIN');
    steps[2].on = false;
    check('a bypassed step is the identity', Inverse.planChain(steps, built).ok);
    check('the key encodes per-step eligibility', p02.key === p03.key && /"X"/.test(p02.key));
  }
}

// (a) large |w| (review P1, finding 2): the SIN, COS, SINH, COSH, TAN, TANH family bases are accurate for |w| up to
// 1e7. Checked with an accurate forward (CX.sin & co. are accurate; tan and tanh are reduced at their nearest pole
// with a double-double pi, since CX.tan itself loses digits there), so the check is independent of CX.asin & co.
section('(a) large |w|: family bases');
const PIH_HI = 1.5707963267948966, PIH_LO = 6.123233995736766e-17, PI_LO = 1.2246467991473532e-16;
function tanAcc(u) {                                                    // tan(u), accurate near the poles pi/2 + n pi
  const n = Math.round((u.re - PIH_HI) / PI);
  const e = C((u.re - (PIH_HI + n * PI)) - (PIH_LO + n * PI_LO), u.im);
  return Math.abs(e.re) < 0.5 && Math.abs(n) < 1e6 ? CX.neg(CX.inv(CX.tan(e))) : CX.tan(u);
}
const tanhAcc = (u) => { const t = tanAcc(C(-u.im, u.re)); return C(t.im, -t.re); };   // tanh u = -i tan(iu)
{
  const ACC = { SIN: CX.sin, COS: CX.cos, SINH: CX.sinh, COSH: CX.cosh, TAN: tanAcc, TANH: tanhAcc };
  for (const kind of Object.keys(ACC)) {
    const o = Inverse._ops['op' + kind[0] + kind.slice(1).toLowerCase()]();
    let worst = 0, at = null;
    for (const mag of [1e2, 1e3, 1e4, 1e5, 1e6, 1e7]) {
      for (let t = 0; t < 64; t++) {
        const th = TAU * (t + 0.37) / 64, w = C(mag * Math.cos(th), mag * Math.sin(th));
        for (const u of o.fam.bases(w)) {
          const e = CX.abs(CX.sub(ACC[kind](u), w)) / (1 + mag);
          if (!(e <= worst)) { worst = e; at = w; }
        }
      }
    }
    console.log(`${kind.padEnd(5)} bases at |w| in [1e2, 1e7]: worst |f(base) - w| / (1 + |w|) = ${worst.toExponential(2)}`);
    check(`${kind} family bases accurate for large |w|`, worst <= 1e-8, `${worst} at ${at && CX.fmt(at)}`);
  }
  // the base must not overflow or vanish where CX.asin does (CX.asin(-1e9) = (0, Infinity))
  const b9 = Inverse._ops.opSin().fam.bases(C(-1e9, 0))[0];
  check('SIN base at w = -1e9 is finite and exact', CX.isFin(b9) && CX.abs(CX.sub(CX.sin(b9), C(-1e9, 0))) <= 1e-12 * 1e9, CX.fmt(b9));
  // end to end: chains whose intermediate value is large although w is moderate; the sample's own preimage must be a
  // covering leaf (no path filter, so a wrong base cannot hide behind a skipped sample)
  const E2E = [
    ['log(cos z), |z + 20i| < 1', [{ type: 'cos' }, { type: 'log' }], { kind: 'disc', c: [0, -20], r: 1 }, 1e-3],
    ['log(sin z), |z - 1 - 19i| < 1', [{ type: 'sin' }, { type: 'log' }], { kind: 'disc', c: [1, 19], r: 1 }, 1e-3],
    ['log(sinh z), |z - 19| < 1', [{ type: 'sinh' }, { type: 'log' }], { kind: 'disc', c: [19, 0], r: 1 }, 1e-3],
    ['log(tan z), |z - 1.56| < 0.01', [{ type: 'tan' }, { type: 'log' }], { kind: 'disc', c: [1.56, 0], r: 0.01 }, 1e-3],
    ['sin z, |z - 2 - 14i| < 1 (|w| ~ 6e5)', [{ type: 'sin' }], { kind: 'disc', c: [2, 14], r: 1 }, 100],
    ['cosh z, |z - 14 - 2i| < 1 (|w| ~ 6e5)', [{ type: 'cosh' }], { kind: 'disc', c: [14, 2], r: 1 }, 100],
  ];
  for (const [name, steps, shape, pix] of E2E) {
    const { plan, F } = planOf(steps);
    const prep = Inverse.prepare(plan, { win: WIN0, shape });
    let nn = 0, miss = 0, off = 0, ex = '';
    const L = Region.levelOf(shape), bb = Region.bboxOf(shape);
    for (let t = 0; t < (QUICK ? 300 : 1500); t++) {
      const z = C(bb.x0 + rnd() * (bb.x1 - bb.x0), bb.y0 + rnd() * (bb.y1 - bb.y0));
      if (!(L(z) > 1e-6)) continue;
      const w = F(z);
      if (!CX.isFin(w)) continue;
      nn++;
      const r = Inverse.enumerate(plan, prep, w, pix, { K: 16, B: 16 });
      if (!(r.U > 0)) { miss++; if (!ex) ex = `z ${CX.fmt(z)} w ${CX.fmt(w)}`; continue; }
      if (!r.leaves.some((lf) => lf.cov && CX.abs(CX.sub(lf.z, z)) <= 1e-6 * (1 + CX.abs(z)))) { off++; if (!ex) ex = `own preimage of z ${CX.fmt(z)}`; }
    }
    console.log(`${name.padEnd(42)} prepare ${prep.ok ? 'ok' : prep.reason}: ${miss}/${nn} not covered, ${off} own preimage missing`);
    check(`large |w| end to end: ${name}`, prep.ok && nn > 100 && !miss && !off, ex);
  }
}

// =================================================================================================
// (b) range sign: lvl > 0 iff f(pre(w)) = w, over a 200 x 200 grid (away from a band)
// =================================================================================================
section('(b) range sign');
{
  const STEPS = [
    ['arcsin', {}], ['arccos', {}], ['arctan', {}], ['arsinh', {}], ['arcosh', {}], ['artanh', {}],
    ['log', { cut: 180, k: 0 }], ['log', { cut: 40, k: 1 }], ['log', { cut: -120, k: -1 }], ['ijouk', { branch: 'exterior' }], ['ijouk', { branch: 'interior' }],
    ['root', { n: 2, cut: 180, k: 0 }], ['root', { n: 3, cut: 60, k: 2 }], ['powa', { alpha: '1.5', cut: 180, k: 0 }], ['powa', { alpha: 'i', cut: 180, k: 0 }],
    ['powa', { alpha: '0.3+i', cut: -45, k: 1 }], ['powa', { alpha: '-0.7', cut: 100, k: -1 }], ['powa', { alpha: '2.5', cut: 180, k: 2 }],
    // the custom-formula decomposition: one range op per formula, with the formula's own cut (sheet 0)
    ['custom', { expr: '\\sqrt{z}', cut: 90 }], ['custom', { expr: '\\log z', cut: -60 }], ['custom', { expr: 'z^{0.3+i}', cut: 120 }], ['custom', { expr: 'z^{1.5}', cut: 30 }],
    ['custom', { expr: '\\sqrt[3]{z}', cut: -150 }], ['custom', { expr: '\\arctan z', cut: 180 }], ['custom', { expr: '\\operatorname{arcosh} z', cut: 180 }], ['custom', { expr: '\\arcsin z', cut: 180 }],
    ['custom', { expr: 'z^{0.5i}', cut: 180 }],
  ];
  const BAND = 1e-9, G = QUICK ? 100 : 200;
  for (const [type, params] of STEPS) {
    const b = Funcs.build(St(type, params)), r = Inverse.stepOps(b), o = r.ops[0];
    const isLog = type === 'log';
    const box = isLog ? { x0: -3, x1: 3, y0: -14, y1: 14 } : { x0: -3, x1: 3, y0: -3, y1: 3 };
    let pos = 0, neg = 0, wrong = 0, ex = '';
    for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) {
      const w = C(box.x0 + (box.x1 - box.x0) * (i + 0.37) / G, box.y0 + (box.y1 - box.y0) * (j + 0.61) / G);
      let mems;
      if (o.fam && o.fam.type === 'log') { const l0 = o.fam.L0(w); mems = []; for (let m = -6; m <= 6; m++) mems.push(o.fam.member(w, m, l0)); }
      else mems = o.pre(w);
      // a member outside the range may be the same point as an in-range member (z^s with rational s: u_m = u_{m+q});
      // the point is then a preimage, represented once (by the in-range member)
      const inRange = mems.filter((mm) => mm.lvl > BAND * (1 + CX.abs(w)) && CX.isFin(mm.u));
      for (const mem of mems) {
        if (!CX.isFin(mem.u) || Math.abs(mem.lvl) <= BAND * (1 + CX.abs(w))) continue;
        const back = b.f(mem.u), same = CX.isFin(back) && CX.abs(CX.sub(back, w)) <= 1e-8 * (1 + CX.abs(w));
        if (mem.lvl > 0) pos++; else neg++;
        const dup = mem.lvl < 0 && inRange.some((mm) => CX.abs(CX.sub(mm.u, mem.u)) <= 1e-9 * (1 + CX.abs(mem.u)));
        if ((mem.lvl > 0) !== same && !dup) { wrong++; if (!ex) ex = `w ${CX.fmt(w)} lvl ${mem.lvl.toExponential(2)} f(u) ${CX.fmt(back)}`; }
      }
    }
    check(`range sign ${type} ${JSON.stringify(params)}`, wrong === 0 && pos > 0 && (neg > 0 || type === 'arcosh'), `wrong ${wrong} (in range ${pos}, out ${neg}) ${ex}`);
  }
}

// =================================================================================================
// (c) plans and budgets
// =================================================================================================
section('(c) plans and budgets');
// well-conditioned float64 path (r1_ranges.js): follow the true path backwards, nearest member at each op. The family
// bases here are independent of the op table (review P1, finding 2: a filter built on the op's own bases skips exactly
// the samples a wrong base loses): CX's principal inverse, polished by Newton steps on the op's forward map.
const DERIV = { SIN: CX.cos, COS: (u) => CX.neg(CX.sin(u)), TAN: (u) => { const c = CX.cos(u); return CX.inv(CX.mul(c, c)); }, SINH: CX.cosh, COSH: CX.sinh, TANH: (u) => { const c = CX.cosh(u); return CX.inv(CX.mul(c, c)); } };
function indepBases(o, v) {
  const newton = (u) => { for (let i = 0; i < 6 && CX.isFin(u); i++) u = CX.sub(u, CX.div(CX.sub(o.fwd(u), v), DERIV[o.kind](u))); return u; };
  switch (o.kind) {
    case 'EXP': return CX.isZero(v) ? [] : [CX.log(v)];
    case 'EXPC': return CX.isZero(v) ? [] : [CX.div(CX.log(v), o.p.L0)];
    case 'SIN': { const a = newton(CX.asin(v)); return [a, CX.sub(C(PI, 0), a)]; }
    case 'COS': { const a = newton(CX.acos(v)); return [a, CX.neg(a)]; }
    case 'TAN': return [newton(CX.atan(v))];
    case 'SINH': { const a = newton(CX.asinh(v)); return [a, CX.sub(C(0, PI), a)]; }
    case 'COSH': { const a = newton(CX.acosh(v)); return [a, CX.neg(a)]; }
    case 'TANH': return [newton(CX.atanh(v))];
  }
  return o.fam.bases(v);
}
function memberUs(o, v, ut) {
  const F = o.fam;
  if (F && F.type === 'add') {
    const out = [];
    for (const base of indepBases(o, v)) { if (!base || !CX.isFin(base)) continue; const m0 = Math.round(CX.div(CX.sub(ut, base), F.p).re); for (let m = m0 - 2; m <= m0 + 2; m++) out.push(CX.add(base, CX.scale(F.p, m))); }
    return out;
  }
  if (F && F.type === 'log') {
    if (CX.isZero(v)) return [];
    const l0 = F.L0(v), lt = CX.log(ut), S2 = F.S.re * F.S.re + F.S.im * F.S.im, d = CX.sub(lt, l0);
    const m0 = Math.round((d.re * F.S.re + d.im * F.S.im) / S2), out = [];
    for (let m = m0 - 3; m <= m0 + 3; m++) out.push(F.member(v, m, l0).u);
    return out;
  }
  return o.pre(v).map((m) => m.u);
}
function wellConditioned(plan, z) {
  const vals = [z];
  for (const o of plan.ops) vals.push(o.fwd(vals[vals.length - 1]));
  let v = vals[vals.length - 1];
  for (let j = plan.ops.length - 1; j >= 0; j--) {
    const ut = vals[j];
    let best = null, bd = Infinity;
    for (const u of memberUs(plan.ops[j], v, ut)) { if (!CX.isFin(u)) continue; const d = CX.abs(CX.sub(u, ut)); if (d < bd) { bd = d; best = u; } }
    if (!best) return false;
    v = best;
  }
  return CX.abs(CX.sub(v, z)) <= 1e-7 * (1 + CX.abs(z));
}
function sampleIn(shape, N, box) {
  const L = Region.levelOf(shape), bb = Region.bboxOf(shape) || box, out = [];
  let tries = 0;
  while (out.length < N && tries < N * 400) {
    tries++;
    const z = C(bb.x0 + rnd() * (bb.x1 - bb.x0), bb.y0 + rnd() * (bb.y1 - bb.y0));
    if (L(z) > 1e-6) out.push(z);
  }
  return out;
}
let skipped = 0;
function coverRun(name, stepList, shape, win, N = 1000, opts = {}) {
  const { plan, F } = planOf(stepList);
  if (!plan.ok) return { name, forward: plan.reason };
  const prep = Inverse.prepare(plan, { win, shape });
  if (!prep.ok) return { name, forward: prep.reason };
  let nn = 0, miss = 0, vis = 0, ex = null;
  const sk0 = skipped;
  for (const z of sampleIn(shape, N, opts.box || { x0: -100, x1: 100, y0: -100, y1: 100 })) {
    const w = F(z);
    if (!CX.isFin(w) || CX.abs(w) > 1e12 || CX.abs(w) < 1e-12) continue;
    if (!wellConditioned(plan, z)) { skipped++; continue; }
    nn++;
    const r = Inverse.enumerate(plan, prep, w, 1e-3, { K: 1, leaves: false });
    vis += r.visited;
    if (!r.nCov) { miss++; if (!ex) ex = { z: CX.fmt(z), w: CX.fmt(w) }; }
  }
  return { name, n: nn, miss, skip: skipped - sk0, perPx: vis / Math.max(1, nn), N: prep.N.filter((x, i) => prep.fam[i]).join('x'), ex };
}
const showRun = (r) => (r.forward ? `${r.name.padEnd(46)} -> forward (${r.forward})` : `${r.name.padEnd(46)} missed ${r.miss}/${r.n} (skipped ${r.skip}) leaves/px ${r.perPx.toFixed(1)} budgets ${r.N}`);
{
  const key = (al) => Inverse.inverseKey([St('powa', { alpha: al })], [Funcs.build(St('powa', { alpha: al }))]);
  check('key stable under parameters (powa 1.5 -> i -> 0.5 -> 20+2i)', key('1.5') === key('i') && key('i') === key('0.5') && key('0.5') === key('20+2i'));
  const pk = (co) => Inverse.inverseKey([St('poly', { co })], [Funcs.build(St('poly', { co }))]);
  check('poly 1,0,-1,0 and 1,0,0,5 differ in the key', pk('1, 0, -1, 0') !== pk('1, 0, 0, 5'), pk('1, 0, -1, 0') + ' ' + pk('1, 0, 0, 5'));
  check('poly 1,0,0,5 keeps its key under coefficient changes', pk('1, 0, 0, 5') === pk('2, 0, 0, -1+i'));
  const WIDE = { x0: -80, x1: 80, y0: -100, y1: 100 }, OUT2 = boxOf(0, 0, 30);
  const sub = (cy) => boxOf(0, cy, 60);
  const CASES = [
    ['exp, disc r=1 at 60i, wide view', [{ type: 'exp' }], { kind: 'disc', c: [0, 60], r: 1 }, WIDE],
    ['tan, disc r=1 at 30, wide view', [{ type: 'tan' }], { kind: 'disc', c: [30, 0], r: 1 }, WIDE],
    ['sin, rect [20,40]x[0,1], wide view', [{ type: 'sin' }], { kind: 'rect', a: [20, 0], b: [40, 1] }, WIDE],
    ['e^{10z}, disc r=0.3 at 6.5i, view out 2x', [{ type: 'custom', params: { expr: 'e^{10z}', cut: 180 } }], { kind: 'disc', c: [0, 6.5], r: 0.3 }, OUT2],
    ['exp∘exp, disc r=0.1 at 3+0.9i', [{ type: 'exp' }, { type: 'exp' }], { kind: 'disc', c: [3, 0.9], r: 0.1 }, WIN0],
    ['exp∘exp, disc r=1 at 3', [{ type: 'exp' }, { type: 'exp' }], { kind: 'disc', c: [3, 0], r: 1 }, WIN0],
    ['e^{z^2}, disc r=0.3 at 3+3i', [{ type: 'custom', params: { expr: 'e^{z^2}', cut: 180 } }], { kind: 'disc', c: [3, 3], r: 0.3 }, WIN0],
    ['e^{z^2}, disc r=0.3 at 3.3+4.1i', [{ type: 'custom', params: { expr: 'e^{z^2}', cut: 180 } }], { kind: 'disc', c: [3.3, 4.1], r: 0.3 }, WIN0],
    ['tan∘exp, disc r=0.3 at 1.5+2i', [{ type: 'exp' }, { type: 'tan' }], { kind: 'disc', c: [1.5, 2], r: 0.3 }, WIN0],
    ['sin∘exp, disc r=0.3 at 2.5+0.5i', [{ type: 'exp' }, { type: 'sin' }], { kind: 'disc', c: [2.5, 0.5], r: 0.3 }, WIN0],
    ['e^{1/z^2}, disc r=0.2 at 0.6+0.5i', [{ type: 'custom', params: { expr: 'e^{\\frac{1}{z^2}}', cut: 180 } }], { kind: 'disc', c: [0.6, 0.5], r: 0.2 }, WIN0],
    ['e^{1/z}, unit disc', [{ type: 'recip' }, { type: 'exp' }], { kind: 'disc', c: [0, 0], r: 1 }, WIN0],
    ['e^{1/z^2}, unit disc (pole inside, through z^2)', [{ type: 'custom', params: { expr: 'e^{\\frac{1}{z^2}}', cut: 180 } }], { kind: 'disc', c: [0, 0], r: 1 }, WIN0],
    ['e^{1/z}, |z - 0.3i| < 1 (pole inside, off centre)', [{ type: 'recip' }, { type: 'exp' }], { kind: 'disc', c: [0, 0.3], r: 1 }, WIN0],
    ['2^{M(z)} of H, the pole of M inside', [{ type: 'mobius', params: { a: '1', b: '0.5', c: '0.4', d: '1-0.8i' } }, { type: 'custom', params: { expr: '2^{z}', cut: 180 } }], H, WIN0],
    ['exp, disc r=100 (convex, truncated window)', [{ type: 'exp' }], { kind: 'disc', c: [0, 0], r: 100 }, WIN0],
    ['exp, annulus 40<|z|<100', [{ type: 'exp' }], { kind: 'annulus', c: [0, 0], r1: 40, r2: 100 }, WIN0],
    ['exp, complement of |z-60i|<40', [{ type: 'exp' }], { kind: 'disc', c: [0, 60], r: 40, complement: true }, WIN0],
    ['exp, sector r=0, 100..120 deg', [{ type: 'exp' }], { kind: 'sector', c: [0, 0], r: 0, t1: 100, t2: 120 }, WIN0],
    ['exp, halfplane Im z > 10 Re z', [{ type: 'exp' }], { kind: 'halfplane', a: [0, 0], b: [1, 10] }, WIN0],
    ['z^i, rect off the view', [{ type: 'powa', params: { alpha: 'i' } }], { kind: 'rect', a: [20, 30], b: [24, 31] }, WIN0],
    ['powa 0.01+i, disc', [{ type: 'powa', params: { alpha: '0.01+1i' } }], { kind: 'disc', c: [1, 0.5], r: 0.3 }, WIN0],
    ['powa 17.5, H', [{ type: 'powa', params: { alpha: '17.5' } }], H, WIN0, { box: { x0: -3, x1: 3, y0: 0, y1: 3 } }],
    ['powa -18, disc', [{ type: 'powa', params: { alpha: '-18' } }], { kind: 'disc', c: [1, 0.5], r: 0.3 }, WIN0],
    ['powa 20+2i, H', [{ type: 'powa', params: { alpha: '20+2i' } }], H, WIN0, { box: { x0: -3, x1: 3, y0: 0, y1: 3 } }],
    ['custom z^{17.5}, disc at 1+0.5i', [{ type: 'custom', params: { expr: 'z^{17.5}', cut: 180 } }], { kind: 'disc', c: [1, 0.5], r: 0.3 }, WIN0],
    ['exp∘Cayley, |z+i|<1.5', [{ type: 'mobius' }, { type: 'exp' }], { kind: 'disc', c: [0, -1], r: 1.5 }, WIN0],
    ['exp∘Cayley, H', [{ type: 'mobius' }, { type: 'exp' }], H, WIN0],
  ];
  for (const cy of [-6, -20, -200]) CASES.push([`exp(H), view centred at Im z = ${cy}`, [{ type: 'exp' }], H, sub(cy), { box: { x0: -20, x1: 5, y0: 0, y1: 400 } }]);
  for (const [name, steps, shape, win, o] of CASES) {
    const r = coverRun(name, steps, shape, win, QUICK ? 300 : 1500, o || {});
    console.log(showRun(r));
    check(`budget case ${name}`, !r.forward && r.miss === 0 && r.n > 0, r.forward || JSON.stringify(r.ex));
  }
  const verdict = (name, steps, shape, want) => {
    const { plan } = planOf(steps);
    const prep = Inverse.prepare(plan, { win: WIN0, shape });
    console.log(`${name.padEnd(46)} -> ${prep.ok ? 'inverse' : 'forward (' + prep.reason + ')'}`);
    check(`verdict ${name}`, !prep.ok && prep.reason === want, prep.reason);
  };
  verdict('exp∘exp of H', [{ type: 'exp' }, { type: 'exp' }], H, 'unbounded range outside the innermost family');
  verdict('e^{z^2} of H', [{ type: 'custom', params: { expr: 'e^{z^2}', cut: 180 } }], H, 'unbounded shape through a non-affine prefix');
  verdict('exp of an annulus 100 < |z| < 300', [{ type: 'exp' }], { kind: 'annulus', c: [0, 0], r1: 100, r2: 300 }, 'bounded range too long for a non-convex shape');
  verdict('exp of a 70-vertex polygon', [{ type: 'exp' }], { kind: 'polygon', pts: Array.from({ length: 70 }, (_, i) => [Math.cos(i * TAU / 70), Math.sin(i * TAU / 70)]) }, 'polygon with more than 64 vertices');
  verdict('exp of an unrecognised formula', [{ type: 'exp' }], { kind: 'formula', expr: '|z-1|>2' }, 'unrecognised formula under a window family');
  verdict('2^{M(z)} of H, the pole of M on the boundary', [{ type: 'mobius', params: { a: '1', b: '0.5', c: '0.4', d: '1' } }, { type: 'custom', params: { expr: '2^{z}', cut: 180 } }], H, 'unbounded shape through a non-affine prefix');
  verdict('e^{1/z} of |z - 1| < 1 (pole on the boundary)', [{ type: 'recip' }, { type: 'exp' }], { kind: 'disc', c: [1, 0], r: 1 }, 'unbounded shape through a non-affine prefix');
  // recognised formulas stay eligible under a window family
  for (const f of ['|\\Im z|<\\frac{\\pi}{2}', '|\\Re z|<\\frac{\\pi}{2}, \\Im z>0', '\\Re z > 1']) {
    const prep = Inverse.prepare(planOf([{ type: 'exp' }]).plan, { win: WIN0, shape: { kind: 'formula', expr: f } });
    check(`formula ${f} under exp is eligible`, prep.ok, prep.reason);
  }
  // a large parameter keeps budgets bounded; the prep of a sector apex in the shape closure has an unbounded log range
  const zi = Inverse.prepare(planOf([{ type: 'powa', params: { alpha: 'i' } }]).plan, { win: WIN0, shape: H });
  check('z^i(H): one window of 17, ray clip, AFF stop', zi.ok && zi.N[0] === 17 && zi.rspec[0].kind === 'clip' && zi.stopOp === 0, JSON.stringify(zi.N));
  const e1z = Inverse.prepare(planOf([{ type: 'recip' }, { type: 'exp' }]).plan, { win: WIN0, shape: { kind: 'disc', c: [0, 0], r: 1 } });
  check('e^{1/z} disc: farCover box, Möbius stop, P = {0}', e1z.ok && e1z.rspec[1].farCover && e1z.stopMob && e1z.stopMob.pInP && e1z.sing.length === 1 && CX.abs(e1z.sing[0]) < 1e-12);
  const ecH = Inverse.prepare(planOf([{ type: 'mobius' }, { type: 'exp' }]).plan, { win: WIN0, shape: H });
  check('exp∘Cayley of H: exact Möbius image box (bounded)', ecH.ok && ecH.rspec[1].kind === 'box' && ecH.rspec[1].exact && Number.isFinite(ecH.need[1]), JSON.stringify(ecH.rspec[1]));
}

// (c) termination and cost (review P1, findings 1 and 5). Lattice and member indices beyond 2^53 used to stall
// `n++` loops in singular() / prepare() (out of memory); each case runs in a child process with a 400 MB heap and a
// 10 s timeout, so a regression fails here instead of hanging the suite. Then prepare() of shapes whose image boxes
// used to cost 10^7 evaluations: <= IMAGEBOX_CAP evaluations per box and well under the 4 ms frame budget class.
section('(c) termination and cost');
{
  const { spawnSync } = require('child_process');
  const path = require('path');
  const boot = `global.CX = require(${JSON.stringify(path.join(__dirname, '../src/cx.js'))}); global.Expr = require(${JSON.stringify(path.join(__dirname, '../src/parse.js'))});
    global.Funcs = require(${JSON.stringify(path.join(__dirname, '../src/funcs.js'))}); global.Region = require(${JSON.stringify(path.join(__dirname, '../src/region.js'))});
    const I = require(${JSON.stringify(path.join(__dirname, '../src/inverse.js'))});
    const St = (s) => ({ type: s.type, params: Object.assign(Funcs.defaults(s.type), s.params || {}), on: true });
    const plan = (l) => { const st = l.map(St); return I.planChain(st, st.map(Funcs.build)); };
    const box = (cx, cy, s) => ({ x0: cx - 205 / s, x1: cx + 205 / s, y0: cy - 258 / s, y1: cy + 258 / s });`;
  const HANG = [
    ['[exp, tan, exp] prepare, view at 40', `I.prepare(plan([{type:'exp'},{type:'tan'},{type:'exp'}]), {win: box(40, 0, 60), shape: {kind:'disc', c:[40,0], r:1}})`],
    ['[exp, tan] singular poles, view at 40', `I.singular(plan([{type:'exp'},{type:'tan'}]), box(40, 0, 60), ['pole'], 16)`],
    ['[exp, sin, z^i] prepare, view at 40+0.5i', `I.prepare(plan([{type:'exp'},{type:'sin'},{type:'powa',params:{alpha:'i'}}]), {win: box(40, 0.5, 60), shape: {kind:'disc', c:[40,0.5], r:0.1}})`],
    ['tan(z^16) singular poles, view at 12', `I.singular(plan([{type:'pown',params:{n:16}},{type:'tan'}]), box(12, 0, 60), ['pole'], 16)`],
    ['[z^16, tan, exp] prepare, view at 12', `I.prepare(plan([{type:'pown',params:{n:16}},{type:'tan'},{type:'exp'}]), {win: box(12, 0, 60), shape: {kind:'disc', c:[12,0], r:0.01}})`],
    ['[z^16, sin, z^i] prepare, view at 12+0.1i', `I.prepare(plan([{type:'pown',params:{n:16}},{type:'sin'},{type:'powa',params:{alpha:'i'}}]), {win: box(12, 0.1, 60), shape: {kind:'disc', c:[12,0.1], r:0.01}})`],
    ['[sinh, tanh, exp] prepare (fuzz seed 2)', `I.prepare(plan([{type:'sinh'},{type:'tanh'},{type:'exp'}]), {win: {x0: 81.0574, x1: 87.8908, y0: 52.7075, y1: 61.3075}, shape: {kind:'halfplane', a:[-61.2,52.77], b:[-61.56,51.83]}})`],
    ['z^i on sheet 1e17 prepare', `I.prepare(plan([{type:'powa',params:{alpha:'i',k:1e17}}]), {win: box(0, 0, 60), shape: {kind:'disc', c:[1,0.5], r:0.3}})`],
    ['[sin, z^{1e-13+i}] on sheet 1e15', `I.prepare(plan([{type:'sin'},{type:'powa',params:{alpha:'1e-13+i',k:1e15}}]), {win: box(3, 0, 60), shape: {kind:'disc', c:[3,0.5], r:0.3}})`],
    ['[exp, powa 1e12] prepare', `I.prepare(plan([{type:'exp'},{type:'powa',params:{alpha:'1e12'}}]), {win: box(5, 0, 60), shape: {kind:'disc', c:[1,0.5], r:0.3}})`],
    // enumerate on a Prep with ok = false (N = [4, Infinity]) outside truth mode: bounded scan, no endless walk
    ['enumerate on a failed prep', `(() => { const p = plan([{type:'sin'},{type:'powa',params:{alpha:'0.5i'}}]); const pr = I.prepare(p, {win: box(0, 0, 60), shape: {kind:'disc', c:[0.3,0], r:0.6}}); return I.enumerate(p, pr, CX.C(-0.18597168, -0.54400049), 1e-4, {K: 16, B: 16}).leaves; })()`],
  ];
  for (const [name, code] of HANG) {
    const t0 = Date.now();
    const r = spawnSync(process.execPath, ['--max-old-space-size=400', '-e', `${boot} const t0 = Date.now(); const r = ${code}; console.log(Date.now() - t0, Array.isArray(r) ? r.length + ' points' : (r.ok ? 'ok' : r.reason));`], { timeout: 10000, encoding: 'utf8' });
    const how = r.error && r.error.code === 'ETIMEDOUT' ? 'HUNG' : r.status !== 0 ? `CRASHED ${(r.stderr.match(/FATAL ERROR[^\n]*|Error[^\n]*/) || [''])[0]}` : null;
    const out = (r.stdout || '').trim().split(' ');
    console.log(`${name.padEnd(42)} ${how || `${out[0]} ms: ${out.slice(1).join(' ')}`} (${Date.now() - t0} ms with node start)`);
    check(`terminates: ${name}`, !how && +out[0] < 2000, how || r.stdout);
  }
  // prepare() cost: the reviewer's slow cases (1-5 s and up to 4.5e7 evaluations before) and eligible everyday shapes
  const SLOW = [
    ['exp∘exp, disc r=1 at 8', [{ type: 'exp' }, { type: 'exp' }], { kind: 'disc', c: [8, 0], r: 1 }],
    ['[cosh, z^{0.3+i}, tan] disc', [{ type: 'cosh' }, { type: 'powa', params: { alpha: '0.3+i', cut: -400, k: 2 } }, { type: 'tan' }], { kind: 'disc', c: [-30.69, -19.21], r: 0.248 }],
    ['[ijouk, cosh, exp] rect', [{ type: 'ijouk' }, { type: 'cosh' }, { type: 'exp' }], { kind: 'rect', a: [5.57, 27.32], b: [4.45, 27.84] }],
    ['sinh(z^2+4) then blaschke, |z| < 28.5', [{ type: 'poly', params: { co: '1, 0, 4' } }, { type: 'sinh' }, { type: 'blaschke', params: { a: '-0.56-0.44i', phi: -102 } }], { kind: 'formula', expr: '|z|<28.542' }],
    ['tan(z^3), disc at 38.6+48.1i', [{ type: 'pown', params: { n: 3 } }, { type: 'tan' }], { kind: 'disc', c: [38.56, 48.08], r: 0.071 }],
    ['exp∘exp, |z| < 3 (eligible)', [{ type: 'exp' }, { type: 'exp' }], { kind: 'disc', c: [0, 0], r: 3 }],
    ['sin(z^2), |z - 30| < 1 (eligible)', [{ type: 'pown', params: { n: 2 } }, { type: 'sin' }], { kind: 'disc', c: [30, 0], r: 1 }],
    ['e^{z^3}, |z - 5| < 0.5 (eligible)', [{ type: 'pown', params: { n: 3 } }, { type: 'exp' }], { kind: 'disc', c: [5, 0], r: 0.5 }],
  ];
  for (const [name, steps, shape] of SLOW) {
    const { plan } = planOf(steps);
    let p, ms = Infinity;
    for (let rep = 0; rep < 3; rep++) {                                 // best of 3: other processes may share the machine
      const t0 = process.hrtime.bigint();
      p = Inverse.prepare(plan, { win: WIN0, shape });
      ms = Math.min(ms, Number(process.hrtime.bigint() - t0) / 1e6);
    }
    const ev = p.rspec.map((sp) => (sp && sp.evals) || 0);
    console.log(`prepare ${name.padEnd(40)} ${ms.toFixed(2)} ms, box evaluations ${ev.filter((x) => x).join(', ') || 0}: ${p.ok ? 'inverse N ' + p.N.join('x') : p.reason}`);
    check(`prepare cost ${name}`, ms < 50 && ev.every((x) => x <= Inverse.IMAGEBOX_CAP), `${ms} ms, evaluations ${ev}`);
  }
}

// =================================================================================================
// (d) the early stop is exact (front K = full enumeration where no window is truncated; within 0.01 octave)
// =================================================================================================
section('(d) early stop');
{
  const sameFront = (a, b) => a.length === b.length && a.every((x, i) => CX.abs(CX.sub(x.z, b[i].z)) <= 1e-9 * (1 + CX.abs(x.z)));
  function trial(plan, shape, win, view, K, stride) {
    const prep = Inverse.prepare(plan, { win, shape });
    if (!prep.ok) return { forward: prep.reason };
    let px = 0, wrong = 0, wrongTr = 0, gap = 0, vis = 0;
    for (let j = 0; j < 516; j += stride) for (let i = 0; i < 410; i += stride) {
      const w = C(view.cx + (i + 0.5 - 205) / view.s, view.cy - (j + 0.5 - 258) / view.s);
      const tr = Inverse.enumerate(plan, prep, w, 1 / view.s, { K, full: 60, leaves: false }).entries.slice(0, K);
      if (!tr.length) continue;
      px++;
      const r = Inverse.enumerate(plan, prep, w, 1 / view.s, { K, leaves: false });
      vis += r.visited;
      const got = r.entries.slice(0, K);
      if (!sameFront(got, tr)) {
        if (!r.truncated) wrong++;
        else { wrongTr++; gap = Math.max(gap, got.length ? got[0].D - tr[0].D : Infinity); }
      }
    }
    return { px, wrong, wrongTr, gap, vis };
  }
  const CASES = [
    ['e^{1/z} on |z|<1', [{ type: 'recip' }, { type: 'exp' }], { kind: 'disc', c: [0, 0], r: 1 }, 0, 40],
    ['exp(Cayley) on |z+i|<1.5', [{ type: 'mobius' }, { type: 'exp' }], { kind: 'disc', c: [0, -1], r: 1.5 }, -1, 40],
    ['exp(H)', [{ type: 'exp' }], H, 1, 40],
    ['z^i(H)', [{ type: 'powa', params: { alpha: 'i' } }], H, 1, 40],
    ['tan(2z+1) on |z|<3', [{ type: 'affine', params: { a: '2', b: '1' } }, { type: 'tan' }], { kind: 'disc', c: [0, 0], r: 3 }, 0, 40],
  ];
  const FAMS = [['EXP', { type: 'exp' }, H], ['EXPC', { type: 'custom', params: { expr: '2^{z}', cut: 180 } }, H], ['SIN', { type: 'sin' }, { kind: 'rect', a: [-1, 0], b: [8, 2] }],
    ['COS', { type: 'cos' }, { kind: 'disc', c: [1, 0.5], r: 3 }], ['TAN', { type: 'tan' }, { kind: 'halfplane', a: [0, 0.2], b: [1, 0.2] }], ['SINH', { type: 'sinh' }, { kind: 'rect', a: [0, -1], b: [2, 9] }],
    ['COSH', { type: 'cosh' }, { kind: 'disc', c: [0.5, 1], r: 3 }], ['TANH', { type: 'tanh' }, { kind: 'halfplane', a: [0.2, 0], b: [0.2, -1] }], ['ROOTPOW inf', { type: 'powa', params: { alpha: '2i' } }, { kind: 'sector', c: [0, 0], r: 0, t1: 10, t2: 170 }]];
  for (const [nm, st, shape] of FAMS) {
    CASES.push([`${nm}`, [st], shape, 0.5, 8]);
    CASES.push([`${nm} after AFF`, [{ type: 'affine', params: { a: '0.7+0.4i', b: '0.3' } }, st], shape, 0.5, 8]);
    CASES.push([`${nm} then MOB`, [st, { type: 'mobius', params: { a: '1', b: '2', c: '0.3', d: '1+i' } }], shape, 0.5, 8]);
    if (nm !== 'ROOTPOW inf') CASES.push([`${nm} after MOB`, [{ type: 'mobius', params: { a: '1', b: '0.5', c: '0.4', d: '1-0.8i' } }, st], shape, 0.5, 8]);
  }
  for (const [name, steps, shape, cy0, views] of CASES) {
    const { plan } = planOf(steps);
    for (const K of [1, 3]) {
      seed = 99;
      let tot = 0, wrong = 0, wrongTr = 0, gap = 0, vis = 0, fwd = 0;
      const nv = QUICK ? Math.min(views, 8) : views;
      for (let t = 0; t < nv; t++) {
        const s = 60 * Math.pow(50, rnd()), cxv = (rnd() * 2 - 1) * 0.8, cyv = (rnd() * 2 - 1) * 0.8 + cy0;
        const win = { x0: cxv - 205 / s, x1: cxv + 205 / s, y0: cyv - 258 / s, y1: cyv + 258 / s };
        const r = trial(plan, shape, win, { cx: 0, cy: 0, s: 40 }, K, views >= 40 ? 14 : 18);
        if (r.forward) { fwd++; continue; }
        tot += r.px; wrong += r.wrong; wrongTr += r.wrongTr; gap = Math.max(gap, r.gap); vis += r.vis;
      }
      console.log(`${name.padEnd(28)} K=${K}: ${nv} views, px ${tot}, mismatches without truncation ${wrong}, inside truncated windows ${wrongTr} (front-key gap ${gap.toFixed(4)} octave), leaves/px ${(vis / Math.max(1, tot)).toFixed(1)}${fwd ? `, forward views ${fwd}` : ''}`);
      check(`early stop ${name} K=${K}`, wrong === 0 && gap <= 0.01 && tot > 0, `wrong ${wrong} gap ${gap}`);
    }
  }
  // Review P1, finding 3: the AFF-prefix stop must hold where D is not unimodal along the member line (P points off
  // the line: a family followed by a non-real power) and where the scan does not start at the D minimum (a rotated
  // prefix, a non-square, off-centre left view, D_K from the other base). The reviewer's three pixels first, then
  // random views with centres within +-10, aspect ratios 1/4..4 and 4..80 px per unit.
  const STOPS = [
    ['sin∘z^{0.5+0.5i} on H', [{ type: 'sin' }, { type: 'powa', params: { alpha: '0.5+0.5i' } }], { x0: -13.441024143992228, x1: 8.60042248608354, y0: -11.866015724846067, y1: 15.87395125349319 }, C(0.86944444, 0.056666667), 1 / 60],
    ['sinh((0.96+0.28i)z) on H', [{ type: 'affine', params: { a: '0.96+0.28i', b: '0' } }, { type: 'sinh' }], { x0: 1.1302840752749583, x1: 15.295811717947167, y0: -12.217919052556617, y1: 5.609915736757675 }, C(-1.4083333, -0.23), 1 / 20],
    ['sinh((0.8+0.6i)z+0.3) on H', [{ type: 'affine', params: { a: '0.8+0.6i', b: '0.3' } }, { type: 'sinh' }], { x0: -2.07391279256092, x1: 3.5120622998293216, y0: -2.325692679345213, y1: 4.704461339370311 }, C(0.12916667, -6.035), 1 / 40],
  ];
  for (const [name, steps, win, w, pix] of STOPS) {
    const { plan } = planOf(steps);
    const prep = Inverse.prepare(plan, { win, shape: H });
    const r = Inverse.enumerate(plan, prep, w, pix, { K: 1 }), full = Inverse.enumerate(plan, prep, w, pix, { K: 1, full: 60 });
    const a = r.entries[0], b = full.entries[0];
    check(`early stop, reviewer pixel: ${name}`, prep.ok && !r.truncated && a && b && CX.abs(CX.sub(a.z, b.z)) <= 1e-9 * (1 + CX.abs(b.z)), `${a && CX.fmt(a.z)} (D ${a && a.D}) vs ${b && CX.fmt(b.z)} (D ${b && b.D})`);
  }
  const rotA = { type: 'affine', params: { a: '0.96+0.28i', b: '0.3' } };
  const ODD = [
    ['sin∘z^{0.5+0.5i}', [{ type: 'sin' }, { type: 'powa', params: { alpha: '0.5+0.5i' } }], H],
    ['sin∘z^{2+i}', [{ type: 'sin' }, { type: 'powa', params: { alpha: '2+i' } }], H],
    ['cosh∘z^{0.7-0.4i}', [{ type: 'cosh' }, { type: 'powa', params: { alpha: '0.7-0.4i' } }], { kind: 'rect', a: [-2, -1], b: [3, 9] }],
    ['[(1+i)z, exp, z^2]', [{ type: 'affine', params: { a: '1+i', b: '0' } }, { type: 'exp' }, { type: 'pown', params: { n: 2 } }], H],
    ['rotated AFF, exp', [rotA, { type: 'exp' }], H], ['rotated AFF, sin', [rotA, { type: 'sin' }], H], ['rotated AFF, cos', [rotA, { type: 'cos' }], H],
    ['rotated AFF, sinh', [rotA, { type: 'sinh' }], H], ['rotated AFF, cosh', [rotA, { type: 'cosh' }], H], ['rotated AFF, tan', [rotA, { type: 'tan' }], { kind: 'halfplane', a: [0, 0.2], b: [1, 0.2] }],
    ['rotated AFF, tanh', [rotA, { type: 'tanh' }], { kind: 'halfplane', a: [0.2, 0], b: [0.2, -1] }],
    ['rotated AFF, z^{2i}', [rotA, { type: 'powa', params: { alpha: '2i' } }], { kind: 'sector', c: [-0.3, 0], r: 0, t1: 10, t2: 170 }],
  ];
  for (const [name, steps, shape] of ODD) {
    const { plan } = planOf(steps);
    for (const K of [1, 3]) {
      seed = 4711;
      let tot = 0, wrong = 0, gap = 0, vis = 0, fwd = 0;
      const nv = QUICK ? 4 : 10;
      for (let t = 0; t < nv; t++) {
        const s = 4 * Math.pow(20, rnd()), asp = Math.pow(4, rnd() * 2 - 1), cxv = (rnd() * 2 - 1) * 10, cyv = (rnd() * 2 - 1) * 10;
        const hw = 205 / s * Math.sqrt(asp), hh = 258 / s / Math.sqrt(asp);
        const r = trial(plan, shape, { x0: cxv - hw, x1: cxv + hw, y0: cyv - hh, y1: cyv + hh }, { cx: 0.3, cy: 0.2, s: 40 }, K, 18);
        if (r.forward) { fwd++; continue; }
        tot += r.px; wrong += r.wrong; gap = Math.max(gap, r.gap); vis += r.vis;
      }
      console.log(`${name.padEnd(28)} K=${K}: ${nv} off-centre views, px ${tot}, mismatches without truncation ${wrong}, truncated front-key gap ${gap.toFixed(4)}, leaves/px ${(vis / Math.max(1, tot)).toFixed(1)}${fwd ? `, forward views ${fwd}` : ''}`);
      check(`early stop off-centre ${name} K=${K}`, wrong === 0 && gap <= 0.01 && tot > 0, `wrong ${wrong} gap ${gap}`);
    }
  }
}

// =================================================================================================
// (e) completeness fuzz: random shapes anywhere in +-100, reference at the default clipWin centre, 4 zooms
// =================================================================================================
section('(e) completeness fuzz');
{
  const CHAINS = [
    ['exp', [{ type: 'exp' }]], ['tan', [{ type: 'tan' }]], ['sin', [{ type: 'sin' }]], ['cosh', [{ type: 'cosh' }]],
    ['e^{10z}', [{ type: 'custom', params: { expr: 'e^{10z}', cut: 180 } }]], ['exp∘exp', [{ type: 'exp' }, { type: 'exp' }]],
    ['e^{z^2}', [{ type: 'custom', params: { expr: 'e^{z^2}', cut: 180 } }]], ['tan∘exp', [{ type: 'exp' }, { type: 'tan' }]],
    ['e^{1/z^2}', [{ type: 'custom', params: { expr: 'e^{\\frac{1}{z^2}}', cut: 180 } }]], ['z^i', [{ type: 'powa', params: { alpha: 'i', cut: 180, k: 0 } }]],
    ['e^{1/z}', [{ type: 'recip' }, { type: 'exp' }]], ['powa 17.5', [{ type: 'powa', params: { alpha: '17.5', cut: 180, k: 0 } }]],
    ['powa 0.5+2i', [{ type: 'powa', params: { alpha: '0.5+2i', cut: 90, k: 1 } }]], ['exp∘Cayley', [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' } }, { type: 'exp' }]],
  ];
  const randShape = () => {
    const k = Math.floor(rnd() * 8), c = [(rnd() * 2 - 1) * 100, (rnd() * 2 - 1) * 100], r = 0.05 * Math.pow(100, rnd());
    if (k === 0) return { kind: 'disc', c, r };
    if (k === 1) return { kind: 'rect', a: c, b: [c[0] + r * (rnd() * 2 - 1) * 2, c[1] + r * (rnd() * 2 - 1) * 2] };
    if (k === 2) { const t = rnd() * 360; return { kind: 'halfplane', a: c, b: [c[0] + Math.cos(t * DEG), c[1] + Math.sin(t * DEG)] }; }
    if (k === 3) { const t1 = rnd() * 360; return { kind: 'sector', c, r: rnd() < 0.5 ? 0 : r, t1, t2: t1 + 10 + rnd() * 300 }; }
    if (k === 4) return { kind: 'annulus', c, r1: r * 0.4, r2: r };
    if (k === 5) { const pts = []; for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + rnd(); const rr = r * (0.5 + rnd()); pts.push([c[0] + rr * Math.cos(a), c[1] + rr * Math.sin(a)]); } return { kind: 'polygon', pts }; }
    if (k === 6) return { kind: 'disc', c, r, complement: true };
    return { kind: 'formula', expr: `${(c[0] - r).toFixed(3)} < \\Re z < ${(c[0] + r).toFixed(3)}, \\Im z > ${c[1].toFixed(3)}` };
  };
  const NS = QUICK ? 10 : 40;
  seed = 7;
  for (const [cn, chain] of CHAINS) {
    let tot = 0, miss = 0, fwd = 0, shapes = 0, worst = null;
    const reasons = {};
    const sk0 = skipped;
    for (const zf of [1, 0.25, 1 / 16, 4]) {
      const win = boxOf(0, 0, 60 * zf);
      for (let t = 0; t < NS; t++) {
        const sh = randShape(); shapes++;
        const r = coverRun(cn, chain, sh, win, 60);
        if (r.forward) { fwd++; reasons[r.forward] = (reasons[r.forward] || 0) + 1; continue; }
        tot += r.n; miss += r.miss;
        if (r.miss && !worst) worst = { sh, miss: r.miss, n: r.n, ex: r.ex };
      }
    }
    console.log(`${cn.padEnd(12)} shapes ${shapes}, forward ${fwd}, samples ${tot} (ill-conditioned skipped ${skipped - sk0}), missed ${miss}${fwd ? '  forward: ' + JSON.stringify(reasons) : ''}`);
    check(`completeness fuzz ${cn}`, miss === 0, JSON.stringify(worst));
  }
  // every catalog step (and custom formulas through the decomposition) on its own, through the production walk
  // (shape ranges, budgets, early stop), fewer shapes
  const EVERY = [
    ['mul', {}], ['add', {}], ['affine', {}], ['recip', {}], ['mobius', {}], ['blaschke', { a: '0.3+0.4i', phi: 40 }], ['pown', { n: 3 }], ['pown', { n: -2 }],
    ['root', { n: 3, cut: 45, k: 1 }], ['powa', { alpha: '1.5', cut: -120, k: 1 }], ['powa', { alpha: 'i', cut: 60, k: -1 }], ['exp', {}], ['log', { cut: 100, k: 1 }],
    ['sin', {}], ['cos', {}], ['tan', {}], ['sinh', {}], ['cosh', {}], ['tanh', {}], ['arcsin', {}], ['arccos', {}], ['arctan', {}], ['arsinh', {}], ['arcosh', {}], ['artanh', {}],
    ['joukowski', {}], ['ijouk', { branch: 'exterior' }], ['ijouk', { branch: 'interior' }], ['conj', {}], ['poly', { co: '1, 2-i, 3' }], ['poly', { co: '2, 0, 0, 0, 1' }],
    ['rational', { p: '1, 0, 1', q: '1, 0' }], ['rational', { p: '1, -i', q: '1, i' }],
    ['custom', { expr: '\\cot z', cut: 180 }], ['custom', { expr: '\\log(\\log z)', cut: 180 }], ['custom', { expr: '(z+1)^{1.5}', cut: 60 }], ['custom', { expr: '\\overline{z}^2', cut: 180 }],
    ['custom', { expr: '3-\\frac{2}{z+i}', cut: 180 }], ['custom', { expr: '\\sec(z)', cut: 180 }], ['custom', { expr: 'i^{z}', cut: 180 }],
  ];
  const NE = QUICK ? 3 : 10;
  for (const [type, params] of EVERY) {
    let tot = 0, miss = 0, fwd = 0, worst = null;
    for (const zf of [1, 0.25, 1 / 16, 4]) {
      const win = boxOf(0, 0, 60 * zf);
      for (let t = 0; t < NE; t++) {
        const sh = randShape();
        const r = coverRun(type, [{ type, params }], sh, win, 40);
        if (r.forward) { fwd++; continue; }
        tot += r.n; miss += r.miss;
        if (r.miss && !worst) worst = { sh, miss: r.miss, n: r.n, ex: r.ex };
      }
    }
    check(`completeness ${type} ${JSON.stringify(params)}`, miss === 0 && tot > 0, `${miss}/${tot} ${JSON.stringify(worst)}`);
    if (miss || !tot) console.log(`${type} ${JSON.stringify(params)}: samples ${tot}, missed ${miss}, forward ${fwd}`);
  }
  console.log(`every catalog step: ${EVERY.length} steps checked`);
}

// =================================================================================================
// (f) singular points
// =================================================================================================
section('(f) singular points');
{
  const sing = (steps, kinds, cap) => Inverse.singular(planOf(steps).plan, WIN0, kinds, cap);
  const has = (list, kind, z) => list.some((e) => e.kind === kind && CX.abs(CX.sub(e.z, z)) < 1e-9);
  const zs = (list, kind) => list.filter((e) => e.kind === kind);
  check('e^{1/z}: undef {0}', (() => { const l = zs(sing([{ type: 'custom', params: { expr: 'e^{1/z}' } }], ['undef']), 'undef'); return l.length === 1 && has(l, 'undef', C(0, 0)); })());
  check('[recip, exp]: undef {0}', (() => { const l = sing([{ type: 'recip' }, { type: 'exp' }], ['undef']); return l.length === 1 && has(l, 'undef', C(0, 0)); })());
  check('z^i: undef {0}', (() => { const l = sing([{ type: 'powa', params: { alpha: 'i' } }], ['undef']); return l.length === 1 && has(l, 'undef', C(0, 0)); })());
  check('log(z-1): branch {1}', (() => { const l = sing([{ type: 'custom', params: { expr: '\\log(z-1)' } }], ['branch']); return l.length === 1 && has(l, 'branch', C(1, 0)); })());
  check('Cayley: pole {-i}', (() => { const l = sing([{ type: 'mobius' }], ['pole']); return l.length === 1 && has(l, 'pole', C(0, -1)); })());
  check('exp: nothing finite', sing([{ type: 'exp' }]).length === 0);
  check('exp∘Cayley: P = {-i}', (() => { const P = Inverse.accumulation(planOf([{ type: 'mobius' }, { type: 'exp' }]).plan, WIN0); return P.length === 1 && CX.abs(CX.sub(P[0], C(0, -1))) < 1e-12; })());
  check('exp, sin, log, Cayley: P = {}', ['exp', 'sin', 'log', 'mobius'].every((t) => Inverse.accumulation(planOf([{ type: t }]).plan, WIN0).length === 0));
  const tz = sing([{ type: 'custom', params: { expr: '\\tan z' } }], ['pole']);
  check('tan z: poles at pi/2 + n pi in the 3x window', tz.length >= 4 && tz.every((e) => Math.abs(e.z.im) < 1e-12 && Math.abs(((e.z.re - PI / 2) / PI) - Math.round((e.z.re - PI / 2) / PI)) < 1e-9), tz.map((e) => CX.fmt(e.z)).join(' '));
  // caps and cost: tan(H) with a wide window and tan(1/z)
  const WIDE = boxOf(0, 0, 0.3);
  for (const [name, steps, win] of [['tan (wide window)', [{ type: 'tan' }], WIDE], ['tan(1/z)', [{ type: 'recip' }, { type: 'tan' }], WIN0], ['tan(1/z) (wide)', [{ type: 'recip' }, { type: 'tan' }], WIDE],
    ['tan∘exp', [{ type: 'exp' }, { type: 'tan' }], WIN0], ['tan(tan z)', [{ type: 'tan' }, { type: 'tan' }], WIN0]]) {
    const { plan } = planOf(steps);
    Inverse.singular(plan, win);
    const t0 = process.hrtime.bigint(), N = 20;
    let l; for (let i = 0; i < N; i++) l = Inverse.singular(plan, win, ['undef', 'branch', 'pole'], 16);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6 / N;
    const per = {}; for (const e of l) per[e.kind] = (per[e.kind] || 0) + 1;
    console.log(`singular ${name.padEnd(18)} ${ms.toFixed(3)} ms per call, ${JSON.stringify(per)}`);
    check(`singular ${name}: <= 16 per kind, < 2 ms`, Object.values(per).every((x) => x <= 16) && ms < 2, `${ms} ms ${JSON.stringify(per)}`);
  }
}

// =================================================================================================
// (j) shape geometry: supportOf, clipPrimitive / shapeClip, the recognizer, imageBox
// =================================================================================================
section('(j) shape geometry');
{
  seed = 4242;
  const randShape = () => {
    const k = Math.floor(rnd() * 9), c = [(rnd() * 2 - 1) * 5, (rnd() * 2 - 1) * 5], r = 0.3 + rnd() * 3;
    const cmp = rnd() < 0.3;
    if (k === 0) return { kind: 'disc', c, r, complement: cmp };
    if (k === 1) return { kind: 'rect', a: c, b: [c[0] + (rnd() * 2 - 1) * 4, c[1] + (rnd() * 2 - 1) * 4], complement: cmp };
    if (k === 2) { const t = rnd() * 360; return { kind: 'halfplane', a: c, b: [c[0] + Math.cos(t * DEG), c[1] + Math.sin(t * DEG)], complement: cmp }; }
    if (k === 3) { const t1 = rnd() * 360; return { kind: 'sector', c, r: rnd() < 0.5 ? 0 : r, t1, t2: t1 + 10 + rnd() * 340, complement: cmp }; }
    if (k === 4) return { kind: 'annulus', c, r1: r * 0.4, r2: r, complement: cmp };
    if (k === 5) { const pts = []; const nv = 3 + Math.floor(rnd() * 6); for (let i = 0; i < nv; i++) { const a = i * TAU / nv + rnd() * 0.5; const rr = r * (0.5 + rnd()); pts.push([c[0] + rr * Math.cos(a), c[1] + rr * Math.sin(a)]); } return { kind: 'polygon', pts, complement: cmp }; }
    if (k === 6) { const pts = []; for (let i = 0; i < 5; i++) { const a = i * TAU / 5; pts.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]); } return { kind: 'polygon', pts, complement: cmp }; }
    if (k === 7) return { kind: 'formula', expr: `|\\Im z - ${c[1].toFixed(2)}| < ${r.toFixed(2)}, \\Re z > ${c[0].toFixed(2)}`, complement: cmp };
    return { kind: 'formula', expr: `|z| < ${r.toFixed(2)} or \\Re z < ${c[0].toFixed(2)}`, complement: cmp };
  };
  let supBad = 0, clipBad = 0, holeBad = 0, convexBad = 0, samples = 0, ex = '';
  for (let t = 0; t < (QUICK ? 150 : 400); t++) {
    const s = randShape(), L = Region.levelOf(s), prim = Region.clipPrimitive(s), cvx = Region.convexOf(s);
    const pts = [];
    for (let i = 0; i < 400; i++) { const z = C((rnd() * 2 - 1) * 14, (rnd() * 2 - 1) * 14); if (L(z) > 1e-9) pts.push(z); }
    samples += pts.length;
    for (let d = 0; d < 64; d++) {
      const e = C(Math.cos(d * TAU / 64 + 0.01), Math.sin(d * TAU / 64 + 0.01));
      const [lo, hi] = Region.supportOf(s, e);
      for (const z of pts) { const v = z.re * e.re + z.im * e.im; if (v < lo - 1e-9 || v > hi + 1e-9) { supBad++; if (!ex) ex = JSON.stringify(s); break; } }
    }
    // halfplane supports in their own normal direction are one-sided
    for (let li = 0; li < 6; li++) {
      const z0 = C((rnd() * 2 - 1) * 10, (rnd() * 2 - 1) * 10), q = C(Math.cos(rnd() * TAU), Math.sin(rnd() * TAU));
      const r = Region.shapeClip(prim, z0, q);
      for (let i = 0; i < 300; i++) {
        const tt = (rnd() * 2 - 1) * 30, z = CX.add(z0, CX.scale(q, tt)), inside = L(z) > 1e-9;
        if (inside && !(tt >= r.lo - 1e-9 && tt <= r.hi + 1e-9)) { clipBad++; if (!ex) ex = JSON.stringify(s); }
        if (inside && r.hlo < r.hhi && tt > r.hlo + 1e-9 && tt < r.hhi - 1e-9) { holeBad++; if (!ex) ex = JSON.stringify(s); }
        // an exact convex primitive: inside the interval means inside the shape (away from the boundary)
        if (cvx && !inside && tt > r.lo + 1e-6 && tt < r.hi - 1e-6 && L(z) < -1e-6) { convexBad++; if (!ex) ex = 'convex ' + JSON.stringify(s); }
      }
    }
  }
  check('supportOf contains the shape (64 directions)', supBad === 0, ex);
  check('shapeClip: inside points lie in [lo, hi]', clipBad === 0, ex);
  check('shapeClip: inside points lie outside the hole', holeBad === 0, ex);
  check('convexOf: the clip interval is exact', convexBad === 0, ex);
  console.log(`supportOf / shapeClip: ${samples} inside samples, support misses ${supBad}, clip misses ${clipBad}, hole misses ${holeBad}, convex misses ${convexBad}`);
  const hp = { kind: 'halfplane', a: [0, 1], b: [1, 1] };
  const sp = Region.supportOf(hp, C(0, 1)), sn = Region.supportOf(hp, C(0, -1)), so = Region.supportOf(hp, C(1, 0));
  check('halfplane support one-sided along its normal', sp[0] === 1 && sp[1] === Infinity && sn[0] === -Infinity && sn[1] === -1 && so[0] === -Infinity && so[1] === Infinity);
  // the recognizer
  const fb = (e) => Region.formulaBox({ kind: 'formula', expr: e });
  const near = (a, b) => a === b || Math.abs(a - b) < 1e-12;
  const eqb = (b, x0, x1, y0, y1, convex) => near(b.x0, x0) && near(b.x1, x1) && near(b.y0, y0) && near(b.y1, y1) && b.convex === convex;
  check('recognizer |Im z| < pi/2', eqb(fb('|\\Im z|<\\frac{\\pi}{2}'), -Infinity, Infinity, -PI / 2, PI / 2, true), JSON.stringify(fb('|\\Im z|<\\frac{\\pi}{2}')));
  { const b = fb('|\\Re z|<\\frac{\\pi}{2}, \\Im z>0'); check('recognizer |Re z| < pi/2, Im z > 0', Math.abs(b.x0 + PI / 2) < 1e-12 && Math.abs(b.x1 - PI / 2) < 1e-12 && b.y0 === 0 && b.y1 === Infinity && b.convex, JSON.stringify(b)); }
  check('recognizer Re z < 2', eqb(fb('\\Re z < 2'), -Infinity, 2, -Infinity, Infinity, true));
  check('recognizer 1 < x', eqb(fb('1 < x'), 1, Infinity, -Infinity, Infinity, true));
  check('recognizer -1 < Im z < 3', eqb(fb('-1 < \\Im z < 3'), -Infinity, Infinity, -1, 3, true));
  check('recognizer |z| < 2 (bounded, not convex)', eqb(fb('|z| < 2'), -2, 2, -2, 2, false));
  check('recognizer r <= 1.5', eqb(fb('r \\le 1.5'), -1.5, 1.5, -1.5, 1.5, false));
  check('recognizer |y| > 1: whole plane', eqb(fb('|y| > 1'), -Infinity, Infinity, -Infinity, Infinity, false));
  { const b = fb('\\Re z < 0 or \\Re z > 2'); check('recognizer or clears convex', b.convex === false && b.x0 === -Infinity && b.x1 === Infinity, JSON.stringify(b)); }
  { const b = fb('|\\Re z| < 1 or |\\Im z - 0| < 0'); check('recognizer or hull', b.convex === false, JSON.stringify(b)); }
  check('recognizer not', eqb(fb('not \\Re z < 1'), -Infinity, Infinity, -Infinity, Infinity, false));
  check('recognizer |z-1| < 2 unrecognised', eqb(fb('|z-1| < 2'), -Infinity, Infinity, -Infinity, Infinity, false));
  check('formula clipPrimitive: convex box / none', Region.clipPrimitive({ kind: 'formula', expr: '|\\Im z|<1' }).exact && Region.clipPrimitive({ kind: 'formula', expr: '|z-1|<1' }) === null);
  check('convexOf: disc, rect, halfplane, sector <= 180, convex formula; not polygon, annulus, reflex sector',
    ['disc', 'rect', 'halfplane'].every((k) => Region.convexOf(Object.assign({ kind: k }, k === 'disc' ? { c: [0, 0], r: 1 } : { a: [0, 0], b: [1, 1] })))
    && Region.convexOf({ kind: 'sector', c: [0, 0], r: 0, t1: 0, t2: 120 }) && Region.convexOf({ kind: 'formula', expr: '\\Re z > 0, |\\Im z| < 1' })
    && !Region.convexOf({ kind: 'polygon', pts: [[0, 0], [1, 0], [0, 1]] }) && !Region.convexOf({ kind: 'annulus', c: [0, 0], r1: 1, r2: 2 })
    && !Region.convexOf({ kind: 'sector', c: [0, 0], r: 0, t1: 0, t2: 270 }) && !Region.convexOf({ kind: 'formula', expr: '|z|<1' }));
  // imageBox against dense sampling (1e5 points) for random bounded shapes through exp, z^2, 1/z, tan and log prefixes
  const PREF = [
    ['exp', [{ type: 'exp' }], 'add', C(0, 1)], ['z^2', [{ type: 'pown', params: { n: 2 } }], 'add', C(1, 0)], ['1/z', [{ type: 'recip' }], 'add', C(0.6, 0.8)],
    ['tan', [{ type: 'tan' }], 'add', C(0, 1)], ['log', [{ type: 'log' }], 'add', C(1, 0)], ['z^2 (log coord)', [{ type: 'pown', params: { n: 2 } }], 'log', null],
  ];
  let narrower = 0, unb = 0, tested = 0, exb = '';
  const NPTS = QUICK ? 2e4 : 1e5;
  for (let t = 0; t < 54; t++) {
    const [pn, steps, kind, e] = PREF[t % PREF.length];
    const { F, plan } = planOf(steps);
    let s;
    const c = [(rnd() * 2 - 1) * 3, (rnd() * 2 - 1) * 3], r = 0.1 + rnd() * 1.5, k = Math.floor(rnd() * 4);
    if (k === 0) s = { kind: 'disc', c, r };
    else if (k === 1) s = { kind: 'rect', a: c, b: [c[0] + (rnd() * 2 - 1) * 2, c[1] + (rnd() * 2 - 1) * 2] };
    else if (k === 2) s = { kind: 'annulus', c, r1: r * 0.3, r2: r };
    else { const pts = []; for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + rnd() * 0.6; pts.push([c[0] + r * (0.5 + rnd()) * Math.cos(a), c[1] + r * (0.5 + rnd()) * Math.sin(a)]); } s = { kind: 'polygon', pts }; }
    const coord = kind === 'add' ? Object.assign((u) => (CX.isFin(u) ? u.re * e.re + u.im * e.im : NaN), { kind: 'add', e }) : Object.assign((u) => (CX.isFin(u) && !CX.isZero(u) ? Math.log(CX.abs(u)) : NaN), { kind: 'log' });
    const bx = Inverse.imageBox(plan.ops, s, coord, kind === 'add' ? 2 * PI : 1);
    if (!Number.isFinite(bx.lo) || !Number.isFinite(bx.hi)) { unb++; continue; }
    tested++;
    const L = Region.levelOf(s), bb = Region.bboxOf(s);
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < NPTS; i++) {
      const z = C(bb.x0 + rnd() * (bb.x1 - bb.x0), bb.y0 + rnd() * (bb.y1 - bb.y0));
      if (!(L(z) > 0)) continue;
      const v = coord(F(z));
      if (!Number.isFinite(v)) continue;
      if (v < lo) lo = v; if (v > hi) hi = v;
    }
    if (lo < bx.lo - 1e-9 || hi > bx.hi + 1e-9) { narrower++; if (!exb) exb = `${pn} ${JSON.stringify(s)} box [${bx.lo}, ${bx.hi}] samples [${lo}, ${hi}]`; }
  }
  console.log(`imageBox: ${tested} bounded boxes checked against dense sampling, ${unb} unbounded (forward), narrower ${narrower}`);
  check('imageBox never narrower than dense sampling', narrower === 0 && tested >= 30, exb);
  // the exact Möbius image of unbounded generalised discs
  const cay = [C(1, 0), C(0, -1), C(1, 0), C(0, 1)], G = (z) => CX.mobApply(cay, z);
  const addI = Object.assign((u) => u.im, { kind: 'add', e: C(0, 1) }), addR = Object.assign((u) => u.re, { kind: 'add', e: C(1, 0) });
  const bH = Inverse.imageBox(G, H, addI, TAU, { mob: cay });
  check('imageBox Cayley(H) = unit disc', Math.abs(bH.lo + 1) < 1e-6 && Math.abs(bH.hi - 1) < 1e-6 && !bH.farCover, JSON.stringify(bH));
  const bH2 = Inverse.imageBox(G, { kind: 'halfplane', a: [0, 1], b: [1, 1] }, addR, TAU, { mob: cay });
  check('imageBox Cayley(Im z > 1): disc |w - 1/2| < 1/2', Math.abs(bH2.lo) < 1e-6 && Math.abs(bH2.hi - 1) < 1e-6, JSON.stringify(bH2));
  const bLow = Inverse.imageBox(G, { kind: 'halfplane', a: [1, 0], b: [0, 0] }, addI, TAU, { mob: cay, poles: [C(0, -1)] });
  check('imageBox: pole in the closure gives farCover', !Number.isFinite(bLow.lo) && bLow.farCover);
  const bC = Inverse.imageBox(G, { kind: 'disc', c: [0, -1], r: 0.5, complement: true }, addR, TAU, { mob: cay });
  check('imageBox Cayley(|z + i| > 0.5) is bounded', Number.isFinite(bC.lo) && Number.isFinite(bC.hi));
  // dense check of the Möbius boxes
  for (const sh of [H, { kind: 'halfplane', a: [0, 1], b: [1, 1] }, { kind: 'disc', c: [0, -1], r: 0.5, complement: true }, { kind: 'sector', c: [0, 0.5], r: 0, t1: 20, t2: 150 }]) {
    const b = Inverse.imageBox(G, sh, addR, TAU, { mob: cay }), L = Region.levelOf(sh);
    let worst = 0;
    for (let i = 0; i < 20000; i++) { const z = C((rnd() * 2 - 1) * 1e3 * rnd() ** 4, (rnd() * 2 - 1) * 1e3 * rnd() ** 4); if (!(L(z) > 0)) continue; const v = G(z).re; worst = Math.max(worst, b.lo - v, v - b.hi); }
    check(`Möbius imageBox contains the image of ${JSON.stringify(sh)}`, Number.isFinite(b.lo) && worst <= 1e-9, `${JSON.stringify(b)} worst ${worst}`);
  }

  // Review P1, finding 4: imageBox is rigorous. (1) Each op's disc enclosure contains the images of points sampled in
  // the disc, for every op kind, with discs on branch cuts, near poles and branch points, at scales 1e-2..1e2.
  {
    const ENC = [['mul', { c: '2-i' }], ['affine', { a: '0.3+2i', b: '1' }], ['recip'], ['mobius', { a: '1', b: '2', c: '0.5i', d: '-1' }], ['pown', { n: 3 }], ['pown', { n: -2 }], ['pown', { n: 16 }],
      ['root', { n: 3, cut: 40, k: 2 }], ['powa', { alpha: '1.5', cut: -100, k: 1 }], ['powa', { alpha: 'i' }], ['powa', { alpha: '0.3-0.7i', cut: 60, k: -1 }], ['powa', { alpha: '-0.5' }],
      ['exp'], ['log', { cut: 45, k: 1 }], ['log'], ['sin'], ['cos'], ['tan'], ['sinh'], ['cosh'], ['tanh'], ['arcsin'], ['arccos'], ['arctan'], ['arsinh'], ['arcosh'], ['artanh'],
      ['joukowski'], ['ijouk', { branch: 'exterior' }], ['ijouk', { branch: 'interior' }], ['conj'], ['poly', { co: '2, 1-i, 3' }], ['rational', { p: '1, 2, 0', q: '1, 0, -3' }], ['custom', { expr: '2^{z}' }]];
    seed = 2718;
    const kinds = new Set();
    let discs = 0, viol = 0, exv = '';
    for (const [t, p] of ENC) {
      const r = Inverse.stepOps(Funcs.build(St(t, p || {})));
      for (const o of r.ops) {
        kinds.add(o.kind);
        for (let trial = 0; trial < (QUICK ? 300 : 1200); trial++) {
          const sc = Math.pow(10, rnd() * 4 - 2);
          let c = C((rnd() * 2 - 1) * 3 * sc, (rnd() * 2 - 1) * 3 * sc);
          if (rnd() < 0.3) c = C(c.re, c.im * 1e-3);                     // on a real-axis cut
          if (rnd() < 0.2) c = C(c.re * 1e-3, c.im);                     // on an imaginary-axis cut
          const rho = Math.pow(10, -rnd() * 5) * (0.2 + CX.abs(c));
          const d = Inverse._encl.opDisc(o, c, rho);
          if (!(d.r < Infinity)) continue;
          discs++;
          for (let k = 0; k < 48; k++) {
            const a = rnd() * TAU, rr = k < 12 ? rho : rho * Math.sqrt(rnd()), u = C(c.re + rr * Math.cos(a), c.im + rr * Math.sin(a)), v = o.fwd(u);
            if (CX.isFin(v) && CX.abs(CX.sub(v, d.e)) > d.r * (1 + 1e-9) + 1e-12 * (1 + CX.abs(v))) { viol++; if (!exv) exv = `${o.kind} ${t} c ${CX.fmt(c)} rho ${rho}`; break; }
          }
        }
      }
    }
    console.log(`op disc enclosures: ${discs} discs over ${kinds.size} op kinds, ${viol} violations`);
    check('op disc enclosures contain every sampled image', viol === 0 && kinds.size >= 23, exv);
  }
  // (2) periodic aliasing: exp∘exp of shapes whose height is a multiple of 2 pi (every sample of the old 8 x 8 x 9 grid
  // landed on Im e^z = 0): the box is never narrower than dense sampling, and every image point is covered
  {
    const ALIAS = [
      ['exp∘exp, rect [0,2]x[0,16π]', { kind: 'rect', a: [0, 0], b: [2, 16 * PI] }],
      ['exp∘exp, rect [1.9,2]x[0,16π]', { kind: 'rect', a: [1.9, 0], b: [2, 16 * PI] }],
      ['exp∘exp, rect [1.9,2]x[0,16π+0.01]', { kind: 'rect', a: [1.9, 0], b: [2, 16 * PI + 0.01] }],
      ['exp∘exp, rect [0,2]x[-8π,8π]', { kind: 'rect', a: [0, -8 * PI], b: [2, 8 * PI] }],
      ['exp∘exp, disc r=8π', { kind: 'disc', c: [0, 0], r: 8 * PI }],
      ['exp∘exp, rect [1.2,1.3]x[0,32π]', { kind: 'rect', a: [1.2, 0], b: [1.3, 32 * PI] }],
    ];
    const { plan, F } = planOf([{ type: 'exp' }, { type: 'exp' }]);
    for (const [name, shape] of ALIAS) {
      const prep = Inverse.prepare(plan, { win: WIN0, shape });
      const sp = prep.rspec[1], L = Region.levelOf(shape), bb = Region.bboxOf(shape);
      let mn = Infinity, mx = -Infinity, nn = 0, miss = 0, ex = '';
      for (let i = 0; i < (QUICK ? 2e4 : 1e5); i++) {
        const z = C(bb.x0 + rnd() * (bb.x1 - bb.x0), bb.y0 + rnd() * (bb.y1 - bb.y0));
        if (!(L(z) > 1e-9)) continue;
        const v = Math.exp(z.re) * Math.sin(z.im);                       // <e^z, e>, e = i
        if (v < mn) mn = v; if (v > mx) mx = v;
        if (prep.ok && i % 40 === 0) {
          const w = F(z);
          if (!CX.isFin(w) || CX.abs(w) > 1e6 || CX.abs(w) < 1e-6) continue;
          nn++;
          const r = Inverse.enumerate(plan, prep, w, 1e-4, { K: 16, B: 16, leaves: false });
          if (!(r.U > 0)) { miss++; if (!ex) ex = `z ${CX.fmt(z)}`; }
        }
      }
      const narrower = sp.tooWide ? false : (mn < sp.lo - 1e-9 || mx > sp.hi + 1e-9);
      console.log(`${name.padEnd(38)} box [${sp.lo.toFixed(3)}, ${sp.hi.toFixed(3)}] dense [${mn.toFixed(3)}, ${mx.toFixed(3)}] ${prep.ok ? `inverse, ${miss}/${nn} not covered` : 'forward: ' + prep.reason}`);
      check(`imageBox not aliased: ${name}`, !narrower && (!sp.tooWide || !prep.ok) && miss === 0, `box [${sp.lo}, ${sp.hi}] dense [${mn}, ${mx}] ${ex}`);
    }
    // the box is tight: the true range plus at most a quarter period on each side (cells refine to unit / 4)
    const tight = Inverse.prepare(plan, { win: WIN0, shape: ALIAS[0][1] }).rspec[1];
    check('imageBox tight: exp∘exp rect [0,2]x[0,16π] within unit / 4 of [-e^2, e^2]', tight.lo <= -Math.exp(2) && tight.lo >= -Math.exp(2) - PI / 2 - 1e-9 && tight.hi >= Math.exp(2) && tight.hi <= Math.exp(2) + PI / 2 + 1e-9, JSON.stringify(tight));
  }
  // (3) a zero of the prefix inside the shape makes ln|u| unbounded below (z^s families): never a finite box; a prefix
  // pole on the boundary: unbounded without far cover; both go forward
  {
    const zc = Inverse.prepare(planOf([{ type: 'cos' }, { type: 'powa', params: { alpha: 'i' } }]).plan, { win: WIN0, shape: { kind: 'disc', c: [-1.3, 0.2], r: 0.5 } });
    check('(cos z)^i on a disc containing the zero -π/2: not a finite box', !zc.ok && !Number.isFinite(zc.rspec[1].lo), `${zc.reason} ${JSON.stringify(zc.rspec[1])}`);
    const z2 = Inverse.prepare(planOf([{ type: 'sin' }, { type: 'powa', params: { alpha: '0.5i' } }]).plan, { win: WIN0, shape: { kind: 'disc', c: [0.3, 0], r: 0.6 } });
    check('(sin z)^{0.5i} on a disc containing 0: forward', !z2.ok, z2.reason);
    const zok = Inverse.prepare(planOf([{ type: 'cos' }, { type: 'powa', params: { alpha: 'i' } }]).plan, { win: WIN0, shape: { kind: 'disc', c: [-0.5, 0], r: 0.5 } });
    check('(cos z)^i on a disc away from the zeros: a finite box', zok.ok && Number.isFinite(zok.rspec[1].lo) && Number.isFinite(zok.rspec[1].hi), zok.reason);
    const { plan } = planOf([{ type: 'recip' }, { type: 'sin' }]);
    const pb = Inverse.prepare(plan, { win: WIN0, shape: { kind: 'rect', a: [0, -1], b: [2, 1] } });
    check('sin(1/z) on a rect with 0 on its boundary: unbounded without far cover', !pb.ok && pb.rspec[1].farCover === false && !Number.isFinite(pb.rspec[1].hi), `${pb.reason} ${JSON.stringify(pb.rspec[1])}`);
  }
  // (4) imageBox against dense sampling for random bounded shapes through chains with cuts (log, roots, inverse trig,
  // ijouk), poles (1/z, tan) and fast growth (z^8, exp): never narrower (a tooWide early exit must go forward)
  {
    seed = 31415;
    const PRE = [[{ type: 'log' }], [{ type: 'root', params: { n: 3, cut: 60, k: 1 } }], [{ type: 'arcsin' }], [{ type: 'arctan' }], [{ type: 'ijouk' }], [{ type: 'powa', params: { alpha: '1.5', cut: -90, k: 0 } }],
      [{ type: 'recip' }], [{ type: 'tan' }], [{ type: 'pown', params: { n: 8 } }], [{ type: 'exp' }, { type: 'log', params: { cut: 90 } }], [{ type: 'artanh' }], [{ type: 'arcosh' }]];
    const FAM = [{ type: 'exp' }, { type: 'sin' }, { type: 'tan' }, { type: 'cosh' }, { type: 'powa', params: { alpha: 'i' } }];
    let tested = 0, narrower = 0, fwd = 0, ex = '';
    for (let t = 0; t < (QUICK ? 40 : 120); t++) {
      const steps = PRE[t % PRE.length].concat([FAM[Math.floor(rnd() * FAM.length)]]);
      const { plan } = planOf(steps);
      const c = [(rnd() * 2 - 1) * 2, (rnd() * 2 - 1) * 2], r = 0.05 + rnd() * 1.2, k = Math.floor(rnd() * 3);
      const shape = k === 0 ? { kind: 'disc', c, r } : k === 1 ? { kind: 'rect', a: c, b: [c[0] + (rnd() * 2 - 1) * 2 * r, c[1] + (rnd() * 2 - 1) * 2 * r] } : { kind: 'annulus', c, r1: r * 0.4, r2: r };
      const prep = Inverse.prepare(plan, { win: WIN0, shape });
      const j = plan.ops.length - 1, o = plan.ops[j], sp = prep.rspec[j];
      if (!sp || sp.kind !== 'box') continue;
      if (sp.tooWide) { if (prep.ok) { narrower++; if (!ex) ex = 'tooWide but eligible'; } fwd++; continue; }
      if (!Number.isFinite(sp.lo) || !Number.isFinite(sp.hi)) { fwd++; continue; }
      tested++;
      const pa = o.fam.type === 'add' ? CX.abs(o.fam.p) : 0, e = pa ? C(o.fam.p.re / pa, o.fam.p.im / pa) : null;
      const coord = (u) => (e ? u.re * e.re + u.im * e.im : Math.log(CX.abs(u)));
      const L = Region.levelOf(shape), bb = Region.bboxOf(shape);
      let mn = Infinity, mx = -Infinity;
      for (let i = 0; i < (QUICK ? 1e4 : 4e4); i++) {
        const z = C(bb.x0 + rnd() * (bb.x1 - bb.x0), bb.y0 + rnd() * (bb.y1 - bb.y0));
        if (!(L(z) > 0)) continue;
        let u = z; for (let q = 0; q < j; q++) u = plan.ops[q].fwd(u);
        const v = coord(u);
        if (Number.isFinite(v)) { if (v < mn) mn = v; if (v > mx) mx = v; }
      }
      if (mn < sp.lo - 1e-9 * (1 + Math.abs(mn)) || mx > sp.hi + 1e-9 * (1 + Math.abs(mx))) { narrower++; if (!ex) ex = `${JSON.stringify(steps)} ${JSON.stringify(shape)} box [${sp.lo}, ${sp.hi}] dense [${mn}, ${mx}]`; }
    }
    console.log(`imageBox through cuts and poles: ${tested} finite boxes against dense sampling, ${fwd} unbounded or too wide, narrower ${narrower}`);
    check('imageBox through cuts and poles: never narrower', narrower === 0 && tested >= (QUICK ? 10 : 40), ex);
  }

  // Review P1, finding 6: shapeClip's disc piece for a line origin far from the disc (the old quadratic lost r^2
  // against |z0 - c|^2 and returned no members at |z0 - c| / r ~ 1e8)
  {
    const r1 = Region.shapeClip(Region.clipPrimitive({ kind: 'disc', c: [1e10, 0], r: 1 }), C(0, 0), C(1, 2e-11));
    check('shapeClip far disc: [1e10 - 1, 1e10 + 1] (to 1e-5)', Math.abs(r1.lo - (1e10 - Math.sqrt(1 - 0.2 ** 2))) < 1e-4 && Math.abs(r1.hi - (1e10 + Math.sqrt(1 - 0.2 ** 2))) < 1e-4, JSON.stringify(r1));
    seed = 1618;
    let bad = 0, ex = '';
    for (let t = 0; t < 2000; t++) {
      const r = Math.pow(10, -rnd() * 3), far = r * Math.pow(10, 2 + rnd() * 7), th = rnd() * TAU, c = C(far * Math.cos(th), far * Math.sin(th));
      const q = CX.scale(C(Math.cos(th + (rnd() * 2 - 1) * r / far), Math.sin(th + (rnd() * 2 - 1) * r / far)), Math.pow(10, rnd() * 4 - 2));
      const res = Region.shapeClip(Region.clipPrimitive({ kind: 'disc', c: [c.re, c.im], r }), C(0, 0), q);
      // points of the line inside the disc, by the exact geometry around the foot of the perpendicular
      const ql = CX.abs(q), tc = (c.re * q.re + c.im * q.im) / (ql * ql), h = Math.abs(q.re * c.im - q.im * c.re) / ql;
      if (h >= r * (1 - 1e-6)) continue;
      const half = Math.sqrt(r * r - h * h) / ql;
      for (const s of [-0.999, -0.5, 0, 0.5, 0.999]) {
        const tt = tc + s * half;
        if (!(tt >= res.lo - 1e-12 * Math.abs(tt) && tt <= res.hi + 1e-12 * Math.abs(tt))) { bad++; if (!ex) ex = `r ${r} far ${far} res ${JSON.stringify(res)} t ${tt}`; break; }
      }
    }
    check('shapeClip far discs (|z0 - c| / r up to 1e9): inside parameters lie in [lo, hi]', bad === 0, ex);
    // end to end: z^{1000i} of |z - 1e10| < 1 (the member rays from 0 pass the disc at distance 1e10)
    const { plan, F } = planOf([{ type: 'powa', params: { alpha: '1000i' } }]);
    const shape = { kind: 'disc', c: [1e10, 0], r: 1 }, prep = Inverse.prepare(plan, { win: WIN0, shape });
    let nn = 0, miss = 0;
    for (let t = 0; t < 300; t++) {
      const a = rnd() * TAU, rr = Math.sqrt(rnd()) * 0.999, z = C(1e10 + rr * Math.cos(a), rr * Math.sin(a)), w = F(z);
      if (!CX.isFin(w)) continue;
      nn++;
      if (!(Inverse.enumerate(plan, prep, w, 1e-6, { K: 1, leaves: false }).U > 0)) miss++;
    }
    check('z^{1000i} of |z - 1e10| < 1: every image point covered', prep.ok && nn > 200 && miss === 0, `${prep.reason} ${miss}/${nn}`);
  }
}

// =================================================================================================
// (k) homotopy end points (normalizeMap): H_0 = id, H_1 = f
// =================================================================================================
section('(k) homotopy end points');
{
  const fails = [], passes = [];
  const TYPES = Object.keys(Funcs.DEFS);
  const PARAMS = {
    mul: [{ c: '2' }, { c: '-0.3+1.7i' }], add: [{ c: '1' }, { c: '-2+0.5i' }], affine: [{ a: '1+i', b: '0' }, { a: '-0.4', b: '2-i' }], mobius: [{}, { a: '2', b: '1+i', c: '0.5', d: '-1' }],
    blaschke: [{}, { a: '0.3-0.4i', phi: 70 }], pown: [{ n: 2 }, { n: -3 }, { n: 7 }], root: [{ n: 2 }, { n: 3, cut: 60, k: 2 }], powa: [{}, { alpha: 'i', cut: -30, k: 1 }, { alpha: '-0.7+0.2i' }],
    log: [{}, { cut: 45, k: -1 }], ijouk: [{ branch: 'exterior' }, { branch: 'interior' }], poly: [{}, { co: '1, 0, 4' }], rational: [{}, { p: '1, -i', q: '1, i' }],
    custom: [{ expr: 'e^{z}+\\sin z' }, { expr: '\\sqrt{z}+z^2', cut: 90 }],
  };
  for (const type of TYPES) {
    let ok = true, worst = 0, hasHom = true;
    for (const params of PARAMS[type] || [{}]) {
      const b = Funcs.build(St(type, params));
      if (b.error || !b.hom) { hasHom = false; ok = false; break; }
      const H0 = b.hom(0), H1 = b.hom(1);
      seed = 31337;
      for (let i = 0; i < 1000; i++) {
        const z = rc(2.5);
        const f = b.f(z);
        if (!CX.isFin(f)) continue;
        const e0 = CX.abs(CX.sub(H0(z), z)) / (1 + CX.abs(z)), e1 = CX.abs(CX.sub(H1(z), f)) / (1 + CX.abs(f));
        worst = Math.max(worst, e0, e1);
        if (!(e0 <= 1e-12 && e1 <= 1e-12)) { ok = false; }
      }
    }
    (ok ? passes : fails).push(type + (hasHom ? '' : ' (no homotopy)'));
    if (Inverse.HOM_EXACT.has(type)) check(`homotopy end points ${type}`, ok, `worst ${worst}`);
  }
  console.log(`homotopy end points exact: ${passes.join(' ')}; excluded: ${fails.join(' ') || 'none'}`);
  check('HOM_EXACT lists only verified types', [...Inverse.HOM_EXACT].every((t) => passes.includes(t)), [...Inverse.HOM_EXACT].filter((t) => !passes.includes(t)).join(' '));
  check('d/dz is excluded from normalisation', !Inverse.homExact({ type: 'deriv' }) && Inverse.homExact({ type: 'exp' }));
}

// [issue #276] a last step with no plan that names all of its singular points, finitely many (ζ: its pole 1), after
// injective steps with one: Inverse.singularAfter pulls them back to the z-plane, and the lines break where their jump
// scan would, along their whole reach. Anything else keeps the scan (Γ's poles run along a line's reach; a periodic
// prefix has infinitely many preimages)
section('singularAfter (ζ after an injective plan)');
{
  const pts = (out) => out.map((e) => cs(e.z) + ':' + e.kind).join(' ');
  // 2z + 1, then ζ: its pole 1 at z = 0; the whole chain has no plan
  let q = planOf([{ type: 'affine', params: { a: '2', b: '1' } }, { type: 'zeta' }], 0, 1);
  check('2z + 1 then ζ: the whole chain has no plan, the steps before ζ have one, injective', !Inverse.planChain(q.steps, q.built, 0, 2).ok && q.plan.ok && q.plan.injective);
  let s = Inverse.singularAfter(q.plan, WIN0, q.built[1].sing, 16);
  check('… ζ\'s pole pulled back to z = 0', s && s.length === 1 && s[0].kind === 'pole' && CX.abs(s[0].z) < 1e-12, pts(s || []));
  // the lines through it, refined with these points and with the scan, along their whole reach: the same pieces, broken
  // at the same places
  const F = (z) => q.built[1].f(q.built[0].f(z));
  const brk = (ps) => ps.slice(0, -1).map((p) => cs(C(p[p.length - 2], p[p.length - 1]))).join(' ');
  for (const sh of [{ kind: 'line', a: [-3, 0], b: [3, 0] }, { kind: 'line', a: [0, -3], b: [0, 3] }, { kind: 'circle', c: [0, 0], r: 0.5 }]) {
    const cv = Region.curvesOf(sh, WIN0, { reach: 'sphere' });
    const run = (sg) => Region.Lines.refine(cv, [F], sg, { win: WIN0, origin: [0, 0], maxInsert: 8192, maxEval: 2048 });
    const a = run(null), b = run(s);
    check(`… a ${sh.kind} refined with them breaks where the scan breaks it (${a.length} pieces)`, a.length === b.length && a.length >= 1, `${a.length} vs ${b.length}: ${brk(a)} / ${brk(b)}`);
  }
  // ζ alone (no steps before it)
  q = planOf([{ type: 'zeta' }], 0, 0);
  s = Inverse.singularAfter(q.plan, WIN0, q.built[0].sing, 16);
  check('ζ alone: its pole at 1', s && s.length === 1 && CX.abs(CX.sub(s[0].z, C(1, 0))) < 1e-15, pts(s || []));
  // e^z, then ζ: infinitely many preimages of 1 (a periodic prefix): no set, the lines scan
  q = planOf([{ type: 'exp' }, { type: 'zeta' }], 0, 1);
  check('e^z then ζ: not injective, so null (the lines scan)', q.plan.ok && !q.plan.injective && Inverse.singularAfter(q.plan, WIN0, q.built[1].sing, 16) === null);
  check('Γ names no set (its poles run along a line\'s reach): it keeps the scan', Funcs.build(St('gamma')).sing === undefined);
}

console.log(`\n${n} checks, ${bad} failed (${((Date.now() - t0All) / 1000).toFixed(1)} s)`);
process.exitCode = bad ? 1 : 0;
