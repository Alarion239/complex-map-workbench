// The lock that keeps two runs of ci/browser.js out of one worktree (#2163, ci/run_lock.js). Each case uses a holder in a process of
// its own (the lock is by pid): a second acquire refuses and names the holder, or waits for it with { wait: true }; a holder that is
// killed with SIGKILL leaves a stale lock that the next acquire removes, with the daemon (a process group) the holder had recorded;
// release, and a SIGTERM, remove the lock. Run: node test/t_run_lock.js
const fs = require('fs'), os = require('os'), path = require('path');
const { spawn } = require('child_process');
const { acquire, alive } = require('../ci/run_lock');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'run-lock-'));
const file = path.join(dir, '.ci', 'browser.lock');
let pass = 0, fail = 0;
const ok = (cond, name, extra) => { if (cond) pass++; else { fail++; console.log('FAIL', name, extra === undefined ? '' : JSON.stringify(extra)); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 8000) => { for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(50)) if (await f()) return true; return false; };

// a holder: takes the lock, starts a daemon of its own (a detached `sleep`, as the run's daemon is), records it, and waits
const HOLDER = `const { acquire } = require(${JSON.stringify(path.join(__dirname, '..', 'ci', 'run_lock'))});
const { spawn } = require('child_process');
acquire(${JSON.stringify(file)}).then((held) => {
  const d = spawn('sleep', ['300'], { detached: true, stdio: 'ignore' });
  held.daemon(d.pid); console.log('daemon ' + d.pid); setInterval(() => {}, 1000);
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
