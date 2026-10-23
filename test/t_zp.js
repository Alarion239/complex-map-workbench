// The zeros-and-poles step (funcs.js 'zp', 2026-10-22): f(z) = a prod(z - zeta_k) / prod(z - p_j).
// (a) the lists parse (empty, brackets, spaces) and an item written back parses to exactly the same value;
// (b) f is a prod / prod (= the expanded P/Q), infinite at a pole, finite where products alone would overflow;
// (c) guarantees: rational of exact degree max(#zeros, #poles), polynomial iff no pole, Moebius iff degree 1, proper
//     iff more zeros than poles, constant cases (a = 0, nothing, a cancelled pair), the natural domain, inverses;
// (d) the factored TeX parses back to the same map;
// (e) the natural path: H_0 = id, H_1 = f, continuous at the first frames, analytic for each t, never degenerate;
//     the zoom path about zeta_1 exactly (the listed order: no jump while another zero is dragged), with poles
//     the rational zoom path about a zero; the caption names the zeros as the card does;
// (f) the inverse renderer: degree <= 2 exact (MOB, AFF, QUAD, RAT2) with preimages that map back, degree >= 3
//     forward with the reason; the limit at infinity (sphere.js);
// (g) d/dz of the step (Funcs.derivAst) against a numeric derivative; the step's own 'derivative' action;
// (h) conversions: polynomial, rational, custom rational -> zeros and poles -> coefficients, the same map;
// (i) GLChain: the product-form shader's signature counts only the numbers of zeros and poles (a drag never
//     recompiles), and adding one changes it.
// Run: node test/t_zp.js
global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
global.Funcs = require('../src/funcs.js');
global.Region = require('../src/region.js');
const Inverse = require('../src/inverse.js');
const GLChain = require('../src/glsl.js');
const F = global.Funcs;
const { C } = CX;
let checks = 0, failed = 0;
const check = (name, cond, got) => { checks++; if (!cond) { failed++; console.log('FAIL', name, got === undefined ? '' : JSON.stringify(got)); } };
let seed = 11;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const rc = (r = 2) => C(+(rnd() * 2 * r - r).toFixed(3), +(rnd() * 2 * r - r).toFixed(3));
const pts = Array.from({ length: 60 }, () => C(rnd() * 5 - 2.5, rnd() * 5 - 2.5));
const ZP = (params) => F.build({ type: 'zp', params: Object.assign(F.defaults('zp'), params) });
const rel = (a, b) => CX.abs(CX.sub(a, b)) / (1 + CX.abs(b));
const list = (vs) => vs.map(F.zpItem).join(', ');

// (a) lists
check('empty list', F.parseCxList('').length === 0 && F.parseCxList('  ').length === 0 && F.parseCxList(undefined).length === 0);
check('list with spaces, brackets, a trailing comma', JSON.stringify(F.parseCxList(' 1 , (1+i)/2, -i, ')) === JSON.stringify([C(1, 0), C(0.5, 0.5), C(-0, -1)]), F.parseCxList(' 1 , (1+i)/2, -i, '));
check('a bad item names its position', (() => { try { F.parseCxList('1, 2+'); return false; } catch (e) { return /value 2/.test(e.message); } })());
for (let i = 0; i < 200; i++) {
  const v = C((rnd() - 0.5) * 10 ** Math.floor(rnd() * 8 - 4), (rnd() - 0.5) * 10 ** Math.floor(rnd() * 8 - 4));
  const s = F.zpItem(v), back = F.parseCxList(s)[0];
  if (!(back.re === v.re && back.im === v.im) || /\s/.test(s)) { check('an item parses back exactly', false, { v, s, back }); break; }
}
check('an item has no spaces and no -0', F.zpItem(C(-0, 2)) === '2i' && F.zpItem(C(0.5, -0.25)) === '0.5-0.25i');

