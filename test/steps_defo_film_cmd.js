// The steps view's deformation film (Export → Picture → Deformation film): the glide of the step that leads to the shown plane
// at t = 0, 1/3, 2/3 and 1, four frames of the screen's own picture parked at those places on the thread. Built with typeset
// text, for a step that is a map (the phase film) and for one that is d/dz (the derivative film): four frames, the first the
// previous plane at rest and the last the shown plane at rest, the middle two neither of them, the caption naming the step and
// the times; and plane 0, which has no step into it, gets its own picture.
// A command file for a CDP daemon:  <runner> test/steps_defo_film_cmd.js
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
await view(1440, 900, false);
const chain = (extra) => ({ v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0,
  shapes: [{ id: 'd1', kind: 'disc', c: [0.3, 0.2], r: 1.4, ci: 0, visible: true }],
  steps: [{ type: 'pown', params: { n: 2 }, on: true }, { type: 'affine', params: { a: 'i', b: '0' }, on: true }].concat(extra || []) });
const base = 'http://localhost:8793';
let ns = 0;
const open = async (st, plane) => {
  const id = 'sdf' + Date.now() % 1e7 + ns++;
  await seed(id, st);
  await go(`${base}/test-mj.html?ns=${id}&view=steps`);
  await settled({ until: 'window.MathJax && typeof MathJax.tex2svg === "function" && !!window.__cmwSteps && !!window.Figure && __cmwSteps().planes.length > 0', max: 30000 });
  await ev(`(__cmwSteps({ go: ${plane}, now: true }), 1)`);
  await settled({ until: '!__cmwSteps().moving', max: 20000 });
};
const build = (pic) => ev(`await (async () => { const f = await Figure.build({ svPic: '${pic}', for: 'article', cols: 2, capInImage: false }); return f && f.svg ? { svg: f.svg, cap: f.captionTex } : f; })()`, 120000);
const images = (svg) => [...svg.matchAll(/<image [^>]*xlink:href="(data:[^"]+)"/g)].map((m) => m[1]);
const CASES = [{ tag: 'a map', st: chain(), plane: 2 }, { tag: 'd/dz', st: chain([{ type: 'deriv', params: {}, on: true }]), plane: 3 }];
for (const c of CASES) {
  await open(c.st, c.plane);
  const f = await build('defo');
  if (!f || !f.svg) { ok(`${c.tag}: a figure`, false, f); continue; }
  const im = images(f.svg);
  ok(`${c.tag}: four frames`, im.length === 4, im.length);
  ok(`${c.tag}: the first and last frames differ, as do the middle two from each end`, new Set(im).size === 4, im.map((x) => x.length));
  ok(`${c.tag}: the caption names the step and the times`, /Frames of the step from/.test(f.cap) && /t=0,\\,1\/3,\\,2\/3,\\,1/.test(f.cap), String(f.cap).slice(-240));
  const shown = await build('plane');
  const sIm = shown && shown.svg ? images(shown.svg) : [];
  ok(`${c.tag}: the last frame is the shown plane's own picture`, sIm.length === 1 && Math.abs(sIm[0].length - im[3].length) < 0.1 * sIm[0].length, { shown: sIm.map((x) => x.length), last: im[3].length });
  R[c.tag] = { frames: im.length, caption: f.cap };
}
// plane 0 has no step into it: the film is not drawn, the figure is the plane's own
await open(chain(), 0);
const f0 = await build('defo');
ok('plane 0: no film, the one picture of the plane', !!f0 && !!f0.svg && images(f0.svg).length === 1, f0 && f0.svg ? images(f0.svg).length : f0);
return { pass: fails.length === 0, fails, results: R };
