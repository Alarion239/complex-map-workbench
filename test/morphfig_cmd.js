// The paths figure in the steps view (Export → Picture → Paths): the shown plane with the paths t -> H_t(z) of the step
// that leads to it, over the previous plane's image of X (gray outline) and the plane's own image. For Strip to disk (planes
// 1 and 2) and the Joukowski map: the paths chosen for the step end on the planes' images (checked without typesetting); vectors present (a path set, a ring and an end dot per path, at most one arrowhead per
// path), the caption names the shown plane and the paths, no inline \frac, single and double column, the same figure twice
// is the same vectors, a dark theme leaves no dark-theme ink, and the option is off, with a reason, on plane 0. The
// classic view's selection checks are morphfig_classic_cmd.js.
// A command file for a CDP daemon:  <runner> test/morphfig_cmd.js
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
await view(1440, 900, false);
await load('mfg' + Date.now(), {});
const base = await ev('location.origin');
let ns = 0;
const open = async (exN, plane) => {
  await go(`${base}/test.html?view=steps&ns=mfg${Date.now() % 1e7}${ns++}`);
  await settled({ until: 'window.MathJax && typeof MathJax.tex2svg === "function" && !!window.__cmwSteps && !!window.Figure', max: 30000 });
  await ev(`(__cmwExample(${exN}), 1)`);
  await settled({ until: '__cmwSteps().planes.length > 0', max: 15000, floor: 300 });
  await ev(`(__cmwSteps({ surf: 'plane' }), __cmwSteps({ go: ${plane}, now: true }), __cmwSet('wKey', false), 1)`);
  await settled({ until: '!__cmwSteps().moving', max: 15000, floor: 400 });
};
const CASES = [{ ex: 1, plane: 1 }, { ex: 1, plane: 2 }, { ex: 3, plane: 1 }];
// (a build's ids carry its own time-stamped namespace: cmw<hash>-c<n>)
const strip = (s) => String(s).replace(/href="data:[^"]+"/g, '').replace(/cmw[0-9a-z]+-/g, 'cmw-');
for (const c of CASES) {
  const tag = `ex ${c.ex} plane ${c.plane}`;
  await open(c.ex, c.plane);
  R[tag] = {};
  // the paths chosen for the step (no typesetting): a few, whose starts are the previous plane's image of z and whose ends are the shown plane's
  const sel = await ev('await __cmwSvPaths()', 120000);
  ok(`${tag}: the paths are chosen, 3 to 18 of them`, sel && sel.n >= 3 && sel.n <= 18, sel);
  ok(`${tag}: path starts are the previous plane's image and ends the shown plane's, to 1e-9`, sel && sel.e0 < 1e-9 && sel.e1 < 1e-9, sel);
  ok(`${tag}: the sentence names the paths`, sel && /Curves are the paths/.test(sel.sentence || ''), sel && sel.sentence);
  for (const cols of [1, 2]) {
    const fig = await ev(`await (async () => { const f = await Figure.build({ svPic: 'paths', for: 'article', cols: ${cols}, capInImage: false }); return f && f.svg ? { svg: f.svg, cap: f.captionTex } : f; })()`, 120000);
    if (!fig || !fig.svg) { ok(`${tag} cols ${cols}: a figure`, false, fig); continue; }
    const nOf = (cls) => ((fig.svg.match(new RegExp(`class="${cls}">([\\s\\S]*?)</g>`)) || ['', ''])[1].match(/<(?:path|circle)/g) || []).length;
    const nRings = nOf('mf-rings'), nEnds = nOf('mf-ends'), nHeads = nOf('mf-heads');
    ok(`${tag} cols ${cols}: the paths are drawn`, /class="mf-paths"/.test(fig.svg), null);
    ok(`${tag} cols ${cols}: a ring and an end dot per path, at most one arrowhead per path`, nRings > 0 && nEnds === nRings && nHeads <= nRings, [nRings, nEnds, nHeads]);
    ok(`${tag} cols ${cols}: the caption names the paths`, /Curves are the paths/.test(fig.cap) && /\(circle\)/.test(fig.cap) && /\(dot\)/.test(fig.cap), String(fig.cap).slice(-300));
    ok(`${tag} cols ${cols}: no inline \\frac in the caption`, !/\\frac/.test(String(fig.cap).replace(/\\\[[\s\S]*?\\\]/g, '')), fig.cap);
    R[tag][cols] = { n: nRings, caption: fig.cap };
    if (cols === 1) {
      const again = await ev(`await (async () => { const f = await Figure.build({ svPic: 'paths', for: 'article', cols: 1, capInImage: false }); return f ? f.svg : null; })()`, 120000);
      ok(`${tag}: the same figure twice has the same vectors`, strip(again) === strip(fig.svg), (() => { const a = strip(again), b = strip(fig.svg); let i = 0; while (i < a.length && a[i] === b[i]) i++; return { at: i, a: a.slice(Math.max(0, i - 80), i + 80), b: b.slice(Math.max(0, i - 80), i + 80) }; })());
    }
  }
  // a dark-theme export has no dark-theme ink
  await view(1440, 900, true);
  const darkInks = await ev(`(() => { const cs = getComputedStyle(document.documentElement); return ['--ink', '--ink-2', '--faint', '--muted'].map((n) => cs.getPropertyValue(n).trim().slice(0, 7).toUpperCase()).filter((x) => /^#[0-9A-F]{6}$/.test(x)); })()`);
  const dsvg = await ev(`await (async () => { const f = await Figure.build({ svPic: 'paths', for: 'article', cols: 2, capInImage: false }); return f ? f.svg.replace(/href="data:[^"]+"/g, '') : null; })()`, 120000);
  const hits = darkInks.filter((x) => typeof dsvg === 'string' && dsvg.toUpperCase().includes(x));
  ok(`${tag}: a dark-theme export has no dark-theme ink`, typeof dsvg === 'string' && hits.length === 0, { darkInks, hits });
  await view(1440, 900, false);
}
// plane 0: no step before it
await open(1, 0);
const p0 = await ev(`await (async () => { Figure.open(); for (let i = 0; i < 600 && !document.querySelector('#xfSvPic [data-v="paths"]'); i++) await new Promise((r) => requestAnimationFrame(r)); const b = document.querySelector('#xfSvPic [data-v="paths"]'); return b ? { off: b.getAttribute('aria-disabled') === 'true', tip: b.dataset.tip, desc: b.getAttribute('aria-description'), clicked: (b.click(), document.querySelector('#xfSvPic [aria-checked="true"]').dataset.v) } : null; })()`, 60000);
ok('plane 0: the Paths picture is off, with its reason as its tip and description', p0 && p0.off && /^No step leads to z, so there are no paths/.test(p0.tip) && p0.desc === p0.tip && p0.clicked !== 'paths', p0);
return { pass: fails.length === 0, fails, results: R };
