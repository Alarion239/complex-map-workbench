// rough census of UI-text string literals per file
const fs = require('fs');
const files = process.argv.slice(2);
const isText = (s) => {
  if (/^\s*$/.test(s)) return false;
  if (/^[#.]?[a-z][\w-]*$/.test(s)) return false;           // ids, classes, keys
  if (/^(https?:|data:|#[0-9a-f]{3,8}$)/i.test(s)) return false;
  if (/[{};]\s*$/.test(s) && /:\s*[^ ]+;/.test(s)) return false; // css
  if (/^[\w-]+(\s[\w-]+)*$/.test(s) && /-/.test(s) && !/[A-Z]/.test(s)) return false; // class lists
  const words = s.replace(/\$\{[^}]*\}/g, ' ').replace(/\\[a-zA-Z]+/g, ' ').match(/[A-Za-z]{2,}/g) || [];
  if (words.length < 2 && !/^[A-Z][a-z]{2,}/.test(s)) return false;
  if (/^(M|m)[\d .,-]+/.test(s)) return false;  // svg paths
  if (/^(gl_|uniform|vec[234]|float |precision|#version)/.test(s)) return false;
  return true;
};
let tot = { n: 0, words: 0, chars: 0 };
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const re = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
  let m, n = 0, w = 0, c = 0; const seen = new Set();
  // skip glsl-heavy files
  while ((m = re.exec(src))) {
    const s = m[1] ?? m[2] ?? m[3];
    if (!isText(s) || seen.has(s)) continue;
    seen.add(s);
    const plain = s.replace(/<[^>]+>/g, ' ').replace(/\$\{[^}]*\}/g, '').replace(/\$[^$]*\$/g, '');
    n++; w += (plain.match(/[A-Za-z]{2,}/g) || []).length; c += plain.length;
  }
  console.log(f.split('/').pop().padEnd(12), 'strings', n, 'words', w, 'chars', c);
  tot.n += n; tot.words += w; tot.chars += c;
}
console.log('TOTAL', JSON.stringify(tot));
