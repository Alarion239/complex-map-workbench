// The wait for the page that a reload brings, for the language-switch legs of the phone suites: the kit's H.reloaded with the phone's
// ready condition, and a failure the suite records. A factory, in a suite that has ev, fails and the kit's reloaded:
// `const { pageReloaded, holdClick } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'reload_wait.js'), 'utf8'))({ ev, fails, reloaded });`
// - pageReloaded(old, { limitMs }): waits until the page is a document other than the one that began at old (its performance.timeOrigin),
//   loaded, with the phone's sheets (Phone), as H.reloaded does (a call cut off by the old page is asked again, any other error
//   is thrown). When the wait ends without that, the suite fails with a check that names the part still missing and the limit,
//   and it answers false;
// - holdClick(ms): the next click on the page reaches the app ms later (a capture-phase listener stops it and sends
//   it again), so the reload that the click causes lands while the suite's own waits are in flight.
({ ev, fails, reloaded }) => {
  const pageReloaded = async (old, o = {}) => {
    try { return await reloaded(old, "typeof Phone === 'object'", o); } catch (e) {
      const m = String((e && e.message) || e);
      if (!/^the page did not finish reloading within/.test(m)) throw e;
      fails.push({ name: m, got: null });
      return false;
    }
  };
  const holdClick = (ms) => ev(`document.addEventListener('click', (e) => { e.stopImmediatePropagation(); const b = e.target; setTimeout(() => b.click(), ${ms}); }, { capture: true, once: true }), 1`);
  return { pageReloaded, holdClick };
}
