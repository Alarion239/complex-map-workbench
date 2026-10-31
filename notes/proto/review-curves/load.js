// shared loader for the adversarial review scripts (node notes/proto/review-curves/<x>.js)
const path = require('path');
const src = (f) => path.join(__dirname, '../../../src', f);
global.CX = require(src('cx.js'));
global.Expr = require(src('parse.js'));
global.Funcs = require(src('funcs.js'));
global.Region = require(src('region.js'));
const Curves = require(src('curves.js'));
const P = (s) => Expr.parse(s, { allowRel: true });
const W = (x0, x1, y0, y1) => ({ x0, x1, y0, y1 });
module.exports = { Curves, P, W, C: CX.C };
