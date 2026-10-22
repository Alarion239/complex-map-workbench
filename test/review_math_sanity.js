// Reviewer scratch: make sure the fuzz detectors fire on known-bad claims.
global.CX = require('../src/cx.js'); global.Expr = require('../src/parse.js');
const Funcs = require('../src/funcs.js');
const real = Funcs.build;
Funcs.build = (s) => { const b = real(s); if (s.type === 'exp' || s.type === 'pown') { b.props = Object.assign({}, b.props, { injective: true, mobius: true, constant: s.type === 'exp' }); } return b; };
process.argv[2] = '3'; process.argv[3] = '3000';
require('./review_math_fuzz.js');
