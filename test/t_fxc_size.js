// ci/glsl_inline.js and ci/fxc_size.js's --ref check (issue #1545), on fixtures whose counts are known by hand:
// (a) a stage's inlined size is its functions' own texts, each once per copy, from main;
// (b) the copies of each function, with the stage's #if, #ifdef, #elif and #else resolved first: a branch the
//     preprocessor drops is not counted;
// (c) the loops flagged: a constant trip bound (a literal, a #define, a const) whose body reaches the chain; not one
//     guarded by a uniform, nor one that calls no chain function;
// (d) the preprocessor's rules (defined, an undefined name is 0, #undef, nesting) and its errors;
// (e) --ref: a program whose inlined size doubled is caught, so is a new one over 100 KB; an unchanged one, a new one
//     under 100 KB and growth under the limits are not.
// Run: node test/t_fxc_size.js
const { preprocess, inline } = require('../ci/glsl_inline.js');
const { compare, LIMITS } = require('../ci/fxc_size.js');
let fails = 0, n = 0;
const ok = (c, msg) => { n++; if (!c) { fails++; console.log('FAIL', msg); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg}: ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);

// (a) three functions written out: main once, f once, g twice
{
  const G = 'float g(float x) { return x * 2.0; }', F = 'float f(float x) { return g(x) + g(x + 1.0); }', M = 'void main() { gl_FragColor = vec4(f(1.0)); }';
  const r = inline(['precision highp float;', G, '// g(1.0) in a comment is no call', F, M].join('\n'));
  eq(r.size, M.length + F.length + 2 * G.length, '(a) the inlined size is main, f and g twice');
  eq([...r.copies], [['main', 1], ['f', 1], ['g', 2]], '(a) copies');
}

// (b), (c): the copies of a stage with conditionals and loops, counted by hand
const STAGE = `#version 300 es
precision highp float;
#define N_STEPS 4
#define USE_EXTRA 1
const int K = 3;
uniform int uNoUnroll;
out vec4 o;
vec2 cdiv(vec2 a, vec2 b) { return vec2(dot(a, b), a.y * b.x - a.x * b.y) / dot(b, b); }
vec2 carg2(vec2 a) { return vec2(atan(a.y, a.x), 0.0); }
vec2 cxs1_f(vec2 z) { return cdiv(z, carg2(z)) + cdiv(z, z); }
vec2 chainRange(vec2 z, int a, int b) { return cxs1_f(cxs1_f(z)); }
#if USE_EXTRA && N_STEPS >= 4
vec2 extra(vec2 z) { return cdiv(z, z); }
#else
vec2 extra(vec2 z) { return chainRange(chainRange(chainRange(z, 0, 1), 0, 1), 0, 1); }
#endif
#ifdef MISSING
vec2 never(vec2 z) { return chainRange(z, 0, 1); }
#endif
void main() {
  vec2 z = gl_FragCoord.xy;
  for (int i = 0; i < N_STEPS; i++) z = chainRange(z, 0, 1);
  for (int i = 0; i < max(K, uNoUnroll); i++) { z = chainRange(z, 0, 1); }
  for (int i = 1; i <= K; i++) z = extra(z);
  /* chainRange(z, 0, 1) in a comment */
  z = extra(z);
  o = vec4(z, 0.0, 1.0);
}
`;
{
  const r = inline(STAGE);
  // main: chainRange 2 (one in each of two loops), extra 2; chainRange: cxs1_f 2 each; cxs1_f: cdiv 2, carg2 1 each;
  // extra: cdiv 1 each
  eq([...r.copies].sort(), [['carg2', 4], ['cdiv', 10], ['chainRange', 2], ['cxs1_f', 4], ['extra', 2], ['main', 1]], '(b) copies, with #if resolved');
  let sum = 0;
  for (const [fn, k] of r.copies) sum += k * r.own.get(fn);
  eq(r.size, sum, '(b) the inlined size is the sum of copies × own size');
  eq(r.loops.map((l) => [l.fn, l.bound, l.trip, l.copies, l.chain]), [['main', 'i < N_STEPS', 4, 1, ['chainRange']]], '(c) the one loop flagged');
  ok(r.loops[0].size > r.own.get('chainRange'), '(c) one trip holds the inlined chain');
}

// (d) the preprocessor
{
  const text = (src) => preprocess(src).text.split('\n').filter((l) => l.trim()).join(' ');
  eq(text('#define A 2\n#if A >= 2 && defined(A) && !defined(B)\nyes\n#else\nno\n#endif'), 'yes', '(d) #if with defined');
  eq(text('#if UNDEFINED\nno\n#elif 1\nyes\n#else\nno\n#endif'), 'yes', '(d) an undefined name is 0; #elif');
  eq(text('#define A\n#undef A\n#ifdef A\nno\n#endif\n#ifndef A\nyes\n#endif'), 'yes', '(d) #undef');
  eq(text('#if 0\n#if 1\nno\n#endif\n#elif 1\nyes\n#endif'), 'yes', '(d) an #if inside a dropped branch');
  eq(text('#if 1\nyes\n#elif (unsupported / 2)\nno\n#endif'), 'yes', '(d) an #elif after a branch taken is not evaluated');
  eq([...preprocess('#define N 3\n#define F(x) (x)').defines], [['N', '3'], ['F', null]], '(d) the defines');
  const throws = (src) => { try { preprocess(src); return false; } catch (e) { return true; } };
  ok(throws('#if 1\nx'), '(d) #if without #endif throws');
  ok(throws('#endif'), '(d) #endif without #if throws');
  ok(throws('#if 4 / 2\n#endif'), '(d) an #if it cannot evaluate throws');
}

// (e) --ref: the same program with its heavy function called twice instead of once
{
  const heavy = `float heavy(float x) {\n${'  x = x * 1.0001 + sin(x);\n'.repeat(1800)}  return x;\n}\n`;
  const prog = (calls) => `precision highp float;\n${heavy}void main() { float x = 1.0;${' x = heavy(x);'.repeat(calls)} gl_FragColor = vec4(x); }\n`;
  const row = (id, size) => ({ id, scene: 'fixture', vs: { size: 100 }, fs: { size } });
  const once = inline(prog(1)).size, twice = inline(prog(2)).size;
  ok(once > LIMITS.GROW_KB * 1024 && twice > 1.9 * once, `(e) the fixture: ${once} characters once, ${twice} twice`);
  eq(compare([row('p', twice)], [row('p', once)]).map((f) => [f.id, f.stage, f.now, f.was]), [['p', 'fs', twice, once]], '(e) a doubled program is caught');
  eq(compare([row('p', once)], [row('p', once)]), [], '(e) an unchanged program passes');
  eq(compare([row('p', once), row('q', 101 * 1024)], [row('p', once)]).map((f) => f.id), ['q'], '(e) a new program over 100 KB is caught');
  eq(compare([row('p', once), row('q', 99 * 1024)], [row('p', once)]), [], '(e) a new program under 100 KB passes');
  eq(compare([row('p', 30 * 1024)], [row('p', 15 * 1024)]), [], '(e) growth of a program under 40 KB passes');
  eq(compare([row('p', 1.15 * once)], [row('p', once)]), [], '(e) growth under 20 % passes');
}

console.log(`${n - fails} of ${n} checks pass`);
process.exit(fails ? 1 : 0);