// (b) evaluation
for (let r = 0; r < 40; r++) {
  const a = rc(), zs = Array.from({ length: Math.floor(rnd() * 5) }, () => rc()), ps = Array.from({ length: Math.floor(rnd() * 4) }, () => rc());
  const b = ZP({ a: F.zpItem(a), zeros: list(zs), poles: list(ps) });
  if (b.error) { check('random step builds', false, b.error); continue; }
  const P = b.zp.P, Q = b.zp.Q;
  let e = 0;
  for (const z of pts) {
    let n = a; for (const q of zs) n = CX.mul(n, CX.sub(z, q));
    let d = C(1, 0); for (const q of ps) d = CX.mul(d, CX.sub(z, q));
    e = Math.max(e, rel(b.f(z), CX.div(n, d)), rel(b.f(z), CX.div(CX.polyEval(P, z), CX.polyEval(Q, z))));
  }
  check(`f = a prod/prod = P/Q (${zs.length} zeros, ${ps.length} poles)`, e < 1e-10, e);
}
const b0 = ZP({});
check('default: (z^2 - 1)/z', rel(b0.f(C(2, 0)), C(1.5, 0)) < 1e-15 && b0.zp.zeros.length === 2 && b0.zp.poles.length === 1);
const atPole = b0.f(C(0, 0));
check('infinite at a pole', atPole.re === Infinity && atPole.im === Infinity, atPole);
check('zero at a zero', CX.abs(b0.f(C(1, 0))) === 0 && CX.abs(b0.f(C(-1, 0))) === 0);
const big = ZP({ a: '1', zeros: Array(24).fill('1').join(', '), poles: Array(24).fill('-1').join(', ') });
const wb = big.f(C(1e12, 1e12));
check('24 zeros over 24 poles at |z| = 1e12: finite (paired factors)', CX.isFin(wb) && Math.abs(wb.re - 1) < 1e-6, wb);
check('more than 24 zeros or poles: an error (the degree cap)', /At most 24/.test(ZP({ zeros: Array(25).fill('1').join(', ') }).error || '') && /At most 24/.test(ZP({ poles: Array(25).fill('1').join(', ') }).error || '') && !ZP({ zeros: Array(24).fill('1').join(', ') }).error);

// (c) guarantees
const props = (p) => ZP(p).props;
const P = (zeros, poles, a = '1') => props({ a, zeros, poles });
let pr = P('1, -1', '');
check('2 zeros: polynomial of exact degree 2, proper, entire, not Moebius', pr.polynomial && pr.entire && pr.rational && pr.deg === 2 && pr.degExact && pr.proper && !pr.mobius && !pr.injective, pr);
pr = P('1, -1', '0');
check('2 zeros, 1 pole: rational degree 2, proper, not polynomial', !pr.polynomial && !pr.entire && pr.rational && pr.deg === 2 && pr.degExact && pr.proper, pr);
pr = P('1', '2');
check('1 zero, 1 pole: Moebius, injective, not proper', pr.mobius && pr.injective && pr.deg === 1 && !pr.proper, pr);
pr = P('', '1');
check('no zero, 1 pole: Moebius', pr.mobius && pr.deg === 1 && !pr.proper && !pr.polynomial, pr);
pr = P('3+i', '');
check('1 zero, no pole: affine (polynomial, Moebius)', pr.mobius && pr.polynomial && pr.deg === 1, pr);
pr = P('1', '0, 2, 3i');
check('1 zero, 3 poles: degree 3, not proper', pr.deg === 3 && pr.degExact && !pr.proper && pr.rational, pr);
pr = P('1, 1, 1', '');
check('a triple zero: degree 3 (multiplicity counts)', pr.deg === 3 && pr.polynomial, pr);
pr = P('1, -1', '', '0');
check('a = 0: constant', pr.constant && pr.deg === 0, pr);
pr = P('', '');
check('nothing: the constant a', pr.constant && ZP({ a: '2i', zeros: '', poles: '' }).f(C(5, 5)).im === 2);
const canc = ZP({ zeros: '1, 2', poles: '1' });
check('a zero on a pole cancels (degree 1, said in the note)', canc.props.deg === 1 && canc.props.mobius && canc.props.polynomial && /cancel at 1/.test(canc.branchNote || '') && rel(canc.f(C(1, 0)), C(-1, 0)) < 1e-15, { p: canc.props, n: canc.branchNote });
const near = ZP({ zeros: '1, 2', poles: '1.000000001' });
check('a zero next to a pole stays: exact degree 2', near.props.deg === 2 && near.props.degExact && !near.branchNote, near.props);
check('natural domain names the poles', /\\notin\\\{0\\\}/.test(b0.domain('z')) && ZP({ poles: '' }).domain === null, b0.domain && b0.domain('z'));
check('degree 1: an inverse (Moebius / affine)', ZP({ zeros: '1', poles: '2' }).inverse.type === 'mobius' && ZP({ zeros: '1', poles: '' }).inverse.type === 'affine');
check('degree 2: no single inverse, said why', !b0.inverse && /degree 2/.test(b0.inverseNote));
// the Moebius inverse undoes the map
{
  const b = ZP({ a: '2-i', zeros: '1+i', poles: '-0.5' });
  const inv = F.build({ type: b.inverse.type, params: Object.assign(F.defaults(b.inverse.type), b.inverse.params) });
  check('Moebius inverse: f^-1(f(z)) = z', pts.every((z) => rel(inv.f(b.f(z)), z) < 1e-12));
}

