// Node checks of the P2 renderer sources (no GPU): SPEC 6.1's byte-identity contract of REGION_FS against the fixtures
// recorded before P2 (test/fixtures/region_fs_*.glsl, from notes/backup-pre-sphere/src/gl.js), and the structure of
// GLChain.build(...).inverse (SPEC 4.1): the key is Inverse.inverseKey, the program's op list is Inverse.stepOps of
// every live step in order, the uInv allocator covers every op's parameters, a parameter change keeps the key, an
// eligibility flip changes it without touching the forward key or layout, and the walker nests one loop per
// multivalued op. The GPU side is test/glsl_inverse_test.js. Run: node test/t_gl_inverse.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const ctx = { console, performance: { now: () => 0 }, setTimeout, clearTimeout };
vm.createContext(ctx);
const NAMES = { cx: 'CX', parse: 'Expr', funcs: 'Funcs', inverse: 'Inverse', calc: 'Calc', glsl: 'GLChain', region: 'Region', palette: 'Palette', gl: 'GLR' };
for (const f of Object.keys(NAMES)) vm.runInContext(fs.readFileSync(path.join(root, 'src', f + '.js'), 'utf8') + `\n;globalThis.${NAMES[f]} = ${NAMES[f]};`, ctx, { filename: f + '.js' });
const { CX, Funcs, Inverse, GLChain, GLR } = ctx;
let bad = 0, n = 0;
const check = (name, ok, info = '') => { n++; if (!ok) { bad++; console.log('FAIL', name, info); } };
// ---- REGION_FS byte identity (patterns 0-8 since P3) ----
// P3 re-recorded the fixtures after a reviewed diff (SPEC 6.1): against the pre-P3 fixtures (region_fs_*.pre-p3.glsl,
// the P2 contract for patterns 0-7) the only additions are the uSphN uniform and the pattern-8 branch
const P8_UNIFORM = 'uniform float uSphN;\n';
const p8Branch = (src) => { const i = src.indexOf('  } else if (uPattern == 8) {'), j = src.indexOf('  } else {                          // Solid'); return i >= 0 && j > i ? src.slice(i, j) : null; };
for (const [k, sph] of [['flat', false], ['sphere', true]]) {
  const want = fs.readFileSync(path.join(__dirname, 'fixtures', `region_fs_${k}.glsl`), 'utf8');
  const pre = fs.readFileSync(path.join(__dirname, 'fixtures', `region_fs_${k}.pre-p3.glsl`), 'utf8');
  const got = GLR._src.REGION_FS(sph);
  check(`REGION_FS(${sph}) byte-identical to the fixture`, got === want, `${got.length} vs ${want.length}`);
  const br = p8Branch(got);
  check(`REGION_FS(${sph}) minus the pattern-8 branch and uSphN is the pre-P3 fixture`, !!br && got.replace(br, '').replace(P8_UNIFORM, '') === pre);
}
// the analytic pattern template shares the pattern formulas (PAT_CHAIN) with REGION_FS
const chainOf = (src) => src.slice(src.indexOf('  if (uPattern == 1) {'), src.lastIndexOf('  } else {                          // Solid'));
// (P2 review fixes: the analytic chain skips the polar near-origin fade where Lambda is exact, and uses ixChecker, the
// clamped checker filter with a float32 floor; P3: the spherical checker reads (ln rho, theta) and their footprints
// from the walk's polar block (sl8, slw8) instead of the fwidth coordinates; nothing else differs)
{
  const fade = '    col = mix(c0, col, clamp(0.5 + (rc - 1.0) / max(fgr * 12.0, 1e-9), 0.0, 1.0));';
  const sl = '    vec2 sl = gp * (TAU / 16.0), slw = gpw * (TAU / 16.0);   // (ln rho, theta) about the origin and their footprints\n';
  const fw = chainOf(GLR._src.PATTERN_SRC('fwidth')), an = chainOf(GLR._src.PATTERN_SRC('analytic'));
  check('PATTERN_SRC analytic and fwidth share the pattern formulas (three stated differences)', fw.includes(fade) && fw.includes(sl) && an === fw.replace(fade, '    if (!lamP) col = mix(c0, col, clamp(0.5 + (rc - 1.0) / max(fgr * 12.0, 1e-9), 0.0, 1.0));').replace(sl, '    vec2 sl = sl8, slw = slw8;\n').replace(/\bchecker\(/g, 'ixChecker(') && an.length > 500);
  check('the fwidth chain keeps checker() and the fade', /\bchecker\(/.test(fw) && !/ixChecker|lamP/.test(fw));
}
check('the analytic pattern has no screen-space derivative', !/fwidth|dFdx|dFdy|argWidth/.test(GLR._src.PATTERN_SRC('analytic')));
// ---- GLChain.build(...).inverse ----
const St = (type, params = {}, on = true) => ({ type, params: Object.assign(Funcs.defaults(type), params), on });
const build = (steps) => GLChain.build(steps, steps.map(Funcs.build));
const TYPES = Object.keys(Funcs.DEFS).filter((t) => t !== 'deriv');
for (const t of TYPES) {
  const steps = [St(t)], built = steps.map(Funcs.build), info = GLChain.build(steps, built), inv = info.inverse;
  check(`${t}: inverse built`, inv && inv.ok, inv && inv.reason);
  if (!inv || !inv.ok) continue;
  check(`${t}: key = Inverse.inverseKey`, inv.key === Inverse.inverseKey(steps, built));
  const so = Inverse.stepOps(built[0]);
  const kinds = so.ok ? so.ops.map((o) => o.kind) : ['X'];
  check(`${t}: program ops = stepOps`, JSON.stringify(inv.ops.map((o) => o.kind)) === JSON.stringify(kinds), JSON.stringify(inv.ops));
  const data = new Float32Array(4 * inv.slots);
  inv.fill(data);
  check(`${t}: uInv values finite`, data.every(Number.isFinite));
  check(`${t}: lib declares uInv[${inv.slots}] and every op function`, inv.lib.includes(`uniform vec4 uInv[${inv.slots}]`) && inv.ops.every((o) => new RegExp(`\\bix${o.j}_(one|nb|line|at)\\b`).test(inv.lib)));
  check(`${t}: the walker calls invLeaf once`, (inv.walker.match(/invLeaf\(/g) || []).length === 1);
}
// a 3-op chain nests a loop per multivalued op; inactive steps pass through (ixAct)
{
  const inv = build([St('affine', { a: '0.8', b: '0.1i' }), St('exp'), St('sin')]).inverse;
  check('3-op chain: AFF, EXP, SIN', JSON.stringify(inv.ops.map((o) => o.kind)) === '["AFF","EXP","SIN"]');
  check('3-op chain: two member loops, one base loop each', (inv.walker.match(/for \(int t\d+ = 0; t\d+ < 64;/g) || []).length === 2 && (inv.walker.match(/for \(int b\d+ = 0;/g) || []).length === 2);
  check('3-op chain: every op guarded by its step', [1, 2, 3].every((k) => inv.walker.includes(`ixAct(${k})`)));
}
// a parameter change keeps the key; an eligibility flip changes it at a constant forward key and layout
{
  const a = build([St('powa', { alpha: '1.5' })]).inverse.key, b = build([St('powa', { alpha: 'i' })]).inverse.key;
  check('powa 1.5 -> i keeps the inverse key (ROOTPOW mode is a uniform)', a === b);
  const p1 = build([St('poly', { co: '1, 0, -1, 0' })]), p2 = build([St('poly', { co: '1, 0, 0, 5' })]);
  check('poly 1,0,-1,0 -> 1,0,0,5: the forward key and layout stay', p1.key === p2.key && p1.slots === p2.slots);
  check('poly 1,0,-1,0 -> 1,0,0,5: the inverse key changes (X -> IPOW, AFF)', p1.inverse.key !== p2.inverse.key && /"X"/.test(p1.inverse.key) && /IPOW/.test(p2.inverse.key));
  const m1 = build([St('mobius', { a: '1', b: '2', c: '1', d: '3' })]), m2 = build([St('mobius', { a: '1', b: '2', c: '2', d: '4' })]);
  check('Mobius through degeneracy: forward key and layout stay, inverse key changes', m1.key === m2.key && m1.slots === m2.slots && m1.inverse.key !== m2.inverse.key);
  // the forward uChain values of the same structure keep their cells (the inverse has its own allocator)
  const f1 = new Float32Array(4 * p1.slots), f2 = new Float32Array(4 * p2.slots);
  p1.fill(f1); p2.fill(f2);
  check('poly flip: forward uChain cells hold the coefficients in the same places', f1.length === f2.length && f1[0] === f2[0] && f1[1] === f2[1]);
  // off and failed steps: no ops; a chain of more than 16 ops has no inverse program
  const off = build([St('exp'), St('sin', {}, false), St('log')]).inverse;
  check('a bypassed step has no op', JSON.stringify(off.ops.map((o) => o.step)) === '[1,3]');
  const long = build(Array.from({ length: 17 }, () => St('add', { c: '1' }))).inverse;
  check('17 ops: no inverse program', long.ok === false && /too long/.test(long.reason));
}
// the generated sources mention no forward chain (the inverse program needs GLChain.LIB and its own lib only)
{
  const inv = build([St('custom', { expr: 'e^{1/z}' })]).inverse;
  check('inverse lib independent of uChain', !/uChain/.test(inv.lib + inv.walker));
}
// ---- the cost guard's policy (SPEC 10.12; the user's rule "60 fps is enough": a fixed 60 Hz budget, half resolution
// before demotion, hysteresis by probes) ----
{
  const logs = [];
  const con0 = ctx.console.info;
  ctx.console.info = (m) => logs.push(m);
  const g = GLR.CostGuard();
  const f = (o) => g.frame('R', Object.assign({ key: 'k1', motion: true, inverse: true, t: 0 }, o));
  let r = f({ gpuMs: 7.9 });
  check('guard: budget 8 ms per pane frame, exit 5 ms', r.budget === 8 && r.exit === 5 && r.over === false && r.level === 0);
  r = f({ gpuMs: 8.2, displayMs: 8.33 });
  check('guard: the display refresh plays no part (120 Hz: the same 8 ms)', r.budget === 8 && r.over === true && r.level === 0);
  f({ gpuMs: 9 }); r = f({ gpuMs: 9 });
  check('guard: 3 consecutive over-budget motion frames: half resolution first', r.half && !r.demote && r.level === 1);
  check('guard: one console line', logs.length === 1 && /half resolution/.test(logs[0]), logs);
  r = f({ gpuMs: 12, level: 0 }); r = f({ gpuMs: 12, level: 0 }); r = f({ gpuMs: 12, level: 0 });
  check('guard: readings drawn at another level are ignored', r.level === 1 && r.over === null);
  for (let i = 0; i < 2; i++) f({ gpuMs: 9, level: 1 });
  r = f({ gpuMs: 9, level: 1 });
  check('guard: still over budget at half resolution: bounded shapes forward (the last resort)', r.half && r.demote && r.level === 2);
  for (let i = 0; i < 5; i++) r = f({ gpuMs: 20, level: 2 });
  check('guard: no level past 2', r.level === 2);
  r = f({ gpuMs: 1, motion: false });
  check('guard: sticky for the structure key', r.demote && r.half);
  r = g.frame('R', { key: 'k2', motion: true, inverse: true, gpuMs: 1 });
  check('guard: a new structure key resets', r.level === 0 && !r.half && !r.demote);
  f({ key: 'k3', gpuMs: 9 }); f({ key: 'k3', gpuMs: 1 }); r = f({ key: 'k3', gpuMs: 9 });
  check('guard: the streak must be consecutive', r.level === 0);
  f({ key: 'k3', gpuMs: 9, motion: false }); f({ key: 'k3', gpuMs: 9, motion: false }); r = f({ key: 'k3', gpuMs: 9, motion: false });
  check('guard: settled frames never count', r.level === 0);
  // readings between the exit and the budget change nothing at level 0
  for (let i = 0; i < 20; i++) r = f({ key: 'k4', gpuMs: 6 + (i % 3) });
  check('guard: 6-8 ms readings keep full resolution', r.level === 0);
  // without timer queries: the frame lag against 1.5 frames of 60 Hz (25 ms), whatever the display
  const g2 = GLR.CostGuard();
  for (let i = 0; i < 3; i++) r = g2.frame('L', { key: 'a', motion: true, inverse: true, gpuMs: null, intervalMs: 30, t: 0 });
  check('guard: lag fallback: 3 frames 30 ms late: half resolution', r.half && !r.demote);
  const g3 = GLR.CostGuard();
  for (let i = 0; i < 5; i++) r = g3.frame('L', { key: 'a', motion: true, inverse: true, gpuMs: null, intervalMs: 20, displayMs: 8.33 });
  check('guard: a 20 ms lag is not over (60 Hz budget, even on a 120 Hz display)', r.level === 0);
  check('guard: no escalate() (half comes first now)', !('escalate' in g));
  // both panes drew inverse passes in the measured frame: each gets half of the budget (and of the exit)
  const g5 = GLR.CostGuard();
  r = g5.frame('R', { key: 'b', motion: true, inverse: true, gpuMs: 4.5, share: 0.5 });
  check('guard: a shared frame halves the budget (4.5 ms > 4 ms)', r.over === true);
  r = g5.frame('R', { key: 'b', motion: true, inverse: true, gpuMs: 4.5 });
  check('guard: alone the same reading is under budget', r.over === false);
  ctx.console.info = con0;
}
// ---- B classes and K (SPEC 4.2, 13.12: the compile-time buffer is K + 2 rounded up to 3 / 5 / 8, capped at 8) ----
{
  const K = GLR.inverseK, B = GLR.inverseB;
  check('K(1) = 1, K(0.85) = 3, K(0.5) = 8, K(0.2) = 25', K(1) === 1 && K(0.85) === 3 && K(0.5) === 8 && K(0.2) === 25);
  check('B(1) = 3, B(0.85) = 5, B(0.7) = 5, B(0.5) = 5, B(0.45) = 8, B(0.2) = 8 (no 16-entry buffer: P2 review)', B(1) === 3 && B(0.85) === 5 && B(0.7) === 5 && B(0.5) === 5 && B(0.45) === 8 && B(0.2) === 8);
  // the light beyond the buffer, (1 - alpha)^B, composited with the buffer's mean colour: at most 3.2 % from alpha 0.5
  for (const a of [0.999, 0.95, 0.9, 0.8, 0.7, 0.6, 0.55, 0.5]) check(`(1 - ${a})^B(${a}) <= 0.032`, Math.pow(1 - a, B(a)) <= 0.0313);
  for (const a of [0.999, 0.95, 0.9, 0.8, 0.7, 0.67]) check(`B(${a}) holds K: exact`, B(a) >= K(a));
  check('the CPU twin uses the same classes', [1, 0.95, 0.85, 0.7, 0.6, 0.5, 0.49, 0.3, 0.1].every((a) => ctx.Inverse.Bof(a) === B(a)));
  // the compositing past the buffer (INV_HEAD / INV_MAIN): rejected and dropped candidates enter through ixTr; the stop
  // is off when K > B for the own alpha (uKall)
  const head = GLR._src.INV_HEAD(8, ''), main = GLR._src.INV_MAIN(false);
  check('INV_HEAD: ixRest on rejection and on a full buffer', /pos >= min\(IX_B, ixK\(\) \+ 2\)\) \{ ixRest\(cv\); return; \}/.test(head) && /if \(nb == IX_B\) ixRest\(bC\[IX_B - 1\]\);/.test(head));
  check('INV_HEAD: no early stop when K > B and uKall', /if \(uKall > 0 && uKsat > IX_B\) return 1e38;/.test(head));
  check('INV_MAIN: the rest composites through ixTr, then the tail closure', /C \+= T \* \(1\.0 - ixTr\) \* mc; T \*= ixTr;/.test(main) && /if \(ixTailInf\) \{ C \+= T \* mc; T = 0\.0; \}/.test(main) && !/nCov > IX_B/.test(main));
}
// ---- the cost guard's hysteresis: a level is left only by a probe of the finer one (SPEC 10.12) ----
{
  const con0 = ctx.console.info;
  const logs = [];
  ctx.console.info = (m) => logs.push(m);
  const g = GLR.CostGuard();
  const f = (o) => g.frame('R', Object.assign({ key: 'q', motion: true, inverse: true }, o));
  for (let i = 0; i < 3; i++) f({ gpuMs: 10, t: 0 });
  let st = g.state('R');
  check('guard: level 1 after 3 over-budget readings', st.level === 1 && st.half && !st.demote);
  // half-resolution readings that rise with a lower GPU clock (DVFS), under the budget: no escalation, no withdrawal
  for (let i = 0; i < 24; i++) f({ gpuMs: [5.9, 6.2, 5.1, 7.7, 6.4][i % 5], level: 1, t: 100 + i });
  st = g.state('R');
  check('guard: half readings under the budget keep level 1', st.level === 1 && !st.probe);
  let b = g.burst('R', 3000);
  check('guard: no probe before 4 s', b.level === 1 && !g.state('R').probe);
  b = g.burst('R', 4000);
  check('guard: a burst 4 s after the change probes full resolution', b.level === 0 && !b.half && g.state('R').probe);
  f({ gpuMs: 4.5, level: 0, t: 4100 }); f({ gpuMs: 4.8, level: 0, t: 4120 });
  check('guard: during the probe the pane draws the finer level', g.state('R').level === 0 && g.state('R').probe);
  f({ gpuMs: 6.0, level: 0, t: 4140 });
  st = g.state('R');
  check('guard: a probe reading between exit and budget: back to half at once', st.level === 1 && !st.probe && st.gap === 8000);
  b = g.burst('R', 4140 + 7999);
  check('guard: the next probe waits twice as long', b.level === 1 && !g.state('R').probe);
  b = g.burst('R', 4140 + 8000);
  check('guard: then probes again', b.level === 0 && g.state('R').probe);
  f({ gpuMs: 9.5, level: 0, t: 12200 });
  check('guard: an over-budget probe reading: back to half', g.state('R').level === 1 && g.state('R').gap === 16000);
  g.burst('R', 12200 + 16000);
  f({ gpuMs: 6, level: 1, t: 28300 });
  check('guard: readings of the coarser level during a probe are ignored', g.state('R').probe && g.state('R').level === 0);
  logs.length = 0;
  for (let i = 0; i < 3; i++) f({ gpuMs: 4.2, level: 0, t: 28400 + i });
  st = g.state('R');
  check('guard: 3 probe readings under the exit: full resolution sticks', st.level === 0 && !st.probe && st.gap === 4000 && logs.length === 1 && /full resolution/.test(logs[0]));
  for (let i = 0; i < 6; i++) f({ gpuMs: 4.2 + i, t: 28500 + i });
  check('guard: two over-budget readings are not a trend', g.state('R').level === 0);
  for (let i = 0; i < 3; i++) f({ gpuMs: 9, t: 28600 + i });
  check('guard: three are: half resolution again', g.state('R').level === 1);
  // level 2 probes level 1 (half, bounded shapes back to exact images)
  const g2 = GLR.CostGuard();
  const f2 = (o) => g2.frame('R', Object.assign({ key: 'r', motion: true, inverse: true }, o));
  for (let i = 0; i < 3; i++) f2({ gpuMs: 12, level: 0, t: 0 });
  for (let i = 0; i < 3; i++) f2({ gpuMs: 12, level: 1, t: 10 });
  check('guard: level 2', g2.state('R').level === 2 && g2.state('R').demote);
  b = g2.burst('R', 5000);
  check('guard: the probe of level 2 is level 1: half resolution, nothing demoted', b.level === 1 && b.half && !b.demote);
  for (let i = 0; i < 3; i++) f2({ gpuMs: 3, level: 1, t: 5100 + i });
  check('guard: under the exit at level 1: the demotion clears', g2.state('R').level === 1 && !g2.state('R').demote);
  b = g2.burst('R', 9200);
  check('guard: then level 0 is probed', b.level === 0);
  // the probe gap is capped
  const g3 = GLR.CostGuard();
  const f3 = (o) => g3.frame('R', Object.assign({ key: 's', motion: true, inverse: true }, o));
  for (let i = 0; i < 3; i++) f3({ gpuMs: 20, t: 0 });
  let t0 = 0;
  for (let k = 0; k < 8; k++) { t0 += g3.state('R').gap; g3.burst('R', t0); f3({ gpuMs: 20, level: 0, t: t0 }); }
  check('guard: probe gaps double up to 32 s', g3.state('R').gap === 32000 && g3.state('R').level === 1);
  // the key (B class, dpr, structure) starts clean
  const g4 = GLR.CostGuard();
  for (let i = 0; i < 3; i++) g4.frame('R', { key: 'a|B8', motion: true, inverse: true, gpuMs: 9 });
  check('guard: a new key (another B class) starts clean', g4.state('R').half && !g4.frame('R', { key: 'a|B5' }).half);
  // the predicted floor (13.14): app.js predictLevel sets it every frame from GLR.inverseEstimate
  const g5 = GLR.CostGuard();
  const f5 = (o) => g5.frame('R', Object.assign({ key: 'p', motion: true, inverse: true }, o));
  f5({ gpuMs: 3, t: 0 });
  logs.length = 0;
  let s5 = g5.setFloor('R', 1, 10);
  check('guard floor: a predicted floor of 1 is half resolution at once, one console line', s5.level === 1 && s5.half && !s5.demote && logs.length === 1 && /predicted/.test(logs[0]));
  for (let i = 0; i < 3; i++) f5({ gpuMs: 2, level: 1, t: 20 + i });
  b = g5.burst('R', 60000);
  check('guard floor: no probe below the floor (cheap half readings, long after)', b.level === 1 && !g5.state('R').probe);
  for (let i = 0; i < 3; i++) f5({ gpuMs: 12, level: 1, t: 60100 + i });
  check('guard floor: readings at the floor still escalate (a slower GPU)', g5.state('R').level === 2 && g5.state('R').demote);
  b = g5.burst('R', 70000);
  check('guard floor: a probe from level 2 stops at the floor', b.level === 1 && g5.state('R').probe);
  const g6 = GLR.CostGuard();
  g6.frame('R', { key: 'q2', motion: false });
  g6.setFloor('R', 1, 0);
  s5 = g6.setFloor('R', 0, 50);
  check('guard floor: a level the floor raised follows it back down', s5.level === 0 && !s5.half);
  check('guard floor: state reports it', g6.state('R').floor === 0 && g5.state('R').floor === 1);
  ctx.console.info = con0;
}
// ---- the prediction (GLR.inverseEstimate, 13.14): leaves per pixel of the walk, 0.45 ms per leaf and Mpx + 0.3 ----
{
  const E = GLR.inverseEstimate, px = 820 * 1032, prep = { ok: true, N: [17], inner: 0, stopOp: 0 };
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  check('estimate: alpha 1 (K 1): K + 1 leaves', near(E(prep, 1, 1, px), px * 1e-6 * (0.3 + 0.45 * 2)), E(prep, 1, 1, px));
  check('estimate: alpha 0.85 (K 3, B 5): 4 leaves', near(E(prep, 0.85, 0.85, px), px * 1e-6 * (0.3 + 0.45 * 4)));
  check('estimate: alpha 0.3 (K 16 > B 8, the tail rule): B + 1 leaves', near(E(prep, 0.3, 0.3, px), px * 1e-6 * (0.3 + 0.45 * 9)));
  check('estimate: hover-dimmed (K capped at B)', near(E(prep, 0.15, 0.3, px), px * 1e-6 * (0.3 + 0.45 * 9)));
  check('estimate: a finite family walks its whole budget', near(E({ ok: true, N: [3], inner: -1, stopOp: -1 }, 0.3, 0.3, px), px * 1e-6 * (0.3 + 0.45 * 3)));
  check('estimate: nested budgets multiply (capped at 64 leaves)', near(E({ ok: true, N: [17, 4], inner: 0, stopOp: 0 }, 1, 1, px), px * 1e-6 * (0.3 + 0.45 * 8)) && near(E({ ok: true, N: [17, 40], inner: 0, stopOp: 0 }, 0.3, 0.3, px), px * 1e-6 * (0.3 + 0.45 * 64)));
  check('estimate: an ineligible prep costs nothing', E({ ok: false }, 1, 1, px) === 0);
  // app.js HALF_EST = 2.2: alpha <= 0.5 at dpr 2 (820 x 1032) predicts half resolution, alpha 0.85 and dpr 1 do not
  check('estimate: at dpr 2 alpha 0.5 / 0.3 over 2.2 ms, alpha 0.85 under; dpr 1 under', E(prep, 0.5, 0.5, px) > 2.2 && E(prep, 0.3, 0.3, px) > 2.2 && E(prep, 0.85, 0.85, px) < 2.2 && E(prep, 0.3, 0.3, px / 4) < 2.2);
}
// ---- the tail rule and the next-member bound in the shader text (13.14) ----
{
  const head = GLR._src.INV_HEAD(8, '');
  check('INV_HEAD: ixDKTail returns the buffer\'s last key only with uIxTail, K > B for the own alpha, a full buffer and U final', /if \(uIxTail == 0 \|\| !\(uKall > 0 && uKsat > IX_B\) \|\| nb < IX_B \|\| !\(U >= 1\.0\)\) return 1e38;\s*return bD\[IX_B - 1\];/.test(head));
  check('INV_HEAD: the AFF bound starts at the next member', /ixRayBoxDist\(ixLastZ \+ qd, qd, IX_INF\)/.test(head));
  check('INV_HEAD: the log bound starts at the next member', /z = za \+ \(ixLastZ - za\) \* exp\(dir \* S\.x\)/.test(head));
  const steps = [St('exp')], w = build(steps).inverse.walker;
  check('walker: the tail rule for a side in range up to infinity, no hole, three covering members', /ixDKTail\(\); tl0 = true;/.test(w) && /cU0 >= 3 && hi0 >= IX_INF/.test(w) && /cD0 >= 3 && lo0 <= -IX_INF/.test(w) && /if \(tl0\) ixTailInf = true;/.test(w) && /!\(hl0 <= hh0\)/.test(w));
  const wz = build([St('powa', { alpha: 'i' })]).inverse.walker;
  check('walker: log families pass the key to ixStopLog', /ixStopLog\(0, st0, goUp0, sk0\)/.test(wz));
}
// ---- the pile-up cull of the line renderer (13.14): cached flat lines only ----
{
  const VS = (v, f) => GLR._src.LINE_VS ? GLR._src.LINE_VS(v, f) : '';
  const PILE = /floor\(q0 \/ cq\) == floor\(qP \/ cq\)/;
  check('LINE_VS: the pile-up cull exists for cached flat lines only', PILE.test(VS('', 'tex')) && !PILE.test(VS('', 'chain')) && !PILE.test(VS('S', 'tex')) && !PILE.test(VS('F', 'tex')));
  // P3 gate fix (SPEC 13.17): sub-pixel pieces are culled only in a segment that is a dot (start, middle and end within
  // a quarter pixel); in any other segment they are drawn and mitred, and the joins treat a sub-pixel neighbour as
  // drawn unless its segment is a dot. Not the per-segment-first-piece cull (beaded rims), not the quarter-pixel
  // thinning (overlapping capsules: saturated edges); the floor still culls them
  const DOT = /if \(len < 0\.25 \* uDpr && aTpl\.x > 0\.0\) \{\s*dotOwn = segDot\(0\) \? 1 : 0;\s*if \(dotOwn == 1\) good = false;\s*\}/;
  const DOTFN = /return len2\(qE - qS\) < cq && len2\(qH - qS\) < cq;/;
  const JOIN = /firstA \|\| la >= 0\.25 \* uDpr \|\| \(k0 > 0 \? \(dotOwn == -1 \? !segDot\(0\) : dotOwn == 0\) : !segDot\(1\)\)/.source + '[\\s\\S]*' + /firstB \|\| lb >= 0\.25 \* uDpr \|\| \(dotOwn == -1 \? !segDot\(0\) : dotOwn == 0\)/.source;
  const ok = (s) => DOT.test(s) && DOTFN.test(s) && new RegExp(JOIN).test(s);
  check('LINE_VS: sub-pixel pieces are culled only in dot segments and mitred otherwise (plane and globe, cached and not), the floor culls them', ['', 'S'].every((v) => ['tex', 'chain'].every((f) => ok(VS(v, f)))) && ok(VS('', 'local')) && !DOTFN.test(VS('F', 'tex')) && /if \(len < 0\.25 \* uDpr && aTpl\.x > 0\.0\) \{\s*good = false;\s*\}/.test(VS('F', 'tex')) && !/floor\(q0 \/ cq\) == floor\(cP\.xy/.test(VS('S', 'tex')) && !/aTpl\.x > 0\.0\) good = false;/.test(VS('S', 'tex')));
}
// ---- P3: the globes (SPEC 4.6; notes/ui-design/panels.md 9.0) ----
{
  // the conjugate lift P(z) = (2x, -2y, |z|^2 - 1) / (|z|^2 + 1): seen from outside through GLR.camera's right-handed
  // view, z -> screen keeps its orientation (det > 0 with screen y up) at every front-facing point; the plain lift
  // (2x, 2y, ...) reverses it everywhere (the mirror image of the U-b build)
  const lift = (x, y, conj) => { const q = x * x + y * y; return [2 * x / (q + 1), (conj ? -2 : 2) * y / (q + 1), (q - 1) / (q + 1)]; };
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const tally = { conj: [0, 0], plain: [0, 0] };
  for (let t = 0; t < 400; t++) {
    const cam = GLR.camera({ yaw: rnd() * 2 * Math.PI, pitch: (rnd() - 0.5) * 3, dist: 2 + 6 * rnd() }, 400, 500);
    const scr = (p) => { const c = GLR.M4.apply(cam.MVP, p); return [c[0] / c[3], c[1] / c[3]]; };
    const z = [(rnd() - 0.5) * 6, (rnd() - 0.5) * 6], h = 1e-5;
    for (const conj of [true, false]) {
      const p = lift(z[0], z[1], conj), v = [cam.eye[0] - p[0], cam.eye[1] - p[1], cam.eye[2] - p[2]];
      if (v[0] * p[0] + v[1] * p[1] + v[2] * p[2] <= 0.05) continue;    // the far side
      const a = scr(p), bx = scr(lift(z[0] + h, z[1], conj)), by = scr(lift(z[0], z[1] + h, conj));
      const det = (bx[0] - a[0]) * (by[1] - a[1]) - (by[0] - a[0]) * (bx[1] - a[1]);
      tally[conj ? 'conj' : 'plain'][det > 0 ? 0 : 1]++;
    }
  }
  check('the conjugate lift keeps the orientation of the plane on screen', tally.conj[0] > 100 && tally.conj[1] === 0, JSON.stringify(tally));
  check('(the plain lift reverses it: the mirror the conjugation removes)', tally.plain[1] > 100 && tally.plain[0] === 0, JSON.stringify(tally));
  const main = GLR._src.INV_MAIN(true);
  check('the globe inverse main takes w through the conjugate lift\'s inverse', main.includes('vec2(P.x, -P.y) / (1.0 - P.z)') && main.includes('cinv(P.xy / (1.0 + P.z))'));
  check('the globe inverse main hands its anisotropic footprint to the walk (IX_ANISO)', main.includes('ixAwX = ixDwX; ixAwY = ixDwY;') && !GLR._src.INV_MAIN(false).includes('ixAwX'));
  const lib = GLChain.build([St('exp')], [St('exp')].map(Funcs.build)).inverse.lib;
  check('the walk converts range levels to pixels through ixFoot (anisotropic under IX_ANISO only)', /lvlOut \/ ixFoot\(L\.J, lgOut\)/.test(lib) && /#ifdef IX_ANISO[\s\S]*ixAwX[\s\S]*#endif\s*return ixScale\(J\) \* ixPix;/.test(lib));
  // pattern 8 in both footprint modes
  check('pattern 8 in the fwidth and analytic patterns', /uPattern == 8/.test(GLR._src.PATTERN_SRC('fwidth')) && /vec2 sl = sl8, slw = slw8;/.test(GLR._src.PATTERN_SRC('analytic')));
  check('GLR.PATTERNS.sphere is 8', GLR.PATTERNS && GLR.PATTERNS.sphere === 8);
}
console.log(`${n - bad}/${n} passed`);
process.exit(bad ? 1 : 0);
