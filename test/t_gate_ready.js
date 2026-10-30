// gate.yml, a pull request marked ready for review (#379). Into another branch than main its run has a concurrency
// group of its own (it never cancels its push's run), and the job ready looks for the newest other Gate run of this PR
// on the same commit: only if that one passed does nothing run again (the plan's tier none, the unit job skipped, the
// Gate job checking that run again and carrying its verdict); queued, running, failed, cancelled or none, the run is
// the usual one, so a green Gate never stands on a commit before a gate passed there. Into main (a wave PR) it is
// never short-circuited. Node and bash (jq for the stubbed gh), no YAML library. Run: node test/t_gate_ready.js
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const Y = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'gate.yml'), 'utf8');
let pass = 0, fail = 0;
const ok = (name, cond, got) => { if (cond) pass++; else { fail++; console.log('FAIL ' + name + (got !== undefined ? ' ' + JSON.stringify(got) : '')); } };
const READY = "github.event.action == 'ready_for_review' && github.event.pull_request.base.ref != 'main'";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-ready-'));

// a job's block: from "  <name>:" to the next job; a step's run script (unindented)
const job = (name) => { const m = new RegExp(`^ {2}${name}:\\n([\\s\\S]*?)(?=^ {2}[\\w-]+:\\n|(?![\\s\\S]))`, 'm').exec(Y); return m ? m[1] : ''; };
const script = (block, id) => {
  const m = new RegExp(`- id: ${id}\\n[\\s\\S]*?\\n( +)run: \\|\\n([\\s\\S]*?)(?=\\n {0,8}\\S|\\n*(?![\\s\\S]))`).exec(block);
  return m ? m[2].split('\n').map((l) => l.slice(m[1].length + 2)).join('\n') : '';
};
// bash with these env and stubs; -> { status, stdout, out (GITHUB_OUTPUT as an object), sum }
let n = 0;
const bash = (code, env) => {
  const out = path.join(dir, 'o' + n), sum = path.join(dir, 's' + ++n);
  fs.writeFileSync(out, ''); fs.writeFileSync(sum, '');
  const r = spawnSync('bash', ['-c', code], { env: Object.assign({}, process.env, env, { GITHUB_OUTPUT: out, GITHUB_STEP_SUMMARY: sum }), encoding: 'utf8' });
  const o = Object.fromEntries(fs.readFileSync(out, 'utf8').trim().split('\n').filter(Boolean).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
  return { status: r.status, stdout: r.stdout + r.stderr, out: o, sum: fs.readFileSync(sum, 'utf8') };
};

ok('the workflow runs on ready_for_review', /types: \[[^\]]*ready_for_review[^\]]*\]/.test(Y));
const group = (/^ {2}group: (.*)$/m.exec(Y) || [])[1] || '';
ok('a ready-for-review run into another branch has a concurrency group of its own', group.includes(`${READY} && '-ready'`), group);
const ready = job('ready');
ok('the job ready looks only on a ready-for-review run into another branch', ready.includes(`if: ${READY}`));
ok('the job ready may read the Gate runs (actions: read)', /permissions:\n\s+actions: read/.test(ready));
ok('the plan and the unit job wait for it', /needs: ready/.test(job('plan')) && /needs: ready\n\s+if: needs\.ready\.outputs\.mirror == ''/.test(job('unit')));

