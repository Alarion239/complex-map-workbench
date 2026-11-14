// The paths figure on the sphere, built with typeset text: the curves the sentence names are the curves that are drawn.
// A command file for a CDP daemon:  <runner> test/steps_paths_sphere_fig_cmd.js
const fails = [], R = {};
const MIN_RINGS = 3;   // fewer drawn paths than this is not a figure of the step
const PATH_CLEAR = 1;   // a mark of the sphere keeps this far (pt) from the points of the paths drawn
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
  await ev(`(__cmwSteps({ surf: 'sphere' }), __cmwSteps({ go: ${plane}, now: true }), 1)`);
  await settled({ until: '!__cmwSteps().moving && !(window.__cmwSphere && __cmwSphere().running)', max: 20000 });
};
for (const plane of [1, 2]) {
  const tag = `ex 1 plane ${plane} on the sphere`;
  await open(1, plane);
  const fig = await ev(`await (async () => { const f = await Figure.build({ svPic: 'paths', for: 'article', cols: 2, capInImage: false }); return f && f.svg ? { svg: f.svg, cap: f.captionTex, marks: f.boxes.filter((b) => b.kind === 'globe-label').map((b) => ({ tex: b.tex, x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1 })) } : f; })()`, 120000);
  if (!fig || !fig.svg) { ok(`${tag}: a figure`, false, fig); continue; }
  const rings = ((fig.svg.match(/class="mf-rings">([\s\S]*?)<\/g>/) || ['', ''])[1].match(/<(?:path|circle)/g) || []).length;
  const named = ((String(fig.cap).match(/paths \$t\\mapsto H_t\(z\)\$ of (.*?), from/) || ['', ''])[1].match(/\d+/g) || []).reduce((n, v) => n + +v, 0);
  // (the points of the drawn paths: the numbers of the path data of the paths' elements; a mark's box grown by PATH_CLEAR holds none)
  const drawn = [...fig.svg.matchAll(/<path d="([^"]*)"[^>]*class="mf-paths"/g)].flatMap((m) => [...m[1].matchAll(/[ML]\s*(-?[\d.]+)[ ,](-?[\d.]+)/g)].map((q) => [+q[1], +q[2]]));
  const touching = fig.marks.filter((b) => drawn.some(([x, y]) => x > b.x0 - PATH_CLEAR && x < b.x1 + PATH_CLEAR && y > b.y0 - PATH_CLEAR && y < b.y1 + PATH_CLEAR)).map((b) => b.tex);
  ok(`${tag}: the marks of the sphere (${fig.marks.map((b) => b.tex).join(' ') || 'none'}) keep ${PATH_CLEAR} pt clear of the paths drawn (touching: ${touching.join(' ') || 'none'})`, drawn.length > 0 && fig.marks.length > 0 && touching.length === 0, { drawn: drawn.length, marks: fig.marks.length, touching });
  ok(`${tag}: the paths are drawn, at least ${MIN_RINGS}`, rings >= MIN_RINGS, rings);
  ok(`${tag}: the sentence names as many paths as are drawn`, named === rings, { named, rings, cap: String(fig.cap).slice(-260) });
  ok(`${tag}: a space separates the sentence naming the paths from the one before it`, /[^\s]\s+Curves are the paths/.test(String(fig.cap)) && !/\SCurves are the paths/.test(String(fig.cap)), String(fig.cap).slice(-300));
  R[tag] = { rings, named };
}
return { pass: fails.length === 0, fails, results: R };
