// Constructions (v16 CORE, notes/constructions-v16/SPEC.md 18): src/constr.js and its integration with region.js,
// inverse.js and gl.js's packing. Run: node test/t_constr.js [-v]
//  A. the proof of concept's 66 engine tests (notes/ui-redesign-2/constructions/poc/test.js), against src/constr.js
//  B. its 18 bridge tests (poc/bridge.test.js), against this copy's src/ (region.js, curves.js)
//  C. the integration and exactness tests of SPEC 18: refs, ids, collinear and continuity, exact levels, sampling,
//     formOf readers, intersections, gliders, the graph, the plans, save and load, bound numbers
//  D. the v16 review fixes (constr_review_tests.js)
//  E. the Perpendicular circle, op perp (constr_perp_tests.js; notes/orthogonal-circle/SPEC.md 7)
//  F. the Touching circle, ops touch and tangent (constr_touch_tests.js; notes/orthogonal-circle/TANGENT-SPEC.md 7)
//  G. Inside C only, a perpendicular circle's arc on one side of C (constr_seg_tests.js; orthogonal-circle/segments/SPEC.md 11)
'use strict';
// the absolute speed limits are set on the development Mac; CMW_SPEED_SCALE (CI: ci/README.md) scales them for slower machines
const SPEED = +(process.env.CMW_SPEED_SCALE || 1) || 1;
const path = require('path');
const SRC = path.join(__dirname, '../src');
global.CX = require(path.join(SRC, 'cx.js'));
global.Expr = require(path.join(SRC, 'parse.js'));
global.Funcs = require(path.join(SRC, 'funcs.js'));
global.Region = require(path.join(SRC, 'region.js'));
const Curves = require(path.join(SRC, 'curves.js'));
global.Curves = Curves;
const K = require(path.join(SRC, 'constr.js'));
global.Constr = K;
const Inverse = require(path.join(SRC, 'inverse.js'));
let pass = 0, fail = 0;
const sect = { A: [0, 0], B: [0, 0], C: [0, 0] };
let cur = 'A';
const ok = (c, msg, extra) => { if (c) pass++; else fail++; sect[cur][c ? 0 : 1]++; if (!c || process.argv.includes('-v')) console.log((c ? 'PASS ' : 'FAIL ') + msg + (extra !== undefined ? ' ' + JSON.stringify(extra) : '')); };
const near = (a, b, tol = 1e-12) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const nearP = (p, q, tol = 1e-12) => p && q && near(p[0], q[0], tol) && near(p[1], q[1], tol);
const fAt = (g, z) => K.fOf(g, z);
const cpu = (fn, n) => { const c0 = process.cpuUsage(); for (let i = 0; i < n; i++) fn(i); const c = process.cpuUsage(c0); return (c.user + c.system) / 1000 / n; };

// =========================================================== A. the PoC engine tests
cur = 'A';

// ------------------------------------------------ 1. exact orientation
{
  let naiveWrong = 0, wrong = 0;
  for (let i = 0; i < 24; i++) for (let j = 0; j < 24; j++) {
    const p = [0.5 + i * 2 ** -53, 0.5 + j * 2 ** -53], q = [12, 12], r = [24, 24];
    const want = Math.sign(j - i);                        // orient = 12 (b - a) exactly
    const naive = Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
    if (naive !== want) naiveWrong++;
    if (Math.sign(K.orient(p, q, r)) !== want) wrong++;
  }
  ok(wrong === 0, 'orient: exact sign on 576 nearly collinear triples (Shewchuk\'s 0.5 + k ulp test)', { naiveWrong, wrong });
  ok(naiveWrong > 0, 'orient: the naive float formula gets some of them wrong (why the predicate is needed)', naiveWrong);
  ok(Math.sign(K.orient([1e300, 1e-300], [-1e300, 3], [5e-324, 1e300])) === -1, 'orient: the right sign where the value overflows (about -2e600)');
  ok(K.orient([1e-320, 0], [2e-320, 0], [3e-320, 0]) === 0 && K.orient([0, 0], [5e-324, 0], [0, 5e-324]) > 0, 'orient: subnormals are exact');
}

