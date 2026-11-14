// P3 review checks that hold in the steps view (notes/sphere-design/SPEC.md 13.16): strokes on a globe are continuous (on
// screen size and at 300 dpi), and a region's pattern is not drawn there (the carried phase colours it). The
// pattern drawn exactly, the two-globe exports and the main thread during them are p3_review_classic_cmd.js's.
// A command file for a CDP daemon (test/cdp_kit README):
//   python3 build.py && test/<you>_cdp/q.sh test/p3_review_cmd.js
// (the daemon's port, as its load() opens it)
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const H = { id: 's1', kind: 'halfplane', a: [0, 0], b: [1, 0] };
const ZI = { type: 'powa', params: { alpha: 'i', cut: 180, k: 0 }, on: true };
const CAY = { type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true };
const settle = async (ms = 2500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
await view(1440, 900, false);
// page helpers (window.__rv): a pane's (or an off-screen render's) pixels; the pick grid of a pane at CSS pixel centres
const RV = `window.__rv = {
  grab(side) { const cv = document.getElementById(side === 'L' ? 'canvasL' : 'canvasR'); const g = document.createElement('canvas'); g.width = cv.width; g.height = cv.height; const x = g.getContext('2d'); x.drawImage(cv, 0, 0); return { D: x.getImageData(0, 0, g.width, g.height).data, W: g.width, H: g.height }; },
  async off(side, d) { const r = document.getElementById(side === 'L' ? 'canvasL' : 'canvasR').getBoundingClientRect(); const img = new Image(); img.src = __cmwRenderOff(side, r.width, r.height, d); await img.decode(); const g = document.createElement('canvas'); g.width = img.width; g.height = img.height; const x = g.getContext('2d'); x.drawImage(img, 0, 0); return { D: x.getImageData(0, 0, g.width, g.height).data, W: g.width, H: g.height }; },
  picks(side) { const r = document.getElementById(side === 'L' ? 'canvasL' : 'canvasR').getBoundingClientRect(); const pick = side === 'L' ? __cmwSphereWL : __cmwSphereW; const Wd = Math.floor(r.width), Hd = Math.floor(r.height), P = new Array(Wd * Hd); for (let y = 0; y < Hd; y++) for (let x = 0; x < Wd; x++) P[y * Wd + x] = pick(x + 0.5, y + 0.5); return { P, Wd, Hd, cw: r.width, ch: r.height }; },
  // the globe's point labels (0, infinity, 1, i, -1, -i), left out 16 px around each
  labels(side) { const r = document.getElementById(side === 'L' ? 'canvasL' : 'canvasR').getBoundingClientRect(); const pc = GLR.camera(__cmwCam(side), r.width, r.height); const proj = (p) => { const q = GLR.M4.apply(pc.MVP, p); return q[3] > 1e-6 ? [(q[0] / q[3] * 0.5 + 0.5) * r.width, (1 - (q[1] / q[3] * 0.5 + 0.5)) * r.height] : null; }; const labs = [[0, 0, 1.1], [0, 0, -1.1], [1.06, 0, 0.1], [0, -1.06, 0.1], [-1.06, 0, 0.1], [0, 1.06, 0.1]].map(proj).filter(Boolean); return (x, y) => labs.some((q) => Math.hypot(q[0] - x, q[1] - y) < 16); },
  hex: (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)),
}; 1`;
// (the helpers live in the page: defined again after every load)
const load0 = load;
load = async (...a) => { const r = await load0(...a); await ev(RV); return r; };

// ---- 1. strokes on a globe are continuous: z^i of the disc |z - (0.3+0.8i)| < 0.3 on the w-globe, its rim seen near
// the globe's edge (pitch -0.9, yaw -1.2). Before the fix the line renderer culled every sub-pixel piece after a
// segment's first one, so where the globe foreshortens a segment into a few px of sub-pixel pieces only round dots
// remained (on screen and in the 300 dpi export). The stroke's pixels within 2.5 CSS px of its exact rim (the class
// change of the picked w) must form ONE connected component reaching every rim point.
// A stroke pixel is one the edge colour covers at least half (P3b, replacing "within 40/255 of the edge colour"): the
// pixel's colour projected on the axis from the casing composite K = 0.85 H + 0.15 U (halo H at the casing's alpha
// over the colour U under it) to the edge colour E, the least over U in {the disc's two fill colours, the half-plane's
// two, the globe} (whatever the casing lies on; U enters K at 15 %, so the choice moves the coverage by < 0.2), with the
// pixel within 24/255 of that mix (an edge-coloured pixel, not the globe's grey silhouette next to it). A correct
// anti-aliased 1.5 px stroke covers its best pixel in every cross-section by 0.75 or more (a 1.5 px band over a 1 px
// grid), so these pixels are 8-connected along it; at dpr 1 no pixel of a stroke centred between two pixel rows is
// within 40/255 of E (its two pixels are 3/4 covered: about 1/4 of |E - K| = 270/255 away), which the old criterion
// read as gaps. A stroke pixel must also be inside what the stroke drew (#287): it differs by more than 8/255 from the
// same frame rendered without the shapes' strokes (__cmwHideStrokes), and so does (by more than 4/255) each of its 8
// neighbours, i.e. it lies within the stroke's casing, not on its border. Without that, the fill next to the casing
// passed as edge colour once the globe is lit from the camera: here a checker cell of the disc's own colour runs along
// the rim inside the stroke, and lit near the limb it is within 24/255 of the edge colour (the old light left that side
// of the globe dark), so the cell's anti-aliased border along the casing counted as extra stroke components.
// The figure p3rv_stroke_dpr1 (shots/) shows the dpr-1 render 8x with both masks.
const DZI = `(w) => { const a = Math.hypot(w[0], w[1]), L = -Math.log(a); if (!(L > -Math.PI && L <= Math.PI)) return -1; const m = Math.exp(Math.atan2(w[1], w[0])), zx = m * Math.cos(-Math.log(a)), zy = m * Math.sin(-Math.log(a)); return Math.hypot(zx - 0.3, zy - 0.8) < 0.3 ? 1 : -1; }`;
await load('p3rvS' + Date.now(), { shapes: [H, { id: 's2', kind: 'disc', c: [0.3, 0.8], r: 0.3 }], steps: [ZI], srcView: { cx: 0, cy: 1, s: 60 }, pattern: 'sphere', alpha: 0.9, lines: true, unit: false });
await ev('__cmwSetView("L", "sphere"); 1'); await settle(3000);
await ev('__cmwCam("L", { pitch: -0.9, yaw: -1.2 }); 1'); await settle(1200);
R.stroke = await ev(`await (async () => {
  const cls = ${DZI}, look = __cmwLook('s2', 'L'), lookH = __cmwLook('s1', 'L'), edge = __rv.hex(look.edge), G = __rv.picks('L'), { P, Wd, Hd } = G;
  const css = getComputedStyle(document.documentElement).getPropertyValue('--halo').trim();
  const halo = /^#[0-9a-f]{6}$/i.test(css) ? __rv.hex(css) : __rv.hex(look.plane);
  const Ks = [look.color, look.color2, lookH.color, lookH.color2, look.plane].map(__rv.hex).map((U) => U.map((u, j) => 0.85 * halo[j] + 0.15 * u));
  // the coverage of the edge colour at a pixel: the least over the casing composites Ks, and the pixel within 24/255
  // (Euclidean) of the anti-aliased mix K + a (E - K) of one of them: an edge-coloured mix, not any dark pixel (the
  // globe's grey silhouette, another stroke or a dark cell project onto the axis too; a true mix is off the line only by
  // the 15 % of U that K gets wrong, a few levels)
  const cover = (D, k) => {
    let a = Infinity, res = Infinity;
    for (const K of Ks) {
      let num = 0, den = 0;
      for (let j = 0; j < 3; j++) { const e = edge[j] - K[j]; num += (D[4 * k + j] - K[j]) * e; den += e * e; }
      const ak = den > 0 ? num / den : 0, ac = Math.max(0, Math.min(1, ak));
      a = Math.min(a, ak);
      res = Math.min(res, Math.hypot(...[0, 1, 2].map((j) => D[4 * k + j] - (K[j] + ac * (edge[j] - K[j])))));
    }
    return res <= 24 ? a : -1;
  };
  const near40 = (D, k) => Math.max(Math.abs(D[4 * k] - edge[0]), Math.abs(D[4 * k + 1] - edge[1]), Math.abs(D[4 * k + 2] - edge[2])) <= 40;
  const C = new Int8Array(Wd * Hd); for (let k = 0; k < Wd * Hd; k++) C[k] = P[k] ? cls(P[k]) : 0;
  // rim points: CSS pixels of the disc image with an outside 4-neighbour (both on the globe)
  const rim = [];
  for (let y = 1; y < Hd - 1; y++) for (let x = 1; x < Wd - 1; x++) { const k = y * Wd + x; if (C[k] !== 1) continue; if ([k - 1, k + 1, k - Wd, k + Wd].some((q) => C[q] === -1)) rim.push([x + 0.5, y + 0.5]); }
  const out = { rimPts: rim.length, runs: [] };
  for (const d of [1, 2, 300 / 96]) {
    const E = await __rv.off('L', d), W = E.W, Hh = E.H, D = E.D;
    // the same frame without the strokes: the pixels inside what the stroke drew (its casing included)
    __cmwHideStrokes(true); const D0 = (await __rv.off('L', d)).D; __cmwHideStrokes(false);
    const chg = new Uint8Array(W * Hh), drew = new Uint8Array(W * Hh);
    for (let k = 0; k < W * Hh; k++) chg[k] = Math.max(Math.abs(D[4 * k] - D0[4 * k]), Math.abs(D[4 * k + 1] - D0[4 * k + 1]), Math.abs(D[4 * k + 2] - D0[4 * k + 2]));
    for (let y = 1; y < Hh - 1; y++) for (let x = 1; x < W - 1; x++) {
      const k = y * W + x;
      if (chg[k] <= 8) continue;
      let all = 1;
      for (let dy = -1; dy <= 1 && all; dy++) for (let dx = -1; dx <= 1; dx++) if (chg[k + dy * W + dx] <= 4) { all = 0; break; }
      drew[k] = all;
    }
    // the band within 2.5 CSS px of a rim point
    const band = new Uint8Array(W * Hh), rb = 2.5 * d;
    for (const [x, y] of rim) { const cx = x * d, cy = y * d; for (let j = Math.max(0, Math.floor(cy - rb)); j <= Math.min(Hh - 1, Math.ceil(cy + rb)); j++) for (let i = Math.max(0, Math.floor(cx - rb)); i <= Math.min(W - 1, Math.ceil(cx + rb)); i++) if (Math.hypot(i + 0.5 - cx, j + 0.5 - cy) <= rb) band[j * W + i] = 1; }
    const M = new Uint8Array(W * Hh), M40 = new Uint8Array(W * Hh);
    for (let k = 0; k < W * Hh; k++) if (band[k]) { if (drew[k] && cover(D, k) >= 0.5) M[k] = 1; if (near40(D, k)) M40[k] = 1; }
    const lab = new Int32Array(W * Hh), sizes = [0];
    for (let k0 = 0; k0 < W * Hh; k0++) {
      if (!M[k0] || lab[k0]) continue;
      const id = sizes.length; sizes.push(0); const st = [k0]; lab[k0] = id;
      while (st.length) { const k = st.pop(); sizes[id]++; const x = k % W, y = (k - x) / W; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= Hh) continue; const q = yy * W + xx; if (M[q] && !lab[q]) { lab[q] = id; st.push(q); } } }
    }
    let big = 0; for (let i = 1; i < sizes.length; i++) if (sizes[i] > sizes[big]) big = i;
    // every rim point has a pixel of the largest component within the band (2.5 CSS px: the strokes sit on a shell
    // 0.4 % above the globe, a px or two off the exact rim near the globe's edge, P4's parallax)
    let reached = 0;
    for (const [x, y] of rim) { const cx = x * d, cy = y * d, r1 = 2.5 * d; let hit = false; for (let j = Math.max(0, Math.floor(cy - r1)); j <= Math.min(Hh - 1, Math.ceil(cy + r1)) && !hit; j++) for (let i = Math.max(0, Math.floor(cx - r1)); i <= Math.min(W - 1, Math.ceil(cx + r1)); i++) if (lab[j * W + i] === big && Math.hypot(i + 0.5 - cx, j + 0.5 - cy) <= r1) { hit = true; break; } if (hit) reached++; }
    // (the old criterion, for the record: components of the pixels within 40/255 of the edge colour)
    const lab40 = new Int32Array(W * Hh); let n40 = 0;
    for (let k0 = 0; k0 < W * Hh; k0++) {
      if (!M40[k0] || lab40[k0]) continue;
      const st = [k0]; lab40[k0] = 1; let sz = 0;
      while (st.length) { const k = st.pop(); sz++; const x = k % W, y = (k - x) / W; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= Hh) continue; const q = yy * W + xx; if (M40[q] && !lab40[q]) { lab40[q] = 1; st.push(q); } } }
      if (sz > 2) n40++;
    }
    out.runs.push({ dpr: +d.toFixed(3), W, H: Hh, comps: sizes.length - 1, compsOver2: sizes.filter((s, i) => i && i !== big && s > 2).length, bigPx: sizes[big], reached, reachedFrac: +(reached / Math.max(1, rim.length)).toFixed(4), old40Comps: n40 });
    // the figure (dpr 1), 8x, as rendered / the old mask / the new mask: around a gap of the old mask (a rim point
    // with no pixel of the old mask within 1.5 px), else the part of the rim nearest the globe's edge
    if (d === 1) {
      const gc = [W / 2, Hh / 2];
      let far = rim[0], fd = -1; for (const r of rim) { const dd = Math.hypot(r[0] - gc[0], r[1] - gc[1]); if (dd > fd) { fd = dd; far = r; } }
      const gap = rim.find(([x, y]) => { for (let j = Math.floor(y - 1.5); j <= Math.ceil(y + 1.5); j++) for (let i = Math.floor(x - 1.5); i <= Math.ceil(x + 1.5); i++) if (i >= 0 && j >= 0 && i < W && j < Hh && M40[j * W + i] && Math.hypot(i + 0.5 - x, j + 0.5 - y) <= 1.5) return false; return true; });
      if (gap) far = gap;
      const cw = 56, chh = 40, x0 = Math.max(0, Math.min(W - cw, Math.round(far[0] - cw / 2))), y0 = Math.max(0, Math.min(Hh - chh, Math.round(far[1] - chh / 2))), Z = 8;
      const fig = document.createElement('canvas'); fig.width = 3 * cw * Z + 2 * 12; fig.height = chh * Z + 28;
      const fx = fig.getContext('2d'); fx.fillStyle = '#fff'; fx.fillRect(0, 0, fig.width, fig.height);
      for (let pnl = 0; pnl < 3; pnl++) for (let j = 0; j < chh; j++) for (let i = 0; i < cw; i++) {
        const k = (y0 + j) * W + x0 + i;
        let c = [D[4 * k], D[4 * k + 1], D[4 * k + 2]];
        if (pnl === 1 && M40[k]) c = [230, 30, 30]; else if (pnl === 2 && M[k]) c = [230, 30, 30]; else if (pnl) c = c.map((v) => 0.35 * v + 0.65 * 255);
        fx.fillStyle = 'rgb(' + c.join(',') + ')'; fx.fillRect(pnl * (cw * Z + 12) + i * Z, 28 + j * Z, Z, Z);
      }
      fx.fillStyle = '#000'; fx.font = '16px sans-serif';
      fx.fillText('dpr 1 render, 8x', 4, 20); fx.fillText('old: within 40/255 of the edge colour', cw * Z + 16, 20); fx.fillText('new: edge coverage >= 0.5', 2 * (cw * Z + 12) + 4, 20);
      window.__rvFig = fig.toDataURL('image/png');
      out.fig = { x0, y0, cw, chh };
    }
  }
  return out;
})()`, 120000);
ok('the stroke measure found the disc\'s rim (the steps view has the one pane, the left)', R.stroke.rimPts > 150, R.stroke);
for (const r of R.stroke.runs || []) ok(`stroke on the w-globe continuous at dpr ${r.dpr}: one component, every rim point reached`, R.stroke.rimPts > 150 && r.compsOver2 === 0 && r.reachedFrac >= 0.995, R.stroke);
await shot('p3rv_stroke');
// the justification figure (see above): shown full-page over the app for one screenshot, then removed
{
  const sz = await ev(`await (async () => { if (!window.__rvFig) return null; const im = document.createElement('img'); im.id = '__rvFigImg'; im.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;background:#fff;max-width:none;image-rendering:pixelated'; im.src = window.__rvFig; document.body.append(im); await im.decode(); return [im.naturalWidth, im.naturalHeight]; })()`);
  if (sz) { await sleep(100); await shot('p3rv_stroke_dpr1', { x: 0, y: 0, width: Math.min(1440, sz[0]), height: Math.min(900, sz[1]) }); await ev(`document.getElementById('__rvFigImg').remove(); 1`); }
}


// ---- 2. a region's own pattern is not drawn in the steps view: H under [z^i, z^2], plane w1 with the Checker
// (a saved state's pattern) is the same picture as with the Solid pattern, the carried phase of the colour plane z
// (its exactness against the pulled-back colour is steps_carry_inregion_cmd.js's), and the region's pixels show more
// than one colour
const base1 = { pattern: 'sphere', alpha: 1, lines: false, unit: false };
await load('p3rvG' + Date.now(), Object.assign({ shapes: [H], steps: [ZI, { type: 'pown', params: { n: 2 }, on: true }], srcView: { cx: 0, cy: 1, s: 60 } }, base1, { pattern: 'checker' }));
await ev('__cmwSteps({ T: 0, go: 2, now: true }); 1'); await settled({ max: 30000, until: '__cmwSteps().i === 2 && !__cmwSteps().moving' });
R.gChk = await ev(`await (async () => {
  // (two animation frames after a change, then until the pane's GL frame is neither pending nor compiling)
  const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const wait = async () => { for (let i = 0; i < 600; i++) { await frames(); const st = __cmwPaneStatus('L'); if (!(st && (st.pending || st.compiling))) { await frames(); return; } } };
  __cmwSet('pattern', 'checker'); await wait();
  const A = __rv.grab('L');
  __cmwSet('pattern', 'solid'); await wait();
  const B = __rv.grab('L');
  let n = 0, bad = 0; const seen = new Set();
  for (let k = 0; k < A.D.length; k += 16) {
    n++; if (Math.max(Math.abs(A.D[k] - B.D[k]), Math.abs(A.D[k + 1] - B.D[k + 1]), Math.abs(A.D[k + 2] - B.D[k + 2])) > 6) bad++;
    seen.add((A.D[k] >> 4) + ',' + (A.D[k + 1] >> 4) + ',' + (A.D[k + 2] >> 4));
  }
  return { n, bad, colours: seen.size, st: (({ i, T }) => ({ i, T }))(__cmwSteps()) };
})()`, 120000);
ok('steps view, plane w1: the Checker pattern draws the same picture as Solid (carried phase, not the pattern)', R.gChk.st.i === 2 && R.gChk.n > 1000 && R.gChk.bad / R.gChk.n <= 1e-3 && R.gChk.colours > 8, R.gChk);


// through the test hook above is the renderer's, which stays)

R.logs = logs().filter((l) => /error|exception/i.test(l.t) && !/404/.test(l.m)).slice(0, 6);
ok('no console errors', R.logs.length === 0, R.logs);
return { pass: fails.length === 0, fails, results: R };

