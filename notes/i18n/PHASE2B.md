# Russian localization: phase 2b, integration (2026-10-23)

User request: "Can you add russian localization if system language is russian?"

This step joins the phase 2b parts in `work/xb` and checks them together. The parts were: the core and the table
(PHASE2B-SETUP.md), app.js, and figure.js, tour.js, sound.js and page.html. It also takes in phase 2a's math-side files
from `work/xi`.

## What was built

1. **Phase 2a is merged into xb.** The lead decided this at 23:15 (PHASE2A.md, "Lead decisions").
   - cx.js, funcs.js, region.js, curves.js, gl.js and glsl.js are copies of xi. In xb these files were still equal to
     the gate, so the copy is the merge.
   - calc.js is a 3-way merge (gate, xb, xi). It keeps xr's newer deadline code and xi's wrapped messages.
   - parse.js is xi's, plus the decimal-comma hint (item 6 below).
   - i18n.js is xi's final module with two changes: `AUTO_DETECT = true`, and `applyStatic` now also translates a
     canvas's own label (the plane canvases' `aria-label`).
   - tools/ru_extra.json and the tests t_i18n.js, t_i18n_parse.js, t_i18n_english.js are xi's.
2. **Init.** The language is decided when i18n.js loads, before funcs.js builds its catalog. `init()` first calls
   `I18N.applyPage()` (`<html lang="ru">`, `data-lang`, the font link) and `I18N.applyStatic(#app)` once. The sound
   popover is translated once by sound.js. In English both calls return at once. `init()` runs in the
   DOMContentLoaded handler. In Chrome that starts at 98 to 137 ms and the first paint comes at 108 to 144 ms, after
   it. So the English static text never flashes in Russian.
3. **The Language setting.**
   - The globe button (`#langBtn`) is in the header in both languages. Its menu is «Авто (Русский)» or «Авто
     (English)», English, Русский. The current choice has the menu's radio dot. I removed a second check mark.
   - Below 1024 px the globe folds into the More menu with the other secondary buttons. The palette has the same three
     rows for "язык", "language", "russian", "английский".
   - Switching writes the work, checks that it was written, stashes the undo history and reloads.
   - New: the open panels come back too. The stash now also holds the open deformation (its t, paused), the open lamp
     and the selected shape. Before, the deformation closed after a switch.
4. **Keyboard.** Letter keys go through `I18N.keyOf(e)`, which reads `e.code`. On ЙЦУКЕН these work: the tool keys,
   M (deformation), P (paths in the deformation), Shift+M (sound), Cmd/Ctrl+K, Cmd/Ctrl+E, the digits and «.» on the
   slash key for the palette. A focused text field keeps its letters.
5. **The tablet header (768 to 1023 px).** A More menu holds Examples, the command field, the two panel toggles,
   Export, Theme, Sound, Sound settings, Language and Help. Nothing overflows there in either language. At 1024 px and
   above, and on phones, the bar is as before (checked: same text, same attributes, same pixels as the base).
6. **The decimal-comma hint.** In Russian, any parse error in a formula with a comma between two digits ends with
   «Дробную часть отделяйте точкой: 0.5». Example: `sin(0,5z)` gives «Ожидалось «)». Дробную часть отделяйте точкой:
   0.5». When the comma itself is the error, xi's longer message stays («…: 0.5, а не 0,5 (запятая разделяет
   условия)»). English messages do not change.
7. **No English left.** test/i18n_walk_cmd.js walks the Russian interface, and test/i18n_scan.js records every string
   with a Latin word that is not allowed. The walk covers every view and surface, all 14 examples and every card, the
   deformation, every drawing tool and shape editor, the context menus, the palette, the guide, the help menu, the
   export dialog and its controls, the sound popover, every step of all 7 tour chapters, and on narrow screens the
   drawers and the tool sheet. It ran at 1440 and 390 px.
   - The first walk (1440 px) found 54 strings. Most were attributes the app.js matcher had left English next to a wrapped copy
     (`'aria-label': 'Reset camera'` beside `title: $t('Reset camera')`).
   - Allowed Latin: math names (Re, Im, arg, exp, sin), key names, file formats and units, product
     names (Overleaf, Beamer, Google Docs, WebGL, Web Audio, iPhone), LaTeX names (amsart, Letter, [tbp]) and the app's
     name.
   - The last walks found nothing but «ImLn z» (see "What is left").
   - A static pass found the strings the walk could not reach: the arc, grid and formula field labels, the zero and
     pole buttons, and the gauge.
   - The Russian is in `notes/i18n/ru/phase2b-leftovers.json` (32 entries), following GLOSSARY.md.
