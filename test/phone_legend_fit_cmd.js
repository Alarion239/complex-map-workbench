// The unfolded colour key under the tall construction bar fits the room it has (#2433): phone landscape, the steps view on
// example 1 (its tour lane at y 48–96 under the head), the Hyperbolic tool picked so the bar is open at its tall height, the
// shown plane z with its colour carried from w₂, the key unfolded. At 568 × 320 and 600 × 320 the plane above the bar leaves
// the card 46 px, less than the key's 72: the key is drawn compact to that height (a smaller ring with "1" and "−1", the
// plane it is carried from in lines beside it), with nothing to scroll and nothing cut: the card's content height is its own,
// the key's picture lies inside the card, and the card inside the plane above the bar. Its description still says the whole key.
// At 640 × 360 and 740 × 360 (controls) the key is drawn whole, 72 px. Closing the bar gives the key its whole drawing back.
// In en and ru, light and dark. In the steps view (ci/suite_views.js). A command file for a CDP daemon (test/cdp_kit README);
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
    fitH: k.fitH, compactLines: k.compactLines, caption: k.caption, say: (document.getElementById('leftLegendSay') || {}).textContent || '', tall: document.documentElement.classList.contains('ph-ctx-tall') };
})()`);
for (const dark of [false, true]) for (const lang of ['en', 'ru']) for (const [w, h] of [[568, 320], [600, 320], [640, 360], [740, 360]]) {
  if (dark && w > 600) continue;
  const tag = `${lang}${dark ? ' dark' : ''} ${w}×${h}`, short = h === 320;
  await view(w, h, dark, true);
  await go(`http://localhost:${PORT}/test.html?view=steps&lang=${lang}&ns=plf${w}${lang}${dark ? 'd' : ''}${Date.now() % 100000}`);
  await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR && __cmwSteps().ready.ready' });
  await ev(`__cmwExample(1); 1`);
  await settled({ max: 60000, until: '__cmwSteps().ready.ready' });
  await frames();
  await settled({ max: 20000, until: `!!document.querySelector('#constructTools .tool[data-tool="hyper"]')` });
  await ev(`document.querySelector('#constructTools .tool[data-tool="hyper"]').click(); 1`);
  await settled({ max: 20000, until: `document.documentElement.classList.contains('ph-ctx-tall') && !!document.querySelector('.ph-ctx.in')` });
  await frames(); await frames();
  await ev(`document.getElementById('leftLegend').click(); 1`);
  await settled({ max: 10000, until: `!document.getElementById('leftLegend').classList.contains('collapsed')` });
  await frames(); await frames();
  const m = info[tag] = await card();
  ok(`${tag}: the tall bar is open and the key is the carried colour key (control)`, m.tall && /w₂/.test(m.caption || ''), m);
  ok(`${tag}: the unfolded card has nothing to scroll`, m.sh <= m.ch + SLACK, { sh: m.sh, ch: m.ch });
  ok(`${tag}: the key's picture lies inside the card`, m.pic.t >= m.card.t - SLACK && m.pic.b <= m.card.b + SLACK && m.pic.l >= m.card.l - SLACK && m.pic.r <= m.card.r + SLACK, { pic: m.pic, card: m.card });
  ok(`${tag}: the card lies inside the plane, above the bar`, m.card.t >= m.plot.t - SLACK && m.card.b <= Math.min(m.plot.b, m.barTop) + SLACK, { card: m.card, plot: m.plot, barTop: m.barTop });
  ok(`${tag}: the card's description says the whole key`, m.say.includes(m.caption) && m.say.length > m.caption.length + 10, m.say);
  if (short) {
    ok(`${tag}: the key is drawn compact, to the card's room`, m.fitH > 0 && m.fitH < FULL_H && Math.abs(m.picH - m.fitH) <= SLACK, { fitH: m.fitH, picH: m.picH });
    ok(`${tag}: the compact key names the plane in one line`, !!m.compactLines && m.compactLines.length === 1 && /w₂/.test(m.compactLines[0]), m.compactLines);
    // (the bar closed, the key has its whole drawing back)
    await key('Escape');
    await settled({ max: 20000, until: `!document.documentElement.classList.contains('ph-ctx-tall')` });
    await frames(); await frames();
    const back = info[tag + ' bar closed'] = await card();
    ok(`${tag}: with the bar closed, the key is drawn whole again`, back.fitH === 0 && Math.abs(back.picH - FULL_H) <= SLACK, { fitH: back.fitH, picH: back.picH, tall: back.tall });
  } else ok(`${tag}: the key is drawn whole (control)`, m.fitH === 0 && Math.abs(m.picH - FULL_H) <= SLACK, { fitH: m.fitH, picH: m.picH });
}
return { pass: fails.length === 0, fails: fails.slice(0, 60), info };
