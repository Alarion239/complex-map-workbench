// The steps view's Opacity slider (colour popover of a plane past the colour plane): z³ on a disc about 0, on plane z³,
// covers each w in the disc three times and a small disc about 1.4 once.
// - the slider is a range input of 30 to 100 % in steps of 5, at 85 % by default, with aria-valuetext "85 %", and the
//   setting is saved with the page state;
// - a point covered three times shows another colour at 85 % and at 50 % than at 100 % (the layers behind show through),
//   and 85 % differs from 50 %;
// - a point covered once is pixel-identical at 100 %, 85 % and 50 %;
// - a saved opacity (the page state's alpha, as a share link carries it) is the one the plane draws and the slider shows;
// - the regions' Opacity slider (the same S.alpha) follows it;
// - on the Landscape (opaque sheets) the slider is there, disabled, with a tip saying so;
// - the slider works from the keyboard (the arrow keys move it by one step).
// Inside regions, so that only the shapes' images are coloured (Everywhere covers every w three times).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const { lpx } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'carry_kit.js'), 'utf8'));
await view(1200, 800, false, false);
// the page on plane z³ with the colour popover open; alpha: the saved state's opacity (none: the default)
let ns = '';
const openPopover = async (alpha) => {
  ns = 'svop' + Date.now();
  const st = Object.assign({ v3: true, v4: true, v5: true, v6: true,
    shapes: [{ id: 's2', kind: 'disc', c: [0, 0], r: 1, ci: 0, visible: true }, { id: 's3', kind: 'disc', c: [1.4, 0], r: 0.3, ci: 1, visible: true }],
    steps: [{ type: 'pown', params: { n: 3 }, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 80 } }, alpha == null ? {} : { alpha });
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await settled({ panes: false });
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps` });
  await settled({ max: 30000, until: `typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip .sv-wholemap')` });
  await ev(`document.querySelector('.sv-cp').click(); 1`);
  await settled({});
  await ev(`document.querySelector('#svStrip .sv-plane[data-i="1"]').click(); 1`);
  await settled({ max: 15000, until: `__cmwSteps().stage === 1 && !__cmwSteps().moving && __cmwSvFixed()` });
  await ev(`[...document.querySelectorAll('.pane-head button')].find((b) => b.textContent.trim() === 'Inside regions').click(); 1`);
  await settled({ max: 15000, until: '__cmwSvFixed()' });
  await ev(`document.querySelector('.pane-head .opts-btn').click(); 1`);
  await settled({ floor: 400 });
};
await openPopover();
const slider = await ev(`(() => { const r = document.querySelector('.opts-pop input.sv-opacity'); return r && { min: r.min, max: r.max, step: r.step, value: r.value, text: r.getAttribute('aria-valuetext'), label: r.getAttribute('aria-label') }; })()`);
ok('the popover holds the Opacity range, 30 to 100 in steps of 0.05, at 0.85 with valuetext "85 %"',
  !!slider && slider.min === '0.3' && slider.max === '1' && slider.step === '0.05' && +slider.value === 0.85 && slider.text === '85 %' && slider.label === 'Opacity', slider);
const setOpacity = async (v) => {
  await ev(`(() => { const r = document.querySelector('.opts-pop input.sv-opacity'); r.value = ${v}; r.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
  await settled({ max: 60000, until: `__cmwSvFixed() && (() => { const g = __cmwPaneStatus('L'); return !!g && !g.pending && !g.compiling; })()` });
};
// w = 0.5 is covered three times, w = 2.74 (the image of 1.4) once
const read = async () => { const q = await lpx([[0.5, 0.1], [2.74, 0.05]]); return { three: q.px[0] && q.px[0][4], one: q.px[1] && q.px[1][4] }; };
const diff = (a, b) => Math.max(...a.map((x, i) => Math.abs(x - b[i])));
await setOpacity(1); const full = await read();
await setOpacity(0.85); const mid = await read();
await setOpacity(0.5); const low = await read();
info.px = { full, mid, low };
ok('every sampled point is on the pane', [full, mid, low].every((r) => r.three && r.one), info.px);
ok('a point covered three times differs at 85 % from 100 %', !!full.three && !!mid.three && diff(full.three, mid.three) >= 3, info.px);
ok('and at 50 % from 85 %', !!mid.three && !!low.three && diff(mid.three, low.three) >= 3, info.px);
ok('a point covered once is pixel-identical at 100 %, 85 % and 50 %', !!full.one && !!mid.one && !!low.one && diff(full.one, mid.one) === 0 && diff(full.one, low.one) === 0, info.px);
const regionsRange = await ev(`+document.getElementById('alphaRange').value`);
ok('the regions\' own Opacity slider (#alphaRange) follows it: one setting, one value', regionsRange === 0.5, regionsRange);
const live = await ev(`__cmwRegions().alpha`);
await settled({ max: 10000, until: `JSON.parse(localStorage.getItem('complex-map-workbench-v1:${ns}') || '{}').alpha === 0.5` });
const saved = await ev(`JSON.parse(localStorage.getItem('complex-map-workbench-v1:${ns}') || '{}').alpha`);
ok('the setting is the page state\'s alpha and is saved with it', live === 0.5 && saved === 0.5, { live, saved });
await ev(`document.querySelector('.opts-pop input.sv-opacity').focus(); 1`);
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
const arrow = await ev(`(() => { const r = document.querySelector('.opts-pop input.sv-opacity'); return { v: +r.value, text: r.getAttribute('aria-valuetext') }; })()`);
ok('the right arrow moves the slider one step, valuetext 55 %', Math.abs(arrow.v - 0.55) < 1e-9 && arrow.text === "55 %", arrow);
// a saved opacity of 0.4 (a saved page, a share link) is the one the plane draws, and the slider shows it
await openPopover(0.4);
const sl4 = await ev(`(() => { const r = document.querySelector('.opts-pop input.sv-opacity'); return { v: +r.value, text: r.getAttribute('aria-valuetext') }; })()`);
await settled({ max: 60000, until: `__cmwSvFixed() && (() => { const g = __cmwPaneStatus('L'); return !!g && !g.pending && !g.compiling; })()` });
const saved4 = await read();
info.saved4 = saved4;
ok('a saved opacity of 0.4 shows in the slider as 40 %', Math.abs(sl4.v - 0.4) < 1e-9 && sl4.text === '40 %', sl4);
ok('and changes the plane\'s pixels from the default 85 % where the picture covers a point three times', !!saved4.three && !!mid.three && diff(saved4.three, mid.three) >= 3, info);
ok('and from 100 %', !!saved4.three && diff(saved4.three, full.three) >= 3, info);
ok('and leaves a point covered once as it was', !!saved4.one && diff(saved4.one, full.one) === 0, info);
// the Landscape draws its sheets opaque: the slider stays, disabled, its tip saying so
await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); 1`);
await settled({ floor: 300 });
await ev(`__cmwSteps({ scope: 'all', surf: 'land', go: 0, now: true }); 1`);
await settled({ max: 30000, until: `!!document.querySelector('.pane-head .opts-btn[aria-label="Display options"]')` });
await ev(`document.querySelector('.pane-head .opts-btn[aria-label="Display options"]').click(); 1`);
await settled({ max: 15000, until: `!!document.querySelector('#popHost #opacityRange')` });
const land = await ev(`(() => { const r = document.querySelector('#popHost #opacityRange'); const a = document.getElementById('alphaRange'); return r && { disabled: r.disabled, aria: r.getAttribute('aria-disabled'), tip: r.closest('label').dataset.tip, desc: r.getAttribute('aria-description'), rowOpacity: getComputedStyle(r.closest('label')).opacity, cursor: getComputedStyle(r.closest('label')).cursor, regionsRowHidden: a.closest('.fader-row').hidden }; })()`);
ok('on the Landscape the slider is disabled, with a tip that says why', !!land && land.disabled && land.aria === 'true' && /opaque/.test(land.tip), land);
ok('the whole disabled row is dimmed (cursor default) and the input carries the reason as aria-description', !!land && land.rowOpacity === '0.4' && land.cursor === 'default' && land.desc === land.tip, land);
ok('and the regions\' own Opacity row is left out of the steps view', !!land && land.regionsRowHidden, land);
return { pass: fails.length === 0, fails, info };
