// The steps view's globe takes drawing on any plane: on plane k > 0 with the Sphere surface, a Disc drag makes a shape
// of that plane (stage = k); a press on the shape just drawn moves it there, still a shape of plane k. On plane 0 the shape has no stage.
// A command file for a CDP daemon (test/cdp_kit README).
const fails = [], info = {};
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const BASE = `http://localhost:${PORT}`;
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
const quiet = () => settled({
  floor: 300, max: 15000,
  until: "window.__cmwSteps && !__cmwSteps().moving && !(window.__cmwSphere && __cmwSphere().running)",
});
const shapes = async () => ev('__cmwShapes()');
const at = async (x, y) => {
  const o = await ev(`(() => {
    const r = document.getElementById('canvasL').getBoundingClientRect();
    return [r.left, r.top];
  })()`);
  const q = await ev(`__cmwGlobeXY('L', ${x}, ${y})`);
  return q ? [o[0] + q[0], o[1] + q[1]] : null;
};
await view(1200, 800, false, false);
for (const k of [0, 1]) {
  const where = `plane ${k}`;
  const ns = 'svgd' + Date.now();
  await send('Page.navigate', { url: `${BASE}/gl-helpers.html` }); await sleep(350);
  const o = {
    v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, rightMode: 'image', shapes: [],
    steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }],
  };
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
  await send('Page.navigate', { url: `${BASE}/test.html?ns=${ns}&view=steps` });
  const ready = `typeof __cmwSteps === 'function' && typeof __cmwGlobeXY === 'function'`;
  for (let i = 0; i < 40 && !(await ev(ready)); i++) await sleep(250);
  await ev(`__cmwSteps({ go: ${k}, now: true, surf: 'sphere' }); 1`); await quiet();
  await ev(`document.querySelector('#tools .tool[data-tool="disc"]').click(); 1`); await quiet();
  const a = await at(0.3, 0.3), b = await at(0.8, 0.3);
  if (!a || !b) { ok(`${where}: the globe answers a pick`, false, [a, b]); continue; }
  await drag(a[0], a[1], b[0], b[1], 10, 16); await quiet();
  const S1 = await shapes(), d = S1.shapes[0];
  ok(`${where}: a Disc drag draws one shape`,
    S1.shapes.length === 1 && S1.targets.length === 0 && d && d.kind === 'disc', S1);
  ok(`${where}: the shape belongs to the plane it was drawn on`, d && (k === 0 ? !('stage' in d) : d.stage === k), d);
  const hint = await ev(`(document.getElementById('sphereChipL') || { textContent: '' }).textContent`);
  ok(`${where}: no hint says the globe draws in the z-plane only`, !/drawn in the z-plane/.test(hint), hint);
  // a press on the shape just drawn (on its rim) moves it on that plane
  if (d) {
    const c0 = d.c.slice(), rim = await at(c0[0] + d.r, c0[1]), to = await at(c0[0] + d.r + 0.3, c0[1] + 0.2);
    if (rim && to) {
      await drag(rim[0], rim[1], to[0], to[1], 10, 16); await quiet();
      const S2 = await shapes(), e = S2.shapes[0];
      const stageOk = (x) => (k === 0 ? !('stage' in x) : x.stage === k);
      const moved = (a, b) => Math.abs(a - b) > 1e-3;
      const changed = !!e && (moved(e.r, d.r) || moved(e.c[0], c0[0]) || moved(e.c[1], c0[1]));
      ok(`${where}: a press on the rim reshapes the shape of that plane`,
        S2.shapes.length === 1 && e && stageOk(e) && changed, [d, e]);
    }
  }
  // a construction tool picks on this plane too, so the globe says nothing of drawing in the z-plane only
  await ev(`[...document.querySelectorAll('[data-tool="circle3"]')].find((e) => e.offsetParent).click(); 1`);
  await quiet();
  const hintC = await ev(`(document.getElementById('sphereChipL') || { textContent: '' }).textContent`);
  ok(`${where}: a construction tool gets no hint that the globe draws in the z-plane only`,
    !/drawn in the z-plane/.test(hintC), hintC);
}
return { pass: fails.length === 0, fails, info };
