// The paths figure on the sphere, built with typeset text: the curves the sentence names are the curves that are drawn.
// A command file for a CDP daemon:  <runner> test/steps_paths_sphere_fig_cmd.js
const fails = [], R = {};
const MIN_RINGS = 3;   // fewer drawn paths than this is not a figure of the step
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
await view(1440, 900, false);
await load('psf' + Date.now(), {});
const base = await ev('location.origin');
let ns = 0;
const open = async (exN, plane) => {
  await go(`${base}/test-mj.html?view=steps&ns=psf${Date.now() % 1e7}${ns++}`);
  await settled({ until: 'window.MathJax && typeof MathJax.tex2svg === "function" && !!window.__cmwSteps && !!window.Figure', max: 30000 });
  await ev(`(__cmwExample(${exN}), 1)`);
  await adopted();
  await settled({ until: '__cmwSteps().planes.length > 0', max: 15000 });
  await ev(`(__cmwSteps({ surf: 'sphere' }), __cmwSteps({ go: ${plane}, now: true }), 1)`);
  await settled({ until: '!__cmwSteps().moving && !(window.__cmwSphere && __cmwSphere().running)', max: 20000 });
};
for (const plane of [1, 2]) {
  const tag = `ex 1 plane ${plane} on the sphere`;
  await open(1, plane);
  const fig = await ev(`await (async () => { const f = await Figure.build({ svPic: 'paths', for: 'article', cols: 2, capInImage: false }); return f && f.svg ? { svg: f.svg, cap: f.captionTex } : f; })()`, 120000);
  if (!fig || !fig.svg) { ok(`${tag}: a figure`, false, fig); continue; }
  const rings = ((fig.svg.match(/class="mf-rings">([\s\S]*?)<\/g>/) || ['', ''])[1].match(/<(?:path|circle)/g) || []).length;
  const named = ((String(fig.cap).match(/paths \$t\\mapsto H_t\(z\)\$ of (.*?), from/) || ['', ''])[1].match(/\d+/g) || []).reduce((n, v) => n + +v, 0);
  ok(`${tag}: the paths are drawn, at least ${MIN_RINGS}`, rings >= MIN_RINGS, rings);
  ok(`${tag}: the sentence names as many paths as are drawn`, named === rings, { named, rings, cap: String(fig.cap).slice(-260) });
  ok(`${tag}: a space separates the sentence naming the paths from the one before it`, /[^\s]\s+Curves are the paths/.test(String(fig.cap)) && !/\SCurves are the paths/.test(String(fig.cap)), String(fig.cap).slice(-300));
  R[tag] = { rings, named };
}
return { pass: fails.length === 0, fails, results: R };
