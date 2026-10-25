// The deformation range (notes/deform-range/SPEC.md 13.1) against the shipped module src/homrange.js: the exact ends
// (H_0 = post o pre and H_end = F, bit for bit, every bracket and order, every focus), the GPU spec's CPU twin, the
// continuity at the segment nodes, today's maps and keys unchanged without a bracket, the normal form and the uid
// resolution of chain edits, and the worked numbers of design-math 10. Run: node test/t_deform_range.js
global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
try { global.Recognize = require('../src/recognize.js'); } catch (e) { /* optional */ }
const FN = require('../src/funcs.js');
const HomRange = require('../src/homrange.js');
const { C } = CX;
let checks = 0, failed = 0;
const check = (name, cond, got) => { checks++; if (!cond) { failed++; if (failed < 60) console.log('FAIL', name, got === undefined ? '' : JSON.stringify(got)); } };
const same = (x, y) => x === y || (Number.isNaN(x) && Number.isNaN(y));
const eqb = (u, v) => same(u.re, v.re) && same(u.im, v.im);

// a chain as the app holds it (app.js stepFn, isDeriv, stageF, rangeF), with the module on top
function chain(stepsIn) {
  let uidN = 0;
  const S = { focus: 0, homAll: false, steps: stepsIn.map((s) => ({ type: s.type, params: Object.assign(FN.defaults(s.type), s.params || {}), on: s.on !== false, uid: 'f' + (++uidN) })) };
  let built = [], stageFns = [];
  const rebuild = () => { built = S.steps.map((st) => FN.build(st)); stageFns = FN.stageFunctions(S.steps, built); };
  rebuild();
  const n = () => S.steps.length;
  const isDeriv = (k) => { const st = S.steps[k - 1], b = built[k - 1]; return !!st && st.on !== false && !!b && !b.error && (st.type === 'deriv' || b.op === 'deriv'); };
  const stepFn = (k) => { const st = S.steps[k - 1], b = built[k - 1]; if (!st || st.on === false || !b || b.error || isDeriv(k) || typeof b.f !== 'function') return null; return b.f; };
  const stepActive = (k) => !!stepFn(k) || isDeriv(k);
  const stageF = (k) => stageFns[Math.max(0, Math.min(n(), k))] || ((z) => z);
  const derivIn = (a, b) => { for (let k = a + 1; k <= b; k++) if (isDeriv(k)) return true; return false; };
  const rangeF = (a, b) => { if (!a) return stageF(b); if (derivIn(a, b)) return () => C(NaN, NaN); const fs = []; for (let i = a + 1; i <= b; i++) { const f = stepFn(i); if (f) fs.push(f); } return (z) => { for (const f of fs) z = f(z); return z; }; };
  const HR = HomRange.make({ n, stepFn, isDeriv, stepActive, stageF, rangeF, built: () => built, C });
  return { S, HR, n, stageF, rangeF, isDeriv, stepFn, stepActive, rebuild, get built() { return built; } };
}
// the v15.2 morphState (app.js before v16), for "today unchanged": the map and the key
function v152(ch, T, rel) {
  const S = ch.S, n = ch.n(), stepActive = ch.stepActive, isDeriv = ch.isDeriv;
  const steps = S.focus > 0 ? (stepActive(S.focus) ? [S.focus] : []) : Array.from({ length: n }, (_, i) => i + 1).filter(stepActive);
  const m = steps.length, base = S.focus > 0 ? S.focus - 1 : 0, end = S.focus > 0 ? S.focus : n;
  const leftStage = S.focus === 0 || isDeriv(S.focus) ? 0 : S.focus - 1, pb = rel ? leftStage : 0;
  const tag = (map) => { if (pb) map.base = pb; return map; };
  if (m === 0) return { map: tag({ mode: 0, a: pb, b: base }), key: `none|${pb}|${base}` };
  if (!!S.homAll && m > 1 && !steps.some(isDeriv)) { const t = Math.max(0, Math.min(1, T)); return { map: tag({ mode: 3, a: base, b: end, t }), key: `all|${pb}|${base}|${end}|${t}` }; }
  const TT = Math.max(0, Math.min(m, T)), j = Math.min(m - 1, Math.floor(TT)), t = TT - j, k = steps[j];
  return { map: tag({ mode: 1, hi: k, t }), key: `nat|${pb}|${k}|${t}` };
}

