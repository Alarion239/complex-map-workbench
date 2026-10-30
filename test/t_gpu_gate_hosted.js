// gpu-gate.yml, machines windows-hosted (#378): mode glprof on GitHub's windows-latest (ANGLE's Direct3D 11 on WARP,
// the same FXC on the CPU as the laptop), this commit against the reference. The plan's machines step, run with bash,
// maps it and refuses it for the gates; the glprof job runs on windows-latest without --require-hardware and with the
// reference, one round; every other machine keeps its self-hosted runner. Node and bash, no YAML library.
// Run: node test/t_gpu_gate_hosted.js
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const Y = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'gpu-gate.yml'), 'utf8');
let pass = 0, fail = 0;
const ok = (name, cond, got) => { if (cond) pass++; else { fail++; console.log('FAIL ' + name + (got !== undefined ? ' ' + JSON.stringify(got) : '')); } };
const job = (name) => { const m = new RegExp(`^ {2}${name}:\\n([\\s\\S]*?)(?=^ {2}[\\w-]+:\\n|(?![\\s\\S]))`, 'm').exec(Y); return m ? m[1] : ''; };

ok('machines offers windows-hosted', /options: \[both, windows, mac, windows-hosted\]/.test(Y));
// the plan's machines step, run with bash for each input
const m = /- id: machines\n\s+shell: bash\n\s+run: \|\n([\s\S]*?)\n {6}(?:#|- )/.exec(job('plan'));
ok('the machines step is found', !!m);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gpu-hosted-'));
const machines = (machinesIn, mode) => {
  const out = path.join(dir, `${machinesIn}-${mode}`);
  fs.writeFileSync(out, '');
  const code = m[1].split('\n').map((l) => l.replace(/^ {10}/, '')).join('\n').replace(/\$\{\{ inputs\.machines \}\}/g, machinesIn).replace(/\$\{\{ inputs\.mode \}\}/g, mode);
  const r = spawnSync('bash', ['-c', code], { env: Object.assign({}, process.env, { GITHUB_OUTPUT: out }), encoding: 'utf8' });
  return { status: r.status, out: fs.readFileSync(out, 'utf8').trim(), err: r.stdout + r.stderr };
};
if (m) {
  ok('windows-hosted, glprof: the hosted machine', machines('windows-hosted', 'glprof').out === 'machines=["Windows-hosted"]', machines('windows-hosted', 'glprof'));
  const g = machines('windows-hosted', 'gate');
  ok('windows-hosted, gate: refused (the gates need our GPUs)', g.status !== 0 && /glprof only/.test(g.err), g);
  ok('windows: the laptop', machines('windows', 'glprof').out === 'machines=["Windows"]');
  ok('both: the laptop and the Mac', machines('both', 'gate').out === 'machines=["Windows","macOS"]');
}
fs.rmSync(dir, { recursive: true, force: true });

const gp = job('glprof');
const runsOn = (/runs-on: (.*)/.exec(gp) || [])[1] || '';
ok('glprof runs on windows-latest for Windows-hosted, else on the machine\'s self-hosted runner',
  runsOn.includes(`matrix.machine == 'Windows-hosted' && '"windows-latest"'`) && runsOn.includes(`format('["self-hosted","{0}","gpu"]', matrix.machine)`), runsOn);
ok('the hosted machine gets Python (build.py)', /if: matrix\.machine == 'Windows-hosted'\n\s+uses: actions\/setup-python/.test(gp));
ok('the probe requires hardware except on the hosted machine', gp.includes("node ci/gpu_probe.js ${{ matrix.machine != 'Windows-hosted' && '--require-hardware' || '' }}"));
const cmd = (/- run: node ci\/glprof\.js (.*)/.exec(gp) || [])[1] || '';
ok('the hosted machine measures against the reference, one round', cmd.includes(`matrix.machine == 'Windows-hosted' && format('--ref {0} --rounds 1 --step-timeout 600', needs.plan.outputs.reference)`), cmd);
ok('a variant still replaces the reference', cmd.indexOf("inputs.variant == 'unroll'") < cmd.indexOf('Windows-hosted'), cmd);
ok('the gates never run on the hosted machine (their jobs stay self-hosted)', ['glsl', 'quality', 'perf'].every((j) => /runs-on: \[self-hosted, '\$\{\{ matrix\.machine \}\}', gpu\]/.test(job(j))));

console.log(`t_gpu_gate_hosted: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
