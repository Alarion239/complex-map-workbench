// The colour key in the classic X → Y view, where X's key is hidden as before (#365). The steps view has one plane and
// shows its key, which phase_key_cmd.js covers. On a laptop: en, ru and it at 1440 px, ru at 1100 px.
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails}.
const fails = [];
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const { openApp, probe, settle } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'phase_key_kit.js'), 'utf8'))({ ev, send, view, sleep, DIR });
for (const [lang, w] of [['', 1440], ['ru', 1440], ['it', 1440], ['ru', 1100]]) {
  await openApp(lang, w);
  await ev(`__cmwSetMain('xy')`); await settle(1500);
  const x = await probe();
  ok(`${lang || 'en'} ${w}: X → Y: X's key is hidden, as before`, x.hidden, x);
}
return { pass: fails.length === 0, fails };
