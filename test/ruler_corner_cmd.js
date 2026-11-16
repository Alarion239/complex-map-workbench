// The corner axis label of a plane in the steps view (#1768): at the bottom left of the plane, over the strip, "z" and "w₁", "w₂" with a real
// subscript. The corner is one line of text in a box 18 px (desktop) or 14 px (phone) square, so the subscript shows whole inside it:
// not under the name and cut off by the box, down at the strip's top edge. At 1280 × 800 and 360 × 640, light and dark, on every plane:
// the corner's content fits its box, the label's boxes (the name's, the subscript's) lie inside it, and the corner is clear of the strip.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const SETTLE_MS = 60000;
const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'c1', kind: 'circle', c: [0, 0], r: 1, visible: true }],
  steps: [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } };
const TOL = 0.75;   // (CSS px: the glyph boxes round to a fraction of a pixel)
const READ = `(() => {
  const c = document.getElementById('cornerL'), r = c.getBoundingClientRect(), strip = document.getElementById('svStrip'), sr = strip ? strip.getBoundingClientRect() : null;
  const inside = (e) => { const b = e.getBoundingClientRect(); return b.left >= r.left - ${TOL} && b.right <= r.right + ${TOL} && b.top >= r.top - ${TOL} && b.bottom <= r.bottom + ${TOL}; };
  return { html: c.innerHTML, box: [Math.round(r.width), Math.round(r.height)], fits: c.scrollWidth <= c.clientWidth && c.scrollHeight <= c.clientHeight,
    parts: [...c.children].map((e) => ({ tag: e.tagName, inside: inside(e), box: [e.getBoundingClientRect().left - r.left, e.getBoundingClientRect().top - r.top, e.getBoundingClientRect().right - r.left, e.getBoundingClientRect().bottom - r.top].map((x) => Math.round(x * 10) / 10) })),
    clearOfStrip: !sr || r.bottom <= sr.top + 0.5 };
})()`;
let n = 0;
for (const [W, H, mobile, tag] of [[1280, 800, false, 'desktop'], [360, 640, true, 'phone']]) {
  for (const dark of [false, true]) {
    await view(W, H, dark, mobile);
    await seed(`ruler${tag}${dark ? 'd' : 'l'}`, st);
    await go(`http://localhost:${PORT}/test.html?ns=ruler${tag}${dark ? 'd' : 'l'}&view=steps`);
    await settled({ max: SETTLE_MS, until: 'typeof __cmwSteps === "function" && __cmwSteps().on && document.fonts.status === "loaded"' });
    for (const k of [0, 1, 2]) {
      await ev(`__cmwSteps({ go: ${k}, now: true }); 1`);
      await settled({ max: SETTLE_MS, until: `__cmwSteps().i === ${k} && !__cmwSteps().moving` });
      await sleep(400);
      const m = await ev(READ), name = `${tag} ${dark ? 'dark' : 'light'} plane ${k}`;
      info[name] = m; n++;
      ok(`${name}: the corner's content fits its box (${m.box.join(' × ')})`, m.fits, m);
      ok(`${name}: the name${k ? ' and its subscript lie' : ' lies'} inside the corner`, m.parts.length === (k ? 2 : 1) && m.parts.every((p) => p.inside), m);
      ok(`${name}: the corner is clear of the strip`, m.clearOfStrip, m);
    }
  }
}
info.checks = `${n} planes read`;
return { pass: fails.length === 0, fails, info };
