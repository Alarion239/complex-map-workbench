// loads the xvr-final-snap sources the way work/xvr/test/t_recognize.js does
const path = require('path');
const R = path.resolve(__dirname, '../../../work/xvr-final-snap');
global.CX = require(R + '/src/cx.js'); global.Expr = require(R + '/src/parse.js');
global.Funcs = require(R + '/src/funcs.js'); global.Region = require(R + '/src/region.js');
global.Inverse = require(R + '/src/inverse.js'); global.Recognize = require(R + '/src/recognize.js');
module.exports = { R };
