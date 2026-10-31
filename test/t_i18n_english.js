// node test/t_i18n_english.js : English stays byte-identical. The same calls run in the base (notes/gate-morph-zp-r1/src,
// before the strings were wrapped) and in src/ with i18n.js and the Russian table loaded and the language English;
// every string they return or throw must be the same. Covered: the catalog (groups, labels, presets, parameter labels,
// menu TeX, each step's TeX, domain, branch and inverse notes, homotopy captions with several names), the build,
// zeros-and-poles and derivative messages, the parser's messages, inverses and derivatives, the relation classifier,
// region shapes (labels and TeX), curve notes and errors, the integrals' errors, and the number formatters.
'use strict';
const vm = require('vm'), path = require('path');
const { source } = require('./src_text');   // (gl.js: src/gl/*.js joined, as build.py does; a snapshot holds it whole)
const ROOT = path.join(__dirname, '..');
const BASE = require('../ci/snapshots').snapshotDir('notes/gate-morph-zp-r1');   // (missing: says to run ci/snapshots.js)
const MODS = ['cx', 'parse', 'derivs', 'natpaths', 'sheets', 'funcs', 'invops', 'invpatterns', 'inverse', 'calc', 'glsl', 'regionlines', 'region', 'curves'];
const NAMES = { cx: 'CX', parse: 'Expr', derivs: 'Derivs', natpaths: 'NatPaths', sheets: 'Sheets', funcs: 'Funcs', invops: 'InvOps', invpatterns: 'InvPatterns', inverse: 'Inverse', calc: 'Calc', glsl: 'GLChain', regionlines: 'RegionLines', region: 'Region', curves: 'Curves' };
// (src/ no longer checks whether a module is there, issue #20 phase 3: src/'s contexts get the stand-ins of
// test/module_stubs.js for the modules not loaded, a recognizer that reads nothing, as the base, which had none, so both
// sides offer the same)
const NO_RECOGNIZER = require('fs').readFileSync(path.join(__dirname, 'module_stubs.js'), 'utf8');
function load(dir, files) {
  const ctx = { console, performance: { now: () => 0 }, setTimeout, clearTimeout, Intl };
  vm.createContext(ctx);
  if (dir !== BASE) vm.runInContext(NO_RECOGNIZER, ctx);
  // (the base's funcs.js, inverse.js and region.js still hold derivs.js, natpaths.js, sheets.js, invops.js,
  // invpatterns.js and regionlines.js, issue #20)
  for (const f of files.filter((m) => dir !== BASE || !['derivs', 'natpaths', 'invops', 'invpatterns', 'regionlines', 'sheets'].includes(m))) vm.runInContext(source(f + '.js', dir, { esm: 'strip' }) + (NAMES[f] ? `\n;globalThis.${NAMES[f]} = ${NAMES[f]};` : ''), ctx, { filename: f + '.js' });
  return ctx;
}
// gl.js's friendly() is not exported: its body is taken from the source and run in each context
const friendlySrc = (dir) => /function friendly\(err\) \{[\s\S]*?\n {2}\}/.exec(source('gl.js', dir))[0];

