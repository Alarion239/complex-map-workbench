// Why the steps view's whole-plane meshes end (#2363). z³ then cos about 0, Everywhere, plane w₂ at rest at a phone's
// size, its colour plane the last plane: the pre-mapped meshes the plane's frame takes over with are __svAll (the pane's)
// and __svRing (its outer ring). Each is a SphereMesh job with a deterministic budget (the evaluations and nodes: it ends
// on 'work' or 'nodes'); the page adopts them as a pair, and only a mesh that ended so (steps_mesh_adopt_cmd.js), however
// slow the machine: a job that SM_MS_CAP CPU ms would have ended on a partial mesh runs on in idle slices (its own stop
// is much later, smRunawayMs). The page reports each mesh's end reason in __cmwSphere().entries (end). The same scene
// with the CPU slowed 1, 3, 4 and 6 times (CDP Emulation.setCPUThrottlingRate; a phone is taken as about 3 times slower
// than the CI runner's lavapipe, as #2363 does):
// - at each rate, both meshes are published, each ended on a deterministic budget (done, work or nodes), never the cap;
// - those of one key (the content and the meshing window the pane's box gave when the mesh was built: it can differ from
//   one run to the next) are one mesh (its nodes, evaluations and triangles) at every slowing, whatever the machine's
//   speed;
// - the slowing is felt: each mesh at 6 spends at least SLOW_MIN times the CPU per evaluation that it spends at 1.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the exact shard (ci/browser_shards.js).
// Prints {pass, fails, info}.
const fails = [], info = { rates: {} };
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return !!cond; };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const K = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'steps_chain_kit.js'), 'utf8'))({ ev, go, view, settled, PORT });
const RATES = [1, 3, 4, 6];
const BUILT_MAX_MS = 400000;     // the meshes are built within this at the slowest rate
const SLOW_MIN = 3;              // the least factor by which a mesh's CPU per evaluation grows from rate 1 to 6: about 6 times throttled, about 2.1 to 2.2 at most unthrottled (a cold run to a warm one)
const ENDS = ['done', 'work', 'nodes'];
const MESHES = { all: /^__svAll\|/, ring: /^__svRing\|/ };
const CHAIN = [K.CUBE, { type: 'cos', params: {}, on: true }];
// both meshes published, none building or asked for
const BUILT = '(() => { const q = __cmwSphere(); return q.entries.length >= 2 && q.jobs.length === 0 && !q.kick; })()';
const run = async (rate) => {
  await send('Emulation.setCPUThrottlingRate', { rate });
  try {
    await K.openChain({ ns: 'sme' + rate + Date.now(), steps: CHAIN, w: 390, h: 844, mobile: true, shapes: [], max: BUILT_MAX_MS });
    await ev(`__cmwSet('alpha', 1); document.querySelector('.sv-cp').click(); __cmwSteps({ scope: 'all', go: 2, now: true }); 1`);
    const w = await settled({ max: BUILT_MAX_MS, until: BUILT, only: true });
    const q = await ev('(() => { const q = __cmwSphere(); return { cap: q.cap, entries: q.entries.map((e) => ({ slot: e.slot, key: e.key, end: e.end, ms: e.ms, work: e.work, nodes: e.nodes, partial: e.partial, n: e.n })) }; })()');
    const rec = { built: !!w.ok, cap: q.cap };
    for (const [tag, re] of Object.entries(MESHES)) rec[tag] = q.entries.find((e) => re.test(e.slot)) || null;
    return rec;
  } finally { await send('Emulation.setCPUThrottlingRate', { rate: 1 }); }
};
for (const rate of RATES) {
  const rec = info.rates[rate] = await run(rate);
  ok(`slowed ${rate} times: both meshes are published, each ended on a deterministic budget`, rec.built && Object.keys(MESHES).every((t) => rec[t] && ENDS.includes(rec[t].end)), rec);
}
const base = info.rates[1], slow = info.rates[6];
for (const tag of Object.keys(MESHES)) {
  const at = RATES.map((r) => info.rates[r][tag]).filter(Boolean);
  // (one key: the meshing window follows the pane's box when the mesh is built, so two runs can mesh two windows)
  const byKey = new Map();
  for (const e of at) byKey.set(e.key, (byKey.get(e.key) || []).concat(e));
  // (a key with one mesh compares nothing: its size is in info.groups)
  info.groups = Object.assign(info.groups || {}, { [tag]: [...byKey].map(([key, same]) => ({ key, meshes: same.length })) });
  for (const [key, same] of byKey) ok(`the ${tag} mesh: those of one key that end on a deterministic budget are one mesh (nodes, evaluations, triangles), at every slowing`, same.every((e) => e.nodes === same[0].nodes && e.work === same[0].work && e.n === same[0].n), { key, same });
  const per = (e) => e.ms / Math.max(1, e.work);
  ok(`the ${tag} mesh at 6 times spends at least ${SLOW_MIN} times the CPU per evaluation that it spends at 1 (the slowing is felt)`, !!base[tag] && !!slow[tag] && per(slow[tag]) >= SLOW_MIN * per(base[tag]), { one: base[tag] && base[tag].ms / base[tag].work, six: slow[tag] && slow[tag].ms / slow[tag].work });
}
return { pass: fails.length === 0, fails, info };
