// (#443, K) The classic view, pinned for every page a test opens: Page.addScriptToEvaluateOnNewDocument installs this in
// the test kits (cdpd.js; regress/perf/cdp.js, so perf, glprof and equiv; regress/quality/run_quality.js), so a page
// loaded, reloaded or navigated to by a link runs with window.cmwView = 'classic', unless its URL asks for ?view=steps
// (or the page set window.cmwView itself). Today the app opens classic anyway and this changes nothing; once K1 makes
// the steps view the default, a suite keeps testing what it tests now, and a suite that wants the steps view says so in
// its URL, as the steps suites already do. (K1's flip must read window.cmwView === 'classic' as the classic view.)
(() => {
  try {
    if (window.cmwView === undefined && new URLSearchParams(location.search).get('view') !== 'steps') window.cmwView = 'classic';
  } catch (e) { /* a page with no location (about:blank) keeps the app's default */ }
})();
