'use strict';
// Is a split of a source file into parts a pure move? A part split takes a block of lines out of one file of src/app/
// (or src/gl/, ...) and puts it in another, and the joined file (test/src_text.js: what build.py and the tests read)
// is meant to stay the same code. This tool reads the joined file at two commits and proves that.
//   node tools/part_move.js <old> <new> [--file app.js] [--strict] [--max-lines N] [--repo DIR]
// <old> and <new> are git refs, or `.` for the working tree's src/ (of this checkout, or of --repo): for a PR, <old>
// is the merge base (where it last merged the integration branch, or the integration commit it branched from) and
// <new> its head. The proof:
//   1. the tokens (acorn, `ecmaVersion: latest`; each token is its source text) of the two joined files are the same
//      stream except for one contiguous run that moved: the run is in both, and the streams are equal once it is
//      taken out of each (when two blocks changed places, the shorter is the run);
//   2. the lines of the two files as a multiset: the lines only in <old> and only in <new>, each with its count. A line
//      that holds a token (code) must not differ at all, even in its layout; a line of comments or blanks may (a new
//      part's header comment), and is listed so that a reviewer reads it (--strict: any difference fails);
//   3. the order the top-level statements run in (tools/part_move_order.js): no top-level statement runs before a
//      const, let, class or var it reads while it runs and that the move put after it. A function that a statement
//      calls is not followed into: what it reads later is for the reviewer, or for loading the page.
// Where the run was and is is printed as the line ranges of the joined files and of the parts they come from. Exit 0:
// a pure move; 1: not (the first difference, or the statement that runs too early, is printed); 2: the refs or the
// file could not be read.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const acorn = require('acorn');
const { parts, source, PARTS_RE } = require('../test/src_text');
const { newOrderViolations } = require('./part_move_order');

const ROOT = path.join(__dirname, '..');   // (the checkout whose refs and src/ are read, unless --repo)

// the tokens of a script: { keys (each token's source text), startLine, endLine (1-based, per token), codeLines (the
// lines that hold a token) }
function tokenize(text) {
  const keys = [], startLine = [], endLine = [], codeLines = new Set();
  for (const t of acorn.tokenizer(text, { ecmaVersion: 'latest', sourceType: 'script', locations: true, allowHashBang: true })) {
    if (t.type === acorn.tokTypes.eof) break;
    keys.push(text.slice(t.start, t.end));
    startLine.push(t.loc.start.line);
    endLine.push(t.loc.end.line);
    for (let l = t.loc.start.line; l <= t.loc.end.line; l++) codeLines.add(l);
  }
  return { keys, startLine, endLine, codeLines };
}

// the start of `pat` in `txt` (Int32Arrays), or -1 (Knuth-Morris-Pratt)
function find(txt, pat) {
  const fail = new Int32Array(pat.length);
  for (let i = 1, k = 0; i < pat.length; i++) {
    while (k && pat[i] !== pat[k]) k = fail[k - 1];
    if (pat[i] === pat[k]) k++;
    fail[i] = k;
  }
  for (let i = 0, k = 0; i < txt.length; i++) {
    while (k && txt[i] !== pat[k]) k = fail[k - 1];
    if (txt[i] === pat[k]) k++;
    if (k === pat.length) return i - k + 1;
  }
  return -1;
}

