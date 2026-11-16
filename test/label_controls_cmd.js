// A point's label keeps off the plane's own controls (#1779): the labels are drawn on the plane's canvas, the controls over it
// (the readout and legend chips, the view buttons, the phone's button column), and a label whose best spot was under a button
// had its text covered. A point of z near the right edge of the plane, where the buttons are, at 360 × 640 (en and ru) and 1280 × 800:
// its label is drawn (not dropped), and no label's box overlaps the box of a control over the plane.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const SETTLE_MS = 60000;
// the controls over the left plane, as boxes in the plane's own pixels (what the labels' boxes are in)
const CONTROLS = `(() => {
  const plot = document.getElementById('plotL'), pr = plot.getBoundingClientRect();
  return [...plot.children].filter((c) => c.tagName !== 'CANVAS' && !c.classList.contains('hairline')).map((c) => ({ id: c.id || String(c.className).split(' ')[0], r: c.getBoundingClientRect() }))
    .filter((c) => c.r.width > 0 && c.r.height > 0 && getComputedStyle(document.getElementById(c.id) || plot.querySelector('.' + c.id) || plot).visibility !== 'hidden')
    .map((c) => ({ id: c.id, x0: c.r.left - pr.left, y0: c.r.top - pr.top, x1: c.r.right - pr.left, y1: c.r.bottom - pr.top }));
})()`;
for (const [W, H, mobile, lang, near] of [[360, 640, true, 'en', [1.4, -1.45]], [360, 640, true, 'ru', [1.4, -1.45]], [1280, 800, false, 'en', [3.3, -2.2]]]) {
  const tag = `${W}x${H} ${lang}`;
  const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'pt', kind: 'point', p: near, ci: 0, visible: true }],
    steps: [{ type: 'exp', params: {}, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } };
  await view(W, H, false, mobile);
  await seed(`lblctl${W}${lang}`, st);
  await go(`http://localhost:${PORT}/test.html?ns=lblctl${W}${lang}&lang=${lang}&view=steps`);
  await settled({ max: SETTLE_MS, until: 'typeof __cmwSteps === "function" && __cmwSteps().on && typeof __cmwLabelsPlaced === "function" && document.fonts.status === "loaded"' });
  await ev(`__cmwSteps({ go: 0, now: true }); 1`);
  await settled({ max: SETTLE_MS, until: '(__cmwLabelsPlaced() || []).length > 0' });
  await sleep(500);
  const labels = await ev('__cmwLabelsPlaced()'), controls = await ev(CONTROLS);
  info[tag] = { labels, controls };
  ok(`${tag}: the point's label is drawn`, labels.length === 1, labels);
  for (const l of labels) {
    const hit = controls.filter((c) => l.x < c.x1 && l.x1 > c.x0 && l.y < c.y1 && l.y1 > c.y0);
    ok(`${tag}: the label "${l.text}" overlaps no control over the plane`, hit.length === 0, { label: l, hit });
  }
}
return { pass: fails.length === 0, fails, info };
