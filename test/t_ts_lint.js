'use strict';
// node test/t_ts_lint.js : the TypeScript files of src/ are linted where they stand (issue #20; eslint.config.js's
// src/*.ts block, tools/ts_strip.js). A .ts text with type annotations before and around two deliberate lint errors
// gets both reported, at the line and column of the .ts text itself. The type stripping keeps every offset, says
// nothing on stderr (the lint JSON that ci/lint_ratchet.js reads stays clean) and fails loudly on a node without it.
const path = require('path');
const mod = require('module');
const { spawnSync } = require('child_process');
const { ESLint } = require('eslint');
const { strip } = require('../tools/ts_strip');

const ROOT = path.join(__dirname, '..');
let bad = 0, n = 0;
const check = (name, ok, info = '') => { n++; if (!ok) { bad++; console.log('FAIL', name, info); } };

// line and column (1-based) of the first `what` in text
const at = (text, what) => {
  const i = text.indexOf(what), before = text.slice(0, i).split('\n');
  return { line: before.length, column: before[before.length - 1].length + 1 };
};
const TEXT = [
  "type Pair = [number, number];",
  "const scale = (p: Pair, k: number): Pair => [p[0] * k, p[1] * k];",
  "export function far(p: Pair, r: Map<string, number>): boolean { const q: Pair = scale(p, 2); return q[0] == r.size; }",
  "const unusedThing: Record<string, number> = {};",
  "export { scale };",
  "",
].join('\n');

(async () => {
  // the stripped text: the same length and lines, so every position is the .ts text's
  const out = strip(TEXT, 'probe.ts');
  check('stripping keeps the length', out.length === TEXT.length, `${out.length} vs ${TEXT.length}`);
  check('stripping keeps the lines', out.split('\n').length === TEXT.split('\n').length);
  check('stripping removes the types', !/: Pair|Map<|type Pair/.test(out), out);

  // ESLint with this repository's config, as `npx eslint .` lints a .ts file of src/
  const eslint = new ESLint({ cwd: ROOT });
  const [res] = await eslint.lintText(TEXT, { filePath: path.join(ROOT, 'src', 'zz_ts_lint_probe.ts') });
  const msgs = res.messages;
  check('no parse error', !msgs.some((m) => m.fatal), JSON.stringify(msgs));
  const eq = msgs.find((m) => m.ruleId === 'eqeqeq'), un = msgs.find((m) => m.ruleId === 'no-unused-vars');
  const wantEq = at(TEXT, '=='), wantUn = at(TEXT, 'unusedThing');
  check('eqeqeq is reported', !!eq, JSON.stringify(msgs));
  check('eqeqeq at the .ts line and column', eq && eq.line === wantEq.line && eq.column === wantEq.column, JSON.stringify({ got: eq && [eq.line, eq.column], want: wantEq }));
  check('no-unused-vars is reported', !!un, JSON.stringify(msgs));
  check('no-unused-vars at the .ts line and column', un && un.line === wantUn.line && un.column === wantUn.column, JSON.stringify({ got: un && [un.line, un.column], want: wantUn }));
  check('nothing else is reported (the types are not code)', msgs.length === 2, JSON.stringify(msgs.map((m) => [m.ruleId, m.line, m.column])));

  // src/palette.ts as `npx eslint` lints it: the file is linted (not ignored) and parses
  const [pal] = await eslint.lintFiles([path.join(ROOT, 'src', 'palette.ts')]);
  check('src/palette.ts parses', pal && !pal.messages.some((m) => m.fatal), JSON.stringify(pal && pal.messages));

  // the command-line strip prints nothing to stderr (no ExperimentalWarning)
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'ts_strip.js'), path.join(ROOT, 'src', 'palette.ts')], { encoding: 'utf8' });
  check('tools/ts_strip.js exits 0', r.status === 0, r.stderr);
  check('tools/ts_strip.js says nothing on stderr', r.stderr === '', r.stderr);

  // a node without type stripping fails loudly
  const keep = mod.stripTypeScriptTypes;
  let threw = null;
  try { mod.stripTypeScriptTypes = undefined; strip(TEXT, 'probe.ts'); } catch (e) { threw = e; } finally { mod.stripTypeScriptTypes = keep; }
  check('a node without stripTypeScriptTypes throws', !!threw && /stripTypeScriptTypes/.test(threw.message), String(threw));

  console.log(bad ? `${bad} of ${n} checks failed` : `ok: ${n} checks`);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.log('FAIL', e.stack); process.exit(1); });
