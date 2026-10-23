// In-page "no English left" scanner for the Russian interface (phase 2b, notes/i18n/PHASE2B.md). Evaluated in the page
// by test/i18n_cmd.js: window.__i18nScan(label) walks every text node and every visible attribute (title, aria-label,
// placeholder, data-tip, data-desc, alt, aria-description) of the document, and a MutationObserver also records text
// that appears for a moment (toasts, live regions). A string with a Latin word of two or more letters that is not on
// the allowed list (math, key names, file formats, units, product names, the app's name) is recorded once, with where
// and in which state it was seen. window.__i18nLeft() returns the records.
(() => {
  if (window.__i18nScan) return;
  const ALLOW = new Set([
    // the app's name and the English autonym in the Language menu
    'Complex', 'Map', 'Workbench', 'English',
    // key names (GLOSSARY 3.12)
    'Enter', 'Esc', 'Escape', 'Shift', 'Tab', 'Ctrl', 'Alt', 'Option', 'Cmd', 'Space', 'Delete', 'Backspace', 'Home', 'End', 'PgUp', 'PgDn', 'Del', 'Fn',
    // file formats, units and products
    'LaTeX', 'TeX', 'PDF', 'PNG', 'SVG', 'pdf', 'png', 'svg', 'tex', 'txt', 'JSON', 'json', 'pt', 'px', 'cm', 'mm', 'in', 'dpi', 'WebGL', 'WebGL2', 'Web', 'Audio',
    'Overleaf', 'Beamer', 'Google', 'Docs', 'Slides', 'Word', 'Keynote', 'PowerPoint', 'MathJax', 'arXiv', 'pdfLaTeX', 'XeLaTeX', 'LuaLaTeX', 'CMU', 'Unicode',
    'iPhone', 'iPad', 'AudioWorklet', 'amsart', 'article', 'REVTeX', 'IEEE', 'Letter', 'A4', 'tbp', 'figure', 'linewidth', 'textwidth', 'columnwidth',
    // key chips read out together by the tour's screen-reader line (⇧ M)
    'ShiftM',
    // function names and math words the formula language and the Russian notation use (GLOSSARY 1.4, 2.4)
    'Re', 'Im', 'arg', 'Arg', 'Res', 'exp', 'ln', 'Ln', 'log', 'sin', 'cos', 'tg', 'ctg', 'sec', 'cosec', 'csc', 'sh', 'ch', 'th', 'cth', 'arcsin', 'arccos', 'arctg',
    'arcctg', 'arsh', 'arch', 'arth', 'arcth', 'sqrt', 'conj', 'abs', 'mod', 'dz', 'dw', 'id', 'const', 'sinc', 'Log', 'Sqrt', 'erf', 'Gamma', 'zeta', 'pi', 'inf',
    'and', 'or', 'not', 'ad', 'bc', 'az', 'cz', 'lg', 'tan', 'cot', 'sinh', 'cosh', 'tanh', 'coth', 'arctan', 'asin', 'acos', 'atan', 'acot', 'arccot',
  ]);
  const ATTRS = ['title', 'aria-label', 'placeholder', 'data-tip', 'data-desc', 'alt', 'aria-description', 'aria-roledescription', 'aria-valuetext'];
  // math and code: MathJax output, canvases, the LaTeX code boxes, key chips, the wordmark, inputs' own values
  const SKIP = 'script, style, noscript, mjx-container, svg, canvas, kbd, code, pre, textarea, i, var, [data-i18n="no"], .wordmark, .kbd, .ftag, .tex-src, .xf-code';
  const left = new Map();
  let state = '';
  const desc = (el) => {
    const id = el.closest('[id]');
    return (id ? '#' + id.id : '') + ' ' + el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  };
  const check = (s, where) => {
    if (!s || !/[A-Za-z]{2}/.test(s)) return;
    // inline math in plain text: words inside $…$ and TeX commands are math
    const t = String(s).replace(/\s+/g, ' ').trim();
    const rest = t.replace(/\$[^$]*\$/g, ' ').replace(/\\[A-Za-z]+/g, ' ');
    const words = (rest.match(/[A-Za-z][A-Za-z0-9]*/g) || []).filter((w) => w.length >= 2 && !ALLOW.has(w) && !/^[a-z]\d*$/.test(w));
    if (!words.length) return;
    const k = t.slice(0, 240);
    if (!left.has(k)) left.set(k, { text: k, words: [...new Set(words)].slice(0, 8), where, state });
  };
  const scanNode = (root) => {
    if (!root) return;
    if (root.nodeType === 3) { const p = root.parentElement; if (p && !p.closest(SKIP)) check(root.data, desc(p)); return; }
    if (root.nodeType !== 1) return;
    const el = root;
    if (el.closest(SKIP)) return;
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) { const p = n.parentElement; if (p && !p.closest(SKIP)) check(n.data, desc(p)); }
    const els = [el, ...el.querySelectorAll('*')];
    for (const e of els) {
      if (e.closest('mjx-container, script, style, [data-i18n="no"]')) continue;
      for (const a of ATTRS) { const v = e.getAttribute(a); if (v) check(a === 'data-tip' ? v.split('  ')[0] : v, desc(e) + '@' + a); }
    }
  };
  window.__i18nScan = (label) => { state = label; scanNode(document.body); check(document.title, 'title'); return left.size; };
  window.__i18nLeft = () => [...left.values()];
  window.__i18nReset = () => left.clear();
  new MutationObserver((ms) => {
    for (const m of ms) {
      if (m.type === 'characterData') scanNode(m.target);
      else for (const n of m.addedNodes) scanNode(n);
      if (m.type === 'attributes' && m.target.nodeType === 1 && ATTRS.includes(m.attributeName)) { const v = m.target.getAttribute(m.attributeName); if (v && !m.target.closest('mjx-container, [data-i18n="no"]')) check(v, desc(m.target) + '@' + m.attributeName); }
    }
  }).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
})();
