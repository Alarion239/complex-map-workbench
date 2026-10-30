// A typed Repeat N applies once typing settles (400 ms); the timer belongs to the step it was typed on: opening an
// example (or any chain change) inside those 400 ms must not give its N to the new chain (issue: stale settle timer).
// A command file for a CDP daemon.
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const fails = [];
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
await view(1440, 900, false, false);
await load('repsettle' + Date.now(), { shapes: [], steps: [{ type: 'sin', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' } });
await settle(1200);
const names = await ev(`(() => { const out = []; for (let i = 0; i < 80; i++) { try { __cmwExample(i); } catch (e) { break; } const l = document.querySelector('#examplesBtn .exlabel'); out.push(l ? l.textContent : ''); } return out; })()`);
const iN = names.findIndex((n) => /^Newton/.test(n));
ok('the Newton example exists', iN >= 0, names);
const rep = () => ev(`(() => { const st = __cmwP().steps.find((s) => s.repeat); return st ? st.repeat.n : null; })()`);
const chip = () => ev(`document.querySelector('#pipeline .rep-bracket .rep-n').value`);
const typeOnly = (v) => ev(`(() => { const c = document.querySelector('#pipeline .rep-bracket .rep-n'); c.value = ${JSON.stringify(v)}; c.dispatchEvent(new Event('input')); })()`);
await ev(`__cmwExample(${iN}), 1`); await settle(1200);
ok('Newton opens at N = 20', (await rep()) === 20, await rep());
// typed, and the example reopens before the 400 ms are up
await typeOnly('3');
await ev(`__cmwExample(${iN}), 1`); await settle(1200);
ok('the reopened example keeps its N = 20', (await rep()) === 20, await rep());
ok('and its chip shows 20', (await chip()) === '20', await chip());
// the same typing, left alone, still applies
await typeOnly('4'); await settle(900);
ok('typing alone still applies after the pause', (await rep()) === 4, await rep());
// Undo inside the window: the typed N is dropped with the chain it belonged to
await ev(`__cmwExample(${iN}), 1`); await settle(1200);
await typeOnly('5');
await ev(`__cmwExample(${iN === 0 ? iN + 1 : iN - 1}), 1`); await settle(1200);
await ev(`__cmwExample(${iN}), 1`); await settle(1200);
ok('another example in between: still N = 20 at the end', (await rep()) === 20, await rep());
return { pass: fails.length === 0, fails };
