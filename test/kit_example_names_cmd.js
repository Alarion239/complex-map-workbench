// exampleNames() (test/cdp_kit/cdpd.js) lists the examples' English names in the order __cmwExample(i) opens them: the example
// button's label after __cmwExample(i) is exampleNames()[i], for the first, a middle and the last example.
// It runs in the steps view. A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const names = exampleNames();
ok('exampleNames() lists the examples', names.length > 2 && names.every((n) => typeof n === 'string' && n.length > 0), names);
await view(1440, 900, false, false);
await load('kitexamplenames' + Date.now(), { shapes: [], steps: [] });
const LABEL = `(document.querySelector('#examplesBtn .exlabel') || {}).textContent`;
const seen = {};
for (const i of [0, Math.floor(names.length / 2), names.length - 1]) {
  await ev(`__cmwExample(${i}), 1`);
  await settled({ until: `${LABEL} === ${JSON.stringify(names[i])}`, max: 30000 });
  seen[i] = await ev(LABEL);
  ok('example ' + i + ' is shown under its name', seen[i] === names[i], { want: names[i], got: seen[i] });
}
info.checked = seen;
return { pass: fails.length === 0, fails, info };
