// Chain editing on the steps view's thread (#437, behind ?view=steps): each chip has a ⋯ with the step's menu (Open in the
// Inspector, Show alone, Bypass, Move, Duplicate, Insert, Replace…, Remove); a bypassed step is a dashed chip; "+ Add
// function" ends the thread; the empty chain shows it alone; Alt ←/→ and Delete act on a focused chip; the focus lands
// where the spec says; one Undo restores each change with the shown plane; the phone's long press opens the menu.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const settle = async (ms = 400) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const AXE = fs.readFileSync(path.join(DIR, '..', '..', 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');
// (axe on the thread: names, roles and nesting; colour contrast is the pictures' and is not run here)
const RULES = ['button-name', 'nested-interactive', 'aria-allowed-attr', 'aria-allowed-role', 'aria-valid-attr-value', 'aria-required-children', 'aria-required-parent', 'aria-prohibited-attr', 'aria-roles', 'label', 'scrollable-region-focusable', 'aria-hidden-focus'];
const axeRun = async (what) => {
  if (!(await ev("typeof axe !== 'undefined'"))) await ev(AXE + '\n;1');
  await ev(`(() => { window.__axe = null; axe.run(document.getElementById('paneL'), { runOnly: { type: 'rule', values: ${JSON.stringify(RULES)} } }).then((r) => { window.__axe = r.violations.map((v) => ({ id: v.id, n: v.nodes.length, t: v.nodes.slice(0, 2).map((x) => x.html.slice(0, 120)) })); }); 1; })()`);
  let r = null;
  for (let i = 0; i < 100 && !r; i++) { r = await ev('window.__axe'); if (!r) await sleep(100); }
  ok('axe: ' + what, r && r.length === 0, r);
};
const ns = 'svc' + Date.now();
const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'h1', kind: 'halfplane', a: [0, 0], b: [1, 0], ci: 0, visible: true }],
  steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, { type: 'pown', params: { n: 3 }, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } };
const open = async (w, h, mobile) => {
  await view(w, h, false, mobile);
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await sleep(300);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps` }); await sleep(3000); await settle(500);
};
const types = async () => ev(`__cmwP().steps.map((s) => s.type + (s.on === false ? '-' : ''))`);
const sv = () => ev('__cmwSteps()');
// where the keyboard is: 'chip2', 'more1', 'add', 'whole', or what else
const where = () => ev(`(() => { const a = document.activeElement; if (!a || a === document.body) return 'body'; if (a.classList.contains('sv-add')) return 'add'; if (a.classList.contains('sv-whole')) return 'whole';
  const s = a.closest('.sv-step'); return s ? (a.classList.contains('sv-more') ? 'more' : 'chip') + s.dataset.k : a.className || a.tagName; })()`);
const kb = (k, mods = {}) => ev(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key: ${JSON.stringify(k)}, bubbles: true, cancelable: true }, ${JSON.stringify(mods)}))); 1`);
const cl = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; e.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' })); e.click(); return true; })()`);
const menu = () => ev(`[...document.querySelectorAll('#popHost .menu .mi')].map((b) => b.querySelector('.mi-label').textContent)`);
const pick = async (label) => { const r = await ev(`(() => { const b = [...document.querySelectorAll('#popHost .menu .mi')].find((x) => x.querySelector('.mi-label').textContent === ${JSON.stringify(label)}); if (!b || b.disabled) return false; b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' })); b.click(); return true; })()`); await settle(350); return r; };
const undo = async () => { await ev(`document.getElementById('undoBtn').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); document.getElementById('undoBtn').click(); 1`); await settle(400); };
const toast = () => ev(`[...document.querySelectorAll('#toastHost .toast')].map((t) => t.textContent).join(' | ')`);


// ---- the desktop ----
await open(1280, 800, false);
const d0 = await ev(`({ more: document.querySelectorAll('#svStrip .sv-more').length, wraps: document.querySelectorAll('#svStrip .sv-fwrap').length, add: !!document.querySelector('#svStrip .sv-add'),
  moreLabel: document.querySelector('#svStrip .sv-more').getAttribute('aria-label'), haspop: document.querySelector('#svStrip .sv-more').getAttribute('aria-haspopup'), w: document.querySelector('#svStrip .sv-more').getBoundingClientRect().width })`);
