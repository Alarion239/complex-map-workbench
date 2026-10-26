// GLSL parity of the inverse renderer (SPEC 12.2), a command file for a CDP daemon (test/cdp_kit, ANGLE Metal):
//   python3 test/make_glsl_inverse_test.py
//   test/<you>_cdp/q.sh test/glsl_inverse_cmd.js
// Prints the summary; exit criteria: walk.failCount 0, clip.failCount 0, fs flat and sphere true, flip.ok true.
// globalThis.__GIT = {chains, shapesPerChain, clipShapes, seed} in a preceding command narrows the run.
const evp = new Function('ev', 'sleep', fs.readFileSync(path.join(DIR, '../inv_bench_evp.js'), 'utf8'))(ev, sleep);
await nav('http://localhost:9502/glsl-inverse-test.html');
const r = await evp(`__invTestRun(${JSON.stringify(globalThis.__GIT || {})})`, 1800000);
const pass = r.failCount === 0 && r.clip && r.clip.failCount === 0 && r.fs && r.fs.flat && r.fs.sphere && (!r.flip || r.flip.ok) && !r.errors.length;
return { pass, anchors: r.anchors, walk: { cases: r.cases, eligibleCases: r.eligibleCases, programs: r.programs, points: r.points, compared: r.compared, leaves: r.leaves, skipped: r.skipped, failCount: r.failCount, byChain: r.byChain, fails: r.fails.filter((f, i) => i < 12 || !r.fails.slice(0, i).some((g) => g.chain === f.chain)) },
  rational: r.rational, clip: r.clip, fs: r.fs, flip: r.flip, errors: r.errors.slice(0, 10), ms: r.ms, logs: logs().filter((l) => l.t !== 'log-error').slice(0, 10) };