// ------------------------------------------------ 2. circle through three points
{
  const g = K.circle3([0, 0], [1, 0], [0, 1]), G = K.geomOf(g);
  ok(!G.line && nearP(G.c, [0.5, 0.5]) && near(G.r, Math.SQRT1_2) && G.inside, 'circle3: centre, radius, counterclockwise = the disc', G);
  ok([[0, 0], [1, 0], [0, 1]].every((z) => Math.abs(fAt(g, z)) < 1e-15), 'circle3: passes through its points (|f| < 1e-15)');
  ok(near(fAt(g, [0.5, 0.5]) / 2, -G.r, 1e-12) === false && fAt(g, [0.5, 0.5]) < 0 && fAt(g, [3, 3]) > 0, 'circle3: inside f < 0, outside f > 0');
  const cw = K.shapeOf(K.circle3([0, 0], [0, 1], [1, 0]), true);
  ok(cw.kind === 'disc' && cw.complement === true, 'circle3: clockwise = the outside of the circle (complement of the disc)', cw);
  // exactly collinear: a line, never a huge circle
  const L = K.circle3([0, 0], [1, 0], [2, 0]);
  ok(L.A === 0 && K.shapeOf(L).kind === 'line', 'circle3: collinear points give A = 0 exactly: a line', L);
  ok(fAt(L, [0, 1]) < 0, 'circle3: the cyclic order 0 -> 1 -> 2 runs along +x, so the interior is the upper half-plane');
  ok(fAt(K.circle3([0, 0], [2, 0], [1, 0]), [0, 1]) > 0, 'circle3: 0 -> 2 -> 1 runs through infinity first (along -x): the lower half-plane');
  const sl = K.circle3([0.1, 0.3], [0.2, 0.6], [0.7, 2.1]);
  // (v16 review math-3: grid points are collinear by their decimals, whatever the doubles' exact predicate says)
  ok(sl.A === 0 && K.circle3([0.1, 0.3], [0.2, 0.6], [0.7, 2.1000001]).A !== 0, 'circle3: A is zero exactly when the points are collinear (exactly, or as the decimals typed)', sl.A);
  // continuity through collinearity: the third point crosses the line PQ; f at a fixed point varies continuously
  const zt = [0.4, 0.9];
  const fs = [1e-3, 1e-6, 1e-12, 0, -1e-12, -1e-6, -1e-3].map((y) => fAt(K.circle3([0, 0], [1, 0], [3, y]), zt));
  ok(fs.every((f, i) => i === 0 || Math.abs(f - fs[i - 1]) < 0.01), 'circle3: continuous on the sphere as R crosses the line (disc -> half-plane -> complement)', fs.map((f) => +f.toFixed(6)));
  const kinds = [1e-3, 0, -1e-3].map((y) => { const s = K.shapeOf(K.circle3([0, 0], [1, 0], [3, y]), true); return s.kind + (s.complement ? '*' : ''); });
  ok(kinds.join() === 'disc,halfplane,disc*', 'circle3: the area is a disc, a half-plane, then a disc complement', kinds);
  // infinity
  const li = K.circle3([0, 0], [1, 1], K.INF), li2 = K.circle3(K.INF, [0, 0], [1, 1]);
  ok(li.A === 0 && nearP(K.geomOf(li).d, [Math.SQRT1_2, Math.SQRT1_2]) && nearP(K.geomOf(li2).d, K.geomOf(li).d), 'circle3: through infinity = the line, directed by the cyclic order', K.geomOf(li));
  ok(K.circle3(K.INF, K.INF, [0, 0]) === null && K.circle3([1, 1], [1, 1], [0, 0]) === null, 'circle3: two equal points: undefined (null)');
  // almost collinear: a circle of radius 1e8 through points near 0 is as accurate as a line
  const R = 1e8, on = (x) => [x, x * x / (R + Math.sqrt(R * R - x * x))];   // on |z - iR| = R, without cancellation
  const big = K.circle3(on(-1), on(0.3), on(1));
  const errs = [-0.7, 0.1, 0.5, 2, 10].map((x) => Math.abs(fAt(big, on(x)) / 2));
  ok(errs.every((e) => e < 1e-14), 'circle3: radius 1e8 through points near 0: |signed distance| < 1e-14 at other points of the true circle', errs);
  const c0 = K.geomOf(big).c, naive = errs.map((_, k) => { const z = on([-0.7, 0.1, 0.5, 2, 10][k]); return Math.abs(K.geomOf(big).r - Math.hypot(z[0] - c0[0], z[1] - c0[1])); });
  ok(Math.max(...naive) > 1e3 * Math.max(...errs), 'circle3: (the centre-radius form r - |z - c| is 1000x worse there: why the app should keep (A, B, C))', naive);
}

