'use strict';
// The Tour module for the unit tests: src/tour.js is a stand-in for node (its code is in src/tour/'s parts, which the
// bundle and build.py join), so this joins the parts (test/src_text.js) and runs them. Like the module, it reads
// globalThis.I18N when it loads.
//   const { Tour } = require('./lib/tour');
const { source } = require('../src_text');
const text = source('tour.js', { esm: 'strip' });
module.exports = new Function(text + '\n;return { Tour };')();
