// The kit's view pin for a ported suite (#620): this suite is tagged steps({ pin: true }) in ci/suite_views.js, so
// ci/browser.js runs it with CMW_VIEW=steps and cdpd.js sets window.__cmwPinView = 'steps' before pin_view.js. A page
// loaded with no view in its URL opens in the steps view; one that asks ?view=classic opens in the classic view; a
// reload keeps the pin. Its URLs never name the steps view, so it passes only through the pin.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const ready = () => settled({ max: 15000, until: `typeof __cmwSteps === 'function'` });
await go(`http://localhost:${PORT}/test.html?ns=pinview${Date.now()}`);
await ready();
info.plain = await ev('__cmwSteps().on');
ok('a page with no view in its URL opens in the steps view (the pin)', info.plain === true, info.plain);
await send('Page.reload', {}); await ready();
info.reload = await ev('__cmwSteps().on');
ok('a reload keeps the steps view', info.reload === true, info.reload);
await go(`http://localhost:${PORT}/test.html?ns=pinview${Date.now()}&view=classic`);
await ready();
info.classic = await ev('__cmwSteps().on');
ok('a page that asks ?view=classic opens in the classic view', info.classic === false, info.classic);
info.checks = 'the kit\'s steps pin: a plain URL, a reload and ?view=classic';
return { pass: fails.length === 0, fails, info };
