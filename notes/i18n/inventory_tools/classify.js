// Split raw rows into code (dropped), visible (context says so) and review (needs a human look).
// HTML inside strings is split into its text runs and visible attributes.
const fs = require('fs');
const [, , inp, out] = process.argv;
const rows = JSON.parse(fs.readFileSync(inp, 'utf8'));
const CODE_CALLEE = /^(\$|document\.(querySelector|querySelectorAll|getElementById|createElement|createElementNS|addEventListener|removeEventListener)|.*\.(addEventListener|removeEventListener|querySelector|querySelectorAll|closest|matches|getContext|getUniformLocation|getAttribute|removeAttribute|hasAttribute|toggleAttribute|getItem|setItem|removeItem|setProperty|getPropertyValue|startsWith|endsWith|includes|indexOf|lastIndexOf|split|padStart|padEnd|toggle|contains|replace|replaceAll|test|match|has|delete|getExtension|createShader|bindAttribLocation|getAttribLocation|getParameter|log|warn|error|info|debug|postMessage|dispatchEvent|focus|toBlob|toDataURL)|matchMedia|requestRender|Set|Map|svgI|program|console\.\w+|u\d[fi]?|u\d|u\w{1,4}|lsk|sk|RegExp|getComputedStyle|Object\.\w+|JSON\.\w+|Array\.\w+|Number|parseFloat|parseInt|hexRGB|col3|css|cssVar|v|anchorEl|isDrawer|requestAnimationFrame|setTimeout|warn|call|frames|key|onKey|CustomEvent|Event|Blob|URL\.\w+|fetch|new Function|Function|tsvg|glyph|ic|icon|serS|tv|both|globeSnap|globeEdit|newShape|op|rk)$/;
const CODE_PROP = new Set(['class', 'type', 'kind', 'id', 'role', 'key', 'mode', 'group', 'anchor', 'place', 'handles', 'cacheKey', 'style', 'spellcheck', 'autocomplete', 'aria-hidden', 'icon', 'surf', 'state', 'axis', 'ends', 't', 'f', 'n', 'op', 'fn', 'glsl', 'src', 'vs', 'fs', 'pattern', 'height', 'phaseStyle', 'focus', 'inputmode', 'enterkeyhint', 'autocapitalize', 'autocorrect', 'tabindex', 'for', 'name_', 'data-mode', 'data-n', 'data-i', 'data-k', 'data-id', 'data-key', 'data-act', 'data-icon', 'data-side', 'data-v', 'value_', 'href', 'download', 'target', 'rel', 'aria-haspopup', 'aria-controls', 'aria-pressed', 'aria-checked', 'aria-selected', 'aria-expanded', 'aria-live', 'aria-orientation', 'popover', 'popovertarget', 'popovertargetaction', 'width', 'height', 'viewBox', 'fill', 'stroke', 'd', 'cut', 'expr']);
const CODE_ASSIGN = /(^ctx\.|\.style(\.|$)|className|\.cursor|\.type$|\.id$|\.dataset\.(mode|side|k|i|n|id|key|act)|\.src$|\.href$|\.download$|^var (LINE_VS|GEOM_KEYS|OLD_PALETTE|WHEEL_STOPS|DC_STYLES)$)/;
const VIS_CALLEE = /^(toast|undoToast|say|announce|status|setStatus|note|showNote|Error|ParseError|RatErr|INEL|.*\.fillText|.*\.strokeText|alert|confirm|prompt)$/;
const VIS_PROP = new Set(['label', 'title', 'aria-label', 'data-tip', 'text', 'body', 'blurb', 'name', 'desc', 'note', 'reason', 'error', 'err', 'msg', 'hint', 'tex', 'menuTex', 'homTex', 'caption', 'inverseNote', 'branchNote', 'also', 'touch', 'placeholder', 'help', 'tip', 'html', 'title_', 'alt', 'heading', 'h', 'sub', 'lead', 'done', 'm', 's', 'domain', 'blurbTex', 'short', 'long', 'what', 'why', 'how', 'try', 'more', 'line', 'detail', 'aria-description', 'aria-roledescription', 'aria-valuetext']);
const VIS_ASSIGN = /(textContent|innerText|innerHTML|\.title$|placeholder|ariaLabel|dataset\.tip|\.label$|\.value$|nodeValue|data$)/;
const isCSS = (v) => /var\(--|^\s*[a-z-]+\s*:\s*[^;]+;|^-?\d+(\.\d+)?(px|em|rem|%|deg|ms|s)\b|^(rgba?|hsla?)\(|^#[0-9a-f]{3,8}$|^(translate|scale|rotate|matrix)\(|^@media|\{[^}]*:[^}]*\}|^\(\s*(max|min|prefers|pointer|hover)/i.test(v);
const isGLSL = (v) => /\b(vec[234]|mat[234]|float|uniform|varying|gl_Frag|gl_Position|precision|void main|texture\(|sampler2D|in vec|out vec)\b/.test(v) && /[;{]/.test(v);
const isPath = (v) => /^[Mm]\s*-?\d/.test(v) || /^<(svg|path|circle|rect|g|line|polyline|polygon|defs)\b/.test(v) && !/>[^<]*[A-Za-z]{2,}[^<]*</.test(v.replace(/<(svg|defs)[\s\S]*?<\/\1>/g, ''));
const identLike = (v) => /^[a-zA-Z_$][\w$.-]*$/.test(v) && !/^[A-Z][a-z]+$/.test(v);
const htmlAttrsVis = /\b(title|aria-label|data-tip|placeholder|alt|aria-description|aria-valuetext)="([^"]*[A-Za-z][^"]*)"/g;
function htmlPieces(v) {
  // returns visible text runs and attribute values of an HTML-ish string
  const out = [];
  let m; htmlAttrsVis.lastIndex = 0;
  const vv = v.replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<math[\s\S]*?<\/math>/g, ' ');
  while ((m = htmlAttrsVis.exec(vv))) out.push({ attr: m[1], text: m[2] });
  // text: strip tags but keep inline formatting tags (i, b, sub, sup, em, strong, span.kbd) inside a run
  const runs = vv.replace(/<(\/?)(div|p|button|label|section|header|footer|li|ul|ol|h\d|table|tr|td|th|input|select|option|summary|details|br|hr|canvas|figure|figcaption|nav|aside|dl|dt|dd)\b[^>]*>/g, '\u0001').split('\u0001');
  for (let r of runs) {
    const plain = r.replace(/<[^>]+>/g, '').replace(/\$\{[^}]*\}/g, '').replace(/&[a-z]+;/g, ' ');
    if (/[A-Za-z]{2,}|[A-Za-z]\s|^[A-Z]$/.test(plain.trim()) || /[A-Za-z]/.test(plain) && plain.trim().length > 1 && !/^\s*\$\{/.test(r)) out.push({ attr: null, text: r.trim() });
  }
  return out;
}
const res = { code: [], visible: [], review: [] };
rows.forEach((x, i) => {
  x.i = i;
  const v = x.value, c = x.ctx;
  if (!/[A-Za-zÀ-ɏͰ-Ͽ]/.test(v)) { res.code.push(x); return; }
  const callee = c.callee || '';
  const isHTML = /<[a-z][^>]*>/i.test(v) || /<\/[a-z]+>/i.test(v);
  if (isGLSL(v) || isPath(v)) { x.why = 'glsl/path'; res.code.push(x); return; }
  if (!isHTML && isCSS(v) && !/\s[a-z]{3,}\s[a-z]{3,}\s[a-z]{3,}/.test(v)) { x.why = 'css'; res.code.push(x); return; }
  if (callee === 'h' && c.argi === 0 || callee === 'el' && c.argi === 0) { x.why = 'tag'; res.code.push(x); return; }
  if (c.isKey) { res.code.push(x); return; }
  if (CODE_CALLEE.test(callee) && !VIS_CALLEE.test(callee)) { x.why = 'callee'; res.code.push(x); return; }
  if (c.prop && CODE_PROP.has(c.prop) && !c.callee) { x.why = 'prop'; res.code.push(x); return; }
  if (c.assign && CODE_ASSIGN.test(c.assign)) { x.why = 'assign'; res.code.push(x); return; }
  if (c.index) { x.why = 'index'; res.code.push(x); return; }
  const vis = VIS_CALLEE.test(callee) || (callee === 'h' || callee === 'el') && c.argi >= 2 || (c.prop && VIS_PROP.has(c.prop)) || (c.assign && VIS_ASSIGN.test(c.assign));
  if (isHTML) {
    const pcs = htmlPieces(v);
    if (!pcs.length) { x.why = 'html-no-text'; res.code.push(x); return; }
    x.pieces = pcs;
    (vis ? res.visible : res.review).push(x); return;
  }
  if ((c.cmp || c.caseTest) && identLike(v)) { x.why = 'cmp'; res.code.push(x); return; }
  if (identLike(v) && !vis) { x.why = 'ident'; res.code.push(x); return; }
  if (vis) res.visible.push(x); else res.review.push(x);
});
fs.writeFileSync(out, JSON.stringify(res));
const by = (a) => { const m = {}; a.forEach((x) => { m[x.file] = (m[x.file] || 0) + 1; }); return JSON.stringify(m); };
console.log('code', res.code.length, by(res.code));
console.log('visible', res.visible.length, by(res.visible));
console.log('review', res.review.length, by(res.review));
