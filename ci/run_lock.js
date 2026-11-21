'use strict';
// A lock for the runs that share fixed paths in one worktree (ci/browser.js: test/ci_cdp, .ci/browser and dist/ are removed and
// rewritten by every run, so a second run in the same worktree deletes the first one's daemon directory and logs under it).
//   const lock = require('./run_lock'); const held = await lock.acquire(file, { wait });   // throws the message naming the holder
//   held.daemon(pid) records the daemon's process group (a run killed with SIGKILL leaves it behind: the next acquire kills it);
//   held.release() removes the lock (also on exit, SIGINT and SIGTERM, which the module handles for the lock it holds).
// The lock file holds { pid, at, daemon }. A lock whose pid is gone is stale: acquire removes it and kills the daemon it names. A pid
// that is alive but is not a run (the number was reused) holds the lock until it is gone: the message names it, so a person can remove
// the file.
const fs = require('fs');
const path = require('path');

// (a process that was killed and not yet reaped by its parent is a zombie: kill(pid, 0) still answers, and it holds nothing)
const zombie = (pid) => { try { return /^\d+ \(.*\) Z/.test(fs.readFileSync(`/proc/${pid}/stat`, 'utf8')); } catch (e) { return false; } };
const alive = (pid) => { try { process.kill(pid, 0); } catch (e) { return e.code === 'EPERM'; } return !zombie(pid); };
// the daemon and everything it started: its process group on POSIX (the run's daemon is spawned detached), taskkill /T on Windows
function killGroup(pid) {
  try {
    if (process.platform !== 'win32') process.kill(-pid, 'SIGKILL');
    else require('child_process').spawnSync('taskkill', ['/pid', String(pid), '/T', '/F']);
  } catch (e) { /* gone */ }
}
const read = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WAIT_POLL_MS = 1000, WAIT_SAY_MS = 30000;

// takes the lock at `file`; waits for a live holder with { wait: true }, else throws an error that names it. -> { daemon(pid), release() }
async function acquire(file, { wait = false } = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let said = 0;
  for (;;) {
    let fd = null;
    try { fd = fs.openSync(file, 'wx'); } catch (e) { if (e.code !== 'EEXIST') throw e; }
    if (fd != null) {
      const state = { pid: process.pid, at: new Date().toISOString(), daemon: null };
      fs.writeSync(fd, JSON.stringify(state));
      fs.closeSync(fd);
      return hold(file, state);
    }
    const h = read(file);
    if (!h || !Number.isInteger(h.pid) || !alive(h.pid)) {
      // (a stale lock: its run is gone, and may have left its daemon and Chrome behind)
      if (h && Number.isInteger(h.daemon)) killGroup(h.daemon);
      try { fs.unlinkSync(file); } catch (e) { /* another run took it first */ }
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
  const write = () => { try { fs.writeFileSync(file, JSON.stringify(state)); } catch (e) { /* the lock file is gone: nothing to update */ } };
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
  for (const [sig, code] of [['SIGINT', 130], ['SIGTERM', 143]]) process.once(sig, () => { if (state.daemon != null) killGroup(state.daemon); process.exit(code); });
  return { daemon(pid) { state.daemon = pid == null ? null : pid; write(); }, release };
}

module.exports = { acquire, alive };
