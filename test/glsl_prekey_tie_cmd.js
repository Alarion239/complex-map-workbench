// The mesh path's sheet key on the GPU (preKeyDepth, GLR._src.PRE_KEY_DECL, compiled alone in a small shader) orders two
// sheets by the tie rule (larger Im z in front) when their keys are equal to float noise, wherever the pair falls
// against the key's rounding step, and by their keys when they are further apart. A map symmetric about the window's
// centre (z^2) gives each sheet's mirror image the same key; a sweep of 0..0.3 of a key step in one sheet's key
// puts pairs on either side of a rounding edge. The depths come back through a RGBA32F target as written
// (a smaller depth is in front).
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, results}.
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await go(`http://localhost:${PORT}/test.html?view=steps&ns=prekey${Date.now()}`);
await settled({ max: 60000, until: `!!window.GLR && !!GLR._src && !!GLR._src.PRE_KEY_DECL` });
R.out = await ev(`(() => {
  const f32 = Math.fround, ANG = [35, 80, 110, 200, 290];
  // pairs (a, b) of source points: b is a's mirror image through the window's centre with its distance scaled so that its
  // key is a's plus j / 20 of a key step, j = 0..6 (noise well under a step), and a sits 0.03 of a step below a rounding
  // edge (k + 1/2), so the pairs with j >= 2 straddle it; the float32 keys of the GPU's log are within 0.01 of a step
  const rOf = (s) => 2 ** (Math.exp(s / 16384) - 1) - 1;
  const pairs = [];
  for (const k of [20000, 31000, 47000, 60000]) for (const deg of ANG) for (let j = 0; j <= 6; j++) {
    const sa = k + 0.5 - 0.03, sb = sa + j / 20, ra = rOf(sa), rb = rOf(sb);
    const a = [f32(ra * Math.cos(deg * Math.PI / 180)), f32(ra * Math.sin(deg * Math.PI / 180))];
    pairs.push({ kind: 'equal', a, b: [f32(-a[0] * rb / ra), f32(-a[1] * rb / ra)] });
  }
  // far pairs: b's key 4 steps (of KEY_STEPS = 2^14 per unit of ln(1 + D)) above a's, in either position, so the smaller key is in front
  for (const r0 of [0.3, 1.1, 2.7, 5.5]) for (const deg of ANG) for (const sgn of [1, -1]) {
    const a = [f32(r0 * Math.cos(deg * Math.PI / 180)), f32(r0 * Math.sin(deg * Math.PI / 180))];
    const Da = Math.log2(1 + r0), Db = Math.exp(Math.log(1 + Da) + 4 / 16384) - 1, rb = 2 ** Db - 1;
    pairs.push({ kind: 'far', a, b: [f32(-a[0] * rb / r0), f32(-a[1] * rb / r0)], aFront: sgn > 0 });
    if (sgn < 0) { const p = pairs[pairs.length - 1]; pairs[pairs.length - 1] = { kind: 'far', a: p.b, b: p.a, aFront: false }; }
  }
  const H = pairs.length;
  const data = new Float32Array(H * 4);
  pairs.forEach((p, y) => data.set([p.a[0], p.a[1], p.b[0], p.b[1]], 4 * y));
  const cv = document.createElement('canvas'); cv.width = 1; cv.height = 1;
  const gl = cv.getContext('webgl2', { antialias: false });
  if (!gl || !gl.getExtension('EXT_color_buffer_float')) return { error: 'no float targets' };
  const vs = '#version 300 es\\nvoid main() { vec2 p = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1)) * 4.0 - 1.0; gl_Position = vec4(p, 0.0, 1.0); }';
  const fs = '#version 300 es\\nprecision highp float; precision highp int; precision highp sampler2D;\\n' + GLR._src.PRE_KEY_DECL
    + 'uniform sampler2D uT; out vec4 o;\\nvoid main() { vec4 t = texelFetch(uT, ivec2(0, int(gl_FragCoord.y)), 0);\\n'
    + '  o = vec4(preKeyDepth(t.xy), preKeyDepth(t.zw), 0.0, 0.0); }';
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const prog = gl.createProgram();
  try {
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (e) { return { error: String(e).slice(0, 600) }; }
  gl.useProgram(prog);
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 1, H, 0, gl.RGBA, gl.FLOAT, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  const out = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, out);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 1, H, 0, gl.RGBA, gl.FLOAT, null);
  const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, out, 0);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.uniform1i(gl.getUniformLocation(prog, 'uT'), 0);
  gl.uniform1i(gl.getUniformLocation(prog, 'uKeyOn'), 1);
  gl.uniform4f(gl.getUniformLocation(prog, 'uKWin'), -1, -1, 1, 1);
  gl.uniform1f(gl.getUniformLocation(prog, 'uKR'), 1);
  gl.uniform1f(gl.getUniformLocation(prog, 'uKRs'), 1);
  gl.uniform1i(gl.getUniformLocation(prog, 'uKSingN'), 0);
  gl.viewport(0, 0, 1, H); gl.disable(gl.BLEND); gl.drawArrays(gl.TRIANGLES, 0, 3);
  const px = new Float32Array(H * 4); gl.readPixels(0, 0, 1, H, gl.RGBA, gl.FLOAT, px);
  let bad = 0, first = null;
  pairs.forEach((p, y) => {
    const da = px[4 * y], db = px[4 * y + 1];
    // (the sheet with the larger Im z is in front: a's Im is the one of the angle's sign, b mirrors it)
    const aFront = p.kind === 'far' ? p.aFront : p.a[1] > p.b[1];
    const good = aFront ? da < db : db < da;
    if (!good) { bad++; if (!first) first = { kind: p.kind, a: p.a, b: p.b, da, db }; }
  });
  return { H, bad, first, nEqual: pairs.filter((p) => p.kind === 'equal').length };
})()`);
ok('the key shader compiles and runs', R.out && !R.out.error, R.out);
ok(`all ${R.out && R.out.H} pairs are ordered: mirrored ones (keys within 0.3 of a step, across a rounding edge) by the tie rule, far ones by their keys`, R.out && R.out.bad === 0, R.out && R.out.first);
return { pass: fails.length === 0, fails, results: { H: R.out && R.out.H, bad: R.out && R.out.bad } };
