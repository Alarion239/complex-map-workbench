'use strict';
// palette.js: the phase colors (issue 8), pure (no DOM), so the node tests run the shipped code. 'wheel' is the app's
// own OKLCH wheel (gl.js's LUT); the other seven are the color functions of Arb's plotting example
// (examples/complex_plot.c, public domain, Fredrik Johansson; https://fredrikj.net/blog/2018/04/new-color-functions/),
// `complex_plot -color N` for N = 0 … 6:
//   0 arb       hue = arg w / 2pi (HLS, red at arg 0), saturation 0.8, lightness 1 - 1/(1 + |w|^0.2)
//   1 arbPhase  arg w only: white at 0, gold, black at ±pi, blue, back to white (linear in RGB between stops)
//   2 arbDodge  0 and 1 blended: c0/2 + clamp(c0 / (1 - c1 + 1/256))/2 per channel
//   3 … 6       2 through GIMP's color balance (lightness kept): chrome, warm, cold, tomato
// Every one is a function of (arg w, |w|) only, so gl.js bakes the chosen one into W x H texels of its LUT
// (Palette.bake): column i is arg = 2pi i / W, row j is m = 1 - 1/(1 + |w|^0.2) = j / (H - 1). Palette.sample reads
// the baked texels as the GPU does (bilinear), for the legends and the readouts.
(function (root, factory) {
  const M = factory();
  if (typeof module === 'object' && module.exports) module.exports = M;
  else root.Palette = M;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // [id, Arb mode]; the index is the shaders' uPal
  const LIST = [['wheel', -1], ['arb', 0], ['arbPhase', 1], ['arbDodge', 2], ['chrome', 3], ['warm', 4], ['cold', 5], ['tomato', 6]];
  const W = 512, H = 256;
  const CL = (y) => Math.max(0, Math.min(y, 1));
  // HLS as Python's colorsys (Arb's port of it)
  function vv(m1, m2, hue) {
    hue -= Math.floor(hue);
    if (hue < 1 / 6) return m1 + (m2 - m1) * hue * 6;
    if (hue < 0.5) return m2;
    if (hue < 2 / 3) return m1 + (m2 - m1) * (2 / 3 - hue) * 6;
    return m1;
  }
  function hls2rgb(h, l, s) {
    if (s === 0) return [l, l, l];
    const m2 = l <= 0.5 ? l * (1 + s) : l + s - l * s, m1 = 2 * l - m2;
    return [vv(m1, m2, h + 1 / 3), vv(m1, m2, h), vv(m1, m2, h - 1 / 3)];
  }
  function rgb2hls(R, G, B) {
    const hi = Math.max(R, G, B), lo = Math.min(R, G, B), l = 0.5 * (lo + hi);
    let d = hi - lo;
    if (hi === lo) return [0, l, 0];
    const s = l <= 0.5 ? d / (hi + lo) : d / (2 - hi - lo);
    if (d === 0) d = 1;
    let h = R === hi ? (G - B) / d : G === hi ? (B - R) / d + 2 : (R - G) / d + 4;
    h /= 6;
    if (h < 0) h += 1;
    return [h, l, s];
  }
  // GIMP's color balance: (shadows, midtones, highlights) per channel, weighted by the channel's own value
  function chan(v, sh, mid, hl) {
    const a = 0.25, b = 0.333, scale = 0.7;
    sh *= CL((v - b) / -a + 0.5) * scale;
    mid *= CL((v - b) / a + 0.5) * CL((v + b - 1) / -a + 0.5) * scale;
    hl *= CL((v + b - 1) / a + 0.5) * scale;
    return CL(v + sh + mid + hl);
  }
  function balance(c, p) {
    const l = rgb2hls(c[0], c[1], c[2])[1];
    const r = chan(c[0], p[0], p[1], p[2]), g = chan(c[1], p[3], p[4], p[5]), b = chan(c[2], p[6], p[7], p[8]);
    const q = rgb2hls(r, g, b);
    return hls2rgb(q[0], l, q[2]);
  }
  const BALANCE = {
    3: [0, -0.5, 0.2, 0, 0, -0.1, 0, -1, -0.2],
    4: [0, -0.5, 0.2, 0, 0.5, -0.1, 0, -0.3, -1],
    5: [0, -0.5, -1, 0, -0.1, -0.67, 0, -0.55, -0.12],
    6: [0.86, 0, 0.13, 0.57, 0.19, -0.52, 0.31, -0.3, -0.94],
  };
  const STOPS = [[-1, 0, 0, 0], [-0.95, 0.1, 0.2, 0.5], [-0.5, 0, 0.5, 1], [-0.05, 0.4, 0.8, 0.8], [0, 1, 1, 1],
    [0.05, 1, 0.9, 0.3], [0.5, 0.9, 0.5, 0], [0.95, 0.7, 0.1, 0], [1, 0, 0, 0], [2, 0, 0, 0]];
  // Arb's color of w = r e^(i arg), arg in [-pi, pi], r = |w| >= 0 (Infinity allowed): sRGB floats in 0..1
  function arb(mode, arg, r) {
    if (mode >= 2) {
      const c0 = arb(0, arg, r), c1 = arb(1, arg, r);
      const c = c0.map((x, k) => 0.5 * x + 0.5 * CL(x / (1 - c1[k] + 1 / 256)));
      return BALANCE[mode] ? balance(c, BALANCE[mode]) : c;
    }
    if (mode === 0) {
      let h = arg / (2 * Math.PI) + 1;
      h -= Math.floor(h);
      const L = r > 2 ** 200 ? 1 : r < 2 ** -200 ? 0 : 1 - 1 / (1 + Math.pow(r, 0.2));
      return hls2rgb(h, L, 0.8);
    }
    const x = Math.max(-1, Math.min(arg / Math.PI, 1));
    for (let i = 1; ; i++) {
      if (STOPS[i][0] > x) {
        const a = STOPS[i - 1], b = STOPS[i], s = (x - a[0]) / (b[0] - a[0]);
        return [a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s, a[3] + (b[3] - a[3]) * s];
      }
    }
  }
  const modeOf = (id) => { const e = LIST.find((p) => p[0] === id); return e ? e[1] : -1; };
  const indexOf = (id) => Math.max(0, LIST.findIndex((p) => p[0] === id));
  // the row coordinate of |w| = e^lr: 1 - 1/(1 + |w|^0.2), as the shaders write it
  const mOf = (lr) => 1 / (1 + Math.exp(-0.2 * lr));
  // the W x H RGBA8 texels of an Arb palette
  function bake(id) {
    const mode = modeOf(id), d = new Uint8Array(W * H * 4);
    if (mode < 0) return d;
    for (let j = 0; j < H; j++) {
      const m = j / (H - 1), r = m <= 0 ? 0 : m >= 1 ? Infinity : Math.pow(m / (1 - m), 5);
      for (let i = 0; i < W; i++) {
        let a = 2 * Math.PI * i / W;
        if (a > Math.PI) a -= 2 * Math.PI;
        const c = arb(mode, a, r), o = 4 * (j * W + i);
        d[o] = Math.round(CL(c[0]) * 255); d[o + 1] = Math.round(CL(c[1]) * 255); d[o + 2] = Math.round(CL(c[2]) * 255); d[o + 3] = 255;
      }
    }
    return d;
  }
  // the baked texels at (arg, ln|w|), bilinear and wrapping in arg as the GPU's arbc(): sRGB floats
  function sample(d, arg, lr) {
    const u = arg / (2 * Math.PI) * W, v = CL(mOf(lr)) * (H - 1);
    const i0 = Math.floor(u), fu = u - i0, j0 = Math.min(H - 2, Math.floor(v)), fv = v - j0;
    const at = (i, j, k) => d[4 * (j * W + ((i % W) + W) % W) + k] / 255;
    const out = [0, 0, 0];
    for (let k = 0; k < 3; k++) {
      const a = at(i0, j0, k) * (1 - fu) + at(i0 + 1, j0, k) * fu, b = at(i0, j0 + 1, k) * (1 - fu) + at(i0 + 1, j0 + 1, k) * fu;
      out[k] = a * (1 - fv) + b * fv;
    }
    return out;
  }
  // the shaders' pwheel() for an Arb color pb: a style that asks for lightness L where its neutral lightness is ref
  // gets pb darkened below ref and lightened above it
  const shade = (pb, L, ref) => (L <= ref ? pb.map((x) => x * (L / ref)) : pb.map((x) => x + (1 - x) * (L - ref) / (1 - ref)));
  return { LIST, W, H, arb, bake, sample, shade, mOf, modeOf, indexOf };
});
