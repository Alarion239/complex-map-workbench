// Node checks of the fixes for the P2 review findings (notes/sphere-design/SPEC.md 13.12, 15 "P2 review"), CPU side
// (the GPU twins: test/glsl_inverse_test.js 'anchors', test/p2fix_cdp/cmd/*.js). Each block would have caught its
// finding. Run: node test/t_p2fix.js
const vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const ctx = { console, performance: { now: () => 0 }, setTimeout, clearTimeout };
vm.createContext(ctx);
const { source } = require('./src_text');   // (gl.js: src/gl/*.js joined, as build.py does)
const NAMES = { cx: 'CX', parse: 'Expr', derivs: 'Derivs', natpaths: 'NatPaths', sheets: 'Sheets', formulasteps: 'FormulaSteps', funcs: 'Funcs', invops: 'InvOps', invpatterns: 'InvPatterns', inverse: 'Inverse', recognize: 'Recognize', calc: 'Calc', glsl: 'GLChain', region: 'Region', constrpoc: 'ConstrPoc', constrortho: 'ConstrOrtho', constr: 'Constr', curves: 'Curves', palette: 'Palette', gl: 'GLR' };
for (const f of Object.keys(NAMES)) vm.runInContext(source(f + '.js', path.join(root, 'src'), { esm: 'strip' }) + `\n;globalThis.${NAMES[f]} = ${NAMES[f]};`, ctx, { filename: f + '.js' });
const { CX, Funcs, Inverse: I, Region, GLR } = ctx;
const C = CX.C, PI = Math.PI;
let bad = 0, n = 0;
const check = (name, ok, info = '') => { n++; if (!ok) { bad++; console.log('FAIL', name, info); } };
const St = (type, params = {}) => ({ type, params: Object.assign(Funcs.defaults(type), params), on: true });
const planOf = (steps) => I.planChain(steps, steps.map(Funcs.build));
const WIN = { x0: -3, x1: 3, y0: -3, y1: 3 };
let seed = 12345;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };

