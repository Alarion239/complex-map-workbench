// The tour's "then" line after a reorder has an Italian translation (issue #1213): the English string is in the tour's
// source (src/tour.js) and in the Russian table, so the Italian table must have it too, with a real translation and the
// same placeholders. Both the source table (tools/it_table.json) and the shipped table (src/i18n_it.js) must carry it.
//   node test/t_it_1213.js
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const KEY = 'The planes after this step changed with the order.';

const fails = [];
let n = 0;
const ok = (name, cond, got) => { n++; if (!cond) fails.push({ name, got }); };

// the English string is the tour's source literal
ok('the string is in src/tour.js', read('src/tour.js').includes(`'${KEY}'`), null);

// the shipped table, as the app loads it
const m = read('src/i18n_it.js').match(/I18N\.define\('it', ("(?:[^"\\]|\\.)*")\);/);
const IT = m ? JSON.parse(JSON.parse(m[1])) : {};
const it = IT[KEY];
ok('src/i18n_it.js has the key', typeof it === 'string', it);
ok('the Italian is not the English', typeof it === 'string' && it !== KEY, it);
ok('the Italian is Italian', typeof it === 'string' && /\bpiani\b/i.test(it) && /ordine/.test(it), it);

// the source table the generator reads
const SRC = JSON.parse(read('tools/it_table.json'));
ok('tools/it_table.json has the key', SRC[KEY] === it, SRC[KEY]);

console.log(`${n - fails.length}/${n} checks pass`);
if (fails.length) {
  for (const f of fails) console.log('FAIL', f.name, JSON.stringify(f.got));
  process.exit(1);
}
