'use strict';
// The steps view's scenes as page statements (strings for the browser), for the scene walks of ci/glprof.js and
// ci/equiv.js and for test/pa_render.js. The page is opened with ?view=steps; each statement ends in a value
// that is not false, so a walk's step reads it as done.
//   main(v)   the main plane as one of 'phase', 'land', 'xy': Phase is the last plane (the colour plane set to it),
//             Landscape is its height surface, and X → Y is the first plane, before the colour plane
//   surface(s)  'plane' or 'sphere' (the view's surface switch)
//   glide(to)   a glide to plane `to` (an index, or 'last'); glideBack() jumps to plane 0 at rest
//   started()   the page has loaded and the view is on; moving() a glide, scrub or draw is under way; stopPlay() pauses a playing glide
const last = '__cmwSteps().planes.length - 1';
const main = (v) => {
  if (!['phase', 'land', 'xy'].includes(v)) throw new Error(`no main plane ${v}: phase, land or xy`);
  const at = v === 'xy' ? '0' : 'n', surf = v === 'land' ? 'land' : 'plane';
  return `(() => { const n = ${last}; __cmwSteps({ go: ${at}, now: true, T: n, surf: '${surf}' }); return true; })()`;
};
const surface = (s) => {
  if (s !== 'plane' && s !== 'sphere') throw new Error(`no surface ${s}: plane or sphere`);
  return `(__cmwSteps({ surf: '${s}' }), true)`;
};
const glide = (to) => `(() => { const n = ${last}; if (n > 0) __cmwSteps({ go: ${to === 'last' ? 'n' : Number(to)} }); return true; })()`;
const glideBack = () => '(__cmwSteps({ go: 0, now: true }), true)';
const started = () => "document.readyState === 'complete' && typeof __cmwSteps === 'function' && __cmwSteps().on";
const moving = () => '(() => { try { return __cmwSteps().moving; } catch (e) { return false; } })()';
// (a page without the hooks has nothing to pause)
const stopPlay = () => '(() => { try { __cmwSteps({ play: false }); } catch (e) { /* no hooks: nothing plays */ } return 1; })()';
module.exports = { main, surface, glide, glideBack, started, moving, stopPlay };
