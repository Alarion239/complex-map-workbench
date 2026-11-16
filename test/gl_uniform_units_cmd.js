// Every program's uniforms against the texture units finishLink sets (SAMPLER_UNITS, src/gl/04-programs-resources.js): it calls
// glUniform1i with the unit on every active uniform whose name is in the table, so such a name must be a sampler in every program that
// declares it (a float of that name is GL error 1282 and a black picture; an int silently takes the unit until its own value is set).
// - static: over every program of GLR._src.DEFS, in every map mode it builds for, for each chain below: a name with a texture unit is a
//   sampler wherever a stage declares it, and the two stages of a program declare a name with one type;
// - linked: every program the scenes below linked (the inverse programs too, which are made per chain): an active uniform whose name has
//   a texture unit is of a sampler type;
// - GL errors: every glUniform1i is followed by getError, and so are the link and the first draw of each program; an error found
//   pending before one of them is counted too; a link that fails reaches the app's "shader <name> <log>" warning: none in any scene.
// Scenes: the steps view's default example on plane z; Square root and its sheets, Everywhere, parked half-way; exp then log,
// Everywhere, parked between w1 and w2 (the fill's point pass), then its Sphere and Landscape surfaces; the classic view.
// The probe must have seen programs linked and drawn on each scene's page, so the error checks do not pass empty.
// Controls: a float of a name with a unit, and a sampler against a float of one name, are flagged by the static check; a linked program
// with a float of such a name is flagged by the linked check; a glUniform1i on a float is counted; an error pending before a
// glUniform1i is counted apart; an error raised by a link (of a deleted program) and one raised by a program's first draw (a negative
// count) are counted; a program that compiles but does not link reaches the warning.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the shard ci/browser_shards.js names. Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const LOAD_MAX_MS = 60000, MODES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const rAF2 = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))';
// (installed before the page's scripts run, so the first link is seen: links, glUniform1i calls and first draws checked with getError)
const PROBE = `(() => {
  const E = window.__glerr = { linked: [], uniform1i: [], pending: [], link: [], draw: [], warns: [], drawn: 0 };
  const P = WebGL2RenderingContext.prototype, drain = (gl, into) => { for (let e = gl.getError(), n = 0; e && n < 8; e = gl.getError(), n++) into.push(e); };
  const link = P.linkProgram;
  P.linkProgram = function (p) { drain(this, E.pending); link.call(this, p); E.linked.push(p); drain(this, E.link); };
  const u1 = P.uniform1i;
  P.uniform1i = function (l, v) { drain(this, E.pending); u1.call(this, l, v); drain(this, E.uniform1i); };
  const seen = new WeakSet();
  for (const k of ['drawArrays', 'drawArraysInstanced', 'drawElements', 'drawElementsInstanced']) {
    const f = P[k];
    P[k] = function (...a) {
      const p = this.getParameter(this.CURRENT_PROGRAM), first = !!p && !seen.has(p);
      if (first) drain(this, E.pending);
      f.apply(this, a);
      if (first) { seen.add(p); E.drawn++; drain(this, E.draw); }
    };
  }
  const w = console.warn;
  console.warn = function (...a) { if (a[0] === 'shader') E.warns.push(a.slice(1).join(' ').slice(0, 200)); return w.apply(console, a); };
})();`;
await send('Page.addScriptToEvaluateOnNewDocument', { source: PROBE });
const { DECLS, STATIC: staticOf } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'uniform_decls.js'), 'utf8'));
const STATIC = staticOf(MODES);
// the active uniforms of every program linked so far that have a texture unit and are not of a sampler type
const LINKED = `(() => {
  const gl = GLR.gl, U = GLR._src.SAMPLER_UNITS;
  const S = new Set(['SAMPLER_2D', 'SAMPLER_3D', 'SAMPLER_CUBE', 'SAMPLER_2D_SHADOW', 'SAMPLER_2D_ARRAY', 'SAMPLER_2D_ARRAY_SHADOW', 'SAMPLER_CUBE_SHADOW', 'INT_SAMPLER_2D', 'INT_SAMPLER_3D', 'INT_SAMPLER_CUBE', 'INT_SAMPLER_2D_ARRAY', 'UNSIGNED_INT_SAMPLER_2D', 'UNSIGNED_INT_SAMPLER_3D', 'UNSIGNED_INT_SAMPLER_CUBE', 'UNSIGNED_INT_SAMPLER_2D_ARRAY'].map((k) => gl[k]));
  const bad = [];
  let n = 0;
  for (const p of window.__glerr.linked) {
    if (!gl.isProgram(p) || !gl.getProgramParameter(p, gl.LINK_STATUS)) continue;
    n++;
    for (let i = 0, m = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i < m; i++) {
      const u = gl.getActiveUniform(p, i), name = u.name.replace(/\\[0\\]$/, '');
      if (name in U && !S.has(u.type)) bad.push(name + ': type 0x' + u.type.toString(16) + ' (unit ' + U[name] + ')');
    }
  }
  return { programs: n, bad: [...new Set(bad)] };
})()`;
const staticBad = new Set(), staticBuilt = new Set();
let staticNames = [];
const readStatic = async () => { const st = await ev(STATIC); st.bad.forEach((x) => staticBad.add(x)); st.built.forEach((x) => staticBuilt.add(x)); staticNames = st.names; };
const quiet = async () => { await settled({ max: LOAD_MAX_MS }); await ev(rAF2); await ev(rAF2); };
const errorsOf = () => ev(`(() => { const E = window.__glerr; return { uniform1i: E.uniform1i.length, pending: E.pending.length, link: E.link.length, draw: E.draw.length, warns: E.warns.slice(0, 4), drawn: E.drawn, linked: E.linked.length, first: [...E.uniform1i, ...E.pending, ...E.link, ...E.draw].slice(0, 6) }; })()`);
info.scenes = {};
const scene = async (key, run) => {
  await run();
  await quiet();
  await readStatic();
  const e = await errorsOf(), l = await ev(LINKED);
  info.scenes[key] = { drawn: e.drawn, linked: l.programs, errors: e.uniform1i + e.pending + e.link + e.draw, warns: e.warns.length };
  ok(`${key}: the probe saw programs linked and drawn on this page`, e.linked > 0 && e.drawn > 0, { linked: e.linked, drawn: e.drawn });
  ok(`${key}: no GL error at a glUniform1i, a link or a program's first draw, and none pending before them`, e.uniform1i + e.pending + e.link + e.draw === 0, e);
  ok(`${key}: no program failed to link`, e.warns.length === 0, e.warns);
  ok(`${key}: every linked program's uniform that has a texture unit is a sampler`, l.programs > 0 && l.bad.length === 0, l);
};
const open = async (url) => { await go(url); await settled({ max: LOAD_MAX_MS, until: 'typeof __cmwSteps === "function" && !!window.GLR && !!GLR._src' }); };
const openSeeded = async (state) => { const ns = 'glunits' + Date.now(); await seed(ns, state); await open(`http://localhost:${PORT}/test.html?view=steps&ns=${ns}`); };
await scene('steps view, the default example, plane z', () => open(`http://localhost:${PORT}/test.html?view=steps&ns=glunits${Date.now()}`));
await scene('Square root and its sheets, Everywhere, parked half-way', async () => {
  await ev(`__cmwExample(${exampleNames().indexOf('Square root and its sheets')}); 1`); await settled({ max: LOAD_MAX_MS });
  await ev(`__cmwSteps({ scope: 'all', surf: 'plane', go: 0, now: true }); __cmwSteps({ scope: 'all', surf: 'plane', park: 0.5 }); 1`);
});
await scene('exp then log, Everywhere, parked between w1 and w2', async () => {
  await openSeeded({ steps: [{ id: 'f1', type: 'exp', params: {} }, { id: 'f2', type: 'log', params: { cut: 180, k: 0 } }], shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 2, ci: 0, visible: true }], focus: 2 });
  await ev(`__cmwSteps({ T: 0 }); __cmwSteps({ scope: 'all', surf: 'plane', go: 0, now: true }); __cmwSteps({ scope: 'all', surf: 'plane', park: 1.5 }); 1`);
  await settled({ max: LOAD_MAX_MS, until: 'GLR.chainProgs().includes("regionKSCptm")' });
});
await scene('exp then log, the Sphere', () => ev(`__cmwSteps({ surf: 'sphere', go: 1, now: true }); 1`));
await scene('exp then log, the Landscape', () => ev(`__cmwSteps({ surf: 'land', go: 1, now: true }); 1`));
await scene('the classic view', () => open(`http://localhost:${PORT}/test.html?view=classic&ns=glunits${Date.now()}`));
info.static = { programs: staticNames.length, built: staticBuilt.size };
ok('the static check read every program of GLR._src.DEFS', staticNames.length >= 20 && staticNames.every((n) => staticBuilt.has(n)), staticNames.filter((n) => !staticBuilt.has(n)));
ok('no program declares a name that has a texture unit as other than a sampler, or a name with two types', staticBad.size === 0, [...staticBad].slice(0, 12));
// controls
const ctlStatic = await ev(`(() => { const T = ${DECLS}; return { units: T.units('uniform float uX;', 'uniform int uN;', { uX: 3 }), clashes: T.clashes('uniform highp sampler2D uX;', 'uniform float uX;') }; })()`);
ok('control: a float of a name with a texture unit, and a sampler against a float of one name, are flagged', ctlStatic.units.length === 1 && ctlStatic.clashes.length === 1, ctlStatic);
const ctlLinked = await ev(`(() => {
  const gl = GLR.gl, U = GLR._src.SAMPLER_UNITS, name = Object.keys(U)[0], mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); return sh; };
  const p = gl.createProgram();
  gl.attachShader(p, mk(gl.VERTEX_SHADER, '#version 300 es\\nvoid main() { gl_Position = vec4(0.0); }'));
  gl.attachShader(p, mk(gl.FRAGMENT_SHADER, '#version 300 es\\nprecision highp float; uniform float ' + name + '; out vec4 c; void main() { c = vec4(' + name + '); }'));
  gl.linkProgram(p);
  const r = ${LINKED};
  window.__glerr.linked = window.__glerr.linked.filter((q) => q !== p);
  gl.deleteProgram(p);
  return { name, bad: r.bad.filter((b) => b.startsWith(name + ':')) };
})()`);
ok('control: a linked program with a float of a name that has a texture unit is flagged', ctlLinked.bad.length === 1, ctlLinked);
const ctlU1 = await ev(`(() => {
  const gl = GLR.gl, mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); return sh; };
  const p = gl.createProgram();
  gl.attachShader(p, mk(gl.VERTEX_SHADER, '#version 300 es\\nvoid main() { gl_Position = vec4(0.0); }'));
  gl.attachShader(p, mk(gl.FRAGMENT_SHADER, '#version 300 es\\nprecision highp float; uniform float uF; out vec4 c; void main() { c = vec4(uF); }'));
  gl.linkProgram(p); gl.useProgram(p);
  const E = window.__glerr, n = E.uniform1i.length;
  gl.uniform1i(gl.getUniformLocation(p, 'uF'), 3);
  const d = E.uniform1i.length - n;
  E.linked = E.linked.filter((q) => q !== p); gl.deleteProgram(p);
  const m = E.pending.length;
  gl.activeTexture(0);
  gl.uniform1i(null, 0);
  return { uniform1i: d, pending: E.pending.length - m };
})()`);
ok('control: a glUniform1i on a float is counted, and an error pending before one is counted apart', ctlU1.uniform1i === 1 && ctlU1.pending === 1, ctlU1);
const ctlDrains = await ev(`(() => {
  const gl = GLR.gl, E = window.__glerr, mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); return sh; };
  // (a link that raises an error: of a deleted program)
  const dead = gl.createProgram();
  gl.deleteProgram(dead);
  const nl = E.link.length;
  gl.linkProgram(dead);
  const link = E.link.length - nl;
  // (a program's first draw that raises an error: a negative count)
  const p = gl.createProgram();
  gl.attachShader(p, mk(gl.VERTEX_SHADER, '#version 300 es\\nvoid main() { gl_Position = vec4(0.0); }'));
  gl.attachShader(p, mk(gl.FRAGMENT_SHADER, '#version 300 es\\nprecision highp float; out vec4 c; void main() { c = vec4(1.0); }'));
  gl.linkProgram(p); gl.useProgram(p);
  const nd = E.draw.length;
  gl.drawArrays(gl.TRIANGLES, 0, -1);
  const draw = E.draw.length - nd;
  gl.useProgram(null);
  E.linked = E.linked.filter((q) => q !== dead && q !== p); gl.deleteProgram(p);
  return { link, draw };
})()`);
ok('control: an error raised by a link, and one raised by a program\'s first draw, are counted', ctlDrains.link >= 1 && ctlDrains.draw >= 1, ctlDrains);
await ev(`GLR._src.DEFS.glunitsBroken = { chain: false, vs: () => 'out vec2 v; void main() { v = vec2(0.0); gl_Position = vec4(0.0); }', fs: () => 'in vec3 v; out vec4 c; void main() { c = vec4(v, 1.0); }' }; 1`);
let warned = [];
for (let k = 0; k < 40 && !warned.length; k++) {
  await ev(`GLR._src.program('glunitsBroken'); 1`); await ev(rAF2);
  warned = (await ev('window.__glerr.warns')).filter((w) => /glunitsBroken/.test(w));
}
await ev(`delete GLR._src.DEFS.glunitsBroken; 1`);
ok("control: a program that compiles but does not link reaches the 'shader' warning", warned.length >= 1, warned);
return { pass: fails.length === 0, fails, info };
