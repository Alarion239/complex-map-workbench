# Russian localization: design

User request (2026-10-22): "Can you add russian localization if system language is russian?"

Status: design and a working prototype. Companion notes written in parallel: `GLOSSARY.md` (terms and style: the authority for every Russian word; the sample table follows it), `INVENTORY.md` and `inventory.json` (every visible string), `USER-DECISIONS.md` (the user confirmed the notation decision).
 The prototype is in `notes/i18n/proto/` and is wired into `work/xl`.
Only a sample of strings is translated (page.html and about 40 core strings). Translating every string is the next step.

## 0. Summary of decisions

| # | Topic | Decision |
|---|---|---|
| 1 | Strings | gettext style: the English source string is the key. `$t(s, {name})`, `$tx(ctx, s)`, `$tn(one, many, n)`, `I18N.parts()` for sentences with structured slots. Templates with math use `%{name}`. Plurals are keyed on the pair (one, many). Async builders use `I18N.at(lang)`. |
| 2 | Static markup | page.html stays English. A walker translates it once at startup, only in Russian. A language switch saves and reloads. |
| 3 | Language | Russian when `navigator.languages[0]` is `ru` or `ru-*`. A device setting (Auto, English, Русский) overrides. Test namespaces (`?ns=`) stay English. |
| 4 | Fonts | Russian only: Cyrillic falls through to Roboto Flex (UI) and JetBrains Mono (mono). STIX Two Text already has Cyrillic. English loads nothing new. |
| 5 | Figures | MathJax for math only. Cyrillic words are set from Computer Modern Unicode outlines (CMU Serif), the same glyph space as MathJax. No `<text>`, no embedded fonts. |
| 6 | Notation | Russian textbook notation (tg, ctg, sh, ch, th, cth, arctg, arsh, arch, arth, cosec, ln) is applied at the display boundary by one function. The parser accepts both spellings in both languages. |
| 7 | Keys | `I18N.keyOf(e)`: `e.key` when it is ASCII, else the US character of `e.code`. |
| 8 | Expansion | 14 hotspots found with a +35 % pseudo-localization. Fixes listed in section 8. |
| 9 | Cost | English: identical rendered DOM, identical plane pixels, no font or table load (tested). The Russian table is a separate file (`i18n/ru.json`) fetched only in Russian; the prototype build does this now. |
| 10 | Tests | `proto/t_i18n.js` passes (1548 checks); `proto/t_textmatch.js`, `latex/gen_caption.js`, `latex/pdf_info_test.js` pass. The browser checks pass (English identity, every letter shortcut on ЙЦУКЕН, switch keeps work, view and undo, blocked storage). |
| 11 | Terms | `GLOSSARY.md` decides every term and style rule; this file decides the mechanism. |

## 1. The string mechanism

Module: `proto/i18n.js` (about 270 lines). It is loaded first, before `cx.js`.

