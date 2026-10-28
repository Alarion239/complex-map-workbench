// Calc (line integrals, argument principle, Cauchy, residues, zeros and poles), Expr.diff / Expr.invert,
// Funcs inverses and derivativeStep, GLChain.levelGLSL. Run: node test/t_calc.js
global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
global.Funcs = require('../src/funcs.js');
const Calc = require('../src/calc.js');
const GLChain = require('../src/glsl.js');
const C = CX.C;
const TAU = 2 * Math.PI;
let bad = 0, n = 0;
const near = (a, b, tol) => CX.isFin(a) && CX.isFin(b) && CX.abs(CX.sub(a, b)) <= tol * (1 + CX.abs(b));
function check(name, ok, info = '') { n++; if (!ok) { bad++; console.log('FAIL', name, info); } }
const circle = (c, r, N = 128) => Array.from({ length: N }, (_, k) => C(c.re + r * Math.cos(TAU * k / N), c.im + r * Math.sin(TAU * k / N)));
const fmt = (z) => CX.fmt(z, 8);

// ---------- line integrals ----------
{
  const r = Calc.lineIntegral((z) => CX.inv(z), circle(C(0, 0), 1), true);
  check('∮ dz/z = 2πi (128-gon)', near(r.value, C(0, TAU), 1e-10), fmt(r.value));
  check('closed path has n+1 points ending at the value', r.path.length === 2 * 129 && r.path[0] === 0 && r.path[1] === 0
    && r.path[256] === r.value.re && r.path[257] === r.value.im);
  check('fine path ends at the value', r.fine[r.fine.length - 2] === r.value.re && r.fine[r.fine.length - 1] === r.value.im);
  const sq = Calc.lineIntegral((z) => CX.inv(z), [[1, -1], [1, 1], [-1, 1], [-1, -1]], true);
  check('∮ dz/z = 2πi (square, 4 vertices)', near(sq.value, C(0, TAU), 1e-10), fmt(sq.value));
  const sq2 = Calc.lineIntegral((z) => CX.inv(CX.sub(z, C(0.5, 0.3))), [1, -1, 1, 1, -1, 1, -1, -1], true);
  check('∮ dz/(z − a) = 2πi (flat array, off-centre pole)', near(sq2.value, C(0, TAU), 1e-10), fmt(sq2.value));
  const out = Calc.lineIntegral((z) => CX.inv(CX.sub(z, C(3, 0))), circle(C(0, 0), 1), true);
  check('∮ dz/(z − 3) = 0 (pole outside)', CX.abs(out.value) < 1e-10, fmt(out.value));
  const nearp = Calc.lineIntegral((z) => CX.inv(CX.sub(z, C(0.999, 0))), circle(C(0, 0), 1, 64), true);
  // the 64-gon passes within 1e-3 of the pole, which is still inside it
  check('pole 0.001 inside the curve', near(nearp.value, C(0, TAU), 1e-8), fmt(nearp.value));
  const a = C(-1, 0.5), b = C(2, 1.5);
  const seg = Calc.lineIntegral((z) => z, [a, b], false);
  check('∫ z dz over a segment = (b² − a²)/2', near(seg.value, CX.scale(CX.sub(CX.mul(b, b), CX.mul(a, a)), 0.5), 1e-12), fmt(seg.value));
  check('open path has n points', seg.path.length === 4 && seg.length === CX.abs(CX.sub(b, a)));
  const ex = Calc.lineIntegral(CX.exp, [C(0, 0), C(1, 0), C(1, 1), C(0, 2)], false);
  check('∫ e^z dz = e^b − e^a', near(ex.value, CX.sub(CX.exp(C(0, 2)), C(1, 0)), 1e-12), fmt(ex.value));
  check('vertex 2 of the path is e^{1+i} − 1', near(C(ex.path[4], ex.path[5]), CX.sub(CX.exp(C(1, 1)), C(1, 0)), 1e-12));
  const zz = Calc.lineIntegral((z) => CX.mul(z, z), circle(C(0.2, 0.1), 2, 40), true);
  check('∮ z² dz = 0', CX.abs(zz.value) < 1e-12, fmt(zz.value));
  const s1 = Calc.lineIntegral((z) => CX.inv(z), [C(-1, 0), C(1, 0)], false);
  check('1/z through 0 is a singularity', s1.error === 'The curve passes through a singularity', s1.error);
  const s2 = Calc.lineIntegral((z) => CX.inv(CX.mul(z, z)), [C(-1, 0.5), C(1, -0.5)], false);
  check('1/z² through 0 is a singularity', s2.error === 'The curve passes through a singularity', s2.error);
  const s3 = Calc.lineIntegral((z) => CX.inv(z), [C(0, 0), C(1, 0)], false);
  check('1/z from the pole is a singularity', !!s3.error, fmt(s3.value));
  const isq = Calc.lineIntegral((z) => CX.inv(CX.sqrt(z)), [C(0, 0), C(1, 0)], false);
  check('∫₀¹ z^{-1/2} dz = 2 (integrable endpoint singularity)', !isq.error && near(isq.value, C(2, 0), 1e-6), isq.error || fmt(isq.value));
  const lg = Calc.lineIntegral((z) => CX.log(z), [C(0, 0), C(0, 1)], false);
  // ∫₀^i log z dz = [z log z − z] = i(iπ/2) − i = −π/2 − i
  check('∫₀^i log z dz = −π/2 − i', !lg.error && near(lg.value, C(-Math.PI / 2, -1), 1e-8), lg.error || fmt(lg.value));
  // √z across its cut: the sum of the two halves
  const sqf = (z) => CX.sqrt(z);
  const whole = Calc.lineIntegral(sqf, [C(-1, -1), C(-1, 1)], false);
  const p1 = Calc.lineIntegral(sqf, [C(-1, -1), C(-1, 0)], false), p2 = Calc.lineIntegral(sqf, [C(-1, 0), C(-1, 1)], false);
  check('√z across the cut: jump is integrated', !whole.error && near(whole.value, CX.add(p1.value, p2.value), 1e-8), whole.error || fmt(whole.value));
}
// ---------- argument principle ----------
{
  const p3 = (z) => CX.sub(CX.ipow(z, 3), C(1, 0));
  const ap = (F, poly, p) => Calc.argPrinciple(F, poly, p);
  let r = ap(p3, circle(C(0, 0), 2, 16));
  check('z³ − 1 on |z| = 2: 3', r.ok && r.winding === 3, JSON.stringify(r));
  r = ap(p3, circle(C(0, 0), 0.5, 16));
  check('z³ − 1 on |z| = 1/2: 0', r.ok && r.winding === 0, JSON.stringify(r));
  r = ap((z) => CX.inv(CX.add(CX.mul(z, z), C(1, 0))), [[-2, -2], [2, -2], [2, 2], [-2, 2]]);
  check('1/(z² + 1) on a square: −2', r.ok && r.winding === -2, JSON.stringify(r));
  r = ap((z) => CX.div(CX.ipow(CX.sub(z, C(1, 0)), 2), CX.add(z, C(3, 0))), circle(C(0, 0), 2, 8));
  check('(z − 1)²/(z + 3) on |z| = 2: 2', r.ok && r.winding === 2, JSON.stringify(r));
  r = ap((z) => CX.mul(z, z), circle(C(0, 0), 3, 12), C(4, 0));
  check('z² = 4 inside |z| = 3: 2', r.ok && r.winding === 2, JSON.stringify(r));
  r = ap((z) => CX.mul(z, z), circle(C(0, 0), 1, 12), 4);
  check('z² = 4 inside |z| = 1: 0', r.ok && r.winding === 0, JSON.stringify(r));
  r = ap((z) => CX.ipow(z, 20), circle(C(0, 0), 1, 3));
  check('z²⁰ on a triangle: 20 (fast turning between vertices)', r.ok && r.winding === 20, JSON.stringify(r));
  r = ap((z) => CX.sub(z, C(1, 0)), circle(C(0, 0), 1, 8));
  check('zero on the curve: not ok', !r.ok, JSON.stringify(r));
  r = ap((z) => CX.sqrt(z), circle(C(0, 0), 1, 9));
  check('√z around its branch point: not ok', !r.ok, JSON.stringify(r));
  r = ap(CX.exp, circle(C(0, 0), 5, 16));
  check('e^z: 0', r.ok && r.winding === 0, JSON.stringify(r));
}
// ---------- Cauchy, residues, nodes ----------
{
  const z0 = C(0.3, 0.2);
  let v = Calc.cauchy(CX.exp, circle(C(0, 0), 1), z0);
  check('Cauchy formula reproduces e^{z0}', near(v, CX.exp(z0), 1e-10), fmt(v));
  v = Calc.cauchy(CX.exp, circle(C(0, 0), 1), C(2, 0));
  check('Cauchy integral outside is 0', CX.abs(v) < 1e-10, fmt(v));
  v = Calc.cauchy(CX.exp, circle(C(0, 0), 1), C(0.999, 0.001));
  check('Cauchy integral close to the curve', near(v, CX.exp(C(0.999, 0.001)), 1e-7), fmt(v));
  v = Calc.residue((z) => CX.inv(CX.add(CX.mul(z, z), C(1, 0))), C(0, 1), 0.5);
  check('Res 1/(z² + 1) at i = −i/2', near(v, C(0, -0.5), 1e-12), fmt(v));
  v = Calc.residue((z) => CX.div(CX.exp(z), CX.ipow(z, 3)), C(0, 0), 1);
  check('Res e^z/z³ at 0 = 1/2', near(v, C(0.5, 0), 1e-12), fmt(v));
  v = Calc.residue((z) => CX.inv(CX.sin(z)), C(Math.PI, 0), 0.5);
  check('Res 1/sin z at π = −1', near(v, C(-1, 0), 1e-12), fmt(v));
  v = Calc.residue((z) => CX.mul(z, z), C(1, 1), 0.3);
  check('Res of an entire function = 0', CX.abs(v) < 1e-12, fmt(v));
  const nodes = Calc.cauchyNodes((z) => CX.mul(z, z), circle(C(0, 0), 1, 64), 512);
  const sum = (z) => {
    let s = C(0, 0);
    for (let j = 0; j < nodes.length; j += 4) s = CX.add(s, CX.div(C(nodes[j + 2], nodes[j + 3]), CX.sub(C(nodes[j], nodes[j + 1]), z)));
    return s;
  };
  check('cauchyNodes: Σ w/(ζ − z) ≈ z² inside', nodes.length === 2048 && near(sum(C(0.3, -0.2)), CX.mul(C(0.3, -0.2), C(0.3, -0.2)), 2e-3), fmt(sum(C(0.3, -0.2))));
  check('cauchyNodes: ≈ 0 outside', CX.abs(sum(C(2, 1))) < 2e-3, fmt(sum(C(2, 1))));
}
// ---------- zeros and poles ----------
{
  const box = { x0: -2, x1: 2, y0: -2, y1: 2 };
  const zp = (F, b = box, o) => Calc.zerosPoles(F, b, o);
  const has = (res, z, kind, mult = 1, tol = 1e-9) => res.some((r) => r.kind === kind && r.mult === mult && CX.abs(CX.sub(r.z, z)) <= tol * (1 + CX.abs(z)));
  const show = (res) => res.map((r) => `${r.kind}${r.mult > 1 ? '^' + r.mult : ''}@${CX.fmt(r.z, 6)}`).join(' ');
  let t0 = Date.now();
  let r = zp((z) => CX.sub(CX.ipow(z, 3), C(1, 0)));
  const w3 = C(-0.5, Math.sqrt(3) / 2);
  check('zeros of z³ − 1', r.length === 3 && has(r, C(1, 0), 'zero') && has(r, w3, 'zero') && has(r, CX.conj(w3), 'zero'), show(r));
  console.log('  z³ − 1:', r.evals, 'evaluations,', Date.now() - t0, 'ms');
  r = zp((z) => CX.inv(CX.add(CX.mul(z, z), C(1, 0))));
  check('poles of 1/(z² + 1)', r.length === 2 && has(r, C(0, 1), 'pole') && has(r, C(0, -1), 'pole'), show(r));
  r = zp((z) => CX.div(CX.mul(CX.ipow(CX.sub(z, C(1, 0)), 2), CX.add(z, C(0, 1))), CX.sub(z, C(1.5, 0.5))));
  check('(z − 1)²(z + i)/(z − 1.5 − 0.5i): double zero, zero, pole', r.length === 3 && has(r, C(1, 0), 'zero', 2, 1e-6) && has(r, C(0, -1), 'zero') && has(r, C(1.5, 0.5), 'pole'), show(r));
  r = zp((z) => CX.mul(z, z), box, { target: C(1, 0) });
  check('z² = 1: ±1', r.length === 2 && has(r, C(1, 0), 'zero') && has(r, C(-1, 0), 'zero'), show(r));
  t0 = Date.now();
  r = zp(CX.sin, { x0: -7, x1: 7, y0: -1, y1: 1 });
  check('zeros of sin z in [−7, 7]: kπ, k = −2..2', r.length === 5 && [-2, -1, 0, 1, 2].every((k) => has(r, C(k * Math.PI, 0), 'zero')), show(r));
  console.log('  sin z:', r.evals, 'evaluations,', Date.now() - t0, 'ms');
  r = zp((z) => CX.ipow(z, 5));
  check('z⁵: zero of multiplicity 5 at 0', r.length === 1 && r[0].kind === 'zero' && r[0].mult === 5 && CX.abs(r[0].z) < 1e-3, show(r));
  r = zp(CX.tan, { x0: -2, x1: 2, y0: -1, y1: 1 });
  check('tan z: zero at 0, poles at ±π/2', r.length === 3 && has(r, C(0, 0), 'zero') && has(r, C(Math.PI / 2, 0), 'pole') && has(r, C(-Math.PI / 2, 0), 'pole'), show(r));
  r = zp((z) => CX.sub(z, C(3, 0)));
  check('root outside the box is not listed', r.length === 0, show(r));
  r = zp((z) => CX.sub(CX.sqrt(z), C(1, 0)));
  check('√z − 1 (branch cut through the box): zero at 1', r.length === 1 && has(r, C(1, 0), 'zero'), show(r));
  r = zp((z) => CX.log(z));
  check('log z: zero at 1 only', r.length === 1 && has(r, C(1, 0), 'zero'), show(r));
  r = zp(CX.exp);
  check('e^z: none', r.length === 0, show(r));
  r = zp((z) => CX.sub(CX.mul(z, z), C(1, 0)), { x0: -1, x1: 1, y0: -1, y1: 1 });
  check('roots on the box edge are kept', r.length === 2 && has(r, C(1, 0), 'zero') && has(r, C(-1, 0), 'zero'), show(r));
  r = zp(CX.sin, { x0: -40, x1: 40, y0: -1, y1: 1 }, { max: 10 });
  check('max caps the list, nearest the centre first', r.length === 10 && r.truncated && r.every((x) => Math.abs(x.z.re) < 5 * Math.PI + 0.1), show(r));
  // a polynomial chain through Funcs
  const b = Funcs.build({ type: 'poly', params: { co: '1, 0, 0, 0, -16' } });
  r = zp(b.f, { x0: -3, x1: 3, y0: -3, y1: 3 });
  check('z⁴ − 16: ±2, ±2i', r.length === 4 && [C(2, 0), C(-2, 0), C(0, 2), C(0, -2)].every((z) => has(r, z, 'zero')), show(r));
  // essential singularities: |F| underflows or overflows next to them, which must not pass for a zero or a pole
  const cu = (e) => Funcs.build({ type: 'custom', params: { expr: e, cut: 180 } }).f;
  const e1z = cu('e^{1/z}');
  r = zp(e1z, { x0: -1.02, x1: 1.02, y0: -1.02, y1: 1.02 }, { target: null, max: 40 });
  check('e^{1/z}: no zeros (none from the underflow near 0)', r.length === 0, show(r));
  const ring = circle(C(0, 0), 1, 256), ap = Calc.argPrinciple(e1z, ring, 0);
  check('e^{1/z} on |z| = 1: winding 0 = zeros − poles found', ap.ok && ap.winding === 0 && r.length === 0, `${ap.winding} vs ${r.length}`);
  for (const [e, bx] of [['e^{-1/z^2}', { x0: -1, x1: 1, y0: -1, y1: 1 }], ['e^{1/z^3}', { x0: -2.3, x1: 1.7, y0: -1.1, y1: 1.9 }], ['e^{1/z}', { x0: -0.37, x1: 1.13, y0: -0.71, y1: 0.79 }]]) {
    r = zp(cu(e), bx, { max: 40 });
    check(`${e}: no zeros or poles listed`, r.length === 0, show(r));
  }
  // its preimages pile up at 0; a capped list keeps the well-separated ones (refined coarsest first), not a cluster
  const wt = C(6.29, -2.56), lw = CX.log(wt), shift = (k) => CX.inv(CX.add(lw, C(0, TAU * k)));
  for (const mx of [24, 40]) {
    r = zp(e1z, box, { target: wt, max: mx });
    check(`e^{1/z} = w, max ${mx}: truncated, holds 1/log w and 1/(log w ± 2πi)`, r.truncated && r.length === mx
      && has(r, shift(0), 'zero', 1, 1e-8) && has(r, shift(1), 'zero', 1, 1e-8) && has(r, shift(-1), 'zero', 1, 1e-8), show(r.slice(-6)));
    check(`e^{1/z} = w, max ${mx}: every listed preimage is genuine`, r.every((x) => x.kind === 'zero' && CX.abs(CX.sub(e1z(x.z), wt)) < 1e-6 * CX.abs(wt)));
  }
  // listed roots of sin(e^{1/z}) are genuine (e^{1/z} = kπ), however many the cap leaves out
  r = zp(cu('\\sin(e^{1/z})'), { x0: -1, x1: 1, y0: -1, y1: 1 }, { max: 40 });
  check('sin(e^{1/z}): every listed zero has e^{1/z} = kπ', r.length > 5 && r.every((x) => {
    const v = e1z(x.z), k = Math.round(v.re / Math.PI);
    return x.kind === 'zero' && Math.abs(v.re - k * Math.PI) < 1e-6 * (1 + Math.abs(v.re)) && Math.abs(v.im) < 1e-6 * (1 + Math.abs(v.re));
  }), show(r.slice(0, 6)));
  // a zero and a double pole of a rational map with the multiplicity right (5 preimages of a degree-5 map)
  r = zp(cu('(z-0.3)^3(z+0.4i)^2/(z-0.9)^2'), { x0: -6, x1: 6, y0: -4, y1: 4 }, { target: C(0.5, -0.25) });
  check('(z − 0.3)³(z + 0.4i)²/(z − 0.9)² = 0.5 − 0.25i: 5 preimages, double pole at 0.9',
    r.filter((x) => x.kind === 'zero').length === 5 && has(r, C(0.9, 0), 'pole', 2, 1e-6), show(r));
}
// ---------- Expr.diff ----------
{
  const pts = [C(0.31, 0.72), C(-0.45, 0.23), C(0.83, -0.51), C(1.37, 0.41), C(-1.2, -0.7)];
  const forms = ['z^2+\\frac{1}{z}', '\\sin(z^2)', 'e^{z^2}', 'z^z', '\\sqrt{z}', '\\sqrt[3]{z}', 'z^{1.5}', 'z^{\\frac{1}{3}}', '\\tan z',
    '\\arcsin(2z)', '\\arccos z', '\\arctan z', '\\operatorname{arsinh}(z)', '\\operatorname{arcosh} z', '\\operatorname{artanh} z',
    '\\frac{z-i}{z+i}', '2^z', '\\log(z^2+1)', '3z^4-2z+1', '(1+2i)z^3', '\\cot z', '\\sec z', '\\csc z', '\\coth z', '\\cosh(2z)', '\\tanh z',
    'z^{1+i}', 'z^{-2}', '\\frac{1}{3}z^3', 'e^{iz}\\cos z', '5', 'z', '\\sqrt{1-z^2}'];
  for (const theta of [Math.PI, Math.PI / 2]) {
    for (const s of forms) {
      const ast = Expr.parse(s);
      const F = Expr.compile(ast, { theta });
      let d, tex;
      try { d = Expr.diff(ast, { theta }); tex = Expr.toTex(d).s; } catch (e) { check(`diff ${s}`, false, e.message); continue; }
      const Dd = Expr.compile(d, { theta }), Dt = Expr.compile(Expr.parse(tex), { theta });
      for (const z of pts) {
        const h = 1e-5;
        const num = CX.scale(CX.sub(F(CX.add(z, C(h, 0))), F(CX.sub(z, C(h, 0)))), 0.5 / h);
        if (!CX.isFin(num)) continue;
        // skip points next to a cut, where the difference quotient jumps
        const num2 = CX.scale(CX.sub(F(CX.add(z, C(0, h))), F(CX.sub(z, C(0, h)))), 0.5 / h);
        if (!near(num, C(num2.im, -num2.re), 1e-4)) continue;
        const v = Dd(z);
        if (!near(v, num, 1e-6)) { check(`d/dz ${s} at ${fmt(z)} (θ=${theta.toFixed(3)})`, false, `${fmt(v)} vs ${fmt(num)}  [${tex}]`); break; }
        if (!near(Dt(z), v, 1e-13)) { check(`toTex round trip of d/dz ${s}`, false, tex); break; }
      }
      n++;
    }
  }
  for (const s of ['|z|', '\\overline{z}', '\\operatorname{Re} z', 'z\\,\\overline{z}', '\\arg z']) {
    let msg = '';
    try { Expr.diff(Expr.parse(s)); } catch (e) { msg = e.message; }
    check(`diff ${s} throws`, /not holomorphic/.test(msg), msg);
  }
  const t = (s) => Expr.toTex(Expr.diff(Expr.parse(s))).s;
  check('simplified: d/dz z^3', t('z^3') === '3\\,z^{2}', t('z^3'));
  check('simplified: d/dz 5z+2', t('5z+2') === '5', t('5z+2'));
  check('simplified: d/dz e^{2z}', t('e^{2z}') === '2\\,e^{2\\,z}', t('e^{2z}'));
  check('simplified: d/dz z^z', t('z^z') === 'z^{z}\\,\\left(\\log z+1\\right)', t('z^z'));
}
// ---------- Expr.invert ----------
{
  const pts = [C(0.31, 0.72), C(-0.45, 0.23), C(0.83, -0.51), C(1.37, 0.41), C(0.2, -1.1)];
  const forms = ['z^2+1', '\\sin(2z+1)', 'e^{3z}', '\\frac{1}{z-1}', '2^z', '\\log z', '\\sqrt{z}+2', 'z^{1.5}', 'z^{0.5}', '\\cot z', '\\overline{z}+1',
    '\\frac{2}{3z+i}', '(z-1)^{3}', '\\arctan(z/2)', '\\cosh z', '-\\tanh(z)+i', 'z^{-3}', '\\sqrt[3]{z}', '\\operatorname{artanh}(z)'];
  for (const s of forms) {
    const ast = Expr.parse(s);
    let r;
    try { r = Expr.invert(ast); } catch (e) { check(`invert ${s}`, false, e.message); continue; }
    const tex = Expr.toTex(r.ast).s;
    const Fw = Expr.compile(ast), G = Expr.compile(Expr.parse(tex));
    const okR = pts.every((w) => near(Fw(G(w)), w, 1e-9)), okL = pts.every((z) => near(G(Fw(z)), z, 1e-9));
    const ok = r.kind === 'both' ? okR && okL : r.kind === 'right' ? okR : okL;
    check(`invert ${s} (${r.kind}) = ${tex}`, ok, `right ${okR} left ${okL}`);
  }
  for (const s of ['z^2+z', '|z|', '\\sqrt{e^z}', 'z^{1+i}', '5', '0\\,z']) {
    let msg = '';
    try { Expr.invert(Expr.parse(s)); } catch (e) { msg = e.message; }
    check(`no inverse for ${s} (says why)`, msg.length > 10, msg);
  }
}
// ---------- Funcs inverses ----------
{
  const pts = [C(0.31, 0.72), C(-0.45, 0.23), C(0.83, -0.51), C(1.37, 0.41)];
  const cases = Object.keys(Funcs.DEFS).map((id) => ({ type: id, params: Funcs.defaults(id) }));
  cases.push(
    { type: 'mul', params: { c: '3' } }, { type: 'mul', params: { c: '0' } }, { type: 'affine', params: { a: '0', b: '1' } },
    { type: 'mobius', params: { a: '1', b: '2', c: '2', d: '4' } }, { type: 'blaschke', params: { a: '0.3+0.4i', phi: 40 } },
    { type: 'blaschke', params: { a: '2i', phi: -75 } }, { type: 'blaschke', params: { a: '1', phi: 0 } },
    { type: 'pown', params: { n: 0 } }, { type: 'pown', params: { n: -3 } }, { type: 'pown', params: { n: 5 } },
    { type: 'root', params: { n: 3, cut: 90, k: 2 } }, { type: 'powa', params: { alpha: '2.5', cut: 60, k: 1 } },
    { type: 'powa', params: { alpha: '-0.4', cut: -100, k: 0 } }, { type: 'powa', params: { alpha: '1+i', cut: 180, k: 0 } },
    { type: 'log', params: { cut: 45, k: -1 } },
    { type: 'poly', params: { co: '2, 0, 0, 1-i' } }, { type: 'poly', params: { co: '1, 0, -1' } }, { type: 'poly', params: { co: '3' } },
    { type: 'poly', params: { co: '2, 5' } }, { type: 'rational', params: { p: '1, 2', q: '3, 4' } }, { type: 'rational', params: { p: '1', q: '1, -2' } },
    { type: 'rational', params: { p: '1, 0, 1', q: '1, 0' } }, { type: 'custom', params: { expr: 'e^{2z}-1', cut: 180 } },
    { type: 'custom', params: { expr: 'z^2+z', cut: 180 } }, { type: 'custom', params: { expr: '\\sqrt{z}', cut: 90 } },
    { type: 'custom', params: { expr: 'z^{1.5}', cut: 90 } }, { type: 'ijouk', params: { branch: 'interior' } },
  );
  for (const st of cases) {
    const b = Funcs.build(st);
    const nm = `${st.type} ${JSON.stringify(st.params)}`;
    if (b.error) { check(`build ${nm}`, false, b.error); continue; }
    if (!b.inverse) { check(`${nm}: no inverse, with a note`, typeof b.inverseNote === 'string' && b.inverseNote.length > 10, String(b.inverseNote)); continue; }
    const ip = Object.assign(Funcs.defaults(b.inverse.type), b.inverse.params);
    const ib = Funcs.build({ type: b.inverse.type, params: ip });
    if (ib.error) { check(`inverse of ${nm} builds`, false, ib.error); continue; }
    // the params are read back exactly: rebuilding from the stored text gives the same map
    const okR = pts.every((w) => near(b.f(ib.f(w)), w, 1e-9)), okL = pts.every((z) => near(ib.f(b.f(z)), z, 1e-9));
    check(`inverse of ${nm} -> ${b.inverse.type} ${JSON.stringify(b.inverse.params)}`, okR || okL, `right ${okR} left ${okL}`);
  }
  const m3 = Funcs.build({ type: 'mul', params: { c: '3' } }).inverse;
  check('mul 3 inverse is exactly 1/3', Expr.constValue(m3.params.c).re === 1 / 3, m3.params.c);
}
// ---------- Funcs.derivativeStep ----------
{
  const pts = [C(0.31, 0.72), C(-0.45, 0.23), C(0.83, -0.51), C(1.37, 0.41), C(-0.9, -0.6)];
  const cases = Object.keys(Funcs.DEFS).map((id) => ({ type: id, params: Funcs.defaults(id) }));
  cases.push(
    { type: 'root', params: { n: 3, cut: 90, k: 1 } }, { type: 'root', params: { n: 2, cut: 180, k: 1 } }, { type: 'root', params: { n: 4, cut: -30, k: 3 } },
    { type: 'powa', params: { alpha: '2.5', cut: 60, k: 1 } }, { type: 'powa', params: { alpha: '1/3', cut: 180, k: 0 } },
    { type: 'powa', params: { alpha: '0.5+i', cut: -120, k: 1 } }, { type: 'log', params: { cut: 45, k: -1 } },
    { type: 'pown', params: { n: -3 } }, { type: 'pown', params: { n: 0 } }, { type: 'blaschke', params: { a: '0.3+0.4i', phi: 90 } },
    { type: 'mobius', params: { a: '2', b: '1', c: '0', d: '4' } }, { type: 'rational', params: { p: '1, 0, 0, 2', q: '1, -1, 3i' } },
    { type: 'rational', params: { p: '1, 2', q: '5' } }, { type: 'poly', params: { co: '1+i, 0, -2, 0.5' } },
    { type: 'custom', params: { expr: '\\sqrt{z}\\,e^{z}', cut: 90 } }, { type: 'custom', params: { expr: '\\arcsin(z)+z^{1.5}', cut: -45 } },
    { type: 'ijouk', params: { branch: 'interior' } },
  );
  for (const st of cases) {
    const b = Funcs.build(st);
    const nm = `${st.type} ${JSON.stringify(st.params)}`;
    const r = Funcs.derivativeStep(st);
    if (st.type === 'conj') { check('conj has no derivative', !!r.error, JSON.stringify(r)); continue; }
    // d/dz is an operator on the chain (its derivative is a second d/dz step), not a map with a derivative formula
    if (st.type === 'deriv') { check('d/dz has no single-step derivative', !!r.error, JSON.stringify(r)); continue; }
    if (r.error) { check(`derivative of ${nm}`, false, r.error); continue; }
    const db = Funcs.build(r.step);
    if (db.error) { check(`derivative step of ${nm} builds`, false, db.error); continue; }
    let ok = true, info = '';
    for (const z of pts) {
      const h = 1e-5;
      const num = CX.scale(CX.sub(b.f(CX.add(z, C(h, 0))), b.f(CX.sub(z, C(h, 0)))), 0.5 / h);
      const numI = CX.scale(CX.sub(b.f(CX.add(z, C(0, h))), b.f(CX.sub(z, C(0, h)))), 0.5 / h);
      if (!CX.isFin(num) || !near(num, C(numI.im, -numI.re), 1e-4)) continue; // next to a cut
      const v = db.f(z);
      if (!near(v, num, 1e-6)) { ok = false; info = `at ${fmt(z)}: ${fmt(v)} vs ${fmt(num)}  [${r.step.params.expr}, cut ${r.step.params.cut}]`; break; }
    }
    check(`derivative of ${nm} = ${r.step.params.expr}`, ok, info);
    if (!r.note) check(`derivative note for ${nm}`, false);
  }
}
// ---------- GLChain.levelGLSL ----------
{
  for (const s of ['|z|<1', '1<|z|<2', '0<\\Im z<\\pi, \\Re z>0', 'x^2+y^2 \\le 4 \\lor y>3', '\\neg (|z|<1)', '|z^2-1| < \\frac{1}{2}', 'r < 1 + \\cos\\theta']) {
    const g = GLChain.levelGLSL(Expr.parse(s, { allowRel: true }), 'tgtLevel');
    check(`levelGLSL ${s}`, g.ok && /^float tgtLevel\(vec2 z\)/.test(g.source), g.source);
  }
  check('levelGLSL accepts text', GLChain.levelGLSL('|z-1|<2', 'L2').ok);
  check('levelGLSL rejects a non-region', !GLChain.levelGLSL(Expr.parse('z^2'), 'L3').ok);
}
console.log(`${n - bad}/${n} passed; bad: ${bad}`);
if (bad) process.exitCode = 1;
