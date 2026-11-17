// test/lib/pixel_diff.js, the pixel compare the frame suites share: range and pixelDiff on frames built here, their
// options (tol, step, edge, win, keep, away), the page script SCRIPT defining the same functions, and, on random frames,
// the same numbers as the loops the suites computed them with before (held_frames.js's compare and sameAway,
// steps_glide_inverse's whole-frame and away-from-the-lines statistics, steps_sphere_look's mean). Run: node test/t_pixel_diff.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { range, pixelDiff, SCRIPT } = eval(fs.readFileSync(path.join(__dirname, 'lib', 'pixel_diff.js'), 'utf8'));
let pass = 0, fail = 0;
const ok = (name, cond, got) => { if (cond) pass++; else { fail++; console.log('FAIL ' + name + (got !== undefined ? ' ' + JSON.stringify(got) : '')); } };

// a W x H frame of one colour, and a pixel of it set
const frame = (W, H, rgba) => { const P = new Uint8ClampedArray(4 * W * H); for (let i = 0; i < P.length; i += 4) P.set(rgba, i); return P; };
const set = (P, W, x, y, rgba) => P.set(rgba, 4 * (y * W + x));
const W = 20, H = 10;

// ---- the same frames: nothing apart ----
{
  const A = frame(W, H, [10, 20, 30, 255]), r = pixelDiff(A, A.slice(), { W, H });
  ok('the same frames: every pixel compared, none apart', r.n === W * H && r.apart === 0 && r.over === 0 && r.max === 0 && r.mean === 0 && r.chMean === 0, r);
  ok('the same frames: luminance and alpha their means', Math.abs(r.lum[0] - (0.299 * 10 + 0.587 * 20 + 0.114 * 30)) < 1e-9 && r.alpha[0] === 255 && r.alpha[1] === 255, r);
}
// ---- one pixel apart: its largest channel difference ----
{
  const A = frame(W, H, [100, 100, 100, 255]), B = A.slice();
  set(B, W, 4, 3, [140, 90, 100, 255]);
  const r = pixelDiff(A, B, { W, H, tol: 32 }), n = W * H;
  ok('one pixel apart by 40 in red and 10 in green: apart 1, over 32 once, max 40', r.apart === 1 && r.over === 1 && r.max === 40, r);
  ok('… the mean of the largest differences 40 / n, of every channel 50 / 3 n', Math.abs(r.mean - 40 / n) < 1e-12 && Math.abs(r.chMean - 50 / 3 / n) < 1e-12 && Math.abs(r.frac - 1 / n) < 1e-12, r);
  ok('… not over a tolerance of 40', pixelDiff(A, B, { W, H, tol: 40 }).over === 0);
  ok('without a size the frames are one row: the same counts', JSON.stringify(pixelDiff(A, B, { tol: 32 })) === JSON.stringify(r));
  // (the window, the edge, the stride and keep leave the pixel (4, 3) in or out)
  ok('win: a window without the pixel compares none of it', pixelDiff(A, B, { W, H, win: { x: [0.5, 1], y: [0, 1] } }).apart === 0 && pixelDiff(A, B, { W, H, win: { x: [0.5, 1], y: [0, 1] } }).n === 10 * H);
  ok('win: a window with it finds it', pixelDiff(A, B, { W, H, win: { x: [0, 0.5], y: [0.2, 0.5] } }).apart === 1 && pixelDiff(A, B, { W, H, win: { x: [0, 0.5], y: [0.2, 0.5] } }).n === 10 * 3);
  const ed = pixelDiff(A, B, { W, H, edge: [5, 2] });
  ok('edge [5, 2]: from 5 to W - 2 and H - 2, the pixel left out', ed.n === (W - 7) * (H - 7) && ed.apart === 0, ed);
  const st = pixelDiff(A, B, { W, H, step: 2 });
  ok('step 2: every other pixel of every other row, the pixel (4, 3) not among them', st.n === (W / 2) * (H / 2) && st.apart === 0, st);
  ok('step 2 from (0, 1)…: not on it either; keep: only where it holds', pixelDiff(A, B, { W, H, keep: (x, y) => x === 4 && y === 3 }).n === 1 && pixelDiff(A, B, { W, H, keep: (x, y) => x === 4 && y === 3 }).apart === 1);
}
// ---- range: the spread of a 4 x 4 neighbourhood, and away ----
{
  const A = frame(W, H, [50, 50, 50, 255]);
  set(A, W, 10, 5, [50, 80, 50, 255]);
  ok('range: 30 where the 4 x 4 from (x - 1, y - 1) holds the odd pixel', range(A, W, 9, 4) === 30 && range(A, W, 11, 6) === 30 && range(A, W, 10, 5) === 30, [range(A, W, 9, 4), range(A, W, 11, 6)]);
  ok('range: 0 where it does not', range(A, W, 12, 5) === 0 && range(A, W, 10, 7) === 0 && range(A, W, 7, 5) === 0);
  const B = A.slice();
  set(B, W, 10, 5, [50, 50, 50, 255]);
  const r = pixelDiff(A, B, { W, H, edge: [2, 3], away: 12 });
  ok('away 12: the pixels whose neighbourhood holds the line are left out, the changed one with them', r.apart === 0 && r.n === (W - 5) * (H - 5) - 16, r);
}
// ---- the page script defines the same functions ----
{
  const ctx = { window: {} };
  vm.runInNewContext(SCRIPT, ctx);
  const A = frame(W, H, [1, 2, 3, 255]), B = A.slice();
  set(B, W, 1, 1, [9, 2, 3, 255]);
  ok('SCRIPT: window.__pxDiff and window.__giRange are pixelDiff and range', typeof ctx.window.__pxDiff === 'function' && JSON.stringify(ctx.window.__pxDiff(A, B, { W, H, tol: 4 })) === JSON.stringify(pixelDiff(A, B, { W, H, tol: 4 })) && ctx.window.__giRange(B, W, 1, 1) === range(B, W, 1, 1));
}
// ---- the same numbers as the loops the suites computed them with before, on random frames with lines in them ----
{
  let seed = 877;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const FW = 61, FH = 43;
  const randomFrame = () => {
    const P = new Uint8ClampedArray(4 * FW * FH);
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
      const i = 4 * (y * FW + x), line = (x + 2 * y) % 13 === 0;
      for (let c = 0; c < 3; c++) P[i + c] = line ? 255 : Math.round(100 + 40 * Math.sin(x / 40 + c) + 30 * Math.cos(y / 30));
      P[i + 3] = 200 + (x % 7);
    }
    return P;
  };
  // (B: A with a jitter of up to 3 levels everywhere and 3 % of its pixels up to 40 off)
  const noisy = (P) => { const Q = P.slice(); for (let i = 0; i < Q.length; i += 4) { const a = rnd() < 0.03 ? 80 : 6; for (let c = 0; c < 3; c++) Q[i + c] = Math.max(0, Math.min(255, Q[i + c] + Math.round(a * (rnd() - 0.5)))); } return Q; };
  for (let t = 0; t < 4; t++) {
    const A = randomFrame(), B = noisy(A);
    // held_frames' compare: share over DIFF_TOL = 32, max, mean of the largest differences, luminance and alpha, a window
    const win = t % 2 ? { x: [0.1, 0.8], y: [0.25, 0.9] } : null;
    const old = (() => {
      const lum = (P, i) => 0.299 * P[i] + 0.587 * P[i + 1] + 0.114 * P[i + 2];
      let over = 0, max = 0, sum = 0, la = 0, lb = 0, aa = 0, ab = 0, n = 0;
      const x0 = win ? Math.round(win.x[0] * FW) : 0, x1 = win ? Math.round(win.x[1] * FW) : FW, y0 = win ? Math.round(win.y[0] * FH) : 0, y1 = win ? Math.round(win.y[1] * FH) : FH;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const i = 4 * (y * FW + x);
        n++;
        const m = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]));
        if (m > 32) over++;
        if (m > max) max = m;
        sum += m; la += lum(A, i); lb += lum(B, i); aa += A[i + 3]; ab += B[i + 3];
      }
      return { frac: over / n, max, mean: sum / n, lum: [la / n, lb / n], alpha: [aa / n, ab / n], px: n };
    })();
    const now = pixelDiff(A, B, { W: FW, H: FH, tol: 32, win });
    ok(`random frames ${t}: compare's numbers`, now.frac === old.frac && now.max === old.max && now.mean === old.mean && now.n === old.px && now.lum.every((v, k) => Math.abs(v - old.lum[k]) < 1e-9) && now.alpha.every((v, k) => v === old.alpha[k]), { now, old });
    // held_frames' sameAway: from 2 to W - 3, away from the lines (range over 12), keep (a tolerance of 2, under B's jitter)
    const keep = (x, y) => (x + y) % 3 !== 0;
    const oldAway = (() => {
      let n = 0, over = 0, max = 0;
      for (let y = 2; y < FH - 3; y++) for (let x = 2; x < FW - 3; x++) {
        if (!keep(x, y) || range(A, FW, x, y) > 12 || range(B, FW, x, y) > 12) continue;
        const i = 4 * (y * FW + x), m = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]));
        n++; if (m > max) max = m; if (m > 2) over++;
      }
      return { n, max, over: over / Math.max(1, n) };
    })();
    const away = pixelDiff(A, B, { W: FW, H: FH, tol: 2, edge: [2, 3], away: 12, keep });
    ok(`random frames ${t}: sameAway's numbers`, away.n === oldAway.n && away.max === oldAway.max && away.frac === oldAway.over && away.n > 100 && away.over > 0, { away, oldAway });
    // steps_glide_inverse's statistics: the whole frame (mean of every channel, share over 6) and every third pixel from 3 away from the lines
    const oldStat = (() => { let n = 0, over = 0, sum = 0, max = 0; for (let i = 0; i < A.length; i += 4) { n++; let m = 0; for (let c = 0; c < 3; c++) { const d = Math.abs(A[i + c] - B[i + c]); sum += d; m = Math.max(m, d); } max = Math.max(max, m); if (m > 6) over++; } return { n, max, mean: sum / 3 / n, over: over / n }; })();
    const stat = pixelDiff(A, B, { W: FW, H: FH, tol: 6 });
    ok(`random frames ${t}: the whole frame's statistics`, stat.n === oldStat.n && stat.max === oldStat.max && Math.abs(stat.chMean - oldStat.mean) < 1e-12 && stat.frac === oldStat.over, { stat, oldStat });
    const oldSmooth = (() => { let n = 0, over = 0; for (let y = 3; y < FH - 3; y += 3) for (let x = 3; x < FW - 3; x += 3) { if (range(A, FW, x, y) > 12 || range(B, FW, x, y) > 12) continue; n++; const i = 4 * (y * FW + x); let m = 0; for (let c = 0; c < 3; c++) m = Math.max(m, Math.abs(A[i + c] - B[i + c])); if (m > 6) over++; } return { n, over: over / Math.max(1, n) }; })();
    const smooth = pixelDiff(A, B, { W: FW, H: FH, tol: 6, step: 3, edge: [3, 3], away: 12 });
    ok(`random frames ${t}: the away-from-the-lines statistics every third pixel`, smooth.n === oldSmooth.n && smooth.frac === oldSmooth.over && smooth.n > 20, { smooth, oldSmooth });
  }
}

console.log(`t_pixel_diff: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
