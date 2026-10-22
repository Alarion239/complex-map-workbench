global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
const Funcs = require('../src/funcs.js');
const C = CX.C;
const pts = [C(0.3, 0.7), C(-0.4, 0.2), C(0.8, -0.5), C(1.3, 0.4)];
let bad = 0;
for (const id of Object.keys(Funcs.DEFS)) {
  const step = { type: id, params: Funcs.defaults(id) };
  const b = Funcs.build(step);
  if (b.error) { console.log('ERR build', id, b.error); bad++; continue; }
  // homotopy endpoints
  for (const z of pts) {
    if (b.hom) {
      const h0 = b.hom(0)(z), h1 = b.hom(1)(z), f = b.f(z);
      if (CX.abs(CX.sub(h0, z)) > 1e-9) { console.log('hom(0) != id', id, CX.fmt(h0), CX.fmt(z)); bad++; break; }
      if (CX.abs(CX.sub(h1, f)) > 1e-7 * (1 + CX.abs(f))) { console.log('hom(1) != f', id, CX.fmt(h1), CX.fmt(f)); bad++; break; }
    }
  }
  // inverse round trip f^{-1}(f(z)) = z on some point
  if (b.inverse) {
    const ib = Funcs.build({ type: b.inverse.type, params: Object.assign(Funcs.defaults(b.inverse.type), b.inverse.params) });
    if (ib.error) { console.log('ERR inverse', id, ib.error); bad++; continue; }
    const z = C(0.3, 0.7);
    const back = ib.f(b.f(z));
    const ok = CX.abs(CX.sub(back, z)) < 1e-6;
    if (!ok) console.log('inverse roundtrip differs (may be branch):', id, '->', b.inverse.type, CX.fmt(back));
  }
  const tex = b.tex({ s: 'w_1', p: 4 }).s;
  const P = b.props;
  const words = Funcs.PROP_KEYS.filter((k) => P[k]).join(',');
  console.log(id.padEnd(10), tex.padEnd(55), words, P.deg != null ? 'deg ' + P.deg + (P.degExact ? '' : '?') : '');
}
// custom classification
for (const e of ['z^2-z^2+z', '(z+1)^2-z^2', 'z^3', '\\frac{z}{2}+1', '\\overline{z}', '\\frac{1}{z}', 'e^z', '5']) {
  const b = Funcs.build({ type: 'custom', params: { expr: e, cut: 180 } });
  console.log('custom', e.padEnd(14), Funcs.PROP_KEYS.filter((k) => b.props[k]).join(','), 'deg', b.props.deg, b.props.constant ? 'CONST' : '');
}
// rational
for (const [p, q] of [['1,0,1', '1,0'], ['1,-1', '1,-1'], ['1,0,0', '1,1'], ['1,2', '3,4'], ['1,0,-1', '1,-1']]) {
  const b = Funcs.build({ type: 'rational', params: { p, q } });
  console.log('rational', p, '/', q, Funcs.PROP_KEYS.filter((k) => b.props[k]).join(','), 'deg', b.props.deg, b.props.degExact);
}
// compose
const chain = ['exp', 'mobius'].map((id) => Funcs.build({ type: id, params: Funcs.defaults(id) }).props);
console.log('exp then mobius:', Funcs.PROP_KEYS.filter((k) => Funcs.composeProps(chain)[k]).join(','));
const chain2 = ['pown', 'joukowski'].map((id) => Funcs.build({ type: id, params: Funcs.defaults(id) }).props);
const cp = Funcs.composeProps(chain2);
console.log('z^2 then J:', Funcs.PROP_KEYS.filter((k) => cp[k]).join(','), cp.deg);

