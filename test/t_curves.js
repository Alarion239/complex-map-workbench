// Curves (1-dimensional regions: equations), run: node test/t_curves.js
// - parsing and classification of '=' (Expr.parse allowRel, Expr.classifyRelation, toTex, compileLevel's refusal)
// - exact recognition (lines, circles, rays, Apollonius, points) and exact restriction (rays, segments, arcs)
// - traced curves against analytic truth: every sample within max(1e-9 |z|, 1e-12) of the true curve, no missed
//   pieces in the window, topology (open / closed / ends at infinity)
// - restriction clipping, unions, NaN regions, singular points, error messages, Region integration
global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
global.Funcs = require('../src/funcs.js');
global.Region = require('../src/region.js');
const Curves = require('../src/curves.js');
const { C } = CX;
let fails = 0, passes = 0;
const ok = (cond, msg, extra) => {
  if (cond) passes++; else fails++;
  console.log((cond ? 'PASS ' : 'FAIL ') + msg + (extra !== undefined ? ' ' + JSON.stringify(extra) : ''));
};
const near = (a, b, tol = 1e-12) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const P = (src) => Expr.parse(src, { allowRel: true });
const throwsMsg = (f) => { try { f(); return null; } catch (e) { return e; } };

// ---------------------------------------------------------------- 1. parsing and classification
{
  const a = P('Re z = 0');
  ok(a.t === 'cmp' && a.op === '=', "'=' parses to {t: 'cmp', op: '='} in allowRel mode");
  ok(Expr.toTex(a).s === '\\operatorname{Re} z = 0', 'toTex renders =', Expr.toTex(a).s);
  ok(P('Re z == 1').op === '=' && P('Re z ＝ 1').op === '=', "'==' and the full-width '＝' are equations too");
  const e = throwsMsg(() => Expr.parse('Re z = 0'));
  ok(e && e.message === "Unexpected '='" && e.pos === 5, "without allowRel '=' is still an unexpected character (same message and position)", e && [e.message, e.pos]);
  const e2 = throwsMsg(() => Expr.compileLevel(P('Re z = 0')));
  ok(e2 && /curve/.test(e2.message), 'compileLevel refuses an equation with a clear message', e2 && e2.message);
  ok(near(Expr.compileLevel(P('|z| < 1'))(C(0.3, 0.4)), 0.5), 'area formulas keep their level function');
  // round trip through toTex
  for (const s of ['|z| = 1, \\operatorname{Im} z > 0', 'Re z = 0 or Im z = 0', 'Re z = 0 < Im z']) {
    const t = Expr.toTex(P(s)).s, c1 = Expr.classifyRelation(P(s)), c2 = Expr.classifyRelation(P(t));
    ok(c1.dim === 'curve' && c2.dim === 'curve' && c1.pieces.length === c2.pieces.length, `toTex round trip keeps the curve: ${s} -> ${t}`);
  }
  const cls = (s) => Expr.classifyRelation(P(s));
  ok(cls('|z| < 1').dim === 'area' && cls('1 < |z| < 2, Re z > 0').dim === 'area' && cls('\\neg(|z|<1) or Im z > 0').dim === 'area', 'inequalities only: area');
  ok(cls('z^2').dim === 'none' && /comparison/.test(cls('z^2').error), 'no comparison: none, with a message');
  const c1 = cls('Re z = 0');
  ok(c1.dim === 'curve' && c1.pieces.length === 1 && c1.pieces[0].restrict === null && c1.pieces[0].real === 'structural', 'an equation is a curve', c1.pieces && c1.pieces[0].real);
  const c2 = cls('Re z = 0, Im z > 0');
  ok(c2.dim === 'curve' && c2.pieces[0].restrict && c2.pieces[0].restrict.t === 'cmp', "an equation 'and' an inequality: a restricted curve");
  const c3 = cls('Re z = 0 < Im z');
  ok(c3.dim === 'curve' && c3.pieces[0].restrict && c3.pieces[0].restrict.op === '<', 'a chain a = b < c: the equation restricted by the inequality');
  const c4 = cls('(Re z = 0 or |z| = 1), Im z > 0');
  ok(c4.dim === 'curve' && c4.pieces.length === 2 && c4.pieces.every((p) => p.restrict), "'or' of equations, restricted: every piece carries the restriction");
  const c5 = cls('Re z = 0, Im z > 0 or |z| = 1, Re z < 0');
  ok(c5.dim === 'curve' && c5.pieces.length === 2 && c5.pieces.every((p) => p.restrict), 'union of two restricted curves');
  ok(cls('z \\bar z = 1').pieces[0].real === 'numeric', 'z conj z = 1: real at every test point (numeric)');
  ok(cls('\\ln(\\operatorname{Re} z) = 0').pieces[0].real === 'partial', 'ln(Re z) = 0: real on part of the plane (partial)');
  const errs = [
    ['z = 1', 'complex', /must be real/], ['z^2 = i', 'complex', /Re, Im/], ['Re z = 1, Im z = 2', 'points', /isolated points/],
    ['Re z = Im z = 0', 'chain', /a = b = c/], ['Re z = 0 or |z| < 1', 'mix', /mixes a curve with an area/],
    ['\\neg(Re z = 0)', 'not', /'not' of an equation/], ['1 = 1', 'constant', /does not involve z/],
    ['|z| = |z|', 'identity', /equal for every z/], ['Re z = 0 or not (Im z = 1)', 'not', /'not'/],
  ];
  for (const [s, key, re] of errs) {
    const c = cls(s);
    ok(c.dim === 'error' && re.test(c.error) && c.error === Expr.REL_MSG[key], `error (${key}): ${s}`, c.error);
  }
}

