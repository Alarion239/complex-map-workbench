# Browser checks (headless Chrome, work/xl/test/i18n_cdp, port 8817)

- `behave.js`: English identity against `dist/base.html`, Russian-layout shortcuts, the language switch. Run as a q.sh command file.
- `matrix.js` + `ovf.js`: the width x theme matrix with an overflow detector. `matrix.js` expects `LANGS`, `PAGE`, `SHOTS` and `OVF_SRC` (the text of `ovf.js`) to be prepended or substituted (see DESIGN.md 8).
- `fonts.html`: the Cyrillic font specimen and metrics (`measure()`).
- `census.js`: a rough count of UI string literals per source file (`node census.js <files>`).
