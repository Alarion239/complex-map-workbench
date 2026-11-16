// The colour key's ring in an exported figure (#1707): the app's hue wheel on an annulus, drawn in vector. Before, it was
// a 300 dpi RGB bitmap clipped to the band, which showed its pixels when a PDF viewer zoomed in, stayed at 300 dpi in a
// 600 dpi PNG and left its edges to the viewer's clip. Here (figure/03-views.js ringKeyMarkup, as Figure.geom.ringKey):
// no image and no clip; sectors between the two radii that cover the whole turn, the one drawn last at each angle in the
// hue the app gives that angle (t = (arg + pi) / 2 pi, as the bitmap was); each sector reaching under the next, so no
// seam of anti-aliasing shows between two; and the ring outlined at both radii. Run: node test/t_figure_ringkey.js
const vm = require('vm'), path = require('path');
const R = path.join(__dirname, '..');
global.CX = require(R + '/src/cx.js');
global.Expr = require(R + '/src/parse.js');
global.Funcs = require(R + '/src/funcs.js');
global.Region = require(R + '/src/region.js');
global.window = global;
vm.runInThisContext(require('./src_text').source('figure.js', R + '/src', { esm: 'strip' }) + '\n;globalThis.Figure = Figure;', { filename: 'figure.js' });
let pass = 0, fail = 0;
const ok = (cond, name, extra) => { if (cond) pass++; else { fail++; console.log('FAIL', name, extra === undefined ? '' : JSON.stringify(extra)); } };