// (d) TeX
const texCases = [{}, { poles: '' }, { a: '-1', zeros: '-1-i', poles: '0.5' }, { a: '2i', zeros: '1, 1, 0', poles: 'i, -i' }, { a: '0.5', zeros: '', poles: '1, 2' }, { a: '1-i', zeros: '1e-7i', poles: '' }, { zeros: '0', poles: '' }, { a: '3', zeros: '', poles: '' }];
for (const p of texCases) {
  const b = ZP(p);
  const tex = b.tex({ s: 'z', p: 4 }).s;
  let g;
  try { g = Expr.compile(Expr.parse(tex)); } catch (e) { check(`TeX parses: ${tex}`, false, e.message); continue; }
  check(`TeX is the map: ${tex}`, pts.every((z) => { const u = b.f(z), v = g(z); return !CX.isFin(u) || rel(v, u) < 1e-9; }), tex);
}
check('TeX factored, x - r term by term', ZP({ a: '-1', zeros: '-1-i', poles: '0.5' }).tex({ s: 'z', p: 4 }).s === '-\\frac{z+1+i}{z-0.5}', ZP({ a: '-1', zeros: '-1-i', poles: '0.5' }).tex({ s: 'z', p: 4 }).s);
check('TeX powers for repeated zeros, z first', /^2i\\,\\frac\{z\\left\(z-1\\right\)\^\{2\}\}/.test(ZP({ a: '2i', zeros: '1, 1, 0', poles: 'i, -i' }).tex({ s: 'z', p: 4 }).s), ZP({ a: '2i', zeros: '1, 1, 0', poles: 'i, -i' }).tex({ s: 'z', p: 4 }).s);

