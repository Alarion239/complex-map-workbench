// gate.yml, a pull request marked ready for review (#379). Into another branch than main its run has a concurrency
// group of its own (it never cancels its push's run), and the job ready looks for the newest other Gate run of this PR
// on the same commit: when that one passed, or is still queued or running (its push's run), nothing runs again (the
// plan's tier none, the unit job skipped, the Gate job checking that run again, waiting for it while it runs, and
// carrying its verdict); failed, cancelled or none, the run is the usual one, so a green Gate never stands on a commit
// before a gate passed there. Into main (a wave PR) it is never short-circuited. Node and bash (jq for the stubbed gh), no YAML library. Run: node test/t_gate_ready.js
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
// a gh on the PATH (the scripts call ci/gate_run_of.sh, a child process): the body is bash
const stubs = (name, body) => { const d = path.join(dir, 'bin' + name); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, 'gh'), '#!/usr/bin/env bash\n' + body + '\n', { mode: 0o755 }); return d; };
const GH_JQ = 'q=; while [ $# -gt 0 ]; do [ "$1" = --jq ] && q="$2"; shift; done; jq -r "$q" "$H"';

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
  const r = spawnSync('bash', ['-c', code], { cwd: path.join(__dirname, '..'), env: Object.assign({}, process.env, { PATH: (env.STUBS ? env.STUBS + path.delimiter : '') + process.env.PATH }, env, { GITHUB_OUTPUT: out, GITHUB_STEP_SUMMARY: sum }), encoding: 'utf8' });
  const o = Object.fromEntries(fs.readFileSync(out, 'utf8').trim().split('\n').filter(Boolean).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
  return { status: r.status, stdout: r.stdout + r.stderr, out: o, sum: fs.readFileSync(sum, 'utf8') };
};