- **Key = English source.** Translation can start before any code is touched. A missing key falls back to English.
- **Global names.** `$t`, `$tx`, `$tn` (Vue's name). Plain `t` is the homotopy time in hundreds of places.
- **Placeholders.** `%{name}` is always a placeholder. `{name}` is one only in a template with no TeX (no `$`, no backslash). TeX writes `^{n}`, `_{k}`, `e^{t}` as groups, and a parameter with the same name must never fill them. So every template that contains math writes `%{name}`. A name is an identifier: `{2}` or `{alpha.re}` are never filled. `I18N.names(s)` lists a template's placeholders (for the extractor check: the placeholders of each call site's literal must equal the keys it passes).
- **Placeholders in the tables (review i18n-4, round 4).** The inventory shows each `${expr}` of the source as `{label}`, so labels can be `{2}`, `{hom.m}`, or one `{x}` for two values. The tables therefore carry, per entry: Russian strings with `%{name}` in every template with TeX (ru, ru_short, plural forms, split values); one identifier per value; `en_key`, the English template the phase-2 call site writes (same names, `%{}` with TeX; it renders exactly the English text, and it is the table key); `ph`, what each renamed slot stands for in `en`. Example, export.shown_at_t_2: `$t=%{t}$ … %{map} ($t=%{tEnd}$); это %{hom}`. The pass is `ru/ph.py`, run by `ru/fixes_r4.py` (chrome, guide) and `ru/math_src/build.py` (math). Both builds and `ru/check_chrome.py` fail on a bare `{name}` in a TeX template and on an `en_key` that does not give `en` back. The tour's key chips (`{Z}`, `{Shift}{M}`) are filled by tour.js, not `I18N.fill`, and stay as they are.
- **English fast path.** In English, `$t(s)` returns `s`; with params it only fills them. Nothing else runs.
- **Plurals.** `$tn('{n} shape', '{n} shapes', n)`. The table key is `one + U+0004 + many` (gettext's msgid and msgid_plural), so two pairs with the same singular never collide. Every plural entry of the tables carries its English pair, `en_plural: [one, many]` (one pair per split variant), with the count as `{n}` (review i18n-5, round 4); where English does not vary today, one equals many, so English prints exactly what it prints now. `make_ru_table.py` emits plurals only under their pair key and fails on a plural without a pair. An uncounted choice ("the set" / "the sets") is a split, not a plural. English picks by `Intl.PluralRules('en')`. Russian entries are `{one, few, many, other}` chosen by `Intl.PluralRules('ru')` (1 фигура, 2 фигуры, 5 фигур, 21 фигура, 1.5 фигуры). Every Russian form carries `{n}` when the English plural does: Russian `one` also covers 21, 31 and 101 (the test checks it). A sentence meant for exactly 1 ('A zero and a pole cancel') is an `n === 1` branch in the code, not a plural form. A count that may be cut short ('or more') is two `$tn` keys, exact and at-least (the tables' `split.exact` / `split.atLeast`). Tested for 0, 1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 101, 111, 1.5.
- **Context.** `$tx('pred', 'conformal')` uses the key `pred\u0004conformal` (gettext's msgctxt). Example: "conformal" is "конформное" as an adjective and "конформно" as a predicate of "отображение".
- **Sentences with slots.** `I18N.parts(src, params)` splits the translated template into `[text, value, text, ...]`. Values keep their type (caption segments `{m}`, `{b}`, DOM nodes). Word order follows the language.
- **Caption language.** The figure stores its caption language (`fig.lang`). The figure build calls `I18N.at(fig.lang)`, which returns `t`, `tx`, `tn`, `parts`, `notation`, `num`, `texNum`, `texInterval`, `list`, `quote`, `nbsp` fixed to that language. They stay right across the awaits for MathJax and the CMU tables. `I18N.using('en', fn)` remains for synchronous code only. Tested: a Russian UI with an English caption gives no Cyrillic and no tg after awaits.
- **Robustness.** Tables are null-prototype objects (a key such as `constructor` is never inherited). `parts()` takes a plural entry's `other` form. Misses are recorded only under `?lang=` or `?i18n-debug`, at most 500.
- **Globals.** `i18n.js` sets `globalThis.I18N`, `$t`, `$tx`, `$tn`, so node tests that load `parse.js` or `funcs.js` after it work.
- **Lists and quotes.** `I18N.list()` ("a, b, and c" / "a, b и c"), `I18N.quote()` (“…” / «…»).

### Strings built from pieces today (restructure rules)

- Never glue words. Write the whole sentence with slots. Example: `Remove ${what} ${i} of f${k}` becomes two keys, `Remove zero {i} of {f}` and `Remove pole {i} of {f}` (Russian needs the accusative and the genitive: "Удалить нуль 2 функции f₁").
- Captions are arrays of segments built in English word order (`{t: ' is '}`, `joinList(props)`). Rebuild each sentence as one template through `I18N.parts()`: `{F} is {props}; these properties are guaranteed by the chain.` → `Отображение {F} {props}; эти свойства гарантирует цепочка.`
- Property names used as predicates get the `pred` context (конформно, однолистно, ограничено). Russian needs a noun ("Отображение") that English leaves implicit.
- Plurals inside sentences: `${n === 1 ? 'item' : 'items'}` becomes `$tn()` with the whole sentence as the key.
- Code that reads its own English text breaks in Russian. Found so far:
  - `figure.js:1199` removes "Dashed boundaries do not belong to the sets." with a regex. Use a flag on the segment.
  - `app.js` `openExportMenu` disabled items by `/Save/.test(it.label)`. Fixed in the prototype: a `save` flag.
  - `app.js` submenu back-navigation compared `textContent === sub.label`. Fixed in the prototype: the item object.
  - `app.js` latexDocument: `name(k).replace(/ onto image$/, ' onto its image')`. Make it its own template.
  - Point and shape labels decide word or math with `/[A-Za-z]{2}|\s/` (app.js 2284, 8980; xr 2285, 9010). A one-word Cyrillic label ('Круг') is then set as math. Use `/\p{L}{2}|\s/u`.
  - The palette scores the English `d.label` (app.js 8332, 8342; xr 8330). Score the shown label and the English one.
  - tour.js `helpWhere()` returns 'Help' and '⋯ › Help'. Build it from the same keys as the buttons.
  - `proto/t_textmatch.js` is the grep test. It lists these sites as known and fails on any new one.
- `funcs.js` homotopy captions (`the homotopy $H_t(z)=…$ (principal branch)`) become templates with math slots: `$t('the homotopy {H} ({branch})', {H: '$…$', branch: $t('principal branch')})`.

## 2. Static markup (page.html)

- **Walker, not data attributes.** `I18N.applyStatic(#app)` runs once at startup, only when the language is not English. It translates text nodes and `title`, `aria-label`, `placeholder`, `data-tip`, `alt`.
- `"Fit view  Z"` (two spaces, then a key) translates the label and keeps the key.
- Two markers only: `data-i18n="no"` (the wordmark: "Complex Map Workbench" stays the brand) and `data-i18n="html"` (a sentence with inline math: `Key in the <i>w</i>-plane` → `Цветовой ключ в плоскости <i>w</i>`). The prototype needed two such edits in page.html.
- `<html lang>`: set to `ru` or `en` at startup (the claude.ai frame wraps the page, so it is set from script). `lang="ru"` also gives correct Russian hyphenation where the browser has it.
- **Switching language = save and reload.** The app builds its UI once, with strings in closures all over app.js. A live re-render would touch every builder. Instead:
  - `I18N.setPref()` calls the app's hook: `writeState()` (synchronous save) and the undo history `{hist, hi}` into `sessionStorage` (namespaced, 30 s).
  - Then `location.reload()`. On load the app restores the state as it does today and takes the stashed undo history.
  - Tested in headless Chrome: the saved state is identical, both planes are pixel-identical, Undo and Redo keep their state, and Undo still undoes the last step after the switch.
  - Still to verify in the full build: a zoomed or panned left plane, the sphere and landscape cameras, open drawers and dialogs (they close).

## 3. Detection and the Language setting

- Order: `?lang=` (tests and the pseudo run only; the app never writes it into a link) → the device setting → English under a test namespace (`?ns=`) → `navigator.languages[0]` (else `navigator.language`) matching `/^ru(-|$)/i`.
- `uk`, `be`, `kk` and `ru` second in the list stay English. This is one switch (`detect()`), easy to widen later.
- Stored with the app's `lsk()` key (`cmw-lang`, `cmw-lang:<ns>` in a test tab) in `localStorage`, in try/catch. Absent means Auto. Never in saved work, never in shared links.
- UI: the header keeps the Language (globe) button in both languages (user decision 2026-10-22). It folds into the More menu where the bar is short, and it is also in the palette. On a phone it is a row in the More menu. At 768–1023 px the bar is already short (it runs 61 px past the edge at 900 px in English), and this base has no More menu at those widths, so the globe folds away there and the bar gets no wider (browser check); when that bar gets a More menu, the globe is a row in it. At 1440 px the English rendered DOM equals the base except `#langBtn` (an asserted, named exception in `behave.js`). The row opens a menu: `Авто (Русский)` or `Auto (English)`, `English`, `Русский`, as `menuitemradio` items with `aria-checked`. Language names are autonyms in both interfaces. A choice that changes the language reloads; it is a menu, not a cycle button, so one click never reloads twice.
- The switch reloads only when the setting and the work were both written and read back (review i18n-3). With blocked storage nothing reloads, and a note says why. While a tour holds the canvas (xt `tourHold`), the saved state is the user's work and the tour's scenes are never stashed as undo history.
- English never touches `<html lang>`; Russian sets `lang="ru"`.
- Command palette: `Language: Auto`, `Language: English`, `Language: Русский`, shown only when the query matches (language, язык, russian, русский, english). The empty palette stays as it is.
- Golden images: the quality suite reads `#canvasR` only, and the canvas size does not change. Test tabs use `?ns=`, so they stay English even on a Russian machine (tested with `ru-RU` emulated: `ui en`).
- What English gains: the globe button in the docked header at 1024 px and up, the Language row in the phone More menu, and the palette commands when the query matches.

## 4. Fonts

Checked with the Google Fonts CSS API (subsets per family):

| Family | Cyrillic | Use |
|---|---|---|
| Archivo (wdth 75–125) | no | UI |
| B612 Mono | no | readouts |
| STIX Two Text | yes (cyrillic, cyrillic-ext) | math italic: works as is |

Candidates were measured in headless Chrome (x-height, cap height, width of a lowercase run at 100 px) and compared at the UI sizes (specimen: `shots-ru/fonts_zoom.png`):

| Face | x-height | width of "nonoeaes"/"попоеаес" | wdth axis | Cyrillic file |
|---|---|---|---|---|
| Archivo (reference) | 0.526 | 441 | 75–125 | – |
| **Roboto Flex** | 0.449 at 100 px (opsz 100); matches at 11–13 px (opsz auto) | 348 at 100 px | 25–151 | 101 KB |
| IBM Plex Sans | 0.516 | 440 | 85–100 | 40 KB |
| Ubuntu Sans | 0.518 | 440 | 75–100 | – |
| Noto Sans | 0.536 | 455 | 62.5–100 | – |
| Golos Text | 0.530 | 467 | none | – |

- **UI: Roboto Flex.** Its optical-size axis tunes it per pixel size, so at 11–13 px its x-height and colour sit with Archivo. Its width axis covers both widths the app uses (semi-condensed captions, semi-expanded wordmark), and its weight axis covers 640. IBM Plex Sans is the runner-up (40 KB, no expanded width).
- **Mono: JetBrains Mono.** x-height 0.55 against B612 Mono's 0.56 (Plex Mono 0.516, PT Mono 0.50). It is only a safety net: the app's rule "words in Archivo, the value in B612 Mono" keeps words out of mono. Russian units in readouts ("2 / дел.") follow that rule too.
- **How it loads (Russian only).** `I18N.applyPage()` sets `data-lang="ru"` and inserts one Google Fonts stylesheet link. A page.html rule `:root[data-lang="ru"]` puts Roboto Flex first in `--f-ui` (review i18n-13: a mixed label such as «Сохранить PDF» or «Формула 1» is then one face, not Archivo Latin beside Roboto Cyrillic) and JetBrains Mono after B612 Mono in `--f-mono` (values stay B612 Mono). English never matches the rule. Shots: `shots-ru/ru_1440_light_fonts.png`, `ru_1440_dark_fonts.png`.
- English never matches the rule, never inserts the link, never fetches a font (tested: no `#i18n-fonts`).
- claude.ai frame: stylesheets from Google Fonts are allowed (the page already loads one). GitHub Pages: the same link.
- Canvas text does not trigger a font load, and the `@font-face` rules exist only after the stylesheet loads (review i18n-12). So `applyPage()` waits for the link's `load`, then `document.fonts.load()` for the faces, then calls the app's `I18N.onFonts()` hook (also on `loadingdone`). The app clears `rulerCache`, redraws the legend and requests a render.
- Open: the legend canvas is a fixed 272×144 (about 136 CSS px). The Russian legend strings were not measured yet. Widen it under `:root[data-lang="ru"]` if they need it.

## 5. Math and figures

MathJax's SVG TeX fonts have no Cyrillic. Tested: `MathJax.tex2svg('\text{Образ полосы}')` gives 11 `<text>` elements in the system serif. That breaks the export rule (outlines only, no fonts in the PDF) and does not look like TeX.

**Decision: Cyrillic words are set from Computer Modern Unicode outlines.**

- `proto/cyr/make_cyr_glyphs.py` (fontTools) reads CMU Serif Roman and Bold (`cmunrm.otf`, `cmunbx.otf`, TeX Live, SIL OFL). It writes paths in 1000 units per em, y up: MathJax's own glyph space. Each glyph has its advance; kerning pairs come from GPOS.
- The metrics match MathJax: `a` and `0` are 500 in CMU Roman (cmr10: 500, 500), `a` 559 and `0` 575 in CMU Bold (cmbx10: 559, 575). The interword space is 333 (cmr10).
- These are the LH Cyrillic letters designed for Computer Modern: what pdfLaTeX prints with T2A and cm-super.
- Size: 168 glyphs in Roman and Bold (А–я, Ё ё, « » „ “ № — – …, and all of printable ASCII, so a mixed word such as 'Круг-A' or 'PDF-файл' is set from one face: review i18n-11). Roman 70 KB (27 KB gzip), Bold 64 KB (25 KB gzip). Italic (`cmunti.otf`, Cyrillic only, for the panel letters *а*, *б*): 49 KB (19 KB gzip). Fetched only for a Russian caption.
- **Weight (review lead-1).** MathJax's TeX glyphs are the CM outlines grown by about 6.5 units per side (the cmr10 'I' stem is 89 units, MathJax's 104; ink +22 to 31 %, measured on I 0 m 1 t g). The CMU outlines are exactly cmr10. So the words looked lighter than the math, and upright operator names (Im, tg) looked bold beside them. The tables carry `stroke: 13`; the composer strokes each glyph with 13 units. Measured in Chrome: ink of 'Im', 'tg', 'I0m1tg' from the table is 0.990, 1.001, 0.996 of MathJax's (before: 0.77 to 0.80). Words and math now have one weight, as in pdfLaTeX. Compare `shots-ru/cyr_caption_vs_pdflatex.png`.
- **Typography.** `I18N.nbsp()` puts U+00A0 after one-letter words (в к с о у и а), before an em dash, and in «Рис. 1». The composer breaks lines only at ordinary spaces. In LaTeX, `I18N.nbspTeX()` writes `~`.
- Demo: `proto/cyr/cyrfig.html` sets a full Russian caption with math by MathJax and words from the tables. The caption comes from `latex/gen_caption.js`, which makes it with the module (notation, decimal comma, interval separator, no-break spaces); the same caption is compiled by pdfLaTeX and XeLaTeX. Result: 0 `<text>` elements (`shots-ru/cyr_caption.png`; against pdfLaTeX: `shots-ru/cyr_caption_vs_pdflatex.png`).
- Integration: in `figure.js` `XD.tex()` and in app.js `mj()`, a `\text{word}` or `\textbf{word}` whose word contains Cyrillic goes to `cyrWord(word, face, pt)`. It returns the same shape (`glyphs`, `w`, `a`, `d`). The glyph keys join the figure's glyph table like MathJax's. A word with a character outside the table falls back to MathJax (and the export preflight flags the `<text>`).

