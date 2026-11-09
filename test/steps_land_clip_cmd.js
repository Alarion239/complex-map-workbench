// The block clip shared by the sheets' mesh and the layered glide's carry (GLR.landClipGlsl: blockClip), run through the real GLSL
// in a context of its own: a triangle (corners: x, y, height) is cut at |h| = BLOCK_K H and the polygon read back, against what the
// geometry says it must be:
// - a pole's edge: heights h = 1 / x on edges that run from a corner far beyond the block to one inside it. The crossing of h = H_B is at x = 1 / H_B
//   exactly, and the clip interpolates 1 / h along the edge, which is linear in x, so it finds that x; a linear crossing hugs the inside corner;
// - an edge one corner of which is beyond but not far: the linear crossing;
// - an edge across zero (h from -3 to 3): the linear crossing on each side (the 1 / h rule is for corners on the block's own side);
// - the clipped edges' flags (+1 on the top, -1 on the bottom), the others 0;
// - the sides: a crossing of a side plane lies exactly on it (flag 0), and a triangle cut by all six planes keeps its nine corners, as a plain polygon
//   clip (Sutherland-Hodgman, linear crossings) reads them.
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
const NO_SIDES = [-1e30, 1e30, -1e30, 1e30];   // (CLIP_NO_SIDES)
const CLIP_N = 9;   // (LAND_CLIP_CORNERS: the polygon's room)
const run = (tri, linear, sides = NO_SIDES, mode = 0, k = 1) => ev(`(() => {
  const gl = document.createElement('canvas').getContext('webgl2');
  const src = '#version 300 es\\nprecision highp float; precision highp int;\\n' + GLR.landClipGlsl + \`
uniform vec3 uQ[3]; uniform float uHb; uniform vec4 uSd; uniform int uMode; uniform float uK; out vec4 o;
void main() {
  vec3 Q[CLIP_N]; vec4 A[CLIP_N]; vec3 Nn[CLIP_N]; float Fl[CLIP_N];
  for (int i = 0; i < CLIP_N; i++) { Q[i] = vec3(0.0); A[i] = vec4(0.0); Nn[i] = vec3(0.0, 0.0, 1.0); Fl[i] = 0.0; }
  Q[0] = uQ[0]; Q[1] = uQ[1]; Q[2] = uQ[2];
  int n = blockClip(uHb, uSd, 3, Q, A, Nn, Fl);
  o = vec4(Q[gl_VertexID].xy, Q[gl_VertexID].z, float(n) * 10.0 + Fl[gl_VertexID] + 1.0);
  if (uMode == 2) o = vec4(clipWithin(uQ[0].xy, uQ[1].xy, uQ[2].xy, uSd, uK) ? 1.0 : 0.0, float(n), 0.0, 0.0);
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
  gl.uniform1i(gl.getUniformLocation(p, 'uMode'), ${mode});
  gl.uniform1f(gl.getUniformLocation(p, 'uK'), ${k});
  gl.uniform4fv(gl.getUniformLocation(p, 'uSd'), new Float32Array(${JSON.stringify(sides)}));
  gl.uniform1i(gl.getUniformLocation(p, 'uClipLinear'), ${linear ? 1 : 0});
  const buf = gl.createBuffer(); gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, buf); gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER, ${CLIP_N} * 16, gl.DYNAMIC_READ);
  gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, buf);
  gl.enable(gl.RASTERIZER_DISCARD); gl.beginTransformFeedback(gl.POINTS); gl.drawArrays(gl.POINTS, 0, ${CLIP_N}); gl.endTransformFeedback();
  const out = new Float32Array(${4 * CLIP_N}); gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER, 0, out);
  if (${mode === 2 ? 'true' : 'false'}) return { within: out[0] === 1, n: out[1] };
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
// (the sides: x <= SIDE_X cuts a flat triangle at the plane exactly, the new corners flagged 0)
const SIDE_X = 1, SIDES = [-1e30, SIDE_X, -1e30, 1e30];
const side = [[0, 0, 0.5], [2, 0, 0.5], [0, 1, 0.5]];
const S = await run(side, false, SIDES);
ok('a side plane: the triangle cut at x = 1 has four corners, the new ones on the plane, flagged 0', S.n === 4 && has(S, { x: SIDE_X, y: 0, z: 0.5, fl: 0 }) && has(S, { x: SIDE_X, y: 0.5, z: 0.5, fl: 0 }) && has(S, { x: 0, y: 1, z: 0.5, fl: 0 }), { S });
const SO = await run(side, false);
ok('control: without the side planes the same triangle comes back unchanged', SO.n === 3, { SO });
// (all six planes: a triangle cut by the top, the bottom and the four sides of the box |x|, |y| <= BOX_SIDE keeps nine corners, as a plain polygon clip reads them)
const BOX_SIDE = 1, BOX = [-BOX_SIDE, BOX_SIDE, -BOX_SIDE, BOX_SIDE];
const clipRef = (tri) => {
  const planes = [(q) => q[2] - HB, (q) => -q[2] - HB, (q) => BOX[0] - q[0], (q) => q[0] - BOX[1], (q) => BOX[2] - q[1], (q) => q[1] - BOX[3]];
  let poly = tri;
  for (const d of planes) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length], da = d(a), db = d(b);
      if (da <= 0) out.push(a);
      if ((da <= 0) !== (db <= 0)) out.push(a.map((v, k) => v + da / (da - db) * (b[k] - v)));
    }
    poly = out;
  }
  return poly;
};
const nine = [[1.5, 1.5, 1.8], [-2.25, -3.75, -1.5], [-0.5, 0.5, -1.2]];
const want9 = clipRef(nine);
const N9 = await run(nine, false, BOX);
info.nine = { N9, want9 };
ok(`all six planes: ${want9.length} corners, each where the plain polygon clip puts it`, N9.n === want9.length && want9.length === CLIP_N && want9.every((w) => N9.v.some((v) => Math.abs(v.x - w[0]) <= FLOAT_TOL && Math.abs(v.y - w[1]) <= FLOAT_TOL && Math.abs(v.z - w[2]) <= FLOAT_TOL)), { N9, want9 });
// (clipWithin, the test that lets the carried draw leave the rest of a triangle's fan undrawn: a triangle it calls within the sides comes back from the clip
// whole, whatever the sides; and it is true of a triangle well inside them, so it does skip. With the sides read 10 % wider it is true of a triangle
// the clip cuts: the control)
const WB = [-1, 1, -1, 1], WITHIN_K = 1.1;
const insideT = [[-0.5, -0.5, 0], [0.5, -0.5, 0], [0, 0.5, 0]], overT = [[0.5, 0, 0], [1.05, 0, 0], [0.5, 0.5, 0]], farT = [[2, 2, 0], [3, 2, 0], [2, 3, 0]], edgeT = [[0.5, 0, 0], [1, 0, 0], [0.5, 0.5, 0]];
const W = {};
for (const [name, t] of Object.entries({ insideT, overT, farT, edgeT })) W[name] = await run(t, false, WB, 2);
const Wk = await run(overT, false, WB, 2, WITHIN_K);
info.within = { W, Wk };
ok('clipWithin: a triangle it calls within the sides is not cut (no triangle called within comes back with more than 3 corners)', Object.values(W).every((w) => !w.within || w.n === 3), { W });
ok('clipWithin: a triangle well inside the sides is called within, one on the side is too (it skips them), one beyond the side is not', W.insideT.within && W.edgeT.within && !W.overT.within && !W.farT.within, { W });
ok(`control: with the sides read ${WITHIN_K} wider a triangle the clip cuts is called within`, Wk.within && Wk.n > 3, { Wk });
return { pass: fails.length === 0, fails, info };
