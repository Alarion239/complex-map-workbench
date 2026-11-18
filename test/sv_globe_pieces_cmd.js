// The globe's outlines from their cached values (#1074): the piece pass (GLR linePieces: each piece's ends, joins and
// culls once per drawLines into float targets, the casing and the stroke drawn from them, linePc) against the
// per-vertex program (lineSC, which computes them at each of a piece's six vertices in both passes). The default
// page, Surface: Sphere, the steps view, Everywhere and Inside regions, at rest on z and w1 and held at x = 0.25, 0.5
// and 0.75 (at the device pixel ratio 1 and at the Mac screen's 2: the kit's CMW_DPR, ci/browser_suites.js):
// - picture: the left pane drawn with the piece pass and without it is the same to the byte, and the piece pass drew;
// - cost: the outlines' GPU time per draw of the left pane (each of their draws timed alone, a 1-px readPixels before
//   and after it), the piece pass's (linePieces and linePc) at most half the per-vertex program's. lineSC took 3.3 of
//   a held frame's 9 ms on the Mac (M4) and 60 of 86 ms on lavapipe, all of it vertex work (sv_globe_drawsplit_cmd).
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shards (ci/browser_shards.js).
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const RATIO = 0.5, DRAWS = 6;
// (the page's WebGL2 draws wrapped once: while __pc.on, each draw of the outlines' programs is timed alone and summed
// per kind, 'pass' (linePieces), 'draw' (linePc) or 'vertex' (lineSC), told apart by their shaders' source)
const WRAP = `(() => {
  if (window.__pc) return 1;
  const P = WebGL2RenderingContext.prototype, cur = new WeakMap(), kinds = new WeakMap();
  window.__pc = { on: false, ms: {}, n: {} };
  const use = P.useProgram;
  P.useProgram = function (p) { cur.set(this, p); return use.call(this, p); };
  const rp = P.readPixels;
  const sync = (gl) => {
    const fmt = gl.getParameter(gl.IMPLEMENTATION_COLOR_READ_FORMAT), typ = gl.getParameter(gl.IMPLEMENTATION_COLOR_READ_TYPE);
    const A = typ === gl.FLOAT ? Float32Array : typ === gl.UNSIGNED_INT ? Uint32Array : typ === gl.INT ? Int32Array : typ === gl.HALF_FLOAT ? Uint16Array : Uint8Array;
    const pb = gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING);
    if (pb) gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    try { rp.call(gl, 0, 0, 1, 1, fmt, typ, new A(4)); } catch (e) { gl.finish(); }
    if (pb) gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pb);
  };
  const kind = (gl, p) => {
    if (!p) return null;
    if (kinds.has(p)) return kinds.get(p);
    const src = (gl.getAttachedShaders(p) || []).map((s) => gl.getShaderSource(s) || '').join('\\n');
    const k = /void pieceAt\\(/.test(src) ? 'pass' : /uniform int uPcW/.test(src) ? 'draw' : /bool segDot\\(/.test(src) && /vec3 lift\\(/.test(src) && /Wn\\(int inst/.test(src) ? 'vertex' : null;
    kinds.set(p, k);
    return k;
  };
  for (const f of ['drawArrays', 'drawArraysInstanced']) {
    const o = P[f];
    P[f] = function (...a) {
      const k = __pc.on ? kind(this, cur.get(this)) : null;
      if (!k) return o.apply(this, a);
      sync(this);
      const t0 = performance.now(), r = o.apply(this, a);
      sync(this);
      __pc.ms[k] = (__pc.ms[k] || 0) + performance.now() - t0; __pc.n[k] = (__pc.n[k] || 0) + 1;
      return r;
    };
  }
  return 1;
})()`;
// the left pane drawn once more with the piece pass on or off, its pixels kept as tag
const drawAs = (on, tag) => ev(`(() => {
  GLR.linePiecesOn(${on});
  __cmwTime(1);
  const c = document.getElementById('canvasL'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  (window.__pcPx || (window.__pcPx = {}))[${JSON.stringify(tag)}] = d;
  return GLR.linePiecesOn().passes;
})()`);
// -> {n: bytes compared, diff: bytes that differ, first: the first one's index}
const compare = (a, b) => ev(`(() => {
  const A = __pcPx[${JSON.stringify(a)}], B = __pcPx[${JSON.stringify(b)}];
  if (!A || !B || A.length !== B.length) return { n: 0, diff: -1 };
  let diff = 0, first = -1;
  for (let i = 0; i < A.length; i++) if (A[i] !== B[i]) { if (first < 0) first = i; diff++; }
  return { n: A.length, diff, first };
})()`);
// the outlines' GPU ms per draw of the left pane, with the piece pass on (its pass and its draws) or off
const cost = (on) => ev(`(() => {
  GLR.linePiecesOn(${on});
  __cmwTime(1);
  __pc.ms = {}; __pc.n = {}; __pc.on = true;
  for (let i = 0; i < ${DRAWS}; i++) __cmwTime(1);
  __pc.on = false;
  const per = (k) => +((__pc.ms[k] || 0) / (2 * ${DRAWS})).toFixed(3);
  return { ms: ${on} ? +(per('pass') + per('draw')).toFixed(3) : per('vertex'), pass: per('pass'), draw: per('draw'), vertex: per('vertex'), draws: Object.assign({}, __pc.n) };
})()`);
await view(1200, 800, false, false);
const DPR = await ev('devicePixelRatio');
{
  for (const scope of ['all', 'in']) {
    const tag = `dpr${DPR} ${scope}`;
    await go(`http://localhost:${PORT}/test.html?ns=pieces${scope}${Date.now()}&view=steps`);
    const up = await settled({ max: 60000, until: 'typeof __cmwSteps === "function" && typeof __cmwSvX === "function" && typeof __cmwTime === "function" && !!window.GLR' });
    if (!up.ok) { fails.push({ name: `${tag}: the page hooks are up`, got: up }); continue; }
    const hook = await ev('typeof GLR.linePiecesOn');
    ok(`${tag}: GLR.linePiecesOn exists`, hook === 'function', hook);
    if (hook !== 'function') continue;
    await ev(`__cmwSteps({ scope: '${scope}', surf: 'sphere', go: 0, now: true }), 1`);
    await settled({ max: 60000, until: 'GLR.pendingLinks === 0 && !__cmwSteps().moving && __cmwSvX() === 0' });
    for (const x of [0, 0.25, 0.5, 0.75, 1]) {
      await ev(`__cmwSteps({ x: ${x}, now: true }), 1`);
      await settled({ max: 60000, until: `GLR.pendingLinks === 0 && Math.abs(__cmwSvX() - ${x}) < 1e-9` });
      // (the per-vertex frame drawn until two draws in a row are the same: a frame's later draws may still refine it)
      let p0 = await drawAs(false, 'off'), still = null;
      for (let k = 0; k < 20 && !(still && still.diff === 0); k++) { await ev('__pcPx.prev = __pcPx.off, 1'); p0 = await drawAs(false, 'off'); still = await compare('prev', 'off'); }
      const p1 = await drawAs(true, 'on'), p2 = await drawAs(false, 'off2');
      const c = await compare('on', 'off'), c2 = await compare('off', 'off2');
      info[`${tag} x=${x}`] = { compared: c.n, differ: c.diff, first: c.first, passes: p1 - p0 };
      ok(`${tag} x = ${x}: the piece pass drew`, p1 > p0 && p2 === p1, { p0, p1, p2 });
      ok(`${tag} x = ${x}: the per-vertex frame drawn twice is the same (the comparison is sound)`, c2.n > 0 && c2.diff === 0, c2);
      ok(`${tag} x = ${x}: the frame with the piece pass is the per-vertex frame to the byte`, c.n > 0 && c.diff === 0, c);
    }
    await ev(`__cmwSteps({ x: 0.5, now: true }), 1`);
    await settled({ max: 60000, until: 'GLR.pendingLinks === 0 && Math.abs(__cmwSvX() - 0.5) < 1e-9' });
    await ev(WRAP);
    const off = await cost(false), on = await cost(true);
    info[`${tag} cost`] = { vertex: off, pieces: on, ratio: off.ms > 0 ? +(on.ms / off.ms).toFixed(3) : null };
    ok(`${tag}: the outlines' per-vertex draws are timed`, off.ms > 0 && off.draws.vertex > 0 && !off.draws.pass && !off.draws.draw, off);
    ok(`${tag}: the outlines' piece-pass draws are timed`, on.ms > 0 && on.draws.pass > 0 && on.draws.draw > 0 && !on.draws.vertex, on);
    ok(`${tag}: the outlines' GPU time with the piece pass is at most ${RATIO} times the per-vertex program's`, on.ms > 0 && off.ms > 0 && on.ms <= RATIO * off.ms, { pieces: on, vertex: off });
  }
}
await ev('GLR.linePiecesOn(true), 1');
return { pass: fails.length === 0, fails, info };
