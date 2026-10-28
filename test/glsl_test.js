'use strict';
// GPU-vs-CPU conformance test for GLChain. Runs synchronously on load; results in window.__glslTest.
// URL options: ?parts=N&part=i (run every N-th chain starting at i), ?filter=substr (chain name filter).
(function () {
  const R = window.__glslTest = {
    done: false, total: 0, compared: 0, skippedDiscontinuous: 0, skippedNonFinite: 0, skippedF32Range: 0, skippedF32Cancel: 0, skippedTrunc: 0, derivRows: 0, sheetRows: 0, f32RangeExamples: [], f32ByChain: {},
    chains: 0, programs: 0, failures: [], failCount: 0, failByChain: {}, errors: [], keyChecks: [], singular: { checked: 0, badCount: 0, bad: [], sphereLimits: 0, sphereByChain: {}, sphereExamples: [] }, ms: 0,
  };
  const t0 = performance.now();
  const qs = new URLSearchParams(location.search);
  const PARTS = +qs.get('parts') || 1, PART = +qs.get('part') || 0, FILTER = qs.get('filter') || '';
  const C = CX.C;
  const TOL = 2e-3;
  const TS = [0, 0.01, 0.37, 0.5, 0.73, 0.999, 1];
  const RANGE_TS = [0, 0.25, 0.5, 0.999, 1];
  const SHEET_TS = [0, 0.37, 0.73, 1];

  // ---------- deterministic random ----------
  let seed = 12345;
  const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const rf = (a, b) => a + rnd() * (b - a);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const num = (x) => String(+x.toFixed(3));
  const cxs = (re, im) => (im === 0 ? num(re) : `${num(re)}${im < 0 ? '-' : '+'}${num(Math.abs(im))}i`);
  const rcx = (r = 2) => cxs(rf(-r, r), rf(-r, r));

  // ---------- chains ----------
  const chains = [];
  const S = (type, params = {}, on = true) => ({ type, params: Object.assign(Funcs.defaults(type), params), on });
  const add = (name, steps) => chains.push({ name, steps });
  const TYPES = Object.keys(Funcs.DEFS);
  // the random rows and chains draw from the types they had before the zeros-and-poles step (2026-10-22), so their
  // deterministic sequence is unchanged; 'zp' gets its own random rows with their own seed (below)
  // (and before Γ and ζ, issue #4, and the Series step, issue #5, which have chains of their own below)
  const RTYPES = TYPES.filter((t) => t !== 'zp' && t !== 'gamma' && t !== 'zeta' && t !== 'series');
  const CUTS = [0, 90, -45, 180, 270, -180, 30];
  const EXPRS = [
    'z^2+\\frac{1}{z}', '\\sin z+\\cos(2z)', '\\tan z', '\\cot z', '\\sec z', '\\csc z', '\\sinh z-\\cosh(z/2)', '\\tanh(z)', '\\coth z',
    '\\arcsin z', '\\arccos(z)', '\\arctan z', '\\operatorname{arsinh} z', '\\operatorname{arcosh}(z)', '\\operatorname{artanh} z',
    'asin(z)*acos(z)/atan(z+2)', 'arcsinh(z)+arccosh(z)', 'e^{z}', 'e^{z^2}', '\\exp(iz)', '\\log z', '\\ln(z+1)', 'log(-1)*z',
    '\\operatorname{Re} z+i\\operatorname{Im}(z^2)', 'Re(z)*Im(z)+arg(z)', '\\arg z', '|z|', 'abs(z^2-1)', '\\overline{z}^2', 'conj(z)*z', '\\bar z+z',
    '\\sqrt{z}', '\\sqrt{z^2-1}', '\\sqrt[3]{z}', '\\sqrt[2+i]{z}', '\\sqrt[-2]{z}', 'z^3-2z+1', 'z^{-2}', 'z^{0.5}', 'z^{1+i}', 'z^\\pi', 'z^{1/3}',
    'z^{12}', 'z^{-7}', 'z^{5000}', '2^z', 'i^z', '(-1)^z', 'z^z', '(z+1)^{z-1}', 'z^{\\sqrt{4}}', '\\pi z+e', '3+4i', 'z\\cdot 0',
    '\\frac{z-i}{z+i}', '\\frac{1}{z^2+1}', 'w^2', '\\sin^2 z+\\cos^2 z', '\\frac12 z', 'z^{2^{3}}', '(z^2)^{1/2}', '\\sqrt{\\sqrt{z}}',
    '1/(z-1)^2', 'cot(z)+sec(z)+csc(z)+coth(z)', '\\left|z\\right|^2\\cdot e^{i\\arg z}', '(1+i)^{z}', 'z^{i}', 'exp(log(z)/2)',
  ];
  function randParams(type) {
    switch (type) {
      case 'mul': case 'add': return { c: rcx() };
      case 'affine': return { a: rcx(), b: rcx() };
      case 'mobius': return { a: rcx(), b: rcx(), c: rcx(), d: rcx() };
      case 'blaschke': { const r = rf(0, 0.95), a = rf(-Math.PI, Math.PI); return { a: cxs(r * Math.cos(a), r * Math.sin(a)), phi: ri(-180, 180) }; }
      case 'pown': return { n: pick([-16, -7, -3, -2, -1, 0, 1, 2, 3, 4, 5, 9, 12, 31]) };
      case 'root': return { n: ri(2, 7), cut: pick(CUTS), k: ri(-3, 4) };
      case 'powa': return { alpha: rnd() < 0.5 ? num(rf(-3, 3)) : rcx(2), cut: pick(CUTS), k: ri(-2, 2) };
      case 'log': return { cut: pick(CUTS), k: ri(-2, 2) };
      case 'ijouk': return { branch: pick(['exterior', 'interior']) };
      case 'poly': { const d = ri(0, 8); return { co: Array.from({ length: d + 1 }, () => rcx(1.5)).join(', ') }; }
      case 'rational': { const a = ri(0, 4), b = ri(1, 4); return { p: Array.from({ length: a + 1 }, () => rcx(1.5)).join(', '), q: Array.from({ length: b + 1 }, () => rcx(1.5)).join(', ') }; }
      case 'custom': return { expr: pick(EXPRS), cut: pick(CUTS) };
      case 'zp': { const a = ri(0, 4), b = ri(0, 3); return { a: rcx(1.5), zeros: Array.from({ length: a }, () => rcx(1.5)).join(', '), poles: Array.from({ length: b }, () => rcx(1.5)).join(', ') }; }
      default: return {};
    }
  }
  // 1. defaults
  for (const t of TYPES) if (t !== 'gamma' && t !== 'zeta') add(`default ${t}`, [S(t)]);
  add('ijouk interior', [S('ijouk', { branch: 'interior' })]);
  // natural paths (2026-10-22): zoom paths, Joukowski's Cayley power, roots and rational zoom paths, all at once
  add('nat joukowski > cos > rational', [S('joukowski'), S('cos'), S('rational')]);
  add('nat mobius > sin > artanh', [S('mobius'), S('sin'), S('artanh')]);
  add('nat cosh > arcosh > arccos', [S('cosh'), S('arcosh'), S('arccos')]);
  add('nat ijouk > tan > tanh', [S('ijouk', { branch: 'interior' }), S('tan'), S('tanh')]);
  add('nat poly roots (z-1)(z-2)(z+3i)', [S('poly', { co: '1, -3+3i, 2-9i, 6i' })]);
  add('nat rational (z-2)/(z-1)', [S('rational', { p: '1, -2', q: '1, -1' })]);
  add('nat rational 1/(z^2+1)', [S('rational', { p: '1', q: '1, 0, 1' })]);
  // zeros and poles (2026-10-22): the product form, the roots path (no pole), the rational zoom path, degree 1,
  // a cancelled pair, a = 0, a pole hit exactly, and in a chain with d/dz (the exact chain rule of its expansion)
  add('zp (z^2-1)/z', [S('zp')]);
  add('zp polynomial 3 zeros', [S('zp', { a: '2i', zeros: '1, -0.5+0.8i, -0.5-0.8i', poles: '' })]);
  add('zp 2 zeros 2 poles', [S('zp', { a: '0.5-i', zeros: '1+i, -1', poles: '0.3i, -1.2' })]);
  add('zp 1 zero 3 poles', [S('zp', { a: '1', zeros: '0.5', poles: '1, i, -1-i' })]);
  add('zp mobius', [S('zp', { a: '3', zeros: '1', poles: '-1' })]);
  add('zp only poles', [S('zp', { a: '1', zeros: '', poles: '0, 2i' })]);
  add('zp cancelled pair', [S('zp', { a: '1', zeros: '1, 2', poles: '1' })]);
  add('zp a=0', [S('zp', { a: '0', zeros: '1', poles: '2' })]);
  add('zp > exp', [S('zp', { a: '0.5', zeros: '1, -1', poles: '0' }), S('exp')]);
  add('exp > zp', [S('exp'), S('zp', { a: '1', zeros: '1+i, -1', poles: '' })]);
  add('nat custom cos z, joukowski formula', [S('custom', { expr: '\\cos z' }), S('custom', { expr: '\\frac{1}{2}\\left(z+\\frac{1}{z}\\right)' })]);
  add('nat exp > log > sinh', [S('exp'), S('log'), S('sinh')]);
  add('ijouk interior then exterior', [S('ijouk', { branch: 'interior' }), S('ijouk', { branch: 'exterior' })]);
  // natural paths, round 2 (2026-10-22 review): cos about pi/2, Joukowski's disk branch, the power, Moebius, c J and
  // generic zoom paths of polynomials, rationals and custom formulas, the zoom centre of zp at zeta_1
  add('nat2 poly z^2 power', [S('poly', { co: '1, 0, 0' })]);
  add('nat2 poly 2(z-1)^3 power', [S('poly', { co: '2, -6, 6, -2' })]);
  add('nat2 poly z^2+1 zoom real', [S('poly', { co: '1, 0, 1' })]);
  add('nat2 poly z+2 mob', [S('poly', { co: '1, 2' })]);
  add('nat2 rational (z-1)/(z-2) mob', [S('rational', { p: '1, -1', q: '1, -2' })]);
  add('nat2 rational default 2J', [S('rational')]);
  add('nat2 custom e^{2z} gzoom', [S('custom', { expr: 'e^{2z}' })]);
  add('nat2 custom sqrt z gzoom', [S('custom', { expr: '\\sqrt{z}' })]);
  add('nat2 custom cos z + 1 gzoom', [S('custom', { expr: '\\cos z+1' })]);
  add('nat2 custom z^2 power, 1/z mob', [S('custom', { expr: 'z^2' }), S('custom', { expr: '\\frac{1}{z}' })]);
  add('nat2 zp same zeros power', [S('zp', { a: '1.5', zeros: '0.5i, 0.5i, 0.5i', poles: '' })]);
  add('nat2 zp 1 zero 1 pole mob', [S('zp', { a: '2', zeros: '1+i', poles: '-1' })]);
  // 2. random params
  for (const t of RTYPES) if (Funcs.DEFS[t].params.length) for (let i = 0; i < 3; i++) { const p = randParams(t); add(`rand ${t} ${JSON.stringify(p)}`, [S(t, p)]); }
  if (Funcs.DEFS.zp) {
    const keep = seed;
    seed = 20261022;
    for (let i = 0; i < 6; i++) { const p = randParams('zp'); add(`rand zp ${JSON.stringify(p)}`, [S('zp', p)]); }
    seed = keep;
  }
  // 3. cut angles and sheets
  const cutCfg = [['root', { n: 2 }], ['root', { n: 3 }], ['root', { n: 5 }], ['powa', { alpha: '0.5' }], ['powa', { alpha: '-1.5' }], ['powa', { alpha: '0.5+0.3i' }], ['powa', { alpha: '2.5' }], ['log', {}]];
  for (const [t, p] of cutCfg) {
    for (const cut of [0, 90, -45, 180, 270, -180]) add(`cut ${t} ${JSON.stringify(p)} cut=${cut}`, [S(t, Object.assign({ cut, k: 0 }, p))]);
    for (const [cut, k] of [[90, -1], [180, 1], [-45, 2], [0, 3]]) add(`sheet ${t} ${JSON.stringify(p)} cut=${cut} k=${k}`, [S(t, Object.assign({ cut, k }, p))]);
  }
  // 4. Mobius family special cases
  const mob = (a, b, c, d) => S('mobius', { a, b, c, d });
  [['1', '1', '0', '1'], ['2', '-1', '1', '0'], ['1+i', '1', '0', '1+i'], ['1', '0', '0', '1'], ['0.866+0.5i', '0', '0', '1'], ['2+i', '0', '0', '1'],
    ['3', '0', '0', '1'], ['1', '2', '2', '4'], ['2', '1', '1', '0'], ['-1', '0', '0', '1'], ['i', '0', '0', '1'], ['0', '1', '-1', '0'],
    ['1', '-i', '1', 'i'], ['1', '1e-9', '0', '1'], ['1', '0', '0', '-1+0.0000001i'], ['-2', '3', '1', '1']].forEach((m) => add(`mobius ${m.join(',')}`, [mob(...m)]));
  for (const c of ['0', '1', '-1', 'i', '0.001', '1e-15', '5-2i']) add(`mul c=${c}`, [S('mul', { c })]);
  for (const [a, b] of [['0', '1+i'], ['1', '2'], ['-1', 'i'], ['0.5i', '1']]) add(`affine a=${a} b=${b}`, [S('affine', { a, b })]);
  for (const [a, phi] of [['1', 0], ['0.6+0.8i', 40], ['0', 90], ['0.5+0.3i', 30], ['-0.9i', -150]]) add(`blaschke a=${a} phi=${phi}`, [S('blaschke', { a, phi })]);
  // 5. polynomials of degree 0..8, leading zeros
  for (let d = 0; d <= 8; d++) for (let r = 0; r < 2; r++) add(`poly deg ${d} #${r}`, [S('poly', { co: Array.from({ length: d + 1 }, () => rcx(1.5)).join(', ') })]);
  for (const co of ['0, 0, 1, 2', '0, 0', '0', '0, 1-i, 0, 0', '2i']) add(`poly ${co}`, [S('poly', { co })]);
  // 6. rationals
  for (const [p, q] of [['1, 0, 1', '1, 0'], ['1', '1, 0, 1'], ['1, -1', '1, -1'], ['0', '1, 2'], ['1, 2, 3, 4', '0, 0, 2, 1'], ['i', '3'], ['1, 0, 0, 0, -1', '1, 0, 0, 2i']]) add(`rational ${p} / ${q}`, [S('rational', { p, q })]);
  // 7. custom formulas
  EXPRS.forEach((e, i) => add(`custom ${e} cut=180`, [S('custom', { expr: e, cut: 180 })]));
  EXPRS.forEach((e, i) => { const cut = [90, -45, 0, 270][i % 4]; add(`custom ${e} cut=${cut}`, [S('custom', { expr: e, cut })]); });
  // 8. integer powers
  for (const n of [-16, -7, -3, -2, -1, 0, 1, 5, 12, 31, 64]) add(`pown n=${n}`, [S('pown', { n })]);
  // 8b. regressions: large-scale Mobius paths (cosh - sinh cancellation), |n| > 2^24, overflowing negative powers,
  // (nearly) degenerate Mobius maps, entries beyond float32 range
  for (const c of ['100000000', '1000000', '100000+100000i', '-100000', '0.00001']) add(`mul c=${c} (path)`, [S('mul', { c })]);
  add('affine a=100000 b=1 (path)', [S('affine', { a: '100000', b: '1' })]);
  [['1000', '0', '0', '0.001'], ['100', '1', '1', '0.0100001'], ['2', '1', '1', '0.5000001'], ['0.1', '0.2', '0.3', '0.6'],
    ['100000000000000000000000000000000000000000', '0', '0', '100000000000000000000000000000000000000000']].forEach((m) => add(`mobius ${m.join(',')} (regr)`, [mob(...m)]));
  for (const [a, phi] of [['i', -120], ['0.6+0.8i', 0], ['-1', 45], ['0.9999999', 30]]) add(`blaschke a=${a} phi=${phi} (regr)`, [S('blaschke', { a, phi })]);
  for (const n of [16777217, -16777217, 33554435, 100003, -64, -4096]) add(`pown n=${n} (regr)`, [S('pown', { n })]);
  add('recip>pown -9 (overflow)', [S('recip'), S('pown', { n: -9 })]);
  add('custom sec z csc z', [S('custom', { expr: '\\sec z\\csc z' })]);
  // 9. errors and bypassed steps
  add('err custom parse', [S('custom', { expr: 'z+' })]);
  add('err custom var', [S('custom', { expr: 'x+y' })]);
  add('err rational q=0', [S('rational', { q: '0, 0' })]);
  add('err mul c', [S('mul', { c: 'abc' })]);
  add('mixed err/off', [S('exp'), S('custom', { expr: 'z+' }), S('pown', { n: 3 }, false), S('mul', { c: '0.5-i' })]);
  add('off only', [S('log', {}, false), S('sin', {}, false)]);
  // 10. multi-step chains
  const POOL = RTYPES.filter((t) => t !== 'custom' && t !== 'deriv').concat(['custom', 'custom']);
  for (let i = 0; i < 70; i++) {
    const len = ri(2, 5);
    const steps = [];
    for (let j = 0; j < len; j++) {
      const t = pick(POOL);
      const st = S(t, rnd() < 0.6 ? randParams(t) : {});
      if (rnd() < 0.12) st.on = false;
      steps.push(st);
    }
    if (i % 10 === 9) steps.splice(ri(0, steps.length), 0, S('custom', { expr: '\\frac{' }));
    add(`multi#${i} ${steps.map((s) => (s.on ? '' : '~') + s.type).join('>')}`, steps);
  }
  // 11. d/dz chains (stage maps G_k: exact chain rule, circle formula for nested or non-holomorphic prefixes)
  const D = (on = true) => S('deriv', {}, on);
  add('deriv only', [D()]);
  add('deriv deriv', [D(), D()]);
  add('deriv off', [S('pown', { n: 3 }), D(false)]);
  add('z^3 d', [S('pown', { n: 3 }), D()]);
  add('z^3 d d', [S('pown', { n: 3 }), D(), D()]);
  add('z^5 d d d', [S('pown', { n: 5 }), D(), D(), D()]);
  add('sin exp d', [S('sin'), S('exp'), D()]);
  add('exp d sin', [S('exp'), D(), S('sin')]);
  add('sin d z^2 d', [S('sin'), D(), S('pown', { n: 2 }), D()]);
  add('mobius d', [S('mobius'), D()]);
  add('mobius d mul', [S('mobius'), D(), S('mul', { c: '0.5-i' })]);
  add('log cut k d', [S('log', { cut: 30, k: 1 }), D()]);
  add('root3 cut k d', [S('root', { n: 3, cut: 90, k: 2 }), D()]);
  add('powa d', [S('powa', { alpha: '1.5+0.5i', cut: -45, k: 1 }), D()]);
  add('poly d d', [S('poly', { co: '1, -2i, 0.5, 3, -1' }), D(), D()]);
  add('rational d', [S('rational', { p: '1, 0, 2', q: '1, 0.5i, -1' }), D()]);
  add('conj d (circle)', [S('conj'), D()]);
  add('custom Re d (circle)', [S('custom', { expr: '\\operatorname{Re} z+z^2' }), D()]);
  add('joukowski ijouk d', [S('joukowski'), S('ijouk', { branch: 'interior' }), D()]);
  add('blaschke tanh d', [S('blaschke', { a: '0.3+0.2i', phi: 40 }), S('tanh'), D()]);
  add('arcsin d', [S('arcsin'), D()]);
  add('arsinh d', [S('arsinh'), D()]);
  add('err step d', [S('exp'), S('custom', { expr: 'z+' }), D()]);
  add('off step d', [S('exp'), S('sin', {}, false), D(), S('pown', { n: 2 })]);
  ['z^2+\\frac{1}{z}', '\\sin z+\\cos(2z)', 'e^{z^2}', '\\sqrt{z}', '\\log(z+1)', 'z^{1+i}', 'z^z', '\\tan z', '\\frac{z-i}{z+i}', '(1+i)^{z}', '\\arctan z']
    .forEach((e, i) => add(`custom d ${e}`, [S('custom', { expr: e, cut: [180, 90, -45][i % 3] }), D()]));
  for (let i = 0; i < 24; i++) {
    const len = ri(2, 4);
    const steps = [];
    for (let j = 0; j < len; j++) { const t = pick(POOL); steps.push(S(t, rnd() < 0.6 ? randParams(t) : {})); }
    steps.splice(ri(0, steps.length), 0, D());
    if (i % 4 === 3) steps.splice(ri(0, steps.length), 0, D());
    add(`dmulti#${i} ${steps.map((s) => s.type).join('>')}`, steps);
  }
  // 12. whole Riemann surfaces (chainSheet: local cuts opposite the cell centre, every sheet)
  add('sheets log', [S('log')]);
  add('sheets root2', [S('root')]);
  add('sheets root5', [S('root', { n: 5, cut: 45, k: 3 })]);
  add('sheets root30 (window)', [S('root', { n: 30 })]);
  add('sheets powa 2/3', [S('powa', { alpha: '0.6666666666666666' })]);
  add('sheets powa complex', [S('powa', { alpha: '0.5+0.4i' })]);
  add('sheets powa integer', [S('powa', { alpha: '3' })]);
  add('sheets custom sqrt(z^2-1)', [S('custom', { expr: '\\sqrt{z^2-1}' })]);
  add('sheets custom log+sqrt', [S('custom', { expr: '\\log z+\\sqrt{z}' })]);
  add('sheets custom root/pow', [S('custom', { expr: '\\sqrt[3]{z}\\cdot z^{0.25}+z^{1+i}' })]);
  add('sheets custom z^z', [S('custom', { expr: 'z^z+2^z' })]);
  add('sheets custom no branch', [S('custom', { expr: 'z^2+\\sin z' })]);
  add('sheets exp root', [S('exp'), S('root', { n: 3 })]);
  add('sheets log root', [S('mul', { c: '1+i' }), S('log'), S('root')]);
  add('sheets root log mobius', [S('root'), S('log', { cut: 90 }), S('mobius')]);
  add('sheets root d', [S('root'), D()]);
  add('sheets log d root', [S('log'), D(), S('root', { n: 3 })]);
  add('sheets sqrt d d', [S('custom', { expr: '\\sqrt{z}' }), D(), D()]);
  // (v16.1 user-5) the deformation's sheets (chainSheetHom, mode 9 rows): the user's sin √z, both cuts, a recognised
  // formula, a log window, a complex power, a pre with sheets, a formula with branch points in full
  add('sheets deform sin sqrt', [S('root'), S('sin')]);
  add('sheets deform sin sqrt -90', [S('root', { cut: -90 }), S('sin')]);
  add('sheets deform rec sin sqrt', [S('custom', { expr: '\\sin\\sqrt{z}' })]);
  add('sheets deform rec 2log(z+1) root', [S('custom', { expr: '2\\log(z+1)' }), S('root', { n: 3, cut: 45, k: 2 })]);
  add('sheets deform log sin', [S('log', { cut: 90 }), S('sin')]);
  add('sheets deform powa cx mobius', [S('powa', { alpha: '0.5+0.4i' }), S('mobius')]);
  add('sheets deform mul log root', [S('mul', { c: '1+i' }), S('log'), S('root')]);
  add('sheets deform sin pair', [S('sin'), S('custom', { expr: '\\log z+\\sqrt{z}' })]);
  // (v16.1 review math-3) sheets numbered from the step's own cut and branch: a power and a log on other branches, a
  // formula with its own cut
  add('sheets branch powa cut k', [S('powa', { alpha: '0.6666666666666666', cut: -120, k: 2 }), S('sin')]);
  add('sheets branch log cut k', [S('log', { cut: 60, k: 3 }), S('root', { n: 3, cut: 30, k: 1 })]);
  add('sheets branch custom cut', [S('custom', { expr: '\\sqrt{z}+\\log(z+1)', cut: -45 }), S('sin')]);
  // 13. [issue #4] Γ and ζ (last, so every chain above keeps its place and its --part): the steps (Γ along its zoom path), with affine maps that reach larger arguments, the critical strip
  // and the left half-plane; Γ, ψ, ζ, ζ′ in formulas; the derivative of each by d/dz
  if (Funcs.DEFS.gamma) {
    const aff = (a2, b2) => S('affine', { a: a2, b: b2 });
    add('special gamma', [S('gamma')]);
    add('special gamma 4z+1', [aff('4', '1'), S('gamma')]);
    add('special gamma left half-plane 3z-6', [aff('3', '-6'), S('gamma')]);
    add('special gamma 10iz+0.5', [aff('10i', '0.5'), S('gamma')]);
    add('special zeta', [S('zeta')]);
    // (the sample points reach |z| = 14: these stay below the GPU's |Im s| = 120, where it leaves ζ blank)
    add('special zeta critical strip 0.5+6iz', [aff('6i', '0.5'), S('zeta')]);
    add('special zeta first zeros 0.5+i(4z+20)', [aff('4i', '0.5+20i'), S('zeta')]);
    add('special zeta left half-plane 4z-6', [aff('4', '-6'), S('zeta')]);
    add('special zeta Re s = 1 (1 + 2pi i k / ln 2)', [aff('1i', '1+9.0647i'), S('zeta')]);
    add('special custom Gamma(z)zeta(z)', [S('custom', { expr: '\\Gamma(z)\\zeta(z)' })]);
    add('special custom digamma', [S('custom', { expr: '\\operatorname{\\psi}(z)+z' })]);
    add("special custom zeta'", [S('custom', { expr: "\\zeta'(2z)" })]);
    add('special custom 1/Gamma', [S('custom', { expr: '\\frac{1}{\\Gamma(z^2+1)}' })]);
    add('special gamma d/dz', [S('gamma'), S('deriv')]);
    add('special zeta d/dz', [aff('2', '0.5'), S('zeta'), S('deriv')]);
  }
  // 14. [issue #5] series (last, as 13): power series (e^z, sin z, Li₂ with its boundary, a centre), a lacunary series
  // and its natural boundary, a Laurent series (θ), Dirichlet (ζ), generic loops (a product, Σ sin(z/n)/n²), a finite
  // sum and the derivative term by term
  {
    const sum = (name, expr, pre = []) => add('series ' + name, [...pre, S('custom', { expr })]);
    sum('e^z', '\\sum_{n=0}^{\\infty} \\frac{z^n}{n!}');
    sum('e^z 0.2z+1', '\\sum_{n=0}^{\\infty} \\frac{z^n}{n!}', [S('affine', { a: '0.2', b: '1' })]);
    sum('sin z', '\\sum_{n=0}^{\\infty} \\frac{(-1)^n z^{2n+1}}{(2n+1)!}');
    sum('Li2', '\\sum_{n=1}^{\\infty} \\frac{z^n}{n^2}');
    sum('geometric about 1+i', '\\sum_{n=0}^{\\infty} \\frac{(z-1-i)^n}{2^n}');
    sum('lacunary', '\\sum_{n=0}^{\\infty} z^{2^n}');
    sum('theta Laurent', '\\sum_{n\\in\\mathbb{Z}} e^{-n^2/2} z^n', [S('affine', { a: '1', b: '0.2' })]);
    sum('zeta Dirichlet', '\\sum_{n=1}^{\\infty} n^{-z}', [S('affine', { a: '2', b: '2.5' })]);
    sum('product sin', '\\prod_{n=1}^{\\infty} \\left(1-\\frac{z^2}{n^2}\\right)');
    // (the terms of a generic sum stay in float32 here; Σ sin(nz)/2^n or /n! overflow 2^n or n! before they converge on
    // part of the plane, where the GPU leaves them blank. These fall as n^{-3}: 512 terms and the rest as an integral)
    sum('generic sin(z/n)/n^2', '\\sum_{n=1}^{\\infty} \\frac{\\sin(z/n)}{n^2}');
    sum('finite binomial', '\\sum_{k=0}^{5} \\binom{5}{k} z^k');
    sum('d/dz e^z 0.2z+1', '\\sum_{n=0}^{\\infty} \\frac{z^n}{n!}', [S('affine', { a: '0.2', b: '1' })]);
    chains[chains.length - 1].steps.push(S('deriv'));
    // the Series step (a power series about a centre, a Laurent and a Dirichlet series from their a_n)
    add('series step power 1/n^2 about 0.5', [S('series', { kind: 'power', an: '\\frac{1}{n^2}', c: '0.5' })]);
    add('series step Laurent', [S('series', { kind: 'laurent', an: '\\frac{1}{2^{|n|}+n^2}', c: '0' })]);
    add('series step Dirichlet', [S('affine', { a: '1', b: '2' }), S('series', { kind: 'dirichlet', an: '(-1)^{n+1}', c: '0' })]);
    // [issue #6] the Recurrence step: Mandelbrot's u² + z near its main cardioid, Newton's method for z³ − 1, a contraction
    // with sin, and a short one differentiated
    add('recurrence u^2+z from 0', [S('affine', { a: '0.15', b: '0' }), S('recurrence', { u0: '0', g: 'u^2+z', N: 6, cut: 180 })]);
    add('recurrence Newton z^3-1', [S('recurrence', { u0: 'z', g: 'u-\\frac{u^3-1}{3u^2}', N: 12, cut: 180 })]);
    add('recurrence u/2+sin z', [S('recurrence', { u0: 'z', g: '\\frac{u}{2}+\\sin z', N: 20, cut: 180 })]);
    add('recurrence d/dz u^2+z', [S('affine', { a: '0.3', b: '0' }), S('recurrence', { u0: 'z', g: 'u^2+z', N: 3, cut: 180 }), S('deriv')]);
  }
  const selected = chains.filter((c, i) => i % PARTS === PART && (!FILTER || c.name.includes(FILTER)));

  // ---------- sample points (float32-exact) ----------
  const f32 = Math.fround;
  const pts = [];
  const NG = 18;
  for (let i = 0; i < NG; i++) for (let j = 0; j < NG; j++) {
    pts.push([-2.6 + (i + 0.5 + 0.13 * Math.sin(7 * j + i)) * 5.2 / NG, -2.6 + (j + 0.5 + 0.11 * Math.cos(5 * i + 3 * j)) * 5.2 / NG]);
  }
  for (const x of [-2.3, -1.7, -0.6, 0.45, 1.3, 2.2]) { pts.push([x, 0]); pts.push([0, x]); }
  // unit-modulus points where huge integer powers stay finite (parity of n matters), and |z| > 4 for z^-64
  pts.push([-1, 0], [0, 1], [0, -1], [0.6, 0.8], [7, 0], [-5, 3]);
  for (let k = 0; k < 12; k++) { const a = 0.3 + k * Math.PI / 6; for (const r of [0.05, 0.999, 1.001, 6, 14]) pts.push([r * Math.cos(a), r * Math.sin(a)]); }
  const P = pts.length;
  const Z = pts.map(([x, y]) => C(f32(x), f32(y)));
  // cell centres for chainSheet rows: a fixed offset, small against |z|
  const Zc = Z.map((z) => { const r = 0.03 * (1 + Math.hypot(z.re, z.im)); return C(f32(z.re + 0.6 * r), f32(z.im - 0.8 * r)); });
  const SHEET_W = 2;

  // ---------- CPU reference ----------
  const live = (steps, built, k) => steps[k - 1] && steps[k - 1].on !== false && built[k - 1] && !built[k - 1].error;
  // rowFn(...)(z) evaluates the row on the CPU; rowStages(...)(z) returns the largest |intermediate value|
  // (stage outputs of a range, f(z) inside a linear homotopy) to detect values outside float32 range.
  const liveDeriv = (steps, built, k) => live(steps, built, k) && built[k - 1].op === 'deriv';
  const derivIn = (steps, built, a, b) => { for (let k = Math.max(1, a + 1); k <= b; k++) if (liveDeriv(steps, built, k)) return true; return false; };
  // rows that evaluate stage maps of z (d/dz inside) or surfaces: compared with a double-precision model of the GPU
  // (its circle radii, its exactness), and skipped where that model and the CPU's own radii disagree (truncation
  // of the circle formula next to a singularity or a cut)
  const isStageRow = (steps, built, row) => row.mode === 3 || row.mode === 4 || (row.mode === 0 && row.a <= 0 && derivIn(steps, built, 0, row.b));
  function rangeTwin(steps, built, row) {
    const n = steps.length, liveK = (k) => live(steps, built, k);
    const stepFn = (k) => (liveK(k) && built[k - 1].op !== 'deriv' ? built[k - 1].f : null);
    const G = Funcs.stageFunctions(steps, built);
    const stageF = (k) => G[Math.max(0, Math.min(n, k))];
    const rangeF = (a, b) => { if (!a) return stageF(b); const fs = []; for (let i = a + 1; i <= b; i++) { const f = stepFn(i); if (f) fs.push(f); } return (z) => { for (const f of fs) z = f(z); return z; }; };
    const HR = HomRange.make({ n, stepFn, isDeriv: () => false, stepActive: (k) => !!stepFn(k), stageF, rangeF, built, C });
    return HR.cpuMap(row.mode === 7 ? { mode: 1, hi: row.k, t: row.t, b: row.b, post: row.post } : { mode: 3, a: row.k, b: row.b, t: row.t, post: row.post });
  }
  // the range row's composition with every stage value rounded to float32 (the GPU's precision between steps)
  function rangeTwin32(steps, built, row, z) {
    const r32 = (w) => C(Math.fround(w.re), Math.fround(w.im)), lo = row.mode === 7 ? row.k - 1 : row.k;
    let w = r32(z);
    for (let k = 1; k <= lo; k++) if (live(steps, built, k)) w = r32(built[k - 1].f(w));
    if (row.t > 0) for (let k = lo + 1; k <= (row.mode === 7 ? row.k : row.b); k++) if (live(steps, built, k)) { const b = built[k - 1]; w = r32(row.t >= 1 ? b.f(w) : b.hom ? b.hom(row.t)(w) : ((x) => { const v = b.f(x); return C((1 - row.t) * x.re + row.t * v.re, (1 - row.t) * x.im + row.t * v.im); })(w)); }
    for (let k = row.b + 1; k <= row.post; k++) if (live(steps, built, k)) w = r32(built[k - 1].f(w));
    return w;
  }
  // (review v16 regress-1) a range row's point that lies on a cut of one of its steps at float32 resolution: the
  // step's input is real to within 1e-6 (a zero imaginary part whose sign the GPU does not keep, e.g. tanh saturated to
  // 1 then a zoom to 1.001, fed to arcsin) and the step jumps across it. The CPU and the GPU then take either side, so
  // the point is not compared (counted in skippedRangeF32, as the mode-0 rows' discontinuity check would)
  function rangeOnCut(steps, built, row, z) {
    const lo = row.mode === 7 ? row.k - 1 : row.k, hi = row.mode === 7 ? row.k : row.b, fs = [];
    for (let k = 1; k <= lo; k++) if (live(steps, built, k)) fs.push(built[k - 1].f);
    if (row.t > 0) for (let k = lo + 1; k <= hi; k++) if (live(steps, built, k)) { const b = built[k - 1]; fs.push(row.t >= 1 ? b.f : b.hom ? b.hom(row.t) : (x) => { const v = b.f(x); return C((1 - row.t) * x.re + row.t * v.re, (1 - row.t) * x.im + row.t * v.im); }); }
    for (let k = row.b + 1; k <= row.post; k++) if (live(steps, built, k)) fs.push(built[k - 1].f);
    let w = z;
    for (const f of fs) {
      const e = 1e-6 * (1 + CX.abs(w));
      if (fin(w) && Math.abs(w.im) <= e) {
        const a = f(C(w.re, e)), b = f(C(w.re, -e)), m = f(w);
        if (fin(a) && fin(b) && fin(m) && CX.abs(CX.sub(a, b)) > 1e-3 * (1 + CX.abs(m))) return true;
      }
      w = f(w);
    }
    return false;
  }
  function rowFn(steps, built, row, model) {
    if (row.mode === 9) return (z, zc) => Funcs.sheetMapEval(steps, built, row.map, zc, z, row.combo, SHEET_W, row.end || 0);
    if (row.mode === 7 || row.mode === 8) return rangeTwin(steps, built, row);
    if (row.mode === 4) return (z, zc) => Funcs.sheetEval(steps, built, row.b, zc, z, row.combo, SHEET_W, model || {});
    if (row.mode === 5) return (z, zc) => Funcs.sheetEval(steps, built, row.b, zc, z, row.combo, SHEET_W, { a: row.a });
    if (isStageRow(steps, built, row)) return Funcs.stageFunctions(steps, built, model || {})[Math.max(0, Math.min(row.mode === 3 ? row.k : row.b, steps.length))];
    if (row.mode === 0 && derivIn(steps, built, row.a, row.b)) return () => C(NaN, NaN);
    if (row.mode === 0) {
      const fs = [];
      for (let k = row.a + 1; k <= row.b; k++) if (live(steps, built, k)) fs.push(built[k - 1].f);
      return (z) => { for (const f of fs) z = f(z); return z; };
    }
    if (row.mode === 6) {
      const hs = [];
      for (let k = row.a + 1; k <= row.b; k++) {
        if (!live(steps, built, k)) continue;
        const bk = built[k - 1];
        if (bk.op === 'deriv') return () => C(NaN, NaN);
        hs.push((bk.hom || ((tt) => (z) => { const w = bk.f(z); return C((1 - tt) * z.re + tt * w.re, (1 - tt) * z.im + tt * w.im); }))(row.t));
      }
      return (z) => { for (const hh of hs) z = hh(z); return z; };
    }
    if (!live(steps, built, row.i)) return (z) => z;
    const b = built[row.i - 1];
    if (row.mode === 1) return b.f;
    const hom = b.hom || ((tt) => (z) => { const w = b.f(z); return C((1 - tt) * z.re + tt * w.re, (1 - tt) * z.im + tt * w.im); });
    return hom(row.t);
  }
  // Riemann-sphere conventions the GPU uses for IEEE infinities (a float32 overflow of a value the CPU still holds in
  // double, or one of the CPU's own exact infinities such as arctan(i) or artanh(-1)): a Mobius map sends infinity to
  // a/c, a finite number over an infinite one is 0, a negative integer power is (1/z)^|n| (the CPU's inv(z^|n|) is
  // NaN once z^|n| overflows double, e.g. n = -16777217 at |z| > 1.00005) and an overflowing z^n (|z| > 1) is infinity, and e^z with Re z < -104 is 0 even when
  // Im z is infinite. The CPU gets NaN in these cases from Inf * 0. sphere(fn) runs fn with CX patched to these
  // conventions (funcs.js / parse.js look the methods up on CX at call time); where the CPU is non-finite but the GPU
  // finite, the singular check requires the GPU value to match this sphere-aware CPU value.
  const isInfNoNaN = (z) => !Number.isNaN(z.re) && !Number.isNaN(z.im) && (!Number.isFinite(z.re) || !Number.isFinite(z.im));
  const CX0 = { div: CX.div, inv: CX.inv, ipow: CX.ipow, mobApply: CX.mobApply, exp: CX.exp };
  const SPHERE = {
    div: (a, b) => (isInfNoNaN(b) && fin(a) ? C(0, 0) : CX0.div(a, b)),
    inv: (a) => SPHERE.div(CX.ONE, a),
    ipow: (a, n) => {
      if (n < 0) return CX0.ipow(SPHERE.inv(a), -n);
      const r = CX0.ipow(a, n); // |z| > 1: an overflow (Inf - Inf = NaN in complex squaring) is the point at infinity
      return !fin(r) && CX.abs(a) > 1 ? C(Infinity, Infinity) : r;
    },
    mobApply: (m, z) => (isInfNoNaN(z) ? SPHERE.div(m[0], m[2]) : CX0.mobApply(m, z)),
    exp: (a) => (a.re < -104 && !Number.isNaN(a.im) ? C(0, 0) : CX0.exp(a)),
  };
  function sphere(fn) {
    Object.assign(CX, SPHERE);
    try { return fn(); } catch (e) { return C(NaN, NaN); } finally { Object.assign(CX, CX0); }
  }
  // Float32 cancellation probe for custom formulas: the largest |operand| of a z-dependent sum/difference.
  // 1.2e-7 * that bounds the float32 rounding error of the sum (e.g. sin^2 z + cos^2 z at Im z = 13:
  // operands ~1e11, result 1), which no float32 evaluation can avoid.
  const probeCache = new WeakMap();
  // the steps built as a formula (b.ast): a Series step too ([issue #5])
  const FORMULA = new Set(['custom', 'series']);
  function cancelProbe(b) {
    if (probeCache.has(b)) return probeCache.get(b);
    const th = (b.vals.cut ?? 180) * Math.PI / 180;
    const ops = [];
    const ast = b.ast || Expr.parse(b.vals.expr);
    (function walk(n) {
      // [issue #5] a sum: the sum of its terms' sizes (its body is not walked: its parts need the index), and outside the
      // radii where the GPU evaluates a power series' plan, no float32 value (GLChain.seriesTrust)
      if (n.t === 'sum') {
        if (Expr.depends(n) && n.op !== 'prod') ops.push(Expr.compile(Object.assign({}, n, { a: { t: 'call', f: 'abs', a: n.a } }), { theta: th }));
        const plan = Expr.planOf(n);
        if (plan && plan.kind !== 'dirichlet') {
          const tr = GLChain.seriesTrust(plan);
          ops.push((z) => { const r = CX.abs(CX.sub(z, plan.c)); return r <= tr.out && r >= tr.in ? C(0, 0) : C(Infinity, 0); });
        }
        return;
      }
      if ((n.t === 'add' || n.t === 'sub') && Expr.depends(n)) ops.push(Expr.compile(n.a, { theta: th }), Expr.compile(n.b, { theta: th }));
      for (const k of ['a', 'b', 'n']) if (n[k] && n[k].t) walk(n[k]);
    })(ast);
    const f = ops.length ? (z, w) => { let m = 0; for (const o of ops) { const v = o(z); m = Math.max(m, fin(v) ? CX.abs(v) : Infinity); } return 1.2e-7 * m / (1 + CX.abs(w)); } : null;
    probeCache.set(b, f);
    return f;
  }
  // relative float32 error of one factor f'(x) of the exact chain rule: cancellation inside the derivative formula
  // (largest |operand| of a z-dependent sum against |f'(x)|) and its sensitivity to a float32 rounding of x
  const dprobeCache = new WeakMap();
  function derivRelErr(b, x) {
    if (!dprobeCache.has(b)) {
      let pr = null;
      const d = Funcs.derivAst(b, { stable: true });
      if (!d.error) {
        const th = d.cut * Math.PI / 180, ops = [], df = Expr.compile(d.ast, { theta: th });
        (function walk(n) {
          // ([issue #5] a sum as in cancelProbe: the sum of its terms' sizes, its body not walked)
          if (n.t === 'sum') { if (Expr.depends(n) && n.op !== 'prod') ops.push(Expr.compile(Object.assign({}, n, { a: { t: 'call', f: 'abs', a: n.a } }), { theta: th })); return; }
          if ((n.t === 'add' || n.t === 'sub') && Expr.depends(n)) ops.push(Expr.compile(n.a, { theta: th }), Expr.compile(n.b, { theta: th }));
          for (const k of ['a', 'b', 'n']) if (n[k] && n[k].t) walk(n[k]);
        })(d.ast);
        pr = { df, ops };
      }
      dprobeCache.set(b, pr);
    }
    const pr = dprobeCache.get(b);
    if (!pr) return 0;
    const v = pr.df(x);
    if (!fin(v) || CX.abs(v) === 0) return fin(v) ? 0 : Infinity;
    let m = 0;
    for (const o of pr.ops) { const u = o(x); m = Math.max(m, fin(u) ? CX.abs(u) : Infinity); }
    const h = 2.4e-7 * (1 + CX.abs(x));
    let sens = 0;
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) { const u = pr.df(C(x.re + h * dx, x.im + h * dy)); sens = Math.max(sens, fin(u) ? CX.abs(CX.sub(u, v)) : Infinity); }
    return (1.2e-7 * m + sens) / CX.abs(v);
  }
  // steps whose homotopy is (1-t) z + t f(z) in funcs.js (no natural path: a constant, a formula that is not
  // recognisably a catalog map), so f(z) is an intermediate value of the homotopy
  const LINEAR_HOM = new Set(['poly', 'rational', 'zp', 'custom', 'series']);
  const isLinHom = (b) => !b.hom || (LINEAR_HOM.has(b.def.id) && !b.nat);
  // returns z => {mag: largest |intermediate|, cancel: largest relative float32 cancellation error of a custom step}
  function rowStages(steps, built, row) {
    if (row.mode === 5) row = { mode: 0, a: row.a, b: row.b }; // a sheet range: the steps in (a, b] from a point
    if (isStageRow(steps, built, row)) {
      // stage magnitudes (principal sheets), float32 cancellation of custom steps, and the rounding of each GPU
      // circle formula: eps |G_{d-1}| / r relative to 1 + |G_d|
      const G = Funcs.stageFunctions(steps, built);
      const b = Math.min(row.mode === 3 ? row.k : row.b, steps.length);
      let circle = false, dExact = false;
      const L0 = 0;
      for (let k = 1; k <= b; k++) if (liveDeriv(steps, built, k)) { if (row.mode === 4 || G.levels[k] > 0) circle = true; else dExact = true; }
      // forward float32 error estimate E (absolute) through the stages: rounding of every value, its propagation through
      // each map (numerical sensitivity), a circle formula dividing its input error by r, the exact chain rule's
      // relative error per factor (rounding, cancellation in the derivative formula, sensitivity to its argument)
      const at = (z) => {
        let mag = 0, L = L0, E = 0, dInf = false, wb = z;
        const NB4 = [[1, 0], [0, 1], [-1, 0], [0, -1]];
        for (let k = 1; k <= b; k++) {
          if (!live(steps, built, k)) continue;
          const bb = built[k - 1], w = G[k](z), w0 = G[k - 1](z);
          wb = w;
          if (bb.op === 'deriv') {
            if (!fin(w)) dInf = true;
            L = row.mode === 4 ? L + 1 : G.levels[k];
            if (L) {
              const r = GLChain.circleRel(L) * (1 + CX.abs(z));
              E = 1.3 * (E + 2.4e-7 * (fin(w0) ? CX.abs(w0) : Infinity)) / r;
              // the GPU evaluates G_{d-1} on the circle: its values there must fit float32 too
              for (let j = 0; j < 8; j++) { const v = G[k - 1](C(z.re + r * Math.cos(j * Math.PI / 4), z.im + r * Math.sin(j * Math.PI / 4))); mag = Math.max(mag, fin(v) ? CX.abs(v) : Infinity); }
            } else {
              let rel = 0, x = z;
              for (let j = 1; j < k; j++) {
                if (!live(steps, built, j)) continue;
                const bj = built[j - 1];
                rel += 2.4e-7 + derivRelErr(bj, x);
                x = bj.f(x);
              }
              E = rel * (fin(w) ? CX.abs(w) : Infinity);
            }
          } else {
            if (E > 0) {
              let d = 0;
              for (const [dx, dy] of NB4) { const v = bb.f(C(w0.re + E * dx, w0.im + E * dy)); d = Math.max(d, fin(v) && fin(w) ? CX.abs(CX.sub(v, w)) : Infinity); }
              E = d;
            }
            E += 1.2e-7 * (fin(w) ? CX.abs(w) : Infinity);
            if (FORMULA.has(bb.def.id)) { const pr = cancelProbe(bb); if (pr) E += pr(w0, w) * (1 + (fin(w) ? CX.abs(w) : 0)); }
          }
          mag = Math.max(mag, fin(w) ? CX.abs(w) : Infinity, fin(w0) ? CX.abs(w0) : Infinity);
        }
        const cancel = E / (1 + (fin(wb) ? CX.abs(wb) : 0));
        return { mag, cancel, circle, dExact, dInf };
      };
      // a sheet row also evaluates the cell centre zc (its values set the local cuts)
      return (z, zc) => {
        const a = at(z);
        if (!zc) return a;
        const c = at(zc);
        return { mag: Math.max(a.mag, c.mag), cancel: Math.max(a.cancel, c.cancel), circle, dExact, dInf: a.dInf || c.dInf };
      };
    }
    const ks = [];
    if (row.mode === 9) {
      // (v16.1) the magnitudes along the principal composition of the map's steps (in full, or the path at t), at z and zc
      const m = row.map, hs = [];
      for (let k = 1; k <= steps.length; k++) {
        if (!live(steps, built, k)) continue;
        const how = Funcs.sheetMapHow(m, k), b = built[k - 1];
        if (how === 1 || (how === 2 && m.t >= 1)) hs.push(b.f);
        else if (how === 2 && m.t > 0) hs.push(b.hom ? b.hom(m.t) : (zz) => { const w = b.f(zz); return C((1 - m.t) * zz.re + m.t * w.re, (1 - m.t) * zz.im + m.t * w.im); });
      }
      return (z, zc) => {
        let mag = 0;
        for (const z0 of zc ? [z, zc] : [z]) { let w = z0; for (const hh of hs) { w = hh(w); mag = Math.max(mag, fin(w) ? CX.abs(w) : Infinity); } }
        return { mag, cancel: 0 };
      };
    }
    if (row.mode === 7 || row.mode === 8) {
      // (v16) the magnitudes along the row's own composition: the pre in full, the bracketed homotopies at t (none at
      // t = 0, the identity), the post in full
      const lo = row.mode === 7 ? row.k - 1 : row.k, his = [];
      for (let k = lo + 1; k <= (row.mode === 7 ? row.k : row.b); k++) if (live(steps, built, k) && row.t > 0) his.push(built[k - 1]);
      const pre = [], post = [];
      for (let k = 1; k <= lo; k++) if (live(steps, built, k)) pre.push(built[k - 1]);
      for (let k = row.b + 1; k <= row.post; k++) if (live(steps, built, k)) post.push(built[k - 1]);
      return (z) => {
        let mag = 0, cancel = 0;
        const step = (b, w) => { if (FORMULA.has(b.def.id)) { const pr = cancelProbe(b); if (pr) cancel = Math.max(cancel, pr(z, w)); } z = w; mag = Math.max(mag, fin(z) ? CX.abs(z) : Infinity); };
        for (const b of pre) step(b, b.f(z));
        for (const b of his) { if (isLinHom(b)) { const w = b.f(z); mag = Math.max(mag, fin(w) ? CX.abs(w) : Infinity); } step(b, (b.hom ? b.hom(row.t) : (zz) => { const w = b.f(zz); return C((1 - row.t) * zz.re + row.t * w.re, (1 - row.t) * zz.im + row.t * w.im); })(z)); }
        for (const b of post) step(b, b.f(z));
        return { mag, cancel };
      };
    }
    else if (row.mode === 0) { for (let k = row.a + 1; k <= row.b; k++) if (live(steps, built, k)) ks.push(k); }
    else if (row.mode === 6) {
      // all at once: the magnitudes along the composition of the paths (and f of a straight-line step)
      const hs = [];
      for (let k = row.a + 1; k <= row.b; k++) if (live(steps, built, k) && built[k - 1].op !== 'deriv') hs.push(built[k - 1]);
      return (z) => {
        let mag = 0, cancel = 0;
        for (const b of hs) {
          if (row.t !== 0 && isLinHom(b)) { const w = b.f(z); mag = Math.max(mag, fin(w) ? CX.abs(w) : Infinity); if (FORMULA.has(b.def.id)) { const pr = cancelProbe(b); if (pr) cancel = Math.max(cancel, pr(z, w)); } }
          z = (b.hom ? b.hom(row.t) : (zz) => zz)(z);
          mag = Math.max(mag, fin(z) ? CX.abs(z) : Infinity);
        }
        return { mag, cancel };
      };
    }
    else if (live(steps, built, row.i) && (row.mode === 1 || (row.t !== 0 && isLinHom(built[row.i - 1])))) ks.push(row.i);
    return (z) => {
      let mag = 0, cancel = 0;
      for (const k of ks) {
        const b = built[k - 1];
        const w = b.f(z);
        if (FORMULA.has(b.def.id)) { const pr = cancelProbe(b); if (pr) cancel = Math.max(cancel, pr(z, w)); }
        z = w;
        mag = Math.max(mag, fin(z) ? CX.abs(z) : Infinity);
      }
      return { mag, cancel };
    };
  }
  const fin = (w) => w && Number.isFinite(w.re) && Number.isFinite(w.im);
  // a stage row through the CPU's steps with every stage value rounded to float32 (a value the CPU puts exactly on a
  // pole, like arcsin(1) = pi/2 into tan, is off the pole in float32): finite and large -> float32 cannot do better
  function f32Finite(steps, built, row, z) {
    if (row.mode === 4) return false;
    const G = Funcs.stageFunctions(steps, built);
    const b = Math.min(row.mode === 3 ? row.k : row.b, steps.length);
    const r32 = (w) => C(Math.fround(w.re), Math.fround(w.im));
    let w = z;
    for (let k = 1; k <= b; k++) {
      if (!live(steps, built, k)) continue;
      w = r32(built[k - 1].op === 'deriv' ? G[k](z) : built[k - 1].f(w));
    }
    return fin(w);
  }
  const NB = [0, 1, 2, 3, 4, 5].map((k) => [Math.cos(k * Math.PI / 3 + 0.1), Math.sin(k * Math.PI / 3 + 0.1)]);
  function expected(g, z) {
    let w;
    try { w = g(z); } catch (e) { return { skip: 'nonfinite' }; }
    if (!fin(w) || CX.abs(w) > 1e6) return { skip: 'nonfinite', w };
    // Discontinuous (or too steep for float32) when a neighbour at distance rho differs by more than thr,
    // or when the change at distance rho/16 is not much smaller than at rho (a jump: z sits on a cut,
    // where the CPU picks the side from the sign of a zero, which GPUs do not preserve).
    const rho = 1e-4 * (1 + CX.abs(z));
    const thr = 1e-2 * (1 + CX.abs(w));
    let d1 = 0, d2 = 0;
    for (const [dx, dy] of NB) {
      const v = g(C(z.re + rho * dx, z.im + rho * dy));
      if (!fin(v)) return { skip: 'disc', w };
      d1 = Math.max(d1, CX.abs(CX.sub(v, w)));
      const u = g(C(z.re + rho / 16 * dx, z.im + rho / 16 * dy));
      if (!fin(u)) return { skip: 'disc', w };
      d2 = Math.max(d2, CX.abs(CX.sub(u, w)));
    }
    if (d1 > thr || (d1 > 1e-4 * (1 + CX.abs(w)) && d2 > 0.3 * d1)) return { skip: 'disc', w };
    return { w };
  }

  // ---------- WebGL ----------
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2');
  if (!gl) { R.errors.push('no webgl2'); R.done = true; return; }
  if (!gl.getExtension('EXT_color_buffer_float')) { R.errors.push('no EXT_color_buffer_float'); R.done = true; return; }
  R.renderer = (() => { const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); })();
  const VS = '#version 300 es\nvoid main(){ vec2 p = vec2(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0); gl_Position = vec4(p, 0.0, 1.0); }';
  const MAIN = `
uniform highp sampler2D uPts;
uniform highp sampler2D uModes;
out vec4 o;
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec4 zz = texelFetch(uPts, ivec2(c.x, 0), 0);
  vec2 z = zz.xy;
  vec4 m = texelFetch(uModes, ivec2(0, c.y), 0);
  vec2 w;
  // (v16.1) mode 9: chainSheetHom; m = (9, mode + 4 post + 256 end, t, combo), the second texel (base, a, hi, b)
  if (m.x > 8.75 && m.x < 9.25) {
    vec4 m2 = texelFetch(uModes, ivec2(1, c.y), 0);
    int pk = int(m.y + 0.5), pq = pk / 4;
    w = chainSheetHom(zz.zw, z, pk - 4 * pq, int(m2.x + 0.5), int(m2.y + 0.5), int(m2.z + 0.5), int(m2.w + 0.5), pq - 64 * (pq / 64), m.z, int(m.w + 0.5), pk / 256);
  } else
  if (m.x < 0.5) w = chainRange(z, int(m.y), int(m.z));
  else if (m.x < 1.5) w = chainStep(int(m.y), z);
  else if (m.x < 2.5) w = chainHom(int(m.y), z, m.z);
  else if (m.x < 3.5) w = chainStage(int(m.y), z);
  else if (m.x < 4.5) w = chainSheet(zz.zw, z, int(m.y), int(m.z));
  else if (m.x < 5.5) w = chainSheetRange(zz.zw, z, int(m.y), int(m.z), int(m.w));
  else if (m.x > 6.5) {
    int xi = int(m.x + 0.5), md = xi - 16 * (xi / 16), kk = xi / 16, b = int(m.y + 0.5), post = int(m.z + 0.5);
    vec2 u = chainRange(z, 0, md == 7 ? kk - 1 : kk);
    if (md == 7) u = m.w <= 0.0 ? u : chainHom(kk, u, m.w);
    else u = m.w <= 0.0 ? u : chainHomAll(u, kk, b, m.w);
    w = post > b ? chainRange(u, b, post) : u;
  }
  else w = chainHomAll(z, int(m.y), int(m.z), m.w);
  o = vec4(w, cfin(w) ? 1.0 : 0.0, 1.0);
}`;
  function compile(src) {
    const mk = (type, s) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, s); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) + '\n' + s.split('\n').map((l, i) => `${i + 1}: ${l}`).slice(-200).join('\n'));
      return sh;
    };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, mk(gl.FRAGMENT_SHADER, src));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return { p, uChain: gl.getUniformLocation(p, 'uChain'), uPts: gl.getUniformLocation(p, 'uPts'), uModes: gl.getUniformLocation(p, 'uModes'), uSheetW: gl.getUniformLocation(p, 'uSheetW') };
  }
  const tex = (w, h, data) => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, data);
    return t;
  };
  const ptsData = new Float32Array(4 * P);
  Z.forEach((z, i) => { ptsData[4 * i] = z.re; ptsData[4 * i + 1] = z.im; ptsData[4 * i + 2] = Zc[i].re; ptsData[4 * i + 3] = Zc[i].im; });
  const ptsTex = tex(P, 1, ptsData);
  const HMAX = 128;
  const outTex = tex(P, HMAX, null);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, outTex, 0);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) { R.errors.push('fbo incomplete'); R.done = true; return; }
  const modeTex = gl.createTexture();
  const progs = new Map(), srcByKey = new Map();
  const vao = gl.createVertexArray();

  function runGPU(gc, rows) {
    let pr = progs.get(gc.key);
    if (!pr) {
      pr = compile('#version 300 es\nprecision highp float;\n' + GLChain.LIB + '\n' + gc.source + (gc.sheetHom || '') + '\n' + MAIN);
      progs.set(gc.key, pr);
      R.programs++;
    }
    gl.useProgram(pr.p);
    const u = new Float32Array(4 * gc.slots);
    gc.fill(u);
    gl.uniform4fv(pr.uChain, u);
    const md = new Float32Array(8 * rows.length);
    if (rows.length > HMAX) throw new Error(`too many rows: ${rows.length}`);
    rows.forEach((r, i) => {
      const v = r.mode === 0 ? [r.a, r.b] : r.mode === 3 ? [r.k, 0] : r.mode === 4 ? [r.b, r.combo] : r.mode === 5 ? [r.a, r.b, r.combo] : r.mode === 6 ? [r.a, r.b, r.t] : [r.i, r.t || 0];
      // (v16: modes 7 and 8 pack their step into x: mode + 16 k, then b, post and t)
      if (r.mode === 7 || r.mode === 8) md.set([r.mode + 16 * r.k, r.b, r.post, r.t], 8 * i);
      else if (r.mode === 9) { const m = r.map; md.set([9, m.mode + 4 * (m.post || 0) + 256 * (r.end || 0), m.t || 0, r.combo, m.base || 0, m.a || 0, m.hi || 0, m.b || 0], 8 * i); }
      else md.set([r.mode, v[0], v[1], v[2] || 0], 8 * i);
    });
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, modeTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 2, rows.length, 0, gl.RGBA, gl.FLOAT, md);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, ptsTex);
    gl.uniform1i(pr.uPts, 0); gl.uniform1i(pr.uModes, 1);
    if (pr.uSheetW) gl.uniform1i(pr.uSheetW, SHEET_W);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, P, rows.length);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const out = new Float32Array(4 * P * rows.length);
    gl.readPixels(0, 0, P, rows.length, gl.RGBA, gl.FLOAT, out);
    return out;
  }

  const rowName = (r) => (r.mode === 0 ? `range(${r.a},${r.b})` : r.mode === 1 ? `step(${r.i})` : r.mode === 2 ? `hom(${r.i},t=${r.t})`
    : r.mode === 3 ? `stage(${r.k})` : r.mode === 4 ? `sheet(${r.b},combo=${r.combo})` : r.mode === 6 ? `homAll(${r.a},${r.b},t=${r.t})` : r.mode === 7 ? `rangeNat(hi=${r.k},b=${r.b},post=${r.post},t=${r.t})` : r.mode === 8 ? `rangeAll(lo=${r.k},b=${r.b},post=${r.post},t=${r.t})` : r.mode === 9 ? `sheetHom(${JSON.stringify(r.map)},combo=${r.combo}${r.end ? `,end=${r.end}` : ''})` : `sheetRange(${r.a},${r.b},combo=${r.combo})`);
  function testChain(ch) {
    const built = ch.steps.map((s) => Funcs.build(s));
    const gc = GLChain.build(ch.steps, built);
    if (srcByKey.has(gc.key) && srcByKey.get(gc.key) !== gc.source) R.errors.push(`key collision: ${ch.name}`);
    srcByKey.set(gc.key, gc.source);
    const n = ch.steps.length;
    const rows = [{ mode: 0, a: 0, b: n }];
    if (n > 1) rows.push({ mode: 0, a: 1, b: n }, { mode: 0, a: 0, b: n - 1 });
    rows.push({ mode: 0, a: 2, b: 1 });
    for (let i = 1; i <= n; i++) rows.push({ mode: 1, i });
    for (let i = 1; i <= n; i++) for (const t of TS) rows.push({ mode: 2, i, t });
    // all steps at once (the app's map mode 3): every step's natural path at the same t
    if (n > 1) for (const t of TS) rows.push({ mode: 6, a: 0, b: n, t });
    const derivs = gc.derivs || [], sheets = gc.sheets ? gc.sheets.steps : [];
    if (derivs.length) for (let k = 0; k <= n; k++) rows.push({ mode: 3, k });
    if (derivs.length || sheets.length) {
      const nc = gc.sheets.combos(SHEET_W, n);
      for (let c = 0; c < Math.min(nc, 12); c++) rows.push({ mode: 4, b: n, combo: c });
      // a prefix: digits of the later pieces are not read
      if (n > 1 && sheets.length) rows.push({ mode: 4, b: n - 1, combo: 1 });
      // the surfaces of the steps after the first, from points of the w_1-plane (a focused step)
      if (n > 1) for (let c = 0; c < Math.min(gc.sheets.combos(SHEET_W, n, 1), 4); c++) rows.push({ mode: 5, a: 1, b: n, combo: c });
    }
    // (v16 deformation range, SPEC 13.2) mode 7: chainRange(chainHom(hi, chainRange(z, 0, hi - 1), t), b, post); mode 8:
    // chainRange(chainHomAll(chainRange(z, 0, lo), lo, b, t), b, post); the CPU twin is HomRange.cpuMap
    if (n >= 2 && !derivs.length) {
      const act = (k) => live(ch.steps, built, k);
      for (let a = 1; a <= n; a++) for (let b = a; b <= n; b++) {
        const ks = []; for (let k = a; k <= b; k++) if (act(k)) ks.push(k);
        let out0 = 0; for (let k = 1; k <= n; k++) if (act(k) && (k < a || k > b)) out0++;
        if (!ks.length || !out0) continue;
        for (const t of RANGE_TS) {
          if (rows.length + 2 > HMAX) break;
          rows.push({ mode: 7, k: ks[0], b, post: n, t });
          if (ks.length > 1) rows.push({ mode: 8, k: a - 1, b, post: n, t });
        }
      }
      R.rangeRows = (R.rangeRows || 0) + rows.filter((r) => r.mode === 7 || r.mode === 8).length;
    }
    // (v16.1 user-5) mode 9: chainSheetHom, H_t on the sheets that become F's (Funcs.sheetMapEval): every step at t
    // after the steps before it (and with the post after it), all at once, at t in SHEET_TS, the first combos
    if (sheets.length && !derivs.length) {
      const act = (k) => live(ch.steps, built, k), maps = [];
      for (let k = 1; k <= n; k++) if (act(k)) for (const t of SHEET_TS) { maps.push({ mode: 1, hi: k, t }); if (k < n) maps.push({ mode: 1, hi: k, t, b: k, post: n }); }
      if (n > 1) for (const t of SHEET_TS) maps.push({ mode: 3, a: 0, b: n, t });
      for (const m of maps) {
        if (!Funcs.sheetMapPieces(ch.steps, built, m)) continue;
        const K = Funcs.sheetMapCombos(ch.steps, built, m, SHEET_W);
        for (let c = 0; c < Math.min(K, 3) && rows.length < HMAX; c++) rows.push({ mode: 9, map: m, combo: c, t: m.t });
        // (v16.1 review math-5) F's digits (end = n): a step not begun reads its digits; the first and the last combos
        if (m.mode === 1 && m.hi < n && Funcs.sheetMapPieces(ch.steps, built, m, n)) {
          const KE = Funcs.sheetMapCombos(ch.steps, built, m, SHEET_W, Funcs.SHEET_MAX, n);
          for (const c of [...new Set([0, 1, KE - 1])]) if (c < KE && rows.length < HMAX) rows.push({ mode: 9, map: m, combo: c, t: m.t, end: n });
        }
      }
      R.sheetHomRows = (R.sheetHomRows || 0) + rows.filter((r) => r.mode === 9).length;
    }
    const model = { circleRel: GLChain.circleRel, exact: gc.derivExact };
    const out = runGPU(gc, rows);
    rows.forEach((row, ri) => {
      const stageRow = isStageRow(ch.steps, built, row);
      if (stageRow) { if (row.mode === 4) R.sheetRows++; else R.derivRows++; }
      if (row.mode === 5) R.sheetRangeRows = (R.sheetRangeRows || 0) + 1;
      const g0 = rowFn(ch.steps, built, row, stageRow ? model : null), gs = rowStages(ch.steps, built, row);
      const ref0 = stageRow ? rowFn(ch.steps, built, row) : null;
      for (let p = 0; p < P; p++) {
        R.total++;
        const g = row.mode >= 4 ? (z) => g0(z, Zc[p]) : g0;
        const e = expected(g, Z[p]);
        if (!e.skip && ref0) {
          const wr = row.mode === 4 ? ref0(Z[p], Zc[p]) : ref0(Z[p]);
          if (!fin(wr) || CX.abs(CX.sub(wr, e.w)) > 0.25 * TOL * (1 + CX.abs(wr))) { R.skippedTrunc++; continue; }
        }
        if (!e.skip) {
          const st = gs(Z[p], row.mode === 4 ? Zc[p] : null);
          if (st.mag > 1e30 || st.cancel > 5e-4) {
            // an intermediate value exceeds float32 range on the CPU (e.g. z^5000 then a root), or a custom formula
            // cancels huge terms (sin^2 z + cos^2 z far from the real axis): float32 cannot represent the result
            if (st.mag > 1e30) R.skippedF32Range++; else R.skippedF32Cancel++;
            const tag = `${st.mag > 1e30 ? 'range' : 'cancel'}: ${ch.name}`;
            R.f32ByChain[tag] = (R.f32ByChain[tag] || 0) + 1;
            if (R.f32RangeExamples.length < 12) R.f32RangeExamples.push({ chain: ch.name, row: rowName(row), z: [Z[p].re, Z[p].im], maxIntermediate: st.mag, cancelRelErr: st.cancel, cpu: [e.w.re, e.w.im] });
            continue;
          }
        }
        if (e.skip) {
          if (e.skip === 'disc') R.skippedDiscontinuous++; else R.skippedNonFinite++;
          // singular sanity: CPU non-finite or huge -> cfin must be false on the GPU
          const k = (ri * P + p) * 4;
          // (hom at t = 0 is the exact identity on the GPU even where the CPU's (1-t)z + t f(z) gives 0*inf = NaN)
          if (e.skip === 'nonfinite' && stageRow) { const st = gs(Z[p]); if (st.circle || st.dInf || f32Finite(ch.steps, built, row, Z[p])) { R.skippedTrunc++; continue; } }
          if (e.skip === 'nonfinite' && !((row.mode === 2 || row.mode === 6 || row.mode === 7 || row.mode === 8 || row.mode === 9) && row.t === 0) && (!fin(e.w) || CX.abs(e.w) > 1e31)) {
            if (out[k + 2] > 0.5) {
              const ws = sphere(() => g(Z[p]));
              if (fin(ws) && Math.hypot(out[k] - ws.re, out[k + 1] - ws.im) <= TOL * (1 + CX.abs(ws))) {
                R.singular.sphereLimits++;
                R.singular.sphereByChain[ch.name] = (R.singular.sphereByChain[ch.name] || 0) + 1;
                if (R.singular.sphereExamples.length < 8) R.singular.sphereExamples.push({ chain: ch.name, row: rowName(row), z: [Z[p].re, Z[p].im], cpu: e.w ? [e.w.re, e.w.im] : null, sphere: [ws.re, ws.im], gpu: [out[k], out[k + 1]] });
                continue;
              }
            }
            R.singular.checked++;
            if (out[k + 2] > 0.5) { R.singular.badCount++; R.singular.byChain = R.singular.byChain || {}; R.singular.byChain[ch.name] = (R.singular.byChain[ch.name] || 0) + 1; }
            if (out[k + 2] > 0.5 && R.singular.bad.length < 20) R.singular.bad.push({ chain: ch.name, row: rowName(row), z: [Z[p].re, Z[p].im], cpu: e.w ? [e.w.re, e.w.im] : null, gpu: [out[k], out[k + 1]] });
          }
          continue;
        }
        // (v16 range rows: a value float32 cannot reproduce, the row's own composition with every stage rounded to
        // float32 already as far from the CPU as the tolerance: next to a pole of a later step, e.g. a Möbius map)
        if ((row.mode === 7 || row.mode === 8)) {
          const k0 = (ri * P + p) * 4, gw0 = C(out[k0], out[k0 + 1]);
          if (!(Math.hypot(gw0.re - e.w.re, gw0.im - e.w.im) <= TOL * (1 + CX.abs(e.w)))) {
            const w32 = rangeTwin32(ch.steps, built, row, Z[p]);
            if (!fin(w32) || Math.hypot(w32.re - e.w.re, w32.im - e.w.im) > 0.5 * TOL * (1 + CX.abs(e.w)) || rangeOnCut(ch.steps, built, row, Z[p])) {
              R.skippedRangeF32 = (R.skippedRangeF32 || 0) + 1;
              if (rangeOnCut(ch.steps, built, row, Z[p])) R.skippedRangeCut = (R.skippedRangeCut || 0) + 1;
              continue;
            }
          }
        }
        R.compared++;
        if (stageRow) { if (row.mode === 4) R.comparedSheet = (R.comparedSheet || 0) + 1; else R.comparedDeriv = (R.comparedDeriv || 0) + 1; }
        if (row.mode === 5) R.comparedSheetRange = (R.comparedSheetRange || 0) + 1;
        if (row.mode === 9) R.comparedSheetHom = (R.comparedSheetHom || 0) + 1;
        const k = (ri * P + p) * 4;
        const gw = C(out[k], out[k + 1]);
        const err = Math.hypot(gw.re - e.w.re, gw.im - e.w.im);
        if (!(err <= TOL * (1 + CX.abs(e.w)))) {
          R.failCount++;
          R.failByChain[ch.name] = (R.failByChain[ch.name] || 0) + 1;
          if (R.failures.length < 50) R.failures.push({ chain: ch.name, steps: ch.steps.map((s) => ({ type: s.type, params: s.params, on: s.on })), row: rowName(row), point: [Z[p].re, Z[p].im], cpu: [e.w.re, e.w.im], gpu: [gw.re, gw.im], err });
        }
      }
    });
  }

  // ---------- key properties ----------
  function keyOf(steps) { return GLChain.build(steps, steps.map((s) => Funcs.build(s))).key; }
  function keyCheck(name, s1, s2, same) {
    const ok = (keyOf(s1) === keyOf(s2)) === same;
    R.keyChecks.push({ name, ok });
    if (!ok) R.errors.push(`key check failed: ${name}`);
  }
  try {
    keyCheck('mul c', [S('mul', { c: '2' })], [S('mul', { c: '3-i' })], true);
    keyCheck('mul c=0 vs 2', [S('mul', { c: '0' })], [S('mul', { c: '2' })], true);
    keyCheck('root cut/k/n', [S('root', { n: 2, cut: 0, k: 0 })], [S('root', { n: 5, cut: 90, k: 3 })], true);
    keyCheck('pown n', [S('pown', { n: 2 })], [S('pown', { n: -7 })], true);
    keyCheck('custom cut', [S('custom', { expr: 'z^{\\sqrt{4}}+\\log(z)', cut: 180 })], [S('custom', { expr: 'z^{\\sqrt{4}}+\\log(z)', cut: -45 })], true);
    keyCheck('custom expr', [S('custom', { expr: 'z^2' })], [S('custom', { expr: 'z^3' })], false);
    keyCheck('poly values', [S('poly', { co: '1, 2, 3' })], [S('poly', { co: '4, 5i, 6' })], true);
    keyCheck('poly count', [S('poly', { co: '1, 2, 3' })], [S('poly', { co: '1, 2' })], false);
    keyCheck('poly trim', [S('poly', { co: '1, 2, 3' })], [S('poly', { co: '0, 2, 3' })], false);
    keyCheck('rational count', [S('rational', { p: '1, 2', q: '1, 0' })], [S('rational', { p: '1, 2', q: '1, 0, 0' })], false);
    // a dragged zero or pole is a uniform; adding or removing one is structure
    keyCheck('zp values', [S('zp', { a: '1', zeros: '1, -1', poles: '0' })], [S('zp', { a: '2i', zeros: '1.3+0.4i, -0.7', poles: '0.2-0.1i' })], true);
    keyCheck('zp polynomial values', [S('zp', { a: '1', zeros: '1, -1', poles: '' })], [S('zp', { a: '1', zeros: '0.4, 2i', poles: '' })], true);
    keyCheck('zp count', [S('zp', { a: '1', zeros: '1, -1', poles: '0' })], [S('zp', { a: '1', zeros: '1, -1, i', poles: '0' })], false);
    keyCheck('zp pole added', [S('zp', { a: '1', zeros: '1, -1', poles: '' })], [S('zp', { a: '1', zeros: '1, -1', poles: '0' })], false);
    keyCheck('on/off', [S('exp'), S('sin')], [S('exp'), S('sin', {}, false)], false);
    keyCheck('error', [S('mul', { c: '2' })], [S('mul', { c: 'abc' })], false);
    keyCheck('type', [S('sin')], [S('cos')], false);
    keyCheck('mobius values', [S('mobius', { a: '1', b: '2', c: '2', d: '4' })], [S('mobius')], true);
    keyCheck('blaschke', [S('blaschke', { a: '0.5', phi: 0 })], [S('blaschke', { a: '1', phi: 90 })], true);
    // d/dz: its position and on/off are structure; parameters before it stay uniforms (the derivative code is in the key)
    const Dk = (on = true) => S('deriv', {}, on);
    keyCheck('deriv position', [S('exp'), Dk(), S('sin')], [S('exp'), S('sin'), Dk()], false);
    keyCheck('deriv on/off', [S('exp'), Dk()], [S('exp'), Dk(false)], false);
    keyCheck('deriv mul c', [S('mul', { c: '2' }), Dk()], [S('mul', { c: '3-i' }), Dk()], true);
    keyCheck('deriv root n/cut/k', [S('root', { n: 2, cut: 0, k: 0 }), Dk()], [S('root', { n: 2, cut: 90, k: 1 }), Dk()], true);
    keyCheck('deriv poly values', [S('poly', { co: '1, 2, 3' }), Dk()], [S('poly', { co: '4, 5i, 6' }), Dk()], true);
    keyCheck('deriv exact vs circle', [S('exp'), Dk()], [S('conj'), Dk()], false);
    // sheet radices are uniforms: n, alpha and the cut never recompile
    keyCheck('sheets root n', [S('root', { n: 2 })], [S('root', { n: 7 })], true);
    keyCheck('sheets powa alpha', [S('powa', { alpha: '0.5' })], [S('powa', { alpha: '0.3+2i' })], true);
  } catch (e) { R.errors.push('keyChecks: ' + e.message); }

  try {
    const steps = [S('mobius'), S('custom', { expr: 'z^{\\sqrt{4}}+\\log(z)-\\arcsin z' }), S('pown', { n: -3 }), S('poly')];
    const gc = GLChain.build(steps, steps.map((x) => Funcs.build(x)));
    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, '#version 300 es\nprecision highp float;\n' + GLChain.LIB + gc.source + '\nin vec2 aP; uniform float uT;\nvoid main(){ vec2 w = chainHom(2, chainRange(aP, 0, 1), uT) + chainStep(3, aP); gl_Position = vec4(w, cfin(w) ? 0.0 : 1.0, 1.0); }');
    gl.compileShader(vs);
    R.vertexShaderCompile = gl.getShaderParameter(vs, gl.COMPILE_STATUS) ? 'ok' : gl.getShaderInfoLog(vs);
    if (R.vertexShaderCompile !== 'ok') R.errors.push('vertex shader: ' + R.vertexShaderCompile);
    // stage maps and surfaces from a vertex shader (transform feedback), with nested d/dz and multivalued pieces
    const st2 = [S('custom', { expr: '\\sqrt{z^2-1}+\\log z' }), S('deriv'), S('root', { n: 3 }), S('deriv'), S('mobius')];
    const gc2 = GLChain.build(st2, st2.map((x) => Funcs.build(x)));
    const vs2 = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs2, '#version 300 es\nprecision highp float;\n' + GLChain.LIB + gc2.source + '\nin vec2 aP; in vec2 aC; uniform float uT; uniform int uK;\nvoid main(){ vec2 w = chainIsDeriv(uK) ? mix(chainStage(uK - 1, aP), chainStage(uK, aP), uT) : chainSheet(aC, aP, uK, 3); gl_Position = vec4(w, cfin(w) ? 0.0 : 1.0, 1.0); }');
    gl.compileShader(vs2);
    R.vertexShaderCompile2 = gl.getShaderParameter(vs2, gl.COMPILE_STATUS) ? 'ok' : gl.getShaderInfoLog(vs2);
    if (R.vertexShaderCompile2 !== 'ok') R.errors.push('vertex shader 2: ' + R.vertexShaderCompile2);
  } catch (e) { R.errors.push('vertex shader: ' + e.message); }

  for (const ch of selected) {
    try { testChain(ch); R.chains++; } catch (e) { R.errors.push(`${ch.name}: ${String(e.message || e).slice(0, 3000)}`); }
  }
  R.ms = Math.round(performance.now() - t0);
  R.points = P;
  R.chainsTotal = chains.length;
  R.done = true;
  const el = document.getElementById('out');
  if (el) el.textContent = JSON.stringify({ done: R.done, chains: R.chains, programs: R.programs, total: R.total, compared: R.compared, failCount: R.failCount, errors: R.errors, singular: R.singular, ms: R.ms, derivRows: R.derivRows, sheetRows: R.sheetRows, comparedDeriv: R.comparedDeriv, comparedSheet: R.comparedSheet, skippedTrunc: R.skippedTrunc, failByChain: R.failByChain }, null, 1);
})();
