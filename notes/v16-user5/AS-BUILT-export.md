# v16.1 user-5: exact sheet captions, Export figure menus (as built)

Tree: `work/xvex` (a copy of v16). Nothing in the main tree was touched.

## The user's two requests

1. "When you say 'shown every sheet' this is not technically true if there are infinitely many sheets. Please change
   the formulation in the export LaTeX."
2. "I do not see anything pop-up when I press more options on the Figure export. Maybe it's behind the main view?"

## 1. Sheet captions say exactly what is drawn

Before: every Landscape with All sheets said "; all sheets of the Riemann surface are shown." (Russian «; показаны все
листы римановой поверхности.»), and the pane title said ", all sheets". For log the landscape draws only the sheets
k = −2…2. Also, with the deformation on, the caption still said "all sheets" although the landscape draws H_t.

Now one clause, built from what the landscape actually draws (`sheetsShown()` in app.js uses the same test as
`render3D`, and `GLR.sheetInfo` gives the counts):

| Case | English caption | Russian caption | Pane title |
|---|---|---|---|
| √z, sin √z (2 sheets) | ; both sheets are shown. | ; показаны оба листа. | , both sheets |
| ∛z (3 to 24 sheets) | ; all 3 sheets are shown. | ; показаны все 3 листа. (plural forms) | , all 3 sheets |
| log z, z^i | ; the sheets $k=-2,\dots,2$ of infinitely many are shown. | ; из бесконечного множества листов показаны листы $k=-2,\dots,2$. | , sheets k = −2…2 |
| a 30th root, z^0.123 (more than 24 sheets, drawn in a window) | ; the sheets $k=-2,\dots,2$ of 30 are shown. | ; показаны листы $k=-2,\dots,2$ (всего листов: 30). | , sheets k = −2…2 |
| log z + √z (several pieces, one infinite) | ; 10 of the infinitely many sheets are shown (the window $k=-2,\dots,2$). | ; показаны листы: 10 из бесконечного множества (окно $k=-2,\dots,2$). | , 10 sheets, k = −2…2 |
| ⁶√(⁵√z) (capped) | ; 24 of the 30 sheet combinations are shown. | ; показаны сочетания листов: 24 из 30. | , 24 of 30 sheet combinations |
| log(log z) (capped, window) | ; 24 of the 25 sheet combinations in the window $k=-2,\dots,2$ are shown. | ; показаны сочетания листов в окне $k=-2,\dots,2$: 24 из 25. | , 24 of 25 sheet combinations, k = −2…2 |
| deformation on | no sheet clause (the landscape draws H_t) | the same | no suffix |

- The window follows the "sheets ±" setting (k = −1…1 up to −4…4).
- "Of how many" is exact: `Funcs.stepSheets` now also gives each multivalued piece its own count (`of`): n for a root,
  Infinity for log, z^z and a non-real exponent, and for a real exponent the denominator of the fraction that is exactly
  the number (0.123 = 123/1000, so 1000 sheets; √2 and π: infinitely many). `Funcs.sheetCountOf` does this with the
  continued fraction, denominators up to 10^6.
- The Russian phrasing avoids number agreement where it can (colon forms); "all n" uses the plural table.
- Glossary: with All sheets the Russian display now writes the multivalued function, `F(z)=\operatorname{Ln} z`
  (GLOSSARY 2.2). Before, only an inline formula got Ln; a displayed one stayed `\ln z`. English is unchanged (`\log`).
- The same clause is used by the LaTeX caption (figure.js), the figure's own typeset caption, the legacy caption
  builder (`figureCaption` in app.js) and the Landscape pane title.
- The example "Every sheet of the logarithm" is now "Sheets of the logarithm" («Листы логарифма»). The tour's internal
  scene keeps its old English name (it is not shown).

Not changed (left for whoever owns those texts): the "All sheets" check's own name, the guide paragraph ("All sheets
draws its whole Riemann surface") and the tour step's body ("draws the whole Riemann surface of a multivalued map").
These describe the control, not an exported figure, but say "whole" for log too.

## 2. Export figure: More formats (and Size) menus

Cause: the menus go into `#popHost` with the popover layer, z-index 30. The dialog's backdrop `.modal-bg` is z-index 50,
so both menus opened from the dialog (More formats, and the Size menu) opened under the dialog: present, focused,
invisible and unclickable. Reproduced on v16 at 1440 px and on the phone (390 px): `elementFromPoint` at the menu's
centre hit the dialog (`btn xf-texcopy`, `xf-h`), z-index 30.

Fix:
- `openMenu` (app.js): a menu whose opener is inside a `.modal-bg` gets the class `over-modal`.
- page.html: `.pop.over-modal { z-index: 55 }` (over the modal 50, under the toast 60 and the tooltip 70).
- figure.js: a press outside an open menu closes the menu only, not the whole dialog with it.

