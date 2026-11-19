// The wait kit's prepared(also, max) (test/lib/wait_kit.js): the one wait a steps suite makes for the chain to be prepared
// (__cmwSteps().ready.ready: its programs linked, the carried colour's warm draw made, the idle jobs finished; a press of Play
// or an arrow waits for it behind the gate), with its extra condition `also`.
//   - the chain prepared: it returns ok and records no failure;
//   - a part not done (the test hook holdJobs counts the idle jobs unfinished): it gives up at its bound and records one failure
//     that names the part and how far it is (jobs 0/3), and when the part is released it is ok again;
//   - an extra condition that does not hold while the chain is prepared: the failure names that condition, and no part.
// It runs in the steps view. A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const GIVE_UP_MS = 1500, WARM_MS = 120000;
await view(1440, 900, false, false);
await load('kitprep' + Date.now(), {});
await ev('(__cmwExample(1), 1)');
await ev('(__cmwSteps({ go: 0, now: true }), 1)');
await settled({ max: WARM_MS, only: true, until: '__cmwSteps().ready.total > 0' });
// each leg has its own kit, so its failures are read apart from the suite's
const legKit = () => { const own = []; return { own, kit: eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'wait_kit.js'), 'utf8'))({ settled, ev, sleep, fails: own }) }; };

// the chain prepared
{
  const { own, kit } = legKit();
  const r = await kit.prepared('true', WARM_MS);
  info.prepared = { r: r && r.ok, own };
  ok('a prepared chain: prepared() is ok', !!r && r.ok === true, info.prepared);
  ok('a prepared chain: it records no failure', own.length === 0, own);
}

// a part not done
{
  const { own, kit } = legKit();
  await ev('(__cmwSteps({ holdJobs: true }), 1)');
  const t0 = Date.now();
  const r = await kit.prepared('true', GIVE_UP_MS);
  const took = Date.now() - t0;
  info.held = { r: r && r.ok, took, own };
  ok('a held part: prepared() gives up and says so (ok false)', !!r && r.ok === false, info.held);
  ok('a held part: it gave up near its bound, not at the kit\'s default', took < GIVE_UP_MS * 6, took);
  ok('a held part: one failure, naming the chain as not prepared and the part (jobs 0/3)', own.length === 1 && /not prepared/.test(own[0].name) && /jobs 0\/3/.test(String(own[0].got)), own);
  await ev('(__cmwSteps({ holdJobs: false }), 1)');
  const { own: own2, kit: kit2 } = legKit();
  const r2 = await kit2.prepared('true', WARM_MS);
  ok('the part released: prepared() is ok again', !!r2 && r2.ok === true && own2.length === 0, { r2, own2 });
}

// an extra condition that does not hold
{
  const { own, kit } = legKit();
  const r = await kit.prepared('window.__never === 1', GIVE_UP_MS);
  info.also = { r: r && r.ok, own };
  ok('an extra condition that never holds: ok false', !!r && r.ok === false, info.also);
  ok('an extra condition that never holds: the failure names it and no part', own.length === 1 && /window\.__never === 1/.test(String(own[0].got)) && !/\d\/\d/.test(String(own[0].got)), own);
}
return { pass: fails.length === 0, fails, info };
