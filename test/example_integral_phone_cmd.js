// The example "A residue by integration" opens on its plane with the circle |z − i| = 1 and the pole at i in view and nothing over
// them, and its Try line asks for the Line integral, which no device opens by itself: on a touch device the line names the gesture
// (hold a finger on the circle), elsewhere the curve's menu. The line closes when the user opens the integral. The circle's box
// is read from the plane's view (Pane.w2sxy) against the plane's own rect (#overlayL), on a desktop, on phones in portrait and
// in landscape down to 568 × 320, in en, ru and it, and the Try line's text (.tl-text) is not cut in its lane.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const POP = '.int-pop', LANE = '.tour-lane[data-lane="example"]';
// (the circle's box must sit this far inside the plane, in CSS px: its stroke is drawn on it)
const EDGE_PX = 2;
// the Try line in each language, on a touch device and elsewhere: the gesture's words, and the menu's
const TRY = {
  en: { touch: /hold a finger on the circle/, mouse: /open a curve's menu on the circle/ },
  ru: { touch: /удерживайте палец на окружности/, mouse: /откройте меню кривой на окружности/ },
  it: { touch: /tieni il dito sulla circonferenza/, mouse: /apri il menu della curva sulla circonferenza/ },
};
const count = (sel) => ev(`document.querySelectorAll(${JSON.stringify(sel)}).length`);
const frames = () => ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
const palette = async (q) => {
  await key('k', 4);
  await settled({ only: true, until: `!!document.querySelector('#popHost .palette') && !!document.getElementById('palInput')` });
  await ev(`(() => { const i = document.getElementById('palInput'); i.value = ${JSON.stringify(q)}; i.dispatchEvent(new Event('input')); })()`);
  await settled({ only: true, until: `(() => { const i = document.getElementById('palInput'); return !!i && i.value === ${JSON.stringify(q)} && !!document.querySelector('#popHost .palette .pal-item'); })()` });
};
// [name, width, height, touch, language, then open the integral]
const legs = [
  ['desktop 1280×800', 1280, 800, false, 'en', true],
  ['phone 360×640', 360, 640, true, 'en', true],
  ['phone 412×915', 412, 915, true, 'en', true],
  ['phone landscape 740×360', 740, 360, true, 'en', true],
  ['phone landscape 740×360 ru', 740, 360, true, 'ru', false],
  ['phone landscape 740×360 it', 740, 360, true, 'it', false],
  ['phone landscape 600×320', 600, 320, true, 'en', false],
  ['phone landscape 568×320', 568, 320, true, 'en', false],
  ['phone landscape 568×320 ru', 568, 320, true, 'ru', false],
];
for (const [name, w, h, touch, lang, open] of legs) {
  await view(w, h, false, touch);
  await go(`http://localhost:${PORT}/test.html?ns=exint${w}${lang}${Date.now() % 100000}&lang=${lang}`);
  await settled({ max: 30000, until: 'typeof __cmwExample === "function"' });
  await ev(`(() => { Tour.dismissSuggestion(); Tour.auto(false); return 1; })()`);
  // (the example by its name in the page's language: the page's own list, not an index)
  const idx = await ev(`(() => { const want = $t('A residue by integration'); for (let i = 0; i < 80; i++) { try { __cmwExample(i); } catch (e) { return -1; } const l = document.querySelector('#examplesBtn .exlabel'); if (l && l.textContent.trim() === want) return i; } return -1; })()`);
  ok(`${name}: the example is found`, idx >= 0, idx);
  if (idx < 0) continue;
  await ev(`__cmwExample(${idx}); 1`);
  await frames(); await settled({ max: 10000 });
  await settled({ max: 20000, until: `!!document.querySelector(${JSON.stringify(LANE)})` });
  // (a popover opened a frame after the planes have their size would be there two frames on, with the page quiet)
  await frames(); await settled({ max: 10000 });
  const g = await ev(`(() => {
    const R = (e) => { if (!e) return null; const q = e.getBoundingClientRect(); return { l: q.left, t: q.top, r: q.right, b: q.bottom }; };
    const plane = R(document.getElementById('overlayL')), [cx, cy, s] = __cmwSteps().win;
    const X = (x) => plane.l + (plane.r - plane.l) / 2 + (x - cx) * s, Y = (y) => plane.t + (plane.b - plane.t) / 2 - (y - cy) * s;
    const lane = document.querySelector(${JSON.stringify(LANE)}), body = lane && lane.querySelector('.tl-text');
    return { plane, lane: R(lane), circle: { l: X(-1), t: Y(2), r: X(1), b: Y(0) }, win: [cx, cy, s],
      text: lane ? lane.textContent.replace(/\\s+/g, ' ').trim() : '', cut: body ? body.scrollWidth > body.clientWidth + 1 || body.scrollHeight > body.clientHeight + 1 : null };
  })()`);
  const n = await count(POP);
  info[name] = { pops: n, win: g.win, circle: g.circle, plane: g.plane, lane: g.lane, text: g.text };
  ok(`${name}: the Line integral popover is not open after the example loads`, n === 0, n);
  const want = TRY[lang][touch ? 'touch' : 'mouse'], other = TRY[lang][touch ? 'mouse' : 'touch'];
  ok(`${name}: the Try line asks for the integral in the device's words (${touch ? 'hold a finger' : "the curve's menu"})`, want.test(g.text) && !other.test(g.text), g.text);
  ok(`${name}: the Try line's words are not cut in its lane`, g.cut === false, g.cut);
  const c = g.circle, p = g.plane;
  ok(`${name}: the circle is inside the plane`, c.l >= p.l + EDGE_PX && c.r <= p.r - EDGE_PX && c.t >= p.t + EDGE_PX && c.b <= p.b - EDGE_PX, { circle: c, plane: p });
  ok(`${name}: the circle is clear of the Try line's lane`, !g.lane || c.t >= g.lane.b || c.b <= g.lane.t || c.r <= g.lane.l || c.l >= g.lane.r, { circle: c, lane: g.lane });
  if (!open) continue;
  // the user opens it, as the line asks: the line closes
  await palette('integrate');
  await ev(`(() => { const r = [...document.querySelectorAll('#popHost .palette .pal-item')].find((e) => /^(∮ .* around |Integrate .* along )/.test(e.querySelector('.pal-label').textContent)); if (r) r.click(); return !!r; })()`);
  await settled({ max: 10000, until: `document.querySelectorAll(${JSON.stringify(POP)}).length >= 1` });
  ok(`${name}: choosing the integral opens the popover`, (await count(POP)) >= 1, await count(POP));
  await settled({ max: 10000, until: `!document.querySelector(${JSON.stringify(LANE)})` });
  ok(`${name}: the Try line closes once the user opens the integral`, (await count(LANE)) === 0, await count(LANE));
}
return { pass: fails.length === 0, fails, info };
