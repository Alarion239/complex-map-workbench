// The classic view's learn checks: X's option bars and keys in its pane head (Phase, Landscape), the landscape phone's
// legend glyph without words, and the shape keys and right-click menus of the Shapes list. The steps view's own learn
// checks are ux165_learn_cmd.js. (standards-ok: Y's pane head, its pattern key and options, the target's note in it and
// the empty chain's Add function there are gone with Y's pane, which is not drawn since #994)
// Laptop (1366 x 768) and landscape phone (915 x 412). A command file for a CDP daemon (test/cdp_kit README): python3
// build.py && test/<you>_cdp/q.sh test/ux165_learn_classic_cmd.js. Prints { pass, of, fails: [[name, false, detail]], exc }.
const { U, R, check, exc, grab, UA0, laptop, fresh, ready, firstVisit } = await eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'ux165_kit.js'), 'utf8'));
const box = (sel) => ev(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(sel)})].find((x) => x.getClientRects().length); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; })()`);
const mid = (b) => [b.l + b.w / 2, b.t + b.h / 2];
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const phone = async (w, h, dark = false) => { await send('Emulation.setUserAgentOverride', { userAgent: ANDROID, platform: 'Linux armv8l' }); await view(w, h, dark, true); };
const rclick = async (x, y) => { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'right', buttons: 2, clickCount: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'right', clickCount: 1 }); await settled({ until: "!!document.querySelector('#popHost .pop.menu')", max: 1500 }); };
logs();
let g = null;
// ---------------------------------------------------------------- X's options and keys in its pane head
await laptop();
await fresh('ux165a'); await settled({ until: "typeof __cmwState === 'function' && !!document.querySelector('#pipeline')" });
for (const v of ['phase', 'land']) {
  await ev(`__cmwSetMain('${v}')`); await settled({});
  g = await ev(`(() => { const F = document.querySelector('#leftFoot'), plot = document.querySelector('#plotL'); return { head: F.parentNode.classList.contains('pane-head'), bars: [...plot.querySelectorAll(':scope > .options, :scope > .legend-chip:not([hidden]):not(.calc-chip)')].filter((e) => e.getClientRects().length).length, leg: document.querySelector('#leftLegend').parentNode.classList.contains('pane-head') }; })()`);
  // (Phase's colour key lies on the plot, top right, always shown; the Landscape's height key is the head's chip)
  if (v === 'phase') check('UX20/#365 laptop phase: its option bar is in X\'s pane head, the key is the one thing on the plot', g.head && !g.leg && g.bars === 1, g);
  else check(`UX20 laptop ${v}: its option bar and key are in X's pane head, none over the plot`, g.head && g.leg && g.bars === 0, g);
  await shot('ux165-ux20-' + v);
}
await ev(`__cmwSetMain('xy')`); await settled({});
// phone landscape: the key is a folded glyph with none of the head's words (its head is not shown)
await phone(915, 412);
await fresh('ux165b'); await settled({ until: "typeof __cmwState === 'function' && !!document.querySelector('#pipeline')" });
check('UX20 phone: the glyph carries none of the head\'s words', await ev(`!document.querySelector('#leftLegend .lg-sum')`));
grab();

// ---------------------------------------------------------------- keys on shapes, right-click menus
await laptop();
await fresh('ux165k'); await settled({ until: "typeof __cmwState === 'function' && !!document.querySelector('#pipeline')" });
await ev(`__cmwSelect('s2')`); await settled({ until: "__cmwShapes().selected === 's2'", only: true });
const n0 = await ev(`__cmwShapes().shapes.length`);
await ev(`document.body.focus()`);
await key('d', 4); await settled({ until: `__cmwShapes().shapes.length === ${n0 + 1}`, only: true });
g = await ev(`({ n: __cmwShapes().shapes.length, sel: __cmwShapes().selected })`);
check('UX97: ⌘D duplicates the selected shape and selects the copy', g.n === n0 + 1 && g.sel !== 's2', Object.assign({ n0 }, g));
const sid = g.sel;
const before = await ev(`JSON.stringify(__cmwShapes().shapes.find((s) => s.id === ${JSON.stringify(sid)}))`);
await key('ArrowRight'); await settled({ until: `JSON.stringify(__cmwShapes().shapes.find((s) => s.id === ${JSON.stringify(sid)})) !== ${JSON.stringify(before)}`, only: true });
const after = await ev(`JSON.stringify(__cmwShapes().shapes.find((s) => s.id === ${JSON.stringify(sid)}))`);
check('UX97: an arrow moves the selected shape', before !== after, { before, after });
await key('[', 4); await settled({ until: `__cmwShapes().shapes.map((s) => s.id).indexOf(${JSON.stringify(sid)}) === __cmwShapes().shapes.length - 2`, only: true });
g = await ev(`__cmwShapes().shapes.map((s) => s.id)`);
check('UX97: ⌘[ sends it backward', g.indexOf(sid) === g.length - 2, g);
await rclick(...mid(await box('#shapeList .shape[data-id="s2"] .shape-name')));
g = await ev(`(() => { const p = document.querySelector('#popHost .pop.menu'); if (!p) return null; const b = p.getBoundingClientRect(); return { x: b.left, y: b.top, keys: [...p.querySelectorAll('.mi')].filter((m) => /Duplicate|Bring forward|Send backward/.test(m.textContent)).map((m) => m.querySelector('.mi-key').textContent) }; })()`);
const at1 = mid(await box('#shapeList .shape[data-id="s2"] .shape-name'));
check('UX99: a right click on a Shapes row opens its ⋯ menu at the pointer', g && Math.abs(g.x - at1[0]) < 4 && (Math.abs(g.y - at1[1]) < 4 || g.y < at1[1]), Object.assign({ at1 }, g));
check('UX97: the menu shows the keys (⌘D, ⌘], ⌘[)', g && g.keys.length === 3 && g.keys.every((k) => /[⌘C]/.test(k)), g && g.keys);
await key('Escape'); await settled({ until: "!document.querySelector('#popHost .pop.menu')", only: true });
grab();

await laptop(1440, 900, false);
await send('Emulation.setUserAgentOverride', { userAgent: UA0 });
const fails = R.filter((r) => !r[1]);
return { pass: R.length - fails.length, of: R.length, fails, exc };
