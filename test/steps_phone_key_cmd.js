// The steps view's per-plane key on a phone (412 x 860, touch): example 1 with the thread parked at each plane and the colour
// plane T at each plane. The legend the phone shows is the laptop's key (__cmwLegend: kind and caption): the style's key on a
// plane up to T, the hue ring with the plane its colour is carried from past T, the height key on the Landscape. On the phone
// the key is a folded glyph on the plane that a tap unfolds into the card (a second tap folds it); the glyph and the card are each whole (inside the
// plane and the screen) and nothing else covers them (the topmost element at the middle and near the four corners (inside the rounded corners) is the key).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
await view(412, 860, false, true);
await go(`http://localhost:${PORT}/test.html?view=steps&ns=phonekey${Date.now() % 1e7}`);
await settled({ until: 'window.MathJax && typeof MathJax.tex2svg === "function" && !!window.__cmwSteps', max: 30000 });
// (a slow runner is still starting up when the first wait ends: wait for the hook the suite calls, as long as it takes)
for (let t0 = Date.now(); Date.now() - t0 < 120000 && !(await ev('typeof __cmwSteps === "function" && typeof __cmwLegend === "function" && typeof __cmwExample === "function"').catch(() => false)); ) await sleep(500);
ok('the phone layout', await ev('!!Phone._state().on'), null);
await ev(`(__cmwExample(1), 1)`);
await settled({ until: '__cmwSteps().planes.length > 1', max: 15000 });
const nPl = await ev('__cmwSteps().planes.length');
const PLANE = ['z', 'w₁', 'w₂'];
const legend = async () => JSON.parse(await ev('JSON.stringify(__cmwLegend())'));
const park = async (T, i) => {
  await ev(`(__cmwSteps({ T: ${T} }), __cmwSteps({ go: ${i}, now: true }), 1)`);
  await settled({ until: `!__cmwSteps().moving && __cmwSteps().i === ${i}`, max: 15000 });
};
// the key element's rect, its plane's rect, the screen, and what is on top at its middle and corners
const probe = () => ev(`(() => {
  const k = document.getElementById('leftLegend'), p = document.getElementById('plotL');
  if (!k || !p || !k.getClientRects().length) return { shown: false };
  const b = k.getBoundingClientRect(), q = p.getBoundingClientRect();
  const pts = [[0.5, 0.5], [0.15, 0.15], [0.85, 0.15], [0.15, 0.85], [0.85, 0.85]].map(([fx, fy]) => { const e = document.elementFromPoint(b.left + fx * b.width, b.top + fy * b.height); return !!e && (e === k || k.contains(e)) ? '' : (e ? (e.id || e.className || e.tagName) + '' : 'none'); });
  const r = (x) => Math.round(x * 10) / 10;
  return { shown: true, collapsed: k.classList.contains('collapsed'), open: k.classList.contains('open'), w: r(b.width), h: r(b.height),
    inPlane: b.left >= q.left - 0.5 && b.right <= q.right + 0.5 && b.top >= q.top - 0.5 && b.bottom <= q.bottom + 0.5,
    onScreen: b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight, top: pts, vw: innerWidth };
})()`);
ok('example 1 has three planes', nPl === 3, nPl);
for (const surf of ['plane', 'sphere', 'land']) {
  await ev(`(__cmwSteps({ surf: '${surf}' }), 1)`);
  for (let T = 0; T < nPl; T++) {
    for (let i = 0; i < nPl; i++) {
      await park(T, i);
      const name = `${surf}, T at plane ${T}, plane ${i}`;
      const lg = await legend(), pr = await probe();
      info[name] = { lg, pr };
      if (surf === 'land') ok(`${name}: the height key`, lg.kind === '3d' && lg.caption === 'height log |F|', lg);
      else if (i > T) ok(`${name}: the hue ring, colour carried from ${PLANE[T]}`, lg.kind === 'color' && lg.caption === `colour carried from ${PLANE[T]}`, lg);
      else ok(`${name}: the style's key, no carried line`, lg.kind === (surf === 'sphere' ? 'sphere' : 'color') && /^arg and \|/.test(lg.caption || ''), lg);
      ok(`${name}: the folded key shows on the phone, whole, and nothing covers it`, pr.shown && pr.collapsed && pr.inPlane && pr.onScreen && pr.top.every((t) => t === ''), pr);
      // (a tap unfolds the card: it is as whole and as uncovered as the glyph, and larger than it)
      await ev(`(document.getElementById('leftLegend').click(), 1)`);
      await sleep(150);
      const un = await probe();
      info[name].unfolded = un;
      ok(`${name}: the unfolded card is shown, whole, and nothing covers it`, un.shown && !un.collapsed && un.w > pr.w && un.inPlane && un.onScreen && un.top.every((t) => t === ''), un);
      await ev(`(document.getElementById('leftLegend').click(), 1)`);
    }
  }
}
return { pass: !fails.length, fails, info };