### Where language-dependent text enters MathJax, figures and exports

| Place | Today | Russian |
|---|---|---|
| Figure captions (`figure.js` `captionFor`, `XD.caption`; app.js `layoutCaption`) | English sentences, words as `\text{}` | Templates via `I18N.parts`; words via CMU outlines |
| "Figure 1." in the caption image and paper preview (`figure.js` 1322, 1334) | bold | "Рис. 1." |
| Panel letters `(a)`, `(b)` (`figure.js` `head`, app.js 9294) and the filmstrip titles `(a) t = …` (`figure.js` 1101) | Latin | а, б, в, г in italic («а — круг; б — образ при отображении F», `GLOSSARY.md` 11, 1.11); follows the caption language |
| Two-panel captions "(a) … (b) …" (`figure.js` 1316–1326) | English | One template per sentence: `math.json` `missing_from_inventory` `export.extra.fig_*` (article, homework, left only, right only, no shapes). `segsOf()` must learn `\textit{…}` (italic letter) and map `~` to U+00A0 |
| "Dashed: boundary not included." (`figure.js` 1265) and "Dashed boundaries do not belong to the sets." (app.js, figure.js 1199) | English; one is removed by regex | "Штриховые границы не принадлежат множествам."; removal by flag |
| Notes `f_k: cut θ°, sheet k` (app.js 8745) | `\text{: cut }` | "разрез", "лист" via CMU |
| Shape labels in figures (app.js 8973, `figure.js` 684) | `\text{label}` when it has words | Default names ("Формула 1") are Cyrillic: CMU |
| Homotopy captions (`funcs.js` `homTex`) | English with `$…$` | Templates with math slots |
| LaTeX document export (app.js 9499–9501) | `\text{(step k bypassed)}` | `\text{(шаг k отключён)}` («пропущен» is kept for a step skipped by an error); compiled by the user's LaTeX |
| LaTeX snippet (`figure.js` `latex()`) | `\caption{…}`, comment with the preamble | Russian caption and the Russian preamble comment |
| PDF metadata (`figure.js` 418), Docs alt text | English | Caption language. Info strings through `I18N.pdfText()` (UTF-16BE with a BOM); `latex/pdf_info_test.js` checks a Russian Subject with pdfinfo. To wire into jsPDF in phase 2. |
| On-screen `\text{not }` for a complement (app.js 7409) | MathJax word | Put "не" in HTML before the formula; never Cyrillic inside on-screen TeX |
| Legend canvas ("Arg z", "|F′|") | canvas text, UI font | needs the `document.fonts.load()` above |