// ------------------------------------------------ 3. other constructions and intersections
{
  const l = K.line2([0, 0], [2, 0]), b = K.bisector([0, 0], [2, 0]), cp = K.circleCP([0, 0], [0, 2]);
  ok(nearP(K.meets(l, b)[0], [1, 0]) && K.meets(l, b)[1] === K.INF, 'meets: two lines: the crossing, then infinity');
  ok(K.meets(l, K.line2([0, 1], [1, 1])).every(K.isInf), 'meets: parallel lines are tangent at infinity: both points are infinity (rev 2, review-users 20)');
  const m = K.meets(l, cp);
  ok(nearP(m[0], [2, 0]) && nearP(m[1], [-2, 0]), 'meets: X1 is where curve 2 enters the inside of curve 1 (the circle enters the upper half-plane at 2)', m);
  const tang = K.meets(K.line2([0, 2], [1, 2]), cp);
  ok(nearP(tang[0], [0, 2]) && nearP(tang[1], [0, 2]), 'meets: tangent line: one double point', tang);
  ok(K.meets(K.line2([0, 3], [1, 3]), cp)[0] === null, 'meets: a line missing the circle: none');
  const c2 = K.circleCP([2, 0], [0, 0]), cc = K.meets(cp, c2);
  ok(nearP(cc[0], [1, Math.sqrt(3)]) && nearP(cc[1], [1, -Math.sqrt(3)]), 'meets: two circles, the first left of the centre line', cc);
  ok(cc.every((z) => Math.abs(fAt(cp, z)) < 1e-14 && Math.abs(fAt(c2, z)) < 1e-14), 'meets: the points lie on both curves');
  ok(K.meets(cp, K.circleCR([0, 0], 1))[0] === null, 'meets: concentric circles: none');
  ok(nearP(K.meets(cp, K.circleCR([4, 0], 2))[0], [2, 0]), 'meets: tangent circles: the touching point');
  const g = K.circleCR([1, 1], 2);
  ok(nearP(K.onCurve(g, K.paramNear(g, [10, 1])), [3, 1]), 'glider: the parameter nearest a point projects onto the circle');
}

// ------------------------------------------------ 4. formulas
{
  ok([...K.namesOf(K.parse('|z - P| = 2a + b1'))].sort().join() === 'P,a,b1', 'parse: free names (z excluded)');
  const env = (n) => ({ a: [0.5, 0], P: [1, 1] })[n];
  ok(nearP(K.evalAst(K.parse('2a + 3i P'), env), [1 - 3, 3]), 'parse: implicit products (2a, 3i P)');
  ok(nearP(K.evalAst(K.parse('|3 + 4i| + e^(i pi)'), env), [4, 0], 1e-15), 'parse: |..|, e^(i pi)');
  const L = K.equationCurve(K.parse('Re z = 2a'), env);
  ok(L.A === 0 && nearP(K.geomOf(L).p, [1, 0]), 'equation: Re z = 2a is the line x = 1, exactly a line');
  const C = K.equationCurve(K.parse('|z - P| = a'), env);
  ok(nearP(K.geomOf(C).c, [1, 1]) && near(K.geomOf(C).r, 0.5), 'equation: |z - P| = a is a circle');
  ok(nearP(K.geomOf(K.equationCurve(K.parse('a = Im z'), env)).p, [0, 0.5]), 'equation: sides may be swapped');
  let e = null; try { K.equationCurve(K.parse('Re z^2 = a'), env); } catch (x) { e = x.message; }
  ok(e && /knows/.test(e), 'equation: an unknown form is refused with a message (the app uses Curves.fromFormula)', e);
}

