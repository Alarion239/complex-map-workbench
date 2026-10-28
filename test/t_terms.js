// The one glossary (notes/i18n/TERMS.md, issue #35, UX28): a retired name of a thing must not come back into the UI's
// sources. Counts each retired variant in the strings of src/ and page.html (comment lines and the generated tables
// left out); a count may only go down: KNOWN holds today's, lower it as the terms are applied (it prints which).
//   node test/t_terms.js
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const GENERATED = new Set(['i18n_ru.js', 'i18n_it.js', 'cyr.js', 'seasong.js']);
const files = [path.join(ROOT, 'src', 'page.html'),
  ...fs.readdirSync(path.join(ROOT, 'src')).filter((f) => f.endsWith('.js') && !GENERATED.has(f)).map((f) => path.join(ROOT, 'src', f)),
  ...fs.readdirSync(path.join(ROOT, 'src', 'app')).filter((f) => f.endsWith('.js')).map((f) => path.join(ROOT, 'src', 'app', f))];
// retired variant -> [the term that replaces it, its pattern]
const RETIRED = {
  'Region tools': ['Draw (the left panel)', /\bRegion tools\b/g],
  'Add function or command': ['Add function', /Add function or command/g],
  'Search functions and commands': ['Search (phone), Add function (laptop)', /Search functions and commands/g],
  'Append to the chain': ['Add function', /Append to the chain/g],
  'Reference guide': ['Guide', /Reference guide/g],
  'Using the Workbench': ['Guide', /Using the Workbench/g],
  'Clear the chain': ['Clear chain', /Clear the chain/g],
  'Empty canvas': ['Clear shapes', /Empty canvas/g],
  'Orthogonal': ['Perpendicular circle', /\bOrthogonal\b/g],
  "'3 points'": ['Circle through 3 points (tile: 3-pt circle)', /(['"`>])3 points(['"`<])/g],
};
const KNOWN = {
  'Region tools': 0, 'Add function or command': 0, 'Search functions and commands': 1, 'Append to the chain': 0,
  'Reference guide': 2, 'Using the Workbench': 1, 'Clear the chain': 0, 'Empty canvas': 1, 'Orthogonal': 0, "'3 points'": 0,
};
const count = {}, where = {};
for (const f of files) {
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  lines.forEach((l, i) => {
    const t = l.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('<!--')) return;
    for (const [k, [, re]] of Object.entries(RETIRED)) {
      const n = (l.match(re) || []).length;
      if (!n) continue;
      count[k] = (count[k] || 0) + n;
      (where[k] = where[k] || []).push(`${path.relative(ROOT, f)}:${i + 1}`);
    }
  });
}
let fails = 0;
for (const [k, [use]] of Object.entries(RETIRED)) {
  const n = count[k] || 0, was = KNOWN[k] || 0;
  if (n > was) { fails++; console.log(`FAIL "${k}" came back: ${n} > ${was} (say "${use}")`, where[k]); }
  else if (n < was) console.log(`lower KNOWN["${k}"] to ${n} (was ${was})`);
}
console.log(fails ? `${fails} retired names grew` : 'retired names: none grew');
if (process.argv.includes('--counts')) console.log(JSON.stringify(count));
process.exit(fails ? 1 : 0);
