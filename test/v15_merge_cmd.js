// v15 merge of the desktop redesign (Inspector), the plane menu and the shared numbers (work/xva). Checks what joins
// them: the Parameters component sits in the Inspector's slot (one heading, no testing-only mount); the plane menu and
// the Inspector change the same zeros and poles (an add from the menu shows in the Inspector, the Inspector's × and
// the menu's Remove are each one undo step); the menu's "Edit ζ₁" opens the step in the Inspector (the temporary one
// when the panel is hidden) with the field focused; after an undo the Inspector edits the live step (its fields are
// rebuilt with the chain); renaming a number rewrites the Inspector's step field.
// A command file for a CDP daemon (test/cdp_kit README):
//   python3 build.py && test/<you>_cdp/q.sh test/v15_merge_cmd.js
// Prints {pass, fails, info, shots}; screenshots go to <daemon folder>/shots/v15m-*.png.
const fails = [], info = {}, shots = [];
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 400) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const exc = (l) => l.filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''));
const errs = [];
const grab = async () => { errs.push(...exc(await logs())); };
const H = (expr) => ev(`__cmwPlaneMenu().${expr}`);
const w2s = (side, re, im) => H(`w2s('${side}', ${re}, ${im})`);
const hist = () => H('hist()');
const undo = async () => { await ev(`document.getElementById('undoBtn').click()`); await settle(400); };
const menu = () => ev(`(() => { const p = document.querySelector('#popHost .pop.menu.pm'); if (!p) return null; return { items: [...p.querySelectorAll('.mi')].map((b) => ({ id: b.dataset.pm, text: b.textContent })) }; })()`);
const ids = (mm) => (mm ? mm.items.map((i) => i.id) : []);
const rclick = async (x, y) => {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'right', buttons: 2, clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'right', buttons: 0, clickCount: 1 });
  await settle(250);
};
const pick = async (id) => {
  const r = await ev(`(() => { const b = document.querySelector('#popHost .pop.menu.pm .mi[data-pm="${id}"]'); if (!b) return null; const q = b.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; })()`);
  if (!r) return false;
  await click(r[0], r[1]);
  await settle(400);
  return true;
};
const zpFields = (k) => ev(`[...document.querySelectorAll('#propsPanel .insp-step[data-k="${k}"] input[data-zp]')].map((i) => i.dataset.zp + '=' + i.value)`);
const typeIn = async (sel, text) => {
  const r = await ev(`(()=>{const el=document.querySelector(${JSON.stringify(sel)}); if(!el) return null; el.scrollIntoView({block:'nearest'}); el.focus(); el.select && el.select(); return true})()`);
  if (!r) return false;
  await ev(`(()=>{const el=document.activeElement; el.value=''; el.dispatchEvent(new Event('input',{bubbles:true})); return 1})()`);
  await type(text);
  await key('Enter');
  await ev(`(()=>{const el=document.activeElement; if (el && el.blur) el.blur(); return 1})()`);
  await settle(400);
  return true;
};
const ns = 'v15m' + Date.now();
// (the zeros and poles first: their marks show on X with the whole chain)
const CHAIN = [{ type: 'zp', params: { a: '1', zeros: '1, -1', poles: '0' }, on: true }, { type: 'mobius', params: { a: '1', b: '0', c: '0', d: '1' }, on: true }];

// 1. the Parameters component lives in the Inspector's slot
await view(1440, 900, false);
await load(ns + 'a', { shapes: [{ id: 's1', kind: 'disc', c: [0, 1.2], r: 0.8 }], steps: CHAIN, srcView: { cx: 0, cy: 0, s: 110 } });
await settle(1200); await grab();
const slot = await ev(`(() => ({ inInsp: !!document.querySelector('#propsPanel .insp-params .params-mount.prm-host .prm'), hosts: document.querySelectorAll('.prm-host').length, testSlot: !!document.getElementById('paramsSlot'), heads: [...document.querySelectorAll('#propsPanel h2')].filter((x) => /^Numbers/.test(x.textContent.trim())).length, nested: !!document.querySelector('#propsPanel .psec .psec') }))()`);
// (v16.5 UX65: the section is Numbers)
ok('Parameters is in the Inspector slot, once, with one heading and no nested section', slot.inInsp && slot.hosts === 1 && !slot.testSlot && slot.heads === 1 && !slot.nested, slot);

