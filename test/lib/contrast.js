// WCAG contrast read in the page, for a suite's own `ev` expressions (head_press_cmd.js). An expression for eval in a suite:
// `const { CONTRAST_JS } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'contrast.js'), 'utf8'))()`, and CONTRAST_JS is the
// source of four functions to put at the top of a page-side function body:
// - rgba(css): [r, g, b, alpha 0..1] of a CSS colour as the canvas resolves it (so a custom property's value, `color-mix()` and a
//   keyword all come out as numbers);
// - lum(c): WCAG's relative luminance of an [r, g, b, ...] colour;
// - ratio(a, b): the contrast ratio of two colours, 1 to 21, from their luminances;
// - backdrop(el): the first opaque background colour from el up the tree, what el stands on.
() => ({
  CONTRAST_JS: `
  const cx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  const rgba = (css) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = css; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const backdrop = (el) => { for (let n = el; n; n = n.parentElement) { const c = rgba(getComputedStyle(n).backgroundColor); if (c[3] === 1) return c; } return null; };`,
})
