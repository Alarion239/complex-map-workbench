// The task lines of the classic views' tour (Y's drag, Targets, Cauchy), which the steps view's
// tour words differently or lacks: the same checks as test/tour_tasks_cmd.js, run against the classic views (ci/suite_views.js:
// classic). A command file for a CDP daemon:  <runner> test/tour_tasks_classic_cmd.js
const SRC = fs.readFileSync(path.join(DIR, '..', 'tour_tasks_cmd.js'), 'utf8');
return eval('(async () => {' + SRC + '\n})()');
