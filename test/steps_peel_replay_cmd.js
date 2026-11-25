// The carried meshes' layers draw their vertex stage once a frame (#2392): below full opacity GLR.carryLayers draws every
// carried mesh once per layer (and once more for the resolve of ties), each draw running the same vertex stage, most of a
// glide frame on a renderer whose vertex stage is slow. The frame now captures each mesh's vertex stage once (transform
// feedback) and draws every pass from it. Integer power z² then exp, Everywhere, a disc of radius 1, on the plane, at the
// default opacity (0.85: three layers), the glide from w₁ to w₂ held at u = ¼, ½ and ¾, the page at 1440 x 900, at dpr 1
// and 2. At each u the left pane is drawn twice, with the capture and without it (carryProbes' noReplay: the four draws
// of each mesh, as before), and its pixels compared:
// - replays: with the capture, a layered frame captures each of its meshes once and draws every pass from the captures
//   (GLR.carryReplays: captures, and passes drawn from one);
// - same picture: the two frames' pixels are the same, every one (a control: the frames are layered, and coloured);
// - fallback: without the capture the frame captures nothing and is still layered (the four draws);
// - context: after the context is lost and restored, the frame captures again, with the same picture as without it;
// - timing (dpr 1): a frame with the capture takes at most TIME_RATIO of one without it.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
let pass = 0;
const ok = (name, cond, got) => { if (cond) pass++; else fails.push({ name, got }); return !!cond; };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const goOk = async (url) => { if (!(await go(url))) throw new Error('no load event for ' + url); };
const US = [0.25, 0.5, 0.75], TIME_RATIO = 0.8, TIME_REPS = 3, MIN_COLOURED = 0.5;
const STATE = { v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 140 }, sv: { speed: 'fast' },
  shapes: [{ id: 'd1', kind: 'disc', c: [0, 0], r: 1, ci: 0, visible: true }],
  steps: [{ type: 'pown', params: { n: 2 }, on: true }, { type: 'exp', params: {}, on: true }] };
// the left pane drawn once with the capture on or off: its time (ms), the layered frames and the captures it made, and its
// pixels, kept in window.__pix[key]; -> { ms, layers, captures, replays, coloured (share of pixels not white or clear) }
const FRAME = (key, replay) => `(() => {
  GLR.carryProbes(Object.assign({}, GLR.carryProbes(), { noReplay: ${!replay} }));
  const l0 = GLR.carryLayerFrames(), r0 = GLR.carryReplays ? GLR.carryReplays() : { captures: 0, replays: 0 };
  const ms = __cmwTime(1).left;
  const l1 = GLR.carryLayerFrames(), r1 = GLR.carryReplays ? GLR.carryReplays() : { captures: 0, replays: 0 };
  const cv = [...document.querySelectorAll('canvas')].filter((c) => c.getContext('2d')).sort((a, b) => b.width * b.height - a.width * a.height)[0];
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  (window.__pix || (window.__pix = {}))[${JSON.stringify(key)}] = d;
  let col = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0 && !(d[i] > 250 && d[i + 1] > 250 && d[i + 2] > 250)) col++;
  GLR.carryProbes(Object.assign({}, GLR.carryProbes(), { noReplay: false }));
  return { ms, layers: (l1 - l0) / 2, captures: (r1.captures - r0.captures) / 2, replays: (r1.replays - r0.replays) / 2, coloured: +(col / (d.length / 4)).toFixed(3), w: cv.width, h: cv.height };
})()`;
// the pixels that differ between two frames kept, and the first of them
const DIFF = (a, b) => `(() => {
  const A = __pix[${JSON.stringify(a)}], B = __pix[${JSON.stringify(b)}];
  if (!A || !B || A.length !== B.length) return { n: -1 };
  let n = 0, first = null;
  for (let i = 0; i < A.length; i += 4) if (A[i] !== B[i] || A[i + 1] !== B[i + 1] || A[i + 2] !== B[i + 2] || A[i + 3] !== B[i + 3]) { n++; if (!first) first = [i / 4, [...A.slice(i, i + 4)], [...B.slice(i, i + 4)]]; }
  return { n, first };
})()`;
const hold = async (x) => {
  await ev(`__cmwSteps({ x: ${x} }), 1`);
  await settled({ only: true, max: 120000, until: '__cmwSteps().ready.ready' });
  // (the first frames at a place link what they draw with)
  await ev('__cmwTime(1), __cmwTime(1), 1');
};

