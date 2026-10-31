// The regions' one fill (#363): the region patterns (Checker, Log-polar, Tiles, Square grid, Polar grid, Arg z, Stretch,
// Sphere checker, Solid) are gone and every region is filled by the phase of z carried by the map. A saved state or a
// link with any old pattern opens with the phase and keeps its grid step and grid lines; the Regions pop-up (Y's head in
// the X → Y view) and the phone's Display sheet hold the grid lines, their step, the chevrons and the opacity with no
// pattern swatch; Y's key chip names the grid's cell while the lines are drawn, else the phase; the tour has no Patterns
// step. A command file for a CDP daemon (test/cdp_kit README); prints {pass, fails, info}.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}`;
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 400) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const DISC = { id: 's1', kind: 'disc', c: [0, 0], r: 1, ci: 0, visible: true };
const STATE = (o) => Object.assign({ v3: true, v4: true, shapes: [DISC], steps: [{ type: 'exp', params: {}, on: true }], nextId: 50, focus: 0, rightMode: 'image', srcView: { cx: 0, cy: 0, s: 80 } }, o);
// the app with a saved state written straight to its storage (not the kit's load(), which sets a seeded pattern
// through the test hook): what a user's own saved work does
const openSaved = async (ns, st) => {
  await send('Page.navigate', { url: `${U}/gl-helpers.html` }); await sleep(350);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await nav(`${U}/test.html?ns=${ns}`);
  for (let i = 0; i < 200 && !(await ev(`typeof __cmwRegions === 'function'`)); i++) await sleep(100);
  await settle(800);
};

