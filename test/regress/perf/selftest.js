#!/usr/bin/env node
'use strict';
// Self-test of the perf suite's own measuring code (not of the app's speed): ~40 s, one headless Chrome.
//
//   node test/regress/perf/selftest.js [--base URL]      exit 0 when every check passes
//
// It drives run.js's own helpers (required as a module) and inject.js against synthetic pages and the real app:
//  (1) slow inverse compile, the app flags it (GLR.frameStatus().pending, SPEC 10.7): a page draws a forward frame at
//      once, links an inverse program (walker invWalk / uInv) at 200 ms and draws with it first at ~1200 ms, drawing
//      nothing in between. settle() must not return before that frame, and compileStats must measure compile + first
//      draw (~1000 ms: over the 250 ms limit), not null.
//  (2) the same without the pending flag (a P2 that forgets it): settle() may return early, but compileStats reports
//      the window instead of null (inv_never_drew), and waitInverseFrame() then gets the real first frame.
//  (3) an inverse program that never draws: inv_first_draw_ms is the window length (never null), inv_never_drew.
//  (4) scrub.mobius_halfplane: the scene's chain pole blaschke^-1(1) is where mobiusHalfplanePole() says (the app's
//      own step functions blow up next to it), it crosses the half-plane's boundary in both drags (40 -> 80 -> 40
//      deg), and the scene before the fix (blaschke alone: pole 1/conj(a), fixed) never moved it.
//  (5) view_moved of the orbit units (Sphere view of z^i): with the pointer left inside the pane after a pointer
//      sweep WITHOUT a button the pane differs (the old check would pass on hover alone); shotAtRest() gives
//      identical hashes for that sweep and different ones after a real left-button orbit.
const fs = require('fs');
const path = require('path');
const http = require('http');
const { launch, sleep } = require('./cdp');
const R = require('./run');
const { sceneState, mobiusHalfplanePole } = require('./scenes');

const HERE = __dirname, ROOT = path.resolve(HERE, '..', '..', '..');
const argv = process.argv.slice(2);
const BASE = (() => { const i = argv.indexOf('--base'); return i >= 0 ? argv[i + 1] : 'http://localhost:8793/'; })();

let bad = 0;
const check = (what, ok, got) => { if (!ok) bad++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what.padEnd(78)} ${got}`); };

// a synthetic WebGL2 page: forward frame now, inverse program linked at linkAt ms, first inverse draw at drawAt ms
// (never when drawAt is null); pendingFlag: GLR.frameStatus().pending is true from the link to the first draw
function page({ linkAt = 200, drawAt = 1200, pendingFlag = true }) {
  return `<!doctype html><meta charset="utf-8"><canvas id="c" width="64" height="64"></canvas><script>
