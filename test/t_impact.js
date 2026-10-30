// Unit checks of ci/impact.js, the tier and the jobs of the Gate a change can affect (ci/README.md, CI tiers): each
// tier, the same-build short-circuit, the label/event override, and the fallback for a path the map does not know.
//   node test/t_impact.js
const { select, rowOf, globRe, MAP, AREAS, GLSL_JOBS, GLSL_CORE_JOBS } = require('../ci/impact.js');
const { SHARDS, suitesOf } = require('../ci/browser_shards.js');
let n = 0, fails = 0;
const ok = (name, c, info) => { n++; if (!c) { fails++; console.log('FAIL', name, info === undefined ? '' : JSON.stringify(info)); } };
const ALL = SHARDS.filter((s) => suitesOf(s.id).length).map((s) => s.id);
const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
const nothing = (p) => !p.browser.length && !p.glsl.length && !p.quality.length && !p.perf;

// the globs
ok('glob: * stays in a directory', globRe('src/*.js').test('src/a.js') && !globRe('src/*.js').test('src/a/b.js'));
ok('glob: ** crosses directories', globRe('notes/**').test('notes/i18n/x/y.md') && globRe('**/*.md').test('README.md') && globRe('**/*.md').test('a/b/C.md'));
ok('glob: {a,b} and {,s}', globRe('src/{sound,seasong}.js').test('src/seasong.js') && globRe('ci/perf_shard{,s}.js').test('ci/perf_shards.js') && globRe('ci/perf_shard{,s}.js').test('ci/perf_shard.js') && !globRe('src/{sound,seasong}.js').test('src/soundx.js'));
ok('glob: a dot is a dot', !globRe('build.py').test('buildxpy'));
// every area names real shards, every row's effect is known
const ids = new Set(SHARDS.map((s) => s.id));
ok('every area names shards of ci/browser_shards.js', Object.values(AREAS).flat().every((id) => ids.has(id)), Object.values(AREAS).flat().filter((id) => !ids.has(id)));
ok('every GLSL job is a page of ci/glsl.js', GLSL_JOBS.concat(GLSL_CORE_JOBS).every((j) => ['glsl', 'adv', 'inverse'].includes(j.page)) && GLSL_JOBS.length === 14 && GLSL_CORE_JOBS.length === 9);
// (GLSL tiers: Windows runs the core tier unless --glsl-deep, macOS every chain always)
ok('the core jobs: Windows core (glsl in quarters, adv, inverse), macOS all', GLSL_CORE_JOBS.every((j) => j.tier === (j.os === 'macos-latest' ? 'all' : 'core')) && GLSL_CORE_JOBS.filter((j) => j.page === 'glsl' && j.os === 'windows-latest').map((j) => j.part).join() === '1/4,2/4,3/4,4/4');
ok('the deep jobs: every chain everywhere', GLSL_JOBS.every((j) => j.tier === 'all'));
ok('every row has an effect', MAP.every(([g, e]) => typeof g === 'string' && e && Object.keys(e).length));

// T0
for (const f of ['README.md', 'ROADMAP.md', 'plan/snapping-and-railing.md', 'notes/sound/x.md', 'test/t_parse.js', 'package.json', 'types/app.d.ts', 'test/regress/README.md']) {
  const p = select([f]);
  ok(`T0: ${f}`, p.tier === 'T0' && nothing(p), p);
}
ok('T0: a unit test helper used only by unit tests', select(['test/constr_core_tests.js']).tier === 'T0');
ok('T0: an excluded suite runs nowhere here', select(['test/inv_bench_cmd.js']).tier === 'T0');

