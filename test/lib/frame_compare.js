// The pane-frame compare of the glide suites that read canvasL's pixels (steps_negpow_glide_cmd.js). An expression for eval
// in a suite, which supplies ev: `const K = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'frame_compare.js'), 'utf8'))`.
// - grab(tag): the left pane's pixels, kept in the page under tag;
// - coloured(tag): the number of pixels of a kept frame in a phase colour (max - min channel over SAT_MIN);
// - compare(a, b, shift): over the pixels frame a colours, { n, wrong }: how many, and the share of them more than
//   COLOUR_TOL (per channel, of 255) from frame b's pixel after a's channels are moved by shift; null when the frames differ in size.
(() => {
  const SAT_MIN = 60;
  const COLOUR_TOL = 32;
  const grab = (tag) => ev(`(() => { const c = document.getElementById('canvasL'), s = document.createElement('canvas'); s.width = c.width; s.height = c.height; const g = s.getContext('2d', { willReadFrequently: true }); g.drawImage(c, 0, 0); window.__fc = window.__fc || {}; window.__fc[${JSON.stringify(tag)}] = g.getImageData(0, 0, s.width, s.height).data; return 1; })()`);
  const coloured = (tag) => ev(`(() => { const d = window.__fc[${JSON.stringify(tag)}]; let n = 0; for (let i = 0; i < d.length; i += 4) if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > ${SAT_MIN}) n++; return n; })()`);
  const compare = (a, b, shift) => ev(`(() => { const A = window.__fc[${JSON.stringify(a)}], B = window.__fc[${JSON.stringify(b)}]; if (!A || !B || A.length !== B.length) return null; let n = 0, bad = 0; for (let i = 0; i < A.length; i += 4) { if (Math.max(A[i], A[i + 1], A[i + 2]) - Math.min(A[i], A[i + 1], A[i + 2]) <= ${SAT_MIN}) continue; n++; if (Math.max(Math.abs(A[i] + ${shift} - B[i]), Math.abs(A[i + 1] + ${shift} - B[i + 1]), Math.abs(A[i + 2] + ${shift} - B[i + 2])) > ${COLOUR_TOL}) bad++; } return { n, wrong: n ? bad / n : null }; })()`);
  return { grab, coloured, compare };
})()