// ---- 1. saturation anchors (artanh / arctan of shapes through +-1 / +-i, finding "artanh / arctan images break") ----
{
  const strip = (tan) => (w) => PI / 4 - Math.abs(tan ? w.re : w.im);
  for (const [name, steps, sdf, tan] of [['artanh', [St('artanh')], strip(false), false], ['arctan', [St('arctan')], strip(true), true],
    ['custom artanh', [St('custom', { expr: '\\operatorname{artanh}(z)', cut: 180 })], strip(false), false], ['artanh(2z)', [St('mul', { c: '2' }), St('artanh')], strip(false), false]]) {
    const plan = planOf(steps);
    const shape = name === 'artanh(2z)' ? { kind: 'disc', c: [0, 0], r: 0.5 } : { kind: 'disc', c: [0, 0], r: 1 };
    const prep = I.prepare(plan, { win: WIN, shape });
    check(`${name}: anchors prepared (two circle models)`, prep.ok && prep.anc && prep.anc.models.every((m) => m.type === 3), JSON.stringify(prep.anc && prep.anc.models.map((m) => m.type)));
    for (const anchored of [true, false]) {
      const pp = anchored ? prep : Object.assign({}, prep, { anc: null });
      let wrong = 0, cnt = 0;
      for (const s of [20, 10, 4, 1]) {
        for (let i = 0; i < 300; i++) {
          const far = (rnd() - 0.5) * 2 * 205 / s, across = (rnd() - 0.5) * 1.6 * PI / 2;
          const w = tan ? C(across, far) : C(far, across);
          const e = sdf(w) * s;
          if (Math.abs(e) < 1) continue;
          const r = I.enumerate(plan, pp, w, 1 / s, { K: 1, B: 3 });
          cnt++;
          if ((r.U > 0.5) !== (e > 0)) wrong++;
        }
      }
      if (anchored) check(`${name}: anchored coverage is the exact strip at s 20 / 10 / 4 / 1 (|Re w| to 200)`, wrong === 0, `${wrong} of ${cnt}`);
      else check(`${name}: without anchors the strip breaks (negative control)`, wrong > 0, `${wrong} of ${cnt}`);
    }
  }
  // local models per kind: the classification near p agrees with the float64 level at p + delta (|delta| 1e-6 .. 1e-3
  // of the model's radius: well resolved in float64)
  const p = C(1, 0);
  const KINDS = [
    ['disc through p', { kind: 'disc', c: [0, 0], r: 1 }, 3], ['disc complement through p', { kind: 'disc', c: [0.5, 0.5], r: Math.hypot(0.5, 0.5), complement: true }, 3],
    ['annulus outer', { kind: 'annulus', c: [0, 0], r1: 0.3, r2: 1 }, 3], ['annulus inner', { kind: 'annulus', c: [0, 0], r1: 1, r2: 2 }, 3],
    ['half-plane through p', { kind: 'halfplane', a: [1, 0], b: [1.3, 0.8] }, 2], ['rect corner', { kind: 'rect', a: [1, 0], b: [2, 1] }, 2], ['rect side', { kind: 'rect', a: [1, -1], b: [2, 1] }, 2],
    ['convex vertex', { kind: 'polygon', pts: [[1, 0], [-0.3, 0.9], [-0.5, -0.6]] }, 2], ['reflex vertex', { kind: 'polygon', pts: [[1, 0], [2, 1], [-1, 1], [-1, -1], [2, -1]] }, 2],
    ['polygon edge', { kind: 'polygon', pts: [[1, -1], [1, 1], [-1, 0]] }, 2], ['sector apex', { kind: 'sector', c: [1, 0], r: 0, t1: 30, t2: 200 }, 2], ['sector apex, complement', { kind: 'sector', c: [1, 0], r: 0, t1: 30, t2: 100, complement: true }, 2],
    ['sector ray', { kind: 'sector', c: [0, 0], r: 0, t1: 0, t2: 70 }, 2], ['sector arc', { kind: 'sector', c: [0, 0], r: 1, t1: -60, t2: 60 }, 3],
    ['disc away from p', { kind: 'disc', c: [3, 0], r: 1 }, 1], ['formula away', { kind: 'formula', expr: '|z-3|<1' }, 1]];
  for (const [nm, sh, type] of KINDS) {
    let M;
    try { M = I._anchor.model(sh, p); } catch (e) { M = { err: e.message }; }
    check(`anchor model ${nm}: type ${type}`, M && M.type === type, JSON.stringify(M));
    if (!M || !M.type) continue;
    const L = Region.levelOf(sh), rad = Math.min(1, M.m || 1);
    let wrong = 0;
    for (let i = 0; i < 400; i++) {
      const r = rad * Math.pow(10, -3 - 3 * rnd()), a = 2 * PI * rnd(), dz = C(r * Math.cos(a), r * Math.sin(a));
      const lz = CX.log(dz), px = C(r * 1e-3, 0), py = C(0, r * 1e-3);
      const sp = I._anchor.px(M, dz, lz, px, py, CX.div(px, dz), CX.div(py, dz));
      const lv = L(CX.add(p, dz));
      if (Math.abs(lv) < 1e-9 * r) continue;
      if ((sp.s > 0) !== (lv > 0)) wrong++;
    }
    check(`anchor model ${nm}: inside / outside = the level at p + delta`, wrong === 0, `${wrong}`);
  }
  check('a formula boundary through an anchor: not eligible', (() => { const r = I.prepare(planOf([St('artanh')]), { win: WIN, shape: { kind: 'formula', expr: '|z|<1' } }); return !r.ok && /saturation/.test(r.reason); })());
  // the stable offsets: tanh w - (+-1), tan w - (+-i), their logs and derivatives
  {
    let worst = 0;
    for (const w of [C(0.3, 0.2), C(-2, 1), C(7, -0.4), C(-15, 0.7), C(0.01, 1.4)]) {
      for (const tan of [false, true]) {
        const ww = tan ? C(-w.im, w.re) : w;
        const a = tan ? I._anchor.tan(ww) : I._anchor.tanh(ww), u = tan ? CX.tan(ww) : CX.tanh(ww);
        const dd = CX.sub(u, a.pu);
        if (CX.abs(dd) > 1e-6) worst = Math.max(worst, CX.abs(CX.sub(dd, a.d)) / CX.abs(dd));
        worst = Math.max(worst, CX.abs(CX.sub(CX.exp(a.l), a.d)) / CX.abs(a.d));
        const h = 1e-6, a2 = tan ? I._anchor.tan(CX.add(ww, C(h, 0))) : I._anchor.tanh(CX.add(ww, C(h, 0)));
        if (a2.a === a.a) worst = Math.max(worst, CX.abs(CX.sub(CX.scale(CX.sub(a2.l, a.l), 1 / h), a.dl)) / (1 + CX.abs(a.dl)) * 1e-3);
      }
    }
    check('anchor offsets: delta = u - p, exp(log delta) = delta, d log delta / dw', worst < 1e-8, worst);
  }
}

