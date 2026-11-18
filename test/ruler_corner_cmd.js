// The ruler's corner letter names the plane shown (z, w₁, w₂ …) with a real subscript, and nothing of it is clipped: on the planes with a
// subscript the letter and its subscript share a line (the subscript to the right of the letter and lower than its top) and the subscript's
// text box lies inside the corner; on every plane the corner's content fits its box (no overflow for overflow: hidden to cut) and the corner
// is clear of the strip below it. Over a desktop at 1280 and 1024 px and a phone at 360 × 640, 390 and 740 × 360, light and dark.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const TOL = 0.5;   // (px: the text box is the font's content area, the digit inside it is a little smaller)
for (const [w, h, phone, dark] of [[1280, 800, false, false], [1280, 800, false, true], [1024, 768, false, false], [360, 640, true, false], [360, 640, true, true], [390, 844, true, false], [740, 360, true, false]]) {
  await view(w, h, dark, phone);
  await go(`http://localhost:${PORT}/test.html?view=steps&ns=rc${w}${Date.now()}`);
  await settled({ max: 30000, until: `typeof __cmwSteps === "function" && !!document.getElementById('cornerL')` });
  for (const pl of [0, 1, 2]) {
    await ev(`__cmwSteps({ go: ${pl}, now: true }); 1`);
    await settled({ max: 20000, only: true, until: pl ? `!!document.querySelector('#cornerL sub')` : `!!document.querySelector('#cornerL i') && !document.querySelector('#cornerL sub')` });
    const name = `${w}x${h}${dark ? ' dark' : ''} plane ${pl}`;
    const m = info[name] = await ev(`(() => {
      const c = document.getElementById('cornerL'), s = c.querySelector('sub'), l = c.querySelector('i'), st = document.getElementById('svStrip');
      if (!l) return null;
      const box = (r) => [r.left, r.top, r.right, r.bottom].map((x) => +x.toFixed(1)), g = document.createRange();
      g.selectNodeContents(s || l);
      return { html: c.innerHTML, corner: box(c.getBoundingClientRect()), letter: box(l.getBoundingClientRect()), sub: s ? box(g.getBoundingClientRect()) : null, name: box(g.getBoundingClientRect()), strip: st ? +st.getBoundingClientRect().top.toFixed(1) : null,
        fits: c.scrollWidth <= c.clientWidth && c.scrollHeight <= c.clientHeight, scroll: [c.scrollWidth, c.scrollHeight, c.clientWidth, c.clientHeight] };
    })()`);
    ok(`${name}: the corner has the plane's name`, !!m, m);
    if (!m) continue;
    const [cl, ct, cr, cb] = m.corner, [ll, lt, lr, lb] = m.letter, [nl, nt, nr, nb] = m.name;
    ok(`${name}: the corner's content fits its box`, m.fits, m);
    ok(`${name}: the name lies inside the corner`, nl >= cl - TOL && nr <= cr + TOL && nt >= ct - TOL && nb <= cb + TOL, m);
    if (m.strip != null) ok(`${name}: the corner is clear of the strip below`, cb <= m.strip + TOL, m);
    if (pl) ok(`${name}: the subscript is to the right of the letter, on its line`, m.sub[0] >= lr - TOL && m.sub[1] < lb, m);
  }
}
return { pass: fails.length === 0, fails, info };
