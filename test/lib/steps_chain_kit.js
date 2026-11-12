// What the suites that open the app on a saved chain share (steps_canvas_stack_cmd.js, steps_phone_stack_cmd.js,
// steps_width_cmd.js, steps_long_549_cmd.js): the chain's steps, the saved state over the half-plane h1, and opening the app
// on it at a size, in a language and a view. An expression for eval in a suite:
// `const { MOB, CUBE, SIN, still, openChain } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'steps_chain_kit.js'), 'utf8'))({ ev, go, view, settled, PORT });`
({ ev, go, view, settled, PORT }) => {
  const MOB = { type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, CUBE = { type: 'pown', params: { n: 3 }, on: true }, SIN = { type: 'sin', params: {}, on: true };
  // (the steps view not gliding)
  const still = (o = {}) => settled(Object.assign({ until: 'window.__cmwSteps && !__cmwSteps().moving' }, o));
  // the steps view, shown and at rest with its strip's rail drawn
  const STEPS_UP = "window.__cmwSteps && __cmwSteps().on && !__cmwSteps().moving && !!document.querySelector('#svStrip .sv-rail')";
  // The app opened on `steps` over the half-plane h1 under the namespace `ns` (a new one per page), at w x h (mobile: a touch
  // phone), in `lang` and `view`; it waits until the steps view is up, or in another view until `until` holds.
  const openChain = async ({ ns, steps, w, h, mobile = false, lang = 'en', view: vw = 'steps', until = null }) => {
    const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'h1', kind: 'halfplane', a: [0, 0], b: [1, 0], ci: 0, visible: true }], steps, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } };
    await view(w, h, false, mobile);
    await go(`http://localhost:${PORT}/gl-helpers.html`);
    await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
    await go(`http://localhost:${PORT}/test.html?ns=${ns}&lang=${lang}&view=${vw}`);
    await still({ until: until || STEPS_UP });
  };
  return { MOB, CUBE, SIN, still, openChain };
}
