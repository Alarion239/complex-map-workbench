'use strict';
// why do fan ring pieces of sin(half-strip) not go quiet?
const { Mesher } = require('./sphm_lead.js');
const Region = require('../../../src/region.js');
const step = (type, params = {}) => Funcs.build({ type, params: Object.assign(Funcs.defaults(type), params) });
const b = step('sin');
const why = {};
const M = Mesher({ F: b.f, steps: [b], injective: false, shape: { kind: 'formula', expr: '|\\Re z|<\\frac{\\pi}{2}, \\Im z>0' }, left: { cx: 0, cy: 1.25, s: 105, W: 410, H: 516 }, view: { kind: 'flat', cx: 0, cy: 2, s: 50, W: 410, H: 516 }, pattern: 'checker', cell: 0.5, alpha: 0.85,
  qtrace: (t, r, w) => { const k = r ? 'quiet' : w; why[k] = (why[k] || 0) + 1; } });
M.run(20000);
console.log(why);
