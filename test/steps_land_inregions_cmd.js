// The steps view's Landscape with Inside regions (#846, ux's ruling): at rest, the plot's colour only on the carried
// region set, the set the plane's 2D picture colours, and plain paper elsewhere, with the heights kept; between two
// planes the mask moves with the carried points. The default page (z, exp, Möbius; the region |Im z| < π/2):
// - plane z at rest, Inside regions: the mask is 1 at z = 1 + 0.5i and 2 - i (in the strip) and 0 at 3i and -2 + 2.5i (out);
//   plane w₁ = exp z: 1 at 1 + i and 2 (Re w₁ > 0) and 0 at -1 + 0.5i and -2 - 2i;
// - the frame differs from Everywhere's (more than 5 % of the pane's pixels more than 32/255 apart), while Everywhere
//   has no mask;
// - the surface is cut, not painted plain: at the pixel of a surface point outside the set Inside regions shows the
//   pane's ground (the pixel at the pane's corner, within 15/255), inside the set the same colour as Everywhere's, and the
//   probe there rests on the floor (the point under the pointer is not the surface point), also where the pointer's ray
//   meets the block's front edge;
// - parked at u = 0.25 and 0.5 between z and w₁: more of the pane shows its ground than with Everywhere; at 0.5 a
//   carried frame whose mask is plane z's (1 at 0, 0 at 3i).
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
// the pane position (device px) of the surface point over (x, y), and the colour of tag's frame there
const px = (tag, x, y) => ev(`(() => { const p = __cmwLandSurfacePx(${x}, ${y}), cv = document.getElementById('canvasL'), k = cv.width / cv.getBoundingClientRect().width; if (!p) return null; const i = Math.round(p[0] * k), j = Math.round(p[1] * k), A = window.__ss[${JSON.stringify(tag)}], n = 4 * (j * cv.width + i); return { at: [p[0], p[1]], c: [A[n], A[n + 1], A[n + 2]] }; })()`);
const pickAt = (p) => ev(`(() => { const r = document.getElementById('canvasL').getBoundingClientRect(); return __cmwSound({ pick: [r.left + ${p[0]}, r.top + ${p[1]}] }); })()`);
// the pointer over the page position (x, y): the readout's row labels
const hoverAt = async (x, y) => {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x + 1, y });
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await settled({ max: 20000 });
  await ev(rAF2);
  return JSON.parse(await ev(`JSON.stringify([...document.querySelectorAll('#leftReadout .rk')].map((e) => e.textContent.trim()))`));
};
// the same over the pane position p (CSS px)
const hoverRows = async (p) => {
  const c = JSON.parse(await ev(`JSON.stringify((() => { const r = document.getElementById('canvasL').getBoundingClientRect(); return [r.left + ${p[0]}, r.top + ${p[1]}]; })())`));
  return hoverAt(c[0], c[1]);
};
const gap = (a, b) => Math.max(...a.map((v, k) => Math.abs(v - b[k])));
const TOL = 0.05;   // a mask value, or a plane distance, counts as equal within it
const near = (v, want) => typeof v === 'number' && Math.abs(v - want) < TOL;
await go(`http://localhost:${PORT}/test.html?view=steps&ns=landin${Date.now()}`);
await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
// ---- at rest ----
const planes = [
  [0, [[1, 0.5, 1], [2, -1, 1], [0, 3, 0], [-2, 2.5, 0]]],
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
  // the surface's own pixel at each point, in both frames (Everywhere's frame was grabbed first, with its pick data
  // read here after the Inside frame: the camera and heights are the same)
  info.rest[i].px = [];
  const ground = await ev('(() => Array.from(document.getElementById("canvasL").getContext("2d").getImageData(3, 3, 1, 1).data).slice(0, 3))()');
  for (const [x, y, want] of pts) {
    const a = await px('all' + i, x, y), b = await px('in' + i, x, y);
    info.rest[i].px.push([x, y, a, b]);
    if (!a || !b) { ok(`plane ${i}: the surface pixel at ${x} + ${y}i is on the pane`, false, [a, b]); continue; }
    if (i === 0) {
      // (the readout under the pointer at the surface point: F and |F| where the surface is, z alone where it is cut)
      const labels = await hoverRows(b.at);
      info.rest[i].labels = (info.rest[i].labels || []).concat([[x, y, labels]]);
      ok(`plane ${i}, Inside regions: the readout at ${x} + ${y}i ${want ? 'reads F and |F|' : 'reads z alone (no F, no |F|)'}`, labels.includes('F') === !!want && labels.includes('|F|') === !!want, labels);
      // (the probe under the pointer at the surface point: that point inside the set, the floor behind it outside)
      const z = await pickAt(b.at);
      info.rest[i].pick = (info.rest[i].pick || []).concat([[x, y, z]]);
      const hit = !!z && Math.hypot(z[0] - x, z[1] - y) < TOL;
      ok(`plane ${i}, Inside regions: the probe at the surface point of ${x} + ${y}i ${want ? 'finds it' : 'passes through to the floor'}`, hit === !!want, z);
    }
    if (want) ok(`plane ${i}, Inside regions: inside the set (${x} + ${y}i) the surface keeps Everywhere's colour`, gap(a.c, b.c) <= 40, [a, b]);
    else ok(`plane ${i}, Inside regions: outside the set (${x} + ${y}i) no surface is drawn: the pane's ground shows`, gap(ground, b.c) <= 15, [ground, b]);
  }
  info.rest[i].d = await diff('in' + i, 'all' + i);
  ok(`plane ${i}: Inside regions is another picture than Everywhere (> 5 % of pixels > 32/255)`, info.rest[i].d > 0.05, info.rest[i].d);
}
// ---- the pointer on the floor in front of the block, where its ray meets the block's edge ----
await at('in', 0);
info.edge = await hoverAt(579, 560);
ok('plane z, Inside regions: the pointer on the floor at the block\'s front edge reads z alone', !info.edge.includes('F') && !info.edge.includes('|F|') && info.edge.includes('z'), info.edge);
// ---- between z and w₁ ----
// the share of the pane's pixels within 15/255 of its ground (the corner pixel): the cut part shows the ground
const GROUND_GAIN = 0.02;   // the least share of the pane the cut part gives back to the ground
const groundShare = () => ev(`(() => { const cv = document.getElementById('canvasL'), A = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data, g = [A[12], A[13], A[14]]; let n = 0; for (let i = 0; i < A.length; i += 4) if (Math.max(Math.abs(A[i] - g[0]), Math.abs(A[i + 1] - g[1]), Math.abs(A[i + 2] - g[2])) <= 15) n++; return n / (A.length / 4); })()`);
info.ground = {};
for (const u of [0.25, 0.5]) {
  await at('all', 0);
  await ev(`__cmwSteps({ park: ${u} }); 1`);
  await settled({ max: 60000 });
  await ev(rAF2);
  const everywhere = await groundShare();
  await at('in', 0);
  await ev(`__cmwSteps({ park: ${u} }); 1`);
  await settled({ max: 60000 });
  await ev(rAF2);
  const inside = await groundShare();
  info.ground[u] = { everywhere, inside };
  ok(`parked at ${u}: the part outside the set is not drawn (more of the pane shows its ground than with Everywhere, by 2 % of it)`, inside > everywhere + GROUND_GAIN, info.ground[u]);
}
await at('in', 0);
await ev('__cmwSteps({ park: 0.5 }); 1');
await settled({ max: 60000 });
await ev(rAF2);
const c = await ev('JSON.stringify(typeof __cmwLandCarry === "function" ? __cmwLandCarry() : null)');
info.parked = { carry: c, m0: await maskAt(0, 0), m3i: await maskAt(0, 3) };
ok('parked at 0.5: a carried frame of plane z', !!c && JSON.parse(c).s === 0, c);
ok('parked at 0.5: the mask is plane z\'s (1 at 0, 0 at 3i)', near(info.parked.m0, 1) && near(info.parked.m3i, 0), info.parked);
return { pass: fails.length === 0, fails, info };
