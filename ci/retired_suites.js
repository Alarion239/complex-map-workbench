'use strict';
// The test files deleted on purpose (ci/standards.js, its retired rule), one line each: the file's name under test/ and
// the reason it goes, with what covers what it checked, or why nothing needs to. The change that deletes a suite adds
// its line here and drops it from what runs: from ci/suite_views.js and ci/browser_shards.js, or from
// ci/browser_suites.js' EXCLUDED. The standards check then does not count the suite's assertions as dropped, and
// test/t_standards.js checks that no file named here is still in test/.
const RETIRED = {
  'export_deform_classic_cmd.js': 'the classic views\' deformation export (X → Y, Phase, globe and Landscape figures and videos) needs the classic transport, gone in #994; the steps view\'s export is export_deform_cmd, export_steps_cmd and export_glide_cmd',
  'morphfig_classic_cmd.js': 'the classic transport\'s paths figure (pathsGen\'s selection on the Y pane), gone with the transport in #994; the steps view\'s paths figure is morphfig_cmd',
  'sound_v152_deform_classic_cmd.js': 'the loop singing while the classic Deformation plays, and Esc during it: that transport is gone (#994); the steps view\'s sound suites (sound_steps_cmd, steps_sound_name_cmd) are unaffected',
  'rel162_sheets_cmd.js': 'All sheets on a Landscape while the classic Deformation is at t, gone with the transport (#994); the steps view\'s sheets during a glide are export_cmd#user5-deform-steps, steps_sheet_dedupe and sv_all_sheets (row by row on #994\'s PR)',
  'sheets_deform_cmd.js': 'All sheets while the classic Deformation plays, gone with the transport (#994); the steps view\'s are sv_all_sheets, steps_glide_sheets, steps_sheet_dedupe, steps_land_sheets_h and export_cmd#user5-deform-steps (row by row on #994\'s PR; the Landscape and sphere glides: #1413)',
  'sound_deform_cmd.js': 'the probe\'s cues while the classic Deformation plays (sections A to E, and H\'s Deformation steps), gone with the transport (#994); its other rows, a zero dragged by a still probe, sound off and the layout changed under it (F, G, H), are sound_still_probe_cmd, which sound_cmd runs',
  'sound_deform_fps_cmd.js': 'a benchmark of frames while the classic Deformation plays, gone with the transport (#994)',
  'sound_v152_fps_cmd.js': 'a benchmark of frames while the classic Deformation plays with Hear the function, gone with the transport (#994)',
  'sound_deform_clicks_cmd.js': 'a recorder of audio while the classic Deformation plays, gone with the transport (#994)',
  'deform_nat_fps_cmd.js': 'a benchmark of the classic transport\'s natural paths, gone with it (#994); the steps view\'s paths are deform_nat_cmd',
  'deform_range_fps_cmd.js': 'a benchmark of the classic transport with a bracket, gone with it (#994); the perf suites on the GPU machines time the steps view\'s glides',
  'sheets_film_cmd.js': 'a screenshot writer of the sheets while the classic Deformation plays, gone with the transport (#994)',
  'pane_heads_1024_cmd.js': 'Y\'s pane head beside the Inspector at 1024 and 1100 px: Y\'s pane is not drawn in either view since #994, so it has no head; the steps view\'s one head is steps_head_cmd\'s and layout_invariants_cmd\'s',
  'ux165_merge_classic_cmd.js': 'Y\'s head with its "Y · " tag in the classic view: Y\'s pane is not drawn since #994, so it has no head; the rest of the merged look is ux165_merge_cmd\'s',
  'curves_target_legend_classic_cmd.js': 'the target legend in Y\'s head note (#rightNote) in the classic view: Y\'s pane is not drawn since #994, so it has no head; the steps view\'s legend is curves_target_legend_cmd\'s',
  'phone_swap_cmd.js': 'the phone\'s two planes, X and Y, keeping their views through swaps, sheets, rotations and languages: the classic view draws X alone since #994, as the steps view does; the phone\'s one plane is phone_plane_cmd\'s',
  'tour_auto_classic_cmd.js': 'the classic views\' tour tasks with real input (the view switch\'s doors, Phase key, X\'s pan, the preimages hint, the Deformation\'s Part of the chain): the tour\'s classic chapters are deleted (#997); the steps view\'s are tour_auto_cmd',
  'tour_cmd_classic_cmd.js': 'the classic views\' tour (X\'s pan task, the strip\'s arrow keys, the Views and Deformation chapters): the tour\'s classic chapters are deleted (#997); the steps view\'s is tour_cmd',
  'tour_phone_classic_cmd.js': 'the classic views\' tour on a phone (X\'s 608 px under the chain bar, the Phase key sheet below the strip): the tour\'s classic chapters are deleted (#997); the steps view\'s is tour_phone_cmd',
  'tour_tasks_classic_cmd.js': 'the classic views\' tour task lines (Y\'s drag, the classic desk cases): the tour\'s classic chapters are deleted (#997); the steps view\'s are tour_tasks_cmd',
  'tour_words_classic_cmd.js': 'the classic views\' tour words, the Basics chapter\'s chain step included: the tour\'s classic chapters are deleted (#997); the steps view\'s is tour_words_cmd',
};
module.exports = { RETIRED };
