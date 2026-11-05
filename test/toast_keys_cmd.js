// A message in the steps view: Esc closes it (unless a dialog or menu has the key), it stays 4 s, or 6 s with an action, its time
// stops while the pointer is over it or the focus is in it, it slides 8 px and fades over 150 ms in and out, and its × is 24 px.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
await view(1440, 900, false, false);
const ns = 'tkeys' + Date.now();
await seed(ns, { v3: true, v4: true, v5: true, v6: true, shapes: [], steps: [{ type: 'pown', params: { n: 2 }, on: true }], nextId: 5, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } });
await go(`http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps`);
await settled({ max: 30000, until: `__cmwSteps().on && !__cmwSteps().moving && typeof __cmwToast === 'function'` });
await ev('document.activeElement && document.activeElement.blur(), 1');
const T = `document.querySelector('#toastHost .toast')`;
const has = (extra = '') => ev(`!!${T}${extra}`);
const show = (msg, label, o) => ev(`(__cmwToast(${JSON.stringify(msg)}, ${label ? JSON.stringify(label) : 'null'}, ${JSON.stringify(o || {})}), 1)`);
const gone = async (ms) => { for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(50)) if (!(await has())) return true; return false; };
const press = async (k, code, vk, mods = 0) => { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, modifiers: mods, windowsVirtualKeyCode: vk }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, modifiers: mods, windowsVirtualKeyCode: vk }); };
// a lifetime: from the message's showing to its removal, in ms (the page measures it)
const life = async (msg, label, o, max) => {
  await ev(`(() => { window.__life = null; const h = document.getElementById('toastHost'), t0 = performance.now(); new MutationObserver((_, ob) => { if (!h.querySelector('.toast')) { window.__life = performance.now() - t0; ob.disconnect(); } }).observe(h, { childList: true }); })()`);
  await show(msg, label, o);
  await settled({ max, only: true, until: 'window.__life !== null' });
  return ev('window.__life');
};

// the slide and fade
await show('Hello');
ok('a message is shown', await has(), null);
ok('it enters with the 150 ms slide and fade', JSON.stringify(await ev(`(() => { const s = getComputedStyle(${T}); return [s.animationName, s.animationDuration]; })()`)) === '["toast-in","0.15s"]', await ev(`getComputedStyle(${T}).animationName`));
await press('Escape', 'Escape', 27);
ok('Esc starts its exit (the slide and fade out)', await ev(`(() => { const t = ${T}; return !t || (t.classList.contains('toast-out') && getComputedStyle(t).animationName === 'toast-out'); })()`), null);
ok('Esc closes the message', await gone(1000), null);

// Esc is a dialog's or a menu's first
await show('Kept', null, { ms: 20000 });
await press('k', 'KeyK', 75, 4); await settled({ max: 4000, only: true, until: `!!document.querySelector('#popHost .palette, .pop.palette')` });
ok('the palette opens over the message', await ev(`!!document.querySelector('#popHost .palette, .pop.palette')`), null);
await press('Escape', 'Escape', 27); await settled({ max: 4000, only: true, until: `!document.querySelector('#popHost .palette, .pop.palette')` });
ok('Esc closes the palette and keeps the message', (await has()) && !(await ev(`!!document.querySelector('#popHost .palette, .pop.palette')`)), null);
await press('Escape', 'Escape', 27);
ok('the next Esc closes the message', await gone(1000), null);

// how long it stays
const plain = await life('Plain', null, {}, 8000), act = await life('With action', 'Do', {}, 10000);
info.life = { plain, act };
ok('a message without an action stays 4 s', plain !== null && plain >= 3900 && plain <= 4900, plain);
ok('a message with an action stays 6 s', act !== null && act >= 5900 && act <= 6900, act);

// the time stops over the message and while the focus is in it
await show('Hover', 'Do', { ms: 1500 });
const c = await ev(`(() => { const r = ${T}.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c[0], y: c[1] });
await sleep(2600);
ok('the pointer over it keeps it past its time', await has(), null);
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 });
ok('it goes after the pointer leaves', await gone(4000), null);
await show('Focus', 'Do', { ms: 1500 });
await ev(`${T}.querySelector('.toast-act').focus(), 1`);
await sleep(2600);
ok('the focus in it keeps it past its time', await has(), null);
await ev(`document.activeElement.blur(), 1`);
ok('it goes after the focus leaves', await gone(4000), null);

// the close button, on a timed message too
await show('Timed', 'Do');
const xt = await ev(`(() => { const b = ${T}.querySelector('.toast-x'); if (!b) return null; const r = b.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })()`);
ok('a timed message has a × of 24 px', JSON.stringify(xt) === '[24,24]', xt);
await ev(`${T}.querySelector('.toast-x').click(), 1`);
ok('× closes it with the slide and fade out', await ev(`(() => { const t = ${T}; return !t || (t.classList.contains('toast-out') && getComputedStyle(t).animationName === 'toast-out'); })()`), null);
ok('and it is gone', await gone(1000), null);
await show('Action', 'Do');
await ev(`${T}.querySelector('.toast-act').click(), 1`);
ok('its action leaves with the slide and fade out too', await ev(`(() => { const t = ${T}; return !t || t.classList.contains('toast-out'); })()`), null);
await gone(1000);
await show('Sticky', null, { sticky: true });
const x = await ev(`(() => { const b = ${T}.querySelector('.toast-x'); if (!b) return null; const r = b.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })()`);
ok('× is 24 px', JSON.stringify(x) === '[24,24]', x);
await ev(`${T}.querySelector('.toast-x').click(), 1`);
ok('× closes it', await gone(1000), null);
return { pass: fails.length === 0, fails, info };
