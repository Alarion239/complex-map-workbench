// The steps view's frames held still and read: what the glide-look suite (steps_glide_look_cmd.js) uses. An expression
// for eval in a suite: `const { hold, grab, compare } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'))`.
// - hold(x): the thread held at place x mid-glide, as a user holding it: a scrub on the rail, pressed on the first plane
//   and not let go (window.__svScrubUp lets it go). Answers settled()'s { ok, ms, busy } once the programs are linked,
//   the thread is within HOLD_EPS of x and the view draws the moving frames;
// - grab(tag): canvasL's pixels kept in the page as __heldPx[tag] once two reads 100 ms apart agree (the frame is still);
//   true when they did;
// - compare(a, b): two kept frames' difference, each pixel's largest channel difference (RGB, 0..255): the share of the
//   pixels more than DIFF_TOL apart (frac), the largest (max) and the mean (mean); and each frame's mean luminance
//   (lum, Rec. 601 weights) and mean alpha (alpha).
(() => {
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
  return { hold, grab, compare, edgeRuns, DIFF_TOL };
})()
