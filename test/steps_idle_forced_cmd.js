// The steps view's idle job (pole tracks, outer ring sizes) under a page whose idle moments never come: the browser
// runs the callback only for its timeout (didTimeout, timeRemaining() 0). The Mountain King with a step put before
// both of its glides, so the Möbius glide's tracks are to be made:
// - a callback run in an idle moment with no time remaining does no work;
// - a callback run for its timeout does one slice of SV_POLE_BUDGET ms, so the job advances and ends.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1200, 800, false, false);
const { exampleNames } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'carry_kit.js'), 'utf8'));
const { holdIdle, runIdle } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'idle_queue.js'), 'utf8'))({ ev });
const names = exampleNames();
const ex = names.indexOf('In the Hall of the Mountain King');
ok('the Mountain King example is found', ex >= 0, names.length);
await go(`http://localhost:${PORT}/test.html?view=steps&ns=if${Date.now()}`);
await settled({ max: 30000, until: 'typeof __cmwExample === "function" && typeof __cmwSteps === "function" && typeof __cmwSvKey === "function"' });
await ev(`__cmwExample(${ex}); 1`);
await settled({ max: 30000, panes: false });
await ev(`__cmwSteps(${JSON.stringify({ scope: 'all', surf: 'plane', go: 0, now: true })}); 1`);
await settled({ max: 30000, panes: false, until: '!__cmwSvKey().busy' });
// (from here the idle moments are the test's own: each callback asked for is queued)
await holdIdle();
const planes0 = await ev('__cmwSteps().planes.length');
await ev(`__cmwAddStep('mul', { c: '1' }, 0), 1`);
await settled({ max: 30000, panes: false, until: `__cmwSteps().planes.length === ${planes0 + 1}` });
const idle = await runIdle(50, '{ timeRemaining: () => 0, didTimeout: false }');
const forced = await runIdle(5000, '{ timeRemaining: () => 0, didTimeout: true }');
info.idle = idle; info.forced = forced;
ok('an idle callback with no time remaining does no work', !(idle.poleIdle > 0) && !(idle.ringIdle > 0), idle);
ok('a callback run for its timeout does a slice each: the job advances', forced.poleIdle > 0, forced);
ok('and the job ends', !forced.busy, forced);
return { pass: fails.length === 0, fails, info };