// ---------------- d/dz: the chain operator, stage functions, props fold ----------------
{
  const check = (ok, ...msg) => { if (!ok) { bad++; console.log('FAIL', ...msg); } };
  const St = (type, params = {}, on = true) => ({ type, params: Object.assign(Funcs.defaults(type), params), on });
  const D = (on = true) => St('deriv', {}, on);
  const near = (a, b, tol) => CX.isFin(a) && CX.isFin(b) && CX.abs(CX.sub(a, b)) <= tol * (1 + CX.abs(b));
  // the step itself
  const bd = Funcs.build(D());
  check(!bd.error && bd.op === 'deriv' && bd.props.deriv === true && !bd.inverse && Funcs.GROUPS.includes(Funcs.DEFS.deriv.group), 'deriv build');
  check(bd.tex({ s: 'w_{2}', p: 4 }).s === '\\frac{d w_{2}}{dz}' && bd.tex({ s: 'e^{z}', p: 3 }).s === '\\frac{d}{dz}\\left(e^{z}\\right)', 'deriv tex');
  check(!CX.isFin(bd.f(C(1, 2))), 'deriv f is NaN (not a map of w)');
  check(!!Funcs.derivativeStep(D()).error, 'derivativeStep of d/dz is an error');
  check(Funcs.derivativeStep(St('pown', { n: 3 })).step.params.expr === '3\\,z^{2}', 'derivativeStep unchanged');
  // stage functions against closed forms (exact chain rule, nested circle formulas, branches, bypass/error steps)
  const zs = [C(0.7, -0.4), C(-1.2, 0.9), C(0.3, 1.6), C(2.1, -0.3)];
  const cases = [
    ['d/dz z', [D()], () => C(1, 0), 1e-14],
    ['z^3 d', [St('pown', { n: 3 }), D()], (z) => CX.scale(CX.mul(z, z), 3), 1e-14],
    ['z^3 d d', [St('pown', { n: 3 }), D(), D()], (z) => CX.scale(z, 6), 1e-9],
    ['z^5 d d d', [St('pown', { n: 5 }), D(), D(), D()], (z) => CX.scale(CX.mul(z, z), 60), 1e-7],
    ['sin exp d', [St('sin'), St('exp'), D()], (z) => CX.mul(CX.cos(z), CX.exp(CX.sin(z))), 1e-13],
    ['exp d sin', [St('exp'), D(), St('sin')], (z) => CX.sin(CX.exp(z)), 1e-13],
    ['log cut k d', [St('log', { cut: 30, k: 1 }), D()], (z) => CX.inv(z), 1e-14],
    ['root3 cut k d', [St('root', { n: 3, cut: 90, k: 2 }), D()], (z) => CX.div(CX.powReal(z, 1 / 3, Math.PI / 2, 2), CX.scale(z, 3)), 1e-13],
    ['powa sheet d', [St('powa', { alpha: '1.5+0.5i', cut: -45, k: 1 }), D()], (z) => { const a = C(1.5, 0.5); return CX.mul(a, CX.div(CX.pow(z, a, -Math.PI / 4, 1), z)); }, 1e-12],
    ['ijouk interior d', [St('ijouk', { branch: 'interior' }), D()], (z) => { const s = CX.mul(CX.sqrt(CX.sub(z, C(1, 0))), CX.sqrt(CX.add(z, C(1, 0)))); return CX.sub(C(1, 0), CX.div(z, s)); }, 1e-12],
    ['conj d (Wirtinger, circle)', [St('conj'), D()], () => C(0, 0), 1e-10],
    ['off d', [St('pown', { n: 3 }), D(false)], (z) => CX.ipow(z, 3), 1e-14],
    ['error step d', [St('exp'), St('custom', { expr: 'z+' }), D()], (z) => CX.exp(z), 1e-13],
    ['bypassed step d', [St('exp'), St('sin', {}, false), D(), St('pown', { n: 2 })], (z) => CX.exp(CX.scale(z, 2)), 1e-13],
  ];
  for (const [name, steps, exact, tol] of cases) {
    const G = Funcs.stageFunctions(steps, steps.map(Funcs.build));
    for (const z of zs) check(near(G[steps.length](z), exact(z), tol), 'stage', name, CX.fmt(z), CX.fmt(G[steps.length](z)), CX.fmt(exact(z)));
  }
  // the exact chain rule and the circle formula agree for every catalog map with a derivative (default params)
  for (const id of Object.keys(Funcs.DEFS)) {
    if (id === 'deriv' || id === 'conj') continue;
    const steps = [St(id), D()], built = steps.map(Funcs.build);
    const Gx = Funcs.stageFunctions(steps, built), Gc = Funcs.stageFunctions(steps, built, { exact: false });
    check(Gx.levels[2] === 0 && Gc.levels[2] === 1, 'levels', id);
    for (const z of [C(0.3, 0.7), C(-0.4, 0.2), C(1.3, 0.4)]) check(near(Gx[2](z), Gc[2](z), 1e-6), 'exact vs circle', id, CX.fmt(z), CX.fmt(Gx[2](z)), CX.fmt(Gc[2](z)));
  }
  // a stable derivative form evaluates without cancellation: inverse Joukowski (interior) at large |z|
  {
    const b = Funcs.build(St('ijouk', { branch: 'interior' }));
    const fs = Expr.compile(Funcs.derivAst(b, { stable: true }).ast), fr = Expr.compile(Funcs.derivAst(b).ast);
    for (const z of [C(0.4, 0.3), C(-2, 1)]) check(near(fs(z), fr(z), 1e-12), 'ijouk stable = readable', CX.fmt(z));
    const z = C(3e5, 1e5), s = CX.mul(CX.sqrt(CX.sub(z, C(1, 0))), CX.sqrt(CX.add(z, C(1, 0))));
    check(near(fs(z), CX.neg(CX.inv(CX.mul(CX.add(z, s), s))), 1e-12) && near(fs(z), CX.neg(CX.scale(CX.inv(CX.mul(z, z)), 0.5)), 1e-6), 'ijouk stable at large z');
  }
  // props fold: what is claimed for each chain (and nothing more)
  const claims = (steps) => { const p = Funcs.composeProps(steps.map((s) => Funcs.build(s).props)); return Funcs.PROP_KEYS.filter((k) => p[k]).join(',') + (p.deg != null ? (p.degExact ? ' deg ' : ' deg<=') + p.deg : '') + (p.constant ? ' const' : ''); };
  const expectP = [
    [[D()], 'analytic,entire,rational,polynomial deg 0 const'],
    [[St('pown', { n: 3 }), D()], 'analytic,entire,rational,polynomial,proper deg 2'],
    [[St('pown', { n: 2 }), D()], 'analytic,entire,rational,polynomial,mobius,proper,injective deg 1'],
    [[St('pown', { n: 2 }), D(), D()], 'analytic,entire,rational,polynomial deg 0 const'],
    [[St('pown', { n: 2 }), D(), St('pown', { n: 2 })], 'analytic,entire,rational,polynomial,proper deg 2'],
    [[St('recip'), D()], 'analytic,rational deg<=2'],
    [[St('mobius'), D()], 'analytic,rational deg<=2'],
    [[St('rational'), D()], 'analytic,rational deg<=4'],
    [[St('exp'), D()], 'analytic,entire'],
    [[St('root'), D()], 'analytic'],
    [[St('conj'), D()], ''],
    [[St('custom', { expr: 'z^2+1' }), D(), St('exp')], 'analytic,entire'],
    [[St('affine'), D(), St('recip')], 'analytic,rational deg 0 const'],
  ];
  for (const [steps, want] of expectP) check(claims(steps) === want, 'props', steps.map((s) => s.type).join('>'), '|', claims(steps), '| want', want);
  // without d/dz the fold equals the old list formula
  const oldCompose = (list) => {
    if (!list.length) return Funcs.props({ analytic: true, entire: true, rational: true, polynomial: true, mobius: true, proper: true, injective: true, deg: 1, degExact: true });
    const r = Funcs.props();
    for (const k of Funcs.PROP_KEYS) r[k] = list.every((p) => p[k]);
    r.constant = list.some((p) => p.constant);
    if (r.rational && list.every((p) => p.deg != null)) { r.deg = list.reduce((a, p) => a * p.deg, 1); r.degExact = list.every((p) => p.degExact) || r.deg === 0 && list.some((p) => p.deg === 0 && p.degExact); }
    return r;
  };
  const pool = Object.keys(Funcs.DEFS).filter((t) => t !== 'deriv').map((t) => Funcs.build(St(t)).props)
    .concat([Funcs.build(St('pown', { n: 0 })).props, Funcs.build(St('mobius', { a: '1', b: '2', c: '2', d: '4' })).props, Funcs.build(St('custom', { expr: 'z^2-z^2+z' })).props]);
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 400; i++) {
    const list = Array.from({ length: 1 + Math.floor(rnd() * 4) }, () => pool[Math.floor(rnd() * pool.length)]);
    const a = Funcs.composeProps(list), b = oldCompose(list);
    check(['constant', 'deg', 'degExact', ...Funcs.PROP_KEYS].every((k) => a[k] === b[k]), 'fold != old', i);
  }
  // soundness of the fold on chains with d/dz: claimed exact polynomial degree and constancy hold numerically
  const sound = [[St('poly'), D()], [St('poly', { co: '1, 2i, 0, -1, 3' }), D(), D()], [St('pown', { n: 4 }), D(), St('affine')], [St('custom', { expr: '(z+1)^3' }), D()], [D(), St('pown', { n: 3 })], [St('affine'), D(), St('sin')]];
  for (const steps of sound) {
    const built = steps.map(Funcs.build), G = Funcs.stageFunctions(steps, built)[steps.length];
    const p = Funcs.composeProps(built.map((b) => b.props));
    if (p.polynomial && p.degExact) check(Funcs.numericPolyDegree(G, p.deg + 3) === p.deg, 'claimed degree', steps.map((s) => s.type).join('>'), p.deg);
    if (p.constant) check(near(G(C(0.3, 0.2)), G(C(-1.1, 0.8)), 1e-9), 'claimed constant', steps.map((s) => s.type).join('>'));
  }
}

