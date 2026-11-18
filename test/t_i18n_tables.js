// The shipped Russian and Italian tables (src/i18n_ru.js, src/i18n_it.js) are what their generators give now. The Russian generator
// keeps a key only while some source holds its English, comments included (tools/make_ru_table.py held()), so editing a comment
// can drop a key from the table that ships; this fails the pull request that does it, not the next regeneration.
//   node test/t_i18n_tables.js
const { spawnSync } = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const py = process.env.PYTHON || 'python3';
let n = 0, fails = 0;
const ok = (name, c, info) => { n++; if (!c) { fails++; console.log('FAIL', name, info === undefined ? '' : String(info).slice(0, 600)); } };
for (const [file, tool, args] of [['src/i18n_ru.js', 'tools/make_ru_table.py', ['--strict']], ['src/i18n_it.js', 'tools/make_it_table.py', ['--strict']]]) {
  const r = spawnSync(py, [path.join(ROOT, tool), ...args, '--check'], { cwd: ROOT, encoding: 'utf8' });
  ok(`${file} is what ${tool} gives now`, r.status === 0, (r.stderr || '') + (r.stdout || '') + (r.error || ''));
}
console.log(`t_i18n_tables: ${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);
