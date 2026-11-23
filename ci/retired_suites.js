'use strict';
// The test files deleted on purpose (ci/standards.js, its retired rule), one line each: the file's name under test/ and
// the reason it goes, with what covers what it checked, or why nothing needs to. The change that deletes a suite adds
// its line here and drops it from what runs: from ci/suite_views.js and ci/browser_shards.js, or from
// ci/browser_suites.js' EXCLUDED. The standards check then does not count the suite's assertions as dropped, and
// test/t_standards.js checks that no file named here is still in test/.
const RETIRED = {
};
module.exports = { RETIRED };
