// The block clip shared by the sheets' mesh and the layered glide's carry (GLR.landClipGlsl: blockClip), run through the real GLSL
// in a context of its own: a triangle (corners: x, y, height) is cut at |h| = BLOCK_K H and the polygon read back, against what the
// geometry says it must be:
// - a pole's edge: heights h = 1 / x on edges that run from a corner far beyond the block to one inside it. The crossing of h = H_B is at x = 1 / H_B
//   exactly, and the clip interpolates 1 / h along the edge, which is linear in x, so it finds that x; a linear crossing hugs the inside corner;
// - an edge one corner of which is beyond but not far: the linear crossing;
// - an edge across zero (h from -3 to 3): the linear crossing on each side (the 1 / h rule is for corners on the block's own side);
// - the clipped edges' flags (+1 on the top, -1 on the bottom), the others 0.
// Controls: with uClipLinear 1 (every crossing linear) the pole's crossing is far from x = 1 / H_B; a triangle inside the block comes back unchanged.
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const BLOCK = 1.25, HB = BLOCK * 1;   // (H = 1)
const FLOAT_TOL = 2e-4;   // (float32 positions at heights up to 200: the interpolation in 1 / h loses about 1e-5 of a unit)
const LINEAR_MISS = 0.2;  // (the linear crossing of the pole's edge is at least this far from the true one)
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await go(`http://localhost:${PORT}/test.html?ns=landclip${Date.now()}`);
await settled({ max: 60000, until: '!!window.GLR && !!GLR.landClipGlsl' });
const run = (tri, linear) => ev(`(() => {
  const gl = document.createElement('canvas').getContext('webgl2');
  const src = '#version 300 es\\nprecision highp float; precision highp int;\\n' + GLR.landClipGlsl + \`
uniform vec3 uQ[3]; uniform float uHb; out vec4 o;
void main() {
  vec3 Q[5]; vec4 A[5]; vec3 Nn[5]; float Fl[5];
  for (int i = 0; i < 5; i++) { Q[i] = vec3(0.0); A[i] = vec4(0.0); Nn[i] = vec3(0.0, 0.0, 1.0); Fl[i] = 0.0; }
  Q[0] = uQ[0]; Q[1] = uQ[1]; Q[2] = uQ[2];
  int n = blockClip(uHb, 3, Q, A, Nn, Fl);
  o = vec4(Q[gl_VertexID].xy, Q[gl_VertexID].z, float(n) * 10.0 + Fl[gl_VertexID] + 1.0);
  gl_PointSize = 1.0;
}\`;
  const mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
  const p = gl.createProgram();
  gl.attachShader(p, mk(gl.VERTEX_SHADER, src)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, '#version 300 es\\nprecision highp float; out vec4 c; void main() { c = vec4(0.0); }'));
  gl.transformFeedbackVaryings(p, ['o'], gl.INTERLEAVED_ATTRIBS); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  gl.useProgram(p);
  gl.uniform3fv(gl.getUniformLocation(p, 'uQ'), new Float32Array(${JSON.stringify(tri.flat())}));
  gl.uniform1f(gl.getUniformLocation(p, 'uHb'), ${HB});
  gl.uniform1i(gl.getUniformLocation(p, 'uClipLinear'), ${linear ? 1 : 0});
  const buf = gl.createBuffer(); gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, buf); gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER, 5 * 16, gl.DYNAMIC_READ);
  gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, buf);
  gl.enable(gl.RASTERIZER_DISCARD); gl.beginTransformFeedback(gl.POINTS); gl.drawArrays(gl.POINTS, 0, 5); gl.endTransformFeedback();
  const out = new Float32Array(20); gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER, 0, out);
  const n = Math.round(out[3] / 10);
  return { n, v: [...Array(n).keys()].map((i) => ({ x: out[4 * i], y: out[4 * i + 1], z: out[4 * i + 2], fl: Math.round(out[4 * i + 3] - 10 * n - 1) })) };
})()`);
const near = (v, w) => Math.abs(v.x - w.x) <= FLOAT_TOL && Math.abs(v.y - w.y) <= FLOAT_TOL && Math.abs(v.z - w.z) <= FLOAT_TOL && v.fl === w.fl;
const has = (res, w) => res.v.some((v) => near(v, w));
const xc = 1 / HB;   // (the pole's crossing)
// (a pole's triangle: heights 1 / x at x = 0.005, 2, 2: the corner at 0.005 is 200 high)
const pole = [[0.005, 0, 1 / 0.005], [2, 0, 0.5], [2, 1, 0.5]];
const yc = (xc - 0.005) / (2 - 0.005);   // (the edge from (0.005, 0) to (2, 1): y at x = xc)
const poleWant = [{ x: 2, y: 0, z: 0.5, fl: 0 }, { x: 2, y: 1, z: 0.5, fl: 0 }, { x: xc, y: yc, z: HB, fl: 1 }, { x: xc, y: 0, z: HB, fl: 1 }];
const P = await run(pole, false);
info.pole = P;
ok('a pole\'s triangle: four corners, the crossings at x = 1 / H_B on the top flagged +1', P.n === 4 && poleWant.every((w) => has(P, w)), { P, poleWant });
const L = await run(pole, true);
info.poleLinear = L;
ok('control: with every crossing linear the pole\'s crossing is far from x = 1 / H_B', L.v.every((v) => v.fl !== 1 || Math.abs(v.x - xc) > LINEAR_MISS), { L });
// (a corner beyond the block but not far: linear)
const near1 = [[0, 0, 1.0], [1, 0, 2.0], [0, 1, 1.0]];
const t1 = (HB - 1.0) / (2.0 - 1.0);
const N1 = await run(near1, false);
ok('a corner beyond but not far: the linear crossing', N1.n === 4 && has(N1, { x: t1, y: 0, z: HB, fl: 1 }), { N1 });
// (across zero: a top and a bottom crossing, both linear)
const zc = [[0, 0, -3], [1, 0, 3], [0, 1, 0]];
const Z = await run(zc, false);
const tt = (HB + 3) / 6, tb = (-HB + 3) / 6;
ok('across zero: the top and the bottom crossings are linear, flagged +1 and -1', has(Z, { x: tt, y: 0, z: HB, fl: 1 }) && has(Z, { x: tb, y: 0, z: -HB, fl: -1 }), { Z });
// (inside the block: unchanged)
const inn = [[0, 0, 0.5], [1, 0, -0.5], [0, 1, 1.0]];
const I = await run(inn, false);
ok('control: a triangle inside the block comes back unchanged', I.n === 3 && inn.every((q) => has(I, { x: q[0], y: q[1], z: q[2], fl: 0 })), { I });
return { pass: fails.length === 0, fails, info };
