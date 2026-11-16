// The ruler's corner letter names the plane shown (z, w₁, w₂ …) with a real subscript, and the subscript is whole: the letter and its
// subscript share a line (the subscript to the right of the letter and lower than its top), and the subscript's text box lies inside the
// corner, which clips what is outside it (overflow: hidden). Over a desktop at 1280 and 1024 px and a phone at 390 and 740 × 360, on the
// planes that have a subscript. A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const TOL = 0.5;   // (px: the text box is the font's content area, the digit inside it is a little smaller)
for (const [w, h, phone] of [[1280, 800, false], [1024, 768, false], [390, 844, true], [740, 360, true]]) {
  await view(w, h, false, phone);
  await go(`http://localhost:${PORT}/test.html?view=steps&ns=rc${w}${Date.now()}`);
  await settled({ max: 30000, until: `typeof __cmwSteps === "function" && !!document.getElementById('cornerL')` });
  for (const pl of [1, 2]) {
    await ev(`__cmwSteps({ go: ${pl}, now: true }); 1`);
    await settled({ max: 20000, only: true, until: `!!document.querySelector('#cornerL sub')` });
    const m = info[`${w}x${h} plane ${pl}`] = await ev(`(() => {
      const c = document.getElementById('cornerL'), s = c.querySelector('sub'), l = c.querySelector('i');
      if (!s || !l) return null;
      const cr = c.getBoundingClientRect(), lr = l.getBoundingClientRect(), g = document.createRange(); g.selectNodeContents(s); const tr = g.getBoundingClientRect();
      return { html: c.innerHTML, corner: [cr.left, cr.top, cr.right, cr.bottom].map((x) => +x.toFixed(1)), letter: [lr.left, lr.top, lr.right, lr.bottom].map((x) => +x.toFixed(1)), sub: [tr.left, tr.top, tr.right, tr.bottom].map((x) => +x.toFixed(1)) };
    })()`);
    const name = `${w}x${h} plane ${pl}`;
    ok(`${name}: the corner has a letter and a subscript`, !!m, m);
    if (!m) continue;
    const [cl, ct, cr, cb] = m.corner, [ll, lt, lr, lb] = m.letter, [sl, st, sr, sb] = m.sub;
    ok(`${name}: the subscript is to the right of the letter, on its line`, sl >= lr - TOL && st < lb, m);
    ok(`${name}: the subscript lies inside the corner (nothing of it clipped)`, sl >= cl - TOL && sr <= cr + TOL && st >= ct - TOL && sb <= cb + TOL, m);
  }
}
return { pass: fails.length === 0, fails, info };
