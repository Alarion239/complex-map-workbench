// tools/part_move.js, the proof that a split of a source file into parts is a pure move: a block moved up or down passes
// (also when its edges equal its neighbours' tokens), and each of these fails with the first difference: a token changed
// in the moved block, a move in two runs, a reordered block, a code line that differs only in its layout. A comment line
// added or removed is listed and passes (--strict fails it). The command runs on a repository of its own: a split of
// src/app/ into a new part, a refusal, and a ref that does not exist. Node, no browser. Run: node test/t_part_move.js
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { proveMove, layoutOf } = require('../tools/part_move');
let pass = 0, fail = 0;
const ok = (name, cond, got) => { if (cond) pass++; else { fail++; console.log('FAIL ' + name + (got !== undefined ? ' ' + JSON.stringify(got).slice(0, 700) : '')); } };

// a few functions, each a block of lines that ends in `}` as the one before it does
const fn = (name, body) => [`function ${name}(x) {`, ...body.map((l) => `  ${l}`), '}'];
const F = fn('f', ['const a = x + 1;', 'return a * 2;']);
const G = fn('g', ['let s = 0;', 'for (let i = 0; i < x; i++) s += i;', 'return s;']);
const H = fn('h', ['return "h" + x;']);
const I = fn('i', ['const t = [1, 2, 3];', 'return t.map((v) => v * x);']);
const J = fn('j', ['return x - 1;']);
const K = fn('k', ['return x / 2;']);
const L = fn('l', ['return -x;']);
const text = (...blocks) => ['// head', ...blocks.flat(), '// tail', ''].join('\n');
const tokensOf = (...b) => proveMove(text(...b), text(...b)).tA.keys.length;

// a block moved down, and up
const A = text(F, G, H, I, J), down = text(F, H, I, G, J), up = text(G, F, H, I, J);
// (G passes F: the run reported is the shorter of the two blocks that changed places, F)
for (const [name, B, ran] of [['down', down, G], ['up', up, F]]) {
  const p = proveMove(A, B);
  ok(`a block moved ${name} is a pure move`, p.pure && p.tokens.kind === 'move', p.tokens);
  ok(`${name}: the run is the moved function's tokens`, p.tokens.length === tokensOf(ran), [p.tokens.length, tokensOf(ran)]);
  ok(`${name}: the run is the same tokens in both streams`, p.tA.keys.slice(...p.tokens.a).join(' ') === p.tB.keys.slice(...p.tokens.b).join(' '));
  ok(`${name}: the lines are the same as a multiset`, !p.diff.removed.length && !p.diff.added.length, p.diff);
}
const pd = proveMove(A, down);
ok('the run was at the lines of G (old) and is at the lines of G (new)', pd.tA.startLine[pd.tokens.a[0]] === 2 + F.length && pd.tB.startLine[pd.tokens.b[0]] === 2 + F.length + H.length + I.length, [pd.tokens, pd.tA.startLine[pd.tokens.a[0]]]);
// the first and last tokens of a moved block equal the tokens beside it: two functions with one body moved over each other
const E1 = fn('e', ['return 1;']), E2 = fn('e2', ['return 1;']);
ok('a move whose edges equal its neighbours\' tokens is found', proveMove(text(E1, G, E2, H), text(E1, E2, G, H)).pure);
ok('the same, moved up', proveMove(text(E1, E2, G, H), text(E1, G, E2, H)).pure);
// nothing moved
ok('the same text is identical', proveMove(A, A).tokens.kind === 'identical' && proveMove(A, A).pure);
ok('a different layout of the comments only: the streams are identical', proveMove(A, A.replace('// head', '// the head\n// of the file')).tokens.kind === 'identical');

// not pure: the first difference is where the streams first differ
const changed = (B, why) => { const p = proveMove(A, B); ok(why, !p.pure && p.tokens.kind === 'changed', p.tokens); return p; };
changed(text(F, H, I, G.map((l) => l.replace('s += i', 's += i + 1')), J), 'a token changed in the moved block fails');
const two = changed(text(G, F, H, J, I), 'a move in two runs fails');
ok('the first difference of two runs is the name of the first function that moved', two.tokens.start === 1 && two.tA.keys[1] === 'f' && two.tB.keys[1] === 'g' && two.tA.startLine[1] === 2, two.tokens);
changed(text(F, H, I, fn('g', ['let s = 0;', 'return s;', 'for (let i = 0; i < x; i++) s += i;']), J), 'a block reordered inside (and moved) fails');
changed(text(F, G, H, I), 'a function dropped fails (the streams differ in length)');
changed(text(K, J, I, H, G, F, L), 'a reversed order fails');
const first = proveMove(text(F, G, H), text(F, H, fn('g', ['let s = 1;', 'for (let i = 0; i < x; i++) s += i;', 'return s;'])));
ok('the first difference names the line of the first token that differs (the function\'s name)', first.tokens.kind === 'changed' && first.tA.startLine[first.tokens.start] === 2 + F.length && first.tB.keys[first.tokens.start] !== first.tA.keys[first.tokens.start], first.tokens);

