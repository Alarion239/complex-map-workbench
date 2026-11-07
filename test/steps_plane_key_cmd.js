// The steps view's key on each surface, read from the pane's legend (__cmwLegend: kind and caption) with the thread parked at each
// plane of example 1, for each place of T (the colour plane). The pane draws its own key: on a plane up to T the style's key, named
// after the map its colour is read from; on a plane past T the hue ring with the line saying which plane its colour is carried
// from; on the Landscape the height key, whatever T is. The classic views' key under the image (keyUnder) has no steps
// counterpart; this key is what a reader reads a colour by. The key follows T in the frame it moves in.
// A command file for a CDP daemon:  <runner> test/steps_plane_key_cmd.js
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
await view(1440, 900, false);
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await go(`http://localhost:${PORT}/test.html?view=steps&ns=planekey${Date.now() % 1e7}`);
await settled({ until: 'window.MathJax && typeof MathJax.tex2svg === "function" && !!window.__cmwSteps', max: 30000 });
await ev(`(__cmwExample(1), 1)`);
await settled({ until: '__cmwSteps().planes.length > 1', max: 15000 });
await ev(`(__cmwSteps({ surf: 'plane' }), 1)`);
const nPl = await ev('__cmwSteps().planes.length');
const PLANE = ['z', 'w₁', 'w₂'];
const next = () => ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))');
const legend = async () => JSON.parse(await ev('JSON.stringify(__cmwLegend())'));
const park = async (T, i) => {
  await ev(`(__cmwSteps({ T: ${T} }), __cmwSteps({ go: ${i}, now: true }), 1)`);
  await settled({ until: `!__cmwSteps().moving && __cmwSteps().i === ${i}`, max: 15000 });
  return legend();
};
ok('example 1 has three planes', nPl === 3, nPl);
for (const surf of ['plane', 'sphere', 'land']) {
  await ev(`(__cmwSteps({ surf: '${surf}' }), 1)`);
  for (let T = 0; T < nPl; T++) {
    for (let i = 0; i < nPl; i++) {
      const lg = await park(T, i);
      info[`${surf} T ${T} plane ${i}`] = lg;
      const name = `${surf}, T at plane ${T}, plane ${i}`;
      if (surf === 'land') ok(`${name}: the height key`, lg.kind === '3d' && lg.caption === 'height log |F|', lg);
      else if (i > T) ok(`${name}: the hue ring, colour carried from ${PLANE[T]}`, lg.kind === 'color' && lg.caption === `colour carried from ${PLANE[T]}`, lg);
      else ok(`${name}: the style's key, no carried line`, lg.kind === (surf === 'sphere' ? 'sphere' : 'color') && /^arg and \|/.test(lg.caption || ''), lg);
    }
  }
}
// moving T re-reads the key in the frame it moves in (no wait for the thread)
await ev(`(__cmwSteps({ surf: 'plane' }), 1)`);
await park(2, 2);
await ev(`(__cmwSteps({ T: 1 }), 1)`); await next();
const moved = await legend();
ok('plane 2 after T moves from plane 2 to plane 1: the key is already the carried line', moved.caption === 'colour carried from w₁', moved);
await ev(`(__cmwSteps({ T: 2 }), 1)`); await next();
const back = await legend();
ok('and back to T at plane 2: the plane\'s own key', /^arg and \|w₂\|$/.test(back.caption || ''), back);
return { pass: !fails.length, fails, info };
