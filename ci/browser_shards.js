'use strict';
// The browser suites (ci/browser.js) split into shards, each one CI job on GitHub's Linux machines of about 15 minutes
// (the measured times: ci/README.md). Every suite that runs is in exactly one shard: a suite listed in no shard (a new
// one, e.g. v16.5's test/ux165_*_cmd.js) runs in the shard `new`, so none is left out; move it to a shard once its time
// is known. `node ci/browser_shards.js check` fails when a suite is listed twice, or is listed and excluded
// (ci/browser_suites.js EXCLUDED); a listed file that no longer exists is only reported.
//   node ci/browser_shards.js matrix [--only id,id]   the shard ids with at least one suite, as a JSON array
//   node ci/browser_shards.js list ID                  one shard's suites (and runs)
//   node ci/browser_shards.js check                    every suite in exactly one shard
const fs = require('fs');
const path = require('path');

// (a suite's runs, SUITES[f].runs in ci/browser_suites.js, may go to different shards: 'file#label')
const SHARDS = [
  // (seconds of suite time on lavapipe, the fourth run of pull request #7; a job adds about a minute)
  { id: 'perp', suites: ['perp_cmd.js', 'fix163_cmd.js'] },                                                  // 447 + 336
  // (export_cmd.js: the fifth run's times)
  { id: 'export-1', suites: ['export_cmd.js#1-3', 'export_cmd.js#user5', 'export_sheet_cmd.js', 'figure_wait_cmd.js'] },                                // 453 + 265
  // (#429: 4a was one 22-23 min job, the longest of a T3 run: its figures and its videos are two jobs)
  { id: 'export-2', suites: ['export_cmd.js#4a-fig', 'export_tex_cmd.js'] },
  { id: 'export-4', suites: ['export_cmd.js#4a-vid'] },
  { id: 'export-3', suites: ['export_cmd.js#preview', 'export_cmd.js#4b'] },                               // 571 + 167
  { id: 'constructions', suites: ['constr_cmd.js', 'touch_cmd.js', 'meetnear_coincide_cmd.js'] },                                       // 480 + 295
  { id: 'deform', suites: ['sheets_deform_cmd.js', 'deform_range_cmd.js', 'deform_nat_cmd.js', 'deform_range_gl_cmd.js', 'rel162_sheets_cmd.js', 'deform_dirichlet_cmd.js'] },   // 340 + 292 + 114 + 22 + 24 + about 30
  { id: 'sound', suites: ['sound_cmd.js', 'sound_v152_cmd.js', 'seasong_cmd.js'] },                         // 214 + 104 + 98
  { id: 'tour', suites: ['tour_cmd.js', 'tour_titles_cmd.js', 'tour_chapters_cmd.js', 'tour_lane_cmd.js', 'guide_nav_cmd.js', 'example_params_cmd.js', 'example_cauchy_cmd.js', 'tour_auto_cmd.js', 'tour_tasks_cmd.js', 'tour_lit_cmd.js', 'tour_perf_cmd.js'] },        // 235 + 312 + 135 + 50
  { id: 'tour-phone', suites: ['tour_phone_cmd.js', 'tour_skip_hover_cmd.js', 'phone_fwell_cmd.js', 'v15_merge_cmd.js', 'v151_cmd.js'] },                   // 552 + 16 + 44
  { id: 'tour-audit-phone', suites: ['tour_audit_cmd.js#phone'] },                                          // 557
  { id: 'tour-audit-desktop', suites: ['tour_audit_cmd.js#desktop'] },                                      // 612
  // ([#465] raw TeX on screen, a language a run)
  { id: 'raw-tex', suites: ['raw_tex_cmd.js#en', 'raw_tex_cmd.js#ru', 'raw_tex_cmd.js#it'] },
  { id: 'i18n', suites: ['i18n_cmd.js', 'v15_phone_cmd.js', 'phone_swap_cmd.js#lang'] },                    // 334 + 164 + 112
  { id: 'i18n-desktop', suites: ['i18n_walk_cmd.js#1440'] },                                                // 693
  { id: 'i18n-phone', suites: ['i18n_walk_cmd.js#390-dark'] },                                              // 601
  { id: 'phone-swap-1', suites: ['phone_swap_cmd.js#deform', 'phone_swap_cmd.js#views'] },                  // 379 + 326
  { id: 'phone-swap-2', suites: ['phone_swap_cmd.js#sheet', 'phone_swap_cmd.js#rotate', 'phone_swap_cmd.js#sphere'] },   // 333 + 242 + 205
  { id: 'phone-swap-3', suites: ['phone_swap_cmd.js#swap', 'phone_swap_cmd.js#review', 'phone_swap_cmd.js#urlbar', 'phone_swap_cmd.js#tablet', 'phone_landscape_cmd.js', 'phone_sheets_cmd.js', 'phone_sheet_target_cmd.js'] },   // 227 + 256 + 197 + 39
  { id: 'formulas', suites: ['split_cmd.js', 'fix152_cmd.js', 'v15_planemenu_cmd.js', 'warm_bar_cmd.js', 'dh_cmd.js'] },     // 287 + 113 + 75 + 70
  { id: 'images', suites: ['curves_cmd.js', 'p3_accept_cmd.js', 'p3bfix_cmd.js', 'p3b_accept_cmd.js', 'morphfig_cmd.js', 'line_slice_cmd.js'] },   // 226 + 176 + 47 + 31 + 52
  { id: 'views', suites: ['steps_view_cmd.js', 'mv_views_cmd.js', 'p3_review_cmd.js', 'v15_desktop_cmd.js', 'kbd_nav_cmd.js', 'poly_verts_cmd.js', 'mode_chips_cmd.js', 'chip_clamp_cmd.js', 'v15_params_cmd.js', 'zp_cmd.js', 'zpfix_cmd.js', 'display_inline_cmd.js', 'land_cards_cmd.js', 'sphere_light_cmd.js', 'overlay_ghost_cmd.js', 'steps_names_cmd.js', 'steps_width_cmd.js', 'layout_483_cmd.js', 'toasts_515_cmd.js', 'steps_head_cmd.js', 'regions_phase_cmd.js'] },   // 201 + 83 + 96 + 60 + 57 + 26; land_cards_cmd 128; sphere_light_cmd 36 locally (SwiftShader); overlay_ghost_cmd 17 without its opt-in cold loads; steps_width_cmd 60
  { id: 'exact', suites: ['p5_accept_cmd.js', 'link_standin_cmd.js'] },                                   // 543 + 24
  // (v16.5's suites, the seventh run's times)
  { id: 'ux165-1', suites: ['ux165_learn_cmd.js', 'ux165_rail_cmd.js', 'ux165_chain_cmd.js', 'd1_replace_cmd.js'] },            // 210 + 172 + 116
  { id: 'ux165-2', suites: ['ux165_phone_cmd.js', 'ux165_plane_cmd.js', 'key_popup_cmd.js', 'ux165_merge_cmd.js', 'ux165_fix_cmd.js', 'chain_row_cmd.js', 'phone_ctx_tex_cmd.js', 'phone_ctx_slide_cmd.js', 'phone_palette_cmd.js', 'phone_glide_cmd.js', 'phone_glide_export_cmd.js'] },   // 149 + 108 + 130 (key_popup) + 70 + 63 (it threw)
  // (the smoke suite: every tier that runs browser suites runs it too, ci/impact.js; 34 s locally)
  // (#470: the layout checks; en 376 points in 11 min on SwiftShader in a sandbox, both views; ru and it 3 sizes each)
  { id: 'layout-1', suites: ['layout_invariants_cmd.js#en'] },
  { id: 'layout-2', suites: ['layout_invariants_cmd.js#ru', 'layout_invariants_cmd.js#it'] },
  { id: 'smoke', suites: ['smoke_cmd.js'] },
  { id: 'new', rest: true, suites: [], what: 'every suite not listed in another shard' },
];

