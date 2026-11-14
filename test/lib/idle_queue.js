// The steps view's idle job, run by the test (steps_idle_forced_cmd.js, steps_glide_cost_cmd.js). An expression for eval in a suite:
// `const { holdIdle, runIdle } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'idle_queue.js'), 'utf8'))({ ev })`.
// - holdIdle(): from here the page's idle moments are the test's own: each callback it asks for is queued, not run;
// - runIdle(n, deadline): runs the queued callbacks in turn, each asked for by the one before, at most n of them, each given deadline (the
//   source of an IdleDeadline: '{ timeRemaining: () => 0, didTimeout: true }'); answers the page's path stats of the run
//   with callbacks (how many ran) and busy (whether the job still has work).
({ ev }) => ({
  holdIdle: () => ev('window.__svIdleQ = [], window.requestIdleCallback = (f) => (window.__svIdleQ.push(f), 1), 1'),
  runIdle: (n, deadline) => ev(`(() => { globalThis.__svPathStats = {}; const q = window.__svIdleQ; let k = 0; while (q.length && k < ${n}) { k++; q.shift()(${deadline}); } const s = globalThis.__svPathStats; globalThis.__svPathStats = null; s.callbacks = k; s.busy = __cmwSvKey().busy; return s; })()`),
})
