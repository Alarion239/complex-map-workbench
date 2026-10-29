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
//   SOFTWARE  per suite, checks that fail on GitHub's machines only because they draw in software (frames of tenths of
//             a second where the check needs several in a short window, ...), each with its reason and, where the
//             check's detail can show it, a `measured` predicate that holds only for that cause: printed, not gated
//             here (the GPU machines run the suites at full speed)
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
  'ux165_merge_shots_cmd.js': 'a screenshot writer: v16.5 wave 1 merge, before and after (its "before" page was built for the pictures and deleted), no verdict',
  'ux165_plane_shots_cmd.js': 'a screenshot writer: v16.5 wave 1 plane, before (a build of a local snapshot) and after, no verdict',
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
  'rel1641_smoke_cmd.js': 'the release smoke of v16.4.1: it checks that release\'s strings by design (v16.5 changed the readout, the first-run card, the shapes\' names); a release smoke is written for each release',
  // the GPU machines
  'landscape_walls_cmd.js': 'needs a GPU: the Landscape mesh read back from float textures against a CPU oracle, speckles and contours counted in pixels, meshes up to 1920 (about 25 min on a Mac GPU), and r1/ and base/ builds served beside it',
};

const audit = (label, sizes, inputs, layerAll) => ({ label, preamble: `const AUDIT_CFG = { sizes: ${JSON.stringify(sizes)}, inputs: ${JSON.stringify(inputs)}, layerAll: ${JSON.stringify(layerAll)} };` });
const part = (p) => ({ label: p, preamble: `const PART = '${p}';` });
const SUITES = {
  'perp_cmd.js': { pages: ['v162-test.html', 'v163-test.html'] },
  'touch_cmd.js': { pages: ['v162-test.html'] },
  // (in five parts, by its own CMW_ONLY: whole, it did not finish in 30 min on SwiftShader; section 4 alone took 19 min
  // on lavapipe, so it runs in two halves)
  'export_cmd.js': { timeoutMin: 40, runs: ['1-3', '4a', '4b', 'preview', 'user5'].map((only) => ({ label: only, env: { CMW_ONLY: only } })) },
  // (section 1 compares with the merged v16 tree before the deformation range, a snapshot that is not in the
  // repository: work/xv16-merged-snap; v16's own build differs from it by design)
  'deform_range_cmd.js': { runs: [{ preamble: 'globalThis.DR_RUN = [2, 3, 4, 5, 6, 7, 8, 9];' }] },
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
  'deform_dirichlet_cmd.js': [t(/^the Deformation click on ζ takes at most/), t(/^the X → Y selection on ζ /)],
  'sound_cmd.js': [t(/^frames: Hear F keeps the hover sweep/), t(/^tracker cost:/)],
  'seasong_cmd.js': [t(/60 fps while it plays \(p95 under 20 ms\)$/)],
  'tour_perf_cmd.js': [t(/: 60 fps while /)],
  'tour_auto_cmd.js': [t(/^(?!Patterns:).*(3 s after|3000 ± \d+ ms|700 ± 100 ms|\+3 s$)/, advanced), t(/^Patterns: moves on 3 s after/, (d) => advanced(d) && d[1] === 'edit/cards'),
    t(/ticked? within 300 ms/, (d) => typeof d === 'number'), t(/^Grieg: captions change at/, (d) => Array.isArray(d) && [/^The cut/, /^Each turn is/, /^The ending/].every((re) => d.some((c) => re.test(c[1]))))],
  'morphfig_cmd.js': [t(/the re-choice makes no long task/)],
  'split_cmd.js': [t(/^typing into the palette: the slowest input handler/), t(/^shared: sweep frames p95/), t(/^12 sines, the deformation playing: p95/)],
  'p3_accept_cmd.js': [t(/^\(h\) no main-thread task over 50 ms/), t(/^\(h\) the dialog: no main-thread task over 50 ms/),
    t(/^\(h\) a cancelled export returns null soon after the cancel/, (d) => d && d.cancelled === true)],
  // (the export completed with both globes inverse; only its long tasks missed)
  'p3_review_cmd.js': [t(/^first switch to X Sphere at dpr 2: no main-thread task/),
    t(/^two-globe 300 dpi export at dpr 2: completes, no main-thread task over 50 ms/, (d) => Array.isArray(d) && d.length > 0 && d.every((r) => r.ok && r.paths.includes('Rglobe:inverse') && r.paths.includes('Lglobe:inverse')))],
  'v15_desktop_cmd.js': [t(/^dragging a (zero|shape): p95 frame/, (d) => d && d.n > 20)],
  'zp_cmd.js': [t(/^drag at 60 fps/), t(/^deformation plays at 60 fps/)],
  'v15_params_cmd.js': [t(/^slider drag: (rAF work|input handler) p95/)],
  'p5_accept_cmd.js': [t(/: no slice over 6 ms$/), t(/^8\.8: the slices of the rebuild stay within 6 ms/)],
};

