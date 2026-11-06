// P3 acceptance (notes/sphere-design/SPEC.md 12.4 (i)) in the classic view (ci/suite_views.js: classic): the spherical
// checker drawn on the GPU, its log(H) columns where they belong, and no pattern menu for the user. The steps view has
// no region pattern (one colouring: ux on #719), so these stay with the classic view. The other P3 acceptance checks
// are test/p3_accept_cmd.js.
// A command file for a CDP daemon (test/cdp_kit README):
//   python3 build.py && test/<you>_cdp/q.sh test/p3_accept_classic_cmd.js
// Prints {pass, fails, results}; pass is true when every check holds.
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const base = { pattern: 'solid', alpha: 1, lines: false, unit: false };
const H = { id: 's1', kind: 'halfplane', a: [0, 0], b: [1, 0] };
const settle = async (ms = 2500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
await view(1440, 900, false);
// ---- (i) the spherical checker on the GPU: log(H) columns at Re w = ln tan(j pi / 16) +- 0.5 px
await load('p3i' + Date.now(), Object.assign({ shapes: [H], steps: [{ type: 'log', params: { cut: 180, k: 0 }, on: true }], srcView: { cx: 0, cy: 1, s: 60 } }, base, { pattern: 'sphere' }));
await settle();
// (#363: the renderer's spherical checker stays, drawn here through the test hook; the user has no pattern menu)
R.menu = await ev(`document.querySelectorAll('#patternSeg, [data-pat]').length`);
ok('(i) no pattern menu: the regions are filled by the phase', R.menu === 0, R.menu);
R.i = await ev(`(() => {
  const lk = __cmwLook('s1', 'R'), s = lk.view.s * lk.dpr, W = lk.W, Hh = lk.H;
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const c0 = hex(lk.color), c1 = hex(lk.color2);
  const cv = document.getElementById('canvasR'), g = document.createElement('canvas'); g.width = cv.width; g.height = cv.height;
  const x = g.getContext('2d'); x.drawImage(cv, 0, 0); const D = x.getImageData(0, 0, g.width, g.height).data;
  const tOf = (k) => { let num = 0, den = 0; for (let q = 0; q < 3; q++) { const d = c1[q] - c0[q]; num += (D[4 * k + q] - c0[q]) * d; den += d * d; } return num / den; };
  const wy = 5 * Math.PI / 16, j = Math.round(Hh / 2 - (wy - lk.view.cy) * s - 0.5);
  const vals = []; for (let i = 0; i < W; i++) vals.push(tOf(j * W + i));
  const xs = []; for (let i = 1; i < W; i++) { const a = vals[i - 1] - 0.5, b = vals[i] - 0.5; if (a * b < 0) xs.push(i - 1 + a / (a - b) + 0.5); }
  let worst = 0, matched = 0, expected = 0;
  for (let q = 1; q < 16; q++) {
    const re = Math.log(Math.tan(q * Math.PI / 16)), px = (re - lk.view.cx) * s + W / 2;
    if (px < 3 || px > W - 3) continue;
    const wl = (re - Math.log(Math.tan((q - 1) * Math.PI / 16))) * s, wr = (Math.log(Math.tan((q + 1) * Math.PI / 16)) - re) * s;
    if (!(wl >= 3 && wr >= 3)) continue;
    expected++;
    const d = Math.min(...xs.map((c) => Math.abs(c - px)));
    worst = Math.max(worst, d); if (d <= 0.5) matched++;
  }
  return { expected, matched, worst: +worst.toFixed(3), crossings: xs.length, sphN: lk.sphN };
})()`);
ok('(i) GPU sphere checker log(H) columns within 0.5 px', R.i.expected >= 4 && R.i.matched === R.i.expected, R.i);
await shot('p3_i_logH_sphere');

R.logs = logs().filter((l) => /error|exception/i.test(l.t) && !/404/.test(l.m)).slice(0, 6);
ok('no console errors', R.logs.length === 0, R.logs);
return { pass: fails.length === 0, fails, results: R };
