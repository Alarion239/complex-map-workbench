// ci/lavapipe.sh, the browser jobs' Mesa step (gate.yml): mesa-vulkan-drivers from Ubuntu's mirrors with the image's
// own lists, or from the Actions cache of its files when the mirrors cannot be reached, with retries after refreshing
// the lists; the step fails with an annotation naming the cause when the package or lavapipe's ICD file is missing at
// the end. apt-get, apt-cache, dpkg, sudo, timeout and sleep are stubbed (bash on the PATH); the workflow's steps are
// read as text. Run: node test/t_lavapipe.js
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const Y = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'gate.yml'), 'utf8');
let pass = 0, fail = 0;
const ok = (name, cond, got) => { if (cond) pass++; else { fail++; console.log('FAIL ' + name + (got !== undefined ? ' ' + JSON.stringify(got) : '')); } };
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lavapipe-'));

// the stubs: their state (installed, the ICD file, the calls) in $STATE. DOWN: how many network calls of apt-get fail
// first (a refresh then warns and exits 0, as apt-get does; a download exits 100); BAD: the downloaded files do not
// install; NO_ICD: the package installs without its ICD file
const BIN = path.join(dir, 'bin');
fs.mkdirSync(BIN);
const stub = (name, body) => fs.writeFileSync(path.join(BIN, name), '#!/usr/bin/env bash\n' + body + '\n', { mode: 0o755 });
// (sudo runs the command as is; install drops its owner, which only root may set)
stub('sudo', 'if [ "$1" = install ]; then a=(); while [ $# -gt 0 ]; do if [ "$1" = -o ]; then shift 2; else a+=("$1"); shift; fi; done; set -- "${a[@]}"; fi; exec "$@"');
stub('sleep', 'echo "$1" >> "$STATE/sleeps"');
stub('timeout', 'while [ "$1" != apt-get ]; do shift; done; exec "$@"');
stub('apt-cache', 'printf "mesa-vulkan-drivers:\\n  Installed: (none)\\n  Candidate: %s\\n" "${CANDIDATE:-25.2.8-0ubuntu0.24.04.4}"');
stub('apt-get', [
  'arch=; for a in "$@"; do case $a in Dir::Cache::Archives=*) arch=${a#*=} ;; esac; done',
  'n=$(($(cat "$STATE/calls" 2>/dev/null || echo 0) + 1)); echo "$n" > "$STATE/calls"; echo "$*" >> "$STATE/args"',
  'case " $* " in',
  '  *" update "*) echo update >> "$STATE/log"; [ "$n" -le "${DOWN:-0}" ] && echo "W: Failed to fetch mirror+file:/etc/apt/apt-mirrors.txt/dists/noble/InRelease  Temporary failure resolving \'azure.archive.ubuntu.com\'"; exit 0 ;;',
  '  *" --download-only "*) echo download >> "$STATE/log"',
  '    if [ "$n" -le "${DOWN:-0}" ]; then echo "E: Failed to fetch https://security.ubuntu.com/ubuntu/pool/main/m/mesa/mesa-vulkan-drivers_25.2.8_amd64.deb  Temporary failure resolving \'azure.archive.ubuntu.com\'"; exit 100; fi',
  '    for f in mesa-vulkan-drivers_25.2.8_amd64.deb libllvm20_20.1.2_amd64.deb; do echo "${BAD:+bad}" > "$arch/$f"; done; exit 0 ;;',
  'esac; exit 2',
].join('\n'));
stub('dpkg', [
  'case $1 in',
  '  -s) [ -f "$STATE/installed" ] && echo "Status: install ok installed"; [ -f "$STATE/installed" ] ;;',
  '  -L) echo /usr/share/doc/mesa-vulkan-drivers; echo "$STATE/icd.d/lvp_icd.json" ;;',
  '  -i) shift; names=(); for f in "$@"; do names+=("${f##*/}"); done; echo "dpkg -i ${names[*]}" >> "$STATE/log"',
  '    for f in "$@"; do grep -q bad "$f" && { echo "dpkg-deb: error: \'$f\' is not a Debian format archive"; exit 1; }; done',
  '    touch "$STATE/installed"; [ -n "${NO_ICD:-}" ] || { mkdir -p "$STATE/icd.d"; touch "$STATE/icd.d/lvp_icd.json"; } ;;',
  '  *) exit 2 ;;',
  'esac',
].join('\n'));
stub('dpkg-query', 'echo 25.2.8-0ubuntu0.24.04.4');

