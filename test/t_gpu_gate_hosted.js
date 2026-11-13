// gpu-gate.yml, machines windows-hosted (#378): mode glprof on GitHub's windows-latest (ANGLE's Direct3D 11 on WARP,
// the same FXC on the CPU as the laptop), this commit against the reference. The plan's machines step, run with bash,
// maps it and refuses it for the gates; the glprof job runs on windows-latest without --require-hardware and with the
// reference, one round; every other machine keeps its self-hosted runner. And (#169) the Windows GPU runner, a desktop,
// is on request only: windows and both send it jobs, the default and every event run the Mac alone, so no job waits
// for a desktop that is off. Node and bash, no YAML library.
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

ok('machines offers mac (the default), both, windows and windows-hosted', /options: \[mac, both, windows, windows-hosted\]\n\s+default: mac\n/.test(Y));
// the plan's machines step, run with bash for each input
const m = /- id: machines\n\s+shell: bash\n\s+run: \|\n([\s\S]*?)\n {6}(?:#|- )/.exec(job('plan'));
ok('the machines step is found', !!m);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gpu-hosted-'));
const machines = (machinesIn, mode) => {
  const out = path.join(dir, `${machinesIn}-${mode}`);
  fs.writeFileSync(out, ''); fs.writeFileSync(out + '.sum', '');
  const code = m[1].split('\n').map((l) => l.replace(/^ {10}/, '')).join('\n').replace(/\$\{\{ inputs\.machines \}\}/g, machinesIn).replace(/\$\{\{ inputs\.mode \}\}/g, mode);
  const r = spawnSync('bash', ['-c', code], { env: Object.assign({}, process.env, { GITHUB_OUTPUT: out, GITHUB_STEP_SUMMARY: out + '.sum' }), encoding: 'utf8' });
  return { status: r.status, out: fs.readFileSync(out, 'utf8').trim(), err: r.stdout + r.stderr };
};
if (m) {
  ok('windows-hosted, glprof: the hosted machine', machines('windows-hosted', 'glprof').out === 'machines=["Windows-hosted"]', machines('windows-hosted', 'glprof'));
  const g = machines('windows-hosted', 'gate');
  ok('windows-hosted, gate: refused (the gates need our GPUs)', g.status !== 0 && /glprof only/.test(g.err), g);
  // (#169: the Windows desktop is on request only: only windows and both send it jobs, they would wait while it is off)
  const quiet = (r) => r.status === 0 && !/::(error|warning)::/.test(r.err);
  for (const mode of ['gate', 'glprof', 'suites']) {
    const w = machines('windows', mode);
    ok(`windows, ${mode}: the Windows desktop alone`, quiet(w) && w.out === 'machines=["Windows"]', w);
  }
  const b = machines('both', 'gate');
  ok('both: the Windows desktop and the Mac', quiet(b) && b.out === 'machines=["Windows","macOS"]', b);
  for (const [inp, why] of [['mac', 'mac'], ['', 'no input: a push, the nightly run, the label gpu-gate']]) {
    const r = machines(inp, 'gate');
    ok(`${why}: the Mac alone, no job for the desktop`, quiet(r) && r.out === 'machines=["macOS"]', r);
  }
}
fs.rmSync(dir, { recursive: true, force: true });

// the concurrency group (#169): a by-hand run that asks for the desktop may wait for hours, or for as long as the desktop
// is off, so it gets a group of its own and never holds the next push to main behind it. The group's expression, evaluated
const grp = /^ {2}group: (.*)$/m.exec(Y.slice(Y.indexOf('\nconcurrency:')));
ok('the concurrency group is found', !!grp);
if (grp) {
  const expr = /^gpu-gate-\$\{\{ (.*) \}\}$/.exec(grp[1]);
  const group = (ev, o = {}) => {
    const github = { event_name: ev, ref: o.ref || 'refs/heads/main', event: { pull_request: { number: o.pr } } };
    const f = new Function('github', 'inputs', 'contains', 'fromJSON', 'format', `return ${expr[1]};`);
    return f(github, { machines: o.machines || '' }, (a, b) => a.includes(b), JSON.parse, (t, ...a) => t.replace(/\{(\d)\}/g, (_, i) => a[i]));
  };
  const push = group('push'), main = (mm) => group('workflow_dispatch', { machines: mm });
  ok('a push to main and the nightly run keep their own groups', push === 'refs/heads/main' && group('schedule') === 'nightly', [push, group('schedule')]);
  ok('a by-hand run on the Mac shares its branch\'s group, as before', main('mac') === push && main('') === push && main('windows-hosted') === push, [main('mac'), main('windows-hosted')]);
  for (const mm of ['windows', 'both']) ok(`a by-hand ${mm} run never sits in main's group`, main(mm) !== push && main(mm) !== group('schedule'), main(mm));
  ok('a desktop run replaces the one before it on its own branch only', group('workflow_dispatch', { machines: 'windows', ref: 'refs/heads/x' }) !== main('windows') && main('windows') === main('both'));
  ok('a pull request keeps its own group', String(group('pull_request', { pr: 725 })) === '725');
}

const gp = job('glprof');
const runsOn = (/runs-on: (.*)/.exec(gp) || [])[1] || '';
ok('glprof runs on windows-latest for Windows-hosted, else on the machine\'s self-hosted runner',
  runsOn.includes(`matrix.machine == 'Windows-hosted' && '"windows-latest"'`) && runsOn.includes(`format('["self-hosted","{0}","gpu"]', matrix.machine)`), runsOn);
ok('the hosted machine gets Python (build.py)', /if: matrix\.machine == 'Windows-hosted'\n\s+uses: actions\/setup-python/.test(gp));
ok('the probe requires hardware, and on the hosted machine Direct3D 11', gp.includes("node ci/gpu_probe.js ${{ matrix.machine != 'Windows-hosted' && '--require-hardware' || '--require-angle d3d11' }}"));
// the probe's own check of the renderer string (its --require-angle names)
const probe = fs.readFileSync(path.join(__dirname, '..', 'ci', 'gpu_probe.js'), 'utf8');
const names = /const names = (\{[^\n]*\});/.exec(probe);
ok('the probe has its --require-angle names', !!names);
if (names) {
  const N = eval(`(${names[1]})`);
  ok('d3d11 accepts ANGLE on WARP', N.d3d11.test('ANGLE (Microsoft, Microsoft Basic Render Driver (0x0000008C) Direct3D11 vs_5_0 ps_5_0, D3D11)'));
  ok('d3d11 accepts the laptop', N.d3d11.test('ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x000046A8) Direct3D11 vs_5_0 ps_5_0, D3D11)'));
  ok('d3d11 refuses SwiftShader', !N.d3d11.test('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)'));
}
const cmd = (/- run: .*node ci\/glprof\.js (.*)/.exec(gp) || [])[1] || '';
ok('the Windows machines measure against the reference, one round', cmd.includes(`startsWith(matrix.machine, 'Windows') && format('--ref {0} --rounds 1 --step-timeout 600', needs.plan.outputs.reference)`), cmd);
ok('a variant still replaces the reference', cmd.indexOf("inputs.variant == 'unroll'") < cmd.indexOf("startsWith(matrix.machine, 'Windows')"), cmd);
ok('the gates never run on the hosted machine (their jobs stay self-hosted)', ['glsl', 'quality', 'perf'].every((j) => /runs-on: \[self-hosted, '\$\{\{ matrix\.machine \}\}', gpu\]/.test(job(j))));

console.log(`t_gpu_gate_hosted: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
