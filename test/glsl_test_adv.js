'use strict';
// Adversarial GPU-vs-CPU conformance test for GLChain (independent of test/glsl_test.js).
// Runs synchronously on load; results in window.__glslTest.
// URL options: ?parts=N&part=i, ?filter=substr, ?only=direct|keys|compile|main (comma list; default all)
(function () {
  const R = window.__glslTest = {
    done: false, total: 0, compared: 0, skippedDisc: 0, skippedNonFinite: 0, chains: 0, programs: 0,
    failures: [], failCount: 0, failByChain: {}, errors: [], keyChecks: [], keyFails: [], determinism: { checked: 0, sameKey: 0, bad: [] },
    direct: [], compile12: [], limits: {}, fillChecks: [], ms: 0,
  };
  const t0 = performance.now();
  const qs = new URLSearchParams(location.search);
  const PARTS = +qs.get('parts') || 1, PART = +qs.get('part') || 0, FILTER = qs.get('filter') || '';
  const ONLY = (qs.get('only') || 'direct,keys,compile,main').split(',');
  const C = CX.C;
  const f32 = Math.fround;
  const TOL = 2e-3;
  const TS = [0, 1e-6, 0.01, 0.25, 0.37, 0.4999, 0.5, 0.5001, 0.73, 0.9, 0.99, 0.999, 0.9999, 1];

  let seed = 987654;
  const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const rf = (a, b) => a + rnd() * (b - a);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const num = (x) => String(+x.toFixed(3));
  const cxs = (re, im) => (im === 0 ? num(re) : `${num(re)}${im < 0 ? '-' : '+'}${num(Math.abs(im))}i`);
  const rcx = (r = 2) => cxs(rf(-r, r), rf(-r, r));

  const S = (type, params = {}, on = true) => ({ type, params: Object.assign(Funcs.defaults(type), params), on });
  const CUTS = [0, 90, -45, 180, -180, 270, 30, 135, -90, 360];

  // ---------------- chains ----------------
  const chains = [];
  const add = (name, steps) => chains.push({ name, steps });
  // A. roots: n = 2..9, sheets -3..n-1, cut angles along sample rows
  for (let n = 2; n <= 9; n++) {
    const ks = new Set([-3, -2, -1, 0, 1, 2, 3]); for (let k = 0; k < n; k++) ks.add(k);
    for (const k of ks) { const cut = CUTS[((n * 7 + k + 30) % CUTS.length)]; add(`root n=${n} k=${k} cut=${cut}`, [S('root', { n, k, cut })]); }
  }
  add('root n=1 (clamped)', [S('root', { n: 1, k: 5, cut: 90 })]);
  add('root n=-4 (clamped)', [S('root', { n: -4, k: -1, cut: 0 })]);
  // B. complex powers
  const ALPHAS = ['0.5+0.3i', '-1.5+2i', '0.25i', '2-0.7i', '-0.5-0.5i', '1+i', '1.5', '-2.5', '3i', '0.1-3i'];
  ALPHAS.forEach((alpha, j) => { for (let k = -3; k <= 3; k++) { const cut = CUTS[(j * 3 + k + 30) % CUTS.length]; add(`powa a=${alpha} k=${k} cut=${cut}`, [S('powa', { alpha, k, cut })]); } });
  // C. logs
  for (let k = -3; k <= 3; k++) for (let j = 0; j < 5; j++) { const cut = CUTS[(k * 5 + j * 2 + 40) % CUTS.length]; add(`log k=${k} cut=${cut}`, [S('log', { k, cut })]); }
  // D. integer powers
  for (const n of [-7, -2, -1, 0, 1, 2, 13, 64, -64, 1000, 4096, -4096, 100003, 16777217, -16777217]) add(`pown n=${n}`, [S('pown', { n })]);
  // E. Mobius family
  const mob = (a, b, c, d) => S('mobius', { a, b, c, d });
  [
    ['1', '2', '0', '1'], ['2', '0', '0', '1'], ['1', '2', '2', '4'], ['0.1', '0.2', '0.3', '0.6'], ['1', 'i', 'i', '-1'],
    ['1', '1', '0', '1'], ['2', '-1', '1', '0'], ['-2', '1', '-1', '0'], ['-1', '1', '0', '-1'], ['1+i', '1', '0', '1+i'],
    ['0', '1', '-1', '0'], ['1', '2', '-1', '-1'], ['i', '0', '0', '-i'], ['3', '0', '0', '1'], ['1000', '0', '0', '0.001'],
    ['100', '1', '1', '0.0100001'], ['2', '1', '1', '0.5000001'], ['1', '0', '0', '1'], ['-1', '0', '0', '-1'], ['1', '-i', '1', 'i'],
    ['i', 'i', '-1', '1'], ['1', '1', '-1', '1'], ['0.00000001', '0', '0', '0.00000001'], ['100000000000000000000', '0', '0', '100000000000000000000'], ['5', '3', '-2', '7i'],
  ].forEach((m) => add(`mobius ${m.join(',')}`, [mob(...m)]));
  for (const c of ['0', '1', '-1', 'i', '-i', '0.00000000000001', '0.0000000000001', '0.00000000000002', '1000', '10000', '30000', '100000', '1000000', '100000000', '0.00001', '100000i', '-100000', '100000+100000i', '-1-0.000000001i', '0.9999+0.0141i'])
    add(`mul c=${c}`, [S('mul', { c })]);
  for (const [a, b] of [['0', '1+i'], ['1', '0'], ['1', '3-i'], ['100000', '1'], ['-1', '2'], ['0.000001', '1'], ['i', '1']]) add(`affine a=${a} b=${b}`, [S('affine', { a, b })]);
  for (const a of ['0.999', '0.9999i', '-0.99999', '0.6+0.8i', '0.7071+0.7071i', '0.99+0.1i', '1', '-1', 'i', '0', '0.5', '1.5', '0.9999999'])
    for (const phi of [0, 45, -120, 180]) add(`blaschke a=${a} phi=${phi}`, [S('blaschke', { a, phi })]);
  add('recip', [S('recip')]);
  add('add c=0', [S('add', { c: '0' })]);
  add('add c=100000-3i', [S('add', { c: '100000-3i' })]);
  // F. polynomials / rationals
  for (const co of ['0, 0, 1, 2', '0, 0, 0', '0', '5', '0, 0.000000000000000000000000000001, 1', '1, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1', '1, -2, 1', '0.001, 0, 1000', '0, 0, i, 0, 0',
    '1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11', '1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1'])
    add(`poly ${co}`, [S('poly', { co })]);
  for (let d = 0; d <= 10; d++) add(`poly rand deg ${d}`, [S('poly', { co: Array.from({ length: d + 1 }, () => rcx(1.2)).join(', ') })]);
  for (const [p, q] of [['1, 0, -1', '1, -1'], ['1, -3, 3, -1', '1, -2, 1'], ['1, 0, 1', '1, 0, 1'], ['2, 2', '1, 1'], ['1, i', '1, i, 0'],
    ['0, 0, 1', '0, 1, 0'], ['1, 0, 0, 0, 1', '1, 0, 1'], ['0', '1, 1'], ['1', '1, 0, 0, 0, 0, 0, 1'], ['3', '0, 0, 2']])
    add(`rational ${p} / ${q}`, [S('rational', { p, q })]);
  // G. every simple step type with defaults
  for (const t of ['exp', 'sin', 'cos', 'tan', 'sinh', 'cosh', 'tanh', 'arcsin', 'arccos', 'arctan', 'arsinh', 'arcosh', 'artanh', 'joukowski', 'conj', 'recip'])
    add(`default ${t}`, [S(t)]);
  add('ijouk exterior', [S('ijouk', { branch: 'exterior' })]);
  add('ijouk interior', [S('ijouk', { branch: 'interior' })]);
  // H. custom formulas
  const EXPRS = [
    '\\frac{e^{z}-1}{z}', 'z^{1/3}', '(1+i)^z', 'e^{z^2}', '\\log(z-1)+\\sqrt{z+1}', '\\arcsin(z)\\cos(2z)', '|z|^2+\\overline{z}', '\\sqrt[3]{z^2-1}',
    '2^{z}', 'z^{2.5}', '\\cot z', '\\Re z + i\\Im z', '\\arg(z)',
    'z^{\\sqrt{-4}}', '(-8)^{1/3}z', 'z^{(-1)^{1/2}}', '\\sqrt[\\sqrt{-1}]{z}', 'z^{\\log(-1)}', '(-2)^z', 'e^{\\pi i z}', 'z^{4096}', 'z^{4097}', 'z^{-4096}',
    '\\sqrt[3]{-8}\\cdot z', 'i^{i}z', 'z^{0}', 'z^{-0}', 'z^{1.0000001}', '\\frac{\\sin z}{z}', '\\frac{1-\\cos z}{z^2}', 'w^2+w', '\\sqrt{z}^2', '(z^{1/2})^{2}',
    '\\log(e^{z})', 'e^{\\log z}', '\\sec z\\csc z', '\\coth(z)', '\\operatorname{arcosh}(z)', '\\operatorname{artanh}(z/2)', 'z^{z}', 'z^{1/z}', 'e^{1/z}',
    '\\sqrt[-3]{z}', '\\sqrt[2.5]{z}', '\\sqrt[i]{z}', 'z^{-2.5}', 'z^{-1+i}', '\\log(-z)', '\\sqrt{-z}', '(z-1)^{1/2}(z+1)^{1/2}', '\\arg(-z)+\\arg(z)',
    '\\Re(\\log z)', '\\Im(\\sqrt{z})', '|\\sin z|', '\\overline{\\log z}', '\\tan(z)\\cdot\\cot(z)', 'z^{-1}+z^{-2}+z^{-3}', '(z^2+1)^{-1}', '\\exp(\\exp(z))',
    '\\cos(\\pi/3)z', 'e^{i\\pi}z', '\\log(e)z', 'e^{2}z', 'e^{e}z', '\\sqrt{2}^{z}', '\\pi^z', '0^z', 'z^{1/4096}', '(0.001)^z', '10^{z}',
  ];
  EXPRS.forEach((e, i) => {
    add(`custom ${e} cut=180`, [S('custom', { expr: e, cut: 180 })]);
    for (const j of [1, 2]) { const cut = CUTS[(i * 2 + j) % CUTS.length]; if (cut !== 180) add(`custom ${e} cut=${cut}`, [S('custom', { expr: e, cut })]); }
  });
  // I. errors / bypass
  add('err+off mix', [S('exp', {}, false), S('custom', { expr: '\\frac{' }), S('root', { n: 3, cut: 90, k: 2 }), S('mul', { c: 'zz' }), S('log', { cut: -45, k: 1 }, false), S('custom', { expr: '(1+i)^z' })]);
  add('all off', [S('exp', {}, false), S('sin', {}, false), S('custom', { expr: 'z^2' }, false)]);
  add('all err', [S('rational', { q: '0' }), S('custom', { expr: 'x' }), S('custom', { expr: '\\sqrt[z]{z}' })]);
  // J. multi-step chains from a hostile pool
  const POOL = [
    () => S('root', { n: ri(2, 9), k: ri(-3, 3), cut: pick(CUTS) }),
    () => S('powa', { alpha: pick(ALPHAS), k: ri(-3, 3), cut: pick(CUTS) }),
    () => S('log', { k: ri(-3, 3), cut: pick(CUTS) }),
    () => S('pown', { n: pick([-7, -2, -1, 0, 1, 2, 3, 13]) }),
    () => mob(rcx(), rcx(), pick(['0', rcx()]), rcx()),
    () => S('blaschke', { a: pick(['0.999', '0.5+0.5i', '0.6+0.8i', '-0.3i']), phi: ri(-180, 180) }),
    () => S('mul', { c: pick(['0', '2', '-1', 'i', '0.5-0.5i']) }),
    () => S('affine', { a: rcx(), b: rcx() }),
    () => S('add', { c: rcx() }),
    () => S('poly', { co: pick(['0, 0, 1, 2', '1, 0, -1', '1, 0, 0, 1', rcx() + ', ' + rcx()]) }),
    () => S('rational', { p: pick(['1, 0, -1', '1, 1']), q: pick(['1, -1', '1, 0, 1', '2']) }),
    () => S('custom', { expr: pick(EXPRS.slice(0, 13)), cut: pick(CUTS) }),
    () => S(pick(['exp', 'sin', 'cos', 'tan', 'sinh', 'tanh', 'arcsin', 'arccos', 'arctan', 'arsinh', 'arcosh', 'artanh', 'joukowski', 'conj', 'recip'])),
    () => S('ijouk', { branch: pick(['exterior', 'interior']) }),
  ];
  for (let i = 0; i < 60; i++) {
    const len = ri(2, 5);
    const steps = [];
    for (let j = 0; j < len; j++) { const st = pick(POOL)(); if (rnd() < 0.12) st.on = false; steps.push(st); }
    if (i % 8 === 7) steps.splice(ri(0, steps.length), 0, S('custom', { expr: 'z^' }));
    add(`multi#${i} ${steps.map((s) => (s.on ? '' : '~') + s.type).join('>')}`, steps);
  }
  // K. 12-step chains
  const TWELVE = [
    [S('mobius'), S('custom', { expr: '\\frac{e^{z}-1}{z}', cut: 90 }), S('root', { n: 3, k: 2, cut: -45 }), S('powa', { alpha: '0.5+0.3i', k: -1, cut: 30 }),
      S('log', { k: 1, cut: 0 }), S('blaschke', { a: '0.5+0.2i', phi: 30 }), S('poly', { co: '0, 0, 1, 2' }), S('rational', { p: '1, 0, -1', q: '1, -1' }),
      S('pown', { n: -2 }), S('ijouk', { branch: 'interior' }), S('arcsin'), S('custom', { expr: '\\log(z-1)+\\sqrt{z+1}', cut: 270 })],
    [S('affine', { a: '0.5', b: '0.1i' }), S('sin'), S('cos'), S('tan'), S('sinh'), S('cosh'), S('tanh'), S('arctan'), S('arsinh'), S('arcosh'), S('artanh'), S('conj')],
    Array.from({ length: 12 }, (_, i) => S('custom', { expr: EXPRS[(i * 5) % EXPRS.length], cut: CUTS[i % CUTS.length] })),
  ];
  TWELVE.forEach((steps, i) => add(`twelve#${i}`, steps));

  const selected = chains.filter((c, i) => i % PARTS === PART && (!FILTER || c.name.includes(FILTER)));

  // ---------------- sample points (float32-exact) ----------------
  const ptsRaw = [];
  const NG = 20;
  for (let i = 0; i < NG; i++) for (let j = 0; j < NG; j++) ptsRaw.push([-3 + (i + 0.5 + 0.17 * Math.cos(3 * j + 2 * i)) * 6 / NG, -3 + (j + 0.5 + 0.19 * Math.sin(5 * i + j)) * 6 / NG]);
  // rays exactly along branch cuts used above (axis / diagonal rays are float32 exact)
  for (const deg of [0, 30, 45, 90, 135, 180, -45, -90, -135, -150, 270]) for (const r of [0.03, 0.3, 0.7, 1, 1.5, 2.5, 7]) {
    const a = deg * Math.PI / 180;
    let x = r * Math.cos(a), y = r * Math.sin(a);
    if (deg % 90 === 0) { x = Math.round(x * 1e9) / 1e9; y = Math.round(y * 1e9) / 1e9; }
    if (Math.abs(deg) % 90 === 45) { y = Math.sign(y) * Math.abs(x); }
    ptsRaw.push([x, y]);
  }
  // near singular points
  for (const e of [1e-3, 1e-4, 1e-5, 1e-6]) { ptsRaw.push([e, 0.3 * e], [-0.6 * e, e], [1 + e, 0.5 * e], [-1 - e, -0.5 * e], [0.5 * e, 1 + e], [0.3 * e, -1 + e], [-2 + e, 0.7 * e]); }
  ptsRaw.push([0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [-0, 0.5], [0.5, -0], [-0, -0], [30, 0.5], [-50, 3], [0.2, 100], [70, -70]);
  const Z = ptsRaw.map(([x, y]) => C(f32(x), f32(y)));
  const P = Z.length;

  // ---------------- CPU reference ----------------
  const fin = (w) => w && Number.isFinite(w.re) && Number.isFinite(w.im);
  const live = (steps, built, k) => k >= 1 && k <= steps.length && steps[k - 1] && steps[k - 1].on !== false && built[k - 1] && !built[k - 1].error;
  function rowFn(steps, built, row) {
    if (row.mode === 0) {
      const fs = [];
      for (let k = row.a + 1; k <= row.b; k++) if (live(steps, built, k)) fs.push(built[k - 1].f);
      return (z) => { for (const f of fs) z = f(z); return z; };
    }
    if (!live(steps, built, row.i)) return (z) => z;
    const b = built[row.i - 1];
    if (row.mode === 1) return b.f;
    // exactly what app.js does for the CPU morph
    const hom = b.hom || ((tt) => (z) => { const w = b.f(z); return C((1 - tt) * z.re + tt * w.re, (1 - tt) * z.im + tt * w.im); });
    return hom(f32(row.t));
  }
  const NB = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => [Math.cos(k * Math.PI / 4 + 0.13), Math.sin(k * Math.PI / 4 + 0.13)]);
  function expected(g, z) {
    let w;
    try { w = g(z); } catch (e) { return { skip: 'nonfinite' }; }
    if (!fin(w) || CX.abs(w) > 1e6) return { skip: 'nonfinite', w };
    const rho = 1e-4 * (1 + CX.abs(z));
    const thr = 1e-2 * (1 + CX.abs(w));
    let d1 = 0, d2 = 0;
    for (const [dx, dy] of NB) {
      const v = g(C(z.re + rho * dx, z.im + rho * dy));
      if (!fin(v)) return { skip: 'disc', w };
      d1 = Math.max(d1, CX.abs(CX.sub(v, w)));
      const u = g(C(z.re + rho / 16 * dx, z.im + rho / 16 * dy));
      if (!fin(u)) return { skip: 'disc', w };
      d2 = Math.max(d2, CX.abs(CX.sub(u, w)));
    }
    if (d1 > thr || (d1 > 1e-4 * (1 + CX.abs(w)) && d2 > 0.3 * d1)) return { skip: 'disc', w };
    return { w, deriv: d1 / rho };
  }

  // ---------------- WebGL ----------------
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2');
  if (!gl) { R.errors.push('no webgl2'); R.done = true; return; }
  if (!gl.getExtension('EXT_color_buffer_float')) { R.errors.push('no EXT_color_buffer_float'); R.done = true; return; }
  R.renderer = (() => { const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); })();
  R.limits = { maxFragUniformVectors: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS), maxVertUniformVectors: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS) };
  const HEAD = '#version 300 es\nprecision highp float;\n';
  const VS = '#version 300 es\nvoid main(){ vec2 p = vec2(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0); gl_Position = vec4(p, 0.0, 1.0); }';
  const MAIN = `
uniform highp sampler2D uPts;
uniform highp sampler2D uModes;
out vec4 o;
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec2 z = texelFetch(uPts, ivec2(c.x, 0), 0).xy;
  vec4 m = texelFetch(uModes, ivec2(0, c.y), 0);
  vec2 w;
  if (m.x < 0.5) w = chainRange(z, int(m.y), int(m.z));
  else if (m.x < 1.5) w = chainStep(int(m.y), z);
  else w = chainHom(int(m.y), z, m.z);
  o = vec4(w, cfin(w) ? 1.0 : 0.0, 1.0);
}`;
  function mkShader(type, s) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, s); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    return sh;
  }
  function compile(src, vsSrc = VS) {
    const p = gl.createProgram();
    gl.attachShader(p, mkShader(gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(p, mkShader(gl.FRAGMENT_SHADER, src));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
    return { p, uChain: gl.getUniformLocation(p, 'uChain'), uPts: gl.getUniformLocation(p, 'uPts'), uModes: gl.getUniformLocation(p, 'uModes') };
  }
  const mkTex = (w, h, data) => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, data);
    return t;
  };
  const progs = new Map();
  const vao = gl.createVertexArray();
  const fbo = gl.createFramebuffer();
  const modeTex = gl.createTexture();
  function runGPU(gc, rows, Zs) {
    let pr = progs.get(gc.key);
    if (!pr) { pr = compile(HEAD + GLChain.LIB + '\n' + gc.source + '\n' + MAIN); progs.set(gc.key, pr); R.programs++; }
    gl.useProgram(pr.p);
    const u = new Float32Array(4 * gc.slots);
    gc.fill(u);
    gl.uniform4fv(pr.uChain, u);
    const n = Zs.length;
    const pd = new Float32Array(4 * n);
    Zs.forEach((z, i) => { pd[4 * i] = z.re; pd[4 * i + 1] = z.im; });
    gl.activeTexture(gl.TEXTURE0);
    const ptsTex = mkTex(n, 1, pd);
    const md = new Float32Array(4 * rows.length);
    rows.forEach((r, i) => { md.set([r.mode, r.mode === 0 ? r.a : r.i, r.mode === 0 ? r.b : (r.t || 0), 0], 4 * i); });
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, modeTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 1, rows.length, 0, gl.RGBA, gl.FLOAT, md);
    gl.activeTexture(gl.TEXTURE2);
    const outTex = mkTex(n, rows.length, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, ptsTex);
    gl.uniform1i(pr.uPts, 0); gl.uniform1i(pr.uModes, 1);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, outTex, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('fbo incomplete');
    gl.viewport(0, 0, n, rows.length);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const out = new Float32Array(4 * n * rows.length);
    gl.readPixels(0, 0, n, rows.length, gl.RGBA, gl.FLOAT, out);
    gl.deleteTexture(outTex); gl.deleteTexture(ptsTex);
    return out;
  }
  const rowName = (r) => (r.mode === 0 ? `range(${r.a},${r.b})` : r.mode === 1 ? `step(${r.i})` : `hom(${r.i},t=${r.t})`);
  const build = (steps) => { const built = steps.map((s) => Funcs.build(s)); return { built, gc: GLChain.build(steps, built) }; };

  function rowsFor(n) {
    const rows = [{ mode: 0, a: 0, b: n }, { mode: 0, a: 2, b: 1 }, { mode: 0, a: 0, b: n + 3 }, { mode: 0, a: -1, b: n }];
    if (n > 1) rows.push({ mode: 0, a: 1, b: n }, { mode: 0, a: 0, b: n - 1 });
    for (let i = 0; i <= n + 1; i++) rows.push({ mode: 1, i });
    for (let i = 1; i <= n; i++) for (const t of TS) rows.push({ mode: 2, i, t });
    rows.push({ mode: 2, i: 0, t: 0.5 }, { mode: 2, i: n + 1, t: 0.5 });
    return rows;
  }
  function testChain(ch) {
    const { built, gc } = build(ch.steps);
    const n = ch.steps.length;
    const rows = rowsFor(n);
    const out = runGPU(gc, rows, Z);
    rows.forEach((row, ri) => {
      const g = rowFn(ch.steps, built, row);
      for (let p = 0; p < P; p++) {
        R.total++;
        const e = expected(g, Z[p]);
        if (e.skip) { if (e.skip === 'disc') R.skippedDisc++; else R.skippedNonFinite++; continue; }
        R.compared++;
        const k = (ri * P + p) * 4;
        const gw = C(out[k], out[k + 1]);
        const err = Math.hypot(gw.re - e.w.re, gw.im - e.w.im);
        if (!(err <= TOL * (1 + CX.abs(e.w)))) {
          R.failCount++;
          R.failByChain[ch.name] = (R.failByChain[ch.name] || 0) + 1;
          if (R.failByChain[ch.name] <= 6 && R.failures.length < 3000) {
            // largest / smallest |intermediate| on the CPU (stage outputs, or f(z) inside a linear homotopy)
            let mx = 0, mn = Infinity, zz = Z[p];
            const ks = row.mode === 0 ? Array.from({ length: Math.max(0, Math.min(n, row.b) - Math.max(0, row.a)) }, (_, j) => Math.max(0, row.a) + j + 1) : [row.i];
            for (const k of ks) if (live(ch.steps, built, k)) { zz = built[k - 1].f(zz); const m = fin(zz) ? CX.abs(zz) : Infinity; mx = Math.max(mx, m); if (m > 0) mn = Math.min(mn, m); }
            R.failures.push({ chain: ch.name, steps: ch.steps.map((s) => (s.on ? '' : '~') + s.type + JSON.stringify(s.params)), row: rowName(row), point: [Z[p].re, Z[p].im], cpu: [e.w.re, e.w.im], gpu: [gw.re, gw.im], err, rel: err / (1 + CX.abs(e.w)), deriv: e.deriv, maxInter: mx, minInter: mn });
          }
        }
      }
    });
  }

  // ---------------- direct probes (no discontinuity filter): specific semantic questions ----------------
  function probe(name, steps, row, pts) {
    try {
      const { built, gc } = build(steps);
      const Zs = pts.map(([x, y]) => C(f32(x), f32(y)));
      const out = runGPU(gc, [row], Zs);
      const g = rowFn(steps, built, row);
      Zs.forEach((z, p) => {
        const w = g(z);
        const gw = [out[4 * p], out[4 * p + 1]];
        const err = fin(w) ? Math.hypot(gw[0] - w.re, gw[1] - w.im) : NaN;
        R.direct.push({ name, row: rowName(row), z: [z.re, z.im], cpu: [w.re, w.im], gpu: gw, gpuFinite: out[4 * p + 2] > 0.5, err, rel: err / (1 + CX.abs(w)), ok: fin(w) ? err <= TOL * (1 + CX.abs(w)) : null });
      });
    } catch (e) { R.errors.push(`probe ${name}: ${e.message}`); }
  }
  if (ONLY.includes('direct') || ONLY.includes('main')) {
    probe('SANITY identity', [S('exp', {}, false)], { mode: 0, a: 0, b: 1 }, [[0.5, 0.25], [-3, 2]]);
    probe('SANITY add 1', [S('add', { c: '1' })], { mode: 0, a: 0, b: 1 }, [[0.5, 0.25], [-3, 2]]);
    R.sanity = R.direct.filter((d) => d.name.startsWith('SANITY')).every((d) => d.ok);
    if (!R.sanity) R.errors.push('SANITY FAILED: harness GPU path broken');
  }
  if (ONLY.includes('direct')) {
    probe('pown n=16777217', [S('pown', { n: 16777217 })], { mode: 1, i: 1 }, [[-1, 0], [0, 1], [1, 0]]);
    probe('pown n=-16777217', [S('pown', { n: -16777217 })], { mode: 1, i: 1 }, [[-1, 0], [0, 1]]);
    probe('pown n=33554435', [S('pown', { n: 33554435 })], { mode: 1, i: 1 }, [[0, 1], [-1, 0]]);
    probe('pown n=100003', [S('pown', { n: 100003 })], { mode: 1, i: 1 }, [[0, 1], [-1, 0]]);
    probe('blaschke |a|=1 a=0.6+0.8i', [S('blaschke', { a: '0.6+0.8i', phi: 0 })], { mode: 1, i: 1 }, [[0.6, 0.8], [0.6 + 1e-6, 0.8], [0.6 + 1e-5, 0.8], [0.6 + 1e-4, 0.8], [0, 0], [0.5, 0.5]]);
    probe('mobius degenerate 0.1,0.2,0.3,0.6', [mob('0.1', '0.2', '0.3', '0.6')], { mode: 1, i: 1 }, [[-2 + 1e-6, 0], [-2 + 1e-5, 0], [-2 + 1e-4, 0], [-2, 1e-5], [0, 0]]);
    probe('mul c=100000 hom', [S('mul', { c: '100000' })], { mode: 2, i: 1, t: 0.999 }, [[1, 0], [0.5, 0.5], [-2, 1], [3, 0]]);
    probe('mul c=100000 hom t=0.9', [S('mul', { c: '100000' })], { mode: 2, i: 1, t: 0.9 }, [[1, 0], [0.5, 0.5], [-2, 1]]);
    probe('mul c=100000000 hom t=0.73', [S('mul', { c: '100000000' })], { mode: 2, i: 1, t: 0.73 }, [[1, 0], [0.5, 0.5], [0.1, -0.2]]);
    probe('mul c=30000 hom t=0.999', [S('mul', { c: '30000' })], { mode: 2, i: 1, t: 0.999 }, [[1, 0], [0.5, 0.5]]);
    probe('affine a=100000 b=1 hom t=0.99', [S('affine', { a: '100000', b: '1' })], { mode: 2, i: 1, t: 0.99 }, [[1, 0], [0.5, 0.5]]);
    probe('mobius 1000,0,0,0.001 hom t=0.73', [mob('1000', '0', '0', '0.001')], { mode: 2, i: 1, t: 0.73 }, [[1, 0], [0.5, 0.5], [2, 1]]);
    probe('(e^z-1)/z near 0', [S('custom', { expr: '\\frac{e^{z}-1}{z}' })], { mode: 1, i: 1 }, [[1e-3, 0], [1e-4, 0], [1e-5, 0], [1e-6, 0], [1e-7, 0]]);
    probe('(z^2-1)/(z-1) near 1', [S('rational', { p: '1, 0, -1', q: '1, -1' })], { mode: 1, i: 1 }, [[1 + 1e-3, 0], [1 + 1e-5, 0], [1 + 1e-6, 0], [1, 1e-6]]);
    probe('arg at signed zeros', [S('custom', { expr: '\\arg(z)' })], { mode: 1, i: 1 }, [[-0, 0], [0, 0], [-1, -0], [-0, 1], [-0, -1]]);
    probe('log k=1 hom t=0 identity', [S('log', { k: 1, cut: 90 })], { mode: 2, i: 1, t: 0 }, [[0.5, 0.5], [-2, 0.1]]);
    probe('exp hom t=0.0000001', [S('exp')], { mode: 2, i: 1, t: 1e-7 }, [[0.5, 0.5], [3, 2]]);
    probe('mobius 100000000000000000000 identity', [mob('100000000000000000000', '0', '0', '100000000000000000000')], { mode: 1, i: 1 }, [[0.5, 0.5], [2, -1]]);
    probe('mobius 0.00000001 identity (degenerate)', [mob('0.00000001', '0', '0', '0.00000001')], { mode: 1, i: 1 }, [[0.5, 0.5], [2, -1]]);
    probe('mobius 0.00000001 identity hom', [mob('0.00000001', '0', '0', '0.00000001')], { mode: 2, i: 1, t: 0.5 }, [[0.5, 0.5], [2, -1]]);
    probe('mobius 999999999999999939709166371603178586112,0,0,999999999999999939709166371603178586112 identity', [mob('999999999999999939709166371603178586112', '0', '0', '999999999999999939709166371603178586112')], { mode: 1, i: 1 }, [[0.5, 0.5]]);
    probe('poly 10000000000000000303786028427003666890752 coeffs', [S('poly', { co: '10000000000000000303786028427003666890752, 0' })], { mode: 1, i: 1 }, [[1e-35, 0]]);
    probe('custom z*10^40/10^40', [S('custom', { expr: 'z\\cdot 10^{40}/10^{40}' })], { mode: 1, i: 1 }, [[0.5, 0.5]]);
    probe('custom z^{5000}', [S('custom', { expr: 'z^{5000}' })], { mode: 1, i: 1 }, [[1.001, 0.001], [0.999, 0.01], [-1.0005, 0.0003]]);
    probe('root huge cut 3600.5', [S('root', { n: 2, cut: 3600.5, k: 0 })], { mode: 1, i: 1 }, [[0.5, 0.5], [-1, -0.3]]);
    probe('root huge cut 1000000', [S('root', { n: 2, cut: 1e6 + 0.3, k: 0 })], { mode: 1, i: 1 }, [[0.5, 0.5], [-1, -0.3], [0.2, -1.1]]);
    probe('log huge sheet k=1000000', [S('log', { cut: 180, k: 1000000 })], { mode: 1, i: 1 }, [[0.5, 0.5]]);
    probe('powa huge sheet k=1000', [S('powa', { alpha: '0.5', cut: 180, k: 1000 })], { mode: 1, i: 1 }, [[0.5, 0.5], [-1, 0.3]]);
    probe('powa sheet k=50 alpha 0.5', [S('powa', { alpha: '0.5', cut: 180, k: 50 })], { mode: 1, i: 1 }, [[0.5, 0.5], [-1, 0.3]]);
    probe('powa sheet k=-3 alpha 0.5+0.3i', [S('powa', { alpha: '0.5+0.3i', cut: 180, k: -3 })], { mode: 1, i: 1 }, [[0.5, 0.5], [-1, 0.3]]);
    for (let k = 1; k <= 12; k++) probe(`TRACE twelve#1 range(0,${k})`, TWELVE[1], { mode: 0, a: 0, b: k }, [[0.2, 100], [70, -70]]);
    for (let k = 1; k <= 12; k++) probe(`TRACE twelve#1 step(${k}) on CPU stage input`, TWELVE[1], { mode: 1, i: k }, [[0.2, 100]]);
    probe('ctan of (NaN-ish huge, big im)', [S('tan')], { mode: 1, i: 1 }, [[3e20, 3e21], [1e30, 25], [1e30, -25]]);
    probe('ccos huge', [S('cos')], { mode: 1, i: 1 }, [[3e20, 30], [3e20, 0.5], [1e10, 0.5], [1e5, 0.5]]);
    probe('csin huge', [S('sin')], { mode: 1, i: 1 }, [[3e20, 0.5], [1e10, 0.5], [1e5, 0.5]]);
    probe('TRIG threshold exp(iy)', [S('custom', { expr: 'e^{iz}' })], { mode: 1, i: 1 }, [1e5, 2e5, 3e5, 5e5, 8e5, 1e6, 2e6, 4e6, 8e6, 1.6e7, 1e8, 1e9].map((x) => [x, 0]));
    probe('pown n=4096 hom t=0.999', [S('pown', { n: 4096 })], { mode: 2, i: 1, t: 0.999 }, [[0.999, 0.01], [1.0002, 0]]);
  }

  // ---------------- key contract ----------------
  const keyOf = (steps) => build(steps).gc.key;
  function keyCheck(name, s1, s2, same) {
    let k1, k2;
    try { k1 = keyOf(s1); k2 = keyOf(s2); } catch (e) { R.keyFails.push({ name, error: e.message }); return; }
    const ok = (k1 === k2) === same;
    R.keyChecks.push({ name, ok });
    if (!ok) R.keyFails.push({ name, expectSame: same, k1, k2 });
  }
  if (ONLY.includes('keys')) {
    keyCheck('mul c 2 vs 100000000', [S('mul', { c: '2' })], [S('mul', { c: '100000000' })], true);
    keyCheck('mul c 0 vs 2', [S('mul', { c: '0' })], [S('mul', { c: '2' })], true);
    keyCheck('add c', [S('add', { c: '0' })], [S('add', { c: '5-i' })], true);
    keyCheck('affine a=0 vs 2', [S('affine', { a: '0', b: '1' })], [S('affine', { a: '2', b: 'i' })], true);
    keyCheck('root n/cut/k', [S('root', { n: 2, cut: 0, k: 0 })], [S('root', { n: 9, cut: -45, k: -3 })], true);
    keyCheck('powa alpha real->complex', [S('powa', { alpha: '1.5', cut: 180, k: 0 })], [S('powa', { alpha: '0.5+0.3i', cut: 270, k: 3 })], true);
    keyCheck('log cut/k', [S('log', { cut: 180, k: 0 })], [S('log', { cut: -45, k: -3 })], true);
    keyCheck('pown 2 vs -7 vs 0', [S('pown', { n: 2 })], [S('pown', { n: -7 })], true);
    keyCheck('pown 0 vs 13', [S('pown', { n: 0 })], [S('pown', { n: 13 })], true);
    keyCheck('custom cut (theta-dependent exponent kind)', [S('custom', { expr: 'z^{\\sqrt{-4}}+(-2)^z+\\sqrt[\\sqrt{-1}]{z}', cut: 180 })], [S('custom', { expr: 'z^{\\sqrt{-4}}+(-2)^z+\\sqrt[\\sqrt{-1}]{z}', cut: 0 })], true);
    keyCheck('custom cut z^{\\sqrt{4}} 180 vs -45', [S('custom', { expr: 'z^{\\sqrt{4}}', cut: 180 })], [S('custom', { expr: 'z^{\\sqrt{4}}', cut: -45 })], true);
    keyCheck('poly values same len', [S('poly', { co: '1, 2, 3' })], [S('poly', { co: '-4, 5i, 0' })], true);
    keyCheck('poly leading zeros same trimmed len', [S('poly', { co: '0, 0, 1, 2' })], [S('poly', { co: '3, 4' })], true);
    keyCheck('poly degree change', [S('poly', { co: '0, 0, 1, 2' })], [S('poly', { co: '5, 0, 1, 2' })], false);
    keyCheck('rational values', [S('rational', { p: '1, 2', q: '1, 0' })], [S('rational', { p: '3i, -2', q: '7, 1' })], true);
    keyCheck('rational q degree', [S('rational', { p: '1, 2', q: '1, 0' })], [S('rational', { p: '1, 2', q: '1, 0, 0' })], false);
    keyCheck('mobius degenerate vs not', [mob('1', '2', '2', '4')], [mob('1', '2', '3', '4')], true);
    keyCheck('mobius parabolic vs loxodromic', [mob('1', '1', '0', '1')], [mob('100000', '0', '0', '1')], true);
    keyCheck('blaschke |a|=1 vs 0.5', [S('blaschke', { a: '1', phi: 0 })], [S('blaschke', { a: '0.5', phi: 90 })], true);
    keyCheck('ijouk branch', [S('ijouk', { branch: 'exterior' })], [S('ijouk', { branch: 'interior' })], true);
    keyCheck('5-step numeric change in step 3', [S('exp'), S('log'), S('root', { n: 3 }), S('mul'), S('custom')], [S('exp'), S('log'), S('root', { n: 7, k: 4, cut: 33 }), S('mul'), S('custom', { cut: -10 })], true);
    keyCheck('type change', [S('sin')], [S('cos')], false);
    keyCheck('trig type change in chain', [S('exp'), S('sinh')], [S('exp'), S('cosh')], false);
    keyCheck('on/off', [S('exp'), S('sin')], [S('exp'), S('sin', {}, false)], false);
    keyCheck('error state', [S('mul', { c: '2' })], [S('mul', { c: 'abc' })], false);
    keyCheck('err vs off', [S('mul', { c: 'abc' })], [S('mul', { c: '2' }, false)], false);
    keyCheck('custom expr', [S('custom', { expr: 'z^2' })], [S('custom', { expr: 'z^3' })], false);
    keyCheck('custom expr structurally different', [S('custom', { expr: 'z^2' })], [S('custom', { expr: 'z^z' })], false);
    keyCheck('step order', [S('exp'), S('sin')], [S('sin'), S('exp')], false);
    keyCheck('chain length', [S('exp')], [S('exp'), S('exp')], false);
    keyCheck('rational error (q=0) vs ok', [S('rational', { q: '0, 0' })], [S('rational', { q: '1, 0' })], false);
    // determinism: identical key must imply identical source (random numeric perturbations of every chain)
    function perturb(st) {
      const d = Funcs.DEFS[st.type];
      const p = Object.assign({}, st.params);
      if (!d) return { type: st.type, params: p, on: st.on };
      for (const q of d.params) {
        switch (q.type) {
          case 'cx': p[q.key] = pick(['0', '1', rcx(3), '100000', '-0.000000001']); break;
          case 'int': p[q.key] = ri(-9, 9); break;
          case 'angle': p[q.key] = pick([0, 90, -45, 180, rf(-400, 400)]); break;
          case 'coeffs': { const cnt = String(p[q.key]).split(',').length; p[q.key] = Array.from({ length: cnt }, (_, i) => (i === 0 && rnd() < 0.3 ? '0' : rcx())).join(', '); break; }
          case 'choice': p[q.key] = pick(q.choices.map((c) => c[0])); break;
          default: break;
        }
      }
      return { type: st.type, params: p, on: st.on };
    }
    const seen = new Map();
    for (const ch of chains) {
      for (let r = 0; r < 4; r++) {
        const steps = r === 0 ? ch.steps : ch.steps.map(perturb);
        let gc;
        try { gc = build(steps).gc; } catch (e) { R.errors.push(`build threw for ${ch.name}: ${e.message}`); continue; }
        R.determinism.checked++;
        if (seen.has(gc.key)) {
          R.determinism.sameKey++;
          const prev = seen.get(gc.key);
          if (prev.source !== gc.source || prev.slots !== gc.slots) R.determinism.bad.push({ chain: ch.name, key: gc.key.slice(0, 200) });
        } else seen.set(gc.key, { source: gc.source, slots: gc.slots });
        // fill(): writes exactly 4*slots entries, all finite numbers for finite params (garbage must be overwritten)
        const out = new Float32Array(4 * gc.slots + 8).fill(NaN);
        gc.fill(out);
        let bad = 0;
        for (let i = 0; i < 4 * gc.slots; i++) if (Number.isNaN(out[i])) bad++;
        if (bad && R.fillChecks.length < 20) R.fillChecks.push({ chain: ch.name, perturbed: r > 0, nanSlots: bad, slots: gc.slots, steps: steps.map((s) => ({ type: s.type, params: s.params, on: s.on })) });
      }
    }
  }

  // ---------------- compile: 12-step chains, vertex stage, renderer-like header, uniform limits ----------------
  function compileCheck(name, gc, header, vsMain) {
    const tc = performance.now();
    let res = 'ok';
    try {
      const vs = mkShader(gl.VERTEX_SHADER, header + GLChain.LIB + '\n' + gc.source + '\n' + (vsMain || 'in vec2 aP; uniform float uT;\nvoid main(){ vec2 w = chainHom(3, chainRange(aP, 0, 2), uT) + chainStep(5, aP); gl_Position = vec4(w, cfin(w) ? 0.0 : 1.0, 1.0); }'));
      const fs = mkShader(gl.FRAGMENT_SHADER, header + GLChain.LIB + '\n' + gc.source + '\n' + MAIN);
      const p = gl.createProgram(); gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) res = 'link: ' + gl.getProgramInfoLog(p);
    } catch (e) { res = String(e.message).slice(0, 500); }
    R.compile12.push({ name, slots: gc.slots, srcLen: gc.source.length, res, ms: Math.round(performance.now() - tc) });
  }
  if (ONLY.includes('compile')) {
    const RENDER_HEAD = '#version 300 es\nprecision highp float;\nprecision highp int;\n#define PI 3.141592653589793\n#define TAU 6.283185307179586\n';
    TWELVE.forEach((steps, i) => {
      const gc = build(steps).gc;
      compileCheck(`twelve#${i} contract header`, gc, HEAD);
      compileCheck(`twelve#${i} renderer header`, gc, RENDER_HEAD);
    });
    // heavy: 12 custom steps with the largest formulas
    const heavy = Array.from({ length: 12 }, (_, i) => S('custom', { expr: '\\arcsin(z)\\cos(2z)+\\log(z-1)+\\sqrt{z+1}+z^{\\sqrt{-4}}+(1+i)^z+\\sqrt[3]{z^2-1}+\\cot z+\\coth z+|z|^2', cut: CUTS[i % CUTS.length] }));
    compileCheck('twelve heavy customs', build(heavy).gc, HEAD);
    const maxU = R.limits.maxFragUniformVectors;
    for (const nco of [200, 2 * maxU - 40, 2 * maxU + 10]) {
      const co = Array.from({ length: nco }, (_, i) => (i === 0 ? '1' : '0.001')).join(', ');
      const steps = [S('poly', { co })];
      const b = steps.map((s) => Funcs.build(s));
      compileCheck(`poly with ${nco} coefficients (CPU build error: ${b[0].error || 'none'})`, GLChain.build(steps, b), HEAD, 'void main(){ gl_Position = vec4(chainStep(1, vec2(0.0)), 0.0, 1.0); }');
    }
  }

  if (ONLY.includes('main')) {
    for (const ch of selected) {
      try { testChain(ch); R.chains++; } catch (e) { R.errors.push(`${ch.name}: ${String(e.message || e).slice(0, 1500)}`); }
    }
  }
  R.ms = Math.round(performance.now() - t0);
  R.points = P;
  R.chainsTotal = chains.length;
  R.selected = selected.length;
  R.done = true;
  const el = document.getElementById('out');
  if (el) el.textContent = JSON.stringify({ done: R.done, chains: R.chains, programs: R.programs, total: R.total, compared: R.compared, failCount: R.failCount, errors: R.errors, ms: R.ms, failByChain: R.failByChain }, null, 1);
})();
