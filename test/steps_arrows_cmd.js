// The steps view's ← → step the chain whenever a plane has focus, not only on the thread: with the plot's canvas focused the
// arrows go to the next and the previous plane; in a text field they stay the field's own. A command file for a CDP daemon
// (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'h1', kind: 'halfplane', a: [0, 0], b: [1, 0], ci: 0, visible: true }],
  steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, { type: 'pown', params: { n: 3 }, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } };
await view(1440, 900, false, false);
const ns = 'svar' + Date.now();
await seed(ns, st);
await go(`http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps`);
const idle = `__cmwSteps().on && !__cmwSteps().moving && !!document.querySelector('#paneL canvas')`;
await settled({ max: 30000, until: idle });
ok('the page is the steps view', await ev('!!__cmwSteps().on'), null);
const press = async (key, modifiers = 0) => { const p = { key, code: key, modifiers, windowsVirtualKeyCode: key === 'ArrowRight' ? 39 : 37 }; await send('Input.dispatchKeyEvent', { type: 'keyDown', ...p }); await send('Input.dispatchKeyEvent', { type: 'keyUp', ...p }); };
const at = () => ev('__cmwSteps().i');
const keyTo = async (key, i) => { await press(key); await settled({ max: 8000, only: true, until: `__cmwSteps().i === ${i} && !__cmwSteps().moving` }); return at(); };
// the plot has focus: its canvas
await ev(`(() => { const c = document.querySelector('#paneL canvas'); c.tabIndex = 0; c.focus(); })()`);
ok('a plane canvas has focus', await ev(`document.activeElement && document.activeElement.tagName === 'CANVAS'`), null);
const i0 = await at();
ok('→ on the focused plot steps to the next plane', (await keyTo('ArrowRight', i0 + 1)) === i0 + 1, [i0, await at()]);
ok('← on the focused plot steps back', (await keyTo('ArrowLeft', i0)) === i0, [i0, await at()]);
// sound on: the plane is the keyboard probe, whose arrows are Alt / Option + arrow; ← → still step the thread
await ev(`document.getElementById('soundBtn').click(), 1`);
await settled({ max: 8000, only: true, until: `document.getElementById('soundBtn').getAttribute('aria-pressed') === 'true' && !!document.querySelector('#paneL canvas[aria-keyshortcuts]')` });
ok('sound on makes the plane the keyboard probe, on Alt + the arrows', await ev(`!!document.querySelector('#paneL canvas[aria-keyshortcuts~="Alt+ArrowLeft"]')`), null);
await ev(`document.querySelector('#paneL canvas[aria-keyshortcuts]').focus(), 1`);
ok('→ on the sound probe plane steps to the next plane', (await keyTo('ArrowRight', i0 + 1)) === i0 + 1, [i0, await at()]);
ok('← on the sound probe plane steps back', (await keyTo('ArrowLeft', i0)) === i0, [i0, await at()]);
const heard = () => ev(`document.getElementById('sndLive').textContent`);
const h0 = await heard();
await press('ArrowRight', 1);
await settled({ max: 4000, until: '!__cmwSteps().moving' });
ok('Alt + → on the sound probe plane leaves the thread where it is', (await at()) === i0, await at());
ok('and starts the probe, which says where it is', (await heard()) !== h0 && /^Probe at the centre/.test(await heard()), [h0, await heard()]);
await ev(`document.getElementById('soundBtn').click(), 1`);
await settled({ max: 8000, only: true, until: `document.getElementById('soundBtn').getAttribute('aria-pressed') !== 'true'` });
// typing: a text field keeps its arrows
await ev(`(() => { const f = document.createElement('input'); f.id = 'zzField'; f.value = 'abc'; document.body.append(f); f.focus(); })()`);
await press('ArrowRight');
await settled({ max: 4000, until: '!__cmwSteps().moving' });
ok('→ in a text field leaves the thread where it is', (await at()) === i0, await at());
return { pass: fails.length === 0, fails, info };