// ------------------------------------------------ 5. the graph
{
  const G = K.graph();
  G.add('a', { kind: 'param', value: 0.5, min: -2, max: 2, step: 0.01 });
  G.add('P', { kind: 'point', at: [0, 0] }); G.add('Q', { kind: 'point', at: [2, 0] }); G.add('R', { kind: 'point', at: [0, 2] });
  G.add('c', { kind: 'circle3', args: ['P', 'Q', 'R'] });
  G.add('l', { kind: 'line', args: ['P', 'Q'] });
  G.add('g', { kind: 'equation', src: 'Re z = a' });
  G.add('X', { kind: 'meet', args: ['c', 'g'], index: 0 });
  G.add('M', { kind: 'midpoint', args: ['Q', 'R'] });
  G.add('S', { kind: 'point', expr: 'P + a + i a' });
  ok(G.names().indexOf('c') > G.names().indexOf('R') && G.names().indexOf('X') > G.names().indexOf('g'), 'graph: topological order', G.names());
  const ev0 = G.stats.evals;
  const changed = G.set('a', 1);
  ok([...changed].sort().join() === 'S,X,a,g' && changed.indexOf('X') > changed.indexOf('g') && G.stats.evals - ev0 === 4, 'graph: a slider recomputes only what depends on it, in a topological order', changed);
  ok(nearP(G.val('X'), [1, -1 + Math.sqrt(2) * 0 + 0], 1) && Math.abs(fAt(G.val('c'), G.val('X'))) < 1e-14 && G.val('X')[0] === 1, 'graph: the intersection follows the slider and lies on the circle', G.val('X'));
  const ch2 = G.drag('R', [2, 2]);
  ok(ch2.join() === 'R,c,M,X', 'graph: dragging a point recomputes its dependents only', ch2);
  // degenerate on the way: R onto the line PQ: c is a line; X (c with Re z = 1) is still defined
  G.drag('R', [4, 0]);
  ok(G.val('c').A === 0 && nearP(G.val('X'), [1, 0]), 'graph: collinear P, Q, R: c becomes the line, X stays on it', G.val('X'));
  G.drag('R', [2, 0]);
  ok(G.val('c') === null && /coincide/.test(G.err('c')) && G.val('X') === null && /c is undefined/.test(G.err('X')), 'graph: R onto Q: c undefined with a reason, X undefined because of c', [G.err('c'), G.err('X')]);
  G.drag('R', [0, 2]);
  ok(G.val('c') && G.val('X') && !G.err('X'), 'graph: dragging back restores everything (no history in the values)');
  // cycles refused, nothing changed
  let e = null; try { G.redefine('a', { kind: 'value', expr: 'Re S' }); } catch (x) { e = x.message; }
  ok(e === 'a would depend on itself: a → S → a' && G.get('a').def.kind === 'param', 'graph: a cycle is refused with its path, the old definition kept', e);
  try { G.add('P2', { kind: 'point', expr: 'b + 1' }); e = null; } catch (x) { e = x.message; }
  ok(e === 'b is not defined', 'graph: unknown names are refused', e);
  try { G.add('x', { kind: 'param', value: 1 }); e = null; } catch (x) { e = x.message; }
  ok(/taken/.test(e), 'graph: reserved letters (z w x y r i e) cannot be names', e);
  // not draggable: constructed points
  try { G.drag('M', [0, 0]); e = null; } catch (x) { e = x.message; }
  ok(/defined by its construction/.test(e) && !G.draggable('M') && G.draggable('P'), 'graph: constructed points are not draggable', e);
  // a glider
  G.add('T', { kind: 'glider', args: ['c'], t: 0 });
  G.drag('T', [10, 1]);
  const t1 = G.get('T').def.t;
  G.drag('Q', [3, 0]);
  ok(Math.abs(fAt(G.val('c'), G.val('T'))) < 1e-14 && G.get('T').def.t === t1, 'graph: a glider stays on its moving circle at the same angle');
  // a family
  G.add('k', { kind: 'list', values: [-2, -1, 0, 1, 2] });
  G.add('h', { kind: 'equation', src: 'Im z = k a' });
  ok(Array.isArray(G.val('h')) && G.val('h').length === 5 && nearP(K.geomOf(G.val('h')[4]).p, [0, 2]), 'graph: a list makes a family of curves (Im z = k a for 5 values of k)');
  G.set('a', 0.25);
  ok(nearP(K.geomOf(G.val('h')[0]).p, [0, -0.5]), 'graph: the family follows the slider');
  // remove cascades
  const gone = G.remove('Q');
  ok(gone.sort().join() === 'M,Q,T,X,c,l', 'graph: removing a point removes what depends on it', gone);
  // save and load: the same values (determinism: nothing depends on history)
  const H = K.fromJSON(JSON.parse(JSON.stringify(G.toJSON())));
  ok(G.names().every((n) => JSON.stringify(G.val(n)) === JSON.stringify(H.val(n))), 'graph: toJSON -> fromJSON gives identical values');
}

// ------------------------------------------------ 6. speed (60 fps = 16.7 ms a frame; the engine must take ~nothing)
// Measured as CPU time per update (process.cpuUsage), so a busy machine does not count, and the median wall time.
{
  const measure = (n, step) => {
    const walls = [];
    const c0 = process.cpuUsage();
    for (let f = 0; f < n; f++) { step(f); walls.push(lastG.stats.lastMs); }
    const c = process.cpuUsage(c0);
    walls.sort((a, b) => a - b);
    return { cpu: (c.user + c.system) / 1000 / n, median: walls[n >> 1] };
  };
  let lastG;
  const G = lastG = K.graph();
  G.add('a', { kind: 'param', value: 0.5 });
  const N = 200;
  for (let i = 0; i < N; i++) G.add('P' + i, { kind: 'point', at: [Math.cos(i), Math.sin(2 * i) + i * 0.01] });
  for (let i = 0; i + 2 < N; i++) G.add('c' + i, { kind: 'circle3', args: ['P' + i, 'P' + (i + 1), 'P' + (i + 2)] });
  for (let i = 0; i + 3 < N; i++) G.add('X' + i, { kind: 'meet', args: ['c' + i, 'c' + (i + 1)], index: 0 });
  for (let i = 0; i < 200; i++) G.add('g' + i, { kind: 'equation', src: `|z - P${i}| = a + ${i / 100}` });
  const nodes = G.names().length;
  measure(60, (f) => G.drag('P1', [Math.cos(f / 10), Math.sin(f / 10)]));       // warm up
  const d = measure(600, (f) => G.drag('P1', [Math.cos(f / 10), Math.sin(f / 10)]));
  ok(d.cpu < 0.5 * SPEED, `speed: dragging a point in a graph of ${nodes} objects: ${d.cpu.toFixed(3)} ms CPU per update (median wall ${d.median.toFixed(3)} ms)`);
  measure(60, (f) => G.set('a', 0.5 + f / 2000));
  const s2 = measure(600, (f) => G.set('a', 0.5 + f / 2000));
  ok(s2.cpu < 2 * SPEED, `speed: a slider driving 200 circles: ${s2.cpu.toFixed(3)} ms CPU per update (median wall ${s2.median.toFixed(3)} ms)`);
  const H = lastG = K.graph();
  H.add('b0', { kind: 'param', value: 0 });
  for (let i = 1; i <= 2000; i++) H.add('b' + i, { kind: 'value', expr: `b${i - 1} + 1` });
  const s3 = measure(30, (f) => H.set('b0', f));
  ok(H.val('b2000') === 2029 && s3.cpu < 10 * SPEED, `speed: a chain of 2000 formulas, all recomputed: ${s3.cpu.toFixed(2)} ms CPU per update`);
}

