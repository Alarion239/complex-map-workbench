// The carried fill's source-point read on chains with a cut (issue #1108): a glide frame drawn by the carried meshes
// (__cmwSteps({ mesh })) is the exact picture of the map at the same u (the inverse pass), the colour layer alone, at
// most FRAC of the pixels more than TOL levels apart, the pixels within CUT_PX of the cut's image left out. Square root
// and its sheets, the Logarithm of an annulus, at u = GLIDE_U. The measure is steps_region_centre_cmd.js's.
// Controls, each of which must fail the same measure:
// - the comparator: the mesh frame at GLIDE_U against the exact picture at WRONG_U;
// - an induced fault in the read: the fill's fragment stage reads the source point READ_SHIFT_PX pixels off (the shader
//   source is rewritten before the chain's programs compile).
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the shard ci/browser_shards.js names.
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
// (TOL levels of 255 per channel and FRAC of the pixels, as steps_region_centre_cmd.js; measured on the two chains: max 5 and
// 204 levels at a few pixels, at most 0.01 % over TOL; the band around the cut's image, left out and only reported, is the
// info's band. A control must put more than CONTROL_FACTOR times FRAC over TOL: measured,
// the wrong u 98 %, the read 3 px off 3.4 % and 8.2 %)
const TOL = 6, FRAC = 0.002, CONTROL_FACTOR = 10, CONTROL_MIN_FRAC = CONTROL_FACTOR * FRAC;
// (u of the glide frame, the wrong u of the comparator control; CUT_PX the half-width of the band around the cut's image that
// is left out; WHITE a channel above which a pixel is paper, left out when both frames have paper there; MIN_PIXELS the least
// count compared; the cut's image sampled RAY_SAMPLES points a ray, LOG_SAMPLES points a sheet of the logarithm's)
const GLIDE_U = 0.5, WRONG_U = 0.75, CUT_PX = 10, WHITE = 250, MIN_PIXELS = 5000, RAY_SAMPLES = 4000, LOG_SAMPLES = 20000;
// (the frame is drawn when two reads of the left pane SETTLE_GAP_MS apart agree, at most SETTLE_TRIES reads; READ_SHIFT_PX
// the induced fault's shift of the read, in pixels along x)
const SETTLE_TRIES = 150, SETTLE_GAP_MS = 200, READ_SHIFT_PX = 3;
const CUTS = [
  { example: 'Square root and its sheets', points: `(() => { const P = []; for (const a of [135, 225]) for (let q = 0; q < ${RAY_SAMPLES}; q++) { const t = a * Math.PI / 180, r = 8 * q / ${RAY_SAMPLES}; P.push([r * Math.cos(t), r * Math.sin(t)]); } return P; })()` },
  { example: 'Logarithm of an annulus', points: `(() => { const P = [], s = 0.5; for (const g of [1, -1]) for (let q = 0; q < ${LOG_SAMPLES}; q++) { const r = Math.exp(-12 + 24 * q / ${LOG_SAMPLES}), ph = g * Math.PI * s; P.push([(Math.pow(r, s) * Math.cos(ph) - 1) / s + s, Math.pow(r, s) * Math.sin(ph) / s]); } return P; })()` },
];
const names = [...fs.readFileSync(DIR + '/../../src/app/15-examples-guide.js', 'utf8').matchAll(/\bname: \$t\('((?:[^'\\]|\\.)*)'\)/g)].map((m) => m[1].replace(/\\'/g, "'"));
// (the frame drawn: two reads of the left pane apart agree, programs linked)
const drawn = async () => { for (let n = 0; n < SETTLE_TRIES; n++) { await settled({ max: 20000 }); const same = await ev(`(() => { const cv = document.getElementById('canvasL'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let h = 0; for (let i = 0; i < d.length; i += 4) h = (h * 31 + d[i] + 7 * d[i + 1] + 13 * d[i + 2]) | 0; const same = window.__cutH === h; window.__cutH = h; return same; })()`); if (same) return true; await sleep(SETTLE_GAP_MS); } return false; };
// the exact frame at exactU, then the mesh frame at meshU, compared: {n, max, over, paths}. fault: the induced fault is in the
// page's shaders from the start
const measure = async (c, ex, { exactU = GLIDE_U, meshU = GLIDE_U, fault = false } = {}) => {
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?view=steps&ns=regcut${Date.now()}` });
  await settled({ max: 30000, until: 'typeof __cmwExample === "function" && typeof __cmwSteps === "function"' });
  if (fault) await ev(`(() => { const P = WebGL2RenderingContext.prototype, f = P.shaderSource; P.shaderSource = function (s, src) { return f.call(this, s, src.replace('vec2 sa = vP;', 'vec2 sa = vP + ${READ_SHIFT_PX}.0 * dFdx(vP);')); }; return 1; })()`);
  await ev(`__cmwExample(${ex}); 1`); await settled({ max: 20000 });
  await ev(`__cmwSet('lines', false); __cmwSet('morphPaths', false); __cmwHideStrokes(true); __cmwSteps({ scope: 'all', surf: 'plane', go: 0, now: true, bare: true }); __cmwSteps({ scope: 'all', surf: 'plane', park: ${exactU} }); 1`);
  ok(`${c.example}: the exact frame is drawn`, await drawn(), null);
  const exact = await ev('__cmwSteps().glide.path');
  await ev(`(() => { const cv = document.getElementById('canvasL'); window.__exactFrame = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height); return 1; })()`);
  await ev(`__cmwSteps({ mesh: true, park: ${meshU} }); 1`);
  ok(`${c.example}: the mesh frame is drawn`, await drawn(), null);
  const mesh = await ev('__cmwSteps().glide.path');
  const r = await ev(`(() => {
    const cv = document.getElementById('canvasL'), rc = cv.getBoundingClientRect(), k = cv.width / rc.width, W = cv.width, H = cv.height, M = cv.getContext('2d').getImageData(0, 0, W, H).data, E = window.__exactFrame.data;
    const mask = new Uint8Array(W * H);
    for (const [re, im] of ${c.points}) { const p = __cmwW2S('L', re, im), x = Math.round((p[0] - rc.left) * k), y = Math.round((p[1] - rc.top) * k);
      for (let dy = -${CUT_PX}; dy <= ${CUT_PX}; dy++) for (let dx = -${CUT_PX}; dx <= ${CUT_PX}; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < W && Y < H) mask[Y * W + X] = 1; } }
    let n = 0, over = 0, max = 0, bn = 0, bover = 0, bmax = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = 4 * (y * W + x);
      if (E[i] > ${WHITE} && E[i + 1] > ${WHITE} && E[i + 2] > ${WHITE} && M[i] > ${WHITE} && M[i + 1] > ${WHITE} && M[i + 2] > ${WHITE}) continue;
      const d = Math.max(Math.abs(E[i] - M[i]), Math.abs(E[i + 1] - M[i + 1]), Math.abs(E[i + 2] - M[i + 2]));
      if (mask[y * W + x]) { bn++; bmax = Math.max(bmax, d); if (d > ${TOL}) bover++; continue; }
      n++; max = Math.max(max, d); if (d > ${TOL}) over++;
    }
    return { n, max, over: +(over / n).toFixed(4), band: { n: bn, max: bmax, over: +(bover / bn).toFixed(4) } };
  })()`);
  r.paths = [exact, mesh];
  return r;
};
for (const c of CUTS) {
  const ex = names.indexOf(c.example);
  ok(`${c.example}: the example is found`, ex >= 0, names.length);
  if (ex < 0) continue;
  const r = await measure(c, ex);
  info[c.example] = r;
  ok(`${c.example}: the two frames are the inverse pass's and the carried mesh's`, r.paths[0] === 'inverse' && r.paths[1] === 'mesh', r);
  ok(`${c.example}: the carried mesh's frame is the exact picture, at most ${FRAC * 100} % of the pixels more than ${TOL} levels off`, r.n > MIN_PIXELS && r.over <= FRAC, r);
  const wrongU = await measure(c, ex, { exactU: WRONG_U });
  info[`${c.example} (control: the exact picture at u = ${WRONG_U})`] = wrongU;
  ok(`${c.example} (control): the mesh frame against the exact picture at u = ${WRONG_U}: more than ${CONTROL_MIN_FRAC * 100} % of the pixels over ${TOL} levels`, wrongU.over > CONTROL_MIN_FRAC, wrongU);
  const faulty = await measure(c, ex, { fault: true });
  info[`${c.example} (control: the read ${READ_SHIFT_PX} px off)`] = faulty;
  ok(`${c.example} (control): with the fill's read ${READ_SHIFT_PX} px off, more than ${CONTROL_MIN_FRAC * 100} % of the pixels over ${TOL} levels`, faulty.over > CONTROL_MIN_FRAC, faulty);
}
return { pass: fails.length === 0, fails, info };
