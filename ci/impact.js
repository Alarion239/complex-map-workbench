'use strict';
// Which jobs of the Gate a change can affect (ci/README.md, CI tiers). From the files changed since the reference
// (the plan job's: a pull request's base, the previous main) it picks the tier and the jobs:
//   T0       always: the plan and the unit tests (lint runs in its own workflow)
//   T1 UI    the browser shards of the areas the change touches, and the smoke shard
//   T2 core  the renderer or the maths: GLSL (the pages whose inputs changed), quality (Linux only), the perf suite's
//            checks, the core browser shards and the smoke shard
//   T3       everything: a push to main, the nightly run, a run by hand, the label full-gate, or a path this file
//            does not know (fail safe)
// The same build: when the change touches the app (src/, build.py, tools/src_parts.py) and the reference's dist/ files are byte for byte
// the same as this checkout's (a comment, a move, a refactor), the rows of those paths select nothing.
//   node ci/impact.js [--base REF | --ref SHA] [--head REF] [--files a,b,...] [--full REASON] [--no-build]
//                     [--print | --json | --github | --run]
// --base: diff from the merge base with REF (default origin/main; what a pull request would show); --ref: from SHA
// itself (the plan job: its checkout is the merge with the base). --files: these paths instead of a diff (a
// hypothetical change; no same-build check). --print: what would run; --json: the plan as JSON; --github: the plan
// job's outputs ($GITHUB_OUTPUT) and its summary; --run: the unit tests and the selected browser shards here (set
// CMW_ANGLE and CMW_CHROME_ARGS as the browser jobs do: ci/README.md, Locally).
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { ROOT, PY, run, summary } = require('./lib');
const { SHARDS, suitesOf } = require('./browser_shards');
const { EXCLUDED } = require('./browser_suites');
const GLSL = require('./glsl');

// the browser shards of each area (ids of ci/browser_shards.js)
const AREAS = {
  phone: ['tour-phone', 'tour-audit-phone', 'phone-swap-1', 'phone-swap-2', 'phone-swap-3', 'ux165-2', 'i18n-phone'],
  tour: ['tour', 'tour-phone', 'tour-audit-phone', 'tour-audit-desktop'],
  export: ['export-1', 'export-2', 'export-3', 'images'],
  sound: ['sound'],
  deform: ['deform', 'images', 'phone-swap-1'],
  constructions: ['perp', 'constructions', 'ux165-1'],
  i18n: ['i18n', 'i18n-desktop', 'i18n-phone'],
  views: ['views', 'formulas'],
  desktop: ['views', 'formulas', 'ux165-1', 'ux165-2', 'tour-audit-desktop', 'i18n-desktop'],
  core: ['images', 'exact', 'deform', 'formulas'],
};

