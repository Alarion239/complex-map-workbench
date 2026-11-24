// Figure export, two panels side by side: the map arrow between them, its head and its label meet no tick label. In the
// Homework figure (cross axes), panel (b)'s tick labels on its imaginary axis stand left of that axis: where the axis is at
// (b)'s left edge, they stand in the gap between the panels, where the arrow runs. The scenes are the classic Image figure of
// e^z then z², with the disc |z − 1| ≤ 0.3 on z: at focus 0 (F = (e^z)², (b)'s window right of 0) and at step 2 focused
// (w₂ = w₁², the same), in en and ru (the decimal comma makes the labels wider); every box the layout records for the arrow
// (its label, 'arrow'; its shaft, 'arrow-line'; its head, 'arrow-head') is clear of every tick label's box ('tick').
// (control: the disc |z| ≤ 0.3 under z then z², whose image sits around 0, (b)'s imaginary axis in its middle, the gap free;
// its arrow's boxes are in info, the same as before the arrow kept clear of text). The steps view's "Two planes" figure,
// whose arrow is placed the same way, z → w₂ and w₁ → w₂ on the same scene, and on the disc |z − 3| ≤ 1 under z then z²,
// where (b)'s tick labels stand in the gap at the arrow's first height: the same check (the last blocks).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const base = `http://localhost:${PORT}`;
const EXP = [{ type: 'custom', params: { expr: 'e^z', cut: 180 }, on: true }, { type: 'custom', params: { expr: 'z^2', cut: 180 }, on: true }];
const ID2 = [{ type: 'custom', params: { expr: 'z', cut: 180 }, on: true }, { type: 'custom', params: { expr: 'z^2', cut: 180 }, on: true }];
const scene = (steps, focus, c) => ({ v3: true, v4: true, v5: true, v6: true, nextId: 50, focus, rightMode: 'image', steps,
  shapes: [{ id: 'd1', kind: 'disc', c, r: 0.3, visible: true }] });
