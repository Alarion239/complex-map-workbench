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
//   sheets off, and the logarithm's singular point has its patch (carried.patches).
// - the logarithm mid-glide (u = .25, .5, .75): no hole in the surface, none at the branch point's image seen from above, and the surface covers at least the smaller end's pixels less 5 %
// - at u = 0.998 the surface pixels' colours match the plane at rest within 32/255 (at most 5 % off).
// A command file for a CDP daemon (test/cdp_kit README); prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1440, 900, false, false);
const rAF2 = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))';
const surface = () => ev(`(() => { const cv = document.getElementById('canvasL'); const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0, top = -1; for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) { const i = (y * cv.width + x) * 4; if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > 30) { n++; if (top < 0) top = y; } } return { n, top }; })()`);
// The canvas's pixels kept in the page (key), and the share of the surface pixels (saturation over 30 in either frame) of the
// frame now on the canvas whose channels differ from the kept frame's by more than tol/255.
const keep = (key) => ev(`(() => { const cv = document.getElementById('canvasL'); window.${key} = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; return 1; })()`);
const colourOff = (key, tol) => ev(`(() => { const cv = document.getElementById('canvasL'); const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data, r = window.${key}; const sat = (a, i) => Math.max(a[i], a[i + 1], a[i + 2]) - Math.min(a[i], a[i + 1], a[i + 2]); let n = 0, off = 0; for (let i = 0; i < d.length; i += 4) { if (sat(d, i) <= 30 || sat(r, i) <= 30) continue; n++; if (Math.max(Math.abs(d[i] - r[i]), Math.abs(d[i + 1] - r[i + 1]), Math.abs(d[i + 2] - r[i + 2])) > ${tol}) off++; } return n ? off / n : 0; })()`);
// The background pixels (saturation <= 30, every channel in 200..244: the backdrop and floor, not the dark walls of a
// sheet or the pure white of a drawn outline, which a closed outline would make a group) a flood fill from the frame's
// border cannot reach through background: the surface's holes. Returns the size of the largest such group, and the surface pixel count.
const holes = () => ev(`(() => { const cv = document.getElementById('canvasL'); const W = cv.width, H = cv.height; const d = cv.getContext('2d').getImageData(0, 0, W, H).data; const bg = new Uint8Array(W * H); let n = 0; for (let i = 0; i < W * H; i++) { const k = i * 4; const mx = Math.max(d[k], d[k + 1], d[k + 2]), mn = Math.min(d[k], d[k + 1], d[k + 2]); if (mx - mn <= 30 && mn >= 200 && mx <= 244) bg[i] = 1; else n++; } const seen = new Uint8Array(W * H); const stack = []; const push = (i) => { if (bg[i] && !seen[i]) { seen[i] = 1; stack.push(i); } }; for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); } for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); } while (stack.length) { const i = stack.pop(), x = i % W; if (x > 0) push(i - 1); if (x < W - 1) push(i + 1); if (i >= W) push(i - W); if (i < W * (H - 1)) push(i + W); } let worst = 0; for (let i = 0; i < W * H; i++) { if (!bg[i] || seen[i]) continue; let size = 0; seen[i] = 1; stack.push(i); while (stack.length) { const j = stack.pop(); size++; const x = j % W; for (const q of [x > 0 ? j - 1 : -1, x < W - 1 ? j + 1 : -1, j >= W ? j - W : -1, j < W * (H - 1) ? j + W : -1]) if (q >= 0 && bg[q] && !seen[q]) { seen[q] = 1; stack.push(q); } } if (size > worst) worst = size; } return { n, worst }; })()`);
const ANN = [{ id: 'a1', kind: 'annulus', c: [0, 0], r: 1, r2: 3, visible: true }];
const LOG = [{ type: 'log', params: { cut: 180, k: 0 }, on: true }];
const MOB = [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, { type: 'root', params: { n: 2 }, on: true }];
// (min: the share of the plane's surface pixels the carried frame must have, at u = .002 and, with rest998, at .998; top:
// also the topmost row within 3 px of the plane's; sheets off, the footprint is the baseline of the same chain's All sheets)
const CASES = [
  { name: 'log of an annulus, sheets off', steps: LOG, shapes: ANN, sheets: false, min: 0.95, top: true, rest998: true, patched: true },
  { name: 'log of an annulus, All sheets', steps: LOG, shapes: ANN, sheets: true, min: 0.95, top: true, rest998: true, patched: true },
  { name: 'Möbius, √, sheets off', steps: MOB, shapes: [], sheets: false, min: 0.95, top: true, rest998: true },
  { name: 'Möbius, √, All sheets', steps: MOB, shapes: [], sheets: true, min: 0.95, top: true, rest998: true },
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
    const rest = await surface();
    await keep('__restPx');
    const restTicks = await ev('__cmwLandTicks()');
    await ev(`__cmwSteps({ x: ${x} }); 1`); await settled({ max: 60000 }); await ev(rAF2);
    const carry = await ev('__cmwLandCarry()');
    const got = await surface();
    const gotTicks = await ev('__cmwLandTicks()');
    const off = k !== 0 ? +(await colourOff('__restPx', 32)).toFixed(3) : 0;
    const r = { rest, got, coverage: +(got.n / rest.n).toFixed(3), carried: !!carry, patches: carry && carry.patches, off };
    info[name][tag] = r;
    ok(`${name}, ${tag}: a carried frame`, r.carried, r);
    if (k !== 0) ok(`${name}, ${tag}: the height axis has the plane's labels (as many)`, gotTicks.length === restTicks.length && restTicks.length > 1, { rest: restTicks, got: gotTicks });
    if (c.sheets && k !== 0) ok(`${name}, ${tag}: the sheets' height morphs from the linear function to the parked plane's compressed one`, !!carry && !!carry.morph && carry.morph.a.height === 'imLin' && carry.morph.b.height === 'im' && carry.morph.u > 0.99, r);
    if (k === 0 || c.rest998) {
      ok(`${name}, ${tag}: the carried surface has >= ${c.min * 100} % of the plane's pixels`, r.coverage >= c.min, r);
      if (c.top) ok(`${name}, ${tag}: the topmost row within 3 px of the plane's`, Math.abs(got.top - rest.top) <= 3, r);
    }
    // the landing's colour is the parked frame's: at most 5 % of the surface pixels off by more than 32/255
    if (k !== 0 && c.rest998) ok(`${name}, ${tag}: the surface colour matches the parked frame (share off by > 32/255 <= .05)`, off <= 0.05, r);
    if (k !== 0 && c.patched) ok(`${name}, ${tag}: the logarithm's singular point has its patch`, r.patches >= 1, r);
  }
}
// mid-glide, the logarithm of an annulus (sheets off, All sheets): no hole in the surface (the largest group of background
// pixels the border cannot reach is at most 12 px, the antialiasing's; from above 24, the halo of an axis label drawn over
// the surface, which is a light ring of up to 16 px), in the camera's view and from above, and from above
// at least the smaller end's surface pixels less 5 % (from above the surface's footprint is what is counted: in the camera's
// view the All sheets' stack is taller than either end's, so its pixels are not comparable)
const fromAbove = async (fn) => {
  const cam = JSON.parse(await ev(`JSON.stringify(__cmwCam('L'))`));
  await ev(`__cmwCam('L', { pitch: 1.5 }); 1`); await settled({ max: 60000 }); await ev(rAF2);
  const r = await fn();
  await ev(`__cmwCam('L', { pitch: ${cam.pitch} }); 1`); await settled({ max: 60000 }); await ev(rAF2);
  return r;
};
// The background pixels (the holes' colours) in the square of half-side r canvas px about each pole patch's image
// (__cmwLandPolePx: pane CSS px, scaled to the canvas): the speck a patch with a hole in its middle leaves at a branch point
const speckAtPoles = (r) => ev(`(() => { const cv = document.getElementById('canvasL'), c = cv.getContext('2d'); const pts = __cmwLandPolePx() || []; const k = cv.width / cv.clientWidth; return pts.map((p) => { if (!p) return null; const x0 = Math.round(p[0] * k) - ${r}, y0 = Math.round(p[1] * k) - ${r}, n = 2 * ${r} + 1, d = c.getImageData(x0, y0, n, n).data; let bg = 0; for (let i = 0; i < d.length; i += 4) { const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); if (mx - mn <= 30 && mn >= 200 && mx <= 244) bg++; } return { at: [Math.round(p[0] * k), Math.round(p[1] * k)], bg }; }); })()`);
for (const sheets of [false, true]) {
  const ns = 'landcover' + Date.now();
  await loadView('steps', ns, { shapes: ANN, steps: LOG, sheets, height: 'im' });
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
  await ev(`__cmwSteps({ scope: 'all', surf: 'land', go: 0, now: true, clock: 0 }); 1`);
  await settled({ max: 60000 });
  const last = (await ev('__cmwSteps().planes')).length - 1;
  const ends = [];
  for (const u of [0.002, 0.998]) { await ev(`__cmwSteps({ x: ${last - 1 + u}, now: true }); 1`); await settled({ max: 60000 }); await ev(rAF2); const e = await fromAbove(holes); ends.push(e.n); info[`log end ${sheets} ${u}`] = e; }
  const floor = Math.min(...ends) - 0.05 * Math.max(...ends);
  for (const u of [0.25, 0.5, 0.75]) {
    await ev(`__cmwSteps({ x: ${last - 1 + u}, now: true }); 1`); await settled({ max: 60000 }); await ev(rAF2);
    const h = await holes(), a = await fromAbove(holes);
    info[`log mid ${sheets} ${u}`] = { h, a };
    const name = `log of an annulus, sheets ${sheets ? 'All' : 'off'}, u=${u}`;
    ok(`${name}: no hole in the surface`, h.worst <= 12, h);
    ok(`${name}: no hole in the surface seen from above`, a.worst <= 24, a);
    const sp = await fromAbove(() => speckAtPoles(8));
    info[`log mid ${sheets} ${u} speck`] = sp;
    ok(`${name}: no speck at the branch point's image seen from above (at most 2 background pixels within 8 px)`, sp.length > 0 && sp.every((q) => q && q.bg <= 2), sp);
    ok(`${name}: from above the surface covers at least the ends' pixels less 5 %`, a.n >= floor, { a, ends });
  }
}
// mid-glide, Möbius then √ with All sheets: the height axis keeps several labels (they step in the frame's own scale)
{
  const ns = 'landcover' + Date.now();
  await loadView('steps', ns, { shapes: [], steps: MOB, sheets: true, height: 'im' });
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
  await ev(`__cmwSteps({ scope: 'all', surf: 'land', go: 0, now: true, clock: 0 }); 1`);
  await settled({ max: 60000 });
  const last = (await ev('__cmwSteps().planes')).length - 1;
  for (const u of [0.25, 0.5, 0.75]) {
    await ev(`__cmwSteps({ x: ${last - 1 + u}, now: true }); 1`); await settled({ max: 60000 }); await ev(rAF2);
    const ticks = await ev('__cmwLandTicks()');
    info['mid' + u] = ticks;
    ok(`Möbius, √, All sheets, u=${u}: the height axis has several labels`, ticks.length > 2, ticks);
  }
}
return { pass: !fails.length, fails, info };
