// The $t / $tx / $tn call sites of src/*.js whose arguments are string literals (the extractor of
// notes/i18n/DESIGN.md 10; tools/make_ru_table.py has the same reader in Python). Used by test/t_i18n_keys.js and
// test/t_i18n.js. sites(dir) -> [{kind: 't' | 'tx' | 'tn', key, src, where}]: key is the table key (ctx + U+0004 +
// source, one + U+0004 + many), src the English template whose placeholders the call fills.
'use strict';
const fs = require('fs');
const { parts, source } = require('./src_text');
const CTX = '\u0004';
// a JS string literal at s[i] (after spaces): [value, end] or null (a template literal with ${...})
function lit(s, i) {
  while (/\s/.test(s[i] || '')) i++;
  const q = s[i];
  if (q !== "'" && q !== '"' && q !== '`') return null;
  let j = i + 1;
  for (; j < s.length; j++) {
    if (s[j] === '\\') { j++; continue; }
    if (q === '`' && s[j] === '$' && s[j + 1] === '{') return null;
    if (s[j] === q) break;
  }
  // our own source: the literal's text is evaluated as the string it denotes
  return [new Function(`return ${s.slice(i, j + 1)};`)(), j + 1];
}
function sites(dir) {
  const out = [];
  // (a file kept as parts, src/app/ and src/gl/, as one: its joined text and line numbers, as build.py joins it)
  const names = fs.readdirSync(dir).map((n) => (parts(n + '.js', dir) ? n + '.js' : n));
  for (const f of names.filter((n) => n.endsWith('.js') && !n.startsWith('i18n')).sort()) {
    const s = source(f, dir);
    for (const m of s.matchAll(/(?<![A-Za-z0-9_$.])\$t(x|n)?\(/g)) {
      const where = `${f}:${s.slice(0, m.index).split('\n').length}`;
      const a = lit(s, m.index + m[0].length);
      if (!a) continue;
      if (!m[1]) { out.push({ kind: 't', key: a[0], src: a[0], where }); continue; }
      let j = a[1];
      while (/\s/.test(s[j])) j++;
      if (s[j] !== ',') continue;
      const b = lit(s, j + 1);
      if (!b) continue;
      out.push({ kind: m[1] === 'x' ? 'tx' : 'tn', key: a[0] + CTX + b[0], src: b[0], one: a[0], where });
    }
  }
  return out;
}
module.exports = { sites, CTX };
