// Paired frame times: All sheets on in a playing deformation (Landscape), merged build (ta) vs v16 under the same load,
// alternating ta, v16, ta, v16. Also the deformation with All sheets off, and All sheets on at rest.
const BASE = 'http://localhost:9707/';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const RECT = [{ id: 's1', kind: 'rect', a: [-3, -3], b: [3, 3] }];
const CASES = {
  user: { steps: [{ type: 'root', params: { n: 2, cut: 180 }, on: true }, { type: 'sin', params: {}, on: true }], range: { a: 1, b: 1 }, height: 'im' },
  heavy: { steps: [{ type: 'root', params: { n: 3, cut: 180 }, on: true }, { type: 'log', params: { cut: 180, k: 0 }, on: true },
    { type: 'custom', params: { expr: 'erf(z^2)*erf(1/(z+0.3))', cut: 180 }, on: true }, { type: 'sin', params: {}, on: true }], range: null, height: 'log' },
};
const out = { runs: [], errs: [] };
const exc = (l) => l.filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource|404/.test(x.m || ''));
const ONLY = globalThis.__FPS_ONLY || null;
for (const [w, h, phone] of [[1440, 900, false], [390, 844, true]]) {
  await view(w, h, false, phone);
  await send('Emulation.setUserAgentOverride', phone ? { userAgent: ANDROID, platform: 'Android' } : { userAgent: '' });
  for (const [cname, c] of Object.entries(CASES)) {
    if (ONLY && !ONLY.includes(cname)) continue;
    for (const build of ['ta', 'v16', 'ta', 'v16']) {
      const ns = `rrfps${w}${cname}${build}${Date.now()}`;
      await load(ns, { shapes: RECT, steps: c.steps, pattern: 'checker', srcView: { cx: 0, cy: 0, s: phone ? 40 : 60 }, view: { main: 'land' }, sheets: true, height: c.height });
      if (build === 'v16') await nav(`${BASE}v16/test.html?ns=${ns}`);
      await sleep(1500);
      await ev('__cmwSetMain("land")'); await sleep(900);
      const rest = await ev('await (async () => await __qa.frames(1200))()', 30000);
      const restSheets = await ev('typeof __cmwLandSheets === "function" ? JSON.stringify(__cmwLandSheets().drawn) : "n/a"');
      await ev(`__cmwMorph(${JSON.stringify(c.range ? { open: true, playing: false, range: c.range } : { open: true, playing: false })})`); await sleep(1200);
      for (const sheets of [true, false]) {
        await ev(`__cmwSet('sheets', ${sheets})`); await sleep(600);
        await ev('__cmwMorph({ T: 0, playing: true })'); await sleep(400);
        const fr = await ev('await (async () => await __qa.frames(2500))()', 30000);
        const st = await ev('JSON.stringify({ playing: __cmwState().morph.playing, T: __cmwState().morph.T, drawn: typeof __cmwLandSheets === "function" ? __cmwLandSheets().drawn : "n/a" })');
        await ev('__cmwMorph({ playing: false })'); await sleep(200);
        out.runs.push({ size: `${w}x${h}`, case: cname, build, sheets, frames: fr, st });
      }
      out.runs.push({ size: `${w}x${h}`, case: cname, build, rest: true, frames: rest, st: restSheets });
      await ev('__cmwMorph({ open: false })'); await sleep(300);
      const e = exc(await logs());
      if (e.length) out.errs.push({ build, cname, w, e: e.slice(0, 5) });
    }
  }
}
await send('Emulation.setUserAgentOverride', { userAgent: '' });
await view(1440, 900, false, false);
return out;
