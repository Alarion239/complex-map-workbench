# Russian localization: where it stands (2026-10-22)

Your request: "Can you add russian localization if system language is russian?"

Phase 1 is done: the design, all the Russian text, and a working prototype. Phase 2 builds it into the app after the current round (export, sound, tour) is merged.

## What Russian looks like

Open these in `shots-ru/` (prototype `work/xl`, real Russian tables):

- `ru_1440_light_1_xy_chain.png`, `ru_1440_dark_1_xy_chain.png`: the X → Y view with a two-step chain, both side panels.
- `ru_390_light_1_xy_chain.png`, `ru_390_dark_1_xy_chain.png`: the same on a phone.
- `ru_390_*_2_right_panel.png`: Composition, Guarantees, Domain, Step by step on a phone. `ru_390_*_2b_chain_cards.png`: the chain cards.
- `ru_1440_*_3_examples_menu.png`, `ru_1440_*_3b_language_menu.png`, `ru_390_*_3_more_menu.png`: the menus.
- `ru_*_4_export_menu.png`: the Export menu.
- `ru_*_5_palette.png`, `ru_*_5b_palette_query.png`: the command palette.
- `ru_*_6_guide.png`: the guide.
- `ru_*_7_phase.png`: the Phase view.
- `cyr_caption.png`: a Russian figure caption set from outlines. `cyr_caption_vs_pdflatex.png`: the same generated caption beside pdfLaTeX.
- `ru_1440_light_fonts.png`, `ru_1440_dark_fonts.png`: Russian with Roboto Flex first (one face per label).

What the shots do not show yet:

- The tour: it is not wired into this base (it is in `work/xt`).
- The new export dialog (in `work/xr`).
- Some strings are still English in the shots: pane headers ("domain of F", "image, after 2 steps"), "2 / div", the legend chip, default shape names ("Formula 1"), "3 shapes", the phase-style names "Modulus, Contours, Cauchy", "Preview", "1 of 8", a few guide paragraphs, and the lamp letters A E R P M C I. The base code builds these with their values inside, outside the prototype's reach. Their Russian is in the tables; phase 2 wires them.

## Overflow (390 and 1440 px, light and dark)

Checked with the overflow detector, Russian against English.

- Fixed (Russian-only CSS in `work/xl/src/page.html`, and soft hyphens in the tables):
  - Draw tools: names wrap at soft hyphens («Окруж-ность», «Прямо-угольник», «Много-угольник», «Полу-плоскость»). The tool keys grow by one line in Russian only.
  - Command field: «Функция или команда».
  - Pattern tiles: two-line captions.
  - Palette rows: two lines allowed.
  - Card and lamp names: the semi-condensed width the tool labels already use. The Möbius card fits «Дробно-линейная».
- Left as designed: the Examples blurbs and palette descriptions are one line with an ellipsis, as in English.
- Open: the lamp «Конформное отображение на образ» is cut at 1440 px (it fits on a phone). Options: a two-line lamp row in Russian, or a shorter name. To decide with you.

## Decisions taken (please confirm or change; each is one switch)

1. **When Russian is used.** It is used when the browser's first preferred language is `ru` or `ru-*`. Otherwise the app is in English. `uk`, `be`, `kk`, or Russian as a second language, stay English.
2. **Language setting** (you decided this). It has three options: Auto, English and Русский. The header keeps the Language (globe) button in both languages (user decision 2026-10-22). It folds into the More menu where the bar is short, and it is also in the palette ("язык", "language"). In this base there is no More menu at 768–1023 px, and the bar there is already too wide, so the globe folds away at those widths and the bar gets no wider. It is stored on this device only (`cmw-lang`, through `lsk()`, in try/catch). It never goes into saved work or shared links. Switching saves and reloads; your work, view and undo history come back. If the browser blocks storage, nothing reloads and a note says why.
3. **Figure captions and LaTeX** follow the interface language. The export dialog has a caption-language switch (interface language, English, Русский), so you can write an English article from a Russian interface.
4. **Notation in the Russian interface** (you confirmed this): tg, ctg, sh, ch, th, cth, arctg, arcctg, arsh, arch, arth, arcth, cosec. The formula parser accepts both spellings in both languages. Saved work and links keep the English names.
   - Re z, Im z: upright, as in Шабат and Лаврентьев–Шабат. Never ℜ, ℑ.
   - arg z: the principal value. Arg z: the multivalued argument, used only where all values are meant.
   - ln z: the natural logarithm, any branch (the branch is named in words). Ln z: the multivalued logarithm ("All sheets"). log only with a base: log₂ stays.
   - LaTeX uses `\operatorname{tg}`, which needs only amsmath. babel-russian's `\tg` exists only when babel loads Russian (re-tested).
