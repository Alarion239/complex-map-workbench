// The lock that keeps two runs of ci/browser.js out of one worktree (#2163, ci/run_lock.js). Each case uses a holder in a process of
// its own (the lock is by pid): a second acquire refuses and names the holder, or waits for it with { wait: true }; a holder that is
// killed with SIGKILL leaves a stale lock that the next acquire removes, with the daemon (a process group) the holder had recorded;
// release, and a SIGTERM, remove the lock. Run: node test/t_run_lock.js
const fs = require('fs'), os = require('os'), path = require('path');
const { spawn } = require('child_process');
const { acquire, alive, killDaemon } = require('../ci/run_lock');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'run-lock-'));
const file = path.join(dir, '.ci', 'browser.lock');
let pass = 0, fail = 0;
const ok = (cond, name, extra) => { if (cond) pass++; else { fail++; console.log('FAIL', name, extra === undefined ? '' : JSON.stringify(extra)); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 8000) => { for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(50)) if (await f()) return true; return false; };

// a holder: takes the lock, starts a daemon of its own (a detached node process with the marker in its command line, as the run's daemon
// has its file's path), records it, and waits
const MARK = 'run-lock-test-daemon-' + process.pid;
const HOLDER = `const { acquire } = require(${JSON.stringify(path.join(__dirname, '..', 'ci', 'run_lock'))});
const { spawn } = require('child_process');
acquire(${JSON.stringify(file)}).then((held) => {
  const d = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)', ${JSON.stringify(MARK)}], { detached: true, stdio: 'ignore' });
  held.daemon(d.pid, ${JSON.stringify(MARK)}); console.log('daemon ' + d.pid); setInterval(() => {}, 1000);
}, (e) => { console.log('refused ' + e.message); process.exit(3); });`;
const holder = () => new Promise((resolve) => {
  const p = spawn(process.execPath, ['-e', HOLDER], { stdio: ['ignore', 'pipe', 'inherit'] });
  let out = '';
  p.stdout.on('data', (d) => { out += d; const m = /daemon (\d+)/.exec(out); if (m) resolve({ p, daemon: +m[1] }); });
});