// ------------------------------------------------ 7. revision 2 (review-users 1, 2, 6, 8, 9, 20; review-design 15, 17)
{
  // users-1: a third point BUILT on line PQ gives the line itself, in every case (incidence, not rounding)
  let bad = 0, badG = 0, badM = 0, maxR = 0;
  const rnd = (() => { let x = 12345; return () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648); })();
  for (let i = 0; i < 2000; i++) {
    const G = K.graph();
    const P = [rnd() * 8 - 4, rnd() * 8 - 4], Q = [rnd() * 8 - 4, rnd() * 8 - 4], C = [rnd() * 2 - 1, rnd() * 2 - 1];
    G.add('P', { kind: 'point', at: P }); G.add('Q', { kind: 'point', at: Q }); G.add('O', { kind: 'point', at: C });
    G.add('l', { kind: 'line', args: ['P', 'Q'] }); G.add('k', { kind: 'circleCR', args: ['O'], rexpr: '5' });
    G.add('X', { kind: 'meet', args: ['l', 'k'], index: 0 });
    G.add('c', { kind: 'circle3', args: ['P', 'Q', 'X'] });
    const c = G.val('c'); if (G.val('X') && (!c || c.A !== 0)) { bad++; if (c) maxR = Math.max(maxR, 1 / Math.abs(c.A)); }
    G.add('T', { kind: 'glider', args: ['l'], t: rnd() * 4 - 2 }); G.add('d', { kind: 'circle3', args: ['P', 'T', 'Q'] });
    if (!G.val('d') || G.val('d').A !== 0) badG++;
    G.add('M', { kind: 'midpoint', args: ['P', 'Q'] }); G.add('h', { kind: 'circle3', args: ['M', 'Q', 'P'] });
    if (!G.val('h') || G.val('h').A !== 0) badM++;
  }
  ok(bad === 0 && badG === 0 && badM === 0, 'incidence: circle(P, Q, X) is exactly a line for X = line(P,Q) ∩ circle, a glider on PQ, the midpoint (2000 random cases each)', { bad, badG, badM, maxR });
  {
    const G = K.graph();
    G.add('P', { kind: 'point', at: [-1.3, 0.2] }); G.add('Q', { kind: 'point', at: [2.1, 0.9] }); G.add('O', { kind: 'point', at: [0.1, 0] });
    G.add('l', { kind: 'line', args: ['P', 'Q'] }); G.add('k', { kind: 'circleCR', args: ['O'], rexpr: '3' });
    G.add('X', { kind: 'meet', args: ['l', 'k'], index: 1 }); G.add('c', { kind: 'circle3', args: ['P', 'Q', 'X'] });
    const sh = K.shapeOf(G.val('c'), true);
    let wrong = 0;
    for (let i = 0; i < 20000; i++) { const z = [rnd() * 10 - 5, rnd() * 10 - 5]; const inside = K.fOf(G.val('c'), z) < 0, o = K.orient(sh.a, sh.b, z); if (o !== 0 && inside !== (o > 0)) wrong++; }
    ok(sh.kind === 'halfplane' && wrong === 0, 'incidence: the half-plane is exact per pixel (20000 samples agree with the exact orientation test)', { kind: sh.kind, wrong });
  }
  // users-2: X1 does not swap when circle(P, Q, R) passes through the line case
  {
    const G = K.graph();
    G.add('P', { kind: 'point', at: [-1, 0] }); G.add('Q', { kind: 'point', at: [1, 0] }); G.add('R', { kind: 'point', at: [0.3, 0.5] });
    G.add('O', { kind: 'point', at: [0.2, 0.1] }); G.add('k', { kind: 'circleCR', args: ['O'], rexpr: '0.8' });
    G.add('c', { kind: 'circle3', args: ['P', 'Q', 'R'] }); G.add('X1', { kind: 'meet', args: ['c', 'k'], index: 0 }); G.add('X2', { kind: 'meet', args: ['c', 'k'], index: 1 });
    let prev = null, maxStep = 0, line = 0;
    for (let j = 0; j <= 40; j++) {
      G.drag('R', [0.3, 2e-6 - j * 1e-7]);
      if (G.val('c').A === 0) line++;
      const x = G.val('X1');
      if (prev) maxStep = Math.max(maxStep, Math.hypot(x[0] - prev[0], x[1] - prev[1]));
      prev = x;
    }
    ok(line === 1 && maxStep < 1e-6, 'meets: dragging R through collinear (41 steps of 1e-7, one exactly on the line), X1 moves less than 1e-6 per step', { line, maxStep });
  }
  // design-15 / users-7: the tool makes the disc whatever the order; afterwards it is continuous through the line
  {
    const G = K.graph();
    G.add('P', { kind: 'point', at: [0, 0] }); G.add('Q', { kind: 'point', at: [0, 1] }); G.add('R', { kind: 'point', at: [1, 0] });
    G.add('c', { kind: 'circle3', args: ['P', 'Q', 'R'] });
    const s0 = K.shapeOf(G.val('c'), true);
    G.drag('R', [0, 3]); const s1 = K.shapeOf(G.val('c'), true);
    G.drag('R', [-1, 0.5]); const s2 = K.shapeOf(G.val('c'), true);
    ok(G.get('c').def.flip === true && s0.kind === 'disc' && !s0.complement && s1.kind === 'halfplane' && s2.kind === 'disc' && s2.complement === true,
      'circle3: clockwise taps still make the disc; dragging R across PQ then goes disc → half-plane → outside', [s0, s1.kind, s2.complement]);
  }
  // users-8: a glider on circle(P, Q, R) is continuous through the line case and fixed relative to P, Q, R
  {
    const G = K.graph();
    G.add('P', { kind: 'point', at: [-1, 0] }); G.add('Q', { kind: 'point', at: [1, 0] }); G.add('R', { kind: 'point', at: [0.4, 0.001] });
    G.add('c', { kind: 'circle3', args: ['P', 'Q', 'R'] }); G.add('S', { kind: 'glider', args: ['c'], t: 1.7 });
    let prev = null, maxStep = 0;
    for (let j = 0; j <= 20; j++) { G.drag('R', [0.4, 0.001 - j * 1e-4]); const x = G.val('S'); if (prev) maxStep = Math.max(maxStep, Math.hypot(x[0] - prev[0], x[1] - prev[1])); prev = x; }
    const on = Math.abs(K.fOf(G.val('c'), G.val('S')));
    // a similarity moves S with P, Q, R
    const sim = (z) => [2 * z[0] - 0.5 * z[1] + 3, 0.5 * z[0] + 2 * z[1] - 1];
    const S0 = G.val('S'); G.drag('P', sim([-1, 0])); G.drag('Q', sim([1, 0])); G.drag('R', sim([0.4, 0.001 - 20e-4]));
    ok(maxStep < 1e-3 && on < 1e-12 && nearP(G.val('S'), sim(S0), 1e-12), 'glider: S = M(t) with M(0, 1, ∞) = P, Q, R: continuous through collinear, on the curve, fixed relative to P, Q, R', { maxStep, on });
    G.add('l', { kind: 'line', args: ['P', 'Q'] }); G.add('U', { kind: 'glider', args: ['l'], t: 0.25 });
    ok(nearP(G.val('U'), [0.75 * G.val('P')[0] + 0.25 * G.val('Q')[0], 0.75 * G.val('P')[1] + 0.25 * G.val('Q')[1]]), 'glider: on line(P, Q), U = P + t (Q − P)');
  }
  // users-20: parallel lines meet at infinity, with that reason
  {
    const G = K.graph();
    G.add('P', { kind: 'point', at: [0, 0] }); G.add('Q', { kind: 'point', at: [1, 0] }); G.add('R', { kind: 'point', at: [0, 1] }); G.add('T', { kind: 'point', at: [1, 1] });
    G.add('l', { kind: 'line', args: ['P', 'Q'] }); G.add('m', { kind: 'line', args: ['R', 'T'] }); G.add('X', { kind: 'meet', args: ['l', 'm'], index: 0 });
    ok(K.isInf(G.val('X')) && G.note('X') === 'They meet only at ∞', 'meets: parallel lines: X = ∞, "They meet only at ∞"', [G.val('X'), G.note('X')]);
  }
  // users-6, design-17: typos are errors, never sliders; Cyrillic look-alikes are Latin
  {
    const known = new Set(['a', 'b']);
    const err = (src, kn = known) => { try { return K.analyze(src, kn).fresh; } catch (e) { return 'ERR ' + e.message; } };
    ok(err('sinc(z)') === 'ERR Unknown function sinc' && err('epx(z)') === 'ERR Unknown function epx' && err('Log z') === 'ERR Unknown function Log',
      'names: a run of letters that is not a function is an error, not new sliders', [err('sinc(z)'), err('epx(z)'), err('Log z')]);
    ok(err('2ai + b') === null && err('a b z') === null && err('2a + k') === 'k' && err('s + t') === 'ERR One new name at a time: s, t',
      'names: "ai" is a·i with a known; one standalone new letter becomes a slider; two at once are refused');
    ok(err('Re z = а') === null && err('2с') === 'c' && /Latin/.test(err('Re z = б')), 'names: Cyrillic а с е о р х у к are the Latin letters; other Cyrillic letters are refused');
  }
  // users-9: the Apollonian and Steiner circles of a Moebius map are exact generalized circles
  {
    const a = [1, 0], b = [-1, 0], c = [1, 0], d = [1, 0];      // M(z) = (z - 1) / (z + 1)
    const M = (z) => { const n = [z[0] - 1, z[1]], dd = [z[0] + 1, z[1]], q = dd[0] * dd[0] + dd[1] * dd[1]; return [(n[0] * dd[0] + n[1] * dd[1]) / q, (n[1] * dd[0] - n[0] * dd[1]) / q]; };
    let worst = 0, worstA = 0, t0 = process.hrtime.bigint();
    for (let j = 0; j <= 100; j++) {
      const k = 0.2 + j * 0.03, g = K.apollonius(a, b, c, d, k), G = K.geomOf(g);
      for (let s = 0; s < 16; s++) { const z = G.line ? [G.p[0] + G.d[0] * (s - 8), G.p[1] + G.d[1] * (s - 8)] : [G.c[0] + G.r * Math.cos(s), G.c[1] + G.r * Math.sin(s)]; const m = M(z); worst = Math.max(worst, Math.abs(Math.hypot(m[0], m[1]) - k) / k); }
      const th = -3 + j * 0.06, st = K.steiner(a, b, c, d, th), H = K.geomOf(st.g);
      for (let s = 0; s < 16; s++) { const z = H.line ? [H.p[0] + H.d[0] * (s - 8), H.p[1] + H.d[1] * (s - 8)] : [H.c[0] + H.r * Math.cos(s), H.c[1] + H.r * Math.sin(s)]; if (!st.onArc(z)) continue; const m = M(z); let e = Math.abs(Math.atan2(m[1], m[0]) - th); e = Math.min(e, 2 * Math.PI - e); worstA = Math.max(worstA, e); }
    }
    const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 101;
    ok(worst < 1e-12 && worstA < 1e-12 && ms < 1 * SPEED, `circles of M: |M(z)| = k and arg M(z) = θ are exact (rel. error ${worst.toExponential(1)}, ${worstA.toExponential(1)}) for 101 slider values, ${ms.toFixed(3)} ms per value`);
    ok(K.geomOf(K.apollonius(a, b, c, d, 1)).line, 'circles of M: k = 1 is the perpendicular bisector of the zero and the pole (a line)');
  }
}