let seed = 11;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
// 400 points: a 20 x 20 grid over [-3, 3]^2, jittered, kept 1e-6 off the axes (the cuts of these chains lie on them)
const PTS = [];
for (let i = 0; i < 20; i++) for (let j = 0; j < 20; j++) {
  let x = -3 + 6 * (i + 0.5 + 0.3 * (rnd() - 0.5)) / 20, y = -3 + 6 * (j + 0.5 + 0.3 * (rnd() - 0.5)) / 20;
  if (Math.abs(x) < 1e-6) x += 2e-6; if (Math.abs(y) < 1e-6) y += 2e-6;
  PTS.push(C(x, y));
}
const MOB = { a: '1', b: '-1', c: '1', d: '1' };
const CHAINS = {
  chain3: [{ type: 'exp' }, { type: 'mobius', params: MOB }, { type: 'pown', params: { n: 2 } }],
  sinsqrt: [{ type: 'root', params: { n: 2 } }, { type: 'sin' }],
  sinsqrt90: [{ type: 'root', params: { n: 2, cut: -90 } }, { type: 'sin' }],
  moblog: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' } }, { type: 'log' }],
  deriv: [{ type: 'pown', params: { n: 2 } }, { type: 'deriv' }, { type: 'exp' }],
  bypass: [{ type: 'exp' }, { type: 'sin', on: false }, { type: 'mobius', params: MOB }, { type: 'pown', params: { n: 2 } }],
};

let cases = 0, endsOk = 0;
for (const [name, list] of Object.entries(CHAINS)) {
  const ch = chain(list), n = ch.n();
  const runs = [];
  for (let a = 1; a <= n; a++) for (let b = a; b <= n; b++) for (const all of [false, true]) runs.push({ focus: 0, r: { a, b }, all });
  for (let k = 1; k <= n; k++) for (const all of [false, true]) runs.push({ focus: k, r: null, all });
  for (const all of [false, true]) runs.push({ focus: 0, r: null, all });
  for (const run of runs) {
    const S = ch.S;
    S.focus = run.focus; S.homAll = run.all;
    if (run.r) S.homRange = { a: run.r.a, b: run.r.b }; else delete S.homRange;
    const R = ch.HR.range(S), m = R.steps.length;
    if (!m) continue;
    const all = ch.HR.allAtOnce(S, R), end = all ? 1 : m;
    const tag = `${name} focus ${run.focus} ${run.r ? run.r.a + '…' + run.r.b : 'every'}${all ? ' all' : ''}`;
    const s0 = ch.HR.state(S, 0, false), sE = ch.HR.state(S, end, false), sM = ch.HR.state(S, 0.37 * end, false);
    const pre = ch.stageF(R.lo), post = ch.rangeF(R.b, R.p1), F = ch.stageF(R.p1);
    let ok0 = 0, okE = 0, twin = 0, twin0 = 0, twinE = 0;
    const tw0 = ch.HR.cpuMap(s0.map), twE = ch.HR.cpuMap(sE.map), twM = ch.HR.cpuMap(sM.map);
    for (const z of PTS) {
      if (eqb(s0.F(z), post(pre(z)))) ok0++;
      if (eqb(sE.F(z), F(z))) okE++;
      if (eqb(twM(z), sM.F(z))) twin++;
      if (eqb(tw0(z), s0.F(z))) twin0++;
      if (eqb(twE(z), sE.F(z))) twinE++;
      if (eqb(s0.H0F(z), s0.F(z))) twin0 += 0;   // (H0F is checked below)
    }
    cases++;
    check(`${tag}: H_0 = post o pre bit for bit`, ok0 === PTS.length, `${ok0}/${PTS.length}`);
    check(`${tag}: H_end = F bit for bit`, okE === PTS.length, `${okE}/${PTS.length}`);
    if (ok0 === PTS.length && okE === PTS.length) endsOk++;
    check(`${tag}: cpuMap twin at 0.37 end`, twin === PTS.length, `${twin}/${PTS.length}`);
    check(`${tag}: cpuMap twin at 0 and end`, twin0 === PTS.length && twinE === PTS.length, [twin0, twinE]);
    // H0F and H0Map are the start
    const h0 = ch.HR.cpuMap(s0.H0Map);
    let hOk = 0;
    for (const z of PTS) if (eqb(s0.H0F(z), post(pre(z))) && eqb(h0(z), s0.H0F(z))) hOk++;
    check(`${tag}: H0F and H0Map are post o pre`, hOk === PTS.length, `${hOk}/${PTS.length}`);
    // continuity at the nodes t = j (one after another)
    if (!all && m > 1) {
      let worst = 0;
      for (let j = 1; j < m; j++) {
        const A = ch.HR.state(S, j - 1e-9, false).F, B = ch.HR.state(S, j + 1e-9, false).F;
        for (const z of PTS) { const u = A(z), v = B(z); if (CX.isFin(u) && CX.isFin(v)) worst = Math.max(worst, CX.abs(CX.sub(u, v)) / (1 + CX.abs(v))); }
      }
      check(`${tag}: continuous at the nodes`, worst <= 1e-6, worst);
    }
    // today unchanged: no bracket, or at focus k
    if (!run.r) for (const T of [0, 0.5 * end, end]) for (const rel of [false, true]) {
      const o = v152(ch, T, rel), s = ch.HR.state(S, T, rel);
      check(`${tag} T ${T} rel ${rel}: v15.2 map`, JSON.stringify(o.map) === JSON.stringify(s.map), [o.map, s.map]);
      check(`${tag} T ${T} rel ${rel}: v15.2 key + |lo|b|p1`, s.key === `${o.key}|${R.lo}|${R.b}|${R.p1}`, [o.key, s.key]);
    }
  }
  ch.S.focus = 0; ch.S.homAll = false; delete ch.S.homRange;
}
check('the cases ran', cases >= 24, cases);

