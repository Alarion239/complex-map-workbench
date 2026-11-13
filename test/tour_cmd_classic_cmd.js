// The guided tour in the classic views, whose tour has steps and chapters the steps view's lacks (X's pan task and the arrow
// keys that step it from the strip, the Views chapter's view switch, Phase, Sphere and Phase key, the Deformation chapter's
// Paths, All steps at once and Part of the chain, the preimages hint): the same checks as test/tour_cmd.js, run against the
// classic views (ci/suite_views.js: classic). A command file for a CDP daemon:  <runner> test/tour_cmd_classic_cmd.js
const SRC = fs.readFileSync(path.join(DIR, '..', 'tour_cmd.js'), 'utf8');
return eval('(async () => {' + SRC + '\n})()');
