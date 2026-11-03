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
  'phone_landscape_cmd.js': steps(),
  'phone_palette_cmd.js': steps(),
  'steps_carry_cmd.js': steps(),
  'steps_chain_cmd.js': steps(),
  'steps_curves_cmd.js': steps(),
  'steps_empty_cmd.js': steps(),
  'steps_head_cmd.js': steps(),
  'steps_listen_cmd.js': steps({ pin: true }),
  'steps_labels_cmd.js': steps(),
  'steps_long_549_cmd.js': steps(),
  'steps_names_cmd.js': steps(),
  'steps_fchip_cmd.js': steps(),
  'steps_order_cmd.js': steps(),
  'steps_repeat_cmd.js': steps(),
  'steps_parked_pan_cmd.js': steps(),
  'steps_paths_cmd.js': steps(),
  'steps_play_cmd.js': steps(),
  'steps_view_cmd.js': steps(),
  'steps_width_cmd.js': steps(),
  'sv_curve_menu_cmd.js': steps(),
  'sv_globe_mask_cmd.js': steps(),
  'sv_globe_draw_cmd.js': steps(),
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
  'mv_views_cmd.js': classic('the merged X → Y / Phase / Landscape views and their switch, which the steps view takes over'),
  'pane_heads_1024_cmd.js': classic('the two pane heads and the chain head at 1024 px; steps_head_cmd covers the steps view\'s one head'),
  'phone_glide_cmd.js': classic('the phone\'s ‹ › glide of Y between X and Y: the steps view glides its one plane (steps_view_cmd)'),
  'phone_swap_cmd.js': classic('the phone\'s two planes keeping their views: the steps view has one plane'),
  'ux165_chain_cmd.js': classic('the chain cards and the chain head of the classic views'),
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
  'custom_show_cmd.js': port('interact', 'its select(k) clicks the classic card row, which the steps view hides: it needs the step chip on the thread, with the selected step asserted'),
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
  'stage_shapes_cmd.js': port('interact', 'it screenshots Y\'s pane, which the steps view does not have (the screenshot is zero-width) and reads Y\'s pixels: its cases need rewriting onto the shown plane\'s globe'),
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
  'example_try_events_cmd.js': port('words', 'it passes in the steps view only by clicking the classic cards, which the steps view hides: its Try lines that need a card\'s menu need the thread\'s step chip and menu instead'),
  'fix152_cmd.js': steps({ pin: true }),
  'fix152_classic_cmd.js': classic('the Split offer in the classic views: focus on a card, f₂ shown alone; fix152_cmd.js runs the offer in the steps view'),
  'guide_nav_cmd.js': steps({ pin: true }),
  'i18n_cmd.js': port('words', 'in the steps view 136 of its 143 checks pass (header, menu, overflow, palette); the other 7 read classic parts: the card count after a language switch, the Deformation on the M key, the P key\'s Paths toggle, the X → Y digit, typing in a field with the Deformation state, and the Landscape title\'s window of sheets (the steps view has Paths and All at once, but no Deformation bracket and no All sheets control)'),
  'i18n_walk_cmd.js': port('words', 'it passes in the steps view only by clicking the classic cards, which the steps view hides: a walk of the steps view\'s own parts (the planes, the surfaces, the thread\'s chips and their menus) is not written'),
  'raw_tex_cmd.js': steps({ pin: true }),
  'raw_tex_classic_cmd.js': classic('the shapes\' raw-TeX scan in X → Y, Phase and Landscape, which the steps view takes over with its planes and surfaces (raw_tex_cmd)'),
  'split_cmd.js': port('words', 'it passes in the steps view only by clicking the classic cards, which the steps view hides: the Split offer on the thread is fix152_cmd\'s, and its other cases (the Deformation, the alone walk) need the thread\'s chips'),
  'tour_audit_cmd.js': port('words', 'pinned to the steps view it fails: eight planes tasks have no control there, the analysis/domain and branches/deriv steps have none, and the walk sees 38 of 45 steps; it waits on the steps-view tour chapters'),
  'tour_auto_cmd.js': port('words', 'it drives every chapter\'s tasks with real input and throws in the steps view (it reads an element of a step that is not there): the steps view\'s tour walks 38 steps and has no Views chapter door (the classic view switch); it waits on the steps-view tour chapters'),
  'tour_chapters_cmd.js': steps({ pin: true }),
  'tour_cmd.js': port('words', '28 of its 94 checks fail in the steps view: the strip\'s place and reading, the arrow keys, the lit areas and tasks of the Draw, Shapes and Sphere steps, the chapter counts and the Next labels; it waits on the steps-view tour chapters and the Try lines left'),
  'tour_it360_cmd.js': port('words', 'it walks every step of every chapter at 360 px and expects at least 40; the steps view\'s tour walks 38; it waits on the steps-view tour chapters'),
  'tour_lane_cmd.js': steps({ pin: true }),
  'tour_lit_cmd.js': port('words', '154 of its 156 checks pass in the steps view; the other 2 check that every chapter is walked at both sizes and that the tour logs no skipped steps (basics/add and views/switch, for example, have no anchor there); it waits on the steps-view tour chapters'),
  'tour_perf_cmd.js': steps({ pin: true }),
  'tour_phone_cmd.js': port('words', '1839 of its 1853 checks pass in the steps view; the failures are the step count (38, it expects at least 40), the height of the strip row over X (608 px) and a touch in X that should fold Why and tick the pan task; it waits on the steps-view tour chapters'),
  'tour_skip_hover_cmd.js': steps({ pin: true }),
  'tour_tasks_cmd.js': port('words', 'it throws in the steps view at its first task (it reads the text of a step\'s element that is not there): its F tile and card tasks need the F chip and the thread\'s chips, and the chapters retargeted'),
  'tour_titles_cmd.js': steps({ pin: true }),
  'tour_words_cmd.js': steps({ pin: true }),
  'tour_words_classic_cmd.js': classic('the classic views\' tour: the Basics chapter\'s chain step, which the steps view\'s tour'
    + ' does not have; the steps view\'s own is tour_words_cmd'),
  'ux165_learn_cmd.js': port('words', 'it measures classic-view controls (the Phase key behind the pane head, the card row, the Deformation bar) and throws in the steps view at its first box: it needs a rewrite onto the steps view\'s own controls (the F chip, the plane\'s head)'),
  'v151_cmd.js': port('words', 'all its checks but one pass in the steps view; the one that fails is verify-8, the language switch keeping a selection other than the step shown alone, which it selects through a classic card: it needs the thread\'s step chip'),

  // to port: export (the shown plane, the filmstrip, the glide)
  'complex_lang_export_cmd.js': port('export', 'it passes in the steps view only by clicking the classic card for step 1, which the steps view hides: it needs the thread\'s step chip'),
  'export_cmd.js': port('export', 'in the steps view its caption cases (article, homework, phase), its Deformation video and film cases (the view exports no Deformation), its Landscape title case and its bracket preview fail or throw; the shown plane\'s export and the filmstrip are export_steps_cmd\'s'),
  'export_fit_cmd.js': port('export'),
  'export_sheet_cmd.js': port('export', 'it passes unchanged in the steps view (it opens the export dialog on a phone and a laptop, with no classic selectors): it needs only the steps({ pin: true }) tag'),
  'export_tex_cmd.js': port('export', 'the shown plane\'s export'),
  'figure_wait_cmd.js': port('export'),
  'morphfig_cmd.js': port('export', 'it exports the deformation as one picture and finds no screen selection in the steps view, which has no Deformation: it waits on the glide\'s export in the steps view'),
  'phone_glide_export_cmd.js': port('export', 'it reads Y\'s pane (Y parked on the plane after step 2, Y\'s title), which the steps view takes over with the shown plane: it needs retargeting to the shown plane and the thread'),

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
  'rel162_sheets_cmd.js': port('geometry', 'its probe of the Deformation\'s surfaces (H_t) finds none in the steps view, which has no All sheets control: it waits on All sheets in the steps view'),
  'sheets_deform_cmd.js': port('geometry', 'it throws in the steps view when it reads the Deformation\'s sheets in a glide: it waits on an All sheets control in the steps view'),
  'touch_cmd.js': steps({ pin: true }),
  'ux165_rail_cmd.js': steps({ pin: true }),

  // to port: render
  'cauchy_residue_cmd.js': steps({ pin: true }),
  'deform_dirichlet_cmd.js': steps({ pin: true }),
  'land_release_cmd.js': steps({ pin: true }),
  'link_standin_cmd.js': port('render', 'the steps view\'s last plane draws no stand-in while its chain links: it shows an empty plane with "Compiling…", where the classic right pane shows the CPU-mapped shape; the suite also screenshots Y\'s pane, which the steps view lacks'),
  'overlay_ghost_cmd.js': steps({ pin: true }),
  'p3_accept_cmd.js': port('render', 'it samples the classic Sphere view\'s globes (the z^i(H) inverse, the hole cap, the annulus), which the steps view shows only as the shown plane, so every sample count is 0; it also walks the tour (38 steps, it expects 40)'),
  'p3_review_cmd.js': port('render', 'it samples the classic Sphere view\'s two globes (the checker, the two-globe export at 300 dpi): the steps view\'s globe is the shown plane\'s, so the checker cells and the right globe\'s export size (1 × 1) do not match'),
  'p3b_accept_cmd.js': port('render', 'it draws shapes on the X Sphere and targets on the Y Sphere with the classic panes\' helpers and throws at the first one in the steps view: it needs the shown plane\'s globe'),
  'p3bfix_cmd.js': steps({ pin: true }),
  'p5_accept_cmd.js': port('render', 'in the steps view it throws on a missing element or runs 30 minutes with no result: its crack tests draw each scene on the classic right pane\'s SphereMesh'),
  'regions_phase_cmd.js': steps({ pin: true }),
  'regions_phase_classic_cmd.js': classic('the X → Y view\'s Regions pop-up in Y\'s head and its key chip, and the tour\'s Views chapter'),
  'sphere_light_cmd.js': steps({ pin: true }),

  // to port: sound (Pietro's team, #580 and #598)
  'seasong_cmd.js': port('sound', '3 of its checks fail in the steps view (it plays the function, Listen along again plays at once, the samples of a 1366 × 768 page): the example plays its 344 notes, but the checks read the classic layout\'s Listen state'),
  'sound_cmd.js': port('sound', 'it throws in the steps view at an iteration over the chain\'s steps (steps is not iterable)'),
  'sound_v152_cmd.js': port('sound', 'it throws in the steps view when it points the mouse at a classic element that is not there (a missing coordinate)'),

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
