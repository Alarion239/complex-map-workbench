'use strict';
// tools/strip_css.js, which drops the published stylesheet's comments and spare whitespace: what it keeps byte for byte
// (strings, url(…), escapes), the gaps it drops or shortens, and its own check of the output.
//   node test/t_strip_css.js
const { strip, verify } = require('../tools/strip_css');
let fails = 0, n = 0;
const ok = (name, pass, detail) => { n++; if (!pass) { fails++; console.log('FAIL ' + name, detail === undefined ? '' : JSON.stringify(detail).slice(0, 400)); } };
const eq = (name, src, want) => { let got; try { got = strip(src); } catch (e) { got = 'threw: ' + e.message; } ok(name, got === want, { got, want }); };
eq('a comment goes, and the gaps beside { } ; go', '/* the panel */\n.a {\n  color: red; /* why */\n  margin: 0;\n}\n', '.a{color: red;margin: 0;}');
eq('a gap with a line break elsewhere becomes one line break', '.a,\n\n  .b{x:y}', '.a,\n.b{x:y}');
eq('a gap of spaces becomes one space, a descendant combinator kept', '.a    .b , .c   >   .d{x:y}', '.a .b , .c > .d{x:y}');
eq('a space before a pseudo-class is kept (a descendant, not the element itself)', '.a :hover{x:y} .b:hover{x:y}', '.a :hover{x:y}.b:hover{x:y}');
eq('a comment between two tokens with no space goes with nothing in its place', '.a/* x */.b{x:y}', '.a.b{x:y}');
eq('… but between two characters of a name an empty comment stays, so they stay two', 'a/* x */b{x:y}', 'a/**/b{x:y}');
eq('a string keeps /* */ and its spaces', '.a::before{content: "/* not a comment */  x"}', '.a::before{content: "/* not a comment */  x"}');
eq('a string with an escaped quote', ".a::after{content: 'it\\'s  /* x */'}", ".a::after{content: 'it\\'s  /* x */'}");
eq('an unquoted url( keeps // and /* inside it', '.a{background: url(//x.org/a/*b*/c.png) no-repeat}', '.a{background: url(//x.org/a/*b*/c.png) no-repeat}');
eq('a quoted url( is a string', '.a{background: url( "a b.png" )}', '.a{background: url( "a b.png" )}');
eq('a hex escape keeps the space that ends it', '.a\\31 23{x:y}', '.a\\31 23{x:y}');
eq('an escaped space is not a gap', '.a\\  .b{x:y}', '.a\\  .b{x:y}');
eq('an @media rule: the spaces of its query kept, one each', '@media (max-width:  600px)  and (hover: none) {\n  .a { x: y }\n}', '@media (max-width: 600px) and (hover: none){.a{x: y}}');
eq('a custom property keeps its value\'s spaces, one each, the one that ends it too', ':root{ --f: 12px  system-ui , sans-serif ; --g: 1 }', ':root{--f: 12px system-ui , sans-serif ;--g: 1 }');
eq('… and an ordinary property after it loses its end gap again', ':root{--f: a ;color: red ;}', ':root{--f: a ;color: red;}');
eq('an empty stylesheet', '\n  /* only a comment */\n', '');
// (stops the build on what it cannot read)
eq('an unclosed comment throws', '.a{x:y} /* open', 'threw: strip_css: a comment at 8 is not closed');
eq('an unclosed string throws', '.a{content:"x}', 'threw: strip_css: a string at 11 is not closed');
// (its own check)
let threw = null;
try { verify('.a .b{x:y}', '.a.b{x:y}'); } catch (e) { threw = e.message; }
ok('the check throws on a descendant combinator lost', !!threw, threw);
threw = null;
try { verify('.a{content:"x"}', '.a{content:"y"}'); } catch (e) { threw = e.message; }
ok('the check throws on a changed string', !!threw && /token/.test(threw), threw);
threw = null;
try { verify('a b{x:y}', 'ab{x:y}'); } catch (e) { threw = e.message; }
ok('the check throws on two names run together', !!threw && /token/.test(threw), threw);
threw = null;
try { verify('/* c */\n.a {\n  x: y;\n}\n', '.a{x: y;}'); } catch (e) { threw = e.message; }
ok('the check passes the same stylesheet', threw === null, threw);
console.log(fails ? `${fails} of ${n} checks FAILED` : `strip_css: ${n} checks passed`);
process.exit(fails ? 1 : 0);
