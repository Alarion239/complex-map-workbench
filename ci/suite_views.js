'use strict';
// (#620, K1 item 1) Which view each browser suite tests, for the switch-over to the steps view. The plan is #443 and its
// sub-issues: K1 (#620) ports the suites and the exports, K2 makes the steps view the default, K3 deletes the classic
// views. Every runnable suite (ci/browser_shards.js) has exactly one entry; `node ci/browser_shards.js check` fails
// without one. The kit pins every page to the classic view unless its URL asks for ?view=steps
// (test/cdp_kit/pin_view.js), so a suite tagged port or classic runs classic.
//   steps()               opens the steps view itself (its URL has ?view=steps; some check the classic view too)
//   steps({ pin: true })  a ported suite: ci/browser.js runs it with CMW_VIEW=steps, so the kit opens every page it loads
//                         in the steps view, with no change to its URLs (a page asking ?view=classic keeps the classic one).
//                         Porting a suite is this tag, plus its assertions retargeted to what the steps view shows
//   port(area, note)      tests behaviour the steps view has (or K1 adds: the note says which item): it must run
//                         against the steps view; area is the worker group that ports it (#620's breakdown)
//   classic(why)          tests a part of the classic views that the steps view replaces: it stays pinned to the classic
//                         view until K3 deletes that part, and goes with it
// Areas: interact (the plane, the thread, editing, the keyboard), phone, words (the tour, the examples' lines, the
// languages), export, geometry (constructions, sheets), render (the GPU pictures, regions, globes), sound, engine (no
// view of its own: dropping the pin is the port).
//   node ci/suite_views.js            the port list grouped by area, and the classic-only list with reasons
const steps = (o = {}) => ({ view: 'steps', pin: !!o.pin });
const port = (area, note) => ({ view: 'port', area, note: note || '' });
const classic = (why) => ({ view: 'classic', why });
const AREAS = ['interact', 'phone', 'words', 'export', 'geometry', 'render', 'sound', 'engine'];

