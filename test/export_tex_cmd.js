// [#529] No raw TeX in an exported figure: what #476's raw_tex_cmd is for the page, for the figure's own text. A figure
// (PDF, PNG and SVG are the one SVG Figure.build composes; the LaTeX snippet is TeX on purpose and is not read) sets
// every label, tick, key and caption with MathJax, as glyphs: TeX left raw there is not a string on the page but an
// error MathJax drew (merror), a command it does not know (drawn in red), or a command, a script or a $ inside text
// (\text{\frac{1}{2}}, \text{u_k}). Each text the figure placed (its boxes, the caption set in the image) is typeset
// again as MathML and read for those. Where: shapes (a curve, a polygon, a disc, a point) and gallery examples with
// formulas, keys, sheets and long captions, in en, ru and it (Russian is set from the CMU outlines, with its own
// notation). The video draws no TeX: its text is numbers, t and the globe's labels, written by the code (06-video.js).
// Needs MathJax: test-mj.html (vendor/js/tex-svg.js, ci/browser_suites.js PAGES). A command file for a CDP daemon.
const fails = [], info = { figures: 0, texts: 0 };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const BASE = `http://localhost:${PORT}`;
// (a figure that set fewer texts than this, or no caption, would pass whatever it holds)
const MIN_TEXTS = 20;
// TeX the figure shows raw, read from MathJax's MathML (its SVG has glyphs, not text)
function rawTex(texs) {
  const out = [];
  for (const t of texs) {
    let m;
    try { m = MathJax.tex2mml(t, { display: false }); } catch (e) { out.push({ t, why: 'throws ' + e.message }); continue; }
    const d = new DOMParser().parseFromString(m, 'application/xml');
    const err = d.querySelector('merror');
    if (err) { out.push({ t, why: 'an error: ' + err.textContent.trim().slice(0, 80) }); continue; }
    const red = [...d.querySelectorAll('[mathcolor="red"]')].map((x) => x.textContent);
    if (red.length) { out.push({ t, why: 'an unknown command: ' + red.join(' ').slice(0, 80) }); continue; }
    const raw = [...d.querySelectorAll('mtext, mi, mo')].map((x) => x.textContent).filter((s) => /\\[a-zA-Z]|\$|[\^_]/.test(s));
    if (raw.length) out.push({ t, why: 'TeX in text: ' + raw.join(' | ').slice(0, 80) });
  }
  return out;
}
const SHAPES = [
  { id: 's1', kind: 'curve', pts: [[-1, 0], [-0.5, 0.6], [0, 0.2], [0.5, 0.8], [1, 0.1]], ci: 0, visible: true },
  { id: 's2', kind: 'polygon', pts: [[-1.5, -1], [-0.5, -1.2], [-0.8, -0.3]], ci: 1, visible: true },
  { id: 's3', kind: 'disc', c: [0.8, -0.8], r: 0.4, ci: 2, visible: true },
  { id: 's4', kind: 'point', p: [0.3, 0.4], ci: 3, visible: true },
];
// Strip to disk (point labels), A formula in LaTeX, the Mountain King, the Gamma function's poles, the dilogarithm from
// its series, the Douady-Hubbard map (gallery indices, as raw_tex_cmd's)
const EXAMPLES = [1, 9, 17, 19, 22, 30];
// (the checker itself, on every MathJax it runs on: what it must flag, and a Cyrillic \text it must not)
const MIN_TOTAL = 600;
const CONTROL_BAD = ['\\foo{x}', '\\text{\\frac{1}{2}}', '\\text{u_k}', '\\frac{1}{z'];
const CONTROL_GOOD = ['\\text{кривая, 5 точек}', 'w_{1}=\\frac{z^{2}+1}{z}'];
const control = async (lang) => {
  const r = await ev(`(() => { const f = ${rawTex.toString()}; return { bad: f(${JSON.stringify(CONTROL_BAD)}).map((b) => b.t), good: f(${JSON.stringify(CONTROL_GOOD)}).map((b) => b.t) }; })()`);
  for (const t of CONTROL_BAD) if (!r.bad.includes(t)) fails.push(`${lang}: the checker does not flag "${t}": it would pass whatever the figures hold`);
  for (const t of r.good) fails.push(`${lang}: the checker flags good TeX "${t}"`);
};
const mjReady = async () => { for (let k = 0; k < 80 && !(await ev('!!(window.MathJax && MathJax.tex2mml) && typeof __cmwFig === "object"')); k++) await sleep(250); return ev('!!(window.MathJax && MathJax.tex2mml)'); };
const figure = async (lang, ctx) => {
  await sleep(1500);
  const r = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => {
    const f = await __cmwFig.build({ for: 'homework', capInImage: true, lang: '${lang}' }); if (!f) return null;
    const texs = [...new Set(f.boxes.map((b) => b.tex).filter(Boolean))];
    return { n: texs.length, caption: f.boxes.some((b) => b.kind === 'caption'), bad: (${rawTex.toString()})(texs) }; })()` });
  const v = r && r.result && r.result.value;
  info.figures++;
  if (!v) { fails.push(`${lang} ${ctx}: no figure`); return; }
  info.texts += v.n;
  if (v.n < MIN_TEXTS) fails.push(`${lang} ${ctx}: the figure set only ${v.n} texts (at least ${MIN_TEXTS} expected)`);
  if (!v.caption) fails.push(`${lang} ${ctx}: no caption in the image`);
  for (const b of v.bad) fails.push(`${lang} ${ctx}: raw TeX (${b.why}) in "${b.t.slice(0, 140)}"`);
};
await view(1440, 900, false, false);
for (const lang of ['en', 'ru', 'it']) {
  // the shapes
  const ns = 'xtex' + lang + Date.now();
  await send('Page.navigate', { url: `${BASE}/gl-helpers.html` }); await sleep(350);
  const o = { v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, rightMode: 'image', lang, shapes: SHAPES, steps: [{ type: 'pown', params: { n: 2 }, on: true }] };
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
  await send('Page.navigate', { url: `${BASE}/test-mj.html?ns=${ns}&lang=${lang}` }); await sleep(2500);
  if (!(await mjReady())) { fails.push(`${lang}: MathJax did not load: the figure cannot be read`); continue; }
  await control(lang);
  await figure(lang, 'shapes');
  // the gallery
  for (const i of EXAMPLES) {
    const ok = await ev(`(() => { try { return __cmwExample(${i}); } catch (e) { return false; } })()`);
    if (!ok) { fails.push(`${lang}: example ${i} did not load`); continue; }
    await figure(lang, `example ${i} (${await ev(`document.querySelector('#examplesBtn .exlabel')?.textContent || ''`)})`);
  }
}
if (info.texts < MIN_TOTAL) fails.push(`the run read only ${info.texts} texts (at least ${MIN_TOTAL} expected)`);
return { pass: fails.length === 0, fails: fails.slice(0, 60), info };
