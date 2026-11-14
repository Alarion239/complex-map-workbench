// The steps view's carried colour of a parked glide frame, graded against the exact picture of that frame (held_frames'
// judge: plane z's parked frame pulled through H_u's inverse, the front sheet by the glide's own key). The default example
// (exp, then (z - 1)/(z + 1)), the thread held at u = 0.25, 0.5 and 0.75 between plane z and plane w1:
//  - the frame is drawn by the inverse pass and the judge passes: at least JUDGE_MIN_N pixels compared, at most JUDGE_OVER
//    of them more than JUDGE_TOL apart in a channel (the colour lines are left out);
//  - negative control: the cross-fade of plane z's and plane w1's parked frames at the same u (the picture a glide that
//    blended the two planes would show) does not pass the same judge.
// (100 % opacity: the front point's colour alone is read; the Opacity slider's 85 % default mixes the layers behind.)
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js).
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const { hold, grab, fade, judge, JUDGE_MIN_N } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const HELD_U = [0.25, 0.5, 0.75];
await view(1200, 800, false, false);
await go(`http://localhost:${PORT}/test.html?ns=cex${Date.now()}&view=steps`);
await settled({ max: 60000, until: 'typeof __cmwSteps === "function" && typeof __cmwSvX === "function" && !!window.GLR' });
await ev(`__cmwSet('morphPaths', false), __cmwSet('alpha', 1), __cmwSteps({ scope: 'all', surf: 'plane', bare: false }), 1`);
// (at rest on plane i, its frame drawn)
const rest = async (i) => { await ev(`__cmwSteps({ go: ${i}, now: true }), 1`); await settled({ max: 60000, until: `!__cmwSteps().moving && __cmwSvX() === ${i}` }); };
await rest(1);
ok('plane w1 parked frame settles', await grab('R1'), null);
await rest(0);
ok('plane z parked frame settles', await grab('R0'), null);
for (const u of HELD_U) {
  ok(`u = ${u}: the thread is held`, (await hold(u)).ok, null);
  ok(`u = ${u}: the moving frame settles`, await grab('M' + u), null);
  const g = await ev('(() => { const g = __cmwSteps().glide; return g && { path: g.path, b: g.b }; })()');
  ok(`u = ${u}: the frame is the inverse pass's`, !!g && g.path === 'inverse', g);
  const j = await judge('R0', 'M' + u);
  info['judge u=' + u] = j;
  ok(`u = ${u}: the carried colour is the exact picture's (judge passes)`, j.pass, j);
  ok(`u = ${u}: the cross-fade frame exists`, await fade('R0', 'R1', u, 'X' + u), null);
  const c = await judge('R0', 'X' + u);
  info['control u=' + u] = c;
  ok(`u = ${u}: negative control: a cross-fade of the two planes' frames does not pass the judge`, !c.pass && c.n >= JUDGE_MIN_N, c);
  await ev('window.__svScrubUp(), 1');
  await rest(0);
}
return { pass: fails.length === 0, fails, info };
