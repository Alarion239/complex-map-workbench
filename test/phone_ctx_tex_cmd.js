// The phone's context bar names the selected shape by its definition in words, never as raw TeX (issue #321: the
// Mountain King's curve read "\text{кривая, 1443 то…" at 390 x 844 in Russian). At 390 x 844 with touch, in English and
// Russian, with MathJax held back (a phone before it has loaded: the rows show TeX.set's fallback, the raw TeX) and then,
// where it loads, with MathJax: for a freehand curve of 1443 points, a disc, a disc's complement and an arc, the bar's
// second line has no backslash or brace and is the row's tooltip (Tour's reading of the TeX), the curve's in the
// language's words.
// A command file for a CDP daemon (test/cdp_kit README): python3 build.py && test/<you>_cdp/q.sh test/phone_ctx_tex_cmd.js
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 400) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const errs = [];
const grab = async () => { errs.push(...(await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource|ERR_BLOCKED/.test(x.m || ''))); };
// (the Mountain King's curve: two laps of the unit circle, 1443 points)
const N = 1443;
const pts = Array.from({ length: N }, (_, i) => { const t = (4 * Math.PI * i) / (N - 1); return [+Math.cos(t).toFixed(5), +Math.sin(t).toFixed(5)]; });
const SHAPES = [
  { id: 'k1', kind: 'curve', pts, ci: 0, visible: true },
  { id: 'k2', kind: 'disc', c: [0.5, -0.25], r: 0.75, ci: 1, visible: true },
  { id: 'k3', kind: 'disc', c: [-1, 0], r: 0.5, ci: 2, visible: true, complement: true },
  { id: 'k4', kind: 'arc', a: [1, 0], m: [0, 1], b: [-1, 0], ci: 3, visible: true },
];
async function openApp(lang, block) {
  const ns = 'pctx' + lang + Date.now();
  await view(390, 844, false, true);
  await send('Network.enable', {});
  await send('Network.setBlockedURLs', { urls: block ? ['*mathjax*'] : [] });
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await sleep(350);
  const o = { v3: true, v4: true, v5: true, v6: true, shapes: SHAPES, steps: [{ type: 'affine', params: { a: '2', b: '0' }, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 80 } };
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); try { sessionStorage.clear(); } catch (e) {} 1`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}&lang=${lang}` }); await sleep(2300);
  // (with MathJax: until it has typeset the rows, at most 15 s; it starts after the first paint, 3 to 5 s on a software
  // renderer, #288)
  if (!block) for (let i = 0; i < 60 && !(await ev(`!!(window.MathJax && MathJax.tex2svg) && !!document.querySelector('#shapeList .shape .d svg')`)); i++) await sleep(250);
  await settle(800);
}
// the bar for shape id selected: its two lines, and the row's definition cell (its tooltip, whether MathJax typeset it)
const barOf = async (id) => {
  await ev(`__cmwSelect(${JSON.stringify(id)}); 1`);
  await settle(400);
  return ev(`(() => { const b = document.querySelector('.ph-ctx'); const d = document.querySelector('#shapeList .shape[data-id="${id}"] .d');
    return { on: !!b && !b.hidden, k: b && b.dataset.k, name: b && (b.querySelector('.ph-ctn') || {}).textContent, def: b && (b.querySelector('.ph-cts') || {}).textContent,
      title: d && d.title, raw: !!(d && d.querySelector('.tex-fallback')), typeset: !!(d && d.querySelector('svg')) }; })()`);
};
for (const lang of ['en', 'ru']) {
  for (const block of [true, false]) {
    await openApp(lang, block);
    const tag = `${lang}${block ? ' (MathJax not loaded)' : ''}`;
    // (whether MathJax loaded: it typeset the rows)
    const mj = await ev(`!!(window.MathJax && MathJax.tex2svg) && !!document.querySelector('#shapeList .shape .d svg')`);
    if (!block && !mj) { info[lang + 'NoMathJax'] = 'MathJax did not load here: the typeset case is not checked'; continue; }
    ok(`${tag}: the phone layout`, await ev('!!Phone._state().on'), null);
    const got = {};
    for (const s of SHAPES) {
      const g = got[s.id] = await barOf(s.id);
      ok(`${tag}: ${s.kind}${s.complement ? ' (complement)' : ''}: the bar shows the selected shape`, g.on && g.k === 'shape', g);
      ok(`${tag}: ${s.kind}${s.complement ? ' (complement)' : ''}: its definition has no raw TeX`, !!g.def && !/[\\{}]/.test(g.def), g.def);
      ok(`${tag}: ${s.kind}${s.complement ? ' (complement)' : ''}: its definition is the row's tooltip`, g.def === g.title, [g.def, g.title]);
    }
    // (the case of the issue: the row itself still shows the fallback until MathJax loads)
    if (block) ok(`${tag}: the rows show the raw TeX until MathJax loads (the case of #321)`, got.k1.raw, got.k1);
    else ok(`${tag}: the rows are typeset`, got.k1.typeset, got.k1);
    ok(`${tag}: the curve's definition in the language's words`, new RegExp(lang === 'ru' ? '^кривая, 1\\D?443 точ' : '^curve, 1\\D?443 points$').test(got.k1.def || ''), got.k1.def);
    info[tag] = Object.fromEntries(Object.entries(got).map(([k, g]) => [k, g.def]));
    await grab();
  }
}
await send('Network.setBlockedURLs', { urls: [] });
ok('no page errors', errs.length === 0, errs.slice(0, 5));
return { pass: fails.length === 0, fails, info };
