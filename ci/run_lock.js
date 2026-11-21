'use strict';
// A lock for the runs that share fixed paths in one worktree (ci/browser.js: test/ci_cdp, .ci/browser and dist/ are removed and
// rewritten by every run, so a second run in the same worktree deletes the first one's daemon directory and logs under it).
//   const lock = require('./run_lock'); const held = await lock.acquire(file, { wait });   // throws the message naming the holder
//   held.daemon(pid, marker) records the daemon's process group and a text its command line holds (a run killed with SIGKILL leaves
//   the daemon behind: the next acquire kills it); held.release() removes the lock (also on exit, SIGINT and SIGTERM, which the module
//   handles for the lock it holds).
// The lock file holds { pid, at, daemon, marker }, written whole (a temporary file linked into place, or renamed over the lock when it is
// updated), so no one reads half of it. A lock whose pid is gone is stale: acquire removes it and kills the daemon it names. Only one
// process at a time removes a stale lock: it takes file + '.sweep', reads the lock again and removes it only if it is still the stale
// one it saw, so a run that took the lock in between is never robbed of it. A pid that is alive but is not a run (the number was reused)
// holds the lock until it is gone: the message names it, so a person can remove the file.
const fs = require('fs');
const path = require('path');

// (a process that was killed and not yet reaped by its parent is a zombie: kill(pid, 0) still answers, and it holds nothing)
const zombie = (pid) => { try { return /^\d+ \(.*\) Z/.test(fs.readFileSync(`/proc/${pid}/stat`, 'utf8')); } catch (e) { return false; } };
const alive = (pid) => { try { process.kill(pid, 0); } catch (e) { return e.code === 'EPERM'; } return !zombie(pid); };
// the daemon and everything it started: its process group (the run's daemon is spawned detached, so it leads one). Once the whole group is
// gone its number can be reused, and a detached daemon of another worktree's run may lead a group with it: where /proc says what the
// process of that number is, its command line must hold the marker the lock recorded (this worktree's daemon file) or nothing is killed;
// where /proc has no such process the group is empty or held by the dead run's leftovers, and the kill is safe. Windows has no such check
// (taskkill /T would take whatever has the number): nothing is killed there.
function killDaemon(pid, marker) {
  if (process.platform === 'win32') return;
  let cmd = null;
  try { cmd = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8'); } catch (e) { /* no such process, or no /proc */ }
  if (cmd !== null && cmd !== '' && !(marker && cmd.includes(marker))) return;   // ('' is a zombie leader: the number is its)
  try { process.kill(-pid, 'SIGKILL'); } catch (e) { /* gone */ }
}
const read = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WAIT_POLL_MS = 1000, WAIT_SAY_MS = 30000, SWEEP_POLL_MS = 20, SWEEP_STALE_MS = 5000;
// the lock written whole: the file is linked into place (it fails if the lock exists) from a temporary one that already holds the state
function create(file, state) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state));
  try { fs.linkSync(tmp, file); return true; } catch (e) { if (e.code === 'EEXIST') return false; throw e; } finally { try { fs.unlinkSync(tmp); } catch (e) { /* gone */ } }
}

// removes the stale lock `h` that was read at `file` (and kills its daemon), if it is still the one at `file`; false when another process
// holds the sweep (the caller looks again)
function sweep(file, h) {
  const side = file + '.sweep';
  let fd = null;
  try { fd = fs.openSync(side, 'wx'); } catch (e) {
    if (e.code !== 'EEXIST') throw e;
    // (a sweep that stopped half way: its file is older than any sweep takes)
    try { if (Date.now() - fs.statSync(side).mtimeMs > SWEEP_STALE_MS) fs.unlinkSync(side); } catch (x) { /* gone */ }
    return false;
  }
  try {
    fs.closeSync(fd);
    const now = read(file);
    const same = (h === null && now === null) || (h !== null && now !== null && now.pid === h.pid && now.at === h.at);
    if (same && (now === null || !alive(now.pid))) {
      if (now && Number.isInteger(now.daemon)) killDaemon(now.daemon, now.marker);
      try { fs.unlinkSync(file); } catch (e) { /* gone */ }
    }
  } finally { try { fs.unlinkSync(side); } catch (e) { /* gone */ } }
  return true;
}

// takes the lock at `file`; waits for a live holder with { wait: true }, else throws an error that names it. -> { daemon(pid, marker), release() }
async function acquire(file, { wait = false } = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let said = 0;
  for (;;) {
    const state = { pid: process.pid, at: new Date().toISOString(), daemon: null, marker: null };
    if (create(file, state)) return hold(file, state);
    const h = read(file);
    if (!h || !Number.isInteger(h.pid) || !alive(h.pid)) {
      // (a stale lock, or one that cannot be read: its run is gone, and may have left its daemon and Chrome behind)
      if (!sweep(file, h)) await sleep(SWEEP_POLL_MS);
      continue;
    }
    const who = `another run in this worktree holds ${path.basename(file)} (pid ${h.pid}, since ${h.at}): it rewrites test/ci_cdp, .ci/browser and dist/, so two runs would break each other`;
    if (!wait) throw new Error(`${who}; start this one after it ends, with --wait, or in a worktree of its own`);
    if (Date.now() - said >= WAIT_SAY_MS) { console.log(`waiting: ${who}`); said = Date.now(); }
    await sleep(WAIT_POLL_MS);
  }
}

function hold(file, state) {
  let released = false;
  // (the lock rewritten whole, over itself, while it is still this run's)
  const write = () => {
    const h = read(file);
    if (!h || h.pid !== process.pid) return;
    const tmp = `${file}.${process.pid}.tmp`;
    try { fs.writeFileSync(tmp, JSON.stringify(state)); fs.renameSync(tmp, file); } catch (e) { try { fs.unlinkSync(tmp); } catch (x) { /* gone */ } }
  };
  const release = () => {
    if (released) return;
    released = true;
    process.removeListener('exit', release);
    // (only the file this run wrote: a lock another run took after a sweep is not removed)
    const h = read(file);
    if (h && h.pid === process.pid) { try { fs.unlinkSync(file); } catch (e) { /* gone */ } }
  };
  process.on('exit', release);
  // (a signal ends the run through exit, which releases; the daemon of the run in progress is killed with it)
  for (const [sig, code] of [['SIGINT', 130], ['SIGTERM', 143]]) process.once(sig, () => { if (state.daemon != null) killDaemon(state.daemon, state.marker); process.exit(code); });
  return { daemon(pid, marker) { state.daemon = pid == null ? null : pid; state.marker = pid == null ? null : marker || null; write(); }, release };
}

module.exports = { acquire, alive };
