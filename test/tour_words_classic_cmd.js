// The tour's words follow two things apart: place words (where a control is: "the Inspector", "the steps button under
// the planes") follow the LAYOUT, desk or phone (the `ph` class); gesture words (click, tap, scroll, pinch) follow the
// POINTER, fine or coarse. The four combinations, each in a real emulated environment, in en, ru and it:
//   desk layout + mouse (1440 wide), desk layout + touch (1024 wide, a tablet or a touch laptop),
//   phone layout + touch (390 wide), phone layout + mouse (a narrow window, 600 wide).
// Per step with place and gesture words (basics/chain, basics/add, edit/inspector, analysis/domain), the live copy is
// the one meant for that combination and the four are different. This is the classic views' tour (ci/suite_views.js:
// classic): the steps view's tour is test/tour_words_cmd.js, and the walk is test/lib/tour_words_kit.js. A command file
// for a CDP daemon:  <runner> test/tour_words_classic_cmd.js
const WORDS = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'tour_words_kit.js'), 'utf8'));
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
return WORDS.run({ ev, go, settled, isSteps, view, logs, base: `http://localhost:${PORT}`, wantSteps: false,
  steps: [['basics', 'chain'], ['basics', 'add'], ['edit', 'inspector'], ['analysis', 'domain']], fourCopies: ['basics/chain', 'basics/add', 'analysis/domain'] });