// What a path selects. The first row whose pattern matches wins (* is any name, ** any path, {a,b} either); a path no
// row matches is T3. Effects: full (T3), areas (their browser shards), core (T2: quality, perf and the core shards),
// glsl/quality/perf (that job; glsl: 'all' for every page, otherwise the pages whose inputs the path is),
// suite (the shards of test/<suite>_cmd.js), uses (a test helper: whatever uses it), hooks (the test hooks: the shards
// of the suites that call a hook the diff changes; T3 when the diff's hooks cannot be named, no suite calls them, or a
// hook is called outside the browser suites and unit tests), harness (the smoke shard proves the runner), t0 (the unit tests cover it). Every GLSL page whose inputs (ci/glsl.js) include the path runs as well.
const full = (why) => ({ full: true, why });
const ui = (...areas) => ({ areas });
const T0 = { t0: true };
const HARNESS = { harness: true };
const MAP = [
  // the app
  // the app (src/app/: app.js in parts, joined in name order by build.py; a part not listed here is T3)
  ['src/{app,gl}/wrap.js', full('the closure around the parts')],
  ['src/app/01-core.js', full('the app\'s state and its core, under every area')],
  // ([#385] the start-up file in parts along its seams, joined in name order as before, byte for byte the same build)
  ['src/app/18-params.js', full('the shared numbers and links, under every area')],
  ['src/app/19-constructions.js', { core: true, areas: ['constructions'] }],                // the constructions' model and adapter
  ['src/app/19-phone.js', ui('phone')],                                                     // the phone layout's adapter (#385)
  ['src/app/19-shell.js', ui('desktop', 'phone')],                                         // the header, its menus, the panels and drawers (#385)
  ['src/app/20-init.js', full('the app\'s start-up')],                                     // (its area wiring is in the areas' parts: #385)
  ['src/app/21-test-hooks.js', { hooks: true }],                                           // window.__cmw*: what calls them
  ['src/app/22-start.js', full('the app\'s start')],
  ['src/app/{02-gpu-regions,03-exact-images,07-preimages-integrals}.js', { core: true }],   // regions, exact images, preimages
  ['src/app/04-labels-zeros-poles.js', ui('views', 'constructions')],                     // labels, zeros and poles
  ['src/app/05-panes-rulers.js', ui('views', 'desktop', 'phone')],                         // view fitting, panes, rulers
  ['src/app/06-deformation.js', ui('deform')],                                             // the deformation
  ['src/app/08-thumbnails-render.js', { core: true, areas: ['views'] }],                   // thumbnails, the render loop
  ['src/app/09-pane-titles.js', ui('desktop', 'phone')],                                   // pane titles, option strips
  ['src/app/10-tools-menus.js', ui('constructions', 'desktop', 'phone')],                  // the tools and menus
  ['src/app/11-pipeline.js', ui('views', 'desktop', 'phone')],                             // the function chain's cards
  ['src/app/12-command-palette.js', ui('desktop', 'i18n')],                                // the command palette
  ['src/app/13-export-captions.js', ui('export', 'i18n')],                                 // guarantees, export, captions
  ['src/app/14-interaction.js', ui('constructions', 'desktop', 'phone')],                  // pointer and keys
  ['src/app/15-examples-guide.js', ui('desktop', 'phone', 'tour')],                        // examples, the guide
  ['src/app/16-sound.js', ui('sound')],
  ['src/app/17-tour.js', ui('tour')],
  // the WebGL renderer (src/gl/: gl.js in parts): T2, and the views shards where it draws the 3D scenes
  ['src/gl/{01-state-glsl-2d,02-glsl-inverse,04-programs-resources,05-frames-2d-draws,07-inverse-api}.js', { core: true }],
  ['src/gl/{03-glsl-3d,06-draws-3d}.js', { core: true, areas: ['views'] }],                // the Landscape, the sphere
  ['src/view.js', full('the planes\' view transform, under every area')],
  ['build.py', full('the build itself')],
  ['tools/src_parts.py', full('how build.py joins the split files')],
  ['tools/bundle.mjs', full('the bundle of the app\'s modules (esbuild)')],
  ['vendor/**', full('the vendored typesetter and faces, in every page')],
  ['tools/vendor.py', T0],                                                     // writes vendor/ (by hand); t_vendor checks it
  ['src/phone.*', ui('phone')],                                               // the phone layout, its script and CSS
  ['src/tour.js', ui('tour')],                                                // the guided tour
  ['src/figure.js', ui('export')],                                            // exported figures, and the images shard
  ['src/cyr.js', ui('export', 'i18n')],                                       // Cyrillic outlines in exported figures
  ['src/{sound,seasong}.js', ui('sound')],                                    // the sound, the sea song
  ['src/{construct,constr}.js', ui('constructions')],                         // perp, constructions, the ux165 rail
  ['src/i18n*.js', ui('i18n')],                                               // the languages and their tables
  ['src/{inspector,planemenu,params}.js', ui('views')],                       // views and formulas
  ['src/commands.js', ui('desktop', 'i18n')],                                 // the command palette (desktop: formulas too)
  ['src/soundhooks.js', ui('sound')],                                         // the sound hooks: the cues, listening, loops
  ['src/export.js', ui('export', 'i18n')],                                    // export, captions and the figure's renderer
  ['src/morphpaths.js', ui('deform')],                                        // the deformation's paths
  ['src/integrals.js', { core: true, areas: ['desktop'] }],                   // the integrals (from part 07; the palette's ∫ too)
  ['src/examples.js', ui('desktop', 'phone', 'tour')],                        // the examples and the guide (from part 15)
  ['src/page.html', ui('desktop', 'phone')],                                  // the page's markup: both layouts
  ['src/desk.css', ui('desktop', 'phone')],                                   // the desktop styles, and the Inspector's in the phone's sheet (#385)
  // the maths and the renderer: T2, and the shards that draw or compute exactly
  ['src/{cx,parse,funcs,homrange,inverse,recognize,calc,region,curves,sphere,glsl,palette}.js', { core: true }],
  // the generators of the tables in src/ and their inputs
  ['tools/{it_table,ru_extra}.json', ui('i18n')],
  ['tools/make_{ru,it}_table.py', ui('i18n')],
  ['tools/{cyr_template.js,make_cyr_module.py}', ui('export', 'i18n')],
  ['tools/melodies/**', ui('sound')],
  ['tools/join_src.js', T0],
  ['tools/arb_{reference.py,compare.js}', T0],                                // the Arb oracle (notes/arb/): dev-only                                                  // joins the parts for tsc only (lint)
  ['notes/i18n/**', ui('i18n')],                                              // the i18n design, read by the i18n tests
  // the docs (a README beside the tests or the CI scripts too)
  ['**/*.md', T0],
  // the tests
  ['test/t_*.js', T0],
  ['test/*_cmd.js', { suite: true }],
  ['test/regress/test_compare.py', T0],
  ['test/regress/perf/cdp.js', { glsl: 'all', quality: true, perf: true }],   // the Chrome driver of the paired gates
  ['test/regress/quality/**', { quality: true }],
  ['test/regress/compare_quality.py', { quality: true }],
  ['test/regress/{perf/**,compare_perf.py}', { perf: true }],
  ['test/regress/compare.py', { quality: true, perf: true }],
  ['test/cdp_kit/**', HARNESS],                                               // the daemon every browser suite runs in
  ['test/**', { uses: true }],                                                // a helper or fixture: what uses it
  // CI itself
  ['ci/impact.js', HARNESS],                                                  // (test/t_impact.js covers it)
  ['ci/reference.js', { glsl: 'all', quality: true, perf: true }],            // the paired gates' reference build
  ['ci/quality.js', { quality: true }],
  ['ci/perf_shard{,s}.js', { perf: true }],
  ['ci/**', HARNESS],                                                         // (ci/glsl.js: an input of every page)
  ['.github/**', HARNESS],
  // the development tools and the docs
  ['{package.json,package-lock.json,eslint.config.js,tsconfig.json,ruff.toml,.gitignore}', T0],
  ['types/**', T0],
  ['plan/**', T0],
  ['notes/**', T0],
];