// 2. the plane menu adds a zero: the Inspector (step 1 selected) shows it at once
await clickSel('#pipeline .card[data-k="1"]'); await settle(500);
let f0 = await zpFields(1);
let h0 = await hist();
let p = await w2s('L', 0.3, -0.7);
await rclick(p[0], p[1]);
ok('the plane menu offers Add zero here', ids(await menu()).includes('zp-add-zeros-1'), ids(await menu()));
await pick('zp-add-zeros-1');
let f1 = await zpFields(1);
ok('a zero added from the menu shows in the Inspector, one undo step', f1.length === f0.length + 1 && f1.some((x) => /^zeros:2=/.test(x)) && (await hist()).hi === h0.hi + 1, { f0, f1 });
// the Inspector's × removes it (the same zpRemove: one undo step), and Undo brings it back
h0 = await hist();
await clickSel('#propsPanel .insp-step[data-k="1"] input[data-zp="zeros:2"] ~ .zp-del'); await settle(500);
ok('the Inspector’s × removes it, one undo step', (await zpFields(1)).length === f0.length && (await hist()).hi === h0.hi + 1, await zpFields(1));
await undo();
ok('Undo brings the zero back into the Inspector', (await zpFields(1)).length === f0.length + 1, await zpFields(1));
// the Inspector's Add zero and the menu's Remove
h0 = await hist();
await clickSel('#propsPanel .insp-step[data-k="1"] .zp-add.zeros'); await settle(500);
ok('Add zero in the Inspector: one undo step, one more field', (await zpFields(1)).length === f0.length + 2 && (await hist()).hi === h0.hi + 1, await zpFields(1));
await undo();
let hd = await ev(`__cmwZp().handles.find((q) => q.kind === 'zeros' && q.i === 0)`);
await rclick(hd.x, hd.y);
let m = await menu();
ok('on a zero mark: Remove, Turn into a pole, Edit', ['zp-remove', 'zp-swap', 'zp-edit'].every((i) => ids(m).includes(i)), ids(m));
await pick('zp-remove');
ok('the menu’s Remove ζ₁ shows in the Inspector', (await zpFields(1)).length === f0.length, await zpFields(1));
await undo();
await grab();

// 3. Edit ζ₁ with the panel hidden: the temporary Inspector opens at step 1 with ζ₁'s field focused
await clickSel('#pipeline .card[data-k="2"]'); await settle(400);
await key(']'); await settle(600);
info.hidden = await ev(`document.querySelector('.layout').classList.contains('hide-right')`);
hd = await ev(`__cmwZp().handles.find((q) => q.kind === 'zeros' && q.i === 0)`);
await rclick(hd.x, hd.y);
m = await menu();
ok('Edit ζ₁ is offered with the Inspector hidden', ids(m).includes('zp-edit'), ids(m));
await pick('zp-edit');
const ed = await ev(`(() => { const a = document.activeElement; return { temp: document.getElementById('propsPanel').classList.contains('temp'), sel: __cmwCards().sel, field: a && a.dataset ? a.dataset.zp || null : null, inInsp: !!(a && a.closest && a.closest('#propsPanel .insp-step[data-k="1"]')) }; })()`);
ok('Edit ζ₁ opens step 1 in the temporary Inspector with ζ₁ focused', info.hidden && ed.temp && ed.sel === 1 && ed.field === 'zeros:0' && ed.inInsp, Object.assign({ hidden: info.hidden }, ed));
await shot('v15m-edit-temp'); shots.push('v15m-edit-temp');
await ev(`(() => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); return 1; })()`);
await key('Escape'); await settle(300);
ok('Esc closes the temporary Inspector', !(await ev(`document.getElementById('propsPanel').classList.contains('temp')`)), null);
await key(']'); await settle(600);
ok('] shows the docked Inspector again', !(await ev(`document.querySelector('.layout').classList.contains('hide-right')`)), null);
await grab();

// 4. after an undo, the Inspector edits the live step (Möbius b)
await clickSel('#pipeline .card[data-k="2"]'); await settle(400);
await typeIn('#propsPanel .insp-step[data-k="2"] input[data-pkey="b"]', '0.5');
let st = await H('steps()');
ok('Möbius b = 0.5 from the Inspector', st[1].params.b === '0.5', st[1].params);
await undo();
info.afterUndo = await ev(`document.querySelector('#propsPanel .insp-step[data-k="2"] input[data-pkey="b"]').value`);
ok('after Undo the Inspector shows b = 0', info.afterUndo === '0', info.afterUndo);
await typeIn('#propsPanel .insp-step[data-k="2"] input[data-pkey="b"]', '0.25');
st = await H('steps()');
ok('typing after Undo changes the live step', st[1].params.b === '0.25', st[1].params);
await grab();

// 5. a number used in the Inspector's field; renaming it rewrites the field
await typeIn('#propsPanel .insp-step[data-k="2"] input[data-pkey="b"]', 'a i');
let P = await ev('__cmwP()');
ok('a new name in the Inspector field adds the number a', P.params.length === 1 && P.params[0].name === 'a' && P.steps[1].params.b === 'a i', { params: P.params, b: P.steps[1].params.b });
ok('the Parameters row appears in the Inspector', await ev(`!!document.querySelector('#propsPanel .prm-row[data-name="a"] input[type=range]')`), null);
await ev(`Params.rename('a', 'c1')`); await settle(500);
info.renamed = await ev(`document.querySelector('#propsPanel .insp-step[data-k="2"] input[data-pkey="b"]').value`);
P = await ev('__cmwP()');
ok('renaming a to c₁ rewrites the step and the Inspector field', P.steps[1].params.b === 'c1 i' && info.renamed === 'c1 i', { b: P.steps[1].params.b, field: info.renamed });
await shot('v15m-params-insp'); shots.push('v15m-params-insp');
await view(1440, 900, true); await settle(900);
await shot('v15m-params-insp-dark'); shots.push('v15m-params-insp-dark');
await view(1440, 900, false);
await grab();

info.errors = errs.slice(0, 8);
ok('no exceptions', errs.length === 0, errs.slice(0, 8));
return { pass: fails.length === 0, fails, info, shots };