for (const dpr of [1, 2]) {
  const tag = `dpr ${dpr}`;
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: dpr, mobile: false });
  const ns = `peelreplay${dpr}${Date.now()}`;
  await goOk(`http://localhost:${PORT}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(STATE))}); 1`);
  await goOk(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  const up = await settled({ only: true, max: 60000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
  if (!up.ok) throw new Error(`${tag}: the page hooks are not up: ` + JSON.stringify(up));
  await ev(`__cmwSteps({ scope: 'all', surf: 'plane', glideSheets: false }), __cmwSteps({ go: 1, now: true }), 1`);
  await settled({ only: true, max: 60000, until: '!__cmwSteps().moving && __cmwSteps().ready.ready' });
  for (const u of US) {
    await hold(1 + u);
    const on = await ev(FRAME(`on${u}`, true)), off = await ev(FRAME(`off${u}`, false)), diff = await ev(DIFF(`on${u}`, `off${u}`));
    const glide = await ev('(() => { const g = __cmwSteps().glide; return g && { path: g.path, u: g.u }; })()');
    info[`${tag} u ${u}`] = { on, off, diff, glide };
    ok(`${tag} u ${u} replays: the layered frame captures each mesh once and draws every pass from the captures`, on.layers === 1 && on.captures >= 1 && on.replays >= 3 * on.captures, on);
    ok(`${tag} u ${u} same picture: with the capture and without it, every pixel is the same`, diff.n === 0 && on.layers === 1 && off.layers === 1 && on.coloured >= MIN_COLOURED, { diff, on, off });
    ok(`${tag} u ${u} fallback: without the capture the frame captures nothing and is layered`, off.layers === 1 && off.captures === 0 && off.replays === 0, off);
  }
  if (dpr === 1) {
    const ms = { on: [], off: [] };
    for (let i = 0; i < TIME_REPS; i++) { ms.off.push((await ev(FRAME('toff', false))).ms); ms.on.push((await ev(FRAME('ton', true))).ms); }
    const med = (a) => a.slice().sort((p, q) => p - q)[a.length >> 1];
    info[`${tag} timing`] = { ms, ratio: +(med(ms.on) / med(ms.off)).toFixed(3) };
    ok(`timing: ${tag}, u ½: a frame with the capture takes at most ${TIME_RATIO} of one without it`, med(ms.on) <= TIME_RATIO * med(ms.off), info[`${tag} timing`]);
    // (a lost and restored context: the captures are made again, and the picture is the same as without them)
    await ev('(window.__peelLose = GLR.gl.getExtension("WEBGL_lose_context"), __peelLose.loseContext(), 1)');
    await settled({ max: 10000, only: true, until: '!GLR.ok' });
    await ev('(__peelLose.restoreContext(), 1)');
    await settled({ max: 120000, only: true, until: 'GLR.ok && __cmwSteps().ready.ready === true' });
    await hold(1.5);
    const on = await ev(FRAME('lost-on', true)), off = await ev(FRAME('lost-off', false)), diff = await ev(DIFF('lost-on', 'lost-off'));
    info[`${tag} context`] = { on, off, diff };
    ok(`${tag} context: after a lost and restored context the frame captures again, with the same picture as without it`, on.layers === 1 && on.captures >= 1 && diff.n === 0 && on.coloured >= MIN_COLOURED, info[`${tag} context`]);
  }
}
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

return { pass: fails.length === 0, passed: pass, fails, info };
