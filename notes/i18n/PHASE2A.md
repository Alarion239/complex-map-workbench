# Russian localization: phase 2a (2026-10-22)

User request: "Can you add russian localization if system language is russian?"

Phase 2a builds the parts that do not touch app.js, page.html, tour.js, figure.js or sound.js. It was done in
`work/xi`, a copy of the base `notes/gate-morph-zp-r1/src`. A trial 3-way merge with `work/xr` against the base is
clean for every changed file, `build.py` included.

## What is done

- **The module** `src/i18n.js`. It is the prototype with the final API of DESIGN.md: `$t`, `$tx`, `$tn`, `I18N.parts`,
  `I18N.using`, `I18N.at`, `I18N.notation`, `I18N.fnName`, `I18N.texNum` (also named `texDecimal`), `texInterval`,
  `num`, `list`, `quote`, `nbsp`, `keyOf`, `isPaletteSlash`, `applyStatic`, `applyPage`, `setPref`, `onSwitch`,
  `onFonts`, `readPref`, `lang`. Nothing in app.js calls it yet.
- **Detection** runs once, synchronously, when the page loads, before funcs.js builds its catalog. The order is:
  `?lang=` (tests only), the stored setting (`lsk('cmw-lang')`, in try/catch), English under `?ns=`, then
  `navigator.languages[0]`, else `navigator.language`. Only `ru` and `ru-*` give Russian.
  - The browser step is off in phase 2a: `AUTO_DETECT = false` in `src/i18n.js`. A 2a-only build stays English on a
    Russian browser. Only `?lang=ru` or a stored setting gives Russian. Phase 2b sets it to `true`.
- **The shipped table** `src/i18n_ru.js` (1676 entries). `tools/make_ru_table.py` makes it from `ru/*.json`, the
  inventory, `proto/ru.json` and `tools/ru_extra.json`. The table is one JSON string inside `I18N.define('ru', "...")`.
  English never parses it. Russian parses it once, on the first lookup (1 ms in Chrome).
- **The keys** are the English source.
  - Each table entry is keyed by the template its call site will write: `en_key` when the table gives one (the
    review's round 4, `ru/ph.py`), `en_plural` for a plural, else the inventory text.
  - Each call site in `src/` is matched to that template with the placeholders masked. The Russian placeholders are
    renamed to the call site's names: by name, or occurrence by occurrence when one name stands for two values.
  - Entries without `en_key` fall back to the inventory text, with the names its context lists.
  - When one English text has several entries (a tool button and a shape name), the entry from the same file wins.
- **Wrapped strings**: every visible string of cx.js, parse.js, funcs.js, region.js, curves.js, calc.js (its messages
  only), gl.js and glsl.js. This covers catalog groups, labels, presets, parameter labels, branch and inverse notes,
  homotopy captions, domain TeX, parser and evaluator messages, region labels and TeX, and curve notes. 250 call sites
  in total. inverse.js, view.js and sphere.js have no visible strings, so they did not change.
- **Strings built from pieces** are now whole templates. Examples: `times(d)`, the zero–pole note
  (`A zero and a pole cancel at {at}` and a `$tn` plural), `Use z (or w) as the variable{hint}`, the straight-line
  homotopy `(%{why})`, the GPU message, the grid `\text{grid } %{x}\times%{y}`, and Unknown command with ` Try {x}.`
  and ` or `.
- **Plurals** where English has none (`\text{curve, 3 points}`, `z occurs 3 times`, `At most 24 zeros…`) use `$tn`
  with the same English text for one and many. So English is unchanged, even "1 points".
- **Notation**, Russian only:
  - `CX.texNum` writes the decimal comma, `0{,}5`. Copied LaTeX (`setTexExact`) and English keep the point.
  - `fmtDeg` uses `I18N.num`. The two angle intervals (the log branch note, the custom formula note) join their ends
    with `; ` when an end has a decimal comma: `(−213,3°; 146,7°]`.
  - Region TeX writes every number with the decimal comma. `fmt()` goes through `CX.tex`, and `num()` now applies
    `I18N.texNum` too (also to the mantissa of `1{,}5×10⁻⁴`). Region TeX is display only.
  - The region grid uses `[0{,}5;\,1]` only when an endpoint is a decimal.
  - A typed region formula is shown as `Expr.toTex` prints it, so `|z-0.5|<1.5` keeps its point. That is the
    reader's own input.
  - `\operatorname{Res}` stays Res (DESIGN.md 6). It is not in `RU_OP` or `RU_PLAIN`.
  - Parser messages name functions with `I18N.fnName` (arsh, tg).
  - funcs.js passes homotopy captions through `I18N.notation` when they are made in the Russian interface. Their math
    then reads `\ln`, `\operatorname{cth}`, `\operatorname{arcth}`, `\operatorname{th}`.
  - `I18N.notation` also turns a region formula's `\text{or}` into `\text{или}`.
  - The generators that feed saved work stay English. These are `Expr.toTex`, `menuTex` and the step `tex`.
- **Parser**:
  - It accepts `tg ctg sh ch th cth arctg arsh arch arth cosec Ln` as plain names, as `\tg` and so on, and as
    `\operatorname{tg}`. It also reads `0{,}5` and `\text{или}`, `\text{и}`, `\text{не}`. This holds in both languages.
  - These forms only take effect where the base parser stopped with an error. When such a formula still fails, the
    parser reads it again without them. If that pass succeeds, its tree is used (`cosecot z`). If it fails too,
    English gets the base's message, so English messages are the same. Russian gets the message of the pass that
    read the Russian forms: `tg(z` gives «Ожидалось «)»», not «Неизвестный символ «t»».
  - In Russian only, `lg`, `arcctg`, `arccot`, `acot` and `0,5` get specific messages.
  - The `Try \sin or \sinh` suggestions do not list the Russian names.
