  // =====================================================================================================
  // 2. Presets, sizes, palettes
  // =====================================================================================================
  // Sizes are TeX points (the width of a real layout); the file is in bp (1 pt = 72/72.27 bp).
  // Article: One column (amsart 360 pt, the default) or Two column (the column of a two-column journal; full width for
  // figure*). Homework: 1 in margins on Letter (469.75 pt) by default; the snippet only ever shrinks the figure.
  const SIZES = {
    article1: [
      { id: 'amsart', label: 'amsart', pt: 360, note: 'One column · the default' },
      { id: 'art10', label: 'article · 10 pt', pt: 345 },
      { id: 'art11', label: 'article · 11 pt', pt: 360 },
      { id: 'art12', label: 'article · 12 pt', pt: 390 },
    ],
    article2: [
      { id: 'revtex', label: 'REVTeX column', pt: 246, note: 'Two column · the default' },
      { id: 'ieee', label: 'IEEE column', pt: 252 },
      { id: 'revtexW', label: 'REVTeX full width', pt: 510, star: true, note: 'figure* across both columns' },
      { id: 'ieeeW', label: 'IEEE full width', pt: 516, star: true, note: 'figure* across both columns' },
    ],
    homework: [
      { id: 'letter1in', label: '1 in margins · Letter', pt: 469.75, note: 'the default' },
      { id: 'a4', label: '2.5 cm margins · A4', pt: 455.24 },
      { id: 'ol11', label: 'Overleaf article · 11 pt', pt: 360 },
      { id: 'ol10', label: 'Overleaf article · 10 pt', pt: 345 },
      { id: 'ol12', label: 'Overleaf article · 12 pt', pt: 390 },
    ],
    slides: [
      { id: 'beamer169', label: 'Beamer 16:9', pt: 398.34, note: 'the default' },
      { id: 'beamer43', label: 'Beamer 4:3', pt: 307.29 },
    ],
  };
  const sizeList = (o) => (o.for === 'article' ? SIZES[o.cols === 2 ? 'article2' : 'article1'] : SIZES[o.for]);
  const sizeOf = (o) => {
    if (o.sizeId === 'custom' && o.customPt > 50) return { id: 'custom', label: 'Your \\linewidth', pt: o.customPt };  // (shown through $t)
    const l = sizeList(o);
    return l.find((s) => s.id === o.sizeId) || l[0];
  };
  // type sizes (pt) at each document size: ticks, labels, caption
  const TYPE = {
    article: { 10: [8, 9, 9], 11: [9, 10, 10], 12: [10, 10.95, 10.95] },
    homework: { 10: [9, 10, 10], 11: [10, 10.95, 10.95], 12: [10.95, 12, 12] },
    slides: { 10: [9, 11, 11], 11: [9, 11, 11], 12: [10, 12, 12] },
  };
  const PRESET = {
    article: { axes: 'box', lw: { frame: 0.5, tick: 0.5, edge: 0.6, curve: 0.7, grid: 0.35, arrow: 0.5, axis: 0.6 }, dashOpen: false, named: false, chevrons: false, fade: false, float: 'tbp' },
    homework: { axes: 'cross', lw: { frame: 0.6, tick: 0.6, edge: 0.9, curve: 1.0, grid: 0.5, arrow: 0.6, axis: 0.6 }, dashOpen: true, named: true, chevrons: true, fade: true, float: 'H' },
    slides: { axes: 'cross', minimal: true, lw: { frame: 0.6, tick: 0.6, edge: 1.0, curve: 1.2, grid: 0.5, arrow: 0.7, axis: 0.7 }, dashOpen: false, named: false, chevrons: false, fade: true, float: 'H' },
  };
  // ---- colour (OKLab): the print tones of each shape at fixed lightness, so they survive grey and colour-blind readers
  const sRGBlin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const hexRGB = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const toOklab = (hex) => {
    const [r, g, b] = hexRGB(hex).map(sRGBlin);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
  };
  const oklch = (L, Cc, hh) => {
    const conv = (C2) => {
      const a = C2 * Math.cos(hh), b = C2 * Math.sin(hh);
      const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.2914855480 * b;
      const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
      return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
    };
    let lo = 0, hi = Cc;
    if (conv(Cc).some((x) => x < 0 || x > 1)) { for (let i = 0; i < 20; i++) { const mid = (lo + hi) / 2; if (conv(mid).some((x) => x < 0 || x > 1)) hi = mid; else lo = mid; } Cc = lo; }
    return '#' + conv(Cc).map((c) => { c = Math.min(1, Math.max(0, c)); const s = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; return Math.round(s * 255).toString(16).padStart(2, '0'); }).join('');
  };
  const DEF_C = ['#3B6FD4', '#CD821A', '#12938F', '#BC4E98', '#31983D', '#7F56C4', '#888D22', '#607183'];
  const baseHex = (s) => (s.color && /^#[0-9a-f]{6}$/i.test(s.color) ? s.color : DEF_C[(s.ci || 0) % 8]);
  // the tones of a shape: dark / light checker cells and the boundary
  const TONES = { article: [0.70, 0.085, 0.895, 0.03, 0.40, 0.09], homework: [0.66, 0.095, 0.89, 0.035, 0.36, 0.09], slides: [0.66, 0.11, 0.88, 0.045, 0.38, 0.1] };
  function tonesOf(s, o) {
    if (o.ink === 'bw') return { dark: '#8C8C8C', light: '#DBDBDB', edge: '#000000' };
    const [, a, b] = toOklab(baseHex(s)), hh = Math.atan2(b, a), t = TONES[o.for] || TONES.article;
    return { dark: oklch(t[0], t[1], hh), light: oklch(t[2], t[3], hh), edge: oklch(t[4], t[5], hh) };
  }
  // the renderer blends fills at alpha over white: a tone is pre-compensated so the blend lands on it
  const comp = (h, a) => '#' + [1, 3, 5].map((i) => Math.max(0, Math.min(255, Math.round(255 - (255 - parseInt(h.slice(i, i + 2), 16)) / a))).toString(16).padStart(2, '0')).join('');
  const printInkFor = (o, alpha) => (s) => { const t = tonesOf(s, o); return { c0: comp(t.dark, alpha), alt: comp(t.light, alpha), edge: t.edge }; };
  // named points: Okabe-Ito hues, identity carried by the marker's shape; letters always black
  const PTS = [['dot', '#D55E00'], ['square', '#009E73'], ['tri', '#CC79A7'], ['diamond', '#E69F00']];
  const BW_DASH = [null, '3 2', '0 1.8'];

