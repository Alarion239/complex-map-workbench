// The steps view's Landscape figure with Inside regions: the outline of each region on the floor, thin and grey, kept in the
// export (a vector line, not the white the art layer paints the floor's footprint), cut where the relief stands in front of it
// (as the live pane hides it). With Everywhere the figure has none.
// Built with typeset text.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, results }.
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const VIEW_W = 1440, VIEW_H = 900; // the desktop viewport the figure is built at
const DISC_C = [0.3, 0.2], DISC_R = 1.4; // the disc that crosses the pole of 1/z + z and is cut by z²
const WIDE_R = 2.5; // a disc around 0 whose image is a hole too small in the relief to see the floor through
const SQUARE = 2; // the exponent of z²
const BUILD_MS = 120000, LOAD_MS = 30000, SETTLE_MS = 20000; // deadlines
const NS_MOD = 1e7; // the namespace's range
await view(VIEW_W, VIEW_H, false);
const STATES = {
  jouk2: { v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0,
    shapes: [{ id: 'd1', kind: 'disc', c: DISC_C, r: DISC_R, ci: 0, visible: true }],
    steps: [{ type: 'joukowski', params: {}, on: true }] },
  z2: { v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0,
    shapes: [{ id: 'd1', kind: 'disc', c: DISC_C, r: DISC_R, ci: 0, visible: true }],
    steps: [{ type: 'pown', params: { n: SQUARE }, on: true }, { type: 'affine', params: { a: 'i', b: '0' }, on: true }] },
  jouk: { v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0,
    shapes: [{ id: 'd1', kind: 'disc', c: [0, 0], r: WIDE_R, ci: 0, visible: true }],
    steps: [{ type: 'joukowski', params: {}, on: true }] },
};
await load('slf' + Date.now(), {});
const base = await ev('location.origin');
let ns = 0;
const open = async (scope, st) => {
  const id = 'slf' + Date.now() % NS_MOD + ns++;
  await seed(id, st);
  await go(`${base}/test-mj.html?ns=${id}&view=steps`);
  await settled({ until: 'window.MathJax && typeof MathJax.tex2svg === "function" && !!window.__cmwSteps && !!window.Figure && __cmwSteps().planes.length > 0', max: LOAD_MS });
  await ev(`(__cmwSteps({ surf: 'land', scope: '${scope}' }), __cmwSteps({ go: 1, now: true }), 1)`);
  await settled({ until: '!__cmwSteps().moving', max: SETTLE_MS });
};
const footprints = (svg) => [...svg.matchAll(/<path d="([^"]+)"[^>]*class="floor-footprint"/g)].map((m) => m[1]);
// z², and 1/z + z (Joukowski) on a disc that crosses its pole: a floor point is dropped only where the rendered relief covers its
// pixel, so the outline of the region keeps (nearly) all its vertices wherever the relief does not stand in front of it
const MIN_KEPT = 0.9; // the share of the outline's points the relief may hide
const VERTS = 640; // (the outline's 641 sample points; the limaçon has some behind the funnel's tip)
// z² on this disc is a limaçon whose inner loop the relief partly covers, so the outline must have lost at least one point: a
// regression to "never hide" would keep all of them
const Z2_HIDES_SOME = (verts) => verts < VERTS + 1;
for (const [scope, key] of [['in', 'z2'], ['in', 'jouk'], ['in', 'jouk2'], ['all', 'z2']]) {
  await open(scope, STATES[key]);
  const f = await ev(`await (async () => { const f = await Figure.build({ for: 'article', cols: 2, capInImage: false }); return f && f.svg ? { svg: f.svg } : f; })()`, BUILD_MS);
  if (!f || !f.svg) { ok(`${scope} ${key}: a figure`, false, f); continue; }
  const fp = footprints(f.svg), verts = fp.map((d) => (d.match(/[ML]/g) || []).length);
  if (scope === 'in') ok(`Inside ${key}: the region's outline is one grey floor line that the relief cuts only where it covers it`, fp.length === 1 && verts[0] >= MIN_KEPT * VERTS && (key !== 'z2' || Z2_HIDES_SOME(verts[0])), { verts });
  else ok('Everywhere: no footprint', fp.length === 0, fp.length);
  R[`${scope} ${key}`] = { footprints: fp.length, verts };
}
return { pass: fails.length === 0, fails, results: R };