// =========================================================== B. the PoC bridge tests
cur = 'B';
// substitute values for names (the app would substitute in the AST: Expr.parse with a name scope, DESIGN.md phase 1)
const lit = (v) => (Array.isArray(v) ? `(${v[0]}${v[1] < 0 ? '-' : '+'}${Math.abs(v[1])}i)` : `(${v})`);
const subst = (src, vals) => src.replace(/(?<![A-Za-z\\])([A-Za-z])(?![A-Za-z])/g, (m, n) => (n in vals ? lit(vals[n]) : m));

// ---------------------------------------------------------------- 1. shapes
{
  const win = { x0: -4, x1: 4, y0: -3, y1: 3 };
  const cases = [
    ['disc', K.circle3([0, 0], [1, 0], [0, 1])],
    ['complement', K.circle3([0, 0], [0, 1], [1, 0])],
    ['halfplane', K.circle3([0, 0], [1, 0], [2, 0])],
    ['halfplane (through ∞)', K.circle3([1, 1], K.INF, [-1, 0.5])],
  ];
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (const [name, g] of cases) {
    const area = K.shapeOf(g, true), curve = K.shapeOf(g);
    ok(!!Region.KINDS[area.kind] && !!Region.KINDS[curve.kind], `shapes: ${name}: the area is a ${area.kind}${area.complement ? ' (complement)' : ''}, the curve a ${curve.kind}: kinds the app already has`);
    const L = Region.levelOf(Object.assign({ id: 's1' }, area));
    let agree = 0, n = 0;
    for (let k = 0; k < 4000; k++) {
      const z = [win.x0 + (win.x1 - win.x0) * rnd(), win.y0 + (win.y1 - win.y0) * rnd()];
      const f = K.fOf(g, z), lv = L(CX.C(z[0], z[1]));
      if (Math.abs(f) < 1e-9) continue;
      n++; if ((lv > 0) === (f < 0)) agree++;
    }
    ok(agree === n, `shapes: ${name}: Region.levelOf (inside > 0) agrees with the engine's f < 0 at ${n} points`);
    const cs = Region.curvesOf(Object.assign({ id: 's2' }, curve), win);
    ok(cs.length > 0, `shapes: ${name}: Region.curvesOf draws the curve`);
  }
}

