// The kit's faults (test/cdp_kit/cdpd.js faults(), the suite result's kitFaults): a page exception ({ __exc }) and a wait
// that ran out (settled's ok false) are recorded, and each stays a fault of the suite until the suite reads what says so
// (`__exc`; `ok` or `at`), so a suite that reads on as if the page had answered fails at its end.
//   - an exception nobody reads, and a wait that ran out nobody reads, are listed with the expression or the wait and the text;
//   - the same answers once read (`__exc`, `ok`, `at`) are not listed;
//   - a wait that comes and a value that is not an exception are never listed.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const SHORT_MS = 400;   // a wait that cannot come
await go(`http://localhost:${PORT}/test.html`);
faults(true);
await ev('1 + 2');
await settled({ until: 'true', max: 3000, only: true });
ok('a value and a wait that comes are no fault', faults().length === 0, faults());
await ev('throw new Error("unread boom")');
let f = faults();
ok('an unread exception is a fault, with the expression and the text', f.length === 1 && /unread boom/.test(f[0]) && /throw new Error/.test(f[0]), f);
faults(true);
const read = await ev('throw new Error("read boom")');
ok('(the answer is an __exc)', !!read.__exc, read);
ok('an exception whose __exc the suite read is no fault', faults().length === 0, faults());
await settled({ until: 'false', max: SHORT_MS, only: true });
f = faults();
ok('an unread wait that ran out is a fault, with the wait and why', f.length === 1 && /did not come within/.test(f[0]) && /false/.test(f[0]), f);
faults(true);
const out1 = await settled({ until: 'false', max: SHORT_MS, only: true });
ok('(the wait is not ok)', !out1.ok, out1);
ok('a wait whose ok the suite read is no fault', faults().length === 0, faults());
const out2 = await settled({ until: 'false', max: SHORT_MS, only: true });
ok('(at is -1)', out2.at === -1, out2);
ok('a wait whose at the suite read is no fault', faults().length === 0, faults());
await ev('throw new Error("left")');
ok('faults(true) forgets what is left', faults(true).length === 1 && faults().length === 0, null);
return { pass: fails.length === 0, fails, info };