// (e) natural paths
const pathCases = [{}, { poles: '' }, { a: '2i', zeros: '1, -0.5+0.8i, -0.5-0.8i', poles: '' }, { a: '0.5-i', zeros: '1+i, -1', poles: '0.3i, -1.2' }, { zeros: '1', poles: '-1', a: '3' }, { zeros: '', poles: '0, 2i' }, { zeros: '0.5', poles: '1, i, -1-i' }];
for (const p of pathCases) {
  const b = ZP(p), name = JSON.stringify(p);
  { const zz = b.zp.zeros, pp = b.zp.poles, deg = Math.max(zz.length, pp.length), same = zz.length >= 2 && !pp.length && zz.every((q) => q.re === zz[0].re && q.im === zz[0].im);
    const want = deg === 1 ? 'mob' : same ? 'pow' : null;
    check(`${name}: a natural path`, !!b.nat && (want ? b.nat.kind === want : b.nat.kind === 'ratzoom' || b.nat.kind === 'jouk'), b.nat); }
  let e0 = 0, e1 = 0, c0 = 0, cr = 0, n = 0;
  for (const z of pts) {
    const f = b.f(z);
    if (!CX.isFin(f) || CX.abs(f) > 1e6) continue;
    e0 = Math.max(e0, CX.abs(CX.sub(b.hom(0)(z), z)));
    e1 = Math.max(e1, rel(b.hom(1)(z), f));
    c0 = Math.max(c0, rel(b.hom(4e-6)(z), z));
    for (const t of [0.25, 0.5, 0.8]) {
      const H = b.hom(t), h = 1e-6;
      const fx = CX.scale(CX.sub(H(C(z.re + h, z.im)), H(C(z.re - h, z.im))), 1 / (2 * h));
      const fy = CX.scale(CX.sub(H(C(z.re, z.im + h)), H(C(z.re, z.im - h))), 1 / (2 * h));
      if (!CX.isFin(fx) || !CX.isFin(fy) || CX.abs(fx) > 1e5) continue;
      n++;
      if (CX.abs(CX.sub(fy, CX.mul(C(0, 1), fx))) > 1e-4 * (1 + CX.abs(fx))) cr++;
    }
  }
  check(`${name}: H_0 = id`, e0 === 0, e0);
  check(`${name}: H_1 = f`, e1 < 1e-15, e1);
  check(`${name}: continuous at the first frames`, c0 < 1e-4, c0);
  check(`${name}: analytic for each t`, cr <= 2, { cr, n });
  // never degenerate: H_t takes different values at two points, for every t
  check(`${name}: never constant`, [0.05, 0.2, 0.38, 0.5, 0.7, 0.95].every((t) => CX.abs(CX.sub(b.hom(t)(C(0.31, 0.17)), b.hom(t)(C(-0.43, 0.29)))) > 1e-6));
}
{
  // the zoom path about zeta_1 exactly (the zeros in their listed order: not the least modulus), f(c) = 0 exactly
  const zs = [C(1, -1), C(0.3, 0.1), C(-1.5, 0.5)];
  const b = ZP({ a: '1.5', zeros: list(zs), poles: '' });
  check('zoom centre: zeta_1 exactly, f(c) = 0 exactly', b.nat.kind === 'ratzoom' && b.natData.p.re === 1 && b.natData.p.im === -1 && b.natData.fp.re === 0 && b.natData.fp.im === 0, b.natData && b.natData.p);
  const b2 = ZP({ a: '1', zeros: '1+i, -0.5+2i', poles: '0.3-0.7i' });
  check('zoom centre with poles: exactly 1+i (no root finding)', b2.natData.p.re === 1 && b2.natData.p.im === 1, b2.natData.p);
  const tx = b.homTex('z').tex;
  check('caption: centre c, a zero of f; only true claims (no zeros flying in, no "never meet" for a polynomial)', /about \$c=/.test(tx) && /a zero of \$f\$/.test(tx) && /critical points/.test(tx) && !/zeros fly/.test(tx) && !/never meet/.test(tx), tx);
  const tr = ZP({}).homTex('z').tex;
  check('caption with poles: the poles and critical points fly in along rays from c and never meet; nothing about the zeros', /about \$c=/.test(tr) && /poles and critical points/.test(tr) && /never meet/.test(tr) && !/zeros/.test(tr), tr);
  // dragging a zero across the modulus of another moves the path continuously (the centre stays zeta_1)
  const Hp = (zz, pp) => F.zerosPolesNat(C(1, 0), zz, pp, (z) => z).hom(0.5)(C(0, 0));
  const j1 = CX.abs(CX.sub(Hp([C(1, 0), C(-0.9999, 0)], []), Hp([C(1, 0), C(-1.0001, 0)], [])));
  const j2 = CX.abs(CX.sub(Hp([C(1, 0), C(-0.9999, 0)], [C(0, 2)]), Hp([C(1, 0), C(-1.0001, 0)], [C(0, 2)])));
  check('no jump when two zeros swap moduli (no pole, with a pole)', j1 < 1e-3 && j2 < 1e-3, { j1, j2 });
  // every zero the same point, no pole: the power path, as z^n
  const bp = ZP({ a: '2', zeros: '1, 1, 1', poles: '' });
  check('a (z - c)^n: the power path', bp.nat.kind === 'pow' && CX.abs(CX.sub(bp.hom(0.5)(C(2, 1)), CX.add(C(0.5, 0), CX.mul(CX.exp(CX.scale(CX.log(C(2, 0)), 0.5)), CX.pow(C(1, 1), C(2, 0), Math.PI, 0))))) < 1e-12, bp.nat);
  // a = 0 with poles: the constant 0 everywhere (the poles are removable), no domain restriction
  const b0 = ZP({ a: '0', zeros: '1', poles: '2' });
  check('a = 0: f = 0 at the pole too, entire, no domain', CX.abs(b0.f(C(2, 0))) === 0 && b0.props.constant && b0.props.entire && !b0.domain, { f: b0.f(C(2, 0)), domain: !!b0.domain });
  const tc = ZP({ a: '0' }).homTex('z').tex;
  check('a constant: the straight line, said so', /straight-line/.test(tc) && /no natural path/.test(tc), tc);
}

