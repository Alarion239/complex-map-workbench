// The waits the suites share (the phone suites first), written once. In a suite:
//   const { until, reachable, sheetSettled } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'wait_kit.js'), 'utf8'))({ settled, ev, sleep, fails });
// until(expr, max) waits for one condition (an expression in the page) and records a failure that names it when it has not
// come true by max ms; the options of the factory set the suite's default max and, with only, wait for the condition alone
// (polled, with no animation frames) where the page's own quiet would use up a time-limited state.
// prepared(also, max, { only }): the steps view's chain is prepared (__cmwSteps().ready.ready: its programs linked, the carried
// colour's warm draw made, the idle jobs finished, which is what a press of Play or an arrow waits for behind the gate) and `also`
// (an expression in the page, none by default) holds. When it has not come by max ms (PREPARED_MS by default) it answers as settled
// does (ok false) and records a failure that names the parts of the chain not done (jobs 1/3), that the chain is not up (no steps view,
// no step or no GL: ready.total 0), or the extra condition when the chain is prepared.
// still(read, step, limit, flag): read() (an async reading of the page, JSON-comparable) again every step ms until two
// readings in a row agree, and that reading; the last one if none has by limit ms (the default max). With flag, the
// answer is { reading, agreed }: agreed false when it is the last one.
({ settled, ev, sleep, fails, max = 8000, only = false }) => {
  const PREPARED_MS = 60000;
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
  const still = async (read, step, limit = max, flag = false) => {
    const answer = (s, agreed) => (flag ? { reading: JSON.parse(s), agreed } : JSON.parse(s));
    let a = JSON.stringify(await read());
    for (let i = 0; i < limit / step; i++) { await sleep(step); const b = JSON.stringify(await read()); if (a === b) return answer(b, true); a = b; }
    return answer(a, false);
  };
  const prepared = async (also = 'true', ms = PREPARED_MS, o = {}) => {
    const r = await settled({ until: `__cmwSteps().ready.ready && (${also})`, max: ms, only: o.only === undefined ? only : o.only });
    if (!r.ok) {
      const why = await ev(`(() => { const r = __cmwSteps().ready; return { total: r.total, left: Object.entries(r.parts || {}).filter(([, p]) => p.done !== p.total).map(([k, p]) => k + ' ' + p.done + '/' + p.total).join(', ') }; })()`);
      if (why.left) fails.push({ name: 'the chain was not prepared in time', got: why.left });
      else if (!why.total) fails.push({ name: 'the chain is not up (the steps view is off, there is no step, or there is no GL)', got: 'ready.total 0' });
      else fails.push({ name: 'the extra condition of prepared() did not hold', got: also });
    }
    return r;
  };
  return { until, reachable, sheetSettled, still, prepared };
};
