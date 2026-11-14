// The wait for the page that a reload brings, for the language-switch legs of the phone suites. An expression for eval in
// a suite that has ev, sleep and fails: `const { reloaded, holdClick } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'reload_wait.js'), 'utf8'))`.
// - reloaded(old): waits until the page is a document other than the one that began at old (its performance.timeOrigin),
//   loaded, with the phone's sheets (Phone). A call that is in flight when the old page goes away is cut off with
//   NAV_ERROR; that error, and only that one, is the cue to ask again here. Any other error is thrown. The wait ends
//   after RELOAD_WAIT_MS, and the suite then fails with a check that names the part still missing;
// - holdClick(ms): the next click on the page reaches the app ms later (a capture-phase listener stops it and sends
//   it again), so the reload that the click causes lands while the suite's own waits are in flight.
(() => {
  const NAV_ERROR = 'Inspected target navigated or closed';
  const RELOAD_WAIT_MS = 20000, RELOAD_POLL_MS = 50;
  const reloaded = async (old) => {
    const t0 = Date.now();
    let parts = null;
    for (;;) {
      try {
        const r = await ev(`({ newDocument: performance.timeOrigin !== ${old}, loaded: document.readyState === 'complete', phone: typeof Phone === 'object' })`);
        if (r && r.newDocument !== undefined) { parts = r; if (r.newDocument && r.loaded && r.phone) return true; }
      } catch (e) { if (!String((e && e.message) || e).includes(NAV_ERROR)) throw e; }
      if (Date.now() - t0 > RELOAD_WAIT_MS) {
        const missing = parts ? Object.keys(parts).filter((k) => !parts[k]) : ['any answer'];
        fails.push({ name: `the page did not finish reloading within ${RELOAD_WAIT_MS} ms (missing: ${missing.join(', ')})`, got: parts });
        return false;
      }
      await sleep(RELOAD_POLL_MS);
    }
  };
  const holdClick = (ms) => ev(`document.addEventListener('click', (e) => { e.stopImmediatePropagation(); const b = e.target; setTimeout(() => b.click(), ${ms}); }, { capture: true, once: true }), 1`);
  return { reloaded, holdClick };
})()
