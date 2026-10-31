// Shared numbers (src/params.js and the name scope of src/parse.js; constructions/DESIGN.md 1).
// (a) names: one letter, an index (a1, a_1, a_{1}, a₁), Greek (beta, \beta, β), runs (az, ai with a defined; sinc is
//     an unknown function), Cyrillic look-alikes, refused Cyrillic; text that parsed before parses the same (xi, chi);
// (b) unknown names: one is offered (e.unknown), two at once are refused; TeX keeps the names;
// (c) clashes: z w x y r i e θ π, function words, duplicates, each with its message;
// (d) dependencies: a number by formula, cycles refused, the closure, used by, rename and delete (the value written in);
// (e) the steps: Möbius, zeros and poles, custom formulas read the names; the GPU program's key does not depend on the
//     values (a slider never recompiles), and the CPU map follows the value;
// (f) shapes: resolve() writes the values into a formula (Re z = a -> Re z = (0.5)), and the curve is exact;
// (g) serialization: sanitize, links (compressed and plain) round-trip, damaged and newer links, an older link's state,
//     scene files.
// Run: node test/t_params.js
global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
global.Funcs = require('../src/funcs.js');
global.Region = require('../src/region.js');
global.Curves = require('../src/curves.js');
const GLChain = require('../src/glsl.js');
global.GLChain = GLChain;
const P = require('../src/params.js');
const C = CX.C;
let fails = 0, n = 0;
const ok = (c, msg) => { n++; if (!c) { fails++; console.log('FAIL', msg); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`);
const perr = (s, o) => { try { Expr.parse(s, o); return null; } catch (e) { return e; } };
const val = (s) => { const v = Expr.constValue(s); return [v.re, v.im]; };
const tex = (s) => Expr.toTex(Expr.parse(s, { allowRel: true })).s;
const list = [];
P._local(list);

(async () => {
  // (a) + (b): before any number exists
  for (const [src, name] of [['a', 'a'], ['2a', 'a'], ['a z + 1', 'a'], ['az', 'a'], ['ai', 'a'], ['sin a', 'a'], ['beta', 'β'], ['\\beta', 'β'], ['β', 'β'], ['a1', 'a1'], ['a_1', 'a1'],
    ['a_{12}', 'a12'], ['a₂', 'a2'], ['\\alpha_{3}', 'α3'], ['zeta + 1', 'ζ'], ['eta', 'η'], ['rho', 'ρ'], ['K', 'K'], ['Re z = k', 'k'], ['а', 'a']]) {
    const e = perr(src, { allowRel: true });
    ok(e && Array.isArray(e.unknown) && e.unknown.length === 1 && e.unknown[0] === name, `unknown name in ${src}: ${e && e.message} ${e && e.unknown}`);
  }
  const two = perr('s + t');
  ok(two && two.unknown && two.unknown.join() === 's,t' && /One new name at a time/.test(two.message), 'two new names refused');
  for (const src of ['sinc(z)', 'sina', 'abz + 1']) { const e = perr(src); ok(e && !e.unknown && /Unknown function/.test(e.message), `run of letters ${src}: ${e && e.message}`); }
  ok(/Latin/.test((perr('ж') || {}).message || ''), 'Cyrillic letter refused');
  // text that parsed before reads the same
  eq(val('xi'.replace('x', '2')), [0, 2], '2i');
  ok(!perr('xi') && Expr.depends(Expr.parse('xi')), 'xi stays x i');
  eq(val('chi'), val('cosh(i)'), 'chi stays ch i (cosh i)');
  ok(!perr('|z| < 1 и Re z > 0', { allowRel: true }), 'Russian и still reads as and');
  ok(!perr('|z| < 1 или Re z > 0', { allowRel: true }), 'Russian или still reads as or');
  eq(P.namesIn('a, -a; 2k1 + \\beta'), ['a', 'k1', 'β'], 'namesIn a list');
  eq(P.namesIn('principal'), [], 'a word holds no names');
  eq(P.namesIn('sin z'), [], 'sin z holds no names');
  // [#240] a field's bound letters are never names: a series' n, a recurrence's u
  eq(P.unknownIn('1/n!', { bound: ['n'] }), [], 'unknownIn 1/n! in a_n: no n');
  eq(P.unknownIn('b^n', { bound: ['n'] }), ['b'], 'b^n in a_n: b only');
  eq(P.unknownIn('u^2+z+1', { bound: ['u'] }), [], 'u^2+z+1 in a rule: no u');
  eq(P.unknownIn('u^2+q', { bound: ['u'] }), ['q'], 'u^2+q in a rule: q only');
  ok(/index of a series/.test(P.check('n').error || ''), 'n is refused as a number: ' + JSON.stringify(P.check('n')));
  ok(!P.check('n1').error, 'n₁ is a name');
  ok(/recurrence/.test(P.check('u', { bound: ['u'] }).error || '') && !P.check('u').error, 'u refused where a field binds it, a name elsewhere');

  // (c) clashes
  for (const [nm, re] of [['z', /variable/], ['w', /variable/], ['x', /Re z/], ['y', /Re z/], ['r', /ρ or R/], ['i', /imaginary/], ['e', /Euler/], ['θ', /arg z/], ['theta', /arg z/], ['pi', /constant/], ['π', /constant/], ['sin', /function/], ['ab', /function or a word/], ['ж', /Latin/], ['', /Type a name/], ['z1', /variable/]]) {
    const c = P.check(nm);
    ok(c.error && re.test(c.error), `clash ${nm}: ${c.error}`);
  }
  for (const [nm, c] of [['a', 'a'], ['a_1', 'a1'], ['a₁', 'a1'], ['alpha', 'α'], ['\\rho', 'ρ'], ['ρ', 'ρ'], ['R', 'R'], ['E', 'E']]) eq(P.check(nm).name, c, `valid ${nm}`);

  // numbers
  const seen = [];
  const off = P.on('change', (ev) => seen.push(ev));
  P.add('a', { value: 0.5 });
  ok(P.check('a').error && /already exists/.test(P.check('a').error), 'duplicate refused');
  eq(P.get('a'), 0.5, 'get');
  eq(val('2a'), [1, 0], '2a');
  eq(val('a i'), [0, 0.5], 'a i');
  eq(val('ai'), [0, 0.5], 'ai (a known)');
  eq(tex('Re z = a'), '\\operatorname{Re} z = a', 'TeX keeps the name');
  P.add('β', { value: 2 });
  P.add('k1', { value: -1 });
  eq(tex('\\beta_{} + k_1'.replace('_{}', '')), '\\beta+k_{1}', 'TeX of Greek and indexed names');
  eq(val('a k1 β'), [-1, 0], 'product of names');
  eq(P.set('a', 0.25), '', 'set');
  eq(val('4a'), [1, 0], 'value follows set');
  ok(seen.some((e) => e.names.includes('a')), 'change event');
  // the range grows to a value set outside it
  P.set('a', 7);
  ok(list.find((p) => p.name === 'a').max === 7, 'range grows');
  P.set('a', 0.5);

  // (d) dependencies
  P.add('b', { value: 0 });
  eq(P.set('b', '2a + 1'), '', 'b by formula');
  eq(P.get('b'), 2, 'b = 2a + 1');
  P.set('a', 1.5);
  eq(P.get('b'), 4, 'b follows a');
  ok(P.closure(['a']).includes('b'), 'closure');
  ok(/depend on itself/.test(P.set('a', 'b - 1')), 'cycle refused: ' + P.set('a', 'b - 1'));
  eq(P.get('a'), 1.5, 'a unchanged after a refused cycle');
  ok(/depend on itself/.test(P.set('b', 'b + 1')), 'self reference refused');
  ok(/not defined/.test(P.set('b', 'q + 1')), 'unknown name in a number formula');
  // host formulas: used by, rename, delete
  const host = { steps: [{ type: 'mobius', params: Object.assign(Funcs.defaults('mobius'), { b: 'a i' }) }], shapes: [{ kind: 'fcurve', bind: { expr: 'Re z = a' }, expr: '' }] };
  const formulas = () => [
    { label: 'f₁', get: () => host.steps[0].params.b, set: (t) => { host.steps[0].params.b = t; } },
    { label: 'Curve 1', get: () => host.shapes[0].bind.expr, set: (t) => { host.shapes[0].bind.expr = t; } },
  ];
  P.attach({ list: () => list, formulas });
  eq(P.usedBy('a'), ['f₁', 'Curve 1', 'b'], 'used by');
  eq(P.rename('a', 'α'), '', 'rename');
  eq(host.steps[0].params.b, 'α i', 'rename rewrites a step field');
  eq(host.shapes[0].bind.expr, 'Re z = α', 'rename rewrites a shape formula');
  eq(list.find((p) => p.name === 'b').expr, '2α + 1', 'rename rewrites a number formula');
  eq(P.get('b'), 4, 'value after rename');
  ok(/already exists/.test(P.rename('α', 'b')), 'rename onto an existing name refused');
  ok(/variable/.test(P.rename('α', 'z')), 'rename onto z refused');
  eq(P.replaceName('az + a1', 'a', 'k1'), 'k1 z + a1', 'replace keeps a run apart');
  eq(P.replaceName('za + 2a', 'a', 'k1'), 'z k1 + 2k1', 'replace keeps a run apart (before)');
  ok(!perr('z k1 + 2k1'), 'the replaced text parses');
  P.inline('α');
  P.remove('α');
  eq(host.steps[0].params.b, '(1.5) i', 'delete writes the value into a step field');
  eq(host.shapes[0].bind.expr, 'Re z = (1.5)', 'delete writes the value into a shape formula');
  eq(list.find((p) => p.name === 'b').expr, '2(1.5) + 1', 'delete writes the value into a number formula');
  eq(Expr.constValue('2(1.5) + 1').re, 4, 'the written value reads back');
  eq(P.get('b'), 4, 'b keeps its value');
  P.set('b', 4);
  ok(!list.find((p) => p.name === 'b').expr, 'a value makes b free');
  off();

  // (e) steps
  P.add('a', { value: 0.5 });
  const st = (type, params) => ({ type, params: Object.assign(Funcs.defaults(type), params), on: true });
  const m = Funcs.build(st('mobius', { b: 'a i' }));
  ok(!m.error, 'Möbius with a name builds: ' + m.error);
  eq([m.vals.b.re, m.vals.b.im], [0, 0.5], 'Möbius b = a i');
  const zp = Funcs.build(st('zp', { zeros: 'a, -a', poles: '2a i' }));
  ok(!zp.error, 'zeros and poles with names: ' + zp.error);
  const fz = zp.f(C(0.5, 0));
  ok(CX.abs(fz) < 1e-15, 'a zero at a = 0.5');
  const cu = st('custom', { expr: 'z^2 + a' });
  const k1 = GLChain.build([cu], [Funcs.build(cu)]).key;
  const b1 = Funcs.build(cu);
  P.set('a', 2);
  const b2 = Funcs.build(cu);
  const k2 = GLChain.build([cu], [b2]).key;
  ok(k1 === k2, 'GPU key independent of the value (custom)');
  eq([b1.f(C(1, 0)).re, b2.f(C(1, 0)).re], [1.5, 3], 'CPU custom map follows the value');
  // [#241] a number inside a series' a_n or a recurrence's rule: the CPU map follows its value, the GPU key does not
  for (const [what, sq, z] of [['series a_n = a^n', st('series', { kind: 'power', an: 'a^n', c: '0' }), C(0.3, 0.1)], ['recurrence u^2 + a', st('recurrence', { u0: 'z', g: 'u^2+a', N: 5 }), C(0.2, 0.1)]]) {
    P.set('a', 0.5);
    const s1 = Funcs.build(sq), q1 = GLChain.build([sq], [s1]).key;
    P.set('a', -0.3);
    const s2 = Funcs.build(sq), q2 = GLChain.build([sq], [s2]).key;
    ok(!s1.error && !s2.error, `${what} builds: ${s1.error || s2.error}`);
    ok(q1 === q2, `${what}: GPU key independent of the value`);
    ok(CX.abs(CX.sub(s1.f(z), s2.f(z))) > 1e-3, `${what}: CPU map follows the value`);
  }
  // [#327] a COMPLEX number inside a_n and a recurrence's rule: the CPU maps are the closed forms for each value, the GPU
  // key does not depend on the value (real or complex), and the uniforms carry its imaginary part. The Dirichlet
  // coefficients and the recurrence's constant are written as they are, so those are checked as (re, im) pairs; a power
  // or Laurent series scales its coefficients, so there only the change of the uniforms is checked
  {
    const A1 = { re: 0.5, im: 0.3 }, A2 = { re: -0.2, im: 0.7 };
    const ac = (a) => C(a.re, a.im), one = C(1, 0), cm = CX.mul, cs = CX.sub, ca = CX.add, cdiv = CX.div;
    const near = (u, v) => CX.abs(cs(u, v)) < 1e-9 * Math.max(1, CX.abs(v));
    // a pair (re, im) of consecutive floats in the filled uniforms (Float32: 1e-6 is a safe tolerance)
    const hasPair = (f, re, im) => f.some((x, i) => i + 1 < f.length && Math.abs(x - re) < 1e-6 && Math.abs(f[i + 1] - im) < 1e-6);
    const fillOf = (sq, b) => { const g = GLChain.build([sq], [b]); return { key: g.key, f: Array.from(g.fill(new Float32Array(g.slots * 4))) }; };
    const orbit = (g, z0, N) => { let u = z0; for (let i = 0; i < N; i++) u = g(u); return u; };
    const z1 = C(0.4, -0.2), z2 = C(0.8, -0.5), z3 = C(0.2, 0.1), s3 = C(3, 1);
    const cases = [
      ['power a^n = 1/(1 − a z)', st('series', { kind: 'power', an: 'a^n', c: '0' }), z1, (a) => cdiv(one, cs(one, cm(a, z1)))],
      ['power conj(a)^n = 1/(1 − ā z)', st('series', { kind: 'power', an: '\\overline{a}^n', c: '0' }), z1, (a) => cdiv(one, cs(one, cm(CX.conj(a), z1)))],
      ['power |a|^n = 1/(1 − |a| z)', st('series', { kind: 'power', an: '|a|^n', c: '0' }), z1, (a) => cdiv(one, cs(one, cm(C(CX.abs(a), 0), z1)))],
      ['Laurent a^|n| = 1/(1 − a z) + (a/z)/(1 − a/z)', st('series', { kind: 'laurent', an: 'a^{|n|}', c: '0' }), z2, (a) => ca(cdiv(one, cs(one, cm(a, z2))), cdiv(cdiv(a, z2), cs(one, cdiv(a, z2))))],
      ['Dirichlet a^n = Li_s(a)', st('series', { kind: 'dirichlet', an: 'a^n', c: '0' }), s3, (a) => { let t = C(0, 0), p = one; for (let k = 1; k <= 200; k++) { p = cm(p, a); t = ca(t, cm(p, CX.exp(CX.scale(s3, -Math.log(k))))); } return t; }, (a) => [[a.re, a.im]]],
      ['recurrence u² + a, N = 3', st('recurrence', { u0: 'z', g: 'u^2+a', N: 3 }), z3, (a) => orbit((u) => ca(cm(u, u), a), z3, 3), (a) => [[a.re, a.im]]],
      ['recurrence a u (1 − u), N = 3', st('recurrence', { u0: 'z', g: 'a*u*(1-u)', N: 3 }), z3, (a) => orbit((u) => cm(cm(a, u), cs(one, u)), z3, 3), (a) => [[a.re, a.im]]],
    ];
    for (const [what, sq, z, want, pairs] of cases) {
      const keys = [], fills = [];
      for (const av of [A1, A2, 0.5]) {
        P.set('a', av);
        const b = Funcs.build(sq);
        ok(!b.error, `${what}, a = ${JSON.stringify(av)} builds: ${b.error}`);
        if (b.error) continue;
        const a = typeof av === 'number' ? C(av, 0) : ac(av);
        ok(near(b.f(z), want(a)), `${what}: the CPU map is the closed form for a = ${JSON.stringify(av)}: ${JSON.stringify(b.f(z))} vs ${JSON.stringify(want(a))}`);
        const fo = fillOf(sq, b);
        keys.push(fo.key); fills.push(fo.f);
      }
      ok(keys.length === 3 && keys[0] === keys[1] && keys[1] === keys[2], `${what}: one GPU key for two complex values and a real one`);
      if (fills.length === 3) {
        ok(fills[0].join() !== fills[1].join(), `${what}: the uniforms differ between the two complex values`);
        ok(fills[0].join() !== fills[2].join(), `${what}: the imaginary part reaches the uniforms (a = 0.5 + 0.3i against a = 0.5)`);
      }
      if (pairs && fills.length === 3) {
        for (const [re, im] of pairs(A1)) ok(hasPair(fills[0], re, im), `${what}: the uniforms of a = 0.5 + 0.3i hold (${re.toFixed(3)}, ${im.toFixed(3)})`);
        for (const [re, im] of pairs(A2)) ok(hasPair(fills[1], re, im), `${what}: the uniforms of a = −0.2 + 0.7i hold (${re.toFixed(3)}, ${im.toFixed(3)})`);
      }
    }
  }
  P.set('a', 2);
  const mb = st('mobius', { b: 'a' });
  const km1 = GLChain.build([mb], [Funcs.build(mb)]).key;
  P.set('a', -3);
  ok(GLChain.build([mb], [Funcs.build(mb)]).key === km1, 'GPU key independent of the value (Möbius)');
  ok(/not defined yet/.test(Funcs.build(st('mobius', { b: 'q' })).error || ''), 'unknown name in a step is its error');
  const zn = st('root', { n: 3 });
  ok(!Funcs.build(zn).error, 'integer fields stay numbers');

  // (f) shapes: resolve
  P.set('a', 0.5);
  eq(P.resolve('Re z = a'), 'Re z = (0.5)', 'resolve');
  eq(P.resolve('|z - a i| < 2a'), '|z - (0.5) i| < 2(0.5)', 'resolve twice');
  P.set('a', -1e-7);
  eq(P.resolve('2a'), '2(-1e-7)', 'resolve keeps exponent forms apart');
  ok(Math.abs(Expr.constValue(P.resolve('2a')).re + 2e-7) < 1e-22, 'resolved text reads back exactly');
  P.set('a', 0.5);
  const d = Curves.fromFormula(P.resolve('Re z = a'));
  ok(d && !d.error, 'Re z = (0.5) is a curve');
  const fc = { kind: 'fcurve', expr: P.resolve('Re z = a'), bind: { expr: 'Re z = a' } };
  ok(/operatorname\{Re\} z = a/.test(Region.KINDS.fcurve.tex(fc)), 'a bound curve shows its name: ' + Region.KINDS.fcurve.tex(fc));

  // (g) serialization
  const san = P.sanitize([{ name: 'a', value: 0.5, min: -2, max: 2, step: 0.01 }, { name: 'a', value: 1 }, { name: 'z', value: 1 }, { name: 'b', expr: '2a', value: 1, min: 3, max: 1 }, { name: 'alpha', value: 'x' }, null, { name: 'q_2', value: 9, play: 'loop' }, { name: 'θ' }]);
  eq(san.map((p) => p.name), ['a', 'b', 'α', 'q2'], 'sanitize keeps valid unique names');
  ok(san[1].max > san[1].min && san[1].expr === '2a', 'sanitize repairs a range, keeps a formula');
  eq(san[2].value, 1, 'sanitize: a value that is not a number becomes 1');
  eq(san[3].play, 'loop', 'sanitize keeps the play mode');
  eq(P.sanitize(JSON.parse(JSON.stringify(san))), san, 'sanitize is idempotent (save, load)');
  const state = { shapes: [{ id: 's1', kind: 'fcurve', expr: 'Re z = (0.5)', bind: { expr: 'Re z = a' } }], steps: [{ type: 'mobius', params: { a: '1', b: 'a i', c: '0', d: '1' }, on: true }], params: san, view: { main: 'xy' }, srcView: { cx: 0, cy: 0, s: 60 } };
  const link = await P.encodeLink(state);
  ok(/^1\.[A-Za-z0-9_-]+$/.test(link), 'compressed link payload');
  eq(await P.decodeLink(link), state, 'link round trip');
  const big = { shapes: [], steps: [], params: Array.from({ length: 200 }, (_, i) => ({ name: 'a' + i, value: i / 7, min: -2, max: 2, step: 0.01 })) };
  const lb = await P.encodeLink(big);
  eq(await P.decodeLink(lb), big, 'a large link round-trips');
  ok(lb.length < JSON.stringify(big).length, 'compression shortens the link');
  const plain = '0.' + Buffer.from(JSON.stringify({ v: 1, s: state })).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  eq(await P.decodeLink(plain), state, 'plain (uncompressed) link');
  // an older link: a saved state of an earlier build (no params, the old view fields) still decodes; the app's
  // sanitizeState migrates it (test/v15_params_cmd.js opens one)
  const old = { shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 1 }], steps: [{ type: 'exp', params: {}, on: true }], rightMode: 'image', v4: true };
  eq(await P.decodeLink('0.' + Buffer.from(JSON.stringify({ v: 1, s: old })).toString('base64url')), old, 'older state in a link');
  for (const [bad, re] of [['', /does not hold/], ['1.%%%', /does not hold/], ['1.AAAA', /damaged/], ['9.AAAA', /newer version/], ['0.' + Buffer.from('{"v":1}').toString('base64url'), /does not hold/], ['0.' + Buffer.from('not json').toString('base64url'), /damaged/]]) {
    let msg = '';
    try { await P.decodeLink(bad); } catch (e) { msg = e.message; }
    ok(re.test(msg), `bad link ${bad.slice(0, 12)}: ${msg}`);
  }
  const sc = P.scene(state);
  eq(P.readScene(sc), state, 'scene round trip');
  eq(P.readScene(JSON.stringify(state)), state, 'a bare saved state opens as a scene');
  for (const [bad, re] of [['{', /not JSON/], ['[1]', /not a scene/], ['{"app":"other","kind":"scene","state":{}}', /not a scene/]]) {
    let msg = '';
    try { P.readScene(bad); } catch (e) { msg = e.message; }
    ok(re.test(msg), `bad scene ${bad}: ${msg}`);
  }
  // an example's number keeps the user's number it stands in for (ex.was), in the saved state
  const sx = P.sanitize([{ name: 'N', value: 8, min: 1, max: 30, step: 1, ex: { was: { name: 'N', value: 3, min: 1, max: 9, step: 1, ex: true } } }, { name: 'M', value: 2, ex: true }, { name: 'K', value: 1, ex: { was: 7 } }]);
  eq(sx[0].ex, { was: { name: 'N', value: 3, min: 1, max: 9, step: 1 } }, 'sanitize keeps ex.was, as a plain number');
  eq(sx[1].ex, true, 'ex: true stays');
  eq(sx[2].ex, true, 'a damaged ex.was is dropped, ex stays');
  eq(P.sanitize(JSON.parse(JSON.stringify(sx))), sx, 'sanitize with ex.was is idempotent');
  // (h) complex numbers: a = 1 + i, formulas, real-only fields, resolve and save round trips
  list.length = 0;
  ok(P.add('a', { value: 1 }) && P.get('a') === 1 && !P.isComplex('a'), 'a real number stays real');
  eq(P.set('a', '1 + i'), '', 'a free number can be typed as a complex number');
  eq(P.getC('a'), { re: 1, im: 1 }, 'getC reads {re, im}');
  eq(P.get('a'), 1, 'get keeps the real part');
  ok(P.isComplex('a') && P.list()[0].im === 1, 'the entry holds im');
  eq(val('a'), [1, 1], 'a formula reads a as 1 + i');
  eq(val('a^2'), [0, 2], 'a² = 2i');
  eq(val('Re a'), [1, 0], 'Re a'); eq(val('Im a'), [1, 0], 'Im a');
  ok(Math.abs(val('|a|')[0] - Math.SQRT2) < 1e-12, '|a|');
  ok(Math.abs(val('arg a')[0] - Math.PI / 4) < 1e-12, 'arg a');
  eq(val('conj a'), [1, -1], 'conj a');
  eq(val('\\bar{a}'), [1, -1], '\\bar{a}');
  eq(val('\\overline{a}'), [1, -1], '\\overline{a}');
  eq(P.add('b', { value: 2 }) && P.set('b', 'a^2'), '', 'a number by formula may be complex');
  eq(P.getC('b'), { re: 0, im: 2 }, 'b = a² = 2i');
  P.set('a', '1 - i');
  eq(P.getC('b'), { re: 0, im: -2 }, 'b follows a');
  let e = ''; try { P.evalReal('a'); } catch (x) { e = x.message; }
  ok(/a is complex: use Re a, Im a or \|a\|/.test(e), 'a real-only field names the number: ' + e);
  e = ''; try { P.evalReal('i'); } catch (x) { e = x.message; }
  ok(/must be real/.test(e), 'a complex constant without a name keeps the old message');
  eq(P.evalReal('Re a + Im a'), 0, 'real-only fields read Re a and Im a');
  eq(P.evalVal('a + 1'), { re: 2, im: -1 }, 'evalVal');
  eq(P.set('a', 0.5), '', 'a real value clears the imaginary part');
  ok(!('im' in P.list()[0]) && !P.isComplex('a'), 'back to real: no im saved');
  P.set('a', { re: -0.5, im: 0.3 });
  for (const [re, im, txt] of [[0.5, 0.3, '0.5+0.3'], [-0.5, -0.3, '-0.5-0.3'], [0, 0.3, '0.3'], [0, 1, ''], [0, -1, '-'], [2, 1, '2+'], [1e-7, -2e-9, '1e-7-2e-9'], [-0, 0.5, '0.5']]) {
    P.set('a', { re, im });
    const r = P.resolve('a');
    ok(r === `(${txt}i)`, `resolve ${re},${im}: ${r}`);
    const v = Expr.constValue(r);
    ok(v.re === re && v.im === im, `resolve round trip ${re},${im}: ${v.re},${v.im}`);
  }
  P.set('a', 0.5);
  eq(P.resolve('2a'), '2(0.5)', 'a real number resolves as before');
  eq(P.resolve('a', { a: { re: 1, im: -1 } }), '(1-i)', 'resolve with a value override');
  P.set('a', { re: 1, im: 2 });
  const san2 = P.sanitize(JSON.parse(JSON.stringify(P.list())));
  eq(san2.find((q) => q.name === 'a').im, 2, 'sanitize keeps im');
  eq(P.sanitize([{ name: 'k', value: 1, im: 'x' }, { name: 'm', value: 1, im: 0 }]).map((q) => 'im' in q), [false, false], 'sanitize drops a bad or zero im');
  eq(P.sanitize(san2), san2, 'sanitize with im is idempotent');
  const cstate = { shapes: [], steps: [{ type: 'custom', params: { expr: 'a z' }, on: true }], params: san2 };
  eq(await P.decodeLink(await P.encodeLink(cstate)), cstate, 'a link with a complex number round-trips');
  eq(P.readScene(P.scene(cstate)), cstate, 'a scene with a complex number round-trips');
  // an older build reads the real part only: value is still the real part, nothing else is required of it
  eq(san2.find((q) => q.name === 'a').value, 1, 'the real part is the saved value');
  // inline: deleting a complex number writes its value into the formulas
  P.inline('a');
  eq(P.list().find((q) => q.name === 'b').expr, '(1+2i)^2', 'inline writes the complex value');
  ok(P.tex('a') !== undefined, 'tex of a name');
  // comparisons name a complex shared number instead of reading its real part (Re z < a, a = 0.5 + 0.3i)
  list.length = 0;
  P.add('a', { value: { re: 0.5, im: 0.3 } });
  const rel = (src) => Expr.classifyRelation(Expr.parse(src, { allowRel: true }));
  for (const src of ['Re z < a', 'a z < 1', 'Re z < 2a', 'Im z >= conj a']) {
    const r = rel(src);
    ok(r.dim === 'error' && /a is complex: use Re a, Im a or \|a\|/.test(r.error), `comparison ${src}: ${JSON.stringify(r)}`);
    let m = ''; try { Expr.compileLevel(Expr.parse(src, { allowRel: true })); } catch (e) { m = e.message; }
    ok(/a is complex/.test(m), `compileLevel ${src}: ${m}`);
  }
  for (const src of ['Re z < Re a', '|z - a| < 2', 'Re(z a) < 1', 'Im z < arg a', 'Re z < i', 'Re z < |a|']) ok(rel(src).dim === 'area', `comparison ${src} stays an area: ${JSON.stringify(rel(src))}`);
  ok(rel('Re z = a').dim === 'error', 'an equation with a complex number keeps its own message');
  P.set('a', 0.5);
  ok(rel('Re z < a').dim === 'area', 'the same comparison reads once a is real');
  // a number that is playing and becomes complex stops (and one that becomes real again)
  global.requestAnimationFrame = () => 0;
  P.add('q', { value: 1 });
  P.togglePlay('q');
  ok(P.isPlaying('q'), 'q plays');
  P.set('q', '1 + i');
  ok(!P.isPlaying('q'), 'editing a playing number into a complex value stops its play');
  P.set('q', 2);
  ok(!P.isPlaying('q'), 'and a real value does not restart it');
  console.log(`${n - fails}/${n} passed`);
  if (fails) process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