// ---------------------------------------------------------------- 2. exact recognition
const shapes = (s) => Curves.shapesOf(Curves.fromFormula(s));
const lineOK = (sh, f) => {
  // two points of the line satisfy f = 0, the direction is a unit vector
  if (!sh || sh.kind !== 'line') return false;
  const d = Math.hypot(sh.b[0] - sh.a[0], sh.b[1] - sh.a[1]);
  return near(d, 1, 1e-15) && Math.abs(f(sh.a[0], sh.a[1])) <= 1e-12 && Math.abs(f(sh.b[0], sh.b[1])) <= 1e-12;
};
{
  let s = shapes('Re z = 0');
  ok(s.length === 1 && lineOK(s[0], (x) => x) && s[0].a[0] === 0 && s[0].b[0] === 0, 'Re z = 0: the imaginary axis, exactly', s);
  s = shapes('Im z = -1.5');
  ok(s.length === 1 && lineOK(s[0], (x, y) => y + 1.5) && s[0].a[1] === -1.5 && s[0].b[1] === -1.5, 'Im z = -1.5: a horizontal line, exactly', s);
  s = shapes('x + 2y = 3');
  ok(s.length === 1 && lineOK(s[0], (x, y) => x + 2 * y - 3) && s[0].a[0] === 0.6 && s[0].a[1] === 1.2, 'x + 2y = 3: a line through 0.6 + 1.2i', s);
  s = shapes('\\operatorname{Re}((1+i)z) = 1');
  ok(s.length === 1 && lineOK(s[0], (x, y) => x - y - 1), 'Re((1+i)z) = 1: the line x - y = 1', s);
  s = shapes('3\\operatorname{Im}(z - 2i) + 1 = 0');
  ok(s.length === 1 && lineOK(s[0], (x, y) => 3 * (y - 2) + 1), '3 Im(z - 2i) + 1 = 0: a horizontal line', s);
  const circ = (s0, c, r) => s0.length === 1 && s0[0].kind === 'circle' && near(s0[0].c[0], c[0]) && near(s0[0].c[1], c[1]) && near(s0[0].r, r);
  ok(circ(shapes('|z - 1| = 2'), [1, 0], 2), '|z - 1| = 2: circle centre 1 radius 2', shapes('|z - 1| = 2'));
  ok(circ(shapes('2|z+i| = 3'), [0, -1], 1.5), '2|z + i| = 3: circle centre -i radius 1.5');
  ok(circ(shapes('|2z - 2 - 4i| = 6'), [1, 2], 3), '|2z - 2 - 4i| = 6: circle centre 1 + 2i radius 3');
  ok(circ(shapes('|\\overline{z} - i| = 1'), [0, -1], 1), '|conj z - i| = 1: circle centre -i');
  ok(circ(shapes('|z|^2 = 4'), [0, 0], 2), '|z|^2 = 4: radius 2');
  ok(circ(shapes('z\\bar z = 2'), [0, 0], Math.SQRT2), 'z conj z = 2: radius sqrt 2 (numeric quadric)');
  ok(circ(shapes('x^2 + y^2 - 2x = 3'), [1, 0], 2), 'x^2 + y^2 - 2x = 3: circle centre 1 radius 2');
  ok(circ(shapes('|z - 1| = 2|z + 1|'), [-5 / 3, 0], 4 / 3), '|z - 1| = 2|z + 1|: the Apollonius circle', shapes('|z - 1| = 2|z + 1|'));
  s = shapes('|z - 1| = |z + 1|');
  ok(s.length === 1 && lineOK(s[0], (x) => x), '|z - 1| = |z + 1|: the perpendicular bisector Re z = 0', s);
  let d = Curves.fromFormula('|z| = -1');
  ok(Curves.shapesOf(d).length === 0 && /negative/.test(d.notes[0]), '|z| = -1: no points, with a note', d.notes);
  d = Curves.fromFormula('|z - 1 - i| = 0');
  s = Curves.shapesOf(d);
  ok(s.length === 1 && s[0].kind === 'point' && s[0].p[0] === 1 && s[0].p[1] === 1 && /single point/.test(d.notes[0]), '|z - 1 - i| = 0: the single point 1 + i, with a note', d.notes);
  s = shapes('\\arg z = \\pi/4');
  ok(s.length === 1 && s[0].kind === 'ray' && s[0].a[0] === 0 && s[0].a[1] === 0 && near(s[0].b[0], Math.SQRT1_2, 1e-15) && near(s[0].b[1], Math.SQRT1_2, 1e-15), 'arg z = pi/4: the ray from 0 at 45 degrees', s);
  s = shapes('\\arg(z - 1) = -\\pi/2');
  ok(s.length === 1 && s[0].kind === 'ray' && s[0].a[0] === 1 && s[0].b[0] === 1 && s[0].b[1] === -1, 'arg(z - 1) = -pi/2: the ray from 1 downward', s);
  s = shapes('\\arg(iz) = 0');
  ok(s.length === 1 && s[0].kind === 'ray' && s[0].b[0] === 0 && s[0].b[1] === -1, 'arg(iz) = 0: the negative imaginary axis', s);
  d = Curves.fromFormula('\\arg z = -\\pi');
  ok(Curves.shapesOf(d).length === 0 && /\(−π, π\]/.test(d.notes[0]), 'arg z = -pi: no points (arg takes values in (-pi, pi])', d.notes);
  s = shapes('|\\operatorname{Re} z| = 0');
  ok(s.length === 1 && lineOK(s[0], (x) => x), '|Re z| = 0: the touching zero is stripped (Re z = 0)', s);
  ok(!Curves.fromFormula('Re z^2 = 1').exact, 'Re z^2 = 1 is not recognized exactly (traced)');
  // exact restriction
  s = shapes('Re z = 0, Im z > 0');
  ok(s.length === 1 && s[0].kind === 'ray' && s[0].a[0] === 0 && s[0].a[1] === 0 && s[0].b[0] === 0 && s[0].b[1] === 1, 'Re z = 0, Im z > 0: the ray from 0 upward, exactly', s);
  s = shapes('Re z = 0 < Im z');
  ok(s.length === 1 && s[0].kind === 'ray' && s[0].a[1] === 0 && s[0].b[1] === 1, 'Re z = 0 < Im z (a chain): the same ray', s);
  s = shapes('Re z = 0, |z| < 2');
  ok(s.length === 1 && s[0].kind === 'segment' && s[0].a[1] === -2 && s[0].b[1] === 2, 'Re z = 0, |z| < 2: the segment from -2i to 2i', s);
  s = shapes('|z| = 1, Re z > 0');
  ok(s.length === 1 && s[0].kind === 'arc' && s[0].a[0] === 0 && s[0].a[1] === -1 && s[0].m[0] === 1 && s[0].b[1] === 1, '|z| = 1, Re z > 0: the right half circle as an arc -i -> 1 -> i', s);
  s = shapes('|z| = 1, |z - 1| < 1');
  ok(s.length === 1 && s[0].kind === 'arc' && near(s[0].a[0], 0.5) && near(s[0].a[1], -Math.sqrt(3) / 2) && near(s[0].b[1], Math.sqrt(3) / 2), '|z| = 1, |z - 1| < 1: the arc between the circles\' intersections', s);
  s = shapes('|z| = 1, Re z < 0');
  ok(s.length === 1 && s[0].kind === 'arc' && s[0].a[1] === 1 && s[0].m[0] === -1 && s[0].b[1] === -1, '|z| = 1, Re z < 0: an arc across the angle 0 (i -> -1 -> -i)', s);
  s = shapes('\\arg z = \\pi/4, |z| < 1');
  ok(s.length === 1 && s[0].kind === 'segment' && s[0].a[0] === 0 && near(Math.hypot(s[0].b[0], s[0].b[1]), 1, 1e-15), 'arg z = pi/4, |z| < 1: a segment from 0', s);
  s = shapes('Im z = 0, Re z > 1 or Re z = 1');
  ok(s.length === 2 && s[0].kind === 'ray' && s[0].a[0] === 1 && s[1].kind === 'line', 'union: a ray and a line', s);
  d = Curves.fromFormula('|z| = 1, Re z > 2');
  ok(Curves.shapesOf(d).length === 0 && d.notes.some((n) => /restriction/.test(n)), '|z| = 1, Re z > 2: nothing left, with a note', d.notes);
  s = shapes('Re z = 0, 1 < |z| < 2');
  ok(s.length === 2 && s.every((q) => q.kind === 'segment'), 'Re z = 0, 1 < |z| < 2: two segments', s);
}

