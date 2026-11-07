// The steps view's key on a flat plane: the pane draws its own key, the colour plane's (the style's key) on plane T and, on a
// plane past T, the hue ring with the line saying which plane its colour is carried from. The classic views' key under the
// image (keyUnder) has no steps counterpart; this key is what a reader reads a colour by. Read from the pane's legend
// (__cmwLegend: its kind and caption) with the thread parked at each plane, T at the last plane (every plane coloured by its own
// map) and T = 0 (the later planes carry z's colour).
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
const park = async (T, i) => {
  await ev(`(__cmwSteps({ T: ${T} }), __cmwSteps({ go: ${i}, now: true }), 1)`);
  await settled({ until: `!__cmwSteps().moving && __cmwSteps().i === ${i}`, max: 15000 });
  return JSON.parse(await ev('JSON.stringify(__cmwLegend())'));
};
// (T = 0 is the plane z: the later planes carry z's colour)
const CARRIED = /^colour carried from z$/;
for (const T of [nPl - 1, 0]) {
  for (let i = 0; i < nPl; i++) {
    const lg = await park(T, i);
    info[`T ${T} plane ${i}`] = lg;
    const carried = i > T;
    ok(`T ${T}, plane ${i}: the key ${carried ? 'says where the colour is carried from' : 'is the colour plane\'s own (no carried line)'}`, carried ? CARRIED.test(lg.caption || '') : !/carried/.test(lg.caption || '') && lg.kind === 'color', lg);
  }
}
return { pass: !fails.length, fails, info };
