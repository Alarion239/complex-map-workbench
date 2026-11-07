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
await view(1440, 900, false, false);
await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await settled({ panes: false });
await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps` });
await settled({ max: 30000, until: `typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip .sv-wholemap')` });
await ev(`document.querySelector('.sv-cp').click(); 1`);
await settled({});
const goto = async (i, paint) => {
  await ev(`document.querySelector('#svStrip .sv-plane[data-i="${i}"]').click(); 1`);
  await settled({ max: 15000, until: `__cmwSteps().stage === ${i} && !__cmwSteps().moving` });
  const s = await S();
  ok(`plane ${i} is a ${paint}`, s.paint === paint, s.paint);
};
// the head's controls: the ones inline and the ones its ⋯ holds when the room runs out (a longer title folds more of them,
// the head's own order), by id or name, each with whether it is disabled
const read = (e) => `({ id: ${e}.id || (${e}.querySelector('input, select') || {}).id || ${e}.getAttribute('aria-label') || ${e}.dataset.tip || ${e}.className, dis: ${e}.getAttribute('aria-disabled') === 'true', tip: ${e}.dataset.tip || '' })`;
const head = async () => {
  const hs = await ev(`[...document.querySelectorAll('.pane-head')].filter((h) => h.getClientRects().length).length`);
  const inline = await ev(`[...document.querySelectorAll('.pane-head .options > *:not(.opts-btn), .pane-head #unitBox')].map((e) => ${read('e')})`);
  const more = await ev(`(() => { const b = document.querySelector('.pane-head .opts-btn[aria-label="Display options"]'); if (b) b.click(); return !!b; })()`);
  await settled({ floor: 300 });
  const folded = more ? await ev(`[...document.querySelectorAll('#popHost .opts-pop > *')].filter((e) => e.matches('label.check, .seg, .scrub, #unitBox')).map((e) => ${read('e')})`) : [];
  if (more) { await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); 1`); await settled({ floor: 200 }); }
  return { heads: hs, kids: [...inline, ...folded] };
};
await goto(0, 'pull');
const pull = await head();
await goto(2, 'push');
const push = await head();
info.pull = pull; info.push = push;
ok('one head on each side of the colour plane', pull.heads === 1 && push.heads === 1, { pull: pull.heads, push: push.heads });
ok('the same controls before and after the colour plane', JSON.stringify(pull.kids.map((k) => k.id).sort()) === JSON.stringify(push.kids.map((k) => k.id).sort()), { pull: pull.kids.map((k) => k.id), push: push.kids.map((k) => k.id) });
ok('no colour button in place of the panel past the colour plane', !push.kids.some((k) => k.id === 'Colouring'), push.kids.map((k) => k.id));
ok('the style row is in the head on both', pull.kids.some((k) => k.id === 'dcSeg') && push.kids.some((k) => k.id === 'dcSeg'), { pull: pull.kids.map((k) => k.id), push: push.kids.map((k) => k.id) });
ok('the unit circle is in the head on both', pull.kids.some((k) => k.id === 'unitBox') && push.kids.some((k) => k.id === 'unitBox'), { pull: pull.kids.map((k) => k.id), push: push.kids.map((k) => k.id) });
const ol = (h) => h.kids.find((k) => k.id === 'outlineChk');
ok('Outlines applies on the colour plane and is disabled, with its reason, past it', !!ol(pull) && !ol(pull).dis && !!ol(push) && ol(push).dis && /colour plane/.test(ol(push).tip), { pull: ol(pull), push: ol(push) });
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
return { pass: fails.length === 0, fails, info };
