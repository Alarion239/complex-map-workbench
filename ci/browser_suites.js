'use strict';
// What ci/browser.js needs to know about some of the browser suites (test/*_cmd.js); a suite not named here runs as it
// is, once, with the defaults (30 min, its verdict read from its result: { pass, fails }, { pass, of }, { ok }).
//   EXCLUDED  the files that do not run here, each with the reason: not pass/fail suites (benchmarks, recorders,
//             screenshot writers), suites another job runs, superseded ones, and those that need the GPU machines
//   SUITES    per suite: runs (one row each: a label, a preamble on the suite's first line, env), pages (extra pages
//             in dist/: PAGES), timeoutMin, verdict (the failures from a result of another shape)
//   TIMING    per suite, the checks that measure speed (by name): reported with their numbers, not gated. A check whose
//             name has BUDGET60 (the 60 fps budget) is one already. When a check also asserts something else in the
//             same condition, `measured` says from its recorded detail that the rest held: only then is its failure a
//             timing one (a step that never advanced, a drag that drew no frames, still fails)
//   KNOWN     per suite, failures that are understood and open, each with its reason: printed, not gated
//   PAGES     how the extra pages are made
const fs = require('fs');
const path = require('path');

const EXCLUDED = {
  // not pass/fail suites
  'deform_nat_fps_cmd.js': 'a benchmark: frame times of the natural paths, no verdict',
  'deform_range_fps_cmd.js': 'a benchmark whose only verdict is speed (p95 ≤ 18.4 ms, ≥ 58 fps): the perf suite on the GPU machines gates speed',
  'sound_deform_fps_cmd.js': 'a benchmark: frame and sound times while the deformation plays, no verdict',
  'sound_v152_fps_cmd.js': 'a benchmark of fps and rAF work with the CPU slowed 6×; its one other check (the loop sings) is in sound_v152_cmd.js',
  'inv_bench_cmd.js': 'a benchmark of the inverse renderer: writes test/inv_bench_results/, no verdict',
  'sound_clicks_cmd.js': 'a recorder: real-time audio for test/sound_clicks.py, which gives the verdict (an underrun on a shared machine would be a click)',
  'sound_deform_clicks_cmd.js': 'a recorder: real-time audio for test/sound_clicks.py and a detector that is not in the repository',
  'seasong_rec_cmd.js': 'a recorder: the Mountain King as audio (then test/seasong_wav.js and macOS afconvert), no verdict',
  'i18n_shots_cmd.js': 'a screenshot writer: the Russian interface, no verdict',
  'sheets_film_cmd.js': 'a screenshot writer: the sheets while deforming, no verdict',
  // run elsewhere
  'sound_deform_cmd.js': 'runs inside sound_cmd.js (its failures prefixed "deformation: ")',
  'glsl_inverse_cmd.js': 'the GLSL jobs run this page (ci/glsl.js --only inverse), paired against the reference on each platform',
  // superseded
  'ub_views_cmd.js': 'superseded by mv_views_cmd.js; it says it fails on the current app by design (#phaseBtn is gone)',
  'ubfix_cmd.js': 'superseded in part by mv_views_cmd.js; it presses the old Phase key 4 and #phaseBtn, which are gone',
  'rel16_smoke_cmd.js': 'the release smoke of v16; rel1641_smoke_cmd.js carries its sections forward on the current page',
  'rel161_smoke_cmd.js': 'the release smoke of v16.1; rel1641_smoke_cmd.js carries its sections forward on the current page',
  'rel162_smoke_cmd.js': 'the release smoke of v16.2; rel1641_smoke_cmd.js carries its sections forward on the current page',
  'rel163_smoke_cmd.js': 'the release smoke of v16.3; rel1641_smoke_cmd.js carries its sections forward on the current page',
  'rel1631_smoke_cmd.js': 'the release smoke of v16.3.1; rel1641_smoke_cmd.js carries its sections forward (its section 14, the tour card on a landscape phone, went with the card in v16.4)',
  'rel164_smoke_cmd.js': 'the release smoke of v16.4; rel1641_smoke_cmd.js is it with v16.3.1\'s fixed items',
  // the GPU machines
  'landscape_walls_cmd.js': 'needs a GPU: the Landscape mesh read back from float textures against a CPU oracle, speckles and contours counted in pixels, meshes up to 1920 (about 25 min on a Mac GPU), and r1/ and base/ builds served beside it',
};

