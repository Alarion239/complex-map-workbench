// The steps view's Landscape glide over a multivalued step draws every sheet, as the plane it arrives at does: the
// glide's frames are the copies of the carried surface, one per sheet combo of the steps the glide crosses, each placed
// by the glide's map continued on its combo, at its heights and in its colour on it (svGlideSheets, GLR.drawLandscape's
// carry.copies). The copies fade in over the glide: none leaving plane a, as plane a parked with All sheets off shows
// the principal sheet alone, and whole from u = 1/2 on (alpha smoothstep(0, 1/2, u)). The Landscape, Everywhere, Im
// heights, the colour plane the last plane (so the plane a glide arrives at is coloured by its own variable), the
// pane's words off (held_frames.js wordsOff). Square root alone (from plane z) and z³ − 3z then square root (from
// plane w₁: the cubic's step is before the carry's source and has no copy), the glide onto the square root's plane at
// u = NEAR, 1/2 and 1 − NEAR, each frame drawn as it is and with the principal combo alone
// (__cmwSteps({ glideSheets: 1 }), the K = 1 control):
// - every frame between the planes draws one copy, the root's other sheet, and the control none;
// - departure, u = NEAR: the frame is plane a parked (All sheets off), at most END_FRAC of its pixels apart;
// - the copies' alpha (carried.copyAlpha) is under ALPHA_NEAR at u = NEAR, 1 from u = 1/2 on, and never falls as u
//   grows (u = 0.05, 0.1, ..., 0.95);
// - at u = 1/4 (alpha 1/2), where the copy shows, the frame is the half-and-half blend of the same frame with the
//   copies opaque (__cmwSteps({ glideFade: 1 })) and without them (glideFade: 0): a pixel blends once, also where a
//   copy folds over itself or its seam's surface lies on it (every translucent copy's depth is drawn first, then each
//   one's colour with LEQUAL and a stencil of one blend a pixel). At most BLEND_SHARE of those pixels more than
//   BLEND_TOL from the blend;
// - arrival, u = 1 − NEAR: the frame is plane b parked, at most END_FRAC of its pixels more than DIFF_TOL apart
//   (held_frames.js), and the control at least MISS further from it
//   (the other sheet's half of the relief is missing). The view is a small window about 0 (S.srcView.s = SCALE), which
//   the square root maps onto a disc that covers it: the carried points reach the whole of plane b's window.
// - the seam where the two sheets meet: every surface drawn tears along the image of the cut, so each is drawn again
//   with the cut turned half a turn (svGlideSeams), continuous there. At u = 1/2 and 1 − NEAR, against the same frame
//   without those surfaces (the control, __cmwSteps({ glideSeams: 0 })): the seams leave at most SEAM_GAP pixels bare
//   that the control covers, and the control leaves at least SLIT_MIN bare where the frame with them has surface
//   (the slit);
//   at 1 − NEAR, against plane b parked, the frame is bare at most GAP_SHARE as often as the control (the rest: the
//   surface's outer edge, a pixel apart); where the control's surface is plane b's colour (within OVER_TOL), the
//   frame is too, at all but OVER_MAX pixels: the seams fill the slit and draw nothing over the surfaces about it (a
//   translucent band down the cut's image where their triangles come out in front); and the control shades at most
//   SHADE_MAX pixels of the surface darker than plane b parked (the occlusion reads only the heights on a vertex's own
//   piece: across the cut's image the other sheet's would shade the surface beside it);
// - at rest, plane z with the square root's colours, Im heights: beside the cut each piece is shaded as a little off it
//   (REST_SHADE), the lower piece measured and the upper one the control;
// - Inside regions, an annulus about 0 under the square root: plane w parked shows the principal sheet's image of the
//   region, and so does the glide onto it: no copy at u = 1/2 and 1 − NEAR.
// - the page's own heights (log |F|) and window, square root alone: leaving plane z the other sheet has the principal's
//   modulus, so its copy lies in the principal surface's place on triangles of its own. Held at u = NEAR, 0.02, 0.05
//   and 0.15, the frame and the control (the principal combo alone) differ in at most SPECKLE isolated pixels (over
//   SPECKLE_TOL in a channel, with at most two of their eight neighbours so): the principal surface is the one shown
//   where they coincide, where a tie in depth speckled the whole surface with the copy's colours. (Where the copy
//   slides out of it, near the cut, the two differ in whole wedges, which have few isolated pixels)
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const { grab, compare, wordsOff } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const NEAR = 1e-4;                    // the glide's places near its ends: u and 1 − u
const END_FRAC = 0.01;                // the share of pixels a frame near an end may differ from that end's plane
const MISS = 0.03;                    // how much further from it the control is, at least
const ALPHA_NEAR = 0.01;              // the copies' alpha leaving plane a, at most
const BLEND_TOL = 24;                 // u = 1/4: a pixel's distance (0..255 a channel) from the blend it should be
const BLEND_SHARE = 0.002;            // u = 1/4: the share of the copy's pixels that may be further from it (edges)
const COPY_SHOWS = 48;                // u = 1/4: the copy shows where the frames with and without it differ by more
const SEAM_GAP = 20;                  // the pixels the seams' surfaces may leave bare that the frame without them covers (edges)
const GAP_SHARE = 0.25;               // arrival: the share of the control's bare pixels (against the parked plane) the seams may leave
const SLIT_MIN = 200;                 // the slit the control leaves along the seam, at least
const OVER_MAX = 20;                  // arrival: the pixels the seams' surfaces may draw over the other surfaces
const OVER_TOL = 8;                   // a pixel counts more than this apart in a channel (the band is translucent, under DIFF_TOL)
const SHADE_TOL = 8;                  // arrival: a pixel is shaded when it is darker than plane b parked by more, in every channel
const SHADE_MAX = 1000;               // arrival, without the seams: the shaded pixels, at most (the carried mesh's own shading)
const REST_SHADE = 8;                 // at rest: the median darkening beside the cut, at most (0..255, the channels' mean)
const SCALE = 900;                    // px per unit: a window of about ±0.5, inside the disc its square root covers
const SPECKLE = 40, SPECKLE_TOL = 24; // log |F| heights: the isolated pixels the frame and the control may differ in, and by how much
const READY = 'typeof __cmwSteps === "function" && !!window.GLR';
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const step = (type, params) => ({ type, params: params || {}, on: true });
const ROOT = step('root', { n: 2, cut: 180 }), CUBIC = step('custom', { expr: 'z^3-3z', cut: 180 });
await view(1440, 900, false, false);
// SAT: a surface pixel's saturation (max − min channel) is over it, as steps_land_cover counts them; floor and paper
// are grey
const SAT = 30;
// (the Landscape's surface pixels: saturation over SAT)
const surface = () => ev(`(() => { const cv = document.getElementById('canvasL'); const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > ${SAT}) n++; return n; })()`);
// the pixels bare (saturation SAT or less: floor or paper) in the kept frame tag where the kept frame ref shows
// surface: n; reverse: the other way round
const gap = (tag, ref) => ev(`(() => { const A = window.__heldPx[${JSON.stringify(tag)}], B = window.__heldPx[${JSON.stringify(ref)}]; const sat = (P, i) => Math.max(P[i], P[i + 1], P[i + 2]) - Math.min(P[i], P[i + 1], P[i + 2]) > ${SAT}; const W = document.getElementById('canvasL').width; let n = 0, reverse = 0, x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1; for (let i = 0; i < A.length; i += 4) { const a = sat(A, i), b = sat(B, i); if (b && !a) { n++; const p = i / 4, x = p % W, y = (p - x) / W; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } if (a && !b) reverse++; } return { n, reverse, box: n ? [x0, x1, y0, y1] : null }; })()`);
// the pixels where the kept frame ctrl shows surface within OVER_TOL of the kept frame ref in every channel and the
// kept frame tag is more than OVER_TOL from it in one (what tag draws over ctrl's surface), and their box
const over = (tag, ctrl, ref) => ev(`(() => { const A = window.__heldPx[${JSON.stringify(tag)}], C = window.__heldPx[${JSON.stringify(ctrl)}], R = window.__heldPx[${JSON.stringify(ref)}]; const W = document.getElementById('canvasL').width; const far = (P, i) => Math.max(Math.abs(P[i] - R[i]), Math.abs(P[i + 1] - R[i + 1]), Math.abs(P[i + 2] - R[i + 2])) > ${OVER_TOL}; let n = 0, x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1; for (let i = 0; i < A.length; i += 4) { if (Math.max(C[i], C[i + 1], C[i + 2]) - Math.min(C[i], C[i + 1], C[i + 2]) <= ${SAT} || far(C, i) || !far(A, i)) continue; n++; const p = i / 4, x = p % W, y = (p - x) / W; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return { n, box: n ? [x0, x1, y0, y1] : null }; })()`);
// the pixels of the kept frame tag darker than the kept frame ref by more than SHADE_TOL in every channel, where both
// show surface (saturation over SAT), and their box
const shaded = (tag, ref) => ev(`(() => { const A = window.__heldPx[${JSON.stringify(tag)}], B = window.__heldPx[${JSON.stringify(ref)}]; const sat = (P, i) => Math.max(P[i], P[i + 1], P[i + 2]) - Math.min(P[i], P[i + 1], P[i + 2]) > ${SAT}; const W = document.getElementById('canvasL').width; let n = 0, x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1; for (let i = 0; i < A.length; i += 4) { if (!sat(A, i) || !sat(B, i) || !(A[i] < B[i] - ${SHADE_TOL} && A[i + 1] < B[i + 1] - ${SHADE_TOL} && A[i + 2] < B[i + 2] - ${SHADE_TOL})) continue; n++; const p = i / 4, x = p % W, y = (p - x) / W; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return { n, box: n ? [x0, x1, y0, y1] : null }; })()`);
const carried = async () => JSON.parse(await ev('JSON.stringify((({ u, s, copies, copyAlpha }) => ({ u, s, copies, copyAlpha }))(__cmwLandCarry() || {}))'));
// where the kept frames A and P differ (a copy shows, over COPY_SHOWS in a channel): the share of those pixels of the
// kept frame F more than BLEND_TOL from (A + P) / 2
const blend = (F, A, P) => ev(`(() => { const f = window.__heldPx[${JSON.stringify(F)}], a = window.__heldPx[${JSON.stringify(A)}], p = window.__heldPx[${JSON.stringify(P)}]; let n = 0, far = 0; for (let i = 0; i < f.length; i += 4) { let d = 0, e = 0; for (let c = 0; c < 3; c++) { d = Math.max(d, Math.abs(a[i + c] - p[i + c])); e = Math.max(e, Math.abs(f[i + c] - (a[i + c] + p[i + c]) / 2)); } if (d <= ${COPY_SHOWS}) continue; n++; if (e > ${BLEND_TOL}) far++; } return { n, far, share: n ? far / n : null }; })()`);
// the chain steps on the Landscape (All sheets: sheets), Im heights, parked on plane k
const open = async (steps, sheets, k) => {
  await loadView('steps', 'landcopies' + Date.now(), { shapes: [], steps, sheets, srcView: { cx: 0, cy: 0, s: SCALE } });
  await settled({ max: 30000, until: READY });
  await wordsOff();
  await ev(`__cmwSet('lines', false); __cmwSet('morphPaths', false); __cmwHideStrokes(true); __cmwSteps({ scope: 'all', surf: 'land', go: ${k}, now: true }); 1`);
  await settled({ max: 60000 });
  await ev(`(document.querySelector('#heightSeg button[data-v="im"]') || {}).click?.(), 1`);
  await ev(`__cmwSteps({ go: ${k}, now: true }); 1`);
  await settled({ max: 60000 });
};
// the glide held at x with the copies drawn as they are (k 0) or the principal combo alone (k 1): its frame held as tag
const at = async (x, k, tag) => {
  await ev(`__cmwSteps({ glideSheets: ${k}, x: ${x} }); 1`);
  await settled({ max: 60000 });
  ok(`${tag}: the frame is still`, await grab(tag), null);
  return Object.assign(await carried(), { surface: await surface() });
};
for (const [name, steps] of [['square root', [ROOT]], ['z³ − 3z then square root', [CUBIC, ROOT]]]) {
  const r = info[name] = {}, b = steps.length, a = b - 1;
  // plane b parked, then plane a (All sheets off)
  await open(steps, false, b);
  ok(`${name}: plane ${b} parked is still`, await grab('pb'), null);
  await ev(`__cmwSteps({ go: ${a}, now: true }); 1`);
  await settled({ max: 60000 });
  ok(`${name}: plane ${a} parked is still`, await grab('pa'), null);
  for (const u of [NEAR, 0.5, 1 - NEAR]) {
    const all = await at(a + u, 0, `u${u}`);
    const one = await at(a + u, 1, `k${u}`);
    r[`u ${u}`] = { all, one };
    ok(`${name}, u = ${u}: a carried frame from plane ${a} with the other sheet's copy and the two surfaces' seams`, all.s === a && all.copies === 3, all);
    ok(`${name}, u = ${u}: with the principal combo alone (K = 1) no copy is drawn`, one.s === a && one.copies === 0, one);
  }
  const dep = r.departure = await compare(`u${NEAR}`, 'pa');
  ok(`${name}, u = ${NEAR}: the frame is plane ${a} parked (within ${END_FRAC})`, !!dep && dep.frac <= END_FRAC, dep);
  ok(`${name}, u = ${NEAR}: the copies' alpha is under ${ALPHA_NEAR}`, r[`u ${NEAR}`].all.copyAlpha < ALPHA_NEAR, r[`u ${NEAR}`].all);
  ok(`${name}, u = 0.5: the copies are whole (alpha 1)`, r['u 0.5'].all.copyAlpha === 1, r['u 0.5'].all);
  // the alpha over the glide
  const al = r.alpha = [];
  for (let k = 1; k < 20; k++) { await ev(`__cmwSteps({ glideSheets: 0, x: ${a + k / 20} }); 1`); await settled({ max: 60000 }); al.push((await carried()).copyAlpha); }
  ok(`${name}: the copies' alpha never falls from u = 0.05 to 0.95, and is 1 from u = 0.5 on`, al.every((v, k) => typeof v === 'number' && (k === 0 || v >= al[k - 1]) && (k < 9 || v === 1)), al);
  // one blend where the copy shows, at u = 1/4
  await at(a + 0.25, 0, 'f25');
  await ev('__cmwSteps({ glideFade: 1 }); 1'); await at(a + 0.25, 0, 'a25');
  await ev('__cmwSteps({ glideFade: 0 }); 1'); await at(a + 0.25, 0, 'p25');
  await ev('__cmwSteps({ glideFade: null }); 1');
  const bl = r.blend = await blend('f25', 'a25', 'p25');
  ok(`${name}, u = 0.25: where the copy shows, the frame is the half-and-half blend of it opaque and of none (at most ${BLEND_SHARE} over ${BLEND_TOL} apart)`, bl.n > 1000 && bl.share <= BLEND_SHARE, bl);
  const arr = r.arrival = { all: await compare(`u${1 - NEAR}`, 'pb'), one: await compare(`k${1 - NEAR}`, 'pb') };
  ok(`${name}, u = ${1 - NEAR}: the frame is plane ${b} parked (within ${END_FRAC})`, !!arr.all && arr.all.frac <= END_FRAC, arr);
  ok(`${name}, u = ${1 - NEAR}: the control is at least ${MISS} further from it`, !!arr.all && !!arr.one && arr.one.frac >= arr.all.frac + MISS, arr);
  // the seam: no gap where the two sheets meet, at u = 1/2 and 1 − NEAR, against the frame without the seams' surfaces
  for (const u of [0.5, 1 - NEAR]) {
    await ev('__cmwSteps({ glideSeams: 0 }); 1');
    await at(a + u, 0, `ns${u}`);
    await ev('__cmwSteps({ glideSeams: 1 }); 1');
    await at(a + u, 0, `s${u}`);
    const g = r[`seam ${u}`] = { seams: await gap(`s${u}`, 'pb'), none: await gap(`ns${u}`, 'pb'), slit: await gap(`ns${u}`, `s${u}`) };
    ok(`${name}, u = ${u}: the seams' surfaces only add surface (at most ${SEAM_GAP} px bare that the frame without them covers)`, g.slit.reverse <= SEAM_GAP, g);
    ok(`${name}, u = ${u}: the control, without them: the slit along the seam, at least ${SLIT_MIN} px bare where the frame with them has surface`, g.slit.n >= SLIT_MIN, g);
    if (u !== 0.5) {
      ok(`${name}, u = ${u}: against plane ${b} parked, the frame with the seams is bare at most ${GAP_SHARE} as often as without them`, g.seams.n <= GAP_SHARE * g.none.n, g);
      g.over = await over(`s${u}`, `ns${u}`, 'pb');
      ok(`${name}, u = ${u}: the seams' surfaces draw over at most ${OVER_MAX} px where the frame without them is plane ${b} parked`, g.over.n <= OVER_MAX, g.over);
      g.shaded = await shaded(`ns${u}`, 'pb');
      ok(`${name}, u = ${u}: without the seams, at most ${SHADE_MAX} px of the surface are shaded darker than plane ${b} parked (more than ${SHADE_TOL} in every channel)`, g.shaded.n <= SHADE_MAX, g.shaded);
    }
  }
  await ev('__cmwSteps({ glideSeams: 1 }); 1');
  await ev('__cmwSteps({ glideSheets: 0 }); 1');
}
// ---- At rest, plane z with the square root's colours (Im √z, torn along the cut): the shading beside the cut ----
// Across the negative real axis ∂(Im √z)/∂y is 0 (√z is imaginary there), so each piece's slope, and its shading, is the
// same just beside the cut (y = ±REST_NEAR) as a little further off (±REST_FAR). The median over Re z of how much darker
// the surface is beside it (the channels' mean) is at most REST_SHADE on the lower piece; the upper piece is the
// control. (The shading's occlusion reads the heights about a vertex only on its own piece: across the cut, the upper
// piece's would shade the lower piece's edge)
{
  const REST_NEAR = 0.005, REST_FAR = 0.05, r = info.rest = {};
  await open([ROOT], false, 0);
  const side = async (s) => JSON.parse(await ev(`(() => { const cv = document.getElementById('canvasL'), k = cv.width / cv.getBoundingClientRect().width, g = cv.getContext('2d');
    const lum = (x, y) => { const p = __cmwLandSurfacePx(x, y); if (!p) return null; const d = g.getImageData(Math.round(p[0] * k), Math.round(p[1] * k), 1, 1).data; return (d[0] + d[1] + d[2]) / 3; };
    const ds = [];
    for (let i = 0; i <= 17; i++) { const x = -(0.1 + 0.02 * i), a = lum(x, ${s} * ${REST_NEAR}), b = lum(x, ${s} * ${REST_FAR}); if (a != null && b != null) ds.push(b - a); }
    ds.sort((p, q) => p - q);
    return JSON.stringify({ n: ds.length, median: ds.length ? +ds[ds.length >> 1].toFixed(1) : null, ds: ds.map((d) => +d.toFixed(1)) }); })()`));
  r.lower = await side(-1); r.upper = await side(1);
  ok(`at rest, plane z with Im √z: beside the cut the lower piece is no darker than a little off it (median at most ${REST_SHADE})`, r.lower.n >= 14 && r.lower.median <= REST_SHADE, r);
  ok(`at rest, plane z with Im √z (control): the upper piece beside the cut likewise (median at most ${REST_SHADE})`, r.upper.n >= 14 && r.upper.median <= REST_SHADE, r);
}
// ---- Inside regions: an annulus under the square root ----
{
  const ns = 'landcopiesin' + Date.now(), r = info.inside = {};
  await loadView('steps', ns, { shapes: [{ id: 'a1', kind: 'annulus', c: [0, 0], r1: 0.5, r2: 2, ci: 0, visible: true }], steps: [ROOT], srcView: { cx: 0, cy: 0, s: 90 } });
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  await settled({ max: 30000, until: READY });
  await ev(`__cmwSteps({ scope: 'in', surf: 'land', go: 0, now: true }); 1`);
  await settled({ max: 60000 });
  for (const u of [0.5, 1 - NEAR]) {
    const c = r[`u ${u}`] = await at(u, 0, `in${u}`);
    ok(`Inside regions, u = ${u}: a carried frame of the principal sheet's image of the region alone (no copy)`, c.s === 0 && c.copies === 0, c);
  }
}
// ---- the page's own heights (log |F|) and window: no speckle where the copy lies in the principal surface's place ----
{
  const r = info.modulus = {};
  // (the pixels over SPECKLE_TOL apart between the kept frames a and b with at most two of their eight neighbours so)
  const speckle = (a, b) => ev(`(() => { const A = window.__heldPx[${JSON.stringify(a)}], B = window.__heldPx[${JSON.stringify(b)}], W = document.getElementById('canvasL').width, H = A.length / 4 / W;
    const D = new Uint8Array(W * H); for (let k = 0; k < W * H; k++) { const i = 4 * k; D[k] = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2])) > ${SPECKLE_TOL} ? 1 : 0; }
    let n = 0, all = 0; for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const k = y * W + x; if (!D[k]) continue; all++; const m = D[k - W - 1] + D[k - W] + D[k - W + 1] + D[k - 1] + D[k + 1] + D[k + W - 1] + D[k + W] + D[k + W + 1]; if (m <= 2) n++; }
    return { isolated: n, apart: all }; })()`);
  await loadView('steps', 'landcopiesabs' + Date.now(), { shapes: [], steps: [ROOT], sheets: false });
  await settled({ max: 30000, until: READY });
  await wordsOff();
  await ev(`__cmwSet('lines', false); __cmwSet('morphPaths', false); __cmwHideStrokes(true); __cmwSteps({ scope: 'all', surf: 'land', go: 0, now: true }); 1`);
  await settled({ max: 60000 });
  r.height = await ev('(document.querySelector("#heightSeg button[aria-pressed=true], #heightSeg button.on") || {}).dataset?.v || null');
  for (const u of [NEAR, 0.02, 0.05, 0.15]) {
    const all = await at(u, 0, `m${u}`);
    const one = await at(u, 1, `mk${u}`);
    const sp = r[`u ${u}`] = Object.assign({ copies: all.copies }, await speckle(`m${u}`, `mk${u}`));
    ok(`log |F| heights, u = ${u}: the frame with the other sheet's copy and the control differ in at most ${SPECKLE} isolated pixels (no speckle)`, all.copies >= 1 && sp.isolated <= SPECKLE, sp);
  }
  await ev('__cmwSteps({ glideSheets: 0 }); 1');
}
return { pass: fails.length === 0, fails, info };
