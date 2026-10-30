// Screen-reader slips of the desktop page (issue #361), checked with axe-core's rules over the states that showed them:
//   label                     a selected shape's fields are named by their labels (center c, radius r)
//   nested-interactive        the chain cards hold no control a screen reader can reach (Bypass and More are inert
//                             until a pointer is over the card); the Shapes header's Clear is not inside its summary
//   aria-required-children    the Numbers list has role list only with items
//   aria-allowed-role         the split offer (a details) has no region role
//   scrollable-region-focusable  the Inspector's formula box is a tab stop
// and what the fixes must keep: the card's actions work under a mouse, Clear stays where it was in the header.
// A command file for a CDP daemon.
const AXE = fs.readFileSync(path.join(DIR, '..', '..', 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const fails = [];
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
const RULES = ['label', 'nested-interactive', 'aria-required-children', 'aria-allowed-role', 'scrollable-region-focusable'];
const axeRun = async () => {
  await ev(`(() => { window.__axe = null; axe.run(document, { runOnly: { type: 'rule', values: ${JSON.stringify(RULES)} } }).then((r) => { window.__axe = r.violations.map((v) => ({ id: v.id, n: v.nodes.length, t: v.nodes.slice(0, 3).map((x) => x.target.join(' ')) })); }); return 1; })()`);
  for (let i = 0; i < 100; i++) { const r = await ev('window.__axe'); if (r) return r; await sleep(100); }
  return [{ id: 'axe did not finish' }];
};
const fresh = async () => {
  await view(1440, 900, false, false);
  await load('axe' + Date.now() + Math.floor(Math.random() * 1000), { shapes: [], steps: [{ type: 'sin', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' } });
  await settle(1500);
  await ev(`${JSON.stringify(AXE)}.length`);   // (a cheap check that the evaluate path takes the source)
  await ev(AXE + '\n;1');
};
await fresh();
const names = await ev(`(() => { const out = []; for (let i = 0; i < 80; i++) { try { __cmwExample(i); } catch (e) { break; } const l = document.querySelector('#examplesBtn .exlabel'); out.push(l ? l.textContent : ''); } return out; })()`);
const idx = (re) => names.findIndex((n) => re.test(n));
const SCENES = [['the empty canvas', idx(/^Empty canvas/)], ['Strip to disk (a chain with a formula box)', idx(/^Strip to disk/)], ['Cauchy: a simple pole (a selected circle)', idx(/^Cauchy: a simple pole/)], ['a disc map moved by a point (the split offer)', idx(/^A disc map moved/)]];
ok('the scenes exist', SCENES.every(([, i]) => i >= 0), SCENES);
for (const lang of ['en', 'ru']) {
  await ev(`I18N.setPref('${lang}'), 1`); await settle(1500);
  if (!(await ev("typeof axe !== 'undefined'"))) await ev(AXE + '\n;1');   // (a language switch may reload the page)
  for (const [what, i] of SCENES) {
    await ev(`__cmwExample(${i}); 1`); await settle(1500);
    const v = await axeRun();
    ok(`${lang}: ${what}: no axe violation of ${RULES.join(', ')}`, v.length === 0, v);
  }
}
await ev(`I18N.setPref('en'), 1`); await settle(1500);

// what the fixes keep: the card's Bypass and More are for the mouse, and Clear sits in the Shapes header
await ev(`__cmwExample(${idx(/^Strip to disk/)}); 1`); await settle(1500);
const st0 = await ev(`(() => { const a = document.querySelector('#pipeline .card[data-k="1"] .acts'); return { inert: a.inert, hidden: a.getAttribute('aria-hidden') }; })()`);
ok('a card\'s actions are inert at rest and hidden from a screen reader', st0.inert === true && st0.hidden === 'true', st0);
const box = await ev(`(() => { const b = document.querySelector('#pipeline .card[data-k="1"]').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box[0], y: box[1] }); await settle(300);
const st1 = await ev(`document.querySelector('#pipeline .card[data-k="1"] .acts').inert`);
ok('a pointer over the card makes its actions usable', st1 === false, st1);
const ab = await ev(`(() => { const b = document.querySelector('#pipeline .card[data-k="1"] .acts .bypass').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: ab[0], y: ab[1] }); await sleep(100);
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: ab[0], y: ab[1], button: 'left', clickCount: 1 });
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: ab[0], y: ab[1], button: 'left', clickCount: 1 });
await settle(600);
const off = await ev('__cmwP().steps[0].on');
ok('a mouse click on the card\'s Bypass bypasses the step', off === false, off);
await ev('document.querySelector(\'#pipeline .card[data-k="1"] .acts .bypass\') && 1');
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 }); await settle(300);
const st2 = await ev(`document.querySelector('#pipeline .card[data-k="1"] .acts').inert`);
ok('a pointer leaving the card makes them inert again', st2 === true, st2);
const g = await ev(`(() => { const s = document.querySelector('#secShapes > summary').getBoundingClientRect(), c = document.getElementById('clearShapes').getBoundingClientRect(), d = document.getElementById('secShapes').getBoundingClientRect(); return { sTop: s.top, cTop: c.top, cH: c.height, cRight: c.right, dRight: d.right, inSummary: !!document.querySelector('#secShapes > summary #clearShapes') }; })()`);
ok('Clear is not in the summary, and sits at the header\'s top, inside the section', !g.inSummary && Math.abs(g.sTop - g.cTop) < 1 && g.cRight <= g.dRight, g);
return { pass: fails.length === 0, fails };