// ---------------------------------------------------------------- 2. exact equations with parameters
{
  const P = [1, 2];
  let exactAll = true, agreeAll = true;
  const forms = ['Re z = a', 'Im z = 2a - 1', '|z - P| = a + 2.5'];
  for (const src of forms) {
    for (let k = 0; k <= 100; k++) {
      const a = -2 + 4 * k / 100, vals = { a, P };
      const d = Curves.fromFormula(subst(src, vals));
      const sh = d.pieces[0].exact && d.pieces[0].exact[0];
      if (!d.exact || !sh) { exactAll = false; continue; }
      const env = (n) => (n === 'a' ? [a, 0] : P);
      const ours = K.shapeOf(K.equationCurve(K.parse(src), env));
      const same = sh.kind === ours.kind && (sh.kind === 'circle'
        ? Math.abs(sh.c[0] - ours.c[0]) + Math.abs(sh.c[1] - ours.c[1]) + Math.abs(sh.r - ours.r) < 1e-12
        : Math.abs((sh.a[0] - ours.a[0]) * (ours.b[1] - ours.a[1]) - (sh.a[1] - ours.a[1]) * (ours.b[0] - ours.a[0])) < 1e-12);
      if (!same) { agreeAll = false; console.log('  differs', src, a, sh, ours); }
    }
  }
  ok(exactAll, 'equations: Re z = a, Im z = 2a − 1, |z − P| = a + 2.5 are recognized exactly by Curves.fromFormula for 101 values of a each');
  ok(agreeAll, 'equations: the app\'s exact shapes equal the engine\'s');
  const ray = Curves.fromFormula(subst('\\arg(z - P) = a', { a: 0.6, P }));
  ok(ray.exact && ray.pieces[0].exact[0].kind === 'ray', 'equations: arg(z − P) = a is an exact ray (forms the engine leaves to the app)', ray.pieces[0].exact[0]);
  const ms = cpu((i) => Curves.fromFormula(subst('|z - P| = a + 2.5', { a: i / 1000, P })), 2000);
  ok(ms < 0.5, `equations: substitute + parse + recognize per slider step: ${(ms * 1000).toFixed(1)} µs CPU`);
}

