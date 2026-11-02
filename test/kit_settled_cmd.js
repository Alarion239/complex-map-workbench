// H.settled's `only` option and its `at` answer (test/cdp_kit/cdpd.js): the suites that wait for one condition use them.
//   - a condition that comes: ok, at = the ms it took (>= 0, and the same as ms);
//   - a condition that never comes: not ok, at = -1, after about its max, and the suite's log says so;
//   - a condition that throws is not met: at = -1;
//   - `only` asks nothing of the page's quiet: with a finite animation still running it answers at once, where the plain
//     settled() waits for the animation to end.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
await go(`http://localhost:${PORT}/test.html`);
const yes = await settled({ until: 'document.readyState === "complete"', max: 3000, only: true });
ok('a condition that comes: ok, at is the wait', yes.ok && yes.at >= 0 && yes.at === yes.ms, yes);
const t0 = Date.now();
const never = await settled({ until: 'false', max: 600, only: true });
const took = Date.now() - t0;
ok('a condition that never comes: not ok, at is -1', !never.ok && never.at === -1, never);
ok('... after about its max', took >= 600 && took < 3000, took);
const boom = await settled({ until: 'throw new Error("x")', max: 400, only: true });
ok('a condition that throws is not met: at is -1', !boom.ok && boom.at === -1, boom);
await ev(`window.__anim = document.body.animate([{ opacity: 1 }, { opacity: 1 }], { duration: 2500 }), true`);
const quick = await settled({ until: 'true', max: 5000, only: true });
ok('only: a running finite animation does not hold it', quick.ok && quick.ms < 1000, quick);
const plain = await settled({ until: 'true', max: 5000, panes: false });
ok('(plain settled waits for the animation to end)', plain.ok && plain.ms >= 1000, plain);
info.times = { yes: yes.at, took, quick: quick.ms, plain: plain.ms };
return { pass: fails.length === 0, fails, info };