- **The Cyrillic glyph module** `src/cyr.js`. `tools/make_cyr_module.py` makes it from `tools/cyr_template.js` and the
  CMU tables.
  - It has Roman and Bold (168 glyphs each, with kerning). Italic has only the panel letters а–м. The outlines use
    relative commands. Each face is a JSON string, parsed on first use.
  - API: `CYR.word(text, face, pt, color)`, `CYR.split(tex)`, `CYR.typeset(tex, pt, color, XD.tex)`. These return
    XD.tex's item shape: `{inner, glyphs, w, a, d, vb0, k}`.
  - The bold operator-name finding lives here. Its cause was weight, not a bold face. Every face is stroked with
    `stroke: 13`, so words match MathJax's ink. Operator names (Im, tg) stay with MathJax, upright and regular. The
    module never sets them.
  - cyr.js is not in the build yet (see phase 2b).

## Tests (all pass)

- `node test/t_i18n.js`: 4019 checks. These are the prototype's tests, run on the shipped module and table, plus the
  phase 2a parser checks: `0{,}5`, `\text{или}`, idempotent notation, Russian messages. Also detection with
  `AUTO_DETECT` off, Res, and region TeX: one shape of each kind, no decimal point in Russian.
- `node test/t_i18n_keys.js`: 805 checks (252 keys). Every `$t`/`$tx`/`$tn` key in `src/` has a Russian entry. Each
  form fills exactly the English placeholders. Plurals have four forms.
- `node test/t_i18n_parse.js`: 22780 checks. 5459 string literals from src, test and the base (the catalog, presets,
  examples, tour and test formulas) are parsed, plus the catalog's TeX and 446 printed-back formulas. Each gives the
  same tree in the base and in English and in Russian. Refused inputs keep the base's English message in English.
  One literal that the base refused now parses: `-1{,}25`. It also checks the Russian messages of 7 unfinished
  formulas in Russian notation, and that English keeps the base's message for them.
- `node test/t_i18n_english.js`: the same 977 calls run in the base and in `src/`, in English. All outputs are
  byte-identical (100 KB of strings). In Russian, 695 of them differ in text and none in behaviour.