${pendingFlag ? `var pendingNow = false; var GLR = { frameStatus: () => ({ pending: pendingNow, error: '' }) };` : ''}
const gl = document.getElementById('c').getContext('webgl2');
const VS = '#version 300 es\\nvoid main() { gl_Position = vec4(0.0, 0.0, 0.0, 1.0); gl_PointSize = 4.0; }';
function prog(fs) {
  const p = gl.createProgram();
  for (const [t, src] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, '#version 300 es\\nprecision highp float;\\n' + fs]]) { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); gl.attachShader(p, s); }
  gl.linkProgram(p);
  return p;
}
const draw = (p) => { gl.useProgram(p); gl.drawArrays(gl.POINTS, 0, 1); };
const fwd = prog('out vec4 o; void main() { o = vec4(1.0, 0.0, 0.0, 1.0); }');
requestAnimationFrame(() => { gl.getProgramParameter(fwd, gl.LINK_STATUS); draw(fwd); });
let inv = null;
setTimeout(() => { inv = prog('uniform vec4 uInv[2]; out vec4 o; vec4 invWalk() { return uInv[0] + uInv[1]; } void main() { o = invWalk(); }'); ${pendingFlag ? 'pendingNow = true;' : ''} }, ${linkAt});
${drawAt === null ? '' : `setTimeout(() => requestAnimationFrame(() => { gl.getProgramParameter(inv, gl.LINK_STATUS); ${pendingFlag ? 'pendingNow = false;' : ''} draw(inv); }), ${drawAt});`}
</script>`;
}

async function main() {
  const pages = { '/slow.html': page({}), '/slow-noflag.html': page({ pendingFlag: false }), '/never.html': page({ drawAt: null, pendingFlag: false }) };
  const srv = http.createServer((req, res) => { const b = pages[req.url.split('?')[0]]; res.writeHead(b ? 200 : 404, { 'Content-Type': 'text/html' }); res.end(b || 'no'); });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const local = `http://127.0.0.1:${srv.address().port}`;
  const B = await launch({ inject: fs.readFileSync(path.join(HERE, 'inject.js'), 'utf8'), width: 1440, height: 900, dpr: 1 });
  R.use(B, BASE);
  try {
    // (1) pending flag set by the page
    await B.nav(`${local}/slow.html`);
    await B.until('typeof __perf === "object" && __perf.draws > 0', 10000);
    let s = await R.settle(0);
    let cp = await R.compileStats(0, s.now);
    check('(1) settle waits for the pending inverse compile (returns after its frame)', !s.timeout && s.t >= 1150, `settled at ${Math.round(s.t)} ms, timeout ${s.timeout}`);
    check('(1) compile + first draw measured, over the 250 ms limit', cp.inv_programs === 1 && cp.inv_first_draw_ms > R.INV_FIRST_DRAW_LIMIT && cp.inv_first_draw_ms < 2000 && !cp.inv_never_drew, JSON.stringify(cp));
    // (2) no pending flag: compileStats at the early settle reports the window, waitInverseFrame finds the frame
    await B.nav(`${local}/slow-noflag.html`);
    await B.until('typeof __perf === "object" && __perf.draws > 0', 10000);
    s = await R.settle(0);
    cp = await R.compileStats(0, s.now);
    const early = cp.inv_never_drew;
    check('(2) an inverse program that has not drawn yet is not "nothing measured"', cp.inv_first_draw_ms !== null && (early ? cp.inv_first_draw_ms > 0 : cp.inv_first_draw_ms > R.INV_FIRST_DRAW_LIMIT), JSON.stringify(cp));
    const f = await R.waitInverseFrame(0, 5000);
    cp = await R.compileStats(0, await R.pageNow());
    check('(2) waitInverseFrame gets the first inverse frame; the real time is measured', f !== null && cp.inv_first_draw_ms > R.INV_FIRST_DRAW_LIMIT && !cp.inv_never_drew, `frame at ${f && Math.round(f)} ms, ${JSON.stringify(cp)} (settle returned ${early ? 'before' : 'after'} it)`);
    // (3) never draws
    await B.nav(`${local}/never.html`);
    await B.until('typeof __perf === "object" && __perf.draws > 0', 10000);
    s = await R.settle(0);
    await sleep(300);
    const t1 = await R.pageNow();
    cp = await R.compileStats(0, t1);
    check('(3) an inverse program that never draws: the window, never null', cp.inv_never_drew && cp.inv_first_draw_ms !== null && cp.inv_first_draw_ms > 0, JSON.stringify(cp));
    check('(3) waitInverseFrame gives up (bounded)', (await R.waitInverseFrame(0, 500)) === null, 'null');
  } finally { srv.close(); }

  // (4) the scrub scene's pole (node: the app's own step functions)
  global.CX = global.CX || require(path.join(ROOT, 'src/cx.js'));
  global.Expr = global.Expr || require(path.join(ROOT, 'src/parse.js'));
  const Funcs = global.Funcs || (global.Funcs = require(path.join(ROOT, 'src/funcs.js')));
  const chainAt = (steps, phi) => {
    const fs_ = steps.map((st, i) => Funcs.build({ type: st.type, params: Object.assign(Funcs.defaults(st.type), st.params, i === 0 ? { phi } : {}), on: true }).f);
    return (z) => fs_.reduce((u, f) => f(u), z);
  };
  const st = sceneState('mobius_halfplane');
  const phi0 = st.steps[0].params.phi;
  for (const phi of [phi0, phi0 + 40]) {
    const zp = mobiusHalfplanePole(phi), F = chainAt(st.steps, phi);
    const big = Math.min(...[[1e-7, 0], [0, 1e-7], [-1e-7, 0]].map(([dx, dy]) => { const w = F({ re: zp.re + dx, im: zp.im + dy }); return Math.hypot(w.re, w.im); }));
    check(`(4) the chain's pole at phi ${phi} is mobiusHalfplanePole(): |F| > 1e5 next to it`, big > 1e5, `z_p = ${zp.re.toFixed(4)} ${zp.im >= 0 ? '+' : '-'} ${Math.abs(zp.im).toFixed(4)}i, min |F| ${big.toExponential(2)}`);
  }
  const s0 = Math.sign(mobiusHalfplanePole(phi0).im), s1 = Math.sign(mobiusHalfplanePole(phi0 + 40).im);
  check('(4) the pole crosses the boundary (Im z_p changes sign) in each drag of the scrub', s0 !== s1 && s0 !== 0 && s1 !== 0, `Im z_p: ${mobiusHalfplanePole(phi0).im.toFixed(4)} at ${phi0}, ${mobiusHalfplanePole(phi0 + 40).im.toFixed(4)} at ${phi0 + 40}`);
  {
    // the scene before the fix: blaschke(a, phi) alone; its pole 1/conj(a) = (0.5 + 0.3i) / 0.34 does not move with phi
    const old = [{ type: 'blaschke', params: { a: '0.5+0.3i' } }];
    const p = { re: 0.5 / 0.34, im: 0.3 / 0.34 };
    const moved = [0, 40].map((phi) => { const w = chainAt(old, phi)({ re: p.re + 1e-7, im: p.im }); return Math.hypot(w.re, w.im); });
    check('(4) (before the fix: blaschke alone has a fixed pole 1/conj(a), 0.88 above the boundary)', moved.every((x) => x > 1e5) && p.im > 0.8, `|F| next to 1/conj(a) at phi 0, 40: ${moved.map((x) => x.toExponential(1)).join(', ')}`);
  }

  // (5) view_moved of the orbit units: hover alone must not count as a moved view
  try {
    await R.openApp(sceneState('ziH', { rightMode: 'sphere', meshN: 240 }));
    const r = await B.ev(`(() => { const e = document.getElementById('overlayR').getBoundingClientRect(); return { cx: e.left + e.width / 2, cy: e.top + e.height / 2 }; })()`);
    const h0 = await R.shotAtRest('R');
    for (let k = 0; k <= 30; k++) { await B.move(r.cx - 80 + k * 160 / 30, r.cy - 30 + k * 60 / 30); await sleep(16); }
    await R.settle(await R.pageNow());
    const hInside = await R.paneShot('R');
    const hRest = await R.shotAtRest('R');
    check('(5) old protocol: a sweep without a button changes the pane while the pointer is inside', hInside !== h0, `${h0.slice(0, 8)} -> ${hInside.slice(0, 8)}`);
    check('(5) shotAtRest: the same sweep leaves the pane unchanged (view_moved false)', hRest === h0, `${h0.slice(0, 8)} -> ${hRest.slice(0, 8)}`);
    await R.dragLeg('R', 160, 60, 'left');
    const hOrbit = await R.shotAtRest('R');
    check('(5) shotAtRest: a left-button orbit changes the pane (view_moved true)', hOrbit !== h0, `${h0.slice(0, 8)} -> ${hOrbit.slice(0, 8)}`);
  } catch (e) { check('(5) the app could be opened at ' + BASE, false, String(e).slice(0, 200)); }
  await B.close();
  console.log(bad ? `\n${bad} perf self-test check(s) FAILED` : '\nall perf self-tests passed');
  process.exitCode = bad ? 1 : 0;
}
main().catch((e) => { console.error(e); process.exit(2); });
