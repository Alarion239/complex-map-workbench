const path = require('path');
const R = '<project>/work/xvr-final-snap';
global.CX = require(R + '/src/cx.js'); global.Expr = require(R + '/src/parse.js');
global.Funcs = require(R + '/src/funcs.js'); global.Region = require(R + '/src/region.js');
global.Inverse = require(R + '/src/inverse.js'); global.Recognize = require(R + '/src/recognize.js');
for (const [id, d] of Object.entries(Funcs.DEFS)) console.log(id, JSON.stringify(d.params.map(p => [p.key, p.type, p.def, p.min, p.max])));