// ---------------- whole Riemann surfaces: sheet counts, local cuts, every sheet ----------------
{
  const check = (ok, ...msg) => { if (!ok) { bad++; console.log('FAIL', ...msg); } };
  const St = (type, params = {}, on = true) => ({ type, params: Object.assign(Funcs.defaults(type), params), on });
  check(Funcs.sheetCount(0.5) === 2 && Funcs.sheetCount(1 / 3) === 3 && Funcs.sheetCount(2) === 1 && Funcs.sheetCount(-2.5) === 2 && Funcs.sheetCount(0.37) === 0 && Funcs.sheetCount(C(0.5, 0.1)) === 0, 'sheetCount');
  const surf = (steps, zc, z, W = 2, b = steps.length) => {
    const built = steps.map(Funcs.build), n = Funcs.sheetCombos(steps, built, W, b);
    return Array.from({ length: n }, (_, c) => Funcs.sheetEval(steps, built, b, zc, z, c, W));
  };
  const sameSet = (A, B, tol) => A.length === B.length && A.every((a) => B.some((b) => CX.abs(CX.sub(a, b)) <= tol * (1 + CX.abs(b))));
  // finitely many sheets: the values over all surfaces are every branch, and the same whichever side of the principal
  // cut the cell centre is on (no cliff)
  const z = C(-1.5, 1e-3), up = C(-1.5, 0.02), dn = C(-1.5, -0.02);
  for (const [name, steps, k] of [['sqrt', [St('root')], 2], ['cube root', [St('root', { n: 3, cut: 45, k: 2 })], 3], ['powa 2/3', [St('powa', { alpha: '0.6666666666666666' })], 3],
    ['custom sqrt(z^2-1)', [St('custom', { expr: '\\sqrt{z^2-1}' })], 2], ['exp then sqrt', [St('exp'), St('custom', { expr: '\\sqrt{z}' })], 2]]) {
    const A = surf(steps, up, z), B = surf(steps, dn, z);
    check(A.length === k && sameSet(A, B, 1e-12), 'sheets seamless', name, A.map(CX.fmt).join(' '), '|', B.map(CX.fmt).join(' '));
  }
  // the cube roots really are the three roots
  for (const w of surf([St('root', { n: 3 })], up, z)) check(CX.abs(CX.sub(CX.ipow(w, 3), z)) < 1e-12, 'cube root sheet');
  // log: the window W around the cell, 2W + 1 sheets, all logs of z
  const L = surf([St('log')], up, z, 2);
  check(L.length === 5 && L.every((w) => CX.abs(CX.sub(CX.exp(w), z)) < 1e-12) && new Set(L.map((w) => Math.round((w.im - L[0].im) / (2 * Math.PI)))).size === 5, 'log sheets');
  // two pieces in one custom formula, the window for log and both signs of the root
  const LS = surf([St('custom', { expr: '\\log z+\\sqrt{z}' })], C(1, 1), C(1, 1.01), 1);
  check(LS.length === 6 && new Set(LS.map((w) => w.re.toFixed(9))).size === 2, 'log + sqrt sheets');
  // d/dz on a surface: both branches of (sqrt z)' = 1 / (2 sqrt z)
  const DS = surf([St('root'), St('deriv')], C(-1, 0.05), C(-1, 0.04));
  check(DS.length === 2 && DS.every((w) => { const s = CX.inv(CX.scale(w, 2)); return CX.abs(CX.sub(CX.mul(s, s), C(-1, 0.04))) < 1e-8; }), 'derivative on sheets', DS.map(CX.fmt).join(' '));
  // a prefix reads only its own digits; single-valued steps add no sheets; the cap
  const steps5 = Array.from({ length: 5 }, () => St('root'));
  const built5 = steps5.map(Funcs.build);
  check(Funcs.sheetCombos(steps5, built5) === 24 && Funcs.sheetCombos(steps5, built5, 2, 5, Infinity) === 32 && Funcs.sheetCombos(steps5, built5, 2, 2) === 4, 'sheet cap / prefix');
  check(Funcs.sheetSteps([St('pown'), St('powa', { alpha: '3' }), St('custom', { expr: 'z^2+\\sin z' }), St('exp')], [St('pown'), St('powa', { alpha: '3' }), St('custom', { expr: 'z^2+\\sin z' }), St('exp')].map(Funcs.build)).length === 0, 'single-valued steps');
  const pre = [St('root'), St('log')], bp = pre.map(Funcs.build);
  check(CX.abs(CX.sub(Funcs.sheetEval(pre, bp, 1, C(1, 1), C(1, 1), 1), Funcs.sheetEval([pre[0]], [bp[0]], 1, C(1, 1), C(1, 1), 1))) < 1e-15, 'prefix digits');
  // a focused step (a > 0): its own surfaces over the w_a-plane, digits for its pieces only; NaN across a d/dz
  const fr = [St('log'), St('mobius'), St('root', { n: 3 })], bfr = fr.map(Funcs.build), w = C(-1.5, 1e-3);
  const R3 = Array.from({ length: Funcs.sheetCombos(fr, bfr, 2, 3, 24, 2) }, (_, c) => Funcs.sheetEval(fr, bfr, 3, C(-1.5, 0.02), w, c, 2, { a: 2 }));
  check(Funcs.sheetCombos(fr, bfr, 2, 3, 24, 2) === 3 && Funcs.sheetCombos(fr, bfr, 2) === 15 && R3.every((v) => CX.abs(CX.sub(CX.ipow(v, 3), w)) < 1e-12) && sameSet(R3, surf([St('root', { n: 3 })], C(-1.5, 0.02), w), 1e-12), 'sheet range');
  const frd = [St('exp'), St('deriv'), St('root')];
  check(!CX.isFin(Funcs.sheetEval(frd, frd.map(Funcs.build), 3, C(1, 1), C(1, 1), 0, 2, { a: 1 })), 'sheet range across d/dz is NaN');
  // a single-valued chain on any surface is the chain itself
  const sv = [St('mobius'), St('sin')], bsv = sv.map(Funcs.build);
  check(CX.abs(CX.sub(Funcs.sheetEval(sv, bsv, 2, C(0.2, 0.1), C(0.3, 0.2), 0), Funcs.stageFunctions(sv, bsv)[2](C(0.3, 0.2)))) < 1e-15, 'single-valued sheet');
}
console.log('bad', bad);