// T1
const tour = select(['src/tour.js']);
ok('T1: src/tour.js -> the tour shards and smoke', tour.tier === 'T1' && same(tour.browser, [...AREAS.tour, 'smoke']) && !tour.glsl.length && !tour.quality.length && !tour.perf, tour);
const ph = select(['src/phone.css', 'src/phone.js']);
ok('T1: src/phone.* -> the phone shards', ph.tier === 'T1' && same(ph.browser, [...AREAS.phone, 'smoke']), ph.browser);
ok('T1: src/figure/ (figure.js in parts) -> export and images', same(select(['src/figure/03-views.js']).browser, [...AREAS.export, 'smoke']));
ok('T1: sound and the sea song', same(select(['src/sound.js', 'src/seasong.js']).browser, ['sound', 'smoke']));
ok('T1: constructions -> perp, constructions, ux165-1 (the rail)', same(select(['src/constr.js', 'src/construct.js']).browser, ['perp', 'constructions', 'ux165-1', 'smoke']));
for (const f of ['src/i18n.js', 'src/i18n_ru.js', 'tools/it_table.json', 'tools/ru_extra.json', 'notes/i18n/DESIGN.md']) ok(`T1: ${f} -> i18n`, same(select([f]).browser, [...AREAS.i18n, 'smoke']), select([f]).browser);
ok('T1: inspector, planemenu, params -> views and formulas', same(select(['src/inspector.js', 'src/planemenu.js', 'src/params.js']).browser, ['views', 'formulas', 'smoke']));
// ([#385] desk.css styles the Inspector, which the phone shows in its edit sheet, and has :root.ph rules of its own)
ok('T1: desk.css -> the desktop and the phone shards', same(select(['src/desk.css']).browser, [...new Set([...AREAS.desktop, ...AREAS.phone]), 'smoke']), select(['src/desk.css']).browser);
ok('T1: page.html -> desktop and phone', same(select(['src/page.html']).browser, [...new Set([...AREAS.desktop, ...AREAS.phone]), 'smoke']));
const suite = select(['test/tour_lit_cmd.js']);
ok('T1: a suite -> its shard', suite.tier === 'T1' && same(suite.browser, ['tour', 'smoke']), suite.browser);
ok('T1: a suite in runs -> every shard with one of its runs', same(select(['test/export_cmd.js']).browser, ['export-1', 'export-2', 'export-3', 'smoke']));
for (const f of ['ci/browser.js', '.github/workflows/gate.yml', 'test/cdp_kit/cdpd.js', 'ci/impact.js']) {
  const p = select([f]);
  ok(`T1: ${f} -> the smoke shard (the harness)`, p.tier === 'T1' && same(p.browser, ['smoke']), p);
}

// T2
const cx = select(['src/cx.js']);
ok('T2: src/cx.js -> GLSL (core on Windows), quality on Linux, perf, the core shards', cx.tier === 'T2' && cx.glsl.length === 9 && cx.glsl.some((j) => j.tier === 'core') && same(cx.quality, ['ubuntu-latest']) && cx.perf && same(cx.browser, [...AREAS.core, 'smoke']), cx);
const sph = select(['src/sphere.js']);
ok('T2: src/sphere.js is no GLSL page\'s input: no GLSL', sph.tier === 'T2' && !sph.glsl.length && sph.perf, sph.glsl);
const inv = select(['src/inverse.js']);
ok('T2: src/inverse.js -> only the inverse page\'s GLSL jobs', same(inv.glsl.map((j) => j.os + j.page), ['windows-latestinverse', 'macos-latestinverse']), inv.glsl);
ok('T2: a GLSL test file -> its page only, no browser shards', (() => { const p = select(['test/glsl_test_adv.js']); return p.tier === 'T2' && p.glsl.every((j) => j.page === 'adv') && p.glsl.length === 2 && !p.browser.length && !p.quality.length; })());
ok('--glsl-deep: every chain on Windows too (adv in its two jobs)', (() => { const p = select(['test/glsl_test_adv.js'], { glslDeep: 'the label glsl-deep' }); return p.glsl.length === 3 && p.glsl.every((j) => j.tier === 'all') && p.glslDeep; })());
ok('T2: ci/quality.js -> quality only', (() => { const p = select(['ci/quality.js']); return p.tier === 'T2' && same(p.quality, ['ubuntu-latest']) && !p.perf && !p.glsl.length; })());
ok('a paired job chosen by its runner is forced (A/A); one chosen by the app is not', (() => { const a = select(['test/regress/perf/run.js']), b = select(['ci/quality.js', 'README.md']), c = select(['src/cx.js']), d = select(['src/cx.js', 'test/regress/perf/scenes.js']); return a.forcePerf && !a.forceQuality && b.forceQuality && !b.forcePerf && !c.forcePerf && !c.forceQuality && d.forcePerf && !d.forceQuality; })());
ok('T2: ci/perf_shards.js -> perf only', (() => { const p = select(['ci/perf_shards.js']); return p.tier === 'T2' && p.perf && !p.quality.length; })());

