// [#404] A step field typed in a slow chain, a series' a_n or a recurrence's rule, applies once typing pauses (#243, 150 to
// 250 ms); a pause that ends after an example switch rebuilt the cards must not give the text to the new chain's step
// of the same type (the paramField twin of #401's Repeat N timer). A command file for a CDP daemon.
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const fails = [];
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
await view(1440, 900, false, false);
await load('fldsettle' + Date.now(), { shapes: [], steps: [{ type: 'sin', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' } });
await settle(1200);
const names = await ev(`(() => { const out = []; for (let i = 0; i < 80; i++) { try { __cmwExample(i); } catch (e) { break; } const l = document.querySelector('#examplesBtn .exlabel'); out.push([l ? l.textContent : '', __cmwP().steps.map((s) => s.type).join(',')]); } return out; })()`);
const iDilog = names.findIndex(([n]) => /dilogarithm/i.test(n)), iZeta = names.findIndex(([n]) => /^Zeta as a Dirichlet/i.test(n));
const iMand = names.findIndex(([n, t]) => /Mandelbrot/i.test(n) && /recurrence/.test(t));
ok('the dilogarithm, zeta and Mandelbrot examples exist', iDilog >= 0 && iZeta >= 0 && iMand >= 0, names);
const params = () => ev(`JSON.stringify(__cmwP().steps.map((s) => s.params))`);
// type into the first visible field of a key (a_n: an; the recurrence's rule: the seq field it shows), without leaving it
const typeOnly = (keys, v) => ev(`(() => { const x = [...document.querySelectorAll('input.inp')].find((x) => x.offsetParent && ${JSON.stringify(keys)}.includes(x.dataset.pkey)); if (!x) return null; x.focus(); x.value = ${JSON.stringify(v)}; x.dispatchEvent(new Event('input')); return x.dataset.pkey; })()`);
const blur = () => ev(`(() => { const a = document.activeElement; if (a && a.blur) a.blur(); return 1; })()`);
// 1. a series: a_n typed in the dilogarithm, Zeta opened at once: Zeta keeps its own a_n
await ev(`__cmwExample(${iZeta}), 1`); await settle(1200);
const zeta = await params();
await ev(`__cmwExample(${iDilog}), 1`); await settle(1200);
ok('the dilogarithm shows an a_n field', (await typeOnly(['an'], 'n^3/7')) === 'an', null);
await ev(`__cmwExample(${iZeta}), 1`); await settle(900);
ok('Zeta keeps its a_n after a switch inside the pause', (await params()) === zeta, { got: await params(), want: zeta });
// and when the field is left (its change) inside the pause, after the switch
await ev(`__cmwExample(${iDilog}), 1`); await settle(1200);
await typeOnly(['an'], 'n^3/7');
await ev(`(() => { const x = document.activeElement; __cmwExample(${iZeta}); if (x) x.dispatchEvent(new Event('change')); return 1; })()`); await settle(900);
ok('Zeta keeps its a_n when the field is left after the switch', (await params()) === zeta, { got: await params(), want: zeta });
// the same typing, left alone, still applies after the pause
await blur(); await ev(`__cmwExample(${iDilog}), 1`); await settle(1200);
await typeOnly(['an'], 'n^3/7'); await settle(900);
ok('typing alone still applies after the pause', /n\^3\/7/.test(await params()), await params());
await blur(); await settle(300);
// 2. a recurrence: its rule typed, the example reopened at once: the reopened rule is the example's own
await ev(`__cmwExample(${iMand}), 1`); await settle(1200);
const mand = await params();
const rk = await ev(`(() => { const x = [...document.querySelectorAll('input.inp')].find((x) => x.offsetParent && x.dataset.pkey && /u/.test(x.value)); return x ? x.dataset.pkey : null; })()`);
ok('the Mandelbrot recurrence shows its rule', !!rk, rk);
if (rk) {
  await typeOnly([rk], 'u^3+z');
  await ev(`__cmwExample(${iMand}), 1`); await settle(900);
  ok('the reopened Mandelbrot keeps its rule', (await params()) === mand, { got: await params(), want: mand });
  await typeOnly([rk], 'u^3+z'); await settle(900);
  ok('a typed rule left alone still applies', /u\^3\+z/.test(await params()), await params());
}
return { pass: fails.length === 0, fails };