- `node test/t_cyr.js`: 1646 checks. The compact outlines draw the same points as the CMU tables. Also checks the
  stroke, metrics, kerning, no-break spaces, the splitter and the composer.
- The 19 existing node tests print the same output in the base and in `work/xi`, with timings masked. `t_natpaths`
  has the same 5 failures as in the base. `t_tour` and `t_curves` (a wall-clock check) fail the same way in both.
  Run in parallel on a loaded machine, `t_fcurve` failed 3 wall-clock checks in xi only. Run alone, it is
  byte-identical to the base.
- Headless Chrome (`test/xi_i18n_cdp/cmd/`, port 8867; the profile is deleted):
  - English, `en.js`: no console error. `document.body.innerText` and the `#app` markup length equal the base build.
    The language is `en`. `<html lang>` is untouched. No font link.
  - English pixels, `pix.js` and `pix390.js`: screenshots at 1440 light, 1440 dark and 390 equal the base build pixel
    for pixel.
  - Russian, `ru.js`, by `?lang=ru` and by `navigator.languages` = `ru-RU`. Catalog groups and labels, region labels,
    parse messages and homotopy captions are Russian (`\ln z`, `0{,}5-1{,}25i`). There are no console errors. `?ns=` on
    a Russian browser stays English. A stored `cmw-lang:<ns>` = `ru` gives Russian. `uk-UA,ru` gives English.
  - `ui3.js`: the formula field shows «Ожидалось «)»».
  - `fix2.js` (review round 2): with `?lang=ru`, `tg(z` gives «Ожидалось «)»», `\tg` «После tg не хватает выражения»,
    `Ln(`, `0{,}5+` and `|z|<1 \text{или}` «Выражение не закончено». Region TeX `\operatorname{Im}z<0{,}5` and
    `\text{сетка } [-0{,}5;\,1]\times[0{,}25;\,1{,}25]`. The note «2 нуля, 1 полюс». Res stays. A `ru-RU` browser
    gets English (`AUTO_DETECT` off). No console errors. `ru.js` still expects Russian from the browser language; it
    gives English until phase 2b turns detection on.
  - English pixels after round 2: `pix_slow.js` (10 s settle) is identical at 1440 light and dark. At 390 one run
    differed in a few antialiased pixels of a header icon, and the next run (`px_nocanvas.js`, 7 s) was identical.
    With the original 4.5 s settle, runs differed, because the machine was loaded (load average 16 to 20). The
    round-2 changes have no English DOM path; `t_i18n_english.js` is byte-identical.
  - Shots: `test/xi_i18n_cdp/shots/ru_param_1440.png` (chain cards «Экспонента», «Дробно-линейная», shapes
    «Формула 1»), `ru_formula_err.png`, `cyr_caption.png` (a caption set by `CYR.typeset` with MathJax: 0 `<text>`).
  - Cost, `cost.js`: evaluating i18n.js and the table string in English takes 0.8 ms (median of 20).

## Files changed (in `work/xi`)

- Changed:
  - `build.py`: three new lines after the MathJax block put `i18n.js` and `i18n_ru.js` first. Line 5, which xr edits,
    is untouched.
  - `src/cx.js`: an English-only stub for vm tests that load cx.js without i18n.js, and the decimal comma in `texNum`.
  - `src/parse.js`, `src/funcs.js`, `src/region.js`, `src/curves.js`, `src/calc.js` (messages only), `src/gl.js`
    (`friendly`), `src/glsl.js` (one message).
- New:
  - `src/i18n.js`, `src/i18n_ru.js` (generated), `src/cyr.js` (generated).
  - `tools/make_ru_table.py`, `tools/ru_extra.json`, `tools/ru_report.json` and `tools/ru_collisions.json`
    (generated), `tools/make_cyr_module.py`, `tools/cyr_template.js`.
  - `test/t_i18n.js`, `test/t_i18n_keys.js`, `test/t_i18n_parse.js`, `test/t_i18n_english.js`, `test/t_cyr.js`,
    `test/i18n_sites.js`, `test/xi_i18n_cdp/` (the kit on port 8867, with `cmd/` and `shots/`).
