// What the suites that open the app on a saved chain share (steps_parked_pan_cmd.js, steps_play_cmd.js,
// steps_view_cmd.js): the chain's steps, the saved state over the half-plane h1, and opening the app
// on it at a size, in a language and a view. An expression for eval in a suite:
// `const { MOB, CUBE, SIN, still, openChain } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'steps_chain_kit.js'), 'utf8'))({ ev, go, view, settled, PORT });`
({ ev, go, view, settled, PORT }) => {
  const MOB = { type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, CUBE = { type: 'pown', params: { n: 3 }, on: true }, SIN = { type: 'sin', params: {}, on: true }, EXP = { type: 'exp', params: {}, on: true };
  // the half-plane the chain is drawn over by default, and the circle some suites draw it over
  const H1 = { id: 'h1', kind: 'halfplane', a: [0, 0], b: [1, 0], ci: 0, visible: true }, S2 = { id: 's2', kind: 'circle', c: [0.3, 0.2], r: 0.8, ci: 0, visible: true };
  // (the steps view not gliding)
  const still = (o = {}) => settled(Object.assign({ until: 'window.__cmwSteps && !__cmwSteps().moving' }, o));
  // the steps view, shown and at rest with its strip's rail drawn
  const STEPS_UP = "window.__cmwSteps && __cmwSteps().on && !__cmwSteps().moving && !!document.querySelector('#svStrip .sv-rail')";
  // the steps view up with the strip's whole-map picture drawn (`until` for the suites that read it)
  const WHOLEMAP_UP = "typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip .sv-wholemap')";
  // The app opened on `steps` over `shapes` (the half-plane h1) with the source plane's view `srcView` ({ cx: 0, cy: 0, s: 90 }), under the namespace `ns` (a new one per page), at w x h (mobile: a touch
  // phone), in `lang` and `view`; it waits until the steps view is up, or in another view until `until` holds, for `max` ms at most
  // (settled's default when it is not given).
  const openChain = async ({ ns, steps, w, h, mobile = false, lang = 'en', view: vw = 'steps', until = null, max = null, shapes = [H1], srcView = { cx: 0, cy: 0, s: 90 } }) => {
    const st = { v3: true, v4: true, v5: true, v6: true, shapes, steps, nextId: 50, focus: 0, srcView };
    await view(w, h, false, mobile);
    await go(`http://localhost:${PORT}/gl-helpers.html`);
    await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
    await go(`http://localhost:${PORT}/test.html?ns=${ns}&lang=${lang}&view=${vw}`);
    await still(max ? { until: until || STEPS_UP, max } : { until: until || STEPS_UP });
  };
  return { MOB, CUBE, SIN, EXP, H1, S2, WHOLEMAP_UP, still, openChain };
}