### Russian LaTeX snippets (tested with pdflatex, xelatex and lualatex: `latex/`)

- Preamble, as a comment in the snippet:
  - pdfLaTeX: `\usepackage[T2A]{fontenc}`, `\usepackage[utf8]{inputenc}`, `\usepackage[russian]{babel}`, `\usepackage{amsmath}`.
  - XeLaTeX or LuaLaTeX: `\usepackage{fontspec}`, `\setmainfont{cmunrm.otf}[BoldFont=cmunbx.otf,ItalicFont=cmunti.otf]`, `\usepackage[russian]{babel}`, `\usepackage{amsmath}`. Re-tested 2026-10-22: XeLaTeX does not find `CMU Serif` by name in TeX Live (7 errors); the file names work in both engines.
  - Beamer: `\usepackage[T2A]{fontenc}`, `\usepackage[russian]{babel}`, `\usepackage{graphicx}` (tested).
  - The snippet's preamble comment carries these lines only when the caption language is Russian (`export.if_your_l_narrower`, `export.n_pdf_made_for_2`).
- babel-russian defines `\tg \ctg \sh \ch \th \cth \arctg \arcctg \cosec` when babel loads `russian` (main or secondary language), and then in every language of the document; without babel-russian they are undefined (re-tested 2026-10-22; `GLOSSARY.md` 2.5 says the same). It does **not** define `\arsh \arch \arth`. It also takes `\th`. `\Re` and `\Im` stay plain TeX's fraktur ℜ ℑ (`latex/macros.tex`, logs).
- **So the snippet writes `\operatorname{tg}` etc.** It needs only amsmath and prints the same as babel's macros (`latex/pdflatex_p-1.png`, the notation rows).
- Decimal separator: Russian print uses a comma. In math it must be `0{,}5`; a bare `0,5` gets a space ("0, 5", visible in the test). Numbers are formatted where they are made, never by a regex over finished TeX (review i18n-7: a snippet holds dimensions such as `\ifdim\linewidth<469.75pt`). `I18N.texNum(x)` gives `0{,}5` in Russian; `CX.texNum` and `fmtNum` take the caption language in phase 2. Dimensions are made by the English formatter. Inside a bracket pair, `I18N.texInterval(a, b)` and `I18N.texSep(values)` give a semicolon only when an endpoint is a decimal: `[0{,}5;\,1]`, `(1{,}25;\,0{,}5)`, but `[-1,1]` and `(-\pi/2,3\pi/2)` keep the comma, as in Russian books (`GLOSSARY.md` 2.3). `texDecimal()` is gone. Test: `latex/gen_caption.js` generates a Russian snippet with the module and checks it; `run_gen` compiles it with pdfLaTeX and XeLaTeX (0 errors).
- Input fields keep the decimal point (a comma separates conditions there). Readouts, captions and tick labels show the comma (`GLOSSARY.md` decision 5; two switches in i18n.js: `DECIMAL_COMMA` for the screen, `DECIMAL_COMMA_PRINT` for captions and LaTeX). A readout's copy gives the point, so it pastes back into a field. Review i18n-14: in Russian the parser says "Use a decimal point: 0.5, not 0,5" for `z^0,5`; numbers in one readout are joined by '; ' (`I18N.nums()`). Still open, for the user: a region field reads `|z|<0,5` as two conditions without an error (English does the same today).
- babel-russian prints "Рис. 1:" in `article`; the journal's class sets the separator. The app does not change it.

