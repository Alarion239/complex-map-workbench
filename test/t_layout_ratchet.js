// ci/layout_ratchet.js (#470): a new violation key fails the check and is refused by update; --init writes the first
// baseline; a key the run no longer sees is reported as fixed and update drops it.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'layout-ratchet-'));
const B = path.join(dir, 'baseline.json');
let nf = 0;
const res = (label, ids, o = {}) => { const f = path.join(dir, `${label}-${nf++}.json`); fs.writeFileSync(f, JSON.stringify({ run: label, out: { info: Object.assign({ matrix: 'M1', renderer: 'lavapipe', skipped: [] }, o), report: ids.map((id) => ({ id, n: 2 })) } })); return f; };
const run = (...a) => spawnSync(process.execPath, [path.join(__dirname, '..', 'ci', 'layout_ratchet.js'), ...a], { env: Object.assign({}, process.env, { CMW_LAYOUT_BASELINE: B, GITHUB_STEP_SUMMARY: '' }), encoding: 'utf8' });
let pass = 0, fail = 0;
const ok = (name, c, d) => { if (c) pass++; else { fail++; console.log('FAIL', name, d || ''); } };

const r1 = res('en', ['overlap a × b', 'covered c × d']);
ok('check with no baseline: the keys are new', run('check', r1).status === 1);
ok('update without --init refuses new keys', run('update', r1).status === 1 && !fs.existsSync(B));
ok('update --init writes the first baseline', run('update', '--init', r1).status === 0 && Object.keys(JSON.parse(fs.readFileSync(B, 'utf8')).runs.en.rows).length === 2);
ok('the same run passes the check', run('check', r1).status === 0);
const r2 = res('en', ['overlap a × b', 'covered c × d', 'clipped e']);
const c2 = run('check', r2);
ok('a new key fails the check and is named', c2.status === 1 && /NEW: clipped e/.test(c2.stdout), c2.stdout);
const r3 = res('en', ['overlap a × b']);
const c3 = run('check', r3);
ok('a key no longer seen passes and is reported as fixed', c3.status === 0 && /fixed, lower the baseline: covered c × d/.test(c3.stdout), c3.stdout);
ok('update lowers the baseline', run('update', r3).status === 0 && Object.keys(JSON.parse(fs.readFileSync(B, 'utf8')).runs.en.rows).join() === 'overlap a × b');
ok('another matrix fails and asks for --init', /another matrix/.test(run('check', res('en', ['overlap a × b'], { matrix: 'M2' })).stdout));
ok('another renderer fails the check here', run('check', res('en', ['overlap a × b'], { renderer: 'Apple M2' })).status === 1);
ok('a state that opened for the baseline and did not now fails', run('check', res('en', ['overlap a × b'], { skipped: ['en classic 390 sheet edit: did not open'] })).status === 1);
// a job's log: the LAYOUT-RESULT line ci/browser.js prints (timestamps before it, as GitHub's logs have them)
const lg = path.join(dir, 'job.log');
fs.writeFileSync(lg, '2026-10-31T05:47:26.6Z ##[group]pass layout_invariants_cmd.js (en)\n2026-10-31T05:47:26.6Z LAYOUT-RESULT ' + JSON.stringify({ label: 'en', info: { matrix: 'M1', renderer: 'lavapipe', skipped: [] }, report: [{ id: 'overlap a × b', n: 3 }] }) + '\n');
ok('a job\'s log is read by its LAYOUT-RESULT line', run('check', lg).status === 0);
// (tiers on #499: --init takes in a run with no baseline or over another matrix or renderer, not new keys over the same)
ok('update --init refuses new keys over the same matrix and renderer', run('update', '--init', r2).status === 1 && !('clipped e' in JSON.parse(fs.readFileSync(B, 'utf8')).runs.en.rows));
ok('update --rules takes them in (the checks changed)', run('update', '--rules', r2).status === 0 && 'clipped e' in JSON.parse(fs.readFileSync(B, 'utf8')).runs.en.rows);
ok('update --init takes in a run over another renderer', run('update', '--init', res('en', ['overlap a × b', 'clipped f'], { renderer: 'lavapipe 2' })).status === 0 && JSON.parse(fs.readFileSync(B, 'utf8')).runs.en.renderer === 'lavapipe 2');
const r4 = res('ru', ['overlap a × b']);
ok('another run is its own row of the baseline', run('check', r4).status === 1);
ok('update --init writes a new run beside the others', run('update', '--init', r4).status === 0 && Object.keys(JSON.parse(fs.readFileSync(B, 'utf8')).runs).join() === 'en,ru');
fs.rmSync(dir, { recursive: true, force: true });
console.log(`t_layout_ratchet: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
