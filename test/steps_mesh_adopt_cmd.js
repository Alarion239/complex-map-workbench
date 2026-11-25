// How the steps view adopts its whole-plane meshes (#2363, step 2). z³ then cos about 0, Everywhere, plane w₂ at rest at a
// phone's size, the CPU slowed 4 times (CDP Emulation.setCPUThrottlingRate; a phone is about 3 to 4 times slower than the CI
// runner's lavapipe): the pre-mapped meshes the plane's frame takes over with are __svAll (the pane's) and __svRing (its
// outer ring), SphereMesh jobs with deterministic budgets (their map evaluations and nodes) and a safety stop in CPU
// milliseconds that ended a slow machine's job on a partial mesh. Until the pair is adopted the pane shows the pre-mapped
// stand-in. Rows, the slowed meshes rebuilt from nothing (__cmwSmReset) and sampled while they build:
// - the pair is adopted together: at no sample is one of the two meshes published and the other not;
// - never a partial mesh: the two end on their deterministic budgets (work or nodes) however slow the machine, so they are
//   the meshes the unslowed page draws (their evaluations, nodes and triangles);
// - a hidden page waits: while document.hidden the jobs spend no CPU, and they go on when it shows again;
// - a job that never ends is stopped: with the stop at RUNAWAY_MS, nothing is adopted, the key is not asked for again (the
//   jobs are none);
// - the thread leaving the plane (to the colour plane, at rest) stops the jobs and nothing is adopted for it;
// - a slice is short: the longest slice of a job is at most SLICE_MAX_FACTOR times the slice's 5 ms, per the slowing.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the exact shard (ci/browser_shards.js).
// Prints {pass, fails, info}.
const fails = [], info = { samples: [] };
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return !!cond; };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const K = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'steps_chain_kit.js'), 'utf8'))({ ev, go, view, settled, PORT });
const RATE = 4;
const BUILT_MAX_MS = 400000;
const RUNAWAY_MS = 2500;         // the stop of a job that never ends, in the runaway row (the page's is 60 s)
const SLICE_MS = 5, SLICE_MAX_FACTOR = 12;
const SAMPLE_MS = 700;
const CHAIN = [K.CUBE, { type: 'cos', params: {}, on: true }];
const BUILT = '(() => { const q = __cmwSphere(); return q.entries.length >= 2 && q.jobs.length === 0 && !q.kick; })()';
const STATE = '(() => { const q = __cmwSphere(); return { entries: q.entries.map((e) => ({ s: e.slot.split("|")[0], end: e.end, key: e.key, work: e.work, nodes: e.nodes, n: e.n })), jobs: q.jobs.map((j) => ({ s: j.slot.split("|")[0], ms: j.ms })), held: q.held.map((h) => h.split("|")[0]), capped: q.capped.length, maxSlice: q.stats.maxSlice }; })()';
const PAIR = ['__svAll', '__svRing'];
const open = async () => {
  await K.openChain({ ns: 'sma' + Date.now(), steps: CHAIN, w: 390, h: 844, mobile: true, shapes: [], max: BUILT_MAX_MS });
  await ev(`__cmwSet('alpha', 1); document.querySelector('.sv-cp').click(); __cmwSteps({ scope: 'all', go: 2, now: true }); 1`);
  return settled({ max: BUILT_MAX_MS, until: BUILT, only: true });
};
const slowed = async (f) => { await send('Emulation.setCPUThrottlingRate', { rate: RATE }); try { return await f(); } finally { await send('Emulation.setCPUThrottlingRate', { rate: 1 }); } };
const pair = (st) => PAIR.map((s) => st.entries.some((e) => e.s === s));

// the reference: unslowed, built
const built = await open();
ok('the reference page builds its meshes', !!built.ok, built);
const ref = await ev(STATE);
const refMesh = Object.fromEntries(PAIR.map((s) => [s, ref.entries.find((e) => e.s === s)]));