const ROOT = path.join(__dirname, '..');
const fileOf = (e) => e.split('#')[0];
function runnable() {
  const { EXCLUDED } = require('./browser_suites');
  return fs.readdirSync(path.join(ROOT, 'test')).filter((f) => /_cmd\.js$/.test(f) && !EXCLUDED[f]).sort();
}
// the entries ('file' or 'file#label') of shard id, of the given runnable suites (default: test/*_cmd.js less the
// excluded)
function suitesOf(id, suites = runnable()) {
  const s = SHARDS.find((x) => x.id === id);
  if (!s) throw new Error(`no browser shard ${id}: ${SHARDS.map((x) => x.id).join(', ')}`);
  if (!s.rest) return s.suites.filter((e) => suites.includes(fileOf(e)));
  const listed = new Set(SHARDS.flatMap((x) => x.suites.map(fileOf)));
  return suites.filter((f) => !listed.has(f));
}
function check() {
  const { EXCLUDED, SUITES } = require('./browser_suites');
  const bad = [], gone = [], seen = new Map();
  const files = new Set(fs.readdirSync(path.join(ROOT, 'test')));
  for (const s of SHARDS) for (const e of s.suites) {
    const [f, label] = e.split('#');
    const labels = ((SUITES[f] && SUITES[f].runs) || [{}]).map((r) => r.label);
    for (const k of label ? [e, f] : [f, ...labels.filter(Boolean).map((l) => `${f}#${l}`)]) if (seen.has(k)) bad.push(`${e}: in ${seen.get(k)} and ${s.id}`);
    seen.set(e, s.id);
    if (EXCLUDED[f]) bad.push(`${e}: in ${s.id} and excluded (${EXCLUDED[f]})`);
    if (label && !labels.includes(label)) bad.push(`${e}: ${f} has no run ${label} (ci/browser_suites.js)`);
    if (!files.has(f)) gone.push(`${e} (${s.id})`);
  }
  // a suite listed by its runs has every run in a shard
  for (const f of new Set([...seen.keys()].filter((e) => e.includes('#')).map(fileOf))) {
    for (const r of (SUITES[f] && SUITES[f].runs) || []) if (!seen.has(`${f}#${r.label}`)) bad.push(`${f}#${r.label}: in no shard`);
  }
  return { bad, gone };
}

