// ci/lavapipe.sh, the browser jobs' Mesa step (gate.yml): mesa-vulkan-drivers from Ubuntu's mirrors with the image's
// own lists, from the Actions cache of its files, from the fallback mirror on another domain, or after retries with the
// lists refreshed, each apt call stopped at its time limit; the step fails with an annotation naming the cause when the
// package or lavapipe's ICD file is missing at the end. apt-get, apt-cache, dpkg, sudo, timeout and sleep are stubbed
// (bash on the PATH); the workflow's steps are read as text. Run: node test/t_lavapipe.js
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

// the stubs: their state (the package's status, the ICD file, the calls) in $STATE. NET: what each network call of
// apt-get gets, in order (NET_THEN for the calls after; up when unset): up, down (apt's error at once: a refresh warns
// and exits 0, as apt-get does; a download exits 100) or hang (no answer: apt-get stands for the timeout around it,
// which stops it with 124; with no timeout around it, 99). BAD: the downloaded files do not install; UNPACKED: dpkg -i
// unpacks the package and fails to configure it; NO_ICD: the package installs without its ICD file
const BIN = path.join(dir, 'bin');
fs.mkdirSync(BIN);
const stub = (name, body) => fs.writeFileSync(path.join(BIN, name), '#!/usr/bin/env bash\n' + body + '\n', { mode: 0o755 });
// (sudo runs the command as is; install drops its owner, which only root may set)
stub('sudo', 'if [ "$1" = install ]; then a=(); while [ $# -gt 0 ]; do if [ "$1" = -o ]; then shift 2; else a+=("$1"); shift; fi; done; set -- "${a[@]}"; fi; exec "$@"');
stub('sleep', 'echo "$1" >> "$STATE/sleeps"');
stub('timeout', 'limit=(); while [ "$1" != apt-get ]; do limit+=("$1"); shift; done; echo "${limit[*]}" >> "$STATE/limits"; LIMITED=1 exec "$@"');
stub('apt-cache', 'printf "mesa-vulkan-drivers:\\n  Installed: (none)\\n  Candidate: %s\\n" "${CANDIDATE:-25.2.8-0ubuntu0.24.04.4}"');
stub('apt-get', [
  'arch=; from=; for a in "$@"; do case $a in Dir::Cache::Archives=*) arch=${a#*=} ;; Dir::Etc::sourcelist=*) from="fallback " ;; esac; done',
  'n=$(($(cat "$STATE/calls" 2>/dev/null || echo 0) + 1)); echo "$n" > "$STATE/calls"; echo "$*" >> "$STATE/args"',
  'net=(${NET:-}); outcome=${net[n-1]:-${NET_THEN:-up}}',
  'case " $* " in',
  '  *" update "*) echo "${from}update" >> "$STATE/log" ;;',
  '  *" --download-only "*) echo "${from}download ${*: -1}" >> "$STATE/log" ;;',
  '  *) exit 2 ;;',
  'esac',
  'case $outcome in',
  '  hang) [ -n "${LIMITED:-}" ] && exit 124; echo "apt-get: no answer, and nothing stops it"; exit 99 ;;',
  '  down) case " $* " in',
  '    *" update "*) echo "W: Failed to fetch mirror+file:/etc/apt/apt-mirrors.txt/dists/noble/InRelease  Temporary failure resolving \'azure.archive.ubuntu.com\'"; exit 0 ;;',
  '    *) echo "E: Failed to fetch https://security.ubuntu.com/ubuntu/pool/main/m/mesa/mesa-vulkan-drivers_25.2.8_amd64.deb  Temporary failure resolving \'azure.archive.ubuntu.com\'"; exit 100 ;;',
  '  esac ;;',
  'esac',
  'case " $* " in *" --download-only "*) for f in mesa-vulkan-drivers_25.2.8_amd64.deb libllvm20_20.1.2_amd64.deb; do echo "${BAD:+bad}" > "$arch/$f"; done ;; esac',
].join('\n'));
stub('dpkg', [
  'case $1 in',
  '  --print-architecture) echo amd64 ;;',
  '  -s) [ -f "$STATE/status" ] || exit 1; echo "Status: install ok $(cat "$STATE/status")" ;;',
  '  -L) echo /usr/share/doc/mesa-vulkan-drivers; echo "$STATE/icd.d/lvp_icd.json" ;;',
  '  -i) shift; names=(); for f in "$@"; do names+=("${f##*/}"); done; echo "dpkg -i ${names[*]}" >> "$STATE/log"',
  '    for f in "$@"; do grep -q bad "$f" && { echo "dpkg-deb: error: \'$f\' is not a Debian format archive"; exit 1; }; done',
  '    [ -n "${NO_ICD:-}" ] || { mkdir -p "$STATE/icd.d"; touch "$STATE/icd.d/lvp_icd.json"; }',
  '    if [ -n "${UNPACKED:-}" ]; then echo unpacked > "$STATE/status"; echo "dpkg: error processing package mesa-vulkan-drivers (--install): dependency problems - leaving unconfigured"; exit 1; fi',
  '    echo installed > "$STATE/status" ;;',
  '  *) exit 2 ;;',
  'esac',
].join('\n'));
stub('dpkg-query', 'echo 25.2.8-0ubuntu0.24.04.4');

