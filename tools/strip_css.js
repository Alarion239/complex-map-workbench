'use strict';
// The published stylesheet without its comments and spare whitespace: every gap between two tokens (whitespace and
// comments only) goes when a token beside it is `{`, `}` or `;` (but the one that ends a custom property's value), else
// becomes one line break when it holds one and one space when it holds only spaces; a gap of comments alone goes, and
// two tokens with no gap stay touching. A string, a
// url(…) and an escape (`\` and what it escapes, a hex escape with the one space that ends it) are tokens, their text
// kept byte for byte, so a `/*` or a space inside one is never a comment or a gap. strip() checks its own output two
// ways: the same text outside the gaps, and the same stylesheet as esbuild parses and prints it; anything else
// throws, and the build stops.
//   node tools/strip_css.js < in.css > out.css
const TIGHT = new Set(['{', '}', ';']);
const SPACE = /[ \t\n\r\f]/;
const HEX = /[0-9a-fA-F]/;
const NAME = /[\w\-\\\u0080-￿]/;
// the stylesheet's tokens and gaps, in order: { gap: true, text } for a run of whitespace and comments, { text } else
function lex(css) {
  const out = [];
  let i = 0, word = '';
  const flush = () => { if (word) { out.push({ text: word }); word = ''; } };
  const gap = (text) => { flush(); const last = out[out.length - 1]; if (last && last.gap) last.text += text; else out.push({ gap: true, text }); };
  // an escape at i (css[i] is `\`): its end
  const escape = (k) => {
    if (k + 1 >= css.length) return k + 1;
    if (!HEX.test(css[k + 1])) return k + 2;
    let j = k + 1;
    while (j < css.length && j < k + 7 && HEX.test(css[j])) j++;
    if (css[j] === '\r' && css[j + 1] === '\n') return j + 2;
    return SPACE.test(css[j] || '') ? j + 1 : j;
  };
  while (i < css.length) {
    const c = css[i];
    if (c === '/' && css[i + 1] === '*') {
      const e = css.indexOf('*/', i + 2);
      if (e < 0) throw new Error(`strip_css: a comment at ${i} is not closed`);
      gap(css.slice(i, e + 2));
      i = e + 2;
    } else if (SPACE.test(c)) {
      let j = i;
      while (j < css.length && SPACE.test(css[j])) j++;
      gap(css.slice(i, j));
      i = j;
    } else if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < css.length && css[j] !== c) {
        if (css[j] === '\n') throw new Error(`strip_css: a string at ${i} runs past its line`);
        j = css[j] === '\\' ? j + 2 : j + 1;
      }
      if (j >= css.length) throw new Error(`strip_css: a string at ${i} is not closed`);
      flush(); out.push({ text: css.slice(i, j + 1) });
      i = j + 1;
    } else if (c === '\\') {
      const e = escape(i);
      word += css.slice(i, e);
      i = e;
    } else if (/^url\($/i.test(css.slice(i, i + 4)) && !/[\w-]$/.test(word)) {
      // (url( with no quote: up to its `)`, a `/*` or `//` inside it part of the address)
      let j = i + 4;
      while (j < css.length && SPACE.test(css[j])) j++;
      if (css[j] === '"' || css[j] === "'") { word += css.slice(i, i + 4); i += 4; continue; }
      while (j < css.length && css[j] !== ')') j = css[j] === '\\' ? j + 2 : j + 1;
      if (j >= css.length) throw new Error(`strip_css: a url( at ${i} is not closed`);
      word += css.slice(i, j + 1);
      i = j + 1;
    } else if (TIGHT.has(c)) {
      flush(); out.push({ text: c });
      i++;
    } else {
      word += c;
      i++;
    }
  }
  flush();
  return out;
}
function strip(css) {
  const t = lex(css);
  let out = '', head = null;
  for (let i = 0; i < t.length; i++) {
    if (!t[i].gap) {
      out += t[i].text;
      if (TIGHT.has(t[i].text)) head = null; else if (head === null) head = t[i].text;
      continue;
    }
    const before = t[i - 1], after = t[i + 1];
    if (!before || !after || TIGHT.has(before.text)) continue;
    // (a custom property's value ends with the gap before its `;` or `}`: esbuild keeps it, so it stays)
    if (TIGHT.has(after.text) && !(head && head.startsWith('--'))) continue;
    const space = t[i].text.replace(/\/\*[\s\S]*?\*\//g, '');
    if (/[\n\r\f]/.test(space)) out += '\n';
    else if (space) out += ' ';
    // (comments alone between two characters of a name: an empty comment still parts them)
    else if (NAME.test(before.text.slice(-1)) && NAME.test(after.text[0])) out += '/**/';
  }
  verify(css, out);
  return out;
}
// throws unless `after` is `before` with only its gaps changed: the same text between them, and the same stylesheet to
// esbuild (its parse, printed)
function verify(before, after) {
  // (the text between the gaps that hold whitespace and the tokens `{` `}` `;`: a gap of comments alone joins the
  // tokens beside it)
  const text = (s) => {
    const out = [];
    let open = false;
    for (const x of lex(s)) {
      if (x.gap) { if (SPACE.test(x.text.replace(/\/\*[\s\S]*?\*\//g, ''))) open = false; continue; }
      if (TIGHT.has(x.text)) { out.push(x.text); open = false; continue; }
      if (open) out[out.length - 1] += x.text; else { out.push(x.text); open = true; }
    }
    return out;
  };
  const was = text(before), now = text(after);
  let at = was.findIndex((x, i) => x !== now[i]);
  if (at < 0 && was.length !== now.length) at = Math.min(was.length, now.length);
  if (at >= 0) throw new Error(`strip_css: the stripped stylesheet's text differs at token ${at}: ${JSON.stringify(was[at])} became ${JSON.stringify(now[at])}`);
  const esbuild = require('esbuild');
  const print = (s) => esbuild.transformSync(s, { loader: 'css', legalComments: 'none', logLevel: 'silent' }).code;
  const p = print(before), q = print(after);
  if (p !== q) {
    let k = 0;
    while (p[k] === q[k]) k++;
    throw new Error(`strip_css: the stripped stylesheet parses differently: ${JSON.stringify(p.slice(Math.max(0, k - 40), k + 40))} became ${JSON.stringify(q.slice(Math.max(0, k - 40), k + 40))}`);
  }
}
module.exports = { strip, verify, lex };
if (require.main === module) {
  let s = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (d) => { s += d; });
  process.stdin.on('end', () => { process.stdout.write(strip(s)); });
}
