// The steps view takes the shape keys the classic page has (UX97): ⌘D duplicates the selected shape, the arrows move it
// (Shift: ten steps) instead of stepping the chain, ⌘[ and ⌘] send it back and bring it forward; and a right click on a
// step's chip or a Shapes row opens its ⋯ menu at the pointer (UX99). A command file for a CDP daemon (test/cdp_kit
// README); prints { pass, of, fails }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const R = [];
const check = (name, pass, detail) => R.push([name, !!pass, detail]);
const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'h1', kind: 'halfplane', a: [0, 0], b: [1, 0], ci: 0, visible: true }, { id: 'h2', kind: 'halfplane', a: [0, 1], b: [1, 1], ci: 1, visible: true }],
  steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, { type: 'pown', params: { n: 3 }, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } };
await view(1440, 900, false, false);
const ns = 'svkeys' + Date.now();
await seed(ns, st);
await go(`http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps`);
const idle = `__cmwSteps().on && !__cmwSteps().moving && !!document.querySelector('#paneL canvas')`;
await settled({ max: 30000, until: idle });
check('the page is the steps view', await ev('!!__cmwSteps().on'));
const shapes = () => ev(`JSON.stringify(__cmwShapes().shapes)`);
const ids = () => ev(`__cmwShapes().shapes.map((s) => s.id)`);
const sel = () => ev(`__cmwShapes().selected`);
const KC = { ArrowLeft: 37, ArrowRight: 39, ArrowUp: 38, ArrowDown: 40, d: 68, '[': 219, ']': 221 };
const press = async (k, modifiers = 0) => { const p = { key: k, code: /^[a-z]$/.test(k) ? 'Key' + k.toUpperCase() : k, modifiers, windowsVirtualKeyCode: KC[k] || 0 }; await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...p }); await send('Input.dispatchKeyEvent', { type: 'keyUp', ...p }); await sleep(250); };
const box = (sel) => ev(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(sel)})].find((x) => x.getClientRects().length); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; })()`);
const mid = (b) => [b.l + b.w / 2, b.t + b.h / 2];
const rclick = async (x, y) => { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'right', buttons: 2, clickCount: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'right', buttons: 0, clickCount: 1 }); await sleep(400); };

await ev(`__cmwSelect('h1')`); await sleep(300);
await ev(`document.activeElement && document.activeElement.blur(), document.body.focus(), 1`);
const i0 = await ev('__cmwSteps().i');
const s0 = await shapes();
await press('ArrowRight');
check('an arrow moves the selected shape', (await shapes()) !== s0, null);
check('and does not step the chain', (await ev('__cmwSteps().i')) === i0, i0);
const s1 = await shapes();
await press('ArrowUp', 8);
check('Shift + an arrow moves it ten steps', (await shapes()) !== s1, null);
const n0 = (await ids()).length;
await press('d', 4);
const after = await ids();
check('⌘D duplicates the selected shape and selects the copy', after.length === n0 + 1 && (await sel()) !== 'h1', { after });
const copy = await sel();
await press('[', 4);
const sent = await ids();
check('⌘[ sends it backward', sent.indexOf(copy) === sent.length - 2, sent);
await press(']', 4);
const fwd = await ids();
check('⌘] brings it forward', fwd.indexOf(copy) === fwd.length - 1, fwd);

// no shape selected: the arrows step the chain as before
await ev(`__cmwSelect(null)`); await sleep(200);
await ev(`document.activeElement && document.activeElement.blur(), document.body.focus(), 1`);
const j0 = await ev('__cmwSteps().i');
await press('ArrowRight');
await settled({ max: 8000, only: true, until: `!__cmwSteps().moving` });
check('with no shape selected an arrow still steps the chain', (await ev('__cmwSteps().i')) !== j0, j0);

// the right click
await sleep(300);
const rowB = await box('#shapeList .shape[data-id="h1"] .shape-name');
if (rowB) await rclick(...mid(rowB));
let g = await ev(`(() => { const p = document.querySelector('#popHost .pop.menu'); if (!p) return null; const b = p.getBoundingClientRect(); return { x: b.left, y: b.top, n: p.querySelectorAll('.mi').length }; })()`);
check('a right click on a Shapes row opens its ⋯ menu at the pointer', rowB && g && g.n > 2 && Math.abs(g.x - (mid(rowB)[0] + 2)) < 4, { rowB, g });
await press('Escape');
const cb = await box('.sv-step[data-k="1"] .sv-fchip');
if (cb) await rclick(...mid(cb));
g = await ev(`(() => { const p = document.querySelector('#popHost .pop.menu'); if (!p) return null; return { n: p.querySelectorAll('.mi').length, t: p.textContent }; })()`);
check('a right click on a step\'s chip opens its ⋯ menu', cb && g && g.n > 3 && /Move right/.test(g.t), g);
await press('Escape');
const fails = R.filter((r) => !r[1]);
return { pass: R.length - fails.length, of: R.length, fails };
