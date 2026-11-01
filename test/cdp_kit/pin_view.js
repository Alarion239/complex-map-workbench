// (#443, K) A view pinned for every page a test opens, the classic one unless the kit sets window.__cmwPinView =
// 'steps' first (cdpd.js does with CMW_VIEW=steps: a suite tagged steps({ pin: true }) in ci/suite_views.js, #620): Page.addScriptToEvaluateOnNewDocument installs this in
// the test kits (cdpd.js; regress/perf/cdp.js, so perf, glprof and equiv; regress/quality/run_quality.js), so a page
// loaded, reloaded or navigated to by a link runs with window.cmwView = 'classic', unless its URL asks for ?view=steps
// or ?view=classic (or the page set window.cmwView itself). Today the app opens classic anyway and this changes nothing; once K1 makes
// the steps view the default, a suite keeps testing what it tests now, and a suite that wants the steps view says so in
// its URL, as the steps suites already do. (K1's flip must read window.cmwView === 'classic' as the classic view.)
(() => {
  try {
    const asked = new URLSearchParams(location.search).get('view');
    if (window.cmwView === undefined && asked !== 'steps') window.cmwView = asked === 'classic' ? 'classic' : (window.__cmwPinView || 'classic');
  } catch (e) { /* a page with no location (about:blank) keeps the app's default */ }
})();
