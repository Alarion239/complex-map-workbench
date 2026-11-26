'use strict';
// What ci/browser.js needs to know about some of the browser suites (test/*_cmd.js); a suite not named here runs as it
// is, once, with the defaults (30 min, its verdict read from its result: { pass, fails }, { pass, of }, { ok }).
//   EXCLUDED  the files that do not run here, each with the reason: not pass/fail suites (benchmarks, recorders,
//             screenshot writers), suites another job runs, superseded ones, and those that need the GPU machines
//   SUITES    per suite: runs (one row each: a label, a preamble on the suite's first line, env), pages (extra pages
//             in dist/: PAGES), timeoutMin, verdict (the failures from a result of another shape), keepShots (keep its
//             screenshots when it passes: a suite that reports with marked shots), logLine (its result as one line
//             of the job's log, from its result)
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
  'inv_bench_cmd.js': 'a benchmark of the inverse renderer: writes test/inv_bench_results/, no verdict',
  'sound_clicks_cmd.js': 'a recorder: real-time audio for test/sound_clicks.py, which gives the verdict (an underrun on a shared machine would be a click)',
  'seasong_rec_cmd.js': 'a recorder: the Mountain King as audio (then test/seasong_wav.js and macOS afconvert), no verdict',
  'i18n_shots_cmd.js': 'a screenshot writer: the Russian interface, no verdict',
  'ux165_merge_shots_cmd.js': 'a screenshot writer: v16.5 wave 1 merge, before and after (its "before" page was built for the pictures and deleted), no verdict',
  'ux165_plane_shots_cmd.js': 'a screenshot writer: v16.5 wave 1 plane, before (a build of a local snapshot) and after, no verdict',
  // run elsewhere
  'sound_still_probe_cmd.js': 'runs inside sound_cmd.js (its failures prefixed "still probe: ")',
  'glsl_inverse_cmd.js': 'the GLSL jobs run this page (ci/glsl.js --only inverse), paired against the reference on each platform',
  // superseded
  'ub_views_cmd.js': 'superseded by the merged-views suite; it says it fails on the current app by design (#phaseBtn is gone)',
  'ubfix_cmd.js': 'superseded in part by the merged-views suite; it presses the old Phase key 4 and #phaseBtn, which are gone',
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
// (the pages and the runs of both raw-TeX suites: one language per run, MathJax's page where the language has it)
const RAW_TEX = { pages: ['mj', 'test-mj.html', 'test-nomj.html'], runs: ['en', 'ru', 'it'].map((l) => ({ label: l, preamble: `globalThis.LANG = '${l}'; globalThis.MJ = ${l !== 'it'};` })) };
const SUITES = {
  // (pinned to the steps view in ci/suite_views.js; the second run drops the pin, so the classic view's legs of the same
  // suite run too)
  'fix163_cmd.js': { runs: [{ label: 'steps' }, { label: 'classic', env: { CMW_VIEW: 'classic' } }] },
  'ux165_rail_cmd.js': { runs: [{ label: 'steps' }, { label: 'classic', env: { CMW_VIEW: 'classic' } }] },
  'curves_cmd.js': { runs: [{ label: 'steps' }, { label: 'classic', env: { CMW_VIEW: 'classic' } }] },
  'curves_target_areas_cmd.js': { runs: [{ label: 'steps' }, { label: 'classic', env: { CMW_VIEW: 'classic' } }] },
  'sphere_light_cmd.js': { runs: [{ label: 'steps' }, { label: 'classic', env: { CMW_VIEW: 'classic' } }] },
  'cauchy_residue_cmd.js': { runs: [{ label: 'steps' }, { label: 'classic', env: { CMW_VIEW: 'classic' } }] },
  // (the seams at the device pixel ratio 1 and at the Mac screen's 2, the kit's CMW_DPR: the teeth along a seam, a staircase in the
  // fill's edge, show at the ratio 2 on software GL when the fill reads its source point off the pixel centre.
  // keepShots: the settled seam frame and the worst frame of the 2 s window; logLine: each teeth reading with its rows, so a
  // job log shows where along the seam the jumps stand)
  'steps_seams_cmd.js': {
    runs: [{ label: 'dpr1' }, { label: 'dpr2', env: { CMW_DPR: '2' } }],
    keepShots: true,
    logLine: (o) => 'SEAM-ROWS ' + JSON.stringify({ teeth: o.info.teeth, afterSettled: o.info.afterSettled, rows: o.info.teethRows }),
  },
  // (the default example Inside regions, the Joukowski airfoil, the Mountain King and the two polynomials at the device pixel ratio 1, and the
  // default example Inside regions and Everywhere at the Mac screen's 2: the kit's CMW_DPR; the steps inverted by a closed form and a
  // polynomial of degree 5, Everywhere, in a run of their own)
  'steps_glide_look_cmd.js': { runs: [
    { label: 'dpr1', preamble: "globalThis.LOOK_CASES = ['Strip to disk', 'Joukowski airfoil', 'Joukowski airfoil, Everywhere', 'Mountain King, Everywhere', 'Roots as preimages, Everywhere', 'Partial sum of the exponential', 'Logarithm, Everywhere', 'Sheets of the logarithm, Everywhere', 'Zeros of the zeta function'];" },
    { label: 'dpr2', env: { CMW_DPR: '2' }, preamble: "globalThis.LOOK_CASES = ['Strip to disk', 'Strip to disk, Everywhere'];" },
    { label: 'exact', preamble: "globalThis.LOOK_CASES = ['n-th root, Everywhere', 'complex power, Everywhere', 'cos, Everywhere', 'cosh, Everywhere', 'arccos, Everywhere', 'arcosh, Everywhere', 'polynomial of degree 5, Everywhere', 'rational of degree 5, Everywhere'];" },
  ] },
  'perp_cmd.js': { pages: ['v162-test.html', 'v163-test.html'] },
  'touch_cmd.js': { pages: ['v162-test.html'], runs: [{ label: 'steps' }, { label: 'classic', env: { CMW_VIEW: 'classic' } }] },
  // (in parts, by its own CMW_ONLY: whole, the figure export did not finish in 30 min on SwiftShader)
  'export_cmd.js': { timeoutMin: 40, runs: ['1-3', 'user5', 'user5-deform-steps'].map((only) => ({ label: only, env: { CMW_ONLY: only } })).concat(['user5-classic'].map((only) => ({ label: only, env: { CMW_ONLY: only, CMW_VIEW: '' } }))) },
  // (the one carry-vs-exact suite, its parts in the shards they balance: views-1 and formulas)
  'steps_carry_exact_cmd.js': { runs: ['glide', 'inregion', 'far', 'chains', 'planes'].map((only) => ({ label: only, env: { CMW_ONLY: only } })) },
  'export_deform_cmd.js': { timeoutMin: 30, runs: ['video', 'dialog', 'preview'].map((only) => ({ label: only, env: { CMW_ONLY: only } })) },

  // (section 1 compares with a snapshot of the merged tree taken before the deformation range, which is not in the
  // repository: work/xv16-merged-snap; the released build differs from it by design)
  // (its default is 7 sizes × 2 themes × 2 languages × 2 inputs, about 2 hours on a Mac GPU: here a phone and a desktop,
  // both themes and languages, each with its own input)
  'tour_audit_cmd.js': { runs: [audit('phone', [[390, 844]], ['touch'], [390]), audit('desktop', [[1440, 900]], ['mouse'], [1440])] },
  'i18n_walk_cmd.js': {
    runs: [{ label: '1440' }, { label: '390-dark', preamble: 'globalThis.WALK = { w: 390, dark: true };' }],
    verdict: (out) => (out && Array.isArray(out.left) ? [...out.left.map((l) => ({ name: `English left: ${l.text}`, detail: l })), ...(out.errors || []).map((e) => ({ name: 'a console error', detail: e }))] : null),
  },
  'i18n_walk_steps_cmd.js': {
    verdict: (out) => (out && Array.isArray(out.left) ? [...out.left.map((l) => ({ name: `English left: ${l.text}`, detail: l })), ...(out.errors || []).map((e) => ({ name: 'a console error', detail: e }))] : null),
  },
  // (one language a run; its pages: the test page without MathJax and with the vendored one)
  'raw_tex_cmd.js': RAW_TEX,
  'raw_tex_classic_cmd.js': RAW_TEX,
  'newt_member0_cmd.js': { pages: ['glsl-inverse-test.html'] },
  'newt_poly_order_cmd.js': { pages: ['glsl-inverse-test.html'] },
  'series_limit_cmd.js': { pages: ['glsl-inverse-test.html'] },
  'export_tex_cmd.js': { pages: ['mj', 'test-mj.html'] },   // (#529: the figure's own text)
  'steps_land_footprint_fig_cmd.js': { pages: ['mj', 'test-mj.html'] },
  'steps_paths_sphere_fig_cmd.js': { pages: ['mj', 'test-mj.html'] },
  // (the phone's sheet, rotate, urlbar, lang and tablet legs)
  'phone_plane_cmd.js': { runs: ['sheet', 'rotate', 'urlbar', 'lang', 'tablet'].map(part) },
  // (#470: English on every size, Russian and Italian (the longest words) on the narrowest phone, the small landscape
  // phone and the smallest desktop; each the classic view and ?view=steps, both themes, every state. In gate mode a
  // violation whose key ci/layout_baseline.json lacks for its run fails the job, and so does a state that opened for the
  // baseline and does not; the rest go to its result's report)
  'layout_invariants_cmd.js': {
    keepShots: true,
    // (ci/layout_ratchet.js reads the baseline from this line of a job's log: no artifact download needed)
    // (the rows this run does not see: fixed, to lower the baseline with ci/layout_ratchet.js update)
    note: (o) => (o.info && o.info.fixed && o.info.fixed.length ? `${o.info.fixed.length} layout row(s) fixed, lower the baseline (node ci/layout_ratchet.js update <this job's log>): ${o.info.fixed.join('; ')}` : (o.info && o.info.gate) || ''),
    logLine: (o) => 'LAYOUT-RESULT ' + JSON.stringify({ label: o.label, info: { matrix: o.info.matrix, renderer: o.info.renderer, skipped: o.info.skipped }, report: o.report.map((r) => ({ id: r.id, n: r.n })) }),
    runs: [['en', null], ['ru', ['360', '740x360', '1024', '568x320', '600x320']], ['it', ['360', '740x360', '1024']]].map(([l, sizes]) => ({ label: l,
      preamble: `const LAYOUT_CFG = { label: '${l}', langs: ['${l}'], sizes: ${JSON.stringify(sizes)}, mode: 'gate' };` })),
  },
};

