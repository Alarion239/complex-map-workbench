// The split over the recognizer's corpus (LaTeX + plain): exactness against the formula, lamps, inverse ops, links.
const { split, setA } = require('./symtext.js');
const NOTES = '<project>/notes';
const corpus = require(NOTES + '/formula-recognition/tools/corpus_src.js');
const C = CX.C;

const PLAIN = ['e^(i*z)', 'e^(2z+1)', 'e^(z^2)', 'e^(1/z)', 'e^(a*z)', 'log(z-1)', 'ln z', 'log(z^2)', 'z^2', 'z^(1/2)', 'z^(1/3)', 'z^i', 'z^a', 'z^2.5', '(z+1)^1.5', 'sqrt(z^2)', '(z-i)/(z+i)', '(1+z)/(1-z)', '(a*z+1)/(z+a)', '(z+1/z)/2', '(z^2+1)/(2z)', '(z-1)*(z+1)', '(z^2-1)/(z^2+1)', 'sin(2z)', 'cos(z)/2', 'tan(z/2)', 'tg z', 'sin(e^z)', 'cos(log z)', 'sinh(z)', 'sh z', 'ch(z)', 'th z', 'arcsin(z)', 'arctg(z)', 'log(sin z)', '1/(1+e^(-z))', 'sin(z)+z', 'z*e^z', 'z^(1+i)', 'z^(0.5+2i)', 'z^(a+i)', 'z^0.5'];
const forms = corpus.map((e) => e.tex).concat(PLAIN);
let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const PTS = []; for (let i = 0; i < 300; i++) PTS.push(C((rnd() * 2 - 1) * 3.2, (rnd() * 2 - 1) * 3.2));
const ON = []; for (const x of [-2.5, -1, -0.5, 0.5, 1, 2.5]) ON.push(C(x, 0), C(0, x), C(x, -0), C(-0, x));
const close = (a, b, tol) => { const fa = CX.isFin(a), fb = CX.isFin(b); if (fa !== fb) return false; if (!fa) return true; return CX.abs(CX.sub(a, b)) <= tol * (1 + CX.abs(a)); };
const st = { forms: forms.length, cases: 0, recognized: 0, one: 0, multi: 0, partial: 0, kept: 0, refusedLink: 0, offFail: 0, onFail: 0, lampLost: 0, lampGained: 0, opsDiff: 0, linkCases: 0, linkFail: 0, nsteps: {} };
const fails = [];
for (const cut of [180, 90, -120, 540]) for (const q of forms) {
  st.cases++;
  let ast; try { ast = Expr.parse(q); } catch (e) { continue; }
  const b = Funcs.build({ type: 'custom', params: { expr: q, cut }, on: true });
  if (b.error || !b.rec) continue;
  st.recognized++;
  const r = split(q, cut);
  if (r.refuse) { st.refusedLink++; if (cut === 180) fails.push(['refused', q, r.refuse]); continue; }
  const n = r.steps.length; st.nsteps[n] = (st.nsteps[n] || 0) + 1;
  if (n === 1 && !r.steps[0].kept) st.one++; else st.multi++;
  if (r.partial) st.partial++;
  if (r.steps.some((s) => s.kept)) st.kept++;
  const vals = Recognize.hasParam(ast) ? [0.7, 0.31, 1.83, -0.4] : [0.7];
  if (vals.length > 1) st.linkCases++;
  for (const val of vals) {
    setA(val);
    const F = Expr.compile(Expr.parse(q), { theta: cut * Math.PI / 180 });
    const bs = r.steps.map((s) => Funcs.build(s));
    if (bs.some((x) => x.error)) { if (val !== 0.7) continue; st.offFail++; fails.push(['build', q, cut, bs.map((x) => x.error)]); break; }
    const f = (z) => { for (const x of bs) z = x.f(z); return z; };
    const off = PTS.filter((p) => !close(F(p), f(p), 1e-9)).length, on = ON.filter((p) => !close(F(p), f(p), 1e-9)).length;
    if (off) { st.offFail++; if (val !== 0.7) st.linkFail++; fails.push(['off', q, cut, val, off]); }
    if (on) { st.onFail++; fails.push(['on', q, cut, val, on]); }
    if (val === 0.7) {
      const cp = Funcs.composeProps(bs.map((x) => x.props));
      for (const k of Funcs.PROP_KEYS) { if (b.props[k] && !cp[k]) { st.lampLost++; fails.push(['lamp lost', q, cut, k]); } if (!b.props[k] && cp[k]) st.lampGained++; }
      const o1 = Inverse.stepOps(b), o2 = bs.map((x) => Inverse.stepOps(x));
      const k1 = o1.ok ? o1.ops.map((o) => o.kind).join(',') : 'none', k2 = o2.every((x) => x.ok) ? o2.flatMap((x) => x.ops.map((o) => o.kind)).join(',') : 'none';
      if (k1 !== k2) { st.opsDiff++; fails.push(['ops', q, cut, k1, k2]); }
    }
  }
  setA(0.7);
}
console.log(JSON.stringify(st));
const seen = new Set();
for (const f of fails) { const k = JSON.stringify(f.slice(0, 2)) + f[0]; if (seen.has(k)) continue; seen.add(k); console.log(JSON.stringify(f)); }
