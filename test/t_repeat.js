// Repeat × N (issue #6, part B): step.repeat = {n, len} on the last step of a block runs the block n times
// (Funcs.applyRepeats). Its values against a plain loop, its guarantees (degree d^n, a Möbius map stays one), its
// deformation copy by copy, the inverse renderer's ops (the block's ops n times), the TeX, d/dz after it (the circle
// formula), bypassed steps, and the refusals (a d/dz inside, too many steps).
// Run: node test/t_repeat.js   (exit code 1 on any failure)
global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
global.Funcs = require('../src/funcs.js');
global.Region = require('../src/region.js');
const Inverse = require('../src/inverse.js');
const C = CX.C;
let bad = 0, n = 0;
const check = (name, ok, info = '') => { n++; if (!ok) { bad++; console.log('FAIL', name, info); } };
const rel = (a, b) => CX.abs(CX.sub(a, b)) / Math.max(CX.abs(b), 1e-300);
const S = (type, params = {}, on = true) => ({ type, params: Object.assign(Funcs.defaults(type), params), on });
const Rp = (st, n, len) => Object.assign(st, { repeat: { n, len } });
const chain = (steps) => { const built = Funcs.applyRepeats(steps, steps.map((s) => Funcs.build(s))); return { steps, built, G: Funcs.stageFunctions(steps, built) }; };
const c = C(0.2, 0.1), sq = (u) => CX.add(CX.mul(u, u), c);

// ---- 1. values and stages
const A = chain([S('pown', { n: 2 }), Rp(S('add', { c: '0.2+0.1i' }), 3, 2)]);
for (const z of [C(0.3, 0.4), C(-0.5, 0.2), C(1.1, -0.7)]) check(`(z² + c)∘3 at ${z.re}${z.im >= 0 ? '+' : ''}${z.im}i`, rel(A.G[2](z), sq(sq(sq(z)))) < 1e-14);
check('the stage before the repeat\'s last step is the first pass (w₁ = z²)', rel(A.G[1](C(0.3, 0.4)), CX.mul(C(0.3, 0.4), C(0.3, 0.4))) < 1e-15);
check('n = 1 is the step itself', chain([S('pown', { n: 2 }), Rp(S('add', { c: '1' }), 1, 2)]).built[1].repeat === undefined);
const B = chain([S('sin'), S('pown', { n: 3 }, false), Rp(S('mul', { c: '0.7+0.2i' }), 3, 3)]);
const m = C(0.7, 0.2), zb = C(0.4, -0.3);
check('a bypassed step inside the block stays out of every pass', rel(B.G[3](zb), CX.mul(m, CX.sin(CX.mul(m, CX.sin(CX.mul(m, CX.sin(zb))))))) < 1e-14);
check('a bypassed last step: no repeat', chain([S('pown', { n: 2 }), Rp(S('add', { c: '1' }, false), 3, 2)]).built[1].repeat === undefined);

// ---- 2. guarantees
const pA = A.built[1].props;
check('z² + c three times ends in degree 4 at f₂ (f₂ then the block twice), F of degree 8', pA.polynomial && pA.deg === 4 && pA.degExact, JSON.stringify(pA));
const M = chain([Rp(S('mobius', { a: '1', b: '0.3', c: '-0.3', d: '1' }), 4, 1)]);
check('a Möbius map four times is a Möbius map, injective', M.built[0].props.mobius && M.built[0].props.injective && M.built[0].props.deg === 1);
check('exp twice is entire, not a polynomial', (() => { const p = chain([Rp(S('exp'), 2, 1)]).built[0].props; return p.entire && !p.polynomial; })());

// ---- 3. deformation copy by copy: 2 + 2·2 = 6 steps after f₂ … at t = 1/6 f₂ has run, at 1 the whole tail
const b2 = A.built[1], z0 = C(0.3, 0.4), w1 = A.G[1](z0);
check('the deformation runs 1 + 2·2 steps', b2.nat && b2.nat.n === 5, JSON.stringify(b2.nat));
check('H₀ is the identity, H₁ the tail', rel(b2.hom(0)(w1), w1) === 0 && rel(b2.hom(1)(w1), A.G[2](z0)) < 1e-15);
check('at t = 1/5: f₂ alone has run', rel(b2.hom(0.2)(w1), CX.add(w1, c)) < 1e-14);
check('at t = 2/5: then z² once more', rel(b2.hom(0.4)(w1), CX.mul(CX.add(w1, c), CX.add(w1, c))) < 1e-13);

