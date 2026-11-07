// The inverse pass's buffer order on the GPU is the CPU's: ixTieOrder (GLR._src.IX_TIE_ORDER, compiled alone in a small
// shader) puts a buffer of up to 8 entries front to back, and Inverse.order does the same for the same keys and tie
// points. One buffer a row, read back as the entries' places: pairs of equal keys on either side of a step of TIE_D
// (the pair a rounded key orders by noise; a step is the band's width, 2^-14 of 1 + D), a chain of three keys spaced 0.7 TIE_D, and random sets whose keys cluster
// at multiples of 0.3 TIE_D. Keys and tie points are float32 values, so both sides order the same numbers.
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, results}.
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await go(`http://localhost:${PORT}/test.html?view=steps&ns=tieorder${Date.now()}`);
await settled({ max: 60000, until: `typeof Inverse === 'object' && !!window.GLR && !!GLR._src && !!GLR._src.IX_TIE_ORDER` });
R.out = await ev(`(() => {
  const N = 8, TIE = Inverse.TIE_D, f32 = Math.fround;
  const trials = [];   // each: a buffer, entries {D, z: [re, im]}
  for (const k of [0, 1, 17, 1000]) for (const s of [1, -1]) {
    const edge = Math.exp((k + 0.5) * TIE) - 1;
    trials.push([{ D: edge - 1e-6, z: [0.5, s] }, { D: edge + 1e-6, z: [0.5, -s] }]);
  }
  trials.push([{ D: 0, z: [0, 0] }, { D: 0.7 * TIE, z: [0, 1] }, { D: 1.4 * TIE, z: [0, 2] }]);   // (the band at D = 0 is TIE)
  trials.push([{ D: 1, z: [1, 1] }, { D: 1, z: [2, 1] }]);
  let seed = 4242;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  while (trials.length < 600) {
    const n = 1 + Math.floor(rnd() * N), base = rnd() * 4, t = [];
    for (let i = 0; i < n; i++) t.push({ D: base + Math.floor(rnd() * 8) * 0.3 * Inverse.tieBand(base), z: [Math.floor(rnd() * 3), Math.floor(rnd() * 3) + (rnd() < 0.5 ? 0 : rnd())] });
    // (the walk's buffer stands in key steps, entries of one step in the tie rule's order: any listing is a buffer)
    for (let i = t.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [t[i], t[j]] = [t[j], t[i]]; }
    trials.push(t);
  }
  const H = trials.length, tex = new Float32Array(H * N * 4);
  for (let i = 0; i < H * N; i++) tex[4 * i] = -1;   // (an unused slot: D = -1)
  trials.forEach((t, y) => t.forEach((e, i) => { e.D = f32(e.D); e.z = [f32(e.z[0]), f32(e.z[1])]; e.i = i; tex.set([e.D, e.z[0], e.z[1], i], 4 * (y * N + i)); }));
  const cv = document.createElement('canvas'); cv.width = 2; cv.height = H;
  const gl = cv.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
  if (!gl) return { error: 'no webgl2' };
  const vs = '#version 300 es\\nvoid main() { vec2 p = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1)) * 4.0 - 1.0; gl_Position = vec4(p, 0.0, 1.0); }';
  // (the entry's colour slot holds its index in the buffer; the pixel x = 0 holds the places 0..3, x = 1 the places 4..7, as index + 1)
  const fs = '#version 300 es\\nprecision highp float; precision highp int; precision highp sampler2D;\\nuniform sampler2D uT; out vec4 o;\\n'
    + 'const int IX_B = ' + N + '; const float IX_TIE_D = 0.00006103515625;\\nfloat ixTieBand(float D) { return IX_TIE_D * (1.0 + D); }\\nint nb; float bD[IX_B]; vec2 bZ[IX_B]; float bC[IX_B]; highp uint bCol[IX_B];\\n'
    + GLR._src.IX_TIE_ORDER
    + 'void main() {\\n  int y = int(gl_FragCoord.y), x = int(gl_FragCoord.x);\\n  nb = 0;\\n'
    + '  for (int i = 0; i < IX_B; i++) { vec4 t = texelFetch(uT, ivec2(i, y), 0); bD[i] = t.x; bZ[i] = t.yz; bC[i] = 1.0; bCol[i] = uint(t.w); if (t.x >= 0.0) nb = i + 1; }\\n'
    + '  ixTieOrder();\\n  vec4 r = vec4(0.0);\\n'
    + '  for (int i = 0; i < IX_B; i++) { if (i >= nb) break; float v = float(bCol[i] + 1u) / 255.0; if (x == 0) { if (i == 0) r.x = v; if (i == 1) r.y = v; if (i == 2) r.z = v; if (i == 3) r.w = v; } else { if (i == 4) r.x = v; if (i == 5) r.y = v; if (i == 6) r.z = v; if (i == 7) r.w = v; } }\\n'
    + '  o = r;\\n}\\n';
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const prog = gl.createProgram();
  try {
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (e) { return { error: String(e).slice(0, 600) }; }
  gl.useProgram(prog);
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, N, H, 0, gl.RGBA, gl.FLOAT, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.uniform1i(gl.getUniformLocation(prog, 'uT'), 0);
  gl.viewport(0, 0, 2, H); gl.disable(gl.BLEND); gl.drawArrays(gl.TRIANGLES, 0, 3);
  const px = new Uint8Array(2 * H * 4); gl.readPixels(0, 0, 2, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let bad = 0, first = null;
  trials.forEach((tr, y) => {
    const cpu = Inverse.order(tr.map((e) => ({ D: e.D, z: CX.C(e.z[0], e.z[1]), i: e.i }))).map((e) => e.i);
    const gpu = [];
    for (let k = 0; k < tr.length; k++) gpu.push(px[4 * (y * 2 + (k < 4 ? 0 : 1)) + (k % 4)] - 1);
    // (entries equal in key and tie point are one entry to the order: compared by value)
    const val = (list) => list.map((i) => tr[i].D + '|' + tr[i].z.join(',')).join(' ');
    if (val(cpu) !== val(gpu)) { bad++; if (!first) first = { y, tr: tr.map((e) => [e.D, e.z[0], e.z[1]]), cpu, gpu }; }
  });
  return { H, bad, first };
})()`);
ok('the tie-order shader compiles and runs', R.out && !R.out.error, R.out);
ok(`all ${R.out && R.out.H} buffers are ordered as Inverse.order orders them`, R.out && R.out.bad === 0, R.out && R.out.first);
return { pass: fails.length === 0, fails, results: { H: R.out && R.out.H, bad: R.out && R.out.bad } };
