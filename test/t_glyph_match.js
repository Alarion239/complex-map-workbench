// The glide tile's glyph matching (#2409, src/glyphmatch.js): which glyphs of one formula are the same glyphs of the
// next. On glyph lists written out for four changes of formula (each glyph its class and where it stands, one unit a
// glyph, from the formula's left edge and its baseline; a superscript higher, y < 0):
//   abc → abbc                a, b and c go to a, the first b and c; the second b comes
//   x²+6x=−5 → x²+6x+9=4      x, ², +, 6, x and = go to theirs, = moving 2; − and 5 go, the second +, 9 and 4 come
//   a^{aa} → a^{a^a}          the three a's go to the three a's, each to the one nearest
//   (ij)²=−1 → ijij=−1        i, j, =, − and 1 go to theirs; (, ) and ² go, the other i and j come
// and: the assignment (hungarian) is the least cost one, against every permutation of random matrices up to 6 x 6; a
// pair of different classes is never made; two empty lists match to nothing; the classes of MathJax's glyph ids (the
// per-formula prefix dropped, a delimiter one class whatever its size) and of rules; the ease and the fades.
// Run: node test/t_glyph_match.js
const vm = require('vm');
const src = require('./src_text').source('glyphmatch.js', { esm: 'strip' });
const ctx = vm.createContext({});
vm.runInContext(src + '\n;globalThis.GlyphMatch = GlyphMatch;', ctx, { filename: 'glyphmatch.js' });
const G = ctx.GlyphMatch;
let pass = 0, fail = 0;
const ok = (name, cond, got) => { if (cond) pass++; else { fail++; console.log('FAIL', name, got === undefined ? '' : JSON.stringify(got)); } };
// a formula as glyphs: [class, x, y]
const F = (list) => list.map(([k, x, y]) => ({ k, x, y: y || 0 }));
const named = (a, b, m) => ({ pairs: m.pairs.map(([i, j]) => `${a[i].k}@${a[i].x}→${b[j].x}`), gone: m.gone.map((i) => a[i].k), come: m.come.map((j) => b[j].k) });
const moved = (a, b, m) => m.pairs.reduce((s, [i, j]) => s + Math.hypot(a[i].x - b[j].x, a[i].y - b[j].y), 0);
{
  const a = F([['a', 0], ['b', 1], ['c', 2]]), b = F([['a', 0], ['b', 1], ['b', 2], ['c', 3]]), m = G.match(a, b), n = named(a, b, m);
  ok('abc → abbc: a, b and c go to a, the first b and c', JSON.stringify(n.pairs) === JSON.stringify(['a@0→0', 'b@1→1', 'c@2→3']), n);
  ok('abc → abbc: nothing goes, the second b comes', n.gone.length === 0 && JSON.stringify(m.come) === '[2]', n);
}
{
  const a = F([['x', 0], ['2', 1, -0.5], ['+', 2], ['6', 3], ['x', 4], ['=', 5], ['−', 6], ['5', 7]]);
  const b = F([['x', 0], ['2', 1, -0.5], ['+', 2], ['6', 3], ['x', 4], ['+', 5], ['9', 6], ['=', 7], ['4', 8]]);
  const m = G.match(a, b), n = named(a, b, m);
  ok('x²+6x=−5 → x²+6x+9=4: x, ², +, 6, x and = matched', m.pairs.length === 6 && JSON.stringify(n.pairs.map((p) => p.split('@')[0])) === JSON.stringify(['x', '2', '+', '6', 'x', '=']), n);
  ok('x²+6x=−5 → x²+6x+9=4: each of the first five stays, = moves 2', moved(a, b, m) === 2 && n.pairs.includes('+@2→2') && n.pairs.includes('=@5→7'), n);
  ok('x²+6x=−5 → x²+6x+9=4: − and 5 go; the second +, 9 and 4 come', JSON.stringify(n.gone) === JSON.stringify(['−', '5']) && JSON.stringify(n.come) === JSON.stringify(['+', '9', '4']), n);
}
{
  const a = F([['a', 0], ['a', 1, -0.5], ['a', 1.6, -0.5]]), b = F([['a', 0], ['a', 1, -0.5], ['a', 1.6, -0.9]]), m = G.match(a, b);
  ok('a^{aa} → a^{a^a}: the three a\'s go to the three a\'s, each to the one nearest', m.pairs.length === 3 && m.pairs.every(([i, j]) => i === j) && Math.abs(moved(a, b, m) - 0.4) < 1e-9, named(a, b, m));
}
{
  const a = F([['(', 0], ['i', 1], ['j', 2], [')', 3], ['2', 4, -0.5], ['=', 5], ['−', 6], ['1', 7]]);
  const b = F([['i', 0], ['j', 1], ['i', 2], ['j', 3], ['=', 4], ['−', 5], ['1', 6]]);
  const m = G.match(a, b), n = named(a, b, m);
  ok('(ij)²=−1 → ijij=−1: i, j, =, − and 1 matched', JSON.stringify(n.pairs.map((p) => p.split('@')[0])) === JSON.stringify(['i', 'j', '=', '−', '1']), n);
  ok('(ij)²=−1 → ijij=−1: (, ) and ² go; an i and a j come', JSON.stringify(n.gone) === JSON.stringify(['(', ')', '2']) && JSON.stringify(n.come.sort()) === JSON.stringify(['i', 'j']), n);
}
// (never a pair of two classes, and nothing from nothing)
{
  const a = F([['p', 0], ['q', 1]]), b = F([['q', 0], ['p', 1], ['r', 2]]), m = G.match(a, b);
  ok('different classes are never paired', m.pairs.every(([i, j]) => a[i].k === b[j].k) && m.pairs.length === 2, named(a, b, m));
  const e = G.match([], []);
  ok('two empty lists: no pairs', e.pairs.length === 0 && e.gone.length === 0 && e.come.length === 0, e);
  const one = G.match(F([['p', 0]]), []);
  ok('one glyph to none: it goes', one.pairs.length === 0 && JSON.stringify(one.gone) === '[0]', one);
}
// (the assignment against every permutation)
{
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const perms = (n) => { const out = []; const go = (p, rest) => { if (!rest.length) out.push(p); rest.forEach((x, k) => go(p.concat([x]), rest.filter((_, q) => q !== k))); }; go([], [...Array(n).keys()]); return out; };
  let bad = null;
  for (let t = 0; t < 120 && !bad; t++) {
    const n = 1 + (t % 6), c = [...Array(n)].map(() => [...Array(n)].map(() => Math.round(rnd() * 20)));
    const col = G.hungarian(c), got = col.reduce((s, j, i) => s + c[i][j], 0);
    const best = Math.min(...perms(n).map((p) => p.reduce((s, j, i) => s + c[i][j], 0)));
    if (got !== best || new Set(col).size !== n) bad = { c, col, got, best };
  }
  ok('the assignment is the least cost one, against every permutation (120 matrices up to 6 x 6)', !bad, bad);
}
// (the classes)
ok('a glyph\'s class: its id less the formula\'s prefix', G.glyphClass('#MJX-3-STX-I-1D467', '1D467') === 'STX-I-1D467' && G.glyphClass('MJX-12-STX-I-1D467') === 'STX-I-1D467');
ok('a delimiter\'s class: its code point, whatever its size', G.glyphClass('#MJX-1-STX-N-28', '28') === 'delim:28' && G.glyphClass('#MJX-2-STX-S3-28', '28') === 'delim:28' && G.glyphClass('#MJX-2-STX-S4-28') === 'delim:28');
ok('a rule\'s class: horizontal or vertical', G.ruleClass(400, 40) === 'ruleH' && G.ruleClass(40, 400) === 'ruleV');
// (the ease and the fades)
ok('the ease: 0 and 1 at its ends, ½ at ½, never past them', G.ease(0) === 0 && G.ease(1) === 1 && G.ease(0.5) === 0.5 && G.ease(-1) === 0 && G.ease(2) === 1);
ok('a glyph that goes is gone by the half, one that comes shows only after it', G.fadeOut(0) === 1 && G.fadeOut(0.5) === 0 && G.fadeIn(0.5) === 0 && G.fadeIn(1) === 1 && G.fadeOut(0.25) === 0.5);
ok('the affine part way', JSON.stringify(G.lerpM([1, 0, 0, 1, 0, 0], [2, 0, 0, 2, 10, -4], 0.5)) === JSON.stringify([1.5, 0, 0, 1.5, 5, -2]));
console.log(`t_glyph_match: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