// ---------------------------------------------------------------- 3. traced curves against analytic truth
// truth: F (cancellation-free implicit form) and its gradient; ref(n): points of the true curve, for coverage
const TRUTH = {
  'Re z^2 = 1': {
    F: (x, y) => x * x - y * y - 1, dF: (x, y) => [2 * x, -2 * y],
    ref: () => { const o = []; for (let i = -400; i <= 400; i++) { const t = 3 * i / 400; o.push([Math.cosh(t), Math.sinh(t)], [-Math.cosh(t), Math.sinh(t)]); } return o; },
    shape: (r) => r.polys.length === 2 && r.polys.every((c) => !c.closed && c.ends[0] === 'inf' && c.ends[1] === 'inf'), what: 'two branches, both ends at infinity',
  },
  '|z^2 - 1| = 1': {
    F: (x, y) => (x * x + y * y) ** 2 - 2 * (x * x - y * y), dF: (x, y) => [4 * x * (x * x + y * y) - 4 * x, 4 * y * (x * x + y * y) + 4 * y],
    ref: () => { const o = []; for (let i = 0; i <= 800; i++) { const t = -Math.PI / 4 + Math.PI / 2 * i / 800, r = Math.sqrt(Math.max(0, 2 * Math.cos(2 * t))); o.push([r * Math.cos(t), r * Math.sin(t)], [-r * Math.cos(t), r * Math.sin(t)]); } return o; },
    shape: (r) => r.polys.length === 1 && r.polys[0].closed && minAbs(r.polys[0].pts) < 1e-12, what: 'one closed figure-eight with a vertex at the crossing 0',
  },
  'Im(1/z) = 1': {
    F: (x, y) => x * x + y * y + y, dF: (x, y) => [2 * x, 2 * y + 1],
    ref: () => { const o = []; for (let i = 0; i < 800; i++) { const t = 2 * Math.PI * i / 800; if (Math.abs(t - Math.PI / 2) > 0.01) o.push([0.5 * Math.cos(t), -0.5 + 0.5 * Math.sin(t)]); } return o; },
    shape: (r) => r.polys.length === 1 && r.polys[0].closed, what: 'one closed circle through 0 (the gap at the undefined point 0 bridged)',
  },
  'Re e^z = 1': {
    F: (x, y) => Math.exp(x) * Math.cos(y) - 1, dF: (x, y) => [Math.exp(x) * Math.cos(y), -Math.exp(x) * Math.sin(y)],
    ref: () => { const o = []; for (let i = -799; i <= 799; i++) { const y = Math.PI / 2 * i / 800; o.push([-Math.log(Math.cos(y)), y]); } return o; },
    shape: (r) => r.polys.length === 1 && !r.polys[0].closed, what: 'one open curve',
  },
  '|\\sin z| = 1': {
    F: (x, y) => Math.sinh(y) ** 2 - Math.cos(x) ** 2, dF: (x, y) => [2 * Math.cos(x) * Math.sin(x), 2 * Math.sinh(y) * Math.cosh(y)],
    ref: () => { const o = []; for (let i = -800; i <= 800; i++) { const x = 6 * i / 800; o.push([x, Math.asinh(Math.cos(x))], [x, -Math.asinh(Math.cos(x))]); } return o; },
    shape: (r, win) => r.polys.length === 2 && r.polys.every((c) => !c.closed && spanX(c.pts) > 10 * (win.x1 - win.x0)), what: 'two wavy branches through the crossings, reaching far in both directions',
  },
};
function minAbs(p) { let m = Infinity; for (let i = 0; i < p.length; i += 2) m = Math.min(m, Math.hypot(p[i], p[i + 1])); return m; }
function spanX(p) { let a = Infinity, b = -Infinity; for (let i = 0; i < p.length; i += 2) { a = Math.min(a, p[i]); b = Math.max(b, p[i]); } return b - a; }
// distance from q to the union of polylines (segments)
function distToPolys(polys, q) {
  let best = Infinity;
  for (const c of polys) {
    const p = c.pts;
    for (let i = 0; i + 3 < p.length; i += 2) {
      const ax = p[i], ay = p[i + 1], dx = p[i + 2] - ax, dy = p[i + 3] - ay, L2 = dx * dx + dy * dy;
      let t = L2 > 0 ? ((q[0] - ax) * dx + (q[1] - ay) * dy) / L2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const d = Math.hypot(q[0] - ax - t * dx, q[1] - ay - t * dy);
      if (d < best) best = d;
    }
  }
  return best;
}
const WINS = [{ x0: -2, x1: 2, y0: -2, y1: 2 }, { x0: -2.3, x1: 1.9, y0: -1.7, y1: 2.2 }, { x0: -4, x1: 4, y0: -3, y1: 3 }];
for (const [src, T] of Object.entries(TRUTH)) {
  for (const win of WINS) {
    const d = Curves.fromFormula(src);
    const t0 = Date.now();
    const r = Curves.trace(d, win);
    const ms = Date.now() - t0;
    let worst = 0, wz = null, n = 0;
    for (const c of r.polys) for (let i = 0; i < c.pts.length; i += 2) {
      const x = c.pts[i], y = c.pts[i + 1], g = T.dF(x, y), gl = Math.hypot(g[0], g[1]);
      const dist = gl > 0 ? Math.abs(T.F(x, y)) / gl : (T.F(x, y) === 0 ? 0 : Infinity);
      const rel = dist / Math.max(1e-9 * Math.hypot(x, y), 1e-12);
      n++;
      if (!(rel <= worst)) { worst = rel; wz = [x, y, dist]; }
    }
    const tag = `${src} in [${win.x0}, ${win.x1}] x [${win.y0}, ${win.y1}]`;
    ok(n > 100 && worst <= 1, `${tag}: all ${n} samples within max(1e-9 |z|, 1e-12) of the true curve (worst ${worst.toExponential(2)} of the tolerance) [${ms} ms]`, worst > 1 ? wz : undefined);
    // coverage: every reference point of the true curve inside the window lies within 1e-4 x diagonal of the polylines
    const diag = Math.hypot(win.x1 - win.x0, win.y1 - win.y0);
    let miss = 0, maxGap = 0;
    for (const q of T.ref()) {
      if (q[0] < win.x0 || q[0] > win.x1 || q[1] < win.y0 || q[1] > win.y1) continue;
      const dd = distToPolys(r.polys, q);
      if (dd > 1e-4 * diag) miss++;
      maxGap = Math.max(maxGap, dd);
    }
    ok(miss === 0, `${tag}: no part of the true curve in the window is missed (largest distance ${maxGap.toExponential(2)})`, miss ? miss : undefined);
    ok(T.shape(r, win), `${tag}: ${T.what}`, r.polys.map((c) => (c.closed ? 'closed' : c.ends.join('/')) + ':' + c.pts.length / 2));
    ok(ms < 1500, `${tag}: traced in ${ms} ms`);
  }
}
// the far ends of the hyperbola reach the FAR box (toward infinity)
{
  const win = WINS[0], d = Curves.fromFormula('Re z^2 = 1'), ps = Curves.sample(d, win);
  const far = Math.max(...ps.map((p) => Math.max(Math.hypot(p[0], p[1]), Math.hypot(p[p.length - 2], p[p.length - 1]))));
  ok(ps.every((p) => p.inf[0] && p.inf[1]) && far > 0.9 * Curves.FAR * 2, 'Re z^2 = 1: both ends of each branch are marked inf and reach the FAR box', far);
  // geometric spacing outward, like Region's long curves (ratio <= 1.25 between neighbouring steps far out)
  const p = ps[0];
  let maxRatio = 0;
  for (let i = 2; i + 1 < p.length / 2; i++) {
    const s1 = Math.hypot(p[2 * i] - p[2 * i - 2], p[2 * i + 1] - p[2 * i - 1]), s2 = Math.hypot(p[2 * i + 2] - p[2 * i], p[2 * i + 3] - p[2 * i + 1]);
    if (Math.hypot(p[2 * i], p[2 * i + 1]) > 10) maxRatio = Math.max(maxRatio, s2 / s1, s1 / s2);
  }
  ok(maxRatio <= 1.26, 'Re z^2 = 1: far samples grow geometrically (neighbouring steps within 1.25x)', maxRatio);
}

