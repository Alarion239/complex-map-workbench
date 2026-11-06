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
// the N field of the Inspector's Repeat row, the block's step selected on the thread
const open = async (i) => {
  await ev(`__cmwExample(${i}), 1`); await settled({ until: '__cmwP().steps.some((s) => s.repeat)', max: 20000 });
  await ev(`(() => { const k = __cmwP().steps.findIndex((s) => s.repeat) + 1, c = document.querySelector('#svStrip .sv-step[data-k="' + k + '"] .sv-fchip'); if (c) c.click(); return k; })()`);
  await settled({ until: `!!document.querySelector('.insp-repeat .rep-n')` });
};
const chip = () => ev(`(document.querySelector('.insp-repeat .rep-n') || {}).value`);
const typeOnly = (v) => ev(`(() => { const c = document.querySelector('.insp-repeat .rep-n'); c.value = ${JSON.stringify(v)}; c.dispatchEvent(new Event('input')); })()`);
await open(iN);
ok('Newton opens at N = 20', (await rep()) === 20, await rep());
// typed, and the example reopens before the 400 ms are up
await typeOnly('3');
await open(iN);
ok('the reopened example keeps its N = 20', (await rep()) === 20, await rep());
ok('and its field shows 20', (await chip()) === '20', await chip());
// the same typing, left alone, still applies
await typeOnly('4'); await settle(900);
ok('typing alone still applies after the pause', (await rep()) === 4, await rep());
// Undo inside the window: the typed N is dropped with the chain it belonged to
await open(iN);
await typeOnly('5');
await ev(`__cmwExample(${iN === 0 ? iN + 1 : iN - 1}), 1`); await settle(1200);
await ev(`__cmwExample(${iN}), 1`); await settle(1200);
ok('another example in between: still N = 20 at the end', (await rep()) === 20, await rep());
return { pass: fails.length === 0, fails };