// (f) the inverse renderer
const opsOf = (p) => Inverse.stepOps(ZP(p));
const kinds = (r) => (r.ok ? r.ops.map((o) => o.kind).join(',') : 'X: ' + r.reason);
check('degree 2 with a pole: RAT2', kinds(opsOf({})) === 'RAT2', kinds(opsOf({})));
check('degree 2 polynomial: QUAD', kinds(opsOf({ poles: '' })) === 'QUAD', kinds(opsOf({ poles: '' })));
check('degree 1: MOB / AFF', kinds(opsOf({ zeros: '1', poles: '2' })) === 'MOB' && kinds(opsOf({ zeros: '1', poles: '' })) === 'AFF' && kinds(opsOf({ zeros: '', poles: '1' })) === 'MOB');
check('degree 3: forward, with the reason', /^X: rational map of degree 3 \(the exact renderer inverts degree ≤ 2\)$/.test(kinds(opsOf({ zeros: '1, 2', poles: '0, 3, 4' }))) && /^X: polynomial of degree 3/.test(kinds(opsOf({ zeros: '1, 2, 3', poles: '' }))), [kinds(opsOf({ zeros: '1, 2', poles: '0, 3, 4' })), kinds(opsOf({ zeros: '1, 2, 3', poles: '' }))]);
check('a constant: no inverse', !opsOf({ a: '0' }).ok);
for (const p of [{}, { poles: '' }, { a: '2i', zeros: '1+i', poles: '-0.5' }, { a: '0.5', zeros: '1+i, -2', poles: '0.25i, 3' }, { a: '-1', zeros: '1, i', poles: '' }, { zeros: '', poles: '0.3-i' }]) {
  const b = ZP(p), r = Inverse.stepOps(b);
  if (!r.ok) { check(`${JSON.stringify(p)}: eligible`, false, r.reason); continue; }
  const op = r.ops[0];
  let worst = 0, count = true;
  for (let i = 0; i < 40; i++) {
    const w = rc(3), pre = op.pre(w);
    if (pre.length !== b.props.deg) count = false;
    for (const m of pre) { const u = m.z || m.u || m; worst = Math.max(worst, rel(b.f(u), w)); }
  }
  check(`${JSON.stringify(p)}: every preimage maps back (${b.props.deg} of them)`, worst < 1e-9 && count, { worst, count });
}
global.GLChain = GLChain;
const SM = require('../src/sphere.js');
{
  const k = (p) => SM.atInfOf(ZP(p));
  const a = k({ poles: '' }), m = k({ zeros: '1, 2', poles: '0' }), e = k({ a: '2i', zeros: '1', poles: '3' }), f = k({ zeros: '1', poles: '0, 2' });
  check('at infinity: more zeros -> infinity, as many -> a, fewer -> 0', a.k === SM.INF && m.k === SM.INF && e.k === SM.FIN && e.w.im === 2 && f.k === SM.FIN && CX.abs(f.w) === 0, { a, m, e, f });
}