// the line multiset: a code line that differs only in its layout fails, a comment line is listed and passes
const layout = proveMove(A, A.replace('  return a * 2;', '  return a *   2;'));
ok('a code line with another layout fails, though its tokens are the same', layout.tokens.kind === 'identical' && layout.codeDiffers === 2 && !layout.pure, [layout.tokens.kind, layout.codeDiffers]);
const withComment = proveMove(A, text(F, H, I, G, J).replace('function g(x) {', '// g, the sum\nfunction g(x) {'));
ok('a comment line added to a pure move passes and is listed', withComment.pure && withComment.diff.added.length === 1 && withComment.diff.added[0][0] === '// g, the sum' && withComment.codeDiffers === 0, withComment.diff);
ok('with --strict it fails', !proveMove(A, text(F, H, I, G, J).replace('function g(x) {', '// g, the sum\nfunction g(x) {'), { strict: true }).pure);
const gone = proveMove(text(F, G, ['// about h'], H), text(F, H, G));
ok('a comment line removed is listed as removed and passes', gone.pure && gone.diff.removed.length === 1 && gone.diff.removed[0][0] === '// about h', gone.diff);
const dup = proveMove(text(F, F, G), text(F, F, G).replace('// tail', '// tail\n// tail'));
ok('a line present twice more is counted', dup.diff.added.length === 1 && dup.diff.added[0][1] === 1, dup.diff);

// the parts of a joined file as line ranges
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'part-move-test-'));
  try {
    fs.mkdirSync(path.join(tmp, 'app'));
    fs.writeFileSync(path.join(tmp, 'app', 'wrap.js'), '(function () {\n  \'use strict\';\n  // @parts\n})();\n');
    fs.writeFileSync(path.join(tmp, 'app', '01-a.js'), 'const a = 1;\nconst b = 2;\n');
    fs.writeFileSync(path.join(tmp, 'app', '02-b.js'), 'const c = 3;\n');
    const lay = layoutOf('app.js', tmp);
    ok('the layout has the closure\'s head, the parts, the closure\'s end', JSON.stringify(lay) === JSON.stringify([{ name: 'src/app/wrap.js', from: 1, to: 2 }, { name: 'src/app/01-a.js', from: 3, to: 4 }, { name: 'src/app/02-b.js', from: 5, to: 5 }, { name: 'src/app/wrap.js', from: 6, to: 6 }]), lay);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

// the command, on a repository of its own
const TOOL = path.join(__dirname, '..', 'tools', 'part_move.js');
const git = (cwd, ...args) => { const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...args], { cwd, encoding: 'utf8' }); if (r.status) throw new Error(`git ${args.join(' ')}: ${r.stderr}`); return r.stdout.trim(); };
const tool = (repo, ...args) => { const r = spawnSync(process.execPath, [TOOL, ...args, '--repo', repo], { encoding: 'utf8' }); return { code: r.status, out: r.stdout + r.stderr }; };
{
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'part-move-repo-'));
  try {
    const put = (rel, body) => { fs.mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true }); fs.writeFileSync(path.join(repo, rel), body); };
    git(repo, 'init', '-q');
    put('src/app/wrap.js', '(function () {\n  \'use strict\';\n  // @parts\n})();\n');
    // (a first function longer than g: g is the shorter of the two blocks that change places, so it is the run reported)
    const BIG = fn('f', Array.from({ length: 10 }, (_, i) => `const v${i} = x + ${i};`));
    put('src/app/01-a.js', BIG.join('\n') + '\n');
    put('src/app/02-b.js', [...G, ...H].join('\n') + '\n');
    git(repo, 'add', '-A'); git(repo, 'commit', '-q', '-m', 'one');
    // g goes to a new part that comes first in the joined file
    put('src/app/00-g.js', '// the sum\n' + G.join('\n') + '\n');
    put('src/app/02-b.js', H.join('\n') + '\n');
    git(repo, 'add', '-A'); git(repo, 'commit', '-q', '-m', 'split');
    // and a split that changes a token on the way
    put('src/app/00-g.js', '// the sum\n' + G.join('\n').replace('s += i', 's += 2') + '\n');
    git(repo, 'add', '-A'); git(repo, 'commit', '-q', '-m', 'split and edit');
    const r = tool(repo, 'HEAD~2', 'HEAD~1');
    ok('a split is a pure move (exit 0)', r.code === 0 && /pure move: yes/.test(r.out), r);
    ok('the report names the part the run left and the part it entered', /was at joined lines 15-19 \(src\/app\/02-b\.js lines 1-5\)/.test(r.out) && /is at {2}joined lines 4-8 \(src\/app\/00-g\.js lines 2-6\)/.test(r.out), r.out);
    ok('the report lists the part\'s header comment as a line added', /\+1 line only in .*:\n\s+\+ \/\/ the sum/.test(r.out), r.out);
    ok('--strict fails on that comment (exit 1)', tool(repo, 'HEAD~2', 'HEAD~1', '--strict').code === 1);
    const bad = tool(repo, 'HEAD~2', 'HEAD');
    ok('a split that changes a token fails (exit 1) and says where the first difference is', bad.code === 1 && /NOT a single moved run/.test(bad.out) && /first difference/.test(bad.out) && /pure move: NO/.test(bad.out), bad);
    const nogit = tool(repo, 'HEAD~2', 'no-such-ref');
    ok('a ref that does not exist is a setup problem (exit 2)', nogit.code === 2 && /cannot read app\.js/.test(nogit.out), nogit);
    ok('too few refs is a usage error (exit 2)', tool(repo, 'HEAD~2').code === 2);
    const wt = tool(repo, 'HEAD~1', '.');
    ok('the working tree is `.`', wt.code === 1 && /working tree/.test(wt.out), wt);
  } finally { fs.rmSync(repo, { recursive: true, force: true }); }
}

console.log(`part_move: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
