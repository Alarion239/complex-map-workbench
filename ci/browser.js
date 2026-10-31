'use strict';
// The functional browser suites (test/*_cmd.js: the tour, constructions, touch, phone layouts, the i18n walks, export,
// sound, ...), one after another, each in its own headless Chrome: a fresh copy of the test/cdp_kit daemon whose port
// is this runner's server of dist/. Exit 1 when one fails. Each suite's result goes to the log in a collapsible group;
// the job summary gets one row per suite.
//   node ci/browser.js [--shard ID] [--only REGEX] [--no-build] [--port N] [--list]
// Suites are found by the glob, so a new one runs with no edit here (ci/browser_shards.js puts it in its catch-all
// shard); EXCLUDED (ci/browser_suites.js) lists the files that are not pass/fail suites and those that need the GPU
// machines. Speed is gated only by the perf suite on our GPU machines (gpu-gate.yml), and GitHub's machines render
// WebGL in software, so a suite's timing checks (frame budgets, BUDGET60, absolute time limits: TIMING) are reported
// with their numbers and do not fail the job; its correctness checks do. SOFTWARE lists the checks that fail only
// because those machines draw in software (each with its reason, and the evidence from the check's own detail), and
// KNOWN the failures that are understood and open (each with its reason): the summary prints both, the job does not
// fail on them.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { ROOT, PY, serve, summary, run, esc } = require('./lib');
const { SUITES, EXCLUDED, TIMING, SOFTWARE, KNOWN, PAGES, ALWAYS } = require('./browser_suites');
const { suitesOf } = require('./browser_shards');

const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const only = opt('--only') ? new RegExp(opt('--only')) : null;
const shard = opt('--shard');
const gh = !!process.env.GITHUB_ACTIONS;
const OUT = path.join(ROOT, '.ci', 'browser');
const KIT = path.join(ROOT, 'test', 'cdp_kit');
// (the suites find dist/ at DIR/../../dist: the kit copy is a folder of test/, as test/cdp_kit/README.md says)
const COPY = path.join(ROOT, 'test', 'ci_cdp');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const secs = (ms) => `${(ms / 1000).toFixed(0)} s`;

// every test/*_cmd.js; -> the runs to make here, [{ file, run }] (a suite may run more than once: SUITES[f].runs; a
// shard may take some of them, 'file#label')
function selected() {
  const all = fs.readdirSync(path.join(ROOT, 'test')).filter((f) => /_cmd\.js$/.test(f)).sort();
  // (--include-excluded: the EXCLUDED files that --only names, run by hand: test/landscape_walls_cmd.js, ci/README.md)
  const suites = all.filter((f) => !EXCLUDED[f] || (only && argv.includes('--include-excluded') && only.test(f)));
  const entries = (shard ? suitesOf(shard, suites) : suites).filter((e) => !only || only.test(e));
  const runs = [];
  for (const e of entries) {
    const [file, label] = e.split('#');
    for (const r of (SUITES[file] && SUITES[file].runs) || [{}]) if (!label || r.label === label) runs.push({ file, run: r });
  }
  return { all, runs };
}

// the daemon and everything it started (Chrome): its own process group on POSIX, taskkill /T on Windows
// (POSIX: also after the daemon exited, its Chrome may still be in the group)
function killTree(child) {
  try {
    if (process.platform !== 'win32') process.kill(-child.pid, 'SIGKILL');
    else if (child.exitCode == null) require('child_process').spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F']);
  } catch (e) { /* gone */ }
}

// waits for one of the files (or the daemon's exit, or the time limit); -> the file found, 'exit' or 'timeout'
async function waitFor(files, child, ms) {
  const t0 = Date.now();
  for (;;) {
    for (const f of files) if (fs.existsSync(f)) return f;
    if (child.exitCode != null || child.signalCode != null) return 'exit';
    if (Date.now() - t0 > ms) return 'timeout';
    await sleep(200);
  }
}