// ---------------------------------------------------------------- 4. restrictions, unions, NaN regions, singular points
const WIN = { x0: -3, x1: 3, y0: -3, y1: 3 };
{
  // the traced version of Re z = 0, Im z > 0 (exact recognition off): a ray from 0
  const d = Curves.fromFormula('Re z = 0, Im z > 0', { exact: false });
  const r = Curves.trace(d, WIN);
  const c = r.polys[0];
  const allOn = r.polys.every((q) => { for (let i = 0; i < q.pts.length; i += 2) if (Math.abs(q.pts[i]) > 1e-12 || q.pts[i + 1] < -1e-12) return false; return true; });
  ok(r.polys.length === 1 && c.ends[0] === 'clip' && c.ends[1] === 'inf' && Math.hypot(c.pts[0], c.pts[1]) <= 1e-12 && allOn, 'traced Re z = 0, Im z > 0: one ray from 0 (cut within 1e-12 of 0) to infinity', r.polys.map((q) => [q.ends, q.pts[0], q.pts[1]]));
}
{
  const r = Curves.trace(Curves.fromFormula('Re z^2 = 1, |z| < 2'), WIN);
  const endsOK = r.polys.every((c) => { const n = c.pts.length; return [[c.pts[0], c.pts[1]], [c.pts[n - 2], c.pts[n - 1]]].every(([x, y]) => Math.abs(Math.hypot(x, y) - 2) <= 1e-12 && Math.abs(x * x - y * y - 1) <= 1e-12); });
  ok(r.polys.length === 2 && r.polys.every((c) => c.ends[0] === 'clip' && c.ends[1] === 'clip') && endsOK, 'Re z^2 = 1, |z| < 2: two arcs, cut exactly on |z| = 2 and on the hyperbola');
}
{
  const r = Curves.trace(Curves.fromFormula('|z^2 - 1| = 1, Im z > 0'), WIN);
  const upper = r.polys.every((c) => { for (let i = 1; i < c.pts.length; i += 2) if (c.pts[i] < -1e-15) return false; return true; });
  ok(r.polys.length === 2 && upper, '|z^2 - 1| = 1, Im z > 0: the two upper halves of the lemniscate', r.polys.map((c) => c.pts.length / 2));
}
{
  const d = Curves.fromFormula('Re z^2 = 1 or |z^2 - 1| = 1');
  const r = Curves.trace(d, WIN);
  ok(d.pieces.length === 2 && r.polys.filter((c) => c.piece === 0).length === 2 && r.polys.filter((c) => c.piece === 1 && c.closed).length === 1, "'or': the hyperbola's two branches and the lemniscate");
  const d2 = Curves.fromFormula('Re z = 0 or Im z = 0');
  ok(d2.exact && Curves.shapesOf(d2).length === 2 && Curves.sample(d2, WIN).length === 2, "'or' of two exact lines");
  const d3 = Curves.fromFormula('Re z = 1 or Re z^2 = 1');
  ok(!d3.exact && d3.pieces[0].exact && !d3.pieces[1].exact && Curves.trace(d3, WIN).polys.length === 3, 'a union of an exact line and a traced curve');
}
{
  // NaN regions: ln(Re z) is undefined (not real) for Re z < 0; sqrt(1 - |z|^2) outside the unit disc
  let r = Curves.trace(Curves.fromFormula('\\ln(\\operatorname{Re} z) = 0'), WIN);
  const onLine = r.polys.every((c) => { for (let i = 0; i < c.pts.length; i += 2) if (Math.abs(c.pts[i] - 1) > 1e-12) return false; return true; });
  ok(r.polys.length === 1 && onLine, 'ln(Re z) = 0: the line Re z = 1 (the half-plane where it is undefined skipped)');
  r = Curves.trace(Curves.fromFormula('\\sqrt{1 - |z|^2} = 0.5'), WIN);
  const onC = r.polys.every((c) => { for (let i = 0; i < c.pts.length; i += 2) if (Math.abs(Math.hypot(c.pts[i], c.pts[i + 1]) - Math.sqrt(0.75)) > 1e-12) return false; return true; });
  ok(r.polys.length === 1 && r.polys[0].closed && onC, 'sqrt(1 - |z|^2) = 0.5: the closed circle |z| = sqrt(3)/2');
  r = Curves.trace(Curves.fromFormula('Re \\tan z = 0'), WIN);
  // (the grid box, 1.5 x the window, holds Re z = k pi / 2 for |k| <= 2)
  const xs = r.polys.map((c) => c.pts[0]).sort((a, b) => a - b), want = [-2, -1, 0, 1, 2].map((k) => k * Math.PI / 2);
  ok(r.polys.length === 5 && xs.every((x, k) => Math.abs(x - want[k]) <= 1e-12) && r.polys.every((c) => !c.closed && c.ends.every((e) => e === 'inf')), 'Re tan z = 0: the lines Re z = k pi/2 (the poles on them bridged), no false curves along the jumps', xs);
  r = Curves.trace(Curves.fromFormula('\\arg(z^2) = \\pi/2'), WIN);
  ok(r.polys.length === 1 && r.polys[0].ends.every((e) => e === 'inf'), 'arg(z^2) = pi/2: the diagonal line, no false curves along the branch cut', r.polys.map((c) => c.ends));
}
{
  // singular points: a crossing at 0 (Re z^2 = 0), a triple crossing (Re z^3 = 0), a cusp (y^2 = x^3)
  let r = Curves.trace(Curves.fromFormula('Re(z^2) = 0'), WIN);
  const diag = r.polys.every((c) => { for (let i = 0; i < c.pts.length; i += 2) if (Math.abs(Math.abs(c.pts[i]) - Math.abs(c.pts[i + 1])) > 1e-12 * Math.max(1, Math.abs(c.pts[i]))) return false; return true; });
  ok(r.polys.length === 2 && diag && r.polys.every((c) => minAbs(c.pts) < 1e-12), 'Re z^2 = 0: two straight lines crossing at 0, both through a vertex at 0');
  r = Curves.trace(Curves.fromFormula('Re(z^3) = 0'), WIN);
  ok(r.polys.length === 3 && r.polys.every((c) => c.ends.every((e) => e === 'inf')), 'Re z^3 = 0: three lines through 0', r.polys.length);
  r = Curves.trace(Curves.fromFormula('y^2 = x^3'), WIN);
  let worst = 0;
  for (const c of r.polys) for (let i = 0; i < c.pts.length; i += 2) {
    const x = c.pts[i], y = c.pts[i + 1];
    // distance to (t^2, t^3): Newton on the nearest parameter
    let t = Math.sign(y) * Math.sqrt(Math.max(0, x));
    for (let k = 0; k < 50; k++) { const fx = t * t - x, fy = t * t * t - y, f1 = 2 * t * fx + 3 * t * t * fy, f2 = 2 * fx + 4 * t * t + 6 * t * fy + 9 * t ** 4; if (!(f2 > 0)) break; t -= f1 / f2; }
    const dd = Math.hypot(t * t - x, t ** 3 - y);
    worst = Math.max(worst, dd / Math.max(1e-9 * Math.hypot(x, y), 1e-12));
  }
  ok(r.polys.length === 1 && worst <= 1 && minAbs(r.polys[0].pts) < 1e-9, 'y^2 = x^3: one curve through the cusp, every sample on it', worst);
  r = Curves.trace(Curves.fromFormula('\\operatorname{Im}(z + 1/z) = 0'), WIN);
  ok(r.polys.length === 2 && r.polys.filter((c) => c.closed).length === 1, 'Im(z + 1/z) = 0: the real axis and the unit circle, crossing at +-1, kept apart', r.polys.map((c) => c.closed));
  // near-tangency: two circles 0.001 apart
  r = Curves.trace(Curves.fromFormula('(|z| - 1)(|z - 2.001| - 1) = 0'), WIN);
  let w2 = 0;
  for (const c of r.polys) for (let i = 0; i < c.pts.length; i += 2) { const x = c.pts[i], y = c.pts[i + 1]; w2 = Math.max(w2, Math.min(Math.abs(Math.hypot(x, y) - 1), Math.abs(Math.hypot(x - 2.001, y) - 1))); }
  ok(r.polys.length === 2 && r.polys.every((c) => c.closed) && w2 <= 1e-12, 'two circles 0.001 apart (near-tangency): two closed circles, samples on them', [r.polys.length, w2]);
}

