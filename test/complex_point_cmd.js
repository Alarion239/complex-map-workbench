// A complex shared number as a point on the plane (issue #10): no point until the user adds one; the plane menu's "New
// complex number here" adds a number and its point in one undo step; "Show as a point" in a number's ⋯ menu adds the
// point of an existing one; dragging that point moves the number (one undo step, the GPU program is not rebuilt); the ℂ
// badge marks a complex number's row; a real number has none.
// A command file for a CDP daemon (test/cdp_kit README): python3 build.py && test/<you>_cdp/q.sh test/complex_point_cmd.js
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const exc = (l) => l.filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''));
const errs = [];
const grab = async () => { errs.push(...exc(await logs())); };
const P = () => ev('__cmwP()');
const H = (expr) => ev(`__cmwPlaneMenu().${expr}`);
const w2s = (side, re, im) => H(`w2s('${side}', ${re}, ${im})`);
const anyMenu = () => ev(`!!document.querySelector('#popHost .pop.menu')`);
const rclick = async (x, y) => {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'right', buttons: 2, clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'right', buttons: 0, clickCount: 1 });
  await settle(250);
};
const pick = async (sel) => {
  const r = await ev(`(() => { const b = document.querySelector(${JSON.stringify(sel)}); if (!b) return null; const q = b.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; })()`);
  if (!r) return false;
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r[0], y: r[1] });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r[0], y: r[1], button: 'left', buttons: 1, clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r[0], y: r[1], button: 'left', buttons: 0, clickCount: 1 });
  await settle(300);
  return true;
};
const undo = async () => { await ev(`document.getElementById('undoBtn').click()`); await settle(400); };
const glKey = () => ev('__cmwZp().glKey');
const points = async () => (await P()).shapes.filter((s) => s.kind === 'point');
const NS = 'cxpt' + (Date.now() % 1000000);
const STATE = {
  shapes: [{ id: 's2', kind: 'circle', c: [0, 0], r: 0.5, ci: 0, visible: true }],
  steps: [{ type: 'mobius', params: { a: '1', b: 'a', c: '0', d: '1' }, on: true }],
  params: [{ name: 'a', value: 1, im: 1, min: -2, max: 2, step: 0.01 }],
  srcView: { cx: 0, cy: 0, s: 110 }, pattern: 'checker', v5: true, v6: true,
};

await view(1440, 900, false, false);
await load(NS, STATE);
await settle(1200);
await grab();

// 1. a complex number has no point until the user adds one; its row has the ℂ badge
let s = await P();
ok('no point for a = 1 + i until one is added', (await points()).length === 0 && s.params.length === 1, s.shapes);
ok('the row has the ℂ badge', await ev(`!!document.querySelector('.prm-row[data-name="a"] .prm-cx')`), null);

// 2. the plane menu over the circle: New complex number here → a new number b at the pointer and its point, one step
let p = await w2s('L', 0.5, 0);
await rclick(p[0], p[1]);
ok('the circle menu has New complex number here', await ev(`!!document.querySelector('#popHost .pop.menu.pm .mi[data-pm="number-new"]')`), await ev(`[...document.querySelectorAll('#popHost .pop.menu.pm .mi')].map((b) => b.dataset.pm)`));
const hi0 = (await P()).hi;
ok('the item clicks', await pick('#popHost .pop.menu.pm .mi[data-pm="number-new"]'), null);
s = await P();
const nb = s.params.find((x) => x.name === 'b');
ok('a new number b exists, at the pointer', !!nb && Math.abs(nb.value - 0.5) < 0.02 && Math.abs((nb.im || 0)) < 0.02, s.params);
const pt = s.shapes.find((x) => x.kind === 'point' && x.bind && x.bind.p === 'b');
ok('and its point, bound to b', !!pt && Math.abs(pt.p[0] - nb.value) < 1e-9 && Math.abs(pt.p[1] - (nb.im || 0)) < 1e-9, pt);
ok('one undo step', s.hi === hi0 + 1, { hi: s.hi, was: hi0 });
await undo();
s = await P();
ok('undo removes the number and the point', !s.params.some((x) => x.name === 'b') && !s.shapes.some((x) => x.kind === 'point'), s.params);

// 3. an empty plane still opens no menu
p = await w2s('L', 1.4, 0.9);
await rclick(p[0], p[1]);
ok('a right-click on empty plane opens no menu', !(await anyMenu()), null);

