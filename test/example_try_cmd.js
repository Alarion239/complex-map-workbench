// An example's Try line closes when the user does what it asks, and only then (issue #34): "press Deformation" closes
// when the Deformation opens, not on any other action; another example's line replaces it, as before; an example whose
// line asks for something we cannot see (its X, Show me) keeps working. A command file for a CDP daemon.
const fails = [];
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
const settle = async (ms = 400) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const lane = () => ev(`!!document.querySelector('.tour-lane[data-lane="example"]')`);
const byName = async (re) => ev(`(() => { for (let i = 0; i < 60; i++) { try { __cmwExample(i); } catch (e) { return -1; } const l = document.querySelector('#examplesBtn .exlabel'); if (l && ${re}.test(l.textContent)) return i; } return -1; })()`);
await view(1440, 900, false, false);
await load('extry' + Date.now(), { shapes: [], steps: [{ type: 'sin', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' } });
await settle(1200);
const iQuarter = await byName('/Quarter plane squared/');
const iSine = await byName('/Sine of a half-strip/');
ok('the examples exist', iQuarter >= 0 && iSine >= 0, { iQuarter, iSine });

// "press Deformation": another action leaves the line, the Deformation closes it
await ev(`__cmwExample(${iQuarter})`); await settle(1000);
ok('the line is there', await lane(), null);
await ev(`__cmwSetMain('phase'); 1`); await settle(500);
ok('an action the line does not ask for leaves it', await lane(), null);
await ev(`__cmwSetMain('xy'); 1`); await settle(300);
await ev(`document.getElementById('morphBtn').click()`); await settle(800);
ok('pressing Deformation closes the line', !(await lane()), null);

// "switch to Phase": that view closes it, nothing else does
await ev(`__cmwExample(${iSine})`); await settle(1000);
ok('the sine example has its line', await lane(), null);
await ev(`document.getElementById('morphBtn').click()`); await settle(500);
ok('the Deformation is not what this line asks for', await lane(), null);
await ev(`document.getElementById('morphBtn').click()`); await settle(500);
await ev(`__cmwSetMain('phase'); 1`); await settle(600);
ok('switching to Phase closes it', !(await lane()), null);

// another example opens: its own line, as today (the earlier watch does not close it)
await ev(`__cmwExample(${iQuarter})`); await settle(1000);
await ev(`__cmwExample(${iSine})`); await settle(1000);
ok('another example brings its own line', await lane(), null);
await ev(`document.getElementById('morphBtn').click()`); await settle(600);
ok('and the earlier example\'s watch is gone: Deformation does not close the sine line', await lane(), null);

// a line about zooming closes when the plane is zoomed (the wheel), not on another action; one about hovering a pole closes
// when the pointer reads a point in Y
const iBound = await byName('/A natural boundary/');
const iGamma = await byName('/Poles of the Gamma function/');
ok('the zoom and hover examples exist', iBound >= 0 && iGamma >= 0, { iBound, iGamma });
const centre = (id) => ev(`(() => { const b = document.getElementById('${id}').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);
await ev(`__cmwExample(${iBound})`); await settle(1500);
ok('the natural boundary has its line', await lane(), null);
await ev(`document.getElementById('morphBtn').click()`); await settle(500);
await ev(`document.getElementById('morphBtn').click()`); await settle(500);
ok('another action leaves the zoom line', await lane(), null);
let c = await centre('paneL');
for (let i = 0; i < 3; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: c.x, y: c.y, deltaX: 0, deltaY: -120 }); await sleep(120); }
await settle(900);
ok('zooming closes it', !(await lane()), null);
await ev(`__cmwExample(${iGamma})`); await settle(1500);
ok('the Gamma example has its line', await lane(), null);
await ev(`__cmwSetMain('xy'); 1`); await settle(800);
c = await centre('paneR');
for (const dx of [0, 14, 28, 42]) { await move(c.x + dx, c.y + dx / 2); await sleep(120); }
await settle(700);
ok('hovering a point in Y closes it', !(await lane()), null);
return { pass: fails.length === 0, fails };
