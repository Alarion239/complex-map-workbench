// The Landscape's programs agree with themselves and with the GL driver: no uniform name is declared with two types in one linked program, and drawing the
// Landscape (parked and mid-glide, Inside regions' sheets off and All sheets) raises no GL error.
// - static: over every land program (chain and plain) in every map mode, the vertex and fragment stages declare each uniform name with one type, and a
//   stage declares it once; a name that has a texture unit (SAMPLER_UNITS: finishLink sets it with glUniform1i) is a sampler wherever a program declares it.
//   GLSL ES 3.00 makes a name with two types a link error, which a strict driver (ANGLE on Metal) enforces by refusing the program;
//   a lenient one links it and fails the first glUniform call on it (GL_INVALID_OPERATION), which is the second check;
// - GL errors: every glUniform1i call of a draw is followed by getError, and the draws' links are read from the app's own warnings ("shader <name> <log>"):
//   none, in every case below, parked on plane z and plane w, and parked at u = .25, .5 and .75 of the glide between them.
// Controls: a vertex stage declaring `sampler2D uX` against a fragment stage declaring `float uX` is flagged by the static check; a uniform1i on a float
// uniform is counted by the error probe.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js). Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const LOAD_MAX_MS = 60000;
const MODES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];   // (the maps' modes a program is built for: GLR._src.programSources(name, mode))
const GLIDE_U = [0.25, 0.5, 0.75];
const rAF2 = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))';
const ANN = [{ type: 'circle', cx: 0, cy: 0, r: 1 }, { type: 'circle', cx: 0, cy: 0, r: 2 }];
const CASES = [
  { tag: 'log of a Möbius map', steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, { type: 'log', params: { cut: 180, k: 0 }, on: true }], shapes: [] },
  { tag: 'Möbius, √', steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, { type: 'root', params: { n: 2 }, on: true }], shapes: [] },
  { tag: 'cube root', steps: [{ type: 'root', params: { n: 3 }, on: true }], shapes: [] },
  { tag: 'log of an annulus', steps: [{ type: 'log', params: { cut: 180, k: 0 }, on: true }], shapes: ANN },
];
// the declared uniforms of one stage: name -> [types] (comments dropped; a declaration may list several names and arrays)
const DECLS = `(() => {
  const decls = (src) => {
    const m = {};
    const s = src.replace(/\\/\\*[\\s\\S]*?\\*\\//g, ' ').replace(/\\/\\/[^\\n]*/g, ' ');
    for (const d of s.matchAll(/\\buniform\\s+(?:(?:highp|mediump|lowp)\\s+)?(\\w+)\\s+([^;]+);/g)) {
      for (const n of d[2].split(',')) { const name = n.trim().replace(/\\[.*$/, '').replace(/\\s*=.*$/, ''); (m[name] = m[name] || []).push(d[1]); }
    }
    return m;
  };
  // the names a linked pair declares with two types (or twice in one stage with different types)
  const clashes = (vs, fs) => {
    const a = decls(vs), b = decls(fs), bad = [];
    for (const n of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const types = new Set([...(a[n] || []), ...(b[n] || [])]);
      if (types.size > 1) bad.push(n + ': ' + [...types].join(' / '));
    }
    return bad;
  };
  // the names with a texture unit that a pair declares as something else
  const units = (vs, fs, U) => {
    const bad = [];
    for (const src of [vs, fs]) for (const [n, types] of Object.entries(decls(src))) if (n in U && types.some((t) => !/sampler/.test(t))) bad.push(n + ': ' + types.join(' / ') + ' (unit ' + U[n] + ')');
    return bad;
  };
  return { decls, clashes, units };
})()`;
await go(`http://localhost:${PORT}/test.html?view=steps&ns=landglerr${Date.now()}`);
await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR && !!GLR._src' });

