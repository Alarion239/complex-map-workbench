// The harness says why a call died with "Inspected target navigated or closed" (or "Cannot find context with specified
// id"): the error's message names the event that came first, a navigation (Page.frameStartedLoading or
// Page.frameNavigated: the error can come before the commit) or a crash (Inspector.targetCrashed); with neither seen it says so. The same text goes into the suite's log. (A crash is not
// driven here: it ends the page the daemon's other suites share.)
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const RELOAD_AFTER_MS = 100;    // the page reloads itself this long after the call starts
const CALL_LIMIT_MS = 15000;    // the call would wait this long for a promise that never settles
const message = async (expr) => { try { const r = await ev(expr, CALL_LIMIT_MS); return { returned: r }; } catch (e) { return { message: String(e && e.message || e) }; } };
await go(`http://localhost:${PORT}/test.html`);

// a navigation under a pending call
const navCase = await message(`new Promise(() => { setTimeout(() => location.reload(), ${RELOAD_AFTER_MS}); })`);
info.navCase = navCase;
ok('a call the page navigates away from fails', !!navCase.message, navCase);
ok('the message names the navigation', !!navCase.message && /\[Runtime\.awaitPromise: Page\.frame(StartedLoading|Navigated)/.test(navCase.message), navCase);
ok('the log says it too', (await logs()).some((x) => x.t === 'cdp' && /Page\.frame(StartedLoading|Navigated)/.test(x.m)), null);
await go(`http://localhost:${PORT}/test.html`);

return { pass: fails.length === 0, fails, info };
