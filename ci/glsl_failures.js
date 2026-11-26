'use strict';
// The failures of a GLSL page (ci/glsl.js) as short text for the job log and the job summary: the page's result is a
// big JSON (each recorded failure carries its chain's steps, its shape and its window), so printing it cut at a
// fixed length lost the later failures and every field after them (the counts per chain, the clip and the fullscreen
// checks, the flip).
//   const { lines, left } = failureLines(page, result, { rows: 20 });
// `page` is the page's id (glsl, adv, inverse, dh). Every kind of failure has a heading with its count, then at most
// `rows` rows, each in a few lines (the chain, what it ran on, the numbers of each check that missed). A row that
// repeats the chain, steps and shape of the one before it leaves them out. `left` counts the recorded rows that are
// not in `lines`; a text longer than FIELD is cut with its number of left-out characters, not silently.
const FIELD = 400;

const cut = (s, n = FIELD) => { s = String(s); return s.length <= n ? s : `${s.slice(0, n)}… (+${s.length - n} chars)`; };
// 6 significant digits, no trailing zeros
const fmt = (x) => (typeof x === 'number' && Number.isFinite(x) ? String(+x.toPrecision(6)) : String(x));
const pt = (a) => (Array.isArray(a) ? `(${a.map(fmt).join(', ')})` : fmt(a));
// [['powa', { alpha: '0.008', cut: 90 }], ['recip', {}]] or [{ type, params, on }] -> 'powa{"alpha":"0.008","cut":90} > recip'
const stepsOf = (steps) => steps.map((x) => {
  const [type, params, on] = Array.isArray(x) ? x : [x.type, x.params, x.on];
  return `${type}${params && Object.keys(params).length ? JSON.stringify(params) : ''}${on === false ? ' (off)' : ''}`;
}).join(' > ');

// the lines of one recorded failure; `seen` holds the chains, steps and shapes of the rows before it
function rowLines(f, seen) {
  const key = JSON.stringify([f.chain, f.steps, f.shape]);
  const again = f.chain !== undefined && seen.has(key);
  seen.add(key);
  const out = [`- ${cut(f.chain !== undefined ? f.chain : f.shape !== undefined ? f.shape : '(row)', 200)}`];
  const ctx = [];
  if (f.steps && !again) ctx.push(`steps ${cut(stepsOf(f.steps))}`);
  if (f.chain !== undefined && f.shape !== undefined && !again) ctx.push(`shape ${cut(f.shape, 200)}`);
  if (f.row !== undefined) ctx.push(`row ${f.row}`);
  for (const k of ['w', 'z0', 'q', 'point', 'cpu', 'gpu']) if (f[k] !== undefined) ctx.push(`${k} ${pt(f[k])}`);
  for (const k of ['pix', 'm', 'err']) if (f[k] !== undefined) ctx.push(`${k} ${fmt(f[k])}`);
  if (ctx.length) out.push(`    ${ctx.join('; ')}`);
  for (const b of f.bad || []) out.push(`    ${cut(b)}`);
  return out;
}

// the failures of one kind: a heading `title: total (n recorded)`, then up to `rows` rows -> { lines, shown, left }
function section(title, total, rows, max, seen) {
  const list = rows || [], shown = list.slice(0, max);
  const lines = [`${title}: ${total === undefined || total === null ? list.length : total}${total !== undefined && total !== null && total !== list.length ? ` (${list.length} recorded)` : ''}`];
  for (const f of shown) lines.push(...rowLines(f, seen));
  if (list.length > shown.length) lines.push(`  … ${list.length - shown.length} more recorded, not listed`);
  return { lines, left: list.length - shown.length };
}

const byCount = (by, max) => {
  const all = Object.entries(by || {}).map(([k, v]) => [k, typeof v === 'number' ? v : (v && v.fails) || 0]).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  return { shown: all.slice(0, max), more: all.length - Math.min(all.length, max) };
};

