// The tour's completion conditions and auto-advance in the classic view, which has steps the steps view's tour lacks (the view
// switch's doors, the Riemann sphere's turn, X's pan): the same checks as
// test/tour_auto_cmd.js, run against the classic views (ci/suite_views.js: classic). A command file for a CDP daemon:
// <runner> test/tour_auto_classic_cmd.js
const SRC = fs.readFileSync(path.join(DIR, '..', 'tour_auto_cmd.js'), 'utf8');
return eval('(async () => {' + SRC + '\n})()');