function globRe(g) {
  let s = '', depth = 0;
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (g.startsWith('**/', i)) { s += '(?:.*/)?'; i += 2; } else if (g.startsWith('**', i)) { s += '.*'; i++; } else if (c === '*') s += '[^/]*';
    else if (c === '{') { s += '(?:'; depth++; } else if (c === '}') { s += ')'; depth--; } else if (c === ',' && depth) s += '|';
    else s += c.replace(/[.+?^$()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${s}$`);
}
const ROWS = MAP.map(([glob, effect]) => ({ glob, re: globRe(glob), effect }));
const rowOf = (f) => ROWS.find((r) => r.re.test(f)) || null;

// the GLSL jobs of the Gate (each platform's shader compiler; ci/README.md, GLSL tiers). Windows renders in software
// (Direct3D 11 compiles every program on the CPU), so a pull request runs its core tier there (test/glsl_tiers.js), the
// glsl page in quarters; the whole set, every chain (glsl in eighths, adv in two jobs), runs on a push to main, the
// nightly run, a run by hand and the label glsl-deep. macOS has a virtual GPU (minutes a page) and few machines: its
// pages run whole, every chain, always
const MAC_JOBS = ['glsl', 'adv', 'inverse'].map((page) => ({ os: 'macos-latest', page, part: '1/1', tier: 'all' }));
const GLSL_JOBS = [
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({ os: 'windows-latest', page: 'glsl', part: `${i}/8`, tier: 'all' })),
  { os: 'windows-latest', page: 'adv', part: '1/1', sections: 'direct,keys,compile', tier: 'all' },
  { os: 'windows-latest', page: 'adv', part: '1/1', sections: 'main', tier: 'all' },
  { os: 'windows-latest', page: 'inverse', part: '1/1', tier: 'all' },
  ...MAC_JOBS,
];
const GLSL_CORE_JOBS = [
  ...[1, 2, 3, 4].map((i) => ({ os: 'windows-latest', page: 'glsl', part: `${i}/4`, tier: 'core' })),
  { os: 'windows-latest', page: 'adv', part: '1/1', tier: 'core' },
  { os: 'windows-latest', page: 'inverse', part: '1/1', tier: 'core' },
  ...MAC_JOBS,
];
const QUALITY_OS = ['ubuntu-latest', 'windows-latest', 'macos-latest'];
// (the build's inputs: what the same-build check covers)
const isApp = (f) => f.startsWith('src/') || f === 'build.py' || f === 'tools/src_parts.py' || f === 'tools/bundle.mjs';
const fileOf = (e) => e.split('#')[0];

function testFiles() { return fs.readdirSync(path.join(ROOT, 'test')).filter((f) => /\.js$/.test(f)); }
// the browser shards that run test/<file> (its runs may be in several; one listed nowhere runs in the catch-all)
function shardsOfSuite(file) {
  return SHARDS.filter((s) => { try { return suitesOf(s.id).some((e) => fileOf(e) === file); } catch (e) { return false; } }).map((s) => s.id);
}
// the GLSL pages whose inputs include f (test/fixtures: the directory)
function glslPagesOf(f) {
  return GLSL.PAGES.filter((p) => GLSL.inputsOf(p).some((i) => i === f || f.startsWith(i + '/'))).map((p) => p.id);
}

// [#385] the files that name window.__cmw<name> (a whole word): the browser suites (test/*_cmd.js) and unit tests are
// fine; anything else that calls a hook (the app itself, the quality and perf runners, ci/, the cdp kit) is outside
function hookCallers(names) {
  const re = new RegExp(`\\b(?:${names.map((n) => n.replace(/[$]/g, '\\$&')).join('|')})\\b`);
  const suites = [], outside = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) { if (!/^(node_modules|dist|\.ci|\.git|fixtures)$/.test(e.name)) walk(rel); continue; }
      if (!/\.(js|mjs|py|html)$/.test(e.name) || rel === 'src/app/21-test-hooks.js') continue;
      if (!re.test(fs.readFileSync(path.join(ROOT, rel), 'utf8'))) continue;
      if (/^test\/[^/]+_cmd\.js$/.test(rel)) { if (!EXCLUDED[e.name]) suites.push(e.name); } else if (!/^test\/t_[^/]+\.js$/.test(rel)) outside.push(rel);
    }
  };
  for (const d of ['src', 'test', 'ci', 'tools']) walk(d);
  return { suites, outside };
}
// [#385] the hooks a diff of src/app/21-test-hooks.js changes: each changed line (old and new) belongs to the hook
// defined at or above it (a line "  window.__cmw<name> =" starts one, the comments before it belong to it); null when a
// changed line is above every hook or in a statement that is not one (a helper between hooks)
function hooksOfDiff(from, head, f) {
  let diff;
  try { diff = git('diff', '-U0', '--no-renames', from, head, '--', f); } catch (e) { return null; }
  const text = (rev) => { try { return git('show', `${rev}:${f}`).split('\n'); } catch (e) { return []; } };
  const lines = { old: text(from), new: text(head) };
  // (the hook of line n, 1-based: the next definition at or after the comment block n is in, else the one above it)
  const hookAt = (L, n) => {
    const def = (i) => { const m = /^ {2}(?:\/\*\* @type \{any\} \*\/ \(window\)|window)\.(__cmw\w+)\s*=/.exec(L[i] || ''); return m ? m[1] : null; };
    let i = n - 1;
    if (/^\s*\/\//.test(L[i] || '')) { for (let j = i; j < L.length; j++) { const d = def(j); if (d) return d; if (!/^\s*\/\//.test(L[j] || '')) break; } }
    // (a top-level line that is not a hook, a comment or a closing bracket, e.g. a helper between hooks: not known)
    for (; i >= 0; i--) { const d = def(i); if (d) return d; if (/^ {2}[^ /})\]]/.test(L[i] || '')) return null; }
    return null;
  };
  const names = new Set();
  for (const h of diff.split('\n').filter((l) => l.startsWith('@@'))) {
    const m = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(h);
    if (!m) return null;
    for (const [side, start, count] of [['old', +m[1], m[2] == null ? 1 : +m[2]], ['new', +m[3], m[4] == null ? 1 : +m[4]]]) {
      for (let n = start; n < start + count; n++) { const k = hookAt(lines[side], n); if (!k) return null; names.add(k); }
    }
  }
  return [...names];
}

// files: the changed paths; opts: { full: reason, glslDeep: reason (every GLSL chain on Windows too), sameBuild: true |
// false | null (not checked), hooksOf: (path) -> the test hooks its diff changes, or null (the CLI's, from the diff) }
// -> the plan
function select(files, opts = {}) {
  const reasons = [];   // { path, rule, effect: text }
  const browser = new Set(), glsl = new Set();
  let core = false, quality = false, perf = false, unknown = false, wantSmoke = false;
  // a paired job chosen by a path outside the app (its runner, its scenes) runs even when the app is the same as the
  // reference's (--force: an A/A run), or it would only report "nothing to compare" and never run the change
  let forceQuality = false, forcePerf = false;
  const fullWhy = [];
  if (opts.full) fullWhy.push(opts.full);
  const say = (p, rule, effect) => reasons.push({ path: p, rule, effect });
  for (const f of files) {
    const row = rowOf(f);
    if (isApp(f) && opts.sameBuild === true) { say(f, row ? row.glob : '(none)', 'nothing: the build is the same as the reference\'s'); continue; }
    for (const id of glslPagesOf(f)) glsl.add(id);
    if (!row) { unknown = true; fullWhy.push(`${f}: no row in ci/impact.js`); say(f, '(none)', 'T3: a path ci/impact.js does not know'); continue; }
    const e = row.effect;
    if (e.full) { fullWhy.push(`${f}: ${e.why}`); say(f, row.glob, `T3: ${e.why}`); continue; }
    const got = [];
    if (e.t0) got.push('the unit tests');
    if (e.areas) { for (const a of e.areas) for (const id of AREAS[a]) browser.add(id); got.push(`${e.areas.join(', ')} shards`); wantSmoke = true; }
    if (e.core) { core = quality = perf = true; for (const id of AREAS.core) browser.add(id); wantSmoke = true; got.push('T2: quality, perf, the core shards'); }
    if (e.glsl === 'all') { for (const p of GLSL.PAGES) glsl.add(p.id); got.push('every GLSL page'); }
    if (e.quality && !e.core) { quality = true; forceQuality = forceQuality || !isApp(f); got.push(isApp(f) ? 'quality' : 'quality (A/A when the app is unchanged)'); }
    if (e.perf && !e.core) { perf = true; forcePerf = forcePerf || !isApp(f); got.push(isApp(f) ? 'perf' : 'perf (A/A when the app is unchanged)'); }
    if (e.harness) { wantSmoke = true; got.push('the smoke shard'); }
    if (e.suite) {
      const base = path.basename(f);
      if (EXCLUDED[base]) got.push(`nothing here (${base} does not run in the browser jobs)`);
      else { const ids = shardsOfSuite(base); for (const id of ids) browser.add(id); wantSmoke = true; got.push(`its shards: ${ids.join(', ') || 'none'}`); }
    }
    if (e.uses) {
      // a test helper or fixture: the suites and unit tests whose source names it (or the GLSL pages built from it)
      const base = path.basename(f), dir = path.join(ROOT, 'test');
      const users = testFiles().filter((t) => t !== base && /^(t_.*|.*_cmd)\.js$/.test(t) && fs.readFileSync(path.join(dir, t), 'utf8').includes(base));
      const suites = users.filter((t) => /_cmd\.js$/.test(t) && !EXCLUDED[t]);
      for (const t of suites) for (const id of shardsOfSuite(t)) browser.add(id);
      if (suites.length) wantSmoke = true;
      if (!users.length && !glslPagesOf(f).length) { unknown = true; fullWhy.push(`${f}: no test names it`); say(f, row.glob, 'T3: a test file no suite or unit test names'); continue; }
      got.push(`what uses it: ${users.join(', ') || 'GLSL'}`);
    }
    if (e.hooks) {
      // ([#385] a test hook acts only when something calls it: the suites that name a changed hook)
      const names = opts.hooksOf ? opts.hooksOf(f) : null;
      const calls = names && names.length ? hookCallers(names) : null;
      // (fail safe: a changed hook no browser suite calls is not "nothing to run" but T3, as a hunk the map cannot place)
      if (!calls || calls.outside.length || !calls.suites.length) {
        const why = !names ? 'its changed hooks are not known (no diff, or a line outside every hook)' : !names.length ? 'no hook in its diff' : calls.outside.length ? `a hook called outside the browser suites (${calls.outside.join(', ')})` : `no browser suite calls ${names.join(', ')}`;
        fullWhy.push(`${f}: ${why}`); say(f, row.glob, `T3: ${why}`); continue;
      }
      for (const t of calls.suites) for (const id of shardsOfSuite(t)) browser.add(id);
      wantSmoke = true;
      got.push(`the suites that call ${names.join(', ')}: ${calls.suites.join(', ') || 'none'}`);
    }
    const pages = glslPagesOf(f);
    if (pages.length && e.glsl !== 'all') got.push(`GLSL ${pages.join(', ')}`);
    say(f, row.glob, got.join('; ') || 'the unit tests');
  }
  const isFull = fullWhy.length > 0;
  const allShards = SHARDS.filter((s) => suitesOf(s.id).length).map((s) => s.id);
  if (isFull) { allShards.forEach((id) => browser.add(id)); GLSL.PAGES.forEach((p) => glsl.add(p.id)); quality = perf = true; }
  if (wantSmoke) browser.add('smoke');
  const shards = allShards.filter((id) => browser.has(id));
  const glslJobs = (opts.glslDeep ? GLSL_JOBS : GLSL_CORE_JOBS).filter((j) => glsl.has(j.page));
  const tier = isFull ? 'T3' : core || quality || perf || glslJobs.length ? 'T2' : shards.length ? 'T1' : 'T0';
  const plan = {
    tier, full: isFull, why: fullWhy, unknown, sameBuild: opts.sameBuild ?? null, reasons, glslDeep: opts.glslDeep || null,
    browser: shards, glsl: glslJobs, quality: quality ? (isFull ? QUALITY_OS : ['ubuntu-latest']) : [], perf,
    forceQuality: quality && forceQuality, forcePerf: perf && forcePerf,
  };
  plan.skipped = [
    ...allShards.filter((id) => !browser.has(id)).map((id) => `browser ${id}`),
    ...GLSL.PAGES.filter((p) => !glsl.has(p.id)).map((p) => `GLSL ${p.id}`),
    ...QUALITY_OS.filter((o) => !plan.quality.includes(o)).map((o) => `quality on ${o}`),
    ...(perf ? [] : ['perf']),
  ];
  return plan;
}

const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();
function changedFiles(from, head) { return git('diff', '--name-only', '--no-renames', from, head).split('\n').filter(Boolean); }
// the app's dist files built at ref and in this checkout are byte for byte the same (the offline page too, #21)
function sameBuild(ref) {
  const { buildReference } = require('./reference');
  const R = buildReference(ref);
  if (run(PY, ['build.py']) !== 0) throw new Error('this checkout did not build');
  return ['complex-map-workbench.html', 'complex-map-workbench-offline.html', 'test.html'].every((f) => {
    const a = path.join(ROOT, 'dist', f), b = path.join(R.dist, f);
    return fs.existsSync(a) && fs.existsSync(b) && fs.readFileSync(a).equals(fs.readFileSync(b));
  });
}

function format(plan, md) {
  const L = [];
  const code = (s) => (md ? `\`${s}\`` : s);
  L.push(md ? `### Tier ${plan.tier}${plan.full ? ' (the whole gate)' : ''}` : `tier ${plan.tier}${plan.full ? ' (the whole gate)' : ''}`);
  if (plan.why.length) L.push(`${md ? '\n' : ''}why the whole gate: ${plan.why.join('; ')}`);
  L.push(plan.glslDeep ? `GLSL: every chain on Windows too (${plan.glslDeep})` : 'GLSL: the core tier on Windows, every chain on macOS');
  if (plan.sameBuild !== null) L.push(`the build ${plan.sameBuild ? 'is byte for byte the same as' : 'differs from'} the reference's`);
  if (md) L.push('', '| path | row of ci/impact.js | selects |', '|---|---|---|', ...plan.reasons.slice(0, 200).map((r) => `| \`${r.path}\` | \`${r.rule}\` | ${r.effect} |`));
  else for (const r of plan.reasons) L.push(`  ${r.path}  [${r.rule}]  -> ${r.effect}`);
  if (md && plan.reasons.length > 200) L.push(`| … | | ${plan.reasons.length - 200} more |`);
  L.push(md ? '' : '', md ? '**runs**' : 'runs:');
  const glslJobs = plan.glsl.map((j) => `${j.page} ${j.tier === 'core' ? 'core ' : ''}${j.part}${j.sections ? ` ${j.sections}` : ''} (${j.os.split('-')[0]})`);
  const runs = [
    ['unit tests', 'yes'],
    ['browser shards', plan.browser.length ? plan.browser.map(code).join(', ') : 'none'],
    ['GLSL', glslJobs.length ? glslJobs.join(', ') : 'none'],
    ['quality', plan.quality.length ? plan.quality.join(', ') + (plan.forceQuality ? ' (--force)' : '') : 'none'],
    ['perf', plan.perf ? `yes (Windows; skipped when the GPU machines gate speed)${plan.forcePerf ? ' (--force)' : ''}` : 'none'],
  ];
  if (md) L.push('', '| job | |', '|---|---|', ...runs.map(([k, v]) => `| ${k} | ${v} |`));
  else for (const [k, v] of runs) L.push(`  ${k}: ${v}`);
  if (plan.skipped.length) L.push('', `${md ? '**skipped**' : 'skipped'}: ${plan.skipped.join(', ')}`);
  return L.join('\n') + '\n';
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const opt = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
  if (opt('--same-build')) {
    try { process.exit(sameBuild(opt('--same-build')) ? 0 : 10); } catch (e) { console.error(e.message); process.exit(2); }
  }
  const head = opt('--head', 'HEAD');
  let files, from = null;
  if (opt('--files')) files = opt('--files').split(',').map((s) => s.trim()).filter(Boolean);
  else {
    from = opt('--ref') ? git('rev-parse', '--verify', `${opt('--ref')}^{commit}`) : git('merge-base', opt('--base', 'origin/main'), head);
    files = changedFiles(from, head);
  }
  let same = null;
  if (from && !argv.includes('--no-build') && !opt('--full') && files.some(isApp)) {
    // (in a child whose output goes to stderr, so that --json and --github print only the plan)
    const r = spawnSync(process.execPath, [__filename, '--same-build', from], { cwd: ROOT, stdio: ['ignore', 2, 2] });
    if (r.status === 0 || r.status === 10) same = r.status === 0;
    else { console.error('the same-build check failed: the build counts as changed'); same = false; }
  }
  const plan = select(files, { full: opt('--full'), glslDeep: opt('--glsl-deep'), sameBuild: same, hooksOf: from ? (f) => hooksOfDiff(from, head, f) : null });
  if (argv.includes('--json')) console.log(JSON.stringify(plan, null, 1));
  else if (argv.includes('--github')) {
    // (why: one line, for whoever reads the plan's outputs: the reason of the whole gate, or what each path selected)
    const why = plan.full ? plan.why.join('; ') : plan.reasons.map((r) => `${r.path}: ${r.effect}`).join('; ');
    const out = [`tier=${plan.tier}`, `why=${why.replace(/[\r\n]+/g, ' ').slice(0, 4000)}`, `browser=${JSON.stringify(plan.browser)}`, `glsl=${JSON.stringify(plan.glsl)}`, `quality=${JSON.stringify(plan.quality)}`, `perf=${plan.perf}`,
      `quality_force=${plan.forceQuality ? '--force' : ''}`, `perf_force=${plan.forcePerf ? '--force' : ''}`];
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, out.join('\n') + '\n');
    console.log(out.join('\n'));
    console.log(format(plan, false));
    summary(format(plan, true));
  } else console.log(format(plan, false));
  if (argv.includes('--run')) {
    const steps = [[process.execPath, ['ci/snapshots.js']], [process.execPath, ['ci/unit.js']]];
    if (plan.browser.length) steps.push([PY, ['build.py']], ...plan.browser.map((id) => [process.execPath, ['ci/browser.js', '--no-build', '--shard', id]]));
    let rc = 0;
    for (const [cmd, a] of steps) { console.log(`\n== ${path.basename(cmd)} ${a.join(' ')}`); if (run(cmd, a) !== 0) rc = 1; }
    if (plan.glsl.length || plan.quality.length || plan.perf) console.log('\n(GLSL, quality and perf run in CI only: ci/README.md, Locally, runs them by hand)');
    process.exit(rc);
  }
}
module.exports = { MAP, AREAS, GLSL_JOBS, GLSL_CORE_JOBS, select, rowOf, globRe, hookCallers, hooksOfDiff };