// the user's cases
{
  const ch = chain(CHAINS.chain3), S = ch.S;
  S.homRange = { a: 2, b: 3 };
  let st = ch.HR.state(S, 0.5, false);
  check('push-forward f2–f3: mode 1, hi 2, no post', st.map.mode === 1 && st.map.hi === 2 && !('post' in st.map), st.map);
  S.homAll = true; st = ch.HR.state(S, 0.5, false);
  check('push-forward all at once: mode 3, a 1, b 3', st.map.mode === 3 && st.map.a === 1 && st.map.b === 3 && !('post' in st.map), st.map);
  S.homAll = false; S.homRange = { a: 1, b: 2 };
  st = ch.HR.state(S, 0.5, false);
  check('pullback f1–f2: post 3, b 2', st.map.mode === 1 && st.map.hi === 1 && st.map.post === 3 && st.map.b === 2, st.map);
  st = ch.HR.state(S, 1.5, false);
  check('pullback f1–f2 at 1.5: hi 2, post 3', st.map.hi === 2 && st.map.post === 3, st.map);
  const sq = chain([{ type: 'pown', params: { n: 2 } }]);
  let ok = 0;
  st = ch.HR.state(S, 0, false);
  for (const z of PTS) if (eqb(st.F(z), sq.stageF(1)(z))) ok++;
  check('pullback at t = 0 is the square alone', ok === PTS.length, ok);
}
{
  const ch = chain(CHAINS.sinsqrt), S = ch.S, sin = chain([{ type: 'sin' }]);
  S.homRange = { a: 1, b: 1 };
  const s0 = ch.HR.state(S, 0, false), s1 = ch.HR.state(S, 1, false);
  let a = 0, b = 0;
  for (const z of PTS) { if (eqb(s0.F(z), sin.stageF(1)(z))) a++; if (eqb(s1.F(z), ch.stageF(2)(z))) b++; }
  check('sin o sqrt 1…1: H_0 = sin z, H_1 = sin sqrt z', a === PTS.length && b === PTS.length, [a, b]);
  check('sin o sqrt 1…1: the map has post 2, b 1', s0.map.post === 2 && s0.map.b === 1, s0.map);
  // worked numbers: H_t((k pi)^{1/s}) = 0, s = 1 - t/2
  for (const t of [0.25, 0.5, 0.75]) for (const k of [1, 2]) {
    const s = 1 - t / 2, z = C(Math.pow(k * Math.PI, 1 / s), 0), H = ch.HR.state(S, t, false).F(z);
    check(`sin o sqrt zero at t ${t}, k ${k}`, CX.abs(H) <= 1e-9, CX.abs(H));
  }
}
{
  const ch = chain(CHAINS.moblog), S = ch.S;
  S.homRange = { a: 1, b: 1 };
  const H = ch.HR.state(S, 0.5, false).F(C(2, 1));
  check('Möbius-log: H_1/2(2 + i) = 0', CX.abs(H) <= 1e-9, CX.abs(H));
}
{
  const ch = chain(CHAINS.chain3), S = ch.S;
  S.homRange = { a: 1, b: 1 };
  for (const t of [0.3, 0.5]) {
    const z = C(Math.log(1 - t - t * t) / t, 0), H = ch.HR.state(S, t, false).F(z);
    check(`chain3 1…1: the pole at log(1 - t - t^2)/t, t ${t}`, !CX.isFin(H) || CX.abs(H) >= 1e12, CX.abs(H));
  }
}