// ---- 2. compositing past a capped buffer (finding "opacity below 0.85 ... 2 to 4 times the forward frame") ----
{
  check('B classes 3 / 5 / 8 (no 16)', [1, 0.85, 0.7, 0.5, 0.3, 0.1].map(I.Bof).join() === '3,5,5,5,8,8');
  // z^12 of a disc around 0: 12 sheets over every point; alpha 0.2 (K 25 > B 8): the exact opacity 1 - 0.8^12
  const plan = planOf([St('pown', { n: 12 })]);
  const r = I.renderCPU(plan, [{ kind: 'disc', c: [0, 0], r: 0.9 }], { cx: 0, cy: 0, s: 400, W: 24, H: 24, win: WIN }, { alpha: 0.2 });
  const a = r.stats.alpha[5 * 24 + 7];
  check('alpha 0.2, 12 sheets, B 8: opacity 1 - 0.8^12 (the old tail rule filled it to 1)', Math.abs(a - (1 - Math.pow(0.8, 12))) < 2e-3, a);
  const r2 = I.renderCPU(plan, [{ kind: 'disc', c: [0, 0], r: 0.9 }], { cx: 0, cy: 0, s: 400, W: 24, H: 24, win: WIN }, { alpha: 0.85 });
  check('alpha 0.85, 12 sheets: opaque to 1/255 (the composite stops there)', r2.stats.alpha[5 * 24 + 7] >= 1 - 1 / 255, r2.stats.alpha[5 * 24 + 7]);
  // infinite multiplicity (exp of H at alpha 0.2): the tail closure still makes it opaque
  const pe = planOf([St('exp')]);
  const r3 = I.renderCPU(pe, [{ kind: 'halfplane', a: [0, 0], b: [1, 0] }], { cx: 0.5, cy: 0.3, s: 60, W: 16, H: 16, win: WIN }, { alpha: 0.2 });
  check('exp(H) at alpha 0.2: opaque (tail closure)', Math.min(...r3.stats.alpha) > 0.99, Math.min(...r3.stats.alpha));
  // the walk counts every covering candidate when K > B for the own alpha (no early stop past B): enumerate with all,
  // on a shape whose coverage along the member lines is not monotone (a disc's complement: no tail rule)
  const dc = { kind: 'disc', c: [0, 0], r: 0.4, complement: true };
  const prepD = I.prepare(pe, { win: WIN, shape: dc });
  const da = I.enumerate(pe, prepD, C(0.5, 0.3), 1 / 60, { K: 25, B: 8, all: true, alpha: 0.2 });
  const ds = I.enumerate(pe, prepD, C(0.5, 0.3), 1 / 60, { K: 25, B: 8, alpha: 0.2 });
  check('all: no early stop past B (more leaves than the capped stop)', !prepD.tail && da.visited >= ds.visited && da.restT < 1, `tail ${prepD.tail}, ${da.visited} vs ${ds.visited}, restT ${da.restT}`);
  // the tail rule (13.14): a half-plane under exp is monotone along every member line, so a side stops as soon as its
  // members are provably behind the buffer and the tail closes there anyway: fewer leaves, the same buffer, and the
  // same composite as the full walk (renderCPU with the rule off)
  const hp = { kind: 'halfplane', a: [0, 0], b: [1, 0] };
  const prep = I.prepare(pe, { win: WIN, shape: hp }), prepOff = I.prepare(pe, { win: WIN, shape: hp });
  prepOff.tail = false;
  const ea = I.enumerate(pe, prep, C(0.5, 0.3), 1 / 60, { K: 25, B: 8, all: true, alpha: 0.2 });
  const eb = I.enumerate(pe, prepOff, C(0.5, 0.3), 1 / 60, { K: 25, B: 8, all: true, alpha: 0.2 });
  const sameEnt = ea.entries.length === eb.entries.length && ea.entries.every((e, i) => e.D === eb.entries[i].D);
  check('tail rule: fewer leaves, tail closed, the same buffer', prep.tail && ea.visited < eb.visited && ea.tailInf && eb.tailInf && sameEnt && ea.U === eb.U, `${ea.visited} vs ${eb.visited}, tail ${ea.tailInf}/${eb.tailInf}, same ${sameEnt}`);
  let tmax = 0;
  for (const al of [0.5, 0.3, 0.2]) {
    const v = { cx: 0.5, cy: 0.3, s: 60, W: 24, H: 24, win: WIN }, lk = { alpha: al, pattern: 'checker', cell: 0.5 };
    const ra = I.renderCPU(pe, [hp], v, lk, [prep]), rb = I.renderCPU(pe, [hp], v, lk, [prepOff]);
    for (let i = 0; i < ra.rgba.length; i++) tmax = Math.max(tmax, Math.abs(ra.rgba[i] - rb.rgba[i]));
  }
  check('tail rule: the composite equals the full walk\'s (alpha 0.5, 0.3, 0.2)', tmax <= 1, tmax);
  // which preparations carry the flag: intersections of half-planes behind an additive family with affine ops only;
  // under an infinitely-sheeted power at op 0, only boundaries through 0
  const tailOf = (steps, shape) => I.prepare(planOf(steps), { win: WIN, shape }).tail;
  const H = { kind: 'halfplane', a: [0, 0], b: [1, 0] }, H1 = { kind: 'halfplane', a: [0, 1], b: [1, 1] };
  const cases = [
    ['exp(H)', [St('exp')], H, true], ['exp(complement of H)', [St('exp')], Object.assign({ complement: true }, H), true],
    ['exp(sector r 0, 90 deg)', [St('exp')], { kind: 'sector', c: [0.5, 0], r: 0, t1: 10, t2: 100 }, true],
    ['exp(2z + 1)(H)', [St('mul', { c: '2' }), St('add', { c: '1' }), St('exp')], H, true],
    ['Mobius after exp (H)', [St('exp'), St('mobius', { a: '1', b: '-1', c: '1', d: '1' })], H, true],
    ['exp(disc)', [St('exp')], { kind: 'disc', c: [0, 0], r: 1 }, false], ['exp(polygon)', [St('exp')], { kind: 'polygon', pts: [[0, 0], [1, 0], [0, 1]] }, false],
    ['exp(disc complement)', [St('exp')], { kind: 'disc', c: [0, 0], r: 0.4, complement: true }, false],
    ['log after exp (H)', [St('exp'), St('log')], H, false],
    ['z^i(H)', [St('powa', { alpha: 'i' })], H, true], ['z^i(Im z > 1)', [St('powa', { alpha: 'i' })], H1, false],
  ];
  for (const [nm, steps, shape, want] of cases) check(`tail flag: ${nm} ${want}`, tailOf(steps, shape) === want, tailOf(steps, shape));
  // the stop's bound from the next member (13.14): exp(H) at alpha 1 walks 2 leaves (the front and its neighbour's proof
  // came from walking the next member before)
  const e1 = I.enumerate(pe, prep, C(0.5, 0.3), 1 / 60, { K: 1, B: 3, alpha: 1 });
  check('next-member bound: exp(H), K 1: 2 leaves', e1.visited === 2, e1.visited);
}