5. **Decimal separator.** A comma in text, readouts, captions and tick labels. A point in input fields and in copied values, so they paste back. In LaTeX: `0{,}5`. Inside brackets, a semicolon only when an endpoint is a decimal: `[0{,}5;\,1]`, but `[−1, 1]` and `(−π, π]`.
   - A question for you: people type what they see, and `z^0,5` is an error. In Russian the error now says "use a decimal point". Keep the comma on screen, or show the point on screen and use the comma only in captions and LaTeX? It is one switch (`DECIMAL_COMMA`).
6. **Fonts.** The interface fonts (Archivo, B612 Mono) have no Cyrillic. In Russian only, Cyrillic falls through to Roboto Flex (interface) and JetBrains Mono (readouts). STIX Two Text already has Cyrillic. English loads nothing new. In exported figures, Russian words are set from Computer Modern Unicode outlines, so they match the formulas and the PDF has no fonts.

## Review round 1: the first 37 findings (all applied)

- Mathematical errors fixed:
  - The example of an incomplete guarantee list. It is now «exp после ln даёт z»; ln(e^z) ≠ z in general.
  - The tour's Cauchy step: the zeros of z³ − 1 lie on the unit circle, not inside.
  - «Полосы яркости» are bounded by level lines; they are not level sets.
  - «сравнение» (a congruence in Russian) is now «неравенство».
  - «точечная» and «штриховая» replace «пунктирная».
  - A homotopy now «деформирует» id into F; «переводит» would mean f(A) ⊂ B.
  - «на» is used for onto, as in Шабат.
  - «поэтому … причём F′ ≠ 0», and «где P и Q — многочлены».
- Notation: `\log_2` stays `\log_2`; `arcoth` becomes `arcth`; interval punctuation follows the rule above.
- Captions: Russian two-panel templates («*а* — … в плоскости z; *б* — образ при отображении F»). The snippet's preamble comment now has the Cyrillic packages. pdfLaTeX, XeLaTeX, LuaLaTeX and Beamer were tested: 0 errors.
- Wording: «надписи» (labels) vs «подпись» (caption), «на рисунке», «не ограничена», «воспроизводит» (never «проигрывает», which also means "lose"), «выделите» for shapes, «Задание» in the tour, zero and pole counts with «не менее», and no-break spaces.
- One finding was applied with a choice: the Help button stays «Справка». In `work/xt` it opens a menu with both the guide and the tour. The guide itself, and «Открыть руководство», say «Руководство».

## Review round 2: engineering (80 findings, ledger `ledger-eng.json`)

The first reviser saw 37 findings. The engineer went through the 24 i18n and lead findings and the others that touch the mechanism, the prototype, LaTeX or figures.

- Figures: Russian words were lighter than the math, so Im and tg looked bold. MathJax's glyphs are the CM outlines grown by about 6.5 units per side. The Cyrillic outlines are now stroked to the same weight (measured: 0.99 to 1.00 of MathJax's ink). The demo caption is now made by the module and follows the interval rule: `[−1, 1]`. Compare `shots-ru/cyr_caption_vs_pdflatex.png`.
- Figures also gained Latin letters in the outline tables (mixed words like «PDF-файл»), italic panel letters *а*, *б*, and no-break spaces after one-letter words and before the dash.
- LaTeX: numbers are formatted where they are made (`texNum`, `texInterval`), never by a regex over finished TeX. A generated Russian snippet compiles in pdfLaTeX and XeLaTeX (`latex/run_gen.sh`). PDF info strings are UTF-16 (checked with pdfinfo).
- Strings: templates with math use `%{name}`, so TeX groups are never filled. Plurals are keyed on both English forms and every Russian form must carry the count. An English caption built in a Russian interface stays English across awaits (`I18N.at()`).
- The Russian table is a separate file fetched only in Russian. English fetches nothing and its docked header and planes are identical to the base (browser check).
- Keys: every letter shortcut works on ЙЦУКЕН (browser check), and the '/' key of ЙЦУКЕН-PC opens the palette.
- Parser: `Ln z` works; in Russian, `lg`, `arcctg`, `acot` and `0,5` get clear messages. English messages are unchanged.
- Tests: 1563 node checks pass (`proto/t_i18n.js`), plus `proto/t_textmatch.js`, `latex/run_gen.sh` and the browser checks (`proto/browser/behave.js`).
- Open: the legend canvas widths in Russian are not measured; the export dialog, sound keys and tour are checked only after the merge; a region field reads `|z|<0,5` as two conditions (English does the same).
- Round 2 left some items between the two ledgers ("not mine" on both sides). Round 4 closed them (below).

