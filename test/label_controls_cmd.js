// A point's label keeps off the plane's own controls: the labels are drawn on the plane's canvas, the controls over it
// (the legend chips, the view buttons, the phone's button column), and a label whose best spot was under a button
// had its text covered. A point of z near the right edge of the plane, where the buttons are, at 360 × 640 (en and ru) and 1280 × 800:
// its label is drawn (not dropped), and no label's box overlaps the box of a control over the plane.
// On a phone the plane's key column and view stack ride up above the context bar (a selected shape) and above a message with a
// transition: once they have stopped, the label of a point that was clear of them at rest is still clear of them.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const SETTLE_MS = 60000;
// the controls a label's box lies under, found from the page and not from the code under test's rule (the plot's children that are
// shown): the elements of the plot that the browser puts on top at points across the label's box (every PROBE_PX px and its corners),
// other than the plot and its canvases. Where the readout chip takes pointer events (the desktop; the phone's has none) it counts here,
// which the code leaves out on purpose (its width follows the pointer): a label under it would fail, so the check is stricter than the
// code there. A control with no pointer events is not found; the buttons are
const PROBE_PX = 6;
const under = (l) => ev(`(() => {
  const plot = document.getElementById('plotL'), pr = plot.getBoundingClientRect(), found = new Map();
  const x0 = pr.left + ${l.x}, x1 = pr.left + ${l.x1}, y0 = pr.top + ${l.y}, y1 = pr.top + ${l.y1};
  const nx = Math.max(1, Math.ceil((x1 - x0) / ${PROBE_PX})), ny = Math.max(1, Math.ceil((y1 - y0) / ${PROBE_PX}));
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= ny; j++) {
    const e = document.elementFromPoint(x0 + (x1 - x0) * i / nx, y0 + (y1 - y0) * j / ny);
    if (e && e !== plot && e.tagName !== 'CANVAS' && plot.contains(e)) found.set(e, (e.id || e.getAttribute('class') || '').split(' ')[0] || e.tagName);
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
// the keys' lift: a point clear of the column at rest, the shape selected (the context bar) or a message shown (the toast), at 360 × 640
const LIFT_PT = [1.45, -0.645];
// no transition of the plane's keys is still running (the lift has stopped)
const LIFT_STOPPED = `!document.getAnimations().some((a) => a.transitionProperty === 'bottom')`;
for (const [lang, what, act] of [['en', 'selected', "__cmwSelect('pt')"], ['ru', 'selected', "__cmwSelect('pt')"], ['en', 'a message shown', "__cmwToast('Added.', null, { sticky: true })"], ['ru', 'a message shown', "__cmwToast('Added.', null, { sticky: true })"]]) {
  const tag = `360x640 ${lang}, ${what}`;
  const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'pt', kind: 'point', p: LIFT_PT, ci: 0, visible: true }],
    steps: [{ type: 'exp', params: {}, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } };
  await view(360, 640, false, true);
  await loadView('steps', `lblcls${lang}${what.length}`, st, { lang });
  await settled({ max: SETTLE_MS, until: 'typeof __cmwSteps === "function" && __cmwSteps().on && typeof __cmwLabelsPlaced === "function" && document.fonts.status === "loaded"' });
  await ev(`__cmwSteps({ go: 0, now: true }); 1`);
  await settled({ max: SETTLE_MS, until: '(__cmwLabelsPlaced() || []).length > 0' });
  const rest = await ev('__cmwLabelsPlaced()');
  ok(`${tag}: at rest the point's label is drawn and lies under no control`, rest.length === 1 && (await under(rest[0])).length === 0, rest);
  await ev(`${act}; 1`);
  await settled({ max: SETTLE_MS, until: `${LIFT_STOPPED} && /ph-(ctx|toast)-on/.test(document.documentElement.className)` });
  await settled({ max: SETTLE_MS });
  const lifted = await ev('__cmwLabelsPlaced()');
  const hit = lifted.length === 1 ? await under(lifted[0]) : [];
  info[tag] = { rest, lifted, hit };
  // (the lifted column covers the point itself, so its label may be dropped: it is never left under a control)
  ok(`${tag}: once the keys have stopped rising the label lies under no control (a point under them may have none)`, lifted.length <= 1 && hit.length === 0, { lifted, hit });
}
return { pass: fails.length === 0, fails, info };