const VIEWS = {
  // already in the steps view
  'example_lane_cut_cmd.js': steps(),
  'pin_view_cmd.js': steps({ pin: true }),   // (the pin itself: it opens no URL that names the steps view)
  'example_try_sv_cmd.js': steps(),
  'layout_invariants_cmd.js': steps(),
  'phone_ctx_slide_cmd.js': steps(),
  'phone_edit_head_cmd.js': steps(),
  'phone_landscape_cmd.js': steps(),
  'phone_palette_cmd.js': steps(),
  'steps_carry_cmd.js': steps(),
  'steps_chain_cmd.js': steps(),
  'steps_curves_cmd.js': steps(),
  'steps_head_cmd.js': steps(),
  'steps_labels_cmd.js': steps(),
  'steps_long_549_cmd.js': steps(),
  'steps_names_cmd.js': steps(),
  'steps_parked_pan_cmd.js': steps(),
  'steps_play_cmd.js': steps(),
  'steps_view_cmd.js': steps(),
  'steps_width_cmd.js': steps(),
  'sv_curve_menu_cmd.js': steps(),
  'sv_globe_mask_cmd.js': steps(),
  'sv_state_cmd.js': steps(),
  'toasts_515_cmd.js': steps(),
  'tour_planes_cmd.js': steps(),

  // the classic views' own parts, pinned until K3
  'card_canvas_cmd.js': classic('the chain cards\' thumbnails: the steps view has the thread, no card row'),
  'card_resize_cmd.js': classic('the chain cards during a resize: no card row in the steps view'),
  'chain_row_cmd.js': classic('the phone\'s chain bar with Deformation and its glide: the steps view\'s phone has the strip'),
  'clear_chain_open_cmd.js': classic('the classic chain head beside the floating Inspector (it names the classic view)'),
  'deform_range_cmd.js': classic('the Deformation bracket over the card row: the thread\'s range is steps_play_cmd\'s'),
  'header_layout_cmd.js': classic('the top bar\'s view tabs (X → Y | Phase | Landscape), which K3 deletes'),
  'land_cards_cmd.js': classic('the Landscape step cards: no card row in the steps view'),
  'layout_483_cmd.js': classic('its fixes are the classic layout\'s: the panes\' tabs, the chain connector, the Deformation bracket and dock; layout_invariants_cmd covers the steps view'),
  'mv_views_cmd.js': classic('the merged X → Y / Phase / Landscape views and their switch, which the steps view replaces'),
  'pane_heads_1024_cmd.js': classic('the two pane heads and the chain head at 1024 px; steps_head_cmd covers the steps view\'s one head'),
  'phone_glide_cmd.js': classic('the phone\'s ‹ › glide of Y between X and Y: the steps view glides its one plane (steps_view_cmd)'),
  'phone_swap_cmd.js': classic('the phone\'s two planes keeping their views: the steps view has one plane'),
  'ux165_chain_cmd.js': classic('v16.5\'s fixes of the chain cards and the chain head'),
  'v15_desktop_cmd.js': classic('the cards following the view switch (X → Y, Phase, Landscape, the Deformation)'),
  'v15_phone_cmd.js': classic('the phone\'s X | Y layout and its chain bar; the steps view\'s phone is in the phone suites and layout_invariants_cmd'),
  'example_try_cmd.js': classic('its line is "press Deformation"; the steps view\'s Try lines are example_try_sv_cmd\'s'),

  // to port: interact
  'a11y_axe_cmd.js': port('interact'),
  'chip_clamp_cmd.js': port('interact'),
  'complex_point_cmd.js': port('interact'),
  'complex_params_cmd.js': port('interact'),
  'custom_show_cmd.js': port('interact', 'F\'s well: after K1 item 9 (the F chip)'),
  'd1_replace_cmd.js': port('interact'),
  'display_inline_cmd.js': port('interact'),
  'field_settle_cmd.js': port('interact'),
  'kbd_nav_cmd.js': port('interact', 'F6\'s areas are X, Y, chain, Inspector today'),
  'key_popup_cmd.js': port('interact'),
  'mode_chips_cmd.js': port('interact'),
  'param_planes_cmd.js': port('interact'),
  'phase_key_cmd.js': port('interact'),
  'phase_style_cmd.js': steps({ pin: true }),
  'repeat_cmd.js': port('interact'),
  'repeat_settle_cmd.js': steps({ pin: true }),
  'series_edit_cmd.js': port('interact'),
  'series_params_cmd.js': port('interact'),
  'shape_rows_cmd.js': port('interact'),
  'stage_shapes_cmd.js': port('interact'),
  'top_bar_focus_cmd.js': port('interact', 'without the view switch and Deformation in the bar'),
  'ux165_fix_cmd.js': port('interact'),
  'ux165_merge_cmd.js': port('interact'),
  'ux165_plane_cmd.js': port('interact'),
  'v15_merge_cmd.js': port('interact'),
  'v15_params_cmd.js': port('interact'),
  'v15_planemenu_cmd.js': port('interact'),
  'zp_cmd.js': port('interact'),
  'zpfix_cmd.js': port('interact'),
  'deform_nat_cmd.js': port('interact', 'the Paths switch and all at once: after K1 item 5'),

  // to port: phone
  'phone_ctx_tex_cmd.js': port('phone'),
  'phone_focus_margin_cmd.js': port('phone'),
  'phone_fwell_cmd.js': port('phone', 'F\'s well: after K1 item 9'),
  'phone_sheet_target_cmd.js': port('phone'),
  'phone_sheets_cmd.js': port('phone'),
  'phone_toast_chain_cmd.js': port('phone'),
  'ux165_phone_cmd.js': port('phone'),

  // to port: words (the tour after #620 items 3 and 11, the chapters' retargeting)
  'example_cauchy_cmd.js': port('words'),
  'example_params_cmd.js': port('words'),
  'example_try_events_cmd.js': port('words', 'the Try lines left: K1 item 11'),
  'fix152_cmd.js': port('words'),
  'guide_nav_cmd.js': port('words'),
  'i18n_cmd.js': port('words'),
  'i18n_walk_cmd.js': port('words'),
  'raw_tex_cmd.js': port('words'),
  'split_cmd.js': port('words'),
  'tour_audit_cmd.js': port('words', 'every chapter: K1 items 3 and 11'),
  'tour_auto_cmd.js': port('words', 'K1 item 3'),
  'tour_chapters_cmd.js': port('words', 'K1 item 3'),
  'tour_cmd.js': port('words', 'K1 items 3 and 11'),
  'tour_it360_cmd.js': port('words', 'K1 item 3'),
  'tour_lane_cmd.js': port('words', 'K1 item 3'),
  'tour_lit_cmd.js': port('words', 'every step\'s anchor: K1 items 3 and 11'),
  'tour_perf_cmd.js': port('words', 'K1 item 3'),
  'tour_phone_cmd.js': port('words', 'K1 item 3'),
  'tour_skip_hover_cmd.js': port('words', 'K1 item 3'),
  'tour_tasks_cmd.js': port('words', 'the F tile and card tasks: after K1 items 9 and 11'),
  'tour_titles_cmd.js': port('words', 'K1 item 3'),
  'tour_words_cmd.js': port('words', 'K1 item 3'),
  'ux165_learn_cmd.js': port('words'),
  'v151_cmd.js': port('words'),

  // to port: export (K1 items 6 to 8: the shown plane, the filmstrip, the glide)
  'complex_lang_export_cmd.js': port('export', 'K1 item 6'),
  'export_cmd.js': port('export', 'K1 items 6 and 7'),
  'export_fit_cmd.js': port('export'),
  'export_sheet_cmd.js': port('export'),
  'export_tex_cmd.js': port('export', 'K1 item 6'),
  'figure_wait_cmd.js': port('export'),
  'morphfig_cmd.js': port('export', 'the deformation as one picture: K1 item 8 (the glide)'),
  'phone_glide_export_cmd.js': port('export', 'the shown plane: K1 item 6'),

  // to port: geometry
  'between_cmd.js': port('geometry'),
  'constr_cmd.js': port('geometry'),
  'curves_cmd.js': port('geometry'),
  'dh_cmd.js': port('geometry'),
  'fix163_cmd.js': port('geometry'),
  'meetnear_coincide_cmd.js': port('geometry'),
  'perp_cmd.js': port('geometry'),
  'poly_verts_cmd.js': port('geometry'),
  'rel162_sheets_cmd.js': port('geometry', 'All sheets: after K1 item 4'),
  'sheets_deform_cmd.js': port('geometry', 'All sheets in a glide: after K1 item 4'),
  'touch_cmd.js': port('geometry'),
  'ux165_rail_cmd.js': port('geometry'),

  // to port: render
  'cauchy_residue_cmd.js': port('render'),
  'deform_dirichlet_cmd.js': port('render', 'the glide on a Dirichlet series instead of the Deformation click'),
  'land_release_cmd.js': port('render', 'the surface switch instead of the left pane\'s view'),
  'link_standin_cmd.js': port('render'),
  'overlay_ghost_cmd.js': port('render'),
  'p3_accept_cmd.js': port('render'),
  'p3_review_cmd.js': port('render'),
  'p3b_accept_cmd.js': port('render'),
  'p3bfix_cmd.js': port('render'),
  'p5_accept_cmd.js': port('render'),
  'regions_phase_cmd.js': port('render'),
  'sphere_light_cmd.js': port('render'),

  // to port: sound (Pietro's team, #580 and #598)
  'seasong_cmd.js': port('sound'),
  'sound_cmd.js': port('sound'),
  'sound_v152_cmd.js': port('sound'),

  // to port: engine (no view of its own)
  'deform_range_gl_cmd.js': port('engine'),
  'kit_settled_cmd.js': port('engine', 'the kit\'s settled(): a page of its own, no view to test'),
  'line_slice_cmd.js': port('engine'),
  'mj_ranges_cmd.js': port('engine'),
  'offline_cmd.js': port('engine'),
  'smoke_cmd.js': port('engine', 'its view switch to Phase becomes the steps view\'s surface and plane'),
  'warm_bar_cmd.js': port('engine'),
};

