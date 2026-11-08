'use strict';
// The browser suites (ci/browser.js) split into shards, each one CI job on GitHub's Linux machines of about 15 minutes
// (the measured times: ci/README.md). Every suite that runs is in exactly one shard: a suite listed in no shard (a new
// one, e.g. v16.5's test/ux165_*_cmd.js) runs in the shard `new`, so none is left out; move it to a shard once its time
// is known. `node ci/browser_shards.js check` fails when a suite is listed twice, or is listed and excluded
// (ci/browser_suites.js EXCLUDED), or has no view in ci/suite_views.js (#620: steps, port or classic-only); a listed
// file that no longer exists is only reported.
//   node ci/browser_shards.js matrix [--only id,id]   the shard ids with at least one suite, as a JSON array
//   node ci/browser_shards.js list ID                  one shard's suites (and runs)
//   node ci/browser_shards.js check                    every suite in exactly one shard, and with a view
const fs = require('fs');
const path = require('path');

// (a suite's runs, SUITES[f].runs in ci/browser_suites.js, may go to different shards: 'file#label')
const SHARDS = [
  // (seconds of suite time on lavapipe, the fourth run of pull request #7; a job adds about a minute)
  { id: 'perp', suites: ['perp_cmd.js', 'fix163_cmd.js'] },                                                  // 447 + 233 + 356 (fix163: steps, classic)
  // (export_cmd.js and export_deform_cmd.js: the fifth run's times)
  { id: 'export-1', suites: ['export_cmd.js#1-3', 'export_cmd.js#user5', 'export_sheet_cmd.js', 'figure_wait_cmd.js'] },                                // 453 + 265
  // (#429: 4a was one 22-23 min job, the longest of a T3 run: its figures and its videos are two jobs)
  { id: 'export-2', suites: ['export_deform_classic_cmd.js#4a-fig', 'export_deform_cmd.js#video', 'export_tex_cmd.js', 'export_cmd.js#user5-classic', 'export_cmd.js#user5-deform'] },
  { id: 'export-4', suites: ['export_deform_classic_cmd.js#4a-vid', 'export_deform_cmd.js#dialog', 'export_steps_cmd.js', 'export_glide_cmd.js', 'export_two_planes_cmd.js', 'export_two_planes_dialog_cmd.js'] },                                                       // + 222
  { id: 'export-3', suites: ['export_deform_classic_cmd.js#preview', 'export_deform_classic_cmd.js#4b', 'export_deform_cmd.js#preview'] },                               // 571 + 167
  // (480 + 295, with meetnear_coincide and between: 5 + 23)
  { id: 'constructions', suites: ['constr_cmd.js', 'touch_cmd.js', 'meetnear_coincide_cmd.js', 'between_cmd.js'] },
  { id: 'deform', suites: ['sheets_deform_cmd.js', 'deform_range_cmd.js', 'deform_nat_cmd.js', 'deform_range_gl_cmd.js', 'rel162_sheets_cmd.js', 'deform_dirichlet_cmd.js'] },   // 340 + 292 + 114 + 22 + 24 + about 30
  { id: 'sound', suites: ['sound_cmd.js', 'sound_v152_cmd.js', 'sound_v152_deform_classic_cmd.js', 'seasong_cmd.js'] },                         // 214 + 104 + 98
  { id: 'tour', suites: ['tour_cmd.js', 'tour_cmd_classic_cmd.js', 'tour_titles_cmd.js', 'tour_chapters_cmd.js', 'tour_lane_cmd.js', 'guide_nav_cmd.js', 'example_params_cmd.js', 'example_cauchy_cmd.js', 'tour_auto_cmd.js', 'tour_auto_classic_cmd.js', 'tour_tasks_cmd.js', 'tour_tasks_classic_cmd.js', 'tour_lit_cmd.js', 'tour_perf_cmd.js'] },        // 235 + 312 + 135 + 50
  { id: 'tour-phone', suites: ['tour_phone_cmd.js', 'tour_phone_classic_cmd.js', 'tour_skip_hover_cmd.js', 'phone_fwell_cmd.js', 'v15_merge_cmd.js', 'v151_cmd.js', 'tour_it360_cmd.js'] },                   // 552 + 16 + 44
  { id: 'tour-audit-phone', suites: ['tour_audit_cmd.js#phone', 'example_lane_cut_cmd.js'] },               // 557
  { id: 'tour-audit-desktop', suites: ['tour_audit_cmd.js#desktop'] },                                      // 612
  // ([#465] raw TeX on screen, a language a run)
  { id: 'raw-tex', suites: ['raw_tex_cmd.js#en', 'raw_tex_cmd.js#ru', 'raw_tex_cmd.js#it', 'raw_tex_classic_cmd.js#en', 'raw_tex_classic_cmd.js#ru', 'raw_tex_classic_cmd.js#it'] },
  { id: 'i18n', suites: ['i18n_cmd.js', 'i18n_classic_cmd.js', 'v15_phone_cmd.js', 'phone_swap_cmd.js#lang', 'phone_plane_cmd.js#lang'] },                    // 334 + 164 + 112 + 21
  { id: 'i18n-desktop', suites: ['i18n_walk_cmd.js#1440'] },                                                // 693
  { id: 'i18n-phone', suites: ['i18n_walk_cmd.js#390-dark'] },                                              // 601
  { id: 'phone-swap-1', suites: ['phone_swap_cmd.js#deform', 'phone_swap_cmd.js#views', 'phone_toast_chain_cmd.js'] },   // 379 + 326 + 37
  { id: 'phone-swap-2', suites: ['phone_swap_cmd.js#sheet', 'phone_swap_cmd.js#rotate', 'phone_plane_cmd.js#sheet', 'phone_plane_cmd.js#rotate', 'phone_swap_cmd.js#sphere', 'phone_focus_margin_cmd.js'] },   // 333 + 242 + 205
  { id: 'phone-swap-3', suites: ['phone_swap_cmd.js#swap', 'phone_swap_cmd.js#review', 'phone_swap_cmd.js#urlbar', 'phone_swap_cmd.js#tablet', 'phone_plane_cmd.js#urlbar', 'phone_plane_cmd.js#tablet', 'phone_landscape_cmd.js', 'phone_sheets_cmd.js', 'phone_sheet_target_cmd.js', 'phone_edit_head_cmd.js'] },   // 227 + 256 + 197 + 39 + 60 (phone_plane urlbar and tablet, as timed locally)
  { id: 'formulas', suites: ['split_cmd.js', 'fix152_cmd.js', 'v15_planemenu_cmd.js', 'warm_bar_cmd.js', 'dh_cmd.js', 'split_deform_cmd.js', 'steps_split_remap_cmd.js'] },     // 287 + 113 + 30 + 75 + 70
  { id: 'images', suites: ['globe_release_cmd.js', 'curves_cmd.js', 'curves_target_cmd.js', 'curves_outline_off_cmd.js', 'curves_target_legend_cmd.js', 'curves_target_legend_classic_cmd.js', 'curves_target_areas_cmd.js', 'p3_accept_cmd.js', 'p3_accept_steps_cmd.js', 'p3bfix_cmd.js', 'p3b_accept_cmd.js', 'morphfig_cmd.js', 'morphfig_classic_cmd.js', 'line_slice_cmd.js', 'sv_globe_draw_cmd.js', 'sv_construct_plane_cmd.js', 'curves_areas_guard_cmd.js', 'sv_globe_edit_cmd.js', 'sv_globe_stage_shape_cmd.js', 'shape_stroke_cmd.js', 'sv_all_sheets_cmd.js', 'steps_seams_cmd.js'] },   // 226 (curves: 294 in the steps view and 226 in the classic view, with the target suite beside it) + 176 + 47 + 31 + 52
  // (the steps view and the classic views in three parts of about 16 minutes each, balanced by the hosted suite times: as one
  // job of about 50 minutes they would be the longest job of every run that selects them)
  { id: 'views-1', suites: ['steps_empty_cmd.js', 'p3_review_cmd.js', 'p3_review_classic_cmd.js', 'chip_clamp_cmd.js', 'v15_params_cmd.js', 'zpfix_cmd.js', 'overlay_ghost_cmd.js', 'layout_483_cmd.js', 'steps_head_cmd.js', 'tour_planes_cmd.js', 'example_try_sv_cmd.js', 'sv_curve_menu_cmd.js', 'steps_carry_inregion_cmd.js', 'steps_carry_far_cmd.js', 'steps_fill_points_cmd.js', 'sv_globe_net_cmd.js', 'steps_ru_keys_cmd.js', 'steps_sheet_dedupe_cmd.js', 'steps_link_wait_cmd.js', 'steps_rim_inverse_cmd.js', 'zeta_logk_cmd.js'] },   // 992
  { id: 'views-2', suites: ['steps_chain_cmd.js', 'sv_cut_drag_both_cmd.js', 'steps_play_cmd.js', 'kbd_nav_cmd.js', 'display_inline_cmd.js', 'toasts_515_cmd.js', 'steps_parked_pan_cmd.js', 'steps_labels_cmd.js', 'steps_curves_cmd.js', 'zp_classic_cmd.js', 'regions_phase_classic_cmd.js', 'steps_paths_cmd.js', 'steps_paths_caption_cmd.js', 'steps_glide_cost_cmd.js', 'steps_sm_standin_cmd.js', 'steps_glstatus_cmd.js', 'steps_glide_inverse_cmd.js', 'steps_newton_complete_everywhere_cmd.js', 'steps_glide_linkhold_cmd.js', 'steps_glide_strokes_cmd.js', 'steps_sphere_glide_cmd.js', 'sv_cut_curve_cmd.js', 'steps_land_glide_sheets_cmd.js', 'steps_sphere_carry_cmd.js', 'steps_sphere_cayley_cmd.js', 'steps_sphere_look_cmd.js', 'steps_sphere_cut_cmd.js', 'steps_sphere_rest_cmd.js', 'sv_cut_curve_sphere_cmd.js', 'sv_cut_ring_dash_cmd.js', 'steps_glide_later_cmd.js', 'sv_land_sin_sheets_cmd.js', 'steps_walk_cmd.js', 'steps_linkhold_chain_cmd.js', 'sv_cut_keeps_view_cmd.js', 'steps_land_footprint_fig_cmd.js', 'steps_paths_sphere_cmd.js', 'steps_paths_sphere_fig_cmd.js'] },   // 991
  { id: 'views-3', suites: ['steps_view_cmd.js', 'steps_fchip_cmd.js', 'poly_verts_cmd.js', 'mode_chips_cmd.js', 'zp_cmd.js', 'sphere_light_cmd.js', 'steps_names_cmd.js', 'steps_width_cmd.js', 'steps_long_549_cmd.js', 'regions_phase_cmd.js', 'steps_order_cmd.js', 'steps_repeat_cmd.js', 'steps_land_glide_cmd.js', 'steps_land_3d_cmd.js', 'steps_land_inregions_cmd.js', 'steps_glide_black_cmd.js', 'steps_land_chrome_cmd.js', 'steps_land_sheets_h_cmd.js', 'steps_land_head_cmd.js', 'steps_land_poles_cmd.js', 'steps_land_specks_cmd.js', 'steps_land_far_cmd.js', 'steps_strip_layout_cmd.js', 'steps_land_cover_cmd.js', 'steps_plane_key_cmd.js', 'steps_foot_note_order_cmd.js', 'steps_cauchy_cmd.js', 'steps_inregions_pending_cmd.js', 'font_late_cmd.js', 'steps_cauchy_parts_cmd.js', 'steps_land_footprint_cmd.js', 'steps_phone_key_cmd.js'] },   // 990
  { id: 'exact', suites: ['p5_accept_cmd.js', 'link_standin_cmd.js', 'svready_cmd.js'] },                                   // 543 + 24
  // (v16.5's suites, the seventh run's times)
  { id: 'ux165-1', suites: ['ux165_learn_cmd.js', 'ux165_learn_classic_cmd.js', 'ux165_learn_phone_classic_cmd.js', 'ux165_learn_first_run_cmd.js', 'ux165_learn_sound_cmd.js', 'ux165_rail_cmd.js', 'd1_replace_cmd.js', 'ux165_plane_classic_cmd.js'] },            // 210 + 169 + 195 (ux165_rail: the steps view and the classic view) + 116
  { id: 'ux165-2', suites: ['ux165_phone_cmd.js', 'ux165_phone_classic_cmd.js', 'ux165_plane_cmd.js', 'key_popup_cmd.js', 'ux165_merge_cmd.js', 'ux165_fix_cmd.js', 'phone_ctx_tex_cmd.js', 'phone_ctx_slide_cmd.js', 'phone_palette_cmd.js', 'ux165_merge_classic_cmd.js', 'phone_export_steps_cmd.js'] },   // 149 (ux165_phone and ux165_phone_classic together) + 108 + 130 (key_popup) + 70 + 63 (it threw)
  // (the smoke suite: every tier that runs browser suites runs it too, ci/impact.js; 34 s locally)
  // (#470: the layout checks; en 376 points in 11 min on SwiftShader in a sandbox, both views; ru and it 3 sizes each)
  { id: 'layout-1', suites: ['layout_invariants_cmd.js#en'] },
  { id: 'layout-2', suites: ['layout_invariants_cmd.js#ru', 'layout_invariants_cmd.js#it'] },
  { id: 'smoke', suites: ['smoke_cmd.js'] },
  // (the browser suites no area shard lists, in three parts of about 8 minutes each, balanced by their hosted suite times)
  { id: 'misc-1', suites: ['i18n_walk_steps_cmd.js', 'pane_heads_1024_cmd.js', 'phase_key_cmd.js', 'complex_point_cmd.js', 'a11y_axe_cmd.js', 'steps_colour_pick_cmd.js', 'steps_colour_parity_cmd.js', 'steps_drawplane_cmd.js', 'steps_opacity_cmd.js', 'steps_opacity_mesh_cmd.js', 'tour_words_classic_cmd.js', 'field_settle_cmd.js', 'complex_lang_export_cmd.js', 'example_try_events_cmd.js', 'repeat_settle_cmd.js', 'top_bar_focus_cmd.js', 'steps_rail_fit_cmd.js', 'pin_view_cmd.js', 'steps_stage_handles_cmd.js', 'steps_regions_note_cmd.js', 'steps_sheet_grid_cmd.js'] },
  { id: 'misc-2', suites: ['steps_glide_look_cmd.js', 'cauchy_residue_cmd.js', 'export_fit_cmd.js', 'steps_listen_cmd.js', 'sv_globe_mask_cmd.js', 'land_release_cmd.js', 'steps_readout_cmd.js', 'steps_why_cmd.js', 'repeat_cmd.js', 'tour_words_cmd.js', 'phone_fmap_cmd.js', 'mj_ranges_cmd.js', 'param_planes_cmd.js', 'steps_carry_cmd.js', 'kit_seed_cmd.js'] },
  { id: 'misc-3', suites: ['sv_state_cmd.js', 'steps_statekeys_cmd.js', 'steps_dcgrid_cmd.js', 'steps_link_migrate_cmd.js', 'phase_style_cmd.js', 'custom_show_cmd.js', 'example_try_repeat_cmd.js', 'complex_params_cmd.js', 'steps_arrows_cmd.js', 'steps_shapekeys_cmd.js', 'series_edit_cmd.js', 'series_params_cmd.js', 'stage_shapes_cmd.js', 'shape_rows_cmd.js', 'offline_cmd.js', 'steps_chipname_cmd.js', 'kit_settled_cmd.js', 'kit_ev_cmd.js', 'steps_classic_fixture_cmd.js'] },
  { id: 'new', rest: true, suites: [], what: 'every suite not listed in another shard' }];

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
  // (#620) every runnable suite says which view it tests (ci/suite_views.js)
  bad.push(...require('./suite_views').checkViews(runnable()));
  return { bad, gone };
}