ok('the workflow runs on ready_for_review', /types: \[[^\]]*ready_for_review[^\]]*\]/.test(Y));
const group = (/^ {2}group: (.*)$/m.exec(Y) || [])[1] || '';
ok('a ready-for-review run into another branch has a concurrency group of its own', group.includes(`${READY} && '-ready'`), group);
const ready = job('ready');
ok('the job ready looks only on a ready-for-review run into another branch', ready.includes(`if: ${READY}`));
ok('the job ready may read the Gate runs (actions: read)', /permissions:\n\s+actions: read/.test(ready));
ok('both steps look the run up in one script (ci/gate_run_of.sh)', (ready.match(/ci\/gate_run_of\.sh "/g) || []).length === 2 && !/gate\.yml\/runs/.test(ready));
ok('the plan and the unit job wait for it', /needs: ready/.test(job('plan')) && /needs: ready\n\s+if: needs\.ready\.outputs\.mirror == ''/.test(job('unit')));

// the job ready's look-up, with gh stubbed by jq over a run history
const look = script(ready, 'look');
ok('the look-up script is found', /gate_run_of/.test(look), look.slice(0, 80));
const hist = (runs) => { const f = path.join(dir, 'h' + ++n + '.json'); fs.writeFileSync(f, JSON.stringify({ workflow_runs: runs })); return f; };
const run = (id, status, conclusion, t, prs = [7]) => ({ id, status, conclusion, created_at: `2026-10-30T0${t}:00:00Z`, pull_requests: prs.map((number) => ({ number })) });
const mirror = (runs) => bash(look, { STUBS: stubs('jq', GH_JQ), H: hist(runs), GITHUB_RUN_ID: '99', GITHUB_REPOSITORY: 'o/r', HEAD_SHA: 'abc', PR: '7' });
const cases = [
  ['the push run passed: mirrored', [run(5, 'completed', 'success', 1)], '5'],
  ['still running: mirrored (the Gate job waits for it, not the same tier twice)', [run(5, 'completed', 'success', 1), run(6, 'in_progress', null, 2)], '6'],
  ['queued: mirrored', [run(6, 'queued', null, 2)], '6'],
  ['waiting (an approval): mirrored', [run(6, 'waiting', null, 2)], '6'],
  ['failed: no mirror', [run(6, 'completed', 'failure', 2)], ''],
  ['cancelled: no mirror', [run(6, 'completed', 'cancelled', 2)], ''],
  ['no other run: no mirror', [], ''],
  ['a passing run of another PR on the commit does not count', [run(5, 'completed', 'success', 1, [8])], ''],
  ['an empty pull_requests field does not count', [run(5, 'completed', 'success', 1, [])], ''],
  ['its own run is left out', [run(5, 'completed', 'success', 1), run(99, 'in_progress', null, 3)], '5'],
  ['a newer failure over an older pass: no mirror', [run(5, 'completed', 'success', 1), run(6, 'completed', 'failure', 2)], ''],
];
for (const [name, runs, want] of cases) { const r = mirror(runs); ok(`ready: ${name}`, r.status === 0 && r.out.mirror === want, r); }
const broken = bash(look, { STUBS: stubs('fail', 'exit 1'), GITHUB_RUN_ID: '99', GITHUB_REPOSITORY: 'o/r', HEAD_SHA: 'abc', PR: '7' });
ok('ready: a failed look-up gives no mirror (the usual run)', broken.status === 0 && broken.out.mirror === '', broken);

// the plan's tier step: a mirror writes the empty plan and stops before ci/impact.js; none plans as usual
const tier = script(job('plan'), 'tier').replace(/\$\{\{ github\.event_name \}\}/g, 'pull_request');
ok('the tier step is found', /impact\.js/.test(tier));
const tenv = { BASE: 'claude/x', DRAFT: 'false', REF: 'abc', FULL_LABEL: 'false', DEEP_LABEL: 'false', GLSL_INPUT: '', MIRROR_PR: '7', PR: '7' };
const a = bash(`node() { echo IMPACT; }; ${tier}`, Object.assign({ MIRROR: '5' }, tenv));
ok('mirror: the step succeeds without ci/impact.js', a.status === 0 && !a.stdout.includes('IMPACT'), a);
ok('mirror: tier none, no job selected', a.out.tier === 'none' && a.out.glsl === '[]' && a.out.quality === '[]' && a.out.browser === '[]' && a.out.perf === 'false', a.out);
ok('mirror: the summary names the run', /run 5 .*nothing to re-run/.test(a.sum), a.sum);
const b = bash(`node() { echo IMPACT; }; ${tier}`, Object.assign({ MIRROR: '' }, tenv));
ok('no mirror: the step plans with ci/impact.js', b.stdout.includes('IMPACT') && b.out.tier !== 'none', b);

const st = bash(`node() { echo IMPACT; }; ${tier}`, Object.assign({}, tenv, { MIRROR: '9', MIRROR_PR: '12' }));
ok('stacked: the summary names the PR above', st.out.tier === 'none' && /stacked under #12: run 9 of #12/.test(st.sum), st);

// the job ready's cover step (#787): the top of a stack, by the compare API; the switch GATE_STACK_SKIP
const cover = script(ready, 'cover');
ok('the cover step is found and runs on a pull request into another branch only', /compare\//.test(cover) && /id: cover\n\s+if: github\.event_name == 'pull_request' && github\.event\.pull_request\.base\.ref != 'main'/.test(ready));
// (open PRs: [number, head sha, compare of this head to it: [status, ahead_by]]; runs: by head sha -> run list)
const stack = (prs, runsBySha, env = {}) => {
  const d = path.join(dir, 'k' + ++n); fs.mkdirSync(d);
  fs.writeFileSync(path.join(d, 'pulls.json'), JSON.stringify(prs.map(([number, sha]) => ({ number, head: { sha } }))));
  for (const [, sha, status, ahead] of prs) fs.writeFileSync(path.join(d, 'cmp_' + sha + '.json'), JSON.stringify({ status, ahead_by: ahead }));
  for (const [sha, runs] of Object.entries(runsBySha)) fs.writeFileSync(path.join(d, 'runs_' + sha + '.json'), JSON.stringify({ workflow_runs: runs }));
  const stub = stubs('stack' + n, 'p=; q=; while [ $# -gt 0 ]; do case "$1" in --jq) q="$2"; shift;; api|--paginate) ;; *) [ -z "$p" ] && p="$1";; esac; shift; done; ' +
    'case "$p" in *compare/*) f="$D/cmp_${p##*...}.json";; *pulls\\?*) f="$D/pulls.json";; *head_sha=*) s="${p#*head_sha=}"; f="$D/runs_${s%%&*}.json";; *) exit 1;; esac; [ -f "$f" ] || exit 1; jq -r "$q" "$f"');
  return bash(cover, Object.assign({ STUBS: stub, D: d, GITHUB_RUN_ID: '99', GITHUB_REPOSITORY: 'o/r', HEAD_SHA: 'low', PR: '7', BASE: 'integ', SWITCH: 'on' }, env));
};
const prs = [[7, 'low', 'identical', 0], [8, 'mid', 'ahead', 2], [9, 'top', 'ahead', 5], [10, 'side', 'diverged', 0]];
const run2 = (id, status, conclusion, t = 1) => run(id, status, conclusion, t, [9]);
let c = stack(prs, { top: [run2(50, 'in_progress', null)] });
ok('cover: the top of the stack gates it; mirror, its PR and head', c.status === 0 && c.out.mirror === '50' && c.out.mirror_pr === '9' && c.out.mirror_sha === 'top', c);
c = stack(prs, { top: [run2(50, 'completed', 'success')] });
ok('cover: a passing run of the top is carried', c.out.mirror === '50', c);
c = stack(prs, { top: [run2(50, 'completed', 'failure')] });
ok('cover: a failed run of the top: the usual run', c.status === 0 && !c.out.mirror, c);
c = stack(prs, { top: [run2(50, 'completed', 'cancelled')] });
ok('cover: a cancelled run of the top: the usual run', !c.out.mirror, c);
c = stack(prs, {});
ok('cover: no run of the top yet: the usual run', !c.out.mirror && /no passing or running Gate run/.test(c.sum), c);
c = stack(prs, { top: [run(50, 'in_progress', null, 1, [4])] });
ok('cover: a run of another PR on that commit does not count', !c.out.mirror, c);
c = stack([[7, 'low', 'identical', 0], [10, 'side', 'diverged', 0], [11, 'behind', 'behind', 0]], { side: [run2(50, 'completed', 'success')] });
ok('cover: no open PR contains this head: the usual run', !c.out.mirror && /No open pull request/.test(c.sum), c);
c = stack(prs, { top: [run2(50, 'in_progress', null)] }, { SWITCH: '' });
ok('cover: the switch off only reports', c.status === 0 && !c.out.mirror && /Report only .*#9 contains this head and run 50/.test(c.sum), c);
c = stack(prs, { top: [run2(50, 'in_progress', null)] }, { PR: 'x' });
ok('cover: a bad PR number does nothing', c.status === 0 && !c.out.mirror, c);
const brokenCover = bash(cover, { STUBS: stubs('fail', 'exit 1'), GITHUB_RUN_ID: '99', GITHUB_REPOSITORY: 'o/r', HEAD_SHA: 'low', PR: '7', BASE: 'integ', SWITCH: 'on' });
ok('cover: failed look-ups give the usual run', brokenCover.status === 0 && !brokenCover.out.mirror, brokenCover);
ok('the ready job passes the mirrored PR and head on', /mirror_pr:/.test(ready) && /mirror_sha:/.test(ready) && /mirror_pr: \$\{\{ needs\.ready\.outputs\.mirror_pr \}\}/.test(job('plan')));

// the Gate job: tier none checks the mirrored run again
const gate = job('gate');
ok('the Gate job may read the runs (actions: read)', /permissions:\n\s+contents: read\n\s+actions: read/.test(gate));
const g = /run: \|\n([\s\S]*)$/.exec(gate);
const gscript = g ? g[1].split('\n').map((l) => l.slice(10)).join('\n').replace(/\$\{\{ needs\.\w+\.result \}\}/g, 'skipped').replace('[ "skipped" = success ] || { echo "::error::plan', '[ "success" = success ] || { echo "::error::plan') : '';
// (replies: the look-ups in turn, the last one repeated; sleep stubbed; a reply 'ERR' is a failed look-up)
const check = (...replies) => { const f = path.join(dir, 'r' + ++n); fs.writeFileSync(f, replies.join('\n') + '\n');
  return bash(`sleep() { :; }; gh() { local r; r=$(head -n 1 "$R"); [ "$(wc -l < "$R")" -gt 1 ] && sed -i 1d "$R"; [ "$r" = ERR ] && return 1; echo "$r"; }; ${gscript}`,
    { R: f, TIER: 'none', MIRROR: '5', PR: '7', HEAD_SHA: 'abc', GITHUB_REPOSITORY: 'o/r', SEL_GLSL: 'false', SEL_QUALITY: 'false', SEL_BROWSER: 'false' }); };
ok('Gate: a passing mirrored run of this PR on this commit passes', check('completed success abc true').status === 0, check('completed success abc true'));
ok('Gate: a mirrored run that did not pass fails', check('completed failure abc true').status === 1);
ok('Gate: a mirrored run on another commit fails', check('completed success def true').status === 1);
ok('Gate: a mirrored run of another PR fails', check('completed success abc false').status === 1);
// (#379 follow-up: a mirrored run still going is waited for, its verdict carried; never green before it passed)
const w = check('in_progress  abc true', 'queued  abc true', 'completed success abc true');
ok('Gate: a running mirrored run is waited for, then its pass carried', w.status === 0 && (w.stdout.match(/run 5:/g) || []).length === 3, w);
ok('Gate: a running mirrored run that then fails fails', check('in_progress  abc true', 'completed failure abc true').status === 1);
ok('Gate: a look-up that keeps failing while it waits fails (after 5 tries)', (() => { const r = check('in_progress  abc true', 'ERR'); return r.status === 1 && (r.stdout.match(/run 5:/g) || []).length === 6; })());
ok('Gate: one failed look-up while it waits is retried', check('in_progress  abc true', 'ERR', 'completed success abc true').status === 0);
ok('Gate: the job may wait as long as a Gate run (timeout-minutes when tier none)', /timeout-minutes: \$\{\{ needs\.plan\.outputs\.tier == 'none' && \d{3} \|\| 5 \}\}/.test(gate), (/timeout-minutes: .*/.exec(gate) || [])[0]);

fs.rmSync(dir, { recursive: true, force: true });
console.log(`t_gate_ready: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