const rel = (lang, w, dark) => ({ label: `${lang}-${w}${dark ? '-dark' : ''}`, preamble: `const CFG = { lang: '${lang}', w: ${w}, dark: ${dark} };` });
const audit = (label, sizes, inputs, layerAll) => ({ label, preamble: `const AUDIT_CFG = { sizes: ${JSON.stringify(sizes)}, inputs: ${JSON.stringify(inputs)}, layerAll: ${JSON.stringify(layerAll)} };` });
const part = (p) => ({ label: p, preamble: `const PART = '${p}';` });
const SUITES = {
  'perp_cmd.js': { pages: ['v162-test.html', 'v163-test.html'] },
  'touch_cmd.js': { pages: ['v162-test.html'] },
  // (it did not finish in 30 min on SwiftShader)
  'export_cmd.js': { timeoutMin: 60 },
  // (section 1 compares with the merged v16 tree before the deformation range, a snapshot that is not in the
  // repository: work/xv16-merged-snap; v16's own build differs from it by design)
  'deform_range_cmd.js': { runs: [{ preamble: 'globalThis.DR_RUN = [2, 3, 4, 5, 6, 7, 8, 9];' }] },
  // the published page, both languages, desktop and phone, light and dark
  'rel1641_smoke_cmd.js': { pages: ['smk_pub.html'], runs: [rel('en', 1440, false), rel('ru', 1440, true), rel('en', 390, true), rel('ru', 390, false)] },
  // (its default is 7 sizes × 2 themes × 2 languages × 2 inputs, about 2 hours on a Mac GPU: here a phone and a desktop,
  // both themes and languages, each with its own input)
  'tour_audit_cmd.js': { runs: [audit('phone', [[390, 844]], ['touch'], [390]), audit('desktop', [[1440, 900]], ['mouse'], [1440])] },
  'i18n_walk_cmd.js': {
    runs: [{ label: '1440' }, { label: '390-dark', preamble: 'globalThis.WALK = { w: 390, dark: true };' }],
    verdict: (out) => (out && Array.isArray(out.left) ? [...out.left.map((l) => ({ name: `English left: ${l.text}`, detail: l })), ...(out.errors || []).map((e) => ({ name: 'a console error', detail: e }))] : null),
  },
  'phone_swap_cmd.js': { runs: ['swap', 'sheet', 'rotate', 'urlbar', 'views', 'deform', 'sphere', 'lang', 'tablet', 'review'].map(part) },
};

