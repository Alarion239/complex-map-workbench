// On a phone, a plane's colour key says in words what its canvas draws: the key box's accessible description (aria-describedby,
// read from the accessibility tree) names the key's caption and its rows, for each kind of key. In the steps view: the Colour key
// on the Plane (the caption, then the hue wheel's reading), on the Sphere, and the Height key on the Landscape (its caption, then
// its contours); in the classic view, Y's Regions key (its fill). Each read with the key unfolded, at 360 × 640 (Y's at 568 × 320:
// the classic view's portrait phone does not draw Y's key), in en, ru and it.
// The words are compared with the page's own: __cmwLegend()'s caption and the strings the key draws ($t). The box is a button
// (the phone's key, legendKeyButton) named for its kind: the Height key on the Landscape, else the Colour key, whatever
// surface the view came from; Y's, the Regions key. Each key's fill is said once: its description says it, its name
// does not.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
// the key box's accessible name and description, as a screen reader gets them
const axOf = async (id) => {
  const { root } = await send('DOM.getDocument', { depth: 0 });
  const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: '#' + id });
  if (!nodeId) return null;
  const { nodes } = await send('Accessibility.getPartialAXTree', { nodeId, fetchRelatives: false });
  const n = nodes && nodes[0];
  if (!n || n.ignored) return { ignored: true };
  return { role: n.role && n.role.value, name: n.name && n.name.value, description: (n.description && n.description.value) || '' };
};
// unfold a key (a tap on a phone) and wait for it
const unfold = async (id) => {
  await ev(`(() => { const k = document.getElementById(${JSON.stringify(id)}); if (k.classList.contains('collapsed')) k.click(); return 1; })()`);
  await settled({ max: 5000, panes: false, until: `!document.getElementById(${JSON.stringify(id)}).classList.contains('collapsed')` });
};
const ST = { shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 1 }], steps: [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 } };
for (const lang of ['en', 'ru', 'it']) {
  await view(360, 640, false, true);
  const ns = 'pls' + lang + (Date.now() % 1000000);
  await load(ns, ST);
  await go(`${U}?ns=${ns}&lang=${lang}&view=steps`);
  await settled({ max: 30000, until: `!!window.Phone && Phone.isOn() && typeof __cmwSteps === 'function' && __cmwSteps().on && !!document.getElementById('leftLegend') && !document.getElementById('leftLegend').hidden` });
  // the steps view's left key on each surface, with the thread at T's plane (the style's own key) and on a plane before it (the hue ring with
  // the plane its colour is carried from; on the Landscape the height key either way): [surface, the key's kind, the words of its rows after the
  // caption, the thread's place]
  const HUE = [`$t('hue: the argument, red at 1, counterclockwise')`];
  for (const [surf, kind, rows, at] of [['plane', 'color', HUE, 'T'], ['plane', 'color', HUE, 'carried'], ['sphere', 'sphere', HUE, 'T'], ['sphere', 'color', HUE, 'carried'], ['land', '3d', [`$t('contours')`], 'T'], ['land', '3d', [`$t('contours')`], 'carried']]) {
    const tag = `${lang} steps ${surf}${at === 'carried' ? ', a plane before T' : ''}`;
    await ev(`__cmwSteps({ surf: ${JSON.stringify(surf)} }), 1`);
    await settled({ max: 20000, until: `__cmwSteps().surf === ${JSON.stringify(surf)} && !document.getElementById('leftLegend').hidden` });
    const nPl = await ev('__cmwSteps().planes.length'), place = at === 'T' ? nPl - 1 : 0;
    // (T's name, as the page names the colour plane: read with the thread at T)
    const park = async (i) => { await ev(`(__cmwSteps({ T: ${nPl - 1} }), __cmwSteps({ go: ${i}, now: true }), 1)`); await settled({ max: 20000, until: `!__cmwSteps().moving && __cmwSteps().i === ${i} && !document.getElementById('leftLegend').hidden` }); };
    await park(nPl - 1);
    const tName = await ev('__cmwSteps().names.key');
    if (place !== nPl - 1) await park(place);
    await unfold('leftLegend');
    const lg = await ev('__cmwLegend()');
    const want = await ev(`[${rows.join(', ')}]`);
    const ax = await axOf('leftLegend');
    info[tag] = { lg, ax };
    ok(`${tag}: the key is the ${kind} key`, lg && lg.kind === kind, lg);
    if (at === 'carried' && surf !== 'land') ok(`${tag}: the caption names the plane its colour is carried from`, !!lg && lg.caption === await ev(`$tx('key line', 'colour carried from {p}', { p: ${JSON.stringify(tName)} })`), lg);
    ok(`${tag}: the key box is a button`, !!ax && ax.role === 'button', ax);
    ok(`${tag}: the key box is named for its kind (${kind === '3d' ? 'Height key' : 'Colour key'})`, !!ax && ax.name === (await ev(`$t(${JSON.stringify(kind === '3d' ? 'Height key' : 'Colour key')})`)), ax);
    ok(`${tag}: the key box has a description`, !!ax && !ax.ignored && ax.description.length > 0, ax);
    if (!ax || !ax.description) continue;
    ok(`${tag}: the description starts with the caption the key draws`, !!lg.caption && ax.description.startsWith(lg.caption), [ax.description, lg.caption]);
    for (const w of want) ok(`${tag}: the description names the row "${w}"`, ax.description.includes(w), ax.description);
  }
  // the classic view's Y: the Regions key, with the regions' fill in its words
  {
    const tag = `${lang} classic Y`;
    await view(568, 320, false, true);
    await go(`${U}?ns=${ns}c&lang=${lang}&view=classic`);
    await settled({ max: 30000, until: `!!window.Phone && Phone.isOn() && !!document.getElementById('rightLegend') && !document.getElementById('rightLegend').hidden` });
    await unfold('rightLegend');
    // (the regions' fill: the phase of z, or the grid's cell while its lines are drawn, as the key's first row draws it)
    const want = await ev(`({ head: $t('Regions') + ': ', fill: [$t('phase of ') + 'z', $t('cell ')], name: $t('Regions key') })`);
    const ax = await axOf('rightLegend'), text = (ax && ax.description) || '';
    info[tag] = { ax, want };
    ok(`${tag}: the Regions key box is a button named "${want.name}"`, !!ax && ax.role === 'button' && ax.name === want.name, ax);
    // (the fill is said once: the name holds none of the fill's words, "phase of" or "cell", which the description
    // leads with)
    const said = want.fill.map((f) => f.trim().toLowerCase()), name = ((ax && ax.name) || '').toLowerCase();
    ok(`${tag}: the regions' fill is said once, in the description and not in the name`, !!ax && said.some((f) => text.toLowerCase().includes(f)) && !said.some((f) => name.includes(f)), { name: ax && ax.name, text, said });
    ok(`${tag}: the Regions key box has a description`, !!ax && !ax.ignored && text.length > 0, ax);
    ok(`${tag}: the description starts with the regions' fill`, text.startsWith(want.head) && want.fill.some((f) => text.startsWith(want.head + f)), [text, want]);
  }
}
return { pass: fails.length === 0, fails, info };