// one run of the script in a fresh state: cached (file name -> content) in the cache folder, installed (with its ICD
// file) when the image has the package -> { status, stdout, out (GITHUB_OUTPUT), log (apt-get and dpkg calls), args
// (apt-get's), sleeps, debs (the cache folder's files after) }
let n = 0;
const run = (env = {}, { cached = {}, installed = false, args } = {}) => {
  const st = path.join(dir, 'state' + ++n), debs = path.join(st, 'debs'), out = path.join(st, 'out');
  fs.mkdirSync(debs, { recursive: true });
  for (const [f, body] of Object.entries(cached)) fs.writeFileSync(path.join(debs, f), body);
  if (installed) { fs.writeFileSync(path.join(st, 'installed'), ''); fs.mkdirSync(path.join(st, 'icd.d')); fs.writeFileSync(path.join(st, 'icd.d', 'lvp_icd.json'), ''); }
  fs.writeFileSync(out, '');
  const r = spawnSync('bash', [path.join(ROOT, 'ci', 'lavapipe.sh'), ...(args || [debs])], {
    cwd: ROOT, encoding: 'utf8',
    env: Object.assign({}, process.env, { PATH: BIN + path.delimiter + process.env.PATH, STATE: st, GITHUB_OUTPUT: out, CMW_LAVAPIPE_ARCHIVES: path.join(st, 'archives'), ImageOS: 'ubuntu24', ImageVersion: '20261101.360' }, env),
  });
  const read = (f) => (fs.existsSync(path.join(st, f)) ? fs.readFileSync(path.join(st, f), 'utf8').trim().split('\n').filter(Boolean) : []);
  return { status: r.status, stdout: r.stdout + r.stderr, out: fs.readFileSync(out, 'utf8').trim(), log: read('log'), args: read('args'), sleeps: read('sleeps').map(Number), debs: fs.readdirSync(debs).sort() };
};
const ERROR = '::error title=Mesa (lavapipe)::';
const FILES = ['libllvm20_20.1.2_amd64.deb', 'mesa-vulkan-drivers_25.2.8_amd64.deb'];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// the cache key
const key = run({}, { args: ['--key'] });
ok('--key: the image (ImageOS, ImageVersion) and the package\'s version in its lists', key.status === 0 && key.stdout.trim() === 'lavapipe-ubuntu24-20261101.360-25.2.8-0ubuntu0.24.04.4', key.stdout);
const odd = run({ CANDIDATE: '1:2,3' }, { args: ['--key'] });
ok('--key: no comma (a cache key may not hold one)', odd.stdout.trim() === 'lavapipe-ubuntu24-20261101.360-1_2_3', odd.stdout);