// one run of one suite in a fresh daemon; -> { out (its return value), error, log, ms }
async function runOne(file, run, port) {
  fs.rmSync(COPY, { recursive: true, force: true });
  fs.cpSync(KIT, COPY, { recursive: true, filter: (s) => !/[\\/](q|shots|chprof-[^\\/]*)$/.test(s) });
  // the suites read the port from the copy's cdpd.js (/localhost:(\d+)/), and its load() opens it
  const daemon = path.join(COPY, 'cdpd.js');
  fs.writeFileSync(daemon, fs.readFileSync(daemon, 'utf8').replace(/localhost:8793/g, `localhost:${port}`));
  const env = Object.assign({}, process.env, {
    // the suites that take the server from the environment (sound_*: CMW_PORT; export, mv_views: CMW_BASE)
    CMW_PORT: String(port), CMW_BASE: `http://localhost:${port}/`,
  }, run.env || {});
  const t0 = Date.now();
  const child = spawn(process.execPath, [daemon], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
  let log = '';
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });
  const Q = path.join(COPY, 'q'), FATAL = path.join(Q, 'FATAL');
  try {
    const up = await waitFor([path.join(Q, 'READY'), FATAL], child, 90 * 1000);
    if (!up.endsWith('READY')) return { error: `the daemon did not start (${up === 'exit' ? `exit ${child.exitCode != null ? child.exitCode : child.signalCode}` : path.basename(up)})`, log: log + readIf(FATAL), ms: Date.now() - t0 };
    const body = fs.readFileSync(path.join(ROOT, 'test', file), 'utf8');
    // (a preamble on the suite's first line keeps its line numbers)
    fs.writeFileSync(path.join(Q, '1.tmp'), (run.preamble ? run.preamble.replace(/\n/g, ' ') + ' ' : '') + body);
    fs.renameSync(path.join(Q, '1.tmp'), path.join(Q, '1.js'));
    const done = await waitFor([path.join(Q, '1.out'), FATAL], child, (run.timeoutMin || 30) * 60 * 1000);
    const ms = Date.now() - t0;
    if (done === 'timeout') return { error: `no result after ${run.timeoutMin || 30} min`, log, ms };
    if (!done.endsWith('1.out')) return { error: `the daemon stopped (${path.basename(done)})`, log: log + readIf(FATAL), ms };
    let out;
    try { out = JSON.parse(fs.readFileSync(done, 'utf8')); } catch (e) { return { error: `the result is not JSON: ${e.message}`, log, ms }; }
    return { out, log, ms };
  } finally {
    try { fs.writeFileSync(path.join(Q, 'QUIT'), ''); } catch (e) { /* no queue: the daemon never got that far */ }
    await waitFor([], child, 5000);
    killTree(child);
    keepShots(file, run);
    fs.rmSync(COPY, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
  }
}
const readIf = (f) => (fs.existsSync(f) ? '\n' + fs.readFileSync(f, 'utf8') : '');
const shotsDir = (file, run) => path.join(OUT, 'shots', file.replace(/\.js$/, '') + (run.label ? '-' + run.label.replace(/[^\w.-]+/g, '_') : ''));
function keepShots(file, run) {
  const s = path.join(COPY, 'shots');
  if (!fs.existsSync(s)) return;
  const d = shotsDir(file, run);
  fs.rmSync(d, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(d), { recursive: true });
  fs.renameSync(s, d);
}