// normal form and resolution
{
  const ch = chain(CHAINS.chain3), S = ch.S;
  S.homRange = { a: 1, b: 3 }; check('every step inside: null, dropped', ch.HR.resolve(S) === null && !('homRange' in S), S.homRange);
  const by = chain(CHAINS.bypass);
  by.S.homRange = { a: 2, b: 2 }; check('no active step inside: null', by.HR.resolve(by.S) === null, by.S.homRange);
  by.S.homRange = { a: 2, b: 4 }; check('bypassed f2: 2…4 holds f3, f4 and f1 outside', JSON.stringify(by.HR.resolve(by.S)) === '{"a":2,"b":4}', by.S.homRange);
  by.S.homRange = { a: 1, b: 2 }; check('bypassed f2: 1…2 holds f1 only', JSON.stringify(by.HR.resolve(by.S)) === '{"a":1,"b":2}', by.S.homRange);
  const d = chain(CHAINS.deriv);
  d.S.homRange = { a: 1, b: 1 }; const r = d.HR.resolve(d.S);
  check('a d/dz after b moves b: 1…1 -> 1…2', r && r.a === 1 && r.b === 2, r);
  d.S.homRange = { a: 3, b: 3 }; check('d/dz in the pre: 3…3 kept', JSON.stringify(d.HR.resolve(d.S)) === '{"a":3,"b":3}', d.S.homRange);
  check('stops: the right end stops at the d/dz', JSON.stringify(d.HR.stops(Object.assign(d.S, { homRange: { a: 1, b: 2 } })).okB) === '[2,3]', d.HR.stops(d.S));
  check('a > b is swapped', (() => { S.homRange = { a: 2, b: 1 }; const q = ch.HR.resolve(S); return q && q.a === 1 && q.b === 2; })(), S.homRange);
  // the written form: ua null at the chain's start, ub null at its end
  S.homRange = { a: 2, b: 3 }; ch.HR.resolve(S);
  check('written: {a 2, b 3, ua f2, ub null}', JSON.stringify(S.homRange) === '{"a":2,"b":3,"ua":"f2","ub":null}', S.homRange);
  // focus k: kept, ignored
  S.focus = 2; check('focus k: ignored, kept', ch.HR.resolve(S) === null && S.homRange && S.homRange.a === 2, S.homRange); S.focus = 0;
}
// chain edits by uid
{
  const mk = () => chain([{ type: 'exp' }, { type: 'sin' }, { type: 'cos' }, { type: 'tan' }, { type: 'sinh' }]);
  let ch = mk(), S = ch.S;
  const edit = (f) => { f(S.steps); ch.rebuild(); return ch.HR.resolve(S); };
  const set = (a, b) => { S.homRange = { a, b }; ch.HR.resolve(S); };
  set(2, 3);
  let r = edit((st) => st.splice(2, 0, { type: 'cosh', params: FN.defaults('cosh'), on: true, uid: 'f9' }));
  check('insert inside: joins', r && r.a === 2 && r.b === 4, r);
  ch = mk(); S = ch.S; set(2, 3);
  r = edit((st) => st.splice(0, 0, { type: 'cosh', params: FN.defaults('cosh'), on: true, uid: 'f9' }));
  check('insert before: shifts', r && r.a === 3 && r.b === 4, r);
  ch = mk(); S = ch.S; set(3, 5);
  r = edit((st) => st.push({ type: 'cosh', params: FN.defaults('cosh'), on: true, uid: 'f9' }));
  check('append at the chain\'s end: joins', r && r.a === 3 && r.b === 6, r);
  ch = mk(); S = ch.S; set(1, 2);
  r = edit((st) => st.unshift({ type: 'cosh', params: FN.defaults('cosh'), on: true, uid: 'f9' }));
  check('prepend at the chain\'s start: joins', r && r.a === 1 && r.b === 3, r);
  ch = mk(); S = ch.S; set(2, 3);
  r = edit((st) => st.splice(1, 1));
  check('remove the left end: keeps the index, shrinks', r && r.a === 2 && r.b === 2, r);
  ch = mk(); S = ch.S; set(2, 3);
  r = edit((st) => { const [x] = st.splice(1, 1); st.splice(3, 0, x); });   // f2 moved after f4: [f1 f3 f4 f2 f5]
  check('move an end across the other: their span', r && r.a === 2 && r.b === 4, r);
  ch = mk(); S = ch.S; set(2, 4);
  r = edit((st) => { st.splice(3, 1, { type: 'cosh', params: FN.defaults('cosh'), on: true, uid: 'f7' }, { type: 'tanh', params: FN.defaults('tanh'), on: true, uid: 'f8' }); if (S.homRange.ub === 'f4') S.homRange.ub = 'f8'; });
  check('split at ub (the split hook): every new step joins', r && r.a === 2 && r.b === 5, r);
  ch = mk(); S = ch.S; S.homRange = { a: 2, b: 3 };
  r = ch.HR.resolve(S);
  check('a state without ua/ub loads by index', r && r.a === 2 && r.b === 3, r);
  ch = mk(); S = ch.S; set(2, 5);
  r = edit((st) => { st[0].on = false; });
  check('bypass to normal form: the setting is dropped', r === null && !('homRange' in S), S.homRange);
}

console.log(`t_deform_range: ${checks} checks, ${failed} failed; ${cases} cases (exact ends in ${endsOk})`);
process.exit(failed ? 1 : 0);
