// ci/glsl.js's settlePending: the inverse page's programs that had not linked when its wait ran out (the page's
// result's pending: the cases' names). On WARP (Direct3D 11's software renderer, the hosted Windows runner) a link
// takes from seconds to minutes, so up to PENDING_MAX cases pending there are named in the page's note and decide
// nothing; more than that on WARP (the page's coverage lost, as an FXC compile blown up past the wait would lose it), or
// any on another renderer, is a fault, and each pending case is an error, as before. Node, no browser.
// Run: node test/t_glsl_pending.js
'use strict';
const { settlePending, PENDING_MAX } = require('../ci/glsl');
let pass = 0, fail = 0;
const ok = (name, cond, got) => { if (cond) pass++; else { fail++; console.log('FAIL ' + name + (got !== undefined ? ' ' + JSON.stringify(got).slice(0, 600) : '')); } };

const WARP = 'ANGLE (Microsoft, Microsoft Basic Render Driver (0x0000008C) Direct3D11 vs_5_0 ps_5_0, D3D11)';
const SWIFT = 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)';
const CASE = 'quartic mobius > (1-i)z^4+2z^3+0.5iz-1';
const page = (renderer, pending) => ({ renderer, pending, errors: ['rand#9 exp: prepare boom'] });

// WARP: named in the note, no error added, not a fault
let r = page(WARP, [CASE]), s = settlePending(r);
ok('WARP: a pending case is no fault', s.fault === false, s);
ok('WARP: no error is added for it', r.errors.length === 1, r.errors);
ok('WARP: the note names the case and says it was not compared', s.note.includes(CASE) && /not linked/.test(s.note) && /not compared/.test(s.note), s.note);

// another renderer: each pending case is an error, in the page's old words, and a fault
r = page(SWIFT, [CASE, 'quartic poly z^4+z^3-2z+1']); s = settlePending(r);
ok('another renderer: a pending case is a fault', s.fault === true, s);
ok('another renderer: each pending case is an error, as the page wrote it before', r.errors.length === 3 && r.errors[1] === `${CASE}: gpu pending` && r.errors[2] === 'quartic poly z^4+z^3-2z+1: gpu pending', r.errors);

// no renderer read (the browser could not say): not WARP, so a fault
r = page(null, [CASE]); s = settlePending(r);
ok('no renderer: a pending case is a fault', s.fault === true && r.errors.length === 2, { s, e: r.errors });

// nothing pending, or a result from before the field (the reference's older page): nothing changes
for (const pend of [[], undefined]) {
  r = page(WARP, pend); s = settlePending(r);
  ok(`nothing pending (${pend ? '[]' : 'no field'}): no note, no fault, the errors as they were`, s.note === '' && s.fault === false && r.errors.length === 1, { s, e: r.errors });
}

// WARP at the cap: PENDING_MAX cases are named, no fault
const names = (n) => Array.from({ length: n }, (_, i) => `rand#${i} recip`);
r = page(WARP, names(PENDING_MAX)); s = settlePending(r);
ok(`WARP: ${PENDING_MAX} pending cases (the cap) are named and no fault`, PENDING_MAX >= 1 && PENDING_MAX <= 5 && s.fault === false && r.errors.length === 1 && names(PENDING_MAX).every((x) => s.note.includes(x)), { s, e: r.errors });

// WARP past the cap: the coverage lost is a fault, each case an error; the note counts them, names the first five and counts the rest
r = page(WARP, names(9)); s = settlePending(r);
ok(`WARP: more than ${PENDING_MAX} pending cases are a fault, each an error`, s.fault === true && r.errors.length === 10 && r.errors[9] === 'rand#8 recip: gpu pending', { s, e: r.errors.slice(-2) });
ok('WARP past the cap: the note says so, names the first five and counts the rest', /^; 9 not linked/.test(s.note) && s.note.includes(`more than ${PENDING_MAX}`) && s.note.includes('rand#4 recip') && !s.note.includes('rand#5 recip') && /4 more/.test(s.note), s.note);
r = page(WARP, names(PENDING_MAX + 1)); s = settlePending(r);
ok(`WARP: ${PENDING_MAX + 1} pending cases (one past the cap) are a fault`, s.fault === true && r.errors.length === PENDING_MAX + 2, { s, e: r.errors });

console.log(`t_glsl_pending: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