Checked, desktop 1440 × 900 and phone 390 × 844, light and dark: each menu opens on top (elementFromPoint at its
centre and corner is inside it), inside the viewport, with the focus on its first item; arrows move; Esc closes the
menu, keeps the dialog and puts the focus back on the button; Enter on the focused button opens it; a press on the
backdrop closes the menu, not the dialog; a real mouse click on "SVG" saves the SVG. The other controls in the dialog
are native selects (text size, dpi, video options), which the browser draws on top.

Screenshots: `export/menu-v16-*.png` (before: nothing visible), `export/menu-fix-*.png` (after),
`export/latex-*.png` (compiled pages), `export/ru-landscape-title-log.png`.

## Files

- src/funcs.js: `sheetCountOf`, `of` on each piece of `stepSheets`.
- src/app.js: `sheetsShown`, `sheetsClause` (also on the figure API), the pane title, `figureCaption`, `capParts().sheets`
  (the descriptor, or null), the example's name, `openMenu`'s `over-modal`.
- src/figure.js: the Landscape caption uses the clause; `displayF(..., multi)` for Ln; the dialog keeps itself on an
  outside press that closes a menu.
- src/page.html: `.pop.over-modal`.
- tools/make_ru_table.py: reads `notes/i18n/ru/v161-*.json` listed in `V161_HERE` (here: `v161-user5.json`).
- notes/i18n/ru/v161-user5.json: 15 entries (3 plural). The file is shared with the other user-5 pieces. My first
  write replaced it whole. work/xvsh then wrote over it at 13:23, and restored my 15 entries from my built table as
  `xvex.restored1` … `xvex.restored15` (same English, Russian and plural forms; new ids and notes). Checked after the
  restore: `--strict` 0 unresolved, the same 2282 entries, and dist rebuilt byte-identical.
- test/export_cmd.js: section 6 (CMW_ONLY=user5 runs it alone); sections 5 and 5b skip under CMW_ONLY=user5.
- test/i18n_cmd.js: section 8 (Russian example name and Landscape title).
- test/mv_views_cmd.js, test/ub_views_cmd.js: the example's new name.

## Merge notes (with work/xvsh, All sheets while deforming)

- Both trees add a function named `sheetsShown` in app.js. Here it returns null while the deformation is on, because
  v16's render3D draws no sheets then. xvsh draws sheets while deforming, so the merged version should return xvsh's
  sheets for H_t and this descriptor otherwise. Keep `pieces[].of` (from `Funcs.stepSheets`), so the counts stay exact.
- xvsh's H_t title reads ", all sheets" ("…, все листы"). For log, or for a capped map, that is the inexact wording the
  user asked to remove. Use `sheetsClause(sh, 'html')` for it as well.
- Both trees add `Funcs.stepSheets` changes (xvsh moved `stepPair` out of `sheetEval`; here `of` is added to each
  piece). These are separate hunks.
- tools/make_ru_table.py: xvsh reads every `v161-*.json`; here only the files listed in `V161_HERE`. Either works for
  the merge.

## Tests

Headless Chrome on port 9703 (kit copy test/u5_cdp), serving work/xvex/dist.

- `python3 tools/make_ru_table.py --strict`: 0 unresolved, 2282 entries. Against v16's table: the 2 old keys
  removed, the 15 new ones added. One more value differs ("Right-click the spiral, then Listen along."). That comes
  from notes/i18n/ru/v16-fix.json, which the v16.1 fix pass edited after v16 froze, not from this work.
- `export_cmd.js` section 6 alone (`CMW_ONLY=user5`): all checks pass (8 sheet cases × EN/RU caption, title and the
  figure's own caption, the deformation case, the Ln display, and the menus at 1440 and 390 px, light and dark).
- `export_cmd.js` full (export/export_cmd-run1.json): 80 figures, 307 files. Every check passes except 2 timing
  checks in the video sections: "video globe: no main-thread task of 50 ms" (one 58 ms task) and "preview DPR 2 …
  frames on time" (worst frame 55 ms). The v16 gate passed both. This work does not touch those paths (with All sheets
  off, `sheetsShown()` returns at once), and the machine was loaded by other runs. A second full run to confirm was
  stopped when free disk fell below 1.5 GB (858 MB, filled by other work).
- `preflight.py --latex` (export/preflight-latex.txt): 1042 checks, 4 failures. They are the same 4
  `pv-*-frame.png` (RGBA test captures of the video preview, not figures) that the v16 gate had (970 checks, the same
  4). Every LaTeX document compiles in pdfLaTeX and XeLaTeX, English and Russian, all five classes. That includes the
  8 new sheet snippets (log, capped, log + √ in article; log in homework; each in EN and RU).
- `i18n_cmd.js`: 92/92 (export/i18n_cmd.json), run before its new section 8; section 8 run alone: 2/2.
- `mv_views_cmd.js`: pass (the renamed example still opens in Landscape). `ub_views_cmd.js`: 50 failures, the same
  50 on the v16 page (an old suite from before the merged views; not in the gate).

Not re-run after the last edits: the full i18n suite with section 8 included, and the second full export run. The
disk was too low.