// one run of the script in a fresh state: cached (file name -> content) in the cache folder, installed (with its ICD
// file) when the image has the package -> { status, stdout, out (GITHUB_OUTPUT), log (apt-get and dpkg calls), args
// (apt-get's), limits (timeout's options, one line per apt-get call under it), sleeps, debs (the cache folder's files
// after), sources (the fallback mirror's sources file), fallback (its folder) }
let n = 0;
const run = (env = {}, { cached = {}, installed = false, args } = {}) => {
  const st = path.join(dir, 'state' + ++n), debs = path.join(st, 'debs'), out = path.join(st, 'out'), root = path.join(st, 'root');
  fs.mkdirSync(debs, { recursive: true });
  fs.mkdirSync(path.join(root, 'etc'), { recursive: true });
  fs.writeFileSync(path.join(root, 'etc', 'os-release'), 'NAME="Ubuntu"\nVERSION_ID="24.04"\nVERSION_CODENAME=noble\nUBUNTU_CODENAME=noble\n');
  for (const [f, body] of Object.entries(cached)) fs.writeFileSync(path.join(debs, f), body);
  if (installed) { fs.writeFileSync(path.join(st, 'status'), 'installed\n'); fs.mkdirSync(path.join(st, 'icd.d')); fs.writeFileSync(path.join(st, 'icd.d', 'lvp_icd.json'), ''); }
  fs.writeFileSync(out, '');
  const r = spawnSync('bash', [path.join(ROOT, 'ci', 'lavapipe.sh'), ...(args || [debs])], {
    cwd: ROOT, encoding: 'utf8',
    env: Object.assign({}, process.env, { PATH: BIN + path.delimiter + process.env.PATH, STATE: st, GITHUB_OUTPUT: out, CMW_LAVAPIPE_ROOT: root, ImageOS: 'ubuntu24', ImageVersion: '20261101.360' }, env),
  });
  const read = (f) => (fs.existsSync(path.join(st, f)) ? fs.readFileSync(path.join(st, f), 'utf8').trim().split('\n').filter(Boolean) : []);
  const fallback = path.join(root, 'var', 'lib', 'apt', 'cmw-lavapipe-fallback'), sources = path.join(fallback, 'fallback.sources');
  return {
    status: r.status, stdout: r.stdout + r.stderr, out: fs.readFileSync(out, 'utf8').trim(), log: read('log'), args: read('args'), limits: read('limits'),
    sleeps: read('sleeps').map(Number), debs: fs.readdirSync(debs).sort(), sources: fs.existsSync(sources) ? fs.readFileSync(sources, 'utf8') : '', fallback,
  };
};
const ERROR = '::error title=Mesa (lavapipe)::';
const FILES = ['libllvm20_20.1.2_amd64.deb', 'mesa-vulkan-drivers_25.2.8_amd64.deb'];
const INSTALL = `dpkg -i ${FILES.join(' ')}`;
const GET = 'download mesa-vulkan-drivers', PINNED = 'fallback download mesa-vulkan-drivers=25.2.8-0ubuntu0.24.04.4';
const MIRRORS = "Ubuntu's mirrors and mirrors.edge.kernel.org/ubuntu";
const NO_CACHE = ', and the Actions cache had no copy for this image (ubuntu24 20261101.360).';
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// the seconds a run can take at most: the time limit of each apt call it made, and its waits
const budget = (r) => r.limits.reduce((s, l) => s + Number(l.split(' ').pop()), 0) + r.sleeps.reduce((s, w) => s + w, 0);

