// [#465] No raw TeX on the screen: a formula's source (\text{кривая, 5 точек}, \frac{1}{z}, z^{2}, u_k) never shows as
// text, before MathJax has loaded (or where it cannot: a blocked CDN) nor after. Scanned: the visible text, the
// accessible names and tooltips (aria-label, title, data-tip, alt) and the text drawn on canvases (fillText,
// strokeText, recorded from the page's first script). Where: drawn shapes (a curve, a polygon, a disc, a point) in
// the steps view, on the plane z, on the plane w₁, on the sphere and on the landscape, each selected in turn, then every example of the gallery, on the page without MathJax
// (test-nomj.html: what the page shows until MathJax arrives) and with it (test-mj.html: MathJax 4 and its STIX2 font
// from vendor/, no CDN), and the shapes at a phone's width. One language per run (LANG, ci/browser_suites.js); the page
// with MathJax only where MJ is set (en and ru: Alexander's report was Russian with MathJax, a Cyrillic \text MathJax
// did not set; it is not set for it, whose tooltips, names and canvas text read the same with MathJax or without and are
// read on the page without it). It runs in the steps view (ci/suite_views.js: steps({ pin: true })). A command file for a CDP daemon.
const fails = [], info = { scanned: 0 };
const LANG = globalThis.LANG || 'ru';
const MJ = globalThis.MJ !== false;
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const BASE = `http://localhost:${PORT}`;
// the canvas text, recorded before the page's own scripts run
await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => { window.__canvasTexts = new Map(); const rec = (P) => { if (!P) return; for (const m of ['fillText', 'strokeText']) { const f = P[m]; P[m] = function (t, ...a) { try { const s = String(t); if (s) window.__canvasTexts.set(s, 1); } catch (e) { /* not a string */ } return f.call(this, t, ...a); }; } };
  rec(window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype); rec(window.OffscreenCanvasRenderingContext2D && OffscreenCanvasRenderingContext2D.prototype); })();` });
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
const seen = new Set();
// (a scan that read nothing, or a test-mj.html that typeset nothing, would pass whatever the page shows)
const MIN_STRINGS = 20;
const scan = async (page, ctx) => {
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
// (no wait for the exact images: they put no formula on screen, only ruler ticks and the panes' status, and the canvas
// text is recorded for the page's whole life, so a later scan reads what a late frame drew)
// (the page is quiet, MathJax is there where it is wanted, then a window for it to typeset: MathJax has no event for the
// end of its work, so that window is measured time)
const settle = async (mj) => {
  const t0 = Date.now();
  await settled();
  if (mj) await settled({ until: `!!(window.MathJax && MathJax.tex2svg)`, max: 10000 });
  await settled({ floor: mj ? 1200 : 400 });
  info.settleMs = (info.settleMs || 0) + Date.now() - t0;
};
const SHAPES = [
  { id: 's1', kind: 'curve', pts: [[-1, 0], [-0.5, 0.6], [0, 0.2], [0.5, 0.8], [1, 0.1]], ci: 0, visible: true },
  { id: 's2', kind: 'polygon', pts: [[-1.5, -1], [-0.5, -1.2], [-0.8, -0.3]], ci: 1, visible: true },
  { id: 's3', kind: 'disc', c: [0.8, -0.8], r: 0.4, ci: 2, visible: true },
  { id: 's4', kind: 'point', p: [0.3, 0.4], ci: 3, visible: true },
];
async function openShapes(page) {
  const ns = 'rawtex' + LANG + Date.now();
  await go(`${BASE}/gl-helpers.html`);
  const o = { v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, rightMode: 'image', lang: LANG, shapes: SHAPES, steps: [{ type: 'pown', params: { n: 2 }, on: true }] };
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
  await go(`${BASE}/${page}?ns=${ns}&lang=${LANG}`);
  await settled({ until: `typeof __cmwSteps === 'function' && typeof __cmwSelect === 'function'` });
}
// the steps view's pictures: the plane z, the plane w₁, the sphere and the landscape of the shown plane
const PICTURES = [['plane z', { go: 0, now: true, surf: 'plane' }], ['plane w1', { go: 1, now: true, surf: 'plane' }], ['sphere', { surf: 'sphere' }], ['landscape', { surf: 'land' }]];
for (const page of MJ ? ['test-nomj.html', 'test-mj.html'] : ['test-nomj.html']) {
  const mj = page === 'test-mj.html';
  await view(1440, 900, false, false);
  await openShapes(page); await settle(mj);
  if (!(await ev(`!!(window.__cmwSteps && __cmwSteps().on)`))) return { pass: false, fails: ['the page is not in the steps view (this suite is tagged steps({ pin: true }) in ci/suite_views.js)'] };
  for (const [name, o] of PICTURES) {
    await ev(`__cmwSteps(${JSON.stringify(o)}), 1`); await settle(mj);
    await scan(page, `shapes, ${name}`);
    for (const s of SHAPES) { await ev(`__cmwSelect('${s.id}'), 1`); await settled({ floor: mj ? 900 : 400 }); await scan(page, `shapes, ${name}, ${s.kind} selected`); }
    await ev(`__cmwSelect(null), 1`);
  }
  // the gallery: every example
  await go(`${BASE}/${page}?ns=rawtexg${LANG}${Date.now()}&lang=${LANG}`);
  await settled({ until: `typeof __cmwExample === 'function'` });
  for (let i = 0; i < 80; i++) {
    const ok = await ev(`(() => { try { __cmwExample(${i}); return true; } catch (e) { return false; } })()`);
    if (!ok) break;
    await settle(mj);
    await scan(page, `example ${i} (${await ev(`document.querySelector('#examplesBtn .exlabel')?.textContent || ''`)})`);
  }
}
// a phone: the shapes, before MathJax
await view(390, 844, false, true);
await openShapes('test-nomj.html'); await settle(false);
await scan('test-nomj.html', 'phone, shapes');
await view(1440, 900, false, false);
info.fails = fails.length;
return { pass: fails.length === 0, fails: fails.slice(0, 60), info };