- Not changed: app.js, page.html, tour.js, inverse.js, view.js, sphere.js.

## Re-running the table

`python3 tools/make_ru_table.py` (`--strict` fails on any call site without Russian), then `node test/t_i18n_keys.js`
and `node test/t_i18n.js`. It was last run at the end of this phase, on the tables as of 21:09 (round 4). It reads
both the old placeholder form and round 4's `en_key` / `en_plural` / `ph`. Corrections made to `ru/*.json` after that
need one more run.

`tools/ru_extra.json` holds the Russian for 16 call sites that have no inventory text with the same wording, plus the
`tool` context with soft hyphens (`$tx('tool', 'Circle')` → «Окруж­ность»). These are mine and need the table owner's
review. Round 2 added `log, √ and powers use arg ∈ {iv}` and the plurals `{n} zero` / `{n} pole` (нуль, нуля, нулей;
полюс, полюса, полюсов).

Two entries in `tools/ru_extra.json` override the math table. The table owner should move them into `ru/math.json`
and then delete them here:
- The Joukowski chain caption (`…(principal power), where $J_t(%{v})=%{rest}`): «…(главное значение степени); здесь
  $J_t(…)=…». Before, it said «где» twice, because the nested `joukWords` text has its own «где».
- The zoom caption's `, a zero of $%{f}$`: «, нулём функции $%{f}$». It follows «с центром $c=1$», so it takes the
  instrumental case.

The generator was re-run at 23:14. The tables `ru/chrome.json`, `ru/math.json` and `ru/guide-tour.json` had not
changed since 21:09.

## What phase 2b must do

- **Detection**: set `AUTO_DETECT = true` in `src/i18n.js`. Do not publish phase 2a without phase 2b. Until 2b, a
  Russian browser keeps English, so a 2a-only build never shows a half-translated app.
- **build.py**:
  - Keep the i18n line (line 12 ff.) and add `cyr.js` to it when figure.js calls it: `['i18n.js', 'i18n_ru.js',
    'cyr.js']`.
  - Add figure.js, sound.js and tour.js on line 5 as xr does.
  - The page grows by 76 KB gzip (579 → 656 KB, +13%) for the table, for every reader, English included. cyr.js adds
    48 KB. Evaluating the table string costs 0.8 ms; English never parses it. DESIGN.md 9 preferred a fetched
    `i18n/ru.json`. This is the lead's decision before the gate (review round 2, finding 7). To fetch it instead,
    `I18N.define` takes a fetched table and nothing else in the module changes. But the catalog is built at load
    with `$t`, so Russian would then need an async start in app.js and a separate artifact file next to the page.
