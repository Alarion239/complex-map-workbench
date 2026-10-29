// Complex shared numbers and the interface's other two paths (issue #10): the language switch and the figure export.
// (a) a = 0.5 + 0.3i read by a Möbius step: switching en → ru → it → en keeps the picture and the errors, the step's
//     numbers line shows the value with the language's decimal comma (0,5 + 0,3i), the Numbers row keeps the value as text
//     the parser reads in every language;
// (b) the export dialog builds the figure (the SVG and PDF paths) with the complex number in a step, and the figure's
//     formula shows the number or its value. MathJax: where the page has none (a container without the CDN) the second
//     half cannot run, as in figure_wait_cmd.
// A command file for a CDP daemon (test/cdp_kit README).
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const P = () => ev('__cmwP()');
const NS = 'cxlg' + (Date.now() % 1000000);
const STATE = {
  shapes: [{ id: 's1', kind: 'rect', a: [-1, -1], b: [1, 1], ci: 0, visible: true }],
  steps: [{ type: 'mobius', params: { a: '1', b: 'a', c: '0', d: '1' }, on: true }, { type: 'custom', params: { expr: 'conj(a) z', cut: 180 }, on: true }],
  params: [{ name: 'a', value: 0.5, im: 0.3, min: -2, max: 2, step: 0.01 }],
  srcView: { cx: 0, cy: 0, s: 110 }, pattern: 'checker', v5: true, v6: true,
};
const numbersLine = () => ev(`[...document.querySelectorAll('#propsPanel .inums')].map((e) => e.textContent).filter(Boolean).join(' | ')`);
const rowValue = () => ev(`(document.querySelector('.prm-row[data-name="a"] .prm-val') || {}).value || ''`);
const pics = async () => [await ev(`__cmwRenderOff('L', 240, 180, 1)`), await ev(`__cmwRenderOff('R', 240, 180, 1)`)];
const lang = async (l) => { await ev(`I18N.setPref('${l}'), 1`); await settle(1500); };

await view(1440, 900, false, false);
await load(NS, STATE);
await settle(1200);
// open step 1 in the Inspector so its numbers line is built
await clickSel('#pipeline .card[data-k="1"]');
await settle(500);
const en0 = await pics();
let s = await P();
ok('en: no step error', s.errors.every((e) => !e), s.errors);
ok('en: the numbers line shows the complex value', /a = 0\.5 \+ 0\.3i/.test(await numbersLine()), await numbersLine());
ok('en: the row holds the value as text', (await rowValue()).replace('−', '-') === '0.5+0.3i', await rowValue());
for (const l of ['ru', 'it']) {
  await lang(l);
  await clickSel('#pipeline .card[data-k="1"]');
  await settle(500);
  s = await P();
  ok(`${l}: no step error`, s.errors.every((e) => !e), s.errors);
  ok(`${l}: the number is unchanged`, s.params[0].value === 0.5 && s.params[0].im === 0.3, s.params);
  ok(`${l}: the numbers line shows the value with a decimal comma`, /a = 0,5 \+ 0,3i/.test(await numbersLine()), await numbersLine());
  const rv = (await rowValue()).replace('−', '-');
  info[l] = { row: rv, line: await numbersLine() };
  ok(`${l}: the row's value reads back the same number`, await ev(`(() => { const v = Expr.constValue(${JSON.stringify(rv)}.replace(/(\\d),(\\d)/g, '$1.$2')); return v.re === 0.5 && v.im === 0.3; })()`), rv);
  const pl = await pics();
  ok(`${l}: the pictures are unchanged`, pl[0] === en0[0] && pl[1] === en0[1], [pl[0].length, en0[0].length]);
}
await lang('en');
const en1 = await pics();
ok('back in English the pictures are the same as at the start', en1[0] === en0[0] && en1[1] === en0[1], null);
ok('and the row is back to the English text', (await rowValue()).replace('−', '-') === '0.5+0.3i', await rowValue());
// typing in Russian, with a decimal comma, sets the complex number (a number typed as 0,25 + 0,5i)
await lang('ru');
await ev(`(() => { const el = document.querySelector('.prm-row[data-name="a"] .prm-val'); el.focus(); el.select(); return 1 })()`);
await ev(`(() => { const el = document.activeElement; el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); return 1 })()`);
await type('0,25 + 0,5i');
await key('Enter');
await ev(`(() => { const el = document.activeElement; if (el && el.blur) el.blur(); return 1 })()`);
await settle(500);
s = await P();
ok('ru: a value typed with a decimal comma sets the complex number', s.params[0].value === 0.25 && s.params[0].im === 0.5, s.params);
await lang('en');
await ev(`Params.set('a', '0.5 + 0.3i')`);
await settle(500);

// (b) the figure export
const had = await ev(`!!(window.MathJax && typeof window.MathJax.tex2svg === 'function')`);
info.mathjax = had;
if (had) {
  await key('e', 2);
  let done = false;
  for (let i = 0; i < 60 && !done; i++) { await sleep(500); done = await ev(`(() => { const e = document.querySelector('.xf-wait'); return !!document.querySelector('.xf-dlg, .xf-scroll') && (!e || e.hidden); })()`); }
  ok('the export dialog builds the figure with the complex number', done, await ev(`(document.querySelector('.xf-wait') || {}).textContent`));
  const fig = await ev(`(() => { const f = Figure.last(); return f ? { keys: Object.keys(f).slice(0, 20), svgLen: (typeof f.svg === 'string' ? f.svg.length : 0) } : null; })()`);
  info.fig = fig;
  ok('there is a figure', !!fig, fig);
  const fx = await ev(`(() => { const f = Figure.last(); return f ? { svgHead: String(f.svg).slice(0, 40), svgLen: String(f.svg).length, captionTex: String(f.captionTex), autoCaption: String(f.autoCaption), slideF: String(f.slideF), shortCap: String(f.shortCap) } : null; })()`);
  info.fx = { cap: fx && fx.captionTex.slice(fx.captionTex.indexOf('F(z)'), fx.captionTex.indexOf('F(z)') + 60) };
  ok('the SVG path writes the figure', !!fx && /^<svg/.test(fx.svgHead) && fx.svgLen > 1000, fx);
  ok('the figure caption writes the map with the number: F(z) = conj(a) (z + a)', !!fx && /F\(z\)=\\overline\{a\}\\,\\left\(z\+a\\right\)/.test(fx.captionTex), fx && fx.captionTex.slice(fx.captionTex.indexOf('F(z)'), fx.captionTex.indexOf('F(z)') + 80));
  await key('Escape');
  await sleep(500);
}
ok('no exceptions', (await ev(`window.__qa && window.__qa.errors ? window.__qa.errors().length : 0`)) === 0, null);
return { pass: fails.length === 0, fails, info };