// 4. Show as a point (the row's ⋯ menu), then drag the point: the number follows
await ev(`document.querySelector('.prm-row[data-name="a"] .prm-more').click()`);
await settle(300);
ok('Show as a point is offered', await ev(`[...document.querySelectorAll('#popHost .pop.menu .mi')].some((b) => /Show as a point/.test(b.textContent))`), null);
await ev(`[...document.querySelectorAll('#popHost .pop.menu .mi')].find((b) => /Show as a point/.test(b.textContent)).click()`);
await settle(500);
const pts = await points();
ok('a point bound to a appears at 1 + i, named a', pts.length === 1 && pts[0].bind && pts[0].bind.p === 'a' && pts[0].p[0] === 1 && pts[0].p[1] === 1, pts);
const key0 = await glKey();
const h1 = (await P()).hi;
p = await w2s('L', 1, 1);
const q = await w2s('L', -0.5, 0.75);
await drag(p[0], p[1], q[0], q[1], 8, 16);
await settle(600);
s = await P();
const a = s.params.find((x) => x.name === 'a');
ok('dragging the point moves the number', Math.abs(a.value + 0.5) < 0.03 && Math.abs(a.im - 0.75) < 0.03, a);
const pt2 = s.shapes.find((x) => x.kind === 'point');
ok('the point stays on the number', Math.abs(pt2.p[0] - a.value) < 1e-9 && Math.abs(pt2.p[1] - a.im) < 1e-9, { pt: pt2.p, a });
ok('the drag is one undo step', s.hi === h1 + 1, { hi: s.hi, was: h1 });
ok('the program is not rebuilt', (await glKey()) === key0, null);
ok('the step follows the number', Math.abs((await ev(`__cmwPlaneMenu().stage(1, 0, 0)`))[1] - a.im) < 1e-9, null);
await undo();
s = await P();
ok('undo puts the number back', s.params[0].value === 1 && s.params[0].im === 1, s.params);
ok('the row shows it as text again', (await ev(`document.querySelector('.prm-row[data-name="a"] .prm-val').value`)).replace('−', '-') === '1+i', null);

// 5. a real number has no badge and no Show as a point
await load(NS + 'r', { shapes: [], steps: [{ type: 'mobius', params: { a: '1', b: 'a', c: '0', d: '1' }, on: true }], params: [{ name: 'a', value: 0.5, min: -2, max: 2, step: 0.01 }], srcView: { cx: 0, cy: 0, s: 110 }, v5: true, v6: true });
await settle(1000);
ok('a real number has no ℂ badge', !(await ev(`!!document.querySelector('.prm-row[data-name="a"] .prm-cx')`)), null);
await ev(`document.querySelector('.prm-row[data-name="a"] .prm-more').click()`);
await settle(300);
ok('and no Show as a point', !(await ev(`[...document.querySelectorAll('#popHost .pop.menu .mi')].some((b) => /Show as a point/.test(b.textContent))`)), null);
// 5b. + Number → ℂ adds a complex number (no point until the user adds one)
await key('Escape'); await settle(200);
await ev(`[...document.querySelectorAll('.prm .prm-add button')].find((b) => /Number/.test(b.textContent)).click()`);
await settle(300);
await ev(`document.querySelector('.prm-addcx').click()`);
await settle(500);
s = await P();
const cxn = s.params.find((x) => x.name !== 'a');
ok('+ Number → ℂ adds a complex number 1 + i', !!cxn && cxn.value === 1 && cxn.im === 1, s.params);
ok('and shows no point', s.shapes.filter((x) => x.kind === 'point').length === 0, s.shapes);
// 6. the example "A disc map moved by a point": a complex number with its point; Play circles it and the point follows
await load(NS + 'e', { shapes: [], steps: [], srcView: { cx: 0, cy: 0, s: 110 }, v5: true, v6: true });
await settle(800);
let exLoaded = false;
for (let i = 40; i >= 0 && !exLoaded; i--) {
  await ev(`__cmwExample(${i}), 1`);
  exLoaded = /disc map moved by a point/i.test(await ev(`document.querySelector('#examplesBtn .exlabel').textContent`));
}
await settle(1500);
s = await P();
const ea = s.params.find((x) => x.name === 'a');
ok('the example is in the Examples menu', exLoaded, null);
ok('it has a complex number a and a point bound to it', !!ea && ea.im === 0.3 && s.shapes.some((x) => x.kind === 'point' && x.bind && x.bind.p === 'a'), s.params);
ok('the example\'s map has no error', s.errors.every((e) => !e), s.errors);
await ev(`document.querySelector('.prm-row[data-name="a"] .prm-play').click()`);
await sleep(1200);
s = await P();
const ea2 = s.params.find((x) => x.name === 'a'), ep = s.shapes.find((x) => x.kind === 'point');
ok('Play moves a about the origin, its point with it', Math.abs(Math.hypot(ea2.value, ea2.im) - Math.hypot(0.5, 0.3)) < 1e-6 && (Math.abs(ea2.value - 0.5) > 0.05 || Math.abs(ea2.im - 0.3) > 0.05) && Math.abs(ep.p[0] - ea2.value) < 1e-9 && Math.abs(ep.p[1] - ea2.im) < 1e-9, { ea2, p: ep.p });
await ev(`document.querySelector('.prm-row[data-name="a"] .prm-play').click()`);
await settle(500);
await grab();
ok('no exceptions', errs.length === 0, errs.slice(0, 5));
return { pass: fails.length === 0, fails, info };