ok('each step has a chip with a ⋯ (menu button) and the thread ends with + Add function', d0.more === 2 && d0.wraps === 2 && d0.add && d0.haspop === 'menu' && /More for f₁/.test(d0.moreLabel) && d0.w === 24, d0);
// the menu
await cl('#svStrip .sv-step[data-k="2"] .sv-more'); await settle(300);
const m = await menu();
const errs0 = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || '')).map((x) => x.m).slice(0, 5); ok('no errors so far', !errs0.length, errs0);
ok('the menu is named', await ev(`/f₂/.test(document.querySelector('#popHost .menu').getAttribute('aria-label') || '')`), null);
ok('the ⋯ menu: Open in the Inspector and Show alone first, Bypass beside the moves, no Deformation', m[0] === 'Open in the Inspector' && m[1] === 'Show alone' && m[2] === 'Bypass this step' && m[3] === 'Move left' && !m.includes('Deformation') && m[m.length - 1] === 'Remove', m);
await ev(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); 1`); await settle(300);
ok('Esc closes the menu and the keyboard is back on its ⋯', (await where()) === 'more2', await where());
// bypass: from the menu, the plane the view is on, one Undo
await ev(`__cmwSteps({ go: 2, now: true }); 1`); await settle(500);
ok('on w₂ before the bypass', (await sv()).i === 2, await sv());
await cl('#svStrip .sv-step[data-k="2"] .sv-more'); await settle(300);
await pick('Bypass this step');
let t = await types(), s1 = await sv();
const chip = await ev(`(() => { const w = document.querySelector('#svStrip .sv-step[data-k="2"] .sv-fwrap'), c = w.querySelector('.sv-fchip'); return { off: w.classList.contains('off'), label: c.getAttribute('aria-label'), dash: getComputedStyle(w).borderStyle, strike: getComputedStyle(w.querySelector('.sv-fn')).textDecorationLine }; })()`);
ok('Bypass: the step is off, its chip dashed and struck through, named "bypassed"', t.join() === 'mobius,pown-' && chip.off && /bypassed/.test(chip.label) && /dashed/.test(chip.dash) && /line-through/.test(chip.strike), [t, chip]);
ok('… the plane after it is gone from the thread and the view is on w₁', s1.planes.join() === '0,1' && s1.i === 1, s1);
ok('… a toast says so, and the focus stays on the ⋯', /Bypassed f₂ \(.*\)/.test(await toast()) && (await where()) === 'more2', [await toast(), await where()]);
await undo();
t = await types(); s1 = await sv();
ok('Undo turns it back on and puts the view back on w₂', t.join() === 'mobius,pown' && s1.i === 2 && s1.planes.join() === '0,1,2', [t, s1]);
await cl('#svStrip .sv-step[data-k="2"] .sv-more'); await settle(300); await pick('Bypass this step');
await cl('#svStrip .sv-step[data-k="2"] .sv-more'); await settle(300);
ok('a bypassed step\'s menu offers Turn this step back on', (await menu()).includes('Turn this step back on'), await menu());
await pick('Turn this step back on');
ok('… which turns it on, with a toast', (await types()).join() === 'mobius,pown' && /Turned f₂ back on/.test(await toast()), [await types(), await toast()]);
await undo(); await undo();
// move: Alt →, focus follows the step
await ev(`document.querySelector('#svStrip .sv-step[data-k="1"] .sv-fchip').focus(); 1`);
await kb('ArrowRight', { altKey: true }); await settle(400);
ok('Alt → on f₁ moves it, and its chip keeps the keyboard', (await types()).join() === 'pown,mobius' && (await where()) === 'chip2', [await types(), await where()]);
await undo();
ok('Undo moves it back', (await types()).join() === 'mobius,pown', await types());
// duplicate
await cl('#svStrip .sv-step[data-k="1"] .sv-more'); await settle(300); await pick('Duplicate');
ok('Duplicate adds a copy after it; the new chip has the keyboard', (await types()).join() === 'mobius,mobius,pown' && (await where()) === 'chip2', [await types(), await where()]);
await undo();
ok('Undo removes the copy', (await types()).length === 2, await types());
// insert after: the palette, then focus on the new chip
await cl('#svStrip .sv-step[data-k="1"] .sv-more'); await settle(300); await pick('Insert a function after it');
await ev(`(() => { const i = document.getElementById('palInput'); i.value = 'exponential'; i.dispatchEvent(new Event('input')); })()`); await settle(400);
await kb('Enter'); await settle(700);
ok('Insert after f₁ (palette): a step at f₂, the new chip has the keyboard', (await types()).length === 3 && (await where()) === 'chip2', [await types(), await where()]);
await undo();
// the shown plane stays when a step is added before it
await ev(`__cmwSteps({ go: 2, now: true }); 1`); await settle(400);
await cl('#svStrip .sv-step[data-k="1"] .sv-more'); await settle(300); await pick('Duplicate');
ok('a step added before the shown plane: the view stays on its plane (now w₃)', (await sv()).i === 3 && (await sv()).planes.length === 4, await sv());
await undo();
ok('Undo: back on w₂ of two steps', (await sv()).i === 2 && (await sv()).planes.length === 3, await sv());
// show alone, and back
await cl('#svStrip .sv-step[data-k="2"] .sv-more'); await settle(300); await pick('Show alone');
const al = await ev(`({ planes: __cmwSteps().planes, whole: !!document.querySelector('#svStrip .sv-whole'), steps: document.querySelectorAll('#svStrip .sv-step').length, add: !!document.querySelector('#svStrip .sv-add'), live: document.querySelector('#stage .sr-only[aria-live]').textContent })`);
ok('Show alone narrows the thread to w₁ — f₂ — w₂ with a Whole chain chip', al.planes.join() === '1,2' && al.whole && al.steps === 1 && !al.add && /Showing f₂ alone, from w₁ to w/.test(al.live), al);
ok('… and the keyboard is on Whole chain', (await where()) === 'whole', await where());
await kb('Escape'); await settle(500);
const bk = await sv();
ok('Esc brings the whole chain back, on w₂, the keyboard on f₂\'s chip', bk.planes.join() === '0,1,2' && bk.i === 2 && (await where()) === 'chip2', [bk, await where()]);
await cl('#svStrip .sv-step[data-k="1"] .sv-more'); await settle(300); await pick('Show alone');
await cl('#svStrip .sv-whole'); await settle(500);
ok('the Whole chain chip does the same', (await sv()).planes.length === 3 && (await sv()).i === 2, await sv());
// remove down to the empty chain: focus after each
await ev(`document.querySelector('#svStrip .sv-step[data-k="2"] .sv-fchip').focus(); 1`);
await kb('Delete'); await settle(400);
ok('Delete on f₂: removed, the keyboard on f₁\'s ⋯', (await types()).join() === 'mobius' && (await where()) === 'more1' && /Removed f₂/.test(await toast()), [await types(), await where(), await toast()]);
await ev(`document.querySelector('#svStrip .sv-step[data-k="1"] .sv-fchip').focus(); 1`);
await kb('Delete'); await settle(400);
const em = await ev(`({ n: __cmwP().steps.length, add: !!document.querySelector('#svStrip .sv-add'), msg: !document.querySelector('.sv-empty').hidden, text: document.querySelector('.sv-empty').textContent, prev: document.querySelector('.sv-prev').disabled, next: document.querySelector('.sv-next').disabled, speed: document.querySelector('.sv-speed').disabled, ring: document.querySelector('.sv-thumb').getAttribute('aria-disabled'), planes: __cmwSteps().planes.join() })`);
ok('the empty chain: the z dot and + Add function, ‹ › ring and speed off, the plane says what to do', em.n === 0 && em.add && em.msg && /Add a function to send z/.test(em.text) && em.prev && em.next && em.speed && em.ring === 'true' && em.planes === '0', em);
ok('the hint has a ground of its own (opaque), not bare text over the plot', await ev(`(() => { const b = getComputedStyle(document.querySelector('.sv-empty')); return b.backgroundColor !== 'rgba(0, 0, 0, 0)' && parseFloat(b.borderTopWidth) >= 1; })()`), null);
ok('the hint sits above the plane\'s centre, where a centred shape is', await ev(`(() => { const h = document.querySelector('.sv-empty').getBoundingClientRect(), p = document.getElementById('plotL').getBoundingClientRect(); return h.bottom < p.top + p.height / 2 - 20; })()`), await ev(`document.querySelector('.sv-empty').getBoundingClientRect().bottom`));
ok('… and the keyboard is on + Add function', (await where()) === 'add', await where());
await undo();
ok('Undo brings the last step back', (await types()).join() === 'mobius' && (await ev(`document.querySelector('.sv-empty').hidden`)), await types());
await undo();
ok('… and the one before (two steps, on w₂ as before)', (await types()).length === 2 && (await sv()).i === 2, [await types(), await sv()]);
// add from the empty chain
for (let i = 0; i < 2; i++) { await ev(`document.querySelector('#svStrip .sv-step[data-k="1"] .sv-fchip').focus(); 1`); await kb('Delete'); await settle(300); }
ok('both removed', (await types()).length === 0, await types());
await cl('#svStrip .sv-add'); await settle(400);
ok('+ Add function opens the palette', await ev(`!!document.querySelector('#popHost .palette')`), null);
await ev(`(() => { const i = document.getElementById('palInput'); i.value = 'sine'; i.dispatchEvent(new Event('input')); })()`); await settle(400);
await kb('Enter'); await settle(700);
ok('a function added from the empty chain: one chip, the keyboard on it, the empty message gone', (await types()).length === 1 && (await where()) === 'chip1' && await ev(`document.querySelector('.sv-empty').hidden`), [await types(), await where()]);
await axeRun('the thread with chips');
await cl('#svStrip .sv-step[data-k="1"] .sv-more'); await settle(300);
await axeRun('with a step\'s menu open');
await ev(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); 1`); await settle(200);
// the right-click and the keys
await ev(`document.querySelector('#svStrip .sv-step[data-k="1"] .sv-fchip').focus(); 1`);
await kb('F10', { shiftKey: true }); await settle(300);
ok('Shift+F10 on a chip opens its menu', (await menu()).includes('Show alone'), await menu());
await ev(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); 1`); await settle(200);
// bypassed, shown alone and empty
await cl('#svStrip .sv-step[data-k="1"] .sv-more'); await settle(300); await pick('Bypass this step');
await axeRun('a bypassed chip');
await cl('#svStrip .sv-step[data-k="1"] .sv-more'); await settle(300); await pick('Turn this step back on');
await cl('#svStrip .sv-step[data-k="1"] .sv-more'); await settle(300); await pick('Show alone');
await axeRun('a step shown alone');
await kb('Escape'); await settle(300);
await ev(`document.querySelector('#svStrip .sv-step[data-k="1"] .sv-fchip').focus(); 1`); await kb('Delete'); await settle(300);
await axeRun('the empty chain');
await undo();
// the thread fits its pane (+ Add function widens nothing), at 1024 and 1440, in English and Russian: the pane stays inside its
// column, and the strip's and the plane's controls are what a pointer finds at their centres
const fitCase = async (w, lang) => {
  await view(w, 800, false, false);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}fit${w}${lang}&lang=${lang}&view=steps` }); await sleep(3000); await settle(500);
  const r = await ev(`(() => {
    const L = document.getElementById('paneL').getBoundingClientRect(), st = document.getElementById('stage').getBoundingClientRect(), S = document.getElementById('svStrip'), sr = S.getBoundingClientRect();
    const hit = (sel) => { const e = document.querySelector(sel); if (!e) return sel + ': none'; const b = e.getBoundingClientRect(); if (!b.width) return sel + ': hidden'; const at = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return e === at || e.contains(at) ? null : sel + ': covered by ' + (at && (at.id || at.className)); };
    return { paneInside: L.right <= st.right + 0.5 && L.left >= st.left - 0.5, strip: S.scrollWidth <= S.clientWidth + 1, stripInPane: sr.right <= L.right + 0.5, docX: document.documentElement.scrollWidth <= window.innerWidth + 1, W: [L.left, L.right, st.left, st.right, sr.right, S.scrollWidth, S.clientWidth],
      add: (() => { const a = document.querySelector('#svStrip .sv-add').getBoundingClientRect(); return a.right <= sr.right - 0.5 && a.left >= sr.left; })(),
      hits: ['.sv-add', '.sv-next', '.sv-prev', '.sv-speed', '#leftZoomIn', '#leftFit'].map(hit).filter(Boolean) };
  })()`);
  ok(`${w}, ${lang}: the pane stays in its column and the strip fits it, + Add function whole`, r.paneInside && r.strip && r.stripInPane && r.docX && r.add, r);
  ok(`${w}, ${lang}: the strip's and the plane's controls are not covered`, r.hits.length === 0, r.hits);
};
for (const w of [1440, 1024]) for (const lang of ['en', 'ru']) {
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}fit${w}${lang}', ${JSON.stringify(JSON.stringify(st))}); 1`).catch(() => {});
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await sleep(300);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}fit${w}${lang}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await fitCase(w, lang);
}
// ---- the phone ----
await open(390, 844, true);
const ph = await ev(`({ more: getComputedStyle(document.querySelector('#svStrip .sv-more')).display, add: document.querySelector('#svStrip .sv-add').getBoundingClientRect().width, addH: document.querySelector('#svStrip .sv-add').getBoundingClientRect().height, name: document.querySelector('#svStrip .sv-add').getAttribute('aria-label'), chipH: document.querySelector('#svStrip .sv-fwrap').getBoundingClientRect().height, chipW: document.querySelector('#svStrip .sv-fwrap').getBoundingClientRect().width, btnH: document.querySelector('#svStrip .sv-fchip').getBoundingClientRect().height, btnW: document.querySelector('#svStrip .sv-fchip').getBoundingClientRect().width })`);
ok('on a phone: no ⋯ on the chips, "+" is 44 px and named Add function', ph.more === 'none' && ph.add === 44 && ph.addH === 44 && /Add function/.test(ph.name) && ph.chipH >= 44 && ph.chipW >= 44 && ph.btnH >= 44 && ph.btnW >= 44, ph);
// a tall menu raised by a long press does not take the lift that ends it, on short screens too
for (const [w, h] of [[390, 700], [740, 360], [360, 640], [360, 600]]) {
  await open(w, h, true);
  const before = (await types()).join();
  await ev(`(() => { const c = document.querySelector('#svStrip .sv-step[data-k="1"] .sv-fchip'), r = c.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    const ev1 = (type) => c.dispatchEvent(new PointerEvent(type, { pointerId: 11, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 }));
    window.__lp1 = () => { const t = document.elementFromPoint(x, y) || c; ev1('pointerup'); t.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y })); };
    window.__fin = { x, y }; ev1('pointerdown'); return 1; })()`);
  await sleep(520);
  // (the lift lands on whatever the menu put under the finger, whichever item that is: on Remove here, 70 ms after it opened)
  await ev(`(() => { const b = [...document.querySelectorAll('#popHost .menu .mi')].find((x) => x.querySelector('.mi-label').textContent === 'Remove'); if (!b) return 0; b.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch', bubbles: true })); b.click(); return 1; })()`);
  await sleep(300);
  ok(`${w}×${h}: a click on Remove in the first 450 ms after a long press raised the menu does nothing`, (await types()).join() === before && (await menu()).length > 0, [before, await types(), (await menu()).length]);
  await sleep(300);
  const menuUp = await menu();
  const clear = await ev(`(() => { const p = document.querySelector('#popHost .menu'); if (!p) return null; const r = p.getBoundingClientRect(), f = window.__fin; return !(f.x >= r.left && f.x <= r.right && f.y >= r.top && f.y <= r.bottom); })()`);
  await ev(`__lp1(); 1`); await settle(300);
  ok(`${w}×${h}: a long press opens the menu, and the lift that ends it activates nothing`, menuUp.length > 0 && (await types()).join() === before && (await menu()).length > 0, [menuUp.length, before, await types()]);
  // (the lift came 1 s after the press, well past 450 ms, and chose nothing; the next tap chooses)
  await sleep(500);
  await ev(`(() => { const b = [...document.querySelectorAll('#popHost .menu .mi')].find((x) => x.querySelector('.mi-label').textContent === 'Remove'); if (!b) return 0; b.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', pointerId: 12, bubbles: true })); b.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch', pointerId: 12, bubbles: true })); b.click(); return 1; })()`);
  await settle(300);
  ok(`${w}×${h}: a tap on Remove after the lift removes the step`, (await types()).join() === 'pown', await types());
  info['clear' + w + 'x' + h] = clear;
}
await open(390, 844, true);
// a tap on a chip opens the Inspector's sheet on a phone
await cl('#svStrip .sv-step[data-k="1"] .sv-fchip'); await settle(500);
ok('a tap on a chip opens the Inspector sheet on a phone', await ev(`typeof Phone !== 'undefined' && Phone.sheet() === 'edit'`), await ev(`Phone.sheet()`));
await open(390, 844, true);
await ev(`(() => { const c = document.querySelector('#svStrip .sv-step[data-k="2"] .sv-fchip'), r = c.getBoundingClientRect();
  window.__lp = (type) => c.dispatchEvent(new PointerEvent(type, { pointerId: 9, pointerType: 'touch', isPrimary: true, clientX: r.left + 10, clientY: r.top + 10, bubbles: true, cancelable: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 })); __lp('pointerdown'); return 1; })()`);
await sleep(700);
ok('a long press on a chip opens its menu', (await menu()).includes('Bypass this step'), await menu());
await ev(`__lp('pointerup'); 1`); await settle(600);
ok('… the release is not a tap on the chip (the menu stays, the Inspector not opened)', (await menu()).length > 0, await menu());
await pick('Bypass this step');
ok('… and Bypass from it works', (await types()).join() === 'mobius,pown-' && /Bypassed f₂/.test(await toast()), [await types(), await toast()]);
await undo();
ok('Undo on the phone restores it', (await types()).join() === 'mobius,pown', await types());
await cl('#svStrip .sv-add'); await settle(500);
ok('the phone\'s "+" opens the palette', await ev(`!!document.querySelector('#popHost .palette, .ph-sheet:not([hidden]) .palette')`), null);
info.checks = 'steps chain editing: desktop and phone';
return { pass: fails.length === 0, fails, info };
