// The steps view's idle job, run by the test (steps_idle_forced_cmd.js, steps_glide_cost_cmd.js). An expression for eval in a suite:
// `const { holdIdle, runIdle, releaseIdle } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'idle_queue.js'), 'utf8'))({ ev })`.
// - holdIdle(): from here the page's idle moments are the test's own: each callback it asks for is queued, not run;
// - runIdle(n, deadline): runs the queued callbacks in turn, each asked for by the one before, at most n of them, each given deadline (the
//   source of an IdleDeadline: '{ timeRemaining: () => 0, didTimeout: true }'); answers the page's path stats of the run
//   with callbacks (how many ran) and busy (whether the job still has work);
// - releaseIdle(): the page's own idle moments again: the callbacks queued since holdIdle() are asked of the page's own
//   requestIdleCallback, and so is each one asked for from now on (a job that began while the idle moments were held keeps the
//   function it found then, which now passes them on), so the job goes on as it would have.
({ ev }) => ({
  holdIdle: () => ev('window.__svRic0 = window.__svRic0 || window.requestIdleCallback, window.__svIdleHeld = true, window.__svIdleQ = [], window.requestIdleCallback = (f, o) => (window.__svIdleHeld ? (window.__svIdleQ.push(f), 1) : window.__svRic0.call(window, f, o)), 1'),
  releaseIdle: () => ev('(() => { if (!window.__svRic0) return 0; window.__svIdleHeld = false; const q = window.__svIdleQ.splice(0); for (const f of q) window.__svRic0.call(window, f); return q.length; })()'),
  runIdle: (n, deadline) => ev(`(() => { globalThis.__svPathStats = {}; const q = window.__svIdleQ; let k = 0; while (q.length && k < ${n}) { k++; q.shift()(${deadline}); } const s = globalThis.__svPathStats; globalThis.__svPathStats = null; s.callbacks = k; s.busy = __cmwSvKey().busy; return s; })()`),
})
