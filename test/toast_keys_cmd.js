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

// over a dialog its × is no target: the export dialog's More formats button lies under it
await press('e', 'KeyE', 69, 4); await settled({ max: 20000, only: true, until: `!!document.querySelector('.modal-bg #xfMore')` });
await show('Saved strip.png.', null, { ms: 60000 });
const under = await ev(`(() => { const x = ${T}.querySelector('.toast-x').getBoundingClientRect(), e = document.elementFromPoint(x.left + x.width / 2, x.top + x.height / 2); return e && e.closest('.toast-x') ? 'x' : e && e.closest('#xfMore') ? 'more' : e && e.tagName; })()`);
const dlg = await ev(`(() => { const t = ${T}, r = t.getBoundingClientRect(), host = document.getElementById('toastHost'); const hit = [...document.querySelector('.modal-bg').querySelectorAll('button, a[href], input, select, textarea, [tabindex]')].filter((c) => { const b = c.getBoundingClientRect(); return b.width > 0 && b.right > r.left && b.left < r.right && b.bottom > r.top && b.top < r.bottom; }).length; return { live: host.hasAttribute('data-clear-of-dialog'), over: hit }; })()`);
ok('a message is live over a dialog exactly where it lies clear of the dialog\'s controls', dlg.live === (dlg.over === 0), dlg);
info.dialog = dlg;
ok('over a dialog a message\'s × leaves the click to what lies under it', under !== 'x' || dlg.live, under);
await press('Escape', 'Escape', 27); await settled({ max: 5000, only: true, until: `!document.querySelector('.modal-bg')` });
await ev(`document.getElementById('toastHost').innerHTML = '', 1`);
// a dialog that opens under a message that is already up decides its liveness too
await show('Up first', null, { ms: 60000 });
await press('e', 'KeyE', 69, 4); await settled({ max: 20000, only: true, until: `!!document.querySelector('.modal-bg #xfMore')` });
const LIVE = `(() => { const t = document.querySelector('#toastHost .toast'), r = t.getBoundingClientRect(), host = document.getElementById('toastHost'); const over = [...document.querySelector('.modal-bg').querySelectorAll('button, a[href], input, select, textarea, [tabindex]')].filter((c) => { const b = c.getBoundingClientRect(); return b.width > 0 && b.right > r.left && b.left < r.right && b.bottom > r.top && b.top < r.bottom; }).length; return { live: host.hasAttribute('data-clear-of-dialog'), over }; })()`;
await settled({ max: 3000, only: true, until: `(() => { const d = ${LIVE}; return d.live === (d.over === 0); })()` });
const dlg2 = await ev(LIVE);
ok('a dialog opened under a message sets its liveness', dlg2.live === (dlg2.over === 0), dlg2);
await press('Escape', 'Escape', 27); await settled({ max: 5000, only: true, until: `!document.querySelector('.modal-bg')` });
ok('and the dialog closing clears it', !(await ev(`document.getElementById('toastHost').hasAttribute('data-clear-of-dialog')`)), null);
await ev(`document.getElementById('toastHost').innerHTML = '', 1`);

// a press on the words closes it; a press on its action does not (the action runs)
await show('Press the words', 'Do');
await ev(`(() => { const r = ${T}.querySelector('span').getBoundingClientRect(); window.__px = [r.left + r.width / 2, r.top + r.height / 2]; })()`);
const px = await ev('window.__px');
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: px[0], y: px[1], button: 'left', clickCount: 1 });
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: px[0], y: px[1], button: 'left', clickCount: 1 });
ok('a press on the words closes it', await gone(1000), null);
// its words wrap and nothing is cut: a long message is shown whole
await show('A longer message than the room for it one line wide, so that it needs a second line to say all of it here and a third and a fourth to say the rest of it, none of which is cut', null, { ms: 60000 });
const wr = await ev(`(() => { const e = ${T}.querySelector('span'), cs = getComputedStyle(e); return { cutY: e.scrollHeight - e.clientHeight, cutX: e.scrollWidth - e.clientWidth, ellipsis: cs.textOverflow, clamp: cs.webkitLineClamp, lines: Math.round(e.getBoundingClientRect().height / (parseFloat(cs.lineHeight) || 18)) }; })()`);
ok('a long message wraps whole, nothing cut', wr.cutY <= 0 && wr.cutX <= 0 && wr.clamp === 'none' && wr.lines >= 2, wr);
// the same in Russian at 1024 px wide: the words are shown whole
await view(1024, 768, false, false);
await settled({ max: 5000, only: true, until: `typeof __cmwToast === 'function'` });
await show('Добавлен шаг f₃: Экспонента. Показан отдельно от остальных шагов цепочки, чтобы сообщение заняло несколько строк и ни одно слово не было обрезано', 'Отменить', { ms: 60000 });
await settled({ max: 3000, only: true, until: `!!${T}` });
const wru = await ev(`(() => { const e = ${T}.querySelector('span'); return { cutY: e.scrollHeight - e.clientHeight, cutX: e.scrollWidth - e.clientWidth, w: innerWidth }; })()`);
ok('a long Russian message at 1024 is shown whole', wru.cutY <= 0 && wru.cutX <= 0, wru);
await ev(`document.getElementById('toastHost').innerHTML = '', 1`);

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