// ---- 3. critical values exactly at a pixel centre (finding "Black (NaN) pixel ...") ----
{
  for (const [nm, steps, shape, w] of [['sin at w = 1', [St('sin')], { kind: 'disc', c: [1.5, 0.1], r: 1 }, C(1, 0)], ['cos at w = 1', [St('cos')], { kind: 'disc', c: [0.1, 0.1], r: 1 }, C(1, 0)],
    ['z^2 at w = 0', [St('pown', { n: 2 })], { kind: 'disc', c: [0.1, 0], r: 1 }, C(0, 0)], ['joukowski at w = -1', [St('joukowski')], { kind: 'disc', c: [-1, 0.2], r: 0.5 }, C(-1, 0)],
    ['z^2+2z at w = -1', [St('poly', { co: '1, 2, 0' })], { kind: 'disc', c: [-1, 0.2], r: 0.5 }, C(-1, 0)]]) {
    const plan = planOf(steps), prep = I.prepare(plan, { win: WIN, shape });
    const r = I.renderCPU(plan, [shape], { cx: w.re, cy: w.im, s: 60, W: 3, H: 3, win: WIN }, { alpha: 1, pattern: 'checker', cell: 0.5 }, [prep]);
    const k = 4 * (1 * 3 + 1), px = Array.from(r.rgba.slice(k, k + 3)), nb = Array.from(r.rgba.slice(0, 3));
    const dark = px.every((x) => x < 40);
    check(`${nm}: no black pixel at the critical value (covered, finite colour)`, !dark && r.stats.alpha[4] > 0.99, `${px} (neighbour ${nb}) alpha ${r.stats.alpha[4]}`);
  }
}

