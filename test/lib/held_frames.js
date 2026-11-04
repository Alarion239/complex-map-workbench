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
//   __cmwSteps().glide), takes the front z and colours w as P, plane z's parked frame, colours z (bilinear). Pixels next
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
  let n = 0, over = 0, none = 0, max = 0;
  for (let py = 4; py < Ht - 4; py += 10) for (let px = 4; px < W - 4; px += 10) {
    const w = s2w(px + 0.5, py + 0.5);
    let best = null, bk = Infinity;
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
      const k = g.key(z);
      if (k < bk) { bk = k; best = z; }
    }
    if (!best) { none++; continue; }
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
  return { hold, grab, compare, edgeRuns, refOf, GI_REF, DIFF_TOL };
})()
