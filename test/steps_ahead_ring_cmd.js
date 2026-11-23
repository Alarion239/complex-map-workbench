// The render-ahead wait's ring (#2316): while a glide's frames are drawn ahead (#1339), the gate's ring (--wait on the
// control the wait is on) fills by the share of the frames made. z^-2 with a disc about 0, Everywhere, on the plane, at
// the fast speed; the cost at most which a motion plays live is set to 0 (ahead: { ms: 0 }) and the wait's cap lifted, so
// the frames are drawn ahead on any machine, and the CPU is slowed THROTTLE times so that the wait outlasts the gate's
// pause before it shows its ring (SV_GATE_SHOW_MS) and the ring is set while the frames are made:
// - the chain's first glide plays live, and its frame cost is measured after it ends (the probe);
// - at rest on plane 0, everything ready, the glide 0 -> 1 waits while its frames are made. Every time the ring's fill
//   is set, the page records it with the frames made then, n of N (read in the same task: a frame is made in a task of
//   its own);
// - ring: the ring is set at least MIN_SETS times while the frames are made (0 < n < N);
// - tracks: each time, the fill is the share of the frames made, n / N, within TOL;
// - never back: the fill never goes down;
// - control: all the frames are made, and the glide starts on them.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
let pass = 0;
const ok = (name, cond, got) => { if (cond) pass++; else fails.push({ name, got }); return !!cond; };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const goOk = async (url) => { if (!(await go(url))) throw new Error('no load event for ' + url); };
const WAIT_MS = 120000, THROTTLE = 40, MIN_SETS = 3, TOL = 0.02;
const STATE = { v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 }, sv: { speed: 'fast' },
  shapes: [{ id: 'd1', kind: 'disc', c: [0, 0], r: 0.5, ci: 0, visible: true }], steps: [{ type: 'pown', params: { n: -2 }, on: true }] };
// every value the ring's fill is set to, with the frames made then, in window.__ring: [{ w, n, N, state }]
const WATCH = `(() => {
  window.__ring = [];
  new MutationObserver((ms) => {
    for (const m of ms) {
      const w = m.target.style && m.target.style.getPropertyValue('--wait');
      if (!w) continue;
      const a = __cmwSteps().ahead;
      __ring.push({ w: +w, n: a ? a.n : null, N: a ? a.N : null, state: a ? a.state : null });
    }
  }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['style'] });
  return 1;
})()`;
const ns = `aheadring${Date.now()}`;
await view(900, 600, false, false);
await goOk(`http://localhost:${PORT}/gl-helpers.html`);
await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(STATE))}); 1`);
await goOk(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
const up = await settled({ only: true, max: 60000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
if (!up.ok) throw new Error('the page hooks are not up: ' + JSON.stringify(up));
const rest = async (i) => {
  await ev(`__cmwSteps({ go: ${i}, now: true }), 1`);
  await settled({ only: true, max: 60000, until: `!__cmwSteps().moving && __cmwSteps().x === ${i} && __cmwSteps().ready.ready` });
};
await ev(`__cmwSet('morphPaths', false), __cmwSteps({ scope: 'all', surf: 'plane', ahead: { ms: 0, waitMs: ${WAIT_MS} } }), 1`);
await rest(0);

// ---- the chain's first glide plays live; its frame cost is measured after it ends ----
await ev('__cmwSteps({ clock: 1000 / 60, go: 1 }), 1');
await settled({ only: true, max: 60000, until: '!__cmwSteps().moving' });
const m = await settled({ only: true, max: WAIT_MS, until: '(() => { const p = __cmwSteps().aheadProbe; return !!p && p.state !== "waiting" && p.state !== "drawing"; })()' });
const p = await ev('({ cost: __cmwSteps().aheadCost, probe: __cmwSteps().aheadProbe })');
info.probe = p;
if (!m.ok || !p.probe || p.probe.state !== 'done') throw new Error('the frames\' probe did not end: ' + JSON.stringify(p));

// ---- the glide 0 -> 1 from rest, everything else ready: its wait is the frames' alone ----
await rest(0);
await ev(WATCH);
await send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
let g = null;
try {
  await ev('__cmwSteps({ clock: 1e-6 }), __cmwSteps({ go: 1 }), 1');
  g = await settled({ only: true, max: WAIT_MS, until: '!!__cmwSteps().anim' });
} finally { await send('Emulation.setCPUThrottlingRate', { rate: 1 }); }
const ring = await ev('__ring'), A = await ev('__cmwSteps().ahead');
const during = ring.filter((r) => r.state === 'fill' && r.n > 0 && r.n < r.N);
info.ring = ring.map((r) => `${r.w.toFixed(3)} @ ${r.n}/${r.N} ${r.state}`);
ok(`ring: the ring is set at least ${MIN_SETS} times while the frames are made`, during.length >= MIN_SETS, info.ring);
const off = during.filter((r) => Math.abs(r.w - r.n / r.N) > TOL);
ok(`tracks: each time, the ring's fill is the share of the frames made, within ${TOL}`, during.length > 0 && off.length === 0, off.map((r) => `${r.w.toFixed(3)} @ ${r.n}/${r.N}`));
ok('never back: the fill never goes down', ring.every((r, i) => i === 0 || r.w >= ring[i - 1].w), info.ring);
ok('control: all the frames are made, and the glide starts on them', !!g && g.ok && !!A && A.state === 'done' && A.n === A.N && A.N > 2, { g, A: A && { state: A.state, n: A.n, N: A.N } });
await ev('__cmwSteps({ clock: 1000 / 60 }), 1');
await settled({ only: true, max: 60000, until: '!__cmwSteps().moving' });

return { pass: fails.length === 0, passed: pass, fails, info };
