// The sheets' vertex shader (LAND_SHEET_VS main): the slots after a triangle's first (they belong to the clip polygon)
// leave before the carried corners' fetches (uCP) when the triangle is inside the block, so the 6 of every 9 slots that
// draw nothing cost no texture fetch of the carry. Checks the order of the statements in the shader's source.
// Run: node test/t_land_sheet_slots.js
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'gl', '03-glsl-3d.js'), 'utf8');
let fails = 0;
const ok = (c, msg) => { if (!c) { fails++; console.log('FAIL', msg); } };
const at = src.indexOf('const LAND_SHEET_VS');
ok(at >= 0, 'LAND_SHEET_VS is found');
const m0 = src.indexOf('void main()', at);
const main = src.slice(m0, src.indexOf('\n}\n', m0));
const early = main.indexOf('if (sub > 0 && ');
const fetchCP = main.indexOf('texelFetch(uCP, po + A');
ok(early > 0, 'a slot after the first leaves early for a triangle inside the block');
ok(fetchCP > 0, 'main fetches the carried corners');
ok(early < fetchCP, 'the early leave comes before the carried corners are fetched');
ok(main.indexOf('texelFetch(uCP') === fetchCP, 'no other fetch of the carry comes before it');
ok(main.indexOf('sub > 0') === early + 4, 'no earlier test of the slot');
console.log(fails ? fails + ' failed' : 'ok');
process.exit(fails ? 1 : 0);
