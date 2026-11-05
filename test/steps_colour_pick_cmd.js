// The colouring's picker in the steps view's planes past the colour plane:
// - the Regions button's swatch there is named Colouring and opens the colour-scheme picker, not the regions' display
//   (no grid step, chevrons or opacity rows): a header naming the colour plane, a way to it, the style row, and the
//   grid lines' toggle;
// - picking a style there is the one colouring's: the colour plane's own style row shows it;
// - the way to the colour plane glides there and closes the picker;
// - on a phone the Display sheet holds the same picker, its rows 44 px tall, and not the regions' display;
// - the style row wraps and never cuts a style: every style button lies inside the picker, at 1280 in Russian and
//   on a phone at 360.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const ns = 'svcp' + Date.now();
const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 's2', kind: 'circle', c: [0.3, 0.2], r: 0.8, ci: 0, visible: true }],
  steps: [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 80 } };
const S = () => ev('__cmwSteps()');
// the colour plane is z, and the view is on the last plane
const openPast = async (w, h, touch, lang = 'en') => {
  await view(w, h, false, touch);
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await settled({ panes: false });
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}&lang=${lang}&view=steps` });
  await settled({ max: 30000, until: `typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip .sv-wholemap')` });
  await ev(`document.querySelector('.sv-cp').click(); 1`);
  await settled({});
  await ev(`document.querySelector('#svStrip .sv-plane[data-i="2"]').click(); 1`);
  await settled({ max: 15000, until: `__cmwSteps().stage === 2 && !__cmwSteps().moving` });
};
await openPast(1440, 900, false);
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

const inside = () => ev(`(() => { const p = document.querySelector('.cp-pop'); if (!p) return null; const pr = (p.closest('.pop, .ph-sheet, [role=dialog]') || p).getBoundingClientRect(); const bs = [...p.querySelectorAll('#dcSegPop button')].map((b) => { const r = b.getBoundingClientRect(); return { v: b.dataset.v, l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom), w: Math.round(r.width) }; }); return { pop: [Math.round(pr.left), Math.round(pr.right)], n: bs.length, out: bs.filter((x) => x.l < pr.left - 0.5 || x.r > pr.right + 0.5 || !x.w), bs }; })()`);
// Russian at 1280: the row is not cut
await openPast(1280, 800, false, 'ru');
await ev(`document.querySelector('.pane-head .pat-btn').click(); 1`);
await settled({ floor: 500 });
const ru = await inside();
ok('1280 ru: all six styles lie inside the picker', !!ru && ru.n === 6 && ru.out.length === 0, ru);
// a phone: the Display sheet
await openPast(390, 780, true);
await ev(`(document.querySelector('button[aria-label*="isplay"]') || document.querySelector('#dispBtn')).click(); 1`);
await settled({ floor: 600 });
const ph = await ev(`(() => { const p = document.querySelector('.cp-pop'); if (!p || !p.getClientRects().length) return null; const h = (e) => Math.round(e.getBoundingClientRect().height); return { text: p.innerText, regions: !!document.querySelector('#regionsBox') && document.querySelector('#regionsBox').getClientRects().length > 0, style: h(p.querySelector('#dcSegPop button')), go: h(p.querySelector('.cp-go')), lines: h(p.querySelector('#linesChkPop').closest('label')) }; })()`);
ok('a phone\'s Display sheet holds the colour picker, not the regions\' display', !!ph && /Colouring of z/.test(ph.text) && !ph.regions, ph);
ok('its rows are 44 px tall', !!ph && ph.style >= 44 && ph.go >= 44 && ph.lines >= 44, ph);
const ph390 = await inside();
ok('390: all six styles lie inside the sheet, a 3 × 2 grid', !!ph390 && ph390.n === 6 && ph390.out.length === 0 && new Set(ph390.bs.map((x) => x.t)).size === 2, ph390);
await openPast(360, 740, true);
await ev(`(document.querySelector('button[aria-label*="isplay"]') || document.querySelector('#dispBtn')).click(); 1`);
await settled({ floor: 600 });
const ph360 = await inside();
ok('360: all six styles lie inside the sheet', !!ph360 && ph360.n === 6 && ph360.out.length === 0, ph360);
return { pass: fails.length === 0, fails, info };
