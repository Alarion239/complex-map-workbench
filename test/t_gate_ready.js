// gate.yml, a pull request marked ready for review (#379): into another branch than main the Gate run on the same
// commit as its push's run runs nothing. It has a concurrency group of its own (it never cancels the push's run), the
// plan selects no job (tier none), the unit job is skipped, and the Gate job carries the verdict of the push's Gate run
// instead of a pass of its own. Into main (a wave PR) it still runs the whole gate. Node and bash, no YAML library: the
// workflow's own layout. Run: node test/t_gate_ready.js
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const Y = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'gate.yml'), 'utf8');
let pass = 0, fail = 0;
const ok = (name, cond, got) => { if (cond) pass++; else { fail++; console.log('FAIL ' + name + (got !== undefined ? ' ' + JSON.stringify(got) : '')); } };
const READY = "github.event.action == 'ready_for_review' && github.event.pull_request.base.ref != 'main'";

// a job's block: from "  <name>:" to the next job
const job = (name) => { const m = new RegExp(`^ {2}${name}:\\n([\\s\\S]*?)(?=^ {2}[\\w-]+:\\n|(?![\\s\\S]))`, 'm').exec(Y); return m ? m[1] : ''; };
ok('the workflow runs on ready_for_review', /types: \[[^\]]*ready_for_review[^\]]*\]/.test(Y));
const group = (/^ {2}group: (.*)$/m.exec(Y) || [])[1] || '';
ok('a ready-for-review run into another branch has a concurrency group of its own', group.includes(`${READY} && '-ready'`), group);
ok('the unit job is skipped for it', job('unit').includes(`if: \${{ !(${READY}) }}`), job('unit').split('\n').slice(0, 4));
const gate = job('gate');
ok('the Gate job may read the Gate runs (actions: read)', /permissions:\n\s+contents: read\n\s+actions: read/.test(gate));
ok('the Gate job looks up the Gate runs of the same commit', /actions\/workflows\/gate\.yml\/runs\?head_sha=\$HEAD_SHA/.test(gate));

// the tier step's own script, run with bash: REPEAT true writes the empty plan and stops before ci/impact.js
const tier = /- id: tier\n[\s\S]*?\n {8}run: \|\n([\s\S]*?)(?=\n {2}[\w-]+:\n)/.exec(Y);
ok('the tier step is found', !!tier);
if (tier) {
  const script = tier[1].split('\n').map((l) => l.replace(/^ {10}/, '')).join('\n').replace(/\$\{\{ github\.event_name \}\}/g, 'pull_request');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-ready-'));
  const run = (repeat) => {
    const out = path.join(dir, 'out' + repeat), sum = path.join(dir, 'sum' + repeat);
    fs.writeFileSync(out, ''); fs.writeFileSync(sum, '');
    // (node is replaced: had the script reached ci/impact.js, IMPACT says so)
    const r = spawnSync('bash', ['-c', `node() { echo IMPACT; }; ${script}`], { env: Object.assign({}, process.env, { REPEAT: repeat, BASE: 'claude/x', DRAFT: 'false', REF: 'abc', FULL_LABEL: 'false', DEEP_LABEL: 'false', GLSL_INPUT: '', GITHUB_OUTPUT: out, GITHUB_STEP_SUMMARY: sum }), encoding: 'utf8' });
    return { status: r.status, stdout: r.stdout, out: fs.readFileSync(out, 'utf8'), sum: fs.readFileSync(sum, 'utf8') };
  };
  const a = run('true');
  ok('REPEAT: the step succeeds without ci/impact.js', a.status === 0 && !a.stdout.includes('IMPACT'), a);
  const o = Object.fromEntries(a.out.trim().split('\n').map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
  ok('REPEAT: tier none, no job selected', o.tier === 'none' && o.glsl === '[]' && o.quality === '[]' && o.browser === '[]' && o.perf === 'false', o);
  ok('REPEAT: the summary says why', /nothing to re-run/.test(a.sum), a.sum);
  const b = run('false');
  ok('otherwise the step plans with ci/impact.js', b.stdout.includes('IMPACT') && !b.out.includes('tier=none'), b);
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log(`t_gate_ready: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