// ---- 4. the polar near-origin fade is skipped where Lambda is exact (finding "z^i(H) with the polar pattern ...") ----
{
  const lk = { pattern: 'polar', c0: [0.2, 0.4, 0.8], c1: [0.6, 0.7, 0.9], k: [0, 0, 0], cell: 0.5 };
  // a sheet of z^i near 0: |z| = e^{-5}, Lambda exact: its log-polar cell colour, not c0
  const lam = C(-5 + 0.05, 0.3), z = CX.exp(lam), dL = C(1e-3, 0);
  const withLam = I.patternColor(lk, { z, dX: CX.mul(z, dL), dY: CX.mul(z, C(0, 1e-3)), lam, dLX: dL, dLY: C(0, 1e-3) });
  const par = ((Math.floor(lam.re * 16 / (2 * PI)) + Math.floor(lam.im * 16 / (2 * PI))) % 2 + 2) % 2;
  const want = par ? lk.c1 : lk.c0;
  check('polar with Lambda near 0: the cell colour (no fade to c0)', withLam.col.every((c, i) => Math.abs(c - want[i]) < 1e-6) && par === 1, JSON.stringify(withLam.col));
  const noLam = I.patternColor(lk, { z, dX: CX.mul(z, dL), dY: CX.mul(z, C(0, 1e-3)) });
  check('polar without Lambda near 0: still faded to c0 (REGION_FS behaviour)', noLam.col.every((c, i) => Math.abs(c - lk.c0[i]) < 1e-6), JSON.stringify(noLam.col));
}

// ---- 5. renderCPU's source phase = the GPU's formula (finding "renderCPU is not a valid reference ...") ----
{
  const lk = { pattern: 'phase', c0: [0.2, 0.4, 0.8], c1: [0.6, 0.7, 0.9], k: [0, 0, 0], cell: 0.5 };
  let worst = 0;
  for (const z of [C(1.3, 0.4), C(-0.2, 2.5), C(0.05, -0.07)]) {
    const dX = C(1e-3, 0), dY = C(0, 1e-3);
    const col = I.patternColor(lk, { z, dX, dY }).col;
    const lr = Math.log(CX.abs(z)) * 6 / PI, flr = (Math.abs(CX.div(dX, z).re) + Math.abs(CX.div(dY, z).re)) * 6 / PI;
    const G = (x) => { const f = x - Math.floor(x); return 0.5 * Math.floor(x) + 0.5 * f * f; };
    const saw = (G(lr + flr / 2) - G(lr - flr / 2)) / flr, sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    const sw = saw * (1 - sm(0.18, 0.45, flr)) + 0.5 * sm(0.18, 0.45, flr);
    const ref = GLR.phaseRGB(Math.atan2(z.im, z.re), 0.62 + 0.14 * sw);
    worst = Math.max(worst, ...col.map((c, i) => Math.abs(c - ref[i])));
  }
  check('phase pattern: GLR.phaseRGB of the GPU formula', worst < 1e-12, worst);
}

