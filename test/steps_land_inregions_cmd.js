// The steps view's Landscape with Inside regions (#846, ux's ruling): at rest, the plot's colour only on the carried
// region set, the set the plane's 2D picture colours, and plain paper elsewhere, with the heights kept; between two
// planes the mask moves with the carried points. The default page (z, exp, Möbius; the region |Im z| < π/2):
// - plane z at rest, Inside regions: the mask is 1 at z = 0 and 2 - i (in the strip) and 0 at 3i and -1 - 2.5i (out);
//   plane w₁ = exp z: 1 at 1 + i and 2 (Re w₁ > 0) and 0 at -1 + 0.5i and -2 - 2i;
// - the frame differs from Everywhere's (more than 5 % of the pane's pixels more than 32/255 apart), while Everywhere
//   has no mask;
// - parked at u = 0.5 between z and w₁: a carried frame whose mask is plane z's (1 at 0, 0 at 3i).
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1440, 900, false, false);
const rAF2 = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))';
// the left pane's pixels, kept in the page under tag
const grab = (tag) => ev(`(() => { const cv = document.getElementById('canvasL'); window.__ss = window.__ss || {}; window.__ss[${JSON.stringify(tag)}] = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; return [cv.width, cv.height]; })()`);
// the share of pixels of a more than 32/255 apart from b in a channel (null: different sizes)
const diff = (a, b) => ev(`(() => { const A = window.__ss[${JSON.stringify(a)}], B = window.__ss[${JSON.stringify(b)}]; if (!A || !B || A.length !== B.length) return null; let n = 0, n32 = 0; for (let i = 0; i < A.length; i += 4) { n++; const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2])); if (d > 32) n32++; } return +(n32 / n).toFixed(4); })()`);
const at = (scope, i) => ev(`__cmwSteps({ scope: '${scope}', surf: 'land', go: ${i}, now: true }); 1`).then(() => settled({ max: 60000 })).then(() => ev(rAF2));
const maskAt = (x, y) => ev(`typeof __cmwLandMask === 'function' ? __cmwLandMask(${x}, ${y}) : 'no hook'`);
const near = (v, want) => typeof v === 'number' && Math.abs(v - want) < 0.05;
await go(`http://localhost:${PORT}/test.html?view=steps&ns=landin${Date.now()}`);
await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
// ---- at rest ----
const planes = [
  [0, [[0, 0, 1], [2, -1, 1], [0, 3, 0], [-1, -2.5, 0]]],
  [1, [[1, 1, 1], [2, 0, 1], [-1, 0.5, 0], [-2, -2, 0]]],
];
info.rest = {};
for (const [i, pts] of planes) {
  await at('all', i);
  await grab('all' + i);
  info.rest[i] = { everywhere: await maskAt(0, 0) };
  ok(`plane ${i}, Everywhere: no mask`, info.rest[i].everywhere === null, info.rest[i]);
  await at('in', i);
  await grab('in' + i);
  info.rest[i].got = [];
  for (const [x, y, want] of pts) {
    const v = await maskAt(x, y);
    info.rest[i].got.push([x, y, v]);
    ok(`plane ${i}, Inside regions: the mask at ${x} + ${y}i is ${want}`, near(v, want), v);
  }
  info.rest[i].d = await diff('in' + i, 'all' + i);
  ok(`plane ${i}: Inside regions is another picture than Everywhere (> 5 % of pixels > 32/255)`, info.rest[i].d > 0.05, info.rest[i].d);
}
// ---- between z and w₁ ----
await at('in', 0);
await ev('__cmwSteps({ park: 0.5 }); 1');
await settled({ max: 60000 });
await ev(rAF2);
const c = await ev('JSON.stringify(typeof __cmwLandCarry === "function" ? __cmwLandCarry() : null)');
info.parked = { carry: c, m0: await maskAt(0, 0), m3i: await maskAt(0, 3) };
ok('parked at 0.5: a carried frame of plane z', !!c && JSON.parse(c).s === 0, c);
ok('parked at 0.5: the mask is plane z\'s (1 at 0, 0 at 3i)', near(info.parked.m0, 1) && near(info.parked.m3i, 0), info.parked);
return { pass: fails.length === 0, fails, info };
