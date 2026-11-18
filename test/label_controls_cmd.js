// A point's label keeps off the plane's own controls: the labels are drawn on the plane's canvas, the controls over it
// (the readout and legend chips, the view buttons, the phone's button column), and a label whose best spot was under a button
// had its text covered. A point of z near the right edge of the plane, where the buttons are, at 360 × 640 (en and ru) and 1280 × 800:
// its label is drawn (not dropped), and no label's box overlaps the box of a control over the plane.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const SETTLE_MS = 60000;
// the controls a label's box lies under, found from the page and not from the code under test's rule (the plot's children that are
// shown): the elements of the plot that the browser puts on top at points across the label's box (every PROBE_PX px and its corners),
// other than the plot and its canvases. The readout chip counts here, which the code leaves out on purpose (its width follows the pointer):
// a label under it would fail, so the check is stricter than the code. A control with no pointer events is not found; the buttons are
const PROBE_PX = 6;
const under = (l) => ev(`(() => {
  const plot = document.getElementById('plotL'), pr = plot.getBoundingClientRect(), found = new Map();
  const x0 = pr.left + ${l.x}, x1 = pr.left + ${l.x1}, y0 = pr.top + ${l.y}, y1 = pr.top + ${l.y1};
  const nx = Math.max(1, Math.ceil((x1 - x0) / ${PROBE_PX})), ny = Math.max(1, Math.ceil((y1 - y0) / ${PROBE_PX}));
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= ny; j++) {
    const e = document.elementFromPoint(x0 + (x1 - x0) * i / nx, y0 + (y1 - y0) * j / ny);
    if (e && e !== plot && e.tagName !== 'CANVAS' && plot.contains(e)) found.set(e, (e.id || String(e.className)).split(' ')[0] || e.tagName);
  }
  return [...found.values()];
})()`);
for (const [W, H, mobile, lang, near] of [[360, 640, true, 'en', [1.4, -1.45]], [360, 640, true, 'ru', [1.4, -1.45]], [1280, 800, false, 'en', [3.3, -2.2]]]) {
  const tag = `${W}x${H} ${lang}`;
  const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'pt', kind: 'point', p: near, ci: 0, visible: true }],
    steps: [{ type: 'exp', params: {}, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } };
  await view(W, H, false, mobile);
  await loadView('steps', `lblctl${W}${lang}`, st, { lang });
  await settled({ max: SETTLE_MS, until: 'typeof __cmwSteps === "function" && __cmwSteps().on && typeof __cmwLabelsPlaced === "function" && document.fonts.status === "loaded"' });
  await ev(`__cmwSteps({ go: 0, now: true }); 1`);
  await settled({ max: SETTLE_MS, until: '(__cmwLabelsPlaced() || []).length > 0' });
  const labels = await ev('__cmwLabelsPlaced()');
  info[tag] = { labels, under: [] };
  ok(`${tag}: the point's label is drawn`, labels.length === 1, labels);
  for (const l of labels) {
    const hit = await under(l);
    info[tag].under.push(hit);
    ok(`${tag}: the label "${l.text}" lies under no control over the plane`, hit.length === 0, { label: l, hit });
  }
}
return { pass: fails.length === 0, fails, info };