const build = async (ns, st, lang) => {
  await view(1440, 900, false);
  await seed(ns, st);
  await go(`${base}/test.html?ns=${ns}&lang=${lang}&view=classic`);
  await settled({ until: 'window.MathJax && typeof MathJax.tex2svg === "function" && !!window.__cmwFig', max: 30000 });
  return ev(`await (async () => { try { const f = await __cmwFig.build({ for: 'homework', cols: 2, capInImage: false }); if (!f) return { none: true };
    return { boxes: (f.boxes || []).filter((b) => /^(arrow|arrow-line|arrow-head|tick)$/.test(b.kind)) }; } catch (e) { return { err: String(e && e.stack || e).slice(0, 600) }; } })()`, 180000);
};
// how far apart two boxes must be to count as clear, pt
const GAP = 0.25;
const meets = (a, b) => a.x0 < b.x1 + GAP && a.x1 > b.x0 - GAP && a.y0 < b.y1 + GAP && a.y1 > b.y0 - GAP;
const CASES = [
  ['(e^z)², focus 0', EXP, 0, [1, 0]],
  ['w₁², step 2 focused', EXP, 2, [1, 0]],
];
for (const [tag, steps, focus, c] of CASES) for (const lang of ['en', 'ru']) {
  const name = `${tag}, ${lang}`;
  const f = await build('xac' + focus + lang + Date.now(), scene(steps, focus, c), lang);
  const arrow = (f.boxes || []).filter((b) => b.kind !== 'tick'), ticks = (f.boxes || []).filter((b) => b.kind === 'tick');
  const hits = arrow.flatMap((a) => ticks.filter((t) => meets(a, t)).map((t) => ({ arrow: a.kind, tick: t.tex, a: [a.x0, a.y0, a.x1, a.y1].map((v) => +v.toFixed(1)), t: [t.x0, t.y0, t.x1, t.y1].map((v) => +v.toFixed(1)) })));
  info[name] = { err: f.err, arrow: arrow.map((a) => ({ kind: a.kind, box: [a.x0, a.y0, a.x1, a.y1].map((v) => +v.toFixed(1)) })), hits };
  ok(`${name}: the figure has the map arrow, its label and its head (control)`, !f.err && !f.none && ['arrow', 'arrow-line', 'arrow-head'].every((k) => arrow.some((a) => a.kind === k)), info[name]);
  ok(`${name}: the arrow, its head and its label meet no tick label`, !f.err && hits.length === 0, hits);
}
// ---- (control) the image around 0: (b)'s imaginary axis in its middle, nothing in the gap
{
  const f = await build('xacc' + Date.now(), scene(ID2, 0, [0, 0]), 'en');
  const arrow = (f.boxes || []).filter((b) => b.kind !== 'tick'), ticks = (f.boxes || []).filter((b) => b.kind === 'tick');
  info.control = { err: f.err, arrow: arrow.map((a) => ({ kind: a.kind, box: [a.x0, a.y0, a.x1, a.y1].map((v) => +v.toFixed(1)) })) };
  ok('control, the image around 0: the arrow meets no tick label', !f.err && !arrow.some((a) => ticks.some((t) => meets(a, t))), info.control);
}
// ---- the steps view's "Two planes" figure (figSvTwo): its arrow is placed the same way, between plane From and plane To
for (const [tag, from, to] of [['z → w₂', 0, 2], ['w₁ → w₂', 1, 2]]) {
  const ns = 'xacs' + from + Date.now();
  await view(1440, 900, false);
  await seed(ns, scene(EXP, 0, [1, 0]));
  await go(`${base}/test.html?ns=${ns}&lang=en&view=steps`);
  await settled({ until: 'window.MathJax && typeof MathJax.tex2svg === "function" && !!window.__cmwFig && typeof __cmwSteps === "function" && __cmwSteps().planes.length > 2', max: 30000 });
  const f = await ev(`await (async () => { try { const f = await __cmwFig.build({ for: 'homework', svPic: 'two', svFrom: ${from}, svTo: ${to}, crop: 'fit', capInImage: false }); if (!f) return { none: true };
    return { view: f.view, boxes: (f.boxes || []).filter((b) => /^(arrow|arrow-line|arrow-head|tick)$/.test(b.kind)) }; } catch (e) { return { err: String(e && e.stack || e).slice(0, 600) }; } })()`, 180000);
  const arrow = (f.boxes || []).filter((b) => b.kind !== 'tick'), ticks = (f.boxes || []).filter((b) => b.kind === 'tick');
  const hits = arrow.flatMap((a) => ticks.filter((t) => meets(a, t)).map((t) => ({ arrow: a.kind, tick: t.tex })));
  info['two planes ' + tag] = { err: f.err, view: f.view, arrow: arrow.map((a) => ({ kind: a.kind, box: [a.x0, a.y0, a.x1, a.y1].map((v) => +v.toFixed(1)) })), hits };
  ok(`two planes, ${tag}: the figure has the map arrow and its head (control)`, !f.err && f.view === 'svTwo' && ['arrow-line', 'arrow-head'].every((k) => arrow.some((a) => a.kind === k)), info['two planes ' + tag]);
  ok(`two planes, ${tag}: the arrow, its head and its label meet no tick label`, !f.err && hits.length === 0, hits);
}
// ---- the Two planes figure where its first height meets a tick label: z then z² with the disc |z − 3| ≤ 1, Fit, so each panel
// has its own window right of 0 and (b)'s imaginary axis, with its tick labels, stands at (b)'s left edge, in the gap; at the
// first height (the middle) the arrow's head would land on (b)'s tick label "2". arrowPlace ends the arrow before it. In
// z → w₁ the shaft at the first height is long enough, but its label meets (b)'s tick label "0.5": arrowPlace takes the next
// height, where the label is clear.
// (the scene above has a disc of radius 0.3, too small for Fit's window search: every panel keeps the camera's window and
// the gap is free, so its rows pass with the arrow at any height)
const ZSQ = [{ type: 'custom', params: { expr: 'z', cut: 180 }, on: true }, { type: 'custom', params: { expr: 'z^2', cut: 180 }, on: true }];
const far = { v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, rightMode: 'image', steps: ZSQ, shapes: [{ id: 'd1', kind: 'disc', c: [3, 0], r: 1, visible: true }] };
for (const [tag, from, to] of [['z → w₂', 0, 2], ['w₁ → w₂', 1, 2], ['z → w₁', 0, 1]]) for (const lang of ['en', 'ru']) {
  const ns = 'xacf' + from + lang + Date.now();
  await view(1440, 900, false);
  await seed(ns, far);
  await go(`${base}/test.html?ns=${ns}&lang=${lang}&view=steps`);
  await settled({ until: 'window.MathJax && typeof MathJax.tex2svg === "function" && !!window.__cmwFig && typeof __cmwSteps === "function" && __cmwSteps().planes.length > 2', max: 30000 });
  const f = await ev(`await (async () => { try { const f = await __cmwFig.build({ for: 'homework', svPic: 'two', svFrom: ${from}, svTo: ${to}, crop: 'fit', capInImage: false }); if (!f) return { none: true };
    return { view: f.view, boxes: (f.boxes || []).filter((b) => /^(arrow|arrow-line|arrow-head|tick)$/.test(b.kind)) }; } catch (e) { return { err: String(e && e.stack || e).slice(0, 600) }; } })()`, 180000);
  const arrow = (f.boxes || []).filter((b) => b.kind !== 'tick'), ticks = (f.boxes || []).filter((b) => b.kind === 'tick');
  const hits = arrow.flatMap((a) => ticks.filter((t) => meets(a, t)).map((t) => ({ arrow: a.kind, tick: t.tex })));
  const name = `two planes, |z − 3| ≤ 1, ${tag}, ${lang}`;
  info[name] = { err: f.err, view: f.view, arrow: arrow.map((a) => ({ kind: a.kind, box: [a.x0, a.y0, a.x1, a.y1].map((v) => +v.toFixed(1)) })), hits };
  ok(`${name}: the figure has the map arrow and its head (control)`, !f.err && f.view === 'svTwo' && ['arrow-line', 'arrow-head'].every((k) => arrow.some((a) => a.kind === k)), info[name]);
  ok(`${name}: the arrow, its head and its label meet no tick label`, !f.err && hits.length === 0, hits);
}
return { pass: fails.length === 0, fails, info };
