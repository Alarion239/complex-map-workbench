// Sound: the click regression, recorded from the APP (notes/sound/DESIGN.md §7.5 and §7.6). Headless Chrome drives
// pointer events over the app's planes (synthetic, at 60 and 240 Hz, ±25 % timing jitter, 2 % main-thread stalls) with
// "Hear the function" on and every cue off (the voice alone; v15.2: on the phase plane the voice is the harp, whose
// strings are logged as scheduled so the detector tells their own attacks from snaps), records the output after the soft clipper
// (test/sound_rec.js), and writes each run to <daemon folder>/rec/<engine>_<case>_<rate>.f32 (+ .json). Cases: the slow
// line, the circle around a zero (z² − 1, Phase), the Height walk on the relief (the Landscape), each at 60 and 240 Hz
// with the AudioWorklet voice and with the native-node fallback; leaving the relief and coming back (120 Hz); then the
// two stop cases of §7.6 at a 6× CPU throttle (Esc while moving, and stopping "Listen along" by moving).
// A command file for a CDP daemon (test/cdp_kit README); then the detector (notes/sound/cdp2/clicks.py):
//   python3 build.py && test/<you>_cdp/q.sh test/sound_clicks_cmd.js && python3 test/sound_clicks.py test/<you>_cdp/rec '*'
// Expect "TOTAL clicks 0", except nodes_landEdge: the fallback's native gate may leave a corner at an onset from
// silence below −50 dB re the local RMS (DESIGN §7.6 counts a snap from −50 dB). Delete test/<you>_cdp/rec afterwards
// (about 25 MB).
const PORT = +(process.env.CMW_PORT || 8832), BASE = `http://localhost:${PORT}/test.html`;
// The kit's load() opens port 8793. This file loads through PORT, so the saved state, the sound settings and every
// nav() share one origin. (With the kit's load(), the 360 px step opened 8793, where sound was never turned on.)
const loadHere = async (ns, st, extra) => {
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await sleep(400);
  const o = Object.assign({ v3: true, v4: true, shapes: [], steps: [], nextId: 50, focus: 0, rightMode: 'image' }, st || {});
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); ${extra || ''}; 1`);
  await send('Page.navigate', { url: `${BASE}?ns=${ns}` }); await sleep(2200);
  return ev(`({cards: __qa.cards(), lamps: __qa.lamps()})`);
};
const OUT = path.join(DIR, 'rec');
fs.mkdirSync(OUT, { recursive: true });
const recSrc = fs.readFileSync(path.join(DIR, '..', 'sound_rec.js'), 'utf8');
const inj = await send('Page.addScriptToEvaluateOnNewDocument', { source: recSrc });
const res = { runs: [], setup: {} };
await view(1440, 900, false, false);
const ns = 'sndclk' + Date.now();
await loadHere(ns, { steps: [{ type: 'custom', params: { expr: 'z^2-1', cut: 180 }, on: true }], srcView: { cx: 0, cy: 0, s: 120 } });
await ev(`__cmwSetMain('phase')`);
await sleep(900);
// a real click in the page (the activation the engine waits for), then sound on with the voice and nothing else
await click(700, 24);
await sleep(200);
res.setup.on = await ev(`Sound.set({ on: true, vol: 0.7, ui: true, events: true, sonify: true }); await new Promise((r) => setTimeout(r, 600)); Sound.state()`);
res.setup.cuesOff = await ev(`(() => { Sound.play = () => false; Sound.turn = () => false; Sound.tick = () => false; return 'cues off'; })()`);
res.setup.rec = await ev(`({ rec: !!__rec.ctx, err: __rec.err })`);
const CASES = {
  slow: { main: 'phase', dur: 4, z: '(u) => [-2 + 4 * u, 0.6]' },
  circleZero: { main: 'phase', dur: 3, z: '(u) => [1 + 0.25 * Math.cos(2 * Math.PI * 4.5 * u), 0.25 * Math.sin(2 * Math.PI * 4.5 * u)]' },
  // the Landscape: a walk on the relief in screen space (the z under it is picked on the surface; the path is checked
  // to stay on the relief, which fills about x 0.35–0.7, y 0.3–0.8 of the pane)
  heightWalk: { main: 'land', dur: 4, s: '(u) => { const t = 4 * u; return [0.52 + 0.1 * Math.sin(0.9 * t) + 0.03 * Math.sin(2.3 * t + 2), 0.55 + 0.12 * Math.sin(1.1 * t + 1) + 0.03 * Math.sin(3.7 * t)]; }' },
  // leaving the relief and coming back, four times: the voice is gated off and on (DESIGN §7.6, "leaving and
  // re-entering"; the fallback's gate is a native target curve, so its onsets keep a small corner)
  landEdge: { main: 'land', dur: 4, s: '(u) => [0.52 + 0.3 * Math.sin(2 * Math.PI * 2 * u), 0.55]' },
};
async function run(tag, name, rate, o) {
  const c = CASES[name] || o;
  const pathSrc = c.z ? `((P) => (u) => __cmwW2S('L', ...P(u)))(${c.z})`
    : `((P) => { const r = document.getElementById('overlayL').getBoundingClientRect(); return (u) => { const [a, b] = P(u); return [r.left + a * r.width, r.top + b * r.height]; }; })(${c.s})`;
  const r = await ev(`await (async () => {
    const path = ${pathSrc};
    await __drive({ sel: '#overlayL', path, rate: 60, dur: 0.25, jitter: 0 });
    await new Promise((r) => setTimeout(r, 250));
    window.__cues = []; Sound.cueHook((t, c) => __cues.push(['cue', t, 0.006, 0]));
    await __rec.start();
    ${c.pre ? `await (${c.pre})();` : ''}
    const before = __cmwSound().play;
    const log = await __drive({ sel: '#overlayL', path, rate: ${rate}, dur: ${c.dur}, jitter: 0.25, stalls: 0.02, seed: ${rate * 7 + name.length}${c.act ? `, act: ${c.act}, actAt: ${c.actAt}` : ''} });
    await new Promise((r) => setTimeout(r, 300));
    const st = await __rec.stop();
    Sound.cueHook(null);
    return { st, n: log.length, log, cues: __cues, engine: Sound.state().engine, played: before, playing: __cmwSound().play };
  })()`, 120000);
  if (!r || !r.st) { res.runs.push({ tag, name, rate, err: r }); return; }
  if (c.main === 'land') r.onRelief = await ev(`(() => { const path = ${pathSrc}; let on = 0; for (let k = 0; k <= 100; k++) if (__cmwSound({ pick: path(k / 100) })) on++; return on; })()`);
  const f = path.join(OUT, `${tag}_${name}_${rate}`);
  const parts = [];
  for (let i = 0; i < r.st.bytes; i += 1 << 20) parts.push(Buffer.from(await ev(`__rec.chunk(${i}, ${1 << 20})`), 'base64'));
  fs.writeFileSync(f + '.f32', Buffer.concat(parts));
  // (the harp's strings and every one-shot, as scheduled: [name, t (s, the context's clock), 0.006, 0]; a detection
  // from 3 ms before to 6 ms after one is that note's own attack, counted apart as "designed")
  fs.writeFileSync(f + '.json', JSON.stringify({ f0: r.st.f0, rate: r.st.rate, log: r.log, cues: r.cues || [] }));
  res.runs.push({ tag, name, rate, notes: (r.cues || []).length, events: r.n, frames: r.st.frames, gaps: r.st.gaps, peak: +r.st.peak.toFixed(4), played: r.played, playingAfter: r.playing, voice: await ev(`__cmwSound().kind + ' ' + __cmwSound().engine`), onRelief: r.onRelief });
}
for (const [tag, worklet] of [['worklet', true], ['nodes', false]]) {
  // a new voice on the engine under test: Hear F off (the voice is released) and on again
  res.setup[tag] = await ev(`Sound.prefer.worklet = ${worklet}; Sound.set({ sonify: false }); Sound.set({ sonify: true }); 1`);
  for (const name of ['slow', 'circleZero', 'heightWalk', 'landEdge']) {
    const want = CASES[name].main;
    if ((await ev(`__cmwView().main`)) !== want) { await ev(`__cmwSetMain('${want}')`); await sleep(1500); }
    for (const rate of name === 'landEdge' ? [120] : [60, 240]) await run(tag, name, rate);
  }
  await ev(`__cmwSetMain('phase')`); await sleep(1000);
  // the stop cases of §7.6, on a main thread slowed 6× (a low-end laptop)
  await send('Emulation.setCPUThrottlingRate', { rate: 6 });
  await run(tag, 'escMove', 120, { dur: 3, z: '(u) => [-1.6 + 3.2 * u, 0.5 + 0.3 * Math.sin(9 * u)]', act: `() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`, actAt: 0.45 });
  // Listen along a loop around no zero (no bells), then move: the pointer ends the playback after 4 px
  await run(tag, 'listenStop', 120, { dur: 3, z: '(u) => [-0.2 + 1.2 * u, 0.8]',
    pre: `async () => { __cmwSound({ listen: Array.from({ length: 120 }, (_, k) => [0.5 * Math.cos(2 * Math.PI * k / 120), 0.5 * Math.sin(2 * Math.PI * k / 120)]) }); await new Promise((r) => setTimeout(r, 900)); }` });
  await send('Emulation.setCPUThrottlingRate', { rate: 1 });
  res.setup[tag + 'Engine'] = await ev(`Sound.state().engine`);
}
await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: inj.identifier });
await ev(`Sound.set({ on: false }); 1`);
res.logs = logs().filter((l) => !/404|Failed to load resource/.test(l.m));
return res;