8. **Fixes found on the way.**
   - Collisions: one English key had one Russian value for two places. «Рациональная функция» and «Дробно-линейная
     функция» (lamp names) had replaced the card names «Рациональная» and «Дробно-линейная». The lamps now use
     `$tx('badge', …)`. The tool grid now uses `$tx('tool', …)`, so shape names and captions no longer carry soft
     hyphens («Окруж­ность 1»).
   - The guide's Sound paragraph had its Russian pasted twice, and it still named Esc where ⇧M belongs. Repaired in
     `ru/phase2b-app.json` (`guide.sound_fixed`).
   - The command field shows the short form «Функция или команда» (DESIGN.md 8.3). Its aria-label keeps the whole
     phrase.
   - More numbers on screen now use the decimal comma. Copied values keep the point.
     - the readouts and the shape sizes (`fmtR`)
     - the root and integral values (`cxShort`; the roots panel showed «−0.5 + 0.866i»)
     - the drag chips (r = 1,5), the branch-cut angle and the zoom pad
     - the landscape's 3D tick labels
   - The left readout's "at w" while the preimage search is off is now «в точке w».
   - The export file name comes from the English example name in both languages («roots-as-preimages.pdf»). Before,
     a Russian name slugged to nothing and the file was called «custom.pdf». An ASCII name also suits pdfLaTeX.
   - The pattern swatch says «Лог-полярные» (GLOSSARY: «Лог-полярные клетки»). The swatch caption is two lines of
     52 px, and it cut the long form to «Лог-по-лярные…». The tooltip says the rest.
   - Russian CSS:
     - a lamp name may take two lines («Конформное отображение на образ» was 3 px too wide);
     - pattern captions are set 0.02 em tighter («полярные» was 1.4 px too wide and broke as «поляр-…»);
     - tool labels are 11 px («Полу­плоскость» was 3 px too wide at 1024 px);
     - the wordmark keeps Archivo;
     - the empty formula preview says «Предпросмотр» (it is CSS text).
   - The Phase and Landscape legend words («на полосу яркости», «линии уровня») ran past the chip's edge. On the
     canvas they are now narrowed to fit, in Russian only.
   - The sound status words (running, suspended, worklet) are translated.

## Files changed in work/xb

- src: i18n.js, i18n_ru.js (regenerated), parse.js, calc.js, cx.js, funcs.js, region.js, curves.js, gl.js, glsl.js
  (from xi), app.js, page.html.