// the slowed meshes, built from nothing
let last = null, maxSlice = 0, everSplit = null, adoptedAt = null;
await slowed(async () => {
  await ev('__cmwSmReset(); 1');
  const t0 = Date.now();
  for (let k = 0; k < 200 && Date.now() - t0 < BUILT_MAX_MS; k++) {
    const st = await ev(STATE);
    const [a, r] = pair(st);
    if (a !== r && !everSplit) everSplit = { at: Date.now() - t0, entries: st.entries.map((e) => e.s), held: st.held, jobs: st.jobs };
    maxSlice = Math.max(maxSlice, st.maxSlice);
    const both = a && r;
    info.samples.push({ k, t: Date.now() - t0, entries: st.entries.map((e) => e.s + ':' + e.end), held: st.held, jobs: st.jobs.map((j) => j.s) });
    if (both && adoptedAt === null) adoptedAt = k;
    last = st;
    if (both && st.jobs.length === 0) break;
    await sleep(SAMPLE_MS);
  }
});
ok('the slowed meshes are both adopted in the end', adoptedAt !== null && pair(last).every(Boolean), last);
ok('the pair is adopted together: at no sample is one mesh published and the other not', !everSplit, everSplit);
const pairEnd = Object.fromEntries(PAIR.map((s) => [s, last && last.entries.find((e) => e.s === s)]));
for (const s of PAIR) {
  const e = pairEnd[s], b = refMesh[s];
  ok(`the ${s} mesh ends on a deterministic budget, never the cap`, !!e && ['work', 'nodes', 'done'].includes(e.end), e);
  ok(`the ${s} mesh is the unslowed page's (evaluations, nodes, triangles)`, !!e && !!b && e.work === b.work && e.nodes === b.nodes && e.n === b.n, { slowed: e, ref: b });
}
ok(`a slice is short: the longest is at most ${SLICE_MAX_FACTOR} times ${SLICE_MS} ms, per the ${RATE} times slowing`, maxSlice <= SLICE_MS * SLICE_MAX_FACTOR * RATE, { maxSlice });
info.adoptedAt = adoptedAt;

// a hidden page waits
await open();
await slowed(async () => {
  await ev('__cmwSmReset(); 1');
  await settled({ max: 30000, until: '__cmwSphere().jobs.length > 0', only: true });
  await ev(`Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); 1`);
  await sleep(1500);   // (a slice that began before the page hid ends first)
  const a = await ev(STATE);
  await sleep(2500);
  const b = await ev(STATE);
  const ms = (st) => st.jobs.reduce((t, j) => t + j.ms, 0);
  info.hidden = { before: ms(a), after: ms(b), jobsA: a.jobs.length, jobsB: b.jobs.length };
  ok('a hidden page waits: the jobs spend no CPU while it is hidden', a.jobs.length > 0 && b.jobs.length === a.jobs.length && ms(b) - ms(a) < 50, info.hidden);
  await ev(`delete document.hidden; 1`);
  const w = await settled({ max: BUILT_MAX_MS, until: BUILT, only: true });
  ok('and they go on when it shows again: both meshes are published', !!w.ok, w);
});

// a job that never ends is stopped, and nothing is adopted for it
await open();
await slowed(async () => {
  await ev(`__cmwSmRunaway(${RUNAWAY_MS}); __cmwSmReset(); 1`);
  const w = await settled({ max: 120000, until: '(() => { const q = __cmwSphere(); return q.capped.length > 0 && q.jobs.length === 0 && !q.kick; })()', only: true });
  const st = await ev(STATE);
  info.runaway = st;
  ok('a job past the stop is dropped and its key is capped', !!w.ok && st.capped > 0, st);
  ok('nothing is adopted: no mesh of the pair is published, none is held', st.entries.filter((e) => PAIR.includes(e.s)).length === 0 && st.held.length === 0, st);
  await sleep(3000);
  const again = await ev(STATE);
  ok('the capped key is not asked for again: no job runs', again.jobs.length === 0, again);
});
await ev('__cmwSmRunaway(0); 1');

// the thread leaves the plane
await open();
await slowed(async () => {
  await ev('__cmwSmReset(); 1');
  await settled({ max: 30000, until: '__cmwSphere().jobs.length > 0', only: true });
  await ev(`__cmwSteps({ go: 0, now: true }); 1`);
  const w = await settled({ max: 60000, until: '(() => { const q = __cmwSphere(); return q.jobs.length === 0 && !q.kick; })()', only: true });
  const st = await ev(STATE);
  info.left = st;
  ok('the thread leaving the plane stops the jobs, and nothing is adopted for it', !!w.ok && st.entries.filter((e) => PAIR.includes(e.s)).length === 0 && st.held.length === 0, st);
});
return { pass: fails.length === 0, fails, info };
