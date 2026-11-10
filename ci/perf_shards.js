'use strict';
// The perf suite (test/regress/perf/run.js) split into shards, each one CI job: a job on GitHub's machines may run for
// 6 hours, a paired shard on software rendering takes up to about an hour. Every unit of run.js --list is in exactly one
// shard (the opt-in swiftshader.ratio aside); `node ci/perf_shards.js check` fails otherwise, and the gate's plan job
// runs it, so a new unit cannot be left out silently.
// The larger shards have named PARTS (a scene or a map each) that split their units exactly: a dispatch names the parts a
// change needs (`--only steps-king,pointer-drag`), and each part is its own job with its own rows and verdict. A shard's id
// in `--only` runs the shard whole, `all` (or nothing) every shard, `classic` the shards that are not split (`split: true`).
// On the GPU gate (`--leaves`) a split shard stands for its parts, one job each (its LEAVES), so its id, `all` and nothing run
// them; on GitHub's machines (no flag) every shard is one job. A part's units are a subset of its shard's, so `check` also
// fails when the parts of a shard do not cover its units exactly once each.
//   node ci/perf_shards.js matrix [--only id,id|all|classic] [--skip id,id] [--leaves]   the ids to run as a JSON array (a matrix dimension)
//   node ci/perf_shards.js regex ID                                one shard's or part's unit regex
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
  { id: 'steps', split: true, re: '^sv\\.', what: 'the steps view (#366): the first glide, a warm glide, the interactions, the glide at 60 fps' },
];

// the parts of the larger shards: { id, of: the shard's id, re, what }; the regexes split the shard's units
const PARTS = [
  { id: 'steps-first', of: 'steps', re: '^sv\\.first_glide$', what: 'the steps view: the first glide' },
  { id: 'steps-default', of: 'steps', re: '^sv\\.(interact|glide)\\.default$', what: 'the steps view on the default page: the interactions and the warm glide' },
  { id: 'steps-zeta', of: 'steps', re: '^sv\\.(interact|glide)\\.zeta$', what: 'the steps view on the zeros of zeta: the interactions and the warm glide' },
  { id: 'steps-king', of: 'steps', re: '^sv\\.(interact|glide)\\.king$', what: 'the steps view on the Mountain King: the interactions and the warm glide' },
  { id: 'steps-globe', of: 'steps', re: '^sv\\.glide\\.(globe|globe_in|jouk|cut|cut_globe)$', what: 'the steps view on the globe: the warm glide, Everywhere and Inside regions (default page); the Joukowski airfoil\'s glide on the plane (info); and the glide of a chain with a ray cut, on the plane and on the globe' },
  { id: 'steps-land', of: 'steps', re: '^sv\\.(glide\\.(land|land_in|land_pole|land_sheets)|land_bytes)$', what: 'the steps view\'s Landscape: the warm glide, Everywhere, Inside regions and across the Möbius step\'s pole (default page; info), and the GL bytes it holds at K = 2, 4, 6 and with a pole patch (info)' },
  { id: 'steps-neg', of: 'steps', re: '^sv\\.glide\\.neg_', what: 'diagnostic (#1466): the glides of z^(-1/2) and z^-2 on the plane, the sphere and Landscape' },
  { id: 'steps-cold', of: 'steps', re: '^sv\\.(cold_glide|prestart_edit)$', what: 'the steps view: the first glide on a fresh page (default, the Mountain King), a glide at once after a step is added, and a drag while the prestart runs' },
  { id: 'steps-long', of: 'steps', re: '^sv\\.long_session$', what: 'the steps view: the Mountain King scrubbed 20 times on one page' },
  { id: 'pointer-hover', of: 'pointer', re: '^pointer\\.(hover_point|hover_orth|probe_x)$', what: 'the pointer: the hovers and the probe' },
  { id: 'pointer-drag', of: 'pointer', re: '^pointer\\.(snap_drag|glider)$', what: 'the pointer: the snap drag and the glider' },
  { id: 'pointer-morph', of: 'pointer', re: '^pointer\\.roots_morph_pan$', what: 'the pointer: panning with the deformation playing' },
  { id: 'phone-open', of: 'phone', re: '^phone\\.(open|examples)$', what: 'the emulated phone: opening the app and the examples' },
  { id: 'phone-motion', of: 'phone', re: '^phone\\.(pan|landscape|morph)$', what: 'the emulated phone: pans, Landscape, the deformation' },
  { id: 'views-phase', of: 'views', re: '^phase\\.', what: 'Phase views' },
  { id: 'views-landscape', of: 'views', re: '^landscape\\.', what: 'Landscape view' },
  { id: 'views-sphere', of: 'views', re: '^sphere\\.', what: 'Sphere views' },
  { id: 'interaction-mesh', of: 'interaction', re: '^(mesh|scrub)', what: 'meshing and the parameter scrubs' },
  { id: 'interaction-morph', of: 'interaction', re: '^morph', what: 'the deformation: opening it, playing it' },
  { id: 'interaction-hover', of: 'interaction', re: '^hover', what: 'hover preimage tracking' },
  { id: 'interaction-cards', of: 'interaction', re: '^cards', what: 'the step cards' },
];
// a shard or a part by its id
const find = (id) => SHARDS.find((s) => s.id === id) || PARTS.find((s) => s.id === id);

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
  const ids = [...SHARDS, ...PARTS].map((s) => s.id);
  for (const id of ids) if (ids.indexOf(id) !== ids.lastIndexOf(id)) bad.push(`${id}: the id is used twice`);
  for (const p of PARTS) if (!SHARDS.some((s) => s.id === p.of)) bad.push(`part ${p.id}: no shard ${p.of}`);
  for (const sh of SHARDS) {
    const mine = PARTS.filter((p) => p.of === sh.id);
    if (!mine.length) continue;
    for (const u of units().filter((x) => new RegExp(sh.re).test(x))) {
      const n = mine.filter((p) => new RegExp(p.re).test(u)).map((p) => p.id);
      if (n.length !== 1) bad.push(`${u}: ${n.length ? 'in the parts ' + n.join(' and ') : 'in no part'} of ${sh.id}`);
    }
    for (const p of mine) {
      for (const u of units().filter((x) => new RegExp(p.re).test(x))) if (!new RegExp(sh.re).test(u)) bad.push(`${u}: in part ${p.id} but not in shard ${sh.id}`);
    }
  }
  return bad;
}

