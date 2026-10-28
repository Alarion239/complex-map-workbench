# Russian localization: the user's decisions

- 2026-10-22, the request: "Can you add russian localization if system language is russian?"
- 2026-10-22, notation: "Yes: in the Russian interface show Russian notation (tg, ctg, sh, ch, th, arctg), and accept
  both spellings when typing." So the Russian interface renders tg, ctg, sh, ch, th, arctg (and the matching inverse
  and hyperbolic names chosen in GLOSSARY.md) in formulas, captions and LaTeX; the formula parser accepts both the
  international and the Russian spellings in either language.

- 2026-10-22, the Language setting, FINAL: first "Keep the header as it is: put the Language setting in the menus and
  the command palette, not as a header button", then reversed: "Okay, actually, do leave the globe button, i liked
  it". So the header KEEPS the Language (globe) button, as in the phase-1 prototype (in both languages), and the
  setting (Auto, English, Русский) is also in the menus (the phone More menu) and the command palette ("язык",
  "language"). The top bar already runs past the right edge at 768-1023 px (a known issue from the tour round): the
  globe must not make that worse; where the bar is short of room it folds into the More menu like the other
  secondary buttons.

- 2026-10-28, the Language setting, superseding the decision above (the owner, for v17 D5 and #82): the
  globe goes. Language lives only in the header's ⚙ Settings on the laptop (a four-way switch: Auto, English, Русский,
  Italiano) and in its counterpart on the phone, the More sheet; the command palette keeps its Language rows.
  plan/ux-audit/REPORT.md D5, issues #27 and #82.

Still defaults, not yet confirmed by the user: detection by the browser's first preferred language (the setting is stored on the
device); captions and LaTeX following the interface with a
caption-language switch in the export dialog; the decimal separator; the fonts.

Lead defaults taken on 2026-10-22 (the user can still change them):
- Decimal separator: the comma on screen in Russian (readouts, captions, tick labels; 0{,}5 in LaTeX), the point when
  typing and in copied values (so they paste back). A Russian parse error for "0,5" adds the hint «Дробную часть
  отделяйте точкой: 0.5».
- Tablet widths (768-1023 px), where the top bar already overflows in English and there is no More menu: phase 2b
  adds a More menu there (the header's secondary buttons fold into it, the globe included), so nothing overflows.
- Page size (verify-3, 2026-10-23): the Russian table and the Cyrillic outline tables add about 489 KB (+21.7 %) to
  the file every reader downloads. Lead decision: keep them in the single file (it must stay one HTML file), but as
  non-executed JSON blocks (<script type="application/json">) that are parsed only in Russian (the table) or on the
  first Russian figure (the outlines), so English pays bytes only, never parse or compile time; and subset the bold
  Cyrillic face to the glyphs bold Russian text actually uses (computed at build time), or drop it if nothing is bold.