// ---- 4. the inverse renderer, the TeX, d/dz
const pl = Inverse.planChain(M.steps, M.built);
check('a repeated Möbius map: the exact renderer inverts it (four Möbius ops)', pl.ok, pl.reason);
check('z² + c three times: the exact renderer\'s plan', Inverse.planChain(A.steps, A.built).ok);
const tx = A.built[1].tex({ s: 'w_1', p: 4 }).s;
check('TeX: (f₂ ∘ ⋯ ∘ f₁)^{∘3}(w₁) = (f₂ ∘ ⋯ ∘ f₁)^{∘2}(w₁ + c): the true count, then the first pass written out', /^\\left\(f_\{2\}\\circ\\cdots\\circ f_\{1\}\\right\)\^\{\\circ 3\}\\!\\left\(w_1\\right\)=\\left\(f_\{2\}\\circ\\cdots\\circ f_\{1\}\\right\)\^\{\\circ 2\}/.test(tx) && tx.includes('w_1'), tx);
const M2 = chain([Rp(S('mobius', { a: '1', b: '0.3', c: '-0.3', d: '1' }), 2, 1)]);
const tx2 = M2.built[0].tex({ s: 'w_0', p: 4 }).s;
check('N = 2: no "∘1" anywhere (f^{∘2}(w) = f(…))', !/circ 1(?!\d)/.test(tx2) && /circ 2/.test(tx2), tx2);
check('the repeat has no inverse step, and says why', A.built[1].inverse === null && /copy by copy/.test(A.built[1].inverseNote));
const D = chain([S('pown', { n: 2 }), Rp(S('add', { c: '0.2+0.1i' }), 2, 2), S('deriv')]);
const zd = C(0.3, 0.2), h = 1e-6, F2 = D.G[2];
const fd = CX.scale(CX.sub(F2(CX.add(zd, C(h, 0))), F2(CX.sub(zd, C(h, 0)))), 1 / (2 * h));
check('d/dz after a repeat (the circle formula) against a difference quotient', rel(D.G[3](zd), fd) < 1e-5, `${D.G[3](zd).re} ${fd.re}`);
check('no derivative formula for the repeat itself, in words', /numerically/.test(Funcs.derivAst(D.built[1]).error || ''));

// ---- 5. refusals
const E1 = chain([S('exp'), S('deriv'), Rp(S('sin'), 2, 3)]).built[2];
check('a d/dz inside the block is refused', !!E1.error && /d\/dz/.test(E1.error), JSON.stringify(E1.error));
const E2 = chain([S('exp'), S('sin'), S('cos'), S('tan'), S('sinh'), Rp(S('cosh'), 64, 6)]).built[5];
check('more than 256 steps in all is refused, naming the largest N', !!E2.error && /at most N = 42/.test(E2.error), JSON.stringify(E2.error));
const E3 = chain([Rp(S('zeta'), 20, 1)]).built[0];
check('a heavy step weighs more: ζ twenty times is refused, at most N = 16', !!E3.error && /at most N = 16/.test(E3.error), JSON.stringify(E3.error));
check('ζ sixteen times is drawn', !chain([Rp(S('zeta'), 16, 1)]).built[0].error);
check('repeatOk: a len past the chain\'s start is no repeat', Funcs.repeatOk([Rp(S('exp'), 2, 3)], 1) === null);

// ---- 6. N bound to a shared number (repeat.by): its value rounded, 1 … REPEAT_MAX; the stored n without it
Expr.setNames({ get: (nm) => ({ k: 2.6, big: 1000, neg: -3 })[nm], display: (nm) => nm });
const byN = (by) => Funcs.repeatOk([S('exp'), Rp(S('sin'), 2, 2)].map((st, i) => (i === 1 ? Object.assign(st, { repeat: { n: 2, len: 2, by } }) : st)), 2);
check('by k = 2.6: three passes', byN('k').n === 3);
check('by a large number: at most REPEAT_MAX', byN('big').n === Funcs.REPEAT_MAX);
check('by a negative number: one pass', byN('neg').n === 1);
check('by a number that is gone: the stored n', byN('gone').n === 2);
Expr.setNames(null);
console.log(bad ? `${bad} of ${n} checks fail` : `all ${n} checks pass`);
process.exit(bad ? 1 : 0);
