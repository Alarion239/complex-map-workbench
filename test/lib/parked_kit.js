// What the parked Repeat plane's suites share (the REPT renderer: steps_parked_repeat, steps_late_links, steps_rept_busy):
// the condition that the parked plane is drawn, and the gallery's repeated Newton step parked on plane 1, Inside regions.
// An expression for eval in a suite, which has the CDP kit's ev, settled and exampleNames:
// `const { PARKED_DRAWN, GALLERY, loadGallery, parkInside } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'parked_kit.js'), 'utf8'))({ ev, settled, exampleNames });`
// - PARKED_DRAWN: a page condition, the parked plane drawn: the chain ready (__cmwSteps().ready, false while a pane's
//   REPT draw has tiles left) and the left pane's last frame not pending (its REPT stand-in); null (no frame yet) counts
//   as pending;
// - GALLERY: the gallery example's name (Newton's map for z³ − 1 repeated 20 times);
// - loadGallery(max): on a page that is up, the gallery example loaded, waited for at most max ms;
// - parkInside(max): Inside regions, then plane 1 at once, waited for until the step has landed (at most max ms each):
//   the caller then waits on PARKED_DRAWN.
({ ev, settled, exampleNames }) => {
  const PARKED_DRAWN = "__cmwSteps().ready && __cmwSteps().ready.ready && !(__cmwPaneStatus('L') || { pending: true }).pending";
  const GALLERY = 'Newton’s method for z³ − 1';
  const loadGallery = async (max) => {
    const i = exampleNames().indexOf(GALLERY);
    if (i < 0) throw new Error(`parked_kit: no example named ${GALLERY}`);
    await ev(`__cmwExample(${i}); 1`); await settled({ max, panes: false });
  };
  const parkInside = async (max) => {
    await ev("__cmwSteps({ scope: 'in' }); 1"); await settled({ max, panes: false });
    await ev('__cmwSteps({ go: 1, now: true }); 1'); await settled({ max, until: '!__cmwSteps().anim && !__cmwSteps().play' });
  };
  return { PARKED_DRAWN, GALLERY, loadGallery, parkInside };
}
