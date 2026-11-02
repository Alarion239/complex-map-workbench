// The raw-TeX scan shared by test/raw_tex_cmd.js (the steps view) and test/raw_tex_classic_cmd.js (X → Y, Phase and
// Landscape) (#465): each eval's this file and gets { RECORDER, SCAN, scanner }.
//   RECORDER  the page script that records the text drawn on canvases (fillText, strokeText), installed before the page's
//             own scripts run (Page.addScriptToEvaluateOnNewDocument)
//   SCAN      the expression that reads the visible text, the accessible names and tooltips and the recorded canvas text,
//             and returns the strings that show raw TeX
//   scanner   scanner({ ev, LANG, fails, info }) -> async scan(page, ctx): runs SCAN, and fails on raw TeX, on a scan
//             that read too little and on a MathJax page that typeset nothing
(() => {
  const RECORDER = `(() => { window.__canvasTexts = new Map(); const rec = (P) => { if (!P) return; for (const m of ['fillText', 'strokeText']) { const f = P[m]; P[m] = function (t, ...a) { try { const s = String(t); if (s) window.__canvasTexts.set(s, 1); } catch (e) { /* not a string */ } return f.call(this, t, ...a); }; } };
  rec(window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype); rec(window.OffscreenCanvasRenderingContext2D && OffscreenCanvasRenderingContext2D.prototype); })();`;
  // TeX on screen: a command (\text, \frac …), a braced script (^{, _{), a bare one (z^2, u_k), or a command's name left as
  // a word (displaystyle w₁, rho, {0,-1,dots}). A script written as plain text, in parentheses (e^(1/z), Σ^(∞)), is text,
  // as is a Unicode one (z², uₖ)
  const SCAN = `(() => {
  const RX = [[/\\\\[a-zA-Z]+/, 'command'], [/[\\^_]\\{/, 'braced script'], [/[A-Za-z0-9)}\\]]\\^[0-9A-Za-z-]/, 'bare ^'], [/[A-Za-z)}\\]]_[0-9A-Za-z]/, 'bare _'],
    [/\\b(?:displaystyle|textstyle|scriptstyle|frac|dfrac|tfrac|operatorname|mathrm|mathbb|infty|varphi|overline|notin|mapsto|cdots|ldots|rho)\\b|[,{]\\s*dots\\b/, 'a command\\'s name']];
  const hit = (s) => { for (const [r, k] of RX) if (r.test(s)) return k; return null; };
  const out = []; let n = 0;
  const shown = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return false; } return !!(el.getClientRects && el.getClientRects().length); };
  // (what the user typed is as typed: fields, the command field)
  const typed = (el) => !!el.closest('mjx-container, svg, script, style, textarea, input, select, [contenteditable], .cmd-field');
  const where = (el) => (el.id ? '#' + el.id : '') + '.' + String(el.className && el.className.baseVal != null ? el.className.baseVal : el.className || el.tagName).split(' ')[0];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const el = n.parentElement, s = n.nodeValue;
    if (!el || !s || !s.trim() || typed(el) || !shown(el)) continue;
    n++; const k = hit(s); if (k) out.push({ where: 'text ' + where(el), k, s: s.trim().slice(0, 140) });
  }
  // (a tooltip is read whether or not its element is shown now: it shows on hover)
  for (const el of document.querySelectorAll('[aria-label], [title], [data-tip], [alt]')) {
    if (el.closest('mjx-container, svg') || (!shown(el) && !el.hasAttribute('data-tip'))) continue;
    for (const a of ['aria-label', 'title', 'data-tip', 'alt']) { const s = el.getAttribute(a); if (!s) continue; n++; const k = hit(s); if (k) out.push({ where: a + ' ' + where(el), k, s: s.slice(0, 140) }); }
  }
  for (const [s] of window.__canvasTexts || []) { n++; const k = hit(s); if (k) out.push({ where: 'canvas', k, s: s.slice(0, 140) }); }
  return { out, n, mj: !!document.querySelector('mjx-container') };
})()`;
  const scanner = ({ ev, LANG, fails, info }) => {
    const seen = new Set();
    // (a scan that read nothing, or a test-mj.html that typeset nothing, would pass whatever the page shows)
  const MIN_STRINGS = 20;
    return async (page, ctx) => {
    info.scanned++;
    let r;
    const t0 = Date.now();
    try { r = await ev(SCAN); } catch (e) { fails.push(`${LANG} ${page} ${ctx}: the scan threw: ${e.message}`); return; }
    if (r.n < MIN_STRINGS) fails.push(`${LANG} ${page} ${ctx}: the scan read only ${r.n} strings (at least ${MIN_STRINGS} expected)`);
    if (page === 'test-mj.html' && !r.mj) fails.push(`${LANG} ${page} ${ctx}: MathJax typeset nothing (no mjx-container): the page tested what it shows before MathJax`);
    info.minStrings = Math.min(info.minStrings ?? Infinity, r.n);
    info.scanMs = (info.scanMs || 0) + Date.now() - t0;
    for (const f of r.out) { const key = `${page}|${f.where}|${f.s}`; if (seen.has(key)) continue; seen.add(key); fails.push(`${LANG} ${page} ${ctx}: raw TeX (${f.k}) in ${f.where}: "${f.s}"`); }
  };
  };
  return { RECORDER, SCAN, scanner };
})()