- **page.html**:
  - `data-i18n="no"` on the wordmark and `data-i18n="html"` on «Key in the <i>w</i>-plane». The page test then
    checks them again.
  - The `:root[data-lang="ru"]` font rule (Roboto Flex, JetBrains Mono).
  - The globe button. It stays in the header in both languages (the user's final decision) and folds into More where
    the bar is short. It also goes in the More menu and the palette.
- **app.js init**:
  - Call `I18N.applyPage()` and `I18N.applyStatic(#app)` (they do nothing in English).
  - `I18N.onSwitch(save, fail)` with `writeState()` and the undo stash.
  - `I18N.onFonts(redraw)`.
  - Route the key handler through `I18N.keyOf(e)` and `I18N.isPaletteSlash(e)`.
  - Add the palette commands Language: Auto / English / Русский.
- **app.js display boundary**:
  - `TeX.set()` applies `tex = I18N.notation(tex)` once. This covers menuTex, the step and chain TeX, region shapes
    and on-screen captions.
  - `mj()` and figure.js `XD.tex()` do the same. Notation is idempotent, so captions that funcs.js already converted
    are safe.
- **app.js strings**:
  - Wrap them with `$t`. The generator then matches them to the inventory automatically.
  - Places that use English text as data: palette groups `'Custom formula'` and `'Calculus'` (app.js 8313, 8337,
    8446), `Region.KINDS[k].label.toLowerCase()` glued into English sentences (6 places, which become the
    `export.extra.shape_*` templates), and the shape-label regex `/[A-Za-z]{2}|\s/` (use `/\p{L}{2}|\s/u`).
  - The tool grid uses `$tx('tool', label)`.
- **Numbers**: `CX.fmtNum`, `fmt` and `fmtExact` are unchanged; they feed inputs. Readouts and tick labels that are
  display only should go through `I18N.num`.
- **English captions from the Russian interface**: `CX.texNum`, `$t` and the homotopy captions follow `I18N.lang`. Build
  an English caption inside `I18N.using('en', …)` for synchronous code, or with `I18N.at('en')`. Do not await inside
  `using`.
- **figure.js**:
  - Use `CYR.typeset(tex, pt, color, XD.tex)` where `CYR.hasCyr(tex)`. Glyph keys are `CYR-RM-41E` and so on, joining
    `XD.glyphs`.
  - Panel letters: `\textit{а}`. «Рис. 1.»: `\textbf{Рис.~1.}`.
  - Check the PDF path: the stroke on the `<g>` must survive the `<use>` → `<path>` step.
- **tour.js and sound.js**: wrap `body`, `touch`, `try.text` and the control labels. The sound keys go through
  `keyOf`.
- **Then**:
  - Re-run `tools/make_ru_table.py --strict` and the tests above.
  - Run the overflow and "no English left" browser matrix in Russian.
  - Run the English quality and perf suites.

## Open

- arcoth is in captions only. The formula language has no inverse coth in either spelling.
- A region field reads `|z|<0,5` as two conditions, in both languages (unchanged).
- `tools/ru_collisions.json` lists 15 English texts with several Russian ones. Each needs a `$tx` context at its
  phase 2b call site.

## Review round 2 (2026-10-22, 8 findings)

1. Wrong Russian message for unfinished Russian notation. Fixed in `parse()`: if the base pass also fails, Russian
   throws the Russian pass's error. English is unchanged. Seven inputs are in `t_i18n_parse.js`.
2. Region TeX mixed `0{,}5` and `0.5`. Fixed in `num()` (one line, plus the mantissa). `iv()` now writes
   `[0{,}5;\,1]`. Checked for every kind in `t_i18n.js`.
3. Degree intervals were ambiguous. Fixed with `degIv()` in funcs.js: `(−347,5°; 12,5°]`. The custom-formula template
   is now `log, √ and powers use arg ∈ {iv}`. English is byte-identical.
4. The zeros-and-poles count was English. Fixed with two `$tn` plurals and their Russian. English is unchanged,
   including `0 poles`.
5. A 2a-only build would be half Russian. Fixed with `AUTO_DETECT = false`, and noted above.
6. Res became res. Fixed: Res is out of `RU_OP` and `RU_PLAIN`. The two checks now expect Res.
7. English readers download the table. Not changed: it is the lead's decision. The cost is stated above.
8. Caption style («где … где», «нуль функции»). Fixed in `tools/ru_extra.json` for now. The table owner should move
   the two entries into `ru/math.json`.

## Lead decisions after the 2a check (2026-10-22, 23:15)

- **Finding 7 (the Russian table for English readers):** ship it embedded, as now. The app is one HTML file (the
  claude.ai artifact and GitHub Pages), so a separate download is not an option there. English never parses the
  table, so the cost for English readers is bytes only (about +76 KB gzip). Keep it as one JSON string inside
  I18N.define, parsed on the first Russian lookup.
- **Phase 2b (work/xb) must:** set AUTO_DETECT = true in src/i18n.js; take work/xi's FINAL i18n.js, i18n_ru.js
  generator and the wrapped math-side files (snapshot: work/xi-final-snap, SHA256SUMS there), not the earlier copy
  xb's setup step took; move the two overrides from tools/ru_extra.json into ru/math.json; update
  test/xi_i18n_cdp/cmd/ru.js to expect Russian from the browser language once detection is on.
- 2a is never published without 2b.
