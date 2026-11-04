// The steps view's keys work on a Russian layout (ЙЦУКЕН): Л and Ь (the K and M keys) play and pause the thread, З (P) toggles
// Paths. Each key is sent as the browser sends it on that layout: a Cyrillic
// `key` and the physical `code`. A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const ns = 'svru' + Date.now();
const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'h1', kind: 'halfplane', a: [0, 0], b: [1, 0], ci: 0, visible: true }],
  steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, { type: 'pown', params: { n: 3 }, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } };
await view(1440, 900, false, false);
await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await sleep(300);
await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps` });
await settled({ max: 30000, until: `typeof __cmwSteps === 'function' && __cmwSteps().on` });
await settle(1500);
ok('the page is the steps view', await ev('__cmwSteps().on'), null);
await ev('document.activeElement && document.activeElement.blur(), 1');
const press = async (k, code) => { const vk = code.charCodeAt(3); await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, modifiers: 0, windowsVirtualKeyCode: vk, text: k }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, modifiers: 0 }); await sleep(300); };
// (the label follows the key by a frame or more on a software renderer: it is read for up to 3 s until it is the one asked)
const playing = async (want = true) => { let on = false; for (let i = 0; i < 30; i++) { on = await ev(`document.querySelector('#svStrip .sv-play').getAttribute('aria-label') === 'Pause'`); if (on === want) break; await sleep(100); } return on; };
const pathsOn = () => ev(`document.querySelector('#svStrip .sv-paths').getAttribute('aria-pressed')`);
const pathsOk = await ev(`!!document.querySelector('#svStrip .sv-paths') && !document.querySelector('#svStrip .sv-paths').disabled`);
ok('the thread is not playing at the start', !(await playing(false)), null);
await press('ь', 'KeyM'); ok('Ь (KeyM) plays', await playing(), null);
await press('ь', 'KeyM'); ok('Ь again pauses', !(await playing(false)), null);
await press('л', 'KeyK'); ok('Л (KeyK) plays', await playing(), null);
await press('л', 'KeyK'); ok('Л again pauses', !(await playing(false)), null);
ok('the Paths button is there', pathsOk, null);
const p0 = await pathsOn();
await press('з', 'KeyP'); await settle(400); ok('З (KeyP) toggles Paths', (await pathsOn()) !== p0, [p0, await pathsOn()]);
await press('з', 'KeyP'); await settle(400); ok('З again toggles it back', (await pathsOn()) === p0, null);
return { pass: fails.length === 0, fails, info };
