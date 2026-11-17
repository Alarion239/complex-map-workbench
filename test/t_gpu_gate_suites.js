// gpu-gate.yml, mode suites: only the browser suites a regular expression names, on the Mac's GPU, at the dispatched ref.
// The plan's check of the input (empty and invalid expressions are refused behind the approval), the suites job (the Mac's
// self-hosted runner, the hardware probe, the expression through the environment and quoted), and the other jobs
// (glsl, quality, perf, gate) left out for this mode. Node and bash, no YAML library.
// Run: node test/t_gpu_gate_suites.js
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const Y = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'gpu-gate.yml'), 'utf8');
let pass = 0, fail = 0;
const ok = (name, cond, got) => { if (cond) pass++; else { fail++; console.log('FAIL ' + name + (got !== undefined ? ' ' + JSON.stringify(got) : '')); } };
const job = (name) => { const m = new RegExp(`^ {2}${name}:\\n([\\s\\S]*?)(?=^ {2}[\\w-]+:\\n|(?![\\s\\S]))`, 'm').exec(Y); return m ? m[1] : ''; };

ok('mode offers suites beside gate and glprof', /options: \[gate, glprof, suites, fxc\]\n\s+default: gate\n/.test(Y));
ok('the input suites exists and is optional', /\n {6}suites:\n\s+description: [^\n]*\n\s+required: false\n\s+default: ''\n/.test(Y));

// the plan's check of the expression, run with bash
const plan = job('plan');
const m = /- if: inputs\.mode == 'suites'\n\s+shell: bash\n\s+env:\n\s+SUITES: \$\{\{ inputs\.suites \}\}\n\s+run: \|\n([\s\S]*?)\n {6}- id: shards/.exec(plan);
ok('the plan checks the expression only for mode suites, through the environment', !!m);
if (m) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gpu-suites-'));
  const code = m[1].split('\n').map((l) => l.replace(/^ {10}/, '')).join('\n');
  const check = (suites) => {
    const sum = path.join(dir, 'sum'); fs.writeFileSync(sum, '');
    const r = spawnSync('bash', ['-c', code], { env: Object.assign({}, process.env, { SUITES: suites, GITHUB_STEP_SUMMARY: sum }), encoding: 'utf8' });
    return { status: r.status, err: r.stdout + r.stderr, sum: fs.readFileSync(sum, 'utf8') };
  };
  const empty = check('');
  ok('an empty expression is refused, naming the input', empty.status !== 0 && /needs the input suites/.test(empty.err), empty);
  const bad = check('steps_(');
  ok('an invalid expression is refused', bad.status !== 0 && /not a regular expression/.test(bad.err), bad);
  const good = check('^steps_glide_look_cmd');
  ok('a valid expression passes and is named in the summary', good.status === 0 && good.sum.includes('^steps_glide_look_cmd'), good);
  const hostile = check('x"; echo pwned; "');
  ok('shell text in the expression is data: it is only a regular expression', hostile.status === 0 && !/pwned\n/.test(hostile.err) && hostile.sum.includes('echo pwned'), hostile);
  fs.rmSync(dir, { recursive: true, force: true });
}

// the suites job
const sj = job('suites');
ok('the suites job exists, behind the plan (its approval), for mode suites only', /needs: plan\n\s+if: inputs\.mode == 'suites'\n/.test(sj));
ok('it runs on the machine\'s self-hosted GPU runner', /runs-on: \[self-hosted, '\$\{\{ matrix\.machine \}\}', gpu\]/.test(sj));
ok('the machines come from the plan', sj.includes('machine: ${{ fromJSON(needs.plan.outputs.machines) }}'));
ok('the hardware probe runs before the suites', sj.indexOf('node ci/gpu_probe.js --require-hardware') > 0 && sj.indexOf('gpu_probe') < sj.indexOf('browser.js'));
ok('the expression reaches ci/browser.js through the environment, quoted', /env:\n\s+SUITES: \$\{\{ inputs\.suites \}\}\n\s+run: \$\{\{ matrix\.machine == .macOS. && .caffeinate -dimsu.. \|\| .. \}\}node ci\/browser\.js --only "\$SUITES"/.test(sj), sj);
ok('the expression is never interpolated into a run line', !/run:[^\n]*\$\{\{ inputs\.suites \}\}/.test(Y));

// the Mac's browser and GPU steps run awake, the other machines' commands unchanged
const prefix = "${{ matrix.machine == 'macOS' && 'caffeinate -dimsu ' || '' }}";
for (const [j, script] of [['glprof', 'glprof'], ['suites', 'browser'], ['glsl', 'glsl'], ['quality', 'quality'], ['perf', 'perf_shard']]) {
  ok(`${j}: ci/${script}.js runs under the Mac-only caffeinate prefix`, job(j).includes(`run: ${prefix}node ci/${script}.js `), job(j));
}

// the other jobs leave this mode out
for (const j of ['glsl', 'quality', 'perf', 'gate']) {
  const cond = (/\n {4}if: ([^\n]*(?:\n {8}[^\n]*)*)/.exec(job(j)) || [])[1] || '';
  ok(`${j} is left out for mode suites`, cond.includes("inputs.mode != 'suites'"), cond);
}
ok('glprof still runs only for mode glprof', /if: inputs\.mode == 'glprof'/.test(job('glprof')));

console.log(`t_gpu_gate_suites: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