- tools/ru_extra.json (xi's).
- notes/i18n/ru/phase2b-leftovers.json (new), notes/i18n/ru/phase2b-app.json (one entry repaired).
- test:
  - t_i18n.js (xi's, extended: section 8 and the designed exceptions in section 3)
  - t_i18n_keys.js (Latin allowed for «arg z» and AudioWorklet)
  - t_i18n_parse.js and t_i18n_english.js (xi's)
  - new: i18n_scan.js, i18n_cmd.js, i18n_walk_cmd.js, i18n_shots_cmd.js
  - xbi_cdp/ (my kit, port 8884) with cmd/en_cmp.js (English against the base)
- Not changed: build.py, figure.js, tour.js, sound.js, inverse.js, sphere.js, view.js.
- The intended English changes are the globe, the tablet More menu and the three English source fixes. Earlier
  engineers made the three fixes: the guarantees tooltip ("log followed by exp returns z") in app.js; Cauchy ("its
  three zeros lie on γ itself") and Phase ("bands bounded by level curves of |F|") in tour.js.
- Clean-up: the daemon and the server on port 8884 are stopped. The Chrome profiles, the kit's screenshots, the
  second kit, perf's ref_root and export_cmd's output are deleted.

## Tests

All of these pass. The perf gate is in its own section below.

- Node:
  - t_i18n.js: 15452 checks. New: detection on; the comma hint in 5 formulas, said once, English unchanged; every
    leftover shipped with a call site; no Russian text pasted twice. Designed differences are no longer reported as
    failures: LaTeX comments with Russian preamble lines, \textit panel letters, search aliases, the empty serial
    comma.
  - t_i18n_keys.js: 3948 checks (1246 keys). t_i18n_parse.js: 26724. t_i18n_english.js: 977 outputs byte-identical in
    English. t_cyr.js: 1646.
  - The 20 other node tests pass. Their output matches the base, except for timings and t_cx_stable's count (278
    checks, up from 273 with xi's cx.js). t_tour and t_inverse_render fail in my base copy only because that copy has
    no notes/ folder.
  - `make_ru_table.py --strict`: 1973 entries, 1246 call sites, 0 unresolved.
- Browser, test/i18n_cmd.js: 95 of 95.
  - Overflow at 360, 390, 768, 900, 1024 and 1440 px, light and dark: no sideways scroll, the bar fits, nothing
    clipped beyond English.
  - No English on the first screen and in the header menus at every width.
  - The globe, its menu and the palette rows. The tablet More menu at 768, 900 and 1023 px. No More button at 1024 px
    and above.
  - Switching through the globe and through the phone More menu: same saved work, view, chain, deformation, panels
    and undo history, in both directions.
  - ЙЦУКЕН shortcuts and text fields. Detection: ru-RU gives Russian, `?ns=` and uk-UA stay English. The hint and
    «tan» in the palette. No console errors.
- Walks (test/i18n_walk_cmd.js): 1440 and 390 px, light and dark: no English left. «ImLn z» is allowed (see "What
  is left").
- English:
  - Against the base build at 1440 light, 1440 dark, 1024 and 390: same text, same attributes and 0 different
    pixels. At 1440 and 1024 the comparison starts below the bar, because the globe shifts the bar's right group. At
    390 the whole page is identical. At 900 only the bar differs (the tablet More menu, intended).
  - mv_views_cmd.js, export_cmd.js (and preflight --latex: 0 failures in 439 checks), tour_cmd.js (92/92) and
    sound_cmd.js pass.
  - Quality suite: PASS, 0 failed, 259 targets met; all 8 golden images 0.00000 (pixel-identical).
- The published page (no test hooks, wrapped with a charset): English and `?lang=ru` load with no console errors and
  no `__cmw` globals. Russian shows «плоскость z», «Скрыть» and «Функция или команда».

## Perf

`test/regress/perf/run.sh --paired --quick` against work/xb-base, run twice. Each run reported 4 FAILs and 7 IMPROVED
out of 686 metrics, and the two runs failed on different metrics.

- Run 1 (00:39) had a loaded machine, with two headless Chromes running walks next to it. It failed on hover input
  p95 (1.5 → 2.6 ms), the jank of opening the deformation in two examples, and the GPU bytes of one sphere scene.
- Run 2 (01:00) was quieter. Those four passed. It failed on GPU peak bytes only: the default scene and example 4.
- The GPU peak bytes swap between the two builds from run to run. Example 0 was 2.63 → 1.88 MiB in run 2 and equal in
  run 1. Example 2 went 2.59 → 2.74 MiB in run 1 and 2.74 → 2.59 MiB in run 2. So they depend on what is resident when
  the metric is read, not on the build.
- In English the new code adds only `$t` calls, which return their argument, and `I18N.num`, which is `String(x)`.
- My reading: no systematic regression, but the gate did not pass. A full run on a quiet machine is still to do.

## Screenshots

`notes/i18n/shots-2b/final/`: every view in Russian at 1440 and 390 px, light and dark (62 PNGs):
- X → Y, Phase, Landscape, both spheres, the deformation
- a chain card with the guarantees, roots as preimages
- the palette («tg»), the phone More menu, the Language menu
- the examples, the guide, the export dialog, the sound popover, a tour step, the help menu

## Review fixes (2026-10-23)

The four reviews (review-2b-ui.json, review-2b-math.json, review-2b-english.json, review-2b-eng.json) had 61 findings.
The ledger is `notes/i18n/ledger-2b.json`: 51 fixed, 6 duplicates, 4 rejected with evidence (ui-21 is the reviewer's
clean record; english-3, -6 and -7 are outside the build or a build-design decision).

### What changed

- **Decimal comma, typing.**
  - Region formulas (ui-1): in Russian, «|z| < 0,5», «Re z > 0,5» and «z^0,5 < 1» now say «Дробную часть отделяйте
    точкой: 0.5, а не 0,5 (запятая разделяет условия)». The rule: a comma between two digits with a comparison on one
    side and a bare number on the other.
  - List fields (math-1): in Russian a list may use «;» (then 0,5 inside an item is 0.5). Without «;», a comma between
    two digits is refused with a hint, never read as two items. English splits as before.
  - The parser reads the plain words «и», «или», «не» (ui-6), plain arsinh, arcosh, artanh (math-16), and suggests the
    Russian names in Russian (math-15).
- **Decimal comma, screen.** Ruler ticks use the comma (ui-2). In Russian the mono face's comma is narrow: a font face
  «CMW Comma» (only U+002C, from a local proportional face) is first in the Russian `--f-mono` (ui-4). It works in
  HTML and on the canvas. The legend run is narrowed to its chip when it would not fit (ui-3).
- **Notation.** ln |F| on the Landscape title and switch (ui-5). Ln in the all-sheets captions (math-8). «угол» for an
  unbounded sector (math-17). The complement's shape in the genitive (math-4). Grid captions no longer repeat the
  grid's name inside the math (math-3).
- **Captions in the other language.** The deformation's paths figure follows the caption switch (math-2). The example
  label «trailing edge» is stored in English and translated where it is shown (math-5).
- **LaTeX.** The Russian document compiles with pdflatex, xelatex and lualatex (iftex; math-12) and prints 0{,}5
  (math-13). Russian snippets wrap the caption in `\foreignlanguage{russian}{…}` and compile in an English-main
  document (math-14). One dash style, `~---` (math-20).
- **Layout, Russian only (page.html).** «Примеры» and «Поиск» in the header at 1024-1199 px (ui-9). Polygon moves into
  «Ещё» below 390 px (ui-7). Card and step names take two lines (ui-10). The calculation chip wraps (ui-8). A hint
  alone in a readout may take two lines (ui-11). The closed paper select drops its point width (ui-16). Cyrillic in
  MathJax formulas is set in STIX Two Text (math-19).
- **Tables.** New strings and corrected Russian are in `notes/i18n/ru/phase2b-fixes.json`. make_ru_table.py now reads
  it last, so it wins. `notes/i18n/ru/fixes_2b.py` adds the no-break spaces before every em dash and between a number
  and its unit in all tables (ui-12, ui-14; 50 entries); `ru/math_src/build.py` does the same on a rebuild.
- **The first paint (eng-1, eng-2).** A small script at the top of page.html decides the language with the same rule
  as I18N. In Russian it marks `<html>`, starts the Cyrillic fonts at once and hides `#app` until init() has
  translated the static text (`I18N.reveal`). The window `load` event reveals it in any case. English returns at once.
- **The Language menu.** Items carry `lang` (eng-3). The menu is named «Язык», opens on the checked item, and the
  globe has `aria-expanded` (eng-7). Auto names what it would pick on this page (eng-12). The label follows a choice
  that does not reload (eng-6). Focus returns to the globe after the reload (eng-5). A lost undo history is said after
  the reload (eng-8).
- **Keys (english-1).** `I18N.keyOf` keeps `e.key` when Alt, Option or AltGr is held, or when the letter is Latin. So
  å, ü, ł, ż and Option letters behave as in the base; ЙЦУКЕН still works.
- **English.** The only English changes in this round: the parser now accepts arsinh, arcosh, artanh and the words
  и, или, не (all were errors before), and the base's Latin tests are back for word labels (english-5). xb also takes
  xr's English changes in the four places that conflicted (english-2, below).
- **Other.** Spoken numbers use the screen's comma (eng-9). Russian shape-row tooltips are plain text (eng-10). The
  guide says the letter keys work in the Russian layout (eng-11). The generator drops a plural object under a
  non-plural key and lists 192 orphan keys in `tools/ru_report.json` (eng-13).

### Files changed in this round

- work/xb/src: i18n.js, parse.js, funcs.js, app.js, figure.js, page.html; i18n_ru.js regenerated.
- work/xb/tools: make_ru_table.py (phase2b-fixes.json last; 'dropped' and 'orphans' in ru_report.json),
  ru_extra.json (typography); ru_report.json and ru_collisions.json regenerated.
- notes/i18n/ru: phase2b-fixes.json and fixes_2b.py (new); chrome.json, guide-tour.json, math.json, phase2b-app.json,
  phase2b-ui.json (typography only); math_src/build.py (typo()).
- work/xb/test: t_i18n.js, t_i18n_keys.js; the kit test/fx2b_cdp (port 8889) with its command files in cmd/.
- Not changed: build.py, cx.js, region.js, curves.js, calc.js, tour.js, sound.js.

### Merge with xr (english-2)

xb now has xr's behaviour in the four places where xr changed English after the branch point: no empty-plane note
(`syncEmptyState` removed), no Shapes empty note, an empty count of `''`, and the save toast only when `saveFile` did
not return `false`. The strings that remain are wrapped. A trial `git merge-file` of xr into xb (03:10) leaves three
conflicts: app.js (the Shapes heading, the count) and figure.js (the copy-again toast). In each, take xb's side: it
is xr's line with `$t`. page.html, parse.js, funcs.js, tour.js and sound.js merge clean. After the merge, run the
Russian walk (`test/i18n_walk_cmd.js`) on the merged build: xr's newer strings arrive unwrapped.

### Size (english-4)

The published page is 2,741,269 B against 2,255,552 B for xb-base: +485,717 B raw (+21.5 %) and +147,983 B gzip
(+21.3 %). The parts (gzip): i18n_ru.js 69.4 KB, cyr.js 48.3 KB, i18n.js 10.9 KB, and the wrapping. English never
parses the tables. Left to the lead: cut the bold glyph face to «Рис.», or move the tables into a
`<script type="application/json">` that only Russian reads (this would also remove most of english-3's +8 ms load
time, which is the browser scanning the larger script; evaluation itself costs +0.05 ms).

### Tests of this round

- Node: all 25 test files pass. t_i18n.js: 15543 checks (new: keyOf with AltGr and Option, region and list commas,
  и/или/не, the em-dash and unit lint, every phase2b-fixes entry shipped). t_i18n_parse.js: 26424. t_i18n_english.js:
  977 outputs byte-identical in English. t_i18n_keys.js: 3963. `make_ru_table.py --strict`: 1983 entries, 1252 call
  sites, 0 unresolved.
- Browser (test/fx2b_cdp, port 8889): i18n_cmd.js 95 of 95; export_cmd.js pass (163 files) and the preflight
  `--latex` 0 failures in 439 checks; tour_cmd.js 92 of 92; sound_cmd.js pass; mv_views_cmd.js pass.
- English against xb-base (en_cmp.js): same text, same attributes, 0 different pixels at 1440 light and dark, 1024
  and 390; at 900 only the tablet More menu differs (intended).
- Quality suite: PASS, 0 failed, 259 targets met; the 8 golden images 0.00000.
- LaTeX: the Russian document compiles with pdflatex, xelatex and lualatex (0 errors, 0 missing characters); 14
  Russian snippets compile in an English-main and a Russian-main document.
- Perf, `test/regress/perf/run.sh --paired --quick` against xb-base (03:03, no other perf run, my Chromes idle): 1 FAIL,
  62 IMPROVED, 449 PASS. The FAIL is examples.13.first_frame_ms («Every sheet of the logarithm»), 21.0 → 85.2 ms. A
  paired rerun of the examples unit with 3 reps passed (43.1 → 78.7 ms; limit 104 ms), so the gate passes there but
  the slower first frame is consistent. No GPU byte metric failed this time (english-6). The GL-side files equal the
  base. Not explained yet (see "What is left").

### Evidence and clean-up

- Evidence: `work/xb/test/fx2b_cdp/out` (captions caps.json, the LaTeX files, the acceptance results, perf logs) and 8
  screenshot crops in `work/xb/test/fx2b_cdp/shots`.
- The daemon and the server on port 8889 are stopped. The Chrome profile, the other screenshots, export_cmd's output
  and perf's ref_root are deleted.

## Verifier round (2026-10-23)

The verifier (`review-2b-verify.json`) had 8 entries. Ledger: `ledger-2b.json`, ids verify-1 to verify-8. Five are
fixed (1, 5, 6, 7, 8), one is closed with evidence (2), two stay open by their nature (3: the lead's decision; 4: after
the merge).

### What changed

- **verify-1, lists survive a language switch.** funcs.js now reads a saved list by one rule in both languages. With a
  «;» outside brackets the items split on «;» and a comma between two digits is a decimal comma. Without one, they
  split on commas, as before. The refusal of «0,5, −1» now applies only to text typed into a list field in the
  Russian interface: the coefficient fields and the zero and pole fields register what is typed
  (`Funcs.typedList`). An undo carries that record to the restored step (`Funcs.typedKeep` in `restore`), so a
  refused text does not come back unchecked. A saved, switched or loaded text is never refused.
  - The verifier's chain (zeros «1,0.5», coefficients «1,0,1») builds in English and, after the switch through the
    globe, in Russian, with no error and the same lamps. A Russian list «0,5; −1» opens in English as 0.5 and −1.
  - English change: a list with «;» was an error («Unexpected ';'»); it now reads like the Russian one.
- **verify-5, a warning for «Re z>0,5<|z|».** The parse keeps the meaning (two conditions), and in Russian a caller
  may ask for notes (`opts.notes`). The region formula field shows «Запятая между цифрами разделяет условия; дробную
  часть отделяйте точкой» under the field; a formula shape's field shows it as its tip. English never gets it.
- **verify-6, «и» named as typed.** The tokens of и, или, не keep their spelling, and «Unexpected» names it:
  «Здесь не ожидалось «и»». English messages do not change.
- **verify-7, the palette's language rows.** «Язык: English» and «Язык: Русский» set the name in a span with
  `lang=en` or `lang=ru`, as the menu does. The row's text and search are unchanged.
- **verify-8, «π/2» in tooltips.** The plain-text tooltip (outside English) writes a fraction of two single symbols or
  numbers as a/b: example 1 reads «|Im z| < π/2». tour.js is not changed.
- **Found by the trial walk (verify-4).** The same tooltip wrote «сетка [-1,5; 1,5]times[0; 2,4]» for a grid in the
  deformation. It now writes × for `\times` and a minus sign for «-» (not inside a Russian word): «−1,5 < Re z < 1,5».
  This came from eng-10 in the review round, after the last walks. English titles are unchanged (they are TeX).

### verify-2: example 13's first frame (closed, no regression found)

- A CPU profile of `__cmwExample(13)` to the second animation frame, in English, after examples 0-12 as the perf
  harness loads them, 3 loads of each build alternating (`test/vc_cdp/cmd/v_prof.js`). Per load: native time
  ("(program)": the GPU process, shader compile and link) 189.5 ms in xb-base and 197.4 ms in xb;
  getProgramParameter 7.9 and 9.2 ms. Every JavaScript function is under 3.6 ms in both builds, and the new code
  (notation, captions, $t) does not appear in the list. So the first frame waits on shader linking, not on our
  code.
- A direct timing (no profiler, 4 loads each, alternating; `v_time.js`): call to first frame, median 46.9 ms for
  xb-base and 42.2 ms for xb.
- The harness's own numbers point the same way: in the failing run, xb linked 8 programs for this load and xb-base 9.
  Which programs are still to link when example 13 opens depends on what earlier examples compiled and on the
  driver's parallel compile, so this one-shot metric moves with the GPU state, not with the build.
- Paired quick run (04:12, against xb-base): examples.13.first_frame_ms 73.4 → 77.2 ms, with 8 programs in both
  builds: it passes. The run's 2 FAILs were noise, each checked by a paired rerun:
  - hover.default.input_p95_ms (1.79 → 2.8 ms): 5 reps each, median 2.0 → 2.0 ms, PASS.
  - examples.4.gpu_peak_bytes: the examples unit with 3 reps each, PASS with 0 FAIL. That metric swaps between
    2,400,704 and 3,294,400 B from rep to rep in both builds. examples.13 there: 76.3 → 73.9 ms.

### verify-3 and verify-4 (open)

- **verify-3 (the lead's).** The English reader still loads the Russian tables: the published page is 2,744,248 B
  against 2,255,552 B for xb-base (+488,696 B, +21.7 %). The two remedies are in "Size (english-4)" above. Nothing
  is recorded in USER-DECISIONS.md.
- **verify-4 (after the merge).** A trial merge now (`git merge-file`, base xb-base, xr's src as of 23:15) gives the
  same 3 conflicts: app.js (the Shapes heading, the count) and figure.js (the copy-again toast). Take xb's side in
  each. A static scan of the merged app.js and figure.js finds no new English sentence outside `$t`: xr's only new
  user strings are the two figure toasts, which xb already wraps. page.html (CSS only), tour.js, sound.js, calc.js,
  parse.js and funcs.js merge clean. The Russian walk at 1440 px on a build of that trial merge found 2 strings, both
  from xb's own tooltip (fixed, see above), none from xr. After the real merge, run `tools/make_ru_table.py --strict`,
  `test/i18n_walk_cmd.js` at 1440 and 390 px and `test/i18n_cmd.js` again: xr is still changing.

### Files changed in this round

- work/xb/src: funcs.js (the list rule, typedList, typedKeep), parse.js (opts.notes, the token spelling), app.js (the
  typed-list calls, restore, the formula note and tip, the palette rows, texTitle); i18n_ru.js regenerated (1984
  entries, 0 unresolved); tools/ru_report.json and ru_collisions.json regenerated.
- work/xb/test: t_i18n.js (verify-1, -5, -6 checks); the kit test/vc_cdp (port 8891) with cmd/v_all.js,
  v_typed.js, v_undo.js, v_back.js, v_titles.js, v_note.js, v_prof.js, v_time.js, walk_m.js and walk_390.js.
- notes/i18n/ru/phase2b-fixes.json: fx.parse.digit_comma_note.
- Not changed: build.py, tour.js, figure.js, page.html, i18n.js.

### Tests of this round

- Node: all 25 test files pass. t_i18n.js 15558 checks (new: lists in both directions, typed and undone lists, the
  digit-comma note, the token spelling). t_i18n_english.js: 977 outputs byte-identical in English.
  t_i18n_keys.js: 3959. t_i18n_parse.js: 26468. t_zp.js 160, t_funcs.js pass.
- Browser (test/vc_cdp, port 8891):
  - v_all.js, v_typed.js, v_undo.js, v_back.js: the switch in both directions, the typed refusal (and after an undo
    and a redo), the formula note, the token spelling, the palette's lang, the tooltips. No console errors.
  - test/i18n_cmd.js: 95 of 95.
  - The Russian walk (test/i18n_walk_cmd.js) after the tooltip fix, at 1440 and 390 px: all 7 tour chapters, no
    English left, no console errors.
  - English against xb-base (en_cmp.js): same text, same attributes, 0 different pixels at 1440 light and dark, 1024
    and 390; at 900 only the tablet More menu differs (intended).
- Quality suite: PASS, 0 failed, 259 targets met (enforced); the 8 golden images 0.00000.
- Perf: see verify-2 above (the quick paired gate and two paired reruns).

### Evidence and clean-up of this round

- Evidence: the command files in `work/xb/test/vc_cdp/cmd`; perf results in `work/xb/test/regress/perf/results`
  (paired-20261023-041256*.json and the two reruns, paired-latest*.json).
- The daemon and the server on port 8891 are stopped. The Chrome profile, the screenshots, perf's ref_root and the
  trial-merge build are deleted.

## What is left

- The tour's plain-text math runs names together: `\operatorname{Im}\log z` reads «ImLn z» in Russian and "Imlog z"
  in English (a screen-reader line and an aria-label only). It is an English-source issue in tour.js `texPlain`, not
  fixed here.
- The two ru_extra overrides (Joukowski caption, zoom caption) still need to move into ru/math.json (table owner).
- Perf: a full (not quick) paired run on a quiet machine is still to do. The quick gate's open items are closed
  (verify-2): example 13's first frame waits on shader linking, not on our code.
- When xi changes again, copy its math-side files over again. Keep xb's i18n.js (AUTO_DETECT on, canvas labels,
  keyOf, reveal), parse.js (the comma hints and notes, и/или/не with their spelling, arsinh), funcs.js (the list rule,
  typedList, typedKeep), calc.js (merged) and tools/make_ru_table.py (phase2b-fixes.json last, the dropped and orphan
  report).
- The lead's: the bold glyph cut and the JSON-script table (english-3, english-4, verify-3).
- After the merge with xr (verify-4): make_ru_table.py --strict, the Russian walk at 1440 and 390 px, i18n_cmd.js.
- Not confirmed by the user yet (lead defaults): detection by the first browser language; the decimal comma on
  screen; the fonts.

## Merge with xr's final state, and the page size (2026-10-23, 05:00)

### The merge

- Every file of src/ and build.py: `git merge-file -p work/xb/<f> work/xb-base/<f> work/xr-final-snap/<f>` (xb is
  ours). work/xr equals work/xr-final-snap. Since xb-base, xr changed only app.js, figure.js, page.html and build.py.
- Three conflicts, as predicted: app.js (the Shapes heading, the count) and figure.js (the copy-again toast). I took
  xb's side in each: it is xr's line with `$t`.
- The clean hunks, all checked:
  - figure.js: a tick label slides along its axis between two close lines; the arrowheads sit clear of the axes and
    point so the set stays on the left (`senseAt`); the Fit windows come from the view, not the pane size
    (`sceneWin`, `imageWin`); the touch loupe floats above the finger and closes on `pointercancel`; `geom` export.
  - app.js: `viewOf` (the export window of a view).
  - page.html: the empty-state CSS and element are gone; the preview images stay hidden until drawn; the phone export
    dialog keeps a 12 px gutter.
  - build.py: `<meta charset="utf-8">` first in the published page.
- These hunks bring no new user string. The chevron caption (" Arrowheads: orientation." → «Стрелки показывают
  ориентацию.») and the two figure toasts were wrapped already. So `ru/phase2b-leftovers.json` is unchanged, and
  `make_ru_table.py --strict` gives 1984 entries, 1250 call sites, 0 unresolved.
- Tests: `test/t_figure_chevron.js` is new from xr. `test/export_cmd.js` is xr's (one more check: the dialog has the
  same gutter on both sides); xb had not changed it. xr's own kits (`*_cdp`) were not copied.
- work/xi has not changed since work/xi-final-snap. xb's cx.js, region.js, curves.js, gl.js and glsl.js equal it;
  funcs.js, parse.js, calc.js and i18n.js differ only by xb's own changes (listed above). So the plan's step 2
  (xi final into xb) needs nothing more.

### The two ru_extra overrides

- They now live in `ru/math.json`: `export.homotopy_h_t_v_2` («…; здесь $J_t…$», one «где» only) and `math.zero`
  («, нулём функции $f$», instrumental after «с центром»). Also in `ru/math_src/tr1.py` and `tr3.py`, so a rebuild
  of math.json keeps them. They are removed from `tools/ru_extra.json`.
- The shipped table gives the same Russian at both call sites (`ru_report.json` now names the math.json ids). Only
  an orphan key changed.

### The tour's plain-text math (English source fix)

- `texPlain` in tour.js marks every name it reads (Im, log, `\operatorname{…}`, other commands). Two names written
  together keep a space between them; a name before a bracket, a space or a subscript does not get one.
- Effect: "Imlog z" → "Im log z" in English, «ImLn z» → «Im Ln z» in Russian. Also "2π iResᵢ" → "2π i Resᵢ".
- I compared `plainCopy` of every tour string with math, in English and in Russian, before and after: only the
  helicoid step changes, in both languages.
- `test/t_tour.js`: one expectation updated (the Res line), three checks added. `test/i18n_scan.js` no longer allows
  «ImLn».

### Page size: the JSON blocks (USER-DECISIONS.md, the last item)

- build.py takes the table out of `src/i18n_ru.js` and the three faces out of `src/cyr.js`. It writes them as
  `<script type="application/json">` blocks (ids `cmw-i18n-ru`, `cmw-cyr-rm`, `cmw-cyr-bx`, `cmw-cyr-ti`), before the
  app's script, because funcs.js looks the table up while it loads. `<` is written `<` inside them.
- The sources do not change shape. Node tests read `src/i18n_ru.js` and `src/cyr.js` as before.
- i18n.js reads the block on the first Russian lookup. cyr.js reads a face's block on its first use
  (`tools/cyr_template.js`, regenerated with `tools/make_cyr_module.py`). A missing block gives a face without glyphs:
  `word()` returns null and MathJax sets the run.
- The bold face: build.py collects the bold Russian text: the Russian of every `{ b: … }` caption segment in figure.js
  and app.js, and every `\textbf{…}` in the table. Today that is «Рис. 1.»: 5 glyphs (Р и с . 1), 1.2 KB instead of
  56 KB. A bold character without a glyph stops the build. If nothing were bold, the bold block would be left out.
- Limit: a bold Cyrillic word the user types into an edited caption (`\textbf{…}`) has no glyphs now. It falls back to
  MathJax, as a missing glyph did before.
- Size of the published page: 2,753,064 → 2,690,279 B (−62,785 B, −2.3 %); gzip 847,893 → 827,515 B (−20,378 B).
  The blocks are 329,204 B. Without them the page would be 2,361,075 B.
- English load time, before → after (headless Chrome, localhost, cache off, alternating loads, medians; times from
  the navigation start). The third number is the same page with no Russian data at all.
  - 20 loads each: DOMContentLoaded 150.3 → 153.3 ms (151.9); first contentful paint 124 → 128 ms (132);
    domInteractive 116.9 → 119.7 ms (118.5).
  - Main-thread time of the load (`Performance.getMetrics`, 14 loads each): V8 compile 19.2 → 18.7 ms (19.1); script
    71.3 → 70.0 ms (70.4); other tasks, HTML parsing among them, 68.2 → 70.0 ms (66.4); all tasks 209.3 → 208.0 ms
    (208.5).
  - So the Russian data costs English no time this measure can see, before or after. The differences are inside
    the spread between loads (about ±5 ms). The change saves bytes; it does not make English faster.

### Tests of the merged build

Kit: `test/m14_cdp` (port 8793; 8832 served the same dist for the sound files). My command files are in its `cmd/`.

- Node: all 26 test files pass (t_figure_chevron.js is new: 64/64). t_i18n.js 15558, t_i18n_keys.js 3959,
  t_i18n_parse.js 26582, t_i18n_english.js 977 outputs byte-identical in English, t_cyr.js 1646, t_tour.js 933.
- `make_ru_table.py --strict`: 1984 entries, 1250 call sites, 0 unresolved.
- i18n_cmd.js: 95 of 95. The walk (i18n_walk_cmd.js) at 1440 px light and 390 px dark: all 7 chapters, nothing left
  (0), no errors, with the «ImLn» allowance removed. A walk of the bare merge (before my changes) also found 0.
- export_cmd.js: pass, 163 files, 44 figures. Preflight `--latex`: 0 failures in 439 checks.
- sound_clicks_cmd.js + sound_clicks.py: the worklet 0 clicks in all 9 cases; the fallback 0, except
  nodes_landEdge (3 detections, worst −54.7 dB re the local RMS, below the −50 dB snap line: the documented residual).
- sound_cmd.js: 2 failures, the same in three builds: this merge, xb before the merge and xr's own final build
  (work/xr/dist). So the merge did not cause them. They are:
  - "12 turns → 8 bells": 9 bells. `ctx.currentTime` moves during the loop of 12 calls, so a 9th fits.
  - "360 px: the speaker in the bar while on": the test reaches 360 px with sound off. On its own (c_phone.js) the
    speaker shows at 360 and 390 px in both builds.
  - PHASE2B's earlier rounds had sound_cmd passing. Chrome is now 155.0.8059.85 (the quality baseline was .80).
- tour_cmd.js 92 of 92; tour_lit_cmd.js 70 of 70.
- mv_views_cmd.js, deform_nat_cmd.js, zp_cmd.js, morphfig_cmd.js: pass.
- curves_cmd.js: pass. The first run failed only on "Failed to load resource: 404": dist/ had no gl-helpers.html,
  which the kit's `load()` opens. I copied it from work/xr/dist (equal to the main tree's).
- English against xb before the merge (cmd/en_cmp_pre.js), the first screen at 1440 light and dark, 1024, 900 and
  390: same text, same attributes, 0 different pixels.
- Quality suite (`run.sh --no-build`, then `compare.py --only quality --quality-enforce-targets`): PASS, 81 runs,
  0 failed, 259 targets met; the 8 golden images 0.00000.
- The published page in English and with `?lang=ru` (c_blocks.js): no console errors, no `__cmw` globals; Russian
  reads the table and the faces from the blocks.

### Files changed in this step

- work/xb/src: app.js, figure.js, page.html (the merge); tour.js (texPlain); i18n.js (the table block); cyr.js
  (regenerated); i18n_ru.js (regenerated). work/xb/build.py (the merge, the blocks, the bold subset).
- work/xb/tools: cyr_template.js, ru_extra.json; ru_report.json and ru_collisions.json regenerated.
- notes/i18n/ru: math.json; math_src/tr1.py and tr3.py.
- work/xb/test: t_figure_chevron.js (xr's), export_cmd.js (xr's), t_tour.js, i18n_scan.js; the kit m14_cdp.
- work/xb/dist: gl-helpers.html (a test helper).
- Clean-up: the daemon and the four servers are stopped. The Chrome profile, the kit's queue and shots, the
  recordings, export_cmd's output and my extra builds are deleted.

### What is left after this step

- Closed by this step: «ImLn z» (texPlain), the two ru_extra overrides, the lead's page-size decision (verify-3,
  english-3, english-4) and the merge with xr (verify-4).
- The two sound_cmd failures above. They are in xr's final build too: for the sound owner.
- Perf: not run in this step (the plan runs the full gate on main). The page change adds no code on the English path
  except one `getElementById` check in i18n.js, which runs only when Russian is looked up.
- The plan's next steps: the combined copy into main (base r1; main's gate fixes in funcs.js, glsl.js and tour.js),
  then xr-review1-missed.json, then the full gate.
- Not confirmed by the user yet (lead defaults): detection by the first browser language; the decimal comma on
  screen; the fonts.
