// The Split offer in the classic views (X → Y, Phase, Landscape): fix152_cmd.js runs the same offer in the steps view.
// classic-1  after the formula is added as one step and Split, the keyboard focus is on a card, not the page;
// classic-2  with other steps, f₂ shown alone stays f₂ after Split and the toast says so (S.focus 2).
// It stays on the classic view (ci/suite_views.js: classic) as long as the classic views exist.
// A command file for the CDP daemon (test/cdp_kit README): python3 build.py && test/<you>_cdp/q.sh test/fix152_classic_cmd.js
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = (ns) => `http://localhost:${PORT}/test.html?ns=${ns}`;
const fails = [];
let pass = 0;
const ok = (name, cond, got) => { if (cond) pass++; else fails.push({ name, got }); };
const DESKUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const SHAPES = [{ id: 's1', kind: 'rect', a: [-1.2, -1.2], b: [1.2, 1.2] }];
const F1 = (expr, cut = 180) => ({ type: 'custom', params: { expr, cut }, on: true });
async function open(ns, st) {
  await go(`http://localhost:${PORT}/blank-${ns}.html`);
  const o = Object.assign({ v3: true, v4: true, shapes: SHAPES, steps: [], nextId: 50, focus: 0, rightMode: 'image' }, st || {});
  await ev(`localStorage.clear(); localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
  await go(U(ns)); await settled({ until: `typeof __cmwSteps === 'function'` });
}
const focus = () => ev('__cmwCards().focus');
await send('Emulation.setUserAgentOverride', { userAgent: DESKUA, acceptLanguage: 'en-US,en' });
await view(1440, 900, false, false);

await open('fcA', { steps: [{ type: 'pown', params: { n: 2 }, on: true }, F1('\\sin(z^2+1)')], focus: 2 });
{
  await clickSel('#pipeline .card[data-k="2"]'); await settled();
  await clickSel('#propsPanel .split-offer .so-btn'); await settled();
  const active = await ev('document.activeElement && (document.activeElement.closest(".card") ? "card" : document.activeElement.tagName)');
  ok('classic-1: after Split the keyboard focus is on a card, not the page', active === 'card', active);
  ok('classic-2: with other steps, f₂ shown alone stays f₂ and the toast says so', (await focus()) === 2 && (await ev('__qa.toasts()')).some((x) => /Showing f₂ alone; › shows the next step\./.test(x)), { focus: await focus() });
}
return { pass, nfail: fails.length, fails };
