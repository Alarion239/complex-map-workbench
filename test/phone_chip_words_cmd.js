// The construction chip's words on a portrait phone (the plane's chip, `.draft-chip .cm-t`, and the context bar's title, `.ph-ctn`: the same sentence,
// "Switch to the plane to pick the curve · Perpendicular", the tool's name last). With a construction tool in hand on the globe, the tool's name is on
// screen in the chip or in the bar: the end of the words lies inside the box that clamps them, and no clamp ends in the middle of the name. At 320 x 568
// (where Russian and Italian words take four lines) and 360 x 640, in English, Russian and Italian, for the tools whose lines are longest (#2096).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const WARM_MS = 60000, QUIET_FRAMES = 3, QUIET_MAX_FRAMES = 120;
const CASES = [[320, 568, ['perp', 'touch', 'hyper', 'meet', 'midpoint']], [360, 640, ['perp', 'touch', 'meet']]];
// the box of #id has held still for QUIET_FRAMES frames in a row (the chip and the bar are placed by frames after the tool is picked)
const quiet = (sel) => ev(`new Promise((resolve) => {
  const e = document.querySelector(${JSON.stringify(sel)}); let last = '', same = 0, n = 0;
  const tick = () => { const r = e.getBoundingClientRect(), k = [r.left, r.top, r.width, r.height].join(); same = k === last ? same + 1 : 0; last = k;
    if (same >= ${QUIET_FRAMES} || ++n > ${QUIET_MAX_FRAMES}) resolve(true); else requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
})`);
// whether the end of e's words (its last three characters) lies inside e's own box: not clamped away, not scrolled off
const endShown = `(e) => { if (!e || !e.getClientRects().length) return null;
  const box = e.getBoundingClientRect(), w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT); let last = null, n;
  while ((n = w.nextNode())) if (n.textContent.trim()) last = n;
  if (!last) return { shown: false, text: '' };
  const r = document.createRange(); r.setStart(last, Math.max(0, last.textContent.length - 3)); r.setEnd(last, last.textContent.length);
  const q = r.getBoundingClientRect();
  return { shown: q.height > 0 && q.bottom <= box.bottom + 0.5 && q.right <= box.right + 0.5, text: e.textContent.trim().slice(-30), box: [Math.round(box.width), Math.round(box.height)], ch: e.clientHeight, sh: e.scrollHeight }; }`;
for (const [w, h, tools] of CASES) for (const lang of ['en', 'ru', 'it']) for (const tool of tools) {
  const name = `${w}x${h} ${lang} ${tool}`;
  await view(w, h, false, true);
  await go(`http://localhost:${PORT}/test.html?view=steps&lang=${lang}&ns=cw${w}${tool}${Date.now() % 100000}`);
  await settled({ max: WARM_MS, until: 'typeof __cmwSteps === "function" && !!document.documentElement.classList.contains("ph") && !!document.querySelector("#constructTools .tool[data-tool=perp]")' });
  await ev(`__cmwSteps({ surf: 'sphere', go: 0, now: true }); 1`);
  await settled({ max: WARM_MS, until: `!!document.querySelector('#leftReadout .rglobe')` });
  await ev(`document.querySelector('#constructTools .tool[data-tool="${tool}"]').click(); 1`);
  await settled({ max: WARM_MS, until: `!!document.querySelector('.ph-ctx.in') && !document.getElementById('draftChipL').hidden && !!document.querySelector('#draftChipL .cm-t')` });
  await quiet('#draftChipL .cm-chip');
  const m = info[name] = await ev(`(() => { const f = ${endShown}; return { chip: f(document.querySelector('#draftChipL .cm-t')), bar: f(document.querySelector('.ph-ctx.in .ph-ctn')) }; })()`);
  ok(`${name}: the tool's name is on screen in the construction chip or in the context bar`, !!((m.chip && m.chip.shown) || (m.bar && m.bar.shown)), m);
}
return { pass: fails.length === 0, fails, info };
