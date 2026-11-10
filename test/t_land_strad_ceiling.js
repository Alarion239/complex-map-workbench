// The straddling cells' list (src/gl/03-glsl-3d.js, src/gl/06-draws-3d.js) is a layer's: it holds the MIX cells of one grid, a grid has at most
// (LAND_CLASS_LOOP - 1)^2 cells (the class passes loop over at most LAND_CLASS_LOOP cells of a row, and the draw throws for a wider grid), so the list's
// ceiling LAND_STRAD_K_MAX must be at least that, or a grid at the loop's limit would have its list cut off. A larger LAND_CLASS_LOOP fails this at once.
//   node test/t_land_strad_ceiling.js
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'gl', '03-glsl-3d.js'), 'utf8');
let n = 0, fails = 0;
const ok = (name, c, info) => { n++; if (!c) { fails++; console.log('FAIL', name, info === undefined ? '' : JSON.stringify(info)); } };
const num = (name) => { const m = src.match(new RegExp('\\b' + name + '\\s*=\\s*([^,;]+)[,;]')); return m ? Function('return (' + m[1] + ')')() : NaN; };
const LOOP = num('LAND_CLASS_LOOP'), K_MAX = num('LAND_STRAD_K_MAX'), K0 = num('LAND_STRAD_K'), W = num('LAND_STRAD_W');
ok('the constants are read from the source', [LOOP, K_MAX, K0, W].every(Number.isFinite), { LOOP, K_MAX, K0, W });
ok(`a grid of at most ${LOOP} points a side has ${(LOOP - 1) ** 2} cells, within the list's ceiling ${K_MAX}`, (LOOP - 1) ** 2 <= K_MAX, { LOOP, K_MAX });
ok('the ceiling is a power of two and a multiple of the list texture width', Number.isInteger(Math.log2(K_MAX)) && K_MAX % W === 0, { K_MAX, W });
ok('the first capacity is a power of two and a multiple of the list texture width', Number.isInteger(Math.log2(K0)) && K0 % W === 0, { K0, W });
const LOOP_WIDER = 2 * LOOP;
ok(`control: a loop of ${LOOP_WIDER} points would not fit the ceiling (${(LOOP_WIDER - 1) ** 2} cells over ${K_MAX}), so the check above can fail`, (LOOP_WIDER - 1) ** 2 > K_MAX, { LOOP_WIDER, K_MAX });
console.log(fails ? `${fails} of ${n} failed` : `all ${n} passed`);
process.exit(fails ? 1 : 0);