// the checks that failed, from a suite's return value ({ pass, fails: [{ name, got }] }, fails as [name, false, detail]
// or names with the details in info, { ok }, { pass, of }); null when it has no verdict this runner can read
function failures(out) {
  if (out == null || typeof out !== 'object' || Array.isArray(out)) return null;
  if (out.__daemonError) return [{ name: 'the suite threw', detail: out.__daemonError }];
  // (a suite whose fails are names keeps each check's detail in out.info[name]: the release smokes)
  const info = out.info && typeof out.info === 'object' && !Array.isArray(out.info) ? out.info : {};
  const item = (f) => (Array.isArray(f) ? { name: String(f[0]), detail: f[2] } : typeof f === 'string' ? { name: f, detail: info[f] }
    : { name: String(f.name || f.check || f.msg || JSON.stringify(f)), detail: f.got !== undefined ? f.got : f.info !== undefined ? f.info : f.detail });
  const list = Array.isArray(out.fails) ? out.fails.map(item) : Array.isArray(out.failed) ? out.failed.map(item) : null;
  const verdict = typeof out.pass === 'boolean' ? out.pass : typeof out.ok === 'boolean' ? out.ok
    : typeof out.pass === 'number' && typeof out.of === 'number' ? out.pass === out.of : list ? !list.length : null;
  if (verdict == null) return null;
  if (list && list.length) return list;
  return verdict ? [] : [{ name: typeof out.pass === 'number' ? `${out.pass} of ${out.of} checks passed` : 'the suite says it failed', detail: out }];
}
// the entry of a list (TIMING, SOFTWARE, KNOWN) that a failed check matches: by name, and, when the entry has a
// `measured` predicate, only when the check's detail shows that cause
const matches = (list, f) => (list || []).find((k) => {
  if (!k.re.test(f.name)) return false;
  try { return !k.measured || !!k.measured(f.detail); } catch (e) { return false; }
});
// a timing check that missed its budget (and, when it asserts more, whose other part held)
const isTiming = (file, f) => /BUDGET60/.test(f.name) || !!matches(TIMING[file], f);
const short = (v, n = 300) => { const s = typeof v === 'string' ? v : JSON.stringify(v); return s === undefined ? '' : s.length > n ? s.slice(0, n) + '…' : s; };

