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
// - grab(tag): canvasL's pixels kept in the page as __heldPx[tag] once two reads 100 ms apart agree (the frame is still);
//   true when they did;
// - compare(a, b): two kept frames' difference, each pixel's largest channel difference (RGB, 0..255): the share of the
//   pixels more than DIFF_TOL apart (frac), the largest (max) and the mean (mean); and each frame's mean luminance
//   (lum, Rec. 601 weights) and mean alpha (alpha); win { x: [x0, x1], y: [y0, y1] } (fractions of the pane): only
//   the pixels in that window;
// - GI_REF: a page script that defines the exact picture of a glide frame at its own u (steps_glide_inverse_cmd.js
//   uses it too): __giRef(P, F, tol = 6, step = 10) samples the frame F every step px; at each pixel w it solves H_u(z) = w by
//   Newton's method from seeds over the window, an 8 x 6 grid or window.__giSeeds ([columns, rows]) (H_u and the
//   front sheet's key from the glide's record, __cmwSteps().glide), takes the front z (Inverse.front's order: keys in
//   steps of 2^-8 octave, ties by larger Im z, then larger Re z) among the roots in the regions
//   (where P is not the paper: a map many-to-one onto w under Inside regions; every root when none is, or with
//   window.__giAllRoots) and colours w as P, plane z's
//   parked frame, colours z (bilinear). A pixel whose front covered root could be one off P's canvas (whose cover P
//   cannot show) counts as none. Pixels next
//   to a colour line (__giRange: a 4 x 4 neighbourhood spanning more than 12 levels, in P about z or in F about w) are
//   not compared. Frames are { W, H, d } (d: the RGBA bytes). Answers { n compared, none (no z on the canvas), max,
//   over: the share of n more than tol apart in a channel };
// - refOf(base, tag, tol, step = 10): __giRef of two kept frames (base: plane z's parked frame) sampled every step px, or
//   null when the glide's record has no sheet key (a frame the carried mesh draws); timeout (ms) bounds the page call;
// - fade(a, b, t, tag): the kept frames a and b cross-faded, (1 - t) a + t b per channel, kept as __heldPx[tag] (what a
//   frame that blends the two planes' pictures instead of carrying the colour would show); true when both exist;
// - judge(base, tag, o): the carried colour of the kept frame tag, held between plane z's parked frame base and a later
//   plane, graded against the exact picture (refOf with o.tol, default JUDGE_TOL, every o.step px, default 10):
//   { path, u, n, over, max, none, pass }, pass when at least o.minN (default JUDGE_MIN_N) pixels were compared and at
//   most the share o.maxOver (default JUDGE_OVER) of them are more than the tolerance apart; pass is false when the
//   glide's record has no sheet key (a frame the carried mesh draws; refOf answers null), with n 0; o.seeds: [columns,
//   rows] of the reference's Newton seeds (window.__giSeeds), for a frame whose roots the default 8 x 6 grid misses;
// - sameAway(a, b, tol, keep): two kept frames compared pixel by pixel away from the colour lines (a pixel where either
//   frame's __giRange spans more than 12 levels is left out), only where keep holds (the source of a page function of
//   the device pixel (x, y); every pixel without it): { n compared, max, over: the share of n more than tol apart }.
(() => {
  // (the page script of the exact reference, as written for steps_glide_inverse_cmd.js)
  const RANGE = `window.__giRange = (P, W, x, y) => { let r = 0; for (let c = 0; c < 3; c++) { let lo = 255, hi = 0; for (let dy = -1; dy <= 2; dy++) for (let dx = -1; dx <= 2; dx++) { const v = P[4 * ((y + dy) * W + x + dx) + c]; lo = Math.min(lo, v); hi = Math.max(hi, v); } r = Math.max(r, hi - lo); } return r; };`;
  const REF = `window.__giRef = (P, F, tol = 6, step = 10) => {
  const g = __cmwSteps().glide, H = g.H, v = g.view, W = F.W, Ht = F.H, dpr = W / g.w, C = (re, im) => ({ re, im });
  const s2w = (x, y) => C(v.cx + (x / dpr - g.w / 2) / v.s, v.cy - (y / dpr - g.h / 2) / v.s);
  const x0 = v.cx - g.w / 2 / v.s, x1 = v.cx + g.w / 2 / v.s, y0 = v.cy - g.h / 2 / v.s, y1 = v.cy + g.h / 2 / v.s, seeds = [];
  const [SX, SY] = window.__giSeeds || [8, 6];
  for (let i = 0; i < SX; i++) for (let j = 0; j < SY; j++) seeds.push(C(x0 + (i + 0.5) * (x1 - x0) / SX, y0 + (j + 0.5) * (y1 - y0) / SY));
  // (the parked frame's paper, where Inside regions leaves a pixel outside the regions; null: none known)
  const sh = (__cmwShapes().shapes || [])[0], ph = sh && !window.__giAllRoots ? __cmwLook(sh.id, 'L').plane : null;
  const paper = ph && /^#[0-9a-f]{6}$/i.test(ph) ? [1, 3, 5].map((i) => parseInt(ph.slice(i, i + 2), 16)) : null;
  // (true / false: z in the regions or on the paper; null: z off P's canvas, where P cannot tell)
  const covers = (z) => {
    if (!paper) return true;
    const x = Math.round(((z.re - v.cx) * v.s + g.w / 2) * dpr - 0.5), y = Math.round((g.h / 2 - (z.im - v.cy) * v.s) * dpr - 0.5);
    if (x < 0 || y < 0 || x >= W || y >= Ht) return null;
    const i = 4 * (y * W + x);
    return Math.max(Math.abs(P.d[i] - paper[0]), Math.abs(P.d[i + 1] - paper[1]), Math.abs(P.d[i + 2] - paper[2])) > 12;
  };
  let n = 0, over = 0, none = 0, max = 0;
  for (let py = 4; py < Ht - 4; py += step) for (let px = 4; px < W - 4; px += step) {
    const w = s2w(px + 0.5, py + 0.5);
    let best = null, bk = Infinity, bcv = false, kOff = Infinity;
    for (const s0 of seeds) {
      let z = s0;
      for (let it = 0; it < 40 && z; it++) {
        const f = H(z), h = 1e-7 * (1 + Math.hypot(z.re, z.im)), f2 = H(C(z.re + h, z.im));
        const d = C((f2.re - f.re) / h, (f2.im - f.im) / h), dd = d.re * d.re + d.im * d.im, r = C(f.re - w.re, f.im - w.im);
        if (!(dd > 0) || !isFinite(dd)) { z = null; break; }
        let st = C((r.re * d.re + r.im * d.im) / dd, (r.im * d.re - r.re * d.im) / dd);
        const sl = Math.hypot(st.re, st.im), mx = 2 + 0.5 * Math.hypot(z.re, z.im);
        if (sl > mx) st = C(st.re * mx / sl, st.im * mx / sl);
        z = C(z.re - st.re, z.im - st.im);
        if (!isFinite(z.re) || !isFinite(z.im)) z = null;
        else if (sl < 1e-12 * (1 + Math.hypot(z.re, z.im))) break;
      }
      if (!z) continue;
      const f = H(z);
      if (!(Math.hypot(f.re - w.re, f.im - w.im) <= 1e-9 * (1 + Math.hypot(w.re, w.im)))) continue;
      const k = g.key(z), cv = covers(z);
      if (cv === null) { kOff = Math.min(kOff, k); continue; }
      // (the renderer's front, Inverse.front: keys in the same step of 2^-8 octave tie, then larger Im z, then larger Re z)
      const sk = Math.round(k / 2 ** -8), sb = Math.round(bk / 2 ** -8);
      const ahead = !best || (sk !== sb ? k < bk : z.im !== best.im ? z.im > best.im : z.re > best.re);
      if (best === null || (cv && !bcv) || (cv === bcv && ahead)) { bk = k; best = z; bcv = cv; }
    }
    // (a root off P's canvas in front of the front covered root, or any such root when none is covered, may be the one
    // the renderer colours w by: the regions run past the canvas, so w's colour is not known)
    if (!best || kOff < (bcv ? bk : Infinity)) { none++; continue; }
    const fx = ((best.re - v.cx) * v.s + g.w / 2) * dpr - 0.5, fy = (g.h / 2 - (best.im - v.cy) * v.s) * dpr - 0.5, qx = Math.floor(fx), qy = Math.floor(fy), ax = fx - qx, ay = fy - qy;
    if (qx < 2 || qy < 2 || qx >= W - 3 || qy >= Ht - 3) { none++; continue; }
    if (__giRange(P.d, W, qx, qy) > 12 || __giRange(F.d, W, px, py) > 12) continue;
    const at = (x, y, c) => P.d[4 * (y * W + x) + c], o = 4 * (py * W + px);
    let m = 0;
    for (let c = 0; c < 3; c++) m = Math.max(m, Math.abs(F.d[o + c] - ((1 - ay) * ((1 - ax) * at(qx, qy, c) + ax * at(qx + 1, qy, c)) + ay * ((1 - ax) * at(qx, qy + 1, c) + ax * at(qx + 1, qy + 1, c)))));
    n++; max = Math.max(max, m); if (m > tol) over++;
  }
  return { n, none, max: Math.round(max), over: +(over / Math.max(1, n)).toFixed(5) };
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
  const grab = async (tag) => {
    for (let n = 0; n < 150; n++) {
      const same = await ev(`(() => { const c = document.getElementById('canvasL'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, g = window.__heldPx || (window.__heldPx = {}), p = g._prev;
        g._prev = d; if (!p || p.length !== d.length) return false; for (let i = 0; i < d.length; i++) if (p[i] !== d[i]) return false; g[${JSON.stringify(tag)}] = d; return true; })()`);
      if (same) return true;
      await sleep(100);
    }
    return false;
  };
  const compare = (a, b, win = null) => ev(`(() => {
    const A = window.__heldPx[${JSON.stringify(a)}], B = window.__heldPx[${JSON.stringify(b)}];
    if (!A || !B || A.length !== B.length) return null;
    const lum = (P, i) => 0.299 * P[i] + 0.587 * P[i + 1] + 0.114 * P[i + 2];
    let over = 0, max = 0, sum = 0, la = 0, lb = 0, aa = 0, ab = 0, n = 0;
    const cv = document.getElementById('canvasL'), W = cv.width, H = cv.height, win = ${JSON.stringify(win)};
    const x0 = win ? Math.round(win.x[0] * W) : 0, x1 = win ? Math.round(win.x[1] * W) : W, y0 = win ? Math.round(win.y[0] * H) : 0, y1 = win ? Math.round(win.y[1] * H) : H;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = 4 * (y * W + x);
      n++;
      const m = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]));
      if (m > ${DIFF_TOL}) over++;
      if (m > max) max = m;
      sum += m; la += lum(A, i); lb += lum(B, i); aa += A[i + 3]; ab += B[i + 3];
    }
    const r = (v) => +v.toFixed(4);
    return { frac: r(over / n), max, mean: r(sum / n), lum: [r(la / n), r(lb / n)], alpha: [r(aa / n), r(ab / n)], px: n };
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
  const refOf = (base, tag, tol, step = 10, timeout = 20000) => ev(`(() => {
    ${GI_REF}
    const g = __cmwSteps().glide, c = document.getElementById('canvasL'), K = window.__heldPx, f = (t) => ({ W: c.width, H: c.height, d: K[t] });
    if (!g || !g.key || !K[${JSON.stringify(base)}] || !K[${JSON.stringify(tag)}]) return { path: g && g.path, u: g && g.u, ref: null };
    return { path: g.path, u: g.u, ref: __giRef(f(${JSON.stringify(base)}), f(${JSON.stringify(tag)}), ${tol}, ${step}) };
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
    const A = window.__heldPx[${JSON.stringify(a)}], B = window.__heldPx[${JSON.stringify(b)}], c = document.getElementById('canvasL'), W = c.width, H = c.height, K = ${keep || 'null'};
    if (!A || !B || A.length !== B.length) return null;
    let n = 0, over = 0, max = 0;
    for (let y = 2; y < H - 3; y++) for (let x = 2; x < W - 3; x++) {
      if ((K && !K(x, y)) || __giRange(A, W, x, y) > 12 || __giRange(B, W, x, y) > 12) continue;
      const i = 4 * (y * W + x), m = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]));
      n++; if (m > max) max = m; if (m > ${tol}) over++;
    }
    return { n, max, over: +(over / Math.max(1, n)).toFixed(5) };
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
    const r = await refOf(base, tag, tol, o.step || 10, o.seeds ? JUDGE_SEEDS_MS : 20000);
    if (o.seeds) await ev('delete window.__giSeeds, 1');
    if (!r || !r.ref) return { path: r && r.path, u: r && r.u, n: 0, over: null, max: null, none: null, pass: false };
    const q = r.ref;
    return { path: r.path, u: r.u, n: q.n, over: q.over, max: q.max, none: q.none, pass: q.n >= minN && q.over <= maxOver };
  };
  return { hold, UNHELD, grab, compare, sameAway, fade, judge, JUDGE_TOL, JUDGE_MIN_N, JUDGE_OVER, edgeRuns, refOf, gridOver, outlines, GI_REF, DIFF_TOL };
})()