// the cache key
const key = run({}, { args: ['--key'] });
ok('--key: the image (ImageOS, ImageVersion) and the package\'s version in its lists', key.status === 0 && key.stdout.trim() === 'lavapipe-ubuntu24-20261101.360-25.2.8-0ubuntu0.24.04.4', key.stdout);
const odd = run({ CANDIDATE: '1:2,3' }, { args: ['--key'] });
ok('--key: no comma (a cache key may not hold one)', odd.stdout.trim() === 'lavapipe-ubuntu24-20261101.360-1_2_3', odd.stdout);

// the install
const image = run({}, { installed: true });
ok('the image has it: nothing downloaded, source=image', image.status === 0 && image.out === 'source=image' && !image.log.length, image);
const mirror = run();
ok('mirrors up: one download with the image\'s lists (no refresh, no wait), installed, source=mirror', mirror.status === 0 && mirror.out === 'source=mirror' && same(mirror.log, [GET, INSTALL]) && !mirror.sleeps.length, mirror);
ok('mirrors up: the cache folder then holds exactly the downloaded files', same(mirror.debs, FILES), mirror.debs);
ok('each part\'s time goes to the log', /attempt 1: download of mesa-vulkan-drivers from Ubuntu's mirrors: ok, \d+\.\d s/.test(mirror.stdout) && /install of the downloaded files: ok, \d+\.\d s/.test(mirror.stdout) && /Mesa step: \d+\.\d s/.test(mirror.stdout), mirror.stdout);
ok('the end names the version, the source and the ICD file', /mesa-vulkan-drivers 25\.2\.8-0ubuntu0\.24\.04\.4 \(source: mirror\); lavapipe's ICD: \S+lvp_icd\.json/.test(mirror.stdout), mirror.stdout);
const stale = run({}, { cached: { 'mesa-vulkan-drivers_25.2.7_amd64.deb': '' } });
ok('mirrors up: older cached files are replaced by the downloaded ones', stale.status === 0 && same(stale.debs, FILES), stale.debs);
const fromCache = run({ NET: 'down' }, { cached: { 'mesa-vulkan-drivers_25.2.8_amd64.deb': '' } });
ok('mirrors down, cache restored: the cached files install at once (no fallback, no refresh, no wait), source=cache', fromCache.status === 0 && fromCache.out === 'source=cache' && same(fromCache.log, [GET, 'dpkg -i mesa-vulkan-drivers_25.2.8_amd64.deb']) && !fromCache.sleeps.length, fromCache);

// the fallback mirror
const outage = run({ NET: 'hang' });
ok('Ubuntu\'s mirrors hang, no cache: the fallback mirror\'s lists, then the image\'s version from it (no wait), installed, source=fallback', outage.status === 0 && outage.out === 'source=fallback' && same(outage.log, [GET, 'fallback update', PINNED, INSTALL]) && !outage.sleeps.length, outage);
ok('the fallback mirror: the cache folder then holds its files (the job saves them)', same(outage.debs, FILES), outage.debs);
ok('the fallback mirror\'s sources: Ubuntu\'s archive on kernel.org over HTTPS, the image\'s release and its updates and security pockets, main, checked against Ubuntu\'s archive keyring', same(outage.sources.trim().split('\n'), [
  'Types: deb', 'URIs: https://mirrors.edge.kernel.org/ubuntu', 'Suites: noble noble-updates noble-security', 'Components: main', 'Architectures: amd64', 'Targets: Packages', 'Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg',
]), outage.sources);
const fbArgs = outage.args.filter((a) => a.includes('Dir::Etc::sourcelist='));
const OWN = [`-o Dir::Etc::sourcelist=${outage.fallback}/fallback.sources`, '-o Dir::Etc::sourceparts=-', `-o Dir::State::Lists=${outage.fallback}/lists`, '-o Dir::Cache::pkgcache= ', '-o Dir::Cache::srcpkgcache= '];
ok('the fallback mirror\'s calls read its sources file and lists alone, and leave the runner\'s lists and package cache file', fbArgs.length === 2 && fbArgs.every((a) => OWN.every((o) => a.includes(o))) && outage.args.length === 3, outage.args);
ok('no call skips apt\'s signature check', fbArgs.length === 2 && outage.sources.includes('Signed-By: ') && ![...outage.args, outage.sources].some((a) => /trusted|insecure|unauthenticated|AllowDowngradeToInsecure/i.test(a)), outage.args);
const newer = run({ NET: 'hang', CANDIDATE: '25.2.9-0ubuntu0.24.04.1' });
ok('the fallback mirror gives the version the image\'s lists name (the one in the cache key), not its own newest', newer.log.includes('fallback download mesa-vulkan-drivers=25.2.9-0ubuntu0.24.04.1'), newer.log);

// the time limits
const hang = run({ NET_THEN: 'hang' });
ok('no mirror answers, no cache: no download after a refresh that got no answer; waits of 10 and 20 s', hang.status === 1 && same(hang.log, [GET, 'fallback update', 'update', 'update']) && same(hang.sleeps, [10, 20]), hang);
ok('no mirror answers: the cause names the time limits, and no apt errors', hang.out === 'source=' && hang.stdout.includes(`${ERROR}mesa-vulkan-drivers is not installed: no mirror answered in any of 4 attempts (${MIRRORS}): each apt call was stopped at its time limit, 15 s for a download and 25 s for a refresh of the lists${NO_CACHE}`) && !hang.stdout.includes("apt's errors"), hang.stdout);
ok('no mirror answers: the log says each call was stopped at its limit', (hang.stdout.match(/: no answer, stopped at its time limit \(exit 124\), \d+\.\d s/g) || []).length === 4, hang.stdout);
ok('no mirror answers: the step takes at most 2 minutes', hang.limits.length === 4 && budget(hang) <= 120, budget(hang));
const worst = run({ NET: 'hang up hang up hang up hang' });
ok('every refresh answers and every download hangs: all 4 downloads tried, at most 3 minutes', worst.status === 1 && worst.log.filter((l) => l.includes('download')).length === 4 && budget(worst) <= 180, { log: worst.log, budget: budget(worst) });
ok('every apt call runs under timeout -k 5: 15 s for a download, 25 s for a refresh', worst.args.length === 7 && worst.limits.length === worst.args.length && worst.args.every((a, i) => worst.limits[i] === (a.includes('--download-only') ? '-k 5 15' : '-k 5 25')), { args: worst.args, limits: worst.limits });
const mixed = run({ NET: 'hang down down', NET_THEN: 'hang' });
ok('some calls fail and some hang: the cause names both', mixed.status === 1 && mixed.stdout.includes(`not installed: apt could not download it in 4 attempts from ${MIRRORS} (apt's errors above; 3 of its calls got no answer within their time limit)${NO_CACHE}`), mixed.stdout);

// fast failures and retries
const down = run({ NET_THEN: 'down' });
ok('mirrors down, no cache: the fallback, then 2 downloads after a refresh, waits of 10 and 20 s', down.status === 1 && same(down.log, [GET, 'fallback update', PINNED, 'update', GET, 'update', GET]) && same(down.sleeps, [10, 20]), down);
ok('mirrors down, no cache: the step fails with the cause, not later with "no WebGL2"', down.out === 'source=' && down.stdout.includes(`${ERROR}mesa-vulkan-drivers is not installed: apt could not download it in 4 attempts from ${MIRRORS} (apt's errors above)${NO_CACHE}`), down.stdout);
ok('apt does not retry by itself (the attempts do; its retries of a file the mirrors cannot serve flood the log)', down.args.length === 7 && down.args.every((a) => a.includes('-o Acquire::Retries=0')), down.args);
ok('mirrors down: apt\'s own error stays in the log', down.stdout.includes("Temporary failure resolving 'azure.archive.ubuntu.com'"), down.stdout);
const badCache = run({ NET_THEN: 'down' }, { cached: { 'mesa-vulkan-drivers_25.2.8_amd64.deb': 'bad' } });
ok('mirrors down, cached files that do not install: the fallback and the retries, then the cause names both', badCache.status === 1 && badCache.log.filter((l) => l.includes('download')).length === 4 && badCache.stdout.includes(`in 4 attempts from ${MIRRORS} (apt's errors above), and the cached files did not install`), badCache.stdout);
const back = run({ NET: 'down down down' });
ok('Ubuntu\'s mirrors back after the fallback failed: installed after one wait and a refresh, source=mirror', back.status === 0 && back.out === 'source=mirror' && same(back.sleeps, [10]) && same(back.log, [GET, 'fallback update', PINNED, 'update', GET, INSTALL]), back);

// dpkg and the final check
const badFiles = run({ BAD: '1' });
ok('downloaded files that do not install: no retry, the cause is dpkg', badFiles.status === 1 && badFiles.log.filter((l) => l.includes('download')).length === 1 && badFiles.stdout.includes(`${ERROR}mesa-vulkan-drivers is not installed: dpkg could not install the files downloaded from Ubuntu's mirrors`), badFiles.stdout);
const unpacked = run({ UNPACKED: '1' });
ok('unpacked but not configured (dpkg -s: install ok unpacked): the step fails', unpacked.status === 1 && unpacked.stdout.includes(`${ERROR}mesa-vulkan-drivers is not installed: dpkg could not install`), unpacked.stdout);
const noIcd = run({ NO_ICD: '1' });
ok('installed without lavapipe\'s ICD file: the step fails and says so', noIcd.status === 1 && noIcd.stdout.includes(`${ERROR}mesa-vulkan-drivers is installed, but lavapipe's ICD file (`) && /lvp_icd\.json\) is missing\./.test(noIcd.stdout), noIcd.stdout);

// the browser job's steps (gate.yml)
const job = (/^ {2}browser:\n([\s\S]*?)(?=^ {2}[\w-]+:\n)/m.exec(Y) || [])[1] || '';
ok('the browser job runs on the Ubuntu 24.04 image', /^ {4}runs-on: ubuntu-24\.04$/m.test(job), (/runs-on: .*/.exec(job) || [])[0]);
const at = (re) => job.search(re);
const order = [/name: Mesa cache key\n\s+id: mesa-key\n\s+run: echo "key=\$\(ci\/lavapipe\.sh --key\)" >> "\$GITHUB_OUTPUT"/, /name: Mesa cache \(restore\)\n\s+id: mesa-cache\n\s+uses: actions\/cache\/restore@v4\n/, /name: Mesa's Vulkan drivers \(lavapipe\)\n\s+id: mesa\n\s+run: ci\/lavapipe\.sh "\$RUNNER_TEMP\/cmw-lavapipe-debs"/, /name: Mesa cache \(save\)\n\s+if: \(steps\.mesa\.outputs\.source == 'mirror' \|\| steps\.mesa\.outputs\.source == 'fallback'\) && steps\.mesa-cache\.outputs\.cache-hit != 'true'\n\s+uses: actions\/cache\/save@v4\n/, /run: node ci\/browser\.js/].map(at);
ok('the steps: key, restore, install, save (only after an install from a mirror, Ubuntu\'s or the fallback, on a miss), then the suites', order.every((i, k) => i >= 0 && (k === 0 || i > order[k - 1])), order);
const blocks = job.split('- name: ').filter((b) => b.startsWith('Mesa cache ('));
ok('restore and save use the same folder and the key step\'s key (no other key restores)', blocks.length === 2 && blocks.every((b) => b.includes('path: ${{ runner.temp }}/cmw-lavapipe-debs') && b.includes('key: ${{ steps.mesa-key.outputs.key }}') && !b.includes('restore-keys')), blocks);

fs.rmSync(dir, { recursive: true, force: true });
console.log(`t_lavapipe: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
