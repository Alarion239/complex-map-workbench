// The steps view's Landscape figure with Inside regions: the outline of each region on the floor, thin and grey, kept in the
// export (a vector line, not the white the art layer paints the floor's footprint). With Everywhere the figure has none.
// Built with typeset text.
// A command file for a CDP daemon:  <runner> test/steps_land_footprint_fig_cmd.js
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
await view(1440, 900, false);
const st = { v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0,
  shapes: [{ id: 'd1', kind: 'disc', c: [0.3, 0.2], r: 1.4, ci: 0, visible: true }],
  steps: [{ type: 'pown', params: { n: 2 }, on: true }, { type: 'affine', params: { a: 'i', b: '0' }, on: true }] };
await load('slf' + Date.now(), {});
const base = await ev('location.origin');
let ns = 0;
const open = async (scope) => {
  const id = 'slf' + Date.now() % 1e7 + ns++;
  await seed(id, st);
  await go(`${base}/test-mj.html?ns=${id}&view=steps`);
  await settled({ until: 'window.MathJax && typeof MathJax.tex2svg === "function" && !!window.__cmwSteps && !!window.Figure && __cmwSteps().planes.length > 0', max: 30000 });
  await ev(`(__cmwSteps({ surf: 'land', scope: '${scope}' }), __cmwSteps({ go: 1, now: true }), 1)`);
  await settled({ until: '!__cmwSteps().moving', max: 20000 });
};
const footprints = (svg) => [...svg.matchAll(/<path d="([^"]+)"[^>]*stroke-opacity="0\.35"/g)].map((m) => m[1]);
for (const scope of ['in', 'all']) {
  await open(scope);
  const f = await ev(`await (async () => { const f = await Figure.build({ for: 'article', cols: 2, capInImage: false }); return f && f.svg ? { svg: f.svg } : f; })()`, 120000);
  if (!f || !f.svg) { ok(`${scope}: a figure`, false, f); continue; }
  const fp = footprints(f.svg);
  if (scope === 'in') ok('Inside: the region\'s outline is on the floor as one grey line', fp.length === 1 && (fp[0].match(/L/g) || []).length > 20, fp.map((d) => d.length));
  else ok('Everywhere: no footprint', fp.length === 0, fp.length);
  R[scope] = { footprints: fp.length };
}
return { pass: fails.length === 0, fails, results: R };