// ---------------------------------------------------------------- 5. errors
{
  const cases = [['z = 1', /must be real/, 'error'], ['Re z = 1, Im z = 2', /isolated points/, 'error'], ['|z| < 1', /area/, 'area'], ['z^2', /comparison/, 'none'], ['Re z = 0 or |z| < 1', /mixes/, 'error']];
  for (const [s, re, dim] of cases) {
    const e = throwsMsg(() => Curves.fromFormula(s));
    ok(e instanceof Expr.ParseError && re.test(e.message) && e.dim === dim, `fromFormula('${s}') throws: ${e && e.message}`);
    const dd = Curves.dimOf(s);
    ok(dd.dim === dim, `dimOf('${s}') = ${dd.dim} (no throw)`);
  }
  const e = throwsMsg(() => Curves.fromFormula('Re z = '));
  ok(e instanceof Expr.ParseError && Curves.dimOf('Re z = ').dim === 'error', 'a syntax error is a ParseError; dimOf reports it', e && e.message);
  ok(Curves.dimOf('Re z = 0').dim === 'curve' && Curves.dimOf('|z| < 1').dim === 'area', 'dimOf routes curves and areas');
}

// ---------------------------------------------------------------- 6. API and Region integration
{
  const d = Curves.fromFormula('|z^2 - 1| = 1');
  const s1 = Curves.sample(d, WIN);
  ok(s1.length === 1 && s1[0] instanceof Float64Array && s1[0].closed === true && s1[0][0] === s1[0][s1[0].length - 2], 'sample: Float64Array polylines (closed: first point repeated)');
  ok(Curves.trace(d, WIN) === Curves.trace(d, WIN), 'trace is cached per window');
  ok(Curves.isClosed(d, WIN) && Curves.loops(d, WIN).length === 2, 'the lemniscate is closed (one traced loop; for integrals two simple ccw lobes, review P5)');
  ok(!Curves.isClosed(Curves.fromFormula('Re z^2 = 1'), WIN), 'the hyperbola is not closed');
  const lc = Curves.loops(Curves.fromFormula('Im(1/z) = 1'), WIN);
  ok(lc.length === 1 && near(lc[0].area, Math.PI / 4, 1e-4), 'loops: counterclockwise (area +pi/4 for the circle of radius 1/2)', lc[0] && lc[0].area);
  ok(Curves.isClosed(Curves.fromFormula('|z - 1| = 2'), WIN) && !Curves.isClosed(Curves.fromFormula('|z| = 1, Re z > 0'), WIN), 'exact circles are closed, arcs are not');
  const cs = Curves.curvesOf(d, WIN);
  const view = { cx: 0, cy: 0, s: 100, w: 600, h: 600 };
  ok(cs.length === 1 && cs[0].traced && cs[0].closed && typeof cs[0].f === 'function', 'curvesOf: traced polylines as Region.polyCurve');
  ok(Region.mapCurve(cs[0], (z) => CX.mul(z, z), view).length >= 1, 'Region.mapCurve maps a traced curve');
  ok(Region.hitTest({ kind: 'curve', pts: Array.from({ length: s1[0].length / 2 }, (_, i) => [s1[0][2 * i], s1[0][2 * i + 1]]) }, C(Math.SQRT2, 0), 0.01, WIN), 'Region.hitTest finds a traced sample point');
  const hyp = Curves.curvesOf(Curves.fromFormula('Re z^2 = 1'), WIN, { reach: 'sphere' });
  ok(hyp.length === 2 && hyp.every((c) => c.outer && c.openSides && c.cell > 0), "curvesOf {reach: 'sphere'}: ends at infinity carry outer / openSides / cell for Lines.refine");
  const ref = Region.Lines.refine(hyp, [(z) => CX.inv(z)], null, { win: WIN, origin: [0, 0] });
  const reach = Math.max(...ref.map((p) => Math.max(Math.abs(p[0]), Math.abs(p[p.length - 2]))));
  ok(ref.length >= 2 && reach > 1e6, "Lines.refine continues the traced ends toward infinity (reach 'sphere')", reach);
  const ex = Curves.curvesOf(Curves.fromFormula('Re z = 0, Im z > 0'), WIN, { reach: 'sphere' });
  ok(ex.length === 1 && ex[0].long && ex[0].reach, "exact shapes use Region's own curves (a ray: long, with reach)");
  const ce = Curves.sample(Curves.fromFormula('|z - 1| = 2'), WIN);
  let w = 0;
  for (let i = 0; i < ce[0].length; i += 2) w = Math.max(w, Math.abs(Math.hypot(ce[0][i] - 1, ce[0][i + 1]) - 2));
  ok(ce.length === 1 && ce[0].closed && w < 1e-14, 'an exact circle is sampled on the circle', w);
}