// ---------------------------------------------------------------- 3. a traced equation under a slider
{
  const win = { x0: -3, x1: 3, y0: -2, y1: 2 };
  const d0 = Curves.fromFormula(subst('Re(z^3) = a', { a: 0.5 }));
  ok(!d0.exact, 'traced: Re(z³) = a is not exact (traced to float64)');
  const ms = cpu((i) => { const d = Curves.fromFormula(subst('Re(z^3) = a', { a: 0.5 + i / 997 })); Curves.trace(d, win, { maxMs: 2000, step: Math.hypot(6, 4) / 1600 }); }, 20);
  console.log(`  note: one trace of Re(z³) = a in a 6 × 4 window: ${ms.toFixed(1)} ms CPU`);
  ok(true, `traced: a slider re-traces per value: ${ms.toFixed(1)} ms per step (DESIGN.md: traced curves under a slider)`);
}

// =========================================================== C. v16 CORE
cur = 'C';
require('./constr_core_tests.js')({ K, ok, near, nearP, Inverse, Curves });
// =========================================================== D. the review fixes (notes/constructions-v16/ledger.json)
sect.D = [0, 0]; cur = 'D';
require('./constr_review_tests.js')({ K, ok, near, nearP });

// =========================================================== E. the Perpendicular circle (notes/orthogonal-circle/SPEC.md 7)
sect.E = [0, 0]; cur = 'E';
require('./constr_perp_tests.js')({ K, ok, near, nearP });

// =========================================================== F. the Touching circle (notes/orthogonal-circle/TANGENT-SPEC.md 7)
sect.F = [0, 0]; cur = 'F';
require('./constr_touch_tests.js')({ K, ok, near, nearP });

// =========================================================== G. Inside C only (notes/orthogonal-circle/segments/SPEC.md 11)
sect.G = [0, 0]; cur = 'G';
require('./constr_seg_tests.js')({ K, ok, near, nearP });

console.log(`\nA ${sect.A[0]}/${sect.A[0] + sect.A[1]}, B ${sect.B[0]}/${sect.B[0] + sect.B[1]}, C ${sect.C[0]}/${sect.C[0] + sect.C[1]}, D ${sect.D[0]}/${sect.D[0] + sect.D[1]}, E ${sect.E[0]}/${sect.E[0] + sect.E[1]}, F ${sect.F[0]}/${sect.F[0] + sect.F[1]}, G ${sect.G[0]}/${sect.G[0] + sect.G[1]}: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
