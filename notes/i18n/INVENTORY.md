# String inventory (2026-10-22)

Data: `inventory.json`. Scripts: `inventory_tools/` (run order: extract, classify, refine, build, page, merge).

## What it covers

- Base: `notes/gate-morph-zp-r1/src`, every file, page.html included.
- Provisional: new strings in `work/xs` (sound), `work/xt` (tour wiring) and `work/xr` (figure dialog), as of today. Strings that already exist in the base are not repeated.
- Each entry has: id, area, file:line, kind, text with `{placeholders}`, context, hazards. Context lists each placeholder with its source expression.

## Method

- An acorn AST walk of every JS file: 11,434 string and template literals.
- Rules dropped code: CSS, GLSL, SVG paths, selectors, cache keys, ids, tag names, URLs.
- HTML inside strings was split into text runs and visible attributes (title, aria-label, data-tip, placeholder, alt).
- page.html: `<title>`, text nodes, visible attributes, CSS `content:` text.
- I read every remaining candidate by hand and removed what is never shown.
- Not shown, so not listed: inverse.js and gl.js reasons (they reach only a test hook), the morph-path selection log, GLSL compiler errors, console notes. There are 525 such literals; `notInventoried` has a sample.

## Counts: base (1,498)

| area | button | tooltip | aria | toast | error | heading | body | caption | latex | menu | palette | placeholder | total |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| chrome | 80 | 85 | 92 | 27 | 15 | 26 | 283 | 16 | 0 | 23 | 129 | 4 | 780 |
| math | 0 | 0 | 0 | 0 | 99 | 17 | 103 | 0 | 0 | 80 | 0 | 0 | 299 |
| export | 0 | 1 | 0 | 10 | 1 | 0 | 0 | 149 | 60 | 0 | 0 | 0 | 221 |
| guide | 0 | 0 | 0 | 0 | 0 | 0 | 49 | 0 | 0 | 0 | 0 | 0 | 49 |
| tour | 8 | 0 | 8 | 0 | 0 | 49 | 79 | 0 | 0 | 5 | 0 | 0 | 149 |
| all | 88 | 86 | 100 | 37 | 115 | 92 | 514 | 165 | 60 | 108 | 129 | 4 | 1498 |

## Counts: provisional (301)

| area | tooltip | aria | toast | error | body | caption | latex | menu | palette | placeholder | total |
|---|---|---|---|---|---|---|---|---|---|---|---|
| export (xr, figure.js) | 0 | 5 | 4 | 2 | 0 | 109 | 50 | 0 | 0 | 1 | 171 |
| sound (xs, sound.js) | 3 | 0 | 0 | 0 | 111 | 0 | 0 | 2 | 3 | 0 | 119 |
| tour (xt) | 1 | 0 | 0 | 0 | 7 | 0 | 0 | 0 | 0 | 0 | 8 |
| guide (xs rewrite) | 0 | 0 | 0 | 0 | 3 | 0 | 0 | 0 | 0 | 0 | 3 |

The xs guide rewrite also changes about 20 guide paragraphs. They are listed under sound because they mention Sound.

## Hazards (entries carrying each)

- Contains LaTeX: 311
- Test code uses the literal: 133. Tests must pin English or select by id.
- Built from pieces: 117. Captions are assembled from `{t, m}` segments; `out.push`, `+` and `join` are used.
- Needs grammatical case or gender: 95. Examples: `Target {label}`, `Click to place a {tg}point`, `{what} of f{k}`.
- Russian notation (tan, cot, sinh, arsinh, Re, log, arg in TeX): 92.
- Contains a key name: 69.
- Contains HTML markup: 59.
- Needs a plural: 49. Examples: `{nz} root{s} of …`, `{n} saved items could not be restored`, `{gone.length} zero–pole pairs cancel`. Russian needs 3 forms.
- Units or number format: 45. Examples: `2 min`, `×1/{n}`, `{x} pt`, `°`.
- Do not translate (also used as an identifier): 18.

## Do not translate (`doNotTranslate`, 203 rows)

- Parser identifier tables (parse.js:12-39): sin … conj, pi, theta. Saved work and links contain them. Add Russian spellings as aliases; never replace the English ones.
- Catalog group names (funcs.js `def.group`, `GROUPS`) are also catalog keys. Show them through a display map.
- Param labels `sheet`, `branch`, `zeros` and the palette group names `Custom formula`, `Region formulas`, `Curve formulas` are also compared in code.
- Step type ids, shape kinds, view modes, theme values and pattern ids are saved values. Only their display labels are listed.
- Key names compared with `e.key`: 47 sites.
- Export file-name suffixes (`-phase`, `-landscape`, `-deformation`, xr).

## Findings for the implementer

- Keyboard: the global keydown handler (app.js about 11805-11860) reads `e.key.toLowerCase()` for k, z, y, m, p, the tool letters, `[ ] ? / + =`. With the Russian layout these become Cyrillic letters or move. Use `e.code` for letters and brackets. The tour reads only Escape, Tab and the arrow keys, so it is safe.
- Function-name TeX lives in 3 places: parse.js:1156-1158 (`TEXN`), funcs.js trig and itrig tables (1207-1238), and the homotopy captions in funcs.js. All three need the notation switch.
- Figure captions are built from segments, mostly in app.js (`figureCaption`, `phaseText`, `morphCaption`, `latexDocument`) and funcs.js (`homTex`). Word order changes in Russian, so each sentence needs one template per language, not a translation of each piece.
- `texSpeech` (app.js:7549) builds spoken text from English words such as "less than" and "over".
- The palette search keywords (app.js:8236-8260, 8359-8363) are hidden but matched against what users type. Add Russian keywords next to the English ones.
- `Region.KINDS[k].label.toLowerCase()` is spliced into sentences, which breaks Russian case and gender.
- page.html holds about 120 static strings. app.js overwrites several of them at runtime (theme label, LEDs, readouts).
- CSS `content: "Preview"` (page.html:972) must move into a variable or an attribute.

## Limits and what is left

- `kind` is rule-based. Many chrome labels default to `body`. Check the kind when extracting each string.
- Hazard flags are heuristic. Plural and case flags may miss strings built across several functions.
- The provisional strings in xr, xs and xt will change. Re-run `inventory_tools/` after those copies merge.
- No browser checks were needed for this step: no daemon, server or Chrome profile was started.