## 6. Russian notation in the app

Decision, from Russian textbooks (Шабат; Лаврентьев и Шабат; Свешников и Тихонов; Евграфов; Привалов):

- `Re z`, `Im z` upright, as in English (`\operatorname{Re}`), never ℜ ℑ.
- `arg z` is the principal value; `Arg z` is the multivalued argument.
- `ln z` for the logarithm, including a branch with its cut and sheet stated in words ("ветвь с разрезом по лучу arg z = θ, лист k"), as English uses `log` for every branch. `Ln z` is the multivalued logarithm. The app does show it ("All sheets": Im log z climbs a helicoid, tour.js 176). Such call sites pass `{multi: true}`: `I18N.notation(tex, lang, {multi: true})` writes `\operatorname{Ln}` and `\operatorname{Arg}` in Russian (English unchanged). `log` with a base stays (`\log_2`). `log` without a base is not used in Russian (`lg` is base 10).
- The residue: `\operatorname{Res}` stays `Res` in Russian (GLOSSARY 1.4, decided in review i18n-8: Res is usual in Russian courses; Шабат and Лаврентьев–Шабат write res, Свешников–Тихонов выч). Not in `RU_OP` or `RU_PLAIN`; the text and the formulas say the same.
- `tg`, `ctg`, `sh`, `ch`, `th`, `cth`, `arctg`, `arcctg`, `arsh`, `arch`, `arth`, `cosec`; `sin`, `cos`, `sec`, `arcsin`, `arccos`, `exp` unchanged.
- Terms: `GLOSSARY.md` section 1 (for example дробно-линейное отображение for Möbius, функция Жуковского, сфера Римана, однолистное for an injective analytic map, «исходная плоскость» and never «плоскость аргумента», since «аргумент» is arg z). It also adds `arcth`.

Where names come from and how they change:

- Generators stay English: `parse.js` `FNTEX` (`\tan`, `\sinh`, `\operatorname{arsinh}`), `funcs.js` `menuTex` and `tex()`, captions.
- One function rewrites TeX at the display and export boundary: `I18N.notation(tex)`. It is called in `TeX.set()` (on screen), in `mj()` and `XD.tex()` (figures), and in the LaTeX exports. Whole commands only: `\tanh` becomes `th`, never `tg`+`h`.
- Plain names (readouts, the palette, aria labels): `I18N.fnName('sinh')` → `sh`.
- The palette searches the English label, the Russian label and aliases in both, so "tg", "тангенс" and "tan" all find the tangent.

Parser (`work/xl/src/parse.js`, prototype patch, additive):

- Plain: `tg ctg cth sh ch th arctg arsh arch arth cosec`. LaTeX: `\tg \ctg \cosec \sh \ch \th \cth \arctg \arsh \arch \arth` and `\operatorname{tg}` etc.
- Both spellings in both languages. The generator still prints `\tan` (English source), so saved work and shared links do not depend on the language.
- Conflicts checked: names match longest first, so `theta`, `cosh`, `arccosh`, `arcsinh` stay whole. No valid formula of today contains these names as a token start (the only single letters are z, w, x, y, r, i, e). `\th` (thorn in text LaTeX) is now tanh in formulas, as in babel-russian. `sech` is still unknown.
- Tested: 25 pairs evaluate equal (`tg z` = `tan z`, `\operatorname{arsh} z` = `\operatorname{arsinh} z`, `\operatorname{sh}^2 z-\operatorname{ch}^2 z` = `-1`, …). `t_parse`, `t_funcs`, `t_calc` still pass.
- `Ln` is accepted and means the principal branch, as `Log` does. In Russian, `lg`, `arcctg`, `arccot` and `acot` get a specific message ("lg (the base-10 logarithm) is not available: write ln(z)/ln(10)", "… write arctg(1/z)"); English messages are unchanged. Adding arccot as a function would touch the evaluator, the derivative, the inverse and GLSL: not in phase 1.
- Optional (one switch each): accept `и`, `или`, `не` for and, or, not; and say "Кириллическая буква «х»: переключите раскладку" when a Cyrillic letter is typed in a formula.

## 7. Keyboard

Shortcuts today (app.js main handler, 11805 ff.), all matched by `e.key`, except the digits:

