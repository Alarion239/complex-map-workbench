'use strict';
// Infinite loops in Inverse.prepare / Inverse.singular when a lattice or member index exceeds 2^53 (n++ / m++ stall).
// Each case runs in a child process with a 3 s timeout.
const { spawnSync } = require('child_process');
const cases = {
  // prepare -> accumulation -> pullBack -> latticeIn (tanh's pole lattice, ref = sinh(c_ref) ~ 1e36)
  sinh_tanh_exp_prepare: `const ch = L.chain([{type:'sinh'},{type:'tanh'},{type:'exp'}]); Inverse.prepare(ch.plan, {win: {x0: 81.0574, x1: 87.8908, y0: 52.7075, y1: 61.3075}, shape: {kind:'halfplane', a:[-61.2,52.77], b:[-61.56,51.83]}});`,
  // the same through exp: tan(e^z), then exp; left view panned to Re z = 40
  exp_tan_exp_prepare: `const ch = L.chain([{type:'exp'},{type:'tan'},{type:'exp'}]); Inverse.prepare(ch.plan, {win: L.boxOf(40, 0, 60), shape: {kind:'disc', c:[40,0], r:1}});`,
  // singular(..., ['pole']) (P4 line refinement): tan(e^z) with the left view at Re z = 40
  exp_tan_singular_pole: `const ch = L.chain([{type:'exp'},{type:'tan'}]); Inverse.singular(ch.plan, L.boxOf(40, 0, 60), ['pole'], 16);`,
  // prepare -> accumulation: z^i's 0 pulled back through sin with ref = e^{c_ref} (pullFinite m loop)
  exp_sin_powai_prepare: `const ch = L.chain([{type:'exp'},{type:'sin'},{type:'powa',params:{alpha:'i'}}]); Inverse.prepare(ch.plan, {win: L.boxOf(40, 0.5, 60), shape: {kind:'disc', c:[40,0.5], r:0.1}});`,
  // polynomial prefixes: z^16 then tan then exp, left view at |z| = 12; tan(z^16) singular poles
  pown16_tan_exp_prepare: `const ch = L.chain([{type:'pown',params:{n:16}},{type:'tan'},{type:'exp'}]); Inverse.prepare(ch.plan, {win: L.boxOf(12, 0, 60), shape: {kind:'disc', c:[12,0], r:0.01}});`,
  pown16_tan_singular_pole: `const ch = L.chain([{type:'pown',params:{n:16}},{type:'tan'}]); Inverse.singular(ch.plan, L.boxOf(12, 0, 60), ['pole'], 16);`,
  pown16_sin_powai_prepare: `const ch = L.chain([{type:'pown',params:{n:16}},{type:'sin'},{type:'powa',params:{alpha:'i'}}]); Inverse.prepare(ch.plan, {win: L.boxOf(12, 0.1, 60), shape: {kind:'disc', c:[12,0.1], r:0.01}});`,
  // controls: the same chains with the left view at Re z = 30 (indices below 2^53)
  control_exp_tan_exp_at30: `const ch = L.chain([{type:'exp'},{type:'tan'},{type:'exp'}]); Inverse.prepare(ch.plan, {win: L.boxOf(30, 0, 60), shape: {kind:'disc', c:[30,0], r:1}});`,
  control_exp_tan_singular_at30: `const ch = L.chain([{type:'exp'},{type:'tan'}]); Inverse.singular(ch.plan, L.boxOf(30, 0, 60), ['pole'], 16);`,
};
for (const [name, code] of Object.entries(cases)) {
  const src = `const L = require(${JSON.stringify(__dirname + '/lib.js')}); const { Inverse } = L; const t0 = Date.now(); ${code} console.log('returned in', Date.now() - t0, 'ms');`;
  const t0 = Date.now();
  const r = spawnSync(process.execPath, ['--max-old-space-size=400', '-e', src], { timeout: 3000, encoding: 'utf8' });
  const how = r.error && r.error.code === 'ETIMEDOUT' ? 'HUNG (killed after 3 s)' : r.status !== 0 ? `CRASHED (${(r.stderr.match(/FATAL ERROR[^\n]*/) || [r.stderr.slice(0, 120)])[0]})` : r.stdout.trim();
  console.log(name.padEnd(30), how, `(${Date.now() - t0} ms)`);
}
