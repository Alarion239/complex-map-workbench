// The paths figure on the Landscape, built with typeset text: the curves the sentence names are the curves that are drawn.
// A command file for a CDP daemon:  <runner> test/steps_paths_land_fig_cmd.js
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
await view(1440, 900, false);
await load('psf' + Date.now(), {});
const base = await ev('location.origin');
let ns = 0;
const open = async (exN, plane) => {
  await go(`${base}/test-mj.html?view=steps&ns=psf${Date.now() % 1e7}${ns++}`);
  await settled({ until: 'window.MathJax && typeof MathJax.tex2svg === "function" && !!window.__cmwSteps && !!window.Figure', max: 30000 });
  await ev(`(__cmwExample(${exN}), 1)`);
  await settled({ until: '__cmwSteps().planes.length > 0', max: 15000 });
  await ev(`(__cmwSteps({ surf: 'land' }), __cmwSteps({ go: ${plane}, now: true }), 1)`);
  await settled({ until: '!__cmwSteps().moving', max: 20000 });
};
for (const plane of [1, 2]) {
  const tag = `ex 1 plane ${plane} on the land`;
  await open(1, plane);
  const fig = await ev(`await (async () => { const f = await Figure.build({ svPic: 'paths', for: 'article', cols: 2, capInImage: false }); return f && f.svg ? { svg: f.svg, cap: f.captionTex } : f; })()`, 120000);
  if (!fig || !fig.svg) { ok(`${tag}: a figure`, false, fig); continue; }
  const rings = ((fig.svg.match(/class="mf-rings">([\s\S]*?)<\/g>/) || ['', ''])[1].match(/<(?:path|circle)/g) || []).length;
  const named = ((String(fig.cap).match(/paths \$t\\mapsto H_t\(z\)\$ of (.*?), from/) || ['', ''])[1].match(/\d+/g) || []).reduce((n, v) => n + +v, 0);
  ok(`${tag}: the paths are drawn, more than two`, rings > 2, rings);
  ok(`${tag}: the sentence names as many paths as are drawn`, named === rings, { named, rings, cap: String(fig.cap).slice(-260) });
  R[tag] = { rings, named };
}
return { pass: fails.length === 0, fails, results: R };
