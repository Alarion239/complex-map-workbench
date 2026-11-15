// Frame times of the deformation range (notes/deform-range/SPEC.md 13.5): a 12-step chain, a pre of 5 heavy steps, a
// range of 2, a post of 5. Plays one after another and all at once in X → Y, Phase and Landscape with Paths on. Gate (BUDGET60, the AS-BUILT bar): p95 <= 18.4 ms and 60 fps at 1440 x 900 and 390 x 844.
// The merged tree before the range (dist/v16m.html, its whole-chain deformation) runs on the same chain for comparison,
// alternating with this build. Not on GeForce NOW; run with the machine otherwise as quiet as it can be. standards-ok: GeForce NOW is a product name
//   <runner> test/deform_range_fps_cmd.js
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const BASE = `http://localhost:${PORT}/`;
const H1 = { type: 'custom', params: { expr: 'erf(z^2)*erf(1/(z+0.3))', cut: 180 }, on: true };
const H2 = { type: 'custom', params: { expr: 'erf(z)+erf(2z)+tan(z)*log(z+2)', cut: 180 }, on: true };
const STEPS = [H1, H2, { type: 'tan', params: {}, on: true }, { type: 'log', params: {}, on: true }, { type: 'exp', params: {}, on: true },
  { type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' }, on: true }, { type: 'pown', params: { n: 2 }, on: true },
  H2, { type: 'tan', params: {}, on: true }, { type: 'log', params: {}, on: true }, H1, { type: 'sin', params: {}, on: true }];
const SHAPES = [{ id: 's1', kind: 'rect', a: [-1.2, -1], b: [1.2, 1] }, { id: 's2', kind: 'cgrid', a: [-1.2, -1], b: [1.2, 1], n: 6 }];
const out = { runs: [] };
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
for (const [w, h, phone] of [[1440, 900, false], [390, 844, true]]) {
  await view(w, h, false, phone);
  await send('Emulation.setUserAgentOverride', phone ? { userAgent: ANDROID, platform: 'Android' } : { userAgent: '' });
  for (const build of ['v16', 'v16m', 'v16']) {
    const ns = `drfps${w}${build}${Date.now()}`;
    await load(ns, { shapes: SHAPES, steps: STEPS, pattern: 'checker', morphPaths: true, srcView: { cx: 0, cy: 0, s: phone ? 60 : 120 } });
    if (build === 'v16m') await nav(`${BASE}v16m.html?ns=${ns}`);
    await sleep(1500);
    for (const main of ['xy', 'phase', 'land']) {
      await ev(`__cmwSetMain('${main}')`); await sleep(700);
      for (const all of [false, true]) {
        await ev(`(() => { __cmwMorph({ open: true, playing: false }); ${build === 'v16' ? '__cmwMorph({ range: { a: 6, b: 7 } });' : ''} const s = document.getElementById('homOrderSel'); if (s && !s.disabled) { s.value = '${all ? 'all' : 'steps'}'; s.dispatchEvent(new Event('change')); } return 1; })()`);
        await sleep(900);
        await ev('__cmwMorph({ T: 0, playing: true })'); await sleep(400);
        const fr = await ev('await (async () => await __qa.frames(2500))()', 30000);
        await ev('__cmwMorph({ playing: false })');
        out.runs.push({ size: `${w}x${h}`, build, main, order: all ? 'all' : 'steps', range: build === 'v16' ? await ev('__cmwState().homView && __cmwState().homView.range') : null, frames: fr });
      }
      await ev('__cmwMorph({ open: false })'); await sleep(300);
    }
  }
}
await send('Emulation.setUserAgentOverride', { userAgent: '' });
await view(1440, 900, false, false);
// the gate: p95 <= 18.4 ms and >= 58 fps for this build's runs
out.gate = out.runs.filter((r) => r.build === 'v16').map((r) => ({ k: `${r.size} ${r.main} ${r.order}`, p95: r.frames.p95, fps: r.frames.fps, ok: r.frames.p95 <= 18.4 && r.frames.fps >= 58 }));
out.pass = out.gate.every((g) => g.ok);
out.load = (await ev('1')) && null;
return out;
