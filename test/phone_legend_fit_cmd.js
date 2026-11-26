// The unfolded colour key under the tall construction bar fits the room it has (#2433): phone landscape, the steps view on
// example 1 (its tour lane at y 48–96 under the head), the Hyperbolic tool picked so the bar is open at its tall height, the
// key unfolded, on two planes: z, its colour carried from w₂, and w₂, the colour plane, with its own key (the ring, the modulus
// strip with its factor and "per band", the caption "arg and |w₂|"). At 568 × 320 and 600 × 320 the plane above the bar leaves
// the card 46 px, less than the key's 72: the key is drawn compact to that height, a smaller ring with "1" and "−1", with
// nothing to scroll and nothing cut: the card's content height is its own, the key's picture lies inside the card, and the
// card inside the plane above the bar. Its description still says the whole key. On z the plane it is carried from stands in
// one line beside the ring. On w₂ (rvE's call) the ring is 38 px across and the strip's column stands whole beside it, clear of
// the ring's "1", inside the card, its parts apart, and «на полосу яркости» narrowed no further than in the whole key; the
// caption is left out of the drawing, not cut. At 640 × 360 and 740 × 360 (controls) the key is drawn whole, 72 px, its
// caption drawn. Closing the bar gives the key its whole drawing back.
// In en, ru and it, light and dark. In the steps view (ci/suite_views.js). A command file for a CDP daemon (test/cdp_kit README);
// prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const FULL_H = 72;     // the key's whole drawing, px (LEG.H)
const SLACK = 0.5;     // layout rounding, px
const frames = () => ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
const card = () => ev(`(() => {
  const lg = document.getElementById('leftLegend'), cv = document.getElementById('legendCanvasL'), R = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
  const p = R(document.getElementById('plotL')), bar = document.querySelector('.ph-ctx.in'), k = __cmwLegend();
  return { card: R(lg), pic: R(cv), plot: p, barTop: bar ? bar.getBoundingClientRect().top : null, sh: lg.scrollHeight, ch: lg.clientHeight, picH: cv.getBoundingClientRect().height,
    fitH: k.fitH, compactLines: k.compactLines, caption: k.caption, capDrawn: k.capDrawn, geo: k.geo, oneEnd: k.oneEnd, stripInk: k.stripInk, wordK: k.wordK, say: (document.getElementById('leftLegendSay') || {}).textContent || '', tall: document.documentElement.classList.contains('ph-ctx-tall') };
})()`);
const OWN_W = 136;     // the plane's own key's width, px (LEG.W)
const OWN_R = 19;      // the compact own key's ring radius, px (38 across: rvE's call)
const meets = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
for (const plane of [0, 2]) for (const dark of [false, true]) for (const lang of ['en', 'ru', 'it']) for (const [w, h] of [[568, 320], [600, 320], [640, 360], [740, 360]]) {
  if (dark && (w > 600 || lang === 'it')) continue;
  const own = plane === 2, tag = `${own ? 'w₂' : 'z'} ${lang}${dark ? ' dark' : ''} ${w}×${h}`, short = h === 320;
  await view(w, h, dark, true);
  await go(`http://localhost:${PORT}/test.html?view=steps&lang=${lang}&ns=plf${plane}${w}${lang}${dark ? 'd' : ''}${Date.now() % 100000}`);
  await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR && __cmwSteps().ready.ready' });
  await ev(`__cmwExample(1); 1`);
  await settled({ max: 60000, until: '__cmwSteps().ready.ready' });
  await ev(`(__cmwSteps({ go: ${plane}, now: true }), 1)`);
  await settled({ max: 20000, until: `!__cmwSteps().moving && __cmwSteps().i === ${plane}` });
  await frames();
  await settled({ max: 20000, until: `!!document.querySelector('#constructTools .tool[data-tool="hyper"]')` });
  await ev(`document.querySelector('#constructTools .tool[data-tool="hyper"]').click(); 1`);
  await settled({ max: 20000, until: `document.documentElement.classList.contains('ph-ctx-tall') && !!document.querySelector('.ph-ctx.in')` });
  await frames(); await frames();
  await ev(`document.getElementById('leftLegend').click(); 1`);
  await settled({ max: 10000, until: `!document.getElementById('leftLegend').classList.contains('collapsed')` });
  await frames(); await frames();
  const m = info[tag] = await card();
  ok(`${tag}: the tall bar is open and the key is ${own ? 'the plane\'s own colour key' : 'the carried colour key'} (control)`, m.tall && /w₂/.test(m.caption || '') && (!own || lang !== 'en' || m.caption === 'arg and |w₂|'), m);
  ok(`${tag}: the unfolded card has nothing to scroll`, m.sh <= m.ch + SLACK, { sh: m.sh, ch: m.ch });
  ok(`${tag}: the key's picture lies inside the card`, m.pic.t >= m.card.t - SLACK && m.pic.b <= m.card.b + SLACK && m.pic.l >= m.card.l - SLACK && m.pic.r <= m.card.r + SLACK, { pic: m.pic, card: m.card });
  ok(`${tag}: the card lies inside the plane, above the bar`, m.card.t >= m.plot.t - SLACK && m.card.b <= Math.min(m.plot.b, m.barTop) + SLACK, { card: m.card, plot: m.plot, barTop: m.barTop });
  ok(`${tag}: the card's description says the whole key`, m.say.includes(m.caption) && m.say.length > m.caption.length + 10, m.say);
  if (short) {
    ok(`${tag}: the key is drawn compact, to the card's room`, m.fitH > 0 && m.fitH < FULL_H && Math.abs(m.picH - m.fitH) <= SLACK, { fitH: m.fitH, picH: m.picH });
    if (!own) ok(`${tag}: the compact key names the plane in one line`, !!m.compactLines && m.compactLines.length === 1 && /w₂/.test(m.compactLines[0]), m.compactLines);
    else {
      const ink = m.stripInk || [], card = { x0: 0, x1: OWN_W, y0: 0, y1: m.fitH };
      ok(`${tag}: the compact ring is 38 px across`, !!m.geo && m.geo.R === OWN_R, m.geo);
      ok(`${tag}: the caption is left out of the drawing`, m.capDrawn === false, m.capDrawn);
      ok(`${tag}: the strip's column is whole: the strip, its factor and "per band"`, ink.length === 3, ink);
      ok(`${tag}: the strip's column lies inside the key`, ink.every((b) => b.x0 >= card.x0 - SLACK && b.x1 <= card.x1 + SLACK && b.y0 >= card.y0 - SLACK && b.y1 <= card.y1 + SLACK), { ink, card });
      ok(`${tag}: the strip's column stands clear of the ring's "1"`, ink.every((b) => b.x0 >= m.oneEnd + 4), { ink, oneEnd: m.oneEnd });
      ok(`${tag}: the strip's parts do not meet`, ink.every((a, i) => ink.every((b, j) => j <= i || !meets(a, b))), ink);
      m.ownWordK = m.wordK;
    }
    // (the bar closed, the key has its whole drawing back)
    await key('Escape');
    await settled({ max: 20000, until: `!document.documentElement.classList.contains('ph-ctx-tall')` });
    await frames(); await frames();
    const back = info[tag + ' bar closed'] = await card();
    ok(`${tag}: with the bar closed, the key is drawn whole again`, back.fitH === 0 && Math.abs(back.picH - FULL_H) <= SLACK, { fitH: back.fitH, picH: back.picH, tall: back.tall });
    if (own) ok(`${tag}: "per band" is narrowed no further than in the whole key`, m.ownWordK >= back.wordK - 1e-6, { compact: m.ownWordK, whole: back.wordK });
  } else ok(`${tag}: the key is drawn whole (control)`, m.fitH === 0 && Math.abs(m.picH - FULL_H) <= SLACK && (!own || m.capDrawn), { fitH: m.fitH, picH: m.picH, capDrawn: m.capDrawn });
}
return { pass: fails.length === 0, fails: fails.slice(0, 60), info };