// (g) derivative
for (const p of [{}, { poles: '' }, { a: '0.5-i', zeros: '1+i, -1', poles: '0.3i, -1.2' }, { zeros: '', poles: '1' }]) {
  const b = ZP(p), d = F.derivAst(b);
  if (d.error) { check(`${JSON.stringify(p)}: f'`, false, d.error); continue; }
  const g = Expr.compile(d.ast);
  let e = 0;
  for (const z of pts) {
    const h = 1e-5, num = CX.scale(CX.sub(b.f(C(z.re + h, z.im)), b.f(C(z.re - h, z.im))), 1 / (2 * h));
    if (!CX.isFin(num) || CX.abs(num) > 1e4) continue;
    e = Math.max(e, rel(g(z), num));
  }
  check(`${JSON.stringify(p)}: f' (exact) = numeric derivative`, e < 1e-6, e);
}
const ds = F.derivativeStep({ type: 'zp', params: F.defaults('zp') });
check('Replace with derivative: a custom step', ds.step && ds.step.type === 'custom' && /Zeros and poles/.test(ds.note), ds);

// (h) conversions
const sameMap = (s1, s2) => { const a = F.build(s1), b = F.build(s2); return !a.error && !b.error && pts.every((z) => { const u = a.f(z), v = b.f(z); return !CX.isFin(u) || CX.abs(u) > 1e8 || rel(v, u) < 1e-9; }); };
for (const st of [{ type: 'poly', params: { co: '1, 0, -1, 0' } }, { type: 'poly', params: { co: '2, 1-i, 3' } }, { type: 'rational', params: { p: '1, 0, -1', q: '1, 0' } }, { type: 'rational', params: { p: '2, 1', q: '1, 0, 1' } },
  { type: 'custom', params: { expr: '\\frac{z^2-1}{z^2+1}', cut: 180 } }, { type: 'poly', params: { co: '1, -3+3i, 2-9i, 6i' } }]) {
  const r = F.toZerosPoles(st);
  check(`${st.type} ${JSON.stringify(st.params)} -> zeros and poles`, r.step && r.step.type === 'zp' && sameMap(st, r.step), r);
  if (!r.step) continue;
  const back = F.fromZerosPoles(r.step);
  check(`... and back to coefficients`, back.step && sameMap(st, back.step) && back.step.type === (st.type === 'poly' || (st.type === 'custom' && false) ? 'poly' : back.step.type), back);
}
check('roots read cleanly: (z^2 - 1)/z -> zeros 1, -1, pole 0', JSON.stringify(F.toZerosPoles({ type: 'rational', params: { p: '1, 0, -1', q: '1, 0' } }).step.params) === JSON.stringify({ a: '1', zeros: '1, -1', poles: '0' }));
check('not a rational map: refused with a reason', !!F.toZerosPoles({ type: 'exp', params: {} }).error && !!F.toZerosPoles({ type: 'custom', params: { expr: '\\sin z', cut: 180 } }).error);
check('the zero polynomial: refused', !!F.toZerosPoles({ type: 'poly', params: { co: '0' } }).error);
check('fromZerosPoles: (2z^2 - 2)/z exactly', JSON.stringify(F.fromZerosPoles({ type: 'zp', params: { a: '2', zeros: '1, -1', poles: '0' } }).step) === JSON.stringify({ type: 'rational', params: { p: '2, 0, -2', q: '1, 0' } }));
check('fromZerosPoles of a polynomial: a poly step', F.fromZerosPoles({ type: 'zp', params: { a: '1', zeros: '1, 2', poles: '' } }).step.type === 'poly');

// (i) GLChain signature
const key = (params) => { const st = [{ type: 'zp', params: Object.assign(F.defaults('zp'), params), on: true }]; return GLChain.build(st, st.map((s) => F.build(s))).key; };
check('dragging a zero or a pole keeps the shader (only uniforms change)', key({}) === key({ a: '2i', zeros: '1.3+0.4i, -0.7', poles: '0.2-0.1i' }) && key({ poles: '' }) === key({ zeros: '5, 6i', poles: '' }));
check('adding a zero or a pole is a new shader', key({}) !== key({ zeros: '1, -1, i' }) && key({}) !== key({ poles: '0, 1' }) && key({ poles: '' }) !== key({}));

console.log(`\n${checks} checks, ${failed} failed`);
process.exit(failed ? 1 : 0);