// two tokenizations -> { kind: 'identical' } | { kind: 'move', length, a: [from, to), b: [from, to) } (token indices
// of the run in each) | { kind: 'changed', start, a: [from, to), b: [from, to) } (not a move: the region from the
// first difference to the common end).
// A move is one run that is in both streams, with the streams equal once it is taken out of each. With the common
// start and the common end taken off, what is left of one stream is the other's turned (U V against V U): the
// shorter of U and V is the run. Tokens at the edges of the run that equal their neighbours (`) ; }` before a moved
// function ends the code before it in both) make the common start and end reach into the run, so the turn is looked
// for in windows that begin up to EDGE tokens before the first difference and end up to EDGE tokens after the common
// end, whole lines first (a run is whole lines when a part is split), the smaller ones first.
const EDGE = 32, EDGE_ANY = 8;
function compareStreams(ta, tb) {
  const ka = ta.keys, kb = tb.keys, n = ka.length, m = kb.length, lim = Math.min(n, m);
  let p = 0;
  while (p < lim && ka[p] === kb[p]) p++;
  if (p === n && p === m) return { kind: 'identical' };
  let s = 0;
  while (s < lim - p && ka[n - 1 - s] === kb[m - 1 - s]) s++;
  const changed = { kind: 'changed', start: p, a: [p, n - s], b: [p, m - s] };
  if (n !== m) return changed;
  // (the tokens as numbers; the same tokens in both streams stand for the same number)
  const id = new Map(), num = (k) => { if (!id.has(k)) id.set(k, id.size); return id.get(k); };
  const ia = Int32Array.from(ka, num), ib = Int32Array.from(kb, num);
  // what is left of the two streams has the same tokens, or no window has
  const counts = new Map();
  for (let i = p; i < n - s; i++) { counts.set(ia[i], (counts.get(ia[i]) || 0) + 1); counts.set(ib[i], (counts.get(ib[i]) || 0) - 1); }
  for (const c of counts.values()) if (c) return changed;
  const lineStart = (t, i) => i === 0 || t.startLine[i] > t.endLine[i - 1];
  const lineEnd = (t, i) => i === t.keys.length - 1 || t.startLine[i + 1] > t.endLine[i];
  // the turn of the window [w0, w1): { k } with ib[w0..w1) = ia[w0 + k..w1) then ia[w0..w0 + k), or null
  const turned = (w0, w1) => {
    const len = w1 - w0, am = ia.subarray(w0, w1), k = find(Int32Array.from([...am, ...am.subarray(0, len - 1)]), ib.subarray(w0, w1));
    return k < 1 ? null : k;
  };
  const found = (w0, w1, k) => {
    const len = w1 - w0;
    // (U moved down past V, or V up past U)
    return k <= len - k ? { kind: 'move', length: k, a: [w0, w0 + k], b: [w1 - k, w1] } : { kind: 'move', length: len - k, a: [w0 + k, w1], b: [w0, w0 + len - k] };
  };
  const wholeLines = (r) => lineStart(ta, r.a[0]) && lineEnd(ta, r.a[1] - 1) && lineStart(tb, r.b[0]) && lineEnd(tb, r.b[1] - 1);
  const pairs = [];
  for (let dp = 0; dp <= EDGE && dp <= p; dp++) for (let ds = 0; ds <= EDGE && n - s + ds <= n; ds++) pairs.push([dp, ds]);
  pairs.sort((x, y) => x[0] + x[1] - y[0] - y[1]);
  let loose = null;
  for (const [dp, ds] of pairs) {
    const w0 = p - dp, w1 = n - s + ds;
    // the window's edges, as the run's: whole lines in both streams
    const edges = lineStart(ta, w0) && lineStart(tb, w0) && lineEnd(ta, w1 - 1) && lineEnd(tb, w1 - 1);
    if (!edges && (loose || dp > EDGE_ANY || ds > EDGE_ANY)) continue;
    const k = turned(w0, w1);
    if (k === null) continue;
    const r = found(w0, w1, k);
    if (edges && wholeLines(r)) return r;
    loose = loose || r;
  }
  return loose || changed;
}

// the lines of two texts as multisets -> { removed: [[line, count]], added: [[line, count]] } (only in a / only in b)
function lineDiff(a, b) {
  const count = (t) => { const c = new Map(); for (const l of t.split('\n')) c.set(l, (c.get(l) || 0) + 1); return c; };
  const ca = count(a), cb = count(b), removed = [], added = [];
  for (const [l, n] of ca) { const d = n - (cb.get(l) || 0); if (d > 0) removed.push([l, d]); }
  for (const [l, n] of cb) { const d = n - (ca.get(l) || 0); if (d > 0) added.push([l, d]); }
  return { removed, added };
}

// the proof for two joined texts -> { pure, tokens: compareStreams' result, tA, tB (the tokenizations), diff,
// codeDiffers }
function proveMove(textA, textB, { strict = false } = {}) {
  const tA = tokenize(textA), tB = tokenize(textB);
  const tokens = compareStreams(tA, tB);
  const diff = lineDiff(textA, textB);
  // a differing line that holds a token on its own side
  const codeLines = (t, text) => { const lines = text.split('\n'), code = new Set(); for (const l of t.codeLines) code.add(lines[l - 1]); return code; };
  const codeA = codeLines(tA, textA), codeB = codeLines(tB, textB);
  const codeDiffers = diff.removed.filter(([l]) => codeA.has(l)).length + diff.added.filter(([l]) => codeB.has(l)).length;
  const differs = diff.removed.length + diff.added.length;
  // (the order is read of a move only: the same stream has the same order, and another stream is not a move)
  let order = [], orderError = null;
  if (tokens.kind === 'move') try { order = newOrderViolations(textA, textB); } catch (e) { orderError = e.message; }
  return { pure: tokens.kind !== 'changed' && !codeDiffers && !(strict && differs) && !order.length && !orderError, tokens, tA, tB, diff, codeDiffers, order, orderError };
}

