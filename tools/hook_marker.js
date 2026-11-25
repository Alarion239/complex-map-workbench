'use strict';
// The test hooks the published page does without. A hook block runs from an opening marker line to the next closing marker,
//   // TEST-HOOK (dropped from the published page by build.py)
//   ...the hook's code...
//   // TEST-HOOK
// and tools/bundle.mjs drops it from each source file of the published bundle; build.py drops what is left (the same
// regular expression, its own copy in Python). The opening text is the build's contract: test/t_publish.js checks that
// every marker in the sources belongs to a block, that build.py carries this expression, and that no marker reaches the
// published page.
const OPEN = '// TEST-HOOK (dropped from the published page by build.py)';
const CLOSE = '// TEST-HOOK';
// (the expression's source, written the same for JavaScript and Python)
const OPEN_SRC = 'TEST-HOOK \\(dropped from the published page by build\\.py\\)';
const BLOCK_SRC = '\\n[ \\t]*// ' + OPEN_SRC + '.*?// TEST-HOOK\\n';
// ANY: a marker, so that one outside a block is counted and fails t_publish; OPENER: an opening line
module.exports = { OPEN, CLOSE, OPEN_SRC, BLOCK_SRC, BLOCK: new RegExp(BLOCK_SRC, 'gs'), ANY: /\/\/ TEST-HOOK\b/g, OPENER: new RegExp('// ' + OPEN_SRC, 'g') };
