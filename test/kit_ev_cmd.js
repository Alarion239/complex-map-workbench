// H.ev (test/cdp_kit/cdpd.js): an expression's value comes back, a returned promise is awaited, and a rejection or a
// promise that never settles is an { __exc } answer.
//   - a primitive, an object and undefined come back by value;
//   - a promise resolves to its value after the time it waits (REPL mode alone would answer {} at once);
//   - a rejected promise and a thrown error are { __exc };
//   - a promise that never settles is { __exc } after about the timeout.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
await go(`http://localhost:${PORT}/test.html`);
ok('a primitive', (await ev('1 + 2')) === 3);
const obj = await ev('({ a: [1, 2], b: "x" })');
ok('an object by value', obj && obj.b === 'x' && obj.a.length === 2, obj);
ok('undefined', (await ev('undefined')) === undefined);
const t0 = Date.now();
const waited = await ev('new Promise((r) => setTimeout(() => r({ v: 5 }), 300))');
const took = Date.now() - t0;
ok('a promise is awaited: its value', waited && waited.v === 5, waited);
ok('... after the time it waits', took >= 300, took);
const rej = await ev('new Promise((_, no) => setTimeout(() => no(new Error("late")), 50))');
ok('a rejected promise is an __exc', rej && /late/.test(rej.__exc || ''), rej);
const thrown = await ev('throw new Error("now")');
ok('a thrown error is an __exc', thrown && /now/.test(thrown.__exc || ''), thrown);
const t1 = Date.now();
const never = await ev('new Promise(() => {})', 600);
const gave = Date.now() - t1;
ok('a promise that never settles is an __exc', never && !!never.__exc, never);
ok('... after about the timeout', gave >= 600 && gave < 3000, gave);
info.times = { took, gave };
return { pass: fails.length === 0, fails, info };
