// The steps view's frames held still and read, and the exact picture of a glide frame: what steps_glide_look_cmd.js uses
// (steps_glide_inverse_cmd.js uses GI_REF). An expression for eval in a suite: `const { hold, grab, compare } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'))`.
// - hold(x): the thread held at place x mid-glide, as a user holding it: a scrub on the rail, pressed on the first plane
//   and not let go (window.__svScrubUp lets it go). Answers settled()'s { ok, ms, busy } once the programs are linked,
//   the thread is within HOLD_EPS of x and the view draws the moving frames;
// - grab(tag): canvasL's pixels kept in the page as __heldPx[tag] once two reads 100 ms apart agree (the frame is still);
//   true when they did;
// - compare(a, b): two kept frames' difference, each pixel's largest channel difference (RGB, 0..255): the share of the
//   pixels more than DIFF_TOL apart (frac), the largest (max) and the mean (mean); and each frame's mean luminance
//   (lum, Rec. 601 weights) and mean alpha (alpha);
// - GI_REF: a page script that defines the exact picture of a glide frame at its own u (steps_glide_inverse_cmd.js
//   uses it too): __giRef(P, F, tol = 6) samples the frame F every 10 px; at each pixel w it solves H_u(z) = w by
//   Newton's method from seeds over the window (H_u and the front sheet's key from the glide's record,
//   __cmwSteps().glide), takes the front z among the roots in the regions (where P is not the paper: a map many-to-one
//   onto w under Inside regions; every root when none is, or with window.__giAllRoots) and colours w as P, plane z's
//   parked frame, colours z (bilinear). A pixel whose front covered root could be one off P's canvas (whose cover P
//   cannot show) counts as none. Pixels next
//   to a colour line (__giRange: a 4 x 4 neighbourhood spanning more than 12 levels, in P about z or in F about w) are
//   not compared. Frames are { W, H, d } (d: the RGBA bytes). Answers { n compared, none (no z on the canvas), max,
//   over: the share of n more than tol apart in a channel };
// - refOf(base, tag, tol): __giRef of two kept frames (base: plane z's parked frame), or null when the glide's record
//   has no sheet key (a frame the carried mesh draws).
(() => {
  // (the page script of the exact reference, as written for steps_glide_inverse_cmd.js)
  const RANGE = `window.__giRange = (P, W, x, y) => { let r = 0; for (let c = 0; c < 3; c++) { let lo = 255, hi = 0; for (let dy = -1; dy <= 2; dy++) for (let dx = -1; dx <= 2; dx++) { const v = P[4 * ((y + dy) * W + x + dx) + c]; lo = Math.min(lo, v); hi = Math.max(hi, v); } r = Math.max(r, hi - lo); } return r; };`;
  const REF = `window.__giRef = (P, F, tol = 6) => {
  const g = __cmwSteps().glide, H = g.H, v = g.view, W = F.W, Ht = F.H, dpr = W / g.w, C = (re, im) => ({ re, im });
  const s2w = (x, y) => C(v.cx + (x / dpr - g.w / 2) / v.s, v.cy - (y / dpr - g.h / 2) / v.s);
  const x0 = v.cx - g.w / 2 / v.s, x1 = v.cx + g.w / 2 / v.s, y0 = v.cy - g.h / 2 / v.s, y1 = v.cy + g.h / 2 / v.s, seeds = [];
  for (let i = 0; i < 8; i++) for (let j = 0; j < 6; j++) seeds.push(C(x0 + (i + 0.5) * (x1 - x0) / 8, y0 + (j + 0.5) * (y1 - y0) / 6));
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
  for (let py = 4; py < Ht - 4; py += 10) for (let px = 4; px < W - 4; px += 10) {
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
      if (best === null || (cv && !bcv) || (cv === bcv && k < bk)) { bk = k; best = z; bcv = cv; }
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
  const hold = async (x) => {
    await ev(`(() => {
      const rail = document.querySelector('.sv-rail'), ns = [...document.querySelectorAll('.sv-track .sv-plane')].map((b) => { const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
      const i = Math.min(ns.length - 2, Math.floor(${x})), cx = ns[i][0] + (ns[i + 1][0] - ns[i][0]) * (${x} - i), cy = ns[0][1];
      const ev = (type, px) => rail.dispatchEvent(new PointerEvent(type, { pointerId: 75, pointerType: 'mouse', button: 0, buttons: 1, isPrimary: true, bubbles: true, clientX: px, clientY: cy }));
      ev('pointerdown', ns[0][0] - 2); ev('pointermove', ns[0][0] + 10); ev('pointermove', cx);
      window.__svScrubUp = () => ev('pointerup', cx);
      return 1;
    })()`);
    return settled({ max: 60000, until: `GLR.pendingLinks === 0 && Math.abs(__cmwSvX() - ${x}) < ${HOLD_EPS} && __cmwSteps().moving` });
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
  const compare = (a, b) => ev(`(() => {
    const A = window.__heldPx[${JSON.stringify(a)}], B = window.__heldPx[${JSON.stringify(b)}];
    if (!A || !B || A.length !== B.length) return null;
    const lum = (P, i) => 0.299 * P[i] + 0.587 * P[i + 1] + 0.114 * P[i + 2];
    let over = 0, max = 0, sum = 0, la = 0, lb = 0, aa = 0, ab = 0;
    for (let i = 0; i < A.length; i += 4) {
      const m = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]));
      if (m > ${DIFF_TOL}) over++;
      if (m > max) max = m;
      sum += m; la += lum(A, i); lb += lum(B, i); aa += A[i + 3]; ab += B[i + 3];
    }
    const n = A.length / 4, r = (v) => +v.toFixed(4);
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
  const refOf = (base, tag, tol) => ev(`(() => {
    ${GI_REF}
    const g = __cmwSteps().glide, c = document.getElementById('canvasL'), K = window.__heldPx, f = (t) => ({ W: c.width, H: c.height, d: K[t] });
    if (!g || !g.key || !K[${JSON.stringify(base)}] || !K[${JSON.stringify(tag)}]) return { path: g && g.path, u: g && g.u, ref: null };
    return { path: g.path, u: g.u, ref: __giRef(f(${JSON.stringify(base)}), f(${JSON.stringify(tag)}), ${tol}) };
  })()`);
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
  const sameAway = (a, b, tol) => ev(`(() => {
    ${RANGE}
    const A = window.__heldPx[${JSON.stringify(a)}], B = window.__heldPx[${JSON.stringify(b)}], c = document.getElementById('canvasL'), W = c.width, H = c.height;
    if (!A || !B || A.length !== B.length) return null;
    let n = 0, over = 0, max = 0;
    for (let y = 2; y < H - 3; y++) for (let x = 2; x < W - 3; x++) {
      if (__giRange(A, W, x, y) > 12 || __giRange(B, W, x, y) > 12) continue;
      const i = 4 * (y * W + x), m = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]));
      n++; if (m > max) max = m; if (m > ${tol}) over++;
    }
    return { n, max, over: +(over / Math.max(1, n)).toFixed(5) };
  })()`);
  return { hold, grab, compare, sameAway, edgeRuns, refOf, gridOver, outlines, GI_REF, DIFF_TOL };
})()
