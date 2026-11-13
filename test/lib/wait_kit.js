// The waits the phone suites share, written once. In a suite:
//   const { until, reachable, sheetSettled } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'wait_kit.js'), 'utf8'))({ settled, ev, sleep, fails });
// until(expr, max) waits for one condition (an expression in the page) and records a failure that names it when it has not
// come true by max ms; the options of the factory set the suite's default max and, with only, wait for the condition alone
// (polled, with no animation frames) where the page's own quiet would use up a time-limited state.
({ settled, ev, sleep, fails, max = 8000, only = false }) => {
  const until = async (expr, ms = max) => { const r = await settled({ until: expr, max: ms, only }); if (!r.ok) fails.push({ name: 'wait timed out', got: expr }); return r; };
  // a tap on it would reach it and stay on it: it is inside the open sheet (the app scrolls the card it added into view
  // with a smooth scroll, which the page cannot list as an animation, and until then the card can lie below the sheet),
  // it is the element at its own centre, and neither it nor anything the sheet scrolls has moved for `hold` ms; false if
  // that has not come by `limit` ms
  const reachable = async (sel, hold = 400, limit = 8000) => {
    const probe = `(() => {
      const e = document.querySelector(${JSON.stringify(sel)}), sh = document.querySelector('.ph-sheet');
      const b = e && e.getClientRects().length ? e.getBoundingClientRect() : null, v = sh && sh.getBoundingClientRect();
      const hit = b && document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      return hit && e.contains(hit) && b.top >= v.top - 0.5 && b.bottom <= v.bottom + 0.5
        ? [b.left, b.top, ...[...sh.querySelectorAll('*')].map((x) => x.scrollTop).filter(Boolean)].join() : '';
    })()`;
    const t0 = Date.now();
    let last = '', since = t0;
    while (Date.now() - t0 < limit) {
      const k = await ev(probe), now = Date.now();
      if (!k || k !== last) since = now;
      last = k;
      if (k && now - since >= hold) return true;
      await sleep(30);
    }
    return false;
  };
  // the sheet of this kind is open and has finished sliding; `split`: the planes have been resized above it
  const sheetSettled = (kind, split) => `(() => { const sh = document.querySelector('.ph-sheet'); const r = document.documentElement; return Phone._state().kind === '${kind}' && Phone._state().split === ${!!split} && !!sh && !sh.hidden && sh.classList.contains('open') && !r.classList.contains('ph-ride') && sh.getAnimations().length === 0; })()`;
  return { until, reachable, sheetSettled };
};