// the install
const image = run({}, { installed: true });
ok('the image has it: nothing downloaded, source=image', image.status === 0 && image.out === 'source=image' && !image.log.length, image);
const mirror = run();
ok('mirrors up: one download with the image\'s lists (no refresh, no wait), installed, source=mirror', mirror.status === 0 && mirror.out === 'source=mirror' && same(mirror.log, ['download', `dpkg -i ${FILES.join(' ')}`]) && !mirror.sleeps.length, mirror);
ok('mirrors up: the cache folder then holds exactly the downloaded files', same(mirror.debs, FILES), mirror.debs);
ok('each part\'s time goes to the log', /attempt 1: download from the mirrors: ok, \d+\.\d s/.test(mirror.stdout) && /install of the downloaded files: ok, \d+\.\d s/.test(mirror.stdout) && /Mesa step: \d+\.\d s/.test(mirror.stdout), mirror.stdout);
ok('the end names the version and the ICD file', /mesa-vulkan-drivers 25\.2\.8-0ubuntu0\.24\.04\.4 from the mirror; lavapipe's ICD: \S+lvp_icd\.json/.test(mirror.stdout), mirror.stdout);
const stale = run({}, { cached: { 'mesa-vulkan-drivers_25.2.7_amd64.deb': '' } });
ok('mirrors up: older cached files are replaced by the downloaded ones', stale.status === 0 && same(stale.debs, FILES), stale.debs);
const fromCache = run({ DOWN: '99' }, { cached: { 'mesa-vulkan-drivers_25.2.8_amd64.deb': '' } });
ok('mirrors down, cache restored: the cached files install at once (no refresh, no wait), source=cache', fromCache.status === 0 && fromCache.out === 'source=cache' && same(fromCache.log, ['download', 'dpkg -i mesa-vulkan-drivers_25.2.8_amd64.deb']) && !fromCache.sleeps.length, fromCache);
const down = run({ DOWN: '99' });
ok('mirrors down, no cache: 4 downloads, the lists refreshed before each retry, waits of 10, 20 and 40 s', down.status === 1 && same(down.log, ['download', 'update', 'download', 'update', 'download', 'update', 'download']) && same(down.sleeps, [10, 20, 40]), down);
ok('mirrors down, no cache: the step fails with the cause, not later with "no WebGL2"', down.out === 'source=' && down.stdout.includes(`${ERROR}mesa-vulkan-drivers is not installed: apt could not download it from Ubuntu's mirrors in 4 attempts (apt's errors above), and the Actions cache had no copy for this image (ubuntu24 20261101.360).`), down.stdout);
ok('apt does not retry by itself (the attempts do; its retries of a file the mirrors cannot serve flood the log)', down.args.length === 7 && down.args.every((a) => a.includes('-o Acquire::Retries=0')), down.args);
ok('mirrors down: apt\'s own error stays in the log', down.stdout.includes("Temporary failure resolving 'azure.archive.ubuntu.com'"), down.stdout);
const badCache = run({ DOWN: '99' }, { cached: { 'mesa-vulkan-drivers_25.2.8_amd64.deb': 'bad' } });
ok('mirrors down, cached files that do not install: retried, then the cause names both', badCache.status === 1 && badCache.log.filter((l) => l === 'download').length === 4 && badCache.stdout.includes("in 4 attempts (apt's errors above), and the cached files did not install"), badCache.stdout);
const back = run({ DOWN: '1' });
ok('mirrors back for the second attempt: installed after one wait and a refresh, source=mirror', back.status === 0 && back.out === 'source=mirror' && same(back.sleeps, [10]) && same(back.log.slice(0, 3), ['download', 'update', 'download']), back);
const badFiles = run({ BAD: '1' });
ok('downloaded files that do not install: no retry, the cause is dpkg', badFiles.status === 1 && badFiles.log.filter((l) => l === 'download').length === 1 && badFiles.stdout.includes(`${ERROR}mesa-vulkan-drivers is not installed: dpkg could not install the files downloaded from the mirrors`), badFiles.stdout);
const noIcd = run({ NO_ICD: '1' });
ok('installed without lavapipe\'s ICD file: the step fails and says so', noIcd.status === 1 && noIcd.stdout.includes(`${ERROR}mesa-vulkan-drivers is installed, but lavapipe's ICD file (`) && /lvp_icd\.json\) is missing\./.test(noIcd.stdout), noIcd.stdout);

// the browser job's steps (gate.yml)
const job = (/^ {2}browser:\n([\s\S]*?)(?=^ {2}[\w-]+:\n)/m.exec(Y) || [])[1] || '';
ok('the browser job runs on the Ubuntu 24.04 image', /^ {4}runs-on: ubuntu-24\.04$/m.test(job), (/runs-on: .*/.exec(job) || [])[0]);
const at = (re) => job.search(re);
const order = [/name: Mesa cache key\n\s+id: mesa-key\n\s+run: echo "key=\$\(ci\/lavapipe\.sh --key\)" >> "\$GITHUB_OUTPUT"/, /name: Mesa cache \(restore\)\n\s+id: mesa-cache\n\s+uses: actions\/cache\/restore@v4\n/, /name: Mesa's Vulkan drivers \(lavapipe\)\n\s+id: mesa\n\s+run: ci\/lavapipe\.sh "\$RUNNER_TEMP\/cmw-lavapipe-debs"/, /name: Mesa cache \(save\)\n\s+if: steps\.mesa\.outputs\.source == 'mirror' && steps\.mesa-cache\.outputs\.cache-hit != 'true'\n\s+uses: actions\/cache\/save@v4\n/, /run: node ci\/browser\.js/].map(at);
ok('the steps: key, restore, install, save (only after an install from the mirrors on a miss), then the suites', order.every((i, k) => i >= 0 && (k === 0 || i > order[k - 1])), order);
const blocks = job.split('- name: ').filter((b) => b.startsWith('Mesa cache ('));
ok('restore and save use the same folder and the key step\'s key (no other key restores)', blocks.length === 2 && blocks.every((b) => b.includes('path: ${{ runner.temp }}/cmw-lavapipe-debs') && b.includes('key: ${{ steps.mesa-key.outputs.key }}') && !b.includes('restore-keys')), blocks);

fs.rmSync(dir, { recursive: true, force: true });
console.log(`t_lavapipe: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
