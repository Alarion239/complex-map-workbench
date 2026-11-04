// The steps view's Landscape glide near a pole of the glide's map: the carried surface has no holes there. The default
// page (z, exp, Möbius), colour plane w₁, Everywhere: the glide w₁ → w₂ carries plane w₁ by the Möbius step, whose pole
// w₁ = -1 it carries over the far plane, and the plane beyond w₁'s box near w₂ = 1.
// - with the shapes hidden, held at u = 0.9998 (the rail's place set, not let go): the pixels where w₂ at rest is
//   coloured and the frame is bare (the grid paper under no surface: within 6/255 of the paper's colour in each
//   channel) are at most 0.01 % of the pane's, where the canvases overlap on the page;
// - the frame there draws the carried grid's patches (__cmwLandCarry's patches), one about the pole, one beyond the box.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1440, 900, false, false);
const rAF2 = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))';
// the left pane's pixels and where its canvas is on the page (device px), kept in the page under tag
const grab = (tag) => ev(`(() => { const cv = document.getElementById('canvasL'), r = cv.getBoundingClientRect(), k = cv.width / r.width; window.__ss = window.__ss || {}; window.__ss[${JSON.stringify(tag)}] = { d: cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data, x: Math.round(r.left * k), y: Math.round(r.top * k), w: cv.width, h: cv.height }; return [cv.width, cv.height]; })()`);
const rest = async (i) => { await ev(`__cmwSteps({ go: ${i}, now: true }); 1`); await settled({ max: 60000 }); await ev(`await ${rAF2}; 1`); };
await go(`http://localhost:${PORT}/test.html?view=steps&ns=landpoles${Date.now()}`);
await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
await ev(`__cmwSteps({ scope: 'all', surf: 'land', T: 1, go: 2, now: true }); 1`);
await settled({ max: 60000 });
// (the shapes hidden, by their rows' eyes: the colour alone, so an outline's casing, a paper-white stroke, is no hole)
info.hidden = await ev(`(() => { let n = 0; for (const b of document.querySelectorAll('button.icon-btn.eye')) if (/^Hide/.test(b.getAttribute('aria-label') || '')) { b.click(); n++; } return n; })()`);
await settled({ max: 60000 });
await rest(2);
await grab('rest');
await rest(1);
await ev(`__cmwSteps({ x: 1.9998 }); 1`);
await settled({ max: 60000 });
await ev(`await ${rAF2}; 1`);
await grab('held');
const c = await ev('JSON.stringify(__cmwLandCarry())');
info.carry = c ? JSON.parse(c) : null;
// (the paper's colour: the theme's --plane)
info.holes = await ev(`(() => {
  const A = window.__ss.held, B = window.__ss.rest, p = getComputedStyle(document.documentElement).getPropertyValue('--plane').trim();
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(p), P = m ? [1, 2, 3].map((i) => parseInt(m[i], 16)) : null;
  if (!P) return { error: 'no --plane: ' + p };
  const x0 = Math.max(A.x, B.x), y0 = Math.max(A.y, B.y), x1 = Math.min(A.x + A.w, B.x + B.w), y1 = Math.min(A.y + A.h, B.y + B.h);
  const near = (D, i) => Math.abs(D[i] - P[0]) <= 6 && Math.abs(D[i + 1] - P[1]) <= 6 && Math.abs(D[i + 2] - P[2]) <= 6;
  let n = 0, h = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = ((y - A.y) * A.w + x - A.x) * 4, j = ((y - B.y) * B.w + x - B.x) * 4;
    n++;
    if (near(A.d, i) && !near(B.d, j)) h++;
  }
  return { n, share: +(h / n).toFixed(5), paper: P };
})()`);
ok('held at u = 0.9998: at most 0.01 % of the pane bare where w₂ at rest is coloured', info.holes && info.holes.share != null && info.holes.share <= 0.0001, info.holes);
ok('held at u = 0.9998: the carried grid has a patch about the pole and one beyond the box', !!info.carry && info.carry.patches >= 2, info.carry && { poles: info.carry.poles, patches: info.carry.patches });
return { pass: fails.length === 0, fails, info };
