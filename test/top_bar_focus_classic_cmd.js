// The classic view's top bar (issues #359, #360): Tab from the top of the page goes Examples, the view switch, Deformation,
// then the menu's buttons, and every segment of the view switch, the plane heads' style row, Landscape's height and paint
// rows and the chain's Pictures | Names is at least 24 x 24 px without overflowing. The steps view has no view switch,
// Deformation or those heads (top_bar_focus_cmd.js). 1440 px in English, 1024 px in Russian and Italian.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
const { open, tabs, scan, settle } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'top_bar_kit.js'), 'utf8'))({ ev, send, view, key, sleep, DIR });
for (const [w, h, lang] of [[1440, 900, 'en'], [1024, 768, 'ru'], [1024, 768, 'it']]) {
  const at = `${w} ${lang}`;
  await open(w, h, lang);
  const seq = await tabs();
  info[at + ' tab'] = seq.join(' ');
  const at_ = (id) => seq.indexOf(id);
  ok(`${at}: Examples is the first Tab stop`, seq[0] === 'examplesBtn', seq);
  ok(`${at}: the view switch follows it, and Deformation the view switch`, at_('viewSwitch') === 1 && at_('morphBtn') === 2, seq);
  ok(`${at}: then the menu's buttons in their order, search … Help`, ['cmdBtn', 'exportBtn', 'settingsBtn', 'helpBtn'].every((id, i, a) => at_(id) >= 3 && (i === 0 || at_(a[i - 1]) < at_(id))), seq);
  ok(`${at}: no view switch or Deformation stop after Help`, !seq.slice(at_('helpBtn') + 1).some((s) => s === 'viewSwitch' || s === 'morphBtn' || s === 'examplesBtn'), seq);
  const seen = new Set();
  for (const mode of ['xy', 'phase', 'land']) {
    await ev(`document.querySelector('#viewSwitch [data-mode="${mode}"]').click(); 1`); await settle(900);
    for (const s of await scan()) {
      seen.add(s.id);
      ok(`${at} ${mode}: ${s.id}: every segment is at least 24 px tall and wide`, s.minH >= 23.5 && s.minW >= 23.5, s);
      ok(`${at} ${mode}: ${s.id} does not overflow`, !s.over, s);
    }
    ok(`${at} ${mode}: the bar does not overflow`, await ev(`(() => { const t = document.querySelector('.top'); return t.scrollWidth <= t.clientWidth + 1; })()`), null);
  }
  for (const id of ['viewSwitch', 'dcSeg', 'heightSeg', 'landPaint', 'chainMode']) ok(`${at}: ${id} was measured`, seen.has(id), [...seen]);
}
return { pass: fails.length === 0, fails, info };