async function main() {
  const { all, runs } = selected();
  if (argv.includes('--list')) { for (const x of runs) console.log(x.file + (x.run.label ? '#' + x.run.label : '')); return 0; }
  if (!runs.length) { summary(`### Browser suites${shard ? ' (' + shard + ')' : ''}: none selected\n`); return 0; }
  if (!argv.includes('--no-build') && run(PY, ['build.py']) !== 0) throw new Error('build failed');
  // the extra pages some suites open (old versions of the app, built from their commits; the published page as served)
  const dist = path.join(ROOT, 'dist');
  for (const p of new Set([...ALWAYS, ...runs.flatMap((x) => (SUITES[x.file] && SUITES[x.file].pages) || [])])) PAGES[p](dist, p);
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve(dist, Number(opt('--port', 0)));
  const port = srv.server.address().port;
  console.log(`dist/ at ${srv.base}; ${runs.length} run(s)${shard ? ` of shard ${shard}` : ''}`);
  const rows = [], timing = [], soft = [], known = [];
  let failed = 0, n = 0;
  const t00 = Date.now();
  try {
    for (const { file, run: r } of runs) {
      const cfg = SUITES[file] || {};
      n++;
      const name = file + (r.label ? ` (${r.label})` : '');
      const res = await runOne(file, Object.assign({ timeoutMin: cfg.timeoutMin }, r), port);
      const fl = res.error ? [{ name: res.error }] : (res.out && res.out.__daemonError ? failures(res.out) : cfg.verdict ? cfg.verdict(res.out) : failures(res.out))
        || [{ name: 'no verdict in the result (fails, ok, or pass/of)', detail: res.out }];
      const t = fl.filter((f) => isTiming(file, f));
      const sw = fl.filter((f) => !t.includes(f) && matches(SOFTWARE[file], f));
      const k = fl.filter((f) => !t.includes(f) && !sw.includes(f) && matches(KNOWN[file], f));
      const hard = fl.filter((f) => !t.includes(f) && !sw.includes(f) && !k.includes(f));
      for (const f of t) timing.push({ name, f });
      for (const f of sw) soft.push({ name, f, why: matches(SOFTWARE[file], f).why });
      for (const f of k) known.push({ name, f, why: matches(KNOWN[file], f).why });
      const ok = !hard.length;
      if (!ok) failed++;
      // (a passing suite's screenshots are not kept, unless it reports with them: SUITES[f].keepShots)
      if (ok && !(SUITES[file] && SUITES[file].keepShots)) fs.rmSync(shotsDir(file, r), { recursive: true, force: true });
      fs.writeFileSync(path.join(OUT, name.replace(/[^\w.-]+/g, '_') + '.json'), JSON.stringify({ file, run: r.label, ms: res.ms, error: res.error, out: res.out }, null, 1));
      const head = `${ok ? 'pass' : 'FAIL'} ${name} (${secs(res.ms)})${t.length ? `, ${t.length} timing` : ''}${sw.length ? `, ${sw.length} software` : ''}${k.length ? `, ${k.length} known` : ''}`;
      console.log(gh ? `::group::${head}` : `== ${head}`);
      if (res.out && res.out.pass != null && res.out.of != null) console.log(`${res.out.pass} of ${res.out.of}`);
      for (const f of hard) console.log(`  FAIL ${f.name}${f.detail !== undefined ? ': ' + short(f.detail, 2000) : ''}`);
      for (const f of t) console.log(`  timing (not gated) ${f.name}: ${short(f.detail, 600)}`);
      for (const f of sw) console.log(`  software renderer (not gated here) ${f.name}: ${short(f.detail, 600)}`);
      for (const f of k) console.log(`  known ${f.name}: ${short(f.detail, 600)}`);
      if (!ok && res.log) console.log('-- daemon log --\n' + res.log.slice(-4000));
      if (!ok && res.out && res.out.logs) console.log('-- page console --\n' + short(res.out.logs, 4000));
      if (gh) console.log('::endgroup::');
      if (!ok && gh) console.log(`::error title=${name} failed::${esc(short(hard[0].name + (hard[0].detail !== undefined ? ': ' + short(hard[0].detail, 200) : ''), 300))}`);
      if (t.length && gh) console.log(`::warning title=${name}: timing (not gated)::${esc(short(t.map((f) => f.name).join('; '), 300))}`);
      const res1 = res.out && typeof res.out.pass === 'number' && typeof res.out.of === 'number' ? `${res.out.pass}/${res.out.of}` : ok ? 'pass' : '';
      rows.push(`| ${ok ? (t.length || sw.length || k.length ? '✅⚠️' : '✅') : '❌'} | \`${name}\` | ${secs(res.ms)} | ${esc(short([res1, ...hard.slice(0, 3).map((f) => f.name)].filter(Boolean).join('; '), 240))} | ${t.length || ''} | ${sw.length || ''} | ${k.length || ''} |`);
    }
  } finally { srv.server.close(); }
  const md = [`### Browser suites${shard ? ` (${shard})` : ''}: ${n - failed} of ${n} passed, ${secs(Date.now() - t00)}`, '',
    `${process.platform}${process.env.CMW_ANGLE ? ', ' + process.env.CMW_ANGLE : ''}. Timing checks are reported, not gated (speed is gated on the GPU machines).`, '',
    '| | suite | time | result | timing | software | known |', '|---|---|---|---|---|---|---|', ...rows, ''];
  if (timing.length) md.push('<details><summary>Timing checks that missed their budget (not gated)</summary>', '', '| suite | check | measured |', '|---|---|---|',
    ...timing.map((x) => `| \`${x.name}\` | ${esc(short(x.f.name, 160))} | ${esc(short(x.f.detail, 240))} |`), '', '</details>', '');
  if (soft.length) md.push('<details><summary>Checks that fail only on the software renderer (listed in ci/browser_suites.js SOFTWARE, not gated here)</summary>', '',
    '| suite | check | why | detail |', '|---|---|---|---|',
    ...soft.map((x) => `| \`${x.name}\` | ${esc(short(x.f.name, 160))} | ${esc(x.why)} | ${esc(short(x.f.detail, 200))} |`), '', '</details>', '');
  if (known.length) md.push('**Known failures (listed in ci/browser_suites.js, not gated):**', '', '| suite | check | why |', '|---|---|---|',
    ...known.map((x) => `| \`${x.name}\` | ${esc(short(x.f.name, 160))} | ${esc(x.why)} |`), '');
  const ex = all.filter((f) => EXCLUDED[f]);
  md.push(`<details><summary>Not run here (${ex.length} files: ci/browser_suites.js EXCLUDED)</summary>`, '', ...ex.map((f) => `- \`${f}\`: ${esc(EXCLUDED[f])}`), '', '</details>', '');
  summary(md.join('\n'));
  return failed ? 1 : 0;
}
main().then((rc) => process.exit(rc), (e) => { console.error(e); summary(`### Browser suites: setup problem\n\n\`${esc(String(e.message || e))}\`\n`); process.exit(2); });
