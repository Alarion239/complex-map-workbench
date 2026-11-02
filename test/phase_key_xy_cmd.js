// X → Y keeps X's colour key hidden (#365; the classic view's two panes: Y shows the key). The case phase_key_cmd.js ran in its
// last step, now a suite of its own because phase_key_cmd.js runs in the steps view, which has the one plane and no X → Y view.
// On a laptop (en, ru and it at 1440 px, ru at 1100 px). A command file for a CDP daemon (test/cdp_kit README).
const fails = [];
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 400) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
async function openApp(lang, w) {
  const ns = 'pk' + Date.now();
  await view(w, 800, false, false);
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await sleep(350);
  const o = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 's1', kind: 'rect', a: [-2, -2], b: [2, 2] }], steps: [{ type: 'recurrence', params: { u0: '0', g: 'u^2+z', N: 12, cut: 180 }, on: true }], nextId: 50, focus: 0, rightMode: 'color' };
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}${lang ? '&lang=' + lang : ''}` }); await sleep(2300);
  await settle(800);
}
for (const [lang, w] of [['', 1440], ['ru', 1440], ['it', 1440], ['ru', 1100]]) {
  await openApp(lang, w);
  await ev(`__cmwSetMain('xy')`); await settle(1500);
  const x = await ev(`(() => { const leg = document.getElementById('leftLegend'); return { hidden: leg.hidden, onPlot: leg.parentNode === document.getElementById('plotL') }; })()`);
  ok(`${lang || 'en'} ${w}: X → Y: X's key is hidden, as before`, x.hidden, x);
}
return { pass: fails.length === 0, fails };
