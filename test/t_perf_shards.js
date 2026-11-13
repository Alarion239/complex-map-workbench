// Unit checks of ci/perf_shards.js: the perf shards, their named parts, and which ids a dispatch runs. Every perf unit is
// in exactly one shard and, in a shard with parts, in exactly one part; the matrix runs the shards for nothing or `all`, a
// part or a shard whole when named.
//   node test/t_perf_shards.js
const { execFileSync } = require('child_process');
const path = require('path');
const { SHARDS, PARTS, find, matrix, check } = require('../ci/perf_shards.js');
let n = 0, fails = 0;
const ok = (name, c, info) => { n++; if (!c) { fails++; console.log('FAIL', name, info === undefined ? '' : JSON.stringify(info)); } };
const throws = (f) => { try { f(); return false; } catch (e) { return true; } };

ok('every unit is in one shard and one part of it', check().length === 0, check());
const ids = SHARDS.map((s) => s.id);
const leaves = (o, k) => matrix(o, k, { leaves: true });
// GitHub's machines: one job per shard
ok('no ids: the shards', matrix(null, null).join() === ids.join());
ok('all: the shards, even beside a part', matrix(['all'], null).join() === ids.join() && matrix(['steps-king', 'all'], null).join() === ids.join());
ok('a part runs alone, a shard whole', matrix(['steps-king', 'pointer-drag'], null).join() === 'steps-king,pointer-drag' && matrix(['steps'], null).join() === 'steps');
ok('a part beside its own shard is covered by the shard', matrix(['steps', 'steps-king', 'phone-open'], null).join() === 'steps,phone-open');
ok('a repeated id runs once', matrix(['phone-open', 'phone-open'], null).join() === 'phone-open');
ok('skip removes ids', !matrix(['all'], ['phone']).includes('phone') && matrix(null, ['steps']).length === ids.length - 1);
// the GPU gate (--leaves): a split shard stands for its parts
const steps4 = 'steps-first,steps-default,steps-zeta,steps-king,steps-globe,steps-land,steps-cold,steps-long';
ok('leaves: nothing or all is the shards with steps as its eight parts', leaves(null).join() === ids.filter((i) => i !== 'steps').concat(steps4.split(',')).join() && leaves(['all']).join() === leaves(null).join());
ok('leaves: steps is its eight parts (an existing dispatch keeps working)', leaves(['steps']).join() === steps4);
ok('leaves: classic is the shards that are not split', leaves(['classic']).join() === ids.filter((i) => i !== 'steps').join());
ok('leaves: a part is one job, a shard that is not split runs whole', leaves(['steps-king']).join() === 'steps-king' && leaves(['pointer']).join() === 'pointer');
ok('leaves: a part beside its own whole shard runs once', leaves(['pointer', 'pointer-drag', 'steps', 'steps-king']).join() === 'pointer,' + steps4);
ok('leaves: skip removes a leaf', !leaves(null, ['steps-king']).includes('steps-king') && leaves(null, ['steps-king']).includes('steps-zeta'));
ok('skip expands a split shard as only does: its id leaves out its parts, a part leaves out itself', leaves(null, ['steps']).join() === ids.filter((i) => i !== 'steps').join() && matrix(null, ['steps']).join() === ids.filter((i) => i !== 'steps').join() && leaves(['steps'], ['steps-king']).join() === 'steps-first,steps-default,steps-zeta,steps-globe,steps-land,steps-cold,steps-long');
ok('skip: a whole shard named beside its parts takes them with it', matrix(['steps', 'phone-open'], ['steps']).join() === 'phone-open' && leaves(['pointer-drag', 'phone'], ['pointer']).join() === 'phone');
ok('an unknown id is an error', throws(() => matrix(null, ['steps-kng'])) &&  throws(() => matrix(['steps-kng'], null)) && throws(() => leaves(['nope'])));
// the steps leaves select exactly the units `^sv\.` does (run.js --list), each once
const units = execFileSync(process.execPath, [path.join(__dirname, '..', 'test', 'regress', 'perf', 'run.js'), '--list'], { encoding: 'utf8' }).split('\n').map((l) => l.split(/\s+/)[0]).filter(Boolean);
const sv = units.filter((u) => /^sv\./.test(u));
const byLeaf = steps4.split(',').flatMap((id) => units.filter((u) => new RegExp(find(id).re).test(u)));
ok('the steps leaves select the sv units, each once', sv.length > 0 && byLeaf.length === sv.length && new Set(byLeaf).size === sv.length && byLeaf.every((u) => sv.includes(u)), byLeaf);
ok('steps-king is the King pair alone', units.filter((u) => new RegExp(find('steps-king').re).test(u)).join() === 'sv.interact.king,sv.glide.king');
ok('find: a shard and a part', find('steps').re === SHARDS.find((s) => s.id === 'steps').re && find('steps-king').of === 'steps' && !find('nope'));
ok('the CLI exits 2 on an unknown id', (() => { try { execFileSync(process.execPath, [path.join(__dirname, '..', 'ci', 'perf_shards.js'), 'matrix', '--only', 'nope'], { stdio: 'pipe' }); return false; } catch (e) { return e.status === 2; } })());

// the check bites: a part that leaves a unit out, or covers one twice
const part = PARTS[0];
const saved = part.re;
part.re = '^nothing-matches$';
ok('a part that covers no unit leaves one out', check().some((l) => /in no part of steps/.test(l)), check());
part.re = '^sv\\.';
ok('parts that overlap are found', check().some((l) => /in the parts .* and /.test(l)), check());
part.re = saved;
ok('the check is clean again', check().length === 0);

console.log(`${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);
