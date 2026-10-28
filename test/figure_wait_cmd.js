// The export dialog opened before MathJax is ready waits for it: it keeps its "Preparing formulas…" state, and builds
// the figure once MathJax is there, rather than failing with "MathJax is still loading". MathJax is set aside while the
// dialog opens and put back; where the page has none (a container without the CDN) the second half cannot run.
// A command file for a CDP daemon.
const fails = [];
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
await view(1440, 900, false, false);
await load('xwait' + Date.now(), { shapes: [], steps: [{ type: 'sin', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' } });
await sleep(1500);
await ev('__cmwExample(1); 1'); await sleep(1800);
const had = await ev(`(() => { window.__mj = window.MathJax; window.MathJax = undefined; return !!(window.__mj && typeof window.__mj.tex2svg === 'function'); })()`);
await key('e', 2); await sleep(1500);
const w = await ev(`(() => { const e = document.querySelector('.xf-wait'); return e ? { vis: !!e.getClientRects().length, txt: e.textContent } : null; })()`);
ok('the dialog is open and says it is preparing the formulas', w && w.vis && /Preparing formulas/.test(w.txt), w);
const gone = await ev(`!!document.querySelector('.xf-wait') && !document.querySelector('.xf-wait').hidden && !/did not load|could not/.test(document.querySelector('.xf-wait').textContent)`);
ok('no failure is shown while it waits', gone, w);
if (had) {
  await ev(`window.MathJax = window.__mj; 1`);
  let done = false;
  for (let i = 0; i < 40 && !done; i++) { await sleep(500); done = await ev(`(() => { const e = document.querySelector('.xf-wait'); return !!e && e.hidden; })()`); }
  ok('once MathJax is back the figure is built and the wait goes', done, await ev(`(document.querySelector('.xf-wait') || {}).textContent`));
}
await key('Escape'); await sleep(400);
await ev(`if (!window.MathJax && window.__mj) window.MathJax = window.__mj; 1`);
return { pass: fails.length === 0, fails };
