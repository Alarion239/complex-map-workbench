// The colouring's picker in the steps view's planes past the colour plane:
// - the head has the colour plane's own panel there, no colour button (steps_colour_parity_cmd.js asks its controls);
// - on a phone the Display sheet holds the same panel (the style row, Outlines disabled) and the regions' display, no pop-up;
// - the style row never cuts a style: every style button lies inside the head at 1280 in Russian, and inside the sheet
//   on a phone at 390 and 360.
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
ok('svPaint is push past the colour plane', s0.paint === 'push', s0.paint);
ok('past the colour plane the head has no colour button: its panel is the colour plane\'s', !(await ev(`!!document.querySelector('.pane-head .pat-btn')`)) && (await ev(`!!document.querySelector('.pane-head #dcSeg')`)), null);

// the Display sheet's style row: every style button inside the sheet, how many rows, the sheet's regions' display
const inside = () => ev(`(() => { const sg = document.querySelector('#dcSeg'); if (!sg || !sg.getClientRects().length) return null; const sh = sg.closest('.ph-sheet, [role=dialog]') || sg.parentElement, pr = sh.getBoundingClientRect(); const bs = [...sg.querySelectorAll('button')].map((b) => { const r = b.getBoundingClientRect(); return { v: b.dataset.v, l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; }); const rb = document.querySelector('#regionsBox'); return { n: bs.length, out: bs.filter((x) => x.l < pr.left - 0.5 || x.r > pr.right + 0.5 || !x.w), rows: new Set(bs.map((x) => x.t)).size, minH: Math.min(...bs.map((x) => x.h)), regions: !!rb && rb.getClientRects().length > 0, popup: !!document.querySelector('.cp-pop'), outline: !!document.querySelector('#outlineChk') && document.querySelector('#outlineChk').disabled, bs }; })()`);
// Russian at 1280: the head's style row is not cut
await openPast(1280, 800, false, 'ru');
const ru = await ev(`(() => { const h = document.querySelector('.pane-head'), r = h.getBoundingClientRect(), bs = [...h.querySelectorAll('#dcSeg button')].map((b) => b.getBoundingClientRect()); return { n: bs.length, out: bs.filter((x) => x.left < r.left - 0.5 || x.right > r.right + 0.5 || !x.width).length }; })()`);
ok('1280 ru: all six styles lie inside the head', !!ru && ru.n === 6 && ru.out === 0, ru);
// a phone: the Display sheet
await openPast(390, 780, true);
await ev(`(document.querySelector('.ph-dsp') || document.querySelector('button[aria-label*="isplay"]')).click(); 1`);
await settled({ floor: 600 });
const ph390 = await inside();
ok('a phone\'s Display sheet holds the same panel: the style row, the regions\' display, no pop-up, Outlines disabled', !!ph390 && ph390.regions && !ph390.popup && ph390.outline, ph390);
ok('390: all six styles lie inside the sheet', !!ph390 && ph390.n === 6 && ph390.out.length === 0, ph390);
await openPast(360, 740, true);
await ev(`(document.querySelector('.ph-dsp') || document.querySelector('button[aria-label*="isplay"]')).click(); 1`);
await settled({ floor: 600 });
const ph360 = await inside();
ok('360: all six styles lie inside the sheet', !!ph360 && ph360.n === 6 && ph360.out.length === 0, ph360);
ok('the style buttons are touch targets', !!ph360 && ph360.minH >= 44, ph360 && ph360.minH);
return { pass: fails.length === 0, fails, info };
