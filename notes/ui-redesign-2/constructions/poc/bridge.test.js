// Does the construction engine fit the app's shape model? Run: node bridge.test.js
// Loads the app's own modules from the private copy (notes/ui-redesign-2/app-copy-constructions/src, a copy of
// work/xr/src; nothing in the app is changed) and checks:
//  1. constructed curves and areas are ordinary Region shapes (the renderers need nothing new);
//  2. an equation with a parameter, its values substituted, is recognized EXACTLY by the app's Curves.fromFormula
//     (lines, circles, rays) and agrees with the engine; the time per slider step;
//  3. what a slider costs for a traced (non-exact) equation, where the app re-traces per value.
'use strict';
const path = require('path');
const SRC = path.join(__dirname, '../../app-copy-constructions/src');
global.CX = require(path.join(SRC, 'cx.js'));
global.Expr = require(path.join(SRC, 'parse.js'));
global.Funcs = require(path.join(SRC, 'funcs.js'));
global.Region = require(path.join(SRC, 'region.js'));
const Curves = require(path.join(SRC, 'curves.js'));
const K = require('./constr.js');
let pass = 0, fail = 0;
const ok = (c, msg, extra) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + msg + (extra !== undefined ? ' ' + JSON.stringify(extra) : '')); };
const cpu = (fn, n) => { const c0 = process.cpuUsage(); for (let i = 0; i < n; i++) fn(i); const c = process.cpuUsage(c0); return (c.user + c.system) / 1000 / n; };

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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
