// The numbers the CPU's evaluation of an infinite sum shares with the GPU's (src/parse.js, src/glsl.js): the page says where the GPU
// leaves a plot blank by evaluating the plot's steps on the CPU with the same stop rule, so the cap the CPU stops at, Expr's
// SER_CAP, is the GPU's loop, SER_GPU_LOOP, and the terms a pixel may take in all, Expr's SER_BUDGET, are the GPU's SER_GPU_TERMS.
// If one moves, the note's "within N terms" or its budget is false at the points between them.
// Run: node test/t_sum_caps.js
global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
global.Funcs = require('../src/funcs.js');
global.Region = require('../src/region.js');
global.Curves = require('../src/curves.js');
const GLChain = require('../src/glsl.js');
global.GLChain = GLChain;
let fails = 0, n = 0;
const ok = (c, msg, info) => { n++; if (!c) { fails++; console.log('FAIL', msg, info === undefined ? '' : JSON.stringify(info)); } };
ok(typeof GLChain.LOOP_CAP === 'number' && Expr.SER_CAP === GLChain.LOOP_CAP, 'the CPU\'s SER_CAP is the GPU\'s SER_GPU_LOOP', { cpu: Expr.SER_CAP, gpu: GLChain.LOOP_CAP });
ok(typeof GLChain.TERMS_BUDGET === 'number' && Expr.SER_BUDGET === GLChain.TERMS_BUDGET, 'the CPU\'s SER_BUDGET is the GPU\'s SER_GPU_TERMS', { cpu: Expr.SER_BUDGET, gpu: GLChain.TERMS_BUDGET });
console.log(fails ? `${fails} of ${n} checks FAILED` : `all ${n} checks pass`);
process.exit(fails ? 1 : 0);
