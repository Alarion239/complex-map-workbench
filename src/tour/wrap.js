'use strict';
// Guided tour: a spotlight walk through the Workbench in chapters (notes/tour/DESIGN.md). The app hands over a small
// adapter with Tour.init(api) (notes/tour/INTEGRATION.md); everything else (content, spotlight, callout, the first-run
// suggestion, the help menu, persistence, CSS) lives here. A step whose anchor is missing is skipped, so the tour keeps
// working while the UI evolves.
const Tour = (() => {
  // @parts: src/tour/NN-*.js go here, in order (build.py; test/src_text.js joins them the same way)
})();
// a global binding for the app's scripts, and window.Tour for pages and tools that look it up there
if (typeof window !== 'undefined') window.Tour = Tour;
export { Tour };