// ---- 6. deep zoom (finding "Deep zoom on images of shapes away from 0"): the checker filter of the analytic patterns
// is the ramp around the nearest cell edge: equal to UTIL's box filter for w < 1, exactly +-1 inside a cell, in [-1, 1]
{
  const box = (p, w) => 2 * (Math.abs((((p - 0.5 * w) * 0.5) % 1 + 1) % 1 - 0.5) - Math.abs((((p + 0.5 * w) * 0.5) % 1 + 1) % 1 - 0.5)) / w;
  let worst = 0, inRange = true;
  for (let i = 0; i < 2000; i++) {
    const p = (rnd() - 0.5) * 40, w = Math.pow(10, -4 * rnd());
    worst = Math.max(worst, Math.abs(I._sqAA(p, w) - Math.max(-1, Math.min(1, box(p, w)))));
  }
  check('ramp = box filter for w < 1 (float64)', worst < 1e-9, worst);
  // a deep zoom (p ~ 46 cells, footprint 1.6e-5 cells: z^3 of a disc at (3,3), s = 1e4): inside a cell the ramp is
  // exactly +-1 (the GPU's box filter read 0.93: colours 6/255 off, test/p2fix_cdp/cmd/deep_par.js), near an edge in [-1, 1]
  let rampBad = 0;
  for (let i = 0; i < 2000; i++) {
    const p = Math.fround(46 + 0.1 + 0.8 * rnd()), w = Math.fround(1.6e-5), v = I._sqAA(p, w);
    if (Math.abs(v) !== 1) rampBad++;
    const q = Math.fround(47 + (rnd() - 0.5) * 4e-5), vq = I._sqAA(q, w);
    if (!(Math.abs(vq) <= 1)) inRange = false;
  }
  check('ramp: exactly +-1 inside a cell, within [-1, 1] at an edge (deep zoom)', rampBad === 0 && inRange, rampBad);
  check('GPU: ixChecker is the ramp (ixSq) in the analytic patterns', /float ixSq\(float p, float w\)/.test(GLR._src.INV_HEAD(5, '')) && /ixChecker\(/.test(GLR._src.PATTERN_SRC('analytic')));
}

// ---- 7. a Mobius step with c = 0 is affine (exp(2z + 1) of H: clip ranges, inverse-eligible) ----
{
  const plan = planOf([St('mobius', { a: '2', b: '1', c: '0', d: '1' }), St('exp')]);
  const prep = I.prepare(plan, { win: WIN, shape: { kind: 'halfplane', a: [0, 0], b: [1, 0] } });
  check('exp(2z + 1) of H: eligible, a clip range, the affine stop', prep.ok && prep.rspec[1] && prep.rspec[1].kind === 'clip' && prep.stopOp === 1 && !prep.stopMob, prep.reason);
  // exact: the image of H under exp(2z + 1) is C \ {0}: covered everywhere (w away from 0)
  let miss = 0;
  for (let i = 0; i < 200; i++) { const w = C((rnd() - 0.5) * 8, (rnd() - 0.5) * 8); if (CX.abs(w) < 0.1) continue; if (!(I.enumerate(plan, prep, w, 1 / 60, { K: 1, B: 3 }).U > 0.99)) miss++; }
  check('exp(2z + 1) of H covers C \\ {0}', miss === 0, miss);
}

console.log(`${n - bad}/${n} passed`);
process.exit(bad ? 1 : 0);
