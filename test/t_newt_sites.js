// Node check of the NEWT op's generated GLSL (src/glsl.js, the Newton kit): how many evaluations of the homotopy H_t
// (chainHom) one invocation of the inverse program's member function (_one_b) and of the roots pass's main reaches once
// every call is inlined. The renderer's shader compiler inlines every function, so a program's compile cost follows this
// count, not the number of `chainHom(` in the text. Run: node test/t_newt_sites.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const ctx = { console, performance: { now: () => 0 }, setTimeout, clearTimeout };
vm.createContext(ctx);
const { source } = require('./src_text');
// (the module list is t_gl_inverse.js's)
const names = (fs.readFileSync(path.join(__dirname, 't_gl_inverse.js'), 'utf8').match(/const NAMES = (\{.*\});/) || [])[1];
const MAP = eval('(' + names + ')');
for (const f of Object.keys(MAP)) vm.runInContext(source(f + '.js', path.join(root, 'src'), { esm: 'strip' }) + `\n;globalThis.${MAP[f]} = ${MAP[f]};`, ctx, { filename: f + '.js' });
const { Funcs, Inverse, GLChain } = ctx;
let bad = 0;
const check = (name, ok, info = '') => { if (!ok) { bad++; console.log('FAIL', name, info); } };

// H evaluations one program reaches per NEWT op. The inverse program's member function: _run 2 (H and the forward
// difference) + _hit 1 + _d 2.
const NEWT_H_SITES = 5;
// The roots pass: _run 2 + _hit 1 (no _d there).
const NEWT_H_SITES_PASS = 3;
// A polynomial op's member function: settle's _run 2 + _hit 1 + _d 2 + the stored roots' _hit 1; its roots pass: settle's
// _run 2 + _hit 1 + the stored roots' _hit 1.
const NEWT_H_SITES_POLY = 6, NEWT_H_SITES_POLY_PASS = 4;
const T = 0.5;
const CASES = [['plain', 'series', NEWT_H_SITES, NEWT_H_SITES_PASS], ['pole', 'zeta', NEWT_H_SITES, NEWT_H_SITES_PASS], ['seeded', 'ijouk', NEWT_H_SITES, NEWT_H_SITES_PASS], ['polynomial', 'poly', NEWT_H_SITES_POLY, NEWT_H_SITES_POLY_PASS]];

// Function bodies of prefix P (and `main`) of a GLSL text, by name.
const bodies = (src, P) => {
  const out = {}, re = new RegExp(`^(?:bool|void|vec2|int|float) ((?:${P}_\\w+|main))\\([^)]*\\)\\s*\\{`, 'gm');
  let m;
  while ((m = re.exec(src))) {
    let d = 1, j = re.lastIndex;
    while (d && j < src.length) { const c = src[j++]; if (c === '{') d++; else if (c === '}') d--; }
    out[m[1]] = src.slice(re.lastIndex, j);
  }
  return out;
};
// H evaluations reached from function n: its own chainHom( calls plus every call site's callee, counted per call site.
const reach = (fns) => {
  const memo = {};
  const cnt = (n, stack = []) => {
    if (memo[n] != null) return memo[n];
    if (stack.includes(n)) throw new Error('recursion at ' + n);
    const b = fns[n] || '';
    let c = (b.match(/\bchainHom\(/g) || []).length;
    for (const k of Object.keys(fns)) {
      if (k === n) continue;
      const mm = b.match(new RegExp(`\\b${k}\\(`, 'g'));
      if (mm) c += mm.length * cnt(k, stack.concat(n));
    }
    return memo[n] = c;
  };
  return cnt;
};
const St = (type, params = {}) => ({ type, params: Object.assign(Funcs.defaults(type), params), on: true });
const program = (type) => {
  const s = St(type), b = Funcs.build(s), hk = Inverse.homOps(b, T);
  return { ops: hk.ops, inv: GLChain.buildInverse([s], [Inverse.homBuilt(b, hk)]) };
};

for (const [name, type, bound, boundPass] of CASES) {
  const { ops, inv } = program(type);
  check(`${name}: the op list holds one NEWT op`, inv.ok && ops.filter((o) => o.kind === 'NEWT').length === 1 && !!inv.nr);
  if (!inv.ok || !inv.nr) continue;
  const prog = reach(bodies(inv.lib, 'ix0'))('ix0_one_b');
  check(`${name}: the inverse program reaches at most ${bound} H evaluations per member (reaches ${prog})`, prog <= bound, prog);
  const nr = reach(bodies(inv.lib + inv.nr.main, 'ix0'))('main');
  check(`${name}: the roots pass reaches at most ${boundPass} H evaluations per pixel (reaches ${nr})`, nr <= boundPass, nr);
  // negative control: a second _run call site in _roots must show in the count, past the bound
  const dup = inv.lib.replace(/^(.*= ix0_run\(.*)$/m, '$1\n$1');
  const more = reach(bodies(dup, 'ix0'))('ix0_one_b');
  check(`${name}: a second _run call site is counted (reaches ${more}, past ${bound})`, dup !== inv.lib && more > bound, more);
  console.log(`${name}: program ${prog}, roots pass ${nr} H evaluations (bounds ${bound}, ${boundPass})`);
}
console.log(bad ? `${bad} failed` : 'all passed');
process.exit(bad ? 1 : 0);
