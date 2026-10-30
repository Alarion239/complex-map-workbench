// The workflows' jobs on our own machines (runs-on self-hosted) stop when their run is cancelled: no job-level `if`
// of theirs uses always(), which is true after a cancel too, so a cancelled run's later jobs would still be created
// and run in full on the laptop or the Mac (the GPU gate's quality job was still queued after run 41015822380 was
// cancelled). !cancelled() lets a failure through and stops at a cancel. Step-level ifs inside a running job are not
// job conditions and stay.
// Node, no YAML library: the workflows' own layout (two-space indent, jobs at 2, job keys at 4). Run: node test/t_workflow_cancel.js
'use strict';
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', '.github', 'workflows');
let pass = 0, fail = 0;
const ok = (name, cond, got) => { if (cond) pass++; else { fail++; console.log('FAIL ' + name + (got !== undefined ? ' ' + JSON.stringify(got) : '')); } };

// -> [{ file, job, runsOn, ifs }]: each job's runs-on and job-level if (a folded >- value with its continuation lines)
function jobs(file) {
  const lines = fs.readFileSync(path.join(DIR, file), 'utf8').split(/\r?\n/);
  const out = [];
  let inJobs = false, cur = null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^jobs:\s*$/.test(l)) { inJobs = true; continue; }
    if (!inJobs) continue;
    if (/^\S/.test(l)) { inJobs = false; continue; }
    const j = /^ {2}([\w-]+):\s*$/.exec(l);
    if (j) { cur = { file, job: j[1], runsOn: '', ifs: '' }; out.push(cur); continue; }
    const k = cur && /^ {4}(runs-on|if):\s*(.*)$/.exec(l);
    if (!k) continue;
    let v = k[2];
    if (/^[>|]-?\s*$/.test(v)) { v = ''; while (i + 1 < lines.length && /^ {6,}\S/.test(lines[i + 1])) v += ' ' + lines[++i].trim(); }
    if (k[1] === 'if') cur.ifs = v; else cur.runsOn = v;
  }
  return out;
}

const all = fs.readdirSync(DIR).filter((f) => /\.ya?ml$/.test(f)).flatMap(jobs);
const self = all.filter((j) => /self-hosted/.test(j.runsOn));
ok('the GPU gate has self-hosted jobs (the parser finds them)', self.filter((j) => j.file === 'gpu-gate.yml').length >= 4, self.map((j) => j.job));
for (const j of self) ok(`${j.file} ${j.job}: its if does not use always() (a cancel must stop it)`, !/\balways\(\)/.test(j.ifs), j.ifs);
// (the parser reads a folded condition: the gate job's)
const gate = all.find((j) => j.file === 'gpu-gate.yml' && j.job === 'gate');
ok('the gpu-gate gate job is found, with its condition', !!gate && /needs\.plan\.result/.test(gate.ifs), gate);

console.log(`t_workflow_cancel: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
