'use strict';
// GLChain for the unit tests: src/glsl.js is a stand-in for node (its code is in src/glsl/'s parts, which the bundle and
// build.py join), so this joins the parts (test/src_text.js) and runs them with the modules glsl.js imports.
//   const GLChain = require('./lib/glchain');
const { source } = require('../src_text');
const ROOT = require('path').join(__dirname, '..', '..');
const text = source('glsl.js', { esm: 'strip' });
module.exports = new Function('CX', 'Expr', 'Funcs', 'Inverse', text + '\n;return GLChain;')(
  require(ROOT + '/src/cx.js'), require(ROOT + '/src/parse.js'), require(ROOT + '/src/funcs.js'), require(ROOT + '/src/inverse.js'));
