'use strict';
// Which view each browser suite tests: the steps view, or the classic views, which stay as a view of their own (#621).
// Every runnable suite (ci/browser_shards.js) has exactly one entry; `node ci/browser_shards.js check` fails without
// one. The kit pins every page to the classic view unless its URL asks for ?view=steps (test/cdp_kit/pin_view.js), so
// a suite tagged port or classic runs classic.
//   steps()               opens the steps view itself (its URL has ?view=steps; some check the classic view too)
//   steps({ pin: true })  a ported suite: ci/browser.js runs it with CMW_VIEW=steps, so the kit opens every page it loads
//                         in the steps view, with no change to its URLs (a page asking ?view=classic keeps the classic one).
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
  'pin_view_cmd.js': steps({ pin: true }),   // (the pin itself: it opens no URL that names the steps view)
  'example_try_sv_cmd.js': steps(),
  'export_steps_cmd.js': steps(),
  'layout_invariants_cmd.js': steps(),
  'phone_ctx_slide_cmd.js': steps(),
  'phone_edit_head_cmd.js': steps(),
  'phone_export_steps_cmd.js': steps(),
  'phone_landscape_cmd.js': steps(),
  'phone_palette_cmd.js': steps(),
  'steps_carry_cmd.js': steps(),
  'steps_carry_inregion_cmd.js': steps(),
  'steps_carry_far_cmd.js': steps(),
  'steps_fill_points_cmd.js': steps(),
  'steps_glide_cost_cmd.js': steps(),
  'steps_glstatus_cmd.js': steps(),
  'steps_sm_standin_cmd.js': steps(),
  'steps_glide_look_cmd.js': steps({ pin: true }),
  'steps_chain_cmd.js': steps(),
  'steps_curves_cmd.js': steps(),
  'steps_empty_cmd.js': steps(),
  'steps_head_cmd.js': steps(),
  'steps_listen_cmd.js': steps({ pin: true }),
  'steps_why_cmd.js': steps(),
  'steps_labels_cmd.js': steps(),
  'steps_long_549_cmd.js': steps(),
  'steps_names_cmd.js': steps(),
  'steps_fchip_cmd.js': steps(),
  'steps_order_cmd.js': steps(),
  'steps_repeat_cmd.js': steps(),
  'steps_parked_pan_cmd.js': steps(),
  'steps_paths_cmd.js': steps({ pin: true }),
  'steps_glide_inverse_cmd.js': steps(),
  'sv_globe_net_cmd.js': steps({ pin: true }),
  'steps_play_cmd.js': steps(),
  'steps_view_cmd.js': steps(),
  'steps_width_cmd.js': steps(),
  'sv_curve_menu_cmd.js': steps(),
  'sv_globe_mask_cmd.js': steps(),
  'sv_globe_draw_cmd.js': steps(),
  'sv_globe_edit_cmd.js': steps({ pin: true }),
  'sv_globe_stage_shape_cmd.js': steps({ pin: true }),
  'sv_construct_plane_cmd.js': steps(),
  'sv_state_cmd.js': steps(),
  'toasts_515_cmd.js': steps(),
  'tour_planes_cmd.js': steps(),

  // the classic views' own parts, pinned to the classic view
  'card_canvas_cmd.js': classic('the chain cards\' thumbnails: the steps view has the thread, no card row'),
  'card_resize_cmd.js': classic('the chain cards during a resize: no card row in the steps view'),
  'chain_row_cmd.js': classic('the phone\'s chain bar with Deformation and its glide: the steps view\'s phone has the strip'),
  'clear_chain_open_cmd.js': classic('the classic chain head beside the floating Inspector (it names the classic view)'),
  'deform_range_cmd.js': classic('the Deformation bracket over the card row: the thread\'s range is steps_play_cmd\'s'),
  'header_layout_cmd.js': classic('the top bar\'s view tabs (X → Y | Phase | Landscape), which only the classic view has'),
  'land_cards_cmd.js': classic('the Landscape step cards: no card row in the steps view'),
  'layout_483_cmd.js': classic('its fixes are the classic layout\'s: the panes\' tabs, the chain connector, the Deformation bracket and dock; layout_invariants_cmd covers the steps view'),
  'mv_views_cmd.js': classic('the merged X → Y / Phase / Landscape views and their switch, which the steps view replaces'),
  'pane_heads_1024_cmd.js': classic('the two pane heads and the chain head at 1024 px; steps_head_cmd covers the steps view\'s one head'),
  'phone_glide_export_cmd.js': classic('the export while the classic ‹ › glide has Y on a step\'s plane, and the chip over it: the steps view\'s export of a step\'s plane is phone_export_steps_cmd'),
  'phone_glide_cmd.js': classic('the phone\'s ‹ › glide of Y between X and Y: the steps view glides its one plane (steps_view_cmd)'),
  'phone_swap_cmd.js': classic('the phone\'s two planes keeping their views: the steps view has one plane'),
  'ux165_chain_cmd.js': classic('v16.5\'s fixes of the chain cards and the chain head'),
  'ux165_phone_classic_cmd.js': classic('the phone\'s chain bar and its sheet, the Deformation bar and its dock, the Both key, the cards, and the Editor, keyboard and construction touches as the classic view reaches them'),
  'v15_desktop_cmd.js': classic('the cards following the view switch (X → Y, Phase, Landscape, the Deformation)'),
  'v15_phone_cmd.js': classic('the phone\'s X | Y layout and its chain bar; the steps view\'s phone is in the phone suites and layout_invariants_cmd'),
  'deform_range_gl_cmd.js': classic('it drives the Deformation bracket itself (__cmwMorph({ range }), #homOrderSel), which the steps view does not have'),
  'example_try_cmd.js': classic('its line is "press Deformation"; the steps view\'s Try lines are example_try_sv_cmd\'s'),

  // to port: interact
  'a11y_axe_cmd.js': steps({ pin: true }),
  'a11y_axe_cards_cmd.js': classic('the classic chain cards\' inert actions and the mouse click on Bypass: the steps view has the thread, whose chips hold their ⋯ as ordinary controls'),
  'chip_clamp_cmd.js': steps({ pin: true }),
  'complex_point_cmd.js': steps({ pin: true }),
  'complex_params_cmd.js': steps({ pin: true }),
  'custom_show_cmd.js': steps({ pin: true }),
  'd1_replace_cmd.js': steps({ pin: true }),
  'display_inline_cmd.js': classic('the classic pane heads\' Display, Regions and title toggles at each width: the steps view\'s head is layout_invariants_cmd\'s and steps_head_cmd\'s'),
  'field_settle_cmd.js': steps({ pin: true }),
  'kbd_nav_cmd.js': steps({ pin: true }),
  'kbd_nav_classic_cmd.js': classic('the classic chain cards\' one Tab stop and F6 across X, Y and the chain: the steps view has the thread, and its F6 areas are kbd_nav_cmd\'s'),
  'key_popup_cmd.js': steps({ pin: true }),
  'mode_chips_cmd.js': steps({ pin: true }),
  'mode_chips_classic_cmd.js': classic('the step-alone, expanded-plane and deformation chips of the classic pane head: the steps view keeps the Construct tool chip and Listening along only'),
  'param_planes_cmd.js': steps({ pin: true }),
  'phase_key_cmd.js': steps({ pin: true }),
  'phase_key_classic_cmd.js': classic('X → Y\'s hidden X key: the steps view has one plane and shows its key (phase_key_cmd)'),
  'phase_style_cmd.js': steps({ pin: true }),
  'repeat_cmd.js': steps({ pin: true }),
  'repeat_classic_cmd.js': classic('the classic card row\'s ⋯ menu and its bracket under the cards (the bracket\'s N chip, its × and its spans), and F read from the classic F tile: the steps view has no card row, and its Repeat is a chip menu and an Inspector row (repeat_cmd, steps_repeat_cmd)'),
  'repeat_settle_cmd.js': steps({ pin: true }),
  'series_edit_cmd.js': steps({ pin: true }),
  'series_params_cmd.js': steps({ pin: true }),
  'shape_rows_cmd.js': steps({ pin: true }),
  'stage_shapes_cmd.js': steps({ pin: true }),
  'top_bar_focus_cmd.js': steps({ pin: true }),
  'top_bar_focus_classic_cmd.js': classic('the classic top bar\'s view switch and Deformation in the Tab order, and the segments of the view switch and of the classic heads: the steps view has none of them (top_bar_focus_cmd)'),
  'ux165_fix_classic_cmd.js': classic('the classic transport dock\'s one row, the Sphere view\'s switch-to-the-plane hint for Orthogonal, and the planes staying put when Listen starts: the steps view has no dock, takes no curve pick on its globe yet, and its Listening-along note moves the plane'),
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
  'deform_nat_classic_cmd.js': classic('the classic Deformation dock: its Paths button, key P and palette entry, the figure export with paths, the order select and all at once as one homotopy with its scrubber, caption and play loop, Phase beside the deformation, and the 60 fps check of the paths: the steps view has no dock, draws a glide over several steps as one run of them, and keeps its own Paths and order controls (steps_paths_cmd, steps_order_cmd)'),

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
  'example_params_cmd.js': steps({ pin: true }),
  'example_try_events_cmd.js': port('words', 'the Try lines left (those that need a card\'s menu)'),
  'fix152_cmd.js': steps({ pin: true }),
  'fix152_classic_cmd.js': classic('the Split offer in the classic views: focus on a card, f₂ shown alone; fix152_cmd.js runs the offer in the steps view'),
  'guide_nav_cmd.js': steps({ pin: true }),
  'i18n_cmd.js': port('words', 'in the steps view its header, menu, overflow and palette checks pass; its Deformation round trip, the M and P shortcuts, the X → Y digit and the All sheets title have no steps-view equivalent yet (the Paths and All sheets controls)'),
  'i18n_walk_cmd.js': port('words', 'it walks the classic views, cards and Deformation; its steps-view walk (planes, surfaces, the thread) is a new pass, not started'),
  'raw_tex_cmd.js': steps({ pin: true }),
  'raw_tex_classic_cmd.js': classic('the shapes\' raw-TeX scan in X → Y, Phase and Landscape, which the steps view replaces with its planes and surfaces (raw_tex_cmd)'),
  'split_cmd.js': steps({ pin: true }),
  'split_deform_cmd.js': port('interact', 'the Split with the Deformation open, the alone walk ‹ › and the Deformation playing 12 split sines: the steps view has no open Deformation (its glide is the thread\'s play) and no ‹ › walk of a step shown alone'),
  'tour_audit_cmd.js': port('words', 'every step visited: the steps-view tour walks 38 steps and it expects at least 43; it waits on the tour chapters (#717)'),
  'tour_auto_cmd.js': port('words', 'every chapter\'s tasks with real input; it waits on the steps-view tour chapters (#717):'
    + ' the Views chapter\'s door is the classic view switch, which the steps view lacks'),
  'tour_chapters_cmd.js': steps({ pin: true }),
  'tour_cmd.js': port('words', 'with the Try lines left and the chapters\' retargeting'),
  'tour_it360_cmd.js': port('words', 'it walks every step of every chapter and expects at least 40; it waits on the steps-view tour'
    + ' chapters (#717), whose tour walks 38'),
  'tour_lane_cmd.js': steps({ pin: true }),
  'tour_lit_cmd.js': port('words', 'every step\'s anchor: after the chapters are retargeted'),
  'tour_perf_cmd.js': steps({ pin: true }),
  'tour_phone_cmd.js': port('words', 'it walks every step of every chapter and expects at least 40 (the steps-view tour walks 38), and'
    + ' reads the strip row, the X box and the pan task in X; it waits on the steps-view tour chapters (#717)'),
  'tour_skip_hover_cmd.js': steps({ pin: true }),
  'tour_tasks_cmd.js': port('words', 'its Y, Targets and Cauchy cases and the phone cases address classic controls (the Y pane tool row, the chain sheet); the F tile and d/dz cases at 1440 pass; it waits on the tour chapters (#717)'),
  'tour_titles_cmd.js': steps({ pin: true }),
  'tour_words_cmd.js': steps({ pin: true }),
  'tour_words_classic_cmd.js': classic('the classic views\' tour: the Basics chapter\'s chain step, which the steps view\'s tour'
    + ' does not have; the steps view\'s own is tour_words_cmd'),
  'ux165_learn_cmd.js': port('words', 'what is left of it asks what the steps view does not have yet: the playback readout in words (UX103), the draw-tool chip while a deformation is open (UX102), the Video format (UX60), the shape keys (⌘D, arrows, ⌘[) and the chain card\'s right-click menu (UX97, UX99), the empty chain\'s Add function not over the picture, with its tooltip words and the plane\'s title whole beside it (UX20), the plane\'s pattern key and target note (UX20, V01: steps_head_cmd asks the head\'s row, style buttons, scope and surface only); its phone legs wait for the phone work'),
  'ux165_learn_first_run_cmd.js': steps({ pin: true }),
  'ux165_learn_msg_classic_cmd.js': classic('the Undo message in the chain head: the steps view has no chain head; toasts_515_cmd and ux165_fix_cmd ask its message over the rail, inside the strip'),
  'ux165_learn_sound_cmd.js': steps({ pin: true }),
  'v151_cmd.js': steps({ pin: true }),
  'v151_alone_classic_cmd.js': classic('the language switch with a step shown alone (v15.1 verify-8): "Show alone" is the classic view\'s; v151_cmd has the steps view\'s equivalent'),

  // to port: export (the shown plane, the filmstrip, the glide)
  'complex_lang_export_cmd.js': steps({ pin: true }),
  'export_cmd.js': port('export', 'the figures of the shown plane: pinned to the steps view its first third fails on the article, homework and phase captions, the paths figure and the filmstrip (eight checks), and the rest of it reads the classic right pane (canvasR, the right plane\'s view)'),
  'export_fit_cmd.js': steps({ pin: true }),
  'export_sheet_cmd.js': steps({ pin: true }),
  'export_tex_cmd.js': steps({ pin: true }),
  'figure_wait_cmd.js': steps({ pin: true }),
  'morphfig_cmd.js': port('export', 'the deformation as one picture: the glide\'s export'),

  // to port: geometry
  'between_cmd.js': steps({ pin: true }),
  'constr_cmd.js': steps({ pin: true }),
  'curves_cmd.js': steps({ pin: true }),
  'curves_target_cmd.js': steps({ pin: true }),
  'curves_outline_off_cmd.js': steps({ pin: true }),
  'curves_target_legend_cmd.js': classic('the target legend is the classic right pane\'s head note (#rightNote), which the steps view\'s one plane does not have'),
  'curves_target_areas_cmd.js': steps({ pin: true }),
  'curves_areas_guard_cmd.js': steps({ pin: true }),
  'dh_cmd.js': steps({ pin: true }),
  'fix163_cmd.js': steps({ pin: true }),
  'meetnear_coincide_cmd.js': steps({ pin: true }),
  'perp_cmd.js': steps({ pin: true }),
  'poly_verts_cmd.js': steps({ pin: true }),
  'rel162_sheets_cmd.js': port('geometry', 'All sheets: after the steps view has an All sheets control'),
  'sheets_deform_cmd.js': port('geometry', 'All sheets in a glide: after the steps view has an All sheets control'),
  'touch_cmd.js': steps({ pin: true }),
  'ux165_rail_cmd.js': steps({ pin: true }),

  // to port: render
  'cauchy_residue_cmd.js': steps({ pin: true }),
  'deform_dirichlet_cmd.js': steps({ pin: true }),
  'land_release_cmd.js': steps({ pin: true }),
  'link_standin_cmd.js': port('render', 'the steps view\'s last plane draws no stand-in while its chain links: it shows an empty plane with "Compiling…", where the classic right pane shows the CPU-mapped shape'),
  'overlay_ghost_cmd.js': steps({ pin: true }),
  'p3_accept_cmd.js': port('render'),
  'p3_review_cmd.js': port('render'),
  'p3b_accept_cmd.js': port('render'),
  'p3bfix_cmd.js': steps({ pin: true }),
  'p5_accept_cmd.js': port('render'),
  'regions_phase_cmd.js': steps({ pin: true }),
  'regions_phase_classic_cmd.js': classic('the X → Y view\'s Regions pop-up in Y\'s head and its key chip, and the tour\'s Views chapter'),
  'sphere_light_cmd.js': steps({ pin: true }),

  // to port: sound (Pietro's team, #580 and #598)
  'seasong_cmd.js': port('sound'),
  'sound_cmd.js': port('sound'),
  'sound_v152_cmd.js': port('sound'),

  // to port: engine (no view of its own)
  'kit_seed_cmd.js': steps({ pin: true }),
  'kit_settled_cmd.js': steps({ pin: true }),
  'line_slice_cmd.js': steps({ pin: true }),
  'mj_ranges_cmd.js': steps({ pin: true }),
  'offline_cmd.js': steps({ pin: true }),
  'smoke_cmd.js': port('engine', 'it checks the default page, which is the classic view: it moves to the steps view when that becomes the default, and its view switch then becomes the surface and the plane'),
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