function failureLines(page, r, { rows = 20 } = {}) {
  r = r || {};
  const out = [];
  let left = 0;
  const add = (s) => { out.push(...s.lines); left += s.left; };
  const seen = new Set();
  if (r.setup) out.push(`did not run: ${cut(r.setup)}`);
  if (r.exception) out.push(`page exception: ${cut(r.exception)}`);
  const errors = r.errors || [];
  if (errors.length) { out.push(`errors: ${errors.length}`, ...errors.slice(0, 10).map((e) => `- ${cut(e)}`)); if (errors.length > 10) { out.push(`  … ${errors.length - 10} more not listed`); left += errors.length - 10; } }
  const by = byCount(page === 'inverse' ? r.byChain : r.failByChain, 15);
  if (by.shown.length) out.push(`failures per chain (${by.shown.length + by.more} ${by.shown.length + by.more === 1 ? 'chain' : 'chains'}):`, ...by.shown.map(([k, n]) => `  ${cut(k, 200)}: ${n}`), ...(by.more ? [`  … ${by.more} more chains`] : []));
  if (page === 'inverse') {
    // (the multiple-roots rows are also at the head of the walk's list, so they are listed once, there)
    if (r.failCount || (r.fails || []).length) add(section('walk', r.failCount, r.fails, rows, seen));
    // (the Repeat section's rows, and its certificate of the root enclosures: their counts and its first rows)
    const rp = r.rept, ct = rp && rp.cert;
    if (rp && (rp.failCount || (rp.fails || []).length)) add(section('repeat', rp.failCount, rp.fails, rows, seen));
    if (ct && (ct.misses || ct.refinedAboveCrude || (ct.fails || []).length)) {
      out.push(`repeat certificate: ${ct.misses} of ${ct.certified} certified nodes missed (${ct.nodes} nodes), ${ct.refinedAboveCrude} refined above the crude, ${ct.controlMisses} control misses`);
      const cf = ct.fails || [];
      out.push(...cf.slice(0, rows).map((f) => `- ${cut(JSON.stringify(f))}`));
      left += Math.max(0, cf.length - rows);
    }
    if (r.anchors && (r.anchors.failCount || (r.anchors.fails || []).length)) add(section('anchors', r.anchors.failCount, r.anchors.fails, rows, seen));
    if (r.clip && (r.clip.failCount || (r.clip.fails || []).length)) add(section('clip', r.clip.failCount, r.clip.fails, rows, seen));
    if (r.fs && !(r.fs.flat && r.fs.sphere)) out.push(`fullscreen shader: flat ${r.fs.flat}, sphere ${r.fs.sphere}`);
    if (r.flip && !r.flip.ok) out.push(`flip: ${cut(JSON.stringify(r.flip))}`);
  } else if (page === 'dh') {
    // (a row of the orbit check is { set, points, hist, arrayVsRegistersDiffer }, of the stop check { chain, set, points, early, charge })
    const rowsOf = (x, bad) => ((x && x.rows) || []).filter(bad).map((v) => ({ chain: [v.chain, v.set].filter(Boolean).join(' / '), bad: [cut(JSON.stringify(v))] }));
    const orbit = rowsOf(r.orbit, (v) => v.arrayVsRegistersDiffer > 0), stop = rowsOf(r.stop, (v) => v.early && (v.early.over > 0 || v.early.nanDiff > 0));
    if (orbit.length) add(section('orbit', undefined, orbit, rows, seen));
    if (stop.length) add(section('stop', undefined, stop, rows, seen));
  } else {
    if (r.failCount || (r.failures || []).length) add(section('values', r.failCount, r.failures, rows, seen));
    const s = r.singular;
    if (s && (s.badCount || (s.bad || []).length)) add(section('singular points', s.badCount, s.bad, rows, seen));
  }
  return { lines: out, left };
}

// the lines inside a Markdown fence that no line of them can close
function fenced(lines) {
  const text = lines.join('\n');
  const run = Math.max(0, ...(text.match(/`+/g) || []).map((m) => m.length));
  const fence = '`'.repeat(Math.max(3, run + 1));
  return `${fence}\n${text}\n${fence}`;
}

module.exports = { failureLines, fenced, FIELD };