if (require.main === module) {
  const [cmd, a1] = process.argv.slice(2);
  const i = process.argv.indexOf('--only');
  const only = i > 0 ? process.argv[i + 1].split(',').map((s) => s.trim()).filter(Boolean) : null;
  if (cmd === 'check') {
    const { bad, gone } = check();
    if (gone.length) console.log(`listed in a shard but not in test/ (ignored): ${gone.join(', ')}`);
    if (bad.length) { console.error('browser suites not in exactly one shard (ci/browser_shards.js), or with no view (ci/suite_views.js):\n  ' + bad.join('\n  ')); process.exit(1); }
    const n = runnable().length, rest = suitesOf(SHARDS.find((s) => s.rest).id);
    console.log(`every one of ${n} browser suites is in exactly one of ${SHARDS.length} shards${rest.length ? `; in the catch-all shard: ${rest.join(', ')}` : ''}`);
  } else if (cmd === 'list') {
    console.log(suitesOf(a1).join('\n'));
  } else if (cmd === 'matrix') {
    console.log(JSON.stringify(SHARDS.filter((s) => (!only || only.includes(s.id)) && suitesOf(s.id).length).map((s) => s.id)));
  } else { console.error('usage: node ci/browser_shards.js matrix|list ID|check'); process.exit(2); }
}
module.exports = { SHARDS, suitesOf, check };
