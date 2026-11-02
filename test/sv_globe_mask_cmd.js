// [#440] The steps view's Inside regions mask lands on the regions' exact boundary, on the globe (the GPU mask, no
// read-back) as on the flat plane: the coloured pixels are the region's points, to within the rim's antialiasing.
// Per scene (one region, plane k of the chain z ↦ z², a surface) the pane is captured Everywhere (B) and Inside regions
// (A). A pixel is masked in when its colour shows (A at least half as saturated as B), out when not; the truth is the
// region's level at the pixel's point (__cmwLeftZ: the globe's pick, or the flat plane's view), pulled back through z²
// on plane 1. Each mismatch is measured from the exact boundary (the nearest pixel of the other truth): within 1 px is
// the rim's antialiasing (#508's "about 900 px" were that ring: the old read-back path ramps its alpha over it, the GPU
// covers it; neither moves the edge); 1 to 3 px from the boundary is a mask that has drifted; further out is the
// globe's own drawing (the equator, the graticule, its silhouette), which crosses no rim. Fails when the drifted pixels
// pass 5 % of the rim's length (+ 10), when the inside more than 10 px from the rim is not coloured, or when a scene
// reads too little; and, the frame drawn while the mask's program links, when it colours outside the regions.
// Needs WebGL. A command file for a CDP daemon.
const fails = [], info = {};
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const BASE = `http://localhost:${PORT}`;
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
const SCENES = [
  ['disc across the equator', { id: 's1', kind: 'disc', c: [0.6, 0.3], r: 0.7, ci: 0, visible: true }, [['sphere', 0], ['sphere', 1], ['plane', 0], ['sphere', 0, 'linking']]],
  ['half-plane', { id: 's1', kind: 'halfplane', a: [0.3, -2], b: [0.3, 2], ci: 0, visible: true }, [['sphere', 0], ['plane', 0]]],
  ['around the pole (|z| > 2)', { id: 's1', kind: 'disc', c: [0, 0], r: 2, complement: true, ci: 0, visible: true }, [['sphere', 0]]],
  ['annulus (a hole)', { id: 's1', kind: 'annulus', c: [-0.2, 0.1], r1: 0.35, r2: 0.9, ci: 0, visible: true }, [['sphere', 0], ['sphere', 1]]],
];
// in the page: A, B (the pane's PNGs), its size, plane k, the region; the mismatches by distance from the boundary
async function measure(a64, b64, W, H, k, shape) {
  const ld = (s) => new Promise((r) => { const im = new Image(); im.onload = () => r(im); im.src = 'data:image/png;base64,' + s; });
  const px = async (s) => { const im = await ld(s), cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'); g.drawImage(im, 0, 0); return g.getImageData(0, 0, W, H).data; };
  const A = await px(a64), B = await px(b64), zs = __cmwLeftZ(0, 0, W, H, 1), lev = Region.levelOf(shape);
  const has = (u) => { try { return lev(u) > 0; } catch (e) { return false; } };
  const inside = (re, im) => {
    if (re == null || !(re === re)) return -1;
    if (k === 0) return has({ re, im }) ? 1 : 0;
    const r = Math.sqrt(Math.hypot(re, im)), t = Math.atan2(im, re) / 2, u = { re: r * Math.cos(t), im: r * Math.sin(t) };
    return has(u) || has({ re: -u.re, im: -u.im }) ? 1 : 0;
  };
  // (the pane's own overlays, the key, the hint, the zoom buttons, the labels: left out)
  const OV = new Uint8Array(W * H), pr = document.getElementById('plotL').getBoundingClientRect();
  for (const el of document.querySelectorAll('#paneL *')) {
    if (el.tagName === 'CANVAS' || !el.getClientRects().length) continue;
    const cs = getComputedStyle(el); if (cs.position !== 'absolute' && cs.position !== 'fixed') continue;
    const b = el.getBoundingClientRect();
    for (let y = Math.max(0, Math.floor(b.top - pr.top) - 2); y < Math.min(H, Math.ceil(b.bottom - pr.top) + 2); y++) for (let x = Math.max(0, Math.floor(b.left - pr.left) - 2); x < Math.min(W, Math.ceil(b.right - pr.left) + 2); x++) OV[y * W + x] = 1;
  }
  const T = new Int8Array(W * H), M = new Int8Array(W * H);
  let valid = 0, inT = 0;
  for (let i = 0; i < W * H; i++) {
    T[i] = inside(zs[2 * i], zs[2 * i + 1]);
    const q = 4 * i, sat = (P) => Math.max(P[q], P[q + 1], P[q + 2]) - Math.min(P[q], P[q + 1], P[q + 2]), sB = sat(B);
    // (where the colour is nearly grey, coloured and paper are not told apart)
    M[i] = T[i] < 0 || sB < 40 || OV[i] ? -1 : sat(A) > 0.5 * sB ? 1 : 0;
    if (M[i] >= 0) { valid++; if (T[i] === 1) inT++; }
  }
  let edge = 0;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; if (T[i] === 1 && (T[i - 1] === 0 || T[i + 1] === 0 || T[i - W] === 0 || T[i + W] === 0)) edge++; }
  const R = 10, spill = [0, 0, 0, 0, 0], short = [0, 0, 0, 0, 0];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (M[i] < 0 || M[i] === T[i]) continue;
    let best = Infinity;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const j = yy * W + xx; if (T[j] >= 0 && T[j] !== T[i]) { const d = Math.hypot(dx, dy); if (d < best) best = d; }
    }
    (M[i] === 1 ? spill : short)[best <= 1 ? 0 : best <= 2 ? 1 : best <= 3 ? 2 : best <= R ? 3 : 4]++;
  }
  return { valid, inT, edge, spill, short };
}
// (#504: the kit's settled() rather than fixed sleeps: the panes' GPU frames done, the steps view still, and the globe's
// region meshes built; a slow runner waits longer instead of capturing a frame before the mask's program links)
const quiet = () => settled({ floor: 300, max: 15000, until: "window.__cmwSteps && !__cmwSteps().moving && !(window.__cmwSphere && __cmwSphere().running)" });
await view(1200, 800, false, false);
for (const [name, shape, runs] of SCENES) for (const [surf, k, linking] of runs) {
  const at = `${name}, ${surf}, plane ${k}${linking ? ', the mask\'s program linking' : ''}`;
  const ns = 'svgm' + Date.now();
  await send('Page.navigate', { url: `${BASE}/gl-helpers.html` }); await sleep(350);
  const o = { v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, rightMode: 'image', shapes: [shape], steps: [{ type: 'pown', params: { n: 2 }, on: true }] };
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
  await send('Page.navigate', { url: `${BASE}/test.html?ns=${ns}&view=steps` });
  for (let i = 0; i < 40 && !(await ev(`typeof __cmwSteps === 'function' && typeof __cmwLeftZ === 'function'`)); i++) await sleep(250);
  // (the regions' outlines left out: they are drawn in the region's colour over the rim, on both pictures, and the
  // suite measures the mask under them)
  await ev(`__cmwHideStrokes(true)`);
  await quiet();
  await ev(`__cmwSteps({ go: ${k}, now: true, surf: '${surf}', scope: 'all' }), 1`); await quiet();
  const rect = await ev(`(() => { const b = document.getElementById('plotL').getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; })()`);
  const clip = { x: rect[0], y: rect[1], width: rect[2], height: rect[3], scale: 1 };
  const shotB = (await send('Page.captureScreenshot', { format: 'png', clip })).data;
  // (linking: the frame drawn while the mask's program links, GLR.keepInAlpha not ready: the regions' globe
  // alone, never the colour over the whole globe)
  await ev(`${linking ? 'GLR.keepInAlpha = () => false; ' : ''}__cmwSteps({ scope: 'in' }), 1`); await quiet();
  const st = await ev(`(() => { const s = __cmwSteps(); return { stage: s.stage, surf: s.surf, scope: s.scope }; })()`);
  ok(`${at}: the view is the scene's`, st.stage === k && st.surf === surf && st.scope === 'in', st);
  const shotA = (await send('Page.captureScreenshot', { format: 'png', clip })).data;
  const r = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(${measure.toString()})(${JSON.stringify(shotA)}, ${JSON.stringify(shotB)}, ${rect[2]}, ${rect[3]}, ${k}, ${JSON.stringify(shape)})` });
  const m = r && r.result && r.result.value;
  info[at] = m || (r && r.exceptionDetails && r.exceptionDetails.exception && r.exceptionDetails.exception.description);
  if (!m) { fails.push(`${at}: not measured: ${String(info[at]).slice(0, 200)}`); continue; }
  // (the globe's own drawing, far from the rim, reads as a few hundred; a globe coloured all over, as every pixel outside)
  if (linking) { const out = m.spill[1] + m.spill[2] + m.spill[3] + m.spill[4], outside = m.valid - m.inT; ok(`${at}: no colour outside the regions (more than 1 px off them: at most 2 % of the pixels outside)`, out <= 0.02 * outside + 10, { spill: m.spill, outside }); continue; }
  ok(`${at}: read enough (10 000 pixels with colour, a rim of 100 or more)`, m.valid >= 10000 && m.edge >= 100, { valid: m.valid, edge: m.edge });
  const drift = m.spill[1] + m.spill[2] + m.short[1] + m.short[2];
  ok(`${at}: the mask's edge is the region's (pixels 1 to 3 px off it: at most 5 % of the rim + 10)`, drift <= 0.05 * m.edge + 10, { drift, edge: m.edge, spill: m.spill, short: m.short });
  ok(`${at}: the inside is coloured (uncoloured more than 10 px inside: at most 1 % of it)`, m.short[4] <= 0.01 * m.inT, { short: m.short, inside: m.inT });
}
return { pass: fails.length === 0, fails: fails.slice(0, 40), info };
