// The steps view's Repeat control (#645, behind ?view=steps): the classic bracket lives in the pipeline row, which the steps view
// hides, so N is set where the steps view edits a step:
// - a chip's ⋯ → Repeat → "This step, twice" (or "f₂–f₃, twice") sets a repeat, N = 2, and puts the keyboard in the N field of the
//   Inspector's Repeat row;
// - the row ("Repeat − N +", End the repeat) is shown for a step in a repeated block, and for no other; − and + and the arrow keys
//   step N, a typed number sets it, and End the repeat ends it; each change is one undo;
// - the block shows on the thread: its chips carry a rule and the last one the count, ×N; the planes stay the chain's;
// - an old save with a repeat opens with the badge and the row; the phone's Edit sheet carries the same row, at touch size;
// - the row's words are translated (ru, it).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const ns = 'svr' + Date.now();
const mk = (rep) => ({ v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 's2', kind: 'circle', c: [0.3, 0.2], r: 0.8, ci: 0, visible: true }],
  steps: [{ type: 'exp', params: {}, on: true }, Object.assign({ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, rep ? { repeat: rep } : {}), { type: 'pown', params: { n: 3 }, on: true }],
  nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } });
const open = async (w, h, touch, lang, st) => {
  await view(w, h, false, touch);
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await settled({ panes: false });
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}&lang=${lang}&view=steps` });
  await settled({ max: 30000, until: `typeof __cmwSteps === 'function' && document.querySelectorAll('#svStrip .sv-step').length === 3` });
};
const rep = (k) => ev(`__cmwP().steps[${k - 1}].repeat || null`);
const planes = () => ev(`__cmwSteps().planes.length`);
const badges = () => ev(`[...document.querySelectorAll('#svStrip .sv-step')].map((s) => { const b = s.querySelector('.sv-rep'); return [s.dataset.k, b ? b.textContent : '', s.querySelector('.sv-fwrap').className]; })`);
const row = () => ev(`(() => { const r = document.querySelector('.insp-repeat'); if (!r || r.hidden || !r.getClientRects().length) return null; const f = r.querySelector('.rep-n'), b = [...r.querySelectorAll('button')];
  return { n: f.value, label: f.getAttribute('aria-label'), range: r.querySelector('.rep-range').textContent, less: b[0].disabled, more: b[1].disabled, end: b[2].textContent, focus: document.activeElement === f, h: b.map((x) => Math.round(x.getBoundingClientRect().height)) }; })()`);
const press = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; e.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' })); e.click(); return true; })()`);
const pickItem = (label) => ev(`(() => { const b = [...document.querySelectorAll('#popHost .menu .mi')].find((x) => x.querySelector('.mi-label').textContent === ${JSON.stringify(label)}); if (!b || b.disabled) return false; b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' })); b.click(); return true; })()`);
const undo = async () => { await press('#undoBtn'); await settled({}); };
const kb = (k) => ev(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(k)}, bubbles: true, cancelable: true })); 1`);
const typeN = async (text) => { await ev(`(() => { const f = document.querySelector('.insp-repeat .rep-n'); f.focus(); f.value = ${JSON.stringify(text)}; f.dispatchEvent(new Event('change', { bubbles: true })); return 1; })()`); await settled({}); };

// ---- the desktop: set a repeat from the chip's ⋯ ----
await open(1280, 800, false, 'en', mk(null));
const p0 = await planes();
ok('no repeat: no badge, no Inspector row for a step', (await badges()).every((b) => !b[1]) && !(await row()), await badges());
await press('#svStrip .sv-step[data-k="2"] .sv-more');
await settled({ panes: false, until: `!!document.querySelector('#popHost .menu')` });
await pickItem('Repeat');
await settled({ panes: false, until: `[...document.querySelectorAll('#popHost .menu .mi')].some((x) => x.querySelector('.mi-label').textContent === 'This step, twice')` });
await pickItem('This step, twice');
await settled({ until: `!!document.querySelector('.insp-repeat .rep-n') && document.activeElement === document.querySelector('.insp-repeat .rep-n')` });
const r1 = await row();
ok('⋯ → Repeat → This step, twice sets N = 2 on step 2', JSON.stringify(await rep(2)) === JSON.stringify({ n: 2, len: 1 }), await rep(2));
ok('… the Inspector\'s row shows N = 2, its name, End the repeat, and holds the keyboard in the N field', r1 && r1.n === '2' && r1.label === 'Repeat f₂: times' && r1.end === 'End the repeat' && r1.focus, r1);
const b1 = await badges();
ok('… the block is on the thread: ×2 on step 2, no mark on the others', b1[1][1] === '×2' && !b1[0][1] && !b1[2][1] && /\brep\b/.test(b1[1][2]) && !/\brep\b/.test(b1[0][2]), b1);
ok('… the planes are the chain\'s as before', (await planes()) === p0, [p0, await planes()]);

// ---- change N: +, −, the arrow keys, a typed number ----
await press('.insp-repeat .rep-ctl button:last-of-type');
await settled({});
ok('+ makes N = 3 (the state, the field, the badge)', (await rep(2)).n === 3 && (await row()).n === '3' && (await badges())[1][1] === '×3', [await rep(2), await row()]);
await ev(`document.querySelector('.insp-repeat .rep-n').focus(); 1`);
await kb('ArrowUp'); await settled({});
ok('ArrowUp in the field steps N to 4', (await rep(2)).n === 4 && (await row()).n === '4', await rep(2));
await typeN('5');
ok('a typed 5 sets N = 5', (await rep(2)).n === 5 && (await badges())[1][1] === '×5', await rep(2));
await typeN('0');
ok('a typed 0 is no N: the field goes back to 5', (await rep(2)).n === 5 && (await row()).n === '5', [await rep(2), await row()]);
await press('.insp-repeat .rep-ctl button:first-of-type'); await settled({});
ok('− makes N = 4', (await rep(2)).n === 4, await rep(2));
ok('N = 3 on the way: the planes are still the chain\'s', (await planes()) === p0, await planes());

// ---- undo restores each change ----
await undo();
ok('undo: N is 5 again', (await rep(2)).n === 5, await rep(2));
await undo();
ok('undo: N is 4 again (the typed 5 was one change)', (await rep(2)).n === 4, await rep(2));
await undo(); await undo();
ok('undo ×2: N is 2, the badge ×2', (await rep(2)).n === 2 && (await badges())[1][1] === '×2', [await rep(2), await badges()]);

// ---- N = 3 exactly, saved, then ended ----
await press('.insp-repeat .rep-ctl button:last-of-type'); await settled({});
await settled({ floor: 500 });   // (the page saves 300 ms after a change)
const saved = await ev(`(() => { const o = JSON.parse(localStorage.getItem('complex-map-workbench-v1:${ns}') || 'null'); return o && o.steps[1].repeat; })()`);
ok('N = 3 is in the saved state', (await rep(2)).n === 3 && saved && saved.n === 3 && saved.len === 1, [await rep(2), saved]);
await press('.insp-repeat .rep-end'); await settled({});
ok('End the repeat: no repeat on the step, no badge, no row', (await rep(2)) === null && (await badges()).every((b) => !b[1]) && !(await row()), [await rep(2), await badges()]);
await undo();
ok('undo restores the repeat, N = 3, with its badge and row', (await rep(2)).n === 3 && (await badges())[1][1] === '×3' && (await row()).n === '3', [await rep(2), await badges()]);

// ---- a menu with one choice has no submenu: the item acts at once (step 1 can only repeat itself) ----
await press('.insp-repeat .rep-end'); await settled({});
await press('#svStrip .sv-step[data-k="1"] .sv-more');
await settled({ panes: false, until: `!!document.querySelector('#popHost .menu')` });
const labels1 = await ev(`[...document.querySelectorAll('#popHost .menu .mi')].map((x) => [x.querySelector('.mi-label').textContent, !!x.querySelector('.mi-sub, .mi-chev, .mi-arrow')])`);
await pickItem('Repeat…');
await settled({ until: `!!document.querySelector('.insp-repeat .rep-n') && document.activeElement === document.querySelector('.insp-repeat .rep-n')` });
ok('step 1\'s ⋯ offers Repeat… as one item (no submenu of one), and it sets N = 2 on step 1 with the keyboard in the N field', labels1.some((l) => l[0] === 'Repeat…') && !labels1.some((l) => l[0] === 'Repeat') && JSON.stringify(await rep(1)) === JSON.stringify({ n: 2, len: 1 }) && (await row()).focus, { labels1, r: await rep(1) });
await settled({ floor: 600 });   // (a menu is not raised again within 500 ms of the last)
await press('#svStrip .sv-step[data-k="1"] .sv-more');
await settled({ panes: false, until: `[...document.querySelectorAll('#popHost .menu .mi')].some((x) => x.querySelector('.mi-label').textContent === 'End the repeat')` });
const own = await ev(`[...document.querySelectorAll('#popHost .menu .mi')].map((x) => x.querySelector('.mi-label').textContent).filter((t) => /^(Repeat…?|End the repeat)$/.test(t))`);
ok('a step in a repeated block: Repeat… and End the repeat are two items of the menu', JSON.stringify(own) === JSON.stringify(['Repeat…', 'End the repeat']), own);
await pickItem('End the repeat'); await settled({});
ok('End the repeat from the menu ends it', (await rep(1)) === null, await rep(1));

// ---- a block of two steps ----
await press('.insp-repeat .rep-end'); await settled({});
await press('#svStrip .sv-step[data-k="3"] .sv-more');
await settled({ panes: false, until: `!!document.querySelector('#popHost .menu')` });
await pickItem('Repeat');
await settled({ panes: false, until: `[...document.querySelectorAll('#popHost .menu .mi')].some((x) => /^f.–f., twice$/.test(x.querySelector('.mi-label').textContent))` });
const two = await ev(`[...document.querySelectorAll('#popHost .menu .mi')].map((x) => x.querySelector('.mi-label').textContent).find((t) => /^f.–f., twice$/.test(t))`);
await pickItem(two);
await settled({ until: `!!document.querySelector('.insp-repeat .rep-n')` });
const b2 = await badges(), r2 = await row();
ok('f₂–f₃, twice: a block of two steps, N = 2', (await rep(3)) && (await rep(3)).len === 2 && (await rep(3)).n === 2, await rep(3));
ok('… the count is on the last chip only, the rule on both; the row names the range', b2[2][1] === '×2' && !b2[1][1] && /\brep\b/.test(b2[1][2]) && /\brep\b/.test(b2[2][2]) && r2 && /f₂–f₃/.test(r2.range) && /f₂–f₃/.test(r2.label), { b2, r2 });
await press('#svStrip .sv-step[data-k="1"] .sv-fchip'); await settled({});
ok('a step outside the block has no Repeat row', !(await row()), await row());

// ---- an old save with a repeat: the badge and the row; a shared number's name (its slider runs the passes) ----
await open(1280, 800, false, 'en', mk({ n: 3, len: 1 }));
const bo = await badges();
await press('#svStrip .sv-step[data-k="2"] .sv-fchip'); await settled({});
const ro = await row();
ok('a save with a repeat opens with ×3 on the chip and N = 3 in the row', bo[1][1] === '×3' && ro && ro.n === '3', { bo, ro });
ok('at N = 3 both steppers are enabled; at the limits they are off', ro && !ro.less && !ro.more, ro);
await typeN('1'); await settled({});
ok('N = 1 turns − off', (await row()).less === true, await row());

// ---- translated ----
for (const lang of ['ru', 'it']) {
  await open(1280, 800, false, lang, mk({ n: 3, len: 1 }));
  await press('#svStrip .sv-step[data-k="2"] .sv-fchip'); await settled({});
  const t = await row();
  ok(`${lang}: the row's End the repeat and its field's name are translated`, t && t.end !== 'End the repeat' && !/^Repeat/.test(t.label), t);
}

// ---- the phone: the Edit sheet carries the row, at touch size ----
await open(390, 844, true, 'en', mk({ n: 3, len: 1 }));
await press('#svStrip .sv-step[data-k="2"] .sv-fchip');
await settled({ until: `!!document.querySelector('.insp-repeat') && document.querySelector('.insp-repeat').getClientRects().length > 0` });
const rp = await row();
ok('phone: the Edit sheet has the Repeat row with N = 3 and its buttons 44 px tall', rp && rp.n === '3' && rp.h.every((x) => x >= 44), rp);
return { pass: fails.length === 0, fails, info };