const t = (re, measured) => ({ re, measured });
// (tour_auto: the step advanced, i.e. a time is measured: its detail is that time, or an array that starts with it)
const advanced = (d) => typeof (Array.isArray(d) ? d[0] : d) === 'number';
// (tour_auto's Grieg check: its detail is [durMs, caps, lts], caps the [ms, text] of each caption shown: the piece had a
// duration and every caption the check reads came, so a failure is a caption's time alone)
const GRIEG_CAPTIONS = [/^Each note is/, /^Each step is/, /^The crack is/, /^The second lap/];
const griegCaptionsAll = (d) => Array.isArray(d) && d[0] > 0 && Array.isArray(d[1]) && GRIEG_CAPTIONS.every((re) => d[1].some((c) => re.test(c[1])));
const TIMING = {
  'perp_cmd.js': [t(/^I8 rAF work no worse than the whole-circle run/)],
  'series_edit_cmd.js': [t(/^timing: /)],
  'link_standin_cmd.js': [t(/^timing: /)],
  'steps_line_standin_cmd.js': [t(/^timing: /)],
  'steps_stack_tubes_cmd.js': [t(/^timing: /, (d) => d && d.frames === 24)],
  'steps_stack_links_cmd.js': [t(/^timing: /, (d) => d && Array.isArray(d.frames) && d.frames[0] === 24 && d.frames[1] === 24)],
  'param_planes_cmd.js': [t(/^timing: /)],
  'touch_cmd.js': [t(/^F hover with the hint: rAF work max/), t(/^F hover with the two rings: rAF work max/, (d) => d && d.nRings === 2)],
  'fix163_cmd.js': [t(/^U4 T \(a glider\) dragged/, (d) => Array.isArray(d) && d.every((r) => r.moved && r.und === 0)), t(/^U4 a free point dragged/, (d) => Array.isArray(d) && d.every((r) => r.moved))],
  'export_cmd.js': [t(/^a figure builds in under 2\.5 s/)],
  'export_deform_cmd.js': [t(/^Save video in the dialog: no main-thread task of 50 ms or more/),
    t(/^glide video 1920 x 1080 at 60 fps: no main-thread task of 50 ms or more/, (d) => d && d.frames > 0 && Array.isArray(d.lt)),
    t(/^dark theme: a video and a figure flip the theme/, (d) => d && d.dark && d.flips <= 2 && d.fig),
    t(/^preview: it advances at the video's frame rate/, (d) => d && typeof d.rate === 'number'), t(/^preview: no main-thread task/)],
  'deform_dirichlet_cmd.js': [t(/^timing: /)],
  'steps_glide_negpow_cmd.js': [t(/^timing: /)],
  'steps_glide_closed_cmd.js': [t(/^timing: /)],
  'steps_glide_warm_cmd.js': [t(/waits at most/)],
  'sound_cmd.js': [t(/^frames: Hear F keeps the hover sweep/), t(/^tracker cost:/)],
  'seasong_cmd.js': [t(/60 fps while it plays \(p95 under 20 ms\)$/)],
  'tour_perf_cmd.js': [t(/: 60 fps while /)],
  'tour_auto_cmd.js': [t(/(3 s after|3000 ± \d+ ms|700 ± 100 ms|\+3 s$)/, advanced),
    t(/ticked? within 300 ms/, (d) => typeof d === 'number'), t(/^Grieg: captions change at/, griegCaptionsAll)],
  'split_cmd.js': [t(/^typing into the palette: the slowest input handler/), t(/^shared: sweep frames p95/)],
  'split_deform_cmd.js': [t(/^12 sines, the deformation playing: p95/)],
  'p3_accept_cmd.js': [t(/^\(h\) no main-thread task over 50 ms/), t(/^\(h\) the dialog: no main-thread task over 50 ms/),
    t(/^\(h\) a cancelled export returns null soon after the cancel/, (d) => d && d.cancelled === true)],
  'p3_accept_steps_cmd.js': [t(/^\(h\) no main-thread task over 50 ms/), t(/^\(h\) the dialog: no main-thread task over 50 ms/),
    t(/^\(h\) a cancelled export returns null soon after the cancel/, (d) => d && d.cancelled === true)],
  // (the export completed with X's globe inverse; only its long tasks missed)
  'p3_review_classic_cmd.js': [t(/^first switch to X Sphere at dpr 2: no main-thread task/),
    t(/^the globe's 300 dpi export at dpr 2: completes, no main-thread task over 50 ms/, (d) => Array.isArray(d) && d.length > 0 && d.every((r) => r.ok && r.paths.includes('Lglobe:inverse')))],
  'zp_cmd.js': [t(/^drag at 60 fps/)],
  'v15_params_cmd.js': [t(/^slider drag: (rAF work|input handler) p95/)],
  'p5_accept_cmd.js': [t(/: no slice over 6 ms$/), t(/^8\.8: the slices of the rebuild stay within 6 ms/)],
};

const s = (re, why, measured) => ({ re, why, measured });
const SOFTWARE = {
  // (the tour masks its rings off an open layer frame by frame; the audit looks once, two frames after the layer shows
  // and its animations end (#504: no fixed 450 ms), which can still fall in its 4-px pop-in, 1-3 frames here: the mask
  // is an earlier frame's. Only when the layer is
  // on top at all its points, the tour stays and the layer closes)
  'tour_audit_cmd.js': [
    s(/ layer (palette|export|toast)\*?: the tour covers none of it, its rings masked off it, the tour stays$/, 'one look during the layer\'s pop-in, which takes 1-3 frames here: the rings\' mask is from an earlier frame',
      (d) => d && JSON.stringify(d.kinds) === '["ringOverLayer"]' && d.g && Array.isArray(d.g.lay) && d.g.lay.every((x) => x === 'ok') && d.g.strip === true && d.after && d.after.active === true && d.after.layer === false),
    s(/ layer toast\*?: the tour covers none of it/, 'the toast leaves after 5 s (a timer), before the audit\'s look (its frames take seconds each here)',
      (d) => d && JSON.stringify(d.kinds) === '["noLayer"]'),
  ],
  'tour_cmd.js': [s(/^Sphere: one lit panel \(and the strip's window\) and a ring on its surface control$/, 'the ring comes once the shade\'s morph ends, seconds later here (the CI screenshot right after shows it)',
    (d) => d && d.id === 'sphere' && d.holes === 2 && d.mark === false)],
  'tour_auto_cmd.js': [s(/^done: the spotlight steps aside/, 'a 200-ms fade looked at 400 ms after the task, before its frames: quiet, and presses reach the app',
    (d) => d && d.quiet === true && d.hit === true)],
  'p3_accept_cmd.js': [
    s(/^(X Sphere at stage 0|\(f\) Cayley\(H\) on the globe at stage 1) draws inverse$/, 'sampled 2.5 s after the switch, the left globe\'s inverse program is still compiling (no parallel compile here: seconds a program)',
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
// test.html with its MathJax tags (build.py's CDN tags: the preloads of the STIX2 font and of the MathML component,
// and MathJax 4's core) replaced
const MJ_TAG = ['<link rel="preload" as="script" href="https://cdn.jsdelivr.net/npm/@mathjax/mathjax-stix2-font@4.1.3/svg.js">',
  '<link rel="preload" as="script" href="https://cdn.jsdelivr.net/npm/mathjax@4.1.3/a11y/assistive-mml.js">',
  '<script async src="https://cdn.jsdelivr.net/npm/mathjax@4.1.3/tex-svg-nofont.js"></script>'].join('\n');
const mjPage = (dist, tag) => { const t = fs.readFileSync(path.join(dist, 'test.html'), 'utf8'); if (t.split(MJ_TAG).length !== 2) throw new Error('test.html: its MathJax tags'); return t.replace(MJ_TAG, tag); };
// MathJax 4 from vendor/ in dist/mj/: the core, the MathML component it loads from its own folder (a11y/) and the
// STIX2 font (mathjax-stix2/, svg.js and the ranges it loads on demand), which test-mj.html points the loader at
const VJS = path.join(__dirname, '..', 'vendor', 'js');
const copyDir = (from, to) => { fs.mkdirSync(to, { recursive: true }); for (const e of fs.readdirSync(from, { withFileTypes: true })) (e.isDirectory() ? copyDir : fs.copyFileSync)(path.join(from, e.name), path.join(to, e.name)); };
const PAGES = {
  // (the kit's load() and some suites open a page of the origin only to write its localStorage)
  'gl-helpers.html': (dist, name) => fs.writeFileSync(path.join(dist, name), '<!doctype html><title>blank</title>\n'),
  'blank.html': (dist, name) => fs.writeFileSync(path.join(dist, name), '<!doctype html><title>blank</title>\n'),
  // (the test page as it is until MathJax has loaded, or where its CDN is blocked: no MathJax; and with MathJax
  // from vendor/, not the CDN, so the typeset page is the same on every runner)
  'mj': (dist, name) => {
    const d = path.join(dist, name);
    fs.mkdirSync(path.join(d, 'a11y'), { recursive: true });
    fs.copyFileSync(path.join(VJS, 'tex-svg-nofont.js'), path.join(d, 'tex-svg-nofont.js'));
    fs.copyFileSync(path.join(VJS, 'a11y', 'assistive-mml.js'), path.join(d, 'a11y', 'assistive-mml.js'));
    copyDir(path.join(VJS, 'mathjax-stix2'), path.join(d, 'mathjax-stix2'));
  },
  'test-mj.html': (dist, name) => fs.writeFileSync(path.join(dist, name), mjPage(dist, '<script>window.MathJax.loader = { paths: { \'mathjax-stix2\': \'mj/mathjax-stix2\' } };</script>\n<script async src="mj/tex-svg-nofont.js"></script>')),
  'test-nomj.html': (dist, name) => fs.writeFileSync(path.join(dist, name), mjPage(dist, '')),
  // (the inverse renderer's GPU-against-CPU page)
  'glsl-inverse-test.html': () => { if (require('child_process').spawnSync('python3', ['test/make_glsl_inverse_test.py'], { cwd: path.join(__dirname, '..') }).status !== 0) throw new Error('glsl-inverse-test.html'); },
  // (a new Chrome asks the origin for /favicon.ico once: a 404 is a "Failed to load resource" console error, which a
  // suite's first look at the console reports; on the development machine one long-lived Chrome made that request
  // long before)
  'favicon.ico': (dist, name) => fs.writeFileSync(path.join(dist, name), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')),
  'v162-test.html': old('d07ae97'),   // standards-ok: the snapshot's version name
  'v163-test.html': old('c8221ff'),   // standards-ok: the snapshot's version name
  // the published page as a host serves it: a UTF-8 doctype and a viewport meta around it (the release smokes)
  'smk_pub.html': (dist, name) => fs.writeFileSync(path.join(dist, name), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>\n'
    + fs.readFileSync(path.join(dist, 'complex-map-workbench.html'), 'utf8') + '</body></html>\n'),
};
// made for every run
const ALWAYS = ['gl-helpers.html', 'blank.html', 'favicon.ico'];

module.exports = { EXCLUDED, SUITES, TIMING, SOFTWARE, KNOWN, PAGES, ALWAYS };
