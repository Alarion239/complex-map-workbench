// The colouring's picker in the steps view's planes past the colour plane:
// - the Regions button's swatch there is named Colouring and opens the colour-scheme picker, not the regions' display
//   (no grid step, chevrons or opacity rows): a header naming the colour plane, a way to it, the style row, and the
//   grid lines' toggle;
// - picking a style there is the one colouring's: the colour plane's own style row shows it;
// - the way to the colour plane glides there and closes the picker.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const ns = 'svcp' + Date.now();
const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 's2', kind: 'circle', c: [0.3, 0.2], r: 0.8, ci: 0, visible: true }],
  steps: [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 80 } };
await view(1440, 900, false, false);
await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await settled({ panes: false });
await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps` });
await settled({ max: 30000, until: `typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip .sv-wholemap')` });
const S = () => ev('__cmwSteps()');
// the colour plane is z, and the view is on the last plane
await ev(`document.querySelector('.sv-cp').click(); 1`);
await settled({});
await ev(`document.querySelector('#svStrip .sv-plane[data-i="2"]').click(); 1`);
await settled({ max: 15000, until: `__cmwSteps().stage === 2 && !__cmwSteps().moving` });
const s0 = await S();
ok('the view is on the last plane, past the colour plane z', s0.stage === 2 && s0.T === 0, { stage: s0.stage, T: s0.T });
const btn = await ev(`(() => { const b = document.querySelector('.pane-head .pat-btn'); return b ? { label: b.getAttribute('aria-label') } : null; })()`);
ok('its head has the colour button, named Colouring', btn && btn.label === 'Colouring', btn);
await ev(`document.querySelector('.pane-head .pat-btn').click(); 1`);
await settled({ floor: 400 });
const pop = await ev(`(() => { const p = document.querySelector('.cp-pop'); if (!p) return null; return { text: p.innerText, regionsBox: !!document.querySelector('#popHost #regionsBox'), styles: p.querySelectorAll('#dcSegPop button').length, lines: !!p.querySelector('#linesChkPop') }; })()`);
ok('the button opens the colour picker, not the regions panel', !!pop && !pop.regionsBox, pop);
ok('its header names the colour plane z, with a way to it', pop && /Colouring of z \(the colour plane\)/.test(pop.text) && /Go to z/.test(pop.text), pop);
ok('it holds the style row and the grid lines toggle', pop && pop.styles >= 5 && pop.lines, pop);
await ev(`document.querySelector('#dcSegPop button[data-v="modulus"]').click(); 1`);
await settled({ floor: 600 });
const after = await ev(`({ pop: !!document.querySelector('.cp-pop'), mine: (document.querySelector('#dcSegPop .on') || {}).dataset && document.querySelector('#dcSegPop .on').dataset.v })`);
ok('picking a style keeps the picker open with that style checked', after.pop && after.mine === 'modulus', after);
await ev(`document.querySelector('.cp-pop .cp-go').click(); 1`);
await settled({ max: 15000, until: `__cmwSteps().stage === 0 && !__cmwSteps().moving` });
const s1 = await S();
ok('Go to z takes the view to the colour plane and closes the picker', s1.stage === 0 && !(await ev(`!!document.querySelector('.cp-pop')`)), { stage: s1.stage });
const own = await ev(`(() => { const o = document.querySelector('#dcSeg .on'); return o ? o.dataset.v : null; })()`);
ok('the colour plane\'s own style row shows the style picked from the later plane', own === 'modulus', own);
return { pass: fails.length === 0, fails, info };
