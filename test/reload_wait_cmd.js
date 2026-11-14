// test/lib/reload_wait.js, the factory over the kit's H.reloaded that the phone suites' language legs use.
//   - after a reload the page asks for, pageReloaded answers true on a loaded document with the phone's sheets;
//   - control: on a page that does not reload it answers false and records one failure that names the part missing and the limit.
// It runs in the steps view. A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const SHORT_LIMIT_MS = 1500;
const recorded = [];
const { pageReloaded } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'reload_wait.js'), 'utf8'))({ ev, fails: recorded, reloaded });
await view(390, 800, false, true);
await load('reloadwait' + Date.now(), { shapes: [], steps: [] });
await ev(`typeof Phone === 'object'`) === true || await settled({ only: true, until: `typeof Phone === 'object'`, max: 20000 });
let old = await ev('performance.timeOrigin');
setTimeout(() => { ev('location.reload(), 1').catch(() => {}); }, 100);
const r = await pageReloaded(old);
info.reload = { r, recorded: recorded.length, phone: await ev(`typeof Phone`) };
ok('after a reload, pageReloaded answers true on a loaded page with the phone sheets', r === true && recorded.length === 0 && info.reload.phone === 'object', info.reload);
old = await ev('performance.timeOrigin');
const t0 = Date.now(), r2 = await pageReloaded(old, { limitMs: SHORT_LIMIT_MS });
info.none = { r2, ms: Date.now() - t0, recorded: recorded.slice() };
ok('control: a page that does not reload answers false and records a failure naming the missing part and the limit', r2 === false && recorded.length === 1 && new RegExp('within ' + SHORT_LIMIT_MS + ' ms \\(missing: newDocument').test(recorded[0].name), info.none);
return { pass: fails.length === 0, fails, info };
