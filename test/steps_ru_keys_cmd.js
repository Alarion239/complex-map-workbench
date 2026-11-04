// The steps view's keys work on a Russian layout (ЙЦУКЕН): Л and Ь (the K and M keys) start a play of the thread, З (P) toggles
// Paths. Each key is sent as the browser sends it on that layout: a Cyrillic `key` and the physical `code`. A command file
// for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'h1', kind: 'halfplane', a: [0, 0], b: [1, 0], ci: 0, visible: true }],
  steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, { type: 'pown', params: { n: 3 }, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } };
await view(1440, 900, false, false);
const ns = 'svru' + Date.now();
await seed(ns, st);
await go(`http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps`);
const idle = `__cmwSteps().on && !__cmwSteps().moving && !!document.querySelector('#svStrip .sv-play') && !!document.querySelector('#svStrip .sv-paths')`;
await settled({ max: 30000, until: idle });
ok('the page is the steps view', await ev('!!__cmwSteps().on'), null);
await ev('document.activeElement && document.activeElement.blur(), 1');
// a key as the browser sends it on that layout; the caller waits on the state it changes
const press = async (k, code) => { const p = { key: k, code, modifiers: 0, windowsVirtualKeyCode: code.charCodeAt(3) }; await send('Input.dispatchKeyEvent', { type: 'keyDown', text: k, ...p }); await send('Input.dispatchKeyEvent', { type: 'keyUp', ...p }); };
const PATHS = `document.querySelector('#svStrip .sv-paths').getAttribute('aria-pressed')`;
// A play on a short thread ends within a few frames, so the page counts the times the Play button's label turns to Pause
// (a MutationObserver) instead of the suite reading the label at a moment
await ev(`(() => { const b = document.querySelector('#svStrip .sv-play'); window.__starts = 0; let was = b.getAttribute('aria-label'); new MutationObserver(() => { const n = b.getAttribute('aria-label'); if (n !== was && n === 'Pause') window.__starts++; was = n; }).observe(b, { attributes: true, attributeFilter: ['aria-label'] }); })(), 1`);
// press a key, wait up to 5 s until the page's state is the one expected, then say whether it is
const keyTo = async (k, code, expr) => { await press(k, code); await settled({ max: 5000, only: true, until: expr }); return ev(expr); };
ok('the thread has not played at the start', (await ev('window.__starts')) === 0, null);
ok('Ь (KeyM) plays', await keyTo('ь', 'KeyM', 'window.__starts >= 1'), await ev('window.__starts'));
await settled({ max: 20000, until: idle });
ok('Л (KeyK) plays', await keyTo('л', 'KeyK', 'window.__starts >= 2'), await ev('window.__starts'));
await settled({ max: 20000, until: idle });
const p0 = await ev(PATHS);
ok('the Paths button is there and enabled', p0 !== null && !(await ev(`document.querySelector('#svStrip .sv-paths').disabled`)), p0);
ok('З (KeyP) toggles Paths', await keyTo('з', 'KeyP', `${PATHS} !== ${JSON.stringify(p0)}`), [p0, await ev(PATHS)]);
ok('З again toggles it back', await keyTo('з', 'KeyP', `${PATHS} === ${JSON.stringify(p0)}`), null);
return { pass: fails.length === 0, fails, info };
