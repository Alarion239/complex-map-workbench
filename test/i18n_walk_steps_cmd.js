// "No English left" in the steps view (the classic views' walk is i18n_walk_cmd.js): the Russian interface through the
// steps view's thread, every plane on each surface (plane, sphere, landscape), the colour plane chosen on each plane, the
// colour scope's choices, the play popover and a step's menu. test/i18n_scan.js records every string with a Latin word that
// is not allowed. A command file for a CDP daemon (test/cdp_kit README); result { n, errors, left: [{ text, words, where,
// state }] }; n = 0 passes.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const SCAN = fs.readFileSync(path.join(DIR, '..', 'i18n_scan.js'), 'utf8');
const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'h1', kind: 'halfplane', a: [0, 0], b: [1, 0], ci: 0, visible: true }],
  steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, { type: 'pown', params: { n: 3 }, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } };
await view(1440, 900, false, false);
const ns = 'svwalk' + Date.now();
await seed(ns, st);
await go(`http://localhost:${PORT}/test.html?ns=${ns}&lang=ru&view=steps`);
const idle = `__cmwSteps().on && !__cmwSteps().moving && !!document.querySelector('#svStrip .sv-plane')`;
await settled({ max: 30000, until: idle });
await ev(SCAN);
// scan the page as it is once the thread is at rest
const S = async (label) => { await settled({ max: 20000, until: '!__cmwSteps().moving' }); await ev(`__i18nScan(${JSON.stringify(label)})`); };
await S('steps start');
const planes = await ev('__cmwSteps().planes');
for (const surf of ['plane', 'sphere', 'land']) {
  await ev(`__cmwSteps({ surf: ${JSON.stringify(surf)} }), 1`);
  for (const p of planes) {
    await ev(`__cmwSteps({ go: ${p}, now: true }), 1`);
    await S(`steps ${surf} plane ${p}`);
  }
}
await ev(`__cmwSteps({ surf: 'plane' }), 1`);
for (const p of planes) {
  await ev(`__cmwSteps({ go: ${p}, now: true }), 1`);
  await ev(`__cmwSteps({ T: ${p} }), 1`);
  await S(`steps colour plane ${p}`);
}
// the colour scope's choices, as the user picks them
const n = await ev(`document.querySelectorAll('#svHead .sv-scope [role=radio]').length`);
for (let i = 0; i < n; i++) {
  await ev(`document.querySelectorAll('#svHead .sv-scope [role=radio]')[${i}].click(), 1`);
  await S(`steps scope choice ${i}`);
}
// the play popover and a step's menu
await ev(`(() => { const b = document.querySelector('#svStrip .sv-play ~ .sv-more, #svStrip .sv-playmore, #svStrip [aria-haspopup]'); if (b) b.click(); })()`);
await S('steps play popover');
await key('Escape');
await ev(`(() => { const b = document.querySelector('#svStrip .sv-fwrap .sv-more'); if (b) b.click(); })()`);
await S('steps step menu');
await key('Escape');
const left = await ev('__i18nLeft()');
const errs = logs().filter((l) => /error|exception/i.test(JSON.stringify(l)) && !/favicon|404|fonts\.g|ERR_TUNNEL/.test(JSON.stringify(l))).slice(0, 8);
// a walk that saw no thread proves nothing: the planes, three surfaces and the scope's choices must all have been visited
if (planes.length < 3 || n < 2) errs.push({ t: 'walk', m: `the thread showed ${planes.length} planes and ${n} scope choices` });
return { n: left.length, errors: errs, left };