// the job ready's look-up, with gh stubbed by jq over a run history
const look = script(ready, 'look');
ok('the look-up script is found', /gh api/.test(look), look.slice(0, 80));
const hist = (runs) => { const f = path.join(dir, 'h' + ++n + '.json'); fs.writeFileSync(f, JSON.stringify({ workflow_runs: runs })); return f; };
const run = (id, status, conclusion, t, prs = [7]) => ({ id, status, conclusion, created_at: `2026-10-30T0${t}:00:00Z`, pull_requests: prs.map((number) => ({ number })) });
const mirror = (runs) => bash(`gh() { local q=; while [ $# -gt 0 ]; do [ "$1" = --jq ] && q="$2"; shift; done; jq -r "$q" "$H"; }; ${look}`, { H: hist(runs), GITHUB_RUN_ID: '99', GITHUB_REPOSITORY: 'o/r', HEAD_SHA: 'abc', PR: '7' });
const cases = [
  ['the push run passed: mirrored', [run(5, 'completed', 'success', 1)], '5'],
  ['still running: no mirror (the usual run)', [run(5, 'completed', 'success', 1), run(6, 'in_progress', null, 2)], ''],
  ['queued: no mirror', [run(6, 'queued', null, 2)], ''],
  ['failed: no mirror', [run(6, 'completed', 'failure', 2)], ''],
  ['cancelled: no mirror', [run(6, 'completed', 'cancelled', 2)], ''],
  ['no other run: no mirror', [], ''],
  ['a passing run of another PR on the commit does not count', [run(5, 'completed', 'success', 1, [8])], ''],
  ['an empty pull_requests field does not count', [run(5, 'completed', 'success', 1, [])], ''],
  ['its own run is left out', [run(5, 'completed', 'success', 1), run(99, 'in_progress', null, 3)], '5'],
  ['a newer failure over an older pass: no mirror', [run(5, 'completed', 'success', 1), run(6, 'completed', 'failure', 2)], ''],
];
for (const [name, runs, want] of cases) { const r = mirror(runs); ok(`ready: ${name}`, r.status === 0 && r.out.mirror === want, r); }
const broken = bash(`gh() { return 1; }; ${look}`, { GITHUB_RUN_ID: '99', GITHUB_REPOSITORY: 'o/r', HEAD_SHA: 'abc', PR: '7' });
ok('ready: a failed look-up gives no mirror (the usual run)', broken.status === 0 && broken.out.mirror === '', broken);

// the plan's tier step: a mirror writes the empty plan and stops before ci/impact.js; none plans as usual
const tier = script(job('plan'), 'tier').replace(/\$\{\{ github\.event_name \}\}/g, 'pull_request');
ok('the tier step is found', /impact\.js/.test(tier));
const tenv = { BASE: 'claude/x', DRAFT: 'false', REF: 'abc', FULL_LABEL: 'false', DEEP_LABEL: 'false', GLSL_INPUT: '' };
const a = bash(`node() { echo IMPACT; }; ${tier}`, Object.assign({ MIRROR: '5' }, tenv));
ok('mirror: the step succeeds without ci/impact.js', a.status === 0 && !a.stdout.includes('IMPACT'), a);
ok('mirror: tier none, no job selected', a.out.tier === 'none' && a.out.glsl === '[]' && a.out.quality === '[]' && a.out.browser === '[]' && a.out.perf === 'false', a.out);
ok('mirror: the summary names the run', /run 5 .*nothing to re-run/.test(a.sum), a.sum);
const b = bash(`node() { echo IMPACT; }; ${tier}`, Object.assign({ MIRROR: '' }, tenv));
ok('no mirror: the step plans with ci/impact.js', b.stdout.includes('IMPACT') && b.out.tier !== 'none', b);

// the Gate job: tier none checks the mirrored run again
const gate = job('gate');
ok('the Gate job may read the runs (actions: read)', /permissions:\n\s+contents: read\n\s+actions: read/.test(gate));
const g = /run: \|\n([\s\S]*)$/.exec(gate);
const gscript = g ? g[1].split('\n').map((l) => l.slice(10)).join('\n').replace(/\$\{\{ needs\.\w+\.result \}\}/g, 'skipped').replace('[ "skipped" = success ] || { echo "::error::plan', '[ "success" = success ] || { echo "::error::plan') : '';
const check = (reply) => bash(`gh() { echo "${reply}"; }; ${gscript}`, { TIER: 'none', MIRROR: '5', PR: '7', HEAD_SHA: 'abc', GITHUB_REPOSITORY: 'o/r', SEL_GLSL: 'false', SEL_QUALITY: 'false', SEL_BROWSER: 'false' });
ok('Gate: a passing mirrored run of this PR on this commit passes', check('completed success abc true').status === 0, check('completed success abc true'));
ok('Gate: a mirrored run that did not pass fails', check('completed failure abc true').status === 1);
ok('Gate: a mirrored run on another commit fails', check('completed success def true').status === 1);
ok('Gate: a mirrored run of another PR fails', check('completed success abc false').status === 1);

fs.rmSync(dir, { recursive: true, force: true });
console.log(`t_gate_ready: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