| Keys | Action | Matched by |
|---|---|---|
| ⌘/Ctrl Z, ⇧⌘Z, ⌘/Ctrl Y | undo, redo | `e.key` lowercased |
| ⌘/Ctrl K, `/` | palette | `e.key` |
| `?` | guide | `e.key` |
| `+`, `=` | add a function | `e.key` |
| `[`, `]` | side panels | `e.key` |
| 1 2 3, ⇧1–⇧4 | views, surfaces | `e.code` (already layout-proof) |
| M | deformation | `e.key` |
| P | paths (in X → Y with the deformation) or the Point tool | `e.key` |
| Z | fit both planes | `e.key` |
| V P S L R C A F D B G O H N K T | tools (`TOOLS`); T focuses the formula field | `e.key` |
| ⌘E (xr) | figure export | `e.key`: keep `keyOf` in the merge |
| ⇧M (xs) | sound on/off | `e.key`: keep `keyOf` in the merge |
| Z O D L (xs `sndKey`, app.js 12020) | the sound keyboard | `e.key.toLowerCase()`: route through `I18N.keyOf(e)` (on ЙЦУКЕН these keys give я щ в д) |
| Delete, Backspace, Escape, Enter, Space, Alt, arrows, Home, End, Tab | named keys | `e.key` / `e.code` (fine on any layout) |
| ← → Esc Tab (tour.js) | tour | named keys |

With ЙЦУКЕН, `e.key` is `я` for Z, `х` for `[`, `ъ` for `]`, `м` for V: every letter shortcut and the panel keys fail. `/`, `?`, `+`, `=` still work (the layout types them on other keys).

Fix: `I18N.keyOf(e)`.

