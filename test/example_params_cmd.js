// An example's own shared numbers (the partial sums' N) leave with it: loading another example takes them away, the
// user's own numbers stay, and a user's number that the example's of the same name stood in for comes back.
// It runs in the steps view (ci/suite_views.js: steps({ pin: true })).
// A command file for a CDP daemon.
const fails = [];
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
const nums = () => ev(`__cmwP().params.map((p) => ({ name: p.name, value: p.value, ex: !!p.ex }))`);
await view(1440, 900, false, false);
const user = [{ name: 'a', value: 1.5, min: 0, max: 3, step: 0.1 }];
await load('exparams' + Date.now(), { shapes: [], steps: [{ type: 'sin', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' }, params: user });
await settled();
if (!(await ev(`!!(window.__cmwSteps && __cmwSteps().on)`))) return { pass: false, fails: ['the page is not in the steps view (this suite is tagged steps({ pin: true }) in ci/suite_views.js)'] };
// the examples by name
const names = await ev(`(() => { const out = []; for (let i = 0; i < 60; i++) { try { __cmwExample(i); } catch (e) { break; } const l = document.querySelector('#examplesBtn .exlabel'); out.push(l ? l.textContent : ''); } return out; })()`);
const iSum = names.findIndex((n) => /Partial sums/.test(n));
ok('the partial sums example exists', iSum > 0, names);
await load('exparams' + Date.now(), { shapes: [], steps: [{ type: 'sin', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' }, params: user });
await settled();
await ev(`__cmwExample(${iSum})`); await settled();
let n = await nums();
ok('the example brings its N, marked, beside the user\'s a', n.length === 2 && n.some((p) => p.name === 'a' && !p.ex) && n.some((p) => p.name === 'N' && p.ex), n);
await ev(`__cmwExample(1)`); await settled();
n = await nums();
ok('another example takes N away; the user\'s a stays', n.length === 1 && n[0].name === 'a' && n[0].value === 1.5 && !n[0].ex, n);
// a user's N that the example's replaced comes back
const user2 = user.concat([{ name: 'N', value: 3, min: 1, max: 9, step: 1 }]);
await load('exparams' + Date.now(), { shapes: [], steps: [{ type: 'sin', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' }, params: user2 });
await settled();
await ev(`__cmwExample(${iSum})`); await settled();
n = await nums();
ok('the example\'s N stands in for the user\'s', n.length === 2 && n.some((p) => p.name === 'N' && p.ex && p.value === 8), n);
// a reload (the saved state, as a link or a scene opens it) with the example open: the user's N is kept in the state, not in memory
const fig = await ev(`__cmwP().figure`);
await load('exparams' + Date.now(), fig); await settled();
n = await nums();
ok('after a reload the example\'s N still stands in for the user\'s', n.length === 2 && n.some((p) => p.name === 'N' && p.ex && p.value === 8), n);
await ev(`__cmwExample(1)`); await settled();
n = await nums();
ok('the user\'s N comes back with its value, and a stays', n.length === 2 && n.some((p) => p.name === 'N' && !p.ex && p.value === 3) && n.some((p) => p.name === 'a' && p.value === 1.5), n);
const back = await ev(`__cmwP().params.find((p) => p.name === 'N')`);
ok('the user\'s N comes back with its own range and step', back && back.min === 1 && back.max === 9 && back.step === 1 && !back.ex, back);
// the example opened again and its N edited: the user's N is still kept
await ev(`__cmwExample(${iSum})`); await settled();
await ev(`Params.set('N', 12)`); await settled();
await ev(`__cmwExample(1)`); await settled();
n = await nums();
ok('editing the example\'s N does not lose the user\'s N', n.some((p) => p.name === 'N' && !p.ex && p.value === 3), n);
return { pass: fails.length === 0, fails };