const s = (re, why, measured) => ({ re, why, measured });
const SOFTWARE = {
  // (the tour masks its rings off an open layer frame by frame; the audit looks once, 450 ms and 2 frames after the
  // layer opens, during its 4-px pop-in, which here is 1-3 frames: the mask is an earlier frame's. Only when the layer is
  // on top at all its points, the tour stays and the layer closes)
  'tour_audit_cmd.js': [
    s(/ layer (palette|export|toast)\*?: the tour covers none of it, its rings masked off it, the tour stays$/, 'one look during the layer\'s pop-in, which takes 1-3 frames here: the rings\' mask is from an earlier frame',
      (d) => d && JSON.stringify(d.kinds) === '["ringOverLayer"]' && d.g && Array.isArray(d.g.lay) && d.g.lay.every((x) => x === 'ok') && d.g.strip === true && d.after && d.after.active === true && d.after.layer === false),
    s(/ layer toast\*?: the tour covers none of it/, 'the toast leaves after 5 s, before the audit\'s look (450 ms and 2 frames of seconds each)',
      (d) => d && JSON.stringify(d.kinds) === '["noLayer"]'),
  ],
  'tour_cmd.js': [s(/^Sphere: one lit panel \(and the strip's window\) and a ring on its surface control$/, 'the ring comes once the shade\'s morph ends, seconds later here (the CI screenshot right after shows it)',
    (d) => d && d.id === 'sphere' && d.holes === 2 && d.mark === false)],
  // (the deformation's clock gains at most 0.1 a frame, app.js: at a few frames a second the per-frame checks see few
  // frames, though every frame in which t moved had its voice update)
  'sound_cmd.js': [s(/^deformation: (A Phase, still pointer, M|A Phase, Play|D merged plane): a voice update in every frame t moved$|^deformation: B the tone follows every frame$/,
    'every frame in which t moved had its voice update (none missed); only the number of frames is short at a few frames a second',
    (d) => d && d.missed === 0 && d.moved > 0),
    // (or, right after Landscape's first open of the deformation, 3 frames or fewer in the 2.6 s, too few for t to move:
    // the first frame's step is 0)
    s(/^deformation: E Landscape: the Height voice, a voice update in every frame t moved$/, 'every frame in which t moved had its Height voice update (none missed); only the number of frames is short',
      (d) => d && d.kind === 'height' && d.per && d.per.missed === 0 && (d.per.moved > 0 || (typeof d.nFrames === 'number' && d.nFrames <= 3))),
    s(/^deformation: E Landscape: one contour tick per level of \|H_t\| crossed$/, 'the run had not reached its end in the suite\'s window (no arrival), so fewer levels were crossed; no frame missed and no extra tick',
      (d) => d && d.kind === 'height' && d.per && d.per.missed === 0 && Array.isArray(d.made) && !d.made.includes('morphEnd') && d.made.filter((x) => x === 'contour').length <= d.ticksWant)],
  'sound_v152_cmd.js': [
    s(/^deformation: the loop sings while t runs/, 'W is 0 at first and 1 at the end, and the loop sang in every frame; only the frame count is short (27, needs more than 40)',
      (d) => d && Array.isArray(d.first) && d.first[1] === 0 && Array.isArray(d.last) && d.last[1] === 1 && d.singing === d.n),
    s(/^deformation: the note steps 0 → 1 when the zero enters the loop/, 'the note steps in the frame that crosses t = 0.45; only the gap between two frames (0.14) is wider than the check\'s 0.05',
      (d) => d && Array.isArray(d.before) && Array.isArray(d.step) && d.before[0] <= 0.45 && d.step[0] >= 0.45 && d.before[1] === 0 && d.step[1] === 1),
    s(/^scrub: the air while dragging/, 'the air plays and ends on release with the landmarks and no other cue; only its loudness, from the scrub\'s speed between input events, is low while input events arrive between long frames',
      (d) => d && d.mid && d.mid.tex === true && d.mid.v > 0 && d.after && d.after.tex === false && Array.isArray(d.made) && d.made.length >= 3 && d.made.length <= 4 && d.made.every((x) => x === 'landmark')),
  ],
  'tour_auto_cmd.js': [s(/^done: the spotlight steps aside/, 'a 200-ms fade looked at 400 ms after the task, before its frames: quiet, and presses reach the app',
    (d) => d && d.quiet === true && d.hit === true)],
  // (a 1280 x 720 Bounce of 2 s on the globe fills its preview frame by frame: more than the suite's 60 s here)
  'export_cmd.js': [s(/^preview Bounce on the globe: a frame on the way back is the video's frame/, 'the preview had not filled within the suite\'s 60 s; the frame on the way back matches the video and the exact render all the same',
    (d) => d && d.filledMs === -1 && d.frames === d.n && typeof d.entry === 'number' && d.madVideo < 4 && d.madExact < 2 && d.range > 100)],
  'p3_accept_cmd.js': [
    s(/^X Sphere at stage 0 draws inverse$/, 'sampled 2.5 s after the switch, the left globe\'s inverse program is still compiling (no parallel compile here: seconds a program)',
      (d) => Array.isArray(d) && d.some((p) => p.role === 'L' && p.viewKind === 'globe' && p.path === 'pending' && p.reason === 'compiling')),
    s(/^\(h\) the dialog: the last option wins$/, 'the last option is the one checked, but the figure is still being rebuilt when the suite\'s 10 s wait ends (a figure takes 25-40 s to build here); a finished figure with other columns still fails',
      (d) => d && d.checked === '1' && (d.cols === null || d.building === true)),
  ],
};

const KNOWN = {
};

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
  // (a new Chrome asks the origin for /favicon.ico once: a 404 is a "Failed to load resource" console error, which a
  // suite's first look at the console reports; on the development machine one long-lived Chrome made that request
  // long before)
  'favicon.ico': (dist, name) => fs.writeFileSync(path.join(dist, name), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')),
  'v162-test.html': old('d07ae97'),   // v16.2
  'v163-test.html': old('c8221ff'),   // v16.3
  // the published page as a host serves it: a UTF-8 doctype and a viewport meta around it (the release smokes)
  'smk_pub.html': (dist, name) => fs.writeFileSync(path.join(dist, name), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>\n'
    + fs.readFileSync(path.join(dist, 'complex-map-workbench.html'), 'utf8') + '</body></html>\n'),
};
// made for every run
const ALWAYS = ['gl-helpers.html', 'blank.html', 'favicon.ico'];

module.exports = { EXCLUDED, SUITES, TIMING, SOFTWARE, KNOWN, PAGES, ALWAYS };