// the parts of the joined file as line ranges -> [{ name, from, to }] (1-based, inclusive); the closure's own lines
// are wrap.js
function layoutOf(file, dir) {
  const text = source(file, dir), total = text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
  const ps = parts(file, dir);
  if (!ps) return [{ name: `src/${file}`, from: 1, to: total }];
  const wrapFile = path.join(dir, file.replace(/\.js$/, ''), 'wrap.js'), wrap = fs.readFileSync(wrapFile, 'utf8');
  const head = wrap.slice(0, PARTS_RE.exec(wrap).index), name = (f) => `src/${path.relative(dir, f).split(path.sep).join('/')}`;
  const nl = (s) => s.split('\n').length - 1;
  const out = [], wrapName = name(wrapFile);
  let line = 1 + nl(head);
  if (nl(head)) out.push({ name: wrapName, from: 1, to: nl(head) });
  for (const f of ps) {
    const t = fs.readFileSync(f, 'utf8'), end = line + nl(t);
    out.push({ name: name(f), from: line, to: t.endsWith('\n') ? end - 1 : end });
    line = end;
  }
  if (line <= total) out.push({ name: wrapName, from: line, to: total });
  return out;
}

// 'line 7' or 'lines 1203-1563'
const span = (a, z) => (a === z ? `line ${a}` : `lines ${a}-${z}`);

// 'src/app/19-steps-view.js lines 1203-1563' for the lines [from, to] of the joined file (each part it touches, if
// more than one)
function whereIs(layout, from, to) {
  const hit = layout.filter((x) => x.from <= to && x.to >= from).map((x) => {
    const a = Math.max(from, x.from) - x.from + 1, z = Math.min(to, x.to) - x.from + 1;
    return `${x.name} ${span(a, z)}`;
  });
  return hit.join(' and ') || '(outside the parts)';
}

const N = (x) => x.toLocaleString('en-US');

