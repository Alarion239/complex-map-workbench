// WCAG contrast, for the suites that measure it: in the page (a suite's own `ev` expressions) and in Node (on pixels a suite read
// from a screenshot). An expression for eval in a suite:
// `const { LUM_JS, CONTRAST_JS, lin, lum, ratio } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'contrast.js'), 'utf8'))()`.
// LUM_JS is the source of three functions to put at the top of a page-side function body; lin, lum and ratio are the same
// functions, to call in Node:
// - lin(u): the sRGB transfer function, a channel 0..1 to linear light;
// - lum(c): WCAG's relative luminance of an [r, g, b, ...] colour (channels 0..255);
// - ratio(a, b): the contrast ratio of two colours, 1 to 21, from their luminances.
// (lin's threshold is WCAG's 0.03928. sRGB's own, 0.04045, gives the same value for every 8-bit channel n / 255: none lies between
// the two.)
// CONTRAST_JS is LUM_JS and two functions more, for a page-side function body:
// - rgba(css): [r, g, b, alpha 0..1] of a CSS colour as the canvas resolves it (so a custom property's value, `color-mix()` and a
//   keyword all come out as numbers);
// - backdrop(el): the first opaque background colour from el up the tree, what el stands on.
() => {
  const LUM_JS = `
  const lin = (u) => (u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4));
  const lum = (c) => 0.2126 * lin(c[0] / 255) + 0.7152 * lin(c[1] / 255) + 0.0722 * lin(c[2] / 255);
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };`;
  const CONTRAST_JS = `${LUM_JS}
  const cx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  const rgba = (css) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = css; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const backdrop = (el) => { for (let n = el; n; n = n.parentElement) { const c = rgba(getComputedStyle(n).backgroundColor); if (c[3] === 1) return c; } return null; };`;
  return { LUM_JS, CONTRAST_JS, ...new Function(`${LUM_JS}\n  return { lin, lum, ratio };`)() };
}
