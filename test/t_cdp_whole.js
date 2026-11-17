// The CDP daemon's files the runner waits for appear whole (#1692). ci/browser.js polls for test/cdp_kit's READY, N.out and
// FATAL and reads each as soon as it exists; written in place, a poll between the file's creation and its data read it empty
// or part written ("the result is not JSON: Unexpected end of JSON input").
//   (a) cdpd.js writes those three through writeWhole (a file beside it, renamed into place), and no other way;
//   (b) a writer process puts ROUNDS results of PAYLOAD_MB MB, one at a time, while this process polls for each as the runner
//       does (exists, then read and parse, then remove it for the next): with fs.writeFileSync in place (the control) some
//       reads are empty or part written; with cdpd.js's own writeWhole none is.
// Run: node test/t_cdp_whole.js
const fs = require('fs'), path = require('path'), os = require('os'), { spawn } = require('child_process');
const ROUNDS = 200, PAYLOAD_MB = 2, ROUND_MS = 5000;
let pass = 0, fail = 0;
const ok = (name, cond, got) => { if (cond) pass++; else { fail++; console.log('FAIL', name, got === undefined ? '' : JSON.stringify(got)); } };
const src = fs.readFileSync(path.join(__dirname, 'cdp_kit', 'cdpd.js'), 'utf8');
// (a) the daemon's writes
const whole = /const writeWhole = \(f, data\) => \{[^\n]*\};/.exec(src);
ok('cdpd.js defines writeWhole', !!whole);
for (const name of ["'READY'", "f.replace('.js', '.out')", "'FATAL'"]) ok(`cdpd.js writes ${name} through writeWhole`, src.includes(`writeWhole(path.join(Q, ${name})`));
ok('cdpd.js writes nothing else into the queue in place', !/fs\.writeFileSync\(path\.join\((Q|DIR, 'q')/.test(src));
// (b) the race, with a writer in a process of its own: write: 'plain' or 'whole'
function race(write) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdpwhole-')), out = path.join(dir, '1.out');
  const body = JSON.stringify({ pass: true, info: { pad: 'x'.repeat(PAYLOAD_MB * 1024 * 1024) } });
  const writer = `const fs = require('fs'); ${whole ? whole[0] : 'const writeWhole = null;'}
const put = ${write === 'whole' ? 'writeWhole' : 'fs.writeFileSync'};
const out = ${JSON.stringify(out)}, body = fs.readFileSync(${JSON.stringify(path.join(dir, 'body'))}, 'utf8');
for (let i = 0; i < ${ROUNDS}; i++) {
  const t0 = Date.now();
  while (fs.existsSync(out)) if (Date.now() - t0 > ${ROUND_MS}) process.exit(2);
  put(out, body);
}`;
  fs.writeFileSync(path.join(dir, 'body'), body);
  const child = spawn(process.execPath, ['-e', writer], { stdio: 'ignore' });
  let reads = 0, broken = 0;
  return new Promise((resolve) => {
    const tick = () => {
      // (as ci/browser.js's waitFor: the file exists, so it is read and parsed at once)
      for (let k = 0; k < 2000; k++) {
        if (!fs.existsSync(out)) continue;
        let text = '';
        try { text = fs.readFileSync(out, 'utf8'); } catch (e) { continue; }
        reads++;
        try { JSON.parse(text); } catch (e) { broken++; }
        try { fs.rmSync(out); } catch (e) { /* the writer's rename may land after the read */ }
      }
      if (child.exitCode != null || child.signalCode != null) { fs.rmSync(dir, { recursive: true, force: true }); resolve({ reads, broken, exit: child.exitCode }); } else setImmediate(tick);
    };
    tick();
  });
}
(async () => {
  const plain = await race('plain'), w = await race('whole');
  console.log('in place:', JSON.stringify(plain), ' whole:', JSON.stringify(w));
  ok('the control: written in place, some reads are empty or part written', plain.broken > 0, plain);
  ok(`written whole, every read parses (${ROUNDS} rounds, the writer done)`, w.exit === 0 && w.reads >= ROUNDS && w.broken === 0, w);
  console.log(`t_cdp_whole: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
