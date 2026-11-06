// The view every page a test opens starts in. Page.addScriptToEvaluateOnNewDocument installs this in the
// test kits (cdpd.js; regress/perf/cdp.js, so perf, glprof and equiv; regress/quality/run_quality.js), so it holds for
// a page loaded, reloaded or reached by a link.
// - The pin: window.cmwView = window.__cmwPinView, 'steps' unless the kit set 'classic' first (cdpd.js does with
//   CMW_VIEW=classic: a suite tagged classic(why) or not yet ported in ci/suite_views.js; the perf, GPU and quality
//   kits do until their scenes use the steps hooks).
// - A URL that names a view keeps it: ?view=classic or ?view=steps (the app reads it itself). A page that set
//   window.cmwView itself keeps that.
// The app opens the steps view by default, and the classic views for cmwView === 'classic' or ?view=classic.
// (test/t_pin_view.js runs this in a sandbox; test/pin_view_cmd.js checks the pin in the browser.)
(() => {
  try {
    const asked = new URLSearchParams(location.search).get('view');
    if (window.cmwView === undefined && asked !== 'steps') window.cmwView = asked === 'classic' ? 'classic' : (window.__cmwPinView || 'steps');
  } catch (e) { /* a page with no location (about:blank) keeps the app's default */ }
})();