// the ids to run, from the ids a dispatch names: a shard's id is the shard (a split one: its parts with leaves, one job
// each), a part's id the part, `all` every shard, `classic` the shards that are not split; nothing is `all`. An unknown id
// is an error
function matrix(only, skip, { leaves = false } = {}) {
  const named = only && only.length ? only : ['all'];
  const expand = (sh) => (leaves && sh.split ? PARTS.filter((p) => p.of === sh.id).map((p) => p.id) : [sh.id]);
  // the ids one name stands for (a part's own id, a split shard's parts with leaves)
  const resolve = (id) => {
    if (id === 'all') return SHARDS.flatMap(expand);
    if (id === 'classic') return SHARDS.filter((sh) => !sh.split).map((sh) => sh.id);
    const sh = SHARDS.find((x) => x.id === id);
    if (sh) return expand(sh);
    if (find(id)) return [id];
    throw new Error(`no shard or part ${id}; ids: all, classic, ${[...SHARDS, ...PARTS].map((x) => x.id).join(', ')}`);
  };
  const ids = named.flatMap(resolve);
  // (a part named beside its own shard is covered by the shard; each id runs once)
  const uniq = [...new Set(ids)];
  // --skip names the same way: a shard's id leaves out the shard and, with it, its parts
  const skipped = new Set((skip || []).flatMap((id) => [...resolve(id), ...(SHARDS.some((sh) => sh.id === id) ? PARTS.filter((p) => p.of === id).map((p) => p.id) : [])]));
  return uniq.filter((id) => !PARTS.some((p) => p.id === id && uniq.includes(p.of))).filter((id) => !skipped.has(id));
}

if (require.main === module) {
  const [cmd, a1] = process.argv.slice(2);
  const list = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1].split(',').map((s) => s.trim()).filter(Boolean) : null; };
  if (cmd === 'check') {
    const bad = check();
    if (bad.length) { console.error('perf units not in exactly one shard (ci/perf_shards.js):\n  ' + bad.join('\n  ')); process.exit(1); }
    console.log(`every perf unit is in exactly one of ${SHARDS.length} shards, and the ${PARTS.length} parts split their shards exactly`);
  } else if (cmd === 'regex') {
    const s = find(a1);
    if (!s) { console.error(`no shard ${a1}`); process.exit(2); }
    console.log(s.re);
  } else if (cmd === 'matrix') {
    try { console.log(JSON.stringify(matrix(list('--only'), list('--skip'), { leaves: process.argv.includes('--leaves') }))); } catch (e) { console.error(e.message); process.exit(2); }
  } else { console.error('usage: node ci/perf_shards.js matrix|regex ID|check'); process.exit(2); }
}
module.exports = { SHARDS, PARTS, find, matrix, check };
