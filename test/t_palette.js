// Phase colours (issue 8, src/palette.js): Palette.arb against Arb's own color_function (examples/complex_plot.c,
// compiled with doubles for z: the values below are its output), the baked texels against Palette.arb (what the
// shaders' arbc() reads), the list the shaders index (uPal 0 the wheel, 2 the phase-only palette) and Palette.shade.
// Run: node test/t_palette.js
const P = require('../src/palette.js');
let fails = 0, n = 0;
function check(name, ok, info = '') { n++; if (!ok) { fails++; console.log('FAIL', name, info); } }
// [Re z, Im z, mode, Arb's R, G, B]
const REF = [
  [1, 0, 0, [0.900000000000, 0.100000000000, 0.100000000000]],
  [0, 1, 0, [0.500000000000, 0.900000000000, 0.100000000000]],
  [-1, 0, 0, [0.100000000000, 0.900000000000, 0.900000000000]],
  [0.3, -0.2, 0, [0.808507208461, 0.089834134273, 0.493369874248]],
  [1e-5, 2e-5, 0, [0.179578437137, 0.189206818445, 0.021022979827]],
  [4000, -300, 0, [0.968030705866, 0.712276352794, 0.730559180041]],
  [1, 0, 1, [1.000000000000, 1.000000000000, 1.000000000000]],
  [0, 1, 1, [0.900000000000, 0.500000000000, 0.000000000000]],
  [-1, 1e-9, 1, [0.000000004456, 0.000000000637, 0.000000000000]],
  [0.2, -0.7, 1, [0.078742695807, 0.559057021855, 0.960628652096]],
  [-3, -0.1, 1, [0.021212804811, 0.042425609622, 0.106064024055]],
  [0.5, 0.5, 2, [0.934410429651, 0.837874778617, 0.105918976367]],
  [-2, 1, 2, [0.416739254219, 0.954014931987, 0.581138191617]],
  [0.01, -0.03, 2, [0.521751580447, 0.110024856757, 0.800474517875]],
  [0.5, 0.5, 3, [1.000000000000, 0.750846127818, 0.040329406018]],
  [-2, 1, 3, [0.459376907019, 1.000000000000, 0.370754186206]],
  [30, -7, 3, [1.000000000000, 0.748990170663, 0.664974240265]],
  [0.5, 0.5, 4, [1.000000000000, 0.750846127818, 0.040329406018]],
  [-2, 1, 4, [0.444364407140, 0.926389779066, 0.552206498918]],
  [0.001, 0.002, 4, [0.584658556710, 0.709446251788, 0.043543512667]],
  [0.5, 0.5, 5, [0.514128384832, 0.785912670718, 0.254416735300]],
  [-2, 1, 5, [0.499287962694, 0.871466223512, 0.621887686915]],
  [12, 40, 5, [0.617507522241, 0.912111043192, 0.489784918587]],
  [0.5, 0.5, 6, [1.000000000000, 0.254288798401, 0.040329406018]],
  [-2, 1, 6, [0.735225934358, 0.787428867232, 0.583325318974]],
  [0.2, -5, 6, [0.782902803745, 0.757642005761, 0.542853533817]],
];
for (const [x, y, m, want] of REF) {
  const got = P.arb(m, Math.atan2(y, x), Math.hypot(x, y));
  check(`arb mode ${m} at ${x}${y < 0 ? '' : '+'}${y}i`, got.every((v, k) => Math.abs(v - want[k]) < 1e-9), JSON.stringify(got));
}
// zeros black and poles white (Arb's 2^-200 and 2^200 cut-offs)
check('arb 0 at a zero', P.arb(0, 0.3, 0).every((v) => v === 0));
check('arb 0 at infinity', P.arb(0, 0.3, Infinity).every((v) => v === 1));
// the list: the wheel first (uPal 0), the phase-only palette at 2 (the Modulus style shades it), Arb's -color N order
check('LIST', JSON.stringify(P.LIST) === JSON.stringify([['wheel', -1], ['arb', 0], ['arbPhase', 1], ['arbDodge', 2], ['chrome', 3], ['warm', 4], ['cold', 5], ['tomato', 6]]));
check('indexOf', P.indexOf('arbPhase') === 2 && P.indexOf('wheel') === 0 && P.indexOf('nonsense') === 0);
check('the wheel bakes nothing', P.bake('wheel').every((v) => v === 0));
// the baked texels: a texel centre is exact (column i is arg 2pi i / W, row j is m = j / (H - 1)), and the bilinear
// read stays within a few levels of the exact color away from the dodge's glints (rays where an Arb channel is 1)
for (const id of ['arb', 'arbPhase', 'chrome', 'tomato']) {
  const d = P.bake(id), mode = P.modeOf(id);
  let worst = 0, mean = 0, cnt = 0;
  for (const [i, j] of [[0, 0], [37, 101], [255, 200], [400, 128], [511, 255]]) {
    let a = 2 * Math.PI * i / P.W; if (a > Math.PI) a -= 2 * Math.PI;
    const m = j / (P.H - 1), lr = m <= 0 ? -1e3 : m >= 1 ? 1e3 : 5 * Math.log(m / (1 - m));
    const e = P.arb(mode, a, Math.exp(lr)).map((v) => Math.round(255 * Math.max(0, Math.min(1, v))));
    const o = 4 * (j * P.W + i);
    worst = Math.max(worst, ...e.map((v, k) => Math.abs(v - d[o + k])));
  }
  check(`${id}: texel centres exact`, worst <= 1, worst);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 4000; k++) {
    const a = (2 * rnd() - 1) * Math.PI, lr = (2 * rnd() - 1) * 12;
    const e = P.arb(mode, a, Math.exp(lr)).map((v) => Math.max(0, Math.min(1, v))), s = P.sample(d, a, lr);
    mean += Math.max(...e.map((v, q) => Math.abs(v - s[q]))) * 255; cnt++;
  }
  check(`${id}: bilinear read within 1.5 levels on average`, mean / cnt < 1.5, (mean / cnt).toFixed(3));
}
// shade: the neutral lightness keeps the color, darker scales it to black, lighter mixes it towards white
const c = [0.2, 0.4, 0.6];
check('shade at ref', JSON.stringify(P.shade(c, 0.75, 0.75)) === JSON.stringify(c));
check('shade darker', P.shade(c, 0.375, 0.75).every((v, k) => Math.abs(v - c[k] / 2) < 1e-12));
check('shade white', P.shade(c, 1, 0.75).every((v) => Math.abs(v - 1) < 1e-12));
console.log(fails ? `${fails} of ${n} FAILED` : `all ${n} passed`);
process.exit(fails ? 1 : 0);
