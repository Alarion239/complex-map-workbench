// The regions' display in the classic X → Y view (the steps view's is regions_phase_cmd.js): the Regions pop-up in X's
// head (grid lines, their step, chevrons, opacity, no pattern swatch), the phone's Display sheet, the
// tour's Views chapter without a Patterns step, and the pop-up fitting its box in en, ru and it. A command file for a
// CDP daemon (test/cdp_kit README); prints {pass, fails, info}.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}`;
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = (ms = 400) => settled({ floor: ms });
const { DISC, STATE, openSaved, popFit } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'regions_open.js'), 'utf8'))({ U, ev, go, sleep, settled });
await view(1440, 900, false, false);
await openSaved(`rgph-new-${Date.now() % 1000000}`, { v3: true, v4: true, shapes: [DISC], steps: [{ type: 'exp', params: {}, on: true }], nextId: 50 });
// ---- 4. the laptop's Regions button and its pop-up: no pattern swatch anywhere in the page
await ev(`__cmwSetMain('xy'); 1`); await settle(800);
const btn = await ev(`(() => { const b = document.querySelector('#leftFoot .pat-btn'); return b && { name: b.getAttribute('aria-label'), tip: b.dataset.tip }; })()`);
ok("X's head holds a Regions button", btn && btn.name === 'Regions' && btn.tip === 'Regions', btn);
ok('no pattern swatches in the page', (await ev(`document.querySelectorAll('#patternSeg, .patterns, [data-pat]').length`)) === 0, null);
await ev(`document.querySelector('#leftFoot .pat-btn').click()`); await settle(500);
const pop = await ev(`(() => {
  const p = document.querySelector('#popHost .pat-pop');
  return p && {
    label: p.getAttribute('aria-label'),
    ids: ['linesChk', 'patScale', 'chevChk', 'alphaRange'].filter((id) => p.querySelector('#' + id)),
    swatches: p.querySelectorAll('.pat, [data-pat], #regionsBox canvas').length,
    text: p.querySelector('#regionsBox').innerText,
  };
})()`);
ok('the Regions pop-up: grid lines, their step, chevrons and opacity, no swatch',
  pop && pop.label === 'Regions' && pop.ids.length === 4 && pop.swatches === 0
  && /phase of z/.test(pop.text) && /Grid step/.test(pop.text), pop);
// (standards-ok: the page has no Y pane, and X's head shows no key chip in this view: the key-chip row has nothing to check)
await key('Escape'); await settle(300);
ok("Escape closes it and the regions' box goes home", (await ev(`document.getElementById('regionsBox').parentElement.id`)) === 'regionsHome', null);
// ---- 5. the phone's Display sheet: the regions' options, no swatch
await view(390, 844, false, true);
await openSaved(`rgph-ph-${Date.now() % 1000000}`, STATE({ pattern: 'tiles', view: { main: 'xy' } }));
await ev(`__cmwSetMain('xy'); 1`); await settle(600);
await ev(`Phone.open('display')`); await settle(700);
const ph = await ev(`(() => {
  const b = document.querySelector('.ph-sheet #regionsBox');
  const hs = [...document.querySelectorAll('.ph-sheet .ph-h')].filter((e) => !e.hidden).map((e) => e.textContent);
  return b && {
    ids: ['linesChk', 'patScale', 'chevChk', 'alphaRange'].filter((id) => b.querySelector('#' + id)),
    swatches: b.querySelectorAll('.pat, [data-pat], canvas').length,
    alphaShown: !!b.querySelector('#alphaRange') && b.querySelector('#alphaRange').getClientRects().length > 0,
    heads: hs,
  };
})()`);
ok("the phone's Display sheet: a Regions section with the regions' options, no swatch",
  ph && ph.ids.length === 4 && ph.swatches === 0 && ph.heads.includes('Regions'), ph);
ok("the phone's Display sheet in the classic X → Y view keeps the regions' own opacity slider (the steps view hides it for its one Opacity)", !!ph && ph.alphaShown, ph);
ok('the phone opens the saved Tiles as the phase', (await ev('__cmwRegions().pattern')) === 'phase', null);
await ev(`Phone.close(true)`); await settle(300);
// ---- 6. the tour: no chapter has a Patterns step, and Planes has its Sphere and Landscape step
const ids = await ev(`Tour._t.CHAPTERS.flatMap((c) => c.steps.map((s) => c.id + '/' + s.id))`);
info.steps = ids;
ok('no tour step is Patterns, and Planes has its Sphere and Landscape step', ids.length >= 20 && !ids.some((x) => /\/patterns$/.test(x)) && ids.includes('planes/surface'), ids);

// ---- 7. the Regions pop-up fits its box in every language: its description wraps, with no sideways scroll cutting the values
for (const lang of ['en', 'ru', 'it']) {
  await view(1280, 800, false, false);
  const fit = await popFit(lang, { prep: `__cmwSetMain('xy'); 1`, btn: '#leftFoot .pat-btn', pop: '#popHost .pat-pop' });
  info['fit ' + lang] = fit;
  ok(`${lang}: the Regions pop-up fits its box (no sideways scroll, nothing cut)`, fit && fit.out.length === 0, fit);
}

return { pass: !fails.length, fails, info };
