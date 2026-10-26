// The Landscape's own render time (renderLeft, GPU finished by a pixel read) while a deformation shows with All sheets
// on, with a new t before each render (so the sheets' transform feedback is redone, as in playback): ta vs v16, paired.
const BASE = 'http://localhost:9707/';
const RECT = [{ id: 's1', kind: 'rect', a: [-3, -3], b: [3, 3] }];
const CASES = {
  user: { steps: [{ type: 'root', params: { n: 2, cut: 180 }, on: true }, { type: 'sin', params: {}, on: true }], range: { a: 1, b: 1 }, height: 'im' },
  heavy: { steps: [{ type: 'root', params: { n: 3, cut: 180 }, on: true }, { type: 'log', params: { cut: 180, k: 0 }, on: true },
    { type: 'custom', params: { expr: 'erf(z^2)*erf(1/(z+0.3))', cut: 180 }, on: true }, { type: 'sin', params: {}, on: true }], range: null, height: 'log' },
};
const out = [];
await view(1440, 900, false, false);
for (const [cname, c] of Object.entries(CASES)) {
  for (const build of ['ta', 'v16', 'ta', 'v16']) {
    const ns = `rrgpu${cname}${build}${Date.now()}`;
    await load(ns, { shapes: RECT, steps: c.steps, pattern: 'checker', srcView: { cx: 0, cy: 0, s: 60 }, view: { main: 'land' }, sheets: true, height: c.height });
    if (build === 'v16') await nav(`${BASE}v16/test.html?ns=${ns}`);
    await sleep(1500);
    await ev('__cmwSetMain("land")'); await sleep(900);
    await ev(`__cmwMorph(${JSON.stringify(c.range ? { open: true, playing: false, range: c.range } : { open: true, playing: false })})`); await sleep(1500);
    for (const sheets of [true, false]) {
      await ev(`__cmwSet('sheets', ${sheets})`); await sleep(800);
      const r = await ev(`(() => { const ts = []; for (let i = 0; i < 24; i++) { __cmwMorph({ T: 0.3 + 0.01 * i }); const t0 = performance.now(); __cmwTime(1); ts.push(performance.now() - t0); } ts.sort((a, b) => a - b); return { p50: +ts[12].toFixed(2), p90: +ts[21].toFixed(2), max: +ts[23].toFixed(2) }; })()`, 60000);
      out.push({ case: cname, build, sheets, wall2renders: r });
    }
    await ev('__cmwMorph({ open: false })'); await sleep(300);
  }
}
return out;
