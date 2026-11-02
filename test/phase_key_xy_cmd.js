// X → Y keeps X's colour key hidden (#365; the classic view's two panes: Y shows the key). The case phase_key_cmd.js ran in its
// last step, now a suite of its own because phase_key_cmd.js runs in the steps view, which has the one plane and no X → Y view.
// On a laptop (en, ru and it at 1440 px, ru at 1100 px). A command file for a CDP daemon (test/cdp_kit README).
const fails = [];
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const openApp = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'phase_key_open.js'), 'utf8'));
for (const [lang, w] of [['', 1440], ['ru', 1440], ['it', 1440], ['ru', 1100]]) {
  await openApp(lang, w);
  await ev(`__cmwSetMain('xy')`); await settled({ until: "document.getElementById('leftLegend').hidden", max: 10000 });
  const x = await ev(`(() => { const leg = document.getElementById('leftLegend'); return { hidden: leg.hidden, onPlot: leg.parentNode === document.getElementById('plotL') }; })()`);
  ok(`${lang || 'en'} ${w}: X → Y: X's key is hidden, as before`, x.hidden, x);
}
return { pass: fails.length === 0, fails };