## Review round 4: the verifier's 12 items (2026-10-22)

A verifier checked the ledgers against the files and found 12 items not done or done wrong. All 12 are closed now.

- Globe button (i18n-2): back in the header in both languages, as you decided. The browser check now names it as the one difference from the base at 1440 px. At 768–1023 px it folds away, so the bar is no wider.
- Placeholders (i18n-4): every Russian template with TeX writes `%{name}`. Labels such as `{2}` or `{hom.m}` got real names. Each renamed entry has `en_key`, the English template for phase 2; it prints exactly the old English. The builds fail on a bare `{name}` in TeX.
- Plurals (i18n-5): all 34 plural entries carry their English pair. The converter keys plurals on the pair and stops on a missing one. "The set" / "the sets" is now a split, not a plural.
- Inventory (i18n-17): three identifiers are gone. Literals that are also identifiers are marked "display through a map".
- Res (i18n-8): stays Res, as the glossary says. Text and formulas now agree.
- New messages (i18n-14): Russian for the parser and switch messages. The arcctg message no longer suggests arctg(1/z), which is wrong for negative x.
- Language switch (i18n-3): it reloads only when the latest save reads back exactly. Tested with a full store.
- Interval grid (mathematician-13): one separator per bracket pair, and its own names for the x and y ranges.
- Wording: «двойные неравенства» and «Максимум» in the sample table; three notes fixed (export.ink, chrome.draft, chrome.as_target).

**All 80 findings are handled: 45 applied, 34 already in place, 1 rejected by your decision (i18n-2).** Ledgers: `ledger-eng.json`, `ledger-tables.json`.

Not re-run this round: the Russian screenshots (`shots-ru/` predate the globe button) and the English golden images.

## Two English errors to fix

The review found these errors in the English source too:

- Guarantees tooltip: "exp followed by log returns z" is false. Write "log followed by exp returns z".
- Tour, Cauchy style: "inside, with its three zeros" is false (they are on γ). Write "its three zeros lie on γ itself", or move the scene to radius 1.2.
- Optional: "the brightness bands are level sets of |F|". Better: "bands bounded by level curves of |F|".

## Phase 2: building it into the app (after the merge)

1. Add `i18n.js` first in the build, then the page pieces: two `data-i18n` markers, the Russian font rule, the Language button.
2. Wire `init()`: the static walker, language switching with save and undo, `I18N.keyOf()` in the key handler (shortcuts work on ЙЦУКЕН), the palette commands.
3. Wrap every visible string with `$t()`, file by file. Captions become one template per sentence (Russian word order). This replaces the prototype's crutch (`work/xl/src/i18n_crutch.js`).
4. Apply `I18N.notation()` and the decimal comma where formulas and captions are typeset; set Cyrillic words in figures from CMU outlines.
5. Turn the three tables (`ru/*.json`, keyed by inventory id) into the shipped table. The prototype's converter is `work/xl/tools/make_ru_table.py`. The shipped table loads only in Russian (about 70 KB gzip).
6. Re-run the inventory after xr, xs and xt merge; translate the strings that changed.
7. Checks:
   - English: the quality suite (golden images), perf, the node tests, DOM identity with the base. English pays nothing by construction (Russian-only code and CSS). This round changed only Russian paths, but the English identity was not re-run this round.
   - Russian: the width and theme matrix with no new overflow and no English left, shortcuts on ЙЦУКЕН, a Russian figure with no `<text>` and no fonts in the PDF, an English caption from the Russian interface, the snippet in pdfLaTeX and XeLaTeX.

## Files

- `DESIGN.md`: the mechanism and the decisions in detail.
- `GLOSSARY.md`: every term and style rule.
- `INVENTORY.md`, `inventory.json`: every visible string.
- `ru/chrome.json`, `ru/math.json`, `ru/guide-tour.json`: the Russian tables. `math.json` is built by `ru/math_src/build.py`; review fixes are in `ru/math_src/fixes_r2.py`, `ru/fixes_r2_chrome_guide.py`, `ru/fixes_r3_chrome_guide.py` and `ru/fixes_r4.py` (round 4; it uses `ru/ph.py` for placeholders).
- `proto/`: the module, its tests, the CMU glyph tables, and the browser scripts. `proto/browser/shots_ru.js` made these shots.
- `shots-ru/`: the screenshots above. `shots-ru/earlier_sample/`: the earlier shots, page strings only.
