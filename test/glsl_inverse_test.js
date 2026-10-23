'use strict';
// GLSL parity of the inverse renderer (SPEC 12.2), page script of dist/glsl-inverse-test.html
// (test/make_glsl_inverse_test.py), driven by test/glsl_inverse_cmd.js through a CDP daemon.
//
//  walk   random eligible chains (every catalog type, random parameters, cuts and sheets, 1-3 steps, and the custom
//         formulas of SPEC 12.1 (a)) x random shapes x random view points: a recording program (the production
//         lib, INV_HEAD and walker, with the IX_RECORD hook) writes the first 8 visited leaves of each test point
//         (z, range level in px, sqrt|det dz/dw|), the visited / covering counts and the front keys; compared with
//         Inverse.enumerate in walk order: |dz| <= 2e-3 (1 + |z|), d lvl <= 0.05 px + 1e-4 |lvl|, coverage to 0.03,
//         the same visited count; |J| to 5e-3 and the keys D to 2e-3 where float32 resolves them (D <= 16 and
//         1e-15 < |J| < 1e15; the deeper leaves are counted in skipped.deepLeaves). A point is skipped when the CPU's leaf paths change within
//         2e-4 (1 + |w|) of it (a cut, a window or a range boundary: float32 decides those differently) or when a
//         member's range level lies within 0.02 px of the -1 px ramp.
//  clip   ixShapeClip against Region.shapeClip on random lines per shape kind (complements included)
//  fs     REGION_FS(false / true) byte-identical to the fixtures (SPEC 6.1; patterns 0-8 since P3)
//  flip   12.1 (l): poly 1,0,-1,0 <-> 1,0,0,5, rational q 1,0 <-> 0,1, a Mobius map through degeneracy, at a constant
//         forward key: the inverse key changes, the program drawn is the one of the current inverse key (its source
//         is the current info's lib + walker), the forward uChain layout is unchanged, every frame draws (inverse when
//         eligible and compiled, else the forward mesh)
window.__invTestRun = async (opts = {}) => {
  const R = window.__invTest = { done: false, cases: 0, eligibleCases: 0, programs: new Set(), points: 0, compared: 0, leaves: 0, skipped: { discontinuous: 0, ramp: 0, nonfinite: 0, ineligible: 0 },
    failCount: 0, fails: [], byChain: {}, clip: null, fs: null, flip: null, ms: 0, errors: [],
    rational: { chains: 0, cases: 0, eligibleCases: 0, compared: 0, leaves: 0, failCount: 0, kinds: {} } };   // the rational custom chains alone
  const t0 = performance.now();
  const C = CX.C;
  let seed = opts.seed || 20261019;
  const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const rf = (a, b) => a + rnd() * (b - a);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const num = (x) => String(+x.toFixed(3));
  const cxs = (re, im) => (im === 0 ? num(re) : `${num(re)}${im < 0 ? '-' : '+'}${num(Math.abs(im))}i`);
  const rcx = (r = 2) => cxs(rf(-r, r), rf(-r, r));
  const St = (type, params = {}) => ({ type, params: Object.assign(Funcs.defaults(type), params), on: true });
  const CUTS = [0, 90, -45, 180, 270, -180, 30];
  function randParams(type) {
    switch (type) {
      case 'mul': case 'add': return { c: rcx() };
      case 'affine': return { a: rcx(), b: rcx() };
      case 'mobius': return { a: rcx(), b: rcx(), c: rcx(), d: rcx() };
      case 'blaschke': { const r = rf(0, 0.95), a = rf(-Math.PI, Math.PI); return { a: cxs(r * Math.cos(a), r * Math.sin(a)), phi: ri(-180, 180) }; }
      case 'pown': return { n: pick([-7, -3, -2, -1, 2, 3, 4, 5, 9, 12, 16]) };
      case 'root': return { n: ri(2, 7), cut: pick(CUTS), k: ri(-3, 4) };
      case 'powa': return { alpha: rnd() < 0.4 ? num(rf(-3, 3)) : rnd() < 0.5 ? rcx(2) : pick(['i', '0.3+i', '-0.2+0.8i', '2i', '0.5i']), cut: pick(CUTS), k: ri(-2, 2) };
      case 'log': return { cut: pick(CUTS), k: ri(-2, 2) };
      case 'ijouk': return { branch: pick(['exterior', 'interior']) };
      case 'poly': { const d = ri(1, 2); return { co: Array.from({ length: d + 1 }, () => rcx(1.5)).join(', ') }; }
      case 'rational': { return rnd() < 0.5 ? { p: `${rcx(1.5)}, ${rcx(1.5)}, ${rcx(1.5)}`, q: `${rcx(1.5)}, 0, ${rcx(1.5)}` } : { p: `${rcx(1.5)}, ${rcx(1.5)}`, q: `${rcx(1.5)}, ${rcx(1.5)}` }; }
      default: return {};
    }
  }
  // the custom formulas of SPEC 12.1 (a)
  const CUSTOM = [['e^{1/z}', 180], ['z^{i}', 180], ['\\sqrt{z}+1', 180], ['2^{z}', 180], ['\\log(z-1)', 90], ['\\cot z', 180], ['\\frac{1}{z^2}', 180],
    ['\\sin(2z+1)', 180], ['\\overline{z}^2', 180], ['(z+1)^{1.5}', 60], ['\\sqrt[3]{z}', -90], ['\\arcsin(z)/2', 180], ['\\operatorname{artanh}(z)', 180],
    ['3-\\frac{2}{z+i}', 180], ['i^{z}', 180], ['\\sec(z)', 180], ['(1+i)z^{0.7}', 150], ['e^{z^2}', 180], ['\\log(\\log z)', 180], ['\\csc z', 180], ['\\coth(z)', 180],
    ['z^{17.5}', 180], ['-\\tanh(z)', 180], ['\\cosh(z/2)', 180], ['\\arctan z', 180], ['\\operatorname{arcosh} z', 180], ['\\arccos(z)', 180], ['\\operatorname{arsinh}(z)', 180],
    ['\\exp(z)-1', 180], ['\\sinh(z)', 180], ['\\sqrt[2.5]{z}', 180], ['z', 180], ['(2-z)^{-1}', 180]];
  // (the zeros-and-poles step, 2026-10-22, has its own chains below: the random catalog chains keep their sequence)
  const TYPES = Object.keys(Funcs.DEFS).filter((t) => t !== 'deriv' && t !== 'custom' && t !== 'zp');
  const chains = [];
  for (const [e, cut] of CUSTOM) chains.push({ name: `custom ${e}`, steps: [St('custom', { expr: e, cut })] });
  for (const t of TYPES) chains.push({ name: `default ${t}`, steps: [St(t)] });
  const NCH = opts.chains ?? 300;
  for (let i = 0; chains.length < NCH + CUSTOM.length + TYPES.length && i < 20 * NCH; i++) {
    const len = rnd() < 0.5 ? 1 : rnd() < 0.7 ? 2 : 3;
    const steps = [];
    for (let j = 0; j < len; j++) { const t = pick(TYPES); steps.push(St(t, rnd() < 0.75 ? randParams(t) : {})); }
    const built = steps.map(Funcs.build);
    if (!Inverse.planChain(steps, built).ok) continue;
    chains.push({ name: `rand#${i} ${steps.map((s) => s.type).join('>')}`, steps });
  }
  // rational parts in which z occurs more than once (SPEC 3.3 rev 3: RAT2, QUAD, MOB, IPOW > R), example 9 first;
  // then random degree <= 2 rational formulas, alone and inside chains (opts.rational: false leaves them out)
  if (opts.rational !== false) {
    let rs = (opts.seed || 20261019) ^ 0x5eed;   // an own stream: the catalog chains and the shapes keep their random sequence
    const rr = () => { rs |= 0; rs = rs + 0x6D2B79F5 | 0; let t = Math.imul(rs ^ rs >>> 15, 1 | rs); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const rrf = (a, b) => a + rr() * (b - a), rpick = (arr) => arr[Math.floor(rr() * arr.length)];
    const RATIONAL = ['\\frac{z^2-1}{z^2+1}', '(z+1/z)/2', 'z^2+2z', '\\frac{(z-1)(z-2i)}{z-0.5}', '\\frac{z^2+z}{z^2+1}', '\\frac{1}{z}+\\frac{1}{z+1}',
      '\\frac{z}{z^2+1}', '\\frac{z+1/z}{z-1/z}', '\\frac{z^2-1}{z-1}', '\\log\\frac{z-1}{z+1}', '\\sqrt{z^2-1}', '\\left(\\frac{z-i}{z+i}\\right)^3',
      'e^{z+\\frac{1}{z}}', '\\sin(z+1/z)', 'z^3+\\frac{1}{z^3}', '\\frac{z^4-1}{z^4+1}', '\\frac{(1+i)z^2-3}{(2-i)z^2+z-0.5i}'];
    for (const e of RATIONAL) chains.push({ name: `rational ${e}`, steps: [St('custom', { expr: e, cut: 180 })] });
    const rcs = () => { const z = CX.C(rrf(-2, 2), rrf(-2, 2)); return `(${num(z.re)}${z.im < 0 ? '-' : '+'}${num(Math.abs(z.im))}i)`; };
    const forms = [() => `\\frac{${rcs()}z^2+${rcs()}z+${rcs()}}{${rcs()}z^2+${rcs()}z+${rcs()}}`, () => `\\frac{(z-${rcs()})(z-${rcs()})}{z-${rcs()}}`,
      () => `${rcs()}z+\\frac{${rcs()}}{z-${rcs()}}`, () => `\\frac{${rcs()}}{z-${rcs()}}+\\frac{${rcs()}}{z-${rcs()}}`, () => `${rcs()}z^2+${rcs()}z`];
    const NR = opts.rationalRandom ?? 24;
    for (let i = 0, made = 0; made < NR && i < 10 * NR; i++) {
      const steps = [St('custom', { expr: forms[i % forms.length](), cut: 180 })];
      if (i % 3 === 1) steps.unshift(St(rpick(['mobius', 'exp', 'sin', 'affine', 'log']), {}));
      if (i % 3 === 2) steps.push(St(rpick(['pown', 'exp', 'log', 'mobius', 'root']), {}));
      if (!Inverse.planChain(steps, steps.map(Funcs.build)).ok) continue;
      chains.push({ name: `rand-rational#${i} ${steps.map((x) => x.type === 'custom' ? x.params.expr : x.type).join(' > ')}`, steps });
      made++;
    }
  }
  // the zeros-and-poles step at degree <= 2 (MOB, AFF, QUAD, RAT2), alone and inside chains (no random draws)
  if (Funcs.DEFS.zp && opts.zp !== false) {
    const ZPS = [{}, { a: '2i', zeros: '1+i', poles: '-0.5' }, { a: '1', zeros: '', poles: '0.3-i' }, { a: '-1', zeros: '1, i', poles: '' },
      { a: '0.5', zeros: '1+i, -2', poles: '0.25i, 3' }, { a: '1', zeros: '0, 0', poles: '' }, { a: '1.5-0.5i', zeros: '-0.4+0.9i, 1.2', poles: '0.1' }];
    ZPS.forEach((p, i) => chains.push({ name: `zp#${i} ${JSON.stringify(p)}`, steps: [St('zp', p)] }));
    chains.push({ name: 'zp > exp', steps: [St('zp', ZPS[1]), St('exp')] });
    chains.push({ name: 'mobius > zp', steps: [St('mobius'), St('zp', ZPS[4])] });
    chains.push({ name: 'zp > zp', steps: [St('zp', ZPS[0]), St('zp', ZPS[3])] });
  }
  // ---- shapes ----
  const SH = [];
  function randShape(id) {
    const c = [rf(-2.5, 2.5), rf(-2.5, 2.5)], k = pick(['disc', 'disc', 'rect', 'halfplane', 'halfplane', 'sector', 'sector', 'annulus', 'polygon', 'polygon', 'cdisc', 'chalf', 'cpoly', 'formula']);
    switch (k) {
      case 'disc': return { id, kind: 'disc', c, r: rf(0.2, 2) };
      case 'cdisc': return { id, kind: 'disc', c, r: rf(0.2, 1.5), complement: true };
      case 'rect': return { id, kind: 'rect', a: c, b: [c[0] + rf(-3, 3), c[1] + rf(-3, 3)] };
      case 'halfplane': case 'chalf': { const a = rf(0, 2 * Math.PI); return { id, kind: 'halfplane', a: c, b: [c[0] + Math.cos(a), c[1] + Math.sin(a)], complement: k === 'chalf' }; }
      case 'sector': return { id, kind: 'sector', c, r: rnd() < 0.5 ? 0 : rf(0.5, 2.5), t1: ri(-180, 180), t2: ri(-180, 180) };
      case 'annulus': { const r1 = rf(0.1, 1); return { id, kind: 'annulus', c, r1, r2: r1 + rf(0.2, 1.5) }; }
      case 'polygon': case 'cpoly': {
        const n = ri(3, 12), R = rf(0.4, 2), pts = [];
        const convex = k === 'cpoly' || rnd() < 0.5;
        for (let i = 0; i < n; i++) { const a = 2 * Math.PI * i / n, rr = convex ? R : R * rf(0.4, 1); pts.push([c[0] + rr * Math.cos(a), c[1] + rr * Math.sin(a)]); }
        return { id, kind: 'polygon', pts, complement: k === 'cpoly' };
      }
      case 'formula': return { id, kind: 'formula', expr: pick(['|\\Im z|<1', '\\Re z>0, |\\Im z|<2', '|\\Re z|<\\frac{\\pi}{2}, \\Im z>0', '|z|<2']) };
    }
    return null;
  }
  // ---- GL ----
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 64;
  if (!GLR.ok && !GLR.init(cv)) { R.errors.push('no webgl2'); R.done = true; return R; }
  const gl = GLR.gl;
  GLR.begin(64, 64);
  const NP = 64, ROWS = 18;
  const mkTex = (w, h) => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, null);
    for (const [p, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST]]) gl.texParameteri(gl.TEXTURE_2D, p, v);
    return t;
  };
  const inTex = mkTex(1024, 2), outTex = mkTex(1024, 24);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, outTex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  const PRE = `uniform highp sampler2D uW;
int ixRecN; int ixRecRow; vec4 ixRecOut;
#define IX_RECORD(L, D, cov) { if (ixRecRow < 8 && ixRecN == ixRecRow) ixRecOut = vec4(L.u, L.lvl, ixScale(L.J)); if (ixRecRow >= 10 && ixRecN + 10 == ixRecRow) ixRecOut = vec4(s, cv, D, facing ? 1.0 : 0.0); ixRecN++; }
`;
  const MAIN_WALK = `
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec4 t = texelFetch(uW, ivec2(c.x, 0), 0);
  ixRecRow = c.y; ixRecN = 0; ixRecOut = vec4(0.0, 0.0, -3e38, -1.0);
  ixDwX = vec2(t.z, 0.0); ixDwY = vec2(0.0, t.z); ixPix = t.z;
  nb = 0; nCov = 0; U = 0.0; ixTailInf = false; ixTr = 1.0; ixLastOk = false; ixLastFin = false; ixLastD = 0.0; ixLastZ = vec2(0.0);
  invWalk(t.xy);
  if (c.y == 8) o = vec4(float(ixRecN), float(nCov), U, float(nb));
  else if (c.y == 9) o = vec4(nb > 0 ? bD[0] : -1.0, nb > 1 ? bD[1] : -1.0, nb > 2 ? bD[2] : -1.0, ixTailInf ? 1.0 : 0.0);
  else o = ixRecOut;
}
`;
  const MAIN_CLIP = `
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec4 t = texelFetch(uW, ivec2(c.x, 0), 0);
  float m = texelFetch(uW, ivec2(c.x, 1), 0).x;
  float lo, hi, hlo, hhi;
  ixShapeClip(t.xy, t.zw, m, lo, hi, hlo, hhi);
  o = vec4(lo, hi, hlo, hhi);
}
`;
  const EXTRA_WALK = { pre: PRE, main: MAIN_WALK }, EXTRA_CLIP = { pre: PRE, main: MAIN_CLIP };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // runs the program with st.extra on n points; rows = output rows
  async function gpuRun(st, data, n, rows) {
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, inTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 1024, 2, gl.RGBA, gl.FLOAT, data);
    const draw = () => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, n, rows);
      gl.disable(gl.BLEND); gl.disable(gl.SCISSOR_TEST);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, inTex);
      const r = GLR.drawInverse(st);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.enable(gl.BLEND);
      return r;
    };
    let r = draw();
    for (let i = 0; i < 4000 && r === 'pending'; i++) { await sleep(3); r = draw(); }
    if (r !== 'drawn') return { error: r };
    const out = new Float32Array(n * rows * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.readPixels(0, 0, n, rows, gl.RGBA, gl.FLOAT, out);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { out };
  }
  const isF = (z) => z && Number.isFinite(z.re) && Number.isFinite(z.im);
  const cabs = (z) => Math.hypot(z.re, z.im);
  // ---- one case (debugging): opts.single = {steps: [[type, params]], shape, win, pts, pix, alpha} ----
  if (opts.single) {
    const o = opts.single, steps = o.steps.map(([t, p]) => St(t, p)), built = steps.map(Funcs.build);
    const plan = Inverse.planChain(steps, built);
    GLR.setChain(GLChain.build(steps, built));
    const prep = Inverse.prepare(plan, { win: o.win, shape: o.shape });
    GLR.packShapes([o.shape], { debounce: false });
    const data = new Float32Array(1024 * 2 * 4);
    o.pts.forEach((w, i) => { data[4 * i] = w[0]; data[4 * i + 1] = w[1]; data[4 * i + 2] = Math.fround(o.pix); });
    const st = { map: { mode: 0, a: 0, b: steps.length }, plan, prep, shape: o.shape, look: { alpha: o.alpha, alphaOwn: o.alpha }, extra: EXTRA_WALK };
    const g = await gpuRun(st, data, NP, ROWS);
    const B = GLR.inverseB(o.alpha), K = Math.min(B, GLR.inverseK(o.alpha));
    return o.pts.map((w, i) => ({
      gpu: Array.from({ length: ROWS }, (_, r) => Array.from(g.out.subarray(4 * (r * NP + i), 4 * (r * NP + i) + 4))),
      cpu: Inverse.enumerate(plan, prep, C(w[0], w[1]), Math.fround(o.pix), { K, B, paths: true }).leaves.slice(0, 8).map((x) => ({ z: [x.z.re, x.z.im], lvl: x.lvl, s: x.s, cv: x.cv, D: x.D, path: x.path })),
      rec: GLR.packShapes([o.shape], { debounce: false }).recs.get(o.shape.id),
    }));
  }
  // ---- walk parity ----
  const SPC = opts.shapesPerChain ?? 2;
  let seedRat = null;   // the rational chains (last in the list) hand the random stream back as they found it: the clip test keeps its sample
  for (const ch of chains.slice(0, opts.maxCases || Infinity)) {
    const steps = ch.steps, built = steps.map(Funcs.build);
    const RA = /^(rational|rand-rational)/.test(ch.name) ? R.rational : null;
    if (RA && seedRat === null) seedRat = seed;
    const plan = Inverse.planChain(steps, built);
    if (!plan.ok) { R.skipped.ineligible++; continue; }
    if (RA) { RA.chains++; const k = plan.ops.map((o) => o.kind).join('>'); RA.kinds[k] = (RA.kinds[k] || 0) + 1; }
    GLR.setChain(GLChain.build(steps, built));
    const F = (z) => plan.ops.reduce((u, o) => o.fwd(u), z);
    for (let si = 0; si < SPC; si++) {
      R.cases++; if (RA) RA.cases++;
      const shape = randShape(si + 1);
      const ctr = [rf(-1, 1), rf(-1, 1)], s = rf(40, 120);
      const win = { x0: ctr[0] - 205 / s, x1: ctr[0] + 205 / s, y0: ctr[1] - 258 / s, y1: ctr[1] + 258 / s };
      let prep;
      try { prep = Inverse.prepare(plan, { win, shape }); } catch (e) { R.errors.push(`${ch.name}: prepare ${e.message}`); continue; }
      if (!prep.ok) { R.skipped.ineligible++; continue; }
      R.eligibleCases++; if (RA) RA.eligibleCases++;
      const pk = GLR.packShapes([shape], { debounce: false });
      if (!pk.recs.get(shape.id) || !pk.recs.get(shape.id).ok) { R.skipped.ineligible++; continue; }
      // test points: images of random points of the shape, and points around the image of the window centre
      const L = Region.levelOf(shape);
      const imgs = [];
      for (let k = 0; k < 400 && imgs.length < 40; k++) {
        const z = C(rf(win.x0 - 2, win.x1 + 2), rf(win.y0 - 2, win.y1 + 2));
        if (!(L(z) > 0)) continue;
        const w = F(z);
        if (isF(w) && cabs(w) < 1e6) imgs.push(w);
      }
      if (!imgs.length) { const w = F(C(ctr[0], ctr[1])); if (isF(w)) imgs.push(w); }
      if (!imgs.length) continue;
      const xs = imgs.map((w) => w.re).sort((a, b) => a - b), ys = imgs.map((w) => w.im).sort((a, b) => a - b);
      const span = Math.max(1e-3, Math.min(1e4, Math.max(xs[Math.floor(xs.length * 0.9)] - xs[Math.floor(xs.length * 0.1)], ys[Math.floor(ys.length * 0.9)] - ys[Math.floor(ys.length * 0.1)])));
      const pix = span / 300;
      const pts = [];
      for (const w of imgs) pts.push(C(Math.fround(w.re + rf(-3, 3) * pix), Math.fround(w.im + rf(-3, 3) * pix)));
      const cm = C(xs[xs.length >> 1], ys[ys.length >> 1]);
      while (pts.length < NP) pts.push(C(Math.fround(cm.re + rf(-1, 1) * span), Math.fround(cm.im + rf(-1, 1) * span)));
      const alpha = rnd() < 0.5 ? 1 : 0.85;
      const B = GLR.inverseB(alpha), K = Math.min(B, GLR.inverseK(alpha));
      const data = new Float32Array(1024 * 2 * 4);
      pts.forEach((w, i) => { data[4 * i] = w.re; data[4 * i + 1] = w.im; data[4 * i + 2] = Math.fround(pix); });
      const st = { map: { mode: 0, a: 0, b: steps.length }, plan, prep, shape, look: { alpha, alphaOwn: alpha, pattern: 'checker', cell: 0.5 }, extra: EXTRA_WALK };
      const g = await gpuRun(st, data, NP, ROWS);
      if (g.error) { R.errors.push(`${ch.name}: gpu ${g.error}`); continue; }
      R.programs.add(GLR.inverseInfo && GLR.inverseInfo.key);
      const px32 = Math.fround(pix);
      const cpuOf = (w) => Inverse.enumerate(plan, prep, w, px32, { K, B, paths: true });
      for (let i = 0; i < NP; i++) {
        R.points++;
        const w = pts[i];
        const cpu = cpuOf(w);
        const lv = cpu.leaves;
        // discontinuity / ramp screens
        const d = 2e-4 * (1 + cabs(w)), sig = (r) => r.leaves.slice(0, 8).map((x) => x.path).join('|') + '#' + Math.min(r.visited, 9);
        const s0 = sig(cpu);
        let disc = false;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (sig(cpuOf(C(w.re + d * dx, w.im + d * dy))) !== s0) { disc = true; break; }
        if (disc) { R.skipped.discontinuous++; continue; }
        if (lv.slice(0, 8).some((x) => Number.isFinite(x.lvl) && Math.abs(x.lvl + 1) < 0.02)) { R.skipped.ramp++; continue; }
        R.compared++; if (RA) RA.compared++;
        const o = g.out;
        const at = (row) => [o[4 * (row * NP + i)], o[4 * (row * NP + i) + 1], o[4 * (row * NP + i) + 2], o[4 * (row * NP + i) + 3]];
        const bad = [];
        const cnt = at(8);
        if (cnt[0] !== cpu.visited) bad.push(`visited gpu ${cnt[0]} cpu ${cpu.visited}`);
        for (let r = 0; r < Math.min(8, lv.length); r++) {
          const c = lv[r], q = at(r);
          R.leaves++; if (RA) RA.leaves++;
          if (!isF(c.z)) continue;
          const dz = Math.hypot(q[0] - c.z.re, q[1] - c.z.im);
          if (!(dz <= 2e-3 * (1 + cabs(c.z)))) bad.push(`leaf ${r} z gpu ${q[0]},${q[1]} cpu ${c.z.re},${c.z.im} (${c.path})`);
          const cl = Number.isFinite(c.lvl) ? c.lvl : 1e38;
          if (!((cl >= 1e30 && q[2] >= 1e30) || Math.abs(q[2] - cl) <= 0.05 + 1e-4 * Math.abs(cl))) bad.push(`leaf ${r} lvl gpu ${q[2]} cpu ${cl}`);
          // |J| and D only where float32 resolves them: keys D <= 16 (deeper sheets lie 2^16 window radii away or within
          // ~1e-6 rs of an accumulation point, and are never visible) and 1e-15 < |dz/dw| < 1e15
          const cj = Math.sqrt(Math.abs(c.J[0] * c.J[3] - c.J[1] * c.J[2]));
          if (!(c.D <= 16 && cj > 1e-15 && cj < 1e15)) { R.skipped.deepLeaves = (R.skipped.deepLeaves || 0) + 1; continue; }
          if (!(Math.abs(q[3] - cj) <= 5e-3 * cj)) bad.push(`leaf ${r} |J| gpu ${q[3]} cpu ${cj}`);
        }
        // coverage of each leaf: signed distance (px, clamped), coverage, key
        for (let r = 0; r < Math.min(8, lv.length); r++) {
          const c = lv[r], q = at(10 + r);
          if (!isF(c.z) && !(c.lam)) continue;
          if (Math.abs(q[1] - c.cv) > 0.03) bad.push(`leaf ${r} cv gpu ${q[1].toFixed(3)} (s ${q[0].toFixed(3)}) cpu ${c.cv.toFixed(3)} (s ${Number.isFinite(c.s) ? c.s.toFixed(3) : c.s}, lvl ${c.lvl})`);
          if (c.cov && c.D <= 16 && !(Math.abs(q[2] - c.D) <= 2e-3 * (1 + Math.abs(c.D)))) bad.push(`leaf ${r} D gpu ${q[2]} cpu ${c.D}`);
        }
        // front keys
        const fk = at(9), ent = cpu.entries;
        for (let r = 0; r < 3 && r < ent.length; r++) if (ent[r].D <= 16 && !(Math.abs(fk[r] - ent[r].D) <= 2e-3 * (1 + Math.abs(ent[r].D)))) bad.push(`front ${r} D gpu ${fk[r]} cpu ${ent[r].D}`);
        if (bad.length) {
          R.failCount++; if (RA) RA.failCount++;
          R.byChain[ch.name] = (R.byChain[ch.name] || 0) + 1;
          if (R.fails.length < 40 || (R.byChain[ch.name] || 0) <= 2) R.fails.push({ chain: ch.name, steps: steps.map((x) => [x.type, x.params]), shape: JSON.stringify(shape), win, w: [w.re, w.im], pix, alpha, bad: bad.slice(0, 4) });
        }
      }
    }
  }
  if (seedRat !== null) seed = seedRat;
  // ---- saturation anchors (SPEC 13.12, P2 review): artanh / arctan of shapes through +-1 / +-i, far out in the strip
  // (|Re w| up to 40: float32 tanh w is +-1 there): GPU leaf coverage = CPU (anchored, float64), and the coverage of
  // artanh(|z| < 1) and arctan(|z| < 1) is the exact strip |Im w| < pi/4 (|Re w| < pi/4) ----
  if (opts.anchors !== false) {
    const AN = R.anchors = { points: 0, compared: 0, failCount: 0, fails: [], truthBad: 0, truthN: 0, anchoredShapes: 0 };
    const tri = [[1, 0], [-0.3, 0.9], [-0.5, -0.6]];
    const SHAPES = [{ id: 'd', kind: 'disc', c: [0, 0], r: 1 }, { id: 'h', kind: 'halfplane', a: [0, 0], b: [1, 0] }, { id: 't', kind: 'polygon', pts: tri },
      { id: 'tc', kind: 'polygon', pts: tri, complement: true }, { id: 'r', kind: 'rect', a: [1, 0], b: [2.5, 1.5] }, { id: 's', kind: 'sector', c: [-1, 0], r: 0, t1: -30, t2: 60 },
      { id: 'a', kind: 'annulus', c: [0, 0], r1: 0.4, r2: 1 }, { id: 'dc', kind: 'disc', c: [1, 1], r: 1, complement: true }];
    const CH = [['artanh', [St('artanh')]], ['arctan', [St('arctan')]], ['2z then artanh', [St('mul', { c: '2' }), St('artanh')]], ['custom artanh', [St('custom', { expr: '\\operatorname{artanh}(z)', cut: 180 })]],
      ['artanh then joukowski', [St('artanh'), St('joukowski')]]];
    for (const [name, steps] of CH) {
      const built = steps.map(Funcs.build), plan = Inverse.planChain(steps, built);
      if (!plan.ok) { AN.fails.push({ chain: name, bad: ['plan ' + plan.reason] }); AN.failCount++; continue; }
      GLR.setChain(GLChain.build(steps, built));
      const F = (z) => plan.ops.reduce((u, o) => o.fwd(u), z);
      const scale = name.startsWith('2z') ? 0.5 : 1;
      const shapes = SHAPES.map((sh) => (scale === 1 ? sh : Object.assign({}, sh, sh.c ? { c: sh.c.map((x) => x * scale), r: sh.r && sh.r * scale, r1: sh.r1 && sh.r1 * scale, r2: sh.r2 && sh.r2 * scale } : {}, sh.pts ? { pts: sh.pts.map((q) => q.map((x) => x * scale)) } : {}, sh.a && sh.kind === 'rect' ? { a: sh.a.map((x) => x * scale), b: sh.b.map((x) => x * scale) } : {})));
      for (const shape of shapes) {
        const win = { x0: -3, x1: 3, y0: -3, y1: 3 };
        const prep = Inverse.prepare(plan, { win, shape });
        if (!prep.ok) continue;
        if (prep.anc) AN.anchoredShapes++;
        const pk = GLR.packShapes([shape], { debounce: false });
        if (!pk.recs.get(shape.id) || !pk.recs.get(shape.id).ok) continue;
        const tan = name.includes('arctan');
        for (const pix of [0.05, 0.25]) {
          const pts = [];
          for (let i = 0; i < NP; i++) {
            const far = rf(1.5, 40) * (rnd() < 0.5 ? -1 : 1), across = rf(-2, 2);
            let w = tan ? C(across, far) : C(far, across);
            if (name.endsWith('joukowski')) w = F(Inverse.enumerate(plan, prep, C(0, 0), pix).leaves.length ? C(Math.tanh(far / 8), across / 3) : C(0, 0));
            pts.push(C(Math.fround(w.re), Math.fround(w.im)));
          }
          const data = new Float32Array(1024 * 2 * 4);
          pts.forEach((w, i) => { data[4 * i] = w.re; data[4 * i + 1] = w.im; data[4 * i + 2] = Math.fround(pix); });
          const st = { map: { mode: 0, a: 0, b: steps.length }, plan, prep, shape, look: { alpha: 1, alphaOwn: 1, pattern: 'checker', cell: 0.5 }, extra: EXTRA_WALK };
          const g = await gpuRun(st, data, NP, ROWS);
          if (g.error) { R.errors.push(`anchor ${name}: gpu ${g.error}`); continue; }
          for (let i = 0; i < NP; i++) {
            AN.points++;
            const w = pts[i], cpu = Inverse.enumerate(plan, prep, w, Math.fround(pix), { K: 1, B: 3, paths: true });
            const o = g.out, at = (row) => [o[4 * (row * NP + i)], o[4 * (row * NP + i) + 1], o[4 * (row * NP + i) + 2], o[4 * (row * NP + i) + 3]];
            const bad = [];
            for (let r = 0; r < Math.min(8, cpu.leaves.length); r++) {
              const c = cpu.leaves[r], q = at(10 + r);
              if (Math.abs(q[1] - c.cv) > 0.03) bad.push(`leaf ${r} cv gpu ${q[1].toFixed(3)} (s ${q[0].toFixed(3)}) cpu ${c.cv.toFixed(3)} (s ${Number.isFinite(c.s) ? c.s.toFixed(3) : c.s})`);
            }
            const U = at(8)[2];
            if (Math.abs(U - cpu.U) > 0.03) bad.push(`U gpu ${U.toFixed(3)} cpu ${cpu.U.toFixed(3)}`);
            // the exact strip for the unit disc (one leaf; |Im w| - pi/4 in px)
            if (shape.id === 'd' && (name === 'artanh' || name === 'arctan' || name === 'custom artanh')) {
              const e = (Math.abs(tan ? w.re : w.im) - Math.PI / 4) / pix;
              if (Math.abs(e) > 0.75) { AN.truthN++; if ((U > 0.5) !== (e < 0)) { AN.truthBad++; bad.push(`truth: U ${U.toFixed(3)} at ${(e).toFixed(2)} px from the strip edge`); } }
            }
            AN.compared++;
            if (bad.length) { AN.failCount++; if (AN.fails.length < 30) AN.fails.push({ chain: name, shape: shape.id, w: [w.re, w.im], pix, bad: bad.slice(0, 3) }); }
          }
        }
      }
    }
    if (AN.failCount) R.failCount += AN.failCount;
  }
  // ---- shapeClip vs Region.shapeClip ----
  {
    const steps = [St('mul', { c: '1' })], built = steps.map(Funcs.build);
    GLR.setChain(GLChain.build(steps, built));
    const plan = Inverse.planChain(steps, built);
    const kinds = { disc: 0, rect: 0, halfplane: 0, sector: 0, annulus: 0, polygon: 0, cdisc: 0, chalf: 0, cpoly: 0, formula: 0 };
    const CL = R.clip = { lines: 0, compared: 0, failCount: 0, fails: [], skipped: 0 };
    const N = 1024;
    for (let rep = 0; rep < (opts.clipShapes ?? 60); rep++) {
      let shape = randShape(1);
      const prim = Region.clipPrimitive(shape);
      const win = { x0: -4, x1: 4, y0: -4, y1: 4 };
      const prep = Inverse.prepare(plan, { win, shape });
      if (!prep.ok) continue;
      GLR.packShapes([shape], { debounce: false });
      const data = new Float32Array(1024 * 2 * 4), lines = [];
      for (let i = 0; i < N; i++) {
        const z0 = C(Math.fround(rf(-5, 5)), Math.fround(rf(-5, 5))), a = rf(0, 2 * Math.PI), ql = Math.exp(rf(-3, 2));
        const q = C(Math.fround(ql * Math.cos(a)), Math.fround(ql * Math.sin(a))), m = Math.fround(rnd() < 0.5 ? 0 : rf(0, 0.3));
        lines.push({ z0, q, m });
        data.set([z0.re, z0.im, q.re, q.im], 4 * i); data[4 * (1024 + i)] = m;
      }
      const st = { map: { mode: 0, a: 0, b: 1 }, plan, prep, shape, look: { alpha: 1 }, extra: EXTRA_CLIP };
      const g = await gpuRun(st, data, N, 1);
      if (g.error) { R.errors.push('clip gpu ' + g.error); break; }
      for (let i = 0; i < N; i++) {
        CL.lines++;
        const { z0, q, m } = lines[i];
        const c = Region.shapeClip(prim, z0, q, m), o = g.out.subarray(4 * i, 4 * i + 4);
        const qa = cabs(q), tol = (t) => 1e-4 * (1 + cabs(z0) + Math.abs(t) * qa) / qa;
        const same = (a, b) => (Math.abs(a) >= 1e29 / Math.max(qa, 1e-9) && Math.abs(b) >= 1e29 / Math.max(qa, 1e-9) && Math.sign(a) === Math.sign(b))
          || (!Number.isFinite(a) && Math.abs(b) >= 1e29) || Math.abs(a - b) <= tol(a);
        const emptyC = !(c.lo <= c.hi), emptyG = !(o[0] <= o[1]);
        // near-tangent lines (interval shorter than the tolerance) decide emptiness by rounding
        if (emptyC !== emptyG) { if ((!emptyC && (c.hi - c.lo) <= 4 * tol(c.lo)) || emptyC) { CL.skipped++; continue; } }
        CL.compared++;
        const bad = [];
        if (emptyC !== emptyG) bad.push(`empty cpu ${emptyC} gpu ${emptyG}`);
        else if (!emptyC && !(same(c.lo, o[0]) && same(c.hi, o[1]))) bad.push(`in cpu [${c.lo}, ${c.hi}] gpu [${o[0]}, ${o[1]}]`);
        const hC = c.hlo <= c.hhi, hG = o[2] <= o[3];
        if (hC !== hG) { if (!(hC && c.hhi - c.hlo <= 4 * tol(c.hlo))) bad.push(`hole cpu ${hC} gpu ${hG}`); }
        else if (hC && !(same(c.hlo, o[2]) && same(c.hhi, o[3]))) bad.push(`hole cpu [${c.hlo}, ${c.hhi}] gpu [${o[2]}, ${o[3]}]`);
        if (bad.length) { CL.failCount++; if (CL.fails.length < 20) CL.fails.push({ shape: JSON.stringify(shape).slice(0, 140), z0: [z0.re, z0.im], q: [q.re, q.im], m, bad }); }
      }
      kinds[shape.kind + (shape.complement ? '~' : '')] = (kinds[shape.kind + (shape.complement ? '~' : '')] || 0) + 1;
    }
    CL.kinds = kinds;
  }
  // ---- REGION_FS byte identity (SPEC 6.1) ----
  {
    const fx = window.__REGION_FS_FIXTURES || {};
    R.fs = { flat: GLR._src.REGION_FS(false) === fx.flat, sphere: GLR._src.REGION_FS(true) === fx.sphere };
  }
  // ---- 12.1 (l): program identity under eligibility flips ----
  if (opts.flip !== false) R.flip = await flipTest();
  R.programs = R.programs.size;
  R.ms = Math.round(performance.now() - t0);
  R.done = true;
  return R;

  async function flipTest() {
    const out = { cases: [], ok: true };
    const disc = { id: 7, kind: 'disc', c: [0.3, 0.2], r: 0.9 };
    const win = { x0: -3.4, x1: 3.4, y0: -4.3, y1: 4.3 };
    const seqs = [
      ['poly', [{ co: '1, 0, -1, 0' }, { co: '1, 0, 0, 5' }, { co: '1, 0, -1, 0' }]],
      ['rational', [{ p: '1, 2', q: '1, 0' }, { p: '1, 2', q: '0, 1' }, { p: '1, 2', q: '1, 0' }]],
      // through degeneracy: (z + 2) / (2z + 4) is the constant 1/2 (its image is a point: nothing to fill)
      ['mobius', [{ a: '1', b: '2', c: '1', d: '3' }, { a: '1', b: '2', c: '2', d: '4' }, { a: '1', b: '2', c: '2', d: '4.1' }, { a: '1', b: '2', c: '2', d: '4' }, { a: '1', b: '2', c: '1', d: '3' }]],
    ];
    const mesh = Region.buildMesh(disc, win, 60);
    const res = GLR.createMesh(Region.meshInstances(mesh));
    const W = 205, H = 258;
    for (const [type, list] of seqs) {
      let prevFwd = null, prevInv = null;
      for (const params of list) {
        const steps = [St(type, params)], built = steps.map(Funcs.build);
        const info = GLChain.build(steps, built);
        GLR.setChain(info);
        const plan = Inverse.planChain(steps, built);
        const rec = { type, params: JSON.stringify(params), fwdKey: info.key, slots: info.slots, invKey: info.inverse && info.inverse.key, eligible: plan.ok };
        if (prevFwd !== null) { rec.fwdKeySame = prevFwd === info.key; rec.invKeyChanged = prevInv !== rec.invKey; }
        // the frame: the inverse pass when eligible and compiled (waited for), else the forward mesh
        let drawn = 'forward';
        GLR.packShapes([disc], { debounce: false });
        const prep = plan.ok ? Inverse.prepare(plan, { win, shape: disc }) : null;
        // the view: fitted to the image of the disc (boundary samples through the step's own map)
        const f = built[0].f, bs = [];
        for (let k = 0; k < 64; k++) { const w = f(C(disc.c[0] + disc.r * Math.cos(k * Math.PI / 32), disc.c[1] + disc.r * Math.sin(k * Math.PI / 32))); if (isF(w) && cabs(w) < 1e3) bs.push(w); }
        const bx = bs.length ? [Math.min(...bs.map((w) => w.re)), Math.max(...bs.map((w) => w.re)), Math.min(...bs.map((w) => w.im)), Math.max(...bs.map((w) => w.im))] : [-1, 1, -1, 1];
        const view = { cx: (bx[0] + bx[1]) / 2, cy: (bx[2] + bx[3]) / 2, s: Math.min(1e4, 0.8 * Math.min(W / Math.max(1e-6, bx[1] - bx[0]), H / Math.max(1e-6, bx[3] - bx[2]))) };
        const look = { color: '#3B6FD4', color2: '#8CABE5', alpha: 1, alphaOwn: 1, pattern: 'solid', cell: 0.5 };
        const frame = () => {
          GLR.begin(W, H, [1, 1, 1, 1]);
          let r = 'error';
          if (plan.ok && prep && prep.ok) r = GLR.drawInverse({ map: { mode: 0, a: 0, b: 1 }, plan, prep, shape: disc, view, dpr: 1, look });
          if (r !== 'drawn') GLR.drawRegion(res, Object.assign({ map: { mode: 0, a: 0, b: 1 }, view, dpr: 1, L: 4, cacheKey: null, sync: true }, look));
          return r;
        };
        let r = frame();
        for (let i = 0; i < 4000 && r === 'pending'; i++) { await sleep(3); r = frame(); }
        drawn = r === 'drawn' ? 'inverse' : 'forward';
        rec.drawn = drawn;
        const px = new Uint8Array(W * H * 4);
        gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
        let filled = 0;
        for (let k = 0; k < W * H; k++) if (px[4 * k + 2] > 150 && px[4 * k] < 150) filled++;
        rec.filled = filled;
        // the program drawn is the current inverse key's, built from this info's lib + walker
        if (drawn === 'inverse') {
          const [, fs] = GLR._src.invSources(GLR.inverseB(1), false, []);
          rec.srcHasLib = fs.includes(info.inverse.lib) && fs.includes(info.inverse.walker);
          rec.status = GLR.inverseStatus(1);
        }
        // the forward key is constant across the poly and Mobius flips; rational q '1, 0' -> '0, 1' trims q to one
        // coefficient, which changes the forward key itself (GLChain's ['rational', 2, 2] -> ['rational', 2, 1])
        rec.constant = !!(built[0].props && built[0].props.constant) || (type === 'mobius' && !(built[0].props && built[0].props.mobius));
        rec.ok = (filled > 200 || rec.constant) && (type === 'rational' || rec.fwdKeySame !== false) && (prevFwd === null || rec.invKeyChanged) && (drawn !== 'inverse' || rec.srcHasLib) && (drawn === 'inverse') === plan.ok;
        if (!rec.ok) out.ok = false;
        out.cases.push(rec);
        prevFwd = info.key; prevInv = rec.invKey;
      }
    }
    GLR.destroy(res);
    return out;
  }
};