const control = await ev(`(() => { const T = ${DECLS}; return T.clashes('uniform highp sampler2D uX; uniform int uN;', 'uniform float uX; uniform int uN;'); })()`);
ok('control: a sampler against a float of one name is flagged', control.length === 1 && /uX/.test(control[0]), control);
const unitControl = await ev(`(() => { const T = ${DECLS}; return T.units('uniform float uX;', 'uniform int uN;', { uX: 3 }); })()`);
ok('control: a float of a name that has a texture unit is flagged', unitControl.length === 1 && /uX/.test(unitControl[0]), unitControl);
// (read after a case's chain is loaded: the programs' sources are the loaded chain's)
const STATIC = `(() => {
  const T = ${DECLS};
  const names = Object.keys(GLR._src.DEFS).filter((n) => /^land/i.test(n));
  const bad = [], built = [];
  for (const n of names) for (const mode of ${JSON.stringify(MODES)}) {
    let s;
    try { s = GLR._src.programSources(n, mode); } catch (e) { continue; }
    built.push(n);
    for (const c of T.clashes(s[0], s[1])) bad.push(n + '/' + mode + ' ' + c);
    for (const c of T.units(s[0], s[1], GLR._src.SAMPLER_UNITS)) bad.push(n + '/' + mode + ' ' + c);
  }
  return { names, built: [...new Set(built)], bad: [...new Set(bad)] };
})()`;
const staticBad = new Set(), staticBuilt = new Set();
let staticNames = [];
// ---- GL errors: parked and mid-glide, sheets off and All sheets ----
async function load(c, sheets) {
  const ns = 'landglerr' + Date.now();
  await loadView('steps', ns, { shapes: c.shapes, steps: c.steps, sheets, height: 'im' });
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  await settled({ max: LOAD_MAX_MS, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
  await settled({ max: LOAD_MAX_MS * 2, until: '__cmwSteps().ready.ready' });
}
const PROBE = `(() => {
  if (window.__glerr) return 1;
  const E = window.__glerr = { uniform1i: [], warns: [], other: [] };
  const P = WebGL2RenderingContext.prototype, orig = P.uniform1i;
  P.uniform1i = function (loc, v) { this.getError(); orig.call(this, loc, v); const e = this.getError(); if (e) E.uniform1i.push(e); };
  const w = console.warn;
  console.warn = function (...a) { if (a[0] === 'shader') E.warns.push(a.slice(1).join(' ').slice(0, 200)); return w.apply(console, a); };
  return 1;
})()`;
const DRAIN = `(() => { const gl = GLR.gl, o = []; for (let i = 0; i < 8; i++) { const e = gl.getError(); if (!e) break; o.push(e); } return o; })()`;
info.cases = {};
for (const sheets of [false, true]) for (const c of CASES) {
  const key = c.tag + (sheets ? ', all sheets' : ', sheets off');
  await load(c, sheets);
  const st = await ev(STATIC);
  st.bad.forEach((x) => staticBad.add(x)); st.built.forEach((x) => staticBuilt.add(x)); staticNames = st.names;
  await ev(PROBE);
  await ev(DRAIN);
  const drawn = [];
  const at = async (label, cmd) => {
    await ev(`__cmwSteps(${cmd}); 1`); await settled({ max: LOAD_MAX_MS }); await ev(rAF2); await ev(rAF2);
    const e = await ev(DRAIN);
    if (e.length) drawn.push({ label, drain: e });
  };
  await ev(`__cmwSteps({ scope: 'all', surf: 'land', go: 0, now: true, clock: 0 }); 1`); await settled({ max: LOAD_MAX_MS }); await ev(rAF2);
  await at('plane z', `{ go: 0, now: true, clock: 0 }`);
  for (const u of GLIDE_U) await at('u = ' + u, `{ park: ${u} }`);
  await at('plane w', `{ go: 1, now: true, clock: 0 }`);
  const E = await ev('window.__glerr');
  const carry = await ev('typeof __cmwLandCarry === "function" ? __cmwLandCarry() : null');
  info.cases[key] = { uniform1iErrors: E.uniform1i.length, linkWarnings: E.warns.length, drains: drawn.length };
  ok(`${key}: no glUniform1i raised a GL error`, E.uniform1i.length === 0, E.uniform1i.slice(0, 4));
  ok(`${key}: no program failed to link`, E.warns.length === 0, E.warns.slice(0, 4));
  ok(`${key}: no GL error is pending after a frame`, drawn.length === 0, drawn.slice(0, 4));
}
info.static = { programs: staticNames.length, built: staticBuilt.size };
ok('every land program is read in some case', staticNames.length >= 10 && staticNames.every((n) => staticBuilt.has(n)), staticNames.filter((n) => !staticBuilt.has(n)));
ok('no land program declares a uniform name with two types, or a name with a texture unit as a non-sampler', staticBad.size === 0, [...staticBad].slice(0, 12));
// control: a uniform1i on a float uniform is counted by the probe
const ctl = await ev(`(() => {
  const gl = GLR.gl, mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); return sh; };
  const p = gl.createProgram();
  gl.attachShader(p, mk(gl.VERTEX_SHADER, '#version 300 es\\nvoid main() { gl_Position = vec4(0.0); }'));
  gl.attachShader(p, mk(gl.FRAGMENT_SHADER, '#version 300 es\\nprecision highp float; uniform float uF; out vec4 c; void main() { c = vec4(uF); }'));
  gl.linkProgram(p); gl.useProgram(p);
  const n = window.__glerr.uniform1i.length;
  gl.uniform1i(gl.getUniformLocation(p, 'uF'), 3);
  return window.__glerr.uniform1i.length - n;
})()`);
ok('control: a glUniform1i on a float uniform is counted', ctl === 1, ctl);
return { pass: fails.length === 0, fails, info };
