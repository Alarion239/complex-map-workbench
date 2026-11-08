// The regions' one fill and its display in the steps view (the classic X → Y view's is regions_phase_classic_cmd.js).
// The region patterns (Checker, Log-polar, Tiles, Square grid, Polar grid, Arg z, Stretch, Sphere checker, Solid) are
// gone and every region is filled by the phase of z carried by the map (#363). A saved state or a link with any old
// pattern opens with the phase and keeps its grid step and grid lines; the steps head's ⋯ pop-up and the phone's Display
// sheet hold the grid lines, their step, the chevrons and the opacity with no pattern swatch, and the pop-up fits its
// box in en, ru and it. A command file for a CDP daemon (test/cdp_kit README); prints {pass, fails, info}.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}`;
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = (ms = 400) => settled({ floor: ms });
const { DISC, STATE, openSaved, readRegions, popFit } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'regions_open.js'), 'utf8'))({ U, ev, send, nav, sleep, settled: settled });
await view(1440, 900, false, false);
// ---- 1. a saved state with an old pattern opens with the phase; its grid step and grid lines stay
for (const [pattern, patternScale, lines] of [['checker', 2, false], ['stretch', 0.5, true], ['sphere', 4, false], ['solid', 1, true], ['polar', 0.25, true]]) {
  await openSaved(`rgph-${pattern}-${Date.now() % 1000000}`, STATE({ pattern, patternScale, lines }));
  const r = await readRegions(`saved pattern ${pattern}`);
  ok(`saved pattern ${pattern}: opens as the phase, grid step ×${patternScale} and grid lines ${lines ? 'on' : 'off'} kept`, r && r.pattern === 'phase' && r.patternScale === patternScale && r.lines === lines, r);
}
// ---- 2. a link with an old pattern: the same
{
  await openSaved(`rgph-l0-${Date.now() % 1000000}`, STATE({}));
  // (the page keeps the payload in window.__rgLink: the encoding is a promise)
  await ev(`(Params.encodeLink(${JSON.stringify(STATE({ pattern: 'checker', patternScale: 2, lines: false }))}).then((p) => { window.__rgLink = p; }), 1)`);
  let payload = null;
  for (let i = 0; i < 50 && !payload; i++) { await sleep(100); payload = await ev('window.__rgLink || null'); }
  ok('a link encodes', typeof payload === 'string' && /^\d\./.test(payload), payload);
  await nav(`${U}/gl-helpers.html`); await sleep(300);
  await nav(`${U}/test.html?ns=rgph-l1-${Date.now() % 1000000}#cmw=${payload}`);
  // (the link opens by a reload that drops the hash: the page is ready once it is gone and the figure is in)
  const r = await readRegions('the link with the Checker', `!location.hash && __cmwShapes().shapes.length === 1`);
  await settle(800);
  ok('a link with the Checker opens as the phase, grid step ×2 and grid lines off kept', r && r.pattern === 'phase' && r.patternScale === 2 && r.lines === false, r);
}
// ---- 3. the new figure's fill is the phase, with grid lines
await openSaved(`rgph-new-${Date.now() % 1000000}`, { v3: true, v4: true, shapes: [DISC], steps: [{ type: 'exp', params: {}, on: true }], nextId: 50 });
info.fresh = await readRegions('a state with no pattern');
ok('a state with no pattern: the phase', info.fresh.pattern === 'phase', info.fresh);
// ---- 4. the steps head's ⋯ pop-up holds the regions' display: grid lines, their step, chevrons and opacity, no swatch
ok('the steps view is on', await ev('typeof __cmwSteps === "function" && __cmwSteps().on'), null);
ok('no pattern swatches in the page', (await ev(`document.querySelectorAll('#patternSeg, .patterns, [data-pat]').length`)) === 0, null);
await ev(`document.querySelector('#leftFoot .opts-btn').click()`); await settle(500);
const pop = await ev(`(() => { const p = document.querySelector('#popHost .opts-pop'); const b = p && p.querySelector('#regionsBox'); return b && { ids: ['linesChk', 'patScale', 'chevChk', 'alphaRange'].filter((id) => b.querySelector('#' + id)), swatches: p.querySelectorAll('.pat, [data-pat], #regionsBox canvas').length, text: b.innerText }; })()`);
ok("the head's ⋯ pop-up: grid lines, their step, chevrons and opacity, no swatch", pop && pop.ids.length === 4 && pop.swatches === 0 && /phase of w₁, carried by the map/.test(pop.text) && /Grid step/.test(pop.text), pop);
const grp = await ev(`(() => { const p = document.querySelector('#popHost .opts-pop'), kids = [...p.children], i = kids.indexOf(p.querySelector('#regionsBox')); const h = kids[i - 1]; return { before: i, label: h && h.classList.contains('opts-sep') ? h.textContent : null, rule: h ? getComputedStyle(h).borderTopWidth : null }; })()`);
ok("the regions' group follows the head's other controls under a rule and its name", grp.before > 1 && grp.label === 'Regions' && grp.rule === '1px', grp);
await ev(`(() => { const c = document.getElementById('linesChk'); if (!c.checked) c.click(); return 1; })()`); await settle(600);
ok('the grid lines check acts on the regions', (await ev('__cmwRegions().lines')) === true, null);
await ev(`document.getElementById('linesChk').click(); 1`); await settle(600);
ok('and switches them off again', (await ev('__cmwRegions().lines')) === false, null);
await key('Escape'); await settle(300);
ok("Escape closes it and the regions' box goes home", (await ev(`document.getElementById('regionsBox').parentElement.id`)) === 'regionsHome', null);
// ---- 5. the phone's Display sheet: the regions' options, no swatch
await view(390, 844, false, true);
await openSaved(`rgph-ph-${Date.now() % 1000000}`, STATE({ pattern: 'tiles' }));
ok('the steps view is on (phone)', await ev('typeof __cmwSteps === "function" && __cmwSteps().on'), null);
await ev(`Phone.open('display')`); await settle(700);
const ph = await ev(`(() => { const b = document.querySelector('.ph-sheet #regionsBox'); const hs = [...document.querySelectorAll('.ph-sheet .ph-h')].filter((e) => !e.hidden).map((e) => e.textContent); return b && { ids: ['linesChk', 'patScale', 'chevChk', 'alphaRange'].filter((id) => b.querySelector('#' + id)), swatches: b.querySelectorAll('.pat, [data-pat], canvas').length, heads: hs }; })()`);
ok("the phone's Display sheet: a Regions section with the regions' options, no swatch", ph && ph.ids.length === 4 && ph.swatches === 0 && ph.heads.includes('Regions'), ph);
ok('the phone opens the saved Tiles as the phase', (await ev('__cmwRegions().pattern')) === 'phase', null);
await ev(`Phone.close(true)`); await settle(300);
// ---- 6. the ⋯ pop-up fits its box in every language: its description wraps, with no sideways scroll cutting the values
for (const lang of ['en', 'ru', 'it']) {
  await view(1280, 800, false, false);
  const fit = await popFit(lang, { btn: '#leftFoot .opts-btn', pop: '#popHost .opts-pop' });
  info['fit ' + lang] = fit;
  ok(`${lang}: the ⋯ pop-up fits its box (no sideways scroll, nothing cut)`, fit && fit.out.length === 0, fit);
}

return { pass: !fails.length, fails, info };