// ---------------------------------------------------------------- 9. review fixes
{
  const cls = (s) => Expr.classifyRelation(P(s));
  const W2 = { x0: -2, x1: 2, y0: -2, y1: 2 }, COARSE = { x0: -7.3, x1: 9.1, y0: -5.2, y1: 6.4 };
  const allPts = (r) => r.polys.flatMap((c) => Array.from({ length: c.pts.length / 2 }, (_, i) => [c.pts[2 * i], c.pts[2 * i + 1]]));
  const tol = (x, y) => Math.max(1e-9 * Math.hypot(x, y), 1e-12);

  // (1) sides equal on a whole region: refused at once, with their own message; a curve through probe points is not
  for (const s of ['\\log(e^z) = z', '\\arcsin(\\sin z) = z', '\\sqrt{z^2} = z', '\\operatorname{Re}\\sqrt{z^2} = \\operatorname{Re} z', '\\operatorname{Re} z = |\\operatorname{Re} z|']) {
    const t0 = Date.now(), c = cls(s), ms = Date.now() - t0;
    ok(c.dim === 'error' && c.error === Expr.REL_MSG.region && ms < 200, `region identity refused: ${s}`, [c.dim, ms]);
  }
  ok(cls('|z| = 0.37').dim === 'curve' && cls('|z| = 0.93, Re z > 0').dim === 'curve', 'a curve through the probe points is still a curve');
  {
    // the tracer's own guard (an equation that slips past the probes): flat cells are skipped, quickly
    const g = Curves.evaluator(P('\\log(e^z) = z'), 'partial'), t0 = Date.now();
    const cs = Curves.traceImplicit(g, W2), ms = Date.now() - t0;
    ok(cs.length <= 2 && cs.info.flat > 1000 && ms < 3000, 'trace skips cells where the sides agree (log(e^z) = z: no fragments, bounded time)', [cs.length, cs.info.flat, ms]);
    const cs2 = Curves.traceImplicit(Curves.evaluator(P('\\operatorname{Re} z^2 = 1'), 'structural'), W2, { maxMs: 0 });
    ok(cs2.info.truncated === true, 'the wall-clock budget (o.maxMs) stops a trace and says so');
  }

  // (2) complex sides whose solutions form a curve
  const cplx = [
    ['z = \\bar z', (x, y) => Math.abs(y)],
    ['\\bar z = 1/z', (x, y) => Math.abs(Math.hypot(x, y) - 1)],
    ['z - \\bar z = 2i', (x, y) => Math.abs(y - 1)],
    ['z^2 = |z|^2', (x, y) => Math.abs(y)],
    ['z/\\bar z = 1', (x, y) => Math.abs(y)],
    ['z^2 = \\bar z^2', (x, y) => Math.min(Math.abs(x), Math.abs(y))],
    ['(1+i)\\operatorname{Re} z = 1+i', (x, y) => Math.abs(x - 1)],
  ];
  for (const [s, dist] of cplx) {
    const c = cls(s);
    const d = Curves.fromFormula(s), r = Curves.trace(d, W2), pts = allPts(r);
    const inWin = pts.filter(([x, y]) => Math.abs(x) <= 2 && Math.abs(y) <= 2);
    const worst = Math.max(...pts.map(([x, y]) => dist(x, y) / tol(x, y)));
    ok(c.dim === 'curve' && c.pieces[0].real === 'complex' && pts.length > 100 && worst <= 1 && inWin.length > 100, `complex sides, a curve: ${s}`, [c.dim, r.polys.length, worst]);
  }
  {
    const r = Curves.trace(Curves.fromFormula('\\bar z = 1/z'), W2);
    ok(r.polys.length === 1 && r.polys[0].closed, '\\bar z = 1/z is the closed unit circle');
    const r2 = Curves.trace(Curves.fromFormula('z^2 = \\bar z^2'), W2);
    ok(r2.polys.length === 2 && r2.polys.every((c) => c.ends.every((e) => e === 'inf')), 'z^2 = \\bar z^2: both axes, no extra lines');
    ok(Curves.fromFormula('z - \\bar z = 2i').exact && Curves.shapesOf(Curves.fromFormula('z - \\bar z = 2i'))[0].kind === 'line', 'z - \\bar z = 2i is recognized as the exact line Im z = 1');
  }
  for (const s of ['z = 1', 'z^2 = 1', '\\bar z = z^2']) ok(cls(s).error === Expr.REL_MSG.complex && !/so it holds only at isolated points/.test(cls(s).error), `complex sides with isolated solutions are still refused: ${s}`);

  // (3) zero sets touched rather than crossed
  {
    let r = Curves.trace(Curves.fromFormula('\\arg(z^2) = \\pi'), W2);
    ok(r.polys.length === 1 && r.polys[0].ends.every((e) => e === 'inf') && allPts(r).every(([x, y]) => Math.abs(x) <= tol(x, y)), 'arg(z^2) = pi: the imaginary axis', r.polys.map((c) => c.ends));
    r = Curves.trace(Curves.fromFormula('\\arg(z^3) = \\pi'), W2);
    const angOK = allPts(r).every(([x, y]) => Math.hypot(x, y) < 1e-12 || [Math.PI, Math.PI / 3, -Math.PI / 3].some((a) => Math.abs(Math.sin(Math.atan2(y, x) - a)) * Math.hypot(x, y) <= tol(x, y) && Math.cos(Math.atan2(y, x) - a) > 0));
    ok(r.polys.length === 3 && angOK && r.polys.every((c) => c.ends.includes('inf') && c.ends.includes('clip')) && r.polys.every((c) => { const n = c.pts.length; return Math.min(Math.hypot(c.pts[0], c.pts[1]), Math.hypot(c.pts[n - 2], c.pts[n - 1])) < 1e-12; }), 'arg(z^3) = pi: three rays from 0', r.polys.map((c) => c.ends));
    const d = Curves.fromFormula('|z| = \\operatorname{Re} z');
    ok(d.exact && Curves.shapesOf(d).length === 1 && Curves.shapesOf(d)[0].kind === 'ray' && Curves.shapesOf(d)[0].a[0] === 0 && Curves.shapesOf(d)[0].b[0] > 0, '|z| = Re z: the ray from 0 along the positive axis', Curves.shapesOf(d));
    const dp = Curves.fromFormula('|z^2-1| = 0'), rp = Curves.trace(dp, W2);
    ok(rp.polys.length === 0 && rp.points.length === 2 && rp.points.every((q) => Math.abs(Math.abs(q.p.re) - 1) <= 1e-12 && Math.abs(q.p.im) <= 1e-12) && dp.notes.some((n) => /isolated points/.test(n)), '|z^2 - 1| = 0: the points ±1, with a note', rp.points.map((q) => q.p));
    const dq = Curves.fromFormula('(\\operatorname{Re} z)^2 (\\operatorname{Im} z)^2 = 0');
    ok(dq.exact && Curves.shapesOf(dq).length === 2 && Curves.shapesOf(dq).every((s) => s.kind === 'line'), '(Re z)^2 (Im z)^2 = 0: both axes (a product splits into its factors)');
    ok(Curves.fromFormula('\\sqrt{|\\operatorname{Re} z|} = 0').exact, 'sqrt|Re z| = 0: the imaginary axis');
    const dt = Curves.fromFormula('|z|^2 - 2|z| + 1 = 0'), rt = Curves.trace(dt, W2);
    ok(rt.polys.length === 0 && rt.notes.some((n) => /only touch/.test(n)), 'a touching equation that is not rewritten: nothing drawn, with a note', rt.notes);
  }

  // (4) crossings and the figure-eight in a coarse window
  {
    const r = Curves.trace(Curves.fromFormula('|z^2-1| = 1'), COARSE), p = r.polys[0].pts;
    let best = Infinity;
    for (let i = 0; i < p.length; i += 2) best = Math.min(best, Math.hypot(p[i], p[i + 1]));
    ok(r.polys.length === 1 && r.polys[0].closed && best <= 1e-12, 'the lemniscate in a coarse window: one closed figure-eight through 0', [r.polys.length, best]);
    const r2 = Curves.trace(Curves.fromFormula('\\operatorname{Re}(z^2) = 0'), COARSE);
    const thr = r2.polys.map((c) => { let b = Infinity; for (let i = 0; i < c.pts.length; i += 2) b = Math.min(b, Math.hypot(c.pts[i], c.pts[i + 1])); return b; });
    ok(r2.polys.length === 2 && thr.every((b) => b <= 1e-12) && r2.polys.every((c) => c.ends.every((e) => e === 'inf')), 'Re(z^2) = 0 in a coarse window: two lines crossing at 0', thr);
    // a chord between two curves near a tangency is not drawn
    const r3 = Curves.trace(Curves.fromFormula('|z|^2 \\operatorname{Re} z - |z|^2 - \\operatorname{Re} z + 1 = 0'), COARSE);
    let longest = 0;
    for (const c of r3.polys) for (let i = 2; i < c.pts.length; i += 2) { const x = c.pts[i], y = c.pts[i + 1]; if (Math.hypot(x, y) < 3) longest = Math.max(longest, Math.hypot(x - c.pts[i - 2], y - c.pts[i - 1])); }
    ok(longest < 0.06, 'a circle tangent to a line (one equation, coarse window): no chord jumps between them', longest);
    const pts3 = allPts(r3).filter(([x, y]) => Math.hypot(x, y) < 3);
    ok(pts3.every(([x, y]) => Math.min(Math.abs(Math.hypot(x, y) - 1), Math.abs(x - 1)) <= 1e-9), 'and every sample is on the circle or the line');
  }

  // (5) exact restriction far from the shape's anchor
  {
    const seg = (s) => Curves.shapesOf(Curves.fromFormula(s));
    let s = seg('Re z = 0, |z - 100i| < 1');
    ok(s.length === 1 && s[0].kind === 'segment' && near(s[0].a[1], 99, 1e-12) && near(s[0].b[1], 101, 1e-12), 'Re z = 0, |z - 100i| < 1: the segment 99i to 101i', s);
    s = seg('Re z = 0, 1000 < Im z < 1001');
    ok(s.length === 1 && s[0].kind === 'segment' && near(s[0].a[1], 1000, 1e-12) && near(s[0].b[1], 1001, 1e-12), 'Re z = 0, 1000 < Im z < 1001: a segment', s);
    s = seg('|z| = 1000, |z - 1000e^{0.1i}| < 1');
    ok(s.length === 1 && s[0].kind === 'arc' && Math.abs(Math.hypot(s[0].m[0], s[0].m[1]) - 1000) < 1e-9, '|z| = 1000 near 1000 e^{0.1 i}: an arc', s);
    s = seg('|z| = 1, |z - e^{0.1i}| < 0.001');
    ok(s.length === 1 && s[0].kind === 'arc', '|z| = 1, |z - e^{0.1 i}| < 0.001: a tiny arc', s);
    const d = Curves.fromFormula('Re z = 0, |z - 1000i| < 10');
    ok(!d.notes.length && Curves.trace(d, { x0: -5, x1: 5, y0: 995, y1: 1005 }).polys.length === 1, 'and it is drawn in a window there, with no false note');
  }

  // (6) branch cuts: Im log E is arg E; arg of a non-affine E has no cut
  {
    let d = Curves.fromFormula('\\operatorname{Im}\\log z = 3.14');
    ok(d.exact && Curves.shapesOf(d)[0].kind === 'ray', 'Im log z = 3.14: an exact ray (no longer lost along the cut)');
    d = Curves.fromFormula('\\operatorname{Im}\\log(z^2) = 3');
    const r = Curves.trace(d, W2), pts = allPts(r);
    ok(pts.length > 100 && pts.every(([x, y]) => { const w = CX.mul(C(x, y), C(x, y)); return Math.abs(CX.arg(w) - 3) * CX.abs(w) <= 1e-8 * CX.abs(w) + 1e-12 || CX.abs(w) < 1e-12; }), 'Im log(z^2) = 3: traced as Im(z^2 e^{-3i}) = 0, Re > 0', r.polys.length);
  }

  // (7) API details
  {
    const d = Curves.fromFormula('Re z^2 = 1');
    Curves.sample(d, W2, { res: 50 }); Curves.curvesOf(d, W2, { res: 50 });
    ok(d.cache.size === 1, 'curvesOf traces with the same options as sample (one cache entry)');
    const a = Curves.trace(d, W2, { maxTail: 10 }), b = Curves.trace(d, W2);
    ok(a !== b, 'the cache key includes maxTail / maxEval / tails');
    const e1 = Curves.trace(Curves.fromFormula('Re z = 0, Im z > 0'), W2).polys[0].ends, e2 = Curves.trace(Curves.fromFormula('Re z = 0, |z| < 1'), W2).polys[0].ends;
    const e3 = Curves.trace(Curves.fromFormula('\\arg z = 1'), W2).polys[0].ends;
    ok(JSON.stringify([e1, e2, e3]) === '[["clip","inf"],["clip","clip"],["stop","inf"]]', "exact shapes cut by a restriction end 'clip' (an arg ray's apex: 'stop')", [e1, e2, e3]);
    const c = Curves.trace(Curves.fromFormula('|z| = 1'), W2).polys[0].pts, n = c.length;
    ok(c[n - 2] === c[0] && c[n - 1] === c[1], 'an exact closed circle repeats its first point exactly');
    // exact circles and arcs in a window much smaller than the radius: points on the circle down to diag / 700
    const tiny = { x0: 0.999, x1: 1.001, y0: -0.001, y1: 0.001 };
    for (const f of ['|z| = 1', '|z| = 1, \\operatorname{Re} z > 0.5']) {
      const q = Curves.trace(Curves.fromFormula(f), tiny).polys[0].pts;
      let gapMax = 0, inW = 0, off = 0;
      for (let i = 2; i < q.length; i += 2) {
        off = Math.max(off, Math.abs(Math.hypot(q[i], q[i + 1]) - 1));
        if (q[i] >= tiny.x0 && q[i] <= tiny.x1 && Math.abs(q[i + 1]) <= 0.001) { inW++; gapMax = Math.max(gapMax, Math.hypot(q[i] - q[i - 2], q[i + 1] - q[i - 1])); }
      }
      ok(inW > 300 && gapMax <= 2 * Math.hypot(0.002, 0.002) / 700 && off <= 1e-15, `an exact ${f.includes(',') ? 'arc' : 'circle'} in a tiny window is sampled finely there`, [inW, gapMax, off]);
    }
  }

  // (8) parser details
  {
    const c = cls('Re z = 0 and Re z = 0');
    ok(c.dim === 'curve' && c.pieces.length === 1, 'the same equation twice joined by and is that equation');
    const e = throwsMsg(() => P('|z|=<1')), e2 = throwsMsg(() => P('|z|=>1'));
    ok(e && /≤/.test(e.message) && e.pos === 3 && e2 && /≥/.test(e2.message), "'=<' and '=>' suggest ≤ and ≥", [e && e.message, e2 && e2.message]);
    const e3 = throwsMsg(() => Expr.parse('|z|=<1'));
    ok(e3 && e3.message === "Unexpected '='" && e3.pos === 3, "without allowRel '=<' is still Unexpected '=' at 3");
    ok(!JSON.stringify(Expr.parse('1<|z|<2')).includes('chain') && !JSON.stringify(P('1<|z|<2')).includes('chain') && JSON.stringify(P('Re z = Im z = 0')).includes('chain'), 'the chain mark is set only on chains with an equation (inequality chains keep their old AST)');
  }
}

