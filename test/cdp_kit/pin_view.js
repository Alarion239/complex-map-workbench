// (#443, K) The view every page a test opens starts in. Page.addScriptToEvaluateOnNewDocument installs this in the
// test kits (cdpd.js; regress/perf/cdp.js, so perf, glprof and equiv; regress/quality/run_quality.js), so it holds for
// a page loaded, reloaded or reached by a link.
// - The pin: window.cmwView = window.__cmwPinView, 'classic' unless the kit set 'steps' first (cdpd.js does with
//   CMW_VIEW=steps: a suite tagged steps({ pin: true }) in ci/suite_views.js, #620).
// - A URL that names a view keeps it: ?view=steps (the app reads it itself) or ?view=classic. A page that set
//   window.cmwView itself keeps that.
// The app opens the classic view by default, and the steps view for cmwView === 'steps' or ?view=steps.
// (test/t_pin_view.js runs this in a sandbox; test/pin_view_cmd.js checks the pin in the browser.)
(() => {
  try {
    const asked = new URLSearchParams(location.search).get('view');
    if (window.cmwView === undefined && asked !== 'steps') window.cmwView = asked === 'classic' ? 'classic' : (window.__cmwPinView || 'classic');
  } catch (e) { /* a page with no location (about:blank) keeps the app's default */ }
})();
