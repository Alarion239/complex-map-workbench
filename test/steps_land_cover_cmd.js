// The carried Landscape reaches the block the carried points can fill. A glide's carried surface is plane s's grid moved
// by the glide's map, plus patches: one about each pole of the map, and about each point where it is singular without
// being a pole (the logarithm at 0, the branch of a root at a pole of its Möbius), which take the surface far out in the
// block that no cell of the grid reaches, and rings over the plane outside the grid. All sheets carry the same patches,
// each sheet at its own height. The glide held at u = 0.002 and 0.998 on three chains, Landscape of Im F, Everywhere, one
// pane and camera (surface pixels: saturation over 30):
// - z³, which has no such point (the control), and every chain at u = 0.002: the carried frame has at least 95 % of the
//   pixels the plane at rest has, its topmost row within 3 px of the plane's;
// - the Logarithm of an annulus and a Möbius step then √ at u = 0.998: the carried points are the image of the plane's
//   principal branch (the log's strip, √'s right half-plane), every sheet over it, so the plane at rest, one surface
//   over the whole window, is not the bound. All sheets then have at least 90 % of the pixels the same chain has with
//   sheets off on its principal sheet alone (__cmwSteps({ glideSheets: 1 }): sheets off, a glide onto a plane coloured
//   by its own variable also draws the other sheets' copies, steps_land_glide_copies), and the logarithm's singular
//   point has its patch (carried.patches).
// - All sheets at u = 0.998: each sheet stands over its own image under the glide's map, as the sheets-off
//   glide's copies do (carried.sheetPlaces), so the frame has at least the sheets-off frame's pixels with its copies.
//   Of the surface pixels of the frame and of the plane it arrives at, parked, the share over 32/255 apart is at most
//   the sheets-off frame's plus ARRIVE_SLACK: the sheets' scale, block and linear height ease into the parked plane's
//   own over the glide, as the sheets-off carry's scale does.
// - The same arrival in a small window about 0 (s = 900, SMALL), where the carried points reach the whole window, so
//   the sheets-off frame is all but the parked plane: All sheets at most its share plus ARRIVE_SLACK. Most of that
//   window is drawn by the carry's far patches, which the sheets' rim must not take for the box's edge. Möbius then √:
//   bare where the parked plane has surface at most BARE_SLACK pixels more often than sheets off. √'s branch point lies
//   outside the carried box (z = i), so it needs a pole patch of its own (svLandBranches), or its far patch's stretched
//   cells leave a hole about w = 0. Its patch reaches as far as the far patch's cells there, which straddle √'s cut out
//   of i and are torn: sheets off at u = .998, coloured from z (T = z, so the carry is from plane z), no point of √'s
//   sector (|arg w| < p pi - EDGE, p from the map at 0, on the cut) within NEAR_0 of 0 is bare. (A patch of the box's
//   cells' size filled only part of that hole: a flap of surface with a bare notch beside it)
// - Mid-glide, the logarithm's branch point: held at u = MID, sheets off, the frame draws the other sheets' copies, each
//   on its own sheet, turned about H_u(0) (the image of 0) from the principal one, so together they reach round it. Each
//   copy draws the patches the principal surface draws, on its combo: the branch point's patch, seamed at the cut, and
//   the far patches. With every copy counted (__cmwLandCover's copies), at most HUB_BARE of the points within HUB_R of
//   H_u(0) are bare, beyond the image of the branch point patch's inner ring (its radius r0 about 0, the patch's hole
//   at the point itself: #1243).
// A command file for a CDP daemon (test/cdp_kit README); prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1440, 900, false, false);
const rAF2 = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))';
// (keep: the frame kept as window.__lcKeep[tag], for apart)
const surface = async (keep) => {
  if (keep) await ev(`window.__lcKeep = window.__lcKeep || {}; window.__lcKeep[${JSON.stringify(keep)}] = (() => { const cv = document.getElementById('canvasL'); return cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; })(); 1`);
  return ev(`(() => { const cv = document.getElementById('canvasL'); const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0, top = -1; for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) { const i = (y * cv.width + x) * 4; if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > 30) { n++; if (top < 0) top = y; } } return { n, top }; })()`);
};
// the share of the surface pixels of the frame now or of the frame kept as tag (saturation over 30) that are over
// 32/255 apart from each other in a channel
const apart = (tag) => ev(`(() => { const cv = document.getElementById('canvasL'); const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data, e = window.__lcKeep[${JSON.stringify(tag)}]; const sat = (a, i) => Math.max(a[i], a[i + 1], a[i + 2]) - Math.min(a[i], a[i + 1], a[i + 2]) > 30; let n = 0, far = 0; for (let i = 0; i < d.length; i += 4) { if (!sat(d, i) && !sat(e, i)) continue; n++; if (Math.max(Math.abs(d[i] - e[i]), Math.abs(d[i + 1] - e[i + 1]), Math.abs(d[i + 2] - e[i + 2])) > 32) far++; } return +(far / Math.max(n, 1)).toFixed(4); })()`);
// the pixels bare (saturation 30 or less) in the kept frame tag where the kept frame ref has surface
const bare = (tag, ref) => ev(`(() => { const A = window.__lcKeep[${JSON.stringify(tag)}], B = window.__lcKeep[${JSON.stringify(ref)}]; const sat = (P, i) => Math.max(P[i], P[i + 1], P[i + 2]) - Math.min(P[i], P[i + 1], P[i + 2]) > 30; let n = 0; for (let i = 0; i < A.length; i += 4) if (sat(B, i) && !sat(A, i)) n++; return n; })()`);
const ANN = [{ id: 'a1', kind: 'annulus', c: [0, 0], r: 1, r2: 3, visible: true }];
const LOG = [{ type: 'log', params: { cut: 180, k: 0 }, on: true }];
const MOB = [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, { type: 'root', params: { n: 2 }, on: true }];
// (min: the share of the plane's surface pixels the carried frame must have, at u = .002 and, with rest998, at .998; top:
// also the topmost row within 3 px of the plane's; sheets off, the footprint is the baseline of the same chain's All
// sheets; arrive: the arrival row against the parked plane)
const ARRIVE_SLACK = 0.05;
const BARE_SLACK = 20;  // the arrival: the pixels All sheets may leave bare beyond the sheets-off frame's
const EDGE = 0.02, NEAR_0 = 0.2;  // √'s sector about w = 0 at the arrival in the small window
const MID = 0.75, HUB_R = 0.5, HUB_BARE = 0.01;  // the logarithm mid-glide: the disc about H_u(0) and its bare share
const CASES = [
  { name: 'log of an annulus, sheets off', steps: LOG, shapes: ANN, sheets: false, min: 0.95, patched: true },
  { name: 'log of an annulus, All sheets', steps: LOG, shapes: ANN, sheets: true, min: 0.95, top: true, base: 'log of an annulus, sheets off', patched: true, arrive: true },
  { name: 'Möbius, √, sheets off', steps: MOB, shapes: [], sheets: false, min: 0.95 },
  { name: 'Möbius, √, All sheets', steps: MOB, shapes: [], sheets: true, min: 0.95, top: true, base: 'Möbius, √, sheets off', arrive: true },
  { name: 'z^3, sheets off', steps: [{ type: 'pown', params: { n: 3 }, on: true }], shapes: [], sheets: false, min: 0.95, top: true, rest998: true },
];
for (const c of CASES) {
  const name = c.name;
  const ns = 'landcover' + Date.now();
  await loadView('steps', ns, { shapes: c.shapes, steps: c.steps, sheets: c.sheets, height: 'im' });
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
  await ev(`__cmwSteps({ scope: 'all', surf: 'land', go: 0, now: true, clock: 0 }); 1`);
  await settled({ max: 60000 });
  const last = (await ev('__cmwSteps().planes')).length - 1;
  info[name] = {};
  for (const [tag, k, x] of [['u=.002', 0, 0.002], ['u=.998', last, last - 0.002]]) {
    await ev(`__cmwSteps({ go: ${k}, now: true }); 1`); await settled({ max: 60000 }); await ev(rAF2);
    const rest = await surface('rest');
    await ev(`__cmwSteps({ x: ${x} }); 1`); await settled({ max: 60000 }); await ev(rAF2);
    const carry = await ev('__cmwLandCarry()');
    const got = await surface();
    // (sheets off: the principal sheet's footprint too, the copies left out)
    let one = null;
    if (!c.sheets) { await ev('__cmwSteps({ glideSheets: 1 }); 1'); await settled({ max: 60000 }); await ev(rAF2); one = await surface(); await ev('__cmwSteps({ glideSheets: 0 }); 1'); await settled({ max: 60000 }); }
    const far = k === last ? await apart('rest') : null;
    const r = { rest, got, one, far, coverage: +(got.n / rest.n).toFixed(3), carried: !!carry, patches: carry && carry.patches, sheetPlaces: !!(carry && carry.sheetPlaces) };
    info[name][tag] = r;
    ok(`${name}, ${tag}: a carried frame`, r.carried, r);
    if (k === 0 || c.rest998) {
      ok(`${name}, ${tag}: the carried surface has >= ${c.min * 100} % of the plane's pixels`, r.coverage >= c.min, r);
      if (c.top) ok(`${name}, ${tag}: the topmost row within 3 px of the plane's`, Math.abs(got.top - rest.top) <= 3, r);
    } else {
      if (c.patched) ok(`${name}, ${tag}: the logarithm's singular point has its patch`, r.patches >= 1, r);
      if (c.base) {
        const b = info[c.base][tag];
        ok(`${name}, ${tag}: >= 90 % of the pixels of ${c.base} on its principal sheet (${b.one.n})`, got.n >= 0.9 * b.one.n, r);
        ok(`${name}, ${tag}: each sheet stands over its own image (carried.sheetPlaces)`, r.sheetPlaces, r);
        ok(`${name}, ${tag}: at least the pixels of ${c.base} with its copies (${b.got.n})`, got.n >= b.got.n, r);
        if (c.arrive) ok(`${name}, ${tag}: at most ${b.far} + ${ARRIVE_SLACK} of the surface pixels apart from the plane it arrives at, parked, as ${c.base}`, r.far <= b.far + ARRIVE_SLACK, r);
      }
    }
  }
}
// the logarithm's branch point mid-glide, sheets off, every copy counted
{
  const ns = 'landcoverhub' + Date.now();
  await loadView('steps', ns, { shapes: ANN, steps: LOG, sheets: false, height: 'im' });
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
  await ev(`__cmwSteps({ scope: 'all', surf: 'land', go: 0, now: true, clock: 0 }); 1`);
  await settled({ max: 60000 });
  await ev(`__cmwSteps({ x: ${MID} }); 1`); await settled({ max: 60000 }); await ev(rAF2);
  const r = info.hub = await evJson(`JSON.stringify((() => {
    const c = __cmwLandCarry(), p = (c.polar || []).find((q) => q.hole), h = __cmwEval('cpuMap', c.map, [[1e-12, 0]])[0];
    const r0 = p ? Math.hypot(...__cmwEval('cpuMap', c.map, [[p[0] + p[2], p[1]]])[0].map((v, i) => v - h[i])) : 0;
    const near = (x, y) => { const d = Math.hypot(x - h[0], y - h[1]); return d > 1.1 * r0 && d < ${HUB_R}; };
    return Object.assign({ h, r0, branch: !!p, copies: c.copies, copyPatches: c.copyPatches, patches: c.patches }, __cmwLandCover(480, 400, true, [], near, true));
  })())`);
  ok(`log of an annulus, sheets off, u = ${MID}: at most ${HUB_BARE} of the points within ${HUB_R} of H_u(0) bare (beyond the branch point patch's inner ring), every sheet's copy counted`, r.branch && r.copies > 0 && r.n > 0 && r.bare <= HUB_BARE * r.n, r);
}
// the arrival in the small window: the frame at u = .998 and the plane it arrives at, parked, sheets off and on
const SMALL = 900;
info.small = {};
for (const [name, steps] of [['Möbius, √', MOB], ['log', LOG]]) {
  const r = info.small[name] = {};
  for (const sheets of [false, true]) {
    const ns = 'landcoversmall' + Date.now();
    await loadView('steps', ns, { shapes: [], steps, sheets, height: 'im', srcView: { cx: 0, cy: 0, s: SMALL } });
    await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
    await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
    await ev(`__cmwSteps({ scope: 'all', surf: 'land', go: 0, now: true, clock: 0 }); 1`);
    await settled({ max: 60000 });
    const last = (await ev('__cmwSteps().planes')).length - 1;
    await ev(`__cmwSteps({ go: ${last}, now: true }); 1`); await settled({ max: 60000 }); await ev(rAF2);
    await surface('rest');
    await ev(`__cmwSteps({ x: ${last - 0.002} }); 1`); await settled({ max: 60000 }); await ev(rAF2);
    const carry = await ev('__cmwLandCarry()');
    await surface('f998');
    r[sheets ? 'on' : 'off'] = { far: await apart('rest'), carried: !!carry, sheetPlaces: !!(carry && carry.sheetPlaces), bare: await bare('f998', 'rest') };
    if (name === 'Möbius, √' && !sheets) {
      // (coloured from z, so the carry is from plane z, where √'s branch point i lies outside the box)
      await ev('__cmwSteps({ T: 0 }); 1'); await ev(`__cmwSteps({ x: ${last - 0.002} }); 1`); await settled({ max: 60000 }); await ev(rAF2);
      r.sector = await evJson(`JSON.stringify((() => {
        const c = __cmwLandCarry(), w = __cmwEval('cpuMap', c.map, [[0, 0]])[0], p = Math.abs(Math.atan2(w[1], w[0])) / Math.PI;
        return Object.assign({ p, s: c.s, polar: (c.polar || []).map((q) => [...q]) }, __cmwLandCover(480, 400, true, [], (x, y) => Math.abs(Math.atan2(y, x)) < p * Math.PI - ${EDGE} && Math.hypot(x, y) < ${NEAR_0}));
      })())`);
      ok(`${name}, s = ${SMALL}, sheets off at u = .998: no point of √'s sector within ${NEAR_0} of 0 is bare`, r.sector.n > 0 && r.sector.bare === 0, r.sector);
    }
  }
  ok(`${name}, s = ${SMALL}, All sheets at u = .998: each sheet over its own image`, r.on.carried && r.on.sheetPlaces, r);
  ok(`${name}, s = ${SMALL}, All sheets at u = .998: at most ${r.off.far} + ${ARRIVE_SLACK} of the surface pixels apart from the plane it arrives at, parked, as sheets off`, r.on.far <= r.off.far + ARRIVE_SLACK, r);
  if (name === 'Möbius, √') {
    ok(`${name}, s = ${SMALL}, All sheets at u = .998: bare where the parked plane has surface no more often than sheets off (+ ${BARE_SLACK} px)`, r.on.bare <= r.off.bare + BARE_SLACK, r);
  }
}
return { pass: !fails.length, fails, info };