// the probe: runs in a context, returns [label, value] pairs (value: a string, or JSON of a structure)
// (kinds: the region kinds compared, those of the base: one added since, as dhray and dheq (issue #260), has nothing to
// compare with)
function probe(ctx, dir, kinds) {
  const out = [];
  const put = (label, v) => out.push([label, typeof v === 'string' ? v : JSON.stringify(v)]);
  const tryIt = (label, fn) => { try { put(label, fn()); } catch (e) { put(label, 'THROW ' + (e && e.message)); } };
  const { CX, Expr, Funcs, Calc, Region, Curves } = ctx;
  const C = CX.C;
  // ---- the catalog ----
  put('GROUPS', Funcs.GROUPS);
  const params = {
    mul: [{ c: '2' }, { c: '0' }], add: [{ c: '1' }], affine: [{ a: '1+i', b: '0' }, { a: '0', b: '1' }],
    recip: [{}], mobius: [{ a: '1', b: '-i', c: '1', d: 'i' }, { a: '2', b: '0', c: '0', d: '1' }, { a: '1', b: '1', c: '0', d: '1' }, { a: '1', b: '2', c: '2', d: '4' }, { a: '0', b: '1', c: '0', d: '0' }, { a: '1', b: '0', c: '1', d: '1' }, { a: '1+i', b: '0', c: '0', d: '1' }, { a: 'i', b: '0', c: '0', d: '1' }, { a: '2i', b: '1', c: '1', d: '0' }],
    blaschke: [{ a: '0.5', phi: 0 }, { a: '1', phi: 0 }, { a: '2', phi: 30 }, { a: '0.3+0.2i', phi: 45 }],
    pown: [{ n: 2 }, { n: 0 }, { n: -3 }, { n: 5 }], root: [{ n: 2, cut: 180, k: 0 }, { n: 3, cut: 90, k: 1 }, { n: 4, cut: 540, k: 0 }],
    powa: [{ alpha: '1.5', cut: 180, k: 0 }, { alpha: '0', cut: 180, k: 0 }, { alpha: '1+i', cut: 180, k: 0 }, { alpha: '0.5', cut: 45, k: 2 }],
    exp: [{}], log: [{ cut: 180, k: 0 }, { cut: 90, k: 1 }, { cut: -33.3, k: -2 }],
    joukowski: [{}], ijouk: [{ branch: 'exterior' }, { branch: 'interior' }], conj: [{}],
    poly: [{ co: '1, 0, -1, 0' }, { co: '2' }, { co: '1, 0' }, { co: '1,,2' }, { co: '' }, { co: '1, x' }, { co: '1, 1/0' }, { co: '3, 0, 0' }, { co: '1, 2, 3, 4, 5' }],
    rational: [{ p: '1, 0, 1', q: '1, 0' }, { p: '1', q: '0' }, { p: '1, 0', q: '1, 0, 1' }, { p: '2, 3', q: '4, 6' }],
    zp: [{ a: '1', zeros: '1, -1', poles: '0' }, { a: '0', zeros: '1', poles: '2' }, { a: '0', zeros: '1', poles: '' }, { a: '1', zeros: '1, 2', poles: '1' }, { a: '1', zeros: '1, 2', poles: '1, 2' }, { a: '1', zeros: Array(26).fill('1').join(','), poles: '' }],
    custom: [{ expr: 'z^2+\\frac{1}{z}', cut: 180 }, { expr: '\\sqrt{z}', cut: 90 }, { expr: 'x+y', cut: 180 }, { expr: '|z|<1', cut: 180 }, { expr: '1/0', cut: 180 }, { expr: '5', cut: 180 }, { expr: 'z\\bar z', cut: 180 }, { expr: '\\sin z', cut: 180 }, { expr: 'z^3-1', cut: 180 }, { expr: 'r', cut: 180 }, { expr: 'z^{1.5}', cut: 45 }, { expr: '\\log(z-1)+\\log(z+1)', cut: 180 }, { expr: 'e^{1/z}', cut: 180 }],
    deriv: [{}],
  };
  for (const d of Object.values(Funcs.DEFS)) {
    put(`def ${d.id}`, { label: d.label, group: d.group, menuTex: d.menuTex, params: d.params, presets: d.presets || null });
    const list = [Funcs.defaults(d.id), ...(params[d.id] || [])];
    list.forEach((p, i) => {
      const id = `${d.id}#${i}`;
      const b = Funcs.build({ type: d.id, params: p, on: true });
      if (b.error) { put(id + ' error', b.error); return; }
      put(id + ' notes', { branchNote: b.branchNote || null, inverseNote: b.inverseNote || null, notes: b.notes || null, props: b.props });
      if (typeof b.tex === 'function') tryIt(id + ' tex', () => b.tex({ s: 'z', p: 4 }).s);
      if (typeof b.domain === 'function') tryIt(id + ' domain', () => b.domain('w_1'));
      if (typeof b.homTex === 'function') {
        tryIt(id + ' homTex', () => b.homTex('z'));
        tryIt(id + ' homTex2', () => b.homTex('w_{1}', { f: 'f_2', p: 'p_2', c: 'c_2', a: 'a_2' }));
      }
      tryIt(id + ' toZP', () => Funcs.toZerosPoles({ type: d.id, params: p }));
      tryIt(id + ' fromZP', () => Funcs.fromZerosPoles({ type: d.id, params: p }));
      tryIt(id + ' deriv', () => Funcs.derivativeStep({ type: d.id, params: p }));
    });
  }
  tryIt('build unknown', () => Funcs.build({ type: 'nope', params: {} }));
  tryIt('build bad int', () => Funcs.build({ type: 'pown', params: { n: 'x' } }));
  tryIt('build bad angle', () => Funcs.build({ type: 'log', params: { cut: 'x', k: 0 } }));
  tryIt('build bad cx', () => Funcs.build({ type: 'mul', params: { c: 'z' } }));
  tryIt('build bad list', () => Funcs.build({ type: 'zp', params: { a: '1', zeros: '1, q', poles: '' } }));
  tryIt('mobHomTex', () => [Funcs.mobHomTex([C(1, 0), C(0, -1), C(1, 0), C(0, 1)]), Funcs.mobHomTex([C(2, 0), C(1, 0), C(0, 0), C(1, 0)], 'w')]);
  // ---- the parser ----
  const bad = ['', ' ', 'sin(', 'q', '\\foo z', '\\sn z', '\\tanx', 'z^0,5', 'lg z', 'arcctg z', '(z', '\\operatorname{qq} z', '\\text{}', '\\', '\\%',
    'z=<1', 'z=>1', '|z', '||z|', 'z||1', '\\cot^{-1} z', 'sin', '1+', ')', 'z $ 2', '#', 'chain', 'thin', 'tgz', 'shz', 'z,1', '\\mathrm{', 'a', '[z', '{z'];
  // the one intended change: the Russian spellings parse in English too (the user's decision); the base reads the
  // English spelling there, so the trees must agree
  const INTENDED = { tgz: 'tanz', shz: 'sinhz' };
  for (const s of bad) for (const o of [undefined, { allowRel: true }]) tryIt(`parse ${JSON.stringify(s)} ${o ? 'rel' : ''}`, () => Expr.parse(dir === BASE && INTENDED[s] ? INTENDED[s] : s, o));
  for (const s of ['z', '|z|<1', 'z=1', 'Re z=0, |z|<1', 'Re z = 0 or |z|<1', 'not (z=1)', 'z = z', '|Re z|=Re z', 'z^2=1', '1=1', 'a=b=c', '0 < Im z = 1', 'Re z=0 and Im z=0', '1/0=z', 'z=\\bar z'])
    tryIt(`classify ${s}`, () => Expr.classifyRelation(Expr.parse(s, { allowRel: true })));
  for (const s of ['z', '|z|<1', 'z=1', 'Re z = 0 or |z|<1']) tryIt(`level ${s}`, () => Expr.compileLevel(Expr.parse(s, { allowRel: true })) && 'ok');
  for (const s of ['|z|<1', 'z^2', 'z+z', 'z^{1.5}', '\\sin z', 'z\\bar z', 'x', '5', 'z^z', '\\cot z', '\\log z', '|z|', 'z^{i}', 'z*z*z', '\\sqrt[3]{z}', 'z^{1/3}'])
    for (const th of [Math.PI, 1]) {
      tryIt(`invert ${s} ${th}`, () => Expr.invert(Expr.parse(s), { theta: th }));
      tryIt(`diff ${s} ${th}`, () => Expr.toTex(Expr.diff(Expr.parse(s), { theta: th })).s);
    }
  for (const s of ['z', '|z|<1', 'z=1', 'x', '1/0', '2+i', '\\sqrt{-1}']) tryIt(`const ${s}`, () => Expr.constValue(s));
  for (const s of ['z', '|z|<1']) tryIt(`compile ${s}`, () => Expr.compile(Expr.parse(s, { allowRel: true })) && 'ok');
  tryIt('REL_MSG', () => Expr.REL_MSG);
  for (const s of ['z^2+1', '\\tan z+\\sinh z', '|z|<1 or Re z>2', '\\log z', '0.5z+1.25', 'z^{2.5}', 'e^{iz}']) tryIt(`toTex ${s}`, () => Expr.toTex(Expr.parse(s, { allowRel: true })).s);
  // ---- regions ----
  put('KINDS', Object.fromEntries(Object.entries(Region.KINDS).filter(([k]) => kinds.includes(k)).map(([k, v]) => [k, v.label])));
  for (const kind of kinds) {
    for (const [z0, z1] of [[C(0, 0), C(1, 0.5)], [C(-1.5, 0.25), C(2, -1)], [C(0.3, 0.7), C(0.31, 0.71)]]) {
      let s = null;
      try { s = Object.assign({ kind }, Region.defaultsFor(kind, z0, z1)); } catch (e) { s = { kind }; }
      if (kind === 'curve' || kind === 'polygon') s.pts = [[0, 0], [1, 0], [1, 1], [0.5, 1.5], [0, 1]].slice(0, kind === 'curve' ? 1 + Math.round(z1.re * 2) : 5);
      if (kind === 'formula') s.expr = '|z|<1';
      if (kind === 'fcurve') s.expr = 'Re z = 0';
      tryIt(`tex ${kind} ${z1.re}`, () => Region.KINDS[kind].tex(s));
    }
  }
  tryIt('tex formula bad', () => Region.KINDS.formula.tex({ expr: '|z|<' }));
  tryIt('tex fcurve bad', () => Region.KINDS.fcurve.tex({ expr: '((' }));
  tryIt('tex polygon 1', () => Region.KINDS.polygon.tex({ pts: [[0, 0]] }));
  tryIt('tex cgrid frac', () => Region.KINDS.cgrid.tex({ a: [-1.5, -0.25], b: [2.75, 1] }));
  // ---- curves ----
  for (const s of ['Re z = 0', '|z - 1| = 2', '|z| = -1', '|z| = 0', 'arg z = 4', 'arg z = 3.5', '|z^2-1| = 0', '|z|<1', '(Re z)^2 = 0', 'z = 1', 'Re z = 0, |z| > 5', 'Re z = 0, |z| < -1', '|Re z| = Re z', '\\sin(1/z) = 0', 'Im(1/z) = 0', 'x^2+y^2 = 1'])
    tryIt(`curve ${s}`, () => { const r = Curves.fromFormula(s); return { notes: r.notes ? [...r.notes] : null, flags: Object.fromEntries(Object.entries(r).filter(([, v]) => typeof v === 'string' || typeof v === 'boolean')), pieces: (r.pieces || []).map((p) => Object.keys(p)) }; });
  // ---- integrals ----
  const F = (z) => CX.div(C(1, 0), z);
  tryIt('residue at pole', () => Calc.residue(F, C(1, 0), 1));
  tryIt('residue', () => Calc.residue(F, C(0, 0), 1));
  tryIt('line through pole', () => Calc.lineIntegral(F, [C(-1, 0), C(1, 0)], false));
  tryIt('line', () => Calc.lineIntegral(F, [C(1, 1), C(2, 1)], false));
  // ---- formatters ----
  const nums = [0, 0.5, -0.5, 1.25, 3, 1e-5, 123456, -2.5e-7, Math.PI, 1 / 3, NaN, Infinity, 1234.56789];
  put('texNum', nums.map((x) => CX.texNum(x)));
  put('texNum2', nums.map((x) => CX.texNum(x, 2)));
  put('tex', nums.map((x) => CX.tex(C(x, 0.75))));
  put('fmt', nums.map((x) => [CX.fmt(C(x, -x)), CX.fmtNum(x), CX.fmtExact(C(x, 1))]));
  // ---- gl.js friendly() ----
  const friendly = vm.runInContext(`(${friendlySrc(dir)})`, ctx);
  put('friendly', [friendly('too many uniform vectors'), friendly('ERROR: 0:12: syntax error\nmore'), friendly('x'.repeat(200))]);
  return out;
}