// T3
for (const f of ['src/app/wrap.js', 'src/gl/wrap.js', 'src/app/01-core.js', 'build.py', 'tools/src_parts.py', 'tools/bundle.mjs']) {
  const p = select([f]);
  ok(`T3: ${f}`, p.tier === 'T3' && p.full && same(p.browser, ALL) && p.glsl.length === 9 && p.quality.length === 3 && p.perf, p.tier);
}
ok('T3 with --glsl-deep (a push to main, the nightly): every GLSL chain', select(['build.py'], { full: 'push', glslDeep: 'push' }).glsl.length === 14);
const unk = select(['LICENSE', 'README.md']);
ok('T3: a path no row knows (fail safe)', unk.tier === 'T3' && unk.unknown && same(unk.browser, ALL) && unk.quality.length === 3, unk.why);
ok('T3: a new src/ file no row knows', select(['src/new.js']).tier === 'T3' && select(['src/app/19-new-part.js']).tier === 'T3');
// the split files' parts (src/app/, src/gl/): every one has a row of its own
{
  const fs = require('fs'), path = require('path');
  const parts = ['app', 'gl'].flatMap((d) => { try { return fs.readdirSync(path.join(__dirname, '..', 'src', d)).map((f) => `src/${d}/${f}`); } catch (e) { return []; } });
  ok('every part of src/app/ and src/gl/ has a row', parts.length > 20 && parts.every((f) => rowOf(f) && !/\*\*/.test(rowOf(f).glob)), parts.filter((f) => !rowOf(f)));
  ok('a part: src/app/17-tour.js -> the tour shards', same(select(['src/app/17-tour.js']).browser, [...AREAS.tour, 'smoke']));
  ok('a part: src/app/16-sound.js -> sound', same(select(['src/app/16-sound.js']).browser, ['sound', 'smoke']));
  const g = select(['src/gl/02-glsl-inverse.js']);
  ok('a part: src/gl/02-glsl-inverse.js -> T2, the inverse GLSL page (src/gl is its input)', g.tier === 'T2' && g.glsl.length && g.glsl.every((j) => j.page === 'inverse') && g.perf, g.glsl);
  ok('a part: src/app/03-exact-images.js -> T2', select(['src/app/03-exact-images.js']).tier === 'T2');
  ok('tools/join_src.js (tsc only) -> T0', select(['tools/join_src.js']).tier === 'T0');
  // ([#385] the start-up file in its parts: the params and links, init() and the start stay T3; the constructions'
  // model and adapter are theirs and core; the test hooks select the suites that call a changed hook)
  for (const f of ['src/app/18-params.js', 'src/app/20-init.js', 'src/app/22-start.js']) ok(`a part: ${f} -> T3`, select([f]).tier === 'T3');
  const cm = select(['src/app/19-constructions.js']);
  ok('a part: src/app/19-constructions.js -> T2, the constructions and the core shards', cm.tier === 'T2' && same(cm.browser, [...new Set([...AREAS.constructions, ...AREAS.core]), 'smoke']), cm.browser);
  const H = 'src/app/21-test-hooks.js';
  ok('the test hooks without their diff (--files): T3', select([H]).tier === 'T3' && select([H], { hooksOf: () => null }).tier === 'T3');
  ok('the test hooks, a diff that names no hook: T3', select([H], { hooksOf: () => [] }).tier === 'T3');
  const zp = select([H], { hooksOf: () => ['__cmwZp'] });
  ok('the test hooks: __cmwZp changed -> the shards of the suites that call it (zp_cmd.js among them), not everything', zp.tier === 'T1' && zp.browser.includes('smoke') && zp.browser.length < ALL.length && zp.reasons.some((r) => /zp_cmd\.js/.test(r.effect)), zp.browser);
  ok('the test hooks: a changed hook no suite calls -> T3 (fail safe), not nothing', (() => { const p = select([H], { hooksOf: () => ['__cmwNoSuiteCallsThis'] }); return p.tier === 'T3' && /no browser suite calls/.test(p.why.join(' ')); })());
  const ps = select([H], { hooksOf: () => ['__cmwPaneStatus'] });
  ok('the test hooks: a hook the quality runner calls -> T3', ps.tier === 'T3' && ps.why.some((w) => /run_quality\.js/.test(w)), ps.why);
  ok('the Arb oracle (dev-only) -> T0', select(['tools/arb_reference.py', 'tools/arb_compare.js', 'notes/arb/reference.json']).tier === 'T0');
}
// (the name is built here, so that this file does not name it)
ok('T3: a test file nothing names', select([`test/${['nobody', 'names', 'this'].join('_')}.json`]).tier === 'T3');
const lab = select(['README.md'], { full: 'the label full-gate' });
ok('T3: the label full-gate (or a push, the nightly run, a run by hand) forces everything', lab.tier === 'T3' && same(lab.browser, ALL) && lab.why.includes('the label full-gate') && !lab.skipped.length, lab);
ok('T3: one unknown path among known ones still forces everything', select(['src/tour.js', 'Makefile']).tier === 'T3');

