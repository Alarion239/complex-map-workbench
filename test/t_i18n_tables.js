// The shipped Russian and Italian tables (src/i18n_ru.js, src/i18n_it.js) are what their generators give now. The Russian generator
// keeps a key while some source holds its English (a string literal of the code, or the page's own text: tools/make_ru_table.py
// held(); a comment holds nothing), so a pull request that changes a string or a table must regenerate it, and this fails the
// one that does not.
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
// A key that tools/ru_extra.json and a table of notes/i18n/ru both hold is an error of --strict and --check, named in the output (the
// generator takes tools/ru_extra.json's Russian, and the report says which table to delete the entry from). The check runs on a copy of
// the generator and its data: tools/ in a temporary tree, with ru_extra.json given a key of phase2b-fixes.json, and src/ and notes/
// linked, so nothing of the real tree is written (the generator stops at the report, before it reads src/).
{
  const fs = require('fs'), os = require('os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ru_both_'));
  try {
    fs.mkdirSync(path.join(tmp, 'tools'));
    for (const f of ['make_ru_table.py', 'src_parts.py', 'js_blank_comments.js']) fs.copyFileSync(path.join(ROOT, 'tools', f), path.join(tmp, 'tools', f));
    for (const d of ['src', 'notes']) fs.symlinkSync(path.join(ROOT, d), path.join(tmp, d));
    const FX = JSON.parse(fs.readFileSync(path.join(ROOT, 'notes/i18n/ru/phase2b-fixes.json'), 'utf8'));
    const [id, e] = Object.entries(FX).find(([k, v]) => !k.startsWith('_') && v.en && v.ru && !v.plural);
    const key = (e.ctx ? e.ctx + '\u0004' : '') + e.en;
    const extra = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/ru_extra.json'), 'utf8'));
    ok('the real ru_extra.json holds no key of phase2b-fixes.json (the check below adds one)', !(key in extra), key);
    extra[key] = 'Своё';
    fs.writeFileSync(path.join(tmp, 'tools/ru_extra.json'), JSON.stringify(extra));
    for (const flag of ['--strict', '--check']) {
      const r = spawnSync(py, [path.join(tmp, 'tools/make_ru_table.py'), flag], { cwd: tmp, encoding: 'utf8' });
      const out = (r.stdout || '') + (r.stderr || '');
      ok(`${flag}: a key of ru_extra.json that a table holds fails`, r.status !== 0, out);
      ok(`${flag}: the output names the key, the table and its entry (${id})`, out.includes('IN BOTH') && out.includes('phase2b-fixes.json') && out.includes(id) && out.includes(JSON.stringify(key).slice(1, 20)), out);
    }
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}
console.log(`t_i18n_tables: ${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);
