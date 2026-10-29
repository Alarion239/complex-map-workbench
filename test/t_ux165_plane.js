// v16.5 wave 1, the "plane" piece (notes/ux-build/w1-plane-AS-BUILT.md): the logic under UX55 (the chip's three
// choices, the Hyperbolic line tool) on the real graph of src/constr.js. construct.js makes a perpendicular circle with
//   seg = 0 (Whole), seg = segSideOf(C, …) (Inside, and always for the Hyperbolic line tool), seg = −segSideOf(C, …)
// (Outside). Checked here: Inside is the arc inside a circle C (on the first point's side of a line C) through P and Q;
// Outside is the arc on the other side; both arcs end on C; the two arcs together are the whole circle K.
// Also: the source wiring of that rule in construct.js (the tool list, the sign, the name kind 'hyper').
// node test/t_ux165_plane.js
'use strict';
const path = require('path');
const SRC = path.join(__dirname, '..', 'src');
global.CX = require(path.join(SRC, 'cx.js'));
global.Expr = require(path.join(SRC, 'parse.js'));
global.Funcs = require(path.join(SRC, 'funcs.js'));
global.Region = require(path.join(SRC, 'region.js'));
const K = require(path.join(SRC, 'constr.js'));
let pass = 0, fail = 0;
const ok = (c, name) => { if (c) pass++; else { fail++; console.log('FAIL ' + name); } };
const isXY = (z) => Array.isArray(z) && Number.isFinite(z[0]) && Number.isFinite(z[1]);
const UNIT = () => ({ id: 'c', kind: 'circle', c: [0, 0], r: 1, fixed: 'unit' });
const REAL = () => ({ id: 'c', kind: 'line', a: [0, 0], b: [1, 0], fixed: 'real' });
const DISC = () => ({ id: 'c', kind: 'disc', c: [0.5, -0.25], r: 1.5 });
const kdef = (seg) => Object.assign({ op: 'perp', args: [{ s: 'c', part: 0 }, { s: 'p' }, { s: 'q' }], fill: 'none', nk: seg ? 'hyper' : 'circle' }, seg ? { seg } : {});
const scene = (C, P, Q, seg) => ({ shapes: [C, { id: 'p', kind: 'point', p: P }, { id: 'q', kind: 'point', p: Q }, { id: 'k', kind: 'circle', c: [0, 0], r: 1, def: kdef(seg) }], targets: [], steps: [] });
const byId = (st, id) => st.shapes.find((x) => x.id === id);
const load = (st) => { K.validate(st); K.recompute(st, { all: true }, {}); return st; };
const piece = (st, id = 'k') => K.pieces(byId(st, id))[0];
// the chip's rule (construct.js finish(): sm 'in' → segSideOf, 'out' → its negative)
const segFor = (mode, C, P, Q) => { if (mode === 'whole') return 0; const st = load(scene(C, P, Q, 0)); const s = K.segSideOf(byId(st, 'c'), K.pieces(byId(st, 'c'))[0], P, Q); return mode === 'out' ? -s : s; };
const fC = { circle: (C, z) => Math.hypot(z[0] - C.c[0], z[1] - C.c[1]) - C.r, disc: (C, z) => Math.hypot(z[0] - C.c[0], z[1] - C.c[1]) - C.r, line: (C, z) => -z[1] };
let seed = 5;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
for (const [name, mk, rp] of [
  ['unit circle', UNIT, () => { const r = Math.sqrt(rnd()) * 0.95, a = rnd() * 6.283; return [r * Math.cos(a), r * Math.sin(a)]; }],
  ['disc (a region as C)', DISC, () => { const r = Math.sqrt(rnd()) * 1.4, a = rnd() * 6.283; return [0.5 + r * Math.cos(a), -0.25 + r * Math.sin(a)]; }],
  ['real axis', REAL, () => [rnd() * 4 - 2, 0.05 + rnd() * 2]],
]) {
  let n = 0, inBad = 0, outBad = 0, ends = 0, through = 0, undef = 0, cover = 0;
  for (let i = 0; i < 300; i++) {
    const P = rp(), Q = rp(), C = mk();
    const sIn = segFor('in', C, P, Q), sOut = segFor('out', C, P, Q);
    if (!(sIn === 1 || sIn === -1) || sOut !== -sIn) { inBad++; continue; }
    const a = load(scene(mk(), P, Q, sIn)), b = load(scene(mk(), P, Q, sOut));
    if (byId(a, 'k').cundef || byId(b, 'k').cundef) { undef++; continue; }
    n++;
    const pa = piece(a), pb = piece(b);
    const side = (z) => fC[C.kind](C, z);
    // Inside: every interior glide on the inner side (inside the circle; above the real axis, the points' side)
    for (let j = 1; j < 24; j++) { const z = K.glide(pa, j / 24); if (!(isXY(z) && side(z) < 1e-12)) { inBad++; break; } }
    // Outside: every interior glide on the other side (or ∞)
    for (let j = 1; j < 24; j++) { const z = K.glide(pb, j / 24); if (isXY(z) && !(side(z) > -1e-12)) { outBad++; break; } }
    // both arcs end on C, at the same two points
    const e = (pc) => pc.seg.ends.filter(isXY);
    if (e(pa).every((z) => Math.abs(side(z)) < 1e-9) && e(pb).every((z) => Math.abs(side(z)) < 1e-9)) ends++;
    if (K.onPiece(pa, P) && K.onPiece(pa, Q)) through++;
    // together the whole circle: the midpoints of the two arcs are distinct points of K
    const ma = K.glide(pa, 0.5), mb = K.glide(pb, 0.5);
    if (!(isXY(ma) && isXY(mb)) || Math.hypot(ma[0] - mb[0], ma[1] - mb[1]) > 1e-6) cover++;
  }
  console.log(`  ${name}: ${n} pairs; inside off ${inBad}, outside off ${outBad}, ends on C ${ends}, inside through P and Q ${through}, undefined ${undef}`);
  ok(n >= 250, `${name}: enough defined pairs (${n})`);
  ok(inBad === 0, `${name}: Inside (and the Hyperbolic line tool) is the arc on the inner side, the sign ±1`);
  ok(outBad === 0, `${name}: Outside is the arc on the other side`);
  ok(ends === n, `${name}: both arcs end on C`);
  ok(through === n, `${name}: the Inside arc passes through P and Q (the hyperbolic line through them)`);
  ok(cover === n, `${name}: Inside and Outside are the two different arcs of K`);
}
// the wiring in construct.js: the tool, its rule and its name kind
{
  const s = require('./src_text').source('construct.js', { esm: 'strip' });
  ok(/const CTOOLS = \[[^\]]*'hyper'\]/.test(s), 'construct.js: Hyperbolic line is a construct tool');
  ok(/const effSeg = \(tool\) => \(tool === 'hyper' \? hyperMode : segMode\)/.test(s) && /let hyperMode = 'in'/.test(s), 'construct.js: the Hyperbolic line tool is Inside or Between, never Outside');
  ok(/if \(sm === 'out'\) seg = -seg;/.test(s), 'construct.js: Outside is the other sign');
  ok(/nk: seg \|\| sm === 'between' \? 'hyper'/.test(s), 'construct.js: a one-sided result is named as a Hyperbolic line');
  ok(/\['whole', \$tx\('side', 'Whole'\)\], \['in', \$tx\('side', 'Inside'\)\], \['out', \$tx\('side', 'Outside'\)\]/.test(s), 'construct.js: the chip offers the Inspector\'s three choices');
}
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