await view(1440, 900, false, false);
// ---- 1. a saved state with an old pattern opens with the phase; its grid step and grid lines stay
for (const [pattern, patternScale, lines] of [['checker', 2, false], ['stretch', 0.5, true], ['sphere', 4, false], ['solid', 1, true], ['polar', 0.25, true]]) {
  await openSaved(`rgph-${pattern}-${Date.now() % 1000000}`, STATE({ pattern, patternScale, lines }));
  const r = await ev('__cmwRegions()');
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
  for (let i = 0; i < 100; i++) { await sleep(200); try { if ((await ev(`typeof __cmwRegions === 'function' && !location.hash && __cmwShapes().shapes.length === 1`)) === true) break; } catch (e) { /* the page reloads */ } }
  await settle(800);
  const r = await ev('__cmwRegions()');
  ok('a link with the Checker opens as the phase, grid step ×2 and grid lines off kept', r && r.pattern === 'phase' && r.patternScale === 2 && r.lines === false, r);
}
// ---- 3. the new figure's fill is the phase, with grid lines
await openSaved(`rgph-new-${Date.now() % 1000000}`, { v3: true, v4: true, shapes: [DISC], steps: [{ type: 'exp', params: {}, on: true }], nextId: 50 });
info.fresh = await ev('__cmwRegions()');
ok('a state with no pattern: the phase', info.fresh.pattern === 'phase', info.fresh);
// ---- 4. the laptop's Regions button and its pop-up: no pattern swatch anywhere in the page
await ev(`__cmwSetMain('xy'); 1`); await settle(800);
const btn = await ev(`(() => { const b = document.querySelector('#rightFoot .pat-btn'); return b && { name: b.getAttribute('aria-label'), tip: b.dataset.tip }; })()`);
ok("Y's head holds a Regions button", btn && btn.name === 'Regions' && btn.tip === 'Regions', btn);
ok('no pattern swatches in the page', (await ev(`document.querySelectorAll('#patternSeg, .patterns, [data-pat]').length`)) === 0, null);
await ev(`document.querySelector('#rightFoot .pat-btn').click()`); await settle(500);
const pop = await ev(`(() => { const p = document.querySelector('#popHost .pat-pop'); return p && { label: p.getAttribute('aria-label'), ids: ['linesChk', 'patScale', 'chevChk', 'alphaRange'].filter((id) => p.querySelector('#' + id)), swatches: p.querySelectorAll('.pat, [data-pat], #regionsBox canvas').length, text: p.querySelector('#regionsBox').innerText }; })()`);
ok('the Regions pop-up: grid lines, their step, chevrons and opacity, no swatch', pop && pop.label === 'Regions' && pop.ids.length === 4 && pop.swatches === 0 && /phase of z/.test(pop.text) && /Grid step/.test(pop.text), pop);
// the key chip: the grid's cell with the lines on, the phase with them off
await ev(`(() => { const c = document.getElementById('linesChk'); if (!c.checked) c.click(); return 1; })()`); await settle(600);
const chipOn = await ev(`(document.querySelector('#rightLegend .lg-sum') || {}).textContent || ''`);
await ev(`document.getElementById('linesChk').click(); 1`); await settle(600);
let chipOff = '';
for (let i = 0; i < 30 && (chipOff = await ev(`(document.querySelector('#rightLegend .lg-sum') || {}).textContent || ''`)) !== 'Phase of z'; i++) await sleep(100);
info.chip = [chipOn, chipOff];
ok("Y's key chip: the cell with the grid lines on, the phase of z with them off", /^cell \S/.test(chipOn) && chipOff === 'Phase of z' && (await ev('__cmwRegions().lines')) === false, info.chip);
await key('Escape'); await settle(300);
ok("Escape closes it and the regions' box goes home", (await ev(`document.getElementById('regionsBox').parentElement.id`)) === 'regionsHome', null);
// ---- 5. the phone's Display sheet: the regions' options, no swatch
await view(390, 844, false, true);
await openSaved(`rgph-ph-${Date.now() % 1000000}`, STATE({ pattern: 'tiles', view: { main: 'xy' } }));
await ev(`__cmwSetMain('xy'); 1`); await settle(600);
await ev(`Phone.open('display')`); await settle(700);
const ph = await ev(`(() => { const b = document.querySelector('.ph-sheet #regionsBox'); const hs = [...document.querySelectorAll('.ph-sheet .ph-h')].filter((e) => !e.hidden).map((e) => e.textContent); return b && { ids: ['linesChk', 'patScale', 'chevChk', 'alphaRange'].filter((id) => b.querySelector('#' + id)), swatches: b.querySelectorAll('.pat, [data-pat], canvas').length, heads: hs }; })()`);
ok("the phone's Display sheet: a Regions section with the regions' options, no swatch", ph && ph.ids.length === 4 && ph.swatches === 0 && ph.heads.includes('Regions'), ph);
ok('the phone opens the saved Tiles as the phase', (await ev('__cmwRegions().pattern')) === 'phase', null);
await ev(`Phone.close(true)`); await settle(300);
// ---- 6. the tour: no Patterns step in Views
await view(1440, 900, false, false);
await openSaved(`rgph-tour-${Date.now() % 1000000}`, STATE({}));
await ev(`(() => { Tour.dismissSuggestion(); Tour.auto(false); Tour.start({ chapter: 'views' }); return 1; })()`); await settle(1500);
const ids = [];
for (let k = 0; k < 10 && (await ev('Tour.isActive()')); k++) {
  const c = await ev('Tour.current()');
  if (!c || c.chapter !== 'views') break;
  ids.push(c.id);
  await ev('Tour.next(); 1'); await settle(700);
}
await ev('Tour.isActive() ? Tour.stop() : 0; 1'); await settle(300);
info.views = ids;
ok('the Views chapter has no Patterns step and ends with Phase key', ids.length >= 4 && !ids.includes('patterns') && ids[ids.length - 1] === 'key', ids);

// ---- 7. the Regions pop-up fits its box in every language (its description wraps; eyes on #552: it had widened the
// pop-up into a sideways scroll that cut the values)
for (const lang of ['en', 'ru', 'it']) {
  await view(1280, 800, false, false);
  const ns = `rgph-fit-${lang}-${Date.now() % 1000000}`;
  await send('Page.navigate', { url: `${U}/gl-helpers.html` }); await sleep(350);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(STATE({})))}); 1`);
  await nav(`${U}/test.html?ns=${ns}&lang=${lang}`);
  for (let i = 0; i < 200 && !(await ev(`typeof __cmwRegions === 'function'`)); i++) await sleep(100);
  await settle(800);
  await ev(`__cmwSetMain('xy'); 1`); await settle(800);
  await ev(`document.querySelector('#rightFoot .pat-btn').click()`); await settle(500);
  const fit = await ev(`(() => { const p = document.querySelector('#popHost .pat-pop'); if (!p) return null; const out = [p, ...p.querySelectorAll('*')].filter((e) => e.clientWidth > 0 && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'visible').map((e) => (e.id || e.className || e.tagName) + ' ' + e.scrollWidth + '/' + e.clientWidth); return { out, pw: Math.round(p.getBoundingClientRect().width) }; })()`);
  info['fit ' + lang] = fit;
  ok(`${lang}: the Regions pop-up fits its box (no sideways scroll, nothing cut)`, fit && fit.out.length === 0, fit);
  await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); 1`); await settle(300);
}

return { pass: !fails.length, fails, info };
