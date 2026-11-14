// The top bar's keyboard order and the small controls' target size, in the steps view. Tab from the top
// of the page goes Examples (leftmost on screen), then the menu's buttons (search … Help), in the order of the screen; and
// every segment of a segmented control in the bar and the plane head is at least 24 x 24 px (WCAG 2.5.8; the segments
// touch, so the spacing exception does not apply) without the control overflowing. 1440 px in English, 1024 px in Russian
// and Italian.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
const { open, tabs, scan } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'top_bar_kit.js'), 'utf8'))({ ev, send, view, key, sleep, DIR });
for (const [w, h, lang] of [[1440, 900, 'en'], [1024, 768, 'ru'], [1024, 768, 'it']]) {
  const at = `${w} ${lang}`;
  await open(w, h, lang);
  const seq = await tabs();
  info[at + ' tab'] = seq.join(' ');
  const at_ = (id) => seq.indexOf(id);
  ok(`${at}: Examples is the first Tab stop`, seq[0] === 'examplesBtn', seq);
  ok(`${at}: then the menu's buttons in their order, search … Help`, ['cmdBtn', 'exportBtn', 'settingsBtn', 'helpBtn'].every((id, i, a) => at_(id) >= 1 && (i === 0 || at_(a[i - 1]) < at_(id))), seq);
  ok(`${at}: no Examples stop after Help`, !seq.slice(at_('helpBtn') + 1).some((s) => s === 'examplesBtn'), seq);
  for (const s of await scan()) {
    ok(`${at}: ${s.id}: every segment is at least 24 px tall and wide`, s.minH >= 23.5 && s.minW >= 23.5, s);
    ok(`${at}: ${s.id} does not overflow`, !s.over, s);
  }
  ok(`${at}: the bar does not overflow`, await ev(`(() => { const t = document.querySelector('.top'); return t.scrollWidth <= t.clientWidth + 1; })()`), null);
}
return { pass: fails.length === 0, fails, info };
