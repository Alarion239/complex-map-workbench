# v15 build: shared numbers, links and scene files

Built in `work/xvd` (base: `work/v15-base`). Design: `../constructions/DESIGN.md` §1 and §3 (phase 1), README "What it does".

## What works

- **Named numbers.** A number has a name, a value, a range (min, max, step), a slider and Play. A name is one Latin
  letter, with an index if you like (`a`, `k`, `a1` = `a_1` = `a₁`), or a Greek letter (`beta`, `\beta`, `β`).
- **Typing a new name creates it.** Enter (or leaving the field) in any formula field adds the number, with value 1 on
  [−2, 2]. The row appears in Parameters, and a toast says "Added the number a · Undo". Creation and use are one undo
  step.
- **Every formula field takes names:** step parameters (Möbius *a b c d*, *c*, *α*, coefficient lists, the custom
  formula), zeros and poles, shape fields (points and radii), region formulas and curves (`Re z = a`).
- **One change moves everything that uses it.** The slider is live at 60 fps (motion frames). At rest the renderer
  does its normal rest pass. The test checks that the rest frame after a drag equals a fresh load, byte for byte.
- **Refused, with a message:** `z w x y r i e θ π` (each says why, e.g. "r is |z| in region formulas: use ρ or R"),
  function names and words ("sinc"), Cyrillic letters ("Use Latin letters for names"), duplicates, cycles
  ("b would depend on itself: b → a → b"), and two new names in one edit ("One new name at a time: s, t").
- **Delete** of a used number asks: "Used by f₁, Disc 1 … Delete a and write its value 0.49 into those formulas?" The
  value is written in parentheses, so `2a` becomes `2(0.49)`. **Rename** rewrites every formula that uses it.
- **A number by formula** (`b = 2a + 1`): type a formula in the value field. "Make free" in ⋯ turns it back.
- **Play** runs the number between its ends (back and forth, or a loop from ⋯). It never adds undo steps.
- **Saved state, undo and the language switch** keep the numbers (`S.params`, and `s.bind` on shapes).
- **Copy link** (Export menu): the whole figure in `#cmw=1.<deflate-raw, base64url>`. A typical figure is about 750
  characters. Over 8000 the toast warns that some apps cut long links. Over 2 MB it says "use Save scene". Without
  CompressionStream the link is `0.<plain base64url>`.
  - On a fresh page a link opens at once. Over your own work it asks first, and the bar stays until you answer.
  - A link pasted into an open tab works too (hashchange).
  - Undo in the toast brings the previous figure back.
  - A link with a state from an older build opens, through `sanitizeState`.
- **Save scene / Open scene…** (Export menu): `figure.cmw.json` goes through the downloads capability where present,
  else a normal download. Open uses a file picker, or you drop the file on the page. The file is checked on load.
- **Russian:** 83 strings in `notes/i18n/ru/v15-params.json`, written to the glossary rules (no-break space before
  dashes, «число», «рисунок», «сцена»).

## How it is built (for the merge)

- **`src/params.js`** (new, before app.js in build.py): the global `Params`. It provides `mount(el)`, `list()`,
  `get(name)`, `set(name, value)` and `on('change', fn)`, plus add, remove, rename, check, namesIn, resolve, links and
  scenes. It installs the formula hook at load: `Expr.setNames({get, display})`. Its CSS is injected by itself, so
  page.html is unchanged.
- **`src/parse.js`:** the name scope. Only text that was an error before reads differently. `xi` stays *x·i*, `chi`
  stays ch *i*, and Russian и/или/не still work. Without the hook (node tests) nothing changes. A name becomes a
  `num` node with `.param`, so all analysis, `toTex` (it shows the name), and GLSL (the value is a uniform) work
  unchanged. `Expr.nameSpans(src)` gives the names' positions.
- **Steps keep the names in their text.** `chainSig` adds the values (`paramSig`), so every cache keyed by it sees a
  change. The GPU program's key does not change, so a slider never recompiles (tested for the custom formula and
  Möbius).
- **Shapes:** a field with names keeps its text in `s.bind[key]` and its value in the field. For a formula, `s.expr`
  holds the text with the values written in (`Re z = (0.5)`). Renderers, `shapeKey` and every other cache see plain
  values, and an older build still shows the last good shape. Region's `tex` shows the names.