const t = (re, measured) => ({ re, measured });
// (tour_auto: the step advanced, i.e. a time was measured: its detail is that time, or an array that starts with it)
const advanced = (d) => typeof (Array.isArray(d) ? d[0] : d) === 'number';
const TIMING = {
  'perp_cmd.js': [t(/^I8 rAF work no worse than the whole-circle run/)],
  'touch_cmd.js': [t(/^F hover with the hint: rAF work max/), t(/^F hover with the two rings: rAF work max/, (d) => d && d.nRings === 2)],
  'fix163_cmd.js': [t(/^U4 T \(a glider\) dragged/, (d) => Array.isArray(d) && d.every((r) => r.moved && r.und === 0)), t(/^U4 a free point dragged/, (d) => Array.isArray(d) && d.every((r) => r.moved))],
  'export_cmd.js': [t(/^a figure builds in under 2\.5 s/), t(/no main-thread task of 50 ms or more/), t(/^preview: it advances at the video's frame rate/),
    t(/^preview: no main-thread task/), t(/^preview: the animation frames keep time/), t(/^preview DPR 2: plays at 30 fps/), t(/^preview 60 fps Loop/),
    t(/^dark theme: a video and a filmstrip flip the theme/, (d) => d && d.dark && d.flips <= 2 && d.fig),
    t(/^video in a hidden page: made at a pace close to a visible one/, (d) => d && d.hv && d.vv && d.hv.frames === d.vv.frames)],
  'deform_nat_cmd.js': [t(/: 60 fps while playing \(p95 under 20 ms\)$/)],
  'sound_cmd.js': [t(/^frames: Hear F keeps the hover sweep/), t(/^tracker cost:/)],
  'seasong_cmd.js': [t(/60 fps while it plays \(p95 under 20 ms\)$/)],
  'tour_perf_cmd.js': [t(/: 60 fps while /)],
  'tour_auto_cmd.js': [t(/^(?!Patterns:).*(3 s after|3000 ± \d+ ms|700 ± 100 ms|\+3 s$)/, advanced), t(/^Patterns: moves on 3 s after/, (d) => advanced(d) && d[1] === 'edit/cards'),
    t(/ticked? within 300 ms/, (d) => typeof d === 'number'), t(/^Grieg: captions change at/, (d) => Array.isArray(d) && [/^The cut/, /^Each turn is/, /^The ending/].every((re) => d.some((c) => re.test(c[1]))))],
  'morphfig_cmd.js': [t(/the re-choice makes no long task/)],
  'split_cmd.js': [t(/^typing into the palette: the slowest input handler/), t(/^shared: sweep frames p95/), t(/^12 sines, the deformation playing: p95/)],
  'p3_accept_cmd.js': [t(/^\(h\) no main-thread task over 50 ms/), t(/^\(h\) the dialog: no main-thread task over 50 ms/)],
  'p3_review_cmd.js': [t(/^first switch to X Sphere at dpr 2: no main-thread task/)],
  'v15_desktop_cmd.js': [t(/^dragging a (zero|shape): p95 frame/, (d) => d && d.n > 20)],
  'zp_cmd.js': [t(/^drag at 60 fps/), t(/^deformation plays at 60 fps/)],
  'v15_params_cmd.js': [t(/^slider drag: (rAF work|input handler) p95/)],
  'p5_accept_cmd.js': [t(/: no slice over 6 ms$/), t(/^8\.8: the slices of the rebuild stay within 6 ms/)],
};

const KNOWN = {};

// an old version's page, from the build of its commit (ci/reference.js: a git worktree under .ci/; needs the history)
const old = (commit) => (dist, name) => {
  const { buildReference } = require('./reference');
  const R = buildReference(commit);
  fs.copyFileSync(path.join(R.dist, 'test.html'), path.join(dist, name));
  console.log(`dist/${name}: test.html of ${commit}`);
};
const PAGES = {
  // (the kit's load() and some suites open a page of the origin only to write its localStorage)
  'gl-helpers.html': (dist, name) => fs.writeFileSync(path.join(dist, name), '<!doctype html><title>blank</title>\n'),
  'blank.html': (dist, name) => fs.writeFileSync(path.join(dist, name), '<!doctype html><title>blank</title>\n'),
  'v162-test.html': old('d07ae97'),   // v16.2
  'v163-test.html': old('c8221ff'),   // v16.3
  // the published page as a host serves it: a UTF-8 doctype and a viewport meta around it (the release smokes)
  'smk_pub.html': (dist, name) => fs.writeFileSync(path.join(dist, name), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>\n'
    + fs.readFileSync(path.join(dist, 'complex-map-workbench.html'), 'utf8') + '</body></html>\n'),
};
// made for every run
const ALWAYS = ['gl-helpers.html', 'blank.html'];

module.exports = { EXCLUDED, SUITES, TIMING, KNOWN, PAGES, ALWAYS };