// the report -> { lines: [string], pure }
function report(p, { a, b, layoutA, layoutB, maxLines = 40 }) {
  const { tokens: t, tA, tB, diff } = p, out = [];
  const lines = (text) => N(text.split('\n').length - (text.endsWith('\n') ? 1 : 0));
  out.push(`joined file: ${a.name}: ${lines(a.text)} lines, ${N(tA.keys.length)} tokens; ${b.name}: ${lines(b.text)} lines, ${N(tB.keys.length)} tokens`);
  // (a run is told by the lines of its first and last token: a comment around the run is not a token)
  const range = (tk, from, to, layout) => `joined ${span(tk.startLine[from], tk.endLine[to - 1])} (${whereIs(layout, tk.startLine[from], tk.endLine[to - 1])})`;
  if (t.kind === 'identical') out.push('tokens: the same stream, token for token (nothing moved)');
  else if (t.kind === 'move') {
    out.push(`tokens: one contiguous run of ${N(t.length)} tokens moved; the other ${N(tA.keys.length - t.length)} are identical and in the same order`);
    out.push(`  was at ${range(tA, t.a[0], t.a[1], layoutA)}`, `  is at  ${range(tB, t.b[0], t.b[1], layoutB)}`);
  } else {
    const at = (tk, i, layout) => (i < tk.keys.length ? `joined line ${tk.startLine[i]} (${whereIs(layout, tk.startLine[i], tk.startLine[i])}), \`${tk.keys[i]}\`` : 'the end');
    out.push('tokens: NOT a single moved run. The first difference:', `  ${a.name}: ${at(tA, t.start, layoutA)}`, `  ${b.name}: ${at(tB, t.start, layoutB)}`);
    out.push(`  the region that is not the same stream: ${N(t.a[1] - t.a[0])} tokens in ${a.name}, ${N(t.b[1] - t.b[0])} in ${b.name}, and not each other's rotation`);
  }
  const show = (sign, list) => {
    const total = list.reduce((s, [, n]) => s + n, 0);
    out.push(`  ${sign}${total} line${total === 1 ? '' : 's'} only in ${sign === '-' ? a.name : b.name}${total ? ':' : ''}`);
    for (const [l, n] of list.slice(0, maxLines)) out.push(`    ${sign} ${l.trim() === '' ? '(blank)' : l}${n > 1 ? `  (x${n})` : ''}`);
    if (list.length > maxLines) out.push(`    … ${list.length - maxLines} more distinct lines`);
  };
  out.push(`lines as a multiset: ${diff.removed.length + diff.added.length ? 'differ' : 'the same'}`);
  if (diff.removed.length + diff.added.length) { show('-', diff.removed); show('+', diff.added); }
  if (p.codeDiffers) out.push(`${p.codeDiffers} differing line${p.codeDiffers === 1 ? '' : 's'} hold code (a token), even if only their layout differs`);
  if (p.orderError) out.push(`order of the top-level statements: not read (${p.orderError})`);
  else if (t.kind === 'move' && !p.order.length) out.push('order of the top-level statements: none runs before a const, let, class or var it reads');
  if (p.order.length) {
    out.push(`order of the top-level statements: ${p.order.length === 1 ? '1 statement runs' : `${p.order.length} statements run`} before a const, let, class or var it reads (a ReferenceError or an undefined at load):`);
    const at = (n) => `joined line ${n.loc.start.line} (${whereIs(layoutB, n.loc.start.line, n.loc.start.line)})`;
    const head = (n) => `"${b.text.slice(n.start, n.end).split('\n')[0].trim().slice(0, 60)}"`;
    for (const v of p.order.slice(0, maxLines)) out.push(`  ${head(v.use)} at ${at(v.use)} reads ${v.name}, a ${v.kind} declared after it, ${head(v.decl)} at ${at(v.decl)}`);
    if (p.order.length > maxLines) out.push(`  … ${p.order.length - maxLines} more`);
  }
  out.push(p.pure ? 'pure move: yes' : 'pure move: NO');
  return { lines: out, pure: p.pure };
}

// the joined file at a git ref ('.': the working tree) -> { name, text, layout }
function readAt(ref, file, repo) {
  if (ref === '.') { const dir = path.join(repo, 'src'); return { name: 'working tree', text: source(file, dir), layout: layoutOf(file, dir) }; }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'part-move-'));
  try {
    const sha = execFileSync('git', ['rev-parse', '--short=9', `${ref}^{commit}`], { cwd: repo, encoding: 'utf8' }).trim();
    execFileSync('tar', ['-x', '-C', tmp], { input: execFileSync('git', ['archive', sha, 'src'], { cwd: repo, maxBuffer: 1 << 30 }) });
    const dir = path.join(tmp, 'src');
    return { name: `${ref === sha ? sha : `${ref} (${sha})`}`, text: source(file, dir), layout: layoutOf(file, dir) };
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

function main(argv) {
  const arg = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null);
  const strict = argv.includes('--strict'), file = arg('--file') || 'app.js', repo = path.resolve(arg('--repo') || ROOT), maxLines = arg('--max-lines') == null ? 40 : Number(arg('--max-lines'));
  const refs = argv.filter((x, i) => !x.startsWith('--') && !['--file', '--max-lines', '--repo'].includes(argv[i - 1]));
  if (refs.length !== 2 || !(maxLines >= 0)) { console.error('usage: node tools/part_move.js <old> <new> [--file app.js] [--strict] [--max-lines N] [--repo DIR]   (refs: a git ref, or . for the working tree; <old> the merge base of a PR)'); return 2; }
  let a, b;
  try { a = readAt(refs[0], file, repo); b = readAt(refs[1], file, repo); } catch (e) { console.error(`cannot read ${file} at ${refs.join(' and ')}: ${String(e.message || e).split('\n')[0]}`); return 2; }
  let p;
  try { p = proveMove(a.text, b.text, { strict }); } catch (e) { console.error(`cannot tokenise ${file}: ${e.message}`); return 2; }
  const r = report(p, { a, b, layoutA: a.layout, layoutB: b.layout, maxLines });
  console.log(r.lines.join('\n'));
  return r.pure ? 0 : 1;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { tokenize, compareStreams, lineDiff, proveMove, layoutOf, whereIs, report, main };
