// The steps view's frames held still and read, and the exact picture of a glide frame: what steps_glide_look_cmd.js uses
// (steps_glide_inverse_cmd.js uses GI_REF). An expression for eval in a suite: `const { hold, grab, compare } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'))`.
// - hold(x, links = true): the thread held at place x mid-glide, as a user holding it: a scrub on the rail, pressed on
//   the first plane and not let go (window.__svScrubUp lets it go). Answers settled()'s { ok, ms, busy } once the
//   programs are linked (not with links false), the thread is within HOLD_EPS of x, the view draws the moving frames and
//   the left pane's last frame is not one held on the glide's first plane while the glide's pole tracks are made
//   (UNHELD). The wait ends once two animation frames found that: the frame the idle job asked for when it ended the
//   hold may still be queued, so a read of a picture goes through grab(), whose two equal reads are the frame at x, and
//   a read of the glide's record (__cmwSteps().glide) waits for its u to be x too. The record (path 'inverse', 'mesh' or
//   'none') is written by a frame drawn between two planes in the map's mode 1 that is not a still frame and not under
//   a derivative step, and by no other, so the wait does not ask for it;
// - UNHELD: an expression for settled()'s until, true when the left pane's last frame is not held on a glide's first
//   plane for its missing pole tracks (__cmwSteps().hold, svHoldB: the idle job ends that hold once the tracks are made
//   and asks for the frame at the thread's place). It is the wait for a read after the thread is placed directly,
//   __cmwSteps({ x }) or { park }, instead of held with hold(): on a chain with Newton members the frame there may be
//   the first plane's held one until it is true. The same applies to a suite's own wait on a parked thread;
// - grab(tag): canvasL's pixels kept in the page as __heldPx[tag] once two reads 100 ms apart agree (the frame is still; each read has
//   PIXEL_READ_MS, 120 s, since it waits for the GPU to finish the frame, not ev's 20 s),
//   with the pane's camera then and the glide's record of that frame as __heldAt[tag] = { v, g }; true when they did;
// - snap(tag): canvasL's pixels kept now, as grab keeps them, without waiting for a still frame (a frame read while it
//   changes, a mesher's job running);
// - compare(a, b): two kept frames' difference (test/lib/pixel_diff.js's pixelDiff, as sameAway's and compareKept's), each pixel's largest channel difference (RGB, 0..255): the share of the
//   pixels more than DIFF_TOL apart (frac), the largest (max) and the mean (mean); and each frame's mean luminance
//   (lum, Rec. 601 weights) and mean alpha (alpha); win { x: [x0, x1], y: [y0, y1] } (fractions of the pane): only
//   the pixels in that window;
// - wordsOff(): canvasL draws no words from here on (fillText and strokeText do nothing on it; every other canvas draws
//   as before), for a suite that reads the picture under them: the floor's and the ruler's labels name things that two
//   frames compared may name differently, and over a surface a glyph reads as a speck;
// - keep(tag) and compareKept(a, b): a kept frame brought out of the page (a page load clears __heldPx), and two such
//   frames' difference: the pixels with any channel apart (apart), the share more than DIFF_TOL apart (frac), the
//   largest channel difference (max), and whether each frame shows a picture (shown: its channels span more than
//   DIFF_TOL, so two blank canvases are not the same picture); null when either is missing or their sizes differ;
// - GI_REF: a page script that defines the exact picture of a glide frame at its own u (steps_glide_inverse_cmd.js
//   uses it too): __giRef(P, F, tol = 6, step = 10) samples the frame F every step px; at each pixel w it solves H_u(z) = w by
//   Newton's method from seeds over P's window, an 8 x 6 grid or window.__giSeeds ([columns, rows]), and with
//   window.__giRecip from each seed on 1/H_u(z) = 1/w as well (for a map with a pole in the window) (H_u, the frame's
//   camera, the sheet key and the opacity alpha from the glide's record: F.g, or __cmwSteps().glide), keeps
//   the roots in the regions (where P is not the paper: a map many-to-one onto
//   w under Inside regions; every root when none is, or with window.__giAllRoots), and colours w as the inverse pass
//   composites them: front to back (Inverse.order: the front is the largest Im z, then the largest Re z, among the keys
//   within the tie band of the smallest, then the front of the rest, and so on), each at alpha and the farthest opaque,
//   until less than 1/255 shows through, each coloured as P, plane z's
//   parked frame, colours it (bilinear; P.v: P's camera, which may be wider than the frame's, so that front roots past
//   the frame's window are graded too; the frame's by default). At alpha 1 that is the front root alone. A pixel where
//   a root off P's canvas (whose cover and colour P cannot show) would weigh more than tol / 2 counts as none. Pixels next
//   to a colour line (__giRange: a 4 x 4 neighbourhood spanning more than 12 levels, in P about a layer's z, when that
//   range times the layer's weight passes tol / 2, or in F about w), and those with a layer's z under a dot P marks a
//   point with (within 5 CSS px of a point of window.__giMarks, such as a cut's branch point), are not compared. Frames are { W, H, d } (d: the RGBA bytes). Answers { n compared, none (no z on the canvas), far (of n,
//   the pixels whose front z lies past the frame's window), max, over: the share of n more than tol apart in a channel };
// - refOf(base, tag, tol, step = 10): __giRef of two kept frames (base: plane z's parked frame, in the camera grab kept for
//   it, which may be wider than tag's) sampled every step px, by the glide's record grab kept for tag, or null when that
//   record has no sheet key (a frame the carried mesh draws); timeout (ms) bounds the page call; as: the kept frame whose
//   record grades tag (tag's own by default; for a frame made in the page, such as fade's);
// - fade(a, b, t, tag): the kept frames a and b cross-faded, (1 - t) a + t b per channel, kept as __heldPx[tag] (what a
//   frame that blends the two planes' pictures instead of carrying the colour would show); true when both exist;
// - judge(base, tag, o): the carried colour of the kept frame tag, held between plane z's parked frame base and a later
//   plane, graded against the exact picture (refOf with o.tol, default JUDGE_TOL, every o.step px, default 10):
//   { path, u, n, over, max, none, far, pass }, pass when at least o.minN (default JUDGE_MIN_N) pixels were compared and at
//   most the share o.maxOver (default JUDGE_OVER) of them are more than the tolerance apart; pass is false when the
//   glide's record has no sheet key (a frame the carried mesh draws; refOf answers null), with n 0; o.seeds: [columns,
//   rows] of the reference's Newton seeds (window.__giSeeds), for a frame whose roots the default 8 x 6 grid misses;
//   o.recip: the reference solves 1/H_u(z) = 1/w from each seed too (window.__giRecip), for a frame whose map has a pole
//   in the window, next to which Newton's method on H_u finds the roots from next to them only; o.as: refOf's as;
// - globeJudge(base, tag, o): the steps view's globe held between plane z and a later plane, the kept frame tag, graded
//   against the exact picture from plane z's parked globe base (both kept by grab, the camera unmoved): for each point w
//   of a lattice of the sphere's front side every GLOBE_STEP degrees, its pixel on tag against the
//   pixel of its front point z0 on base (z0: H_u's points over w by Newton's method, __cmwSvGlobe's H; several: the front
//   one by the glide's sheet key, __cmwSvKey(b, u) through Inverse.sheetKey and Inverse.order, so a judge of Inside
//   regions holds for a map one to one only), with the globe's light (SHADE_GLOBE: c = alb k(n, v) + spec(n, v) in
//   linear light, the key light and the eye from __cmwSvGlobe) taken out at z0 and put back at w. Points next to a
//   colour line, a stroke or the limb (a 4 x 4 neighbourhood spanning more than GLOBE_RANGE levels in either frame) are
//   not compared. Answers { n compared, none (no z0, or z0 behind the globe), several (the sample points whose z0 was
//   the front one of several), max, mean, over: the share of n more than o.tol (default GLOBE_TOL) apart in a channel,
//   path and u: __cmwSvGlobe's, pass }, pass when at least o.minN (default GLOBE_MIN_N) points were compared and at most
//   the share o.maxOver (default GLOBE_OVER) of them are over;
// - sameAway(a, b, tol, keep): two kept frames compared pixel by pixel away from the colour lines (a pixel where either
//   frame's __giRange spans more than 12 levels is left out), only where keep holds (the source of a page function of
//   the device pixel (x, y); every pixel without it): { n compared, max, over: the share of n more than tol apart }.
(() => {
  // (the pixel compare and the colour lines' test, __pxDiff and __giRange in a page: test/lib/pixel_diff.js)
  const PD = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'pixel_diff.js'), 'utf8')), RANGE = PD.SCRIPT;
  const REF = `window.__giRef = (P, F, tol = 6, step = 10) => {
  const g = F.g || __cmwSteps().glide, H = g.H, v = g.view, pv = P.v || v, W = F.W, Ht = F.H, dpr = W / g.w, C = (re, im) => ({ re, im });
  const s2w = (x, y) => C(v.cx + (x / dpr - g.w / 2) / v.s, v.cy - (y / dpr - g.h / 2) / v.s);
  // (the seeds over P's window, which may be wider than the frame's: its front roots past the frame's window are found too)
  const x0 = pv.cx - g.w / 2 / pv.s, x1 = pv.cx + g.w / 2 / pv.s, y0 = pv.cy - g.h / 2 / pv.s, y1 = pv.cy + g.h / 2 / pv.s, seeds = [];
  const inFrame = (z) => Math.abs(z.re - v.cx) <= g.w / 2 / v.s && Math.abs(z.im - v.cy) <= g.h / 2 / v.s;
  const [SX, SY] = window.__giSeeds || [8, 6];
  for (let i = 0; i < SX; i++) for (let j = 0; j < SY; j++) seeds.push(C(x0 + (i + 0.5) * (x1 - x0) / SX, y0 + (j + 0.5) * (y1 - y0) / SY));
  // (the parked frame's paper, where Inside regions leaves a pixel outside the regions; null: none known)
  const sh = (__cmwShapes().shapes || [])[0], ph = sh && !window.__giAllRoots ? __cmwLook(sh.id, 'L').plane : null;
  const paper = ph && /^#[0-9a-f]{6}$/i.test(ph) ? [1, 3, 5].map((i) => parseInt(ph.slice(i, i + 2), 16)) : null;
  // (true / false: z in the regions or on the paper; null: z off P's canvas, where P cannot show its colour, and, Inside
  // regions, in a region by the regions' own levels (Region.levelOf))
  const levels = paper && __cmwSteps().scope === 'in' ? (__cmwShapes().shapes || []).filter((q) => q.visible !== false && Region.KINDS[q.kind] && Region.KINDS[q.kind].type === 'area').map((q) => Region.levelOf(q)) : [];
  const covers = (z) => {
    const x = Math.round(((z.re - pv.cx) * pv.s + g.w / 2) * dpr - 0.5), y = Math.round((g.h / 2 - (z.im - pv.cy) * pv.s) * dpr - 0.5);
    if (x < 0 || y < 0 || x >= W || y >= Ht) return levels.length && !levels.some((L) => L(z) > 0) ? false : null;
    if (!paper) return true;
    const i = 4 * (y * W + x);
    return Math.max(Math.abs(P.d[i] - paper[0]), Math.abs(P.d[i + 1] - paper[1]), Math.abs(P.d[i + 2] - paper[2])) > 12;
  };
  // (the frame's composite, as the inverse pass draws it: the covering points front to back, each at the frame's opacity
  // g.alpha (1 when the record has none) and the farthest opaque, until less than 1/255 shows through; at opacity 1 that is
  // the front point alone)
  const A = g.alpha == null ? 1 : g.alpha;
  // (the points P marks with a dot, window.__giMarks (plane points; none by default), as P's device pixels: a layer's point
  // within MARK_PX CSS px of one lies under the dot, whose inside is too wide for a colour line's test yet is not P's
  // colour, and is left out as by a colour line. A cut's branch point dot is a disc of radius 3.5 CSS px, stroked 1.5 px
  // wide)
  const MARK_PX = 5, marks = (window.__giMarks || []).map((z) => [((z.re - pv.cx) * pv.s + g.w / 2) * dpr - 0.5, (g.h / 2 - (z.im - pv.cy) * pv.s) * dpr - 0.5]);
  let n = 0, over = 0, none = 0, max = 0, far = 0;
  for (let py = 4; py < Ht - 4; py += step) for (let px = 4; px < W - 4; px += step) {
    const w = s2w(px + 0.5, py + 0.5), roots = [];
    // (solve(s0, inv): Newton's method from s0 on H(z) = w, or with inv on 1/H(z) = 1/w, nearly linear next to a pole of
    // H, where Newton's method on H converges from next to the root only)
    const ww = w.re * w.re + w.im * w.im, wi = C(w.re / ww, -w.im / ww);
    const inverse = (f) => { const ff = f.re * f.re + f.im * f.im; return C(f.re / ff, -f.im / ff); };
    const solve = (s0, inv) => {
      const G = inv ? (z) => inverse(H(z)) : H, t = inv ? wi : w;
      let z = s0;
      for (let it = 0; it < 40 && z; it++) {
        const f = G(z), h = 1e-7 * (1 + Math.hypot(z.re, z.im)), f2 = G(C(z.re + h, z.im));
        const d = C((f2.re - f.re) / h, (f2.im - f.im) / h), dd = d.re * d.re + d.im * d.im, r = C(f.re - t.re, f.im - t.im);
        if (!(dd > 0) || !isFinite(dd)) { z = null; break; }
        let st = C((r.re * d.re + r.im * d.im) / dd, (r.im * d.re - r.re * d.im) / dd);
        const sl = Math.hypot(st.re, st.im), mx = 2 + 0.5 * Math.hypot(z.re, z.im);
        if (sl > mx) st = C(st.re * mx / sl, st.im * mx / sl);
        z = C(z.re - st.re, z.im - st.im);
        if (!isFinite(z.re) || !isFinite(z.im)) z = null;
        else if (sl < 1e-12 * (1 + Math.hypot(z.re, z.im))) break;
      }
      return z;
    };
    for (const z of seeds.flatMap((s0) => window.__giRecip && ww > 0 ? [solve(s0, false), solve(s0, true)] : [solve(s0, false)])) {
      if (!z) continue;
      const f = H(z);
      if (!(Math.hypot(f.re - w.re, f.im - w.im) <= 1e-9 * (1 + Math.hypot(w.re, w.im)))) continue;
      if (roots.some((q) => Math.hypot(q.z.re - z.re, q.z.im - z.im) <= 1e-6 * (1 + Math.hypot(z.re, z.im)))) continue;
      const k = g.key(z);
      roots.push({ z, k, D: k, lam: null, cv: covers(z) });
    }
    // (the layers front to back: the covering points, and those off P's canvas, which may cover (the regions run past the
    // canvas) and whose colour P cannot show; w's colour is not known when such a point would weigh more than half the
    // tolerance. With no point covering, w is the paper: the front point, outside the regions, where P shows the paper)
    const order = (L) => Inverse.order(L);
    const lay = order(roots.filter((q) => q.cv !== false));
    const layers = [];
    let T = 1, unknown = false;
    for (let i = 0; i < lay.length && T >= 1 / 255; i++) {
      const a = i === lay.length - 1 ? 1 : A, wt = T * a;
      if (lay[i].cv === null) { if (wt * 255 > tol / 2) { unknown = true; break; } } else layers.push({ q: lay[i], wt });
      T *= 1 - a;
    }
    if (!lay.some((q) => q.cv === true)) { const out = order(roots.filter((q) => q.cv === false)); layers.length = 0; unknown = unknown || !out.length; if (out.length) layers.push({ q: out[0], wt: 1 }); }
    if (unknown || !layers.length) { none++; continue; }
    // (each layer's colour in P, bilinear about its point; a pixel where a layer's point lies by a colour line of P that its
    // weight carries past half the tolerance, or w by one of F, is left out: at alpha 1, the front point by a line)
    const col = [0, 0, 0];
    let edge = false, line = false;
    for (const { q, wt } of layers) {
      const fx = ((q.z.re - pv.cx) * pv.s + g.w / 2) * dpr - 0.5, fy = (g.h / 2 - (q.z.im - pv.cy) * pv.s) * dpr - 0.5, qx = Math.floor(fx), qy = Math.floor(fy), ax = fx - qx, ay = fy - qy;
      if (qx < 2 || qy < 2 || qx >= W - 3 || qy >= Ht - 3) { edge = true; break; }
      if (marks.some((m) => Math.hypot(fx - m[0], fy - m[1]) <= MARK_PX * dpr)) { line = true; break; }
      const rg = __giRange(P.d, W, qx, qy);
      if (rg > 12 && wt * rg > tol / 2) { line = true; break; }
      const at = (x, y, c) => P.d[4 * (y * W + x) + c];
      for (let c = 0; c < 3; c++) col[c] += wt * ((1 - ay) * ((1 - ax) * at(qx, qy, c) + ax * at(qx + 1, qy, c)) + ay * ((1 - ax) * at(qx, qy + 1, c) + ax * at(qx + 1, qy + 1, c)));
    }
    if (edge) { none++; continue; }
    if (line || __giRange(F.d, W, px, py) > 12) continue;
    const o = 4 * (py * W + px);
    let m = 0;
    for (let c = 0; c < 3; c++) m = Math.max(m, Math.abs(F.d[o + c] - col[c]));
    n++; max = Math.max(max, m); if (m > tol) over++; if (!inFrame(layers[0].q.z)) far++;
  }
  return { n, none, far, max: Math.round(max), over: +(over / Math.max(1, n)).toFixed(5) };
};`;
  const HOLD_EPS = 0.003;   // (a rail pixel is about 0.005 of a plane at 1200 px wide)
  const DIFF_TOL = 32;      // (steps_sm_standin_cmd.js: a frame is the rest frame with at most 0.5 % of pixels > 32/255 apart)
  const UNHELD = '!__cmwSteps().hold';
  // (links: wait for every program to have linked too; false while links are held, GLR.holdLinks)
  const hold = async (x, links = true) => {
    await ev(`(() => {
      const rail = document.querySelector('.sv-rail'), ns = [...document.querySelectorAll('.sv-track .sv-plane')].map((b) => { const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
      const i = Math.min(ns.length - 2, Math.floor(${x})), cx = ns[i][0] + (ns[i + 1][0] - ns[i][0]) * (${x} - i), cy = ns[0][1];
      const ev = (type, px) => rail.dispatchEvent(new PointerEvent(type, { pointerId: 75, pointerType: 'mouse', button: 0, buttons: 1, isPrimary: true, bubbles: true, clientX: px, clientY: cy }));
      ev('pointerdown', ns[0][0] - 2); ev('pointermove', ns[0][0] + 10); ev('pointermove', cx);
      window.__svScrubUp = () => ev('pointerup', cx);
      return 1;
    })()`);
    return settled({ max: 60000, panes: links, until: `${links ? 'GLR.pendingLinks === 0 && ' : ''}Math.abs(__cmwSvX() - ${x}) < ${HOLD_EPS} && __cmwSteps().moving && ${UNHELD}` });
  };
  // (the page code that keeps canvasL's pixels d as the frame tag, with the pane's camera and the glide's record)
  const KEEP = (tag) => `window.__heldPx[${JSON.stringify(tag)}] = d;
    (window.__heldAt || (window.__heldAt = {}))[${JSON.stringify(tag)}] = { v: Object.assign({}, __cmwCards().main.view), g: typeof __cmwSteps === 'function' ? __cmwSteps().glide : null };`;
  const PIXELS = "const c = document.getElementById('canvasL'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, g = window.__heldPx || (window.__heldPx = {});";
  // (a read of canvasL's pixels waits for the GPU to finish the frame, which a heavy glide frame on a software renderer takes most of 20 s over)
  const PIXEL_READ_MS = 120000;
  const grab = async (tag) => {
    for (let n = 0; n < 150; n++) {
      const same = await ev(`(() => { ${PIXELS} const p = g._prev;
        g._prev = d; if (!p || p.length !== d.length) return false; for (let i = 0; i < d.length; i++) if (p[i] !== d[i]) return false;
        ${KEEP(tag)}
        return true; })()`, PIXEL_READ_MS);
      if (same) return true;
      await sleep(100);
    }
    return false;
  };
  const snap = (tag) => ev(`(() => { ${PIXELS} ${KEEP(tag)} return true; })()`, PIXEL_READ_MS);
  const wordsOff = () => ev(`(() => { const p = CanvasRenderingContext2D.prototype; for (const k of ['fillText', 'strokeText']) { const g = p[k]; p[k] = function (...a) { if (this.canvas.id !== 'canvasL') return g.apply(this, a); }; } return 1; })()`);
  const kept = {};
  const keep = async (tag) => {
    const b64 = await ev(`(() => { const P = (window.__heldPx || {})[${JSON.stringify(tag)}]; if (!P) return ''; let s = ''; for (let i = 0; i < P.length; i += 0x8000) s += String.fromCharCode.apply(null, P.subarray(i, i + 0x8000)); return btoa(s); })()`);
    kept[tag] = b64 ? Buffer.from(b64, 'base64') : null;
    return !!kept[tag];
  };
  const compareKept = (a, b) => {
    const A = kept[a], B = kept[b];
    if (!A || !B || A.length !== B.length) return null;
    const q = PD.pixelDiff(A, B, { tol: DIFF_TOL });
    // (shown: the frame is not one colour, its channels spread over more than DIFF_TOL)
    const lo = [[255, 255, 255], [255, 255, 255]], hi = [[0, 0, 0], [0, 0, 0]];
    for (let i = 0; i < A.length; i += 4) for (let c = 0; c < 3; c++) {
      lo[0][c] = Math.min(lo[0][c], A[i + c]); hi[0][c] = Math.max(hi[0][c], A[i + c]);
      lo[1][c] = Math.min(lo[1][c], B[i + c]); hi[1][c] = Math.max(hi[1][c], B[i + c]);
    }
    const shown = [0, 1].map((k) => Math.max(...[0, 1, 2].map((c) => hi[k][c] - lo[k][c])) > DIFF_TOL);
    return { apart: q.apart, frac: +q.frac.toFixed(5), max: q.max, shown };
  };
  const compare = (a, b, win = null) => ev(`(() => {
    ${RANGE}
    const A = window.__heldPx[${JSON.stringify(a)}], B = window.__heldPx[${JSON.stringify(b)}];
    if (!A || !B || A.length !== B.length) return null;
    const cv = document.getElementById('canvasL'), q = __pxDiff(A, B, { W: cv.width, H: cv.height, tol: ${DIFF_TOL}, win: ${JSON.stringify(win)} });
    const r = (v) => +v.toFixed(4);
    return { frac: r(q.frac), max: q.max, mean: r(q.mean), lum: q.lum.map(r), alpha: q.alpha.map(r), px: q.n };
  })()`);
  // the straight hard edges of a kept frame: the pixels more than DIFF_TOL apart (their largest channel difference) from
  // the next row's (h, a horizontal edge) or the next column's (v, a vertical one), in runs of at least `run` pixels
  // along the edge
  const edgeRuns = (tag, run) => ev(`(() => {
    const P = window.__heldPx[${JSON.stringify(tag)}], c = document.getElementById('canvasL'), W = c.width, H = c.height;
    if (!P || P.length !== 4 * W * H) return null;
    const step = (i, j) => Math.max(Math.abs(P[4 * i] - P[4 * j]), Math.abs(P[4 * i + 1] - P[4 * j + 1]), Math.abs(P[4 * i + 2] - P[4 * j + 2])) > ${DIFF_TOL};
    // (along a line of n pixels, at(k) the step there: the pixels in runs of at least ${run})
    const runs = (n, at) => { let s = 0, len = 0; for (let k = 0; k <= n; k++) { if (k < n && at(k)) len++; else { if (len >= ${run}) s += len; len = 0; } } return s; };
    let h = 0, v = 0;
    for (let y = 0; y + 1 < H; y++) h += runs(W, (x) => step((y + 1) * W + x, y * W + x));
    for (let x = 0; x + 1 < W; x++) v += runs(H, (y) => step(y * W + x + 1, y * W + x));
    return { h, v, px: W * H };
  })()`);
  const GI_REF = `${RANGE}
${REF}`;
  const refOf = (base, tag, tol, step = 10, timeout = 20000, as = tag) => ev(`(() => {
    ${GI_REF}
    const c = document.getElementById('canvasL'), K = window.__heldPx, A = window.__heldAt || {}, at = A[${JSON.stringify(as)}];
    const g = (at && at.g) || __cmwSteps().glide, f = (t, own) => Object.assign({ W: c.width, H: c.height, d: K[t] }, own);
    if (!g || !g.key || !K[${JSON.stringify(base)}] || !K[${JSON.stringify(tag)}]) return { path: g && g.path, u: g && g.u, ref: null };
    const b = A[${JSON.stringify(base)}];
    return { path: g.path, u: g.u, ref: __giRef(f(${JSON.stringify(base)}, b && { v: b.v }), f(${JSON.stringify(tag)}, { g }), ${tol}, ${step}) };
  })()`, timeout);
  // the rest renderer's grid over the colour, in a kept frame drawn with the glide's camera (__cmwSteps().glide.view):
  // renderColor strokes the major grid lines (Axes.niceStep(110 / scale) apart, the axes left out) 1 CSS px wide at
  // --dc-line, opacity --dc-line-a, over the colour. At each such line pixel whose two neighbours (2 device px off the
  // line, across it) agree within DIFF_TOL and where that stroke would move the colour by more than DIFF_TOL in a
  // channel (a line the eye sees: on the paper it is lost), the pixel the rest renderer draws is the neighbours' mean
  // with the stroke over it. Answers { n: such pixels, over: the share of them more than DIFF_TOL from it }
  const gridOver = (tag) => ev(`(() => {
    const P = window.__heldPx[${JSON.stringify(tag)}], g = __cmwSteps().glide, c = document.getElementById('canvasL'), W = c.width, H = c.height;
    if (!P || !g) return null;
    const cs = getComputedStyle(document.documentElement), hex = (cs.getPropertyValue('--dc-line').trim() || '#FFFFFF').slice(1);
    const ink = [0, 2, 4].map((k) => parseInt(hex.slice(k, k + 2), 16)), a = parseFloat(cs.getPropertyValue('--dc-line-a')) || 0.22;
    const v = g.view, d = W / g.w, st = Axes.niceStep(110 / v.s);
    let n = 0, over = 0;
    // (a line pixel at device (x, y), its neighbours (x0, y0) and (x1, y1))
    const pixel = (x, y, x0, y0, x1, y1) => {
      if (x0 < 0 || y0 < 0 || x1 >= W || y1 >= H) return;
      const i = 4 * (y * W + x), i0 = 4 * (y0 * W + x0), i1 = 4 * (y1 * W + x1);
      let smooth = true, seen = false, off = false;
      for (let k = 0; k < 3; k++) {
        const m = (P[i0 + k] + P[i1 + k]) / 2, want = m * (1 - a) + ink[k] * a;
        if (Math.abs(P[i0 + k] - P[i1 + k]) > ${DIFF_TOL}) smooth = false;
        if (Math.abs(want - m) > ${DIFF_TOL}) seen = true;
        if (Math.abs(P[i + k] - want) > ${DIFF_TOL}) off = true;
      }
      if (!smooth || !seen) return;
      n++; if (off) over++;
    };
    const x0 = v.cx - g.w / 2 / v.s, x1 = v.cx + g.w / 2 / v.s, y0 = v.cy - g.h / 2 / v.s, y1 = v.cy + g.h / 2 / v.s;
    for (let k = Math.ceil(x0 / st); k <= Math.floor(x1 / st); k++) {
      if (k === 0) continue;
      const X = Math.round(g.w / 2 + (k * st - v.cx) * v.s) * d;
      for (let dx = 0; dx < d; dx++) for (let y = 0; y < H; y++) pixel(X + dx, y, X - 2, y, X + d + 1, y);
    }
    for (let k = Math.ceil(y0 / st); k <= Math.floor(y1 / st); k++) {
      if (k === 0) continue;
      const Y = Math.round(g.h / 2 - (k * st - v.cy) * v.s) * d;
      for (let dy = 0; dy < d; dy++) for (let x = 0; x < W; x++) pixel(x, Y + dy, x, Y - 2, x, Y + d + 1);
    }
    return { n, over: +(over / Math.max(1, n)).toFixed(4) };
  })()`);
  // the outlines of the area shapes in a kept frame (open: an open set's, which the rest renderer dashes), by their ink (a shape's --cN-edge, N its colour index + 1; a
  // shape with a colour of its own is listed as such): the pixels within DIFF_TOL of it in every channel, in 8-connected
  // pieces; a dash of the rest renderer's open-set pattern (5 CSS px on, 3.5 off) is a piece at most DASH_SPAN CSS px
  // across. Answers [{ id, open, px, long: the share of px in pieces wider than that }]
  const DASH_SPAN = 12;
  const outlines = (tag) => ev(`(() => {
    const P = window.__heldPx[${JSON.stringify(tag)}], c = document.getElementById('canvasL'), W = c.width, H = c.height, d = W / c.getBoundingClientRect().width;
    if (!P) return null;
    const cs = getComputedStyle(document.documentElement), out = [];
    for (const s of __cmwShapes().shapes) {
      if (s.visible === false || !Region.KINDS[s.kind] || Region.KINDS[s.kind].type !== 'area') continue;
      const open = Region.isOpen(s);
      if (s.color) { out.push({ id: s.id, open, own: s.color }); continue; }
      const hex = cs.getPropertyValue('--c' + (((s.ci || 0) % 8) + 1) + '-edge').trim().slice(1);
      if (hex.length < 6) { out.push({ id: s.id, open, ink: null }); continue; }
      const ink = [0, 2, 4].map((k) => parseInt(hex.slice(k, k + 2), 16));
      const on = new Uint8Array(W * H);
      let px = 0;
      for (let i = 0; i < W * H; i++) if (Math.abs(P[4 * i] - ink[0]) <= ${DIFF_TOL} && Math.abs(P[4 * i + 1] - ink[1]) <= ${DIFF_TOL} && Math.abs(P[4 * i + 2] - ink[2]) <= ${DIFF_TOL}) { on[i] = 1; px++; }
      let long = 0;
      const stack = [];
      for (let i = 0; i < W * H; i++) {
        if (on[i] !== 1) continue;
        let n = 0, xa = W, xb = 0, ya = H, yb = 0;
        on[i] = 2; stack.push(i);
        while (stack.length) {
          const j = stack.pop(), x = j % W, y = (j - x) / W;
          n++; xa = Math.min(xa, x); xb = Math.max(xb, x); ya = Math.min(ya, y); yb = Math.max(yb, y);
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const q = x + dx, r = y + dy, k = r * W + q;
            if (q >= 0 && r >= 0 && q < W && r < H && on[k] === 1) { on[k] = 2; stack.push(k); }
          }
        }
        if (Math.max(xb - xa, yb - ya) + 1 > ${DASH_SPAN} * d) long += n;
      }
      out.push({ id: s.id, open, px, long: +(long / Math.max(1, px)).toFixed(4) });
    }
    return out;
  })()`);
  // two kept frames pixel by pixel away from the colour lines (__giRange: pixels whose 4 x 4 neighbourhood spans more
  // than 12 levels in either frame are left out): { n compared, max, over: the share of n more than tol apart in a
  // channel }
  const sameAway = (a, b, tol, keep) => ev(`(() => {
    ${RANGE}
    const A = window.__heldPx[${JSON.stringify(a)}], B = window.__heldPx[${JSON.stringify(b)}], c = document.getElementById('canvasL'), K = ${keep || 'null'};
    if (!A || !B || A.length !== B.length) return null;
    const q = __pxDiff(A, B, { W: c.width, H: c.height, tol: ${tol}, edge: [2, 3], away: 12, keep: K || undefined });
    return { n: q.n, max: q.max, over: +q.frac.toFixed(5) };
  })()`);
  const JUDGE_TOL = 6, JUDGE_MIN_N = 1000, JUDGE_OVER = 0.002, JUDGE_SEEDS_MS = 120000;
  const fade = (a, b, t, tag) => ev(`(() => {
    const K = window.__heldPx, A = K && K[${JSON.stringify(a)}], B = K && K[${JSON.stringify(b)}];
    if (!A || !B || A.length !== B.length) return false;
    const F = new Uint8ClampedArray(A.length);
    for (let i = 0; i < A.length; i++) F[i] = i % 4 === 3 ? A[i] : (1 - ${t}) * A[i] + ${t} * B[i];
    K[${JSON.stringify(tag)}] = F;
    return true;
  })()`);
  const judge = async (base, tag, o = {}) => {
    const tol = o.tol == null ? JUDGE_TOL : o.tol, minN = o.minN == null ? JUDGE_MIN_N : o.minN, maxOver = o.maxOver == null ? JUDGE_OVER : o.maxOver;
    // (o.seeds: [columns, rows] of the Newton seeds of the reference, for a frame whose roots the default grid misses)
    if (o.seeds) await ev(`window.__giSeeds = ${JSON.stringify(o.seeds)}, 1`);
    if (o.recip) await ev('window.__giRecip = true, 1');
    const r = await refOf(base, tag, tol, o.step || 10, o.seeds || o.recip ? JUDGE_SEEDS_MS : 20000, o.as);
    if (o.seeds) await ev('delete window.__giSeeds, 1');
    if (o.recip) await ev('delete window.__giRecip, 1');
    if (!r || !r.ref) return { path: r && r.path, u: r && r.u, n: 0, over: null, max: null, none: null, far: null, pass: false };
    const q = r.ref;
    return { path: r.path, u: r.u, n: q.n, over: q.over, max: q.max, none: q.none, far: q.far, pass: q.n >= minN && q.over <= maxOver };
  };
  // the globe's judge (the header's globeJudge): a lattice of the sphere every GLOBE_STEP degrees, each point w's pixel on the
  // moving globe tag against the pixel of its front point z0 on plane z's parked globe base, with the globe's light
  // taken out at z0 and put back at w
  const GLOBE_TOL = 8, GLOBE_MIN_N = 300, GLOBE_OVER = 0.005, GLOBE_RANGE = 12, GLOBE_STEP = 2;
  const globeJudge = async (base, tag, o = {}) => {
    const tol = o.tol == null ? GLOBE_TOL : o.tol, minN = o.minN == null ? GLOBE_MIN_N : o.minN, maxOver = o.maxOver == null ? GLOBE_OVER : o.maxOver;
    const r = await ev(`(() => {
      const c = document.getElementById('canvasL'), K = window.__heldPx, A = K[${JSON.stringify(base)}], B = K[${JSON.stringify(tag)}];
      if (!A || !B) return null;
      const W = c.width, Hh = c.height, k = W / c.getBoundingClientRect().width, g = __cmwSvGlobe(0, 0), H = g.H, eye = g.eye, key = g.key, C = (re, im) => ({ re, im });
      const lift = (z) => { const r2 = z.re * z.re + z.im * z.im; return [2 * z.re / (r2 + 1), -2 * z.im / (r2 + 1), (r2 - 1) / (r2 + 1)]; };
      const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], nrm = (a) => { const l = Math.hypot(...a) || 1; return a.map((t) => t / l); };
      // (SHADE_GLOBE's front-face light at sphere point n: the factor on the colour and the added highlight, in linear light)
      const light = (n) => {
        const v = nrm([eye[0] - n[0], eye[1] - n[1], eye[2] - n[2]]), ndl = Math.max(dot(n, key), 0), e = 1 - Math.max(dot(n, v), 0);
        const h = nrm([key[0] + v[0], key[1] + v[1], key[2] + v[2]]);
        return { k: (0.80 + 0.22 * ndl) * (1 - 0.15 * e * e), sp: 0.05 * Math.pow(Math.max(dot(n, h), 0), 96) };
      };
      // (the shader's sRGB transfer: SHADE_GLOBE lights the colour in linear light)
      const cl = (x) => Math.min(1, Math.max(0, x));
      const toLin = (x) => { x = cl(x); return x < 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
      const toSrgb = (x) => { x = cl(x); return x < 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055; };
      const px = (z) => { const q = __cmwGlobeXY('L', z.re, z.im); return q ? [q[0] * k - 0.5, q[1] * k - 0.5] : null; };
      const range = (D, x, y) => { let r = 0; for (let ch = 0; ch < 3; ch++) { let lo = 255, hi = 0; for (let dy = -1; dy <= 2; dy++) for (let dx = -1; dx <= 2; dx++) { const v = D[4 * ((y + dy) * W + x + dx) + ch]; lo = Math.min(lo, v); hi = Math.max(hi, v); } r = Math.max(r, hi - lo); } return r; };
      // (the glide's sheet key, as its inverse pass prepares it: __cmwSvKey(b, u)'s window, R, rs, points and period)
      const kk = g.u > 0 && g.u < 1 ? __cmwSvKey(g.b, g.u) : null;
      const prep = kk && { win: kk.win, R: kk.R, rs: kk.rs, sing: kk.sing.map((p) => C(p[0], p[1])), per: kk.per && C(kk.per[0], kk.per[1]) };
      // (H's points over w by Newton's method from w, 0, four points about it and rings of 8 seeds at radii 1/2, 1 and 2;
      // two roots within SAME are one; with several, the front one by the glide's sheet key, Inverse.order; none when
      // there are several and no key)
      const SAME = 1e-7, seeds = [C(0, 0), C(1, 1), C(-1, -1), C(2, -2)];
      for (const r of [0.5, 1, 2]) for (let j = 0; j < 8; j++) seeds.push(C(r * Math.cos(j * Math.PI / 4 + 0.3), r * Math.sin(j * Math.PI / 4 + 0.3)));
      let several = 0;
      const inv = (w) => {
        const roots = [];
        for (const s0 of [w].concat(seeds)) {
          let z = s0;
          for (let it = 0; it < 60 && z; it++) {
            const f = H(z), h = 1e-7 * (1 + Math.hypot(z.re, z.im)), f2 = H(C(z.re + h, z.im));
            const d = C((f2.re - f.re) / h, (f2.im - f.im) / h), dd = d.re * d.re + d.im * d.im, r = C(f.re - w.re, f.im - w.im);
            if (!(dd > 0) || !isFinite(dd)) { z = null; break; }
            let st = C((r.re * d.re + r.im * d.im) / dd, (r.im * d.re - r.re * d.im) / dd);
            const sl = Math.hypot(st.re, st.im), mx = 1 + 0.5 * Math.hypot(z.re, z.im);
            if (sl > mx) st = C(st.re * mx / sl, st.im * mx / sl);
            z = C(z.re - st.re, z.im - st.im);
            if (!isFinite(z.re) || !isFinite(z.im)) z = null;
            else if (sl < 1e-13 * (1 + Math.hypot(z.re, z.im))) break;
          }
          if (!z) continue;
          const f = H(z);
          if (Math.hypot(f.re - w.re, f.im - w.im) <= 1e-8 * (1 + Math.hypot(w.re, w.im)) && !roots.some((q) => Math.hypot(q.re - z.re, q.im - z.im) < SAME * (1 + Math.hypot(z.re, z.im)))) roots.push(z);
        }
        if (roots.length < 2) return roots[0] || null;
        if (!prep) return null;
        several++;
        return Inverse.order(roots.map((z) => ({ z, D: Inverse.sheetKey(prep, z, null), lam: null })))[0].z;
      };
      let n = 0, over = 0, max = 0, none = 0, sum = 0;
      for (let la = -84; la <= 84; la += ${GLOBE_STEP}) for (let lo = 0; lo < 360; lo += ${GLOBE_STEP} / Math.max(0.1, Math.cos(la * Math.PI / 180))) {
        const p3 = [Math.cos(la * Math.PI / 180) * Math.cos(lo * Math.PI / 180), Math.cos(la * Math.PI / 180) * Math.sin(lo * Math.PI / 180), Math.sin(la * Math.PI / 180)];
        if (p3[2] > 0.995) continue;
        const w = C(p3[0] / (1 - p3[2]), -p3[1] / (1 - p3[2])), pw = px(w);
        if (!pw) continue;
        const z0 = inv(w), pq = z0 && px(z0);
        if (!pq) { none++; continue; }
        const fx = Math.round(pw[0]), fy = Math.round(pw[1]), qx = Math.floor(pq[0]), qy = Math.floor(pq[1]), ax = pq[0] - qx, ay = pq[1] - qy;
        if (fx < 3 || fy < 3 || qx < 3 || qy < 3 || fx >= W - 4 || qx >= W - 4 || fy >= Hh - 4 || qy >= Hh - 4) continue;
        if (range(A, qx, qy) > ${GLOBE_RANGE} || range(B, fx, fy) > ${GLOBE_RANGE}) continue;
        const lq = light(lift(z0)), lp = light(lift(w)), at = (x, y, ch) => A[4 * (y * W + x) + ch], ob = 4 * (fy * W + fx);
        let m = 0;
        for (let ch = 0; ch < 3; ch++) {
          const q = (1 - ay) * ((1 - ax) * at(qx, qy, ch) + ax * at(qx + 1, qy, ch)) + ay * ((1 - ax) * at(qx, qy + 1, ch) + ax * at(qx + 1, qy + 1, ch));
          const want = 255 * toSrgb((toLin(q / 255) - lq.sp) / lq.k * lp.k + lp.sp);
          m = Math.max(m, Math.abs(B[ob + ch] - want));
        }
        n++; sum += m; max = Math.max(max, m); if (m > ${tol}) over++;
      }
      return { n, none, several, max: Math.round(max), mean: +(sum / Math.max(1, n)).toFixed(2), over: +(over / Math.max(1, n)).toFixed(4), path: g.path, u: g.u };
    })()`, 60000);
    if (!r || r.__exc !== undefined) return { error: r && r.__exc, n: 0, pass: false };
    return Object.assign(r, { pass: r.n >= minN && r.over <= maxOver });
  };
  return { hold, UNHELD, grab, snap, compare, wordsOff, keep, compareKept, sameAway, fade, judge, JUDGE_TOL, JUDGE_MIN_N, JUDGE_OVER, globeJudge, GLOBE_MIN_N, edgeRuns, refOf, gridOver, outlines, GI_REF, DIFF_TOL };
})()