- **app.js edits** (small, in place):
  - `blankState`, `snap`/`restore` and `sanitizeState` (params, and `bind` on shapes);
  - `chainSig`; `writeState` (the `figureSwap` guard while a link opens);
  - `ptField` and `numField` (numField is now a text field, so `2a` can be typed), and the formula and curve editors;
  - the formula box's Add; three Export menu items; `data-fx` on the formula fields;
  - one glue block before `init()`, and two lines in `init()`.
- **`tools/make_ru_table.py`** also reads `notes/i18n/ru/v15-*.json`. The other two builds need the same one-line
  change.
- **Mounted for testing only** at the top of the right panel (`#paramsSlot`). This is skipped when a global
  `Inspector` exists, which then calls `Params.mount` itself.
- **The context-menu build:** a zero added by `zpAdd` is a plain number. A zero whose text is a name keeps it, and
  `zpSet` (a drag) replaces only the dragged item.

## Tests

- `node test/t_params.js`: 131/131. It covers names, unknown names, clashes, dependencies and cycles, rename and
  delete, steps (CPU values, GPU keys stable), resolve, sanitize, link round-trips (compressed, plain, large,
  damaged, newer, an older state) and scenes.
- `test/v15_params_cmd.js` (CDP, headless Chrome): pass.
  - It creates a number by typing `Re z = a`, then uses it in Möbius *b* = `a i`, in a disc radius `2a`, in ζ₁ = `a`
    and in `|z − a| < 0.5`.
  - It drags the slider. The rest frame equals a fresh load (both planes, identical PNG data). Undo, reload, the value
    field and the refusals all pass.
  - Links: to a fresh page, over existing work (it asks, Open, then Undo), and an older build's state. A scene opens
    through the real file picker (`DOM.setFileInputFiles`).
  - Russian: switched, kept, with the heading «Параметры», in light and dark.
  - Screenshots: `work/xvd/test/params_cdp/shots/v15p-*.png`.
  - Frame times while dragging, measured in headless Chrome: rAF work p95 1.2 ms, the slider's input handler p95
    7.1 ms, frame interval p95 16.7 ms.
- **Quality suite:** PASS with targets enforced (81 runs, 0 failed, 259 targets met). Goldens and baselines were not
  touched. The planes keep their size, because the slot is inside the right panel.
- **Other node tests:** all pass, except two that this build does not cause:
  - `t_sound.js`: 2 timing checks of the sound queue fail. sound.js is untouched.
  - `t_i18n.js`: 1 check fails, on two strings from `v15-desktop.json`, the desktop build's file (no no-break space
    before «—»). My strings pass.
- **Perf suite:** not run. It needs a free machine. Run `test/regress/perf/run.sh --paired --quick` at the gate.

## Left for later

- **Integer fields** (the *n* of a root, the sheet *k*, the cut angle) are still number inputs, so they take no
  names. The integer-class rule of DESIGN.md §2 is not built.
- **The Inspector's Selection section for a number:** range, play mode and "used by" with links. Today the range is
  edited inline from ⋯, and "used by" shows only in the delete question.
- **Not built yet:**
  - the link chip in a field bound to a name;
  - the note "a here is the shared number, not a₂";
  - the tour step;
  - the perf units `param.drag` with 1, 10 and 50 users.
- **Drags:** dragging a bound shape handle writes a plain value, but `s.bind` stays, so the next change of the
  number puts the handle back. The fix is to drop the bind for the dragged key (Region.setHandle and translate
  callers).
- **The Shapes list** shows a bound shape's values (`|z| < 0,98`), not its formula (`2a`).
- **The artifact host:** in the claude.ai artifact the copied link is the iframe's own address. That address may not
  open outside claude.ai. On GitHub Pages the link is the page's address.
- **The ask bar** for a link over existing work uses the toast host. It needs keyboard focus handling.

## Review round (2026-10-23)

The 60 findings of the v15 reviews are fixed or answered in `review-v15.md` (ledger: `../ledger-v15.json`). Some notes
above are now out of date: see that file for what changed.