- If `e.key` is one ASCII character, use it. QWERTY, AZERTY, QWERTZ keep their own letters (AZERTY's A stays A).
- Else, if `e.code` is `KeyA`…`KeyZ`, use that letter (upper case with Shift). If it is a punctuation code (`BracketLeft` → `[`, …), use the US character.
- Named keys pass through.
- The prototype changes three lines of the handler. Tested in headless Chrome with real key events: С (KeyC) picks Circle, М (KeyV) picks Select, Х (BracketLeft) toggles the region tools twice, ⌘Л opens the palette.
- Tested in the browser (review i18n-6): every tool letter V P S L R C A F D B G O H N K T, Ь (M), Ъ (]), Х ([), ⌘Я and ⇧⌘Я (undo, redo), ⌘Л (palette), each with its Cyrillic `e.key` and `e.code`. Node tests cover keyOf for every letter with Shift and ⌘, and ⌘E, Z O D L. The xr/xs keys are tested after the merge.
- The palette key `/`: on ЙЦУКЕН-PC that key types '.', which is no shortcut, so `I18N.isPaletteSlash(e)` takes it too (tested). QWERTZ's '-' on the same key keeps its meaning.
- Tooltips and the guide keep Latin key names ("Вписать в окно  Z"): Russian keyboards print them, and Russian apps show them so.

## 8. Text expansion (pseudo-localization)

Run: `?lang=pseudo` lengthens every string with Cyrillic (`Select` → `Sеlесt·Жщ`). Review i18n-15: the growth now depends on length, as Russian lengthens short labels most: +100 % up to 5 letters, +60 % up to 20, +35 % beyond. Canvas text (`fillText`, `strokeText`, `measureText`) is lengthened too. The 14 hotspots below came from the old uniform +35 % run, so they are a lower bound. The gate is the full Russian table over the width × theme matrix with no new overflow, not the pseudo run. In the prototype it reaches page.html (walker), every `h()` string (a temporary crutch in `h()`), and everything else through a MutationObserver (pseudo only). Shots: `shots-pseudo/pseudo_<width>_<theme>_<a base | b more or examples | c palette | d guide | e export>.png`, 360, 390, 768, 1024, 1440 px, light and dark (50 shots). Real Russian samples: `shots-ru/` (the sample table: page.html strings only, so app.js labels are still English there).

Hotspots and fixes (each fix applies under `:root[data-lang="ru"]` or in the Russian strings, so English does not move):

1. **Draw tool grid, 4 columns (≥ 1024 px).** Labels collide (Прямоугольник, Многоугольник, Полуплоскость). Fix: Russian tool names carry soft hyphens at morpheme breaks (`Прямо­угольник`, `Много­угольник`, `Полу­плоскость`, `Окруж­ность`), and the labels may wrap to two lines (`white-space: normal; hyphens: manual; line-height: 12px`). No dependence on the browser's hyphenation dictionary.
2. **Phone tool dock (360, 390 px).** Same collision, worse. Same fix; the dock row grows by one line in Russian only.
3. **Header command field** ("Add function or command", 768–1440 px) truncates. Fix: shorter Russian "Функция или команда".
4. **More menu (phone)**: "Панель инструментов областей" wraps to two lines. Fix: "Инструменты областей", "Панель гарантий" → "Гарантии".
5. **Function chain head (768, 1024 px)**: heading, composite formula and the three controls compete; the formula is cut. Fix: heading "Цепочка"; the composite keeps priority (`flex-shrink: 0`), the "Очистить цепочку" button becomes the icon it is in compact widths.
6. **Chain cards**: "Exponential" ellipsizes; Russian "Экспонента" is the same length. Long Russian names get a `card` context with a short name, never an abbreviation: the Möbius card says "Дробно-линейная" (no short «Мёбиус»: `GLOSSARY.md` 1.2), the tooltip and the palette say "Дробно-линейное отображение".
7. **Guarantees lamps** ("Homeomorphism onto image" ellipsizes at 1440): Russian "Гомеоморфизм на образ" is shorter. Keep the tooltip with the full statement.
8. **Step-by-step table**: names ellipsize ("Expone…"). Same as 6.
9. **Lamp letters** (A E R P M Pr I on cards and in the table): need Russian initials. Proposal for review: А (аналитическое), Ц (целое), Р (рациональное), М (многочлен), Д (дробно-линейное), С (собственное), О (однолистное). One string per letter with the `lamp` context.
10. **Pattern tiles** ("Checker…", "Log-polar…" already clip in English): Russian "Шахматы", "Лог-поляр." do not fit either. Fix for both languages: two-line tile captions at 11 px semi-condensed (the width axis exists in Roboto Flex).
11. **Palette rows at phone widths** ellipsize ("Деформация: показать пути t ↦ H_t(z)"). Fix: two lines allowed (`-webkit-line-clamp: 2`) in Russian.
12. **Export menu at 360 px**: "Save LaTeX with guarantees (.txt)" ellipsizes. Fix: "Сохранить LaTeX (.txt)", the rest in the tooltip.
13. **Examples menu blurbs** already ellipsize in English (one line by design). No change.
14. **Readout chip** "2 / div": Russian "2 / дел." keeps the word in the UI font, the number in mono.

With the real Russian sample (all page.html strings), the overflow detector, diffed against English over the same matrix, finds one new overflow: the command field (hotspot 3), at 360, 390 and 1440 px.

The guide, the dialogs and the export dialog wrap and scroll; they take 35 % more without breaking. The figure export dialog (work/xr) was not in this build: check it after the merge.

## 9. Performance

- **English pays nothing at run time.** No walker, no lookup table, no font link, no extra CSS match, no extra layout. Tested: the English DOM text is identical to the base build and both planes are pixel-identical (`?ns=` tab, Russian browser locale emulated).
- `i18n.js` adds 16 KB of source (6.5 KB gzip) to the page. `$t()` in English is one comparison and a return.
- **The Russian table**: `INVENTORY.md` counts 1,498 visible strings in the base, plus the new ones in xr, xs and xt (my rough census: about 11,000 English words). Measured on the sample: 4 bytes of JSON per English character. Estimate: about 250 KB JSON, about 70 KB gzip. That is 12 % of today's gzipped page (589 KB).
- **So the table is a separate file**, `i18n/ru.json`, fetched only in Russian (GitHub Pages: a file next to the page; claude.ai: a supporting file of the artifact). In Russian, `init()` waits for `I18N.ready`; English calls `init()` as today. The CMU glyph tables (13 + 12 KB gzip) load the same way, on the first Russian caption.
- The prototype build now writes `dist/i18n/ru.json` and never inlines it (review i18n-18). `I18N.ready` fetches it only in Russian; `init()` waits for it only in Russian; English fetches nothing (tested). `--inline-i18n` puts it in the page as inert JSON for a single-file build; never use it for a build published for English. Still to test: the supporting-file fetch on claude.ai and on GitHub Pages.
- Russian: one `JSON.parse` (about 2 ms for 250 KB), one Roboto Flex Cyrillic file (101 KB, cached), lookups are object property reads. 60 fps is unaffected: no string is looked up per frame (labels are built when they change).

## 10. Tests

Node (`proto/t_i18n.js`, passing, 1548 checks):

- Detection: `ru`, `ru-RU`, `RU-ru` → Russian; `en-US, ru`, `uk-UA`, `rue` → English; setting beats the browser; `?ns=` → English unless the test asks.
- English identity for every key; TeX groups are not placeholders.
- Every Russian entry: placeholders and TeX groups, tags, TeX commands and `$…$` identical to the source; all four plural forms; no stray spaces; no English words left (allowed: key names, LaTeX, PDF, PNG, SVG, autonyms, the brand, math names, formula keywords in `<i>`); no mixed-script words.
- Every page.html string has a translation (it caught the missing "Language:").
- Plurals for 0, 1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 101, 111, 1.5.
- `parts()` word order, `using()`, `at()` across awaits, notation (whole commands only; `\log_2` stays; `arcoth` → `arcth`; `Res` stays; `{multi}` → Ln, Arg), `texNum`/`texInterval` (semicolon only with a decimal endpoint), no-break spaces, lists, quotes, `%{name}` against TeX groups, plural pairs, null-prototype tables, the switch with blocked or dropping storage.
- Pseudo: growth by length, placeholders, tags and TeX kept.
- `keyOf()` for every ЙЦУКЕН letter with Shift and ⌘, AZERTY, Greek, Russian `?` and `.`; the palette key on ЙЦУКЕН-PC.
- Parser: 25 Russian/English pairs, `Ln`, the Russian-only messages (lg, arcctg, decimal comma), English messages unchanged, `sech` still unknown.
- Also: `proto/t_textmatch.js` (no new code reading its own English text), `latex/gen_caption.js` (the generated Russian snippet), `latex/pdf_info_test.js` (a Russian PDF Subject).

To add with the full table:

- Every `$t`/`$tx`/`$tn` call site's literal has a key (an extractor over the sources, run in node).
- No unused keys.
- A grep test: no regex or comparison on English UI text (section 1).

Browser (`proto/browser/`, run through `work/xl/test/i18n_cdp`; to move into `test/` with the integration):

- Passing now (`behave.js`, fresh namespaces each run): the English rendered DOM at 1440 px equals the base except `#langBtn`, both planes identical, the full DOM differs only by the Language button's strings, and at 768, 900 and 1000 px the globe folds and the bar is no wider than the base; a full quota that keeps an older save makes no reload; no Cyrillic font, no table fetch, no `lang` change in English; Russian walker; every letter shortcut on ЙЦУКЕН; the '/' key of ЙЦУКЕН-PC; the switch keeps state, view pixels and undo; blocked storage: no reload, a note; the language menu items are `menuitemradio`.
- To add: Russian at 360, 390, 768, 1024, 1440, light and dark, with an overflow detector diffed against English (the detector is `proto/browser/ovf.js`; English already has deliberate ellipses, so the gate is "no new overflow"), and "no English left" over the live DOM (text nodes and the four attributes, minus math and key names).
- The quality and perf suites run unchanged (English, `?ns=`).

## 11. Integration plan (after work/xr merges export, sound and tour)

Order of work:

1. Add `src/i18n.js` first in `build.py` (before `cx.js`). Node tests that load `parse.js` or `funcs.js` load `i18n.js` first (in English `$t` is the identity, so their outputs do not change).
2. Add the page.html pieces: `data-i18n` on the wordmark and the inline-math label, the `:root[data-lang="ru"]` font rule, the Language button.
3. Wire app.js: `init()` calls `I18N.applyPage()` and `I18N.applyStatic()`; `I18N.onSwitch()` saves and stashes undo; the load path takes the stash; the key handler uses `I18N.keyOf()`; the palette commands. (All in the prototype: `work/xl/src/app.js`, search `I18N`.)
4. Wrap strings, file by file, with `$t`: page-independent modules first (`parse.js` errors, `funcs.js` labels, groups, parameter labels, homotopy captions), then app.js by area (tools, panels, palette, menus, toasts, guide, captions), then `tour.js`, `figure.js`, `sound.js`. Remove the `h()` crutch when done.
   - Guide: one key per paragraph (HTML with inline math and `{key}` placeholders), not per fragment.
   - Tour: it already uses `{P}` key placeholders and `$…$` math in its bodies; wrap each `body`, `touch`, `try.text`.
   - figure.js: captions through `I18N.parts()`; "Figure 1." / "Рис. 1."; panel letters; the dialog's own labels; the caption-language switch (Interface language, English, Русский) next to the caption, default the interface language.
   - sound.js: control labels and aria text only.
5. Add `I18N.notation()` at `TeX.set()`, `mj()`, `XD.tex()` and the LaTeX exports; format caption numbers with `I18N.at(fig.lang).texNum()` and `texInterval()` where they are made (never a regex over finished TeX); add `cyrWord()` to `XD.tex()` and `mj()`.
6. Translate (`ru.json`): one pass by area, then a terminology review against section 6 by a Russian-speaking mathematician.
7. Split the table out of the page (section 9).

What to check after the merge:

- English: the quality suite, the perf suite, the node tests, and the English DOM-identity check (base vs new, every view and dialog).
- Russian: the matrix of widths and themes with no new overflow and no English left; keys on ЙЦУКЕН; a figure export in Russian has 0 `<text>` and passes the PDF preflight (no fonts); an English caption from the Russian interface; the LaTeX snippet compiles with pdfLaTeX and XeLaTeX.
- The two English-text matchers (section 1) are gone.

## Files

- `proto/i18n.js`: the module (detection, `$t`/`$tx`/`$tn`/`parts`/`using`, notation, decimal comma, `keyOf`, walker, pseudo-localization, fonts, switching).
- `proto/ru.json`: the sample table (126 entries: all of page.html, tools, plurals, captions, contexts).
- `proto/t_i18n.js`: node tests (`node notes/i18n/proto/t_i18n.js`).
- `proto/cyr/`: `make_cyr_glyphs.py`, `cyr_rm.json`, `cyr_bx.json`, `cyrfig.html` (the caption demo).
- `latex/`: the babel-russian macro probe and the snippet compiled with pdfLaTeX, XeLaTeX and LuaLaTeX (`*.tex`, `*.log`, `*.pdf`, PNG renders).
- `proto/browser/`: the browser command files (English identity, keys, switch; the screenshot matrix and overflow detector; the font specimen; the string census).
- `shots-pseudo/`: 51 pseudo-localization screenshots. `shots-ru/`: Russian samples, the font specimen, the caption demo.
- `work/xl`: the prototype app (`src/i18n.js` and `src/ru.json` are links to `proto/`; `src/parse.js`, `src/page.html`, `src/app.js`, `build.py` patched; `dist/base.html` is the base build for the English identity check).

## 12. Review round 2: engineering decisions (2026-10-22)

The ledger is `ledger-eng.json`. What changed in the plan, beyond the sections above:

- **Inventory (i18n-1, i18n-17).** The hand-read inventory misses strings, mostly caption segments. In phase 2 the extractor takes every literal inside caption-segment arrays and template literals, and its sinks include `dataset.tip`, `aria-description`, `data-desc`, `toast`, `call('toast')`, `say`, `sndSay` and canvas `fillText`. The gate is a browser check, 'no English left' in Russian over every view, menu, dialog, toast and tooltip. The walker now also translates `aria-description` and `data-desc` (the browser run found them English). The inventory file itself belongs to the table owner (see the ledger).
- **Converter (i18n-16).** `work/xl/tools/make_ru_table.py` groups entries by English text. It lists every English text with more than one Russian text in `tools/ru_collisions.json` (14 today), with ids and kinds; each needs a `$tx` context at its call site. `ru_short` becomes the `short` context. `--strict` fails on any collision; use it once the contexts exist.
- **LaTeX (i18n-21).** The beamer frame title and the snippet comments are table strings in the caption language. The slides preamble comment gets the Russian lines too (`\usepackage[T2A]{fontenc}\usepackage[russian]{babel}\usepackage{graphicx}`), only when the caption language is Russian. The snippet comment mentions `\foreignlanguage{russian}{...}` for an English document.
- **Caption-language switch (i18n-22).** It shows only when the interface is not English (one switch), so the English export dialog is unchanged.
- **texSpeech (i18n-22).** The spoken formula text gets its own Russian grammar built on `I18N.fnName()` and case forms, not word-by-word `$t`. Phase 2, with the sound work.
- **Inventory (i18n-17, round 4).** `inventory.json` drops three identifiers (`export` app.js:1306, `circle` region.js:1552, `amsart` figure.js:463). Each doNotTranslate reason is copied onto its entry as a hazard ("do-not-translate list: …", 137 entries). Most of those reasons are "test/ uses this literal": the string is still shown and translated, and tests pin English with `?ns=`. Entries whose literal is also an identifier (the parameter labels sheet, branch, zeros, poles, and 13 more) carry "display through a map; the key stays English": `make_ru_table.py` puts them under the `label` context only, never under a bare key, so `$t()` on the identifier never changes it.
