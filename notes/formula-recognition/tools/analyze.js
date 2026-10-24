// node analyze.js <repo> <corpus_src.js> <out.json>
const [R, SRC, OUT] = process.argv.slice(2);
global.CX = require(R + '/src/cx.js'); global.Expr = require(R + '/src/parse.js');
global.Funcs = require(R + '/src/funcs.js'); global.Region = require(R + '/src/region.js');
const Inverse = require(R + '/src/inverse.js');
const C = CX.C;
const A = 0.7;
Expr.setNames({ get: (n) => (n === 'a' ? A : undefined), display: (n) => n });
const corpus = require(SRC);
const PLAIN = {
  exp6: 'e^(i*z)', exp7: 'e^(2z+1)', exp12: 'e^(z^2)', exp13: 'e^(1/z)', exp15: 'e^(a*z)', log6: 'log(z-1)', log2: 'ln z', log9: 'log(z^2)',
  pow1: 'z^2', pow7: 'z^(1/2)', pow10: 'z^(1/3)', pow12: 'z^i', pow14: 'z^a', pow13: 'z^2.5', pow20: '(z+1)^1.5', pow15: 'sqrt(z^2)',
  mob3: '(z-i)/(z+i)', mob5: '(1+z)/(1-z)', mob7: '(a*z+1)/(z+a)', jk1: '(z+1/z)/2', jk4: '(z^2+1)/(2z)', rat2: '(z-1)*(z+1)', rat4: '(z^2-1)/(z^2+1)',
  tr4: 'sin(2z)', tr6: 'cos(z)/2', tr7: 'tan(z/2)', tr9: 'tg z', tr18: 'sin(e^z)', tr19: 'cos(log z)', hy1: 'sinh(z)', hy4: 'sh z', hy5: 'ch(z)', hy6: 'th z',
  it1: 'arcsin(z)', it4: 'arctg(z)', log15: 'log(sin z)', mi16: '1/(1+e^(-z))', tr21: 'sin(z)+z', exp24: 'z*e^z',
};
const EXTRA = [
  ['pow25', 'z^{1+i}', [{ type: 'powa', params: { alpha: '1+i', cut: 180, k: 0 } }], 'exact', 'the user case', 'z^(1+i)'],
  ['pow26', 'z^{0.5+2i}', [{ type: 'powa', params: { alpha: '0.5+2i', cut: 180, k: 0 } }], 'exact', 'the user case', 'z^(0.5+2i)'],
  ['pow27', 'z^{a+i}', [{ type: 'powa', params: { alpha: 'a+i', cut: 180, k: 0 } }], 'exact', 'shared a, complex exponent', 'z^(a+i)'],
  ['pow28', 'z^{0.5}', [{ type: 'root', params: { n: 2, cut: 180, k: 0 } }], 'exact', 'as sqrt: same values on cut 180', 'z^0.5'],
  ['mob15', '\\frac{az+b}{cz+d}', null, 'none', 'needs four shared numbers (a,b,c,d): only a is defined in this audit', null],
];
const all = corpus.map((e) => Object.assign({}, e, { plain: PLAIN[e.id] || null }))
  .concat(EXTRA.map(([id, tex, chain, kind, note, plain]) => ({ id, tex, chain, kind, note, plain })));
