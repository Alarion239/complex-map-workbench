// The pixel compare of kept frames (canvas pixels, RGBA bytes, row by row): the arithmetic the frame suites share, as plain
// functions (test/t_pixel_diff.js runs them in node, test/lib/held_frames.js's compareKept on node buffers) and as the page
// script SCRIPT, which defines them in a page (window.__pxDiff, window.__giRange) for a suite's page code.
// An expression for eval, as held_frames.js is: `const { pixelDiff, range, SCRIPT } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'pixel_diff.js'), 'utf8'))`.
// - range(P, W, x, y): the largest spread over R, G and B of the 4 x 4 pixels of P (W wide) from (x - 1, y - 1) to
//   (x + 2, y + 2); over 12 marks a colour line, an edge or a stroke there;
// - pixelDiff(A, B, o): A against B, pixel by pixel. A pixel's difference is its largest channel difference (R, G, B, 0..255).
//   o: W, H (the frames' size; without them the frames are one row), tol (default 0), step (every step-th pixel of every
//   step-th row, default 1), edge [lo, hi] (from lo to W - hi and H - hi, default [0, 0]), win { x: [x0, x1], y: [y0, y1] }
//   (fractions of the frame, rounded to pixels, in place of edge), keep(x, y) (only where it holds), away (left out: the
//   pixels where either frame's range is over it). Answers over the n pixels compared { n, apart (differing at all),
//   over (more than tol), frac (over / n), max, mean (of the differences), chMean (of every channel's difference),
//   lum [A, B] (mean luminance, Rec. 601 weights), alpha [A, B] (mean alpha) }, every mean 0 for n = 0.
(() => {
  function range(P, W, x, y) {
    let r = 0;
    for (let c = 0; c < 3; c++) {
      let lo = 255, hi = 0;
      for (let dy = -1; dy <= 2; dy++) for (let dx = -1; dx <= 2; dx++) { const v = P[4 * ((y + dy) * W + x + dx) + c]; lo = Math.min(lo, v); hi = Math.max(hi, v); }
      r = Math.max(r, hi - lo);
    }
    return r;
  }
  function pixelDiff(A, B, o = {}) {
    const W = o.W || A.length / 4, H = o.H || 1, tol = o.tol || 0, step = o.step || 1, e = o.edge || [0, 0], w = o.win;
    const x0 = w ? Math.round(w.x[0] * W) : e[0], x1 = w ? Math.round(w.x[1] * W) : W - e[1];
    const y0 = w ? Math.round(w.y[0] * H) : e[0], y1 = w ? Math.round(w.y[1] * H) : H - e[1];
    let n = 0, apart = 0, over = 0, max = 0, sum = 0, ch = 0, la = 0, lb = 0, aa = 0, ab = 0;
    for (let y = y0; y < y1; y += step) for (let x = x0; x < x1; x += step) {
      if ((o.keep && !o.keep(x, y)) || (o.away != null && (range(A, W, x, y) > o.away || range(B, W, x, y) > o.away))) continue;
      const i = 4 * (y * W + x);
      let m = 0;
      for (let c = 0; c < 3; c++) { const d = Math.abs(A[i + c] - B[i + c]); ch += d; if (d > m) m = d; }
      n++; sum += m;
      if (m) apart++;
      if (m > tol) over++;
      if (m > max) max = m;
      la += 0.299 * A[i] + 0.587 * A[i + 1] + 0.114 * A[i + 2]; lb += 0.299 * B[i] + 0.587 * B[i + 1] + 0.114 * B[i + 2];
      aa += A[i + 3]; ab += B[i + 3];
    }
    const k = Math.max(1, n);
    return { n, apart, over, frac: over / k, max, mean: sum / k, chMean: ch / 3 / k, lum: [la / k, lb / k], alpha: [aa / k, ab / k] };
  }
  const SCRIPT = `(() => { ${range}\n${pixelDiff}\nwindow.__giRange = range; window.__pxDiff = pixelDiff; })();`;
  return { range, pixelDiff, SCRIPT };
})()
