// The steps view's keys work on a Russian layout (ЙЦУКЕН): Л and Ь (the K and M keys) play and pause the thread, З (P) toggles
// Paths. Each key is sent as the browser sends it on that layout: a Cyrillic `key` and the physical `code`. A command file
// for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'h1', kind: 'halfplane', a: [0, 0], b: [1, 0], ci: 0, visible: true }],
  steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, { type: 'pown', params: { n: 3 }, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } };
await view(1440, 900, false, false);
await loadView('steps', 'svru' + Date.now(), st, { lang: 'en' });
const idle = `__cmwSteps().on && !__cmwSteps().moving && !!document.querySelector('#svStrip .sv-play') && !!document.querySelector('#svStrip .sv-paths')`;
await settled({ max: 30000, until: idle });
ok('the page is the steps view', await ev('!!__cmwSteps().on'), null);
await ev('document.activeElement && document.activeElement.blur(), 1');
// a key as the browser sends it on that layout; the caller waits on the state it changes
const press = async (k, code) => { const p = { key: k, code, modifiers: 0, windowsVirtualKeyCode: code.charCodeAt(3) }; await send('Input.dispatchKeyEvent', { type: 'keyDown', text: k, ...p }); await send('Input.dispatchKeyEvent', { type: 'keyUp', ...p }); };
const PLAY = `document.querySelector('#svStrip .sv-play').getAttribute('aria-label') === 'Pause'`;
const PATHS = `document.querySelector('#svStrip .sv-paths').getAttribute('aria-pressed')`;
// press a key, wait up to 5 s until the page's state is the one expected, then say whether it is
const keyTo = async (k, code, expr) => { await press(k, code); await settled({ max: 5000, only: true, until: expr }); return ev(expr); };
ok('the thread is not playing at the start', !(await ev(PLAY)), null);
ok('Ь (KeyM) plays', await keyTo('ь', 'KeyM', PLAY), null);
ok('Ь again pauses', await keyTo('ь', 'KeyM', `!(${PLAY})`), null);
ok('Л (KeyK) plays', await keyTo('л', 'KeyK', PLAY), null);
ok('Л again pauses', await keyTo('л', 'KeyK', `!(${PLAY})`), null);
const p0 = await ev(PATHS);
ok('the Paths button is there and enabled', p0 !== null && !(await ev(`document.querySelector('#svStrip .sv-paths').disabled`)), p0);
ok('З (KeyP) toggles Paths', await keyTo('з', 'KeyP', `${PATHS} !== ${JSON.stringify(p0)}`), [p0, await ev(PATHS)]);
ok('З again toggles it back', await keyTo('з', 'KeyP', `${PATHS} === ${JSON.stringify(p0)}`), null);
return { pass: fails.length === 0, fails, info };