if (require.main === module) {
  const [cmd, a1] = process.argv.slice(2);
  const i = process.argv.indexOf('--only');
  const only = i > 0 ? process.argv[i + 1].split(',').map((s) => s.trim()).filter(Boolean) : null;
  if (cmd === 'check') {
    const { bad, gone } = check();
    if (gone.length) console.log(`listed in a shard but not in test/ (ignored): ${gone.join(', ')}`);
    if (bad.length) { console.error('browser suites not in exactly one shard (ci/browser_shards.js):\n  ' + bad.join('\n  ')); process.exit(1); }
    const n = runnable().length, rest = suitesOf(SHARDS.find((s) => s.rest).id);
    console.log(`every one of ${n} browser suites is in exactly one of ${SHARDS.length} shards${rest.length ? `; in the catch-all shard: ${rest.join(', ')}` : ''}`);
  } else if (cmd === 'list') {
    console.log(suitesOf(a1).join('\n'));
  } else if (cmd === 'matrix') {
    console.log(JSON.stringify(SHARDS.filter((s) => (!only || only.includes(s.id)) && suitesOf(s.id).length).map((s) => s.id)));
  } else { console.error('usage: node ci/browser_shards.js matrix|list ID|check'); process.exit(2); }
}
module.exports = { SHARDS, suitesOf, check };
