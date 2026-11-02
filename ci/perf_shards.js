'use strict';
// The perf suite (test/regress/perf/run.js) split into shards, each one CI job: a job on GitHub's machines may run for
// 6 hours, a paired shard on software rendering takes up to about an hour. Every unit of run.js --list is in exactly one
// shard (the opt-in swiftshader.ratio aside); `node ci/perf_shards.js check` fails otherwise, and the gate's plan job
// runs it, so a new unit cannot be left out silently.
//   node ci/perf_shards.js matrix [--only id,id] [--skip id,id]   the shard ids as a JSON array (a matrix dimension)
//   node ci/perf_shards.js regex ID                                one shard's unit regex
//   node ci/perf_shards.js check                                   coverage of run.js --list
const SHARDS = [
  { id: 'image-default', re: '^image\\.default\\.', what: 'Image mode, the default example, meshes 240 / 480 / 1920' },
  { id: 'image-logUHP', re: '^image\\.logUHP\\.', what: 'Image mode, log of the upper half-plane' },
  { id: 'image-chain4', re: '^image\\.(chain4|stages3)\\.', what: 'Image mode, a 4-step chain; shapes of planes 1-3 pulled back (#253)' },
  { id: 'image-ziH', re: '^image\\.ziH\\.', what: 'Image mode, z^i of H (dpr 1 and 2, opacities)' },
  { id: 'image-expH', re: '^image\\.(expH|disc_cube)\\.', what: 'Image mode, exp of H, the disc under z^3 (dpr 2)' },
  { id: 'image-sphere-mesh', re: '^image\\.(custom_e_z1z|expexp_H)\\.', what: 'Image mode, the SphereMesh chains' },
  { id: 'views', re: '^(phase|landscape|sphere)\\.', what: 'Phase, Landscape and Sphere views' },
  { id: 'examples', re: '^(examples|gallery)', what: 'loading the examples, the gallery' },
  { id: 'interaction', re: '^(mesh|scrub|morph|hover|cards)', what: 'meshing, scrubs, the deformation, hover, the step cards' },
  { id: 'pointer', re: '^pointer\\.', what: 'wave 1\'s pointer and per-frame work (#63): snap, detents, gliders, the probe, targets' },
  { id: 'phone', re: '^phone\\.', what: 'the emulated phone (390 x 844 @3x, touch, CPU / 4)' },
  { id: 'probe', re: '^svp\\.', what: 'measurement probes, not for merge (#643)' },
  { id: 'steps', re: '^sv\\.', what: 'the steps view (#366): the first glide, a warm glide, the interactions, the glide at 60 fps' },
];

function units() {
  const { execFileSync } = require('child_process');
  const path = require('path');
  return execFileSync(process.execPath, [path.join(__dirname, '..', 'test', 'regress', 'perf', 'run.js'), '--list'], { encoding: 'utf8' })
    .split('\n').map((l) => l.split(/\s+/)[0]).filter(Boolean);
}
function check() {
  const bad = [];
  for (const u of units()) {
    if (u === 'swiftshader.ratio') continue;
    const n = SHARDS.filter((s) => new RegExp(s.re).test(u)).map((s) => s.id);
    if (n.length !== 1) bad.push(`${u}: ${n.length ? 'in ' + n.join(' and ') : 'in no shard'}`);
  }
  return bad;
}

if (require.main === module) {
  const [cmd, a1] = process.argv.slice(2);
  const list = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1].split(',').map((s) => s.trim()).filter(Boolean) : null; };
  if (cmd === 'check') {
    const bad = check();
    if (bad.length) { console.error('perf units not in exactly one shard (ci/perf_shards.js):\n  ' + bad.join('\n  ')); process.exit(1); }
    console.log(`every perf unit is in exactly one of ${SHARDS.length} shards`);
  } else if (cmd === 'regex') {
    const s = SHARDS.find((x) => x.id === a1);
    if (!s) { console.error(`no shard ${a1}`); process.exit(2); }
    console.log(s.re);
  } else if (cmd === 'matrix') {
    const only = list('--only'), skip = list('--skip');
    console.log(JSON.stringify(SHARDS.filter((s) => (!only || only.includes(s.id)) && !(skip && skip.includes(s.id))).map((s) => s.id)));
  } else { console.error('usage: node ci/perf_shards.js matrix|regex ID|check'); process.exit(2); }
}
module.exports = { SHARDS, check };