const lit = (P) => Object.entries(P || {}).filter(([k, v]) => v === true && ['analytic', 'entire', 'rational', 'polynomial', 'mobius', 'proper', 'injective'].includes(k)).map(([k]) => k).join(',');
const opsOf = (b) => { const r = Inverse.stepOps(b); return r.ok ? r.ops.map((o) => o.kind).join('+') : 'INEL: ' + r.reason; };
function info(step) {
  const b = Funcs.build(Object.assign({ on: true }, step, { params: Object.assign(Funcs.defaults(step.type), step.params || {}) }));
  if (b.error) return { b, err: b.error };
  return { b, ops: opsOf(b), nat: b.nat ? b.nat.kind + (b.nat.fn ? ':' + b.nat.fn : '') : (step.type === 'custom' ? 'line' : 'own:' + step.type), props: lit(b.props), cuts: (b.cuts || []).length, usesCut: !!b.usesCut };
}
function chainInfo(chain) {
  const steps = chain.map((s) => Object.assign({ on: true }, s, { params: Object.assign(Funcs.defaults(s.type), s.params || {}) }));
  const built = steps.map(Funcs.build);
  const plan = Inverse.planChain(steps, built, 0, steps.length);
  return {
    built, steps,
    ops: plan.ok ? plan.ops.map((o) => o.kind).join('+') : 'INEL: ' + plan.reason,
    nat: built.map((b) => (b.error ? 'ERR ' + b.error : b.nat ? b.nat.kind + (b.nat.fn ? ':' + b.nat.fn : '') : 'own:' + b.def.id)).join(' | '),
    props: built.map((b) => lit(b.props)).join(' | '),
    cuts: built.reduce((s, b) => s + (b.cuts || []).length, 0),
    f: (z) => built.reduce((u, b) => b.f(u), z),
  };
}
// sample points: a grid, and pairs straddling the negative real axis (the default cut) and the real/imag axes
let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const pts = [];
for (let i = 0; i < 300; i++) pts.push(C((rnd() * 2 - 1) * 3, (rnd() * 2 - 1) * 3));
for (const x of [-2.7, -1.6, -0.9, -0.3, 0.4, 1.3, 2.2]) for (const s of [1, -1]) { pts.push(C(x, s * 1e-7)); pts.push(C(s * 1e-7, x)); }
function compare(f, g) {
  let n = 0, bad = 0, max = 0; const where = [];
  for (const p of pts) {
    const u = f(p), v = g(p);
    const fu = CX.isFin(u), fv = CX.isFin(v);
    if (!fu && !fv) continue;
    n++;
    if (fu !== fv) { bad++; if (where.length < 3) where.push(CX.fmt(p, 4) + (fu ? ' catalog undefined' : ' formula undefined')); continue; }
    const e = CX.abs(CX.sub(u, v)) / (1 + CX.abs(v));
    if (e > max) max = e;
    if (e > 1e-9) { bad++; if (where.length < 3) where.push(CX.fmt(p, 4)); }
  }
  return { n, bad, maxRel: +max.toPrecision(3), where };
}
const out = [];
for (const e of all) {
  const row = { id: e.id, tex: e.tex, plain: e.plain, kind: e.kind, chain: e.chain, note: e.note };
  const t = info({ type: 'custom', params: { expr: e.tex, cut: 180 } });
  row.today = t.err ? { err: t.err } : { ops: t.ops, nat: t.nat, props: t.props, cutsDrawn: t.cuts, usesCut: t.usesCut };
  if (e.plain) {
    const p = info({ type: 'custom', params: { expr: e.plain, cut: 180 } });
    let same = null;
    try { same = JSON.stringify(Expr.parse(e.plain), (k, v) => (k === 'pos' || k === 'len' || k === 'lit' ? undefined : v)) === JSON.stringify(Expr.parse(e.tex), (k, v) => (k === 'pos' || k === 'len' || k === 'lit' ? undefined : v)); } catch (x) { same = 'parse error'; }
    row.plainToday = p.err ? { err: p.err } : { ops: p.ops, nat: p.nat, props: p.props, sameAst: same, values: t.b && !t.err ? compare(p.b.f, t.b.f) : null };
  }
  if (e.chain && e.chain.length) {
    const ci = chainInfo(e.chain);
    row.catalog = { ops: ci.ops, nat: ci.nat, props: ci.props, cutsDrawn: ci.cuts };
    if (!t.err) row.values = compare(t.b.f, ci.f);
  } else if (e.chain && !e.chain.length) row.catalog = { identity: true };
  out.push(row);
}
require('fs').writeFileSync(OUT, JSON.stringify(out, null, 1));
// summary
const cnt = (pred) => out.filter(pred).length;
console.log('entries', out.length, 'with chain', cnt((r) => r.catalog && !r.catalog.identity));
console.log('today errors', out.filter((r) => r.today.err).map((r) => r.id + ':' + r.tex + ' -> ' + r.today.err).join('\n  '));
for (const r of out) {
  const c = r.catalog || {};
  const vm = r.values ? (r.values.bad ? `VAL ${r.values.bad}/${r.values.n} max ${r.values.maxRel} @ ${r.values.where.join('; ')}` : 'val=') : '';
  console.log([r.id, r.kind, r.tex, '| today', r.today.ops, r.today.nat, '[' + r.today.props + ']', 'cuts' + r.today.cutsDrawn, '| cat', c.ops, c.nat, '[' + c.props + ']', 'cuts' + c.cutsDrawn, '|', vm,
    r.plainToday ? '| plain ' + r.plain + ' ' + (r.plainToday.err ? 'ERR ' + r.plainToday.err : (r.plainToday.sameAst === true ? 'sameAST' : 'diffAST ' + r.plainToday.ops + ' ' + r.plainToday.nat) + (r.plainToday.values && r.plainToday.values.bad ? ' VAL ' + r.plainToday.values.bad : '')) : ''].join(' '));
}
