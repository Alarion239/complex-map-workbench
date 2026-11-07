// One colour panel on every plane of the steps view (#1160): the head holds the same controls, in the same order, on the
// colour plane (a pullback) and on a plane past it (a pushforward); a control with no meaning on the shown plane stays in
// place, disabled, its reason the tip; a style picked on either plane is the one colouring's, shown on both.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const ns = 'svpar' + Date.now();
const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 's2', kind: 'circle', c: [0.3, 0.2], r: 0.8, ci: 0, visible: true }],
  steps: [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 80 } };
const S = () => ev('__cmwSteps()');
const openAt = async (w, lang = 'en', touch = false) => {
  await view(w, 900, false, touch);
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await settled({ panes: false });
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}&lang=${lang}&view=steps` });
  await settled({ max: 30000, until: `typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip .sv-wholemap')` });
  await ev(`document.querySelector('.sv-cp').click(); 1`);
  await settled({});
};
const goto = async (i, paint) => {
  await ev(`document.querySelector('#svStrip .sv-plane[data-i="${i}"]').click(); 1`);
  await settled({ max: 15000, until: `__cmwSteps().stage === ${i} && !__cmwSteps().moving` });
  const s = await S();
  ok(`plane ${i} is a ${paint}`, s.paint === paint, s.paint);
};
// the head's controls: the ones inline and the ones its ⋯ holds, by id or name, each with whether it is disabled
const read = (e) => `({ id: ${e}.id || (${e}.querySelector('input, select') || {}).id || ${e}.getAttribute('aria-label') || ${e}.dataset.tip || ${e}.className, dis: ${e}.getAttribute('aria-disabled') === 'true', tip: ${e}.dataset.tip || '', name: ${e}.getAttribute('aria-label') || ((${e}.querySelector('input') || {}).getAttribute && ${e}.querySelector('input').getAttribute('aria-label')) || '', why: ((${e}.querySelector('input') || {}).getAttribute && ${e}.querySelector('input').getAttribute('aria-description')) || '' })`;
const head = async () => {
  const hs = await ev(`[...document.querySelectorAll('.pane-head')].filter((h) => h.getClientRects().length).length`);
  const inline = await ev(`[...document.querySelectorAll('.pane-head .options > *:not(.opts-btn):not(.opts-slot), .pane-head #unitBox')].filter((e) => e.getClientRects().length).map((e) => ${read('e')})`);
  const more = await ev(`(() => { const b = document.querySelector('.pane-head .opts-btn[aria-label="Display options"]'); if (b) b.click(); return !!b; })()`);
  await settled({ floor: 300 });
  const folded = more ? await ev(`[...document.querySelectorAll('#popHost .opts-pop > *')].filter((e) => e.matches('label.check, .seg, .scrub, #unitBox')).map((e) => ${read('e')})`) : [];
  if (more) { await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); 1`); await settled({ floor: 200 }); }
  return { heads: hs, inline, kids: [...inline, ...folded] };
};
const ids = (a) => JSON.stringify(a.map((k) => k.id).sort());
for (const w of [1440, 1280, 1024]) {
  await openAt(w);
  await ev(`document.querySelector('#svStrip .sv-plane[data-i="1"]') && 0; 1`);
  await goto(0, 'pull');
  const pull = await head();
  await goto(2, 'push');
  const push = await head();
  info[w] = { pull, push };
  ok(`${w}: one head on each side of the colour plane`, pull.heads === 1 && push.heads === 1, { pull: pull.heads, push: push.heads });
  ok(`${w}: the same controls before and after the colour plane`, ids(pull.kids) === ids(push.kids), { pull: pull.kids.map((k) => k.id), push: push.kids.map((k) => k.id) });
  ok(`${w}: the same controls are inline on both`, ids(pull.inline) === ids(push.inline), { pull: pull.inline.map((k) => k.id), push: push.inline.map((k) => k.id) });
  ok(`${w}: no colour button in place of the panel past the colour plane`, !push.kids.some((k) => k.id === 'Colouring'), push.kids.map((k) => k.id));
  ok(`${w}: the style row is inline on both`, pull.inline.some((k) => k.id === 'dcSeg') && push.inline.some((k) => k.id === 'dcSeg'), { pull: pull.inline.map((k) => k.id), push: push.inline.map((k) => k.id) });
  ok(`${w}: the unit circle is in the panel on both`, pull.kids.some((k) => k.id === 'unitBox') && push.kids.some((k) => k.id === 'unitBox'), { pull: pull.kids.map((k) => k.id), push: push.kids.map((k) => k.id) });
  const ol = (h) => h.kids.find((k) => k.id === 'outlineChk');
  ok(`${w}: Outlines applies on the colour plane`, !!ol(pull) && !ol(pull).dis && ol(pull).name === 'Outlines', ol(pull));
  ok(`${w}: Outlines is disabled past it, with its reason as the tip and the description`, !!ol(push) && ol(push).dis && /colour plane/.test(ol(push).tip) && /colour plane/.test(ol(push).why) && ol(push).name === 'Outlines', ol(push));
  const un = (h) => h.kids.find((k) => k.id === 'unitBox');
  ok(`${w}: the unit circle has its name`, !!un(push) && un(push).name === 'Unit circle', un(push));
}
await openAt(1440);
// a style picked on the later plane is the colour plane's too, and the other way round
await ev(`document.querySelector('#dcSeg button[data-v="modulus"]').click(); 1`);
await settled({ floor: 500 });
await goto(0, 'pull');
const a = await ev(`(document.querySelector('#dcSeg .on') || {}).dataset.v`);
ok('a style picked past the colour plane shows on the colour plane', a === 'modulus', a);
await ev(`document.querySelector('#dcSeg button[data-v="phase"]').click(); 1`);
await settled({ floor: 500 });
await goto(2, 'push');
const b = await ev(`(document.querySelector('#dcSeg .on') || {}).dataset.v`);
ok('a style picked on the colour plane shows past it', b === 'phase', b);
// a phone's Display sheet is the same panel: it names the shown plane, opens on the style row, and Outlines past the colour plane is disabled in it
await openAt(360, 'en', true);
await goto(2, 'push');
await ev(`document.querySelector('.ph-dsp').click(); 1`); await settled({ floor: 600 });
const sh = await ev(`(() => { const o = document.querySelector('.ph-vopts #outlineChk'), k = [...document.querySelectorAll('.ph-vopts > *')]; return { title: (document.querySelector('.ph-sh .ph-t, .ph-sh .ttl') || {}).textContent || document.querySelector('.ph-sheet').getAttribute('aria-label'), first: k[0] && k[0].id, outDis: !!o && o.disabled && o.getAttribute('aria-description') || '' }; })()`);
ok('the sheet names the colour panel and the shown plane', /Colour · w/.test(sh.title || ''), sh);
ok('the sheet opens on the style row', sh.first === 'dcSeg', sh);
ok('Outlines in the sheet is disabled with its reason past the colour plane', /colour plane/.test(sh.outDis), sh);
return { pass: fails.length === 0, fails, info };