// the entries' faults against the runnable suites: a suite with no entry, an entry for no runnable suite, a bad entry,
// and a tag its source contradicts: steps() is what a suite that asks ?view=steps itself is (its source has view=steps),
// so a steps() entry without it, or a port or classic one with it, is wrong (a ported suite, pin: true, needs no URL)
function checkViews(runnable) {
  const fs = require('fs'), path = require('path'), bad = [];
  const asksSteps = (f) => { try { return /view=steps/.test(fs.readFileSync(path.join(__dirname, '..', 'test', f), 'utf8')); } catch (e) { return false; } };
  for (const f of runnable) if (!VIEWS[f]) bad.push(`${f}: no view in ci/suite_views.js (steps, port or classic)`);
  for (const [f, tag] of Object.entries(VIEWS)) {
    if (!runnable.includes(f)) bad.push(`${f}: in ci/suite_views.js but not a runnable suite`);
    if (tag.view === 'port' && !AREAS.includes(tag.area)) bad.push(`${f}: port to an unknown area ${tag.area} (${AREAS.join(', ')})`);
    if (tag.view === 'classic' && !tag.why) bad.push(`${f}: classic-only without a reason`);
    if (!['steps', 'port', 'classic'].includes(tag.view)) bad.push(`${f}: unknown view ${tag.view}`);
    if (!runnable.includes(f)) continue;
    if (tag.view === 'steps' && !tag.pin && !asksSteps(f)) bad.push(`${f}: steps() but its source never asks ?view=steps (a port is steps({ pin: true }))`);
    if (tag.view !== 'steps' && asksSteps(f)) bad.push(`${f}: ${tag.view}, but its source asks ?view=steps: it is steps()`);
  }
  return bad;
}

if (require.main === module) {
  const by = (view) => Object.entries(VIEWS).filter(([, tag]) => tag.view === view);
  console.log(`areas: ${AREAS.join(', ')}`);
  console.log(`steps (${by('steps').length}): ${by('steps').map(([f]) => f).join(', ')}`);
  for (const a of AREAS) {
    const inArea = by('port').filter(([, tag]) => tag.area === a);
    if (inArea.length) console.log(`port, ${a} (${inArea.length}):\n${inArea.map(([f, tag]) => `  ${f}${tag.note ? ` (${tag.note})` : ''}`).join('\n')}`);
  }
  console.log(`classic until K3 (${by('classic').length}):\n${by('classic').map(([f, tag]) => `  ${f}: ${tag.why}`).join('\n')}`);
}
module.exports = { VIEWS, checkViews };