const base = load(BASE, MODS);
const now = load(path.join(ROOT, 'src'), ['i18n', 'i18n_ru', ...MODS]);
const baseKinds = Object.keys(vm.runInContext('Region.KINDS', base));
const a = probe(base, BASE, baseKinds);
// (catalog steps added since the base, e.g. Γ and ζ (issue #4), have nothing to compare with: their outputs are left out)
const newIds = Object.keys(vm.runInContext('Funcs.DEFS', now)).filter((id) => !Object.prototype.hasOwnProperty.call(vm.runInContext('Funcs.DEFS', base), id));
const isNew = (label) => newIds.some((id) => label === `def ${id}` || label.startsWith(`${id}#`));
const b = probe(now, path.join(ROOT, 'src'), baseKinds).filter(([label]) => !isNew(label));
let fails = 0;
// (v16.5 UX84, an intended change of the English: a typed step is a "Formula", no longer a "Custom formula";
// notes/ux-build/w1-chain-AS-BUILT.md)
const intended = (s) => s.replace(/Custom formula/g, 'Formula');
// (#38, another intended change: a half-plane reads in words, "left of the line from a to b", no longer as
// Im((z − a)/(b − a)) > 0)
const inWords = (k, s) => /^tex halfplane /.test(k) && /^\\text\{left of the line from \} \S+ \\text\{ to \} \S+$/.test(s);
if (a.length !== b.length) { console.log('FAIL probe lengths', a.length, b.length); fails++; }
for (let i = 0; i < Math.min(a.length, b.length); i++) {
  if (a[i][0] !== b[i][0] || (intended(a[i][1]) !== b[i][1] && !inWords(b[i][0], b[i][1]))) {
    fails++;
    if (fails <= 20) console.log('FAIL', a[i][0], '\n  base:', a[i][1].slice(0, 300), '\n  now: ', b[i][1].slice(0, 300));
  }
}
// the same calls in Russian: the strings change, the behaviour does not (what throws in English throws in Russian,
// and the structures have the same shape); Russian text, no English sentence left in the messages checked here
const ruCtx = (() => {
  const ctx = { console, performance: { now: () => 0 }, setTimeout, clearTimeout, Intl };
  vm.createContext(ctx);
  vm.runInContext(NO_RECOGNIZER, ctx);
  for (const f of ['i18n', 'i18n_ru', ...MODS]) {
    vm.runInContext(source(f + '.js', path.join(ROOT, 'src'), { esm: 'strip' }) + (NAMES[f] ? `\n;globalThis.${NAMES[f]} = ${NAMES[f]};` : ''), ctx, { filename: f + '.js' });
    if (f === 'i18n_ru') vm.runInContext("I18N._setLang('ru')", ctx);
  }
  return ctx;
})();
const r = probe(ruCtx, path.join(ROOT, 'src'), baseKinds).filter(([label]) => !isNew(label));
const shape = (v) => { if (v.startsWith('THROW')) return 'THROW'; try { return JSON.stringify(JSON.parse(v), (k, x) => (typeof x === 'string' ? '' : x)); } catch (e) { return 'str'; } };
let ruDiff = 0, ruText = 0;
for (let i = 0; i < Math.min(b.length, r.length); i++) {
  if (b[i][0].startsWith('def ') || /^(GROUPS|KINDS)$/.test(b[i][0])) continue;   // labels: the strings themselves
  if (shape(b[i][1]) !== shape(r[i][1])) { ruDiff++; if (ruDiff <= 10) console.log('FAIL Russian behaves differently:', b[i][0], '\n  en:', b[i][1].slice(0, 200), '\n  ru:', r[i][1].slice(0, 200)); }
  if (b[i][1] !== r[i][1]) ruText++;
}
fails += ruDiff;
console.log(`Russian: ${ruText} of ${r.length} outputs differ in text, ${ruDiff} in behaviour`);
const lang = vm.runInContext('I18N.lang', now);
if (lang !== 'en') { fails++; console.log('FAIL the language of the new context is', lang); }
const bytes = a.reduce((s, [, v]) => s + v.length, 0);
const errs = a.filter(([, v]) => /THROW|error|Error/.test(v)).length;
console.log(fails ? `${fails} of ${a.length} outputs differ` : `all ${a.length} outputs byte-identical (${bytes} bytes, ${errs} with errors or messages)`);
process.exit(fails ? 1 : 0);