// review findings (P5): a figure eight is two simple counterclockwise loops (its integrals do not depend on the trace
// window); |E| = 0 with an analytic E is its zeros at any degree; zeros that pile up are reported as incomplete
{
  const d = Curves.fromFormula('|z^2-1| = 1');
  const integ = (L, c) => { let im = 0; const p = L.pts; for (let k = 0; k + 3 < p.length; k += 2) { const q = CX.div(CX.C(p[k + 2] - p[k], p[k + 3] - p[k + 1]), CX.C((p[k] + p[k + 2]) / 2 - c, (p[k + 1] + p[k + 3]) / 2)); im += q.im; } return im / Math.PI; };
  for (const w of [[-2, 2, -1.5, 1.5], [-2.1, 1.9, -1.4, 1.6], [-1.7, 2.3, -1.55, 1.45], [-3, 3, -2, 2.2]]) {
    const Ls = Curves.loops(d, { x0: w[0], x1: w[1], y0: w[2], y1: w[3] });
    const a = Ls.reduce((t, L) => t + integ(L, 1), 0), b = Ls.reduce((t, L) => t + integ(L, -1), 0);
    ok(Ls.length === 2 && Ls.every((L) => Math.abs(L.area - 1) < 1e-3) && Math.abs(a - 2) < 1e-3 && Math.abs(b - 2) < 1e-3,
      `lemniscate |z^2-1| = 1 in window ${w}: two ccw lobes (area 1), each pole's integral +2 pi i`, { n: Ls.length, areas: Ls.map((L) => L.area), a, b });
  }
  const z30 = Curves.fromFormula('|z^{30}-1| = 0');
  ok(z30.pieces.length === 1 && z30.pieces[0].kind === 'zeros', '|z^{30}-1| = 0 is isolated zeros (any degree)', z30.pieces.map((p) => [p.kind, p.real]));
  const t30 = Curves.trace(z30, { x0: -2, x1: 2, y0: -2, y1: 2 });
  ok(t30.points.length === 30 && t30.points.every(({ p }) => Math.abs(CX.abs(p.p || p) - 1) < 1e-9) && !t30.notes.some((t) => /Only some/.test(t)), 'all 30 roots of unity are found, no incompleteness note', { n: t30.points.length, notes: t30.notes });
  const ts = Curves.trace(Curves.fromFormula('|\\sin(1/z)| = 0'), { x0: -2.7, x1: 2.7, y0: -3.4, y1: 3.4 });
  ok(ts.notes.some((t) => /Only some of the zeros/.test(t)), 'the zeros of sin(1/z) piling up at 0 are reported as incomplete', ts.notes);
  ok([1, 2].every((k) => ts.points.some(({ p }) => Math.abs(p.re - 1 / (k * Math.PI)) < 1e-9 && Math.abs(p.im) < 1e-9)), 'the well-separated zeros 1/pi and 1/(2 pi) are found', ts.points.map(({ p }) => p.re));
}

console.log(`\n${passes} passed, ${fails} failed`);
console.log(fails ? 'SOME FAILED' : 'all passed');
process.exitCode = fails ? 1 : 0;
