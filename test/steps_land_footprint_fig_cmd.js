// The steps view's Landscape figure with Inside regions: the outline of each region on the floor, thin and grey, kept in the
// export (a vector line, not the white the art layer paints the floor's footprint), cut where the relief stands in front of it
// (as the live pane hides it). With Everywhere the figure has none.
// Built with typeset text.
// A command file for a CDP daemon:  <runner> test/steps_land_footprint_fig_cmd.js
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
await view(1440, 900, false);
const STATES = {
  jouk2: { v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0,
    shapes: [{ id: 'd1', kind: 'disc', c: [0.3, 0.2], r: 1.4, ci: 0, visible: true }],
    steps: [{ type: 'joukowski', params: {}, on: true }] },
  z2: { v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0,
    shapes: [{ id: 'd1', kind: 'disc', c: [0.3, 0.2], r: 1.4, ci: 0, visible: true }],
    steps: [{ type: 'pown', params: { n: 2 }, on: true }, { type: 'affine', params: { a: 'i', b: '0' }, on: true }] },
  jouk: { v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0,
    shapes: [{ id: 'd1', kind: 'disc', c: [0, 0], r: 2.5, ci: 0, visible: true }],
    steps: [{ type: 'joukowski', params: {}, on: true }] },
};
await load('slf' + Date.now(), {});
const base = await ev('location.origin');
let ns = 0;
const open = async (scope, st) => {
  const id = 'slf' + Date.now() % 1e7 + ns++;
  await seed(id, st);
  await go(`${base}/test-mj.html?ns=${id}&view=steps`);
  await settled({ until: 'window.MathJax && typeof MathJax.tex2svg === "function" && !!window.__cmwSteps && !!window.Figure && __cmwSteps().planes.length > 0', max: 30000 });
  await ev(`(__cmwSteps({ surf: 'land', scope: '${scope}' }), __cmwSteps({ go: 1, now: true }), 1)`);
  await settled({ until: '!__cmwSteps().moving', max: 20000 });
};
const footprints = (svg) => [...svg.matchAll(/<path d="([^"]+)"[^>]*class="floor-footprint"/g)].map((m) => m[1]);
// z², and 1/z + z (Joukowski) on a disc that crosses its pole: a floor point is dropped only where the rendered relief covers its
// pixel, so the outline of the region keeps (nearly) all its vertices wherever the relief does not stand in front of it
const MIN_KEPT = 0.9; // the share of the outline's points the relief may hide
const VERTS = 640; // (the outline's 641 sample points; the limaçon has some behind the funnel's tip)
for (const [scope, key] of [['in', 'z2'], ['in', 'jouk'], ['in', 'jouk2'], ['all', 'z2']]) {
  await open(scope, STATES[key]);
  const f = await ev(`await (async () => { const f = await Figure.build({ for: 'article', cols: 2, capInImage: false }); return f && f.svg ? { svg: f.svg } : f; })()`, 120000);
  if (!f || !f.svg) { ok(`${scope} ${key}: a figure`, false, f); continue; }
  const fp = footprints(f.svg), verts = fp.map((d) => (d.match(/[ML]/g) || []).length);
  if (scope === 'in') ok(`Inside ${key}: the region's outline is one grey floor line that the relief cuts only where it covers it`, fp.length === 1 && verts[0] >= MIN_KEPT * VERTS && (key !== 'z2' || verts[0] < VERTS + 1), { verts });
  else ok('Everywhere: no footprint', fp.length === 0, fp.length);
  R[`${scope} ${key}`] = { footprints: fp.length, verts };
}
return { pass: fails.length === 0, fails, results: R };