(async () => {
  // the lock is taken, and holds this process's pid; releasing it removes the file
  const a = await acquire(file);
  const s = JSON.parse(fs.readFileSync(file, 'utf8'));
  ok(s.pid === process.pid && s.daemon === null, 'acquire writes { pid, at, daemon: null }', s);
  a.daemon(4242);
  ok(JSON.parse(fs.readFileSync(file, 'utf8')).daemon === 4242, 'daemon(pid) records the daemon in the lock');
  a.release();
  ok(!fs.existsSync(file), 'release removes the lock file');

  // a live holder: a second acquire refuses, naming its pid, and does not touch the lock
  const h = await holder();
  let msg = '';
  try { await acquire(file); } catch (e) { msg = e.message; }
  ok(msg.includes(`pid ${h.p.pid}`) && /another run in this worktree/.test(msg) && /--wait/.test(msg), 'a second acquire refuses and names the holder', msg);
  ok(JSON.parse(fs.readFileSync(file, 'utf8')).pid === h.p.pid, 'the refused acquire leaves the holder\'s lock alone');

  // { wait: true } waits until the holder ends, then takes the lock
  let got = null;
  const waiting = acquire(file, { wait: true }).then((l) => { got = l; });
  await sleep(1500);
  ok(got === null, 'acquire with wait: true is still waiting while the holder lives');
  h.p.kill('SIGTERM');
  await waiting;
  ok(got !== null && JSON.parse(fs.readFileSync(file, 'utf8')).pid === process.pid, 'acquire with wait: true takes the lock when the holder ends');
  ok(await until(() => !alive(h.daemon)), 'a SIGTERM to the holder kills its daemon');
  got.release();

  // a holder killed with SIGKILL: its lock is stale, and so is the daemon it left; the next acquire removes both
  const k = await holder();
  k.p.kill('SIGKILL');
  await until(() => !alive(k.p.pid));
  ok(fs.existsSync(file) && alive(k.daemon), 'after a SIGKILL the lock and the daemon are left behind');
  const b = await acquire(file);
  ok(JSON.parse(fs.readFileSync(file, 'utf8')).pid === process.pid, 'the next acquire takes over a stale lock');
  ok(await until(() => !alive(k.daemon)), 'the next acquire kills the daemon the dead holder left');
  b.release();

  // a stale lock whose daemon number is now another process's (another worktree's run: its command line has no marker of ours): the
  // lock goes, that process is not killed; the daemon that has the marker is
  const other = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)', 'another-worktrees-daemon'], { detached: true, stdio: 'ignore' });
  const mine = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)', MARK], { detached: true, stdio: 'ignore' });
  await sleep(300);
  for (const [d, killed] of [[other, false], [mine, true]]) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ pid: 2 ** 22 + 7, at: 'long ago', daemon: d.pid, marker: MARK }));
    const t = await acquire(file);
    await sleep(500);
    ok(alive(d.pid) === !killed, killed ? 'a stale lock\'s daemon with the marker in its command line is killed' : 'a stale lock\'s daemon number that is another process (no marker) is not killed', { pid: d.pid });
    t.release();
  }
  for (const d of [other, mine]) { try { process.kill(-d.pid, 'SIGKILL'); } catch (e) { /* gone */ } }

  // the command line read by `ps` where there is no /proc (macOS): what each answer of the reader does to a daemon number (a process of
  // this test that leads a group of its own; the reader is given in place of the system's)
  const target = () => spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)', 'target'], { detached: true, stdio: 'ignore' });
  for (const [name, reader, killed] of [
    ['a command line with the marker', () => ({ cmd: `node /w/test/ci_cdp/cdpd.js ${MARK}` }), true],
    ['a command line without the marker', () => ({ cmd: 'node /other/worktree/test/ci_cdp/cdpd.js' }), false],
    ['a command line that cannot be read', () => ({ unknown: true }), false],
    ['no such process', () => ({ gone: true }), true],
    ['an empty command line (a zombie leader)', () => ({ cmd: '' }), true]]) {
    const t = target();
    await sleep(200);
    const did = killDaemon(t.pid, MARK, reader);
    await sleep(300);
    ok(did === killed && alive(t.pid) === !killed, `killDaemon with ${name}: ${killed ? 'kills' : 'does not kill'} the group`, { did, alive: alive(t.pid) });
    try { process.kill(-t.pid, 'SIGKILL'); } catch (e) { /* gone */ }
  }

  // a stale lock and three runs acquiring together: one holder at a time (a run that read the stale lock must not remove the fresh one
  // another made), over 20 trials of three holders that each keep it 150 ms
  const TRIAL = `const { acquire } = require(${JSON.stringify(path.join(__dirname, '..', 'ci', 'run_lock'))});
acquire(${JSON.stringify(file)}, { wait: true }).then(async (held) => { const a = Date.now(); await new Promise((r) => setTimeout(r, 150)); const b = Date.now(); held.release(); console.log(a + ' ' + b); });`;
  let overlaps = 0, held = 0;
  for (let i = 0; i < 20; i++) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ pid: 2 ** 22 + 9, at: 'long ago', daemon: null, marker: null }));
    const spans = await Promise.all([0, 1, 2].map(() => new Promise((resolve) => {
      const c = spawn(process.execPath, ['-e', TRIAL], { stdio: ['ignore', 'pipe', 'inherit'] });
      let out = ''; c.stdout.on('data', (d) => { out += d; }); c.on('close', () => resolve(out.trim().split('\n').pop().split(' ').map(Number)));
    })));
    const ok3 = spans.every((x) => x.length === 2 && x.every(Number.isFinite));
    held += ok3 ? 3 : 0;
    spans.sort((x, y) => x[0] - y[0]);
    if (!ok3 || spans[1][0] < spans[0][1] || spans[2][0] < spans[1][1]) overlaps++;
  }
  ok(overlaps === 0 && held === 60, 'a stale lock and three simultaneous acquires: one holder at a time, every run held it once (20 trials)', { overlaps, held });

  // a lock file that holds no pid (cut off while written) is stale too
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '{"pid":');
  const c = await acquire(file);
  ok(JSON.parse(fs.readFileSync(file, 'utf8')).pid === process.pid, 'an unreadable lock file is taken over');
  c.release();

  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`${pass}/${pass + fail} passed${fail ? ', ' + fail + ' FAILED' : ''}`);
  process.exit(fail ? 1 : 0);
})();
