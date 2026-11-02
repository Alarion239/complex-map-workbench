// The classic chain cards' actions are for the mouse (issue #361): inert and hidden from a screen reader at rest, usable under a
// pointer over the card, a click on Bypass bypasses the step, and inert again when the pointer leaves. The steps view has the thread,
// whose chips hold their ⋯ as ordinary controls; a11y_axe_cmd.js runs in the steps view, this is the classic cards' part until K3.
// A command file for a CDP daemon.
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const fails = [];
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
await view(1440, 900, false, false);
await load('axec' + Date.now(), { shapes: [], steps: [{ type: 'sin', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' } });
await settle(1500);
const names = await ev(`(() => { const out = []; for (let i = 0; i < 80; i++) { try { __cmwExample(i); } catch (e) { break; } const l = document.querySelector('#examplesBtn .exlabel'); out.push(l ? l.textContent : ''); } return out; })()`);
const idx = (re) => names.findIndex((n) => re.test(n));
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
return { pass: fails.length === 0, fails };
