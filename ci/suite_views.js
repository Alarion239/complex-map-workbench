'use strict';
// Which view each browser suite tests: the steps view (the page's default), or the classic views, which stay reachable by ?view=classic (#621).
// Every runnable suite (ci/browser_shards.js) has exactly one entry; `node ci/browser_shards.js check` fails without
// one. The kit opens every page in the steps view unless its URL asks for ?view=classic (test/cdp_kit/pin_view.js);
// ci/browser.js runs a suite tagged port or classic with CMW_VIEW=classic, so it runs classic.
//   steps()               runs in the steps view (some check the classic view too, by ?view=classic)
//   steps({ pin: true })  a ported suite: its URLs name no view and open in the steps view (a page asking ?view=classic
//                         keeps the classic one).
//                         Porting a suite is this tag, plus its assertions retargeted to what the steps view shows
//   port(area, note)      tests behaviour the steps view has, or will have (the note says what it waits on): it must
//                         run against the steps view; area is the worker group that ports it (#620's breakdown)
//   classic(why)          tests a part of the classic views that the steps view does not have: it stays pinned to the
//                         classic view, which keeps that part
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
  'sv_cut_curve_cmd.js': steps(),
  'sv_cut_drag_both_cmd.js': steps(),
  'sv_cut_keeps_view_cmd.js': steps(),
  'sv_cut_curve_sphere_cmd.js': steps(),
  'sv_cut_ring_dash_cmd.js': steps(),
  'pin_view_cmd.js': steps({ pin: true }),   // (the pin itself: it opens no URL that names the steps view)
  'example_try_sv_cmd.js': steps(),
  'export_steps_cmd.js': steps(),
  'export_two_planes_cmd.js': steps(),
  'export_two_planes_dialog_cmd.js': steps(),
  'export_glide_cmd.js': steps(),
  'layout_invariants_cmd.js': steps(),
  'phone_ctx_slide_cmd.js': steps(),
  'phone_edit_head_cmd.js': steps({ pin: true }),
  'phone_fmap_cmd.js': steps(),
  'phone_export_steps_cmd.js': steps(),
  'phone_landscape_cmd.js': steps(),
  'phone_palette_cmd.js': steps(),
  'steps_carry_cmd.js': steps(),
  'steps_carry_inregion_cmd.js': steps(),
  'steps_carry_far_cmd.js': steps(),
  'steps_carry_exact_cmd.js': steps(),
  'steps_rim_inverse_cmd.js': steps(),
  'steps_fill_points_cmd.js': steps(),
  'steps_link_wait_cmd.js': steps(),
  'steps_link_migrate_cmd.js': steps({ pin: true }),
  'steps_classic_fixture_cmd.js': steps({ pin: true }),
  'steps_seams_cmd.js': steps(),
  'steps_region_centre_cmd.js': steps(),
  'steps_glide_cost_cmd.js': steps(),
  'steps_land_glide_cmd.js': steps(),
  'steps_land_glide_sheets_cmd.js': steps(),
  'steps_land_head_cmd.js': steps(),
  'sv_land_sin_sheets_cmd.js': steps(),
  'steps_sheet_dedupe_cmd.js': steps(),
  'steps_land_inregions_cmd.js': steps(),
  'steps_land_footprint_cmd.js': steps(),
  'steps_inregions_pending_cmd.js': steps(),
  'steps_land_3d_cmd.js': steps(),
  'steps_land_specks_cmd.js': steps({ pin: true }),
  'steps_land_plaster_cmd.js': steps({ pin: true }),
  'steps_land_poles_cmd.js': steps(),
  'steps_land_far_cmd.js': steps(),
  'steps_land_box_cmd.js': steps({ pin: true }),
  'steps_land_cover_cmd.js': steps(),
  'steps_land_sheets_h_cmd.js': steps(),
  'steps_land_chrome_cmd.js': steps(),
  'steps_glstatus_cmd.js': steps(),
  'steps_glide_linkhold_cmd.js': steps(),
  'steps_linkhold_chain_cmd.js': steps(),
  'steps_sm_standin_cmd.js': steps(),
  'steps_glide_mask_carry_cmd.js': steps(),
  'steps_glide_look_cmd.js': steps({ pin: true }),
  'steps_glide_black_cmd.js': steps({ pin: true }),
  'steps_glide_strokes_cmd.js': steps({ pin: true }),
  'steps_glide_later_cmd.js': steps({ pin: true }),
  'steps_chain_cmd.js': steps(),
  'steps_walk_cmd.js': steps({ pin: true }),
  'steps_split_remap_cmd.js': steps({ pin: true }),
  'steps_split_all_cmd.js': steps({ pin: true }),
  'steps_curves_cmd.js': steps(),
  'steps_empty_cmd.js': steps(),
  'steps_head_cmd.js': steps(),
  'steps_listen_cmd.js': steps({ pin: true }),
  'steps_why_cmd.js': steps(),
  'steps_labels_cmd.js': steps(),
  'steps_long_549_cmd.js': steps(),
  'steps_names_cmd.js': steps(),
  'steps_chipname_cmd.js': steps(),
  'steps_rail_fit_cmd.js': steps(),
  'steps_fchip_cmd.js': steps(),
  'steps_colour_pick_cmd.js': steps(),
  'steps_colour_parity_cmd.js': steps(),
  'steps_sheet_grid_cmd.js': steps({ pin: true }),
  'steps_opacity_cmd.js': steps(),
  'steps_opacity_mesh_cmd.js': steps(),
  'steps_mesh_tie_cmd.js': steps(),
  'steps_exact_switch_cmd.js': steps(),
  'steps_drawplane_cmd.js': steps(),
  'steps_readout_cmd.js': steps(),
  'steps_regions_note_cmd.js': steps({ pin: true }),
  'steps_order_cmd.js': steps(),
  'steps_repeat_cmd.js': steps(),
  'steps_parked_pan_cmd.js': steps(),
  'steps_paths_cmd.js': steps({ pin: true }),
  'steps_land_footprint_fig_cmd.js': steps({ pin: true }),
  'steps_paths_caption_cmd.js': steps({ pin: true }),
  'steps_glide_inverse_cmd.js': steps(),
  'steps_glide_label_cmd.js': steps(),
  'steps_newt_everywhere_cmd.js': steps({ pin: true }),
  'steps_late_links_cmd.js': steps({ pin: true }),
  'sv_globe_net_cmd.js': steps({ pin: true }),
  'steps_play_cmd.js': steps(),
  'steps_ru_keys_cmd.js': steps(),
  'toast_keys_cmd.js': steps(),
  'phone_toast_bar_cmd.js': steps(),
  'steps_arrows_cmd.js': steps(),
  'steps_shapekeys_cmd.js': steps(),
  'steps_view_cmd.js': steps(),
  'font_late_cmd.js': steps(),
  'steps_width_cmd.js': steps(),
  'steps_strip_layout_cmd.js': steps(),
  'sv_curve_menu_cmd.js': steps(),
  'sv_globe_mask_cmd.js': steps(),
  'sv_globe_draw_cmd.js': steps(),
  'steps_stage_handles_cmd.js': steps(),
  'steps_sphere_glide_cmd.js': steps(),
  'steps_sphere_carry_cmd.js': steps(),
  'steps_sphere_look_cmd.js': steps(),
  'steps_sphere_rest_cmd.js': steps(),
  'steps_sphere_cayley_cmd.js': steps(),
  'steps_sphere_cut_cmd.js': steps(),
  'sv_globe_edit_cmd.js': steps({ pin: true }),
  'sv_globe_stage_shape_cmd.js': steps({ pin: true }),
  'shape_stroke_cmd.js': steps({ pin: true }),
  'sv_construct_plane_cmd.js': steps(),
  'sv_all_sheets_cmd.js': steps(),
  'sv_state_cmd.js': steps(),
  'steps_statekeys_cmd.js': steps(),
  'steps_keys_frame_cmd.js': steps({ pin: true }),
  'steps_dcgrid_cmd.js': steps(),
  'toasts_515_cmd.js': steps(),
  'tour_planes_cmd.js': steps(),

  // the classic views' own parts, pinned to the classic view
  'deform_range_cmd.js': steps({ pin: true }),
  'layout_483_cmd.js': classic('its fixes are the classic layout\'s: the panes\' tabs, the chain connector, the Deformation bracket and dock; layout_invariants_cmd covers the steps view'),
  'pane_heads_1024_cmd.js': classic('the two pane heads and the chain head at 1024 px; steps_head_cmd covers the steps view\'s one head'),
  'phone_plane_cmd.js': steps({ pin: true }),
  'phone_swap_cmd.js': classic('the phone\'s two planes keeping their views: the steps view has one plane'),
  'ux165_phone_classic_cmd.js': classic('the phone\'s chain bar and its sheet, the Deformation bar and its dock, the Both key, the cards, and the Editor, keyboard and construction touches as the classic view reaches them'),
  'v15_phone_cmd.js': classic('the phone\'s X | Y layout and its chain bar; the steps view\'s phone is in the phone suites and layout_invariants_cmd'),
  'deform_range_gl_cmd.js': steps({ pin: true }),

  // to port: interact
  'a11y_axe_cmd.js': steps({ pin: true }),
  'chip_clamp_cmd.js': steps({ pin: true }),
  'complex_point_cmd.js': steps({ pin: true }),
  'complex_params_cmd.js': steps({ pin: true }),
  'custom_show_cmd.js': steps({ pin: true }),
  'd1_replace_cmd.js': steps({ pin: true }),
  'display_inline_cmd.js': classic('the classic pane heads\' Display, Regions and title toggles at each width: the steps view\'s head is layout_invariants_cmd\'s and steps_head_cmd\'s'),
  'field_settle_cmd.js': steps({ pin: true }),
  'kbd_nav_cmd.js': steps({ pin: true }),
  'key_popup_cmd.js': steps({ pin: true }),
  'mode_chips_cmd.js': steps({ pin: true }),
  'param_planes_cmd.js': steps({ pin: true }),
  'phase_key_cmd.js': steps({ pin: true }),
  'phase_style_cmd.js': steps({ pin: true }),
  'repeat_cmd.js': steps({ pin: true }),
  'repeat_settle_cmd.js': steps({ pin: true }),
  'series_edit_cmd.js': steps({ pin: true }),
  'series_params_cmd.js': steps({ pin: true }),
  'shape_rows_cmd.js': steps({ pin: true }),
  'stage_shapes_cmd.js': steps({ pin: true }),
  'top_bar_focus_cmd.js': steps({ pin: true }),
  'ux165_fix_cmd.js': steps({ pin: true }),
  'ux165_merge_classic_cmd.js': classic('Y\'s head with its "Y · " tag: the classic right pane; the steps view has one plane and no such head'),
  'ux165_merge_cmd.js': steps({ pin: true }),
  'ux165_plane_classic_cmd.js': classic('the classic readout (two lines on a laptop and a phone, F(z) read in X, the chip below it, the key\'s three marks), a finger drag from a disc panning the plane, and the names of X and Y (titles, canvas names, Shapes headings, Plane | Sphere in the two heads, the phone chip\'s X tag, in English and Russian): a finger drag on a steps-view plane scrubs the thread, and it has one plane and no X or Y'),
  'ux165_plane_cmd.js': steps({ pin: true }),
  'v15_merge_cmd.js': steps({ pin: true }),
  'v15_params_cmd.js': steps({ pin: true }),
  'v15_planemenu_cmd.js': steps({ pin: true }),
  'zp_classic_cmd.js': classic('the right pane\'s renderer paths by degree, the frame held mid-drag and the deformation: the steps view shows one plane, with no right pane and no deformation transport'),
  'zp_cmd.js': steps({ pin: true }),
  'zpfix_cmd.js': steps({ pin: true }),
  'deform_nat_cmd.js': steps({ pin: true }),

  // to port: phone
  'phone_ctx_tex_cmd.js': steps({ pin: true }),
  'phone_focus_margin_cmd.js': steps({ pin: true }),
  'phone_fwell_cmd.js': steps({ pin: true }),
  'phone_sheet_target_cmd.js': steps({ pin: true }),
  'phone_sheets_cmd.js': steps({ pin: true }),
  'phone_toast_chain_cmd.js': steps({ pin: true }),
  'ux165_phone_cmd.js': steps({ pin: true }),

  // to port: words (the tour, the Try lines left and the chapters' retargeting)
  'example_cauchy_cmd.js': steps({ pin: true }),
  'steps_foot_note_order_cmd.js': steps({ pin: true }),
  'example_params_cmd.js': steps({ pin: true }),
  'example_try_events_cmd.js': steps({ pin: true }),
  'example_try_repeat_cmd.js': steps({ pin: true }),
  'fix152_cmd.js': steps({ pin: true }),
  'inspector_parse_hint_cmd.js': steps(),
  'ux165_palette_cmd.js': steps({ pin: true }),
  'guide_nav_cmd.js': steps({ pin: true }),
  'i18n_cmd.js': steps({ pin: true }),
  'i18n_classic_cmd.js': classic('the Deformation\'s keys on a Russian layout (Ь, З), the digit keys that pick X → Y, Phase and Landscape, and the classic Landscape title of the logarithm\'s example: the steps view has none of those keys (its play and Paths keys and its plane head\'s sheets are in i18n_cmd)'),
  'i18n_walk_cmd.js': port('words', 'it walks the classic views, cards and Deformation; the steps view\'s own walk is i18n_walk_steps_cmd'),
  'i18n_walk_steps_cmd.js': steps(),
  'raw_tex_cmd.js': steps({ pin: true }),
  'raw_tex_classic_cmd.js': classic('the shapes\' raw-TeX scan in X → Y, Phase and Landscape, which the steps view replaces with its planes and surfaces (raw_tex_cmd)'),
  'split_cmd.js': steps({ pin: true }),
  'split_deform_cmd.js': steps({ pin: true }),
  'tour_audit_cmd.js': steps({ pin: true }),
  'tour_auto_cmd.js': steps({ pin: true }),
  'tour_auto_classic_cmd.js': classic('the classic views\' tour tasks with real input: the view switch\'s doors, Phase key, X\'s pan,'
    + ' the preimages hint and the Deformation\'s Part of the chain; the steps view\'s are tour_auto_cmd'),
  'tour_chapters_cmd.js': steps({ pin: true }),
  'tour_cmd.js': steps({ pin: true }),
  'tour_cmd_classic_cmd.js': classic('the classic views\' tour: X\'s pan task and the strip\'s arrow keys, the Views chapter (the view'
    + ' switch, Phase, Sphere, Phase key) and the Deformation chapter (Paths, All steps at once, Part of the chain); the steps view\'s'
    + ' is tour_cmd'),
  'tour_it360_cmd.js': steps({ pin: true }),
  'tour_lane_cmd.js': steps({ pin: true }),
  'tour_lit_cmd.js': steps({ pin: true }),
  'tour_perf_cmd.js': steps({ pin: true }),
  'tour_phone_cmd.js': steps({ pin: true }),
  'tour_phone_classic_cmd.js': classic('the classic views\' tour on a phone: X\'s 608 px under the chain bar and the Phase key sheet below the strip;'
    + ' the steps view\'s is tour_phone_cmd'),
  'tour_skip_hover_cmd.js': steps({ pin: true }),
  'tour_tasks_cmd.js': steps({ pin: true }),
  'tour_tasks_classic_cmd.js': classic('the classic views\' tour task lines: Y\'s drag and the classic desk cases; the steps view\'s are tour_tasks_cmd'),
  'steps_cauchy_cmd.js': steps(),
  'steps_cauchy_parts_cmd.js': steps(),
  'steps_plane_key_cmd.js': steps({ pin: true }),   // (its page, in test/lib/plane_key_kit.js, asks ?view=steps itself)
  'steps_phone_key_cmd.js': steps({ pin: true }),
  'steps_canvas_stack_cmd.js': steps({ pin: true }),
  'tour_titles_cmd.js': steps({ pin: true }),
  'tour_words_cmd.js': steps({ pin: true }),
  'tour_words_classic_cmd.js': classic('the classic views\' tour: the Basics chapter\'s chain step, which the steps view\'s tour'
    + ' does not have; the steps view\'s own is tour_words_cmd'),
  'ux165_learn_cmd.js': steps({ pin: true }),
  'ux165_learn_classic_cmd.js': classic('the classic views\' learn checks: Y\'s pane head (the pattern key, option bar, target note, the empty chain\'s Add function), the deformation\'s readout, play button, draw chip and Video format, the Shapes list\'s shape keys and the right-click menus of the Shapes rows and chain cards; the steps view has none of these'),
  'ux165_learn_phone_classic_cmd.js': classic('the classic phone\'s learn checks: Y\'s chip naming the inset after a target and the inset\'s pulse (V01), and the message row under the chain bar (UX80); the steps view\'s phone has no inset and no chain bar'),
  'ux165_learn_first_run_cmd.js': steps({ pin: true }),
  'ux165_learn_sound_cmd.js': steps({ pin: true }),
  'v151_cmd.js': steps({ pin: true }),

  // to port: export (the shown plane, the filmstrip, the glide)
  'complex_lang_export_cmd.js': steps({ pin: true }),
  'export_cmd.js': steps({ pin: true }),
  'export_deform_cmd.js': steps({ pin: true }),
  'export_deform_classic_cmd.js': classic('the classic views\' deformation export: the X → Y, Phase, globe and Landscape figures and videos, the display-style F, their Russian captions and the dialog\'s classic Deformation row; the steps view\'s export is export_deform_cmd, export_steps_cmd and morphfig_cmd'),
  'export_fit_cmd.js': steps({ pin: true }),
  'export_sheet_cmd.js': steps({ pin: true }),
  'export_tex_cmd.js': steps({ pin: true }),
  'figure_wait_cmd.js': steps({ pin: true }),
  'morphfig_cmd.js': steps({ pin: true }),
  'steps_paths_sphere_cmd.js': steps({ pin: true }),
  'steps_paths_sphere_fig_cmd.js': steps({ pin: true }),
  'morphfig_classic_cmd.js': classic('the classic view\'s deformation as one picture: pathsGen\'s selection on the Y pane, the transport and the 3 prototype cases; the steps view\'s paths figure is morphfig_cmd'),

  // to port: geometry
  'between_cmd.js': steps({ pin: true }),
  'constr_cmd.js': steps({ pin: true }),
  'curves_cmd.js': steps({ pin: true }),
  'curves_target_cmd.js': steps({ pin: true }),
  'curves_outline_off_cmd.js': steps({ pin: true }),
  'curves_target_legend_cmd.js': steps({ pin: true }),
  'curves_target_legend_classic_cmd.js': classic('the target legend is the classic right pane\'s head note (#rightNote), which the steps view\'s one plane has as a head chip: curves_target_legend_cmd'),
  'curves_target_areas_cmd.js': steps({ pin: true }),
  'curves_areas_guard_cmd.js': steps({ pin: true }),
  'dh_cmd.js': steps({ pin: true }),
  'fix163_cmd.js': steps({ pin: true }),
  'meetnear_coincide_cmd.js': steps({ pin: true }),
  'perp_cmd.js': steps({ pin: true }),
  'poly_verts_cmd.js': steps({ pin: true }),
  'rel162_sheets_cmd.js': port('geometry', 'the release check of All sheets on a Landscape with a multivalued step, its sheets and their count, as the classic Landscape draws them: the steps view has the check in its plane options (sv_all_sheets_cmd), not this case'),
  'sheets_deform_cmd.js': port('geometry', 'All sheets while a glide plays: the steps view has the check (sv_all_sheets_cmd) and its glide, but not every sheet drawn over the glide'),
  'touch_cmd.js': steps({ pin: true }),
  'ux165_rail_cmd.js': steps({ pin: true }),

  // to port: render
  'cauchy_residue_cmd.js': steps({ pin: true }),
  'deform_dirichlet_cmd.js': steps({ pin: true }),
  'land_release_cmd.js': steps({ pin: true }),
  'link_standin_cmd.js': steps({ pin: true }),
  'svready_cmd.js': steps({ pin: true }),
  'overlay_ghost_cmd.js': steps({ pin: true }),
  'p3_accept_steps_cmd.js': steps({ pin: true }),
  'p3_accept_cmd.js': port('render', 'the exact globes and their strokes, the spherical checker on the GPU, the globes\' figure export and the globe orientation: the steps view has its own globe suites (sv_globe_*), and these checks are not yet in the steps view'),
  'p3_review_cmd.js': steps({ pin: true }),
  'p3_review_classic_cmd.js': classic('a region\'s own pattern drawn exactly, the two-globe exports and their main-thread checks are the classic views\': the steps view colours regions by the carried phase and has one pane'),
  'p3b_accept_cmd.js': steps({ pin: true }),
  'globe_release_cmd.js': steps({ pin: true }),
  'p3bfix_cmd.js': steps({ pin: true }),
  'p5_accept_cmd.js': steps({ pin: true }),
  'regions_phase_cmd.js': steps({ pin: true }),
  'regions_phase_classic_cmd.js': classic('the X → Y view\'s Regions pop-up in Y\'s head and its key chip, and the tour\'s Views chapter'),
  'sphere_light_cmd.js': steps({ pin: true }),

  // to port: sound (Pietro's team)
  'seasong_cmd.js': port('sound', 'the Mountain King example: its gallery entry, its circle menu with Listen along and the first samples it prepares, in English, Russian, desktop and phone; it waits on the sound checks in the steps view'),
  'sound_cmd.js': port('sound', 'the browser side of sound: consent, the tiers and their palette entries, the settings, the cues, the pointer voice, loops and the Landscape contours; it waits on the sound checks in the steps view'),
  'sound_v152_cmd.js': steps({ pin: true }),
  'sound_v152_deform_classic_cmd.js': classic('the loop singing while the Deformation plays and Esc while it plays: the steps view has no open Deformation'),

  // to port: engine (no view of its own)
  'kit_ev_cmd.js': steps({ pin: true }),
  'kit_nav_cmd.js': steps({ pin: true }),
  'kit_seed_cmd.js': steps({ pin: true }),
  'kit_load_wait_cmd.js': steps({ pin: true }),
  'kit_settled_cmd.js': steps({ pin: true }),
  'kit_load_cmd.js': steps({ pin: true }),
  'kit_fault_cmd.js': steps({ pin: true }),
  'line_slice_cmd.js': steps({ pin: true }),
  'mj_ranges_cmd.js': steps({ pin: true }),
  'offline_cmd.js': steps({ pin: true }),
  'smoke_cmd.js': steps({ pin: true }),
  'zeta_logk_cmd.js': steps(),
  'warm_bar_cmd.js': steps({ pin: true }),
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
  console.log(`classic (${by('classic').length}):\n${by('classic').map(([f, tag]) => `  ${f}: ${tag.why}`).join('\n')}`);
}
module.exports = { VIEWS, checkViews };