// [#385] the recent merges the analysis named, on the new rows: #370's desk.css diff now runs the phone shards; #375's,
// #349's and #342's hunks were in init() (now 20-init.js), so they stay T3 until UI wiring moves out of it (#385 step 3)
{
  const d370 = select(['src/desk.css', 'test/dh_cmd.js']);
  ok('#370 (desk.css, dh_cmd.js): the phone shards too', AREAS.phone.every((id) => d370.browser.includes(id)) && d370.tier !== 'T3', d370.browser);
  for (const [pr, files] of [['#375', ['src/app/09-pane-titles.js', 'src/app/20-init.js', 'src/desk.css', 'test/pane_heads_1024_cmd.js']], ['#349', ['src/app/20-init.js', 'test/phone_landscape_cmd.js']], ['#342', ['src/app/09-pane-titles.js', 'src/app/20-init.js', 'src/desk.css']]]) {
    ok(`${pr}: a hunk in init() (start-up) -> T3`, select(files).tier === 'T3');
  }
}

// the same build
const sb = select(['src/app/wrap.js', 'src/app/17-tour.js', 'src/tour.js', 'src/cx.js', 'tools/src_parts.py'], { sameBuild: true });
ok('same build: app paths select nothing (T0)', sb.tier === 'T0' && nothing(sb) && sb.reasons.every((r) => /same as the reference/.test(r.effect)), sb);
const sb2 = select(['src/app/wrap.js', 'test/tour_cmd.js'], { sameBuild: true });
ok('same build: a test path still selects its suite', sb2.tier === 'T1' && same(sb2.browser, ['tour', 'smoke']), sb2);
ok('same build: a non-app unknown path still forces T3', select(['src/app/wrap.js', 'LICENSE'], { sameBuild: true }).tier === 'T3');
ok('a different build: the map decides', select(['src/app/wrap.js'], { sameBuild: false }).tier === 'T3');

// the most of several paths, and what is skipped
const mix = select(['src/tour.js', 'src/sound.js', 'README.md']);
ok('several paths: the union of their shards', mix.tier === 'T1' && same(mix.browser, [...AREAS.tour, 'sound', 'smoke']));
ok('skipped lists what does not run', mix.skipped.includes('perf') && mix.skipped.includes('GLSL inverse') && mix.skipped.includes('browser phone-swap-1') && !mix.skipped.includes('browser tour'), mix.skipped);
ok('rowOf: the first matching row wins', rowOf('src/app/wrap.js').effect.full && rowOf('test/regress/README.md').glob === '**/*.md');

console.log(`${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);
