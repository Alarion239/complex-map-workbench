// The steps view's Opacity slider (colour popover of a plane past the colour plane): z³ on a disc about 0, on plane z³,
// covers each w in the disc three times and a small disc about 1.4 once.
// - the slider is a range input of 30 to 100 % in steps of 5, at 85 % by default, with aria-valuetext "85 %", and the
//   setting is saved with the page state;
// - a point covered three times shows another colour at 85 % and at 50 % than at 100 % (the layers behind show through),
//   and 85 % differs from 50 %;
// - a point covered once is pixel-identical at 100 %, 85 % and 50 %;
// - the slider works from the keyboard (the arrow keys move it by one step).
// Inside regions, so that only the shapes' images are coloured (Everywhere covers every w three times).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const ns = 'svop' + Date.now();
const st = { v3: true, v4: true, v5: true, v6: true,
  shapes: [{ id: 's2', kind: 'disc', c: [0, 0], r: 1, ci: 0, visible: true }, { id: 's3', kind: 'disc', c: [1.4, 0], r: 0.3, ci: 1, visible: true }],
  steps: [{ type: 'pown', params: { n: 3 }, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 80 } };
const { lpx } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'carry_kit.js'), 'utf8'));
await view(1200, 800, false, false);
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
await ev(`document.querySelector('.pane-head .pat-btn').click(); 1`);
await settled({ floor: 400 });
const slider = await ev(`(() => { const r = document.querySelector('.cp-pop input[type=range]'); return r && { min: r.min, max: r.max, step: r.step, value: r.value, text: r.getAttribute('aria-valuetext'), label: r.getAttribute('aria-label') }; })()`);
ok('the popover holds the Opacity range, 30 to 100 in steps of 0.05, at 0.85 with valuetext "85 %"',
  !!slider && slider.min === '0.3' && slider.max === '1' && slider.step === '0.05' && +slider.value === 0.85 && slider.text === '85 %' && slider.label === 'Opacity', slider);
const setOpacity = async (v) => {
  await ev(`(() => { const r = document.querySelector('.cp-pop input[type=range]'); r.value = ${v}; r.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
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
const live = await ev(`__cmwRegions().alpha`);
await settled({ max: 10000, until: `JSON.parse(localStorage.getItem('complex-map-workbench-v1:${ns}') || '{}').alpha === 0.5` });
const saved = await ev(`JSON.parse(localStorage.getItem('complex-map-workbench-v1:${ns}') || '{}').alpha`);
ok('the setting is the page state\'s alpha and is saved with it', live === 0.5 && saved === 0.5, { live, saved });
await ev(`document.querySelector('.cp-pop input[type=range]').focus(); 1`);
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
const arrow = await ev(`(() => { const r = document.querySelector('.cp-pop input[type=range]'); return { v: +r.value, text: r.getAttribute('aria-valuetext') }; })()`);
ok('the right arrow moves the slider one step, valuetext 55 %', Math.abs(arrow.v - 0.55) < 1e-9 && arrow.text === "55 %", arrow);
return { pass: fails.length === 0, fails, info };