// a smooth wheel of the test's own (bytes, as the app's hueBytes): a channel changes by at most 255 pi / 360 ~ 2.2 a degree
const hue = (t) => [127.5 + 127.5 * Math.cos(2 * Math.PI * t), 127.5 + 127.5 * Math.sin(2 * Math.PI * t), 255 * Math.abs(2 * t - 1)].map(Math.round);
Figure.attach({ hue });
const ringKey = Figure.geom && Figure.geom.ringKey;
ok(typeof ringKey === 'function', 'Figure.geom.ringKey is the ring key\'s markup');
// (a channel may differ from the hue at the angle by this much: the change over one sector plus rounding)
const COLOUR_TOL = 3;
// (the outline's radii and the sectors' corners are written to 0.01 pt; a chord of a 2-degree sector bows 0.0006 R inside its arc)
const RAD_TOL = 0.02;
const SAMPLES = 1440;
for (const [kx, ky, Rr] of [[100, 80, 19], [320.5, 140.25, 14], [40, 40, 6]]) {
  const tag = `ring at (${kx}, ${ky}), R ${Rr}`;
  const m = typeof ringKey === 'function' ? String(ringKey(kx, ky, Rr, 'k1')) : '';
  ok(m && !/<image\b/.test(m) && !/data:image/.test(m), `${tag}: no bitmap`, m.slice(0, 160));
  ok(m && !/clip-?path/i.test(m), `${tag}: no clip`);
  ok(/^<g id="k1">/.test(m) && /<\/g>$/.test(m), `${tag}: one group with the key's id`, m.slice(0, 40));
  // the outline: two circles, at R and at the inner radius
  const circles = [...m.matchAll(/<circle cx="([-\d.]+)" cy="([-\d.]+)" r="([\d.]+)" fill="none" stroke="#000000" stroke-width="0.5"\/>/g)].map((c) => c.slice(1).map(Number));
  ok(circles.length === 2 && circles.every((c) => Math.abs(c[0] - kx) < RAD_TOL && Math.abs(c[1] - ky) < RAD_TOL), `${tag}: outlined by two circles round its centre`, circles);
  const r0 = circles.length === 2 ? Math.min(circles[0][2], circles[1][2]) : 0;
  ok(circles.length === 2 && Math.abs(Math.max(circles[0][2], circles[1][2]) - Rr) < RAD_TOL && r0 > 0.3 * Rr && r0 < 0.8 * Rr, `${tag}: the outline's radii`, circles.map((c) => c[2]));
  // the sectors, in drawing order: their four corners, two on each radius, and their fill
  const secs = [...m.matchAll(/<path d="M([-\d.]+) ([-\d.]+)L([-\d.]+) ([-\d.]+)L([-\d.]+) ([-\d.]+)L([-\d.]+) ([-\d.]+)Z" fill="#([0-9a-f]{6})"\/>/g)].map((s) => {
    const p = [0, 1, 2, 3].map((k) => [+s[1 + 2 * k] - kx, ky - +s[2 + 2 * k]]);
    return { r: p.map((q) => Math.hypot(q[0], q[1])), a: p.map((q) => Math.atan2(q[1], q[0])), fill: [0, 2, 4].map((k) => parseInt(s[9].slice(k, k + 2), 16)) };
  });
  ok(secs.length >= 180, `${tag}: the wheel is at least 180 sectors`, secs.length);
  ok(secs.every((s) => Math.abs(s.r[0] - Rr) < RAD_TOL && Math.abs(s.r[1] - Rr) < RAD_TOL && Math.abs(s.r[2] - r0) < RAD_TOL && Math.abs(s.r[3] - r0) < RAD_TOL), `${tag}: every sector runs from the inner radius to the outer`, secs.slice(0, 2).map((s) => s.r));
  // a sector's span, counterclockwise from its first corner to its second (the inner corners on the same rays)
  const span = (s) => { let d = s.a[1] - s.a[0]; while (d <= 0) d += 2 * Math.PI; return [s.a[0], d]; };
  // (corners written to 0.01 pt: an angle is off by at most 0.0071 pt over its radius)
  const RAY_TOL = 0.0075 / r0 + 0.0075 / Rr;
  const sameRay = secs.every((s) => { const d = (u, v) => Math.abs(Math.atan2(Math.sin(u - v), Math.cos(u - v))); return d(s.a[0], s.a[3]) < RAY_TOL && d(s.a[1], s.a[2]) < RAY_TOL; });
  ok(sameRay, `${tag}: each sector's inner corners lie on its outer corners' rays`);
  const narrow = secs.every((s) => span(s)[1] < 0.1);
  ok(narrow, `${tag}: every sector is thin (under 6 degrees)`, secs.map((s) => +(span(s)[1] * 180 / Math.PI).toFixed(2)).slice(0, 4));
  if (!secs.length || !narrow) continue;
  // at each angle: the last sector drawn over it is the one seen; it is in the hue of that angle, and the one under it
  // reaches past the angle (no seam): no angle is left bare
  const inside = (s, a) => { const [a0, d] = span(s); let u = a - a0; while (u < 0) u += 2 * Math.PI; while (u >= 2 * Math.PI) u -= 2 * Math.PI; return u <= d ? u : -1; };
  let bare = 0, worst = 0, worstAt = null, seams = 0;
  for (let k = 0; k < SAMPLES; k++) {
    const a = -Math.PI + (k + 0.5) * 2 * Math.PI / SAMPLES;
    let top = -1;
    for (let i = secs.length - 1; i >= 0; i--) if (inside(secs[i], a) >= 0) { top = i; break; }
    if (top < 0) { bare++; continue; }
    const want = hue((a + Math.PI) / (2 * Math.PI)), e = Math.max(...want.map((v, c) => Math.abs(v - secs[top].fill[c])));
    if (e > worst) { worst = e; worstAt = { deg: +(a * 180 / Math.PI).toFixed(2), want, got: secs[top].fill }; }
    // the seen sector's starting edge lies on a sector drawn before it (which reaches past it), unless it is the first
    const [a0] = span(secs[top]);
    if (top > 0 && !secs.slice(0, top).some((s) => { const u = inside(s, a0); return u > 1e-3 && u < span(s)[1] - 1e-3; })) seams++;
  }
  ok(bare === 0, `${tag}: the sectors cover the whole turn`, { bare, of: SAMPLES });
  ok(worst <= COLOUR_TOL, `${tag}: the colour seen at each angle is the app's hue there (within ${COLOUR_TOL})`, worstAt);
  ok(seams === 0, `${tag}: each sector's edge lies over the sector before it (no seam)`, seams);
  // the first sector reaches back under the last one drawn, so the seam at -pi is covered too
  const last = secs[secs.length - 1], [l0, ld] = span(last), end = l0 + ld;
  ok(inside(secs[0], end) > 1e-3, `${tag}: the last sector ends over the first`, { end: +(end * 180 / Math.PI).toFixed(2), first: span(secs[0]).map((v) => +(v * 180 / Math.PI).toFixed(2)) });
}
console.log(`t_figure_ringkey: ${pass}/${pass + fail}`);
process.exit(fail ? 1 : 0);
